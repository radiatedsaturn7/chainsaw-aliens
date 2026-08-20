import test from 'node:test';
import assert from 'node:assert/strict';

import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];

function tireResultAt(state, { rebuilt = false } = {}) {
  const contactPatches = {};
  const suspensionState = {};
  const wheelLoadsN = {};
  for (let index = 0; index < WHEEL_IDS.length; index += 1) {
    const wheelId = WHEEL_IDS[index];
    const x = Number(state.position.x || 0) + (wheelId[1] === 'l' ? -0.8 : 0.8);
    const z = Number(state.position.z || 0) + (wheelId[0] === 'f' ? 1.3 : -1.3);
    const hubY = Number(state.position.y || 0) - 0.25;
    contactPatches[wheelId] = {
      hubPositionWorld: { x, y: hubY, z },
      wheelCenterWorld: { x, y: hubY, z },
      contactPointWorld: { x, y: hubY - 0.34, z },
      suspensionMountPositionWorld: { x, y: Number(state.position.y || 0), z },
      suspensionAxisWorld: { x: 0, y: -1, z: 0 },
      surfaceNormalWorld: { x: 0, y: 1, z: 0 },
      normalLoadN: 3500,
      validTreadContact: true,
      terrainSampleValid: true,
      rebuilt
    };
    suspensionState[wheelId] = {
      compressionM: rebuilt ? 0.08 : 0.04,
      unsprungVelocityMps: rebuilt ? 0.2 : -4,
      suspensionAxisWorld: { x: 0, y: -1, z: 0 },
      hubPositionWorld: { x, y: hubY, z },
      inContact: true
    };
    wheelLoadsN[wheelId] = 3500;
  }
  return {
    contactPatches,
    suspensionState,
    wheelLoadsN,
    wheelSlip: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, 0])),
    suspensionTravel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, 0.08])),
    tireForcesN: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, { x: 0, y: 3500, z: 0 }])),
    wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, 0])),
    validTreadContactByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, true])),
    invalidContactReasonByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, null])),
    supportedWheelCount: 4,
    grounded: true,
    wheelGrounded: true,
    worldForceN: { x: 0, y: 14000, z: 0 },
    worldMomentNm: { x: 0, y: 0, z: 0 },
    suspensionForceWorldN: { x: 0, y: 14000, z: 0 },
    tireImpulseWorldNs: { x: 0, y: 0, z: 0 },
    suspensionImpulseWorldNs: { x: 0, y: 0, z: 0 },
    externalImpulseWorldNs: { x: 0, y: 0, z: 0 },
    tireAngularImpulseWorldNms: { x: 0, y: 0, z: 0 },
    externalAngularImpulseWorldNms: { x: 0, y: 0, z: 0 },
    bodyCollision: { contacts: [] }
  };
}

function collisionResult(correction = { x: 0, y: 0, z: 0 }) {
  return {
    contacts: [],
    linearImpulseWorldNs: { x: 0, y: 0, z: 0 },
    angularImpulseWorldNms: { x: 0, y: 0, z: 0 },
    positionalCorrectionWorldM: correction,
    positionalAngularCorrectionWorldRad: { x: 0, y: 0, z: 0 },
    bodyNormalImpulseNs: 0,
    bodyFrictionImpulseNs: 0,
    wheelCylinderNormalImpulseNs: 0,
    wheelCylinderFrictionImpulseNs: 0,
    restitutionContributionNs: 0,
    maximumPenetrationM: 0,
    residualPenetrationM: 0,
    broadphaseRejected: false,
    swept: false,
    finalPenetrationSample: {
      maximumPenetrationM: 0,
      invalidTerrainSampleCount: 0,
      allBodySamplesBelowTerrain: false
    }
  };
}

