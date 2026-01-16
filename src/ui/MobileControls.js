const DEFAULT_STATE_LIST = ['playing', 'dialog', 'title', 'shop', 'pause'];

export default class MobileControls {
  constructor() {
    this.enabled = false;
    this.viewport = { width: 0, height: 0 };
    this.joystick = {
      active: false,
      id: null,
      center: { x: 0, y: 0 },
      radius: 60,
      knobRadius: 26,
      dx: 0,
      dy: 0
    };
    this.buttons = [];
    this.contextButtons = [];
    this.buttonStates = new Map();
    this.pointerButtonMap = new Map();
  }

  setViewport({ width, height, isMobile }) {
    this.viewport = { width, height };
    this.enabled = Boolean(isMobile);
    this.layout();
  }

  layout() {
    const { width, height } = this.viewport;
    if (!width || !height) return;
    const base = Math.min(width, height);
    const margin = Math.max(26, base * 0.05);
    const joystickRadius = Math.min(80, base * 0.14);
    const knobRadius = Math.max(22, joystickRadius * 0.45);
    this.joystick.center = {
      x: margin + joystickRadius,
      y: height - margin - joystickRadius
    };
    this.joystick.radius = joystickRadius;
    this.joystick.knobRadius = knobRadius;

    const buttonRadius = Math.min(54, base * 0.1);
    const buttonGap = Math.max(buttonRadius * 1.15, buttonRadius + 12);
    const rightX = width - margin - buttonRadius;
    const lowerY = height - margin - buttonRadius;
    const upperY = lowerY - buttonGap;
    const leftX = rightX - buttonGap;
    const upperLeftY = upperY - buttonGap;

    this.buttons = [
      { id: 'jump', label: 'JUMP', action: 'jump', x: rightX, y: upperY, r: buttonRadius },
      { id: 'attack', label: 'ATK', action: 'attack', x: leftX, y: lowerY, r: buttonRadius },
      { id: 'rev', label: 'REV', action: 'rev', x: leftX, y: upperY, r: buttonRadius },
      { id: 'dash', label: 'DASH', action: 'dash', x: rightX, y: lowerY, r: buttonRadius }
    ];

    const pauseRadius = Math.max(20, buttonRadius * 0.5);
    this.contextButtons = [
      { id: 'interact', label: 'OK', action: 'interact', x: rightX, y: upperLeftY, r: pauseRadius },
      { id: 'pause', label: 'PAUSE', action: 'pause', x: width - margin - pauseRadius, y: margin + pauseRadius, r: pauseRadius }
    ];
  }

  shouldDraw(state) {
    return this.enabled && DEFAULT_STATE_LIST.includes(state);
  }

  getVisibleButtons(state) {
    const visible = [...this.buttons];
    if (state === 'dialog' || state === 'title' || state === 'shop') {
      visible.push({ ...this.contextButtons[0], label: state === 'shop' ? 'BUY' : 'OK' });
    }
    visible.push(this.contextButtons[1]);
    return visible;
  }

  isInsideCircle(x, y, button) {
    const dx = x - button.x;
    const dy = y - button.y;
    return Math.hypot(dx, dy) <= button.r;
  }

  handlePointerDown(payload, state) {
    if (!this.shouldDraw(state)) return false;
    const id = payload.id ?? 'mouse';
    const dx = payload.x - this.joystick.center.x;
    const dy = payload.y - this.joystick.center.y;
    if (Math.hypot(dx, dy) <= this.joystick.radius * 1.2) {
      this.joystick.active = true;
      this.joystick.id = id;
      this.updateJoystick(payload.x, payload.y);
      return true;
    }

    const buttons = this.getVisibleButtons(state);
    for (const button of buttons) {
      if (this.isInsideCircle(payload.x, payload.y, button)) {
        this.buttonStates.set(button.action, true);
        this.pointerButtonMap.set(id, button.action);
        return true;
      }
    }
    return false;
  }

  handlePointerMove(payload) {
    if (!this.enabled) return false;
    const id = payload.id ?? 'mouse';
    if (this.joystick.active && this.joystick.id === id) {
      this.updateJoystick(payload.x, payload.y);
      return true;
    }
    return false;
  }

  handlePointerUp(payload) {
    if (!this.enabled) return false;
    const id = payload.id ?? 'mouse';
    if (this.joystick.active && this.joystick.id === id) {
      this.joystick.active = false;
      this.joystick.id = null;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
    }
    const action = this.pointerButtonMap.get(id);
    if (action) {
      this.buttonStates.set(action, false);
      this.pointerButtonMap.delete(id);
    }
    return true;
  }

  updateJoystick(x, y) {
    const dx = x - this.joystick.center.x;
    const dy = y - this.joystick.center.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.joystick.radius);
    const angle = Math.atan2(dy, dx);
    this.joystick.dx = Math.cos(angle) * (clamped / this.joystick.radius);
    this.joystick.dy = Math.sin(angle) * (clamped / this.joystick.radius);
  }

  getActions(state) {
    if (!this.shouldDraw(state)) return {};
    const deadZone = 0.25;
    const actions = {
      left: this.joystick.dx < -deadZone,
      right: this.joystick.dx > deadZone,
      up: this.joystick.dy < -deadZone,
      down: this.joystick.dy > deadZone
    };

    this.getVisibleButtons(state).forEach((button) => {
      actions[button.action] = this.buttonStates.get(button.action) || false;
    });
    return actions;
  }

  draw(ctx, state) {
    if (!this.shouldDraw(state)) return;
    const { center, radius, knobRadius, dx, dy } = this.joystick;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const knobX = center.x + dx * radius * 0.7;
    const knobY = center.y + dy * radius * 0.7;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const buttons = this.getVisibleButtons(state);
    buttons.forEach((button) => {
      const active = this.buttonStates.get(button.action);
      ctx.fillStyle = active ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
      ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(button.x, button.y, button.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = button.r > 28 ? '12px Courier New' : '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(button.label, button.x, button.y + 4);
    });
    ctx.restore();
  }
}
