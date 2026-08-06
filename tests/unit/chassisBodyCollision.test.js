import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChassisBodyCollision,
  createChassisBodyContactCandidates
} from '../../src/racing/simulation/ChassisBodyCollision.js';
import {
  addVector3,
  crossVector3,
  quaternionFromEuler,
  rotateVectorByQuaternion,
  scaleVector3
} from '../../src/racing/simulation/RigidBodyMath.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const DT = 1 / 360;
const dotVector3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const CONFIG = Object.freeze({
  massKg: 1450,
  bodyLengthM: 4.6,
  bodyWidthM: 1.84,
  bodyHeightM: 1.46,
  bodyGroundClearanceM: 0.12,
  cgHeightM: 0.55,
  pitchInertiaKgM2: 2100,
  yawInertiaKgM2: 2500,
  rollInertiaKgM2: 980,
  bodyCollisionToleranceM: 0.008,
  bodyCollisionRestitution: 0.06,
  bodyCollisionFriction: 0.65,
  bodyCollisionSolverIterations: 6
});

const terrain = ({ slopeX = 0, crest = false } = {}) => (point) => {
  const crestHeight = crest && Math.abs(point.x) < 0.45 && Math.abs(point.z) < 0.45 ? 0.32 : 0;
  const magnitude = Math.hypot(slopeX, 1);
  return {
    heightM: point.x * slopeX + crestHeight,
    normal: { x: -slopeX / magnitude, y: 1 / magnitude, z: 0 },
    friction: 0.62
  };
};

function createWorking({ heightM, pitch = 0, roll = 0, velocity = {}, angularVelocity = {} }) {
  return {
    position: { x: 0, y: heightM, z: 0 },
    orientation: quaternionFromEuler({ pitch, roll }),
    velocity: { x: 0, y: 0, z: 0, ...velocity },
    angularVelocityWorld: { x: 0, y: 0, z: 0, ...angularVelocity }
  };
}

function minimumClearance(working, sampleTerrain) {
  return Math.min(...createChassisBodyContactCandidates(CONFIG).map(({ localPoint }) => {
    const point = addVector3(
      working.position,
      rotateVectorByQuaternion(localPoint, working.orientation)
    );
    return point.y - sampleTerrain(point).heightM;
  }));
}

function simulate({ working, sampleTerrain = terrain(), steps = 360 }) {
  const collision = new ChassisBodyCollision(CONFIG);
  let maximumContacts = 0;
  for (let index = 0; index < steps; index += 1) {
    working.velocity.y -= 9.81 * DT;
    const result = collision.step({
      workingState: working,
      config: CONFIG,
      environment: { sampleTerrainAtWorldPoint: sampleTerrain },
      dt: DT
    });
    maximumContacts = Math.max(maximumContacts, result.contacts.length);
  }
  return { working, maximumContacts, clearance: minimumClearance(working, sampleTerrain) };
}

function emptyTireResult(overrides = {}) {
  return {
    worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
    wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
    wheelAngularVelocityRadps: {}, contactPatches: {}, suspensionState: {},
    grounded: false, groundHeightM: null,
    ...overrides
  };
}

test('compound body pieces expose dense corners, edges, and faces instead of a sparse cage', () => {
  const candidates = createChassisBodyContactCandidates(CONFIG);
  const ids = candidates.map(({ id }) => id);
  for (const feature of ['corner', 'edge', 'face']) {
    assert.equal(ids.some((id) => id.startsWith('lower-chassis-') && id.includes(feature)), true, feature);
  }
  assert.equal(new Set(candidates.map(({ pieceId }) => pieceId)).size, 4);
  assert.equal(candidates.length >= 100, true);
  const lowerBottomZ = [...new Set(candidates.filter(({ pieceId, localNormals }) => (
    pieceId === 'lower-chassis' && localNormals?.some((normal) => normal.y === -1)
  )).map(({ localPoint }) => Number(localPoint.z.toFixed(6))))].sort((a, b) => a - b);
  const maximumGapM = Math.max(...lowerBottomZ.slice(1).map((value, index) => value - lowerBottomZ[index]));
  assert.equal(maximumGapM <= 0.551, true, `maximum support gap ${maximumGapM}`);
});

