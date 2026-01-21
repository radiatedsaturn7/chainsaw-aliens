export default class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.4;
    this.revOsc = null;
    this.revGain = null;
    this.revActive = false;
    this.midiBus = null;
    this.midiLimiter = null;
    this.midiReverb = null;
    this.midiSamples = null;
    this.midiVoices = [];
    this.midiVoiceLimit = 16;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
  }

  ensureMidiSampler() {
    this.ensure();
    if (this.midiBus) return;
    this.midiBus = this.ctx.createGain();
    this.midiBus.gain.value = 0.8;
    this.midiLimiter = this.ctx.createDynamicsCompressor();
    this.midiLimiter.threshold.value = -12;
    this.midiLimiter.knee.value = 8;
    this.midiLimiter.ratio.value = 6;
    this.midiLimiter.attack.value = 0.002;
    this.midiLimiter.release.value = 0.12;
    this.midiBus.connect(this.midiLimiter);
    this.midiLimiter.connect(this.master);
    this.midiReverb = this.ctx.createConvolver();
    this.midiReverb.buffer = this.buildImpulseResponse(1.4, 2.5);
    this.midiReverb.connect(this.midiLimiter);
    this.midiSamples = this.buildMidiSamples();
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) {
      this.master.gain.value = value;
    }
  }

  tone(freq, duration = 0.12, type = 'sawtooth') {
    this.ensure();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    const now = this.ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.stop(now + duration + 0.02);
  }

  buildImpulseResponse(duration, decay) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * ((1 - i / length) ** decay);
      }
    }
    return impulse;
  }

  buildMidiSamples() {
    return {
      lead: this.createWaveSample('sawtooth', 1.2, 0.02, 0.2, 0.6, 0.4, 72),
      bass: this.createWaveSample('square', 1.1, 0.01, 0.12, 0.6, 0.25, 48),
      guitar: this.createWaveSample('sawtooth', 1.0, 0.02, 0.12, 0.55, 0.28, 64),
      pad: this.createWaveSample('triangle', 1.4, 0.08, 0.2, 0.7, 0.5, 60),
      keys: this.createWaveSample('triangle', 1.0, 0.02, 0.1, 0.5, 0.3, 64),
      kick: this.createDrumSample('kick', 0.5),
      snare: this.createDrumSample('snare', 0.4),
      hat: this.createDrumSample('hat', 0.2),
      tom: this.createDrumSample('tom', 0.4),
      crash: this.createDrumSample('crash', 1.0)
    };
  }

  createWaveSample(type, duration, attack, decay, sustain, release, baseNote) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const frequency = 440 * (2 ** ((baseNote - 69) / 12));
    for (let i = 0; i < length; i += 1) {
      const t = i / this.ctx.sampleRate;
      let sample = 0;
      if (type === 'square') {
        sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
      } else if (type === 'sawtooth') {
        sample = 2 * (t * frequency - Math.floor(0.5 + t * frequency));
      } else if (type === 'triangle') {
        sample = 2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1;
      } else {
        sample = Math.sin(2 * Math.PI * frequency * t);
      }
      const env = this.envelopeAt(t, duration, attack, decay, sustain, release);
      data[i] = sample * env;
    }
    return { buffer, baseNote };
  }

  createDrumSample(type, duration) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const t = i / this.ctx.sampleRate;
      const noise = (Math.random() * 2 - 1) * (1 - t / duration);
      if (type === 'kick') {
        const freq = 120 * (1 - t / duration) + 40;
        data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - t / duration);
      } else if (type === 'tom') {
        const freq = 220 * (1 - t / duration) + 80;
        data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - t / duration) * 0.7 + noise * 0.2;
      } else if (type === 'snare') {
        data[i] = noise * 0.8;
      } else if (type === 'hat') {
        data[i] = noise * 0.4;
      } else if (type === 'crash') {
        data[i] = noise * 0.6;
      }
    }
    return { buffer, baseNote: 60 };
  }

  envelopeAt(t, duration, attack, decay, sustain, release) {
    if (t < attack) return t / attack;
    if (t < attack + decay) {
      const decayProgress = (t - attack) / decay;
      return 1 - (1 - sustain) * decayProgress;
    }
    if (t < duration - release) return sustain;
    const releaseProgress = (t - (duration - release)) / release;
    return sustain * (1 - releaseProgress);
  }

  getMidiPreset(instrument) {
    const presets = {
      piano: { type: 'triangle', attack: 0.01, decay: 0.18, sustain: 0.35, release: 0.25, filter: 1800 },
      organ: { type: 'sine', attack: 0.02, decay: 0.05, sustain: 0.85, release: 0.3, filter: 2200 },
      strings: { type: 'sawtooth', attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4, filter: 1400 },
      bass: { type: 'square', attack: 0.02, decay: 0.12, sustain: 0.5, release: 0.2, filter: 900 },
      'synth-lead': { type: 'sawtooth', attack: 0.01, decay: 0.08, sustain: 0.6, release: 0.2, filter: 2000 },
      'synth-pad': { type: 'triangle', attack: 0.08, decay: 0.18, sustain: 0.7, release: 0.4, filter: 1600 },
      sine: { type: 'sine', attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
      triangle: { type: 'triangle', attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.2 },
      square: { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.18 },
      sawtooth: { type: 'sawtooth', attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.2 }
    };
    return presets[instrument] || presets.sine;
  }

  playMidiNote(pitch, instrument = 'piano', duration = 0.5) {
    this.ensure();
    const freq = 440 * (2 ** ((pitch - 69) / 12));
    const preset = this.getMidiPreset(instrument);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = preset.type || 'sine';
    osc.frequency.value = freq;
    let output = osc;
    if (preset.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset.filter;
      output.connect(filter);
      filter.connect(gain);
    } else {
      output.connect(gain);
    }
    gain.connect(this.master);
    const now = this.ctx.currentTime;
    const attack = preset.attack ?? 0.01;
    const decay = preset.decay ?? 0.1;
    const sustain = preset.sustain ?? 0.6;
    const release = preset.release ?? 0.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.3 * sustain, now + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);
    osc.start(now);
    osc.stop(now + duration + release + 0.02);
  }

  playSampledNote({ pitch = 60, duration = 0.4, volume = 0.8, instrument = 'lead' }) {
    this.ensureMidiSampler();
    const sample = this.midiSamples[instrument] || this.midiSamples.lead;
    if (!sample?.buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = sample.buffer;
    const isDrum = ['kick', 'snare', 'hat', 'tom', 'crash'].includes(instrument);
    const rate = isDrum ? 1 : 2 ** ((pitch - sample.baseNote) / 12);
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 9000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.midiBus);
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.2;
    gain.connect(reverbSend);
    reverbSend.connect(this.midiReverb);
    const now = this.ctx.currentTime;
    source.start(now);
    source.stop(now + duration + 0.1);
    this.registerMidiVoice(source, gain, now + duration + 0.12);
  }

  registerMidiVoice(source, gain, stopTime) {
    this.midiVoices.push({ source, gain, stopTime });
    if (this.midiVoices.length > this.midiVoiceLimit) {
      const oldest = this.midiVoices.shift();
      if (oldest) {
        try {
          oldest.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
          oldest.source.stop();
        } catch (error) {
          // ignore
        }
      }
    }
    this.midiVoices = this.midiVoices.filter((voice) => voice.stopTime > this.ctx.currentTime);
  }

  noise(duration = 0.12, gainValue = 0.12) {
    this.ensure();
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  rumble() {
    this.tone(60, 0.2, 'square');
    this.tone(120, 0.2, 'sawtooth');
  }

  ping() {
    this.tone(420, 0.1, 'triangle');
  }

  ui() {
    this.tone(340, 0.06, 'triangle');
  }

  showcase() {
    this.tone(520, 0.18, 'triangle');
    window.setTimeout(() => this.tone(520, 0.12, 'triangle'), 120);
    window.setTimeout(() => this.tone(420, 0.1, 'triangle'), 220);
  }

  footstep() {
    this.tone(140, 0.08, 'square');
  }

  jump() {
    this.tone(520, 0.12, 'triangle');
  }

  land() {
    this.tone(120, 0.1, 'square');
    this.noise(0.06, 0.08);
  }

  dash() {
    this.tone(320, 0.08, 'sawtooth');
  }

  bite() {
    this.tone(200, 0.08, 'square');
  }

  hit() {
    this.tone(180, 0.07, 'square');
  }

  stagger() {
    this.tone(90, 0.1, 'triangle');
  }

  execute() {
    this.tone(140, 0.14, 'sawtooth');
    this.tone(480, 0.06, 'triangle');
    this.noise(0.12, 0.16);
  }

  explosion() {
    this.tone(70, 0.3, 'square');
    this.tone(110, 0.25, 'sawtooth');
    this.noise(0.22, 0.2);
  }

  damage() {
    this.tone(80, 0.12, 'square');
    this.noise(0.08, 0.1);
  }

  pickup() {
    const duration = 0.08;
    this.tone(520, duration, 'triangle');
    this.tone(700, 0.06, 'triangle');
    return duration;
  }

  download() {
    this.ensure();
    this.noise(0.18, 0.12);
    this.tone(320, 0.08, 'triangle');
    window.setTimeout(() => this.tone(460, 0.1, 'triangle'), 120);
    window.setTimeout(() => this.noise(0.08, 0.08), 180);
  }

  lowHealthAlarm() {
    this.ensure();
    this.tone(520, 0.12, 'square');
    this.tone(260, 0.18, 'sawtooth');
    this.noise(0.12, 0.1);
  }

  save() {
    this.tone(520, 0.12, 'triangle');
    this.tone(620, 0.1, 'triangle');
    this.noise(0.06, 0.06);
  }

  interact() {
    this.tone(360, 0.08, 'triangle');
  }

  ignitirBlast() {
    this.tone(90, 0.4, 'square');
    this.tone(160, 0.32, 'sawtooth');
    this.noise(0.3, 0.22);
  }

  ignitirReady() {
    this.tone(640, 0.14, 'triangle');
    this.tone(880, 0.1, 'triangle');
  }

  ignitirDud() {
    this.tone(220, 0.08, 'square');
    this.tone(140, 0.12, 'sawtooth');
    this.noise(0.08, 0.12);
  }

  flamethrower() {
    this.tone(80, 0.28, 'sawtooth');
    this.tone(120, 0.22, 'triangle');
    this.noise(0.2, 0.12);
  }

  menu() {
    this.tone(300, 0.06, 'triangle');
  }

  spawnTune() {
    this.ensure();
    const notes = [392, 523, 659, 784, 659, 523, 494, 587, 659, 523];
    const interval = 300;
    notes.forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.18, 'triangle'), index * interval);
    });
  }

  setRev(active, intensity = 0.4) {
    if (active) {
      this.ensure();
    }
    if (active && !this.revActive) {
      this.revOsc = this.ctx.createOscillator();
      this.revGain = this.ctx.createGain();
      this.revOsc.type = 'sawtooth';
      this.revOsc.frequency.value = 110;
      this.revGain.gain.value = 0.0001;
      this.revOsc.connect(this.revGain);
      this.revGain.connect(this.master);
      this.revOsc.start();
    }
    if (active) {
      const now = this.ctx.currentTime;
      this.revGain.gain.exponentialRampToValueAtTime(Math.max(0.12, intensity), now + 0.03);
      this.revOsc.frequency.setTargetAtTime(110 + intensity * 320, now, 0.02);
    }
    if (!active && this.revActive && this.revGain) {
      const now = this.ctx.currentTime;
      this.revGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      this.revOsc.stop(now + 0.1);
      this.revOsc = null;
      this.revGain = null;
    }
    this.revActive = active;
  }
}
