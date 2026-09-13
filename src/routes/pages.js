
const express = require('express');
const db = require('../../db/client');

const router = express.Router();

router.get('/', (req, res) => {
  res.send(
    '<html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial;text-align:center;padding:40px;">'
    + '<h1>Madeirabook</h1>'
    + '<p>Платформа бронирования Madeira</p>'
    + '<p><a href="/health">Health</a> | '
    + '<a href="/admin">Admin</a></p>'
    + '</body></html>'
  );
});

router.get('/booking-success', async (req, res) => {
  const sessionId = req.query.session_id;
  let booking = null;

  if (sessionId) {
    try {
      const r = await db.query(
        'SELECT b.amount_cents, b.status, b.arrival_date, '
        + 'b.departure_date, p.smoobu_id '
        + 'FROM bookings b '
        + 'JOIN properties p ON p.id = b.property_id '
        + 'WHERE b.stripe_session_id = $1',
        [sessionId]
      );
      if (r.rows.length) {
        booking = r.rows[0];
      }
    } catch (e) {
      // ignore
    }
  }

  let body = '<h2 style="color:#28a745;">'
    + 'Оплата прошла успешно</h2>';

  if (booking) {
    const amount = (booking.amount_cents / 100).toFixed(2);
    body += '<p>Объект: <b>' + booking.smoobu_id + '</b></p>'
      + '<p>Даты: ' + booking.arrival_date
      + ' — ' + booking.departure_date + '</p>'
      + '<p>Сумма: €' + amount + '</p>'
      + '<p>Статус: ' + booking.status + '</p>';
  } else {
    body += '<p>Загрузка...</p>';
  }

  body += '<p>Подтверждение придёт на email.</p>';

  res.send(
    '<html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial;text-align:center;padding:40px;">'
    + body
    + '</body></html>'
  );
});

router.get('/booking-cancel', (req, res) => {
  res.send(
    '<html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial;text-align:center;padding:40px;">'
    + '<h2>Оплата отменена</h2>'
    + '<p>Бронь не создана. Попробуйте снова.</p>'
    + '</body></html>'
  );
});

module.exports = router;
