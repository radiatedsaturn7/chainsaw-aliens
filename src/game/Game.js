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
import Drifter from '../entities/Drifter.js';
import Bobber from '../entities/Bobber.js';
import Harrier from '../entities/Harrier.js';
import Bouncer from '../entities/Bouncer.js';
import Coward from '../entities/Coward.js';
import Ranger from '../entities/Ranger.js';
import Pouncer from '../entities/Pouncer.js';
import FinalBoss from '../entities/FinalBoss.js';
import SunderBehemoth from '../entities/SunderBehemoth.js';
import RiftRam from '../entities/RiftRam.js';
import BroodTitan from '../entities/BroodTitan.js';
import NullAegis from '../entities/NullAegis.js';
import HexMatron from '../entities/HexMatron.js';
import GraveWarden from '../entities/GraveWarden.js';
import ObsidianCrown from '../entities/ObsidianCrown.js';
import CataclysmColossus from '../entities/CataclysmColossus.js';
import Projectile from '../entities/Projectile.js';
import { DebrisPiece, Shard } from '../entities/Debris.js';
import LootDrop from '../entities/LootDrop.js';
import PracticeDrone from '../entities/PracticeDrone.js';
import Effect from '../entities/Effect.js';
import Title from '../ui/Title.js';
import Dialog from '../ui/Dialog.js';
import HUD from '../ui/HUD.js';
import Shop from '../ui/Shop.js';
import Pause from '../ui/Pause.js';
import MobileControls from '../ui/MobileControls.js';
import TestHarness from '../debug/TestHarness.js';
import Validator from '../debug/Validator.js';
import ConsoleOverlay from '../debug/ConsoleOverlay.js';
import Checklist from '../debug/Checklist.js';
import ActionFeedback from '../debug/ActionFeedback.js';
import PlayabilityLayer from '../debug/PlayabilityLayer.js';
import FeasibilityValidator from '../debug/FeasibilityValidator.js';
import GoldenPathRunner from '../debug/GoldenPathRunner.js';
import AutoRepair from '../debug/AutoRepair.js';
import TestDashboard from '../debug/TestDashboard.js';
import WorldValidityTest from '../debug/validators/WorldValidityTest.js';
import RoomCoverageTest from '../debug/validators/RoomCoverageTest.js';
import EncounterAuditTest from '../debug/validators/EncounterAuditTest.js';
import GoldenPathTest from '../debug/validators/GoldenPathTest.js';
import Editor from '../editor/Editor.js';
import ObstacleTestMap from '../debug/ObstacleTestMap.js';
import { OBSTACLES } from '../world/Obstacles.js';
import { MOVEMENT_MODEL } from './MovementModel.js';

const INTRO_LINES = [
  'The entire planet of earth has literally run out of all our ammunition...',
  '...and the aliens are still coming!',
  'There is only one solution left...',
  'We have to...',
  'Chainsaw Aliens.'
];

const ABILITY_DIALOG_LINES = {
  anchor: [
    'Tool acquired: Chainsaw Throw rig.',
    'Tap Attack to fire the tethered chainsaw.',
    'Hold Attack while embedded to climb. Tap Attack to untether.'
  ],
  flame: [
    'Tool acquired: Flame-Saw attachment.',
    'Forward + Attack to toggle flame mode.',
    'Hold Attack to rev and burn wood or melt metal.'
  ],
  magboots: [
    'Tool acquired: Mag Boots.',
    'Press into a wall to stick, then jump to wall-launch.',
    'Mag heat builds while engaged.'
  ],
  resonance: [
    'Tool acquired: Resonance Core.',
    'Hold Attack to rev and shatter brittle walls or rift seals.'
  ]
};

