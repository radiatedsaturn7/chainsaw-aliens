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
import {
  describeInputDebug,
  formatPitchLabel,
  resolveInputToMusicalAction,
  resolveRequiredInputToMusicalAction
} from './inputResolver.js';

const PROGRESS_KEY = 'robtersession-progress';
const RANDOM_SEED_KEY = 'robtersession-random-seed';
const GROOVE_THRESHOLD = 20;
const STAR_POWER_GAIN = 0.12;
const STAR_POWER_DRAIN = 0.2;
const SCROLL_SPEED = 240;
const HIT_GLASS_DURATION = 0.25;
const WRONG_NOTE_COOLDOWN = 0.22;
const NOTE_LANES = ['A', 'X', 'Y', 'B'];
const SCALE_SELECTOR_THRESHOLD = 0.6;
const SCALE_SELECTOR_RELEASE = 0.3;
const SCALE_PROMPT_SPEED = 0.9;
const WRONG_GHOST_DURATION = 0.7;
const MAX_NOTE_SIZE = 1.5;
const MAX_HIGHWAY_ZOOM = 2;
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

const MIDI_PROGRAMS = {
  guitar: 27,
  bass: 33,
  piano: 0
};

const INSTRUMENT_CHANNELS = {
  guitar: 0,
  bass: 1,
  piano: 2,
  drums: 9
};

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

const getSongKey = (songName) => songName.toLowerCase().replace(/\s+/g, '-');

export default class RobterSession {
  constructor({ input, audio }) {
    this.input = input;
    this.audio = audio;
    this.state = 'setlist';
    this.progress = loadProgress();
    this.selectionIndex = 0;
    this.instrument = 'guitar';
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
      resultsButtons: []
    };
    this.randomSeed = this.loadRandomSeed();
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
    this.inputBus = new InputEventBus();
    this.robterspiel = new RobterspielInput(this.inputBus);
    this.robterspielNotes = new Set();
    this.robterspiel.setEnabled(true);
    this.setlistSets = DEFAULT_SETS;
    this.setlistLoaded = false;
    this.setlistLoadError = null;
    this.setlistLoadPromise = this.loadSetlistData();
    this.registerInputBus();
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

  loadRandomSeed() {
    const raw = localStorage.getItem(RANDOM_SEED_KEY);
    const seed = raw ? Number(raw) : Date.now();
    return Number.isFinite(seed) ? seed : Date.now();
  }

  saveRandomSeed() {
    localStorage.setItem(RANDOM_SEED_KEY, String(this.randomSeed));
  }

  enter() {
    this.state = 'setlist';
    this.songData = null;
    this.songMeta = null;
    this.robterspielNotes.forEach((id) => this.audio.stopLiveGmNote?.(id));
    this.robterspielNotes.clear();
    this.scaleSelection = {
      scaleIndex: 0,
      rootIndex: 0,
      scaleConfirmed: false,
      rootConfirmed: false
    };
    this.requiredOctaveOffset = REQUIRED_OCTAVE_OFFSET;
    this.octaveOffset = REQUIRED_OCTAVE_OFFSET;
  }

  update(dt) {
    if (this.debugEnabled && this.input.wasPressedCode('KeyH')) {
      this.debugShowInputs = !this.debugShowInputs;
    }

    if (this.state === 'setlist') {
      this.handleSetlistInput();
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
      this.state = 'exit';
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
      this.instrument = entry.instrument || this.instrument;
      this.state = 'detail';
      this.audio.ui();
    }
  }

