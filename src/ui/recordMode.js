const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class RecordModeLayout {
  constructor({ touchInput }) {
    this.touchInput = touchInput;
    this.bounds = {
      grid: null,
      instrument: null,
      stop: null,
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

  layout(width, height, originX = 0, originY = 0) {
    const padding = 16;
    const topBarH = 56;
    const gridGap = 12;
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
    const stopW = 190;
    const stopH = 40;
    this.bounds.stop = {
      x: originX + width - stopW - padding,
      y: originY + padding + Math.round((topBarH - stopH) / 2),
      w: stopW,
      h: stopH
    };
    const textBlockH = 36;
    const headerPadding = 12;
    const headerH = headerPadding + textBlockH + this.header.rowH + 10;
    this.header = {
      x: this.bounds.instrument.x + 12,
      y: this.bounds.instrument.y + 12,
      rowH: 28,
      rowGap: 10,
      settingsY: this.bounds.instrument.y + 12 + textBlockH,
      instrumentY: this.bounds.instrument.y + 12 + textBlockH + 28 + 10,
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

  draw(ctx, { gamepadConnected, showGamepadHints, deviceLabel, degreeLabel, octaveLabel, velocityLabel }) {
    const { instrument } = this.bounds;
    if (!instrument) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(instrument.x, instrument.y, instrument.w, instrument.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(instrument.x, instrument.y, instrument.w, instrument.h);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Record Mode', instrument.x + 12, instrument.y + 20);

    const metaText = `${deviceLabel} · ${degreeLabel} · ${octaveLabel} · ${velocityLabel}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    ctx.fillText(metaText, instrument.x + 12, instrument.y + 40);

    this.drawSettingButtons(ctx);
    this.drawInstrumentModal(ctx, gamepadConnected);

    if (showGamepadHints) {
      this.drawGamepadHints(ctx);
    } else if (this.touchInput) {
      this.touchInput.draw(ctx);
    }

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

  drawInstrumentButtons(ctx, gamepadConnected) {
    if (!this.instrumentMenuOpen) {
      this.bounds.instrumentButtons = [];
      return;
    }
    if (this.device === 'gamepad' && gamepadConnected) {
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

  drawInstrumentModal(ctx, gamepadConnected) {
    this.instrumentModalBounds = null;
    if (!this.instrumentMenuOpen) return;
    if (this.device === 'gamepad' && gamepadConnected) return;
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

    this.drawInstrumentButtons(ctx, gamepadConnected);
    ctx.restore();
  }

  drawSettingButtons(ctx) {
    const gap = 10;
    const totalW = this.bounds.instrument.w - 24;
    const buttonW = Math.max(90, (totalW - gap * 3) / 4);
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
    const lines = [
      'Left Stick: choose scale degree (silent)',
      'A: triad  X: open  Y: 7th  B: power/bass',
      'LB: minor  RB: spice  LT: Note Mode',
      'D-Pad Up/Down: octave  RT: velocity',
      'Right Stick: pitch bend + mod (CC1/74)',
      'L3: Latch root'
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, instrument.x + 24, instrument.y + 100 + index * 20);
    });
  }

  handlePointerDown(payload) {
    const { x, y } = payload;
    const hitInstrument = this.bounds.instrumentButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitInstrument) {
      this.setInstrument(hitInstrument.id);
      this.instrumentMenuOpen = false;
      return { type: 'instrument', value: hitInstrument.id };
    }
    if (this.instrumentMenuOpen && this.instrumentModalBounds && !this.pointInBounds(x, y, this.instrumentModalBounds)) {
      this.instrumentMenuOpen = false;
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
