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
    this.dashCooldownBase = 0.6;
    this.onGround = false;
    this.onWall = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpsRemaining = 1;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.facing = 1;
    this.health = 5;
    this.maxHealth = 5;
    this.loot = 0;
    this.credits = 0;
    this.upgradeSlots = 2;
    this.equippedUpgrades = [];
    this.cosmetics = [];
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
    this.aimingUp = false;
    this.ducking = false;
    this.stepTimer = 0;
    this.attackTimer = 0;
    this.attackLungeTimer = 0;
    this.attackLungeSpeed = 0;
    this.attackLungeDir = 1;
    this.flameMode = false;
    this.sawDeployed = false;
    this.sawRideActive = false;
    this.sawRideMomentum = 0;
    this.sawRideSpeed = MOVEMENT_MODEL.dashSpeed * 0.75;
    this.sawRideDamageTimer = 0;
    this.sawRideBurstTimer = 0;
    this.revDamageTimer = 0;
    this.magBootsHeat = 0;
    this.magBootsOverheat = 0;
    this.magBootsEngaged = false;
    this.aimingDiagonal = false;
    this.aimingDown = false;
    this.aimX = 1;
    this.aimY = 0;
    this.aimAngle = 0;
    this.chainsawFacing = this.facing;
    this.chainsawHeld = false;
    this.oilLevel = 0;
    this.superCharge = 0;
    this.superReady = false;
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
    let dashCooldown = 0.6;
    upgrades.forEach((upgrade) => {
      if (upgrade.modifiers?.speed) speed += upgrade.modifiers.speed;
      if (upgrade.modifiers?.jump) jumpPower += upgrade.modifiers.jump;
      if (upgrade.modifiers?.revEfficiency) revEfficiency += upgrade.modifiers.revEfficiency;
      if (upgrade.modifiers?.dashCooldown) dashCooldown += upgrade.modifiers.dashCooldown;
    });
    this.speed = speed;
    this.jumpPower = jumpPower;
    this.revEfficiency = revEfficiency;
    this.dashCooldownBase = dashCooldown;
  }

  startLunge(targetX) {
    const direction = Math.sign(targetX - this.x) || this.facing;
    this.attackLungeDir = direction;
    this.attackLungeSpeed = MOVEMENT_MODEL.dashSpeed * 0.45;
    this.attackLungeTimer = 0.18;
    this.facing = direction;
  }

  startSawRide() {
    this.sawRideActive = true;
    this.sawRideMomentum = 0;
  }

  stopSawRide(preserveMomentum = false) {
    if (!this.sawRideActive) return;
    this.sawRideActive = false;
    this.sawRideMomentum = preserveMomentum ? this.vx : 0;
  }

  update(dt, input, world, abilities = {}) {
    if (this.dead) return;
    if (!Number.isFinite(this.magBootsHeat)) {
      this.magBootsHeat = 0;
    }
    if (!Number.isFinite(this.magBootsOverheat)) {
      this.magBootsOverheat = 0;
    }
    this.justJumped = false;
    this.justDashed = false;
    this.justLanded = false;
    this.justStepped = false;
    this.animTime += dt;
    this.sawRideBurstTimer = Math.max(0, this.sawRideBurstTimer - dt);
    const moveInput = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    let exitRide = false;
    let exitRideMomentum = 0;
    if (this.sawRideActive) {
      if (moveInput !== 0) {
        this.facing = moveInput;
      }
      if (input.wasPressed('attack')) {
        this.sawRideBurstTimer = 0.15;
      }
      const rideMoving = input.isDown('attack') || this.sawRideBurstTimer > 0;
      const rideVx = rideMoving ? this.facing * this.sawRideSpeed : 0;
      if (input.wasPressed('jump')) {
        exitRide = true;
        exitRideMomentum = rideVx;
        this.sawRideActive = false;
        this.sawRideMomentum = exitRideMomentum;
      } else {
        this.vx = rideVx;
      }
    }
    if (!this.sawRideActive) {
      if (moveInput !== 0) {
        this.facing = moveInput;
      }
      if ((exitRide && moveInput === 0) || (this.sawRideMomentum && !this.onGround && moveInput === 0)) {
        this.vx = exitRide ? exitRideMomentum : this.sawRideMomentum;
      } else {
        this.vx = moveInput * this.speed;
        if (moveInput !== 0 || this.onGround) {
          this.sawRideMomentum = 0;
        }
      }
    }

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.wasPressed('jump')) {
      this.jumpBuffer = MOVEMENT_MODEL.jumpBuffer;
    }

    if (this.onGround) {
      this.coyote = MOVEMENT_MODEL.coyoteTime;
      this.jumpsRemaining = 1;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    const pressingIntoWall = this.onWall !== 0
      && ((this.onWall === 1 && input.isDown('right')) || (this.onWall === -1 && input.isDown('left')));
    this.magBootsEngaged = abilities.magboots && pressingIntoWall && this.magBootsOverheat <= 0;

    const canGroundJump = this.coyote > 0 || this.magBootsEngaged;
    const canAirJump = !canGroundJump && this.jumpsRemaining > 0;
    if ((canGroundJump || canAirJump) && this.jumpBuffer > 0) {
      if (this.magBootsEngaged && this.onWall !== 0) {
        this.vx = -this.onWall * this.speed * 1.4;
        this.vy = -this.jumpPower;
        this.onWall = 0;
        this.magBootsHeat += 0.2;
      } else {
        this.vy = -this.jumpPower;
      }
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.justJumped = true;
      if (canAirJump) {
        this.jumpsRemaining = Math.max(0, this.jumpsRemaining - 1);
      }
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

    if (this.attackLungeTimer > 0) {
      this.attackLungeTimer = Math.max(0, this.attackLungeTimer - dt);
      if (this.dashTimer <= 0) {
        this.vx = this.attackLungeDir * this.attackLungeSpeed;
      }
    }

    const wasGrounded = this.onGround;
    this.moveAndCollide(dt, world, abilities);
    if (!wasGrounded && this.onGround) {
      this.justLanded = true;
      this.jumpsRemaining = 1;
    }
    if (this.sawRideActive && !this.onGround) {
      this.sawRideActive = false;
      this.sawRideMomentum = this.vx;
    }
    if (this.sawRideActive && this.onGround && !input.isDown('attack')) {
      this.stopSawRide(false);
    }
    const hazardX = Math.floor(this.x / world.tileSize);
    const hazardY = Math.floor(this.y / world.tileSize);
    if (world.isHazard(hazardX, hazardY)) {
      this.takeDamage(1);
    }

    if (this.magBootsOverheat > 0) {
      this.magBootsOverheat = Math.max(0, this.magBootsOverheat - dt);
    }
    if (this.magBootsEngaged) {
      this.magBootsHeat += dt * 0.3;
    } else {
      this.magBootsHeat = Math.max(0, this.magBootsHeat - dt * 0.2);
    }
    if (this.magBootsHeat >= 1) {
      this.magBootsHeat = 0;
      this.magBootsOverheat = 1.1;
    }
    this.oilLevel = Math.max(0, this.oilLevel - dt * 0.05);
    if (this.oilLevel < 0.02) {
      this.oilLevel = 0;
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

    this.ducking = this.onGround && input.isDown('down') && !this.sawRideActive;
    const aimHorizontal = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const aimingUp = input.isDown('up') && !this.ducking && !this.sawRideActive;
    this.aimingUp = aimingUp;
    this.aimingDiagonal = aimingUp && aimHorizontal !== 0;
    this.aimingDown = !this.onGround && input.isDown('down') && !this.sawRideActive;
    if (aimingUp) {
      this.aimX = this.aimingDiagonal ? aimHorizontal : 0;
      this.aimY = -1;
    } else {
      this.aimX = this.facing || 1;
      this.aimY = 0;
    }
    if (aimingUp) {
      this.aimAngle = Math.atan2(this.aimY, this.aimX);
    } else {
      this.aimAngle = 0;
    }
    const chainsawHeld = input.isDown('attack') || input.isDown('rev');
    if (chainsawHeld && !this.chainsawHeld) {
      this.chainsawFacing = this.facing || 1;
    } else if (!chainsawHeld) {
      this.chainsawFacing = this.facing || 1;
    }
    this.chainsawHeld = chainsawHeld;
    this.revving = input.isDown('rev') && this.canRev();
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.sawRideDamageTimer = Math.max(0, this.sawRideDamageTimer - dt);
    this.revDamageTimer = Math.max(0, this.revDamageTimer - dt);
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
        const stepHeight = 8;
        const steppedTop = rect.y - stepHeight;
        const canStep = this.onGround
          && !check(testX, steppedTop + 4, { ignoreOneWay: true })
          && !check(testX, steppedTop + rect.h - 4, { ignoreOneWay: true });
        if (canStep) {
          this.x = nextX;
          this.y -= stepHeight;
          this.onGround = true;
        } else {
          this.vx = 0;
          this.onWall = signX;
        }
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
    } else if (this.ducking) {
      this.state = 'duck';
    } else if (!this.onGround) {
      this.state = this.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.vx) > 10) {
      this.state = 'run';
    } else {
      this.state = 'idle';
    }
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return false;
    this.health -= amount;
    this.hurtTimer = 0.3;
    this.invulnTimer = 0.6;
    this.sawRideActive = false;
    this.sawRideMomentum = 0;
    if (this.health <= 0) {
      this.dead = true;
    }
    return true;
  }

  gainMaxHealth(amount = 1) {
    this.maxHealth = Math.min(12, this.maxHealth + amount);
    this.health = this.maxHealth;
  }

  canRev() {
    return true;
  }

  addOil(amount = 0.15) {
    this.oilLevel = Math.min(1, this.oilLevel + amount);
  }

  addSuperCharge(amount = 0.15) {
    this.superCharge = Math.min(1, this.superCharge + amount);
    this.superReady = this.superCharge >= 1;
    return true;
  }

  draw(ctx) {
    ctx.save();
    const hurtShake = this.hurtTimer > 0 ? 1 : 0;
    const shakeX = hurtShake ? Math.sin(this.animTime * 50) * 2 : 0;
    const shakeY = hurtShake ? Math.cos(this.animTime * 60) * 2 : 0;
    const healthRatio = this.maxHealth ? Math.max(0, this.health) / this.maxHealth : 1;
    const injury = Math.min(1, Math.max(0, 1 - healthRatio));
    const stagger = injury > 0 ? Math.sin(this.animTime * 6) * 3 * injury : 0;
    ctx.translate(this.x + shakeX + stagger, this.y + shakeY);
    const walkPhase = this.state === 'run' ? this.animTime * 10 : 0;
    const walkSwing = this.state === 'run' ? Math.sin(walkPhase) * (4 + injury * 4) : 0;
    const legLift = this.state === 'jump' || this.state === 'fall' ? -4 : 0;
    const dashTilt = this.state === 'dash' ? this.facing * 6 : 0;
    const crouchOffset = this.state === 'duck' ? 6 : 0;
    const crouchShrink = this.state === 'duck' ? 6 : 0;
    const aimTilt = this.aimingUp ? this.aimAngle : 0;
    const flash = this.hurtTimer > 0 && Math.floor(this.animTime * 20) % 2 === 0;
    ctx.strokeStyle = flash ? '#fff' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.rotate((dashTilt * Math.PI) / 180);
    const hipY = 10 + crouchOffset;
    const shoulderY = -8 + crouchOffset;
    const holdingArm = injury > 0.45;
    const armSwing = this.state === 'run' ? Math.sin(walkPhase + Math.PI) * (4 + injury * 2) : 0;
    // Head
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 + 8 + crouchOffset, 6, 0, Math.PI * 2);
    ctx.stroke();
    // Torso
    ctx.beginPath();
    ctx.moveTo(-6, shoulderY);
    ctx.lineTo(6, shoulderY);
    ctx.lineTo(8, hipY);
    ctx.lineTo(-8, hipY);
    ctx.closePath();
    ctx.stroke();
    // Legs with joints
    ctx.beginPath();
    const leftHipX = -6;
    const rightHipX = 6;
    const leftKneeY = hipY + 10 + legLift;
    const rightKneeY = hipY + 10 - legLift;
    const leftFootY = hipY + 20 + walkSwing - crouchShrink;
    const rightFootY = hipY + 20 - walkSwing - crouchShrink;
    const leftKneeX = leftHipX + walkSwing * 0.4;
    const rightKneeX = rightHipX - walkSwing * 0.4;
    ctx.moveTo(leftHipX, hipY);
    ctx.lineTo(leftKneeX, leftKneeY);
    ctx.lineTo(leftHipX - 2, leftFootY);
    ctx.moveTo(rightHipX, hipY);
    ctx.lineTo(rightKneeX, rightKneeY);
    ctx.lineTo(rightHipX + 2, rightFootY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(leftKneeX, leftKneeY, 2, 0, Math.PI * 2);
    ctx.arc(rightKneeX, rightKneeY, 2, 0, Math.PI * 2);
    ctx.stroke();
    // Arms with joints
    const armOffset = this.revving ? -6 : 0;
    ctx.save();
    ctx.rotate(aimTilt);
    ctx.beginPath();
    const leftShoulderX = -10;
    const rightShoulderX = 10;
    const leftElbowX = leftShoulderX - 4 + armSwing;
    const rightElbowX = rightShoulderX + 4 - armSwing;
    const leftHandX = holdingArm ? -2 : leftElbowX - 2;
    const rightHandX = holdingArm ? 6 : rightElbowX + 2;
    const armBaseY = shoulderY + armOffset;
    const leftHandY = holdingArm ? armBaseY + 6 : armBaseY + 10;
    const rightHandY = holdingArm ? armBaseY + 4 : armBaseY + 10;
    ctx.moveTo(leftShoulderX, armBaseY);
    ctx.lineTo(leftElbowX, armBaseY + 4);
    ctx.lineTo(leftHandX, leftHandY);
    ctx.moveTo(rightShoulderX, armBaseY);
    ctx.lineTo(rightElbowX, armBaseY + 4);
    ctx.lineTo(rightHandX, rightHandY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(leftElbowX, armBaseY + 4, 2, 0, Math.PI * 2);
    ctx.arc(rightElbowX, armBaseY + 4, 2, 0, Math.PI * 2);
    ctx.stroke();
    // Chainsaw bar
    ctx.beginPath();
    ctx.moveTo(0, -4 + crouchOffset);
    const barLength = this.revving ? this.width * 1.1 : this.width * 0.9;
    const barDir = this.aimingUp ? 1 : (this.chainsawHeld ? this.chainsawFacing : this.facing);
    if (this.superReady) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,255,180,0.8)';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(120,255,180,0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -4 + crouchOffset);
      ctx.lineTo(barDir * barLength, 0 + crouchOffset);
      ctx.lineTo(0, 6 + (this.revving ? 2 : 0) + crouchOffset);
      ctx.stroke();
      ctx.restore();
    }
    ctx.lineTo(barDir * barLength, 0 + crouchOffset);
    ctx.lineTo(0, 6 + (this.revving ? 2 : 0) + crouchOffset);
    ctx.stroke();
    if (this.revving) {
      ctx.beginPath();
      ctx.arc(barDir * barLength, 0 + crouchOffset, 8, -0.8, 0.8);
      ctx.stroke();
    }
    ctx.restore();
    if (this.cosmetics.length > 0) {
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(barDir * this.width * 0.8, 0);
      ctx.lineTo(-4, 8);
      ctx.stroke();
    }
    if (this.cosmetics.length > 1) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(barDir * this.width * 0.7, 0);
      ctx.lineTo(-8, 6);
      ctx.stroke();
    }
    if (this.oilLevel > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 * this.oilLevel;
      ctx.strokeStyle = '#38e073';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -this.height / 2 + 8 + crouchOffset, 6, 0, Math.PI * 2);
      ctx.moveTo(-6, shoulderY);
      ctx.lineTo(6, shoulderY);
      ctx.lineTo(8, hipY);
      ctx.lineTo(-8, hipY);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
