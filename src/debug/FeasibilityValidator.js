import { getDashDistance, getJumpHeight, MOVEMENT_MODEL } from '../game/MovementModel.js';

const ABILITY_ORDER = ['anchor', 'flame', 'magboots', 'resonance'];

export default class FeasibilityValidator {
  constructor(world, player) {
    this.world = world;
    this.player = player;
  }

  runSingleStage(abilities, objectiveTargets, stageLabel = 'stage') {
    const nodes = this.collectNodes(abilities);
    const edges = this.buildEdges(nodes, abilities);
    const reachable = this.walkGraph(nodes, edges, abilities);
    const lines = [];
    let status = 'pass';
    const failTarget = (label, target) => {
      const nearest = this.findNearestNode(nodes, reachable, target.tx, target.ty);
      const detail = this.diagnoseFailure(nearest, target, abilities);
      lines.push(`✗ ${label} unreachable`);
      lines.push(`  Stage: ${stageLabel}`);
      if (nearest) {
        lines.push(`  Nearest node: ${nearest.tx},${nearest.ty}`);
      }
      if (detail.constraint) {
        lines.push(`  Constraint: ${detail.constraint}`);
      }
      if (detail.suggestion) {
        lines.push(`  Suggest: ${detail.suggestion}`);
      }
      status = 'fail';
    };
    Object.entries(objectiveTargets).forEach(([label, target]) => {
      if (!target) return;
      const key = `${target.tx},${target.ty}`;
      if (!reachable.has(key)) {
        failTarget(label, target);
      } else {
        lines.push(`✓ ${label} feasible`);
      }
    });
    return { status, lines, reachable };
  }

