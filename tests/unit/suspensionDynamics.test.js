import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSuspensionDefinition, solveSuspensionGeometry } from '../../src/racing/simulation/SuspensionGeometry.js';
import { resolveContactFootprint } from '../../src/racing/simulation/ContactFootprint.js';
import { ContactPatchTireModel } from '../../src/racing/simulation/ContactPatchTireModel.js';
import { createVehicleDynamicsConfig, createVehicleDynamicsState } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { DEFAULT_CAR_TUNING, RACE_CAR_DIMENSIONS, WRX_2022_SHARED_TUNING } from '../../src/racing/raceData.js';

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
  assert.equal(curb.heightM, 0.12);
  assert.ok(Math.abs(curb.pressureBySample.reduce((sum, pressure) => sum + pressure, 0) - 1) < 1e-9);
  const gap = resolveContactFootprint([
    { heightM: 0 }, { heightM: 0 }, { heightM: -1 }, { heightM: -1 },
    { supported: false }, { supported: false }
  ], { maxGapM: 0.2, minimumSamples: 6 });
  assert.ok(gap.supportedFraction <= 1 / 3);
  assert.ok(gap.samples.every((sample) => sample.heightM === -1 || sample.heightM === 0));
  const curbEdge = resolveContactFootprint([
    { heightM: 0 }, { heightM: 0 }, { heightM: 0.22 }, { heightM: 0.22 }
  ]);
  assert.equal(curbEdge.heightM, 0.22);
  assert.equal(curbEdge.supportedFraction, 0.5);
  assert.equal(curbEdge.samples.every(({ heightM }) => heightM === 0.22), true);
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
    bottom = step({ fl: 0.14, fr: 0.14, rl: 0.14, rr: 0.14 });
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

function createCoupledSuspensionFixture(overrides = {}) {
  const config = createVehicleDynamicsConfig({
    suspensionTravelM: 0.2,
    staticSagRatio: 0.42,
    tireHz: 360,
    contactFootprintSamples: 4,
    ...overrides
  });
  const model = new ContactPatchTireModel();
  let state = createVehicleDynamicsState({ position: { y: config.cgHeightM } });
  const controls = { steering: 0, throttle: 0, brake: 0, requestedGear: 1 };
  const step = (heights, { normals = {}, grounded = true, samples = null } = {}) => {
    const result = model.step({
      state,
      controls,
      config,
      dt: 1 / config.tireHz,
      environment: {
        surfaceHeightByWheel: heights,
        surfaceNormalByWheel: normals,
        contactSamplesByWheel: samples,
        grounded
      }
    });
    state = {
      ...state,
      suspensionState: result.suspensionState,
      wheelAngularVelocityRadps: result.wheelAngularVelocityRadps
    };
    return result;
  };
  return { config, get state() { return state; }, step };
}

test('static settlement leaves data-driven bump and droop reserve including the WRX', () => {
  const wrx = createVehicleDynamicsConfigFromTuning({
    ...DEFAULT_CAR_TUNING,
    ...WRX_2022_SHARED_TUNING,
    ...RACE_CAR_DIMENSIONS['wrx-2022']
  });
  const fixture = createCoupledSuspensionFixture(wrx);
  const flat = fixture.step({ fl: 0, fr: 0, rl: 0, rr: 0 });
  for (const wheelId of ['fl', 'fr', 'rl', 'rr']) {
    const suspension = flat.suspensionState[wheelId];
    assert.ok(suspension.compressionRatio > 0.3 && suspension.compressionRatio < 0.55);
    assert.ok(suspension.bumpTravelM > 0.07);
    assert.ok(suspension.droopTravelM > 0.05);
    assert.equal(Math.abs(suspension.compressionM - suspension.staticSagTargetM) < 0.00001, true);
    assert.equal(Math.abs(flat.wheelLoadsN[wheelId]
      - wrx.massKg * 9.81 * (wheelId[0] === 'f' ? wrx.frontWeightDistribution : 1 - wrx.frontWeightDistribution) / 2) < 2, true);
  }
});

