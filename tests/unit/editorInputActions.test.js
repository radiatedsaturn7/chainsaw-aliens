import test from 'node:test';
import assert from 'node:assert/strict';

import Input from '../../src/game/Input.js';
import {
  EDITOR_INPUT_ACTIONS,
  EditorInputActionNormalizer,
  SHARED_EDITOR_GAMEPAD_BINDINGS
} from '../../src/ui/shared/input/editorInputActions.js';

const createFakeInput = ({ actions = {}, axes = {}, connected = true } = {}) => ({
  isGamepadConnected: () => connected,
  getGamepadActions: () => actions,
  isGamepadDown: (action) => Boolean(actions[action]),
  getGamepadAxes: () => ({
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    ...axes
  })
});

test('normalizes shared editor button presses for X undo, Y redo, and L3 options', () => {
  const normalizer = new EditorInputActionNormalizer();
  let frame = normalizer.updateGamepad(createFakeInput({ actions: { rev: true } }), 0.016, {
    semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS
  });
  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.UNDO), true);
  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.REDO), false);

  frame = normalizer.updateGamepad(createFakeInput({ actions: { rev: false } }), 0.016, {
    semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS
  });
  assert.equal(frame.released.rev, true);

  frame = normalizer.updateGamepad(createFakeInput({ actions: { throw: true, l3: true } }), 0.016, {
    semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS
  });
  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.REDO), true);
  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.TOOL_OPTIONS), true);
});

test('normalizes d-pad repeats, pan stick, and trigger zoom values', () => {
  const normalizer = new EditorInputActionNormalizer({ dpadRepeatDelay: 0.1 });
  let frame = normalizer.updateGamepad(createFakeInput({
    actions: { dpadRight: true },
    axes: { rightX: 0.5, rightY: -0.25, leftTrigger: 0.2, rightTrigger: 0.8 }
  }), 0.016, {
    semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS,
    includePanIntent: true,
    includeZoomIntent: true
  });

  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.NAV_RIGHT), true);
  assert.deepEqual(
    frame.actions.find((action) => action.type === EDITOR_INPUT_ACTIONS.PAN),
    { type: EDITOR_INPUT_ACTIONS.PAN, source: 'gamepad', dx: 0.5, dy: -0.25 }
  );
  assert.equal(frame.actions.find((action) => action.type === EDITOR_INPUT_ACTIONS.ZOOM)?.value, 0.6000000000000001);
  assert.equal(frame.triggers.rtHeld, true);
  assert.equal(frame.triggers.rtPressed, true);

  frame = normalizer.updateGamepad(createFakeInput({ actions: { dpadRight: true } }), 0.11, {
    semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS
  });
  assert.equal(frame.actions.some((action) => action.type === EDITOR_INPUT_ACTIONS.NAV_RIGHT && action.repeat), true);
});

test('virtual gamepad counts as connected for editor testing', () => {
  const listeners = new Map();
  globalThis.window = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type)
  };
  globalThis.document = { hidden: false };
  Object.defineProperty(globalThis, 'navigator', {
    value: { getGamepads: () => [] },
    configurable: true
  });

  const input = new Input();
  assert.equal(input.isGamepadConnected(), false);
  input.setVirtualGamepad({ actions: { jump: true }, axes: { leftX: 0.5 } });
  assert.equal(input.isGamepadConnected(), true);
  assert.equal(input.wasGamepadPressed('jump'), true);
  assert.equal(input.getGamepadActions().jump, true);
  assert.equal(input.getGamepadAxes().leftX, 0.5);
  input.destroy();
});

test('unknown input actions do not throw and still support virtual editor actions', () => {
  const listeners = new Map();
  globalThis.window = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type)
  };
  globalThis.document = { hidden: false };
  Object.defineProperty(globalThis, 'navigator', {
    value: { getGamepads: () => [] },
    configurable: true
  });

  const input = new Input();
  assert.equal(input.isDown('undo'), undefined);
  assert.equal(input.wasPressed('undo'), false);
  assert.equal(input.wasReleased('redo'), false);

  input.setVirtual({ undo: true });
  assert.equal(input.isDown('undo'), true);
  assert.equal(input.wasPressed('undo'), true);
  input.flush();
  input.setVirtual({ undo: false });
  assert.equal(input.wasReleased('undo'), true);
  input.destroy();
});
