export default class LootDrop {
  constructor(x, y, value = 1) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.vx = (Math.random() - 0.5) * 80;
    this.vy = -120 - Math.random() * 80;
    this.life = 6;
    this.pulse = 0;
    this.collected = false;
  }

  update(dt, world, abilities) {
    this.vy += 600 * dt;
    let nextX = this.x + this.vx * dt;
    let nextY = this.y + this.vy * dt;
    if (world) {
      const radius = 6;
      const tileSize = world.tileSize;
      const check = (x, y, options = {}) => {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        return world.isSolid(tileX, tileY, abilities, options);
      };
      if (this.vx !== 0) {
        const signX = Math.sign(this.vx);
        const testX = nextX + signX * radius;
        if (check(testX, this.y - radius * 0.6, { ignoreOneWay: true }) || check(testX, this.y + radius * 0.6, { ignoreOneWay: true })) {
          this.vx = 0;
          nextX = this.x;
        }
      }
      if (this.vy !== 0) {
        const signY = Math.sign(this.vy);
        const testY = nextY + signY * radius;
        const ignoreOneWay = signY < 0;
        if (check(nextX - radius * 0.6, testY, { ignoreOneWay }) || check(nextX + radius * 0.6, testY, { ignoreOneWay })) {
          if (signY > 0) {
            const tileY = Math.floor(testY / tileSize);
            nextY = tileY * tileSize - radius;
          }
          this.vy = 0;
        }
      }
    }
    this.x = nextX;
    this.y = nextY;
    if (this.y > 1200) this.life = 0;
    this.life -= dt;
    this.pulse += dt * 4;
    if (this.vy === 0) {
      this.vx *= Math.pow(0.2, dt * 8);
    }
  }

  collect() {
    this.collected = true;
    this.life = 0;
  }

  draw(ctx, highlight = false) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const glow = 0.6 + Math.sin(this.pulse) * 0.4;
    ctx.strokeStyle = highlight ? '#fff' : `rgba(255,255,255,${glow})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
