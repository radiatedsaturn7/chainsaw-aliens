import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRaceVehicleProvisionalResetPresentation,
  RaceVehicleDynamicsWorkerBridge,
  applyRaceVehicleRenderSnapshot,
  applyWorkerTrackStateVisualDelta,
  resetWorkerTrackStateVisualPresentation,
  createRaceVehicleDynamicsWorkerInitialization
} from '../../src/racing/simulation/RaceVehicleDynamicsWorkerBridge.js';

test('worker Track State visual deltas update only newer bounded cells', () => {
  const session = {};
  applyWorkerTrackStateVisualDelta(session, {
    stepIndex: 8,
    cellRevision: 4, visualRevision: 4,
    dirtyAtlasTiles: [{ tileX: 0, tileZ: 0, revision: 4 }],
    eventSequence: 12,
    cells: [{ key: '0:0', x: 0, z: 0, revision: 4, wetness: 0.6 }]
  });
  applyWorkerTrackStateVisualDelta(session, {
    stepIndex: 9,
    cellRevision: 5,
    eventSequence: 13,
    cells: [{ key: '0:0', x: 0, z: 0, revision: 3, wetness: 0.1 }]
  });
  assert.equal(session.workerTrackStateVisual.cells.size, 1);
  assert.equal(session.workerTrackStateVisual.cells.get('0:0').wetness, 0.6);
  assert.equal(session.workerTrackStateVisual.stepIndex, 9);
  assert.equal(session.workerTrackStateVisual.cellRevision, 5);
  assert.equal(session.workerTrackStateVisual.eventSequence, 13);
  assert.equal(session.workerTrackStateVisual.visualRevision, 5);
  resetWorkerTrackStateVisualPresentation(session);
  assert.equal(session.workerTrackStateVisual.cells.size, 0);
  assert.equal(session.trackStateVisualCache, null);
});
import {
  quaternionFromEuler,
  rotateVectorByQuaternion,
  rotateVectorToBody
} from '../../src/racing/simulation/RigidBodyMath.js';
import { createVehicleRenderStateFromRunner } from '../../src/racing/simulation/VehicleRenderState.js';
import {
  createVehicleRenderSnapshotBuffer,
  interpolateVehicleRenderSnapshots,
  readVehicleRenderSnapshot,
  writeVehicleRenderSnapshot
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
import {
  buildRaceBakedSurfaceSampler,
  packRaceBakedSurfaceSampler
} from '../../src/racing/RaceBakedSurfaceSampler.js';

class FakeWorker {
  constructor() { this.messages = []; this.listeners = new Set(); }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  postMessage(message, transferables = []) { this.messages.push({ message, transferables }); }
  terminate() {}
}

test('production worker initialization copies and transfers packed world only once', () => {
  const original = packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({
    mesh: { triangles: [{ region: 'road', vertices: [
      { x: 0, y: 0, elevation: 0 }, { x: 1, y: 0, elevation: 0 }, { x: 0, y: 1, elevation: 0 }
    ] }] }
  }));
  const runner = {
    config: { chassisHz: 120 },
    state: {},
    createStateSnapshot: () => ({ heightM: 0.55 }),
    inputTimeline: { createSnapshot: () => [{ timeSeconds: 0, input: {} }] }
  };
  const initialization = createRaceVehicleDynamicsWorkerInitialization({
    runner,
    surfaceSampler: original,
    environmentState: { bodyDamage: 20 },
    activeAiVehicles: [{
      id: 'ai-1',
      runner,
      environmentState: { bodyDamage: 0 }
    }]
  });
  const workerSampler = initialization.payload.vehicles[0].physicsWorld.surfaceSampler;
  assert.notEqual(workerSampler.positions.buffer, original.positions.buffer);
  assert.ok(initialization.transferables.includes(workerSampler.positions.buffer));
  assert.equal(initialization.payload.vehicles[0].physicsWorld.environmentState.bodyDamage, 20);
  assert.equal(initialization.payload.vehicles[1].physicsWorld.environmentState.bodyDamage, 0);
  assert.notEqual(
    initialization.payload.vehicles[0].physicsWorld,
    initialization.payload.vehicles[1].physicsWorld
  );
  structuredClone(initialization.payload, { transfer: initialization.transferables });
  assert.equal(workerSampler.positions.byteLength, 0);
  assert.equal(original.positions.byteLength > 0, true);
});

