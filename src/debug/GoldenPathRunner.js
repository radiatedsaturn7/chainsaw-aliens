const DEFAULT_SPEED = 1.6;

function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export default class GoldenPathRunner {
  constructor() {
    this.data = null;
    this.active = false;
    this.freeze = false;
    this.status = 'idle';
    this.stageIndex = 0;
    this.path = [];
    this.pathIndex = 0;
    this.lastStable = null;
    this.failReport = null;
    this.failMarker = null;
    this.simSpeed = DEFAULT_SPEED;
    this.originalRandom = Math.random;
    this.attackTimer = 0;
    this.jumpCooldown = 0;
    this.interactCooldown = 0;
    this.throwCooldown = 0;
    this.flameToggleCooldown = 0;
    this.damageTaken = 0;
    this.lastHealth = 0;
    this.lastDistance = null;
    this.stuckTimer = 0;
  }

  async load() {
    try {
      const response = await fetch('./src/content/criticalPath.json');
      if (!response.ok) return;
      this.data = await response.json();
      if (this.data.simSpeed) {
        this.simSpeed = this.data.simSpeed;
      }
    } catch (error) {
      this.data = null;
    }
  }

  start(game) {
    if (!this.data) return;
    this.active = true;
    this.freeze = false;
    this.status = 'running';
    this.stageIndex = 0;
    this.path = [];
    this.pathIndex = 0;
    this.lastStable = { x: game.player.x, y: game.player.y };
    this.failReport = null;
    this.failMarker = null;
    this.attackTimer = 0;
    this.jumpCooldown = 0;
    this.interactCooldown = 0;
    this.throwCooldown = 0;
    this.flameToggleCooldown = 0;
    this.damageTaken = 0;
    this.lastHealth = game.player.health;
    this.lastDistance = null;
    this.stuckTimer = 0;
    this.applySeed();
  }

  stop(game) {
    this.active = false;
    this.freeze = false;
    this.status = 'idle';
    this.restoreSeed();
    if (game?.input) {
      game.input.clearVirtual();
    }
    if (game?.testResults) {
      game.testResults.golden = 'idle';
      game.testDashboard?.setResults({ golden: 'idle' });
    }
  }

  applySeed() {
    if (!this.data?.seed) return;
    const rng = createSeededRandom(this.data.seed);
    Math.random = rng;
  }

  restoreSeed() {
    Math.random = this.originalRandom;
  }

  getTimeScale() {
    return this.active ? this.simSpeed : 1;
  }

  preUpdate(dt, game) {
    if (!this.active) return;
    if (this.status !== 'running') {
      game.input.clearVirtual();
      return;
    }
    const milestone = this.currentMilestone();
    if (!milestone) {
      this.pass(game);
      return;
    }
    if (this.isMilestoneComplete(milestone, game)) {
      this.advanceStage(game);
      return;
    }
    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      this.planPath(game, milestone);
    }
    const actions = this.computeActions(dt, game, milestone);
    game.input.setVirtual(actions);
  }

  postUpdate(dt, game) {
    if (!this.active || this.status !== 'running') return;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.interactCooldown = Math.max(0, this.interactCooldown - dt);
    if (game.player.health < this.lastHealth) {
      this.damageTaken += this.lastHealth - game.player.health;
    }
    this.lastHealth = game.player.health;
    const damageBudget = (this.data?.damageBudget ?? 0.7) * game.player.maxHealth;
    if (this.damageTaken > damageBudget) {
      this.fail(game, { constraint: 'damage funnel exceeded budget', suggestion: 'layout or combat balance' });
      return;
    }
    if (game.playability.status === 'fail') {
      const lastLog = game.playability.logs[game.playability.logs.length - 1];
      this.fail(game, {
        constraint: lastLog || 'playability invariant failed',
        suggestion: 'layout or collision integrity'
      });
    }
  }

  currentMilestone() {
    return this.data?.milestones?.[this.stageIndex] || null;
  }

  advanceStage(game) {
    this.stageIndex += 1;
    this.path = [];
    this.pathIndex = 0;
    this.lastDistance = null;
    this.stuckTimer = 0;
    const milestone = this.currentMilestone();
    if (milestone?.type === 'checkpoint') {
      this.damageTaken = 0;
      this.lastHealth = game.player.health;
    }
  }

  planPath(game, milestone) {
    const target = this.resolveTarget(game, milestone);
    if (!target) {
      this.fail(game, { constraint: 'missing target', suggestion: 'objective scripting' });
      return;
    }
    const start = this.toTile(game.player.x, game.player.y, game.world.tileSize);
    const targetTile = this.toTile(target.x, target.y, game.world.tileSize);
    const result = game.feasibilityValidator.planPath(start, targetTile, game.abilities);
    if (result.status !== 'pass') {
      this.fail(game, result.detail || { constraint: result.reason, suggestion: 'layout' });
      return;
    }
    this.path = result.path.map((node) => ({
      x: node.tx * game.world.tileSize + game.world.tileSize / 2,
      y: node.ty * game.world.tileSize + game.world.tileSize / 2
    }));
    this.pathIndex = 0;
  }

  computeActions(dt, game, milestone) {
    const actions = {};
    const player = game.player;
    const target = this.path[this.pathIndex];
    if (!target) return actions;
    this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    this.flameToggleCooldown = Math.max(0, this.flameToggleCooldown - dt);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const closeEnough = distance < 18;
    if (closeEnough) {
      this.lastStable = { x: player.x, y: player.y };
      this.pathIndex = Math.min(this.pathIndex + 1, this.path.length - 1);
    }

    if (this.lastDistance !== null) {
      if (distance > this.lastDistance - 1) {
        this.stuckTimer += dt;
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
      }
      if (this.stuckTimer > 2.5) {
        this.fail(game, { constraint: 'stalled movement', suggestion: 'layout or physics constants' });
      }
    }
    this.lastDistance = distance;

    if (dx < -6) actions.left = true;
    if (dx > 6) actions.right = true;

    const wantsJump = dy < -24 && (player.onGround || player.coyote > 0 || player.onWall !== 0);
    if (wantsJump && this.jumpCooldown <= 0) {
      actions.jump = true;
      this.jumpCooldown = 0.2;
    }

    if (Math.abs(dx) > 80 && player.onGround && player.dashCooldown <= 0) {
      actions.dash = true;
    }

    if (milestone.type === 'checkpoint') {
      const save = this.resolveCheckpoint(game, milestone);
      if (save && Math.hypot(save.x - player.x, save.y - player.y) < 36 && this.interactCooldown <= 0) {
        actions.interact = true;
        this.interactCooldown = 0.4;
      }
    }

    if (milestone.type === 'boss') {
      if (game.boss?.phase === 0 && game.abilities.anchor && this.throwCooldown <= 0) {
        actions.throw = true;
        this.throwCooldown = 0.6;
      }
      if (game.boss?.phase === 1 && game.abilities.flame && !player.flameMode && this.flameToggleCooldown <= 0) {
        actions.flame = true;
        this.flameToggleCooldown = 0.6;
      }
      actions.rev = true;
      if (game.boss?.coreExposed && this.attackTimer <= 0) {
        actions.attack = true;
        this.attackTimer = 0.3;
      }
    }

    return actions;
  }

  isMilestoneComplete(milestone, game) {
    if (milestone.type === 'ability') {
      return Boolean(game.abilities[milestone.ability]);
    }
    if (milestone.type === 'checkpoint') {
      const save = this.resolveCheckpoint(game, milestone);
      return Boolean(save && save.active);
    }
    if (milestone.type === 'bossGate') {
      if (!game.world.bossGate) return true;
      const dist = Math.hypot(game.world.bossGate.x - game.player.x, game.world.bossGate.y - game.player.y);
      return dist < 40;
    }
    if (milestone.type === 'boss') {
      return Boolean(game.boss && game.boss.dead);
    }
    return false;
  }

  resolveTarget(game, milestone) {
    if (milestone.type === 'ability') {
      return game.world.abilityPickups.find((pickup) => pickup.ability === milestone.ability && !pickup.collected) ||
        game.world.abilityPickups.find((pickup) => pickup.ability === milestone.ability) ||
        null;
    }
    if (milestone.type === 'checkpoint') {
      return this.resolveCheckpoint(game, milestone);
    }
    if (milestone.type === 'bossGate') {
      return game.world.bossGate || game.boss;
    }
    if (milestone.type === 'boss') {
      return game.boss;
    }
    return null;
  }

  resolveCheckpoint(game, milestone) {
    return game.world.savePoints.find((save) => save.id === milestone.checkpointId) || null;
  }

  fail(game, detail) {
    if (this.status === 'fail') return;
    const milestone = this.currentMilestone();
    const region = game.world.regionAt(game.player.x, game.player.y);
    this.status = 'fail';
    this.freeze = true;
    this.failMarker = { x: game.player.x, y: game.player.y };
    this.failReport = {
      stage: milestone?.id || 'unknown',
      target: milestone?.label || 'unknown',
      region: region.name,
      lastStable: this.lastStable,
      constraint: detail.constraint || 'unknown constraint',
      suggestion: detail.suggestion || 'layout'
    };
    console.log('Golden Path FAIL', this.failReport);
    game.input.clearVirtual();
    game.simulationActive = false;
    if (game?.testResults) {
      game.testResults.golden = 'fail';
      game.testDashboard?.setResults({ golden: 'fail' });
    }
  }

  pass(game) {
    this.status = 'pass';
    this.freeze = false;
    console.log('Golden Path PASS');
    game.input.clearVirtual();
    game.victory = true;
    game.simulationActive = false;
    if (game?.testResults) {
      game.testResults.golden = 'pass';
      game.testDashboard?.setResults({ golden: 'pass' });
    }
  }

  toTile(x, y, tileSize) {
    return {
      tx: Math.floor(x / tileSize),
      ty: Math.floor(y / tileSize)
    };
  }

  draw(ctx, width, height, game) {
    if (!this.data) return;
    if (this.failMarker) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.failMarker.x - 12, this.failMarker.y - 12);
      ctx.lineTo(this.failMarker.x + 12, this.failMarker.y + 12);
      ctx.moveTo(this.failMarker.x + 12, this.failMarker.y - 12);
      ctx.lineTo(this.failMarker.x - 12, this.failMarker.y + 12);
      ctx.stroke();
      ctx.restore();
    }

    if (this.failReport) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(20, height - 180, 420, 160);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(20, height - 180, 420, 160);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText('GOLDEN PATH FAILURE', 32, height - 160);
      ctx.fillText(`Stage: ${this.failReport.stage}`, 32, height - 140);
      ctx.fillText(`Target: ${this.failReport.target}`, 32, height - 124);
      ctx.fillText(`Region: ${this.failReport.region}`, 32, height - 108);
      if (this.failReport.lastStable) {
        ctx.fillText(
          `Last stable: ${this.failReport.lastStable.x.toFixed(1)},${this.failReport.lastStable.y.toFixed(1)}`,
          32,
          height - 92
        );
      }
      ctx.fillText(`Constraint: ${this.failReport.constraint}`, 32, height - 76);
      ctx.fillText(`Suggested fix: ${this.failReport.suggestion}`, 32, height - 60);
      ctx.restore();
    }
  }
}
