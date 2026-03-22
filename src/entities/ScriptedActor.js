import EnemyBase from './EnemyBase.js';
import { ensurePixelTileData } from '../editor/adapters/editorDataContracts.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function stateDurationSeconds(world, artKey) {
  const pixelData = ensurePixelTileData(world, artKey, { size: 16, fps: 6 });
  const frames = pixelData?.frames?.length || 1;
  const fps = pixelData?.fps || 6;
  return Math.max(0.25, frames / Math.max(1, fps));
}

export default class ScriptedActor extends EnemyBase {
  constructor(x, y, definition, options = {}) {
    super(x, y);
    this.definition = definition;
    this.world = options.world;
    this.type = definition.id;
    this.displayName = definition.name;
    this.width = 24;
    this.height = 24;
    this.health = definition.maxHealth || 3;
    this.maxHealth = this.health;
    this.lootValue = 0;
    this.gravity = definition.gravity !== false;
    this.solid = true;
    this.bodyContactDamage = Boolean(definition.bodyContactDamage);
    this.contactDamageAmount = definition.contactDamageAmount || 1;
    this.invulnerable = Boolean(definition.invulnerableByDefault);
    this.destructible = definition.destructible !== false;
    this.attackTarget = definition.attackTarget || 'none';
    this.currentStateId = definition.states?.[0]?.id || 'idle';
    this.stateTime = 0;
    this.actionCooldowns = new Map();
    this.originX = x;
    this.originY = y;
    this.baseX = x;
    this.baseY = y;
    this.behaviorTimer = 0;
    this.pauseTimer = 0;
    this.lastDamageFlag = false;
    this._touchWall = false;
    this._touchFloor = false;
    this.linkedRoot = options.linkedRoot || null;
    this.linkOffsetX = options.linkOffsetX || 0;
    this.linkOffsetY = options.linkOffsetY || 0;
    this.isLinkedPart = Boolean(options.isLinkedPart);
    this.childrenSpawned = false;
    this.noLootDrops = true;
    this.pendingLootDrops = [];
  }

  get state() {
    return this.definition.states.find((entry) => entry.id === this.currentStateId) || this.definition.states[0];
  }

  setState(stateId) {
    const match = this.definition.states.find((entry) => entry.id === stateId);
    if (!match) return;
    this.currentStateId = match.id;
    this.stateTime = 0;
    this.behaviorTimer = 0;
    this.pauseTimer = 0;
    if (typeof match.overrideInvulnerable === 'boolean') this.invulnerable = match.overrideInvulnerable;
    if (typeof match.overrideBodyDamage === 'boolean') this.bodyContactDamage = match.overrideBodyDamage;
    if (Number.isFinite(match.overrideContactDamageAmount)) this.contactDamageAmount = match.overrideContactDamageAmount;
  }

  damage(amount) {
    if (this.invulnerable || !this.destructible) return;
    this.lastDamageFlag = true;
    super.damage(amount);
  }

  update(dt, player, context = {}) {
    if (this.linkedRoot) {
      if (this.linkedRoot.dead) {
        this.dead = true;
        return;
      }
      this.x = this.linkedRoot.x + this.linkOffsetX * (this.linkedRoot.facing || 1);
      this.y = this.linkedRoot.y + this.linkOffsetY;
      if (this.linkedRoot.facing) this.facing = this.linkedRoot.facing;
    }
    this.animTime = (this.animTime || 0) + dt;
    this.stateTime += dt;
    this._touchWall = false;
    this._touchFloor = false;
    if (!this.childrenSpawned && !this.isLinkedPart) {
      this.childrenSpawned = true;
      context.spawnLinkedParts?.(this, this.definition.linkedParts || []);
    }
    this.applyMovement(dt, player, context);
    this.applyActions(dt, player, context);
    this.lastDamageFlag = false;
    this.stagger = Math.max(0, this.stagger - dt * 0.4);
  }

  markTouchedWall() { this._touchWall = true; }
  markTouchedFloor() { this._touchFloor = true; }

