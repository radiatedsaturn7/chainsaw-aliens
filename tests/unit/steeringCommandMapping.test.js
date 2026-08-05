import assert from 'node:assert/strict';
import test from 'node:test';

import { HandlingAssist } from '../../src/racing/simulation/HandlingAssist.js';
import { RACE_CONTROLLER_STEERING } from '../../src/racing/simulation/RaceSimulationConfig.js';
import {
  calculateAuthoritativeSteeringEnvelope,
  calculateWheelContactKinematics,
  classifySteeringResponseTelemetry,
  resolvePhysicalCenterSteeringAngle
} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  VehicleControlInputTimeline,
  normalizeVehicleControlInput
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('authoritative steering envelope responds to front support and aquaplaning', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1500,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const patch = {
    normalLoadN: 4200, suspensionNormalLoadN: 4200,
    gripCoefficient: 1, utilization: 0.2
  };
  const twoWheel = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25, contactPatches: { fl: patch, fr: patch }
  }, config);
  const oneWheel = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25, contactPatches: { fl: patch }
  }, config);
  const aquaplaning = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25,
    contactPatches: {
      fl: { ...patch, normalLoadN: 900 },
      fr: { ...patch, normalLoadN: 900 }
    }
  }, config);
  assert.ok(twoWheel > oneWheel);
  assert.ok(oneWheel > aquaplaning);
  assert.equal(resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, {
    groundSpeedMps: 25, contactPatches: { fl: patch, fr: patch }
  }), twoWheel);
});

test('loose-surface grip and current utilization do not collapse Sport rack authority', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1550,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const patch = (gripCoefficient, utilization) => ({
    normalLoadN: 4400, suspensionNormalLoadN: 4400,
    gripCoefficient, utilization
  });
  const clean = { groundSpeedMps: 24.6, contactPatches: {
    fl: patch(1.05, 0.05), fr: patch(1.05, 0.05)
  } };
  const poweredGravel = { groundSpeedMps: 24.6, contactPatches: {
    fl: patch(0.48, 0.96), fr: patch(0.48, 0.96)
  } };
  const cleanAngle = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, clean);
  const gravelAngle = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, poweredGravel);
  assert.equal(gravelAngle, cleanAngle);
  assert.ok(gravelAngle > 0.16, `permitted rack angle ${gravelAngle}`);
  assert.ok(gravelAngle > Math.atan(0.48 * 9.81 * config.wheelbaseM / (24.6 ** 2)) * 4);
});

test('WRX2 Sport rack can command beyond ideal slip-free steering on loose surfaces', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1575,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const surfaces = {
    gravel: 0.52,
    'wet-gravel': 0.4,
    mud: 0.34,
    asphalt: 1.02
  };
  for (const mph of [35, 45, 55]) {
    const speedMps = mph * MPH_TO_MPS;
    for (const [surface, grip] of Object.entries(surfaces)) {
      for (const compound of ['tarmac', 'dirt']) {
        const contact = (utilization) => ({
          normalLoadN: 4480,
          suspensionNormalLoadN: 4480,
          gripCoefficient: grip * (compound === 'dirt' && surface !== 'asphalt' ? 1.08 : 1),
          utilization
        });
        const state = { groundSpeedMps: speedMps, contactPatches: {
          fl: contact(0.98), fr: contact(0.98)
        } };
        const permitted = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, state);
        const unloadedDemand = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, {
          ...state, contactPatches: { fl: contact(0), fr: contact(0) }
        });
        assert.equal(permitted, unloadedDemand, `${mph} mph ${surface} ${compound}`);
        if (surface !== 'asphalt') {
          const idealNoSlip = Math.atan(grip * 9.81 * config.wheelbaseM / (speedMps ** 2));
          assert.ok(permitted > idealNoSlip * 2.5,
            `${mph} mph ${surface} ${compound}: ${permitted} <= ${idealNoSlip}`);
        }
      }
    }
  }
});

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

