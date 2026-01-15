const DEFAULT_CLEARANCE_TILES = 2;

export default class WorldValidityTest {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.status = 'idle';
    this.lines = [];
    this.report = null;
  }

  run(spawnPoint, abilities, enemies = []) {
    this.lines = [];
    this.status = 'pass';
    const spawnCheck = this.validateSpawn(spawnPoint, abilities);
    const fixes = {};
    if (!spawnCheck.valid) {
      this.status = 'fail';
      this.lines.push(`✗ Spawn invalid: ${spawnCheck.reason}.`);
      const startTile = this.toTile(spawnPoint.x, spawnPoint.y);
      const relocated = this.findNearestStandable(startTile.tx, startTile.ty, abilities);
      if (relocated) {
        fixes.spawnOverride = { tx: relocated.tx, ty: relocated.ty };
        this.lines.push(`  Suggested spawn override: ${relocated.tx},${relocated.ty}.`);
      } else {
        this.lines.push('  No standable fallback found for spawn override.');
      }
    } else {
      this.lines.push('✓ Spawn valid and standable.');
    }

    const enemyCollisions = enemies.filter((enemy) => enemy.solid && this.intersectsSolid(enemy.rect, abilities));
    if (enemyCollisions.length > 0) {
      this.status = 'fail';
      this.lines.push(`✗ ${enemyCollisions.length} solid enemies intersect walls.`);
      enemyCollisions.slice(0, 4).forEach((enemy) => {
        const tile = this.toTile(enemy.x, enemy.y);
        this.lines.push(`  Enemy ${enemy.type} stuck near ${tile.tx},${tile.ty}.`);
      });
      if (enemyCollisions.length > 4) {
        this.lines.push('  Additional enemy collisions omitted.');
      }
    } else {
      this.lines.push('✓ Enemies clear of solids.');
    }

    if (this.status === 'pass') {
      this.lines.push('✓ World validity pass.');
    }

    this.report = { status: this.status, lines: this.lines, fixes };
    return this.report;
  }

  validateSpawn(spawnPoint, abilities) {
    const tile = this.toTile(spawnPoint.x, spawnPoint.y);
    if (!this.isStandable(tile.tx, tile.ty, abilities)) {
      return { valid: false, reason: 'tile not standable' };
    }
    const rect = this.rectFor(spawnPoint.x, spawnPoint.y, this.player.width, this.player.height);
    if (this.intersectsSolid(rect, abilities)) {
      return { valid: false, reason: 'collision at spawn' };
    }
    return { valid: true };
  }

  isStandable(tx, ty, abilities, width = this.player.width, height = this.player.height) {
    if (this.world.isSolid(tx, ty, abilities)) return false;
    if (!this.world.isSolid(tx, ty + 1, abilities)) return false;
    const worldPos = this.toWorld(tx, ty);
    const rect = this.rectFor(worldPos.x, worldPos.y, width, height);
    if (this.intersectsSolid(rect, abilities)) return false;
    const clearance = Math.max(DEFAULT_CLEARANCE_TILES, Math.ceil(height / this.world.tileSize));
    for (let dy = 1; dy <= clearance; dy += 1) {
      if (this.world.isSolid(tx, ty - dy, abilities)) {
        return false;
      }
    }
    return true;
  }

  findNearestStandable(startX, startY, abilities, width = this.player.width, height = this.player.height) {
    const queue = [{ tx: startX, ty: startY }];
    const visited = new Set([`${startX},${startY}`]);
    const maxSteps = this.world.width * this.world.height;
    let steps = 0;
    while (queue.length && steps < maxSteps) {
      const node = queue.shift();
      if (this.isStandable(node.tx, node.ty, abilities, width, height)) {
        return node;
      }
      const neighbors = [
        { tx: node.tx + 1, ty: node.ty },
        { tx: node.tx - 1, ty: node.ty },
        { tx: node.tx, ty: node.ty + 1 },
        { tx: node.tx, ty: node.ty - 1 }
      ];
      neighbors.forEach((next) => {
        const key = `${next.tx},${next.ty}`;
        if (next.tx < 0 || next.ty < 0 || next.tx >= this.world.width || next.ty >= this.world.height) return;
        if (visited.has(key)) return;
        visited.add(key);
        queue.push(next);
      });
      steps += 1;
    }
    return null;
  }

  intersectsSolid(rect, abilities) {
    const tileSize = this.world.tileSize;
    const startX = Math.floor(rect.x / tileSize);
    const endX = Math.floor((rect.x + rect.w) / tileSize);
    const startY = Math.floor(rect.y / tileSize);
    const endY = Math.floor((rect.y + rect.h) / tileSize);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.world.isSolid(tx, ty, abilities)) {
          return true;
        }
      }
    }
    return false;
  }

  rectFor(x, y, width, height) {
    return {
      x: x - width / 2,
      y: y - height / 2,
      w: width,
      h: height
    };
  }

  toTile(x, y) {
    return {
      tx: Math.floor(x / this.world.tileSize),
      ty: Math.floor(y / this.world.tileSize)
    };
  }

  toWorld(tx, ty) {
    return {
      x: tx * this.world.tileSize + this.world.tileSize / 2,
      y: ty * this.world.tileSize + this.world.tileSize / 2
    };
  }
}
