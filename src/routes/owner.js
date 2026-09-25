const express = require('express');
const db = require('../../db/client');
const stripeSvc = require('../services/stripe');
const logger = require('../logger');

const router = express.Router();

// Публичный роут: владелец открывает постоянную ссылку → редирект на свежую Stripe-ссылку
router.get('/onboarding/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).send('Invalid onboarding link');
    }

    const ownerRes = await db.query(
      'SELECT id, email, stripe_account_id FROM owners WHERE onboarding_token = $1',
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

module.exports = router;
