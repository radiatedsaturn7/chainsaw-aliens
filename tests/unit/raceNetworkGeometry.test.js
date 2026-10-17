import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaceRouteNetwork, createNetworkJunction } from '../../src/racing/RaceRouteNetwork.js';
import { buildRaceNetworkGeometry } from '../../src/racing/RaceNetworkGeometry.js';
import { packRaceCanonicalSurfaceMesh, sampleRaceBakedSurface } from '../../src/racing/RaceBakedSurfaceSampler.js';
import { prepareStaticRaceColliders } from '../../src/racing/simulation/StaticRaceColliderWorld.js';

for (const kind of ['y', 't', 'cross']) test(`${kind} junction has continuous support from every arm through its center`, () => {
  const base = normalizeRaceRouteNetwork({ nodes: [{ id: 'center' }] });
  const { network } = createNetworkJunction(base, { nodeId: 'center', kind });
  const geometry = buildRaceNetworkGeometry(network);
  const sampler = packRaceCanonicalSurfaceMesh(geometry.mesh);
  for (const node of network.nodes.slice(1)) for (let step = 0; step <= 120; step++) {
    const t = step / 120;
    const sample = sampleRaceBakedSurface(sampler, { x: node.x * t, z: node.z * t, y: 0.4 });
    assert.ok(sample, `missing support on ${node.id} at ${t}`);
    assert.ok(Math.abs(sample.elevation) < 1e-9);
  }
  assert.ok(geometry.mesh.triangles.every(t => t.faceNormal.y > 0));
});

test('bridge and tunnel crossings produce separate drivable decks and physical walls/undersides', () => {
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: -30, z: 0, heightM: 6 }, { id: 'b', x: 30, z: 0, heightM: 6 },
      { id: 'c', x: 0, z: -30, heightM: -3 }, { id: 'd', x: 0, z: 30, heightM: -3 }],
    edges: [{ id: 'upper', from: 'a', to: 'b', structure: 'bridge' }, { id: 'lower', from: 'c', to: 'd', structure: 'tunnel', clearanceM: 4 }]
  });
  const result = buildRaceNetworkGeometry(network);
  const sampler = packRaceCanonicalSurfaceMesh(result.mesh);
  assert.equal(sampleRaceBakedSurface(sampler, { x: 0, z: 0, y: 6.4 }).elevation * 12, 6);
  assert.equal(sampleRaceBakedSurface(sampler, { x: 0, z: 0, y: -2.6 }).elevation * 12, -3);
  assert.ok(result.structureMeshes.some(m => m.source === 'bridge:upper'));
  assert.ok(result.structureMeshes.some(m => m.source === 'tunnel:lower'));
  const colliders = prepareStaticRaceColliders(result.staticColliderDefinitions);
  assert.ok(colliders);
  assert.ok(result.staticColliderDefinitions.reduce((sum, panel) => sum + panel.triangles.length, 0) > 100);
});
