const config = require('../config');
const { LEGAL_PAGES } = require('../seo/pages');
const { hash } = require('./generated-styles');
const {
  DEFAULT_LOCALE,
  t,
  localizedPath,
  alternatePaths
} = require('../i18n');

// Публичный контент-сайт и движок бронирования — отдельные деплои,
// поэтому в шапке и футере на них ведут абсолютные ссылки.
const SITE_URL = 'https://madeirabook.com';
const BOOKING_URL = 'https://madeirabook.zeevou.direct';
const TELEGRAM_URL = 'https://t.me/Madeirabookbot';
const CONTACT_EMAIL = 'hello@madeirabook.com';
const STYLESHEET = '/assets/site.' + hash + '.css';

const NAV_LINKS = [
  { href: SITE_URL + '/madeira-apartment-rentals.html', key: 'nav.stays' },
  { href: SITE_URL + '/flights-to-madeira.html', key: 'nav.flights' },
  { href: SITE_URL + '/madeira-guide.html', key: 'nav.guides' },
  { href: SITE_URL + '/best-time-to-visit-madeira.html', key: 'nav.weather' }
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
    .map((i) => '<li>' + link(i.href, i.title) + '</li>')
    .join('');
}

function navItems(locale) {
  return NAV_LINKS.map((l) => ({ href: l.href, title: t(locale, l.key) }));
}

function legalItems(locale) {
  return LEGAL_PAGES.map((p) => ({
    href: localizedPath(p.path, locale),
    title: p.title
  }));
}

function renderHeader(locale) {
  return '<nav class="nav"><div class="nav-inner">'
    + '<a class="nav-brand" href="' + SITE_URL + '">Madeirabook</a>'
    + '<div class="nav-links">'
    + navItems(locale).map((l) => link(l.href, l.title)).join('')
    + '</div>'
    + '<a class="nav-cta" href="' + BOOKING_URL + '">'
    + escapeHtml(t(locale, 'nav.book')) + ' &rarr;</a>'
    + '</div></nav>';
}

function renderFooter(locale) {
  return '<footer class="footer"><div class="footer-inner">'
    + '<div class="footer-brand">'
    + '<h4>Madeirabook</h4>'
    + '<p>' + escapeHtml(t(locale, 'footer.tagline')) + '</p>'
    + '</div>'
    + '<div><h4>' + escapeHtml(t(locale, 'footer.explore')) + '</h4>'
    + '<ul>' + listItems(navItems(locale)) + '</ul></div>'
    + '<div><h4>' + escapeHtml(t(locale, 'footer.legal')) + '</h4>'
    + '<ul>' + listItems(legalItems(locale)) + '</ul></div>'
    + '<div><h4>' + escapeHtml(t(locale, 'footer.contact')) + '</h4><ul>'
    + '<li>' + link('mailto:' + CONTACT_EMAIL, CONTACT_EMAIL) + '</li>'
    + '<li>' + link(TELEGRAM_URL, t(locale, 'footer.telegram')) + '</li>'
    + '<li>' + link(BOOKING_URL, t(locale, 'footer.book')) + '</li>'
    + '</ul></div>'
    + '</div>'
    + '<div class="footer-bottom">'
    + escapeHtml(t(locale, 'footer.copyright', {
      year: new Date().getFullYear()
    }))
    + '</div>'
    + '</footer>';
}

function renderPage(options) {
  const title = options.title;
  const description = options.description || '';
  const locale = options.locale || DEFAULT_LOCALE;
  const path = options.path || '/';
  const canonical = absoluteUrl(localizedPath(path, locale));
  const noindex = options.noindex === true;
  const alternates = noindex ? '' : alternatePaths(path)
    .map((a) => '<link rel="alternate" hreflang="' + a.locale
      + '" href="' + absoluteUrl(a.path) + '">')
    .join('')
    + '<link rel="alternate" hreflang="x-default" href="'
    + absoluteUrl(localizedPath(path, DEFAULT_LOCALE)) + '">';

  return '<!doctype html><html lang="' + locale + '">'
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
    + alternates
    + '<meta property="og:type" content="website">'
    + '<meta property="og:title" content="' + escapeHtml(title) + '">'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">'
    + '<meta property="og:url" content="' + canonical + '">'
    + '<link rel="stylesheet" href="' + STYLESHEET + '">'
    + '</head>'
    + '<body>'
    + renderHeader(locale)
    + '<main class="page"><article class="card">' + options.body + '</article></main>'
    + renderFooter(locale)
    + '</body></html>';
}

module.exports = {
  renderPage,
  renderHeader,
  renderFooter,
  absoluteUrl,
  escapeHtml,
  STYLESHEET,
  SITE_URL,
  BOOKING_URL
};
