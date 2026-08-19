import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRaceBakedSurfaceSampler } from '../../src/racing/RaceBakedSurfaceSampler.js';
import { createPhysicsTerrainQueryFrameCache } from '../../src/racing/simulation/PhysicsTerrainQueryFrame.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { createVehicleRenderStateFromRunner } from '../../src/racing/simulation/VehicleRenderState.js';
import { resolvePerWheelAlignment } from '../../src/racing/simulation/SuspensionGeometry.js';

const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];
const WRX2_CONFIG = JSON.parse(readFileSync(
  new URL('../fixtures/studioSprint2HillIncident.json', import.meta.url), 'utf8'
)).vehicleConfiguration;

function flatPackedSampler(oppositeDiagonal = false) {
  const vertices = oppositeDiagonal ? [
    [[-12, -12], [12, -12], [-12, 12]],
    [[12, -12], [12, 12], [-12, 12]]
  ] : [
    [[-12, -12], [12, -12], [12, 12]],
    [[-12, -12], [12, 12], [-12, 12]]
  ];
  return buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 8,
    mesh: {
      triangles: vertices.map((triangle, index) => ({
        region: 'road', source: `coplanar-${oppositeDiagonal ? 'b' : 'a'}-${index}`,
        vertices: triangle.map(([x, z]) => ({ x, z, elevation: 0 }))
      }))
    }
  });
}

function bumpyPackedSampler() {
  const triangles = [];
  const spacingM = 0.5;
  const heightAt = (x, z) => 0.028 * Math.sin(x * 1.7) * Math.cos(z * 1.3)
    + 0.009 * Math.sin((x + z) * 2.4);
  for (let x = -4; x < 4; x += spacingM) {
    for (let z = -4; z < 4; z += spacingM) {
      const a = { x, z, elevation: heightAt(x, z) };
      const b = { x: x + spacingM, z, elevation: heightAt(x + spacingM, z) };
      const c = {
        x: x + spacingM,
        z: z + spacingM,
        elevation: heightAt(x + spacingM, z + spacingM)
      };
      const d = { x, z: z + spacingM, elevation: heightAt(x, z + spacingM) };
      triangles.push(
        { region: 'road', source: `bump-${x}-${z}-a`, vertices: [a, b, c] },
        { region: 'road', source: `bump-${x}-${z}-b`, vertices: [a, c, d] }
      );
    }
  }
  return buildRaceBakedSurfaceSampler({
    elevationScaleM: 1,
    bucketSizeM: 4,
    mesh: { triangles }
  });
}

function createProductionFlatEnvironment(config, yawRad, oppositeDiagonal, {
  sampler: samplerOverride = null,
  revision: revisionOverride = null
} = {}) {
  const cache = createPhysicsTerrainQueryFrameCache({ resultCapacity: 64 });
  const sampler = samplerOverride || flatPackedSampler(oppositeDiagonal);
  const revision = revisionOverride ?? (oppositeDiagonal ? 2 : 1);
  return ({ state = {} } = {}) => {
    const frame = cache.begin({
      sampler, revision, elevationScaleM: 1,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
    });
    const cosine = Math.cos(yawRad);
    const sine = Math.sin(yawRad);
    const coordinates = new Float64Array(12);
    for (let index = 0; index < WHEEL_IDS.length; index += 1) {
      const wheelId = WHEEL_IDS[index];
      const front = wheelId[0] === 'f';
      const left = wheelId[1] === 'l';
      const localX = (left ? -1 : 1) * Number(
        front ? config.frontTrackWidthM : config.rearTrackWidthM
      ) * 0.5;
      const localZ = front
        ? Number(config.frontAxleDistanceFromCgM)
        : -Number(config.rearAxleDistanceFromCgM);
      coordinates[index * 3] = Number(state.position?.x || 0) + localX * cosine + localZ * sine;
      coordinates[index * 3 + 1] = 0;
      coordinates[index * 3 + 2] = Number(state.position?.z || 0) - localX * sine + localZ * cosine;
    }
    const centers = frame.samplePackedPoints(coordinates, 4);
    const surfaceSamplesByWheel = {};
    const surfaceHeightByWheel = {};
    const surfaceNormalByWheel = {};
    const contactSamplesByWheel = {};
    for (let index = 0; index < WHEEL_IDS.length; index += 1) {
      const wheelId = WHEEL_IDS[index];
      const center = centers[index];
      surfaceSamplesByWheel[wheelId] = center;
      surfaceHeightByWheel[wheelId] = center.heightM;
      surfaceNormalByWheel[wheelId] = center.normal;
      const x = coordinates[index * 3];
      const z = coordinates[index * 3 + 2];
      contactSamplesByWheel[wheelId] = frame.samplePoints([
        { x, z }, { x: x - 0.08, z }, { x: x + 0.08, z },
        { x, z: z - 0.1 }, { x, z: z + 0.1 }
      ]);
    }
    return {
      airDensityKgM3: 0,
      requireValidTerrainEnvelope: true,
      physicsTerrainQueryFrame: frame,
      preparedTerrainRevision: revision,
      surfaceSamplesByWheel,
      surfaceHeightByWheel,
      surfaceNormalByWheel,
      contactSamplesByWheel,
      sampleTerrainAtWorldPoint: (point) => frame.samplePoint(point),
      sampleTerrainAtWorldPoints: (points) => frame.samplePoints(points),
      sampleTerrainMaximumHeightInBounds: (bounds) => frame.maximumHeightInBounds(bounds)
    };
  };
}

