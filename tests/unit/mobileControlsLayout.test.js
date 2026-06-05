import test from 'node:test';
import assert from 'node:assert/strict';

import MobileControls from '../../src/ui/MobileControls.js';
import { getLandscapeHandheldLayout, getPortraitHandheldLayout } from '../../src/ui/shared/canvasViewportLayout.js';

test('mobile controls can be constrained to portrait handheld deck', () => {
  const controls = new MobileControls();
  const layout = getPortraitHandheldLayout(390, 844);
  const controlsBounds = layout.controlsDeck;
  controls.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    controlsBounds,
    controlsLayout: layout
  });

  assert.ok(controls.joystick.center.x >= controlsBounds.x);
  assert.ok(controls.joystick.center.y >= controlsBounds.y);
  assert.ok(controls.joystick.center.x <= controlsBounds.x + controlsBounds.w);
  assert.ok(controls.joystick.center.y <= controlsBounds.y + controlsBounds.h);
  assert.ok(controls.attackPad.x >= controlsBounds.x);
  assert.ok(controls.attackPad.y >= controlsBounds.y);
  assert.ok(controls.attackPad.x <= controlsBounds.x + controlsBounds.w);
  assert.ok(controls.attackPad.y <= controlsBounds.y + controlsBounds.h);
  assert.ok(controls.joystick.radius >= 44);
  assert.ok(controls.attackPad.r >= 26);
  assert.ok(controls.getVisibleButtons('playing').some((button) => button.id === 'attack' && button.label === 'R'));
  assert.ok(controls.getVisibleButtons('playing').some((button) => button.id === 'jump' && button.label === 'G'));
  assert.ok(controls.getVisibleButtons('playing').some((button) => button.id === 'start'));
  assert.ok(controls.getVisibleButtons('playing').some((button) => button.id === 'select'));
  assert.ok(controls.joystick.center.y > controlsBounds.y + controlsBounds.h * 0.26);
  assert.ok(controls.joystick.center.y < controlsBounds.y + controlsBounds.h * 0.38);
  assert.ok(controls.joystick.radius >= 48);
  assert.ok(controls.attackPad.r >= 32);
  assert.ok(controls.attackPad.y < controlsBounds.y + controlsBounds.h * 0.34);
  assert.ok(controls.bButton.y > controlsBounds.y + controlsBounds.h * 0.34);
  assert.ok(controls.bButton.y < controlsBounds.y + controlsBounds.h * 0.48);
  assert.ok(controls.attackPad.y < controls.bButton.y - controls.bButton.r);
  assert.ok(controls.startButton.y > controlsBounds.y + controlsBounds.h * 0.82);
  assert.ok(controls.selectButton.y > controlsBounds.y + controlsBounds.h * 0.82);
});

test('portrait handheld B button pulses jump like swipe up', () => {
  const controls = new MobileControls();
  const layout = getPortraitHandheldLayout(390, 844);
  controls.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    controlsBounds: layout.controlsDeck,
    controlsLayout: layout
  });

  controls.handlePointerDown({ id: 'touch-b', x: controls.bButton.x, y: controls.bButton.y }, 'playing');
  const actions = controls.getActions('playing', 1);
  const nextActions = controls.getActions('playing', 1);

  assert.equal(actions.jump, true);
  assert.equal(nextActions.jump, false);
});

test('portrait handheld start and select pulse pause and next weapon', () => {
  const controls = new MobileControls();
  const layout = getPortraitHandheldLayout(390, 844);
  controls.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    controlsBounds: layout.controlsDeck,
    controlsLayout: layout
  });

  controls.handlePointerDown({ id: 'touch-start', x: controls.startButton.x + controls.startButton.w / 2, y: controls.startButton.y + controls.startButton.h / 2 }, 'playing');
  assert.equal(controls.getActions('playing', 1).pause, true);
  assert.equal(controls.getActions('playing', 1).pause, false);

  controls.handlePointerDown({ id: 'touch-select', x: controls.selectButton.x + controls.selectButton.w / 2, y: controls.selectButton.y + controls.selectButton.h / 2 }, 'playing');
  assert.equal(controls.getActions('playing', 1).nextWeapon, true);
  assert.equal(controls.getActions('playing', 1).nextWeapon, false);
});

