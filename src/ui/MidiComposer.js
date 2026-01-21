const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MOOD_PRESETS = [
  { id: 'rock', label: 'Rock', mode: 'major', progression: ['I', 'V', 'vi', 'IV'] },
  { id: 'metal', label: 'Metal', mode: 'minor', progression: ['i', 'VI', 'VII', 'i'] },
  { id: 'jazz', label: 'Jazz', mode: 'major', progression: ['ii', 'V', 'I', 'vi'] },
  { id: 'happy', label: 'Happy', mode: 'major', progression: ['I', 'V', 'vi', 'IV'] },
  { id: 'ominous', label: 'Ominous', mode: 'minor', progression: ['i', 'bII', 'i', 'VII'] },
  { id: 'sad', label: 'Sad', mode: 'minor', progression: ['vi', 'IV', 'I', 'V'] },
  { id: 'horror', label: 'Horror', mode: 'minor', progression: ['i', 'bII', 'bVI', 'V'] }
];

const INSTRUMENT_LIBRARY = [
  { name: 'Piano', category: 'Keys' },
  { name: 'Electric Piano', category: 'Keys' },
  { name: 'Organ', category: 'Keys' },
  { name: 'Guitar', category: 'Strings' },
  { name: 'Bass', category: 'Strings' },
  { name: 'Harp', category: 'Strings' },
  { name: 'Strings', category: 'Strings' },
  { name: 'Brass', category: 'Brass' },
  { name: 'Trumpet', category: 'Brass' },
  { name: 'Trombone', category: 'Brass' },
  { name: 'Flute', category: 'Woodwinds' },
  { name: 'Clarinet', category: 'Woodwinds' },
  { name: 'Saxophone', category: 'Woodwinds' },
  { name: 'Choir', category: 'Voices' },
  { name: 'Marimba', category: 'Percussion' },
  { name: 'Vibraphone', category: 'Percussion' },
  { name: 'Drums', category: 'Percussion' },
  { name: 'Percussion', category: 'Percussion' },
  { name: 'Bell', category: 'Percussion' },
  { name: 'Synth Lead', category: 'Synths' },
  { name: 'Synth Pad', category: 'Synths' },
  { name: 'Pulse', category: 'Synths' },
  { name: 'Triangle', category: 'Synths' },
  { name: 'Square', category: 'Synths' },
  { name: 'Saw', category: 'Synths' },
  { name: 'FX', category: 'FX' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomId = () => `inst-${Math.floor(Math.random() * 100000)}`;

const buildGrid = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(false));

const degreeToSemitone = {
  I: 0,
  ii: 2,
  iii: 4,
  IV: 5,
  V: 7,
  vi: 9,
  vii: 11,
  i: 0,
  VI: 8,
  VII: 10,
  bII: 1,
  bVI: 8
};

export default class MidiComposer {
  constructor(game) {
    this.game = game;
    this.rows = 12;
    this.cols = 32;
    this.colsPerBar = 4;
    this.cursor = { row: 0, col: 0 };
    this.focus = 'instruments';
    this.activeInstruments = [
      { id: randomId(), name: 'Piano', notes: buildGrid(this.rows, this.cols) },
      { id: randomId(), name: 'Bass', notes: buildGrid(this.rows, this.cols) },
      { id: randomId(), name: 'Drums', notes: buildGrid(this.rows, this.cols) }
    ];
    this.instrumentIndex = 0;
    this.songIndex = 0;
    this.songs = [
      {
        name: 'Main Theme',
        tempo: 120,
        key: 0,
        moodIndex: 0,
        progression: MOOD_PRESETS[0].progression
      }
    ];
    this.loopBar = 0;
    this.loopEnabled = false;
    this.loopBars = 4;
    this.topControls = [
      { id: 'tempo-down', label: '-' },
      { id: 'tempo-up', label: '+' },
      { id: 'loop-remove', label: '-' },
      { id: 'loop-add', label: '+' },
      { id: 'loop-toggle', label: 'Toggle' }
    ];
    this.menuItems = [
      { id: 'song-add', label: 'Add Song' },
      { id: 'song-remove', label: 'Remove Song' },
      { id: 'instrument-add', label: 'Add Instrument' },
      { id: 'instrument-remove', label: 'Remove Instrument' },
      { id: 'generate', label: 'Generate Pattern' }
    ];
    this.menuIndex = 0;
    this.isPlaying = false;
    this.menuBounds = [];
    this.topControlBounds = [];
    this.topControlIndex = 0;
    this.playButtonBounds = null;
    this.instrumentBounds = [];
    this.gridBounds = null;
    this.lastAnalysis = null;
    this.instrumentPickerOpen = false;
    this.instrumentPickerIndex = 0;
    this.instrumentPickerItems = [];
    this.instrumentPickerBounds = [];
  }

  update(input) {
    const left = input.wasPressed('left') || input.wasGamepadPressed('dpadLeft');
    const right = input.wasPressed('right') || input.wasGamepadPressed('dpadRight');
    const up = input.wasPressed('up') || input.wasGamepadPressed('dpadUp');
    const down = input.wasPressed('down') || input.wasGamepadPressed('dpadDown');
    const interact = input.wasPressed('interact');

    if (this.instrumentPickerOpen) {
      if (up) this.moveInstrumentPicker(-1);
      if (down) this.moveInstrumentPicker(1);
      if (interact) this.selectInstrumentFromPicker();
      return;
    }

    if (this.focus === 'instruments') {
      if (up) this.instrumentIndex = (this.instrumentIndex - 1 + this.activeInstruments.length) % this.activeInstruments.length;
      if (down) this.instrumentIndex = (this.instrumentIndex + 1) % this.activeInstruments.length;
      if (right) this.focus = 'grid';
    } else if (this.focus === 'menu') {
      if (up) {
        this.menuIndex = this.menuIndex === 0 ? this.menuItems.length - 1 : this.menuIndex - 1;
      }
      if (down) {
        if (this.menuIndex === this.menuItems.length - 1) {
          this.focus = 'transport';
        } else {
          this.menuIndex += 1;
        }
      }
      if (left) this.focus = 'grid';
    } else if (this.focus === 'grid') {
      if (left) {
        if (this.cursor.col === 0) {
          this.focus = 'instruments';
        } else {
          this.cursor.col = clamp(this.cursor.col - 1, 0, this.cols - 1);
        }
      }
      if (right) {
        if (this.cursor.col === this.cols - 1) {
          this.focus = 'menu';
        } else {
          this.cursor.col = clamp(this.cursor.col + 1, 0, this.cols - 1);
        }
      }
      if (up) {
        if (this.cursor.row === 0) {
          this.focus = 'top-controls';
        } else {
          this.cursor.row = clamp(this.cursor.row - 1, 0, this.rows - 1);
        }
      }
      if (down) this.cursor.row = clamp(this.cursor.row + 1, 0, this.rows - 1);
    } else if (this.focus === 'top-controls') {
      if (left) this.topControlIndex = clamp(this.topControlIndex - 1, 0, this.topControls.length - 1);
      if (right) this.topControlIndex = clamp(this.topControlIndex + 1, 0, this.topControls.length - 1);
      if (down) this.focus = 'grid';
    } else if (this.focus === 'transport') {
      if (up) this.focus = 'menu';
    }

    if (interact) {
      if (this.focus === 'grid') {
        this.toggleNote(this.cursor.row, this.cursor.col);
      } else if (this.focus === 'menu') {
        this.handleMenuAction(this.menuItems[this.menuIndex]?.id);
      } else if (this.focus === 'top-controls') {
        this.handleMenuAction(this.topControls[this.topControlIndex]?.id);
      } else if (this.focus === 'transport') {
        this.handleMenuAction('play-toggle');
      }
    }
  }

  isModalOpen() {
    return this.instrumentPickerOpen;
  }

  closeModal() {
    if (this.instrumentPickerOpen) {
      this.instrumentPickerOpen = false;
      this.focus = 'menu';
    }
  }

  buildInstrumentPickerItems() {
    const active = new Set(this.activeInstruments.map((instrument) => instrument.name));
    const categories = new Map();
    INSTRUMENT_LIBRARY.forEach((instrument) => {
      if (active.has(instrument.name)) return;
      if (!categories.has(instrument.category)) {
        categories.set(instrument.category, []);
      }
      categories.get(instrument.category).push(instrument.name);
    });
    const items = [];
    Array.from(categories.keys()).sort().forEach((category) => {
      items.push({ type: 'header', label: category });
      categories.get(category).forEach((name) => {
        items.push({ type: 'instrument', label: name, name });
      });
    });
    if (items.length === 0) {
      items.push({ type: 'empty', label: 'All instruments already added.' });
    }
    return items;
  }

  moveInstrumentPicker(direction) {
    const selectableIndexes = this.instrumentPickerItems
      .map((item, index) => (item.type === 'instrument' ? index : null))
      .filter((index) => index !== null);
    if (selectableIndexes.length === 0) return;
    const current = selectableIndexes.indexOf(this.instrumentPickerIndex);
    const nextIndex = (current + direction + selectableIndexes.length) % selectableIndexes.length;
    this.instrumentPickerIndex = selectableIndexes[nextIndex];
  }

  selectInstrumentFromPicker() {
    const item = this.instrumentPickerItems[this.instrumentPickerIndex];
    if (!item || item.type !== 'instrument') return;
    this.activeInstruments.push({ id: randomId(), name: item.name, notes: buildGrid(this.rows, this.cols) });
    this.instrumentIndex = this.activeInstruments.length - 1;
    this.instrumentPickerOpen = false;
    this.focus = 'instruments';
  }

  handlePointerDown(payload) {
    const { x, y } = payload;
    if (this.instrumentPickerOpen) {
      const pickerHit = this.instrumentPickerBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pickerHit) {
        this.instrumentPickerIndex = pickerHit.index;
        this.selectInstrumentFromPicker();
      } else {
        this.closeModal();
      }
      return;
    }
    const instrumentHit = this.instrumentBounds.find((bounds) => this.pointInBounds(x, y, bounds));
    if (instrumentHit) {
      this.instrumentIndex = instrumentHit.index;
      this.focus = 'instruments';
      return;
    }
    const topControlHit = this.topControlBounds.find((bounds) => this.pointInBounds(x, y, bounds));
    if (topControlHit) {
      this.topControlIndex = topControlHit.index;
      this.focus = 'top-controls';
      this.handleMenuAction(topControlHit.id);
      return;
    }
    const menuHit = this.menuBounds.find((bounds) => this.pointInBounds(x, y, bounds));
    if (menuHit) {
      this.menuIndex = menuHit.index;
      this.focus = 'menu';
      this.handleMenuAction(menuHit.id);
      return;
    }
    if (this.playButtonBounds && this.pointInBounds(x, y, this.playButtonBounds)) {
      this.focus = 'transport';
      this.handleMenuAction('play-toggle');
      return;
    }
    if (this.gridBounds && this.pointInBounds(x, y, this.gridBounds)) {
      const cell = this.getGridCell(x, y);
      if (cell) {
        this.cursor = { row: cell.row, col: cell.col };
        this.toggleNote(cell.row, cell.col);
        this.focus = 'grid';
      }
    }
  }

  toggleNote(row, col) {
    const instrument = this.activeInstruments[this.instrumentIndex];
    if (!instrument) return;
    instrument.notes[row][col] = !instrument.notes[row][col];
  }

  handleMenuAction(action) {
    if (!action) return;
    const song = this.songs[this.songIndex];
    if (!song) return;
    if (action === 'song-add') {
      const nextIndex = this.songs.length + 1;
      this.songs.push({
        name: `New Song ${nextIndex}`,
        tempo: 120,
        key: 0,
        moodIndex: 0,
        progression: MOOD_PRESETS[0].progression
      });
      this.songIndex = this.songs.length - 1;
      return;
    }
    if (action === 'song-remove') {
      if (this.songs.length > 1) {
        this.songs.splice(this.songIndex, 1);
        this.songIndex = clamp(this.songIndex, 0, this.songs.length - 1);
      }
      return;
    }
    if (action === 'tempo-up') {
      song.tempo = clamp(song.tempo + 5, 40, 240);
      return;
    }
    if (action === 'tempo-down') {
      song.tempo = clamp(song.tempo - 5, 40, 240);
      return;
    }
    if (action === 'instrument-add') {
      this.instrumentPickerItems = this.buildInstrumentPickerItems();
      const firstInstrument = this.instrumentPickerItems.findIndex((item) => item.type === 'instrument');
      this.instrumentPickerIndex = Math.max(0, firstInstrument);
      this.instrumentPickerOpen = true;
      this.focus = 'instrument-picker';
      return;
    }
    if (action === 'instrument-remove') {
      if (this.activeInstruments.length > 1) {
        this.activeInstruments.splice(this.instrumentIndex, 1);
        this.instrumentIndex = clamp(this.instrumentIndex, 0, this.activeInstruments.length - 1);
      }
      return;
    }
    if (action === 'loop-toggle') {
      this.loopEnabled = !this.loopEnabled;
      this.loopBar = Math.floor(this.cursor.col / this.colsPerBar);
      return;
    }
    if (action === 'loop-add') {
      this.loopBars = clamp(this.loopBars + 1, 1, Math.floor(this.cols / this.colsPerBar));
      this.loopEnabled = true;
      return;
    }
    if (action === 'loop-remove') {
      this.loopBars = clamp(this.loopBars - 1, 1, Math.floor(this.cols / this.colsPerBar));
      this.loopEnabled = true;
      return;
    }
    if (action === 'play-toggle') {
      this.isPlaying = !this.isPlaying;
      return;
    }
    if (action === 'generate') {
      const nextMood = (song.moodIndex + 1) % MOOD_PRESETS.length;
      song.moodIndex = nextMood;
      const preset = MOOD_PRESETS[nextMood];
      song.progression = preset.progression;
      this.applyGeneratedPattern(song, preset);
    }
  }

  applyGeneratedPattern(song, preset) {
    const instrument = this.activeInstruments[this.instrumentIndex];
    if (!instrument) return;
    const grid = instrument.notes;
    grid.forEach((row) => row.fill(false));
    const root = song.key;
    const stepPattern = preset.progression.map((degree) => degreeToSemitone[degree] ?? 0);
    for (let bar = 0; bar < 4; bar += 1) {
      const baseCol = bar * this.colsPerBar;
      const semitone = (root + stepPattern[bar % stepPattern.length]) % 12;
      const row = (this.rows - 1) - semitone;
      for (let step = 0; step < this.colsPerBar; step += 1) {
        grid[row][baseCol + step] = true;
      }
    }
  }

  analyzeHarmony() {
    const song = this.songs[this.songIndex];
    if (!song) return null;
    const preset = MOOD_PRESETS[song.moodIndex] || MOOD_PRESETS[0];
    const noteCounts = Array(this.rows).fill(0);
    this.activeInstruments.forEach((instrument, idx) => {
      if (idx === this.instrumentIndex) return;
      instrument.notes.forEach((rowNotes, row) => {
        rowNotes.forEach((active) => {
          if (active) noteCounts[row] += 1;
        });
      });
    });
    const strongest = noteCounts.reduce((best, count, row) => (count > best.count ? { row, count } : best), {
      row: song.key,
      count: 0
    });
    const root = strongest.count === 0 ? song.key : (this.rows - 1) - strongest.row;
    const thirdInterval = preset.mode === 'major' ? 4 : 3;
    const third = (root + thirdInterval) % 12;
    const fifth = (root + 7) % 12;
    return { root, chord: [root, third, fifth], progression: song.progression };
  }

  pointInBounds(x, y, bounds) {
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  getGridCell(x, y) {
    if (!this.gridBounds) return null;
    const { x: startX, y: startY, cellSize } = this.gridBounds;
    const col = Math.floor((x - startX) / cellSize);
    const row = Math.floor((y - startY) / cellSize);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return { row, col };
  }

  draw(ctx, width, height) {
    const song = this.songs[this.songIndex];
    ctx.save();
    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = '24px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('MIDI Music Composer', 24, 40);

    const leftWidth = 240;
    const topHeight = 120;
    const panelX = 20;
    const panelY = 70;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(panelX, panelY, leftWidth, height - panelY - 20);
    ctx.strokeStyle = this.focus === 'instruments' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX, panelY, leftWidth, height - panelY - 20);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Instruments', panelX + 16, panelY + 28);

    this.instrumentBounds = [];
    this.activeInstruments.forEach((instrument, index) => {
      const y = panelY + 52 + index * 22;
      const isSelected = index === this.instrumentIndex;
      ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.75)';
      ctx.fillText(instrument.name, panelX + 24, y);
      this.instrumentBounds.push({ x: panelX + 12, y: y - 14, w: leftWidth - 24, h: 20, index });
    });

    const topX = leftWidth + 50;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(topX, panelY, width - topX - 20, topHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(topX, panelY, width - topX - 20, topHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText(`Song: ${song?.name || 'Untitled'}`, topX + 20, panelY + 32);
    ctx.font = '14px Courier New';
    ctx.fillText(`Tempo: ${song?.tempo || 120} BPM`, topX + 20, panelY + 58);
    ctx.fillText(
      `Loop: ${this.loopEnabled ? `${this.loopBars} bars` : 'Off'}`,
      topX + 20,
      panelY + 84
    );
    const mood = MOOD_PRESETS[song?.moodIndex || 0];
    ctx.fillText(`Style: ${mood?.label || 'Rock'}`, topX + 240, panelY + 84);
    ctx.fillText(`Playback: ${this.isPlaying ? 'Playing' : 'Stopped'}`, topX + 240, panelY + 32);
    ctx.fillText(`Progression: ${song?.progression?.join(' - ') || 'I - V - vi - IV'}`, topX + 240, panelY + 56);

    const buttonSize = 20;
    const buttonGap = 6;
    const tempoButtonsX = topX + 150;
    const tempoButtonsY = panelY + 44;
    const loopButtonsX = topX + 150;
    const loopButtonsY = panelY + 70;
    this.topControlBounds = [];
    const drawControlButton = (x, y, label, id, index) => {
      const isFocused = this.focus === 'top-controls' && this.topControlIndex === index;
      ctx.fillStyle = isFocused ? 'rgba(255,225,106,0.35)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, buttonSize, buttonSize);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, y, buttonSize, buttonSize);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + buttonSize / 2, y + buttonSize / 2 + 4);
      this.topControlBounds.push({ x, y, w: buttonSize, h: buttonSize, id, index });
    };
    drawControlButton(tempoButtonsX, tempoButtonsY, '-', 'tempo-down', 0);
    drawControlButton(tempoButtonsX + buttonSize + buttonGap, tempoButtonsY, '+', 'tempo-up', 1);
    drawControlButton(loopButtonsX, loopButtonsY, '-', 'loop-remove', 2);
    drawControlButton(loopButtonsX + buttonSize + buttonGap, loopButtonsY, '+', 'loop-add', 3);
    drawControlButton(loopButtonsX + (buttonSize + buttonGap) * 2, loopButtonsY, this.loopEnabled ? 'On' : 'Off', 'loop-toggle', 4);
    ctx.textAlign = 'left';

    this.menuBounds = [];
    const menuX = width - 240;
    const menuY = panelY + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(menuX, menuY, 200, topHeight - 20);
    ctx.strokeStyle = this.focus === 'menu' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(menuX, menuY, 200, topHeight - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Menu', menuX + 12, menuY + 16);

    this.menuItems.forEach((item, index) => {
      const y = menuY + 32 + index * 14;
      const isSelected = index === this.menuIndex;
      ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(item.label, menuX + 12, y);
      this.menuBounds.push({ x: menuX + 8, y: y - 10, w: 180, h: 14, index, id: item.id });
    });

    const gridX = topX + 30;
    const gridY = panelY + topHeight + 30;
    const gridW = width - gridX - 40;
    const gridH = height - gridY - 40;
    const cellSize = Math.min(gridW / this.cols, gridH / this.rows);
    const actualW = cellSize * this.cols;
    const actualH = cellSize * this.rows;

    this.gridBounds = { x: gridX, y: gridY, w: actualW, h: actualH, cellSize };

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(gridX - 50, gridY, actualW + 50, actualH);
    ctx.strokeStyle = this.focus === 'grid' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(gridX - 50, gridY, actualW + 50, actualH);

    const analysis = this.analyzeHarmony();
    this.lastAnalysis = analysis;

    for (let row = 0; row < this.rows; row += 1) {
      const note = NOTE_LABELS[(this.rows - 1 - row) % NOTE_LABELS.length];
      const noteIndex = (this.rows - 1 - row) % 12;
      const isRoot = analysis?.root === noteIndex;
      const isChordTone = analysis?.chord?.includes(noteIndex);
      ctx.fillStyle = isRoot ? '#ffe16a' : isChordTone ? '#8fffb5' : 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      ctx.fillText(note, gridX - 40, gridY + row * cellSize + cellSize * 0.75);
    }

    const instrument = this.activeInstruments[this.instrumentIndex];
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const x = gridX + col * cellSize;
        const y = gridY + row * cellSize;
        const active = instrument?.notes[row][col];
        if (active) {
          ctx.fillStyle = '#4fb7ff';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let col = 0; col <= this.cols; col += 1) {
      const x = gridX + col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(x, gridY + actualH);
      ctx.stroke();
    }
    for (let row = 0; row <= this.rows; row += 1) {
      const y = gridY + row * cellSize;
      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX + actualW, y);
      ctx.stroke();
    }

    if (this.loopEnabled) {
      const loopStart = this.loopBar * this.colsPerBar;
      const maxBars = Math.floor((this.cols - loopStart) / this.colsPerBar);
      const loopBars = clamp(this.loopBars, 1, maxBars || 1);
      const loopX = gridX + loopStart * cellSize;
      ctx.fillStyle = 'rgba(255,225,106,0.12)';
      ctx.fillRect(loopX, gridY, this.colsPerBar * loopBars * cellSize, actualH);
      ctx.strokeStyle = '#ffe16a';
      ctx.strokeRect(loopX, gridY, this.colsPerBar * loopBars * cellSize, actualH);
    }

    ctx.strokeStyle = '#ffe16a';
    ctx.strokeRect(
      gridX + this.cursor.col * cellSize,
      gridY + this.cursor.row * cellSize,
      cellSize,
      cellSize
    );

    const playButtonW = 240;
    const playButtonH = 52;
    const playButtonX = (width - playButtonW) / 2;
    const playButtonY = height - playButtonH - 24;
    this.playButtonBounds = { x: playButtonX, y: playButtonY, w: playButtonW, h: playButtonH };
    ctx.fillStyle = this.focus === 'transport' ? 'rgba(255,225,106,0.35)' : 'rgba(0,0,0,0.7)';
    ctx.fillRect(playButtonX, playButtonY, playButtonW, playButtonH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(playButtonX, playButtonY, playButtonW, playButtonH);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.isPlaying ? 'STOP' : 'PLAY', playButtonX + playButtonW / 2, playButtonY + playButtonH / 2 + 6);
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Courier New';
    ctx.fillText('Scale highlights show roots + chord tones from other instruments.', gridX - 50, gridY + actualH + 24);
    ctx.fillText('D-pad: grid/menu • Enter: toggle notes/menu • Esc: back', 24, height - 14);

    if (this.instrumentPickerOpen) {
      const dialogW = Math.min(420, width - 80);
      const dialogH = Math.min(360, height - 120);
      const dialogX = (width - dialogW) / 2;
      const dialogY = (height - dialogH) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(12,14,18,0.95)';
      ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.fillText('Add Instrument', dialogX + 16, dialogY + 26);

      const listX = dialogX + 16;
      const listY = dialogY + 50;
      const lineHeight = 18;
      const maxVisible = Math.floor((dialogH - 70) / lineHeight);
      const scrollOffset = Math.max(0, this.instrumentPickerIndex - maxVisible + 1);
      this.instrumentPickerBounds = [];
      const visibleItems = this.instrumentPickerItems.slice(scrollOffset, scrollOffset + maxVisible);
      visibleItems.forEach((item, index) => {
        const itemIndex = scrollOffset + index;
        const y = listY + index * lineHeight;
        if (item.type === 'header') {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = '12px Courier New';
          ctx.fillText(item.label.toUpperCase(), listX, y);
          return;
        }
        const isSelected = itemIndex === this.instrumentPickerIndex;
        ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.8)';
        ctx.font = '14px Courier New';
        ctx.fillText(item.label, listX, y);
        this.instrumentPickerBounds.push({
          x: listX,
          y: y - 12,
          w: dialogW - 32,
          h: 16,
          index: itemIndex
        });
      });
    }

    ctx.restore();
  }
}
