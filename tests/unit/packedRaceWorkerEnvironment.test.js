import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sampleRaceBakedSurface,
  buildRaceBakedSurfaceSampler,
  packRaceBakedSurfaceSampler
} from '../../src/racing/RaceBakedSurfaceSampler.js';
import { createPackedRaceWorkerEnvironmentProvider } from '../../src/racing/simulation/PackedRaceWorkerEnvironment.js';
import { VehicleDynamicsWorkerAuthority } from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

function createFlatPackedSurface() {
  return packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({
    mesh: {
      triangles: [
        { region: 'road', vertices: [
          { x: -100, y: -100, elevation: 0 },
          { x: 100, y: -100, elevation: 0 },
          { x: 100, y: 100, elevation: 0 }
        ] },
        { region: 'road', vertices: [
          { x: -100, y: -100, elevation: 0 },
          { x: 100, y: 100, elevation: 0 },
          { x: -100, y: 100, elevation: 0 }
        ] }
      ]
    },
    elevationScaleM: 12
  }));
}

function createPackedRunner(surfaceSampler) {
  const provider = createPackedRaceWorkerEnvironmentProvider({
    surfaceSampler,
    materialByRegion: { road: { grip: 1.05 }, default: { grip: 0.8 } }
  });
  let runner = null;
  runner = new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz: 120,
      geometryHz: 120,
      telemetryRetention: 'none',
      maxCatchUpSteps: 8
    },
    initialState: { heightM: 0.55, speedMps: 8 },
    environmentProvider: (request) => provider(request, runner.config)
  });
  runner.packedEnvironmentProvider = provider;
  return runner;
}

test('real worker runner queries packed terrain locally with no per-step geometry payload', () => {
  const provider = createPackedRaceWorkerEnvironmentProvider({
    surfaceSampler: createFlatPackedSurface(),
    materialByRegion: { road: { grip: 1.05 }, default: { grip: 0.8 } }
  });
  let runner = null;
  runner = new VehicleDynamicsRunner({
    config: {
      chassisHz: 120,
      tireHz: 120,
      geometryHz: 120,
      telemetryRetention: 'none',
      maxCatchUpSteps: 8
    },
    initialState: { heightM: 0.55 },
    environmentProvider: (request) => provider(request, runner.config)
  });
  const advance = runner.advance(1 / 60, { input: { throttle: 0.2 } });
  assert.equal(advance.completedSteps, 2);
  assert.equal(advance.backlogSteps, 0);
  assert.equal(runner.performanceDiagnostics.environmentQueries, 2);
  assert.equal(Number.isFinite(runner.state.position.x), true);
  assert.equal(Number.isFinite(runner.state.position.y), true);
  assert.equal(Number.isFinite(runner.state.position.z), true);
});

test('worker fixed-clock authority preserves exact packed-runner state and replay timeline', () => {
  const surface = createFlatPackedSurface();
  const directRunner = createPackedRunner(surface);
  const workerRunner = createPackedRunner(surface);
  const controls = {
    steering: 0.22,
    throttle: 0.48,
    brake: 0,
    clutch: 0,
    requestedGear: 2,
    assists: { stabilityControlEnabled: true, tractionControlEnabled: true }
  };
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [{ id: 'player', runner: workerRunner, player: true }],
    now: () => 0
  });
  authority.setInput('player', controls, { sequence: 1 });
  authority.tick(0);
  for (let frame = 1; frame <= 60; frame += 1) {
    directRunner.advance(1 / 60, { input: controls });
    authority.tick(frame * (1000 / 60));
  }
  assert.equal(workerRunner.stepIndex, 120);
  assert.equal(directRunner.stepIndex, 120);
  assert.deepEqual(workerRunner.createStateSnapshot(), directRunner.createStateSnapshot());
  assert.deepEqual(
    workerRunner.inputTimeline.createSnapshot(),
    directRunner.inputTimeline.createSnapshot()
  );
  assert.equal(workerRunner.diagnostics.backlogSteps, 0);
});

test('packed worker environment applies live atmosphere and damage without replacing geometry', () => {
  const surface = createFlatPackedSurface();
  const provider = createPackedRaceWorkerEnvironmentProvider({ surfaceSampler: surface });
  provider.updateEnvironmentState({
    weatherState: { id: 'storm', effectiveIntensity: 1 },
    raceAtmosphere: { weather: 'storm', windSpeedMps: 20, windDirectionRad: 0 },
    damage: {
      bodyDamage: 30,
      frontAeroDamage: 0.3,
      rearAeroDamage: 0.1,
      engine: 12,
      transmission: 8,
      brakes: { fl: 2 },
      tires: { rr: 7 }
    }
  });
  const environment = provider({
    state: { position: {}, orientation: { w: 1 }, suspensionState: {} },
    controls: {},
    reuseContactGeometry: true,
    timeSeconds: 2
  }, {});
  assert.equal(environment.windSpeedMps, 20);
  assert.equal(environment.bodyDamage, 30);
  assert.equal(environment.damage.engine, 12);
  assert.equal(environment.damage.brakes.fl, 2);
  assert.equal(environment.tireByWheel.rr.damage, 7);
  assert.equal(environment.sampleTerrainAtWorldPoint({ x: 0, y: 0, z: 0 }).valid, true);
});

