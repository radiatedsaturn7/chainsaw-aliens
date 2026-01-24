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
    const headerH = headerPadding + this.header.rowH + 10;
    this.header = {
      x: this.bounds.instrument.x + 12,
      y: this.bounds.instrument.y + 12,
      rowH: 28,
      rowGap: 10,
      settingsY: this.bounds.instrument.y + 12,
      instrumentY: this.bounds.instrument.y + 12 + 28 + 10,
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

  draw(ctx, { showGamepadHints, isPlaying, isRecording, selector }) {
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

    this.drawInstrumentModal(ctx);

    ctx.restore();
  }

  drawButton(ctx, bounds, label, active) {
    ctx.fillStyle = active ? '#ffe16a' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#111' : '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 4);
    ctx.textAlign = 'left';
  }

  drawInstrumentButtons(ctx) {
    if (!this.instrumentMenuOpen) {
      this.bounds.instrumentButtons = [];
      return;
    }
    const instruments = ['guitar', 'bass', 'keyboard', 'drums'];
    const gap = 10;
    const totalW = this.instrumentModalBounds?.w ? this.instrumentModalBounds.w - 32 : this.bounds.instrument.w - 24;
    const buttonW = Math.max(80, (totalW - gap * (instruments.length - 1)) / instruments.length);
    const startX = this.instrumentModalBounds?.x ? this.instrumentModalBounds.x + 16 : this.header.x;
    const startY = this.instrumentModalBounds?.y ? this.instrumentModalBounds.y + 54 : this.header.instrumentY;
    this.bounds.instrumentButtons = instruments.map((instrument, index) => {
      const w = Math.min(buttonW, totalW);
      return ({
        id: instrument,
        label: instrument[0].toUpperCase() + instrument.slice(1),
        x: startX + index * (w + gap),
        y: startY,
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

    const modalW = Math.min(520, instrument.w - 40);
    const modalH = 150;
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
    const buttonW = Math.max(72, (totalW - gap * 6) / 7);
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
        x: x + buttonW + gap,
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
        'D-Pad Left: Note Mode  Right: Chord Mode',
        'A: 1  A+LB:2  X:3  X+LB:4',
        'Y:5  Y+LB:6  B+LB:7  B:8',
        'LB: passing tones  LT: sustain  RT: velocity',
        'Right Stick: pitch bend',
        'L3: scale root selector  R3: scale mode'
      ];
    lines.forEach((line, index) => {
      ctx.fillText(line, instrument.x + 24, instrument.y + 100 + index * 20);
    });
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
