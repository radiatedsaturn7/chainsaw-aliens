import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  VehicleDynamicsRunner,
  createVehicleDynamicsState
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { ContactPatchTireModel } from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  unpackPhysicsIncidentFrame,
  verifyPhysicsIncidentFixture
} from '../../src/racing/simulation/PhysicsIncidentRecorder.js';
import { createInvalidSurfaceSample, createSurfaceSample } from '../../src/racing/simulation/SurfaceSample.js';
import { hashTrackStateValue, stableTrackStateStringify } from '../../src/racing/trackState/TrackStateMath.js';
import {
  buildRaceBakedSurfaceSampler,
  sampleRaceBakedSurface
} from '../../src/racing/RaceBakedSurfaceSampler.js';

const FIXTURE = JSON.parse(readFileSync(
  new URL('../fixtures/studioSprint2HillIncident.json', import.meta.url),
  'utf8'
));
const FPS_VALUES = [30, 60, 90, 120, 144];
const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];
const INCIDENT_SURFACE_SAMPLER = buildRaceBakedSurfaceSampler({
  mesh: {
    triangles: FIXTURE.preparedWorldTriangles.map((triangle) => ({
      vertices: triangle.vertices.map((vertex) => ({
        x: vertex.x,
        z: vertex.z,
        elevation: vertex.preparedElevation
      })),
      faceNormal: triangle.normal,
      region: triangle.region,
      source: triangle.source
    }))
  },
  elevationScaleM: FIXTURE.capture.elevationScaleM,
  bucketSizeM: 20
});

const decodeFrame = (packed) => unpackPhysicsIncidentFrame(packed, FIXTURE.terrainSampleTable);

function splitRunnerEpochs() {
  const epochs = [];
  let current = [];
  let previousStep = -1;
  FIXTURE.frames.forEach((frame) => {
    const step = Number(frame[0]);
    if (current.length && step < previousStep) {
      epochs.push(current);
      current = [];
    }
    current.push(frame);
    previousStep = step;
  });
  if (current.length) epochs.push(current);
  return epochs;
}

function initialStateFromFrame(frame) {
  const state = createVehicleDynamicsState({
    ...frame.state,
    suspensionState: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, frame.wheels[wheelId].suspension
    ])),
    contactPatches: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, {
      ...frame.wheels[wheelId].kinematics,
      validTreadContact: frame.wheels[wheelId].validTreadContact,
      invalidContactReason: frame.wheels[wheelId].invalidContactReason
    }]))
  });
  return state;
}

