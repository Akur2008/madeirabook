// Каркас мультиязычности: язык по умолчанию живёт в корне ('/'),
// любой следующий — под префиксом ('/pt/legal/privacy').
// Чтобы добавить язык, достаточно положить словарь в locales/ и
// перечислить его в LOCALES.
const en = require('./locales/en');

const DEFAULT_LOCALE = 'en';

const LOCALES = {
  en: en
};

const SUPPORTED_LOCALES = Object.keys(LOCALES);

function isSupported(locale) {
  return Object.prototype.hasOwnProperty.call(LOCALES, locale);
}

function dictionary(locale) {
  return LOCALES[isSupported(locale) ? locale : DEFAULT_LOCALE];
}

// 'footer.legal' → строка словаря; недостающие ключи берём из языка
// по умолчанию, чтобы частичный перевод не ронял страницу.
function lookup(dict, key) {
  return key.split('.').reduce(
    (node, part) => (node == null ? undefined : node[part]),
    dict
  );
}

function t(locale, key, vars) {
  const value = lookup(dictionary(locale), key);
  const fallback = value === undefined
    ? lookup(dictionary(DEFAULT_LOCALE), key)
    : value;

  if (typeof fallback !== 'string') return key;
  if (!vars) return fallback;

  return fallback.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  ));
}

// Путь страницы в конкретном языке: '/legal/terms' → '/pt/legal/terms'.
function localizedPath(pathname, locale) {
  const clean = pathname === '/' ? '' : pathname;
  if (!isSupported(locale) || locale === DEFAULT_LOCALE) return pathname;
  return '/' + locale + (clean || '');
}

// Все языковые версии страницы — для hreflang и sitemap.
function alternatePaths(pathname) {
  return SUPPORTED_LOCALES.map((locale) => ({
    locale: locale,
    path: localizedPath(pathname, locale)
  }));
}

function localeFromPath(pathname) {
  const segment = pathname.split('/')[1];
  return isSupported(segment) && segment !== DEFAULT_LOCALE ? segment : null;
}

// Снимает языковой префикс с URL, чтобы роуты оставались без изменений.
function localeMiddleware(req, res, next) {
  const locale = localeFromPath(req.url);

  if (locale) {
    req.url = req.url.slice(locale.length + 1) || '/';
  }

  req.locale = locale || DEFAULT_LOCALE;
  next();
}

module.exports = {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupported,
  t,
  localizedPath,
  alternatePaths,
  localeMiddleware
};
