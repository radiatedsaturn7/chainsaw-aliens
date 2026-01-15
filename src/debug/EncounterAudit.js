const GROUNDED_TYPES = new Set(['skitter', 'bulwark', 'slicer', 'practice']);

export default class EncounterAudit {
  constructor(world, player, feasibilityValidator) {
    this.world = world;
    this.player = player;
    this.validator = feasibilityValidator;
    this.status = 'idle';
    this.lines = [];
  }

  run(game, abilities) {
    this.lines = [];
    this.status = 'pass';

    const grounded = game.enemies.filter((enemy) => GROUNDED_TYPES.has(enemy.type));
    const groundedOnFloor = grounded.filter((enemy) => {
      const tile = this.toTile(enemy.x, enemy.y);
      return this.world.isSolid(tile.tx, tile.ty + 1, abilities);
    });

    if (groundedOnFloor.length === 0) {
      this.status = 'fail';
      this.lines.push('✗ No grounded enemies occupying floor tiles.');
    } else {
      this.lines.push(`✓ Grounded enemies active: ${groundedOnFloor.length}.`);
    }

    const encounterReport = this.checkEncounters(game, abilities);
    if (encounterReport.status === 'fail') {
      this.status = 'fail';
    }
    this.lines.push(...encounterReport.lines);

    const spawnReport = this.checkSpawnRules(game);
    if (spawnReport.status === 'fail') {
      this.status = 'fail';
    }
    this.lines.push(...spawnReport.lines);

    if (this.status === 'pass') {
      this.lines.push('✓ Encounter audit pass.');
    }

    return { status: this.status, lines: this.lines };
  }

  checkEncounters(game, abilities) {
    const lines = [];
    let status = 'pass';
    const enemiesByRegion = new Map();
    game.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const region = this.world.regionAt(enemy.x, enemy.y).id;
      if (!enemiesByRegion.has(region)) {
        enemiesByRegion.set(region, []);
      }
      enemiesByRegion.get(region).push(enemy);
    });

    enemiesByRegion.forEach((enemies, regionId) => {
      const attackable = enemies.some((enemy) => this.isAttackable(enemy, abilities));
      if (!attackable) {
        status = 'fail';
        lines.push(`✗ Region ${regionId}: no attackable encounters.`);
        lines.push('  Cause: enemies unreachable or out of range.');
      } else {
        lines.push(`✓ Region ${regionId}: attackable encounter found.`);
      }
    });

    if (enemiesByRegion.size === 0) {
      status = 'fail';
      lines.push('✗ No active enemies to audit.');
    }

    return { status, lines };
  }

  isAttackable(enemy, abilities) {
    const enemyTile = this.toTile(enemy.x, enemy.y);
    const playerTile = this.toTile(this.player.x, this.player.y);
    const result = this.validator.planPath(playerTile, enemyTile, abilities);
    if (result.status !== 'pass') return false;
    const last = result.path[result.path.length - 1];
    if (!last) return false;
    const targetX = last.tx * this.world.tileSize + this.world.tileSize / 2;
    const targetY = last.ty * this.world.tileSize + this.world.tileSize / 2;
    const dist = Math.hypot(targetX - enemy.x, targetY - enemy.y);
    return dist <= 60;
  }

  checkSpawnRules(game) {
    const lines = [];
    let status = 'pass';
    const { globalMax, perRegion, cooldown, backoffLowHealth } = game.spawnRules;
    if (globalMax > 16 || perRegion > 6) {
      status = 'fail';
      lines.push('✗ Spawn caps too high.');
    } else {
      lines.push('✓ Spawn caps enforced.');
    }
    if (cooldown <= 0 || backoffLowHealth <= 0) {
      status = 'fail';
      lines.push('✗ Spawn cooldown/backoff invalid.');
    } else {
      lines.push('✓ Spawn cooldown/backoff enforced.');
    }
    return { status, lines };
  }

  toTile(x, y) {
    return {
      tx: Math.floor(x / this.world.tileSize),
      ty: Math.floor(y / this.world.tileSize)
    };
  }
}
