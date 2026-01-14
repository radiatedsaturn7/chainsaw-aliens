import Input from './Input.js';
import Camera from './Camera.js';
import AudioSystem from './Audio.js';
import World from '../world/World.js';
import Minimap from '../world/Minimap.js';
import Player from '../entities/Player.js';
import Skitter from '../entities/Skitter.js';
import Spitter from '../entities/Spitter.js';
import Bulwark from '../entities/Bulwark.js';
import Floater from '../entities/Floater.js';
import Slicer from '../entities/Slicer.js';
import HiveNode from '../entities/HiveNode.js';
import SentinelElite from '../entities/SentinelElite.js';
import FinalBoss from '../entities/FinalBoss.js';
import Projectile from '../entities/Projectile.js';
import { DebrisPiece, Shard } from '../entities/Debris.js';
import LootDrop from '../entities/LootDrop.js';
import PracticeDrone from '../entities/PracticeDrone.js';
import Title from '../ui/Title.js';
import Dialog from '../ui/Dialog.js';
import HUD from '../ui/HUD.js';
import Shop from '../ui/Shop.js';
import Pause from '../ui/Pause.js';
import TestHarness from '../debug/TestHarness.js';
import Validator from '../debug/Validator.js';
import ConsoleOverlay from '../debug/ConsoleOverlay.js';
import Checklist from '../debug/Checklist.js';

const INTRO_LINES = [
  'Captain! The entire planet of earth has literally run out of all our ammunition, and the aliens are still coming! What do we do?',
  'There is only one solution left...',
  'We have to...',
  'Chainsaw Aliens.'
];

const UPGRADE_LIST = [
  { id: 'tooth-razor', name: 'Tooth Profile: Razor Edge', slot: 'tooth', cost: 15, modifiers: { revEfficiency: 0.2 } },
  { id: 'tooth-serrated', name: 'Tooth Profile: Serrated Bite', slot: 'tooth', cost: 20, modifiers: { revEfficiency: 0.3 } },
  { id: 'drive-torque', name: 'Drivetrain: Torque Lube', slot: 'drivetrain', cost: 25, modifiers: { speed: 20 } },
  { id: 'drive-pulse', name: 'Drivetrain: Pulse Drive', slot: 'drivetrain', cost: 30, modifiers: { dashCooldown: -0.1 } },
  { id: 'coolant-mist', name: 'Coolant: Mist Jet', slot: 'coolant', cost: 18, modifiers: { heatCap: 0.3 } },
  { id: 'coolant-phase', name: 'Coolant: Phase Vapor', slot: 'coolant', cost: 24, modifiers: { heatCap: 0.5 } },
  { id: 'bar-grapple', name: 'Bar Attachment: Grapple Hook', slot: 'bar', cost: 28, modifiers: { speed: 10 } },
  { id: 'bar-piercer', name: 'Bar Attachment: Piercer', slot: 'bar', cost: 32, tags: ['pierce'] },
  { id: 'gadget-shock', name: 'Gadget: Shock Emitters', slot: 'gadget', cost: 26, tags: ['shock'] },
  { id: 'gadget-echo', name: 'Gadget: Resonant Echo', slot: 'gadget', cost: 22, modifiers: { jump: 30 } },
  { id: 'slot-expander', name: 'Slot Expansion Alpha', slot: 'frame', cost: 35, tags: ['slot'] },
  { id: 'slot-expander-2', name: 'Slot Expansion Beta', slot: 'frame', cost: 45, tags: ['slot'] }
];

