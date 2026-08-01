import assert from 'node:assert/strict';
import test from 'node:test';
import { AeroModel, calculateRelativeAirflow, getAirDensityAtElevation } from '../../src/racing/simulation/AeroModel.js';
import { createWakeSources, sampleWakeAtVehicle } from '../../src/racing/simulation/WakeModel.js';
import { VehicleDynamicsRunner, createVehicleDynamicsConfig, createVehicleDynamicsState } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { getRaceAiAeroAwareness } from '../../src/racing/RaceAiSimulation.js';
import { createDeterministicAtmosphere } from '../../src/racing/simulation/AeroEnvironment.js';

const model = new AeroModel();
const stateAt = ({ speed = 40, y = 0, pitch = 0, roll = 0, travel = 0.5 } = {}) => createVehicleDynamicsState({
  position: { x: 0, y, z: 0 },
  velocity: { x: 0, y: 0, z: speed },
  speedMps: speed,
  pitchRad: pitch,
  rollRad: roll,
  suspensionTravel: { fl: travel, fr: travel, rl: travel, rr: travel }
});
const configWith = (overrides = {}) => createVehicleDynamicsConfig({
  dragCoefficient: 0.34,
  frontalAreaM2: 2.2,
  frontDownforceCoefficient: 0.32,
  rearDownforceCoefficient: 0.4,
  frontRideHeightM: 0.17,
  rearRideHeightM: 0.18,
  ...overrides
});

test('drag coefficient controls coast-down force and elevation controls air density', () => {
  const state = stateAt();
  const lowDrag = model.calculateForces({ state, config: configWith({ dragCoefficient: 0.2 }) });
  const highDrag = model.calculateForces({ state, config: configWith({ dragCoefficient: 0.55 }) });
  assert.ok(highDrag.dragForceN > lowDrag.dragForceN * 2);
  assert.ok(getAirDensityAtElevation(3000) < getAirDensityAtElevation(0));
});

test('authoritative coast-down loses more speed with a larger drag coefficient', () => {
  const coast = (dragCoefficient) => {
    const runner = new VehicleDynamicsRunner({
      config: configWith({ chassisHz: 120, tireHz: 120, dragCoefficient }),
      initialState: { position: { y: 10 }, velocity: { z: 42 }, speedMps: 42, grounded: false },
      inputTimeline: [{ timeSeconds: 0, input: { clutch: 1, requestedGear: 0 } }],
      environmentProvider: () => ({ grounded: false })
    });
    for (let index = 0; index < 120; index += 1) runner.advance(1 / 120);
    return runner.state.speedMps;
  };
  assert.ok(coast(0.55) < coast(0.2));
});

test('headwind, tailwind, and crosswind use relative airflow and create stable side force', () => {
  const state = stateAt({ speed: 30 });
  const headwind = model.calculateForces({ state, config: configWith(), environment: {
    windWorldMps: { x: 0, y: 0, z: -12 }
  } });
  const tailwind = model.calculateForces({ state, config: configWith(), environment: {
    windWorldMps: { x: 0, y: 0, z: 12 }
  } });
  const crosswind = model.calculateForces({ state, config: configWith(), environment: {
    windWorldMps: { x: 14, y: 0, z: 0 }
  } });
  assert.ok(headwind.airflow.speedMps > tailwind.airflow.speedMps);
  assert.ok(headwind.dragForceN > tailwind.dragForceN);
  assert.ok(Math.abs(crosswind.totalForceWorldN.x) > 1);
  assert.ok(Number.isFinite(crosswind.totalMomentWorldNm.y));
  assert.deepEqual(crosswind, model.calculateForces({ state, config: configWith(), environment: {
    windWorldMps: { x: 14, y: 0, z: 0 }
  } }));
});

test('ride height, rake, floor stall, attitude, active aero, and data maps change balance', () => {
  const map = { samples: [
    { activeAeroState: 0, dragCoefficient: 0.34, frontLiftCoefficient: -0.3, rearLiftCoefficient: -0.38 },
    { activeAeroState: 1, dragCoefficient: 0.42, frontLiftCoefficient: -0.52, rearLiftCoefficient: -0.62 }
  ] };
  const config = configWith({ aeroMap: map, floorStallHeightM: 0.08, groundEffectGain: 0.5 });
  const normal = model.calculateForces({ state: stateAt({ travel: 0.25 }), config,
    environment: { activeAeroState: 0 } });
  const active = model.calculateForces({ state: stateAt({ travel: 0.25, pitch: 0.04, roll: 0.08 }), config,
    environment: { activeAeroState: 1 } });
  const stalled = model.calculateForces({ state: stateAt({ travel: 1 }), config,
    environment: { activeAeroState: 1 } });
  assert.ok(active.dragCoefficient > normal.dragCoefficient);
  assert.notEqual(active.frontDownforceN / active.rearDownforceN,
    normal.frontDownforceN / normal.rearDownforceN);
  assert.ok(stalled.floorStall > 0);
  assert.ok(stalled.frontDownforceN < active.frontDownforceN);
  assert.notEqual(normal.rakeRad, 0);
});

