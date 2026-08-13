import assert from 'node:assert/strict';
import test from 'node:test';

import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const CONFIG = Object.freeze({
  chassisHz: 120,
  tireHz: 360,
  massKg: 1450,
  bodyLengthM: 4.6,
  bodyWidthM: 1.84,
  bodyHeightM: 1.46,
  bodyGroundClearanceM: 0.12,
  cgHeightM: 0.55,
  handlingPreset: 'simulation',
  telemetryRetention: 'none',
  bodyCollisionToleranceM: 0.008
});

function emptyTireResult() {
  return {
    worldForceN: {},
    worldMomentNm: {},
    suspensionForceWorldN: {},
    wheelLoadsN: {},
    wheelSlip: {},
    suspensionTravel: {},
    tireForcesN: {},
    wheelAngularVelocityRadps: {},
    contactPatches: {},
    suspensionState: {},
    grounded: false,
    groundHeightM: null
  };
}

function flatTerrain(point = {}) {
  return {
    valid: true,
    heightM: 0,
    normal: { x: 0, y: 1, z: 0 },
    queryPosition: point,
    source: 'recovery-tier-flat',
    triangleId: 'flat-0'
  };
}

function createTierRunner({ penetrationM = 0, initialState = {}, allBelow = false } = {}) {
  let routeRecoveryRequests = 0;
  const runner = new VehicleDynamicsRunner({
    config: CONFIG,
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      velocity: { x: 0, y: 0, z: 8 },
      grounded: false,
      ...initialState
    },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      externalForceWorldN: { x: 0, y: CONFIG.massKg * 9.81, z: 0 },
      routeDistanceM: 75,
      sampleTerrainAtWorldPoint: flatTerrain,
      getRouteRecoveryState: () => {
        routeRecoveryRequests += 1;
        return {
          position: { x: 0, y: 0.8, z: -2 },
          velocity: {},
          angularVelocityWorld: {},
          routeDistance: 74,
          sourceKey: 'route|74|flat-0|car'
        };
      }
    })
  });
  runner.bodyCollision.step = () => ({
    linearImpulseWorldNs: {},
    angularImpulseWorldNms: {},
    positionalCorrectionWorldM: {},
    contacts: [],
    bodyNormalImpulseNs: 0,
    bodyFrictionImpulseNs: 0,
    restitutionContributionNs: 0,
    penetrationBiasContributionNs: 0,
    maximumPenetrationM: penetrationM,
    residualPenetrationM: penetrationM,
    safePoseRollbackFraction: null
  });
  runner.bodyCollision.samplePosePenetration = (pose) => {
    const resolvedPenetrationM = Number(pose.position?.z || 0) < -1
      ? -0.05 : penetrationM;
    return {
      maximumPenetrationM: resolvedPenetrationM,
      minimumPenetrationM: resolvedPenetrationM,
      deepestNormal: { x: 0, y: 1, z: 0 },
      invalidTerrainSampleCount: 0,
      allBodySamplesBelowTerrain: allBelow && resolvedPenetrationM > 0,
      allTerrainSamplesInvalid: false,
      terrainTriangleIds: ['flat-0'],
      terrainSources: ['recovery-tier-flat']
    };
  };
  runner.state.routeDistance = 75;
  return { runner, routeRecoveryRequests: () => routeRecoveryRequests };
}

for (const fixture of [
  { name: '5 mm underbody scrape for ten seconds', penetrationM: 0.005, durationSeconds: 10 },
  { name: '15 mm persistent overlap', penetrationM: 0.015, durationSeconds: 1 },
  { name: '30 mm bottom-out', penetrationM: 0.03, durationSeconds: 1 }
]) {
  test(`${fixture.name} remains ordinary contact without a gameplay reset`, () => {
    const { runner, routeRecoveryRequests } = createTierRunner(fixture);
    runner.advance(fixture.durationSeconds);
    runner.drainCatchUp();
    assert.deepEqual(runner.penetrationRecoveryState.history, []);
    assert.equal(runner.contactStabilizationState.gameplayResetCount, 0);
    assert.equal(runner.contactStabilizationState.localCcdRollbackCount, 0);
    assert.equal(routeRecoveryRequests(), 0);
    assert.equal(runner.state.routeDistance, 75);
    assert.equal(Math.abs(runner.state.velocity.z - 8) < 1e-9, true,
      'ordinary correction must preserve terrain-tangent velocity');
    if (fixture.penetrationM > CONFIG.bodyCollisionToleranceM) {
      assert.equal(runner.contactStabilizationState.ordinaryCorrectionCount > 0, true);
    }
  });
}

