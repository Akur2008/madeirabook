const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const pms = require('../services/pms');
const logger = require('../logger');
const crypto = require('crypto');
const { Resend } = require('resend');
const { requireOwner } = require('../middleware/ownerAuth');
const multer = require('multer');
const { put, del } = require('@vercel/blob');

const router = express.Router();

// Публичный роут: владелец открывает постоянную ссылку → редирект на свежую Stripe-ссылку
router.get('/onboarding/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).send('Invalid onboarding link');
    }

    const ownerRes = await db.query(
      'SELECT id, email, stripe_account_id FROM users WHERE onboarding_token = $1',
      [token]
    );

    if (!ownerRes.rows.length) {
      return res.status(404).send('Onboarding link not found or expired');
    }

    const owner = ownerRes.rows[0];

    // Если владелец уже прошёл KYC — сразу на success-страницу
    const account = await stripeSvc.retrieveAccount(owner.stripe_account_id);
    if (account.charges_enabled && account.details_submitted) {
      return res.redirect(303, 'https://madeirabook.com/owner/onboarding-complete');
    }

    if (!owner.stripe_account_id) {
      return res.status(400).send('Stripe account not created yet. Contact support.');
    }

    // Генерируем свежую Stripe-ссылку (живёт 5 минут)
    const link = await stripeSvc.createOnboardingLink(
      owner.stripe_account_id,
      'https://madeirabook-core.vercel.app/owner/onboarding-complete',  // return
      'https://madeirabook-core.vercel.app/owner/onboarding/' + token   // refresh
    );

    logger.info({ ownerId: owner.id }, 'owner onboarding link generated');
    return res.redirect(303, link.url);
  } catch (e) {
    logger.error({ err: e.message, stack: e.stack }, 'owner onboarding error');
    next(e);
  }
});

// Куда Stripe возвращает после успешного KYC
router.get('/onboarding-complete', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Onboarding complete</title>
    <script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-white min-h-screen flex items-center justify-center px-6">
      <div class="max-w-md text-center">
        <div class="text-6xl mb-6">✅</div>
        <h1 class="text-3xl font-black mb-4">Onboarding complete</h1>
        <p class="text-slate-600 mb-6">Your Stripe account is set up. You can now receive payments directly from guests.</p>
        <p class="text-sm text-slate-500">Madeirabook — Local community for Madeira stays</p>
      </div>
    </body></html>
  `);
});


// === OWNER MAGIC LINK LOGIN ===

const TOKEN_TTL_MINUTES = 15;

function ownerEscapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function appBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return req.protocol + '://' + req.get('host');
}

router.get('/login', (req, res) => {
  const sent = req.query.sent === '1';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in — Madeirabook</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center px-6">
  <div class="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
    <h1 class="text-2xl font-black mb-2">Sign in to your owner cabinet</h1>
    <p class="text-slate-600 text-sm mb-6">Enter the email you signed up with. We will send you a one-time login link.</p>
    ${sent ? '<div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">If that email is in our system, a login link has been sent.</div>' : ''}
    <form method="POST" action="/owner/login" class="space-y-4">
      <input type="email" name="email" required placeholder="you@example.com" class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500">
      <button type="submit" class="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 transition-colors">Send login link</button>
    </form>
    <p class="text-xs text-slate-400 mt-6 text-center">Madeirabook — Local community for Madeira stays</p>
  </div>
</body></html>`);
});

router.post('/login', async (req, res, next) => {
  try {
    const email = ((req.body && req.body.email) || '').trim().toLowerCase();
    if (!email) return res.redirect(303, '/owner/login?sent=1');

    const userRes = await db.query(
      'SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    const user = userRes.rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

      await db.query(
        'UPDATE users SET login_token = $1, login_token_expires_at = $2 WHERE id = $3',
        [token, expiresAt, user.id]
      );

      if (process.env.RESEND_API_KEY) {
        const link = appBaseUrl(req) + '/owner/auth/' + token;
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Madeirabook <hello@madeirabook.com>',
            to: email,
            subject: 'Your Madeirabook login link',
            text: 'Sign in to your owner cabinet:\n\n' + link + '\n\nThis link expires in ' + TOKEN_TTL_MINUTES + ' minutes.',
            html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">'
              + '<h2 style="color: #064e3b;">Sign in to Madeirabook</h2>'
              + '<p>Click the button below to enter your owner cabinet. This link expires in ' + TOKEN_TTL_MINUTES + ' minutes.</p>'
              + '<p style="margin: 24px 0;"><a href="' + link + '" style="display: inline-block; padding: 14px 28px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Open owner cabinet</a></p>'
              + '<p style="color: #6b7280; font-size: 14px;">If you did not request this link, you can safely ignore this email.</p>'
              + '</div>',
          });
          logger.info({ ownerId: user.id }, 'owner magic link sent');
        } catch (mailErr) {
          logger.error({ err: mailErr.message, ownerId: user.id }, 'owner magic link send failed');
        }
      } else {
        logger.warn({ ownerId: user.id }, 'RESEND_API_KEY not set, owner magic link not sent');
      }
    } else {
      logger.info({ email: email }, 'owner magic link requested for unknown email');
    }

    return res.redirect(303, '/owner/login?sent=1');
  } catch (e) {
    next(e);
  }
});

