let ENEMY_ID = 0;

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
    this.solid = true;
    this.justStaggered = false;
    this.id = ENEMY_ID;
    ENEMY_ID += 1;
    this.hurtTimer = 0;
    this.shakePhase = 0;
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
    const wasStaggered = this.stagger >= 0.6;
    this.health -= amount;
    this.stagger = Math.min(1, this.stagger + 0.5);
    this.justStaggered = !wasStaggered && this.stagger >= 0.6;
    this.hurtTimer = 0.25;
    this.shakePhase = 0;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  tickDamage(dt) {
    if (this.hurtTimer <= 0) return;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.shakePhase += dt * 40;
  }

  getDamageOffset() {
    if (this.hurtTimer <= 0) {
      return { x: 0, y: 0, flash: false };
    }
    const intensity = this.hurtTimer / 0.25;
    const offsetX = Math.sin(this.shakePhase) * 3 * intensity;
    const offsetY = Math.cos(this.shakePhase * 1.3) * 3 * intensity;
    const flash = Math.floor(this.shakePhase * 4) % 2 === 0;
    return { x: offsetX, y: offsetY, flash };
  }

  update() {}

  draw(ctx) {
    ctx.save();
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.strokeStyle = flash ? '#fff' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.stroke();
    ctx.restore();
  }
}