test('render snapshot updates presentation compatibility without exposing a runner', () => {
  const session = {};
  applyRaceVehicleRenderSnapshot(session, {
    position: { x: 1, y: 2, z: 3 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    wheelPoses: { fl: {}, fr: {}, rl: {}, rr: {} },
    suspensionPose: { fl: 0.1, fr: 0.1, rl: 0.2, rr: 0.2 },
    speedMps: 20,
    engineRpm: 4000,
    eventSequence: 11,
    visualState: 2
  });
  assert.equal(session.worldX, 1);
  assert.equal(session.vehicle3d.authoritativeSource, 'VehicleDynamicsWorker');
  assert.equal(session.vehicleDynamicsRunner, undefined);
  assert.equal(session.vehicleDynamicsEventSequence, 11);
});

test('rolled worker snapshots update body, wheel, and debug state atomically', () => {
  const half = Math.SQRT1_2;
  const dormantRunnerState = {
    position: { x: 99, y: 99, z: 99 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }
  };
  const wheel = {
    position: { x: 1.4, y: 2, z: 3.8 },
    orientation: { x: 0, y: 0, z: half, w: half },
    contactPoint: { x: 1.1, y: 2, z: 3.8 },
    normal: { x: 1, y: 0, z: 0 },
    suspensionMount: { x: 1.8, y: 2, z: 3.8 },
    suspensionAxis: { x: -1, y: 0, z: 0 },
    normalLoadN: 2800,
    gripCoefficient: 0.9,
    steeringAngleRad: 0.1,
    lateralForceN: 600,
    selfAligningMomentNm: -18,
    validTreadContact: true,
    geometricContact: true,
    normalLoadKnown: true,
    inContact: true
  };
  const session = { vehicleDynamicsRunner: { state: dormantRunnerState } };
  applyRaceVehicleRenderSnapshot(session, {
    position: { x: 1, y: 2, z: 3 },
    orientation: { x: 0, y: 0, z: half, w: half },
    velocity: { x: 4, y: -2, z: 1 },
    angularVelocity: { x: 0.2, y: 0.3, z: 0.4 },
    wheelPoses: { fl: wheel, fr: wheel, rl: wheel, rr: wheel },
    suspensionPose: { fl: 0.2, fr: 0.2, rl: 0.3, rr: 0.3 },
    wheelAngularVelocity: { fl: 4, fr: 4, rl: 5, rr: 5 },
    tireTemperature: { fl: 91, fr: 92, rl: 93, rr: 94 },
    speedMps: 4.5,
    groundSpeedMps: 4.1,
    bodyLongitudinalSpeedMps: 1,
    bodyLateralSpeedMps: 4,
    signedTravelSpeedMps: 4.1,
    engineRpm: 3200,
    gear: 2,
    eventSequence: 12,
    visualState: 1
  });
  assert.equal(Math.abs(session.rollRad - Math.PI / 2) < 1e-12, true);
  assert.deepEqual(session.vehicle3d.wheels.fl.position, wheel.position);
  assert.deepEqual(
    session.vehicleDynamicsPresentationState.contactPatches.fl.hubPositionWorld,
    wheel.position
  );
  assert.equal(session.vehicleDynamicsPresentationState.wheelLoadsN.fl, 2800);
  assert.equal(session.gear, 2);
  assert.deepEqual(dormantRunnerState.position, { x: 99, y: 99, z: 99 });
});

test('worker hill handoff keeps canonical body-local presentation continuous through driving incidents', () => {
  const scenarios = [
    { name: 'straight', euler: { yaw: 0.1 }, steering: 0, compression: 0.08 },
    { name: 'steering', euler: { yaw: 0.4 }, steering: 0.35, compression: 0.09 },
    { name: 'compression', euler: { pitch: -0.08 }, steering: 0.1, compression: 0.18 },
    { name: 'hill-transition', euler: { pitch: 0.31, roll: -0.12 }, steering: 0.08, compression: 0.13 },
    { name: 'jump', euler: { pitch: 0.2 }, steering: 0.05, compression: 0.01 },
    { name: 'rollover', euler: { yaw: 0.5, roll: 2.4 }, steering: -0.2, compression: 0.04 },
    { name: 'collision-correction', euler: { yaw: 0.7, roll: 0.15 }, steering: 0.2, compression: 0.14 },
    { name: 'local-ccd-rollback', euler: { yaw: 0.65, pitch: -0.12 }, steering: 0.18, compression: 0.11 },
    { name: 'recovery', euler: { yaw: 1.1 }, steering: 0, compression: 0.1 }
  ];
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    const orientation = quaternionFromEuler(scenario.euler);
    const position = { x: scenarioIndex * 3, y: 1 + scenarioIndex * 0.03, z: 20 };
    const contactPatches = {};
    const suspensionState = {};
    for (const [wheelIndex, wheelId] of ['fl', 'fr', 'rl', 'rr'].entries()) {
      const local = {
        x: wheelId[1] === 'l' ? -0.78 : 0.78,
        y: -0.3 - scenario.compression,
        z: wheelId[0] === 'f' ? 1.3 : -1.3
      };
      const rotated = rotateVectorByQuaternion(local, orientation);
      const hub = { x: position.x + rotated.x, y: position.y + rotated.y, z: position.z + rotated.z };
      contactPatches[wheelId] = {
        hubPositionWorld: hub,
        contactPointWorld: { ...hub, y: hub.y - 0.33 },
        surfaceNormalWorld: { x: 0, y: 1, z: 0 },
        suspensionMountPositionWorld: { ...hub, y: hub.y + 0.4 },
        suspensionAxisWorld: rotateVectorByQuaternion({ x: 0, y: -1, z: 0 }, orientation),
        normalLoadN: scenario.name === 'jump' ? 0 : 3000 + wheelIndex,
        normalLoadKnown: true,
        validTreadContact: scenario.name !== 'jump',
        geometricContact: scenario.name !== 'jump',
        steeringAngleRad: wheelId[0] === 'f' ? scenario.steering : 0
      };
      suspensionState[wheelId] = { compressionM: scenario.compression };
    }
    const runner = {
      stepIndex: 120 + scenarioIndex,
      simulationTimeSeconds: 1 + scenarioIndex / 120,
      renderWheelSpinAngles: { fl: 6.2, fr: 6.2, rl: 6.2, rr: 6.2 },
      config: { wheelbaseM: 2.6, frontTrackWidthM: 1.56, rearTrackWidthM: 1.56 },
      state: {
        position, orientation, velocity: { x: 4, y: 0, z: 20 },
        angularVelocityWorld: { x: 0.2, y: 0.5, z: scenario.name === 'rollover' ? 2 : 0.1 },
        contactPatches, suspensionState,
        suspensionTravel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id) => [id, scenario.compression])),
        wheelAngularVelocityRadps: { fl: 30, fr: 30, rl: 30, rr: 30 },
        tireState: {}, grounded: scenario.name !== 'jump'
      }
    };
    const inline = createVehicleRenderStateFromRunner(runner, { visualState: runner.state.grounded ? 1 : 0 });
    const worker = readVehicleRenderSnapshot(writeVehicleRenderSnapshot(
      createVehicleRenderSnapshotBuffer(), inline
    ));
    assert.deepEqual(Object.keys(worker.wheels.fl).sort(), Object.keys(worker.wheels.fr).sort());
    const dot = Math.abs(inline.orientation.x * worker.orientation.x
      + inline.orientation.y * worker.orientation.y + inline.orientation.z * worker.orientation.z
      + inline.orientation.w * worker.orientation.w);
    assert.equal(2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI < 0.5, true, scenario.name);
    for (const wheelId of ['fl', 'fr', 'rl', 'rr']) {
      const before = inline.wheelPoses[wheelId].position;
      const after = worker.wheelPoses[wheelId].position;
      assert.equal(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) < 0.01, true, `${scenario.name}:${wheelId}`);
      assert.equal(Math.abs(worker.wheels[wheelId].hubPositionBody.x) < 1.2, true);
    }
    const stalled100 = interpolateVehicleRenderSnapshots(inline, worker, worker.simulationTimeSeconds + 0.1);
    const stalled250 = interpolateVehicleRenderSnapshots(inline, worker, worker.simulationTimeSeconds + 0.25);
    assert.equal(stalled100.extrapolationDurationSeconds <= 0.033, true);
    assert.equal(stalled250.extrapolationDurationSeconds <= 0.033, true);
    assert.equal(stalled100.wheels.fl.spinAngleRad > worker.wheels.fl.spinAngleRad, true);
  }
});