test('drafting, dirty air, crosswind wake movement, and overlapping wakes share one bounded model', () => {
  const sources = createWakeSources([
    { id: 'lead-a', position: { x: -1.2, y: 0, z: 25 }, yawRad: 0, speedMps: 45, widthM: 1.9 },
    { id: 'lead-b', position: { x: 1.2, y: 0, z: 30 }, yawRad: 0, speedMps: 42, widthM: 1.9 }
  ]);
  const one = sampleWakeAtVehicle({ vehicle: { id: 'follower', position: { x: 0, y: 0, z: 0 } },
    sources: sources.slice(0, 1), stepIndex: 8 });
  const overlap = sampleWakeAtVehicle({ vehicle: { id: 'follower', position: { x: 0, y: 0, z: 0 } },
    sources, stepIndex: 8 });
  const crosswind = sampleWakeAtVehicle({ vehicle: { id: 'follower', position: { x: 0, y: 0, z: 0 } },
    sources, windWorldMps: { x: 12, y: 0, z: 0 }, stepIndex: 8 });
  const far = sampleWakeAtVehicle({ vehicle: { id: 'follower', position: { x: 0, y: 0, z: -70 } },
    sources, stepIndex: 8 });
  assert.ok(one.dragReduction > 0);
  assert.ok(one.frontDownforceLoss > 0);
  assert.ok(overlap.intensity > one.intensity);
  assert.ok(far.intensity < overlap.intensity);
  assert.ok(overlap.intensity <= 1 && overlap.frontDownforceLoss <= 0.68);
  assert.notEqual(crosswind.contributions[0].wakeShiftM, overlap.contributions[0].wakeShiftM);
  const clean = model.calculateForces({ state: stateAt(), config: configWith() });
  const dirty = model.calculateForces({ state: stateAt(), config: configWith(), environment: { wakeState: overlap } });
  assert.ok(dirty.dragForceN < clean.dragForceN);
  assert.ok(dirty.frontDownforceN < clean.frontDownforceN);
});

test('front and rear damage independently move aerodynamic balance', () => {
  const state = stateAt();
  const clean = model.calculateForces({ state, config: configWith() });
  const frontDamage = model.calculateForces({ state, config: configWith(), environment: { frontAeroDamage: 0.8 } });
  const rearDamage = model.calculateForces({ state, config: configWith(), environment: { rearAeroDamage: 0.8 } });
  assert.ok(frontDamage.frontDownforceN < clean.frontDownforceN * 0.6);
  assert.equal(frontDamage.rearDownforceN, clean.rearDownforceN);
  assert.ok(rearDamage.rearDownforceN < clean.rearDownforceN * 0.6);
  assert.equal(rearDamage.frontDownforceN, clean.frontDownforceN);
});

test('relative airflow reports vehicle yaw to air and gust vectors', () => {
  const airflow = calculateRelativeAirflow({ state: stateAt({ speed: 25 }),
    windWorldMps: { x: 8, z: 0 }, gustWorldMps: { x: 2, z: -3 } });
  assert.ok(airflow.speedMps > 25);
  assert.ok(airflow.yawRad < 0);
  assert.deepEqual(airflow.airVelocityWorldMps, { x: 10, y: 0, z: -3 });
});

test('zero-intensity clear weather is calm unless wind is explicitly authored', () => {
  const calm = createDeterministicAtmosphere({
    weatherState: { id: 'clear', effectiveIntensity: 0 },
    race: {},
    timeSeconds: 4
  });
  const authored = createDeterministicAtmosphere({
    weatherState: { id: 'clear', effectiveIntensity: 0 },
    race: { windSpeedMps: 9, windDirectionDeg: 90 },
    timeSeconds: 4
  });
  assert.deepEqual(calm.windWorldMps, { x: 0, y: 0, z: 0 });
  assert.deepEqual(calm.gustWorldMps, { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(authored.windWorldMps.x - 9) < 0.000001);
});

test('AI distinguishes straight-line drafting from dirty-air cornering and braking risk', () => {
  const wake = { intensity: 0.8, dragReduction: 0.34, frontDownforceLoss: 0.55, crosswindRisk: 0.4 };
  const straight = getRaceAiAeroAwareness(wake, { severity: 0.02, speedMps: 45, index: 0 });
  const corner = getRaceAiAeroAwareness(wake, { severity: 0.7, speedMps: 45, index: 1 });
  assert.ok(straight.draftOpportunity > corner.draftOpportunity);
  assert.ok(corner.dirtyAirCornerPenalty > straight.dirtyAirCornerPenalty);
  assert.ok(corner.dirtyAirBrakingPenalty > 0);
  assert.equal(straight.overtakeOffset, 0.18);
  assert.equal(corner.overtakeOffset, -0.18);
  assert.equal(corner.crosswindRisk, 0.4);
});

test('wind and overlapping wakes remain exact across rendering frame partitions', () => {
  const run = (fps) => {
    const runner = new VehicleDynamicsRunner({
      config: configWith({ chassisHz: 120, tireHz: 120 }),
      initialState: { position: { y: 4 }, velocity: { z: 38 }, speedMps: 38, grounded: false },
      inputTimeline: [{ timeSeconds: 0, input: { clutch: 1, requestedGear: 0 } }],
      environmentProvider: () => ({
        grounded: false,
        vehicleId: 'follower',
        windWorldMps: { x: 6, y: 0, z: -4 },
        gustWorldMps: { x: -1.5, y: 0, z: 0.7 },
        wakeSources: createWakeSources([
          { id: 'lead-a', position: { x: -0.7, y: 4, z: 24 }, speedMps: 40 },
          { id: 'lead-b', position: { x: 0.9, y: 4, z: 29 }, speedMps: 42 }
        ])
      })
    });
    for (let frame = 0; frame < fps * 2; frame += 1) runner.advance(1 / fps);
    return runner.createStateSnapshot();
  };
  const reference = run(120);
  for (const fps of [30, 60, 90, 144]) assert.deepEqual(run(fps), reference, `${fps} FPS`);
});