router.get('/auth/:token', async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!token || token.length < 32) {
      return res.status(400).send('Invalid login link');
    }

    const r = await db.query(
      'SELECT id FROM users WHERE login_token = $1 AND login_token_expires_at > NOW() LIMIT 1',
      [token]
    );

    if (!r.rows.length) {
      return res.status(400).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Link expired</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center px-6">
<div class="max-w-md text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
  <div class="text-5xl mb-4">&#9203;</div>
  <h1 class="text-xl font-black mb-2">Link expired or invalid</h1>
  <p class="text-slate-600 text-sm mb-6">Login links are valid for ${TOKEN_TTL_MINUTES} minutes and can be used only once.</p>
  <a href="/owner/login" class="inline-block rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6">Request a new link</a>
</div></body></html>`);
    }

    const user = r.rows[0];
    await db.query(
      'UPDATE users SET login_token = NULL, login_token_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    req.session.ownerId = user.id;
    res.redirect(303, '/owner');
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect(303, '/owner/login');
});

function formatEuro(cents) {
  if (cents == null) return '—';
  return (Number(cents) / 100).toFixed(2) + ' \u20AC';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

router.get('/', requireOwner, async (req, res, next) => {
  try {
    const propsRes = await db.query(
      'SELECT id, smoobu_id, commission_percent, charges_enabled FROM properties WHERE owner_id = $1 ORDER BY id',
      [req.owner.id]
    );
    const props = propsRes.rows;

    const bookingsRes = await db.query(
      `SELECT b.id, b.arrival_date, b.departure_date, b.status,
              b.amount_cents, b.platform_fee_cents, b.guest_email,
              b.created_at, p.smoobu_id
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       WHERE p.owner_id = $1
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [req.owner.id]
    );
    const bookings = bookingsRes.rows;

    let totalPaidCents = 0;
    let totalFeeCents = 0;
    for (const b of bookings) {
      if (b.status === 'paid') {
        totalPaidCents += Number(b.amount_cents || 0);
        totalFeeCents += Number(b.platform_fee_cents || 0);
      }
    }
    const netCents = totalPaidCents - totalFeeCents;

    let propRows = '';
    for (const p of props) {
      propRows += '<tr class="border-t border-slate-200">'
        + '<td class="px-4 py-3 font-mono text-sm">' + ownerEscapeHtml(p.smoobu_id || '\u2014') + '</td>'
        + '<td class="px-4 py-3">' + ownerEscapeHtml(p.commission_percent || '\u2014') + '%</td>'
        + '<td class="px-4 py-3">' + (p.charges_enabled ? '<span class="text-emerald-600">&#9679;</span> Active' : '<span class="text-slate-400">&#9679;</span> Pending') + '</td>'
        + '<td class="px-4 py-3"><a href="/owner/properties/' + p.id + '/edit" class="text-sm text-emerald-700 hover:underline">Edit</a> &middot; <a href="/owner/properties/' + p.id + '/media" class="text-sm text-emerald-700 hover:underline">Photos</a></td>'
        + '</tr>';
    }

    let bookingRows = '';
    for (const b of bookings) {
      const badge = b.status === 'paid'
        ? '<span class="text-emerald-600">&#9679;</span> Paid'
        : (b.status === 'pending'
          ? '<span class="text-amber-500">&#9679;</span> Pending'
          : '<span class="text-slate-400">&#9679;</span> ' + ownerEscapeHtml(b.status || '\u2014'));
      bookingRows += '<tr class="border-t border-slate-200">'
        + '<td class="px-4 py-3 font-mono text-xs">' + ownerEscapeHtml(b.smoobu_id || '\u2014') + '</td>'
        + '<td class="px-4 py-3 text-sm">' + formatDate(b.arrival_date) + ' \u2192 ' + formatDate(b.departure_date) + '</td>'
        + '<td class="px-4 py-3 text-sm">' + ownerEscapeHtml(b.guest_email || '\u2014') + '</td>'
        + '<td class="px-4 py-3 text-sm">' + formatEuro(b.amount_cents) + '</td>'
        + '<td class="px-4 py-3 text-sm text-slate-500">' + formatEuro(b.platform_fee_cents) + '</td>'
        + '<td class="px-4 py-3 text-sm">' + badge + '</td>'
        + '</tr>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Owner cabinet \u2014 Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-5xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-black">Owner cabinet</h1>
      <p class="text-slate-500 text-sm">${ownerEscapeHtml(req.owner.email)}</p>
    </div>
    <div class="flex items-center gap-3">
      <a href="/owner/calendar" class="text-sm font-medium text-emerald-700 hover:text-emerald-900">📅 Calendar</a>
      <a href="/owner/properties/new" class="text-sm font-medium text-emerald-700 hover:text-emerald-900">+ Add property</a>
      <a href="/owner/connect-stripe" class="text-sm font-medium text-emerald-700 hover:text-emerald-900">Manage payouts</a>
      <form method="POST" action="/owner/logout">
        <button type="submit" class="text-sm text-slate-500 hover:text-slate-800">Sign out</button>
      </form>
    </div>
  </div>

  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <p class="text-xs uppercase text-slate-500 mb-1">Gross paid</p>
      <p class="text-2xl font-black">${formatEuro(totalPaidCents)}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <p class="text-xs uppercase text-slate-500 mb-1">Platform fee</p>
      <p class="text-2xl font-black text-slate-500">${formatEuro(totalFeeCents)}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <p class="text-xs uppercase text-slate-500 mb-1">Net to you</p>
      <p class="text-2xl font-black text-emerald-600">${formatEuro(netCents)}</p>
    </div>
  </div>

  <h2 class="text-sm uppercase font-bold text-slate-500 mb-2">Properties</h2>
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
    <table class="w-full text-left">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr><th class="px-4 py-3">Property</th><th class="px-4 py-3">Commission</th><th class="px-4 py-3">Status</th><th class="px-4 py-3"></th></tr>
      </thead>
      <tbody>
        ${propRows || '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400">No properties yet</td></tr>'}
      </tbody>
    </table>
  </div>

  <h2 class="text-sm uppercase font-bold text-slate-500 mb-2">Bookings (last 50)</h2>
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <table class="w-full text-left">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">Property</th>
          <th class="px-4 py-3">Dates</th>
          <th class="px-4 py-3">Guest</th>
          <th class="px-4 py-3">Amount</th>
          <th class="px-4 py-3">Fee</th>
          <th class="px-4 py-3">Status</th>
        </tr>
      </thead>
      <tbody>
        ${bookingRows || '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No bookings yet</td></tr>'}
      </tbody>
    </table>
  </div>
</div>
</body></html>`);
  } catch (e) {
    next(e);
  }
});



// Owner-initiated Stripe Connect onboarding


// === PROPERTY MEDIA ===

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 10 }
});

router.get('/properties/:id/media', requireOwner, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    if (!pid) return res.status(400).send('Invalid id');

    const propRes = await db.query(
      'SELECT id, title, slug FROM properties WHERE id = $1 AND owner_id = $2',
      [pid, req.owner.id]
    );
    if (!propRes.rows.length) return res.status(404).send('Property not found');
    const prop = propRes.rows[0];

    const mediaRes = await db.query(
      `SELECT m.id, m.url, m.filename, m.alt, pm._order
       FROM properties_media pm
       JOIN media m ON m.id = pm.image_id
       WHERE pm._parent_id = $1
       ORDER BY pm._order`,
      [pid]
    );

    let imgs = '';
    for (const m of mediaRes.rows) {
      imgs += '<div class="bg-white rounded-xl border border-slate-200 p-2">'
        + '<img src="' + ownerEscapeHtml(m.url) + '" class="w-full h-40 object-cover rounded-lg">'
        + '<p class="text-xs text-slate-500 mt-2 truncate">' + ownerEscapeHtml(m.filename || '') + '</p>'
        + '<form method="POST" action="/owner/properties/' + pid + '/media/' + m.id + '/delete" class="mt-2">'
        + '<button type="submit" class="text-xs text-red-600 hover:underline">Delete</button>'
        + '</form>'
        + '</div>';
    }

    const flash = req.query.uploaded === '1' ? '<div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">Photos uploaded.</div>' : '';
    const err = req.query.err ? '<div class="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">' + ownerEscapeHtml(req.query.err) + '</div>' : '';

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Photos — ${ownerEscapeHtml(prop.title)} — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-4xl mx-auto">
  <a href="/owner" class="text-sm text-slate-500 hover:text-slate-800">&larr; Owner cabinet</a>
  <h1 class="text-2xl font-black mt-4 mb-1">Photos</h1>
  <p class="text-slate-500 text-sm mb-6">${ownerEscapeHtml(prop.title)}</p>

  ${flash}${err}

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
    <form method="POST" action="/owner/properties/${pid}/media" enctype="multipart/form-data">
      <label class="block text-xs uppercase text-slate-500 mb-2">Add photos (max 10, up to 4 MB each)</label>
      <input type="file" name="photos" accept="image/*" multiple required class="block w-full text-sm mb-4">
      <button type="submit" class="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6">Upload</button>
    </form>
  </div>

  <h2 class="text-sm uppercase font-bold text-slate-500 mb-2">Current photos</h2>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
    ${imgs || '<p class="text-slate-400 text-sm col-span-full">No photos yet</p>'}
  </div>

  <div class="mt-8">
    <a href="/p/${ownerEscapeHtml(prop.slug)}" class="text-sm text-emerald-700 hover:underline">View public page &rarr;</a>
  </div>
</div>
</body></html>`);
  } catch (e) {
    next(e);
  }
});

