/**
 * Basalt Tide — Shoreline Canvas (vanilla JS)
 * Draws interactive basalt pebble shore with animated tide cycle.
 */
(function () {
  'use strict';

  var BASALT_PALETTES = [
    '#0d1117', '#161b22', '#1f242c', '#282e38', '#1a1f26', '#2d333b'
  ];

  function Shoreline(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.timeOfDay = (options && options.timeOfDay) || 'morning';
    this.pebbles = [];
    this.ripples = [];
    this.foam = [];
    this.draggedPebble = null;
    this.animFrame = null;
    this.lastTime = performance.now();
    this.startTime = performance.now();
    this.cycleDuration = 9000;
    this.width = 0;
    this.height = 0;
    this.onTideUpdate = (options && options.onTideUpdate) || null;
    this.soundEngine = (options && options.soundEngine) || null;
    this.init();
  }

  Shoreline.prototype.init = function () {
    var self = this;
    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = self.canvas.getBoundingClientRect();
      self.width = rect.width;
      self.height = rect.height;
      self.canvas.width = rect.width * dpr;
      self.canvas.height = rect.height * dpr;
      self.initPebbles();
    };
    resize();
    window.addEventListener('resize', resize);
    this.bindPointer();
    this.render();
  };

  Shoreline.prototype.initPebbles = function () {
    var pebbles = [];
    var shoreStartY = this.height * 0.35;
    var count = Math.floor(Math.min(220, (this.width * this.height) / 4500));
    for (var i = 0; i < count; i++) {
      var normalizedY = Math.pow(Math.random(), 0.85);
      var y = shoreStartY + normalizedY * (this.height - shoreStartY - 30);
      var x = Math.random() * this.width;
      var sizeBase = 12 + Math.random() * 24 + (y / this.height) * 16;
      var aspect = 0.65 + Math.random() * 0.35;
      pebbles.push({
        x: x, y: y,
        radiusX: sizeBase,
        radiusY: sizeBase * aspect,
        rotation: Math.random() * Math.PI,
        baseColor: BASALT_PALETTES[Math.floor(Math.random() * BASALT_PALETTES.length)],
        specular: 0.3 + Math.random() * 0.5,
        wetness: Math.max(0.1, 1 - (y - shoreStartY) / (this.height - shoreStartY)),
        mass: sizeBase / 20,
        isDragging: false
      });
    }
    pebbles.sort(function (a, b) { return a.y - b.y; });
    this.pebbles = pebbles;
  };

  Shoreline.prototype.getLighting = function () {
    switch (this.timeOfDay) {
      case 'morning':
        return { sea: ['#1e3a5f','#2a4b7c','#48729e','#7ca5cc'], foam: 'rgba(235,245,255,0.85)', bedDark: '#0e1217', bedLight: '#181e26', glint: 'rgba(220,240,255,0.7)' };
      case 'noon':
        return { sea: ['#0f3254','#164875','#2a6a9e','#5ba2cf'], foam: 'rgba(255,255,255,0.95)', bedDark: '#11151b', bedLight: '#1e242d', glint: 'rgba(255,255,255,0.9)' };
      case 'sunset':
        return { sea: ['#1c1b38','#382848','#6a3652','#a65660'], foam: 'rgba(255,230,215,0.85)', bedDark: '#120f18', bedLight: '#241a29', glint: 'rgba(255,190,140,0.8)' };
      default:
        return { sea: ['#080e1a','#0d182b','#13233d','#1f3659'], foam: 'rgba(200,220,245,0.65)', bedDark: '#070a0e', bedLight: '#10151d', glint: 'rgba(160,200,240,0.5)' };
    }
  };

  Shoreline.prototype.render = function () {
    var self = this;
    var ctx = this.ctx;
    var now = performance.now();
    var dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.canvas.width / dpr;
    var h = this.canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var elapsed = (now - this.startTime) % this.cycleDuration;
    var phase = elapsed / this.cycleDuration;

    var tideProgress = 0;
    var stateName = 'Surge';
    if (phase < 0.45) {
      tideProgress = Math.sin((phase / 0.45) * (Math.PI / 2));
      stateName = 'Inflowing Surge';
    } else if (phase < 0.88) {
      var backPhase = (phase - 0.45) / 0.43;
      tideProgress = Math.cos(backPhase * (Math.PI / 2));
      stateName = 'Basalt Pebble Tumbling Backwash';
    } else {
      stateName = 'Tidal Rest';
    }

    if (this.onTideUpdate) this.onTideUpdate(phase, stateName);

    var colors = this.getLighting();
    var shoreBaseY = h * 0.40;
    var tideReach = h * 0.38;
    var waterFrontY = shoreBaseY + tideProgress * tideReach;

    this.drawShoreBed(colors, w, h, waterFrontY);
    this.updateAndDrawPebbles(colors, w, h, waterFrontY, tideProgress, phase, dt);
    this.drawOceanWaves(colors, w, h, waterFrontY, now, tideProgress);
    this.updateAndDrawFoam(waterFrontY, dt, w);
    this.drawRipples(dt);

    ctx.restore();
    this.animFrame = requestAnimationFrame(function () { self.render(); });
  };

  Shoreline.prototype.drawShoreBed = function (colors, w, h, waterY) {
    var ctx = this.ctx;
    var grad = ctx.createLinearGradient(0, h * 0.3, 0, h);
    grad.addColorStop(0, colors.bedDark);
    grad.addColorStop(1, colors.bedLight);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    var wetGrad = ctx.createLinearGradient(0, waterY - 40, 0, waterY + 40);
    wetGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
    wetGrad.addColorStop(0.5, 'rgba(30,50,70,0.25)');
    wetGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wetGrad;
    ctx.fillRect(0, waterY - 40, w, 80);
  };

  Shoreline.prototype.updateAndDrawPebbles = function (colors, w, h, waterFrontY, tideProgress, phase, dt) {
    var ctx = this.ctx;
    var isBackwash = phase > 0.45 && phase < 0.88;
    for (var i = 0; i < this.pebbles.length; i++) {
      var p = this.pebbles[i];
      var distFromWater = waterFrontY - p.y;
      var isSubmerged = distFromWater > 0;

      if (isSubmerged) {
        p.wetness = Math.min(1.0, p.wetness + dt * 4.0);
        if (isBackwash && !p.isDragging) {
          var pull = (1 / p.mass) * 12 * (1 - tideProgress);
          p.y += pull * dt;
          p.rotation += (Math.random() - 0.5) * 0.05;
        }
      } else {
        p.wetness = Math.max(0.2, p.wetness - dt * 0.03);
      }
      if (p.y > h - 20) p.y = h - 20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      ctx.beginPath();
      ctx.ellipse(2, 4, p.radiusX * 0.95, p.radiusY * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 0, p.radiusX, p.radiusY, 0, 0, Math.PI * 2);
      var stoneGrad = ctx.createRadialGradient(-p.radiusX * 0.25, -p.radiusY * 0.35, p.radiusX * 0.1, 0, 0, p.radiusX);
      if (p.wetness > 0.6) {
        stoneGrad.addColorStop(0, '#2d3748');
        stoneGrad.addColorStop(0.5, p.baseColor);
        stoneGrad.addColorStop(1, '#05070a');
      } else {
        stoneGrad.addColorStop(0, '#3f4753');
        stoneGrad.addColorStop(0.6, p.baseColor);
        stoneGrad.addColorStop(1, '#111419');
      }
      ctx.fillStyle = stoneGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,' + (0.04 * (1 - p.wetness)) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (p.wetness > 0.3) {
        ctx.beginPath();
        ctx.ellipse(-p.radiusX * 0.3, -p.radiusY * 0.35, p.radiusX * 0.35 * p.wetness, p.radiusY * 0.2 * p.wetness, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = colors.glint;
        ctx.globalAlpha = p.wetness * p.specular * 0.65;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();
    }
  };

  Shoreline.prototype.drawOceanWaves = function (colors, w, h, waterFrontY, time, tideProgress) {
    var ctx = this.ctx;
    var t = time * 0.002;
    var seaGrad = ctx.createLinearGradient(0, 0, 0, waterFrontY);
    seaGrad.addColorStop(0, colors.sea[0]);
    seaGrad.addColorStop(0.4, colors.sea[1]);
    seaGrad.addColorStop(0.8, colors.sea[2]);
    seaGrad.addColorStop(1, 'rgba(80,160,200,0.4)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, waterFrontY);
    var segments = 40;
    for (var i = 0; i <= segments; i++) {
      var x = (i / segments) * w;
      var waveNoise = Math.sin(x * 0.008 + t) * 14 + Math.sin(x * 0.02 - t * 1.5) * 8 + Math.cos(x * 0.004 + t * 0.6) * 18;
      var y = waterFrontY + waveNoise * (0.6 + tideProgress * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fillStyle = seaGrad;
    ctx.fill();

    ctx.fillStyle = 'rgba(180,225,245,0.08)';
    ctx.fill();

    ctx.beginPath();
    for (var j = 0; j <= segments; j++) {
      var x2 = (j / segments) * w;
      var waveNoise2 = Math.sin(x2 * 0.008 + t) * 14 + Math.sin(x2 * 0.02 - t * 1.5) * 8 + Math.cos(x2 * 0.004 + t * 0.6) * 18;
      var y2 = waterFrontY + waveNoise2 * (0.6 + tideProgress * 0.4);
      if (j === 0) ctx.moveTo(x2, y2);
      else ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = colors.foam;
    ctx.lineWidth = 4 + tideProgress * 8;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();
  };

  Shoreline.prototype.updateAndDrawFoam = function (waterFrontY, dt, w) {
    var ctx = this.ctx;
    if (Math.random() < 0.6) {
      this.foam.push({
        x: Math.random() * w,
        y: waterFrontY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 4,
        radius: 2 + Math.random() * 5,
        life: 1.0
      });
    }
    var surviving = [];
    for (var i = 0; i < this.foam.length; i++) {
      var b = this.foam[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 0.4;
      if (b.life > 0) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * b.life, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, b.life * 0.7) + ')';
        ctx.fill();
        surviving.push(b);
      }
    }
    this.foam = surviving.slice(-150);
  };

  Shoreline.prototype.drawRipples = function (dt) {
    var ctx = this.ctx;
    var surviving = [];
    for (var i = 0; i < this.ripples.length; i++) {
      var r = this.ripples[i];
      r.radius += dt * 75;
      r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
      if (r.alpha > 0) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (r.alpha * 0.4) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        surviving.push(r);
      }
    }
    this.ripples = surviving;
  };

  Shoreline.prototype.bindPointer = function () {
    var self = this;
    var rect = function () { return self.canvas.getBoundingClientRect(); };

    this.canvas.addEventListener('pointerdown', function (e) {
      var r = rect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;
      var found = null;
      for (var i = self.pebbles.length - 1; i >= 0; i--) {
        var p = self.pebbles[i];
        var dx = x - p.x;
        var dy = y - p.y;
        if ((dx * dx) / (p.radiusX * p.radiusX) + (dy * dy) / (p.radiusY * p.radiusY) <= 1) {
          found = p; break;
        }
      }
      if (found) {
        self.draggedPebble = { pebble: found, offsetX: x - found.x, offsetY: y - found.y };
        found.isDragging = true;
        found.wetness = Math.min(1.0, found.wetness + 0.3);
        if (self.soundEngine) self.soundEngine.triggerPebbleTap(0.85, found.radiusX / 30);
      } else {
        self.ripples.push({ x: x, y: y, radius: 5, maxRadius: 65, alpha: 0.8 });
        if (self.soundEngine) {
          self.soundEngine.triggerWaterSplash(0.5);
          self.soundEngine.triggerPebbleTap(0.3, 0.5);
        }
      }
    });

    this.canvas.addEventListener('pointermove', function (e) {
      if (!self.draggedPebble) return;
      var r = rect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;
      var p = self.draggedPebble.pebble;
      var prevX = p.x, prevY = p.y;
      p.x = x - self.draggedPebble.offsetX;
      p.y = y - self.draggedPebble.offsetY;
      var dist = Math.hypot(p.x - prevX, p.y - prevY);
      if (dist > 18 && Math.random() < 0.25 && self.soundEngine) {
        self.soundEngine.triggerPebbleTap(0.4, p.radiusX / 30);
      }
    });

    var up = function () {
      if (self.draggedPebble) {
        var p = self.draggedPebble.pebble;
        p.isDragging = false;
        if (self.soundEngine) self.soundEngine.triggerPebbleTap(0.7, p.radiusX / 30);
        self.draggedPebble = null;
      }
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('pointerleave', up);
  };

  window.Shoreline = Shoreline;
})();
