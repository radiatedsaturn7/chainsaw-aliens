import EnemyBase from './EnemyBase.js';
import { ensureActorDefinition } from '../content/actorEditorData.js';
import { vfsLoad } from '../ui/vfs.js';

const actorCache = new Map();

export function loadActorDefinitionById(actorId) {
  if (!actorId || typeof window === 'undefined') return null;
  if (actorCache.has(actorId)) return actorCache.get(actorId);
  try {
    const index = JSON.parse(window.localStorage.getItem('robter:vfs:index') || 'null');
    const actors = Object.keys(index?.actors || {});
    for (const name of actors) {
      const payload = JSON.parse(window.localStorage.getItem(`robter:vfs:actors:${name}`) || 'null');
      const data = ensureActorDefinition(payload?.data || null);
      if (data.id === actorId) {
        actorCache.set(actorId, data);
        return data;
      }
    }
  } catch (error) {
    console.warn('Failed to load actor definition', error);
  }
  return null;
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
    this.gravity = this.definition.gravity;
    this.invulnerable = this.definition.invulnerable;
    this.contactDamage = this.definition.contactDamage;
    this.bodyDamageEnabled = this.definition.bodyDamageEnabled;
    this.destructible = this.definition.destructible;
    this.attackTarget = this.definition.attackTarget;
    this.taxonomies = Array.isArray(this.definition.taxonomies) ? [...this.definition.taxonomies] : [];
    this.aggressiveTo = Array.isArray(this.definition.aggressiveTo) ? [...this.definition.aggressiveTo] : [];
    this.stateId = this.definition.initialStateId;
    this.stateTimer = 0;
    this.cooldowns = new Map();
    this.baseX = x;
    this.baseY = y;
    this.linkedChildren = [];
    this.lootTable = this.definition.loot || [];
    this._imageCache = new Map();
    this._artAnimationCache = new Map();
    this.tookDamageThisFrame = false;
    this.damagedPlayerThisFrame = false;
  }

  get currentState() {
    return this.definition.states.find((state) => state.id === this.stateId) || this.definition.states[0];
  }

  damage(amount) {
    if (this.invulnerable || !this.destructible) return;
    const beforeHealth = this.health;
    super.damage(amount);
    if (this.health < beforeHealth) {
      this.tookDamageThisFrame = true;
    }
  }

  onDamagedPlayer() {
    this.damagedPlayerThisFrame = true;
  }

  evaluateCondition(condition, player, _context = {}) {
    const params = condition?.params || {};
    const stateAggroRange = Number(this.currentState?.movement?.params?.aggroRange || 220);
    const visibilityRange = Number(params.range || params.distance || stateAggroRange || 220);
    const playerDistance = Math.hypot(player.x - this.x, player.y - this.y);
    switch (condition?.type) {
      case 'always': return true;
      case 'timer-elapsed': return this.stateTimer >= Number(params.seconds || 0);
      case 'actor-health-below': return this.maxHealth > 0 && (this.health / this.maxHealth) <= Number(params.ratio ?? 0.5);
      case 'can-see-player': return playerDistance <= visibilityRange;
      case 'cannot-see-player': return playerDistance > visibilityRange;
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
      actions.forEach((action) => this.runAction(action, player, context));
      if (this.stateId !== beforeStateId) return;
      return;
    }
  }

  runAction(action, player, context) {
    const params = action?.params || {};
    switch (action?.type) {
      case 'switch-state':
        if (params.stateId && params.stateId !== this.stateId) {
          this.stateId = params.stateId;
          this.stateTimer = 0;
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
      case 'spawn-bullets': {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = params.aimAtPlayer ? Math.atan2(dy, dx) : Number(params.angle || 0);
        const speed = Number(params.speed || 220);
        context.spawnProjectile?.(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1);
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
    this.facing = Math.sign(dx) || this.facing;
  }

  update(dt, player, context = {}) {
    if (this.dead) {
      this.tookDamageThisFrame = false;
      this.damagedPlayerThisFrame = false;
      return;
    }
    this.stateTimer += dt;
    this.applyMovement(dt, player, context);
    this.checkStateTransition(player, context);
    const overrides = this.currentState?.overrides || {};
    this.bodyDamageEnabled = overrides.bodyDamageEnabled == null ? this.definition.bodyDamageEnabled : !!overrides.bodyDamageEnabled;
    this.contactDamage = overrides.contactDamage == null ? this.definition.contactDamage : Number(overrides.contactDamage || 0);
    this.invulnerable = overrides.invulnerable == null ? this.definition.invulnerable : !!overrides.invulnerable;
    this.stagger = Math.max(0, this.stagger - dt * 0.5);
    this.tookDamageThisFrame = false;
    this.damagedPlayerThisFrame = false;
  }

  getAnimationFrames() {
    const state = this.currentState;
    if (!state?.animation) return [];
    const artRef = typeof state.animation.artRef === 'string' ? state.animation.artRef : '';
    if (artRef) {
      const doc = vfsLoad('art', artRef);
      const docWidth = Number(doc?.data?.width || doc?.data?.size || 0);
      const docHeight = Number(doc?.data?.height || doc?.data?.size || 0);
      if (docWidth > 0 && docHeight > 0) {
        this.width = docWidth;
        this.height = docHeight;
      }
      const savedAt = Number(doc?.savedAt || 0);
      const cacheKey = `${artRef}:${savedAt}`;
      if (this._artAnimationCache.has(cacheKey)) {
        return this._artAnimationCache.get(cacheKey);
      }
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
        this._artAnimationCache.clear();
        this._artAnimationCache.set(cacheKey, resolved);
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

  draw(ctx) {
    const frame = this.getCurrentAnimationFrame();
    const image = this.getFrameImage(frame?.imageDataUrl || '');
    if (!image) {
      super.draw(ctx);
      return;
    }
    const { x: offsetX, y: offsetY, flash } = this.getDamageOffset();
    const nativeW = Number(image?.naturalWidth || image?.width || 0);
    const nativeH = Number(image?.naturalHeight || image?.height || 0);
    const imageScaledW = nativeW > 0 ? (nativeW / 16) * 32 : 0;
    const imageScaledH = nativeH > 0 ? (nativeH / 16) * 32 : 0;
    const drawW = Math.max(this.width, imageScaledW || 0);
    const drawH = Math.max(this.height, imageScaledH || 0);
    ctx.save();
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.imageSmoothingEnabled = false;
    if (this.facing < 0) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    if (flash) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();
  }
}
