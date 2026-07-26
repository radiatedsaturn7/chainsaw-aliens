import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaceCanonicalSurfaceMesh } from '../../src/racing/RaceCanonicalSurfaceMesh.js';

const point = (x, z, elevation = 0, extra = {}) => ({ x, z, elevation, ...extra });

function section(z, {
  roadHalfWidth = 2,
  marginWidth = 1,
  shoulderWidth = 1
} = {}) {
  const center = point(0, z, 0, { segment: { surface: 'asphalt' } });
  return {
    center,
    left: point(-roadHalfWidth, z),
    right: point(roadHalfWidth, z),
    marginLeft: point(-(roadHalfWidth + marginWidth), z),
    marginRight: point(roadHalfWidth + marginWidth, z),
    shoulderLeft: point(-(roadHalfWidth + marginWidth + shoulderWidth), z),
    shoulderRight: point(roadHalfWidth + marginWidth + shoulderWidth, z)
  };
}

test('canonical race mesh reuses exact outer track vertices as terrain row zero', () => {
  const near = section(0);
  const far = section(5);
  const nearOuter = near.shoulderLeft;
  const farOuter = far.shoulderLeft;
  const terrainCells = [{
    key: 'terrain:left:0',
    terrainRegion: 'transition',
    points: [
      nearOuter,
      point(-6, 0, 0.1),
      point(-6, 5, 0.1),
      farOuter
    ]
  }];
  const mesh = buildRaceCanonicalSurfaceMesh({
    surfaceBake: { sections: [near, far] },
    terrainCells,
    elevationScaleM: 12
  });

  const nearIndex = mesh.vertices.indexOf(nearOuter);
  const farIndex = mesh.vertices.indexOf(farOuter);
  assert.notEqual(nearIndex, -1);
  assert.notEqual(farIndex, -1);
  assert.equal(mesh.triangles.some((triangle) => (
    triangle.region === 'shoulder' && triangle.indices.includes(nearIndex)
  )), true);
  assert.equal(mesh.triangles.some((triangle) => (
    triangle.region === 'transition' && triangle.indices.includes(nearIndex)
  )), true);
  assert.equal(mesh.triangles.some((triangle) => (
    triangle.region === 'shoulder' && triangle.indices.includes(farIndex)
  )), true);
  assert.equal(mesh.triangles.some((triangle) => (
    triangle.region === 'transition' && triangle.indices.includes(farIndex)
  )), true);
});

test('canonical race mesh emits only nondegenerate upward triangles and normals', () => {
  const near = section(0, { marginWidth: 0, shoulderWidth: 0 });
  near.marginLeft = near.left;
  near.marginRight = near.right;
  near.shoulderLeft = near.left;
  near.shoulderRight = near.right;
  const far = section(5, { marginWidth: 0, shoulderWidth: 0 });
  far.marginLeft = far.left;
  far.marginRight = far.right;
  far.shoulderLeft = far.left;
  far.shoulderRight = far.right;
  const mesh = buildRaceCanonicalSurfaceMesh({
    surfaceBake: { sections: [near, far] },
    terrainCells: [{
      key: 'terrain:right:0',
      points: [
        near.right,
        far.right,
        point(8, 5, 0.4),
        point(8, 0, 0.2)
      ]
    }, {
      key: 'degenerate',
      points: [point(1, 1), point(1, 1), point(1, 1)]
    }],
    elevationScaleM: 12
  });

  assert.equal(mesh.stats.rejectedDegenerateTriangles > 0, true);
  assert.equal(mesh.triangles.length > 0, true);
  assert.equal(mesh.triangles.every((triangle) => triangle.faceNormal.y > 0), true);
  assert.equal(mesh.normals.every((normal) => normal.y > 0), true);
  assert.equal(mesh.triangles.every((triangle) => new Set(triangle.indices).size === 3), true);
});

test('canonical race circuit closes by indexed shared station vertices', () => {
  const a = section(0, { marginWidth: 0, shoulderWidth: 0 });
  const b = section(5, { marginWidth: 0, shoulderWidth: 0 });
  [a, b].forEach((entry) => {
    entry.marginLeft = entry.left;
    entry.marginRight = entry.right;
    entry.shoulderLeft = entry.left;
    entry.shoulderRight = entry.right;
  });
  const mesh = buildRaceCanonicalSurfaceMesh({
    surfaceBake: { sections: [a, b] },
    runtimeType: 'circuit'
  });

  assert.equal(mesh.groups.road.length, 4);
  assert.equal(mesh.stats.nonManifoldEdges, 0);
  assert.equal(mesh.triangles.every((triangle) => triangle.faceNormal.y > 0), true);
});
