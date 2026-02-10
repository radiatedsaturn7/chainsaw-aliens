const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class RecordModeLayout {
  constructor({ touchInput }) {
    this.touchInput = touchInput;
    this.bounds = {
      grid: null,
      instrument: null,
      instrumentButtons: [],
      settingsButtons: []
    };
    this.header = {
      x: 0,
      y: 0,
      rowH: 28,
      rowGap: 10,
      settingsY: 0,
      instrumentY: 0,
      headerH: 0
    };
    this.device = 'auto';
    this.instrument = 'keyboard';
    this.quantizeEnabled = false;
    this.quantizeLabel = '1/16';
    this.countInEnabled = false;
    this.metronomeEnabled = false;
    this.instrumentMenuOpen = false;
    this.instrumentModalBounds = null;
  }

  setDevice(device) {
    this.device = device;
  }

  setInstrument(instrument) {
    this.instrument = instrument;
    if (this.touchInput) {
      this.touchInput.setInstrument(instrument);
    }
  }

  layout(width, height, originX = 0, originY = 0, config = {}) {
    const padding = 16;
    const topBarH = 56;
    const gridGap = 12;
    const gridBounds = config.gridBounds;
    const instrumentBounds = config.instrumentBounds;
    if (gridBounds && instrumentBounds) {
      this.bounds.grid = { ...gridBounds };
      this.bounds.instrument = { ...instrumentBounds };
    } else {
      const availableH = height - padding * 2 - topBarH - gridGap;
      const gridH = Math.round(availableH * 0.42);
      const gridY = originY + padding + topBarH;
      this.bounds.grid = { x: originX + padding, y: gridY, w: width - padding * 2, h: gridH };
      this.bounds.instrument = {
        x: originX + padding,
        y: gridY + gridH + gridGap,
        w: width - padding * 2,
        h: height - (gridY + gridH + gridGap) - padding
      };
    }
    const headerPadding = 12;
    const rowH = clamp(Math.round(this.bounds.instrument.h * 0.08), 36, 48);
    const rowGap = clamp(Math.round(rowH * 0.35), 8, 12);
    const totalW = this.bounds.instrument.w - 24;
    const minButtonW = 90;
    const columns = Math.max(1, Math.floor((totalW + rowGap) / (minButtonW + rowGap)));
    const settingsRows = Math.ceil(7 / columns);
    const settingsBlockH = settingsRows * rowH + Math.max(0, settingsRows - 1) * rowGap;
    const headerH = headerPadding + settingsBlockH + rowGap + rowH;
    this.header = {
      x: this.bounds.instrument.x + 12,
      y: this.bounds.instrument.y + 12,
      rowH,
      rowGap,
      settingsY: this.bounds.instrument.y + 12,
      instrumentY: this.bounds.instrument.y + 12 + settingsBlockH + rowGap,
      headerH
    };
    if (this.touchInput) {
      const touchH = Math.max(0, this.bounds.instrument.h - headerH - 16);
      this.touchInput.setBounds({
        x: this.bounds.instrument.x + 12,
        y: this.bounds.instrument.y + headerH,
        w: this.bounds.instrument.w - 24,
        h: touchH
      });
    }
    return this.bounds;
  }

  draw(ctx, {
    showGamepadHints,
    isPlaying,
    isRecording,
    selector,
    stickIndicators,
    nowPlaying
  }) {
    const { instrument } = this.bounds;
    if (!instrument) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(instrument.x, instrument.y, instrument.w, instrument.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(instrument.x, instrument.y, instrument.w, instrument.h);

    this.drawSettingButtons(ctx, isPlaying, isRecording);

    if (showGamepadHints) {
      this.drawGamepadHints(ctx);
    } else if (this.touchInput) {
      this.touchInput.draw(ctx);
    }

    if (selector) {
      this.drawRadialSelector(ctx, selector);
    }

    this.drawStickIndicators(ctx, stickIndicators);
    this.drawNowPlayingModal(ctx, nowPlaying);
    this.drawInstrumentModal(ctx);

    ctx.restore();
  }

  drawButton(ctx, bounds, label, active) {
    ctx.fillStyle = active ? '#ffe16a' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#111' : '#fff';
    const fontSize = clamp(Math.round(bounds.h * 0.45), 12, 16);
    ctx.font = `${fontSize}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const padding = Math.max(6, Math.round(bounds.h * 0.2));
    const clippedLabel = this.truncateLabel(ctx, label, Math.max(0, bounds.w - padding * 2));
    ctx.fillText(clippedLabel, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  truncateLabel(ctx, label, maxWidth) {
    if (ctx.measureText(label).width <= maxWidth) return label;
    let truncated = label;
    while (truncated.length > 4 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  drawInstrumentButtons(ctx) {
    if (!this.instrumentMenuOpen) {
      this.bounds.instrumentButtons = [];
      return;
    }
    const instruments = ['guitar', 'bass', 'keyboard', 'drums'];
    const gap = 10;
    const totalW = this.instrumentModalBounds?.w ? this.instrumentModalBounds.w - 32 : this.bounds.instrument.w - 24;
    const minButtonW = 96;
    const columns = Math.max(1, Math.floor((totalW + gap) / (minButtonW + gap)));
    const buttonW = Math.max(minButtonW, (totalW - gap * (columns - 1)) / columns);
    const startX = this.instrumentModalBounds?.x ? this.instrumentModalBounds.x + 16 : this.header.x;
    const startY = this.instrumentModalBounds?.y ? this.instrumentModalBounds.y + 54 : this.header.instrumentY;
    this.bounds.instrumentButtons = instruments.map((instrument, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const w = Math.min(buttonW, totalW);
      return ({
        id: instrument,
        label: instrument[0].toUpperCase() + instrument.slice(1),
        x: startX + col * (w + gap),
        y: startY + row * (this.header.rowH + gap),
        w,
        h: this.header.rowH,
        active: this.instrument === instrument
      });
    });
    this.bounds.instrumentButtons.forEach((btn) => {
      this.drawButton(ctx, btn, btn.label, btn.active);
    });
  }

  drawInstrumentModal(ctx) {
    this.instrumentModalBounds = null;
    if (!this.instrumentMenuOpen) return;
    const { instrument } = this.bounds;
    if (!instrument) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(instrument.x, instrument.y, instrument.w, instrument.h);

    const modalW = Math.min(520, instrument.w - 24);
    const instruments = ['guitar', 'bass', 'keyboard', 'drums'];
    const gap = 10;
    const minButtonW = 96;
    const columns = Math.max(1, Math.floor((modalW - 32 + gap) / (minButtonW + gap)));
    const rows = Math.ceil(instruments.length / columns);
    const titleH = 34;
    const modalContentH = titleH + rows * this.header.rowH + Math.max(0, rows - 1) * gap + 16;
    const modalH = Math.min(instrument.h - 24, Math.max(150, modalContentH));
    const modalX = instrument.x + (instrument.w - modalW) / 2;
    const modalY = instrument.y + (instrument.h - modalH) / 2;
    this.instrumentModalBounds = { x: modalX, y: modalY, w: modalW, h: modalH };
    ctx.fillStyle = 'rgba(12,14,18,0.96)';
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(modalX, modalY, modalW, modalH);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Virtual Instruments', modalX + 16, modalY + 28);

    this.drawInstrumentButtons(ctx);
    ctx.restore();
  }

  drawSettingButtons(ctx, isPlaying, isRecording) {
    const gap = 10;
    const totalW = this.bounds.instrument.w - 24;
    const minButtonW = 90;
    const columns = Math.max(1, Math.floor((totalW + gap) / (minButtonW + gap)));
    const buttonW = Math.max(minButtonW, (totalW - gap * (columns - 1)) / columns);
    const x = this.header.x;
    const y = this.header.settingsY;
    this.bounds.settingsButtons = [
      {
        id: 'quantize',
        label: this.quantizeEnabled ? `Quant ${this.quantizeLabel}` : 'Quant Off',
        x,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: this.quantizeEnabled
      },
      {
        id: 'countin',
        label: this.countInEnabled ? 'Count-in On' : 'Count-in Off',
        x: x + (buttonW + gap),
        y,
        w: buttonW,
        h: this.header.rowH,
        active: this.countInEnabled
      },
      {
        id: 'metronome',
        label: this.metronomeEnabled ? 'Click On' : 'Click Off',
        x: x + (buttonW + gap) * 2,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: this.metronomeEnabled
      },
      {
        id: 'virtual',
        label: 'Virtual Instruments',
        x: x + (buttonW + gap) * 3,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: this.instrumentMenuOpen
      },
      {
        id: 'record-toggle',
        label: '●',
        x: x + (buttonW + gap) * 4,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: isRecording
      },
      {
        id: 'playback-play',
        label: isPlaying ? '❚❚' : '▶',
        x: x + (buttonW + gap) * 5,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: isPlaying
      },
      {
        id: 'playback-stop',
        label: '⏹',
        x: x + (buttonW + gap) * 6,
        y,
        w: buttonW,
        h: this.header.rowH,
        active: false
      }
    ];
    this.bounds.settingsButtons = this.bounds.settingsButtons.map((button, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        ...button,
        x: x + col * (buttonW + gap),
        y: y + row * (this.header.rowH + gap)
      };
    });
    this.bounds.settingsButtons.forEach((btn) => {
      this.drawButton(ctx, btn, btn.label, btn.active);
    });
  }

  drawGamepadHints(ctx) {
    const { instrument } = this.bounds;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(instrument.x + 12, instrument.y + 70, instrument.w - 24, instrument.h - 90);
    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    const lines = this.instrument === 'drums'
      ? [
        'LT: Kick  RB: Closed Hat  RT: Open Hat',
        'A: Snare  X: Low Tom  Y: Mid Tom  B: High Tom',
        'D-Pad Up: Crash  Down: Ride  Left/Right: Cymbals'
      ]
      : [
        'Left Stick: set root note (silent)',
        'D-Pad Right: toggle note/chord  Left (hold): sharps/mods',
        'A: 1  A+LB:2  X:3  X+LB:4',
        'Y:5  Y+LB:6  B+LB:7  B:8',
        'LB+A: sus2  LB+X: sus4  LB+Y: diatonic 7  LB+B: add9',
        'D-Left+A: dim  D-Left+X: m7♭5  D-Left+Y: aug  D-Left+B: 7♭9/7♯9',
        'LB+D-Left+A: m6  LB+D-Left+X: dim7',
        'LB+D-Left+Y: aug maj7  LB+D-Left+B: m9♭5',
        'RB: octave up  LT: sustain  RT: volume',
        'Right Stick: pitch bend (± whole tone)',
        'L3: scale selector  R3: root selector'
      ];
    lines.forEach((line, index) => {
      ctx.fillText(line, instrument.x + 24, instrument.y + 100 + index * 20);
    });
  }

  drawStickIndicators(ctx, stickIndicators) {
    if (!stickIndicators) return;
    const { instrument } = this.bounds;
    if (!instrument) return;
    const radius = 26;
    const insetX = 80;
    const baseY = instrument.y + instrument.h - 80;
    const leftX = instrument.x + insetX;
    const rightX = instrument.x + instrument.w - insetX;
    const directionMarkers = [
      { id: 1, angle: 270 },
      { id: 2, angle: 315 },
      { id: 3, angle: 0 },
      { id: 4, angle: 45 },
      { id: 5, angle: 90 },
      { id: 6, angle: 135 },
      { id: 7, angle: 180 },
      { id: 8, angle: 225 }
    ];
    const drawStick = (centerX, centerY, stick, label, options = {}) => {
      if (!stick?.active) return;
      const knobX = centerX + clamp(stick.x, -1, 1) * radius * 0.6;
      const knobY = centerY + clamp(stick.y, -1, 1) * radius * 0.6;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffe16a';
      ctx.beginPath();
      ctx.arc(knobX, knobY, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(label, centerX, centerY + radius + 18);
      if (options.showDirections) {
        const labelRadius = radius + 16;
        ctx.font = '11px Courier New';
        directionMarkers.forEach((marker) => {
          const angle = (marker.angle * Math.PI) / 180;
          const dx = Math.cos(angle) * labelRadius;
          const dy = Math.sin(angle) * labelRadius;
          ctx.fillStyle = marker.id === stick.degree ? '#ffe16a' : '#fff';
          ctx.fillText(String(marker.id), centerX + dx, centerY + dy + 4);
        });
      }
      if (stick.noteLabel) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px Courier New';
        const degreeLabel = stick.degree ? `${stick.degree}: ` : '';
        ctx.fillText(`${degreeLabel}${stick.noteLabel}`, centerX, centerY + radius + 34);
      }
      ctx.restore();
    };
    drawStick(leftX, baseY, stickIndicators.left, 'Left Stick', { showDirections: true });
    drawStick(rightX, baseY, stickIndicators.right, 'Right Stick');

    const bend = stickIndicators.bend;
    if (bend?.active) {
      const meterW = Math.min(280, instrument.w * 0.45);
      const meterH = 10;
      const meterX = instrument.x + (instrument.w - meterW) / 2;
      const meterY = baseY - 50;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(meterX, meterY, meterW, meterH);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(meterX, meterY, meterW, meterH);
      const stepCount = 4;
      const totalSteps = stepCount * 0.5;
      for (let i = -stepCount; i <= stepCount; i += 1) {
        const step = i * 0.5;
        const ratio = (step + totalSteps) / (totalSteps * 2);
        const tickX = meterX + ratio * meterW;
        const isMajor = i % 2 === 0;
        const tickH = isMajor ? 10 : 6;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(tickX, meterY - tickH);
        ctx.lineTo(tickX, meterY);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(step.toFixed(1), tickX, meterY - tickH - 2);
      }
      const clamped = clamp(bend.semitones, -2, 2);
      const knobRatio = (clamped + 2) / 4;
      const knobX = meterX + knobRatio * meterW;
      ctx.fillStyle = '#ffe16a';
      ctx.beginPath();
      ctx.arc(knobX, meterY + meterH / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      const bendLabel = `${bend.baseLabel} → ${bend.targetLabel} (${bend.displaySemitones >= 0 ? '+' : ''}${bend.displaySemitones} st)`;
      ctx.fillText(bendLabel, meterX + meterW / 2, meterY + meterH + 18);
      ctx.restore();
    }
  }

  drawNowPlayingModal(ctx, nowPlaying) {
    if (!nowPlaying?.active) return;
    const { instrument } = this.bounds;
    if (!instrument) return;
    const modalW = Math.min(520, instrument.w - 40);
    const modalH = 130;
    const modalX = instrument.x + (instrument.w - modalW) / 2;
    const modalY = instrument.y + (instrument.h - modalH) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX, modalY, modalW, modalH);
    ctx.fillStyle = '#ffe16a';
    ctx.font = '28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(nowPlaying.label, modalX + modalW / 2, modalY + 52);
    if (nowPlaying.detail) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.fillText(nowPlaying.detail, modalX + modalW / 2, modalY + 88);
    }
    ctx.restore();
  }

  drawRadialSelector(ctx, selector) {
    const { instrument } = this.bounds;
    const items = selector.items || [];
    if (!instrument || !items.length) return;
    const centerX = instrument.x + instrument.w / 2;
    const centerY = instrument.y + instrument.h / 2 + 10;
    const radius = Math.min(instrument.w, instrument.h) * 0.22;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(instrument.x + 12, instrument.y + 12, instrument.w - 24, instrument.h - 24);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(selector.title || 'Selector', centerX, instrument.y + 42);

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    const step = (Math.PI * 2) / items.length;
    items.forEach((label, index) => {
      const angle = index * step - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const isActive = index === selector.index;
      ctx.fillStyle = isActive ? '#ffe16a' : '#fff';
      ctx.font = isActive ? '14px Courier New' : '12px Courier New';
      ctx.fillText(label, x, y + 4);
    });
    ctx.restore();
  }

  handlePointerDown(payload) {
    const { x, y } = payload;
    const hitInstrument = this.bounds.instrumentButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitInstrument) {
      this.setInstrument(hitInstrument.id);
      this.instrumentMenuOpen = false;
      this.instrumentModalBounds = null;
      this.bounds.instrumentButtons = [];
      return { type: 'instrument', value: hitInstrument.id };
    }
    if (this.instrumentMenuOpen && this.instrumentModalBounds && !this.pointInBounds(x, y, this.instrumentModalBounds)) {
      this.instrumentMenuOpen = false;
      this.instrumentModalBounds = null;
      this.bounds.instrumentButtons = [];
      return { type: 'instrument-dismiss' };
    }
    const hitSetting = this.bounds.settingsButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitSetting) {
      if (hitSetting.id === 'quantize') {
        this.quantizeEnabled = !this.quantizeEnabled;
      }
      if (hitSetting.id === 'countin') {
        this.countInEnabled = !this.countInEnabled;
      }
      if (hitSetting.id === 'metronome') {
        this.metronomeEnabled = !this.metronomeEnabled;
      }
      if (hitSetting.id === 'virtual') {
        this.instrumentMenuOpen = !this.instrumentMenuOpen;
      }
      if (!this.instrumentMenuOpen) {
        this.instrumentModalBounds = null;
        this.bounds.instrumentButtons = [];
      }
      if (hitSetting.id === 'playback-play') {
        return { type: 'playback-play' };
      }
      if (hitSetting.id === 'playback-stop') {
        return { type: 'playback-stop' };
      }
      if (hitSetting.id === 'record-toggle') {
        return { type: 'record-toggle' };
      }
      return { type: hitSetting.id, value: hitSetting.active };
    }

    if (this.touchInput && this.device !== 'gamepad'
      && this.bounds.instrument && this.pointInBounds(x, y, this.bounds.instrument)) {
      this.touchInput.handlePointerDown(payload);
      return { type: 'touch' };
    }
    return null;
  }

  handlePointerMove(payload) {
    if (this.touchInput) {
      this.touchInput.handlePointerMove(payload);
    }
  }

  handlePointerUp(payload) {
    if (this.touchInput) {
      this.touchInput.handlePointerUp(payload);
    }
  }

  pointInBounds(x, y, bounds) {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }
}