test('WRX2 bilateral suspension remains symmetric across packed flat mesh diagonals', () => {
  for (const tireHz of [120, 240, 360]) {
    for (const oppositeDiagonal of [false, true]) {
      for (const yawDegrees of [0, 90, 180, 270]) {
        const yawRad = yawDegrees * Math.PI / 180;
        const config = { ...WRX2_CONFIG, tireHz, telemetryRetention: 'none' };
        const runner = new VehicleDynamicsRunner({
          config,
          initialState: {
            position: { x: 0, y: Number(config.cgHeightM || 0.55) + 0.08, z: 0 },
            orientation: { x: 0, y: Math.sin(yawRad * 0.5), z: 0, w: Math.cos(yawRad * 0.5) }
          },
          environmentProvider: createProductionFlatEnvironment(config, yawRad, oppositeDiagonal)
        });
        try {
          runner.resetAuthoritativeState({
            position: { x: 0, y: Number(config.cgHeightM || 0.55) + 0.08, z: 0 },
            orientation: { x: 0, y: Math.sin(yawRad * 0.5), z: 0, w: Math.cos(yawRad * 0.5) },
            gear: 1
          }, { parkUntilDrive: true });
        } catch (error) {
          const last = error.resetFailure?.trace?.at(-1);
          assert.fail(`${tireHz}/${oppositeDiagonal}/${yawDegrees}:${JSON.stringify({
            compression: last?.compressionByWheel,
            loads: last?.loadByWheel,
            contacts: last?.contactPointByWheel,
            force: last?.forceResidual,
            moment: last?.momentResidual
          })}`);
        }
        const initialHeight = runner.state.position.y;
        const compressionHistory = Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, []]));
        for (let step = 0; step < 600; step += 1) {
          runner.advance(1 / 120, { input: { throttle: 0 } });
          for (const wheelId of WHEEL_IDS) compressionHistory[wheelId].push(
            Number(runner.state.suspensionState[wheelId].compressionM)
          );
        }
        const label = `${tireHz}Hz/${oppositeDiagonal ? 'opposite' : 'primary'}/${yawDegrees}`;
        assert.ok(Math.abs(
          runner.state.suspensionState.fl.compressionM
            - runner.state.suspensionState.fr.compressionM
        ) < 0.00025, `${label}:front compression`);
        assert.ok(Math.abs(
          runner.state.suspensionState.rl.compressionM
            - runner.state.suspensionState.rr.compressionM
        ) < 0.00025, `${label}:rear compression`);
        for (const wheelId of WHEEL_IDS) {
          assert.ok(Math.max(...compressionHistory[wheelId])
            - Math.min(...compressionHistory[wheelId]) < 0.0005, `${label}:${wheelId}:peak`);
          assert.equal(runner.state.suspensionState[wheelId].unsprungVelocityMps, 0);
        }
        assert.ok(Math.abs(runner.state.wheelLoadsN.fl - runner.state.wheelLoadsN.fr)
          / Math.max(1, (runner.state.wheelLoadsN.fl + runner.state.wheelLoadsN.fr) * 0.5)
          < 0.01, `${label}:front load`);
        assert.ok(Math.abs(runner.state.wheelLoadsN.rl - runner.state.wheelLoadsN.rr)
          / Math.max(1, (runner.state.wheelLoadsN.rl + runner.state.wheelLoadsN.rr) * 0.5)
          < 0.01, `${label}:rear load`);
        assert.ok(Math.abs(runner.state.position.y - initialHeight) < 0.002, `${label}:height`);
        const contactValidityBeforeWake = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
          wheelId, runner.state.contactPatches[wheelId].validTreadContact
        ]));
        runner.addInputSample(runner.simulationTimeSeconds, {
          throttle: 0.2, requestedGear: 1
        });
        let maximumUpwardVelocityMps = -Infinity;
        for (let step = 0; step < 30; step += 1) {
          runner.advance(1 / 120);
          maximumUpwardVelocityMps = Math.max(
            maximumUpwardVelocityMps,
            Number(runner.state.velocity.y || 0)
          );
        }
        assert.ok(maximumUpwardVelocityMps < 0.03, `${label}:wake vertical velocity`);
        assert.ok(Math.abs(
          runner.state.suspensionState.fl.compressionM
            - runner.state.suspensionState.fr.compressionM
        ) < 0.00025, `${label}:wake front compression`);
        assert.ok(Math.abs(
          runner.state.suspensionState.rl.compressionM
            - runner.state.suspensionState.rr.compressionM
        ) < 0.00025, `${label}:wake rear compression`);
        for (const wheelId of WHEEL_IDS) assert.equal(
          runner.state.contactPatches[wheelId].validTreadContact,
          contactValidityBeforeWake[wheelId],
          `${label}:${wheelId}:contact validity`
        );
        assert.equal(runner.impactHistory.length, 0, `${label}:impact`);
        assert.equal(runner.penetrationRecoveryState.history.length, 0, `${label}:recovery`);
      }
    }
  }
});

