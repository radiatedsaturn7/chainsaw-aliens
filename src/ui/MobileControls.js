const DEFAULT_STATE_LIST = ['playing', 'dialog', 'shop', 'pause'];

const HOLD_THRESHOLD = 320;
const SWIPE_THRESHOLD = 42;
const DASH_WINDOW = 320;
const MULTI_TAP_WINDOW = 240;
const TAP_THRESHOLD = 260;
const MOVE_PULSE_DURATION = 220;

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
    this.gesturePointers = new Map();
    this.pulseActions = new Set();
    this.movementPulse = { left: 0, right: 0, up: 0, down: 0 };
    this.lastSwipe = { dir: null, time: 0 };
    this.attackHold = { id: null, startTime: 0, timer: null, active: false, registered: false };
    this.multiTouch = { active: false, count: 0, startTime: 0, ids: new Set() };
    this.lastMoveDir = 1;
    this.facing = 1;
    this.attackPad = { x: 0, y: 0, r: 0 };
    this.bButton = { x: 0, y: 0, r: 0 };
    this.startButton = { x: 0, y: 0, w: 0, h: 0 };
    this.selectButton = { x: 0, y: 0, w: 0, h: 0 };
    this.dpadBounds = null;
    this.flameToggleEnabled = true;
    this.controlsBounds = null;
    this.controlsLayout = null;
  }

  setViewport({ width, height, isMobile, controlsBounds = null, controlsLayout = null }) {
    this.viewport = { width, height };
    this.enabled = Boolean(isMobile);
    this.controlsLayout = controlsLayout;
    this.controlsBounds = controlsBounds
      ? {
        x: Number(controlsBounds.x || 0),
        y: Number(controlsBounds.y || 0),
        w: Number(controlsBounds.w || 0),
        h: Number(controlsBounds.h || 0)
      }
      : null;
    this.layout();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  reset() {
    if (this.attackHold.timer) {
      clearTimeout(this.attackHold.timer);
    }
    this.joystick.active = false;
    this.joystick.id = null;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
    this.buttonStates.clear();
    this.pointerButtonMap.clear();
    this.gesturePointers.clear();
    this.pulseActions.clear();
    this.movementPulse = { left: 0, right: 0, up: 0, down: 0 };
    this.lastSwipe = { dir: null, time: 0 };
    this.attackHold = { id: null, startTime: 0, timer: null, active: false, registered: false };
    this.multiTouch = { active: false, count: 0, startTime: 0, ids: new Set() };
  }

  setFlameToggleEnabled(enabled) {
    this.flameToggleEnabled = Boolean(enabled);
  }

  layout() {
    const { width, height } = this.viewport;
    if (!width || !height) return;
    const bounds = this.controlsBounds || { x: 0, y: 0, w: width, h: height };
    const base = Math.min(bounds.w, bounds.h);
    const layout = this.controlsLayout || null;
    const dpad = layout?.dpad || null;
    const dpadSize = dpad ? Math.min(dpad.w, dpad.h) : Math.min(116, Math.max(82, base * 0.32));
    const joystickRadius = Math.max(44, dpadSize * 0.5);
    const knobRadius = Math.max(18, joystickRadius * 0.24);
    this.joystick.center = {
      x: dpad ? dpad.x + dpad.w / 2 : bounds.x + Math.max(22, base * 0.09) + joystickRadius,
      y: dpad ? dpad.y + dpad.h / 2 : bounds.y + bounds.h - Math.max(22, base * 0.09) - joystickRadius
    };
    this.joystick.radius = joystickRadius;
    this.joystick.knobRadius = knobRadius;
    this.dpadBounds = dpad || {
      x: this.joystick.center.x - joystickRadius,
      y: this.joystick.center.y - joystickRadius,
      w: joystickRadius * 2,
      h: joystickRadius * 2
    };

    const buttonRadius = layout?.buttons?.a?.r || Math.min(70, Math.max(44, base * 0.19));
    const margin = Math.max(22, base * 0.09);
    const rightX = layout?.buttons?.a?.x ?? bounds.x + bounds.w - margin - buttonRadius;
    const lowerY = layout?.buttons?.a?.y ?? bounds.y + bounds.h - margin - buttonRadius;

    this.attackPad = { x: rightX, y: lowerY, r: buttonRadius };
    this.bButton = {
      x: layout?.buttons?.jump?.x ?? rightX - buttonRadius * 2.3,
      y: layout?.buttons?.jump?.y ?? lowerY + buttonRadius * 0.6,
      r: layout?.buttons?.jump?.r ?? buttonRadius
    };
    this.startButton = layout?.start || {
      x: bounds.x + bounds.w * 0.5 + 8,
      y: bounds.y + bounds.h * 0.66,
      w: 58,
      h: 22
    };
    this.selectButton = layout?.select || {
      x: bounds.x + bounds.w * 0.5 - 66,
      y: bounds.y + bounds.h * 0.66,
      w: 58,
      h: 22
    };

    this.buttons = [
      { id: 'attack', label: 'R', action: 'attack', x: this.attackPad.x, y: this.attackPad.y, r: this.attackPad.r },
      { id: 'jump', label: 'G', action: 'jump', pulse: true, x: this.bButton.x, y: this.bButton.y, r: this.bButton.r },
      { id: 'select', label: 'SELECT', action: 'nextWeapon', pulse: true, ...this.selectButton, pill: true },
      { id: 'start', label: 'START', action: 'pause', pulse: true, ...this.startButton, pill: true }
    ];

    const pauseRadius = Math.max(24, buttonRadius * 0.55);
    this.contextButtons = [
      { id: 'interact', label: 'OK', action: 'interact', x: this.startButton.x + this.startButton.w / 2, y: this.startButton.y - pauseRadius * 1.6, r: pauseRadius }
    ];
  }

  shouldDraw(state) {
    return this.enabled && DEFAULT_STATE_LIST.includes(state);
  }

  getVisibleButtons(state) {
    const visible = [...this.buttons];
    if (state === 'shop') {
      visible.push({ ...this.contextButtons[0], label: 'BUY' });
    }
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
    const now = performance.now();

    if (payload.touchCount && payload.touchCount >= 2) {
      if (!this.multiTouch.active) {
        this.multiTouch = { active: true, count: payload.touchCount, startTime: now, ids: new Set([id]) };
      } else {
        this.multiTouch.count = Math.max(this.multiTouch.count, payload.touchCount);
        this.multiTouch.ids.add(id);
      }
    }

    const dx = payload.x - this.joystick.center.x;
    const dy = payload.y - this.joystick.center.y;
    if (Math.hypot(dx, dy) <= this.joystick.radius * 1.2) {
      this.joystick.active = true;
      this.joystick.id = id;
      this.updateJoystick(payload.x, payload.y);
      return true;
    }

    if (this.isInsideCircle(payload.x, payload.y, this.attackPad)) {
      this.beginAttackHold(id, now);
      return true;
    }

    const buttons = this.getVisibleButtons(state);
    for (const button of buttons) {
      if (button.id === 'attack') continue;
      const hit = button.pill
        ? payload.x >= button.x && payload.x <= button.x + button.w && payload.y >= button.y && payload.y <= button.y + button.h
        : this.isInsideCircle(payload.x, payload.y, button);
      if (hit) {
        if (button.pulse) {
          this.pulseAction(button.action);
          return true;
        }
        this.buttonStates.set(button.action, true);
        this.pointerButtonMap.set(id, button.action);
        return true;
      }
    }

    this.gesturePointers.set(id, {
      startX: payload.x,
      startY: payload.y,
      startTime: now,
      moved: false,
      state
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
    const gesture = this.gesturePointers.get(id);
    if (gesture) {
      const dx = payload.x - gesture.startX;
      const dy = payload.y - gesture.startY;
      if (Math.hypot(dx, dy) > 8) {
        gesture.moved = true;
      }
    }
    return false;
  }

  handlePointerUp(payload, state) {
    if (!this.enabled) return false;
    const id = payload.id ?? 'mouse';
    const now = performance.now();

    if (this.joystick.active && this.joystick.id === id) {
      this.joystick.active = false;
      this.joystick.id = null;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
    }

    if (this.attackHold.id === id) {
      this.endAttackHold(now);
    }

    const action = this.pointerButtonMap.get(id);
    if (action) {
      this.buttonStates.set(action, false);
      this.pointerButtonMap.delete(id);
    }

    const gesture = this.gesturePointers.get(id);
    if (gesture) {
      this.handleSwipeGesture(gesture, payload.x, payload.y, now, state);
      const duration = now - gesture.startTime;
      if (!gesture.moved && duration <= TAP_THRESHOLD && (state === 'dialog' || state === 'title')) {
        this.pulseAction('interact');
      }
      this.gesturePointers.delete(id);
    }

    if (this.multiTouch.active && this.multiTouch.ids.has(id)) {
      this.multiTouch.ids.delete(id);
      if (this.multiTouch.ids.size === 0) {
        const duration = now - this.multiTouch.startTime;
        if (duration <= MULTI_TAP_WINDOW) {
          if (this.multiTouch.count >= 3) {
            this.pulseAction('pause');
          } else if (this.multiTouch.count === 2) {
            this.pulseAction('cancel');
          }
        }
        this.multiTouch = { active: false, count: 0, startTime: 0, ids: new Set() };
      }
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
    if (this.joystick.dx > 0.2) this.lastMoveDir = 1;
    if (this.joystick.dx < -0.2) this.lastMoveDir = -1;
  }

  beginAttackHold(id, now) {
    if (this.attackHold.timer) {
      clearTimeout(this.attackHold.timer);
    }
    this.attackHold = { id, startTime: now, timer: null, active: false, registered: false };
    this.attackHold.timer = setTimeout(() => {
      if (this.attackHold.id === id) {
        this.attackHold.active = true;
      }
    }, HOLD_THRESHOLD);
  }

  endAttackHold(now) {
    const duration = now - this.attackHold.startTime;
    if (this.attackHold.timer) {
      clearTimeout(this.attackHold.timer);
    }

    if (this.attackHold.active) {
      this.attackHold.active = false;
      this.attackHold.id = null;
      return;
    }

    if (duration < HOLD_THRESHOLD) {
      if (!this.attackHold.registered) {
        this.pulseAction('attack');
      }
      const forward = this.joystick.dx * this.facing > 0.2 || this.lastMoveDir === this.facing;
      if (forward && this.flameToggleEnabled) {
        this.pulseAction('flame');
      }
    }
    this.attackHold.id = null;
  }

  handleSwipeGesture(gesture, endX, endY, now, state) {
    const dx = endX - gesture.startX;
    const dy = endY - gesture.startY;
    const dist = Math.hypot(dx, dy);
    if (dist < SWIPE_THRESHOLD) return;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    if (horizontal) {
      const dir = dx > 0 ? 'right' : 'left';
      this.setMovementPulse(dir, now);
      this.lastMoveDir = dx > 0 ? 1 : -1;
      if (state === 'playing') {
        if (this.lastSwipe.dir === dir && now - this.lastSwipe.time <= DASH_WINDOW) {
          this.pulseAction('dash');
          this.lastSwipe = { dir: null, time: 0 };
        } else {
          this.lastSwipe = { dir, time: now };
        }
      }
    } else {
      const dir = dy < 0 ? 'up' : 'down';
      if (state === 'playing' && dir === 'up') {
        this.pulseAction('jump');
      } else if (state === 'playing' && dir === 'down') {
        this.pulseAction('drop');
        this.setMovementPulse(dir, now);
      } else {
        this.setMovementPulse(dir, now);
      }
    }
  }

  setMovementPulse(direction, now) {
    this.movementPulse[direction] = now + MOVE_PULSE_DURATION;
  }

  pulseAction(action) {
    this.pulseActions.add(action);
  }

  getActions(state, facing = 1) {
    this.facing = facing;
    if (!this.shouldDraw(state)) return {};
    const now = performance.now();
    const deadZone = 0.25;
    const actions = {
      left: this.joystick.dx < -deadZone,
      right: this.joystick.dx > deadZone,
      up: this.joystick.dy < -deadZone,
      down: this.joystick.dy > deadZone
    };

    Object.keys(this.movementPulse).forEach((dir) => {
      if (this.movementPulse[dir] && now <= this.movementPulse[dir]) {
        actions[dir] = true;
      } else if (this.movementPulse[dir] && now > this.movementPulse[dir]) {
        this.movementPulse[dir] = 0;
      }
    });

    this.getVisibleButtons(state).forEach((button) => {
      const attackHeld = button.id === 'attack' && this.attackHold.id !== null;
      actions[button.action] = this.buttonStates.get(button.action) || attackHeld || false;
    });

    if (this.attackHold.id !== null) {
      this.attackHold.registered = true;
    }

    if (this.attackHold.active) {
      actions.rev = true;
    }

    this.pulseActions.forEach((action) => {
      actions[action] = true;
    });
    this.pulseActions.clear();

    return actions;
  }

  draw(ctx, state) {
    if (!this.shouldDraw(state)) return;
    const { center, radius, knobRadius, dx, dy } = this.joystick;
    ctx.save();
    ctx.globalAlpha = 1;
    this.drawDpad(ctx, center, radius, dx, dy);

    const knobX = center.x + dx * radius * 0.7;
    const knobY = center.y + dy * radius * 0.7;
    ctx.fillStyle = 'rgba(152, 184, 164, 0.42)';
    ctx.beginPath();
    ctx.arc(knobX, knobY, knobRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    const buttons = this.getVisibleButtons(state);
    buttons.forEach((button) => {
      const isAttack = button.id === 'attack';
      const active = this.buttonStates.get(button.action) || (isAttack && this.attackHold.id !== null);
      const pulse = isAttack && this.attackHold.active;
      if (button.pill) {
        this.drawPillButton(ctx, button, active || pulse);
      } else {
        this.drawRoundButton(ctx, button, active || pulse);
      }
    });
    ctx.restore();
  }

  drawDpad(ctx, center, radius, dx, dy) {
    const arm = radius * 0.46;
    const length = radius * 1.45;
    const x = center.x;
    const y = center.y;
    ctx.save();
    ctx.fillStyle = '#08100f';
    ctx.strokeStyle = 'rgba(150, 176, 160, 0.62)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x - arm / 2, y - length / 2, arm, length);
    ctx.rect(x - length / 2, y - arm / 2, length, arm);
    ctx.fill('evenodd');
    ctx.stroke();
    ctx.fillStyle = 'rgba(150, 176, 160, 0.2)';
    if (dy < -0.25) ctx.fillRect(x - arm / 2, y - length / 2, arm, length / 2 - arm / 2);
    if (dy > 0.25) ctx.fillRect(x - arm / 2, y + arm / 2, arm, length / 2 - arm / 2);
    if (dx < -0.25) ctx.fillRect(x - length / 2, y - arm / 2, length / 2 - arm / 2, arm);
    if (dx > 0.25) ctx.fillRect(x + arm / 2, y - arm / 2, length / 2 - arm / 2, arm);
    ctx.fillStyle = '#16231f';
    ctx.beginPath();
    ctx.arc(x, y, arm * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRoundButton(ctx, button, active) {
    ctx.save();
    ctx.fillStyle = active ? '#5c786c' : '#263a35';
    ctx.strokeStyle = active ? 'rgba(224, 240, 226, 0.9)' : 'rgba(150, 176, 160, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(button.x, button.y, button.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#edf5ea';
    ctx.font = button.label.length > 1 ? 'bold 9px Courier New' : 'bold 14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(button.label, button.x, button.y + (button.label.length > 1 ? 3 : 5));
    ctx.restore();
  }

  drawPillButton(ctx, button, active) {
    ctx.save();
    ctx.fillStyle = active ? '#51685f' : '#121d1a';
    ctx.strokeStyle = active ? 'rgba(224, 240, 226, 0.9)' : 'rgba(150, 176, 160, 0.62)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect?.(button.x, button.y, button.w, button.h, button.h / 2);
    if (!ctx.roundRect) ctx.rect(button.x, button.y, button.w, button.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(237,245,234,0.9)';
    ctx.font = 'bold 8px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2);
    ctx.restore();
  }
}
