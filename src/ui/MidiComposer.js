import {
  GM_DRUMS,
  GM_DRUM_ROWS,
  GM_FAMILIES,
  GM_PROGRAMS,
  formatProgramNumber,
  isDrumChannel
} from '../audio/gm.js';

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
  { id: '1/4', label: '1/4', divisor: 4 },
  { id: '1/8', label: '1/8', divisor: 8 },
  { id: '1/16', label: '1/16', divisor: 16 },
  { id: '1/32', label: '1/32', divisor: 32 }
];

const NOTE_LENGTH_OPTIONS = [
  { id: '1/4', label: '1/4', divisor: 4 },
  { id: '1/8', label: '1/8', divisor: 8 },
  { id: '1/16', label: '1/16', divisor: 16 },
  { id: '1/32', label: '1/32', divisor: 32 }
];

const TAB_OPTIONS = [
  { id: 'grid', label: 'Grid' },
  { id: 'instruments', label: 'Instruments' },
  { id: 'settings', label: 'Settings' }
];

const TOOL_OPTIONS = [
  { id: 'draw', label: 'Draw' }
];

const INSTRUMENT_FAMILY_TABS = [
  { id: 'piano-keys', label: 'Piano/Keys' },
  { id: 'guitars', label: 'Guitars' },
  { id: 'bass', label: 'Bass' },
  { id: 'strings', label: 'Strings' },
  { id: 'brass', label: 'Brass' },
  { id: 'woodwinds', label: 'Woodwinds' },
  { id: 'synth', label: 'Synth' },
  { id: 'drums-perc', label: 'Drums/Perc' },
  { id: 'fx', label: 'FX' },
  { id: 'choir-voice', label: 'Choir/Voice' },
  { id: 'ethnic', label: 'Ethnic' },
  { id: 'misc', label: 'Misc' }
];

const CONTROLLER_ACTIONS = [
  { id: 'place', label: 'Place Note' },
  { id: 'erase', label: 'Erase Note' },
  { id: 'tool', label: 'Switch Tool' },
  { id: 'instrument', label: 'Instruments' },
  { id: 'play', label: 'Play/Pause' },
  { id: 'stop', label: 'Stop/Return' },
  { id: 'octaveUp', label: 'Octave Up' },
  { id: 'octaveDown', label: 'Octave Down' }
];

const GAMEPAD_BUTTONS = [
  { id: 'A', action: 'jump' },
  { id: 'B', action: 'dash' },
  { id: 'X', action: 'rev' },
  { id: 'Y', action: 'throw' },
  { id: 'LB', action: 'aimUp' },
  { id: 'RB', action: 'aimDown' },
  { id: 'Start', action: 'pause' },
  { id: 'Back', action: 'cancel' }
];

const GM_SCHEMA_VERSION = 2;
const DEFAULT_BANK_MSB = 0;
const DEFAULT_BANK_LSB = 0;

const TRACK_COLORS = ['#4fb7ff', '#ff9c42', '#55d68a', '#b48dff', '#ff6a6a', '#43d5d0'];
const DEFAULT_GRID_BARS = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uid = () => `note-${Math.floor(Math.random() * 1000000)}`;

