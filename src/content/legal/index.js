// Юридические тексты по языкам. Пока есть только английский; недостающие
// переводы отдаются на языке по умолчанию, чтобы страница не пропадала.
const { DEFAULT_LOCALE } = require('../../i18n');

const CONTENT = {
  en: require('./en')
};

function legalPages(locale) {
  return CONTENT[locale] || CONTENT[DEFAULT_LOCALE];
}

function legalPage(slug, locale) {
  return legalPages(locale)[slug] || null;
}

function legalSlugs() {
  return Object.keys(CONTENT[DEFAULT_LOCALE]);
}

module.exports = { legalPages, legalPage, legalSlugs };