test('mutable environment timeline remains exact across worker handoff', () => {
  const surface = createFlatPackedSurface();
  const directRunner = createPackedRunner(surface);
  const workerRunner = createPackedRunner(surface);
  const authority = new VehicleDynamicsWorkerAuthority({
    runners: [{
      id: 'player',
      runner: workerRunner,
      player: true,
      environmentController: workerRunner.packedEnvironmentProvider
    }],
    now: () => 0
  });
  const controls = { throttle: 0.4, steering: 0.1 };
  authority.setInput('player', controls, { sequence: 1 });
  authority.tick(0);
  for (let frame = 1; frame <= 60; frame += 1) {
    if (frame === 31) {
      const update = {
        weatherState: { id: 'storm', effectiveIntensity: 0.8 },
        raceAtmosphere: {
          weather: 'storm', weatherIntensity: 0.8,
          windSpeedMps: 16, windDirectionRad: 0.7, gustStrength: 0.35
        },
        damage: {
          bodyDamage: 20,
          frontAeroDamage: 0.2,
          rearAeroDamage: 0.1,
          engine: 5,
          transmission: 3,
          brakes: { fl: 1, fr: 2, rl: 0, rr: 0 },
          tires: { fl: 0, fr: 0, rl: 0, rr: 4 }
        }
      };
      directRunner.packedEnvironmentProvider.updateEnvironmentState(update);
      authority.updateEnvironmentState(update);
    }
    directRunner.packedEnvironmentProvider.setWakeSources([{
      id: 'player',
      position: { ...directRunner.state.position },
      yawRad: directRunner.state.yawRad,
      speedMps: Math.abs(directRunner.state.speedMps),
      widthM: directRunner.config.bodyWidthM,
      dragAreaM2: directRunner.config.dragCoefficient * directRunner.config.frontalAreaM2
    }], 'player');
    directRunner.advance(1 / 60, { input: controls });
    authority.tick(frame * (1000 / 60));
  }
  assert.deepEqual(workerRunner.createStateSnapshot(), directRunner.createStateSnapshot());
  assert.equal(workerRunner.stepIndex, 120);
  assert.equal(workerRunner.diagnostics.backlogSteps, 0);
});


test('worker terrain clips a hillside maximum to the car query instead of distant triangle corners', () => {
 const surfaceSampler = packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({
  mesh: {triangles: [{region: 'road', vertices: [
   {x: 0, y: 0, elevation: 0}, {x: 100, y: 0, elevation: 100},
   {x: 0, y: 100, elevation: 0}
  ]}]}, elevationScaleM: 1
 }));
 const provider = createPackedRaceWorkerEnvironmentProvider({surfaceSampler});
 const output = provider({reuseContactGeometry: true, state: {position: {x: 1, y: 1, z: 1}}});
 assert.equal(output.sampleTerrainMaximumHeightInBounds({minX: 1, maxX: 2, minZ: 1, maxZ: 2}), 2);
 const points = Array.from({length: 30}, (_, i) => ({x: 1 + i * .7, z: 1 + i * .4}));
 const samples = output.sampleTerrainAtWorldPoints(points);
 for(let i=0;i<points.length;i++) {
  const raw = sampleRaceBakedSurface(surfaceSampler, points[i]);
  assert.equal(samples[i].valid, true);
  assert.ok(Math.abs(samples[i].heightM - raw.elevation) < 1e-9);
  assert.deepEqual(samples[i].normal, raw.normal);
  assert.equal(samples[i].triangleId, raw.triangleId);
 }
});

test('worker terrain frame is reused within a chassis step and refreshed for recovery or the next step', () => {
 const provider = createPackedRaceWorkerEnvironmentProvider({surfaceSampler: createFlatPackedSurface()});
 const state = {position: {x: 0, y: .55, z: 0}, velocity: {x: 0, y: 0, z: 10}};
 const request = {state, stepIndex: 1, reuseContactGeometry: true};
 const frame = provider(request).physicsTerrainQueryFrame;
 const first = frame.sequence;
 provider(request);
 assert.equal(frame.sequence, first);
 provider({...request, stepIndex: 2});
 assert.equal(frame.sequence, first + 1);
 provider({...request, stepIndex: 2, forceFreshTerrainQueryFrame: true, reuseContactGeometry: false,
  state: {...state, position: {x: 50, y: .55, z: 50}}});
 assert.equal(frame.sequence, first + 2);
 assert.equal(frame.containsPoint({x: 50, z: 50}), true);
});
