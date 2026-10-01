const bot = require('../bot/bot');

async function sendMessage(chatId, text) {
  if (process.env.TELEGRAM_MOCK === 'true') {
    return { ok: true, mock: true };
  }
  return bot.api.sendMessage(chatId, text);
}

module.exports = { sendMessage: sendMessage };
