const EPSILON = 0.5;

export default class PlayabilityLayer {
  constructor(world, player, validator) {
    this.world = world;
    this.player = player;
    this.validator = validator;
    this.active = false;
    this.logs = [];
    this.maxLogs = 12;
    this.status = 'ok';
    this.checkTimer = 0;
    this.overlapFrames = new Map();
    this.overlapHighlights = [];
    this.seenEntities = new Set();
    this.lastDamageTime = 0;
    this.lastCombatTime = 0;
    this.combatIssueLogged = false;
    this.spawnIssueLogged = new Set();
    this.regionExitLogged = new Set();
    this.statusTimer = 0;
  }

  toggle() {
    this.active = !this.active;
  }

  recordEnemyHit(time) {
    this.lastDamageTime = time;
  }

  update(dt, game) {
    const now = game.clock;
    if (!this.active && !game.testHarness?.active && !game.playtestActive && game.state !== 'editor') {
      return;
    }
    if (this.active) {
      this.runChecks(game, now);
    } else {
      this.checkTimer -= dt;
      if (this.checkTimer <= 0) {
        this.runChecks(game, now);
        this.checkTimer = 0.6;
      }
    }
    this.statusTimer = Math.max(0, this.statusTimer - dt);
  }

  runChecks(game, now) {
    this.status = 'ok';
    this.overlapHighlights = [];
    this.checkCollisionIntegrity(game);
    this.checkSpawns(game);
    this.checkRecovery(game);
    this.checkCombatLock(game, now);
    this.checkSpawnCaps(game);
    this.checkRegionExits(game);
    this.checkActionFeedback(game, now);
  }

  checkCollisionIntegrity(game) {
    const current = new Set();
    const entities = [this.player, ...game.enemies.filter((enemy) => !enemy.dead && enemy.solid)];
    entities.forEach((entity, index) => {
      const id = entity === this.player ? 'player' : `${entity.type}-${entity.id}`;
      const overlaps = this.findOverlaps(entity.rect, game.abilities);
      overlaps.forEach(({ tx, ty }) => {
        this.overlapHighlights.push({ tx, ty });
        const key = `${id}:${tx},${ty}`;
        current.add(key);
        const count = (this.overlapFrames.get(key) || 0) + 1;
        this.overlapFrames.set(key, count);
        if (count >= 3) {
          this.fail(`Collision overlap ${id} with solid tile ${tx},${ty}`);
        }
      });
    });
    this.overlapFrames.forEach((value, key) => {
      if (!current.has(key)) {
        this.overlapFrames.delete(key);
      }
    });
  }

  checkSpawns(game) {
    const entities = [this.player, ...game.enemies];
    const nodes = this.validator.collectNodes(game.abilities);
    const edges = this.validator.buildEdges(nodes, game.abilities);
    const reachable = this.validator.walkGraph(nodes, edges, game.abilities);
    entities.forEach((entity, index) => {
      if (this.seenEntities.has(entity)) return;
      this.seenEntities.add(entity);
      const id = entity === this.player ? 'player' : `${entity.type}-${entity.id}`;
      const tile = this.worldToTile(entity.x, entity.y);
      if (this.world.isSolid(tile.tx, tile.ty, game.abilities)) {
        this.fail(`Spawn inside solid tile (${tile.tx},${tile.ty}) for ${id}`);
      }
      const key = `${tile.tx},${tile.ty}`;
      if (!reachable.has(key)) {
        const logKey = `${id}:${tile.tx},${tile.ty}`;
        if (!this.spawnIssueLogged.has(logKey)) {
          this.spawnIssueLogged.add(logKey);
          this.warn(`Spawn sealed from reachable space for ${id} at ${tile.tx},${tile.ty}`);
        }
      }
    });
  }

  checkRecovery(game) {
    const nodes = this.validator.collectNodes(game.abilities);
    const edges = this.validator.buildEdges(nodes, game.abilities);
    const reachable = this.validator.walkGraph(nodes, edges, game.abilities);
    const playerTile = this.worldToTile(game.player.x, game.player.y);
    const saves = this.world.savePoints.map((save) => this.worldToTile(save.x, save.y));
    const safeNode = saves.find((save) => reachable.has(`${save.tx},${save.ty}`) && this.tileDistance(save, playerTile) < 18);
    if (!safeNode) {
      this.warn('No nearby recovery point reachable within 18 tiles');
    }
  }