router.post('/properties/:id/media', requireOwner, upload.array('photos', 10), async (req, res, next) => {
  const pid = parseInt(req.params.id, 10);
  try {
    if (!pid) return res.status(400).send('Invalid id');

    const propRes = await db.query(
      'SELECT id FROM properties WHERE id = $1 AND owner_id = $2',
      [pid, req.owner.id]
    );
    if (!propRes.rows.length) return res.status(404).send('Property not found');

    if (!req.files || !req.files.length) {
      return res.redirect(303, '/owner/properties/' + pid + '/media?err=No+files+received');
    }

    const maxOrderRes = await db.query(
      'SELECT COALESCE(MAX(_order), -1) AS m FROM properties_media WHERE _parent_id = $1',
      [pid]
    );
    let order = maxOrderRes.rows[0].m + 1;

    for (const f of req.files) {
      if (!f.mimetype || !f.mimetype.startsWith('image/')) continue;

      const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase();
      const safeName = 'properties/' + pid + '/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;

      const blob = await put(safeName, f.buffer, {
        access: 'public',
        contentType: f.mimetype,
        addRandomSuffix: false
      });

      const mediaIns = await db.query(
        'INSERT INTO media (alt, url, filename, mime_type, filesize) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [f.originalname, blob.url, f.originalname, f.mimetype, f.size]
      );
      const mediaId = mediaIns.rows[0].id;

      await db.query(
        'INSERT INTO properties_media (_order, _parent_id, id, image_id) VALUES ($1, $2, $3, $4)',
        [order++, pid, crypto.randomUUID(), mediaId]
      );
    }

    logger.info({ ownerId: req.owner.id, propertyId: pid, count: req.files.length }, 'property media uploaded');
    res.redirect(303, '/owner/properties/' + pid + '/media?uploaded=1');
  } catch (e) {
    logger.error({ err: e.message, propertyId: pid }, 'property media upload failed');
    res.redirect(303, '/owner/properties/' + pid + '/media?err=' + encodeURIComponent(e.message));
  }
});

router.post('/properties/:id/media/:mediaId/delete', requireOwner, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const mid = parseInt(req.params.mediaId, 10);
    if (!pid || !mid) return res.status(400).send('Invalid id');

    const own = await db.query(
      'SELECT id FROM properties WHERE id = $1 AND owner_id = $2',
      [pid, req.owner.id]
    );
    if (!own.rows.length) return res.status(404).send('Property not found');

    const m = await db.query('SELECT url FROM media WHERE id = $1', [mid]);
    if (m.rows.length && m.rows[0].url) {
      try {
        await del(m.rows[0].url);
      } catch (delErr) {
        logger.warn({ err: delErr.message }, 'blob delete failed (continuing)');
      }
    }

    await db.query('DELETE FROM properties_media WHERE _parent_id = $1 AND image_id = $2', [pid, mid]);
    await db.query('DELETE FROM media WHERE id = $1', [mid]);

    res.redirect(303, '/owner/properties/' + pid + '/media');
  } catch (e) {
    next(e);
  }
});


// === EDIT / DELETE PROPERTY ===

