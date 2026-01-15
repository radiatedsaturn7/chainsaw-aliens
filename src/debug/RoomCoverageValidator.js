export default class RoomCoverageValidator {
  constructor(world, player, feasibilityValidator) {
    this.world = world;
    this.player = player;
    this.validator = feasibilityValidator;
    this.status = 'idle';
    this.lines = [];
    this.roomStatus = new Map();
    this.showOverlay = false;
  }

  toggleOverlay() {
    this.showOverlay = !this.showOverlay;
  }

  run(abilities) {
    this.lines = [];
    this.roomStatus.clear();
    this.status = 'pass';
    const nodes = this.validator.collectNodes(abilities);
    const edges = this.validator.buildEdges(nodes, abilities);
    const reachable = this.validator.walkGraph(nodes, edges, abilities);

    this.world.regions.forEach((region) => {
      const [rx, ry, rw, rh] = region.rect;
      const candidates = Array.from(nodes.values()).filter((node) => {
        return node.tx >= rx && node.tx <= rx + rw && node.ty >= ry && node.ty <= ry + rh;
      });
      if (candidates.length === 0) {
        this.status = 'fail';
        this.roomStatus.set(region.id, { reachable: false });
        this.lines.push(`✗ ${region.name}: no standable tiles in region.`);
        return;
      }
      const reachableNodes = candidates.filter((node) => reachable.has(`${node.tx},${node.ty}`));
      if (reachableNodes.length === 0) {
        this.status = 'fail';
        this.roomStatus.set(region.id, { reachable: false });
        const target = this.pickRepresentative(candidates, region);
        const nearest = this.validator.findNearestNode(nodes, reachable, target.tx, target.ty);
        const detail = this.validator.diagnoseFailure(nearest, target, abilities);
        this.lines.push(`✗ ${region.name} unreachable.`);
        this.lines.push(`  Blocked near ${nearest ? `${nearest.tx},${nearest.ty}` : 'unknown'}.`);
        if (detail.constraint) {
          this.lines.push(`  Cause: ${detail.constraint}.`);
        }
        if (detail.suggestion) {
          this.lines.push(`  Fix: ${detail.suggestion}.`);
        }
      } else {
        this.roomStatus.set(region.id, { reachable: true });
        this.lines.push(`✓ ${region.name} reachable.`);
      }
    });

    if (this.status === 'pass') {
      this.lines.push('✓ Room coverage pass.');
    }

    return { status: this.status, lines: this.lines, roomStatus: this.roomStatus };
  }

  pickRepresentative(candidates, region) {
    const [rx, ry, rw, rh] = region.rect;
    const center = { tx: Math.floor(rx + rw / 2), ty: Math.floor(ry + rh / 2) };
    let best = candidates[0];
    let bestDist = Infinity;
    candidates.forEach((node) => {
      const dist = Math.abs(node.tx - center.tx) + Math.abs(node.ty - center.ty);
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    });
    return best;
  }

  drawWorld(ctx) {
    if (!this.showOverlay) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    this.world.regions.forEach((region) => {
      const [rx, ry, rw, rh] = region.rect;
      const reachable = this.roomStatus.get(region.id)?.reachable;
      ctx.strokeStyle = reachable ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.setLineDash(reachable ? [] : [6, 4]);
      ctx.strokeRect(rx * this.world.tileSize, ry * this.world.tileSize, rw * this.world.tileSize, rh * this.world.tileSize);
    });
    ctx.restore();
  }
}