test('temporary invalid terrain for one to ten tire substeps never resets the car', () => {
  let environmentCalls = 0;
  let routeRecoveryRequests = 0;
  const runner = new VehicleDynamicsRunner({
    config: CONFIG,
    initialState: { position: { x: 0, y: 0.8, z: 0 }, velocity: { y: -2 } },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => {
      environmentCalls += 1;
      const unavailable = environmentCalls <= 10;
      return {
        airDensityKgM3: 0,
        requireValidTerrainEnvelope: true,
        terrainUnavailable: unavailable,
        sampleTerrainAtWorldPoint: unavailable ? () => ({
          valid: false,
          reason: 'temporary-stream-gap',
          source: 'temporary-invalid'
        }) : flatTerrain,
        getRouteRecoveryState: () => {
          routeRecoveryRequests += 1;
          return null;
        }
      };
    }
  });
  runner.bodyCollision.step = () => ({
    linearImpulseWorldNs: {}, angularImpulseWorldNms: {}, positionalCorrectionWorldM: {},
    contacts: [], bodyNormalImpulseNs: 0, bodyFrictionImpulseNs: 0,
    restitutionContributionNs: 0, penetrationBiasContributionNs: 0
  });
  runner.bodyCollision.samplePosePenetration = (_state, environment) => ({
    maximumPenetrationM: environment.terrainUnavailable ? null : 0,
    minimumPenetrationM: environment.terrainUnavailable ? null : 0,
    deepestNormal: { x: 0, y: 1, z: 0 },
    invalidTerrainSampleCount: environment.terrainUnavailable ? 100 : 0,
    allBodySamplesBelowTerrain: false,
    allTerrainSamplesInvalid: environment.terrainUnavailable
  });
  runner.advance(3 / 120);
  assert.equal(runner.state.velocity.y >= -1e-9, true,
    'unknown support removes unsafe inward motion while terrain is unavailable');
  runner.advance(1 / 120);
  assert.deepEqual(runner.penetrationRecoveryState.history, []);
  assert.equal(runner.contactStabilizationState.gameplayResetCount, 0);
  assert.equal(runner.contactStabilizationState.temporaryInvalidTerrainCount, 1);
  assert.equal(runner.contactStabilizationState.invalidTerrainDurationSeconds, 0);
  assert.equal(routeRecoveryRequests, 0);
});

test('100 mm local penetration rolls back to the local collision frame without route motion', () => {
  const { runner, routeRecoveryRequests } = createTierRunner({ penetrationM: 0.1 });
  runner.lastValidLocalCollisionFrame = runner.createLocalCollisionFrame(
    runner.state,
    emptyTireResult(),
    { stepIndex: 0, substepIndex: 0, routeDistanceM: 75 }
  );
  runner.advance(1 / 120);
  assert.deepEqual(runner.penetrationRecoveryState.history, []);
  assert.equal(runner.contactStabilizationState.localCcdRollbackCount > 0, true);
  assert.equal(runner.contactStabilizationState.gameplayResetCount, 0);
  assert.equal(routeRecoveryRequests(), 0);
  assert.equal(Math.abs(runner.state.velocity.z - 8) < 1e-9, true,
    'local rollback must preserve terrain-tangent velocity');
  assert.equal(runner.contactStabilizationState.history.every((event) => (
    event.routeDistanceBefore === event.routeDistanceAfter
  )), true);
});

test('a separating hill overlap does not roll back into the contact and can back away', () => {
  const { runner, routeRecoveryRequests } = createTierRunner({
    penetrationM: 0.1,
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      velocity: { x: 0, y: 0, z: -2 }
    }
  });
  runner.bodyCollision.step = () => ({
    linearImpulseWorldNs: {}, angularImpulseWorldNms: {}, positionalCorrectionWorldM: {},
    contacts: [{
      id: 'hill-face',
      arm: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: 0, z: -1 },
      penetrationM: 0.1
    }],
    bodyNormalImpulseNs: 0, bodyFrictionImpulseNs: 0,
    restitutionContributionNs: 0, penetrationBiasContributionNs: 0,
    maximumPenetrationM: 0.1, residualPenetrationM: 0.1,
    safePoseRollbackFraction: null
  });
  runner.bodyCollision.samplePosePenetration = () => ({
    maximumPenetrationM: 0.1,
    minimumPenetrationM: 0.1,
    deepestNormal: { x: 0, y: 0, z: -1 },
    invalidTerrainSampleCount: 0,
    allBodySamplesBelowTerrain: false,
    allTerrainSamplesInvalid: false,
    terrainTriangleIds: ['hill-face'],
    terrainSources: ['recovery-tier-hill']
  });
  runner.lastValidLocalCollisionFrame = runner.createLocalCollisionFrame(
    { ...runner.state, position: { ...runner.state.position, z: 0.25 } },
    emptyTireResult(),
    { stepIndex: 0, substepIndex: 0, routeDistanceM: 75 }
  );

  runner.advance(1 / 120);

  assert.equal(runner.state.position.z < 0,
    true, 'separating motion must not be snapped back to the previous collision frame');
  assert.equal(runner.state.velocity.z < -1.9, true);
  assert.equal(runner.contactStabilizationState.localCcdRollbackCount, 0);
  assert.equal(runner.contactStabilizationState.gameplayResetCount, 0);
  assert.equal(routeRecoveryRequests(), 0);
});

test('400 mm body submersion performs one deterministic catastrophic gameplay recovery', () => {
  const run = () => {
    const { runner } = createTierRunner({ penetrationM: 0.4, allBelow: true });
    runner.advance(1 / 120);
    return {
      history: runner.penetrationRecoveryState.history,
      stabilization: runner.contactStabilizationState,
      state: runner.createStateSnapshot()
    };
  };
  const first = run();
  const second = run();
  assert.deepEqual(second, first);
  assert.equal(first.history.length, 1);
  assert.equal(first.stabilization.gameplayResetCount, 1);
  assert.equal(first.stabilization.catastrophicRouteRecoveryCount, 1);
  assert.equal(first.history[0].reason, 'catastrophic-body-penetration');
});

test('a non-finite authoritative state still takes the catastrophic recovery path', () => {
  const { runner } = createTierRunner();
  runner.state.position.x = Number.NaN;
  runner.advance(1 / 120);
  assert.equal(runner.penetrationRecoveryState.history.length, 1);
  assert.equal(runner.penetrationRecoveryState.history[0].reason, 'non-finite-vehicle-state');
  assert.equal(runner.contactStabilizationState.gameplayResetCount, 1);
  assert.equal(Number.isFinite(runner.state.position.x), true);
});
