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
  { id: '1', label: '1', divisor: 1 },
  { id: '1/2', label: '1/2', divisor: 2 },
  { id: '1/3', label: '1/3', divisor: 3 },
  { id: '1/4', label: '1/4', divisor: 4 },
  { id: '1/6', label: '1/6', divisor: 6 },
  { id: '1/8', label: '1/8', divisor: 8 },
  { id: '1/16', label: '1/16', divisor: 16 },
  { id: '1/32', label: '1/32', divisor: 32 }
];

const NOTE_LENGTH_OPTIONS = [
  { id: '1', label: '1', icon: 'w', divisor: 1 },
  { id: '1/2', label: '1/2', icon: 'd', divisor: 2 },
  { id: '1/3', label: '1/3', icon: 't', divisor: 3 },
  { id: '1/4', label: '1/4', icon: 'q', divisor: 4 },
  { id: '1/6', label: '1/6', icon: 's', divisor: 6 },
  { id: '1/8', label: '1/8', icon: 'e', divisor: 8 },
  { id: '1/16', label: '1/16', icon: 'x', divisor: 16 },
  { id: '1/32', label: '1/32', icon: 't', divisor: 32 }
];

const SOUNDFONT_CDNS = [
  { id: 'github', label: 'GitHub Pages' },
  { id: 'jsdelivr', label: 'jsDelivr' }
];

const TIME_SIGNATURE_OPTIONS = [
  { id: '3/4', beats: 3, unit: 4 },
  { id: '4/4', beats: 4, unit: 4 },
  { id: '5/4', beats: 5, unit: 4 },
  { id: '6/4', beats: 6, unit: 4 },
  { id: '7/4', beats: 7, unit: 4 }
];

const TAB_OPTIONS = [
  { id: 'grid', label: 'Grid' },
  { id: 'instruments', label: 'Tracks' },
  { id: 'settings', label: 'Settings' }
];

const TOOL_OPTIONS = [
  { id: 'draw', label: 'Draw' }
];

