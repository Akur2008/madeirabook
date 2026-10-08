const express = require('express');
const db = require('../../db/client');
const logger = require('../logger');

const router = express.Router();

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root { --accent-rgb: ${accentRgb}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body { background: #0a0a0a; color: #f5f5f7; font-family: Georgia, serif; }

  .stage { position: fixed; inset: 0; overflow: hidden; }
  .stage video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.75); }
  .stage::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.35) 50%, rgba(10,10,10,0.75) 100%); }

  .overlay { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 16px; }

  .glass { background: rgba(10,10,10,0.08); backdrop-filter: blur(24px) saturate(120%); -webkit-backdrop-filter: blur(24px) saturate(120%); border: 1px solid rgba(var(--accent-rgb), 0.25); border-radius: 20px; padding: 28px 24px; max-width: 480px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }

  .title { font-size: 34px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px; line-height: 1.1; text-shadow: 0 2px 12px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.9); }
  .subtitle { color: #e0e0e5; font-size: 15px; margin: 0 0 28px 0; line-height: 1.4; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  .q-title { font-size: 20px; margin-bottom: 16px; font-weight: 600; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
  .btn-answer { display: block; width: 100%; text-align: left; padding: 16px 18px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #f5f5f7; font-size: 15px; margin-bottom: 10px; cursor: pointer; transition: all .2s; font-family: Georgia, serif; -webkit-tap-highlight-color: transparent; text-shadow: 0 1px 4px rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .btn-answer:hover, .btn-answer:active { background: rgba(var(--accent-rgb), 0.2); border-color: rgba(var(--accent-rgb), 0.5); }

  .sound-btn { position: fixed; top: 16px; right: 16px; z-index: 3; width: 44px; height: 44px; border-radius: 50%; background: rgba(10,10,10,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); color: #f5f5f7; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all .2s; -webkit-tap-highlight-color: transparent; }
  .sound-btn:hover, .sound-btn:active { background: rgba(var(--accent-rgb), 0.3); border-color: rgba(var(--accent-rgb), 0.5); }
  .sound-btn.on { background: rgba(var(--accent-rgb), 0.4); border-color: #D4AF37; }

  .back-link { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.5); text-decoration: none; font-size: 13px; z-index: 3; }

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

<div class="stage">
  ${g.video_url
    ? `<video autoplay muted loop playsinline ${g.poster_url ? 'poster="' + esc(g.poster_url) + '"' : ''}>
        <source src="${esc(g.video_url)}" type="video/mp4">
       </video>`
    : (g.poster_url ? `<img src="${esc(g.poster_url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.75);">` : '')}
</div>

${g.audio_url ? `<button id="soundBtn" class="sound-btn" title="Sound on/off" aria-label="Sound">🔇</button>
<audio id="ambient" src="${esc(g.audio_url)}" loop preload="auto"></audio>` : ''}

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
document.getElementById('openBtn').onclick = () => {
  const qs = TAGS.length ? ('?tags=' + TAGS.join(',')) : '';
  window.location.href = TARGET + qs;
};
render();

// === SOUND ===
(function() {
  const btn = document.getElementById('soundBtn');
  const audio = document.getElementById('ambient');
  if (!btn || !audio) return;
  let targetVol = 0;
  let currentVol = 0;
  let fadeTimer = null;

  function fadeTo(target) {
    targetVol = target;
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const step = 0.05;
      if (Math.abs(currentVol - targetVol) < step) {
        currentVol = targetVol;
        audio.volume = currentVol;
        clearInterval(fadeTimer);
        fadeTimer = null;
        return;
      }
      currentVol += (targetVol > currentVol ? step : -step);
      audio.volume = Math.max(0, Math.min(1, currentVol));
    }, 40);
  }

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.volume = 0;
      audio.play().then(() => {
        btn.textContent = '🔊';
        btn.classList.add('on');
        fadeTo(0.6);
      }).catch((e) => { console.warn('audio play failed', e); });
    } else {
      fadeTo(0);
      setTimeout(() => {
        audio.pause();
        btn.textContent = '🔇';
        btn.classList.remove('on');
      }, 400);
    }
  });
})();
</script>
<script src="/sounds.js" defer></script></body></html>`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
