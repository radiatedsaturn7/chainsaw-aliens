export default class Minimap {
  constructor(world) {
    this.world = world;
    this.explored = new Set();
    this.exploredRooms = new Set();
    this.scale = 2;
    this.showLegend = false;
  }

  update(player) {
    const tileX = Math.floor(player.x / this.world.tileSize);
    const tileY = Math.floor(player.y / this.world.tileSize);
    this.explored.add(`${tileX},${tileY}`);
    const roomIndex = this.world.roomAtTile?.(tileX, tileY);
    if (roomIndex !== null && roomIndex !== undefined && !this.exploredRooms.has(roomIndex)) {
      const room = this.world.getRoomBounds?.(roomIndex);
      if (room) {
        for (let y = room.minY; y <= room.maxY; y += 1) {
          for (let x = room.minX; x <= room.maxX; x += 1) {
            const tile = this.world.getTile(x, y);
            if (!this.isRoomTile(tile)) continue;
            this.explored.add(`${x},${y}`);
          }
        }
        this.exploredRooms.add(roomIndex);
      }
    }
  }

  draw(ctx, x, y, width, height, player, options = {}) {
    const tileW = this.world.width;
    const tileH = this.world.height;
    const pixel = Math.min(width / tileW, height / tileH);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(0, 0, tileW * pixel, tileH * pixel);
    for (let ty = 0; ty < tileH; ty += 1) {
      for (let tx = 0; tx < tileW; tx += 1) {
        if (this.explored.has(`${tx},${ty}`)) {
          ctx.fillStyle = this.getTileColor(tx, ty) || '#fff';
          ctx.fillRect(tx * pixel, ty * pixel, pixel, pixel);
        }
      }
    }
    this.drawIcon(ctx, player.x, player.y, pixel, 'rgba(255,255,255,0.9)');
    if (options.objective) {
      this.drawIcon(ctx, options.objective.x, options.objective.y, pixel, 'rgba(255,255,255,0.8)', true);
    }
    this.world.savePoints.forEach((save) => this.drawIcon(ctx, save.x, save.y, pixel, 'rgba(255,255,255,0.6)'));
    this.world.shops.forEach((shop) => this.drawIcon(ctx, shop.x, shop.y, pixel, 'rgba(255,255,255,0.6)'));
    this.world.abilityPickups.forEach((pickup) => {
      if (!pickup.collected) this.drawIcon(ctx, pickup.x, pickup.y, pixel, 'rgba(255,255,255,0.7)');
    });
    this.world.healthUpgrades.forEach((upgrade) => {
      if (!upgrade.collected) this.drawIcon(ctx, upgrade.x, upgrade.y, pixel, 'rgba(255,255,255,0.7)');
    });
    if (this.world.bossGate) this.drawIcon(ctx, this.world.bossGate.x, this.world.bossGate.y, pixel, 'rgba(255,255,255,0.7)');
    ctx.restore();

    if (options.showLegend) {
      this.drawLegend(ctx, x + width + 12, y);
    }
  }

  isRoomTile(tile) {
    const blockers = new Set(['#', '^', 'v', 'B', 'W', 'X', 'C', 'U', 'I', '<', '>']);
    return tile && tile !== 'D' && !blockers.has(tile);
  }

  getTileColor(tileX, tileY) {
    const tile = this.world.getTile(tileX, tileY);
    if (tile === '~') return '#4aa3ff';
    if (tile === 'L') return '#ff7a3c';
    if (tile === 'A') return '#39d98a';
    if (tile === '*') return '#ff4b4b';
    if (tile === 'I') return '#9ad9ff';
    if (tile === '<' || tile === '>') return '#bfbfbf';
    if (tile === '=') return '#f3f3f3';
    if (tile === '#') return '#6b6b6b';
    return '#ffffff';
  }

  drawIcon(ctx, worldX, worldY, pixel, color, pulse = false) {
    const tileX = Math.floor(worldX / this.world.tileSize);
    const tileY = Math.floor(worldY / this.world.tileSize);
    ctx.save();
    ctx.fillStyle = color;
    const size = pulse ? pixel * 2 : pixel * 1.4;
    ctx.fillRect(tileX * pixel - size / 2, tileY * pixel - size / 2, size, size);
    ctx.restore();
  }

  drawLegend(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, 140, 140);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, 140, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Courier New';
    const items = [
      ['◎', 'Player'],
      ['◈', 'Objective'],
      ['⬡', 'Ability'],
      ['✚', 'Vitality'],
      ['⬟', 'Save'],
      ['▵', 'Shop'],
      ['W/X/C/U', 'Obstacles'],
      ['T', 'Switch'],
      ['B', 'Rift Seal']
    ];
    items.forEach((item, index) => {
      ctx.fillText(`${item[0]} ${item[1]}`, x + 8, y + 18 + index * 14);
    });
    ctx.restore();
  }

}
