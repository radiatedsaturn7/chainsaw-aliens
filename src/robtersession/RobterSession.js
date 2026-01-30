import {
  DRUM_LANES,
  GRADE_THRESHOLDS,
  INSTRUMENTS,
  LANE_LABELS,
  MODE_LIBRARY,
  ROOT_LABELS,
  DEFAULT_SETS
} from './constants.js';
import { buildRandomName, generateSongData, mapDifficultyToTierNumber, mapTierToDifficulty } from './songGenerator.js';
import { buildSetlistSets, loadSetlistData } from './setlistLoader.js';
import { getModeToggle, getOctaveShift, getPauseTrigger, getStarPowerTrigger, matchesRequiredInput, normalizeRobterInput } from './inputNormalizer.js';
import InputEventBus from '../input/eventBus.js';
import RobterspielInput from '../input/robterspiel.js';
import HighwayRenderer from './renderers/HighwayRenderer.js';
import NoteRenderer from './renderers/NoteRenderer.js';
import ControllerStateHUD from './renderers/ControllerStateHUD.js';
import FeedbackSystem from './renderers/FeedbackSystem.js';
import SongPreviewScreen from './renderers/SongPreviewScreen.js';
import SongSelectView from '../ui/SongSelectView.js';
import InstrumentSelectView from '../ui/InstrumentSelectView.js';
import {
  describeInputDebug,
  formatPitchLabel,
  resolveInputToMusicalAction,
  resolveRequiredInputToMusicalAction
} from './inputResolver.js';
import { loadSongManifest } from '../songs/songManifest.js';
import { loadZipSong } from '../songs/songLoader.js';
import { parseMidi } from '../midi/midiParser.js';
import { formatKeyLabel, transcribeMidiStem } from '../transcribe/robterTranscriber.js';

const PROGRESS_KEY = 'robtersession-progress';
const RANDOM_SEED_KEY = 'robtersession-random-seed';
const GROOVE_THRESHOLD = 20;
const STAR_POWER_GAIN = 0.12;
const STAR_POWER_DRAIN = 0.2;
const STAR_POWER_READY = 0.5;
const SCROLL_SPEED = 240;
const HIT_GLASS_DURATION = 0.25;
const WRONG_NOTE_COOLDOWN = 0.22;
const NOTE_LANES = ['X', 'Y', 'A', 'B'];
const SCALE_SELECTOR_THRESHOLD = 0.6;
const SCALE_SELECTOR_RELEASE = 0.3;
const SCALE_PROMPT_SPEED = 0.9;
const WRONG_GHOST_DURATION = 1.2;
const MAX_NOTE_SIZE = 1.5;
const MAX_HIGHWAY_ZOOM = 2;
const HEALTH_GAIN = 0.04;
const HEALTH_LOSS = 0.12;
const MAX_MULTIPLIER = 4;
const STREAK_PER_MULTIPLIER = 10;
const REQUIRED_OCTAVE_OFFSET = 0;
const STICK_DIRECTION_LABELS = {
  1: 'N',
  2: 'NE',
  3: 'E',
  4: 'SE',
  5: 'S',
  6: 'SW',
  7: 'W',
  8: 'NW'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getStickDirectionLabel = (degree) => STICK_DIRECTION_LABELS[degree] || `${degree ?? ''}`;
const parseNoteOctave = (noteLabel) => {
  const match = String(noteLabel || '').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const octave = Number(match[3]);
  return Number.isFinite(octave) ? octave : null;
};

const radialIndexFromStick = (x, y, count) => {
  if (!count) return 0;
  const angle = Math.atan2(y, x);
  const normalized = (angle + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
  const slice = (Math.PI * 2) / count;
  return Math.round(normalized / slice) % count;
};

const HUD_SETTINGS_KEY = 'robtersession-hud-settings';
const TUNING_KEY = 'robtersession-last-tuning';

const MIDI_PROGRAMS = {
  guitar: 27,
  bass: 33,
  piano: 0,
  drums: 0
};

const INSTRUMENT_CHANNELS = {
  guitar: 0,
  bass: 1,
  piano: 2,
  drums: 9
};

const STEM_INSTRUMENT_MAP = {
  Bass: 'bass',
  Guitar: 'guitar',
  Drums: 'drums',
  Percussion: 'drums',
  Keyboard: 'piano',
  Synth: 'piano',
  Unknown: 'piano'
};

const STEM_PROGRAM_MAP = {
  bass: 33,
  guitar: 27,
  piano: 0,
  drums: 0
};

const USE_LEGACY_SETLIST = Boolean(window?.location?.search?.includes('legacySetlist'));
// Optional config flag: append ?reduction=easy|medium|hard|off to override reduction pass.
const REDUCTION_PRESET_PARAM = window?.location?.search
  ? new URLSearchParams(window.location.search).get('reduction')
  : null;

const REDUCTION_PRESETS = {
  easy: {
    id: 'easy',
    label: 'Easy',
    description: 'Quantize to eighths, remove modifiers, collapse octaves.',
    quantizeGrid: 0.5,
    stripModifiers: true,
    collapseOctave: true
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    description: 'Quantize to eighths, remove modifiers.',
    quantizeGrid: 0.5,
    stripModifiers: true,
    collapseOctave: false
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'Remove modifiers only.',
    quantizeGrid: null,
    stripModifiers: true,
    collapseOctave: false
  },
  off: {
    id: 'off',
    label: 'Off',
    description: 'No post-transcription reduction.',
    quantizeGrid: null,
    stripModifiers: false,
    collapseOctave: false
  }
};

const PERFORMANCE_DIFFICULTIES = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Whole/half/quarter/eighth, no modifiers (RB only).'
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Quarter rhythms + chord changes, LB modifiers only.'
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Eighth notes + LB/DL modifiers.'
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'Full chart, no simplification.'
  }
];

const defaultProgress = () => ({
  unlockedSets: 1,
  bestScores: {},
  bestAccuracy: {},
  bestGrades: {}
});

const defaultHudSettings = () => ({
  noteSize: MAX_NOTE_SIZE,
  highwayZoom: MAX_HIGHWAY_ZOOM,
  labelMode: 'both',
  inputHud: 'full',
  ghostNotes: true
});

const loadHudSettings = () => {
  try {
    const raw = localStorage.getItem(HUD_SETTINGS_KEY);
    if (!raw) return defaultHudSettings();
    const parsed = JSON.parse(raw);
    return {
      noteSize: MAX_NOTE_SIZE,
      highwayZoom: MAX_HIGHWAY_ZOOM,
      labelMode: parsed.labelMode ?? 'both',
      inputHud: parsed.inputHud ?? 'full',
      ghostNotes: parsed.ghostNotes ?? true
    };
  } catch (error) {
    return defaultHudSettings();
  }
};

const saveHudSettings = (settings) => {
  localStorage.setItem(HUD_SETTINGS_KEY, JSON.stringify(settings));
};

const loadTuning = () => {
  try {
    const raw = localStorage.getItem(TUNING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    return {
      rootIndex: parsed.rootIndex ?? 0,
      scaleName: parsed.scaleName ?? MODE_LIBRARY[0].name,
      octaveOffset: Number.isFinite(parsed.octaveOffset) ? parsed.octaveOffset : REQUIRED_OCTAVE_OFFSET
    };
  } catch (error) {
    return null;
  }
};

const saveTuning = (tuning) => {
  if (!tuning) return;
  localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
};

const loadProgress = () => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return {
      unlockedSets: parsed.unlockedSets ?? 1,
      bestScores: parsed.bestScores ?? {},
      bestAccuracy: parsed.bestAccuracy ?? {},
      bestGrades: parsed.bestGrades ?? {}
    };
  } catch (error) {
    return defaultProgress();
  }
};

const saveProgress = (progress) => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
};

const getGrade = (accuracy) => {
  const entry = GRADE_THRESHOLDS.find((grade) => accuracy >= grade.min);
  return entry?.grade ?? 'F';
};

const getTimingForDifficulty = (rating = 3) => {
  const clamped = clamp(rating, 1, 5);
  const ratio = (clamped - 1) / 4;
  return {
    great: 0.1 - ratio * 0.03,
    good: 0.2 - ratio * 0.06
  };
};

const getSongKey = (songName) => songName.toLowerCase().replace(/\s+/g, '-');
const normalizeReductionPreset = (value) => {
  const key = String(value || '').toLowerCase();
  if (REDUCTION_PRESETS[key]) return key;
  if (key === 'expert') return 'off';
  return null;
};

export default class RobterSession {
  constructor({ input, audio }) {
    this.input = input;
    this.audio = audio;
    this.state = USE_LEGACY_SETLIST ? 'instrument-select' : 'song-select';
    this.progress = loadProgress();
    this.selectionIndex = 0;
    this.instrument = 'guitar';
    this.instrumentSelectionIndex = 0;
    this.performanceDifficulty = 'medium';
    this.difficultySelectionIndex = 1;
    this.reductionPreset = normalizeReductionPreset(REDUCTION_PRESET_PARAM);
    this.scaleSelection = {
      scaleIndex: 0,
      rootIndex: 0,
      scaleConfirmed: false,
      rootConfirmed: false
    };
    this.requiredOctaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.octaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.scaleSelector = {
      active: false,
      type: null,
      index: 0,
      stickEngaged: false
    };
    this.songData = null;
    this.songMeta = null;
    this.songTime = 0;
    this.songLength = 0;
    this.events = [];
    this.eventIndex = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.groove = false;
    this.starPower = 0;
    this.starPowerActive = false;
    this.starPowerUsed = 0;
    this.health = 1;
    this.failed = false;
    this.health = 1;
    this.failed = false;
    this.feedbackSystem = new FeedbackSystem();
    this.mode = 'chord';
    this.selectedMode = 'chord';
    this.modeSelectionIndex = 0;
    this.chartWindow = { start: 0, end: 0 };
    this.degree = 1;
    this.pauseSelection = 0;
    this.bounds = {
      list: [],
      detailButtons: {},
      pauseButtons: [],
      resultsButtons: [],
      instrumentButtons: [],
      difficultyButtons: []
    };
    this.randomSeed = this.loadRandomSeed();
    this.lastTuning = loadTuning();
    this.difficultyRatings = new Map();
    this.debugEnabled = Boolean(window?.location?.hostname?.includes('localhost'));
    this.debugShowInputs = false;
    this.modeChangeNotice = null;
    this.scalePromptTime = 0;
    this.hitGlassTimer = 0;
    this.wrongNoteCooldown = 0;
    this.buttonPulse = { A: 0, B: 0, X: 0, Y: 0 };
    this.wrongNotes = [];
    this.trackEventIndex = {};
    this.hudSettings = loadHudSettings();
    this.playMode = 'play';
    this.practiceSpeed = 1;
    this.previewSelection = 0;
    this.feedbackSystem = new FeedbackSystem();
    this.noteRenderer = new NoteRenderer();
    this.highwayRenderer = new HighwayRenderer(this.noteRenderer);
    this.controllerHUD = new ControllerStateHUD();
    this.previewScreen = new SongPreviewScreen();
    this.songSelectView = new SongSelectView();
    this.instrumentSelectView = new InstrumentSelectView();
    this.inputBus = new InputEventBus();
    this.robterspiel = new RobterspielInput(this.inputBus);
    this.robterspielNotes = new Set();
    this.robterspiel.setEnabled(true);
    this.setlistSets = DEFAULT_SETS;
    this.setlistLoaded = false;
    this.setlistLoadError = null;
    this.setlistLoadPromise = this.loadSetlistData();
    this.songManifest = [];
    this.songManifestLoaded = false;
    this.songManifestError = null;
    this.songManifestPromise = this.loadSongManifest();
    this.songSelectionIndex = 0;
    this.songLoadStatus = '';
    this.selectedSong = null;
    this.stemList = [];
    this.stemSelectionIndex = 0;
    this.stemActionIndex = 0;
    this.stemData = new Map();
    this.activeStemNotes = null;
    this.activeStemProgram = null;
    this.activeStemKey = null;
    this.activeStemName = null;
    this.midiPlaybackIndex = 0;
    this.stemPlaybackIndices = {};
    this.useStemPlayback = false;
    this.registerInputBus();
  }

  getSongSoundConfig() {
    const schema = this.songData?.schema || {};
    const arrangementSound = schema.arrangement?.sound || {};
    return {
      programs: arrangementSound.programs || schema.instrument_programs || {},
      sections: arrangementSound.sections || schema.section_programs || {},
      drumKit: arrangementSound.drum_kit || schema.drum_kit || null
    };
  }

  normalizeProgramEntry(entry) {
    if (!entry) return {};
    if (typeof entry === 'number') {
      return { program: entry };
    }
    if (typeof entry === 'object') {
      return {
        program: entry.program,
        bankMSB: entry.bankMSB,
        bankLSB: entry.bankLSB,
        drumKit: entry.drum_kit || entry.kit
      };
    }
    return {};
  }

  resolveInstrumentSound(instrument, sectionName) {
    const { programs, sections } = this.getSongSoundConfig();
    const sectionKey = sectionName ? String(sectionName).toLowerCase() : null;
    const sectionPrograms = sectionKey ? (sections?.[sectionKey] || sections?.[sectionName]) : null;
    const entry = sectionPrograms?.[instrument] ?? programs?.[instrument];
    const normalized = this.normalizeProgramEntry(entry);
    return {
      program: Number.isInteger(normalized.program) ? normalized.program : (MIDI_PROGRAMS[instrument] ?? 0),
      bankMSB: Number.isInteger(normalized.bankMSB) ? normalized.bankMSB : 0,
      bankLSB: Number.isInteger(normalized.bankLSB) ? normalized.bankLSB : 0,
      drumKit: normalized.drumKit
    };
  }

  applySongSoundSettings() {
    const { drumKit, programs } = this.getSongSoundConfig();
    const drumEntry = this.normalizeProgramEntry(programs?.drums);
    const kit = drumKit || drumEntry.drumKit;
    if (kit) {
      this.audio.setDrumKit?.(kit);
    }
  }

  async loadSetlistData() {
    try {
      const setlist = await loadSetlistData();
      const sets = buildSetlistSets(setlist, mapDifficultyToTierNumber);
      if (sets.length) {
        this.setlistSets = sets;
      }
      this.setlistLoaded = true;
      this.setlistLoadError = null;
    } catch (error) {
      this.setlistLoadError = error;
      this.setlistLoaded = true;
    }
  }

  async loadSongManifest() {
    try {
      const songs = await loadSongManifest();
      this.songManifest = songs;
      this.songManifestLoaded = true;
      this.songManifestError = null;
    } catch (error) {
      this.songManifestError = error;
      this.songManifestLoaded = true;
    }
  }

  loadRandomSeed() {
    const raw = localStorage.getItem(RANDOM_SEED_KEY);
    const seed = raw ? Number(raw) : Date.now();
    return Number.isFinite(seed) ? seed : Date.now();
  }

  saveRandomSeed() {
    localStorage.setItem(RANDOM_SEED_KEY, String(this.randomSeed));
  }

