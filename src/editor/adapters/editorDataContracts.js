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
