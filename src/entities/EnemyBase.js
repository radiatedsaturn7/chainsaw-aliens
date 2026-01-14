export default class EnemyBase {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 24;
    this.height = 24;
    this.health = 3;
    this.stagger = 0;
    this.dead = false;
    this.facing = 1;
    this.type = 'enemy';
    this.lootValue = 1;
  }

  get rect() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height
    };
  }

  damage(amount) {
    this.health -= amount;
    this.stagger = Math.min(1, this.stagger + 0.5);
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  update() {}

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.stroke();
    ctx.restore();
  }
}