  handleDetailInput() {
    if (this.input.wasPressed('left') || this.input.wasGamepadPressed('dpadLeft')) {
      const index = (INSTRUMENTS.indexOf(this.instrument) - 1 + INSTRUMENTS.length) % INSTRUMENTS.length;
      this.instrument = INSTRUMENTS[index];
      this.audio.menu();
    }
    if (this.input.wasPressed('right') || this.input.wasGamepadPressed('dpadRight')) {
      const index = (INSTRUMENTS.indexOf(this.instrument) + 1) % INSTRUMENTS.length;
      this.instrument = INSTRUMENTS[index];
      this.audio.menu();
    }
    if (this.input.wasPressed('cancel')) {
      this.state = 'scale';
      this.audio.ui();
      return;
    }
    if (this.input.wasPressed('interact')) {
      this.prepareSong();
      this.state = 'scale';
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
      if (this.instrument === 'drums') {
        this.state = 'preview';
        this.previewSelection = 0;
      } else {
        this.selectedMode = this.getPreferredPerformanceMode();
        this.mode = this.selectedMode;
        this.robterspiel.noteMode = this.mode === 'note';
        this.startSong({ playMode: 'play' });
      }
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
        this.state = 'setlist';
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
      this.state = 'setlist';
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
      const inputAction = resolveInputToMusicalAction({
        robterspiel: this.robterspiel,
        instrument: this.instrument,
        mode: this.mode,
        degree: this.degree,
        stickDir: this.robterspiel.leftStickStableDirection || this.degree
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
          laneIndex: NOTE_LANES.indexOf(normalized.button)
        });
        this.feedbackSystem.addMiss({
          expected: expectedLabel,
          played: inputLabel,
          inputs: describeInputDebug(inputAction),
          laneIndex: NOTE_LANES.indexOf(normalized.button)
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

    if (this.playMode === 'play' && getStarPowerTrigger(this.input) && this.groove && this.starPower > 0 && !this.starPowerActive) {
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

    if (this.modeChangeNotice && this.songTime > this.modeChangeNotice.time + 3) {
      this.modeChangeNotice = null;
    }

    this.markMisses();

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
          const program = MIDI_PROGRAMS[this.instrument] ?? 0;
          const channel = INSTRUMENT_CHANNELS[this.instrument] ?? 0;
          this.audio.playGmNote?.({
            pitch,
            duration,
            volume: 0.55,
            program,
            channel
          });
        }
      });
    });
  }

  getInputLabel(normalized) {
    if (!normalized?.button) return null;
    if (this.instrument === 'drums') {
      return DRUM_LANES[NOTE_LANES.indexOf(normalized.button)] || 'Drum';
    }
    if (normalized.mode === 'note') {
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
      return formatPitchLabel(pitch);
    }
    return this.getChordLabel({
      degree: normalized.degree || 1,
      chordType: normalized.chordType || 'triad'
    });
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
    const base = 4;
    const octave = base + (offset || 0);
    return `C${octave}`;
  }

  getRequiredOctaveOffset() {
    const register = this.songData?.schema?.arrangement?.registers?.[this.instrument];
    const targetNote = register?.center_note || register?.min_note;
    const targetOctave = parseNoteOctave(targetNote);
    if (!Number.isFinite(targetOctave)) return REQUIRED_OCTAVE_OFFSET;
    return clamp(targetOctave - 4, -2, 2);
  }

  getEventLabel(requiredInput) {
    if (!requiredInput) return '';
    if (requiredInput.mode === 'drum') {
      return DRUM_LANES[requiredInput.lane] || 'Drum';
    }
    if (requiredInput.mode === 'note' || requiredInput.mode === 'pattern') {
      const [pitch] = this.resolveRequiredPitches(requiredInput, this.instrument);
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
            const program = MIDI_PROGRAMS[track] ?? 0;
            const channel = INSTRUMENT_CHANNELS[track] ?? 0;
            this.audio.playGmNote?.({
              pitch,
              duration,
              volume: 0.45,
              program,
              channel
            });
          }
        });
      }
        index += 1;
      }
      this.trackEventIndex[track] = index;
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
    this.mode = this.instrument === 'drums' ? 'drum' : this.selectedMode;
    if (this.instrument !== 'drums') {
      this.robterspiel.noteMode = this.mode === 'note';
    }
    this.syncRobterspielScale();
    this.robterspiel.octaveOffset = this.octaveOffset;
    this.audio.setMidiPitchBend?.(0);
    this.audio.setMidiPitchBend?.(0, INSTRUMENT_CHANNELS[this.instrument] ?? 0);
    this.events = this.songData.events.map((event) => ({
      ...event,
      hit: false,
      judged: false,
      displayLabel: this.getEventLabel(event.requiredInput)
    }));
    let lastDegree = null;
    this.events.forEach((event) => {
      const expectedAction = resolveRequiredInputToMusicalAction(
        { robterspiel: this.robterspiel, instrument: this.instrument },
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
    const progress = this.progress;
    progress.bestScores[key] = Math.max(progress.bestScores[key] || 0, this.score);
    const previousAccuracy = progress.bestAccuracy[key] || 0;
    progress.bestAccuracy[key] = Math.max(previousAccuracy, accuracy);
    if (accuracy >= previousAccuracy) {
      progress.bestGrades[key] = grade;
    }
    if (!this.songMeta.random && this.songMeta.setIndex + 1 >= progress.unlockedSets) {
      progress.unlockedSets = Math.min(this.setlistSets.length, this.songMeta.setIndex + 2);
    }
    saveProgress(progress);
    this.state = 'results';
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
      const grooveMultiplier = this.groove ? 1.5 : 1;
      const starMultiplier = this.starPowerActive ? 2 : 1;
      this.score += Math.round(baseScore * grooveMultiplier * starMultiplier);
      this.hitGlassTimer = HIT_GLASS_DURATION;
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
      this.wrongNotes.push({
        label: noteData.label,
        laneIndex: Number.isFinite(noteData.laneIndex) ? noteData.laneIndex : 0,
        life: WRONG_GHOST_DURATION,
        spin: 0,
        spinSpeed: (Math.random() * 2 - 1) * 3,
        x: 0,
        y: 0,
        vx: (Math.random() * 2 - 1) * 40,
        vy: -60 - Math.random() * 40
      });
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
        const program = MIDI_PROGRAMS[instrument] ?? 0;
        const channel = INSTRUMENT_CHANNELS[instrument] ?? 0;
        this.audio.startLiveGmNote?.({
          id: event.id,
          pitch,
          duration: 1.4,
          volume: velocity,
          program,
          channel
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
      this.audio.playGmNote?.({
        pitch,
        duration: 0.45,
        volume: velocity,
        program: MIDI_PROGRAMS[instrument] ?? 0,
        channel: INSTRUMENT_CHANNELS[instrument] ?? 0
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
    pitches.forEach((pitch) => {
      this.audio.playGmNote?.({
        pitch,
        duration: 0.6,
        volume: velocity,
        program: MIDI_PROGRAMS[instrument] ?? 0,
        channel: INSTRUMENT_CHANNELS[instrument] ?? 0
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
    return ['#3ad96f', '#ff5b5b', '#ffd84a', '#46b3ff'];
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
      ctx.fillStyle = '#2b0b0b';
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
    const basePitch = this.robterspiel.getPitchForScaleStep(leftDegree - 1);
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
    return entries;
  }

  resolveRandomSongName() {
    const name = buildRandomName(this.randomSeed);
    this.randomSeed += 1;
    this.saveRandomSeed();
    return name;
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#08080d';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (this.state === 'setlist') {
      this.drawSetlist(ctx, width, height);
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
    const listTop = listY;
    const listBottom = height - 80;
    const viewHeight = listBottom - listTop;
    const rowPositions = [];
    let y = listY;
    let lastSetIndex = null;
    entries.forEach((entry, index) => {
      if (entry.setIndex !== lastSetIndex && entry.setIndex >= 0) {
        y += 18;
        lastSetIndex = entry.setIndex;
      }
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
    lastSetIndex = null;
    entries.forEach((entry, index) => {
      if (entry.setIndex !== lastSetIndex && entry.setIndex >= 0) {
        const headerY = y - scrollOffset;
        if (headerY >= listTop - 20 && headerY <= listBottom + 20) {
          ctx.fillStyle = '#7ad0ff';
          ctx.font = '14px Courier New';
          ctx.textAlign = 'left';
          ctx.fillText(entry.setTitle, listX, headerY);
        }
        y += 18;
        lastSetIndex = entry.setIndex;
      }
      const drawY = y - scrollOffset;
      const selected = index === this.selectionIndex;
      if (drawY + rowH >= listTop - 30 && drawY - rowH <= listBottom + 30) {
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(listX, drawY - 16, 380, rowH);
        ctx.strokeStyle = selected ? '#ffe16a' : 'rgba(255,255,255,0.12)';
        ctx.strokeRect(listX, drawY - 16, 380, rowH);
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
        this.bounds.list.push({ x: listX, y: drawY - 16, w: 380, h: rowH, entryIndex: index });
      }
      y += rowH + 8;
    });

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Confirm: Start  |  Back: Exit to Main Menu', listX, height - 40);
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
    ctx.fillText(`Difficulty: ${this.songData.difficulty}/10`, 140, 200);
    ctx.fillText(`Tempo Range: ${Math.round(this.songData.tempoRange.min)}-${Math.round(this.songData.tempoRange.max)} BPM`, 140, 230);

    ctx.fillStyle = '#ffe16a';
    ctx.fillText(`Current Instrument: ${this.instrument}`, 140, 270);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px Courier New';
    ctx.fillText('Left/Right: Change Instrument', 140, 310);
    ctx.fillText('Confirm: Set Scale  |  Back: Setlist', 140, 335);
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
      backLabel: this.instrument === 'drums' ? 'Scale Sync' : 'Mode Select'
    });
  }

  drawPlay(ctx, width, height) {
    ctx.save();
    const lanes = this.instrument === 'drums' ? DRUM_LANES : LANE_LABELS;
    const laneCount = lanes.length;
    const laneColors = this.getLaneColors();
    const layout = this.highwayRenderer.getLayout({
      width,
      height,
      laneCount,
      zoom: this.hudSettings.highwayZoom,
      octaveOffset: this.octaveOffset,
      scrollSpeed: SCROLL_SPEED
    });

    this.highwayRenderer.drawBackground(ctx, width, height, layout, laneColors);

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
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${this.score}`, 40, 40);
    ctx.fillText(`Streak ${this.streak}`, 40, 62);
    ctx.fillText(`Accuracy ${(accuracy * 100).toFixed(1)}%`, 40, 84);
    ctx.fillText(`Mode ${this.mode.toUpperCase()}`, 40, 106);

    const sectionLabel = this.getCurrentSectionLabel();
    if (sectionLabel) {
      ctx.fillStyle = 'rgba(10,16,24,0.75)';
      ctx.fillRect(32, 128, 180, 26);
      ctx.strokeStyle = 'rgba(120,190,255,0.5)';
      ctx.strokeRect(32, 128, 180, 26);
      ctx.fillStyle = '#7ad0ff';
      ctx.font = '14px Courier New';
      ctx.fillText(sectionLabel, 40, 146);
    }

    const meterX = width - 220;
    const meterY = 44;
    const meterW = 160;
    const meterH = 16;
    ctx.strokeStyle = '#7ad0ff';
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = this.starPowerActive ? 'rgba(122,208,255,0.9)' : 'rgba(122,208,255,0.5)';
    ctx.fillRect(meterX, meterY, meterW * this.starPower, meterH);
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText('Star Power', meterX + meterW, meterY - 6);

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
    const mappings = NOTE_LANES.map((button) => {
      const chordType = this.getChordTypeForButton(button, modifiers);
      const action = resolveInputToMusicalAction({
        robterspiel: this.robterspiel,
        instrument: this.instrument,
        mode: this.mode,
        degree: this.degree,
        stickDir: this.robterspiel.leftStickStableDirection || this.degree
      }, {
        button,
        lb: modifiers.lb,
        dleft: modifiers.dleft,
        octaveUp: modifiers.rb,
        chordType
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

    ctx.font = '16px Courier New';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Press Confirm to return to Setlist.', width / 2, height - 80);
    ctx.restore();
  }

  handleClick(x, y) {
    if (this.state === 'setlist') {
      const hit = this.bounds.list.find((entry) => (
        x >= entry.x && x <= entry.x + entry.w && y >= entry.y && y <= entry.y + entry.h
      ));
      if (hit) {
        this.selectionIndex = hit.entryIndex;
        const entry = this.getSetlistEntries()[this.selectionIndex];
        if (!entry.locked || entry.random) {
          this.songMeta = entry;
          this.instrument = entry.instrument || this.instrument;
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
