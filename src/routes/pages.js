
const express = require('express');
const db = require('../../db/client');
const { renderPage, SITE_URL, BOOKING_URL } = require('../views/layout');
const { t } = require('../i18n');

const router = express.Router();

router.get('/', (req, res) => {
  const locale = req.locale;

  res.send(renderPage({
    locale: locale,
    title: t(locale, 'home.title'),
    description: t(locale, 'home.description'),
    path: '/',
    body: '<p class="eyebrow">' + t(locale, 'home.eyebrow') + '</p>'
      + '<h1 class="page-title">' + t(locale, 'home.heading') + '</h1>'
      + '<p class="lead">' + t(locale, 'home.lead') + '</p>'
      + '<div class="actions">'
      + '<a class="btn" href="' + BOOKING_URL + '">'
      + t(locale, 'home.book') + ' →</a>'
      + '<a class="btn-ghost" href="' + SITE_URL + '">'
      + t(locale, 'home.explore') + '</a>'
      + '</div>'
  }));
});

router.get('/booking-success', async (req, res) => {
  const locale = req.locale;
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

  let body = '<p class="eyebrow">' + t(locale, 'booking.eyebrow') + '</p>'
    + '<p class="status status-ok">'
    + t(locale, 'booking.successHeading') + '</p>';

  if (booking) {
    const amount = (booking.amount_cents / 100).toFixed(2);
    body += '<ul class="summary">'
      + '<li><span>' + t(locale, 'booking.property') + '</span><b>'
      + booking.smoobu_id + '</b></li>'
      + '<li><span>' + t(locale, 'booking.dates') + '</span><b>'
      + booking.arrival_date + ' — ' + booking.departure_date + '</b></li>'
      + '<li><span>' + t(locale, 'booking.amount') + '</span><b>€'
      + amount + '</b></li>'
      + '<li><span>' + t(locale, 'booking.status') + '</span><b>'
      + booking.status + '</b></li>'
      + '</ul>';
  } else {
    body += '<p class="lead">' + t(locale, 'booking.loading') + '</p>';
  }

  body += '<p>' + t(locale, 'booking.emailNote') + '</p>'
    + '<div class="actions"><a class="btn-ghost" href="' + SITE_URL + '">'
    + t(locale, 'booking.backToSite') + '</a></div>';

  res.send(renderPage({
    locale: locale,
    title: t(locale, 'booking.successTitle'),
    description: t(locale, 'booking.successDescription'),
    path: '/booking-success',
    noindex: true,
    body: body
  }));
});

router.get('/booking-cancel', (req, res) => {
  const locale = req.locale;

  res.send(renderPage({
    locale: locale,
    title: t(locale, 'booking.cancelTitle'),
    description: t(locale, 'booking.cancelDescription'),
    path: '/booking-cancel',
    noindex: true,
    body: '<p class="eyebrow">' + t(locale, 'booking.eyebrow') + '</p>'
      + '<p class="status status-warn">'
      + t(locale, 'booking.cancelHeading') + '</p>'
      + '<p>' + t(locale, 'booking.cancelNote') + '</p>'
      + '<div class="actions">'
      + '<a class="btn" href="' + BOOKING_URL + '">'
      + t(locale, 'booking.chooseDates') + ' →</a>'
      + '<a class="btn-ghost" href="' + SITE_URL + '">'
      + t(locale, 'booking.backToSite') + '</a>'
      + '</div>'
  }));
});

module.exports = router;
