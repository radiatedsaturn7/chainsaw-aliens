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
import { loadServerPreference, saveServerPreference } from '../ui/serverPreferences.js';

const DEFAULT_GM_SOUND_FONT_URL = 'vendor/soundfonts/FluidR3_GM/';
const FALLBACK_GM_SOUND_FONT_URL = 'vendor/soundfonts/FluidR3_GM/';
const SOUNDFONT_CDN_URLS = {
  vendored: 'vendor/soundfonts/FluidR3_GM/'
};
const WEB_AUDIOFONT_BASE_URL = 'vendor/webaudiofont/';
const WEB_AUDIOFONT_KIT = 'Chaos_sf2_file';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const decodeDataUrlBytes = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};
const SFX_ENVELOPE_SPECS = {
  volume: { min: 0, max: 2, defaultValue: 1 },
  pitch: { min: -2400, max: 2400, defaultValue: 0 },
  pan: { min: -1, max: 1, defaultValue: 0 }
};
const normalizeSfxEnvelope = (type = 'pitch', envelope = {}) => {
  const spec = SFX_ENVELOPE_SPECS[type] || SFX_ENVELOPE_SPECS.pitch;
  const legacyStart = type === 'pitch' ? Number(envelope?.startCents || 0) : spec.defaultValue;
  const legacyEnd = type === 'pitch' ? Number(envelope?.endCents || 0) : spec.defaultValue;
  const readValue = (point, fallback) => point?.value ?? point?.cents ?? fallback;
  const rawPoints = Array.isArray(envelope?.points) && envelope.points.length
    ? envelope.points
    : [
      { time: 0, value: legacyStart },
      { time: 1, value: legacyEnd }
    ];
  const points = rawPoints
    .map((point, index) => ({
      time: clamp(Number(point?.time ?? 0), 0, 1),
      value: clamp(Number(readValue(point, index === 0 ? legacyStart : legacyEnd)), spec.min, spec.max)
    }))
    .sort((a, b) => a.time - b.time);
  if (!points.some((point) => point.time === 0)) points.unshift({ time: 0, value: points[0]?.value ?? spec.defaultValue });
  if (!points.some((point) => point.time === 1)) points.push({ time: 1, value: points[points.length - 1]?.value ?? spec.defaultValue });
  return {
    enabled: Boolean(envelope?.enabled || (type === 'pitch' && (legacyStart || legacyEnd))),
    points
  };
};

const normalizeSfxEnvelopes = (source = {}) => ({
  volume: normalizeSfxEnvelope('volume', source?.envelopes?.volume),
  pitch: normalizeSfxEnvelope('pitch', source?.envelopes?.pitch || source?.pitchEnvelope),
  pan: normalizeSfxEnvelope('pan', source?.envelopes?.pan)
});

const scheduleSfxEnvelopeParam = (audioParam, type, envelope, now, duration, transform = (value) => value) => {
  const spec = SFX_ENVELOPE_SPECS[type] || SFX_ENVELOPE_SPECS.pitch;
  const normalized = normalizeSfxEnvelope(type, envelope);
  const points = normalized.enabled ? normalized.points : [{ time: 0, value: spec.defaultValue }];
  points.forEach((point, index) => {
    const value = transform(Number(point.value ?? spec.defaultValue));
    const time = now + clamp(Number(point.time || 0), 0, 1) * Math.max(0.02, duration);
    if (index === 0) audioParam.setValueAtTime(value, now);
    else audioParam.linearRampToValueAtTime(value, time);
  });
};

const getAverageSfxPlaybackRate = (pitchEnvelope, baseOctaves = 0) => {
  const envelope = normalizeSfxEnvelope('pitch', pitchEnvelope);
  const points = envelope.enabled ? envelope.points : [{ time: 0, value: 0 }, { time: 1, value: 0 }];
  if (!points.length) return 2 ** baseOctaves;
  let area = 0;
  const sorted = [...points].sort((a, b) => a.time - b.time);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const dt = Math.max(0, Number(b.time || 0) - Number(a.time || 0));
    const rateA = 2 ** (baseOctaves + Number(a.value || 0) / 1200);
    const rateB = 2 ** (baseOctaves + Number(b.value || 0) / 1200);
    area += dt * (rateA + rateB) * 0.5;
  }
  if (sorted[0].time > 0) {
    area += sorted[0].time * (2 ** (baseOctaves + Number(sorted[0].value || 0) / 1200));
  }
  const last = sorted[sorted.length - 1];
  if (last.time < 1) {
    area += (1 - last.time) * (2 ** (baseOctaves + Number(last.value || 0) / 1200));
  }
  return Math.max(0.0001, area);
};

const getEffectiveSfxLayerPlaybackDuration = (layer, pitchEnvelope, pitchBase = 0) => {
  const nominal = Math.max(0, Number(layer?.duration || 0));
  if (nominal <= 0) return 0;
  return nominal / getAverageSfxPlaybackRate(pitchEnvelope, pitchBase);
};
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

