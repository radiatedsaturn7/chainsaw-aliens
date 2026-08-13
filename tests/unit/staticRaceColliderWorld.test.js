import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PreparedStaticRaceColliderWorld,
  StaticColliderCollision,
  prepareStaticRaceColliders
} from '../../src/racing/simulation/StaticRaceColliderWorld.js';

const CONFIG = Object.freeze({
  massKg: 1500,
  inertiaTensorBodyKgM2: {
    xx: 600, xy: 0, xz: 0,
    yy: 1900, yz: 0,
    zz: 2100
  },
  bodyCollisionFriction: 0.62,
  bodyCollisionRestitutionThresholdMps: 2,
  bodyCollisionSolverIterations: 6,
  bodyCollisionToleranceM: 0.008
});
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

function pointSolver() {
  return new StaticColliderCollision({
    candidates: [{
      id: 'body-point',
      pieceId: 'body',
      localPoint: { x: 0, y: 0, z: 0 }
    }]
  });
}

function sweepPoint(world, {
  previous = { x: 0, y: 0, z: -1 },
  proposed = { x: 0, y: 0, z: 1 },
  velocity = { x: 0, y: 0, z: 134.112 }
} = {}) {
  const workingState = {
    position: { ...proposed },
    orientation: { ...IDENTITY },
    velocity: { ...velocity },
    angularVelocityWorld: { x: 0, y: 0, z: 0 }
  };
  const result = pointSolver().step({
    workingState,
    previousWorkingState: {
      position: { ...previous },
      orientation: { ...IDENTITY },
      velocity: { ...velocity },
      angularVelocityWorld: { x: 0, y: 0, z: 0 }
    },
    config: CONFIG,
    environment: { staticColliderWorld: world },
    dt: 1 / 120
  });
  return { result, workingState };
}

test('prepared static collider world supports plane, box, convex hull, and triangle mesh', () => {
  const world = prepareStaticRaceColliders([
    { id: 'plane', type: 'plane', point: { y: 0 }, normal: { x: 0, y: 1, z: 0 } },
    { id: 'box', type: 'box', center: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 2 } },
    {
      id: 'convex',
      type: 'convex-hull',
      position: { x: 8, y: 0, z: 0 },
      vertices: [
        { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
        { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
        { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
        { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }
      ]
    },
    {
      id: 'mesh',
      type: 'prepared-triangle-mesh',
      triangles: [{
        id: 'mesh-face',
        vertices: [
          { x: 20, y: -2, z: 0 },
          { x: 24, y: 2, z: 0 },
          { x: 24, y: -2, z: 0 }
        ]
      }]
    }
  ], { revision: 'shape-coverage', bucketSizeM: 4 });

  assert.equal(world instanceof PreparedStaticRaceColliderWorld, true);
  assert.deepEqual(world.colliders.map(({ type }) => type), [
    'plane', 'box', 'convex', 'prepared-triangle-mesh'
  ]);
  assert.equal(world.colliders[1].triangles.length, 12);
  assert.equal(world.colliders[2].triangles.length >= 12, true);
  assert.equal(world.colliders[3].triangles.length, 1);
  assert.deepEqual(world.querySweptAabb({
    minX: -2, minY: -2, minZ: -2,
    maxX: 2, maxY: 2, maxZ: 2
  }).map(({ id }) => id), ['plane', 'box']);
});
test('134.112 m/s point sweep resolves a finite 5 cm box at physical TOI', () => {
  const world = prepareStaticRaceColliders([{
    id: 'thin-wall',
    type: 'box',
    center: { x: 0, y: 0, z: 0.025 },
    size: { x: 10, y: 10, z: 0.05 },
    restitution: 0,
    friction: 0
  }]);
  const { result, workingState } = sweepPoint(world);

  assert.equal(result.swept, true);
  assert.equal(result.sweepSource, 'static-collider');
  assert.equal(result.timeOfImpactFraction > 0 && result.timeOfImpactFraction < 1, true);
  assert.equal(result.contacts[0].colliderId, 'thin-wall');
  assert.equal(workingState.position.z <= 0.009, true);
  assert.equal(workingState.velocity.z <= 1e-9, true);
  assert.equal(result.residualPenetrationM <= CONFIG.bodyCollisionToleranceM + 1e-6, true);
});

test('plane and prepared mesh sweeps are deterministic and do not require queued contact', () => {
  const definitions = [{
    id: 'mesh-wall',
    type: 'prepared-triangle-mesh',
    twoSided: true,
    triangles: [
      { vertices: [{ x: -4, y: -4, z: 0 }, { x: 4, y: 4, z: 0 }, { x: 4, y: -4, z: 0 }] },
      { vertices: [{ x: -4, y: -4, z: 0 }, { x: -4, y: 4, z: 0 }, { x: 4, y: 4, z: 0 }] }
    ]
  }];
  const first = sweepPoint(prepareStaticRaceColliders(definitions, { revision: 1 }));
  const second = sweepPoint(prepareStaticRaceColliders(definitions, { revision: 1 }));

  assert.deepEqual(first.result, second.result);
  assert.deepEqual(first.workingState, second.workingState);
  assert.equal(first.result.contacts.every((contact) => contact.contactType === 'static-body'), true);
});