  async loadSelectedSong(entry) {
    if (!entry) return;
    this.songLoadStatus = 'Loading song zip...';
    this.selectedSong = entry;
    this.stemData.clear();
    this.stemList = [];
    this.stemSelectionIndex = 0;
    try {
      const zipUrl = `assets/songs/${entry.filename}`;
      const { stems, meta } = await loadZipSong(zipUrl);
      console.log('[RobterSESSION] Stems found:', meta.instruments);
      const stemEntries = [];
      for (const [instrumentName, stem] of stems.entries()) {
        const midiData = parseMidi(stem.bytes);
        const isDrumStem = ['Drums', 'Percussion'].includes(instrumentName);
        const mappedInstrument = STEM_INSTRUMENT_MAP[instrumentName] || 'piano';
        const transcribed = transcribeMidiStem({
          notes: midiData.notes,
          bpm: midiData.bpm,
          keySignature: midiData.keySignature,
          isDrumStem,
          options: {
            forceNoteMode: mappedInstrument === 'bass',
            trimOverlaps: mappedInstrument === 'bass'
          }
        });
        const difficulty = transcribed.stats.difficulty;
        const keyLabel = formatKeyLabel(transcribed.key);
        console.log('[RobterSESSION] Stem', instrumentName, 'Key', keyLabel, 'BPM', midiData.bpm.toFixed(1), 'TimeSig', `${midiData.timeSignature.beats}/${midiData.timeSignature.unit}`);
        console.log('[RobterSESSION] Mapping stats', transcribed.stats.approxCounts);
        const playbackProgram = midiData.notes.find((note) => Number.isFinite(note.program))?.program
          ?? STEM_PROGRAM_MAP[mappedInstrument]
          ?? 0;
        this.stemData.set(instrumentName, {
          instrumentName,
          mappedInstrument,
          midiData,
          transcribed,
          bytes: stem.bytes,
          playbackProgram
        });
        stemEntries.push({
          name: instrumentName,
          label: instrumentName,
          difficultyLabel: `${difficulty.label} (${difficulty.rating})`,
          keyLabel
        });
      }
      this.stemList = stemEntries;
      this.songLoadStatus = stems.size ? '' : 'No MIDI stems found in zip.';
      this.state = 'stem-select';
    } catch (error) {
      console.error('[RobterSESSION] Failed to load zip song', error);
      this.songLoadStatus = 'Failed to load zip song.';
    }
  }

  prepareStemSong(stemName) {
    const stem = this.stemData.get(stemName);
    if (!stem) return false;
    const transcribed = stem.transcribed;
    const { key, timing, events, sections, stats } = transcribed;
    const modeEntry = MODE_LIBRARY.find((mode) => (
      key.mode === 'minor' ? mode.name === 'Aeolian' : mode.name === 'Ionian'
    )) || MODE_LIBRARY[0];
    this.songData = {
      name: this.selectedSong?.title || stemName,
      bpm: timing.bpm,
      tempo: timing,
      root: key.tonicPitchClass,
      mode: modeEntry,
      sections,
      events,
      schema: { arrangement: { registers: {} } }
    };
    this.songData.timing = getTimingForDifficulty(stats.difficulty.rating);
    this.songMeta = {
      name: this.songData.name,
      instrument: stemName,
      hint: `Key: ${formatKeyLabel(key)}`,
      tier: 1,
      random: false,
      setIndex: 0,
      songIndex: 0
    };
    const mappedInstrument = STEM_INSTRUMENT_MAP[stemName] || 'piano';
    this.instrument = mappedInstrument;
    this.instrumentSelectionIndex = Math.max(0, INSTRUMENTS.indexOf(mappedInstrument));
    this.applySongSoundSettings();
    this.scaleSelection = {
      scaleIndex: 0,
      rootIndex: key.tonicPitchClass,
      scaleConfirmed: true,
      rootConfirmed: true
    };
    this.requiredOctaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.octaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.selectedMode = stats.chordEvents > stats.noteEvents ? 'chord' : 'note';
    this.modeSelectionIndex = this.selectedMode === 'note' ? 0 : 1;
    this.playMode = 'play';
    this.activeStemNotes = stem.midiData.notes;
    this.activeStemProgram = stem.playbackProgram
      ?? STEM_PROGRAM_MAP[mappedInstrument]
      ?? 0;
    this.activeStemKey = key;
    this.activeStemName = stemName;
    this.midiPlaybackIndex = 0;
    this.stemPlaybackIndices = {};
    this.stemData.forEach((entry) => {
      this.stemPlaybackIndices[entry.instrumentName] = 0;
    });
    this.useStemPlayback = true;
    return true;
  }

  enter() {
    this.state = USE_LEGACY_SETLIST ? 'instrument-select' : 'song-select';
    this.songData = null;
    this.songMeta = null;
    this.robterspielNotes.forEach((id) => this.audio.stopLiveGmNote?.(id));
    this.robterspielNotes.clear();
    this.instrumentSelectionIndex = Math.max(0, INSTRUMENTS.indexOf(this.instrument));
    this.difficultySelectionIndex = Math.max(
      0,
      PERFORMANCE_DIFFICULTIES.findIndex((entry) => entry.id === this.performanceDifficulty)
    );
    this.scaleSelection = {
      scaleIndex: 0,
      rootIndex: 0,
      scaleConfirmed: false,
      rootConfirmed: false
    };
    this.requiredOctaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.octaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.songLoadStatus = '';
    this.stemSelectionIndex = 0;
    this.stemActionIndex = 0;
    this.useStemPlayback = false;
    this.activeStemName = null;
    this.stemPlaybackIndices = {};
  }

  update(dt) {
    if (this.debugEnabled && this.input.wasPressedCode('KeyH')) {
      this.debugShowInputs = !this.debugShowInputs;
    }

    if (this.state === 'song-select') {
      this.handleSongSelectInput();
      return;
    }
    if (this.state === 'stem-select') {
      this.handleStemSelectInput();
      return;
    }
    if (this.state === 'setlist') {
      this.handleSetlistInput();
      return;
    }
    if (this.state === 'instrument-select') {
      this.handleInstrumentSelectInput();
      return;
    }
    if (this.state === 'difficulty-select') {
      this.handleDifficultySelectInput();
      return;
    }
    if (this.state === 'detail') {
      this.handleDetailInput();
      return;
    }
    if (this.state === 'scale') {
      this.updateScaleState(dt);
      return;
    }
    if (this.state === 'mode-select') {
      this.handleModeSelectInput();
      return;
    }
    if (this.state === 'preview') {
      this.handlePreviewInput();
      return;
    }
    if (this.state === 'pause') {
      this.handlePauseInput();
      return;
    }
    if (this.state === 'results') {
      this.handleResultsInput();
      return;
    }
    if (this.state === 'play') {
      this.updatePlay(dt);
    }
  }

