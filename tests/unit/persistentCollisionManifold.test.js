import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PersistentManifoldHistory,
  reducePersistentContactManifold
} from '../../src/racing/simulation/PersistentContactManifold.js';
import {
  StaticColliderCollision,
  prepareStaticRaceColliders
} from '../../src/racing/simulation/StaticRaceColliderWorld.js';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const CONFIG = {
  massKg: 1500,
  inertiaTensorBodyKgM2: { xx: 700, xy: 0, xz: 0, yy: 1900, yz: 0, zz: 2200 },
  bodyCollisionFriction: 0.45,
  bodyCollisionRestitution: 0.2,
  bodyCollisionRestitutionThresholdMps: 1,
  bodyCollisionSolverIterations: 6,
  bodyCollisionToleranceM: 0.008,
  staticColliderMaximumPositionalCorrectionM: 0.06
};

function denseCandidates() {
  const candidates = [];
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      candidates.push({
        id: `bumper-${x}-${y}`,
        pieceId: 'front-bumper',
        localPoint: { x: x * 0.2, y: y * 0.15, z: 0.8 }
      });
    }
  }
  return candidates;
}

function state(position, velocity) {
  return {
    position: { ...position }, orientation: { ...IDENTITY },
    velocity: { ...velocity }, angularVelocityWorld: { x: 0, y: 0, z: 0 }
  };
}

test('dense probe faces reduce to four persistent representatives per physical manifold', () => {
  const raw = denseCandidates().map((candidate, index) => ({
    id: candidate.id,
    colliderId: 'wall',
    featureId: 'wall-face',
    pieceId: candidate.pieceId,
    normal: { x: 0, y: 0, z: -1 },
    pointWorld: candidate.localPoint,
    penetrationM: index === 17 ? 0.12 : 0.01 + index * 0.0001
  }));
  const reduced = reducePersistentContactManifold(raw).contacts;
  assert.ok(reduced.length >= 3 && reduced.length <= 4);
  assert.equal(reduced.some((contact) => contact.penetrationM === 0.12), true);
  assert.equal(reduced.every((contact) => contact.manifoldRawContactCount === raw.length), true);
  const history = new PersistentManifoldHistory();
  history.begin(10);
  assert.equal(history.classifyAndRemember(reduced[0].manifoldClusterKey), false);
  history.begin(11);
  assert.equal(history.classifyAndRemember(reduced[0].manifoldClusterKey), true);
});

test('wall manifold bounds contacts applies restitution once and preserves glancing tangent', () => {
  const world = prepareStaticRaceColliders([{
    id: 'wall', type: 'plane', point: { z: 0 }, normal: { x: 0, y: 0, z: -1 },
    friction: 0.45, restitution: 0.2
  }]);
  const solver = new StaticColliderCollision({ candidates: denseCandidates() });
  const previous = state({ x: 0, y: 1, z: -1 }, { x: 8, y: 0, z: 20 });
  const working = state({ x: 0.4, y: 1, z: 0.1 }, previous.velocity);
  const first = solver.step({
    workingState: working,
    previousWorkingState: previous,
    config: CONFIG,
    environment: { staticColliderWorld: world, collisionStepIndex: 1 },
    dt: 1 / 60
  });
  assert.equal(first.swept, true);
  assert.ok(first.contacts.length <= 4);
  assert.ok(first.rawContactCount > first.reducedContactCount);
  assert.ok(first.restitutionContributionNs > 0);
  assert.equal(first.contacts.every((contact) => (
    contact.preImpactManifoldTangentSpeedMps < 0.35
      || contact.staticCaptureEligible === false
  )), true);
  assert.ok(Number.isFinite(working.position.x) && Number.isFinite(working.position.z));
  assert.ok(working.velocity.x > 1, `glancing tangent ${working.velocity.x}`);

  const persistentPrevious = state(
    { x: working.position.x, y: working.position.y, z: -0.01 },
    { x: -8, y: 0, z: 5 }
  );
  const persistentWorking = state(
    { x: persistentPrevious.position.x - 0.02, y: persistentPrevious.position.y, z: 0.005 },
    persistentPrevious.velocity
  );
  const second = solver.step({
    workingState: persistentWorking,
    previousWorkingState: persistentPrevious,
    config: CONFIG,
    environment: { staticColliderWorld: world, collisionStepIndex: 2 },
    dt: 1 / 120
  });
  assert.equal(second.contacts.some((contact) => contact.persistentManifold), true);
  assert.equal(second.restitutionContributionNs, 0);
  assert.ok(second.contacts.length <= 4);
  assert.ok(persistentWorking.velocity.x < -0.1, 'reverse tangent motion remains available');
  assert.ok(persistentWorking.velocity.z <= 1e-6, 'inward wall velocity is removed');
});

test('low-speed bumper contact is resting contact with no rebound', () => {
  const world = prepareStaticRaceColliders([{
    id: 'wall', type: 'plane', point: { z: 0 }, normal: { x: 0, y: 0, z: -1 },
    friction: 0.4, restitution: 0.4
  }]);
  const solver = new StaticColliderCollision({ candidates: denseCandidates() });
  const previous = state({ x: 0, y: 1, z: -0.82 }, { x: 0, y: 0, z: 0.4 });
  const working = state({ x: 0, y: 1, z: -0.79 }, previous.velocity);
  const result = solver.step({
    workingState: working, previousWorkingState: previous, config: CONFIG,
    environment: { staticColliderWorld: world, collisionStepIndex: 1 }, dt: 1 / 120
  });
  assert.equal(result.restitutionContributionNs, 0);
  assert.ok(result.contacts.length <= 4);
  assert.ok(working.velocity.z <= 1e-6);
  assert.ok(Number.isFinite(working.position.z));
});

test('wall floor corner terminates repeated zero-time manifolds without welding', () => {
  const world = prepareStaticRaceColliders([
    {
      id: 'wall', type: 'plane', point: { z: 0 }, normal: { x: 0, y: 0, z: -1 },
      friction: 0.35, restitution: 0.15
    },
    {
      id: 'floor', type: 'plane', point: { y: 0 }, normal: { x: 0, y: 1, z: 0 },
      friction: 0.6, restitution: 0.1
    }
  ]);
  const candidates = denseCandidates();
  candidates.push(...denseCandidates().map((candidate, index) => ({
    ...candidate,
    id: `floor-${index}`,
    pieceId: 'underfloor',
    localPoint: { x: candidate.localPoint.x, y: -0.5, z: candidate.localPoint.y }
  })));
  const solver = new StaticColliderCollision({ candidates });
  const previous = state({ x: 0, y: 0.49, z: -0.79 }, { x: -5, y: -8, z: 12 });
  const working = state({ x: -0.04, y: 0.47, z: -0.77 }, previous.velocity);
  const result = solver.step({
    workingState: working,
    previousWorkingState: previous,
    config: CONFIG,
    environment: { staticColliderWorld: world, collisionStepIndex: 1 },
    dt: 1 / 60
  });
  assert.ok(result.contacts.length <= 8, `bounded contacts ${result.contacts.length}`);
  assert.ok(result.zeroTimeRepeatCount <= 1);
  assert.ok(result.contacts.filter((contact) => contact.restitutionImpulseNs > 0).length <= 2);
  assert.ok(Number.isFinite(working.position.x));
  assert.ok(Number.isFinite(working.position.y));
  assert.ok(Number.isFinite(working.position.z));
  assert.ok(working.velocity.x < -0.1, 'corner solve preserves an escape tangent');
});
