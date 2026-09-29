
const express = require('express');
const db = require('../../db/client');
const { renderPage, SITE_URL, BOOKING_URL } = require('../views/layout');

const router = express.Router();

router.get('/', (req, res) => {
  res.send(renderPage({
    title: 'Madeirabook — apartments and small hotels in Madeira',
    description: 'Direct booking of apartments and small hotels in Madeira, '
      + 'Portugal, from local hosts.',
    path: '/',
    body: '<p class="eyebrow">Madeira · all year round</p>'
      + '<h1 class="page-title">Madeira stays, direct.</h1>'
      + '<p class="lead">Ocean-view apartments and small hotels from local '
      + 'hosts. Best price guaranteed. No platform fees.</p>'
      + '<div class="actions">'
      + '<a class="btn" href="' + BOOKING_URL + '">Book a stay →</a>'
      + '<a class="btn-ghost" href="' + SITE_URL + '">Explore Madeira</a>'
      + '</div>'
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

  let body = '<p class="eyebrow">Бронирование</p>'
    + '<p class="status status-ok">Оплата прошла успешно</p>';

  if (booking) {
    const amount = (booking.amount_cents / 100).toFixed(2);
    body += '<ul class="summary">'
      + '<li><span>Объект</span><b>' + booking.smoobu_id + '</b></li>'
      + '<li><span>Даты</span><b>' + booking.arrival_date
      + ' — ' + booking.departure_date + '</b></li>'
      + '<li><span>Сумма</span><b>€' + amount + '</b></li>'
      + '<li><span>Статус</span><b>' + booking.status + '</b></li>'
      + '</ul>';
  } else {
    body += '<p class="lead">Загрузка данных брони...</p>';
  }

  body += '<p>Подтверждение придёт на email.</p>'
    + '<div class="actions"><a class="btn-ghost" href="' + SITE_URL
    + '">Вернуться на сайт</a></div>';

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
    body: '<p class="eyebrow">Бронирование</p>'
      + '<p class="status status-warn">Оплата отменена</p>'
      + '<p>Бронь не создана — деньги не списаны. Можно попробовать снова.</p>'
      + '<div class="actions">'
      + '<a class="btn" href="' + BOOKING_URL + '">Выбрать даты →</a>'
      + '<a class="btn-ghost" href="' + SITE_URL + '">Вернуться на сайт</a>'
      + '</div>'
  }));
});

module.exports = router;