test('custom convex pieces generate deterministic edge and face support features', () => {
  const candidates = createChassisBodyContactCandidates({
    ...CONFIG,
    bodyProfile: {
      preset: 'custom',
      customColliders: [{ id: 'wedge', type: 'convex', centerM: {}, sizeM: { x: 2, y: 1, z: 3 },
        vertices: [
          { x: -1, y: -0.5, z: -1.5 }, { x: 1, y: -0.5, z: -1.5 },
          { x: -1, y: -0.5, z: 1.5 }, { x: 1, y: -0.5, z: 1.5 },
          { x: 0, y: 0.5, z: 0 }
        ] }]
    }
  });
  assert.equal(candidates.some(({ id }) => id.includes('-edge-')), true);
  assert.equal(candidates.some(({ id }) => id.includes('-face-')), true);
});

test('compound support adaptively subdivides only a materially varying terrain neighborhood', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const pose = createWorking({ heightM: 0.55 });
  const flat = collision.getAdaptiveSupportWorld(pose, {
    adaptiveBodySupport: true,
    sampleTerrainAtWorldPoint: () => ({ heightM: 0, normal: { x: 0, y: 1, z: 0 } })
  });
  const crest = collision.getAdaptiveSupportWorld(pose, {
    adaptiveBodySupport: true,
    sampleTerrainAtWorldPoint: (point) => ({
      heightM: Math.abs(point.x) < 0.18 ? 0.16 : 0,
      normal: Math.abs(point.x) < 0.18
        ? { x: 0.3, y: 0.954, z: 0 } : { x: 0, y: 1, z: 0 }
    })
  });
  assert.equal(flat.some(({ candidate }) => candidate.adaptive), false);
  assert.equal(crest.some(({ candidate }) => candidate.adaptive), true);
});

test('emergency recovery atomically discards the failed manifold and rebuilds restored contacts', () => {
  let tireCalls = 0;
  let bodyCalls = 0;
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: { position: { x: 0, y: 0.8, z: 0 }, grounded: false },
    tireContactSubsystem: { step: ({ state }) => {
      tireCalls += 1;
      return emptyTireResult({
        suspensionState: { fl: { compressionM: state.position.y > 0 ? 0.123 : 0.299, inContact: true } },
        contactPatches: { fl: { contactPointWorld: { x: 0, y: 0, z: 1 }, validTreadContact: true } }
      });
    } },
    environmentProvider: () => ({ sampleTerrainAtWorldPoint: terrain(), airDensityKgM3: 0 })
  });
  runner.lastNonPenetratingState = runner.createLastNonPenetratingState(
    runner.state, emptyTireResult(), -20
  );
  runner.nonPenetratingStateHistory = [runner.lastNonPenetratingState];
  runner.bodyCollision.step = ({ workingState }) => {
    bodyCalls += 1;
    if (bodyCalls === 1) {
      workingState.position.y = -5;
      return { linearImpulseWorldNs: { y: 900 }, angularImpulseWorldNms: { x: 80 },
        positionalCorrectionWorldM: { y: 0.06 }, contacts: [{ id: 'failed-underbody' }] };
    }
    return { linearImpulseWorldNs: {}, angularImpulseWorldNms: {},
      positionalCorrectionWorldM: {}, contacts: [] };
  };
  runner.bodyCollision.samplePosePenetration = (pose) => ({
    maximumPenetrationM: pose.position.y < 0 ? 1 : -0.1,
    invalidTerrainSampleCount: 0, allBodySamplesBelowTerrain: pose.position.y < 0,
    allTerrainSamplesInvalid: false
  });
  runner.advance(1 / 120);
  assert.equal(tireCalls >= 4, true, 'three ordinary substeps plus restored-state recalculation');
  assert.equal(runner.state.position.y >= 0, true);
  assert.equal(runner.state.suspensionState.fl.compressionM, 0.123);
  const collision = runner.telemetry.at(-1).forces.bodyCollision;
  assert.deepEqual(collision.positionalCorrectionWorldM, { x: 0, y: 0, z: 0 });
  assert.equal(collision.contacts.some(({ id }) => id === 'failed-underbody'), false);
  assert.equal(collision.emergencyRecoveries.length, 1);
});