const UPGRADE_LIST = [
  { id: 'tooth-razor', name: 'Tooth Profile: Razor Edge', slot: 'tooth', cost: 15, modifiers: { revEfficiency: 0.2 } },
  { id: 'tooth-serrated', name: 'Tooth Profile: Serrated Bite', slot: 'tooth', cost: 20, modifiers: { revEfficiency: 0.3 } },
  { id: 'drive-torque', name: 'Drivetrain: Torque Lube', slot: 'drivetrain', cost: 25, modifiers: { speed: 20 } },
  { id: 'drive-pulse', name: 'Drivetrain: Pulse Drive', slot: 'drivetrain', cost: 30, modifiers: { dashCooldown: -0.1 } },
  { id: 'coolant-mist', name: 'Coolant: Mist Jet', slot: 'coolant', cost: 18, modifiers: { heatCap: 0.3 } },
  { id: 'coolant-phase', name: 'Coolant: Thermal Vapor', slot: 'coolant', cost: 24, modifiers: { heatCap: 0.5 } },
  { id: 'bar-grapple', name: 'Bar Attachment: Anchor Latch', slot: 'bar', cost: 28, modifiers: { speed: 10 } },
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
    this.spawnPoint = { x: 32 * 28, y: 32 * 19 };
    this.player = new Player(this.spawnPoint.x, this.spawnPoint.y);
    this.player.applyUpgrades(this.player.equippedUpgrades);
    this.title = new Title();
    this.dialog = new Dialog(INTRO_LINES);
    this.hud = new HUD();
    this.pauseMenu = new Pause();
    this.shopUI = new Shop(UPGRADE_LIST);
    this.state = 'loading';
    this.victory = false;
    this.enemies = [];
    this.projectiles = [];
    this.debris = [];
    this.shards = [];
    this.lootDrops = [];
    this.effects = [];
    this.clock = 0;
    this.abilities = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false
    };
    this.objective = 'Reach the Hub Pylon.';
    this.lastSave = { x: this.player.x, y: this.player.y };
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.slowTimer = 0;
    this.boss = null;
    this.bossActive = false;
    this.bossInteractions = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false
    };
    this.sawAnchor = {
      active: false,
      x: 0,
      y: 0,
      fuelDrain: 0,
      pullTimer: 0,
      retractTimer: 0,
      autoRetractTimer: 0,
      embedded: false,
      attachedBox: null,
      attachedEnemy: null,
      damageTimer: 0
    };
    this.attackTapTimer = 0;
    this.attackTapWindow = 0.28;
    this.attackHoldTimer = 0;
    this.attackHoldThreshold = 0.22;
    this.obstacleDamage = new Map();
    this.obstacleCooldown = 0;
    this.noiseCooldown = 0;
    this.testHarness = new TestHarness();
    this.validator = new Validator(this.world, this.player);
    this.feasibilityValidator = new FeasibilityValidator(this.world, this.player);
    this.consoleOverlay = new ConsoleOverlay();
    this.checklist = new Checklist();
    this.actionFeedback = new ActionFeedback();
    this.playability = new PlayabilityLayer(this.world, this.player, this.validator);
    this.goldenPath = new GoldenPathRunner();
    this.worldValidityTest = new WorldValidityTest(this.world, this.player);
    this.roomCoverageTest = new RoomCoverageTest(this.world, this.player, this.feasibilityValidator);
    this.encounterAuditTest = new EncounterAuditTest(this.world, this.player, this.feasibilityValidator);
    this.autoRepair = new AutoRepair(this.world);
    this.testDashboard = new TestDashboard();
    this.goldenPathTest = new GoldenPathTest(this.goldenPath);
    this.testResults = {
      validity: 'idle',
      coverage: 'idle',
      encounter: 'idle',
      golden: 'idle'
    };
    this.menuFlashTimer = 0;
    this.spawnRules = {
      globalMax: 12,
      perRegion: 6,
      cooldown: 1.4,
      backoffLowHealth: 2.4
    };
    this.spawnCooldowns = new Map();
    this.gameMode = 'story';
    this.endlessData = null;
    this.storyData = null;
    this.endlessState = {
      active: false,
      wave: 0,
      timer: 0
    };
    this.prevHealth = this.player.health;
    this.revActive = false;
    this.simulationActive = false;
    this.deathTimer = 0;
    this.gameOverTimer = 0;
    this.spawnPauseTimer = 0;
    this.editor = new Editor(this);
    this.editorReturnState = 'title';
    this.playtestActive = false;
    this.playtestButtonBounds = null;
    this.isMobile = false;
    this.viewport = { width: window.innerWidth, height: window.innerHeight, scale: 1 };
    this.mobileControls = new MobileControls();
    this.boxes = [];
    this.boxSize = 26;

    this.init();
  }

  setViewport({ width, height, scale, isMobile }) {
    this.viewport = { width, height, scale };
    this.isMobile = Boolean(isMobile);
    this.mobileControls.setViewport({
      width: this.canvas.width,
      height: this.canvas.height,
      isMobile: this.isMobile
    });
  }

  async init() {
    await this.world.load();
    await this.autoRepair.load();
    this.autoRepair.applyPersistentPatches();
    await this.goldenPath.load();
    this.storyData = this.world.data;
    this.endlessData = await this.loadWorldData('./src/content/endless.json');
    this.syncSpawnPoint();
    this.player.x = this.spawnPoint.x;
    this.player.y = this.spawnPoint.y;
    this.lastSave = { x: this.spawnPoint.x, y: this.spawnPoint.y };
    this.resetWorldSystems();
    this.spawnEnemies();
    this.spawnBoxes();
    this.autoRepair.applySpawnOverride(this);
    this.state = 'title';
  }

  async loadWorldData(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(error);
      return null;
    }
  }

  resetWorldSystems() {
    this.minimap = new Minimap(this.world);
    this.validator = new Validator(this.world, this.player);
    this.feasibilityValidator = new FeasibilityValidator(this.world, this.player);
    this.playability = new PlayabilityLayer(this.world, this.player, this.validator);
    this.worldValidityTest = new WorldValidityTest(this.world, this.player);
    this.roomCoverageTest = new RoomCoverageTest(this.world, this.player, this.feasibilityValidator);
    this.encounterAuditTest = new EncounterAuditTest(this.world, this.player, this.feasibilityValidator);
    this.goldenPathTest = new GoldenPathTest(this.goldenPath);
  }

  syncSpawnPoint() {
    const spawn = this.world.spawnPoint || this.spawnPoint;
    this.spawnPoint = { x: spawn.x, y: spawn.y };
  }

  refreshWorldCaches() {
    this.world.rebuildCaches();
    this.minimap = new Minimap(this.world);
    this.syncSpawnPoint();
    this.resetWorldSystems();
  }

  buildWorldData() {
    return {
      schemaVersion: 1,
      tileSize: this.world.tileSize,
      width: this.world.width,
      height: this.world.height,
      spawn: this.world.spawn || { x: 28, y: 19 },
      tiles: this.world.tiles,
      regions: this.world.regions,
      enemies: this.world.enemies
    };
  }

  applyWorldData(data) {
    const migrated = {
      schemaVersion: data.schemaVersion ?? 1,
      tileSize: data.tileSize,
      width: data.width,
      height: data.height,
      spawn: data.spawn || { x: 28, y: 19 },
      tiles: data.tiles,
      regions: data.regions || [],
      enemies: data.enemies || []
    };
    this.world.applyData(migrated);
    this.syncSpawnPoint();
    this.lastSave = { x: this.spawnPoint.x, y: this.spawnPoint.y };
    this.refreshWorldCaches();
  }

  enterEditor() {
    this.editorReturnState = this.state;
    this.state = 'editor';
    this.setRevAudio(false);
    this.editor.activate();
    this.playtestActive = false;
    document.body.classList.add('editor-active');
  }

  exitEditor({ playtest }) {
    this.editor.deactivate();
    if (playtest) {
      this.syncSpawnPoint();
      this.resetRun();
      this.state = 'playing';
      this.playtestActive = true;
      this.startSpawnPause();
      document.body.classList.remove('editor-active');
      return;
    }
    this.playtestActive = false;
    if (this.editorReturnState === 'playing' || this.editorReturnState === 'pause') {
      this.state = 'pause';
    } else {
      this.state = 'title';
    }
    document.body.classList.remove('editor-active');
  }

  returnToEditorFromPlaytest() {
    if (!this.playtestActive) return;
    this.state = 'editor';
    this.editor.activate();
    this.playtestActive = false;
    document.body.classList.add('editor-active');
  }

  resetRun() {
    this.world.reset();
    this.player = new Player(this.spawnPoint.x, this.spawnPoint.y);
    if (this.gameMode === 'endless') {
      this.player.equippedUpgrades = [...UPGRADE_LIST];
      this.player.upgradeSlots = UPGRADE_LIST.length;
      this.player.maxHealth = 12;
      this.player.health = 12;
    }
    this.player.applyUpgrades(this.player.equippedUpgrades);
    this.abilities = this.gameMode === 'endless'
      ? {
        anchor: true,
        flame: true,
        magboots: true,
        resonance: true
      }
      : {
        anchor: false,
        flame: false,
        magboots: false,
        resonance: false
      };
    this.objective = this.gameMode === 'endless'
      ? 'Survive the endless horde.'
      : 'Reach the Hub Pylon.';
    this.lastSave = { x: this.player.x, y: this.player.y };
    this.victory = false;
    this.enemies = [];
    this.projectiles = [];
    this.debris = [];
    this.shards = [];
    this.lootDrops = [];
    this.effects = [];
    this.spawnEnemies();
    this.bossInteractions = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false
    };
    this.sawAnchor = {
      active: false,
      x: 0,
      y: 0,
      fuelDrain: 0,
      pullTimer: 0,
      retractTimer: 0,
      autoRetractTimer: 0,
      embedded: false,
      attachedBox: null,
      attachedEnemy: null,
      damageTimer: 0
    };
    this.spawnBoxes();
    this.obstacleDamage.clear();
    this.obstacleCooldown = 0;
    this.noiseCooldown = 0;
    this.attackTapTimer = 0;
    this.attackHoldTimer = 0;
    this.prevHealth = this.player.health;
    this.deathTimer = 0;
    this.gameOverTimer = 0;
    this.spawnPauseTimer = 0;
    this.endlessState = {
      active: this.gameMode === 'endless',
      wave: 0,
      timer: 1.5
    };
    if (this.gameMode === 'endless') {
      this.spawnRules.globalMax = 20;
      this.spawnRules.perRegion = 20;
      this.spawnRules.cooldown = 0.8;
      this.spawnRules.backoffLowHealth = 1.2;
    } else {
      this.spawnRules.globalMax = 12;
      this.spawnRules.perRegion = 6;
      this.spawnRules.cooldown = 1.4;
      this.spawnRules.backoffLowHealth = 2.4;
    }
    this.testHarness.active = false;
    this.simulationActive = false;
    this.resetWorldSystems();
  }

  startGoldenPath() {
    this.resetRun();
    this.state = 'playing';
    this.simulationActive = true;
    this.goldenPath.start(this);
    this.testResults.golden = 'running';
    this.testDashboard.setResults({ golden: 'running' });
    this.audio.ui();
    this.triggerMenuFlash();
  }

  startEndlessMode() {
    if (!this.endlessData) return;
    this.gameMode = 'endless';
    this.applyWorldData(this.endlessData);
    this.resetRun();
    this.state = 'playing';
    this.simulationActive = false;
    this.startSpawnPause();
  }

  updateEndlessMode(dt) {
    if (!this.endlessState.active) return;
    this.endlessState.timer = Math.max(0, this.endlessState.timer - dt);
    if (this.endlessState.timer > 0) return;
    this.endlessState.wave += 1;
    const wave = this.endlessState.wave;
    const spawnCount = Math.min(4 + Math.floor(wave * 1.2), 24);
    this.spawnRules.globalMax = Math.min(18 + wave * 2, 60);
    this.spawnRules.perRegion = this.spawnRules.globalMax;
    this.spawnRules.cooldown = Math.max(0.4, 1.1 - wave * 0.05);
    this.endlessState.timer = Math.max(2.2, 6 - wave * 0.12);
    for (let i = 0; i < spawnCount; i += 1) {
      const activeEnemies = this.enemies.filter((enemy) => !enemy.dead);
      if (activeEnemies.length >= this.spawnRules.globalMax) {
        break;
      }
      this.spawnEndlessEnemy(wave);
    }
  }

  spawnEndlessEnemy(wave) {
    const pool = ['skitter'];
    if (wave >= 2) pool.push('spitter');
    if (wave >= 4) pool.push('slicer');
    if (wave >= 6) pool.push('bulwark');
    if (wave >= 6) pool.push('bouncer');
    if (wave >= 6) pool.push('pouncer');
    if (wave >= 7) pool.push('coward');
    if (wave >= 8) pool.push('hivenode');
    if (wave >= 9) pool.push('ranger');
    if (wave >= 10) pool.push('floater', 'drifter', 'bobber');
    if (wave >= 11) pool.push('harrier');
    if (wave >= 12) pool.push('sentinel');
    const type = pool[Math.floor(Math.random() * pool.length)];
    const spawn = this.getEndlessSpawnPoint();
    this.spawnEnemyByType(type, spawn.x, spawn.y);
  }

  spawnEnemyByType(type, worldX, worldY) {
    switch (type) {
      case 'practice':
        this.enemies.push(new PracticeDrone(worldX, worldY));
        break;
      case 'skitter':
        this.enemies.push(new Skitter(worldX, worldY));
        break;
      case 'spitter':
        this.enemies.push(new Spitter(worldX, worldY));
        break;
      case 'bulwark':
        this.enemies.push(new Bulwark(worldX, worldY));
        break;
      case 'floater':
        this.enemies.push(new Floater(worldX, worldY));
        break;
      case 'slicer':
        this.enemies.push(new Slicer(worldX, worldY));
        break;
      case 'hivenode':
        this.enemies.push(new HiveNode(worldX, worldY));
        break;
      case 'sentinel':
        this.enemies.push(new SentinelElite(worldX, worldY));
        break;
      case 'drifter':
        this.enemies.push(new Drifter(worldX, worldY));
        break;
      case 'bobber':
        this.enemies.push(new Bobber(worldX, worldY));
        break;
      case 'harrier':
        this.enemies.push(new Harrier(worldX, worldY));
        break;
      case 'bouncer':
        this.enemies.push(new Bouncer(worldX, worldY));
        break;
      case 'coward':
        this.enemies.push(new Coward(worldX, worldY));
        break;
      case 'ranger':
        this.enemies.push(new Ranger(worldX, worldY));
        break;
      case 'pouncer':
        this.enemies.push(new Pouncer(worldX, worldY));
        break;
      case 'sunderbehemoth':
        this.enemies.push(new SunderBehemoth(worldX, worldY));
        break;
      case 'riftram':
        this.enemies.push(new RiftRam(worldX, worldY));
        break;
      case 'broodtitan':
        this.enemies.push(new BroodTitan(worldX, worldY));
        break;
      case 'nullaegis':
        this.enemies.push(new NullAegis(worldX, worldY));
        break;
      case 'hexmatron':
        this.enemies.push(new HexMatron(worldX, worldY));
        break;
      case 'gravewarden':
        this.enemies.push(new GraveWarden(worldX, worldY));
        break;
      case 'obsidiancrown':
        this.enemies.push(new ObsidianCrown(worldX, worldY));
        break;
      case 'cataclysmcolossus':
        this.enemies.push(new CataclysmColossus(worldX, worldY));
        break;
      default:
        break;
    }
  }

  getEndlessSpawnPoint() {
    const tileSize = this.world.tileSize;
    const tries = 40;
    for (let i = 0; i < tries; i += 1) {
      const tx = 2 + Math.floor(Math.random() * (this.world.width - 4));
      const ty = 2 + Math.floor(Math.random() * (this.world.height - 6));
      if (this.world.isSolid(tx, ty, this.abilities)) continue;
      if (!this.world.isSolid(tx, ty + 1, this.abilities)) continue;
      const x = (tx + 0.5) * tileSize;
      const y = (ty + 0.5) * tileSize;
      if (Math.hypot(this.player.x - x, this.player.y - y) < 160) continue;
      return { x, y };
    }
    return {
      x: this.player.x + (Math.random() - 0.5) * 240,
      y: this.player.y - 80
    };
  }

  spawnEnemies() {
    if (this.world.enemies && this.world.enemies.length > 0) {
      this.enemies = [];
      this.boss = null;
      const tileSize = this.world.tileSize;
      this.world.enemies.forEach((spawn) => {
        const worldX = (spawn.x + 0.5) * tileSize;
        const worldY = (spawn.y + 0.5) * tileSize;
        switch (spawn.type) {
          case 'practice':
            this.enemies.push(new PracticeDrone(worldX, worldY));
            break;
          case 'skitter':
            this.enemies.push(new Skitter(worldX, worldY));
            break;
          case 'spitter':
            this.enemies.push(new Spitter(worldX, worldY));
            break;
          case 'bulwark':
            this.enemies.push(new Bulwark(worldX, worldY));
            break;
          case 'floater':
            this.enemies.push(new Floater(worldX, worldY));
            break;
          case 'slicer':
            this.enemies.push(new Slicer(worldX, worldY));
            break;
          case 'hivenode':
            this.enemies.push(new HiveNode(worldX, worldY));
            break;
          case 'sentinel':
            this.enemies.push(new SentinelElite(worldX, worldY));
            break;
          case 'drifter':
            this.enemies.push(new Drifter(worldX, worldY));
            break;
          case 'bobber':
            this.enemies.push(new Bobber(worldX, worldY));
            break;
          case 'harrier':
            this.enemies.push(new Harrier(worldX, worldY));
            break;
          case 'bouncer':
            this.enemies.push(new Bouncer(worldX, worldY));
            break;
          case 'coward':
            this.enemies.push(new Coward(worldX, worldY));
            break;
          case 'pouncer':
            this.enemies.push(new Pouncer(worldX, worldY));
            break;
          case 'ranger':
            this.enemies.push(new Ranger(worldX, worldY));
            break;
          case 'sunderbehemoth':
            this.enemies.push(new SunderBehemoth(worldX, worldY));
            break;
          case 'riftram':
            this.enemies.push(new RiftRam(worldX, worldY));
            break;
          case 'broodtitan':
            this.enemies.push(new BroodTitan(worldX, worldY));
            break;
          case 'nullaegis':
            this.enemies.push(new NullAegis(worldX, worldY));
            break;
          case 'hexmatron':
            this.enemies.push(new HexMatron(worldX, worldY));
            break;
          case 'gravewarden':
            this.enemies.push(new GraveWarden(worldX, worldY));
            break;
          case 'obsidiancrown':
            this.enemies.push(new ObsidianCrown(worldX, worldY));
            break;
          case 'cataclysmcolossus':
            this.enemies.push(new CataclysmColossus(worldX, worldY));
            break;
          case 'finalboss':
            this.boss = new FinalBoss(worldX, worldY);
            break;
          default:
            break;
        }
      });
      this.bossActive = false;
      return;
    }

    if (this.gameMode === 'endless') {
      this.enemies = [];
      this.boss = null;
      this.bossActive = false;
      return;
    }

    this.enemies = [
      new PracticeDrone(32 * 40, 32 * 19),
      new Skitter(32 * 38, 32 * 19),
      new Skitter(32 * 60, 32 * 19),
      new Spitter(32 * 50, 32 * 19),
      new Bulwark(32 * 56, 32 * 19),
      new Floater(32 * 30, 32 * 9),
      new Drifter(32 * 26, 32 * 11),
      new Bobber(32 * 44, 32 * 11),
      new Harrier(32 * 48, 32 * 7),
      new Slicer(32 * 34, 32 * 19),
      new HiveNode(32 * 58, 32 * 19),
      new SentinelElite(32 * 52, 32 * 9),
      new Bouncer(32 * 46, 32 * 19),
      new Coward(32 * 42, 32 * 19),
      new Ranger(32 * 54, 32 * 19),
      new SunderBehemoth(32 * 20, 32 * 12),
      new RiftRam(32 * 10, 32 * 12),
      new BroodTitan(32 * 44, 32 * 13),
      new NullAegis(32 * 26, 32 * 7),
      new HexMatron(32 * 36, 32 * 7),
      new GraveWarden(32 * 18, 32 * 25),
      new ObsidianCrown(32 * 48, 32 * 25),
      new CataclysmColossus(32 * 32, 32 * 17)
    ];
    this.boss = new FinalBoss(32 * 58, 32 * 9);
    this.bossActive = false;
  }

  spawnTestEnemies() {
    this.enemies = [
      new PracticeDrone(32 * 8, 32 * 8),
      new Skitter(32 * 16, 32 * 8),
      new Spitter(32 * 20, 32 * 8),
      new Bulwark(32 * 24, 32 * 8),
      new Floater(32 * 14, 32 * 4),
      new Drifter(32 * 18, 32 * 4),
      new Bobber(32 * 22, 32 * 4),
      new Harrier(32 * 30, 32 * 4),
      new Slicer(32 * 28, 32 * 8),
      new HiveNode(32 * 22, 32 * 12),
      new SentinelElite(32 * 26, 32 * 4),
      new Bouncer(32 * 12, 32 * 8),
      new Coward(32 * 34, 32 * 8),
      new Ranger(32 * 38, 32 * 8),
      new SunderBehemoth(32 * 12, 32 * 18),
      new RiftRam(32 * 20, 32 * 18),
      new BroodTitan(32 * 28, 32 * 18),
      new NullAegis(32 * 36, 32 * 18),
      new HexMatron(32 * 44, 32 * 18),
      new GraveWarden(32 * 52, 32 * 18),
      new ObsidianCrown(32 * 20, 32 * 26),
      new CataclysmColossus(32 * 36, 32 * 26)
    ];
    this.boss = null;
  }

  update(dt) {
    if (this.state === 'loading') return;
    if (this.state === 'editor') {
      this.input.clearVirtual();
    } else {
      const mobileActions = this.mobileControls.getActions(this.state, this.player?.facing ?? 1);
      this.input.setVirtual(mobileActions);
    }
    this.clock += dt;
    this.menuFlashTimer = Math.max(0, this.menuFlashTimer - dt);

    if (this.input.wasPressed('editor')) {
      if (this.state === 'editor') {
        this.exitEditor({ playtest: false });
      } else {
        this.enterEditor();
      }
      this.input.flush();
      return;
    }

    if (this.state === 'editor') {
      this.editor.update(this.input, dt);
      this.input.flush();
      return;
    }

    if (this.input.wasPressed('pause') && this.state === 'playing') {
      this.state = 'pause';
    } else if (this.input.wasPressed('pause') && this.state === 'pause') {
      this.state = 'playing';
    }
    if (this.input.wasPressed('cancel') && ['dialog', 'shop', 'pause'].includes(this.state)) {
      this.state = 'playing';
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      this.input.flush();
      return;
    }

    if (this.state !== 'playing') {
      this.setRevAudio(false);
    }

    if (this.state === 'title') {
      this.title.update(dt);
      if (this.input.wasPressed('test') && !this.testDashboard.visible) {
        this.openTestDashboard();
        this.input.flush();
        return;
      }
      if (this.testDashboard.visible) {
        this.handleTestDashboard();
        this.input.flush();
        return;
      }
      if (this.input.wasPressed('interact')) {
        if (this.gameMode !== 'story' && this.storyData) {
          this.gameMode = 'story';
          this.applyWorldData(this.storyData);
          this.resetRun();
        } else {
          this.gameMode = 'story';
        }
        this.state = 'dialog';
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      if (this.input.wasPressed('endless')) {
        this.startEndlessMode();
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      if (this.input.wasPressed('golden')) {
        if (this.canRunGolden()) {
          this.startGoldenPath();
          this.recordFeedback('menu navigate', 'audio');
          this.recordFeedback('menu navigate', 'visual');
        } else {
          this.consoleOverlay.setReport('warn', ['Golden path locked: run tests first.'], 'AUTO-TEST');
        }
      }
      this.input.flush();
      return;
    }

    if (this.state === 'dialog') {
      if (this.input.wasPressed('interact')) {
        const finished = this.dialog.next();
        if (finished) {
          this.state = 'playing';
          this.simulationActive = false;
          this.startSpawnPause();
        }
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      this.input.flush();
      return;
    }

    if (this.state === 'shop') {
      if (this.input.wasPressed('left')) this.shopUI.move(-1);
      if (this.input.wasPressed('right')) this.shopUI.move(1);
      if (this.input.wasPressed('up')) this.shopUI.move(-1);
      if (this.input.wasPressed('down')) this.shopUI.move(1);
      if (this.input.wasPressed('left') || this.input.wasPressed('right') || this.input.wasPressed('up') || this.input.wasPressed('down')) {
        this.audio.menu();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        this.triggerMenuFlash();
      }
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
        this.audio.interact();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
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
      if (this.input.wasPressed('up') || this.input.wasPressed('down') || this.input.wasPressed('left') || this.input.wasPressed('right')) {
        this.audio.menu();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        this.triggerMenuFlash();
      }
      this.audio.setVolume(this.pauseMenu.volume);
      if (this.input.wasPressed('pause')) {
        this.state = 'playing';
      }
      this.input.flush();
      return;
    }

    this.goldenPath.preUpdate(dt, this);
    if (this.goldenPath.freeze) {
      this.input.flush();
      return;
    }
    this.testHarness.update(this.input, this);
    const debugSlow = this.testHarness.active && this.testHarness.slowMotion;
    const simScale = this.goldenPath.getTimeScale();
    const timeScale = (this.slowTimer > 0 ? 0.25 : debugSlow ? 0.5 : 1) * simScale;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.spawnPauseTimer > 0) {
      this.spawnPauseTimer = Math.max(0, this.spawnPauseTimer - dt);
      this.updateEffects(dt);
      this.setRevAudio(false);
      this.input.flush();
      return;
    }
    this.updateSpawnCooldowns(dt * timeScale);
    this.updateEndlessMode(dt * timeScale);
    this.attackTapTimer = Math.max(0, this.attackTapTimer - dt * timeScale);
    if (this.input.wasPressed('attack')) {
      this.attackHoldTimer = 0;
    }
    if (this.input.isDown('attack')) {
      this.attackHoldTimer += dt * timeScale;
    }
    if (!this.player.sawRideActive && this.player.onGround && this.input.isDown('down') && this.input.wasPressed('attack')) {
      this.player.startSawRide();
    }
    if (!this.player.sawRideActive && this.player.onGround && this.input.isDown('attack') && this.attackHoldTimer > this.attackHoldThreshold && !this.input.isDown('down')) {
      this.player.startSawRide();
    }

    if (!this.abilities.flame) {
      this.player.flameMode = false;
    } else if (this.input.wasPressed('flame')) {
      this.player.flameMode = !this.player.flameMode;
    }
    if (this.input.wasPressed('throw')) {
      this.handleThrow();
    }

    const prevPlayer = { x: this.player.x, y: this.player.y };
    this.player.update(dt * timeScale, this.input, this.world, this.abilities);
    this.player.sawDeployed = this.sawAnchor.active;
    this.updateSawAnchor(dt * timeScale, this.input);
    this.applyAnchorClimb(dt * timeScale);
    this.resolveBoxCollisions(prevPlayer);
    this.obstacleCooldown = Math.max(0, this.obstacleCooldown - dt * timeScale);
    this.noiseCooldown = Math.max(0, this.noiseCooldown - dt * timeScale);
    this.testHarness.applyCheats(this);
    this.handleMovementFeedback();

    if (this.player.dead) {
      if (this.deathTimer <= 0) {
        this.startDeathSequence();
      }
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      this.gameOverTimer = Math.max(0, this.gameOverTimer - dt);
      this.updateEffects(dt);
      if (this.deathTimer <= 0) {
        this.respawn();
        this.startSpawnPause();
      }
      this.setRevAudio(false);
      this.input.flush();
      return;
    }

    if (!this.player.sawRideActive && this.input.wasReleased('attack')) {
      const heldDuration = this.attackHoldTimer;
      this.attackHoldTimer = 0;
      if (heldDuration > 0 && heldDuration <= this.attackHoldThreshold) {
        const doubleTap = this.attackTapTimer > 0;
        this.attackTapTimer = doubleTap ? 0 : this.attackTapWindow;
        if (this.sawAnchor.active) {
          this.startAnchorRetract(0.2);
        } else if (doubleTap) {
          if (!this.tryObstacleInteraction('attack')) {
            this.handleAttack();
          }
        } else if (this.abilities.anchor) {
          this.handleAnchorShot();
        } else if (!this.tryObstacleInteraction('attack')) {
          this.handleAttack();
        }
      }
    } else if (!this.player.sawRideActive && !this.input.isDown('attack')) {
      this.attackHoldTimer = 0;
    }
    if (this.sawAnchor.embedded && this.input.wasPressed('jump')) {
      this.startAnchorRetract(0.2);
    }
    const revHeld = this.isRevHeld(this.input);
    const anchorRevActive = this.sawAnchor.active && this.sawAnchor.embedded && revHeld;
    if (revHeld && this.player.canRev() && !this.sawAnchor.active) {
      this.player.addHeat(0.4 * dt / (this.player.revEfficiency || 1));
      this.handleRev();
      this.tryObstacleInteraction('rev');
      this.handleFlameSawDrain(dt);
      this.setRevAudio(true);
      this.recordFeedback('chainsaw rev', 'audio');
      this.recordFeedback('chainsaw rev', 'visual');
    } else if (anchorRevActive) {
      this.setRevAudio(true);
      this.recordFeedback('chainsaw rev', 'audio');
      this.recordFeedback('chainsaw rev', 'visual');
    } else {
      this.setRevAudio(false);
    }

    let interacted = false;
    if (this.input.wasPressed('interact')) {
      interacted = this.checkSavePoints();
      if (!interacted) {
        interacted = this.handleSwitchInteraction();
      }
    }

    this.updateEnemies(dt * timeScale);
    this.updateProjectiles(dt * timeScale);
    this.updateDebris(dt * timeScale);
    this.updateEffects(dt * timeScale);
    this.updateLootDrops(dt * timeScale);
    this.checkPlayerDamage();
    this.checkPickups();
    const shopped = this.checkShops();
    if (this.input.wasPressed('interact') && !interacted && !shopped) {
      this.audio.interact();
      this.spawnEffect('interact', this.player.x, this.player.y - 16);
      this.recordFeedback('interact', 'audio');
      this.recordFeedback('interact', 'visual');
    }
    this.updateObjective();
    this.updateBossState();
    this.consoleOverlay.update(dt * timeScale);
    this.playability.update(dt * timeScale, this);
    this.goldenPath.postUpdate(dt * timeScale, this);
    if (this.goldenPath.status === 'pass' || this.goldenPath.status === 'fail') {
      const report = this.goldenPathTest.buildReport(this);
      this.testResults.golden = report.status;
      this.testDashboard.setResults({ golden: report.status });
      this.testDashboard.setDetails('golden', report.lines);
    }

    this.camera.follow(this.player, dt);
    this.minimap.update(this.player);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }

    if (this.input.wasPressed('validator')) {
      this.runValidator(this.input.isShiftDown());
    }
    if (this.input.wasPressed('coverage')) {
      this.runRoomCoverageTest();
      this.roomCoverageTest.toggleOverlay();
    }
    if (this.input.wasPressed('encounter')) {
      this.runEncounterAuditTest();
    }
    if (this.input.wasPressed('golden') && this.state === 'playing') {
      if (this.canRunGolden()) {
        this.startGoldenPath();
      } else {
        this.consoleOverlay.setReport('warn', ['Golden path locked: run tests first.'], 'AUTO-TEST');
      }
    }
    if (this.input.wasPressed('legend')) {
      this.checklist.toggle();
    }
    if (this.input.wasPressed('debug')) {
      this.playability.toggle();
    }
    if (this.input.wasPressedCode('KeyB')) {
      this.loadObstacleTestRoom();
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
    this.player.invulnTimer = 1;
    this.prevHealth = this.player.health;
  }

  startDeathSequence() {
    this.deathTimer = 1.1;
    this.gameOverTimer = 1.1;
    this.spawnEffect('explosion', this.player.x, this.player.y - 4);
    this.spawnEffect('explosion', this.player.x + 16, this.player.y + 6);
    this.spawnEffect('explosion', this.player.x - 14, this.player.y + 10);
    this.audio.explosion();
    this.shakeTimer = Math.max(this.shakeTimer, 0.6);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, 16);
  }

  startSpawnPause() {
    if (this.simulationActive) return;
    this.spawnPauseTimer = 3;
    this.player.invulnTimer = Math.max(this.player.invulnTimer, this.spawnPauseTimer);
    this.audio.spawnTune();
  }

  handleMovementFeedback() {
    if (this.player.justJumped) {
      this.audio.jump();
      this.spawnEffect('jump', this.player.x, this.player.y + 16);
      this.recordFeedback('jump', 'audio');
      this.recordFeedback('jump', 'visual');
    }
    if (this.player.justLanded) {
      this.audio.land();
      this.spawnEffect('land', this.player.x, this.player.y + 18);
      this.recordFeedback('land', 'audio');
      this.recordFeedback('land', 'visual');
    }
    if (this.player.justDashed) {
      this.audio.dash();
      this.spawnEffect('dash', this.player.x + this.player.facing * 10, this.player.y);
      this.recordFeedback('dash', 'audio');
      this.recordFeedback('dash', 'visual');
    }
    if (this.player.justStepped) {
      this.audio.footstep();
      this.spawnEffect('move', this.player.x, this.player.y + 18);
      this.recordFeedback('move', 'audio');
      this.recordFeedback('move', 'visual');
    }
  }

  spawnBoxes() {
    this.boxes = this.world.boxes.map((box) => ({ x: box.x, y: box.y }));
  }

  setRevAudio(active) {
    const intensity = 0.2 + this.player.heat * 0.6;
    if (active) {
      this.audio.setRev(true, intensity);
      this.revActive = true;
    } else if (this.revActive) {
      this.audio.setRev(false);
      this.revActive = false;
    }
  }

  recordFeedback(action, type) {
    this.actionFeedback.record(action, type, this.clock);
  }

  spawnEffect(type, x, y) {
    this.effects.push(new Effect(x, y, type));
  }

  updateEffects(dt) {
    this.effects.forEach((effect) => effect.update(dt));
    this.effects = this.effects.filter((effect) => effect.alive);
  }

  checkPlayerDamage() {
    if (this.player.health < this.prevHealth) {
      this.audio.damage();
      this.spawnEffect('damage', this.player.x, this.player.y - 8);
      this.recordFeedback('take damage', 'audio');
      this.recordFeedback('take damage', 'visual');
    }
    this.prevHealth = this.player.health;
  }

  triggerMenuFlash() {
    this.menuFlashTimer = 0.2;
  }

  updateSpawnCooldowns(dt) {
    this.spawnCooldowns.forEach((value, key) => {
      const next = Math.max(0, value - dt);
      this.spawnCooldowns.set(key, next);
    });
  }

  requestSpawn(type, x, y) {
    const activeEnemies = this.enemies.filter((enemy) => !enemy.dead);
    if (activeEnemies.length >= this.spawnRules.globalMax) {
      return false;
    }
    const regionId = this.world.regionAt(x, y).id;
    const regionCount = activeEnemies.filter((enemy) => this.world.regionAt(enemy.x, enemy.y).id === regionId).length;
    if (regionCount >= this.spawnRules.perRegion) {
      return false;
    }
    const cooldown = this.spawnCooldowns.get(regionId) || 0;
    if (cooldown > 0) {
      return false;
    }
    if (this.player.health <= 2 || this.isPlayerConfined()) {
      this.spawnCooldowns.set(regionId, this.spawnRules.backoffLowHealth);
      return false;
    }
    if (type === 'skitter') {
      this.enemies.push(new Skitter(x, y));
    }
    this.spawnCooldowns.set(regionId, this.spawnRules.cooldown);
    return true;
  }

  isPlayerConfined() {
    const tileSize = this.world.tileSize;
    const tx = Math.floor(this.player.x / tileSize);
    const ty = Math.floor(this.player.y / tileSize);
    let solidCount = 0;
    for (let y = ty - 1; y <= ty + 1; y += 1) {
      for (let x = tx - 1; x <= tx + 1; x += 1) {
        if (this.world.isSolid(x, y, this.abilities)) {
          solidCount += 1;
        }
      }
    }
    return solidCount >= 6;
  }

  isPlayerBlockedAt(x, y, options = {}) {
    const halfW = this.player.width / 2;
    const halfH = this.player.height / 2;
    const inset = 2;
    const ignoreOneWay = options.ignoreOneWay || false;
    const points = [
      { x: x - halfW + inset, y: y - halfH + inset },
      { x: x + halfW - inset, y: y - halfH + inset },
      { x: x - halfW + inset, y: y + halfH - inset },
      { x: x + halfW - inset, y: y + halfH - inset }
    ];
    return points.some((point) => {
      const tileX = Math.floor(point.x / this.world.tileSize);
      const tileY = Math.floor(point.y / this.world.tileSize);
      return this.world.isSolid(tileX, tileY, this.abilities, { ignoreOneWay });
    });
  }

  hasCeilingAbovePlayer(maxTiles = 1) {
    const tileSize = this.world.tileSize;
    const headY = this.player.y - this.player.height / 2;
    const halfW = this.player.width / 2 - 2;
    for (let i = 1; i <= maxTiles; i += 1) {
      const sampleY = headY - i * tileSize + 1;
      const points = [
        this.player.x - halfW,
        this.player.x,
        this.player.x + halfW
      ];
      const hit = points.some((x) => {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(sampleY / tileSize);
        return this.world.isSolid(tileX, tileY, this.abilities);
      });
      if (hit) return true;
    }
    return false;
  }

  resolveEnemyCollision(enemy) {
    const tileSize = this.world.tileSize;
    let rect = enemy.rect;
    const overlaps = [];
    const startX = Math.floor(rect.x / tileSize);
    const endX = Math.floor((rect.x + rect.w) / tileSize);
    const startY = Math.floor(rect.y / tileSize);
    const endY = Math.floor((rect.y + rect.h) / tileSize);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.world.isSolid(tx, ty, this.abilities)) {
          overlaps.push({ tx, ty });
        }
      }
    }
    overlaps.forEach(({ tx, ty }) => {
      const tileRect = {
        x: tx * tileSize,
        y: ty * tileSize,
        w: tileSize,
        h: tileSize
      };
      const overlapX = Math.min(rect.x + rect.w - tileRect.x, tileRect.x + tileRect.w - rect.x);
      const overlapY = Math.min(rect.y + rect.h - tileRect.y, tileRect.y + tileRect.h - rect.y);
      if (overlapX < overlapY) {
        enemy.x += rect.x < tileRect.x ? -overlapX : overlapX;
        if (enemy.bounceOnWalls) {
          enemy.vx = -enemy.vx;
          enemy.facing = Math.sign(enemy.vx) || enemy.facing;
        }
      } else {
        enemy.y += rect.y < tileRect.y ? -overlapY : overlapY;
        enemy.vy = 0;
      }
      rect = enemy.rect;
    });
  }

  applyEnemyGravity(enemy, dt) {
    if (!enemy.gravity) return;
    enemy.vy += MOVEMENT_MODEL.gravity * dt;
    const nextY = enemy.y + enemy.vy * dt;
    const rect = enemy.rect;
    const signY = Math.sign(enemy.vy);
    if (signY === 0) {
      enemy.y = nextY;
      return;
    }
    const testY = nextY + (signY * rect.h) / 2;
    const ignoreOneWay = signY < 0;
    const leftX = rect.x + 4;
    const rightX = rect.x + rect.w - 4;
    const hitLeft = this.world.isSolid(
      Math.floor(leftX / this.world.tileSize),
      Math.floor(testY / this.world.tileSize),
      this.abilities,
      { ignoreOneWay }
    );
    const hitRight = this.world.isSolid(
      Math.floor(rightX / this.world.tileSize),
      Math.floor(testY / this.world.tileSize),
      this.abilities,
      { ignoreOneWay }
    );
    if (hitLeft || hitRight) {
      enemy.vy = 0;
      return;
    }
    enemy.y = nextY;
  }

  isRevHeld(input) {
    return input.isDown('attack') || input.isDown('rev');
  }

  isEnemyVisible(enemy, padding = 80) {
    const left = this.camera.x - padding;
    const right = this.camera.x + this.canvas.width + padding;
    const top = this.camera.y - padding;
    const bottom = this.camera.y + this.canvas.height + padding;
    return enemy.x > left && enemy.x < right && enemy.y > top && enemy.y < bottom;
  }

  canEnemyShoot(enemy, range = 320, padding = 80) {
    if (!this.isEnemyVisible(enemy, padding)) return false;
    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    return Math.hypot(dx, dy) <= range;
  }

  isEnemyPositionClear(enemy, x, y) {
    const tileSize = this.world.tileSize;
    const rect = {
      x: x - enemy.width / 2,
      y: y - enemy.height / 2,
      w: enemy.width,
      h: enemy.height
    };
    const startX = Math.floor(rect.x / tileSize);
    const endX = Math.floor((rect.x + rect.w) / tileSize);
    const startY = Math.floor(rect.y / tileSize);
    const endY = Math.floor((rect.y + rect.h) / tileSize);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.world.isSolid(tx, ty, this.abilities, { ignoreOneWay: true })) {
          return false;
        }
      }
    }
    return true;
  }

  isPlayerKnockbackBlocked(dir) {
    const rect = this.player.rect;
    const tileSize = this.world.tileSize;
    const testX = this.player.x + (rect.w / 2 + 2) * dir;
    const topY = rect.y + 4;
    const bottomY = rect.y + rect.h - 4;
    const tileX = Math.floor(testX / tileSize);
    const tileTop = Math.floor(topY / tileSize);
    const tileBottom = Math.floor(bottomY / tileSize);
    if (this.world.isSolid(tileX, tileTop, this.abilities, { ignoreOneWay: true })) {
      return true;
    }
    if (this.world.isSolid(tileX, tileBottom, this.abilities, { ignoreOneWay: true })) {
      return true;
    }
    return false;
  }

  resolvePlayerEnemyOverlap(enemy, { pushEnemy = false } = {}) {
    const playerRect = this.player.rect;
    const enemyRect = enemy.rect;
    const overlapX = Math.min(
      playerRect.x + playerRect.w - enemyRect.x,
      enemyRect.x + enemyRect.w - playerRect.x
    );
    const overlapY = Math.min(
      playerRect.y + playerRect.h - enemyRect.y,
      enemyRect.y + enemyRect.h - playerRect.y
    );
    if (overlapX <= 0 || overlapY <= 0) return false;
    if (pushEnemy && overlapX < overlapY) {
      const dir = Math.sign(this.player.vx) || this.player.facing;
      if (dir !== 0) {
        const targetX = enemy.x + overlapX * dir;
        if (this.isEnemyPositionClear(enemy, targetX, enemy.y)) {
          enemy.x = targetX;
          return true;
        }
      }
    }
    if (overlapX < overlapY) {
      const dir = playerRect.x < enemyRect.x ? -1 : 1;
      this.player.x += overlapX * dir;
      this.player.vx = 0;
    } else {
      const dir = playerRect.y < enemyRect.y ? -1 : 1;
      this.player.y += overlapY * dir;
      this.player.vy = 0;
      if (dir < 0) {
        this.player.onGround = true;
      }
    }
    return true;
  }

  applyPlayerKnockback(enemy, strengthX = 180, strengthY = 140) {
    const knockback = Math.sign(this.player.x - enemy.x) || 1;
    this.player.vx = this.isPlayerKnockbackBlocked(knockback) ? 0 : knockback * strengthX;
    this.player.vy = -strengthY;
    this.player.onGround = false;
  }

  handleAttack() {
    if (this.sawAnchor.active) return;
    const attackRange = this.world.tileSize * 2.5;
    if (!this.player.onGround && this.player.aimingDown) {
      this.player.attackTimer = Math.max(this.player.attackTimer, 0.3);
      this.player.attackLungeTimer = 0;
      const thrustSpeed = MOVEMENT_MODEL.dashSpeed * 0.85;
      this.player.vx *= 0.4;
      this.player.vy = Math.max(this.player.vy, thrustSpeed);
      const range = attackRange;
      this.spawnEffect('bite', this.player.x, this.player.y + 18);
      this.audio.bite();
      this.recordFeedback('chainsaw bite', 'audio');
      this.recordFeedback('chainsaw bite', 'visual');
      this.enemies.forEach((enemy) => {
        if (enemy.dead) return;
        const dx = Math.abs(enemy.x - this.player.x);
        const dy = enemy.y - this.player.y;
        if (dx < range && dy > 0 && dy < 60) {
          if (enemy.type === 'bulwark' && !enemy.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce'))) {
            return;
          }
          enemy.damage(1);
          this.applyChainsawSlow(enemy);
          this.audio.hit();
          this.spawnEffect('hit', enemy.x, enemy.y);
          this.spawnEffect('oil', enemy.x, enemy.y + 6);
          this.recordFeedback('hit', 'audio');
          this.recordFeedback('hit', 'visual');
          this.testHarness.recordHit();
          this.playability.recordEnemyHit(this.clock);
          if (enemy.dead) {
            if (!enemy.training) {
              this.spawnDeathDebris(enemy);
            }
            this.awardLoot(enemy);
          }
        }
      });
      if (this.boss && !this.boss.dead) {
        const dx = Math.abs(this.boss.x - this.player.x);
        const dy = this.boss.y - this.player.y;
        if (dx < range + 10 && dy > 0 && dy < 80) {
          this.boss.damage(1);
          this.applyChainsawSlow(this.boss);
          this.audio.hit();
          this.spawnEffect('hit', this.boss.x, this.boss.y);
          this.spawnEffect('oil', this.boss.x, this.boss.y + 10);
          this.recordFeedback('hit', 'audio');
          this.recordFeedback('hit', 'visual');
          this.playability.recordEnemyHit(this.clock);
        }
      }
      return;
    }
    this.player.attackTimer = Math.max(this.player.attackTimer, 0.25);
    const lungeRange = 220;
    let lungeTarget = null;
    let bestDist = Infinity;
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist && dist <= lungeRange) {
        bestDist = dist;
        lungeTarget = enemy;
      }
    });
    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - this.player.x;
      const dy = this.boss.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist && dist <= lungeRange) {
        bestDist = dist;
        lungeTarget = this.boss;
      }
    }
    if (this.player.dashTimer <= 0) {
      const targetX = lungeTarget ? lungeTarget.x : this.player.x + this.player.facing * 60;
      this.player.startLunge(targetX);
    }
    const range = attackRange;
    this.spawnEffect('bite', this.player.x + this.player.facing * 18, this.player.y - 8);
    this.audio.bite();
    this.recordFeedback('chainsaw bite', 'audio');
    this.recordFeedback('chainsaw bite', 'visual');
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const dx = enemy.x - this.player.x;
      const dy = Math.abs(enemy.y - this.player.y);
      if (Math.abs(dx) < range && dy < 40) {
        if (enemy.type === 'bulwark' && !enemy.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce'))) {
          return;
        }
        enemy.damage(1);
        this.applyChainsawSlow(enemy);
        this.audio.hit();
        this.spawnEffect('hit', enemy.x, enemy.y);
        this.spawnEffect('oil', enemy.x, enemy.y + 6);
        this.recordFeedback('hit', 'audio');
        this.recordFeedback('hit', 'visual');
        this.testHarness.recordHit();
        this.playability.recordEnemyHit(this.clock);
        if (enemy.justStaggered) {
          this.audio.stagger();
          this.spawnEffect('stagger', enemy.x, enemy.y);
          this.recordFeedback('stagger', 'audio');
          this.recordFeedback('stagger', 'visual');
          this.testHarness.recordStagger();
          enemy.justStaggered = false;
        }
        if (enemy.dead) {
          if (!enemy.training) {
            this.spawnDeathDebris(enemy);
          }
          this.awardLoot(enemy);
        }
      }
    });

    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - this.player.x;
      const dy = Math.abs(this.boss.y - this.player.y);
      if (Math.abs(dx) < range && dy < 60) {
        this.boss.damage(1);
        this.applyChainsawSlow(this.boss);
        this.audio.hit();
        this.spawnEffect('hit', this.boss.x, this.boss.y);
        this.spawnEffect('oil', this.boss.x, this.boss.y + 10);
        this.recordFeedback('hit', 'audio');
        this.recordFeedback('hit', 'visual');
        this.playability.recordEnemyHit(this.clock);
      }
    }
  }

  handleRev() {
    const range = this.world.tileSize * 1.5;
    const verticalRange = this.world.tileSize * 1.2;
    const candidates = this.enemies.filter((enemy) => {
      if (enemy.dead) return false;
      const dx = enemy.x - this.player.x;
      const dy = Math.abs(enemy.y - this.player.y);
      return Math.abs(dx) < range && dy < verticalRange && enemy.stagger >= 0.6;
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
    this.audio.execute();
    this.spawnEffect('execute', enemy.x, enemy.y);
    this.recordFeedback('execute', 'audio');
    this.recordFeedback('execute', 'visual');
    this.playability.recordEnemyHit(this.clock);
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

  spawnDeathDebris(enemy) {
    this.spawnEffect('splat', enemy.x, enemy.y);
    this.spawnEffect('splat', enemy.x + (Math.random() - 0.5) * 30, enemy.y + (Math.random() - 0.5) * 20);
    this.spawnEffect('splat', enemy.x + (Math.random() - 0.5) * 20, enemy.y + (Math.random() - 0.5) * 30);
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
    const context = {
      spawnProjectile: this.spawnProjectile.bind(this),
      spawnMinion: (x, y) => this.requestSpawn('skitter', x, y),
      canShoot: (enemy, range = 320, padding = 80) => this.canEnemyShoot(enemy, range, padding),
      isVisible: (enemy, padding = 80) => this.isEnemyVisible(enemy, padding)
    };
    const revHeld = this.isRevHeld(this.input) && this.player.canRev();
    const revRange = this.world.tileSize * 2.5;
    const revVerticalRange = this.world.tileSize * 2.2;
    this.enemies.forEach((enemy) => {
      if (enemy.dead) {
        if (enemy.deathTimer > 0 && enemy.updateDeath) {
          enemy.updateDeath(dt);
        }
        return;
      }
      if (enemy.slowTimer > 0) {
        enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      }
      if (enemy.hitPause > 0) {
        enemy.hitPause = Math.max(0, enemy.hitPause - dt);
        if (enemy.tickDamage) {
          enemy.tickDamage(dt);
        }
        return;
      }
      const slowScale = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
      const scaledDt = dt * slowScale;
      enemy.update(scaledDt, this.player, context);
      this.applyEnemyGravity(enemy, scaledDt);
      if (enemy.solid) {
        this.resolveEnemyCollision(enemy);
      }

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      let handledRideHit = false;
      if (this.player.sawRideActive) {
        const rideAttacking = this.input.isDown('attack') || this.player.sawRideBurstTimer > 0;
        if (!enemy.solid && dist < 24) {
          this.player.stopSawRide(false);
        } else if (enemy.solid && dist < 28) {
          handledRideHit = true;
          if (rideAttacking && this.player.sawRideDamageTimer <= 0) {
            enemy.damage(1);
            this.applyChainsawSlow(enemy);
            this.player.sawRideDamageTimer = 0.2;
            enemy.hitPause = 0.1;
            this.audio.hit();
            this.spawnEffect('hit', enemy.x, enemy.y);
            this.spawnEffect('oil', enemy.x, enemy.y + 6);
            this.recordFeedback('hit', 'audio');
            this.recordFeedback('hit', 'visual');
            this.playability.recordEnemyHit(this.clock);
            if (enemy.dead) {
              if (!enemy.training) {
                this.spawnDeathDebris(enemy);
              }
              this.awardLoot(enemy);
            }
          } else if (!rideAttacking && enemy.gravity && !enemy.training) {
            const tookDamage = this.player.takeDamage(1);
            if (tookDamage) {
              this.applyPlayerKnockback(enemy);
              enemy.hitPause = 0.2;
            }
          }
        }
      }
      if (!handledRideHit && dist < 24) {
        if (!enemy.training) {
          const tookDamage = this.player.takeDamage(1);
          if (tookDamage) {
            this.applyPlayerKnockback(enemy);
            enemy.hitPause = 0.2;
          }
        }
      }
      if (revHeld && !this.player.sawRideActive && this.player.revDamageTimer <= 0) {
        if (Math.abs(dx) < revRange && Math.abs(dy) < revVerticalRange) {
          if (!(enemy.type === 'bulwark' && !enemy.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce')))) {
            enemy.damage(1);
            this.applyChainsawSlow(enemy);
            this.player.revDamageTimer = 0.2;
            enemy.hitPause = 0.08;
            this.audio.hit();
            this.spawnEffect('hit', enemy.x, enemy.y);
            this.spawnEffect('oil', enemy.x, enemy.y + 6);
            this.recordFeedback('hit', 'audio');
            this.recordFeedback('hit', 'visual');
            this.playability.recordEnemyHit(this.clock);
            if (enemy.dead) {
              if (!enemy.training) {
                this.spawnDeathDebris(enemy);
              }
              this.awardLoot(enemy);
            }
          }
        }
      }
      const canPushEnemy = revHeld && Math.abs(dx) < revRange && Math.abs(dy) < revVerticalRange;
      this.resolvePlayerEnemyOverlap(enemy, { pushEnemy: canPushEnemy });

      if (enemy.justStaggered) {
        this.audio.stagger();
        this.spawnEffect('stagger', enemy.x, enemy.y);
        this.recordFeedback('stagger', 'audio');
        this.recordFeedback('stagger', 'visual');
        this.testHarness.recordStagger();
        enemy.justStaggered = false;
      }

      if (enemy.tickDamage) {
        enemy.tickDamage(dt);
      }
    });

    if (this.boss && !this.boss.dead && this.bossActive) {
      this.boss.simMode = this.simulationActive && this.goldenPath.active;
      if (this.boss.slowTimer > 0) {
        this.boss.slowTimer = Math.max(0, this.boss.slowTimer - dt);
      }
      const bossSlowScale = this.boss.slowTimer > 0 ? this.boss.slowFactor : 1;
      this.boss.update(dt * bossSlowScale, this.player, this.spawnProjectile.bind(this));
      if (this.boss.tickDamage) {
        this.boss.tickDamage(dt);
      }
      this.handleBossInteractions();
    }
  }

  handleBossInteractions() {
    if (!this.boss || this.boss.dead) return;
    const dist = Math.hypot(this.player.x - this.boss.x, this.player.y - this.boss.y);
    if (dist > 200) return;
    const simAssist = this.simulationActive && this.goldenPath.active;
    if (this.boss.phase === 0 && this.abilities.anchor && this.input.wasPressed('throw')) {
      this.boss.triggerExposure();
      this.bossInteractions.anchor = true;
    }
    if (this.boss.phase === 1 && this.abilities.flame && this.player.flameMode && this.isRevHeld(this.input)) {
      this.boss.triggerExposure();
      this.bossInteractions.flame = true;
    }
    if (this.boss.phase === 2 && this.abilities.magboots && (this.player.onWall !== 0 || simAssist && this.isRevHeld(this.input))) {
      this.boss.triggerExposure();
      this.bossInteractions.magboots = true;
    }
    if (this.boss.phase === 3 && this.abilities.resonance && this.isRevHeld(this.input)) {
      this.boss.triggerExposure();
      this.bossInteractions.resonance = true;
    }
  }

  updateProjectiles(dt) {
    this.projectiles.forEach((projectile) => {
      projectile.update(dt);
      if (projectile.dead) return;
      const tileX = Math.floor(projectile.x / this.world.tileSize);
      const tileY = Math.floor(projectile.y / this.world.tileSize);
      if (this.world.isSolid(tileX, tileY, this.abilities)) {
        projectile.dead = true;
      }
    });
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
        this.audio.pickup();
        this.spawnEffect('pickup', drop.x, drop.y - 8);
        this.recordFeedback('pickup', 'audio');
        this.recordFeedback('pickup', 'visual');
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

  showAbilityDialog(ability) {
    const lines = ABILITY_DIALOG_LINES[ability];
    if (!lines) return;
    this.dialog = new Dialog(lines);
    this.state = 'dialog';
    this.audio.ui();
    this.recordFeedback('menu navigate', 'audio');
    this.recordFeedback('menu navigate', 'visual');
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
        this.audio.pickup();
        this.spawnEffect('pickup', pickup.x, pickup.y - 8);
        this.recordFeedback('pickup', 'audio');
        this.recordFeedback('pickup', 'visual');
        this.showAbilityDialog(pickup.ability);
      }
    });

    this.world.healthUpgrades.forEach((upgrade) => {
      if (upgrade.collected) return;
      const dist = Math.hypot(upgrade.x - this.player.x, upgrade.y - this.player.y);
      if (dist < 30) {
        upgrade.collected = true;
        this.player.gainMaxHealth(1);
        this.audio.pickup();
        this.spawnEffect('pickup', upgrade.x, upgrade.y - 8);
        this.recordFeedback('pickup', 'audio');
        this.recordFeedback('pickup', 'visual');
      }
    });
  }

  checkSavePoints() {
    let saved = false;
    this.world.savePoints.forEach((save) => {
      const dist = Math.hypot(save.x - this.player.x, save.y - this.player.y);
      if (dist < 40) {
        this.world.savePoints.forEach((point) => {
          point.active = false;
        });
        save.active = true;
        this.lastSave = { x: save.x, y: save.y - 40 };
        this.player.health = this.player.maxHealth;
        this.audio.save();
        this.spawnEffect('interact', save.x, save.y - 16);
        this.recordFeedback('interact', 'audio');
        this.recordFeedback('interact', 'visual');
        saved = true;
      }
    });
    return saved;
  }

  checkShops() {
    const nearShop = this.world.shops.find((shop) => Math.hypot(shop.x - this.player.x, shop.y - this.player.y) < 40);
    if (nearShop && this.input.wasPressed('interact')) {
      this.state = 'shop';
      this.audio.interact();
      this.spawnEffect('interact', nearShop.x, nearShop.y - 16);
      this.recordFeedback('interact', 'audio');
      this.recordFeedback('interact', 'visual');
      return true;
    }
    return false;
  }

  updateObjective() {
    if (this.gameMode === 'endless') {
      this.objective = 'Survive the endless horde.';
      return;
    }
    if (this.world.objectives.length > 0) {
      this.objective = 'Reach the objective marker.';
      return;
    }
    if (!this.abilities.anchor) {
      this.objective = 'Recover the Chainsaw Throw rig in the Tangle.';
    } else if (!this.abilities.flame) {
      this.objective = 'Enter the Foundry and claim the Flame-Saw attachment.';
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

  updateBossState() {
    if (!this.boss || this.boss.dead) {
      this.bossActive = false;
      if (this.boss && this.boss.dead) {
        this.victory = true;
      }
      return;
    }
    const region = this.world.regionAt(this.player.x, this.player.y);
    if (region.id === 'rift') {
      this.bossActive = true;
    } else {
      this.bossActive = false;
    }
  }

  handleThrow() {
    if (!this.abilities.anchor) return;
    this.player.attackTimer = Math.max(this.player.attackTimer, 0.25);
    if (this.sawAnchor.active) {
      this.startAnchorRetract(0.05);
      this.audio.interact();
      return;
    }
    const hit = this.findAnchorHit();
    if (!hit) return;
    if (hit.hit) {
      this.activateAnchor(hit, false);
    } else {
      this.activateAnchor(hit, true);
    }
    this.audio.interact();
  }

  handleAnchorShot() {
    if (!this.abilities.anchor) return;
    this.player.attackTimer = Math.max(this.player.attackTimer, 0.25);
    if (this.sawAnchor.active) {
      this.startAnchorRetract(0.2);
      return;
    }
    const hit = this.findAnchorHit();
    if (!hit) return;
    this.activateAnchor(hit, !hit.hit);
  }

  findAnchorHit() {
    const range = this.world.tileSize * 5;
    const step = 8;
    const aimX = this.player.aimX ?? (this.player.facing || 1);
    const aimY = this.player.aimY ?? 0;
    const aimLength = Math.hypot(aimX, aimY) || 1;
    const dirX = aimX / aimLength;
    const dirY = aimY / aimLength;
    const originX = this.player.x;
    const originY = this.player.y - 6;
    for (let dist = 24; dist <= range; dist += step) {
      const testX = originX + dirX * dist;
      const testY = originY + dirY * dist;
      const enemyHit = this.findAnchorEnemyHit(testX, testY);
      if (enemyHit) {
        return { x: enemyHit.target.x, y: enemyHit.target.y, hit: true, box: null, enemy: enemyHit.target, isBoss: enemyHit.isBoss };
      }
      const boxHit = this.findAnchorBoxHit(testX, testY);
      if (boxHit) {
        return { x: boxHit.x, y: boxHit.y, hit: true, box: boxHit, enemy: null, isBoss: false };
      }
      const tileX = Math.floor(testX / this.world.tileSize);
      const tileY = Math.floor(testY / this.world.tileSize);
      if (this.world.isSolid(tileX, tileY, this.abilities)) {
        return {
          x: tileX * this.world.tileSize + this.world.tileSize / 2,
          y: tileY * this.world.tileSize + this.world.tileSize / 2,
          hit: true,
          box: null,
          enemy: null,
          isBoss: false
        };
      }
    }
    return {
      x: originX + dirX * range,
      y: originY + dirY * range,
      hit: false,
      box: null,
      enemy: null,
      isBoss: false
    };
  }

  findAnchorEnemyHit(testX, testY) {
    const radius = 18;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (Math.abs(enemy.x - testX) <= radius && Math.abs(enemy.y - testY) <= radius) {
        return { target: enemy, isBoss: false };
      }
    }
    if (this.boss && !this.boss.dead) {
      if (Math.abs(this.boss.x - testX) <= radius + 14 && Math.abs(this.boss.y - testY) <= radius + 14) {
        return { target: this.boss, isBoss: true };
      }
    }
    return null;
  }

  findAnchorBoxHit(testX, testY) {
    const radius = this.boxSize / 2;
    for (const box of this.boxes) {
      if (Math.abs(box.x - testX) <= radius && Math.abs(box.y - testY) <= radius) {
        return box;
      }
    }
    return null;
  }

  activateAnchor(hit, autoRetract) {
    this.sawAnchor.active = true;
    this.sawAnchor.x = hit.x;
    this.sawAnchor.y = hit.y;
    this.sawAnchor.fuelDrain = 0;
    this.sawAnchor.pullTimer = 0;
    this.sawAnchor.retractTimer = 0;
    this.sawAnchor.autoRetractTimer = autoRetract ? 0.35 : 0;
    this.sawAnchor.embedded = Boolean(hit.hit && !hit.box);
    this.sawAnchor.attachedBox = hit.box || null;
    this.sawAnchor.attachedEnemy = hit.enemy || null;
    this.sawAnchor.damageTimer = 0;
    this.player.sawDeployed = true;
    if (!this.player.onGround) {
      this.player.jumpsRemaining = Math.max(this.player.jumpsRemaining, 1);
    }
    if (hit.enemy) {
      this.applyAnchorImpactDamage(hit.enemy, hit.isBoss);
    }
  }

  startAnchorRetract(duration = 0.4) {
    this.sawAnchor.retractTimer = Math.max(this.sawAnchor.retractTimer, duration);
    this.sawAnchor.autoRetractTimer = 0;
    this.sawAnchor.embedded = false;
    this.sawAnchor.attachedBox = null;
    this.sawAnchor.attachedEnemy = null;
  }

  triggerTetherPull() {
    this.sawAnchor.pullTimer = Math.max(this.sawAnchor.pullTimer, 0.3);
  }

  climbSawAnchor(dt, climbSpeed) {
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.sawAnchor.x / tileSize);
    const nextY = this.sawAnchor.y - climbSpeed * dt;
    const tileY = Math.floor(nextY / tileSize);
    if (nextY < this.sawAnchor.y) {
      const playerNextY = this.player.y - climbSpeed * dt;
      if (this.isPlayerBlockedAt(this.player.x, playerNextY, { ignoreOneWay: true })) {
        return;
      }
      if (!this.canPlayerMaintainTether(this.sawAnchor.x, nextY)) {
        return;
      }
    }
    if (this.world.isSolid(tileX, tileY, this.abilities)) {
      if (this.wouldSawAnchorPullIntoWall(this.sawAnchor.x, nextY)) {
        return;
      }
      this.sawAnchor.y = nextY;
    } else {
      this.pullPlayerTowardAnchor(tileSize * 2);
    }
  }

  updateSawAnchor(dt, input) {
    if (!this.sawAnchor.active) return;
    if (this.sawAnchor.pullTimer > 0) {
      this.sawAnchor.pullTimer = Math.max(0, this.sawAnchor.pullTimer - dt);
    }
    if (this.sawAnchor.damageTimer > 0) {
      this.sawAnchor.damageTimer = Math.max(0, this.sawAnchor.damageTimer - dt);
    }
    if (this.sawAnchor.retractTimer > 0) {
      this.sawAnchor.retractTimer = Math.max(0, this.sawAnchor.retractTimer - dt);
      const dx = this.player.x - this.sawAnchor.x;
      const dy = this.player.y - this.sawAnchor.y;
      const dist = Math.hypot(dx, dy) || 1;
      const retractSpeed = 520;
      const step = Math.min(dist, retractSpeed * dt);
      this.sawAnchor.x += (dx / dist) * step;
      this.sawAnchor.y += (dy / dist) * step;
      if (this.sawAnchor.retractTimer <= 0 || dist < 12) {
        this.sawAnchor.active = false;
        this.player.sawDeployed = false;
        this.sawAnchor.embedded = false;
        this.sawAnchor.attachedBox = null;
        this.sawAnchor.attachedEnemy = null;
      }
      return;
    }
    if (this.sawAnchor.attachedBox) {
      this.sawAnchor.x = this.sawAnchor.attachedBox.x;
      this.sawAnchor.y = this.sawAnchor.attachedBox.y;
    }
    if (this.sawAnchor.attachedEnemy) {
      if (this.sawAnchor.attachedEnemy.dead) {
        this.startAnchorRetract(0.2);
        return;
      }
      this.sawAnchor.x = this.sawAnchor.attachedEnemy.x;
      this.sawAnchor.y = this.sawAnchor.attachedEnemy.y;
    }
    this.sawAnchor.fuelDrain += dt;
    if (this.sawAnchor.fuelDrain >= 0.6) {
      this.player.fuel = Math.max(0, this.player.fuel - 0.2);
      this.sawAnchor.fuelDrain = 0;
    }
    this.player.addHeat(dt * 0.08);
    if (this.player.fuel <= 0 || this.player.overheat > 0) {
      this.sawAnchor.active = false;
      this.player.sawDeployed = false;
      this.sawAnchor.embedded = false;
      this.sawAnchor.attachedBox = null;
      this.sawAnchor.attachedEnemy = null;
    }
    if (this.sawAnchor.autoRetractTimer > 0) {
      this.sawAnchor.autoRetractTimer = Math.max(0, this.sawAnchor.autoRetractTimer - dt);
      if (this.sawAnchor.autoRetractTimer <= 0) {
        this.startAnchorRetract(0.45);
      }
    }
    const tetherMax = this.world.tileSize * 5;
    const tetherDist = Math.hypot(this.player.x - this.sawAnchor.x, this.player.y - this.sawAnchor.y);
    if (this.applyTetherConstraint(dt, input, tetherDist, tetherMax)) {
      return;
    }
    if (this.sawAnchor.attachedBox) {
      this.pullBoxTowardPlayer(dt, input);
    }
    if (this.sawAnchor.embedded && this.isRevHeld(input)) {
      if (!this.sawAnchor.attachedEnemy) {
        this.climbSawAnchor(dt, 140);
      }
      this.applySawAnchorDamage();
    }
  }

  applyTetherConstraint(dt, input, tetherDist, tetherMax) {
    const tetherSlack = 0;
    const tetherLimit = tetherMax + tetherSlack;
    if (tetherDist > tetherLimit
      && !this.sawAnchor.embedded
      && !this.sawAnchor.attachedBox
      && !this.sawAnchor.attachedEnemy) {
      this.startAnchorRetract(0.2);
      return true;
    }
    if (tetherDist <= 0.01) return false;
    const dx = this.player.x - this.sawAnchor.x;
    const dy = this.player.y - this.sawAnchor.y;
    const dist = Math.max(0.01, tetherDist);
    if (dist > tetherLimit) {
      const prevX = this.player.x;
      const prevY = this.player.y;
      const nx = dx / dist;
      const ny = dy / dist;
      const targetX = this.sawAnchor.x + dx * (tetherLimit / dist);
      const targetY = this.sawAnchor.y + dy * (tetherLimit / dist);
      if (!this.isPlayerBlockedAt(targetX, targetY)) {
        this.player.x = targetX;
        this.player.y = targetY;
      } else {
        const xOnlyOk = !this.isPlayerBlockedAt(targetX, this.player.y);
        const yOnlyOk = !this.isPlayerBlockedAt(this.player.x, targetY);
        if (xOnlyOk) {
          this.player.x = targetX;
        } else if (yOnlyOk) {
          this.player.y = targetY;
        }
      }
      const moved = this.player.x !== prevX || this.player.y !== prevY;
      if (!moved && this.sawAnchor.embedded) {
        this.startAnchorRetract(0.2);
        return true;
      }
      const radialVelocity = this.player.vx * nx + this.player.vy * ny;
      if (radialVelocity > 0) {
        this.player.vx -= radialVelocity * nx;
        this.player.vy -= radialVelocity * ny;
      }
      this.player.onGround = false;
    }
    const pullHeld = input.isDown('attack');
    if (this.sawAnchor.embedded && pullHeld && !this.sawAnchor.attachedEnemy && !this.sawAnchor.attachedBox) {
      if (dist >= tetherMax * 0.96) {
        const pullSpeed = 220;
        const step = Math.min(dist, pullSpeed * dt);
        const targetX = this.player.x - (dx / dist) * step;
        const targetY = this.player.y - (dy / dist) * step;
        if (!this.isPlayerBlockedAt(targetX, targetY)) {
          this.player.x = targetX;
          this.player.y = targetY;
          this.player.vx = Math.min(this.player.vx, -(dx / dist) * pullSpeed * 0.6);
          this.player.vy = Math.min(this.player.vy, -(dy / dist) * pullSpeed * 0.6);
          this.player.onGround = false;
        }
      }
    }
    if (this.sawAnchor.active && !this.player.onGround && input.wasPressed('jump')) {
      const jumpBoost = this.player.jumpPower * 0.85;
      this.player.vx -= (dx / dist) * jumpBoost * 0.35;
      const anchorBoostY = -(dy / dist) * jumpBoost;
      this.player.vy = Math.min(this.player.vy, Math.min(-jumpBoost, anchorBoostY));
      this.player.onGround = false;
    }
    if (this.sawAnchor.active && !this.player.onGround) {
      this.player.vy += MOVEMENT_MODEL.gravity * dt * 0.35;
    }
    return false;
  }

  wouldSawAnchorPullIntoWall(nextX, nextY) {
    const tetherMax = this.world.tileSize * 5;
    const dx = this.player.x - nextX;
    const dy = this.player.y - nextY;
    const dist = Math.hypot(dx, dy);
    if (dist <= tetherMax || dist <= 0.01) return false;
    const targetX = nextX + dx * (tetherMax / dist);
    const targetY = nextY + dy * (tetherMax / dist);
    if (!this.isPlayerBlockedAt(targetX, targetY)) return false;
    const xOnlyOk = !this.isPlayerBlockedAt(targetX, this.player.y);
    const yOnlyOk = !this.isPlayerBlockedAt(this.player.x, targetY);
    return !(xOnlyOk || yOnlyOk);
  }

  canPlayerMaintainTether(nextX, nextY) {
    const tetherMax = this.world.tileSize * 5;
    const dx = this.player.x - nextX;
    const dy = this.player.y - nextY;
    const dist = Math.hypot(dx, dy);
    if (dist <= tetherMax) return true;
    const targetX = nextX + dx * (tetherMax / dist);
    const targetY = nextY + dy * (tetherMax / dist);
    if (!this.isPlayerBlockedAt(targetX, targetY, { ignoreOneWay: true })) return true;
    const xOnlyOk = !this.isPlayerBlockedAt(targetX, this.player.y, { ignoreOneWay: true });
    const yOnlyOk = !this.isPlayerBlockedAt(this.player.x, targetY, { ignoreOneWay: true });
    return xOnlyOk || yOnlyOk;
  }

  applyAnchorClimb(dt) {
    if (!this.sawAnchor.active) return;
    if (!this.sawAnchor.embedded) return;
    const pulling = this.sawAnchor.pullTimer > 0;
    if (!this.isRevHeld(this.input) && !pulling) return;
    if (this.sawAnchor.attachedEnemy) return;
    const dx = Math.abs(this.player.x - this.sawAnchor.x);
    const dy = this.player.y - this.sawAnchor.y;
    if (dx > 20 || dy < -40 || dy > 80) return;
    if (this.hasCeilingAbovePlayer()) return;
    const climbSpeed = pulling ? 200 : 120;
    const nextY = this.player.y - climbSpeed * dt;
    const tileX = Math.floor(this.player.x / this.world.tileSize);
    const tileY = Math.floor((nextY - this.player.height / 2) / this.world.tileSize);
    if (!this.world.isSolid(tileX, tileY, this.abilities)) {
      if (this.isPlayerBlockedAt(this.player.x, nextY, { ignoreOneWay: true })) {
        return;
      }
      this.player.y = nextY;
      this.player.vy = Math.min(this.player.vy, -climbSpeed);
      this.player.onGround = false;
    }
  }

  applySawAnchorDamage() {
    if (this.sawAnchor.damageTimer > 0) return;
    const range = 26;
    let hit = false;
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const dx = Math.abs(enemy.x - this.sawAnchor.x);
      const dy = Math.abs(enemy.y - this.sawAnchor.y);
      if (dx < range && dy < range) {
        if (enemy.type === 'bulwark' && !enemy.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce'))) {
          return;
        }
        enemy.damage(1);
        this.applyChainsawSlow(enemy);
        this.spawnEffect('hit', enemy.x, enemy.y);
        this.spawnEffect('oil', enemy.x, enemy.y + 6);
        hit = true;
        if (enemy.dead && !enemy.training) {
          this.spawnDeathDebris(enemy);
          this.awardLoot(enemy);
        }
      }
    });
    if (this.boss && !this.boss.dead) {
      const dx = Math.abs(this.boss.x - this.sawAnchor.x);
      const dy = Math.abs(this.boss.y - this.sawAnchor.y);
      if (dx < range + 10 && dy < range + 10) {
        this.boss.damage(1);
        this.applyChainsawSlow(this.boss);
        this.spawnEffect('hit', this.boss.x, this.boss.y);
        this.spawnEffect('oil', this.boss.x, this.boss.y + 10);
        hit = true;
      }
    }
    if (hit) {
      this.audio.hit();
      this.recordFeedback('hit', 'audio');
      this.recordFeedback('hit', 'visual');
      this.sawAnchor.damageTimer = 0.12;
    }
  }

  applyAnchorImpactDamage(target, isBoss) {
    if (!target || target.dead) return;
    if (!isBoss && target.type === 'bulwark' && !target.isOpen() && !this.player.equippedUpgrades.some((u) => u.tags?.includes('pierce'))) {
      return;
    }
    target.damage(1);
    this.applyChainsawSlow(target);
    this.audio.hit();
    this.spawnEffect('hit', target.x, target.y);
    this.spawnEffect('oil', target.x, target.y + (isBoss ? 10 : 6));
    this.recordFeedback('hit', 'audio');
    this.recordFeedback('hit', 'visual');
    this.playability.recordEnemyHit(this.clock);
    this.sawAnchor.damageTimer = 0.12;
    if (!isBoss && target.dead && !target.training) {
      this.spawnDeathDebris(target);
      this.awardLoot(target);
    }
  }

  applyChainsawSlow(target) {
    if (!target) return;
    target.slowTimer = Math.max(target.slowTimer || 0, 0.4);
    target.vx *= 0.5;
    target.vy *= 0.5;
  }

  pullPlayerTowardAnchor(tetherLimit) {
    const dx = this.player.x - this.sawAnchor.x;
    const dy = this.player.y - this.sawAnchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= tetherLimit || dist <= 0.01) return false;
    const targetX = this.sawAnchor.x + dx * (tetherLimit / dist);
    const targetY = this.sawAnchor.y + dy * (tetherLimit / dist);
    if (!this.isPlayerBlockedAt(targetX, targetY)) {
      this.player.x = targetX;
      this.player.y = targetY;
    } else {
      const xOnlyOk = !this.isPlayerBlockedAt(targetX, this.player.y);
      const yOnlyOk = !this.isPlayerBlockedAt(this.player.x, targetY);
      if (xOnlyOk) {
        this.player.x = targetX;
      } else if (yOnlyOk) {
        this.player.y = targetY;
      }
    }
    const radialVelocity = this.player.vx * (dx / dist) + this.player.vy * (dy / dist);
    if (radialVelocity > 0) {
      this.player.vx -= radialVelocity * (dx / dist);
      this.player.vy -= radialVelocity * (dy / dist);
    }
    this.player.onGround = false;
    return true;
  }

  getBoxRect(box) {
    const half = this.boxSize / 2;
    return {
      x: box.x - half,
      y: box.y - half,
      w: this.boxSize,
      h: this.boxSize
    };
  }

  isBoxBlockedAt(x, y, ignoreBox = null) {
    const half = this.boxSize / 2;
    const points = [
      { x: x - half, y: y - half },
      { x: x + half, y: y - half },
      { x: x - half, y: y + half },
      { x: x + half, y: y + half }
    ];
    for (const point of points) {
      const tileX = Math.floor(point.x / this.world.tileSize);
      const tileY = Math.floor(point.y / this.world.tileSize);
      if (this.world.isSolid(tileX, tileY, this.abilities, { ignoreOneWay: true })) {
        return true;
      }
    }
    const rect = { x: x - half, y: y - half, w: this.boxSize, h: this.boxSize };
    for (const other of this.boxes) {
      if (other === ignoreBox) continue;
      const otherRect = this.getBoxRect(other);
      if (rect.x < otherRect.x + otherRect.w
        && rect.x + rect.w > otherRect.x
        && rect.y < otherRect.y + otherRect.h
        && rect.y + rect.h > otherRect.y) {
        return true;
      }
    }
    return false;
  }

  moveBoxBy(box, dx, dy) {
    let movedX = 0;
    let movedY = 0;
    const stepSize = 2;
    let remainingX = dx;
    while (Math.abs(remainingX) > 0.01) {
      const step = Math.sign(remainingX) * Math.min(stepSize, Math.abs(remainingX));
      if (this.isBoxBlockedAt(box.x + step, box.y, box)) break;
      box.x += step;
      movedX += step;
      remainingX -= step;
    }
    let remainingY = dy;
    while (Math.abs(remainingY) > 0.01) {
      const step = Math.sign(remainingY) * Math.min(stepSize, Math.abs(remainingY));
      if (this.isBoxBlockedAt(box.x, box.y + step, box)) break;
      box.y += step;
      movedY += step;
      remainingY -= step;
    }
    return { movedX, movedY };
  }

  resolveBoxCollisions(prevPlayer) {
    if (this.boxes.length === 0) return;
    const deltaX = this.player.x - prevPlayer.x;
    for (const box of this.boxes) {
      const playerRect = this.player.rect;
      const boxRect = this.getBoxRect(box);
      const overlaps = playerRect.x < boxRect.x + boxRect.w
        && playerRect.x + playerRect.w > boxRect.x
        && playerRect.y < boxRect.y + boxRect.h
        && playerRect.y + playerRect.h > boxRect.y;
      if (!overlaps) continue;
      const overlapX = Math.min(playerRect.x + playerRect.w - boxRect.x, boxRect.x + boxRect.w - playerRect.x);
      const overlapY = Math.min(playerRect.y + playerRect.h - boxRect.y, boxRect.y + boxRect.h - playerRect.y);
      if (overlapX < overlapY) {
        const pushDir = Math.sign(deltaX) || (this.player.x < box.x ? -1 : 1);
        const desired = overlapX * pushDir;
        const { movedX } = this.moveBoxBy(box, desired, 0);
        const remaining = desired - movedX;
        if (Math.abs(remaining) > 0.01) {
          this.player.x -= remaining;
        }
      } else {
        const pushDir = this.player.y < box.y ? -1 : 1;
        this.player.y -= overlapY * pushDir;
        if (pushDir < 0) {
          this.player.vy = Math.min(this.player.vy, 0);
          this.player.onGround = true;
        } else {
          this.player.vy = Math.max(this.player.vy, 0);
        }
      }
    }
  }

  pullBoxTowardPlayer(dt, input) {
    if (!this.sawAnchor.attachedBox) return;
    const pulling = this.sawAnchor.pullTimer > 0 || this.isRevHeld(input);
    if (!pulling) return;
    const box = this.sawAnchor.attachedBox;
    const dx = this.player.x - box.x;
    const dy = this.player.y - box.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pullSpeed = 200;
    const step = Math.min(dist, pullSpeed * dt);
    const moveX = (dx / dist) * step;
    const moveY = (dy / dist) * step;
    this.moveBoxBy(box, moveX, moveY);
    this.sawAnchor.x = box.x;
    this.sawAnchor.y = box.y;
  }

  drawTether(ctx) {
    const start = { x: this.player.x, y: this.player.y - 8 };
    const end = { x: this.sawAnchor.x, y: this.sawAnchor.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const segments = 6;
    const pullIntensity = this.sawAnchor.pullTimer > 0 ? 1 : 0;
    const waveAmp = 2 + pullIntensity * 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const baseX = start.x + dx * t;
      const baseY = start.y + dy * t;
      const wave = Math.sin(this.clock * 10 + t * Math.PI * 2) * waveAmp;
      const x = baseX + nx * wave;
      const y = baseY + ny * wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawSawAnchor(ctx) {
    if (!this.sawAnchor.active) return;
    this.drawTether(ctx);
    ctx.save();
    if (this.sawAnchor.embedded) {
      const startX = this.player.x;
      const startY = this.player.y - 8;
      const angle = Math.atan2(this.sawAnchor.y - startY, this.sawAnchor.x - startX);
      ctx.translate(this.sawAnchor.x, this.sawAnchor.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#cfd5dc';
      ctx.fillRect(2, -3, 20, 6);
      ctx.fillStyle = '#9aa3ad';
      for (let i = 0; i < 5; i += 1) {
        ctx.fillRect(4 + i * 4, 2, 2, 3);
      }
      ctx.fillStyle = '#f25c2a';
      ctx.fillRect(-10, -7, 12, 14);
      ctx.fillStyle = '#2c2f38';
      ctx.fillRect(-14, -8, 5, 6);
      ctx.fillStyle = '#1b1e24';
      ctx.fillRect(-6, -3, 4, 6);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeRect(this.sawAnchor.x - 8, this.sawAnchor.y - 8, 16, 16);
      ctx.beginPath();
      ctx.moveTo(this.sawAnchor.x - 10, this.sawAnchor.y + 10);
      ctx.lineTo(this.sawAnchor.x + 10, this.sawAnchor.y - 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  handleFlameSawDrain(dt) {
    if (!this.player.flameMode || !this.abilities.flame) return;
    const drain = dt * 0.12;
    this.player.fuel = Math.max(0, this.player.fuel - drain);
    this.player.addHeat(dt * 0.08);
    this.triggerNoiseSpike('flame-saw');
  }

  triggerNoiseSpike(source) {
    if (this.noiseCooldown > 0) return;
    this.noiseCooldown = 0.6;
    console.log(`Noise spike: ${source} (TODO: hook into enemy aggro).`);
  }

  handleSwitchInteraction() {
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    if (this.world.getTile(tileX, tileY) !== 'T') return false;
    const cleared = this.clearHeavyDebris(tileX, tileY);
    if (cleared) {
      this.audio.interact();
      this.spawnEffect('interact', this.player.x, this.player.y - 16);
    }
    return cleared;
  }

  clearHeavyDebris(originX, originY) {
    let cleared = false;
    for (let y = originY - 4; y <= originY + 4; y += 1) {
      for (let x = originX - 6; x <= originX + 6; x += 1) {
        if (this.world.getTile(x, y) === 'U') {
          this.world.setTile(x, y, '.');
          cleared = true;
        }
      }
    }
    return cleared;
  }

  tryObstacleInteraction(mode) {
    if (this.sawAnchor.active) return false;
    if (this.obstacleCooldown > 0) return false;
    const tileSize = this.world.tileSize;
    const checkX = this.player.x + this.player.facing * tileSize * 0.55;
    const checkY = this.player.y - 6;
    const tileX = Math.floor(checkX / tileSize);
    const tileY = Math.floor(checkY / tileSize);
    const tile = this.world.getTile(tileX, tileY);
    const obstacle = OBSTACLES[tile];
    if (!obstacle) return false;
    let tool = null;
    if (mode === 'attack') {
      tool = 'chainsaw';
    } else if (mode === 'rev') {
      if (this.player.flameMode && this.abilities.flame) {
        tool = 'flame';
      } else if (this.abilities.resonance) {
        tool = 'resonance';
      }
    }
    const interaction = obstacle.interactions?.[tool];
    if (!interaction) return false;

    const key = `${tileX},${tileY}`;
    const prev = this.obstacleDamage.get(key) || 0;
    const next = prev + 1;
    this.obstacleDamage.set(key, next);
    this.player.addHeat(interaction.heat || 0);
    if (interaction.fuel) {
      this.player.fuel = Math.max(0, this.player.fuel - interaction.fuel);
    }
    if (interaction.noise) {
      this.triggerNoiseSpike(interaction.verb);
    }
    this.spawnEffect('hit', tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2);
    this.audio.hit();
    this.obstacleCooldown = 0.2;
    if (next >= (interaction.hits || 1)) {
      this.world.setTile(tileX, tileY, '.');
      if (tile === 'B') {
        this.world.bossGate = null;
      }
      this.obstacleDamage.delete(key);
      this.spawnEffect('interact', tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2);
    }
    return true;
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.state === 'title') {
      this.title.draw(ctx, canvas.width, canvas.height, this.isMobile);
      this.mobileControls.draw(ctx, this.state);
      return;
    }

    if (this.state === 'dialog') {
      this.dialog.draw(ctx, canvas.width, canvas.height, this.isMobile);
      this.mobileControls.draw(ctx, this.state);
      return;
    }

    if (this.state === 'editor') {
      this.editor.draw(ctx);
      return;
    }

    const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMagnitude : 0;
    const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMagnitude : 0;

    ctx.save();
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    this.drawWorld(ctx);
    this.drawBoxes(ctx);
    this.roomCoverageTest.drawWorld(ctx);
    this.drawInteractables(ctx);
    if (this.sawAnchor.active) {
      this.drawSawAnchor(ctx);
    }
    this.drawObjectiveBeacon(ctx);
    this.drawTutorialHints(ctx);

    this.enemies.forEach((enemy) => {
      if (!enemy.dead || enemy.deathTimer > 0) enemy.draw(ctx);
    });

    if (this.boss && !this.boss.dead) {
      this.boss.draw(ctx);
    }

    this.projectiles.forEach((projectile) => projectile.draw(ctx));
    this.debris.forEach((piece) => piece.draw(ctx));
    this.shards.forEach((shard) => shard.draw(ctx));
    this.effects.forEach((effect) => effect.draw(ctx));
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
    if (!this.player.dead) {
      this.player.draw(ctx);
    }
    if (this.testHarness.active && this.testHarness.showCollision) {
      this.drawCollisionBoxes(ctx);
    }
    this.playability.drawWorld(ctx, this);
    this.drawBloom(ctx);
    ctx.restore();

    const region = this.world.regionAt(this.player.x, this.player.y);
    const sawUsing = this.player.attackTimer > 0 || this.player.sawRideActive || this.sawAnchor.active;
    const sawBuzzing = this.revActive || (this.player.sawRideActive && this.input.isDown('attack'));
    this.hud.draw(ctx, this.player, this.objective, region.name, {
      shake: this.pauseMenu.shake,
      sawEmbedded: this.sawAnchor.embedded,
      sawUsing,
      sawBuzzing,
      flameMode: this.player.flameMode && this.abilities.flame
    });
    const objectiveTarget = this.getObjectiveTarget();
    this.minimap.draw(ctx, canvas.width - 180, 20, 160, 90, this.player, {
      objective: objectiveTarget,
      showLegend: this.checklist.active
    });
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Credits: ${this.player.credits}`, canvas.width - 180, 130);
    ctx.restore();
    if (this.playtestActive && this.state === 'playing') {
      const buttonWidth = 170;
      const buttonHeight = 28;
      const buttonX = 20;
      const buttonY = 176;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('STOP PLAYTEST', buttonX + buttonWidth / 2, buttonY + 19);
      ctx.restore();
      this.playtestButtonBounds = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };
    } else {
      this.playtestButtonBounds = null;
    }
    this.drawWaypoint(ctx, canvas.width, canvas.height, objectiveTarget);

    if (this.state === 'shop') {
      this.shopUI.draw(ctx, canvas.width, canvas.height, this.player);
    }

    if (this.state === 'pause') {
      this.pauseMenu.draw(ctx, canvas.width, canvas.height, this.objective);
    }

    if (this.menuFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.restore();
    }

    this.mobileControls.draw(ctx, this.state);
    this.consoleOverlay.draw(ctx, canvas.width, canvas.height);
    this.checklist.draw(ctx, this, canvas.width, canvas.height);
    this.testHarness.draw(ctx, this, canvas.width, canvas.height);
    this.goldenPath.draw(ctx, canvas.width, canvas.height, this);
    this.testDashboard.draw(ctx, canvas.width, canvas.height);
    if (this.victory) {
      this.drawVictory(ctx, canvas.width, canvas.height);
    }
    if (this.gameOverTimer > 0) {
      this.drawGameOver(ctx, canvas.width, canvas.height);
    }
  }

  drawVictory(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY', width / 2, height / 2 - 20);
    ctx.font = '16px Courier New';
    ctx.fillText('Mission complete: Earth reclaimed.', width / 2, height / 2 + 20);
    ctx.restore();
  }

  drawGameOver(ctx, width, height) {
    const alpha = Math.min(1, this.gameOverTimer / 1.1);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', width / 2, height / 2);
    ctx.restore();
  }

  drawBloom(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 4;
    this.enemies.forEach((enemy) => {
      if (!enemy.dead || enemy.deathTimer > 0) enemy.draw(ctx);
    });
    if (this.boss && !this.boss.dead) {
      this.boss.draw(ctx);
    }
    this.player.draw(ctx);
    ctx.restore();
  }

  drawBoxes(ctx) {
    if (!this.boxes.length) return;
    ctx.save();
    this.boxes.forEach((box) => {
      const rect = this.getBoxRect(box);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.beginPath();
      ctx.moveTo(rect.x + 6, rect.y + rect.h - 6);
      ctx.lineTo(rect.x + rect.w - 6, rect.y + 6);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawWorld(ctx) {
    const tileSize = this.world.tileSize;
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        const tile = this.world.getTile(x, y);
        if (tile === '#') {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#2b2b2b';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#1f1f1f';
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
        if (tile === '^') {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x * tileSize, (y + 1) * tileSize);
          ctx.lineTo((x + 1) * tileSize, (y + 1) * tileSize);
          ctx.lineTo((x + 1) * tileSize, y * tileSize);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
        if (tile === '=') {
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 4, y * tileSize + tileSize / 2);
          ctx.lineTo(x * tileSize + tileSize - 4, y * tileSize + tileSize / 2);
          ctx.stroke();
        }
        if (tile === '!') {
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 6, y * tileSize + 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + tileSize - 6);
          ctx.moveTo(x * tileSize + tileSize - 6, y * tileSize + 6);
          ctx.lineTo(x * tileSize + 6, y * tileSize + tileSize - 6);
          ctx.stroke();
        }
        if (tile === 'D') {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + tileSize / 2, y * tileSize + 6);
          ctx.lineTo(x * tileSize + tileSize / 2, y * tileSize + tileSize - 6);
          ctx.stroke();
        }
        if (OBSTACLES[tile]) {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 6, y * tileSize + tileSize - 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + 6);
          ctx.stroke();
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = '10px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText(tile, x * tileSize + tileSize / 2, y * tileSize + tileSize / 2 + 4);
          ctx.restore();
        }
        if (tile === 'T') {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize + 6, y * tileSize + 6, tileSize - 12, tileSize - 12);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 10, y * tileSize + tileSize / 2);
          ctx.lineTo(x * tileSize + tileSize - 10, y * tileSize + tileSize / 2);
          ctx.stroke();
        }
        if (tile === 'O') {
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (tile === 'H') {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + tileSize / 2, y * tileSize + 8);
          ctx.lineTo(x * tileSize + tileSize / 2, y * tileSize + tileSize - 8);
          ctx.moveTo(x * tileSize + 8, y * tileSize + tileSize / 2);
          ctx.lineTo(x * tileSize + tileSize - 8, y * tileSize + tileSize / 2);
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

    this.world.objectives.forEach((objective) => {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(objective.x, objective.y - 12, 12, 0, Math.PI * 2);
      ctx.stroke();
      this.drawLabel(ctx, objective.x, objective.y - 30, 'OBJECTIVE', objective, 160);
    });

    const abilityLabels = {
      anchor: 'TOOLS: CHAINSAW THROW',
      flame: 'TOOLS: FLAME-SAW',
      magboots: 'TOOLS: MAG BOOTS',
      resonance: 'TOOLS: RESONANCE CORE'
    };
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
      this.drawLabel(ctx, pickup.x, pickup.y - 30, abilityLabels[pickup.ability] || 'TOOLS: UPGRADE', pickup);
    });

    this.world.healthUpgrades.forEach((upgrade) => {
      if (upgrade.collected) return;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.rect(upgrade.x - 8, upgrade.y - 20, 16, 16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(upgrade.x, upgrade.y - 18);
      ctx.lineTo(upgrade.x, upgrade.y - 6);
      ctx.moveTo(upgrade.x - 6, upgrade.y - 12);
      ctx.lineTo(upgrade.x + 6, upgrade.y - 12);
      ctx.stroke();
      this.drawLabel(ctx, upgrade.x, upgrade.y - 30, 'VITALITY CORE', upgrade);
    });

    this.world.anchors.forEach((anchor) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(anchor.x - 6, anchor.y - 6, 12, 12);
      this.drawLabel(ctx, anchor.x, anchor.y - 16, 'ANCHOR SOCKET', anchor);
    });

    if (this.world.bossGate) {
      this.drawLabel(ctx, this.world.bossGate.x, this.world.bossGate.y - 24, 'RIFT SEAL', this.world.bossGate, 120);
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
    ctx.fillText('Double-tap Attack to dash attack, hold Attack to execute', trainer.x, trainer.y - 24);
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
    if (this.world.objectives.length > 0) {
      return this.world.objectives[0];
    }
    const order = ['anchor', 'flame', 'magboots', 'resonance'];
    for (let i = 0; i < order.length; i += 1) {
      const ability = order[i];
      if (!this.abilities[ability]) {
        const target = this.world.abilityPickups.find((pickup) => pickup.ability === ability && !pickup.collected);
        return target || null;
      }
    }
    if (this.boss && !this.boss.dead) return this.world.bossGate || this.boss;
    return null;
  }

  canRunGolden() {
    return (
      this.testResults.validity === 'pass' &&
      this.testResults.coverage === 'pass' &&
      this.testResults.encounter === 'pass'
    );
  }

  runValidator(staged = false) {
    const targets = this.getObjectiveTargetsByAbility();
    if (staged) {
      const report = this.feasibilityValidator.runStaged(targets);
      this.consoleOverlay.setReport(report.status, report.summary, 'STAGED FEASIBILITY');
      console.log('Staged Validator Summary:', report.summary);
      console.log('Staged Validator Detail:', report.detail);
      return;
    }
    const target = this.getObjectiveTarget();
    const stageTargets = {};
    if (target) {
      stageTargets['current objective'] = {
        x: target.x,
        y: target.y,
        tx: Math.floor(target.x / this.world.tileSize),
        ty: Math.floor(target.y / this.world.tileSize)
      };
    }
    const report = this.feasibilityValidator.runSingleStage(this.abilities, stageTargets, 'Current Stage');
    this.consoleOverlay.setReport(report.status, report.lines, 'FEASIBILITY');
    console.log('Feasibility Report:', report);
  }

  runWorldValidityTest(applyFixes = false) {
    const report = this.worldValidityTest.run(this.spawnPoint, this.abilities, this.enemies);
    this.testResults.validity = report.status;
    this.testDashboard.setResults({ validity: report.status });
    this.testDashboard.setDetails('validity', report.lines);
    this.consoleOverlay.setReport(report.status, report.lines, 'WORLD VALIDITY');
    if (applyFixes && report.fixes?.spawnOverride) {
      const repairData = this.autoRepair.buildRepairData({ spawnOverride: report.fixes.spawnOverride });
      this.autoRepair.writeRepairs(repairData).then((result) => {
        const message = result.ok ? 'Repairs saved. Reload to apply.' : result.message;
        this.testDashboard.setNotice(message);
      });
    } else if (applyFixes) {
      this.testDashboard.setNotice('No repairs generated for World Validity.');
    }
    console.log('World Validity Report:', report);
  }

  runRoomCoverageTest() {
    const abilities = {
      anchor: true,
      flame: true,
      magboots: true,
      resonance: true
    };
    const stagedTargets = this.getObjectiveTargetsByAbility();
    const report = this.roomCoverageTest.run(abilities, stagedTargets);
    this.testResults.coverage = report.status;
    this.testDashboard.setResults({ coverage: report.status });
    this.testDashboard.setDetails('coverage', report.lines);
    this.consoleOverlay.setReport(report.status, report.lines, 'ROOM COVERAGE');
    console.log('Room Coverage Report:', report);
  }

  runEncounterAuditTest() {
    const abilities = {
      anchor: true,
      flame: true,
      magboots: true,
      resonance: true
    };
    const report = this.encounterAuditTest.run(this, abilities);
    this.testResults.encounter = report.status;
    this.testDashboard.setResults({ encounter: report.status });
    this.testDashboard.setDetails('encounter', report.lines);
    this.consoleOverlay.setReport(report.status, report.lines, 'ENCOUNTER AUDIT');
    console.log('Encounter Audit Report:', report);
  }

  runGoldenPathTest() {
    if (this.goldenPath.status === 'running') return;
    this.resetRun();
    this.state = 'playing';
    this.simulationActive = true;
    const report = this.goldenPathTest.start(this);
    this.testResults.golden = report.status;
    this.testDashboard.setResults({ golden: report.status });
    this.testDashboard.setDetails('golden', report.lines);
    if (report.status === 'fail') {
      this.simulationActive = false;
    }
  }

  runAllTests(applyFixes = false) {
    this.runWorldValidityTest(applyFixes);
    this.runRoomCoverageTest();
    this.runEncounterAuditTest();
    this.runGoldenPathTest();
  }

  loadObstacleTestRoom() {
    this.world.applyData(ObstacleTestMap);
    this.refreshWorldCaches();
    this.abilities = {
      anchor: true,
      flame: true,
      magboots: true,
      resonance: true
    };
    this.player.flameMode = false;
    this.sawAnchor.active = false;
    this.sawAnchor.embedded = false;
    this.sawAnchor.attachedBox = null;
    this.sawAnchor.attachedEnemy = null;
    this.sawAnchor.pullTimer = 0;
    this.sawAnchor.retractTimer = 0;
    this.sawAnchor.autoRetractTimer = 0;
    this.player.x = this.world.spawnPoint.x;
    this.player.y = this.world.spawnPoint.y;
    this.lastSave = { x: this.player.x, y: this.player.y };
    this.enemies = [];
    this.spawnBoxes();
    this.boss = null;
    this.objective = 'Test obstacle interactions.';
    this.audio.ui();
  }

  openTestDashboard() {
    this.testDashboard.open();
    this.testDashboard.clearNotice();
    this.audio.menu();
  }

  handleTestDashboard() {
    const action = this.testDashboard.handleInput(this.input);
    if (!action) return;
    if (action.type === 'close') {
      this.testDashboard.close();
      this.audio.menu();
      return;
    }
    if (action.type === 'toggleFixes') {
      this.testDashboard.setApplyFixes(!this.testDashboard.applyFixes);
      this.testDashboard.setNotice(this.testDashboard.applyFixes ? 'Apply Fixes enabled.' : 'Dry run enabled.');
      this.audio.ui();
      return;
    }
    if (action.type === 'run') {
      if (action.test === 'validity') this.runWorldValidityTest(this.testDashboard.applyFixes);
      if (action.test === 'coverage') this.runRoomCoverageTest();
      if (action.test === 'encounter') this.runEncounterAuditTest();
      if (action.test === 'golden') this.runGoldenPathTest();
      this.audio.ui();
      return;
    }
    if (action.type === 'runAll') {
      this.runAllTests(this.testDashboard.applyFixes);
      this.audio.ui();
    }
  }

  isPlaytestButtonHit(x, y) {
    const bounds = this.playtestButtonBounds;
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  handleClick(x, y) {
    if (this.playtestActive && this.state === 'playing' && this.isPlaytestButtonHit(x, y)) {
      this.returnToEditorFromPlaytest();
      return;
    }
    if (this.state === 'title' && this.title.isEditorHit(x, y) && !this.testDashboard.visible) {
      this.enterEditor();
      return;
    }
    if (this.testDashboard.visible) {
      const action = this.testDashboard.handleClick(x, y);
      if (!action) return;
      if (action.type === 'close') {
        this.testDashboard.close();
        this.audio.menu();
        return;
      }
      if (action.type === 'toggleFixes') {
        this.testDashboard.setApplyFixes(!this.testDashboard.applyFixes);
        this.testDashboard.setNotice(this.testDashboard.applyFixes ? 'Apply Fixes enabled.' : 'Dry run enabled.');
        this.audio.ui();
        return;
      }
      if (action.type === 'run') {
        if (action.test === 'validity') this.runWorldValidityTest(this.testDashboard.applyFixes);
        if (action.test === 'coverage') this.runRoomCoverageTest();
        if (action.test === 'encounter') this.runEncounterAuditTest();
        if (action.test === 'golden') this.runGoldenPathTest();
        this.audio.ui();
        return;
      }
      if (action.type === 'runAll') {
        this.runAllTests(this.testDashboard.applyFixes);
        this.audio.ui();
      }
    }
  }

  handlePointerDown(payload) {
    if (this.state === 'editor') {
      this.editor.handlePointerDown(payload);
      return;
    }
    if (this.playtestActive && this.state === 'playing' && this.isPlaytestButtonHit(payload.x, payload.y)) {
      this.returnToEditorFromPlaytest();
      return;
    }
    if (this.state === 'title' && this.title.isEndlessHit(payload.x, payload.y)) {
      this.startEndlessMode();
      this.audio.ui();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      return;
    }
    if (this.state === 'title' && this.title.isEditorHit(payload.x, payload.y) && !this.testDashboard.visible) {
      this.enterEditor();
      return;
    }
    if (this.state === 'title' && !this.testDashboard.visible) {
      this.state = 'dialog';
      this.audio.ui();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      return;
    }
    this.mobileControls.handlePointerDown(payload, this.state);
  }

  handlePointerMove(payload) {
    if (this.state === 'editor') {
      this.editor.handlePointerMove(payload);
      return;
    }
    this.mobileControls.handlePointerMove(payload);
  }

  handlePointerUp(payload) {
    if (this.state === 'editor') {
      this.editor.handlePointerUp(payload);
      return;
    }
    this.mobileControls.handlePointerUp(payload, this.state);
  }

  handleWheel(payload) {
    if (this.state !== 'editor') return;
    this.editor.handleWheel(payload);
  }

  handleGestureStart(payload) {
    if (this.state !== 'editor') return;
    this.editor.handleGestureStart(payload);
  }

  handleGestureMove(payload) {
    if (this.state !== 'editor') return;
    this.editor.handleGestureMove(payload);
  }

  handleGestureEnd() {
    if (this.state !== 'editor') return;
    this.editor.handleGestureEnd();
  }

}
