// Единый источник правды для футера, sitemap.xml и сборки статики.

const LEGAL_PAGES = [
  { path: '/legal/privacy', title: 'Privacy Policy', priority: '0.3' },
  { path: '/legal/terms', title: 'Terms of Service', priority: '0.3' },
  { path: '/legal/cookies', title: 'Cookie Policy', priority: '0.3' }
];

const PUBLIC_PAGES = [
  { path: '/', title: 'Madeirabook', priority: '1.0' }
].concat(LEGAL_PAGES);

// Страницы, которые не должны попадать в индекс Google.
const DISALLOWED_PATHS = [
  '/admin',
  '/owner',
  '/api',
  '/webhook',
  '/booking-success',
  '/booking-cancel'
];

module.exports = { LEGAL_PAGES, PUBLIC_PAGES, DISALLOWED_PATHS };
