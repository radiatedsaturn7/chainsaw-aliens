export default class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.4;
    this.revOsc = null;
    this.revGain = null;
    this.revActive = false;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
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

  damage() {
    this.tone(80, 0.12, 'square');
    this.noise(0.08, 0.1);
  }

  pickup() {
    this.tone(520, 0.08, 'triangle');
    this.tone(700, 0.06, 'triangle');
  }

  interact() {
    this.tone(360, 0.08, 'triangle');
  }

  menu() {
    this.tone(300, 0.06, 'triangle');
  }

  setRev(active, intensity = 0.4) {
    if (active) {
      this.ensure();
    }
    if (active && !this.revActive) {
      this.revOsc = this.ctx.createOscillator();
      this.revGain = this.ctx.createGain();
      this.revOsc.type = 'sawtooth';
      this.revOsc.frequency.value = 80;
      this.revGain.gain.value = 0.0001;
      this.revOsc.connect(this.revGain);
      this.revGain.connect(this.master);
      this.revOsc.start();
    }
    if (active) {
      const now = this.ctx.currentTime;
      this.revGain.gain.exponentialRampToValueAtTime(Math.max(0.08, intensity), now + 0.05);
      this.revOsc.frequency.setTargetAtTime(80 + intensity * 220, now, 0.05);
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
