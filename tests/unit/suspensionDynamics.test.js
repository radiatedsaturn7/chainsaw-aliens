import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSuspensionDefinition, solveSuspensionGeometry } from '../../src/racing/simulation/SuspensionGeometry.js';
import { resolveContactFootprint } from '../../src/racing/simulation/ContactFootprint.js';
import { ContactPatchTireModel } from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfig,
  createVehicleDynamicsState
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
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
  let curb = step(flat, curbSamples);
  for (let index = 0; index < 24; index += 1) curb = step(flat, curbSamples);
  assert.ok(curb.suspensionState.fl.footprint.supportedFraction > 0);
  assert.equal(Number.isFinite(curb.suspensionState.fl.unsprungVelocityMps), true);
  assert.equal(curb.suspensionState.fl.bottomedOut, true);
  assert.ok(curb.suspensionState.fl.hardStopForceN > 0);
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

test('terrain rises through 5, 12, 20, and 30 cm remain load-bearing at full bump', () => {
  const fixture = createCoupledSuspensionFixture({
    suspensionTravelM: 0.15,
    bumpStopStartRatio: 0.72
  });
  const risesM = [0.05, 0.12, 0.2, 0.3];
  for (const riseM of risesM) {
    const result = fixture.step({ fl: riseM, fr: riseM, rl: riseM, rr: riseM });
    for (const wheelId of ['fl', 'fr', 'rl', 'rr']) {
      const suspension = result.suspensionState[wheelId];
      assert.notEqual(suspension.invalidContactReason, 'outside-suspension-reach');
      assert.equal(suspension.validTreadContact, true);
      assert.equal(suspension.terrainSampleValid, true);
      assert.ok(suspension.clampedCompressionM <= suspension.suspensionTravelM);
      if (suspension.rawRequestedCompressionM > suspension.suspensionTravelM) {
        assert.equal(suspension.bottomedOut, true);
        assert.equal(suspension.contactState, 'full-bump-support');
        assert.ok(suspension.overtravelM > 0);
        assert.ok(suspension.bumpStopForceN > 0);
        assert.ok(suspension.hardStopForceN > 0);
        assert.ok(result.wheelLoadsN[wheelId] > 0);
      }
    }
  }
});

test('one wheel can bottom out while the other three retain ordinary support', () => {
  const fixture = createCoupledSuspensionFixture({
    suspensionTravelM: 0.15,
    bumpStopStartRatio: 0.72
  });
  const result = fixture.step({ fl: 0.3, fr: 0, rl: 0, rr: 0 });
  assert.equal(result.suspensionState.fl.contactState, 'full-bump-support');
  assert.equal(result.suspensionState.fl.validTreadContact, true);
  assert.ok(result.suspensionState.fl.hardStopForceN > 0);
  for (const wheelId of ['fr', 'rl', 'rr']) {
    assert.equal(result.suspensionState[wheelId].contactState, 'valid-suspension-support');
    assert.equal(result.suspensionState[wheelId].bottomedOut, false);
    assert.equal(result.suspensionState[wheelId].validTreadContact, true);
  }
});

test('droop loss, airborne proximity, upper overtravel, and invalid terrain are distinct states', () => {
  const localConfig = createVehicleDynamicsConfig({
    suspensionTravelM: 0.15,
    staticSagRatio: 0.4,
    contactFootprintSamples: 4
  });
  const model = new ContactPatchTireModel();
  const run = (positionY, surfaceSamplesByWheel) => model.step({
    state: createVehicleDynamicsState({ position: { x: 0, y: positionY, z: 0 } }),
    controls: { steering: 0, throttle: 0, brake: 0, requestedGear: 1 },
    config: localConfig,
    dt: 1 / 360,
    environment: { surfaceSamplesByWheel }
  });
  const entries = (sample) => Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [
    wheelId, sample
  ]));
  const normal = { x: 0, y: 1, z: 0 };

  const noTerrain = run(localConfig.cgHeightM, entries({
    valid: false,
    heightM: null,
    normal: null,
    reason: 'triangle-query-miss'
  }));
  assert.ok(Object.values(noTerrain.suspensionState).every((suspension) => (
    suspension.contactState === 'no-terrain'
      && suspension.terrainSampleValid === false
      && suspension.invalidContactReason === 'no-terrain'
  )));

  const belowDroop = run(localConfig.cgHeightM + 0.2, entries({
    valid: true, heightM: 0, normal
  }));
  assert.ok(Object.values(belowDroop.suspensionState).every((suspension) => (
    suspension.contactState === 'below-droop-reach'
      && suspension.invalidContactReason === 'outside-suspension-reach'
  )));

  const airborne = run(
    localConfig.cgHeightM + localConfig.suspensionTravelFrontM * localConfig.staticSagRatioFront,
    entries({ valid: true, heightM: 0, normal })
  );
  assert.ok(Object.values(airborne.suspensionState).every((suspension) => (
    suspension.contactState === 'airborne'
      && suspension.invalidContactReason === 'airborne'
  )));

  const fullBump = run(localConfig.cgHeightM, entries({
    valid: true, heightM: 0.3, normal
  }));
  assert.ok(Object.values(fullBump.suspensionState).every((suspension) => (
    suspension.contactState === 'full-bump-support'
      && suspension.validTreadContact === true
      && suspension.overtravelM > 0
  )));
});

