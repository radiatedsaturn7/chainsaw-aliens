import {
  GM_DRUM_BANK_LSB,
  GM_DRUM_BANK_MSB,
  GM_DRUM_CHANNEL,
  GM_DRUM_NOTE_MIN,
  GM_DRUMS,
  GM_PROGRAMS,
  clampDrumPitch,
  isDrumChannel
} from '../audio/gm.js';
import DrumKitManager from '../audio/DrumKitManager.js';
import SoundfontEngine from '../audio/SoundfontEngine.js';
import SoundfontLoader from '../audio/soundfontLoader.js';
import { AUDIO_CONFIG } from '../audio/config.js';

const DEFAULT_GM_SOUND_FONT_URL = 'vendor/soundfonts/FluidR3_GM/';
const FALLBACK_GM_SOUND_FONT_URL = 'vendor/soundfonts/FluidR3_GM/';
const SOUNDFONT_CDN_URLS = {
  vendored: 'vendor/soundfonts/FluidR3_GM/'
};
const WEB_AUDIOFONT_BASE_URL = 'vendor/webaudiofont/';
const WEB_AUDIOFONT_KIT = 'Chaos_sf2_file';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const LEGACY_INSTRUMENT_TO_PROGRAM = {
  piano: 0,
  'electric-piano': 4,
  harpsichord: 6,
  clav: 7,
  bell: 9,
  celesta: 8,
  vibes: 11,
  marimba: 12,
  organ: 16,
  strings: 48,
  choir: 52,
  bass: 33,
  'guitar-nylon': 24,
  'guitar-steel': 25,
  'guitar-electric': 27,
  brass: 61,
  trumpet: 56,
  sax: 65,
  flute: 73,
  clarinet: 71,
  'synth-lead': 80,
  'synth-pad': 88,
  pluck: 45,
  sine: 80,
  triangle: 81,
  square: 80,
  sawtooth: 81
};

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
    this.midiVoiceLimit = 48;
    this.midiLatency = 0.03;
    this.midiReverbEnabled = true;
    this.midiReverbLevel = 0.18;
    this.midiReverbSend = null;
    this.midiPitchBendSemitones = 0;
    this.masterPan = 0;
    this.masterPanNode = null;
    this.channelPitchBendSemitones = Array.from({ length: 16 }, () => 0);
    this.liveMidiNotes = new Map();
    this.gmEnabled = true;
    this.gmError = null;
    this.soundfont = new SoundfontEngine({
      baseUrl: this.loadStoredSoundfontUrl(),
      fallbackUrl: FALLBACK_GM_SOUND_FONT_URL
    });
    this.soundfontLoader = new SoundfontLoader({
      soundfont: this.soundfont,
      enabled: AUDIO_CONFIG.useLazySoundfontLoader,
      preloadCommonSet: AUDIO_CONFIG.preloadLazySoundfontCommonSet,
      commonPrograms: AUDIO_CONFIG.lazySoundfontCommonPrograms,
      includeCommonDrumKit: AUDIO_CONFIG.lazySoundfontCommonDrumKit
    });
    this.drumKitManager = new DrumKitManager({ soundfont: this.soundfont });
    this.channelState = Array.from({ length: 16 }, () => ({
      bankMSB: 0,
      bankLSB: 0,
      program: 0,
      drumKitId: null
    }));
    this.channelState[GM_DRUM_CHANNEL].bankMSB = GM_DRUM_BANK_MSB;
    this.channelState[GM_DRUM_CHANNEL].bankLSB = GM_DRUM_BANK_LSB;
    this.midiDebug = {
      lastDrumNote: null,
      lastChannel: null,
      lastChannelType: null
    };
    this.pedalImpulseCache = new Map();
    this.drumFont = {
      baseUrl: WEB_AUDIOFONT_BASE_URL,
      kit: WEB_AUDIOFONT_KIT,
      player: null,
      loadedNotes: new Set(),
      loadingNotes: new Map(),
      failed: false,
      available: null,
      availabilityPromise: null,
      missingLogged: false
    };
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.masterPanNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (this.masterPanNode) {
        this.masterPanNode.pan.value = clamp(this.masterPan, -1, 1);
        this.master.connect(this.masterPanNode);
        this.masterPanNode.connect(this.ctx.destination);
      } else {
        this.master.connect(this.ctx.destination);
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
    this.midiReverbSend = this.ctx.createGain();
    this.midiReverbSend.gain.value = this.midiReverbEnabled ? this.midiReverbLevel : 0;
    this.midiBus.connect(this.midiReverbSend);
    this.midiReverbSend.connect(this.midiReverb);
    this.midiReverb.connect(this.midiLimiter);
    this.midiSamples = this.buildMidiSamples();
    this.soundfont.initAudio({ audioContext: this.ctx, destination: this.midiBus });
    this.soundfontLoader.preloadCommon().catch(() => {});
  }

  loadScriptOnce(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('Missing script URL.'));
        return;
      }
      const existing = document.querySelector(`script[data-src="${url}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') resolve();
        else existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset.src = url;
      script.dataset.loaded = 'false';
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }

  async ensureDrumFontPlayer() {
    if (this.drumFont.failed) return null;
    const available = await this.ensureWebAudioFontAvailability();
    if (!available) return null;
    if (this.drumFont.player) return this.drumFont.player;
    try {
      await this.loadScriptOnce(`${this.drumFont.baseUrl}webaudiofont.js`);
      const PlayerClass = globalThis.WebAudioFontPlayer;
      if (!PlayerClass) {
        this.drumFont.failed = true;
        return null;
      }
      this.drumFont.player = new PlayerClass();
      return this.drumFont.player;
    } catch (error) {
      this.drumFont.failed = true;
      return null;
    }
  }

  ensureWebAudioFontAvailability() {
    if (this.drumFont.available !== null) {
      return Promise.resolve(this.drumFont.available);
    }
    if (this.drumFont.availabilityPromise) {
      return this.drumFont.availabilityPromise;
    }
    const url = `${this.drumFont.baseUrl}webaudiofont.js`;
    this.drumFont.availabilityPromise = fetch(url, { method: 'GET' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Missing ${url}`);
        }
        this.drumFont.available = true;
        return true;
      })
      .catch(() => {
        this.drumFont.available = false;
        this.drumFont.failed = true;
        if (!this.drumFont.missingLogged) {
          // eslint-disable-next-line no-console
          console.error('[Audio] WebAudioFont drums unavailable: vendor/webaudiofont/ assets are missing.');
          this.drumFont.missingLogged = true;
        }
        return false;
      })
      .finally(() => {
        this.drumFont.availabilityPromise = null;
      });
    return this.drumFont.availabilityPromise;
  }

  isWebAudioFontReady() {
    return this.drumFont.available === true && !this.drumFont.failed;
  }

  getDrumFontNoteKey(note, preset = 0) {
    return `${note}:${Math.max(0, Math.trunc(preset || 0))}`;
  }

  getDrumFontVarName(note, preset = 0) {
    const slot = Math.max(0, Math.trunc(preset || 0));
    return `_drum_${note}_${slot}_${this.drumFont.kit}`;
  }

  async loadDrumFontNote(note, preset = 0) {
    if (this.drumFont.failed) return null;
    const clampedPreset = Math.max(0, Math.trunc(preset || 0));
    const noteKey = this.getDrumFontNoteKey(note, clampedPreset);
    if (this.drumFont.loadedNotes.has(noteKey)) return globalThis[this.getDrumFontVarName(note, clampedPreset)] || null;
    if (this.drumFont.loadingNotes.has(noteKey)) {
      return this.drumFont.loadingNotes.get(noteKey);
    }
    const loadPreset = (slot) => {
      const presetKey = this.getDrumFontNoteKey(note, slot);
      const url = `${this.drumFont.baseUrl}128${note}_${slot}_${this.drumFont.kit}.js`;
      return this.loadScriptOnce(url)
        .then(() => {
          const data = globalThis[this.getDrumFontVarName(note, slot)];
          if (!data) {
            throw new Error(`Missing drum font data for note ${note}`);
          }
          this.drumFont.loadedNotes.add(presetKey);
          return data;
        });
    };
    const promise = loadPreset(clampedPreset)
      .catch((error) => {
        if (clampedPreset === 0) {
          throw error;
        }
        return loadPreset(0);
      })
      .finally(() => {
        this.drumFont.loadingNotes.delete(noteKey);
      });
    this.drumFont.loadingNotes.set(noteKey, promise);
    return promise;
  }

  playWebAudioFontDrum({ note, when, duration, volume, preset = 0 }) {
    if (!this.isWebAudioFontReady()) return false;
    const play = async () => {
      const player = await this.ensureDrumFontPlayer();
      if (!player) return;
      const data = await this.loadDrumFontNote(note, preset);
      if (!data) return;
      const target = this.midiBus || this.master;
      player.queueWaveTable(this.ctx, target, data, when, note, duration, volume);
    };
    play();
    return true;
  }

  setMidiPitchBend(semitones = 0, channel = null) {
    const nextValue = clamp(Number(semitones) || 0, -12, 12);
    const resolvedChannel = Number.isFinite(channel) ? clamp(channel, 0, 15) : null;
    if (resolvedChannel !== null) {
      this.channelPitchBendSemitones[resolvedChannel] = nextValue;
    } else {
      this.midiPitchBendSemitones = nextValue;
    }
    this.midiVoices.forEach((voice) => {
      if (!voice?.audioNode?.playbackRate) return;
      if (resolvedChannel !== null && voice.channel !== resolvedChannel) return;
      const channelBend = Number.isFinite(voice.channel)
        ? this.channelPitchBendSemitones[voice.channel] ?? 0
        : 0;
      const bend = channelBend || this.midiPitchBendSemitones;
      const rate = 2 ** (bend / 12);
      const baseRate = voice.basePlaybackRate ?? voice.audioNode.playbackRate.value ?? 1;
      voice.audioNode.playbackRate.value = baseRate * rate;
    });
  }

  setMidiVolume(value = 1) {
    const nextValue = clamp(Number(value) || 0, 0, 1);
    this.ensureMidiSampler();
    if (this.midiBus?.gain) {
      this.midiBus.gain.value = nextValue;
    }
  }

  loadStoredSoundfontUrl() {
    try {
      const stored = localStorage.getItem('chainsaw-gm-soundfont-url');
      if (!stored) {
        return DEFAULT_GM_SOUND_FONT_URL;
      }
      return stored;
    } catch (error) {
      return DEFAULT_GM_SOUND_FONT_URL;
    }
  }

  setSoundfontUrl(url) {
    if (!url) return;
    const nextUrl = url.endsWith('/') ? url : `${url}/`;
    try {
      localStorage.setItem('chainsaw-gm-soundfont-url', nextUrl);
    } catch (error) {
      // ignore
    }
    this.soundfont.setBaseUrl(nextUrl);
    this.gmError = null;
  }

  resetSoundfontUrl() {
    this.setSoundfontUrl(DEFAULT_GM_SOUND_FONT_URL);
  }

  setSoundfontEnabled(enabled) {
    this.gmEnabled = Boolean(enabled);
    if (!this.gmEnabled) {
      this.gmError = null;
    }
  }

  setSoundfontCdn(id = 'vendored') {
    const nextUrl = SOUNDFONT_CDN_URLS[id] || DEFAULT_GM_SOUND_FONT_URL;
    this.setSoundfontUrl(nextUrl);
    this.gmError = null;
  }

  resetGmBank() {
    this.soundfont.reset();
    this.soundfontLoader.reset();
    this.gmError = null;
    this.drumKitManager.setDrumKit('standard');
  }

  getGmStatus() {
    const status = this.soundfont.getStatus();
    return {
      ready: status.ready,
      loading: status.loading,
      loadedPrograms: this.soundfont.instrumentCache.size,
      error: this.gmError || status.error,
      baseUrl: status.baseUrl,
      fallbackUrl: status.fallbackUrl,
      enabled: this.gmEnabled
    };
  }

  ensureGmPlayer() {
    this.ensureMidiSampler();
    return this.soundfont.ensurePlayer();
  }

  loadGmProgram(program) {
    this.ensureMidiSampler();
    if (this.soundfontLoader.enabled) {
      return this.soundfontLoader.ensureLoaded({ channel: 0, program, bankMSB: 0, bankLSB: 0 });
    }
    return this.soundfont.loadInstrument(program);
  }

  loadGmDrumKit() {
    this.ensureMidiSampler();
    const kit = this.drumKitManager.getDrumKit();
    if (this.soundfontLoader.enabled) {
      return this.soundfontLoader.ensureLoaded({
        channel: GM_DRUM_CHANNEL,
        isDrum: true,
        bankMSB: GM_DRUM_BANK_MSB,
        bankLSB: GM_DRUM_BANK_LSB,
        kitName: kit?.soundfont
      });
    }
    return this.soundfont.loadDrumKit(kit?.soundfont);
  }

  cacheGmProgram(program, channel = 0, bankMSB = 0, bankLSB = 0) {
    if (!this.gmEnabled) return Promise.resolve({ cached: false, reason: 'GM disabled' });
    this.ensureMidiSampler();
    if (isDrumChannel(channel)) {
      const kit = this.drumKitManager.resolveKitFromBankProgram(bankMSB, bankLSB, program);
      return this.soundfont.cacheDrumKit(kit?.soundfont);
    }
    return this.soundfont.cacheInstrument(program);
  }

  preloadSoundfontProgram(program, channel = 0, bankMSB = 0, bankLSB = 0) {
    if (!this.gmEnabled) return;
    if (isDrumChannel(channel)) {
      const kit = this.drumKitManager.resolveKitFromBankProgram(bankMSB, bankLSB, program);
      this.soundfont.loadDrumKit(kit?.soundfont).catch(() => {});
      return;
    }
    this.loadGmProgram(program).catch(() => {});
  }

  setDrumKit(nameOrId) {
    const kit = this.drumKitManager.setDrumKit(nameOrId);
    this.channelState[9].drumKitId = kit?.id || null;
    return kit;
  }

  getDrumKit() {
    return this.drumKitManager.getDrumKit();
  }

  listAvailableDrumKits() {
    return this.drumKitManager.listAvailableDrumKits();
  }

  getDrumKitLabel({ bankMSB = 0, bankLSB = 0, program = 0 } = {}) {
    const kit = this.drumKitManager.resolveKitFromBankProgram(bankMSB, bankLSB, program);
    return kit ? kit.label : 'Standard Kit';
  }

  getMidiDebugInfo() {
    return {
      drumKit: this.drumKitManager.getDrumKit(),
      lastDrumNote: this.midiDebug.lastDrumNote,
      lastChannel: this.midiDebug.lastChannel,
      lastChannelType: this.midiDebug.lastChannelType
    };
  }

  logDrumNote({
    backend,
    bankMSB,
    bankLSB,
    program,
    preset,
    cacheKey,
    resolvedPresetName,
    note,
    containsNote,
    keyRange,
    error
  }) {
    if (!this.soundfont?.debug) return;
    // eslint-disable-next-line no-console
    console.debug('[Audio] drum noteOn', {
      backend,
      bankMSB,
      bankLSB,
      program,
      preset,
      cacheKey,
      resolvedPresetName,
      note,
      containsNote,
      keyRange,
      error: error ? String(error) : null
    });
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) {
      this.master.gain.value = value;
    }
  }

  setMasterPan(value = 0) {
    this.masterPan = clamp(Number(value) || 0, -1, 1);
    if (this.masterPanNode) {
      this.masterPanNode.pan.value = this.masterPan;
    }
  }

  setMidiLatency(value = 0) {
    this.midiLatency = Math.max(0, Number(value) || 0);
  }

  setMidiReverbEnabled(enabled) {
    this.midiReverbEnabled = Boolean(enabled);
    if (this.midiReverbSend) {
      this.midiReverbSend.gain.value = this.midiReverbEnabled ? this.midiReverbLevel : 0;
    }
  }

  setMidiReverbLevel(value) {
    this.midiReverbLevel = clamp(Number(value) || 0, 0, 1);
    if (this.midiReverbSend && this.midiReverbEnabled) {
      this.midiReverbSend.gain.value = this.midiReverbLevel;
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
      'electric-piano': { type: 'triangle', attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.35, filter: 2000 },
      harpsichord: { type: 'square', attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.15, filter: 2400 },
      clav: { type: 'square', attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.12, filter: 2800 },
      bell: { type: 'sine', attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.8, filter: 3200 },
      celesta: { type: 'triangle', attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.5, filter: 3000 },
      vibes: { type: 'sine', attack: 0.02, decay: 0.35, sustain: 0.25, release: 0.6, filter: 2600 },
      marimba: { type: 'triangle', attack: 0.008, decay: 0.2, sustain: 0.2, release: 0.3, filter: 2200 },
      organ: { type: 'sine', attack: 0.02, decay: 0.05, sustain: 0.85, release: 0.3, filter: 2200 },
      strings: { type: 'sawtooth', attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4, filter: 1400 },
      choir: { type: 'triangle', attack: 0.08, decay: 0.2, sustain: 0.75, release: 0.45, filter: 1800 },
      bass: { type: 'square', attack: 0.02, decay: 0.12, sustain: 0.5, release: 0.2, filter: 900 },
      'guitar-nylon': { type: 'triangle', attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.25, filter: 2000 },
      'guitar-steel': { type: 'sawtooth', attack: 0.01, decay: 0.14, sustain: 0.25, release: 0.22, filter: 2300 },
      'guitar-electric': { type: 'square', attack: 0.008, decay: 0.15, sustain: 0.35, release: 0.2, filter: 1800 },
      brass: { type: 'sawtooth', attack: 0.04, decay: 0.2, sustain: 0.55, release: 0.3, filter: 1500 },
      trumpet: { type: 'sawtooth', attack: 0.03, decay: 0.18, sustain: 0.6, release: 0.25, filter: 1700 },
      sax: { type: 'sawtooth', attack: 0.035, decay: 0.2, sustain: 0.55, release: 0.3, filter: 1300 },
      flute: { type: 'sine', attack: 0.05, decay: 0.18, sustain: 0.7, release: 0.35, filter: 2000 },
      clarinet: { type: 'square', attack: 0.02, decay: 0.18, sustain: 0.55, release: 0.3, filter: 1500 },
      'synth-lead': { type: 'sawtooth', attack: 0.01, decay: 0.08, sustain: 0.6, release: 0.2, filter: 2000 },
      'synth-pad': { type: 'triangle', attack: 0.08, decay: 0.18, sustain: 0.7, release: 0.4, filter: 1600 },
      pluck: { type: 'square', attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2, filter: 2200 },
      sine: { type: 'sine', attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
      triangle: { type: 'triangle', attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.2 },
      square: { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.18 },
      sawtooth: { type: 'sawtooth', attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.2 }
    };
    return presets[instrument] || presets.sine;
  }

  getPedalByType(pedals = [], type) {
    return pedals.find((pedal) => pedal && pedal.enabled !== false && pedal.type === type) || null;
  }

  buildDistortionCurve(amount = 0.6, samples = 1024) {
    const curve = new Float32Array(samples);
    const k = 5 + amount * 80;
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  getPedalImpulse(room = 0.5, decay = 0.5) {
    const key = `${Math.round(room * 100)}:${Math.round(decay * 100)}`;
    if (this.pedalImpulseCache.has(key)) return this.pedalImpulseCache.get(key);
    const duration = 0.25 + room * 1.8;
    const sharpness = 1.2 + decay * 4;
    const impulse = this.buildImpulseResponse(duration, sharpness);
    this.pedalImpulseCache.set(key, impulse);
    return impulse;
  }

  applyPitchPhaserToSource(source, pedals = [], when = 0, duration = 0.4) {
    const pedal = this.getPedalByType(pedals, 'pitchPhaser');
    if (!pedal || !source?.playbackRate) return;
    const up = clamp(Number(pedal.knobs?.up) || 0, 0, 1);
    const down = clamp(Number(pedal.knobs?.down) || 0, 0, 1);
    const phase = clamp(Number(pedal.knobs?.phase) || 0.5, 0, 1);
    const depthSemis = 0.5 + ((up + down) * 1.25);
    const hz = 0.2 + phase * 3.2;
    const points = 48;
    const curve = new Float32Array(points);
    for (let i = 0; i < points; i += 1) {
      const t = i / (points - 1);
      const semitoneShift = Math.sin(t * Math.PI * 2 * hz * Math.max(0.2, duration)) * depthSemis;
      curve[i] = 2 ** (semitoneShift / 12);
    }
    source.playbackRate.setValueCurveAtTime(curve, when, Math.max(0.08, duration));
  }

  applyPedalChainToNote(inputNode, pedals = [], when = 0, duration = 0.4) {
    this.ensure();
    const enabled = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
    let current = inputNode;
    const stopFns = [];
    enabled.forEach((pedal) => {
      const knobs = pedal.knobs || {};
      if (pedal.type === 'compressor') {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -44 + clamp(knobs.threshold ?? 0.5, 0, 1) * 42;
        comp.ratio.value = 1.5 + clamp(knobs.ratio ?? 0.5, 0, 1) * 16;
        comp.attack.value = 0.002 + (1 - clamp(knobs.ratio ?? 0.5, 0, 1)) * 0.03;
        comp.release.value = 0.06 + clamp(knobs.makeup ?? 0.4, 0, 1) * 0.32;
        const makeup = this.ctx.createGain();
        makeup.gain.value = 0.85 + clamp(knobs.makeup ?? 0.4, 0, 1) * 1.1;
        current.connect(comp);
        comp.connect(makeup);
        current = makeup;
      } else if (pedal.type === 'eq') {
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 180;
        low.gain.value = (clamp(knobs.low ?? 0.5, 0, 1) - 0.5) * 24;
        const mid = this.ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1150;
        mid.Q.value = 0.9;
        mid.gain.value = (clamp(knobs.mid ?? 0.5, 0, 1) - 0.5) * 20;
        const high = this.ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 3400;
        high.gain.value = (clamp(knobs.high ?? 0.5, 0, 1) - 0.5) * 24;
        const presence = this.ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 4200;
        presence.Q.value = 1.2;
        presence.gain.value = (clamp(knobs.presence ?? 0.5, 0, 1) - 0.5) * 12;
        current.connect(low); low.connect(mid); mid.connect(high); high.connect(presence);
        current = presence;
      } else if (pedal.type === 'overdrive') {
        const pre = this.ctx.createGain();
        pre.gain.value = 1 + clamp(knobs.drive ?? 0.6, 0, 1) * 6;
        const shape = this.ctx.createWaveShaper();
        shape.curve = this.buildDistortionCurve(clamp(knobs.drive ?? 0.6, 0, 1));
        shape.oversample = '4x';
        const tone = this.ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 900 + clamp(knobs.tone ?? 0.5, 0, 1) * 7000;
        const bite = this.ctx.createBiquadFilter();
        bite.type = 'highpass';
        bite.frequency.value = 40 + clamp(knobs.bite ?? 0.5, 0, 1) * 650;
        const out = this.ctx.createGain();
        out.gain.value = 0.65;
        current.connect(pre); pre.connect(shape); shape.connect(tone); tone.connect(bite); bite.connect(out);
        current = out;
      } else if (pedal.type === 'wah') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 1 + clamp(knobs.mix ?? 0.7, 0, 1) * 10;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.4 + clamp(knobs.rate ?? 0.5, 0, 1) * 5;
        lfoGain.gain.value = 320 + clamp(knobs.sweep ?? 0.6, 0, 1) * 3400;
        filter.frequency.value = 380;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        current.connect(filter);
        current = filter;
      } else if (pedal.type === 'chorus') {
        const mix = clamp(knobs.mix ?? 0.7, 0, 1);
        const depth = clamp(knobs.depth ?? 0.5, 0, 1);
        const spread = clamp(knobs.spread ?? 0.4, 0, 1);
        const dry = this.ctx.createGain();
        dry.gain.value = 1 - mix * 0.55;
        const wet = this.ctx.createGain();
        wet.gain.value = mix * 0.5;
        const delay = this.ctx.createDelay(0.06);
        delay.delayTime.value = 0.012 + spread * 0.016;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.15 + depth * 2.4;
        lfoGain.gain.value = 0.001 + depth * 0.004;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        const sum = this.ctx.createGain();
        current.connect(dry);
        current.connect(delay);
        delay.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'phaser') {
        const rate = clamp(knobs.rate ?? 0.6, 0, 1);
        const depth = clamp(knobs.depth ?? 0.6, 0, 1);
        const mix = clamp(knobs.mix ?? 0.6, 0, 1);
        const dry = this.ctx.createGain();
        dry.gain.value = 1 - mix * 0.5;
        const wet = this.ctx.createGain();
        wet.gain.value = mix * 0.6;
        const stages = Array.from({ length: 4 }, () => this.ctx.createBiquadFilter());
        stages.forEach((stage) => {
          stage.type = 'allpass';
          stage.frequency.value = 400;
          stage.Q.value = 0.8;
        });
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.2 + rate * 4.2;
        lfoGain.gain.value = 180 + depth * 1400;
        lfo.connect(lfoGain);
        stages.forEach((stage) => lfoGain.connect(stage.frequency));
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        const sum = this.ctx.createGain();
        current.connect(dry);
        current.connect(stages[0]);
        stages.reduce((prev, next) => { prev.connect(next); return next; });
        stages[stages.length - 1].connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'reverb') {
        const mix = clamp(knobs.mix ?? 0.6, 0, 1);
        const room = clamp(knobs.room ?? 0.5, 0, 1);
        const decay = clamp(knobs.decay ?? 0.6, 0, 1);
        const dry = this.ctx.createGain();
        const wet = this.ctx.createGain();
        dry.gain.value = 1 - mix * 0.6;
        wet.gain.value = mix * 0.8;
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this.getPedalImpulse(room, decay);
        const sum = this.ctx.createGain();
        current.connect(dry);
        current.connect(convolver);
        convolver.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'echo') {
        const time = clamp(knobs.time ?? 0.45, 0, 1);
        const feedback = clamp(knobs.feedback ?? 0.35, 0, 0.95);
        const mix = clamp(knobs.mix ?? 0.65, 0, 1);
        const delay = this.ctx.createDelay(1.5);
        delay.delayTime.value = 0.06 + time * 0.64;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.15 + feedback * 0.72;
        const tone = this.ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 1300 + (1 - feedback) * 5200;
        const dry = this.ctx.createGain();
        dry.gain.value = 1 - mix * 0.55;
        const wet = this.ctx.createGain();
        wet.gain.value = mix * 0.65;
        const sum = this.ctx.createGain();
        current.connect(dry);
        current.connect(delay);
        delay.connect(tone);
        tone.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'volumePhaser') {
        const minV = clamp(knobs.down ?? 0.35, 0.02, 1);
        const maxV = clamp(knobs.up ?? 0.95, 0.02, 1);
        const phase = clamp(knobs.phase ?? 0.55, 0, 1);
        const gain = this.ctx.createGain();
        gain.gain.value = (minV + maxV) * 0.45;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.2 + phase * 4;
        lfoGain.gain.value = Math.max(0.0001, (maxV - minV) * 0.5);
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        current.connect(gain);
        current = gain;
      } else if (pedal.type === 'panPhaser' && this.ctx.createStereoPanner) {
        const maxL = clamp(knobs.left ?? 0.85, 0, 1);
        const maxR = clamp(knobs.right ?? 0.85, 0, 1);
        const phase = clamp(knobs.phase ?? 0.6, 0, 1);
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = 0;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.2 + phase * 4.4;
        lfoGain.gain.value = Math.max(0.05, Math.min(1, (maxL + maxR) * 0.5));
        lfo.connect(lfoGain);
        lfoGain.connect(panner.pan);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        current.connect(panner);
        current = panner;
      }
    });

    return {
      output: current,
      cleanup: () => stopFns.forEach((fn) => {
        try { fn(); } catch (error) { /* ignore */ }
      })
    };
  }

  playDspPedalGmNote({ pitch, duration, volume, program, pan, isDrums, when, pedals = [] }) {
    const instrument = isDrums
      ? this.getFallbackDrum(pitch)
      : this.getFallbackInstrument(program);
    const octave = this.getPedalByType(pedals, 'octave');
    const voices = [{ semitones: 0, level: 1 }];
    if (octave) {
      const up = Math.round(clamp(octave.knobs?.up ?? 0, 0, 2));
      const down = Math.round(clamp(octave.knobs?.down ?? 0, 0, 2));
      const mix = clamp(octave.knobs?.mix ?? 0.75, 0, 1);
      if (up > 0) voices.push({ semitones: up * 12, level: mix * 0.75 });
      if (down > 0) voices.push({ semitones: -down * 12, level: mix * 0.75 });
    }
    voices.forEach((voice) => {
      this.playSampledNote({
        pitch: clamp(Math.round(pitch + voice.semitones), 0, 127),
        duration,
        volume: clamp(volume * voice.level, 0, 1),
        instrument,
        when,
        pan,
        pedals
      });
    });
  }

  /**
   * GM channel 10 (index 9) is percussion: note numbers map directly to drum sounds,
   * and kit selection is driven by Bank Select (CC0/CC32) plus Program Change.
   */
  playGmNote({
    pitch = 60,
    duration = 0.5,
    volume = 0.8,
    program = 0,
    channel = 0,
    bankMSB = 0,
    bankLSB = 0,
    pan = 0,
    pedals = [],
    trackId = null
  }) {
    this.ensureMidiSampler();
    const clampedProgram = clamp(program ?? 0, 0, GM_PROGRAMS.length - 1);
    const clampedVolume = clamp(volume ?? 1, 0, 1);
    const clampedPan = clamp(pan ?? 0, -1, 1);
    const isDrums = isDrumChannel(channel);
    const resolvedChannel = isDrums ? GM_DRUM_CHANNEL : clamp(channel ?? 0, 0, 15);
    const channelState = this.channelState[resolvedChannel] || this.channelState[0];
    let resolvedPitch = clamp(Math.round(pitch ?? GM_DRUM_NOTE_MIN), 0, 127);
    let resolvedBankMSB = bankMSB;
    let resolvedBankLSB = bankLSB;
    if (isDrums) {
      resolvedPitch = clampDrumPitch(resolvedPitch);
      resolvedBankMSB = GM_DRUM_BANK_MSB;
      resolvedBankLSB = Number.isInteger(bankLSB) ? bankLSB : GM_DRUM_BANK_LSB;
      const resolvedKit = this.drumKitManager.resolveKitFromBankProgram(resolvedBankMSB, resolvedBankLSB, clampedProgram)
        || this.drumKitManager.getDrumKit();
      if (resolvedKit?.soundfont) {
        this.soundfont.setDrumKitName(resolvedKit.soundfont);
        this.drumKitManager.setDrumKit(resolvedKit.id);
        channelState.drumKitId = resolvedKit.id;
      }
      channelState.bankMSB = resolvedBankMSB;
      channelState.bankLSB = resolvedBankLSB;
      channelState.program = clampedProgram;
      const drumLabel = GM_DRUMS.find((entry) => entry.pitch === resolvedPitch)?.label || 'Unknown Drum';
      this.midiDebug.lastDrumNote = { pitch: resolvedPitch, label: drumLabel };
      this.midiDebug.lastChannelType = 'percussion';
      this.midiDebug.lastChannel = resolvedChannel;
    } else {
      channelState.bankMSB = Number.isInteger(bankMSB) ? bankMSB : channelState.bankMSB;
      channelState.bankLSB = Number.isInteger(bankLSB) ? bankLSB : channelState.bankLSB;
      channelState.program = clampedProgram;
      this.midiDebug.lastChannelType = 'melodic';
      this.midiDebug.lastChannel = resolvedChannel;
    }
    if (this.soundfont?.debug) {
      // eslint-disable-next-line no-console
      console.debug('[Audio] GM noteOn', {
        trackId,
        channel: resolvedChannel,
        isDrum: isDrums,
        pitch: resolvedPitch,
        program: clampedProgram,
        bankMSB: resolvedBankMSB,
        bankLSB: resolvedBankLSB
      });
    }
    const when = this.ctx.currentTime + this.midiLatency;
    const enabledPedals = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
    if (enabledPedals.length) {
      this.playDspPedalGmNote({
        pitch: resolvedPitch,
        duration,
        volume: clampedVolume,
        program: clampedProgram,
        pan: clampedPan,
        isDrums,
        when,
        pedals: enabledPedals
      });
      return;
    }
    const fallback = () => {
      this.gmError = 'SoundFont failed; using fallback synth.';
      if (isDrums) {
        const resolvedPresetName = this.soundfont.getDrumKitName?.() || 'synth_drum';
        const cacheKey = this.soundfont.getCacheKey?.({
          soundfontUrl: this.soundfont.baseUrl,
          name: resolvedPresetName,
          bankMSB: resolvedBankMSB,
          bankLSB: resolvedBankLSB,
          preset: clampedProgram,
          percussion: true
        });
        this.logDrumNote({
          backend: 'fallback',
          bankMSB: resolvedBankMSB,
          bankLSB: resolvedBankLSB,
          program: clampedProgram,
          preset: clampedProgram,
          cacheKey,
          resolvedPresetName,
          note: resolvedPitch,
          containsNote: false,
          keyRange: null
        });
        this.playSampledNote({
          pitch: resolvedPitch,
          duration,
          volume: clampedVolume,
          instrument: this.getFallbackDrum(resolvedPitch),
          when,
          pan: clampedPan
        });
        return;
      }
      const fallbackInstrument = this.getFallbackInstrument(clampedProgram);
      this.playMidiNote(resolvedPitch, fallbackInstrument, duration, clampedVolume, this.ctx.currentTime + this.midiLatency, clampedPan);
    };
    if (!this.gmEnabled) {
      fallback();
      return;
    }
    if (!isDrums) {
      this.soundfont.setProgram(clampedProgram, resolvedChannel);
    }
    const preferWebAudioFont = isDrums
      && resolvedChannel === GM_DRUM_CHANNEL
      && resolvedBankLSB === GM_DRUM_BANK_LSB;
    if (preferWebAudioFont && this.drumFont.available === null) {
      this.ensureWebAudioFontAvailability();
    }
    if (preferWebAudioFont && this.isWebAudioFontReady()) {
      const when = this.ctx.currentTime + this.midiLatency;
      const used = this.playWebAudioFontDrum({
        note: resolvedPitch,
        when,
        duration,
        volume: clampedVolume,
        preset: clampedProgram
      });
      if (used) return;
    }
    this.gmNoteOnWithLoader({
      pitch: resolvedPitch,
      volume: clampedVolume,
      when,
      duration,
      resolvedChannel,
      isDrums,
      meta: {
        trackId: trackId ?? resolvedChannel,
        isDrum: isDrums,
        sourceNote: pitch,
        resolvedNote: resolvedPitch,
        bankMSB: resolvedBankMSB,
        bankLSB: resolvedBankLSB,
        program: clampedProgram,
        preset: isDrums ? clampedProgram : undefined
      }
    })
      .then((voice) => {
        if (!voice) return;
        const stopTime = when + duration + 0.2;
        this.registerMidiVoice({ voice, stopTime, channel: resolvedChannel });
        this.gmError = null;
      })
      .catch((error) => {
        if (isDrums) {
          const resolvedPresetName = this.soundfont.getDrumKitName?.() || 'synth_drum';
          const cacheKey = this.soundfont.getCacheKey?.({
            soundfontUrl: this.soundfont.baseUrl,
            name: resolvedPresetName,
            bankMSB: resolvedBankMSB,
            bankLSB: resolvedBankLSB,
            preset: clampedProgram,
            percussion: true
          });
          const message = `Drum SoundFont missing preset (bankMSB=${resolvedBankMSB}, bankLSB=${resolvedBankLSB}, preset=${clampedProgram}).`;
          this.gmError = message;
          this.logDrumNote({
            backend: 'soundfont',
            bankMSB: resolvedBankMSB,
            bankLSB: resolvedBankLSB,
            program: clampedProgram,
            preset: clampedProgram,
            cacheKey,
            resolvedPresetName,
            note: resolvedPitch,
            containsNote: false,
            keyRange: null,
            error
          });
          fallback();
          return;
        }
        fallback();
      });
  }

  startLiveGmNote({
    id,
    pitch = 60,
    duration = 8,
    volume = 0.8,
    program = 0,
    channel = 0,
    bankMSB = 0,
    bankLSB = 0,
    pan = 0,
    trackId = null
  }) {
    if (!id) return;
    this.stopLiveGmNote(id);
    this.ensureMidiSampler();
    const clampedProgram = clamp(program ?? 0, 0, GM_PROGRAMS.length - 1);
    const clampedVolume = clamp(volume ?? 1, 0, 1);
    const clampedPan = clamp(pan ?? 0, -1, 1);
    const isDrums = isDrumChannel(channel);
    const resolvedChannel = isDrums ? GM_DRUM_CHANNEL : clamp(channel ?? 0, 0, 15);
    const channelState = this.channelState[resolvedChannel] || this.channelState[0];
    let resolvedPitch = clamp(Math.round(pitch ?? GM_DRUM_NOTE_MIN), 0, 127);
    let resolvedBankMSB = bankMSB;
    let resolvedBankLSB = bankLSB;
    if (isDrums) {
      resolvedPitch = clampDrumPitch(resolvedPitch);
      resolvedBankMSB = GM_DRUM_BANK_MSB;
      resolvedBankLSB = Number.isInteger(bankLSB) ? bankLSB : GM_DRUM_BANK_LSB;
      const resolvedKit = this.drumKitManager.resolveKitFromBankProgram(resolvedBankMSB, resolvedBankLSB, clampedProgram)
        || this.drumKitManager.getDrumKit();
      if (resolvedKit?.soundfont) {
        this.soundfont.setDrumKitName(resolvedKit.soundfont);
        this.drumKitManager.setDrumKit(resolvedKit.id);
        channelState.drumKitId = resolvedKit.id;
      }
      channelState.bankMSB = resolvedBankMSB;
      channelState.bankLSB = resolvedBankLSB;
      channelState.program = clampedProgram;
      const drumLabel = GM_DRUMS.find((entry) => entry.pitch === resolvedPitch)?.label || 'Unknown Drum';
      this.midiDebug.lastDrumNote = { pitch: resolvedPitch, label: drumLabel };
      this.midiDebug.lastChannelType = 'percussion';
      this.midiDebug.lastChannel = resolvedChannel;
    } else {
      channelState.bankMSB = Number.isInteger(bankMSB) ? bankMSB : channelState.bankMSB;
      channelState.bankLSB = Number.isInteger(bankLSB) ? bankLSB : channelState.bankLSB;
      channelState.program = clampedProgram;
      this.midiDebug.lastChannelType = 'melodic';
      this.midiDebug.lastChannel = resolvedChannel;
    }
    if (this.soundfont?.debug) {
      // eslint-disable-next-line no-console
      console.debug('[Audio] GM live noteOn', {
        trackId,
        channel: resolvedChannel,
        isDrum: isDrums,
        pitch: resolvedPitch,
        program: clampedProgram,
        bankMSB: resolvedBankMSB,
        bankLSB: resolvedBankLSB
      });
    }
    if (!this.gmEnabled) {
      this.playMidiNote(resolvedPitch, this.getFallbackInstrument(clampedProgram), duration, clampedVolume, null, clampedPan);
      return;
    }
    if (!isDrums) {
      this.soundfont.setProgram(clampedProgram, resolvedChannel);
    }
    const preferWebAudioFont = isDrums
      && resolvedChannel === GM_DRUM_CHANNEL
      && resolvedBankLSB === GM_DRUM_BANK_LSB;
    if (preferWebAudioFont && this.drumFont.available === null) {
      this.ensureWebAudioFontAvailability();
    }
    if (preferWebAudioFont && this.isWebAudioFontReady()) {
      const when = this.ctx.currentTime + this.midiLatency;
      const used = this.playWebAudioFontDrum({
        note: resolvedPitch,
        when,
        duration,
        volume: clampedVolume,
        preset: clampedProgram
      });
      if (used) return;
    }
    const when = this.ctx.currentTime + this.midiLatency;
    this.gmNoteOnWithLoader({
      pitch: resolvedPitch,
      volume: clampedVolume,
      when,
      duration,
      resolvedChannel,
      isDrums,
      meta: {
        trackId: trackId ?? resolvedChannel,
        isDrum: isDrums,
        sourceNote: pitch,
        resolvedNote: resolvedPitch,
        bankMSB: resolvedBankMSB,
        bankLSB: resolvedBankLSB,
        program: clampedProgram,
        preset: isDrums ? clampedProgram : undefined
      }
    })
      .then((voice) => {
        if (!voice) return;
        const stopTime = when + duration + 0.2;
        const entry = this.registerMidiVoice({ voice, stopTime, channel: resolvedChannel });
        if (entry) {
          this.liveMidiNotes.set(id, entry);
        }
        this.gmError = null;
      })
      .catch((error) => {
        if (isDrums) {
          const resolvedPresetName = this.soundfont.getDrumKitName?.() || 'synth_drum';
          const cacheKey = this.soundfont.getCacheKey?.({
            soundfontUrl: this.soundfont.baseUrl,
            name: resolvedPresetName,
            bankMSB: resolvedBankMSB,
            bankLSB: resolvedBankLSB,
            preset: clampedProgram,
            percussion: true
          });
          const message = `Drum SoundFont missing preset (bankMSB=${resolvedBankMSB}, bankLSB=${resolvedBankLSB}, preset=${clampedProgram}).`;
          this.gmError = message;
          this.logDrumNote({
            backend: 'soundfont',
            bankMSB: resolvedBankMSB,
            bankLSB: resolvedBankLSB,
            program: clampedProgram,
            preset: clampedProgram,
            cacheKey,
            resolvedPresetName,
            note: resolvedPitch,
            containsNote: false,
            keyRange: null,
            error
          });
          this.playSampledNote({
            pitch: resolvedPitch,
            duration,
            volume: clampedVolume,
            instrument: this.getFallbackDrum(resolvedPitch),
            when: this.ctx.currentTime + this.midiLatency,
            pan: clampedPan
          });
          return;
        }
        this.playMidiNote(resolvedPitch, this.getFallbackInstrument(clampedProgram), duration, clampedVolume, null, clampedPan);
      });
  }

  gmNoteOnWithLoader({
    pitch,
    volume,
    when,
    duration,
    resolvedChannel,
    isDrums,
    meta
  }) {
    const runNoteOn = () => this.soundfont.noteOn(pitch, volume, when, duration, resolvedChannel, meta);
    if (!this.soundfontLoader.enabled) {
      return runNoteOn();
    }
    const kit = isDrums ? this.drumKitManager.getDrumKit() : null;
    return this.soundfontLoader.ensureLoaded({
      channel: resolvedChannel,
      isDrum: isDrums,
      program: meta.program,
      bankMSB: meta.bankMSB,
      bankLSB: meta.bankLSB,
      kitName: kit?.soundfont
    }).then(runNoteOn);
  }

  testDrumKit({
    sequence = [36, 38, 42, 46, 45, 47, 50, 49, 51],
    intervalSeconds = 0.3,
    volume = 0.9
  } = {}) {
    this.ensureMidiSampler();
    this.ensureWebAudioFontAvailability()
      .then((available) => {
        // eslint-disable-next-line no-console
        console.debug('[Audio] testDrumKit WebAudioFont active:', available);
      });
    const start = performance.now();
    sequence.forEach((pitch, index) => {
      const delay = Math.max(0, intervalSeconds) * 1000 * index;
      window.setTimeout(() => {
        this.playGmNote({
          pitch,
          duration: 0.25,
          volume,
          program: 0,
          channel: GM_DRUM_CHANNEL,
          bankMSB: GM_DRUM_BANK_MSB,
          bankLSB: GM_DRUM_BANK_LSB,
          pan: 0,
          trackId: 'drum-test'
        });
      }, delay);
    });
    return performance.now() - start;
  }

  stopLiveGmNote(id) {
    if (!id) return;
    const entry = this.liveMidiNotes.get(id);
    if (!entry) return;
    try {
      if (entry.gain) {
        entry.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      }
      if (entry.stop) {
        entry.stop();
      }
    } catch (error) {
      // ignore
    }
    this.liveMidiNotes.delete(id);
  }

  playMidiNote(pitch, instrument = 'piano', duration = 0.5, volume = 1, when = null, pan = 0) {
    if (this.gmEnabled && LEGACY_INSTRUMENT_TO_PROGRAM[instrument] !== undefined) {
      this.playGmNote({
        pitch,
        duration,
        volume,
        program: LEGACY_INSTRUMENT_TO_PROGRAM[instrument],
        channel: 0,
        pan
      });
      return;
    }
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
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panNode) {
      panNode.pan.value = clamp(pan ?? 0, -1, 1);
      gain.connect(panNode);
      panNode.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    const now = when ?? this.ctx.currentTime;
    const attack = preset.attack ?? 0.01;
    const decay = preset.decay ?? 0.1;
    const sustain = preset.sustain ?? 0.6;
    const release = preset.release ?? 0.2;
    const baseLevel = 0.35;
    const level = Math.max(0.02, Math.min(1, baseLevel * (volume ?? 1)));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + attack);
    gain.gain.exponentialRampToValueAtTime(level * sustain, now + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);
    osc.start(now);
    osc.stop(now + duration + release + 0.02);
  }

  playSampledNote({
    pitch = 60,
    duration = 0.4,
    volume = 0.8,
    instrument = 'lead',
    when = null,
    pan = 0,
    pedals = []
  }) {
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
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const now = when ?? this.ctx.currentTime;
    this.applyPitchPhaserToSource(source, pedals, now, duration);
    const chain = this.applyPedalChainToNote(filter, pedals, now, duration);
    chain.output.connect(gain);
    if (panNode) {
      panNode.pan.value = clamp(pan ?? 0, -1, 1);
      gain.connect(panNode);
      panNode.connect(this.midiBus);
    } else {
      gain.connect(this.midiBus);
    }
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.2;
    gain.connect(reverbSend);
    reverbSend.connect(this.midiReverb);
    source.start(now);
    source.stop(now + duration + 0.1);
    this.registerMidiVoice({ source, gain, stopTime: now + duration + 0.12 });
    source.onended = () => {
      chain.cleanup?.();
    };
  }

  getFallbackInstrument(program) {
    const entry = GM_PROGRAMS[program];
    const family = entry?.family || '';
    if (family === 'Piano') return 'piano';
    if (family === 'Chromatic Percussion') return 'bell';
    if (family === 'Organ') return 'organ';
    if (family === 'Guitar') return program < 28 ? 'guitar-nylon' : 'guitar-electric';
    if (family === 'Bass') return 'bass';
    if (family === 'Strings' || family === 'Ensemble') {
      if (entry?.name?.includes('Choir') || entry?.name?.includes('Voice')) {
        return 'choir';
      }
      return 'strings';
    }
    if (family === 'Brass') return program < 60 ? 'trumpet' : 'brass';
    if (family === 'Reed') return 'sax';
    if (family === 'Pipe') return 'flute';
    if (family === 'Synth Lead') return 'synth-lead';
    if (family === 'Synth Pad') return 'synth-pad';
    if (family === 'Synth FX') return 'pluck';
    if (family === 'Ethnic') return 'guitar-nylon';
    if (family === 'Percussive') return 'marimba';
    if (family === 'Sound Effects') return 'sine';
    return 'triangle';
  }

  getFallbackDrum(pitch) {
    const entry = GM_DRUMS.find((drum) => drum.pitch === pitch);
    const label = entry?.label?.toLowerCase() || '';
    if (label.includes('kick') || label.includes('bass drum')) return 'kick';
    if (label.includes('snare') || label.includes('stick') || label.includes('clap')) return 'snare';
    if (label.includes('hi-hat') || label.includes('hat')) return 'hat';
    if (label.includes('cymbal') || label.includes('triangle') || label.includes('tambourine')) return 'crash';
    if (label.includes('tom')
      || label.includes('bongo')
      || label.includes('conga')
      || label.includes('timbale')
      || label.includes('agogo')
      || label.includes('cowbell')
      || label.includes('wood block')
      || label.includes('claves')
      || label.includes('cabasa')
      || label.includes('maracas')
      || label.includes('guiro')
      || label.includes('whistle')
      || label.includes('cuica')) {
      return 'tom';
    }
    return 'hat';
  }

  registerMidiVoice({ source, gain, stopTime, voice, channel = null }) {
    const resolveStop = () => {
      if (voice?.stop) return () => voice.stop();
      if (voice?.audioBufferSourceNode?.stop) return () => voice.audioBufferSourceNode.stop();
      if (source?.stop) return () => source.stop();
      return null;
    };
    const audioNode = voice?.audioBufferSourceNode || voice?.source || source || null;
    const basePlaybackRate = audioNode?.playbackRate?.value ?? 1;
    const entry = { source, gain, stopTime, stop: resolveStop(), voice, audioNode, basePlaybackRate, channel };
    const channelBend = Number.isFinite(channel) ? this.channelPitchBendSemitones[channel] ?? 0 : 0;
    const bend = channelBend || this.midiPitchBendSemitones;
    if (audioNode?.playbackRate && bend) {
      audioNode.playbackRate.value = basePlaybackRate * (2 ** (bend / 12));
    }
    this.midiVoices.push(entry);
    if (this.midiVoices.length > this.midiVoiceLimit) {
      const oldest = this.midiVoices.shift();
      if (oldest) {
        try {
          if (oldest.gain) {
            oldest.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
          }
          if (oldest.stop) {
            oldest.stop();
          }
        } catch (error) {
          // ignore
        }
      }
    }
    this.midiVoices = this.midiVoices.filter((voice) => voice.stopTime > this.ctx.currentTime);
    return entry;
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