export const getGmSustainProfile = ({ program = 0, channel = 0, isDrums = false } = {}) => {
  if (isDrums || isDrumChannel(channel)) {
    return {
      mode: 'oneshot',
      attack: 0.002,
      decay: 0.04,
      sustain: 0.0001,
      tail: 0.0001,
      release: 0.06,
      maxDuration: 0.9,
      loopSample: false
    };
  }
  const entry = GM_PROGRAMS[clamp(program ?? 0, 0, GM_PROGRAMS.length - 1)] || {};
  const family = entry.family || '';
  const name = String(entry.name || '').toLowerCase();
  if (family === 'Organ' || family === 'Strings' || family === 'Ensemble' || family === 'Synth Pad') {
    return {
      mode: 'sustain',
      attack: family === 'Synth Pad' ? 0.03 : 0.01,
      decay: 0.18,
      sustain: family === 'Synth Pad' ? 0.9 : 0.82,
      tail: 0.7,
      release: family === 'Synth Pad' ? 0.55 : 0.34,
      maxDuration: Infinity,
      loopSample: true
    };
  }
  if (family === 'Synth Lead' || family === 'Brass' || family === 'Reed' || family === 'Pipe') {
    return {
      mode: 'sustain',
      attack: 0.012,
      decay: 0.16,
      sustain: 0.74,
      tail: 0.58,
      release: 0.28,
      maxDuration: Infinity,
      loopSample: true
    };
  }
  if (family === 'Guitar' || family === 'Bass' || name.includes('pluck')) {
    return {
      mode: 'decay',
      attack: 0.006,
      decay: family === 'Bass' ? 0.7 : 0.95,
      sustain: family === 'Bass' ? 0.38 : 0.28,
      tail: family === 'Bass' ? 0.16 : 0.08,
      release: 0.22,
      maxDuration: family === 'Bass' ? 8 : 6,
      loopSample: true
    };
  }
  if (family === 'Piano' || family === 'Chromatic Percussion' || family === 'Percussive' || family === 'Ethnic') {
    return {
      mode: 'decay',
      attack: 0.006,
      decay: family === 'Piano' ? 1.2 : 0.75,
      sustain: family === 'Piano' ? 0.22 : 0.18,
      tail: 0.04,
      release: 0.2,
      maxDuration: family === 'Piano' ? 7 : 4,
      loopSample: true
    };
  }
  return {
    mode: 'sustain',
    attack: 0.01,
    decay: 0.18,
    sustain: 0.65,
    tail: 0.42,
    release: 0.28,
    maxDuration: Infinity,
    loopSample: true
  };
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
    this.midiPreviewVoiceLimit = 12;
    this.midiLatency = 0.04;
    this.midiBusVolume = 0.9;
    this.midiBusHeadroom = 0.78;
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
    this.soundfontSampleCache = new Map();
    this.midiPedalBusCache = new Map();
    this.midiPedalBusLimit = 12;
    this.midiPedalBusMaxAgeSeconds = 45;
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
    this.sfxBufferCache = new Map();
    this.activeSfxSources = new Map();
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

  beginMasterCapture({ monitor = true } = {}) {
    this.ensure();
    if (!this.ctx?.createMediaStreamDestination) return null;
    const destination = this.ctx.createMediaStreamDestination();
    const source = this.masterPanNode || this.master;
    if (!source) return null;
    source.connect(destination);
    let monitorMuted = false;
    if (monitor === false && this.ctx.destination) {
      try {
        source.disconnect(this.ctx.destination);
        monitorMuted = true;
      } catch (_error) {
        monitorMuted = false;
      }
    }
    return { destination, source, stream: destination.stream, monitor, monitorMuted, output: this.ctx.destination };
  }

  endMasterCapture(capture) {
    if (!capture?.source || !capture?.destination) return;
    try {
      capture.source.disconnect(capture.destination);
    } catch (_error) {
      // Capture cleanup must not interrupt game audio.
    }
    if (capture.monitor === false && capture.monitorMuted && capture.output) {
      try {
        capture.source.connect(capture.output);
      } catch (_error) {
        // Restore best-effort audio monitoring after silent capture.
      }
    }
  }

  async decodeSfxLayer(layer) {
    if (!layer?.wavDataUrl) return null;
    const key = layer.id || layer.wavDataUrl.slice(0, 80);
    if (this.sfxBufferCache.has(key)) return this.sfxBufferCache.get(key);
    this.ensure();
    const bytes = decodeDataUrlBytes(layer.wavDataUrl);
    const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
    this.sfxBufferCache.set(key, buffer);
    return buffer;
  }

  pickSfxFrame(sfx, forcedFrameIndex = null) {
    const frames = Array.isArray(sfx?.frames) ? sfx.frames : [];
    const playable = frames
      .map((frame, index) => ({ frame, index }))
      .filter(({ frame, index }) => {
        const enabled = sfx?.settings?.enabledFrames;
        if (Array.isArray(enabled) && enabled.length && !enabled.includes(index)) return false;
        const layers = Array.isArray(frame?.layers) && frame.layers.length
          ? frame.layers
          : (frame?.wavDataUrl ? [{ ...frame, id: `${frame.id || 'legacy'}:layer` }] : []);
        return layers.some((layer) => layer?.wavDataUrl && !layer.muted);
      });
    if (!playable.length) return null;
    if (Number.isFinite(forcedFrameIndex)) {
      return playable.find((entry) => entry.index === forcedFrameIndex)?.frame || playable[0].frame;
    }
    if (sfx?.settings?.frameMode === 'current') return playable[0].frame;
    return playable[Math.floor(Math.random() * playable.length)].frame;
  }

  async playSfxDocument(sfx, {
    id = '',
    frameIndex = null,
    volume = 1,
    pitchCents = 0,
    pan = 0,
    loop = false
  } = {}) {
    const frame = this.pickSfxFrame(sfx, frameIndex);
    if (!frame) return null;
    this.ensure();
    const settings = sfx?.settings || {};
    const frameEnvelopes = normalizeSfxEnvelopes(frame);
    const pitchRand = ((Math.random() * 2 - 1) * Number(settings.pitchVarianceCents || 0)) / 1200;
    const pitchBase = pitchRand + Number(pitchCents || 0) / 1200;
    const volumeRand = 1 - Math.random() * clamp(Number(settings.volumeVariance || 0), 0, 1);
    const master = this.ctx.createGain();
    master.gain.value = clamp(Number(settings.baseVolume ?? 1) * Number(volume ?? 1) * volumeRand, 0, 3);
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panNode) {
      panNode.pan.value = clamp(Number(pan || 0), -1, 1);
      master.connect(panNode);
      panNode.connect(this.master);
    } else {
      master.connect(this.master);
    }
    const sources = [];
    const frameLayers = Array.isArray(frame.layers) && frame.layers.length
      ? frame.layers
      : (frame.wavDataUrl ? [{ ...frame, id: `${frame.id || 'legacy'}:layer`, volume: 1, muted: false }] : []);
    const layers = frameLayers.filter((layer) => layer?.wavDataUrl && !layer.muted);
    const scheduled = [];
    for (const layer of layers) {
      const buffer = await this.decodeSfxLayer(layer);
      if (!buffer) continue;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const layerPan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      source.buffer = buffer;
      source.loop = Boolean(loop || settings.loop);
      if (source.loop && frame.loopEnd > frame.loopStart) {
        source.loopStart = clamp(frame.loopStart, 0, buffer.duration);
        source.loopEnd = clamp(frame.loopEnd, source.loopStart + 0.01, buffer.duration);
      }
      gain.gain.value = clamp(Number(layer.volume ?? 1), 0, 2);
      source.connect(gain);
      if (layerPan) {
        layerPan.pan.value = clamp(Number(layer.pan || 0), -1, 1);
        gain.connect(layerPan);
        layerPan.connect(master);
      } else {
        gain.connect(master);
      }
      sources.push(source);
      scheduled.push({ source, gain, layerPan, layer, buffer, envelopes: layer.envelopes ? normalizeSfxEnvelopes(layer) : frameEnvelopes });
    }
    if (!sources.length) {
      try { master.disconnect(); } catch (_error) {}
      try { panNode?.disconnect?.(); } catch (_error) {}
      return null;
    }
    const handle = {
      id,
      sources,
      stop: () => {
        sources.forEach((source) => {
          try { source.stop(); } catch (_error) {}
          try { source.disconnect(); } catch (_error) {}
        });
        try { master.disconnect(); } catch (_error) {}
        try { panNode?.disconnect?.(); } catch (_error) {}
      }
    };
    if (id) {
      this.stopSfx(id);
      this.activeSfxSources.set(id, handle);
    }
    let remaining = sources.length;
    const startAt = this.ctx.currentTime + 0.005;
    scheduled.forEach(({ source, gain, layerPan, layer, buffer, envelopes }) => {
      const layerStart = startAt + Math.max(0, Number(layer.startTime || 0));
      const playbackDuration = getEffectiveSfxLayerPlaybackDuration({ ...layer, duration: buffer.duration }, envelopes.pitch, pitchBase) || buffer.duration;
      scheduleSfxEnvelopeParam(source.playbackRate, 'pitch', envelopes.pitch, layerStart, playbackDuration, (value) => 2 ** (pitchBase + value / 1200));
      scheduleSfxEnvelopeParam(gain.gain, 'volume', envelopes.volume, layerStart, playbackDuration, (value) => clamp(Number(layer.volume ?? 1) * value, 0, 3));
      if (layerPan) {
        scheduleSfxEnvelopeParam(layerPan.pan, 'pan', envelopes.pan, layerStart, playbackDuration, (value) => clamp(Number(layer.pan || 0) + value, -1, 1));
      }
    });
    scheduled.forEach(({ source, layer }) => {
      source.onended = () => {
        remaining -= 1;
        if (remaining <= 0) {
          if (id && this.activeSfxSources.get(id) === handle) this.activeSfxSources.delete(id);
          try { master.disconnect(); } catch (_error) {}
          try { panNode?.disconnect?.(); } catch (_error) {}
        }
      };
      source.start(startAt + Math.max(0, Number(layer?.startTime || 0)));
    });
    return handle;
  }

  stopSfx(id = '') {
    if (!id) {
      Array.from(this.activeSfxSources.values()).forEach((handle) => handle.stop?.());
      this.activeSfxSources.clear();
      return;
    }
    const handle = this.activeSfxSources.get(id);
    if (!handle) return;
    handle.stop?.();
    this.activeSfxSources.delete(id);
  }

  ensureMidiSampler() {
    this.ensure();
    if (this.midiBus) return;
    this.midiBus = this.ctx.createGain();
    this.midiBus.gain.value = this.midiBusVolume * this.midiBusHeadroom;
    this.midiLimiter = this.ctx.createDynamicsCompressor();
    this.midiLimiter.threshold.value = -16;
    this.midiLimiter.knee.value = 6;
    this.midiLimiter.ratio.value = 10;
    this.midiLimiter.attack.value = 0.002;
    this.midiLimiter.release.value = 0.16;
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
    this.midiBusVolume = nextValue;
    this.ensureMidiSampler();
    if (this.midiBus?.gain) {
      this.midiBus.gain.value = nextValue * this.midiBusHeadroom;
    }
  }

  loadStoredSoundfontUrl() {
    return loadServerPreference('chainsaw-gm-soundfont-url', DEFAULT_GM_SOUND_FONT_URL) || DEFAULT_GM_SOUND_FONT_URL;
  }

  setSoundfontUrl(url) {
    if (!url) return;
    const nextUrl = url.endsWith('/') ? url : `${url}/`;
    void saveServerPreference('chainsaw-gm-soundfont-url', nextUrl);
    this.soundfont.setBaseUrl(nextUrl);
    this.soundfontSampleCache.clear();
    this.clearMidiPedalBuses();
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
    this.soundfontSampleCache.clear();
    this.clearMidiPedalBuses();
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
    if (!this.gmEnabled) return Promise.resolve(null);
    if (isDrumChannel(channel)) {
      const kit = this.drumKitManager.resolveKitFromBankProgram(bankMSB, bankLSB, program);
      return this.soundfont.loadDrumKit(kit?.soundfont, {
        bankMSB: GM_DRUM_BANK_MSB,
        bankLSB: Number.isInteger(bankLSB) ? bankLSB : GM_DRUM_BANK_LSB,
        preset: clamp(program ?? 0, 0, GM_PROGRAMS.length - 1)
      }).catch(() => null);
    }
    return this.loadGmProgram(program).catch(() => null);
  }

  preloadWebAudioFontDrumNotes(notes = [], preset = 0) {
    if (!Array.isArray(notes) || !notes.length) return Promise.resolve([]);
    this.ensureMidiSampler();
    return this.ensureWebAudioFontAvailability()
      .then((available) => {
        if (!available) return [];
        return this.ensureDrumFontPlayer()
          .then((player) => {
            if (!player) return [];
            const uniqueNotes = Array.from(new Set(notes
              .map((note) => clampDrumPitch(Math.round(Number(note) || GM_DRUM_NOTE_MIN)))));
            return Promise.all(uniqueNotes.map((note) => this.loadDrumFontNote(note, preset).catch(() => null)));
          });
      })
      .catch(() => []);
  }

  collectSongResourceRequests(song = {}) {
    const programs = new Map();
    const drumNotesByPreset = new Map();
    const pedals = [];
    const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
    tracks.forEach((track) => {
      if (!track) return;
      const program = clamp(track.program ?? 0, 0, GM_PROGRAMS.length - 1);
      const isDrums = track.instrument === 'drums' || track.isPercussion === true || isDrumChannel(track.channel);
      const channel = isDrums ? GM_DRUM_CHANNEL : clamp(track.channel ?? 0, 0, 15);
      const bankMSB = isDrums ? GM_DRUM_BANK_MSB : (Number.isInteger(track.bankMSB) ? track.bankMSB : 0);
      const bankLSB = isDrums
        ? (Number.isInteger(track.bankLSB) ? track.bankLSB : GM_DRUM_BANK_LSB)
        : (Number.isInteger(track.bankLSB) ? track.bankLSB : 0);
      const key = `${channel}:${program}:${bankMSB}:${bankLSB}`;
      if (!programs.has(key)) programs.set(key, { program, channel, bankMSB, bankLSB });
      if (Array.isArray(track.midiPedals)) pedals.push(...track.midiPedals);
      if (isDrums) {
        const presetKey = String(program);
        const noteSet = drumNotesByPreset.get(presetKey) || new Set();
        const patterns = Array.isArray(track.patterns) ? track.patterns : [];
        patterns.forEach((pattern) => {
          const notes = Array.isArray(pattern?.notes) ? pattern.notes : [];
          notes.forEach((note) => noteSet.add(clampDrumPitch(Math.round(Number(note?.pitch) || GM_DRUM_NOTE_MIN))));
        });
        drumNotesByPreset.set(presetKey, noteSet);
      }
    });
    return {
      programs: Array.from(programs.values()),
      pedals,
      drumNotesByPreset
    };
  }

  preloadSongResources(song = {}) {
    const requests = this.collectSongResourceRequests(song);
    this.preloadPedalResources(requests.pedals);
    const loads = requests.programs.map(({ program, channel, bankMSB, bankLSB }) => (
      this.preloadSoundfontProgram(program, channel, bankMSB, bankLSB)
    ));
    requests.drumNotesByPreset.forEach((notes, presetKey) => {
      loads.push(this.preloadWebAudioFontDrumNotes(Array.from(notes), Number(presetKey) || 0));
    });
    return Promise.all(loads.map((load) => Promise.resolve(load).catch(() => null)));
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
    return this.buildImpulseResponseForContext(this.ctx, duration, decay);
  }

  buildImpulseResponseForContext(ctx, duration, decay) {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
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

  getPedalImpulseForContext(ctx, room = 0.5, decay = 0.5) {
    if (!ctx || ctx === this.ctx) return this.getPedalImpulse(room, decay);
    const duration = 0.25 + room * 1.8;
    const sharpness = 1.2 + decay * 4;
    return this.buildImpulseResponseForContext(ctx, duration, sharpness);
  }

  preloadPedalResources(pedals = []) {
    if (!Array.isArray(pedals) || !pedals.length) return;
    this.ensureMidiSampler();
    pedals.forEach((pedal) => {
      if (!pedal || pedal.enabled === false) return;
      if (pedal.type === 'reverb') {
        const knobs = pedal.knobs || {};
        this.getPedalImpulse(
          clamp(knobs.room ?? 0.5, 0, 1),
          clamp(knobs.decay ?? 0.6, 0, 1)
        );
      }
    });
  }

  applyPitchPhaserToSource(source, pedals = [], when = 0, duration = 0.4) {
    const pedal = this.getPedalByType(pedals, 'pitchPhaser');
    if (!pedal || !source?.playbackRate) return;
    const param = source.playbackRate;
    const baseRate = Number.isFinite(param.value) && param.value > 0 ? param.value : 1;
    const up = clamp(Number(pedal.knobs?.up) || 0, 0, 1);
    const down = clamp(Number(pedal.knobs?.down) || 0, 0, 1);
    const phase = clamp(Number(pedal.knobs?.phase) || 0.5, 0, 1);
    const depthSemis = 0.35 + ((up + down) * 1.15);
    const cycles = 0.5 + phase * 2.5;
    const safeWhen = Math.max(this.ctx?.currentTime || 0, Number.isFinite(when) ? when : 0);
    const safeDuration = Math.max(0.08, Number.isFinite(duration) ? duration : 0.4);
    const steps = Math.max(4, Math.min(16, Math.round(safeDuration * 16)));
    try {
      param.cancelScheduledValues(safeWhen);
      param.setValueAtTime(baseRate, safeWhen);
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const semitoneShift = Math.sin(t * Math.PI * 2 * cycles) * depthSemis;
        const rate = baseRate * (2 ** (semitoneShift / 12));
        param.linearRampToValueAtTime(rate, safeWhen + t * safeDuration);
      }
      param.linearRampToValueAtTime(baseRate, safeWhen + safeDuration + 0.03);
    } catch (error) {
      try {
        param.value = baseRate;
      } catch (innerError) {
        // ignore unsupported playbackRate automation
      }
    }
  }

  applyPedalChainToNote(inputNode, pedals = [], when = 0, duration = 0.4) {
    this.ensure();
    const enabled = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
    let current = inputNode;
    const createdNodes = [];
    const stopFns = [];
    const trackNode = (node) => {
      if (node) createdNodes.push(node);
      return node;
    };
    enabled.forEach((pedal) => {
      const knobs = pedal.knobs || {};
      if (pedal.type === 'compressor') {
        const comp = trackNode(this.ctx.createDynamicsCompressor());
        comp.threshold.value = -38 + clamp(knobs.threshold ?? 0.42, 0, 1) * 30;
        comp.ratio.value = 1.4 + clamp(knobs.ratio ?? 0.45, 0, 1) * 9;
        comp.attack.value = 0.002 + (1 - clamp(knobs.ratio ?? 0.5, 0, 1)) * 0.03;
        comp.release.value = 0.08 + clamp(knobs.makeup ?? 0.32, 0, 1) * 0.26;
        const makeup = trackNode(this.ctx.createGain());
        makeup.gain.value = 0.72 + clamp(knobs.makeup ?? 0.32, 0, 1) * 0.45;
        current.connect(comp);
        comp.connect(makeup);
        current = makeup;
      } else if (pedal.type === 'eq') {
        const low = trackNode(this.ctx.createBiquadFilter());
        low.type = 'lowshelf';
        low.frequency.value = 180;
        low.gain.value = (clamp(knobs.low ?? 0.5, 0, 1) - 0.5) * 24;
        const mid = trackNode(this.ctx.createBiquadFilter());
        mid.type = 'peaking';
        mid.frequency.value = 1150;
        mid.Q.value = 0.9;
        mid.gain.value = (clamp(knobs.mid ?? 0.5, 0, 1) - 0.5) * 20;
        const high = trackNode(this.ctx.createBiquadFilter());
        high.type = 'highshelf';
        high.frequency.value = 3400;
        high.gain.value = (clamp(knobs.high ?? 0.5, 0, 1) - 0.5) * 24;
        const presence = trackNode(this.ctx.createBiquadFilter());
        presence.type = 'peaking';
        presence.frequency.value = 4200;
        presence.Q.value = 1.2;
        presence.gain.value = (clamp(knobs.presence ?? 0.5, 0, 1) - 0.5) * 12;
        current.connect(low); low.connect(mid); mid.connect(high); high.connect(presence);
        current = presence;
      } else if (pedal.type === 'overdrive') {
        const drive = clamp(knobs.drive ?? 0.6, 0, 1);
        const toneValue = clamp(knobs.tone ?? 0.5, 0, 1);
        const biteValue = clamp(knobs.bite ?? 0.5, 0, 1);
        const pre = trackNode(this.ctx.createGain());
        pre.gain.value = 1 + drive * 3.8;
        const shape = trackNode(this.ctx.createWaveShaper());
        shape.curve = this.buildDistortionCurve(drive * 0.72);
        try {
          shape.oversample = '4x';
        } catch (error) {
          shape.oversample = 'none';
        }
        const tone = trackNode(this.ctx.createBiquadFilter());
        tone.type = 'lowpass';
        tone.frequency.value = 1200 + toneValue * 5200;
        const bite = trackNode(this.ctx.createBiquadFilter());
        bite.type = 'highpass';
        bite.frequency.value = 55 + biteValue * 420;
        const out = trackNode(this.ctx.createGain());
        out.gain.value = 0.34 + (1 - drive) * 0.28;
        current.connect(pre); pre.connect(shape); shape.connect(tone); tone.connect(bite); bite.connect(out);
        current = out;
      } else if (pedal.type === 'tape') {
        const drive = clamp(knobs.drive ?? 0.34, 0, 1);
        const toneValue = clamp(knobs.tone ?? 0.52, 0, 1);
        const wow = clamp(knobs.wow ?? 0.18, 0, 1);
        const pre = trackNode(this.ctx.createGain());
        pre.gain.value = 1 + drive * 1.6;
        const shape = trackNode(this.ctx.createWaveShaper());
        shape.curve = this.buildDistortionCurve(drive * 0.22, 2048);
        try {
          shape.oversample = '2x';
        } catch (error) {
          shape.oversample = 'none';
        }
        const tone = trackNode(this.ctx.createBiquadFilter());
        tone.type = 'lowpass';
        tone.frequency.value = 3600 + toneValue * 5200;
        const delay = trackNode(this.ctx.createDelay(0.05));
        delay.delayTime.value = 0.012;
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
        lfo.frequency.value = 0.18 + wow * 1.2;
        lfoGain.gain.value = wow * 0.0028;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        const out = trackNode(this.ctx.createGain());
        out.gain.value = 0.64 + (1 - drive) * 0.12;
        current.connect(pre); pre.connect(shape); shape.connect(tone); tone.connect(delay); delay.connect(out);
        current = out;
      } else if (pedal.type === 'wah') {
        const filter = trackNode(this.ctx.createBiquadFilter());
        filter.type = 'bandpass';
        filter.Q.value = 0.55 + clamp(knobs.mix ?? 0.48, 0, 1) * 1.8;
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
        lfo.frequency.value = 0.12 + clamp(knobs.rate ?? 0.38, 0, 1) * 1.65;
        lfoGain.gain.value = 120 + clamp(knobs.sweep ?? 0.48, 0, 1) * 760;
        filter.frequency.setTargetAtTime(560, Math.max(this.ctx.currentTime, when), 0.015);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        current.connect(filter);
        current = filter;
      } else if (pedal.type === 'chorus') {
        const mix = clamp(knobs.mix ?? 0.42, 0, 1);
        const depth = clamp(knobs.depth ?? 0.38, 0, 1);
        const spread = clamp(knobs.spread ?? 0.36, 0, 1);
        const dry = trackNode(this.ctx.createGain());
        dry.gain.value = 1 - mix * 0.24;
        const wet = trackNode(this.ctx.createGain());
        wet.gain.value = mix * 0.28;
        const delay = trackNode(this.ctx.createDelay(0.06));
        delay.delayTime.value = 0.012 + spread * 0.016;
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
        lfo.frequency.value = 0.15 + depth * 2.4;
        lfoGain.gain.value = 0.001 + depth * 0.004;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        const sum = trackNode(this.ctx.createGain());
        current.connect(dry);
        current.connect(delay);
        delay.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'phaser') {
        const rate = clamp(knobs.rate ?? 0.42, 0, 1);
        const depth = clamp(knobs.depth ?? 0.42, 0, 1);
        const mix = clamp(knobs.mix ?? 0.38, 0, 1);
        const dry = trackNode(this.ctx.createGain());
        dry.gain.value = 1 - mix * 0.26;
        const wet = trackNode(this.ctx.createGain());
        wet.gain.value = mix * 0.32;
        const stages = Array.from({ length: 4 }, () => trackNode(this.ctx.createBiquadFilter()));
        stages.forEach((stage) => {
          stage.type = 'allpass';
          stage.frequency.value = 400;
          stage.Q.value = 0.8;
        });
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
        lfo.frequency.value = 0.16 + rate * 2.8;
        lfoGain.gain.value = 120 + depth * 900;
        lfo.connect(lfoGain);
        stages.forEach((stage) => lfoGain.connect(stage.frequency));
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        const sum = trackNode(this.ctx.createGain());
        current.connect(dry);
        current.connect(stages[0]);
        stages.reduce((prev, next) => { prev.connect(next); return next; });
        stages[stages.length - 1].connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'reverb') {
        const mix = clamp(knobs.mix ?? 0.34, 0, 1);
        const room = clamp(knobs.room ?? 0.45, 0, 1);
        const decay = clamp(knobs.decay ?? 0.44, 0, 1);
        const dry = trackNode(this.ctx.createGain());
        const wet = trackNode(this.ctx.createGain());
        dry.gain.value = 1 - mix * 0.3;
        wet.gain.value = mix * 0.42;
        const convolver = trackNode(this.ctx.createConvolver());
        convolver.buffer = this.getPedalImpulse(room, decay);
        const wetLowpass = trackNode(this.ctx.createBiquadFilter());
        wetLowpass.type = 'lowpass';
        wetLowpass.frequency.value = 2800 + (1 - decay) * 2400;
        const wetHighpass = trackNode(this.ctx.createBiquadFilter());
        wetHighpass.type = 'highpass';
        wetHighpass.frequency.value = 90;
        const sum = trackNode(this.ctx.createGain());
        current.connect(dry);
        current.connect(convolver);
        convolver.connect(wetHighpass);
        wetHighpass.connect(wetLowpass);
        wetLowpass.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'echo') {
        const time = clamp(knobs.time ?? 0.32, 0, 1);
        const feedback = clamp(knobs.feedback ?? 0.24, 0, 0.62);
        const mix = clamp(knobs.mix ?? 0.34, 0, 1);
        const delay = trackNode(this.ctx.createDelay(1.5));
        delay.delayTime.value = 0.07 + time * 0.46;
        const fb = trackNode(this.ctx.createGain());
        fb.gain.value = 0.1 + feedback * 0.5;
        const toneLow = trackNode(this.ctx.createBiquadFilter());
        toneLow.type = 'lowpass';
        toneLow.frequency.value = 1700 + (1 - feedback) * 3600;
        const toneHigh = trackNode(this.ctx.createBiquadFilter());
        toneHigh.type = 'highpass';
        toneHigh.frequency.value = 90 + feedback * 120;
        const dry = trackNode(this.ctx.createGain());
        dry.gain.value = 1 - mix * 0.24;
        const wet = trackNode(this.ctx.createGain());
        wet.gain.value = mix * 0.36;
        const sum = trackNode(this.ctx.createGain());
        current.connect(dry);
        current.connect(delay);
        delay.connect(toneHigh);
        toneHigh.connect(toneLow);
        toneLow.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        dry.connect(sum);
        wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'studioEq') {
        const lowCut = clamp(knobs.lowCut ?? 0.32, 0, 1);
        const warmth = clamp(knobs.warmth ?? 0.52, 0, 1);
        const presenceValue = clamp(knobs.presence ?? 0.54, 0, 1);
        const airValue = clamp(knobs.air ?? 0.5, 0, 1);
        const highpass = trackNode(this.ctx.createBiquadFilter());
        highpass.type = 'highpass';
        highpass.frequency.value = 30 + lowCut * 170;
        const warm = trackNode(this.ctx.createBiquadFilter());
        warm.type = 'lowshelf';
        warm.frequency.value = 220;
        warm.gain.value = (warmth - 0.5) * 7;
        const presence = trackNode(this.ctx.createBiquadFilter());
        presence.type = 'peaking';
        presence.frequency.value = 2800;
        presence.Q.value = 0.85;
        presence.gain.value = (presenceValue - 0.5) * 6;
        const air = trackNode(this.ctx.createBiquadFilter());
        air.type = 'highshelf';
        air.frequency.value = 7600;
        air.gain.value = (airValue - 0.5) * 5;
        const out = trackNode(this.ctx.createGain());
        out.gain.value = 0.96;
        current.connect(highpass); highpass.connect(warm); warm.connect(presence); presence.connect(air); air.connect(out);
        current = out;
      } else if (pedal.type === 'volumePhaser') {
        const minV = clamp(knobs.down ?? 0.35, 0.02, 1);
        const maxV = clamp(knobs.up ?? 0.95, 0.02, 1);
        const phase = clamp(knobs.phase ?? 0.55, 0, 1);
        const gain = trackNode(this.ctx.createGain());
        gain.gain.value = (minV + maxV) * 0.45;
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
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
        const panner = trackNode(this.ctx.createStereoPanner());
        panner.pan.value = 0;
        const lfo = trackNode(this.ctx.createOscillator());
        const lfoGain = trackNode(this.ctx.createGain());
        lfo.frequency.value = 0.2 + phase * 4.4;
        lfoGain.gain.value = Math.max(0.05, Math.min(1, (maxL + maxR) * 0.5));
        lfo.connect(lfoGain);
        lfoGain.connect(panner.pan);
        lfo.start(when);
        lfo.stop(when + duration + 0.2);
        stopFns.push(() => lfo.disconnect());
        current.connect(panner);
        current = panner;
      } else if (pedal.type === 'limiter') {
        const threshold = clamp(knobs.threshold ?? 0.58, 0, 1);
        const ceiling = clamp(knobs.ceiling ?? 0.72, 0, 1);
        const release = clamp(knobs.release ?? 0.34, 0, 1);
        const limiter = trackNode(this.ctx.createDynamicsCompressor());
        limiter.threshold.value = -22 + threshold * 14;
        limiter.knee.value = 1.5;
        limiter.ratio.value = 12 + threshold * 8;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.04 + release * 0.22;
        const ceilingGain = trackNode(this.ctx.createGain());
        ceilingGain.gain.value = 0.72 + ceiling * 0.22;
        current.connect(limiter);
        limiter.connect(ceilingGain);
        current = ceilingGain;
      }
    });

    const outputTrim = trackNode(this.ctx.createGain());
    outputTrim.gain.value = enabled.length ? 0.76 : 1;
    current.connect(outputTrim);
    return {
      output: outputTrim,
      cleanup: () => {
        stopFns.forEach((fn) => {
          try { fn(); } catch (error) { /* ignore */ }
        });
        createdNodes.forEach((node) => {
          try { node.disconnect(); } catch (error) { /* ignore */ }
        });
      }
    };
  }

  playDspPedalGmNote({ pitch, duration, volume, program, pan, isDrums, when, pedals = [], voiceGroup = 'timeline' }) {
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
        pedals,
        voiceGroup
      });
    });
  }

  async getSoundfontBufferForNote({
    pitch = 60,
    program = 0,
    channel = 0,
    bankMSB = 0,
    bankLSB = 0
  } = {}) {
    if (!this.gmEnabled) return null;
    this.ensureMidiSampler();
    const isDrums = isDrumChannel(channel);
    const resolvedPitch = isDrums ? clampDrumPitch(Math.round(pitch)) : clamp(Math.round(pitch), 0, 127);
    const clampedProgram = clamp(program ?? 0, 0, GM_PROGRAMS.length - 1);
    let instrument = null;
    let sampleCacheKey = null;
    if (isDrums) {
      const kit = this.drumKitManager.resolveKitFromBankProgram(GM_DRUM_BANK_MSB, bankLSB, clampedProgram)
        || this.drumKitManager.getDrumKit();
      sampleCacheKey = [
        this.soundfont.baseUrl,
        'drums',
        kit?.soundfont || this.soundfont.getDrumKitName?.() || 'standard_kit',
        GM_DRUM_BANK_MSB,
        bankLSB ?? GM_DRUM_BANK_LSB,
        clampedProgram,
        resolvedPitch
      ].join(':');
      if (this.soundfontSampleCache.has(sampleCacheKey)) {
        return this.soundfontSampleCache.get(sampleCacheKey);
      }
      if (kit?.soundfont) {
        this.soundfont.setDrumKitName(kit.soundfont);
        this.drumKitManager.setDrumKit(kit.id);
      }
      instrument = await this.soundfont.loadDrumKit(kit?.soundfont, {
        bankMSB: GM_DRUM_BANK_MSB,
        bankLSB: Number.isInteger(bankLSB) ? bankLSB : GM_DRUM_BANK_LSB,
        preset: clampedProgram
      });
    } else {
      sampleCacheKey = [
        this.soundfont.baseUrl,
        'inst',
        bankMSB ?? 0,
        bankLSB ?? 0,
        clampedProgram,
        resolvedPitch
      ].join(':');
      if (this.soundfontSampleCache.has(sampleCacheKey)) {
        return this.soundfontSampleCache.get(sampleCacheKey);
      }
      this.soundfont.setProgram(clampedProgram, clamp(channel ?? 0, 0, 15));
      instrument = await this.soundfont.loadInstrument(clampedProgram);
    }
    if (!instrument?.buffers) return null;
    const exact = instrument.buffers[String(resolvedPitch)];
    if (exact) {
      const sample = { buffer: exact, baseNote: resolvedPitch, isDrums, isSoundfont: true };
      this.soundfontSampleCache.set(sampleCacheKey, sample);
      return sample;
    }
    const notes = this.soundfont.getInstrumentNotes(instrument);
    if (!notes.length) return null;
    const baseNote = notes.reduce((best, note) => (
      Math.abs(note - resolvedPitch) < Math.abs(best - resolvedPitch) ? note : best
    ), notes[0]);
    const buffer = instrument.buffers[String(baseNote)];
    if (!buffer) return null;
    const sample = { buffer, baseNote, isDrums, isSoundfont: true };
    this.soundfontSampleCache.set(sampleCacheKey, sample);
    return sample;
  }

  getMidiPedalBus({ pedals = [], pan = 0, channel = 0, trackId = null } = {}) {
    const enabled = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
    if (!enabled.length) return null;
    this.pruneMidiPedalBusCache();
    const key = JSON.stringify({
      trackId: trackId ?? channel ?? 0,
      pan: Math.round(clamp(pan ?? 0, -1, 1) * 1000) / 1000,
      pedals: enabled
    });
    const cached = this.midiPedalBusCache.get(key);
    if (cached) {
      cached.lastUsed = this.ctx.currentTime;
      return cached;
    }

    const input = this.ctx.createGain();
    const chain = this.applyPedalChainToNote(input, enabled, this.ctx.currentTime, 3600);
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.2;
    if (panNode) {
      panNode.pan.value = clamp(pan ?? 0, -1, 1);
      chain.output.connect(panNode);
      panNode.connect(this.midiBus);
    } else {
      chain.output.connect(this.midiBus);
    }
    chain.output.connect(reverbSend);
    reverbSend.connect(this.midiReverb);
    const bus = {
      input,
      lastUsed: this.ctx.currentTime,
      cleanup: () => {
        chain.cleanup?.();
        [input, panNode, reverbSend].forEach((node) => {
          if (!node) return;
          try { node.disconnect(); } catch (error) { /* ignore */ }
        });
      }
    };
    this.midiPedalBusCache.set(key, bus);
    this.pruneMidiPedalBusCache();
    return bus;
  }

  pruneMidiPedalBusCache() {
    if (!this.ctx || !this.midiPedalBusCache?.size) return;
    const now = this.ctx.currentTime;
    this.midiPedalBusCache.forEach((bus, key) => {
      if (now - (bus.lastUsed ?? now) <= this.midiPedalBusMaxAgeSeconds) return;
      try { bus.cleanup?.(); } catch (error) { /* ignore */ }
      this.midiPedalBusCache.delete(key);
    });
    while (this.midiPedalBusCache.size > this.midiPedalBusLimit) {
      let oldestKey = null;
      let oldestTime = Infinity;
      this.midiPedalBusCache.forEach((bus, key) => {
        const lastUsed = bus.lastUsed ?? 0;
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed;
          oldestKey = key;
        }
      });
      if (oldestKey === null) break;
      const oldest = this.midiPedalBusCache.get(oldestKey);
      try { oldest?.cleanup?.(); } catch (error) { /* ignore */ }
      this.midiPedalBusCache.delete(oldestKey);
    }
  }

  clearMidiPedalBuses() {
    this.midiPedalBusCache.forEach((bus) => {
      try { bus.cleanup?.(); } catch (error) { /* ignore */ }
    });
    this.midiPedalBusCache.clear();
  }

  getGmSustainProfile(options = {}) {
    return getGmSustainProfile(options);
  }

  getProfiledMidiDuration(duration = 0.5, profile = {}) {
    const requested = Math.max(0.03, Number(duration) || 0.03);
    if (profile.mode === 'oneshot') {
      return Math.min(requested, profile.maxDuration ?? requested);
    }
    return Math.min(requested, profile.maxDuration ?? requested);
  }

  configureSampleSustainLoop(source, sample, pitch, profile, duration, release) {
    if (!source || !sample?.buffer || sample.isDrums || profile.loopSample === false) return;
    const rate = Math.max(0.0001, source.playbackRate?.value || (2 ** ((pitch - sample.baseNote) / 12)));
    const audibleBufferDuration = sample.buffer.duration / rate;
    if (audibleBufferDuration >= duration + release + 0.04) return;
    const bufferDuration = sample.buffer.duration;
    if (!Number.isFinite(bufferDuration) || bufferDuration < 0.18) return;
    source.loop = true;
    source.loopStart = clamp(bufferDuration * 0.45, 0.04, Math.max(0.05, bufferDuration - 0.08));
    source.loopEnd = clamp(bufferDuration * 0.88, source.loopStart + 0.04, bufferDuration);
  }

  scheduleGmSustainEnvelope(gainParam, now, level, duration, profile = {}) {
    const attack = Math.max(0.001, profile.attack ?? 0.006);
    const decay = Math.max(0.001, profile.decay ?? 0.12);
    const release = Math.max(0.01, profile.release ?? 0.16);
    const effectiveDuration = this.getProfiledMidiDuration(duration, profile);
    const attackAt = now + Math.min(attack, Math.max(0.001, effectiveDuration * 0.45));
    const decayAt = Math.min(now + effectiveDuration, attackAt + decay);
    const sustainUntil = now + Math.max(attack, effectiveDuration);
    const peak = Math.max(0.0001, level);
    const sustainLevel = Math.max(0.0001, peak * clamp(profile.sustain ?? 0.7, 0.0001, 1));
    const tailLevel = Math.max(0.0001, peak * clamp(profile.tail ?? profile.sustain ?? 0.4, 0.0001, 1));
    gainParam.cancelScheduledValues?.(now);
    gainParam.setValueAtTime(0.0001, now);
    gainParam.exponentialRampToValueAtTime(peak, attackAt);
    if (profile.mode === 'oneshot') {
      gainParam.exponentialRampToValueAtTime(0.0001, sustainUntil + release);
      return { sustainUntil, stopAt: sustainUntil + release, release, effectiveDuration };
    }
    if (profile.mode === 'decay') {
      gainParam.exponentialRampToValueAtTime(sustainLevel, decayAt);
      if (sustainUntil > decayAt + 0.01) {
        gainParam.exponentialRampToValueAtTime(tailLevel, sustainUntil);
      }
    } else {
      gainParam.exponentialRampToValueAtTime(sustainLevel, decayAt);
      gainParam.setValueAtTime(sustainLevel, sustainUntil);
    }
    gainParam.exponentialRampToValueAtTime(0.0001, sustainUntil + release);
    return { sustainUntil, stopAt: sustainUntil + release, release, effectiveDuration };
  }

  playSoundfontPedalGmNote({
    pitch,
    duration,
    volume,
    program,
    channel = 0,
    bankMSB = 0,
    bankLSB = 0,
    pan,
    isDrums,
    when,
    pedals = [],
    trackId = null,
    voiceGroup = 'timeline',
    maxScheduleLatenessSeconds = 0.12,
    liveNoteId = null,
    onMissing = null
  }) {
    const scheduledWhen = Math.max(when ?? this.ctx.currentTime, this.ctx.currentTime);
    this.getSoundfontBufferForNote({ pitch, program, channel, bankMSB, bankLSB })
      .then((sample) => {
        if (this.ctx.currentTime > scheduledWhen + Math.max(0, Number(maxScheduleLatenessSeconds) || 0)) {
          return;
        }
        if (!sample?.buffer) {
          if (typeof onMissing === 'function') {
            onMissing();
            return;
          }
          this.playDspPedalGmNote({ pitch, duration, volume, program, pan, isDrums, when, pedals, voiceGroup });
          return;
        }
        const now = Math.max(scheduledWhen, this.ctx.currentTime);
        const source = this.ctx.createBufferSource();
        source.buffer = sample.buffer;
        source.playbackRate.value = sample.isDrums ? 1 : 2 ** ((pitch - sample.baseNote) / 12);
        const profile = this.getGmSustainProfile({ program, channel, isDrums: isDrums || sample.isDrums });
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 9000;
        const gain = this.ctx.createGain();
        const level = clamp(volume ?? 1, 0, 1);
        const envelope = this.scheduleGmSustainEnvelope(gain.gain, now, level, duration, profile);
        this.configureSampleSustainLoop(source, sample, pitch, profile, envelope.effectiveDuration, envelope.release);
        source.connect(filter);
        this.applyPitchPhaserToSource(source, pedals, now, envelope.effectiveDuration);
        filter.connect(gain);
        const bus = this.getMidiPedalBus({ pedals, pan, channel, trackId });
        const panNode = !bus && this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (bus) {
          gain.connect(bus.input);
        } else if (panNode) {
          panNode.pan.value = clamp(pan ?? 0, -1, 1);
          gain.connect(panNode);
          panNode.connect(this.midiBus);
        } else {
          gain.connect(this.midiBus);
        }
        const reverbSend = bus ? null : this.ctx.createGain();
        if (reverbSend) {
          reverbSend.gain.value = 0.2;
          gain.connect(reverbSend);
          reverbSend.connect(this.midiReverb);
        }
        source.start(now);
        source.stop(envelope.stopAt + 0.03);
        const entry = this.registerMidiVoice({ source, gain, stopTime: envelope.stopAt + 0.05, channel, group: voiceGroup });
        if (liveNoteId && entry) {
          entry.release = envelope.release;
          this.liveMidiNotes.set(liveNoteId, entry);
        }
        const cleanupInput = () => {
          [source, filter].forEach((node) => {
            if (!node) return;
            try { node.disconnect(); } catch (error) { /* ignore */ }
          });
        };
        const cleanupGraph = () => {
          cleanupInput();
          [gain, panNode, reverbSend].forEach((node) => {
            if (!node) return;
            try { node.disconnect(); } catch (error) { /* ignore */ }
          });
        };
        source.onended = cleanupInput;
        window.setTimeout(cleanupGraph, Math.max(0.2, envelope.effectiveDuration + envelope.release + 2.5) * 1000);
      })
      .catch(() => {
        if (this.ctx.currentTime > scheduledWhen + Math.max(0, Number(maxScheduleLatenessSeconds) || 0)) {
          return;
        }
        if (typeof onMissing === 'function') {
          onMissing();
          return;
        }
        this.playDspPedalGmNote({ pitch, duration, volume, program, pan, isDrums, when, pedals, voiceGroup });
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
    trackId = null,
    preview = false,
    voiceGroup = preview ? 'preview' : 'timeline',
    when = null,
    maxScheduleLatenessSeconds = 0.12
  }) {
    this.ensureMidiSampler();
    const clampedProgram = clamp(program ?? 0, 0, GM_PROGRAMS.length - 1);
    const hasPedals = Array.isArray(pedals) && pedals.some((pedal) => pedal && pedal.enabled !== false);
    const clampedVolume = clamp(volume ?? 1, 0, hasPedals ? 0.78 : 1);
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
    const resolvedWhen = Math.max(
      this.ctx.currentTime,
      Number.isFinite(when) ? when : this.ctx.currentTime + this.midiLatency
    );
    const isTooLate = () => this.ctx.currentTime > resolvedWhen + Math.max(0, Number(maxScheduleLatenessSeconds) || 0);
    const enabledPedals = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
    if (enabledPedals.length) {
      if (!this.gmEnabled) {
        this.playDspPedalGmNote({
          pitch: resolvedPitch,
          duration,
          volume: clampedVolume,
          program: clampedProgram,
          pan: clampedPan,
          isDrums,
          when: resolvedWhen,
          pedals: enabledPedals,
          voiceGroup
        });
        return;
      }
      this.playSoundfontPedalGmNote({
        pitch: resolvedPitch,
        duration,
        volume: clampedVolume,
        program: clampedProgram,
        channel: resolvedChannel,
        bankMSB: resolvedBankMSB,
        bankLSB: resolvedBankLSB,
        pan: clampedPan,
        isDrums,
        when: resolvedWhen,
        pedals: enabledPedals,
        trackId,
        voiceGroup,
        maxScheduleLatenessSeconds
      });
      return;
    }
    const fallback = () => {
      if (isTooLate()) return;
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
          when: resolvedWhen,
          pan: clampedPan,
          voiceGroup
        });
        return;
      }
      const fallbackInstrument = this.getFallbackInstrument(clampedProgram);
      this.playMidiNote(resolvedPitch, fallbackInstrument, duration, clampedVolume, resolvedWhen, clampedPan);
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
      const used = this.playWebAudioFontDrum({
        note: resolvedPitch,
        when: resolvedWhen,
        duration,
        volume: clampedVolume,
        preset: clampedProgram
      });
      if (used) return;
    }
    this.playSoundfontPedalGmNote({
      pitch: resolvedPitch,
      duration,
      volume: clampedVolume,
      program: clampedProgram,
      channel: resolvedChannel,
      bankMSB: resolvedBankMSB,
      bankLSB: resolvedBankLSB,
      pan: clampedPan,
      isDrums,
      when: resolvedWhen,
      pedals: [],
      trackId,
      voiceGroup,
      maxScheduleLatenessSeconds,
      onMissing: () => {
        if (!isTooLate()) fallback();
      }
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
    trackId = null,
    pedals = []
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
    const enabledPedals = Array.isArray(pedals) ? pedals.filter((pedal) => pedal && pedal.enabled !== false) : [];
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
    this.playSoundfontPedalGmNote({
      pitch: resolvedPitch,
      duration,
      volume: clampedVolume,
      program: clampedProgram,
      channel: resolvedChannel,
      bankMSB: resolvedBankMSB,
      bankLSB: resolvedBankLSB,
      pan: clampedPan,
      isDrums,
      when,
      pedals: enabledPedals,
      trackId,
      voiceGroup: 'preview',
      liveNoteId: id,
      onMissing: () => {
        if (isDrums) {
          this.playSampledNote({
            pitch: resolvedPitch,
            duration,
            volume: clampedVolume,
            instrument: this.getFallbackDrum(resolvedPitch),
            when: this.ctx.currentTime + this.midiLatency,
            pan: clampedPan,
            voiceGroup: 'preview'
          });
          return;
        }
        this.playMidiNote(resolvedPitch, this.getFallbackInstrument(clampedProgram), duration, clampedVolume, null, clampedPan);
      }
    });
  }

  gmNoteOnWithLoader({
    pitch,
    volume,
    when,
    duration,
    resolvedChannel,
    isDrums,
    meta,
    maxScheduleLatenessSeconds = 0.12
  }) {
    const runNoteOn = () => {
      if (this.ctx.currentTime > when + Math.max(0, Number(maxScheduleLatenessSeconds) || 0)) {
        return null;
      }
      return this.soundfont.noteOn(pitch, volume, Math.max(when, this.ctx.currentTime), duration, resolvedChannel, meta);
    };
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
        const release = Math.max(0.02, entry.release ?? 0.08);
        entry.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, release * 0.45);
      }
      if (entry.stop) {
        const release = Math.max(0.02, entry.release ?? 0.08);
        window.setTimeout(() => {
          try { entry.stop?.(); } catch (error) { /* ignore */ }
        }, Math.max(20, release * 1000));
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
    const cleanup = () => {
      [osc, output, gain, panNode].forEach((node) => {
        if (!node) return;
        try { node.disconnect(); } catch (error) { /* ignore */ }
      });
    };
    osc.onended = cleanup;
    window.setTimeout(cleanup, Math.max(0.2, duration + release + 0.5) * 1000);
  }

  playSampledNote({
    pitch = 60,
    duration = 0.4,
    volume = 0.8,
    instrument = 'lead',
    when = null,
    pan = 0,
    pedals = [],
    voiceGroup = 'timeline'
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
    const profile = this.getGmSustainProfile({
      program: LEGACY_INSTRUMENT_TO_PROGRAM[instrument] ?? 0,
      channel: isDrum ? GM_DRUM_CHANNEL : 0,
      isDrums: isDrum || sample.isDrums
    });
    const level = Math.max(0.0001, clamp(volume ?? 1, 0, 1));
    const envelope = this.scheduleGmSustainEnvelope(gain.gain, now, level, duration, profile);
    this.configureSampleSustainLoop(source, sample, pitch, profile, envelope.effectiveDuration, envelope.release);
    source.start(now);
    source.stop(envelope.stopAt + 0.03);
    this.registerMidiVoice({ source, gain, stopTime: envelope.stopAt + 0.05, group: voiceGroup });
    const cleanupInput = () => {
      [source, filter].forEach((node) => {
        if (!node) return;
        try { node.disconnect(); } catch (error) { /* ignore */ }
      });
    };
    const cleanupGraph = () => {
      cleanupInput();
      chain.cleanup?.();
      [gain, panNode, reverbSend].forEach((node) => {
        if (!node) return;
        try { node.disconnect(); } catch (error) { /* ignore */ }
      });
    };
    source.onended = cleanupInput;
    window.setTimeout(cleanupGraph, Math.max(0.2, envelope.effectiveDuration + envelope.release + 2.5) * 1000);
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

  stopMidiVoiceEntry(entry, release = 0.02) {
    if (!entry) return;
    try {
      if (entry.gain?.gain) {
        entry.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, release);
      }
      entry.stop?.();
    } catch (error) {
      // ignore
    }
  }

  enforceMidiVoiceLimits() {
    if (!this.ctx) return;
    this.midiVoices = this.midiVoices.filter((voice) => voice.stopTime > this.ctx.currentTime);
    const previewVoices = this.midiVoices.filter((voice) => voice.group === 'preview');
    while (previewVoices.length > this.midiPreviewVoiceLimit) {
      const oldestPreview = previewVoices.shift();
      const index = this.midiVoices.indexOf(oldestPreview);
      if (index >= 0) this.midiVoices.splice(index, 1);
      this.stopMidiVoiceEntry(oldestPreview);
    }
    while (this.midiVoices.length > this.midiVoiceLimit) {
      const previewIndex = this.midiVoices.findIndex((voice) => voice.group === 'preview');
      const index = previewIndex >= 0 ? previewIndex : 0;
      const [entry] = this.midiVoices.splice(index, 1);
      this.stopMidiVoiceEntry(entry);
    }
  }

  registerMidiVoice({ source, gain, stopTime, voice, channel = null, group = 'timeline' }) {
    const resolveStop = () => {
      if (voice?.stop) return () => voice.stop();
      if (voice?.audioBufferSourceNode?.stop) return () => voice.audioBufferSourceNode.stop();
      if (source?.stop) return () => source.stop();
      return null;
    };
    const audioNode = voice?.audioBufferSourceNode || voice?.source || source || null;
    const basePlaybackRate = audioNode?.playbackRate?.value ?? 1;
    const entry = { source, gain, stopTime, stop: resolveStop(), voice, audioNode, basePlaybackRate, channel, group };
    const channelBend = Number.isFinite(channel) ? this.channelPitchBendSemitones[channel] ?? 0 : 0;
    const bend = channelBend || this.midiPitchBendSemitones;
    if (audioNode?.playbackRate && bend) {
      audioNode.playbackRate.value = basePlaybackRate * (2 ** (bend / 12));
    }
    this.midiVoices.push(entry);
    this.enforceMidiVoiceLimits();
    return entry;
  }

  fadeOutMidiVoices(release = 0.04) {
    if (!this.ctx) return;
    this.clearMidiPedalBuses();
    if (!this.midiVoices.length) return;
    const voices = this.midiVoices.splice(0);
    voices.forEach((entry) => {
      try {
        if (entry.gain?.gain) {
          entry.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, Math.max(0.005, release * 0.5));
        }
        window.setTimeout(() => {
          try { entry.stop?.(); } catch (error) { /* ignore */ }
        }, Math.max(20, release * 1000));
      } catch (error) {
        // ignore
      }
    });
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
