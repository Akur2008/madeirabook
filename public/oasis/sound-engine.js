/**
 * Basalt Tide — Procedural Web Audio Engine (vanilla JS)
 * Ocean swell & rolling basalt pebbles synthesizer.
 */
(function () {
  'use strict';

  function BasaltSoundEngine() {
    this.ctx = null;
    this.isInitialized = false;

    this.masterGain = null;
    this.waveGain = null;
    this.pebbleGain = null;
    this.foamGain = null;
    this.windGain = null;
    this.droneGain = null;

    this.waveFilter = null;
    this.swellLFO = null;
    this.swellLFOGain = null;
    this.pebbleFrictionGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;

    this.pebbleIntervalId = null;
    this.waveCyclePhase = 0;

    this.settings = {
      masterVolume: 0.35,
      waveSwell: 0.8,
      pebbleRoll: 0.9,
      seaFoam: 0.5,
      coastalWind: 0.4,
      zenDrone: 0.1,
      isPlaying: false
    };
  }

  BasaltSoundEngine.prototype.initContext = function () {
    if (this.ctx && this.isInitialized) return;
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    var ctx = this.ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = this.settings.waveSwell;
    this.waveGain.connect(this.masterGain);

    this.pebbleGain = ctx.createGain();
    this.pebbleGain.gain.value = this.settings.pebbleRoll;
    this.pebbleGain.connect(this.masterGain);

    this.foamGain = ctx.createGain();
    this.foamGain.gain.value = this.settings.seaFoam;
    this.foamGain.connect(this.masterGain);

    this.windGain = ctx.createGain();
    this.windGain.gain.value = this.settings.coastalWind;
    this.windGain.connect(this.masterGain);

    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = this.settings.zenDrone;
    this.droneGain.connect(this.masterGain);

    this.setupWaveGenerator();
    this.setupFoamGenerator();
    this.setupWindGenerator();
    this.setupDroneGenerator();
    this.setupPebbleGenerator();

    this.isInitialized = true;
  };

  BasaltSoundEngine.prototype.createNoiseBuffer = function (durationSeconds) {
    durationSeconds = durationSeconds || 5;
    var bufferSize = this.ctx.sampleRate * durationSeconds;
    var buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var output = buffer.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < bufferSize; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  };

  BasaltSoundEngine.prototype.setupWaveGenerator = function () {
    var ctx = this.ctx;
    var noiseBuffer = this.createNoiseBuffer(6);
    var noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.waveFilter = ctx.createBiquadFilter();
    this.waveFilter.type = 'lowpass';
    this.waveFilter.frequency.setValueAtTime(140, ctx.currentTime);
    this.waveFilter.Q.setValueAtTime(3, ctx.currentTime);

    this.swellLFO = ctx.createOscillator();
    this.swellLFO.frequency.setValueAtTime(1 / 9.0, ctx.currentTime);

    this.swellLFOGain = ctx.createGain();
    this.swellLFOGain.gain.setValueAtTime(450, ctx.currentTime);

    this.swellLFO.connect(this.swellLFOGain);
    this.swellLFOGain.connect(this.waveFilter.frequency);

    var swellVolGain = ctx.createGain();
    swellVolGain.gain.setValueAtTime(0.5, ctx.currentTime);
    this.swellLFOGain.connect(swellVolGain.gain);

    noiseSource.connect(this.waveFilter);
    this.waveFilter.connect(this.waveGain);

    noiseSource.start();
    this.swellLFO.start();
  };

  BasaltSoundEngine.prototype.setupFoamGenerator = function () {
    var ctx = this.ctx;
    var noiseBuffer = this.createNoiseBuffer(5);
    var noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    var foamVolLFO = ctx.createOscillator();
    foamVolLFO.frequency.setValueAtTime(1 / 9.0, ctx.currentTime);
    var foamLFOGain = ctx.createGain();
    foamLFOGain.gain.setValueAtTime(0.3, ctx.currentTime);

    var foamAmp = ctx.createGain();
    foamAmp.gain.setValueAtTime(0.2, ctx.currentTime);

    foamVolLFO.connect(foamLFOGain);
    foamLFOGain.connect(foamAmp.gain);

    noiseSource.connect(filter);
    filter.connect(foamAmp);
    foamAmp.connect(this.foamGain);

    noiseSource.start();
    foamVolLFO.start();
  };

  BasaltSoundEngine.prototype.setupWindGenerator = function () {
    var ctx = this.ctx;
    var noiseBuffer = this.createNoiseBuffer(7);
    var noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    var bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(320, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(this.windGain);
    noiseSource.start();
  };

  BasaltSoundEngine.prototype.setupDroneGenerator = function () {
    var ctx = this.ctx;
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(216, ctx.currentTime);

    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(432, ctx.currentTime);

    var droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(600, ctx.currentTime);

    var subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.15, ctx.currentTime);

    this.droneOsc1.connect(droneFilter);
    this.droneOsc2.connect(droneFilter);
    droneFilter.connect(subGain);
    subGain.connect(this.droneGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
  };

  BasaltSoundEngine.prototype.setupPebbleGenerator = function () {
    var ctx = this.ctx;
    var noiseBuffer = this.createNoiseBuffer(4);
    var noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    var pebbleBandpass = ctx.createBiquadFilter();
    pebbleBandpass.type = 'bandpass';
    pebbleBandpass.frequency.setValueAtTime(1400, ctx.currentTime);
    pebbleBandpass.Q.setValueAtTime(2.5, ctx.currentTime);

    this.pebbleFrictionGain = ctx.createGain();
    this.pebbleFrictionGain.gain.setValueAtTime(0.05, ctx.currentTime);

    noiseSource.connect(pebbleBandpass);
    pebbleBandpass.connect(this.pebbleFrictionGain);
    this.pebbleFrictionGain.connect(this.pebbleGain);

    noiseSource.start();
    this.startPebbleGranularScheduler();
  };

  BasaltSoundEngine.prototype.startPebbleGranularScheduler = function () {
    var self = this;
    if (this.pebbleIntervalId) clearInterval(this.pebbleIntervalId);

    var waveCycleDuration = 9000;
    var startTime = Date.now();

    this.pebbleIntervalId = window.setInterval(function () {
      if (!self.ctx || !self.settings.isPlaying || !self.pebbleGain) return;
      var elapsed = (Date.now() - startTime) % waveCycleDuration;
      var phase = elapsed / waveCycleDuration;
      self.waveCyclePhase = phase;

      var rollingIntensity = 0;
      if (phase > 0.42 && phase < 0.88) {
        var bell = Math.sin(((phase - 0.42) / (0.88 - 0.42)) * Math.PI);
        rollingIntensity = Math.pow(bell, 1.4);
      } else if (phase > 0.15 && phase <= 0.42) {
        rollingIntensity = 0.2 * Math.sin(((phase - 0.15) / (0.42 - 0.15)) * Math.PI);
      }

      if (self.pebbleFrictionGain && self.ctx) {
        var targetFriction = rollingIntensity * 0.28 * self.settings.pebbleRoll;
        self.pebbleFrictionGain.gain.setTargetAtTime(targetFriction, self.ctx.currentTime, 0.08);
      }

      if (rollingIntensity > 0.05 && Math.random() < rollingIntensity * 0.95) {
        var count = 1 + Math.floor(Math.random() * 3 * rollingIntensity);
        for (var i = 0; i < count; i++) {
          (function () {
            var delayMs = Math.random() * 60;
            setTimeout(function () {
              if (self.settings.isPlaying) {
                self.synthesizePebbleClick(rollingIntensity * (0.4 + Math.random() * 0.6));
              }
            }, delayMs);
          })();
        }
      }
    }, 45);
  };

  BasaltSoundEngine.prototype.synthesizePebbleClick = function (intensity, customFreq) {
    intensity = intensity || 0.5;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();

    var baseFreq = customFreq || (900 + Math.random() * 1500);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, ctx.currentTime + 0.035);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    filter.Q.setValueAtTime(4 + Math.random() * 5, ctx.currentTime);

    var clickVol = Math.min(0.8, intensity * 0.45 * this.settings.pebbleRoll);
    gain.gain.setValueAtTime(clickVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04 + Math.random() * 0.03);

    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.random() * 1.8 - 0.9, ctx.currentTime);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.pebbleGain);
    } else {
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.pebbleGain);
    }

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  };

  BasaltSoundEngine.prototype.triggerPebbleTap = function (intensity, size) {
    intensity = intensity || 0.7;
    size = size || 1.0;
    if (!this.isInitialized) this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    var freq = 650 + (1 - Math.min(1, Math.max(0, size))) * 1600;
    this.synthesizePebbleClick(intensity * 1.4, freq);
  };

  BasaltSoundEngine.prototype.triggerWaterSplash = function (intensity) {
    intensity = intensity || 0.5;
    if (!this.ctx || !this.foamGain) return;
    var ctx = this.ctx;
    var noiseBuffer = this.createNoiseBuffer(0.5);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.foamGain);
    src.start();
    src.stop(ctx.currentTime + 0.4);
  };

  BasaltSoundEngine.prototype.start = function () {
    var self = this;
    this.initContext();
    if (!this.ctx || !this.masterGain) return Promise.resolve();
    var resumePromise = this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
    return resumePromise.then(function () {
      self.masterGain.gain.cancelScheduledValues(self.ctx.currentTime);
      self.masterGain.gain.setValueAtTime(self.masterGain.gain.value, self.ctx.currentTime);
      self.masterGain.gain.linearRampToValueAtTime(self.settings.masterVolume, self.ctx.currentTime + 1.2);
      self.settings.isPlaying = true;
    });
  };

  BasaltSoundEngine.prototype.stop = function () {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    this.settings.isPlaying = false;
  };

  BasaltSoundEngine.prototype.getWavePhase = function () {
    return this.waveCyclePhase;
  };

  window.basaltSoundEngine = new BasaltSoundEngine();
})();
