import { MOVEMENT_MODEL } from '../game/MovementModel.js';

export default class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 22;
    this.height = 34;
    this.speed = MOVEMENT_MODEL.baseSpeed;
    this.jumpPower = MOVEMENT_MODEL.baseJumpPower;
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
    this.animTime = 0;
    this.hurtTimer = 0;
    this.invulnTimer = 0;
    this.state = 'idle';
    this.revving = false;
    this.justJumped = false;
    this.justDashed = false;
    this.justLanded = false;
    this.justStepped = false;
    this.stepTimer = 0;
    this.attackTimer = 0;
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
    let speed = MOVEMENT_MODEL.baseSpeed;
    let jumpPower = MOVEMENT_MODEL.baseJumpPower;
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
    this.justJumped = false;
    this.justDashed = false;
    this.justLanded = false;
    this.justStepped = false;
    this.animTime += dt;
    const move = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    this.vx = move * this.speed;
    if (move !== 0) {
      this.facing = move;
    }

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.wasPressed('jump')) {
      this.jumpBuffer = MOVEMENT_MODEL.jumpBuffer;
    }

    if (this.onGround) {
      this.coyote = MOVEMENT_MODEL.coyoteTime;
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
      this.justJumped = true;
    }

    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }
    if (input.wasPressed('dash') && this.dashCooldown <= 0) {
      this.dashTimer = MOVEMENT_MODEL.dashDuration;
      this.dashCooldown = this.dashCooldownBase || 0.6;
      this.vx = this.facing * MOVEMENT_MODEL.dashSpeed;
      this.vy = 0;
      this.justDashed = true;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else {
      this.vy += MOVEMENT_MODEL.gravity * dt;
    }

    const wasGrounded = this.onGround;
    this.moveAndCollide(dt, world, abilities);
    if (!wasGrounded && this.onGround) {
      this.justLanded = true;
    }
    const hazardX = Math.floor(this.x / world.tileSize);
    const hazardY = Math.floor(this.y / world.tileSize);
    if (world.isHazard(hazardX, hazardY)) {
      this.takeDamage(1);
    }

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
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    if (this.onGround && Math.abs(this.vx) > 10) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.justStepped = true;
        this.stepTimer = 0.35;
      }
    } else {
      this.stepTimer = Math.max(this.stepTimer, 0.1);
    }

    this.revving = input.isDown('rev') && this.canRev();
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.updateState();
  }

  moveAndCollide(dt, world, abilities) {
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;
    const rect = this.rect;

    this.onGround = false;
    this.onWall = 0;

    const check = (x, y, options = {}) => {
      const tileX = Math.floor(x / world.tileSize);
      const tileY = Math.floor(y / world.tileSize);
      return world.isSolid(tileX, tileY, abilities, options);
    };

    // Horizontal
    const signX = Math.sign(this.vx);
    if (signX !== 0) {
      const testX = nextX + (signX * rect.w) / 2;
      if (check(testX, rect.y + 4, { ignoreOneWay: true }) || check(testX, rect.y + rect.h - 4, { ignoreOneWay: true })) {
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
      const ignoreOneWay = signY < 0;
      if (check(rect.x + 4, testY, { ignoreOneWay }) || check(rect.x + rect.w - 4, testY, { ignoreOneWay })) {
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

  updateState() {
    if (this.dashTimer > 0) {
      this.state = 'dash';
    } else if (!this.onGround) {
      this.state = this.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.vx) > 10) {
      this.state = 'run';
    } else {
      this.state = 'idle';
    }
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return;
    this.health -= amount;
    this.hurtTimer = 0.3;
    this.invulnTimer = 0.6;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  gainMaxHealth(amount = 1) {
    this.maxHealth = Math.min(12, this.maxHealth + amount);
    this.health = this.maxHealth;
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
    const hurtShake = this.hurtTimer > 0 ? 1 : 0;
    const shakeX = hurtShake ? Math.sin(this.animTime * 50) * 2 : 0;
    const shakeY = hurtShake ? Math.cos(this.animTime * 60) * 2 : 0;
    ctx.translate(this.x + shakeX, this.y + shakeY);
    const walk = this.state === 'run' ? Math.sin(this.animTime * 10) * 3 : 0;
    const legLift = this.state === 'jump' || this.state === 'fall' ? -4 : 0;
    const dashTilt = this.state === 'dash' ? this.facing * 6 : 0;
    const flash = this.hurtTimer > 0 && Math.floor(this.animTime * 20) % 2 === 0;
    ctx.strokeStyle = flash ? '#fff' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.rotate((dashTilt * Math.PI) / 180);
    // Head
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 + 8, 6, 0, Math.PI * 2);
    ctx.stroke();
    // Torso
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(8, -8);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.rect(-10, 10 + legLift, 6, 12 + walk);
    ctx.rect(4, 10 - legLift, 6, 12 - walk);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    const armOffset = this.revving ? -6 : 0;
    ctx.rect(-14, -4 + armOffset, 6, 10);
    ctx.rect(8, -4 + armOffset, 6, 10);
    ctx.stroke();
    // Chainsaw bar
    ctx.beginPath();
    ctx.moveTo(0, -4);
    const barLength = this.revving ? this.width * 1.1 : this.width * 0.9;
    ctx.lineTo(this.facing * barLength, 0);
    ctx.lineTo(0, 6 + (this.revving ? 2 : 0));
    ctx.stroke();
    if (this.revving) {
      ctx.beginPath();
      ctx.arc(this.facing * barLength, 0, 8, -0.8, 0.8);
      ctx.stroke();
    }
    if (this.cosmetics.length > 0) {
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(this.facing * this.width * 0.8, 0);
      ctx.lineTo(-4, 8);
      ctx.stroke();
    }
    if (this.cosmetics.length > 1) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(this.facing * this.width * 0.7, 0);
      ctx.lineTo(-8, 6);
      ctx.stroke();
    }
    ctx.restore();
  }
}