test('one historical recovery blacklists its source and the next failure escalates to route', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, penetrationFailureStepLimit: 4 },
    initialState: { position: { x: 0, y: 0.8, z: 4 }, velocity: { z: 10 } },
    tireContactSubsystem: { step: () => emptyTireResult() }
  });
  const newest = runner.createLastNonPenetratingState(
    runner.state, emptyTireResult(), 7
  );
  const olderState = { ...runner.state, position: { ...runner.state.position, z: 3.4 } };
  const older = runner.createLastNonPenetratingState(olderState, emptyTireResult(), 6);
  runner.lastNonPenetratingState = newest;
  runner.nonPenetratingStateHistory = [older, newest];
  const state = { ...runner.state, position: { ...runner.state.position, z: 4.1 } };
  const recovery = runner.recoverFromPenetration({ reason: 'repeat', substepState: state,
    environment: { sampleTerrainAtWorldPoint: terrain(), getRouteRecoveryState: () => null }, stepIndex: 9 });
  assert.equal(recovery.rewindDistanceM > 0, true);
  assert.equal(state.position.z, older.position.z);
  assert.equal(recovery.recoveryMode, 'historical');
  assert.equal(recovery.historicalRecoveryCount, 1);
  assert.equal(runner.penetrationRecoveryState.currentIncident.sourceBlacklist.includes(
    older.sourceKey
  ), true);
  const routed = { ...runner.state, position: { ...runner.state.position } };
  const routeRecovery = runner.recoverFromPenetration({ reason: 'blocked-rewind', substepState: routed,
    environment: {
      sampleTerrainAtWorldPoint: () => ({ heightM: 10, normal: { x: 0, y: 1, z: 0 } }),
      getRouteRecoveryState: () => ({
        position: { x: 5, y: 12, z: 5 },
        velocity: {},
        routeDistance: 48,
        sourceKey: 'route|48|hill|car'
      })
    }, stepIndex: 10 });
  assert.equal(routeRecovery.usedRouteRecoveryPath, true);
  assert.equal(routeRecovery.recoveryMode, 'route');
  assert.equal(routeRecovery.historicalRecoveryCount, 1);
  assert.notEqual(routeRecovery.sourceKey, recovery.sourceKey);
});

test('penetration incident circuit breaker caps tangent speed and never reuses a source', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, penetrationRecoveryMaximumTangentSpeedMps: 4 },
    initialState: {
      position: { x: 10, y: 0.8, z: 4 },
      velocity: { x: 20, y: 0, z: 20 }
    },
    tireContactSubsystem: { step: () => emptyTireResult() }
  });
  const safeState = {
    ...runner.state,
    position: { x: 10, y: 0.8, z: 3 },
    velocity: { x: 20, y: 0, z: 20 }
  };
  const safe = runner.createLastNonPenetratingState(safeState, emptyTireResult(), 90);
  runner.lastNonPenetratingState = safe;
  runner.nonPenetratingStateHistory = [safe];
  const environment = {
    sampleTerrainAtWorldPoint: terrain(),
    getRouteRecoveryState: ({ stage }) => stage === 'route' ? {
      position: { x: 10, y: 2, z: 1 },
      orientation: quaternionFromEuler({}),
      velocity: { x: 8, y: 0, z: 8 },
      routeDistance: 91,
      sourceKey: 'route|91|flat|car'
    } : {
      position: { x: 10, y: 2, z: -3 },
      orientation: quaternionFromEuler({}),
      velocity: {},
      routeDistance: 87,
      sourceKey: 'route|87|flat|car'
    }
  };
  const normal = { x: 0, y: 0, z: -1 };
  const firstState = { ...runner.state, position: { ...runner.state.position } };
  const first = runner.recoverFromPenetration({
    reason: 'deep-body-penetration',
    substepState: firstState,
    environment,
    stepIndex: 100,
    blockingNormal: normal
  });
  assert.equal(first.recoveryMode, 'historical');
  assert.ok(Math.hypot(...Object.values(first.velocityAfterRecovery)) <= 4 + 1e-9);
  assert.ok(first.velocityIntoBlockingNormalMps >= -1e-9);

  const secondState = { ...runner.state, position: { ...runner.state.position } };
  const second = runner.recoverFromPenetration({
    reason: 'deep-body-penetration',
    substepState: secondState,
    environment,
    stepIndex: 101,
    blockingNormal: normal
  });
  assert.equal(second.recoveryMode, 'route');
  assert.deepEqual(second.velocityAfterRecovery, { x: 0, y: 0, z: 0 });

  const thirdState = { ...runner.state, position: { ...runner.state.position } };
  const third = runner.recoverFromPenetration({
    reason: 'deep-body-penetration',
    substepState: thirdState,
    environment,
    stepIndex: 102,
    blockingNormal: normal
  });
  assert.equal(third.recoveryMode, 'hard-stop');
  assert.equal(third.hardFailure, true);
  assert.deepEqual(third.velocityAfterRecovery, { x: 0, y: 0, z: 0 });
  const history = runner.penetrationRecoveryState.history;
  assert.equal(history.filter(({ recoveryMode }) => recoveryMode === 'historical').length, 1);
  assert.equal(new Set(history.map(({ sourceKey }) => sourceKey)).size, history.length);
  assert.equal(runner.penetrationRecoveryState.currentIncident.sourceBlacklist.length, 3);
  assert.equal(new Set(history.map(({ penetrationIncidentId }) => penetrationIncidentId)).size, 1);
});

