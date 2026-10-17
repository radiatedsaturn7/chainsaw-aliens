// Explicit topology: coincident coordinates never create a connection. Heights
// are metres; conversion to the legacy renderer's elevation units happens only
// at the rendering boundary.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const point = (p = {}) => ({ x: finite(p.x), z: finite(p.z), heightM: finite(p.heightM) });
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z, b.heightM - a.heightM);
const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
  heightM: a.heightM + (b.heightM - a.heightM) * t
});

export function normalizeRaceRouteNetwork(source) {
  if (!source || typeof source !== 'object') return null;
  return {
    version: 1,
    nodes: (Array.isArray(source.nodes) ? source.nodes : []).map((node, index) => ({
      ...point(node), id: String(node.id || `node-${index}`), name: String(node.name || '')
    })),
    edges: (Array.isArray(source.edges) ? source.edges : []).map((edge, index) => ({
      id: String(edge.id || `edge-${index}`), name: String(edge.name || ''),
      from: String(edge.from || ''), to: String(edge.to || ''),
      points: (Array.isArray(edge.points) ? edge.points : []).map(point),
      widthM: clamp(finite(edge.widthM, 11), 3, 40),
      surface: String(edge.surface || 'asphalt'),
      structure: ['road', 'bridge', 'tunnel'].includes(edge.structure) ? edge.structure : 'road',
      clearanceM: clamp(finite(edge.clearanceM, 5), 2, 30),
      thicknessM: clamp(finite(edge.thicknessM, 0.5), 0.15, 3),
      bidirectional: edge.bidirectional !== false
    })),
    startNodeId: String(source.startNodeId || ''),
    finishNodeId: String(source.finishNodeId || '')
  };
}

export function networkFromLegacySamples(samples, { elevationScaleM = 12, widthM = 11 } = {}) {
  if (samples.length < 2) throw new Error('Draw a route before adding junctions.');
  const convert = s => ({ x: s.x, z: s.z, heightM: Number(s.elevation || 0) * elevationScaleM });
  const nodes = [{ ...convert(samples[0]), id: 'start' }], edges = [];
  let first = 0;
  for (let i = 1; i < samples.length; i++) {
    if (i < samples.length - 1 && samples[i + 1].index === samples[i].index) continue;
    const id = i === samples.length - 1 ? 'finish' : `junction-${nodes.length}`;
    const segment = samples[i].segment || {};
    edges.push({ id: `route-${edges.length + 1}`, from: nodes.at(-1).id, to: id,
      points: samples.slice(first + 1, i).map(convert),
      widthM: segment.roadWidthM || segment.roadWidth || widthM, surface: segment.surface || 'asphalt' });
    nodes.push({ ...convert(samples[i]), id }); first = i;
  }
  return normalizeRaceRouteNetwork({ nodes, edges, startNodeId: 'start', finishNodeId: 'finish' });
}

export function getNetworkEdgePoints(network, edge) {
  const from = network.nodes.find(node => node.id === edge.from);
  const to = network.nodes.find(node => node.id === edge.to);
  return from && to ? [from, ...edge.points, to] : [];
}

export function networkEdgeLength(network, edge) {
  const points = getNetworkEdgePoints(network, edge);
  return points.slice(1).reduce((sum, p, index) => sum + distance(points[index], p), 0);
}

export function findNetworkRoute(network, fromId = network.startNodeId, toId = network.finishNodeId) {
  const costs = new Map([[fromId, 0]]), previous = new Map(), pending = new Set(network.nodes.map(n => n.id));
  while (pending.size) {
    let current = null, cost = Infinity;
    for (const id of pending) if ((costs.get(id) ?? Infinity) < cost) { current = id; cost = costs.get(id); }
    if (current === null || current === toId) break;
    pending.delete(current);
    for (const edge of network.edges) {
      const reverse = edge.to === current && edge.bidirectional;
      if (edge.from !== current && !reverse) continue;
      const next = reverse ? edge.from : edge.to;
      if (!pending.has(next)) continue;
      const nextCost = cost + networkEdgeLength(network, edge);
      if (nextCost < (costs.get(next) ?? Infinity)) {
        costs.set(next, nextCost); previous.set(next, { edgeId: edge.id, reverse, from: current });
      }
    }
  }
  if (!costs.has(toId)) return null;
  const route = [];
  for (let id = toId; id !== fromId;) {
    const step = previous.get(id);
    if (!step) return null;
    route.unshift({ edgeId: step.edgeId, reverse: step.reverse }); id = step.from;
  }
  return { steps: route, lengthM: costs.get(toId) };
}

