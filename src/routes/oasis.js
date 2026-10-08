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

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const r = await db.query(
      'SELECT id, slug, title, description FROM properties WHERE slug = $1 LIMIT 1',
      [slug]
    );
    if (!r.rows.length) {
      return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title>'
        + '<script src="https://cdn.tailwindcss.com"></script></head>'
        + '<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">'
        + '<div class="text-center"><h1 class="text-5xl font-light mb-4">404</h1>'
        + '<p class="text-slate-400 mb-6">This sanctuary does not exist.</p>'
        + '<a href="/" class="text-cyan-400 hover:underline">&larr; Return home</a></div><script src="/sounds.js" defer></script></body></html>');
    }
    const prop = r.rows[0];

    const mediaRes = await db.query(
      'SELECT m.url FROM properties_media pm JOIN media m ON m.id = pm.image_id '
      + 'WHERE pm._parent_id = $1 ORDER BY pm._order LIMIT 1',
      [prop.id]
    );
    const coverUrl = mediaRes.rows.length ? mediaRes.rows[0].url : null;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(prop.title)} — Ocean Sanctuary</title>
  <meta name="description" content="${esc((prop.description || '').slice(0, 160))}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0a0e14; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; }
    #oasis-stage { position: fixed; inset: 0; }
    #shoreline-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
    #shoreline-canvas:active { cursor: grabbing; }
    .ui-layer { position: absolute; inset: 0; pointer-events: none; }
    .ui-layer > * { pointer-events: auto; }
    .serif { font-family: 'Georgia', 'Times New Roman', serif; }
    .fade-in { animation: fadeIn 1.6s ease-out both; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .pulse-soft { animation: pulseSoft 3s ease-in-out infinite; }
    @keyframes pulseSoft { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    .control-btn {
      background: rgba(8, 14, 22, 0.75);
      border: 1px solid rgba(120, 200, 240, 0.18);
      color: #b8d8e8;
      backdrop-filter: blur(10px);
      transition: all 0.2s ease;
    }
    .control-btn:hover { background: rgba(20, 40, 60, 0.85); border-color: rgba(150, 220, 255, 0.4); }
    .control-btn.active { border-color: rgba(120, 220, 255, 0.7); color: #e0f4ff; }
  </style>
</head>
<body>

<canvas id="shoreline-canvas"></canvas>
<canvas id="vista-canvas" style="display:none; position:absolute; inset:0; width:100%; height:100%;"></canvas>

<div class="ui-layer">

  <div class="absolute top-0 left-0 right-0 p-6 flex items-center justify-between fade-in">
    <a href="/p/${esc(prop.slug)}" class="text-xs uppercase tracking-widest text-slate-400 hover:text-cyan-300 transition-colors">&larr; ${esc(prop.title)}</a>
    <span class="text-xs uppercase tracking-widest text-slate-500">Basalt Tide &middot; Ocean Sanctuary</span>
  </div>

  <button id="start-overlay"
    class="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm fade-in transition-opacity duration-1000">
    <div class="text-center">
      <div class="inline-block px-6 py-3 rounded-full control-btn pulse-soft mb-4">
        <span class="text-xs uppercase tracking-widest">Tap to enter</span>
      </div>
      <p class="text-sm text-slate-500 max-w-md mx-auto px-6">
        Sound of Atlantic waves rolling basalt pebbles, synthesised live.
      </p>
    </div>
  </button>

  <div class="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 fade-in">
    <button data-view="shoreline" class="view-btn control-btn active px-4 py-2 rounded-full text-xs uppercase tracking-wider">Shoreline</button>
    <button data-view="vista" class="view-btn control-btn px-4 py-2 rounded-full text-xs uppercase tracking-wider">Vista</button>
  </div>

  <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 fade-in">
    <button data-time="morning" class="time-btn control-btn px-4 py-2 rounded-full text-xs">Morning</button>
    <button data-time="noon" class="time-btn control-btn px-4 py-2 rounded-full text-xs">Noon</button>
    <button data-time="sunset" class="time-btn control-btn px-4 py-2 rounded-full text-xs">Sunset</button>
    <button data-time="twilight" class="time-btn control-btn px-4 py-2 rounded-full text-xs">Twilight</button>
  </div>

  <div class="absolute bottom-6 right-6 text-right fade-in">
    <div id="wave-state" class="text-xs uppercase tracking-widest text-cyan-300/70"></div>
  </div>

</div>

<script src="/oasis-static/sound-engine.js"></script>
<script src="/oasis-static/shoreline.js"></script>
<script src="/oasis-static/vista.js"></script>
<script>
(function () {
  var stage = document.getElementById('shoreline-canvas');
  var startOverlay = document.getElementById('start-overlay');
  var waveStateEl = document.getElementById('wave-state');
  var timeButtons = document.querySelectorAll('.time-btn');
  var currentTime = 'twilight';

  var engine = window.basaltSoundEngine;
  var vistaCanvas = document.getElementById('vista-canvas');
  var currentView = 'shoreline';

  var shoreline = new window.Shoreline(stage, {
    timeOfDay: currentTime,
    soundEngine: engine,
    onTideUpdate: function (phase, name) {
      if (currentView === 'shoreline') waveStateEl.textContent = name;
    }
  });

  var vista = new window.Vista(vistaCanvas, { timeOfDay: currentTime });

  var viewButtons = document.querySelectorAll('.view-btn');
  viewButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.getAttribute('data-view');
      if (v === currentView) return;
      currentView = v;
      viewButtons.forEach(function (b) {
        if (b.getAttribute('data-view') === v) b.classList.add('active');
        else b.classList.remove('active');
      });
      if (v === 'vista') {
        stage.style.display = 'none';
        vistaCanvas.style.display = 'block';
        if (vista && typeof vista.resize === 'function') vista.resize();
        waveStateEl.textContent = 'Ocean Vista';
      } else {
        stage.style.display = 'block';
        vistaCanvas.style.display = 'none';
      }
    });
  });

  function setActiveButton() {
    timeButtons.forEach(function (btn) {
      if (btn.getAttribute('data-time') === currentTime) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  setActiveButton();

  timeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentTime = btn.getAttribute('data-time');
      shoreline.timeOfDay = currentTime;
      if (vista) vista.timeOfDay = currentTime;
      setActiveButton();
    });
  });

  startOverlay.addEventListener('click', function () {
    engine.start().then(function () {
      startOverlay.style.opacity = '0';
      startOverlay.style.pointerEvents = 'none';
      setTimeout(function () { startOverlay.style.display = 'none'; }, 1100);
    }).catch(function (err) {
      console.error('Audio start failed:', err);
    });
  });
})();
</script>

<script src="/sounds.js" defer></script></body>
</html>`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
