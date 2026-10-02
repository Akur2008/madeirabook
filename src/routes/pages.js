
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


// === GUEST PROPERTY PAGE ===
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

router.get('/p/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const r = await db.query(
      'SELECT id, slug, title, smoobu_id, price_per_night, cleaning_fee, ' +
      'location_id, status, charges_enabled ' +
      'FROM properties WHERE slug = $1 LIMIT 1',
      [slug]
    );
    if (!r.rows.length) {
      return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title>'
        + '<script src="https://cdn.tailwindcss.com"></script></head>'
        + '<body class="bg-slate-50 min-h-screen flex items-center justify-center px-6">'
        + '<div class="text-center"><h1 class="text-4xl font-black mb-2">404</h1>'
        + '<p class="text-slate-500 mb-4">Property not found</p>'
        + '<a href="/" class="text-emerald-600 hover:underline">Go home</a></div></body></html>');
    }
    const p = r.rows[0];
    const priceEuro = p.price_per_night ? Number(p.price_per_night).toFixed(0) : '—';
    const cleaning = p.cleaning_fee ? Number(p.cleaning_fee).toFixed(0) : '0';

    res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-slate-50 min-h-screen">
<div class="max-w-2xl mx-auto px-6 py-12">
  <a href="/" class="text-sm text-slate-500 hover:text-slate-800">&larr; Madeirabook</a>
  <h1 class="text-3xl font-black mt-4 mb-2">${esc(p.title)}</h1>
  <p class="text-slate-500 mb-6">${priceEuro} &euro; / night &middot; cleaning ${cleaning} &euro;</p>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 class="text-lg font-bold mb-4">Book this property</h2>
    <form id="bookForm" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Arrival</label>
          <input type="date" name="arrivalDate" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Departure</label>
          <input type="date" name="departureDate" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Your name</label>
        <input type="text" name="guestName" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Email</label>
        <input type="email" name="guestEmail" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <button type="submit" id="submitBtn" class="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 transition-colors">
        Continue to payment
      </button>
      <p id="errMsg" class="hidden text-sm text-red-600"></p>
    </form>
  </div>
  <footer class="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-wrap gap-4">
    <a href="/legal/cookie-policy" class="hover:text-slate-700">Cookie Policy</a>
    <a href="/legal/privacy-policy" class="hover:text-slate-700">Privacy Policy</a>
    <a href="/legal/terms-of-service" class="hover:text-slate-700">Terms of Service</a>
  </footer>
</div>

<script>
document.getElementById('bookForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const err = document.getElementById('errMsg');
  btn.disabled = true; btn.textContent = 'Creating session...';
  err.classList.add('hidden');
  const fd = new FormData(e.target);
  const body = {
    propertyId: ${JSON.stringify(p.smoobu_id)},
    arrivalDate: fd.get('arrivalDate'),
    departureDate: fd.get('departureDate'),
    guestName: fd.get('guestName'),
    guestEmail: fd.get('guestEmail')
  };
  try {
    const r = await fetch('/api/create-booking-and-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok || !data.url) {
      throw new Error(data.error || 'Could not create payment session');
    }
    window.location.href = data.url;
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Continue to payment';
  }
});
</script>
</body></html>`);
  } catch (e) {
    next(e);
  }
});



// === LEGAL PAGES ===
function renderLegal(title, content, lastUpdated) {
  const body = content
    ? esc(content).replace(/\n/g, '<br>')
    : '<p class="text-slate-400 italic">This document is being prepared. Check back soon.</p>';
  const updated = lastUpdated
    ? '<p class="text-xs text-slate-400 mt-8">Last updated: ' + new Date(lastUpdated).toISOString().slice(0, 10) + '</p>'
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen">
<div class="max-w-2xl mx-auto px-6 py-12">
  <a href="/" class="text-sm text-slate-500 hover:text-slate-800">&larr; Madeirabook</a>
  <h1 class="text-3xl font-black mt-4 mb-6">${esc(title)}</h1>
  <div class="text-slate-700 leading-relaxed">${body}</div>
  ${updated}
  <footer class="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-wrap gap-4">
    <a href="/legal/cookie-policy" class="hover:text-slate-700">Cookie Policy</a>
    <a href="/legal/privacy-policy" class="hover:text-slate-700">Privacy Policy</a>
    <a href="/legal/terms-of-service" class="hover:text-slate-700">Terms of Service</a>
  </footer>
</div>
</body></html>`;
}

function legalHandler(table, fallbackTitle) {
  return async (req, res, next) => {
    try {
      let row = null;
      try {
        const r = await db.query('SELECT title, content, last_updated FROM ' + table + ' LIMIT 1');
        row = r.rows[0] || null;
      } catch (e) {
        // таблицы может не быть в конкретном окружении — отдаём placeholder
      }
      const title = (row && row.title) || fallbackTitle;
      const content = row && row.content;
      const lastUpdated = row && row.last_updated;
      res.send(renderLegal(title, content, lastUpdated));
    } catch (e) {
      next(e);
    }
  };
}

router.get('/legal/cookie-policy', legalHandler('cookie_policy', 'Cookie Policy'));
router.get('/legal/privacy-policy', legalHandler('privacy_policy', 'Privacy Policy'));
router.get('/legal/terms-of-service', legalHandler('terms_of_service', 'Terms of Service'));


module.exports = router;