test('gamepad uses one controller response stage and reaches playability timing targets', () => {
  let output = 0;
  const samples = new Map();
  for (let elapsedMs = 10; elapsedMs <= 400; elapsedMs += 10) {
    output = assist.stepControllerToRackInput({
      mode: 'gamepad', intent: 1, currentOutput: output, seconds: 0.01
    });
    samples.set(elapsedMs, output);
  }
  assert.ok(samples.get(10) > 0.05, `first visible response ${samples.get(10)}`);
  const halfTime = [...samples].find(([, value]) => value >= 0.5)?.[0];
  const ninetyTime = [...samples].find(([, value]) => value >= 0.9)?.[0];
  assert.ok(halfTime >= 100 && halfTime <= 160, `50% at ${halfTime} ms`);
  assert.ok(ninetyTime >= 250 && ninetyTime <= 350, `90% at ${ninetyTime} ms`);
});

test('gamepad controller response is render-partition independent at supported frame rates', () => {
  const run = (fps) => {
    let output = 0;
    for (let frame = 0; frame < fps; frame += 1) {
      output = assist.stepControllerToRackInput({
        mode: 'gamepad', intent: 0.82, currentOutput: output, seconds: 1 / fps
      });
    }
    return output;
  };
  const expected = run(120);
  for (const fps of [30, 60, 90, 120, 144]) {
    assert.ok(Math.abs(run(fps) - expected) < 1e-12, `${fps} FPS response drift`);
  }
});

test('simulation wheel is direct while controller metadata remains replayable', () => {
  assert.equal(assist.stepControllerToRackInput({
    mode: 'simulation-wheel', intent: -0.73, currentOutput: 0.8, seconds: 1 / 30
  }), -0.73);
  const timeline = new VehicleControlInputTimeline([
    { timeSeconds: 0, input: {
      steering: 0, driverSteeringIntent: 0, steeringTarget: 0, controllerFilterOutput: 0
    } },
    { timeSeconds: 1, input: {
      steering: 1, driverSteeringIntent: 1, steeringTarget: 1, controllerFilterOutput: 0.8
    } }
  ]);
  assert.deepEqual(
    Object.fromEntries(['driverSteeringIntent', 'steeringTarget', 'controllerFilterOutput']
      .map((key) => [key, timeline.sampleAt(0.5)[key]])),
    { driverSteeringIntent: 0.5, steeringTarget: 0.5, controllerFilterOutput: 0.4 }
  );
});

test('dirt response diagnostics classify latency, envelope, saturation, drivetrain, ESC, and grip failures', () => {
  const base = {
    inputIntent: 1, steeringTarget: 1, controllerFilterOutput: 1,
    requestedRackAngleRad: 0.3, permittedRackAngleRad: 0.3,
    frontUtilization: { fl: 0.5, fr: 0.5 },
    throttleFrictionCircleUse: { fl: 0, fr: 0 },
    frontGripCoefficients: { fl: 0.6, fr: 0.6 }
  };
  assert.equal(classifySteeringResponseTelemetry({ ...base, controllerFilterOutput: 0.2 }), 'input-latency');
  assert.equal(classifySteeringResponseTelemetry({ ...base, permittedRackAngleRad: 0.1 }), 'steering-envelope-limitation');
  assert.equal(classifySteeringResponseTelemetry({ ...base, frontUtilization: { fl: 0.98, fr: 0.9 } }), 'front-tire-saturation');
  assert.equal(classifySteeringResponseTelemetry({
    ...base, frontUtilization: { fl: 0.9, fr: 0.85 }, throttleFrictionCircleUse: { fl: 0.7, fr: 0.65 }
  }), 'drivetrain-understeer');
  assert.equal(classifySteeringResponseTelemetry({ ...base, escInterventionActive: true }), 'esc-intervention');
  assert.equal(classifySteeringResponseTelemetry({
    ...base, frontGripCoefficients: { fl: 0.3, fr: 0.35 }
  }), 'insufficient-surface-grip');
});
