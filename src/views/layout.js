const config = require('../config');
const { LEGAL_PAGES } = require('../seo/pages');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(pathname) {
  return config.APP_URL.replace(/\/$/, '') + pathname;
}

function renderFooter() {
  const legalLinks = LEGAL_PAGES
    .map((p) => '<a href="' + p.path + '" style="color:#94a3b8;'
      + 'text-decoration:none;margin:0 10px;">' + escapeHtml(p.title) + '</a>')
    .join('');

  return '<footer style="background:#0f172a;color:#94a3b8;'
    + 'padding:32px 24px;margin-top:64px;font-size:14px;text-align:center;">'
    + '<div style="margin-bottom:12px;">' + legalLinks + '</div>'
    + '<div>© ' + new Date().getFullYear()
    + ' Madeirabook — Funchal, Madeira, Portugal</div>'
    + '</footer>';
}

function renderPage(options) {
  const title = options.title;
  const description = options.description || '';
  const canonical = absoluteUrl(options.path || '/');
  const noindex = options.noindex === true;

  return '<!doctype html><html lang="' + (options.lang || 'en') + '">'
    + '<head>'
    + '<meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + escapeHtml(title) + '</title>'
    + '<meta name="description" content="' + escapeHtml(description) + '">'
    + '<meta name="robots" content="'
    + (noindex ? 'noindex, nofollow' : 'index, follow') + '">'
    + '<link rel="canonical" href="' + canonical + '">'
    + '<meta property="og:type" content="website">'
    + '<meta property="og:title" content="' + escapeHtml(title) + '">'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">'
    + '<meta property="og:url" content="' + canonical + '">'
    + '</head>'
    + '<body style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">'
    + '<main style="max-width:860px;margin:0 auto;padding:40px 24px;line-height:1.7;">'
    + options.body
    + '</main>'
    + renderFooter()
    + '</body></html>';
}

module.exports = { renderPage, renderFooter, absoluteUrl, escapeHtml };
