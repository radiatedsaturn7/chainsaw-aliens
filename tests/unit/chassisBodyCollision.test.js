import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChassisBodyCollision,
  createChassisBodyContactCandidates
} from '../../src/racing/simulation/ChassisBodyCollision.js';
import {
  addVector3,
  quaternionFromEuler,
  rotateVectorByQuaternion,
  scaleVector3
} from '../../src/racing/simulation/RigidBodyMath.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const DT = 1 / 360;
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
