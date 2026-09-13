const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const pms = require('../services/pms');
const commission = require('../services/commission');
const config = require('../config');

const router = express.Router();

router.post('/create-booking-and-pay', async (req, res, next) => {
  try {
    const propertyId = req.body.propertyId;
    const arrivalDate = req.body.arrivalDate;
    const departureDate = req.body.departureDate;
    const guestEmail = req.body.guestEmail;
    const guestName = req.body.guestName;

    if (!propertyId || !arrivalDate || !departureDate || !guestEmail) {
      return res.status(400).json({
        error: 'Обязательные поля: propertyId, arrivalDate, '
          + 'departureDate, guestEmail'
      });
    }

    const propRes = await db.query(
      'SELECT p.id, p.smoobu_id, p.commission_percent, '
      + 'p.charges_enabled, o.stripe_account_id, o.id AS owner_id '
      + 'FROM properties p JOIN owners o ON o.id = p.owner_id '
      + 'WHERE p.smoobu_id = $1',
      [String(propertyId)]
    );

    if (!propRes.rows.length) {
      return res.status(404).json({ error: 'Объект не найден' });
    }

    const prop = propRes.rows[0];

    if (!prop.stripe_account_id || !prop.charges_enabled) {
      return res.status(400).json({
        error: 'Владелец ещё не завершил верификацию Stripe'
      });
    }

    const price = await pms.getPrice(
      prop.smoobu_id,
      arrivalDate,
      departureDate
    );

    const amountCents = Math.round(price * 100);
    const platformFeeCents = commission.calcFee(
      amountCents,
      prop.commission_percent
    );

    const smoobuBookingId = await pms.createReservation({
      propertyId: prop.smoobu_id,
      arrivalDate: arrivalDate,
      departureDate: departureDate,
      price: price,
      guestEmail: guestEmail,
      guestName: guestName
    });

    const ins = await db.query(
      'INSERT INTO bookings '
      + '(property_id, smoobu_booking_id, amount_cents, '
      + 'platform_fee_cents, status, source, guest_email, '
      + 'arrival_date, departure_date) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) '
      + 'RETURNING id',
      [
        prop.id,
        smoobuBookingId,
        amountCents,
        platformFeeCents,
        'pending',
        'direct',
        guestEmail,
        arrivalDate,
        departureDate
      ]
    );

    const bookingId = ins.rows[0].id;

    const base = config.APP_URL;
    const description = 'Бронирование #' + prop.smoobu_id
      + ' (' + arrivalDate + ' — ' + departureDate + ')';

    const session = await stripeSvc.createBookingCheckoutSession({
      stripeAccountId: prop.stripe_account_id,
      amountCents: amountCents,
      platformFeeCents: platformFeeCents,
      guestEmail: guestEmail,
      description: description,
      metadata: {
        smoobuBookingId: String(smoobuBookingId),
        bookingId: String(bookingId)
      },
      successUrl: base + '/booking-success'
        + '?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: base + '/booking-cancel'
    });

    await db.query(
      'UPDATE bookings SET stripe_session_id = $1 WHERE id = $2',
      [session.id, bookingId]
    );

    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
