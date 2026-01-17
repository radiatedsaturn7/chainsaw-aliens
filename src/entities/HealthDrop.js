export default class HealthDrop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 60;
    this.vy = -100 - Math.random() * 60;
    this.life = 6;
    this.pulse = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt) {
    this.vy += 500 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > 1200) this.life = 0;
    this.life -= dt;
    this.pulse += dt * 5;
  }

  collect() {
    this.collected = true;
    this.life = 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const glow = 0.5 + Math.sin(this.pulse) * 0.4;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = `rgba(168, 88, 255, ${0.25 + glow * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + glow * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(210, 150, 255, ${0.7 + glow * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
