import assert from 'node:assert/strict';
import test from 'node:test';

import { rotateVectorByQuaternion, quaternionFromEuler }
  from '../../src/racing/simulation/RigidBodyMath.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

const idleInput = {
  isDown: () => false,
  isDownCode: () => false,
  wasPressed: () => false,
  wasPressedCode: () => false
};

test('exact physical Select hold uses public gamepad state and performs an upright center reset', () => {
  let selectDown = true;
  let selectPressed = true;
  const gamepadInput = {
    getGamepadActions: () => ({ gamepadSelect: selectDown }),
    isGamepadDown: (action) => action === 'gamepadSelect' && selectDown,
    wasGamepadPressed: (action) => action === 'gamepadSelect' && selectPressed,
    gamepadPressed: new Set()
  };
  const editor = new RaceEditor({
    deviceIsMobile: false, isMobile: false, input: gamepadInput, exitRaceEditor() {}
  });
  editor.startPlaytest('starter-rwd');
  editor.updatePlaytestSafely(0);
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.distance = 137;
  editor.playtestSession.worldX += 8;
  editor.playtestSession.vehicleDynamicsRunner.state.orientation = quaternionFromEuler({
    yaw: 0.35, pitch: 0, roll: 80 * Math.PI / 180
  });
  for (let frame = 0; frame < 62; frame += 1) {
    editor.updateRaceKeyboardInput(idleInput, 1 / 60);
    selectPressed = false;
  }
  assert.equal(editor.playtestSession.pendingEdgeCenterReset?.distance, 137);
  assert.equal(editor.playtestSession.pendingEdgeCenterReset?.reason, 'select-hold-reset');
  assert.equal(editor.raceInput.cameraView, 'third-person');
  editor.playtestSession.edgeResetFadeMs = 0;
  editor.updateRaceEdgeCenterResetFade();
  const pose = editor.getRaceWorldPoseAtDistance(137);
  assert.ok(Math.hypot(
    editor.playtestSession.worldX - pose.x,
    editor.playtestSession.worldZ - pose.z
  ) < 0.01);
  const up = rotateVectorByQuaternion(
    { x: 0, y: 1, z: 0 }, editor.playtestSession.vehicleDynamicsRunner.state.orientation
  );
  assert.ok(up.y > 0.9);
  assert.equal(editor.playtestSession.vehicleDynamicsRunner.state.supportedWheelCount, 4);
  selectDown = false;
  editor.updateRaceKeyboardInput(idleInput, 1 / 60);
  assert.equal(editor.raceInput.cameraView, 'third-person');
});

test('exact hill reset retries a rejected first support solve before fading in', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.updatePlaytestSafely(0);
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.distance = 137;
  const runner = session.vehicleDynamicsRunner;
  runner.state.orientation = quaternionFromEuler({
    yaw: 0.35, pitch: 0.2, roll: Math.PI
  });
  const originalReset = runner.resetAuthoritativeState.bind(runner);
  const attemptedGenerations = [];
  let attempts = 0;
  runner.resetAuthoritativeState = (...args) => {
    attempts += 1;
    if (attempts === 1) {
      const environmentProvider = runner.environmentProvider;
      runner.environmentProvider = () => {
        throw new Error('stale prepared hill terrain frame');
      };
      try {
        return originalReset(...args);
      } finally {
        attemptedGenerations.push(runner.authoritativeResetAttemptSequence);
        runner.environmentProvider = environmentProvider;
      }
    }
    const result = originalReset(...args);
    attemptedGenerations.push(runner.authoritativeResetAttemptSequence);
    return result;
  };
  editor.resetRaceCarToRouteCenter({
    projection: { distance: 137 }, reason: 'select-hold-reset'
  });
  session.edgeResetFadeMs = 0;
  editor.updateRaceEdgeCenterResetFade();
  assert.equal(session.pendingEdgeCenterReset?.moved, false);
  assert.equal(session.pendingEdgeCenterReset?.attempts, 1);
  assert.ok(session.edgeResetFadeMs > 0);
  const stillOverturnedUp = rotateVectorByQuaternion(
    { x: 0, y: 1, z: 0 }, runner.state.orientation
  );
  assert.ok(stillOverturnedUp.y < 0);
  editor.updateRaceEdgeCenterResetFade();
  assert.equal(session.pendingEdgeCenterReset?.moved, true);
  assert.equal(session.pendingEdgeCenterReset?.attempts, 2);
  assert.equal(attemptedGenerations[1] > attemptedGenerations[0], true);
  const up = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, runner.state.orientation);
  assert.ok(up.y > 0.9);
  assert.equal(runner.state.supportedWheelCount, 4);
});

