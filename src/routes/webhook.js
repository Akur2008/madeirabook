const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const pms = require('../services/pms');
const logger = require('../logger');

const router = express.Router();

router.post('/', async (req, res) => {
  let event;
  try {
    event = stripeSvc.constructWebhookEvent(
      req.body,
      req.headers['stripe-signature']
    );
  } catch (e) {
    logger.warn({ err: e.message }, 'webhook signature failed');
    return res.status(400).send('Webhook Error: ' + e.message);
  }

  const ins = await db.query(
    'INSERT INTO webhook_events (id, type) VALUES ($1, $2) '
    + 'ON CONFLICT (id) DO NOTHING',
    [event.id, event.type]
  );

  if (ins.rowCount === 0) {
    logger.info(
      { id: event.id, type: event.type },
      'webhook duplicate, skip'
    );
    return res.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === 'account.updated') {
      const acc = event.data.object;
      await db.query(
        'UPDATE properties p SET charges_enabled = $1 '
        + 'FROM owners o WHERE p.owner_id = o.id '
        + 'AND o.stripe_account_id = $2',
        [acc.charges_enabled, acc.id]
      );
      logger.info(
        { accountId: acc.id, enabled: acc.charges_enabled },
        'account.updated'
      );
    } else if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const upd = await db.query(
        'UPDATE bookings SET status = $1, '
        + 'stripe_payment_intent = $2, updated_at = NOW() '
        + 'WHERE stripe_session_id = $3 '
        + 'RETURNING smoobu_booking_id',
        ['paid', s.payment_intent, s.id]
      );
      const row = upd.rows[0];
      if (row && row.smoobu_booking_id) {
        try {
          await pms.markPaid(row.smoobu_booking_id);
          logger.info(
            { smoobuBookingId: row.smoobu_booking_id },
            'marked paid in Smoobu'
          );
        } catch (smoobuErr) {
          logger.error(
            { err: smoobuErr.message },
            'smoobu markPaid failed'
          );
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const s = event.data.object;
      const upd = await db.query(
        'UPDATE bookings SET status = $1, updated_at = NOW() '
        + 'WHERE stripe_session_id = $2 AND status = $3 '
        + 'RETURNING smoobu_booking_id',
        ['cancelled', s.id, 'pending']
      );
      const row = upd.rows[0];
      if (row && row.smoobu_booking_id) {
        try {
          await pms.cancelReservation(row.smoobu_booking_id);
          logger.info(
            { smoobuBookingId: row.smoobu_booking_id },
            'cancelled in Smoobu (session expired)'
          );
        } catch (smoobuErr) {
          logger.error(
            { err: smoobuErr.message },
            'smoobu cancelReservation failed'
          );
        }
      }
    } else if (event.type === 'charge.refunded') {
      const ch = event.data.object;
      const upd = await db.query(
        'UPDATE bookings SET status = $1, updated_at = NOW() '
        + 'WHERE stripe_payment_intent = $2 '
        + 'RETURNING smoobu_booking_id',
        ['refunded', ch.payment_intent]
      );
      const row = upd.rows[0];
      if (row && row.smoobu_booking_id) {
        try {
          await pms.cancelReservation(row.smoobu_booking_id);
          logger.info(
            { smoobuBookingId: row.smoobu_booking_id },
            'cancelled in Smoobu (refunded)'
          );
        } catch (smoobuErr) {
          logger.error(
            { err: smoobuErr.message },
            'smoobu cancelReservation failed'
          );
        }
      }
    } else {
      logger.info({ type: event.type }, 'unhandled webhook type');
    }
  } catch (e) {
    logger.error(
      { err: e.message, id: event.id, type: event.type },
      'webhook handler error'
    );
    await db.query('DELETE FROM webhook_events WHERE id = $1', [event.id]);
    return res.status(500).send('Handler error');
  }

  res.json({ received: true });
});

module.exports = router;
