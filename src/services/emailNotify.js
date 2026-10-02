const { Resend } = require('resend');
const logger = require('../logger');

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

function fmtEuro(cents) {
  if (cents == null) return '-';
  return (Number(cents) / 100).toFixed(2) + ' EUR';
}

async function sendBookingPaid(opts) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ bookingId: opts.bookingId }, 'RESEND_API_KEY not set, emails skipped');
    return { ok: false, reason: 'no_api_key' };
  }
  const resend = new Resend(apiKey);
  const from = 'Madeirabook <hello@madeirabook.com>';

  const b = opts;
  const guestHtml = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">'
    + '<h2 style="color:#064e3b;">Booking confirmed</h2>'
    + '<p>Hi ' + escHtml(b.guestName || 'there') + ',</p>'
    + '<p>Your booking for <b>' + escHtml(b.propertyTitle || 'the property') + '</b> is confirmed.</p>'
    + '<p><b>Dates:</b> ' + fmtDate(b.arrivalDate) + ' -> ' + fmtDate(b.departureDate) + '<br>'
    + '<b>Amount paid:</b> ' + fmtEuro(b.amountCents) + '</p>'
    + '<p>If you have questions, reply to this email.</p>'
    + '<p style="color:#6b7280;font-size:14px;">- The Madeirabook team</p>'
    + '</div>';

  const ownerHtml = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">'
    + '<h2 style="color:#064e3b;">New booking</h2>'
    + '<p>You have a new paid booking for <b>' + escHtml(b.propertyTitle || 'your property') + '</b>.</p>'
    + '<p><b>Guest:</b> ' + escHtml(b.guestName || '-') + ' (' + escHtml(b.guestEmail || '-') + ')<br>'
    + '<b>Dates:</b> ' + fmtDate(b.arrivalDate) + ' -> ' + fmtDate(b.departureDate) + '<br>'
    + '<b>Amount:</b> ' + fmtEuro(b.amountCents) + '<br>'
    + '<b>Platform fee:</b> ' + fmtEuro(b.platformFeeCents) + '<br>'
    + '<b>Net to you:</b> ' + fmtEuro((b.amountCents || 0) - (b.platformFeeCents || 0)) + '</p>'
    + '<p style="color:#6b7280;font-size:14px;">- Madeirabook</p>'
    + '</div>';

  const results = { guest: null, owner: null };

  if (b.guestEmail) {
    try {
      await resend.emails.send({
        from: from,
        to: b.guestEmail,
        subject: 'Booking confirmed - ' + (b.propertyTitle || 'Madeirabook'),
        html: guestHtml
      });
      results.guest = 'sent';
      logger.info({ bookingId: b.bookingId, to: b.guestEmail }, 'guest booking email sent');
    } catch (e) {
      results.guest = 'failed';
      logger.error({ err: e.message, bookingId: b.bookingId }, 'guest booking email failed');
    }
  }

  if (b.ownerEmail) {
    try {
      await resend.emails.send({
        from: from,
        to: b.ownerEmail,
        subject: 'New booking - ' + (b.propertyTitle || 'your property'),
        html: ownerHtml
      });
      results.owner = 'sent';
      logger.info({ bookingId: b.bookingId, to: b.ownerEmail }, 'owner booking email sent');
    } catch (e) {
      results.owner = 'failed';
      logger.error({ err: e.message, bookingId: b.bookingId }, 'owner booking email failed');
    }
  }

  return results;
}

module.exports = { sendBookingPaid: sendBookingPaid };
