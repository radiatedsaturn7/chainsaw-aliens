import { getNetworkEdgePoints } from './RaceRouteNetwork.js';

export function buildRaceMinimap({ network = null, samples = [], circuit = false } = {}) {
  const paths = network ? network.edges.map(edge => ({
    id: edge.id, structure: edge.structure, points: getNetworkEdgePoints(network, edge),
    heightM: getNetworkEdgePoints(network, edge).reduce((sum, p) => sum + p.heightM, 0)
      / Math.max(1, edge.points.length + 2), closed: false
  })).sort((a, b) => a.heightM - b.heightM)
    : [{ id: 'legacy', structure: 'road', points: samples, closed: circuit }];
  const points = paths.flatMap(path => path.points);
  if (points.length < 2) return null;
  return { paths,
    start: network ? network.nodes.find(n => n.id === network.startNodeId) : samples[0],
    finish: network ? network.nodes.find(n => n.id === network.finishNodeId) : circuit ? null : samples.at(-1),
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z))
  };
}
