export class DebrisPiece {
  constructor(points, x, y, vx, vy) {
    this.points = points;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = 1.2;
    this.rotation = 0;
    this.spin = (Math.random() - 0.5) * 6;
  }

  update(dt) {
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.spin * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    this.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export class Shard {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 400;
    this.vy = (Math.random() - 0.5) * 400;
    this.life = 0.6 + Math.random() * 0.6;
    this.size = 2 + Math.random() * 4;
    this.rotation = Math.random() * Math.PI;
    this.spin = (Math.random() - 0.5) * 10;
  }

  update(dt) {
    this.vy += 600 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.spin * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-this.size, 0);
    ctx.lineTo(0, -this.size);
    ctx.lineTo(this.size, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
