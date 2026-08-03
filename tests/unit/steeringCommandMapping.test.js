import assert from 'node:assert/strict';
import test from 'node:test';

import { HandlingAssist } from '../../src/racing/simulation/HandlingAssist.js';
import { RACE_CONTROLLER_STEERING } from '../../src/racing/simulation/RaceSimulationConfig.js';
import {
  calculateWheelContactKinematics,
  resolvePhysicalCenterSteeringAngle
} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  VehicleControlInputTimeline,
  normalizeVehicleControlInput
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const MPH_TO_MPS = 0.44704;
const SPEEDS_MPH = [0, 15, 30, 60, 100];
const assist = new HandlingAssist(RACE_CONTROLLER_STEERING);

function command({ mph, mode, input = 1 }) {
  return assist.resolvePhysicalCenterSteeringAngle({
    driverInput: input,
    speedMps: mph * MPH_TO_MPS,
    wheelbaseM: 2.68,
    availableLateralG: 0.95,
    handlingPreset: mode === 'simulation-wheel' ? 'simulation' : 'sport',
    maxPhysicalAngleRad: 0.52
  });
}

for (const mode of ['keyboard', 'gamepad']) {
  test(`${mode} Sport full input remains responsive at low speed and bounded at highway speed`, () => {
    const angles = SPEEDS_MPH.map((mph) => command({ mph, mode }));
    assert.equal(angles[0] > 0.45, true);
    assert.equal(angles[1] > angles[4], true);
    assert.equal(angles[2] > angles[3], true);
    assert.equal(angles[3] < 0.04, true);
    assert.equal(angles[4] < 0.015, true);
  });
}

test('Accessible uses the same safe physical envelope as Sport', () => {
  for (const mph of SPEEDS_MPH) {
    const sport = assist.resolvePhysicalCenterSteeringAngle({
      driverInput: 1, speedMps: mph * MPH_TO_MPS, wheelbaseM: 2.68,
      availableLateralG: 0.95, handlingPreset: 'sport', maxPhysicalAngleRad: 0.52
    });
    const accessible = assist.resolvePhysicalCenterSteeringAngle({
      driverInput: 1, speedMps: mph * MPH_TO_MPS, wheelbaseM: 2.68,
      availableLateralG: 0.95, handlingPreset: 'accessible', maxPhysicalAngleRad: 0.52
    });
    assert.equal(accessible, sport);
  }
});

test('simulation wheel commands the physical rack range directly at every speed', () => {
  for (const mph of SPEEDS_MPH) {
    assert.equal(command({ mph, mode: 'simulation-wheel' }), 0.52);
    assert.equal(Math.abs(command({ mph, mode: 'simulation-wheel', input: -0.4 }) + 0.208) < 1e-12, true);
  }
});

test('explicit center steering angle overrides normalized input before Ackermann', () => {
  const config = {
    maxSteerAngleRad: 0.52,
    steeringRackRatio: 1,
    wheelbaseM: 2.68,
    frontTrackWidthM: 1.58,
    rearTrackWidthM: 1.58,
    frontAxleDistanceFromCgM: 1.3,
    rearAxleDistanceFromCgM: 1.38,
    cgHeightM: 0.55,
    wheelRadiusM: 0.33,
    ackermannRatio: 1,
    camberFrontRad: 0,
    camberRearRad: 0
  };
  const controls = { steering: 1, centerSteeringAngleRad: 0.028 };
  const state = {
    position: { x: 0, y: 0.55, z: 0 },
    velocity: { x: 0, y: 0, z: 27 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    wheelAngularVelocityRadps: {}
  };
  const environment = { surfaceNormalByWheel: {} };
  const fl = calculateWheelContactKinematics({ state, config, controls, environment, wheelId: 'fl' });
  const fr = calculateWheelContactKinematics({ state, config, controls, environment, wheelId: 'fr' });

  assert.equal(resolvePhysicalCenterSteeringAngle(controls, config), 0.028);
  assert.equal(Math.max(fl.steeringAngleRad, fr.steeringAngleRad) < 0.03, true);
  assert.notEqual(fl.steeringAngleRad, fr.steeringAngleRad);
});

test('WRX modest controller input does not become generic maximum lock', () => {
  const angle = command({ mph: 60, mode: 'gamepad', input: 0.35 });
  assert.equal(angle < 0.014, true);
  assert.equal(angle < 0.52 * 0.1, true);
});

test('input timeline keeps normalized driver command separate from physical center angle', () => {
  const first = normalizeVehicleControlInput({
    steering: 1,
    centerSteeringAngleRad: 0.04,
    steeringInputMode: 'keyboard'
  });
  assert.equal(first.steering, 1);
  assert.equal(first.centerSteeringAngleRad, 0.04);
  const timeline = new VehicleControlInputTimeline([
    { timeSeconds: 0, input: first },
    { timeSeconds: 1, input: { ...first, centerSteeringAngleRad: 0.02 } }
  ]);
  const sampled = timeline.sampleAt(0.5);
  assert.equal(sampled.steering, 1);
  assert.equal(sampled.centerSteeringAngleRad, 0.03);
  assert.equal(sampled.steeringInputMode, 'keyboard');
});
