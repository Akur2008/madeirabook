const express = require('express');
const { renderPage } = require('../views/layout');
const { legalPage, legalSlugs } = require('../content/legal');
const { t } = require('../i18n');

const router = express.Router();

legalSlugs().forEach((slug) => {
  router.get('/' + slug, (req, res) => {
    const page = legalPage(slug, req.locale);

    res.send(renderPage({
      locale: req.locale,
      title: page.title + ' — Madeirabook',
      description: page.description,
      path: '/legal/' + slug,
      body: '<p class="eyebrow">' + t(req.locale, 'legal.eyebrow') + '</p>'
        + '<h1 class="page-title">' + page.title + '</h1>'
        + '<p class="lead">' + page.description + '</p>'
        + '<p class="meta">'
        + t(req.locale, 'legal.updated', { date: page.updated }) + '</p>'
        + '<div class="legal-body">' + page.body + '</div>'
    }));
  });
});

module.exports = router;
