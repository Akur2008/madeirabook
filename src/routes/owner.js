const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
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
        + '<td class="px-4 py-3"><a href="/owner/properties/' + p.id + '/media" class="text-sm text-emerald-700 hover:underline">Photos</a></td>'
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

module.exports = router;
