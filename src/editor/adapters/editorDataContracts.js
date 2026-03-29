const PIXEL_GRID_SIZE = 16;

export function ensurePixelArtStore(world) {
  if (!world.pixelArt || typeof world.pixelArt !== 'object') {
    world.pixelArt = { tiles: {} };
  }
  if (!world.pixelArt.tiles || typeof world.pixelArt.tiles !== 'object') {
    world.pixelArt.tiles = {};
  }
  return world.pixelArt;
}

export function ensurePixelTileData(world, tileChar, options = {}) {
  if (!tileChar) return null;
  const { size = PIXEL_GRID_SIZE, fps = 6 } = options;
  const store = ensurePixelArtStore(world);
  if (!store.tiles[tileChar]) {
    store.tiles[tileChar] = {
      size,
      fps,
      frames: [Array(size * size).fill(null)]
    };
  }
  return store.tiles[tileChar];
}

export function ensurePixelPreviewFrame(pixelData, frameIndex = 0) {
  if (!pixelData || typeof pixelData !== 'object') return null;
  const normalizePixelColor = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      return value.startsWith('#') ? value : null;
    }
    if (typeof value === 'number') {
      const packed = Number(value) >>> 0;
      const r = packed & 255;
      const g = (packed >> 8) & 255;
      const b = (packed >> 16) & 255;
      const a = (packed >> 24) & 255;
      if (!a) return null;
      return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`;
    }
    if (typeof value === 'object') {
      const r = Number(value.r);
      const g = Number(value.g);
      const b = Number(value.b);
      const a = Number.isFinite(value.a) ? Number(value.a) : 255;
      if (![r, g, b].every(Number.isFinite) || a <= 0) return null;
      return `#${[r, g, b].map((entry) => Math.max(0, Math.min(255, entry)).toString(16).padStart(2, '0')).join('')}`;
    }
    return null;
  };
  const normalizeFrame = (frame) => {
    if (!Array.isArray(frame)) return null;
    return frame.map((value) => normalizePixelColor(value));
  };
  const frames = Array.isArray(pixelData.frames) ? pixelData.frames : [];
  const hasPaint = (frame) => Array.isArray(frame) && frame.some((value) => Boolean(normalizePixelColor(value)));
  const existing = normalizeFrame(frames[frameIndex] || frames[0]);
  if (hasPaint(existing)) return existing;
  const editorFrames = pixelData.editor?.frames;
  if (!Array.isArray(editorFrames) || editorFrames.length === 0) return existing || null;
  const selected = editorFrames[frameIndex] || editorFrames[0];
  if (!selected) return existing || null;
  const size = Math.max(1, Number(pixelData.editor?.width) || Number(pixelData.size) || PIXEL_GRID_SIZE);
  const composite = new Array(size * size).fill(null);
  (selected.layers || []).forEach((layer) => {
    if (layer?.visible === false || !layer?.pixels) return;
    for (let i = 0; i < composite.length; i += 1) {
      const packed = Number(layer.pixels[i] || 0) >>> 0;
      if (!packed) continue;
      const r = packed & 255;
      const g = (packed >> 8) & 255;
      const b = (packed >> 16) & 255;
      const a = (packed >> 24) & 255;
      if (!a) continue;
      composite[i] = `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    }
  });
  if (!composite.some((value) => value)) return existing || null;
  pixelData.size = size;
  pixelData.frames = [composite];
  return composite;
}

export function ensureMusicZones(world) {
  if (!Array.isArray(world.musicZones)) {
    world.musicZones = [];
  }
  return world.musicZones;
}

export function normalizeMidiTracks(rawTracks, fallbackInstrument = 'piano') {
  if (!Array.isArray(rawTracks)) return [];
  return rawTracks.map((track, index) => ({
    id: track.id || `track-${Date.now()}-${index}`,
    name: track.name || `Track ${index + 1}`,
    instrument: track.instrument || fallbackInstrument,
    notes: Array.isArray(track.notes)
      ? track.notes.map((note) => ({
        pitch: note.pitch,
        start: note.start,
        length: note.length || 1
      }))
      : []
  }));
}

export function ensureMidiTracks(world, options = {}) {
  const {
    fallbackInstrument = 'piano',
    defaultTracks = []
  } = options;
  if (!Array.isArray(world.midiTracks)) {
    world.midiTracks = [];
  }
  if (world.midiTracks.length === 0 && defaultTracks.length > 0) {
    world.midiTracks = defaultTracks.map((track, index) => ({
      id: track.id || `track-${index}`,
      name: track.name || `Track ${index + 1}`,
      instrument: track.instrument || fallbackInstrument,
      notes: []
    }));
  }
  return world.midiTracks;
}

export function replaceMidiTracks(world, data, fallbackInstrument = 'piano') {
  const sourceTracks = Array.isArray(data) ? data : data?.midiTracks || data?.tracks || [];
  const normalized = normalizeMidiTracks(sourceTracks, fallbackInstrument);
  world.midiTracks = normalized.length > 0
    ? normalized
    : [{
      id: `track-${Date.now()}`,
      name: 'Track 1',
      instrument: fallbackInstrument,
      notes: []
    }];
  return world.midiTracks;
}
