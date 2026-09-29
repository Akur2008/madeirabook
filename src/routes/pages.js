
const express = require('express');
const db = require('../../db/client');
const { renderPage } = require('../views/layout');

const router = express.Router();

router.get('/', (req, res) => {
  res.send(renderPage({
    title: 'Madeirabook — apartments and small hotels in Madeira',
    description: 'Direct booking of apartments and small hotels in Madeira, '
      + 'Portugal, from local hosts.',
    path: '/',
    body: '<h1>Madeirabook</h1>'
      + '<p>Direct booking of apartments and small hotels in Madeira.</p>'
      + '<p><a href="/health">Health</a> | <a href="/admin">Admin</a></p>'
  }));
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

  res.send(renderPage({
    title: 'Оплата прошла успешно — Madeirabook',
    description: 'Подтверждение бронирования Madeirabook.',
    path: '/booking-success',
    lang: 'ru',
    noindex: true,
    body: body
  }));
});

router.get('/booking-cancel', (req, res) => {
  res.send(renderPage({
    title: 'Оплата отменена — Madeirabook',
    description: 'Оплата бронирования отменена.',
    path: '/booking-cancel',
    lang: 'ru',
    noindex: true,
    body: '<h2>Оплата отменена</h2>'
      + '<p>Бронь не создана. Попробуйте снова.</p>'
  }));
});

module.exports = router;
