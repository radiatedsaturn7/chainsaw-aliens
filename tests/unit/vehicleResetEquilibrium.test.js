import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfig
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { unpackPhysicsIncidentFrame } from '../../src/racing/simulation/PhysicsIncidentRecorder.js';
import { createSurfaceSample } from '../../src/racing/simulation/SurfaceSample.js';
import {
  quaternionFromEuler,
  rotateVectorByQuaternion
} from '../../src/racing/simulation/RigidBodyMath.js';
import {
  buildRaceBakedSurfaceSampler,
  sampleRaceBakedSurface
} from '../../src/racing/RaceBakedSurfaceSampler.js';

const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];

function createAnalyticalTerrain({ grade = 0, bank = 0, missingWheel = null } = {}) {
  const sample = (point = {}, query = {}) => {
    const normalLength = Math.hypot(bank, 1, grade);
    return {
      valid: true,
      heightM: grade * Number(point.z || 0) + bank * Number(point.x || 0)
        - (query.wheelId === missingWheel ? 0.08 : 0),
      normal: { x: -bank / normalLength, y: 1 / normalLength, z: -grade / normalLength },
      surfaceId: 'asphalt', friction: 1, region: 'road',
      triangleId: query.wheelId ? WHEEL_IDS.indexOf(query.wheelId) + 1 : 10
    };
  };
  return {
    airDensityKgM3: 0,
    requireValidTerrainEnvelope: true,
    sampleTerrainAtWorldPoint: sample,
    sampleTerrainAtWorldPoints: (points) => points.map((point) => sample(point)),
    sampleTerrainMaximumHeightInBounds: ({ minX = 0, maxX = 0, minZ = 0, maxZ = 0 } = {}) => (
      Math.max(grade * minZ + bank * minX, grade * minZ + bank * maxX,
        grade * maxZ + bank * minX, grade * maxZ + bank * maxX)
    )
  };
}

test('real static support solve converges and installs one final flat-ground pose', () => {
  const config = createVehicleDynamicsConfig({
    handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'none'
  });
  const environment = createAnalyticalTerrain();
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    environmentProvider: () => environment
  });
  let reset;
  try {
    reset = runner.resetAuthoritativeState({
      position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
    }, { parkUntilDrive: true });
  } catch (error) {
    assert.fail(JSON.stringify(error.resetFailure?.trace?.slice(-4)));
  }
  assert.equal(reset.equilibrium.status, 'converged');
  assert.ok(reset.equilibrium.forceResidualN < config.massKg * 9.81 * 0.005);
  assert.equal(reset.supportedWheelCount, 4);
  assert.equal(reset.equilibrium.trace.length, reset.equilibrium.iterations);
  for (const wheelId of WHEEL_IDS) {
    assert.ok(Number.isFinite(reset.state.suspensionState[wheelId].compressionM));
    assert.ok(Number.isFinite(reset.state.contactPatches[wheelId].contactPointWorld.y));
    assert.equal(reset.state.suspensionState[wheelId].unsprungVelocityMps, 0);
  }
});

test('authoritative reset rejects an upside-down requested orientation', () => {
  const config = createVehicleDynamicsConfig({
    handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'none'
  });
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
      orientation: quaternionFromEuler({ yaw: 0.4, roll: Math.PI })
    },
    environmentProvider: () => createAnalyticalTerrain()
  });
  const reset = runner.resetAuthoritativeState({
    position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
    orientation: quaternionFromEuler({ yaw: 0.4, roll: Math.PI }),
    gear: 1
  }, { parkUntilDrive: true });
  const stateUp = rotateVectorByQuaternion(
    { x: 0, y: 1, z: 0 }, reset.state.orientation
  );
  const renderUp = rotateVectorByQuaternion(
    { x: 0, y: 1, z: 0 }, reset.renderState.orientation
  );
  assert.equal(reset.equilibrium.status, 'converged');
  assert.ok(stateUp.y > 0.9);
  assert.ok(renderUp.y > 0.9);
  assert.equal(reset.state.rollRad > -Math.PI / 2 && reset.state.rollRad < Math.PI / 2, true);
});

