export default class Minimap {
  constructor(world) {
    this.world = world;
    this.explored = new Set();
    this.scale = 2;
  }

  update(player) {
    const tileX = Math.floor(player.x / this.world.tileSize);
    const tileY = Math.floor(player.y / this.world.tileSize);
    this.explored.add(`${tileX},${tileY}`);
  }

  draw(ctx, x, y, width, height, player) {
    const tileW = this.world.width;
    const tileH = this.world.height;
    const pixel = Math.min(width / tileW, height / tileH);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(0, 0, tileW * pixel, tileH * pixel);
    ctx.fillStyle = '#fff';
    for (let ty = 0; ty < tileH; ty += 1) {
      for (let tx = 0; tx < tileW; tx += 1) {
        if (this.explored.has(`${tx},${ty}`)) {
          ctx.fillRect(tx * pixel, ty * pixel, pixel, pixel);
        }
      }
    }
    const playerTileX = Math.floor(player.x / this.world.tileSize);
    const playerTileY = Math.floor(player.y / this.world.tileSize);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(playerTileX * pixel - pixel, playerTileY * pixel - pixel, pixel * 2, pixel * 2);
    ctx.restore();
  }
}