function environmentForFrame(frame, recoveryFrame) {
  const centerByWheel = Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId,
    frame.terrainSamples.find((sample) => sample.wheelId === wheelId
      && sample.offsetIndex === null && sample.kind === 'wheel-center-and-footprint')
      || frame.terrainSamples.find((sample) => sample.wheelId === wheelId)
  ]));
  const samplesForWheel = (wheelId) => frame.terrainSamples.filter((sample) => (
    sample.wheelId === wheelId && sample.offsetIndex !== null
  ));
  const terrainAt = (point = {}) => {
    const candidates = frame.terrainSamples.filter((sample) => Number.isFinite(sample.physics?.heightM));
    const closest = candidates.reduce((best, sample) => {
      const distanceSquared = (Number(sample.point?.x || 0) - Number(point.x || 0)) ** 2
        + (Number(sample.point?.z || 0) - Number(point.z || 0)) ** 2;
      return !best || distanceSquared < best.distanceSquared ? { sample, distanceSquared } : best;
    }, null);
    const exact = closest?.distanceSquared <= 0.000001 ? closest.sample : null;
    if (exact) return {
      ...createSurfaceSample(exact.physics, {
        queryPosition: point,
        source: exact.physics?.source || 'studio-sprint-2-exact-query'
      }),
      friction: Number(exact.physics?.friction ?? 1),
      surfaceId: exact.physics?.surfaceId || null
    };
    const closestSample = closest?.sample || null;
    const prepared = sampleRaceBakedSurface(INCIDENT_SURFACE_SAMPLER, point, {
      preferredRegion: closestSample?.physics?.region || null
    });
    if (!prepared) return createInvalidSurfaceSample({
      queryPosition: point,
      source: 'studio-sprint-2-recording',
      reason: 'outside-recorded-surface'
    });
    return {
      ...createSurfaceSample({
        valid: true,
        heightM: prepared.elevation * FIXTURE.capture.elevationScaleM,
        normal: prepared.normal,
        region: prepared.region,
        source: prepared.source,
        triangleId: FIXTURE.preparedWorldTriangles[prepared.triangleId]?.id
      }, {
        queryPosition: point,
        source: 'studio-sprint-2-recording'
      }),
      friction: Number(closestSample?.physics?.friction ?? 1),
      surfaceId: closestSample?.physics?.surfaceId || null
    };
  };
  const surfaceSamplesByWheel = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
    wheelId,
    centerByWheel[wheelId]
      ? createSurfaceSample(centerByWheel[wheelId].physics, {
          queryPosition: centerByWheel[wheelId].point,
          source: 'studio-sprint-2-wheel-recording'
        })
      : createInvalidSurfaceSample({
          source: 'studio-sprint-2-wheel-recording',
          reason: 'missing-recorded-wheel-sample'
        })
  ]));
  return {
    airDensityKgM3: 0,
    requireValidTerrainEnvelope: true,
    surfaceSamplesByWheel,
    surfaceHeightByWheel: Object.fromEntries(WHEEL_IDS.flatMap((wheelId) => (
      surfaceSamplesByWheel[wheelId].valid
        ? [[wheelId, surfaceSamplesByWheel[wheelId].heightM]] : []
    ))),
    surfaceNormalByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, centerByWheel[wheelId]?.physics?.normal || { x: 0, y: 1, z: 0 }
    ])),
    contactSamplesByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId,
      samplesForWheel(wheelId).map((sample) => ({
        heightM: sample.physics.heightM,
        normalX: sample.physics.normal?.x,
        normalY: sample.physics.normal?.y,
        normalZ: sample.physics.normal?.z,
        supported: Number.isFinite(sample.physics.heightM)
      }))
    ])),
    materialByWheel: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, {
      baseSurfaceId: centerByWheel[wheelId]?.physics?.surfaceId || 'asphalt',
      surfaceId: centerByWheel[wheelId]?.physics?.surfaceId || 'asphalt',
      grip: Number(centerByWheel[wheelId]?.physics?.friction ?? 1),
      effectiveGrip: Number(centerByWheel[wheelId]?.physics?.friction ?? 1),
      surfaceGripScale: 1
    }])),
    sampleTerrainAtWorldPoint: terrainAt,
    sampleTerrainAtWorldPoints: (points) => points.map(terrainAt),
    sampleTerrainMaximumHeightInBounds: () => Math.max(
      ...frame.terrainSamples.map((sample) => Number(sample.physics?.heightM)).filter(Number.isFinite)
    ),
    getRouteRecoveryState: () => recoveryFrame ? {
      position: recoveryFrame.recovery.position,
      orientation: recoveryFrame.state.orientation,
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocityWorld: { x: 0, y: 0, z: 0 },
      grounded: true,
      routeDistance: recoveryFrame.recovery.routeDistance
    } : null
  };
}

