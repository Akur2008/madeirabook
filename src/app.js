const express = require('express');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const config = require('./config');

// Middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Роуты
const adminRoutes = require('./routes/admin');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const pagesRoutes = require('./routes/pages');

const app = express();

// 1. Логирование запросов
app.use(pinoHttp({ logger }));

// 2. Webhook Stripe — ОБЯЗАТЕЛЬНО raw body!
// Этот роут должен идти ДО express.json(), иначе constructEvent не сможет проверить подпись.
app.use('/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

// 3. Парсинг JSON для всех остальных роутов
app.use(express.json());

// 4. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 5. Роуты
app.use('/admin', authMiddleware, adminRoutes); // админка под Basic Auth
app.use('/api', checkoutRoutes);                // API для создания брони
app.use('/', pagesRoutes);                      // страницы успеха/отмены

// 6. Обработчик ошибок — ВСЕГДА последний
app.use(errorHandler);

// Для Vercel Functions экспортируем app, а не запускаем listen
module.exports = app;