router.get('/properties/:id/edit', requireOwner, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    if (!pid) return res.status(400).send('Invalid id');

    const r = await db.query(
      'SELECT id, title, slug, description, short_description, size_m2, bedrooms, bathrooms, max_guests, check_in_time, check_out_time, price_per_night, cleaning_fee, smoobu_id, status FROM properties WHERE id = $1 AND owner_id = $2',
      [pid, req.owner.id]
    );
    if (!r.rows.length) return res.status(404).send('Property not found');
    const p = r.rows[0];

    const allAmenRes = await db.query('SELECT id, name, icon FROM amenities ORDER BY name');
    const selAmenRes = await db.query('SELECT amenities_id FROM properties_rels WHERE parent_id = $1 AND amenities_id IS NOT NULL', [pid]);
    const selectedAmenityIds = new Set(selAmenRes.rows.map(x => x.amenities_id));

    const allRulesRes = await db.query('SELECT id, name FROM house_rules ORDER BY name');
    const selRulesRes = await db.query('SELECT house_rules_id FROM properties_rels WHERE parent_id = $1 AND house_rules_id IS NOT NULL', [pid]);
    const selectedRuleIds = new Set(selRulesRes.rows.map(x => x.house_rules_id));

    const flash = req.query.saved === '1' ? '<div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">Saved.</div>' : '';
    const err = req.query.err ? '<div class="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">' + ownerEscapeHtml(req.query.err) + '</div>' : '';

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Edit — ${ownerEscapeHtml(p.title)} — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-2xl mx-auto">
  <a href="/owner" class="text-sm text-slate-500 hover:text-slate-800">&larr; Owner cabinet</a>
  <h1 class="text-2xl font-black mt-4 mb-1">Edit property</h1>
  <p class="text-slate-500 text-sm mb-6">Slug: <span class="font-mono">${ownerEscapeHtml(p.slug)}</span></p>

  ${flash}${err}

  <form method="POST" action="/owner/properties/${pid}/edit" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Title *</label>
      <input type="text" name="title" required maxlength="120" value="${ownerEscapeHtml(p.title)}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Description</label>
      <textarea name="description" rows="5" maxlength="4000" class="w-full rounded-lg border border-slate-300 px-3 py-2">${ownerEscapeHtml(p.description || '')}</textarea>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Short description (до 300 символов, для карточки)</label>
      <textarea name="shortDescription" rows="2" maxlength="300" class="w-full rounded-lg border border-slate-300 px-3 py-2">${ownerEscapeHtml(p.short_description || '')}</textarea>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Cleaning fee (EUR)</label>
      <input type="number" name="cleaningFee" min="0" step="1" value="${p.cleaning_fee != null ? Number(p.cleaning_fee) : 0}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <div class="grid grid-cols-4 gap-3">
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">m²</label>
        <input type="number" name="sizeM2" min="1" step="1" value="${p.size_m2 != null ? Number(p.size_m2) : ''}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Bedrooms</label>
        <input type="number" name="bedrooms" min="0" step="1" value="${p.bedrooms != null ? Number(p.bedrooms) : 1}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Bathrooms</label>
        <input type="number" name="bathrooms" min="0" step="1" value="${p.bathrooms != null ? Number(p.bathrooms) : 1}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Max guests</label>
        <input type="number" name="maxGuests" min="1" step="1" value="${p.max_guests != null ? Number(p.max_guests) : 2}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Check-in time</label>
        <input type="text" name="checkInTime" value="${ownerEscapeHtml(p.check_in_time || '15:00')}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Check-out time</label>
        <input type="text" name="checkOutTime" value="${ownerEscapeHtml(p.check_out_time || '11:00')}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-2">Amenities</label>
      <div class="grid grid-cols-2 gap-2">
        ${allAmenRes.rows.map(a => `
          <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
            <input type="checkbox" name="amenities" value="${a.id}" ${selectedAmenityIds.has(a.id) ? 'checked' : ''}>
            <span>${a.icon ? ownerEscapeHtml(a.icon) + ' ' : ''}${ownerEscapeHtml(a.name)}</span>
          </label>`).join('')}
      </div>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-2">House rules</label>
      <div class="grid grid-cols-2 gap-2">
        ${allRulesRes.rows.map(r => `
          <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
            <input type="checkbox" name="houseRules" value="${r.id}" ${selectedRuleIds.has(r.id) ? 'checked' : ''}>
            <span>${ownerEscapeHtml(r.name)}</span>
          </label>`).join('')}
      </div>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">PMS property ID (Smoobu ID, optional)</label>
      <input type="text" name="smoobuId" maxlength="80" value="${ownerEscapeHtml(p.smoobu_id || '')}" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Status</label>
      <select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        <option value="published" ${p.status === 'published' ? 'selected' : ''}>Published</option>
        <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option>
      </select>
    </div>
    <div class="flex items-center gap-3">
      <button type="submit" class="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6">Save</button>
      <a href="/owner/properties/${pid}/media" class="text-sm text-emerald-700 hover:underline">Manage photos</a>
      <a href="/p/${ownerEscapeHtml(p.slug)}" target="_blank" class="text-sm text-slate-500 hover:underline">View public page &rarr;</a>
    </div>
  </form>

  <form method="POST" action="/owner/properties/${pid}/delete" onsubmit="return confirm('Delete this property and all its photos? This cannot be undone.');" class="mt-6">
    <button type="submit" class="text-sm text-red-600 hover:underline">Delete property</button>
  </form>
</div>
</body></html>`);
  } catch (e) {
    next(e);
  }
});

router.post('/properties/:id/edit', requireOwner, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    if (!pid) return res.status(400).send('Invalid id');

    const own = await db.query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [pid, req.owner.id]);
    if (!own.rows.length) return res.status(404).send('Property not found');

    const title = ((req.body && req.body.title) || '').trim();
    const description = ((req.body && req.body.description) || '').trim() || null;
    const shortDescription = ((req.body && req.body.shortDescription) || '').trim().slice(0, 300) || null;
    const cleaning = parseFloat(req.body && req.body.cleaningFee) || 0;
    const smoobuId = ((req.body && req.body.smoobuId) || '').trim() || null;
    const status = req.body && req.body.status === 'draft' ? 'draft' : 'published';

    const sizeM2 = parseInt(req.body && req.body.sizeM2, 10) || null;
    const bedrooms = parseInt(req.body && req.body.bedrooms, 10) || 1;
    const bathrooms = parseInt(req.body && req.body.bathrooms, 10) || 1;
    const maxGuests = parseInt(req.body && req.body.maxGuests, 10) || 2;
    const checkInTime = ((req.body && req.body.checkInTime) || '15:00').trim().slice(0, 10);
    const checkOutTime = ((req.body && req.body.checkOutTime) || '11:00').trim().slice(0, 10);

    const amenitiesIds = [].concat(req.body && req.body.amenities || []).map(x => parseInt(x, 10)).filter(Number.isFinite);
    const houseRulesIds = [].concat(req.body && req.body.houseRules || []).map(x => parseInt(x, 10)).filter(Number.isFinite);

    if (!title) {
      return res.redirect(303, '/owner/properties/' + pid + '/edit?err=' + encodeURIComponent('Title is required'));
    }

    await db.query(
      'UPDATE properties SET title = $1, description = $2, short_description = $3, ' +
      'size_m2 = $4, bedrooms = $5, bathrooms = $6, max_guests = $7, ' +
      'check_in_time = $8, check_out_time = $9, ' +
      'cleaning_fee = $10, smoobu_id = $11, status = $12, ' +
      'updated_at = NOW() WHERE id = $13',
      [
        title, description, shortDescription,
        sizeM2, bedrooms, bathrooms, maxGuests,
        checkInTime, checkOutTime,
        cleaning, smoobuId, status,
        pid
      ]
    );

    // Пересохраняем amenities (relationship)
    await db.query('DELETE FROM properties_rels WHERE parent_id = $1 AND amenities_id IS NOT NULL', [pid]);
    for (let i = 0; i < amenitiesIds.length; i++) {
      await db.query(
        'INSERT INTO properties_rels ("order", parent_id, path, amenities_id) VALUES ($1, $2, $3, $4)',
        [i, pid, 'amenities', amenitiesIds[i]]
      );
    }

    // Пересохраняем house rules (relationship)
    await db.query('DELETE FROM properties_rels WHERE parent_id = $1 AND house_rules_id IS NOT NULL', [pid]);
    for (let i = 0; i < houseRulesIds.length; i++) {
      await db.query(
        'INSERT INTO properties_rels ("order", parent_id, path, house_rules_id) VALUES ($1, $2, $3, $4)',
        [i, pid, 'houseRules', houseRulesIds[i]]
      );
    }

    logger.info({ ownerId: req.owner.id, propertyId: pid }, 'property updated');
    res.redirect(303, '/owner/properties/' + pid + '/edit?saved=1');
  } catch (e) {
    next(e);
  }
});

router.post('/properties/:id/delete', requireOwner, async (req, res, next) => {
  try {
    const pid = parseInt(req.params.id, 10);
    if (!pid) return res.status(400).send('Invalid id');

    const own = await db.query('SELECT id FROM properties WHERE id = $1 AND owner_id = $2', [pid, req.owner.id]);
    if (!own.rows.length) return res.status(404).send('Property not found');

    // Удаляем blob-файлы
    const mediaRes = await db.query(
      'SELECT m.id, m.url FROM properties_media pm JOIN media m ON m.id = pm.image_id WHERE pm._parent_id = $1',
      [pid]
    );
    for (const m of mediaRes.rows) {
      if (m.url) {
        try { await del(m.url); } catch (e) { logger.warn({ err: e.message }, 'blob delete failed'); }
      }
    }
    await db.query('DELETE FROM media WHERE id IN (SELECT image_id FROM properties_media WHERE _parent_id = $1)', [pid]);
    await db.query('DELETE FROM properties_media WHERE _parent_id = $1', [pid]);
    await db.query('DELETE FROM properties_rels WHERE parent_id = $1', [pid]);
    await db.query('DELETE FROM properties_audio_tracks WHERE _parent_id = $1', [pid]);

    // Если есть брони — не удаляем объект, а прячем (draft)
    const bk = await db.query('SELECT COUNT(*) c FROM bookings WHERE property_id = $1', [pid]);
    if (parseInt(bk.rows[0].c, 10) > 0) {
      await db.query("UPDATE properties SET status = 'draft' WHERE id = $1", [pid]);
      logger.info({ propertyId: pid }, 'property has bookings, hidden as draft');
    } else {
      await db.query('DELETE FROM properties WHERE id = $1', [pid]);
      logger.info({ propertyId: pid }, 'property deleted');
    }

    res.redirect(303, '/owner');
  } catch (e) {
    next(e);
  }
});

// === ADD PROPERTY ===

function slugify(title) {
  return String(title).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

router.get('/properties/new', requireOwner, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Add property — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-2xl mx-auto">
  <a href="/owner" class="text-sm text-slate-500 hover:text-slate-800">&larr; Owner cabinet</a>
  <h1 class="text-2xl font-black mt-4 mb-6">Add a property</h1>
  <form method="POST" action="/owner/properties/new" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Title *</label>
      <input type="text" name="title" required maxlength="120" class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">Description</label>
      <textarea name="description" rows="5" maxlength="4000" class="w-full rounded-lg border border-slate-300 px-3 py-2"></textarea>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Price per night (EUR) *</label>
        <input type="number" name="pricePerNight" min="1" step="1" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Cleaning fee (EUR)</label>
        <input type="number" name="cleaningFee" min="0" step="1" value="0" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
    </div>
    <div>
      <label class="block text-xs uppercase text-slate-500 mb-1">PMS property ID (Smoobu ID, optional)</label>
      <input type="text" name="smoobuId" maxlength="80" class="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="например, 12345 или test-smoobu-1">
      <p class="text-xs text-slate-400 mt-1">Если не указать — объект появится, но бронирование будет недоступно до подключения PMS.</p>
    </div>
    <button type="submit" class="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3">Create property</button>
  </form>
</div>
</body></html>`);
});