test('worker reset immediately moves body and all wheels as one rigid presentation', () => {
  const previousOrientation = quaternionFromEuler({ yaw: 0.2, roll: 0.4 });
  const nextOrientation = quaternionFromEuler({ yaw: 1.1, pitch: -0.2, roll: -0.1 });
  const wheelIds = ['fl', 'fr', 'rl', 'rr'];
  const localByWheel = {
    fl: { x: -0.8, y: -0.3, z: 1.3 }, fr: { x: 0.8, y: -0.3, z: 1.3 },
    rl: { x: -0.8, y: -0.3, z: -1.3 }, rr: { x: 0.8, y: -0.3, z: -1.3 }
  };
  const session = {
    vehicleRenderState: {
      resetGeneration: 3,
      position: { x: 1, y: 2, z: 3 }, orientation: previousOrientation,
      velocity: {}, angularVelocity: {}, visualState: 1,
      wheels: Object.fromEntries(wheelIds.map((wheelId) => [wheelId, {
        hubPositionBody: localByWheel[wheelId],
        suspensionMountBody: { ...localByWheel[wheelId], y: 0.1 },
        suspensionAxisBody: { x: 0, y: -1, z: 0 },
        suspensionCompressionM: 0.1, spinAngleRad: 0,
        contactPointWorld: {}, surfaceNormalWorld: { x: 0, y: 1, z: 0 }
      }]))
    },
    vehicle3d: {
      enabled: true,
      authoritativeSource: 'VehicleDynamicsWorker'
    }
  };
  const provisional = applyRaceVehicleProvisionalResetPresentation(session, {
    position: { x: 20, y: 5, z: -10 },
    orientation: nextOrientation
  }, 4);
  assert.equal(provisional.resetGeneration, 4);
  assert.equal(session.vehicleRenderState, provisional);
  assert.equal(session.vehicleDynamicsPresentationState.resetGeneration, 4);
  assert.deepEqual(Object.keys(session.vehicle3d.wheels).sort(), wheelIds);
  for (const wheelId of wheelIds) {
    const wheel = session.vehicle3d.wheels[wheelId];
    const afterOffset = rotateVectorToBody({
      x: wheel.position.x - session.vehicle3d.position.x,
      y: wheel.position.y - session.vehicle3d.position.y,
      z: wheel.position.z - session.vehicle3d.position.z
    }, nextOrientation);
    assert.ok(Math.hypot(
      afterOffset.x - localByWheel[wheelId].x,
      afterOffset.y - localByWheel[wheelId].y,
      afterOffset.z - localByWheel[wheelId].z
    ) < 1e-9);
    assert.equal(wheel.resetGeneration, 4);
    assert.equal(wheel.inContact, false);
  }
});

