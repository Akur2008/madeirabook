const express = require('express');
const { webhookCallback } = require('grammy');
const bot = require('../bot/bot');

const router = express.Router();
const handler = webhookCallback(bot, 'express');

router.post('/', async (req, res) => {
  console.log('=== TELEGRAM WEBHOOK HIT ===');
  console.log('hasToken:', !!process.env.TELEGRAM_BOT_TOKEN);
  console.log('isInited:', bot.isInited());
  try {
    if (!bot.isInited()) {
      console.log('calling bot.init()...');
      await bot.init();
      console.log('bot inited ok');
    }
    await handler(req, res);
    console.log('handler done');
  } catch (err) {
    console.log('=== BOT ERROR ===', err.message, err.stack);
    res.status(200).json({ ok: true });
  }
});

router.get('/', (req, res) => {
  res.json({ ok: true, isInited: bot.isInited() });
});

module.exports = router;
