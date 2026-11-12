import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleDynamicsRunner, createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { VehicleDynamicsWorkerAuthority } from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';
import { VehicleDynamicsWorkerClient } from '../../src/racing/simulation/VehicleDynamicsWorkerClient.js';
import { createRaceVehicleDynamicsWorkerInitialization, applyRaceVehicleRenderSnapshot } from '../../src/racing/simulation/RaceVehicleDynamicsWorkerBridge.js';
import { buildRaceBakedSurfaceSampler, packRaceBakedSurfaceSampler } from '../../src/racing/RaceBakedSurfaceSampler.js';
import { gaugeValue } from '../../src/racing/CarGauges.js';

class FakeWorker {
  constructor() { this.listeners = new Set(); this.messages = []; }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
  postMessage(message) { this.messages.push(message); }
  emit(data) { for (const listener of this.listeners) listener({ data }); }
}
const electricPowertrain = { peakTorqueNm: 700, peakPowerKw: 400, maxMotorRpm: 18000,
  reductionRatio: 10, usableBatteryKwh: 70, driveEfficiency: .9, regenEfficiency: .8,
  maxRegenTorqueNm: 100, maxRegenPowerKw: 50, standstillLossKw: 0,
  regenFullSpeedRadps: 5, liftOffRegen: .5 };
function runner() {
  const config = createVehicleDynamicsConfigFromTuning({ powertrainType: 'electric',
    electricPowertrain, drivetrain: 'awd', weightKg: 2100, wheelRadiusM: .34 }, { tireHz: 360 });
  return new VehicleDynamicsRunner({ config,
    initialState: { position: { x: 0, y: .65, z: 0 }, gear: 1,
      powertrainState: { gear: 1, electric: { batteryEnergyJ: 35 * 3.6e6 } } },
    environmentProvider: () => ({ surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 } }) });
}

test('worker initialization preserves authored EV config and partially depleted traction state', () => {
  const ev = runner();
  const sampler = packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({ mesh: { triangles: [
    { region: 'road', vertices: [{ x: -100, y: -100, elevation: 0 },
      { x: 100, y: -100, elevation: 0 }, { x: 0, y: 100, elevation: 0 }] }
  ] } }));
  const init = createRaceVehicleDynamicsWorkerInitialization({ runner: ev, surfaceSampler: sampler });
  const vehicle = structuredClone(init.payload.vehicles[0]);
  assert.equal(vehicle.config.powertrainTuning.powertrainType, 'electric');
  assert.deepEqual(vehicle.config.powertrainTuning.electricPowertrain, electricPowertrain);
  assert.equal(vehicle.initialState.powertrainState.electric.batteryEnergyJ, 35 * 3.6e6);
  const restored = new VehicleDynamicsRunner({ config: vehicle.config, initialState: vehicle.initialState });
  assert.equal(restored.state.powertrainState.electric.batteryEnergyJ, 35 * 3.6e6);
});

test('real worker-authority snapshots carry changing battery telemetry through client and dashboard', () => {
  const ev = runner(), worker = new FakeWorker(), messages = [];
  const client = new VehicleDynamicsWorkerClient({ worker,
    performanceQualification: { achievedStepsPerSecond: 140, p95StepMs: 7, backlogStart: 0, backlogEnd: 0 },
    now: () => 0 });
  const authority = new VehicleDynamicsWorkerAuthority({ runners: [{ id: 'player', player: true, runner: ev }],
    now: () => 0, postSnapshot: message => { messages.push(structuredClone(message)); worker.emit({ ...message, type: 'snapshot' }); } });
  authority.setInput('player', { throttle: .5, requestedGear: 1 }, { sequence: 1 });
  authority.tick(1000); authority.tick(1025);
  assert.ok(messages.length > 0);
  const first = messages.at(-1).tractionBattery;
  assert.ok(first.batteryEnergyJ < 35 * 3.6e6);
  assert.equal(first.batteryEnergyJ, ev.state.powertrainState.electric.batteryEnergyJ);
  assert.equal(first.stateOfCharge, first.batteryEnergyJ / (70 * 3.6e6));
  const firstEnergy = first.batteryEnergyJ;
  authority.tick(1050);
  assert.ok(messages.at(-1).tractionBattery.batteryEnergyJ < firstEnergy);
  // No mechanical.tick is required for this side-channel: EV charge evolves
  // every substep, independent of the ICE/accessory component ticker.
  const rendered = client.getInterpolatedSnapshot(ev.simulationTimeSeconds);
  assert.deepEqual(rendered.tractionBattery, messages.at(-1).tractionBattery);
  const session = {};
  applyRaceVehicleRenderSnapshot(session, rendered);
  assert.deepEqual(session.tractionBattery, rendered.tractionBattery);
  assert.ok(gaugeValue({ source: 'tractionBattery.percent' }, { session }) < 50);
  assert.ok(gaugeValue({ source: 'tractionBattery.percent' }, { session }) > 49);
  assert.equal(gaugeValue({ source: 'tractionBattery.kwh' }, { session }), session.tractionBattery.batteryEnergyJ / 3.6e6);
  assert.equal(gaugeValue({ source: 'tractionBattery.powerKw' }, { session }), session.tractionBattery.batteryPowerW / 1000);
});
