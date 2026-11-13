import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleDynamicsRunner, createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const electricPowertrain = { peakTorqueNm: 700, peakPowerKw: 400, maxMotorRpm: 18000,
  reductionRatio: 10, usableBatteryKwh: 70, driveEfficiency: .9, regenEfficiency: .8,
  maxRegenTorqueNm: 100, maxRegenPowerKw: 50, standstillLossKw: 0,
  regenFullSpeedRadps: 5, liftOffRegen: .5 };
const ids = ['fl', 'fr', 'rl', 'rr'];
const environment = () => ({ airDensityKgM3: 0,
  surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
  sampleTerrainAtWorldPoint: () => ({ valid: true, heightM: 0,
    normal: { x: 0, y: 1, z: 0 }, surfaceId: 'asphalt', friction: 1, region: 'road' }),
  sampleTerrainMaximumHeightInBounds: () => 0 });
function fixture({ energy = 70 * 3.6e6, throttle = .5, speed = 0, tireHz = 360 } = {}) {
  const config = createVehicleDynamicsConfigFromTuning({ powertrainType: 'electric',
    electricPowertrain, drivetrain: 'awd', weightKg: 2100, wheelRadiusM: .34,
    wheelInertiaKgM2: 1.5 }, { chassisHz: 120, tireHz });
  return new VehicleDynamicsRunner({ config,
    initialState: { position: { x: 0, y: config.cgHeightM + .08, z: 0 }, gear: 1,
      speedMps: speed, velocity: { x: 0, y: 0, z: speed },
      powertrainState: { gear: 1, engineRpm: 0, electric: { batteryEnergyJ: energy } } },
    inputTimeline: [{ timeSeconds: 0, input: { throttle, requestedGear: 1,
      assists: { tractionControlEnabled: false, autoShift: true } } }],
    environmentProvider: environment });
}

test('actual EV runner substeps spend traction energy and retain one forward gear', () => {
  for (const tireHz of [120, 360]) {
    const runner = fixture({ tireHz });
    const start = runner.state.powertrainState.electric.batteryEnergyJ;
    for (let i = 0; i < 30; i++) runner.advance(1 / 120);
    assert.ok(runner.state.powertrainState.electric.batteryEnergyJ < start);
    assert.ok(runner.state.powertrainState.electric.batteryEnergyJ > 0);
    assert.equal(runner.state.gear, 1);
    assert.ok(Number.isFinite(runner.state.engineRpm));
    assert.ok(Object.values(runner.state.wheelAngularVelocityRadps).some(x => Math.abs(x) > 0));
  }
});

test('empty EV remains unpowered during real runner advances', () => {
  const runner = fixture({ energy: 0, throttle: 1 });
  for (let i = 0; i < 10; i++) runner.advance(1 / 120);
  assert.equal(runner.state.powertrainState.electric.batteryEnergyJ, 0);
  assert.equal(runner.state.powertrainState.telemetry.electric.driveMotorTorqueNm, 0);
  for (const id of ids) assert.equal(runner.state.powertrainState.telemetry.wheelDriveTorqueNm[id], 0);
});

test('EV replay after actual advances exactly reproduces battery and vehicle state', () => {
  const runner = fixture();
  for (let i = 0; i < 20; i++) runner.advance(1 / 120);
  const replay = VehicleDynamicsRunner.replay(JSON.parse(JSON.stringify(runner.createReplayRecord())), {
    environmentProvider: environment
  });
  assert.deepEqual(replay.state, runner.state);
  assert.equal(replay.state.powertrainState.electric.batteryEnergyJ, runner.state.powertrainState.electric.batteryEnergyJ);
});

test('actual gameplay reset preserves consumed traction energy and resets shaft RPM', () => {
  const runner = fixture({ energy: 12345 });
  for (let i = 0; i < 5; i++) runner.advance(1 / 120);
  const energy = runner.state.powertrainState.electric.batteryEnergyJ;
  runner.resetAuthoritativeState({ position: { x: 0, y: runner.config.cgHeightM + .08, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, gear: 1 }, { parkUntilDrive: true });
  assert.equal(runner.state.powertrainState.electric.batteryEnergyJ, energy);
  assert.equal(runner.state.engineRpm, 0);
});

test('one-joule pack cannot create excess wheel kinetic energy at zero-RPM launch', () => {
  const runner = fixture({ energy: 1, throttle: 1 });
  // Airborne wheel spin isolates motor work from tire/chassis energy exchange.
  runner.state.position.y = runner.initialState.position.y = 100;
  runner.state.grounded = runner.initialState.grounded = false;
  runner.advance(1 / 120);
  const wheelEnergyJ = ids.reduce((sum, id) => sum + .5 * runner.config.wheelInertiaKgM2
    * runner.state.wheelAngularVelocityRadps[id] ** 2, 0);
  const drainJ = 1 - runner.state.powertrainState.electric.batteryEnergyJ;
  assert.ok(drainJ > 0, 'launch must spend energy even with zero configured winding loss');
  assert.ok(wheelEnergyJ <= drainJ + 1e-7, `wheel energy ${wheelEnergyJ} exceeds battery spend ${drainJ}`);
});

test('JSON snapshot restoration continues EV battery integration deterministically', () => {
  const original = fixture();
  for (let i = 0; i < 12; i++) original.advance(1 / 120);
  const resumed = fixture();
  resumed.restoreSnapshot(JSON.parse(JSON.stringify(original.createSnapshot())));
  for (let i = 0; i < 12; i++) { original.advance(1 / 120); resumed.advance(1 / 120); }
  assert.deepEqual(resumed.state, original.state);
});

test('real rolling lift-off regen recovers bounded energy without exceeding pack capacity', () => {
  const initialEnergy = 70 * 3.6e6 - 1000;
  const runner = fixture({ energy: initialEnergy, throttle: 0, speed: 10 });
  const kineticJ = () => .5 * runner.config.massKg * (runner.state.velocity.x ** 2 + runner.state.velocity.z ** 2)
    + ids.reduce((sum, id) => sum + .5 * runner.config.wheelInertiaKgM2 * runner.state.wheelAngularVelocityRadps[id] ** 2, 0);
  const initialKineticJ = kineticJ();
  for (let i = 0; i < 60; i++) runner.advance(1 / 120);
  const recoveredJ = runner.state.powertrainState.electric.batteryEnergyJ - initialEnergy;
  assert.ok(recoveredJ > 0, 'rolling lift-off must exercise real runner recovery');
  assert.ok(recoveredJ <= 1000 + 1e-7);
  assert.ok(recoveredJ <= Math.max(0, initialKineticJ - kineticJ()) + 1e-5);
});