test('immutable reset hold preserves the converged four-wheel support transaction', () => {
  const config = createVehicleDynamicsConfig({
    handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'none'
  });
  const environment = createAnalyticalTerrain();
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    environmentProvider: () => environment
  });
  const reset = runner.resetAuthoritativeState({
    position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
  }, { parkUntilDrive: true });
  const support = runner.stationaryResetHold.staticSupportState;
  assert.equal(Object.isFrozen(support), true);
  assert.equal(Object.isFrozen(support.suspensionState.fl), true);
  assert.equal(support.resetGeneration, reset.resetGeneration);
  const original = structuredClone(support);
  for (let step = 0; step < 600; step += 1) {
    runner.advance(1 / 120, { input: { throttle: 0 } });
  }
  assert.deepEqual(runner.stationaryResetHold.staticSupportState, original);
  for (const wheelId of WHEEL_IDS) {
    assert.equal(runner.state.suspensionState[wheelId].unsprungVelocityMps, 0);
    assert.equal(runner.state.suspensionState[wheelId].compressionVelocityMps, 0);
    assert.equal(runner.state.suspensionState[wheelId].damperVelocityMps, 0);
    assert.equal(
      runner.state.suspensionState[wheelId].compressionM,
      original.suspensionState[wheelId].compressionM
    );
    assert.equal(runner.state.wheelLoadsN[wheelId], original.wheelLoadsN[wheelId]);
  }
});

test('wake transition restores immutable support and suppresses throttle for one step', () => {
  const config = createVehicleDynamicsConfig({
    handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'latest'
  });
  const environment = createAnalyticalTerrain();
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    },
    environmentProvider: () => environment
  });
  runner.resetAuthoritativeState({
    position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
  }, { parkUntilDrive: true });
  runner.advance(2 / 120, { input: { throttle: 0 } });
  const held = structuredClone(runner.stationaryResetHold.staticSupportState);
  runner.addInputSample(runner.simulationTimeSeconds, { throttle: 0.2, requestedGear: 1 });
  runner.advance(1 / 120);
  assert.equal(runner.stationaryResetHold, null);
  assert.equal(runner.telemetry.at(-1).controls.throttle, 0);
  for (const wheelId of WHEEL_IDS) {
    assert.ok(Math.abs(
      runner.state.suspensionState[wheelId].compressionM
        - held.suspensionState[wheelId].compressionM
    ) < 0.00025);
    assert.equal(runner.state.suspensionState[wheelId].unsprungVelocityMps, 0);
  }
  runner.advance(1 / 120);
  assert.ok(runner.telemetry.at(-1).controls.throttle > 0);
});

