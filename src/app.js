const express = require('express');
const path = require('path');
const pinoHttp = require('pino-http');
const session = require('cookie-session');
const config = require('./config');
const logger = require('./logger');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const adminRoutes = require('./routes/admin');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const subscribeRoutes = require('./routes/subscribe');
const availabilityRoutes = require('./routes/availability');
const cronRoutes = require('./routes/cron');
const gatewayRoutes = require('./routes/gateways');
const telegramRoutes = require('./routes/telegram');
const ownerRoutes = require('./routes/owner');
const pagesRoutes = require('./routes/pages');
const oasisRoutes = require('./routes/oasis');
const guidesRoutes = require('./routes/guides');
const authRoutes = require('./routes/auth');
const bookingsRoutes = require('./routes/bookings');

const app = express();
app.set('trust proxy', 1);

// Google Search Console verification — inject meta tag into every HTML <head>
const GOOGLE_VERIFICATION_META = '<meta name="google-site-verification" content="wBnvYKjLFebuB-VZa2eMTy6IRRNzYs8x_oXgv0TkBO8" />';
app.use((req, res, next) => {
  const originalSend = res.send.bind(res);
  res.send = function (body) {
    if (typeof body === 'string' && body.indexOf('</head>') !== -1 && body.indexOf('google-site-verification') === -1) {
      body = body.replace('</head>', '  ' + GOOGLE_VERIFICATION_META + '\n</head>');
    }
    return originalSend(body);
  };
  next();
});

// 1. Логирование запросов
app.use(pinoHttp({
  logger: logger,
  redact: {
    paths: [
      'req.headers["x-telegram-init-data"]',
      'req.headers.authorization',
      'req.headers["stripe-signature"]'
    ],
    remove: true
  }
}));

// 2. Webhook Stripe — raw body ДО express.json()
app.use(
  '/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

// 3. Парсеры для остальных роутов

// CORS for public API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/tma', express.static(path.join(__dirname, '..', 'public', 'tma')));
app.use('/oasis-static', express.static(path.join(__dirname, '..', 'public', 'oasis')));

// 4. Session для /owner (cookie-session: подписанная кука, без серверного store)
app.use(session({
  name: 'mb.sid',
  keys: [config.SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  secure: config.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax'
}));

// 5. Health check
app.get('/health', function (req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 6. Роуты
app.use('/admin', authMiddleware, adminRoutes);
app.use('/api', checkoutRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/check-availability', availabilityRoutes);
app.use('/api/cron', cronRoutes);
app.use('/gateway', gatewayRoutes);
app.use('/webhook', webhookRoutes);
app.use('/webhook/stripe', webhookRoutes);
app.use('/webhook/telegram', telegramRoutes);
app.use('/owner', ownerRoutes);
app.use('/oasis', oasisRoutes);
app.use('/g', guidesRoutes);
app.use('/', pagesRoutes);

// 7. Обработчик ошибок — ВСЕГДА последний
app.use(errorHandler);

// 8. Запуск сервера локально
if (require.main === module) {
  const PORT = config.PORT || 3000;
  app.listen(PORT, function () {
    console.log('Madeirabook started on http://localhost:' + PORT);
  });
}

module.exports = app;
