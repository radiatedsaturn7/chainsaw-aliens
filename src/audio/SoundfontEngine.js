import { GM_DRUM_BANK_MSB, GM_SOUNDFONT_NAMES, isDrumChannel, resolveDrumFallbackNote } from './gm.js';

const PRIMARY_SOUNDFONT_BASE = 'vendor/soundfonts/FluidR3_GM/';
const FALLBACK_SOUNDFONT_BASE = 'vendor/soundfonts/FluidR3_GM/';
const SOUNDFONT_PLAYER_GLOBAL = 'Soundfont';
const DRUM_KIT_NAME = 'synth_drum';
const DRUM_PRESET = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeBaseUrl = (url) => (url.endsWith('/') ? url : `${url}/`);
const resolveDrumKitKey = (kitName, bankMSB = GM_DRUM_BANK_MSB, bankLSB = 0, preset = DRUM_PRESET) =>
  `drum-kit:${bankMSB}:${bankLSB}:${preset}:${kitName}`;

export default class SoundfontEngine {
  constructor({
    baseUrl = PRIMARY_SOUNDFONT_BASE,
    fallbackUrl = FALLBACK_SOUNDFONT_BASE,
    format = 'mp3',
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
    this.failedInstruments = new Set();
    this.error = null;
    this.lastError = null;
    this.lastUrl = null;
    this.debug = Boolean(debug);
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
    if (!name) return;
    this.drumKitName = name;
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
    this.failedInstruments.clear();
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

  buildUrl(baseUrl, name, format) {
    return `${baseUrl}${name}-${format}.js`;
  }

  getProgramName(program) {
    return GM_SOUNDFONT_NAMES[program] || GM_SOUNDFONT_NAMES[0];
  }

  loadInstrument(program) {
    const name = this.getProgramName(program);
    return this.loadInstrumentByName(name, { program });
  }

  loadDrumKit(kitName = this.drumKitName, options = {}) {
    const name = kitName || DRUM_KIT_NAME;
    const percussionOptions = {
      percussion: true,
      bankMSB: options.bankMSB ?? GM_DRUM_BANK_MSB,
      bankLSB: options.bankLSB ?? 0,
      preset: options.preset ?? DRUM_PRESET
    };
    return this.loadInstrumentByName(name, percussionOptions);
  }

  async cacheInstrument(program) {
    const name = this.getProgramName(program);
    return this.cacheInstrumentByName(name, { program });
  }

  async cacheDrumKit(kitName = this.drumKitName, options = {}) {
    const name = kitName || DRUM_KIT_NAME;
    const percussionOptions = {
      percussion: true,
      bankMSB: options.bankMSB ?? GM_DRUM_BANK_MSB,
      bankLSB: options.bankLSB ?? 0,
      preset: options.preset ?? DRUM_PRESET
    };
    return this.cacheInstrumentByName(name, percussionOptions);
  }

  buildCacheKey({
    soundfontUrl = this.baseUrl,
    name = '',
    bankMSB = 0,
    bankLSB = 0,
    program = null,
    preset = null,
    percussion = false
  } = {}) {
    return [
      `soundfont=${soundfontUrl}`,
      `name=${name}`,
      `bankMSB=${bankMSB ?? ''}`,
      `bankLSB=${bankLSB ?? ''}`,
      `program=${program ?? ''}`,
      `preset=${preset ?? ''}`,
      `percussion=${percussion ? 1 : 0}`
    ].join('|');
  }

  getCacheKey(details = {}) {
    return this.buildCacheKey(details);
  }

  async cacheInstrumentByName(name, options = {}) {
    if (!globalThis?.caches) {
      throw new Error('Cache API unavailable.');
    }
    const cache = await caches.open('chainsaw-soundfonts');
    const primaryUrl = this.buildUrl(this.baseUrl, name, this.format);
    const fallbackUrl = this.buildUrl(this.fallbackUrl, name, this.format);
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

  loadInstrumentByName(name, options = {}) {
    const cacheKey = this.buildCacheKey({
      soundfontUrl: this.baseUrl,
      name,
      bankMSB: options.bankMSB ?? options.bank ?? 0,
      bankLSB: options.bankLSB ?? 0,
      program: options.program ?? null,
      preset: options.preset ?? null,
      percussion: options.percussion ?? false
    });
    if (this.instrumentCache.has(cacheKey)) {
      return Promise.resolve(this.instrumentCache.get(cacheKey));
    }
    if (this.failedInstruments.has(cacheKey)) {
      return Promise.reject(new Error(`SoundFont previously failed to load: ${name}`));
    }
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }
    const primaryFormat = this.format;
    const primaryUrl = this.buildUrl(this.baseUrl, name, primaryFormat);
    const fallbackUrl = this.buildUrl(this.fallbackUrl, name, primaryFormat);
    const promise = this.ensurePlayer()
      .then(() => {
        this.lastUrl = primaryUrl;
        return this.player.instrument(this.ctx, name, {
          format: this.format,
          destination: this.masterGain || this.destination,
          percussion: options.percussion,
          bank: options.bankMSB ?? options.bank,
          bankLSB: options.bankLSB,
          preset: options.preset,
          nameToUrl: (instrumentName, soundfont, format) => {
            const url = this.buildUrl(this.baseUrl, instrumentName, format);
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
          bank: options.bankMSB ?? options.bank,
          bankLSB: options.bankLSB,
          preset: options.preset,
          nameToUrl: (instrumentName, soundfont, format) => {
            const url = this.buildUrl(this.fallbackUrl, instrumentName, format);
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
        this.instrumentCache.set(cacheKey, instrument);
        this.error = null;
        this.lastError = null;
        return instrument;
      })
      .catch((error) => {
        const reason = error?.message ? String(error.message) : String(error);
        const details = this.lastUrl ? `${reason}. URL: ${this.lastUrl}` : reason;
        this.error = `SoundFont load error: ${name} (${details})`;
        this.lastError = details;
        this.failedInstruments.add(cacheKey);
        throw error;
      })
      .finally(() => {
        this.loadingPromises.delete(cacheKey);
      });
    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  getInstrumentKeyRange(instrument) {
    const buffers = instrument?.buffers;
    if (!buffers || typeof buffers !== 'object') return null;
    const keys = Object.keys(buffers)
      .map((key) => Number(key))
      .filter((value) => Number.isFinite(value));
    if (!keys.length) return null;
    return { min: Math.min(...keys), max: Math.max(...keys) };
  }

  getInstrumentNotes(instrument) {
    const buffers = instrument?.buffers;
    if (!buffers || typeof buffers !== 'object') return [];
    return Object.keys(buffers)
      .map((key) => Number(key))
      .filter((value) => Number.isFinite(value));
  }

  instrumentContainsNote(instrument, note, keyRange = null) {
    const buffers = instrument?.buffers;
    if (!buffers || typeof buffers !== 'object') return false;
    if (Object.prototype.hasOwnProperty.call(buffers, String(note))) return true;
    if (keyRange) {
      return note >= keyRange.min && note <= keyRange.max;
    }
    return false;
  }

  selectDrumPlaybackNote(note, instrument) {
    const availableNotes = this.getInstrumentNotes(instrument);
    if (!availableNotes.length) return { playbackNote: note, fallbackNote: null, availableNotes };
    if (availableNotes.includes(note)) return { playbackNote: note, fallbackNote: null, availableNotes };
    const fallbackNote = resolveDrumFallbackNote(note, availableNotes);
    if (Number.isFinite(fallbackNote)) {
      return { playbackNote: fallbackNote, fallbackNote, availableNotes };
    }
    const sorted = [...availableNotes].sort((a, b) => a - b);
    return { playbackNote: sorted[0] ?? note, fallbackNote: sorted[0] ?? null, availableNotes };
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
      cacheKey: details.cacheKey ?? null,
      presetName: details.presetName,
      presetKey: details.presetKey,
      percussionMode: details.percussionMode
    };
    // eslint-disable-next-line no-console
    console.debug('[SoundfontEngine] preset resolution', summary);
  }

  logDrumNote(details) {
    if (!this.debug) return;
    // eslint-disable-next-line no-console
    console.debug('[SoundfontEngine] drum noteOn', {
      backend: details.backend,
      bankMSB: details.bankMSB ?? null,
      bankLSB: details.bankLSB ?? null,
      program: details.program ?? null,
      preset: details.preset ?? null,
      cacheKey: details.cacheKey ?? null,
      resolvedPresetName: details.resolvedPresetName ?? null,
      note: details.note ?? null,
      playbackNote: details.playbackNote ?? null,
      fallbackNote: details.fallbackNote ?? null,
      availableNotes: details.availableNotes ?? null,
      containsNote: details.containsNote ?? null,
      keyRange: details.keyRange ?? null
    });
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
    const playNote = (instrument, note = resolvedNote) => {
      if (!instrument?.play) return null;
      return instrument.play(note, when, { gain: volume, duration: durationSeconds });
    };
    if (isDrum) {
      const bankMSB = GM_DRUM_BANK_MSB;
      const bankLSB = meta.bankLSB ?? 0;
      const preset = meta.preset ?? DRUM_PRESET;
      const kitName = this.drumKitName || DRUM_KIT_NAME;
      const cacheKey = this.buildCacheKey({
        soundfontUrl: this.baseUrl,
        name: kitName,
        bankMSB,
        bankLSB,
        preset,
        percussion: true
      });
      const drumKey = resolveDrumKitKey(kitName, bankMSB, bankLSB, preset);
      this.logResolution({
        trackId: meta.trackId,
        channel,
        isDrum,
        incomingNote,
        resolvedNote,
        bankMSB,
        bankLSB,
        program: meta.program ?? 0,
        cacheKey,
        presetName: kitName,
        presetKey: drumKey,
        percussionMode: true
      });
      return this.loadDrumKit(kitName, { bankMSB, bankLSB, preset }).then((instrument) => {
        const keyRange = this.getInstrumentKeyRange(instrument);
        const { playbackNote, fallbackNote, availableNotes } = this.selectDrumPlaybackNote(resolvedNote, instrument);
        const containsNote = this.instrumentContainsNote(instrument, playbackNote, null);
        this.logDrumNote({
          backend: 'soundfont',
          bankMSB,
          bankLSB,
          program: meta.program ?? 0,
          preset,
          cacheKey,
          resolvedPresetName: kitName,
          note: resolvedNote,
          playbackNote,
          containsNote,
          keyRange,
          fallbackNote,
          availableNotes: availableNotes.length
        });
        return playNote(instrument, playbackNote);
      });
    }
    const program = this.channelPrograms.get(channel) ?? 0;
    const presetName = this.getProgramName(program);
    const cacheKey = this.buildCacheKey({
      soundfontUrl: this.baseUrl,
      name: presetName,
      bankMSB,
      bankLSB,
      program,
      percussion: false
    });
    this.logResolution({
      trackId: meta.trackId,
      channel,
      isDrum,
      incomingNote,
      resolvedNote,
      bankMSB,
      bankLSB,
      program,
      cacheKey,
      presetName,
      presetKey: String(program),
      percussionMode: false
    });
    return this.loadInstrument(program).then(playNote);
  }
}