router.post('/properties/new', requireOwner, async (req, res, next) => {
  try {
    const title = ((req.body && req.body.title) || '').trim();
    const description = ((req.body && req.body.description) || '').trim() || null;
    const price = parseFloat(req.body && req.body.pricePerNight);
    const cleaning = parseFloat(req.body && req.body.cleaningFee) || 0;
    const smoobuId = ((req.body && req.body.smoobuId) || '').trim() || null;

    if (!title || !isFinite(price) || price <= 0) {
      return res.status(400).send('Title and price are required');
    }

    let slug = slugify(title);
    if (!slug) slug = 'property';
    let attempt = 0;
    while (true) {
      const check = await db.query('SELECT 1 FROM properties WHERE slug = $1', [slug]);
      if (!check.rows.length) break;
      attempt++;
      slug = slugify(title) + '-' + attempt;
      if (attempt > 50) { slug = slugify(title) + '-' + Date.now(); break; }
    }

    await db.query(
      `INSERT INTO properties (title, slug, description, price_per_night, cleaning_fee, smoobu_id, owner_id, commission_percent, status, charges_enabled, brand)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 12, 'published', false, 'madeirabook')`,
      [title, slug, description, price, cleaning, smoobuId, req.owner.id]
    );

    const insRes = await db.query('SELECT id FROM properties WHERE slug = $1', [slug]);
    logger.info({ ownerId: req.owner.id, slug: slug }, 'property created');
    const newId = insRes.rows[0] ? insRes.rows[0].id : null;
    if (newId) {
      res.redirect(303, '/owner/properties/' + newId + '/media');
    } else {
      res.redirect(303, '/owner');
    }
  } catch (e) {
    next(e);
  }
});

router.get("/connect-stripe", requireOwner, async (req, res, next) => {
  try {
    let accountId = req.owner.stripe_account_id;
    if (!accountId) {
      const account = await stripeSvc.createExpressAccount(req.owner.email);
      accountId = account.id;
      await db.query("UPDATE users SET stripe_account_id = $1 WHERE id = $2", [accountId, req.owner.id]);
      logger.info({ ownerId: req.owner.id, accountId: accountId }, "stripe express account created");
    }

    const baseUrl = process.env.APP_URL || (req.protocol + "://" + req.get("host"));
    const link = await stripeSvc.createOnboardingLink(
      accountId,
      baseUrl + "/owner/onboarding-complete",
      baseUrl + "/owner/connect-stripe"
    );

    return res.redirect(303, link.url);
  } catch (e) {
    next(e);
  }
});


// === OWNER CALENDAR (read-only MVP) ===

// === OWNER CALENDAR (Smoobu + direct bookings) ===

function fmtDateKey(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}

