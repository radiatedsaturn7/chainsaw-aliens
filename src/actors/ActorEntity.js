import { loadActorArtSource } from './art.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class ActorEntity {
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
    this.elapsed = 0;
    this.stateId = instance.startState || definition.states[0]?.id || 'idle';
    this.attackCooldown = 0;
    this.asset = null;
    this.facing = instance.facing || 1;
    this.refreshAsset();
  }

  refreshAsset() { this.asset = loadActorArtSource(this.definition.visuals); }
  get state() { return this.definition.states.find((entry) => entry.id === this.stateId) || this.definition.states[0]; }
  get clip() { return this.definition.clips.find((entry) => entry.id === this.state?.clipId) || this.definition.clips[0]; }

  applyStateTransitions(distance) {
    const state = this.state;
    if (!state?.transitions?.length) return;
    for (const transition of state.transitions) {
      if (transition.condition === 'timerElapsed' && this.elapsed >= transition.value) { this.stateId = transition.targetStateId || this.stateId; this.elapsed = 0; break; }
      if (transition.condition === 'playerInRange' && distance <= transition.value) { this.stateId = transition.targetStateId || this.stateId; this.elapsed = 0; break; }
      if (transition.condition === 'randomChance' && Math.random() <= transition.chance * 0.02) { this.stateId = transition.targetStateId || this.stateId; this.elapsed = 0; break; }
    }
  }

  update(dt, game) {
    this.elapsed += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const behavior = this.definition.behavior || {};
    const player = game.player;
    const dx = player.x - this.x;
    const distance = Math.hypot(dx, player.y - this.y);
    const speed = Number(behavior.movementSpeed || this.definition.stats.moveSpeed || 0);
    this.applyStateTransitions(distance);
    if (behavior.mode === 'wander') {
      const radius = Number(behavior.wanderRadius || 48);
      const offset = Math.sin(this.elapsed * 0.85 + this.instance.x) * radius;
      this.x = this.homeX + offset;
      this.facing = Math.sign(offset) || this.facing;
    } else if ((behavior.mode === 'chase' || behavior.mode === 'meleeAttacker' || behavior.mode === 'rangedAttacker') && this.definition.alignment === 'enemy') {
      const range = Number(behavior.aggroRange || this.definition.stats.aggroRange || 96);
      if (distance <= range) {
        const dir = dx / Math.max(distance, 1);
        if (distance > Number(behavior.preferredAttackRange || 32)) this.x += dir * speed * dt;
        this.facing = Math.sign(dir) || this.facing;
      }
    } else if (behavior.mode === 'patrol') {
      const points = this.instance.patrolPoints?.length ? this.instance.patrolPoints : behavior.patrolPoints || [];
      if (points.length) {
        const target = points[Math.floor(this.elapsed * 0.25) % points.length];
        const tx = (target.x + 0.5) * this.tileSize;
        this.x += clamp(tx - this.x, -1, 1) * speed * dt;
      }
    }
  }

  draw(ctx) {
    if (this.instance.enabled === false) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.facing < 0) ctx.scale(-1, 1);
    const clip = this.clip;
    const asset = this.asset;
    if (asset && clip) {
      const frameCount = Math.max(1, clip.endFrame - clip.startFrame + 1);
      const frameIndex = clip.startFrame + (Math.floor(this.elapsed * clip.fps) % frameCount);
      const frame = asset.buildFrameCanvas(frameIndex);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      ctx.fillStyle = this.definition.editor?.color || '#8ecae6';
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.strokeStyle = '#081018';
      ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.fillStyle = '#081018';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(this.definition.editor?.glyph || 'AC', 0, 4);
    }
    ctx.restore();
  }
}
