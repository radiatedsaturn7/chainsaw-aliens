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
    this.attackHold = { id: null, startTime: 0, timer: null, active: false };
    this.multiTouch = { active: false, count: 0, startTime: 0, ids: new Set() };
    this.lastMoveDir = 1;
    this.facing = 1;
    this.attackPad = { x: 0, y: 0, r: 0 };
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
    const margin = Math.max(34, base * 0.06);
    const joystickRadius = Math.min(88, base * 0.15);
    const knobRadius = Math.max(26, joystickRadius * 0.48);
    this.joystick.center = {
      x: margin + joystickRadius,
      y: height - margin - joystickRadius
    };
    this.joystick.radius = joystickRadius;
    this.joystick.knobRadius = knobRadius;

    const buttonRadius = Math.min(82, base * 0.16);
    const buttonGap = Math.max(buttonRadius * 1.7, buttonRadius + 32);
    const rightX = width - margin - buttonRadius;
    const lowerY = height - margin - buttonRadius;
    const upperY = lowerY - buttonGap;
    const upperLeftY = upperY - buttonGap * 0.75;

    this.attackPad = { x: rightX, y: lowerY, r: buttonRadius };

    this.buttons = [
      { id: 'attack', label: 'ATK', action: 'attack', x: rightX, y: lowerY, r: buttonRadius }
    ];

    const pauseRadius = Math.max(24, buttonRadius * 0.55);
    this.contextButtons = [
      { id: 'interact', label: 'OK', action: 'interact', x: rightX, y: upperLeftY, r: pauseRadius }
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
      if (this.isInsideCircle(payload.x, payload.y, button)) {
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
    this.attackHold = { id, startTime: now, timer: null, active: false };
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
      this.pulseAction('attack');
      const forward = this.joystick.dx * this.facing > 0.2 || this.lastMoveDir === this.facing;
      if (forward) {
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
      actions[button.action] = this.buttonStates.get(button.action) || false;
    });

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
      const isAttack = button.id === 'attack';
      const pulse = isAttack && this.attackHold.active;
      ctx.fillStyle = active || pulse ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
      ctx.strokeStyle = active || pulse ? '#fff' : 'rgba(255,255,255,0.6)';
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
