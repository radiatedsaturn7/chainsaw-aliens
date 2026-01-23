const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class RecordModeLayout {
  constructor({ touchInput }) {
    this.touchInput = touchInput;
    this.bounds = {
      grid: null,
      instrument: null,
      stop: null,
      deviceButtons: [],
      instrumentButtons: [],
      settingsButtons: []
    };
    this.device = 'auto';
    this.instrument = 'keyboard';
    this.quantizeEnabled = false;
    this.quantizeLabel = '1/16';
    this.countInEnabled = false;
    this.metronomeEnabled = false;
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

  layout(width, height) {
    const gridH = Math.round(height * 0.58);
    this.bounds.grid = { x: 16, y: 16, w: width - 32, h: gridH - 24 };
    this.bounds.instrument = { x: 16, y: gridH + 4, w: width - 32, h: height - gridH - 20 };
    const stopW = 180;
    const stopH = 44;
    this.bounds.stop = {
      x: width - stopW - 24,
      y: height - stopH - 24,
      w: stopW,
      h: stopH
    };
    if (this.touchInput) {
      this.touchInput.setBounds({
        x: this.bounds.instrument.x + 12,
        y: this.bounds.instrument.y + 54,
        w: this.bounds.instrument.w - 24,
        h: this.bounds.instrument.h - 72
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

    this.drawDeviceButtons(ctx, gamepadConnected);
    this.drawInstrumentButtons(ctx, gamepadConnected);
    this.drawSettingButtons(ctx);

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

  drawDeviceButtons(ctx, gamepadConnected) {
    const buttons = [];
    const x = this.bounds.instrument.x + 12;
    const y = this.bounds.instrument.y + 54 - 34;
    const w = 100;
    const h = 24;
    const gap = 8;
    const gamepadLabel = gamepadConnected ? 'Gamepad' : 'No Pad';
    buttons.push({ id: 'gamepad', label: gamepadLabel, x, y, w, h, disabled: !gamepadConnected });
    buttons.push({ id: 'touch', label: 'Touch', x: x + w + gap, y, w, h });
    this.bounds.deviceButtons = buttons.map((btn) => ({
      ...btn,
      active: this.device === btn.id
    }));
    this.bounds.deviceButtons.forEach((btn) => {
      this.drawButton(ctx, btn, btn.label, btn.active && !btn.disabled);
    });
  }

  drawInstrumentButtons(ctx, gamepadConnected) {
    if (this.device === 'gamepad' && gamepadConnected) {
      this.bounds.instrumentButtons = [];
      return;
    }
    const instruments = ['guitar', 'bass', 'keyboard', 'drums'];
    const buttonW = 90;
    const gap = 8;
    const x = this.bounds.instrument.x + 12 + 220;
    const y = this.bounds.instrument.y + 54 - 34;
    this.bounds.instrumentButtons = instruments.map((instrument, index) => ({
      id: instrument,
      label: instrument[0].toUpperCase() + instrument.slice(1),
      x: x + index * (buttonW + gap),
      y,
      w: buttonW,
      h: 24,
      active: this.instrument === instrument
    }));
    this.bounds.instrumentButtons.forEach((btn) => {
      this.drawButton(ctx, btn, btn.label, btn.active);
    });
  }

  drawSettingButtons(ctx) {
    const buttonW = 90;
    const gap = 8;
    const x = this.bounds.instrument.x + 12;
    const y = this.bounds.instrument.y + 20;
    this.bounds.settingsButtons = [
      {
        id: 'quantize',
        label: this.quantizeEnabled ? `Quant ${this.quantizeLabel}` : 'Quant Off',
        x: x + 340,
        y,
        w: buttonW + 20,
        h: 24,
        active: this.quantizeEnabled
      },
      {
        id: 'countin',
        label: this.countInEnabled ? 'Count-in On' : 'Count-in Off',
        x: x + 470,
        y,
        w: buttonW + 20,
        h: 24,
        active: this.countInEnabled
      },
      {
        id: 'metronome',
        label: this.metronomeEnabled ? 'Click On' : 'Click Off',
        x: x + 600,
        y,
        w: buttonW + 10,
        h: 24,
        active: this.metronomeEnabled
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
    const hitDevice = this.bounds.deviceButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitDevice && !hitDevice.disabled) {
      this.device = hitDevice.id;
      return { type: 'device', value: hitDevice.id };
    }
    const hitInstrument = this.bounds.instrumentButtons.find((btn) => this.pointInBounds(x, y, btn));
    if (hitInstrument) {
      this.setInstrument(hitInstrument.id);
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
