const config = require('../config');
const { LEGAL_PAGES } = require('../seo/pages');
const { styles } = require('./theme');

// Публичный контент-сайт и движок бронирования — отдельные деплои,
// поэтому в шапке и футере на них ведут абсолютные ссылки.
const SITE_URL = 'https://madeirabook.com';
const BOOKING_URL = 'https://madeirabook.zeevou.direct';
const TELEGRAM_URL = 'https://t.me/Madeirabookbot';
const CONTACT_EMAIL = 'hello@madeirabook.com';

const NAV_LINKS = [
  { href: SITE_URL + '/madeira-apartment-rentals.html', title: 'Stays' },
  { href: SITE_URL + '/flights-to-madeira.html', title: 'Flights' },
  { href: SITE_URL + '/madeira-guide.html', title: 'Guides' },
  { href: SITE_URL + '/best-time-to-visit-madeira.html', title: 'Weather' }
];

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

function link(href, title) {
  return '<a href="' + href + '">' + escapeHtml(title) + '</a>';
}

function listItems(items) {
  return items
    .map((i) => '<li>' + link(i.href || i.path, i.title) + '</li>')
    .join('');
}

function renderHeader() {
  return '<nav class="nav"><div class="nav-inner">'
    + '<a class="nav-brand" href="' + SITE_URL + '">Madeirabook</a>'
    + '<div class="nav-links">'
    + NAV_LINKS.map((l) => link(l.href, l.title)).join('')
    + '</div>'
    + '<a class="nav-cta" href="' + BOOKING_URL + '">Book &rarr;</a>'
    + '</div></nav>';
}

function renderFooter() {
  return '<footer class="footer"><div class="footer-inner">'
    + '<div class="footer-brand">'
    + '<h4>Madeirabook</h4>'
    + '<p>Local community for Madeira stays. Direct booking from local hosts. '
    + 'No platform fees.</p>'
    + '</div>'
    + '<div><h4>Explore</h4><ul>' + listItems(NAV_LINKS) + '</ul></div>'
    + '<div><h4>Legal</h4><ul>' + listItems(LEGAL_PAGES) + '</ul></div>'
    + '<div><h4>Contact</h4><ul>'
    + '<li>' + link('mailto:' + CONTACT_EMAIL, CONTACT_EMAIL) + '</li>'
    + '<li>' + link(TELEGRAM_URL, 'Telegram bot') + '</li>'
    + '<li>' + link(BOOKING_URL, 'Book a stay') + '</li>'
    + '</ul></div>'
    + '</div>'
    + '<div class="footer-bottom">© ' + new Date().getFullYear()
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
    + '<meta name="viewport" content="width=device-width, initial-scale=1, '
    + 'viewport-fit=cover">'
    + '<meta name="theme-color" content="#1a3a2e">'
    + '<title>' + escapeHtml(title) + '</title>'
    + '<meta name="description" content="' + escapeHtml(description) + '">'
    + '<meta name="robots" content="'
    + (noindex ? 'noindex, nofollow' : 'index, follow') + '">'
    + '<link rel="canonical" href="' + canonical + '">'
    + '<meta property="og:type" content="website">'
    + '<meta property="og:title" content="' + escapeHtml(title) + '">'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">'
    + '<meta property="og:url" content="' + canonical + '">'
    + '<style>' + styles + '</style>'
    + '</head>'
    + '<body>'
    + renderHeader()
    + '<main class="page"><article class="card">' + options.body + '</article></main>'
    + renderFooter()
    + '</body></html>';
}

module.exports = {
  renderPage,
  renderHeader,
  renderFooter,
  absoluteUrl,
  escapeHtml,
  SITE_URL,
  BOOKING_URL
};
