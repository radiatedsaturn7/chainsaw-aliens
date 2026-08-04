import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChassisBodyCollision,
  createChassisBodyContactCandidates
} from '../../src/racing/simulation/ChassisBodyCollision.js';
import {
  addVector3,
  crossVector3,
  quaternionFromEuler,
  rotateVectorByQuaternion,
  scaleVector3
} from '../../src/racing/simulation/RigidBodyMath.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const DT = 1 / 360;
const dotVector3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const CONFIG = Object.freeze({
  massKg: 1450,
  bodyLengthM: 4.6,
  bodyWidthM: 1.84,
  bodyHeightM: 1.46,
  bodyGroundClearanceM: 0.12,
  cgHeightM: 0.55,
  pitchInertiaKgM2: 2100,
  yawInertiaKgM2: 2500,
  rollInertiaKgM2: 980,
  bodyCollisionToleranceM: 0.008,
  bodyCollisionRestitution: 0.06,
  bodyCollisionFriction: 0.65,
  bodyCollisionSolverIterations: 6
});

const terrain = ({ slopeX = 0, crest = false } = {}) => (point) => {
  const crestHeight = crest && Math.abs(point.x) < 0.45 && Math.abs(point.z) < 0.45 ? 0.32 : 0;
  const magnitude = Math.hypot(slopeX, 1);
  return {
    heightM: point.x * slopeX + crestHeight,
    normal: { x: -slopeX / magnitude, y: 1 / magnitude, z: 0 },
    friction: 0.62
  };
};

function createWorking({ heightM, pitch = 0, roll = 0, velocity = {}, angularVelocity = {} }) {
  return {
    position: { x: 0, y: heightM, z: 0 },
    orientation: quaternionFromEuler({ pitch, roll }),
    velocity: { x: 0, y: 0, z: 0, ...velocity },
    angularVelocityWorld: { x: 0, y: 0, z: 0, ...angularVelocity }
  };
}

function minimumClearance(working, sampleTerrain) {
  return Math.min(...createChassisBodyContactCandidates(CONFIG).map(({ localPoint }) => {
    const point = addVector3(
      working.position,
      rotateVectorByQuaternion(localPoint, working.orientation)
    );
    return point.y - sampleTerrain(point).heightM;
  }));
}

function simulate({ working, sampleTerrain = terrain(), steps = 360 }) {
  const collision = new ChassisBodyCollision(CONFIG);
  let maximumContacts = 0;
  for (let index = 0; index < steps; index += 1) {
    working.velocity.y -= 9.81 * DT;
    const result = collision.step({
      workingState: working,
      config: CONFIG,
      environment: { sampleTerrainAtWorldPoint: sampleTerrain },
      dt: DT
    });
    maximumContacts = Math.max(maximumContacts, result.contacts.length);
  }
  return { working, maximumContacts, clearance: minimumClearance(working, sampleTerrain) };
}

function emptyTireResult(overrides = {}) {
  return {
    worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
    wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
    wheelAngularVelocityRadps: {}, contactPatches: {}, suspensionState: {},
    grounded: false, groundHeightM: null,
    ...overrides
  };
}

test('body candidates cover the underbody, rockers, bumpers, roof, nose, and tail', () => {
  const ids = createChassisBodyContactCandidates(CONFIG).map(({ id }) => id);
  for (const required of [
    'underbody-fl', 'underbody-center', 'front-underside', 'rear-underside',
    'left-rocker-front', 'right-rocker-front', 'front-bumper-left', 'rear-bumper-right',
    'roof-fl', 'roof-center', 'nose', 'tail'
  ]) assert.equal(ids.includes(required), true, required);
});