export function validateRaceRouteNetwork(network) {
  const errors = [];
  if (!network) return ['Route network is missing.'];
  const nodes = new Set(), edges = new Set();
  for (const node of network.nodes) {
    if (nodes.has(node.id)) errors.push(`Duplicate junction: ${node.id}`);
    nodes.add(node.id);
  }
  for (const edge of network.edges) {
    if (edges.has(edge.id)) errors.push(`Duplicate route: ${edge.id}`);
    edges.add(edge.id);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) errors.push(`Route ${edge.id} has a missing endpoint.`);
    if (edge.from === edge.to) errors.push(`Route ${edge.id} needs two different endpoints.`);
    if (networkEdgeLength(network, edge) < 1) errors.push(`Route ${edge.id} is shorter than one metre.`);
  }
  if (!nodes.has(network.startNodeId)) errors.push('Choose a start junction.');
  if (!nodes.has(network.finishNodeId)) errors.push('Choose a finish junction.');
  if (network.startNodeId === network.finishNodeId) errors.push('Start and finish must be distinct.');
  if (!errors.length && !findNetworkRoute(network)) errors.push('Finish is not reachable from start.');
  return errors;
}

export function sampleNetworkEdge(network, edge, { stepM = 2.5, reverse = false } = {}) {
  const points = getNetworkEdgePoints(network, edge);
  if (reverse) points.reverse();
  const samples = [];
  let distanceM = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1], b = points[index], length = distance(a, b);
    if (length < 1e-6) continue;
    const count = Math.max(1, Math.ceil(length / Math.max(0.5, stepM)));
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = samples.length ? 1 : 0; i <= count; i += 1) {
      samples.push({ ...lerp(a, b, i / count), yaw, distance: distanceM + length * i / count, edgeId: edge.id });
    }
    distanceM += length;
  }
  return samples;
}

export function sampleNetworkRoute(network, route = findNetworkRoute(network), options = {}) {
  if (!route) return [];
  const samples = [];
  let offset = 0;
  for (const step of route.steps) {
    const edge = network.edges.find(e => e.id === step.edgeId);
    if (!edge) return [];
    const part = sampleNetworkEdge(network, edge, { ...options, reverse: step.reverse });
    samples.push(...part.slice(samples.length ? 1 : 0).map(s => ({ ...s, distance: offset + s.distance })));
    offset += part.at(-1)?.distance || 0;
  }
  return samples;
}

// Prefer the physically nearest deck. A small continuity bias prevents flicker
// at a shared junction without trapping a driver on the previously chosen arm.
export function projectNetworkPoint(network, position, { previousEdgeId = '' } = {}) {
  let best = null;
  const hasHeight = Number.isFinite(position.heightM);
  for (const edge of network.edges) {
    const points = getNetworkEdgePoints(network, edge);
    let offset = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i];
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.heightM - a.heightM;
      const planarLength2 = dx * dx + dz * dz;
      const length = distance(a, b);
      if (planarLength2 < 1e-9) { offset += length; continue; }
      const t = clamp(((position.x - a.x) * dx + (position.z - a.z) * dz
        + (hasHeight ? (position.heightM - a.heightM) * dy : 0))
        / (planarLength2 + (hasHeight ? dy * dy : 0)), 0, 1);
      const p = lerp(a, b, t), horizontalM = Math.hypot(position.x - p.x, position.z - p.z);
      const verticalM = hasHeight ? Math.abs(position.heightM - p.heightM) : 0;
      const score = horizontalM ** 2 + verticalM ** 2 * 4 - (edge.id === previousEdgeId ? 0.04 : 0);
      if (!best || score < best.score) best = {
        ...p, edgeId: edge.id, edge, distance: offset + length * t,
        yaw: Math.atan2(dx, dz), distanceToRoute: horizontalM, verticalDistanceM: verticalM,
        lateral: ((position.x - p.x) * dz - (position.z - p.z) * dx) / Math.sqrt(planarLength2), score
      };
      offset += length;
    }
  }
  return best;
}

