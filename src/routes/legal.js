const express = require('express');
const { renderPage } = require('../views/layout');
const legalContent = require('../content/legal');

const router = express.Router();

Object.keys(legalContent).forEach((slug) => {
  const page = legalContent[slug];
  router.get('/' + slug, (req, res) => {
    res.send(renderPage({
      title: page.title + ' — Madeirabook',
      description: page.description,
      path: '/legal/' + slug,
      body: '<h1>' + page.title + '</h1>'
        + '<p style="color:#64748b;">Last updated: ' + page.updated + '</p>'
        + page.body
    }));
  });
});

module.exports = router;
