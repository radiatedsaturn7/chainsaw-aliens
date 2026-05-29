import { listProjectFiles, loadProjectFile, saveProjectFile, sanitizeProjectFileName } from './projectFiles.js';
import { openTextInputOverlay } from './shared/textInputOverlay.js';
import { getSharedMobileRailWidth, UI_SUITE } from './uiSuite.js';

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_DURATION = 0.45;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uid = () => `sfx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const ENVELOPE_SPECS = {
  volume: { label: 'Volume', min: 0, max: 2, defaultValue: 1, color: '#7dff9a' },
  pitch: { label: 'Pitch', min: -2400, max: 2400, defaultValue: 0, color: '#ffe16a', unit: 'cents' },
  pan: { label: 'Pan', min: -1, max: 1, defaultValue: 0, color: '#ff8fd6' }
};
const ENVELOPE_TYPES = Object.keys(ENVELOPE_SPECS);

const createDefaultEnvelope = (type = 'pitch') => {
  const spec = ENVELOPE_SPECS[type] || ENVELOPE_SPECS.pitch;
  return {
    enabled: false,
    points: [
      { time: 0, value: spec.defaultValue },
      { time: 1, value: spec.defaultValue }
    ]
  };
};

const createDefaultEnvelopes = () => ({
  volume: createDefaultEnvelope('volume'),
  pitch: createDefaultEnvelope('pitch'),
  pan: createDefaultEnvelope('pan')
});

const normalizeEnvelope = (type = 'pitch', envelope = {}) => {
  const spec = ENVELOPE_SPECS[type] || ENVELOPE_SPECS.pitch;
  const legacyStart = type === 'pitch' ? Number(envelope?.startCents || 0) : spec.defaultValue;
  const legacyEnd = type === 'pitch' ? Number(envelope?.endCents || 0) : spec.defaultValue;
  const readValue = (point, fallback) => (
    point?.value ?? point?.cents ?? fallback
  );
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

const normalizeEnvelopes = (frame = {}) => {
  const source = frame.envelopes || {};
  return {
    volume: normalizeEnvelope('volume', source.volume),
    pitch: normalizeEnvelope('pitch', source.pitch || frame.pitchEnvelope),
    pan: normalizeEnvelope('pan', source.pan)
  };
};

const hasEnabledEnvelope = (envelopes = {}) => ENVELOPE_TYPES.some((type) => envelopes?.[type]?.enabled);

const createDefaultCustomWavePoints = () => [
  { time: 0, value: 0 },
  { time: 0.5, value: 1 },
  { time: 1, value: 0 }
];

const ensureLayerEnvelopes = (layer) => {
  if (!layer) return createDefaultEnvelopes();
  if (!layer.envelopes) layer.envelopes = createDefaultEnvelopes();
  ENVELOPE_TYPES.forEach((type) => {
    if (!layer.envelopes[type]?.points?.length) {
      layer.envelopes[type] = normalizeEnvelope(type, layer.envelopes[type]);
    }
  });
  return layer.envelopes;
};

const scheduleEnvelopeParam = (audioParam, type, envelope, now, duration, transform = (value) => value) => {
  const spec = ENVELOPE_SPECS[type] || ENVELOPE_SPECS.pitch;
  const normalized = normalizeEnvelope(type, envelope);
  const points = normalized.enabled ? normalized.points : [{ time: 0, value: spec.defaultValue }];
  points.forEach((point, index) => {
    const value = transform(Number(point.value ?? spec.defaultValue));
    const time = now + clamp(Number(point.time || 0), 0, 1) * Math.max(0.02, duration);
    if (index === 0) audioParam.setValueAtTime(value, now);
    else audioParam.linearRampToValueAtTime(value, time);
  });
};

const getAveragePlaybackRate = (pitchEnvelope, baseOctaves = 0) => {
  const envelope = normalizeEnvelope('pitch', pitchEnvelope);
  const points = envelope.enabled ? envelope.points : createDefaultEnvelope('pitch').points;
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

const getEffectiveLayerPlaybackDuration = (layer, pitchBase = 0) => {
  const nominal = Math.max(0, Number(layer?.duration || 0));
  if (nominal <= 0) return 0;
  const envelopes = normalizeEnvelopes(layer || {});
  return nominal / getAveragePlaybackRate(envelopes.pitch, pitchBase);
};

const createEmptyLayer = (index = 0) => ({
  id: uid(),
  name: `Layer ${index + 1}`,
  wavDataUrl: '',
  duration: 0,
  sampleRate: DEFAULT_SAMPLE_RATE,
  channels: 1,
  startTime: 0,
  volume: 1,
  pan: 0,
  muted: false,
  envelopes: createDefaultEnvelopes()
});

const createEmptyFrame = (index = 0) => ({
  id: uid(),
  name: `Frame ${index + 1}`,
  layers: [createEmptyLayer(0)],
  duration: 0,
  sampleRate: DEFAULT_SAMPLE_RATE,
  channels: 1,
  loopStart: 0,
  loopEnd: 0,
  envelopes: createDefaultEnvelopes(),
  pitchEnvelope: createDefaultEnvelope('pitch')
});

const createDefaultSfx = () => ({
  version: 1,
  name: 'Untitled SFX',
  frames: [createEmptyFrame(0)],
  settings: {
    frameMode: 'random',
    enabledFrames: [],
    pitchVarianceCents: 0,
    volumeVariance: 0,
    loop: false,
    baseVolume: 1,
    envelopes: createDefaultEnvelopes(),
    pitchEnvelope: createDefaultEnvelope('pitch')
  },
  toolOptions: {
    generateWave: 'noise',
    generateDuration: DEFAULT_DURATION,
    generateFrequency: 1000,
    fadeSeconds: 0.03,
    bitDepth: 8,
    sampleRateFactor: 4,
    timeStretch: 1.25,
    customWaveSmooth: true,
    customWavePoints: createDefaultCustomWavePoints()
  }
});

function floatTo16BitPcm(view, offset, value) {
  const s = clamp(value, -1, 1);
  view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
}

function encodeWavDataUrl(samples, sampleRate = DEFAULT_SAMPLE_RATE) {
  const channelCount = 1;
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    floatTo16BitPcm(view, 44 + i * 2, samples[i]);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function decodeDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export default class SfxEditor {
  constructor(game) {
    this.game = game;
    this.sfx = createDefaultSfx();
    this.currentDocumentRef = null;
    this.savedSnapshot = JSON.stringify(this.serialize());
    this.leftTab = 'file';
    this.selectedFrameIndex = 0;
    this.selectedLayerIndex = 0;
    this.selectedEnvelopeType = 'volume';
    this.selectedEnvelopePointIndex = 0;
    this.selectedCustomWavePointIndex = 1;
    this.layerClipboard = null;
    this.playheadTime = 0;
    this.playStartedAt = 0;
    this.playDuration = 0;
    this.playVisualDuration = 0;
    this.openModal = null;
    this.message = '';
    this.messageTimer = 0;
    this.buttons = [];
    this.frameButtons = [];
    this.sliderDrag = null;
    this.isPlaying = false;
    this.playSource = null;
    this.playGain = null;
    this.audioContext = null;
    this.bufferCache = new Map();
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.wav,audio/wav,audio/wave,audio/x-wav';
    this.fileInput.multiple = true;
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);
    this.fileInput.addEventListener('change', (event) => {
      const files = Array.from(event.target.files || []);
      this.importWavFiles(files).finally(() => {
        this.fileInput.value = '';
      });
    });
  }

  get selectedFrame() {
    this.normalizeSelectionState();
    return this.sfx.frames[this.selectedFrameIndex] || this.sfx.frames[0] || null;
  }

  get selectedLayer() {
    this.normalizeSelectionState();
    const frame = this.selectedFrame;
    return frame?.layers?.[this.selectedLayerIndex] || frame?.layers?.[0] || null;
  }

  normalizeSelectionState() {
    if (!Array.isArray(this.sfx.frames) || !this.sfx.frames.length) this.sfx.frames = [createEmptyFrame(0)];
    this.selectedFrameIndex = clamp(Number(this.selectedFrameIndex || 0), 0, this.sfx.frames.length - 1);
    const frame = this.sfx.frames[this.selectedFrameIndex];
    if (!Array.isArray(frame.layers) || !frame.layers.length) frame.layers = [createEmptyLayer(0)];
    this.selectedLayerIndex = clamp(Number(this.selectedLayerIndex || 0), 0, frame.layers.length - 1);
    this.selectedEnvelopeType = ENVELOPE_TYPES.includes(this.selectedEnvelopeType) ? this.selectedEnvelopeType : 'volume';
    const layer = frame.layers[this.selectedLayerIndex];
    const envelopes = ensureLayerEnvelopes(layer);
    const envelope = envelopes[this.selectedEnvelopeType];
    this.selectedEnvelopePointIndex = clamp(Number(this.selectedEnvelopePointIndex || 0), 0, Math.max(0, (envelope?.points?.length || 1) - 1));
    const opts = this.sfx.toolOptions || {};
    if (!Array.isArray(opts.customWavePoints) || opts.customWavePoints.length < 2) opts.customWavePoints = createDefaultCustomWavePoints();
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    this.selectedCustomWavePointIndex = clamp(Number(this.selectedCustomWavePointIndex || 0), 0, opts.customWavePoints.length - 1);
  }

  update(_input, dt = 0) {
    if (this.messageTimer > 0) this.messageTimer = Math.max(0, this.messageTimer - dt);
  }

  resetTransientInteractionState() {
    this.sliderDrag = null;
    this.openModal = null;
    this.playheadTime = 0;
    this.playStartedAt = 0;
    this.playDuration = 0;
    this.playVisualDuration = 0;
  }

  showMessage(text) {
    this.message = text;
    this.messageTimer = 2.5;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') this.audioContext.resume();
    return this.audioContext;
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.sfx));
  }

  applyDocument(data, name = 'Untitled SFX') {
    const frames = Array.isArray(data?.frames) && data.frames.length
      ? data.frames.map((frame, index) => this.normalizeFrame(frame, index))
      : [createEmptyFrame(0)];
    this.sfx = {
      ...createDefaultSfx(),
      ...data,
      name: data?.name || name,
      frames,
      settings: { ...createDefaultSfx().settings, ...(data?.settings || {}) },
      toolOptions: { ...createDefaultSfx().toolOptions, ...(data?.toolOptions || {}) }
    };
    this.normalizeSelectionState();
    this.bufferCache.clear();
    this.savedSnapshot = JSON.stringify(this.serialize());
  }

  normalizeFrame(frame = {}, index = 0) {
    const base = { ...createEmptyFrame(index), ...frame };
    let layers = Array.isArray(frame.layers) && frame.layers.length
      ? frame.layers
      : [];
    if (!layers.length && frame.wavDataUrl) {
      layers = [{
        id: frame.id ? `${frame.id}_layer_1` : uid(),
        name: frame.name || `Layer 1`,
        wavDataUrl: frame.wavDataUrl,
        duration: frame.duration || 0,
        sampleRate: frame.sampleRate || DEFAULT_SAMPLE_RATE,
        channels: frame.channels || 1,
        volume: 1,
        pan: 0,
        muted: false
      }];
    }
    if (!layers.length) layers = [createEmptyLayer(0)];
    const inheritedEnvelopes = normalizeEnvelopes(frame);
    layers = layers.map((layer, layerIndex) => ({
      ...createEmptyLayer(layerIndex),
      ...layer,
      name: layer?.name || `Layer ${layerIndex + 1}`,
      startTime: Math.max(0, Number(layer?.startTime || 0)),
      volume: Number.isFinite(Number(layer?.volume)) ? Number(layer.volume) : 1,
      pan: Number.isFinite(Number(layer?.pan)) ? Number(layer.pan) : 0,
      muted: Boolean(layer?.muted),
      envelopes: layer?.envelopes ? normalizeEnvelopes(layer) : (hasEnabledEnvelope(inheritedEnvelopes) ? JSON.parse(JSON.stringify(inheritedEnvelopes)) : createDefaultEnvelopes())
    }));
    const duration = Math.max(
      Number(base.duration || 0),
      ...layers.map((layer) => Number(layer.startTime || 0) + Number(layer.duration || 0))
    );
    return {
      ...base,
      layers,
      duration,
      sampleRate: layers.find((layer) => layer.wavDataUrl)?.sampleRate || base.sampleRate || DEFAULT_SAMPLE_RATE,
      channels: Math.max(1, ...layers.map((layer) => Number(layer.channels || 1))),
      envelopes: inheritedEnvelopes,
      pitchEnvelope: inheritedEnvelopes.pitch,
      wavDataUrl: undefined
    };
  }

  normalizeCustomWavePoints(points = []) {
    const normalized = (Array.isArray(points) && points.length ? points : createDefaultCustomWavePoints())
      .map((point) => ({
        time: clamp(Number(point?.time ?? 0), 0, 1),
        value: clamp(Number(point?.value ?? 0), -1, 1)
      }))
      .sort((a, b) => a.time - b.time);
    if (!normalized.some((point) => point.time === 0)) normalized.unshift({ time: 0, value: normalized[0]?.value ?? 0 });
    if (!normalized.some((point) => point.time === 1)) normalized.push({ time: 1, value: normalized[normalized.length - 1]?.value ?? 0 });
    normalized[0].time = 0;
    normalized[normalized.length - 1].time = 1;
    return normalized;
  }

  isDirty() {
    return JSON.stringify(this.serialize()) !== this.savedSnapshot;
  }

  async newDocument() {
    if (this.isDirty() && !window.confirm('Discard unsaved SFX changes?')) return;
    const raw = await openTextInputOverlay({
      title: 'New SFX',
      label: 'SFX name:',
      initialValue: 'New SFX',
      inputType: 'text'
    });
    const name = sanitizeProjectFileName(raw || 'New SFX') || 'New SFX';
    this.sfx = createDefaultSfx();
    this.sfx.name = name;
    this.currentDocumentRef = { folder: 'sfx', name };
    this.selectedFrameIndex = 0;
    this.selectedLayerIndex = 0;
    this.selectedEnvelopePointIndex = 0;
    this.selectedCustomWavePointIndex = 1;
    this.bufferCache.clear();
    this.savedSnapshot = JSON.stringify(this.serialize());
    this.showMessage(`New SFX: ${name}`);
  }

  async save({ forceSaveAs = false } = {}) {
    let name = this.currentDocumentRef?.name || this.sfx.name;
    if (forceSaveAs || !name) {
      const raw = await openTextInputOverlay({
        title: 'Save SFX As',
        label: 'SFX name:',
        initialValue: name || 'New SFX',
        inputType: 'text'
      });
      if (raw == null) return;
      name = sanitizeProjectFileName(raw) || 'New SFX';
    }
    this.sfx.name = name;
    const saved = saveProjectFile('sfx', name, this.serialize());
    this.game?.sfxDocumentCache?.delete?.(name);
    this.currentDocumentRef = { folder: 'sfx', name };
    this.savedSnapshot = JSON.stringify(this.serialize());
    this.showMessage('Saving...');
    try {
      await saved?.syncPromise;
      this.showMessage('Saved');
    } catch (_error) {
      this.showMessage('Saved locally; server sync pending');
    }
  }

  openFileModal() {
    this.openModal = {
      type: 'open',
      files: listProjectFiles('sfx'),
      scroll: 0
    };
  }

  loadNamedFile(name) {
    const payload = loadProjectFile('sfx', name);
    if (!payload?.data) {
      this.showMessage('Unable to open SFX');
      return;
    }
    this.applyDocument(payload.data, name);
    this.currentDocumentRef = { folder: 'sfx', name };
    this.openModal = null;
    this.showMessage(`Opened ${name}`);
  }

  async importWavFiles(files) {
    if (!files.length) return;
    const frame = this.selectedFrame || createEmptyFrame(0);
    if (!this.sfx.frames.includes(frame)) {
      this.sfx.frames.push(frame);
      this.selectedFrameIndex = this.sfx.frames.length - 1;
    }
    const importedLayers = [];
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const layer = {
        ...createEmptyLayer((frame.layers || []).length + importedLayers.length),
        name: String(file.name || `Layer ${(frame.layers || []).length + importedLayers.length + 1}`).replace(/\.wav$/i, ''),
        wavDataUrl: dataUrl,
        duration: 0
      };
      try {
        const buffer = await this.decodeLayer(layer);
        layer.duration = buffer.duration;
        layer.sampleRate = buffer.sampleRate;
        layer.channels = buffer.numberOfChannels;
      } catch (_error) {
        // Keep the raw WAV so the user can still save/export it.
      }
      importedLayers.push(layer);
    }
    const hasOnlyEmptyLayer = frame.layers?.length === 1 && !frame.layers[0]?.wavDataUrl;
    if (hasOnlyEmptyLayer) {
      frame.layers = importedLayers;
      this.selectedLayerIndex = 0;
    } else {
      frame.layers = [...(frame.layers || []), ...importedLayers];
      this.selectedLayerIndex = frame.layers.length - importedLayers.length;
    }
    this.refreshFrameMetadata(frame);
    this.bufferCache.clear();
    this.showMessage(`Imported ${importedLayers.length} WAV${importedLayers.length === 1 ? '' : 's'} into frame ${this.selectedFrameIndex + 1}`);
  }

  async decodeLayer(layer = this.selectedLayer) {
    if (!layer?.wavDataUrl) throw new Error('No WAV data');
    const cached = this.bufferCache.get(layer.id);
    if (cached) return cached;
    const ctx = this.ensureAudioContext();
    const bytes = decodeDataUrlBytes(layer.wavDataUrl);
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    this.bufferCache.set(layer.id, buffer);
    return buffer;
  }

  async getLayerSamples(layer = this.selectedLayer) {
    const buffer = await this.decodeLayer(layer);
    const length = buffer.length;
    const samples = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) samples[i] += data[i] / buffer.numberOfChannels;
    }
    return { samples, sampleRate: buffer.sampleRate };
  }

  setLayerSamples(layer, samples, sampleRate = DEFAULT_SAMPLE_RATE) {
    if (!layer) return;
    layer.wavDataUrl = encodeWavDataUrl(samples, sampleRate);
    layer.duration = samples.length / sampleRate;
    layer.sampleRate = sampleRate;
    layer.channels = 1;
    this.bufferCache.delete(layer.id);
    this.refreshFrameMetadata(this.selectedFrame);
  }

  addLayer() {
    const frame = this.selectedFrame;
    if (!frame) return;
    frame.layers = Array.isArray(frame.layers) ? frame.layers : [];
    frame.layers.push(createEmptyLayer(frame.layers.length));
    this.selectedLayerIndex = frame.layers.length - 1;
    this.refreshFrameMetadata(frame);
  }

  cloneLayer(layer, nameSuffix = 'copy') {
    if (!layer) return null;
    const next = JSON.parse(JSON.stringify(layer));
    next.id = uid();
    next.name = `${layer.name || 'Layer'} ${nameSuffix}`.trim();
    next.envelopes = normalizeEnvelopes(next);
    return next;
  }

  copyLayer() {
    const layer = this.selectedLayer;
    if (!layer) return;
    this.layerClipboard = this.cloneLayer(layer, 'copy');
    this.showMessage('Layer copied');
  }

  cutLayer() {
    const layer = this.selectedLayer;
    if (!layer) return;
    this.layerClipboard = this.cloneLayer(layer, 'copy');
    this.deleteLayer();
    this.showMessage('Layer cut');
  }

  pasteLayer() {
    const frame = this.selectedFrame;
    if (!frame || !this.layerClipboard) return;
    frame.layers = Array.isArray(frame.layers) ? frame.layers : [];
    const next = this.cloneLayer(this.layerClipboard, 'paste');
    const insertAt = clamp(this.selectedLayerIndex + 1, 0, frame.layers.length);
    frame.layers.splice(insertAt, 0, next);
    this.selectedLayerIndex = insertAt;
    this.refreshFrameMetadata(frame);
    this.showMessage('Layer pasted');
  }

  duplicateLayer() {
    const frame = this.selectedFrame;
    const layer = this.selectedLayer;
    if (!frame || !layer) return;
    frame.layers = Array.isArray(frame.layers) ? frame.layers : [];
    const next = this.cloneLayer(layer, 'copy');
    next.startTime = Number(layer.startTime || 0) + 0.05;
    const insertAt = clamp(this.selectedLayerIndex + 1, 0, frame.layers.length);
    frame.layers.splice(insertAt, 0, next);
    this.selectedLayerIndex = insertAt;
    this.refreshFrameMetadata(frame);
    this.showMessage('Layer duplicated');
  }

  async splitLayerAtPlayhead() {
    const frame = this.selectedFrame;
    const layer = this.selectedLayer;
    if (!frame || !layer?.wavDataUrl) return;
    const splitAt = Number(this.playheadTime || 0) - Number(layer.startTime || 0);
    if (splitAt <= 0 || splitAt >= Number(layer.duration || 0)) {
      this.showMessage('Move playhead inside the layer to split');
      return;
    }
    const { samples, sampleRate } = await this.getLayerSamples(layer);
    const splitIndex = clamp(Math.round(splitAt * sampleRate), 1, samples.length - 1);
    const left = samples.slice(0, splitIndex);
    const right = samples.slice(splitIndex);
    const rightLayer = this.cloneLayer(layer, 'split');
    rightLayer.startTime = Number(layer.startTime || 0) + splitAt;
    this.setLayerSamples(layer, left, sampleRate);
    layer.name = `${layer.name || 'Layer'} A`;
    this.setLayerSamples(rightLayer, right, sampleRate);
    rightLayer.name = `${String(layer.name || 'Layer').replace(/\s+A$/, '')} B`;
    frame.layers.splice(this.selectedLayerIndex + 1, 0, rightLayer);
    this.selectedLayerIndex += 1;
    this.refreshFrameMetadata(frame);
    this.showMessage('Layer split');
  }

  deleteLayer() {
    const frame = this.selectedFrame;
    if (!frame) return;
    frame.layers = Array.isArray(frame.layers) ? frame.layers : [];
    if (frame.layers.length <= 1) {
      frame.layers = [createEmptyLayer(0)];
      this.selectedLayerIndex = 0;
      this.refreshFrameMetadata(frame);
      return;
    }
    const [removed] = frame.layers.splice(this.selectedLayerIndex, 1);
    if (removed?.id) this.bufferCache.delete(removed.id);
    this.selectedLayerIndex = clamp(this.selectedLayerIndex, 0, frame.layers.length - 1);
    this.refreshFrameMetadata(frame);
  }

  getSelectedEnvelope() {
    const layer = this.selectedLayer;
    if (!layer) return null;
    layer.envelopes = ensureLayerEnvelopes(layer);
    const type = ENVELOPE_TYPES.includes(this.selectedEnvelopeType) ? this.selectedEnvelopeType : 'volume';
    this.selectedEnvelopeType = type;
    this.selectedEnvelopePointIndex = clamp(this.selectedEnvelopePointIndex || 0, 0, Math.max(0, layer.envelopes[type].points.length - 1));
    return layer.envelopes[type];
  }

  addEnvelopePoint() {
    const envelope = this.getSelectedEnvelope();
    if (!envelope) return;
    envelope.enabled = true;
    const spec = ENVELOPE_SPECS[this.selectedEnvelopeType] || ENVELOPE_SPECS.volume;
    const selected = envelope.points[this.selectedEnvelopePointIndex] || { time: 0.5, value: spec.defaultValue };
    const time = this.getPlayheadLayerTimeRatio();
    const nextPoint = {
      time,
      value: Number(selected.value ?? spec.defaultValue)
    };
    const existing = this.findEnvelopePointAtTime(envelope, time);
    if (existing) {
      existing.value = nextPoint.value;
      this.selectedEnvelopePointIndex = envelope.points.indexOf(existing);
      this.showMessage('Envelope point updated at playhead');
      return;
    }
    envelope.points.push(nextPoint);
    envelope.points.sort((a, b) => a.time - b.time);
    this.selectedEnvelopePointIndex = envelope.points.indexOf(nextPoint);
    if (this.selectedEnvelopePointIndex < 0) this.selectedEnvelopePointIndex = envelope.points.length - 1;
    this.showMessage('Envelope point added at playhead');
  }

  deleteEnvelopePoint() {
    const envelope = this.getSelectedEnvelope();
    if (!envelope || envelope.points.length <= 2) return;
    const time = this.getPlayheadLayerTimeRatio();
    const point = this.findEnvelopePointAtTime(envelope, time);
    const index = point ? envelope.points.indexOf(point) : this.selectedEnvelopePointIndex;
    if (index <= 0 || index >= envelope.points.length - 1) {
      this.showMessage('Endpoint keyframes stay locked');
      return;
    }
    envelope.points.splice(index, 1);
    this.selectedEnvelopePointIndex = clamp(this.selectedEnvelopePointIndex, 0, envelope.points.length - 1);
    this.showMessage('Envelope point deleted at playhead');
  }

  getPlayheadLayerTimeRatio() {
    const layer = this.selectedLayer;
    if (!layer) return 0;
    const local = Number(this.playheadTime || 0) - Number(layer.startTime || 0);
    return clamp(local / Math.max(0.0001, Number(layer.duration || 0)), 0, 1);
  }

  findEnvelopePointAtTime(envelope, time, tolerance = 0.015) {
    if (!envelope?.points?.length) return null;
    let best = null;
    let bestDistance = Infinity;
    envelope.points.forEach((point) => {
      const distance = Math.abs(Number(point.time || 0) - time);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    });
    return bestDistance <= tolerance ? best : null;
  }

  cycleEnvelopePoint(direction = 1) {
    const envelope = this.getSelectedEnvelope();
    if (!envelope?.points?.length) return;
    this.selectedEnvelopePointIndex = (this.selectedEnvelopePointIndex + direction + envelope.points.length) % envelope.points.length;
  }

  resetSelectedEnvelope() {
    const layer = this.selectedLayer;
    if (!layer) return;
    layer.envelopes = normalizeEnvelopes(layer);
    layer.envelopes[this.selectedEnvelopeType] = createDefaultEnvelope(this.selectedEnvelopeType);
    this.selectedEnvelopePointIndex = 0;
  }

  addCustomWavePoint(time = 0.5, value = 0) {
    const opts = this.sfx.toolOptions;
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    const next = { time: clamp(time, 0, 1), value: clamp(value, -1, 1) };
    const existing = opts.customWavePoints.find((point) => Math.abs(point.time - next.time) < 0.015);
    if (existing) {
      existing.value = next.value;
      this.selectedCustomWavePointIndex = opts.customWavePoints.indexOf(existing);
      return existing;
    }
    opts.customWavePoints.push(next);
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    this.selectedCustomWavePointIndex = opts.customWavePoints.findIndex((point) => Math.abs(point.time - next.time) < 0.0001);
    if (this.selectedCustomWavePointIndex < 0) this.selectedCustomWavePointIndex = 1;
    return next;
  }

  deleteCustomWavePoint() {
    const opts = this.sfx.toolOptions;
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    const index = clamp(this.selectedCustomWavePointIndex || 0, 0, opts.customWavePoints.length - 1);
    if (index <= 0 || index >= opts.customWavePoints.length - 1) {
      this.showMessage('Wave endpoints stay locked');
      return;
    }
    opts.customWavePoints.splice(index, 1);
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    this.selectedCustomWavePointIndex = clamp(index, 0, opts.customWavePoints.length - 1);
  }

  refreshFrameMetadata(frame = this.selectedFrame) {
    if (!frame) return;
    const layers = Array.isArray(frame.layers) ? frame.layers : [];
    frame.duration = Math.max(0, ...layers.map((layer) => Number(layer.startTime || 0) + Number(layer.duration || 0)));
    frame.sampleRate = layers.find((layer) => layer.wavDataUrl)?.sampleRate || DEFAULT_SAMPLE_RATE;
    frame.channels = Math.max(1, ...layers.map((layer) => Number(layer.channels || 1)));
  }

  async play() {
    this.stop();
    const frame = this.selectedFrame;
    if (!frame) {
      this.showMessage('No SFX frame to play');
      return;
    }
    const ctx = this.ensureAudioContext();
    const layers = (frame.layers || []).filter((layer) => layer?.wavDataUrl && !layer.muted);
    if (!layers.length) {
      this.showMessage('No audible layers in this frame');
      return;
    }
    const settings = this.sfx.settings;
    const pitchRand = ((Math.random() * 2 - 1) * Number(settings.pitchVarianceCents || 0)) / 1200;
    this.refreshFrameMetadata(frame);
    const volumeRand = 1 - Math.random() * clamp(Number(settings.volumeVariance || 0), 0, 1);
    const master = ctx.createGain();
    master.gain.value = clamp(Number(settings.baseVolume || 1) * volumeRand, 0, 2);
    master.connect(ctx.destination);
    const sources = [];
    const scheduled = [];
    let remaining = 0;
    let audibleDuration = 0;
    for (const layer of layers) {
      const buffer = await this.decodeLayer(layer);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      source.buffer = buffer;
      source.loop = Boolean(settings.loop);
      if (source.loop && frame.loopEnd > frame.loopStart) {
        source.loopStart = clamp(frame.loopStart, 0, buffer.duration);
        source.loopEnd = clamp(frame.loopEnd, source.loopStart + 0.01, buffer.duration);
      }
      gain.gain.value = clamp(Number(layer.volume ?? 1), 0, 2);
      source.connect(gain);
      if (pan) {
        pan.pan.value = clamp(Number(layer.pan || 0), -1, 1);
        gain.connect(pan);
        pan.connect(master);
      } else {
        gain.connect(master);
      }
      remaining += 1;
      source.onended = () => {
        remaining -= 1;
        if (remaining <= 0 && this.playSource === sources) {
          this.playSource = null;
          this.playGain = null;
          this.isPlaying = false;
          this.playheadTime = this.playVisualDuration || Number(frame.duration || 0);
          this.playStartedAt = 0;
          this.playDuration = 0;
          this.playVisualDuration = 0;
          master.disconnect();
        }
      };
      sources.push(source);
      layer.envelopes = normalizeEnvelopes(layer);
      const playbackDuration = getEffectiveLayerPlaybackDuration({ ...layer, duration: buffer.duration }, pitchRand);
      audibleDuration = Math.max(audibleDuration, Math.max(0, Number(layer.startTime || 0)) + playbackDuration);
      scheduled.push({ source, gain, pan, layer, playbackDuration });
    }
    this.playSource = sources;
    this.playGain = master;
    const startAt = ctx.currentTime + 0.005;
    scheduled.forEach(({ source, gain, pan, layer, playbackDuration }) => {
      const layerStart = startAt + Math.max(0, Number(layer.startTime || 0));
      scheduleEnvelopeParam(source.playbackRate, 'pitch', layer.envelopes.pitch, layerStart, playbackDuration, (value) => 2 ** (pitchRand + value / 1200));
      scheduleEnvelopeParam(gain.gain, 'volume', layer.envelopes.volume, layerStart, playbackDuration, (value) => clamp(Number(layer.volume ?? 1) * value, 0, 3));
      if (pan) {
        scheduleEnvelopeParam(pan.pan, 'pan', layer.envelopes.pan, layerStart, playbackDuration, (value) => clamp(Number(layer.pan || 0) + value, -1, 1));
      }
    });
    scheduled.forEach(({ source, layer }) => source.start(startAt + Math.max(0, Number(layer.startTime || 0))));
    this.playStartedAt = startAt;
    this.playDuration = Math.max(0.01, audibleDuration);
    this.playVisualDuration = Math.max(0.01, Number(frame.duration || 0));
    this.playheadTime = 0;
    this.isPlaying = true;
  }

  async playRandomizedSfx() {
    this.stop();
    const frame = await this.pickPlaybackFrame();
    if (!frame) {
      this.showMessage('No SFX frame to play');
      return;
    }
    const previous = this.selectedFrameIndex;
    this.selectedFrameIndex = this.sfx.frames.indexOf(frame);
    await this.play();
    if (previous >= 0) this.selectedFrameIndex = previous;
  }

  stop() {
    if (this.playSource) {
      const sources = Array.isArray(this.playSource) ? this.playSource : [this.playSource];
      sources.forEach((source) => {
        try { source.stop(); } catch (_error) {}
        try { source.disconnect(); } catch (_error) {}
      });
      try { this.playGain?.disconnect?.(); } catch (_error) {}
    }
    this.playSource = null;
    this.playGain = null;
    this.isPlaying = false;
    this.playheadTime = Math.min(this.playheadTime || 0, Number(this.selectedFrame?.duration || 0));
    this.playStartedAt = 0;
    this.playDuration = 0;
    this.playVisualDuration = 0;
  }

  async pickPlaybackFrame() {
    const frames = this.sfx.frames.filter((frame, index) => {
      if (!frame.layers?.some((layer) => layer.wavDataUrl && !layer.muted)) return false;
      const enabled = this.sfx.settings.enabledFrames;
      return !Array.isArray(enabled) || !enabled.length || enabled.includes(index);
    });
    if (!frames.length) return null;
    if (this.sfx.settings.frameMode === 'current') return this.selectedFrame?.layers?.some((layer) => layer.wavDataUrl) ? this.selectedFrame : frames[0];
    return frames[Math.floor(Math.random() * frames.length)];
  }

  addEmptyFrame() {
    this.sfx.frames.push(createEmptyFrame(this.sfx.frames.length));
    this.selectedFrameIndex = this.sfx.frames.length - 1;
    this.selectedLayerIndex = 0;
    this.selectedEnvelopePointIndex = 0;
  }

  deleteFrame() {
    if (this.sfx.frames.length <= 1) {
      this.sfx.frames = [createEmptyFrame(0)];
      this.selectedFrameIndex = 0;
      this.selectedEnvelopePointIndex = 0;
      return;
    }
    this.sfx.frames.splice(this.selectedFrameIndex, 1);
    this.selectedFrameIndex = clamp(this.selectedFrameIndex, 0, this.sfx.frames.length - 1);
    this.selectedLayerIndex = 0;
    this.selectedEnvelopePointIndex = 0;
  }

  isFramePlaybackEnabled(index) {
    const enabled = this.sfx.settings.enabledFrames;
    return !Array.isArray(enabled) || !enabled.length || enabled.includes(index);
  }

  toggleFramePlayback(index) {
    const total = this.sfx.frames.length;
    let enabled = Array.isArray(this.sfx.settings.enabledFrames) && this.sfx.settings.enabledFrames.length
      ? [...this.sfx.settings.enabledFrames]
      : Array.from({ length: total }, (_entry, frameIndex) => frameIndex);
    if (enabled.includes(index)) {
      enabled = enabled.filter((frameIndex) => frameIndex !== index);
    } else {
      enabled.push(index);
    }
    enabled = enabled.filter((frameIndex) => frameIndex >= 0 && frameIndex < total).sort((a, b) => a - b);
    this.sfx.settings.enabledFrames = enabled.length === total ? [] : enabled;
  }

  async applyTool(tool) {
    const frame = this.selectedFrame;
    const layer = this.selectedLayer;
    if (!frame) return;
    if (tool === 'generate') {
      this.generateFrame();
      return;
    }
    if (!layer?.wavDataUrl) {
      this.showMessage('Select a layer with audio first');
      return;
    }
    const { samples, sampleRate } = await this.getLayerSamples(layer);
    let next = new Float32Array(samples);
    if (tool === 'trim') next = this.trimSilence(samples);
    if (tool === 'normalize') next = this.normalizeSamples(samples);
    if (tool === 'fade') next = this.fadeSamples(samples, sampleRate);
    if (tool === 'reverse') next.reverse();
    if (tool === 'bitcrusher') next = this.bitcrush(samples);
    if (tool === 'stretch') next = this.timeStretch(samples);
    if (tool === 'loop-wizard') {
      this.loopWizard(samples, sampleRate, frame, layer);
      this.showMessage('Loop markers placed');
      return;
    }
    this.setLayerSamples(layer, next, sampleRate);
    this.showMessage(`${tool} applied`);
  }

  trimSilence(samples) {
    const threshold = 0.01;
    let start = 0;
    let end = samples.length - 1;
    while (start < samples.length && Math.abs(samples[start]) < threshold) start += 1;
    while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
    return samples.slice(Math.max(0, start - 64), Math.min(samples.length, end + 65));
  }

  normalizeSamples(samples) {
    let peak = 0;
    for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
    if (peak < 0.0001) return new Float32Array(samples);
    const gain = 0.95 / peak;
    return Float32Array.from(samples, (value) => clamp(value * gain, -1, 1));
  }

  fadeSamples(samples, sampleRate) {
    const next = new Float32Array(samples);
    const fade = clamp(Math.round(Number(this.sfx.toolOptions.fadeSeconds || 0.03) * sampleRate), 1, Math.floor(samples.length / 2));
    for (let i = 0; i < fade; i += 1) {
      const t = i / fade;
      next[i] *= t;
      next[next.length - 1 - i] *= t;
    }
    return next;
  }

  bitcrush(samples) {
    const levels = 2 ** clamp(Math.round(Number(this.sfx.toolOptions.bitDepth || 8)), 2, 16);
    const hold = clamp(Math.round(Number(this.sfx.toolOptions.sampleRateFactor || 4)), 1, 64);
    const next = new Float32Array(samples.length);
    let held = 0;
    for (let i = 0; i < samples.length; i += 1) {
      if (i % hold === 0) held = Math.round(clamp(samples[i], -1, 1) * (levels / 2)) / (levels / 2);
      next[i] = held;
    }
    return next;
  }

  timeStretch(samples) {
    const factor = clamp(Number(this.sfx.toolOptions.timeStretch || 1), 0.25, 4);
    const length = Math.max(1, Math.round(samples.length * factor));
    const next = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const src = i / factor;
      const a = Math.floor(src);
      const b = Math.min(samples.length - 1, a + 1);
      const t = src - a;
      next[i] = (samples[a] || 0) * (1 - t) + (samples[b] || 0) * t;
    }
    return next;
  }

  loopWizard(samples, sampleRate, frame, layer = this.selectedLayer) {
    const minLoop = Math.floor(sampleRate * 0.08);
    const end = samples.length - 1;
    let bestStart = Math.max(0, end - minLoop);
    let bestScore = Infinity;
    const windowSize = Math.min(256, Math.floor(samples.length / 8));
    for (let start = Math.max(0, samples.length - sampleRate * 2); start < samples.length - minLoop; start += 64) {
      let score = 0;
      for (let i = 0; i < windowSize; i += 1) {
        score += Math.abs((samples[start + i] || 0) - (samples[end - windowSize + i] || 0));
      }
      if (score < bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }
    frame.loopStart = bestStart / sampleRate;
    frame.loopEnd = end / sampleRate;
    const crossfade = Math.min(windowSize, end - bestStart);
    const next = new Float32Array(samples);
    for (let i = 0; i < crossfade; i += 1) {
      const t = i / crossfade;
      const a = bestStart + i;
      const b = end - crossfade + i;
      next[b] = next[b] * (1 - t) + next[a] * t;
    }
    this.setLayerSamples(layer, next, sampleRate);
  }

  sampleCustomWave(phase) {
    const opts = this.sfx.toolOptions || {};
    const points = this.normalizeCustomWavePoints(opts.customWavePoints);
    const p = clamp(phase, 0, 1);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (p < a.time || p > b.time) continue;
      const span = Math.max(0.0001, b.time - a.time);
      let t = clamp((p - a.time) / span, 0, 1);
      if (opts.customWaveSmooth) t = t * t * (3 - 2 * t);
      return Number(a.value || 0) * (1 - t) + Number(b.value || 0) * t;
    }
    return points[points.length - 1]?.value || 0;
  }

  generateFrame() {
    const frame = this.selectedFrame || createEmptyFrame(0);
    if (!Array.isArray(frame.layers) || !frame.layers.length) frame.layers = [createEmptyLayer(0)];
    const layer = frame.layers[this.selectedLayerIndex] || frame.layers[0];
    const opts = this.sfx.toolOptions;
    const sampleRate = DEFAULT_SAMPLE_RATE;
    const length = Math.max(1, Math.round(clamp(Number(opts.generateDuration || DEFAULT_DURATION), 0.03, 10) * sampleRate));
    const freq = clamp(Number(opts.generateFrequency || 1000), 20, 8000);
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const phase = (t * freq) % 1;
      if (opts.generateWave === 'saw') samples[i] = phase * 2 - 1;
      else if (opts.generateWave === 'triangle') samples[i] = 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
      else if (opts.generateWave === 'square') samples[i] = phase < 0.5 ? 1 : -1;
      else if (opts.generateWave === 'custom') samples[i] = this.sampleCustomWave(phase);
      else samples[i] = Math.random() * 2 - 1;
      const env = Math.min(1, i / Math.max(1, sampleRate * 0.01), (length - i) / Math.max(1, sampleRate * 0.03));
      samples[i] *= env * 0.55;
    }
    if (!this.sfx.frames.includes(frame)) this.sfx.frames.push(frame);
    this.setLayerSamples(layer, samples, sampleRate);
    this.showMessage(`Generated ${opts.generateWave}`);
  }

  exportSelectedWav() {
    const layer = this.selectedLayer;
    if (!layer?.wavDataUrl) return;
    const link = document.createElement('a');
    link.href = layer.wavDataUrl;
    link.download = `${sanitizeProjectFileName(this.sfx.name || 'sfx')}-${this.selectedFrameIndex + 1}-layer-${this.selectedLayerIndex + 1}.wav`;
    link.click();
  }

  exit() {
    this.stop();
    this.game?.exitSfxEditor?.();
  }

  handlePointerDown(payload) {
    const hit = this.findHit(payload.x, payload.y);
    if (!hit) return;
    if (hit.kind === 'button') hit.action?.();
    if (hit.kind === 'slider') {
      this.sliderDrag = hit;
      this.updateSlider(hit, payload.x);
    }
    if (hit.kind === 'layer-clip' || hit.kind === 'envelope-point' || hit.kind === 'envelope-area' || hit.kind === 'timeline-scrub' || hit.kind === 'custom-wave-point' || hit.kind === 'custom-wave-area') {
      if (hit.kind === 'layer-clip') {
        const duration = Math.max(0.01, Number(this.selectedFrame?.duration || 1));
        hit.grabOffset = clamp((payload.x - hit.x) / Math.max(1, hit.bounds.w), 0, 1) * duration;
      }
      this.sliderDrag = hit;
      if (hit.kind.startsWith('custom-wave')) this.updateCustomWaveDrag(hit, payload.x, payload.y);
      else this.updateTimelineDrag(hit, payload.x, payload.y);
    }
  }

  handlePointerMove(payload) {
    if (!this.sliderDrag) return;
    if (this.sliderDrag.kind === 'slider') this.updateSlider(this.sliderDrag, payload.x);
    else if (this.sliderDrag.kind.startsWith('custom-wave')) this.updateCustomWaveDrag(this.sliderDrag, payload.x, payload.y);
    else this.updateTimelineDrag(this.sliderDrag, payload.x, payload.y);
  }

  handlePointerUp() {
    this.sliderDrag = null;
  }

  findHit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) return button;
    }
    return null;
  }

  updateSlider(slider, x) {
    const t = clamp((x - slider.x) / Math.max(1, slider.w), 0, 1);
    slider.set(slider.min + t * (slider.max - slider.min));
  }

  updateCustomWaveDrag(hit, x, y) {
    const opts = this.sfx.toolOptions;
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    const time = clamp((x - hit.bounds.x) / Math.max(1, hit.bounds.w), 0, 1);
    const value = clamp(1 - ((y - hit.bounds.y) / Math.max(1, hit.bounds.h)) * 2, -1, 1);
    if (hit.kind === 'custom-wave-area') {
      const point = this.addCustomWavePoint(time, value);
      hit.kind = 'custom-wave-point';
      hit.pointIndex = this.selectedCustomWavePointIndex;
      hit.pointRef = point;
      return;
    }
    const index = clamp(hit.pointIndex || 0, 0, opts.customWavePoints.length - 1);
    const point = opts.customWavePoints[index];
    if (!point) return;
    point.value = value;
    if (index > 0 && index < opts.customWavePoints.length - 1) point.time = time;
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    this.selectedCustomWavePointIndex = opts.customWavePoints.findIndex((entry) => Math.abs(entry.time - point.time) < 0.0001);
    if (this.selectedCustomWavePointIndex < 0) this.selectedCustomWavePointIndex = index;
  }

  updateTimelineDrag(hit, x, y) {
    if (!hit) return;
    const frame = this.selectedFrame;
    const duration = Math.max(0.01, Number(frame?.duration || 1));
    const timeAt = (bounds) => clamp((x - bounds.x) / Math.max(1, bounds.w), 0, 1) * duration;
    if (hit.kind === 'timeline-scrub') {
      this.playheadTime = timeAt(hit.bounds);
      return;
    }
    if (hit.kind === 'layer-clip') {
      const layer = frame?.layers?.[hit.layerIndex];
      if (!layer) return;
      this.selectedLayerIndex = hit.layerIndex;
      layer.startTime = Math.max(0, timeAt(hit.bounds) - hit.grabOffset);
      this.refreshFrameMetadata(frame);
      return;
    }
    if (Number.isFinite(hit.layerIndex)) {
      this.selectedLayerIndex = clamp(hit.layerIndex, 0, Math.max(0, (frame?.layers?.length || 1) - 1));
    }
    const layer = this.selectedLayer;
    const envelope = this.getSelectedEnvelope();
    const spec = ENVELOPE_SPECS[this.selectedEnvelopeType] || ENVELOPE_SPECS.volume;
    if (!layer || !envelope) return;
    let point = hit.pointRef || envelope.points[hit.pointIndex];
    if (hit.kind === 'envelope-area') {
      this.playheadTime = clamp((x - hit.bounds.x) / Math.max(1, hit.bounds.w), 0, 1) * duration;
      return;
    }
    if (!point) return;
    const t = 1 - clamp((y - hit.bounds.y) / Math.max(1, hit.bounds.h), 0, 1);
    point.value = this.selectedEnvelopeType === 'pitch'
      ? Math.round(spec.min + t * (spec.max - spec.min))
      : spec.min + t * (spec.max - spec.min);
    this.selectedEnvelopePointIndex = envelope.points.indexOf(point);
  }

  draw(ctx, width, height) {
    this.buttons = [];
    ctx.save();
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, width, height);
    const isMobileViewport = Math.min(width, height) <= 900;
    const isMobileLandscape = isMobileViewport && width > height;
    const sharedMobileRailW = getSharedMobileRailWidth(width, height);
    const railW = isMobileViewport ? sharedMobileRailW : 76;
    const rightW = isMobileLandscape ? sharedMobileRailW : Math.min(240, Math.max(178, width * 0.28));
    const bottomH = isMobileLandscape ? 112 : 118;
    const canvas = { x: railW, y: 0, w: width - railW - rightW, h: height - bottomH };
    const right = { x: width - rightW, y: 0, w: rightW, h: height - bottomH };
    const bottom = { x: railW, y: height - bottomH, w: width - railW, h: bottomH };
    this.drawLeftRail(ctx, 0, 0, railW, height);
    this.drawWaveform(ctx, canvas);
    this.drawRightPanel(ctx, right);
    this.drawBottomRail(ctx, bottom);
    if (this.openModal) this.drawOpenModal(ctx, width, height);
    if (this.messageTimer > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(canvas.x + 12, canvas.y + 12, Math.min(320, canvas.w - 24), 30);
      ctx.fillStyle = '#ffe16a';
      ctx.font = '13px Courier New';
      ctx.fillText(this.message, canvas.x + 24, canvas.y + 32);
    }
    ctx.restore();
  }

  drawLeftRail(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const tabs = [
      { id: 'file', label: 'File' },
      { id: 'edit', label: 'Edit' },
      { id: 'generate', label: 'Generate' },
      { id: 'envelopes', label: 'Envelopes' },
      { id: 'tools', label: 'Tools' },
      { id: 'settings', label: 'Settings' }
    ];
    let by = y + 10;
    const rowH = Math.min(44, UI_SUITE.spacing.tap);
    const rowGap = 8;
    tabs.forEach((tab) => {
      this.drawButton(ctx, { x: x + 6, y: by, w: w - 12, h: rowH }, tab.label, this.leftTab === tab.id, () => { this.leftTab = tab.id; });
      by += rowH + rowGap;
    });
    this.drawButton(ctx, { x: x + 6, y: h - rowH - 10, w: w - 12, h: rowH }, 'Exit', false, () => this.exit());
  }

  drawWaveform(ctx, bounds) {
    ctx.fillStyle = '#171b20';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = '15px Courier New';
    ctx.fillText(this.sfx.name + (this.isDirty() ? ' *' : ''), bounds.x + 14, bounds.y + 24);
    const frame = this.selectedFrame;
    const wave = { x: bounds.x + 12, y: bounds.y + 48, w: bounds.w - 24, h: Math.max(80, bounds.h - 118) };
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(wave.x, wave.y, wave.w, wave.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(wave.x, wave.y, wave.w, wave.h);
    if (!frame?.layers?.some((layer) => layer?.wavDataUrl)) {
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.font = '13px Courier New';
      ctx.fillText('Import WAV files or generate audio for this layer.', wave.x + 12, wave.y + 32);
    } else {
      this.drawTimeline(ctx, frame, wave);
    }
    if (this.leftTab === 'envelopes') {
      this.drawEnvelopePreview(ctx, this.selectedLayer, this.getSelectedLayerLane(wave), Math.max(0.01, Number(frame?.duration || 1)));
    }
    const layerY = bounds.y + bounds.h - 108;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bounds.x + 12, layerY, bounds.w - 24, 42);
    const layerW = 104;
    (frame?.layers || []).forEach((entry, index) => {
      const bx = bounds.x + 18 + index * (layerW + 8);
      if (bx + layerW > bounds.x + bounds.w - 12) return;
      const label = `${index + 1}: ${entry.name || 'Layer'}`.slice(0, 16);
      this.drawButton(ctx, { x: bx, y: layerY + 5, w: layerW, h: 32 }, label, index === this.selectedLayerIndex, () => {
        this.selectedLayerIndex = index;
        this.selectedEnvelopePointIndex = clamp(this.selectedEnvelopePointIndex || 0, 0, Math.max(0, (this.getSelectedEnvelope()?.points?.length || 1) - 1));
      });
    });
    const stripY = bounds.y + bounds.h - 58;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bounds.x + 12, stripY, bounds.w - 24, 46);
    const frameW = 92;
    this.sfx.frames.forEach((entry, index) => {
      const bx = bounds.x + 18 + index * (frameW + 8);
      if (bx + frameW > bounds.x + bounds.w - 12) return;
      this.drawButton(ctx, { x: bx, y: stripY + 6, w: frameW, h: 34 }, `${index + 1}: ${entry.name}`.slice(0, 14), index === this.selectedFrameIndex, () => {
        this.selectedFrameIndex = index;
        this.selectedLayerIndex = clamp(this.selectedLayerIndex, 0, Math.max(0, (this.selectedFrame?.layers?.length || 1) - 1));
        this.selectedEnvelopePointIndex = clamp(this.selectedEnvelopePointIndex || 0, 0, Math.max(0, (this.getSelectedEnvelope()?.points?.length || 1) - 1));
      });
    });
  }

  drawWavePreview(ctx, frame, layer, bounds) {
    const bars = Math.max(24, Math.floor(bounds.w / 3));
    const seed = Array.from(String(layer?.wavDataUrl || '').slice(-400), (ch) => ch.charCodeAt(0));
    ctx.strokeStyle = '#58d6ff';
    ctx.beginPath();
    for (let i = 0; i < bars; i += 1) {
      const source = seed[i % Math.max(1, seed.length)] || 0;
      const amp = 0.15 + (source / 255) * 0.85;
      const x = bounds.x + (i / Math.max(1, bars - 1)) * bounds.w;
      const y1 = bounds.y + bounds.h * (0.5 - amp * 0.45);
      const y2 = bounds.y + bounds.h * (0.5 + amp * 0.45);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
    const duration = Number(frame.duration || 0);
    if (duration > 0 && frame.loopEnd > frame.loopStart) {
      const sx = bounds.x + (frame.loopStart / duration) * bounds.w;
      const ex = bounds.x + (frame.loopEnd / duration) * bounds.w;
      ctx.fillStyle = 'rgba(255,225,106,0.18)';
      ctx.fillRect(sx, bounds.y, Math.max(2, ex - sx), bounds.h);
      ctx.strokeStyle = '#ffe16a';
      ctx.strokeRect(sx, bounds.y, Math.max(2, ex - sx), bounds.h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px Courier New';
    ctx.fillText(`${Number(layer?.duration || frame.duration || 0).toFixed(2)}s | ${layer?.name || 'Layer'}`, bounds.x + 8, bounds.y + bounds.h - 10);
  }

  getSelectedLayerLane(bounds) {
    const frame = this.selectedFrame;
    const layers = frame?.layers || [];
    if (!layers.length) return bounds;
    const headerH = 26;
    const laneGap = 7;
    const laneH = Math.max(34, Math.min(72, (bounds.h - headerH - laneGap * Math.max(0, layers.length - 1)) / Math.max(1, layers.length)));
    return {
      x: bounds.x,
      y: bounds.y + headerH + this.selectedLayerIndex * (laneH + laneGap),
      w: bounds.w,
      h: laneH
    };
  }

  drawTimeline(ctx, frame, bounds) {
    this.refreshFrameMetadata(frame);
    const duration = Math.max(0.01, Number(frame.duration || 1));
    const headerH = 26;
    const layers = frame.layers || [];
    const laneGap = 7;
    const laneH = Math.max(34, Math.min(72, (bounds.h - headerH - laneGap * Math.max(0, layers.length - 1)) / Math.max(1, layers.length)));
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Courier New';
    for (let i = 0; i <= 4; i += 1) {
      const x = bounds.x + (i / 4) * bounds.w;
      const time = (duration * i) / 4;
      ctx.fillText(`${time.toFixed(time < 10 ? 2 : 1)}s`, x + 3, bounds.y + 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath();
      ctx.moveTo(x, bounds.y + headerH);
      ctx.lineTo(x, bounds.y + bounds.h);
      ctx.stroke();
    }
    this.buttons.push({ kind: 'timeline-scrub', bounds, x: bounds.x, y: bounds.y, w: bounds.w, h: headerH });
    layers.forEach((layer, index) => {
      const lane = { x: bounds.x, y: bounds.y + headerH + index * (laneH + laneGap), w: bounds.w, h: laneH };
      ctx.fillStyle = index === this.selectedLayerIndex ? 'rgba(255,225,106,0.10)' : 'rgba(255,255,255,0.045)';
      ctx.fillRect(lane.x, lane.y, lane.w, lane.h);
      ctx.strokeStyle = index === this.selectedLayerIndex ? 'rgba(255,225,106,0.55)' : 'rgba(255,255,255,0.16)';
      ctx.strokeRect(lane.x, lane.y, lane.w, lane.h);
      const start = Math.max(0, Number(layer.startTime || 0));
      const clipX = lane.x + (start / duration) * lane.w;
      const clipW = Math.max(8, (Number(layer.duration || 0) / duration) * lane.w);
      const clip = { x: clipX, y: lane.y + 5, w: Math.min(clipW, lane.x + lane.w - clipX), h: lane.h - 10 };
      ctx.fillStyle = layer.muted ? 'rgba(120,120,120,0.35)' : 'rgba(88,214,255,0.16)';
      ctx.fillRect(clip.x, clip.y, clip.w, clip.h);
      ctx.strokeStyle = '#58d6ff';
      ctx.strokeRect(clip.x, clip.y, clip.w, clip.h);
      this.drawClipWavePreview(ctx, layer, clip);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText(`${index + 1}: ${layer.name || 'Layer'}`, lane.x + 7, lane.y + 15);
      this.buttons.push({
        kind: 'layer-clip',
        layerIndex: index,
        bounds,
        grabOffset: clamp((this.playheadTime || 0) - start, 0, Number(layer.duration || 0)),
        x: clip.x,
        y: clip.y,
        w: clip.w,
        h: clip.h
      });
    });
    let headTime = this.playheadTime || 0;
    if (this.isPlaying && this.audioContext && this.playStartedAt) {
      const elapsed = Math.max(0, this.audioContext.currentTime - this.playStartedAt);
      const playbackDuration = Math.max(0.01, this.playDuration || duration);
      headTime = clamp((elapsed / playbackDuration) * duration, 0, duration);
      this.playheadTime = headTime;
    }
    const headX = bounds.x + (headTime / duration) * bounds.w;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX, bounds.y);
    ctx.lineTo(headX, bounds.y + bounds.h);
    ctx.stroke();
    ctx.lineWidth = 1;
    this.buttons.push({ kind: 'timeline-scrub', bounds, x: headX - 14, y: bounds.y, w: 28, h: bounds.h });
  }

  drawClipWavePreview(ctx, layer, bounds) {
    const bars = Math.max(6, Math.floor(bounds.w / 5));
    const seed = Array.from(String(layer?.wavDataUrl || '').slice(-320), (ch) => ch.charCodeAt(0));
    ctx.strokeStyle = 'rgba(88,214,255,0.8)';
    ctx.beginPath();
    for (let i = 0; i < bars; i += 1) {
      const source = seed[i % Math.max(1, seed.length)] || 0;
      const amp = 0.12 + (source / 255) * 0.74;
      const x = bounds.x + (i / Math.max(1, bars - 1)) * bounds.w;
      const y1 = bounds.y + bounds.h * (0.5 - amp * 0.42);
      const y2 = bounds.y + bounds.h * (0.5 + amp * 0.42);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }

  drawEnvelopePreview(ctx, layer, bounds, duration = 1) {
    const type = ENVELOPE_TYPES.includes(this.selectedEnvelopeType) ? this.selectedEnvelopeType : 'volume';
    const spec = ENVELOPE_SPECS[type];
    if (layer) layer.envelopes = ensureLayerEnvelopes(layer);
    const envelope = layer?.envelopes?.[type] || createDefaultEnvelope(type);
    const layerIndex = Math.max(0, this.selectedLayerIndex);
    ctx.save();
    this.buttons.push({ kind: 'envelope-area', layerIndex, bounds, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
    if (!envelope.enabled || envelope.points.length < 2) {
      const t = (spec.defaultValue - spec.min) / Math.max(0.0001, spec.max - spec.min);
      const y = bounds.y + bounds.h * (1 - clamp(t, 0, 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(bounds.x, y);
      ctx.lineTo(bounds.x + bounds.w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = spec.color;
    ctx.fillStyle = spec.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    envelope.points.forEach((point, index) => {
      const x = bounds.x + clamp(point.time, 0, 1) * bounds.w;
      const t = (Number(point.value ?? spec.defaultValue) - spec.min) / Math.max(0.0001, spec.max - spec.min);
      const y = bounds.y + bounds.h * (1 - clamp(t, 0, 1));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    envelope.points.forEach((point, index) => {
      const x = bounds.x + clamp(point.time, 0, 1) * bounds.w;
      const t = (Number(point.value ?? spec.defaultValue) - spec.min) / Math.max(0.0001, spec.max - spec.min);
      const y = bounds.y + bounds.h * (1 - clamp(t, 0, 1));
      ctx.beginPath();
      ctx.arc(x, y, index === this.selectedEnvelopePointIndex ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    envelope.points.forEach((point, index) => {
      const x = bounds.x + clamp(point.time, 0, 1) * bounds.w;
      const t = (Number(point.value ?? spec.defaultValue) - spec.min) / Math.max(0.0001, spec.max - spec.min);
      const y = bounds.y + bounds.h * (1 - clamp(t, 0, 1));
      this.buttons.push({ kind: 'envelope-point', layerIndex, pointIndex: index, pointRef: point, bounds, x: x - 12, y: y - 12, w: 24, h: 24 });
    });
    ctx.restore();
  }

  drawRightPanel(ctx, bounds) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = '15px Courier New';
    ctx.fillText(this.leftTab[0].toUpperCase() + this.leftTab.slice(1), bounds.x + 12, bounds.y + 24);
    let y = bounds.y + 42;
    if (this.leftTab === 'file') y = this.drawFilePanel(ctx, bounds, y);
    if (this.leftTab === 'edit') y = this.drawEditPanel(ctx, bounds, y);
    if (this.leftTab === 'tools') y = this.drawToolsPanel(ctx, bounds, y);
    if (this.leftTab === 'settings') y = this.drawSettingsPanel(ctx, bounds, y);
    if (this.leftTab === 'envelopes') y = this.drawEnvelopesPanel(ctx, bounds, y);
    if (this.leftTab === 'generate') y = this.drawGeneratePanel(ctx, bounds, y);
    void y;
  }

  drawFilePanel(ctx, bounds, y) {
    [
      ['New', () => this.newDocument()],
      ['Save', () => this.save()],
      ['Save As', () => this.save({ forceSaveAs: true })],
      ['Open', () => this.openFileModal()],
      ['Import WAV', () => this.fileInput.click()],
      ['Export WAV', () => this.exportSelectedWav()]
    ].forEach(([label, action]) => {
      this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 38 }, label, false, action);
      y += 46;
    });
    return y;
  }

  drawEditPanel(ctx, bounds, y) {
    [
      ['Copy', () => this.copyLayer()],
      ['Cut', () => this.cutLayer()],
      ['Split', () => this.splitLayerAtPlayhead()],
      ['Duplicate', () => this.duplicateLayer()],
      ['Paste', () => this.pasteLayer()],
      ['Delete', () => this.deleteLayer()]
    ].forEach(([label, action]) => {
      this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 38 }, label, false, action);
      y += 46;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '11px Courier New';
    ctx.fillText(`Playhead: ${Number(this.playheadTime || 0).toFixed(2)}s`, bounds.x + 12, y + 14);
    y += 24;
    const layer = this.selectedLayer;
    if (layer) {
      ctx.fillText(`Layer: ${layer.name || `Layer ${this.selectedLayerIndex + 1}`}`, bounds.x + 12, y + 14);
      y += 24;
      ctx.fillText(`Start: ${Number(layer.startTime || 0).toFixed(2)}s`, bounds.x + 12, y + 14);
    }
    return y;
  }

  drawToolsPanel(ctx, bounds, y) {
    [
      ['Add Layer', () => this.addLayer()],
      ['Delete Layer', () => this.deleteLayer()],
      ['Mute Layer', () => { const layer = this.selectedLayer; if (layer) layer.muted = !layer.muted; }],
      ['Trim', () => this.applyTool('trim')],
      ['Normalize', () => this.applyTool('normalize')],
      ['Fade', () => this.applyTool('fade')],
      ['Reverse', () => this.applyTool('reverse')],
      ['Bitcrusher', () => this.applyTool('bitcrusher')],
      ['Time Stretch', () => this.applyTool('stretch')],
      ['Loop Wizard', () => this.applyTool('loop-wizard')]
    ].forEach(([label, action]) => {
      this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, label, false, action);
      y += 40;
    });
    y += 8;
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Fade sec', this.sfx.toolOptions.fadeSeconds, 0, 1, (v) => { this.sfx.toolOptions.fadeSeconds = v; });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Bits', this.sfx.toolOptions.bitDepth, 2, 16, (v) => { this.sfx.toolOptions.bitDepth = Math.round(v); });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Rate div', this.sfx.toolOptions.sampleRateFactor, 1, 32, (v) => { this.sfx.toolOptions.sampleRateFactor = Math.round(v); });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Stretch', this.sfx.toolOptions.timeStretch, 0.25, 4, (v) => { this.sfx.toolOptions.timeStretch = v; });
    return y;
  }

  drawSettingsPanel(ctx, bounds, y) {
    const settings = this.sfx.settings;
    const frame = this.selectedFrame;
    const layer = this.selectedLayer;
    this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, `Frame: ${settings.frameMode}`, false, () => {
      settings.frameMode = settings.frameMode === 'random' ? 'current' : 'random';
    });
    y += 42;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '11px Courier New';
    ctx.fillText('Playable frames', bounds.x + 12, y + 12);
    y += 18;
    const frameButtonSize = 34;
    const frameGap = 6;
    this.sfx.frames.forEach((_frame, index) => {
      const col = index % Math.max(1, Math.floor((bounds.w - 24 + frameGap) / (frameButtonSize + frameGap)));
      const row = Math.floor(index / Math.max(1, Math.floor((bounds.w - 24 + frameGap) / (frameButtonSize + frameGap))));
      const bx = bounds.x + 12 + col * (frameButtonSize + frameGap);
      const by = y + row * (frameButtonSize + frameGap);
      if (by + frameButtonSize > bounds.y + bounds.h - 250) return;
      this.drawButton(ctx, { x: bx, y: by, w: frameButtonSize, h: frameButtonSize }, String(index + 1), this.isFramePlaybackEnabled(index), () => this.toggleFramePlayback(index));
    });
    y += Math.ceil(this.sfx.frames.length / Math.max(1, Math.floor((bounds.w - 24 + frameGap) / (frameButtonSize + frameGap)))) * (frameButtonSize + frameGap) + 6;
    this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, settings.loop ? 'Loop: On' : 'Loop: Off', settings.loop, () => { settings.loop = !settings.loop; });
    y += 44;
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Pitch rnd', settings.pitchVarianceCents, 0, 1200, (v) => { settings.pitchVarianceCents = Math.round(v); });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Volume rnd', settings.volumeVariance, 0, 1, (v) => { settings.volumeVariance = v; });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Volume', settings.baseVolume, 0, 2, (v) => { settings.baseVolume = v; });
    if (layer) {
      this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, `Layer muted: ${layer.muted ? 'On' : 'Off'}`, Boolean(layer.muted), () => { layer.muted = !layer.muted; });
      y += 42;
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Layer start', layer.startTime || 0, 0, Math.max(0.01, Number(frame?.duration || 1)), (v) => {
        layer.startTime = Math.max(0, v);
        this.refreshFrameMetadata(frame);
      });
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Layer vol', layer.volume ?? 1, 0, 2, (v) => { layer.volume = v; });
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Layer pan', layer.pan || 0, -1, 1, (v) => { layer.pan = v; });
    }
    if (frame) {
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Loop start', frame.loopStart || 0, 0, Math.max(0.01, frame.duration || 1), (v) => { frame.loopStart = v; });
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Loop end', frame.loopEnd || 0, 0, Math.max(0.01, frame.duration || 1), (v) => { frame.loopEnd = v; });
    }
    return y;
  }

  drawEnvelopesPanel(ctx, bounds, y) {
    const envelope = this.getSelectedEnvelope();
    const type = this.selectedEnvelopeType;
    const spec = ENVELOPE_SPECS[type] || ENVELOPE_SPECS.volume;
    const point = envelope?.points?.[this.selectedEnvelopePointIndex] || null;
    const tabW = Math.floor((bounds.w - 32) / ENVELOPE_TYPES.length);
    ENVELOPE_TYPES.forEach((entry, index) => {
      this.drawButton(ctx, { x: bounds.x + 12 + index * (tabW + 4), y, w: tabW, h: 34 }, ENVELOPE_SPECS[entry].label, type === entry, () => {
        this.selectedEnvelopeType = entry;
        this.selectedEnvelopePointIndex = 0;
        this.getSelectedEnvelope();
      });
    });
    y += 44;
    if (!envelope) return y;
    this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, `${spec.label}: ${envelope.enabled ? 'On' : 'Off'}`, Boolean(envelope.enabled), () => { envelope.enabled = !envelope.enabled; });
    y += 42;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '11px Courier New';
    ctx.fillText(`Playhead key time: ${(this.getPlayheadLayerTimeRatio() * 100).toFixed(1)}%`, bounds.x + 12, y + 12);
    y += 22;
    const halfW = Math.floor((bounds.w - 30) / 2);
    this.drawButton(ctx, { x: bounds.x + 12, y, w: halfW, h: 34 }, 'Prev point', false, () => this.cycleEnvelopePoint(-1));
    this.drawButton(ctx, { x: bounds.x + 18 + halfW, y, w: halfW, h: 34 }, 'Next point', false, () => this.cycleEnvelopePoint(1));
    y += 42;
    this.drawButton(ctx, { x: bounds.x + 12, y, w: halfW, h: 34 }, 'Add point', false, () => this.addEnvelopePoint());
    this.drawButton(ctx, { x: bounds.x + 18 + halfW, y, w: halfW, h: 34 }, 'Delete point', false, () => this.deleteEnvelopePoint());
    y += 42;
    this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 34 }, `Reset ${spec.label}`, false, () => this.resetSelectedEnvelope());
    y += 42;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '11px Courier New';
    ctx.fillText(`${spec.label} point ${this.selectedEnvelopePointIndex + 1}/${envelope.points.length}`, bounds.x + 12, y + 12);
    y += 18;
    if (point) {
      ctx.fillText(`Selected key time: ${(Number(point.time || 0) * 100).toFixed(1)}%`, bounds.x + 12, y + 12);
      y += 22;
      y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, spec.unit ? `${spec.label} ${spec.unit}` : spec.label, point.value ?? spec.defaultValue, spec.min, spec.max, (v) => {
        point.value = type === 'pitch' ? Math.round(v) : v;
      });
    }
    return y;
  }

  drawGeneratePanel(ctx, bounds, y) {
    ['noise', 'saw', 'triangle', 'square', 'custom'].forEach((wave) => {
      this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 32 }, wave, this.sfx.toolOptions.generateWave === wave, () => { this.sfx.toolOptions.generateWave = wave; });
      y += 38;
    });
    y += 6;
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Seconds', this.sfx.toolOptions.generateDuration, 0.03, 5, (v) => { this.sfx.toolOptions.generateDuration = v; });
    y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Freq', this.sfx.toolOptions.generateFrequency, 20, 2000, (v) => { this.sfx.toolOptions.generateFrequency = Math.round(v); });
    if (this.sfx.toolOptions.generateWave === 'custom') {
      const editor = { x: bounds.x + 12, y, w: bounds.w - 24, h: 96 };
      this.drawCustomWaveEditor(ctx, editor);
      y += editor.h + 10;
      const halfW = Math.floor((bounds.w - 30) / 2);
      this.drawButton(ctx, { x: bounds.x + 12, y, w: halfW, h: 32 }, this.sfx.toolOptions.customWaveSmooth ? 'Curve: Smooth' : 'Curve: Sharp', Boolean(this.sfx.toolOptions.customWaveSmooth), () => {
        this.sfx.toolOptions.customWaveSmooth = !this.sfx.toolOptions.customWaveSmooth;
      });
      this.drawButton(ctx, { x: bounds.x + 18 + halfW, y, w: halfW, h: 32 }, 'Delete Point', false, () => this.deleteCustomWavePoint());
      y += 40;
      const points = this.sfx.toolOptions.customWavePoints || [];
      const point = points[this.selectedCustomWavePointIndex] || null;
      if (point) {
        y = this.drawSlider(ctx, bounds.x + 12, y, bounds.w - 24, 'Point amp', point.value || 0, -1, 1, (v) => { point.value = v; });
      }
    }
    this.drawButton(ctx, { x: bounds.x + 12, y, w: bounds.w - 24, h: 38 }, 'Generate', true, () => this.generateFrame());
    return y + 46;
  }

  drawCustomWaveEditor(ctx, bounds) {
    const opts = this.sfx.toolOptions;
    opts.customWavePoints = this.normalizeCustomWavePoints(opts.customWavePoints);
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.buttons.push({ kind: 'custom-wave-area', bounds, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
    const midY = bounds.y + bounds.h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(bounds.x, midY);
    ctx.lineTo(bounds.x + bounds.w, midY);
    ctx.stroke();
    ctx.strokeStyle = '#58d6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (opts.customWaveSmooth) {
      const steps = Math.max(24, Math.floor(bounds.w / 4));
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const value = this.sampleCustomWave(t);
        const x = bounds.x + t * bounds.w;
        const y = bounds.y + (1 - ((clamp(value, -1, 1) + 1) / 2)) * bounds.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      opts.customWavePoints.forEach((point, index) => {
        const x = bounds.x + clamp(point.time, 0, 1) * bounds.w;
        const y = bounds.y + (1 - ((clamp(point.value, -1, 1) + 1) / 2)) * bounds.h;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    opts.customWavePoints.forEach((point, index) => {
      const x = bounds.x + clamp(point.time, 0, 1) * bounds.w;
      const y = bounds.y + (1 - ((clamp(point.value, -1, 1) + 1) / 2)) * bounds.h;
      ctx.fillStyle = index === this.selectedCustomWavePointIndex ? '#ffe16a' : '#58d6ff';
      ctx.beginPath();
      ctx.arc(x, y, index === this.selectedCustomWavePointIndex ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      this.buttons.push({ kind: 'custom-wave-point', pointIndex: index, bounds, x: x - 13, y: y - 13, w: 26, h: 26 });
    });
  }

  drawBottomRail(ctx, bounds) {
    ctx.fillStyle = '#151920';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    const controls = [
      ['Stop', () => this.stop(), false],
      [this.isPlaying ? 'Pause' : 'Play', () => (this.isPlaying ? this.stop() : this.play()), this.isPlaying],
      ['Add Frame', () => this.addEmptyFrame(), false],
      ['Delete Frame', () => this.deleteFrame(), false],
      ['Add Layer', () => this.addLayer(), false],
      ['Import', () => this.fileInput.click(), false]
    ];
    const gap = 8;
    const bw = Math.max(72, Math.floor((bounds.w - 24 - gap * (controls.length - 1)) / controls.length));
    let x = bounds.x + 12;
    controls.forEach(([label, action, active]) => {
      this.drawButton(ctx, { x, y: bounds.y + 12, w: bw, h: 42 }, label, active, action);
      x += bw + gap;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '12px Courier New';
    ctx.fillText(`Frames ${this.sfx.frames.length} | Frame ${this.selectedFrameIndex + 1} | Layer ${this.selectedLayerIndex + 1}`, bounds.x + 14, bounds.y + 76);
  }

  drawOpenModal(ctx, width, height) {
    const modal = { x: width * 0.12, y: height * 0.12, w: width * 0.76, h: height * 0.76 };
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#171b20';
    ctx.fillRect(modal.x, modal.y, modal.w, modal.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(modal.x, modal.y, modal.w, modal.h);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('Open SFX', modal.x + 16, modal.y + 28);
    const files = this.openModal.files || [];
    const rowH = 42;
    const maxRows = Math.max(1, Math.floor((modal.h - 86) / rowH));
    files.slice(0, maxRows).forEach((file, index) => {
      this.drawButton(ctx, { x: modal.x + 16, y: modal.y + 48 + index * rowH, w: modal.w - 32, h: 34 }, file.name, false, () => this.loadNamedFile(file.name));
    });
    this.drawButton(ctx, { x: modal.x + modal.w - 110, y: modal.y + modal.h - 42, w: 94, h: 30 }, 'Cancel', false, () => { this.openModal = null; });
  }

  drawSlider(ctx, x, y, w, label, value, min, max, set) {
    const h = 38;
    const track = { x, y: y + 17, w, h: 12, kind: 'slider', min, max, set };
    const t = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px Courier New';
    ctx.fillText(`${label}: ${Number(value).toFixed(max > 10 ? 0 : 2)}`, x, y + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(track.x, track.y, track.w, track.h);
    ctx.fillStyle = '#58d6ff';
    ctx.fillRect(track.x, track.y, track.w * t, track.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(track.x, track.y, track.w, track.h);
    this.buttons.push(track);
    return y + h + 8;
  }

  drawButton(ctx, bounds, label, active = false, action = null) {
    ctx.fillStyle = active ? 'rgba(255,225,106,0.28)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.28)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 4);
    ctx.textAlign = 'left';
    if (action) this.buttons.push({ ...bounds, kind: 'button', action });
  }
}