router.get('/calendar', requireOwner, async (req, res, next) => {
  try {
    const propsRes = await db.query(
      'SELECT id, slug, title, smoobu_id, price_per_night FROM properties WHERE owner_id = $1 AND smoobu_id IS NOT NULL ORDER BY id',
      [req.owner.id]
    );
    const props = propsRes.rows;

    // Тянем брони из Smoobu за 18 месяцев (вперёд и назад)
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const to = new Date();
    to.setMonth(to.getMonth() + 12);
    const fromStr = fmtDateKey(from);
    const toStr = fmtDateKey(to);

    let smoobuBookings = [];
    let smoobuError = null;
    try {
      const r = await pms.getReservations(fromStr, toStr);
      smoobuBookings = (r.bookings || []).filter(b =>
        !b['is-blocked-booking'] &&
        b.type !== 'cancellation' &&
        b.status !== 'cancelled'
      );
    } catch (e) {
      smoobuError = e.message;
      logger.warn({ err: e.message }, 'smoobu getReservations failed');
    }

    // Тянем цены из Smoobu
    let rates = {};
    try {
      const smoobuIdList = props.map(p => Number(p.smoobu_id)).filter(Boolean);
      if (smoobuIdList.length) {
        const r = await pms.getRates(smoobuIdList, fromStr, toStr);
        rates = (r && r.data) ? r.data : {};
      }
    } catch (e) {
      logger.warn({ err: e.message }, 'smoobu getRates failed');
    }

    // Сопоставляем Smoobu bookings с нашими properties
    const smoobuIds = props.map(p => String(p.smoobu_id));
    const bookings = [];
    for (const b of smoobuBookings) {
      const aptId = String(b.apartment && b.apartment.id);
      if (!smoobuIds.includes(aptId)) continue;
      const prop = props.find(p => String(p.smoobu_id) === aptId);
      const channelName = (b.channel && b.channel.name) || 'Direct';
      let channelColor = '#10b981'; // default green (direct)
      if (/booking/i.test(channelName)) channelColor = '#1e40af';
      else if (/airbnb/i.test(channelName)) channelColor = '#ef4444';
      else if (/expedia/i.test(channelName)) channelColor = '#f59e0b';
      else if (/agoda/i.test(channelName)) channelColor = '#8b5cf6';

      bookings.push({
        id: b.id,
        propertyId: prop.id,
        propertyTitle: prop.title || prop.smoobu_id,
        arrival: b.arrival,
        departure: b.departure,
        guestName: b['guest-name'] || ((b.firstname || '') + ' ' + (b.lastname || '')).trim(),
        guestEmail: b.email || '',
        guestPhone: b.phone || '',
        price: b.price,
        channel: channelName,
        channelColor: channelColor,
        guests: (b.adults || 0) + (b.children || 0),
        checkIn: b['check-in'] || '',
        checkOut: b['check-out'] || ''
      });
    }

    const propsJson = JSON.stringify(props.map(p => ({
      id: p.id, title: p.title || ('Object ' + p.smoobu_id), basePrice: p.price_per_night, smoobuId: p.smoobu_id
    })));
    const bookingsJson = JSON.stringify(bookings);
    const ratesJson = JSON.stringify(rates);

    const apartmentsOptions = '<option value="all">All apartments</option>' + props.map(pr => '<option value="' + pr.smoobu_id + '">' + ownerEscapeHtml(pr.title || pr.smoobu_id) + '</option>').join('');

    const warn = smoobuError ? '<div class="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">Could not load Smoobu data: ' + ownerEscapeHtml(smoobuError) + '</div>' : '';

    res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Calendar — Madeirabook Owner</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  .cal-cell { min-width: 36px; height: 48px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; position: relative; cursor: pointer; }
  .cal-cell:hover { background: #f0f9ff; }
  .cal-cell.today { background: #ecfdf5; }
  .cal-cell.weekend { background: #f8fafc; }
  .cal-booking { position: absolute; left: 1px; right: 1px; top: 50%; transform: translateY(-50%); height: 12px; border-radius: 3px; cursor: pointer; }
  .cal-day-num { position: absolute; top: 1px; left: 3px; font-size: 10px; color: #94a3b8; font-weight: 500; }
</style>
</head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-[1400px] mx-auto">
  <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
    <div>
      <a href="/owner" class="text-sm text-slate-500 hover:text-slate-800">&larr; Owner cabinet</a>
      <h1 class="text-2xl font-black mt-2">Pricing calendar</h1>
      <p class="text-slate-500 text-sm">${ownerEscapeHtml(req.owner.email)} &middot; ${props.length} properties &middot; ${bookings.length} bookings</p>
    </div>
    <div class="flex items-center gap-2">
      <select id="monthSelect" class="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium"></select>
      <button onclick="shiftMonth(-1)" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">&larr;</button>
      <button onclick="shiftMonth(1)" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">&rarr;</button>
    </div>
  </div>

  ${warn}

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto">
    <div id="calWrap"></div>
  </div>

  <div class="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
    <span><span style="display:inline-block;width:12px;height:12px;background:#10b981;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Direct / Madeirabook</span>
    <span><span style="display:inline-block;width:12px;height:12px;background:#1e40af;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Booking.com</span>
    <span><span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Airbnb</span>
    <span><span style="display:inline-block;width:12px;height:12px;background:#f59e0b;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Expedia</span>
    <span><span style="display:inline-block;width:12px;height:12px;background:#8b5cf6;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Agoda</span>
  </div>
  <p class="text-xs text-slate-400 mt-2">Click any day to change prices.</p>
</div>

<button onclick="openBookingModal()" title="Add manual booking" style="position:fixed;bottom:32px;right:32px;width:64px;height:64px;border-radius:50%;background:#10b981;color:white;font-size:28px;font-weight:bold;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(16,185,129,.4);z-index:40;">+</button>

<div id="bookingModal" class="hidden fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-lg font-black">Add manual booking</h3>
      <button onclick="closeBookingModal()" class="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
    </div>
    <div class="space-y-3">
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Apartment</label>
        <select id="bmProperty" class="w-full rounded-lg border border-slate-300 px-3 py-2">
          ${props.map(pr => '<option value="' + pr.id + '">' + ownerEscapeHtml(pr.title || pr.smoobu_id) + '</option>').join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Arrival</label>
          <input type="date" id="bmArrival" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Departure</label>
          <input type="date" id="bmDeparture" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Guest name</label>
        <input type="text" id="bmName" placeholder="First Last" class="w-full rounded-lg border border-slate-300 px-3 py-2">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Email</label>
          <input type="email" id="bmEmail" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Phone</label>
          <input type="tel" id="bmPhone" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Adults</label>
          <input type="number" id="bmAdults" value="2" min="1" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Children</label>
          <input type="number" id="bmChildren" value="0" min="0" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-xs uppercase text-slate-500 mb-1">Price (€)</label>
          <input type="number" id="bmPrice" min="0" class="w-full rounded-lg border border-slate-300 px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-xs uppercase text-slate-500 mb-1">Notes (optional)</label>
        <textarea id="bmNotes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2"></textarea>
      </div>
      <p id="bmErr" class="hidden text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg"></p>
      <div class="flex gap-2 pt-2">
        <button onclick="closeBookingModal()" class="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
        <button id="bmSubmit" onclick="submitBooking()" class="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Create booking</button>
      </div>
    </div>
  </div>
</div>

<div id="bkPopup" class="hidden fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-lg font-black">Booking details</h3>
      <button onclick="closePopup()" class="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
    </div>
    <div id="bkBody" class="space-y-2 text-sm"></div>
  </div>
</div>

<script>
const PROPS = ${propsJson};
const BOOKINGS = ${bookingsJson};
const RATES = ${ratesJson};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let currentDate = new Date();
currentDate.setDate(1);

function fmtDate(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}

function initMonthSelect() {
  const sel = document.getElementById('monthSelect');
  const now = new Date();
  let opts = '';
  for (let i = -6; i <= 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const label = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    opts += '<option value="' + val + '">' + label + '</option>';
  }
  sel.innerHTML = opts;
  const cur = currentDate.getFullYear() + '-' + String(currentDate.getMonth()+1).padStart(2,'0');
  sel.value = cur;
  sel.addEventListener('change', () => {
    const [y, m] = sel.value.split('-').map(Number);
    currentDate = new Date(y, m - 1, 1);
    render();
  });
}

function shiftMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  const cur = currentDate.getFullYear() + '-' + String(currentDate.getMonth()+1).padStart(2,'0');
  document.getElementById('monthSelect').value = cur;
  render();
}

function render() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '<table style="border-collapse:collapse;width:100%;"><thead><tr>';
  html += '<th style="text-align:left;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;left:0;z-index:2;font-size:11px;color:#64748b;font-weight:600;min-width:200px;">Property</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const wd = dt.getDay();
    const isWeekend = wd === 0 || wd === 6;
    const wdShort = ['Su','Mo','Tu','We','Th','Fr','Sa'][wd];
    html += '<th style="padding:4px 2px;background:' + (isWeekend ? '#f1f5f9' : '#f8fafc') + ';border-bottom:1px solid #e2e8f0;font-size:10px;color:#94a3b8;font-weight:500;">' + wdShort + '<br>' + d + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (const prop of PROPS) {
    html += '<tr>';
    html += '<td style="padding:10px 12px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;left:0;z-index:1;font-weight:600;font-size:13px;white-space:nowrap;">' + prop.title + '</td>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const dtStr = fmtDate(dt);
      const isToday = dt.getTime() === today.getTime();
      const wd = dt.getDay();
      const isWeekend = wd === 0 || wd === 6;
      let cls = 'cal-cell';
      if (isToday) cls += ' today';
      else if (isWeekend) cls += ' weekend';

      const bk = BOOKINGS.find(b => {
        if (b.propertyId !== prop.id) return false;
        return dtStr >= b.arrival && dtStr < b.departure;
      });

      const rateForDay = (RATES[String(prop.smoobuId)] || {})[dtStr];
      html += '<td class="' + cls + '" onclick="dayClick(\\'' + dtStr + '\\', ' + prop.id + ')">';
      html += '<span class="cal-day-num">' + d + '</span>';
      if (rateForDay && rateForDay.price != null) {
        if (rateForDay.min_length_of_stay) {
          html += '<span style="position:absolute;bottom:14px;left:2px;font-size:9px;color:#94a3b8;">' + rateForDay.min_length_of_stay + '</span>';
        }
        html += '<span style="position:absolute;bottom:1px;right:3px;font-size:10px;color:#0f172a;font-weight:600;">' + Math.round(rateForDay.price) + '</span>';
      }
      if (bk) {
        html += '<div class="cal-booking" style="background:' + bk.channelColor + '" onclick="event.stopPropagation();showBooking(' + bk.id + ')" title="' + bk.channel + ': ' + bk.guestName + '"></div>';
      }
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('calWrap').innerHTML = html;
}

function dayClick(dateStr, propId) {
  // Заглушка — потом тут будет редактирование цены
}

function showBooking(id) {
  const bk = BOOKINGS.find(b => b.id === id);
  if (!bk) return;
  document.getElementById('bkBody').innerHTML =
    '<p><b>Property:</b> ' + bk.propertyTitle + '</p>' +
    '<p><b>Channel:</b> <span style="color:' + bk.channelColor + ';font-weight:700;">' + bk.channel + '</span></p>' +
    '<p><b>Guest:</b> ' + (bk.guestName || '—') + '</p>' +
    (bk.guestEmail ? '<p><b>Email:</b> ' + bk.guestEmail + '</p>' : '') +
    (bk.guestPhone ? '<p><b>Phone:</b> ' + bk.guestPhone + '</p>' : '') +
    '<p><b>Arrival:</b> ' + bk.arrival + (bk.checkIn ? ' at ' + bk.checkIn : '') + '</p>' +
    '<p><b>Departure:</b> ' + bk.departure + (bk.checkOut ? ' at ' + bk.checkOut : '') + '</p>' +
    '<p><b>Guests:</b> ' + bk.guests + '</p>' +
    '<p><b>Total:</b> €' + (bk.price || 0).toFixed(2) + '</p>' +
    '<p><b>Smoobu ID:</b> ' + bk.id + '</p>' +
    '<div class="pt-3 flex gap-2">' +
    '<button onclick="cancelBooking(' + bk.id + ')" class="flex-1 px-4 py-2 rounded-lg border border-red-300 text-red-600 font-bold hover:bg-red-50">Cancel booking</button>' +
    '</div>' +
    '<p id="bkCancelErr" class="hidden text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2"></p>';
  document.getElementById('bkPopup').classList.remove('hidden');
}

async function cancelBooking(id) {
  if (!confirm('Cancel booking #' + id + '? Это действие отменит бронь в Smoobu.')) return;
  const err = document.getElementById('bkCancelErr');
  err.classList.add('hidden');
  try {
    const r = await fetch('/owner/bookings/' + id + '/cancel', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Failed');
    location.reload();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function closePopup() {
  document.getElementById('bkPopup').classList.add('hidden');
}

document.getElementById('bkPopup').addEventListener('click', e => {
  if (e.target.id === 'bkPopup') closePopup();
});

// === RATES EDIT MODAL ===
function openRatesModal(dateStr, propId) {
  const prop = PROPS.find(p => p.id === propId);
  if (!prop) return;
  document.getElementById('rmFirstDay').value = dateStr;
  document.getElementById('rmLastDay').value = dateStr;
  document.getElementById('rmPrice').value = '';
  document.getElementById('rmMinNights').value = '';
  document.getElementById('rmApartments').value = String(prop.smoobuId);
  document.getElementById('rmErr').classList.add('hidden');
  document.getElementById('rmSuccess').classList.add('hidden');
  // Сбрасываем чекбоксы дней на все
  document.querySelectorAll('.rm-day').forEach(cb => cb.checked = true);
  document.getElementById('ratesModal').classList.remove('hidden');
}

function closeRatesModal() {
  document.getElementById('ratesModal').classList.add('hidden');
}

async function submitRates() {
  const firstDay = document.getElementById('rmFirstDay').value;
  const lastDay = document.getElementById('rmLastDay').value;
  const price = document.getElementById('rmPrice').value;
  const minNights = document.getElementById('rmMinNights').value;
  const apartments = document.getElementById('rmApartments').value;
  const err = document.getElementById('rmErr');
  const success = document.getElementById('rmSuccess');
  const btn = document.getElementById('rmSubmit');

  err.classList.add('hidden');
  success.classList.add('hidden');

  if (!firstDay || !lastDay || !price) {
    err.textContent = 'Заполните First day, Last day и Price';
    err.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const r = await fetch('/owner/rates/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstDay, lastDay, price, minNights, apartments })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      throw new Error(data.error || 'Save failed');
    }
    success.textContent = 'Обновлено объектов: ' + data.updated + '. Перезагрузка...';
    success.classList.remove('hidden');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

document.addEventListener('click', e => {
  if (e.target && e.target.id === 'ratesModal') closeRatesModal();
});

// Повесим openRatesModal на dayClick
function dayClick(dateStr, propId) {
  openRatesModal(dateStr, propId);
}

function openBookingModal() {
  document.getElementById('bookingModal').classList.remove('hidden');
}
function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
  document.getElementById('bmErr').classList.add('hidden');
}
async function submitBooking() {
  const err = document.getElementById('bmErr');
  const btn = document.getElementById('bmSubmit');
  err.classList.add('hidden');

  const body = {
    propertyId: Number(document.getElementById('bmProperty').value),
    arrivalDate: document.getElementById('bmArrival').value,
    departureDate: document.getElementById('bmDeparture').value,
    name: document.getElementById('bmName').value,
    email: document.getElementById('bmEmail').value,
    phone: document.getElementById('bmPhone').value,
    adults: document.getElementById('bmAdults').value,
    children: document.getElementById('bmChildren').value,
    price: document.getElementById('bmPrice').value,
    notes: document.getElementById('bmNotes').value
  };
  if (!body.propertyId || !body.arrivalDate || !body.departureDate || !body.name) {
    err.textContent = 'Заполните Apartment, Arrival, Departure, Guest name';
    err.classList.remove('hidden'); return;
  }
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    const r = await fetch('/owner/bookings/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Failed');
    location.reload();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Create booking';
  }
}

initMonthSelect();
render();
</script>

<!-- Rates Edit Modal -->
<div id="ratesModal" class="hidden fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
    <div class="flex justify-between items-start mb-4">
      <div><h3 class="text-lg font-black">Change rates</h3><p class="text-xs text-slate-500 mt-1">Set price and min nights for a date range</p></div>
      <button onclick="closeRatesModal()" class="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
    </div>

    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">First day</label>
          <input type="date" id="rmFirstDay" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Last day</label>
          <input type="date" id="rmLastDay" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Price (€)</label>
          <input type="number" id="rmPrice" min="1" step="1" placeholder="120" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Min nights (опц.)</label>
          <input type="number" id="rmMinNights" min="1" step="1" placeholder="—" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Apartment</label>
        <select id="rmApartments" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
          ${apartmentsOptions}
        </select>
      </div>

      <p id="rmErr" class="hidden text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg"></p>
      <p id="rmSuccess" class="hidden text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg"></p>

      <div class="flex gap-2 pt-2">
        <button onclick="closeRatesModal()" class="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
        <button id="rmSubmit" onclick="submitRates()" class="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Save</button>
      </div>
    </div>
  </div>
</div>
</body></html>`);
  } catch (e) {
    next(e);
  }
});


// === SET RATES (write to Smoobu) ===

router.post('/rates/set', requireOwner, async (req, res, next) => {
  try {
    const { firstDay, lastDay, price, minNights, daysOfWeek, apartments } = req.body;

    if (!firstDay || !lastDay || price == null) {
      return res.status(400).json({ error: 'firstDay, lastDay, price обязательны' });
    }

    const priceNum = parseFloat(price);
    if (!isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Цена должна быть больше 0' });
    }

    const minNightsNum = minNights ? parseInt(minNights, 10) : null;

    // Владелец может менять только свои объекты
    const propsRes = await db.query(
      'SELECT id, smoobu_id FROM properties WHERE owner_id = $1 AND smoobu_id IS NOT NULL',
      [req.owner.id]
    );
    const ownerProps = propsRes.rows;
    const ownerSmoobuIds = ownerProps.map(p => Number(p.smoobu_id));

    if (!ownerSmoobuIds.length) {
      return res.status(400).json({ error: 'У вас нет объектов с Smoobu ID' });
    }

    // Какие объекты менять
    let targetIds = ownerSmoobuIds;
    if (apartments && apartments !== 'all') {
      const requested = Array.isArray(apartments) ? apartments : [apartments];
      targetIds = requested.map(Number).filter(id => ownerSmoobuIds.includes(id));
    }
    if (!targetIds.length) {
      return res.status(400).json({ error: 'Не выбрано ни одного объекта' });
    }

    // Генерируем список дат
    const start = new Date(firstDay + 'T00:00:00Z');
    const end = new Date(lastDay + 'T00:00:00Z');
    if (isNaN(start) || isNaN(end) || end < start) {
      return res.status(400).json({ error: 'Неверный диапазон дат' });
    }
    if ((end - start) / 86400000 > 730) {
      return res.status(400).json({ error: 'Диапазон не может превышать 2 года' });
    }

    // Smoobu Post Rates Api принимает диапазон (arrivalDate/departureDate).
    // daysOfWeek пока не поддерживается API — игнорируем, если пришёл.

    // Отправляем в Smoobu (по одному объекту — API не принимает массив)
    const results = [];
    for (const aptId of targetIds) {
      try {
        await pms.setRates([aptId], firstDay, lastDay, priceNum, minNightsNum);
        results.push({ apartment: aptId, ok: true });
      } catch (e) {
        logger.error({ err: e.message, aptId }, 'setRates failed for apartment');
        results.push({ apartment: aptId, ok: false, error: e.message });
      }
      await new Promise(r => setTimeout(r, 250));
    }

    const okCount = results.filter(r => r.ok).length;
    logger.info(
      { ownerId: req.owner.id, apartments: targetIds, ok: okCount },
      'rates updated'
    );

    res.json({
      ok: okCount > 0,
      updated: okCount,
      total: targetIds.length,
      apartments: results
    });
  } catch (e) {
    next(e);
  }
});

router.post('/bookings/manual', requireOwner, async (req, res, next) => {
  try {
    const { propertyId, arrivalDate, departureDate, name, email, phone, adults, children, price, notes } = req.body;

    if (!propertyId || !arrivalDate || !departureDate || !name) {
      return res.status(400).json({ error: 'propertyId, arrivalDate, departureDate, name обязательны' });
    }

    const propRes = await db.query(
      'SELECT id, smoobu_id FROM properties WHERE id = $1 AND owner_id = $2',
      [propertyId, req.owner.id]
    );
    if (!propRes.rows.length || !propRes.rows[0].smoobu_id) {
      return res.status(404).json({ error: 'Объект не найден или не подключён к Smoobu' });
    }
    const smoobuId = Number(propRes.rows[0].smoobu_id);

    const nameParts = String(name).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Guest';
    const lastName = nameParts.slice(1).join(' ') || '-';

    const bookingId = await pms.createReservation({
      propertyId: smoobuId,
      arrivalDate,
      departureDate,
      guestName: firstName,
      lastName: lastName,
      guestEmail: email || '',
      phone: phone || '-',
      country: 'PT',
      arrivalTime: '15:00',
      adults: Number(adults) || 2,
      children: Number(children) || 0,
      notes: notes || ''
    });

    logger.info({ ownerId: req.owner.id, propertyId, smoobuBookingId: bookingId }, 'manual booking created');
    res.json({ ok: true, smoobuId: bookingId });
  } catch (e) {
    logger.error({ err: e.message }, 'manual booking failed');
    res.status(500).json({ error: e.message });
  }
});

router.post('/bookings/:id/cancel', requireOwner, async (req, res, next) => {
  try {
    const smoobuId = Number(req.params.id);
    if (!smoobuId) return res.status(400).json({ error: 'Invalid booking id' });

    // Проверим, что эта бронь принадлежит объекту владельца
    const ownRes = await db.query(
      'SELECT p.smoobu_id FROM properties p WHERE p.owner_id = $1 AND p.smoobu_id IS NOT NULL',
      [req.owner.id]
    );
    const ids = ownRes.rows.map(r => Number(r.smoobu_id));
    if (!ids.length) return res.status(400).json({ error: 'У вас нет объектов' });

    // Запросим бронь из Smoobu, проверим принадлежность
    const from = new Date(); from.setMonth(from.getMonth() - 6);
    const to = new Date(); to.setMonth(to.getMonth() + 18);
    const fmt = d => d.toISOString().slice(0, 10);
    const all = await pms.getReservations(fmt(from), fmt(to), null, 100);
    const bk = (all.bookings || []).find(b => Number(b.id) === smoobuId);
    if (!bk) return res.status(404).json({ error: 'Booking not found in Smoobu' });
    const aptId = Number(bk.apartment && bk.apartment.id);
    if (!ids.includes(aptId)) return res.status(403).json({ error: 'Not your booking' });

    await pms.cancelReservation(smoobuId);
    logger.info({ ownerId: req.owner.id, smoobuId }, 'booking cancelled');
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e.message }, 'cancel booking failed');
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
