const { PUBLIC_PAGES, DISALLOWED_PATHS } = require('./pages');
const { alternatePaths } = require('../i18n');

const DEFAULT_APP_URL = 'https://madeirabook.com';

// Не берём src/config: генератор должен работать и в сборке, где нет
// полного набора переменных окружения.
function baseUrl() {
  return (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
}

function buildRobotsTxt() {
  const lines = ['User-agent: *', 'Allow: /'];

  DISALLOWED_PATHS.forEach((p) => {
    lines.push('Disallow: ' + p);
  });

  lines.push('', 'Sitemap: ' + baseUrl() + '/sitemap.xml', '');
  return lines.join('\n');
}

function buildSitemapXml(lastmod) {
  const date = lastmod || new Date().toISOString().slice(0, 10);

  // Каждая страница попадает в sitemap во всех языках, с перекрёстными
  // xhtml:link — при добавлении локали sitemap расширяется сам.
  const urls = PUBLIC_PAGES.map((page) => {
    const alternates = alternatePaths(page.path);
    const links = alternates.map((a) => (
      '    <xhtml:link rel="alternate" hreflang="' + a.locale
      + '" href="' + baseUrl() + a.path + '"/>'
    )).join('\n');

    return alternates.map((a) => (
      '  <url>\n'
      + '    <loc>' + baseUrl() + a.path + '</loc>\n'
      + links + '\n'
      + '    <lastmod>' + date + '</lastmod>\n'
      + '    <priority>' + page.priority + '</priority>\n'
      + '  </url>'
    )).join('\n');
  }).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    + '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + urls + '\n'
    + '</urlset>\n';
}

module.exports = { buildRobotsTxt, buildSitemapXml };
