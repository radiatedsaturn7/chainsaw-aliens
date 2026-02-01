const SWIPE_THRESHOLD = 42;

const BUTTON_COLORS = {
  A: { base: 'rgba(60,220,120,0.7)', active: 'rgba(120,255,170,0.9)', stroke: '#30d77a' },
  B: { base: 'rgba(240,90,90,0.7)', active: 'rgba(255,140,140,0.9)', stroke: '#ff6b6b' },
  X: { base: 'rgba(90,150,255,0.7)', active: 'rgba(140,190,255,0.9)', stroke: '#7ab4ff' },
  Y: { base: 'rgba(245,210,80,0.75)', active: 'rgba(255,232,140,0.95)', stroke: '#f7dd77' },
  LB: { base: 'rgba(210,200,255,0.6)', active: 'rgba(235,230,255,0.9)', stroke: '#d2c6ff' },
  RB: { base: 'rgba(210,200,255,0.6)', active: 'rgba(235,230,255,0.9)', stroke: '#d2c6ff' },
  DL: { base: 'rgba(120,210,255,0.6)', active: 'rgba(160,235,255,0.9)', stroke: '#7dd6ff' }
};

export default class RobterSessionMobileControls {
  constructor() {
    this.enabled = false;
    this.viewport = { width: 0, height: 0 };
    this.joystick = {
      active: false,
      id: null,
      center: { x: 0, y: 0 },
      radius: 70,
      knobRadius: 28,
      dx: 0,
      dy: 0
    };
    this.buttons = [];
    this.buttonStates = new Map();
    this.pointerButtonMap = new Map();
    this.gesturePointers = new Map();
    this.pulseActions = new Set();
  }

  setViewport({ width, height, isMobile }) {
    this.viewport = { width, height };
    this.enabled = Boolean(isMobile);
    this.layout();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  layout() {
    const { width, height } = this.viewport;
    if (!width || !height) return;
    const base = Math.min(width, height);
    const margin = Math.max(20, base * 0.05);
    const joystickRadius = Math.min(90, base * 0.18);
    const knobRadius = Math.max(26, joystickRadius * 0.45);
    this.joystick.center = {
      x: margin + joystickRadius,
      y: height - margin - joystickRadius
    };
    this.joystick.radius = joystickRadius;
    this.joystick.knobRadius = knobRadius;

    const buttonRadius = Math.min(54, base * 0.12);
    const buttonGap = Math.max(buttonRadius * 1.25, buttonRadius + 18);
    const diamondCenterX = width - margin - buttonRadius - buttonGap;
    const diamondCenterY = height - margin - buttonRadius - buttonGap;

    const shoulderRadius = Math.min(32, base * 0.08);
    const lbX = margin + shoulderRadius;
    const lbY = margin + shoulderRadius;
    const rbX = width - margin - shoulderRadius;
    const rbY = margin + shoulderRadius;
    const dLeftY = lbY + shoulderRadius * 2.4;

    this.buttons = [
      { id: 'LB', label: 'LB', action: 'aimUp', x: lbX, y: lbY, r: shoulderRadius },
      { id: 'DL', label: 'D◀', action: 'dpadLeft', x: lbX, y: dLeftY, r: shoulderRadius * 0.95 },
      { id: 'RB', label: 'RB', action: 'aimDown', x: rbX, y: rbY, r: shoulderRadius },
      { id: 'Y', label: 'Y', action: 'throw', x: diamondCenterX, y: diamondCenterY - buttonGap, r: buttonRadius },
      { id: 'X', label: 'X', action: 'rev', x: diamondCenterX - buttonGap, y: diamondCenterY, r: buttonRadius },
      { id: 'B', label: 'B', action: 'dash', x: diamondCenterX + buttonGap, y: diamondCenterY, r: buttonRadius },
      { id: 'A', label: 'A', action: 'jump', x: diamondCenterX, y: diamondCenterY + buttonGap, r: buttonRadius }
    ];
  }

  shouldHandle(state) {
    return this.enabled && state === 'play';
  }

  isInsideCircle(x, y, button) {
    const dx = x - button.x;
    const dy = y - button.y;
    return Math.hypot(dx, dy) <= button.r;
  }

  handlePointerDown(payload, state) {
    if (!this.shouldHandle(state)) return false;
    const id = payload.id ?? 'mouse';

    const dx = payload.x - this.joystick.center.x;
    const dy = payload.y - this.joystick.center.y;
    if (Math.hypot(dx, dy) <= this.joystick.radius * 1.2) {
      this.joystick.active = true;
      this.joystick.id = id;
      this.updateJoystick(payload.x, payload.y);
      return true;
    }

    for (const button of this.buttons) {
      if (this.isInsideCircle(payload.x, payload.y, button)) {
        this.buttonStates.set(button.action, true);
        this.pointerButtonMap.set(id, button.action);
        return true;
      }
    }

    this.gesturePointers.set(id, {
      startX: payload.x,
      startY: payload.y
    });
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

  handlePointerUp(payload, state) {
    if (!this.shouldHandle(state)) return false;
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

    const gesture = this.gesturePointers.get(id);
    if (gesture) {
      const dx = payload.x - gesture.startX;
      const dy = payload.y - gesture.startY;
      if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD && Math.abs(dy) >= Math.abs(dx)) {
        if (dy < 0) {
          this.pulseAction('dpadUp');
        } else {
          this.pulseAction('dpadDown');
        }
      }
      this.gesturePointers.delete(id);
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

  pulseAction(action) {
    this.pulseActions.add(action);
  }

  getActions(state) {
    if (!this.shouldHandle(state)) {
      return {
        actions: {},
        axes: { leftX: 0, leftY: 0 }
      };
    }
    const deadZone = 0.2;
    const axes = {
      leftX: Math.abs(this.joystick.dx) > deadZone ? this.joystick.dx : 0,
      leftY: Math.abs(this.joystick.dy) > deadZone ? this.joystick.dy : 0
    };

    const actions = {};
    this.buttons.forEach((button) => {
      actions[button.action] = this.buttonStates.get(button.action) || false;
    });

    this.pulseActions.forEach((action) => {
      actions[action] = true;
    });
    this.pulseActions.clear();

    return { actions, axes };
  }

  draw(ctx, state) {
    if (!this.shouldHandle(state)) return;
    const { center, radius, knobRadius, dx, dy } = this.joystick;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const knobX = center.x + dx * radius * 0.65;
    const knobY = center.y + dy * radius * 0.65;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    this.buttons.forEach((button) => {
      const active = this.buttonStates.get(button.action);
      const colors = BUTTON_COLORS[button.id] || BUTTON_COLORS.A;
      ctx.fillStyle = active ? colors.active : colors.base;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.arc(button.x, button.y, button.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? '#0b0f18' : '#0b0f18';
      ctx.font = button.r > 30 ? 'bold 16px Courier New' : 'bold 12px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(button.label, button.x, button.y + 1);
    });
    ctx.restore();
  }
}
