import { ensureMidiTracks, ensureMusicZones, replaceMidiTracks } from './editorDataContracts.js';

export function createMidiEditorAdapter(options = {}) {
  const {
    getWorld,
    clamp,
    persist,
    refresh,
    playPreview,
    midiTracks,
    fallbackInstrument = 'piano'
  } = options;

  const state = {
    musicTool: 'paint',
    musicTrack: null,
    musicDragStart: null,
    musicDragTarget: null,
    midiTrackIndex: 0,
    midiNoteLength: 4,
    midiGridBounds: null,
    midiNoteBounds: [],
    midiNoteDrag: null,
    midiNoteDirty: false,
    midiInstrumentScroll: 0,
    midiInstrumentScrollBounds: null,
    midiInstrumentScrollMax: 0
  };

  const getDefaultTracks = () => midiTracks.map((track) => ({ id: track.id, name: track.label }));

  return {
    state,
    ensureMusicZones: () => ensureMusicZones(getWorld()),
    addMusicZone(rect, trackId) {
      const zones = ensureMusicZones(getWorld());
      zones.push({
        id: `music-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        rect,
        track: trackId
      });
      persist();
    },
    removeMusicZoneAt(tileX, tileY) {
      const zones = ensureMusicZones(getWorld());
      const index = zones.findIndex((zone) => {
        const [x, y, w, h] = zone.rect;
        return tileX >= x && tileX < x + w && tileY >= y && tileY < y + h;
      });
      if (index === -1) return false;
      zones.splice(index, 1);
      persist();
      return true;
    },
    ensureMidiTracks: () => ensureMidiTracks(getWorld(), { fallbackInstrument, defaultTracks: getDefaultTracks() }),
    replaceMidiTracks(data) {
      const tracks = replaceMidiTracks(getWorld(), data, fallbackInstrument);
      state.midiTrackIndex = 0;
      state.musicTrack = tracks[0] || null;
      persist();
      refresh();
    },
    getActiveMidiTrack() {
      const tracks = ensureMidiTracks(getWorld(), { fallbackInstrument, defaultTracks: getDefaultTracks() });
      if (state.midiTrackIndex >= tracks.length) {
        state.midiTrackIndex = 0;
      }
      return tracks[state.midiTrackIndex];
    },
    addMidiTrack() {
      const tracks = ensureMidiTracks(getWorld(), { fallbackInstrument, defaultTracks: getDefaultTracks() });
      const index = tracks.length + 1;
      tracks.push({
        id: `track-${Date.now()}-${index}`,
        name: `Track ${index}`,
        instrument: fallbackInstrument,
        notes: []
      });
      state.midiTrackIndex = tracks.length - 1;
      persist();
    },
    removeMidiTrack() {
      const tracks = ensureMidiTracks(getWorld(), { fallbackInstrument, defaultTracks: getDefaultTracks() });
      if (tracks.length <= 1) return;
      tracks.splice(state.midiTrackIndex, 1);
      state.midiTrackIndex = clamp(state.midiTrackIndex, 0, tracks.length - 1);
      persist();
    },
    toggleMidiNote(pitch, start, length) {
      const track = this.getActiveMidiTrack();
      if (!track) return;
      const existingIndex = track.notes.findIndex((note) => note.pitch === pitch && note.start === start);
      if (existingIndex >= 0) {
        track.notes.splice(existingIndex, 1);
      } else {
        const maxLength = state.midiGridBounds?.cols || 16;
        const nextLength = clamp(length || 1, 1, maxLength);
        track.notes.push({ pitch, start, length: nextLength });
        playPreview(pitch, track.instrument);
      }
      persist();
    }
  };
}