test('wheel contact projection converges against one authoritative surface in at most three iterations', () => {
  const fixture = createCoupledSuspensionFixture();
  const queryCounts = { fl: 0, fr: 0, rl: 0, rr: 0 };
  const result = new ContactPatchTireModel().step({
    state: fixture.state,
    controls: { steering: 0, throttle: 0, brake: 0, requestedGear: 1 },
    config: fixture.config,
    dt: 1 / fixture.config.tireHz,
    environment: {
      surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      surfaceNormalByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [
        wheelId, { x: 0, y: 1, z: 0 }
      ])),
      sampleTerrainAtWorldPoint: (point, query) => {
        queryCounts[query.wheelId] += 1;
        return {
          valid: true,
          heightM: 0.1 + point.x * 0.001,
          normal: { x: -0.12, y: 0.992773, z: 0 },
          region: 'road',
          source: 'iterative-test',
          triangleId: 900 + query.wheelId.charCodeAt(0)
        };
      }
    }
  });
  for (const wheelId of ['fl', 'fr', 'rl', 'rr']) {
    const suspension = result.suspensionState[wheelId];
    assert.ok(queryCounts[wheelId] >= 1 && queryCounts[wheelId] <= 3);
    assert.equal(suspension.contactSolveIterationCount, queryCounts[wheelId]);
    assert.equal(suspension.terrainSampleSource, 'iterative-test');
    assert.equal(Number.isFinite(suspension.terrainTriangleId), true);
    assert.equal(suspension.terrainSampleValid, true);
  }
});

function runSmoothUphill({ slope, fps, tireHz = 360 }) {
  const config = createVehicleDynamicsConfig({
    tireHz,
    telemetryRetention: 'none',
    maxCatchUpSteps: 30,
    contactFootprintSamples: 4,
    powertrainTuning: {
      gearRatios: [3.5, 2.1, 1.4, 1, 0.8],
      finalDrive: 4,
      reverseRatio: 3.4,
      idleRpm: 850,
      maxRpm: 6500,
      engineTorqueCurve: [[850, 90], [3500, 220], [6500, 120]]
    }
  });
  const surfaceAt = (point = {}) => {
    const z = Number(point.z);
    if (!Number.isFinite(z)) return {
      valid: false,
      heightM: null,
      normal: null,
      reason: 'invalid-query-position'
    };
    const transition = Math.max(0, Math.min(1, (z + 1) / 2));
    const heightM = z <= -1
      ? 0
      : z >= 1 ? slope * z : slope * (z + 1) * (z + 1) / 4;
    const localGrade = z <= -1 ? 0 : z >= 1 ? slope : slope * transition;
    const normalLength = Math.hypot(localGrade, 1);
    return {
      valid: true,
      heightM,
      normal: { x: 0, y: 1 / normalLength, z: -localGrade / normalLength },
      region: 'road',
      source: 'analytical-uphill',
      triangleId: 100
    };
  };
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: createVehicleDynamicsState({
      position: { x: 0, y: config.cgHeightM, z: -2 },
      velocity: { x: 0, y: 0, z: 10 },
      speedMps: 10,
      groundSpeedMps: 10,
      bodyLongitudinalSpeedMps: 10,
      signedTravelSpeedMps: 10,
      wheelAngularVelocityRadps: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [
        wheelId, 10 / config.wheelRadiusM
      ]))
    }),
    inputTimeline: [{
      timeSeconds: 0,
      input: { steering: 0, throttle: 0, brake: 0, clutch: 0, requestedGear: 3 }
    }],
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: surfaceAt,
      sampleTerrainAtWorldPoints: (points) => points.map(surfaceAt),
      requireValidTerrainEnvelope: true
    })
  });
  const durationSeconds = 0.5;
  for (let elapsed = 0; elapsed < durationSeconds - 1e-12; elapsed += 1 / fps) {
    runner.advance(Math.min(1 / fps, durationSeconds - elapsed));
  }
  runner.drainCatchUp();
  return runner;
}

test('smooth 5%, 10%, and 20% uphill transitions remain supported and render-partition deterministic', () => {
  for (const slope of [0.05, 0.1, 0.2]) {
    const lowFps = runSmoothUphill({ slope, fps: 30 });
    const highFps = runSmoothUphill({ slope, fps: 144 });
    for (const runner of [lowFps, highFps]) {
      assert.deepEqual(runner.penetrationRecoveryState.history, []);
      assert.ok(Object.values(runner.state.suspensionState).every((suspension) => (
        suspension.invalidContactReason !== 'outside-suspension-reach'
          || suspension.contactState === 'below-droop-reach'
      )));
      assert.ok(runner.state.position.y > runner.config.cgHeightM);
    }
    assert.deepEqual(highFps.createStateSnapshot(), lowFps.createStateSnapshot());
  }
});

test('full-bump uphill support remains bounded at 120, 240, and 360 tire Hz', () => {
  for (const tireHz of [120, 240, 360]) {
    const runner = runSmoothUphill({ slope: 0.2, fps: 60, tireHz });
    assert.deepEqual(runner.penetrationRecoveryState.history, []);
    assert.equal(Number.isFinite(runner.state.position.y), true);
    assert.equal(Number.isFinite(runner.state.pitchRad), true);
    assert.ok(Object.values(runner.state.suspensionState).every((suspension) => (
      suspension.terrainSampleValid === true
        && suspension.invalidContactReason !== 'outside-suspension-reach'
    )));
  }
});
