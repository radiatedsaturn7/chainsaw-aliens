import { getDashDistance, getJumpHeight } from '../game/MovementModel.js';

const ABILITY_ORDER = ['grapple', 'phase', 'magboots', 'resonance'];

export default class Validator {
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
      const hint = this.suggestFix(nearest, target, abilities);
      lines.push(`✗ ${label} unreachable`);
      lines.push(`  Stage: ${stageLabel}`);
      if (nearest) {
        lines.push(`  Nearest node: ${nearest.tx},${nearest.ty}`);
      }
      if (hint) {
        lines.push(`  Suggest: ${hint}`);
      }
      status = 'fail';
    };
    Object.entries(objectiveTargets).forEach(([label, target]) => {
      if (!target) return;
      const key = `${target.tx},${target.ty}`;
      if (!reachable.has(key)) {
        failTarget(label, target);
      } else {
        lines.push(`✓ ${label} reachable`);
      }
    });
    return { status, lines, reachable };
  }

  runStaged(objectiveTargets) {
    const summary = [];
    const detail = [];
    let abilities = {
      grapple: false,
      phase: false,
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
      const gateTargets = this.collectGateTargets(ability);
      if (gateTargets.length) {
        const gateStageLabel = `Stage ${index} gates (${ability} unlocked)`;
        const gateStageTargets = {};
        gateTargets.forEach((gate, gateIndex) => {
          gateStageTargets[`gate ${ability} ${gateIndex + 1}`] = gate;
        });
        const gateReport = this.runSingleStage(abilities, gateStageTargets, gateStageLabel);
        summary.push(`${gateReport.status === 'pass' ? '✓' : '✗'} ${gateStageLabel}`);
        detail.push(...gateReport.lines);
      }
    });
    const finalTargets = {};
    if (objectiveTargets.boss) {
      finalTargets['final boss gate'] = objectiveTargets.boss;
    }
    const finalReport = this.runSingleStage(abilities, finalTargets, 'Final Stage');
    summary.push(`${finalReport.status === 'pass' ? '✓' : '✗'} Final Stage`);
    detail.push(...finalReport.lines);
    const status = summary.every((line) => line.startsWith('✓')) ? 'pass' : 'fail';
    return { status, summary, detail };
  }

  collectGateTargets(ability) {
    const gateMap = { grapple: 'G', phase: 'P', magboots: 'M', resonance: 'R' };
    const type = gateMap[ability];
    return this.world.gates
      .filter((gate) => gate.type === type)
      .map((gate) => ({
        x: gate.x,
        y: gate.y,
        tx: Math.floor(gate.x / this.world.tileSize),
        ty: Math.floor(gate.y / this.world.tileSize)
      }));
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
    this.world.anchors.forEach((anchor) => {
      const node = this.nodeFromWorld(anchor.x, anchor.y);
      this.addNode(nodes, node.tx, node.ty, 'anchor');
    });
    this.world.gates.forEach((gate) => {
      const node = this.nodeFromWorld(gate.x, gate.y);
      this.addNode(nodes, node.tx, node.ty, 'gate');
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
      nodes.set(key, { tx, ty, type });
    }
  }

  buildEdges(nodes, abilities) {
    const edges = new Map();
    const { maxJumpHeight, maxJumpDistance, maxDropDistance, dashDistance, grappleRange } = this.getMovementProfile(abilities);
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
      if (abilities.grapple) {
        nodeKeys.forEach((anchorKey) => {
          const anchor = nodes.get(anchorKey);
          if (anchor.type !== 'anchor') return;
          const dist = Math.hypot(anchor.tx - node.tx, anchor.ty - node.ty);
          if (dist <= grappleRange) {
            list.push(anchorKey);
          }
        });
      }
      edges.set(key, list);
    });
    return edges;
  }

  getMovementProfile(abilities) {
    const jumpHeight = getJumpHeight(this.player.jumpPower || 0);
    const maxJumpHeight = Math.max(2, Math.ceil(jumpHeight / this.world.tileSize));
    const maxJumpDistance = Math.max(3, Math.ceil((this.player.speed * 0.45) / this.world.tileSize));
    const maxDropDistance = abilities.phase ? 9 : 6;
    const dashDistance = Math.max(3, Math.ceil(getDashDistance() / this.world.tileSize));
    return {
      maxJumpHeight: abilities.magboots ? maxJumpHeight + 1 : maxJumpHeight,
      maxJumpDistance: abilities.grapple ? maxJumpDistance + 1 : maxJumpDistance,
      maxDropDistance,
      dashDistance,
      grappleRange: abilities.grapple ? 5 : 0
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

  suggestFix(nearest, target, abilities) {
    const tile = this.world.getTile(target.tx, target.ty);
    if (['G', 'P', 'M', 'R'].includes(tile)) {
      return `gate requires ${tile}`;
    }
    if (!nearest) return 'no reachable nodes found';
    const dx = Math.abs(target.tx - nearest.tx);
    const dy = target.ty - nearest.ty;
    const { maxJumpHeight, maxJumpDistance, maxDropDistance } = this.getMovementProfile(abilities);
    if (dy < -maxJumpHeight) return 'jump height too high';
    if (dy > maxDropDistance) return 'drop too far';
    if (dx > maxJumpDistance) return 'gap too wide';
    return 'missing platform or blocked trajectory';
  }
}
