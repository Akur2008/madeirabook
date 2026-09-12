const express = require('express');
const session = require('express-session');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ВАЖНО: raw body для Stripe webhook ДО json
app.use('/webhook', express.raw({ type: 'application/json' }));

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session для /owner
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, env: config.NODE_ENV, ts: new Date().toISOString() });
});

// ROUTES (подключаются в Шаге 3):
// app.use('/webhook', require('./routes/webhook'));
// app.use('/admin', require('./middleware/auth'), require('./routes/admin'));
// app.use('/owner', require('./routes/owner'));
// app.use('/', require('./routes/checkout'));
// app.use('/', require('./routes/pages'));

app.use(errorHandler);

const PORT = config.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT, env: config.NODE_ENV }, 'Madeirabook started');
  });
}

module.exports = app;
