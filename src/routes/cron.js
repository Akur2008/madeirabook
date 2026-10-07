const express = require('express');
const { Resend } = require('resend');
const db = require('../../db/client');
const logger = require('../logger');
const { templates } = require('../emails/templates');

const router = express.Router();

// Защита: Vercel Cron добавляет заголовок authorization с CRON_SECRET
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return next(); // если не настроен — пропускаем (dev)
  const auth = req.headers['authorization'] || '';
  if (auth === 'Bearer ' + secret) return next();
  // Или query-параметр (для ручного теста)
  if (req.query.secret === secret) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

router.get('/send-emails', requireCronSecret, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'RESEND_API_KEY not set' });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    // Берём готовые письма и сразу помечаем как "в процессе" (атомарно)
    const pick = await db.query(
      `UPDATE email_queue SET sent_at = NOW()
       WHERE id IN (
         SELECT eq.id FROM email_queue eq
         WHERE eq.sent_at IS NULL AND eq.send_at <= NOW()
         ORDER BY eq.send_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, subscriber_id, template`,
      [limit]
    );

    const jobs = pick.rows;
    const results = { total: jobs.length, sent: 0, failed: 0, details: [] };

    for (const job of jobs) {
      try {
        const subRes = await db.query('SELECT email FROM subscribers WHERE id = $1', [job.subscriber_id]);
        if (!subRes.rows.length) {
          await db.query('UPDATE email_queue SET error = $1 WHERE id = $2', ['subscriber not found', job.id]);
          results.failed++;
          continue;
        }
        const email = subRes.rows[0].email;
        const tpl = templates[job.template];
        if (!tpl) {
          await db.query('UPDATE email_queue SET error = $1 WHERE id = $2', ['template not found: ' + job.template, job.id]);
          results.failed++;
          continue;
        }
        const { subject, html, text } = tpl(email);

        await resend.emails.send({
          from: 'Madeirabook <hello@madeirabook.com>',
          to: email,
          replyTo: 'akur2013@gmail.com',
          subject,
          html,
          text,
        });

        results.sent++;
        results.details.push({ id: job.id, template: job.template, ok: true });
      } catch (e) {
        await db.query('UPDATE email_queue SET error = $1 WHERE id = $2', [e.message, job.id]);
        results.failed++;
        results.details.push({ id: job.id, template: job.template, ok: false, error: e.message });
      }
    }

    const ms = Date.now() - startedAt;
    logger.info({ ...results, ms }, 'cron send-emails done');
    res.json({ ok: true, ...results, ms });
  } catch (e) {
    logger.error({ err: e.message }, 'cron send-emails failed');
    next(e);
  }
});

module.exports = router;
