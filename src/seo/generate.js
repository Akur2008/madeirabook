const { PUBLIC_PAGES, DISALLOWED_PATHS } = require('./pages');

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

  const urls = PUBLIC_PAGES.map((page) => (
    '  <url>\n'
    + '    <loc>' + baseUrl() + page.path + '</loc>\n'
    + '    <lastmod>' + date + '</lastmod>\n'
    + '    <priority>' + page.priority + '</priority>\n'
    + '  </url>'
  )).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls + '\n'
    + '</urlset>\n';
}

module.exports = { buildRobotsTxt, buildSitemapXml };