  applyMovement(dt, player) {
    const movement = this.state?.movement || { type: 'none', params: {} };
    const params = movement.params || {};
    const dx = player.x - this.x;
    const absDx = Math.abs(dx);
    const dirToPlayer = Math.sign(dx) || this.facing || 1;
    switch (movement.type) {
      case 'patrol-platform': {
        const speed = params.speed || 90;
        if (!this.facing) this.facing = 1;
        this.vx = this.facing * speed;
        this.x += this.vx * dt;
        break;
      }
      case 'random-walk-pause': {
        const speed = params.speed || 70;
        const walkDuration = params.walkDuration || 1.2;
        const pauseDuration = params.pauseDuration || 0.8;
        this.behaviorTimer -= dt;
        if (this.pauseTimer > 0) {
          this.pauseTimer = Math.max(0, this.pauseTimer - dt);
          this.vx = 0;
        } else {
          if (this.behaviorTimer <= 0) {
            this.behaviorTimer = walkDuration;
            this.pauseTimer = pauseDuration;
            this.facing = Math.random() < 0.5 ? -1 : 1;
          }
          this.vx = this.facing * speed;
          this.x += this.vx * dt;
        }
        break;
      }
      case 'avoid-player': {
        const speed = params.speed || 120;
        const fleeDistance = params.fleeDistance || 180;
        if (absDx < fleeDistance) {
          this.facing = -dirToPlayer;
          this.vx = this.facing * speed;
          this.x += this.vx * dt;
        } else {
          this.vx = 0;
        }
        break;
      }
      case 'approach-player': {
        const speed = params.speed || 120;
        const aggroRange = params.aggroRange || 220;
        if (absDx < aggroRange) {
          this.facing = dirToPlayer;
          this.vx = this.facing * speed;
          this.x += this.vx * dt;
        } else {
          this.vx = 0;
        }
        break;
      }
      case 'pause-bounce': {
        const speed = params.speed || 70;
        const pauseDuration = params.pauseDuration || 0.7;
        const jumpSpeed = params.jumpSpeed || 240;
        if (this.vy === 0 && this.pauseTimer <= 0) {
          this.pauseTimer = pauseDuration;
          this.vx = 0;
        } else if (this.vy === 0 && this.pauseTimer > 0) {
          this.pauseTimer = Math.max(0, this.pauseTimer - dt);
          this.facing = dirToPlayer;
          if (this.pauseTimer <= 0) {
            this.vx = this.facing * speed;
            this.vy = -jumpSpeed;
          }
        }
        this.x += this.vx * dt;
        break;
      }
      case 'maintain-distance': {
        const speed = params.speed || 110;
        const preferredDistance = params.preferredDistance || 160;
        const tolerance = params.tolerance || 30;
        this.facing = dirToPlayer;
        if (absDx < preferredDistance - tolerance) {
          this.vx = -this.facing * speed;
        } else if (absDx > preferredDistance + tolerance) {
          this.vx = this.facing * speed;
        } else {
          this.vx = 0;
        }
        this.x += this.vx * dt;
        break;
      }
      case 'float': {
        const amplitude = params.amplitude || 18;
        const speed = params.speed || 1.4;
        const drift = params.drift || 16;
        this.gravity = false;
        this.x = this.baseX + Math.cos(this.animTime * speed * 0.75) * drift;
        this.y = this.baseY + Math.sin(this.animTime * speed) * amplitude;
        this.facing = dirToPlayer;
        break;
      }
      default:
        this.vx = 0;
        break;
    }
  }

  cooldownReady(key, duration = 0.75) {
    const remaining = this.actionCooldowns.get(key) || 0;
    if (remaining > 0) return false;
    this.actionCooldowns.set(key, duration);
    return true;
  }

  tickCooldowns(dt) {
    this.actionCooldowns.forEach((value, key) => {
      const next = value - dt;
      if (next <= 0) this.actionCooldowns.delete(key);
      else this.actionCooldowns.set(key, next);
    });
  }

  evaluateCondition(condition, player, context) {
    const params = condition.params || {};
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    switch (condition.type) {
      case 'always': return true;
      case 'timer-elapsed': return this.stateTime >= (params.seconds || 1);
      case 'actor-health-less-than': return (this.health / Math.max(1, this.maxHealth)) * 100 <= (params.percent || 50);
      case 'player-health-less-than': return ((player.health || 0) / Math.max(1, player.maxHealth || 1)) * 100 <= (params.percent || 50);
      case 'can-see-player': return context.canShoot?.(this, params.range || 280) || false;
      case 'cannot-see-player': return !(context.canShoot?.(this, params.range || 280) || false);
      case 'player-within': return dist <= (params.tiles || 4) * 32;
      case 'player-farther-than': return dist >= (params.tiles || 6) * 32;
      case 'touched-wall': return this._touchWall;
      case 'touched-floor': return this._touchFloor || this.vy === 0;
      case 'took-damage': return this.lastDamageFlag;
      case 'random-chance': return Math.random() <= (params.chance || 0.25);
      case 'cooldown-ready': return (this.actionCooldowns.get(params.key || condition.id) || 0) <= 0;
      case 'linked-part-destroyed': return Boolean((this.spawnedChildren || []).find((entry) => entry.type === params.actorId && entry.dead));
      case 'root-state-is': return this.linkedRoot?.currentStateId === params.stateId;
      case 'child-state-is': return Boolean((this.spawnedChildren || []).find((entry) => entry.type === params.actorId && entry.currentStateId === params.stateId));
      default: return false;
    }
  }

