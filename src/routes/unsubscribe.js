const express = require('express');
const db = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Madeirabook</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #0a1420; color: #e5e7eb; font-family: 'Cormorant Garamond', Georgia, serif; }
    .card { max-width: 480px; padding: 48px 32px; text-align: center; }
    h1 { font-weight: 500; font-size: 32px; margin: 0 0 16px; color: #f3f4f6; }
    p { font-size: 19px; line-height: 1.6; color: #9ca3af; margin: 0 0 24px; }
    a { color: #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://app.madeirabook.com">Back to Madeirabook</a></p>
  </div>
</body>
</html>`;
}

async function unsubscribeByToken(token) {
  const r = await db.query(
    'SELECT id, unsubscribed_at FROM subscribers WHERE unsubscribe_token = $1',
    [token]
  );
  if (!r.rows.length) return 'not_found';
  if (r.rows[0].unsubscribed_at) return 'already';
  await db.query('UPDATE subscribers SET unsubscribed_at = NOW() WHERE id = $1', [r.rows[0].id]);
  logger.info({ subscriberId: r.rows[0].id }, 'subscriber unsubscribed');
  return 'done';
}

async function handle(req, res) {
  try {
    const result = await unsubscribeByToken(req.params.token);
    if (result === 'not_found') {
      return res.status(404).send(page('Not found', 'This unsubscribe link is invalid or has expired.'));
    }
    if (result === 'already') {
      return res.send(page('Already unsubscribed', "You're already unsubscribed from Madeirabook emails."));
    }
    return res.send(page('Unsubscribed', "You've been unsubscribed from Madeirabook emails."));
  } catch (e) {
    logger.error({ err: e.message }, 'unsubscribe failed');
    return res.status(500).send(page('Error', 'Something went wrong. Please try again later.'));
  }
}

// GET — клик по ссылке в письме; POST — one-click для Gmail/Apple Mail (List-Unsubscribe-Post)
router.get('/:token', handle);
router.post('/:token', handle);

module.exports = router;
