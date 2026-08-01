import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSuspensionDefinition, solveSuspensionGeometry } from '../../src/racing/simulation/SuspensionGeometry.js';
import { resolveContactFootprint } from '../../src/racing/simulation/ContactFootprint.js';
import { ContactPatchTireModel } from '../../src/racing/simulation/ContactPatchTireModel.js';
import { createVehicleDynamicsConfig, createVehicleDynamicsState } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('suspension geometry produces camber gain, bump steer, wheel rate, and authored anti geometry', () => {
  const base = { definition: { type: 'double-wishbone', antiDive: 0.4, antiSquat: 0.3 }, staticCamberRad: -0.02,
    staticToeRad: 0.003, springRateNpm: 40000 };
  const droop = solveSuspensionGeometry({ ...base, compressionM: -0.05 });
  const bump = solveSuspensionGeometry({ ...base, compressionM: 0.08 });
  assert.ok(bump.camberRad < droop.camberRad);
  assert.notEqual(bump.toeRad, droop.toeRad);
  assert.ok(bump.wheelRateNpm > 0);
  assert.equal(bump.antiDive, 0.4);
  assert.equal(bump.antiSquat, 0.3);
  assert.ok(bump.casterRad > 0);
  assert.ok(bump.kingpinInclinationRad > 0);
  assert.ok(bump.scrubRadiusM > 0);
  assert.ok(bump.mechanicalTrailM > 0);
  assert.notEqual(bump.rollCenterHeightM, droop.rollCenterHeightM);
});

test('common suspension layouts normalize to finite validated geometry', () => {
  for (const type of ['macpherson', 'double-wishbone', 'multilink', 'trailing-arm', 'solid-axle']) {
    const definition = normalizeSuspensionDefinition({ type, motionRatio: 0.9 });
    const geometry = solveSuspensionGeometry({ definition, compressionM: 0.04, steeringAngleRad: 0.2 });
    assert.equal(geometry.type, type);
    assert.ok(Number.isFinite(geometry.wheelRateNpm));
    assert.ok(Number.isFinite(geometry.steeringAxisTrailMomentArmM));
  }
});

test('footprint supports curbs and partial contact without bridging a pothole gap', () => {
  const curb = resolveContactFootprint([
    { heightM: 0 }, { heightM: 0 }, { heightM: 0.12 }, { heightM: 0.12 },
    { heightM: 0.12 }, { heightM: 0.12 }
  ]);
  assert.ok(curb.supportedFraction > 0.5);
  assert.ok(curb.heightM >= 0 && curb.heightM <= 0.12);
  assert.ok(Math.abs(curb.pressureBySample.reduce((sum, pressure) => sum + pressure, 0) - 1) < 1e-9);
  const gap = resolveContactFootprint([
    { heightM: 0 }, { heightM: 0 }, { heightM: -1 }, { heightM: -1 },
    { supported: false }, { supported: false }
  ], { maxGapM: 0.2, minimumSamples: 6 });
  assert.ok(gap.supportedFraction <= 1 / 3);
  assert.ok(gap.samples.every((sample) => sample.heightM === -1 || sample.heightM === 0));
});

test('unsprung wheel state remains finite through hop, bottoming, bank, and airborne extension', () => {
  const config = createVehicleDynamicsConfig({ suspensionTravelM: 0.2, tireHz: 360,
    bumpStopStartRatio: 0.7, contactFootprintSamples: 4 });
  const model = new ContactPatchTireModel();
  let state = createVehicleDynamicsState({ position: { y: config.cgHeightM } });
  const controls = { steering: 0.4, throttle: 0.5, brake: 0.4, requestedGear: 1 };
  const step = (heights, samples = null, normal = { x: 0.2, y: 0.9797959, z: 0 }, grounded = true) => {
    const result = model.step({ state, controls, config, dt: 1 / 360, environment: {
      surfaceHeightByWheel: heights,
      surfaceNormalByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id) => [id, normal])),
      contactSamplesByWheel: samples,
      grounded
    } });
    state = { ...state, suspensionState: result.suspensionState, wheelAngularVelocityRadps: result.wheelAngularVelocityRadps };
    return result;
  };
  const flat = { fl: 0, fr: 0, rl: 0, rr: 0 };
  step(flat);
  const curbSamples = { fl: [{ heightM: 0.16 }, { heightM: 0.16 }, { heightM: 0 }, { heightM: 0 }],
    fr: Array(4).fill({ heightM: 0 }), rl: Array(4).fill({ heightM: 0 }), rr: Array(4).fill({ heightM: 0 }) };
  const initialVelocity = state.suspensionState.fl.unsprungVelocityMps;
  let curb = step(flat, curbSamples);
  for (let index = 0; index < 24; index += 1) curb = step(flat, curbSamples);
  assert.ok(curb.suspensionState.fl.footprint.supportedFraction > 0);
  assert.notEqual(curb.suspensionState.fl.unsprungVelocityMps, initialVelocity);
  let bottom;
  for (let index = 0; index < 90; index += 1) {
    bottom = step({ fl: 0.3, fr: 0.3, rl: 0.3, rr: 0.3 });
  }
  assert.ok(bottom.suspensionState.fl.bumpStopForceN > 0);
  const bottomCompression = bottom.suspensionState.fl.compressionM;
  let air;
  for (let index = 0; index < 90; index += 1) {
    air = step({}, null, { x: 0, y: 1, z: 0 }, false);
  }
  assert.equal(air.suspensionState.fl.inContact, false);
  assert.ok(air.suspensionState.fl.compressionM < bottomCompression);
  assert.ok(Number.isFinite(air.suspensionState.fl.unsprungVelocityMps));
});
