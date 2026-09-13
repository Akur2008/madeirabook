const express = require('express');
const pool = require('../../db/client');
const config = require('../config');
const logger = require('../logger');
const { calculateCommission } = require('../services/commission');
const { createCheckoutSession } = require('../services/stripe');
const { getAvailability } = require('../services/pms');

const router = express.Router();

/**
 * POST /api/create-booking-and-pay
 * Создать pending-бронь + Stripe Checkout Session.
 * Цена берется ТОЛЬКО из Smoobu. Комиссия берется ТОЛЬКО из БД.
 */
router.post('/create-booking-and-pay', async (req, res, next) => {
  const { propertyId, guestEmail, arrivalDate, departureDate } = req.body;

  if (!propertyId || !guestEmail || !arrivalDate || !departureDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Получить property + owner + commission
    const { rows } = await pool.query(
      `SELECT p.id, p.smoobu_id, p.commission_percent, p.charges_enabled,
              o.stripe_account_id
       FROM properties p
       JOIN owners o ON o.id = p.owner_id
       WHERE p.id = $1`,
      [propertyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = rows[0];

    if (!property.charges_enabled) {
      return res.status(400).json({ error: 'Owner has not completed Stripe onboarding' });
    }

    // 2. Получить цену из Smoobu (единственный источник правды)
    const availability = await getAvailability(property.smoobu_id, arrivalDate, departureDate);
    // TODO: извлечь точную цену из availability для выбранных дат.
    // Пока — заглушка.
    const amountCents = 10000; // €100.00

    // 3. Посчитать комиссию
    const commission = calculateCommission(amountCents, property.commission_percent);

    // 4. Создать pending-бронь в БД
    const bookingResult = await pool.query(
      `INSERT INTO bookings
         (property_id, stripe_session_id, amount_cents, platform_fee_cents,
          status, guest_email, arrival_date, departure_date)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING id`,
      [property.id, 'temp_' + Date.now(), commission.amountCents,
       commission.platformFeeCents, guestEmail, arrivalDate, departureDate]
    );
    const bookingId = bookingResult.rows[0].id;

    // 5. Создать Stripe Checkout Session
    const session = await createCheckoutSession({
      amountCents: commission.amountCents,
      platformFeeCents: commission.platformFeeCents,
      stripeAccountId: property.stripe_account_id,
      propertyId: property.id,
      bookingId: bookingId,
      guestEmail,
      successUrl: `${config.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.APP_URL}/cancel`,
    });

    // 6. Обновить бронь реальным session.id
    await pool.query(
      'UPDATE bookings SET stripe_session_id = $1 WHERE id = $2',
      [session.id, bookingId]
    );

    logger.info({ bookingId, sessionId: session.id }, 'Checkout session created');
    res.json({ checkoutUrl: session.url, bookingId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
