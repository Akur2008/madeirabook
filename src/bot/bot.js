const { Bot, InlineKeyboard } = require('grammy');
const config = require('../config');
const logger = require('../logger');

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Главное меню с 3 кнопками
function mainMenu() {
  return new InlineKeyboard()
    .text('🏠 Book a stay', 'menu:stay')
    .row()
    .text('✈️ Find flights', 'menu:flights')
    .row()
    .text('🍷 Food · Wine · Guide', 'menu:food');
}

// Обработчик /start — с любым payload
bot.command('start', async (ctx) => {
  const payload = ctx.match || '';
  logger.info({ from: ctx.from.id, username: ctx.from.username, payload }, 'bot /start');

  let intro;
  if (payload === 'pdf_guide') {
    intro = 'Welcome to Madeirabook! 🌴\n\n' +
      'Thanks for subscribing — your PDF guide is already in your inbox.\n\n' +
      'What next? Choose below:';
  } else {
    intro = 'Welcome to Madeirabook! 🌴\n\n' +
      'The local community for Madeira. Direct bookings from local hosts, '
      + 'no platform fees.\n\n' +
      'What are you looking for?';
  }

  await ctx.reply(intro, { reply_markup: mainMenu() });
});

// /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    'Madeirabook — commands:\n\n' +
    '/start — main menu\n' +
    '/help — this help\n\n' +
    'Or just tap a button below 👇',
    { reply_markup: mainMenu() }
  );
});

// Кнопка: Book a stay
bot.callbackQuery('menu:stay', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '🏠 *Book a stay*\n\n' +
    'Ocean-view apartments from local hosts. No platform fees. Best price guaranteed.\n\n' +
    '−10% for returning guests.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('Browse apartments →', 'https://madeirabook.zeevou.direct')
    }
  );
});

// Кнопка: Find flights
bot.callbackQuery('menu:flights', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '✈️ *Find flights*\n\n' +
    'Live prices from any city to Funchal (FNC).\n\n' +
    'Low-cost from Lisbon €15, London €27, Paris €34.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('Search flights →', 'https://www.madeirabook.com/book-flights.html')
        .row()
        .url('Madeira tours', 'https://www.madeirabook.com/madeira-tours.html')
    }
  );
});

// Кнопка: Food · Wine · Guide
bot.callbackQuery('menu:food', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '🍷 *Food · Wine · Guide*\n\n' +
    '• 15+ restaurants with 30–50% off (TheFork)\n' +
    '• Traditional dishes: espetada, espada, poncha\n' +
    '• Madeira wine and rum\n\n' +
    'Check your email for the full PDF guide.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .url('Food guide →', 'https://www.madeirabook.com/madeira-food-guide.html')
        .row()
        .url('Where to eat →', 'https://www.madeirabook.com/where-to-eat-madeira.html')
        .row()
        .url('Madeira tours →', 'https://www.madeirabook.com/madeira-tours.html')
    }
  );
});

// Кнопка по умолчанию — открыть сайт (на будущее)
bot.on('message:text', async (ctx) => {
  await ctx.reply(
    'Sorry, I did not get that 🤔\n\nSend /start to open the menu.',
    { reply_markup: mainMenu() }
  );
});

bot.catch((err) => {
  logger.error({ err: err.message || err, update: err.ctx?.update }, 'bot error');
});

module.exports = bot;
