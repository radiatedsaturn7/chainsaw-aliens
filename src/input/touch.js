const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const DRUM_MAP = [
  { label: 'Kick', pitch: 36 },
  { label: 'Snare', pitch: 38 },
  { label: 'Hat', pitch: 42 },
  { label: 'Open', pitch: 46 },
  { label: 'Low Tom', pitch: 45 },
  { label: 'Mid Tom', pitch: 47 },
  { label: 'High Tom', pitch: 50 },
  { label: 'Crash', pitch: 49 },
  { label: 'Ride', pitch: 51 }
];

export default class TouchInput {
  constructor(bus) {
    this.bus = bus;
    this.instrument = 'keyboard';
    this.bounds = null;
    this.activeTouches = new Map();
    this.activeFrets = new Map();
    this.activeStrums = new Map();
    this.activeStrings = new Map();
    this.stringNoteTimers = new Map();
    this.keyRects = [];
    this.drumPads = [];
    this.stringRects = [];
    this.reverseStrings = false;
    this.stringLayout = null;
    this.stringVibrations = new Map();
  }

  setInstrument(instrument) {
    if (this.instrument !== instrument) {
      this.releaseAllNotes();
    }
    this.instrument = instrument;
    if (this.bounds) {
      this.computeLayout(this.bounds);
    }
  }

  setBounds(bounds) {
    this.bounds = bounds;
    this.computeLayout(bounds);
  }

  setReverseStrings(value) {
    this.reverseStrings = Boolean(value);
    if (this.bounds) {
      this.computeLayout(this.bounds);
    }
  }

  computeLayout(bounds) {
    if (!bounds) return;
    if (this.instrument === 'drums') {
      this.computeDrumLayout(bounds);
    } else if (this.instrument === 'guitar' || this.instrument === 'bass') {
      this.computeStringLayout(bounds);
    } else {
      this.computeKeyboardLayout(bounds);
    }
  }

  computeKeyboardLayout(bounds) {
    const whiteKeys = 14;
    const keyW = bounds.w / whiteKeys;
    const keyH = bounds.h * 0.98;
    const blackKeyW = keyW * 0.6;
    const blackKeyH = bounds.h * 0.6;
    const basePitch = 60;
    const whiteOffsets = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    const blackLayout = [
      { index: 0.7, pitch: 1 },
      { index: 1.7, pitch: 3 },
      { index: 3.7, pitch: 6 },
      { index: 4.7, pitch: 8 },
      { index: 5.7, pitch: 10 },
      { index: 7.7, pitch: 13 },
      { index: 8.7, pitch: 15 },
      { index: 10.7, pitch: 18 },
      { index: 11.7, pitch: 20 },
      { index: 12.7, pitch: 22 }
    ];

    this.keyRects = [];
    whiteOffsets.forEach((offset, i) => {
      this.keyRects.push({
        pitch: basePitch + offset,
        x: bounds.x + i * keyW,
        y: bounds.y + bounds.h - keyH,
        w: keyW,
        h: keyH,
        black: false
      });
    });
    blackLayout.forEach((entry) => {
      this.keyRects.push({
        pitch: basePitch + entry.pitch,
        x: bounds.x + entry.index * keyW - blackKeyW / 2,
        y: bounds.y + bounds.h - keyH,
        w: blackKeyW,
        h: blackKeyH,
        black: true
      });
    });
  }