  runStaged(objectiveTargets) {
    const summary = [];
    const detail = [];
    let abilities = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false
    };
    ABILITY_ORDER.forEach((ability, index) => {
      const stageLabel = `Stage ${index} (${ABILITY_ORDER.slice(0, index).join(', ') || 'base'})`;
      const target = objectiveTargets[ability];
      const stageTargets = {};
      if (target) stageTargets[`${ability} cache`] = target;
      const cacheReport = this.runSingleStage(abilities, stageTargets, stageLabel);
      summary.push(`${cacheReport.status === 'pass' ? '✓' : '✗'} ${stageLabel}`);
      detail.push(...cacheReport.lines);
      abilities = { ...abilities, [ability]: true };
    });
    const finalTargets = {};
    if (objectiveTargets.boss) {
      finalTargets['final rift seal'] = objectiveTargets.boss;
    }
    const finalReport = this.runSingleStage(abilities, finalTargets, 'Final Stage');
    summary.push(`${finalReport.status === 'pass' ? '✓' : '✗'} Final Stage`);
    detail.push(...finalReport.lines);
    const status = summary.every((line) => line.startsWith('✓')) ? 'pass' : 'fail';
    return { status, summary, detail };
  }

  planPath(start, target, abilities) {
    const nodes = this.collectNodes(abilities);
    const edges = this.buildEdges(nodes, abilities);
    const startNode = this.findNearestNode(nodes, null, start.tx, start.ty);
    const targetNode = this.findNearestNode(nodes, null, target.tx, target.ty);
    if (!startNode || !targetNode) {
      return {
        status: 'fail',
        reason: 'no nodes nearby',
        detail: this.diagnoseFailure(startNode, target, abilities),
        path: []
      };
    }
    const queue = [startNode.key];
    const visited = new Set();
    const prev = new Map();
    while (queue.length) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      visited.add(key);
      if (key === targetNode.key) break;
      const edgesFrom = edges.get(key) || [];
      edgesFrom.forEach((next) => {
        if (!visited.has(next)) {
          prev.set(next, key);
          queue.push(next);
        }
      });
    }
    if (!visited.has(targetNode.key)) {
      const reachable = this.walkGraph(nodes, edges, abilities);
      const nearest = this.findNearestNode(nodes, reachable, target.tx, target.ty);
      return {
        status: 'fail',
        reason: 'target unreachable',
        detail: this.diagnoseFailure(nearest, target, abilities),
        path: []
      };
    }
    const path = [];
    let current = targetNode.key;
    while (current) {
      const node = nodes.get(current);
      if (node) path.push(node);
      current = prev.get(current);
    }
    path.reverse();
    return { status: 'pass', path };
  }

  collectNodes(abilities) {
    const nodes = new Map();
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        if (this.world.isSolid(x, y, abilities)) continue;
        if (!this.world.isSolid(x, y + 1, abilities)) continue;
        this.addNode(nodes, x, y, 'floor');
      }
    }
    this.world.savePoints.forEach((save) => {
      const node = this.nodeFromWorld(save.x, save.y);
      this.addNode(nodes, node.tx, node.ty, 'save');
    });
    this.world.shops.forEach((shop) => {
      const node = this.nodeFromWorld(shop.x, shop.y);
      this.addNode(nodes, node.tx, node.ty, 'shop');
    });
    this.world.abilityPickups.forEach((pickup) => {
      const node = this.nodeFromWorld(pickup.x, pickup.y);
      this.addNode(nodes, node.tx, node.ty, 'ability');
    });
    this.world.healthUpgrades.forEach((upgrade) => {
      const node = this.nodeFromWorld(upgrade.x, upgrade.y);
      this.addNode(nodes, node.tx, node.ty, 'vitality');
    });
    this.world.anchors.forEach((anchor) => {
      const node = this.nodeFromWorld(anchor.x, anchor.y);
      this.addNode(nodes, node.tx, node.ty, 'anchor');
    });
    if (this.world.bossGate) {
      const node = this.nodeFromWorld(this.world.bossGate.x, this.world.bossGate.y);
      this.addNode(nodes, node.tx, node.ty, 'boss');
    }
    return nodes;
  }

  addNode(nodes, tx, ty, type) {
    const key = `${tx},${ty}`;
    if (!nodes.has(key)) {
      nodes.set(key, { tx, ty, type, key });
    }
  }

  buildEdges(nodes, abilities) {
    const edges = new Map();
    const profile = this.getMovementProfile(abilities);
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
      for (let dx = -profile.maxJumpDistance; dx <= profile.maxJumpDistance; dx += 1) {
        for (let dy = -profile.maxJumpHeight; dy <= profile.maxDropDistance; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const tx = node.tx + dx;
          const ty = node.ty + dy;
          if (!nodes.has(`${tx},${ty}`)) continue;
          if (!this.clearTrajectory(node.tx, node.ty, tx, ty, abilities)) continue;
          if (!this.canReachDelta(dx, dy, profile)) continue;
          list.push(`${tx},${ty}`);
        }
      }
      for (let dx = -profile.dashDistance; dx <= profile.dashDistance; dx += 1) {
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

  canReachDelta(dx, dy, profile) {
    if (dy < -profile.maxJumpHeight || dy > profile.maxDropDistance) return false;
    if (Math.abs(dx) > profile.maxJumpDistance) return false;
    if (dy < 0) {
      return this.simulateArc(dx, dy, profile, false) || this.simulateArc(dx, dy, profile, true);
    }
    return true;
  }

  simulateArc(dx, dy, profile, useDash) {
    const targetX = dx * this.world.tileSize;
    const targetY = dy * this.world.tileSize;
    const dir = Math.sign(dx) || 1;
    let x = 0;
    let y = 0;
    let vx = profile.speed * dir;
    let vy = dy < 0 ? -profile.jumpPower : 0;
    let dashTimer = 0;
    const dashStart = 0.1;
    const dt = 1 / 60;
    for (let t = 0; t < 1.2; t += dt) {
      if (useDash && Math.abs(dx) > 1 && t >= dashStart && dashTimer <= 0) {
        dashTimer = MOVEMENT_MODEL.dashDuration;
        vx = dir * MOVEMENT_MODEL.dashSpeed;
      }
      if (dashTimer > 0) {
        dashTimer -= dt;
      } else {
        vy += MOVEMENT_MODEL.gravity * dt;
      }
      x += vx * dt;
      y += vy * dt;
      if (Math.abs(x - targetX) < this.world.tileSize * 0.6 && Math.abs(y - targetY) < this.world.tileSize * 0.6) {
        return true;
      }
      if (y > targetY + this.world.tileSize * 2 && dy > 0) {
        return true;
      }
    }
    return false;
  }

  getMovementProfile(abilities) {
    const jumpHeight = getJumpHeight(this.player.jumpPower || MOVEMENT_MODEL.baseJumpPower);
    const maxJumpHeight = Math.max(2, Math.ceil(jumpHeight / this.world.tileSize));
    const maxJumpDistance = Math.max(3, Math.ceil((this.player.speed * 0.45) / this.world.tileSize));
    const maxDropDistance = 6;
    const dashDistance = Math.max(3, Math.ceil(getDashDistance() / this.world.tileSize));
    return {
      maxJumpHeight: abilities.magboots ? maxJumpHeight + 1 : maxJumpHeight + (abilities.anchor ? 1 : 0),
      maxJumpDistance,
      maxDropDistance,
      dashDistance,
      speed: this.player.speed || MOVEMENT_MODEL.baseSpeed,
      jumpPower: this.player.jumpPower || MOVEMENT_MODEL.baseJumpPower
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

  walkGraph(nodes, edges, abilities) {
    const spawn = this.nodeFromWorld(this.player.x, this.player.y);
    let startKey = `${spawn.tx},${spawn.ty}`;
    if (!nodes.has(startKey)) {
      startKey = this.findNearestNode(nodes, null, spawn.tx, spawn.ty)?.key || null;
    }
    const visited = new Set();
    const queue = startKey ? [startKey] : [];
    while (queue.length) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      visited.add(key);
      const edgesFrom = edges.get(key) || [];
      edgesFrom.forEach((next) => {
        if (!visited.has(next)) queue.push(next);
      });
    }
    return visited;
  }

  nodeFromWorld(x, y) {
    const tx = Math.floor(x / this.world.tileSize);
    const ty = Math.floor(y / this.world.tileSize);
    return { tx, ty };
  }

  findNearestNode(nodes, reachableSet, tx, ty) {
    let best = null;
    nodes.forEach((node, key) => {
      if (reachableSet && !reachableSet.has(key)) return;
      const dist = Math.abs(node.tx - tx) + Math.abs(node.ty - ty);
      if (!best || dist < best.dist) {
        best = { ...node, dist, key };
      }
    });
    return best;
  }

  diagnoseFailure(nearest, target, abilities) {
    const tile = this.world.getTile(target.tx, target.ty);
    if (!nearest) return { constraint: 'no reachable nodes', suggestion: 'layout' };
    const dx = Math.abs(target.tx - nearest.tx);
    const dy = target.ty - nearest.ty;
    const profile = this.getMovementProfile(abilities);
    if (dy < -profile.maxJumpHeight) {
      return { constraint: 'jump height too high', suggestion: 'layout or physics constants' };
    }
    if (dy > profile.maxDropDistance) {
      return { constraint: 'drop too far', suggestion: 'layout' };
    }
    if (dx > profile.maxJumpDistance) {
      return { constraint: 'gap too wide', suggestion: 'layout or physics constants' };
    }
    return { constraint: 'blocked trajectory', suggestion: 'layout' };
  }
}
