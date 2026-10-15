// Radio assets are project content; unlocks and listening preferences are player data.
export const RADIO_LIBRARY_VERSION = 1;
const text = value => typeof value === 'string' ? value.trim() : '';
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
export const createRadioId = () => globalThis.crypto?.randomUUID?.() || `radio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function normalizeRadioImage(value = {}) {
  return { artRef: text(value?.artRef), url: text(value?.url) };
}
export function normalizeRadioLibrary(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const seenTracks = new Set(), seenStations = new Set();
  const tracks = (Array.isArray(source.tracks) ? source.tracks : []).filter(track => {
    const id = text(track?.id);if (!id || seenTracks.has(id)) return false;seenTracks.add(id);return true;
  }).map(track => ({
    id: text(track.id), title: text(track.title) || 'Untitled track', artist: text(track.artist),
    album: text(track.album), image: normalizeRadioImage(track.image), src: text(track.src),
    initiallyUnlocked: track.initiallyUnlocked === true
  }));
  const stations = (Array.isArray(source.stations) ? source.stations : []).filter(station => {
    const id = text(station?.id);if (!id || seenStations.has(id)) return false;seenStations.add(id);return true;
  }).map(station => ({ id: text(station.id), name: text(station.name) || 'New station',
    logo: normalizeRadioImage(station.logo), trackIds: unique(station.trackIds).filter(id => seenTracks.has(id)) }));
  return { version: RADIO_LIBRARY_VERSION, tracks, stations };
}
export function normalizeRadioProgress(value = {}) {
  return { enabled: value?.enabled !== false, unlocked: unique(value?.unlocked), disabled: unique(value?.disabled), stationId: text(value?.stationId) };
}
export function isRadioTrackUnlocked(track, progress) {
  return Boolean(track && (track.initiallyUnlocked || progress.unlocked.includes(track.id)));
}
export function radioStationTracks(library, progress, stationId, { includeDisabled = false } = {}) {
  const station = library.stations.find(entry => entry.id === stationId);
  return (station?.trackIds || []).map(id => library.tracks.find(track => track.id === id))
    .filter(track => track?.src && isRadioTrackUnlocked(track, progress) && (includeDisabled || !progress.disabled.includes(track.id)));
}