test('AI active state is synchronized without stepping it on the render thread', () => {
  const worker = new FakeWorker();
  let now = 0;
  const bridge = new RaceVehicleDynamicsWorkerBridge({
    worker,
    qualification: {
      achievedStepsPerSecond: 140,
      p95StepMs: 7,
      backlogStart: 0,
      backlogEnd: 0
    },
    now: () => ++now
  });
  bridge.updateAiVehicle({ vehicleId: 'ai-1', controls: {}, ai: {}, active: false });
  bridge.updateAiVehicle({ vehicleId: 'ai-1', controls: {}, ai: {}, active: false });
  bridge.updateAiVehicle({ vehicleId: 'ai-1', controls: {}, ai: {}, active: true });
  assert.deepEqual(worker.messages.filter(({ message }) => (
    message.type === 'setVehicleActive'
  )).map(({ message }) => message.active), [false, true]);
  assert.equal(worker.messages.filter(({ message }) => message.type === 'input').length, 1);
});

test('render thread transfers mutable physics environment as a compact buffer', () => {
  const worker = new FakeWorker();
  const bridge = new RaceVehicleDynamicsWorkerBridge({
    worker,
    qualification: {
      achievedStepsPerSecond: 140,
      p95StepMs: 7,
      backlogStart: 0,
      backlogEnd: 0
    },
    now: () => 1
  });
  bridge.update({
    controls: {},
    session: {},
    environmentUpdate: {
      weatherState: { id: 'rain', effectiveIntensity: 0.5 },
      weatherForcing: { precipitationRateMmPerS: 0.25 },
      damage: {}
    }
  });
  const update = worker.messages.find(({ message }) => message.type === 'environmentUpdate');
  assert.ok(update);
  assert.deepEqual(update.transferables, [update.message.buffer]);
  assert.equal(update.message.buffer.byteLength > 0, true, 'fake transfer does not detach automatically');
});
