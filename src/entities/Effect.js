export default class Effect {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.age = 0;
    this.life = 0.4;
  }

  update(dt) {
    this.age += dt;
  }

  get alive() {
    return this.age < this.life;
  }

  draw(ctx) {
    const t = this.age / this.life;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    if (this.type === 'dash') {
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 4);
      ctx.stroke();
    } else if (this.type === 'hit') {
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    } else if (this.type === 'stagger') {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + t * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'execute') {
      ctx.beginPath();
      ctx.arc(0, 0, 14 + t * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
    } else if (this.type === 'pickup') {
      ctx.beginPath();
      ctx.arc(0, 0, 8 + t * 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'interact') {
      ctx.beginPath();
      ctx.rect(-6 - t * 6, -6 - t * 6, 12 + t * 12, 12 + t * 12);
      ctx.stroke();
    } else if (this.type === 'jump') {
      ctx.beginPath();
      ctx.arc(0, 0, 6 + t * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'land') {
      ctx.beginPath();
      ctx.moveTo(-10 - t * 6, 0);
      ctx.lineTo(10 + t * 6, 0);
      ctx.stroke();
    } else if (this.type === 'move') {
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(6, 4);
      ctx.stroke();
    } else if (this.type === 'damage') {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + t * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.stroke();
    } else if (this.type === 'bite') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, -0.7, 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
}