  handleSongSelectInput() {
    const maxIndex = Math.max(0, this.songManifest.length - 1);
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.songSelectionIndex = (this.songSelectionIndex - 1 + (maxIndex + 1)) % (maxIndex + 1);
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.songSelectionIndex = (this.songSelectionIndex + 1) % (maxIndex + 1);
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'exit';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      const entry = this.songManifest[this.songSelectionIndex];
      if (!entry) return;
      this.audio.ui();
      this.loadSelectedSong(entry);
    }
  }

  handleStemSelectInput() {
    const stemCount = Math.max(0, this.stemList.length);
    const actionCount = 3;
    if (!stemCount) {
      if (this.input.wasPressed('cancel')) {
        this.state = 'song-select';
        this.audio.ui();
      }
      return;
    }
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.stemSelectionIndex = (this.stemSelectionIndex - 1 + stemCount) % stemCount;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.stemSelectionIndex = (this.stemSelectionIndex + 1) % stemCount;
      this.audio.menu();
    }
    if (this.input.wasPressed('left') || this.input.wasGamepadPressed('dpadLeft')) {
      this.stemActionIndex = (this.stemActionIndex - 1 + actionCount) % actionCount;
      this.audio.menu();
    }
    if (this.input.wasPressed('right') || this.input.wasGamepadPressed('dpadRight')) {
      this.stemActionIndex = (this.stemActionIndex + 1) % actionCount;
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'song-select';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      const stem = this.stemList[this.stemSelectionIndex];
      if (!stem) return;
      const action = this.stemActionIndex;
      if (action === 2) {
        this.state = 'song-select';
        this.audio.ui();
        return;
      }
      const prepared = this.prepareStemSong(stem.name);
      if (!prepared) return;
      const playMode = action === 1 ? 'listen' : 'play';
      this.startSong({ playMode });
      this.audio.ui();
    }
  }

  handleSetlistInput() {
    const maxIndex = this.getSetlistEntries().length - 1;
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.selectionIndex = (this.selectionIndex - 1 + (maxIndex + 1)) % (maxIndex + 1);
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.selectionIndex = (this.selectionIndex + 1) % (maxIndex + 1);
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'difficulty-select';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      const entry = this.getSetlistEntries()[this.selectionIndex];
      if (!entry) return;
      if (!entry.random && entry.locked) {
        this.audio.menu();
        return;
      }
      const resolvedEntry = { ...entry };
      if (resolvedEntry.random) {
        resolvedEntry.name = this.resolveRandomSongName();
      }
      this.songMeta = resolvedEntry;
      this.state = 'detail';
      this.audio.ui();
    }
  }

  handleInstrumentSelectInput() {
    const count = INSTRUMENTS.length;
    if (this.input.wasPressed('left') || this.input.wasGamepadPressed('dpadLeft')) {
      this.instrumentSelectionIndex = (this.instrumentSelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('right') || this.input.wasGamepadPressed('dpadRight')) {
      this.instrumentSelectionIndex = (this.instrumentSelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.instrumentSelectionIndex = (this.instrumentSelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.instrumentSelectionIndex = (this.instrumentSelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'exit';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      this.instrument = INSTRUMENTS[this.instrumentSelectionIndex] || this.instrument;
      this.state = 'difficulty-select';
      this.audio.ui();
    }
  }

  handleDifficultySelectInput() {
    const count = PERFORMANCE_DIFFICULTIES.length;
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.difficultySelectionIndex = (this.difficultySelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.difficultySelectionIndex = (this.difficultySelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('left') || this.input.wasGamepadPressed('dpadLeft')) {
      this.difficultySelectionIndex = (this.difficultySelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('right') || this.input.wasGamepadPressed('dpadRight')) {
      this.difficultySelectionIndex = (this.difficultySelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'instrument-select';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      const entry = PERFORMANCE_DIFFICULTIES[this.difficultySelectionIndex];
      if (entry) {
        this.performanceDifficulty = entry.id;
      }
      this.selectionIndex = 0;
      this.state = 'setlist';
      this.audio.ui();
    }
  }

  handleDetailInput() {
    if (this.input.wasPressed('cancel')) {
      this.state = 'setlist';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      this.prepareSong();
      if (this.shouldSkipScaleSync()) {
        this.applyAutoTuning();
        this.state = 'preview';
        this.previewSelection = 0;
      } else {
        this.state = 'scale';
      }
      this.audio.ui();
    }
  }

  handleScaleInput() {
    if (this.input.wasPressed('cancel')) {
      this.state = 'detail';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact') && this.isScaleReady()) {
      this.persistTuning();
      this.selectedMode = this.instrument === 'drums' ? 'drum' : this.getPreferredPerformanceMode();
      this.modeSelectionIndex = this.selectedMode === 'note' ? 0 : 1;
      this.state = 'preview';
      this.previewSelection = 0;
      this.audio.ui();
    }
  }

  handleModeSelectInput() {
    const count = 2;
    if (this.input.wasPressed('left') || this.input.wasGamepadPressed('dpadLeft')) {
      this.modeSelectionIndex = (this.modeSelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('right') || this.input.wasGamepadPressed('dpadRight')) {
      this.modeSelectionIndex = (this.modeSelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.modeSelectionIndex = (this.modeSelectionIndex - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.modeSelectionIndex = (this.modeSelectionIndex + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'scale';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      this.selectedMode = this.modeSelectionIndex === 0 ? 'note' : 'chord';
      this.mode = this.selectedMode;
      this.robterspiel.noteMode = this.mode === 'note';
      this.state = 'preview';
      this.previewSelection = 0;
      this.audio.ui();
    }
  }

  handlePreviewInput() {
    const count = 4;
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.previewSelection = (this.previewSelection - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.previewSelection = (this.previewSelection + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'scale';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      const modes = ['play', 'practice', 'listen', 'exit'];
      const selected = modes[this.previewSelection] || 'play';
      if (selected === 'exit') {
        this.state = 'setlist';
        this.audio.ui();
        return;
      }
      this.startSong({ playMode: selected });
      this.audio.ui();
    }
  }

  handlePauseInput() {
    const count = 3;
    if (this.input.wasPressed('up') || this.input.wasGamepadPressed('dpadUp')) {
      this.pauseSelection = (this.pauseSelection - 1 + count) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('down') || this.input.wasGamepadPressed('dpadDown')) {
      this.pauseSelection = (this.pauseSelection + 1) % count;
      this.audio.menu();
    }
    if (this.input.wasPressed('interact')) {
      if (this.pauseSelection === 0) {
        this.state = 'play';
      } else if (this.pauseSelection === 1) {
        this.startSong({ playMode: this.playMode });
      } else {
        this.robterspielNotes.forEach((id) => this.audio.stopLiveGmNote?.(id));
        this.robterspielNotes.clear();
        this.state = this.useStemPlayback ? 'song-select' : 'setlist';
      }
      this.audio.ui();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'play';
      this.audio.ui();
    }
  }

  handleResultsInput() {
    if (this.input.wasPressed('interact') || this.input.wasPressed('cancel')) {
      this.state = this.useStemPlayback ? 'song-select' : 'setlist';
      this.audio.ui();
    }
  }

  updatePlay(dt) {
    this.robterspiel.update();
    this.robterspiel.setInstrument(this.instrument === 'drums' ? 'drums' : 'keyboard');
    this.robterspiel.setSelectorActive(false);
    this.syncRobterspielScale();
    const playerChannel = INSTRUMENT_CHANNELS[this.instrument] ?? 0;
    const bendSemitones = this.instrument === 'drums' ? 0 : this.robterspiel.getPitchBendSemitones();
    this.audio.setMidiPitchBend?.(this.state === 'play' ? bendSemitones : 0, playerChannel);
    if (this.robterspiel.connected) {
      this.octaveOffset = this.robterspiel.octaveOffset;
    }

    if (getPauseTrigger(this.input)) {
      this.state = 'pause';
      this.pauseSelection = 0;
      this.audio.ui();
      return;
    }
    if (this.instrument !== 'drums' && getModeToggle(this.input) && this.playMode !== 'listen') {
      this.mode = this.mode === 'note' ? 'chord' : 'note';
      this.robterspiel.noteMode = this.mode === 'note';
    }
    const octaveShift = getOctaveShift(this.input);
    if (!this.robterspiel.connected) {
      this.octaveOffset = clamp(this.octaveOffset + octaveShift, -2, 2);
      this.robterspiel.octaveOffset = this.octaveOffset;
    }

    const normalized = normalizeRobterInput({ input: this.input, prevDegree: this.degree, mode: this.mode });
    this.degree = normalized.degree;

    if (normalized.button && this.playMode !== 'listen') {
      const inputEvent = {
        ...normalized,
        buttonsPressed: this.getPressedButtons()
      };
      const register = this.songData?.schema?.arrangement?.registers?.[this.instrument] || null;
      const inputAction = resolveInputToMusicalAction({
        robterspiel: this.robterspiel,
        instrument: this.instrument,
        mode: this.mode,
        degree: this.degree,
        stickDir: this.robterspiel.leftStickStableDirection || this.degree,
        register
      }, inputEvent);
      const inputLabel = inputAction?.label || this.getInputLabel(normalized);
      const hitResult = this.tryHit(normalized, inputAction);
      if (hitResult.hit) {
        this.registerButtonPulse(normalized.button);
      }
      const inChartWindow = this.songTime >= this.chartWindow.start && this.songTime <= this.chartWindow.end;
      if (!hitResult.hit && this.playMode !== 'listen' && inChartWindow) {
        const expectedEvent = this.getClosestExpectedEvent();
        const expectedLabel = expectedEvent?.expectedAction?.label || expectedEvent?.displayLabel || '—';
        this.registerWrongNote({
          label: inputLabel,
          laneIndex: this.getLaneIndexForButton(normalized.button)
        });
        this.feedbackSystem.addMiss({
          expected: expectedLabel,
          played: inputLabel,
          inputs: describeInputDebug(inputAction),
          laneIndex: this.getLaneIndexForButton(normalized.button)
        });
      }
      if (hitResult.hit) {
        this.feedbackSystem.addHit({ judgement: hitResult.judgementLabel, laneIndex: hitResult.laneIndex });
      }
      if (!this.robterspiel.connected) {
        this.robterspiel.octaveOffset = this.octaveOffset;
        this.playFallbackNote(normalized);
      }
    }

    if (this.playMode === 'play' && getStarPowerTrigger(this.input) && this.starPower >= STAR_POWER_READY && !this.starPowerActive) {
      this.starPowerActive = true;
      this.starPowerUsed += 1;
    }

    if (this.playMode === 'play' && this.starPowerActive) {
      this.starPower = Math.max(0, this.starPower - STAR_POWER_DRAIN * dt);
      if (this.starPower <= 0) {
        this.starPowerActive = false;
      }
    }

    const speed = this.playMode === 'practice' ? this.practiceSpeed : 1;
    const prevTime = this.songTime;
    let nextTime = this.songTime + dt * speed;
    if (this.playMode === 'practice') {
      const pendingEvent = this.getNextPendingEvent();
      if (pendingEvent && nextTime >= pendingEvent.timeSec && !pendingEvent.hit && !pendingEvent.judged) {
        nextTime = pendingEvent.timeSec;
      }
    }
    this.songTime = nextTime;
    this.updateTimers(dt);
    this.advanceBandTracks(prevTime, this.songTime);
    this.advanceAutoplay(prevTime, this.songTime);
    this.advanceStemPlayback(prevTime, this.songTime);

    if (this.modeChangeNotice && this.songTime > this.modeChangeNotice.time + 3) {
      this.modeChangeNotice = null;
    }

    this.markMisses();
    if (this.failed) {
      return;
    }

    if (this.songTime >= this.songLength) {
      this.finishSong();
    }
  }

  getPressedButtons() {
    const buttons = [];
    if (this.input.wasGamepadPressed('jump') || this.input.wasPressedCode('KeyJ')) buttons.push('A');
    if (this.input.wasGamepadPressed('rev') || this.input.wasPressedCode('KeyU')) buttons.push('X');
    if (this.input.wasGamepadPressed('throw') || this.input.wasPressedCode('KeyI')) buttons.push('Y');
    if (this.input.wasGamepadPressed('dash') || this.input.wasPressedCode('KeyK')) buttons.push('B');
    return buttons;
  }

  getModifierState() {
    return {
      lb: this.input.isGamepadDown('aimUp') || this.input.isDownCode('KeyQ'),
      dleft: this.input.isGamepadDown('dpadLeft') || this.input.isDownCode('KeyE'),
      rb: this.input.isGamepadDown('aimDown') || this.input.isDownCode('KeyR')
    };
  }

  getChordTypeForButton(button, modifiers) {
    if (!button) return 'triad';
    if (modifiers.lb && modifiers.dleft) {
      if (button === 'A') return 'minor6';
      if (button === 'X') return 'dim7';
      if (button === 'Y') return 'augMaj7';
      if (button === 'B') return 'minor9b5';
    }
    if (modifiers.lb) {
      if (button === 'A') return 'sus2';
      if (button === 'X') return 'sus4';
      if (button === 'Y') return 'seventh';
      if (button === 'B') return 'add9';
    }
    if (modifiers.dleft) {
      if (button === 'A') return 'dim';
      if (button === 'X') return 'half-dim';
      if (button === 'Y') return 'aug';
      if (button === 'B') return 'altered-dom';
    }
    if (button === 'A') return 'triad';
    if (button === 'X') return 'triad-inv1';
    if (button === 'Y') return 'triad-inv2';
    if (button === 'B') return 'power';
    return 'triad';
  }

  getPreferredPerformanceMode() {
    const tally = this.songData?.events?.reduce(
      (acc, event) => {
        const mode = event?.requiredInput?.mode;
        if (mode === 'chord') acc.chord += 1;
        if (mode === 'note' || mode === 'pattern') acc.note += 1;
        return acc;
      },
      { note: 0, chord: 0 }
    );
    if (!tally) return this.selectedMode;
    if (tally.note === 0 && tally.chord === 0) return this.selectedMode;
    return tally.chord > tally.note ? 'chord' : 'note';
  }

  getPerformanceProfile() {
    switch (this.performanceDifficulty) {
      case 'easy':
        return { minBeatGap: 0.5, allowLB: false, allowDLeft: false, allowOctaveUp: true };
      case 'medium':
        return { minBeatGap: 0.5, allowLB: true, allowDLeft: false, allowOctaveUp: false };
      case 'hard':
        return { minBeatGap: 0.25, allowLB: true, allowDLeft: true, allowOctaveUp: true };
      default:
        return { minBeatGap: 0, allowLB: true, allowDLeft: true, allowOctaveUp: true };
    }
  }

  getReductionProfile() {
    const override = normalizeReductionPreset(this.reductionPreset);
    if (override) return REDUCTION_PRESETS[override];
    const fromDifficulty = normalizeReductionPreset(this.performanceDifficulty);
    if (fromDifficulty) return REDUCTION_PRESETS[fromDifficulty];
    return REDUCTION_PRESETS.off;
  }

  applyReductionPass(events = []) {
    const profile = this.getReductionProfile();
    if (!profile || profile.id === 'off') {
      return events;
    }
    const secondsPerBeat = this.songData?.tempo?.secondsPerBeat
      ?? (60 / (this.songData?.bpm || 120));
    const quantizeGrid = Number.isFinite(profile.quantizeGrid) ? profile.quantizeGrid : null;
    const quantizeBeat = (timeBeat) => (quantizeGrid ? Math.round(timeBeat / quantizeGrid) * quantizeGrid : timeBeat);
    // Post-transcription reduction rules:
    // - Quantize sixteenth-note rhythms to eighths by snapping to a 0.5-beat grid.
    // - Remove modifiers (LB/D-Left/RB) so alternate fingerings and accents disappear.
    // - Collapse octaves by clearing octave-up flags to a central octave.
    // - Preserve chord integrity by keeping chord events intact.
    return events.map((event) => {
      const reduced = { ...event };
      const snappedBeat = quantizeBeat(event.timeBeat);
      if (snappedBeat !== event.timeBeat) {
        reduced.timeBeat = snappedBeat;
        reduced.timeSec = snappedBeat * secondsPerBeat;
      }
      const required = event.requiredInput ? { ...event.requiredInput } : null;
      if (required) {
        if (profile.stripModifiers) {
          required.modifiers = { lb: false, dleft: false };
          if (required.mode === 'chord') {
            required.chordType = this.getChordTypeForButton(required.button, {
              lb: false,
              dleft: false,
              rb: false
            });
          }
        } else if (required.modifiers) {
          required.modifiers = { ...required.modifiers };
        }
        if (profile.collapseOctave) {
          required.octaveUp = false;
        }
      }
      reduced.requiredInput = required || event.requiredInput;
      return reduced;
    });
  }

  applyPerformanceDifficulty(events = []) {
    const profile = this.getPerformanceProfile();
    if (profile.minBeatGap <= 0 && profile.allowLB && profile.allowDLeft && profile.allowOctaveUp) {
      return events;
    }
    const sorted = [...events].sort((a, b) => a.timeBeat - b.timeBeat);
    const filtered = [];
    let lastBeat = -Infinity;
    sorted.forEach((event) => {
      if (event.timeBeat - lastBeat < profile.minBeatGap) return;
      const required = event.requiredInput ? { ...event.requiredInput } : null;
      if (required && required.modifiers) {
        required.modifiers = { ...required.modifiers };
        if (!profile.allowLB) required.modifiers.lb = false;
        if (!profile.allowDLeft) required.modifiers.dleft = false;
      }
      if (required && !profile.allowOctaveUp) {
        required.octaveUp = false;
      }
      if (required?.mode === 'chord') {
        required.chordType = this.getChordTypeForButton(required.button, {
          lb: required.modifiers?.lb,
          dleft: required.modifiers?.dleft,
          rb: required.octaveUp
        });
      }
      filtered.push({ ...event, requiredInput: required || event.requiredInput });
      lastBeat = event.timeBeat;
    });
    return filtered;
  }

  getClosestExpectedEvent() {
    if (!this.songData?.timing) return null;
    const window = this.songData.timing.good;
    return this.events
      .filter((event) => !event.hit && !event.judged)
      .map((event) => ({ event, diff: Math.abs(event.timeSec - this.songTime) }))
      .filter((candidate) => candidate.diff <= window)
      .sort((a, b) => a.diff - b.diff)[0]?.event || null;
  }

  getNextPendingEvent() {
    if (!this.events?.length) return null;
    return this.events
      .filter((event) => !event.hit && !event.judged)
      .sort((a, b) => a.timeSec - b.timeSec)[0] || null;
  }

  advanceAutoplay(prevTime, nextTime) {
    const shouldAutoplay = this.playMode === 'listen' || (this.playMode === 'practice' && this.hudSettings.ghostNotes);
    if (!shouldAutoplay) return;
    const events = this.events || [];
    events.forEach((event) => {
      if (event.timeSec > nextTime || event.timeSec < Math.max(0, prevTime)) return;
      if (this.playMode === 'listen') {
        event.hit = true;
        event.judged = true;
      }
      event.autoHit = 0.35;
      if (this.useStemPlayback && this.playMode === 'listen') {
        return;
      }
      const pitches = this.resolveRequiredPitches(event.requiredInput, this.instrument);
      const duration = event.sustain ? event.sustain * this.songData.tempo.secondsPerBeat : 0.5;
      pitches.forEach((pitch) => {
        if (this.instrument === 'drums') {
          this.audio.playGmNote?.({
            pitch,
            duration: 0.35,
            volume: 0.7,
            program: 0,
            channel: 9
          });
        } else {
          const sound = this.resolveInstrumentSound(this.instrument, event.section);
          const channel = INSTRUMENT_CHANNELS[this.instrument] ?? 0;
          this.audio.playGmNote?.({
            pitch,
            duration,
            volume: 0.55,
            program: sound.program,
            channel,
            bankMSB: sound.bankMSB,
            bankLSB: sound.bankLSB
          });
        }
      });
    });
  }

  getInputLabel(normalized) {
    if (!normalized?.button) return null;
    if (this.instrument === 'drums') {
      const drumMap = { A: 0, X: 1, Y: 2, B: 3 };
      return DRUM_LANES[drumMap[normalized.button]] || 'Drum';
    }
    if (normalized.mode === 'note') {
      const register = this.songData?.schema?.arrangement?.registers?.[this.instrument] || null;
      const rootDegree = normalized.degree || 1;
      const buttonMap = {
        A: { base: 1, passing: 2 },
        X: { base: 3, passing: 4 },
        Y: { base: 5, passing: 6 },
        B: { base: 8, passing: 7 }
      };
      const entry = buttonMap[normalized.button] || buttonMap.A;
      const degree = normalized.lb ? entry.passing : entry.base;
      const targetDegree = rootDegree + degree - 1;
      let pitch = this.robterspiel.getPitchForScaleStep(targetDegree - 1);
      if (normalized.dleft) {
        pitch += 1;
      }
      if (normalized.octaveUp) {
        pitch += 12;
      }
      if (register?.transpose_semitones) {
        pitch += register.transpose_semitones;
      }
      const match = String(register?.min_note || '').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
      if (match) {
        const label = `${match[1].toUpperCase()}${match[2] || ''}`;
        const octave = Number(match[3]);
        const pcMap = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
        const minMidi = (octave + 1) * 12 + (pcMap[label] ?? 0);
        while (pitch < minMidi) {
          pitch += 12;
        }
      }
      return formatPitchLabel(pitch);
    }
    return this.getChordLabel({
      degree: normalized.degree || 1,
      chordType: normalized.chordType || 'triad'
    });
  }

  getLaneIndexForButton(button) {
    if (!button) return 0;
    if (this.instrument === 'drums') {
      const drumMap = { A: 0, X: 1, Y: 2, B: 3 };
      return drumMap[button] ?? 0;
    }
    return NOTE_LANES.indexOf(button);
  }

  getModifierLabel(requiredInput) {
    if (!requiredInput) return '';
    const mods = [];
    if (requiredInput.modifiers?.lb) mods.push('LB');
    if (requiredInput.modifiers?.dleft) mods.push('D-Left');
    if (requiredInput.octaveUp) mods.push('RB');
    return mods.join('+');
  }

  getChordLabel({ degree, chordType }) {
    let variant = 'triad';
    let suspension = null;
    let inversion = 0;
    if (chordType === 'power') {
      variant = 'power';
    } else if (chordType === 'triad-inv1') {
      inversion = 1;
    } else if (chordType === 'triad-inv2') {
      inversion = 2;
    } else if (chordType === 'sus2') {
      suspension = 'sus2';
    } else if (chordType === 'sus4') {
      suspension = 'sus4';
    } else if (chordType === 'seventh') {
      variant = 'seventh';
    } else if (chordType === 'add9') {
      variant = 'add9';
    } else if (chordType === 'dim') {
      variant = 'diminished';
    } else if (chordType === 'half-dim') {
      variant = 'half-diminished';
    } else if (chordType === 'aug') {
      variant = 'augmented';
    } else if (chordType === 'altered-dom') {
      variant = 'altered-dominant';
    } else if (chordType === 'minor6') {
      variant = 'minor6';
    } else if (chordType === 'dim7') {
      variant = 'diminished7';
    } else if (chordType === 'augMaj7') {
      variant = 'augmented-major7';
    } else if (chordType === 'minor9b5') {
      variant = 'minor9b5';
    }
    let pitches = this.robterspiel.getChordPitches(degree, { variant, suspension });
    pitches = this.applyInversion(pitches, inversion);
    const rootPitch = pitches[0] ?? this.robterspiel.getPitchForScaleStep(degree - 1);
    const rootLabel = formatPitchLabel(rootPitch);
    const suffix = () => {
      if (variant === 'power') return '5';
      if (variant === 'diminished') return 'dim';
      if (variant === 'half-diminished') return 'm7♭5';
      if (variant === 'augmented') return 'aug';
      if (variant === 'diminished7') return 'dim7';
      if (variant === 'augmented-major7') return 'aug maj7';
      if (variant === 'minor9b5') return 'm9♭5';
      if (variant === 'altered-dominant') return '7alt';
      if (variant === 'seventh') return '7';
      if (variant === 'add9') return 'add9';
      if (variant === 'minor6') return 'm6';
      if (suspension) return suspension;
      return '';
    };
    const chordSuffix = suffix();
    return chordSuffix ? `${rootLabel} ${chordSuffix}` : rootLabel;
  }

  getOctaveLabel(offset) {
    const base = 3;
    const octave = base + (offset || 0);
    return `C${octave}`;
  }

  getRequiredOctaveOffset() {
    const register = this.songData?.schema?.arrangement?.registers?.[this.instrument];
    const targetNote = register?.center_note || register?.min_note;
    const targetOctave = parseNoteOctave(targetNote);
    if (!Number.isFinite(targetOctave)) return REQUIRED_OCTAVE_OFFSET;
    return clamp(targetOctave - 3, -2, 2);
  }

  getEventLabel(requiredInput) {
    if (!requiredInput) return '';
    if (requiredInput.mode === 'drum') {
      return DRUM_LANES[requiredInput.lane] || 'Drum';
    }
    if (requiredInput.mode === 'note' || requiredInput.mode === 'pattern') {
      const [pitch] = this.resolveRequiredPitches(requiredInput, this.instrument, {
        octaveOffset: this.requiredOctaveOffset
      });
      return formatPitchLabel(pitch);
    }
    return this.getChordLabel({
      degree: requiredInput.degree || 1,
      chordType: requiredInput.chordType || 'triad'
    });
  }

  getCurrentSectionLabel() {
    if (!this.songData?.sections || !this.songData?.tempo) return null;
    const beat = this.songTime / this.songData.tempo.secondsPerBeat;
    const section = this.songData.sections.find((entry) => beat >= entry.startBeat && beat < entry.endBeat);
    return section ? section.name.toUpperCase() : null;
  }

  resolveRequiredPitches(requiredInput, instrument, { octaveOffset = REQUIRED_OCTAVE_OFFSET } = {}) {
    if (!requiredInput) return [];
    const toMidi = (note) => {
      const match = String(note || '').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
      if (!match) return null;
      const label = `${match[1].toUpperCase()}${match[2] || ''}`;
      const octave = Number(match[3]);
      const pcMap = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
      return (octave + 1) * 12 + (pcMap[label] ?? 0);
    };
    const applyRegister = (pitches) => {
      const transpose = requiredInput.transpose ?? 0;
      const minMidi = requiredInput.minNote ? toMidi(requiredInput.minNote) : null;
      return pitches.map((pitch) => {
        let adjusted = pitch + transpose;
        if (Number.isFinite(minMidi)) {
          while (adjusted < minMidi) {
            adjusted += 12;
          }
        }
        return adjusted;
      });
    };
    if (instrument === 'drums') {
      const drumMap = [36, 38, 42, 49];
      return [drumMap[requiredInput.lane] ?? 38];
    }
    if (requiredInput.mode === 'pattern') {
      const chordQuality = requiredInput.chordQuality || 'major';
      const chordType = requiredInput.chordType || 'triad';
      const seventhQuality = requiredInput.seventhQuality || null;
      const degree = requiredInput.degree || 1;
      const basePitch = this.robterspiel.getPitchForScaleStepWithOffset(degree - 1, octaveOffset);
      const getInterval = (patternDegree) => {
        if (patternDegree === 1) return 0;
        if (patternDegree === 2) return 2;
        if (patternDegree === 3) {
          if (chordType === 'sus2') return 2;
          if (chordType === 'sus4') return 5;
          return chordQuality === 'minor' || chordQuality === 'dim' ? 3 : 4;
        }
        if (patternDegree === 4) return 5;
        if (patternDegree === 5) return 7;
        if (patternDegree === 6) return 9;
        if (patternDegree === 7) {
          if (seventhQuality === 'maj7') return 11;
          if (seventhQuality === 'm7' || seventhQuality === '7') return 10;
          return chordQuality === 'minor' ? 10 : 11;
        }
        if (patternDegree === 8) return 12;
        if (patternDegree === 9) return 14;
        return (patternDegree - 1) * 2;
      };
      const interval = getInterval(requiredInput.patternDegree || 1);
      return applyRegister([basePitch + interval]);
    }
    if (requiredInput.mode === 'note') {
      const buttonMap = {
        A: { base: 1, passing: 2 },
        X: { base: 3, passing: 4 },
        Y: { base: 5, passing: 6 },
        B: { base: 8, passing: 7 }
      };
      const entry = buttonMap[requiredInput.button] || buttonMap.A;
      const degree = requiredInput.modifiers?.lb ? entry.passing : entry.base;
      const targetDegree = (requiredInput.degree || 1) + degree - 1;
      let pitch = this.robterspiel.getPitchForScaleStepWithOffset(targetDegree - 1, octaveOffset);
      if (requiredInput.modifiers?.dleft) {
        pitch += 1;
      }
      if (requiredInput.octaveUp) {
        pitch += 12;
      }
      return applyRegister([pitch]);
    }
    const chordType = requiredInput.chordType || 'triad';
    let variant = 'triad';
    let suspension = null;
    let inversion = 0;
    if (chordType === 'power') {
      variant = 'power';
    } else if (chordType === 'triad-inv1') {
      inversion = 1;
    } else if (chordType === 'triad-inv2') {
      inversion = 2;
    } else if (chordType === 'sus2') {
      suspension = 'sus2';
    } else if (chordType === 'sus4') {
      suspension = 'sus4';
    } else if (chordType === 'seventh') {
      variant = 'seventh';
    } else if (chordType === 'add9') {
      variant = 'add9';
    } else if (chordType === 'dim') {
      variant = 'diminished';
    } else if (chordType === 'half-dim') {
      variant = 'half-diminished';
    } else if (chordType === 'aug') {
      variant = 'augmented';
    } else if (chordType === 'altered-dom') {
      variant = 'altered-dominant';
    } else if (chordType === 'minor6') {
      variant = 'minor6';
    } else if (chordType === 'dim7') {
      variant = 'diminished7';
    } else if (chordType === 'augMaj7') {
      variant = 'augmented-major7';
    } else if (chordType === 'minor9b5') {
      variant = 'minor9b5';
    }
    let pitches = this.robterspiel.getChordPitchesWithOffset(requiredInput.degree || 1, { variant, suspension }, octaveOffset);
    pitches = this.applyInversion(pitches, inversion);
    return applyRegister(pitches);
  }

  advanceBandTracks(prevTime, nextTime) {
    if (!this.songData?.tracks || nextTime <= 0) return;
    INSTRUMENTS.forEach((track) => {
      if (track === this.instrument) return;
      const events = this.songData.tracks[track] || [];
      let index = this.trackEventIndex[track] ?? 0;
      while (index < events.length) {
        const event = events[index];
        if (event.timeSec > nextTime) break;
        if (event.timeSec >= Math.max(0, prevTime)) {
          const pitches = this.resolveRequiredPitches(event.requiredInput, track);
          const duration = event.sustain ? event.sustain * this.songData.tempo.secondsPerBeat : 0.5;
          pitches.forEach((pitch) => {
            if (track === 'drums') {
              this.audio.playGmNote?.({
                pitch,
                duration: 0.35,
                volume: 0.6,
                program: 0,
                channel: 9
              });
            } else {
              const sound = this.resolveInstrumentSound(track, event.section);
              const channel = INSTRUMENT_CHANNELS[track] ?? 0;
              this.audio.playGmNote?.({
                pitch,
                duration,
                volume: 0.45,
                program: sound.program,
                channel,
                bankMSB: sound.bankMSB,
                bankLSB: sound.bankLSB
              });
            }
          });
        }
        index += 1;
      }
      this.trackEventIndex[track] = index;
    });
  }

  advanceStemPlayback(prevTime, nextTime) {
    if (!this.useStemPlayback || nextTime <= 0) return;
    const volume = this.playMode === 'listen' ? 0.7 : this.playMode === 'play' ? 0.35 : 0.45;
    this.stemData.forEach((stem) => {
      const notes = stem.midiData?.notes || [];
      let index = this.stemPlaybackIndices[stem.instrumentName] ?? 0;
      while (index < notes.length) {
        const note = notes[index];
        if (note.tStartSec > nextTime) break;
        if (note.tStartSec >= Math.max(0, prevTime)) {
          const duration = Math.max(0.05, note.tEndSec - note.tStartSec);
          const isActiveStem = stem.instrumentName === this.activeStemName;
          const mappedInstrument = stem.mappedInstrument || STEM_INSTRUMENT_MAP[stem.instrumentName] || 'piano';
          const channel = mappedInstrument === 'drums' ? 9 : (INSTRUMENT_CHANNELS[mappedInstrument] ?? 0);
          const program = stem.playbackProgram ?? STEM_PROGRAM_MAP[mappedInstrument] ?? 0;
          const mixVolume = isActiveStem ? volume : volume * 0.6;
          this.audio.playGmNote?.({
            pitch: note.midi,
            duration,
            volume: Math.min(1, Math.max(0.1, (note.vel ?? 0.8) * mixVolume)),
            program,
            channel
          });
        }
        index += 1;
      }
      this.stemPlaybackIndices[stem.instrumentName] = index;
    });
  }

  prepareSong() {
    const tier = this.songMeta.tier;
    const allowModeChange = tier >= 7;
    const songName = this.songMeta.name;
    this.songData = generateSongData({
      name: songName,
      tier,
      instrument: this.instrument,
      allowModeChange,
      difficulty: this.songMeta.difficulty,
      schema: this.songMeta.schema
    });
    this.applySongSoundSettings();
    this.scaleSelection = {
      scaleIndex: 0,
      rootIndex: 0,
      scaleConfirmed: false,
      rootConfirmed: false
    };
    this.requiredOctaveOffset = this.getRequiredOctaveOffset();
    this.scaleSelector = {
      active: false,
      type: null,
      index: 0,
      stickEngaged: false
    };
    if (this.instrument === 'drums') {
      this.selectedMode = 'drum';
      this.modeSelectionIndex = 0;
    } else {
      this.selectedMode = this.selectedMode === 'note' ? 'note' : 'chord';
      this.modeSelectionIndex = this.selectedMode === 'note' ? 0 : 1;
    }
    this.scalePromptTime = 0;
    this.useStemPlayback = false;
    this.activeStemNotes = null;
    this.activeStemName = null;
    this.midiPlaybackIndex = 0;
    this.stemPlaybackIndices = {};
  }

  startSong({ playMode = 'play' } = {}) {
    this.state = 'play';
    this.playMode = playMode;
    this.songTime = -2;
    this.streak = 0;
    this.bestStreak = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.groove = false;
    this.starPower = 0;
    this.starPowerActive = false;
    this.starPowerUsed = 0;
    if (this.useStemPlayback) {
      this.midiPlaybackIndex = 0;
      this.stemPlaybackIndices = {};
      this.stemData.forEach((entry) => {
        this.stemPlaybackIndices[entry.instrumentName] = 0;
      });
    }
    this.mode = this.instrument === 'drums' ? 'drum' : this.selectedMode;
    if (this.instrument !== 'drums') {
      this.robterspiel.noteMode = this.mode === 'note';
    }
    this.syncRobterspielScale();
    this.robterspiel.octaveOffset = this.octaveOffset;
    this.audio.setMidiPitchBend?.(0);
    this.audio.setMidiPitchBend?.(0, INSTRUMENT_CHANNELS[this.instrument] ?? 0);
    const reducedEvents = this.applyReductionPass(this.songData.events);
    const performanceEvents = this.useStemPlayback
      ? reducedEvents
      : this.applyPerformanceDifficulty(reducedEvents);
    this.events = performanceEvents.map((event) => ({
      ...event,
      hit: false,
      judged: false,
      displayLabel: this.getEventLabel(event.requiredInput)
    }));
    let lastDegree = null;
    this.events.forEach((event) => {
      const expectedAction = resolveRequiredInputToMusicalAction(
        { robterspiel: this.robterspiel, instrument: this.instrument, octaveOffset: this.requiredOctaveOffset },
        event.requiredInput
      );
      event.expectedAction = expectedAction;
      event.noteKind = event.requiredInput?.mode === 'note' || event.requiredInput?.mode === 'pattern'
        ? 'note'
        : event.requiredInput?.mode === 'drum'
          ? 'drum'
          : 'chord';
      if (this.instrument === 'drums') {
        event.primaryLabel = '';
        event.secondaryLabel = '';
        return;
      }
      const modifierLabel = this.getModifierLabel(event.requiredInput);
      const isNoteEvent = event.requiredInput?.mode === 'note' || event.requiredInput?.mode === 'pattern';
      event.primaryLabel = '';
      event.secondaryLabel = '';
      event.sideLabel = expectedAction?.label || event.displayLabel || '';
      if (isNoteEvent) {
        event.stickLabel = event.requiredInput?.degree !== lastDegree
          ? getStickDirectionLabel(event.requiredInput?.degree)
          : null;
        event.modifierState = {
          lb: Boolean(event.requiredInput?.modifiers?.lb),
          dleft: Boolean(event.requiredInput?.modifiers?.dleft),
          rb: Boolean(event.requiredInput?.octaveUp)
        };
      } else {
        event.stickLabel = getStickDirectionLabel(event.requiredInput?.degree);
      }
      lastDegree = event.requiredInput?.degree ?? lastDegree;
    });
    this.trackEventIndex = INSTRUMENTS.reduce((acc, instrument) => {
      acc[instrument] = 0;
      return acc;
    }, {});
    const firstEvent = this.events[0];
    const lastEvent = this.events[this.events.length - 1];
    const lastEventEnd = lastEvent?.timeSec ?? 0;
    const sustainSeconds = lastEvent?.sustain ? lastEvent.sustain * this.songData.tempo.secondsPerBeat : 0;
    this.chartWindow = {
      start: firstEvent?.timeSec ?? 0,
      end: lastEventEnd + sustainSeconds
    };
    this.songLength = (lastEvent?.timeSec ?? 0) + 4;
    if (this.songData.modeChange) {
      this.modeChangeNotice = {
        time: this.songData.modeChange.beat * this.songData.tempo.secondsPerBeat,
        root: this.songData.modeChange.root,
        mode: this.songData.modeChange.mode
      };
    }
  }

  finishSong() {
    const total = this.events.length;
    const accuracy = total ? this.hits / total : 0;
    const grade = getGrade(accuracy);
    this.robterspielNotes.forEach((id) => this.audio.stopLiveGmNote?.(id));
    this.robterspielNotes.clear();
    const key = getSongKey(this.songMeta.name);
    if (!this.failed) {
      const progress = this.progress;
      progress.bestScores[key] = Math.max(progress.bestScores[key] || 0, this.score);
      const previousAccuracy = progress.bestAccuracy[key] || 0;
      progress.bestAccuracy[key] = Math.max(previousAccuracy, accuracy);
      if (accuracy >= previousAccuracy) {
        progress.bestGrades[key] = grade;
      }
      if (!this.useStemPlayback && !this.songMeta.random && this.songMeta.setIndex + 1 >= progress.unlockedSets) {
        progress.unlockedSets = Math.min(this.setlistSets.length, this.songMeta.setIndex + 2);
      }
      saveProgress(progress);
    }
    this.state = 'results';
  }

  failSong() {
    if (this.failed) return;
    this.failed = true;
    this.songTime = this.songLength;
    this.finishSong();
  }

  markMisses() {
    const missWindow = this.songData.timing.good;
    this.events.forEach((event) => {
      if (event.hit || event.judged) return;
      if (this.songTime - event.timeSec > missWindow) {
        event.judged = true;
        this.registerMiss(event);
      }
    });
  }

  registerMiss(event) {
    const noPenalty = this.playMode !== 'play';
    if (!noPenalty) {
      this.misses += 1;
      this.streak = 0;
      this.groove = false;
      this.starPowerActive = false;
      this.health = clamp(this.health - HEALTH_LOSS, 0, 1);
      if (this.health <= 0) {
        this.failSong();
      }
    }
    const expectedLabel = event?.expectedAction?.label || event?.displayLabel || '—';
    this.feedbackSystem.addMiss({
      expected: expectedLabel,
      played: null,
      inputs: '',
      laneIndex: event?.lane ?? 0
    });
  }

  actionsMatch(playedAction, expectedAction) {
    if (!playedAction || !expectedAction) return false;
    if (playedAction.kind !== expectedAction.kind) return false;
    const playedPitches = (playedAction.pitches || []).map((pitch) => Math.round(pitch));
    const expectedPitches = (expectedAction.pitches || []).map((pitch) => Math.round(pitch));
    if (playedPitches.length !== expectedPitches.length || !playedPitches.length) return false;
    playedPitches.sort((a, b) => a - b);
    expectedPitches.sort((a, b) => a - b);
    return playedPitches.every((pitch, index) => pitch === expectedPitches[index]);
  }

  tryHit(normalized, inputAction = null) {
    const timing = this.songData.timing;
    const window = timing.good;
    const match = this.events
      .filter((event) => !event.hit && !event.judged)
      .map((event) => ({
        event,
        diff: Math.abs(event.timeSec - this.songTime)
      }))
      .filter((candidate) => candidate.diff <= window)
      .sort((a, b) => a.diff - b.diff)
      .find((candidate) => matchesRequiredInput({
        required: candidate.event.requiredInput,
        normalized,
        mode: this.mode
      }) || this.actionsMatch(inputAction, candidate.event.expectedAction))?.event;
    if (!match) return { hit: false };
    const diff = Math.abs(match.timeSec - this.songTime);
    const judgement = diff <= timing.great ? 'great' : 'good';
    match.hit = true;
    match.judged = true;
    match.judgement = judgement;
    let judgementLabel = judgement === 'great' ? 'Perfect' : 'Good';
    if (this.playMode === 'play') {
      this.hits += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (match.starPhrase) {
        this.starPower = clamp(this.starPower + STAR_POWER_GAIN, 0, 1);
      }
      if (this.streak >= GROOVE_THRESHOLD) {
        this.groove = true;
      }
      const baseScore = judgement === 'great' ? 120 : 70;
      const streakMultiplier = this.getStreakMultiplier();
      const starMultiplier = this.starPowerActive ? 2 : 1;
      this.score += Math.round(baseScore * streakMultiplier * starMultiplier);
      this.hitGlassTimer = HIT_GLASS_DURATION;
      this.health = clamp(this.health + HEALTH_GAIN, 0, 1);
    } else {
      judgementLabel = 'Practice';
    }
    return {
      hit: true,
      event: match,
      judgementLabel,
      laneIndex: match.lane
    };
  }

  registerButtonPulse(button) {
    if (!button) return;
    this.buttonPulse[button] = 0.22;
  }

  registerWrongNote(noteData) {
    if (this.wrongNoteCooldown > 0) return;
    this.wrongNoteCooldown = WRONG_NOTE_COOLDOWN;
    this.audio.noise?.(0.08, 0.14);
    if (noteData?.label) {
      this.wrongNotes = [{
        label: noteData.label,
        laneIndex: Number.isFinite(noteData.laneIndex) ? noteData.laneIndex : 0,
        life: WRONG_GHOST_DURATION,
        spin: 0,
        spinSpeed: (Math.random() * 2 - 1) * 3,
        x: 0,
        y: 0,
        vx: (Math.random() * 2 - 1) * 40,
        vy: -60 - Math.random() * 40
      }];
    }
  }

  updateTimers(dt) {
    Object.keys(this.buttonPulse).forEach((key) => {
      this.buttonPulse[key] = Math.max(0, this.buttonPulse[key] - dt);
    });
    this.hitGlassTimer = Math.max(0, this.hitGlassTimer - dt);
    this.wrongNoteCooldown = Math.max(0, this.wrongNoteCooldown - dt);
    this.wrongNotes = this.wrongNotes.filter((note) => note.life > 0);
    this.wrongNotes.forEach((note) => {
      note.life = Math.max(0, note.life - dt);
      note.spin += note.spinSpeed * dt;
      note.x += note.vx * dt;
      note.y += note.vy * dt;
    });
    this.feedbackSystem.update(dt);
    this.events.forEach((event) => {
      if (event.autoHit) {
        event.autoHit = Math.max(0, event.autoHit - dt);
      }
    });
  }

  registerInputBus() {
    this.inputBus.on('noteon', (event) => {
      if (this.state !== 'play') return;
      const pitch = event.pitch ?? event.previewPitch;
      if (!Number.isFinite(pitch)) return;
      const instrument = this.instrument;
      const velocity = clamp((event.velocity ?? 96) / 127, 0.1, 1);
      const sectionName = this.getCurrentSectionLabel()?.toLowerCase() || null;
      if (instrument === 'drums') {
        this.audio.startLiveGmNote?.({
          id: event.id,
          pitch,
          duration: 0.8,
          volume: velocity,
          program: 0,
          channel: 9
        });
      } else {
        const sound = this.resolveInstrumentSound(instrument, sectionName);
        const channel = INSTRUMENT_CHANNELS[instrument] ?? 0;
        this.audio.startLiveGmNote?.({
          id: event.id,
          pitch,
          duration: 1.4,
          volume: velocity,
          program: sound.program,
          channel,
          bankMSB: sound.bankMSB,
          bankLSB: sound.bankLSB
        });
      }
      this.robterspielNotes.add(event.id);
    });
    this.inputBus.on('noteoff', (event) => {
      if (!event?.id) return;
      this.audio.stopLiveGmNote?.(event.id);
      this.robterspielNotes.delete(event.id);
    });
    this.inputBus.on('pitchbend', (event) => {
      if (this.state !== 'play') return;
      const bendSemitones = ((event.value - 8192) / 8192) * 2;
      const playerChannel = INSTRUMENT_CHANNELS[this.instrument] ?? 0;
      this.audio.setMidiPitchBend?.(bendSemitones, playerChannel);
    });
  }

  applyInversion(pitches, inversion) {
    if (!inversion) return pitches;
    const sorted = [...pitches].sort((a, b) => a - b);
    for (let i = 0; i < inversion; i += 1) {
      const shifted = sorted.shift();
      sorted.push((shifted ?? 0) + 12);
      sorted.sort((a, b) => a - b);
    }
    return sorted;
  }

  playFallbackNote(normalized) {
    if (!normalized?.button) return;
    const instrument = this.instrument;
    const velocity = 0.7;
    const sectionName = this.getCurrentSectionLabel()?.toLowerCase() || null;
    if (instrument === 'drums') {
      const drumMap = { A: 38, X: 45, Y: 48, B: 50 };
      const pitch = drumMap[normalized.button] ?? 38;
      this.audio.playGmNote?.({
        pitch,
        duration: 0.35,
        volume: velocity,
        program: 0,
        channel: 9
      });
      return;
    }
    const rootDegree = normalized.degree || 1;
    if (normalized.mode === 'note') {
      const buttonMap = {
        A: { base: 1, passing: 2 },
        X: { base: 3, passing: 4 },
        Y: { base: 5, passing: 6 },
        B: { base: 8, passing: 7 }
      };
      const entry = buttonMap[normalized.button] || buttonMap.A;
      const degree = normalized.lb ? entry.passing : entry.base;
      const targetDegree = rootDegree + degree - 1;
      let pitch = this.robterspiel.getPitchForScaleStep(targetDegree - 1);
      if (normalized.dleft) {
        pitch += 1;
      }
      if (normalized.octaveUp) {
        pitch += 12;
      }
      const sound = this.resolveInstrumentSound(instrument, sectionName);
      this.audio.playGmNote?.({
        pitch,
        duration: 0.45,
        volume: velocity,
        program: sound.program,
        channel: INSTRUMENT_CHANNELS[instrument] ?? 0,
        bankMSB: sound.bankMSB,
        bankLSB: sound.bankLSB
      });
      return;
    }

    const chordType = normalized.chordType || 'triad';
    let variant = 'triad';
    let suspension = null;
    let inversion = 0;
    if (chordType === 'power') {
      variant = 'power';
    } else if (chordType === 'triad-inv1') {
      inversion = 1;
    } else if (chordType === 'triad-inv2') {
      inversion = 2;
    } else if (chordType === 'sus2') {
      suspension = 'sus2';
    } else if (chordType === 'sus4') {
      suspension = 'sus4';
    } else if (chordType === 'seventh') {
      variant = 'seventh';
    } else if (chordType === 'add9') {
      variant = 'add9';
    } else if (chordType === 'dim') {
      variant = 'diminished';
    } else if (chordType === 'half-dim') {
      variant = 'half-diminished';
    } else if (chordType === 'aug') {
      variant = 'augmented';
    } else if (chordType === 'altered-dom') {
      variant = 'altered-dominant';
    } else if (chordType === 'minor6') {
      variant = 'minor6';
    } else if (chordType === 'dim7') {
      variant = 'diminished7';
    } else if (chordType === 'augMaj7') {
      variant = 'augmented-major7';
    } else if (chordType === 'minor9b5') {
      variant = 'minor9b5';
    }
    let pitches = this.robterspiel.getChordPitches(rootDegree, { variant, suspension });
    pitches = this.applyInversion(pitches, inversion);
    const sound = this.resolveInstrumentSound(instrument, sectionName);
    pitches.forEach((pitch) => {
      this.audio.playGmNote?.({
        pitch,
        duration: 0.6,
        volume: velocity,
        program: sound.program,
        channel: INSTRUMENT_CHANNELS[instrument] ?? 0,
        bankMSB: sound.bankMSB,
        bankLSB: sound.bankLSB
      });
    });
  }

  syncRobterspielScale() {
    const scale = MODE_LIBRARY[this.scaleSelection.scaleIndex] || MODE_LIBRARY[0];
    this.robterspiel.setScale({
      key: this.scaleSelection.rootIndex,
      steps: scale.steps
    });
  }

  getTargetTuning() {
    const scaleIndex = MODE_LIBRARY.findIndex((mode) => mode.name === this.songData?.mode?.name);
    return {
      rootIndex: this.songData?.root ?? 0,
      scaleIndex: scaleIndex >= 0 ? scaleIndex : 0,
      octaveOffset: this.requiredOctaveOffset
    };
  }

  shouldSkipScaleSync() {
    if (this.instrument === 'drums') return true;
    if (!this.lastTuning || !this.songData) return false;
    const target = this.getTargetTuning();
    const targetScale = MODE_LIBRARY[target.scaleIndex]?.name || MODE_LIBRARY[0].name;
    return this.lastTuning.rootIndex === target.rootIndex
      && this.lastTuning.scaleName === targetScale
      && this.lastTuning.octaveOffset === target.octaveOffset;
  }

  applyAutoTuning() {
    const target = this.getTargetTuning();
    this.scaleSelection = {
      scaleIndex: target.scaleIndex,
      rootIndex: target.rootIndex,
      scaleConfirmed: true,
      rootConfirmed: true
    };
    this.octaveOffset = target.octaveOffset;
    this.robterspiel.octaveOffset = target.octaveOffset;
    this.syncRobterspielScale();
  }

  persistTuning() {
    if (!this.songData) return;
    const target = this.getTargetTuning();
    const scaleName = MODE_LIBRARY[target.scaleIndex]?.name || MODE_LIBRARY[0].name;
    this.lastTuning = {
      rootIndex: target.rootIndex,
      scaleName,
      octaveOffset: target.octaveOffset
    };
    saveTuning(this.lastTuning);
  }

  isScaleReady() {
    if (this.instrument === 'drums') return true;
    const scale = MODE_LIBRARY[this.scaleSelection.scaleIndex] || MODE_LIBRARY[0];
    const correctRoot = this.scaleSelection.rootIndex === this.songData.root;
    const correctScale = scale.name === this.songData.mode.name;
    const correctOctave = this.octaveOffset === this.requiredOctaveOffset;
    return this.scaleSelection.rootConfirmed && this.scaleSelection.scaleConfirmed && correctRoot && correctScale && correctOctave;
  }

  updateScaleState(dt) {
    this.scalePromptTime += dt * SCALE_PROMPT_SPEED;
    this.robterspiel.update();
    this.robterspiel.setInstrument(this.instrument === 'drums' ? 'drums' : 'keyboard');
    this.robterspiel.setSelectorActive(true);
    this.syncRobterspielScale();
    if (this.robterspiel.connected) {
      this.octaveOffset = this.robterspiel.octaveOffset;
    } else {
      this.octaveOffset = clamp(this.octaveOffset + getOctaveShift(this.input), -2, 2);
      this.robterspiel.octaveOffset = this.octaveOffset;
    }
    this.handleScaleInput();
    if (this.instrument === 'drums') return;
    if (this.robterspiel.wasButtonPressed(10)) {
      this.toggleScaleSelector('scale');
    }
    if (this.robterspiel.wasButtonPressed(11)) {
      this.toggleScaleSelector('root');
    }
    this.updateScaleSelector();
  }

  toggleScaleSelector(type) {
    if (this.scaleSelector.active && this.scaleSelector.type === type) {
      this.scaleSelector.active = false;
      this.scaleSelector.type = null;
      this.scaleSelector.stickEngaged = false;
      return;
    }
    this.scaleSelector.active = true;
    this.scaleSelector.type = type;
    this.scaleSelector.stickEngaged = false;
    if (type === 'root') {
      this.scaleSelector.index = this.scaleSelection.rootIndex;
    } else {
      this.scaleSelector.index = this.scaleSelection.scaleIndex;
    }
  }

  updateScaleSelector() {
    if (!this.scaleSelector.active || !this.scaleSelector.type) return;
    if (this.scaleSelector.type === 'scale') {
      const { x, y } = this.robterspiel.getLeftStick();
      if (Math.hypot(x, y) < SCALE_SELECTOR_THRESHOLD) return;
      const nextIndex = radialIndexFromStick(x, y, MODE_LIBRARY.length);
      if (nextIndex !== this.scaleSelection.scaleIndex) {
        this.scaleSelection.scaleIndex = nextIndex;
      }
      this.scaleSelection.scaleConfirmed = true;
      this.scaleSelector.active = false;
      this.scaleSelector.type = null;
      return;
    }

    const { x, y } = this.robterspiel.getRightStick();
    const magnitude = Math.hypot(x, y);
    if (magnitude >= SCALE_SELECTOR_THRESHOLD) {
      this.scaleSelector.stickEngaged = true;
      const nextIndex = radialIndexFromStick(x, y, ROOT_LABELS.length);
      if (nextIndex !== this.scaleSelection.rootIndex) {
        this.scaleSelection.rootIndex = nextIndex;
      }
      this.scaleSelection.rootConfirmed = true;
      return;
    }
    if (magnitude <= SCALE_SELECTOR_RELEASE && this.scaleSelector.stickEngaged) {
      this.scaleSelector.active = false;
      this.scaleSelector.type = null;
      this.scaleSelector.stickEngaged = false;
    }
  }

  getLaneColors() {
    return ['#46b3ff', '#ffd84a', '#3ad96f', '#ff5b5b'];
  }

  getHighwayTint() {
    if (this.starPowerActive) {
      return { tintColor: 'rgba(255,255,255,0.18)', glowColor: 'rgba(255,255,255,0.55)' };
    }
    if (this.mode === 'note') {
      return { tintColor: 'rgba(70,140,255,0.16)', glowColor: 'rgba(80,160,255,0.45)' };
    }
    return { tintColor: 'rgba(255,170,80,0.18)', glowColor: 'rgba(255,170,80,0.5)' };
  }

  getStreakMultiplier() {
    return clamp(1 + Math.floor(this.streak / STREAK_PER_MULTIPLIER), 1, MAX_MULTIPLIER);
  }

  drawHighwayBackground(ctx, width, height, options) {
    const {
      startX,
      totalWidth,
      laneTop,
      laneBottom,
      hitLineY,
      laneColors,
      laneWidth,
      laneGap
    } = options;
    const horizonY = 80;
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0f1c2f');
    sky.addColorStop(0.45, '#071320');
    sky.addColorStop(1, '#010307');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, horizonY, 10, width / 2, horizonY, 280);
    glow.addColorStop(0, 'rgba(90,180,255,0.35)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    ctx.fillRect(startX - 60, laneTop - 20, totalWidth + 120, laneBottom - laneTop + 60);

    ctx.strokeStyle = 'rgba(120,190,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 60, laneTop - 20, totalWidth + 120, laneBottom - laneTop + 60);

    const time = this.songTime;
    const streakCount = 18;
    for (let i = 0; i < streakCount; i += 1) {
      const t = (i / streakCount + (time * 0.2)) % 1;
      const y = laneTop + t * (laneBottom - laneTop);
      const alpha = 0.08 + (1 - t) * 0.2;
      ctx.strokeStyle = `rgba(80,160,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(startX - 40, y);
      ctx.lineTo(startX + totalWidth + 40, y);
      ctx.stroke();
    }

    laneColors.forEach((color, index) => {
      const laneX = startX + index * (laneWidth + laneGap) + laneWidth / 2;
      ctx.strokeStyle = `${color}33`;
      ctx.beginPath();
      ctx.moveTo(laneX, laneTop);
      ctx.lineTo(width / 2 + (laneX - width / 2) * 0.75, horizonY);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(140,210,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 60, laneBottom);
    ctx.lineTo(startX - 120, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX + totalWidth + 60, laneBottom);
    ctx.lineTo(startX + totalWidth + 120, height);
    ctx.stroke();

    const hitGlow = ctx.createLinearGradient(0, hitLineY - 30, 0, hitLineY + 30);
    hitGlow.addColorStop(0, 'rgba(70,160,255,0)');
    hitGlow.addColorStop(0.5, 'rgba(70,160,255,0.3)');
    hitGlow.addColorStop(1, 'rgba(70,160,255,0)');
    ctx.fillStyle = hitGlow;
    ctx.fillRect(startX - 80, hitLineY - 30, totalWidth + 160, 60);

    ctx.restore();
  }

  drawWrongNoteGhosts(ctx, width, height, options) {
    const { startX, laneWidth, laneGap, hitLineY } = options;
    if (!this.wrongNotes.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '14px Courier New';
    this.wrongNotes.forEach((note) => {
      const laneIndex = note.laneIndex ?? 0;
      const laneCenter = startX + laneIndex * (laneWidth + laneGap) + laneWidth / 2;
      const lifeRatio = note.life / WRONG_GHOST_DURATION;
      const alpha = Math.max(0, lifeRatio);
      const x = laneCenter + note.x;
      const y = hitLineY - 20 + note.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(note.spin);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255,80,80,0.85)';
      ctx.fillRect(-28, -12, 56, 24);
      ctx.strokeStyle = 'rgba(255,160,160,0.9)';
      ctx.strokeRect(-28, -12, 56, 24);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(note.label, 0, 6);
      ctx.restore();
    });
    ctx.restore();
  }

  drawStickIndicators(ctx, width, height, options = {}) {
    const leftStick = this.robterspiel.getLeftStick();
    const rightStick = this.robterspiel.getRightStick();
    const leftMagnitude = Math.hypot(leftStick.x, leftStick.y);
    const rightMagnitude = Math.hypot(rightStick.x, rightStick.y);
    const leftDegree = this.robterspiel.leftStickStableDirection || this.degree || 1;
    const register = this.songData?.schema?.arrangement?.registers?.[this.instrument] || null;
    const toMidi = (note) => {
      const match = String(note || '').match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
      if (!match) return null;
      const label = `${match[1].toUpperCase()}${match[2] || ''}`;
      const octave = Number(match[3]);
      const pcMap = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
      return (octave + 1) * 12 + (pcMap[label] ?? 0);
    };
    const applyRegister = (pitch) => {
      let adjusted = pitch + (register?.transpose_semitones ?? 0);
      const minMidi = register?.min_note ? toMidi(register.min_note) : null;
      if (Number.isFinite(minMidi)) {
        while (adjusted < minMidi) {
          adjusted += 12;
        }
      }
      return adjusted;
    };
    const basePitch = applyRegister(this.robterspiel.getPitchForScaleStep(leftDegree - 1));
    const noteLabel = this.instrument === 'drums' ? '' : formatPitchLabel(basePitch);
    const bendSemitones = this.robterspiel.getPitchBendSemitones();
    const bendDisplay = Math.round(bendSemitones * 2) / 2;
    const bendLabel = this.instrument === 'drums'
      ? ''
      : `${formatPitchLabel(basePitch)} → ${formatPitchLabel(basePitch + bendDisplay)}`;

    const radius = 24;
    const leftX = options.leftX ?? 80;
    const rightX = options.rightX ?? width - 80;
    const baseY = options.baseY ?? height - 110;

    const targetPulse = clamp(options.targetPulse ?? 0, 0, 1);
    const drawStick = (centerX, centerY, stick, label, active, showDirections, targetAngle, targetLabel) => {
      if (!active) return;
      const knobX = centerX + clamp(stick.x, -1, 1) * radius * 0.6;
      const knobY = centerY + clamp(stick.y, -1, 1) * radius * 0.6;
      ctx.save();
      ctx.fillStyle = 'rgba(5,10,18,0.75)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,200,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.arc(knobX, knobY, radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7f2ff';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(label, centerX, centerY + radius + 16);
      if (Number.isFinite(targetAngle)) {
        const markerRadius = radius * (0.9 + targetPulse * 0.12);
        const dx = Math.cos(targetAngle) * markerRadius;
        const dy = Math.sin(targetAngle) * markerRadius;
        ctx.strokeStyle = `rgba(255,225,120,${0.65 + targetPulse * 0.35})`;
        ctx.lineWidth = 2 + targetPulse;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + dx, centerY + dy);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,225,120,${0.7 + targetPulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 4 + targetPulse * 2, 0, Math.PI * 2);
        ctx.fill();
        if (targetLabel) {
          ctx.fillStyle = '#ffe16a';
          ctx.font = '10px Courier New';
          ctx.fillText(targetLabel, centerX, centerY - radius - 10);
        }
      }
      if (showDirections) {
        const markers = [
          { id: 1, angle: 270 },
          { id: 2, angle: 315 },
          { id: 3, angle: 0 },
          { id: 4, angle: 45 },
          { id: 5, angle: 90 },
          { id: 6, angle: 135 },
          { id: 7, angle: 180 },
          { id: 8, angle: 225 }
        ];
        const labelRadius = radius + 14;
        ctx.font = '10px Courier New';
        markers.forEach((marker) => {
          const angle = (marker.angle * Math.PI) / 180;
          const dx = Math.cos(angle) * labelRadius;
          const dy = Math.sin(angle) * labelRadius;
          ctx.fillStyle = marker.id === leftDegree ? '#ffe16a' : '#d7f2ff';
          ctx.fillText(String(marker.id), centerX + dx, centerY + dy + 4);
        });
      }
      if (noteLabel && showDirections) {
        ctx.fillStyle = '#d7f2ff';
        ctx.font = '11px Courier New';
        ctx.fillText(`${leftDegree}: ${noteLabel}`, centerX, centerY + radius + 30);
      }
      ctx.restore();
    };

    drawStick(
      leftX,
      baseY,
      leftStick,
      options.leftLabel || 'Left Stick',
      leftMagnitude > 0.25 || options.forceLeft,
      true,
      options.targetLeftAngle,
      options.targetLeftLabel
    );
    drawStick(
      rightX,
      baseY,
      rightStick,
      options.rightLabel || 'Right Stick',
      rightMagnitude > 0.25 || options.forceRight,
      false,
      options.targetRightAngle,
      options.targetRightLabel
    );

    if (this.instrument !== 'drums') {
      const meterW = 200;
      const meterH = 8;
      const meterX = width / 2 - meterW / 2;
      const meterY = baseY - 44;
      ctx.save();
      ctx.fillStyle = 'rgba(5,10,18,0.7)';
      ctx.fillRect(meterX, meterY, meterW, meterH);
      ctx.strokeStyle = 'rgba(140,200,255,0.5)';
      ctx.strokeRect(meterX, meterY, meterW, meterH);
      const ratio = clamp((bendSemitones + 2) / 4, 0, 1);
      ctx.fillStyle = '#ffe16a';
      ctx.beginPath();
      ctx.arc(meterX + ratio * meterW, meterY + meterH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7f2ff';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`${bendLabel} (${bendDisplay >= 0 ? '+' : ''}${bendDisplay} st)`, width / 2, meterY + 18);
      ctx.restore();
    }
  }

  getSetlistEntries() {
    const entries = [];
    this.setlistSets.forEach((set, setIndex) => {
      set.songs.forEach((song, songIndex) => {
        const locked = setIndex + 1 > this.progress.unlockedSets;
        entries.push({
          ...song,
          setIndex,
          songIndex,
          setTitle: set.title,
          tier: song.difficulty ? mapDifficultyToTierNumber(song.difficulty) : set.tier,
          locked,
          random: false
        });
      });
    });
    entries.push({
      name: 'Random Song',
      random: true,
      instrument: this.instrument,
      setIndex: -1,
      songIndex: -1,
      tier: Math.min(7, this.progress.unlockedSets),
      difficulty: mapTierToDifficulty(Math.min(7, this.progress.unlockedSets)),
      hint: 'A fresh deterministic chart from your saved random seed.',
      setTitle: 'Random',
      locked: false
    });
    const ratedEntries = entries.map((entry) => ({
      ...entry,
      rating: this.getSongDifficultyRating(entry)
    }));
    ratedEntries.sort((a, b) => {
      if (a.rating !== b.rating) return a.rating - b.rating;
      return a.name.localeCompare(b.name);
    });
    return ratedEntries;
  }

  resolveRandomSongName() {
    const name = buildRandomName(this.randomSeed);
    this.randomSeed += 1;
    this.saveRandomSeed();
    return name;
  }

  getSongDifficultyRating(entry) {
    if (!entry) return 1;
    const key = `${entry.name}-${this.instrument}`;
    if (this.difficultyRatings.has(key)) {
      return this.difficultyRatings.get(key);
    }
    const songData = generateSongData({
      name: entry.name,
      tier: entry.tier,
      instrument: this.instrument,
      allowModeChange: entry.tier >= 7,
      difficulty: entry.difficulty,
      schema: entry.schema
    });
    const rating = this.calculateDifficultyRating(songData);
    this.difficultyRatings.set(key, rating);
    return rating;
  }

  calculateDifficultyRating(songData) {
    const events = songData?.events || [];
    if (!events.length) return 1;
    const tempo = songData?.tempo?.bpm || songData?.bpm || 120;
    const secondsPerBeat = songData?.tempo?.secondsPerBeat || 60 / tempo;
    const sorted = [...events].sort((a, b) => a.timeSec - b.timeSec);
    const lastEvent = sorted[sorted.length - 1];
    const sustainSeconds = lastEvent?.sustain ? lastEvent.sustain * secondsPerBeat : 0;
    const duration = Math.max(1, (lastEvent?.timeSec || 0) + sustainSeconds);
    const notesPerMinute = (sorted.length / duration) * 60;

    const degrees = new Set();
    const buttons = new Set();
    let modifierEvents = 0;
    let fastEvents = 0;

    sorted.forEach((event, index) => {
      const required = event.requiredInput || {};
      if (required.degree) degrees.add(required.degree);
      if (required.button) buttons.add(required.button);
      if (required.modifiers?.lb || required.modifiers?.dleft || required.octaveUp) {
        modifierEvents += 1;
      }
      if (required.chordType && !['triad', 'power'].includes(required.chordType)) {
        modifierEvents += 1;
      }
      if (index > 0) {
        const delta = event.timeSec - sorted[index - 1].timeSec;
        if (delta < secondsPerBeat * 0.5) {
          fastEvents += 1;
        }
      }
    });

    const densityScore = notesPerMinute / 90;
    const varietyScore = degrees.size / 7;
    const buttonScore = buttons.size / 4;
    const modifierScore = modifierEvents / sorted.length;
    const fastScore = fastEvents / sorted.length;
    const tempoScore = tempo / 180;

    const rawScore = densityScore * 1.2
      + varietyScore * 0.9
      + buttonScore * 0.6
      + modifierScore * 1.6
      + fastScore * 1.2
      + tempoScore * 0.8;

    return clamp(Math.ceil(rawScore * 1.2), 1, 6);
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#08080d';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (this.state === 'song-select') {
      this.drawSongSelect(ctx, width, height);
      return;
    }
    if (this.state === 'stem-select') {
      this.drawStemSelect(ctx, width, height);
      return;
    }
    if (this.state === 'setlist') {
      this.drawSetlist(ctx, width, height);
      return;
    }
    if (this.state === 'instrument-select') {
      this.drawInstrumentSelect(ctx, width, height);
      return;
    }
    if (this.state === 'difficulty-select') {
      this.drawDifficultySelect(ctx, width, height);
      return;
    }
    if (this.state === 'detail') {
      this.drawDetail(ctx, width, height);
      return;
    }
    if (this.state === 'scale') {
      this.drawScale(ctx, width, height);
      return;
    }
    if (this.state === 'mode-select') {
      this.drawModeSelect(ctx, width, height);
      return;
    }
    if (this.state === 'preview') {
      this.drawPreview(ctx, width, height);
      return;
    }
    if (this.state === 'play') {
      this.drawPlay(ctx, width, height);
      return;
    }
    if (this.state === 'pause') {
      this.drawPlay(ctx, width, height);
      this.drawPause(ctx, width, height);
      return;
    }
    if (this.state === 'results') {
      this.drawResults(ctx, width, height);
    }
  }

  drawSongSelect(ctx, width, height) {
    const status = !this.songManifestLoaded
      ? 'Loading song manifest...'
      : this.songManifestError
        ? 'Failed to load song manifest.'
        : this.songLoadStatus;
    this.songSelectView.draw(ctx, width, height, {
      songs: this.songManifest,
      selectedIndex: this.songSelectionIndex,
      status
    });
  }

  drawStemSelect(ctx, width, height) {
    this.instrumentSelectView.draw(ctx, width, height, {
      stems: this.stemList.map((stem) => ({
        label: stem.label,
        difficultyLabel: stem.difficultyLabel || stem.keyLabel
      })),
      selectedStemIndex: this.stemSelectionIndex,
      selectedActionIndex: this.stemActionIndex,
      songTitle: this.selectedSong?.title || '',
      status: this.songLoadStatus
    });
  }

  drawInstrumentSelect(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Your Instrument', width / 2, 80);

    const cardW = 240;
    const cardH = 60;
    const startY = 140;
    const gap = 16;
    this.bounds.instrumentButtons = [];
    INSTRUMENTS.forEach((instrument, index) => {
      const y = startY + index * (cardH + gap);
      const isSelected = index === this.instrumentSelectionIndex;
      const x = width / 2 - cardW / 2;
      ctx.fillStyle = isSelected ? 'rgba(120,200,255,0.85)' : 'rgba(20,30,40,0.7)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(140,200,255,0.4)';
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeRect(x, y, cardW, cardH);
      ctx.fillStyle = isSelected ? '#041019' : '#d7f2ff';
      ctx.font = 'bold 18px Courier New';
      ctx.fillText(instrument.toUpperCase(), width / 2, y + cardH / 2 + 6);
      this.bounds.instrumentButtons.push({ x, y, w: cardW, h: cardH, index });
    });

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.fillText('Confirm: Select  |  Back: Exit to Main Menu', width / 2, height - 60);
    ctx.restore();
  }

  drawDifficultySelect(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Difficulty', width / 2, 80);

    const cardW = 520;
    const cardH = 58;
    const startY = 140;
    const gap = 14;
    this.bounds.difficultyButtons = [];
    PERFORMANCE_DIFFICULTIES.forEach((entry, index) => {
      const y = startY + index * (cardH + gap);
      const isSelected = index === this.difficultySelectionIndex;
      const x = width / 2 - cardW / 2;
      ctx.fillStyle = isSelected ? 'rgba(255,210,120,0.85)' : 'rgba(20,30,40,0.7)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(140,200,255,0.4)';
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeRect(x, y, cardW, cardH);
      ctx.fillStyle = isSelected ? '#20120a' : '#d7f2ff';
      ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(entry.label, width / 2 - cardW / 2 + 24, y + 24);
      ctx.font = '13px Courier New';
      ctx.fillStyle = isSelected ? '#20120a' : 'rgba(215,242,255,0.8)';
      ctx.fillText(entry.description, width / 2 - cardW / 2 + 24, y + 44);
      this.bounds.difficultyButtons.push({ x, y, w: cardW, h: cardH, index });
    });

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Confirm: Continue  |  Back: Instrument Select', width / 2, height - 60);
    ctx.restore();
  }

  drawSetlist(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0e0f18';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('RobterSESSION Setlist', width / 2, 60);

    const listX = 80;
    const listY = 110;
    const rowH = 26;
    const entries = this.getSetlistEntries();
    const listWidth = 520;
    const instrumentLabel = this.instrument.toUpperCase();
    const difficultyLabel = PERFORMANCE_DIFFICULTIES.find((entry) => entry.id === this.performanceDifficulty)?.label || 'Medium';
    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`Instrument: ${instrumentLabel}   •   Difficulty: ${difficultyLabel}`, width / 2, 90);
    const listTop = listY;
    const listBottom = height - 80;
    const viewHeight = listBottom - listTop;
    const rowPositions = [];
    let y = listY;
    entries.forEach((entry, index) => {
      rowPositions.push({ index, y });
      y += rowH + 8;
    });
    const totalHeight = y - listY;
    const maxScroll = Math.max(0, totalHeight - viewHeight);
    const selectedRow = rowPositions[this.selectionIndex];
    let scrollOffset = 0;
    if (selectedRow) {
      const rowTop = selectedRow.y - 16;
      const rowBottom = rowTop + rowH;
      if (rowTop - scrollOffset < listTop) {
        scrollOffset = rowTop - listTop;
      } else if (rowBottom - scrollOffset > listBottom) {
        scrollOffset = rowBottom - listBottom;
      }
    }
    scrollOffset = clamp(scrollOffset, 0, maxScroll);

    this.bounds.list = [];
    y = listY;
    entries.forEach((entry, index) => {
      const drawY = y - scrollOffset;
      const selected = index === this.selectionIndex;
      if (drawY + rowH >= listTop - 30 && drawY - rowH <= listBottom + 30) {
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(listX, drawY - 16, listWidth, rowH);
        ctx.strokeStyle = selected ? '#ffe16a' : 'rgba(255,255,255,0.12)';
        ctx.strokeRect(listX, drawY - 16, listWidth, rowH);
        ctx.fillStyle = entry.locked ? 'rgba(255,255,255,0.25)' : '#fff';
        ctx.font = '16px Courier New';
        ctx.fillText(entry.name, listX + 12, drawY + 4);
        ctx.font = '12px Courier New';
        ctx.fillStyle = entry.locked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)';
        const bestScore = this.progress.bestScores[getSongKey(entry.name)] || 0;
        const bestGrade = this.progress.bestGrades[getSongKey(entry.name)] || '-';
        if (!entry.random) {
          ctx.fillText(`Best ${bestScore}`, listX + 220, drawY + 4);
          ctx.fillText(`Grade ${bestGrade}`, listX + 320, drawY + 4);
        } else {
          ctx.fillText('Deterministic seed', listX + 250, drawY + 4);
        }
        this.drawDifficultyIcons(ctx, listX + listWidth - 150, drawY + 4, entry.rating);
        this.bounds.list.push({ x: listX, y: drawY - 16, w: listWidth, h: rowH, entryIndex: index });
      }
      y += rowH + 8;
    });

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Confirm: Start  |  Back: Difficulty Select', listX, height - 40);
    ctx.restore();
  }

  drawDifficultyIcons(ctx, x, y, rating) {
    const normalized = clamp(Math.round(rating || 1), 1, 6);
    const label = normalized >= 6 ? '💀💀💀💀💀' : '🔥'.repeat(normalized);
    ctx.save();
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(215,242,255,0.85)';
    ctx.fillText(`D${normalized}`, x, y);
    ctx.font = '16px Arial';
    ctx.fillStyle = normalized >= 6 ? 'rgba(255,120,120,0.9)' : 'rgba(255,200,90,0.9)';
    ctx.fillText(label, x + 36, y + 2);
    ctx.restore();
  }

  drawDetail(ctx, width, height) {
    const songName = this.songMeta.name;
    if (!this.songData || this.songData.name !== songName) {
      this.songData = generateSongData({
        name: songName,
        tier: this.songMeta.tier,
        instrument: this.instrument,
        allowModeChange: this.songMeta.tier >= 7,
        difficulty: this.songMeta.difficulty,
        schema: this.songMeta.schema
      });
    }
    ctx.save();
    ctx.fillStyle = '#0b0c14';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(songName, width / 2, 80);

    ctx.fillStyle = 'rgba(122,208,255,0.9)';
    ctx.font = '14px Courier New';
    ctx.fillText(this.songMeta.hint, width / 2, 110);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText(`Default Instrument: ${this.songMeta.instrument}`, 140, 170);
    const rating = this.getSongDifficultyRating(this.songMeta);
    ctx.fillText(`Song Difficulty: D${rating}`, 140, 200);
    ctx.fillText(`Tempo Range: ${Math.round(this.songData.tempoRange.min)}-${Math.round(this.songData.tempoRange.max)} BPM`, 140, 230);

    ctx.fillStyle = '#ffe16a';
    ctx.fillText(`Instrument: ${this.instrument}`, 140, 270);
    const difficultyLabel = PERFORMANCE_DIFFICULTIES.find((entry) => entry.id === this.performanceDifficulty)?.label || 'Medium';
    ctx.fillText(`Performance Difficulty: ${difficultyLabel}`, 140, 300);
    this.drawDifficultyIcons(ctx, 140, 330, rating);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px Courier New';
    ctx.fillText('Confirm: Set Scale  |  Back: Setlist', 140, 360);
    ctx.restore();
  }

  drawScale(ctx, width, height) {
    const targetRoot = ROOT_LABELS[this.songData.root];
    const selectedRoot = ROOT_LABELS[this.scaleSelection.rootIndex];
    const targetMode = this.songData.mode.name;
    const selectedMode = MODE_LIBRARY[this.scaleSelection.scaleIndex]?.name || MODE_LIBRARY[0].name;
    const targetModeIndex = MODE_LIBRARY.findIndex((mode) => mode.name === targetMode);
    const targetOctaveLabel = this.getOctaveLabel(this.requiredOctaveOffset);
    const selectedOctaveLabel = this.getOctaveLabel(this.octaveOffset);
    const ready = this.isScaleReady();
    const pulse = (Math.sin(this.scalePromptTime * 2) + 1) / 2;
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#08101c');
    gradient.addColorStop(1, '#05060a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d7f2ff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('RobterSESSION Scale Sync', width / 2, 80);

    ctx.font = '16px Courier New';
    ctx.fillStyle = 'rgba(215,242,255,0.8)';
    ctx.fillText('Use Robterspiel to lock in the scale + root.', width / 2, 110);

    const cardW = 520;
    const cardH = 190;
    const cardX = width / 2 - cardW / 2;
    const cardY = 150;
    ctx.fillStyle = 'rgba(10,16,24,0.75)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = 'rgba(120,190,255,0.4)';
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#7ad0ff';
    ctx.font = '14px Courier New';
    ctx.fillText('TARGET', cardX + 24, cardY + 34);
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '18px Courier New';
    ctx.fillText(`Mode: ${targetMode}`, cardX + 24, cardY + 70);
    ctx.fillText(`Root: ${targetRoot}`, cardX + 24, cardY + 104);
    ctx.fillText(`Octave: ${targetOctaveLabel}`, cardX + 24, cardY + 138);

    const statusX = cardX + cardW / 2 + 10;
    const rootMatch = selectedRoot === targetRoot;
    const modeMatch = selectedMode === targetMode;
    ctx.fillStyle = '#7ad0ff';
    ctx.font = '14px Courier New';
    ctx.fillText('YOUR ROBTERSPIEL', statusX, cardY + 34);
    ctx.fillStyle = modeMatch ? '#7dffb6' : '#ff6b6b';
    ctx.font = '18px Courier New';
    ctx.fillText(`Mode: ${selectedMode}`, statusX, cardY + 70);
    ctx.fillStyle = rootMatch ? '#7dffb6' : '#ff6b6b';
    ctx.fillText(`Root: ${selectedRoot}`, statusX, cardY + 104);
    const octaveMatch = this.octaveOffset === this.requiredOctaveOffset;
    ctx.fillStyle = octaveMatch ? '#7dffb6' : '#ff6b6b';
    ctx.fillText(`Octave: ${selectedOctaveLabel}`, statusX, cardY + 138);

    if (this.songData.modeChange) {
      ctx.fillStyle = '#ffe16a';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Warning: Mid-song mode change possible.', width / 2, cardY + cardH + 30);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(215,242,255,0.8)';
    ctx.font = '14px Courier New';
    ctx.fillText('L3: select scale with left stick   |   R3: select root with right stick', width / 2, height - 140);
    ctx.fillText('D-Pad Up/Down: set octave', width / 2, height - 120);

    const promptY = height - 100;
    ctx.fillStyle = ready ? '#7dffb6' : 'rgba(215,242,255,0.65)';
    ctx.font = ready ? 'bold 18px Courier New' : '16px Courier New';
    ctx.fillText(
      ready ? 'Press A to start the song.' : 'Match the target root + scale to begin.',
      width / 2,
      promptY
    );
    ctx.fillStyle = 'rgba(215,242,255,0.6)';
    ctx.font = '14px Courier New';
    ctx.fillText('Back: return to song detail.', width / 2, promptY + 26);

    const l3X = width / 2 - 180;
    const r3X = width / 2 + 180;
    const animY = height - 210;
    this.drawStickIndicators(ctx, width, height, {
      baseY: animY,
      leftX: l3X,
      rightX: r3X,
      forceLeft: true,
      forceRight: true,
      targetLeftAngle: this.getRadialAngle(targetModeIndex, MODE_LIBRARY.length),
      targetRightAngle: this.getRadialAngle(this.songData.root, ROOT_LABELS.length),
      targetLeftLabel: 'Target',
      targetRightLabel: 'Target',
      leftLabel: 'L3 + Left Stick',
      rightLabel: 'R3 + Right Stick',
      targetPulse: pulse
    });

    ctx.restore();
  }

  drawModeSelect(ctx, width, height) {
    const options = ['NOTE', 'CHORD'];
    const selectedIndex = this.modeSelectionIndex;
    const selectedMode = options[selectedIndex] || 'NOTE';
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0f1c');
    gradient.addColorStop(1, '#05070d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d7f2ff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Performance Mode', width / 2, 80);

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '16px Courier New';
    ctx.fillText('NOTE mode focuses on single notes. CHORD mode strums full chords.', width / 2, 110);

    const cardW = 280;
    const cardH = 160;
    const gap = 80;
    const startX = width / 2 - cardW - gap / 2;
    const startY = 180;

    options.forEach((label, index) => {
      const x = startX + index * (cardW + gap);
      const y = startY;
      const isSelected = index === selectedIndex;
      ctx.fillStyle = isSelected ? 'rgba(120,200,255,0.85)' : 'rgba(12,18,28,0.8)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(120,190,255,0.5)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, y, cardW, cardH);
      ctx.fillStyle = isSelected ? '#041019' : '#d7f2ff';
      ctx.font = 'bold 26px Courier New';
      ctx.fillText(label, x + cardW / 2, y + cardH / 2);
    });

    ctx.fillStyle = '#7dffb6';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText(`Selected: ${selectedMode}`, width / 2, startY + cardH + 50);

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.fillText('Use Left/Right (or Up/Down) to choose. Press A to continue.', width / 2, height - 80);
    ctx.fillText('Back: return to scale sync.', width / 2, height - 54);
    ctx.restore();
  }

  drawPreview(ctx, width, height) {
    this.previewScreen.draw(ctx, width, height, {
      selectedIndex: this.previewSelection,
      settings: this.hudSettings,
      practiceSpeed: this.practiceSpeed,
      ghostNotes: this.hudSettings.ghostNotes,
      backLabel: 'Scale Sync'
    });
  }

  drawPlay(ctx, width, height) {
    ctx.save();
    const lanes = this.instrument === 'drums' ? DRUM_LANES : LANE_LABELS;
    const laneCount = lanes.length;
    const laneColors = this.getLaneColors();
    const highwayTint = this.getHighwayTint();
    const layout = this.highwayRenderer.getLayout({
      width,
      height,
      laneCount,
      zoom: this.hudSettings.highwayZoom,
      octaveOffset: this.octaveOffset,
      scrollSpeed: SCROLL_SPEED
    });

    this.highwayRenderer.drawBackground(ctx, width, height, layout, laneColors, highwayTint);

    if (this.starPower >= STAR_POWER_READY && !this.starPowerActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.strokeRect(layout.startX - 72, layout.laneTop - 38, layout.totalWidth + 144, layout.laneBottom - layout.laneTop + 90);
      ctx.restore();
    }

    const beatDuration = this.songData.tempo.secondsPerBeat;
    const lanePulse = NOTE_LANES.map((label) => clamp(this.buttonPulse[label] / 0.22, 0, 1));
    this.highwayRenderer.drawBeatLines(ctx, layout, this.songTime, beatDuration);
    this.highwayRenderer.drawLanes(ctx, width, height, layout, laneColors, lanes, lanePulse);
    const requiredOctaveLineY = Number.isFinite(this.requiredOctaveOffset)
      ? layout.hitLineY - this.requiredOctaveOffset * 18
      : null;
    this.highwayRenderer.drawHitLine(
      ctx,
      layout,
      this.hitGlassTimer > 0,
      layout.octaveLineY,
      requiredOctaveLineY,
      this.mode
    );

    this.highwayRenderer.drawNotes(ctx, this.events, layout, this.songTime, {
      noteSize: this.hudSettings.noteSize,
      labelMode: this.hudSettings.labelMode,
      secondsPerBeat: beatDuration
    }, laneColors, this.playMode);

    this.drawWrongNoteGhosts(ctx, width, height, {
      startX: layout.startX,
      laneWidth: layout.laneWidth,
      laneGap: layout.laneGap,
      hitLineY: layout.hitLineY
    });

    this.feedbackSystem.draw(ctx, layout);

    const accuracy = this.events.length ? this.hits / this.events.length : 0;
    const streakMultiplier = this.getStreakMultiplier();
    const starMultiplier = this.starPowerActive ? 2 : 1;
    const totalMultiplier = streakMultiplier * starMultiplier;
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${this.score}`, 40, 40);
    ctx.fillText(`Streak ${this.streak}`, 40, 62);
    ctx.fillText(`Accuracy ${(accuracy * 100).toFixed(1)}%`, 40, 84);
    ctx.fillText(`Mode ${this.mode.toUpperCase()}`, 40, 106);
    ctx.fillText(`Multiplier x${totalMultiplier}`, 40, 128);

    const healthX = 40;
    const healthY = 146;
    const healthW = 160;
    const healthH = 10;
    ctx.strokeStyle = 'rgba(120,190,255,0.6)';
    ctx.strokeRect(healthX, healthY, healthW, healthH);
    ctx.fillStyle = 'rgba(120,255,180,0.8)';
    ctx.fillRect(healthX, healthY, healthW * this.health, healthH);
    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '11px Courier New';
    ctx.fillText('Health', healthX, healthY - 6);

    const sectionLabel = this.getCurrentSectionLabel();
    if (sectionLabel) {
      ctx.fillStyle = 'rgba(10,16,24,0.75)';
      ctx.fillRect(32, 172, 180, 26);
      ctx.strokeStyle = 'rgba(120,190,255,0.5)';
      ctx.strokeRect(32, 172, 180, 26);
      ctx.fillStyle = '#7ad0ff';
      ctx.font = '14px Courier New';
      ctx.fillText(sectionLabel, 40, 190);
    }

    const meterW = 220;
    const meterH = 10;
    const meterX = width / 2 - meterW / 2;
    const meterY = layout.hitLineY + 18;
    ctx.strokeStyle = this.starPowerActive ? 'rgba(255,255,255,0.9)' : 'rgba(120,190,255,0.7)';
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = this.starPowerActive ? 'rgba(255,255,255,0.85)' : 'rgba(122,208,255,0.55)';
    ctx.fillRect(meterX, meterY, meterW * this.starPower, meterH);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(meterX + meterW * STAR_POWER_READY, meterY - 2);
    ctx.lineTo(meterX + meterW * STAR_POWER_READY, meterY + meterH + 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(215,242,255,0.8)';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('2X Power', width / 2, meterY + meterH + 12);

    if (this.groove) {
      ctx.fillStyle = 'rgba(122,208,255,0.9)';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Robtergroove!', width / 2, 96);
    }

    if (this.playMode !== 'play') {
      ctx.fillStyle = 'rgba(255,220,140,0.9)';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      const label = this.playMode === 'listen' ? 'Listen First (Autoplay)' : `Practice Mode ${this.practiceSpeed}x`;
      ctx.fillText(label, width / 2, 120);
    }

    if (this.modeChangeNotice && Math.abs(this.songTime - this.modeChangeNotice.time) < 2) {
      ctx.fillStyle = '#ffe16a';
      ctx.font = '16px Courier New';
      ctx.textAlign = 'center';
      const rootLabel = ROOT_LABELS[this.modeChangeNotice.root];
      ctx.fillText(`Mode Change: ${rootLabel} ${this.modeChangeNotice.mode.name}`, width / 2, 132);
    }

    const modifiers = this.getModifierState();
    const nextEvent = this.getNextPendingEvent();
    const targetDegree = nextEvent?.requiredInput?.degree;
    const requiredOctaveOffset = this.requiredOctaveOffset;
    const register = this.songData?.schema?.arrangement?.registers?.[this.instrument] || null;
    const mappings = NOTE_LANES.map((button) => {
      const chordType = this.getChordTypeForButton(button, modifiers);
      const action = resolveRequiredInputToMusicalAction({
        robterspiel: this.robterspiel,
        instrument: this.instrument,
        octaveOffset: requiredOctaveOffset
      }, {
        mode: this.mode === 'note' ? 'note' : 'chord',
        degree: this.degree,
        button,
        modifiers: {
          lb: modifiers.lb,
          dleft: modifiers.dleft
        },
        octaveUp: modifiers.rb,
        chordType,
        transpose: register?.transpose_semitones ?? 0,
        minNote: register?.min_note ?? null
      });
      return { button, label: action?.label || '--' };
    });

    this.controllerHUD.draw(ctx, width, height, {
      mode: this.mode,
      degree: this.degree,
      stickDir: this.robterspiel.leftStickStableDirection || this.degree,
      targetDirection: targetDegree,
      modifiers,
      octaveOffset: this.octaveOffset,
      requiredOctaveOffset,
      mappings,
      compact: this.hudSettings.inputHud === 'compact',
      instrument: this.instrument
    });

    if (this.debugShowInputs) {
      const upcoming = this.events.filter((event) => !event.judged).slice(0, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      upcoming.forEach((event, index) => {
        const required = event.requiredInput;
        const label = required.mode === 'drum'
          ? `Lane ${required.lane}`
          : `${required.mode} ${required.button} deg ${required.degree}${required.modifiers?.lb ? ' +LB' : ''}${required.modifiers?.dleft ? ' +DL' : ''}`;
        ctx.fillText(label, 40, height - 120 + index * 16);
      });

      const currentEvent = this.getClosestExpectedEvent() || this.getNextPendingEvent();
      if (currentEvent) {
        const originalNotes = currentEvent.originalNotes || [];
        const noteLabels = originalNotes.length
          ? originalNotes.map((note) => formatPitchLabel(note)).join(', ')
          : 'N/A';
        const mappedLabel = currentEvent.expectedAction?.label || currentEvent.displayLabel || '—';
        ctx.fillStyle = 'rgba(255,220,140,0.9)';
        ctx.fillText(`MIDI: ${noteLabels}`, 40, height - 64);
        ctx.fillStyle = 'rgba(215,242,255,0.85)';
        ctx.fillText(`Mapped: ${mappedLabel} (${currentEvent.approxLevel || 'exact'})`, 40, height - 48);
      }
    }

    ctx.restore();
  }

  getRadialAngle(index, count) {
    if (!Number.isFinite(index) || index < 0 || !count) return null;
    return (index / count) * Math.PI * 2 - Math.PI / 2;
  }

  getDegreeAngle(degree) {
    const mapping = {
      1: 270,
      2: 315,
      3: 0,
      4: 45,
      5: 90,
      6: 135,
      7: 180,
      8: 225
    };
    const angle = mapping[degree];
    if (!Number.isFinite(angle)) return null;
    return (angle * Math.PI) / 180;
  }

  drawPause(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', width / 2, height / 2 - 80);

    const options = ['Resume', 'Restart', 'Exit to Setlist'];
    this.bounds.pauseButtons = [];
    options.forEach((label, index) => {
      const y = height / 2 - 20 + index * 40;
      const selected = index === this.pauseSelection;
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(width / 2 - 140, y, 280, 32);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(width / 2 - 140, y, 280, 32);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.fillText(label, width / 2, y + 22);
      this.bounds.pauseButtons.push({ x: width / 2 - 140, y, w: 280, h: 32, index });
    });
    ctx.restore();
  }

  drawResults(ctx, width, height) {
    const total = this.events.length;
    const accuracy = total ? this.hits / total : 0;
    const grade = getGrade(accuracy);
    ctx.save();
    ctx.fillStyle = '#0b0c14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Results', width / 2, 80);

    ctx.font = '18px Courier New';
    ctx.fillText(`Score: ${this.score}`, width / 2, 140);
    ctx.fillText(`Accuracy: ${(accuracy * 100).toFixed(1)}%`, width / 2, 175);
    ctx.fillText(`Best Streak: ${this.bestStreak}`, width / 2, 210);
    ctx.fillText(`Grade: ${grade}`, width / 2, 245);
    ctx.fillText(`Star Power Uses: ${this.starPowerUsed}`, width / 2, 280);

    if (this.failed) {
      ctx.fillStyle = '#ff7b7b';
      ctx.font = 'bold 20px Courier New';
      ctx.fillText('Song Failed', width / 2, 320);
    }

    const approxCounts = this.events.reduce((acc, event) => {
      const level = event.approxLevel || null;
      if (level && level !== 'exact') {
        acc[level] = (acc[level] || 0) + 1;
      }
      return acc;
    }, {});
    const approxEntries = Object.entries(approxCounts);
    if (approxEntries.length) {
      ctx.fillStyle = 'rgba(255,220,140,0.85)';
      ctx.font = '14px Courier New';
      ctx.fillText('Approximation Warnings', width / 2, 360);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      approxEntries.slice(0, 3).forEach(([label, count], index) => {
        ctx.fillText(`${label}: ${count}`, width / 2, 382 + index * 16);
      });
    }

    ctx.font = '16px Courier New';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const returnLabel = this.useStemPlayback ? 'Song List' : 'Setlist';
    ctx.fillText(`Press Confirm to return to ${returnLabel}.`, width / 2, height - 80);
    ctx.restore();
  }

  handleClick(x, y) {
    if (this.state === 'song-select') {
      const hitIndex = this.songSelectView.handleClick(x, y);
      if (Number.isInteger(hitIndex)) {
        this.songSelectionIndex = hitIndex;
        const entry = this.songManifest[this.songSelectionIndex];
        if (entry) {
          this.loadSelectedSong(entry);
          this.audio.ui();
        }
      }
    }
    if (this.state === 'stem-select') {
      const action = this.instrumentSelectView.handleClick(x, y);
      if (!action) return;
      if (action.type === 'stem') {
        this.stemSelectionIndex = action.index;
        this.audio.menu();
      } else if (action.type === 'action') {
        this.stemActionIndex = action.index;
        const stem = this.stemList[this.stemSelectionIndex];
        if (!stem) return;
        if (action.index === 2) {
          this.state = 'song-select';
          this.audio.ui();
          return;
        }
        const prepared = this.prepareStemSong(stem.name);
        if (!prepared) return;
        const playMode = action.index === 1 ? 'listen' : 'play';
        this.startSong({ playMode });
        this.audio.ui();
      }
    }
    if (this.state === 'instrument-select') {
      const hit = this.bounds.instrumentButtons.find((button) => (
        x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h
      ));
      if (hit) {
        this.instrumentSelectionIndex = hit.index;
        this.instrument = INSTRUMENTS[hit.index] || this.instrument;
        this.state = 'difficulty-select';
        this.audio.ui();
      }
    }
    if (this.state === 'difficulty-select') {
      const hit = this.bounds.difficultyButtons.find((button) => (
        x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h
      ));
      if (hit) {
        this.difficultySelectionIndex = hit.index;
        const entry = PERFORMANCE_DIFFICULTIES[hit.index];
        if (entry) {
          this.performanceDifficulty = entry.id;
        }
        this.selectionIndex = 0;
        this.state = 'setlist';
        this.audio.ui();
      }
    }
    if (this.state === 'setlist') {
      const hit = this.bounds.list.find((entry) => (
        x >= entry.x && x <= entry.x + entry.w && y >= entry.y && y <= entry.y + entry.h
      ));
      if (hit) {
        this.selectionIndex = hit.entryIndex;
        const entry = this.getSetlistEntries()[this.selectionIndex];
        if (!entry.locked || entry.random) {
          this.songMeta = entry;
          this.state = 'detail';
          this.audio.ui();
        }
      }
    }
    if (this.state === 'preview') {
      const action = this.previewScreen.handleClick(x, y);
      if (!action) return;
      if (action.type === 'mode') {
        const modes = ['listen', 'practice', 'play'];
        this.previewSelection = modes.indexOf(action.value);
        this.startSong({ playMode: action.value });
        this.audio.ui();
      }
      if (action.type === 'toggle') {
        if (action.id === 'ghostNotes') {
          this.hudSettings.ghostNotes = !this.hudSettings.ghostNotes;
        } else if (action.id === 'labelMode') {
          const options = ['buttons', 'pitch', 'both'];
          const index = (options.indexOf(this.hudSettings.labelMode) + 1) % options.length;
          this.hudSettings.labelMode = options[index];
        } else if (action.id === 'inputHud') {
          this.hudSettings.inputHud = this.hudSettings.inputHud === 'compact' ? 'full' : 'compact';
        }
        saveHudSettings(this.hudSettings);
      }
      if (action.type === 'speed') {
        this.practiceSpeed = action.value;
      }
      return;
    }
    if (this.state === 'pause') {
      const hit = this.bounds.pauseButtons.find((button) => (
        x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h
      ));
      if (hit) {
        this.pauseSelection = hit.index;
        if (this.pauseSelection === 0) {
          this.state = 'play';
        } else if (this.pauseSelection === 1) {
          this.startSong({ playMode: this.playMode });
        } else {
          this.state = 'setlist';
        }
        this.audio.ui();
      }
    }
  }
}
