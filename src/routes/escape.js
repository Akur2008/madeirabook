const express = require('express');
const router = express.Router();
const cityPrices = require('../data/city-prices.json');

const FALLBACK_KEY = 'lisbon';

/**
 * GET /api/escape-card (also mounted at /api/escape)
 * Geo-IP via Vercel headers; static price dictionary until Travelpayouts is wired.
 * Returns: { city, country, minPrice, currency, fallback }
 */
function escapeCardHandler(req, res) {
  const rawCity = req.headers['x-vercel-ip-city'] || '';
  const rawCountry = req.headers['x-vercel-ip-country'] || '';

  let city = String(rawCity);
  if (city.indexOf('%') !== -1) {
    try {
      city = decodeURIComponent(city);
    } catch (e) {
      // keep raw value if malformed
    }
  }

  const entry = cityPrices[city.trim().toLowerCase()];
  if (entry) {
    return res.json({
      city: entry.name,
      country: rawCountry,
      minPrice: entry.price,
      currency: entry.currency,
      fallback: false
    });
  }

  const fb = cityPrices[FALLBACK_KEY];
  res.json({
    city: fb.name,
    country: rawCountry,
    minPrice: fb.price,
    currency: fb.currency,
    fallback: true
  });
}

router.get('/', escapeCardHandler);
router.get('/card', escapeCardHandler);

module.exports = router;