test('collision correction commits rebuilt wheels suspension and contacts atomically', () => {
  const tireCalls = [];
  let collisionCalls = 0;
  const runner = new VehicleDynamicsRunner({
    config: { handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'latest' },
    initialState: {
      position: { x: 0, y: 1, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    tireContactSubsystem: {
      step(request) {
        tireCalls.push({
          collisionContactRebuild: request.collisionContactRebuild === true,
          positionY: request.state.position.y
        });
        return tireResultAt(request.state, {
          rebuilt: request.collisionContactRebuild === true
        });
      }
    },
    environmentProvider: () => ({ airDensityKgM3: 0 })
  });
  runner.bodyCollision = {
    step({ workingState }) {
      collisionCalls += 1;
      if (collisionCalls === 1) {
        workingState.position.y += 0.012;
        workingState.orientation = {
          x: Math.sin(0.001), y: 0, z: 0, w: Math.cos(0.001)
        };
        return collisionResult({ x: 0, y: 0.012, z: 0 });
      }
      return collisionResult();
    },
    samplePosePenetration() {
      return { maximumPenetrationM: 0, invalidTerrainSampleCount: 0 };
    }
  };
  runner.advance(1 / 120, { input: { throttle: 0 } });
  assert.equal(tireCalls.length, 2);
  assert.deepEqual(tireCalls.map((call) => call.collisionContactRebuild), [false, true]);
  assert.equal(collisionCalls, 2);
  const generation = runner.state.contactTransactionGeneration;
  assert.ok(Number.isInteger(generation) && generation > 0);
  for (const wheelId of WHEEL_IDS) {
    const patch = runner.state.contactPatches[wheelId];
    const suspension = runner.state.suspensionState[wheelId];
    assert.equal(patch.rebuilt, true);
    assert.equal(patch.contactTransactionGeneration, generation);
    assert.equal(suspension.contactTransactionGeneration, generation);
    assert.equal(suspension.compressionM, 0.08);
    assert.equal(suspension.unsprungVelocityMps, 0.2);
    assert.ok(Math.abs(patch.hubPositionWorld.y - (runner.state.position.y - 0.25)) < 0.00001);
  }
  const transaction = runner.telemetry.at(-1).forces.bodyCollision.contactTransaction;
  assert.equal(transaction.iterations.length, 1);
  assert.equal(transaction.energy.beforeContactRebuildJ, transaction.energy.afterContactRebuildJ);
  assert.equal(transaction.energy.afterContactRebuildJ, transaction.energy.finalCommitJ);
  assert.equal(runner.state.contactStabilization.gameplayResetCount, 0);
});

test('persistent shallow wall contact schedules physical reverse escape without route recovery', () => {
  const runner = new VehicleDynamicsRunner({
    config: { handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'none' },
    initialState: {
      position: { x: 0, y: 1, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    tireContactSubsystem: { step({ state }) { return tireResultAt(state); } },
    environmentProvider: () => ({ airDensityKgM3: 0 })
  });
  runner.bodyCollision = {
    step() {
      return {
        ...collisionResult(),
        contacts: [{
          id: 'front-bumper-wall',
          colliderId: 'wall',
          featureId: 'wall-face',
          pieceId: 'front-bumper',
          contactType: 'static-body',
          normal: { x: 0, y: 0, z: -1 },
          penetrationM: 0.01,
          normalImpulseNs: 0,
          tangentialImpulseNs: 0
        }]
      };
    },
    samplePosePenetration() {
      return { maximumPenetrationM: 0.01, invalidTerrainSampleCount: 0 };
    }
  };
  const initialZ = runner.state.position.z;
  for (let step = 0; step < 36; step += 1) {
    runner.advance(1 / 120, {
      input: { throttle: 1, requestedGear: -1, steering: step > 20 ? 0.5 : 0 }
    });
  }
  assert.ok(runner.collisionEscapeState.escapeCount >= 1);
  assert.ok(runner.state.position.z < initialZ);
  assert.equal(runner.contactStabilizationState.gameplayResetCount, 0);
  assert.equal(runner.penetrationRecoveryState.history.length, 0);
});

test('driveable coupled correction failure discards only the current substep correction', () => {
  let collisionCalls = 0;
  const terrainContact = {
    id: 'underfloor-apron', pieceId: 'underfloor', contactType: 'body',
    terrainSource: 'corridor:right:333:5', terrainRegion: 'transition',
    supportFamilyId: 18000, supportFamilyDriveable: true,
    supportEdgeClassification: 'smooth-connected-surface',
    normal: { x: 0, y: 1, z: 0 }, penetrationM: 0.01,
    normalImpulseNs: 40, tangentialImpulseNs: 2,
    preImpactManifoldNormalVelocityMps: -1
  };
  const runner = new VehicleDynamicsRunner({
    config: { handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'latest' },
    initialState: {
      position: { x: 0, y: 1, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 12 }
    },
    tireContactSubsystem: { step({ state }) { return tireResultAt(state); } },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint(point) {
        return {
          valid: true, heightM: 0, normal: { x: 0, y: 1, z: 0 },
          region: 'transition', source: 'corridor:right:333:5', triangleId: 18000,
          queryPosition: point, supportFamilyId: 18000, supportFamilyDriveable: true,
          supportEdgeClassification: 'smooth-connected-surface'
        };
      }
    })
  });
  runner.lastValidLocalCollisionFrame = {
    position: { x: -20, y: 1, z: -20 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    supportNormal: { x: 0, y: 1, z: 0 },
    stepIndex: 0,
    suspensionState: {}, tireState: {}, wheelAngularVelocityRadps: {},
    wheelLoadsN: {}, wheelSlip: {}, contactPatches: {}, powertrainState: {}
  };
  runner.bodyCollision = {
    step({ workingState }) {
      collisionCalls += 1;
      if (collisionCalls === 1) workingState.position.x += 0.2;
      return {
        ...collisionResult(collisionCalls === 1 ? { x: 0.2, y: 0, z: 0 } : undefined),
        contacts: [{ ...terrainContact }]
      };
    },
    samplePosePenetration() {
      return {
        maximumPenetrationM: 0.01, invalidTerrainSampleCount: 0,
        allBodySamplesBelowTerrain: false, allLowerBodySupportFeaturesBelowTerrain: false
      };
    }
  };

  runner.advance(1 / 120, { input: { throttle: 0.2 } });

  assert.ok(runner.state.position.x > -0.01 && runner.state.position.x < 0.01,
    `must not restore the older x=-20 frame: ${runner.state.position.x}`);
  assert.ok(runner.state.position.z > 0, `tangent progress ${runner.state.position.z}`);
  assert.equal(runner.penetrationRecoveryState.history.length, 0);
  assert.equal(runner.contactStabilizationState.history.some((event) => (
    event.reason === 'coupled-correction-safe-pose'
  )), false);
  assert.equal(runner.contactStabilizationState.history.some((event) => (
    event.reason === 'coupled-correction-current-substep-discard'
  )), true, JSON.stringify(runner.contactStabilizationState.history));
});
