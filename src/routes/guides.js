const express = require('express');
const { getPayload } = require('payload');
const config = require('../../payload.config.ts');
const logger = require('../logger');

const router = express.Router();

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Простой markdown → HTML (без внешних либ)
function mdToHtml(md) {
  if (!md) return '';
  var html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-black mt-8 mb-4">$1</h1>');
  html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  html = html.replace(/\\n\\n/g, '</p><p class="mb-4 leading-relaxed">');
  html = '<p class="mb-4 leading-relaxed">' + html + '</p>';
  return html;
}

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const payload = await getPayload({ config: config.default || config });
    const result = await payload.find({
      collection: 'guides',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
      depth: 2
    });

    if (!result.docs.length) {
      return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title>'
        + '<script src="https://cdn.tailwindcss.com"></script></head>'
        + '<body class="bg-slate-50 min-h-screen flex items-center justify-center px-6">'
        + '<div class="text-center"><h1 class="text-5xl font-black mb-4">404</h1>'
        + '<p class="text-slate-500 mb-6">Guide not found.</p>'
        + '<a href="/" class="text-emerald-600 hover:underline">&larr; Home</a></div></body></html>');
    }

    const guide = result.docs[0];
    const base = (process.env.APP_URL || 'https://app.madeirabook.com').replace(/\/$/, '');

    // Schema.org JSON-LD
    let jsonLd;
    if (guide.schemaType === 'FAQPage' && guide.faqs && guide.faqs.length) {
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map(function (f) {
          return {
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer }
          };
        })
      };
    } else {
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.aiSummary,
        url: base + '/g/' + guide.slug,
        datePublished: guide.publishedAt || guide.createdAt,
        publisher: { '@type': 'Organization', name: 'Madeirabook', url: base }
      };
    }

    // FAQ HTML
    let faqHtml = '';
    if (guide.faqs && guide.faqs.length) {
      faqHtml = '<section class="mt-12 border-t pt-8"><h2 class="text-2xl font-bold mb-6">Frequently Asked Questions</h2>';
      for (const f of guide.faqs) {
        faqHtml += '<div class="mb-4 bg-slate-50 p-6 rounded-xl">'
          + '<h3 class="font-semibold text-lg text-slate-800 mb-2">' + esc(f.question) + '</h3>'
          + '<p class="text-slate-700">' + esc(f.answer) + '</p>'
          + '</div>';
      }
      faqHtml += '</section>';
    }

    // Related properties
    let relatedHtml = '';
    if (guide.relatedProperties && guide.relatedProperties.length) {
      relatedHtml = '<section class="mt-12 border-t pt-8"><h2 class="text-2xl font-bold mb-6">Recommended Places to Stay</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
      for (const p of guide.relatedProperties) {
        if (typeof p === 'object' && p.slug) {
          relatedHtml += '<a href="/p/' + esc(p.slug) + '" class="block border rounded-xl p-4 hover:shadow-md transition-shadow">'
            + '<h3 class="font-semibold text-lg">' + esc(p.title) + '</h3>'
            + (p.pricePerNight ? '<p class="text-slate-500 mt-1">&euro;' + p.pricePerNight + ' / night</p>' : '')
            + '</a>';
        }
      }
      relatedHtml += '</div></section>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(guide.title)} — Madeirabook</title>
<meta name="description" content="${esc(guide.aiSummary.slice(0, 160))}">
<script src="https://cdn.tailwindcss.com"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="bg-white min-h-screen">
<article class="max-w-3xl mx-auto px-6 py-12">
  <a href="/" class="text-sm text-slate-500 hover:text-slate-800">&larr; Madeirabook</a>
  <header class="mt-6 mb-8">
    <h1 class="text-4xl font-black tracking-tight mb-4">${esc(guide.title)}</h1>
    <div class="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg text-lg text-blue-900 font-medium">
      ${esc(guide.aiSummary)}
    </div>
  </header>

  <div class="prose max-w-none text-slate-700">
    ${mdToHtml(guide.content || '')}
  </div>

  ${faqHtml}
  ${relatedHtml}

  <footer class="mt-16 pt-8 border-t border-slate-200 text-xs text-slate-400 flex flex-wrap gap-4">
    <a href="/legal/cookie-policy" class="hover:text-slate-700">Cookie Policy</a>
    <a href="/legal/privacy-policy" class="hover:text-slate-700">Privacy Policy</a>
    <a href="/legal/terms-of-service" class="hover:text-slate-700">Terms of Service</a>
  </footer>
</article>
</body>
</html>`);
  } catch (e) {
    logger.error({ err: e.message, slug: req.params.slug }, 'guide page error');
    next(e);
  }
});

module.exports = router;
