/**
 * Глобальная кнопка звука Oasis Madeira.
 * Работает на всех страницах. Состояние в localStorage.
 * При загрузке: fetch /api/sounds/active?page=<path> → <audio> → fade-in
 */
(function () {
  'use strict';

  const LS_KEY = 'mb_sound_on';
  const LS_MUTED_SESSION = 'mb_sound_asked';

  let audio = null;
  let btn = null;
  let soundData = null;
  let fadeTimer = null;

  // === Стили ===
  const style = document.createElement('style');
  style.textContent = `
    .mb-sound-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(10,10,10,0.55);
      backdrop-filter: blur(16px) saturate(140%);
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      border: 1px solid rgba(255,255,255,0.35);
      color: #f5f5f7;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .2s, background .2s, border-color .2s;
      -webkit-tap-highlight-color: transparent;
      padding: 0;
      line-height: 1;
      box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      animation: mb-pulse 2.8s ease-in-out infinite;
    }
    .mb-sound-btn:hover {
      transform: scale(1.06);
      background: rgba(212,175,55,0.3);
      border-color: rgba(212,175,55,0.7);
    }
    .mb-sound-btn.on {
      animation: none;
      background: rgba(212,175,55,0.4);
      border-color: #D4AF37;
    }
    @keyframes mb-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 0 0 0 rgba(212,175,55,0.55); }
      50% { box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 0 0 14px rgba(212,175,55,0); }
    }
    @media (max-width: 480px) {
      .mb-sound-btn { width: 48px; height: 48px; font-size: 20px; bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // === Кнопка ===
  function createButton() {
    btn = document.createElement('button');
    btn.className = 'mb-sound-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle ambient sound');
    btn.title = 'Sound of Oasis Madeira';
    btn.textContent = '🔇';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
  }

  // === Fade in/out ===
  function fadeTo(target, ms) {
    if (!audio) return;
    if (fadeTimer) clearInterval(fadeTimer);
    const start = audio.volume;
    const startTs = Date.now();
    fadeTimer = setInterval(function () {
      const elapsed = Date.now() - startTs;
      const t = Math.min(1, elapsed / ms);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (t >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }, 30);
  }

  // === Играть / пауза ===
  function play() {
    if (!audio || !soundData) return;
    if (audio.src !== soundData.url) audio.src = soundData.url;
    audio.volume = 0;
    audio.play().then(function () {
      fadeTo(0.5, 900);
      if (btn) {
        btn.textContent = '🔊';
        btn.classList.add('on');
      }
      try { localStorage.setItem(LS_KEY, '1'); } catch (e) {}
    }).catch(function (err) {
      console.warn('Sound play failed:', err);
    });
  }

  function pause() {
    if (!audio) return;
    fadeTo(0, 500);
    setTimeout(function () {
      if (audio) audio.pause();
    }, 550);
    if (btn) {
      btn.textContent = '🔇';
      btn.classList.remove('on');
    }
    try { localStorage.setItem(LS_KEY, '0'); } catch (e) {}
  }

  function toggle() {
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  }

  // === Init ===
  async function init() {
    // Не показываем на админке и в кабинете владельца
    const p = window.location.pathname;
    if (p.startsWith('/admin') || p.startsWith('/owner')) return;

    // Fetch звук для текущей страницы
    try {
      const r = await fetch('/api/sounds/active?page=' + encodeURIComponent(p + window.location.search));
      const data = await r.json();
      if (!data || !data.ok || !data.sound) return; // нет звука — не показываем кнопку
      soundData = data.sound;
    } catch (e) {
      return;
    }

    audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';

    createButton();

    // Если пользователь включал ранее — пробуем автозапуск
    let wasOn = false;
    try { wasOn = localStorage.getItem(LS_KEY) === '1'; } catch (e) {}

    if (wasOn) {
      // Автозапуск может быть заблокирован браузером — тогда покажем кнопку пульсирующей
      play();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