test('penetration incident identity is surface-stable and clears only after time and distance', () => {
  const runner = new VehicleDynamicsRunner({ config: CONFIG, tireContactSubsystem: {
    step: () => emptyTireResult()
  } });
  const identityContext = (triangleId) => ({
    state: { ...runner.state, position: { x: 12.1, y: 0.5, z: 43.2 } },
    tireResult: { contactPatches: { fl: {
      terrainTriangleId: triangleId,
      terrainSampleSource: 'prepared-world'
    } } },
    bodyResult: { contacts: [{ id: 'lower-face', triangleId,
      terrainSource: 'prepared-world' }] },
    penetrationSample: {
      terrainTriangleIds: [triangleId],
      terrainSources: ['prepared-world'],
      penetratingFeatureIds: ['lower-face']
    },
    environment: { routeDistanceM: 221 },
    stepIndex: 10
  });
  const firstId = runner.createPenetrationIncidentId(identityContext('triangle-7'));
  const sameId = runner.createPenetrationIncidentId({
    ...identityContext('triangle-7'),
    state: { ...runner.state, position: { x: 12.2, y: 0.4, z: 43.3 } },
    stepIndex: 99
  });
  assert.equal(sameId, firstId);
  assert.notEqual(runner.createPenetrationIncidentId(identityContext('triangle-8')), firstId);
  const incident = runner.ensurePenetrationIncident(identityContext('triangle-7'));
  const clearSample = { maximumPenetrationM: -0.1, invalidTerrainSampleCount: 0 };
  const nearby = { ...runner.state, position: { x: 13, y: 0.8, z: 43.2 } };
  for (let step = 11; step < 21; step += 1) {
    runner.updatePenetrationIncidentClearState({ state: nearby, penetrationSample: clearSample, stepIndex: step });
  }
  assert.equal(runner.penetrationRecoveryState.currentIncident.id, incident.id,
    'non-penetrating time alone must not clear the source blacklist');
  const away = { ...nearby, position: { x: 21, y: 0.8, z: 43.2 } };
  const requiredSteps = Math.ceil(
    runner.config.penetrationIncidentClearSeconds * runner.config.chassisHz
  );
  for (let offset = 0; offset < requiredSteps - 11; offset += 1) {
    runner.updatePenetrationIncidentClearState({
      state: away,
      penetrationSample: clearSample,
      stepIndex: 21 + offset
    });
  }
  assert.equal(runner.penetrationRecoveryState.currentIncident.id, incident.id);
  runner.updatePenetrationIncidentClearState({
    state: away,
    penetrationSample: clearSample,
    stepIndex: 21 + requiredSteps
  });
  assert.equal(runner.penetrationRecoveryState.currentIncident, null);
  assert.equal(runner.penetrationRecoveryState.lastClearedIncidentId, incident.id);
});

for (const fixture of [
  { name: 'upright underbody contact', working: createWorking({ heightM: 0.5 }) },
  { name: 'car resting on its side', working: createWorking({ heightM: 0.9, roll: Math.PI / 2 }) },
  { name: 'fully inverted roof contact', working: createWorking({ heightM: 1.0, roll: Math.PI }) },
  { name: 'nose-first landing', working: createWorking({ heightM: 2.2, pitch: -1.05, velocity: { y: -8 } }) },
  { name: 'tail-first landing', working: createWorking({ heightM: 2.2, pitch: 1.05, velocity: { y: -8 } }) }
]) {
  test(`${fixture.name} resolves without an upright-only angle gate`, () => {
    const result = simulate({ working: fixture.working, steps: 720 });
    assert.equal(result.maximumContacts > 0, true);
    assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM - 0.002, true, result.clearance);
    assert.equal(Number.isFinite(result.working.orientation.w), true);
  });
}

