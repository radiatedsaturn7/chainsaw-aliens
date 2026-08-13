import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VEHICLE_RENDER_SNAPSHOT_BYTES,
  VEHICLE_CONTROL_INPUT_BYTES,
  VEHICLE_ENVIRONMENT_UPDATE_BYTES,
  VEHICLE_RESET_COMMAND_BYTES,
  createVehicleControlInputBuffer,
  createVehicleEnvironmentUpdateBuffer,
  createVehicleRenderSnapshotBuffer,
  createVehicleResetCommandBuffer,
  interpolateVehicleRenderSnapshots,
  readVehicleRenderSnapshot,
  readVehicleControlInput,
  readVehicleEnvironmentUpdate,
  readVehicleResetCommand,
  writeVehicleRenderSnapshot
} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
import { VehicleDynamicsWorkerMetrics } from '../../src/racing/simulation/VehicleDynamicsWorkerMetrics.js';

const wheels = Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id, index) => [id, {
  position: { x: index, y: index + 1, z: index + 2 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  contactPoint: { x: index, y: 0, z: index + 2 },
  normal: { x: 0, y: 1, z: 0 },
  suspensionMount: { x: index, y: index + 1.4, z: index + 2 },
  suspensionAxis: { x: 0, y: -1, z: 0 },
  normalLoadN: 3000 + index,
  gripCoefficient: 0.9,
  steeringAngleRad: index < 2 ? 0.1 : 0,
  lateralForceN: 400 + index,
  selfAligningMomentNm: -12 - index,
  flags: 15
}]));

function snapshot(overrides = {}) {
  return {
    stepIndex: 120,
    eventSequence: 9,
    visualState: 3,
    simulationTimeSeconds: 1,
    position: { x: 10, y: 2, z: 20 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 3, y: -1, z: 24 },
    angularVelocity: { x: 0.1, y: 0.2, z: 0.3 },
    wheelPoses: wheels,
    suspensionPose: { fl: 0.1, fr: 0.2, rl: 0.3, rr: 0.4 },
    tireTemperature: { fl: 90, fr: 91, rl: 92, rr: 93 },
    wheelAngularVelocity: { fl: 70, fr: 71, rl: 72, rr: 73 },
    speedMps: 25,
    groundSpeedMps: 24.2,
    bodyLongitudinalSpeedMps: 24,
    bodyLateralSpeedMps: 3,
    signedTravelSpeedMps: 24.2,
    engineRpm: 4200,
    gear: 4,
    ...overrides
  };
}

test('render snapshots use one compact transferable buffer without telemetry or geometry', () => {
  const buffer = createVehicleRenderSnapshotBuffer();
  assert.equal(buffer.byteLength, VEHICLE_RENDER_SNAPSHOT_BYTES);
  writeVehicleRenderSnapshot(buffer, snapshot());
  const decoded = readVehicleRenderSnapshot(buffer);
  assert.equal(decoded.stepIndex, 120);
  assert.equal(decoded.eventSequence, 9);
  assert.equal(decoded.position.z, 20);
  assert.equal(decoded.wheelPoses.rr.position.x, 3);
  assert.equal(decoded.wheelPoses.fl.normalLoadN, 3000);
  assert.equal(decoded.wheelPoses.fl.validTreadContact, true);
  assert.deepEqual(decoded.velocity, { x: 3, y: -1, z: 24 });
  assert.equal(decoded.tireTemperature.rr, 93);
  assert.equal(decoded.wheelAngularVelocity.rl, 72);
  assert.ok(Math.abs(decoded.groundSpeedMps - 24.2) < 1e-5);
  assert.equal(decoded.gear, 4);
  assert.equal(decoded.engineRpm, 4200);
  assert.equal('telemetry' in decoded, false);
  assert.equal('terrain' in decoded, false);
  const transferred = structuredClone(buffer, { transfer: [buffer] });
  assert.equal(buffer.byteLength, 0);
  assert.equal(transferred.byteLength, VEHICLE_RENDER_SNAPSHOT_BYTES);
});

