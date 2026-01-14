const GRAVITY = 1200;

export default class Validator {
  constructor(world, player) {
    this.world = world;
    this.player = player;
  }

  run(abilityState, objectiveTargets) {
    const reports = [];
    let allPass = true;
    const order = ['grapple', 'phase', 'magboots', 'resonance'];
    let abilities = { ...abilityState };
    let reachable = this.computeReachable(abilities);
    order.forEach((ability) => {
      const target = objectiveTargets[ability];
      if (!target) return;
      const key = `${target.tx},${target.ty}`;
      const pass = reachable.has(key);
      reports.push(`${pass ? '✓' : '✗'} ${ability} cache reachable`);
      if (!pass) allPass = false;
      abilities = { ...abilities, [ability]: true };
      reachable = this.computeReachable(abilities);
    });
    const bossTarget = objectiveTargets.boss;
    if (bossTarget) {
      const bossKey = `${bossTarget.tx},${bossTarget.ty}`;
      const bossReach = reachable.has(bossKey);
      reports.push(`${bossReach ? '✓' : '✗'} final boss gate reachable`);
      if (!bossReach) allPass = false;
    }
    return { status: allPass ? 'pass' : 'fail', lines: reports };
  }

  computeReachable(abilities) {
    const nodes = this.collectNodes(abilities);
    const neighbors = this.buildEdges(nodes, abilities);
    const spawn = this.nodeFromWorld(this.player.x, this.player.y);
    let startKey = `${spawn.tx},${spawn.ty}`;
    if (!nodes.has(startKey)) {
      startKey = this.findNearestNode(nodes, spawn.tx, spawn.ty);
    }
    const visited = new Set();
    const queue = startKey ? [startKey] : [];
    while (queue.length) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      visited.add(key);
      const edges = neighbors.get(key) || [];
      edges.forEach((next) => {
        if (!visited.has(next)) queue.push(next);
      });
    }
    return visited;
  }

  findNearestNode(nodes, tx, ty) {
    let bestKey = null;
    let bestDist = Infinity;
    nodes.forEach((node, key) => {
      const dist = Math.abs(node.tx - tx) + Math.abs(node.ty - ty);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    });
    return bestKey;
  }

  collectNodes(abilities) {
    const nodes = new Map();
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        if (this.world.isSolid(x, y, abilities)) continue;
        if (!this.world.isSolid(x, y + 1, abilities)) continue;
        const key = `${x},${y}`;
        nodes.set(key, { tx: x, ty: y });
      }
    }
    return nodes;
  }

  buildEdges(nodes, abilities) {
    const edges = new Map();
    const { maxJumpHeight, maxJumpDistance, maxDropDistance, dashDistance } = this.getMovementProfile(abilities);
    const nodeKeys = Array.from(nodes.keys());
    nodeKeys.forEach((key) => {
      const node = nodes.get(key);
      const list = [];
      const addEdge = (tx, ty) => {
        const nextKey = `${tx},${ty}`;
        if (nodes.has(nextKey)) list.push(nextKey);
      };
      addEdge(node.tx + 1, node.ty);
      addEdge(node.tx - 1, node.ty);
      for (let dx = -maxJumpDistance; dx <= maxJumpDistance; dx += 1) {
        for (let dy = -maxJumpHeight; dy <= maxDropDistance; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const tx = node.tx + dx;
          const ty = node.ty + dy;
          if (!nodes.has(`${tx},${ty}`)) continue;
          if (!this.clearTrajectory(node.tx, node.ty, tx, ty, abilities)) continue;
          list.push(`${tx},${ty}`);
        }
      }
      for (let dx = -dashDistance; dx <= dashDistance; dx += 1) {
        if (dx === 0) continue;
        const tx = node.tx + dx;
        const ty = node.ty;
        if (!nodes.has(`${tx},${ty}`)) continue;
        if (!this.clearTrajectory(node.tx, node.ty, tx, ty, abilities)) continue;
        list.push(`${tx},${ty}`);
      }
      edges.set(key, list);
    });
    return edges;
  }

  getMovementProfile(abilities) {
    const jumpHeight = (this.player.jumpPower ** 2) / (2 * GRAVITY);
    const maxJumpHeight = Math.max(2, Math.ceil(jumpHeight / this.world.tileSize));
    const maxJumpDistance = Math.max(3, Math.ceil((this.player.speed * 0.4) / this.world.tileSize));
    const maxDropDistance = abilities.phase ? 8 : 6;
    const dashDistance = Math.max(3, Math.ceil((620 * 0.12) / this.world.tileSize));
    return {
      maxJumpHeight: abilities.magboots ? maxJumpHeight + 1 : maxJumpHeight,
      maxJumpDistance: abilities.grapple ? maxJumpDistance + 1 : maxJumpDistance,
      maxDropDistance,
      dashDistance
    };
  }

  clearTrajectory(sx, sy, tx, ty, abilities) {
    const steps = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(sx + (tx - sx) * t);
      const y = Math.round(sy + (ty - sy) * t);
      if (this.world.isSolid(x, y, abilities)) return false;
    }
    return true;
  }

  nodeFromWorld(x, y) {
    const tx = Math.floor(x / this.world.tileSize);
    const ty = Math.floor(y / this.world.tileSize);
    return { tx, ty };
  }
}