test('a rollover across a side slope remains free to rotate', () => {
  const initialRoll = 0.7;
  const result = simulate({
    working: createWorking({
      heightM: 1.2,
      roll: initialRoll,
      velocity: { x: 5 },
      angularVelocity: { z: 2.4 }
    }),
    sampleTerrain: terrain({ slopeX: 0.22 }),
    steps: 420
  });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.working.position.x > 1, true);
  assert.equal(Math.abs(result.working.orientation.z) > 0.05, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM - 0.002, true);
});

test('a crest beneath the vehicle center contacts the lower-chassis bottom face', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.55 });
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain({ crest: true }) },
    dt: DT
  });
  assert.equal(result.contacts.some(({ id, pieceId }) => (
    pieceId === 'lower-chassis' && id.includes('face')
  )), true);
});

test('a high-speed tunneling attempt is stopped within bounded penetration', () => {
  const result = simulate({
    working: createWorking({ heightM: 4, velocity: { y: -110 } }),
    steps: 90
  });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM - 0.002, true, result.clearance);
  assert.equal(result.working.velocity.y > -2, true);
});

test('continuous body sweep catches a narrow crest between proposed-pose probes', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const previous = createWorking({ heightM: 0.55, velocity: { z: 360 } });
  previous.position.z = -0.5;
  const proposed = collision.createWorkingState(previous);
  proposed.position.z = 0.5;
  const result = collision.step({
    workingState: proposed,
    previousWorkingState: previous,
    config: CONFIG,
    environment: {
      sampleTerrainAtWorldPoint: (point) => ({
        heightM: Math.abs(point.z) < 0.025 ? 0.2 : -1,
        normal: { x: 0, y: 1, z: 0 },
        friction: 0.62
      })
    },
    dt: DT,
    advanceState: false
  });
  assert.equal(result.swept, true);
  assert.ok(result.timeOfImpactFraction > 0 && result.timeOfImpactFraction < 1);
  assert.ok(result.contacts.length > 0);
});

test('wheel sidewall support resolves collision separately from powered tread contact', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 1.4, velocity: { x: 0, y: -3, z: 0 } });
  const sidewallPoint = { x: 0.9, y: -0.03, z: 1.2 };
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: {
      sampleTerrainAtWorldPoint: terrain(),
      wheelCollisionSupportFeatures: [{
        id: 'wheel-fl-sidewall-outer-0', wheelId: 'fl',
        contactType: 'wheel-sidewall', worldPoint: sidewallPoint, friction: 0.6
      }]
    },
    dt: DT
  });
  const contact = result.contacts.find(({ id }) => id === 'wheel-fl-sidewall-outer-0');
  assert.equal(contact?.contactType, 'wheel-sidewall');
  assert.equal(contact?.wheelId, 'fl');
  assert.equal(Number(contact?.normalImpulseNs || 0) > 0, true);
  assert.equal(Object.hasOwn(contact || {}, 'driveTorqueNm'), false,
    'sidewall collision must not become a powered tread contact');
});

test('deeply submerged initial state recovers deterministically and records the reason', () => {
  const makeRunner = () => new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: { position: { x: 0, y: -2, z: 0 }, grounded: false },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain(),
      getRouteRecoveryState: () => ({
        position: { x: 4, y: CONFIG.cgHeightM + 0.02, z: 8 },
        velocity: { x: 0, y: 0, z: 0 },
        grounded: true,
        routeDistance: 27,
        sourceKey: 'route|27|flat|car'
      })
    })
  });
  const first = makeRunner();
  const second = makeRunner();
  first.advance(1 / 120);
  second.advance(1 / 120);
  assert.deepEqual(first.createStateSnapshot(), second.createStateSnapshot());
  assert.deepEqual(first.penetrationRecoveryState.history, second.penetrationRecoveryState.history);
  assert.ok(first.state.position.y >= CONFIG.cgHeightM);
  assert.ok(first.penetrationRecoveryState.history.length > 0);
  assert.match(first.penetrationRecoveryState.history[0].reason, /submerged|penetration|terrain/);
  assert.equal(first.penetrationRecoveryState.history[0].usedRouteRecoveryPath, true);
  const snapshot = first.createSnapshot();
  const restored = makeRunner().restoreSnapshot(snapshot);
  assert.deepEqual(restored.createStateSnapshot(), first.createStateSnapshot());
  assert.deepEqual(restored.penetrationRecoveryState, first.penetrationRecoveryState);
  const partitioned = [30, 60, 90, 120, 144].map((fps) => {
    const runner = makeRunner();
    let elapsed = 0;
    while (elapsed < 1 / 30 - 1e-12) {
      const duration = Math.min(1 / fps, 1 / 30 - elapsed);
      runner.advance(duration);
      elapsed += duration;
    }
    return {
      state: runner.createStateSnapshot(),
      recovery: runner.penetrationRecoveryState.history
    };
  });
  partitioned.slice(1).forEach((candidate) => assert.deepEqual(candidate, partitioned[0]));
});

