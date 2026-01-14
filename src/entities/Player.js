export default class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 22;
    this.height = 34;
    this.speed = 240;
    this.jumpPower = 460;
    this.revEfficiency = 1;
    this.heatCap = 1;
    this.dashCooldownBase = 0.6;
    this.onGround = false;
    this.onWall = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.facing = 1;
    this.health = 5;
    this.maxHealth = 5;
    this.heat = 0;
    this.overheat = 0;
    this.fuel = 3;
    this.fuelRegen = 0;
    this.loot = 0;
    this.credits = 0;
    this.upgradeSlots = 2;
    this.equippedUpgrades = [];
    this.cosmetics = [];
    this.blueprints = 0;
    this.dead = false;
  }

  get rect() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height
    };
  }

  applyUpgrades(upgrades) {
    let speed = 240;
    let jumpPower = 460;
    let revEfficiency = 1;
    let heatCap = 1;
    let dashCooldown = 0.6;
    upgrades.forEach((upgrade) => {
      if (upgrade.modifiers?.speed) speed += upgrade.modifiers.speed;
      if (upgrade.modifiers?.jump) jumpPower += upgrade.modifiers.jump;
      if (upgrade.modifiers?.revEfficiency) revEfficiency += upgrade.modifiers.revEfficiency;
      if (upgrade.modifiers?.heatCap) heatCap += upgrade.modifiers.heatCap;
      if (upgrade.modifiers?.dashCooldown) dashCooldown += upgrade.modifiers.dashCooldown;
    });
    this.speed = speed;
    this.jumpPower = jumpPower;
    this.revEfficiency = revEfficiency;
    this.heatCap = heatCap;
    this.dashCooldownBase = dashCooldown;
  }

  update(dt, input, world, abilities) {
    if (this.dead) return;
    const move = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    this.vx = move * this.speed;
    if (move !== 0) {
      this.facing = move;
    }

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.wasPressed('jump')) {
      this.jumpBuffer = 0.12;
    }

    if (this.onGround) {
      this.coyote = 0.1;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    if ((this.coyote > 0 || (abilities.magboots && this.onWall !== 0)) && this.jumpBuffer > 0) {
      if (this.onWall !== 0 && abilities.magboots) {
        this.vx = -this.onWall * this.speed * 1.3;
        this.vy = -this.jumpPower * 0.9;
      } else {
        this.vy = -this.jumpPower;
      }
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }

    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }
    if (input.wasPressed('dash') && this.dashCooldown <= 0) {
      this.dashTimer = 0.12;
      this.dashCooldown = this.dashCooldownBase || 0.6;
      this.vx = this.facing * 620;
      this.vy = 0;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else {
      this.vy += 1200 * dt;
    }

    this.moveAndCollide(dt, world, abilities);

    this.heat = Math.max(0, this.heat - dt * 0.2);
    if (this.overheat > 0) {
      this.overheat -= dt;
    }
    if (this.fuel < 3) {
      this.fuelRegen += dt;
      if (this.fuelRegen > 4) {
        this.fuel += 1;
        this.fuelRegen = 0;
      }
    }
  }

  moveAndCollide(dt, world, abilities) {
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;
    const rect = this.rect;

    this.onGround = false;
    this.onWall = 0;

    const check = (x, y) => {
      const tileX = Math.floor(x / world.tileSize);
      const tileY = Math.floor(y / world.tileSize);
      return world.isSolid(tileX, tileY, abilities);
    };

    // Horizontal
    const signX = Math.sign(this.vx);
    if (signX !== 0) {
      const testX = nextX + (signX * rect.w) / 2;
      if (check(testX, rect.y + 4) || check(testX, rect.y + rect.h - 4)) {
        this.vx = 0;
        this.onWall = signX;
      } else {
        this.x = nextX;
      }
    } else {
      this.x = nextX;
    }

    // Vertical
    const signY = Math.sign(this.vy);
    if (signY !== 0) {
      const testY = nextY + (signY * rect.h) / 2;
      if (check(rect.x + 4, testY) || check(rect.x + rect.w - 4, testY)) {
        if (signY > 0) {
          this.onGround = true;
        }
        this.vy = 0;
      } else {
        this.y = nextY;
      }
    } else {
      this.y = nextY;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  canRev() {
    return this.overheat <= 0;
  }

  addHeat(amount) {
    const cap = this.heatCap || 1;
    this.heat = Math.min(1 * cap, this.heat + amount);
    if (this.heat >= 1 * cap) {
      this.overheat = 1.2;
      this.heat = 0;
    }
  }

  spendFuel() {
    if (this.fuel <= 0) return false;
    this.fuel -= 1;
    return true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.lineTo(this.facing * this.width * 0.8, 0);
    ctx.lineTo(0, this.height / 2);
    ctx.stroke();
    if (this.cosmetics.length > 0) {
      ctx.beginPath();
      ctx.moveTo(-4, -this.height / 2);
      ctx.lineTo(this.facing * this.width * 0.9, 0);
      ctx.lineTo(-4, this.height / 2);
      ctx.stroke();
    }
    if (this.cosmetics.length > 1) {
      ctx.beginPath();
      ctx.moveTo(-8, -this.height / 3);
      ctx.lineTo(this.facing * this.width * 0.7, 0);
      ctx.lineTo(-8, this.height / 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}
