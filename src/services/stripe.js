const Stripe = require('stripe');
const config = require('../config');

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

async function createExpressAccount(email) {
  return stripe.accounts.create({
    type: 'express',
    email: email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  });
}

async function createOnboardingLink(accountId, returnUrl, refreshUrl) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });
}

async function retrieveAccount(accountId) {
  return stripe.accounts.retrieve(accountId);
}

function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.STRIPE_WEBHOOK_SECRET
  );
}

async function createBookingCheckoutSession(opts) {
  var lineItems = [{
    price_data: {
      currency: 'eur',
      product_data: { name: opts.description },
      unit_amount: opts.amountCents
    },
    quantity: 1
  }];

  var paymentIntentData = {
    transfer_data: { destination: opts.stripeAccountId },
    on_behalf_of: opts.stripeAccountId,
    metadata: opts.metadata || {}
  };

  if (opts.platformFeeCents && opts.platformFeeCents > 0) {
    paymentIntentData.application_fee_amount = opts.platformFeeCents;
  }

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    customer_email: opts.guestEmail,
    payment_intent_data: paymentIntentData,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl
  });
}

module.exports = {
  stripe: stripe,
  createExpressAccount: createExpressAccount,
  createOnboardingLink: createOnboardingLink,
  retrieveAccount: retrieveAccount,
  constructWebhookEvent: constructWebhookEvent,
  createBookingCheckoutSession: createBookingCheckoutSession
};
