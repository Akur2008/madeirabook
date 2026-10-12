const express = require('express');
const router = express.Router();
const db = require('../../db/client');
const pms = require('../services/pms/smoobu');
const logger = require('../logger');

const APARTMENT_IDS = [37726, 41255, 41254];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/search-availability (also mounted at /api/search)
 * Body: { arrivalDate: 'YYYY-MM-DD', departureDate: 'YYYY-MM-DD' }
 * Returns only available properties, sorted by price asc:
 *   [{ slug, name, price, currency, coverImage }]
 */
router.post('/', async function (req, res) {
  const arrivalDate = String((req.body && req.body.arrivalDate) || '').trim();
  const departureDate = String((req.body && req.body.departureDate) || '').trim();

  if (!DATE_RE.test(arrivalDate) || !DATE_RE.test(departureDate) || arrivalDate >= departureDate) {
    return res.status(400).json({ error: 'invalid_dates' });
  }

  let avail;
  try {
    avail = await pms.checkAvailability(APARTMENT_IDS, arrivalDate, departureDate);
  } catch (e) {
    logger.error({ err: e.message }, 'search-availability: smoobu failed');
    return res.status(500).json({ error: 'search_unavailable' });
  }

  try {
    const r = await db.query(
      'SELECT p.id, p.slug, p.title, p.smoobu_id, '
      + '(SELECT m.url FROM properties_media pm '
      + 'JOIN media m ON m.id = pm.image_id '
      + 'WHERE pm._parent_id = p.id ORDER BY pm._order LIMIT 1) AS cover '
      + 'FROM properties p '
      + "WHERE p.smoobu_id = ANY($1) AND p.status = 'published' AND p.is_verified = true",
      [APARTMENT_IDS.map(String)]
    );
    const byId = {};
    for (const row of r.rows) byId[String(row.smoobu_id)] = row;

    const items = [];
    for (const id of APARTMENT_IDS) {
      const entry = avail[id];
      const prop = byId[String(id)];
      if (!entry || !entry.available || !prop) continue;
      items.push({
        slug: prop.slug,
        name: prop.title,
        price: Number(entry.price),
        currency: entry.currency === '€' ? 'EUR' : (entry.currency || 'EUR'),
        coverImage: prop.cover || null
      });
    }
    items.sort(function (a, b) { return a.price - b.price; });

    res.json(items);
  } catch (e) {
    logger.error({ err: e.message }, 'search-availability failed');
    res.status(500).json({ error: 'search_unavailable' });
  }
});

module.exports = router;