export default class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = new Input();
    this.audio = new AudioSystem();
    this.world = new World();
    this.camera = new Camera(canvas.width, canvas.height);
    this.minimap = new Minimap(this.world);
    this.player = new Player(32 * 28, 32 * 18);
    this.player.applyUpgrades(this.player.equippedUpgrades);
    this.title = new Title();
    this.dialog = new Dialog(INTRO_LINES);
    this.hud = new HUD();
    this.pauseMenu = new Pause();
    this.shopUI = new Shop(UPGRADE_LIST);
    this.state = 'loading';
    this.enemies = [];
    this.projectiles = [];
    this.debris = [];
    this.shards = [];
    this.lootDrops = [];
    this.abilities = {
      grapple: false,
      phase: false,
      magboots: false,
      resonance: false
    };
    this.objective = 'Reach the Hub Pylon.';
    this.lastSave = { x: this.player.x, y: this.player.y };
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.slowTimer = 0;
    this.boss = null;
    this.bossInteractions = {
      grapple: false,
      phase: false,
      magboots: false,
      resonance: false
    };
    this.testHarness = new TestHarness();
    this.validator = new Validator(this.world, this.player);
    this.consoleOverlay = new ConsoleOverlay();
    this.checklist = new Checklist();
    this.validatorPending = false;

    this.init();
  }

  async init() {
    await this.world.load();
    this.resetWorldSystems();
    this.spawnEnemies();
    this.state = 'title';
  }

  resetWorldSystems() {
    this.minimap = new Minimap(this.world);
    this.validator = new Validator(this.world, this.player);
  }

  spawnEnemies() {
    this.enemies = [
      new PracticeDrone(32 * 30, 32 * 19),
      new Skitter(32 * 10, 32 * 19),
      new Skitter(32 * 14, 32 * 19),
      new Spitter(32 * 50, 32 * 19),
      new Bulwark(32 * 56, 32 * 19),
      new Floater(32 * 30, 32 * 9),
      new Slicer(32 * 34, 32 * 19),
      new HiveNode(32 * 8, 32 * 19),
      new SentinelElite(32 * 52, 32 * 9)
    ];
    this.boss = new FinalBoss(32 * 58, 32 * 9);
  }

  spawnTestEnemies() {
    this.enemies = [
      new PracticeDrone(32 * 10, 32 * 8),
      new Skitter(32 * 20, 32 * 8),
      new Spitter(32 * 24, 32 * 8)
    ];
    this.boss = null;
  }

  update(dt) {
    if (this.state === 'loading') return;

    if (this.input.wasPressed('pause') && this.state === 'playing') {
      this.state = 'pause';
    } else if (this.input.wasPressed('pause') && this.state === 'pause') {
      this.state = 'playing';
    }

    if (this.state === 'title') {
      this.title.update(dt);
      if (this.input.wasPressed('interact')) {
        this.state = 'dialog';
        this.audio.ping();
      }
      if (this.input.wasPressed('test')) {
        this.testHarness.enable(this.world, this.player);
        this.resetWorldSystems();
        this.spawnTestEnemies();
        this.state = 'playing';
        this.validatorPending = true;
      }
      this.input.flush();
      return;
    }

    if (this.state === 'dialog') {
      if (this.input.wasPressed('interact')) {
        const finished = this.dialog.next();
        if (finished) {
          this.state = 'playing';
          this.validatorPending = true;
        }
        this.audio.ping();
      }
      this.input.flush();
      return;
    }

    if (this.state === 'shop') {
      if (this.input.wasPressed('left')) this.shopUI.move(-1);
      if (this.input.wasPressed('right')) this.shopUI.move(1);
      if (this.input.wasPressed('up')) this.shopUI.move(-1);
      if (this.input.wasPressed('down')) this.shopUI.move(1);
      if (this.input.wasPressed('interact')) {
        if (this.player.loot > 0 && this.shopUI.selection === this.shopUI.upgrades.length) {
          this.player.credits += this.player.loot * 5;
          this.player.loot = 0;
        } else {
          const upgrade = this.shopUI.current();
          if (upgrade && !this.player.equippedUpgrades.some((item) => item.id === upgrade.id)) {
            if (this.player.credits >= upgrade.cost && this.player.equippedUpgrades.length < this.player.upgradeSlots) {
              this.player.credits -= upgrade.cost;
              this.player.equippedUpgrades.push(upgrade);
              if (upgrade.tags?.includes('slot')) {
                this.player.upgradeSlots = Math.min(4, this.player.upgradeSlots + 1);
              }
              this.player.applyUpgrades(this.player.equippedUpgrades);
            }
          } else if (upgrade) {
            this.player.equippedUpgrades = this.player.equippedUpgrades.filter((item) => item.id !== upgrade.id);
            this.player.applyUpgrades(this.player.equippedUpgrades);
          }
        }
        this.audio.ping();
      }
      if (this.input.wasPressed('pause')) {
        this.state = 'playing';
      }
      this.input.flush();
      return;
    }

    if (this.state === 'pause') {
      if (this.input.wasPressed('up')) this.pauseMenu.move(-1);
      if (this.input.wasPressed('down')) this.pauseMenu.move(1);
      if (this.input.wasPressed('left')) this.pauseMenu.adjust(-1);
      if (this.input.wasPressed('right')) this.pauseMenu.adjust(1);
      this.audio.setVolume(this.pauseMenu.volume);
      if (this.input.wasPressed('pause')) {
        this.state = 'playing';
      }
      this.input.flush();
      return;
    }

    this.testHarness.update(this.input, this);
    const debugSlow = this.testHarness.active && this.testHarness.slowMotion;
    const timeScale = this.slowTimer > 0 ? 0.25 : debugSlow ? 0.5 : 1;
    this.slowTimer = Math.max(0, this.slowTimer - dt);

    this.player.update(dt * timeScale, this.input, this.world, this.abilities);
    this.attemptGrapple();
    this.testHarness.applyCheats(this);

    if (this.player.dead) {
      this.respawn();
      this.input.flush();
      return;
    }

    if (this.input.wasPressed('attack')) {
      this.handleAttack();
    }
    if (this.input.isDown('rev')) {
      if (this.player.canRev()) {
        this.player.addHeat(0.4 * dt / (this.player.revEfficiency || 1));
        this.handleRev();
      }
    }

    if (this.input.wasPressed('interact')) {
      this.checkSavePoints();
    }

    this.updateEnemies(dt * timeScale);
    this.updateProjectiles(dt * timeScale);
    this.updateDebris(dt * timeScale);
    this.updateLootDrops(dt * timeScale);
    this.checkPickups();
    this.checkShops();
    this.updateObjective();
    this.consoleOverlay.update(dt * timeScale);

    this.camera.follow(this.player, dt);
    this.minimap.update(this.player);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }

    if (this.input.wasPressed('validator')) {
      this.runValidator();
    }
    if (this.input.wasPressed('legend')) {
      this.checklist.toggle();
    }
    if (this.validatorPending) {
      this.runValidator();
      this.validatorPending = false;
    }

    this.input.flush();
  }

  respawn() {
    this.player.dead = false;
    this.player.health = this.player.maxHealth;
    this.player.x = this.lastSave.x;
    this.player.y = this.lastSave.y;
    this.player.credits = Math.max(0, this.player.credits - 10);
    this.player.loot = 0;
  }

  handleAttack() {
    const range = 40;
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const dx = enemy.x - this.player.x;
      const dy = Math.abs(enemy.y - this.player.y);
      if (Math.abs(dx) < range && dy < 40) {
        if (enemy.type === 'bulwark' && !enemy.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce'))) {
          return;
        }
        enemy.damage(1);
        this.audio.tone(180, 0.1, 'square');
        if (enemy.dead) {
          this.awardLoot(enemy);
        }
      }
    });

    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - this.player.x;
      const dy = Math.abs(this.boss.y - this.player.y);
      if (Math.abs(dx) < range && dy < 60) {
        this.boss.damage(1);
        this.audio.tone(160, 0.1, 'square');
      }
    }
  }

  handleRev() {
    const range = 46;
    const candidates = this.enemies.filter((enemy) => {
      if (enemy.dead) return false;
      const dx = enemy.x - this.player.x;
      const dy = Math.abs(enemy.y - this.player.y);
      return Math.abs(dx) < range && dy < 50 && enemy.stagger >= 0.6;
    });
    if (candidates.length === 0) return;
    const enemy = candidates[0];
    if (!this.player.spendFuel()) return;
    const variant = this.getExecutionVariant(enemy);
    this.executeEnemy(enemy, variant);
  }

  getExecutionVariant(enemy) {
    if (this.player.onWall !== 0 && this.isNearWall(enemy)) {
      return 'wall';
    }
    if (!this.player.onGround) {
      return 'air';
    }
    const facingEnemy = Math.sign(enemy.x - this.player.x) === this.player.facing;
    return facingEnemy ? 'front' : 'back';
  }

  isNearWall(enemy) {
    const tileX = Math.floor(enemy.x / this.world.tileSize);
    const tileY = Math.floor(enemy.y / this.world.tileSize);
    return this.world.isSolid(tileX + 1, tileY, this.abilities) || this.world.isSolid(tileX - 1, tileY, this.abilities);
  }

  executeEnemy(enemy, variant) {
    this.testHarness.recordExecution(variant);
    if (!enemy.training) {
      enemy.dead = true;
      this.awardLoot(enemy, true);
      this.spawnExecutionDebris(enemy, variant);
    } else {
      enemy.stagger = 0;
    }
    this.slowTimer = 0.12;
    if (this.pauseMenu.shake) {
      this.shakeTimer = 0.2;
      this.shakeMagnitude = 10;
    }
    this.audio.rumble();
  }

  awardLoot(enemy, execution = false) {
    const total = enemy.lootValue + (execution ? 1 : 0);
    this.lootDrops.push(new LootDrop(enemy.x, enemy.y, total));
  }

  spawnExecutionDebris(enemy, variant) {
    const base = this.getEnemyPolygon(enemy);
    let normal = [1, 0];
    if (variant === 'front') normal = [0, 1];
    if (variant === 'back') normal = [1, 1];
    if (variant === 'air') normal = [1, 0];
    if (variant === 'wall') normal = [0.5, -1];
    const halves = this.splitPolygon(base, normal);
    halves.forEach((points, index) => {
      const offset = index === 0 ? -1 : 1;
      const debris = new DebrisPiece(points, enemy.x, enemy.y, offset * 120 + Math.random() * 80, -160 + Math.random() * 80);
      this.debris.push(debris);
    });
    for (let i = 0; i < 30; i += 1) {
      this.shards.push(new Shard(enemy.x, enemy.y));
    }
  }

  getEnemyPolygon(enemy) {
    const size = enemy.width || 24;
    return [
      [-size, -size],
      [size, -size],
      [size, size],
      [-size, size]
    ];
  }

  splitPolygon(points, normal) {
    const dot = (p) => p[0] * normal[0] + p[1] * normal[1];
    const a = [];
    const b = [];
    points.forEach((p) => {
      if (dot(p) >= 0) a.push(p);
      else b.push(p);
    });
    if (a.length < 3) a.push(...points.slice(0, 3));
    if (b.length < 3) b.push(...points.slice(0, 3));
    return [a, b];
  }

  updateEnemies(dt) {
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      if (enemy.type === 'spitter') {
        enemy.update(dt, this.player, this.spawnProjectile.bind(this));
      } else if (enemy.type === 'hivenode') {
        enemy.update(dt, this.player, (x, y) => this.enemies.push(new Skitter(x, y)));
      } else if (enemy.type === 'sentinel') {
        enemy.update(dt, this.player, this.spawnProjectile.bind(this));
      } else {
        enemy.update(dt, this.player);
      }

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      if (Math.hypot(dx, dy) < 24) {
        if (!enemy.training) {
          this.player.takeDamage(1);
        }
      }
    });

    if (this.boss && !this.boss.dead) {
      this.boss.update(dt, this.player, this.spawnProjectile.bind(this));
      this.handleBossInteractions();
    }
  }

  handleBossInteractions() {
    if (!this.boss || this.boss.dead) return;
    const dist = Math.hypot(this.player.x - this.boss.x, this.player.y - this.boss.y);
    if (dist > 200) return;
    if (this.boss.phase === 0 && this.abilities.grapple && this.input.isDown('rev')) {
      this.boss.triggerExposure();
      this.bossInteractions.grapple = true;
    }
    if (this.boss.phase === 1 && this.abilities.phase && this.input.isDown('rev')) {
      this.boss.triggerExposure();
      this.bossInteractions.phase = true;
    }
    if (this.boss.phase === 2 && this.abilities.magboots && this.player.onWall !== 0) {
      this.boss.triggerExposure();
      this.bossInteractions.magboots = true;
    }
    if (this.boss.phase === 3 && this.abilities.resonance && this.input.isDown('rev')) {
      this.boss.triggerExposure();
      this.bossInteractions.resonance = true;
    }
  }

  updateProjectiles(dt) {
    this.projectiles.forEach((projectile) => projectile.update(dt));
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
    this.projectiles.forEach((projectile) => {
      const dx = projectile.x - this.player.x;
      const dy = projectile.y - this.player.y;
      if (Math.hypot(dx, dy) < 20) {
        projectile.dead = true;
        this.player.takeDamage(projectile.damage);
      }
    });
  }

  updateDebris(dt) {
    this.debris.forEach((piece) => piece.update(dt));
    this.debris = this.debris.filter((piece) => piece.life > 0);
    this.shards.forEach((shard) => shard.update(dt));
    this.shards = this.shards.filter((shard) => shard.life > 0);
  }

  updateLootDrops(dt) {
    this.lootDrops.forEach((drop) => drop.update(dt));
    this.lootDrops = this.lootDrops.filter((drop) => drop.life > 0 && !drop.collected);
    this.lootDrops.forEach((drop) => {
      const dist = Math.hypot(drop.x - this.player.x, drop.y - this.player.y);
      if (dist < 24) {
        drop.collect();
        this.player.loot += drop.value;
        if (Math.random() < 0.2) {
          this.player.blueprints += 1;
          if (this.player.blueprints >= 3) {
            this.player.blueprints = 0;
            this.player.cosmetics.push(`Blueprint Style ${this.player.cosmetics.length + 1}`);
          }
        }
      }
    });
  }

  spawnProjectile(x, y, vx, vy, damage) {
    this.projectiles.push(new Projectile(x, y, vx, vy, damage));
  }

  checkPickups() {
    this.world.abilityPickups.forEach((pickup) => {
      if (pickup.collected) return;
      const dist = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
      if (dist < 30) {
        pickup.collected = true;
        this.abilities[pickup.ability] = true;
        if (pickup.ability === 'magboots') {
          this.player.upgradeSlots = Math.max(this.player.upgradeSlots, 3);
        }
        if (pickup.ability === 'resonance') {
          this.player.upgradeSlots = 4;
        }
        this.audio.ping();
      }
    });
  }

  checkSavePoints() {
    this.world.savePoints.forEach((save) => {
      const dist = Math.hypot(save.x - this.player.x, save.y - this.player.y);
      if (dist < 40) {
        this.world.savePoints.forEach((point) => {
          point.active = false;
        });
        save.active = true;
        this.lastSave = { x: save.x, y: save.y - 40 };
        this.audio.ping();
      }
    });
  }

  checkShops() {
    const nearShop = this.world.shops.find((shop) => Math.hypot(shop.x - this.player.x, shop.y - this.player.y) < 40);
    if (nearShop && this.input.wasPressed('interact')) {
      this.state = 'shop';
    }
  }

  updateObjective() {
    if (!this.abilities.grapple) {
      this.objective = 'Find the Grapple Spike in the Tangle.';
    } else if (!this.abilities.phase) {
      this.objective = 'Enter the Foundry and claim the Phase Wedge.';
    } else if (!this.abilities.magboots) {
      this.objective = 'Climb the Spire for the Mag Boots.';
    } else if (!this.abilities.resonance) {
      this.objective = 'Descend into the Hollow for the Resonance Core.';
    } else if (this.boss && !this.boss.dead) {
      this.objective = 'Enter the Rift and defeat the final boss.';
    } else {
      this.objective = 'Mission complete: Earth reclaimed.';
    }
  }

  attemptGrapple() {
    if (!this.abilities.grapple) return;
    if (!this.input.wasPressed('jump')) return;
    const anchor = this.world.anchors.find((point) => Math.hypot(point.x - this.player.x, point.y - this.player.y) < 140);
    if (anchor) {
      this.player.x = anchor.x;
      this.player.y = anchor.y + 20;
      this.player.vy = -200;
      this.audio.ping();
    }
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.state === 'title') {
      this.title.draw(ctx, canvas.width, canvas.height);
      return;
    }

    if (this.state === 'dialog') {
      this.dialog.draw(ctx, canvas.width, canvas.height);
      return;
    }

    const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMagnitude : 0;
    const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMagnitude : 0;

    ctx.save();
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    this.drawWorld(ctx);
    this.drawInteractables(ctx);
    this.drawObjectiveBeacon(ctx);
    this.drawTutorialHints(ctx);

    this.enemies.forEach((enemy) => {
      if (!enemy.dead) enemy.draw(ctx);
    });

    if (this.boss && !this.boss.dead) {
      this.boss.draw(ctx);
    }

    this.projectiles.forEach((projectile) => projectile.draw(ctx));
    this.debris.forEach((piece) => piece.draw(ctx));
    this.shards.forEach((shard) => shard.draw(ctx));
    this.lootDrops.forEach((drop) => {
      const dist = Math.hypot(drop.x - this.player.x, drop.y - this.player.y);
      drop.draw(ctx, dist < 40);
      if (dist < 40) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('LOOT', drop.x, drop.y - 16);
        ctx.restore();
      }
    });
    this.player.draw(ctx);
    if (this.testHarness.active && this.testHarness.showCollision) {
      this.drawCollisionBoxes(ctx);
    }
    this.drawBloom(ctx);
    ctx.restore();

    const region = this.world.regionAt(this.player.x, this.player.y);
    this.hud.draw(ctx, this.player, this.objective, region.name, { shake: this.pauseMenu.shake });
    const objectiveTarget = this.getObjectiveTarget();
    this.minimap.draw(ctx, canvas.width - 180, 20, 160, 90, this.player, {
      objective: objectiveTarget,
      showLegend: this.checklist.active
    });
    this.drawWaypoint(ctx, canvas.width, canvas.height, objectiveTarget);

    if (this.state === 'shop') {
      this.shopUI.draw(ctx, canvas.width, canvas.height, this.player);
    }

    if (this.state === 'pause') {
      this.pauseMenu.draw(ctx, canvas.width, canvas.height);
    }

    this.consoleOverlay.draw(ctx, canvas.width, canvas.height);
    this.checklist.draw(ctx, this, canvas.width, canvas.height);
    this.testHarness.draw(ctx, this, canvas.width, canvas.height);
  }

  drawBloom(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 4;
    this.enemies.forEach((enemy) => {
      if (!enemy.dead) enemy.draw(ctx);
    });
    if (this.boss && !this.boss.dead) {
      this.boss.draw(ctx);
    }
    this.player.draw(ctx);
    ctx.restore();
  }

  drawWorld(ctx) {
    const tileSize = this.world.tileSize;
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        const tile = this.world.getTile(x, y);
        if (tile === '#') {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
        if (['G', 'P', 'M', 'R'].includes(tile)) {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 6, y * tileSize + 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + tileSize - 6);
          ctx.stroke();
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = '12px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText(tile, x * tileSize + tileSize / 2, y * tileSize + tileSize / 2 + 4);
          ctx.restore();
        }
        if (tile === 'B') {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.beginPath();
          ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  drawInteractables(ctx) {
    this.world.savePoints.forEach((save) => {
      ctx.strokeStyle = save.active ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(save.x - 10, save.y - 24, 20, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(save.x - 10, save.y - 12);
      ctx.lineTo(save.x + 10, save.y - 12);
      ctx.stroke();
      this.drawLabel(ctx, save.x, save.y - 30, 'SAVE', save);
    });

    this.world.shops.forEach((shop) => {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(shop.x, shop.y - 12, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shop.x - 4, shop.y - 16);
      ctx.lineTo(shop.x + 4, shop.y - 8);
      ctx.stroke();
      this.drawLabel(ctx, shop.x, shop.y - 30, 'SHOP', shop);
    });

    this.world.abilityPickups.forEach((pickup) => {
      if (pickup.collected) return;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y - 12, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pickup.x - 6, pickup.y - 16);
      ctx.lineTo(pickup.x + 6, pickup.y - 8);
      ctx.stroke();
      this.drawLabel(ctx, pickup.x, pickup.y - 30, `ABILITY: ${pickup.ability.toUpperCase()}`, pickup);
    });

    this.world.anchors.forEach((anchor) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(anchor.x - 6, anchor.y - 6, 12, 12);
      this.drawLabel(ctx, anchor.x, anchor.y - 16, 'ANCHOR', anchor);
    });

    this.world.gates.forEach((gate) => {
      const labelMap = {
        G: 'GATE: GRAPPLE',
        P: 'GATE: PHASE',
        M: 'GATE: MAG BOOTS',
        R: 'GATE: RESONANCE'
      };
      this.drawLabel(ctx, gate.x, gate.y - 24, labelMap[gate.type], gate, 90);
      if (this.testHarness.active && this.testHarness.showGateReqs) {
        this.drawLabel(ctx, gate.x, gate.y - 40, `REQ ${gate.type}`, gate, 140);
      }
    });

    if (this.world.bossGate) {
      this.drawLabel(ctx, this.world.bossGate.x, this.world.bossGate.y - 24, 'RIFT GATE', this.world.bossGate, 120);
    }
  }

  drawLabel(ctx, x, y, text, source, range = 80) {
    const dist = Math.hypot(source.x - this.player.x, source.y - this.player.y);
    if (dist > range) return;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawObjectiveBeacon(ctx) {
    const target = this.getObjectiveTarget();
    if (!target) return;
    const pulse = 6 + Math.sin(performance.now() * 0.006) * 3;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y - 12, 16 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTutorialHints(ctx) {
    const trainer = this.enemies.find((enemy) => enemy.type === 'practice');
    if (!trainer || trainer.dead) return;
    const dist = Math.hypot(trainer.x - this.player.x, trainer.y - this.player.y);
    if (dist > 140) return;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('EXECUTION TUTORIAL', trainer.x, trainer.y - 40);
    ctx.fillText('Attack (J) to stagger, hold K to execute', trainer.x, trainer.y - 24);
    ctx.restore();
  }

  drawWaypoint(ctx, width, height, target) {
    if (!target) return;
    const screenX = target.x - this.camera.x;
    const screenY = target.y - this.camera.y;
    if (screenX > 40 && screenX < width - 40 && screenY > 40 && screenY < height - 40) return;
    const clampedX = Math.min(Math.max(screenX, 40), width - 40);
    const clampedY = Math.min(Math.max(screenY, 40), height - 40);
    const angle = Math.atan2(screenY - height / 2, screenX - width / 2);
    ctx.save();
    ctx.translate(clampedX, clampedY);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  drawCollisionBoxes(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(this.player.rect.x, this.player.rect.y, this.player.rect.w, this.player.rect.h);
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      ctx.strokeRect(enemy.rect.x, enemy.rect.y, enemy.rect.w, enemy.rect.h);
    });
    this.world.gates.forEach((gate) => {
      ctx.strokeRect(gate.x - this.world.tileSize / 2, gate.y - this.world.tileSize / 2, this.world.tileSize, this.world.tileSize);
    });
    ctx.restore();
  }

  getObjectiveTargetsByAbility() {
    const lookup = {};
    this.world.abilityPickups.forEach((pickup) => {
      lookup[pickup.ability] = {
        x: pickup.x,
        y: pickup.y,
        tx: Math.floor(pickup.x / this.world.tileSize),
        ty: Math.floor(pickup.y / this.world.tileSize)
      };
    });
    if (this.world.bossGate) {
      lookup.boss = {
        x: this.world.bossGate.x,
        y: this.world.bossGate.y,
        tx: Math.floor(this.world.bossGate.x / this.world.tileSize),
        ty: Math.floor(this.world.bossGate.y / this.world.tileSize)
      };
    }
    return lookup;
  }

  getObjectiveTarget() {
    const order = ['grapple', 'phase', 'magboots', 'resonance'];
    for (let i = 0; i < order.length; i += 1) {
      const ability = order[i];
      if (!this.abilities[ability]) {
        const target = this.world.abilityPickups.find((pickup) => pickup.ability === ability && !pickup.collected);
        return target || null;
      }
    }
    if (this.boss && !this.boss.dead) return this.world.bossGate;
    return null;
  }

  runValidator() {
    const targets = this.getObjectiveTargetsByAbility();
    const report = this.validator.run(this.abilities, targets);
    this.consoleOverlay.setReport(report.status, report.lines);
    console.log('Autoplay Validator Report:', report);
  }
}
