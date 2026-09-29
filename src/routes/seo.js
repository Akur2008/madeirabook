const express = require('express');
const { buildRobotsTxt, buildSitemapXml } = require('../seo/generate');

const router = express.Router();

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(buildRobotsTxt());
});

router.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(buildSitemapXml());
});

module.exports = router;
