import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PhysicsIncidentRecorder,
  unpackPhysicsIncidentFrame,
  verifyPhysicsIncidentFixture
} from '../../src/racing/simulation/PhysicsIncidentRecorder.js';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfigFromTuning
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {
  DEFAULT_CAR_TUNING,
  RACE_CAR_DIMENSIONS,
  WRX2_PHYSICAL_PROFILE,
  WRX_2022_SHARED_TUNING,
  WRX_2022_TRANSMISSIONS
} from '../../src/racing/raceData.js';

const WHEELS = ['fl', 'fr', 'rl', 'rr'];
const wheelEntries = (value) => Object.fromEntries(WHEELS.map((wheelId) => [wheelId, value(wheelId)]));

test('incident recorder retains two seconds, captures post-roll, exact triangles, and checksums', () => {
  const recorder = new PhysicsIncidentRecorder({
    tireHz: 10,
    preIncidentSeconds: 2,
    postIncidentSeconds: 1,
    sourceDocumentChecksum: 'race-document-checksum',
    vehicleConfiguration: { id: 'wrx2' },
    triangleProvider: () => [{
      id: 71,
      vertices: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0.4, z: 0 }, { x: 0, y: 0.2, z: 2 }],
      normal: { x: -0.19, y: 0.97, z: -0.1 }
    }]
  });
  const payload = (index, incident = false) => ({
    state: { position: { x: 0, y: 0.6, z: index * 0.1 }, velocity: { z: 1 } },
    previousPosition: { x: 0, y: 0.6, z: (index - 1) * 0.1 },
    controls: { throttle: 0.5 },
    tireResult: {
      suspensionState: wheelEntries((wheelId) => ({
        requestedCompressionM: incident && wheelId === 'fl' ? 0.3 : 0.1,
        suspensionTravelM: 0.22,
        compressionM: 0.1,
        validTreadContact: true
      })),
      contactPatches: wheelEntries(() => ({}))
    },
    bodyResult: { contacts: [], maximumPenetrationAfterSolveM: 0 },
    environment: { physicsIncidentDiagnostics: { terrainSamples: [{
      triangleId: 71, prepared: { triangleId: 71 }, physics: { heightM: index * 0.01 }
    }] } },
    stepIndex: Math.floor(index / 2), substepIndex: index % 2, timeSeconds: index / 10,
    toleranceM: 0.008
  });
  for (let index = 0; index < 25; index += 1) recorder.recordSubstep(payload(index));
  recorder.recordSubstep(payload(25, true));
  for (let index = 26; index < 35; index += 1) recorder.recordSubstep(payload(index));

  const fixture = recorder.getCompletedIncidents()[0];
  assert.ok(fixture);
  assert.equal(unpackPhysicsIncidentFrame(fixture.frames[0]).timeSeconds, 0.5);
  assert.equal(unpackPhysicsIncidentFrame(fixture.frames.at(-1)).timeSeconds, 3.4);
  assert.equal(fixture.preparedWorldTriangles[0].id, 71);
  assert.equal(fixture.sourceDocumentChecksum, 'race-document-checksum');
  assert.equal(fixture.trigger.reasons[0].type, 'requested-compression-exceeds-travel');
  assert.equal(verifyPhysicsIncidentFixture(fixture).valid, true);
  assert.equal(verifyPhysicsIncidentFixture(fixture).replayChecksum, fixture.replayChecksum);
});

test('authoritative WRX2 tire and suspension solver automatically records rising-terrain failure', () => {
  const tuning = {
    ...DEFAULT_CAR_TUNING,
    ...WRX_2022_SHARED_TUNING,
    ...WRX_2022_TRANSMISSIONS.automatic,
    ...RACE_CAR_DIMENSIONS['wrx-2022'],
    physicalVehicleProfile: WRX2_PHYSICAL_PROFILE
  };
  const config = createVehicleDynamicsConfigFromTuning(tuning, {
    chassisHz: 120, tireHz: 120, telemetryRetention: 'latest'
  });
  const recorder = new PhysicsIncidentRecorder({
    tireHz: 120, preIncidentSeconds: 2, postIncidentSeconds: 1 / 120,
    sourceDocumentChecksum: 'studio-sprint2-test', vehicleConfiguration: config
  });
  const runner = new VehicleDynamicsRunner({
    config,
    physicsIncidentRecorder: recorder,
    initialState: {
      position: { x: 0, y: config.cgHeightM, z: 0 },
      velocity: { x: 0, y: 0, z: 12 },
      grounded: true,
      gear: 3,
      engineRpm: 2800
    },
    inputTimeline: [{ timeSeconds: 0, input: { throttle: 0.2, requestedGear: 3 } }],
    environmentProvider: ({ stepIndex }) => {
      const hillHeightM = stepIndex < 3 ? 0 : 0.75;
      const terrainSamples = WHEELS.map((wheelId) => ({
        wheelId, point: { x: 0, y: 0, z: 0 },
        physics: { heightM: hillHeightM, normal: { x: 0, y: 1, z: 0 } },
        prepared: { triangleId: 12, heightM: hillHeightM, normal: { x: 0, y: 1, z: 0 } },
        analytical: { heightM: hillHeightM, normal: { x: 0, y: 1, z: 0 } }
      }));
      return {
        airDensityKgM3: 0,
        capturePhysicsIncidentDiagnostics: true,
        physicsIncidentDiagnostics: { terrainSamples, routeDistanceM: stepIndex * 0.1 },
        surfaceHeightByWheel: wheelEntries(() => hillHeightM),
        surfaceNormalByWheel: wheelEntries(() => ({ x: 0, y: 1, z: 0 })),
        contactSamplesByWheel: wheelEntries(() => [{
          heightM: hillHeightM, normalX: 0, normalY: 1, normalZ: 0, supported: true
        }])
      };
    }
  });
  runner.advance(4 / 120);

  const fixture = recorder.getCompletedIncidents()[0];
  assert.ok(fixture, 'the automatically armed recorder should capture the hill transition');
  assert.ok(fixture.trigger.reasons.some((reason) => [
    'requested-compression-exceeds-travel', 'outside-suspension-reach'
  ].includes(reason.type)));
  assert.ok(fixture.frames.map(unpackPhysicsIncidentFrame).some((frame) => Object.values(frame.wheels).some(
    (wheel) => wheel.suspension && wheel.kinematics
  )), 'the real contact patch and suspension output must be recorded');
});