test('stationary WRX2 does not bounce on unchanged bumpy prepared terrain', () => {
  const config = { ...WRX2_CONFIG, tireHz: 360, telemetryRetention: 'none' };
  const environmentProvider = createProductionFlatEnvironment(config, 0, false, {
    sampler: bumpyPackedSampler(),
    revision: 'static-bumpy-road-1'
  });
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: Number(config.cgHeightM || 0.55) + 0.15, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    environmentProvider
  });
  const reset = runner.resetAuthoritativeState({
    position: { x: 0, y: Number(config.cgHeightM || 0.55) + 0.15, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    gear: 1
  }, { reason: 'bumpy-stationary-hypothesis', parkUntilDrive: true });
  assert.equal(reset.equilibrium.status, 'converged');
  assert.ok(runner.stationaryResetHold);
  assert.ok(Number(runner.state.supportedWheelCount || 0) >= 3);
  const resetTerrain = environmentProvider({ state: runner.state });
  const terrainHeights = WHEEL_IDS.map((wheelId) => Number(
    resetTerrain.surfaceHeightByWheel[wheelId]
  ));
  assert.ok(Math.max(...terrainHeights) - Math.min(...terrainHeights) > 0.015,
    `fixture was not bumpy: ${terrainHeights.join(',')}`);
  const parkedPosition = structuredClone(runner.state.position);
  const parkedOrientation = structuredClone(runner.state.orientation);
  const heldCompression = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId, Number(runner.state.suspensionState[wheelId].compressionM)
  ]));
  const heldLoads = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId, Number(runner.state.wheelLoadsN[wheelId])
  ]));
  const validity = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId, runner.state.contactPatches[wheelId].validTreadContact
  ]));
  const impactCount = runner.impactHistory.length;
  const recoveryCount = runner.penetrationRecoveryState.history.length;
  for (let step = 0; step < 600; step += 1) {
    runner.advance(1 / 120, { input: { throttle: 0, brake: 0, steering: 0 } });
    assert.deepEqual(runner.state.position, parkedPosition, JSON.stringify({
      assertion: `body position ${step}`,
      geometryChange: runner.diagnostics.stationaryResetHoldGeometryChange
    }));
    assert.deepEqual(runner.state.orientation, parkedOrientation, `body orientation ${step}`);
    assert.deepEqual(runner.state.velocity, { x: 0, y: 0, z: 0 }, `body velocity ${step}`);
    assert.deepEqual(
      runner.state.angularVelocityWorld,
      { x: 0, y: 0, z: 0 },
      `body angular velocity ${step}`
    );
    for (const wheelId of WHEEL_IDS) {
      const suspension = runner.state.suspensionState[wheelId];
      assert.equal(Number(suspension.unsprungVelocityMps || 0), 0, `${wheelId}:unsprung:${step}`);
      assert.equal(Number(suspension.compressionVelocityMps || 0), 0,
        `${wheelId}:compression velocity:${step}`);
      assert.equal(Number(suspension.damperVelocityMps || 0), 0,
        `${wheelId}:damper:${step}`);
      assert.equal(Number(suspension.compressionM), heldCompression[wheelId],
        `${wheelId}:compression:${step}`);
      assert.equal(Number(runner.state.wheelLoadsN[wheelId]), heldLoads[wheelId],
        `${wheelId}:load:${step}`);
      assert.equal(runner.state.contactPatches[wheelId].validTreadContact, validity[wheelId],
        `${wheelId}:validity:${step}`);
    }
  }
  assert.equal(runner.impactHistory.length, impactCount);
  assert.equal(runner.penetrationRecoveryState.history.length, recoveryCount);
  assert.equal(runner.diagnostics.resetSymmetryIncident, undefined);
  runner.stationaryResetHold = null;
  const releasedHeightM = Number(runner.state.position.y);
  let maximumReleasedHeightDriftM = 0;
  let maximumReleasedVerticalSpeedMps = 0;
  let maximumReleasedAngularSpeedRadps = 0;
  let maximumReleasedUnsprungSpeedMps = 0;
  for (let step = 0; step < 600; step += 1) {
    runner.advance(1 / 120, { input: { throttle: 0, brake: 0, steering: 0 } });
    maximumReleasedHeightDriftM = Math.max(
      maximumReleasedHeightDriftM,
      Math.abs(Number(runner.state.position.y) - releasedHeightM)
    );
    maximumReleasedVerticalSpeedMps = Math.max(
      maximumReleasedVerticalSpeedMps,
      Math.abs(Number(runner.state.velocity.y || 0))
    );
    maximumReleasedAngularSpeedRadps = Math.max(
      maximumReleasedAngularSpeedRadps,
      Math.hypot(
        Number(runner.state.angularVelocityWorld.x || 0),
        Number(runner.state.angularVelocityWorld.z || 0)
      )
    );
    for (const wheelId of WHEEL_IDS) maximumReleasedUnsprungSpeedMps = Math.max(
      maximumReleasedUnsprungSpeedMps,
      Math.abs(Number(runner.state.suspensionState[wheelId].unsprungVelocityMps || 0))
    );
    for (const wheelId of WHEEL_IDS) assert.equal(
      runner.state.contactPatches[wheelId].validTreadContact,
      validity[wheelId],
      `${wheelId}:released validity:${step}`
    );
  }
  assert.ok(maximumReleasedHeightDriftM < 0.002,
    JSON.stringify({
      releasedHeightM,
      finalHeightM: runner.state.position.y,
      maximumReleasedHeightDriftM,
      maximumReleasedVerticalSpeedMps,
      maximumReleasedAngularSpeedRadps,
      maximumReleasedUnsprungSpeedMps,
      suspension: runner.state.suspensionState,
      loads: runner.state.wheelLoadsN
    }));
  assert.ok(maximumReleasedVerticalSpeedMps < 0.03,
    `released vertical speed ${maximumReleasedVerticalSpeedMps}`);
  assert.ok(maximumReleasedAngularSpeedRadps < 0.03,
    `released pitch/roll speed ${maximumReleasedAngularSpeedRadps}`);
  assert.ok(maximumReleasedUnsprungSpeedMps < 0.03,
    `released unsprung speed ${maximumReleasedUnsprungSpeedMps}`);
  assert.equal(runner.impactHistory.length, impactCount);
  assert.equal(runner.penetrationRecoveryState.history.length, recoveryCount);
});

