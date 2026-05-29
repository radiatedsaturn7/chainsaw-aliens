import EnemyBase from './EnemyBase.js';
import { ensureActorDefinition } from '../content/actorEditorData.js';
import { listProjectFiles, loadProjectFile } from '../ui/projectFiles.js';

const actorCache = new Map();
const DEFAULT_ACTOR_SIZE = { width: 24, height: 24 };

function readPngDataUrlDimensions(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || typeof atob !== 'function') return null;
  try {
    const binary = atob(dataUrl.split(',', 2)[1] || '');
    if (binary.length < 24) return null;
    const readUint32 = (offset) => (
      ((binary.charCodeAt(offset) & 0xff) << 24)
      | ((binary.charCodeAt(offset + 1) & 0xff) << 16)
      | ((binary.charCodeAt(offset + 2) & 0xff) << 8)
      | (binary.charCodeAt(offset + 3) & 0xff)
    ) >>> 0;
    return { width: readUint32(16), height: readUint32(20) };
  } catch (error) {
    return null;
  }
}

function normalizeAngle(angle) {
  let result = Number(angle || 0);
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function clampAngle(angle, minAngle, maxAngle) {
  const value = normalizeAngle(angle);
  const min = normalizeAngle(minAngle);
  const max = normalizeAngle(maxAngle);
  if (min <= max) return Math.max(min, Math.min(max, value));
  return value >= min || value <= max
    ? value
    : (Math.abs(normalizeAngle(value - min)) < Math.abs(normalizeAngle(value - max)) ? min : max);
}

function actorLocalAngleToWorld(localAngle, facing = 1) {
  return normalizeAngle(facing < 0 ? Math.PI - localAngle : localAngle);
}

function worldAngleToActorLocal(worldAngle, facing = 1) {
  return normalizeAngle(facing < 0 ? Math.PI - worldAngle : worldAngle);
}

export function loadActorDefinitionById(actorId, options = {}) {
  if (!actorId || typeof window === 'undefined') return null;
  if (!options.refresh && actorCache.has(actorId)) return actorCache.get(actorId);
  const actors = listProjectFiles('actors');
  for (const { name } of actors) {
    const payload = loadProjectFile('actors', name);
    const entries = Array.isArray(payload?.data) ? payload.data : [payload?.data].filter(Boolean);
    for (const entry of entries) {
      const data = ensureActorDefinition(entry || null);
      if (data.id === actorId) {
        actorCache.set(actorId, data);
        return data;
      }
    }
  }
  return null;
}

export function invalidateActorDefinitionCache(actorId = null) {
  if (actorId) {
    actorCache.delete(actorId);
    return;
  }
  actorCache.clear();
}

export default class ScriptedActor extends EnemyBase {
  constructor(x, y, definition, options = {}) {
    super(x, y);
    this.definition = ensureActorDefinition(definition);
    this.type = options.type || `custom:${this.definition.id}`;
    this.width = this.definition.size.width;
    this.height = this.definition.size.height;
    this.health = this.definition.health;
    this.maxHealth = this.health;
    this.healthTint = this.definition.healthTint || { enabled: false, color: '#ff3333', maxIntensity: 0.1, keepAfterDeath: false };
    this.gravity = this.definition.gravity;
    this.invulnerable = this.definition.invulnerable;
    this.contactDamage = this.definition.contactDamage;
    this.bodyDamageEnabled = this.definition.bodyDamageEnabled;
    this.destructible = this.definition.destructible;
    this.attackTarget = this.definition.attackTarget;
    this.taxonomies = Array.isArray(this.definition.taxonomies) ? [...this.definition.taxonomies] : [];
    this.aggressiveTo = Array.isArray(this.definition.aggressiveTo) ? [...this.definition.aggressiveTo] : [];
    this.stateId = this.definition.initialStateId;
    this.deathStateId = this.definition.deathStateId || '';
    this.destroyAfterDeath = this.definition.destroyAfterDeath !== false;
    this.collidableAfterDeath = this.definition.collidableAfterDeath === true;
    this.respawnOnRoomEntry = this.definition.respawnOnRoomEntry !== false;
    this.deathStarted = false;
    this.deathAnimationDuration = 0;
    this.stateTimer = 0;
    this.cooldowns = new Map();
    this.baseX = x;
    this.baseY = y;
    this.linkedChildren = [];
    this.lootTable = this.definition.loot || [];
    this._imageCache = new Map();
    this._artAnimationCache = new Map();
    this._artDimensionsCache = new Map();
    this._definitionArtDimensions = undefined;
    this.tookDamageThisFrame = false;
    this.damagedPlayerThisFrame = false;
    this.transitionDelayRemaining = 0;
    this.pendingShots = [];
    this.pendingBeams = [];
    this.pendingHomingMissiles = [];
    this.activeParticleEmitters = [];
    this.actionCooldowns = new Map();
    this.pendingStateSwitch = null;
    this._lastFrameImage = null;
    this._collisionBodyOffsetX = 0;
    this._collisionBodyOffsetY = 0;
    if (this.definition.facingMode === 'face-left') this.facing = -1;
    if (this.definition.facingMode === 'face-right') this.facing = 1;
    this.applyCollisionBodyFromZones();
  }

  getAuthoredSize() {
    const base = this.getZoneCoordinateSize();
    const art = this.getDefinitionArtDimensions();
    if (this.definition?.sizeMode !== 'manual'
      && Math.round(base.width) === DEFAULT_ACTOR_SIZE.width
      && Math.round(base.height) === DEFAULT_ACTOR_SIZE.height
      && art) {
      return art;
    }
    return base;
  }

  getZoneCoordinateSize() {
    return {
      width: Math.max(1, Number(this.definition?.size?.width || this.width || 1)),
      height: Math.max(1, Number(this.definition?.size?.height || this.height || 1))
    };
  }

  getDefinitionArtDimensions() {
    if (this._definitionArtDimensions !== undefined) return this._definitionArtDimensions;
    const states = Array.isArray(this.definition?.states) ? this.definition.states : [];
    const state = states.find((entry) => entry?.animation?.artRef || entry?.animation?.imageDataUrl || entry?.animation?.frames?.length)
      || this.currentState;
    const animation = state?.animation || {};
    const artRef = typeof animation.artRef === 'string' ? animation.artRef.trim() : '';
    if (artRef) {
      const doc = loadProjectFile('art', artRef);
      const cacheKey = `${artRef}:${Number(doc?.savedAt || doc?.data?.updatedAt || 0)}:${doc?.data?.frames?.length || 0}`;
      if (this._artDimensionsCache.has(cacheKey)) {
        this._definitionArtDimensions = this._artDimensionsCache.get(cacheKey);
        return this._definitionArtDimensions;
      }
      const width = Number(doc?.data?.width || doc?.data?.size || 0);
      const height = Number(doc?.data?.height || doc?.data?.size || width || 0);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        const roundedWidth = Math.round(width);
        const roundedHeight = Math.round(height);
        const dims = { width: roundedWidth, height: roundedHeight };
        this._artDimensionsCache.set(cacheKey, dims);
        this._definitionArtDimensions = dims;
        return dims;
      }
    }
    const frame = Array.isArray(animation.frames) ? animation.frames.find((entry) => entry?.imageDataUrl) : null;
    const cacheKey = `inline:${Number(animation.updatedAt || 0)}:${frame?.imageDataUrl || animation.imageDataUrl || ''}`;
    if (this._artDimensionsCache.has(cacheKey)) {
      this._definitionArtDimensions = this._artDimensionsCache.get(cacheKey);
      return this._definitionArtDimensions;
    }
    const parsed = readPngDataUrlDimensions(frame?.imageDataUrl || animation.imageDataUrl || '');
    if (parsed?.width > 0 && parsed?.height > 0) {
      this._artDimensionsCache.set(cacheKey, parsed);
      this._definitionArtDimensions = parsed;
      return parsed;
    }
    this._definitionArtDimensions = null;
    return null;
  }

  getVisualDimensions(image = null) {
    void image;
    return this.getAuthoredSize();
  }

  getCollisionZoneRects(types = []) {
    const stateZones = this.currentState && Array.isArray(this.currentState.collisionZones) ? this.currentState.collisionZones : null;
    const zones = stateZones || (Array.isArray(this.definition?.collisionZones) ? this.definition.collisionZones : []);
    const allow = new Set(types);
    const authored = this.getZoneCoordinateSize();
    const visual = this.getVisualDimensions();
    const scaleX = visual.width / authored.width;
    const scaleY = visual.height / authored.height;
    const cx = this.x - visual.width / 2;
    const cy = this.y - visual.height / 2;
    const facing = this.facing < 0 ? -1 : 1;
    return zones
      .filter((zone) => allow.has(zone?.type))
      .map((zone) => {
        const zoneX = Number(zone.x || 0);
        const zoneW = Math.max(1, Number(zone.width || 1));
        const zoneY = Number(zone.y || 0);
        const zoneH = Math.max(1, Number(zone.height || 1));
        if (!Number.isFinite(zoneX) || !Number.isFinite(zoneY) || !Number.isFinite(zoneW) || !Number.isFinite(zoneH)) return null;
        const mirroredX = facing < 0 ? (authored.width - zoneX - zoneW) : zoneX;
        return {
          x: cx + mirroredX * scaleX,
          y: cy + zoneY * scaleY,
          w: zoneW * scaleX,
          h: zoneH * scaleY,
          type: zone.type
        };
      })
      .filter(Boolean);
  }

  getCollisionZoneBounds(types = []) {
    const zones = this.getCollisionZoneRects(types);
    if (!zones.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    zones.forEach((z) => {
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.w);
      maxY = Math.max(maxY, z.y + z.h);
    });
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }


  applyCollisionBodyFromZones() {
    const solidBounds = this.getCollisionZoneBounds(['solid', 'solid-damage-player', 'solid-hurtbox']);
    const fallback = this.getAuthoredSize();
    if (solidBounds) {
      this.width = Math.max(1, Math.round(solidBounds.w));
      this.height = Math.max(1, Math.round(solidBounds.h));
      const boundsCenterX = solidBounds.x + solidBounds.w / 2;
      const boundsCenterY = solidBounds.y + solidBounds.h / 2;
      this._collisionBodyOffsetX = boundsCenterX - this.x;
      this._collisionBodyOffsetY = boundsCenterY - this.y;
    } else {
      this.width = fallback.width;
      this.height = fallback.height;
      this._collisionBodyOffsetX = 0;
      this._collisionBodyOffsetY = 0;
    }
  }

  get rect() {
    return {
      x: this.x - this.width / 2 + this._collisionBodyOffsetX,
      y: this.y - this.height / 2 + this._collisionBodyOffsetY,
      w: this.width,
      h: this.height
    };
  }

  get currentState() {
    return this.definition.states.find((state) => state.id === this.stateId) || this.definition.states[0];
  }

  damage(amount) {
    if (this.deathStarted || this.invulnerable || !this.destructible) return;
    const beforeHealth = this.health;
    const nextHealth = beforeHealth - Number(amount || 0);
    const hasDeathState = this.definition.states.some((state) => state.id === this.deathStateId);
    if (nextHealth <= 0 && hasDeathState) {
      this.health = 0;
      this.hurtTimer = 0.25;
      this.shakePhase = 0;
      this.tookDamageThisFrame = true;
      this.startDeathState();
      return;
    }
    super.damage(amount);
    if (this.health < beforeHealth) {
      this.tookDamageThisFrame = true;
    }
  }

  getStateAnimationDurationSeconds(state = this.currentState) {
    const animation = state?.animation || {};
    if (Array.isArray(animation.frames) && animation.frames.length) {
      const totalMs = animation.frames.reduce((sum, frame) => sum + Math.max(16, Number(frame?.durationMs || 0) || Math.round(1000 / Math.max(1, Number(animation.fps || 8)))), 0);
      return Math.max(0.05, totalMs / 1000);
    }
    const artRef = typeof animation.artRef === 'string' ? animation.artRef.trim() : '';
    if (artRef) {
      const doc = loadProjectFile('art', artRef);
      const frameCount = Array.isArray(doc?.data?.frames) ? doc.data.frames.length : 0;
      if (frameCount > 0) return Math.max(0.05, frameCount / Math.max(1, Number(animation.fps || doc?.data?.fps || 8)));
    }
    if (animation.imageDataUrl) return Math.max(0.05, 1 / Math.max(1, Number(animation.fps || 8)));
    return 0.5;
  }

  startDeathState() {
    this.deathStarted = true;
    this.dead = true;
    this.solid = this.collidableAfterDeath;
    this.destructible = false;
    this.invulnerable = true;
    this.bodyDamageEnabled = false;
    this.contactDamage = 0;
    this.stateId = this.deathStateId;
    this.stateTimer = 0;
    this.applyCollisionBodyFromZones();
    this.transitionDelayRemaining = 0;
    this.pendingShots = [];
    this.pendingBeams = [];
    this.pendingHomingMissiles = [];
    this.activeParticleEmitters = [];
    this.pendingStateSwitch = null;
    this.actionCooldowns.clear();
    this.deathAnimationDuration = this.getStateAnimationDurationSeconds(this.currentState);
    this.deathElapsed = 0;
    this.deathTimer = this.destroyAfterDeath ? this.deathAnimationDuration : Number.POSITIVE_INFINITY;
  }

  isDeadCollidable() {
    return this.deathStarted && this.collidableAfterDeath;
  }

  tickActionCooldowns(dt) {
    this.actionCooldowns.forEach((value, key) => {
      const next = Math.max(0, Number(value || 0) - dt);
      if (next > 0) this.actionCooldowns.set(key, next);
      else this.actionCooldowns.delete(key);
    });
  }

  updateDeath(dt, player = null, context = {}) {
    if (!this.deathStarted) return;
    this.stateTimer += dt;
    this.deathElapsed = Math.max(0, Number(this.deathElapsed || 0) + dt);
    this.tickActionCooldowns(dt);
    if (this.transitionDelayRemaining > 0) {
      this.transitionDelayRemaining = Math.max(0, this.transitionDelayRemaining - dt);
    }
    this.tickActiveParticleEmitters(dt, player || { x: this.x, y: this.y }, context);
    if (this.pendingStateSwitch && this.transitionDelayRemaining <= 0) {
      this.stateId = this.pendingStateSwitch;
      this.stateTimer = 0;
      this.applyCollisionBodyFromZones();
      this.pendingStateSwitch = null;
      this.activeParticleEmitters = [];
    }
    if (this.transitionDelayRemaining <= 0) {
      this.checkStateTransition(player || { x: this.x, y: this.y }, context);
    }
    this.tickDamage?.(dt);
    if (!this.destroyAfterDeath) {
      this.deathTimer = Number.POSITIVE_INFINITY;
      return;
    }
    this.deathTimer = Math.max(0, this.deathAnimationDuration - this.deathElapsed);
  }

  onDamagedPlayer() {
    this.damagedPlayerThisFrame = true;
  }

  evaluateCondition(condition, player, context = {}) {
    const params = condition?.params || {};
    const stateAggroRange = Number(this.currentState?.movement?.params?.aggroRange || 220);
    const visibilityRange = Number(params.range || params.distance || stateAggroRange || 220);
    const playerDistance = Math.hypot(player.x - this.x, player.y - this.y);
    const hasSightCheck = typeof context.canSeePlayer === 'function';
    const canSeePlayer = () => (
      hasSightCheck
        ? context.canSeePlayer(this, visibilityRange)
        : playerDistance <= visibilityRange
    );
    switch (condition?.type) {
      case 'always': return true;
      case 'timer-elapsed': return this.stateTimer >= Number(params.seconds || 0);
      case 'actor-health-below': return this.maxHealth > 0 && (this.health / this.maxHealth) <= Number(params.ratio ?? 0.5);
      case 'can-see-player': return canSeePlayer();
      case 'cannot-see-player': return !canSeePlayer();
      case 'player-within': return Math.abs(player.x - this.x) <= Number(params.distance || 160);
      case 'player-farther-than': return Math.abs(player.x - this.x) >= Number(params.distance || 200);
      case 'took-damage': return this.tookDamageThisFrame;
      case 'damaged-player': return this.damagedPlayerThisFrame;
      case 'is-dead': return this.dead;
      case 'random-chance': return Math.random() <= Number(params.chance || 0);
      case 'cooldown-ready': return !this.cooldowns.get(params.key || 'default');
      default: return false;
    }
  }

  getStateTransitions(state) {
    if (!state) return [];
    if (Array.isArray(state.transitions) && state.transitions.length) {
      return state.transitions;
    }
    return [{
      conditionMode: state.conditionMode || 'all',
      conditions: Array.isArray(state.conditions) && state.conditions.length ? state.conditions : [{ id: 'always', type: 'always', params: {} }],
      actions: Array.isArray(state.actions) ? state.actions : []
    }];
  }

  checkStateTransition(player, context) {
    const state = this.currentState;
    if (!state) return;
    const transitions = this.getStateTransitions(state);
    for (const transition of transitions) {
      const conditions = Array.isArray(transition.conditions) ? transition.conditions : [];
      const results = conditions.map((condition) => this.evaluateCondition(condition, player, context));
      const passed = transition.conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean);
      if (!passed) continue;
      const beforeStateId = this.stateId;
      const actions = Array.isArray(transition.actions) ? transition.actions : [];
      actions.forEach((action, index) => {
        let preparedAction = action;
        if (action?.type === 'emit-particles' && !Number(action?.params?.durationMs)) {
          const nextDelay = actions.slice(index + 1).find((entry) => entry?.type === 'delay');
          const repeatDurationMs = Number(nextDelay?.params?.ms || 0);
          if (repeatDurationMs > 0) {
            preparedAction = {
              ...action,
              params: { ...(action.params || {}), _repeatDurationMs: repeatDurationMs }
            };
          }
        }
        this.runAction(preparedAction, player, context);
      });
      if (this.stateId !== beforeStateId) return;
      return;
    }
  }

  runAction(action, player, context) {
    const params = action?.params || {};
    switch (action?.type) {
      case 'switch-state':
        if (params.stateId && params.stateId !== this.stateId) {
          if (this.transitionDelayRemaining > 0 || this.pendingShots.length > 0 || this.pendingBeams.length > 0 || this.pendingHomingMissiles.length > 0) {
            this.pendingStateSwitch = params.stateId;
          } else {
            this.stateId = params.stateId;
            this.stateTimer = 0;
            this.applyCollisionBodyFromZones();
          }
        }
        break;
      case 'reverse-direction':
        this.facing *= -1;
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
      case 'delay':
        this.transitionDelayRemaining = Math.max(this.transitionDelayRemaining, Math.max(0, Number(params.ms || 0)) / 1000);
        break;
      case 'rewind-animation':
        this.stateTimer = 0;
        break;
      case 'emit-particles': {
        const key = action?.id || 'emit-particles';
        const cooldown = Math.max(0, Number(params.cooldownMs ?? 100) / 1000);
        if (cooldown > 0 && this.actionCooldowns.get(key) > 0) break;
        const spawn = this.getActionSpawnPoint(params);
        const angle = this.getActionAngle({ ...params, targetPlayer: false }, player, spawn.x, spawn.y);
        context.emitParticles?.(spawn.x, spawn.y, angle, { ...params, facing: this.facing });
        if (cooldown > 0) this.actionCooldowns.set(key, cooldown);
        const repeatDuration = Math.max(0, Number(params.durationMs || params._repeatDurationMs || 0) / 1000);
        if (repeatDuration > 0) {
          this.activeParticleEmitters.push({
            key,
            params: { ...params, durationMs: 0, _repeatDurationMs: 0 },
            remaining: repeatDuration,
            timer: Math.max(0.016, cooldown || 0.016)
          });
        }
        break;
      }
      case 'spawn-bullets': {
        const shotCount = Math.max(1, Math.floor(Number(params.shots || 1)));
        const shotDelay = Math.max(0, Number(params.shotDelayMs || 0)) / 1000;
        for (let i = 0; i < shotCount; i += 1) {
          this.pendingShots.push({
            timer: i * shotDelay,
            params: { ...params }
          });
        }
        break;
      }
      case 'spawn-beam': {
        const key = action?.id || 'spawn-beam';
        if (this.actionCooldowns.get(key) > 0) break;
        const duration = Math.max(0.05, Number(params.durationMs || 1000) / 1000);
        this.pendingBeams.push({ timer: Math.max(0, Number(params.delayMs || 0)) / 1000, params: { ...params } });
        this.actionCooldowns.set(key, duration + Math.max(0, Number(params.delayMs || 0)) / 1000);
        break;
      }
      case 'spawn-homing-missile': {
        const shotCount = Math.max(1, Math.floor(Number(params.shots || 1)));
        const shotDelay = Math.max(0, Number(params.shotDelayMs || 0)) / 1000;
        for (let i = 0; i < shotCount; i += 1) {
          this.pendingHomingMissiles.push({ timer: i * shotDelay, params: { ...params } });
        }
        break;
      }
      case 'become-invulnerable':
        this.invulnerable = true;
        break;
      case 'become-vulnerable':
        this.invulnerable = false;
        break;
      case 'enable-body-damage':
        this.bodyDamageEnabled = true;
        break;
      case 'disable-body-damage':
        this.bodyDamageEnabled = false;
        break;
      case 'play-midi':
        context.playMidi?.(String(params.trackId || '').trim(), {
          fadeMs: Math.max(0, Number(params.fadeMs || 0))
        });
        break;
      case 'stop-midi':
        context.stopMidi?.(String(params.trackId || '').trim(), {
          fadeMs: Math.max(0, Number(params.fadeMs || 0))
        });
        break;
      case 'play-fx':
        context.playFx?.(String(params.fxId || '').trim(), {
          volume: Math.max(0, Number(params.volume ?? 1)),
          pitchCents: Number(params.pitchCents || 0),
          loop: Boolean(params.loop),
          key: action?.id || String(params.fxId || '').trim()
        });
        break;
      case 'stop-fx':
        context.stopFx?.(String(params.fxId || '').trim());
        break;
      default:
        break;
    }
  }

  applyMovement(dt, player, context = {}) {
    const state = this.currentState;
    const movement = state?.movement || { type: 'none', params: {} };
    const params = movement.params || {};
    const dx = player.x - this.x;
    switch (movement.type) {
      case 'patrol-platform':
        this.vx = this.facing * Number(params.speed || 100);
        this.x += this.vx * dt;
        break;
      case 'random-walk-pause': {
        const cycle = Number(params.walkDuration || 1) + Number(params.pauseDuration || 1);
        const phase = this.stateTimer % cycle;
        const walking = phase < Number(params.walkDuration || 1);
        if (walking && context.isWallAhead?.(this)) this.facing *= -1;
        if (walking && context.hasGroundAhead && !context.hasGroundAhead(this)) this.facing *= -1;
        this.vx = walking ? this.facing * Number(params.speed || 80) : 0;
        if (phase < dt) this.facing *= Math.random() < 0.5 ? -1 : 1;
        this.x += this.vx * dt;
        break;
      }
      case 'avoid-player':
        if (Math.abs(dx) < Number(params.fleeDistance || 240)) this.vx = -Math.sign(dx || this.facing) * Number(params.speed || 160); else this.vx = 0;
        this.x += this.vx * dt;
        break;
      case 'approach-player':
        if (Math.abs(dx) < Number(params.aggroRange || 220)) this.vx = Math.sign(dx || this.facing) * Number(params.speed || 120); else this.vx = 0;
        this.x += this.vx * dt;
        break;
      case 'pause-bounce': {
        const pause = Number(params.pauseDuration || 0.35);
        const cycle = pause + 0.5;
        const phase = this.stateTimer % cycle;
        if (phase >= pause && phase < pause + dt) this.vy = -Math.abs(Number(params.jumpSpeed || 260));
        this.vx = Math.sign(dx || this.facing) * Number(params.speed || 90) * (phase < pause ? 0 : 1);
        this.x += this.vx * dt;
        break;
      }
      case 'maintain-distance': {
        const preferred = Number(params.preferredDistance || 180);
        const tolerance = Number(params.tolerance || 40);
        const speed = Number(params.speed || 120);
        if (Math.abs(dx) < preferred - tolerance) this.vx = -Math.sign(dx || this.facing) * speed;
        else if (Math.abs(dx) > preferred + tolerance) this.vx = Math.sign(dx || this.facing) * speed;
        else this.vx = 0;
        this.x += this.vx * dt;
        break;
      }
      case 'float':
        this.y = this.baseY + Math.sin(this.stateTimer * Number(params.floatSpeed || 2)) * Number(params.amplitude || 20);
        this.x = this.baseX + Math.cos(this.stateTimer * 0.7) * Number(params.drift || 18);
        this.gravity = false;
        break;
      default:
        break;
    }
    if (this.definition.facingMode === 'face-player') {
      this.facing = Math.sign(dx) || this.facing;
    }
  }

  update(dt, player, context = {}) {
    if (this.dead) {
      this.tookDamageThisFrame = false;
      this.damagedPlayerThisFrame = false;
      return;
    }
    const timerDt = Number.isFinite(Number(context.actorTimerDt)) ? Number(context.actorTimerDt) : dt;
    this.stateTimer += timerDt;
    this.tickActionCooldowns(timerDt);
    this.applyMovement(dt, player, context);
    this.tickPendingShots(timerDt, player, context);
    this.tickPendingBeams(timerDt, player, context);
    this.tickPendingHomingMissiles(timerDt, player, context);
    this.tickActiveParticleEmitters(timerDt, player, context);
    if (this.pendingStateSwitch && this.transitionDelayRemaining <= 0 && this.pendingShots.length === 0 && this.pendingBeams.length === 0 && this.pendingHomingMissiles.length === 0) {
      this.stateId = this.pendingStateSwitch;
      this.stateTimer = 0;
      this.applyCollisionBodyFromZones();
      this.pendingStateSwitch = null;
      this.activeParticleEmitters = [];
    }
    if (this.transitionDelayRemaining <= 0) {
      this.checkStateTransition(player, context);
    }
    const overrides = this.currentState?.overrides || {};
    this.bodyDamageEnabled = overrides.bodyDamageEnabled == null ? this.definition.bodyDamageEnabled : !!overrides.bodyDamageEnabled;
    this.contactDamage = overrides.contactDamage == null ? this.definition.contactDamage : Number(overrides.contactDamage || 0);
    this.invulnerable = overrides.invulnerable == null ? this.definition.invulnerable : !!overrides.invulnerable;
    this.stagger = Math.max(0, this.stagger - timerDt * 0.5);
    this.tookDamageThisFrame = false;
    this.damagedPlayerThisFrame = false;
  }

  updateDuringHitPause(dt, player, context = {}) {
    this.update(0, player, { ...context, actorTimerDt: dt });
  }

  tickPendingShots(dt, player, context = {}) {
    if (this.transitionDelayRemaining > 0) {
      this.transitionDelayRemaining = Math.max(0, this.transitionDelayRemaining - dt);
    }
    for (let i = this.pendingShots.length - 1; i >= 0; i -= 1) {
      const shot = this.pendingShots[i];
      shot.timer -= dt;
      if (shot.timer > 0) continue;
      const p = shot.params || {};
      const spawn = this.getActionSpawnPoint(p);
      const angle = this.getActionAngle({ ...p, targetPlayer: !!p.aimAtPlayer }, player, spawn.x, spawn.y);
      const speed = Number(p.speed || 220);
      if (p.restartAnimationEachShot) this.stateTimer = 0;
      context.spawnProjectile?.(spawn.x, spawn.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, { artRef: p.projectileArtRef || '', owner: this });
      this.pendingShots.splice(i, 1);
    }
  }

  tickActiveParticleEmitters(dt, player, context = {}) {
    for (let i = this.activeParticleEmitters.length - 1; i >= 0; i -= 1) {
      const emitter = this.activeParticleEmitters[i];
      emitter.remaining -= dt;
      emitter.timer -= dt;
      const interval = Math.max(0.016, Number(emitter.params?.cooldownMs ?? 100) / 1000);
      while (emitter.remaining > 0 && emitter.timer <= 0) {
        const spawn = this.getActionSpawnPoint(emitter.params);
        const angle = this.getActionAngle({ ...emitter.params, targetPlayer: false }, player, spawn.x, spawn.y);
        context.emitParticles?.(spawn.x, spawn.y, angle, { ...emitter.params, facing: this.facing });
        emitter.timer += interval;
      }
      if (emitter.remaining <= 0) {
        this.activeParticleEmitters.splice(i, 1);
      }
    }
  }

  getActionSpawnPoint(params = {}) {
    const authored = this.getZoneCoordinateSize();
    const art = this.getDefinitionArtDimensions();
    const pickerSpace = {
      width: Math.max(authored.width, art?.width > 0 ? (art.width / 16) * 32 : 0),
      height: Math.max(authored.height, art?.height > 0 ? (art.height / 16) * 32 : 0)
    };
    const visual = this.getVisualDimensions();
    const scaleX = visual.width / Math.max(1, pickerSpace.width || authored.width);
    const scaleY = visual.height / Math.max(1, pickerSpace.height || authored.height);
    return {
      x: this.x + Number(params.offsetX || 0) * scaleX * (this.facing < 0 ? -1 : 1),
      y: this.y + Number(params.offsetY || 0) * scaleY
    };
  }

  getActionAngle(params = {}, player = null, spawnX = this.x, spawnY = this.y) {
    const angleOffset = Number(params.angle || 0);
    let localAngle = angleOffset;
    if (params.targetPlayer && player) {
      const worldAngle = Math.atan2((player.y + Number(params.targetOffsetY || 0)) - spawnY, (player.x + Number(params.targetOffsetX || 0)) - spawnX);
      localAngle = worldAngleToActorLocal(worldAngle, this.facing) + angleOffset;
    }
    if (Number.isFinite(Number(params.minAngle)) && Number.isFinite(Number(params.maxAngle))) {
      localAngle = clampAngle(localAngle, Number(params.minAngle), Number(params.maxAngle));
    }
    return actorLocalAngleToWorld(localAngle, this.facing);
  }

  tickPendingBeams(dt, player, context = {}) {
    for (let i = this.pendingBeams.length - 1; i >= 0; i -= 1) {
      const beam = this.pendingBeams[i];
      beam.timer -= dt;
      if (beam.timer > 0) continue;
      const p = beam.params || {};
      const spawn = this.getActionSpawnPoint(p);
      const accuracy = Math.max(0, Number(p.accuracy || 0)) * (Math.PI / 180);
      const localMinAngle = Number.isFinite(Number(p.minAngle)) ? Number(p.minAngle) : -Math.PI;
      const localMaxAngle = Number.isFinite(Number(p.maxAngle)) ? Number(p.maxAngle) : Math.PI;
      const baseAngle = this.getActionAngle(p, player, spawn.x, spawn.y);
      const localAngle = clampAngle(
        worldAngleToActorLocal(baseAngle, this.facing) + (accuracy > 0 ? (Math.random() * 2 - 1) * accuracy : 0),
        localMinAngle,
        localMaxAngle
      );
      const angle = actorLocalAngleToWorld(localAngle, this.facing);
      context.spawnBeam?.(spawn.x, spawn.y, angle, {
        targetPlayer: p.targetPlayer !== false,
        targetOffsetX: Number(p.targetOffsetX || 0),
        targetOffsetY: Number(p.targetOffsetY || 0),
        facing: this.facing,
        minAngle: localMinAngle,
        maxAngle: localMaxAngle,
        duration: Math.max(0.05, Number(p.durationMs || 1000) / 1000),
        maxDistance: Number(p.maxDistance || 640),
        rotationSpeed: Number(p.rotationSpeed || 180) * (Math.PI / 180),
        trailLife: Math.max(0, Number(p.trailLifeMs || 0) / 1000),
        damage: Number(p.damage || 1),
        width: Number(p.width || 10),
        startArtRef: p.startArtRef || '',
        repeatArtRef: p.repeatArtRef || '',
        impactArtRef: p.impactArtRef || ''
      });
      this.pendingBeams.splice(i, 1);
    }
  }

  tickPendingHomingMissiles(dt, player, context = {}) {
    for (let i = this.pendingHomingMissiles.length - 1; i >= 0; i -= 1) {
      const shot = this.pendingHomingMissiles[i];
      shot.timer -= dt;
      if (shot.timer > 0) continue;
      const p = shot.params || {};
      const spawn = this.getActionSpawnPoint(p);
      const angle = this.getActionAngle({ ...p, targetPlayer: false }, player, spawn.x, spawn.y);
      context.spawnHomingMissile?.(spawn.x, spawn.y, angle, {
        targetPlayer: p.targetPlayer !== false,
        targetOffsetX: Number(p.targetOffsetX || 0),
        targetOffsetY: Number(p.targetOffsetY || 0),
        initialSpeed: Number(p.initialSpeed || 80),
        acceleration: Number(p.acceleration || 260),
        maxSpeed: Number(p.maxSpeed || 260),
        turnSpeed: Number(p.turnSpeed || 180) * (Math.PI / 180),
        duration: Math.max(0.1, Number(p.durationMs || 4000) / 1000),
        damage: Number(p.damage || 1),
        radius: Number(p.radius || 10),
        missileArtRef: p.missileArtRef || '',
        explosionArtRef: p.explosionArtRef || '',
        smokeArtRef: p.smokeArtRef || ''
      });
      this.pendingHomingMissiles.splice(i, 1);
    }
  }

  getAnimationFrames() {
    const state = this.currentState;
    if (!state?.animation) return [];
    const artRef = typeof state.animation.artRef === 'string' ? state.animation.artRef : '';
    if (artRef) {
      if (this._artAnimationCache.has(artRef)) {
        return this._artAnimationCache.get(artRef);
      }
      const doc = loadProjectFile('art', artRef);
      const frames = Array.isArray(doc?.data?.frames) ? doc.data.frames : [];
      if (frames.length && typeof document !== 'undefined') {
        const width = Math.max(1, Number(doc?.data?.width || doc?.data?.size || 16));
        const height = Math.max(1, Number(doc?.data?.height || doc?.data?.size || width || 16));
        const durationMs = Math.round(1000 / Math.max(1, Number(state.animation.fps || doc?.data?.fps || 8)));
        const resolved = frames.map((frame) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          const imageData = ctx.createImageData(width, height);
          for (let i = 0; i < width * height; i += 1) {
            const color = frame?.[i];
            const base = i * 4;
            if (typeof color !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(color)) {
              imageData.data[base + 3] = 0;
              continue;
            }
            const hex = color.startsWith('#') ? color.slice(1) : color;
            imageData.data[base] = parseInt(hex.slice(0, 2), 16);
            imageData.data[base + 1] = parseInt(hex.slice(2, 4), 16);
            imageData.data[base + 2] = parseInt(hex.slice(4, 6), 16);
            imageData.data[base + 3] = 255;
          }
          ctx.putImageData(imageData, 0, 0);
          return { imageDataUrl: canvas.toDataURL('image/png'), durationMs };
        }).filter(Boolean);
        this._artAnimationCache.set(artRef, resolved);
        if (resolved.length) return resolved;
      }
    }
    const fromFrames = Array.isArray(state.animation.frames)
      ? state.animation.frames.filter((frame) => frame?.imageDataUrl)
      : [];
    if (fromFrames.length) return fromFrames;
    if (state.animation.imageDataUrl) {
      return [{
        imageDataUrl: state.animation.imageDataUrl,
        durationMs: Math.round(1000 / Math.max(1, Number(state.animation.fps || 8)))
      }];
    }
    return [];
  }

  getCurrentAnimationFrame() {
    const frames = this.getAnimationFrames();
    if (!frames.length) return null;
    const totalDurationMs = frames.reduce((sum, frame) => sum + Math.max(16, Number(frame.durationMs || 120)), 0);
    if (totalDurationMs <= 0) return frames[0];
    let cursor = ((this.stateTimer * 1000) % totalDurationMs + totalDurationMs) % totalDurationMs;
    for (const frame of frames) {
      const durationMs = Math.max(16, Number(frame.durationMs || 120));
      if (cursor <= durationMs) return frame;
      cursor -= durationMs;
    }
    return frames[frames.length - 1];
  }

  getFrameImage(imageDataUrl) {
    if (!imageDataUrl || typeof Image === 'undefined') return null;
    let entry = this._imageCache.get(imageDataUrl);
    if (!entry) {
      const image = new Image();
      entry = { image, ready: false };
      image.onload = () => { entry.ready = true; };
      image.onerror = () => {
        this._imageCache.delete(imageDataUrl);
      };
      image.src = imageDataUrl;
      this._imageCache.set(imageDataUrl, entry);
    }
    return entry.ready ? entry.image : null;
  }

  getHealthTintAlpha() {
    const tint = this.healthTint || {};
    if (!tint.enabled || this.maxHealth <= 0) return 0;
    if (this.currentState?.disableHealthTint === true) return 0;
    if (this.dead && tint.keepAfterDeath !== true) return 0;
    const missingRatio = Math.max(0, Math.min(1, 1 - (Math.max(0, Number(this.health || 0)) / this.maxHealth)));
    const maxIntensity = Math.max(0, Math.min(1, Number(tint.maxIntensity ?? 0.1)));
    return missingRatio * maxIntensity;
  }

  draw(ctx) {
    const frame = this.getCurrentAnimationFrame();
    const image = this.getFrameImage(frame?.imageDataUrl || '');
    const drawImage = image || this._lastFrameImage;
    if (image) {
      this._lastFrameImage = image;
    }
    if (!drawImage) {
      if (frame?.imageDataUrl) return;
      super.draw(ctx);
      return;
    }
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    const visual = this.getVisualDimensions(drawImage);
    const drawW = visual.width;
    const drawH = visual.height;
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.imageSmoothingEnabled = false;
    if (this.facing < 0) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(drawImage, -drawW / 2, -drawH / 2, drawW, drawH);
    const tintAlpha = this.getHealthTintAlpha();
    if (tintAlpha > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = tintAlpha;
      ctx.fillStyle = String(this.healthTint?.color || '#ff3333');
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
    if (flash) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();
  }
}
