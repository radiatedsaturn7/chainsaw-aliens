import {
  GM_DRUM_BANK_LSB,
  GM_DRUM_BANK_MSB,
  GM_DRUM_CHANNEL,
  GM_DRUM_KITS,
  GM_DRUM_ROWS,
  GM_FAMILIES,
  GM_PROGRAMS,
  clampDrumPitch,
  formatProgramNumber,
  isDrumChannel,
  mapPitchToDrumRow
} from '../audio/gm.js';
import { buildMidiBytes, buildMultiTrackMidiBytes, parseMidi } from '../midi/midiParser.js';
import { buildZipFromStems, loadZipSongFromBytes } from '../songs/songLoader.js';
import InputEventBus from '../input/eventBus.js';
import RobterspielInput from '../input/robterspiel.js';
import KeyboardInput from '../input/keyboard.js';
import TouchInput from '../input/touch.js';
import MidiRecorder from '../recording/recorder.js';
import RecordModeLayout from './recordMode.js';

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALE_LIBRARY = [
  { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'minor', label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'locrian', label: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10] }
];

const radialIndexFromStick = (x, y, count) => {
  if (!count) return 0;
  const angle = Math.atan2(y, x);
  const normalized = (angle + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
  const slice = (Math.PI * 2) / count;
  return Math.round(normalized / slice) % count;
};

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
  { id: 'vendored', label: 'Vendored' }
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
  { id: 'song', label: 'Song' },
  { id: 'instruments', label: 'Mixer' }
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
const DRUM_BANK_MSB = GM_DRUM_BANK_MSB;
const DRUM_BANK_LSB = GM_DRUM_BANK_LSB;

const TRACK_COLORS = ['#4fb7ff', '#ff9c42', '#55d68a', '#b48dff', '#ff6a6a', '#43d5d0'];
const DEFAULT_GRID_BARS = 16;
const DEFAULT_VISIBLE_ROWS = 12;
const DEFAULT_LABEL_WIDTH = 192;
const DEFAULT_LABEL_WIDTH_MOBILE = 152;
const MIN_VISIBLE_ROWS = 5;
const MAX_VISIBLE_ROWS = 60;
const DEFAULT_GRID_TOP_PITCH = 59;
const DEFAULT_RULER_HEIGHT = 80;
const LOOP_HANDLE_MIN_WIDTH = 70;
const LOOP_HANDLE_MIN_HEIGHT = 38;
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

const isDrumTrack = (track) => Boolean(track) && (track.instrument === 'drums' || isDrumChannel(track.channel));
const coerceDrumPitch = (pitch, rows = GM_DRUM_ROWS) => mapPitchToDrumRow(clampDrumPitch(pitch), rows);

const createDefaultSong = () => ({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 120,
  loopBars: DEFAULT_GRID_BARS,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: false,
  timeSignature: { beats: 4, unit: 4 },
  highContrast: false,
  reverseStrings: false,
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
      automation: { pan: [], padding: [] },
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
      automation: { pan: [], padding: [] },
      patterns: [{ id: 'pattern-bass', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-drums',
      name: 'Drums',
      instrument: 'drums',
      channel: GM_DRUM_CHANNEL,
      program: 0,
      bankMSB: DRUM_BANK_MSB,
      bankLSB: DRUM_BANK_LSB,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      automation: { pan: [], padding: [] },
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
  reverseStrings: false,
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
      instrument: 'drums',
      channel: GM_DRUM_CHANNEL,
      program: 0,
      bankMSB: DRUM_BANK_MSB,
      bankLSB: DRUM_BANK_LSB,
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
    this.keyframePanelOpen = false;
    this.activeNotes = new Map();
    this.livePreviewNotes = new Set();
    this.dragState = null;
    this.suppressNextGridTap = false;
    this.selection = new Set();
    this.clipboard = null;
    this.cursor = { tick: 0, pitch: 60 };
    this.cachedPrograms = new Set(this.loadCachedPrograms());
    this.instrumentPreview = { loading: false, key: null };
    this.instrumentDownload = { loading: false, key: null };
    this.toolsMenuOpen = false;
    this.genreMenuOpen = false;
    this.selectedGenre = 'random';
    this.qaOverlayOpen = false;
    this.recordModeActive = false;
    this.recordQuantizeEnabled = true;
    this.recordQuantizeDivisor = 16;
    this.recordCountInEnabled = false;
    this.recordMetronomeEnabled = false;
    this.recordDevicePreference = 'auto';
    this.recordInstrument = 'keyboard';
    this.recordStatus = { degree: 1, octave: 0, velocity: 96 };
    this.nowPlaying = {
      active: false,
      label: '',
      detail: '',
      type: 'note'
    };
    this.nowPlayingNotes = new Map();
    this.recordStickIndicators = {
      left: { x: 0, y: 0, active: false },
      right: { x: 0, y: 0, active: false }
    };
    this.singleNoteRecordMode = {
      active: false,
      anchorTick: 0,
      measureStart: 0,
      measureEnd: 0,
      awaitingChord: true
    };
    this.singleNoteActiveNotes = new Map();
    this.recordSelector = {
      active: false,
      type: null,
      index: 0,
      stickEngaged: false
    };
    this.inputBus = new InputEventBus();
    this.keyboardInput = new KeyboardInput(this.inputBus);
    this.gamepadInput = new RobterspielInput(this.inputBus);
    this.touchInput = new TouchInput(this.inputBus);
    this.reverseStrings = Boolean(this.song?.reverseStrings);
    this.touchInput.setReverseStrings(this.reverseStrings);
    this.recordLayout = new RecordModeLayout({ touchInput: this.touchInput });
    this.recorder = new MidiRecorder({ getTime: () => this.getRecordingTime() });
    this.recordGridSnapshot = null;
    this.recordGridZoomedOut = false;
    this.recordCountIn = null;
    this.registerInputHandlers();
    this.qaResults = [];
    this.draggingTrackControl = null;
    this.longPressTimer = null;
    this.lastAuditionTime = 0;
    this.gamepadMoveCooldown = 0;
    this.gamepadResizeCooldown = 0;
    this.gamepadCursorActive = false;
    this.gamepadRtHeld = false;
    this.gamepadLtHeld = false;
    this.gamepadSelection = { active: false };
    this.gamepadResizeMode = { active: false };
    this.gamepadTransportTap = { left: 0, right: 0 };
    this.lastPointer = { x: 0, y: 0 };
    this.placingEndMarker = false;
    this.placingStartMarker = false;
    this.settingsOpen = false;
    this.settingsScroll = 0;
    this.settingsScrollMax = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 80;
    this.lastPersistedSnapshot = null;
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
    this.songSelection = {
      active: false,
      trackIndex: 0,
      trackStartIndex: 0,
      trackEndIndex: 0,
      startTick: 0,
      endTick: 0
    };
    this.songSelectionMenu = {
      open: false,
      x: 0,
      y: 0,
      bounds: []
    };
    this.songSplitTool = {
      active: false,
      tick: 0,
      bounds: {
        lineGrab: null,
        handleTop: null,
        handleBottom: null,
        splitAction: null,
        cancelAction: null
      }
    };
    this.songShiftTool = {
      active: false,
      semitones: 0,
      bounds: {
        slider: null,
        knob: null,
        apply: null,
        cancel: null
      }
    };
    this.songRepeatTool = {
      active: false,
      trackIndex: null,
      baseStartTick: null,
      baseEndTick: null,
      baseNotes: []
    };
    this.songClipboard = null;
    this.defaultNoteDurationTicks = null;
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
    this.songGesture = null;
    this.timelineStartTick = 0;
    this.timelineSource = 'grid';
    this.songTimelineZoomX = 1;
    this.songTimelineOffsetX = 0;
    this.songTimelineBounds = null;
    this.songPlayheadBounds = null;
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
      record: null,
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
      loopShiftEndHandle: null,
      songZoomIn: null,
      songZoomOut: null,
      keyframeToggle: null,
      keyframeSet: null,
      keyframeRemove: null
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
    this.songLaneBounds = [];
    this.songLabelBounds = [];
    this.songAutomationBounds = [];
    this.songActionBounds = [];
    this.songPartBounds = [];
    this.songPartHandleBounds = [];
    this.songInstrumentBounds = null;
    this.songAddBounds = null;
    this.songRulerBounds = null;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,.mid,.midi,.zip,application/json,audio/midi,application/zip';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      this.importSongFile(file)
        .catch((error) => {
          console.warn('Invalid song file', error);
          window.alert('Failed to import song data.');
        })
        .finally(() => {
          this.fileInput.value = '';
        });
    });
    this.game.audio.ensureMidiSampler();
    this.audioSettings = this.loadAudioSettings();
    this.applyAudioSettings();
    this.ensureState();
    this.lastPersistedSnapshot = JSON.stringify(this.song);
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.preloadDefaultInstruments();
  }

  getRecordingTime() {
    if (this.game?.audio?.ctx?.currentTime) {
      return this.game.audio.ctx.currentTime;
    }
    return performance.now() / 1000;
  }

  registerInputHandlers() {
    this.inputBus.on('noteon', (event) => this.handleRecordedNoteOn(event));
    this.inputBus.on('noteoff', (event) => this.handleRecordedNoteOff(event));
    this.inputBus.on('cc', (event) => this.handleRecordedCc(event));
    this.inputBus.on('pitchbend', (event) => this.handleRecordedPitchBend(event));
    this.inputBus.on('toggleRecord', () => {
      if (this.recordModeActive) {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      } else {
        this.enterRecordMode();
      }
    });
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
    audio.preloadSoundfontProgram(0, GM_DRUM_CHANNEL, DRUM_BANK_MSB, DRUM_BANK_LSB);
  }

  ensureDrumTrackSettings(track) {
    if (!isDrumTrack(track)) return track;
    track.instrument = 'drums';
    track.channel = GM_DRUM_CHANNEL;
    if (!Number.isInteger(track.bankMSB) || track.bankMSB === DEFAULT_BANK_MSB) {
      track.bankMSB = DRUM_BANK_MSB;
    }
    track.bankLSB = DRUM_BANK_LSB;
    track.program = clamp(track.program ?? 0, 0, 127);
    return track;
  }

  normalizeDrumPattern(track, pattern, rows = GM_DRUM_ROWS) {
    if (!pattern || !isDrumTrack(track)) return;
    pattern.notes = pattern.notes.map((note) => ({
      ...note,
      pitch: coerceDrumPitch(note.pitch, rows)
    }));
  }

  normalizeSongDrums() {
    if (!this.song?.tracks) return;
    this.song.tracks.forEach((track) => {
      if (!isDrumTrack(track)) return;
      this.ensureDrumTrackSettings(track);
      track.patterns?.forEach((pattern) => this.normalizeDrumPattern(track, pattern));
    });
  }

  persist() {
    this.normalizeSongDrums();
    const snapshot = JSON.stringify(this.song);
    if (snapshot !== this.lastPersistedSnapshot) {
      if (this.lastPersistedSnapshot) {
        this.undoStack.push(this.lastPersistedSnapshot);
        if (this.undoStack.length > this.maxUndoSteps) {
          this.undoStack.shift();
        }
        this.redoStack = [];
      }
      this.lastPersistedSnapshot = snapshot;
    }
    localStorage.setItem(this.storageKey, snapshot);
  }

  resetHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastPersistedSnapshot = JSON.stringify(this.song);
  }

  applySongSnapshot(snapshot) {
    if (!snapshot) return;
    try {
      this.song = JSON.parse(snapshot);
    } catch (error) {
      return;
    }
    this.ensureState();
    this.highContrast = Boolean(this.song?.highContrast);
    this.chordMode = Boolean(this.song?.chordMode);
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, Math.max(0, this.song.tracks.length - 1));
    const activeTrack = this.song.tracks[this.selectedTrackIndex];
    const patternCount = activeTrack?.patterns?.length ?? 1;
    this.selectedPatternIndex = clamp(this.selectedPatternIndex, 0, Math.max(0, patternCount - 1));
    this.selection.clear();
    this.clipboard = null;
    this.lastPersistedSnapshot = JSON.stringify(this.song);
    localStorage.setItem(this.storageKey, this.lastPersistedSnapshot);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const snapshot = this.undoStack.pop();
    const current = JSON.stringify(this.song);
    this.redoStack.push(current);
    this.applySongSnapshot(snapshot);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const snapshot = this.redoStack.pop();
    const current = JSON.stringify(this.song);
    this.undoStack.push(current);
    this.applySongSnapshot(snapshot);
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
    if (!name) return null;
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
    return payload;
  }

  saveAndPaint() {
    const entry = this.saveSongToLibrary();
    if (!entry || !this.game?.enterEditor) return;
    this.stopPlayback();
    this.game.enterEditor({ tab: 'music' });
    if (this.game.editor) {
      this.game.editor.getMusicTracks();
      this.game.editor.musicTrack = { id: entry.id, name: entry.name, source: 'library' };
      this.game.editor.mode = 'music';
      this.game.editor.musicTool = 'paint';
    }
  }

  getRobterSessionInstrumentFromTrack(track) {
    if (!track) return 'piano';
    if (isDrumTrack(track)) return 'drums';
    const name = String(track.name || '').toLowerCase();
    if (name.includes('bass')) return 'bass';
    if (name.includes('guitar')) return 'guitar';
    if (name.includes('piano') || name.includes('keys') || name.includes('keyboard') || name.includes('synth')) {
      return 'piano';
    }
    const program = Number.isFinite(track.program) ? track.program : 0;
    if (program >= 32 && program <= 39) return 'bass';
    if (program >= 24 && program <= 31) return 'guitar';
    if (program <= 7) return 'piano';
    return 'piano';
  }

  async playInRobterSession() {
    const session = this.game?.robterSession;
    if (!session) return;
    const blob = await this.buildRobterSessionZip();
    if (!blob) {
      window.alert('No notes available to play in RobterSession yet.');
      return;
    }
    this.stopPlayback();
    const file = new File([blob], `${this.getExportBaseName()}-robtersession.zip`, { type: 'application/zip' });
    session.enter();
    const selectedTrack = this.song?.tracks?.[this.selectedTrackIndex] || null;
    session.setMidiLaunchContext({ instrument: this.getRobterSessionInstrumentFromTrack(selectedTrack) });
    await session.loadUploadedZip(file);
    if (this.game) {
      this.game.robterSessionReturnState = 'midi-editor';
      this.game.robterSessionAutoReturn = false;
      this.game.state = 'robtersession';
    }
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
        erase: stored.erase || 'X',
        tool: stored.tool || 'Y',
        instrument: stored.instrument || 'B',
        play: stored.play || 'Start',
        stop: stored.stop || 'Back',
        octaveUp: stored.octaveUp || 'LB',
        octaveDown: stored.octaveDown || 'RB'
      };
    } catch (error) {
      return {
        place: 'A',
        erase: 'X',
        tool: 'Y',
        instrument: 'B',
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
      masterPan: 0,
      reverbEnabled: true,
      reverbLevel: 0.18,
      latencyMs: 30,
      useSoundfont: true,
      soundfontCdn: 'vendored',
      drumKitId: this.game?.audio?.getDrumKit?.()?.id || 'standard'
    };
    try {
      const stored = JSON.parse(localStorage.getItem('chainsaw-midi-audio'));
      if (!stored || typeof stored !== 'object') return defaults;
      return {
        masterVolume: typeof stored.masterVolume === 'number' ? stored.masterVolume : defaults.masterVolume,
        masterPan: typeof stored.masterPan === 'number' ? stored.masterPan : defaults.masterPan,
        reverbEnabled: typeof stored.reverbEnabled === 'boolean' ? stored.reverbEnabled : defaults.reverbEnabled,
        reverbLevel: typeof stored.reverbLevel === 'number' ? stored.reverbLevel : defaults.reverbLevel,
        latencyMs: typeof stored.latencyMs === 'number' ? stored.latencyMs : defaults.latencyMs,
        useSoundfont: typeof stored.useSoundfont === 'boolean' ? stored.useSoundfont : defaults.useSoundfont,
        soundfontCdn: typeof stored.soundfontCdn === 'string' ? stored.soundfontCdn : defaults.soundfontCdn,
        drumKitId: typeof stored.drumKitId === 'string' ? stored.drumKitId : defaults.drumKitId
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
    audio.setMasterPan?.(clamp(this.audioSettings.masterPan, -1, 1));
    audio.setMidiLatency?.(Math.max(0, this.audioSettings.latencyMs / 1000));
    audio.setMidiReverbEnabled?.(this.audioSettings.reverbEnabled);
    audio.setMidiReverbLevel?.(clamp(this.audioSettings.reverbLevel, 0, 1));
    audio.setSoundfontEnabled?.(this.audioSettings.useSoundfont);
    audio.setSoundfontCdn?.(this.audioSettings.soundfontCdn);
    audio.setDrumKit?.(this.audioSettings.drumKitId);
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
      const drumTrack = isDrumTrack(track);
      const channel = drumTrack ? GM_DRUM_CHANNEL : (track.channel ?? 0);
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
    this.normalizeSongDrums();
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
    if (typeof this.song.reverseStrings !== 'boolean') {
      this.song.reverseStrings = false;
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
    this.reverseStrings = Boolean(this.song.reverseStrings);
    this.touchInput.setReverseStrings(this.reverseStrings);
    this.beatsPerBar = this.song.timeSignature.beats;
    this.ensureDefaultLoopRegion();
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
    this.syncCursorToTrack();
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
          audio.preloadSoundfontProgram?.(track.program, track.channel, track.bankMSB, track.bankLSB);
        });
      })
      .catch(() => {
        // ignore preload errors
      });
  }

  normalizeTrack(track, index, loopBars = DEFAULT_GRID_BARS) {
    const legacyProgram = this.mapLegacyInstrumentToProgram(track.instrument);
    const drumTrack = isDrumTrack(track);
    const channel = drumTrack
      ? GM_DRUM_CHANNEL
      : Number.isInteger(track.channel)
        ? track.channel
        : index % 16;
    const resolvedProgram = clamp(Number.isInteger(track.program) ? track.program : legacyProgram, 0, 127);
    const bankMSB = clamp(Number.isInteger(track.bankMSB)
      ? (drumTrack && track.bankMSB === DEFAULT_BANK_MSB ? DRUM_BANK_MSB : track.bankMSB)
      : drumTrack ? DRUM_BANK_MSB : DEFAULT_BANK_MSB, 0, 127);
    const bankLSB = clamp(Number.isInteger(track.bankLSB)
      ? track.bankLSB
      : drumTrack ? DRUM_BANK_LSB : DEFAULT_BANK_LSB, 0, 127);
    const normalized = {
      id: track.id || `track-${uid()}`,
      name: track.name || `Track ${index + 1}`,
      instrument: drumTrack ? 'drums' : track.instrument,
      channel: clamp(channel, 0, 15),
      program: resolvedProgram,
      instrumentFamily: drumTrack ? 'Drums' : (track.instrumentFamily || this.getProgramFamilyLabel(resolvedProgram)),
      bankMSB,
      bankLSB: drumTrack ? DRUM_BANK_LSB : bankLSB,
      volume: typeof track.volume === 'number' ? track.volume : 0.8,
      pan: typeof track.pan === 'number' ? clamp(track.pan, -1, 1) : 0,
      mute: Boolean(track.mute),
      solo: Boolean(track.solo),
      color: track.color || TRACK_COLORS[index % TRACK_COLORS.length],
      automation: {
        pan: Array.isArray(track.automation?.pan) ? track.automation.pan : [],
        padding: Array.isArray(track.automation?.padding) ? track.automation.padding : []
      },
      patterns: Array.isArray(track.patterns) && track.patterns.length > 0
        ? track.patterns
        : [{ id: `pattern-${track.id || uid()}`, bars: loopBars, notes: [] }]
    };
    return drumTrack ? this.ensureDrumTrackSettings(normalized) : normalized;
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

  syncCursorToTrack() {
    const track = this.getActiveTrack();
    if (!track) return;
    if (isDrumTrack(track)) {
      this.ensureDrumTrackSettings(track);
      this.cursor.pitch = this.coercePitchForTrack(this.cursor.pitch, track, GM_DRUM_ROWS);
      this.gridOffset.y = 0;
    }
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
    this.syncCursorToTrack();
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
    if (isDrumTrack(track)) {
      return `${track.name || 'Track'}: ${this.getDrumKitLabel(track)}`;
    }
    return `${track.name || 'Track'}: ${this.getProgramLabel(track.program)}`;
  }

  getDrumKitLabel(track) {
    if (!track) return 'Drum Kit';
    const audio = this.game?.audio;
    if (audio?.getDrumKitLabel) {
      return audio.getDrumKitLabel({
        bankMSB: track.bankMSB,
        bankLSB: track.bankLSB,
        program: track.program
      });
    }
    const kit = GM_DRUM_KITS.find((entry) =>
      entry.program === track.program && entry.bankMSB === track.bankMSB && entry.bankLSB === track.bankLSB);
    return kit?.label || `Drum Kit ${formatProgramNumber(track.program)}`;
  }

  getCacheKeyForTrack(track) {
    if (!track) return null;
    if (isDrumTrack(track)) {
      return `drums:${track.bankMSB}:${track.bankLSB}:${track.program}`;
    }
    return String(track.program);
  }

  getCacheKeyForProgram(program, channel, bankMSB = DEFAULT_BANK_MSB, bankLSB = DEFAULT_BANK_LSB) {
    if (!Number.isInteger(program)) return null;
    if (isDrumChannel(channel)) {
      return `drums:${bankMSB}:${bankLSB}:${program}`;
    }
    return String(program);
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
    this.downloadInstrumentProgram(track.program, track.channel, track.bankMSB, track.bankLSB);
  }

  downloadInstrumentProgram(program, channel, bankMSB = DEFAULT_BANK_MSB, bankLSB = DEFAULT_BANK_LSB) {
    const key = this.getCacheKeyForProgram(program, channel, bankMSB, bankLSB);
    if (!key || this.instrumentDownload.loading || this.cachedPrograms.has(key)) return;
    const audio = this.game?.audio;
    if (!audio?.cacheGmProgram) return;
    this.setDownloadLoading(key, true);
    audio.cacheGmProgram(program, channel, bankMSB, bankLSB)
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
    const gridTicks = this.getGridTicks();
    if (typeof this.song.loopEndTick === 'number') {
      return clamp(this.song.loopEndTick, 1, gridTicks);
    }
    return gridTicks;
  }

  getGridTicks() {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    return Math.max(1, (this.song.loopBars || DEFAULT_GRID_BARS) * ticksPerBar);
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
    if (isDrumTrack(this.getActiveTrack())) {
      return this.getDrumHitDurationTicks();
    }
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const divisor = NOTE_LENGTH_OPTIONS[this.noteLengthIndex]?.divisor || 4;
    return Math.max(1, Math.round(ticksPerBar / divisor));
  }

  getPlacementDurationTicks(track = this.getActiveTrack()) {
    if (!track || isDrumTrack(track)) return this.getDrumHitDurationTicks();
    if (Number.isFinite(this.defaultNoteDurationTicks) && this.defaultNoteDurationTicks > 0) {
      return Math.max(1, Math.round(this.defaultNoteDurationTicks));
    }
    return this.getNoteLengthTicks();
  }

  setNoteLengthIndex(index) {
    if (isDrumTrack(this.getActiveTrack())) return;
    const total = NOTE_LENGTH_OPTIONS.length;
    const nextIndex = ((index % total) + total) % total;
    this.noteLengthIndex = nextIndex;
    this.defaultNoteDurationTicks = this.getNoteLengthTicks();
    if (this.quantizeOptions.length > 0) {
      this.quantizeIndex = Math.min(nextIndex, this.quantizeOptions.length - 1);
    }
    this.persist();
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
      if (channel === GM_DRUM_CHANNEL) continue;
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

  ensureGridPanCapacity(desiredOffsetX) {
    if (!this.gridBounds) return;
    if (desiredOffsetX >= 0) return;
    const viewW = this.gridBounds.w;
    const cellWidth = this.gridBounds.cellWidth;
    const requiredGridW = viewW - desiredOffsetX;
    const requiredTicks = Math.ceil(requiredGridW / cellWidth);
    if (requiredTicks > this.getGridTicks()) {
      this.ensureGridCapacity(Math.max(0, requiredTicks - 1));
    }
  }

  getEditableGridTick() {
    return this.getGridTicks();
  }

  getSongTimelineTicks() {
    return this.getGridTicks();
  }

  getSongTimelineZoomLimits() {
    return { minZoom: 1, maxZoom: 8 };
  }

  clampSongTimelineOffset(offsetX, viewW, totalW) {
    const minX = Math.min(0, viewW - totalW);
    return clamp(offsetX, minX, 0);
  }

  clampTimelineOffsetX(offsetX, viewW, cellWidth) {
    const totalW = cellWidth * this.getGridTicks();
    const minX = Math.min(0, viewW - totalW);
    return clamp(offsetX, minX, 0);
  }

  updateTimelineStartTickFromGrid() {
    if (!this.gridBounds) return;
    this.timelineStartTick = Math.max(0, -this.gridOffset.x / this.gridBounds.cellWidth);
    this.timelineSource = 'grid';
  }

  updateTimelineStartTickFromSong() {
    if (!this.songTimelineBounds) return;
    this.timelineStartTick = Math.max(0, -this.songTimelineOffsetX / this.songTimelineBounds.cellWidth);
    this.timelineSource = 'song';
  }

  ensureTimelineCapacity() {
    const timelineTicks = this.getGridTicks();
    const visibleTicks = timelineTicks / (this.gridZoomX || 1);
    const requiredTicks = Math.ceil(this.timelineStartTick + visibleTicks);
    if (requiredTicks > timelineTicks) {
      this.ensureGridCapacity(requiredTicks - 1);
    }
  }

  ensureTimelinePanCapacity(desiredOffsetX, viewW, cellWidth) {
    if (desiredOffsetX >= 0) return;
    const requiredGridW = viewW - desiredOffsetX;
    const requiredTicks = Math.ceil(requiredGridW / cellWidth);
    if (requiredTicks > this.getGridTicks()) {
      this.ensureGridCapacity(Math.max(0, requiredTicks - 1));
    }
  }

  setSongTimelineZoom(nextZoom, anchorTick = this.playheadTick) {
    const { minZoom, maxZoom } = this.getGridZoomLimitsX();
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    if (!this.songTimelineBounds) {
      this.gridZoomX = clampedZoom;
      return;
    }
    const {
      x,
      w,
      originX,
      cellWidth
    } = this.songTimelineBounds;
    const anchorX = originX + anchorTick * cellWidth;
    const baseCellWidth = cellWidth / (this.gridZoomX || 1);
    const nextCellWidth = baseCellWidth * clampedZoom;
    const nextOriginX = anchorX - anchorTick * nextCellWidth;
    this.gridZoomX = clampedZoom;
    this.songTimelineOffsetX = this.clampTimelineOffsetX(nextOriginX - x, w, nextCellWidth);
    this.updateTimelineStartTickFromSong();
    this.ensureTimelineCapacity();
  }

  getSongTimelineX(tick) {
    if (!this.songTimelineBounds) return 0;
    return this.songTimelineBounds.originX + tick * this.songTimelineBounds.cellWidth;
  }

  getSongSelectionRange() {
    if (!this.songSelection?.active) return null;
    const startTick = Math.min(this.songSelection.startTick, this.songSelection.endTick);
    const endTick = Math.max(this.songSelection.startTick, this.songSelection.endTick);
    if (!Number.isFinite(startTick) || !Number.isFinite(endTick)) return null;
    if (endTick <= startTick) return null;
    const trackTotal = this.song?.tracks?.length ?? 0;
    if (trackTotal <= 0) return null;
    const fallbackIndex = clamp(this.songSelection.trackIndex ?? 0, 0, Math.max(0, trackTotal - 1));
    const rawStart = Number.isInteger(this.songSelection.trackStartIndex) ? this.songSelection.trackStartIndex : fallbackIndex;
    const rawEnd = Number.isInteger(this.songSelection.trackEndIndex) ? this.songSelection.trackEndIndex : fallbackIndex;
    const startTrackIndex = clamp(Math.min(rawStart, rawEnd), 0, Math.max(0, trackTotal - 1));
    const endTrackIndex = clamp(Math.max(rawStart, rawEnd), 0, Math.max(0, trackTotal - 1));
    const trackIndices = [];
    for (let i = startTrackIndex; i <= endTrackIndex; i += 1) {
      trackIndices.push(i);
    }
    return {
      trackIndex: startTrackIndex,
      trackStartIndex: startTrackIndex,
      trackEndIndex: endTrackIndex,
      trackIndices,
      trackCount: trackIndices.length,
      startTick,
      endTick,
      durationTicks: endTick - startTick
    };
  }

  getSongLaneAt(x, y) {
    return this.songLaneBounds?.find((bounds) => this.pointInBounds(x, y, bounds)) || null;
  }

  isSongSelectionHit(tick, trackIndex) {
    const range = this.getSongSelectionRange();
    if (!range) return false;
    return trackIndex >= range.trackStartIndex
      && trackIndex <= range.trackEndIndex
      && tick >= range.startTick
      && tick <= range.endTick;
  }

  getAutomationValueAtTick(frames, tick, defaultValue) {
    if (!Array.isArray(frames) || frames.length === 0 || !Number.isFinite(tick)) {
      return defaultValue;
    }
    const sorted = [...frames].sort((a, b) => a.tick - b.tick);
    if (tick <= sorted[0].tick) return sorted[0].value ?? defaultValue;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (tick >= current.tick && tick <= next.tick) {
        const span = Math.max(1, next.tick - current.tick);
        const ratio = (tick - current.tick) / span;
        const currentValue = current.value ?? defaultValue;
        const nextValue = next.value ?? currentValue;
        return currentValue + (nextValue - currentValue) * ratio;
      }
    }
    return sorted[sorted.length - 1].value ?? defaultValue;
  }

  getTrackAutomationValue(track, type, tick, defaultValue) {
    if (!track) return defaultValue;
    const frames = track.automation?.[type] || [];
    return this.getAutomationValueAtTick(frames, tick, defaultValue);
  }

  getTrackPlaybackMix(track, tick = this.playheadTick) {
    if (!track) return { volume: 0, pan: 0 };
    if (!this.isPlaying) {
      return {
        volume: clamp(track.volume ?? 0.8, 0, 1),
        pan: clamp(track.pan ?? 0, -1, 1)
      };
    }
    const volume = this.getTrackAutomationValue(track, 'padding', tick, track.volume ?? 0.8);
    const pan = this.getTrackAutomationValue(track, 'pan', tick, track.pan ?? 0);
    return {
      volume: clamp(volume, 0, 1),
      pan: clamp(pan, -1, 1)
    };
  }

  getExpandedGridWidth() {
    if (!this.gridBounds) return 0;
    return this.gridBounds.cellWidth * this.getGridTicks();
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
    if (isDrumTrack(track)) return pitch;
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
    if (isDrumTrack(this.getActiveTrack())) {
      this.chordMode = false;
      this.song.chordMode = false;
      this.persist();
      return;
    }
    this.chordMode = Boolean(enabled);
    this.song.chordMode = this.chordMode;
    this.persist();
  }

  setReverseStrings(enabled) {
    this.reverseStrings = Boolean(enabled);
    this.song.reverseStrings = this.reverseStrings;
    this.touchInput.setReverseStrings(this.reverseStrings);
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

  enterRecordMode() {
    if (this.recordModeActive) return;
    this.recordModeActive = true;
    this.activeTab = 'grid';
    this.recordGridSnapshot = {
      gridZoomX: this.gridZoomX,
      gridZoomY: this.gridZoomY,
      gridZoomInitialized: this.gridZoomInitialized,
      gridOffset: this.gridOffset ? { ...this.gridOffset } : null
    };
    this.recordGridZoomedOut = false;
  }

  exitRecordMode() {
    if (!this.recordModeActive) return;
    if (this.recorder.isRecording) {
      this.stopRecording();
    }
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    }
    this.stopLivePreviewNotes();
    this.recordModeActive = false;
    if (this.recordGridSnapshot) {
      this.gridZoomX = this.recordGridSnapshot.gridZoomX;
      this.gridZoomY = this.recordGridSnapshot.gridZoomY;
      this.gridZoomInitialized = this.recordGridSnapshot.gridZoomInitialized;
      this.gridOffset = this.recordGridSnapshot.gridOffset ? { ...this.recordGridSnapshot.gridOffset } : { x: 0, y: 0 };
    }
    this.recordGridSnapshot = null;
    this.recordGridZoomedOut = false;
  }

  toggleSingleNoteRecordMode() {
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    } else {
      this.enterSingleNoteRecordMode();
    }
  }

  enterSingleNoteRecordMode() {
    if (this.recorder.isRecording) {
      this.stopRecording();
    }
    if (!this.recordModeActive) {
      this.enterRecordMode();
    }
    this.singleNoteRecordMode = {
      active: true,
      anchorTick: 0,
      measureStart: 0,
      measureEnd: 0,
      awaitingChord: true
    };
    this.setSingleNoteAnchorTick(this.playheadTick);
    this.singleNoteActiveNotes.clear();
  }

  exitSingleNoteRecordMode() {
    this.singleNoteRecordMode.active = false;
    this.singleNoteActiveNotes.clear();
  }

  setSingleNoteAnchorTick(tick) {
    const ticksPerBar = this.ticksPerBeat * this.beatsPerBar;
    const snappedTick = this.snapTick(tick);
    const measureStart = Math.floor(snappedTick / ticksPerBar) * ticksPerBar;
    this.singleNoteRecordMode.anchorTick = snappedTick;
    this.singleNoteRecordMode.measureStart = measureStart;
    this.singleNoteRecordMode.measureEnd = measureStart + ticksPerBar;
    this.cursor.tick = snappedTick;
    this.playheadTick = snappedTick;
  }

  advanceSingleNoteAnchor() {
    if (!this.singleNoteRecordMode.active) return;
    const step = Math.max(1, this.getQuantizeTicks());
    const loopEnd = this.getLoopTicks();
    const nextTick = clamp(this.singleNoteRecordMode.anchorTick + step, 0, Math.max(0, loopEnd - 1));
    this.setSingleNoteAnchorTick(nextTick);
  }

  clearNotesInMeasure(pattern, startTick, endTick) {
    if (!pattern) return;
    pattern.notes = pattern.notes.filter((note) => {
      if (note.startTick >= startTick && note.startTick < endTick) {
        this.selection.delete(note.id);
        return false;
      }
      return true;
    });
  }

  placeSingleNoteAtAnchor(track, pattern, pitch, velocity) {
    if (!track || !pattern) return;
    const drumTrack = isDrumTrack(track);
      const duration = drumTrack ? this.getDrumHitDurationTicks() : this.getPlacementDurationTicks(track);
    const note = {
      id: uid(),
      startTick: this.singleNoteRecordMode.anchorTick,
      durationTicks: duration,
      pitch,
      velocity: (velocity ?? 96) / 127
    };
    pattern.notes.push(note);
    this.selection.add(note.id);
    this.ensureGridCapacity(note.startTick + duration);
  }

  handleSingleNoteRecordOn(event) {
    const instrumentOverride = (event?.instrument === 'drums' || event?.channel === GM_DRUM_CHANNEL) ? 'drums' : null;
    const { track, pattern } = this.getRecordingTarget(instrumentOverride);
    if (!track || !pattern) return;
    const velocity = Number.isFinite(event.velocity) ? event.velocity : this.recordStatus.velocity;
    const clampedVelocity = clamp(velocity ?? 96, 1, 127);
    const drumTrack = isDrumTrack(track);
    const pitch = drumTrack
      ? this.coercePitchForTrack(event.pitch, track, GM_DRUM_ROWS)
      : event.pitch;
    if (this.singleNoteRecordMode.awaitingChord) {
      this.selection.clear();
      this.clearNotesInMeasure(pattern, this.singleNoteRecordMode.measureStart, this.singleNoteRecordMode.measureEnd);
      this.singleNoteRecordMode.awaitingChord = false;
    }
    if (!this.singleNoteActiveNotes.has(event.id)) {
      this.singleNoteActiveNotes.set(event.id, pitch);
      this.placeSingleNoteAtAnchor(track, pattern, pitch, clampedVelocity);
      this.persist();
    }
    const previewPitch = Number.isFinite(event.previewPitch) ? event.previewPitch : pitch;
    this.recordStatus.velocity = clampedVelocity;
    this.playLivePreviewNote(event.id, previewPitch, clampedVelocity, track, track.pan);
    this.updateNowPlayingDisplay(event, pitch, track);
    this.recordStatus.velocity = clampedVelocity;
  }

  handleSingleNoteRecordOff(event) {
    if (!this.singleNoteActiveNotes.has(event.id)) return;
    this.singleNoteActiveNotes.delete(event.id);
    if (this.singleNoteActiveNotes.size === 0) {
      this.singleNoteRecordMode.awaitingChord = true;
    }
    this.stopLivePreviewNote(event.id);
    this.clearNowPlayingDisplay(event);
  }

  playLivePreviewNote(id, pitch, velocity, track, pan = 0) {
    if (!id || !track) return;
    const drumTrack = isDrumTrack(track);
    if (drumTrack) {
      this.playGmNote(pitch, 0.4, (velocity / 127) * track.volume, track, pan);
      return;
    }
    if (this.game?.audio?.startLiveGmNote) {
      this.game.audio.startLiveGmNote({
        id,
        pitch,
        duration: 8,
        volume: (velocity / 127) * track.volume,
        program: track.program,
        channel: track.channel,
        bankMSB: track.bankMSB,
        bankLSB: track.bankLSB,
        pan
      });
      this.livePreviewNotes.add(id);
      return;
    }
    this.playGmNote(pitch, 0.4, (velocity / 127) * track.volume, track, pan);
  }

  stopLivePreviewNote(id) {
    if (!id || !this.livePreviewNotes.has(id)) return;
    if (this.game?.audio?.stopLiveGmNote) {
      this.game.audio.stopLiveGmNote(id);
    }
    this.livePreviewNotes.delete(id);
  }

  stopLivePreviewNotes() {
    if (!this.livePreviewNotes.size) return;
    if (this.game?.audio?.stopLiveGmNote) {
      this.livePreviewNotes.forEach((noteId) => this.game.audio.stopLiveGmNote(noteId));
    }
    this.livePreviewNotes.clear();
  }

  startRecording() {
    if (this.recorder.isRecording) return;
    if (!this.recordModeActive) {
      this.enterRecordMode();
    }
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    }
    if (!this.isPlaying) {
      this.togglePlayback();
    }
    const tempo = this.song.tempo || 120;
    const countInBars = this.recordCountInEnabled ? 1 : 0;
    const countInSeconds = countInBars * this.beatsPerBar * (60 / tempo);
    const startTime = this.getRecordingTime() + countInSeconds;
    this.recordCountIn = countInBars
      ? {
        startTime: this.getRecordingTime(),
        endTime: startTime,
        lastBeat: -1,
        beats: countInBars * this.beatsPerBar,
        tempo
      }
      : null;
    this.recorder.startRecording({
      tempo,
      ticksPerBeat: this.ticksPerBeat,
      beatsPerBar: this.beatsPerBar,
      startTime,
      quantizeDivisor: this.recordQuantizeEnabled ? this.recordQuantizeDivisor : null
    });
    this.playheadTick = 0;
    this.recordStartTime = startTime;
  }

  stopRecording() {
    if (!this.recordModeActive) return;
    this.stopPlayback();
    this.recordCountIn = null;
    if (this.recorder.isRecording) {
      this.recorder.stopRecording(this.getRecordingTime());
      const { track, pattern } = this.getRecordingTarget();
      if (pattern) {
        this.recorder.commitRecordedTakeToScore({ pattern, startTickOffset: 0 });
        if (isDrumTrack(track)) {
          this.ensureDrumTrackSettings(track);
          this.normalizeDrumPattern(track, pattern, GM_DRUM_ROWS);
        }
        this.persist();
        const lastNote = pattern.notes[pattern.notes.length - 1];
        if (lastNote) {
          this.playNote(track, lastNote, this.playheadTick);
        }
      }
    }
  }

  getRecordingTarget(instrumentOverride = null) {
    const track = this.getRecordingTrack(instrumentOverride);
    const pattern = track?.patterns?.[this.selectedPatternIndex] || null;
    return { track, pattern };
  }

  getRecordingTrack(instrumentOverride = null) {
    const instrument = instrumentOverride || this.recordInstrument;
    if (instrument === 'drums') {
      let drumTrack = this.song.tracks.find((candidate) => isDrumTrack(candidate));
      if (!drumTrack) {
        drumTrack = this.ensureDrumTrackSettings({
          id: `track-drums-${Date.now()}`,
          name: 'Drums',
          instrument: 'drums',
          channel: GM_DRUM_CHANNEL,
          program: 0,
          bankMSB: DRUM_BANK_MSB,
          bankLSB: DRUM_BANK_LSB,
          volume: 0.9,
          pan: 0,
          mute: false,
          solo: false,
          color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
          patterns: [{ id: `pattern-drums-${Date.now()}`, bars: this.song.loopBars, notes: [] }]
        });
        this.song.tracks.push(drumTrack);
      } else {
        this.ensureDrumTrackSettings(drumTrack);
      }
      const drumIndex = this.song.tracks.indexOf(drumTrack);
      if (drumIndex >= 0) {
        this.selectedTrackIndex = drumIndex;
      }
      return drumTrack;
    }
    return this.getActiveTrack();
  }

  handleRecordedNoteOn(event) {
    if (!this.recordModeActive) return;
    if (this.singleNoteRecordMode.active) {
      this.handleSingleNoteRecordOn(event);
      return;
    }
    const now = this.getRecordingTime();
    const instrumentOverride = (event?.instrument === 'drums' || event?.channel === GM_DRUM_CHANNEL) ? 'drums' : null;
    const { track } = this.getRecordingTarget(instrumentOverride);
    if (!track) return;
    const velocity = Number.isFinite(event.velocity) ? event.velocity : this.recordStatus.velocity;
    const clampedVelocity = clamp(velocity ?? 96, 1, 127);
    const drumTrack = isDrumTrack(track);
    const pitch = drumTrack
      ? this.coercePitchForTrack(event.pitch, track, GM_DRUM_ROWS)
      : event.pitch;
    this.recordStatus.velocity = clampedVelocity;
    this.recorder.recordNoteOn({
      id: event.id,
      pitch,
      velocity: clampedVelocity,
      time: now,
      channel: drumTrack ? GM_DRUM_CHANNEL : track.channel,
      trackId: track.id
    });
    const previewPitch = Number.isFinite(event.previewPitch) ? event.previewPitch : pitch;
    this.playLivePreviewNote(event.id, previewPitch, clampedVelocity, track, track.pan);
    this.updateNowPlayingDisplay(event, pitch, track);
  }

  handleRecordedNoteOff(event) {
    if (!this.recordModeActive) return;
    if (this.singleNoteRecordMode.active) {
      this.handleSingleNoteRecordOff(event);
      return;
    }
    this.recorder.recordNoteOff({ id: event.id, time: this.getRecordingTime() });
    this.stopLivePreviewNote(event.id);
    this.clearNowPlayingDisplay(event);
  }

  formatPitchLabel(pitch, track) {
    if (isDrumTrack(track)) {
      const drumRow = this.getDrumRows().find((row) => row.pitch === pitch);
      return drumRow?.label || `Drum ${pitch}`;
    }
    const normalized = Math.round(pitch ?? 0);
    const label = NOTE_LABELS[((normalized % 12) + 12) % 12];
    const octave = this.getOctaveLabel(normalized);
    return `${label}${octave}`;
  }

  updateNowPlayingDisplay(event, pitch, track) {
    if (!event) return;
    const notePitch = Number.isFinite(pitch) ? pitch : event.pitch;
    const label = event.displayLabel || this.formatPitchLabel(notePitch, track);
    const detail = event.displayDetail || '';
    const type = event.displayType || (isDrumTrack(track) ? 'drum' : 'note');
    this.nowPlaying = {
      active: true,
      label,
      detail,
      type
    };
    if (event.id) {
      this.nowPlayingNotes.set(event.id, { label, detail, type });
    }
  }

  clearNowPlayingDisplay(event) {
    if (!event?.id) return;
    this.nowPlayingNotes.delete(event.id);
    if (this.nowPlayingNotes.size === 0) {
      this.nowPlaying = {
        active: false,
        label: '',
        detail: '',
        type: 'note'
      };
    }
  }

  handleRecordedCc(event) {
    if (!this.recordModeActive) return;
    const { track } = this.getRecordingTarget();
    if (!track) return;
    if (event?.controller === 7) {
      const normalized = clamp((event.value ?? 127) / 127, 0, 1);
      this.game?.audio?.setMidiVolume?.(normalized);
    }
    this.recorder.recordCC({
      controller: event.controller,
      value: event.value,
      time: this.getRecordingTime(),
      channel: track.channel,
      trackId: track.id
    });
  }

  handleRecordedPitchBend(event) {
    if (!this.recordModeActive) return;
    const bendValue = Number.isFinite(event?.value) ? event.value : 8192;
    const bendSemitones = ((bendValue - 8192) / 8192) * 2;
    this.game?.audio?.setMidiPitchBend?.(bendSemitones);
    const { track } = this.getRecordingTarget();
    if (!track || isDrumTrack(track)) return;
    this.recorder.recordPitchBend({
      value: bendValue,
      time: this.getRecordingTime(),
      channel: track.channel,
      trackId: track.id
    });
  }

  update(input, dt) {
    this.ensureState();
    this.handleKeyboardShortcuts(input);
    this.handleGamepadInput(input, dt);
    this.updateRecordMode(dt);
    if (this.isPlaying) {
      this.advancePlayhead(dt);
    }
    this.cleanupActiveNotes();
  }

  updateRecordMode(dt) {
    if (!this.recordModeActive) {
      this.keyboardInput.setEnabled(false);
      this.gamepadInput.setEnabled(false);
      this.game?.audio?.setMidiPitchBend?.(0);
      return;
    }
    this.updateCountInMetronome();
    this.keyboardInput.setEnabled(true);
    const scale = SCALE_LIBRARY.find((entry) => entry.id === this.song.scale) || SCALE_LIBRARY[0];
    this.gamepadInput.setEnabled(true);
    this.gamepadInput.setScale({ key: this.song.key || 0, steps: scale.steps });
    this.gamepadInput.setInstrument(this.recordInstrument);
    this.gamepadInput.update();

    const gamepadConnected = this.gamepadInput.connected;
    const preferred = this.recordDevicePreference === 'auto'
      ? (gamepadConnected ? 'gamepad' : 'touch')
      : this.recordDevicePreference;
    this.recordLayout.setDevice(preferred);
    this.recordLayout.setInstrument(this.recordInstrument);
    this.recordLayout.quantizeEnabled = this.recordQuantizeEnabled;
    this.recordLayout.quantizeLabel = `1/${this.recordQuantizeDivisor}`;
    this.recordLayout.countInEnabled = this.recordCountInEnabled;
    this.recordLayout.metronomeEnabled = this.recordMetronomeEnabled;

    if (preferred === 'touch') {
      this.gamepadInput.setEnabled(false);
    }

    this.updateRecordSelectors();
    this.gamepadInput.setSelectorActive(this.recordSelector.active);

    const leftStick = this.gamepadInput.getLeftStick();
    const rightStick = this.gamepadInput.getRightStick();
    const leftMagnitude = Math.hypot(leftStick.x, leftStick.y);
    const rightMagnitude = Math.hypot(rightStick.x, rightStick.y);
    const leftActive = leftMagnitude > 0.3
      || (this.recordSelector.active && this.recordSelector.type === 'scale');
    const rightActive = rightMagnitude > 0.3
      || (this.recordSelector.active && this.recordSelector.type === 'key');
    const leftDegree = this.gamepadInput.leftStickStableDirection || this.recordStatus.degree || 1;
    const leftPitch = this.gamepadInput.getPitchForScaleStep(leftDegree - 1);
    const activeTrack = this.getActiveTrack();
    const leftNoteLabel = this.recordInstrument === 'drums' ? null : this.formatPitchLabel(leftPitch, activeTrack);
    const bendSemitones = this.gamepadInput.getPitchBendSemitones();
    const bendDisplaySemitones = Math.round(bendSemitones * 2) / 2;
    const bendBasePitch = leftPitch;
    const bendTargetPitch = bendBasePitch + bendDisplaySemitones;
    const bendBaseLabel = this.recordInstrument === 'drums'
      ? ''
      : this.formatPitchLabel(bendBasePitch, activeTrack);
    const bendTargetLabel = this.recordInstrument === 'drums'
      ? ''
      : this.formatPitchLabel(bendTargetPitch, activeTrack);
    const bendActive = preferred === 'gamepad'
      && this.recordInstrument !== 'drums'
      && (Math.abs(bendSemitones) > 0.05 || rightActive);
    this.recordStickIndicators = {
      left: {
        x: leftStick.x,
        y: leftStick.y,
        active: leftActive,
        degree: leftDegree,
        noteLabel: leftNoteLabel
      },
      right: { x: rightStick.x, y: rightStick.y, active: rightActive },
      bend: {
        active: bendActive,
        semitones: bendSemitones,
        displaySemitones: bendDisplaySemitones,
        baseLabel: bendBaseLabel,
        targetLabel: bendTargetLabel
      }
    };

    const shouldApplyBend = preferred === 'gamepad'
      && !this.recordSelector.active
      && this.recordInstrument !== 'drums';
    if (shouldApplyBend) {
      this.game?.audio?.setMidiPitchBend?.(this.gamepadInput.getPitchBendSemitones());
    } else {
      this.game?.audio?.setMidiPitchBend?.(0);
    }

    this.recordStatus.degree = this.gamepadInput.leftStickStableDirection || this.recordStatus.degree;
    this.recordStatus.octave = this.gamepadInput.octaveOffset;
    if (preferred !== 'gamepad') {
      this.recordStatus.velocity = this.keyboardInput.velocity || this.recordStatus.velocity;
    }
    if (this.recorder.isRecording) {
      const elapsed = Math.max(0, this.getRecordingTime() - this.recorder.startTime);
      const ticks = (elapsed * this.song.tempo / 60) * this.ticksPerBeat;
      this.playheadTick = clamp(ticks, 0, this.getLoopTicks());
    }
  }

  toggleRecordSelector(type) {
    if (this.recordSelector.active && this.recordSelector.type === type) {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }
    this.recordSelector.active = true;
    this.recordSelector.type = type;
    this.recordSelector.stickEngaged = false;
    if (type === 'key') {
      this.recordSelector.index = clamp(this.song.key || 0, 0, KEY_LABELS.length - 1);
    } else {
      const scaleIndex = SCALE_LIBRARY.findIndex((entry) => entry.id === this.song.scale);
      this.recordSelector.index = scaleIndex >= 0 ? scaleIndex : 0;
    }
  }

  updateRecordSelectors() {
    if (this.recordInstrument === 'drums') {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }
    if (this.gamepadInput.wasButtonPressed(10)) {
      this.toggleRecordSelector('scale');
    }
    if (this.gamepadInput.wasButtonPressed(11)) {
      this.toggleRecordSelector('key');
    }
    if (!this.recordSelector.active || !this.recordSelector.type) return;
    if (this.recordSelector.type === 'scale') {
      const { x, y } = this.gamepadInput.getLeftStick();
      if (Math.hypot(x, y) < 0.6) return;
      const itemCount = SCALE_LIBRARY.length;
      const nextIndex = radialIndexFromStick(x, y, itemCount);
      if (nextIndex !== this.recordSelector.index) {
        this.recordSelector.index = nextIndex;
        this.song.scale = SCALE_LIBRARY[nextIndex]?.id || SCALE_LIBRARY[0].id;
        this.persist();
      }
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }

    const { x, y } = this.gamepadInput.getRightStick();
    const magnitude = Math.hypot(x, y);
    if (magnitude >= 0.6) {
      this.recordSelector.stickEngaged = true;
      const itemCount = KEY_LABELS.length;
      const nextIndex = radialIndexFromStick(x, y, itemCount);
      if (nextIndex !== this.recordSelector.index) {
        this.recordSelector.index = nextIndex;
        this.song.key = nextIndex;
        this.persist();
      }
      return;
    }
    if (magnitude <= 0.3 && this.recordSelector.stickEngaged) {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
    }
  }

  updateCountInMetronome() {
    if (!this.recordCountIn) return;
    const now = this.getRecordingTime();
    if (now >= this.recordCountIn.endTime) {
      this.recordCountIn = null;
      return;
    }
    const beatDuration = 60 / (this.recordCountIn.tempo || this.song.tempo || 120);
    const elapsed = Math.max(0, now - this.recordCountIn.startTime);
    const beatIndex = Math.floor(elapsed / beatDuration);
    const cappedBeat = Math.min(this.recordCountIn.beats - 1, beatIndex);
    if (cappedBeat <= this.recordCountIn.lastBeat) return;
    for (let beat = this.recordCountIn.lastBeat + 1; beat <= cappedBeat; beat += 1) {
      const pitch = beat % this.beatsPerBar === 0 ? 84 : 72;
      if (this.game?.audio?.playMidiNote) {
        this.game.audio.playMidiNote(pitch, 'sine', 0.15, 0.45);
      }
    }
    this.recordCountIn.lastBeat = cappedBeat;
  }

  handleKeyboardShortcuts(input) {
    const ctrl = input.isDownCode?.('ControlLeft') || input.isDownCode?.('ControlRight');
    const meta = input.isDownCode?.('MetaLeft') || input.isDownCode?.('MetaRight');
    const cmd = ctrl || meta;
    if (input.wasPressedCode?.('Enter')) {
      if (this.recordModeActive) {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      } else {
        this.enterRecordMode();
      }
    }
    if (cmd && input.wasPressedCode?.('KeyC')) {
      this.copySelection();
    }
    if (cmd && input.wasPressedCode?.('KeyZ')) {
      this.undo();
    }
    if (cmd && (input.wasPressedCode?.('KeyY') || (input.isShiftDown?.() && input.wasPressedCode?.('KeyZ')))) {
      this.redo();
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
    const suppressedButtons = new Set();
    const handleMappedPress = (actionId, callback) => {
      const mapped = this.controllerMapping?.[actionId];
      if (!mapped || suppressedButtons.has(mapped)) return;
      if (actionId === 'tool' && mapped === this.controllerMapping?.erase) return;
      const gamepadAction = resolveAction(mapped);
      if (gamepadAction && input.wasGamepadPressed?.(gamepadAction)) {
        callback();
      }
    };

    const drumTrack = isDrumTrack(this.getActiveTrack());
    const axes = input.getGamepadAxes?.() || {};
    const rtHeld = (axes.rightTrigger || 0) > 0.2;
    const ltHeld = (axes.leftTrigger || 0) > 0.2;
    const rtPressed = rtHeld && !this.gamepadRtHeld;
    const rtReleased = !rtHeld && this.gamepadRtHeld;
    const ltPressed = ltHeld && !this.gamepadLtHeld;
    const lbHeld = input.isGamepadDown?.('aimUp');
    const lbPressed = input.wasGamepadPressed?.('aimUp');
    const dpadLeftPressed = input.wasGamepadPressed?.('dpadLeft');
    const dpadRightPressed = input.wasGamepadPressed?.('dpadRight');
    const dpadUpPressed = input.wasGamepadPressed?.('dpadUp');
    const dpadDownPressed = input.wasGamepadPressed?.('dpadDown');
    const backPressed = input.wasGamepadPressed?.('cancel');

    if (this.activeTab === 'grid' && !this.recordModeActive) {
      if (input.wasGamepadPressed?.('dash')) {
        this.undo();
        suppressedButtons.add('B');
      }
      if (input.wasGamepadPressed?.('throw')) {
        this.redo();
        suppressedButtons.add('Y');
      }
      if (input.wasGamepadPressed?.('rev')) {
        this.eraseNoteAt(this.cursor.tick, this.cursor.pitch);
        suppressedButtons.add('X');
      }
    }

    handleMappedPress('play', () => {
      if (this.singleNoteRecordMode.active) {
        this.advanceSingleNoteAnchor();
      } else {
        this.togglePlayback();
      }
    });
    const stopMapped = resolveAction(this.controllerMapping?.stop);
    const suppressStop = stopMapped === 'cancel' && backPressed;
    if (!suppressStop) {
      handleMappedPress('stop', () => this.stopPlayback());
    }
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
      if (drumTrack) return;
      const range = this.getPitchRange();
      this.cursor.pitch = clamp(this.cursor.pitch + 12, range.min, range.max);
    });
    handleMappedPress('octaveDown', () => {
      if (drumTrack) return;
      const range = this.getPitchRange();
      this.cursor.pitch = clamp(this.cursor.pitch - 12, range.min, range.max);
    });

    if (backPressed) {
      if (this.singleNoteRecordMode.active || this.recordModeActive) {
        this.exitSingleNoteRecordMode();
        this.exitRecordMode();
      } else {
        this.enterSingleNoteRecordMode();
      }
    }

    if (this.activeTab === 'grid') {
      this.gamepadMoveCooldown = Math.max(0, this.gamepadMoveCooldown - dt);
      this.gamepadResizeCooldown = Math.max(0, this.gamepadResizeCooldown - dt);
      if (this.selection.size === 0) {
        this.gamepadResizeMode.active = false;
      }
      if (lbPressed && this.selection.size > 0) {
        this.gamepadResizeMode.active = !this.gamepadResizeMode.active;
      }
      if (lbHeld) {
        const now = performance.now();
        const tapWindow = 320;
        if (dpadUpPressed) {
          this.togglePlayback();
        }
        if (dpadDownPressed) {
          if (this.recordModeActive) {
            if (this.recorder.isRecording) {
              this.stopRecording();
            } else {
              this.startRecording();
            }
          } else {
            this.enterRecordMode();
          }
        }
        if (dpadLeftPressed) {
          if (now - this.gamepadTransportTap.left < tapWindow) {
            this.returnToStart();
          } else {
            this.jumpPlayheadBars(-1);
          }
          this.gamepadTransportTap.left = now;
        }
        if (dpadRightPressed) {
          if (now - this.gamepadTransportTap.right < tapWindow) {
            this.goToEnd();
          } else {
            this.jumpPlayheadBars(1);
          }
          this.gamepadTransportTap.right = now;
        }
      }
      if (!this.recordModeActive) {
        const tickStep = Math.max(1, this.getQuantizeTicks());
        if (ltPressed) {
          this.playheadTick = clamp(
            this.playheadTick - tickStep,
            0,
            this.getEditableGridTick()
          );
          if (this.scrubAudition) {
            this.previewNotesAtTick(this.playheadTick);
          }
        }
        if (rtPressed) {
          this.playheadTick = clamp(
            this.playheadTick + tickStep,
            0,
            this.getEditableGridTick()
          );
          if (this.scrubAudition) {
            this.previewNotesAtTick(this.playheadTick);
          }
        }
      }

      if (!this.recordModeActive && this.gridBounds) {
        const panDeadzone = 0.2;
        const panX = Math.abs(axes.rightX) > panDeadzone ? axes.rightX : 0;
        const panY = Math.abs(axes.rightY) > panDeadzone ? axes.rightY : 0;
        if (panX || panY) {
          const panSpeed = 420;
          this.gridOffset.x -= panX * panSpeed * dt;
          this.gridOffset.y -= panY * panSpeed * dt;
          this.ensureGridPanCapacity(this.gridOffset.x);
          this.clampGridOffset(
            this.gridBounds.w,
            this.gridBounds.h,
            this.getExpandedGridWidth(),
            this.gridBounds.gridH
          );
          this.updateTimelineStartTickFromGrid();
        }
      }

      if (this.gamepadResizeMode.active) {
        const resizeStep = Math.max(1, this.getQuantizeTicks());
        if (this.gamepadResizeCooldown <= 0) {
          const grow = axes.leftX > 0.55 || axes.leftY < -0.55 || axes.leftY > 0.55;
          const shrink = axes.rightX > 0.55 || axes.rightY < -0.55 || axes.rightY > 0.55;
          if (grow) {
            this.resizeSelectedNotesBy(resizeStep);
            this.gamepadResizeCooldown = 0.12;
          } else if (shrink) {
            this.resizeSelectedNotesBy(-resizeStep);
            this.gamepadResizeCooldown = 0.12;
          }
        }
      }

      if (!lbHeld && !ltHeld && !this.gamepadResizeMode.active) {
        const left = input.isGamepadDown?.('left') || input.isGamepadDown?.('dpadLeft');
        const right = input.isGamepadDown?.('right') || input.isGamepadDown?.('dpadRight');
        const up = input.isGamepadDown?.('up') || input.isGamepadDown?.('dpadUp');
        const down = input.isGamepadDown?.('down') || input.isGamepadDown?.('dpadDown');
        const moveX = right ? 1 : left ? -1 : 0;
        const moveY = down ? 1 : up ? -1 : 0;
        if ((moveX || moveY) && this.gamepadMoveCooldown <= 0) {
          const step = this.getQuantizeTicks();
          const range = this.getPitchRange();
          const maxTick = this.getGridTicks();
          this.cursor.tick = clamp(this.cursor.tick + moveX * step, 0, maxTick);
          this.cursor.pitch = clamp(this.cursor.pitch - moveY, range.min, range.max);
          this.gamepadMoveCooldown = 0.12;
          this.gamepadCursorActive = true;
          this.ensureCursorVisible();
        }
      }

      if (this.gamepadSelection.active && this.dragState?.mode === 'select') {
        const pos = this.getCellScreenPosition(this.cursor.tick, this.cursor.pitch);
        if (pos) {
          this.updateSelectionBox(pos.x, pos.y);
        }
      }

      if (rtReleased && this.gamepadSelection.active) {
        this.finalizeSelectionBox();
        this.dragState = null;
        this.gamepadSelection = { active: false };
        if (this.selection.size === 0) {
          this.closeSelectionMenu();
        }
      }
    }

    this.gamepadRtHeld = rtHeld;
    this.gamepadLtHeld = ltHeld;
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
    if (!this.slurEnabled || isDrumTrack(track)) return false;
    return pattern.notes.some((other) => {
      if (other.id === note.id || other.pitch !== note.pitch) return false;
      const otherEnd = other.startTick + other.durationTicks;
      return other.startTick < note.startTick && otherEnd >= note.startTick;
    });
  }

  playNote(track, note, startTick) {
    const drumTrack = isDrumTrack(track);
    const durationTicks = drumTrack ? this.getDrumHitDurationTicks() : note.durationTicks;
    const duration = durationTicks / this.ticksPerBeat;
    const velocity = note.velocity ?? 0.8;
    const pitch = drumTrack ? this.coercePitchForTrack(note.pitch, track, GM_DRUM_ROWS) : note.pitch;
    if (drumTrack) {
      this.ensureDrumTrackSettings(track);
    }
    const mix = this.getTrackPlaybackMix(track, startTick);
    this.playGmNote(pitch, duration, velocity * mix.volume, track, mix.pan);
    const now = performance.now();
    this.activeNotes.set(note.id, { trackId: track.id, expires: now + duration * 1000 + 120 });
    this.lastPlaybackTick = startTick;
  }

  playGmNote(pitch, duration, volume, track, pan = 0) {
    if (this.game?.audio?.playGmNote) {
      const drumTrack = isDrumTrack(track);
      const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
      const resolvedDuration = drumTrack ? this.getDrumHitDurationTicks() / this.ticksPerBeat : duration;
      if (drumTrack) {
        this.ensureDrumTrackSettings(track);
      }
      this.game.audio.playGmNote({
        pitch: resolvedPitch,
        duration: resolvedDuration,
        volume,
        program: track.program,
        channel: drumTrack ? GM_DRUM_CHANNEL : track.channel,
        bankMSB: drumTrack ? (track.bankMSB ?? DRUM_BANK_MSB) : track.bankMSB,
        bankLSB: drumTrack ? DRUM_BANK_LSB : track.bankLSB,
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
    if (this.recordModeActive) {
      const action = this.recordLayout.handlePointerDown(payload);
      if (action?.type === 'device') {
        this.recordDevicePreference = action.value;
        return;
      }
      if (action?.type === 'instrument') {
        this.recordInstrument = action.value;
        return;
      }
      if (action?.type === 'quantize') {
        this.recordQuantizeEnabled = this.recordLayout.quantizeEnabled;
        return;
      }
      if (action?.type === 'countin') {
        this.recordCountInEnabled = this.recordLayout.countInEnabled;
        return;
      }
      if (action?.type === 'metronome') {
        this.recordMetronomeEnabled = this.recordLayout.metronomeEnabled;
        return;
      }
      if (action?.type === 'playback-play') {
        this.togglePlayback();
        return;
      }
      if (action?.type === 'playback-stop') {
        this.stopPlayback();
        return;
      }
      if (action?.type === 'record-toggle') {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
        return;
      }
      if (action?.type === 'touch') {
        return;
      }
      if (action?.type) {
        return;
      }
      const tabHit = this.bounds.tabs?.find((tab) => this.pointInBounds(x, y, tab));
      if (tabHit) {
        this.activeTab = tabHit.id;
        this.exitRecordMode();
        return;
      }
      if (this.bounds.fileButton && this.pointInBounds(x, y, this.bounds.fileButton)) {
        this.activeTab = 'file';
        this.exitRecordMode();
        return;
      }
      if (this.bounds.undoButton && this.pointInBounds(x, y, this.bounds.undoButton)) {
        this.undo();
        return;
      }
      if (this.bounds.redoButton && this.pointInBounds(x, y, this.bounds.redoButton)) {
        this.redo();
        return;
      }
      return;
    }
    if (this.qaOverlayOpen) {
      const hit = this.qaBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (hit) {
        if (hit.id === 'qa-load') this.loadDemoSong();
        if (hit.id === 'qa-run') this.runQaChecks();
        if (hit.id === 'qa-close') this.qaOverlayOpen = false;
      }
      return;
    }

    if (this.activeTab === 'file') {
      const fileHit = this.fileMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (fileHit) {
        this.handleFileMenu(fileHit.id);
        return;
      }
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
      if (isDrumTrack(this.getActiveTrack())) {
        this.noteLengthMenu.open = false;
        return;
      }
      this.setNoteLengthIndex(noteLengthHit.index);
      this.noteLengthMenu.open = false;
      return;
    }

    if (this.activeTab === 'grid') {
      if (this.bounds.keyframeToggle && this.pointInBounds(x, y, this.bounds.keyframeToggle)) {
        this.keyframePanelOpen = !this.keyframePanelOpen;
        return;
      }
      if (this.bounds.keyframeSet && this.pointInBounds(x, y, this.bounds.keyframeSet)) {
        const track = this.getActiveTrack();
        if (track) {
          const tick = this.snapTick(this.playheadTick);
          const volume = clamp(track.volume ?? 0.8, 0, 1);
          const pan = clamp(track.pan ?? 0, -1, 1);
          this.addSongAutomationKeyframe(track, 'padding', tick, volume);
          this.addSongAutomationKeyframe(track, 'pan', tick, pan);
        }
        return;
      }
      if (this.bounds.keyframeRemove && this.pointInBounds(x, y, this.bounds.keyframeRemove)) {
        const track = this.getActiveTrack();
        if (track) {
          const tick = this.snapTick(this.playheadTick);
          this.removeSongAutomationKeyframe(track, 'padding', tick);
          this.removeSongAutomationKeyframe(track, 'pan', tick);
        }
        return;
      }
    }

    if (this.bounds.record && this.pointInBounds(x, y, this.bounds.record)) {
      this.enterRecordMode();
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
      this.activeTab = 'file';
      this.toolsMenuOpen = false;
      this.genreMenuOpen = false;
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }
    if (this.bounds.undoButton && this.pointInBounds(x, y, this.bounds.undoButton)) {
      this.undo();
      return;
    }
    if (this.bounds.redoButton && this.pointInBounds(x, y, this.bounds.redoButton)) {
      this.redo();
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
      if (isDrumTrack(this.getActiveTrack())) return;
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
          this.downloadInstrumentProgram(
            downloadProgram,
            pickerTrack?.channel ?? 0,
            pickerTrack?.bankMSB ?? DEFAULT_BANK_MSB,
            pickerTrack?.bankLSB ?? DEFAULT_BANK_LSB
          );
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

    if (this.activeTab === 'song') {
      if (this.songSplitTool.active) {
        const splitActionHit = this.songSplitTool.bounds?.splitAction && this.pointInBounds(x, y, this.songSplitTool.bounds.splitAction);
        if (splitActionHit) {
          this.applySongSplitTool();
          return;
        }
        const splitCancelHit = this.songSplitTool.bounds?.cancelAction && this.pointInBounds(x, y, this.songSplitTool.bounds.cancelAction);
        if (splitCancelHit) {
          this.songSplitTool.active = false;
          return;
        }
        const splitHandleHit = (this.songSplitTool.bounds?.handleTop && this.pointInBounds(x, y, this.songSplitTool.bounds.handleTop))
          || (this.songSplitTool.bounds?.handleBottom && this.pointInBounds(x, y, this.songSplitTool.bounds.handleBottom))
          || (this.songSplitTool.bounds?.lineGrab && this.pointInBounds(x, y, this.songSplitTool.bounds.lineGrab));
        if (splitHandleHit) {
          this.dragState = { mode: 'song-split-adjust' };
          return;
        }
      }
      if (this.songShiftTool.active) {
        const applyHit = this.songShiftTool.bounds?.apply && this.pointInBounds(x, y, this.songShiftTool.bounds.apply);
        if (applyHit) {
          this.applySongShiftTool();
          return;
        }
        const cancelHit = this.songShiftTool.bounds?.cancel && this.pointInBounds(x, y, this.songShiftTool.bounds.cancel);
        if (cancelHit) {
          this.songShiftTool.active = false;
          return;
        }
        const sliderHit = this.songShiftTool.bounds?.slider && this.pointInBounds(x, y, this.songShiftTool.bounds.slider);
        if (sliderHit) {
          this.dragState = { mode: 'song-shift-slider' };
          return;
        }
      }
      const menuHit = this.songSelectionMenu.open
        ? this.songSelectionMenu.bounds?.find((bounds) => this.pointInBounds(x, y, bounds))
        : null;
      if (menuHit) {
        this.handleSongAction(menuHit.action);
        return;
      }
      const actionHit = this.songActionBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (actionHit?.action === 'song-toggle-automation') {
        this.keyframePanelOpen = !this.keyframePanelOpen;
        return;
      }
      if (this.songSelectionMenu.open) {
        this.clearSongSelection();
      }
      if (this.songPlayheadBounds && this.pointInBounds(x, y, this.songPlayheadBounds)) {
        this.playheadTick = clamp(this.getSongTickFromX(x, this.songTimelineBounds), 0, this.getSongTimelineTicks());
        this.dragState = { mode: 'song-playhead', bounds: this.songTimelineBounds };
        return;
      }
      if (this.bounds.loopStartHandle && this.pointInBounds(x, y, this.bounds.loopStartHandle)) {
        this.dragState = { mode: 'song-loop-start' };
        this.setLoopStartTick(this.getSongTickFromX(x, this.songTimelineBounds));
        return;
      }
      if (this.bounds.loopEndHandle && this.pointInBounds(x, y, this.bounds.loopEndHandle)) {
        this.dragState = { mode: 'song-loop-end' };
        this.setLoopEndTick(this.getSongTickFromX(x, this.songTimelineBounds));
        return;
      }
      if (this.bounds.songZoomOut && this.pointInBounds(x, y, this.bounds.songZoomOut)) {
        this.setSongTimelineZoom(this.gridZoomX / 1.5);
        return;
      }
      if (this.bounds.songZoomIn && this.pointInBounds(x, y, this.bounds.songZoomIn)) {
        this.setSongTimelineZoom(this.gridZoomX * 1.5);
        return;
      }
      if (this.songInstrumentBounds && this.pointInBounds(x, y, this.songInstrumentBounds)) {
        this.openInstrumentPicker('edit', this.selectedTrackIndex);
        return;
      }
      if (this.songAddBounds && this.pointInBounds(x, y, this.songAddBounds)) {
        this.addTrack();
        return;
      }
      const labelHit = this.songLabelBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (labelHit) {
        this.selectedTrackIndex = labelHit.trackIndex;
        this.clearSongSelection();
        return;
      }
      const automationHit = this.songAutomationBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (automationHit) {
        const track = this.song.tracks[automationHit.trackIndex];
        const tick = this.getSongTickFromX(x, automationHit);
        const ratio = clamp((automationHit.y + automationHit.h - y) / automationHit.h, 0, 1);
        const minValue = automationHit.type === 'pan' ? -1 : 0;
        const maxValue = automationHit.type === 'pan' ? 1 : 1;
        const value = minValue + ratio * (maxValue - minValue);
        this.selectedTrackIndex = automationHit.trackIndex;
        this.addSongAutomationKeyframe(track, automationHit.type, tick, value);
        return;
      }
      const partHandleHit = this.songPartHandleBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (partHandleHit) {
        this.selectedTrackIndex = partHandleHit.trackIndex;
        const pattern = this.song.tracks[partHandleHit.trackIndex]?.patterns?.[this.selectedPatternIndex];
        const range = this.getPatternPartRange(pattern, partHandleHit.partIndex, this.getSongTimelineTicks());
        this.songSelection = {
          active: true,
          trackIndex: partHandleHit.trackIndex,
          trackStartIndex: partHandleHit.trackIndex,
          trackEndIndex: partHandleHit.trackIndex,
          startTick: range.startTick,
          endTick: range.endTick
        };
        this.dragState = {
          mode: 'song-part-resize',
          trackIndex: partHandleHit.trackIndex,
          partIndex: partHandleHit.partIndex,
          edge: partHandleHit.edge
        };
        return;
      }
      const partHit = this.songPartBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (partHit) {
        this.selectedTrackIndex = partHit.trackIndex;
        this.songSelection = {
          active: true,
          trackIndex: partHit.trackIndex,
          trackStartIndex: partHit.trackIndex,
          trackEndIndex: partHit.trackIndex,
          startTick: partHit.startTick,
          endTick: partHit.endTick
        };
        this.dragState = {
          mode: 'song-part-move',
          startX: x,
          startY: y,
          sourceTrackIndex: partHit.trackIndex,
          partIndex: partHit.partIndex,
          offsetTick: this.getSongTickFromX(x, partHit) - partHit.startTick,
          targetTrackIndex: partHit.trackIndex,
          targetStartTick: partHit.startTick,
          moved: false
        };
        return;
      }
      const laneHit = this.songLaneBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (laneHit) {
        this.selectedTrackIndex = laneHit.trackIndex;
        const modifiers = this.getModifiers();
        const isTouch = payload.touchCount > 0;
        const tick = this.getSongTickFromX(x, laneHit);
        const selectionRange = this.getSongSelectionRange();
        const inSelection = this.isSongSelectionHit(tick, laneHit.trackIndex);
        if (inSelection && isTouch) {
          const track = this.song.tracks[laneHit.trackIndex];
          const pattern = track?.patterns?.[this.selectedPatternIndex];
          if (!pattern) return;
          const selectionNotesByTrack = selectionRange?.trackIndices?.map((trackIndex) => {
            const sourceTrack = this.song.tracks[trackIndex];
            const sourcePattern = sourceTrack?.patterns?.[this.selectedPatternIndex];
            return {
              trackIndex,
              notes: this.getSongNotesOverlapping(sourcePattern, selectionRange)
            };
          }).filter((entry) => entry.notes?.length) || [];
          this.songSelectionMenu.open = false;
          this.songSelectionMenu.bounds = [];
          this.dragState = {
            mode: 'song-move-pending',
            startX: x,
            startY: y,
            startOffsetX: this.songTimelineOffsetX,
            offsetTick: tick - selectionRange.startTick,
            originalRange: selectionRange,
            targetTrackIndex: selectionRange.trackStartIndex,
            targetStartTick: selectionRange.startTick,
            originalNotesByTrack: selectionNotesByTrack,
            grabTrackOffset: laneHit.trackIndex - selectionRange.trackStartIndex,
            moved: false
          };
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
          }
          this.longPressTimer = window.setTimeout(() => {
            if (navigator?.vibrate) {
              navigator.vibrate(20);
            }
            this.dragState = {
              ...this.dragState,
              mode: 'song-move',
              startX: this.lastPointer.x,
              startY: this.lastPointer.y
            };
            this.longPressTimer = null;
          }, 450);
          return;
        }
        if (isTouch) {
          this.clearSongSelection();
          this.dragState = {
            mode: 'song-pan-or-select',
            startX: x,
            startY: y,
            startOffsetX: this.songTimelineOffsetX,
            bounds: laneHit,
            trackIndex: laneHit.trackIndex,
            startTick: tick,
            moved: false
          };
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
          }
          this.longPressTimer = window.setTimeout(() => {
            this.songSelection = {
              active: true,
              trackIndex: laneHit.trackIndex,
              trackStartIndex: laneHit.trackIndex,
              trackEndIndex: laneHit.trackIndex,
              startTick: tick,
              endTick: tick
            };
            this.dragState = {
              mode: 'song-select',
              bounds: laneHit,
              startX: this.lastPointer.x,
              startY: this.lastPointer.y,
              startTick: tick,
              trackIndex: laneHit.trackIndex
            };
            this.longPressTimer = null;
          }, 450);
          return;
        }
        this.clearSongSelection();
        const wantsSelection = modifiers.shift;
        if (wantsSelection) {
          this.dragState = {
            mode: 'song-select-pending',
            bounds: laneHit,
            startX: x,
            startY: y,
            startTick: tick,
            trackIndex: laneHit.trackIndex
          };
          return;
        }
        this.dragState = {
          mode: 'song-pan',
          startX: x,
          startOffsetX: this.songTimelineOffsetX,
          trackIndex: laneHit.trackIndex,
          moved: false
        };
        return;
      }
      if (this.songRulerBounds && this.pointInBounds(x, y, this.songRulerBounds)) {
        const tick = this.getSongTickFromX(x, this.songTimelineBounds);
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
        this.clearSongSelection();
        this.dragState = {
          mode: 'song-scrub',
          bounds: this.songTimelineBounds
        };
        return;
      }
      if (this.songTimelineBounds && this.pointInBounds(x, y, this.songTimelineBounds)) {
        this.clearSongSelection();
        this.dragState = {
          mode: 'song-pan',
          startX: x,
          startOffsetX: this.songTimelineOffsetX
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
        if (isDrumTrack(this.getActiveTrack())) return;
        this.setChordMode(!this.chordMode);
        return;
      }
      if (this.bounds.chordEdit && this.pointInBounds(x, y, this.bounds.chordEdit)) {
        if (isDrumTrack(this.getActiveTrack())) return;
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
        this.gridZoomX = clamp(this.gridZoomX / 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomInX && this.pointInBounds(x, y, this.bounds.zoomInX)) {
        const { minZoom, maxZoom } = this.getGridZoomLimitsX();
        this.gridZoomX = clamp(this.gridZoomX * 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomOutY && this.pointInBounds(x, y, this.bounds.zoomOutY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY / 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomInY && this.pointInBounds(x, y, this.bounds.zoomInY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY * 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
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
        this.playheadTick = clamp(tick, 0, this.getEditableGridTick());
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
    if (this.recordModeActive) {
      this.recordLayout.handlePointerMove(payload);
      return;
    }
    if (this.qaOverlayOpen) return;
    if (this.dragState?.mode === 'song-pan-or-select') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.dragState.mode = 'song-pan';
      }
      if (this.dragState.mode === 'song-pan' && this.songTimelineBounds) {
        const nextOffset = this.dragState.startOffsetX + dx;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
      return;
    }
    if (this.dragState?.mode === 'song-move-pending') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.dragState.mode = 'song-pan';
        if (this.songTimelineBounds) {
          const nextOffset = this.dragState.startOffsetX + dx;
          this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
          this.songTimelineOffsetX = this.clampTimelineOffsetX(
            nextOffset,
            this.songTimelineBounds.w,
            this.songTimelineBounds.cellWidth
          );
          this.updateTimelineStartTickFromSong();
          this.ensureTimelineCapacity();
        }
      }
      return;
    }
    if (this.dragState?.mode === 'song-move') {
      const laneHit = this.getSongLaneAt(payload.x, payload.y) || this.songLaneBounds?.[this.dragState.targetTrackIndex];
      if (laneHit) {
        const tick = this.getSongTickFromX(payload.x, laneHit);
        const duration = this.dragState.originalRange.durationTicks;
        const totalTicks = this.getSongTimelineTicks();
        const nextStartTick = clamp(tick - this.dragState.offsetTick, 0, Math.max(0, totalTicks - duration));
        const trackCount = this.dragState.originalRange.trackCount || 1;
        const maxStartTrack = Math.max(0, this.song.tracks.length - trackCount);
        const nextStartTrackIndex = clamp(
          laneHit.trackIndex - (this.dragState.grabTrackOffset ?? 0),
          0,
          maxStartTrack
        );
        this.dragState.targetTrackIndex = nextStartTrackIndex;
        this.dragState.targetStartTick = nextStartTick;
        this.dragState.moved = true;
        this.songSelection = {
          active: true,
          trackIndex: nextStartTrackIndex,
          trackStartIndex: nextStartTrackIndex,
          trackEndIndex: nextStartTrackIndex + trackCount - 1,
          startTick: nextStartTick,
          endTick: nextStartTick + duration
        };
      }
      return;
    }
    if (this.dragState?.mode === 'song-part-move') {
      const laneHit = this.getSongLaneAt(payload.x, payload.y) || this.songLaneBounds?.[this.dragState.targetTrackIndex];
      if (laneHit) {
        const dx = payload.x - (this.dragState.startX ?? payload.x);
        const dy = payload.y - (this.dragState.startY ?? payload.y);
        const pointerMoved = Math.abs(dx) > 6 || Math.abs(dy) > 6;
        if (!pointerMoved && !this.dragState.moved) {
          return;
        }
        const pattern = this.song.tracks[this.dragState.sourceTrackIndex]?.patterns?.[this.selectedPatternIndex];
        const range = this.getPatternPartRange(pattern, this.dragState.partIndex, this.getSongTimelineTicks());
        const duration = range.endTick - range.startTick;
        const tick = this.getSongTickFromX(payload.x, laneHit);
        const nextTrackIndex = laneHit.trackIndex;
        const nextStartTick = clamp(tick - this.dragState.offsetTick, 0, Math.max(0, this.getSongTimelineTicks() - duration));
        this.dragState.targetTrackIndex = nextTrackIndex;
        this.dragState.targetStartTick = nextStartTick;
        this.dragState.moved = nextTrackIndex !== this.dragState.sourceTrackIndex || nextStartTick !== range.startTick;
        this.songSelection = {
          active: true,
          trackIndex: nextTrackIndex,
          trackStartIndex: nextTrackIndex,
          trackEndIndex: nextTrackIndex,
          startTick: nextStartTick,
          endTick: nextStartTick + duration
        };
      }
      return;
    }
    if (this.dragState?.mode === 'song-part-resize') {
      const lane = this.songLaneBounds?.find((b) => b.trackIndex === this.dragState.trackIndex);
      if (lane) {
        const tick = this.getSongTickFromX(payload.x, lane);
        this.resizeSongPartEdge(this.dragState.trackIndex, this.dragState.partIndex, this.dragState.edge, tick);
      }
      return;
    }
    if (this.dragState?.mode === 'song-split-adjust') {
      const range = this.getSongSelectionRange();
      if (range && this.songTimelineBounds) {
        this.songSplitTool.tick = clamp(
          this.getSongTickFromX(payload.x, this.songTimelineBounds),
          range.startTick + 1,
          range.endTick - 1
        );
      }
      return;
    }
    if (this.dragState?.mode === 'song-shift-slider') {
      const slider = this.songShiftTool.bounds?.slider;
      if (slider) {
        const ratio = clamp((slider.y + slider.h - payload.y) / slider.h, 0, 1);
        this.songShiftTool.semitones = Math.round(-12 + ratio * 24);
      }
      return;
    }
    if (this.dragState?.mode === 'song-scrub') {
      const bounds = this.dragState.bounds || this.songTimelineBounds;
      if (bounds) {
        const tick = this.getSongTickFromX(payload.x, bounds);
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
      }
      return;
    }
    if (this.dragState?.mode === 'song-loop-start') {
      if (this.songTimelineBounds) {
        this.setLoopStartTick(this.getSongTickFromX(payload.x, this.songTimelineBounds));
      }
      return;
    }
    if (this.dragState?.mode === 'song-loop-end') {
      if (this.songTimelineBounds) {
        this.setLoopEndTick(this.getSongTickFromX(payload.x, this.songTimelineBounds));
      }
      return;
    }
    if (this.dragState?.mode === 'song-pan') {
      const dx = payload.x - this.dragState.startX;
      const threshold = 6;
      if (!this.dragState.moved && Math.abs(dx) > threshold) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved && this.songTimelineBounds) {
        const nextOffset = this.dragState.startOffsetX + dx;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
      return;
    }
    if (this.dragState?.mode === 'song-select-pending' || this.dragState?.mode === 'song-select') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (this.dragState.mode === 'song-select-pending' && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.mode = 'song-select';
        this.songSelection = {
          active: true,
          trackIndex: this.dragState.trackIndex,
          trackStartIndex: this.dragState.trackIndex,
          trackEndIndex: this.dragState.trackIndex,
          startTick: this.dragState.startTick,
          endTick: this.dragState.startTick
        };
      }
      if (this.dragState.mode === 'song-select' && this.dragState.bounds) {
        const tick = this.getSongTickFromX(payload.x, this.dragState.bounds);
        this.songSelection.endTick = tick;
        const laneHit = this.getSongLaneAt(payload.x, payload.y);
        if (laneHit) {
          this.songSelection.trackEndIndex = laneHit.trackIndex;
        }
      }
      return;
    }
    if (this.dragState?.mode === 'song-playhead') {
      const bounds = this.dragState.bounds || this.songTimelineBounds;
      if (bounds) {
        const tick = this.getSongTickFromX(payload.x, bounds);
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
      }
      return;
    }
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
        this.ensureGridPanCapacity(this.gridOffset.x);
        const { gridH, w, h } = this.gridBounds;
        const gridW = this.getExpandedGridWidth();
        this.clampGridOffset(w, h, gridW, gridH);
        this.updateTimelineStartTickFromGrid();
      }
      return;
    }
    if (this.dragState.mode === 'scrub') {
      const tick = this.getTickFromX(payload.x);
      this.playheadTick = clamp(tick, 0, this.getEditableGridTick());
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
        this.ensureGridPanCapacity(this.gridOffset.x);
        const { gridH, w, h } = this.gridBounds;
        const gridW = this.getExpandedGridWidth();
        this.clampGridOffset(w, h, gridW, gridH);
        this.updateTimelineStartTickFromGrid();
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
    if (this.recordModeActive) {
      this.recordLayout.handlePointerUp(payload);
      return;
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.suppressNextGridTap) {
      this.suppressNextGridTap = false;
      this.dragState = null;
      return;
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
    if (this.dragState?.mode === 'song-pan-or-select') {
      if (!this.dragState.moved && Number.isInteger(this.dragState.trackIndex)) {
        this.selectedTrackIndex = this.dragState.trackIndex;
        this.clearSongSelection();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-move-pending') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'instrument-scroll'
      || this.dragState?.mode === 'settings-scroll'
      || this.dragState?.mode === 'slider') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-select') {
      this.finalizeSongSelection();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-select-pending') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-pan') {
      if (!this.dragState.moved && Number.isInteger(this.dragState.trackIndex)) {
        this.selectedTrackIndex = this.dragState.trackIndex;
        this.clearSongSelection();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-part-move') {
      if (this.dragState.moved) {
        this.moveSongPart(
          this.dragState.sourceTrackIndex,
          this.dragState.partIndex,
          this.dragState.targetTrackIndex,
          this.dragState.targetStartTick
        );
      } else {
        this.finalizeSongSelection();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-part-resize') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-split-adjust') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-shift-slider') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-scrub') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-playhead') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-move') {
      if (this.dragState.moved) {
        this.applySongSelectionMove(this.dragState);
      }
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
    const modifiers = this.getModifiers();
    if (this.activeTab === 'grid' && this.gridBounds) {
      const inGrid = this.pointInBounds(payload.x, payload.y, this.gridBounds);
      const inRuler = this.rulerBounds && this.pointInBounds(payload.x, payload.y, this.rulerBounds);
      if (!inGrid && !inRuler) return;
      const delta = payload.deltaY;
      if (modifiers.shift) {
        this.gridOffset.x -= delta;
        this.ensureGridPanCapacity(this.gridOffset.x);
      } else {
        this.gridOffset.y -= delta;
      }
      this.clampGridOffset(
        this.gridBounds.w,
        this.gridBounds.h,
        this.getExpandedGridWidth(),
        this.gridBounds.gridH
      );
      this.updateTimelineStartTickFromGrid();
      return;
    }
    if (this.activeTab === 'song' && this.songTimelineBounds) {
      const inTimeline = this.pointInBounds(payload.x, payload.y, this.songTimelineBounds);
      if (!inTimeline) return;
      const delta = payload.deltaY;
      if (modifiers.meta) {
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        this.setSongTimelineZoom(this.gridZoomX * zoomFactor);
      } else {
        const nextOffset = this.songTimelineOffsetX - delta;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
    }
  }

  shouldHandleGestureStart(payload) {
    if (this.recordModeActive) return false;
    const touches = payload?.touches;
    const instrumentBounds = this.recordLayout?.bounds?.instrument;
    if (touches && instrumentBounds && this.recordLayout?.device !== 'gamepad') {
      const touchingInstrument = touches.some((touch) => this.pointInBounds(touch.x, touch.y, instrumentBounds));
      if (touchingInstrument) return false;
    }
    return true;
  }

  handleGestureStart(payload) {
    if (this.qaOverlayOpen) return;
    if (this.activeTab === 'grid') {
      if (!this.gridBounds) return;
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
      return;
    }
    if (this.activeTab === 'song') {
      if (!this.songTimelineBounds) return;
      if (!this.pointInBounds(payload.x, payload.y, this.songTimelineBounds)) return;
      this.songGesture = {
        startDistance: payload.distance,
        startZoomX: this.gridZoomX,
        startOffsetX: this.songTimelineOffsetX,
        startX: payload.x,
        startY: payload.y,
        originX: this.songTimelineBounds.originX,
        cellWidth: this.songTimelineBounds.cellWidth,
        timelineTicks: this.songTimelineBounds.timelineTicks,
        viewX: this.songTimelineBounds.x,
        viewW: this.songTimelineBounds.w
      };
    }
  }

  handleGestureMove(payload) {
    if (this.gridGesture?.startDistance) {
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
      this.suppressNextGridTap = true;
      this.gridOffset.x = nextOriginX - this.gridGesture.viewX;
      this.gridOffset.y = nextOriginY - this.gridGesture.viewY;
      this.ensureGridPanCapacity(this.gridOffset.x);
      const nextGridW = nextCellWidth * this.gridGesture.cols;
      const nextGridH = nextCellHeight * this.gridGesture.rows;
      this.clampGridOffset(this.gridGesture.viewW, this.gridGesture.viewH, nextGridW, nextGridH);
      this.updateTimelineStartTickFromGrid();
      return;
    }
    if (this.songGesture?.startDistance) {
      const scale = payload.distance / this.songGesture.startDistance;
      const zoomXLimits = this.getGridZoomLimitsX();
      const nextZoomX = clamp(this.songGesture.startZoomX * scale, zoomXLimits.minZoom, zoomXLimits.maxZoom);
      const baseCellWidth = this.songGesture.cellWidth / this.songGesture.startZoomX;
      const nextCellWidth = baseCellWidth * nextZoomX;
      const coordX = (this.songGesture.startX - this.songGesture.originX) / this.songGesture.cellWidth;
      const nextOriginX = payload.x - coordX * nextCellWidth;
      this.gridZoomX = nextZoomX;
      this.songTimelineOffsetX = this.clampTimelineOffsetX(
        nextOriginX - this.songGesture.viewX,
        this.songGesture.viewW,
        nextCellWidth
      );
      this.updateTimelineStartTickFromSong();
      this.ensureTimelineCapacity();
    }
  }

  handleGestureEnd() {
    this.gridGesture = null;
    this.songGesture = null;
  }

  handleGridPointerDown(payload) {
    const { x, y } = payload;
    const modifiers = this.getModifiers();
    const track = this.getActiveTrack();
    const drumTrack = isDrumTrack(track);
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
      if (hit.edge && !drumTrack) {
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
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const snappedTick = this.snapTick(tick);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track)
      : this.snapPitchToScale(pitch);
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
    const duration = drumTrack ? this.getDrumHitDurationTicks() : this.getPlacementDurationTicks(track);
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
    this.defaultNoteDurationTicks = note.durationTicks;
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
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const snappedTick = this.snapTick(tick);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track)
      : this.snapPitchToScale(pitch);
    const existing = pattern.notes.find((note) => note.startTick === snappedTick && note.pitch === snappedPitch);
    if (existing) {
      if (!continuous) {
        this.selection.clear();
        this.selection.add(existing.id);
        this.previewNote(existing, snappedPitch);
      }
      return;
    }
    const duration = drumTrack ? this.getDrumHitDurationTicks() : this.getPlacementDurationTicks(track);
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
    this.defaultNoteDurationTicks = note.durationTicks;
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
    const track = this.getActiveTrack();
    if (!pattern || !this.dragState?.originalNotes || !track) return;
    const drumTrack = isDrumTrack(track);
    const startTick = this.snapTick(tick);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS)
      : this.snapPitchToScale(pitch);
    const deltaTick = startTick - this.dragState.startTick;
    const deltaPitch = drumTrack ? 0 : snappedPitch - this.dragState.startPitch;
    const gridTicks = this.getGridTicks();
    const drumDuration = this.getDrumHitDurationTicks();
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id);
      const nextStart = clamp(original.startTick + deltaTick, 0, gridTicks - 1);
      const nextPitch = drumTrack
        ? this.coercePitchForTrack(original.pitch, track, GM_DRUM_ROWS)
        : clamp(original.pitch + deltaPitch, this.getPitchRange().min, this.getPitchRange().max);
      return {
        ...note,
        startTick: nextStart,
        durationTicks: drumTrack ? drumDuration : note.durationTicks,
        pitch: drumTrack ? nextPitch : this.snapPitchToScale(nextPitch)
      };
    });
    const selectedNotes = this.getSelectedNotes();
    if (!selectedNotes.length) return;
    const maxEndTick = Math.max(...selectedNotes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    this.persist();
    const previewTarget = selectedNotes[0];
    if (previewTarget) {
      this.previewNote(previewTarget, snappedPitch);
    }
  }

  resizeSelectionTo(tick) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !this.dragState?.originalNotes || !track || isDrumTrack(track)) return;
    const snappedTick = this.snapTick(tick);
    const gridTicks = this.getGridTicks();
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id);
      let startTick = original.startTick;
      let duration = original.durationTicks;
      if (this.dragState.edge === 'start') {
        const nextStart = clamp(snappedTick, 0, original.startTick + original.durationTicks - 1);
        duration = clamp(original.startTick + original.durationTicks - nextStart, 1, gridTicks);
        startTick = nextStart;
      } else {
        duration = clamp(snappedTick - original.startTick, 1, gridTicks - original.startTick);
      }
      return { ...note, startTick, durationTicks: duration };
    });
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    const first = this.getSelectedNotes()[0];
    if (first) {
      this.defaultNoteDurationTicks = Math.max(1, first.durationTicks);
    }
    this.persist();
  }

  resizeSelectedNotesBy(deltaTicks) {
    if (!deltaTicks) return;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track || isDrumTrack(track)) return;
    const gridTicks = this.getGridTicks();
    const selected = this.getSelectedNotes();
    if (!selected.length) return;
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const duration = clamp(note.durationTicks + deltaTicks, 1, Math.max(1, gridTicks - note.startTick));
      return { ...note, durationTicks: duration };
    });
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    const first = this.getSelectedNotes()[0];
    if (first) {
      this.defaultNoteDurationTicks = Math.max(1, first.durationTicks);
    }
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
    const track = this.getActiveTrack();
    if (!track) return;
    const drumTrack = isDrumTrack(track) || this.clipboard.isDrum;
    const nextTick = this.getNextEmptyBarStart();
    const basePitch = drumTrack
      ? this.coercePitchForTrack(this.clipboard.basePitch ?? this.cursor.pitch ?? this.getPitchRange().min, track, GM_DRUM_ROWS)
      : this.cursor.pitch || this.getPitchRange().min;
    this.pastePreview = {
      tick: this.snapTick(nextTick),
      pitch: drumTrack ? basePitch : this.snapPitchToScale(basePitch),
      notes: this.clipboard.notes,
      isDrum: drumTrack
    };
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  updatePastePreviewPosition(tick, pitch) {
    if (!this.pastePreview) return;
    const track = this.getActiveTrack();
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    this.pastePreview.tick = this.snapTick(tick);
    if (!drumTrack) {
      this.pastePreview.pitch = this.snapPitchToScale(pitch);
    }
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  applyPastePreview() {
    if (!this.clipboard || !this.pastePreview) return;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    const gridTicks = this.getGridTicks();
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    const drumDuration = this.getDrumHitDurationTicks();
    const newIds = [];
    this.clipboard.notes.forEach((note) => {
      const rawStart = baseTick + note.startTick;
      const startTick = clamp(rawStart, 0, gridTicks - 1);
      const pitchValue = drumTrack
        ? this.coercePitchForTrack(note.pitchAbsolute ?? note.pitch, track, GM_DRUM_ROWS)
        : clamp(basePitch + note.pitch, this.getPitchRange().min, this.getPitchRange().max);
      const newNote = {
        id: uid(),
        startTick,
        durationTicks: drumTrack ? drumDuration : note.durationTicks,
        pitch: pitchValue,
        velocity: note.velocity
      };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    const maxEndTick = Math.max(...newIds.map((id) => {
      const note = pattern.notes.find((entry) => entry.id === id);
      return note ? note.startTick + this.getEffectiveDurationTicks(note, track) : 0;
    }));
    this.ensureGridCapacity(maxEndTick);
    this.pastePreview = null;
    this.persist();
  }

  copySelection() {
    const notes = this.getSelectedNotes();
    const track = this.getActiveTrack();
    if (!track || notes.length === 0) return;
    const drumTrack = isDrumTrack(track);
    const minTick = Math.min(...notes.map((note) => note.startTick));
    const minPitch = Math.min(...notes.map((note) => note.pitch));
    const drumDuration = this.getDrumHitDurationTicks();
    const width = Math.max(...notes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track))) - minTick;
    this.clipboard = {
      notes: notes.map((note) => ({
        ...note,
        startTick: note.startTick - minTick,
        durationTicks: drumTrack ? drumDuration : note.durationTicks,
        pitch: drumTrack ? note.pitch : note.pitch - minPitch,
        pitchAbsolute: note.pitch
      })),
      width,
      height: drumTrack ? 0 : Math.max(...notes.map((note) => note.pitch)) - minPitch,
      isDrum: drumTrack,
      basePitch: drumTrack ? notes[0].pitch : minPitch
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
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const gridTicks = this.getGridTicks();
    const drumDuration = this.getDrumHitDurationTicks();
    const span = Math.max(...notes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)))
      - Math.min(...notes.map((note) => note.startTick));
    const newIds = [];
    notes.forEach((note) => {
      const rawStart = note.startTick + span;
      const startTick = clamp(rawStart, 0, gridTicks - 1);
      const newNote = {
        ...note,
        id: uid(),
        startTick,
        durationTicks: drumTrack ? drumDuration : note.durationTicks,
        pitch: drumTrack ? this.coercePitchForTrack(note.pitch, track, GM_DRUM_ROWS) : note.pitch
      };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    const maxEndTick = Math.max(...notes.map((note) => note.startTick + span + this.getEffectiveDurationTicks(note, track)));
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
    const drumTrack = isDrumTrack(track);
    const durationTicks = this.getEffectiveDurationTicks(note, track);
    const duration = durationTicks / this.ticksPerBeat;
    const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
    this.playGmNote(resolvedPitch, duration, track.volume, track);
  }

  auditionPitch(pitch) {
    const now = performance.now();
    if (now - this.lastAuditionTime < 90) return;
    this.lastAuditionTime = now;
    const track = this.getActiveTrack();
    if (!track) return;
    const drumTrack = isDrumTrack(track);
    const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
    const duration = drumTrack ? this.getDrumHitDurationTicks() / this.ticksPerBeat : 0.4;
    this.playGmNote(resolvedPitch, duration, track.volume, track);
  }

  previewInstrument(program, trackOverride = null) {
    if (!Number.isInteger(program)) return;
    const now = performance.now();
    if (now - this.lastAuditionTime < 120) return;
    this.lastAuditionTime = now;
    const track = trackOverride || this.getActiveTrack();
    const volume = track?.volume ?? 0.8;
    const isDrum = isDrumTrack(track);
    const channel = isDrum ? GM_DRUM_CHANNEL : (track?.channel ?? 0);
    const key = this.getCacheKeyForProgram(
      program,
      channel,
      track?.bankMSB ?? DEFAULT_BANK_MSB,
      track?.bankLSB ?? DEFAULT_BANK_LSB
    ) || String(program);
    const audio = this.game?.audio;
    if (audio?.loadGmProgram) {
      const loadPromise = isDrum ? audio.loadGmDrumKit?.() : audio.loadGmProgram(program);
      if (loadPromise?.finally) {
        this.setPreviewLoading(key, true);
        loadPromise.finally(() => this.setPreviewLoading(key, false));
      }
    }
    const sequence = isDrum
      ? [36, 38, 42, 49]
      : [60, 65, 67, 72];
    const baseVolume = Math.min(1, volume + 0.1);
    sequence.forEach((pitch, index) => {
      window.setTimeout(() => {
        this.playGmNote(pitch, 0.45, baseVolume, {
          program,
          channel,
          bankMSB: isDrum ? DRUM_BANK_MSB : DEFAULT_BANK_MSB,
          bankLSB: isDrum ? DRUM_BANK_LSB : DEFAULT_BANK_LSB,
          instrument: isDrum ? 'drums' : track?.instrument
        });
      }, index * 160);
    });
  }

  previewNotesAtTick(tick) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    pattern.notes.forEach((note) => {
      const durationTicks = this.getEffectiveDurationTicks(note, track);
      if (note.startTick <= tick && note.startTick + durationTicks > tick) {
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
    this.playheadTick = clamp(next, 0, this.getEditableGridTick());
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
    const gridTicks = this.getGridTicks();
    const loopEnd = typeof this.song.loopEndTick === 'number' ? this.song.loopEndTick : gridTicks;
    const maxStart = Math.max(0, loopEnd - ticksPerBar);
    const snapped = clamp(Math.round(tick / ticksPerBar) * ticksPerBar, 0, maxStart);
    this.song.loopStartTick = snapped;
    if (typeof this.song.loopEndTick === 'number' && this.song.loopEndTick <= snapped) {
      this.song.loopEndTick = Math.max(ticksPerBar, snapped + ticksPerBar);
      this.ensureGridCapacity(this.song.loopEndTick);
    } else if (typeof this.song.loopEndTick === 'number' && this.song.loopEndTick > gridTicks) {
      this.ensureGridCapacity(this.song.loopEndTick);
    }
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.persist();
  }

  setLoopEndTick(tick) {
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    const start = typeof this.song.loopStartTick === 'number' ? this.song.loopStartTick : 0;
    const minEnd = Math.max(ticksPerBar, start + ticksPerBar);
    const snapped = Math.max(minEnd, Math.round(tick / ticksPerBar) * ticksPerBar);
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
    this.syncCursorToTrack();
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
    if (hit.control === 'master-volume' || hit.control === 'master-pan') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(hit.x, hit.y);
      return;
    }
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
      if (isDrumTrack(track)) {
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
      this.setTrackChannel(track, GM_DRUM_CHANNEL);
      return;
    } else if (hit.control === 'bank') {
      if (isDrumTrack(track)) {
        const available = this.game?.audio?.listAvailableDrumKits?.();
        const kits = Array.isArray(available) && available.length ? available : GM_DRUM_KITS;
        if (!kits.length) return;
        const currentIndex = Math.max(0, kits.findIndex((kit) =>
          kit.program === track.program && kit.bankMSB === track.bankMSB && kit.bankLSB === track.bankLSB));
        const nextIndex = (currentIndex + 1) % kits.length;
        const nextKit = kits[nextIndex];
        track.bankMSB = nextKit.bankMSB;
        track.bankLSB = nextKit.bankLSB;
        track.program = nextKit.program;
        this.persist();
        return;
      }
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

  getSongTickFromX(x, bounds) {
    if (!this.songTimelineBounds) {
      const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
      const tick = ratio * this.getSongTimelineTicks();
      return this.snapTick(tick);
    }
    const { originX, cellWidth, timelineTicks } = this.songTimelineBounds;
    const tick = clamp((x - originX) / cellWidth, 0, timelineTicks);
    return this.snapTick(tick);
  }

  finalizeSongSelection() {
    if (!this.songSelection?.active) return;
    const minTicks = this.ticksPerBeat;
    if (this.songSelection.endTick === this.songSelection.startTick) {
      this.songSelection.endTick = this.songSelection.startTick + minTicks;
    }
    const totalTicks = this.getSongTimelineTicks();
    this.songSelection.startTick = clamp(this.songSelection.startTick, 0, totalTicks);
    this.songSelection.endTick = clamp(this.songSelection.endTick, 0, totalTicks);
    const trackTotal = this.song?.tracks?.length ?? 0;
    const maxTrack = Math.max(0, trackTotal - 1);
    this.songSelection.trackStartIndex = clamp(this.songSelection.trackStartIndex ?? this.songSelection.trackIndex ?? 0, 0, maxTrack);
    this.songSelection.trackEndIndex = clamp(this.songSelection.trackEndIndex ?? this.songSelection.trackIndex ?? 0, 0, maxTrack);
    this.songSelection.trackIndex = clamp(this.songSelection.trackIndex ?? this.songSelection.trackStartIndex ?? 0, 0, maxTrack);
    this.songSelectionMenu.open = Boolean(this.getSongSelectionRange());
    this.songSelectionMenu.x = this.lastPointer.x;
    this.songSelectionMenu.y = this.lastPointer.y;
    if (this.songRepeatTool.active) {
      const range = this.getSongSelectionRange();
      if (range) {
        this.applySongRepeatToRange(range);
      }
    }
  }

  clearSongSelection() {
    this.songSelection.active = false;
    this.songSelectionMenu.open = false;
    this.songSelectionMenu.bounds = [];
    this.songSplitTool.active = false;
    this.songShiftTool.active = false;
  }

  applySongRepeatToRange(range) {
    if (!this.songRepeatTool.active || !range) return;
    if (this.songRepeatTool.trackIndex !== range.trackIndex) return;
    const pattern = this.song.tracks[range.trackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!pattern) return;
    const baseStart = this.songRepeatTool.baseStartTick;
    const baseEnd = this.songRepeatTool.baseEndTick;
    if (!Number.isFinite(baseStart) || !Number.isFinite(baseEnd) || baseEnd <= baseStart) return;
    const partLen = Math.max(1, baseEnd - baseStart);
    let baseNotes = Array.isArray(this.songRepeatTool.baseNotes)
      ? this.songRepeatTool.baseNotes
      : [];
    if (baseNotes.length === 0) {
      baseNotes = this.collectSongRepeatBaseNotes(pattern, baseStart, baseEnd);
      this.songRepeatTool.baseNotes = baseNotes;
    }
    if (!baseNotes.length) return;
    const targetStart = range.startTick;
    const targetEnd = range.endTick;
    if (targetEnd <= baseEnd) return;
    const totalTicks = this.getSongTimelineTicks();
    const nextEnd = clamp(targetEnd, 0, Math.max(totalTicks, targetEnd));
    const ranges = this.getPatternPartRanges(pattern, totalTicks);
    const rangeIndex = ranges.findIndex((entry) => baseStart >= entry.startTick && baseStart < entry.endTick);
    if (rangeIndex >= 0) {
      ranges[rangeIndex] = {
        startTick: ranges[rangeIndex].startTick,
        endTick: Math.max(ranges[rangeIndex].endTick, nextEnd)
      };
      pattern.partRanges = this.normalizePartRanges(ranges, totalTicks);
      pattern.partBoundaries = [];
      pattern.partRangeStart = null;
      pattern.partRangeEnd = null;
      this.refreshPatternPartRange(pattern, nextEnd);
    }
    this.splitNotesAtTick(pattern, baseEnd);
    let cursor = baseEnd;
    while (cursor < nextEnd) {
      baseNotes.forEach((note) => {
        const rel = note.relStart ?? 0;
        const start = cursor + rel;
        const originalDuration = Math.max(1, note.durationTicks || this.ticksPerBeat);
        const skipBefore = start + originalDuration <= targetStart;
        if (skipBefore || start >= nextEnd) return;
        const clampedStart = Math.max(start, targetStart);
        const trimLeft = clampedStart - start;
        const clampedDuration = Math.min(
          originalDuration - trimLeft,
          nextEnd - clampedStart,
          partLen - rel
        );
        if (clampedDuration < 1) return;
        if (clampedStart < baseEnd && cursor === baseEnd) return;
        pattern.notes.push({
          ...note,
          id: uid(),
          startTick: clampedStart,
          durationTicks: clampedDuration
        });
      });
      cursor += partLen;
    }
    this.ensureGridCapacity(nextEnd);
    this.persist();
  }

  collectSongRepeatBaseNotes(pattern, baseStart, baseEnd) {
    if (!pattern || !Array.isArray(pattern.notes)) return [];
    return pattern.notes
      .filter((note) => note.startTick >= baseStart && note.startTick < baseEnd)
      .map((note) => ({
        relStart: note.startTick - baseStart,
        durationTicks: Math.min(
          note.durationTicks,
          Math.max(1, baseEnd - note.startTick)
        ),
        pitch: note.pitch,
        velocity: note.velocity
      }))
      .filter((note) => note.durationTicks > 0);
  }

  applySongSelectionMove(dragState) {
    if (!dragState?.originalRange || !Array.isArray(dragState.originalNotesByTrack)) return;
    const totalTicks = this.getSongTimelineTicks();
    const offset = dragState.targetStartTick - dragState.originalRange.startTick;
    const trackCount = dragState.originalRange.trackCount || 1;
    const maxStartTrack = Math.max(0, this.song.tracks.length - trackCount);
    const targetStartTrackIndex = clamp(dragState.targetTrackIndex, 0, maxStartTrack);
    dragState.originalNotesByTrack.forEach((entry) => {
      const originTrackIndex = entry.trackIndex;
      const targetTrackIndex = clamp(
        targetStartTrackIndex + (originTrackIndex - dragState.originalRange.trackStartIndex),
        0,
        this.song.tracks.length - 1
      );
      const originTrack = this.song.tracks[originTrackIndex];
      const targetTrack = this.song.tracks[targetTrackIndex];
      const originPattern = originTrack?.patterns?.[this.selectedPatternIndex];
      const targetPattern = targetTrack?.patterns?.[this.selectedPatternIndex];
      if (!originPattern || !targetPattern) return;
      const noteIds = new Set(entry.notes.map((note) => note.id));
      if (originPattern === targetPattern && originTrackIndex === targetTrackIndex) {
        originPattern.notes = originPattern.notes.map((note) => {
          if (!noteIds.has(note.id)) return note;
          return {
            ...note,
            startTick: clamp(note.startTick + offset, 0, totalTicks)
          };
        });
      } else {
        originPattern.notes = originPattern.notes.filter((note) => !noteIds.has(note.id));
        entry.notes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            startTick: clamp(note.startTick + offset, 0, totalTicks)
          });
        });
      }
    });
    this.songSelection = {
      active: true,
      trackIndex: targetStartTrackIndex,
      trackStartIndex: targetStartTrackIndex,
      trackEndIndex: targetStartTrackIndex + trackCount - 1,
      startTick: dragState.targetStartTick,
      endTick: dragState.targetStartTick + dragState.originalRange.durationTicks
    };
    this.selectedTrackIndex = targetStartTrackIndex;
    this.persist();
    this.finalizeSongSelection();
  }

  addSongAutomationKeyframe(track, type, tick, value) {
    if (!track) return;
    if (!track.automation) {
      track.automation = { pan: [], padding: [] };
    }
    const frames = track.automation[type] || [];
    const existing = frames.find((frame) => Math.abs(frame.tick - tick) <= this.ticksPerBeat / 4);
    if (existing) {
      existing.value = value;
    } else {
      frames.push({ tick, value });
    }
    frames.sort((a, b) => a.tick - b.tick);
    track.automation[type] = frames;
    this.persist();
  }

  removeSongAutomationKeyframe(track, type, tick) {
    if (!track?.automation?.[type]) return;
    const frames = track.automation[type];
    const threshold = this.ticksPerBeat / 4;
    const index = frames.findIndex((frame) => Math.abs(frame.tick - tick) <= threshold);
    if (index < 0) return;
    frames.splice(index, 1);
    track.automation[type] = frames;
    this.persist();
  }

  getSongSelectionNotes(pattern, range) {
    if (!pattern || !range) return [];
    return pattern.notes.filter((note) => note.startTick >= range.startTick && note.startTick < range.endTick);
  }

  getSongNotesOverlapping(pattern, range) {
    if (!pattern || !range) return [];
    return pattern.notes.filter((note) => (
      note.startTick < range.endTick && (note.startTick + note.durationTicks) > range.startTick
    ));
  }

  shiftNotesAfterTick(pattern, tick, deltaTicks) {
    pattern.notes.forEach((note) => {
      if (note.startTick >= tick) {
        note.startTick = Math.max(0, note.startTick + deltaTicks);
      }
    });
  }

  splitNotesAtTick(pattern, tick) {
    if (!pattern?.notes?.length) return 0;
    const newNotes = [];
    pattern.notes.forEach((note) => {
      const endTick = note.startTick + note.durationTicks;
      if (note.startTick < tick && endTick > tick) {
        const firstDuration = tick - note.startTick;
        const secondDuration = endTick - tick;
        if (firstDuration < 1 || secondDuration < 1) return;
        note.durationTicks = firstDuration;
        newNotes.push({
          ...note,
          id: uid(),
          startTick: tick,
          durationTicks: secondDuration
        });
      }
    });
    if (newNotes.length) {
      pattern.notes.push(...newNotes);
    }
    return newNotes.length;
  }

  splitSongTracksAtTicks(tracks, ticks) {
    if (!Array.isArray(tracks) || !tracks.length) return 0;
    const sortedTicks = [...new Set(
      ticks
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => Math.max(0, Math.round(tick)))
    )].sort((a, b) => a - b);
    if (!sortedTicks.length) return 0;
    let splitCount = 0;
    tracks.forEach((entry) => {
      sortedTicks.forEach((tick) => {
        splitCount += this.splitNotesAtTick(entry.pattern, tick);
      });
    });
    return splitCount;
  }


  getPatternPartBoundaries(pattern, totalTicks) {
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, limit);
    if (!ranges.length) return [0, limit];
    const boundaries = [];
    ranges.forEach((range) => {
      boundaries.push(range.startTick, range.endTick);
    });
    return [...new Set(boundaries)].sort((a, b) => a - b);
  }

  getPatternPartRangeBounds(pattern, totalTicks) {
    if (!pattern) return null;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const rangeStart = Number.isFinite(pattern.partRangeStart) ? pattern.partRangeStart : null;
    const rangeEnd = Number.isFinite(pattern.partRangeEnd) ? pattern.partRangeEnd : null;
    if (Number.isFinite(rangeStart) || Number.isFinite(rangeEnd)) {
      const startTick = clamp(Math.round(rangeStart ?? 0), 0, Math.max(0, limit - 1));
      const endTick = clamp(Math.round(rangeEnd ?? limit), startTick + 1, limit);
      return { startTick, endTick };
    }
    const hasExplicitParts = Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0;
    if (hasExplicitParts) {
      return { startTick: 0, endTick: limit };
    }
    const implicit = this.getImplicitPatternPartRange(pattern, limit);
    return implicit || { startTick: 0, endTick: limit };
  }

  normalizePartRanges(ranges, totalTicks) {
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const sorted = ranges
      .filter((range) => range && Number.isFinite(range.startTick) && Number.isFinite(range.endTick))
      .map((range) => {
        const startTick = clamp(Math.round(range.startTick), 0, Math.max(0, limit - 1));
        const endTick = clamp(Math.round(range.endTick), startTick + 1, limit);
        return { startTick, endTick };
      })
      .filter((range) => range.endTick > range.startTick)
      .sort((a, b) => a.startTick - b.startTick);
    const merged = [];
    sorted.forEach((range) => {
      const last = merged[merged.length - 1];
      if (last && range.startTick < last.endTick) {
        last.endTick = Math.max(last.endTick, range.endTick);
      } else {
        merged.push({ ...range });
      }
    });
    return merged;
  }

  getPatternPartRanges(pattern, totalTicks) {
    if (!pattern) return [];
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
      return this.normalizePartRanges(pattern.partRanges, limit);
    }
    if (Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0) {
      const bounds = this.getPatternPartRangeBounds(pattern, limit);
      if (!bounds) return [];
      const startTick = clamp(Math.round(bounds.startTick), 0, Math.max(0, limit - 1));
      const endTick = clamp(Math.round(bounds.endTick), startTick + 1, limit);
      const inner = pattern.partBoundaries
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => clamp(Math.round(tick), startTick + 1, endTick - 1))
        .filter((tick) => tick > startTick && tick < endTick);
      const boundaries = [...new Set([startTick, ...inner, endTick])].sort((a, b) => a - b);
      const ranges = [];
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        ranges.push({ startTick: boundaries[i], endTick: boundaries[i + 1] });
      }
      return this.normalizePartRanges(ranges, limit);
    }
    const implicit = this.getImplicitPatternPartRange(pattern, limit);
    return implicit ? [implicit] : [];
  }

  getImplicitPatternPartRange(pattern, totalTicks) {
    if (!pattern || !Array.isArray(pattern.notes) || pattern.notes.length === 0) return null;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    let minStart = Infinity;
    let maxEnd = 0;
    pattern.notes.forEach((note) => {
      minStart = Math.min(minStart, note.startTick);
      const endTick = note.startTick + Math.max(1, note.durationTicks || this.ticksPerBeat);
      maxEnd = Math.max(maxEnd, endTick);
    });
    if (!Number.isFinite(minStart)) return null;
    const startTick = clamp(Math.floor(minStart), 0, Math.max(0, limit - 1));
    const inferredEnd = clamp(Math.ceil(maxEnd / ticksPerBar) * ticksPerBar, startTick + 1, limit);
    return {
      startTick,
      endTick: inferredEnd
    };
  }

  refreshPatternPartRange(pattern, totalTicks) {
    if (!pattern) return;
    if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
      const ranges = this.normalizePartRanges(pattern.partRanges, totalTicks);
      if (!ranges.length) {
        pattern.partRanges = [];
        return;
      }
      if (Array.isArray(pattern.notes) && pattern.notes.length > 0) {
        const trimmed = ranges.filter((range) => pattern.notes.some((note) => {
          const noteStart = note.startTick;
          const noteEnd = note.startTick + Math.max(1, note.durationTicks || this.ticksPerBeat);
          return noteEnd > range.startTick && noteStart < range.endTick;
        }));
        pattern.partRanges = trimmed.length ? trimmed : ranges;
      } else {
        pattern.partRanges = [];
      }
      return;
    }
    const hasExplicitParts = Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0;
    const hasExplicitRange = Number.isFinite(pattern.partRangeStart) || Number.isFinite(pattern.partRangeEnd);
    if (!hasExplicitParts && !hasExplicitRange) return;
    const implicit = this.getImplicitPatternPartRange(pattern, totalTicks);
    if (!implicit) {
      pattern.partBoundaries = [];
      pattern.partRangeStart = null;
      pattern.partRangeEnd = null;
      return;
    }
    pattern.partRangeStart = implicit.startTick;
    pattern.partRangeEnd = implicit.endTick;
    if (Array.isArray(pattern.partBoundaries)) {
      pattern.partBoundaries = pattern.partBoundaries
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => clamp(Math.round(tick), implicit.startTick + 1, implicit.endTick - 1))
        .filter((tick) => tick > implicit.startTick && tick < implicit.endTick);
      pattern.partBoundaries = [...new Set(pattern.partBoundaries)].sort((a, b) => a - b);
    }
  }

  splitPatternPartsAtTicks(pattern, ticks, totalTicks) {
    if (!pattern) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, limit);
    if (!ranges.length) return 0;
    let added = 0;
    ticks.forEach((tick) => {
      if (!Number.isFinite(tick)) return;
      const nextTick = clamp(Math.round(tick), 0, limit);
      const rangeIndex = ranges.findIndex((range) => nextTick > range.startTick && nextTick < range.endTick);
      if (rangeIndex === -1) return;
      const target = ranges[rangeIndex];
      const left = { startTick: target.startTick, endTick: nextTick };
      const right = { startTick: nextTick, endTick: target.endTick };
      if (left.endTick - left.startTick < 1 || right.endTick - right.startTick < 1) return;
      ranges.splice(rangeIndex, 1, left, right);
      added += 1;
    });
    pattern.partRanges = this.normalizePartRanges(ranges, limit);
    pattern.partBoundaries = [];
    pattern.partRangeStart = null;
    pattern.partRangeEnd = null;
    return added;
  }

  splitSongTrackPartsAtTicks(tracks, ticks, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length) return 0;
    return tracks.reduce((sum, entry) => sum + this.splitPatternPartsAtTicks(entry.pattern, ticks, totalTicks), 0);
  }

  mergeSongTrackPartsInRange(tracks, range, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length || !range) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    let merged = 0;
    tracks.forEach((entry) => {
      const pattern = entry?.pattern;
      if (!pattern) return;
      if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
        const ranges = this.normalizePartRanges(pattern.partRanges, limit);
        const next = ranges.filter((part) => part.endTick <= range.startTick || part.startTick >= range.endTick);
        if (next.length !== ranges.length) {
          pattern.partRanges = next;
          merged += 1;
        }
        return;
      }
      const existing = Array.isArray(pattern.partBoundaries) ? pattern.partBoundaries : [];
      const next = existing.filter((tick) => tick <= range.startTick || tick >= range.endTick)
        .map((tick) => clamp(Math.round(tick), 1, limit - 1));
      if (next.length !== existing.length) {
        pattern.partBoundaries = [...new Set(next)].sort((a, b) => a - b);
        merged += 1;
      }
    });
    return merged;
  }

  mergeSongTrackPartsAtBoundary(tracks, boundaryTick, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length || !Number.isFinite(boundaryTick)) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    if (limit <= 1) return 0;
    const boundary = clamp(Math.round(boundaryTick), 1, limit - 1);
    if (boundary <= 0 || boundary >= limit) return 0;
    let merged = 0;
    tracks.forEach((entry) => {
      const pattern = entry?.pattern;
      if (!pattern) return;
      if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
        const ranges = this.normalizePartRanges(pattern.partRanges, limit);
        const leftIndex = ranges.findIndex((range) => range.endTick === boundary);
        if (leftIndex === -1 || leftIndex >= ranges.length - 1) return;
        const rightIndex = leftIndex + 1;
        if (ranges[rightIndex].startTick !== boundary) return;
        const mergedRange = {
          startTick: ranges[leftIndex].startTick,
          endTick: ranges[rightIndex].endTick
        };
        ranges.splice(leftIndex, 2, mergedRange);
        pattern.partRanges = ranges;
        merged += 1;
        return;
      }
      const existing = Array.isArray(pattern.partBoundaries) ? pattern.partBoundaries : [];
      const next = existing
        .filter((tick) => Math.round(tick) !== boundary)
        .map((tick) => clamp(Math.round(tick), 1, limit - 1));
      if (next.length !== existing.length) {
        pattern.partBoundaries = [...new Set(next)].sort((a, b) => a - b);
        merged += 1;
      }
    });
    return merged;
  }

  startSongSplitTool(range) {
    if (!range) return;
    const fallbackTick = range.startTick + Math.floor(range.durationTicks / 2);
    const pointerX = Number.isFinite(this.songSelectionMenu.x)
      ? this.songSelectionMenu.x
      : this.lastPointer.x;
    const pointerTick = this.songTimelineBounds
      ? this.getSongTickFromX(pointerX, this.songTimelineBounds)
      : fallbackTick;
    const splitTick = clamp(pointerTick, range.startTick + 1, range.endTick - 1);
    this.songSplitTool.active = true;
    this.songSplitTool.tick = splitTick;
    this.songSelectionMenu.open = false;
  }

  applySongSplitTool() {
    const range = this.getSongSelectionRange();
    if (!range || !this.songSplitTool.active) return;
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    if (!tracks.length) return;
    const totalTicks = this.getSongTimelineTicks();
    const splitTick = clamp(Math.round(this.songSplitTool.tick), range.startTick + 1, range.endTick - 1);
    this.splitSongTrackPartsAtTicks(tracks, [splitTick], totalTicks);
    this.splitSongTracksAtTicks(tracks, [splitTick]);
    this.songSelection.startTick = range.startTick;
    this.songSelection.endTick = splitTick;
    this.songSplitTool.active = false;
    this.persist();
  }

  applySongShiftTool() {
    const range = this.getSongSelectionRange();
    if (!range || !this.songShiftTool.active) return;
    const delta = clamp(Math.round(this.songShiftTool.semitones), -12, 12);
    if (!delta) {
      this.songShiftTool.active = false;
      return;
    }
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    tracks.forEach((entry) => {
      if (isDrumTrack(entry.track)) return;
      entry.pattern.notes.forEach((note) => {
        if (note.startTick >= range.startTick && note.startTick < range.endTick) {
          note.pitch = clamp(note.pitch + delta, 0, 127);
        }
      });
    });
    this.songShiftTool.active = false;
    this.persist();
  }


  getPatternPartRange(pattern, partIndex, totalTicks) {
    const ranges = this.getPatternPartRanges(pattern, totalTicks);
    if (!ranges.length) {
      return { partIndex: 0, startTick: 0, endTick: totalTicks || 1 };
    }
    const idx = clamp(partIndex, 0, Math.max(0, ranges.length - 1));
    return {
      partIndex: idx,
      startTick: ranges[idx].startTick,
      endTick: ranges[idx].endTick
    };
  }

  setPatternPartEdge(pattern, partIndex, edge, tick, totalTicks) {
    if (!pattern) return false;
    const total = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, total);
    if (!ranges.length) return false;
    const idx = clamp(partIndex, 0, Math.max(0, ranges.length - 1));
    const range = ranges[idx];
    const prev = idx > 0 ? ranges[idx - 1] : null;
    const next = idx < ranges.length - 1 ? ranges[idx + 1] : null;
    if (edge === 'start') {
      const minTick = prev ? prev.endTick + 1 : 0;
      const maxTick = range.endTick - 1;
      range.startTick = clamp(Math.round(tick), minTick, maxTick);
    } else if (edge === 'end') {
      const minTick = range.startTick + 1;
      const maxTick = next ? next.startTick - 1 : total;
      range.endTick = clamp(Math.round(tick), minTick, maxTick);
    } else {
      return false;
    }
    pattern.partRanges = this.normalizePartRanges(ranges, total);
    pattern.partBoundaries = [];
    pattern.partRangeStart = null;
    pattern.partRangeEnd = null;
    return true;
  }

  moveSongPart(sourceTrackIndex, sourcePartIndex, targetTrackIndex, targetStartTick) {
    const totalTicks = this.getSongTimelineTicks();
    const sourcePattern = this.song.tracks[sourceTrackIndex]?.patterns?.[this.selectedPatternIndex];
    const targetPattern = this.song.tracks[targetTrackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!sourcePattern || !targetPattern) return;
    const sourceRanges = this.getPatternPartRanges(sourcePattern, totalTicks);
    if (!sourceRanges.length) return;
    const sourceIndex = clamp(sourcePartIndex, 0, Math.max(0, sourceRanges.length - 1));
    const sourceRange = sourceRanges[sourceIndex];
    const duration = sourceRange.endTick - sourceRange.startTick;
    const nextStart = clamp(Math.round(targetStartTick), 0, Math.max(0, totalTicks - duration));
    const nextEnd = nextStart + duration;
    this.splitSongTracksAtTicks([
      { pattern: sourcePattern },
      { pattern: targetPattern }
    ], [sourceRange.startTick, sourceRange.endTick, nextStart, nextEnd]);

    const movedNotes = sourcePattern.notes.filter((note) => note.startTick >= sourceRange.startTick && note.startTick < sourceRange.endTick);
    sourcePattern.notes = sourcePattern.notes.filter((note) => note.startTick < sourceRange.startTick || note.startTick >= sourceRange.endTick);
    const offset = nextStart - sourceRange.startTick;
    movedNotes.forEach((note) => {
      targetPattern.notes.push({
        ...note,
        id: uid(),
        startTick: clamp(note.startTick + offset, 0, totalTicks)
      });
    });
    if (sourcePattern === targetPattern) {
      sourceRanges[sourceIndex] = { startTick: nextStart, endTick: nextEnd };
      sourcePattern.partRanges = this.normalizePartRanges(sourceRanges, totalTicks);
    } else {
      const targetRanges = this.getPatternPartRanges(targetPattern, totalTicks);
      const normalizedTargetRanges = targetRanges.length ? targetRanges : [];
      sourceRanges.splice(sourceIndex, 1);
      normalizedTargetRanges.push({ startTick: nextStart, endTick: nextEnd });
      sourcePattern.partRanges = this.normalizePartRanges(sourceRanges, totalTicks);
      targetPattern.partRanges = this.normalizePartRanges(normalizedTargetRanges, totalTicks);
    }
    sourcePattern.partBoundaries = [];
    targetPattern.partBoundaries = [];
    sourcePattern.partRangeStart = null;
    sourcePattern.partRangeEnd = null;
    targetPattern.partRangeStart = null;
    targetPattern.partRangeEnd = null;
    this.refreshPatternPartRange(sourcePattern, totalTicks);
    this.refreshPatternPartRange(targetPattern, totalTicks);
    if (this.songRepeatTool.active) {
      this.songRepeatTool.active = false;
      this.songRepeatTool.trackIndex = null;
      this.songRepeatTool.baseStartTick = null;
      this.songRepeatTool.baseEndTick = null;
      this.songRepeatTool.baseNotes = [];
    }

    const targetPartIndex = targetPattern.partRanges
      ? targetPattern.partRanges.findIndex((range) => range.startTick === nextStart && range.endTick === nextEnd)
      : -1;
    const nextPartIndex = targetPartIndex >= 0 ? targetPartIndex : 0;
    this.songSelection = {
      active: true,
      trackIndex: targetTrackIndex,
      trackStartIndex: targetTrackIndex,
      trackEndIndex: targetTrackIndex,
      startTick: nextStart,
      endTick: nextEnd
    };
    this.dragState.selectedPartIndex = nextPartIndex;
    this.selectedTrackIndex = targetTrackIndex;
    this.persist();
  }

  resizeSongPartEdge(trackIndex, partIndex, edge, tick) {
    const totalTicks = this.getSongTimelineTicks();
    const pattern = this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!pattern) return;
    const before = this.getPatternPartRange(pattern, partIndex, totalTicks);
    const changed = this.setPatternPartEdge(pattern, partIndex, edge, tick, totalTicks);
    if (!changed) return;
    const after = this.getPatternPartRange(pattern, partIndex, totalTicks);
    const repeatActive = this.songRepeatTool.active
      && this.songRepeatTool.trackIndex === trackIndex
      && Number.isFinite(this.songRepeatTool.baseStartTick)
      && Number.isFinite(this.songRepeatTool.baseEndTick);
    const baseStart = repeatActive ? this.songRepeatTool.baseStartTick : before.startTick;
    const baseEnd = repeatActive ? this.songRepeatTool.baseEndTick : before.endTick;
    const partLen = Math.max(1, baseEnd - baseStart);
    let baseNotes = repeatActive
      ? this.songRepeatTool.baseNotes || []
      : [];
    if (repeatActive && baseNotes.length === 0) {
      baseNotes = this.collectSongRepeatBaseNotes(pattern, baseStart, baseEnd);
      this.songRepeatTool.baseNotes = baseNotes;
    }

    if (edge === 'end') {
      if (after.endTick > before.endTick) {
        if (repeatActive && baseNotes.length) {
          this.splitNotesAtTick(pattern, before.endTick);
          let cursor = before.endTick;
          while (cursor < after.endTick) {
            baseNotes.forEach((note) => {
              const rel = note.relStart ?? 0;
              const start = cursor + rel;
              if (start >= after.endTick) return;
              const noteRelStart = rel;
              const maxDuration = Math.min(
                note.durationTicks,
                partLen - noteRelStart,
                after.endTick - start,
                partLen
              );
              if (maxDuration < 1) return;
              if (start < before.endTick) return;
              pattern.notes.push({
                ...note,
                id: uid(),
                startTick: start,
                durationTicks: maxDuration
              });
            });
            cursor += partLen;
          }
        }
      } else if (after.endTick < before.endTick) {
        this.splitNotesAtTick(pattern, after.endTick);
        pattern.notes = pattern.notes.filter((note) => note.startTick < after.endTick || note.startTick >= before.endTick);
      }
    } else if (edge === 'start') {
      if (after.startTick < before.startTick) {
        if (repeatActive && baseNotes.length) {
          this.splitNotesAtTick(pattern, before.startTick);
          let cursor = before.startTick - partLen;
          while (cursor >= after.startTick) {
            baseNotes.forEach((note) => {
              const rel = note.relStart ?? 0;
              const start = cursor + rel;
              const endTick = start + Math.max(1, note.durationTicks || this.ticksPerBeat);
              if (endTick <= after.startTick || start >= before.startTick) return;
              const clampedStart = Math.max(start, after.startTick);
              const noteRelStart = rel;
              const clampedDuration = Math.min(
                note.durationTicks,
                partLen - noteRelStart,
                before.startTick - clampedStart,
                after.endTick - clampedStart,
                partLen
              );
              if (clampedDuration < 1) return;
              if (clampedStart >= before.startTick) return;
              pattern.notes.push({
                ...note,
                id: uid(),
                startTick: clampedStart,
                durationTicks: clampedDuration
              });
            });
            cursor -= partLen;
          }
        }
      } else if (after.startTick > before.startTick) {
        this.splitNotesAtTick(pattern, after.startTick);
        pattern.notes = pattern.notes.filter((note) => note.startTick < before.startTick || note.startTick >= after.startTick);
      }
    }

    this.songSelection = {
      active: true,
      trackIndex,
      trackStartIndex: trackIndex,
      trackEndIndex: trackIndex,
      startTick: after.startTick,
      endTick: after.endTick
    };
    this.persist();
  }

  handleSongAction(action) {
    const range = this.getSongSelectionRange();
    if (!range) return;
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    if (!tracks.length) return;

    if (action === 'song-copy') {
      const notesByTrack = tracks.map((entry) => ({
        trackIndex: entry.trackIndex,
        notes: this.getSongSelectionNotes(entry.pattern, range).map((note) => ({
          ...note,
          startTick: note.startTick - range.startTick
        }))
      })).filter((entry) => entry.notes.length > 0);
      this.songClipboard = {
        anchorTrackIndex: range.trackStartIndex,
        durationTicks: range.durationTicks,
        notesByTrack
      };
      return;
    }

    if (action === 'song-paste') {
      const notesByTrack = this.songClipboard?.notesByTrack;
      if (!Array.isArray(notesByTrack) || notesByTrack.length === 0) return;
      const startTick = range.startTick;
      const anchorTrack = Number.isInteger(this.songClipboard.anchorTrackIndex)
        ? this.songClipboard.anchorTrackIndex
        : range.trackStartIndex;
      notesByTrack.forEach((entry) => {
        const targetTrackIndex = clamp(
          range.trackStartIndex + (entry.trackIndex - anchorTrack),
          0,
          this.song.tracks.length - 1
        );
        const targetPattern = this.song.tracks[targetTrackIndex]?.patterns?.[this.selectedPatternIndex];
        if (!targetPattern) return;
        entry.notes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            id: uid(),
            startTick: startTick + note.startTick
          });
        });
      });
      this.ensureGridCapacity(startTick + this.songClipboard.durationTicks);
      this.persist();
      return;
    }

    if (action === 'song-cut') {
      this.handleSongAction('song-copy');
      this.splitSongTracksAtTicks(tracks, [range.startTick, range.endTick]);
      tracks.forEach((entry) => {
        entry.pattern.notes = entry.pattern.notes.filter((note) => (
          note.startTick < range.startTick || note.startTick >= range.endTick
        ));
        this.refreshPatternPartRange(entry.pattern, this.getSongTimelineTicks());
      });
      this.persist();
      return;
    }

    if (action === 'song-delete') {
      tracks.forEach((entry) => {
        const overlapping = this.getSongNotesOverlapping(entry.pattern, range);
        entry.pattern.notes = entry.pattern.notes.filter((note) => !overlapping.includes(note));
        this.refreshPatternPartRange(entry.pattern, this.getSongTimelineTicks());
      });
      this.persist();
      return;
    }

    if (action === 'song-splice') {
      this.startSongSplitTool(range);
      return;
    }

    if (action === 'song-repeat') {
      const nextActive = !this.songRepeatTool.active;
      this.songRepeatTool.active = nextActive;
      if (nextActive) {
        const targetPattern = tracks.find((entry) => entry.trackIndex === range.trackIndex)?.pattern;
        const timelineTicks = this.getSongTimelineTicks();
        const partRanges = this.getPatternPartRanges(targetPattern, timelineTicks);
        const baseRange = partRanges.find((entry) => (
          range.startTick >= entry.startTick && range.startTick < entry.endTick
        ))
          || partRanges[0]
          || { startTick: range.startTick, endTick: range.endTick };
        const baseStart = baseRange.startTick;
        const baseEnd = baseRange.endTick;
        this.songRepeatTool.trackIndex = range.trackIndex;
        this.songRepeatTool.baseStartTick = baseStart;
        this.songRepeatTool.baseEndTick = baseEnd;
        const baseNotes = this.collectSongRepeatBaseNotes(targetPattern, baseStart, baseEnd);
        this.songRepeatTool.baseNotes = baseNotes;
        this.applySongRepeatToRange(range);
      } else {
        this.songRepeatTool.trackIndex = null;
        this.songRepeatTool.baseStartTick = null;
        this.songRepeatTool.baseEndTick = null;
        this.songRepeatTool.baseNotes = [];
      }
      this.songSelectionMenu.open = false;
      return;
    }

    if (action === 'song-duplicate') {
      const totalTicks = this.getSongTimelineTicks();
      const durationTicks = Math.max(1, range.durationTicks);
      const insertStart = range.endTick;
      const insertEnd = clamp(insertStart + durationTicks, 0, totalTicks + durationTicks);
      tracks.forEach((entry) => {
        const targetPattern = entry.pattern;
        if (!targetPattern) return;
        const selectionNotes = this.getSongSelectionNotes(targetPattern, range);
        selectionNotes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            id: uid(),
            startTick: note.startTick + durationTicks
          });
        });
        const ranges = this.getPatternPartRanges(targetPattern, totalTicks);
        ranges.push({ startTick: insertStart, endTick: insertEnd });
        targetPattern.partRanges = this.normalizePartRanges(ranges, totalTicks + durationTicks);
        targetPattern.partBoundaries = [];
        targetPattern.partRangeStart = null;
        targetPattern.partRangeEnd = null;
        this.refreshPatternPartRange(targetPattern, totalTicks + durationTicks);
      });
      this.ensureGridCapacity(insertEnd);
      this.songSelection.startTick = insertStart;
      this.songSelection.endTick = insertEnd;
      this.songSelectionMenu.open = false;
      this.persist();
      return;
    }

    if (action === 'song-merge-left') {
      const totalTicks = this.getSongTimelineTicks();
      const merged = this.mergeSongTrackPartsAtBoundary(tracks, range.startTick, totalTicks);
      this.songSplitTool.active = false;
      if (merged > 0) {
        this.persist();
      }
      return;
    }

    if (action === 'song-merge-right') {
      const totalTicks = this.getSongTimelineTicks();
      const merged = this.mergeSongTrackPartsAtBoundary(tracks, range.endTick, totalTicks);
      this.songSplitTool.active = false;
      if (merged > 0) {
        this.persist();
      }
      return;
    }

    if (action === 'song-shift-note') {
      this.songShiftTool.active = true;
      this.songShiftTool.semitones = 0;
      this.songSelectionMenu.open = false;
      return;
    }

    if (action === 'song-loop-selection') {
      this.setLoopStartTick(range.startTick);
      this.setLoopEndTick(range.endTick);
      this.song.loopEnabled = true;
      this.persist();
    }
  }

  setTrackChannel(track, channel) {
    const nextChannel = clamp(channel, 0, 15);
    const drumTarget = isDrumTrack(track) || nextChannel === GM_DRUM_CHANNEL;
    track.channel = drumTarget ? GM_DRUM_CHANNEL : nextChannel;
    if (drumTarget) {
      this.ensureDrumTrackSettings(track);
    }
    this.preloadTrackPrograms();
    this.persist();
  }

  updateTrackControl(x, y) {
    const hit = this.draggingTrackControl;
    if (!hit) return;
    if (hit.control === 'master-volume' || hit.control === 'master-pan') {
      const ratio = clamp((x - hit.x) / hit.w, 0, 1);
      if (hit.control === 'master-volume') {
        this.audioSettings.masterVolume = ratio;
      }
      if (hit.control === 'master-pan') {
        this.audioSettings.masterPan = clamp(ratio * 2 - 1, -1, 1);
      }
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
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
    if (control.disabled) return;
    if (control.id === 'audio-volume'
      || control.id === 'audio-master-pan'
      || control.id === 'audio-latency'
      || control.id === 'audio-reverb-level') {
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
      this.game?.audio?.preloadSoundfontProgram?.(track.program, track.channel, track.bankMSB, track.bankLSB);
      return;
    }
    if (control.id === 'audio-drumkit') {
      const available = this.game?.audio?.listAvailableDrumKits?.();
      const kits = Array.isArray(available) && available.length ? available : GM_DRUM_KITS;
      if (!kits.length) return;
      const currentId = this.audioSettings.drumKitId;
      const currentIndex = Math.max(0, kits.findIndex((kit) => kit.id === currentId));
      const nextIndex = (currentIndex + 1) % kits.length;
      this.audioSettings.drumKitId = kits[nextIndex].id;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-drum-test') {
      this.game?.audio?.testDrumKit?.();
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
    if (control.id === 'touch-reverse-strings') {
      this.setReverseStrings(!this.reverseStrings);
      return;
    }
    if (control.id === 'virtual-device-gamepad') {
      if (this.gamepadInput.connected) {
        this.recordDevicePreference = 'gamepad';
      }
      return;
    }
    if (control.id === 'virtual-device-touch') {
      this.recordDevicePreference = 'touch';
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
    if (id === 'audio-master-pan') {
      this.audioSettings.masterPan = clamp(ratio * 2 - 1, -1, 1);
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
      return;
    }
    if (action === 'selection-paste') {
      this.pasteSelection();
      this.closeSelectionMenu();
      return;
    }
    if (action === 'selection-cancel') {
      this.selection.clear();
      this.closeSelectionMenu();
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
    if (action === 'export-json') {
      this.exportSongJson();
    }
    if (action === 'export-midi') {
      this.exportSongMidi();
    }
    if (action === 'export-midi-zip') {
      this.exportSongMidiZip();
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
      this.audioSettings.soundfontCdn = 'vendored';
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.toolsMenuOpen = false;
    }
  }

  handleFileMenu(action) {
    if (action === 'new') {
      this.stopPlayback();
      this.song = createDefaultSong();
      this.ensureState();
      this.gridOffsetInitialized = false;
      this.gridZoomX = this.getDefaultGridZoomX();
      this.gridZoomY = this.getDefaultGridZoomY();
      this.gridZoomInitialized = false;
      this.playheadTick = 0;
      this.lastPlaybackTick = 0;
      return;
    }
    if (action === 'save') {
      this.saveSongToLibrary();
      return;
    }
    if (action === 'save-paint') {
      this.saveAndPaint();
      return;
    }
    if (action === 'load') {
      this.loadSongFromLibrary();
      return;
    }
    if (action === 'export-json') {
      this.exportSongJson();
      return;
    }
    if (action === 'export-midi') {
      this.exportSongMidi();
      return;
    }
    if (action === 'export-midi-zip') {
      this.exportSongMidiZip();
      return;
    }
    if (action === 'import') {
      this.importSong();
      return;
    }
    if (action === 'play-robtersession') {
      this.playInRobterSession();
      return;
    }
    if (action === 'settings') {
      this.activeTab = 'settings';
      return;
    }
    if (action === 'theme') {
      this.generateTheme();
      return;
    }
    if (action === 'sample') {
      this.loadDemoSong();
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
      if (isDrumTrack(track)) {
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

  getExportBaseName() {
    return 'chainsaw-midi-song';
  }

  getExportKeySignature() {
    if (!Number.isFinite(this.song?.key)) return null;
    const keyLabel = KEY_LABELS[((this.song.key % 12) + 12) % 12] || 'C';
    const scale = this.song.scale === 'minor' ? 'minor' : 'major';
    return { key: keyLabel, scale };
  }

  buildExportTrackNotes(track, pattern, ticksPerSecond) {
    if (!pattern?.notes?.length) return [];
    return pattern.notes.map((note) => {
      const startTick = Math.max(0, note.startTick ?? 0);
      const durationTicks = Math.max(1, this.getEffectiveDurationTicks(note, track));
      const endTick = startTick + durationTicks;
      return {
        tStartSec: startTick / ticksPerSecond,
        tEndSec: endTick / ticksPerSecond,
        midi: note.pitch,
        vel: clamp(note.velocity ?? 0.8, 0.05, 1)
      };
    });
  }

  buildExportTracks() {
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    return this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const notes = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        return {
          id: track.id || `track-${index + 1}`,
          name: track.name || `Track ${index + 1}`,
          channel: Number.isFinite(track.channel) ? track.channel : 0,
          program: Number.isFinite(track.program) ? track.program : 0,
          notes
        };
      })
      .filter((track) => track.notes.length > 0);
  }

  async buildRobterSessionZip() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const stems = this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const notes = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        if (!notes.length) return null;
        const bytes = buildMidiBytes({
          notes,
          bpm: tempo,
          timeSignature,
          keySignature,
          program: Number.isFinite(track.program) ? track.program : 0,
          channel: Number.isFinite(track.channel) ? track.channel : 0
        });
        const safeName = String(track.name || `Track ${index + 1}`).trim() || `Track ${index + 1}`;
        const sanitized = safeName.replace(/[\\/:*?"<>|]/g, '').trim() || `Track ${index + 1}`;
        const filename = `${sanitized}.mid`;
        return { filename, bytes };
      })
      .filter(Boolean);
    if (!stems.length) return null;
    return buildZipFromStems(stems);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  exportSongJson() {
    const data = JSON.stringify(this.song, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.downloadBlob(blob, `${this.getExportBaseName()}.json`);
  }

  exportSongMidi() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const tracks = this.buildExportTracks();
    const bytes = buildMultiTrackMidiBytes({
      tracks,
      bpm: tempo,
      timeSignature,
      keySignature
    });
    const blob = new Blob([bytes], { type: 'audio/midi' });
    this.downloadBlob(blob, `${this.getExportBaseName()}.mid`);
  }

  async exportSongMidiZip() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const stems = this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const notes = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        if (!notes.length) return null;
        const bytes = buildMidiBytes({
          notes,
          bpm: tempo,
          timeSignature,
          keySignature,
          program: Number.isFinite(track.program) ? track.program : 0,
          channel: Number.isFinite(track.channel) ? track.channel : 0
        });
        const safeName = String(track.name || `Track ${index + 1}`).trim() || `Track ${index + 1}`;
        const sanitized = safeName.replace(/[\\/:*?"<>|]/g, '').trim() || `Track ${index + 1}`;
        const filename = `(${sanitized}).mid`;
        return { filename, bytes };
      })
      .filter(Boolean);
    if (!stems.length) return;
    const blob = await buildZipFromStems(stems);
    this.downloadBlob(blob, `${this.getExportBaseName()}-stems.zip`);
  }

  importSong() {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  async importSongFile(file) {
    const name = file?.name || '';
    const lowerName = name.toLowerCase();
    if (lowerName.endsWith('.mid') || lowerName.endsWith('.midi')) {
      const bytes = await file.arrayBuffer();
      const midiData = parseMidi(bytes);
      const song = this.buildSongFromMidiSources([{
        label: name.replace(/\.(mid|midi)$/i, '') || 'MIDI Track',
        midiData
      }]);
      this.applyImportedSong(song);
      return;
    }
    if (lowerName.endsWith('.zip')) {
      const bytes = await file.arrayBuffer();
      const { stems } = await loadZipSongFromBytes(bytes);
      const sources = [];
      stems.forEach((stem, instrument) => {
        if (!stem?.bytes) return;
        sources.push({
          label: instrument || stem.filename?.replace(/\.mid(i)?$/i, '') || 'MIDI Stem',
          midiData: parseMidi(stem.bytes)
        });
      });
      if (sources.length === 0) {
        throw new Error('No MIDI stems found in zip.');
      }
      const song = this.buildSongFromMidiSources(sources);
      this.applyImportedSong(song);
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    this.applyImportedSong(data);
  }

  buildSongFromMidiSources(sources) {
    const baseSong = createDefaultSong();
    const first = sources.find((entry) => entry?.midiData) || {};
    const tempo = Number.isFinite(first.midiData?.bpm) ? first.midiData.bpm : baseSong.tempo;
    const timeSignature = first.midiData?.timeSignature || baseSong.timeSignature;
    const ticksPerBar = this.ticksPerBeat * (timeSignature?.beats || 4);
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const tracks = [];
    let maxEndTick = 0;
    let colorIndex = 0;

    const toTick = (seconds) => Math.max(0, Math.round(seconds * ticksPerSecond));
    sources.forEach((source) => {
      const midiData = source.midiData;
      if (!midiData) return;
      const trackGroups = midiData.tracks?.length
        ? midiData.tracks
        : [{
          trackIndex: 0,
          channel: midiData.notes.find((note) => Number.isFinite(note.channel))?.channel ?? 0,
          program: null,
          notes: midiData.notes
        }];
      trackGroups.forEach((group, groupIndex) => {
        if (!group?.notes?.length) return;
        const isDrum = isDrumChannel(group.channel ?? 0);
        const program = Number.isFinite(group.program) ? group.program : 0;
        const groupLabel = source.label || `Track ${tracks.length + 1}`;
        const name = trackGroups.length > 1 ? `${groupLabel} ${groupIndex + 1}` : groupLabel;
        const notes = group.notes.map((note) => {
          const startTick = toTick(note.tStartSec);
          const endTick = Math.max(startTick + 1, toTick(note.tEndSec));
          const durationTicks = Math.max(1, endTick - startTick);
          maxEndTick = Math.max(maxEndTick, endTick);
          return {
            id: uid(),
            startTick,
            durationTicks,
            pitch: isDrum ? coerceDrumPitch(note.midi, GM_DRUM_ROWS) : note.midi,
            velocity: clamp(note.vel ?? 0.8, 0.1, 1)
          };
        });
        const track = {
          id: `track-${Date.now()}-${tracks.length}`,
          name,
          channel: isDrum ? GM_DRUM_CHANNEL : (Number.isFinite(group.channel) ? group.channel : 0),
          program,
          bankMSB: isDrum ? DRUM_BANK_MSB : DEFAULT_BANK_MSB,
          bankLSB: isDrum ? DRUM_BANK_LSB : DEFAULT_BANK_LSB,
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          instrument: isDrum ? 'drums' : undefined,
          instrumentFamily: isDrum ? 'Drums' : this.getProgramFamilyLabel(program),
          color: TRACK_COLORS[colorIndex % TRACK_COLORS.length],
          patterns: [{
            id: `pattern-${uid()}`,
            bars: baseSong.loopBars,
            notes
          }]
        };
        tracks.push(track);
        colorIndex += 1;
      });
    });

    if (tracks.length === 0) {
      return baseSong;
    }

    const loopBars = Math.max(DEFAULT_GRID_BARS, Math.ceil((maxEndTick || ticksPerBar) / ticksPerBar));
    tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = loopBars;
      });
    });

    return {
      ...baseSong,
      tempo,
      timeSignature: {
        beats: timeSignature?.beats || 4,
        unit: timeSignature?.unit || 4
      },
      loopBars,
      loopStartTick: 0,
      loopEndTick: loopBars * ticksPerBar,
      loopEnabled: true,
      tracks
    };
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
    this.resetHistory();
    this.persist();
  }

  loadDemoSong() {
    this.song = createDemoSong();
    this.ensureState();
    this.resetHistory();
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
    return [...GM_DRUM_ROWS].reverse();
  }

  getDrumHitDurationTicks() {
    return Math.max(1, this.getQuantizeTicks());
  }

  getEffectiveDurationTicks(note, track = this.getActiveTrack()) {
    if (!note) return 1;
    return isDrumTrack(track) ? this.getDrumHitDurationTicks() : Math.max(1, note.durationTicks);
  }

  coercePitchForTrack(pitch, track = this.getActiveTrack(), rows = null) {
    if (!isDrumTrack(track)) return pitch;
    const drumRows = rows || this.getDrumRows();
    return coerceDrumPitch(pitch, drumRows);
  }

  getBaseVisibleRows(rows) {
    return Math.max(1, Math.min(DEFAULT_VISIBLE_ROWS, rows));
  }

  initializeGridOffset(track, rows, cellHeight) {
    if (this.gridOffsetInitialized) return;
    this.gridOffsetInitialized = true;
    if (!track || isDrumTrack(track)) {
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
      minZoom: Math.max(1, bars / 12),
      maxZoom: Math.max(1, bars)
    };
  }

  getPitchRange() {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
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

  getCellScreenPosition(tick, pitch) {
    if (!this.gridBounds) return null;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(pitch);
    if (row < 0) return null;
    return {
      x: originX + tick * cellWidth,
      y: originY + row * cellHeight
    };
  }

  getTickFromX(x) {
    if (!this.gridBounds) return 0;
    const { originX, cellWidth } = this.gridBounds;
    return Math.floor((x - originX) / cellWidth);
  }

  getPitchFromRow(row) {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
      const rows = this.getDrumRows();
      const entry = rows[row];
      return entry?.pitch ?? rows[0].pitch;
    }
    const range = this.getPitchRange();
    return range.max - row;
  }

  getRowFromPitch(pitch) {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
      const rows = this.getDrumRows();
      const mapped = coerceDrumPitch(pitch, rows);
      return rows.findIndex((row) => row.pitch === mapped);
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
    let nextStart = this.song.loopStartTick + deltaTicks;
    let nextEnd = nextStart + loopLength;
    if (nextEnd > this.getGridTicks()) {
      this.ensureGridCapacity(nextEnd);
    }
    const maxStart = Math.max(0, this.getGridTicks() - loopLength);
    nextStart = clamp(nextStart, 0, maxStart);
    nextEnd = nextStart + loopLength;
    this.song.loopStartTick = nextStart;
    this.song.loopEndTick = nextEnd;
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.persist();
  }

  getNoteHitAt(x, y) {
    if (!this.gridBounds) return null;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return null;
    const drumTrack = isDrumTrack(track);
    let handleHit = null;
    let bodyHit = null;
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      if (y < rect.y || y > rect.y + rect.h) return;
      const handleWidth = drumTrack ? 0 : this.getNoteHandleWidth(rect);
      if (!drumTrack && x >= rect.x - handleWidth && x <= rect.x) {
        handleHit = { note, edge: 'start' };
        return;
      }
      if (!drumTrack && x >= rect.x + rect.w && x <= rect.x + rect.w + handleWidth) {
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
    const track = this.getActiveTrack();
    if (!pattern || !track) return null;
    const drumTrack = isDrumTrack(track);
    const hit = pattern.notes.find((note) => {
      const durationTicks = this.getEffectiveDurationTicks(note, track);
      return tick >= note.startTick && tick < note.startTick + durationTicks && note.pitch === pitch;
    });
    if (!hit) return null;
    const rect = this.getNoteRect(hit);
    if (!rect) return null;
    if (drumTrack) {
      return { note: hit, edge: null };
    }
    const handleWidth = this.getNoteHandleWidth(rect);
    const handleSize = Math.max(6, Math.min(handleWidth, rect.w / 2));
    const cursorX = typeof pointerX === 'number' ? pointerX : this.lastPointer.x;
    const isStartEdge = cursorX <= rect.x + handleSize;
    const isEndEdge = cursorX >= rect.x + rect.w - handleSize;
    return { note: hit, edge: isStartEdge ? 'start' : isEndEdge ? 'end' : null };
  }

  getNoteHandleWidth(rect) {
    return Math.max(22, Math.min(48, Math.round(rect.h * 1.7)));
  }

  getNoteRect(note) {
    if (!this.gridBounds) return null;
    const track = this.getActiveTrack();
    if (!track) return null;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(note.pitch);
    if (row < 0) return null;
    const durationTicks = this.getEffectiveDurationTicks(note, track);
    return {
      x: originX + note.startTick * cellWidth,
      y: originY + row * cellHeight + 1,
      w: Math.max(cellWidth * durationTicks, cellWidth),
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
    if (isDrumTrack(this.getActiveTrack())) {
      this.gridOffset.y = 0;
    } else if (cursorY < y + margin) {
      this.gridOffset.y += (y + margin) - cursorY;
    } else if (cursorY > y + h - margin) {
      this.gridOffset.y -= cursorY - (y + h - margin);
    }
    this.clampGridOffset(w, h, cellWidth * cols, cellHeight * rows);
    this.updateTimelineStartTickFromGrid();
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
    if (this.recordModeActive) {
      this.drawRecordMode(ctx, width, height, track, pattern);
      ctx.restore();
      return;
    }
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
      } else if (this.activeTab === 'song') {
        this.drawSongTab(ctx, contentX, contentY, contentW, contentH);
      } else if (this.activeTab === 'instruments') {
        this.drawInstrumentPanel(ctx, contentX, contentY, contentW, contentH, track);
      } else if (this.activeTab === 'settings') {
        this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
      } else if (this.activeTab === 'file') {
        this.drawFilePanel(ctx, contentX, contentY, contentW, contentH);
      }
    }

    this.drawNoteLengthMenu(ctx, width, height);
    this.drawTempoSlider(ctx, width, height);

    if (this.genreMenuOpen) {
      this.drawGenreMenu(ctx, width, height);
    }

    if (this.qaOverlayOpen) {
      this.drawQaOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  drawRecordMode(ctx, width, height, track, pattern) {
    const padding = 16;
    const gap = 12;
    const sidebarW = Math.min(260, Math.max(190, width * 0.22));
    const sidebarX = padding;
    const sidebarY = padding;
    const sidebarH = height - padding * 2;
    const contentX = sidebarX + sidebarW + gap;
    const contentY = padding;
    const contentW = width - contentX - padding;
    const contentH = height - padding * 2;

    const menuH = this.drawRecordModeSidebar(ctx, sidebarX, sidebarY, sidebarW, sidebarH);

    const gridBounds = {
      x: contentX,
      y: padding,
      w: contentW,
      h: menuH
    };
    const instrumentY = padding + menuH + gap;
    const instrumentH = Math.max(0, height - instrumentY - padding);
    const instrumentBounds = {
      x: 0,
      y: instrumentY,
      w: width,
      h: instrumentH
    };

    const layout = this.recordLayout.layout(contentW, contentH, contentX, contentY, {
      gridBounds,
      instrumentBounds
    });
    const grid = layout.grid;
    const instrument = layout.instrument;
    if (!this.recordGridZoomedOut && track) {
      const rows = isDrumTrack(track)
        ? this.getDrumRows().length
        : this.getPitchRange().max - this.getPitchRange().min + 1;
      const { minZoom } = this.getGridZoomLimits(rows);
      const zoomXLimits = this.getGridZoomLimitsX();
      this.gridZoomX = zoomXLimits.minZoom;
      this.gridZoomY = minZoom;
      this.gridZoomInitialized = true;
      this.recordGridZoomedOut = true;
    }
    if (grid) {
      this.drawPatternEditor(ctx, grid.x, grid.y, grid.w, grid.h, track, pattern, {
        summary: true,
        hideLabels: true,
        uniformNotes: true,
        simplified: true
      });
      this.drawGhostNotes(ctx);
    }
    const recordSelector = this.recordSelector.active
      ? {
        type: this.recordSelector.type,
        index: this.recordSelector.index,
        title: this.recordSelector.type === 'key' ? 'Scale Root' : 'Scale Mode',
        items: this.recordSelector.type === 'key'
          ? KEY_LABELS
          : SCALE_LIBRARY.map((entry) => entry.label)
      }
      : null;
    this.recordLayout.draw(ctx, {
      showGamepadHints: this.recordLayout.device === 'gamepad' && this.gamepadInput.connected,
      isPlaying: this.isPlaying,
      isRecording: this.recorder.isRecording,
      selector: recordSelector,
      stickIndicators: this.recordStickIndicators,
      nowPlaying: this.nowPlaying
    });

  }

  drawRecordModeSidebar(ctx, x, y, w, h) {
    const rowH = 38;
    const rowGap = 8;
    const panelPadding = 10;
    const menuRows = TAB_OPTIONS.length + 2;
    const menuH = Math.min(h, menuRows * rowH + (menuRows - 1) * rowGap + panelPadding * 2);
    const menuX = x;
    const menuY = y;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(menuX, menuY, w, menuH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, w, menuH);

    const innerX = menuX + panelPadding;
    const innerW = w - panelPadding * 2;
    let cursorY = menuY + panelPadding;
    this.bounds.tabs = [];
    this.bounds.fileButton = { x: innerX, y: cursorY, w: innerW, h: rowH };
    this.drawButton(ctx, this.bounds.fileButton, 'File', this.activeTab === 'file', false);
    cursorY += rowH + rowGap;

    TAB_OPTIONS.forEach((tab) => {
      const bounds = { x: innerX, y: cursorY, w: innerW, h: rowH, id: tab.id };
      this.bounds.tabs.push(bounds);
      this.drawButton(ctx, bounds, tab.label, this.activeTab === tab.id, false);
      cursorY += rowH + rowGap;
    });
    const halfW = (innerW - rowGap) / 2;
    this.bounds.undoButton = { x: innerX, y: cursorY, w: halfW, h: rowH };
    this.bounds.redoButton = { x: innerX + halfW + rowGap, y: cursorY, w: halfW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.undoButton, 'Undo', false);
    this.drawSmallButton(ctx, this.bounds.redoButton, 'Redo', false);
    return menuH;
  }

  drawGhostNotes(ctx) {
    if (!this.gridBounds) return;
    const activeNotes = this.recorder.getActiveNotes();
    if (!activeNotes.length) return;
    const elapsed = Math.max(0, this.getRecordingTime() - this.recorder.startTime);
    const currentTick = (elapsed * this.song.tempo / 60) * this.ticksPerBeat;
    ctx.save();
    ctx.fillStyle = 'rgba(255,225,106,0.4)';
    activeNotes.forEach((note) => {
      const startSeconds = Math.max(0, note.startTime - this.recorder.startTime);
      const startTick = (startSeconds * this.song.tempo / 60) * this.ticksPerBeat;
      const tempNote = {
        pitch: note.pitch,
        startTick,
        durationTicks: Math.max(1, currentTick - startTick)
      };
      const rect = this.getNoteRect(tempNote);
      if (!rect) return;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    });
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
    } else if (this.activeTab === 'song') {
      this.drawSongTab(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'instruments') {
      this.drawInstrumentPanel(ctx, contentX, contentY, contentW, contentH, track);
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'file') {
      this.drawFilePanel(ctx, contentX, contentY, contentW, contentH);
    }
  }

  drawMobileSidebar(ctx, x, y, w, h, track) {
    const panelGap = 10;
    const rowH = 38;
    const rowGap = 8;
    const panelPadding = 10;
    const menuRows = TAB_OPTIONS.length + 2;
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
    this.drawButton(ctx, this.bounds.fileButton, 'File', this.activeTab === 'file', false);
    cursorY += rowH + rowGap;

    TAB_OPTIONS.forEach((tab) => {
      const bounds = { x: innerX, y: cursorY, w: innerW, h: rowH, id: tab.id };
      this.bounds.tabs.push(bounds);
      this.drawButton(ctx, bounds, tab.label, this.activeTab === tab.id, false);
      cursorY += rowH + rowGap;
    });
    const halfW = (innerW - rowGap) / 2;
    this.bounds.undoButton = { x: innerX, y: cursorY, w: halfW, h: rowH };
    this.bounds.redoButton = { x: innerX + halfW + rowGap, y: cursorY, w: halfW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.undoButton, 'Undo', false);
    this.drawSmallButton(ctx, this.bounds.redoButton, 'Redo', false);

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
      ? isDrumTrack(track)
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

    this.bounds.record = { x: controlX, y: controlY, w: controlW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.record, 'Record', false);
    controlY += rowH + rowGap;

    if (track) {
      const mix = this.getTrackPlaybackMix(track);
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
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
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
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mix.pan + 1) / 2), panBounds.h);
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
      if (gmStatus.error) {
        const bannerText = `SoundFont error: ${gmStatus.error}`;
        const bannerH = 22;
        const bannerY = y + h - bannerH - 8;
        ctx.fillStyle = 'rgba(255,90,90,0.25)';
        ctx.fillRect(x + 8, bannerY, w - 16, bannerH);
        ctx.strokeStyle = 'rgba(255,120,120,0.6)';
        ctx.strokeRect(x + 8, bannerY, w - 16, bannerH);
        ctx.fillStyle = '#ffd0d0';
        ctx.font = '12px Courier New';
        ctx.fillText(this.truncateLabel(ctx, bannerText, w - 28), x + 14, bannerY + 15);
      }
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
    this.drawButton(ctx, this.bounds.fileButton, 'File', this.activeTab === 'file', false);
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
      { id: 'record', label: '●', w: baseButtonW, active: this.recordModeActive, emphasis: true },
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
      const isRecord = button.id === 'record';
      const baseFill = isRecord ? '#ff6a6a' : isActive ? '#ffe16a' : 'rgba(10,10,10,0.7)';
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

    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = isMobile ? '12px Courier New' : '13px Courier New';
      ctx.fillText('Single Note Mode', x + 12, y + h - 10);
    }

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

  drawSongTab(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const padding = 0;
    const rulerH = DEFAULT_RULER_HEIGHT;
    const rulerY = y + padding;
    const addH = 34;
    const addY = y + h - padding - addH;
    const laneAreaY = rulerY + rulerH;
    const laneAreaH = Math.max(0, addY - laneAreaY);
    const trackCount = Math.max(1, this.song.tracks.length);
    const laneGap = 12;
    const laneBlockH = Math.max(74, Math.min(112, (laneAreaH - laneGap * (trackCount - 1)) / trackCount));
    const isMobile = this.isMobileLayout();
    const labelW = isMobile ? DEFAULT_LABEL_WIDTH_MOBILE : DEFAULT_LABEL_WIDTH;
    const laneX = x + padding + labelW;
    const laneW = w - padding * 2 - labelW;
    const showAutomation = this.keyframePanelOpen;
    const laneH = showAutomation ? Math.max(36, laneBlockH * 0.42) : laneBlockH;
    const automationH = showAutomation ? Math.max(12, (laneBlockH - laneH) / 2 - 6) : 0;
    this.songActionBounds = [];
    this.songPartBounds = [];
    this.songPartHandleBounds = [];

    this.songInstrumentBounds = null;
    this.bounds.songZoomIn = null;
    this.bounds.songZoomOut = null;
    this.songPlayheadBounds = null;
    const selectionRange = this.getSongSelectionRange();

    this.songLaneBounds = [];
    this.songLabelBounds = [];
    this.songAutomationBounds = [];
    let timelineTicks = this.getSongTimelineTicks();
    const baseCellWidth = laneW / timelineTicks;
    const zoomXLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    let cellWidth = baseCellWidth * this.gridZoomX;
    this.ensureTimelineCapacity();
    timelineTicks = this.getSongTimelineTicks();
    cellWidth = (laneW / timelineTicks) * this.gridZoomX;
    let offsetX = -this.timelineStartTick * cellWidth;
    offsetX = this.clampTimelineOffsetX(offsetX, laneW, cellWidth);
    this.songTimelineOffsetX = offsetX;
    this.timelineStartTick = Math.max(0, -offsetX / cellWidth);
    this.timelineSource = 'song';
    const totalW = cellWidth * timelineTicks;
    const originX = laneX + offsetX;
    this.songTimelineBounds = {
      x: laneX,
      y: rulerY,
      w: laneW,
      h: laneAreaH + rulerH,
      originX,
      cellWidth,
      totalW,
      timelineTicks
    };
    this.songRulerBounds = {
      x: laneX,
      y: rulerY,
      w: laneW,
      h: rulerH
    };
    this.drawTimelineRuler(ctx, laneX, rulerY, laneW, rulerH, timelineTicks, this.songTimelineBounds);

    this.song.tracks.forEach((track, index) => {
      const laneTop = laneAreaY + index * (laneBlockH + laneGap);
      if (laneTop + laneBlockH > laneAreaY + laneAreaH + 4) return;
      const labelX = x + padding;
      ctx.fillStyle = index === this.selectedTrackIndex ? 'rgba(255,225,106,0.3)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(labelX, laneTop, labelW, laneBlockH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(labelX, laneTop, labelW, laneBlockH);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText(this.truncateLabel(ctx, track.name, labelW - 20), labelX + 10, laneTop + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '10px Courier New';
      const instrumentLabel = isDrumTrack(track)
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program);
      ctx.fillText(this.truncateLabel(ctx, instrumentLabel, labelW - 20), labelX + 10, laneTop + 34);
      const expandLabel = showAutomation ? 'Mix ▾' : 'Mix ▸';
      const expandH = 18;
      const expandY = laneTop + laneBlockH - expandH - 8;
      const expandBounds = {
        x: labelX + 8,
        y: Math.max(laneTop + 40, expandY),
        w: labelW - 16,
        h: expandH,
        action: 'song-toggle-automation',
        trackIndex: index
      };
      this.drawSmallButton(ctx, expandBounds, expandLabel, showAutomation);
      this.songActionBounds.push(expandBounds);
      this.songLabelBounds.push({ x: labelX, y: laneTop, w: labelW, h: laneBlockH, trackIndex: index });

      const laneBounds = { x: laneX, y: laneTop, w: laneW, h: laneH, trackIndex: index };
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      ctx.strokeStyle = track.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      this.songLaneBounds.push(laneBounds);

      ctx.save();
      ctx.beginPath();
      ctx.rect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      ctx.clip();
      const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
      for (let barTick = 0; barTick <= timelineTicks; barTick += ticksPerBar) {
        const barX = originX + barTick * cellWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(barX, laneBounds.y);
        ctx.lineTo(barX, laneBounds.y + laneBounds.h);
        ctx.stroke();
      }
      if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
        const loopStartX = originX + this.song.loopStartTick * cellWidth;
        const loopEndX = originX + this.song.loopEndTick * cellWidth;
        ctx.fillStyle = 'rgba(255,225,106,0.12)';
        ctx.fillRect(loopStartX, laneBounds.y, loopEndX - loopStartX, laneBounds.h);
      }

      const pattern = track.patterns?.[this.selectedPatternIndex];
      if (pattern) {
        const partRanges = this.getPatternPartRanges(pattern, timelineTicks)
          .map((range, idx) => ({ ...range, partIndex: idx }));
        partRanges.forEach((range) => {
          const partStart = range.startTick;
          const partEnd = range.endTick;
          const partX = originX + partStart * cellWidth;
          const partW = Math.max(1, (partEnd - partStart) * cellWidth);
          const partBounds = {
            x: partX,
            y: laneBounds.y,
            w: partW,
            h: laneBounds.h,
            trackIndex: index,
            partIndex: range.partIndex,
            startTick: partStart,
            endTick: partEnd
          };
          this.songPartBounds.push(partBounds);
          const partSelected = selectionRange
            && selectionRange.trackStartIndex === index
            && selectionRange.trackEndIndex === index
            && selectionRange.startTick === partStart
            && selectionRange.endTick === partEnd;
          const partBaseColor = track.color || '#ffffff';
          ctx.fillStyle = partSelected
            ? toRgba(partBaseColor, 0.66)
            : toRgba(partBaseColor, 0.3);
          ctx.fillRect(partX, laneBounds.y, partW, laneBounds.h);
          if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0 && range.partIndex > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,225,106,0.6)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(partX, laneBounds.y + 1);
            ctx.lineTo(partX, laneBounds.y + laneBounds.h - 1);
            ctx.stroke();
            ctx.restore();
          }
          if (partSelected) {
            const handleW = 14;
            const handleHitPad = 8;
            const leftHandle = {
              x: partX - handleW / 2,
              y: laneBounds.y + 2,
              w: handleW,
              h: Math.max(8, laneBounds.h - 4),
              trackIndex: index,
              partIndex: range.partIndex,
              edge: 'start'
            };
            const rightHandle = {
              x: partX + partW - handleW / 2,
              y: laneBounds.y + 2,
              w: handleW,
              h: Math.max(8, laneBounds.h - 4),
              trackIndex: index,
              partIndex: range.partIndex,
              edge: 'end'
            };
            this.songPartHandleBounds.push(
              {
                ...leftHandle,
                x: leftHandle.x - handleHitPad,
                y: leftHandle.y - handleHitPad,
                w: leftHandle.w + handleHitPad * 2,
                h: leftHandle.h + handleHitPad * 2
              },
              {
                ...rightHandle,
                x: rightHandle.x - handleHitPad,
                y: rightHandle.y - handleHitPad,
                w: rightHandle.w + handleHitPad * 2,
                h: rightHandle.h + handleHitPad * 2
              }
            );
            ctx.fillStyle = 'rgba(255,225,106,0.95)';
            ctx.fillRect(leftHandle.x, leftHandle.y, leftHandle.w, leftHandle.h);
            ctx.fillRect(rightHandle.x, rightHandle.y, rightHandle.w, rightHandle.h);
          }
        });
      }

      if (pattern) {
        const notes = pattern.notes || [];
        if (notes.length > 0) {
          const pitches = notes.map((note) => note.pitch);
          const minPitch = Math.min(...pitches);
          const maxPitch = Math.max(...pitches);
          const range = Math.max(1, maxPitch - minPitch);
          notes.forEach((note) => {
            const noteX = originX + note.startTick * cellWidth;
            const noteW = Math.max(2, note.durationTicks * cellWidth);
            const pitchRatio = (note.pitch - minPitch) / range;
            const noteY = laneBounds.y + 4 + (1 - pitchRatio) * (laneBounds.h - 8);
            ctx.fillStyle = toRgba(track.color, 0.7);
            ctx.fillRect(noteX, noteY - 2, noteW, 4);
          });
        }
      }

      if (selectionRange && index >= selectionRange.trackStartIndex && index <= selectionRange.trackEndIndex) {
        const selStart = originX + selectionRange.startTick * cellWidth;
        const selEnd = originX + selectionRange.endTick * cellWidth;
        ctx.fillStyle = 'rgba(255,225,106,0.2)';
        ctx.fillRect(selStart, laneBounds.y, selEnd - selStart, laneBounds.h);
        ctx.strokeStyle = 'rgba(255,225,106,0.6)';
        ctx.strokeRect(selStart, laneBounds.y, selEnd - selStart, laneBounds.h);
      }
      if (this.songSplitTool.active
        && selectionRange
        && (index < selectionRange.trackStartIndex || index > selectionRange.trackEndIndex)) {
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      }
      ctx.restore();

      if (showAutomation) {
        const panBounds = {
          x: laneX,
          y: laneTop + laneH + 6,
          w: laneW,
          h: automationH,
          trackIndex: index,
          type: 'pan'
        };
        const padBounds = {
          x: laneX,
          y: panBounds.y + automationH + 6,
          w: laneW,
          h: automationH,
          trackIndex: index,
          type: 'padding'
        };
        const panValue = this.getTrackAutomationValue(track, 'pan', this.playheadTick, track.pan ?? 0);
        const volumeValue = this.getTrackAutomationValue(track, 'padding', this.playheadTick, track.volume ?? 0.8);
        this.drawAutomationLane(ctx, panBounds, track.automation?.pan || [], -1, 1, 'Pan', {
          originX,
          cellWidth
        }, { tick: this.playheadTick, value: panValue });
        this.drawAutomationLane(ctx, padBounds, track.automation?.padding || [], 0, 1, 'Volume', {
          originX,
          cellWidth
        }, { tick: this.playheadTick, value: volumeValue });
        this.songAutomationBounds.push(panBounds, padBounds);
      }
    });

    this.songAddBounds = { x: x + padding, y: addY, w: w - padding * 2, h: addH };
    this.drawButton(ctx, this.songAddBounds, 'Add Instrument', false, false);
    this.drawSongPlayhead(ctx, this.songTimelineBounds.y, laneAreaY + laneAreaH);
    this.drawSongSelectionMenu(ctx);
    this.drawSongSplitTool(ctx);
    this.drawSongShiftTool(ctx);
  }

  drawTimelineRuler(ctx, x, y, w, h, loopTicks, timeline) {
    if (!timeline) return;
    const { originX, cellWidth } = timeline;
    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      ctx.fillStyle = 'rgba(255,225,106,0.25)';
      ctx.fillRect(loopStartX, y, loopEndX - loopStartX, h);
      const handleW = Math.max(LOOP_HANDLE_MIN_WIDTH, Math.round(h * 1.4));
      const handleH = Math.max(LOOP_HANDLE_MIN_HEIGHT, Math.round(h * 1.1));
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

  drawSongPlayhead(ctx, topY, bottomY) {
    if (!this.songTimelineBounds) return;
    const xPos = this.getSongTimelineX(this.playheadTick);
    const handleWidth = 14;
    this.songPlayheadBounds = {
      x: xPos - handleWidth / 2,
      y: topY,
      w: handleWidth,
      h: bottomY - topY
    };
    ctx.strokeStyle = '#ffe16a';
    ctx.beginPath();
    ctx.moveTo(xPos, topY);
    ctx.lineTo(xPos, bottomY);
    ctx.stroke();
  }

  drawSongSelectionMenu(ctx) {
    if (!this.songSelectionMenu.open || !this.songTimelineBounds) {
      this.songSelectionMenu.bounds = [];
      return;
    }
    const range = this.getSongSelectionRange();
    if (!range) {
      this.songSelectionMenu.bounds = [];
      this.songSelectionMenu.open = false;
      return;
    }
    const laneBounds = this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex);
    if (!laneBounds) {
      this.songSelectionMenu.bounds = [];
      return;
    }
    const actions = [
      { action: 'song-merge-left', label: 'Merge Left' },
      { action: 'song-merge-right', label: 'Merge Right' },
      { action: 'song-splice', label: 'Split Parts' },
      { action: 'song-repeat', label: 'Repeat' },
      { action: 'song-duplicate', label: 'Duplicate' },
      { action: 'song-shift-note', label: 'Shift Note' },
      { action: 'song-copy', label: 'Copy' },
      { action: 'song-cut', label: 'Cut' },
      { action: 'song-delete', label: 'Delete' },
      { action: 'song-loop-selection', label: 'Loop this' }
    ];
    const menuScale = 1.25;
    const buttonW = (this.isMobileLayout() ? 188 : 168) * menuScale;
    const buttonH = (this.isMobileLayout() ? 50 : 44) * menuScale;
    const gap = 10 * menuScale;
    const columns = 2;
    const rows = Math.ceil(actions.length / columns);
    const menuW = columns * buttonW + gap * (columns + 1);
    const menuH = rows * buttonH + gap * (rows + 1);
    const selStart = this.getSongTimelineX(range.startTick);
    const selEnd = this.getSongTimelineX(range.endTick);
    const midX = (selStart + selEnd) / 2 - menuW / 2;
    let menuX = clamp(midX, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - menuW);
    let menuY = laneBounds.y - menuH - 8;
    if (menuY < this.songTimelineBounds.y) {
      menuY = laneBounds.y + laneBounds.h + 8;
    }
    menuY = clamp(menuY, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - menuH);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, menuW, menuH);
    this.songSelectionMenu.bounds = [];
    actions.forEach((entry, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const bx = menuX + gap + col * (buttonW + gap);
      const by = menuY + gap + row * (buttonH + gap);
      const bounds = {
        x: bx,
        y: by,
        w: buttonW,
        h: buttonH,
        action: entry.action,
        __midiScaled125: true
      };
      this.drawSmallButton(ctx, bounds, entry.label, false);
      this.songSelectionMenu.bounds.push(bounds);
    });
  }

  drawSongSplitTool(ctx) {
    if (!this.songSplitTool.active || !this.songTimelineBounds) {
      this.songSplitTool.bounds.lineGrab = null;
      this.songSplitTool.bounds.handleTop = null;
      this.songSplitTool.bounds.handleBottom = null;
      this.songSplitTool.bounds.splitAction = null;
      this.songSplitTool.bounds.cancelAction = null;
      return;
    }
    const range = this.getSongSelectionRange();
    if (!range || range.durationTicks < 2) {
      this.songSplitTool.active = false;
      return;
    }
    const tick = clamp(Math.round(this.songSplitTool.tick), range.startTick + 1, range.endTick - 1);
    this.songSplitTool.tick = tick;
    const x = this.getSongTimelineX(tick);
    const top = this.songTimelineBounds.y;
    const bottom = this.songTimelineBounds.y + this.songTimelineBounds.h;
    const grabW = this.isMobileLayout() ? 72 : 56;
    this.songSplitTool.bounds.lineGrab = {
      x: x - grabW / 2,
      y: top,
      w: grabW,
      h: bottom - top
    };
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#ff5959';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();

    const handleW = this.isMobileLayout() ? 34 : 28;
    const handleH = this.isMobileLayout() ? 18 : 14;
    const hitPad = this.isMobileLayout() ? 14 : 10;
    const topHandle = { x: x - handleW / 2, y: top + 2, w: handleW, h: handleH };
    const bottomHandle = { x: x - handleW / 2, y: bottom - handleH - 2, w: handleW, h: handleH };
    this.songSplitTool.bounds.handleTop = {
      x: topHandle.x - hitPad,
      y: topHandle.y - hitPad,
      w: topHandle.w + hitPad * 2,
      h: topHandle.h + hitPad * 2
    };
    this.songSplitTool.bounds.handleBottom = {
      x: bottomHandle.x - hitPad,
      y: bottomHandle.y - hitPad,
      w: bottomHandle.w + hitPad * 2,
      h: bottomHandle.h + hitPad * 2
    };
    ctx.fillStyle = '#ff5959';
    ctx.fillRect(topHandle.x, topHandle.y, topHandle.w, topHandle.h);
    ctx.fillRect(bottomHandle.x, bottomHandle.y, bottomHandle.w, bottomHandle.h);

    const action = {
      x: 0,
      y: 0,
      w: 108,
      h: 30,
      action: 'song-split-apply'
    };
    const cancelAction = {
      x: 0,
      y: 0,
      w: 92,
      h: 30,
      action: 'song-split-cancel'
    };
    const selectedLane = this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex);
    if (selectedLane) {
      const onFirstTrack = range.trackIndex === 0;
      const anchorY = onFirstTrack
        ? selectedLane.y + selectedLane.h + 8
        : selectedLane.y - action.h - 8;
      const controlsY = clamp(anchorY, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - action.h);
      const totalW = action.w + 8 + cancelAction.w;
      const startX = clamp(x - totalW / 2, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - totalW);
      action.x = startX;
      action.y = controlsY;
      cancelAction.x = startX + action.w + 8;
      cancelAction.y = controlsY;
    } else {
      action.x = clamp(x + 12, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - 110);
      action.y = clamp(top + 12, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - 34);
      cancelAction.x = clamp(action.x + action.w + 8, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - cancelAction.w);
      cancelAction.y = action.y;
    }
    this.songSplitTool.bounds.splitAction = action;
    this.songSplitTool.bounds.cancelAction = cancelAction;
    this.drawSmallButton(ctx, action, 'Split here', true);
    this.drawSmallButton(ctx, cancelAction, 'Cancel', false);
  }

  drawSongShiftTool(ctx) {
    if (!this.songShiftTool.active || !this.songTimelineBounds) {
      this.songShiftTool.bounds.slider = null;
      this.songShiftTool.bounds.knob = null;
      this.songShiftTool.bounds.apply = null;
      this.songShiftTool.bounds.cancel = null;
      return;
    }
    const range = this.getSongSelectionRange();
    const lane = range ? this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex) : null;
    if (!range || !lane) {
      this.songShiftTool.active = false;
      return;
    }
    const sliderH = Math.min(220, Math.max(140, lane.h + 80));
    const sliderW = this.isMobileLayout() ? 28 : 22;
    const sliderX = clamp(lane.x + lane.w + 14, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - sliderW - 120);
    const sliderY = clamp(lane.y + lane.h / 2 - sliderH / 2, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - sliderH);
    const slider = { x: sliderX, y: sliderY, w: sliderW, h: sliderH };
    this.songShiftTool.bounds.slider = slider;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(slider.x, slider.y, slider.w, slider.h);

    const ratio = (clamp(this.songShiftTool.semitones, -12, 12) + 12) / 24;
    const knobY = slider.y + slider.h - ratio * slider.h;
    const knob = { x: slider.x - 8, y: knobY - 8, w: slider.w + 16, h: 16 };
    this.songShiftTool.bounds.knob = knob;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knob.x, knob.y, knob.w, knob.h);

    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`Shift ${this.songShiftTool.semitones > 0 ? '+' : ''}${this.songShiftTool.semitones}`, slider.x - 10, slider.y - 8);

    const apply = { x: slider.x + slider.w + 10, y: slider.y + 4, w: 92, h: 30, action: 'song-shift-apply' };
    const cancel = { x: slider.x + slider.w + 10, y: slider.y + 40, w: 92, h: 30, action: 'song-shift-cancel' };
    this.songShiftTool.bounds.apply = apply;
    this.songShiftTool.bounds.cancel = cancel;
    this.drawSmallButton(ctx, apply, 'Apply', true);
    this.drawSmallButton(ctx, cancel, 'Cancel', false);
  }

  drawAutomationLane(ctx, bounds, keyframes, minValue, maxValue, label, timeline, indicator = null) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Courier New';
    ctx.fillText(label, bounds.x + 6, bounds.y + bounds.h - 3);

    const totalTicks = this.getSongTimelineTicks();
    const originX = timeline?.originX ?? bounds.x;
    const cellWidth = timeline?.cellWidth ?? (bounds.w / totalTicks || 1);
    if (!keyframes.length) {
      if (indicator && Number.isFinite(indicator.tick) && Number.isFinite(indicator.value)) {
        const value = clamp(indicator.value, minValue, maxValue);
        const valueRatio = (value - minValue) / (maxValue - minValue || 1);
        const x = originX + indicator.tick * cellWidth;
        const y = bounds.y + bounds.h - valueRatio * bounds.h;
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,225,106,0.8)';
    ctx.beginPath();
    sorted.forEach((frame, index) => {
      const value = clamp(frame.value ?? 0, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + frame.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    sorted.forEach((frame) => {
      const value = clamp(frame.value ?? 0, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + frame.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      ctx.fillStyle = '#ffe16a';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    if (indicator && Number.isFinite(indicator.tick) && Number.isFinite(indicator.value)) {
      const value = clamp(indicator.value, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + indicator.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawGridControls(ctx, x, y, w, track) {
    const rowH = 44;
    const gap = 8;
    const buttonSize = rowH;
    let cursorX = x;
    ctx.font = '13px Courier New';
    this.bounds.instrumentSettingsControls = [];
    this.bounds.keyframeToggle = null;
    this.bounds.keyframeSet = null;
    this.bounds.keyframeRemove = null;
    const drumGrid = isDrumTrack(track);
    const label = track
      ? drumGrid
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

    const row2Y = y + rowH + gap;
    let row2X = x;
    if (!drumGrid) {
      const noteLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
      const noteW = Math.min(160, Math.max(120, ctx.measureText(noteLabel).width + 28));
      this.bounds.noteLength = { x: cursorX, y, w: noteW, h: rowH };
      this.drawButton(ctx, this.bounds.noteLength, noteLabel, false, false);

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
    } else {
      this.bounds.noteLength = null;
      this.bounds.chordMode = null;
      this.bounds.chordEdit = null;
    }

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

    const keyframeRowY = row2Y + rowH + gap;
    const keyframeLabel = this.keyframePanelOpen ? 'Keyframes ▾' : 'Keyframes ▸';
    const keyframeW = Math.min(180, Math.max(140, ctx.measureText(keyframeLabel).width + 28));
    this.bounds.keyframeToggle = { x, y: keyframeRowY, w: keyframeW, h: rowH };
    this.drawButton(ctx, this.bounds.keyframeToggle, keyframeLabel, this.keyframePanelOpen, false);

    let extraHeight = rowH + gap;
    if (this.keyframePanelOpen && track) {
      const panelY = keyframeRowY + rowH + gap;
      const panelPadding = 10;
      const sliderW = w - panelPadding * 2;
      const sliderX = x + panelPadding;
      const sliderH = 16;
      const sliderGap = 20;
      const mixVolume = clamp(track.volume ?? 0.8, 0, 1);
      const mixPan = clamp(track.pan ?? 0, -1, 1);

      const panelHeight = panelPadding + 10 + sliderH + sliderGap + sliderH + 18 + 32 + panelPadding;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, panelY, w, panelHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, panelY, w, panelHeight);

      const volumeBounds = {
        x: sliderX,
        y: panelY + panelPadding + 10,
        w: sliderW,
        h: sliderH,
        trackIndex: this.selectedTrackIndex,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mixVolume, volumeBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText('Volume', sliderX, volumeBounds.y - 6);
      this.bounds.instrumentSettingsControls.push(volumeBounds);

      const panBounds = {
        x: sliderX,
        y: volumeBounds.y + sliderH + sliderGap,
        w: sliderW,
        h: sliderH,
        trackIndex: this.selectedTrackIndex,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mixPan + 1) / 2), panBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText('Pan (L/R)', sliderX, panBounds.y - 6);
      this.bounds.instrumentSettingsControls.push(panBounds);

      const buttonY = panBounds.y + sliderH + 18;
      const buttonGap = 12;
      const buttonW = (w - panelPadding * 2 - buttonGap) / 2;
      this.bounds.keyframeSet = {
        x: sliderX,
        y: buttonY,
        w: buttonW,
        h: 32
      };
      this.bounds.keyframeRemove = {
        x: sliderX + buttonW + buttonGap,
        y: buttonY,
        w: buttonW,
        h: 32
      };
      this.drawButton(ctx, this.bounds.keyframeSet, 'Set Keyframe', false, false);
      this.drawButton(ctx, this.bounds.keyframeRemove, 'Remove Keyframe', false, false);

      extraHeight += panelHeight + gap;
    }

    return rowH * 2 + gap + extraHeight;
  }

  drawGridZoomControls(ctx, x, y, w, h) {
    const drumGrid = isDrumTrack(this.getActiveTrack());
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
    this.bounds.zoomInY = drumGrid ? null : zoomInYBounds;
    this.bounds.zoomOutY = drumGrid ? null : zoomOutYBounds;
    this.drawSmallButton(ctx, zoomInXBounds, '+', false);
    this.drawSmallButton(ctx, zoomOutXBounds, '−', false);
    if (!drumGrid) {
      this.drawSmallButton(ctx, zoomInYBounds, '+', false);
      this.drawSmallButton(ctx, zoomOutYBounds, '−', false);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Courier New';
    ctx.fillText('X', zoomOutXBounds.x + 9, zoomOutXBounds.y - 6);
    if (!drumGrid) {
      ctx.fillText('Y', zoomOutYBounds.x + 9, zoomOutYBounds.y - 6);
    }
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
      const downloadKey = this.getCacheKeyForProgram(
        downloadProgram,
        pickerTrack?.channel ?? 0,
        pickerTrack?.bankMSB ?? DEFAULT_BANK_MSB,
        pickerTrack?.bankLSB ?? DEFAULT_BANK_LSB
      );
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
    const instrumentLabel = isDrumTrack(track)
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

    const mix = this.getTrackPlaybackMix(track);
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
    ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
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
    ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mix.pan + 1) / 2), panBounds.h);
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

    const drawButtonRow = (label, buttons, description) => {
      const buttonGap = 10;
      const buttonH = 36;
      const totalW = w - padding * 2 - labelW;
      const buttonW = (totalW - buttonGap * (buttons.length - 1)) / buttons.length;
      const baseX = x + padding + labelW;
      const baseY = cursorY + Math.round((rowH - buttonH) / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '13px Courier New';
      ctx.fillText(label, x + padding, cursorY + 22);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      if (description) {
        ctx.fillText(description, x + padding, cursorY + 40);
      }
      buttons.forEach((button, index) => {
        const bounds = {
          x: baseX + index * (buttonW + buttonGap),
          y: baseY,
          w: buttonW,
          h: buttonH,
          id: button.id,
          disabled: button.disabled
        };
        this.drawButton(ctx, bounds, button.label, button.active, button.disabled);
        this.bounds.settingsControls.push(bounds);
      });
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
    drawSlider(
      'Master Pan',
      `${Math.round(this.audioSettings.masterPan * 100)}%`,
      (clamp(this.audioSettings.masterPan, -1, 1) + 1) / 2,
      'audio-master-pan',
      'Pan the entire mix left/right.'
    );
    drawToggle('Reverb', this.audioSettings.reverbEnabled, 'audio-reverb-toggle', 'Adds space to GM playback.');
    drawSlider('Reverb Level', `${Math.round(this.audioSettings.reverbLevel * 100)}%`, this.audioSettings.reverbLevel, 'audio-reverb-level', 'Wet mix for the reverb bus.');
    drawSlider('Output Latency', `${this.audioSettings.latencyMs} ms`, this.audioSettings.latencyMs / 120, 'audio-latency', 'Increase if audio crackles.');
    drawToggle('SoundFont Instruments', this.audioSettings.useSoundfont, 'audio-soundfont-toggle', 'Use sample-based GM instruments (recommended).');
    const cdnLabel = SOUNDFONT_CDNS.find((entry) => entry.id === this.audioSettings.soundfontCdn)?.label || 'GitHub Pages';
    drawAction('SoundFont CDN', cdnLabel, 'audio-soundfont-cdn', 'Switch CDN source for the FluidR3_GM bank.');
    drawAction('Preload Instrument', 'Load', 'audio-soundfont-preload', 'Preload the active track SoundFont.');
    const availableKits = this.game?.audio?.listAvailableDrumKits?.();
    const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
    const activeKit = drumKits.find((kit) => kit.id === this.audioSettings.drumKitId) || drumKits[0];
    drawAction('Drum Kit', activeKit?.label || 'Standard Kit', 'audio-drumkit', 'Select the GM drum kit for channel 10.');
    drawAction('Test Drum Kit', 'Play', 'audio-drum-test', 'Plays kick/snare/hats/toms/cymbals to verify routing.');
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
    const midiDebug = this.game?.audio?.getMidiDebugInfo?.();
    if (midiDebug) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Courier New';
      const debugKit = midiDebug.drumKit?.label || activeKit?.label || 'Standard Kit';
      ctx.fillText(`Drum Kit: ${debugKit}`, x + padding, cursorY + 16);
      cursorY += 18;
      const drumNote = midiDebug.lastDrumNote
        ? `${midiDebug.lastDrumNote.label} (${midiDebug.lastDrumNote.pitch})`
        : 'None';
      ctx.fillText(`Last Drum: ${drumNote}`, x + padding, cursorY + 16);
      cursorY += 18;
      const channelType = midiDebug.lastChannelType
        ? `${midiDebug.lastChannelType} (Ch ${Number.isInteger(midiDebug.lastChannel) ? midiDebug.lastChannel + 1 : '?'})`
        : 'None';
      ctx.fillText(`Channel: ${channelType}`, x + padding, cursorY + 16);
      cursorY += 24;
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

    drawSectionTitle('Virtual Instruments');
    const gamepadConnected = this.gamepadInput.connected;
    const preferredDevice = this.recordDevicePreference === 'auto'
      ? (gamepadConnected ? 'gamepad' : 'touch')
      : this.recordDevicePreference;
    drawButtonRow(
      'Input',
      [
        {
          id: 'virtual-device-gamepad',
          label: gamepadConnected ? 'Gamepad' : 'No Pad',
          active: preferredDevice === 'gamepad',
          disabled: !gamepadConnected
        },
        {
          id: 'virtual-device-touch',
          label: 'Touch',
          active: preferredDevice === 'touch',
          disabled: false
        }
      ],
      'Choose the control source for virtual instruments.'
    );
    cursorY += sectionGap;

    drawSectionTitle('Touch Input');
    drawToggle(
      'Reverse Strings',
      this.reverseStrings,
      'touch-reverse-strings',
      'Place the lowest string at the top for guitar/bass.'
    );
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
      'Drag a box to select notes, then use Copy / Cut / Paste.',
      `Play/Pause: ${this.controllerMapping.play}`,
      `Open Instruments: ${this.controllerMapping.instrument}`,
      `Place Note: ${this.controllerMapping.place}`,
      `Erase Note: ${this.controllerMapping.erase}`,
      'RT + Left Stick: selection box',
      'LT + D-Pad Left/Right: undo/redo',
      'LB + D-Pad: play/record/measure jump',
      'Back: single note record mode',
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
      'RT + Left Stick: selection box',
      'LT + D-Pad Left/Right: undo/redo',
      'LB + D-Pad: play/record/measure jump',
      'LB + Left Stick: grow selection note',
      'LB + Right Stick: shrink selection note',
      'Back: single note record mode'
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
    const masterBounds = { x, y: cursorY, w, h: rowH };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(masterBounds.x, masterBounds.y, masterBounds.w, masterBounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(masterBounds.x, masterBounds.y, masterBounds.w, masterBounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    ctx.fillText('Master', masterBounds.x + 10, masterBounds.y + 22);
    const masterVolumeBounds = {
      x: masterBounds.x + 120,
      y: masterBounds.y + 42,
      w: masterBounds.w - 140,
      h: 12,
      control: 'master-volume'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(masterVolumeBounds.x, masterVolumeBounds.y, masterVolumeBounds.w, masterVolumeBounds.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(
      masterVolumeBounds.x,
      masterVolumeBounds.y,
      masterVolumeBounds.w * clamp(this.audioSettings.masterVolume, 0, 1),
      masterVolumeBounds.h
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(masterVolumeBounds.x, masterVolumeBounds.y, masterVolumeBounds.w, masterVolumeBounds.h);
    this.trackControlBounds.push(masterVolumeBounds);

    const masterPanBounds = {
      x: masterBounds.x + 120,
      y: masterBounds.y + 60,
      w: masterBounds.w - 140,
      h: 10,
      control: 'master-pan'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(masterPanBounds.x, masterPanBounds.y, masterPanBounds.w, masterPanBounds.h);
    ctx.fillStyle = '#4fb7ff';
    ctx.fillRect(
      masterPanBounds.x,
      masterPanBounds.y,
      masterPanBounds.w * ((clamp(this.audioSettings.masterPan, -1, 1) + 1) / 2),
      masterPanBounds.h
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(masterPanBounds.x, masterPanBounds.y, masterPanBounds.w, masterPanBounds.h);
    this.trackControlBounds.push(masterPanBounds);
    cursorY += rowH + gap;
    this.song.tracks.forEach((track, index) => {
      const mix = this.getTrackPlaybackMix(track);
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
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
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
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mix.pan + 1) / 2), panBounds.h);
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
    if (track && isDrumTrack(track)) {
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
    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Courier New`;
      ctx.fillText('Single Note', x + w - offset(160), y + offset(88));
    }
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
    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = '12px Courier New';
      ctx.fillText('Single Note Mode', innerX, this.bounds.swing.y + 50);
    }
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
      const mix = this.getTrackPlaybackMix(track);
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
      const isDrums = isDrumTrack(track);
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
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      this.trackControlBounds.push({ ...volumeBounds, trackIndex: index, control: 'volume' });

      this.trackBounds.push({ x: x + 12, y: rowY, w: w - 24, h: rowH - 8, index });
    });
  }

  drawPatternEditor(ctx, x, y, w, h, track, pattern, options = {}) {
    if (!track || !pattern) return;
    const simplified = options.simplified;
    const gridTicks = this.getGridTicks();
    const drumGrid = isDrumTrack(track);
    const rows = drumGrid
      ? this.getDrumRows().length
      : this.getPitchRange().max - this.getPitchRange().min + 1;
    const isMobile = this.isMobileLayout();
    const labelW = options.hideLabels ? 0 : (isMobile ? DEFAULT_LABEL_WIDTH_MOBILE : DEFAULT_LABEL_WIDTH);
    const rulerH = simplified ? 0 : DEFAULT_RULER_HEIGHT;
    const viewW = w - labelW;
    const baseCellWidth = viewW / gridTicks;
    const baseVisibleRows = this.getBaseVisibleRows(rows);
    const { minZoom, maxZoom } = this.getGridZoomLimits(rows);
    const zoomXLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    this.gridZoomY = clamp(this.gridZoomY, minZoom, maxZoom);
    const baseCellHeight = drumGrid
      ? Math.max(26, (h - rulerH - 12) / Math.max(1, rows))
      : Math.min(24, (h - rulerH - 16) / baseVisibleRows);
    const viewH = Math.max(0, h - rulerH);
    if (!this.gridZoomInitialized) {
      const desiredVisibleRows = 12;
      this.gridZoomY = clamp(viewH / (desiredVisibleRows * baseCellHeight), minZoom, maxZoom);
      this.gridZoomInitialized = true;
    }
    const cellWidth = baseCellWidth * this.gridZoomX;
    let cellHeight = baseCellHeight * this.gridZoomY;
    const totalGridW = cellWidth * gridTicks;
    if (drumGrid) {
      this.gridZoomY = 1;
      cellHeight = Math.max(24, (viewH - 4) / Math.max(1, rows));
      this.gridOffset.y = 0;
    }
    if (Number.isFinite(this.timelineStartTick)) {
      if (this.timelineSource === 'song') {
        this.gridOffset.x = -this.timelineStartTick * cellWidth;
        this.timelineSource = 'grid';
      } else {
        this.timelineStartTick = Math.max(0, -this.gridOffset.x / cellWidth);
      }
    }
    const gridH = drumGrid ? viewH : cellHeight * rows;
    this.initializeGridOffset(track, rows, cellHeight);
    this.clampGridOffset(viewW, viewH, totalGridW, drumGrid ? viewH : gridH);
    const originX = x + labelW + this.gridOffset.x;
    const originY = y + rulerH + (drumGrid ? 0 : this.gridOffset.y);

    this.rulerBounds = { x: x + labelW, y, w: viewW, h: rulerH };
    this.gridBounds = {
      x: x + labelW,
      y: y + rulerH,
      w: viewW,
      h: viewH,
      cols: gridTicks,
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
    if (!simplified) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, y, w, viewH + rulerH);
    }

    if (!simplified) {
      this.drawRuler(ctx, x + labelW, y, viewW, rulerH, gridTicks);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + labelW, y + rulerH, viewW, viewH);
    ctx.clip();
    this.drawGrid(ctx, track, pattern, gridTicks, options);
    if (!simplified) {
      this.drawPlayhead(ctx);
      this.drawCursor(ctx);
    }
    ctx.restore();

    if (!options.hideLabels) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, labelW, viewH + rulerH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, y, labelW, viewH + rulerH);
      this.drawLabelColumn(ctx, track);
    }
    if (!simplified) {
      this.drawSelectionMenu(ctx);
    }
  }

  drawRuler(ctx, x, y, w, h, loopTicks) {
    if (!this.gridBounds) return;
    this.drawTimelineRuler(ctx, x, y, w, h, loopTicks, this.gridBounds);
  }

  drawGrid(ctx, track, pattern, loopTicks, options = {}) {
    const { originX, originY, cellWidth, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumTrack(track);
    const chordMode = this.chordMode;
    const scalePitchClasses = this.getScalePitchClasses();
    const simplified = options.simplified;
    this.bounds.pasteAction = null;

    for (let row = 0; row < rows; row += 1) {
      if (options.summary) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
      } else if (isDrumGrid) {
        ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.03)';
      } else {
        const pitch = this.getPitchFromRow(row);
        const pitchClass = pitch % 12;
        const isScaleTone = scalePitchClasses.includes(pitchClass);
        if (!chordMode) {
          ctx.fillStyle = isBlackKey(pitchClass)
            ? 'rgba(0,0,0,0.4)'
            : 'rgba(255,255,255,0.06)';
        } else if (isScaleTone) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
        }
      }
      ctx.fillRect(originX, originY + row * cellHeight, cellWidth * loopTicks, cellHeight);
    }

    if (isDrumGrid && !simplified && !options.summary) {
      const padInset = Math.max(1, Math.min(4, Math.round(Math.min(cellWidth, cellHeight) * 0.12)));
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let row = 0; row < rows; row += 1) {
        const yPos = originY + row * cellHeight + padInset;
        const padH = Math.max(2, cellHeight - padInset * 2);
        for (let tick = 0; tick < loopTicks; tick += 1) {
          const xPos = originX + tick * cellWidth + padInset;
          const padW = Math.max(2, cellWidth - padInset * 2);
          ctx.strokeRect(xPos, yPos, padW, padH);
        }
      }
    }

    const ticksPerBar = this.beatsPerBar * this.ticksPerBeat;
    if (!options.summary && !isDrumGrid && chordMode) {
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
    if (!simplified) {
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
        if (!options.summary && !isDrumGrid && row < rows) {
          const pitch = this.getPitchFromRow(row);
          isOctave = pitch % 12 === 0;
        }
        ctx.strokeStyle = options.summary
          ? 'rgba(255,255,255,0.12)'
          : isOctave
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = options.summary ? 1 : (isOctave ? 2 : 1);
        ctx.beginPath();
        ctx.moveTo(originX, yPos);
        ctx.lineTo(originX + loopTicks * cellWidth, yPos);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    this.noteBounds = [];
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      const baseColor = track.color || '#4fb7ff';
      let noteFill = baseColor;
      if (!options.uniformNotes && !isDrumGrid && !chordMode) {
        const pitchClass = note.pitch % 12;
        noteFill = isBlackKey(pitchClass)
          ? toRgba(baseColor, 0.7)
          : toRgba(baseColor, 0.95);
      }
      ctx.fillStyle = this.selection.has(note.id) ? '#ffe16a' : noteFill;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      if (!simplified && this.activeNotes.has(note.id)) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      if (!simplified && !options.summary && !isDrumGrid && chordMode) {
        const chord = this.getChordForTick(note.startTick);
        const chordTones = this.getChordTones(chord);
        if (chordTones.includes(note.pitch % 12)) {
          ctx.strokeStyle = '#ffe16a';
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        }
      }
      if (!simplified && !isDrumGrid && this.selection.has(note.id)) {
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

    if (!simplified) {
      this.bounds.loopShiftStartHandle = null;
      this.bounds.loopShiftEndHandle = null;

      if (this.dragState?.mode === 'select') {
        const { startX, startY, currentX, currentY } = this.dragState;
        const rectX = Math.min(startX, currentX);
        const rectY = Math.min(startY, currentY);
        const rectW = Math.abs(currentX - startX);
        const rectH = Math.abs(currentY - startY);
        ctx.strokeStyle = '#ffe16a';
        ctx.strokeRect(rectX, rectY, rectW, rectH);
      }
    } else {
      this.bounds.loopShiftStartHandle = null;
      this.bounds.loopShiftEndHandle = null;
    }
  }

  drawPastePreview(ctx, track) {
    if (!this.pastePreview || !this.gridBounds) return;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    const drumDuration = this.getDrumHitDurationTicks();
    ctx.save();
    ctx.globalAlpha = 0.5;
    this.pastePreview.notes.forEach((note) => {
      const startTick = baseTick + note.startTick;
      const pitchValue = drumTrack
        ? this.coercePitchForTrack(note.pitchAbsolute ?? note.pitch, track, GM_DRUM_ROWS)
        : basePitch + note.pitch;
      const durationTicks = drumTrack ? drumDuration : note.durationTicks;
      const row = this.getRowFromPitch(pitchValue);
      if (row < 0) return;
      const noteX = originX + startTick * cellWidth;
      const noteY = originY + row * cellHeight + 1;
      const noteW = Math.max(cellWidth * durationTicks, cellWidth);
      const noteH = cellHeight - 2;
      ctx.fillStyle = track.color || '#4fb7ff';
      ctx.fillRect(noteX, noteY, noteW, noteH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(noteX, noteY, noteW, noteH);
    });
    ctx.restore();

    const anchorPitch = drumTrack ? this.coercePitchForTrack(basePitch, track, GM_DRUM_ROWS) : basePitch;
    const baseRow = this.getRowFromPitch(anchorPitch);
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
    const drumGrid = isDrumTrack(track);
    const drumRows = this.getDrumRows();
    this.noteLabelBounds = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelX, originY, labelW, rows * cellHeight);
    ctx.clip();
    ctx.font = '12px Courier New';
    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      let label = drumGrid
        ? drumRows[row]?.label || 'Drum'
        : NOTE_LABELS[pitch % 12];
      if (!drumGrid && pitch % 12 === 0) {
        label = `${label}${this.getOctaveLabel(pitch)}`;
      }
      const bounds = {
        x: labelX,
        y: originY + row * cellHeight,
        w: labelW,
        h: cellHeight,
        pitch
      };
      this.noteLabelBounds.push(bounds);
      if (drumGrid) {
        const inset = Math.max(4, Math.round(cellHeight * 0.12));
        const padX = bounds.x + inset;
        const padY = bounds.y + inset / 2;
        const padW = Math.max(12, bounds.w - inset * 2);
        const padH = Math.max(12, bounds.h - inset);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(padX, padY, padW, padH);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(padX, padY, padW, padH);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(label, padX + padW / 2, padY + padH * 0.65);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(label, labelX + 8, originY + row * cellHeight + cellHeight * 0.75);
      }
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
      { action: 'selection-copy', label: 'Copy' },
      { action: 'selection-cut', label: 'Cut' },
      { action: 'selection-paste', label: 'Paste' },
      { action: 'selection-cancel', label: 'Cancel' }
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
    if (!this.noteLengthMenu.open || isDrumTrack(this.getActiveTrack())) {
      this.noteLengthMenu.open = false;
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
      { id: 'export-json', label: 'Export JSON' },
      { id: 'export-midi', label: 'Export MIDI' },
      { id: 'export-midi-zip', label: 'Export MIDI ZIP' },
      { id: 'import', label: 'Import MIDI/ZIP/JSON' },
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

  getFileMenuItems() {
    return [
      { id: 'new', label: 'New' },
      { id: 'save', label: 'Save' },
      { id: 'save-paint', label: 'Save and Paint' },
      { id: 'load', label: 'Load' },
      { id: 'export-json', label: 'Export JSON' },
      { id: 'export-midi', label: 'Export MIDI' },
      { id: 'export-midi-zip', label: 'Export MIDI ZIP' },
      { id: 'import', label: 'Import MIDI/ZIP/JSON' },
      { id: 'play-robtersession', label: 'Play in RobterSession' },
      { id: 'settings', label: 'Settings' },
      { id: 'theme', label: 'Generate Theme' },
      { id: 'sample', label: 'Load Sample Song' }
    ];
  }

  drawFilePanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    const padding = 14;
    const panelW = Math.min(320, Math.max(240, w * 0.35));
    const panelX = x + w - panelW - padding;
    const panelY = y + padding;
    const panelH = h - padding * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('File Actions', panelX + 12, panelY + 22);

    const items = this.getFileMenuItems();
    const rowH = 44;
    let cursorY = panelY + 34;
    this.fileMenuBounds = [];
    items.forEach((item) => {
      const bounds = {
        x: panelX + 12,
        y: cursorY,
        w: panelW - 24,
        h: rowH - 8,
        id: item.id
      };
      this.drawButton(ctx, bounds, item.label, false, true);
      this.fileMenuBounds.push(bounds);
      cursorY += rowH;
    });
  }

  drawFileMenu(ctx, x, y) {
    const items = this.getFileMenuItems();
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
    if (bounds && !bounds.__midiScaled125) {
      const scale = 1.25;
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      bounds.w *= scale;
      bounds.h *= scale;
      bounds.x = cx - bounds.w / 2;
      bounds.y = cy - bounds.h / 2;
      bounds.__midiScaled125 = true;
    }
    const fill = active ? 'rgba(255,225,106,0.7)' : subtle ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.6)';
    ctx.fillStyle = fill;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#0b0b0b' : '#fff';
    ctx.font = `${this.isMobileLayout() ? 17 : 15}px Courier New`;
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
