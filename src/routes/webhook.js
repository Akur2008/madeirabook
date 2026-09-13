const express = require('express');
const pool = require('../../db/client');
const stripe = require('../services/stripe');
const config = require('../config');
const logger = require('../logger');

const router = express.Router();

/**
 * POST /webhook
 * Обработка событий от Stripe с идемпотентностью.
 * ВАЖНО: в app.js для этого роута нужно будет использовать express.raw(),
 * иначе constructEvent не сможет проверить подпись.
 */
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // 1. Проверка подписи
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // здесь должен быть raw body (Buffer), не JSON
      sig,
      config.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error({ err }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
