import { getNetworkEdgePoints, findNetworkRoute } from './RaceRouteNetwork.js';
import { getNetworkFinishNodes } from './RaceFinishNodes.js';

// Immutable runtime index. Rebuild on authored topology/coordinate changes.
export function createRaceNetworkQueryIndex(network) {
  const segments = [], lengths = new Map(), incoming = new Map();
  for (const edge of network.edges) {
    const points = getNetworkEdgePoints(network, edge);
    let offset = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.heightM - a.heightM;
      const planarLength2 = dx * dx + dz * dz, length = Math.hypot(dx, dz, dy);
      if (planarLength2 >= 1e-9) segments.push({ a, b, dx, dz, dy, planarLength2, length, offset, edge, order: segments.length });
      offset += length;
    }
    lengths.set(edge.id, offset);
    const add = (to, from) => {
      if (!incoming.has(to)) incoming.set(to, []);
      incoming.get(to).push({ from, length: offset });
    };
    add(edge.to, edge.from);
    if (edge.bidirectional) add(edge.from, edge.to);
  }
  const build = items => {
    if (!items.length) return null;
    const node = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const s of items) for (const p of [s.a, s.b]) {
      node.minX = Math.min(node.minX, p.x); node.maxX = Math.max(node.maxX, p.x);
      node.minZ = Math.min(node.minZ, p.z); node.maxZ = Math.max(node.maxZ, p.z);
      node.minY = Math.min(node.minY, p.heightM); node.maxY = Math.max(node.maxY, p.heightM);
    }
    if (items.length <= 8) node.items = items;
    else {
      const axis = node.maxX - node.minX > node.maxZ - node.minZ ? 'x' : 'z';
      items.sort((a,b) => (a.a[axis] + a.b[axis]) - (b.a[axis] + b.b[axis]));
      const middle = Math.floor(items.length / 2);
      node.left = build(items.slice(0,middle)); node.right = build(items.slice(middle));
    }
    return node;
  };
  const root = build(segments);
  const finishId = network.finishNodeId || getNetworkFinishNodes(network)[0]?.id;
  const costs = new Map(), pending = new Set();
  if (finishId) { costs.set(finishId,0); pending.add(finishId); }
  while (pending.size) {
    let current, cost = Infinity;
    for (const id of pending) if (costs.get(id) < cost) {current=id;cost=costs.get(id);}
    pending.delete(current);
    for (const link of incoming.get(current) || []) {
      const next=cost+link.length;
      if (next < (costs.get(link.from) ?? Infinity)) {costs.set(link.from,next);pending.add(link.from);}
    }
  }
  if (!finishId) {
    // Preserve start-only free-drive projection semantics.
    for (const node of network.nodes) {
      const route = findNetworkRoute(network, node.id);
      if (route) costs.set(node.id, route.lengthM);
    }
  }
  const routeLength = finishId ? costs.get(network.startNodeId) : findNetworkRoute(network)?.lengthM;
  return { lengths, costs, routeLength, project(position, { previousEdgeId = '' } = {}) {
    let best = null, bestOrder = Infinity;
    const hasHeight = Number.isFinite(position.heightM);
    const gap = (v,min,max) => Math.max(min-v,0,v-max);
    const lowerBound = node => gap(position.x,node.minX,node.maxX)**2 + gap(position.z,node.minZ,node.maxZ)**2
      + (hasHeight ? gap(position.heightM,node.minY,node.maxY)**2 * 4 : 0) - .04;
    const visit = node => {
      if (!node || lowerBound(node) > (best?.score ?? Infinity)) return;
      if (!node.items) {
        const first = lowerBound(node.left) <= lowerBound(node.right) ? node.left : node.right;
        visit(first);visit(first === node.left ? node.right : node.left);return;
      }
      for (const s of node.items) {
        const {a,dx,dz,dy,planarLength2,length,offset,edge}=s;
        const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz+(hasHeight?(position.heightM-a.heightM)*dy:0))/(planarLength2+(hasHeight?dy*dy:0))));
        const x=a.x+dx*t,z=a.z+dz*t,heightM=a.heightM+dy*t;
        const horizontalM=Math.hypot(position.x-x,position.z-z),verticalM=hasHeight?Math.abs(position.heightM-heightM):0;
        const score=horizontalM**2+verticalM**2*4-(edge.id===previousEdgeId ? .04 : 0);
        if (!best || score < best.score || (score === best.score && s.order < bestOrder)) {
          bestOrder=s.order;
          best={x,z,heightM,edgeId:edge.id,edge,distance:offset+length*t,yaw:Math.atan2(dx,dz),grade:dy/Math.sqrt(planarLength2),distanceToRoute:horizontalM,verticalDistanceM:verticalM,lateral:((position.x-x)*dz-(position.z-z)*dx)/Math.sqrt(planarLength2),score};
        }
      }
    };
    visit(root);return best;
  }};
}
