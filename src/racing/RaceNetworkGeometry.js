import { getNetworkFinishNodes } from './RaceFinishNodes.js';
import { buildRaceCanonicalSurfaceMesh } from './RaceCanonicalSurfaceMesh.js';
import { sampleNetworkEdge, networkEdgeLength } from './RaceRouteNetwork.js';

const convexHull = (points) => {
  const sorted = [...new Map(points.map(p => [`${p.x.toFixed(6)},${p.z.toFixed(6)}`, p])).values()]
    .sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = (list) => {
    const result = [];
    for (const p of list) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 1e-8) result.pop();
      result.push(p);
    }
    return result;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
};

function sampleAt(samples, distance) {
  const index = Math.max(1, samples.findIndex(s => s.distance >= distance));
  const a = samples[index - 1], b = samples[index];
  const t = Math.max(0, Math.min(1, (distance - a.distance) / Math.max(1e-9, b.distance - a.distance)));
  return { ...b, distance, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
    heightM: a.heightM + (b.heightM - a.heightM) * t };
}

export function buildRaceNetworkGeometry(network, { stepM = 2.5, elevationScaleM = 12 } = {}) {
  const parts = [], paths = [], structureMeshes = [], staticColliderDefinitions = [];
  const finishIds = new Set(getNetworkFinishNodes(network).map(node => node.id));
  const junctions = new Map(network.nodes.map(node => [node.id, { node, edges: [], points: [] }]));
  for (const edge of network.edges) {
    junctions.get(edge.from)?.edges.push(edge); junctions.get(edge.to)?.edges.push(edge);
  }
  const radius = id => {
    const junction = junctions.get(id);
    return junction.edges.length > 1 ? Math.max(...junction.edges.map(e => e.widthM)) * 0.8 : 0;
  };
  const translate = (p, meters) => ({ ...p, elevation: p.elevation + meters / elevationScaleM });
  const structureQuad = (points, source, color = '#56606b') => {
    structureMeshes.push({ points, source, color, textured: false, threeLiftM: 0 });
    const world = points.map(p => ({ x: p.x, y: p.elevation * elevationScaleM, z: p.z }));
    // Index each shell panel separately so a car in a tunnel never scans
    // every triangle of every bridge in the network during a swept query.
    staticColliderDefinitions.push({ id: `${source}:panel:${staticColliderDefinitions.length}`,
      type: 'triangle-mesh', surfaceOnly: true, source,
      triangles: [[0, 1, 2], [0, 2, 3]].map(indices => ({
        vertices: indices.map(i => world[i]), twoSided: true
      })) });
  };
  for (const edge of network.edges) {
    const samples = sampleNetworkEdge(network, edge, { stepM });
    if (samples.length < 2) continue;
    const length = networkEdgeLength(network, edge);
    const trimStart = Math.min(radius(edge.from), length * 0.25);
    const trimEnd = Math.min(radius(edge.to), length * 0.25);
    const start = sampleAt(samples, trimStart), end = sampleAt(samples, length - trimEnd);
    const trimmed = [start, ...samples.filter(s => s.distance > trimStart && s.distance < length - trimEnd), end];
    const isTerminalMarker = id => junctions.get(id).edges.length === 1
      && (id === network.startNodeId || finishIds.has(id));
    if (isTerminalMarker(edge.from)) trimmed.unshift({ ...start, distance: -12,
      x: start.x - Math.sin(start.yaw) * 12, z: start.z - Math.cos(start.yaw) * 12 });
    if (isTerminalMarker(edge.to)) trimmed.push({ ...end, distance: length + 12,
      x: end.x + Math.sin(end.yaw) * 12, z: end.z + Math.cos(end.yaw) * 12 });
    const segment = { id: edge.id, surface: edge.surface, roadWidthM: edge.widthM, structure: edge.structure };
    const sections = trimmed.map(s => {
      const x = Math.cos(s.yaw) * edge.widthM / 2, z = -Math.sin(s.yaw) * edge.widthM / 2;
      const center = { ...s, elevation: s.heightM / elevationScaleM, segment };
      const left = { ...center, x: s.x - x, z: s.z - z }, right = { ...center, x: s.x + x, z: s.z + z };
      return { center, left, right, marginLeft: left, marginRight: right, shoulderLeft: left, shoulderRight: right };
    });
    const bake = { sections, edgeId: edge.id };
    paths.push(bake); parts.push(buildRaceCanonicalSurfaceMesh({ surfaceBake: bake, elevationScaleM }));
    junctions.get(edge.from).points.push(sections[0].left, sections[0].right);
    junctions.get(edge.to).points.push(sections.at(-1).left, sections.at(-1).right);
    for (let i = 1; i < sections.length; i += 1) {
      const a = sections[i - 1], b = sections[i];
      if (edge.structure === 'bridge') {
        structureQuad([a.left, b.left, translate(b.left, -edge.thicknessM), translate(a.left, -edge.thicknessM)], `bridge:${edge.id}`);
        structureQuad([a.right, b.right, translate(b.right, -edge.thicknessM), translate(a.right, -edge.thicknessM)], `bridge:${edge.id}`);
        structureQuad([translate(a.left, -edge.thicknessM), translate(b.left, -edge.thicknessM), translate(b.right, -edge.thicknessM), translate(a.right, -edge.thicknessM)], `bridge:${edge.id}`);
      } else if (edge.structure === 'tunnel') {
        structureQuad([a.left, b.left, translate(b.left, edge.clearanceM), translate(a.left, edge.clearanceM)], `tunnel:${edge.id}`, '#343b44');
        structureQuad([a.right, b.right, translate(b.right, edge.clearanceM), translate(a.right, edge.clearanceM)], `tunnel:${edge.id}`, '#343b44');
        structureQuad([translate(a.left, edge.clearanceM), translate(b.left, edge.clearanceM), translate(b.right, edge.clearanceM), translate(a.right, edge.clearanceM)], `tunnel:${edge.id}`, '#252b33');
      }
    }
  }
  for (const { node, edges, points } of junctions.values()) {
    if (edges.length < 2) continue;
    const hull = convexHull(points);
    if (hull.length < 3) continue;
    // An explicit junction is a single level apron. Ramps begin at its boundary.
    const center = { x: node.x, z: node.z, elevation: node.heightM / elevationScaleM };
    const triangles = hull.map((a, i) => ({ vertices: [center, a, hull[(i + 1) % hull.length]],
      region: 'road', source: `junction:${node.id}`, materialId: edges[0].surface, segment: { surface: edges[0].surface },
      faceNormal: { x: 0, y: 1, z: 0 } }));
    parts.push({ triangles });
  }
  const vertices = [], normals = [], triangles = [], coordinates = new Map();
  const groups = { road: [], margin: [], shoulder: [], transition: [], terrain: [] };
  for (const part of parts) for (const source of part.triangles) {
    const points = [...source.vertices];
    const [a, b, c] = points;
    const ab = { x: b.x - a.x, y: (b.elevation - a.elevation) * elevationScaleM, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: (c.elevation - a.elevation) * elevationScaleM, z: c.z - a.z };
    let normal = { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
    const magnitude = Math.hypot(normal.x, normal.y, normal.z);
    if (magnitude < 1e-8) continue;
    const sign = normal.y < 0 ? -1 : 1;
    normal = { x: normal.x * sign / magnitude, y: normal.y * sign / magnitude, z: normal.z * sign / magnitude };
    if (sign < 0) [points[1], points[2]] = [points[2], points[1]];
    const triangle = { ...source, vertices: points, faceNormal: normal };
    const indices = triangle.vertices.map(p => {
      const key = `${p.x.toFixed(6)},${p.z.toFixed(6)},${p.elevation.toFixed(8)}`;
      if (!coordinates.has(key)) { coordinates.set(key, vertices.length); vertices.push(p); normals.push(p.normal || triangle.faceNormal); }
      return coordinates.get(key);
    });
    groups[triangle.region].push(triangles.length);
    triangles.push({ ...triangle, indices, vertices: indices.map(i => vertices[i]) });
  }
  return {
    mesh: { layered: true, topology: 'route-network', vertices, normals, triangles, groups,
      stats: { vertices: vertices.length, triangles: triangles.length, rejectedDegenerateTriangles: 0, correctedWindingTriangles: 0 } },
    paths, structureMeshes,
    staticColliderDefinitions
  };
}
