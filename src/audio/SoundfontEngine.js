import { GM_DRUM_BANK_MSB, GM_SOUNDFONT_NAMES, isDrumChannel } from './gm.js';

const PRIMARY_SOUNDFONT_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const FALLBACK_SOUNDFONT_BASE = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts/FluidR3_GM/';
const SOUNDFONT_PLAYER_GLOBAL = 'Soundfont';
// FluidR3_GM does not ship dedicated drum kit soundfonts, so use a drum-ish fallback.
const DRUM_KIT_NAME = 'synth_drum';
const DRUM_KIT_FALLBACK_NAME = 'synth_drum';
const LOCAL_SOUNDFONT_BASE = 'vendor/soundfonts/FluidR3_GM/';
const LOCAL_SOUNDFONTS = new Set(['synth_drum']);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeBaseUrl = (url) => (url.endsWith('/') ? url : `${url}/`);
const resolveDrumKitKey = (kitName, bank = GM_DRUM_BANK_MSB) => `drum-kit:${bank}:${kitName}`;

export default class SoundfontEngine {
  constructor({
    baseUrl = PRIMARY_SOUNDFONT_BASE,
    fallbackUrl = FALLBACK_SOUNDFONT_BASE,
    format = 'mp3',
    drumKitFallbackName = DRUM_KIT_FALLBACK_NAME,
    debug = true
  } = {}) {
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
    this.drumKitName = DRUM_KIT_NAME;
    this.drumKitFallbackName = drumKitFallbackName;
    this.error = null;
    this.lastError = null;
    this.lastUrl = null;
    this.debug = Boolean(debug);
    this.localBaseUrl = LOCAL_SOUNDFONT_BASE;
    this.localSoundfonts = new Set(LOCAL_SOUNDFONTS);
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

  setDrumKitName(name) {
    if (name) {
      this.drumKitName = name;
    }
  }

  getDrumKitName() {
    return this.drumKitName;
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
    this.drumKitName = DRUM_KIT_NAME;
    this.error = null;
    this.lastError = null;
    this.lastUrl = null;
  }

  getStatus() {
    return {
      ready: Boolean(this.player),
      loading: this.loadingPromises.size > 0 || Boolean(this.playerPromise),
      error: this.error,
      lastError: this.lastError,
      lastUrl: this.lastUrl,
      baseUrl: this.baseUrl,
      fallbackUrl: this.fallbackUrl
    };
  }

  async ensurePlayer() {
    if (this.player) return this.player;
    if (this.playerPromise) return this.playerPromise;
    this.playerPromise = new Promise((resolve, reject) => {
      const globalPlayer = window?.[SOUNDFONT_PLAYER_GLOBAL];
      if (globalPlayer) {
        this.player = globalPlayer;
        this.error = null;
        resolve(this.player);
        return;
      }
      const error = new Error('SoundFont player script not loaded.');
      this.error = 'Failed to load SoundFont player.';
      reject(error);
    }).finally(() => {
      this.playerPromise = null;
    });
    return this.playerPromise;
  }

  getBaseUrlForInstrument(name, fallback = false) {
    if (this.localSoundfonts?.has(name)) {
      return this.localBaseUrl;
    }
    return fallback ? this.fallbackUrl : this.baseUrl;
  }

  buildUrl(baseUrl, name, format) {
    return `${normalizeBaseUrl(baseUrl)}${name}-${format}.js`;
  }

  getProgramName(program) {
    return GM_SOUNDFONT_NAMES[program] || GM_SOUNDFONT_NAMES[0];
  }

  loadInstrument(program) {
    const name = this.getProgramName(program);
    return this.loadInstrumentByName(String(program), name);
  }

  loadDrumKit(kitName = this.drumKitName) {
    const resolved = kitName || DRUM_KIT_NAME;
    const percussionOptions = { percussion: true, bank: GM_DRUM_BANK_MSB };
    const drumKey = resolveDrumKitKey(resolved, percussionOptions.bank);
    return this.loadInstrumentByName(drumKey, resolved, percussionOptions).catch((error) => {
      if (!this.drumKitFallbackName || resolved === this.drumKitFallbackName) {
        throw error;
      }
      this.drumKitName = this.drumKitFallbackName;
      const fallbackKey = resolveDrumKitKey(this.drumKitFallbackName, percussionOptions.bank);
      return this.loadInstrumentByName(fallbackKey, this.drumKitFallbackName, percussionOptions);
    });
  }

  async cacheInstrument(program) {
    const name = this.getProgramName(program);
    return this.cacheInstrumentByName(String(program), name);
  }

  async cacheDrumKit(kitName = this.drumKitName) {
    const resolved = kitName || DRUM_KIT_NAME;
    const drumKey = resolveDrumKitKey(resolved, GM_DRUM_BANK_MSB);
    return this.cacheInstrumentByName(drumKey, resolved);
  }

  async cacheInstrumentByName(key, name) {
    if (!globalThis?.caches) {
      throw new Error('Cache API unavailable.');
    }
    const cache = await caches.open('chainsaw-soundfonts');
    const primaryUrl = this.buildUrl(this.getBaseUrlForInstrument(name, false), name, this.format);
    const fallbackUrl = this.buildUrl(this.getBaseUrlForInstrument(name, true), name, this.format);
    const urls = [primaryUrl, fallbackUrl];
    for (const url of urls) {
      const cached = await cache.match(url);
      if (cached) {
        return { cached: true, url };
      }
    }
    for (const url of urls) {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          await cache.put(url, response.clone());
          return { cached: true, url };
        }
      } catch (error) {
        this.lastError = error?.message ? String(error.message) : String(error);
      }
    }
    throw new Error(`Failed to cache SoundFont: ${name}`);
  }

  loadInstrumentByName(key, name, options = {}) {
    if (this.instrumentCache.has(key)) {
      return Promise.resolve(this.instrumentCache.get(key));
    }
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }
    const primaryFormat = this.format;
    const primaryUrl = this.buildUrl(this.getBaseUrlForInstrument(name, false), name, primaryFormat);
    const fallbackUrl = this.buildUrl(this.getBaseUrlForInstrument(name, true), name, primaryFormat);
    const promise = this.ensurePlayer()
      .then(() => {
        this.lastUrl = primaryUrl;
        return this.player.instrument(this.ctx, name, {
          format: this.format,
          destination: this.masterGain || this.destination,
          percussion: options.percussion,
          bank: options.bank,
          nameToUrl: (instrumentName, soundfont, format) => {
            const url = this.buildUrl(this.getBaseUrlForInstrument(instrumentName, false), instrumentName, format);
            this.lastUrl = url;
            return url;
          }
        });
      })
      .catch(() => {
        this.lastUrl = fallbackUrl;
        return this.ensurePlayer().then(() => this.player.instrument(this.ctx, name, {
          format: this.format,
          destination: this.masterGain || this.destination,
          percussion: options.percussion,
          bank: options.bank,
          nameToUrl: (instrumentName, soundfont, format) => {
            const url = this.buildUrl(this.getBaseUrlForInstrument(instrumentName, true), instrumentName, format);
            this.lastUrl = url;
            return url;
          }
        }));
      })
      .then((instrument) => {
        if (!instrument) {
          this.error = `Failed to load SoundFont: ${name}`;
          this.lastError = this.error;
          return null;
        }
        this.instrumentCache.set(key, instrument);
        this.error = null;
        this.lastError = null;
        return instrument;
      })
      .catch((error) => {
        const reason = error?.message ? String(error.message) : String(error);
        const details = this.lastUrl ? `${reason}. URL: ${this.lastUrl}` : reason;
        this.error = `SoundFont load error: ${name} (${details})`;
        this.lastError = details;
        throw error;
      })
      .finally(() => {
        this.loadingPromises.delete(key);
      });
    this.loadingPromises.set(key, promise);
    return promise;
  }

  logResolution(details) {
    if (!this.debug) return;
    const summary = {
      trackId: details.trackId ?? null,
      channel: details.channel,
      isDrum: details.isDrum,
      incomingNote: details.incomingNote,
      resolvedNote: details.resolvedNote,
      bankMSB: details.bankMSB ?? null,
      bankLSB: details.bankLSB ?? null,
      program: details.program ?? null,
      presetName: details.presetName,
      presetKey: details.presetKey,
      percussionMode: details.percussionMode
    };
    // eslint-disable-next-line no-console
    console.debug('[SoundfontEngine] preset resolution', summary);
  }

  noteOn(midiNote, velocity = 0.8, time = null, durationSeconds = 0.25, channel = 0, meta = {}) {
    if (!this.ctx) return Promise.resolve(null);
    const when = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    const volume = clamp(velocity ?? 1, 0, 1) * (this.channelVolumes.get(channel) ?? 1);
    const isDrum = isDrumChannel(channel);
    const incomingNote = meta.sourceNote ?? midiNote;
    const resolvedNote = meta.resolvedNote ?? midiNote;
    const bankMSB = meta.bankMSB ?? (isDrum ? GM_DRUM_BANK_MSB : null);
    const bankLSB = meta.bankLSB ?? null;
    const playNote = (instrument) => {
      if (!instrument?.play) return null;
      return instrument.play(resolvedNote, when, { gain: volume, duration: durationSeconds });
    };
    if (isDrum) {
      const kitName = this.drumKitName || DRUM_KIT_NAME;
      const drumKey = resolveDrumKitKey(kitName, bankMSB);
      this.logResolution({
        trackId: meta.trackId,
        channel,
        isDrum,
        incomingNote,
        resolvedNote,
        bankMSB,
        bankLSB,
        program: meta.program ?? 0,
        presetName: kitName,
        presetKey: drumKey,
        percussionMode: true
      });
      return this.loadDrumKit(kitName).then(playNote);
    }
    const program = this.channelPrograms.get(channel) ?? 0;
    const presetName = this.getProgramName(program);
    this.logResolution({
      trackId: meta.trackId,
      channel,
      isDrum,
      incomingNote,
      resolvedNote,
      bankMSB,
      bankLSB,
      program,
      presetName,
      presetKey: String(program),
      percussionMode: false
    });
    return this.loadInstrument(program).then(playNote);
  }
}
