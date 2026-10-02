/**
 * Basalt Tide — Ocean Vista (vanilla JS)
 * Procedural top-down ocean horizon with layered wave crests.
 */
(function () {
  'use strict';

  var VISTA_PALETTES = {
    morning: { skyTop: '#c8dce8', skyBot: '#f4d8c0', horizon: '#3d5a75', water1: '#1a3a5c', water2: '#2d5a8a', water3: '#4a7ba8', crest: 'rgba(255, 255, 255, 0.55)', sun: 'rgba(255, 230, 200, 0.35)' },
    noon:    { skyTop: '#87ceeb', skyBot: '#d4ecf6', horizon: '#4a6b87', water1: '#0f3c66', water2: '#1d5b8f', water3: '#3a82b8', crest: 'rgba(255, 255, 255, 0.7)', sun: 'rgba(255, 255, 255, 0.4)' },
    sunset:  { skyTop: '#3a2a4d', skyBot: '#e08a5a', horizon: '#6a3a4a', water1: '#1a1530', water2: '#3a2048', water3: '#6a3a5a', crest: 'rgba(255, 200, 170, 0.65)', sun: 'rgba(255, 180, 130, 0.55)' },
    twilight:{ skyTop: '#0a1020', skyBot: '#1a2840', horizon: '#1f2d47', water1: '#050a14', water2: '#0d182b', water3: '#1a2c48', crest: 'rgba(180, 210, 240, 0.5)', sun: 'rgba(140, 180, 220, 0.25)' }
  };

  function Vista(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.timeOfDay = (options && options.timeOfDay) || 'twilight';
    this.animFrame = null;
    this.time = 0;
    this.width = 0;
    this.height = 0;
    this.init();
  }

  Vista.prototype.init = function () {
    var self = this;
    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = self.canvas.getBoundingClientRect();
      self.width = rect.width;
      self.height = rect.height;
      self.canvas.width = rect.width * dpr;
      self.canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    this.render();
  };

  Vista.prototype.render = function () {
    var self = this;
    var ctx = this.ctx;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.canvas.width / dpr;
    var h = this.canvas.height / dpr;
    var pal = VISTA_PALETTES[this.timeOfDay] || VISTA_PALETTES.twilight;

    this.time += 0.015;
    var t = this.time;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var horizonY = h * 0.42;

    // Sky
    var skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Sun glow
    var sunX = w * 0.72;
    var sunY = horizonY * 0.55;
    var sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, horizonY * 0.9);
    sunGrad.addColorStop(0, pal.sun);
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Ocean base
    var seaGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    seaGrad.addColorStop(0, pal.water1);
    seaGrad.addColorStop(0.5, pal.water2);
    seaGrad.addColorStop(1, pal.water3);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Horizon line (crisp)
    ctx.strokeStyle = pal.crest;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();

    // Distant volcanic mountain silhouettes on the horizon
    drawMountains(ctx, w, horizonY, pal, t);

    // Layered wave lines (perspective: closer = wider)
    var lines = 28;
    for (var i = 0; i < lines; i++) {
      var progress = i / lines;
      var y = horizonY + progress * (h - horizonY);
      var waveScale = Math.pow(progress, 1.6);
      var waveSpeed = 1.0 + progress * 0.6;

      ctx.beginPath();
      var segments = 30;
      for (var s = 0; s <= segments; s++) {
        var x = (s / segments) * w;
        var wave =
          Math.sin(x * 0.015 + t * waveSpeed + i * 0.4) * (2 + waveScale * 8) +
          Math.cos(x * 0.03 - t * 0.8) * (1 + waveScale * 5);
        if (s === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      var alpha = 0.04 + waveScale * 0.16;
      ctx.strokeStyle = 'rgba(220, 240, 255, ' + alpha + ')';
      ctx.lineWidth = 0.8 + waveScale * 2.2;
      ctx.stroke();
    }

    // Sun glint path on water
    ctx.beginPath();
    var glintSegments = 20;
    for (var g = 0; g <= glintSegments; g++) {
      var gy = horizonY + (g / glintSegments) * (h - horizonY);
      var gx = sunX + Math.sin(t * 1.2 + g * 0.7) * (g * 2.5);
      var gwidth = 6 + g * 3;
      ctx.moveTo(gx - gwidth, gy);
      ctx.lineTo(gx + gwidth, gy);
    }
    ctx.strokeStyle = pal.sun;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    ctx.restore();
    this.animFrame = requestAnimationFrame(function () { self.render(); });
  };

  function drawMountains(ctx, w, horizonY, pal, t) {
    // Две группы гор: дальняя (светлее) и ближняя (темнее)
    var layers = [
      { color: pal.horizon, alpha: 0.55, height: 0.06, offset: 0.0, seed: 1 },
      { color: pal.horizon, alpha: 0.85, height: 0.09, offset: 0.15, seed: 7 }
    ];

    for (var li = 0; li < layers.length; li++) {
      var layer = layers[li];
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 2);

      var peaks = 9 + li * 3;
      for (var i = 0; i <= peaks; i++) {
        var x = (i / peaks) * w;
        // Псевдо-случайный рельеф, стабильный по seed
        var n1 = Math.sin(i * 1.7 + layer.seed) * 0.5 + 0.5;
        var n2 = Math.sin(i * 3.3 + layer.seed * 2) * 0.5 + 0.5;
        var n3 = Math.sin(i * 0.7 + layer.seed * 3) * 0.5 + 0.5;
        var relief = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
        // Пики выше в середине кадра
        var centerBoost = 1 - Math.abs((i / peaks) - 0.5) * 1.4;
        if (centerBoost < 0.3) centerBoost = 0.3;
        var peakH = layer.height * horizonY * relief * centerBoost * 1.8;
        // Мелкая пульсация — дымка тумана
        peakH += Math.sin(t * 0.4 + i + layer.seed) * 1.5;

        var y = horizonY - peakH;
        if (i === 0) ctx.lineTo(x, y);
        else {
          // Плавная кривая через quadraticCurveTo
          var prevX = ((i - 1) / peaks) * w;
          var midX = (prevX + x) / 2;
          ctx.quadraticCurveTo(prevX + (x - prevX) * 0.3, y + peakH * 0.15, x, y);
        }
      }
      ctx.lineTo(w, horizonY + 2);
      ctx.closePath();
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.color;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Лёгкая дымка над горами
    var mistGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 4);
    mistGrad.addColorStop(0, 'rgba(0,0,0,0)');
    mistGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, horizonY - 30, w, 34);
  }

  Vista.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  };

  Vista.prototype.stop = function () {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  };

  window.Vista = Vista;
})();