const INSTRUMENT_FAMILY_TABS = [
  { id: 'favorites', label: 'Favorites' },
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
const DEFAULT_VISIBLE_ROWS = 12;
const MIN_VISIBLE_ROWS = 5;
const MAX_VISIBLE_ROWS = 60;
const DEFAULT_GRID_TOP_PITCH = 59;
const DEFAULT_RULER_HEIGHT = 32;
const FILE_MENU_WIDTH = 240;
const DEFAULT_LOOP_BARS = 4;
const SONG_LIBRARY_KEY = 'chainsaw-midi-library';
const CACHED_SOUND_FONT_KEY = 'chainsaw-midi-cached-programs';
const DEFAULT_PRELOAD_PROGRAMS = [0, 24, 32, 52];
const GENRE_OPTIONS = [
  { id: 'random', label: 'Random' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'house', label: 'House' },
  { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'drum-bass', label: 'Drum & Bass' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'rock', label: 'Rock' }
];
const CHORD_PROGRESSION_LIBRARY = [
  {
    theme: 'happy',
    scale: 'major',
    chords: ['C', 'G', 'Am', 'F']
  },
  {
    theme: 'bright',
    scale: 'major',
    chords: ['C', 'F', 'G', 'C']
  },
  {
    theme: 'uplift',
    scale: 'major',
    chords: ['C', 'Am', 'F', 'G']
  },
  {
    theme: 'moody',
    scale: 'minor',
    chords: ['Am', 'F', 'C', 'G']
  },
  {
    theme: 'dark',
    scale: 'minor',
    chords: ['Am', 'G', 'F', 'E']
  }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uid = () => `note-${Math.floor(Math.random() * 1000000)}`;
const findNoteLengthIndex = (id) => {
  const index = NOTE_LENGTH_OPTIONS.findIndex((option) => option.id === id);
  return index >= 0 ? index : 0;
};
const NOTE_NAME_ALIASES = {
  'C#': 1,
  'Db': 1,
  'D#': 3,
  'Eb': 3,
  'F#': 6,
  'Gb': 6,
  'G#': 8,
  'Ab': 8,
  'A#': 10,
  'Bb': 10
};
const isBlackKey = (pitchClass) => [1, 3, 6, 8, 10].includes(pitchClass);
const parseChordToken = (token) => {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const quality = /dim/i.test(trimmed)
    ? 'dim'
    : /m(in)?$/i.test(trimmed) || trimmed === trimmed.toLowerCase()
      ? 'min'
      : 'maj';
  const rootToken = trimmed.replace(/(dim|maj|min|m)$/i, '');
  const normalized = rootToken.length > 1
    ? `${rootToken[0].toUpperCase()}${rootToken[1]}`
    : rootToken.toUpperCase();
  const root = NOTE_NAME_ALIASES[normalized] ?? KEY_LABELS.indexOf(normalized);
  if (root < 0) return null;
  return { root, quality };
};
const parseChordProgressionInput = (input, loopBars) => {
  if (!input) return null;
  const segments = input
    .split(/[\n;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return null;
  const progression = [];
  segments.forEach((segment) => {
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return;
    const rangeToken = tokens[0];
    const [startRaw, endRaw] = rangeToken.split('-').map((value) => parseInt(value, 10));
    const startBar = Number.isInteger(startRaw) ? Math.max(1, startRaw) : 1;
    const endBar = Number.isInteger(endRaw) ? Math.max(startBar, endRaw) : startBar;
    const chords = tokens.slice(1).map(parseChordToken).filter(Boolean);
    if (!chords.length) return;
    const maxBars = Math.max(endBar, loopBars || endBar);
    for (let bar = startBar; bar <= Math.min(endBar, maxBars); bar += 1) {
      const chord = chords[(bar - startBar) % chords.length] || chords[chords.length - 1];
      if (!chord) continue;
      progression.push({
        root: chord.root,
        quality: chord.quality,
        startBar: bar,
        lengthBars: 1
      });
    }
  });
  return progression.length ? progression : null;
};
const formatChordToken = (chord) => {
  if (!chord) return '';
  const name = KEY_LABELS[chord.root] || 'C';
  if (chord.quality === 'min') return `${name}m`;
  if (chord.quality === 'dim') return `${name}dim`;
  return name;
};
const toRgba = (hex, alpha) => {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(255,255,255,${alpha})`;
  }
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const value = parseInt(normalized.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const createDefaultSong = () => ({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 120,
  loopBars: DEFAULT_GRID_BARS,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: false,
  timeSignature: { beats: 4, unit: 4 },
  highContrast: false,
  key: 0,
  scale: 'major',
  chordMode: false,
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
  timeSignature: { beats: 4, unit: 4 },
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
    this.quantizeIndex = findNoteLengthIndex('1/4');
    this.quantizeEnabled = true;
    this.noteLengthIndex = findNoteLengthIndex('1/4');
    this.swing = 0;
    this.previewOnEdit = true;
    this.scrubAudition = false;
    this.metronomeEnabled = false;
    this.scaleLock = false;
    this.slurEnabled = false;
    this.drumAdvanced = false;
    this.activeTab = 'grid';
    this.activeTool = 'draw';
    this.song = this.loadSong();
    this.highContrast = Boolean(this.song?.highContrast);
    this.chordMode = Boolean(this.song?.chordMode);
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
    this.cachedPrograms = new Set(this.loadCachedPrograms());
    this.instrumentPreview = { loading: false, key: null };
    this.instrumentDownload = { loading: false, key: null };
    this.toolsMenuOpen = false;
    this.fileMenuOpen = false;
    this.genreMenuOpen = false;
    this.selectedGenre = 'random';
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
      selectedProgram: null,
      bounds: [],
      favoriteBounds: [],
      sectionBounds: [],
      tabBounds: [],
      tabPrevBounds: null,
      tabNextBounds: null,
      confirmBounds: null,
      cancelBounds: null,
      downloadBounds: null,
      scrollUpBounds: null,
      scrollDownBounds: null,
      scroll: 0,
      scrollMax: 0,
      scrollStep: 0
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
    this.noteLengthMenu = {
      open: false,
      anchor: null
    };
    this.tempoSliderOpen = false;
    this.pastePreview = null;
    this.gridZoomX = null;
    this.gridZoomY = null;
    this.gridOffset = { x: 0, y: 0 };
    this.gridOffsetInitialized = false;
    this.gridGesture = null;
    this.bounds = {
      headerInstrument: null,
      fileButton: null,
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
      instrumentLauncher: null,
      metronome: null,
      timeDisplay: null,
      tempoDown: null,
      tempoUp: null,
      tempoButton: null,
      tempoSlider: null,
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
      soundfontUrl: null,
      soundfontReset: null,
      addTrack: null,
      removeTrack: null,
      duplicateTrack: null,
      instrumentPrev: null,
      instrumentNext: null,
      instrumentLabel: null,
      instrumentAdd: null,
      instrumentList: [],
      instrumentSettingsControls: [],
      selectionMenu: [],
      noteLengthMenu: [],
      pasteAction: null,
      zoomInX: null,
      zoomOutX: null,
      zoomInY: null,
      zoomOutY: null,
      loopStartHandle: null,
      loopEndHandle: null,
      loopShiftStartHandle: null,
      loopShiftEndHandle: null
    };
    this.trackBounds = [];
    this.trackControlBounds = [];
    this.patternBounds = [];
    this.noteBounds = [];
    this.toolsMenuBounds = [];
    this.fileMenuBounds = [];
    this.genreMenuBounds = [];
    this.noteLabelBounds = [];
    this.gridBounds = null;
    this.rulerBounds = null;
    this.gridZoomInitialized = false;
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
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.preloadDefaultInstruments();
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

  loadCachedPrograms() {
    try {
      const stored = JSON.parse(localStorage.getItem(CACHED_SOUND_FONT_KEY));
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  saveCachedPrograms() {
    localStorage.setItem(CACHED_SOUND_FONT_KEY, JSON.stringify(Array.from(this.cachedPrograms)));
  }

  preloadDefaultInstruments() {
    const audio = this.game?.audio;
    if (!audio?.preloadSoundfontProgram) return;
    DEFAULT_PRELOAD_PROGRAMS.forEach((program) => audio.preloadSoundfontProgram(program, 0));
    audio.preloadSoundfontProgram(0, 9);
  }

  persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.song));
  }

  loadSongLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(SONG_LIBRARY_KEY));
      if (!Array.isArray(stored)) return [];
      return stored.filter((entry) => entry && entry.id && entry.song);
    } catch (error) {
      return [];
    }
  }

  saveSongLibrary(library) {
    try {
      localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify(library));
    } catch (error) {
      // ignore
    }
  }

  saveSongToLibrary() {
    const suggested = this.song.name || 'New Song';
    const name = window.prompt('Save song as:', suggested);
    if (!name) return;
    this.song.name = name;
    const library = this.loadSongLibrary();
    const existingIndex = library.findIndex((entry) => entry.name === name);
    const payload = {
      id: existingIndex >= 0 ? library[existingIndex].id : `song-${Date.now()}`,
      name,
      song: JSON.parse(JSON.stringify(this.song))
    };
    if (existingIndex >= 0) {
      library[existingIndex] = payload;
    } else {
      library.unshift(payload);
    }
    this.saveSongLibrary(library);
    this.selection.clear();
    this.persist();
  }

  loadSongFromLibrary() {
    const library = this.loadSongLibrary();
    if (!library.length) {
      window.alert('No saved songs yet.');
      return;
    }
    const names = library.map((entry) => entry.name).join(', ');
    const name = window.prompt(`Load which song?\n${names}`);
    if (!name) return;
    const entry = library.find((item) => item.name === name);
    if (!entry) {
      window.alert('Song not found.');
      return;
    }
    this.applyImportedSong(entry.song);
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
      latencyMs: 30,
      useSoundfont: true,
      soundfontCdn: 'github'
    };
    try {
      const stored = JSON.parse(localStorage.getItem('chainsaw-midi-audio'));
      if (!stored || typeof stored !== 'object') return defaults;
      return {
        masterVolume: typeof stored.masterVolume === 'number' ? stored.masterVolume : defaults.masterVolume,
        reverbEnabled: typeof stored.reverbEnabled === 'boolean' ? stored.reverbEnabled : defaults.reverbEnabled,
        reverbLevel: typeof stored.reverbLevel === 'number' ? stored.reverbLevel : defaults.reverbLevel,
        latencyMs: typeof stored.latencyMs === 'number' ? stored.latencyMs : defaults.latencyMs,
        useSoundfont: typeof stored.useSoundfont === 'boolean' ? stored.useSoundfont : defaults.useSoundfont,
        soundfontCdn: typeof stored.soundfontCdn === 'string' ? stored.soundfontCdn : defaults.soundfontCdn
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
    audio.setSoundfontEnabled?.(this.audioSettings.useSoundfont);
    audio.setSoundfontCdn?.(this.audioSettings.soundfontCdn);
  }

  validateSong(song) {
    if (!song || !Array.isArray(song.tracks)) {
      return { valid: false, error: 'Song must include a track list.' };
    }
    if (typeof song.tempo !== 'number' || typeof song.loopBars !== 'number') {
      return { valid: false, error: 'Song tempo and loop bars must be numbers.' };
    }
    if (song.timeSignature) {
      const beats = song.timeSignature?.beats;
      const unit = song.timeSignature?.unit;
      if (!Number.isInteger(beats) || beats < 1 || beats > 12 || !Number.isInteger(unit)) {
        return { valid: false, error: 'Song time signature must include valid beats and unit values.' };
      }
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
    if (!this.song.timeSignature || typeof this.song.timeSignature !== 'object') {
      this.song.timeSignature = { beats: 4, unit: 4 };
    }
    if (!Number.isInteger(this.song.timeSignature.beats) || this.song.timeSignature.beats < 1) {
      this.song.timeSignature.beats = 4;
    }
    if (!Number.isInteger(this.song.timeSignature.unit) || this.song.timeSignature.unit < 1) {
      this.song.timeSignature.unit = 4;
    }
    if (typeof this.song.highContrast !== 'boolean') {
      this.song.highContrast = false;
    }
    if (!Number.isInteger(this.song.key)) {
      this.song.key = 0;
    }
    if (!SCALE_LIBRARY.find((entry) => entry.id === this.song.scale)) {
      this.song.scale = 'major';
    }
    if (typeof this.song.chordMode !== 'boolean') {
      this.song.chordMode = false;
    }
    if (!this.song.progression) {
      this.song.progression = createDefaultSong().progression;
    }
    this.highContrast = Boolean(this.song.highContrast);
    this.chordMode = Boolean(this.song.chordMode);
    this.beatsPerBar = this.song.timeSignature.beats;
    this.ensureDefaultLoopRegion();
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

  ensureDefaultLoopRegion() {
    if (typeof this.song.loopStartTick === 'number' || typeof this.song.loopEndTick === 'number') return;
    this.song.loopStartTick = 0;
    this.song.loopEndTick = this.getDefaultLoopEndTick();
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    this.song.loopBars = Math.max(this.song.loopBars || 1, Math.ceil(this.song.loopEndTick / ticksPerBar));
  }

  preloadTrackPrograms() {
    const audio = this.game?.audio;
    if (!audio?.ensureGmPlayer) return;
    if (audio.getGmStatus?.().enabled === false) return;
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
    if (familyId === 'favorites') {
      const favorites = this.favoriteInstruments
        .map((program) => GM_PROGRAMS[program])
        .filter(Boolean);
      return favorites.filter((entry) => {
        if (!search) return true;
        const nameMatch = entry.name.toLowerCase().includes(search);
        const numberMatch = formatProgramNumber(entry.program).includes(search);
        return nameMatch || numberMatch;
      });
    }
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
      return `${track.name || 'Track'}: ${this.getDrumKitLabel(track)}`;
    }
    return `${track.name || 'Track'}: ${this.getProgramLabel(track.program)}`;
  }

  getDrumKitLabel(track) {
    if (!track) return 'Drum Kit';
    return `Drum Kit ${formatProgramNumber(track.program)}`;
  }

  getCacheKeyForTrack(track) {
    if (!track) return null;
    return isDrumChannel(track.channel) ? 'drums' : String(track.program);
  }

  getCacheKeyForProgram(program, channel) {
    if (!Number.isInteger(program)) return null;
    return isDrumChannel(channel) ? 'drums' : String(program);
  }

  setPreviewLoading(key, loading) {
    if (!key) return;
    if (!loading && this.instrumentPreview.key !== key) return;
    this.instrumentPreview = { loading, key };
  }

  setDownloadLoading(key, loading) {
    if (!key) return;
    if (!loading && this.instrumentDownload.key !== key) return;
    this.instrumentDownload = { loading, key };
  }

  downloadTrackInstrument(track) {
    if (!track) return;
    this.downloadInstrumentProgram(track.program, track.channel);
  }

  downloadInstrumentProgram(program, channel) {
    const key = this.getCacheKeyForProgram(program, channel);
    if (!key || this.instrumentDownload.loading || this.cachedPrograms.has(key)) return;
    const audio = this.game?.audio;
    if (!audio?.cacheGmProgram) return;
    this.setDownloadLoading(key, true);
    audio.cacheGmProgram(program, channel)
      .then(() => {
        this.cachedPrograms.add(key);
        this.saveCachedPrograms();
      })
      .catch(() => {})
      .finally(() => {
        this.setDownloadLoading(key, false);
      });
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
    const track = this.song.tracks[this.instrumentPicker.trackIndex];
    this.instrumentPicker.selectedProgram = mode === 'add' ? null : track?.program ?? null;
    this.instrumentPicker.familyTab = INSTRUMENT_FAMILY_TABS[0]?.id || 'favorites';
    this.instrumentPicker.bounds = [];
    this.instrumentPicker.favoriteBounds = [];
    this.instrumentPicker.sectionBounds = [];
    this.instrumentPicker.tabBounds = [];
    this.instrumentPicker.tabPrevBounds = null;
    this.instrumentPicker.tabNextBounds = null;
    this.instrumentPicker.confirmBounds = null;
    this.instrumentPicker.cancelBounds = null;
    this.instrumentPicker.downloadBounds = null;
    this.instrumentPicker.scrollUpBounds = null;
    this.instrumentPicker.scrollDownBounds = null;
    this.instrumentPicker.scroll = 0;
    this.instrumentPicker.scrollStep = 0;
  }

  shiftInstrumentPickerTab(delta) {
    const tabs = INSTRUMENT_FAMILY_TABS.map((tab) => tab.id);
    const currentIndex = tabs.indexOf(this.instrumentPicker.familyTab);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + delta + tabs.length) % tabs.length;
    this.instrumentPicker.familyTab = tabs[nextIndex];
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
    this.instrumentPicker.selectedProgram = null;
    this.preloadTrackPrograms();
    this.activeTab = 'grid';
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

  getDefaultLoopEndTick() {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    return ticksPerBar * DEFAULT_LOOP_BARS;
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

  setNoteLengthIndex(index) {
    const total = NOTE_LENGTH_OPTIONS.length;
    const nextIndex = ((index % total) + total) % total;
    this.noteLengthIndex = nextIndex;
    if (this.quantizeOptions.length > 0) {
      this.quantizeIndex = Math.min(nextIndex, this.quantizeOptions.length - 1);
    }
  }

  cycleTimeSignature() {
    const current = this.song.timeSignature || { beats: 4, unit: 4 };
    const currentIndex = TIME_SIGNATURE_OPTIONS.findIndex(
      (option) => option.beats === current.beats && option.unit === current.unit
    );
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % TIME_SIGNATURE_OPTIONS.length
      : 0;
    const next = TIME_SIGNATURE_OPTIONS[nextIndex];
    this.song.timeSignature = { beats: next.beats, unit: next.unit };
    this.beatsPerBar = next.beats;
    this.persist();
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
    const ratio = tick / quantize;
    const snapped = this.isMobileLayout() ? Math.floor(ratio) : Math.round(ratio);
    return snapped * quantize;
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

  setChordMode(enabled) {
    this.chordMode = Boolean(enabled);
    this.song.chordMode = this.chordMode;
    this.persist();
  }

  promptChordProgression() {
    const loopBars = Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS);
    const perBar = [];
    for (let bar = 1; bar <= loopBars; bar += 1) {
      const chord = this.song.progression.find((entry) => bar >= entry.startBar && bar < entry.startBar + entry.lengthBars)
        || this.song.progression[0];
      perBar.push(formatChordToken(chord));
    }
    const suggested = `1-${loopBars} ${perBar.join(' ')}`.trim();
    const input = window.prompt(
      'Enter chord progressions by bar (e.g. "1-4 C C D G; 5-6 D G; 7-9 C D G").',
      suggested
    );
    if (!input) return;
    const progression = parseChordProgressionInput(input, loopBars);
    if (!progression) {
      window.alert('Could not parse chord progression. Try format: 1-4 C C D G');
      return;
    }
    this.song.progression = progression;
    this.persist();
  }

  buildProgressionFromLibrary(loopBars) {
    const template = CHORD_PROGRESSION_LIBRARY[Math.floor(Math.random() * CHORD_PROGRESSION_LIBRARY.length)];
    const chords = template?.chords?.length ? template.chords : ['C', 'F', 'G', 'C'];
    const progression = [];
    for (let bar = 1; bar <= loopBars; bar += 1) {
      const chord = parseChordToken(chords[(bar - 1) % chords.length]) || { root: 0, quality: 'maj' };
      progression.push({
        root: chord.root,
        quality: chord.quality,
        startBar: bar,
        lengthBars: 1
      });
    }
    return {
      progression,
      scale: template?.scale || 'major',
      theme: template?.theme || 'random'
    };
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

    if (this.fileMenuOpen) {
      const fileHit = this.fileMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (fileHit) {
        this.handleFileMenu(fileHit.id);
        return;
      }
      if (this.bounds.fileButton && this.pointInBounds(x, y, this.bounds.fileButton)) {
        this.fileMenuOpen = false;
        return;
      }
      this.fileMenuOpen = false;
    }

    if (this.genreMenuOpen) {
      const genreHit = this.genreMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (genreHit) {
        if (genreHit.id === 'cancel') {
          this.genreMenuOpen = false;
          return;
        }
        this.selectedGenre = genreHit.id;
        this.generatePattern(genreHit.id);
        this.genreMenuOpen = false;
        return;
      }
      this.genreMenuOpen = false;
    }

    const noteLengthHit = this.bounds.noteLengthMenu?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (noteLengthHit) {
      this.setNoteLengthIndex(noteLengthHit.index);
      this.noteLengthMenu.open = false;
      return;
    }
    if (this.tempoSliderOpen && this.bounds.tempoSlider && this.pointInBounds(x, y, this.bounds.tempoSlider)) {
      this.dragState = { mode: 'slider', id: 'song-tempo', bounds: this.bounds.tempoSlider };
      this.updateSliderValue(x, y, 'song-tempo', this.bounds.tempoSlider);
      return;
    }

    const quickMixHit = this.bounds.instrumentSettingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (quickMixHit) {
      this.handleTrackControl(quickMixHit);
      return;
    }

    const tabHit = this.bounds.tabs?.find((tab) => this.pointInBounds(x, y, tab));
    if (tabHit) {
      this.activeTab = tabHit.id;
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }

    if (this.bounds.fileButton && this.pointInBounds(x, y, this.bounds.fileButton)) {
      this.fileMenuOpen = !this.fileMenuOpen;
      this.toolsMenuOpen = false;
      this.genreMenuOpen = false;
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
    if (this.bounds.tempoButton && this.pointInBounds(x, y, this.bounds.tempoButton)) {
      this.tempoSliderOpen = !this.tempoSliderOpen;
      this.noteLengthMenu.open = false;
      return;
    }
    if (this.tempoSliderOpen) {
      this.tempoSliderOpen = false;
    }
    if (this.bounds.noteLength && this.pointInBounds(x, y, this.bounds.noteLength)) {
      this.noteLengthMenu.open = !this.noteLengthMenu.open;
      this.noteLengthMenu.anchor = { ...this.bounds.noteLength };
      this.tempoSliderOpen = false;
      return;
    }
    if (this.noteLengthMenu.open) {
      this.noteLengthMenu.open = false;
    }

    if (this.activeTab === 'instruments') {
      if (this.instrumentPicker.mode) {
        if (this.instrumentPicker.tabPrevBounds && this.pointInBounds(x, y, this.instrumentPicker.tabPrevBounds)) {
          this.shiftInstrumentPickerTab(-1);
          return;
        }
        if (this.instrumentPicker.tabNextBounds && this.pointInBounds(x, y, this.instrumentPicker.tabNextBounds)) {
          this.shiftInstrumentPickerTab(1);
          return;
        }
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
          this.instrumentPicker.selectedProgram = pickHit.program;
          this.previewInstrument(pickHit.program);
          return;
        }
        if (this.instrumentPicker.scrollUpBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollUpBounds)) {
          this.instrumentPicker.scroll = clamp(
            this.instrumentPicker.scroll - Math.max(1, this.instrumentPicker.scrollStep),
            0,
            this.instrumentPicker.scrollMax
          );
          return;
        }
        if (this.instrumentPicker.scrollDownBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollDownBounds)) {
          this.instrumentPicker.scroll = clamp(
            this.instrumentPicker.scroll + Math.max(1, this.instrumentPicker.scrollStep),
            0,
            this.instrumentPicker.scrollMax
          );
          return;
        }
        if (this.instrumentPicker.downloadBounds && this.pointInBounds(x, y, this.instrumentPicker.downloadBounds)) {
          const pickerTrack = this.song.tracks[this.instrumentPicker.trackIndex ?? this.selectedTrackIndex];
          const downloadProgram = Number.isInteger(this.instrumentPicker.selectedProgram)
            ? this.instrumentPicker.selectedProgram
            : pickerTrack?.program;
          this.downloadInstrumentProgram(downloadProgram, pickerTrack?.channel ?? 0);
          return;
        }
        if (this.instrumentPicker.confirmBounds && this.pointInBounds(x, y, this.instrumentPicker.confirmBounds)) {
          if (Number.isInteger(this.instrumentPicker.selectedProgram)) {
            this.applyInstrumentSelection(this.instrumentPicker.selectedProgram);
          }
          return;
        }
        if (this.instrumentPicker.cancelBounds && this.pointInBounds(x, y, this.instrumentPicker.cancelBounds)) {
          this.instrumentPicker.mode = null;
          this.instrumentPicker.selectedProgram = null;
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

      const listHit = this.bounds.instrumentList?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (listHit) {
        this.selectedTrackIndex = listHit.trackIndex;
        this.selection.clear();
        const selectedTrack = this.song.tracks[listHit.trackIndex];
        if (selectedTrack) {
          this.previewInstrument(selectedTrack.program, selectedTrack);
        }
        return;
      }
      if (this.bounds.instrumentAdd && this.pointInBounds(x, y, this.bounds.instrumentAdd)) {
        this.openInstrumentPicker('add', this.selectedTrackIndex);
        return;
      }
      const settingHit = this.bounds.instrumentSettingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (settingHit) {
        this.handleTrackControl(settingHit);
        return;
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
      if (this.bounds.pasteAction && this.pointInBounds(x, y, this.bounds.pasteAction)) {
        this.applyPastePreview();
        return;
      }
      const labelHit = this.noteLabelBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (labelHit) {
        this.auditionPitch(labelHit.pitch);
        return;
      }
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
      if (this.bounds.chordMode && this.pointInBounds(x, y, this.bounds.chordMode)) {
        this.setChordMode(!this.chordMode);
        return;
      }
      if (this.bounds.chordEdit && this.pointInBounds(x, y, this.bounds.chordEdit)) {
        this.promptChordProgression();
        return;
      }
      if (this.bounds.barsMinus && this.pointInBounds(x, y, this.bounds.barsMinus)) {
        this.adjustLoopBars(-1);
        return;
      }
      if (this.bounds.barsPlus && this.pointInBounds(x, y, this.bounds.barsPlus)) {
        this.adjustLoopBars(1);
        return;
      }
      if (this.bounds.zoomOutX && this.pointInBounds(x, y, this.bounds.zoomOutX)) {
        const { minZoom, maxZoom } = this.getGridZoomLimitsX();
        this.gridZoomX = clamp(this.gridZoomX - 0.1, minZoom, maxZoom);
        return;
      }
      if (this.bounds.zoomInX && this.pointInBounds(x, y, this.bounds.zoomInX)) {
        const { minZoom, maxZoom } = this.getGridZoomLimitsX();
        this.gridZoomX = clamp(this.gridZoomX + 0.1, minZoom, maxZoom);
        return;
      }
      if (this.bounds.zoomOutY && this.pointInBounds(x, y, this.bounds.zoomOutY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY - 0.1, minZoom, maxZoom);
        return;
      }
      if (this.bounds.zoomInY && this.pointInBounds(x, y, this.bounds.zoomInY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY + 0.1, minZoom, maxZoom);
        return;
      }
      if (this.bounds.loopStartHandle && this.pointInBounds(x, y, this.bounds.loopStartHandle)) {
        this.dragState = { mode: 'loop-start' };
        this.setLoopStartTick(this.getTickFromX(x));
        return;
      }
      if (this.bounds.loopEndHandle && this.pointInBounds(x, y, this.bounds.loopEndHandle)) {
        this.dragState = { mode: 'loop-end' };
        this.setLoopEndTick(this.getTickFromX(x));
        return;
      }
      if (this.rulerBounds && this.pointInBounds(x, y, this.rulerBounds)) {
        const modifiers = this.getModifiers();
        const tick = this.getTickFromX(x);
        if (this.isNearLoopMarker(x, 'start')) {
          this.dragState = { mode: 'loop-start' };
          this.setLoopStartTick(tick);
          return;
        }
        if (this.isNearLoopMarker(x, 'end')) {
          this.dragState = { mode: 'loop-end' };
          this.setLoopEndTick(tick);
          return;
        }
        if (this.isInsideLoopRegion(x)) {
          this.dragState = {
            mode: 'loop-shift',
            startTick: tick,
            originStart: this.song.loopStartTick,
            originEnd: this.song.loopEndTick
          };
          return;
        }
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
    if (this.dragState.mode === 'touch-pan' || this.dragState.mode === 'pan') {
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
    if (this.dragState.mode === 'loop-start') {
      this.setLoopStartTick(this.getTickFromX(payload.x));
      return;
    }
    if (this.dragState.mode === 'loop-end') {
      this.setLoopEndTick(this.getTickFromX(payload.x));
      return;
    }
    if (this.dragState.mode === 'loop-shift') {
      const tick = this.getTickFromX(payload.x);
      const delta = tick - this.dragState.startTick;
      const start = this.dragState.originStart;
      const end = this.dragState.originEnd;
      if (typeof start === 'number' && typeof end === 'number') {
        this.song.loopStartTick = start;
        this.song.loopEndTick = end;
      }
      this.shiftLoopRegion(delta);
      return;
    }
    if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
    const cell = this.getGridCell(payload.x, payload.y);
    if (!cell) return;
    if (this.dragState.mode === 'paint') {
      this.paintNoteAt(cell.tick, cell.pitch, true);
    } else if (this.dragState.mode === 'pan-or-tap') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.gridOffset.x = this.dragState.startOffsetX + dx;
        this.gridOffset.y = this.dragState.startOffsetY + dy;
        const { gridW, gridH, w, h } = this.gridBounds;
        this.clampGridOffset(w, h, gridW, gridH);
      }
    } else if (this.dragState.mode === 'paste-preview') {
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
    } else if (this.dragState.mode === 'move') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.moveSelectionTo(cell.tick, cell.pitch);
      }
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
    if (this.dragState?.mode === 'touch-pan' || this.dragState?.mode === 'pan') {
      if (!this.dragState.moved) {
        const { cell } = this.dragState;
        if (this.dragState.mode === 'touch-pan' && cell) {
          this.selection.clear();
          this.toggleNoteAt(cell.tick, cell.pitch);
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
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'move') {
      if (!this.dragState.moved && this.dragState.startedSelected && this.dragState.hit?.note) {
        this.deleteNote(this.dragState.hit.note);
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'pan-or-tap') {
      if (!this.dragState.moved && this.dragState.cell) {
        this.toggleNoteAt(this.dragState.cell.tick, this.dragState.cell.pitch);
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

  handleWheel(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.qaOverlayOpen) return;
    if (this.activeTab !== 'grid' || !this.gridBounds) return;
    const inGrid = this.pointInBounds(payload.x, payload.y, this.gridBounds);
    const inRuler = this.rulerBounds && this.pointInBounds(payload.x, payload.y, this.rulerBounds);
    if (!inGrid && !inRuler) return;
    const modifiers = this.getModifiers();
    const delta = payload.deltaY;
    if (modifiers.shift) {
      this.gridOffset.x -= delta;
    } else {
      this.gridOffset.y -= delta;
    }
    this.clampGridOffset(this.gridBounds.w, this.gridBounds.h, this.gridBounds.gridW, this.gridBounds.gridH);
  }

  handleGestureStart(payload) {
    if (!this.gridBounds || this.qaOverlayOpen || this.activeTab !== 'grid') return;
    if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
    this.gridGesture = {
      startDistance: payload.distance,
      startZoomX: this.gridZoomX,
      startZoomY: this.gridZoomY,
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
    const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridGesture.rows || 1);
    const zoomXLimits = this.getGridZoomLimitsX();
    const nextZoomX = clamp(this.gridGesture.startZoomX * scale, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    const nextZoomY = clamp(this.gridGesture.startZoomY * scale, minZoom, maxZoom);
    const baseCellWidth = this.gridGesture.cellWidth / this.gridGesture.startZoomX;
    const baseCellHeight = this.gridGesture.cellHeight / this.gridGesture.startZoomY;
    const nextCellWidth = baseCellWidth * nextZoomX;
    const nextCellHeight = baseCellHeight * nextZoomY;
    const gridCoordX = (this.gridGesture.startX - this.gridGesture.originX) / this.gridGesture.cellWidth;
    const gridCoordY = (this.gridGesture.startY - this.gridGesture.originY) / this.gridGesture.cellHeight;
    const nextOriginX = payload.x - gridCoordX * nextCellWidth;
    const nextOriginY = payload.y - gridCoordY * nextCellHeight;
    this.gridZoomX = nextZoomX;
    this.gridZoomY = nextZoomY;
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
    const modifiers = this.getModifiers();
    if (this.song.loopEnabled && this.bounds.loopShiftStartHandle && this.pointInBounds(x, y, this.bounds.loopShiftStartHandle)) {
      const tick = this.getTickFromX(x);
      this.dragState = {
        mode: 'loop-shift',
        startTick: tick,
        originStart: this.song.loopStartTick,
        originEnd: this.song.loopEndTick
      };
      return;
    }
    if (this.song.loopEnabled && this.bounds.loopShiftEndHandle && this.pointInBounds(x, y, this.bounds.loopShiftEndHandle)) {
      const tick = this.getTickFromX(x);
      this.dragState = {
        mode: 'loop-shift',
        startTick: tick,
        originStart: this.song.loopStartTick,
        originEnd: this.song.loopEndTick
      };
      return;
    }
    if (this.song.loopEnabled && this.isNearLoopMarker(x, 'start')) {
      this.dragState = { mode: 'loop-start' };
      this.setLoopStartTick(this.getTickFromX(x));
      return;
    }
    if (this.song.loopEnabled && this.isNearLoopMarker(x, 'end')) {
      this.dragState = { mode: 'loop-end' };
      this.setLoopEndTick(this.getTickFromX(x));
      return;
    }
    const hit = this.getNoteHitAt(x, y);
    const cell = this.getGridCell(x, y);
    if (!cell && !hit) return;
    if ((payload.touchCount && !hit) || modifiers.alt || payload.button === 1 || payload.button === 2) {
      if (!cell) return;
      this.dragState = {
        mode: payload.touchCount ? 'touch-pan' : 'pan',
        startX: x,
        startY: y,
        startOffsetX: this.gridOffset.x,
        startOffsetY: this.gridOffset.y,
        moved: false,
        cell,
        hit
      };
      if (payload.touchCount) {
        this.longPressTimer = window.setTimeout(() => {
          const heldCell = this.getGridCell(this.lastPointer.x, this.lastPointer.y);
          if (!heldCell) return;
          const heldNote = this.getNoteHitAt(this.lastPointer.x, this.lastPointer.y);
          if (heldNote) {
            this.selection.add(heldNote.note.id);
          }
          if (navigator?.vibrate) {
            navigator.vibrate(20);
          }
          this.dragState = {
            mode: 'select',
            startX: this.lastPointer.x,
            startY: this.lastPointer.y,
            currentX: this.lastPointer.x,
            currentY: this.lastPointer.y,
            appendSelection: this.selection.size > 0 || Boolean(heldNote)
          };
        }, 450);
      }
      return;
    }
    if (this.pastePreview) {
      if (!cell) return;
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
      this.dragState = { mode: 'paste-preview' };
      return;
    }
    if (hit) {
      if (modifiers.meta) {
        this.toggleSelection(hit.note.id);
        return;
      }
      const startedSelected = this.selection.has(hit.note.id);
      if (!startedSelected) {
        this.selection.clear();
        this.selection.add(hit.note.id);
      }
      if (hit.edge) {
        this.dragState = {
          mode: 'resize',
          edge: hit.edge,
          originalNotes: this.getSelectedNotes().map((note) => ({ ...note }))
        };
        return;
      }
      if (!cell) return;
      if (modifiers.shift) {
        this.duplicateSelection();
      }
      this.dragState = {
        mode: 'move',
        startTick: cell.tick,
        startPitch: cell.pitch,
        startX: x,
        startY: y,
        moved: false,
        cell,
        hit,
        startedSelected,
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
      mode: 'pan-or-tap',
      startX: x,
      startY: y,
      startOffsetX: this.gridOffset.x,
      startOffsetY: this.gridOffset.y,
      currentX: x,
      currentY: y,
      cell,
      moved: false
    };
  }

  toggleNoteAt(tick, pitch) {
    if (this.selectionMenu.open) {
      this.closeSelectionMenu();
    }
    const pattern = this.getActivePattern();
    if (!pattern) return;
    const snappedTick = this.snapTick(tick);
    const snappedPitch = this.snapPitchToScale(pitch);
    const existingIndex = pattern.notes.findIndex(
      (note) => note.startTick === snappedTick && note.pitch === snappedPitch
    );
    if (existingIndex >= 0) {
      const [removed] = pattern.notes.splice(existingIndex, 1);
      if (removed) {
        this.selection.delete(removed.id);
      }
      this.persist();
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
    if (!this.dragState.appendSelection) {
      this.selection.clear();
    }
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
    if (!this.clipboard) return;
    if (!this.pastePreview) {
      this.beginPastePreview();
    }
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

  auditionPitch(pitch) {
    const now = performance.now();
    if (now - this.lastAuditionTime < 90) return;
    this.lastAuditionTime = now;
    const track = this.getActiveTrack();
    if (!track) return;
    this.playGmNote(pitch, 0.4, track.volume, track);
  }

  previewInstrument(program, trackOverride = null) {
    if (!Number.isInteger(program)) return;
    const now = performance.now();
    if (now - this.lastAuditionTime < 120) return;
    this.lastAuditionTime = now;
    const track = trackOverride || this.getActiveTrack();
    const volume = track?.volume ?? 0.8;
    const isDrum = isDrumChannel(track?.channel);
    const channel = track?.channel ?? 0;
    const key = isDrum ? 'drums' : String(program);
    const audio = this.game?.audio;
    if (audio?.loadGmProgram) {
      const loadPromise = isDrum ? audio.loadGmDrumKit?.() : audio.loadGmProgram(program);
      if (loadPromise?.finally) {
        this.setPreviewLoading(key, true);
        loadPromise.finally(() => this.setPreviewLoading(key, false));
      }
    }
    const sequence = isDrum
      ? [36, 42, 38, 36]
      : [60, 65, 67, 72];
    const baseVolume = Math.min(1, volume + 0.1);
    sequence.forEach((pitch, index) => {
      window.setTimeout(() => {
        this.playGmNote(pitch, 0.45, baseVolume, {
          program,
          channel,
          bankMSB: DEFAULT_BANK_MSB,
          bankLSB: DEFAULT_BANK_LSB
        });
      }, index * 160);
    });
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
    this.song.loopBars = Math.max(1, Math.ceil(snapped / ticksPerBar));
    this.song.tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = this.song.loopBars;
      });
    });
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
    if (typeof this.song.loopEndTick !== 'number') {
      this.song.loopStartTick = 0;
      this.song.loopEndTick = this.getDefaultLoopEndTick();
      this.song.loopEnabled = true;
      this.ensureGridCapacity(this.song.loopEndTick);
      this.persist();
      return;
    }
    this.song.loopEnabled = !this.song.loopEnabled;
    this.persist();
  }

  adjustLoopBars(delta) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    if (typeof this.song.loopEndTick === 'number') {
      const nextEnd = Math.max(ticksPerBar, this.song.loopEndTick + delta * ticksPerBar);
      this.song.loopEndTick = nextEnd;
      this.song.loopBars = Math.max(1, Math.ceil(nextEnd / ticksPerBar));
      this.song.tracks.forEach((track) => {
        track.patterns.forEach((pattern) => {
          pattern.bars = this.song.loopBars;
        });
      });
      this.ensureGridCapacity(nextEnd);
      this.persist();
      return;
    }
    this.song.loopBars = Math.max(1, this.song.loopBars + delta);
    this.song.tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = this.song.loopBars;
      });
    });
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
    } else if (hit.control === 'remove') {
      this.removeTrack();
      return;
    } else if (hit.control === 'instrument') {
      if (isDrumChannel(track.channel)) {
        this.instrumentPicker.familyTab = 'drums-perc';
      }
      this.openInstrumentPicker('edit', hit.trackIndex);
      return;
    } else if (hit.control === 'download') {
      this.downloadTrackInstrument(track);
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
    if (control.id === 'audio-soundfont-toggle') {
      this.audioSettings.useSoundfont = !this.audioSettings.useSoundfont;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-soundfont-cdn') {
      const currentIndex = SOUNDFONT_CDNS.findIndex((entry) => entry.id === this.audioSettings.soundfontCdn);
      const nextIndex = (currentIndex + 1) % SOUNDFONT_CDNS.length;
      this.audioSettings.soundfontCdn = SOUNDFONT_CDNS[nextIndex].id;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-soundfont-preload') {
      const track = this.getActiveTrack();
      if (!track) return;
      this.game?.audio?.preloadSoundfontProgram?.(track.program, track.channel);
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
    if (control.id === 'grid-chord-mode') {
      this.setChordMode(!this.chordMode);
      return;
    }
    if (control.id === 'grid-chord-progression') {
      this.promptChordProgression();
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
      this.setNoteLengthIndex(this.noteLengthIndex + 1);
      return;
    }
    if (control.id === 'grid-time-signature') {
      this.cycleTimeSignature();
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
      const tempo = Math.round(40 + ratio * 200);
      this.setTempo(Math.round(tempo / 5) * 5);
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
      this.genreMenuOpen = true;
      this.toolsMenuOpen = false;
      return;
    }
    if (action === 'export') {
      this.exportSong();
    }
    if (action === 'import') {
      this.importSong();
    }
    if (action === 'qa') {
      this.qaOverlayOpen = true;
      this.toolsMenuOpen = false;
    }
    if (action === 'demo') {
      this.loadDemoSong();
    }
    if (action === 'soundfont') {
      const currentIndex = SOUNDFONT_CDNS.findIndex((entry) => entry.id === this.audioSettings.soundfontCdn);
      const nextIndex = (currentIndex + 1) % SOUNDFONT_CDNS.length;
      this.audioSettings.soundfontCdn = SOUNDFONT_CDNS[nextIndex].id;
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.toolsMenuOpen = false;
    }
    if (action === 'soundfont-reset') {
      this.audioSettings.soundfontCdn = 'github';
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.toolsMenuOpen = false;
    }
  }

  handleFileMenu(action) {
    if (action === 'new') {
      this.song = createDefaultSong();
      this.ensureState();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'save') {
      this.saveSongToLibrary();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'load') {
      this.loadSongFromLibrary();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'export') {
      this.exportSong();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'import') {
      this.importSong();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'theme') {
      this.generateTheme();
      this.fileMenuOpen = false;
      return;
    }
    if (action === 'sample') {
      this.loadDemoSong();
      this.fileMenuOpen = false;
    }
  }

  generateTheme() {
    const scaleOptions = SCALE_LIBRARY.map((entry) => entry.id);
    const scale = scaleOptions[Math.floor(Math.random() * scaleOptions.length)] || 'minor';
    const key = Math.floor(Math.random() * 12);
    const templates = scale === 'major'
      ? [
        [
          { root: 0, quality: 'maj' },
          { root: 5, quality: 'maj' },
          { root: 7, quality: 'maj' },
          { root: 3, quality: 'maj' }
        ],
        [
          { root: 0, quality: 'maj' },
          { root: 9, quality: 'min' },
          { root: 5, quality: 'maj' },
          { root: 7, quality: 'maj' }
        ]
      ]
      : [
        [
          { root: 0, quality: 'min' },
          { root: 5, quality: 'min' },
          { root: 7, quality: 'maj' },
          { root: 3, quality: 'maj' }
        ],
        [
          { root: 0, quality: 'min' },
          { root: 3, quality: 'maj' },
          { root: 7, quality: 'maj' },
          { root: 5, quality: 'min' }
        ]
      ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    this.song.key = key;
    this.song.scale = scale;
    this.song.progression = template.map((entry, index) => ({
      root: entry.root,
      quality: entry.quality,
      startBar: index + 1,
      lengthBars: 1
    }));
    this.persist();
  }

  generatePattern(genre = this.selectedGenre) {
    const style = genre || 'random';
    const resolvedStyle = style === 'random'
      ? GENRE_OPTIONS[Math.floor(Math.random() * (GENRE_OPTIONS.length - 1)) + 1]?.id || 'ambient'
      : style;
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const loopBars = Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS);
    const theme = this.buildProgressionFromLibrary(loopBars);
    this.song.progression = theme.progression;
    this.song.scale = theme.scale;
    this.song.key = 0;

    this.song.tracks.forEach((track) => {
      const pattern = track.patterns[this.selectedPatternIndex];
      if (!pattern) return;
      pattern.notes = [];
      if (isDrumChannel(track.channel)) {
        const kick = 36;
        const snare = 38;
        const hat = 42;
        const crash = 49;
        const eighth = Math.max(1, Math.round(ticksPerBar / 8));
        for (let bar = 0; bar < loopBars; bar += 1) {
          const base = bar * ticksPerBar;
          const isFinalBar = bar === loopBars - 1;
          if (isFinalBar) {
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: crash, velocity: 0.85 });
            for (let beat = 1; beat < this.beatsPerBar; beat += 1) {
              pattern.notes.push({
                id: uid(),
                startTick: base + beat * this.ticksPerBeat,
                durationTicks: 2,
                pitch: snare,
                velocity: 0.9
              });
            }
          } else {
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat * 2, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat, durationTicks: 2, pitch: snare, velocity: 0.9 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat * 3, durationTicks: 2, pitch: snare, velocity: 0.9 });
          }
          for (let step = 0; step < this.beatsPerBar * 2; step += 1) {
            pattern.notes.push({
              id: uid(),
              startTick: base + step * eighth,
              durationTicks: 1,
              pitch: hat,
              velocity: 0.55
            });
          }
        }
        return;
      }

      const isBass = /bass/i.test(track.name || '');
      const basePitch = isBass ? 36 : resolvedStyle === 'hip-hop' ? 48 : 60;
      for (let bar = 0; bar < loopBars; bar += 1) {
        const chord = this.getChordForTick(bar * ticksPerBar);
        const chordRoot = chord?.root ?? 0;
        const chordTones = this.getChordTones({ ...chord, root: chordRoot });
        const barStart = bar * ticksPerBar;
        if (isBass) {
          const step = Math.random() > 0.5 ? this.ticksPerBeat : Math.max(1, Math.round(this.ticksPerBeat / 2));
          for (let tick = barStart; tick < barStart + ticksPerBar; tick += step) {
            pattern.notes.push({
              id: uid(),
              startTick: tick,
              durationTicks: step,
              pitch: basePitch + chordRoot,
              velocity: 0.8
            });
          }
        } else {
          const eighth = Math.max(1, Math.round(ticksPerBar / 8));
          const patternSteps = [0, 2, 4, 6, 7];
          patternSteps.forEach((stepIndex, index) => {
            const pitchClass = chordTones[index % chordTones.length] ?? chordRoot;
            pattern.notes.push({
              id: uid(),
              startTick: barStart + stepIndex * eighth,
              durationTicks: eighth,
              pitch: basePitch + pitchClass + (index > 2 ? 12 : 0),
              velocity: 0.75
            });
          });
        }
      }
    });
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

  importSong() {
    if (this.fileInput) {
      this.fileInput.click();
    }
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
    this.gridOffsetInitialized = false;
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.persist();
  }

  loadDemoSong() {
    this.song = createDemoSong();
    this.ensureState();
    this.gridOffsetInitialized = false;
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
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

  getBaseVisibleRows(rows) {
    return Math.max(1, Math.min(DEFAULT_VISIBLE_ROWS, rows));
  }

  initializeGridOffset(track, rows, cellHeight) {
    if (this.gridOffsetInitialized) return;
    this.gridOffsetInitialized = true;
    if (!track || isDrumChannel(track.channel)) {
      this.gridOffset.y = 0;
      return;
    }
    const topRow = clamp(this.getRowFromPitch(DEFAULT_GRID_TOP_PITCH), 0, Math.max(0, rows - 1));
    this.gridOffset.y = -topRow * cellHeight;
  }

  getDefaultGridZoomX() {
    const bars = Math.max(1, this.song?.loopBars || DEFAULT_GRID_BARS);
    return Math.max(1, bars / 4);
  }

  getDefaultGridZoomY() {
    return 1;
  }

  getOctaveLabel(pitch) {
    return Math.floor(pitch / 12) - 1;
  }

  getGridZoomLimits(rows) {
    const baseVisibleRows = this.getBaseVisibleRows(rows);
    const maxVisibleRows = Math.min(rows, MAX_VISIBLE_ROWS);
    const minZoom = maxVisibleRows > 0 ? baseVisibleRows / maxVisibleRows : 1;
    const maxZoom = baseVisibleRows / MIN_VISIBLE_ROWS;
    return {
      minZoom: clamp(minZoom, 0.2, 1),
      maxZoom: Math.max(1, maxZoom)
    };
  }

  getGridZoomLimitsX() {
    const bars = Math.max(1, this.song?.loopBars || DEFAULT_GRID_BARS);
    return {
      minZoom: 1,
      maxZoom: Math.max(1, bars)
    };
  }

  getPitchRange() {
    const track = this.getActiveTrack();
    if (isDrumChannel(track?.channel)) {
      const pitches = this.getDrumRows().map((row) => row.pitch);
      return { min: Math.min(...pitches), max: Math.max(...pitches) };
    }
    return { min: 36, max: 83 };
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

  isNearLoopMarker(x, marker) {
    if (!this.gridBounds) return false;
    const tick = marker === 'start' ? this.song.loopStartTick : this.song.loopEndTick;
    if (typeof tick !== 'number') return false;
    const markerX = this.gridBounds.originX + tick * this.gridBounds.cellWidth;
    const threshold = Math.max(6, this.gridBounds.cellWidth * 0.35);
    return Math.abs(x - markerX) <= threshold;
  }

  isInsideLoopRegion(x) {
    if (!this.gridBounds) return false;
    if (!this.song.loopEnabled) return false;
    if (typeof this.song.loopStartTick !== 'number' || typeof this.song.loopEndTick !== 'number') return false;
    const startX = this.gridBounds.originX + this.song.loopStartTick * this.gridBounds.cellWidth;
    const endX = this.gridBounds.originX + this.song.loopEndTick * this.gridBounds.cellWidth;
    return x > Math.min(startX, endX) && x < Math.max(startX, endX);
  }

  shiftLoopRegion(deltaTicks) {
    if (typeof this.song.loopStartTick !== 'number' || typeof this.song.loopEndTick !== 'number') return;
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const loopLength = Math.max(1, this.song.loopEndTick - this.song.loopStartTick);
    const gridTicks = Math.max(this.song.loopBars * ticksPerBar, this.song.loopEndTick);
    const maxStart = Math.max(0, gridTicks - loopLength);
    const nextStart = clamp(this.song.loopStartTick + deltaTicks, 0, maxStart);
    const nextEnd = nextStart + loopLength;
    this.song.loopStartTick = nextStart;
    this.song.loopEndTick = nextEnd;
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.persist();
  }

  getNoteHitAt(x, y) {
    if (!this.gridBounds) return null;
    const pattern = this.getActivePattern();
    if (!pattern) return null;
    let handleHit = null;
    let bodyHit = null;
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      if (y < rect.y || y > rect.y + rect.h) return;
      const handleWidth = this.getNoteHandleWidth(rect);
      if (x >= rect.x - handleWidth && x <= rect.x) {
        handleHit = { note, edge: 'start' };
        return;
      }
      if (x >= rect.x + rect.w && x <= rect.x + rect.w + handleWidth) {
        handleHit = { note, edge: 'end' };
        return;
      }
      if (x >= rect.x && x <= rect.x + rect.w) {
        bodyHit = { note, edge: null };
      }
    });
    return handleHit || bodyHit;
  }

  getNoteAtCell(tick, pitch, pointerX = null) {
    const pattern = this.getActivePattern();
    if (!pattern) return null;
    const hit = pattern.notes.find((note) => tick >= note.startTick && tick < note.startTick + note.durationTicks && note.pitch === pitch);
    if (!hit) return null;
    const rect = this.getNoteRect(hit);
    if (!rect) return null;
    const handleWidth = this.getNoteHandleWidth(rect);
    const handleSize = Math.max(6, Math.min(handleWidth, rect.w / 2));
    const cursorX = typeof pointerX === 'number' ? pointerX : this.lastPointer.x;
    const isStartEdge = cursorX <= rect.x + handleSize;
    const isEndEdge = cursorX >= rect.x + rect.w - handleSize;
    return { note: hit, edge: isStartEdge ? 'start' : isEndEdge ? 'end' : null };
  }

  getNoteHandleWidth(rect) {
    return Math.max(16, Math.min(36, Math.round(rect.h * 1.4)));
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
    this.bounds.tempoButton = null;
    this.bounds.tempoSlider = null;
    this.bounds.noteLengthMenu = [];

    const isMobile = this.isMobileLayout();
    if (isMobile) {
      this.drawMobileLayout(ctx, width, height, track, pattern);
    } else {
      const padding = 16;
      const headerH = 40;
      const tabsH = 44;
      const transportH = 96;
      const headerY = padding;
      const tabsX = padding;
      const tabsY = headerY + headerH + 8;
      const tabsW = width - padding * 2;
      this.drawHeader(ctx, padding, headerY, tabsW, headerH, track);
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
    }

    this.drawNoteLengthMenu(ctx, width, height);
    this.drawTempoSlider(ctx, width, height);

    if (this.fileMenuOpen && this.bounds.fileButton) {
      const panelPadding = this.isMobileLayout() ? 10 : 16;
      const menuX = Math.max(panelPadding, width - FILE_MENU_WIDTH - panelPadding);
      const menuY = this.bounds.fileButton.y + this.bounds.fileButton.h + 6;
      this.drawFileMenu(ctx, menuX, menuY);
    }

    if (this.genreMenuOpen) {
      this.drawGenreMenu(ctx, width, height);
    }

    if (this.qaOverlayOpen) {
      this.drawQaOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  drawMobileLayout(ctx, width, height, track, pattern) {
    const padding = 10;
    const gap = 10;
    const sidebarW = Math.min(280, Math.max(200, width * 0.38));
    const sidebarX = padding;
    const sidebarY = padding;
    const sidebarH = height - padding * 2;
    const contentX = sidebarX + sidebarW + gap;
    const contentY = padding;
    const contentW = width - contentX - padding;
    const contentH = height - padding * 2;

    this.drawMobileSidebar(ctx, sidebarX, sidebarY, sidebarW, sidebarH, track);

    if (this.activeTab === 'grid') {
      this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);
      this.drawGridZoomControls(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'instruments') {
      this.drawInstrumentPanel(ctx, contentX, contentY, contentW, contentH, track);
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
    }
  }

  drawMobileSidebar(ctx, x, y, w, h, track) {
    const panelGap = 10;
    const rowH = 38;
    const rowGap = 8;
    const panelPadding = 10;
    const menuRows = TAB_OPTIONS.length + 1;
    const menuH = Math.min(h * 0.46, menuRows * rowH + (menuRows - 1) * rowGap + panelPadding * 2);
    const menuX = x;
    const menuY = y;
    const controlsX = x;
    const controlsY = y + menuH + panelGap;
    const controlsH = Math.max(0, h - menuH - panelGap);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(menuX, menuY, w, menuH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, w, menuH);

    const innerX = menuX + panelPadding;
    const innerW = w - panelPadding * 2;
    let cursorY = menuY + panelPadding;
    this.bounds.tabs = [];
    this.bounds.fileButton = { x: innerX, y: cursorY, w: innerW, h: rowH };
    this.drawButton(ctx, this.bounds.fileButton, 'File', this.fileMenuOpen, false);
    cursorY += rowH + rowGap;

    TAB_OPTIONS.forEach((tab) => {
      const bounds = { x: innerX, y: cursorY, w: innerW, h: rowH, id: tab.id };
      this.bounds.tabs.push(bounds);
      this.drawButton(ctx, bounds, tab.label, this.activeTab === tab.id, false);
      cursorY += rowH + rowGap;
    });

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(controlsX, controlsY, w, controlsH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(controlsX, controlsY, w, controlsH);

    const controlX = controlsX + panelPadding;
    const controlW = w - panelPadding * 2;
    let controlY = controlsY + panelPadding;
    this.bounds.instrumentSettingsControls = [];
    const buttonSize = rowH;
    const compactLayout = controlW < 220;
    const noteW = compactLayout ? controlW : Math.min(110, Math.max(76, controlW * 0.45));
    const selectorW = controlW - buttonSize * 2;
    const selectorX = controlX + buttonSize;
    const trackName = track?.name || 'Track';
    const instrumentName = track
      ? isDrumChannel(track.channel)
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program)
      : 'Instrument';

    this.bounds.instrumentPrev = { x: controlX, y: controlY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentPrev, '<', false);
    this.bounds.instrumentNext = {
      x: controlX + controlW - buttonSize,
      y: controlY,
      w: buttonSize,
      h: rowH
    };
    this.drawSmallButton(ctx, this.bounds.instrumentNext, '>', false);
    this.bounds.instrumentLabel = {
      x: selectorX + rowGap,
      y: controlY,
      w: selectorW - rowGap * 2,
      h: rowH
    };
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    const clippedName = this.truncateLabel(ctx, trackName, this.bounds.instrumentLabel.w - 8);
    ctx.fillText(clippedName, this.bounds.instrumentLabel.x + this.bounds.instrumentLabel.w / 2, controlY + 16);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '10px Courier New';
    const clippedInstrument = this.truncateLabel(ctx, instrumentName, this.bounds.instrumentLabel.w - 8);
    ctx.fillText(clippedInstrument, this.bounds.instrumentLabel.x + this.bounds.instrumentLabel.w / 2, controlY + 30);
    ctx.textAlign = 'left';
    controlY += rowH + rowGap;

    if (track) {
      const mixH = 90;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(controlX, controlY, controlW, mixH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(controlX, controlY, controlW, mixH);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText('Mix Controls', controlX + 8, controlY + 14);

      const buttonH = 22;
      const muteBounds = {
        x: controlX + 8,
        y: controlY + 20,
        w: 60,
        h: buttonH,
        trackIndex: this.selectedTrackIndex,
        control: 'mute'
      };
      const soloBounds = {
        x: muteBounds.x + 70,
        y: muteBounds.y,
        w: 60,
        h: buttonH,
        trackIndex: this.selectedTrackIndex,
        control: 'solo'
      };
      this.drawSmallButton(ctx, muteBounds, 'Mute', track.mute);
      this.drawSmallButton(ctx, soloBounds, 'Solo', track.solo);
      this.bounds.instrumentSettingsControls.push(muteBounds, soloBounds);

      const sliderW = controlW - 16;
      const volumeBounds = {
        x: controlX + 8,
        y: muteBounds.y + buttonH + 8,
        w: sliderW,
        h: 12,
        trackIndex: this.selectedTrackIndex,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * track.volume, volumeBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Courier New';
      ctx.fillText('Volume', volumeBounds.x, volumeBounds.y - 4);
      this.bounds.instrumentSettingsControls.push(volumeBounds);

      const panBounds = {
        x: controlX + 8,
        y: volumeBounds.y + volumeBounds.h + 16,
        w: sliderW,
        h: 10,
        trackIndex: this.selectedTrackIndex,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((track.pan + 1) / 2), panBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Courier New';
      ctx.fillText('Pan', panBounds.x, panBounds.y - 4);
      this.bounds.instrumentSettingsControls.push(panBounds);

      controlY += mixH + rowGap;
    }

    const noteLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    this.bounds.noteLength = { x: controlX, y: controlY, w: noteW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLabel, false);
    controlY += rowH + rowGap;
    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    this.bounds.tempoButton = { x: controlX, y: controlY, w: controlW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
    const transportGap = 6;
    const transportW = (controlW - transportGap * 4) / 5;
    const transportButtons = [
      { id: 'returnStart', label: '⏮' },
      { id: 'prevBar', label: '⏪' },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶' },
      { id: 'nextBar', label: '⏩' },
      { id: 'goEnd', label: '⏭' }
    ];
    const transportY = controlsY + controlsH - panelPadding - rowH;
    const toggleRowY = transportY - rowGap - rowH;
    const toggleW = Math.max(90, (controlW - rowGap) / 2);
    this.bounds.loopToggle = { x: controlX, y: toggleRowY, w: toggleW, h: rowH };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);
    this.bounds.metronome = { x: controlX + toggleW + rowGap, y: toggleRowY, w: toggleW, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    transportButtons.forEach((button, index) => {
      const bounds = {
        x: controlX + index * (transportW + transportGap),
        y: transportY,
        w: transportW,
        h: rowH
      };
      this.bounds[button.id] = bounds;
      this.drawSmallButton(ctx, bounds, button.label, button.id === 'play' && this.isPlaying);
    });
  }

  truncateLabel(ctx, label, maxWidth) {
    if (ctx.measureText(label).width <= maxWidth) return label;
    let truncated = label;
    while (truncated.length > 4 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  getNoteLengthDisplay(option, includeLabel = false) {
    if (!option) return '';
    const icon = option.icon || option.label;
    if (includeLabel && option.label && option.label !== icon) {
      return `${icon} ${option.label}`;
    }
    return icon;
  }

  drawHeader(ctx, x, y, w, h, track) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const padding = 12;
    const gmStatus = this.game?.audio?.getGmStatus?.();
    if (gmStatus) {
      const statusText = !gmStatus.enabled
        ? 'SoundFont Off'
        : gmStatus.error
          ? 'SoundFont Error'
          : gmStatus.loading
            ? 'Loading SoundFont…'
            : 'SoundFont Ready';
      ctx.fillStyle = gmStatus.error ? '#ff6a6a' : 'rgba(255,255,255,0.6)';
      ctx.font = '12px Courier New';
      ctx.fillText(statusText, x + padding, y + padding + 12);
    }
  }

  drawTabs(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    const gap = 6;
    const isMobile = this.isMobileLayout();
    const fileW = isMobile ? 72 : 80;
    const tabsW = w - fileW - gap;
    const tabW = (tabsW - gap * (TAB_OPTIONS.length - 1)) / TAB_OPTIONS.length;
    this.bounds.tabs = [];
    this.bounds.fileButton = { x, y, w: fileW, h };
    this.drawButton(ctx, this.bounds.fileButton, 'File', this.fileMenuOpen, false);
    let cursorX = x + fileW + gap;
    TAB_OPTIONS.forEach((tab, index) => {
      const tabX = cursorX + index * (tabW + gap);
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
    const gap = 12;
    const buttonH = Math.max(48, h - 26);
    const baseButtonW = Math.min(72, (w - gap * 7) / 6);
    const buttonSpecs = [
      { id: 'returnStart', label: '⏮', w: baseButtonW },
      { id: 'prevBar', label: '⏪', w: baseButtonW },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', w: baseButtonW * 1.3, active: this.isPlaying, emphasis: true },
      { id: 'nextBar', label: '⏩', w: baseButtonW },
      { id: 'goEnd', label: '⏭', w: baseButtonW }
    ];
    const totalW = buttonSpecs.reduce((sum, button) => sum + button.w, 0) + gap * (buttonSpecs.length - 1);
    const startX = x + (w - totalW) / 2;
    const centerY = y + (h - buttonH) / 2;
    const radius = Math.min(14, buttonH / 2);
    const drawRoundedRect = (bx, by, bw, bh) => {
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, radius);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, radius);
      ctx.arcTo(bx, by + bh, bx, by, radius);
      ctx.arcTo(bx, by, bx + bw, by, radius);
      ctx.closePath();
    };
    const drawTransportButton = (button, bx) => {
      const bounds = { x: bx, y: centerY, w: button.w, h: buttonH };
      this.bounds[button.id] = bounds;
      const isActive = Boolean(button.active);
      const baseFill = isActive ? '#ffe16a' : 'rgba(10,10,10,0.7)';
      const highlight = button.emphasis ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.12)';
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      drawRoundedRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.fillStyle = baseFill;
      ctx.fill();
      ctx.shadowBlur = 0;
      drawRoundedRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      drawRoundedRect(bounds.x + 1, bounds.y + 1, bounds.w - 2, bounds.h / 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = isActive ? '#0b0b0b' : '#fff';
      ctx.font = `${button.emphasis ? 20 : 16}px Courier New`;
      ctx.textAlign = 'center';
      ctx.fillText(button.label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 6);
      ctx.textAlign = 'left';
    };
    let cursorX = startX;
    buttonSpecs.forEach((button) => {
      drawTransportButton(button, cursorX);
      cursorX += button.w + gap;
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
    this.drawGridZoomControls(ctx, x, gridY, w, gridH);
  }

  drawGridControls(ctx, x, y, w, track) {
    const rowH = 44;
    const gap = 8;
    const buttonSize = rowH;
    let cursorX = x;
    ctx.font = '13px Courier New';
    const label = track
      ? isDrumChannel(track.channel)
        ? `[${this.getDrumKitLabel(track)}]`
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
    cursorX += buttonSize + gap * 2;

    const noteLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    const noteW = Math.min(160, Math.max(120, ctx.measureText(noteLabel).width + 28));
    this.bounds.noteLength = { x: cursorX, y, w: noteW, h: rowH };
    this.drawButton(ctx, this.bounds.noteLength, noteLabel, false, false);
    const row2Y = y + rowH + gap;
    let row2X = x;
    const chordLabel = this.chordMode ? 'Chord Mode' : 'Piano Mode';
    const chordW = Math.min(180, Math.max(140, ctx.measureText(chordLabel).width + 28));
    this.bounds.chordMode = { x: row2X, y: row2Y, w: chordW, h: rowH };
    this.drawButton(ctx, this.bounds.chordMode, chordLabel, this.chordMode, false);
    row2X += chordW + gap;

    const editLabel = 'Edit Chords';
    const editW = Math.min(150, Math.max(120, ctx.measureText(editLabel).width + 28));
    this.bounds.chordEdit = { x: row2X, y: row2Y, w: editW, h: rowH };
    this.drawButton(ctx, this.bounds.chordEdit, editLabel, false, false);
    row2X += editW + gap;

    const barsLabel = `Bars ${Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS)}`;
    const barsLabelW = Math.min(140, Math.max(96, ctx.measureText(barsLabel).width + 28));
    this.bounds.barsMinus = { x: row2X, y: row2Y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.barsMinus, '−', false, false);
    row2X += buttonSize + gap;
    this.bounds.barsLabel = { x: row2X, y: row2Y, w: barsLabelW, h: rowH };
    this.drawButton(ctx, this.bounds.barsLabel, barsLabel, false, true);
    row2X += barsLabelW + gap;
    this.bounds.barsPlus = { x: row2X, y: row2Y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.barsPlus, '+', false, false);

    return rowH * 2 + gap;
  }

  drawGridZoomControls(ctx, x, y, w, h) {
    const buttonSize = 30;
    const gap = 6;
    const zoomOutXBounds = {
      x: x + w - buttonSize - 10,
      y: y + h - buttonSize - 10,
      w: buttonSize,
      h: buttonSize
    };
    const zoomInXBounds = {
      x: zoomOutXBounds.x,
      y: zoomOutXBounds.y - buttonSize - gap,
      w: buttonSize,
      h: buttonSize
    };
    const zoomOutYBounds = {
      x: zoomOutXBounds.x - buttonSize - gap,
      y: zoomOutXBounds.y,
      w: buttonSize,
      h: buttonSize
    };
    const zoomInYBounds = {
      x: zoomOutYBounds.x,
      y: zoomOutYBounds.y - buttonSize - gap,
      w: buttonSize,
      h: buttonSize
    };
    this.bounds.zoomInX = zoomInXBounds;
    this.bounds.zoomOutX = zoomOutXBounds;
    this.bounds.zoomInY = zoomInYBounds;
    this.bounds.zoomOutY = zoomOutYBounds;
    this.drawSmallButton(ctx, zoomInXBounds, '+', false);
    this.drawSmallButton(ctx, zoomOutXBounds, '−', false);
    this.drawSmallButton(ctx, zoomInYBounds, '+', false);
    this.drawSmallButton(ctx, zoomOutYBounds, '−', false);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Courier New';
    ctx.fillText('X', zoomOutXBounds.x + 9, zoomOutXBounds.y - 6);
    ctx.fillText('Y', zoomOutYBounds.x + 9, zoomOutYBounds.y - 6);
  }

  drawInstrumentPanel(ctx, x, y, w, h, track) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const isMobile = this.isMobileLayout();
    const padding = 12;
    const panelGap = 12;
    const leftW = Math.min(320, Math.max(220, w * 0.32));
    const rightW = w - padding * 2 - leftW - panelGap;
    const leftX = x + padding;
    const leftY = y + padding;
    const panelH = h - padding * 2;
    const rightX = leftX + leftW + panelGap;
    const rightY = leftY;
    const rowH = isMobile ? 54 : 48;
    const addButtonH = 36;
    const controlsH = 0;

    this.bounds.instrumentList = [];
    this.bounds.instrumentSettingsControls = [];

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(leftX, leftY, leftW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(leftX, leftY, leftW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Instruments', leftX + 10, leftY + 18);
    const listStartY = leftY + 28;
    const listH = Math.max(0, panelH - addButtonH - 20 - controlsH);
    const listEndY = listStartY + listH;
    let cursorY = listStartY;
    this.song.tracks.forEach((listTrack, index) => {
      if (cursorY + rowH > listEndY) return;
      const bounds = { x: leftX + 8, y: cursorY, w: leftW - 16, h: rowH, trackIndex: index };
      const isActive = index === this.selectedTrackIndex;
      ctx.fillStyle = isActive ? 'rgba(255,225,106,0.18)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = listTrack.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Courier New';
      ctx.fillText(listTrack.name, bounds.x + 10, bounds.y + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px Courier New';
      const label = isDrumChannel(listTrack.channel)
        ? this.getDrumKitLabel(listTrack)
        : this.getProgramLabel(listTrack.program);
      ctx.fillText(label, bounds.x + 10, bounds.y + 36);
      this.bounds.instrumentList.push(bounds);
      cursorY += rowH + 6;
    });

    this.bounds.instrumentAdd = { x: leftX + 8, y: leftY + panelH - addButtonH - 8, w: leftW - 16, h: addButtonH };
    this.drawButton(ctx, this.bounds.instrumentAdd, 'Add Instrument', false, false);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(rightX, rightY, rightW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(rightX, rightY, rightW, panelH);

    if (this.instrumentPicker.mode) {
      const header = this.instrumentPicker.mode === 'add' ? 'Add Instrument' : 'Change Instrument';
      ctx.fillStyle = '#fff';
      ctx.font = '15px Courier New';
      ctx.fillText(header, rightX + 12, rightY + 22);
      const previewOffset = this.instrumentPreview.loading ? 16 : 0;
      if (this.instrumentPreview.loading) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px Courier New';
        ctx.fillText('Downloading preview…', rightX + 12, rightY + 38);
      }

      const tabY = rightY + 34 + previewOffset;
      const tabH = 36;
      const tabNavW = 30;
      const tabNavGap = 6;
      const tabsAvailableW = rightW - padding * 2 - (tabNavW + tabNavGap) * 2;
      const tabsX = rightX + padding + tabNavW + tabNavGap;
      const tabRows = tabsAvailableW < 480 ? 2 : 1;
      const tabsPerRow = Math.ceil(INSTRUMENT_FAMILY_TABS.length / tabRows);
      this.instrumentPicker.tabBounds = [];
      this.instrumentPicker.tabPrevBounds = {
        x: rightX + padding,
        y: tabY,
        w: tabNavW,
        h: tabH
      };
      this.instrumentPicker.tabNextBounds = {
        x: rightX + rightW - padding - tabNavW,
        y: tabY,
        w: tabNavW,
        h: tabH
      };
      this.drawSmallButton(ctx, this.instrumentPicker.tabPrevBounds, '<', false);
      this.drawSmallButton(ctx, this.instrumentPicker.tabNextBounds, '>', false);
      for (let row = 0; row < tabRows; row += 1) {
        for (let col = 0; col < tabsPerRow; col += 1) {
          const index = row * tabsPerRow + col;
          const tab = INSTRUMENT_FAMILY_TABS[index];
          if (!tab) continue;
          const tabW = (tabsAvailableW - (tabsPerRow - 1) * 6) / tabsPerRow;
          const tabX = tabsX + col * (tabW + 6);
          const tabRowY = tabY + row * (tabH + 6);
          const bounds = { x: tabX, y: tabRowY, w: tabW, h: tabH, id: tab.id };
          this.instrumentPicker.tabBounds.push(bounds);
          this.drawButton(ctx, bounds, tab.label, this.instrumentPicker.familyTab === tab.id, false);
        }
      }

      const selectorY = tabY + tabRows * (tabH + 6) + 10;
      const footerH = 94;
      const scrollY = selectorY;
      const scrollH = rightY + panelH - scrollY - footerH;
      this.instrumentPicker.sectionBounds = [{ x: rightX + padding, y: scrollY, w: rightW - padding * 2, h: scrollH }];

      const programs = this.getProgramsForFamily(this.instrumentPicker.familyTab);
      const tiles = programs.length
        ? programs.map((entry) => ({
          program: entry.program,
          label: `${formatProgramNumber(entry.program)} ${entry.name}`
        }))
        : [{ type: 'empty', label: 'No instruments in this tab yet.' }];

      const columns = rightW > 720 ? 3 : 2;
      const tileGap = 10;
      const tileW = (rightW - padding * 2 - tileGap * (columns - 1)) / columns;
      const tileH = 56;
      this.instrumentPicker.scrollStep = tileH + tileGap;
      let tileX = rightX + padding;
      let tileY = scrollY - this.instrumentPicker.scroll;
      this.instrumentPicker.bounds = [];
      this.instrumentPicker.favoriteBounds = [];

      ctx.save();
      ctx.beginPath();
      ctx.rect(rightX + padding, scrollY, rightW - padding * 2, scrollH);
      ctx.clip();
      tiles.forEach((item) => {
        if (item.type === 'empty') {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '12px Courier New';
          ctx.fillText(item.label, rightX + padding, tileY + 18);
          tileY += 28;
          tileX = rightX + padding;
          return;
        }
        const bounds = { x: tileX, y: tileY, w: tileW, h: tileH, program: item.program };
        if (tileY + tileH >= scrollY - tileH && tileY <= scrollY + scrollH + tileH) {
          const isSelected = this.instrumentPicker.selectedProgram === item.program;
          this.drawButton(ctx, bounds, item.label, isSelected, true);
          this.instrumentPicker.bounds.push(bounds);
          const favoriteBounds = { x: bounds.x + bounds.w - 40, y: bounds.y + 6, w: 34, h: 34, program: item.program };
          this.instrumentPicker.favoriteBounds.push(favoriteBounds);
          ctx.fillStyle = this.favoriteInstruments.includes(item.program) ? '#ffe16a' : 'rgba(255,255,255,0.35)';
          ctx.font = '18px Courier New';
          ctx.fillText('★', favoriteBounds.x + 8, favoriteBounds.y + 22);
        }
        tileX += tileW + tileGap;
        if ((tileX + tileW) > rightX + rightW - padding + 1) {
          tileX = rightX + padding;
          tileY += tileH + tileGap;
        }
      });
      const totalHeight = tileY - scrollY + tileH + this.instrumentPicker.scroll;
      ctx.restore();

      this.instrumentPicker.scrollMax = Math.max(0, totalHeight - scrollH);
      this.instrumentPicker.scroll = clamp(this.instrumentPicker.scroll, 0, this.instrumentPicker.scrollMax);

      this.instrumentPicker.scrollUpBounds = null;
      this.instrumentPicker.scrollDownBounds = null;
      if (this.instrumentPicker.scrollMax > 0) {
        const scrollButtonW = 26;
        const scrollButtonH = 22;
        const scrollButtonX = rightX + rightW - padding - scrollButtonW;
        this.instrumentPicker.scrollUpBounds = {
          x: scrollButtonX,
          y: scrollY + 6,
          w: scrollButtonW,
          h: scrollButtonH
        };
        this.instrumentPicker.scrollDownBounds = {
          x: scrollButtonX,
          y: scrollY + scrollH - scrollButtonH - 6,
          w: scrollButtonW,
          h: scrollButtonH
        };
        this.drawSmallButton(ctx, this.instrumentPicker.scrollUpBounds, '▲', false);
        this.drawSmallButton(ctx, this.instrumentPicker.scrollDownBounds, '▼', false);
      }

      const footerY = rightY + panelH - footerH + 6;
      const footerButtonH = 32;
      this.instrumentPicker.downloadBounds = {
        x: rightX + padding,
        y: footerY,
        w: rightW - padding * 2,
        h: footerButtonH
      };
      const pickerTrack = this.song.tracks[this.instrumentPicker.trackIndex ?? this.selectedTrackIndex] || track;
      const downloadProgram = Number.isInteger(this.instrumentPicker.selectedProgram)
        ? this.instrumentPicker.selectedProgram
        : pickerTrack?.program;
      const downloadKey = this.getCacheKeyForProgram(downloadProgram, pickerTrack?.channel ?? 0);
      const isCached = downloadKey ? this.cachedPrograms.has(downloadKey) : false;
      const isDownloading = this.instrumentDownload.loading && this.instrumentDownload.key === downloadKey;
      const downloadLabel = isDownloading ? 'Downloading…' : isCached ? 'Downloaded' : 'Download Instrument';
      this.drawButton(ctx, this.instrumentPicker.downloadBounds, downloadLabel, isCached, false);

      const actionY = footerY + footerButtonH + 10;
      const buttonW = (rightW - padding * 2 - 12) / 2;
      this.instrumentPicker.confirmBounds = {
        x: rightX + padding,
        y: actionY,
        w: buttonW,
        h: footerButtonH
      };
      this.instrumentPicker.cancelBounds = {
        x: rightX + padding + buttonW + 12,
        y: actionY,
        w: buttonW,
        h: footerButtonH
      };
      const confirmLabel = this.instrumentPicker.mode === 'add' ? 'Add' : 'Apply';
      this.drawButton(ctx, this.instrumentPicker.confirmBounds, confirmLabel, false, false);
      this.drawButton(ctx, this.instrumentPicker.cancelBounds, 'Cancel', false, false);
      return;
    }

    ctx.fillStyle = '#fff';
    ctx.font = '15px Courier New';
    ctx.fillText('Instrument Settings', rightX + 12, rightY + 22);
    if (!track) return;

    const infoY = rightY + 40;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px Courier New';
    ctx.fillText(track.name, rightX + 12, infoY + 12);
    const instrumentLabel = isDrumChannel(track.channel)
      ? this.getDrumKitLabel(track)
      : this.getProgramLabel(track.program);
    ctx.fillText(instrumentLabel, rightX + 12, infoY + 28);
    const activePreview = this.instrumentPreview.loading
      && this.instrumentPreview.key === this.getCacheKeyForTrack(track);
    const previewOffset = activePreview ? 18 : 0;
    if (activePreview) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px Courier New';
      ctx.fillText('Downloading preview…', rightX + 12, infoY + 44);
    }

    const buttonRowY = infoY + 40 + previewOffset;
    const buttonGap = 8;
    const buttonW = (rightW - padding * 2 - buttonGap * 2) / 3;
    const changeBounds = {
      x: rightX + padding,
      y: buttonRowY,
      w: buttonW,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'instrument'
    };
    const renameBounds = {
      x: rightX + padding + buttonW + buttonGap,
      y: buttonRowY,
      w: buttonW,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'name'
    };
    const removeBounds = {
      x: rightX + padding + (buttonW + buttonGap) * 2,
      y: buttonRowY,
      w: buttonW,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'remove'
    };
    this.drawButton(ctx, changeBounds, 'Change', false, false);
    this.drawButton(ctx, renameBounds, 'Rename', false, false);
    this.drawButton(ctx, removeBounds, 'Remove', false, false);
    this.bounds.instrumentSettingsControls.push(changeBounds, renameBounds, removeBounds);

    const toggleRowY = buttonRowY + 44;
    const muteBounds = {
      x: rightX + padding,
      y: toggleRowY,
      w: 80,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'mute'
    };
    const soloBounds = {
      x: rightX + padding + 90,
      y: toggleRowY,
      w: 80,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'solo'
    };
    this.drawButton(ctx, muteBounds, 'Mute', track.mute, false);
    this.drawButton(ctx, soloBounds, 'Solo', track.solo, false);
    this.bounds.instrumentSettingsControls.push(muteBounds, soloBounds);

    const sliderX = rightX + padding;
    const sliderW = rightW - padding * 2;
    const volumeBounds = {
      x: sliderX,
      y: toggleRowY + 50,
      w: sliderW,
      h: 18,
      trackIndex: this.selectedTrackIndex,
      control: 'volume'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * track.volume, volumeBounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px Courier New';
    ctx.fillText('Volume', sliderX, volumeBounds.y - 6);
    this.bounds.instrumentSettingsControls.push(volumeBounds);

    const panBounds = {
      x: sliderX,
      y: volumeBounds.y + 36,
      w: sliderW,
      h: 16,
      trackIndex: this.selectedTrackIndex,
      control: 'pan'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
    ctx.fillStyle = '#4fb7ff';
    ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((track.pan + 1) / 2), panBounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px Courier New';
    ctx.fillText('Pan', sliderX, panBounds.y - 6);
    this.bounds.instrumentSettingsControls.push(panBounds);
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

    const gmStatus = this.game?.audio?.getGmStatus?.();

    drawSectionTitle('Audio');
    drawSlider('Master Volume', `${Math.round(this.audioSettings.masterVolume * 100)}%`, this.audioSettings.masterVolume, 'audio-volume', 'Overall output level.');
    drawToggle('Reverb', this.audioSettings.reverbEnabled, 'audio-reverb-toggle', 'Adds space to GM playback.');
    drawSlider('Reverb Level', `${Math.round(this.audioSettings.reverbLevel * 100)}%`, this.audioSettings.reverbLevel, 'audio-reverb-level', 'Wet mix for the reverb bus.');
    drawSlider('Output Latency', `${this.audioSettings.latencyMs} ms`, this.audioSettings.latencyMs / 120, 'audio-latency', 'Increase if audio crackles.');
    drawToggle('SoundFont Instruments', this.audioSettings.useSoundfont, 'audio-soundfont-toggle', 'Use sample-based GM instruments (recommended).');
    const cdnLabel = SOUNDFONT_CDNS.find((entry) => entry.id === this.audioSettings.soundfontCdn)?.label || 'GitHub Pages';
    drawAction('SoundFont CDN', cdnLabel, 'audio-soundfont-cdn', 'Switch CDN source for the FluidR3_GM bank.');
    drawAction('Preload Instrument', 'Load', 'audio-soundfont-preload', 'Preload the active track SoundFont.');
    if (gmStatus) {
      ctx.fillStyle = gmStatus.error ? '#ff8a8a' : 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      const statusText = gmStatus.error
        ? `SoundFont error: ${gmStatus.error}`
        : gmStatus.loading
          ? 'SoundFont status: Loading…'
          : 'SoundFont status: Ready';
      ctx.fillText(statusText, x + padding, cursorY + 16);
      cursorY += 28;
    }
    cursorY += sectionGap;

    drawSectionTitle('Grid & Editing');
    drawToggle('Preview On', this.previewOnEdit, 'grid-preview', 'Audition notes as you place them.');
    drawAction('Grid', this.quantizeOptions[this.quantizeIndex].label, 'grid-quantize-value', 'Quantize grid step size.');
    drawAction(
      'Time Sig',
      `${this.song.timeSignature?.beats || 4}/${this.song.timeSignature?.unit || 4}`,
      'grid-time-signature',
      'Cycle the time signature used for measure length.'
    );
    drawToggle('Snap', this.scaleLock, 'grid-scale-lock', 'Snap pitches to the current scale.');
    drawToggle('Chord Mode', this.chordMode, 'grid-chord-mode', 'Show chord tones and highlight chord notes.');
    drawAction('Chords', 'Edit', 'grid-chord-progression', 'Define chord progressions by bar range.');
    drawToggle('Quant', this.quantizeEnabled, 'grid-quantize-toggle', 'Enable quantized placement.');
    drawToggle('Scrub', this.scrubAudition, 'grid-scrub', 'Audition notes while scrubbing.');
    drawAction('All', 'Select', 'grid-select-all', 'Select all notes in the current pattern.');
    drawToggle('High Contrast', this.highContrast, 'ui-contrast', 'Boosts UI contrast for clarity.');
    cursorY += sectionGap;

    drawSectionTitle('Tempo & Playback');
    drawToggle('Loop Enabled', this.song.loopEnabled, 'playback-loop', 'Loops between Start and End markers.');
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
    const noteLengthLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
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
    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    ctx.font = '12px Courier New';
    const tempoW = Math.min(180, Math.max(120, ctx.measureText(tempoLabel).width + 28));
    this.bounds.tempoButton = { x: tempoX, y: controlsRowY, w: tempoW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
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

    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px Courier New`;
    const tempoW = Math.min(offset(200), Math.max(offset(120), ctx.measureText(tempoLabel).width + offset(24)));
    this.bounds.tempoButton = { x: x + offset(130), y: y + offset(16), w: tempoW, h: offset(24) };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);

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

    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    this.bounds.tempoButton = { x: innerX, y: rowY, w: innerW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
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
    const noteLengthLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLengthLabel, false);
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
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program);
      ctx.fillText(instrumentLabel, x + 32, rowY + (isMobile ? 50 : 38));
      this.trackControlBounds.push({
        x: x + 30,
        y: rowY + (isMobile ? 34 : 26),
        w: w - 170,
        h: isMobile ? 26 : 18,
        trackIndex: index,
        control: 'instrument'
      });

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
      const bankLabel = isDrums ? this.getDrumKitLabel(track) : `Bank ${track.bankMSB}/${track.bankLSB}`;
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
    const rulerH = DEFAULT_RULER_HEIGHT;
    const viewW = w - labelW;
    const baseCellWidth = viewW / loopTicks;
    const baseVisibleRows = this.getBaseVisibleRows(rows);
    const { minZoom, maxZoom } = this.getGridZoomLimits(rows);
    const zoomXLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    this.gridZoomY = clamp(this.gridZoomY, minZoom, maxZoom);
    const baseCellHeight = Math.min(24, (h - rulerH - 16) / baseVisibleRows);
    const viewH = Math.max(0, h - rulerH);
    if (!this.gridZoomInitialized) {
      const desiredVisibleRows = 12;
      this.gridZoomY = clamp(viewH / (desiredVisibleRows * baseCellHeight), minZoom, maxZoom);
      this.gridZoomInitialized = true;
    }
    const cellWidth = baseCellWidth * this.gridZoomX;
    const cellHeight = baseCellHeight * this.gridZoomY;
    const totalGridW = cellWidth * loopTicks;
    const gridH = cellHeight * rows;
    this.initializeGridOffset(track, rows, cellHeight);
    this.clampGridOffset(viewW, viewH, totalGridW, gridH);
    const originX = x + labelW + this.gridOffset.x;
    const originY = y + rulerH + this.gridOffset.y;

    this.rulerBounds = { x: x + labelW, y, w: viewW, h: rulerH };
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
      gridW: totalGridW,
      gridH,
      labelX: x,
      labelW
    };

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, viewH + rulerH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, viewH + rulerH);

    this.drawRuler(ctx, x + labelW, y, viewW, rulerH, loopTicks);
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

  drawRuler(ctx, x, y, w, h, loopTicks) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    if (!this.gridBounds) return;
    const { originX, cellWidth } = this.gridBounds;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      ctx.fillStyle = 'rgba(255,225,106,0.25)';
      ctx.fillRect(loopStartX, y, loopEndX - loopStartX, h);
      const handleW = Math.max(26, Math.round(h * 0.9));
      const handleH = Math.max(14, Math.round(h * 0.8));
      const handleY = y + Math.max(1, Math.round((h - handleH) / 2));
      const gap = 3;
      const minX = originX;
      const maxX = originX + loopTicks * cellWidth - handleW;
      this.bounds.loopStartHandle = {
        x: clamp(loopStartX - handleW - gap, minX, maxX),
        y: handleY,
        w: handleW,
        h: handleH
      };
      this.bounds.loopEndHandle = {
        x: clamp(loopEndX + gap, minX, maxX),
        y: handleY,
        w: handleW,
        h: handleH
      };
      ctx.fillStyle = '#55d68a';
      ctx.fillRect(this.bounds.loopStartHandle.x, this.bounds.loopStartHandle.y, handleW, handleH);
      ctx.fillStyle = '#ff6a6a';
      ctx.fillRect(this.bounds.loopEndHandle.x, this.bounds.loopEndHandle.y, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeRect(this.bounds.loopStartHandle.x, this.bounds.loopStartHandle.y, handleW, handleH);
      ctx.strokeRect(this.bounds.loopEndHandle.x, this.bounds.loopEndHandle.y, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      [this.bounds.loopStartHandle, this.bounds.loopEndHandle].forEach((handle) => {
        const ridgeXLeft = handle.x + Math.round(handleW * 0.35);
        const ridgeXRight = handle.x + Math.round(handleW * 0.65);
        ctx.beginPath();
        ctx.moveTo(ridgeXLeft, handle.y + 3);
        ctx.lineTo(ridgeXLeft, handle.y + handleH - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ridgeXRight, handle.y + 3);
        ctx.lineTo(ridgeXRight, handle.y + handleH - 3);
        ctx.stroke();
      });
    } else {
      this.bounds.loopStartHandle = null;
      this.bounds.loopEndHandle = null;
    }
    const totalBars = Math.max(1, Math.ceil(loopTicks / ticksPerBar));
    for (let bar = 0; bar < totalBars; bar += 1) {
      const barX = originX + bar * ticksPerBar * cellWidth;
      ctx.fillText(`${bar + 1}`, barX + 4, y + h - 8);
    }
    if (typeof this.song.loopStartTick === 'number') {
      const startX = originX + this.song.loopStartTick * cellWidth;
      ctx.strokeStyle = '#55d68a';
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX, y + h);
      ctx.stroke();
      ctx.fillStyle = '#55d68a';
      ctx.fillText('START', startX + 4, y + h - 8);
    }
    if (typeof this.song.loopEndTick === 'number') {
      const endX = originX + this.song.loopEndTick * cellWidth;
      ctx.strokeStyle = '#ff6a6a';
      ctx.beginPath();
      ctx.moveTo(endX, y);
      ctx.lineTo(endX, y + h);
      ctx.stroke();
      ctx.fillStyle = '#ff6a6a';
      ctx.fillText('END', endX + 4, y + h - 8);
    }
    ctx.restore();
  }

  drawGrid(ctx, track, pattern, loopTicks) {
    const { originX, originY, cellWidth, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumChannel(track.channel);
    const chordMode = this.chordMode;
    const scalePitchClasses = this.getScalePitchClasses();
    this.bounds.pasteAction = null;

    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      const pitchClass = pitch % 12;
      const isScaleTone = !isDrumGrid && scalePitchClasses.includes(pitchClass);
      if (!isDrumGrid && !chordMode) {
        ctx.fillStyle = isBlackKey(pitchClass)
          ? 'rgba(0,0,0,0.4)'
          : 'rgba(255,255,255,0.06)';
      } else if (isScaleTone) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
      }
      ctx.fillRect(originX, originY + row * cellHeight, cellWidth * loopTicks, cellHeight);
    }

    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    if (!isDrumGrid && chordMode) {
      for (let barTick = 0; barTick < loopTicks; barTick += ticksPerBar) {
        const chord = this.getChordForTick(barTick);
        const chordTones = this.getChordTones(chord);
        if (!chordTones.length) continue;
        const barEnd = Math.min(loopTicks, barTick + ticksPerBar);
        const barWidth = (barEnd - barTick) * cellWidth;
        for (let row = 0; row < rows; row += 1) {
          const pitch = this.getPitchFromRow(row);
          const pitchClass = pitch % 12;
          if (!chordTones.includes(pitchClass)) continue;
          ctx.fillStyle = 'rgba(79,183,255,0.16)';
          ctx.fillRect(originX + barTick * cellWidth, originY + row * cellHeight, barWidth, cellHeight);
        }
      }
    }
    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      ctx.fillStyle = 'rgba(255,225,106,0.18)';
      ctx.fillRect(loopStartX, originY, loopEndX - loopStartX, rows * cellHeight);
    }
    const divisor = this.quantizeOptions[this.quantizeIndex]?.divisor || 16;
    const gridStep = Math.max(1, Math.round(ticksPerBar / divisor));
    for (let barTick = 0; barTick <= loopTicks; barTick += ticksPerBar) {
      const xPos = originX + barTick * cellWidth;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xPos, originY);
      ctx.lineTo(xPos, originY + rows * cellHeight);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let tick = 0; tick <= loopTicks; tick += gridStep) {
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
    for (let row = 0; row <= rows; row += 1) {
      const yPos = originY + row * cellHeight;
      let isOctave = false;
      if (!isDrumGrid && row < rows) {
        const pitch = this.getPitchFromRow(row);
        isOctave = pitch % 12 === 0;
      }
      ctx.strokeStyle = isOctave ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isOctave ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(originX, yPos);
      ctx.lineTo(originX + loopTicks * cellWidth, yPos);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    this.noteBounds = [];
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      const baseColor = track.color || '#4fb7ff';
      let noteFill = baseColor;
      if (!isDrumGrid && !chordMode) {
        const pitchClass = note.pitch % 12;
        noteFill = isBlackKey(pitchClass)
          ? toRgba(baseColor, 0.7)
          : toRgba(baseColor, 0.95);
      }
      ctx.fillStyle = this.selection.has(note.id) ? '#ffe16a' : noteFill;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      if (this.activeNotes.has(note.id)) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      if (!isDrumGrid && chordMode) {
        const chord = this.getChordForTick(note.startTick);
        const chordTones = this.getChordTones(chord);
        if (chordTones.includes(note.pitch % 12)) {
          ctx.strokeStyle = '#ffe16a';
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        }
      }
      if (this.selection.has(note.id)) {
        const handleHeight = rect.h;
        const handleWidth = this.getNoteHandleWidth(rect);
        const handleY = rect.y;
        const leftHandleX = rect.x - handleWidth;
        const rightHandleX = rect.x + rect.w;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.lineWidth = 1;
        ctx.fillStyle = '#ffe9b3';
        ctx.fillRect(leftHandleX, handleY, handleWidth, handleHeight);
        ctx.fillRect(rightHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeStyle = '#0b0b0b';
        ctx.strokeRect(leftHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeRect(rightHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeStyle = 'rgba(11, 11, 11, 0.65)';
        const ridgeCount = 3;
        const ridgeGap = handleWidth / (ridgeCount + 1);
        for (let ridge = 1; ridge <= ridgeCount; ridge += 1) {
          const ridgeXLeft = leftHandleX + ridge * ridgeGap;
          const ridgeXRight = rightHandleX + ridge * ridgeGap;
          ctx.beginPath();
          ctx.moveTo(ridgeXLeft, handleY + 3);
          ctx.lineTo(ridgeXLeft, handleY + handleHeight - 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ridgeXRight, handleY + 3);
          ctx.lineTo(ridgeXRight, handleY + handleHeight - 3);
          ctx.stroke();
        }
      }
      this.noteBounds.push({ ...rect, noteId: note.id });
    });

    if (this.pastePreview) {
      this.drawPastePreview(ctx, track);
    }

    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      const handleW = Math.max(26, Math.round(DEFAULT_RULER_HEIGHT * 0.9));
      const handleH = Math.max(14, Math.round(DEFAULT_RULER_HEIGHT * 0.8));
      const handleY = this.gridBounds.y + Math.max(1, Math.round((this.gridBounds.h - handleH) / 2));
      const gap = 4;
      const minX = originX;
      const maxX = originX + loopTicks * cellWidth - handleW;
      const startHandleX = clamp(loopStartX - handleW - gap, minX, maxX);
      const endHandleX = clamp(loopEndX + gap, minX, maxX);
      this.bounds.loopShiftStartHandle = { x: startHandleX, y: handleY, w: handleW, h: handleH };
      this.bounds.loopShiftEndHandle = { x: endHandleX, y: handleY, w: handleW, h: handleH };
      ctx.fillStyle = '#55d68a';
      ctx.fillRect(startHandleX, handleY, handleW, handleH);
      ctx.fillStyle = '#ff6a6a';
      ctx.fillRect(endHandleX, handleY, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeRect(startHandleX, handleY, handleW, handleH);
      ctx.strokeRect(endHandleX, handleY, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      [this.bounds.loopShiftStartHandle, this.bounds.loopShiftEndHandle].forEach((handle) => {
        const ridgeXLeft = handle.x + Math.round(handleW * 0.35);
        const ridgeXRight = handle.x + Math.round(handleW * 0.65);
        ctx.beginPath();
        ctx.moveTo(ridgeXLeft, handle.y + 3);
        ctx.lineTo(ridgeXLeft, handle.y + handleH - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ridgeXRight, handle.y + 3);
        ctx.lineTo(ridgeXRight, handle.y + handleH - 3);
        ctx.stroke();
      });
    } else {
      this.bounds.loopShiftStartHandle = null;
      this.bounds.loopShiftEndHandle = null;
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

    const baseRow = this.getRowFromPitch(basePitch);
    if (baseRow >= 0) {
      const buttonW = 110;
      const buttonH = 26;
      const minX = this.gridBounds.x;
      const maxX = this.gridBounds.x + this.gridBounds.w - buttonW;
      const minY = this.gridBounds.y;
      const maxY = this.gridBounds.y + this.gridBounds.h - buttonH;
      const anchorX = originX + baseTick * cellWidth;
      const anchorY = originY + baseRow * cellHeight;
      const buttonX = clamp(anchorX, minX, maxX);
      const buttonY = clamp(anchorY - buttonH - 8, minY, maxY);
      this.bounds.pasteAction = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
      this.drawSmallButton(ctx, this.bounds.pasteAction, 'Paste Here', false);
    }
  }

  drawLabelColumn(ctx, track) {
    if (!this.gridBounds || !track) return;
    const { labelX, labelW, originY, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumChannel(track.channel);
    this.noteLabelBounds = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelX, originY, labelW, rows * cellHeight);
    ctx.clip();
    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      let label = isDrumGrid
        ? this.getDrumRows()[row]?.label
        : NOTE_LABELS[pitch % 12];
      if (!isDrumGrid && pitch % 12 === 0) {
        label = `${label}${this.getOctaveLabel(pitch)}`;
      }
      this.noteLabelBounds.push({
        x: labelX,
        y: originY + row * cellHeight,
        w: labelW,
        h: cellHeight,
        pitch
      });
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

  drawNoteLengthMenu(ctx, width, height) {
    if (!this.noteLengthMenu.open) {
      this.bounds.noteLengthMenu = [];
      return;
    }
    const options = NOTE_LENGTH_OPTIONS;
    const columns = 4;
    const rows = Math.ceil(options.length / columns);
    const gap = 6;
    const padding = 8;
    ctx.font = '12px Courier New';
    const maxLabelW = Math.max(...options.map((option) => ctx.measureText(this.getNoteLengthDisplay(option, true)).width));
    const cellW = Math.max(60, Math.round(maxLabelW + 28));
    const cellH = 30;
    const menuW = columns * cellW + gap * (columns - 1) + padding * 2;
    const menuH = rows * cellH + gap * (rows - 1) + padding * 2;
    const menuX = Math.max(8, (width - menuW) / 2);
    const menuY = Math.max(8, (height - menuH) / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, menuW, menuH);

    this.bounds.noteLengthMenu = [];
    options.forEach((option, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cellX = menuX + padding + col * (cellW + gap);
      const cellY = menuY + padding + row * (cellH + gap);
      const bounds = { x: cellX, y: cellY, w: cellW, h: cellH, index };
      const isActive = index === this.noteLengthIndex;
      this.drawSmallButton(ctx, bounds, this.getNoteLengthDisplay(option, true), isActive);
      this.bounds.noteLengthMenu.push(bounds);
    });
  }

  drawTempoSlider(ctx, width, height) {
    if (!this.tempoSliderOpen) {
      this.bounds.tempoSlider = null;
      return;
    }
    const padding = 10;
    const sliderW = Math.min(320, width - 40);
    const sliderH = 72;
    const sliderX = Math.max(8, (width - sliderW) / 2);
    const sliderY = Math.max(8, (height - sliderH) / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(sliderX, sliderY, sliderW, sliderH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(sliderX, sliderY, sliderW, sliderH);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px Courier New';
    ctx.fillText(`Tempo ${this.song.tempo}BPM`, sliderX + padding, sliderY + 16);

    const barBounds = {
      x: sliderX + padding,
      y: sliderY + 30,
      w: sliderW - padding * 2,
      h: 14
    };
    const ratio = clamp((this.song.tempo - 40) / 200, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(barBounds.x, barBounds.y, barBounds.w * ratio, barBounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
    this.bounds.tempoSlider = barBounds;
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
      { id: 'soundfont', label: 'SoundFont CDN' },
      { id: 'soundfont-reset', label: 'SoundFont Default' },
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

  drawFileMenu(ctx, x, y) {
    const items = [
      { id: 'new', label: 'New' },
      { id: 'save', label: 'Save' },
      { id: 'load', label: 'Load' },
      { id: 'export', label: 'Export' },
      { id: 'import', label: 'Import' },
      { id: 'theme', label: 'Generate Theme' },
      { id: 'sample', label: 'Load Sample Song' }
    ];
    const width = FILE_MENU_WIDTH;
    const rowH = 44;
    const gap = 10;
    const height = items.length * rowH + gap * 2;
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    this.fileMenuBounds = [];
    items.forEach((item, index) => {
      const itemY = y + gap + index * rowH;
      const bounds = {
        x: x + gap,
        y: itemY,
        w: width - gap * 2,
        h: rowH - 8,
        id: item.id
      };
      this.drawButton(ctx, bounds, item.label, false, true);
      this.fileMenuBounds.push(bounds);
    });
  }

  drawGenreMenu(ctx, width, height) {
    const panelW = 260;
    const rowH = 46;
    const gap = 10;
    const items = [...GENRE_OPTIONS, { id: 'cancel', label: 'Cancel' }];
    const panelH = items.length * rowH + gap * 2;
    const panelX = width - panelW - gap;
    const panelY = Math.min(height - panelH - gap, gap + 40);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    this.genreMenuBounds = [];
    items.forEach((item, index) => {
      const itemY = panelY + gap + index * rowH;
      const bounds = {
        x: panelX + gap,
        y: itemY,
        w: panelW - gap * 2,
        h: rowH - 8,
        id: item.id
      };
      const active = item.id === this.selectedGenre;
      this.drawButton(ctx, bounds, item.label, active, true);
      this.genreMenuBounds.push(bounds);
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
