export default class CompanionPathfinder {
  findPath(graph, startId, goalId) {
    if (!graph || !startId || !goalId) return null;
    if (startId === goalId) {
      return { nodeIds: [startId], edges: [] };
    }
    const open = new Set([startId]);
    const cameFrom = new Map();
    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, this.heuristic(graph, startId, goalId)]]);

    while (open.size > 0) {
      const current = this.lowest(open, fScore);
      if (!current) break;
      if (current === goalId) {
        return this.reconstruct(graph, cameFrom, current);
      }
      open.delete(current);
      const neighbors = graph.edges.get(current) || [];
      neighbors.forEach((edge) => {
        const tentative = (gScore.get(current) ?? Infinity) + (edge.cost ?? 1);
        if (tentative < (gScore.get(edge.to) ?? Infinity)) {
          cameFrom.set(edge.to, { from: current, edge });
          gScore.set(edge.to, tentative);
          fScore.set(edge.to, tentative + this.heuristic(graph, edge.to, goalId));
          open.add(edge.to);
        }
      });
    }
    return null;
  }

  heuristic(graph, fromId, toId) {
    const from = graph.nodes.get(fromId);
    const to = graph.nodes.get(toId);
    if (!from || !to) return 0;
    return Math.hypot(from.x - to.x, from.y - to.y) * 0.02;
  }

  lowest(open, fScore) {
    let best = null;
    let bestScore = Infinity;
    open.forEach((id) => {
      const score = fScore.get(id) ?? Infinity;
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    });
    return best;
  }

  reconstruct(graph, cameFrom, current) {
    const nodeIds = [current];
    const edges = [];
    let cursor = current;
    while (cameFrom.has(cursor)) {
      const step = cameFrom.get(cursor);
      edges.unshift(step.edge);
      cursor = step.from;
      nodeIds.unshift(cursor);
    }
    return { nodeIds, edges };
  }
}
