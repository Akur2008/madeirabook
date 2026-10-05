
const express = require('express');
const db = require('../../db/client');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT p.id, p.slug, p.title, p.price_per_night, p.cleaning_fee,
              (SELECT m.url FROM properties_media pm
               JOIN media m ON m.id = pm.image_id
               WHERE pm._parent_id = p.id ORDER BY pm._order LIMIT 1) AS cover
       FROM properties p
       WHERE p.status = 'published'
       ORDER BY p.featured DESC NULLS LAST, p.id DESC
       LIMIT 60`
    );
    const props = r.rows;

    let cards = '';
    for (const p of props) {
      const price = p.price_per_night ? Number(p.price_per_night).toFixed(0) : '—';
      const img = p.cover
        ? '<img src="' + esc(p.cover) + '" alt="' + esc(p.title) + '" class="w-full h-48 object-cover rounded-t-2xl">'
        : '<div class="w-full h-48 bg-slate-100 rounded-t-2xl flex items-center justify-center text-slate-400 text-sm">no photo</div>';
      cards += '<a href="/p/' + esc(p.slug) + '" class="block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">'
        + img
        + '<div class="p-4">'
        + '<h3 class="font-bold text-lg mb-1">' + esc(p.title) + '</h3>'
        + '<p class="text-slate-500 text-sm">' + price + ' EUR / night</p>'
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

  <h2 class="text-sm uppercase font-bold text-slate-500 mb-4">Available properties</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${cards || '<p class="text-slate-400">No properties yet</p>'}
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

    const mediaRes = await db.query(
      'SELECT m.url, m.alt FROM properties_media pm '
      + 'JOIN media m ON m.id = pm.image_id '
      + 'WHERE pm._parent_id = $1 ORDER BY pm._order',
      [p.id]
    );
    const photos = mediaRes.rows;

    const amenRes = await db.query(
      'SELECT name FROM properties_amenities_list WHERE _parent_id = $1 ORDER BY _order',
      [p.id]
    );
    const rulesRes = await db.query(
      'SELECT text FROM properties_house_rules WHERE _parent_id = $1 ORDER BY _order',
      [p.id]
    );

    let amenitiesHtml = '';
    if (amenRes.rows.length) {
      amenitiesHtml = '<section class="mb-8"><h2 class="text-xl font-bold mb-3">Amenities</h2><div class="grid grid-cols-2 md:grid-cols-3 gap-2">';
      for (const a of amenRes.rows) {
        amenitiesHtml += '<div class="flex items-center gap-2 text-slate-700"><span class="text-emerald-600">&#10003;</span> ' + esc(a.name) + '</div>';
      }
      amenitiesHtml += '</div></section>';
    }

    let rulesHtml = '';
    if (rulesRes.rows.length) {
      rulesHtml = '<section class="mb-8"><h2 class="text-xl font-bold mb-3">House rules</h2><ul class="space-y-1 text-slate-700">';
      for (const r of rulesRes.rows) {
        rulesHtml += '<li>&middot; ' + esc(r.text) + '</li>';
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
  <p class="text-slate-500 mb-4">${priceEuro} &euro; / night &middot; cleaning ${cleaning} &euro;</p>
  <a href="/oasis/${esc(p.slug)}" class="inline-flex items-center gap-2 mb-6 px-5 py-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-cyan-100 border border-cyan-500/20 hover:border-cyan-400/50 transition-all shadow-lg">
    <span class="text-lg">&#9654;</span>
    <span class="text-sm font-medium">Listen to the sound of this place</span>
  </a>
  ${p.description ? '<p class="text-slate-700 leading-relaxed mb-6 whitespace-pre-line">' + esc(p.description) + '</p>' : '<div class="mb-6"></div>'}
  ${detailsHtml}
  ${timesHtml}
  ${amenitiesHtml}
  ${rulesHtml}

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
    const r = await db.query("SELECT slug, updated_at FROM properties WHERE status = 'published' ORDER BY id DESC");
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
