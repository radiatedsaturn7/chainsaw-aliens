import { getNetworkFinishNodes } from './RaceFinishNodes.js';
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
  const finishes = network ? getNetworkFinishNodes(network) : circuit ? [] : [samples.at(-1)].filter(Boolean);
  return { paths, finishes,
    start: network ? network.nodes.find(n => n.id === network.startNodeId) : samples[0],
    finish: finishes[0] || null,
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z))
  };
}