test('WRX2 axle alignment resolves to mirrored physical wheel rotations', () => {
  for (const axle of ['Front', 'Rear']) {
    const left = resolvePerWheelAlignment({
      wheelId: axle === 'Front' ? 'fl' : 'rl',
      axleCamberRad: WRX2_CONFIG[`camber${axle}Rad`],
      axleToeRad: WRX2_CONFIG[`toe${axle}Rad`]
    });
    const right = resolvePerWheelAlignment({
      wheelId: axle === 'Front' ? 'fr' : 'rr',
      axleCamberRad: WRX2_CONFIG[`camber${axle}Rad`],
      axleToeRad: WRX2_CONFIG[`toe${axle}Rad`]
    });
    assert.ok(Math.abs(left.camberRad + right.camberRad) < 1e-12);
    assert.ok(Math.abs(left.toeRad + right.toeRad) < 1e-12);
    assert.ok(left.camberRad <= 0, `${axle}: negative camber leans left top inward`);
    if (Number(WRX2_CONFIG[`toe${axle}Rad`]) > 0) {
      assert.ok(left.toeRad > 0, `${axle}: left toe-in points right`);
      assert.ok(right.toeRad < 0, `${axle}: right toe-in points left`);
    }
  }
});

test('WRX2 zero-steer dynamic states have no preferred lateral or wheel-hop side', () => {
  const cases = [
    ['settled', 0, { throttle: 0 }],
    ['coast', 8, { throttle: 0 }],
    ['acceleration', 0, { throttle: 0.35 }],
    ['braking', 13.4112, { throttle: 0, brake: 0.6 }],
    ['30 mph', 13.4112, { throttle: 0.2 }],
    ['60 mph', 26.8224, { throttle: 0.2 }]
  ];
  for (const [name, speedMps, controls] of cases) {
    const config = { ...WRX2_CONFIG, tireHz: 240, telemetryRetention: 'none' };
    const makeRunner = (mirrorSign) => {
      const runner = new VehicleDynamicsRunner({
        config,
        initialState: {
          position: { x: mirrorSign * 0.1, y: Number(config.cgHeightM || 0.55) + 0.08, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        environmentProvider: createProductionFlatEnvironment(config, 0, false)
      });
      const reset = runner.resetAuthoritativeState({
        position: { x: mirrorSign * 0.1, y: Number(config.cgHeightM || 0.55) + 0.08, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
      }, { parkUntilDrive: false });
      runner.replaceAuthoritativeState({
        ...reset.state,
        velocity: { x: 0, y: 0, z: speedMps },
        speedMps,
        groundSpeedMps: speedMps,
        bodyLongitudinalSpeedMps: speedMps,
        bodyLateralSpeedMps: 0,
        wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
          wheelId, speedMps / Number(config.wheelRadiusM)
        ]))
      });
      return runner;
    };
    const left = makeRunner(1);
    const right = makeRunner(-1);
    let lateralAccelerationSum = 0;
    let yawAccelerationSum = 0;
    let previousLateralVelocity = Number(left.state.velocity.x || 0);
    let previousYawRate = Number(left.state.angularVelocityWorld.y || 0);
    let previousMirroredLateralVelocity = Number(right.state.velocity.x || 0);
    let previousMirroredYawRate = Number(right.state.angularVelocityWorld.y || 0);
    for (let step = 0; step < 30; step += 1) {
      left.advance(1 / 120, { input: { ...controls, steering: 0, requestedGear: 1 } });
      right.advance(1 / 120, { input: { ...controls, steering: 0, requestedGear: 1 } });
      const leftLateralAcceleration = (Number(left.state.velocity.x)
        - previousLateralVelocity) * 120;
      const rightLateralAcceleration = (Number(right.state.velocity.x)
        - previousMirroredLateralVelocity) * 120;
      const leftYawAcceleration = (Number(left.state.angularVelocityWorld.y)
        - previousYawRate) * 120;
      const rightYawAcceleration = (Number(right.state.angularVelocityWorld.y)
        - previousMirroredYawRate) * 120;
      lateralAccelerationSum += (leftLateralAcceleration + rightLateralAcceleration) * 0.5;
      yawAccelerationSum += (leftYawAcceleration + rightYawAcceleration) * 0.5;
      previousLateralVelocity = Number(left.state.velocity.x);
      previousYawRate = Number(left.state.angularVelocityWorld.y);
      previousMirroredLateralVelocity = Number(right.state.velocity.x);
      previousMirroredYawRate = Number(right.state.angularVelocityWorld.y);
    }
    assert.ok(Math.abs(lateralAccelerationSum / 30) < 0.05, `${name}:lateral acceleration`);
    assert.ok(Math.abs(yawAccelerationSum / 30) < 0.05, `${name}:yaw acceleration`);
    for (const [leftWheel, rightWheel] of [['fl', 'fr'], ['rl', 'rr']]) {
      const leftPatch = left.state.contactPatches[leftWheel];
      const rightPatch = left.state.contactPatches[rightWheel];
      assert.ok(Math.abs(leftPatch.camberAngleRad + rightPatch.camberAngleRad) < 5e-5,
        `${name}:${leftWheel}:camber:${leftPatch.camberAngleRad}/${rightPatch.camberAngleRad}`);
      assert.ok(Math.abs(leftPatch.toeAngleRad + rightPatch.toeAngleRad) < 5e-5,
        `${name}:${leftWheel}:toe`);
      assert.ok(Math.abs(leftPatch.steeringAngleRad - rightPatch.steeringAngleRad) < 1e-6,
        `${name}:${leftWheel}:Ackermann`);
      assert.ok(Math.abs(left.state.wheelLoadsN[leftWheel] - left.state.wheelLoadsN[rightWheel])
        / Math.max(1, (left.state.wheelLoadsN[leftWheel] + left.state.wheelLoadsN[rightWheel]) * 0.5)
        < 0.01, `${name}:${leftWheel}:load`);
      assert.ok(Math.abs(
        Number(left.state.suspensionState[leftWheel].unsprungVelocityMps)
          - Number(left.state.suspensionState[rightWheel].unsprungVelocityMps)
      ) < 0.01, `${name}:${leftWheel}:wheel hop`);
    }
    const renderState = createVehicleRenderStateFromRunner(left);
    for (const wheelId of WHEEL_IDS) {
      assert.equal(renderState.wheels[wheelId].camberAngleRad,
        left.state.contactPatches[wheelId].camberAngleRad, `${name}:${wheelId}:render camber`);
      assert.equal(renderState.wheels[wheelId].toeAngleRad,
        left.state.contactPatches[wheelId].toeAngleRad, `${name}:${wheelId}:render toe`);
      assert.equal(renderState.wheels[wheelId].steeringAngleRad,
        left.state.contactPatches[wheelId].steeringAngleRad, `${name}:${wheelId}:render steering`);
    }
    assert.ok(Math.abs(Number(left.state.position.x) + Number(right.state.position.x)) < 0.01,
      `${name}:mirrored position`);
    assert.ok(Math.abs(Number(left.state.velocity.x) + Number(right.state.velocity.x)) < 0.02,
      `${name}:mirrored lateral velocity`);
    assert.ok(Math.abs(Number(left.state.angularVelocityWorld.y)
      + Number(right.state.angularVelocityWorld.y)) < 0.02, `${name}:mirrored yaw`);
    for (const wheelId of WHEEL_IDS) {
      const mirroredWheelId = wheelId[1] === 'l' ? `${wheelId[0]}r` : `${wheelId[0]}l`;
      assert.ok(Math.abs(Number(left.state.contactPatches[wheelId].lateralForceN)
        + Number(right.state.contactPatches[mirroredWheelId].lateralForceN)) < 5,
      `${name}:${wheelId}:mirrored force`);
    }
  }
});
