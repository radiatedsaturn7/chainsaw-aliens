import TEST_MAP from './TestMap.js';
import { getDashDistance } from '../game/MovementModel.js';

function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export default class TestHarness {
  constructor() {
    this.active = false;
    this.invulnerable = false;
    this.slowMotion = false;
    this.showCollision = false;
    this.showBoxes = false;
    this.seeded = false;
    this.executionVariants = new Set();
    this.combatChecks = {
      hit: false,
      stagger: false,
      execute: false
    };
    this.originalRandom = Math.random;
  }

  enable(world, player) {
    this.active = true;
    world.applyData(TEST_MAP);
    player.x = world.tileSize * 4;
    player.y = world.tileSize * 9;
    this.executionVariants.clear();
    this.combatChecks = {
      hit: false,
      stagger: false,
      execute: false
    };
  }

  toggleSeeded() {
    this.seeded = !this.seeded;
    if (this.seeded) {
      const rng = createSeededRandom(1337);
      Math.random = rng;
    } else {
      Math.random = this.originalRandom;
    }
  }

  recordExecution(variant) {
    this.executionVariants.add(variant);
    this.combatChecks.execute = true;
  }

  recordHit() {
    this.combatChecks.hit = true;
  }

  recordStagger() {
    this.combatChecks.stagger = true;
  }

  update(input, game) {
    if (!this.active) return;
    if (input.wasPressedCode('KeyI')) this.invulnerable = !this.invulnerable;
    if (input.wasPressedCode('KeyO')) this.slowMotion = !this.slowMotion;
    if (input.wasPressedCode('KeyC')) this.showCollision = !this.showCollision;
    if (input.wasPressedCode('KeyY')) this.toggleSeeded();

    if (input.wasPressedCode('KeyG')) game.abilities.anchor = !game.abilities.anchor;
    if (input.wasPressedCode('KeyP')) game.abilities.flame = !game.abilities.flame;
    if (input.wasPressedCode('KeyM')) game.abilities.magboots = !game.abilities.magboots;
    if (input.wasPressedCode('KeyR')) game.abilities.resonance = !game.abilities.resonance;

    const regionKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    regionKeys.forEach((key, index) => {
      if (input.wasPressedCode(key)) {
        const region = game.world.regions[index];
        if (region) {
          const [rx, ry, rw, rh] = region.rect;
          game.player.x = (rx + Math.floor(rw / 2)) * game.world.tileSize;
          game.player.y = (ry + Math.floor(rh / 2)) * game.world.tileSize;
        }
      }
    });
  }

  applyCheats(game) {
    if (!this.active) return;
    if (this.invulnerable) {
      game.player.health = game.player.maxHealth;
      game.player.dead = false;
    }
  }

  draw(ctx, game, width, height) {
    if (!this.active) return;
    const jumpHeight = (game.player.jumpPower ** 2) / (2 * 1200);
    const jumpTiles = (jumpHeight / game.world.tileSize).toFixed(1);
    const dashDistance = getDashDistance() / game.world.tileSize;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(width - 280, 20, 260, 190);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(width - 280, 20, 260, 190);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('TEST MODE', width - 268, 40);
    ctx.fillText(`Invulnerable (I): ${this.invulnerable ? 'ON' : 'OFF'}`, width - 268, 58);
    ctx.fillText(`Slow Motion (O): ${this.slowMotion ? 'ON' : 'OFF'}`, width - 268, 74);
    ctx.fillText(`Show Collision (C): ${this.showCollision ? 'ON' : 'OFF'}`, width - 268, 90);
    ctx.fillText(`Seeded RNG (Y): ${this.seeded ? 'ON' : 'OFF'}`, width - 268, 106);
    ctx.fillText(`Jump Height: ${jumpTiles} tiles`, width - 268, 138);
    ctx.fillText(`Dash Distance: ${dashDistance.toFixed(1)} tiles`, width - 268, 154);
    ctx.fillText('Teleport: 1-6 (regions)', width - 268, 170);
    ctx.restore();

    this.drawExecutionChecklist(ctx, width, height);
    this.drawActionFeedback(ctx, game, width, height);
    this.drawCombatChecklist(ctx, width, height);
  }

  drawExecutionChecklist(ctx, width, height) {
    const variants = ['front', 'back', 'air', 'wall'];
    const missing = variants.filter((variant) => !this.executionVariants.has(variant));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, 20, 220, 120);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 20, 220, 120);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('EXECUTION CHECK', 32, 40);
    variants.forEach((variant, index) => {
      const status = this.executionVariants.has(variant) ? '✓' : '✗';
      ctx.fillText(`${status} ${variant}`, 32, 58 + index * 16);
    });
    if (missing.length) {
      ctx.fillText(`Missing: ${missing.join(', ')}`, 32, 122);
    }
    ctx.restore();
  }

  drawActionFeedback(ctx, game, width, height) {
    const results = game.actionFeedback.summary(game.clock);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(width - 280, height - 240, 260, 220);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(width - 280, height - 240, 260, 220);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('ACTION FEEDBACK', width - 268, height - 220);
    results.forEach((item, index) => {
      const icon = item.status === 'pass' ? '✓' : item.status === 'warn' ? '!' : '✗';
      ctx.fillText(`${icon} ${item.action}`, width - 268, height - 200 + index * 14);
    });
    ctx.restore();
  }

  drawCombatChecklist(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, height - 120, 220, 92);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, height - 120, 220, 92);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('COMBAT CHECK', 32, height - 100);
    const lines = [
      ['Damage enemy', this.combatChecks.hit],
      ['Stagger enemy', this.combatChecks.stagger],
      ['Execute enemy', this.combatChecks.execute]
    ];
    lines.forEach((line, index) => {
      const icon = line[1] ? '✓' : '✗';
      ctx.fillText(`${icon} ${line[0]}`, 32, height - 80 + index * 16);
    });
    ctx.restore();
  }
}