function replayEpoch(epoch, fps, {
  speedMps = null,
  tireHz = FIXTURE.tireHz,
  durationSeconds: requestedDurationSeconds = null
} = {}) {
  const frames = epoch.map(decodeFrame);
  const recoveryFrame = frames.find((frame) => frame.recovery) || null;
  const frameBySubstep = new Map(frames.map((frame) => [
    `${frame.stepIndex}:${frame.substepIndex}`, frame
  ]));
  const fallbackFrame = frames.at(-1);
  const initialState = initialStateFromFrame(frames[0]);
  if (Number.isFinite(Number(speedMps))) {
    const resolvedSpeedMps = Number(speedMps);
    const yaw = Number(initialState.yawRad || 0);
    initialState.velocity = {
      x: Math.sin(yaw) * resolvedSpeedMps,
      y: 0,
      z: Math.cos(yaw) * resolvedSpeedMps
    };
    initialState.groundSpeedMps = resolvedSpeedMps;
    initialState.bodyLongitudinalSpeedMps = resolvedSpeedMps;
    initialState.bodyLateralSpeedMps = 0;
    initialState.signedTravelSpeedMps = resolvedSpeedMps;
    initialState.speedMps = resolvedSpeedMps;
    initialState.wheelAngularVelocityRadps = Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, resolvedSpeedMps / Number(FIXTURE.vehicleConfiguration.wheelRadiusM)
    ]));
  }
  let upperOvertravelUnsupported = false;
  let sawLoadBearingFullBump = false;
  let maximumOvertravelM = 0;
  let bodyContactObserved = false;
  const overtravelContactStates = new Set();
  const inspectSuspension = (suspensionState = {}) => Object.values(
    suspensionState
  ).forEach((suspension) => {
    const raw = Number(suspension.rawRequestedCompressionM
      ?? suspension.requestedCompressionM);
    const travel = Number(suspension.suspensionTravelM);
    const overtravel = Math.max(0, Number(suspension.overtravelM || 0));
    maximumOvertravelM = Math.max(maximumOvertravelM, overtravel);
    if (raw > travel + 1e-6) {
      overtravelContactStates.add(`${suspension.contactState}:${suspension.invalidContactReason}`);
      upperOvertravelUnsupported ||= suspension.invalidContactReason
        === 'outside-suspension-reach';
      sawLoadBearingFullBump ||= suspension.validTreadContact === true
        && suspension.bottomedOut === true
        && Number(suspension.hardStopForceN) > 0;
    }
  });
  const physicalTireModel = new ContactPatchTireModel();
  const runner = new VehicleDynamicsRunner({
    config: {
      ...FIXTURE.vehicleConfiguration,
      tireHz,
      telemetryRetention: 'transient',
      physicsIncidentRecordingEnabled: false,
      maxCatchUpSteps: 30
    },
    initialState,
    tireContactSubsystem: {
      step(args) {
        const result = physicalTireModel.step(args);
        inspectSuspension(result.suspensionState);
        return result;
      }
    },
    inputTimeline: frames.filter((frame) => frame.substepIndex === 0).map((frame, index) => ({
      timeSeconds: (index + 1) / 120,
      input: frame.controls
    })),
    environmentProvider: ({ stepIndex, substepIndex }) => environmentForFrame(
      frameBySubstep.get(`${stepIndex}:${substepIndex}`) || fallbackFrame,
      recoveryFrame
    )
  });
  const inspect = () => inspectSuspension(runner.state.suspensionState || {});
  const recordedDurationSeconds = frames.length / FIXTURE.tireHz;
  const durationSeconds = requestedDurationSeconds !== null
    && requestedDurationSeconds !== undefined
    && Number.isFinite(Number(requestedDurationSeconds))
    ? Number(requestedDurationSeconds) : recordedDurationSeconds;
  for (let elapsed = 0; elapsed < durationSeconds - 1e-12; elapsed += 1 / fps) {
    runner.advance(Math.min(1 / fps, durationSeconds - elapsed), {
      onFixedStep: (telemetry) => {
        bodyContactObserved ||= telemetry.forces?.bodyCollision?.contacts?.some((contact) => (
          contact.contactType !== 'wheel-sidewall'
        )) === true;
      }
    });
    inspect();
  }
  runner.drainCatchUp();
  inspect();
  return {
    checksum: hashTrackStateValue(stableTrackStateStringify(runner.createStateSnapshot())),
    recoveryHistory: runner.penetrationRecoveryState.history,
    upperOvertravelUnsupported,
    sawLoadBearingFullBump,
    maximumOvertravelM,
    bodyContactObserved,
    overtravelContactStates: [...overtravelContactStates].sort(),
    ordinaryHillFailure: upperOvertravelUnsupported
      || runner.penetrationRecoveryState.history.length > 0
  };
}