for (const fixture of [
  { name: 'upright underbody contact', working: createWorking({ heightM: 0.5 }) },
  { name: 'car resting on its side', working: createWorking({ heightM: 0.9, roll: Math.PI / 2 }) },
  { name: 'fully inverted roof contact', working: createWorking({ heightM: 1.0, roll: Math.PI }) },
  { name: 'nose-first landing', working: createWorking({ heightM: 2.2, pitch: -1.05, velocity: { y: -8 } }) },
  { name: 'tail-first landing', working: createWorking({ heightM: 2.2, pitch: 1.05, velocity: { y: -8 } }) }
]) {
  test(`${fixture.name} resolves without an upright-only angle gate`, () => {
    const result = simulate({ working: fixture.working, steps: 720 });
    assert.equal(result.maximumContacts > 0, true);
    assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM * 2.5, true, result.clearance);
    assert.equal(Number.isFinite(result.working.orientation.w), true);
  });
}

test('a rollover across a side slope remains free to rotate', () => {
  const initialRoll = 0.7;
  const result = simulate({
    working: createWorking({
      heightM: 1.2,
      roll: initialRoll,
      velocity: { x: 5 },
      angularVelocity: { z: 2.4 }
    }),
    sampleTerrain: terrain({ slopeX: 0.22 }),
    steps: 420
  });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.working.position.x > 1, true);
  assert.equal(Math.abs(result.working.orientation.z) > 0.05, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM * 3, true);
});

test('a crest beneath the vehicle center contacts the underbody center', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.55 });
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain({ crest: true }) },
    dt: DT
  });
  assert.equal(result.contacts.some(({ id }) => id === 'underbody-center'), true);
});

test('a high-speed tunneling attempt is stopped within bounded penetration', () => {
  const result = simulate({
    working: createWorking({ heightM: 4, velocity: { y: -110 } }),
    steps: 90
  });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM * 3, true, result.clearance);
  assert.equal(result.working.velocity.y > -2, true);
});

test('an inverted car slides downhill on its roof without being teleported upright', () => {
  const start = createWorking({
    heightM: 1.05,
    roll: Math.PI,
    velocity: { x: -2 }
  });
  const initialOrientation = { ...start.orientation };
  const result = simulate({ working: start, sampleTerrain: terrain({ slopeX: 0.18 }), steps: 540 });
  assert.equal(result.maximumContacts > 0, true);
  assert.equal(result.working.position.x < -0.25, true);
  assert.equal(result.clearance >= -CONFIG.bodyCollisionToleranceM * 3, true);
  assert.equal(Math.abs(result.working.orientation.w - initialOrientation.w) < 0.65, true);
});

test('authoritative runner samples body terrain at every tire substep and commits once', () => {
  let terrainSamples = 0;
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      orientation: quaternionFromEuler({ roll: Math.PI }),
      grounded: false
    },
    tireContactSubsystem: {
      step() {
        return {
          worldForceN: {}, worldMomentNm: {}, suspensionForceWorldN: {},
          wheelLoadsN: {}, wheelSlip: {}, suspensionTravel: {}, tireForcesN: {},
          wheelAngularVelocityRadps: {}, contactPatches: {}, suspensionState: {},
          grounded: false, groundHeightM: null
        };
      }
    },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint(point) {
        terrainSamples += 1;
        return terrain()(point);
      }
    })
  });
  runner.advance(1 / 120);

  assert.equal(terrainSamples, createChassisBodyContactCandidates(CONFIG).length * 3);
  assert.equal(runner.telemetry[0].tireSubstepCount, 3);
  assert.equal(runner.telemetry[0].forces.bodyContacts.length > 0, true);
  assert.equal(runner.state.grounded, true);
});

test('penetration stabilization corrects position without manufacturing rebound velocity', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.4 });
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain() },
    dt: DT,
    advanceState: false
  });

  assert.equal(result.contacts.length > 0, true);
  assert.equal(result.penetrationBiasContributionNs, 0);
  assert.equal(result.contacts.every((contact) => contact.penetrationBiasImpulseNs === 0), true);
  assert.equal(working.velocity.y, 0);
  assert.equal(result.positionalCorrectionWorldM.y > 0, true);
});

