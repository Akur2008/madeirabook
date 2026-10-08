/**
 * Разово кладёт письмо gateway_ocean_reactivation в очередь
 * для всех подписчиков старше 24 часов, у которых ещё нет такого письма.
 * Использование: node scripts/queue-reactivation.js
 * Cron отправит по 50/день — лимит Resend соблюдён.
 */
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Берём подписчиков, которым ещё НЕ ставили reactivation в очередь
  const r = await p.query(`
    SELECT s.id, s.email
    FROM subscribers s
    WHERE s.created_at < NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.subscriber_id = s.id
          AND eq.template = 'gateway_ocean_reactivation'
      )
    ORDER BY s.id
  `);

  console.log('Found subscribers for reactivation:', r.rows.length);

  if (!r.rows.length) {
    console.log('Nothing to queue.');
    process.exit(0);
  }

  let queued = 0;
  for (const sub of r.rows) {
    await p.query(
      "INSERT INTO email_queue (subscriber_id, template, send_at) VALUES ($1, 'gateway_ocean_reactivation', NOW() + INTERVAL '2 hours')",
      [sub.id]
    );
    queued++;
  }

  console.log('Queued:', queued, 'emails (send_at = NOW + 2h)');
  console.log('Cron will send max 50/day due to Resend free limit.');
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
