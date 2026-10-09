const express = require('express');
const db = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

/**
 * GET /api/sounds/active?page=<path>
 * Возвращает звук для текущей страницы.
 * Логика приоритета:
 *   1. Звук по точному слагу (= категория + page)
 *   2. is_default = true
 */
router.get('/active', async (req, res, next) => {
  try {
    const page = String(req.query.page || '/').slice(0, 200);

    let row = null;

    // 1. Если это /gateway/:slug — берём audio_url из emotional_gateways
    const gw = page.match(/^\/gateway\/([a-z0-9-]+)/i);
    if (gw) {
      const slug = gw[1];
      const g = await db.query(
        "SELECT slug, title, audio_url FROM emotional_gateways WHERE slug = $1 AND status = 'published' LIMIT 1",
        [slug]
      );
      if (g.rows.length && g.rows[0].audio_url) {
        return res.json({
          ok: true,
          sound: {
            slug: g.rows[0].slug,
            title: g.rows[0].title,
            url: g.rows[0].audio_url,
            duration: null,
          },
        });
      }
    }

    // 2. Иначе — общий ambient (is_default)
    const r = await db.query(
      "SELECT slug, title, file_url, duration_sec FROM sounds WHERE is_default = true AND status = 'published' LIMIT 1"
    );
    if (r.rows.length) row = r.rows[0];

    if (!row) {
      return res.json({ ok: false, sound: null });
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      ok: true,
      sound: {
        slug: row.slug,
        title: row.title,
        url: row.file_url,
        duration: row.duration_sec,
      },
    });
  } catch (e) {
    logger.error({ err: e.message }, 'sounds/active failed');
    next(e);
  }
});

module.exports = router;