test('physical closing velocity owns restitution while impact telemetry separates every contribution', () => {
  const collision = new ChassisBodyCollision(CONFIG);
  const working = createWorking({ heightM: 0.42, velocity: { y: -5 } });
  const preEnergyJ = 0.5 * CONFIG.massKg * working.velocity.y ** 2;
  const result = collision.step({
    workingState: working,
    config: CONFIG,
    environment: { sampleTerrainAtWorldPoint: terrain() },
    dt: DT,
    advanceState: false
  });
  const postEnergyJ = 0.5 * CONFIG.massKg * (
    working.velocity.x ** 2 + working.velocity.y ** 2 + working.velocity.z ** 2
  );

  assert.equal(result.bodyNormalImpulseNs > 0, true);
  assert.equal(result.restitutionContributionNs > 0, true);
  assert.equal(result.penetrationBiasContributionNs, 0);
  assert.equal(Number.isFinite(result.bodyFrictionImpulseNs), true);
  assert.equal(postEnergyJ <= preEnergyJ, true, `${postEnergyJ} <= ${preEnergyJ}`);
});

test('a single physical contact follows configured restitution independently of penetration depth', () => {
  const restitution = 0.18;
  const config = { ...CONFIG, bodyCollisionRestitution: restitution };
  const collision = new ChassisBodyCollision(config);
  const working = createWorking({ heightM: 0.42, velocity: { y: -5 } });
  const centerOnlyTerrain = (point) => Math.hypot(point.x, point.z) < 0.01
    ? { heightM: 0, normal: { x: 0, y: 1, z: 0 }, friction: 0 }
    : { heightM: Number.NaN, normal: { x: 0, y: 1, z: 0 }, friction: 0 };
  const result = collision.step({
    workingState: working,
    config,
    environment: { sampleTerrainAtWorldPoint: centerOnlyTerrain },
    dt: DT,
    advanceState: false
  });

  assert.equal(result.contacts.length, 1);
  const contact = result.contacts[0];
  const postPointVelocity = addVector3(
    working.velocity,
    crossVector3(working.angularVelocityWorld, contact.arm)
  );
  assert.ok(Math.abs(dotVector3(postPointVelocity, contact.normal) - 5 * restitution) < 1e-8);
  assert.equal(contact.penetrationBiasImpulseNs, 0);
});

test('suspension impulse advances the shared substep state before body contacts are solved', () => {
  let substep = 0;
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation' },
    initialState: {
      position: { x: 0, y: 0.442, z: 0 },
      velocity: { x: 0, y: -1, z: 0 },
      grounded: true
    },
    tireContactSubsystem: {
      step() {
        const supportForceN = substep++ === 0 ? CONFIG.massKg * 2 * 360 : 0;
        return emptyTireResult({
          suspensionForceWorldN: { y: supportForceN },
          wheelLoadsN: { fl: supportForceN / 4, fr: supportForceN / 4,
            rl: supportForceN / 4, rr: supportForceN / 4 },
          grounded: supportForceN > 0
        });
      }
    },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain()
    })
  });
  runner.advance(1 / 120);

  assert.equal(runner.telemetry[0].forces.bodyContacts.length, 0);
  assert.equal(runner.state.position.y > 0.442, true);
  assert.equal(runner.state.velocity.y > 0, true);
});