function replayFixture(fps) {
  const epochs = splitRunnerEpochs().map((epoch) => replayEpoch(epoch, fps));
  return {
    checksum: hashTrackStateValue(stableTrackStateStringify(epochs.map((epoch) => epoch.checksum))),
    recoveryHistory: epochs.flatMap((epoch) => epoch.recoveryHistory),
    upperOvertravelUnsupported: epochs.some((epoch) => epoch.upperOvertravelUnsupported),
    sawLoadBearingFullBump: epochs.some((epoch) => epoch.sawLoadBearingFullBump),
    maximumOvertravelM: Math.max(...epochs.map((epoch) => epoch.maximumOvertravelM)),
    bodyContactObserved: epochs.some((epoch) => epoch.bodyContactObserved),
    overtravelContactStates: [...new Set(epochs.flatMap((epoch) => (
      epoch.overtravelContactStates
    )))].sort(),
    ordinaryHillFailure: epochs.some((epoch) => epoch.ordinaryHillFailure)
  };
}

test('Studio Sprint 2 incident fixture contains the exact non-flat prepared hill capture', () => {
  assert.equal(FIXTURE.sourceDocumentChecksum,
    '5eb6003c11fe5eac2d3fd2515b55a2d0b7f6304ccf371e8d90bb13c52b6e807b');
  assert.equal(FIXTURE.capture.tireSubsystem, 'ContactPatchTireModel');
  assert.equal(FIXTURE.capture.completeAuthoritativeSolver, true);
  assert.equal(FIXTURE.durationSeconds, 5);
  assert.equal(FIXTURE.frames.length, 1800);
  assert.equal(FIXTURE.preparedWorldTriangles.length > 100, true);
  const heights = FIXTURE.preparedWorldTriangles.flatMap((triangle) => (
    triangle.vertices.map((vertex) => vertex.y)
  ));
  assert.equal(Math.max(...heights) - Math.min(...heights) > 1, true);
  assert.equal(FIXTURE.preparedWorldTriangles.some((triangle) => (
    Math.abs(Number(triangle.normal?.x || 0)) > 0.01
      || Math.abs(Number(triangle.normal?.z || 0)) > 0.01
  )), true);
  assert.equal(FIXTURE.terrainSampleTable.some((sample) => sample[5]?.[0] !== null), true);
  assert.equal(FIXTURE.terrainSampleTable.some((sample) => (
    Number.isFinite(Number(sample[5]?.[1]))
      && Number.isFinite(Number(sample[6]?.[0]))
      && Math.abs(Number(sample[5][1]) - Number(sample[6][0])) > 0.002
  )), true, 'fixture must retain prepared-versus-analytical projection disagreement');
  assert.equal(verifyPhysicsIncidentFixture(FIXTURE).valid, true);
  assert.equal(verifyPhysicsIncidentFixture(FIXTURE).replayChecksum, FIXTURE.replayChecksum);
});

test('full authoritative incident replay keeps upper overtravel load-bearing at every render FPS', () => {
  const results = FPS_VALUES.map(replayFixture);
  results.forEach((result) => {
    assert.equal(result.upperOvertravelUnsupported, false, JSON.stringify(result));
    assert.equal(result.sawLoadBearingFullBump, true, JSON.stringify(result));
    assert.ok(result.maximumOvertravelM > 0.01, JSON.stringify(result));
    assert.equal(result.ordinaryHillFailure, false);
    assert.deepEqual(result.recoveryHistory, []);
  });
  results.slice(1).forEach((result) => {
    assert.equal(result.checksum, results[0].checksum);
    assert.deepEqual(result.recoveryHistory, results[0].recoveryHistory);
  });
});

