const express = require('express');
const { css, hash } = require('../views/generated-styles');

const router = express.Router();

// Скомпилированный Tailwind отдаётся приложением: на Vercel статика из
// public/ в бандл функции не попадает, а этот модуль — обычный require.
router.get('/assets/site.' + hash + '.css', (req, res) => {
  res.type('text/css');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(css);
});

module.exports = router;