function uniqueId(items, prefix) {
  const ids = new Set(items.map(item => item.id));
  let index = 1; while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

// Pure authoring operations make undo a document snapshot and never mutate a
// shared endpoint from an unrelated crossing at the same X/Z coordinates.
export function addNetworkRoute(source, { from, to, points = [], ...properties }) {
  const network = structuredClone(source);
  if (!network.nodes.some(n => n.id === from) || !network.nodes.some(n => n.id === to) || from === to) {
    throw new Error('Select two different junctions to connect.');
  }
  const id = uniqueId(network.edges, 'route');
  network.edges.push(normalizeRaceRouteNetwork({ edges: [{ ...properties, id, from, to, points }] }).edges[0]);
  return { network, edgeId: id };
}

export function splitNetworkRoute(source, edgeId, distanceM) {
  const network = structuredClone(source), edge = network.edges.find(e => e.id === edgeId);
  if (!edge) throw new Error('Route not found.');
  const points = getNetworkEdgePoints(network, edge), length = networkEdgeLength(network, edge);
  if (!(distanceM >= 1 && distanceM <= length - 1)) throw new Error('Split at least one metre from either endpoint.');
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const span = distance(points[i - 1], points[i]);
    if (travelled + span >= distanceM) {
      const nodeId = uniqueId(network.nodes, 'junction');
      network.nodes.push({ ...lerp(points[i - 1], points[i], (distanceM - travelled) / span), id: nodeId, name: '' });
      const nextId = uniqueId(network.edges, 'route');
      network.edges.push({ ...edge, id: nextId, from: nodeId, points: points.slice(i, -1).map(point) });
      edge.to = nodeId; edge.points = points.slice(1, i).map(point);
      return { network, nodeId, edgeIds: [edgeId, nextId] };
    }
    travelled += span;
  }
  throw new Error('Split position is outside the route.');
}

export function createNetworkJunction(source, { nodeId, kind = 'y', heading = 0, lengthM = 60, widthM = 11 } = {}) {
  const network = structuredClone(source), center = network.nodes.find(n => n.id === nodeId);
  if (!center) throw new Error('Select a junction first.');
  const angles = { y: [Math.PI, -Math.PI / 4, Math.PI / 4], t: [Math.PI, -Math.PI / 2, Math.PI / 2], cross: [0, Math.PI / 2, Math.PI, -Math.PI / 2] }[kind];
  if (!angles) throw new Error('Unknown junction shape.');
  const addedNodeIds = [], addedEdgeIds = [];
  for (const angle of angles) {
    const id = uniqueId(network.nodes, 'junction');
    network.nodes.push({ id, name: '', x: center.x + Math.sin(heading + angle) * lengthM,
      z: center.z + Math.cos(heading + angle) * lengthM, heightM: center.heightM });
    const edgeId = uniqueId(network.edges, 'route');
    const edge = normalizeRaceRouteNetwork({ edges: [{ id: edgeId, from: nodeId, to: id, widthM }] }).edges[0];
    network.edges.push(edge); addedNodeIds.push(id); addedEdgeIds.push(edgeId);
  }
  return { network, nodeIds: addedNodeIds, edgeIds: addedEdgeIds };
}

