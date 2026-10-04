const express = require('express');
const db = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function mdToHtml(md) {
  if (!md) return '';
  var html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-black mt-8 mb-4">$1</h1>');
  html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li class="ml-6 list-disc">$1</li>');
  html = html.replace(/\\n\\n/g, '</p><p class="mb-4 leading-relaxed">');
  html = '<p class="mb-4 leading-relaxed">' + html + '</p>';
  return html;
}

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const base = (process.env.APP_URL || 'https://app.madeirabook.com').replace(/\/$/, '');

    const gRes = await db.query(
      'SELECT id, title, slug, ai_summary, content, schema_type, published_at, created_at '
      + 'FROM guides WHERE slug = $1 AND status = $2 LIMIT 1',
      [slug, 'published']
    );

    if (!gRes.rows.length) {
      return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title>'
        + '<script src="https://cdn.tailwindcss.com"></script></head>'
        + '<body class="bg-slate-50 min-h-screen flex items-center justify-center px-6">'
        + '<div class="text-center"><h1 class="text-5xl font-black mb-4">404</h1>'
        + '<p class="text-slate-500 mb-6">Guide not found.</p>'
        + '<a href="/" class="text-emerald-600 hover:underline">&larr; Home</a></div></body></html>');
    }

    const guide = gRes.rows[0];

    // FAQ
    const fRes = await db.query(
      'SELECT question, answer FROM guides_faqs WHERE _parent_id = $1 ORDER BY _order',
      [guide.id]
    );
    const faqs = fRes.rows;

    // Related properties
    const rRes = await db.query(
      'SELECT p.slug, p.title, p.price_per_night FROM guides_rels gr '
      + 'JOIN properties p ON p.id = gr.properties_id '
      + 'WHERE gr.parent_id = $1 ORDER BY gr."order"',
      [guide.id]
    );
    const related = rRes.rows;

    // Schema.org
    let jsonLd;
    if (guide.schema_type === 'FAQPage' && faqs.length) {
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(function (f) {
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
        description: guide.ai_summary,
        url: base + '/g/' + guide.slug,
        datePublished: guide.published_at || guide.created_at,
        publisher: { '@type': 'Organization', name: 'Madeirabook', url: base }
      };
    }

    // FAQ HTML
    let faqHtml = '';
    if (faqs.length) {
      faqHtml = '<section class="mt-12 border-t pt-8"><h2 class="text-2xl font-bold mb-6">Frequently Asked Questions</h2>';
      for (const f of faqs) {
        faqHtml += '<div class="mb-4 bg-slate-50 p-6 rounded-xl">'
          + '<h3 class="font-semibold text-lg text-slate-800 mb-2">' + esc(f.question) + '</h3>'
          + '<p class="text-slate-700">' + esc(f.answer) + '</p>'
          + '</div>';
      }
      faqHtml += '</section>';
    }

    // Related HTML
    let relatedHtml = '';
    if (related.length) {
      relatedHtml = '<section class="mt-12 border-t pt-8"><h2 class="text-2xl font-bold mb-6">Recommended Places to Stay</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
      for (const p of related) {
        relatedHtml += '<a href="/p/' + esc(p.slug) + '" class="block border rounded-xl p-4 hover:shadow-md transition-shadow">'
          + '<h3 class="font-semibold text-lg">' + esc(p.title) + '</h3>'
          + (p.price_per_night ? '<p class="text-slate-500 mt-1">&euro;' + Number(p.price_per_night).toFixed(0) + ' / night</p>' : '')
          + '</a>';
      }
      relatedHtml += '</div></section>';
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(guide.title)} — Madeirabook</title>
<meta name="description" content="${esc((guide.ai_summary || '').slice(0, 160))}">
<script src="https://cdn.tailwindcss.com"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="bg-white min-h-screen">
<article class="max-w-3xl mx-auto px-6 py-12">
  <a href="/" class="text-sm text-slate-500 hover:text-slate-800">&larr; Madeirabook</a>
  <header class="mt-6 mb-8">
    <h1 class="text-4xl font-black tracking-tight mb-4">${esc(guide.title)}</h1>
    <div class="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg text-lg text-blue-900 font-medium">
      ${esc(guide.ai_summary)}
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
