import Stripe from 'stripe';
import config from '../config.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // фиксируем версию API
});

/**
 * Создать Stripe Checkout Session для бронирования.
 * Используем Destination Charges + on_behalf_of.
 */
export async function createCheckoutSession({
  amountCents,
  platformFeeCents,
  stripeAccountId, // ID Express аккаунта владельца
  propertyId,
  bookingId,
  guestEmail,
  successUrl,
  cancelUrl,
}) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: guestEmail,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Бронирование #${bookingId}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      on_behalf_of: stripeAccountId, // MoR = владелец
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      propertyId: String(propertyId),
      bookingId: String(bookingId),
    },
  });
}

/**
 * Создать Express-аккаунт для владельца.
 */
export async function createExpressAccount(email) {
  return stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

/**
 * Сгенерировать ссылку для онбординга владельца в Stripe.
 */
export async function createAccountLink(accountId, refreshUrl, returnUrl) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export default stripe;