test('shallow residual penetration waits for complete chassis-step stall before route recovery', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation',
      penetrationFailureStepLimit: 2 },
    initialState: { position: { x: 0, y: 0.8, z: 0 }, grounded: false },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      sampleTerrainAtWorldPoint: terrain(),
      getRouteRecoveryState: () => ({
        position: { x: 0, y: 1.2, z: 0 },
        velocity: {},
        routeDistance: 12,
        sourceKey: 'route|12|flat|car'
      }),
      airDensityKgM3: 0
    })
  });
  runner.lastNonPenetratingState = runner.createLastNonPenetratingState(
    runner.state,
    emptyTireResult(),
    0
  );
  runner.bodyCollision.step = () => ({
    linearImpulseWorldNs: {}, angularImpulseWorldNms: {}, positionalCorrectionWorldM: {},
    contacts: [], bodyNormalImpulseNs: 0, bodyFrictionImpulseNs: 0,
    restitutionContributionNs: 0, penetrationBiasContributionNs: 0
  });
  runner.bodyCollision.samplePosePenetration = (pose) => ({
    maximumPenetrationM: pose.position.y < 1 ? 0.04 : -0.1,
    invalidTerrainSampleCount: 0,
    allBodySamplesBelowTerrain: false,
    allTerrainSamplesInvalid: false
  });
  runner.advance(1 / 120);
  assert.equal(runner.penetrationRecoveryState.history.length, 0,
    'one solver pass must not substitute recovery for ordinary contact');
  runner.advance(1 / 120);
  assert.equal(runner.penetrationRecoveryState.history.length, 1);
  assert.equal(runner.penetrationRecoveryState.history[0].reason, 'penetration-correction-stalled');
  assert.equal(runner.penetrationRecoveryState.history[0].usedRouteRecoveryPath, true);
});

test('surface consistency telemetry flags baked and physics height differences over two centimeters', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: { position: { x: 0, y: 0.7, z: 0 }, grounded: false },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain(),
      sampleRenderedTerrainAtWorldPoint: () => ({
        heightM: 0.03,
        normal: { x: 0, y: 1, z: 0 }
      })
    })
  });
  runner.advance(1 / 120);
  const discrepancies = runner.telemetry[0].forces.bodyCollision.surfaceDiscrepancies;
  assert.ok(discrepancies.length > 0);
  assert.ok(discrepancies.every((sample) => sample.differenceM > 0.02));
  assert.ok(discrepancies.some((sample) => sample.id === 'cg-proposed'));
});

test('an inverted car slides downhill on its roof without being teleported upright', () => {
  const start = createWorking({
    heightM: 1.05,
    roll: Math.PI,
    velocity: { x: -2 }
  });
  const initialOrientation = { ...start.orientation };
  const result = simulate({ working: start, sampleTerrain: terrain({ slopeX: 0.18 }), steps: 540 });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.working.position.x < -0.25, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM - 0.002, true);
  assert.equal(Math.abs(result.working.orientation.w - initialOrientation.w) < 0.65, true);
});

