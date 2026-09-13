const express = require('express');
const pool = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

/**
 * GET /success?session_id=...
 * Страница после успешной оплаты.
 */
router.get('/success', async (req, res, next) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).send('Missing session_id');
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, status, guest_email, arrival_date, departure_date
       FROM bookings WHERE stripe_session_id = $1`,
      [session_id]
    );

    if (rows.length === 0) {
      return res.status(404).send('Booking not found');
    }

    const booking = rows[0];

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>✅ Оплата прошла успешно!</h1>
          <p>Номер вашей брони: <strong>#${booking.id}</strong></p>
          <p>Мы отправили детали на <strong>${booking.guest_email}</strong></p>
          <p>Даты: ${booking.arrival_date} → ${booking.departure_date}</p>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /cancel
 * Страница после отмены оплаты.
 */
router.get('/cancel', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>❌ Оплата отменена</h1>
        <p>Вы можете вернуться и попробовать снова.</p>
      </body>
    </html>
  `);
});

module.exports = router;
