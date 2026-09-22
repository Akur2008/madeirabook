const { Bot } = require('grammy');
const config = require('../config');
const logger = require('../logger');

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

bot.command('start', async (ctx) => {
  logger.info({ from: ctx.from.id, username: ctx.from.username }, 'bot /start');
  await ctx.reply(
    'Добро пожаловать в Madeirabook! 🌴\n\n' +
    'Открой приложение, чтобы забронировать апартаменты на Мадейре:',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Открыть Madeirabook', web_app: { url: 'https://madeirabook.com' } }
        ]]
      }
    }
  );
});

bot.catch((err) => {
  logger.error({ err: err.message }, 'bot error');
});

module.exports = bot;
