import { DRUM_LANES, GRADE_THRESHOLDS, INSTRUMENTS, LANE_LABELS, ROOT_LABELS, SETS } from './constants.js';
import { buildRandomName, generateSongData } from './songGenerator.js';
import { getModeToggle, getOctaveShift, getPauseTrigger, getStarPowerTrigger, matchesRequiredInput, normalizeRobterInput } from './inputNormalizer.js';

const PROGRESS_KEY = 'robtersession-progress';
const RANDOM_SEED_KEY = 'robtersession-random-seed';
const GROOVE_THRESHOLD = 20;
const STAR_POWER_GAIN = 0.12;
const STAR_POWER_DRAIN = 0.2;
const SCROLL_SPEED = 240;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const defaultProgress = () => ({
  unlockedSets: 1,
  bestScores: {},
  bestAccuracy: {},
  bestGrades: {}
});

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
    this.mode = 'chord';
    this.octaveOffset = 0;
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
      this.handleScaleInput();
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
      this.state = 'setlist';
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
    if (this.input.wasPressed('interact')) {
      this.startSong();
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
        this.startSong();
      } else {
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
    if (getPauseTrigger(this.input)) {
      this.state = 'pause';
      this.pauseSelection = 0;
      this.audio.ui();
      return;
    }
    if (this.instrument !== 'drums' && getModeToggle(this.input)) {
      this.mode = this.mode === 'note' ? 'chord' : 'note';
    }
    const octaveShift = getOctaveShift(this.input);
    this.octaveOffset = clamp(this.octaveOffset + octaveShift, -2, 2);

    const normalized = normalizeRobterInput({ input: this.input, prevDegree: this.degree, mode: this.mode });
    this.degree = normalized.degree;

    if (normalized.button) {
      this.tryHit(normalized);
    }

    if (getStarPowerTrigger(this.input) && this.groove && this.starPower > 0 && !this.starPowerActive) {
      this.starPowerActive = true;
      this.starPowerUsed += 1;
    }

    if (this.starPowerActive) {
      this.starPower = Math.max(0, this.starPower - STAR_POWER_DRAIN * dt);
      if (this.starPower <= 0) {
        this.starPowerActive = false;
      }
    }

    this.songTime += dt;

    if (this.modeChangeNotice && this.songTime > this.modeChangeNotice.time + 3) {
      this.modeChangeNotice = null;
    }

    this.markMisses();

    if (this.songTime >= this.songLength) {
      this.finishSong();
    }
  }

  prepareSong() {
    const tier = this.songMeta.tier;
    const allowModeChange = tier >= 7;
    const songName = this.songMeta.name;
    this.songData = generateSongData({
      name: songName,
      tier,
      instrument: this.instrument,
      allowModeChange
    });
  }

  startSong() {
    this.state = 'play';
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
    this.mode = this.instrument === 'drums' ? 'drum' : 'chord';
    this.events = this.songData.events.map((event) => ({
      ...event,
      hit: false,
      judged: false
    }));
    const lastEvent = this.events[this.events.length - 1];
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
    const key = getSongKey(this.songMeta.name);
    const progress = this.progress;
    progress.bestScores[key] = Math.max(progress.bestScores[key] || 0, this.score);
    const previousAccuracy = progress.bestAccuracy[key] || 0;
    progress.bestAccuracy[key] = Math.max(previousAccuracy, accuracy);
    if (accuracy >= previousAccuracy) {
      progress.bestGrades[key] = grade;
    }
    if (!this.songMeta.random && this.songMeta.setIndex + 1 >= progress.unlockedSets) {
      progress.unlockedSets = Math.min(SETS.length, this.songMeta.setIndex + 2);
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
        this.registerMiss();
      }
    });
  }

  registerMiss() {
    this.misses += 1;
    this.streak = 0;
    this.groove = false;
    this.starPowerActive = false;
  }

  tryHit(normalized) {
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
      }))?.event;
    if (!match) return;
    const diff = Math.abs(match.timeSec - this.songTime);
    const judgement = diff <= timing.great ? 'great' : 'good';
    match.hit = true;
    match.judged = true;
    match.judgement = judgement;
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
  }

  getSetlistEntries() {
    const entries = [];
    SETS.forEach((set, setIndex) => {
      set.songs.forEach((song, songIndex) => {
        const locked = setIndex + 1 > this.progress.unlockedSets;
        entries.push({
          ...song,
          setIndex,
          songIndex,
          setTitle: set.title,
          tier: set.tier,
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
    this.bounds.list = [];
    let y = listY;
    let lastSetIndex = null;
    entries.forEach((entry, index) => {
      if (entry.setIndex !== lastSetIndex && entry.setIndex >= 0) {
        ctx.fillStyle = '#7ad0ff';
        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(entry.setTitle, listX, y);
        y += 18;
        lastSetIndex = entry.setIndex;
      }
      const selected = index === this.selectionIndex;
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(listX, y - 16, 380, rowH);
      ctx.strokeStyle = selected ? '#ffe16a' : 'rgba(255,255,255,0.12)';
      ctx.strokeRect(listX, y - 16, 380, rowH);
      ctx.fillStyle = entry.locked ? 'rgba(255,255,255,0.25)' : '#fff';
      ctx.font = '16px Courier New';
      ctx.fillText(entry.name, listX + 12, y + 4);
      ctx.font = '12px Courier New';
      ctx.fillStyle = entry.locked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)';
      const bestScore = this.progress.bestScores[getSongKey(entry.name)] || 0;
      const bestGrade = this.progress.bestGrades[getSongKey(entry.name)] || '-';
      if (!entry.random) {
        ctx.fillText(`Best ${bestScore}`, listX + 220, y + 4);
        ctx.fillText(`Grade ${bestGrade}`, listX + 320, y + 4);
      } else {
        ctx.fillText('Deterministic seed', listX + 250, y + 4);
      }
      this.bounds.list.push({ x: listX, y: y - 16, w: 380, h: rowH, entryIndex: index });
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
        allowModeChange: this.songMeta.tier >= 7
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
    const rootLabel = ROOT_LABELS[this.songData.root];
    ctx.save();
    ctx.fillStyle = '#0b0c14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Set Scale', width / 2, 100);
    ctx.font = '18px Courier New';
    ctx.fillText(`Root: ${rootLabel}`, width / 2, 160);
    ctx.fillText(`Mode: ${this.songData.mode.name}`, width / 2, 195);
    if (this.songData.modeChange) {
      ctx.fillStyle = '#7ad0ff';
      ctx.fillText('Warning: Mid-song mode change possible.', width / 2, 240);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '16px Courier New';
    ctx.fillText('Press Confirm to begin.', width / 2, height - 80);
    ctx.fillText('Back to return.', width / 2, height - 50);
    ctx.restore();
  }

  drawPlay(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, width, height);

    const lanes = this.instrument === 'drums' ? DRUM_LANES : LANE_LABELS;
    const laneCount = lanes.length;
    const laneWidth = 70;
    const laneGap = 18;
    const totalWidth = laneCount * laneWidth + (laneCount - 1) * laneGap;
    const startX = width / 2 - totalWidth / 2;
    const hitLineY = height - 140;

    ctx.fillStyle = this.groove ? 'rgba(70,130,255,0.45)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(startX - 40, 80, totalWidth + 80, 26);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < laneCount; i += 1) {
      const x = startX + i * (laneWidth + laneGap);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 110, laneWidth, hitLineY - 140);
      ctx.strokeRect(x, 110, laneWidth, hitLineY - 140);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(lanes[i], x + laneWidth / 2, hitLineY + 30);
    }

    ctx.strokeStyle = '#ffe16a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 20, hitLineY);
    ctx.lineTo(startX + totalWidth + 20, hitLineY);
    ctx.stroke();

    const visibleWindow = 4;
    this.events.forEach((event) => {
      if (event.hit || (event.judged && !event.hit)) return;
      const timeToHit = event.timeSec - this.songTime;
      if (timeToHit < -0.3 || timeToHit > visibleWindow) return;
      const laneIndex = event.lane ?? 0;
      const x = startX + laneIndex * (laneWidth + laneGap);
      const y = hitLineY - timeToHit * SCROLL_SPEED;
      const color = event.starPhrase ? '#7ad0ff' : '#ff6bd6';
      ctx.fillStyle = color;
      ctx.globalAlpha = event.starPhrase ? 0.9 : 0.8;
      ctx.fillRect(x + 6, y - 10, laneWidth - 12, 20);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(x + 6, y - 10, laneWidth - 12, 20);
    });

    const accuracy = this.events.length ? this.hits / this.events.length : 0;
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${this.score}`, 40, 40);
    ctx.fillText(`Streak ${this.streak}`, 40, 62);
    ctx.fillText(`Accuracy ${(accuracy * 100).toFixed(1)}%`, 40, 84);

    ctx.textAlign = 'right';
    ctx.fillText(`Mode ${this.mode.toUpperCase()}`, width - 40, 40);
    ctx.fillText(`Degree ${this.degree}`, width - 40, 62);
    ctx.fillText(`Octave ${this.octaveOffset}`, width - 40, 84);
    ctx.fillText(`Instrument ${this.instrument}`, width - 40, 106);

    const meterX = width - 220;
    const meterY = 120;
    const meterW = 160;
    const meterH = 16;
    ctx.strokeStyle = '#7ad0ff';
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = this.starPowerActive ? 'rgba(122,208,255,0.9)' : 'rgba(122,208,255,0.5)';
    ctx.fillRect(meterX, meterY, meterW * this.starPower, meterH);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Star Power', meterX + meterW, meterY - 6);

    if (this.groove) {
      ctx.fillStyle = 'rgba(122,208,255,0.9)';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Robtergroove!', width / 2, 100);
    }

    if (this.modeChangeNotice && Math.abs(this.songTime - this.modeChangeNotice.time) < 2) {
      ctx.fillStyle = '#ffe16a';
      ctx.font = '16px Courier New';
      ctx.textAlign = 'center';
      const rootLabel = ROOT_LABELS[this.modeChangeNotice.root];
      ctx.fillText(`Mode Change: ${rootLabel} ${this.modeChangeNotice.mode.name}`, width / 2, 130);
    }

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
    if (this.state === 'pause') {
      const hit = this.bounds.pauseButtons.find((button) => (
        x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h
      ));
      if (hit) {
        this.pauseSelection = hit.index;
        if (this.pauseSelection === 0) {
          this.state = 'play';
        } else if (this.pauseSelection === 1) {
          this.startSong();
        } else {
          this.state = 'setlist';
        }
        this.audio.ui();
      }
    }
  }
}
