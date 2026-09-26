const express = require('express');
const pinoHttp = require('pino-http');
const session = require('express-session');
const config = require('./config');
const logger = require('./logger');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const adminRoutes = require('./routes/admin');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const subscribeRoutes = require('./routes/subscribe');
const telegramRoutes = require('./routes/telegram');
const ownerRoutes = require('./routes/owner');
const pagesRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const bookingsRoutes = require('./routes/bookings');

const app = express();

// 1. Логирование запросов
app.use(pinoHttp({ logger: logger }));

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

// 4. Session для /owner (пока не используется, но готов)
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
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
app.use('/webhook', webhookRoutes);
app.use('/webhook/stripe', webhookRoutes);
app.use('/webhook/telegram', telegramRoutes);
app.use('/owner', ownerRoutes);
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
