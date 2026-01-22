import { GM_SOUNDFONT_NAMES, isDrumChannel } from './gm.js';

const PRIMARY_SOUNDFONT_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const FALLBACK_SOUNDFONT_BASE = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts/FluidR3_GM/';
const SOUNDFONT_PLAYER_URL = 'https://cdn.jsdelivr.net/npm/soundfont-player/+esm';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeBaseUrl = (url) => (url.endsWith('/') ? url : `${url}/`);

export default class SoundfontEngine {
  constructor({ baseUrl = PRIMARY_SOUNDFONT_BASE, fallbackUrl = FALLBACK_SOUNDFONT_BASE, format = 'mp3' } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fallbackUrl = normalizeBaseUrl(fallbackUrl);
    this.format = format;
    this.ctx = null;
    this.destination = null;
    this.masterGain = null;
    this.player = null;
    this.playerPromise = null;
    this.instrumentCache = new Map();
    this.loadingPromises = new Map();
    this.channelPrograms = new Map();
    this.channelVolumes = new Map();
    this.drumInstrument = null;
    this.drumPromise = null;
    this.error = null;
  }

  initAudio({ audioContext = null, destination = null } = {}) {
    if (!this.ctx) {
      this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(destination || this.ctx.destination);
    } else if (destination && destination !== this.destination) {
      this.masterGain.disconnect();
      this.masterGain.connect(destination);
    }
    this.destination = destination || this.ctx.destination;
    return this.ctx;
  }

  setMasterVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.value = clamp(value ?? 1, 0, 1);
    }
  }

  setChannelVolume(channel, value) {
    this.channelVolumes.set(channel, clamp(value ?? 1, 0, 1));
  }

  setProgram(program, channel = 0) {
    this.channelPrograms.set(channel, program);
  }

  setBaseUrl(url) {
    if (!url) return;
    this.baseUrl = normalizeBaseUrl(url);
    this.reset();
  }

  setFallbackUrl(url) {
    if (!url) return;
    this.fallbackUrl = normalizeBaseUrl(url);
  }

  reset() {
    this.instrumentCache.clear();
    this.loadingPromises.clear();
    this.drumInstrument = null;
    this.drumPromise = null;
    this.error = null;
  }

  getStatus() {
    return {
      ready: Boolean(this.player),
      loading: this.loadingPromises.size > 0 || Boolean(this.playerPromise) || Boolean(this.drumPromise),
      error: this.error,
      baseUrl: this.baseUrl,
      fallbackUrl: this.fallbackUrl
    };
  }

  async ensurePlayer() {
    if (this.player) return this.player;
    if (this.playerPromise) return this.playerPromise;
    this.playerPromise = import(SOUNDFONT_PLAYER_URL)
      .then((module) => {
        this.player = module.default || module;
        this.error = null;
        return this.player;
      })
      .catch((error) => {
        this.error = 'Failed to load SoundFont player.';
        throw error;
      })
      .finally(() => {
        this.playerPromise = null;
      });
    return this.playerPromise;
  }

  buildUrl(baseUrl, name, format) {
    return `${baseUrl}${name}-${format}.js`;
  }

  getProgramName(program) {
    return GM_SOUNDFONT_NAMES[program] || GM_SOUNDFONT_NAMES[0];
  }

  loadInstrument(program) {
    const name = this.getProgramName(program);
    return this.loadInstrumentByName(String(program), name);
  }

  loadDrumKit() {
    if (this.drumInstrument) return Promise.resolve(this.drumInstrument);
    if (this.drumPromise) return this.drumPromise;
    this.drumPromise = this.loadInstrumentByName('drum-kit', 'standard_kit')
      .then((instrument) => {
        this.drumInstrument = instrument;
        return instrument;
      })
      .finally(() => {
        this.drumPromise = null;
      });
    return this.drumPromise;
  }

  loadInstrumentByName(key, name) {
    if (this.instrumentCache.has(key)) {
      return Promise.resolve(this.instrumentCache.get(key));
    }
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }
    const promise = this.ensurePlayer()
      .then(() => {
        return this.player.instrument(this.ctx, name, {
          format: this.format,
          destination: this.masterGain || this.destination,
          nameToUrl: (instrumentName, soundfont, format) => this.buildUrl(this.baseUrl, instrumentName, format)
        });
      })
      .catch(() => {
        return this.ensurePlayer().then(() => this.player.instrument(this.ctx, name, {
          format: this.format,
          destination: this.masterGain || this.destination,
          nameToUrl: (instrumentName, soundfont, format) => this.buildUrl(this.fallbackUrl, instrumentName, format)
        }));
      })
      .then((instrument) => {
        if (!instrument) {
          this.error = `Failed to load SoundFont: ${name}`;
          return null;
        }
        this.instrumentCache.set(key, instrument);
        this.error = null;
        return instrument;
      })
      .catch((error) => {
        this.error = `SoundFont load error: ${name}`;
        throw error;
      })
      .finally(() => {
        this.loadingPromises.delete(key);
      });
    this.loadingPromises.set(key, promise);
    return promise;
  }

  noteOn(midiNote, velocity = 0.8, time = null, durationSeconds = 0.25, channel = 0) {
    if (!this.ctx) return Promise.resolve(null);
    const when = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    const volume = clamp(velocity ?? 1, 0, 1) * (this.channelVolumes.get(channel) ?? 1);
    const playNote = (instrument) => {
      if (!instrument?.play) return null;
      return instrument.play(midiNote, when, { gain: volume, duration: durationSeconds });
    };
    if (isDrumChannel(channel)) {
      return this.loadDrumKit().then(playNote);
    }
    const program = this.channelPrograms.get(channel) ?? 0;
    return this.loadInstrument(program).then(playNote);
  }
}