test('portrait handheld controls expose menu navigation actions while paused', () => {
  const controls = new MobileControls();
  const layout = getPortraitHandheldLayout(390, 844);
  controls.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    controlsBounds: layout.controlsDeck,
    controlsLayout: layout
  });

  controls.handlePointerDown({
    id: 'stick',
    x: controls.joystick.center.x,
    y: controls.joystick.center.y - controls.joystick.radius
  }, 'pause');
  assert.equal(controls.getActions('pause', 1).up, true);
  controls.handlePointerMove({
    id: 'stick',
    x: controls.joystick.center.x + controls.joystick.radius,
    y: controls.joystick.center.y
  });
  assert.equal(controls.getActions('pause', 1).right, true);
  controls.handlePointerUp({ id: 'stick' }, 'pause');

  controls.handlePointerDown({ id: 'touch-a', x: controls.attackPad.x, y: controls.attackPad.y }, 'pause');
  assert.equal(controls.getActions('pause', 1).attack, true);
  controls.handlePointerUp({ id: 'touch-a' }, 'pause');

  controls.handlePointerDown({ id: 'touch-jump', x: controls.bButton.x, y: controls.bButton.y }, 'pause');
  assert.equal(controls.getActions('pause', 1).jump, true);
});

test('landscape handheld controls stay on side rails', () => {
  const controls = new MobileControls();
  const layout = getLandscapeHandheldLayout(960, 540);
  controls.setViewport({
    width: 960,
    height: 540,
    isMobile: true,
    controlsBounds: layout.controlsDeck,
    controlsLayout: layout
  });

  assert.ok(controls.joystick.center.x < layout.screen.x);
  assert.ok(controls.attackPad.x > layout.screen.x + layout.screen.w);
  assert.ok(controls.bButton.x > layout.screen.x + layout.screen.w);
  assert.ok(controls.joystick.radius >= 58);
  assert.ok(controls.attackPad.r >= 36);
  assert.ok(controls.joystick.center.y > layout.leftRail.y + layout.leftRail.h * 0.52);
  assert.ok(controls.attackPad.y > layout.rightRail.y + layout.rightRail.h * 0.28);
  assert.ok(controls.bButton.y > layout.rightRail.y + layout.rightRail.h * 0.55);
  assert.ok(Math.hypot(controls.attackPad.x - controls.bButton.x, controls.attackPad.y - controls.bButton.y) >= controls.attackPad.r * 3.1);
  assert.ok(controls.selectButton.x + controls.selectButton.w <= layout.leftRail.x + layout.leftRail.w);
  assert.ok(controls.startButton.x >= layout.rightRail.x);
  assert.ok(controls.startButton.y >= layout.rightRail.y + 28);
  assert.ok(controls.selectButton.y >= layout.leftRail.y + 28);
  assert.ok(controls.startButton.y + controls.startButton.h < controls.attackPad.y - controls.attackPad.r);
  assert.ok(controls.startButton.y < layout.screen.y + layout.screen.h * 0.28);
  assert.ok(controls.selectButton.y < layout.screen.y + layout.screen.h * 0.28);
});

test('pill button labels are drawn inside the button body', () => {
  const controls = new MobileControls();
  const textCalls = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    roundRect() {},
    rect() {},
    fill() {},
    stroke() {},
    fillText(label, x, y) {
      textCalls.push({ label, x, y });
    },
    set fillStyle(value) { this._fillStyle = value; },
    set strokeStyle(value) { this._strokeStyle = value; },
    set lineWidth(value) { this._lineWidth = value; },
    set font(value) { this._font = value; },
    set textAlign(value) { this._textAlign = value; },
    set textBaseline(value) { this._textBaseline = value; }
  };
  const button = { label: 'START', x: 100, y: 30, w: 64, h: 24 };

  controls.drawPillButton(ctx, button, false);

  assert.equal(textCalls.length, 1);
  assert.equal(textCalls[0].label, 'START');
  assert.ok(textCalls[0].y >= button.y);
  assert.ok(textCalls[0].y <= button.y + button.h);
});
