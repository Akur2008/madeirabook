const express = require('express');
const router = express.Router();
const db = require('../../db/client');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cache = null; // { count, fetchedAt, updated_at }

/**
 * GET /api/stats/bookings-count
 * Returns: { count: number, period: '30_days', updated_at: ISO }
 */
router.get('/bookings-count', async function (req, res) {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({
        count: cache.count,
        period: '30_days',
        updated_at: cache.updated_at
      });
    }

    const result = await db.query(
      "SELECT COUNT(*) AS count FROM bookings " +
      "WHERE status = 'paid' " +
      "AND created_at > NOW() - INTERVAL '30 days'"
    );

    const count = parseInt(result.rows[0].count, 10);
    const updated_at = new Date().toISOString();
    cache = { count: count, fetchedAt: Date.now(), updated_at: updated_at };

    res.json({ count: count, period: '30_days', updated_at: updated_at });
  } catch (e) {
    console.error('stats/bookings-count error:', e.message);
    res.status(500).json({ error: 'database_unavailable' });
  }
});

module.exports = router;