test('one-wheel bump and diagonal articulation move physical hub positions', () => {
  const fixture = createCoupledSuspensionFixture();
  const flatHeights = { fl: 0, fr: 0, rl: 0, rr: 0 };
  let result = fixture.step(flatHeights);
  const initialHubY = result.suspensionState.fl.hubPositionWorld.y;
  for (let index = 0; index < 80; index += 1) {
    result = fixture.step({ fl: 0.1, fr: 0, rl: 0, rr: 0.06 });
  }
  assert.ok(result.suspensionState.fl.hubPositionWorld.y > initialHubY + 0.04);
  assert.ok(result.suspensionState.rr.hubPositionWorld.y > result.suspensionState.rl.hubPositionWorld.y + 0.02);
  assert.ok(result.suspensionState.fl.compressionM > result.suspensionState.fr.compressionM);
  assert.notDeepEqual(result.contactPatches.fl.contactPointWorld, result.contactPatches.fr.contactPointWorld);
});

test('curb edge and pothole samples never create an averaged phantom hub plane', () => {
  const fixture = createCoupledSuspensionFixture();
  const flat = [{ heightM: 0 }, { heightM: 0 }, { heightM: 0 }, { heightM: 0 }];
  const curb = [{ heightM: 0 }, { heightM: 0 }, { heightM: 0.22 }, { heightM: 0.22 }];
  const pothole = [{ heightM: 0 }, { heightM: 0 }, { heightM: -0.22 }, { heightM: -0.22 }];
  const result = fixture.step(
    { fl: 0, fr: 0, rl: 0, rr: 0 },
    { samples: { fl: curb, fr: pothole, rl: flat, rr: flat } }
  );
  assert.equal(result.suspensionState.fl.footprint.heightM, 0.22);
  assert.equal(result.suspensionState.fr.footprint.heightM, 0);
  assert.equal(result.suspensionState.fl.footprint.samples.some(({ heightM }) => heightM === 0), false);
  assert.equal(result.suspensionState.fr.footprint.samples.some(({ heightM }) => heightM === -0.22), false);
});

test('side slope keeps axis-relative damping and finite bounded normal loads', () => {
  const fixture = createCoupledSuspensionFixture();
  const normal = { x: -0.196116, y: 0.980581, z: 0 };
  let previousLoad = 0;
  for (let index = 0; index < 120; index += 1) {
    const height = index < 60 ? index / 600 : (120 - index) / 600;
    const result = fixture.step(
      { fl: height, rl: height, fr: 0, rr: 0 },
      { normals: { fl: normal, rl: normal, fr: normal, rr: normal } }
    );
    const suspension = result.suspensionState.fl;
    assert.equal(Number.isFinite(result.wheelLoadsN.fl), true);
    assert.ok(result.wheelLoadsN.fl >= 0 && result.wheelLoadsN.fl <= fixture.config.massKg * 9.81 * 1.6);
    assert.equal(Number.isFinite(suspension.hubVelocityWorld.y), true);
    if (index > 0) assert.ok(Math.abs(result.wheelLoadsN.fl - previousLoad) < fixture.config.massKg * 9.81);
    previousLoad = result.wheelLoadsN.fl;
  }
});

test('compression-to-droop, bottom-out, and top-out preserve hub travel limits', () => {
  const fixture = createCoupledSuspensionFixture({ bumpStopStartRatio: 0.72 });
  let result;
  for (let index = 0; index < 160; index += 1) {
    result = fixture.step({ fl: 0.14, fr: 0.14, rl: 0.14, rr: 0.14 });
  }
  const bottomHubY = result.suspensionState.fl.hubPositionWorld.y;
  assert.ok(result.suspensionState.fl.bumpStopForceN > 0);
  assert.equal(result.suspensionState.fl.bumpStopClearanceM, 0);
  assert.ok(result.suspensionState.fl.compressionM <= fixture.config.suspensionTravelFrontM);

  for (let index = 0; index < 180; index += 1) {
    result = fixture.step({}, { grounded: false });
  }
  assert.equal(result.suspensionState.fl.compressionM, 0);
  assert.equal(result.suspensionState.fl.inContact, false);
  assert.ok(result.suspensionState.fl.hubPositionWorld.y < bottomHubY - 0.12);
  assert.equal(Math.abs(result.suspensionState.fl.hubPositionWorld.y
    - (fixture.config.wheelRadiusM - fixture.config.staticSagRatioFront * fixture.config.suspensionTravelFrontM)) < 0.002, true);
});