  checkCombatLock(game, now) {
    const combatEnemies = game.enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) < 140);
    if (combatEnemies.length) {
      this.lastCombatTime = now;
      const timeSinceDamage = now - this.lastDamageTime;
      const canPierce = game.player.equippedUpgrades.some((upgrade) => upgrade.tags?.includes('pierce'));
      const killable = combatEnemies.some((enemy) => enemy.type !== 'bulwark' || enemy.isOpen?.() || canPierce);
      if (!killable) {
        this.warn('No killable enemy types in combat range with current kit');
      }
      if (timeSinceDamage > 6) {
        const types = new Set(combatEnemies.map((enemy) => enemy.type));
        this.warn(`No enemy damage for ${timeSinceDamage.toFixed(1)}s near: ${Array.from(types).join(', ')}`);
        this.combatIssueLogged = true;
      }
    } else if (now - this.lastCombatTime > 3) {
      this.combatIssueLogged = false;
    }
  }

  checkSpawnCaps(game) {
    const activeEnemies = game.enemies.filter((enemy) => !enemy.dead);
    if (activeEnemies.length > game.spawnRules.globalMax) {
      this.fail(`Global enemy cap exceeded (${activeEnemies.length}/${game.spawnRules.globalMax})`);
    }
    const regionCounts = new Map();
    activeEnemies.forEach((enemy) => {
      const regionId = this.world.regionAt(enemy.x, enemy.y).id;
      regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + 1);
    });
    regionCounts.forEach((count, regionId) => {
      if (count > game.spawnRules.perRegion) {
        this.warn(`Region ${regionId} exceeds cap (${count}/${game.spawnRules.perRegion})`);
      }
    });
  }

  checkRegionExits(game) {
    game.world.regions.forEach((region) => {
      if (this.regionExitLogged.has(region.id)) return;
      const [rx, ry, rw, rh] = region.rect;
      let exits = 0;
      for (let x = rx; x <= rx + rw; x += 1) {
        if (!this.world.isSolid(x, ry, game.abilities) && !this.world.isSolid(x, ry - 1, game.abilities)) exits += 1;
        if (!this.world.isSolid(x, ry + rh, game.abilities) && !this.world.isSolid(x, ry + rh + 1, game.abilities)) exits += 1;
      }
      for (let y = ry; y <= ry + rh; y += 1) {
        if (!this.world.isSolid(rx, y, game.abilities) && !this.world.isSolid(rx - 1, y, game.abilities)) exits += 1;
        if (!this.world.isSolid(rx + rw, y, game.abilities) && !this.world.isSolid(rx + rw + 1, y, game.abilities)) exits += 1;
      }
      if (exits === 0) {
        this.regionExitLogged.add(region.id);
        this.warn(`Region ${region.name} has no obvious exit on perimeter`);
      }
    });
  }

  checkActionFeedback(game, now) {
    if (!game.testHarness.active) return;
    const results = game.actionFeedback.summary(now);
    const missing = results.filter((result) => result.status === 'fail').map((result) => result.action);
    const partial = results.filter((result) => result.status === 'warn').map((result) => result.action);
    if (missing.length) {
      this.fail(`Action feedback missing: ${missing.join(', ')}`);
    } else if (partial.length) {
      this.warn(`Action feedback incomplete: ${partial.join(', ')}`);
    }
  }

  findOverlaps(rect, abilities) {
    const tileSize = this.world.tileSize;
    const startX = Math.floor((rect.x + EPSILON) / tileSize);
    const endX = Math.floor((rect.x + rect.w - EPSILON) / tileSize);
    const startY = Math.floor((rect.y + EPSILON) / tileSize);
    const endY = Math.floor((rect.y + rect.h - EPSILON) / tileSize);
    const overlaps = [];
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.world.isSolid(tx, ty, abilities)) {
          overlaps.push({ tx, ty });
        }
      }
    }
    return overlaps;
  }

  worldToTile(x, y) {
    return {
      tx: Math.floor(x / this.world.tileSize),
      ty: Math.floor(y / this.world.tileSize)
    };
  }

  tileDistance(a, b) {
    return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
  }

  fail(message) {
    this.status = 'fail';
    this.pushLog('FAIL', message);
  }

  warn(message) {
    if (this.status !== 'fail') {
      this.status = 'warn';
    }
    this.pushLog('WARN', message);
  }

  pushLog(level, message) {
    const entry = `${level}: ${message}`;
    if (this.logs[this.logs.length - 1] === entry) return;
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.log(`[Playability] ${entry}`);
    this.statusTimer = 3;
  }

  drawWorld(ctx, game) {
    if (!this.active) return;
    const tileSize = this.world.tileSize;
    const startX = Math.max(0, Math.floor(game.camera.x / tileSize) - 1);
    const startY = Math.max(0, Math.floor(game.camera.y / tileSize) - 1);
    const endX = Math.min(this.world.width, Math.ceil((game.camera.x + game.canvas.width) / tileSize) + 1);
    const endY = Math.min(this.world.height, Math.ceil((game.camera.y + game.canvas.height) / tileSize) + 1);
    ctx.save();
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        if (this.world.isSolid(x, y, game.abilities)) {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(this.player.rect.x, this.player.rect.y, this.player.rect.w, this.player.rect.h);
    game.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      ctx.strokeRect(enemy.rect.x, enemy.rect.y, enemy.rect.w, enemy.rect.h);
    });
    this.overlapHighlights.forEach(({ tx, ty }) => {
      ctx.strokeStyle = 'rgba(255,0,0,0.8)';
      ctx.strokeRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
    });
    ctx.restore();
  }

  drawScreen(ctx, width, height) {
    if (!this.active && this.statusTimer <= 0) return;
    const boxWidth = 360;
    const boxHeight = 180;
    ctx.save();
    ctx.globalAlpha = this.active ? 0.9 : 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(20, 20, boxWidth, boxHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 20, boxWidth, boxHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`PLAYABILITY: ${this.status.toUpperCase()}`, 32, 42);
    const lines = this.logs.slice(-8);
    lines.forEach((line, index) => {
      ctx.fillText(line, 32, 62 + index * 14);
    });
    ctx.restore();
  }
}
