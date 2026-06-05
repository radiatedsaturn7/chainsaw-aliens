const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_CHOICES = Array.from({ length: 72 }, (_, index) => index + 24);
const OCTAVE_CHOICES = Array.from({ length: 8 }, (_, index) => index);

const formatPitchLabel = (pitch) => {
  const normalized = Math.round(Number(pitch) || 0);
  const note = NOTE_NAMES[((normalized % 12) + 12) % 12];
  const octave = Math.floor(normalized / 12) - 1;
  return `${note}${octave}`;
};

export default class RecordModeLayout {
  constructor({ touchInput }) {
    this.touchInput = touchInput;
    this.bounds = {
      grid: null,
      instrument: null,
      controlRail: null,
      performanceArea: null,
      instrumentButtons: [],
      instrumentConfigButtons: [],
      instrumentDropdownItems: [],
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
    this.availableInstruments = ['guitar', 'bass', 'keyboard', 'drums'];
    this.instrumentSettings = {
      guitarTuning: [40, 45, 50, 55, 59, 64],
      bassTuning: [28, 33, 38, 43],
      keyboardStartOctave: 4
    };
    this.instrumentDropdown = null;
    this.hideInstrumentConfig = false;
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

  setAvailableInstruments(instruments = []) {
    const valid = Array.isArray(instruments) && instruments.length ? instruments : ['guitar', 'bass', 'keyboard', 'drums'];
    this.availableInstruments = [...new Set(valid)];
    if (!this.availableInstruments.includes(this.instrument)) {
      this.setInstrument(this.availableInstruments[0]);
    }
  }

  setInstrumentSettings(settings = {}) {
    const sanitizeTuning = (value, fallback) => fallback.map((fallbackPitch, index) => {
      const pitch = Number(value?.[index]);
      return Number.isFinite(pitch) ? clamp(Math.round(pitch), 0, 127) : fallbackPitch;
    });
    this.instrumentSettings = {
      guitarTuning: sanitizeTuning(settings.guitarTuning, [40, 45, 50, 55, 59, 64]),
      bassTuning: sanitizeTuning(settings.bassTuning, [28, 33, 38, 43]),
      keyboardStartOctave: Number.isFinite(Number(settings.keyboardStartOctave))
        ? clamp(Math.round(Number(settings.keyboardStartOctave)), 0, 7)
        : 4
    };
  }

  layout(width, height, originX = 0, originY = 0, config = {}) {
    const padding = 16;
    const topBarH = 56;
    const gridGap = 12;
    const gridBounds = config.gridBounds;
    const instrumentBounds = config.instrumentBounds;
    const controlRailBounds = config.controlRailBounds;
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
    const rowH = clamp(Math.round(this.bounds.instrument.h * 0.08), 36, 48);
    const rowGap = clamp(Math.round(rowH * 0.28), 8, 12);
    const railPadding = 12;
    const fallbackInnerW = clamp(Math.round(this.bounds.instrument.w * 0.22), 110, 180);
    const fallbackRailW = fallbackInnerW + railPadding * 2;
    const fallbackRailX = this.bounds.instrument.x + this.bounds.instrument.w - fallbackRailW - 12;
    const fallbackRailY = this.bounds.instrument.y + 12;
    const fallbackRailH = this.bounds.instrument.h - 24;
    const railX = controlRailBounds?.x ?? fallbackRailX;
    const railY = controlRailBounds?.y ?? fallbackRailY;
    const railW = controlRailBounds?.w ?? fallbackRailW;
    const railH = controlRailBounds?.h ?? fallbackRailH;
    const railInnerW = Math.max(80, railW - railPadding * 2);
    const touchAreaPadding = 12;
    const touchX = this.bounds.instrument.x + touchAreaPadding;
    const touchY = this.bounds.instrument.y + touchAreaPadding;
    const touchW = this.bounds.instrument.w - touchAreaPadding * 2;
    const touchH = this.bounds.instrument.h - touchAreaPadding * 2;
    this.bounds.controlRail = {
      x: railX,
      y: railY,
      w: railW,
      h: railH,
      buttonW: railInnerW,
      buttonGap: rowGap,
      padding: railPadding
    };
    this.bounds.performanceArea = {
      x: touchX,
      y: touchY,
      w: touchW,
      h: touchH
    };
    this.header = {
      x: railX + railPadding,
      y: railY + railPadding,
      rowH,
      rowGap,
      settingsY: railY + railPadding,
      instrumentY: railY + railPadding,
      headerH: railH
    };
    if (this.touchInput) {
      this.touchInput.setBounds({
        x: touchX,
        y: touchY,
        w: touchW,
        h: touchH
      }, config.touchDensity || {});
    }
    return this.bounds;
  }

  draw(ctx, {
    showGamepadHints,
    isPlaying,
    isRecording,
    selector,
    stickIndicators,
    nowPlaying,
    nowPlayingPlacement = 'instrument',
    showSettingsRail = true,
    hideInstrumentConfig = false
  }) {
    const { instrument } = this.bounds;
    if (!instrument) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(instrument.x, instrument.y, instrument.w, instrument.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(instrument.x, instrument.y, instrument.w, instrument.h);

    if (showSettingsRail) {
      this.drawSettingButtons(ctx, isPlaying, isRecording);
    } else {
      this.bounds.settingsButtons = [];
    }

    if (showGamepadHints) {
      this.drawGamepadHints(ctx);
    } else if (this.touchInput) {
      this.touchInput.draw(ctx);
    }

    if (selector) {
      this.drawRadialSelector(ctx, selector);
    }

    this.hideInstrumentConfig = hideInstrumentConfig;
    this.drawStickIndicators(ctx, stickIndicators);
    this.drawNowPlayingModal(ctx, nowPlaying, nowPlayingPlacement);
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
    const instruments = this.availableInstruments;
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

  drawInstrumentConfig(ctx, modalX, modalY, modalW, startY) {
    this.bounds.instrumentConfigButtons = [];
    this.bounds.instrumentDropdownItems = [];
    if (this.hideInstrumentConfig) {
      this.instrumentDropdown = null;
      return;
    }
    const configX = modalX + 16;
    const configW = modalW - 32;
    const rowH = Math.max(30, Math.min(38, this.header.rowH));
    const gap = 8;
    let y = startY;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '12px Courier New';
    ctx.fillText('Setup', configX, y + 13);
    y += 20;

    const drawConfigButton = (id, label, value, x, buttonY, w, options = {}) => {
      const bounds = { id, x, y: buttonY, w, h: rowH, ...options };
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, buttonY, w, rowH);
      ctx.strokeStyle = this.instrumentDropdown?.id === id ? '#ffe16a' : 'rgba(255,255,255,0.25)';
      ctx.strokeRect(x, buttonY, w, rowH);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 8, buttonY + 11);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Courier New';
      ctx.fillText(value, x + 8, buttonY + rowH - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'right';
      ctx.fillText('v', x + w - 8, buttonY + rowH - 11);
      ctx.textAlign = 'left';
      this.bounds.instrumentConfigButtons.push(bounds);
    };

    if (this.instrument === 'keyboard') {
      drawConfigButton(
        'keyboard-octave',
        'Start Octave',
        `C${this.instrumentSettings.keyboardStartOctave}`,
        configX,
        y,
        Math.min(180, configW),
        { kind: 'keyboard-octave' }
      );
      y += rowH + gap;
    }

    if (this.instrument === 'guitar' || this.instrument === 'bass') {
      const tuning = this.instrument === 'bass'
        ? this.instrumentSettings.bassTuning
        : this.instrumentSettings.guitarTuning;
      const columns = this.instrument === 'bass' ? 4 : 3;
      const buttonW = (configW - gap * (columns - 1)) / columns;
      tuning.forEach((pitch, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        drawConfigButton(
          `string-${index}`,
          `String ${index + 1}`,
          formatPitchLabel(pitch),
          configX + col * (buttonW + gap),
          y + row * (rowH + gap),
          buttonW,
          {
            kind: 'string-tuning',
            instrument: this.instrument,
            stringIndex: index
          }
        );
      });
      y += Math.ceil(tuning.length / columns) * (rowH + gap);
      const resetBounds = {
        id: 'standard-tuning',
        x: configX,
        y,
        w: Math.min(180, configW),
        h: rowH,
        kind: 'standard-tuning',
        instrument: this.instrument
      };
      this.drawButton(ctx, resetBounds, 'Reset Standard', false);
      this.bounds.instrumentConfigButtons.push(resetBounds);
      y += rowH + gap;
    }

    this.drawInstrumentDropdown(ctx);
  }

  drawInstrumentDropdown(ctx) {
    if (!this.instrumentDropdown) return;
    const source = this.instrumentDropdown;
    const anchor = this.bounds.instrumentConfigButtons.find((button) => button.id === source.id);
    if (!anchor || !this.instrumentModalBounds) return;
    const choices = source.kind === 'keyboard-octave' ? OCTAVE_CHOICES : NOTE_CHOICES;
    const itemH = source.kind === 'keyboard-octave' ? 28 : 26;
    const itemW = source.kind === 'keyboard-octave' ? 58 : 48;
    const maxColumns = source.kind === 'keyboard-octave' ? 4 : 8;
    const availableW = Math.max(itemW, (this.instrumentModalBounds?.w || 0) - 32);
    const columns = Math.max(1, Math.min(maxColumns, Math.floor(availableW / itemW)));
    const listW = columns * itemW;
    const rows = Math.ceil(choices.length / columns);
    const listH = rows * itemH;
    const modal = this.instrumentModalBounds;
    const x = clamp(anchor.x, modal.x + 10, modal.x + modal.w - listW - 10);
    const y = clamp(anchor.y + anchor.h + 4, modal.y + 44, modal.y + modal.h - listH - 10);
    ctx.save();
    ctx.fillStyle = 'rgba(7,8,10,0.98)';
    ctx.fillRect(x, y, listW, listH);
    ctx.strokeStyle = '#ffe16a';
    ctx.strokeRect(x, y, listW, listH);
    this.bounds.instrumentDropdownItems = choices.map((choice, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const bounds = {
        x: x + col * itemW,
        y: y + row * itemH,
        w: itemW,
        h: itemH,
        value: choice,
        dropdown: source
      };
      const label = source.kind === 'keyboard-octave' ? `C${choice}` : formatPitchLabel(choice);
      const active = source.kind === 'keyboard-octave'
        ? choice === this.instrumentSettings.keyboardStartOctave
        : choice === this.instrumentSettings[`${source.instrument}Tuning`]?.[source.stringIndex];
      ctx.fillStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.fillStyle = active ? '#111' : '#fff';
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + 18);
      return bounds;
    });
    ctx.textAlign = 'left';
    ctx.restore();
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
    const instruments = this.availableInstruments;
    const gap = 10;
    const minButtonW = 96;
    const columns = Math.max(1, Math.floor((modalW - 32 + gap) / (minButtonW + gap)));
    const rows = Math.ceil(instruments.length / columns);
    const titleH = 34;
    const configRows = this.hideInstrumentConfig ? 0 : this.instrument === 'guitar' ? 4 : this.instrument === 'bass' ? 3 : this.instrument === 'keyboard' ? 2 : 0;
    const configH = configRows ? 22 + configRows * (this.header.rowH + gap) + 8 : 0;
    const modalContentH = titleH + rows * this.header.rowH + Math.max(0, rows - 1) * gap + configH + 24;
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
    const configStartY = modalY + 54 + rows * this.header.rowH + Math.max(0, rows - 1) * gap + 18;
    this.drawInstrumentConfig(ctx, modalX, modalY, modalW, configStartY);
    ctx.restore();
  }

  drawSettingButtons(ctx, isPlaying, isRecording) {
    const rail = this.bounds.controlRail;
    if (!rail) return;
    const buttonW = rail.buttonW;
    const x = this.header.x;
    const y = this.header.settingsY;
    const gap = this.header.rowGap;
    const maxButtonH = Math.max(24, Math.floor((rail.h - rail.padding * 2 - gap * 6) / 7));
    const buttonH = Math.min(this.header.rowH, maxButtonH);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,12,0.92)';
    ctx.fillRect(rail.x, rail.y, rail.w, rail.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(rail.x, rail.y, rail.w, rail.h);
    ctx.restore();
    this.bounds.settingsButtons = [
      {
        id: 'quantize',
        label: this.quantizeEnabled ? `Quant ${this.quantizeLabel}` : 'Quant Off',
        x,
        y,
        w: buttonW,
        h: buttonH,
        active: this.quantizeEnabled
      },
      {
        id: 'countin',
        label: this.countInEnabled ? 'Count-in On' : 'Count-in Off',
        x,
        y: y + (buttonH + gap),
        w: buttonW,
        h: buttonH,
        active: this.countInEnabled
      },
      {
        id: 'metronome',
        label: this.metronomeEnabled ? 'Click On' : 'Click Off',
        x,
        y: y + (buttonH + gap) * 2,
        w: buttonW,
        h: buttonH,
        active: this.metronomeEnabled
      },
      {
        id: 'virtual',
        label: 'Virtual Instruments',
        x,
        y: y + (buttonH + gap) * 3,
        w: buttonW,
        h: buttonH,
        active: this.instrumentMenuOpen
      },
      {
        id: 'record-toggle',
        label: '●',
        x,
        y: y + (buttonH + gap) * 4,
        w: buttonW,
        h: buttonH,
        active: isRecording
      },
      {
        id: 'playback-play',
        label: isPlaying ? '❚❚' : '▶',
        x,
        y: y + (buttonH + gap) * 5,
        w: buttonW,
        h: buttonH,
        active: isPlaying
      },
      {
        id: 'playback-stop',
        label: '⏹',
        x,
        y: y + (buttonH + gap) * 6,
        w: buttonW,
        h: buttonH,
        active: false
      }
    ];
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

  drawNowPlayingModal(ctx, nowPlaying, placement = 'instrument') {
    if (!nowPlaying?.active) return;
    const { instrument } = this.bounds;
    if (!instrument) return;
    const modalW = Math.min(520, instrument.w - 40);
    const modalH = 130;
    const modalX = instrument.x + (instrument.w - modalW) / 2;
    const modalY = placement === 'preview'
      ? (() => {
        const previewTop = this.bounds.grid?.y ?? instrument.y;
        const previewH = this.bounds.grid?.h ?? instrument.h;
        const minTopBandY = previewTop + previewH * 0.05;
        const maxTopBandY = previewTop + previewH * 0.3;
        const preferredY = previewTop + previewH * 0.12;
        return clamp(preferredY, minTopBandY, Math.max(minTopBandY, maxTopBandY - modalH));
      })()
      : instrument.y + (instrument.h - modalH) / 2;
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
    const hitDropdown = this.bounds.instrumentDropdownItems.find((item) => this.pointInBounds(x, y, item));
    if (hitDropdown) {
      const dropdown = hitDropdown.dropdown;
      this.instrumentDropdown = null;
      this.bounds.instrumentDropdownItems = [];
      if (dropdown.kind === 'keyboard-octave') {
        return { type: 'keyboard-octave', value: hitDropdown.value };
      }
      if (dropdown.kind === 'string-tuning') {
        return {
          type: 'string-tuning',
          instrument: dropdown.instrument,
          stringIndex: dropdown.stringIndex,
          pitch: hitDropdown.value
        };
      }
    }
    const hitConfig = this.bounds.instrumentConfigButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitConfig) {
      if (hitConfig.kind === 'standard-tuning') {
        this.instrumentDropdown = null;
        return { type: 'standard-tuning', instrument: hitConfig.instrument };
      }
      this.instrumentDropdown = this.instrumentDropdown?.id === hitConfig.id ? null : { ...hitConfig };
      return { type: 'instrument-config-open' };
    }
    const hitInstrument = this.bounds.instrumentButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitInstrument) {
      this.setInstrument(hitInstrument.id);
      this.instrumentDropdown = null;
      return { type: 'instrument', value: hitInstrument.id };
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
    if (this.instrumentMenuOpen && this.instrumentModalBounds && !this.pointInBounds(x, y, this.instrumentModalBounds)) {
      this.instrumentMenuOpen = false;
      this.instrumentModalBounds = null;
      this.bounds.instrumentButtons = [];
      this.bounds.instrumentConfigButtons = [];
      this.bounds.instrumentDropdownItems = [];
      this.instrumentDropdown = null;
      return null;
    }
    if (this.instrumentMenuOpen && !this.instrumentModalBounds) {
      this.instrumentMenuOpen = false;
      this.instrumentDropdown = null;
      return null;
    }
    if (this.instrumentMenuOpen) {
      this.instrumentDropdown = null;
      return { type: 'instrument-config-open' };
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
