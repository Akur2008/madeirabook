const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const logger = require('../logger');
const crypto = require('crypto');
const { Resend } = require('resend');
const { requireOwner } = require('../middleware/ownerAuth');

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

router.get('/', requireOwner, async (req, res, next) => {
  try {
    const propsRes = await db.query(
      'SELECT id, smoobu_id, commission_percent, charges_enabled FROM properties WHERE owner_id = $1 ORDER BY id',
      [req.owner.id]
    );
    const props = propsRes.rows;

    let rows = '';
    for (const p of props) {
      rows += '<tr class="border-t border-slate-200">'
        + '<td class="px-4 py-3 font-mono text-sm">' + ownerEscapeHtml(p.smoobu_id || '—') + '</td>'
        + '<td class="px-4 py-3">' + ownerEscapeHtml(p.commission_percent || '—') + '%</td>'
        + '<td class="px-4 py-3">' + (p.charges_enabled ? '<span class="text-emerald-600">&#9679;</span> Active' : '<span class="text-slate-400">&#9679;</span> Pending') + '</td>'
        + '</tr>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Owner cabinet — Madeirabook</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen p-6">
<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-black">Owner cabinet</h1>
      <p class="text-slate-500 text-sm">${ownerEscapeHtml(req.owner.email)}</p>
    </div>
    <div class="flex items-center gap-3">
      <a href="/owner/connect-stripe" class="text-sm font-medium text-emerald-700 hover:text-emerald-900">Manage payouts</a>
      <form method="POST" action="/owner/logout">
        <button type="submit" class="text-sm text-slate-500 hover:text-slate-800">Sign out</button>
      </form>
    </div>
  </div>
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <table class="w-full text-left">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr><th class="px-4 py-3">Property</th><th class="px-4 py-3">Commission</th><th class="px-4 py-3">Status</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="3" class="px-4 py-8 text-center text-slate-400">No properties yet</td></tr>'}
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