test('real static support solve covers slopes bank crest and crash attitudes', () => {
  const cases = [
    ['10-percent slope', { grade: 0.1 }, {}],
    ['20-percent slope', { grade: 0.2 }, {}],
    ['banked road', { bank: 0.12 }, {}],
    ['three-wheel support', { missingWheel: 'fl', bank: 0.03 }, {}],
    ['one wheel over a crest', { missingWheel: 'rr', grade: 0.03 }, {}],
    ['post-wall-impact', {}, { velocity: { x: 18, y: 0, z: 0 } }],
    ['post-rollover', {}, { orientation: { x: 0, y: 0, z: 1, w: 0 } }],
    ['post-jump', {}, { velocity: { x: 0, y: -20, z: 8 } }]
  ];
  for (const [name, terrainOptions, crashState] of cases) {
    const config = createVehicleDynamicsConfig({
      handlingPreset: 'simulation', tireHz: 120, telemetryRetention: 'none'
    });
    const environment = createAnalyticalTerrain(terrainOptions);
    const runner = new VehicleDynamicsRunner({
      config,
      initialState: {
        position: { x: 0, y: config.cgHeightM + 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        ...crashState
      },
      environmentProvider: () => environment
    });
    let reset;
    try {
      reset = runner.resetAuthoritativeState({
        position: { x: 0, y: config.cgHeightM + 0.08, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1
      }, { reason: name, parkUntilDrive: true });
    } catch (error) {
      assert.fail(`${name}: ${error.message} ${JSON.stringify({
        residual: error.resetFailure?.forceResidualN,
        moment: error.resetFailure?.momentResidualNm,
        supported: error.resetFailure?.supportedWheelCount
      })}`);
    }
    assert.equal(reset.equilibrium.status, 'converged', name);
    assert.ok(reset.supportedWheelCount >= 2, name);
    const parkedHeight = runner.state.position.y;
    for (let step = 0; step < 60; step += 1) {
      runner.advance(1 / 120, { input: { throttle: 0 } });
    }
    assert.ok(Math.abs(runner.state.position.y - parkedHeight) < 0.002, name);
    const heldLoads = { ...runner.state.wheelLoadsN };
    runner.addInputSample(runner.simulationTimeSeconds, { throttle: 1, requestedGear: 1 });
    runner.advance(1 / 120);
    runner.advance(1 / 120);
    assert.equal(runner.stationaryResetHold, null, name);
    assert.ok(Number(runner.state.velocity.y || 0) <= 0.05, name);
    for (const wheelId of WHEEL_IDS) {
      const before = Number(heldLoads[wheelId] || 0);
      const after = Number(runner.state.wheelLoadsN[wheelId] || 0);
      if (before > 1) assert.ok(Math.abs(after - before) / before < 0.05, `${name}:${wheelId}`);
    }
  }
});

test('actual Studio Sprint 2 crash reset uses real prepared terrain and records equilibrium', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('../fixtures/studioSprint2HillIncident.json', import.meta.url), 'utf8'
  ));
  const frames = fixture.frames.map((packed) => (
    unpackPhysicsIncidentFrame(packed, fixture.terrainSampleTable)
  ));
  const crashFrame = frames.find((frame) => frame.recovery?.stepIndex === 350);
  assert.ok(crashFrame);
  const sampler = buildRaceBakedSurfaceSampler({
    mesh: {
      triangles: fixture.preparedWorldTriangles.map((triangle) => ({
        vertices: triangle.vertices.map((vertex) => ({
          x: vertex.x, z: vertex.z, elevation: vertex.preparedElevation
        })),
        faceNormal: triangle.normal, region: triangle.region, source: triangle.source
      }))
    },
    elevationScaleM: fixture.capture.elevationScaleM,
    bucketSizeM: 20
  });
  const terrainAt = (point = {}) => {
    const hit = sampleRaceBakedSurface(sampler, point);
    if (!hit) return { valid: false, heightM: null, normal: null, reason: 'outside-fixture' };
    return {
      valid: true,
      heightM: hit.elevation * fixture.capture.elevationScaleM,
      normal: hit.normal,
      region: hit.region,
      source: hit.source,
      triangleId: fixture.preparedWorldTriangles[hit.triangleId]?.id,
      friction: 1,
      surfaceId: 'asphalt'
    };
  };
  let maximumFixtureHeightM = -Infinity;
  for (const triangle of fixture.preparedWorldTriangles) {
    for (const vertex of triangle.vertices) maximumFixtureHeightM = Math.max(
      maximumFixtureHeightM,
      vertex.preparedElevation * fixture.capture.elevationScaleM
    );
  }
  const centerByWheel = Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId,
    crashFrame.terrainSamples.find((sample) => sample.wheelId === wheelId
      && sample.offsetIndex === null && sample.kind === 'wheel-center-and-footprint')
      || crashFrame.terrainSamples.find((sample) => sample.wheelId === wheelId)
  ]));
  const surfaceSamplesByWheel = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId,
    createSurfaceSample(centerByWheel[wheelId].physics, {
      queryPosition: centerByWheel[wheelId].point,
      source: 'studio-sprint-2-reset-fixture'
    })
  ]));
  const environment = {
    airDensityKgM3: 0,
    requireValidTerrainEnvelope: true,
    sampleTerrainAtWorldPoint: terrainAt,
    sampleTerrainAtWorldPoints: (points) => points.map(terrainAt),
    sampleTerrainMaximumHeightInBounds: () => maximumFixtureHeightM,
    surfaceSamplesByWheel,
    surfaceHeightByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, surfaceSamplesByWheel[wheelId].heightM
    ])),
    surfaceNormalByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, surfaceSamplesByWheel[wheelId].normal
    ])),
    getRouteRecoveryState: () => {
      const verified = frames[0];
      return {
        position: verified.state.position,
        orientation: verified.state.orientation,
        routeDistance: verified.routeDistanceM,
        grounded: true
      };
    }
  };
  const runner = new VehicleDynamicsRunner({
    config: { ...fixture.vehicleConfiguration, telemetryRetention: 'none', tireHz: 120 },
    initialState: crashFrame.state,
    environmentProvider: () => environment
  });
  let reset;
  try {
    reset = runner.resetAuthoritativeState({
      ...crashFrame.state,
      position: crashFrame.recovery.position,
      routeDistance: crashFrame.recovery.routeDistance
    }, { reason: 'studio-sprint-2-crash-fixture', parkUntilDrive: true });
  } catch (error) {
    assert.fail(JSON.stringify(error.resetFailure?.trace?.slice(-6)));
  }
  assert.equal(reset.equilibrium.status, 'converged');
  assert.equal(runner.resetIncidentHistory.length, 1);
  assert.ok(Math.hypot(
    runner.resetIncidentHistory[0].crashPose.position.x - crashFrame.state.position.x,
    runner.resetIncidentHistory[0].crashPose.position.y - crashFrame.state.position.y,
    runner.resetIncidentHistory[0].crashPose.position.z - crashFrame.state.position.z
  ) < 0.000001);
  assert.ok(runner.resetIncidentHistory[0].equilibrium.trace.length > 1);
  for (let step = 0; step < 60; step += 1) {
    runner.advance(1 / 120, { input: { throttle: 0 } });
  }
  assert.equal(runner.resetIncidentHistory[0].first60FixedSteps.length, 60);
  assert.equal(runner.postResetTelemetry.every((sample) => (
    sample.impactEventCount === 0 && sample.recoveryEventCount === 0
  )), true);
});
