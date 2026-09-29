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
      body: '<p class="eyebrow">Legal</p>'
        + '<h1 class="page-title">' + page.title + '</h1>'
        + '<p class="lead">' + page.description + '</p>'
        + '<p class="meta">Last updated: ' + page.updated + '</p>'
        + '<div class="legal-body">' + page.body + '</div>'
    }));
  });
});

module.exports = router;