test('exact Car Editor preview Select hold performs an upright authoritative reset', () => {
  let selectDown = true;
  let selectPressed = true;
  const gamepadInput = {
    getGamepadActions: () => ({ gamepadSelect: selectDown }),
    isGamepadDown: (action) => action === 'gamepadSelect' && selectDown,
    wasGamepadPressed: (action) => action === 'gamepadSelect' && selectPressed,
    gamepadPressed: new Set()
  };
  const editor = new RaceEditor({
    deviceIsMobile: false, isMobile: false, input: gamepadInput, exitRaceEditor() {}
  });
  editor.mode = 'car';
  editor.startPlaytest('starter-rwd');
  editor.updatePlaytestSafely(0);
  const preview = {
    key: 'upright-reset-preview',
    raceId: editor.playtestSession.raceId,
    carId: editor.playtestSession.carId,
    session: editor.playtestSession,
    input: editor.raceInput
  };
  preview.session.carEditorPreview = true;
  preview.session.countdownRemainingMs = 0;
  preview.session.distance = 84;
  preview.session.vehicleDynamicsRunner.state.orientation = quaternionFromEuler({
    yaw: 0.25, pitch: 0, roll: Math.PI / 2
  });
  editor.carEditorPreviewPlaytest = preview;
  editor.ensureCarEditorPreviewPlaytestSession = () => preview;
  editor.playtestSession = null;

  for (let frame = 0; frame < 62; frame += 1) {
    editor.updateCarEditorPreviewSelectHold(idleInput, 1 / 60);
    selectPressed = false;
  }

  assert.equal(preview.session.pendingEdgeCenterReset?.reason, 'select-hold-reset');
  preview.session.edgeResetFadeMs = 0;
  editor.bindCarEditorPreviewPlaytest(() => editor.updateRaceEdgeCenterResetFade());
  const up = rotateVectorByQuaternion(
    { x: 0, y: 1, z: 0 },
    preview.session.vehicleDynamicsRunner.state.orientation
  );
  assert.ok(up.y > 0.5);
  assert.equal(preview.session.speedMps, 0);
  assert.equal(preview.session.pendingEdgeCenterReset, null);
  selectDown = false;
});

test('exact stationary upside-down recovery waits two seconds then uses the Select reset transaction', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.updatePlaytestSafely(0);
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.distance = 93;
  const runner = session.vehicleDynamicsRunner;
  runner.state.orientation = quaternionFromEuler({ yaw: 0.4, pitch: 0, roll: Math.PI });
  runner.state.velocity = { x: 0, y: 0, z: 0 };
  runner.state.angularVelocityWorld = { x: 0, y: 0, z: 0 };
  runner.state.bodyGrounded = true;
  runner.state.grounded = false;
  runner.state.supportedWheelCount = 0;
  for (let frame = 0; frame < 119; frame += 1) {
    assert.equal(editor.updateRaceAutomaticVehicleRecovery(1 / 60), false);
  }
  assert.equal(Boolean(session.pendingEdgeCenterReset), false);
  assert.equal(editor.updateRaceAutomaticVehicleRecovery(1 / 60), true);
  assert.equal(session.pendingEdgeCenterReset?.distance, 93);
  assert.equal(session.pendingEdgeCenterReset?.reason, 'automatic-upside-down');
  assert.equal(session.automaticVehicleResetCount, 1);
  session.edgeResetFadeMs = 0;
  editor.updateRaceEdgeCenterResetFade();
  assert.equal(session.lastVehicleResetReason, 'automatic-upside-down');
  assert.equal(session.vehicleRenderState.wheelPoses
    ? Object.keys(session.vehicleRenderState.wheelPoses).length
    : Object.keys(session.vehicleRenderState.wheels).length, 4);
  const up = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, runner.state.orientation);
  assert.ok(up.y > 0.5);
});

test('exact automatic recovery does not interrupt a moving inverted vehicle', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.startPlaytest('starter-rwd');
  editor.updatePlaytestSafely(0);
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  const state = session.vehicleDynamicsRunner.state;
  state.orientation = quaternionFromEuler({ yaw: 0, pitch: 0, roll: Math.PI });
  state.velocity = { x: 3, y: 0, z: 0 };
  state.angularVelocityWorld = { x: 0, y: 0, z: 1 };
  state.bodyGrounded = true;
  for (let frame = 0; frame < 240; frame += 1) {
    editor.updateRaceAutomaticVehicleRecovery(1 / 60);
  }
  assert.equal(Boolean(session.pendingEdgeCenterReset), false);
  assert.equal(session.automaticVehicleResetCount, 0);
  assert.equal(session.upsideDownRecoveryMs, 0);
});