test('mutable weather and damage use one compact transferable update buffer', () => {
  const buffer = createVehicleEnvironmentUpdateBuffer({
    weatherState: { id: 'storm', effectiveIntensity: 0.75 },
    race: { windSpeedMps: 18, windDirectionRad: 1.2, gustStrength: 0.4 },
    weatherForcing: {
      ambientTemperatureC: 13,
      precipitationRateMmPerS: 0.6,
      sunIntensity: 0.1,
      windIntensity: 0.9,
      windDirectionRad: 1.2,
      humidity: 0.96
    },
    damage: {
      engine: 12,
      transmission: 8,
      panels: { front: 30, rear: 10 },
      brakes: { fl: 2 },
      tires: { rr: 7 }
    }
  });
  assert.equal(buffer.byteLength, VEHICLE_ENVIRONMENT_UPDATE_BYTES);
  const decoded = readVehicleEnvironmentUpdate(buffer);
  assert.equal(decoded.weatherState.id, 'storm');
  assert.ok(Math.abs(decoded.weatherState.effectiveIntensity - 0.75) < 1e-6);
  assert.equal(decoded.raceAtmosphere.windSpeedMps, 18);
  assert.equal(decoded.damage.engine, 12);
  assert.ok(Math.abs(decoded.damage.frontAeroDamage - 0.3) < 1e-6);
  assert.equal(decoded.damage.brakes.fl, 2);
  assert.equal(decoded.damage.tires.rr, 7);
  assert.equal('terrain' in decoded, false);
  structuredClone(buffer, { transfer: [buffer] });
  assert.equal(buffer.byteLength, 0);
});

test('render thread submits controls as a compact transferable typed buffer', () => {
  const buffer = createVehicleControlInputBuffer({
    steering: -0.25,
    throttle: 0.8,
    brake: 0.1,
    handbrake: true,
    gear: 3,
    absEnabled: true,
    tractionControlEnabled: false,
    autoShift: true
  });
  assert.equal(buffer.byteLength, VEHICLE_CONTROL_INPUT_BYTES);
  const input = readVehicleControlInput(buffer);
  assert.equal(input.steering, -0.25);
  assert.ok(Math.abs(input.throttle - 0.8) < 1e-6);
  assert.equal(input.handbrake, 1);
  assert.equal(input.requestedGear, 3);
  assert.equal(input.absEnabled, true);
  assert.equal(input.tractionControlEnabled, false);
  assert.equal(input.autoShift, true);
});

test('authoritative reset uses one compact transferable pose buffer', () => {
  const buffer = createVehicleResetCommandBuffer({
    position: { x: 4, y: 1.2, z: 90 },
    orientation: { x: 0, y: 0.25, z: 0, w: 0.9682458 },
    routeDistance: 88,
    gear: 1,
    engineRpm: 900,
    grounded: true,
    parkUntilDrive: true
  });
  assert.equal(buffer.byteLength, VEHICLE_RESET_COMMAND_BYTES);
  const state = readVehicleResetCommand(buffer);
  assert.deepEqual(state.position, { x: 4, y: 1.2000000476837158, z: 90 });
  assert.equal(state.routeDistance, 88);
  assert.equal(state.gear, 1);
  assert.equal(state.parkUntilDrive, true);
  assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
  assert.equal('terrain' in state, false);
  structuredClone(buffer, { transfer: [buffer] });
  assert.equal(buffer.byteLength, 0);
});

test('authoritative reset park flag defaults to released', () => {
  const state = readVehicleResetCommand(createVehicleResetCommandBuffer({}));
  assert.equal(state.parkUntilDrive, false);
});

test('render interpolation uses only the two newest authoritative snapshots', () => {
  const previous = snapshot({ simulationTimeSeconds: 1, position: { x: 0, y: 0, z: 0 }, speedMps: 10 });
  const latest = snapshot({ simulationTimeSeconds: 2, position: { x: 10, y: 4, z: 2 }, speedMps: 20 });
  const rendered = interpolateVehicleRenderSnapshots(previous, latest, 1.25);
  assert.deepEqual(rendered.position, { x: 2.5, y: 1, z: 0.5 });
  assert.equal(rendered.speedMps, 12.5);
  assert.equal(rendered.interpolationAlpha, 0.25);
  assert.equal(rendered.eventSequence, latest.eventSequence);
});

test('worker and render latency percentiles remain independent', () => {
  const metrics = new VehicleDynamicsWorkerMetrics();
  [1, 2, 3, 100].forEach((value) => metrics.recordWorker(value, value === 100 ? 2 : 0));
  [4, 5, 6, 7].forEach((value) => metrics.recordRender(value));
  const summary = metrics.getSummary();
  assert.deepEqual(summary.worker, { samples: 4, p50: 2, p95: 100, p99: 100 });
  assert.deepEqual(summary.render, { samples: 4, p50: 5, p95: 7, p99: 7 });
  assert.deepEqual(summary.backlog, { current: 2, peak: 2 });
});
