import { canPeacefullyInteract, isHostileToPlayer, shouldAttackPlayer, shouldIgnorePlayer } from './alignment.js';
import { getNpcAnimationFrame, resolveNpcAnimationSet } from './animationAdapter.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class NpcEntity {
  constructor({ definition, instance, tileSize = 32 }) {
    this.definition = definition;
    this.instance = instance;
    this.tileSize = tileSize;
    this.x = (instance.x + 0.5) * tileSize;
    this.y = (instance.y + 0.5) * tileSize;
    this.homeX = this.x;
    this.homeY = this.y;
    this.width = definition.dimensions.width;
    this.height = definition.dimensions.height;
    this.state = instance.startState || definition.behavior.archetype || 'idle';
    this.facing = instance.facing || 1;
    this.health = definition.stats.maxHealth;
    this.dead = false;
    this.elapsed = 0;
    this.attackCooldown = 0;
    this.interactionRange = Number(definition.behavior.parameters?.interactionRange || 52);
    this.runtimeAnimation = null;
    this.contactDamage = Number(definition.stats.contactDamage || 0);
    this.moveSpeed = Number(definition.stats.moveSpeed || 0);
    this.velocityX = 0;
    this.velocityY = 0;
    this.id = `${definition.id}:${instance.x},${instance.y}`;
    this.type = 'npc';
    this.alignment = definition.alignment;
    this.behavior = definition.behavior;
    this.label = instance.customName || definition.name;
    this.solid = definition.alignment === 'enemy';
    this.hostileToPlayer = isHostileToPlayer(this.alignment);
    this.attackPlayer = shouldAttackPlayer(this.alignment, definition);
    this.ignorePlayer = shouldIgnorePlayer(this.alignment);
    this.peacefulInteraction = canPeacefullyInteract(this.alignment);
    this.debugWarnings = [];
    resolveNpcAnimationSet(definition).then((resolved) => {
      this.runtimeAnimation = resolved;
    });
  }

  get rect() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height
    };
  }

  update(dt, game) {
    if (this.dead || this.instance.enabled === false) return;
    this.elapsed += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const player = game.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);
    const params = this.behavior.parameters || {};
    const speed = this.moveSpeed * Number(params.moveSpeedMultiplier || 1);

    switch (this.behavior.archetype) {
      case 'wander': {
        const radius = Number(params.wanderRadius || 48);
        const offset = Math.sin(this.elapsed * 0.8 + this.instance.x) * radius;
        this.x = this.homeX + offset;
        this.facing = Math.sign(offset) || this.facing;
        this.state = Math.abs(offset) > 4 ? 'walk' : 'idle';
        break;
      }
      case 'patrol': {
        const patrol = this.instance.patrolPoints?.length ? this.instance.patrolPoints : params.patrolPoints || [];
        if (patrol.length) {
          const target = patrol[Math.floor(this.elapsed * 0.3) % patrol.length];
          const targetX = (target.x + 0.5) * this.tileSize;
          const targetY = (target.y + 0.5) * this.tileSize;
          const stepX = clamp(targetX - this.x, -1, 1) * speed * dt;
          const stepY = clamp(targetY - this.y, -1, 1) * speed * dt;
          this.x += stepX;
          this.y += stepY;
          this.facing = Math.sign(stepX) || this.facing;
          this.state = Math.abs(stepX) + Math.abs(stepY) > 0.5 ? 'walk' : 'idle';
        }
        break;
      }
      case 'chase':
      case 'meleeAttack': {
        const detection = Number(params.detectionRange || this.definition.stats.aggroRange || 96);
        const attackRange = Number(params.attackRange || 26);
        if (this.attackPlayer && distance <= detection) {
          if (distance > attackRange) {
            const normX = dx / Math.max(distance, 1);
            this.x += normX * speed * dt;
            this.facing = Math.sign(normX) || this.facing;
            this.state = 'walk';
          } else {
            this.state = 'attack';
            if (this.attackCooldown <= 0) {
              game.player.health = Math.max(0, game.player.health - this.contactDamage);
              game.player.hurtTimer = 0.2;
              this.attackCooldown = Number(params.attackCooldown || 1);
            }
          }
        } else {
          this.state = 'idle';
        }
        break;
      }
      case 'talk':
      case 'stationary':
      case 'idle':
      default:
        this.state = distance <= this.interactionRange && this.peacefulInteraction ? 'talk' : 'idle';
        break;
    }
  }

  draw(ctx) {
    if (this.instance.enabled === false) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.facing < 0) ctx.scale(-1, 1);
    const color = this.definition.editorPreview?.color
      || (this.alignment === 'enemy' ? '#ff6b6b' : this.alignment === 'friendly' ? '#67d5b5' : '#cdb4db');
    const frame = getNpcAnimationFrame({ definition: this.definition, resolvedAnimation: this.runtimeAnimation, role: this.state, elapsed: this.elapsed });
    if (frame && this.runtimeAnimation?.image) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.runtimeAnimation.image,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    } else {
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 2;
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.fillStyle = '#0f1720';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(this.definition.editorPreview?.glyph || 'NP', 0, 4);
    }
    ctx.restore();
  }
}