test('authoritative runner physically depenetrates a bounded inverted overlap before commit', () => {
  let terrainSamples = 0;
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      orientation: quaternionFromEuler({ roll: Math.PI }),
      grounded: false
    },
    tireContactSubsystem: {
      step() {
        return {
          worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
          wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
          wheelAngularVelocityRadps: {}, contactPatches: {}, suspensionState: {},
          grounded: false, groundHeightM: null
        };
      }
    },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint(point) {
        terrainSamples += 1;
        return terrain()(point);
      }
    })
  });
  runner.advance(1 / 120);

  assert.equal(
    terrainSamples >= createChassisBodyContactCandidates(CONFIG).length * 3,
    true,
    'continuous sweep and post-solve validation may sample intermediate poses'
  );
  assert.equal(runner.telemetry[0].tireSubstepCount, 3);
  const residual = runner.bodyCollision.samplePosePenetration(
    runner.state,
    { sampleTerrainAtWorldPoint: terrain() },
    CONFIG.bodyCollisionToleranceM
  );
  assert.equal(Number(residual.maximumPenetrationM) <= CONFIG.bodyCollisionToleranceM + 1e-6, true);
  assert.deepEqual(runner.telemetry[0].forces.bodyCollision.emergencyRecoveries, []);
  assert.ok(runner.telemetry[0].forces.bodyCollision.positionalCorrectionWorldM.y > 0);
});

test('penetration stabilization corrects position without manufacturing rebound velocity', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.4 });
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain() },
    dt: DT,
    advanceState: false
  });

  assert.equal(result.contacts.length > 0, true);
  assert.equal(result.penetrationBiasContributionNs, 0);
  assert.equal(result.contacts.every((contact) => contact.penetrationBiasImpulseNs === 0), true);
  assert.equal(working.velocity.y, 0);
  assert.equal(result.positionalCorrectionWorldM.y > 0, true);
});

test('physical closing velocity owns restitution while impact telemetry separates every contribution', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.42, velocity: { y: -5 } });
  const preEnergyJ = 0.5 * CONFIG.massKg * working.velocity.y ** 2;
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain() },
    dt: DT,
    advanceState: false
  });
  const postEnergyJ = 0.5 * CONFIG.massKg * (
    working.velocity.x ** 2 + working.velocity.y ** 2 + working.velocity.z ** 2
  );

  assert.equal(result.bodyNormalImpulseNs > 0, true);
  assert.equal(result.restitutionContributionNs > 0, true);
  assert.equal(result.penetrationBiasContributionNs, 0);
  assert.equal(Number.isFinite(result.bodyFrictionImpulseNs), true);
  assert.equal(postEnergyJ <= preEnergyJ, true, `${postEnergyJ} <= ${preEnergyJ}`);
});

test('a single physical contact follows configured restitution independently of penetration depth', () => {
  const restitution = 0.18;
  const config = { ...CONFIG, bodyCollisionRestitution: restitution };
  const collision = new ChassisBodyCollision(config);
  const working = createWorking({ heightM: 0.42, velocity: { y: -5 } });
  const target = collision.getSupportCandidates(working).reduce((nearest, candidate) => (
    !nearest || Math.hypot(candidate.localPoint.x, candidate.localPoint.z)
      < Math.hypot(nearest.localPoint.x, nearest.localPoint.z) ? candidate : nearest
  ), null).localPoint;
  const centerOnlyTerrain = (point) => Math.hypot(point.x - target.x, point.z - target.z) < 0.01
    ? { heightM: 0, normal: { x: 0, y: 1, z: 0 }, friction: 0 }
    : { heightM: Number.NaN, normal: { x: 0, y: 1, z: 0 }, friction: 0 };
  const result = collision.step({
    workingState: working,
    config,
    environment: { sampleTerrainAtWorldPoint: centerOnlyTerrain },
    dt: DT,
    advanceState: false
  });

  assert.equal(result.contacts.length, 1);
  const contact = result.contacts[0];
  const postPointVelocity = addVector3(
    working.velocity,
    crossVector3(working.angularVelocityWorld, contact.arm)
  );
  assert.ok(Math.abs(dotVector3(postPointVelocity, contact.normal) - 5 * restitution) < 1e-8);
  assert.equal(contact.penetrationBiasImpulseNs, 0);
});

test('suspension impulse advances the shared substep state before body contacts are solved', () => {
  let substep = 0;
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: {
      position: { x: 0, y: 0.442, z: 0 },
      velocity: { x: 0, y: -1, z: 0 },
      grounded: true
    },
    tireContactSubsystem: {
      step() {
        const supportForceN = substep++ === 0 ? CONFIG.massKg * 2 * 360 : 0;
        return emptyTireResult({
          suspensionForceWorldN: { y: supportForceN },
          wheelLoadsN: { fl: supportForceN / 4, fr: supportForceN / 4,
            rl: supportForceN / 4, rr: supportForceN / 4 },
          grounded: supportForceN > 0
        });
      }
    },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain()
    })
  });
  runner.advance(1 / 120);

  assert.equal(runner.telemetry[0].forces.bodyContacts.length, 0);
  assert.equal(runner.state.position.y > 0.442, true);
  assert.equal(runner.state.velocity.y > 0, true);
});

