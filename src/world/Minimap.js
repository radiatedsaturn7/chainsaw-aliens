export default class Minimap {
  constructor(world) {
    this.world = world;
    this.explored = new Set();
    this.exploredRooms = new Set();
    this.scale = 2;
    this.showLegend = false;
    this.doorClusters = null;
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
    this.drawRooms(ctx, pixel);
    this.drawDoors(ctx, pixel);
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

  drawRooms(ctx, pixel) {
    this.world.rooms.forEach((room, index) => {
      if (!this.exploredRooms.has(index)) return;
      const width = (room.maxX - room.minX + 1) * pixel;
      const height = (room.maxY - room.minY + 1) * pixel;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(room.minX * pixel, room.minY * pixel, width, height);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(room.minX * pixel + 0.5, room.minY * pixel + 0.5, width - 1, height - 1);
    });
  }

  drawDoors(ctx, pixel) {
    const clusters = this.getDoorClusters();
    clusters.forEach((cluster) => {
      const shouldShow = cluster.rooms.some((roomIndex) => this.exploredRooms.has(roomIndex));
      if (!shouldShow) return;
      ctx.fillStyle = '#9ad9ff';
      cluster.tiles.forEach((tile) => {
        ctx.fillRect(tile.x * pixel, tile.y * pixel, pixel, pixel);
      });
    });
  }

  getDoorClusters() {
    if (this.doorClusters) return this.doorClusters;
    const clusters = [];
    const visited = new Set();
    const { width, height } = this.world;
    const keyFor = (x, y) => `${x},${y}`;
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (this.world.getTile(x, y) !== 'D') continue;
        const key = keyFor(x, y);
        if (visited.has(key)) continue;
        const queue = [{ x, y }];
        const tiles = [];
        const rooms = new Set();
        visited.add(key);
        while (queue.length) {
          const current = queue.shift();
          tiles.push({ x: current.x, y: current.y });
          directions.forEach(([dx, dy]) => {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
            const roomIndex = this.world.roomAtTile?.(nx, ny);
            if (roomIndex !== null && roomIndex !== undefined) {
              rooms.add(roomIndex);
            }
            if (this.world.getTile(nx, ny) !== 'D') return;
            const nextKey = keyFor(nx, ny);
            if (visited.has(nextKey)) return;
            visited.add(nextKey);
            queue.push({ x: nx, y: ny });
          });
        }
        if (rooms.size) {
          clusters.push({ tiles, rooms: Array.from(rooms) });
        }
      }
    }
    this.doorClusters = clusters;
    return clusters;
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
