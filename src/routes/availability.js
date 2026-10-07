const express = require('express');
const db = require('../../db/client');
const pms = require('../services/pms/smoobu');
const logger = require('../logger');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res) => {
  try {
    const propertyId = parseInt(req.query.propertyId, 10);
    const arrival = (req.query.arrival || '').trim();
    const departure = (req.query.departure || '').trim();

    if (!propertyId) return res.status(400).json({ error: 'propertyId required' });
    if (!DATE_RE.test(arrival) || !DATE_RE.test(departure) || arrival >= departure) {
      return res.status(400).json({ error: 'invalid dates' });
    }

    const r = await db.query('SELECT smoobu_id, cleaning_fee FROM properties WHERE id = $1 LIMIT 1', [propertyId]);
    if (!r.rows.length || !r.rows[0].smoobu_id) {
      return res.status(404).json({ error: 'property not found or not connected to PMS' });
    }
    const smoobuId = Number(r.rows[0].smoobu_id);
    const cleaningFee = Number(r.rows[0].cleaning_fee) || 0;

    const av = await pms.checkAvailability([smoobuId], arrival, departure);
    const entry = av[smoobuId];
    if (!entry) {
      return res.json({ available: false, reason: 'no data' });
    }
    if (entry.available) {
      const nights = Math.round((new Date(departure) - new Date(arrival)) / 86400000);
      const total = Number(entry.price);
      const rate = nights > 0 ? Math.round((total - cleaningFee) / nights) : 0;
      return res.json({
        available: true,
        total: total,
        nights: nights,
        rate: rate,
        cleaning_fee: cleaningFee,
        currency: 'EUR',
      });
    }
    return res.json({ available: false, reason: entry.reason || null });
  } catch (e) {
    logger.error({ err: e.message }, 'check-availability failed');
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
