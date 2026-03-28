export default class CompanionPathExecutor {
  constructor() {
    this.clear();
  }

  clear() {
    this.edges = [];
    this.edgeIndex = 0;
    this.edgeElapsed = 0;
    this.jumpIssued = false;
    this.doubleJumpIssued = false;
  }

  setPath(edges = []) {
    this.edges = Array.isArray(edges) ? [...edges] : [];
    this.edgeIndex = 0;
    this.edgeElapsed = 0;
    this.jumpIssued = false;
    this.doubleJumpIssued = false;
  }

  hasPath() {
    return this.edgeIndex < this.edges.length;
  }

  update(bot, dt, graph) {
    if (!this.hasPath()) {
      return { done: true, failed: false, target: null, actionHint: null };
    }
    const edge = this.edges[this.edgeIndex];
    const targetNode = graph?.nodes?.get(edge.to);
    if (!targetNode) {
      this.clear();
      return { done: true, failed: true, target: null, actionHint: null };
    }

    this.edgeElapsed += dt;
    const target = { x: targetNode.x, y: targetNode.y };
    const actionHint = {
      type: edge.action,
      jump: edge.metadata?.jump && !this.jumpIssued && this.edgeElapsed <= 0.12,
      doubleJump: edge.metadata?.doubleJump && !this.doubleJumpIssued && this.edgeElapsed >= 0.2,
      dir: edge.metadata?.dir || 0
    };

    if (actionHint.jump) {
      this.jumpIssued = true;
    }
    if (actionHint.doubleJump) {
      this.doubleJumpIssued = true;
    }

    const reached = Math.hypot(bot.x - target.x, bot.y - target.y) < 14 && bot.onGround;
    const timeout = this.edgeElapsed > (edge.maxTime || 1.1) + 0.5;
    if (reached) {
      this.edgeIndex += 1;
      this.edgeElapsed = 0;
      this.jumpIssued = false;
      this.doubleJumpIssued = false;
      return { done: !this.hasPath(), failed: false, target, actionHint };
    }
    if (timeout) {
      return { done: false, failed: true, target, actionHint };
    }
    return { done: false, failed: false, target, actionHint };
  }
}
