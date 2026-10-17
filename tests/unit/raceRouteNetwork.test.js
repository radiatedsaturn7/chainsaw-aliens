import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRaceRouteNetwork, validateRaceRouteNetwork, findNetworkRoute,
  addNetworkRoute, splitNetworkRoute, createNetworkJunction, joinNetworkJunctions,
  sampleNetworkEdge, sampleNetworkRoute, projectNetworkPoint
} from '../../src/racing/RaceRouteNetwork.js';
import { advanceNetworkRaceProgress } from '../../src/racing/RaceRouteNetwork.js';

const straight = () => normalizeRaceRouteNetwork({
  nodes: [{ id: 'start', x: 0, z: 0 }, { id: 'finish', x: 0, z: 200 }],
  edges: [{ id: 'main', from: 'start', to: 'finish' }], startNodeId: 'start', finishNodeId: 'finish'
});

test('split and rejoin an alternative route without moving start/finish or changing the source', () => {
  const source = straight();
  const first = splitNetworkRoute(source, 'main', 50);
  const second = splitNetworkRoute(first.network, first.edgeIds[1], 100);
  const branch = addNetworkRoute(second.network, {
    from: first.nodeId, to: second.nodeId, points: [{ x: 50, z: 100, heightM: 3 }], structure: 'bridge'
  });
  assert.deepEqual(validateRaceRouteNetwork(branch.network), []);
  assert.equal(source.nodes.length, 2);
  assert.equal(branch.network.startNodeId, 'start');
  assert.equal(branch.network.finishNodeId, 'finish');
  assert.equal(findNetworkRoute(branch.network).lengthM, 200);
  const edge = branch.network.edges.find(e => e.id === branch.edgeId);
  const samples = sampleNetworkEdge(branch.network, edge);
  assert.equal(samples[0].z, 50); assert.equal(samples.at(-1).z, 150);
  assert.ok(samples.some(p => p.heightM > 2.8));
  assert.ok(samples.every((p, i) => !i || p.distance > samples[i - 1].distance));
});

for (const [kind, arms] of [['y', 3], ['t', 3], ['cross', 4]]) test(`${kind} has explicit connected arms and can join another junction`, () => {
  const base = normalizeRaceRouteNetwork({ nodes: [{ id: 'center' }] });
  const junction = createNetworkJunction(base, { nodeId: 'center', kind });
  assert.equal(junction.network.edges.length, arms);
  junction.network.startNodeId = junction.nodeIds[0]; junction.network.finishNodeId = junction.nodeIds[1];
  assert.deepEqual(validateRaceRouteNetwork(junction.network), []);
  assert.equal(findNetworkRoute(junction.network).steps.length, 2);
  assert.equal(sampleNetworkRoute(junction.network).at(-1).distance, 120);
  const remote = structuredClone(junction.network);
  remote.nodes.push({ id: 'remote', x: 1, z: 1, heightM: 0 });
  const connected = addNetworkRoute(remote, { from: junction.nodeIds[0], to: 'remote' });
  const joined = joinNetworkJunctions(connected.network, 'center', 'remote');
  assert.ok(joined.edges.every(e => e.from !== 'remote' && e.to !== 'remote'));
});

test('crossing bridge and tunnel remain disconnected and projection selects the physical deck', () => {
  const network = normalizeRaceRouteNetwork({
    nodes: [{ id: 'a', x: -50, z: 0, heightM: 6 }, { id: 'b', x: 50, z: 0, heightM: 6 },
      { id: 'c', x: 0, z: -50, heightM: -3 }, { id: 'd', x: 0, z: 50, heightM: -3 }],
    edges: [{ id: 'bridge', from: 'a', to: 'b', structure: 'bridge' }, { id: 'tunnel', from: 'c', to: 'd', structure: 'tunnel' }],
    startNodeId: 'a', finishNodeId: 'd'
  });
  assert.equal(findNetworkRoute(network), null);
  assert.match(validateRaceRouteNetwork(network).join(' '), /not reachable/);
  assert.equal(projectNetworkPoint(network, { x: 0, z: 0, heightM: 6 }).edgeId, 'bridge');
  assert.equal(projectNetworkPoint(network, { x: 0, z: 0, heightM: -3 }, { previousEdgeId: 'bridge' }).edgeId, 'tunnel');
  assert.throws(() => joinNetworkJunctions(network, 'a', 'c'), /connecting ramp/);
});

test('one-way edges, malformed endpoints and start/finish invariants survive serialization', () => {
  const network = straight(); network.edges[0].bidirectional = false;
  assert.equal(findNetworkRoute(network, 'finish', 'start'), null);
  assert.deepEqual(normalizeRaceRouteNetwork(JSON.parse(JSON.stringify(network))), network);
  assert.throws(() => joinNetworkJunctions(network, 'start', 'finish'), /distinct/);
  assert.throws(() => splitNetworkRoute(network, 'main', 0), /one metre/);
  network.edges[0].to = 'absent';
  assert.match(validateRaceRouteNetwork(network).join(' '), /missing endpoint/);
});

test('race completion requires crossing the distinct start then finish in the right direction and on the right deck', () => {
  const network = straight();
  const p = (z, heightM = 0.55, x = 0) => ({ x, z, heightM });
  assert.equal(advanceNetworkRaceProgress(network, p(199), p(201)).finished, false);
  let progress = advanceNetworkRaceProgress(network, p(-2), p(2));
  assert.equal(progress.started, true);
  assert.equal(advanceNetworkRaceProgress(network, p(201), p(199), progress).finished, false);
  assert.equal(advanceNetworkRaceProgress(network, p(199, 6), p(201, 6), progress).finished, false);
  assert.equal(advanceNetworkRaceProgress(network, p(199, 0.55, 30), p(201, 0.55, 30), progress).finished, false);
  progress = advanceNetworkRaceProgress(network, p(199), p(201), progress);
  assert.equal(progress.finished, true);
});

test('moving junction deforms connected sampled curves and height ramps without changing opposite endpoints', async () => {
  const { moveNetworkJunction } = await import('../../src/racing/RaceRouteNetwork.js');
  const source = straight();
  source.edges[0].points = [{ x: 0, z: 50, heightM: 0 }, { x: 0, z: 150, heightM: 0 }];
  const result = moveNetworkJunction(source, 'start', { x: 40, heightM: 8 });
  assert.deepEqual(result.edges[0].points, [{ x: 30, z: 50, heightM: 6 }, { x: 10, z: 150, heightM: 2 }]);
  assert.deepEqual(result.nodes[1], source.nodes[1]);
  assert.equal(source.nodes[0].x, 0);
  const reverse = moveNetworkJunction(source, 'finish', { x: 40, heightM: 8 });
  assert.deepEqual(reverse.edges[0].points, [{ x: 10, z: 50, heightM: 2 }, { x: 30, z: 150, heightM: 6 }]);
});

test('starting exactly on the start line counts when moving forward off the grid', () => {
  const network = straight();
  const progress = advanceNetworkRaceProgress(network, { x: 0, z: 0, heightM: 0.55 }, { x: 0, z: 0.1, heightM: 0.55 });
  assert.equal(progress.started, true);
  assert.equal(progress.finished, false);
});