  computeDrumLayout(bounds) {
    const cols = 3;
    const rows = 3;
    const padW = bounds.w / cols;
    const padH = bounds.h / rows;
    const padGap = 4;
    this.drumPads = DRUM_MAP.map((pad, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...pad,
        x: bounds.x + col * padW + padGap,
        y: bounds.y + row * padH + padGap,
        w: padW - padGap * 2,
        h: padH - padGap * 2
      };
    });
  }

  computeStringLayout(bounds) {
    const stringCount = this.instrument === 'bass' ? 4 : 6;
    const fretCount = 12;
    const stringGap = bounds.h / (stringCount + 1);
    const labelW = Math.min(44, bounds.w * 0.12);
    const boardPadding = 8;
    const boardX = bounds.x + labelW + boardPadding;
    const boardW = bounds.w - labelW - boardPadding * 2;
    const fretW = boardW / fretCount;
    const headX = bounds.x + labelW;
    const headW = Math.max(12, boardX - headX);
    const tuningLowToHigh = this.instrument === 'bass'
      ? [28, 33, 38, 43]
      : [40, 45, 50, 55, 59, 64];
    const tuning = this.reverseStrings ? tuningLowToHigh : [...tuningLowToHigh].reverse();
    this.stringRects = [];
    this.stringLayout = {
      stringCount,
      fretCount,
      stringGap,
      fretW,
      labelW,
      boardX,
      boardW,
      headX,
      headW,
      strumZone: {
        x: boardX + boardW * 0.72,
        y: bounds.y,
        w: Math.max(44, boardW * 0.28),
        h: bounds.h
      },
      tuning
    };
    tuning.forEach((basePitch, stringIndex) => {
      const y = bounds.y + (stringIndex + 1) * stringGap;
      this.stringRects.push({
        pitch: basePitch,
        stringIndex,
        fret: 0,
        x: headX,
        y: y - stringGap * 0.35,
        w: headW,
        h: stringGap * 0.7,
        open: true
      });
      for (let fret = 0; fret < fretCount; fret += 1) {
        this.stringRects.push({
          pitch: basePitch + fret,
          stringIndex,
          fret,
          x: boardX + fret * fretW,
          y: y - stringGap * 0.35,
          w: fretW,
          h: stringGap * 0.7
        });
      }
    });
  }

  findHit(x, y) {
    if (!this.bounds) return null;
    if (this.instrument === 'drums') {
      return this.drumPads.find((pad) => x >= pad.x && x <= pad.x + pad.w && y >= pad.y && y <= pad.y + pad.h) || null;
    }
    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      return this.stringRects.find((cell) => x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) || null;
    }
    const black = this.keyRects.filter((key) => key.black);
    const white = this.keyRects.filter((key) => !key.black);
    return black.find((key) => x >= key.x && x <= key.x + key.w && y >= key.y && y <= key.y + key.h)
      || white.find((key) => x >= key.x && x <= key.x + key.w && y >= key.y && y <= key.y + key.h)
      || null;
  }

  handlePointerDown({ x, y, id }) {
    if (!this.bounds) return;
    const pointerId = id ?? 'mouse';
    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      const layout = this.stringLayout;
      if (!layout) return;
      const strumZone = layout.strumZone;
      if (strumZone && x >= strumZone.x && x <= strumZone.x + strumZone.w
        && y >= strumZone.y && y <= strumZone.y + strumZone.h) {
        this.activeStrums.set(pointerId, {
          lastStringIndex: null
        });
        this.handleStrum(pointerId, y);
        return;
      }
      const hit = this.findHit(x, y);
      if (!hit) return;
      this.activeFrets.set(pointerId, { ...hit, time: performance.now() });
      this.updateFrettedNotes(hit.stringIndex);
      return;
    }
    const hit = this.findHit(x, y);
    if (!hit) return;
    const noteId = `touch-${pointerId}-${hit.pitch}-${Date.now()}`;
    this.activeTouches.set(pointerId, { id: noteId, pitch: hit.pitch, hit });
    this.triggerStringVibration(hit);
    this.bus.emit('noteon', {
      id: noteId,
      pitch: hit.pitch,
      velocity: 112,
      source: 'touch'
    });
  }

  handlePointerMove({ x, y, id }) {
    if (!this.bounds) return;
    const pointerId = id ?? 'mouse';
    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      if (this.activeStrums.has(pointerId)) {
        this.handleStrum(pointerId, y);
        return;
      }
      if (!this.activeFrets.has(pointerId)) return;
      const current = this.activeFrets.get(pointerId);
      const hit = this.findHit(x, y);
      if (!hit) return;
      if (hit.stringIndex === current.stringIndex && hit.fret === current.fret) return;
      this.activeFrets.set(pointerId, { ...hit, time: performance.now() });
      this.updateFrettedNotes(hit.stringIndex);
      return;
    }
    if (!this.activeTouches.has(pointerId)) return;
    const current = this.activeTouches.get(pointerId);
    const hit = this.findHit(x, y);
    if (!hit || hit.pitch === current.pitch) return;
    this.bus.emit('noteoff', { id: current.id, source: 'touch' });
    const noteId = `touch-${pointerId}-${hit.pitch}-${Date.now()}`;
    this.activeTouches.set(pointerId, { id: noteId, pitch: hit.pitch, hit });
    this.triggerStringVibration(hit);
    this.bus.emit('noteon', {
      id: noteId,
      pitch: hit.pitch,
      velocity: 112,
      source: 'touch'
    });
  }

  handlePointerUp({ id }) {
    const pointerId = id ?? 'mouse';
    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      if (this.activeStrums.has(pointerId)) {
        this.activeStrums.delete(pointerId);
      }
      if (this.activeFrets.has(pointerId)) {
        const { stringIndex } = this.activeFrets.get(pointerId);
        this.activeFrets.delete(pointerId);
        this.updateFrettedNotes(stringIndex);
        if (!this.hasFretOnString(stringIndex) && this.activeStrings.has(stringIndex)) {
          const openPitch = this.getOpenPitch(stringIndex);
          this.playStringNote(stringIndex, openPitch);
        }
      }
      return;
    }
    const current = this.activeTouches.get(pointerId);
    if (!current) return;
    this.bus.emit('noteoff', { id: current.id, source: 'touch' });
    this.activeTouches.delete(pointerId);
  }

  draw(ctx) {
    if (!this.bounds) return;
    if (this.instrument === 'drums') {
      this.drawDrums(ctx);
      return;
    }
    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      this.drawStrings(ctx);
      return;
    }
    this.drawKeyboard(ctx);
  }

  drawKeyboard(ctx) {
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.fillRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
    const activePitches = new Set(Array.from(this.activeTouches.values()).map((touch) => touch.pitch));
    this.keyRects.filter((key) => !key.black).forEach((key) => {
      ctx.fillStyle = activePitches.has(key.pitch) ? '#ffe16a' : '#f2f2f2';
      ctx.fillRect(key.x, key.y, key.w, key.h);
      ctx.strokeStyle = '#111';
      ctx.strokeRect(key.x, key.y, key.w, key.h);
    });
    this.keyRects.filter((key) => key.black).forEach((key) => {
      ctx.fillStyle = activePitches.has(key.pitch) ? '#ffbf3f' : '#1b1b1b';
      ctx.fillRect(key.x, key.y, key.w, key.h);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(key.x, key.y, key.w, key.h);
    });
    ctx.restore();
  }

  drawDrums(ctx) {
    ctx.save();
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
    const activePitches = new Set(Array.from(this.activeTouches.values()).map((touch) => touch.pitch));
    this.drumPads.forEach((pad) => {
      const active = activePitches.has(pad.pitch);
      ctx.fillStyle = active ? '#ff7676' : '#2a2a2a';
      ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText(pad.label, pad.x + 8, pad.y + 18);
    });
    ctx.restore();
  }

  drawStrings(ctx) {
    ctx.save();
    ctx.fillStyle = '#101010';
    ctx.fillRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
    const activeCells = new Set();
    this.activeTouches.forEach((touch) => {
      if (touch.hit && typeof touch.hit.stringIndex === 'number' && typeof touch.hit.fret === 'number') {
        activeCells.add(`${touch.hit.stringIndex}-${touch.hit.fret}`);
      }
    });
    const layout = this.stringLayout;
    if (!layout) {
      ctx.restore();
      return;
    }
    const {
      stringCount,
      stringGap,
      fretCount,
      fretW,
      labelW,
      boardX,
      boardW,
      tuning,
      headX,
      headW
    } = layout;
    const boardY = this.bounds.y + 6;
    const boardH = this.bounds.h - 12;
    ctx.fillStyle = '#151515';
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(headX, boardY, headW, boardH);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let fret = 0; fret <= fretCount; fret += 1) {
      const x = boardX + fret * fretW;
      ctx.beginPath();
      ctx.moveTo(x, boardY);
      ctx.lineTo(x, boardY + boardH);
      ctx.stroke();
    }
    const markerFrets = [3, 5, 7, 9, 12];
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    markerFrets.forEach((marker) => {
      if (marker > fretCount) return;
      const markerX = boardX + (marker - 0.5) * fretW;
      if (marker === 12) {
        ctx.beginPath();
        ctx.arc(markerX, boardY + boardH * 0.35, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(markerX, boardY + boardH * 0.65, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(markerX, boardY + boardH / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    tuning.forEach((basePitch, stringIndex) => {
      const y = this.bounds.y + (stringIndex + 1) * stringGap;
      const noteName = NOTE_NAMES[basePitch % 12] || 'E';
      const octave = Math.floor(basePitch / 12) - 1;
      ctx.fillText(`${noteName}${octave}`, this.bounds.x + 4, y + 4);
    });
    const now = performance.now();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < stringCount; i += 1) {
      const y = this.bounds.y + (i + 1) * stringGap;
      const thicknessIndex = this.reverseStrings ? (stringCount - 1 - i) : i;
      const baseThickness = 1 + (thicknessIndex / Math.max(1, stringCount - 1)) * 2.6;
      ctx.lineWidth = baseThickness;
      const vibration = this.stringVibrations.get(i);
      let amplitude = 0;
      let pulse = 0;
      if (vibration) {
        const elapsed = (now - vibration.start) / 1000;
        amplitude = vibration.amplitude * Math.exp(-elapsed * 2.1);
        pulse = 0.5 + 0.5 * Math.sin(elapsed * 28);
        if (amplitude < 0.08) {
          this.stringVibrations.delete(i);
          amplitude = 0;
        }
      }
      if (amplitude > 0.02) {
        const bulgeStrength = amplitude * 0.12 * pulse;
        const decay = Math.min(1, amplitude / vibration.amplitude);
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + decay * 0.4})`;
        const segments = 20;
        for (let s = 0; s < segments; s += 1) {
          const startT = s / segments;
          const endT = (s + 1) / segments;
          const x1 = boardX + boardW * startT;
          const x2 = boardX + boardW * endT;
          const tMid = (startT + endT) * 0.5;
          const bulge = Math.pow(Math.sin(Math.PI * tMid), 2);
          ctx.lineWidth = baseThickness + bulge * bulgeStrength;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = baseThickness;
        ctx.beginPath();
        ctx.moveTo(boardX, y);
        ctx.lineTo(boardX + boardW, y);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    this.stringRects.forEach((cell) => {
      const cellId = `${cell.stringIndex}-${cell.fret}`;
      if (!activeCells.has(cellId)) return;
      ctx.fillStyle = 'rgba(255,225,106,0.6)';
      ctx.fillRect(cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4);
    });
    ctx.restore();
  }

  triggerStringVibration(hit) {
    if (!hit || typeof hit.stringIndex !== 'number') return;
    this.stringVibrations.set(hit.stringIndex, {
      start: performance.now(),
      amplitude: 6
    });
  }

  releaseAllNotes() {
    this.activeTouches.forEach((touch) => {
      this.bus.emit('noteoff', { id: touch.id, source: 'touch' });
    });
    this.activeTouches.clear();
    this.activeFrets.clear();
    this.activeStrums.clear();
    this.activeStrings.forEach((note) => {
      this.bus.emit('noteoff', { id: note.id, source: 'touch' });
    });
    this.activeStrings.clear();
    this.stringNoteTimers.forEach((timer) => clearTimeout(timer));
    this.stringNoteTimers.clear();
  }

  getOpenPitch(stringIndex) {
    const layout = this.stringLayout;
    if (!layout) return null;
    return layout.tuning[stringIndex];
  }

  hasFretOnString(stringIndex) {
    for (const fret of this.activeFrets.values()) {
      if (fret.stringIndex === stringIndex) return true;
    }
    return false;
  }

  getFrettedNoteForString(stringIndex) {
    let selected = null;
    this.activeFrets.forEach((fret) => {
      if (fret.stringIndex !== stringIndex) return;
      if (!selected || fret.fret > selected.fret) {
        selected = fret;
      }
    });
    return selected;
  }

  getFrettedPitch(stringIndex) {
    const selected = this.getFrettedNoteForString(stringIndex);
    return selected ? selected.pitch : null;
  }

  updateFrettedNotes(stringIndex) {
    const layout = this.stringLayout;
    if (!layout) return;
    if (!this.hasFretOnString(stringIndex)) {
      return;
    }
    if (this.activeStrings.has(stringIndex)) {
      const pitch = this.getFrettedPitch(stringIndex);
      if (pitch) {
        this.playStringNote(stringIndex, pitch);
      }
    }
  }

  handleStrum(pointerId, y) {
    const layout = this.stringLayout;
    if (!layout) return;
    const stringIndex = Math.min(
      layout.stringCount - 1,
      Math.max(0, Math.floor((y - this.bounds.y) / layout.stringGap))
    );
    const strum = this.activeStrums.get(pointerId);
    if (!strum) return;
    if (strum.lastStringIndex === stringIndex) return;
    strum.lastStringIndex = stringIndex;
    const frettedPitch = this.getFrettedPitch(stringIndex);
    const pitch = frettedPitch ?? this.getOpenPitch(stringIndex);
    if (pitch == null) return;
    this.playStringNote(stringIndex, pitch);
  }

  playStringNote(stringIndex, pitch) {
    if (pitch == null) return;
    const existing = this.activeStrings.get(stringIndex);
    if (existing) {
      this.bus.emit('noteoff', { id: existing.id, source: 'touch' });
      if (this.stringNoteTimers.has(existing.id)) {
        clearTimeout(this.stringNoteTimers.get(existing.id));
        this.stringNoteTimers.delete(existing.id);
      }
    }
    const noteId = `touch-string-${stringIndex}-${pitch}-${Date.now()}`;
    this.activeStrings.set(stringIndex, { id: noteId, pitch });
    this.triggerStringVibration({ stringIndex });
    this.bus.emit('noteon', {
      id: noteId,
      pitch,
      velocity: 112,
      source: 'touch'
    });
    const durationMs = this.instrument === 'bass' ? 900 : 1100;
    const timer = setTimeout(() => {
      this.bus.emit('noteoff', { id: noteId, source: 'touch' });
      if (this.activeStrings.get(stringIndex)?.id === noteId) {
        this.activeStrings.delete(stringIndex);
      }
      this.stringNoteTimers.delete(noteId);
    }, durationMs);
    this.stringNoteTimers.set(noteId, timer);
  }
}
