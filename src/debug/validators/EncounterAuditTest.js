const GROUNDED_TYPES = new Set(['skitter', 'bulwark', 'slicer', 'practice', 'spitter', 'hivenode', 'bouncer', 'pouncer', 'coward', 'ranger']);
const AIRBORNE_TYPES = new Set(['floater', 'drifter', 'bobber', 'harrier', 'sentinel', 'finalboss']);

export default class EncounterAuditTest {
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

    const activeEnemies = game.enemies.filter((enemy) => !enemy.dead);
    const grounded = activeEnemies.filter((enemy) => GROUNDED_TYPES.has(enemy.type));
    const airborne = activeEnemies.filter((enemy) => AIRBORNE_TYPES.has(enemy.type));

    if (grounded.length === 0) {
      this.status = 'fail';
      this.lines.push('✗ No grounded enemy archetypes present.');
    } else {
      this.lines.push(`✓ Grounded enemies active: ${grounded.length}.`);
    }

    const groundedOnFloor = grounded.filter((enemy) => {
      const tile = this.toTile(enemy.x, enemy.y);
      return this.world.isSolid(tile.tx, tile.ty + 1, abilities);
    });
    if (grounded.length > 0 && groundedOnFloor.length === 0) {
      this.status = 'fail';
      this.lines.push('✗ Grounded enemies are not anchored to floor tiles.');
    }

    if (airborne.length === 0) {
      this.status = 'fail';
      this.lines.push('✗ No airborne enemy archetypes present.');
    } else {
      this.lines.push(`✓ Airborne enemies active: ${airborne.length}.`);
    }

    const encounterReport = this.checkEncounters(activeEnemies, abilities);
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

  checkEncounters(enemies, abilities) {
    const lines = [];
    let status = 'pass';
    if (enemies.length === 0) {
      return { status: 'fail', lines: ['✗ No active enemies to audit.'] };
    }

    const reachable = [];
    const unreachable = [];
    enemies.forEach((enemy) => {
      if (this.isAttackable(enemy, abilities)) {
        reachable.push(enemy);
      } else {
        unreachable.push(enemy);
      }
    });

    const attackableRatio = reachable.length / enemies.length;
    if (attackableRatio < 0.6) {
      status = 'fail';
      lines.push(`✗ Only ${reachable.length}/${enemies.length} encounters are attackable.`);
      unreachable.slice(0, 4).forEach((enemy) => {
        const tile = this.toTile(enemy.x, enemy.y);
        lines.push(`  Unreachable: ${enemy.type} near ${tile.tx},${tile.ty}.`);
      });
      if (unreachable.length > 4) {
        lines.push('  Additional unreachable encounters omitted.');
      }
    } else {
      lines.push(`✓ Attackable encounters: ${reachable.length}/${enemies.length}.`);
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
