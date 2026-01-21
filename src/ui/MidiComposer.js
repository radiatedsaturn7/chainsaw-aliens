const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALE_LIBRARY = [
  { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] }
];

const QUANTIZE_OPTIONS = [
  { id: '1/4', label: '1/4', ticks: 8 },
  { id: '1/8', label: '1/8', ticks: 4 },
  { id: '1/16', label: '1/16', ticks: 2 },
  { id: '1/32', label: '1/32', ticks: 1 }
];

const LOOP_OPTIONS = [1, 2, 4, 8];

const INSTRUMENT_PRESETS = [
  { id: 'lead', label: 'Lead' },
  { id: 'bass', label: 'Bass' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'pad', label: 'Pad' },
  { id: 'keys', label: 'Keys' },
  { id: 'drums', label: 'Drums', isDrum: true }
];

const DRUM_ROWS = [
  { label: 'Kick', pitch: 36, sample: 'kick' },
  { label: 'Snare', pitch: 38, sample: 'snare' },
  { label: 'Hat', pitch: 42, sample: 'hat' },
  { label: 'Tom', pitch: 45, sample: 'tom' },
  { label: 'Crash', pitch: 49, sample: 'crash' }
];

const TRACK_COLORS = ['#4fb7ff', '#ff9c42', '#55d68a', '#b48dff', '#ff6a6a', '#43d5d0'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uid = () => `note-${Math.floor(Math.random() * 1000000)}`;

const createDefaultSong = () => ({
  tempo: 120,
  loopBars: 4,
  key: 0,
  scale: 'minor',
  tracks: [
    {
      id: 'track-lead',
      name: 'Lead',
      instrument: 'lead',
      volume: 0.8,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
      patterns: [{ id: 'pattern-lead', bars: 4, notes: [] }]
    },
    {
      id: 'track-bass',
      name: 'Bass',
      instrument: 'bass',
      volume: 0.8,
      mute: false,
      solo: false,
      color: TRACK_COLORS[1],
      patterns: [{ id: 'pattern-bass', bars: 4, notes: [] }]
    },
    {
      id: 'track-drums',
      name: 'Drums',
      instrument: 'drums',
      volume: 0.9,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      patterns: [{ id: 'pattern-drums', bars: 4, notes: [] }]
    }
  ],
  progression: [
    { root: 0, quality: 'min', startBar: 1, lengthBars: 1 },
    { root: 5, quality: 'min', startBar: 2, lengthBars: 1 },
    { root: 7, quality: 'maj', startBar: 3, lengthBars: 1 },
    { root: 3, quality: 'maj', startBar: 4, lengthBars: 1 }
  ]
});

export default class MidiComposer {
  constructor(game) {
    this.game = game;
    this.storageKey = 'chainsaw-midi-composer';
    this.ticksPerBeat = 8;
    this.beatsPerBar = 4;
    this.quantizeOptions = QUANTIZE_OPTIONS;
    this.quantizeIndex = 2;
    this.quantizeEnabled = true;
    this.swing = 0;
    this.previewOnEdit = true;
    this.scrubAudition = false;
    this.metronomeEnabled = false;
    this.scaleLock = true;
    this.song = this.loadSong();
    this.selectedTrackIndex = 0;
    this.selectedPatternIndex = 0;
    this.playheadTick = 0;
    this.lastPlaybackTick = 0;
    this.isPlaying = false;
    this.activeNotes = new Map();
    this.dragState = null;
    this.selection = new Set();
    this.clipboard = null;
    this.cursor = { tick: 0, pitch: 60 };
    this.toolsMenuOpen = false;
    this.qaOverlayOpen = false;
    this.qaResults = [];
    this.draggingVolume = null;
    this.longPressTimer = null;
    this.lastAuditionTime = 0;
    this.lastPointer = { x: 0, y: 0 };
    this.settingsOpen = false;
    this.instrumentPicker = {
      open: false,
      mode: null,
      trackIndex: null,
      bounds: [],
      closeBounds: null
    };
    this.gridZoom = 1;
    this.gridOffset = { x: 0, y: 0 };
    this.gridGesture = null;
    this.bounds = {
      settings: null,
      settingsClose: null,
      settingsDialog: null,
      transport: null,
      play: null,
      tempoDown: null,
      tempoUp: null,
      loop: null,
      metronome: null,
      quantizeToggle: null,
      quantizeValue: null,
      swing: null,
      preview: null,
      key: null,
      scale: null,
      scaleLock: null,
      tools: null,
      scrub: null,
      addTrack: null,
      removeTrack: null,
      duplicateTrack: null
    };
    this.trackBounds = [];
    this.trackControlBounds = [];
    this.patternBounds = [];
    this.noteBounds = [];
    this.toolsMenuBounds = [];
    this.gridBounds = null;
    this.rulerBounds = null;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.applyImportedSong(data);
        } catch (error) {
          console.warn('Invalid song file', error);
        }
      };
      reader.readAsText(file);
    });
    this.ensureState();
  }

  loadSong() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return createDefaultSong();
    try {
      const parsed = JSON.parse(stored);
      return this.validateSong(parsed) ? parsed : createDefaultSong();
    } catch (error) {
      return createDefaultSong();
    }
  }

  persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.song));
  }

  validateSong(song) {
    return song
      && Array.isArray(song.tracks)
      && typeof song.tempo === 'number'
      && typeof song.loopBars === 'number';
  }

  ensureState() {
    if (!this.song) {
      this.song = createDefaultSong();
    }
    if (!Array.isArray(this.song.tracks) || this.song.tracks.length === 0) {
      this.song.tracks = createDefaultSong().tracks;
    }
    this.song.tracks.forEach((track, index) => {
      if (!Array.isArray(track.patterns) || track.patterns.length === 0) {
        track.patterns = [{ id: `pattern-${track.id}`, bars: this.song.loopBars, notes: [] }];
      }
      if (!track.color) {
        track.color = TRACK_COLORS[index % TRACK_COLORS.length];
      }
    });
    this.song.loopBars = clamp(this.song.loopBars || 4, 1, 8);
    if (!this.song.progression) {
      this.song.progression = createDefaultSong().progression;
    }
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
    const activeTrack = this.getActiveTrack();
    if (activeTrack) {
      this.selectedPatternIndex = clamp(this.selectedPatternIndex, 0, activeTrack.patterns.length - 1);
    } else {
      this.selectedPatternIndex = 0;
    }
    this.persist();
  }

  getActiveTrack() {
    return this.song.tracks[this.selectedTrackIndex];
  }

  getActivePattern() {
    const track = this.getActiveTrack();
    if (!track) return null;
    return track.patterns[this.selectedPatternIndex];
  }

  isMobileLayout() {
    return Boolean(this.game?.isMobile);
  }

  getInstrumentLabel(instrumentId) {
    return INSTRUMENT_PRESETS.find((preset) => preset.id === instrumentId)?.label || instrumentId;
  }

  getUniqueTrackName(baseName) {
    const existing = new Set(this.song.tracks.map((track) => track.name));
    if (!existing.has(baseName)) return baseName;
    let counter = 2;
    while (existing.has(`${baseName} ${counter}`)) {
      counter += 1;
    }
    return `${baseName} ${counter}`;
  }

  openInstrumentPicker(mode, trackIndex = null) {
    this.instrumentPicker.open = true;
    this.instrumentPicker.mode = mode;
    this.instrumentPicker.trackIndex = trackIndex;
    this.instrumentPicker.bounds = [];
    this.instrumentPicker.closeBounds = null;
  }

  applyInstrumentSelection(preset) {
    if (!preset) return;
    if (this.instrumentPicker.mode === 'add') {
      const name = this.getUniqueTrackName(preset.label);
      const track = {
        id: `track-${uid()}`,
        name,
        instrument: preset.id,
        volume: 0.8,
        mute: false,
        solo: false,
        color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
        patterns: [{ id: `pattern-${uid()}`, bars: this.song.loopBars, notes: [] }]
      };
      this.song.tracks.push(track);
      this.selectedTrackIndex = this.song.tracks.length - 1;
      this.persist();
    } else if (this.instrumentPicker.mode === 'edit') {
      const track = this.song.tracks[this.instrumentPicker.trackIndex];
      if (track) {
        track.instrument = preset.id;
        this.persist();
      }
    }
    this.instrumentPicker.open = false;
    this.instrumentPicker.mode = null;
    this.instrumentPicker.trackIndex = null;
  }

  isModalOpen() {
    return this.qaOverlayOpen || this.settingsOpen || this.instrumentPicker.open || this.toolsMenuOpen;
  }

  closeModal() {
    if (this.qaOverlayOpen) {
      this.qaOverlayOpen = false;
    }
    if (this.settingsOpen) {
      this.settingsOpen = false;
    }
    if (this.instrumentPicker.open) {
      this.instrumentPicker.open = false;
    }
    this.toolsMenuOpen = false;
  }

  getLoopTicks() {
    return this.song.loopBars * this.beatsPerBar * this.ticksPerBeat;
  }

  getQuantizeTicks() {
    if (!this.quantizeEnabled) return 1;
    return this.quantizeOptions[this.quantizeIndex]?.ticks || 1;
  }

  getScaleSteps() {
    const scale = SCALE_LIBRARY.find((entry) => entry.id === this.song.scale) || SCALE_LIBRARY[0];
    return scale.steps;
  }

  getScalePitchClasses() {
    const root = this.song.key || 0;
    return this.getScaleSteps().map((step) => (root + step) % 12);
  }

  snapPitchToScale(pitch) {
    const track = this.getActiveTrack();
    if (track?.instrument === 'drums') return pitch;
    if (!this.scaleLock) return pitch;
    const pitchClasses = this.getScalePitchClasses();
    const octave = Math.floor(pitch / 12);
    const pitchClass = pitch % 12;
    if (pitchClasses.includes(pitchClass)) return pitch;
    let closest = pitch;
    let minDistance = Infinity;
    pitchClasses.forEach((candidate) => {
      const base = octave * 12 + candidate;
      const distance = Math.abs(base - pitch);
      if (distance < minDistance) {
        minDistance = distance;
        closest = base;
      }
    });
    return closest;
  }

  snapTick(tick) {
    const quantize = this.getQuantizeTicks();
    return Math.round(tick / quantize) * quantize;
  }

  getChordForTick(tick) {
    const bar = Math.floor(tick / (this.ticksPerBeat * this.beatsPerBar)) + 1;
    return this.song.progression.find((chord) => bar >= chord.startBar && bar < chord.startBar + chord.lengthBars)
      || this.song.progression[0];
  }

  getChordTones(chord) {
    if (!chord) return [];
    const root = chord.root;
    const thirdInterval = chord.quality === 'min' ? 3 : chord.quality === 'dim' ? 3 : 4;
    const fifthInterval = chord.quality === 'dim' ? 6 : 7;
    return [root, (root + thirdInterval) % 12, (root + fifthInterval) % 12];
  }

  update(input, dt) {
    this.ensureState();
    this.handleKeyboardShortcuts(input);
    if (this.isPlaying) {
      this.advancePlayhead(dt);
    }
    this.cleanupActiveNotes();
  }

  handleKeyboardShortcuts(input) {
    const ctrl = input.isDownCode?.('ControlLeft') || input.isDownCode?.('ControlRight');
    const meta = input.isDownCode?.('MetaLeft') || input.isDownCode?.('MetaRight');
    const cmd = ctrl || meta;
    if (cmd && input.wasPressedCode?.('KeyC')) {
      this.copySelection();
    }
    if (cmd && input.wasPressedCode?.('KeyV')) {
      this.pasteSelection();
    }
    if (cmd && input.wasPressedCode?.('KeyD')) {
      this.duplicateSelection();
    }
  }

  advancePlayhead(dt) {
    const tempo = this.song.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const loopTicks = this.getLoopTicks();
    const previous = this.playheadTick;
    this.playheadTick = (this.playheadTick + ticksPerSecond * dt) % loopTicks;
    this.triggerPlayback(previous, this.playheadTick, loopTicks);
  }

  triggerPlayback(startTick, endTick, loopTicks) {
    const crossed = startTick <= endTick
      ? [{ start: startTick, end: endTick }]
      : [
        { start: startTick, end: loopTicks },
        { start: 0, end: endTick }
      ];
    crossed.forEach((range) => {
      this.song.tracks.forEach((track) => {
        if (this.isTrackMuted(track)) return;
        const pattern = track.patterns[this.selectedPatternIndex];
        if (!pattern) return;
        pattern.notes.forEach((note) => {
          const noteStart = this.getSwingedTick(note.startTick);
          if (noteStart >= range.start && noteStart < range.end) {
            this.playNote(track, note, noteStart);
          }
        });
      });
      if (this.metronomeEnabled) {
        this.triggerMetronome(range.start, range.end, loopTicks);
      }
    });
  }

  triggerMetronome(startTick, endTick, loopTicks) {
    const beatTicks = this.ticksPerBeat;
    const startBeat = Math.floor(startTick / beatTicks);
    const endBeat = Math.floor(endTick / beatTicks);
    for (let beat = startBeat; beat <= endBeat; beat += 1) {
      const beatTick = beat * beatTicks;
      if (beatTick >= startTick && beatTick < endTick) {
        const pitch = beat % this.beatsPerBar === 0 ? 84 : 72;
        this.playSampled(pitch, 0.15, 0.4, 'lead');
      }
    }
    if (endTick < startTick) {
      this.triggerMetronome(0, endTick, loopTicks);
    }
  }

  getSwingedTick(tick) {
    if (this.swing <= 0) return tick;
    const swingAmount = (this.swing / 100) * (this.ticksPerBeat / 2) * 0.6;
    const halfBeat = this.ticksPerBeat / 2;
    const offset = tick % this.ticksPerBeat;
    if (offset >= halfBeat && offset < this.ticksPerBeat) {
      return tick + swingAmount;
    }
    return tick;
  }

  playNote(track, note, startTick) {
    const duration = note.durationTicks / this.ticksPerBeat;
    const velocity = note.velocity ?? 0.8;
    const instrument = track.instrument || 'lead';
    if (instrument === 'drums') {
      const drum = DRUM_ROWS.find((row) => row.pitch === note.pitch) || DRUM_ROWS[0];
      this.playSampled(drum.pitch, duration, velocity * track.volume, drum.sample);
    } else {
      this.playSampled(note.pitch, duration, velocity * track.volume, instrument);
    }
    const now = performance.now();
    this.activeNotes.set(note.id, { trackId: track.id, expires: now + duration * 1000 + 120 });
    this.lastPlaybackTick = startTick;
  }

  playSampled(pitch, duration, volume, instrument) {
    if (!this.game?.audio?.playSampledNote) return;
    this.game.audio.playSampledNote({ pitch, duration, volume, instrument });
  }

  cleanupActiveNotes() {
    const now = performance.now();
    Array.from(this.activeNotes.entries()).forEach(([id, payload]) => {
      if (payload.expires <= now) {
        this.activeNotes.delete(id);
      }
    });
  }

  handlePointerDown(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    const { x, y } = payload;
    if (this.qaOverlayOpen) {
      const hit = this.qaBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (hit) {
        if (hit.id === 'qa-load') this.loadDemoSong();
        if (hit.id === 'qa-run') this.runQaChecks();
        if (hit.id === 'qa-close') this.qaOverlayOpen = false;
      }
      return;
    }
    if (this.instrumentPicker.open) {
      if (this.instrumentPicker.closeBounds && this.pointInBounds(x, y, this.instrumentPicker.closeBounds)) {
        this.instrumentPicker.open = false;
        return;
      }
      const pickHit = this.instrumentPicker.bounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pickHit) {
        this.applyInstrumentSelection(pickHit.preset);
        return;
      }
      if (this.instrumentPicker.bounds.length > 0) {
        this.instrumentPicker.open = false;
      }
      return;
    }
    if (this.settingsOpen) {
      if (this.bounds.settingsClose && this.pointInBounds(x, y, this.bounds.settingsClose)) {
        this.settingsOpen = false;
        this.toolsMenuOpen = false;
        return;
      }
      if (this.bounds.settingsDialog && !this.pointInBounds(x, y, this.bounds.settingsDialog)) {
        this.settingsOpen = false;
        this.toolsMenuOpen = false;
        return;
      }
      if (this.toolsMenuOpen) {
        const menuHit = this.toolsMenuBounds.find((bounds) => this.pointInBounds(x, y, bounds));
        if (menuHit) {
          this.handleToolsMenu(menuHit.id);
        } else {
          this.toolsMenuOpen = false;
        }
        return;
      }
      if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play)) {
        this.togglePlayback();
        return;
      }
      if (this.bounds.tempoDown && this.pointInBounds(x, y, this.bounds.tempoDown)) {
        this.setTempo(this.song.tempo - 1);
        return;
      }
      if (this.bounds.tempoUp && this.pointInBounds(x, y, this.bounds.tempoUp)) {
        this.setTempo(this.song.tempo + 1);
        return;
      }
      if (this.bounds.loop && this.pointInBounds(x, y, this.bounds.loop)) {
        this.cycleLoopLength();
        return;
      }
      if (this.bounds.metronome && this.pointInBounds(x, y, this.bounds.metronome)) {
        this.metronomeEnabled = !this.metronomeEnabled;
        return;
      }
      if (this.bounds.quantizeToggle && this.pointInBounds(x, y, this.bounds.quantizeToggle)) {
        this.quantizeEnabled = !this.quantizeEnabled;
        return;
      }
      if (this.bounds.quantizeValue && this.pointInBounds(x, y, this.bounds.quantizeValue)) {
        this.quantizeIndex = (this.quantizeIndex + 1) % this.quantizeOptions.length;
        return;
      }
      if (this.bounds.swing && this.pointInBounds(x, y, this.bounds.swing)) {
        this.dragState = { mode: 'swing', startX: x };
        return;
      }
      if (this.bounds.preview && this.pointInBounds(x, y, this.bounds.preview)) {
        this.previewOnEdit = !this.previewOnEdit;
        return;
      }
      if (this.bounds.key && this.pointInBounds(x, y, this.bounds.key)) {
        this.song.key = (this.song.key + 1) % 12;
        this.persist();
        return;
      }
      if (this.bounds.scale && this.pointInBounds(x, y, this.bounds.scale)) {
        const currentIndex = SCALE_LIBRARY.findIndex((scale) => scale.id === this.song.scale);
        const nextIndex = (currentIndex + 1) % SCALE_LIBRARY.length;
        this.song.scale = SCALE_LIBRARY[nextIndex].id;
        this.persist();
        return;
      }
      if (this.bounds.scaleLock && this.pointInBounds(x, y, this.bounds.scaleLock)) {
        this.scaleLock = !this.scaleLock;
        return;
      }
      if (this.bounds.scrub && this.pointInBounds(x, y, this.bounds.scrub)) {
        this.scrubAudition = !this.scrubAudition;
        return;
      }
      if (this.bounds.tools && this.pointInBounds(x, y, this.bounds.tools)) {
        this.toolsMenuOpen = !this.toolsMenuOpen;
        return;
      }
      if (this.bounds.addTrack && this.pointInBounds(x, y, this.bounds.addTrack)) {
        this.addTrack();
        return;
      }
      if (this.bounds.removeTrack && this.pointInBounds(x, y, this.bounds.removeTrack)) {
        this.removeTrack();
        return;
      }
      if (this.bounds.duplicateTrack && this.pointInBounds(x, y, this.bounds.duplicateTrack)) {
        this.duplicateTrack();
        return;
      }
      const trackControlHit = this.trackControlBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (trackControlHit) {
        this.handleTrackControl(trackControlHit);
        return;
      }
      const trackHit = this.trackBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (trackHit) {
        this.selectedTrackIndex = trackHit.index;
        this.selection.clear();
        return;
      }
      return;
    }
    if (this.bounds.settings && this.pointInBounds(x, y, this.bounds.settings)) {
      this.settingsOpen = true;
      return;
    }
    if (this.rulerBounds && this.pointInBounds(x, y, this.rulerBounds)) {
      const tick = this.getTickFromX(x);
      this.playheadTick = clamp(tick, 0, this.getLoopTicks());
      if (this.scrubAudition) {
        this.previewNotesAtTick(this.playheadTick);
      }
      this.dragState = { mode: 'scrub' };
      return;
    }
    if (this.gridBounds && this.pointInBounds(x, y, this.gridBounds)) {
      this.handleGridPointerDown(payload);
    }
  }

  handlePointerMove(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.qaOverlayOpen) return;
    if (this.dragState?.mode === 'swing') {
      const delta = payload.x - this.dragState.startX;
      this.swing = clamp(this.swing + delta * 0.15, 0, 60);
      this.dragState.startX = payload.x;
      return;
    }
    if (this.draggingVolume) {
      this.updateTrackVolume(payload.x, payload.y);
      return;
    }
    if (!this.dragState || !this.gridBounds) return;
    if (this.dragState.mode === 'scrub') {
      const tick = this.getTickFromX(payload.x);
      this.playheadTick = clamp(tick, 0, this.getLoopTicks());
      if (this.scrubAudition) {
        this.previewNotesAtTick(this.playheadTick);
      }
      return;
    }
    if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
    const cell = this.getGridCell(payload.x, payload.y);
    if (!cell) return;
    if (this.dragState.mode === 'paint') {
      this.paintNoteAt(cell.tick, cell.pitch, true);
    } else if (this.dragState.mode === 'erase') {
      this.eraseNoteAt(cell.tick, cell.pitch);
    } else if (this.dragState.mode === 'move') {
      this.moveSelectionTo(cell.tick, cell.pitch);
    } else if (this.dragState.mode === 'resize') {
      this.resizeSelectionTo(cell.tick);
    } else if (this.dragState.mode === 'select') {
      this.updateSelectionBox(payload.x, payload.y);
    }
  }

  handlePointerUp(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.dragState?.mode === 'select') {
      this.finalizeSelectionBox();
    }
    this.dragState = null;
    this.draggingVolume = null;
  }

  handleGestureStart(payload) {
    if (!this.gridBounds || this.settingsOpen || this.instrumentPicker.open || this.qaOverlayOpen) return;
    if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
    this.gridGesture = {
      startDistance: payload.distance,
      startZoom: this.gridZoom,
      startOffsetX: this.gridOffset.x,
      startOffsetY: this.gridOffset.y,
      startX: payload.x,
      startY: payload.y,
      viewX: this.gridBounds.x,
      viewY: this.gridBounds.y,
      cellWidth: this.gridBounds.cellWidth,
      cellHeight: this.gridBounds.cellHeight,
      originX: this.gridBounds.originX,
      originY: this.gridBounds.originY,
      cols: this.gridBounds.cols,
      rows: this.gridBounds.rows,
      viewW: this.gridBounds.w,
      viewH: this.gridBounds.h
    };
  }

  handleGestureMove(payload) {
    if (!this.gridGesture?.startDistance) return;
    const scale = payload.distance / this.gridGesture.startDistance;
    const nextZoom = clamp(this.gridGesture.startZoom * scale, 0.6, 2.5);
    const baseCellWidth = this.gridGesture.cellWidth / this.gridGesture.startZoom;
    const baseCellHeight = this.gridGesture.cellHeight / this.gridGesture.startZoom;
    const nextCellWidth = baseCellWidth * nextZoom;
    const nextCellHeight = baseCellHeight * nextZoom;
    const gridCoordX = (this.gridGesture.startX - this.gridGesture.originX) / this.gridGesture.cellWidth;
    const gridCoordY = (this.gridGesture.startY - this.gridGesture.originY) / this.gridGesture.cellHeight;
    const nextOriginX = payload.x - gridCoordX * nextCellWidth;
    const nextOriginY = payload.y - gridCoordY * nextCellHeight;
    this.gridZoom = nextZoom;
    this.gridOffset.x = nextOriginX - this.gridGesture.viewX;
    this.gridOffset.y = nextOriginY - this.gridGesture.viewY;
    const nextGridW = nextCellWidth * this.gridGesture.cols;
    const nextGridH = nextCellHeight * this.gridGesture.rows;
    this.clampGridOffset(this.gridGesture.viewW, this.gridGesture.viewH, nextGridW, nextGridH);
  }

  handleGestureEnd() {
    this.gridGesture = null;
  }

  handleGridPointerDown(payload) {
    const { x, y, button } = payload;
    const cell = this.getGridCell(x, y);
    if (!cell) return;
    const modifiers = this.getModifiers();
    const hit = this.getNoteAtCell(cell.tick, cell.pitch);
    if (button === 2 || modifiers.alt) {
      if (hit) {
        this.deleteNote(hit.note);
      } else {
        this.dragState = { mode: 'erase' };
      }
      return;
    }
    if (hit) {
      if (modifiers.meta) {
        this.toggleSelection(hit.note.id);
        return;
      }
      if (!this.selection.has(hit.note.id)) {
        this.selection.clear();
        this.selection.add(hit.note.id);
      }
      if (hit.edge) {
        this.dragState = {
          mode: 'resize',
          edge: hit.edge,
          startTick: cell.tick,
          originalNotes: this.getSelectedNotes().map((note) => ({ ...note }))
        };
        return;
      }
      if (modifiers.shift) {
        this.duplicateSelection();
      }
      this.dragState = {
        mode: 'move',
        startTick: cell.tick,
        startPitch: cell.pitch,
        originalNotes: this.getSelectedNotes().map((note) => ({ ...note }))
      };
      this.previewNote(hit.note, cell.pitch);
      return;
    }
    if (modifiers.meta) {
      this.dragState = { mode: 'select', startX: x, startY: y, currentX: x, currentY: y };
      return;
    }
    this.selection.clear();
    this.paintNoteAt(cell.tick, cell.pitch, false);
    this.dragState = { mode: 'paint' };
    if (payload.touchCount) {
      this.longPressTimer = window.setTimeout(() => {
        const heldCell = this.getGridCell(this.lastPointer.x, this.lastPointer.y);
        if (!heldCell) return;
        const heldNote = this.getNoteAtCell(heldCell.tick, heldCell.pitch);
        if (heldNote) {
          this.deleteNote(heldNote.note);
        }
      }, 500);
    }
  }

  paintNoteAt(tick, pitch, continuous) {
    const pattern = this.getActivePattern();
    if (!pattern) return;
    const snappedTick = this.snapTick(tick);
    const snappedPitch = this.snapPitchToScale(pitch);
    const existing = pattern.notes.find((note) => note.startTick === snappedTick && note.pitch === snappedPitch);
    if (existing) {
      if (!continuous) {
        this.selection.clear();
        this.selection.add(existing.id);
        this.previewNote(existing, snappedPitch);
      }
      return;
    }
    const duration = this.getQuantizeTicks();
    const note = {
      id: uid(),
      startTick: snappedTick,
      durationTicks: duration,
      pitch: snappedPitch,
      velocity: 0.9
    };
    pattern.notes.push(note);
    this.selection.clear();
    this.selection.add(note.id);
    this.cursor = { tick: snappedTick, pitch: snappedPitch };
    this.previewNote(note, snappedPitch);
    this.persist();
  }

  eraseNoteAt(tick, pitch) {
    const hit = this.getNoteAtCell(tick, pitch);
    if (!hit) return;
    this.deleteNote(hit.note);
  }

  deleteNote(note) {
    const pattern = this.getActivePattern();
    if (!pattern) return;
    pattern.notes = pattern.notes.filter((entry) => entry.id !== note.id);
    this.selection.delete(note.id);
    this.persist();
  }

  moveSelectionTo(tick, pitch) {
    const pattern = this.getActivePattern();
    if (!pattern || !this.dragState?.originalNotes) return;
    const startTick = this.snapTick(tick);
    const snappedPitch = this.snapPitchToScale(pitch);
    const deltaTick = startTick - this.dragState.startTick;
    const deltaPitch = snappedPitch - this.dragState.startPitch;
    const loopTicks = this.getLoopTicks();
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id);
      const nextStart = clamp(original.startTick + deltaTick, 0, loopTicks - 1);
      const nextPitch = clamp(original.pitch + deltaPitch, this.getPitchRange().min, this.getPitchRange().max);
      return { ...note, startTick: nextStart, pitch: this.snapPitchToScale(nextPitch) };
    });
    this.persist();
    const previewTarget = this.getSelectedNotes()[0];
    if (previewTarget) {
      this.previewNote(previewTarget, snappedPitch);
    }
  }

  resizeSelectionTo(tick) {
    const pattern = this.getActivePattern();
    if (!pattern || !this.dragState?.originalNotes) return;
    const snappedTick = this.snapTick(tick);
    const loopTicks = this.getLoopTicks();
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id);
      let startTick = original.startTick;
      let duration = original.durationTicks;
      if (this.dragState.edge === 'start') {
        const nextStart = clamp(snappedTick, 0, original.startTick + original.durationTicks - 1);
        duration = clamp(original.startTick + original.durationTicks - nextStart, 1, loopTicks);
        startTick = nextStart;
      } else {
        duration = clamp(snappedTick - original.startTick, 1, loopTicks - original.startTick);
      }
      return { ...note, startTick, durationTicks: duration };
    });
    this.persist();
  }

  updateSelectionBox(x, y) {
    if (!this.dragState) return;
    this.dragState.currentX = x;
    this.dragState.currentY = y;
  }

  finalizeSelectionBox() {
    if (!this.dragState || !this.gridBounds) return;
    const { startX, startY, currentX, currentY } = this.dragState;
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);
    const pattern = this.getActivePattern();
    if (!pattern) return;
    this.selection.clear();
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (rect && rect.x + rect.w >= minX && rect.x <= maxX && rect.y + rect.h >= minY && rect.y <= maxY) {
        this.selection.add(note.id);
      }
    });
  }

  copySelection() {
    const notes = this.getSelectedNotes();
    if (notes.length === 0) return;
    const minTick = Math.min(...notes.map((note) => note.startTick));
    const minPitch = Math.min(...notes.map((note) => note.pitch));
    this.clipboard = {
      notes: notes.map((note) => ({
        ...note,
        startTick: note.startTick - minTick,
        pitch: note.pitch - minPitch
      })),
      width: Math.max(...notes.map((note) => note.startTick + note.durationTicks)) - minTick,
      height: Math.max(...notes.map((note) => note.pitch)) - minPitch
    };
  }

  pasteSelection() {
    const pattern = this.getActivePattern();
    if (!pattern || !this.clipboard) return;
    const loopTicks = this.getLoopTicks();
    const baseTick = this.snapTick(this.cursor.tick || 0);
    const basePitch = this.snapPitchToScale(this.cursor.pitch || this.getPitchRange().min);
    const newIds = [];
    this.clipboard.notes.forEach((note) => {
      const startTick = clamp(baseTick + note.startTick, 0, loopTicks - 1);
      const pitch = clamp(basePitch + note.pitch, this.getPitchRange().min, this.getPitchRange().max);
      const newNote = {
        id: uid(),
        startTick,
        durationTicks: note.durationTicks,
        pitch,
        velocity: note.velocity
      };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    this.persist();
  }

  duplicateSelection() {
    const notes = this.getSelectedNotes();
    if (notes.length === 0) return;
    const pattern = this.getActivePattern();
    const loopTicks = this.getLoopTicks();
    const span = Math.max(...notes.map((note) => note.startTick + note.durationTicks))
      - Math.min(...notes.map((note) => note.startTick));
    const newIds = [];
    notes.forEach((note) => {
      const startTick = clamp(note.startTick + span, 0, loopTicks - 1);
      const newNote = { ...note, id: uid(), startTick };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    this.persist();
  }

  toggleSelection(noteId) {
    if (this.selection.has(noteId)) {
      this.selection.delete(noteId);
    } else {
      this.selection.add(noteId);
    }
  }

  getSelectedNotes() {
    const pattern = this.getActivePattern();
    if (!pattern) return [];
    return pattern.notes.filter((note) => this.selection.has(note.id));
  }

  previewNote(note, pitch) {
    if (!this.previewOnEdit || !note) return;
    const now = performance.now();
    if (now - this.lastAuditionTime < 90) return;
    this.lastAuditionTime = now;
    const track = this.getActiveTrack();
    if (!track) return;
    const duration = note.durationTicks / this.ticksPerBeat;
    if (track.instrument === 'drums') {
      const drum = DRUM_ROWS.find((row) => row.pitch === pitch) || DRUM_ROWS[0];
      this.playSampled(drum.pitch, duration, track.volume, drum.sample);
      return;
    }
    this.playSampled(pitch, duration, track.volume, track.instrument);
  }

  previewNotesAtTick(tick) {
    const pattern = this.getActivePattern();
    if (!pattern) return;
    pattern.notes.forEach((note) => {
      if (note.startTick <= tick && note.startTick + note.durationTicks > tick) {
        this.previewNote(note, note.pitch);
      }
    });
  }

  getModifiers() {
    const input = this.game?.input;
    return {
      alt: input?.isDownCode?.('AltLeft') || input?.isDownCode?.('AltRight'),
      shift: input?.isShiftDown?.(),
      meta: input?.isDownCode?.('ControlLeft')
        || input?.isDownCode?.('ControlRight')
        || input?.isDownCode?.('MetaLeft')
        || input?.isDownCode?.('MetaRight')
    };
  }

  setTempo(value) {
    this.song.tempo = clamp(value, 40, 240);
    this.persist();
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    if (!this.isPlaying) {
      this.lastPlaybackTick = this.playheadTick;
    }
  }

  cycleLoopLength() {
    const currentIndex = LOOP_OPTIONS.indexOf(this.song.loopBars);
    const nextIndex = (currentIndex + 1) % LOOP_OPTIONS.length;
    this.song.loopBars = LOOP_OPTIONS[nextIndex];
    this.song.tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = this.song.loopBars;
        const loopTicks = this.getLoopTicks();
        pattern.notes = pattern.notes.filter((note) => note.startTick < loopTicks);
      });
    });
    this.playheadTick = clamp(this.playheadTick, 0, this.getLoopTicks());
    this.persist();
  }

  addTrack() {
    this.openInstrumentPicker('add');
  }

  removeTrack() {
    if (this.song.tracks.length <= 1) return;
    this.song.tracks.splice(this.selectedTrackIndex, 1);
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
    this.persist();
  }

  duplicateTrack() {
    const track = this.getActiveTrack();
    if (!track) return;
    const cloned = {
      ...track,
      id: `track-${uid()}`,
      name: `${track.name} Copy`,
      patterns: track.patterns.map((pattern) => ({
        ...pattern,
        id: `pattern-${uid()}`,
        notes: pattern.notes.map((note) => ({ ...note, id: uid() }))
      }))
    };
    this.song.tracks.splice(this.selectedTrackIndex + 1, 0, cloned);
    this.selectedTrackIndex += 1;
    this.persist();
  }

  handleTrackControl(hit) {
    const track = this.song.tracks[hit.trackIndex];
    if (!track) return;
    if (hit.control === 'mute') {
      track.mute = !track.mute;
    } else if (hit.control === 'solo') {
      track.solo = !track.solo;
    } else if (hit.control === 'instrument') {
      this.openInstrumentPicker('edit', hit.trackIndex);
      return;
    } else if (hit.control === 'name') {
      const nextName = window.prompt('Track name?', track.name);
      if (nextName) track.name = nextName;
    } else if (hit.control === 'volume') {
      this.draggingVolume = hit;
      this.updateTrackVolume(hit.x, hit.y);
    }
    this.persist();
  }

  updateTrackVolume(x, y) {
    const hit = this.draggingVolume;
    if (!hit) return;
    const track = this.song.tracks[hit.trackIndex];
    if (!track) return;
    const volume = clamp((x - hit.x) / hit.w, 0, 1);
    track.volume = volume;
    this.persist();
  }

  isTrackMuted(track) {
    const soloTracks = this.song.tracks.filter((entry) => entry.solo);
    if (soloTracks.length > 0) {
      return !track.solo;
    }
    return track.mute;
  }

  handleToolsMenu(action) {
    if (action === 'generate') {
      this.generatePattern();
    }
    if (action === 'export') {
      this.exportSong();
    }
    if (action === 'import') {
      this.fileInput.click();
    }
    if (action === 'qa') {
      this.qaOverlayOpen = true;
      this.toolsMenuOpen = false;
    }
    if (action === 'demo') {
      this.loadDemoSong();
    }
  }

  generatePattern() {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const loopTicks = this.getLoopTicks();
    pattern.notes = [];
    if (track.instrument === 'drums') {
      for (let bar = 0; bar < this.song.loopBars; bar += 1) {
        const base = bar * this.beatsPerBar * this.ticksPerBeat;
        DRUM_ROWS.forEach((drum, index) => {
          if (index % 2 === 0) {
            pattern.notes.push({
              id: uid(),
              startTick: base + index * 2,
              durationTicks: 2,
              pitch: drum.pitch,
              velocity: 0.8
            });
          }
        });
      }
    } else {
      const scale = this.getScalePitchClasses();
      for (let tick = 0; tick < loopTicks; tick += this.getQuantizeTicks() * 2) {
        const pitchClass = scale[(tick / this.getQuantizeTicks()) % scale.length];
        const pitch = 60 + pitchClass;
        pattern.notes.push({
          id: uid(),
          startTick: tick,
          durationTicks: this.getQuantizeTicks(),
          pitch,
          velocity: 0.8
        });
      }
    }
    this.persist();
  }

  exportSong() {
    const data = JSON.stringify(this.song, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chainsaw-midi-song.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  applyImportedSong(data) {
    if (!this.validateSong(data)) {
      console.warn('Invalid song schema.');
      return;
    }
    this.song = data;
    this.selectedTrackIndex = 0;
    this.selectedPatternIndex = 0;
    this.ensureState();
    this.persist();
  }

  loadDemoSong() {
    this.song = createDefaultSong();
    this.ensureState();
    this.qaResults = [{ label: 'Demo loaded', status: 'pass' }];
  }

  runQaChecks() {
    const results = [];
    const loopTicks = this.getLoopTicks();
    results.push({
      label: 'Playhead moves',
      status: this.isPlaying ? 'warn' : 'pass'
    });
    results.push({
      label: 'Loop wraps',
      status: loopTicks > 0 ? 'pass' : 'fail'
    });
    const pattern = this.getActivePattern();
    results.push({
      label: 'Notes update',
      status: pattern && Array.isArray(pattern.notes) ? 'pass' : 'fail'
    });
    const snapshot = JSON.stringify(this.song);
    this.applyImportedSong(JSON.parse(snapshot));
    const roundtrip = JSON.stringify(this.song) === snapshot;
    results.push({
      label: 'Export/import roundtrip',
      status: roundtrip ? 'pass' : 'fail'
    });
    this.qaResults = results;
  }

  getPitchRange() {
    const track = this.getActiveTrack();
    if (track?.instrument === 'drums') {
      const pitches = DRUM_ROWS.map((row) => row.pitch);
      return { min: Math.min(...pitches), max: Math.max(...pitches) };
    }
    return { min: 48, max: 71 };
  }

  getGridCell(x, y) {
    if (!this.gridBounds) return null;
    const { originX, originY, cellWidth, cellHeight, rows, cols } = this.gridBounds;
    const col = Math.floor((x - originX) / cellWidth);
    const row = Math.floor((y - originY) / cellHeight);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    const tick = col;
    const pitch = this.getPitchFromRow(row);
    return { tick, pitch };
  }

  getTickFromX(x) {
    if (!this.gridBounds) return 0;
    const { originX, cellWidth } = this.gridBounds;
    return Math.floor((x - originX) / cellWidth);
  }

  getPitchFromRow(row) {
    const track = this.getActiveTrack();
    if (track?.instrument === 'drums') {
      const entry = DRUM_ROWS[row];
      return entry?.pitch ?? DRUM_ROWS[0].pitch;
    }
    const range = this.getPitchRange();
    return range.max - row;
  }

  getRowFromPitch(pitch) {
    const track = this.getActiveTrack();
    if (track?.instrument === 'drums') {
      return DRUM_ROWS.findIndex((row) => row.pitch === pitch);
    }
    const range = this.getPitchRange();
    return range.max - pitch;
  }

  getNoteAtCell(tick, pitch) {
    const pattern = this.getActivePattern();
    if (!pattern) return null;
    const hit = pattern.notes.find((note) => tick >= note.startTick && tick < note.startTick + note.durationTicks && note.pitch === pitch);
    if (!hit) return null;
    const rect = this.getNoteRect(hit);
    if (!rect) return null;
    const edgeMargin = Math.min(6, rect.w / 3);
    const isStartEdge = this.lastPointer.x <= rect.x + edgeMargin;
    const isEndEdge = this.lastPointer.x >= rect.x + rect.w - edgeMargin;
    return { note: hit, edge: isStartEdge ? 'start' : isEndEdge ? 'end' : null };
  }

  getNoteRect(note) {
    if (!this.gridBounds) return null;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(note.pitch);
    if (row < 0) return null;
    return {
      x: originX + note.startTick * cellWidth,
      y: originY + row * cellHeight + 1,
      w: Math.max(cellWidth * note.durationTicks, cellWidth),
      h: cellHeight - 2
    };
  }

  pointInBounds(x, y, bounds) {
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  clampGridOffset(viewW, viewH, gridW, gridH) {
    if (!this.gridOffset) {
      this.gridOffset = { x: 0, y: 0 };
    }
    const minX = Math.min(0, viewW - gridW);
    const minY = Math.min(0, viewH - gridH);
    this.gridOffset.x = clamp(this.gridOffset.x, minX, 0);
    this.gridOffset.y = clamp(this.gridOffset.y, minY, 0);
  }

  draw(ctx, width, height) {
    const track = this.getActiveTrack();
    const pattern = this.getActivePattern();
    ctx.save();
    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = '24px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Pattern Sequencer', 24, 40);

    const headerH = this.isMobileLayout() ? 62 : 54;
    this.bounds.settings = { x: width - 144, y: 16, w: 120, h: 32 };
    this.drawSmallButton(ctx, this.bounds.settings, 'Settings', this.settingsOpen);

    if (track) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px Courier New';
      ctx.fillText(`Track: ${track.name}`, 24, headerH);
    }

    const contentX = 20;
    const contentY = headerH + 12;
    const contentW = width - 40;
    const contentH = height - contentY - 24;
    this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);

    if (this.settingsOpen) {
      this.drawSettingsDialog(ctx, width, height);
    }

    if (this.instrumentPicker.open) {
      this.drawInstrumentPicker(ctx, width, height);
    }

    if (this.qaOverlayOpen) {
      this.drawQaOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  drawTransport(ctx, x, y, w, h) {
    const scale = Math.min(1, w / 980);
    const offset = (value) => value * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const buttonW = 92 * scale;
    const buttonH = 36 * scale;
    this.bounds.play = { x: x + offset(16), y: y + offset(18), w: buttonW, h: buttonH };
    ctx.fillStyle = this.isPlaying ? '#ffe16a' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.bounds.play.x, this.bounds.play.y, buttonW, buttonH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(this.bounds.play.x, this.bounds.play.y, buttonW, buttonH);
    ctx.fillStyle = this.isPlaying ? '#0b0b0b' : '#fff';
    ctx.font = `${Math.max(12, Math.round(16 * scale))}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(this.isPlaying ? 'STOP' : 'PLAY', this.bounds.play.x + buttonW / 2, this.bounds.play.y + buttonH * 0.65);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px Courier New`;
    ctx.fillText(`Tempo ${this.song.tempo} BPM`, x + offset(130), y + offset(32));
    this.bounds.tempoDown = { x: x + offset(260), y: y + offset(16), w: offset(24), h: offset(24) };
    this.bounds.tempoUp = { x: x + offset(292), y: y + offset(16), w: offset(24), h: offset(24) };
    this.drawSmallButton(ctx, this.bounds.tempoDown, '-', false);
    this.drawSmallButton(ctx, this.bounds.tempoUp, '+', false);

    this.bounds.loop = { x: x + offset(340), y: y + offset(16), w: offset(100), h: offset(24) };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.loop.x, this.bounds.loop.y, this.bounds.loop.w, this.bounds.loop.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(this.bounds.loop.x, this.bounds.loop.y, this.bounds.loop.w, this.bounds.loop.h);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Loop ${this.song.loopBars} bars`, this.bounds.loop.x + offset(8), this.bounds.loop.y + offset(16));

    this.bounds.metronome = { x: x + offset(460), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);

    this.bounds.quantizeToggle = { x: x + offset(590), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    this.bounds.quantizeValue = { x: x + offset(710), y: y + offset(16), w: offset(70), h: offset(24) };
    this.drawToggle(ctx, this.bounds.quantizeValue, this.quantizeOptions[this.quantizeIndex].label, true);

    this.bounds.swing = { x: x + offset(16), y: y + offset(58), w: offset(200), h: offset(16) };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    const knobX = this.bounds.swing.x + (this.swing / 60) * this.bounds.swing.w;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knobX - offset(4), this.bounds.swing.y - offset(2), offset(8), this.bounds.swing.h + offset(4));
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, Math.round(12 * scale))}px Courier New`;
    ctx.fillText(`Swing ${Math.round(this.swing)}%`, this.bounds.swing.x + offset(210), this.bounds.swing.y + offset(12));

    this.bounds.preview = { x: x + offset(340), y: y + offset(54), w: offset(150), h: offset(24) };
    this.drawToggle(ctx, this.bounds.preview, `Preview ${this.previewOnEdit ? 'On' : 'Off'}`, this.previewOnEdit);

    this.bounds.scrub = { x: x + offset(500), y: y + offset(54), w: offset(150), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scrub, `Scrub ${this.scrubAudition ? 'On' : 'Off'}`, this.scrubAudition);

    this.bounds.key = { x: x + offset(660), y: y + offset(54), w: offset(60), h: offset(24) };
    this.drawToggle(ctx, this.bounds.key, KEY_LABELS[this.song.key], true);
    const scaleLabel = SCALE_LIBRARY.find((scale) => scale.id === this.song.scale)?.label || 'Major';
    this.bounds.scale = { x: x + offset(728), y: y + offset(54), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scale, scaleLabel, true);
    this.bounds.scaleLock = { x: x + offset(848), y: y + offset(54), w: offset(120), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scaleLock, `Scale Lock ${this.scaleLock ? 'On' : 'Off'}`, this.scaleLock);

    this.bounds.tools = { x: x + w - offset(120), y: y + offset(18), w: offset(100), h: offset(28) };
    this.drawToggle(ctx, this.bounds.tools, 'Tools', false);

    const bar = Math.floor(this.playheadTick / (this.ticksPerBeat * this.beatsPerBar)) + 1;
    const beat = Math.floor((this.playheadTick % (this.ticksPerBeat * this.beatsPerBar)) / this.ticksPerBeat) + 1;
    ctx.fillStyle = '#ffe16a';
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px Courier New`;
    ctx.fillText(`Position ${bar}:${beat}`, x + w - offset(160), y + offset(70));
  }

  drawTransportCompact(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const innerX = x + 12;
    const innerW = w - 24;
    const rowH = 30;
    const gap = 8;
    const colGap = 12;
    const colW = (innerW - colGap) / 2;
    let rowY = y + 12;

    this.bounds.play = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.play, this.isPlaying ? 'Stop' : 'Play', this.isPlaying);
    this.bounds.tools = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tools, 'Tools', false);
    rowY += rowH + gap;

    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    ctx.fillText(`Tempo ${this.song.tempo} BPM`, innerX, rowY + 20);
    const tempoButtonW = 36;
    this.bounds.tempoDown = { x: innerX + innerW - tempoButtonW * 2 - 8, y: rowY, w: tempoButtonW, h: rowH };
    this.bounds.tempoUp = { x: innerX + innerW - tempoButtonW, y: rowY, w: tempoButtonW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoDown, '-', false);
    this.drawSmallButton(ctx, this.bounds.tempoUp, '+', false);
    rowY += rowH + gap;

    this.bounds.loop = { x: innerX, y: rowY, w: innerW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.loop, `Loop ${this.song.loopBars} bars`, false);
    rowY += rowH + gap;

    this.bounds.metronome = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    this.bounds.quantizeToggle = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    rowY += rowH + gap;

    this.bounds.quantizeValue = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.quantizeValue, this.quantizeOptions[this.quantizeIndex].label, true);
    this.bounds.preview = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.preview, `Preview ${this.previewOnEdit ? 'On' : 'Off'}`, this.previewOnEdit);
    rowY += rowH + gap;

    this.bounds.scrub = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scrub, `Scrub ${this.scrubAudition ? 'On' : 'Off'}`, this.scrubAudition);
    this.bounds.key = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.key, KEY_LABELS[this.song.key], true);
    rowY += rowH + gap;

    const scaleLabel = SCALE_LIBRARY.find((scale) => scale.id === this.song.scale)?.label || 'Major';
    this.bounds.scale = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scale, scaleLabel, true);
    this.bounds.scaleLock = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scaleLock, `Scale Lock ${this.scaleLock ? 'On' : 'Off'}`, this.scaleLock);
    rowY += rowH + gap;

    this.bounds.swing = { x: innerX, y: rowY + 6, w: innerW, h: 16 };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    const knobX = this.bounds.swing.x + (this.swing / 60) * this.bounds.swing.w;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knobX - 4, this.bounds.swing.y - 2, 8, this.bounds.swing.h + 4);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`Swing ${Math.round(this.swing)}%`, this.bounds.swing.x + 6, this.bounds.swing.y + 30);
  }

  drawTrackList(ctx, x, y, w, h) {
    const isMobile = this.isMobileLayout();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 18 : 16}px Courier New`;
    ctx.fillText('Tracks', x + 16, y + 26);

    const buttonY = y + 36;
    const buttonH = isMobile ? 28 : 22;
    this.bounds.addTrack = { x: x + 16, y: buttonY, w: 80, h: buttonH };
    this.bounds.removeTrack = { x: x + 104, y: buttonY, w: 90, h: buttonH };
    this.bounds.duplicateTrack = { x: x + 202, y: buttonY, w: 120, h: buttonH };
    this.drawSmallButton(ctx, this.bounds.addTrack, 'Add', false);
    this.drawSmallButton(ctx, this.bounds.removeTrack, 'Remove', false);
    this.drawSmallButton(ctx, this.bounds.duplicateTrack, 'Duplicate', false);

    this.trackBounds = [];
    this.trackControlBounds = [];
    const listY = y + (isMobile ? 84 : 72);
    const rowH = isMobile ? 86 : 62;
    this.song.tracks.forEach((track, index) => {
      const rowY = listY + index * rowH;
      const isActive = index === this.selectedTrackIndex;
      ctx.fillStyle = isActive ? 'rgba(255,225,106,0.2)' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 12, rowY, w - 24, rowH - 8);
      ctx.strokeStyle = track.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x + 12, rowY, w - 24, rowH - 8);
      ctx.fillStyle = track.color || '#fff';
      ctx.fillRect(x + 18, rowY + 8, 8, rowH - 24);
      ctx.fillStyle = '#fff';
      ctx.font = `${isMobile ? 16 : 14}px Courier New`;
      ctx.fillText(track.name, x + 32, rowY + (isMobile ? 26 : 20));
      this.trackControlBounds.push({
        x: x + 30,
        y: rowY + 6,
        w: w - 170,
        h: isMobile ? 24 : 20,
        trackIndex: index,
        control: 'name'
      });
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${isMobile ? 14 : 12}px Courier New`;
      const instrumentLabel = this.getInstrumentLabel(track.instrument);
      ctx.fillText(instrumentLabel, x + 32, rowY + (isMobile ? 52 : 38));
      this.trackControlBounds.push({
        x: x + 30,
        y: rowY + (isMobile ? 34 : 26),
        w: w - 170,
        h: isMobile ? 26 : 18,
        trackIndex: index,
        control: 'instrument'
      });

      const muteBounds = { x: x + w - 120, y: rowY + 8, w: isMobile ? 32 : 26, h: isMobile ? 22 : 18 };
      const soloBounds = { x: x + w - 82, y: rowY + 8, w: isMobile ? 32 : 26, h: isMobile ? 22 : 18 };
      this.drawSmallButton(ctx, muteBounds, 'M', track.mute);
      this.drawSmallButton(ctx, soloBounds, 'S', track.solo);
      this.trackControlBounds.push({ ...muteBounds, trackIndex: index, control: 'mute' });
      this.trackControlBounds.push({ ...soloBounds, trackIndex: index, control: 'solo' });

      const volumeBounds = { x: x + 32, y: rowY + (isMobile ? 66 : 44), w: w - 70, h: isMobile ? 12 : 10 };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * track.volume, volumeBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      this.trackControlBounds.push({ ...volumeBounds, trackIndex: index, control: 'volume' });

      this.trackBounds.push({ x: x + 12, y: rowY, w: w - 24, h: rowH - 8, index });
    });
  }

  drawPatternEditor(ctx, x, y, w, h, track, pattern) {
    if (!track || !pattern) return;
    const loopTicks = this.getLoopTicks();
    const rows = track.instrument === 'drums' ? DRUM_ROWS.length : this.getPitchRange().max - this.getPitchRange().min + 1;
    const baseCellWidth = w / loopTicks;
    const baseCellHeight = Math.min(22, (h - 40) / rows);
    const cellWidth = baseCellWidth * this.gridZoom;
    const cellHeight = baseCellHeight * this.gridZoom;
    const gridW = cellWidth * loopTicks;
    const gridH = cellHeight * rows;
    const viewH = Math.max(0, h - 26);
    const viewW = w;
    this.clampGridOffset(viewW, viewH, gridW, gridH);
    const originX = x + this.gridOffset.x;
    const originY = y + 26 + this.gridOffset.y;

    this.rulerBounds = { x, y, w, h: 24 };
    this.gridBounds = {
      x,
      y: y + 26,
      w: viewW,
      h: viewH,
      cols: loopTicks,
      rows,
      cellWidth,
      cellHeight,
      originX,
      originY,
      gridW,
      gridH
    };

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, viewH + 26);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, viewH + 26);

    this.drawRuler(ctx, x, y, w, loopTicks);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 26, viewW, viewH);
    ctx.clip();
    this.drawGrid(ctx, track, pattern, loopTicks);
    this.drawPlayhead(ctx);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    ctx.fillText('Alt/Right click: erase • Drag: paint • Ctrl/Cmd+Drag: box select • Shift+Drag: duplicate', x, y + viewH + 44);
  }

  drawRuler(ctx, x, y, w, loopTicks) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, 24);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    if (!this.gridBounds) return;
    const { originX, cellWidth } = this.gridBounds;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, 24);
    ctx.clip();
    for (let bar = 0; bar < this.song.loopBars; bar += 1) {
      const barX = originX + bar * ticksPerBar * cellWidth;
      ctx.fillText(`${bar + 1}`, barX + 4, y + 16);
    }
    ctx.restore();
  }

  drawGrid(ctx, track, pattern, loopTicks) {
    const { originX, originY, cellWidth, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = track.instrument === 'drums';
    const chord = this.getChordForTick(this.playheadTick || 0);
    const chordTones = this.getChordTones(chord);
    const scalePitchClasses = this.getScalePitchClasses();

    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      const pitchClass = pitch % 12;
      const isScaleTone = !isDrumGrid && scalePitchClasses.includes(pitchClass);
      const isChordTone = !isDrumGrid && chordTones.includes(pitchClass);
      if (isChordTone) {
        ctx.fillStyle = 'rgba(79,183,255,0.12)';
      } else if (isScaleTone) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
      }
      ctx.fillRect(originX, originY + row * cellHeight, cellWidth * loopTicks, cellHeight);
      const label = track.instrument === 'drums'
        ? DRUM_ROWS[row]?.label
        : NOTE_LABELS[pitchClass];
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      ctx.fillText(label, originX + 6, originY + row * cellHeight + cellHeight * 0.75);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let tick = 0; tick <= loopTicks; tick += 1) {
      const xPos = originX + tick * cellWidth;
      const isBeat = tick % this.ticksPerBeat === 0;
      ctx.strokeStyle = isBeat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(xPos, originY);
      ctx.lineTo(xPos, originY + rows * cellHeight);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let row = 0; row <= rows; row += 1) {
      const yPos = originY + row * cellHeight;
      ctx.beginPath();
      ctx.moveTo(originX, yPos);
      ctx.lineTo(originX + loopTicks * cellWidth, yPos);
      ctx.stroke();
    }

    this.noteBounds = [];
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      ctx.fillStyle = this.selection.has(note.id) ? '#ffe16a' : track.color || '#4fb7ff';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      if (this.activeNotes.has(note.id)) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      if (this.selection.has(note.id)) {
        ctx.fillStyle = '#0b0b0b';
        ctx.fillRect(rect.x, rect.y, 4, rect.h);
        ctx.fillRect(rect.x + rect.w - 4, rect.y, 4, rect.h);
      }
      this.noteBounds.push({ ...rect, noteId: note.id });
    });

    if (this.dragState?.mode === 'select') {
      const { startX, startY, currentX, currentY } = this.dragState;
      const rectX = Math.min(startX, currentX);
      const rectY = Math.min(startY, currentY);
      const rectW = Math.abs(currentX - startX);
      const rectH = Math.abs(currentY - startY);
      ctx.strokeStyle = '#ffe16a';
      ctx.strokeRect(rectX, rectY, rectW, rectH);
    }
  }

  drawPlayhead(ctx) {
    if (!this.gridBounds) return;
    const { originX, originY, cellWidth, rows, cellHeight } = this.gridBounds;
    const xPos = originX + this.playheadTick * cellWidth;
    ctx.strokeStyle = '#ffe16a';
    ctx.beginPath();
    ctx.moveTo(xPos, originY);
    ctx.lineTo(xPos, originY + rows * cellHeight);
    ctx.stroke();
  }

  drawSettingsDialog(ctx, width, height) {
    const dialogW = Math.min(1020, width - 40);
    const dialogH = Math.min(680, height - 40);
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;
    const padding = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);

    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.fillText('Settings', dialogX + padding, dialogY + 28);
    this.bounds.settingsDialog = { x: dialogX, y: dialogY, w: dialogW, h: dialogH };
    this.bounds.settingsClose = { x: dialogX + dialogW - 72, y: dialogY + 14, w: 56, h: 24 };
    this.drawSmallButton(ctx, this.bounds.settingsClose, 'Close', false);

    const contentY = dialogY + 48;
    const stacked = dialogW < 820;
    if (stacked) {
      const transportX = dialogX + padding;
      const transportY = contentY;
      const transportW = dialogW - padding * 2;
      const transportH = Math.min(340, dialogH * 0.55);
      this.drawTransportCompact(ctx, transportX, transportY, transportW, transportH);

      const trackX = transportX;
      const trackY = transportY + transportH + 20;
      const trackH = dialogH - (trackY - dialogY) - padding;
      this.drawTrackList(ctx, trackX, trackY, transportW, trackH);

      if (this.toolsMenuOpen) {
        this.drawToolsMenu(ctx, transportX + transportW - 180, transportY + 12);
      }
    } else {
      const trackW = 320;
      const trackX = dialogX + padding;
      const trackY = contentY;
      const trackH = dialogH - (trackY - dialogY) - padding;
      this.drawTrackList(ctx, trackX, trackY, trackW, trackH);

      const transportX = trackX + trackW + 20;
      const transportY = contentY;
      const transportW = dialogX + dialogW - transportX - padding;
      const transportH = 90;
      this.drawTransport(ctx, transportX, transportY, transportW, transportH);

      if (this.toolsMenuOpen) {
        this.drawToolsMenu(ctx, transportX + transportW - 180, transportY + 12);
      }
    }
  }

  drawInstrumentPicker(ctx, width, height) {
    const dialogW = Math.min(460, width - 40);
    const dialogH = Math.min(420, height - 40);
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;
    const padding = 16;
    const isMobile = this.isMobileLayout();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);

    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.fillText('Select Instrument', dialogX + padding, dialogY + 28);

    this.instrumentPicker.closeBounds = { x: dialogX + dialogW - 72, y: dialogY + 14, w: 56, h: 24 };
    this.drawSmallButton(ctx, this.instrumentPicker.closeBounds, 'Close', false);

    const columns = isMobile ? 1 : 2;
    const rowH = isMobile ? 42 : 32;
    const colGap = 12;
    const colW = (dialogW - padding * 2 - (columns - 1) * colGap) / columns;
    const startY = dialogY + 52;
    this.instrumentPicker.bounds = [];
    INSTRUMENT_PRESETS.forEach((preset, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const bx = dialogX + padding + col * (colW + colGap);
      const by = startY + row * (rowH + 8);
      const bounds = { x: bx, y: by, w: colW, h: rowH, preset };
      this.drawSmallButton(ctx, bounds, preset.label, false);
      this.instrumentPicker.bounds.push(bounds);
    });
  }

  drawToolsMenu(ctx, x, y) {
    const items = [
      { id: 'generate', label: 'Generate Pattern' },
      { id: 'export', label: 'Export JSON' },
      { id: 'import', label: 'Import JSON' },
      { id: 'demo', label: 'Load Demo Song' },
      { id: 'qa', label: 'QA Overlay' }
    ];
    const width = 180;
    const height = items.length * 22 + 16;
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    this.toolsMenuBounds = [];
    items.forEach((item, index) => {
      const itemY = y + 18 + index * 22;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(item.label, x + 12, itemY);
      this.toolsMenuBounds.push({
        x: x + 8,
        y: itemY - 12,
        w: width - 16,
        h: 18,
        id: item.id
      });
    });
  }

  drawQaOverlay(ctx, width, height) {
    const overlayW = Math.min(520, width - 80);
    const overlayH = Math.min(320, height - 120);
    const overlayX = (width - overlayW) / 2;
    const overlayY = (height - overlayH) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(overlayX, overlayY, overlayW, overlayH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(overlayX, overlayY, overlayW, overlayH);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('QA Overlay', overlayX + 16, overlayY + 28);

    const buttons = [
      { id: 'qa-load', label: 'Load Demo', x: overlayX + 16, y: overlayY + 50, w: 120, h: 24 },
      { id: 'qa-run', label: 'Run Checks', x: overlayX + 150, y: overlayY + 50, w: 120, h: 24 },
      { id: 'qa-close', label: 'Close', x: overlayX + overlayW - 86, y: overlayY + 50, w: 70, h: 24 }
    ];
    this.qaBounds = [];
    buttons.forEach((button) => {
      this.drawSmallButton(ctx, button, button.label, false);
      this.qaBounds.push(button);
    });

    ctx.font = '12px Courier New';
    let listY = overlayY + 92;
    if (this.qaResults.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Run checks to verify playhead, loop, edits, and import/export.', overlayX + 16, listY);
    } else {
      this.qaResults.forEach((result) => {
        const color = result.status === 'pass' ? '#55d68a' : result.status === 'warn' ? '#ffd24a' : '#ff6a6a';
        ctx.fillStyle = color;
        ctx.fillText(`${result.label}: ${result.status.toUpperCase()}`, overlayX + 16, listY);
        listY += 20;
      });
    }
  }

  drawSmallButton(ctx, bounds, label, active) {
    ctx.fillStyle = active ? 'rgba(255,225,106,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#0b0b0b' : '#fff';
    ctx.font = `${this.isMobileLayout() ? 14 : 12}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 4);
    ctx.textAlign = 'left';
  }

  drawToggle(ctx, bounds, label, active) {
    ctx.fillStyle = active ? 'rgba(255,225,106,0.2)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = `${this.isMobileLayout() ? 14 : 12}px Courier New`;
    ctx.fillText(label, bounds.x + 6, bounds.y + 16);
  }
}