export function joinNetworkJunctions(source, keepId, removeId) {
  const network = structuredClone(source), a = network.nodes.find(n => n.id === keepId), b = network.nodes.find(n => n.id === removeId);
  if (!a || !b || keepId === removeId) throw new Error('Select two different junctions to join.');
  if (Math.abs(a.heightM - b.heightM) > 0.25) throw new Error('Junctions at different heights need a connecting ramp.');
  if ([network.startNodeId, network.finishNodeId].includes(keepId) && [network.startNodeId, network.finishNodeId].includes(removeId)) {
    throw new Error('Start and finish must remain distinct.');
  }
  network.nodes = network.nodes.filter(n => n.id !== removeId);
  for (const edge of network.edges) {
    if (edge.from === removeId) edge.from = keepId;
    if (edge.to === removeId) edge.to = keepId;
  }
  network.edges = network.edges.filter(e => e.from !== e.to);
  if (network.startNodeId === removeId) network.startNodeId = keepId;
  if (network.finishNodeId === removeId) network.finishNodeId = keepId;
  return network;
}

function crossedMarker(network, markerId, previous, current, leaving) {
  const marker = network.nodes.find(n => n.id === markerId);
  if (!marker || !previous || !current) return false;
  for (const edge of network.edges) {
    const atFrom = edge.from === markerId, atTo = edge.to === markerId;
    if (!atFrom && !atTo) continue;
    if (leaving ? (!atFrom && !edge.bidirectional) : (!atTo && !edge.bidirectional)) continue;
    const points = getNetworkEdgePoints(network, edge);
    const neighbor = atFrom ? points[1] : points.at(-2);
    let dx = neighbor.x - marker.x, dz = neighbor.z - marker.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const sign = leaving ? 1 : -1; dx *= sign / length; dz *= sign / length;
    const before = (previous.x - marker.x) * dx + (previous.z - marker.z) * dz;
    const after = (current.x - marker.x) * dx + (current.z - marker.z) * dz;
    if (!(before < 0 && after >= 0)) continue;
    const t = -before / (after - before), crossing = lerp(previous, current, t);
    const lateral = (crossing.x - marker.x) * dz - (crossing.z - marker.z) * dx;
    if (Math.abs(lateral) <= edge.widthM / 2 + 1 && Math.abs(crossing.heightM - marker.heightM) <= 1.8) return true;
  }
  return false;
}

export function advanceNetworkRaceProgress(network, previous, current, progress = {}) {
  const started = progress.started === true || crossedMarker(network, network.startNodeId, previous, current, true);
  return { started, finished: progress.finished === true
    || (started && crossedMarker(network, network.finishNodeId, previous, current, false)) };
}

// Move a junction with its connected curves, fading displacement to zero at
// each opposite endpoint. Arc length weighting also handles uneven samples.
export function moveNetworkJunction(network, nodeId, changes) {
  const next = structuredClone(network);
  const source = network.nodes.find(n => n.id === nodeId);
  const target = next.nodes.find(n => n.id === nodeId);
  if (!source) throw new Error('Unknown junction');
  Object.assign(target, changes, point({ ...source, ...changes }));
  const delta = { x: target.x - source.x, z: target.z - source.z, heightM: target.heightM - source.heightM };
  for (const edge of next.edges) {
    if (edge.from !== nodeId && edge.to !== nodeId) continue;
    const original = network.edges.find(e => e.id === edge.id);
    const points = getNetworkEdgePoints(network, original);
    const length = networkEdgeLength(network, original);
    let travelled = 0;
    edge.points = original.points.map((p, i) => {
      travelled += distance(points[i], points[i + 1]);
      const t = length > 0 ? travelled / length : (i + 1) / (original.points.length + 1);
      const weight = (edge.from === nodeId ? 1 - t : 0) + (edge.to === nodeId ? t : 0);
      return { x: p.x + delta.x * weight, z: p.z + delta.z * weight, heightM: p.heightM + delta.heightM * weight };
    });
  }
  return next;
}