test('Studio Sprint 2 fixture retains the historical failure while the current solver passes it', () => {
  assert.equal(FIXTURE.trigger.reasons.some((reason) => [
    'requested-compression-exceeds-travel',
    'outside-suspension-reach',
    'repeated-recovery-region'
  ].includes(reason.type)), true);
  const result = replayFixture(60);
  assert.equal(result.ordinaryHillFailure, false, JSON.stringify(result));
  assert.equal(result.upperOvertravelUnsupported, false);
  assert.equal(result.sawLoadBearingFullBump, true, JSON.stringify(result));
  assert.equal(result.bodyContactObserved, true, JSON.stringify(result));
});

test('WRX2 clears the recorded hill at 10, 20, 30, 40, and 60 mph without recovery', () => {
  const incidentEpoch = splitRunnerEpochs().at(-1);
  for (const speedMph of [10, 20, 30, 40, 60]) {
    const result = replayEpoch(incidentEpoch, 60, {
      speedMps: speedMph * 0.44704,
      durationSeconds: 0.75
    });
    assert.equal(result.upperOvertravelUnsupported, false, `${speedMph} mph`);
    assert.equal(result.ordinaryHillFailure, false, `${speedMph} mph`);
    assert.deepEqual(result.recoveryHistory, [], `${speedMph} mph`);
  }
});

test('recorded full-bump hill support remains valid at 120, 240, and 360 tire Hz', () => {
  const incidentEpoch = splitRunnerEpochs().at(-1);
  for (const tireHz of [120, 240, 360]) {
    const result = replayEpoch(incidentEpoch, 60, {
      speedMps: 30 * 0.44704,
      tireHz,
      durationSeconds: 0.5
    });
    assert.equal(result.upperOvertravelUnsupported, false, `${tireHz} Hz`);
    assert.equal(result.ordinaryHillFailure, false, `${tireHz} Hz`);
    assert.deepEqual(result.recoveryHistory, [], `${tireHz} Hz`);
  }
});

test('ten-second Studio Sprint 2 hill replay has bounded deterministic recovery history', () => {
  const incidentEpoch = splitRunnerEpochs().at(-1);
  const results = FPS_VALUES.map((fps) => replayEpoch(incidentEpoch, fps, {
    durationSeconds: 10
  }));
  results.forEach((result) => {
    const history = result.recoveryHistory;
    assert.equal(result.upperOvertravelUnsupported, false);
    assert.equal(result.ordinaryHillFailure, false,
      'ordinary hill support must not invoke catastrophic recovery');
    assert.equal(history.length <= 128, true);
    assert.equal(new Set(history.map(({ sourceKey }) => sourceKey)).size, history.length,
      'a recovery source may not be reused');
    assert.equal(history.filter(({ recoveryMode }) => recoveryMode === 'historical').length <= 1, true);
    assert.equal(history.some(({ routeDistance }) => routeDistance === 0), false,
      'projection failure must not reset route distance to zero');
    assert.equal(history.some(({ velocityIntoBlockingNormalMps }) => (
      Number(velocityIntoBlockingNormalMps) < -1e-6
    )), false, 'recovery velocity must not attack the same blocking normal');
    assert.equal(history.some(({ penetrationIncidentId }, index) => (
      history.slice(0, index).some((prior) => prior.penetrationIncidentId === penetrationIncidentId
        && prior.sourceKey === history[index].sourceKey)
    )), false);
  });
  results.slice(1).forEach((result) => {
    assert.equal(result.checksum, results[0].checksum);
    assert.deepEqual(result.recoveryHistory, results[0].recoveryHistory);
  });
});
