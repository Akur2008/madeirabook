/**
 * Шаблоны для очереди email_queue.
 * Каждый — функция (subscriberEmail) => { subject, html, text }
 * Сейчас простые: постер-плейсхолдер + текст + кнопка.
 * Потом заменим posterUrl на реальные кадры.
 */

const BTN = 'display:inline-block;padding:14px 28px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;';

function wrapper(posterUrl, title, bodyText, ctaText, ctaUrl) {
  const poster = posterUrl
    ? '<img src="' + posterUrl + '" alt="" style="width:100%;max-width:600px;border-radius:12px;display:block;margin-bottom:20px;">'
    : '';
  return '<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1f2937;background:#fff;padding:20px;">'
    + poster
    + '<h2 style="color:#064e3b;font-size:24px;margin:0 0 16px 0;">' + title + '</h2>'
    + bodyText
    + '<p style="margin:24px 0;"><a href="' + ctaUrl + '" style="' + BTN + '">' + ctaText + '</a></p>'
    + '<p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">'
    + 'Madeirabook · <a href="https://app.madeirabook.com" style="color:#9ca3af;">app.madeirabook.com</a><br>'
    + 'You are receiving this because you subscribed to our guide.'
    + '</p></div>';
}

const templates = {
  gateway_ocean: () => ({
    subject: 'The ocean doesn\'t ask questions — but you do',
    text: 'Two questions. Then we show you the sea. Click to enter: https://app.madeirabook.com/gateway/ocean',
    html: wrapper(
      null,
      'The ocean doesn\'t ask questions',
      '<p>But you do. And we have answers.</p>'
      + '<p>Two questions. Then we show you the sea.</p>'
      + '<p>Which element of Madeira is yours — the wild ocean, the misty forest, the sun on the basalt, or the waterfalls of the north?</p>',
      'Enter the gateway →',
      'https://app.madeirabook.com/gateway/ocean?utm_source=email&utm_campaign=gateway_ocean'
    ),
  }),

  restaurants_funchal: () => ({
    subject: '5 restaurants in Funchal with 30–50% off',
    text: 'Inside: 5 restaurants in Funchal with TheFork discounts. Click to see the guide.',
    html: wrapper(
      null,
      '5 restaurants in Funchal — 30–50% off',
      '<p>Funchal has a secret: TheFork discounts. We collected 5 places where dinner costs 30–50% less than the menu price.</p>'
      + '<p>All within a 15-minute walk from the Lido.</p>',
      'See the guide →',
      'https://www.madeirabook.com/where-to-eat-madeira.html?utm_source=email&utm_campaign=restaurants_funchal'
    ),
  }),

  madeira_winter: () => ({
    subject: 'Madeira in winter: +20°C while Europe freezes',
    text: 'While London has -5°C, Madeira has +20°C. Flights from €27.',
    html: wrapper(
      null,
      'Madeira in winter: +20°C',
      '<p>While Europe freezes, Madeira stays warm. January average: +20°C. Ocean: +18°C (swimmable).</p>'
      + '<p>Flights from London: from €27. Fewer tourists than summer — 3× less.</p>'
      + '<p>The best time to come is exactly when everyone else is at home.</p>',
      'See winter guide →',
      'https://www.madeirabook.com/best-time-to-visit-madeira.html?utm_source=email&utm_campaign=madeira_winter'
    ),
  }),

  return_offer: () => ({
    subject: 'The apartments you saw — 10% off for you',
    text: 'Three ocean-view apartments in Funchal. Direct booking, no platform fees.',
    html: wrapper(
      null,
      'Three apartments. One ocean.',
      '<p>Direct booking, no platform fees, and 10% off for our subscribers.</p>'
      + '<p>303 — studio, 3rd floor, ocean view.<br>'
      + '607 — studio, 6th floor, ocean view.<br>'
      + 'Penthouse — top floor, panoramic terrace.</p>',
      'See availability →',
      'https://app.madeirabook.com/?utm_source=email&utm_campaign=return_offer'
    ),
  }),
};

module.exports = { templates };
