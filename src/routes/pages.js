
const express = require('express');
const db = require('../../db/client');
const pms = require('../services/pms/smoobu');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res, next) => {
  try {
    const arrival = (req.query.arrival || '').trim();
    const departure = (req.query.departure || '').trim();
    const hasDates = DATE_RE.test(arrival) && DATE_RE.test(departure) && arrival < departure;

    const r = await db.query(
      `SELECT p.id, p.slug, p.title, p.price_per_night, p.cleaning_fee, p.smoobu_id,
              (SELECT m.url FROM properties_media pm
               JOIN media m ON m.id = pm.image_id
               WHERE pm._parent_id = p.id ORDER BY pm._order LIMIT 1) AS cover
       FROM properties p
       WHERE p.status = 'published' AND p.is_verified = true
       ORDER BY p.featured DESC NULLS LAST, p.id DESC
       LIMIT 60`
    );
    let props = r.rows;

    // Фильтр по датам через Smoobu
    let availMap = null;
    let searchErr = '';
    if (hasDates) {
      const smoobuIds = props.filter(x => x.smoobu_id).map(x => Number(x.smoobu_id));
      try {
        availMap = await pms.checkAvailability(smoobuIds, arrival, departure);
      } catch (e) {
        console.warn('availability check failed:', e.message);
        searchErr = 'Could not check availability, showing all properties.';
      }
      if (availMap) {
        props = props.filter(x => !x.smoobu_id || (availMap[Number(x.smoobu_id)] && availMap[Number(x.smoobu_id)].available));
      }
    }

    let cards = '';
    for (const p of props) {
      let priceLine;
      if (hasDates && availMap && p.smoobu_id && availMap[Number(p.smoobu_id)]) {
        const total = availMap[Number(p.smoobu_id)].price;
        priceLine = Number(total).toFixed(0) + ' EUR total';
      } else {
        const price = p.price_per_night ? Number(p.price_per_night).toFixed(0) + ' EUR / night' : 'Price on request';
        priceLine = price;
      }
      const img = p.cover
        ? '<img src="' + esc(p.cover) + '" alt="' + esc(p.title) + '" class="w-full h-48 object-cover rounded-t-2xl">'
        : '<div class="w-full h-48 bg-slate-100 rounded-t-2xl flex items-center justify-center text-slate-400 text-sm">no photo</div>';
      const url = '/p/' + esc(p.slug) + (hasDates ? '?arrival=' + esc(arrival) + '&departure=' + esc(departure) : '');
      cards += '<a href="' + url + '" class="block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">'
        + img
        + '<div class="p-4">'
        + '<h3 class="font-bold text-lg mb-1">' + esc(p.title) + '</h3>'
        + '<p class="text-slate-500 text-sm">' + priceLine + '</p>'
        + '</div></a>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Madeirabook — book your stay in Madeira</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-slate-50 min-h-screen">
<div class="max-w-6xl mx-auto px-6 py-12">
  <header class="mb-10">
    <h1 class="text-4xl font-black mb-2">Madeirabook</h1>
    <p class="text-slate-500">Book unique stays in Madeira, direct from owners.</p>
  </header>

  <form method="GET" action="/" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-8 flex flex-wrap items-end gap-3">
    <div class="flex-1 min-w-[160px]">
      <label class="block text-xs uppercase text-slate-500 mb-1">Arrival</label>
      <input type="date" name="arrival" value="${esc(arrival)}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <div class="flex-1 min-w-[160px]">
      <label class="block text-xs uppercase text-slate-500 mb-1">Departure</label>
      <input type="date" name="departure" value="${esc(departure)}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <button type="submit" class="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6">Search</button>
    ${hasDates ? '<a href="/" class="text-sm text-slate-500 hover:underline py-2">Clear</a>' : ''}
  </form>

  ${searchErr ? '<div class="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">' + esc(searchErr) + '</div>' : ''}

  <h2 class="text-sm uppercase font-bold text-slate-500 mb-4">${hasDates ? 'Available ' + esc(arrival) + ' → ' + esc(departure) : 'Available properties'}</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${cards || '<p class="text-slate-400">No properties available for these dates</p>'}
  </div>

  <footer class="mt-16 pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-wrap gap-4">
    <a href="/legal/cookie-policy" class="hover:text-slate-700">Cookie Policy</a>
    <a href="/legal/privacy-policy" class="hover:text-slate-700">Privacy Policy</a>
    <a href="/legal/terms-of-service" class="hover:text-slate-700">Terms of Service</a>
  </footer>
</div>
</body></html>`);
  } catch (e) {
    next(e);
  }
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
      'SELECT id, slug, title, description, short_description, size_m2, bedrooms, bathrooms, ' +
      'max_guests, check_in_time, check_out_time, smoobu_id, price_per_night, cleaning_fee, ' +
      'location_id, status, charges_enabled ' +
      'FROM properties WHERE slug = $1 AND is_verified = true LIMIT 1',
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

    const qArrival = (req.query.arrival || '').trim();
    const qDeparture = (req.query.departure || '').trim();
    const hasQueryDates = DATE_RE.test(qArrival) && DATE_RE.test(qDeparture) && qArrival < qDeparture;

    // Календарь занятости на 5 месяцев
    let calendarHtml = '';
    if (p.smoobu_id) {
      try {
        const fmtD = d => d.toISOString().slice(0, 10);
        const today = new Date();
        const calFrom = new Date(today.getFullYear(), today.getMonth(), 1);
        const calTo = new Date(today.getFullYear(), today.getMonth() + 12, 0);
        const res = await pms.getReservations(fmtD(calFrom), fmtD(calTo), [Number(p.smoobu_id)]);
        const allBookings = (res && res.bookings) || [];
        const myAptId = Number(p.smoobu_id);
        const bookings = allBookings.filter(b => b.apartment && Number(b.apartment.id) === myAptId);
        const busy = new Set();
        for (const b of bookings) {
          if (b.is_blocked_booking && b.is_blocked_booking !== '0') continue;
          if (b.status === 'cancelled' || b.type === 'cancellation') continue;
          if (!b.arrival || !b.departure) continue;
          const from = new Date(b.arrival + 'T00:00:00Z');
          const to = new Date(b.departure + 'T00:00:00Z');
          for (let d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
            busy.add(d.toISOString().slice(0, 10));
          }
        }
        const todayStr = fmtD(today);
        let cal = '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">';
        cal += '<h2 class="text-lg font-bold mb-4">Availability</h2>';
        cal += '<div class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2" style="scroll-behavior:smooth;">';
        for (let m = 0; m < 12; m++) {
          const mDate = new Date(today.getFullYear(), today.getMonth() + m, 1);
          const monthName = mDate.toLocaleString('en', { month: 'long', year: 'numeric' });
          const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
          const firstDay = (new Date(mDate.getFullYear(), mDate.getMonth(), 1).getDay() + 6) % 7;
          cal += '<div class="snap-start flex-shrink-0 w-full md:w-[calc(33.333%-11px)]"><div class="text-xs font-bold text-slate-500 uppercase mb-2">' + monthName + '</div>';
          cal += '<div class="grid grid-cols-7 gap-1 text-center text-xs">';
          for (const wd of ['M','T','W','T','F','S','S']) cal += '<div class="text-slate-400 py-1 font-medium">' + wd + '</div>';
          for (let i = 0; i < firstDay; i++) cal += '<div></div>';
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = mDate.getFullYear() + '-' + String(mDate.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            let cls = 'py-1 rounded';
            if (dateStr < todayStr) cls += ' text-slate-300';
            else if (busy.has(dateStr)) cls += ' bg-red-100 text-red-400 line-through';
            else cls += ' bg-emerald-50 text-emerald-700';
            cal += '<div class="' + cls + '">' + d + '</div>';
          }
          cal += '</div></div>';
        }
        cal += '</div></div>';
        calendarHtml = cal;
      } catch (e) {
        console.warn('calendar load failed:', e.message);
      }
    }

    let availabilityHtml = '';
    if (hasQueryDates && p.smoobu_id) {
      try {
        const av = await pms.checkAvailability([Number(p.smoobu_id)], qArrival, qDeparture);
        const entry = av[Number(p.smoobu_id)];
        if (entry && entry.available) {
          const nights = Math.round((new Date(qDeparture) - new Date(qArrival)) / 86400000);
          const total = Number(entry.price);
          const cleanFee = Number(p.cleaning_fee) || 0;
          const rate = nights > 0 ? Math.round((total - cleanFee) / nights) : 0;
          const nightsLabel = nights + (nights === 1 ? ' night' : ' nights');
          availabilityHtml = '<div class="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 mb-4">'
            + '&#10003; <strong>Available</strong>'
            + '<div style="margin-top:8px;font-size:13px;color:#065f46;">'
            + '<div style="display:flex;justify-content:space-between;gap:16px;"><span>' + rate + ' EUR &times; ' + nightsLabel + '</span><span>' + (rate * nights) + ' EUR</span></div>'
            + (cleanFee > 0 ? '<div style="display:flex;justify-content:space-between;gap:16px;"><span>Cleaning fee</span><span>' + cleanFee + ' EUR</span></div>' : '')
            + '<div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid #6ee7b7;margin-top:6px;padding-top:6px;font-weight:800;font-size:14px;"><span>Total</span><span>' + total + ' EUR</span></div>'
            + '</div></div>';
        } else {
          availabilityHtml = '<div class="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 mb-4">'
            + 'Not available for ' + esc(qArrival) + ' → ' + esc(qDeparture) + '</div>';
        }
      } catch (e) {
        console.warn('availability check failed:', e.message);
      }
    }

    const mediaRes = await db.query(
      'SELECT m.url, m.alt FROM properties_media pm '
      + 'JOIN media m ON m.id = pm.image_id '
      + 'WHERE pm._parent_id = $1 ORDER BY pm._order',
      [p.id]
    );
    const photos = mediaRes.rows;

    const amenRes = await db.query(
      'SELECT a.name, a.icon FROM properties_rels r JOIN amenities a ON a.id = r.amenities_id WHERE r.parent_id = $1 AND r.amenities_id IS NOT NULL ORDER BY r."order"',
      [p.id]
    );
    const rulesRes = await db.query(
      'SELECT h.name FROM properties_rels r JOIN house_rules h ON h.id = r.house_rules_id WHERE r.parent_id = $1 AND r.house_rules_id IS NOT NULL ORDER BY r."order"',
      [p.id]
    );

    let amenitiesHtml = '';
    if (amenRes.rows.length) {
      amenitiesHtml = '<section class="mb-8"><h2 class="text-xl font-bold mb-3">Amenities</h2><div class="grid grid-cols-2 md:grid-cols-3 gap-2">';
      for (const a of amenRes.rows) {
        amenitiesHtml += '<div class="flex items-center gap-2 text-slate-700"><span class="text-emerald-600">' + (a.icon ? esc(a.icon) : '&#10003;') + '</span> ' + esc(a.name) + '</div>';
      }
      amenitiesHtml += '</div></section>';
    }

    let rulesHtml = '';
    if (rulesRes.rows.length) {
      rulesHtml = '<section class="mb-8"><h2 class="text-xl font-bold mb-3">House rules</h2><ul class="space-y-1 text-slate-700">';
      for (const r of rulesRes.rows) {
        rulesHtml += '<li>&middot; ' + esc(r.name) + '</li>';
      }
      rulesHtml += '</ul></section>';
    }

    let detailsHtml = '';
    const details = [];
    if (p.size_m2) details.push(p.size_m2 + ' m²');
    if (p.bedrooms) details.push(p.bedrooms + ' bedroom' + (p.bedrooms > 1 ? 's' : ''));
    if (p.bathrooms) details.push(p.bathrooms + ' bathroom' + (p.bathrooms > 1 ? 's' : ''));
    if (p.max_guests) details.push('up to ' + p.max_guests + ' guests');
    if (details.length) {
      detailsHtml = '<div class="flex flex-wrap gap-3 mb-6 text-sm text-slate-600">' + details.map(d => '<span class="px-3 py-1 bg-slate-100 rounded-full">' + d + '</span>').join('') + '</div>';
    }

    let timesHtml = '';
    if (p.check_in_time || p.check_out_time) {
      timesHtml = '<div class="flex gap-6 mb-6 text-sm text-slate-600">'
        + (p.check_in_time ? '<div><span class="text-slate-400">Check-in</span> <b>' + esc(p.check_in_time) + '</b></div>' : '')
        + (p.check_out_time ? '<div><span class="text-slate-400">Check-out</span> <b>' + esc(p.check_out_time) + '</b></div>' : '')
        + '</div>';
    }

    let gallery = '';
    if (photos.length) {
      const first = photos[0];
      gallery = '<div class="mb-6"><img src="' + esc(first.url) + '" alt="' + esc(first.alt || p.title) + '" class="w-full rounded-2xl shadow-sm object-cover max-h-96"></div>';
      if (photos.length > 1) {
        gallery += '<div class="grid grid-cols-3 gap-2 mb-6">';
        for (let i = 1; i < photos.length; i++) {
          gallery += '<img src="' + esc(photos[i].url) + '" alt="' + esc(photos[i].alt || p.title) + '" class="w-full h-24 object-cover rounded-lg">';
        }
        gallery += '</div>';
      }
    }

    res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-slate-50 min-h-screen">
<div class="max-w-2xl mx-auto px-6 py-12">
  <a href="/" class="text-sm text-slate-500 hover:text-slate-800">&larr; Madeirabook</a>
  <div class="mt-4"></div>
  ${gallery}
  <h1 class="text-3xl font-black mt-4 mb-2">${esc(p.title)}</h1>
  ${p.price_per_night ? '<p class="text-slate-500 mb-4">' + priceEuro + ' &euro; / night' + (p.cleaning_fee ? ' &middot; cleaning ' + cleaning + ' &euro;' : '') + '</p>' : ''}
  <a href="/oasis/${esc(p.slug)}" class="inline-flex items-center gap-2 mb-6 px-5 py-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-cyan-100 border border-cyan-500/20 hover:border-cyan-400/50 transition-all shadow-lg">
    <span class="text-lg">&#9654;</span>
    <span class="text-sm font-medium">Listen to the sound of this place</span>
  </a>
  ${p.description ? '<p class="text-slate-700 leading-relaxed mb-6 whitespace-pre-line">' + esc(p.description) + '</p>' : '<div class="mb-6"></div>'}
  ${detailsHtml}
  ${timesHtml}
  ${amenitiesHtml}
  ${rulesHtml}

  ${calendarHtml}
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 class="text-lg font-bold mb-4">Book this property</h2>
    ${availabilityHtml}
    <form id="bookForm" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Arrival</label>
          <input type="date" name="arrivalDate" id="pArrival" required value="${esc(qArrival)}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Departure</label>
          <input type="date" name="departureDate" id="pDeparture" required value="${esc(qDeparture)}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <p id="availHint" class="text-xs text-slate-400">Enter both dates to see availability and total price</p>
      <div id="availBox" class="hidden rounded-lg text-sm px-4 py-3"></div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">First name</label>
          <input type="text" name="guestName" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Last name</label>
          <input type="text" name="lastName" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Email</label>
        <input type="email" name="guestEmail" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Phone</label>
        <input type="tel" name="phone" required placeholder="+351 900 000 000" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Country</label>
          <input type="text" name="country" required placeholder="Portugal" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Arrival time</label>
          <input type="time" name="arrivalTime" required value="15:00" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Street address</label>
        <input type="text" name="street" required placeholder="Rua da Praia 12" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Postal code</label>
          <input type="text" name="postalCode" required placeholder="9000-000" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">City</label>
          <input type="text" name="location" required placeholder="Funchal" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
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
var PROP_ID = ${p.id};
(function() {
  const arr = document.getElementById('pArrival');
  const dep = document.getElementById('pDeparture');
  const box = document.getElementById('availBox');
  const hint = document.getElementById('availHint');
  if (!arr || !dep || !box) return;
  let _t = null;
  async function check() {
    const a = arr.value, d = dep.value;
    if (!a || !d || a >= d) {
      box.classList.add('hidden');
      if (hint) hint.style.display = '';
      return;
    }
    if (hint) hint.style.display = 'none';
    box.className = 'rounded-lg text-sm px-4 py-3 bg-slate-50 text-slate-500';
    box.textContent = 'Checking availability...';
    box.classList.remove('hidden');
    try {
      const r = await fetch('/api/check-availability?propertyId=' + PROP_ID + '&arrival=' + a + '&departure=' + d);
      const j = await r.json();
      if (j.available) {
        box.className = 'rounded-lg text-sm px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800';
        const nightsLabel = j.nights + (j.nights === 1 ? ' night' : ' nights');
        let html = '&#10003; <strong>Available</strong>';
        html += '<div style="margin-top:8px;font-size:13px;color:#065f46;">';
        html += '<div style="display:flex;justify-content:space-between;gap:16px;"><span>' + j.rate + ' ' + j.currency + ' × ' + nightsLabel + '</span><span>' + (j.rate * j.nights) + ' ' + j.currency + '</span></div>';
        if (j.cleaning_fee > 0) {
          html += '<div style="display:flex;justify-content:space-between;gap:16px;"><span>Cleaning fee</span><span>' + j.cleaning_fee + ' ' + j.currency + '</span></div>';
        }
        html += '<div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid #6ee7b7;margin-top:6px;padding-top:6px;font-weight:800;font-size:14px;"><span>Total</span><span>' + j.total + ' ' + j.currency + '</span></div>';
        html += '</div>';
        box.innerHTML = html;
      } else {
        box.className = 'rounded-lg text-sm px-4 py-3 bg-red-50 border border-red-200 text-red-800';
        box.textContent = 'Not available for these dates';
      }
    } catch (e) {
      box.className = 'rounded-lg text-sm px-4 py-3 bg-amber-50 text-amber-700';
      box.textContent = 'Could not check availability';
    }
  }
  function deb() { if (_t) clearTimeout(_t); _t = setTimeout(check, 400); }
  arr.addEventListener('change', deb);
  dep.addEventListener('change', deb);
  if (arr.value && dep.value) check();
})();

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
    lastName: fd.get('lastName'),
    guestEmail: fd.get('guestEmail'),
    phone: fd.get('phone'),
    country: fd.get('country'),
    street: fd.get('street'),
    postalCode: fd.get('postalCode'),
    location: fd.get('location'),
    arrivalTime: fd.get('arrivalTime')
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



// === SEO: robots.txt & sitemap.xml ===

router.get('/robots.txt', (req, res) => {
  const base = (process.env.APP_URL || 'https://madeirabook-core.vercel.app').replace(/\/$/, '');
  const aiCrawlers = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'ClaudeBot',
    'Claude-Web',
    'anthropic-ai',
    'Google-Extended',
    'Applebot-Extended',
    'Bytespider',
    'CCBot',
    'Meta-ExternalAgent'
  ];

  let aiSection = '';
  for (const bot of aiCrawlers) {
    aiSection += 'User-agent: ' + bot + '\n'
      + 'Allow: /\n'
      + 'Disallow: /owner/\n'
      + 'Disallow: /admin\n'
      + 'Disallow: /api/\n'
      + 'Disallow: /webhook\n'
      + '\n';
  }

  res.type('text/plain').send(
    '# Standard crawlers (Google, Bing, etc.)\n'
    + 'User-agent: *\n'
    + 'Allow: /\n'
    + 'Disallow: /owner/\n'
    + 'Disallow: /admin\n'
    + 'Disallow: /api/\n'
    + 'Disallow: /webhook\n'
    + '\n'
    + '# AI crawlers — explicitly allowed for citation\n'
    + aiSection
    + 'Sitemap: ' + base + '/sitemap.xml\n'
  );
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const base = (process.env.APP_URL || 'https://madeirabook-core.vercel.app').replace(/\/$/, '');
    const r = await db.query("SELECT slug, updated_at FROM properties WHERE status = 'published' AND is_verified = true ORDER BY id DESC");
    const props = r.rows;

    let urls = '';
    urls += '  <url><loc>' + base + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
    for (const p of props) {
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : '';
      urls += '  <url><loc>' + base + '/p/' + encodeURIComponent(p.slug) + '</loc>'
        + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '')
        + '<changefreq>weekly</changefreq><priority>0.9</priority></url>\n';
    }
    urls += '  <url><loc>' + base + '/legal/cookie-policy</loc><priority>0.3</priority></url>\n';
    urls += '  <url><loc>' + base + '/legal/privacy-policy</loc><priority>0.3</priority></url>\n';
    urls += '  <url><loc>' + base + '/legal/terms-of-service</loc><priority>0.3</priority></url>\n';

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls
      + '</urlset>';

    res.type('application/xml').send(xml);
  } catch (e) {
    next(e);
  }
});


module.exports = router;
