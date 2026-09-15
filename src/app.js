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
const pagesRoutes = require('./routes/pages');

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
