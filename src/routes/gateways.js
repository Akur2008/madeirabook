const express = require('express');
const db = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const GATEWAY_STYLES = ['forest', 'sun', 'ocean', 'wild', 'terra'];
const STYLE_LABELS = {
  forest: 'Forest',
  sun: 'Sun',
  ocean: 'Ocean',
  wild: 'Wild',
  terra: 'Terra',
};

// Галерея шлюзов: смонтирована на /gateways (см. app.js).
// Проверка baseUrl сохраняет прежнее поведение GET /gateway (fall-through в pages).
router.get('/', async (req, res, next) => {
  if (req.baseUrl !== '/gateways') return next();
  try {
    const r = await db.query(
      "SELECT slug, title, subtitle, poster_url, accent_color, style "
      + "FROM emotional_gateways WHERE status = 'published' ORDER BY display_order, id"
    );

    const groups = new Map();
    r.rows.forEach((g) => {
      const key = GATEWAY_STYLES.includes(g.style) ? g.style : 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(g);
    });
    const orderedKeys = GATEWAY_STYLES.filter(k => groups.has(k));
    if (groups.has('other')) orderedKeys.push('other');

    const sections = orderedKeys.map((key) => {
      const cards = groups.get(key).map((g) => {
        const poster = g.poster_url
          ? '<img src="' + esc(g.poster_url) + '" alt="' + esc(g.title) + '" loading="lazy" '
            + 'class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">'
          : '<div class="absolute inset-0" style="background:linear-gradient(160deg, #'
            + esc(String(g.accent_color || '#1a1a1a').replace('#', '')) + '33, #141414);"></div>';
        return '<a href="/gateway/' + esc(g.slug) + '" class="group relative shrink-0 w-64 sm:w-72 snap-start '
          + 'rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] '
          + 'hover:border-white/30 transition-colors" style="aspect-ratio:4/5;">'
          + poster
          + '<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>'
          + '<div class="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-2">'
          + '<h3 class="text-base font-semibold leading-snug" style="text-shadow:0 1px 6px rgba(0,0,0,0.8);">'
          + esc(g.title) + '</h3>'
          + '<span class="shrink-0 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>'
          + '</div></a>';
      }).join('\n');
      return '<section class="mb-12">'
        + '<h2 class="font-cormorant text-3xl sm:text-4xl font-semibold mb-5 tracking-wide">'
        + esc(STYLE_LABELS[key] || 'Other') + '</h2>'
        + '<div class="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory '
        + '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">' + cards + '</div>'
        + '</section>';
    }).join('\n');

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Gateways — Madeirabook</title>
<meta name="description" content="Emotional gateways — choose your state of mind.">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
<script>tailwind.config = { theme: { extend: { fontFamily: { cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'] } } } };</script>
<style>
  body { background: #0a0a0a; color: #f5f5f7; font-family: Georgia, serif; min-height: 100vh; }
</style>
</head>
<body>
<main class="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
  <p class="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Madeirabook</p>
  <h1 class="font-cormorant text-4xl sm:text-5xl font-semibold mb-10">Gateways</h1>
  ${sections || '<p class="text-white/50">No gateways published yet.</p>'}
</main>
<script src="/sounds.js" defer></script></body></html>`);
  } catch (e) {
    next(e);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const r = await db.query(
      "SELECT * FROM emotional_gateways WHERE slug = $1 AND status = 'published' LIMIT 1",
      [slug]
    );
    if (!r.rows.length) {
      return res.status(404).send('<!DOCTYPE html><html><head><title>404</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-black min-h-screen flex items-center justify-center text-slate-200"><div class="text-center"><h1 class="text-6xl font-black mb-4">404</h1><p class="mb-6">Gateway not found</p><a href="/" class="text-cyan-400 hover:underline">Go home</a></div><script src="/sounds.js" defer></script></body></html>');
    }
    const g = r.rows[0];
    const questions = Array.isArray(g.questions) ? g.questions : [];
    const accentHex = String(g.accent_color || '#D4AF37').replace('#', '');
    const accentR = parseInt(accentHex.slice(0,2), 16) || 212;
    const accentG = parseInt(accentHex.slice(2,4), 16) || 175;
    const accentB = parseInt(accentHex.slice(4,6), 16) || 55;
    const accentRgb = accentR + ',' + accentG + ',' + accentB;

    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(g.title)} — Madeirabook</title>
<meta name="description" content="${esc(g.subtitle || g.title)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(g.title)} — Madeirabook">
<meta property="og:description" content="${esc(g.subtitle || '')}">
${g.poster_url ? '<meta property="og:image" content="' + esc(g.poster_url) + '">' : ''}
<meta property="og:url" content="https://app.madeirabook.com/gateway/${esc(g.slug)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://app.madeirabook.com/gateway/${esc(g.slug)}">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root { --accent-rgb: ${accentRgb}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body { background: #0a0a0a; color: #f5f5f7; font-family: Georgia, serif; }

  .stage { position: fixed; inset: 0; overflow: hidden; }
  .stage video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.75); }
  .stage::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.35) 50%, rgba(10,10,10,0.75) 100%); }

  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 20px 16px 60px 16px; }

  .glass { background: rgba(10,10,10,0.04); backdrop-filter: blur(14px) saturate(110%); -webkit-backdrop-filter: blur(14px) saturate(110%); border: 1px solid rgba(var(--accent-rgb), 0.20); border-radius: 20px; padding: 24px 22px; max-width: 480px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.25); }

  .title { font-size: 34px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px; line-height: 1.1; text-shadow: 0 2px 12px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.9); }
  .subtitle { color: #e0e0e5; font-size: 15px; margin: 0 0 28px 0; line-height: 1.4; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  .q-title { font-size: 20px; margin-bottom: 16px; font-weight: 600; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  .btn-answer { display: block; width: 100%; text-align: left; padding: 16px 18px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #f5f5f7; font-size: 15px; margin-bottom: 10px; cursor: pointer; transition: all .2s; font-family: Georgia, serif; -webkit-tap-highlight-color: transparent; text-shadow: 0 1px 4px rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .btn-answer:hover, .btn-answer:active { background: rgba(var(--accent-rgb), 0.2); border-color: rgba(var(--accent-rgb), 0.5); }

  .sound-btn { position: fixed; top: 16px; right: 16px; z-index: 3; width: 44px; height: 44px; border-radius: 50%; background: rgba(10,10,10,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); color: #f5f5f7; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all .2s; -webkit-tap-highlight-color: transparent; }
  .sound-btn:hover, .sound-btn:active { background: rgba(var(--accent-rgb), 0.3); border-color: rgba(var(--accent-rgb), 0.5); }
  .sound-btn.on { background: rgba(var(--accent-rgb), 0.4); border-color: #D4AF37; }

  .back-link { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.5); text-decoration: none; font-size: 13px; z-index: 3; }

  .all-gateways-btn { position: fixed; top: 16px; left: 16px; z-index: 3; padding: 10px 16px; border-radius: 999px; background: rgba(10,10,10,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); color: #f5f5f7; text-decoration: none; font-size: 13px; font-family: Georgia, serif; transition: all .2s; -webkit-tap-highlight-color: transparent; }
  .all-gateways-btn:hover, .all-gateways-btn:active { background: rgba(var(--accent-rgb), 0.3); border-color: rgba(var(--accent-rgb), 0.5); }

  @media (max-width: 480px) {
    .title { font-size: 26px; }
    .subtitle { font-size: 14px; margin-bottom: 20px; }
    .glass { padding: 22px 18px; border-radius: 16px; }
    .q-title { font-size: 17px; }
    .btn-answer { padding: 14px 16px; font-size: 14px; }
    .sound-btn { width: 40px; height: 40px; font-size: 18px; top: 12px; right: 12px; }
  }
</style>
</head>
<body>

<a href="/gateways" class="all-gateways-btn">← Back to all gateways</a>

<div class="stage">
  ${g.video_url
    ? `<video autoplay muted loop playsinline ${g.poster_url ? 'poster="' + esc(g.poster_url) + '"' : ''}>
        <source src="${esc(g.video_url)}" type="video/mp4">
       </video>`
    : (g.poster_url ? `<img src="${esc(g.poster_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.75);">` : '')}
</div>



<div class="overlay">
  <div class="glass">
    <h1 class="title">${esc(g.title)}</h1>
    ${g.subtitle ? '<p class="subtitle">' + esc(g.subtitle) + '</p>' : ''}
    <div id="quiz">
      <div id="qWrap">
        <div class="q-title" id="qText"></div>
        <div id="answers"></div>
      </div>
      <button id="openBtn" style="display:none;width:100%;padding:18px;border-radius:12px;background:rgba(255,255,255,0.04);backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%);color:#f5f5f7;font-weight:800;font-size:16px;border:1px solid rgba(255,255,255,0.6);cursor:pointer;font-family:Georgia,serif;-webkit-tap-highlight-color: transparent;text-shadow:0 1px 4px rgba(0,0,0,0.5);">Open sanctuary →</button>
    </div>
  </div>
  <a href="/" class="back-link">← Madeirabook</a>
</div>

<script>
const QUESTIONS = ${JSON.stringify(questions)};
const TARGET = ${JSON.stringify(g.target_route || '/')};
const TAGS = [];
let idx = 0;

function render() {
  const q = QUESTIONS[idx];
  if (!q) {
    document.getElementById('qWrap').style.display = 'none';
    document.getElementById('openBtn').style.display = 'block';
    return;
  }
  document.getElementById('qText').textContent = q.question;
  const ans = document.getElementById('answers');
  ans.innerHTML = '';
  q.answers.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'btn-answer';
    b.textContent = a.label;
    b.onclick = () => {
      if (a.tags) a.tags.forEach(t => TAGS.push(t));
      idx++;
      render();
    };
    ans.appendChild(b);
  });
}
// iOS Safari autoplay fix
(function() {
  var v = document.querySelector('.stage video');
  if (!v) return;
  v.muted = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  var tryPlay = function() {
    var p = v.play();
    if (p && p.catch) {
      p.catch(function() {
        // Автоплей заблокирован — стартуем по первому тапу в любом месте
        var resume = function() {
          document.removeEventListener('touchstart', resume);
          document.removeEventListener('click', resume);
          v.play();
        };
        document.addEventListener('touchstart', resume, { passive: true });
        document.addEventListener('click', resume, { passive: true });
      });
    }
  };
  if (v.readyState >= 2) tryPlay();
  else v.addEventListener('loadeddata', tryPlay);
  v.addEventListener('canplay', tryPlay);
})();

document.getElementById('openBtn').onclick = () => {
  const qs = TAGS.length ? ('?tags=' + TAGS.join(',')) : '';
  window.location.href = TARGET + qs;
};
render();


</script>
<script src="/sounds.js" defer></script></body></html>`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
