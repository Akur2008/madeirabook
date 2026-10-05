const { Pool } = require('pg');
const config = require('../src/config');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err.message);
});

// Retry для случая, когда Neon усыпил соединение
async function queryWithRetry(text, params, retries = 2) {
  try {
    return await pool.query(text, params);
  } catch (e) {
    const isConnError = /Connection terminated|timeout|ECONNRESET|Client has encountered a connection error/i.test(e.message);
    if (retries > 0 && isConnError) {
      console.warn('DB connection error, retrying...', e.message);
      // Небольшая пауза перед retry
      await new Promise(r => setTimeout(r, 500));
      return queryWithRetry(text, params, retries - 1);
    }
    throw e;
  }
}

module.exports = {
  query: (text, params) => queryWithRetry(text, params),
  getClient: () => pool.connect(),
  pool,
};
