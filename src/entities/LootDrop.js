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

  update(dt) {
    this.vy += 600 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > 1200) this.life = 0;
    this.life -= dt;
    this.pulse += dt * 4;
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