test('impact orientations and Studio Sprint 2 jump speeds are render-partition deterministic', () => {
  const fixtures = [
    { name: 'four-wheel flat', pitch: 0, roll: 0, speedMps: 0 },
    { name: 'front-wheel-first', pitch: -0.22, roll: 0, speedMps: 0 },
    { name: 'rear-wheel-first', pitch: 0.22, roll: 0, speedMps: 0 },
    { name: 'one-wheel', pitch: 0, roll: 0.24, speedMps: 0 },
    { name: 'nose strike', pitch: -1.05, roll: 0, speedMps: 12 },
    { name: 'sideways landing', pitch: 0, roll: Math.PI / 2, speedMps: 12 },
    ...[40, 60, 80].map((mph) => ({
      name: `Studio Sprint 2 jump ${mph} mph`, pitch: -0.08, roll: 0,
      speedMps: mph * 0.44704
    }))
  ];
  const run = (fixture, fps) => {
    const runner = new VehicleDynamicsRunner({
      config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation',
        telemetryRetention: 'latest' },
      initialState: {
        position: { x: 0, y: 0.72, z: 0 },
        orientation: quaternionFromEuler({ pitch: fixture.pitch, roll: fixture.roll }),
        velocity: { x: 0, y: -5, z: fixture.speedMps },
        grounded: false
      },
      tireContactSubsystem: { step: () => emptyTireResult() },
      environmentProvider: () => ({
        airDensityKgM3: 0,
        sampleTerrainAtWorldPoint: terrain()
      })
    });
    for (let frame = 0; frame < fps / 2; frame += 1) runner.advance(1 / fps);
    runner.drainCatchUp();
    return runner;
  };

  for (const fixture of fixtures) {
    const baseline = run(fixture, 30);
    assert.equal(baseline.impactHistory.length > 0, true, fixture.name);
    assert.equal(baseline.impactHistory[0].postImpactKineticEnergyJ
      <= baseline.impactHistory[0].preImpactKineticEnergyJ, true, fixture.name);
    assert.equal(baseline.impactHistory[0].penetrationBiasContributionNs, 0, fixture.name);
    const replay = VehicleDynamicsRunner.replay(baseline.createReplayRecord(), {
      tireContactSubsystem: { step: () => emptyTireResult() },
      environmentProvider: () => ({
        airDensityKgM3: 0,
        sampleTerrainAtWorldPoint: terrain()
      })
    });
    assert.deepEqual(replay.createStateSnapshot(), baseline.createStateSnapshot(),
      `${fixture.name} replay state`);
    assert.deepEqual(replay.impactHistory, baseline.impactHistory,
      `${fixture.name} replay impact telemetry`);
    for (const fps of [60, 90, 120, 144]) {
      const candidate = run(fixture, fps);
      assert.deepEqual(candidate.createStateSnapshot(), baseline.createStateSnapshot(),
        `${fixture.name} at ${fps} FPS`);
      assert.deepEqual(candidate.impactHistory, baseline.impactHistory,
        `${fixture.name} impact telemetry at ${fps} FPS`);
    }
  }
});

test('impact energy telemetry records descending rebound apexes', () => {
  const runner = new VehicleDynamicsRunner({
    config: { ...CONFIG, chassisHz: 120, tireHz: 360, handlingPreset: 'simulation',
      bodyCollisionRestitution: 0.24, bodyCollisionRestitutionThresholdMps: 0.05,
      bodyCollisionFriction: 0 },
    initialState: {
      position: { x: 0, y: 0.8, z: 0 },
      velocity: { x: 0, y: -5, z: 0 },
      grounded: false
    },
    tireContactSubsystem: { step: () => emptyTireResult() },
    environmentProvider: () => ({
      airDensityKgM3: 0,
      sampleTerrainAtWorldPoint: terrain()
    })
  });
  for (let step = 0; step < 480; step += 1) runner.advance(1 / 120);
  const impact = runner.impactHistory[0];

  assert.ok(impact);
  assert.equal(impact.penetrationBiasContributionNs, 0);
  assert.equal(Number.isFinite(impact.firstReboundApexM), true);
  assert.equal(Number.isFinite(impact.secondReboundApexM), true);
  assert.equal(impact.secondReboundApexM < impact.firstReboundApexM, true,
    `${impact.secondReboundApexM} < ${impact.firstReboundApexM}`);
});