  applyActions(dt, player, context) {
    this.tickCooldowns(dt);
    const state = this.state;
    if (!state) return;
    const conditions = Array.isArray(state.conditions) ? state.conditions : [];
    const evaluations = conditions.map((condition) => this.evaluateCondition(condition, player, context));
    const passes = state.conditionMode === 'any'
      ? evaluations.some(Boolean)
      : evaluations.every(Boolean);
    if (!passes) return;
    (state.actions || []).forEach((action) => {
      const params = action.params || {};
      const cooldown = params.cooldown ?? 0.5;
      if (!this.cooldownReady(action.id, cooldown)) return;
      switch (action.type) {
        case 'switch-state':
          this.setState(params.stateId || this.definition.states[0]?.id);
          break;
        case 'reverse-direction':
          this.facing = -(this.facing || 1);
          this.vx = -this.vx;
          break;
        case 'set-velocity':
          this.vx = Number(params.vx || 0);
          this.vy = Number(params.vy || 0);
          break;
        case 'jump':
          this.vy = -Math.abs(Number(params.speed || 220));
          break;
        case 'stop-moving':
          this.vx = 0;
          break;
        case 'spawn-bullets': {
          const count = clamp(Number(params.count || 1), 1, 8);
          const spread = Number(params.spread || 0);
          const speed = Number(params.speed || 220);
          const aimAtPlayer = params.aimAtPlayer !== false;
          const baseAngle = aimAtPlayer ? Math.atan2(player.y - this.y, player.x - this.x) : (Number(params.angle || 0) * Math.PI / 180);
          for (let i = 0; i < count; i += 1) {
            const offset = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * spread;
            const angle = baseAngle + (offset * Math.PI / 180);
            context.spawnProjectile?.(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, Number(params.damage || 1));
          }
          break;
        }
        case 'spawn-actor':
          context.spawnActor?.(params.actorId || params.enemyType, this.x + Number(params.offsetX || 0), this.y + Number(params.offsetY || 0));
          break;
        case 'delete-actor':
          this.dead = true;
          break;
        case 'become-invulnerable':
          this.invulnerable = true;
          break;
        case 'become-vulnerable':
          this.invulnerable = false;
          break;
        case 'enable-body-damage':
          this.bodyContactDamage = true;
          break;
        case 'disable-body-damage':
          this.bodyContactDamage = false;
          break;
        case 'drop-loot':
          this.pendingLootDrops = this.definition.loot || [];
          break;
        case 'face-player':
          this.facing = Math.sign(player.x - this.x) || this.facing || 1;
          break;
        default:
          break;
      }
    });
  }

  draw(ctx) {
    const state = this.state;
    const artKey = state?.artKey;
    if (!artKey || !this.world) {
      super.draw(ctx);
      return;
    }
    const pixelData = ensurePixelTileData(this.world, artKey, { size: 16, fps: 6 });
    const frames = pixelData?.frames || [];
    const size = pixelData?.size || 16;
    const fps = pixelData?.fps || 6;
    const frameIndex = Math.floor(this.animTime * fps) % Math.max(1, frames.length);
    const frame = frames[frameIndex] || [];
    const scale = 2;
    const origin = size / 2;
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.scale(this.facing < 0 ? -1 : 1, 1);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const color = frame[row * size + col];
        if (!color) continue;
        ctx.fillStyle = flash ? '#ffffff' : color;
        ctx.fillRect((col - origin) * scale, (row - origin) * scale, scale, scale);
      }
    }
    ctx.restore();
  }

  getDeathDuration() {
    return stateDurationSeconds(this.world, this.state?.artKey);
  }
}