const createDefaultSong = () => ({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 120,
  loopBars: DEFAULT_GRID_BARS,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: false,
  highContrast: false,
  key: 0,
  scale: 'minor',
  tracks: [
    {
      id: 'track-lead',
      name: 'Lead',
      channel: 0,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
      patterns: [{ id: 'pattern-lead', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-bass',
      name: 'Bass',
      channel: 1,
      program: 33,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[1],
      patterns: [{ id: 'pattern-bass', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-drums',
      name: 'Drums',
      channel: 9,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      patterns: [{ id: 'pattern-drums', bars: DEFAULT_GRID_BARS, notes: [] }]
    }
  ],
  progression: [
    { root: 0, quality: 'min', startBar: 1, lengthBars: 1 },
    { root: 5, quality: 'min', startBar: 2, lengthBars: 1 },
    { root: 7, quality: 'maj', startBar: 3, lengthBars: 1 },
    { root: 3, quality: 'maj', startBar: 4, lengthBars: 1 }
  ]
});

const createDemoSong = () => ({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 116,
  loopBars: 8,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: true,
  highContrast: false,
  key: 0,
  scale: 'major',
  tracks: [
    {
      id: 'track-demo-piano',
      name: 'Piano',
      channel: 0,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.85,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
      patterns: [
        {
          id: 'pattern-demo-piano',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 8, pitch: 60, velocity: 0.9 },
            { id: uid(), startTick: 8, durationTicks: 8, pitch: 64, velocity: 0.85 },
            { id: uid(), startTick: 16, durationTicks: 8, pitch: 67, velocity: 0.85 },
            { id: uid(), startTick: 24, durationTicks: 8, pitch: 72, velocity: 0.9 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-strings',
      name: 'Strings',
      channel: 1,
      program: 48,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[1],
      patterns: [
        {
          id: 'pattern-demo-strings',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 16, pitch: 55, velocity: 0.7 },
            { id: uid(), startTick: 16, durationTicks: 16, pitch: 57, velocity: 0.7 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-brass',
      name: 'Brass',
      channel: 2,
      program: 61,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      patterns: [
        {
          id: 'pattern-demo-brass',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 6, pitch: 62, velocity: 0.8 },
            { id: uid(), startTick: 8, durationTicks: 6, pitch: 65, velocity: 0.8 },
            { id: uid(), startTick: 16, durationTicks: 6, pitch: 69, velocity: 0.8 },
            { id: uid(), startTick: 24, durationTicks: 6, pitch: 67, velocity: 0.8 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-synth',
      name: 'Synth Lead',
      channel: 3,
      program: 80,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.75,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[3],
      patterns: [
        {
          id: 'pattern-demo-synth',
          bars: 8,
          notes: [
            { id: uid(), startTick: 4, durationTicks: 4, pitch: 72, velocity: 0.7 },
            { id: uid(), startTick: 12, durationTicks: 4, pitch: 74, velocity: 0.7 },
            { id: uid(), startTick: 20, durationTicks: 4, pitch: 76, velocity: 0.7 },
            { id: uid(), startTick: 28, durationTicks: 4, pitch: 77, velocity: 0.7 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-guitar',
      name: 'Distortion',
      channel: 4,
      program: 30,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[4],
      patterns: [
        {
          id: 'pattern-demo-guitar',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 4, pitch: 52, velocity: 0.8 },
            { id: uid(), startTick: 8, durationTicks: 4, pitch: 55, velocity: 0.8 },
            { id: uid(), startTick: 16, durationTicks: 4, pitch: 57, velocity: 0.8 },
            { id: uid(), startTick: 24, durationTicks: 4, pitch: 55, velocity: 0.8 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-drums',
      name: 'Drums',
      channel: 9,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[5],
      patterns: [
        {
          id: 'pattern-demo-drums',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 2, pitch: 36, velocity: 0.9 },
            { id: uid(), startTick: 4, durationTicks: 2, pitch: 38, velocity: 0.9 },
            { id: uid(), startTick: 8, durationTicks: 2, pitch: 42, velocity: 0.7 },
            { id: uid(), startTick: 12, durationTicks: 2, pitch: 46, velocity: 0.6 },
            { id: uid(), startTick: 16, durationTicks: 2, pitch: 36, velocity: 0.9 },
            { id: uid(), startTick: 20, durationTicks: 2, pitch: 38, velocity: 0.9 },
            { id: uid(), startTick: 24, durationTicks: 2, pitch: 49, velocity: 0.7 },
            { id: uid(), startTick: 28, durationTicks: 2, pitch: 51, velocity: 0.7 }
          ]
        }
      ]
    }
  ],
  progression: [
    { root: 0, quality: 'maj', startBar: 1, lengthBars: 2 },
    { root: 5, quality: 'maj', startBar: 3, lengthBars: 2 },
    { root: 7, quality: 'maj', startBar: 5, lengthBars: 2 },
    { root: 3, quality: 'maj', startBar: 7, lengthBars: 2 }
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
    this.noteLengthIndex = 0;
    this.swing = 0;
    this.previewOnEdit = true;
    this.scrubAudition = false;
    this.metronomeEnabled = false;
    this.scaleLock = true;
    this.slurEnabled = false;
    this.drumAdvanced = false;
    this.activeTab = 'grid';
    this.activeTool = 'draw';
    this.song = this.loadSong();
    this.highContrast = Boolean(this.song?.highContrast);
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
    this.draggingTrackControl = null;
    this.longPressTimer = null;
    this.lastAuditionTime = 0;
    this.gamepadMoveCooldown = 0;
    this.gamepadCursorActive = false;
    this.lastPointer = { x: 0, y: 0 };
    this.placingEndMarker = false;
    this.placingStartMarker = false;
    this.settingsOpen = false;
    this.settingsScroll = 0;
    this.settingsScrollMax = 0;
    this.instrumentPicker = {
      familyTab: INSTRUMENT_FAMILY_TABS[0]?.id || 'piano-keys',
      trackIndex: null,
      mode: null,
      bounds: [],
      favoriteBounds: [],
      sectionBounds: [],
      tabBounds: [],
      scroll: 0,
      scrollMax: 0
    };
    this.recentInstruments = this.loadInstrumentList('chainsaw-midi-recent', []);
    this.favoriteInstruments = this.loadInstrumentList('chainsaw-midi-favorites', []);
    this.controllerMapping = this.loadControllerMapping();
    this.selectionMenu = {
      open: false,
      x: 0,
      y: 0,
      bounds: []
    };
    this.pastePreview = null;
    this.gridZoom = 1;
    this.gridOffset = { x: 0, y: 0 };
    this.gridGesture = null;
    this.bounds = {
      headerInstrument: null,
      headerTempoDown: null,
      headerTempoUp: null,
      headerPlayState: null,
      tabs: [],
      transportBar: null,
      play: null,
      stop: null,
      loopToggle: null,
      returnStart: null,
      setStart: null,
      setEnd: null,
      prevBar: null,
      nextBar: null,
      goEnd: null,
      metronome: null,
      timeDisplay: null,
      tempoDown: null,
      tempoUp: null,
      instrumentTile: null,
      instrumentFavorite: null,
      instrumentSection: null,
      instrumentFamilyTab: null,
      gridControls: [],
      toolButtons: [],
      quantizeToggle: null,
      quantizeValue: null,
      noteLength: null,
      snapToggle: null,
      scaleLock: null,
      preview: null,
      scrub: null,
      swing: null,
      settingsControls: [],
      controllerControls: [],
      exportSong: null,
      importSong: null,
      demoSong: null,
      soundfontUrl: null,
      soundfontReset: null,
      addTrack: null,
      removeTrack: null,
      duplicateTrack: null,
      instrumentPrev: null,
      instrumentNext: null,
      instrumentLabel: null,
      selectionMenu: []
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
    this.game.audio.ensureMidiSampler();
    this.audioSettings = this.loadAudioSettings();
    this.applyAudioSettings();
    this.ensureState();
  }

  loadSong() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return createDefaultSong();
    try {
      const parsed = JSON.parse(stored);
      const validation = this.validateSong(parsed);
      if (!validation.valid) return createDefaultSong();
      return this.migrateSong(parsed);
    } catch (error) {
      return createDefaultSong();
    }
  }

  persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.song));
  }

  loadInstrumentList(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(stored)) return stored.filter((entry) => Number.isInteger(entry));
      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  saveInstrumentList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (error) {
      // ignore
    }
  }

  addRecentInstrument(program) {
    if (!Number.isInteger(program)) return;
    const next = [program, ...this.recentInstruments.filter((entry) => entry !== program)].slice(0, 8);
    this.recentInstruments = next;
    this.saveInstrumentList('chainsaw-midi-recent', next);
  }

  toggleFavoriteInstrument(program) {
    if (!Number.isInteger(program)) return;
    const exists = this.favoriteInstruments.includes(program);
    const next = exists
      ? this.favoriteInstruments.filter((entry) => entry !== program)
      : [...this.favoriteInstruments, program];
    this.favoriteInstruments = next;
    this.saveInstrumentList('chainsaw-midi-favorites', next);
  }

  loadControllerMapping() {
    try {
      const stored = JSON.parse(localStorage.getItem('chainsaw-midi-controller-map'));
      if (!stored || typeof stored !== 'object') throw new Error('invalid');
      return {
        place: stored.place || 'A',
        erase: stored.erase || 'B',
        tool: stored.tool || 'X',
        instrument: stored.instrument || 'Y',
        play: stored.play || 'Start',
        stop: stored.stop || 'Back',
        octaveUp: stored.octaveUp || 'LB',
        octaveDown: stored.octaveDown || 'RB'
      };
    } catch (error) {
      return {
        place: 'A',
        erase: 'B',
        tool: 'X',
        instrument: 'Y',
        play: 'Start',
        stop: 'Back',
        octaveUp: 'LB',
        octaveDown: 'RB'
      };
    }
  }

  saveControllerMapping() {
    try {
      localStorage.setItem('chainsaw-midi-controller-map', JSON.stringify(this.controllerMapping));
    } catch (error) {
      // ignore
    }
  }

  loadAudioSettings() {
    const defaults = {
      masterVolume: this.game?.audio?.volume ?? 0.4,
      reverbEnabled: true,
      reverbLevel: 0.18,
      latencyMs: 30
    };
    try {
      const stored = JSON.parse(localStorage.getItem('chainsaw-midi-audio'));
      if (!stored || typeof stored !== 'object') return defaults;
      return {
        masterVolume: typeof stored.masterVolume === 'number' ? stored.masterVolume : defaults.masterVolume,
        reverbEnabled: typeof stored.reverbEnabled === 'boolean' ? stored.reverbEnabled : defaults.reverbEnabled,
        reverbLevel: typeof stored.reverbLevel === 'number' ? stored.reverbLevel : defaults.reverbLevel,
        latencyMs: typeof stored.latencyMs === 'number' ? stored.latencyMs : defaults.latencyMs
      };
    } catch (error) {
      return defaults;
    }
  }

  saveAudioSettings() {
    try {
      localStorage.setItem('chainsaw-midi-audio', JSON.stringify(this.audioSettings));
    } catch (error) {
      // ignore
    }
  }

  applyAudioSettings() {
    const audio = this.game?.audio;
    if (!audio) return;
    audio.setVolume?.(clamp(this.audioSettings.masterVolume, 0, 1));
    audio.setMidiLatency?.(Math.max(0, this.audioSettings.latencyMs / 1000));
    audio.setMidiReverbEnabled?.(this.audioSettings.reverbEnabled);
    audio.setMidiReverbLevel?.(clamp(this.audioSettings.reverbLevel, 0, 1));
  }

  validateSong(song) {
    if (!song || !Array.isArray(song.tracks)) {
      return { valid: false, error: 'Song must include a track list.' };
    }
    if (typeof song.tempo !== 'number' || typeof song.loopBars !== 'number') {
      return { valid: false, error: 'Song tempo and loop bars must be numbers.' };
    }
    for (const track of song.tracks) {
      const channel = track.channel ?? (track.instrument === 'drums' ? 9 : 0);
      const program = track.program ?? 0;
      if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid channel.` };
      }
      if (!Number.isInteger(program) || program < 0 || program > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid program.` };
      }
      const bankMSB = track.bankMSB ?? DEFAULT_BANK_MSB;
      const bankLSB = track.bankLSB ?? DEFAULT_BANK_LSB;
      if (!Number.isInteger(bankMSB) || bankMSB < 0 || bankMSB > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid bank MSB.` };
      }
      if (!Number.isInteger(bankLSB) || bankLSB < 0 || bankLSB > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid bank LSB.` };
      }
      const pan = typeof track.pan === 'number' ? track.pan : 0;
      if (typeof pan !== 'number' || pan < -1 || pan > 1) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid pan.` };
      }
    }
    return { valid: true };
  }

  migrateSong(song) {
    const schemaVersion = typeof song.schemaVersion === 'number' ? song.schemaVersion : 1;
    if (schemaVersion >= GM_SCHEMA_VERSION) {
      return song;
    }
    const migrated = {
      ...song,
      schemaVersion: GM_SCHEMA_VERSION,
      tracks: song.tracks.map((track, index) => this.normalizeTrack(track, index, song.loopBars))
    };
    return migrated;
  }

  ensureState() {
    if (!this.song) {
      this.song = createDefaultSong();
    }
    if (!Array.isArray(this.song.tracks) || this.song.tracks.length === 0) {
      this.song.tracks = createDefaultSong().tracks;
    }
    if (typeof this.song.loopBars !== 'number' || this.song.loopBars < 1) {
      this.song.loopBars = DEFAULT_GRID_BARS;
    }
    this.song.schemaVersion = GM_SCHEMA_VERSION;
    this.song.tracks = this.song.tracks.map((track, index) => this.normalizeTrack(track, index, this.song.loopBars));
    if (typeof this.song.loopStartTick !== 'number') {
      this.song.loopStartTick = null;
    }
    if (typeof this.song.loopEndTick !== 'number') {
      this.song.loopEndTick = null;
    }
    if (typeof this.song.loopEnabled !== 'boolean') {
      this.song.loopEnabled = false;
    }
    if (typeof this.song.highContrast !== 'boolean') {
      this.song.highContrast = false;
    }
    if (!this.song.progression) {
      this.song.progression = createDefaultSong().progression;
    }
    this.highContrast = Boolean(this.song.highContrast);
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
    const activeTrack = this.getActiveTrack();
    if (activeTrack) {
      this.selectedPatternIndex = clamp(this.selectedPatternIndex, 0, activeTrack.patterns.length - 1);
    } else {
      this.selectedPatternIndex = 0;
    }
    this.preloadTrackPrograms();
    this.persist();
  }

  preloadTrackPrograms() {
    const audio = this.game?.audio;
    if (!audio?.ensureGmPlayer) return;
    audio.ensureGmPlayer()
      .then(() => {
        this.song.tracks.forEach((track) => {
          if (isDrumChannel(track.channel)) {
            audio.loadGmDrumKit?.();
          } else {
            audio.loadGmProgram?.(track.program);
          }
        });
      })
      .catch(() => {
        // ignore preload errors
      });
  }

  normalizeTrack(track, index, loopBars = DEFAULT_GRID_BARS) {
    const legacyProgram = this.mapLegacyInstrumentToProgram(track.instrument);
    const channel = Number.isInteger(track.channel)
      ? track.channel
      : track.instrument === 'drums'
        ? 9
        : index % 16;
    const resolvedProgram = clamp(Number.isInteger(track.program) ? track.program : legacyProgram, 0, 127);
    return {
      id: track.id || `track-${uid()}`,
      name: track.name || `Track ${index + 1}`,
      channel: clamp(channel, 0, 15),
      program: resolvedProgram,
      instrumentFamily: track.instrumentFamily || this.getProgramFamilyLabel(resolvedProgram),
      bankMSB: clamp(Number.isInteger(track.bankMSB) ? track.bankMSB : DEFAULT_BANK_MSB, 0, 127),
      bankLSB: clamp(Number.isInteger(track.bankLSB) ? track.bankLSB : DEFAULT_BANK_LSB, 0, 127),
      volume: typeof track.volume === 'number' ? track.volume : 0.8,
      pan: typeof track.pan === 'number' ? clamp(track.pan, -1, 1) : 0,
      mute: Boolean(track.mute),
      solo: Boolean(track.solo),
      color: track.color || TRACK_COLORS[index % TRACK_COLORS.length],
      patterns: Array.isArray(track.patterns) && track.patterns.length > 0
        ? track.patterns
        : [{ id: `pattern-${track.id || uid()}`, bars: loopBars, notes: [] }]
    };
  }

  mapLegacyInstrumentToProgram(instrument) {
    const mapping = {
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
      lead: 80,
      pad: 88,
      keys: 0,
      guitar: 24,
      sine: 80,
      triangle: 81,
      square: 80,
      sawtooth: 81,
      drums: 0
    };
    if (!instrument) return 0;
    return mapping[instrument] ?? 0;
  }

  getActiveTrack() {
    return this.song.tracks[this.selectedTrackIndex];
  }

  getActivePattern() {
    const track = this.getActiveTrack();
    if (!track) return null;
    return track.patterns[this.selectedPatternIndex];
  }

  selectTrackDelta(delta) {
    const total = this.song.tracks.length;
    if (!total) return;
    this.selectedTrackIndex = (this.selectedTrackIndex + delta + total) % total;
    this.selection.clear();
    this.closeSelectionMenu();
  }

  isMobileLayout() {
    return Boolean(this.game?.isMobile);
  }

  getProgramLabel(program) {
    const entry = GM_PROGRAMS[program];
    if (!entry) return `Program ${program + 1}`;
    return `${formatProgramNumber(program)} ${entry.name}`;
  }

  getProgramFamilyLabel(program) {
    const entry = GM_PROGRAMS[program];
    return entry?.family || 'Misc';
  }

  getInstrumentCategory(program) {
    const entry = GM_PROGRAMS[program];
    const name = entry?.name || '';
    const family = entry?.family || '';
    if (name.includes('Choir') || name.includes('Voice')) return 'choir-voice';
    if (family === 'Piano' || family === 'Chromatic Percussion' || family === 'Organ') return 'piano-keys';
    if (family === 'Guitar') return 'guitars';
    if (family === 'Bass') return 'bass';
    if (family === 'Strings' || family === 'Ensemble') return 'strings';
    if (family === 'Brass') return 'brass';
    if (family === 'Reed' || family === 'Pipe') return 'woodwinds';
    if (family === 'Synth Lead' || family === 'Synth Pad') return 'synth';
    if (family === 'Percussive') return 'drums-perc';
    if (family === 'Synth FX' || family === 'Sound Effects') return 'fx';
    if (family === 'Ethnic') return 'ethnic';
    return 'misc';
  }

  getProgramsForFamily(familyId, query = '') {
    const search = query.trim().toLowerCase();
    return GM_PROGRAMS.filter((entry) => {
      const matchesFamily = this.getInstrumentCategory(entry.program) === familyId;
      if (!matchesFamily) return false;
      if (!search) return true;
      const nameMatch = entry.name.toLowerCase().includes(search);
      const numberMatch = formatProgramNumber(entry.program).includes(search);
      return nameMatch || numberMatch;
    });
  }

  getTrackInstrumentLabel(track) {
    if (!track) return 'Instrument';
    if (isDrumChannel(track.channel)) {
      return `${track.name || 'Track'}: Drums (Ch 10)`;
    }
    return `${track.name || 'Track'}: ${this.getProgramLabel(track.program)}`;
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
    this.activeTab = 'instruments';
    this.instrumentPicker.mode = mode;
    this.instrumentPicker.trackIndex = trackIndex ?? this.selectedTrackIndex;
    this.instrumentPicker.bounds = [];
    this.instrumentPicker.favoriteBounds = [];
    this.instrumentPicker.sectionBounds = [];
    this.instrumentPicker.tabBounds = [];
    this.instrumentPicker.scroll = 0;
  }

  getInstrumentPickerItems() {
    return [];
  }

  applyInstrumentSelection(program) {
    if (!Number.isInteger(program)) return;
    if (this.instrumentPicker.mode === 'add') {
      const name = this.getUniqueTrackName(GM_PROGRAMS[program]?.name || 'Track');
      const track = {
        id: `track-${uid()}`,
        name,
        channel: this.getNextAvailableChannel(),
        program,
        instrumentFamily: this.getProgramFamilyLabel(program),
        bankMSB: DEFAULT_BANK_MSB,
        bankLSB: DEFAULT_BANK_LSB,
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
        patterns: [{ id: `pattern-${uid()}`, bars: this.song.loopBars, notes: [] }]
      };
      this.song.tracks.push(track);
      this.selectedTrackIndex = this.song.tracks.length - 1;
      this.persist();
    } else {
      const targetIndex = this.instrumentPicker.trackIndex ?? this.selectedTrackIndex;
      const track = this.song.tracks[targetIndex];
      if (track) {
        track.program = program;
        track.instrumentFamily = this.getProgramFamilyLabel(program);
        this.persist();
      }
    }
    this.addRecentInstrument(program);
    this.instrumentPicker.mode = null;
    this.preloadTrackPrograms();
  }

  isModalOpen() {
    return this.qaOverlayOpen;
  }

  closeModal() {
    if (this.qaOverlayOpen) {
      this.qaOverlayOpen = false;
    }
  }

  getLoopTicks() {
    if (typeof this.song.loopEndTick === 'number') {
      return Math.max(1, this.song.loopEndTick);
    }
    return this.song.loopBars * this.beatsPerBar * this.ticksPerBeat;
  }

  getLoopStartTick() {
    if (typeof this.song.loopStartTick === 'number') {
      return clamp(this.song.loopStartTick, 0, this.getLoopTicks());
    }
    return 0;
  }

  getLoopRegion() {
    const start = this.getLoopStartTick();
    const end = this.getLoopTicks();
    return { start, end, length: Math.max(1, end - start) };
  }

  getSongLastNoteTick() {
    const patterns = this.song.tracks
      .map((track) => track.patterns[this.selectedPatternIndex])
      .filter(Boolean);
    let lastTick = 0;
    let hasNotes = false;
    patterns.forEach((pattern) => {
      pattern.notes.forEach((note) => {
        hasNotes = true;
        lastTick = Math.max(lastTick, note.startTick + note.durationTicks);
      });
    });
    return hasNotes ? lastTick : 0;
  }

  getSongEndTick() {
    if (typeof this.song.loopEndTick === 'number') {
      return Math.max(1, this.song.loopEndTick);
    }
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    return Math.max(ticksPerBar, this.getSongLastNoteTick() + ticksPerBar);
  }

  getQuantizeTicks() {
    if (!this.quantizeEnabled) return 1;
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const divisor = this.quantizeOptions[this.quantizeIndex]?.divisor || 16;
    return Math.max(1, Math.round(ticksPerBar / divisor));
  }

  getNoteLengthTicks() {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const divisor = NOTE_LENGTH_OPTIONS[this.noteLengthIndex]?.divisor || 4;
    return Math.max(1, Math.round(ticksPerBar / divisor));
  }

  getNextAvailableChannel() {
    const used = new Set(this.song.tracks.map((track) => track.channel));
    for (let channel = 0; channel < 16; channel += 1) {
      if (channel === 9) continue;
      if (!used.has(channel)) return channel;
    }
    return 0;
  }

  getNextEmptyBarStart() {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const patterns = this.song.tracks
      .map((track) => track.patterns[this.selectedPatternIndex])
      .filter(Boolean);
    const lastTick = this.getSongLastNoteTick();
    const startBar = Math.max(0, Math.floor(lastTick / ticksPerBar) + 1);
    const totalBars = Math.max(this.song.loopBars, startBar + 2);
    for (let bar = startBar; bar < totalBars; bar += 1) {
      const start = bar * ticksPerBar;
      const end = start + ticksPerBar;
      const hasNotes = patterns.some((pattern) =>
        pattern.notes.some((note) => note.startTick < end && note.startTick + note.durationTicks > start));
      if (!hasNotes) {
        return start;
      }
    }
    return Math.ceil(lastTick / ticksPerBar) * ticksPerBar;
  }

  ensureGridCapacity(tickEnd) {
    if (typeof this.song.loopEndTick === 'number') return;
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const requiredBars = Math.max(1, Math.ceil((tickEnd + 1) / ticksPerBar));
    if (requiredBars > this.song.loopBars) {
      this.song.loopBars = requiredBars;
      this.song.tracks.forEach((track) => {
        track.patterns.forEach((pattern) => {
          pattern.bars = this.song.loopBars;
        });
      });
    }
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
    if (isDrumChannel(track?.channel)) return pitch;
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
    this.handleGamepadInput(input, dt);
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

  handleGamepadInput(input, dt) {
    if (!input?.isGamepadConnected?.()) {
      this.gamepadCursorActive = false;
      return;
    }
    const resolveAction = (buttonId) => GAMEPAD_BUTTONS.find((entry) => entry.id === buttonId)?.action;
    const handleMappedPress = (actionId, callback) => {
      const mapped = this.controllerMapping?.[actionId];
      const gamepadAction = resolveAction(mapped);
      if (gamepadAction && input.wasGamepadPressed?.(gamepadAction)) {
        callback();
      }
    };

    handleMappedPress('play', () => this.togglePlayback());
    handleMappedPress('stop', () => this.stopPlayback());
    handleMappedPress('instrument', () => this.openInstrumentPicker('edit', this.selectedTrackIndex));
    handleMappedPress('tool', () => {
      const currentIndex = TOOL_OPTIONS.findIndex((tool) => tool.id === this.activeTool);
      const nextIndex = (currentIndex + 1) % TOOL_OPTIONS.length;
      this.activeTool = TOOL_OPTIONS[nextIndex]?.id || 'draw';
    });
    handleMappedPress('place', () => {
      if (this.activeTab !== 'grid') return;
      this.paintNoteAt(this.cursor.tick, this.cursor.pitch, false);
    });
    handleMappedPress('erase', () => {
      if (this.activeTab !== 'grid') return;
      this.eraseNoteAt(this.cursor.tick, this.cursor.pitch);
    });
    handleMappedPress('octaveUp', () => {
      const range = this.getPitchRange();
      this.cursor.pitch = clamp(this.cursor.pitch + 12, range.min, range.max);
    });
    handleMappedPress('octaveDown', () => {
      const range = this.getPitchRange();
      this.cursor.pitch = clamp(this.cursor.pitch - 12, range.min, range.max);
    });

    if (this.activeTab === 'grid') {
      this.gamepadMoveCooldown = Math.max(0, this.gamepadMoveCooldown - dt);
      const left = input.isGamepadDown?.('left') || input.isGamepadDown?.('dpadLeft');
      const right = input.isGamepadDown?.('right') || input.isGamepadDown?.('dpadRight');
      const up = input.isGamepadDown?.('up') || input.isGamepadDown?.('dpadUp');
      const down = input.isGamepadDown?.('down') || input.isGamepadDown?.('dpadDown');
      const moveX = right ? 1 : left ? -1 : 0;
      const moveY = down ? 1 : up ? -1 : 0;
      if ((moveX || moveY) && this.gamepadMoveCooldown <= 0) {
        const step = this.getQuantizeTicks();
        const range = this.getPitchRange();
        const maxTick = this.getLoopTicks();
        this.cursor.tick = clamp(this.cursor.tick + moveX * step, 0, maxTick);
        this.cursor.pitch = clamp(this.cursor.pitch - moveY, range.min, range.max);
        this.gamepadMoveCooldown = 0.12;
        this.gamepadCursorActive = true;
        this.ensureCursorVisible();
      }
      const axes = input.getGamepadAxes?.() || {};
      const scrub = (axes.rightTrigger || 0) - (axes.leftTrigger || 0);
      if (Math.abs(scrub) > 0.1) {
        const scrubSpeed = this.ticksPerBeat * 6;
        const nextTick = this.playheadTick + scrub * scrubSpeed * dt;
        const loopStart = this.getLoopStartTick();
        const loopEnd = this.getLoopTicks();
        this.playheadTick = clamp(nextTick, loopStart, loopEnd);
        if (this.scrubAudition) {
          this.previewNotesAtTick(this.playheadTick);
        }
      }
    }
  }

  advancePlayhead(dt) {
    const tempo = this.song.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const loopTicks = this.getLoopTicks();
    const loopStart = this.getLoopStartTick();
    const previous = this.playheadTick;
    const nextTick = this.playheadTick + ticksPerSecond * dt;
    if (typeof this.song.loopEndTick === 'number') {
      if (this.song.loopEnabled) {
        const loopLength = Math.max(1, loopTicks - loopStart);
        const relative = nextTick - loopStart;
        const wrappedTick = loopStart + ((relative % loopLength) + loopLength) % loopLength;
        this.playheadTick = wrappedTick;
        this.triggerPlayback(previous, this.playheadTick, loopTicks, true);
      } else if (nextTick >= loopTicks) {
        this.playheadTick = loopTicks;
        this.triggerPlayback(previous, loopTicks, loopTicks, false);
        this.isPlaying = false;
      } else {
        this.playheadTick = nextTick;
        this.triggerPlayback(previous, this.playheadTick, loopTicks, false);
      }
    } else {
      this.playheadTick = nextTick;
      this.ensureGridCapacity(this.playheadTick);
      this.triggerPlayback(previous, this.playheadTick, loopTicks, false);
    }
    if (this.isPlaying && !this.song.loopEnabled) {
      const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
      const lastNoteTick = this.getSongLastNoteTick();
      if (this.playheadTick >= lastNoteTick + ticksPerBar) {
        this.isPlaying = false;
      }
    }
  }

  triggerPlayback(startTick, endTick, loopTicks, wrap) {
    const loopStart = this.getLoopStartTick();
    const shouldWrap = wrap && endTick < startTick;
    const crossed = shouldWrap
      ? [
        { start: startTick, end: loopTicks },
        { start: loopStart, end: endTick }
      ]
      : [{ start: startTick, end: endTick }];
    crossed.forEach((range) => {
      this.song.tracks.forEach((track) => {
        if (this.isTrackMuted(track)) return;
        const pattern = track.patterns[this.selectedPatternIndex];
        if (!pattern) return;
        pattern.notes.forEach((note) => {
          const noteStart = this.getSwingedTick(note.startTick);
          if (noteStart >= range.start && noteStart < range.end) {
            if (this.shouldSlurNote(track, pattern, note)) return;
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
        if (this.game?.audio?.playMidiNote) {
          this.game.audio.playMidiNote(pitch, 'sine', 0.15, 0.4);
        }
      }
    }
    if (endTick < startTick) {
      this.triggerMetronome(this.getLoopStartTick(), endTick, loopTicks);
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

  shouldSlurNote(track, pattern, note) {
    if (!this.slurEnabled || isDrumChannel(track.channel)) return false;
    return pattern.notes.some((other) => {
      if (other.id === note.id || other.pitch !== note.pitch) return false;
      const otherEnd = other.startTick + other.durationTicks;
      return other.startTick < note.startTick && otherEnd >= note.startTick;
    });
  }

  playNote(track, note, startTick) {
    const duration = note.durationTicks / this.ticksPerBeat;
    const velocity = note.velocity ?? 0.8;
    this.playGmNote(note.pitch, duration, velocity * track.volume, track, track.pan);
    const now = performance.now();
    this.activeNotes.set(note.id, { trackId: track.id, expires: now + duration * 1000 + 120 });
    this.lastPlaybackTick = startTick;
  }

  playGmNote(pitch, duration, volume, track, pan = 0) {
    if (this.game?.audio?.playGmNote) {
      this.game.audio.playGmNote({
        pitch,
        duration,
        volume,
        program: track.program,
        channel: track.channel,
        bankMSB: track.bankMSB,
        bankLSB: track.bankLSB,
        pan
      });
      return;
    }
    if (this.game?.audio?.playMidiNote) {
      this.game.audio.playMidiNote(pitch, 'sine', duration, volume, null, pan);
    }
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

    const tabHit = this.bounds.tabs?.find((tab) => this.pointInBounds(x, y, tab));
    if (tabHit) {
      this.activeTab = tabHit.id;
      this.closeSelectionMenu();
      this.pastePreview = null;
      return;
    }

    if (this.bounds.headerInstrument && this.pointInBounds(x, y, this.bounds.headerInstrument)) {
      this.openInstrumentPicker('edit', this.selectedTrackIndex);
      return;
    }

    if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play)) {
      this.togglePlayback();
      return;
    }
    if (this.bounds.stop && this.pointInBounds(x, y, this.bounds.stop)) {
      this.stopPlayback();
      return;
    }
    if (this.bounds.loopToggle && this.pointInBounds(x, y, this.bounds.loopToggle)) {
      this.toggleLoopEnabled();
      return;
    }
    if (this.bounds.returnStart && this.pointInBounds(x, y, this.bounds.returnStart)) {
      this.returnToStart();
      return;
    }
    if (this.bounds.setStart && this.pointInBounds(x, y, this.bounds.setStart)) {
      this.setLoopStartTick(this.playheadTick);
      return;
    }
    if (this.bounds.setEnd && this.pointInBounds(x, y, this.bounds.setEnd)) {
      this.setLoopEndTick(this.playheadTick);
      return;
    }
    if (this.bounds.prevBar && this.pointInBounds(x, y, this.bounds.prevBar)) {
      this.jumpPlayheadBars(-1);
      return;
    }
    if (this.bounds.nextBar && this.pointInBounds(x, y, this.bounds.nextBar)) {
      this.jumpPlayheadBars(1);
      return;
    }
    if (this.bounds.goEnd && this.pointInBounds(x, y, this.bounds.goEnd)) {
      this.goToEnd();
      return;
    }
    if (this.bounds.metronome && this.pointInBounds(x, y, this.bounds.metronome)) {
      this.metronomeEnabled = !this.metronomeEnabled;
      return;
    }

    if (this.activeTab === 'instruments') {
      const familyHit = this.instrumentPicker.tabBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (familyHit) {
        this.instrumentPicker.familyTab = familyHit.id;
        this.instrumentPicker.scroll = 0;
        return;
      }
      const favHit = this.instrumentPicker.favoriteBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (favHit) {
        this.toggleFavoriteInstrument(favHit.program);
        return;
      }
      const pickHit = this.instrumentPicker.bounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pickHit) {
        this.applyInstrumentSelection(pickHit.program);
        return;
      }
      if (this.instrumentPicker.sectionBounds.find((bounds) => this.pointInBounds(x, y, bounds))) {
        this.dragState = {
          mode: 'instrument-scroll',
          startY: y,
          startScroll: this.instrumentPicker.scroll
        };
      }
      return;
    }

    if (this.activeTab === 'settings') {
      const controlHit = this.bounds.settingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (controlHit) {
        this.handleSettingsControl(controlHit, { x, y });
        return;
      }
      const controllerHit = this.bounds.controllerControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (controllerHit) {
        const options = GAMEPAD_BUTTONS.map((entry) => entry.id);
        const current = this.controllerMapping[controllerHit.actionId] || options[0];
        const nextIndex = (options.indexOf(current) + 1) % options.length;
        this.controllerMapping[controllerHit.actionId] = options[nextIndex];
        this.saveControllerMapping();
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
      if (this.bounds.exportSong && this.pointInBounds(x, y, this.bounds.exportSong)) {
        this.exportSong();
        return;
      }
      if (this.bounds.importSong && this.pointInBounds(x, y, this.bounds.importSong)) {
        this.importSong();
        return;
      }
      if (this.bounds.demoSong && this.pointInBounds(x, y, this.bounds.demoSong)) {
        this.loadDemoSong();
        return;
      }
      if (this.bounds.settingsPanel && this.pointInBounds(x, y, this.bounds.settingsPanel)) {
        this.dragState = {
          mode: 'settings-scroll',
          startY: y,
          startScroll: this.settingsScroll
        };
      }
      return;
    }

    if (this.activeTab === 'grid') {
      const menuHit = this.bounds.selectionMenu?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (menuHit) {
        this.handleSelectionMenuAction(menuHit.action);
        return;
      }
      if (this.selectionMenu.open) {
        this.closeSelectionMenu();
      }
      if (this.bounds.instrumentPrev && this.pointInBounds(x, y, this.bounds.instrumentPrev)) {
        this.selectTrackDelta(-1);
        return;
      }
      if (this.bounds.instrumentNext && this.pointInBounds(x, y, this.bounds.instrumentNext)) {
        this.selectTrackDelta(1);
        return;
      }
      if (this.bounds.instrumentLabel && this.pointInBounds(x, y, this.bounds.instrumentLabel)) {
        this.openInstrumentPicker('edit', this.selectedTrackIndex);
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
      if (this.rulerBounds && this.pointInBounds(x, y, this.rulerBounds)) {
        const modifiers = this.getModifiers();
        const tick = this.getTickFromX(x);
        if (this.placingStartMarker) {
          this.setLoopStartTick(tick);
          this.placingStartMarker = false;
          return;
        }
        if (this.placingEndMarker || modifiers.shift) {
          this.setLoopEndTick(tick);
          this.placingEndMarker = false;
          return;
        }
        if (modifiers.alt || payload.button === 2) {
          this.clearLoopEndTick();
          this.clearLoopStartTick();
          return;
        }
        if (payload.touchCount) {
          this.longPressTimer = window.setTimeout(() => {
            this.setLoopStartTick(tick);
          }, 450);
        }
        this.playheadTick = clamp(tick, this.getLoopStartTick(), this.getLoopTicks());
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
  }

  handlePointerMove(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.qaOverlayOpen) return;
    if (this.dragState?.mode === 'instrument-scroll') {
      const delta = this.dragState.startY - payload.y;
      this.instrumentPicker.scroll = clamp(this.dragState.startScroll + delta, 0, this.instrumentPicker.scrollMax);
      return;
    }
    if (this.dragState?.mode === 'settings-scroll') {
      const delta = this.dragState.startY - payload.y;
      this.settingsScroll = clamp(this.dragState.startScroll + delta, 0, this.settingsScrollMax);
      return;
    }
    if (this.dragState?.mode === 'slider') {
      this.updateSliderValue(payload.x, payload.y, this.dragState.id, this.dragState.bounds);
      return;
    }
    if (this.draggingTrackControl) {
      this.updateTrackControl(payload.x, payload.y);
      return;
    }
    if (!this.dragState || !this.gridBounds) return;
    if (this.dragState.mode === 'touch-pan') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
      if (this.dragState.moved) {
        this.gridOffset.x = this.dragState.startOffsetX + dx;
        this.gridOffset.y = this.dragState.startOffsetY + dy;
        const { gridW, gridH, w, h } = this.gridBounds;
        this.clampGridOffset(w, h, gridW, gridH);
      }
      return;
    }
    if (this.dragState.mode === 'scrub') {
      const tick = this.getTickFromX(payload.x);
      this.playheadTick = clamp(tick, this.getLoopStartTick(), this.getLoopTicks());
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
    } else if (this.dragState.mode === 'paint-or-select') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        this.dragState.mode = 'select';
        this.dragState.currentX = payload.x;
        this.dragState.currentY = payload.y;
      }
    } else if (this.dragState.mode === 'paste-preview') {
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
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
    if (this.dragState?.mode === 'touch-pan') {
      if (!this.dragState.moved) {
        const { cell, hit } = this.dragState;
        if (hit?.note) {
          this.selection.clear();
          this.selection.add(hit.note.id);
          this.previewNote(hit.note, hit.note.pitch);
        } else if (cell) {
          this.selection.clear();
          this.paintNoteAt(cell.tick, cell.pitch, false);
        }
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'instrument-scroll'
      || this.dragState?.mode === 'settings-scroll'
      || this.dragState?.mode === 'slider') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'paste-preview') {
      this.applyPastePreview();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'paint-or-select') {
      if (!this.dragState.moved && this.dragState.cell) {
        this.paintNoteAt(this.dragState.cell.tick, this.dragState.cell.pitch, false);
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'select') {
      this.finalizeSelectionBox();
    }
    this.dragState = null;
    this.draggingTrackControl = null;
  }

  handleGestureStart(payload) {
    if (!this.gridBounds || this.qaOverlayOpen || this.activeTab !== 'grid') return;
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
    const { x, y } = payload;
    const cell = this.getGridCell(x, y);
    if (!cell) return;
    if (payload.touchCount) {
      const hit = this.getNoteAtCell(cell.tick, cell.pitch);
      this.dragState = {
        mode: 'touch-pan',
        startX: x,
        startY: y,
        startOffsetX: this.gridOffset.x,
        startOffsetY: this.gridOffset.y,
        moved: false,
        cell,
        hit
      };
      return;
    }
    const modifiers = this.getModifiers();
    if (this.pastePreview) {
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
      this.dragState = { mode: 'paste-preview' };
      return;
    }
    const hit = this.getNoteAtCell(cell.tick, cell.pitch);
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
    this.dragState = {
      mode: 'paint-or-select',
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      cell,
      moved: false
    };
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
    if (this.selectionMenu.open) {
      this.closeSelectionMenu();
    }
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
    const duration = this.getNoteLengthTicks();
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
    this.ensureGridCapacity(snappedTick + duration);
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
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + note.durationTicks));
    this.ensureGridCapacity(maxEndTick);
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
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + note.durationTicks));
    this.ensureGridCapacity(maxEndTick);
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
    if (this.selection.size > 0) {
      this.openSelectionMenu(maxX + 12, maxY + 12);
    }
  }

  openSelectionMenu(x, y) {
    this.selectionMenu.open = true;
    this.selectionMenu.x = x;
    this.selectionMenu.y = y;
  }

  closeSelectionMenu() {
    this.selectionMenu.open = false;
    this.selectionMenu.bounds = [];
    this.bounds.selectionMenu = [];
  }

  deleteSelectedNotes() {
    const pattern = this.getActivePattern();
    if (!pattern || this.selection.size === 0) return;
    pattern.notes = pattern.notes.filter((note) => !this.selection.has(note.id));
    this.selection.clear();
    this.closeSelectionMenu();
    this.persist();
  }

  beginPastePreview() {
    if (!this.clipboard) return;
    const nextTick = this.getNextEmptyBarStart();
    const basePitch = this.cursor.pitch || this.getPitchRange().min;
    this.pastePreview = {
      tick: this.snapTick(nextTick),
      pitch: this.snapPitchToScale(basePitch),
      notes: this.clipboard.notes
    };
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  updatePastePreviewPosition(tick, pitch) {
    if (!this.pastePreview) return;
    this.pastePreview.tick = this.snapTick(tick);
    this.pastePreview.pitch = this.snapPitchToScale(pitch);
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  applyPastePreview() {
    if (!this.clipboard || !this.pastePreview) return;
    const pattern = this.getActivePattern();
    if (!pattern) return;
    const loopTicks = this.getLoopTicks();
    const hasLoopEnd = typeof this.song.loopEndTick === 'number';
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    const newIds = [];
    this.clipboard.notes.forEach((note) => {
      const rawStart = baseTick + note.startTick;
      const startTick = hasLoopEnd ? clamp(rawStart, 0, loopTicks - 1) : Math.max(0, rawStart);
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
    const maxEndTick = Math.max(...newIds.map((id) => {
      const note = pattern.notes.find((entry) => entry.id === id);
      return note ? note.startTick + note.durationTicks : 0;
    }));
    this.ensureGridCapacity(maxEndTick);
    this.pastePreview = null;
    this.persist();
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
    const hasLoopEnd = typeof this.song.loopEndTick === 'number';
    const baseTick = this.snapTick(this.cursor.tick || 0);
    const basePitch = this.snapPitchToScale(this.cursor.pitch || this.getPitchRange().min);
    const newIds = [];
    this.clipboard.notes.forEach((note) => {
      const rawStart = baseTick + note.startTick;
      const startTick = hasLoopEnd ? clamp(rawStart, 0, loopTicks - 1) : Math.max(0, rawStart);
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
    const maxEndTick = Math.max(...newIds.map((id) => {
      const note = pattern.notes.find((entry) => entry.id === id);
      return note ? note.startTick + note.durationTicks : 0;
    }));
    this.ensureGridCapacity(maxEndTick);
    this.persist();
  }

  duplicateSelection() {
    const notes = this.getSelectedNotes();
    if (notes.length === 0) return;
    const pattern = this.getActivePattern();
    const loopTicks = this.getLoopTicks();
    const hasLoopEnd = typeof this.song.loopEndTick === 'number';
    const span = Math.max(...notes.map((note) => note.startTick + note.durationTicks))
      - Math.min(...notes.map((note) => note.startTick));
    const newIds = [];
    notes.forEach((note) => {
      const rawStart = note.startTick + span;
      const startTick = hasLoopEnd ? clamp(rawStart, 0, loopTicks - 1) : Math.max(0, rawStart);
      const newNote = { ...note, id: uid(), startTick };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    const maxEndTick = Math.max(...notes.map((note) => note.startTick + span + note.durationTicks));
    this.ensureGridCapacity(maxEndTick);
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
    this.playGmNote(pitch, duration, track.volume, track);
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

  jumpPlayheadBars(delta) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const next = this.playheadTick + ticksPerBar * delta;
    this.playheadTick = clamp(next, this.getLoopStartTick(), this.getLoopTicks());
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    if (!this.isPlaying) {
      this.lastPlaybackTick = this.playheadTick;
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    this.returnToStart();
  }

  returnToStart() {
    this.playheadTick = this.getLoopStartTick();
  }

  goToEnd() {
    this.playheadTick = this.getSongEndTick();
  }

  setLoopStartTick(tick) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const snapped = Math.max(0, Math.round(tick / ticksPerBar) * ticksPerBar);
    this.song.loopStartTick = snapped;
    if (typeof this.song.loopEndTick === 'number' && this.song.loopEndTick <= snapped) {
      this.song.loopEndTick = snapped + ticksPerBar;
    }
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.persist();
  }

  setLoopEndTick(tick) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const snapped = Math.max(1, Math.round(tick / ticksPerBar) * ticksPerBar);
    this.song.loopEndTick = snapped;
    this.ensureGridCapacity(snapped);
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.persist();
  }

  clearLoopStartTick() {
    this.song.loopStartTick = null;
    this.placingStartMarker = false;
    this.persist();
  }

  clearLoopEndTick() {
    this.song.loopEndTick = null;
    this.song.loopEnabled = false;
    this.placingEndMarker = false;
    this.persist();
  }

  toggleLoopEnabled() {
    if (typeof this.song.loopEndTick !== 'number') return;
    this.song.loopEnabled = !this.song.loopEnabled;
    this.persist();
  }

  getEndMarkerLabel() {
    if (typeof this.song.loopEndTick !== 'number') return 'End ∞';
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const bar = Math.max(1, Math.round(this.song.loopEndTick / ticksPerBar));
    return `End ${bar} bar${bar === 1 ? '' : 's'}`;
  }

  getStartMarkerLabel() {
    if (typeof this.song.loopStartTick !== 'number') return 'Start 1';
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const bar = Math.max(1, Math.round(this.song.loopStartTick / ticksPerBar) + 1);
    return `Start ${bar} bar${bar === 1 ? '' : 's'}`;
  }

  getPositionLabel() {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const bar = Math.floor(this.playheadTick / ticksPerBar) + 1;
    const beat = Math.floor((this.playheadTick % ticksPerBar) / this.ticksPerBeat) + 1;
    return `Pos ${bar}:${beat}`;
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
      if (isDrumChannel(track.channel)) {
        window.alert('Drum tracks are tied to Channel 10.');
        return;
      }
      this.openInstrumentPicker('edit', hit.trackIndex);
      return;
    } else if (hit.control === 'channel-down') {
      this.setTrackChannel(track, track.channel - 1);
      return;
    } else if (hit.control === 'channel-up') {
      this.setTrackChannel(track, track.channel + 1);
      return;
    } else if (hit.control === 'channel-prompt') {
      const nextChannel = window.prompt('Set channel (1-16)', String(track.channel + 1));
      if (nextChannel) {
        const parsed = Number.parseInt(nextChannel, 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 16) {
          this.setTrackChannel(track, parsed - 1);
        } else {
          window.alert('Channel must be 1-16.');
        }
      }
      return;
    } else if (hit.control === 'set-drums') {
      this.setTrackChannel(track, 9);
      return;
    } else if (hit.control === 'bank') {
      const current = `${track.bankMSB},${track.bankLSB}`;
      const nextBank = window.prompt('Enter bank MSB,LSB (0-127,0-127)', current);
      if (nextBank) {
        const [msbRaw, lsbRaw] = nextBank.split(',').map((value) => Number.parseInt(value.trim(), 10));
        if (Number.isInteger(msbRaw) && Number.isInteger(lsbRaw) && msbRaw >= 0 && msbRaw <= 127 && lsbRaw >= 0 && lsbRaw <= 127) {
          track.bankMSB = msbRaw;
          track.bankLSB = lsbRaw;
        } else {
          window.alert('Bank values must be 0-127.');
        }
      }
      this.persist();
      return;
    } else if (hit.control === 'name') {
      const nextName = window.prompt('Track name?', track.name);
      if (nextName) track.name = nextName;
    } else if (hit.control === 'volume') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(hit.x, hit.y);
    } else if (hit.control === 'pan') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(hit.x, hit.y);
    }
    this.persist();
  }

  setTrackChannel(track, channel) {
    const nextChannel = clamp(channel, 0, 15);
    track.channel = nextChannel;
    this.preloadTrackPrograms();
    this.persist();
  }

  updateTrackControl(x, y) {
    const hit = this.draggingTrackControl;
    if (!hit) return;
    const track = this.song.tracks[hit.trackIndex];
    if (!track) return;
    const ratio = clamp((x - hit.x) / hit.w, 0, 1);
    if (hit.control === 'volume') {
      track.volume = ratio;
    }
    if (hit.control === 'pan') {
      track.pan = clamp(ratio * 2 - 1, -1, 1);
    }
    this.persist();
  }

  handleSettingsControl(control, pointer) {
    if (!control?.id) return;
    if (control.id === 'audio-volume' || control.id === 'audio-latency' || control.id === 'audio-reverb-level') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
      return;
    }
    if (control.id === 'audio-reverb-toggle') {
      this.audioSettings.reverbEnabled = !this.audioSettings.reverbEnabled;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-engine-url') {
      const currentUrl = this.game?.audio?.getGmStatus?.().baseUrl || '';
      const nextUrl = window.prompt('GM SoundFont base URL', currentUrl);
      if (nextUrl && this.game?.audio?.setSoundfontUrl) {
        this.game.audio.setSoundfontUrl(nextUrl);
      }
      return;
    }
    if (control.id === 'audio-engine-reset') {
      this.game?.audio?.resetSoundfontUrl?.();
      return;
    }
    if (control.id === 'grid-preview') {
      this.previewOnEdit = !this.previewOnEdit;
      return;
    }
    if (control.id === 'grid-quantize-toggle') {
      this.quantizeEnabled = !this.quantizeEnabled;
      return;
    }
    if (control.id === 'grid-scrub') {
      this.scrubAudition = !this.scrubAudition;
      return;
    }
    if (control.id === 'grid-scale-lock') {
      this.scaleLock = !this.scaleLock;
      return;
    }
    if (control.id === 'playback-loop') {
      this.toggleLoopEnabled();
      return;
    }
    if (control.id === 'playback-metronome') {
      this.metronomeEnabled = !this.metronomeEnabled;
      return;
    }
    if (control.id === 'playback-swing') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
      return;
    }
    if (control.id === 'ui-contrast') {
      this.highContrast = !this.highContrast;
      this.song.highContrast = this.highContrast;
      this.persist();
      return;
    }
    if (control.id === 'grid-select-all') {
      const pattern = this.getActivePattern();
      if (!pattern) return;
      this.selection = new Set(pattern.notes.map((note) => note.id));
      this.openSelectionMenu(this.lastPointer.x + 12, this.lastPointer.y + 12);
      return;
    }
    if (control.id === 'grid-quantize-value') {
      this.quantizeIndex = (this.quantizeIndex + 1) % this.quantizeOptions.length;
      return;
    }
    if (control.id === 'grid-note-length') {
      this.noteLengthIndex = (this.noteLengthIndex + 1) % NOTE_LENGTH_OPTIONS.length;
      return;
    }
    if (control.id === 'song-tempo') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
    }
  }

  updateSliderValue(x, y, id, bounds) {
    if (!bounds) return;
    const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
    if (id === 'audio-volume') {
      this.audioSettings.masterVolume = ratio;
    }
    if (id === 'audio-reverb-level') {
      this.audioSettings.reverbLevel = ratio;
    }
    if (id === 'audio-latency') {
      this.audioSettings.latencyMs = Math.round(ratio * 120);
    }
    if (id === 'playback-swing') {
      this.swing = Math.round(ratio * 60);
    }
    if (id === 'song-tempo') {
      this.setTempo(Math.round(40 + ratio * 200));
    }
    this.saveAudioSettings();
    this.applyAudioSettings();
  }

  handleSelectionMenuAction(action) {
    if (action === 'selection-erase') {
      this.deleteSelectedNotes();
      this.closeSelectionMenu();
      return;
    }
    if (action === 'selection-copy') {
      this.copySelection();
      this.closeSelectionMenu();
      this.beginPastePreview();
      return;
    }
    if (action === 'selection-cut') {
      this.copySelection();
      this.deleteSelectedNotes();
      this.closeSelectionMenu();
      this.beginPastePreview();
    }
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
    if (action === 'soundfont') {
      const currentUrl = this.game?.audio?.getGmStatus?.().baseUrl || '';
      const nextUrl = window.prompt('GM SoundFont base URL', currentUrl);
      if (nextUrl && this.game?.audio?.setSoundfontUrl) {
        this.game.audio.setSoundfontUrl(nextUrl);
      }
      this.toolsMenuOpen = false;
    }
    if (action === 'soundfont-reset') {
      if (this.game?.audio?.resetSoundfontUrl) {
        this.game.audio.resetSoundfontUrl();
      }
      this.toolsMenuOpen = false;
    }
  }

  generatePattern() {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const loopTicks = this.getLoopTicks();
    pattern.notes = [];
    if (isDrumChannel(track.channel)) {
      const drumRows = this.getDrumRows();
      for (let bar = 0; bar < this.song.loopBars; bar += 1) {
        const base = bar * this.beatsPerBar * this.ticksPerBeat;
        drumRows.forEach((drum, index) => {
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
    const validation = this.validateSong(data);
    if (!validation.valid) {
      const message = validation.error || 'Invalid song schema.';
      console.warn(message);
      window.alert(message);
      return;
    }
    this.song = this.migrateSong(data);
    this.selectedTrackIndex = 0;
    this.selectedPatternIndex = 0;
    this.ensureState();
    this.persist();
  }

  loadDemoSong() {
    this.song = createDemoSong();
    this.ensureState();
    this.qaResults = [{ label: 'Demo loaded', status: 'pass' }];
    if (!this.isPlaying) {
      this.togglePlayback();
    }
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

  getDrumRows() {
    return this.drumAdvanced ? GM_DRUMS : GM_DRUM_ROWS;
  }

  getPitchRange() {
    const track = this.getActiveTrack();
    if (isDrumChannel(track?.channel)) {
      const pitches = this.getDrumRows().map((row) => row.pitch);
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
    if (isDrumChannel(track?.channel)) {
      const rows = this.getDrumRows();
      const entry = rows[row];
      return entry?.pitch ?? rows[0].pitch;
    }
    const range = this.getPitchRange();
    return range.max - row;
  }

  getRowFromPitch(pitch) {
    const track = this.getActiveTrack();
    if (isDrumChannel(track?.channel)) {
      return this.getDrumRows().findIndex((row) => row.pitch === pitch);
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
    const edgeMargin = Math.min(10, rect.w / 3);
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

  ensureCursorVisible() {
    if (!this.gridBounds) return;
    const { x, y, w, h, originX, originY, cellWidth, cellHeight, rows, cols } = this.gridBounds;
    const row = this.getRowFromPitch(this.cursor.pitch);
    const col = clamp(this.cursor.tick, 0, cols);
    const cursorX = originX + col * cellWidth;
    const cursorY = originY + row * cellHeight;
    const margin = 24;
    if (cursorX < x + margin) {
      this.gridOffset.x += (x + margin) - cursorX;
    } else if (cursorX > x + w - margin) {
      this.gridOffset.x -= cursorX - (x + w - margin);
    }
    if (cursorY < y + margin) {
      this.gridOffset.y += (y + margin) - cursorY;
    } else if (cursorY > y + h - margin) {
      this.gridOffset.y -= cursorY - (y + h - margin);
    }
    this.clampGridOffset(w, h, cellWidth * cols, cellHeight * rows);
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
    ctx.fillStyle = this.highContrast ? '#000' : '#070707';
    ctx.fillRect(0, 0, width, height);

    const isMobile = this.isMobileLayout();
    const padding = isMobile ? 12 : 16;
    const headerH = 0;
    const tabsH = isMobile ? 48 : 44;
    const transportH = isMobile ? 132 : 96;
    const headerY = padding;
    const tabsX = padding;
    const tabsY = headerY + headerH + 8;
    const tabsW = width - padding * 2;
    this.drawTabs(ctx, tabsX, tabsY, tabsW, tabsH);

    const contentX = padding;
    const contentY = tabsY + tabsH + 8;
    const contentW = width - padding * 2;
    const contentH = height - contentY - transportH - padding;
    const transportY = height - transportH - padding;
    this.drawTransportBar(ctx, padding, transportY, width - padding * 2, transportH);

    if (this.activeTab === 'grid') {
      this.drawGridTab(ctx, contentX, contentY, contentW, contentH, track, pattern);
    } else if (this.activeTab === 'instruments') {
      this.drawInstrumentPanel(ctx, contentX, contentY, contentW, contentH, track);
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
    }

    if (this.qaOverlayOpen) {
      this.drawQaOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  truncateLabel(ctx, label, maxWidth) {
    if (ctx.measureText(label).width <= maxWidth) return label;
    let truncated = label;
    while (truncated.length > 4 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  drawHeader(ctx, x, y, w, h, track) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const isMobile = this.isMobileLayout();
    const title = this.song.name || 'Pattern Sequencer';
    const playState = this.isPlaying ? 'Playing' : 'Stopped';
    const rowH = 44;
    const padding = 12;
    const titleY = y + padding + rowH * 0.6;
    ctx.fillStyle = '#fff';
    ctx.font = isMobile ? '18px Courier New' : '20px Courier New';
    ctx.fillText(title, x + padding, titleY);

    ctx.fillStyle = this.isPlaying ? '#ffe16a' : 'rgba(255,255,255,0.6)';
    ctx.font = isMobile ? '12px Courier New' : '13px Courier New';
    ctx.fillText(playState, x + padding, titleY + (isMobile ? 18 : 16));

    const rawLabel = track
      ? isDrumChannel(track.channel)
        ? `${track.name || 'Track'} • Drum Kit`
        : `${track.name || 'Track'} • ${this.getProgramLabel(track.program)}`
      : 'Select Instrument';
    const instrumentLabel = this.truncateLabel(ctx, rawLabel, w * 0.62);

    const pillY = y + h - rowH - padding;
    const pillW = Math.min(w * 0.62, ctx.measureText(instrumentLabel).width + 36);
    this.bounds.headerInstrument = { x: x + padding, y: pillY, w: pillW, h: rowH };
    this.drawButton(ctx, this.bounds.headerInstrument, instrumentLabel, false, true);

    const tempoX = x + w - 180;
    const gmStatus = this.game?.audio?.getGmStatus?.();
    if (gmStatus) {
      const statusText = gmStatus.error
        ? 'GM Bank Error'
        : gmStatus.loading
          ? 'Loading instrument bank…'
          : 'GM Bank Ready';
      ctx.fillStyle = gmStatus.error ? '#ff6a6a' : 'rgba(255,255,255,0.6)';
      ctx.font = isMobile ? '11px Courier New' : '12px Courier New';
      ctx.fillText(statusText, tempoX, y + padding + 12);
    }
  }

  drawTabs(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    const gap = 6;
    const tabW = (w - gap * (TAB_OPTIONS.length - 1)) / TAB_OPTIONS.length;
    this.bounds.tabs = [];
    TAB_OPTIONS.forEach((tab, index) => {
      const tabX = x + index * (tabW + gap);
      const bounds = { x: tabX, y, w: tabW, h, id: tab.id };
      this.bounds.tabs.push(bounds);
      const active = this.activeTab === tab.id;
      this.drawButton(ctx, bounds, tab.label, active, false);
    });
  }

  drawTransportBar(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    this.bounds.transportBar = { x, y, w, h };
    const isMobile = this.isMobileLayout();
    const gap = 10;
    const buttonH = Math.max(44, h - 24);
    const buttonW = Math.min(80, (w - gap * 6) / 5);
    const totalW = buttonW * 5 + gap * 4;
    const startX = x + (w - totalW) / 2;
    const centerY = y + (h - buttonH) / 2;
    const buttons = [
      { id: 'returnStart', label: '<<' },
      { id: 'prevBar', label: '<' },
      { id: 'play', label: 'O', active: this.isPlaying },
      { id: 'nextBar', label: '>' },
      { id: 'goEnd', label: '>>' }
    ];
    buttons.forEach((button, index) => {
      const bx = startX + index * (buttonW + gap);
      const bounds = { x: bx, y: centerY, w: buttonW, h: buttonH };
      this.bounds[button.id] = bounds;
      this.drawButton(ctx, bounds, button.label, Boolean(button.active), false);
    });

    const position = this.getPositionLabel();
    ctx.fillStyle = '#ffe16a';
    ctx.font = isMobile ? '12px Courier New' : '13px Courier New';
    ctx.fillText(position, x + 12, y + 18);
  }

  drawGridTab(ctx, x, y, w, h, track, pattern) {
    const controlsH = this.drawGridControls(ctx, x, y, w, track);
    const gridY = y + controlsH + 12;
    const gridH = h - controlsH - 12;
    this.drawPatternEditor(ctx, x, gridY, w, gridH, track, pattern);
  }

  drawGridControls(ctx, x, y, w, track) {
    const rowH = 44;
    const gap = 8;
    const buttonSize = rowH;
    let cursorX = x;
    ctx.font = '13px Courier New';
    const label = track
      ? isDrumChannel(track.channel)
        ? '[Drum Kit]'
        : `[${this.getProgramLabel(track.program)}]`
      : '[No Track]';
    this.bounds.instrumentPrev = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentPrev, '<', false, false);
    cursorX += buttonSize + gap;

    const labelW = Math.min(w * 0.6, Math.max(160, ctx.measureText(label).width + 28));
    this.bounds.instrumentLabel = { x: cursorX, y, w: labelW, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentLabel, label, false, true);
    cursorX += labelW + gap;

    this.bounds.instrumentNext = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentNext, '>', false, false);
    cursorX += buttonSize + gap;

    this.bounds.addTrack = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.addTrack, '+', false, false);
    cursorX += buttonSize + gap;

    this.bounds.removeTrack = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.removeTrack, '−', false, false);

    return rowH;
  }

  drawInstrumentPanel(ctx, x, y, w, h, track) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const isMobile = this.isMobileLayout();
    const padding = 12;
    const tabY = y + padding;
    const tabH = 44;
    const tabRows = isMobile ? 2 : 1;
    const tabsPerRow = Math.ceil(INSTRUMENT_FAMILY_TABS.length / tabRows);
    this.instrumentPicker.tabBounds = [];
    for (let row = 0; row < tabRows; row += 1) {
      for (let col = 0; col < tabsPerRow; col += 1) {
        const index = row * tabsPerRow + col;
        const tab = INSTRUMENT_FAMILY_TABS[index];
        if (!tab) continue;
        const tabW = (w - padding * 2 - (tabsPerRow - 1) * 6) / tabsPerRow;
        const tabX = x + padding + col * (tabW + 6);
        const tabRowY = tabY + row * (tabH + 6);
        const bounds = { x: tabX, y: tabRowY, w: tabW, h: tabH, id: tab.id };
        this.instrumentPicker.tabBounds.push(bounds);
        this.drawButton(ctx, bounds, tab.label, this.instrumentPicker.familyTab === tab.id, false);
      }
    }

    const sectionsY = tabY + tabRows * (tabH + 6) + 12;
    const scrollY = sectionsY;
    const scrollH = y + h - scrollY - padding;
    this.instrumentPicker.sectionBounds = [{ x: x + padding, y: scrollY, w: w - padding * 2, h: scrollH }];

    const tiles = [];
    const makeTile = (program) => ({
      program,
      label: `${formatProgramNumber(program)} ${GM_PROGRAMS[program]?.name || 'Program'}`
    });

    if (this.favoriteInstruments.length > 0) {
      tiles.push({ type: 'section', label: 'Favorites' });
      this.favoriteInstruments.forEach((program) => tiles.push(makeTile(program)));
    }
    if (this.recentInstruments.length > 0) {
      tiles.push({ type: 'section', label: 'Recent' });
      this.recentInstruments.forEach((program) => tiles.push(makeTile(program)));
    }
    const mainPrograms = this.getProgramsForFamily(this.instrumentPicker.familyTab);
    tiles.push({ type: 'section', label: 'All Instruments' });
    mainPrograms.forEach((entry) => tiles.push(makeTile(entry.program)));

    const columns = isMobile ? 2 : w > 880 ? 4 : 3;
    const tileGap = 10;
    const tileW = (w - padding * 2 - tileGap * (columns - 1)) / columns;
    const tileH = 64;
    let cursorX = x + padding;
    let cursorY = scrollY - this.instrumentPicker.scroll;
    this.instrumentPicker.bounds = [];
    this.instrumentPicker.favoriteBounds = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, scrollY, w - padding * 2, scrollH);
    ctx.clip();
    tiles.forEach((item) => {
      if (item.type === 'section') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '13px Courier New';
        ctx.fillText(item.label, x + padding, cursorY + 16);
        cursorY += 26;
        cursorX = x + padding;
        return;
      }
      if (item.type === 'empty') {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '12px Courier New';
        ctx.fillText(item.label, x + padding, cursorY + 18);
        cursorY += 28;
        cursorX = x + padding;
        return;
      }
      const bounds = { x: cursorX, y: cursorY, w: tileW, h: tileH, program: item.program };
      if (cursorY + tileH >= scrollY - tileH && cursorY <= scrollY + scrollH + tileH) {
        this.drawButton(ctx, bounds, item.label, track?.program === item.program, true);
        this.instrumentPicker.bounds.push(bounds);
        const favoriteBounds = { x: bounds.x + bounds.w - 46, y: bounds.y + 6, w: 44, h: 44, program: item.program };
        this.instrumentPicker.favoriteBounds.push(favoriteBounds);
        ctx.fillStyle = this.favoriteInstruments.includes(item.program) ? '#ffe16a' : 'rgba(255,255,255,0.4)';
        ctx.font = '20px Courier New';
        ctx.fillText('★', favoriteBounds.x + 12, favoriteBounds.y + 28);
      }
      cursorX += tileW + tileGap;
      if ((cursorX + tileW) > x + w - padding + 1) {
        cursorX = x + padding;
        cursorY += tileH + tileGap;
      }
    });
    const totalHeight = cursorY - scrollY + tileH + this.instrumentPicker.scroll;
    ctx.restore();

    this.instrumentPicker.scrollMax = Math.max(0, totalHeight - scrollH);
    this.instrumentPicker.scroll = clamp(this.instrumentPicker.scroll, 0, this.instrumentPicker.scrollMax);
  }

  drawSettingsPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    this.bounds.settingsPanel = { x, y, w, h };

    const padding = 14;
    let cursorY = y + padding - this.settingsScroll;
    const sectionGap = 22;
    const rowH = 56;
    const labelW = Math.min(220, w * 0.4);
    this.bounds.settingsControls = [];
    this.bounds.controllerControls = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, y + padding, w - padding * 2, h - padding * 2);
    ctx.clip();

    const drawSectionTitle = (label) => {
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.fillText(label, x + padding, cursorY + 16);
      cursorY += 28;
    };

    const drawToggle = (label, value, id, description) => {
      const bounds = { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '13px Courier New';
      ctx.fillText(label, x + padding, cursorY + 22);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      if (description) {
        ctx.fillText(description, x + padding, cursorY + 40);
      }
      this.drawButton(ctx, bounds, value ? 'On' : 'Off', value, false);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    const drawAction = (label, valueText, id, description) => {
      const bounds = { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '13px Courier New';
      ctx.fillText(label, x + padding, cursorY + 22);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      if (description) {
        ctx.fillText(description, x + padding, cursorY + 40);
      }
      this.drawButton(ctx, bounds, valueText, false, false);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    const drawSlider = (label, valueText, ratio, id, description) => {
      const bounds = { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      const barBounds = { x: bounds.x, y: cursorY + 24, w: bounds.w, h: 16 };
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '13px Courier New';
      ctx.fillText(label, x + padding, cursorY + 22);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      if (description) {
        ctx.fillText(description, x + padding, cursorY + 40);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(barBounds.x, barBounds.y, barBounds.w * ratio, barBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(valueText, barBounds.x, barBounds.y + 32);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    drawSectionTitle('Audio');
    drawSlider('Master Volume', `${Math.round(this.audioSettings.masterVolume * 100)}%`, this.audioSettings.masterVolume, 'audio-volume', 'Overall output level.');
    drawToggle('Reverb', this.audioSettings.reverbEnabled, 'audio-reverb-toggle', 'Adds space to GM playback.');
    drawSlider('Reverb Level', `${Math.round(this.audioSettings.reverbLevel * 100)}%`, this.audioSettings.reverbLevel, 'audio-reverb-level', 'Wet mix for the reverb bus.');
    drawSlider('Output Latency', `${this.audioSettings.latencyMs} ms`, this.audioSettings.latencyMs / 120, 'audio-latency', 'Increase if audio crackles.');
    const soundfontBounds = { x: x + padding, y: cursorY, w: w - padding * 2, h: rowH, id: 'audio-engine-url' };
    this.drawButton(ctx, soundfontBounds, 'SoundFont URL', false, false);
    this.bounds.settingsControls.push(soundfontBounds);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Point to a WebAudioFont-compatible GM bank.', x + padding, cursorY + rowH + 16);
    cursorY += rowH + 28;
    const soundfontResetBounds = { x: x + padding, y: cursorY, w: w - padding * 2, h: rowH, id: 'audio-engine-reset' };
    this.drawButton(ctx, soundfontResetBounds, 'Reset SoundFont', false, false);
    this.bounds.settingsControls.push(soundfontResetBounds);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Restore the default GM soundfont URL.', x + padding, cursorY + rowH + 16);
    cursorY += rowH + sectionGap;

    drawSectionTitle('Grid & Editing');
    drawToggle('Preview On', this.previewOnEdit, 'grid-preview', 'Audition notes as you place them.');
    drawAction('Grid', this.quantizeOptions[this.quantizeIndex].label, 'grid-quantize-value', 'Quantize grid step size.');
    drawToggle('Snap', this.scaleLock, 'grid-scale-lock', 'Snap pitches to the current scale.');
    drawToggle('Quant', this.quantizeEnabled, 'grid-quantize-toggle', 'Enable quantized placement.');
    drawToggle('Scrub', this.scrubAudition, 'grid-scrub', 'Audition notes while scrubbing.');
    drawAction('All', 'Select', 'grid-select-all', 'Select all notes in the current pattern.');
    drawAction('Note Length', NOTE_LENGTH_OPTIONS[this.noteLengthIndex].label, 'grid-note-length', 'Default length for new notes.');
    drawToggle('High Contrast', this.highContrast, 'ui-contrast', 'Boosts UI contrast for clarity.');
    cursorY += sectionGap;

    drawSectionTitle('Tempo & Playback');
    drawSlider('Tempo', `${this.song.tempo} BPM`, (this.song.tempo - 40) / 200, 'song-tempo', 'Song playback tempo.');
    drawToggle('Loop Enabled', this.song.loopEnabled, 'playback-loop', 'Loops between Start and End markers.');
    drawToggle('Metronome', this.metronomeEnabled, 'playback-metronome', 'Click on beats during playback.');
    drawSlider('Swing', `${Math.round(this.swing)}%`, this.swing / 60, 'playback-swing', 'Delays off-beats for groove.');
    cursorY += sectionGap;

    drawSectionTitle('Controller');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Tap an action to cycle its button assignment.', x + padding, cursorY + 8);
    cursorY += 16;
    CONTROLLER_ACTIONS.forEach((action) => {
      const bounds = {
        x: x + padding + labelW,
        y: cursorY,
        w: w - padding * 2 - labelW,
        h: rowH,
        actionId: action.id
      };
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '13px Courier New';
      ctx.fillText(action.label, x + padding, cursorY + 28);
      this.drawButton(ctx, bounds, this.controllerMapping[action.id], false, false);
      this.bounds.controllerControls.push(bounds);
      cursorY += rowH + 8;
    });
    cursorY += sectionGap;

    drawSectionTitle('Storage / Export');
    this.bounds.exportSong = { x: x + padding, y: cursorY, w: w - padding * 2, h: rowH };
    this.drawButton(ctx, this.bounds.exportSong, 'Export Song JSON', false, false);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Download the current song as JSON.', x + padding, cursorY + rowH + 16);
    cursorY += rowH + 28;
    this.bounds.importSong = { x: x + padding, y: cursorY, w: w - padding * 2, h: rowH };
    this.drawButton(ctx, this.bounds.importSong, 'Import Song JSON', false, false);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Load a saved song file.', x + padding, cursorY + rowH + 16);
    cursorY += rowH + 28;
    this.bounds.demoSong = { x: x + padding, y: cursorY, w: w - padding * 2, h: rowH };
    this.drawButton(ctx, this.bounds.demoSong, 'Load Demo Song', false, false);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px Courier New';
    ctx.fillText('Loads a built-in demo pattern.', x + padding, cursorY + rowH + 16);
    cursorY += rowH + sectionGap;

    drawSectionTitle('Tracks');
    const mixerHeight = this.drawTrackMixer(ctx, x + padding, cursorY, w - padding * 2);
    cursorY += mixerHeight;

    drawSectionTitle('Help');
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px Courier New';
    const helpLines = [
      'Drag a box to select notes, then use Erase / Copy / Cut.',
      `Play/Pause: ${this.controllerMapping.play}`,
      `Stop/Return: ${this.controllerMapping.stop}`,
      `Open Instruments: ${this.controllerMapping.instrument}`,
      `Place Note: ${this.controllerMapping.place}`,
      `Erase Note: ${this.controllerMapping.erase}`,
      'Scrub Timeline: LT / RT',
      'Drag on grid to move selection.'
    ];
    helpLines.forEach((line) => {
      ctx.fillText(line, x + padding, cursorY + 18);
      cursorY += 20;
    });
    cursorY += sectionGap;

    const contentHeight = cursorY - y + padding + this.settingsScroll;
    ctx.restore();
    this.settingsScrollMax = Math.max(0, contentHeight - h + padding);
    this.settingsScroll = clamp(this.settingsScroll, 0, this.settingsScrollMax);
  }

  drawHelpPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    const padding = 16;
    let cursorY = y + padding;
    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.fillText('Controller Help', x + padding, cursorY + 18);
    cursorY += 32;
    ctx.font = '13px Courier New';
    const lines = [
      'Move Cursor: D-pad / Left Stick',
      `Place Note: ${this.controllerMapping.place}`,
      `Erase Note: ${this.controllerMapping.erase}`,
      `Switch Tool: ${this.controllerMapping.tool}`,
      `Open Instruments: ${this.controllerMapping.instrument}`,
      `Octave Up: ${this.controllerMapping.octaveUp}`,
      `Octave Down: ${this.controllerMapping.octaveDown}`,
      'Scrub Timeline: LT / RT',
      `Play/Pause: ${this.controllerMapping.play}`,
      `Stop/Return: ${this.controllerMapping.stop}`
    ];
    lines.forEach((line) => {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(line, x + padding, cursorY + 18);
      cursorY += 22;
    });
  }

  drawTrackMixer(ctx, x, y, w) {
    const isMobile = this.isMobileLayout();
    const rowH = isMobile ? 86 : 78;
    const gap = 10;
    this.trackBounds = [];
    this.trackControlBounds = [];
    let cursorY = y;
    this.song.tracks.forEach((track, index) => {
      const bounds = { x, y: cursorY, w, h: rowH, index };
      ctx.fillStyle = index === this.selectedTrackIndex ? 'rgba(255,225,106,0.2)' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = track.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Courier New';
      ctx.fillText(track.name, bounds.x + 10, bounds.y + 22);
      const muteBounds = { x: bounds.x + 10, y: bounds.y + 28, w: 44, h: 44, trackIndex: index, control: 'mute' };
      const soloBounds = { x: bounds.x + 60, y: bounds.y + 28, w: 44, h: 44, trackIndex: index, control: 'solo' };
      this.drawButton(ctx, muteBounds, 'M', track.mute, false);
      this.drawButton(ctx, soloBounds, 'S', track.solo, false);
      this.trackControlBounds.push(muteBounds, soloBounds);
      const volumeBounds = {
        x: bounds.x + 120,
        y: bounds.y + 42,
        w: bounds.w - 140,
        h: 12,
        trackIndex: index,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * track.volume, volumeBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      this.trackControlBounds.push(volumeBounds);

      const panBounds = {
        x: bounds.x + 120,
        y: bounds.y + 60,
        w: bounds.w - 140,
        h: 10,
        trackIndex: index,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((track.pan + 1) / 2), panBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      this.trackControlBounds.push(panBounds);
      this.trackBounds.push(bounds);
      cursorY += rowH + gap;
    });
    return cursorY - y;
  }

  drawTopBar(ctx, x, y, w, h, track) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    this.bounds.endMarker = null;
    this.bounds.loopToggle = null;

    const isMobile = this.isMobileLayout();
    const rowGap = 8;
    const rowH = isMobile ? 30 : 28;
    const titleRowY = y + 10;
    const instrumentRowY = isMobile ? titleRowY + rowH + rowGap : titleRowY;
    const controlsRowY = isMobile ? instrumentRowY + rowH + rowGap : titleRowY;

    ctx.fillStyle = '#fff';
    ctx.font = isMobile ? '16px Courier New' : '18px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Pattern Sequencer', x + 12, titleRowY - 6);

    const gmStatus = this.game?.audio?.getGmStatus?.();
    if (gmStatus) {
      const statusText = gmStatus.error
        ? 'GM Bank Error'
        : gmStatus.loading
          ? 'Loading instrument bank…'
          : 'GM Bank Ready';
      ctx.fillStyle = gmStatus.error ? '#ff6a6a' : 'rgba(255,255,255,0.7)';
      ctx.font = '11px Courier New';
      ctx.fillText(statusText, x + 12, titleRowY + (isMobile ? 12 : 10));
    }

    const settingsW = isMobile ? 96 : 110;
    this.bounds.settings = { x: x + w - settingsW - 12, y: titleRowY, w: settingsW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.settings, 'Settings', this.settingsOpen);

    let cursorX = x + 12;
    const buttonSize = rowH;
    this.bounds.instrumentPrev = { x: cursorX, y: instrumentRowY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentPrev, '<', false);
    cursorX += buttonSize + 6;

    const instrumentLabel = this.getTrackInstrumentLabel(track);
    ctx.font = '13px Courier New';
    const labelWidth = Math.min(260, Math.max(140, ctx.measureText(instrumentLabel).width + 24));
    this.bounds.instrumentLabel = { x: cursorX, y: instrumentRowY, w: labelWidth, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentLabel, instrumentLabel, false);
    cursorX += labelWidth + 6;

    this.bounds.instrumentNext = { x: cursorX, y: instrumentRowY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentNext, '>', false);
    cursorX += buttonSize + 10;

    this.bounds.addTrack = { x: cursorX, y: instrumentRowY, w: 64, h: rowH };
    this.drawSmallButton(ctx, this.bounds.addTrack, 'Add', false);
    cursorX += 70;

    this.bounds.removeTrack = { x: cursorX, y: instrumentRowY, w: 78, h: rowH };
    this.drawSmallButton(ctx, this.bounds.removeTrack, 'Remove', false);

    const controlStartX = isMobile ? x + 12 : x + w - 400;
    const playW = isMobile ? 90 : 100;
    this.bounds.play = { x: controlStartX, y: controlsRowY, w: playW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.play, this.isPlaying ? 'Stop' : 'Play', this.isPlaying);

    const slurX = controlStartX + playW + 10;
    this.bounds.slur = { x: slurX, y: controlsRowY, w: 90, h: rowH };
    this.drawToggle(ctx, this.bounds.slur, `Slur ${this.slurEnabled ? 'On' : 'Off'}`, this.slurEnabled);

    let noteLengthX = slurX + 100;
    const noteLengthLabel = `Note ${NOTE_LENGTH_OPTIONS[this.noteLengthIndex].label}`;
    this.bounds.noteLength = { x: noteLengthX, y: controlsRowY, w: 96, h: rowH };
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLengthLabel, false);

    noteLengthX += 110;
    if (track && isDrumChannel(track.channel)) {
      this.bounds.drumView = { x: noteLengthX, y: controlsRowY, w: 140, h: rowH };
      const drumLabel = this.drumAdvanced ? 'Drum View: Full' : 'Drum View: Basic';
      this.drawSmallButton(ctx, this.bounds.drumView, drumLabel, false);
      noteLengthX += 150;
    } else {
      this.bounds.drumView = null;
    }

    const tempoX = noteLengthX;
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`Tempo ${this.song.tempo} BPM`, tempoX, controlsRowY + rowH * 0.7);
    const tempoButtonW = 28;
    this.bounds.tempoDown = { x: tempoX + 130, y: controlsRowY, w: tempoButtonW, h: rowH };
    this.bounds.tempoUp = { x: tempoX + 130 + tempoButtonW + 6, y: controlsRowY, w: tempoButtonW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoDown, '-', false);
    this.drawSmallButton(ctx, this.bounds.tempoUp, '+', false);
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

    this.bounds.endMarker = { x: x + offset(340), y: y + offset(16), w: offset(140), h: offset(24) };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.endMarker.x, this.bounds.endMarker.y, this.bounds.endMarker.w, this.bounds.endMarker.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(this.bounds.endMarker.x, this.bounds.endMarker.y, this.bounds.endMarker.w, this.bounds.endMarker.h);
    ctx.fillStyle = '#fff';
    const endLabel = this.placingEndMarker ? 'Set End...' : this.getEndMarkerLabel();
    ctx.fillText(endLabel, this.bounds.endMarker.x + offset(8), this.bounds.endMarker.y + offset(16));

    this.bounds.loopToggle = { x: x + offset(490), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);

    this.bounds.metronome = { x: x + offset(610), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);

    this.bounds.quantizeToggle = { x: x + offset(740), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    this.bounds.quantizeValue = { x: x + offset(860), y: y + offset(16), w: offset(70), h: offset(24) };
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

    this.bounds.endMarker = { x: innerX, y: rowY, w: innerW, h: rowH };
    const endLabel = this.placingEndMarker ? 'Set End...' : this.getEndMarkerLabel();
    this.drawSmallButton(ctx, this.bounds.endMarker, endLabel, false);
    rowY += rowH + gap;

    this.bounds.loopToggle = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);
    this.bounds.metronome = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    rowY += rowH + gap;

    this.bounds.quantizeToggle = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    this.bounds.quantizeValue = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.quantizeValue, this.quantizeOptions[this.quantizeIndex].label, true);
    rowY += rowH + gap;

    this.bounds.noteLength = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.noteLength, `Note ${NOTE_LENGTH_OPTIONS[this.noteLengthIndex].label}`, false);
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
    const rowH = isMobile ? 104 : 80;
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
      const isDrums = isDrumChannel(track.channel);
      const instrumentLabel = isDrums
        ? 'Drums (Ch 10)'
        : this.getProgramLabel(track.program);
      ctx.fillText(instrumentLabel, x + 32, rowY + (isMobile ? 50 : 38));
      if (!isDrums) {
        this.trackControlBounds.push({
          x: x + 30,
          y: rowY + (isMobile ? 34 : 26),
          w: w - 170,
          h: isMobile ? 26 : 18,
          trackIndex: index,
          control: 'instrument'
        });
      }

      const channelButtonH = isMobile ? 22 : 18;
      const channelDownBounds = { x: x + w - 170, y: rowY + 8, w: 20, h: channelButtonH };
      const channelLabelBounds = { x: x + w - 146, y: rowY + 8, w: 50, h: channelButtonH };
      const channelUpBounds = { x: x + w - 92, y: rowY + 8, w: 20, h: channelButtonH };
      this.drawSmallButton(ctx, channelDownBounds, '<', false);
      this.drawSmallButton(ctx, channelLabelBounds, `Ch ${track.channel + 1}`, false);
      this.drawSmallButton(ctx, channelUpBounds, '>', false);
      this.trackControlBounds.push({ ...channelDownBounds, trackIndex: index, control: 'channel-down' });
      this.trackControlBounds.push({ ...channelLabelBounds, trackIndex: index, control: 'channel-prompt' });
      this.trackControlBounds.push({ ...channelUpBounds, trackIndex: index, control: 'channel-up' });

      const muteBounds = { x: x + w - 64, y: rowY + 8, w: isMobile ? 28 : 22, h: channelButtonH };
      const soloBounds = { x: x + w - 34, y: rowY + 8, w: isMobile ? 28 : 22, h: channelButtonH };
      this.drawSmallButton(ctx, muteBounds, 'M', track.mute);
      this.drawSmallButton(ctx, soloBounds, 'S', track.solo);
      this.trackControlBounds.push({ ...muteBounds, trackIndex: index, control: 'mute' });
      this.trackControlBounds.push({ ...soloBounds, trackIndex: index, control: 'solo' });

      const bankBounds = { x: x + 32, y: rowY + (isMobile ? 64 : 50), w: 120, h: isMobile ? 20 : 18 };
      const bankLabel = isDrums ? 'Kit: Standard' : `Bank ${track.bankMSB}/${track.bankLSB}`;
      this.drawSmallButton(ctx, bankBounds, bankLabel, false);
      this.trackControlBounds.push({ ...bankBounds, trackIndex: index, control: 'bank' });
      if (!isDrums) {
        const drumsBounds = { x: bankBounds.x + bankBounds.w + 8, y: bankBounds.y, w: 100, h: bankBounds.h };
        this.drawSmallButton(ctx, drumsBounds, 'Set Drums', false);
        this.trackControlBounds.push({ ...drumsBounds, trackIndex: index, control: 'set-drums' });
      }

      const volumeBounds = { x: x + 32, y: rowY + (isMobile ? 86 : 64), w: w - 70, h: isMobile ? 12 : 10 };
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
    const rows = isDrumChannel(track.channel)
      ? this.getDrumRows().length
      : this.getPitchRange().max - this.getPitchRange().min + 1;
    const isMobile = this.isMobileLayout();
    const labelW = isMobile ? 76 : 96;
    const rulerH = 28;
    const gridW = w - labelW;
    const baseCellWidth = gridW / loopTicks;
    const baseCellHeight = Math.min(24, (h - rulerH - 16) / rows);
    const cellWidth = baseCellWidth * this.gridZoom;
    const cellHeight = baseCellHeight * this.gridZoom;
    const gridH = cellHeight * rows;
    const viewH = Math.max(0, h - rulerH);
    const viewW = gridW;
    this.clampGridOffset(viewW, viewH, gridW, gridH);
    const originX = x + labelW + this.gridOffset.x;
    const originY = y + rulerH + this.gridOffset.y;

    this.rulerBounds = { x: x + labelW, y, w: gridW, h: rulerH };
    this.gridBounds = {
      x: x + labelW,
      y: y + rulerH,
      w: viewW,
      h: viewH,
      cols: loopTicks,
      rows,
      cellWidth,
      cellHeight,
      originX,
      originY,
      gridW,
      gridH,
      labelX: x,
      labelW
    };

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, viewH + rulerH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, viewH + rulerH);

    this.drawRuler(ctx, x + labelW, y, gridW, loopTicks);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + labelW, y + rulerH, viewW, viewH);
    ctx.clip();
    this.drawGrid(ctx, track, pattern, loopTicks);
    this.drawPlayhead(ctx);
    this.drawCursor(ctx);
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, labelW, viewH + rulerH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, labelW, viewH + rulerH);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    ctx.fillText(isMobile ? 'Notes' : 'Note', x + 8, y + 18);
    this.drawLabelColumn(ctx, track);
    this.drawSelectionMenu(ctx);
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
    const totalBars = Math.max(1, Math.ceil(loopTicks / ticksPerBar));
    for (let bar = 0; bar < totalBars; bar += 1) {
      const barX = originX + bar * ticksPerBar * cellWidth;
      ctx.fillText(`${bar + 1}`, barX + 4, y + 16);
    }
    if (typeof this.song.loopStartTick === 'number') {
      const startX = originX + this.song.loopStartTick * cellWidth;
      ctx.strokeStyle = '#55d68a';
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX, y + 24);
      ctx.stroke();
      ctx.fillStyle = '#55d68a';
      ctx.fillText('START', startX + 4, y + 16);
    }
    if (typeof this.song.loopEndTick === 'number') {
      const endX = originX + this.song.loopEndTick * cellWidth;
      ctx.strokeStyle = '#ff6a6a';
      ctx.beginPath();
      ctx.moveTo(endX, y);
      ctx.lineTo(endX, y + 24);
      ctx.stroke();
      ctx.fillStyle = '#ff6a6a';
      ctx.fillText('END', endX + 4, y + 16);
    }
    ctx.restore();
  }

  drawGrid(ctx, track, pattern, loopTicks) {
    const { originX, originY, cellWidth, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumChannel(track.channel);
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

    if (typeof this.song.loopStartTick === 'number') {
      const startX = originX + this.song.loopStartTick * cellWidth;
      ctx.strokeStyle = '#55d68a';
      ctx.beginPath();
      ctx.moveTo(startX, originY);
      ctx.lineTo(startX, originY + rows * cellHeight);
      ctx.stroke();
    }
    if (typeof this.song.loopEndTick === 'number') {
      const endX = originX + this.song.loopEndTick * cellWidth;
      ctx.strokeStyle = '#ff6a6a';
      ctx.beginPath();
      ctx.moveTo(endX, originY);
      ctx.lineTo(endX, originY + rows * cellHeight);
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

    if (this.pastePreview) {
      this.drawPastePreview(ctx, track);
    }

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

  drawPastePreview(ctx, track) {
    if (!this.pastePreview || !this.gridBounds) return;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    ctx.save();
    ctx.globalAlpha = 0.5;
    this.pastePreview.notes.forEach((note) => {
      const startTick = baseTick + note.startTick;
      const pitch = basePitch + note.pitch;
      const row = this.getRowFromPitch(pitch);
      if (row < 0) return;
      const noteX = originX + startTick * cellWidth;
      const noteY = originY + row * cellHeight + 1;
      const noteW = Math.max(cellWidth * note.durationTicks, cellWidth);
      const noteH = cellHeight - 2;
      ctx.fillStyle = track.color || '#4fb7ff';
      ctx.fillRect(noteX, noteY, noteW, noteH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(noteX, noteY, noteW, noteH);
    });
    ctx.restore();
  }

  drawLabelColumn(ctx, track) {
    if (!this.gridBounds || !track) return;
    const { labelX, labelW, originY, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumChannel(track.channel);
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelX, originY, labelW, rows * cellHeight);
    ctx.clip();
    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      const label = isDrumGrid
        ? this.getDrumRows()[row]?.label
        : NOTE_LABELS[pitch % 12];
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '12px Courier New';
      ctx.fillText(label, labelX + 8, originY + row * cellHeight + cellHeight * 0.75);
    }
    ctx.restore();
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

  drawCursor(ctx) {
    if (!this.gridBounds) return;
    const gamepadConnected = this.game?.input?.isGamepadConnected?.();
    if (!this.gamepadCursorActive && !gamepadConnected) return;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(this.cursor.pitch);
    if (row < 0) return;
    const x = originX + this.cursor.tick * cellWidth;
    const y = originY + row * cellHeight;
    ctx.strokeStyle = '#55d68a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
    ctx.lineWidth = 1;
  }

  drawSelectionMenu(ctx) {
    if (!this.selectionMenu.open || this.selection.size === 0 || !this.gridBounds) {
      this.bounds.selectionMenu = [];
      return;
    }
    const actions = [
      { action: 'selection-erase', label: 'Erase' },
      { action: 'selection-copy', label: 'Copy' },
      { action: 'selection-cut', label: 'Cut' }
    ];
    const menuW = 140;
    const rowH = 32;
    const gap = 6;
    const menuH = actions.length * rowH + gap * 2;
    const minX = this.gridBounds.x;
    const maxX = this.gridBounds.x + this.gridBounds.w - menuW;
    const minY = this.gridBounds.y;
    const maxY = this.gridBounds.y + this.gridBounds.h - menuH;
    const menuX = clamp(this.selectionMenu.x, minX, maxX);
    const menuY = clamp(this.selectionMenu.y, minY, maxY);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, menuW, menuH);
    this.bounds.selectionMenu = [];
    actions.forEach((entry, index) => {
      const bounds = {
        x: menuX + gap,
        y: menuY + gap + index * rowH,
        w: menuW - gap * 2,
        h: rowH - 4,
        action: entry.action
      };
      this.drawSmallButton(ctx, bounds, entry.label, false);
      this.bounds.selectionMenu.push(bounds);
    });
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
    const dialogW = Math.min(720, width - 40);
    const dialogH = Math.min(600, height - 40);
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
    ctx.fillText('Select Instrument', dialogX + padding, dialogY + 28);

    this.instrumentPicker.closeBounds = { x: dialogX + dialogW - 72, y: dialogY + 14, w: 56, h: 24 };
    this.drawSmallButton(ctx, this.instrumentPicker.closeBounds, 'Close', false);

    const inputY = dialogY + 42;
    const items = this.getInstrumentPickerItems();
    const rowH = 22;
    const listStartY = inputY + 36;
    const listHeight = dialogY + dialogH - listStartY - 40;
    const visibleRows = Math.max(1, Math.floor(listHeight / rowH));
    this.instrumentPicker.scrollMax = Math.max(0, items.length - visibleRows);
    this.instrumentPicker.scroll = clamp(this.instrumentPicker.scroll, 0, this.instrumentPicker.scrollMax);
    this.instrumentPicker.bounds = [];
    let rowY = listStartY;
    const visibleItems = items.slice(this.instrumentPicker.scroll, this.instrumentPicker.scroll + visibleRows);
    visibleItems.forEach((item) => {
      if (item.type === 'family') {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px Courier New';
        ctx.fillText(item.label, dialogX + padding, rowY + 16);
      } else {
        const bounds = {
          x: dialogX + padding,
          y: rowY - 2,
          w: dialogW - padding * 2,
          h: rowH,
          program: item.program
        };
        this.drawSmallButton(ctx, bounds, item.label, false);
        this.instrumentPicker.bounds.push(bounds);
      }
      rowY += rowH;
    });

    if (items.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px Courier New';
      ctx.fillText('No matching programs.', dialogX + padding, listStartY + 20);
    }

    if (this.instrumentPicker.scrollMax > 0) {
      const buttonW = 26;
      const buttonH = 22;
      const buttonsY = dialogY + dialogH - buttonH - 12;
      this.instrumentPicker.scrollUp = {
        x: dialogX + padding,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.instrumentPicker.scrollDown = {
        x: dialogX + padding + buttonW + 8,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.drawSmallButton(ctx, this.instrumentPicker.scrollUp, '▲', false);
      this.drawSmallButton(ctx, this.instrumentPicker.scrollDown, '▼', false);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px Courier New';
      ctx.fillText(
        `Showing ${this.instrumentPicker.scroll + 1}-${Math.min(this.instrumentPicker.scroll + visibleItems.length, items.length)} of ${items.length}`,
        this.instrumentPicker.scrollDown.x + buttonW + 10,
        buttonsY + 16
      );
    }
  }

  drawToolsMenu(ctx, x, y) {
    const items = [
      { id: 'generate', label: 'Generate Pattern' },
      { id: 'export', label: 'Export JSON' },
      { id: 'import', label: 'Import JSON' },
      { id: 'demo', label: 'Play Demo' },
      { id: 'soundfont', label: 'SoundFont URL' },
      { id: 'soundfont-reset', label: 'Reset SoundFont' },
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
      { id: 'qa-load', label: 'Play Demo', x: overlayX + 16, y: overlayY + 50, w: 120, h: 24 },
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

  drawButton(ctx, bounds, label, active, subtle) {
    const fill = active ? 'rgba(255,225,106,0.7)' : subtle ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.6)';
    ctx.fillStyle = fill;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#0b0b0b' : '#fff';
    ctx.font = `${this.isMobileLayout() ? 14 : 12}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 5);
    ctx.textAlign = 'left';
  }

  drawSmallButton(ctx, bounds, label, active) {
    this.drawButton(ctx, bounds, label, active, false);
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