test('impact orientations and Studio Sprint 2 jump speeds are render-partition deterministic', () => {
  const fixtures = [
    { name: 'four-wheel flat', pitch: 0, roll: 0, speedMps: 0 },
    { name: 'front-wheel-first', pitch: -0.22, roll: 0, speedMps: 0 },
    { name: 'rear-wheel-first', pitch: 0.22, roll: 0, speedMps: 0 },
    { name: 'one-wheel', pitch: 0, roll: 0.24, speedMps: 0 },
    { name: 'nose strike', pitch: -1.05, roll: 0, speedMps: 12 },
    { name: 'sideways landing', pitch: 0, roll: Math.PI / 2, speedMps: 12 },
    ...[40, 60, 80].map((mph) => ({
      name: `Studio Sprint 2 jump ${mph} mph`, pitch: -0.08, roll: 0,
      speedMps: mph * 0.44704
    }))
  ];
  const run = (fixture, fps) => {
    const runner = new VehicleDynamicsRunner({
      config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation',
        telemetryRetention: 'latest' },
      initialState: {
        position: { x: 0, y: 0.72, z: 0 },
        orientation: quaternionFromEuler({ pitch: fixture.pitch, roll: fixture.roll }),
        velocity: { x: 0, y: -5, z: fixture.speedMps },
        grounded: false
      },
      tireContactSubsystem: { step: () => emptyTireResult() },
      environmentProvider: () => ({
        airDensityKgM3: 0,
        sampleTerrainAtWorldPoint: terrain()
      })
    });
    for (let frame = 0; frame < fps / 2; frame += 1) runner.advance(1 / fps);
    runner.drainCatchUp();
    return runner;
  };

  for (const fixture of fixtures) {
    const baseline = run(fixture, 30);
    assert.equal(baseline.impactHistory.length > 0, true, fixture.name);
    assert.equal(baseline.impactHistory[0].postImpactKineticEnergyJ
      <= baseline.impactHistory[0].preImpactKineticEnergyJ, true, fixture.name);
    assert.equal(baseline.impactHistory[0].penetrationBiasContributionNs, 0, fixture.name);
    const replay = VehicleDynamicsRunner.replay(baseline.createReplayRecord(), {
      tireContactSubsystem: { step: () => emptyTireResult() },
      environmentProvider: () => ({
        airDensityKgM3: 0,
        sampleTerrainAtWorldPoint: terrain()
      })
    });
    assert.deepEqual(replay.createStateSnapshot(), baseline.createStateSnapshot(),
      `${fixture.name} replay state`);
    assert.deepEqual(replay.impactHistory, baseline.impactHistory,
      `${fixture.name} replay impact telemetry`);
    for (const fps of [60, 90, 120, 144]) {
      const candidate = run(fixture, fps);
      assert.deepEqual(candidate.createStateSnapshot(), baseline.createStateSnapshot(),
        `${fixture.name} at ${fps} FPS`);
      assert.deepEqual(candidate.impactHistory, baseline.impactHistory,
        `${fixture.name} impact telemetry at ${fps} FPS`);
    }
  }
});

test('impact energy telemetry records descending rebound apexes', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation',
      bodyCollisionRestitution: 0.24, bodyCollisionRestitutionThresholdMps: 0.05,
      bodyCollisionFriction: 0 },
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      velocity: { x: 0, y: -5, z: 0 },
      grounded: false
    },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain()
    })
  });
  for (let step = 0; step < 480; step += 1) runner.advance(1 / 120);
  const impact = runner.impactHistory[0];

  assert.ok(impact);
  assert.equal(impact.penetrationBiasContributionNs, 0);
  assert.equal(Number.isFinite(impact.firstReboundApexM), true);
  assert.equal(Number.isFinite(impact.secondReboundApexM), true);
  assert.equal(impact.secondReboundApexM < impact.firstReboundApexM, true,
    `${impact.secondReboundApexM} < ${impact.firstReboundApexM}`);
});
