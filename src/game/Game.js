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
import HealthDrop from '../entities/HealthDrop.js';
import PracticeDrone from '../entities/PracticeDrone.js';
import Effect from '../entities/Effect.js';
import Title from '../ui/Title.js';
import Dialog from '../ui/Dialog.js';
import SystemPrompt from '../ui/SystemPrompt.js';
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
    'Wall-jump as often as you need.'
  ],
  resonance: [
    'Tool acquired: Resonance Core.',
    'Hold Attack to rev and shatter brittle walls or rift seals.'
  ],
  ignitir: [
    'Weapon acquired: Ignitir.',
    'Charges for 10 seconds while selected.',
    'Tap Attack to unleash the blast.'
  ],
  flamethrower: [
    'Weapon acquired: Flamethrower.',
    'Hold Attack to pour liquid fire.',
    'Short-range stream scorches anything in front of you.'
  ],
  map: [
    'Map cache acquired.',
    'Nearby rooms are now revealed.'
  ]
};

const ABILITY_PICKUP_LABELS = {
  anchor: 'Chainsaw Throw',
  flame: 'Flame-Saw',
  magboots: 'Mag Boots',
  resonance: 'Resonance Core',
  ignitir: 'Ignitir',
  flamethrower: 'Flamethrower'
};

const UPGRADE_LIST = [
  { id: 'tooth-razor', name: 'Tooth Profile: Razor Edge', slot: 'tooth', cost: 15, modifiers: { revEfficiency: 0.2 } },
  { id: 'tooth-serrated', name: 'Tooth Profile: Serrated Bite', slot: 'tooth', cost: 20, modifiers: { revEfficiency: 0.3 } },
  { id: 'drive-torque', name: 'Drivetrain: Torque Lube', slot: 'drivetrain', cost: 25, modifiers: { speed: 20 } },
  { id: 'drive-pulse', name: 'Drivetrain: Pulse Drive', slot: 'drivetrain', cost: 30, modifiers: { dashCooldown: -0.1 } },
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
    this.snapCameraToPlayer();
    this.title = new Title();
    this.dialog = new Dialog(INTRO_LINES);
    this.hud = new HUD();
    this.pauseMenu = new Pause();
    this.shopUI = new Shop(UPGRADE_LIST);
    this.state = 'loading';
    this.victory = false;
    this.systemPrompts = [];
    this.modalPrompt = null;
    this.promptReturnState = 'playing';
    this.enemies = [];
    this.projectiles = [];
    this.debris = [];
    this.shards = [];
    this.lootDrops = [];
    this.healthDrops = [];
    this.effects = [];
    this.clock = 0;
    this.worldTime = 0;
    this.abilities = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false,
      ignitir: false,
      flamethrower: false
    };
    this.weaponSlots = [
      { id: 'ignitir', label: 'Ignitir', key: '1', ability: 'ignitir' },
      { id: 'chainsaw', label: 'Chainsaw Rig', key: '2', ability: null },
      { id: 'flamethrower', label: 'Flamethrower', key: '3', ability: 'flamethrower' },
      { id: null, label: 'Empty', key: '4', ability: null }
    ];
    this.activeWeaponIndex = 1;
    this.ignitirCharge = 0;
    this.ignitirReady = false;
    this.ignitirFlashTimer = 0;
    this.ignitirSequence = null;
    this.flamethrowerEmitTimer = 0;
    this.flamethrowerSoundTimer = 0;
    this.flamethrowerDamageCooldowns = new Map();
    this.flamethrowerImpactHeat = new Map();
    this.flamethrowerAim = null;
    this.lowHealthAlarmTimer = 0;
    this.objective = 'Reach the Hub Pylon.';
    this.lastSave = { x: this.player.x, y: this.player.y };
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.activeRoomIndex = null;
    this.roomEnemySpawns = new Map();
    this.roomBossSpawns = new Map();
    this.roomVisited = new Set();
    this.roomExitTimes = new Map();
    this.roomRespawnTimers = new Map();
    this.cameraBounds = null;
    this.slowTimer = 0;
    this.doorTransition = null;
    this.doorCooldown = 0;
    this.boss = null;
    this.bossActive = false;
    this.bossInteractions = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false,
      ignitir: false,
      flamethrower: false
    };
    this.sawAnchor = {
      active: false,
      x: 0,
      y: 0,
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
    this.lastAttackFromGamepad = false;
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
    this.minimapSelected = false;
    this.minimapBounds = null;
    this.minimapBackBounds = null;
    this.minimapExitBounds = null;
    this.minimapExitBounds = null;
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
    this.damageFlashTimer = 0;
    this.revCharge = 0;
    this.revActive = false;
    this.simulationActive = false;
    this.deathTimer = 0;
    this.gameOverTimer = 0;
    this.spawnPauseTimer = 0;
    this.pickupPauseTimer = 0;
    this.editor = new Editor(this);
    this.editorReturnState = 'title';
    this.playtestActive = false;
    this.playtestButtonBounds = null;
    this.playtestPauseLock = 0;
    this.elevatorPlatforms = [];
    this.elevatorGraph = null;
    this.isMobile = false;
    this.deviceIsMobile = false;
    this.inputMode = 'keyboard';
    this.inputModeInitialized = false;
    this.effectiveInputMode = 'keyboard';
    this.gamepadConnected = false;
    this.viewport = { width: window.innerWidth, height: window.innerHeight, scale: 1 };
    this.mobileControls = new MobileControls();
    this.boxes = [];
    this.boxSize = 26;
    this.loading = true;

    this.init();
  }

  setViewport({ width, height, scale, isMobile }) {
    this.viewport = { width, height, scale };
    this.deviceIsMobile = Boolean(isMobile);
    if (!this.inputModeInitialized) {
      this.inputMode = this.deviceIsMobile ? 'mobile' : 'keyboard';
      this.inputModeInitialized = true;
    }
    this.updateControlScheme();
    this.mobileControls.setViewport({
      width: this.canvas.width,
      height: this.canvas.height,
      isMobile: this.isMobile
    });
  }

  updateControlScheme() {
    if (this.gamepadConnected) {
      this.effectiveInputMode = 'gamepad';
    } else if (this.inputMode === 'mobile' || this.inputMode === 'gamepad' || this.inputMode === 'keyboard') {
      this.effectiveInputMode = this.inputMode;
    } else {
      this.effectiveInputMode = this.deviceIsMobile ? 'mobile' : 'keyboard';
    }
    this.isMobile = this.effectiveInputMode === 'mobile';
    this.mobileControls.setEnabled(this.isMobile);
  }

  setInputMode(mode) {
    if (!['mobile', 'gamepad', 'keyboard'].includes(mode)) return;
    this.inputMode = mode;
    this.updateControlScheme();
  }

  async init() {
    try {
      await this.world.load();
      await this.autoRepair.load();
      this.autoRepair.applyPersistentPatches();
      await this.goldenPath.load();
      this.storyData = this.world.data;
      this.endlessData = await this.loadWorldData('./src/content/endless.json');
      this.syncSpawnPoint();
      this.player.x = this.spawnPoint.x;
      this.player.y = this.spawnPoint.y;
      this.snapCameraToPlayer();
      this.lastSave = { x: this.spawnPoint.x, y: this.spawnPoint.y };
      this.resetWorldSystems();
      this.spawnEnemies();
      this.spawnBoxes();
      this.autoRepair.applySpawnOverride(this);
    } catch (error) {
      console.error('Failed to initialize game.', error);
      this.consoleOverlay.setReport(
        'warn',
        ['Initialization failed. Falling back to a safe title screen.'],
        'BOOT'
      );
    } finally {
      this.loading = false;
      if (this.state === 'loading') {
        this.state = 'title';
      }
    }
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
    this.initElevators();
  }

  runPlayabilityCheck() {
    if (this.playtestActive || this.simulationActive) return;
    this.playability.runOnce(this);
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
    this.activeRoomIndex = null;
    this.rebuildRoomEnemySpawns();
    this.roomVisited.clear();
    this.roomExitTimes.clear();
    this.roomRespawnTimers.clear();
    this.cameraBounds = null;
  }

  rebuildRoomEnemySpawns() {
    this.roomEnemySpawns.clear();
    this.roomBossSpawns.clear();
    if (!this.world.enemies) return;
    const bossTypes = new Set([
      'finalboss',
      'sunderbehemoth',
      'riftram',
      'broodtitan',
      'nullaegis',
      'hexmatron',
      'gravewarden',
      'obsidiancrown',
      'cataclysmcolossus'
    ]);
    this.world.enemies.forEach((spawn) => {
      if (!spawn) return;
      const roomIndex = this.world.roomAtTile(spawn.x, spawn.y);
      if (roomIndex === null || roomIndex === undefined) return;
      if (bossTypes.has(spawn.type)) {
        const list = this.roomBossSpawns.get(roomIndex) || [];
        list.push({ ...spawn });
        this.roomBossSpawns.set(roomIndex, list);
      } else {
        const list = this.roomEnemySpawns.get(roomIndex) || [];
        list.push({ ...spawn });
        this.roomEnemySpawns.set(roomIndex, list);
      }
    });
  }

  buildElevatorGraph() {
    const pathSet = new Set();
    (this.world.elevatorPaths || []).forEach((path) => pathSet.add(`${path.x},${path.y}`));
    (this.world.elevators || []).forEach((platform) => pathSet.add(`${platform.x},${platform.y}`));
    const neighborsMap = new Map();
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    pathSet.forEach((key) => {
      const [x, y] = key.split(',').map((value) => Number(value));
      const neighbors = directions
        .map((dir) => ({ x: x + dir.dx, y: y + dir.dy }))
        .filter((pos) => pathSet.has(`${pos.x},${pos.y}`));
      neighborsMap.set(key, neighbors);
    });
    return { pathSet, neighborsMap };
  }

  buildElevatorGroups() {
    const tiles = this.world.elevators || [];
    const tileSet = new Set(tiles.map((tile) => `${tile.x},${tile.y}`));
    const visited = new Set();
    const groups = [];
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    tiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      if (visited.has(key)) return;
      const group = [];
      const queue = [tile];
      visited.add(key);
      while (queue.length) {
        const current = queue.shift();
        group.push({ x: current.x, y: current.y });
        directions.forEach((dir) => {
          const nx = current.x + dir.dx;
          const ny = current.y + dir.dy;
          const nKey = `${nx},${ny}`;
          if (!tileSet.has(nKey) || visited.has(nKey)) return;
          visited.add(nKey);
          queue.push({ x: nx, y: ny });
        });
      }
      groups.push(group);
    });
    return groups;
  }

  getElevatorGroupPositions(platform) {
    return platform.tiles.map((tile) => ({
      x: platform.tileX + tile.dx,
      y: platform.tileY + tile.dy
    }));
  }

  getElevatorGroupNeighbors(platform) {
    if (!this.elevatorGraph) return [];
    const positions = this.getElevatorGroupPositions(platform);
    const groupSet = new Set(positions.map((pos) => `${pos.x},${pos.y}`));
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    const candidates = new Map();
    positions.forEach((pos) => {
      directions.forEach((dir) => {
        const nx = pos.x + dir.dx;
        const ny = pos.y + dir.dy;
        const key = `${nx},${ny}`;
        if (!this.elevatorGraph.pathSet.has(key)) return;
        if (groupSet.has(key)) return;
        const dirKey = `${dir.dx},${dir.dy}`;
        if (candidates.has(dirKey)) return;
        candidates.set(dirKey, {
          x: platform.tileX + dir.dx,
          y: platform.tileY + dir.dy,
          dx: dir.dx,
          dy: dir.dy
        });
      });
    });
    return Array.from(candidates.values());
  }

  initElevators() {
    this.elevatorGraph = this.buildElevatorGraph();
    const { tileSize } = this.world;
    const pathTileSet = this.world.elevatorPathSet
      || new Set((this.world.elevatorPaths || []).map((path) => `${path.x},${path.y}`));
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    const groups = this.buildElevatorGroups();
    this.elevatorPlatforms = groups.map((group, index) => {
      const sortedGroup = [...group].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const anchor = sortedGroup.find((tile) => directions.some((dir) => pathTileSet.has(`${tile.x + dir.dx},${tile.y + dir.dy}`)))
        || sortedGroup[0];
      const tiles = group.map((tile) => ({
        dx: tile.x - anchor.x,
        dy: tile.y - anchor.y
      }));
      const platform = {
        id: `elevator-${index}`,
        x: (anchor.x + 0.5) * tileSize,
        y: (anchor.y + 0.5) * tileSize,
        tileX: anchor.x,
        tileY: anchor.y,
        prevTile: null,
        nextTile: null,
        dir: { dx: 0, dy: 0 },
        speed: tileSize * 0.9,
        tiles
      };
      const neighbors = this.getElevatorGroupNeighbors(platform);
      const nextTile = neighbors[0] || null;
      platform.nextTile = nextTile;
      platform.dir = nextTile ? { dx: nextTile.x - platform.tileX, dy: nextTile.y - platform.tileY } : { dx: 0, dy: 0 };
      return platform;
    });
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
      enemies: this.world.enemies,
      elevatorPaths: this.world.elevatorPaths,
      elevators: this.world.elevators
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
      enemies: data.enemies || [],
      elevatorPaths: data.elevatorPaths || [],
      elevators: data.elevators || []
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
      this.state = 'playing';
      this.playtestActive = true;
      this.playtestPauseLock = 0.35;
      document.body.classList.remove('editor-active');
      this.runGoldenPathSimulation({
        restoreState: 'playtest',
        playtest: true,
        startWithEverything: this.editor.startWithEverything
      });
      this.startSpawnPause();
      return;
    }
    this.playtestActive = false;
    if (this.editorReturnState === 'playing' || this.editorReturnState === 'pause') {
      this.state = 'pause';
      this.minimapSelected = false;
    } else {
      this.state = 'title';
    }
    document.body.classList.remove('editor-active');
  }

  returnToEditorFromPlaytest() {
    if (!this.playtestActive) return;
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    const roomIndex = this.world.roomAtTile(tileX, tileY);
    const roomBounds = roomIndex !== null ? this.world.getRoomBounds(roomIndex) : null;
    if (roomBounds) {
      const focusX = (roomBounds.x + roomBounds.w / 2) * tileSize;
      const focusY = (roomBounds.y + roomBounds.h / 2) * tileSize;
      this.editor.setFocusOverride({ x: focusX, y: focusY });
    } else {
      this.editor.setFocusOverride({ x: this.player.x, y: this.player.y });
    }
    this.state = 'editor';
    this.editor.activate();
    this.playtestActive = false;
    document.body.classList.add('editor-active');
  }

  resetRun({ playtest = false, startWithEverything = true } = {}) {
    this.world.reset();
    this.player = new Player(this.spawnPoint.x, this.spawnPoint.y);
    const startLoaded = this.gameMode === 'endless' || (playtest && startWithEverything);
    if (startLoaded) {
      this.player.equippedUpgrades = [...UPGRADE_LIST];
      this.player.upgradeSlots = UPGRADE_LIST.length;
      this.player.maxHealth = 12;
      this.player.health = 12;
    }
    this.player.applyUpgrades(this.player.equippedUpgrades);
    this.snapCameraToPlayer();
    this.abilities = startLoaded
      ? {
        anchor: true,
        flame: true,
        magboots: true,
        resonance: true,
        ignitir: true,
        flamethrower: true
      }
      : {
        anchor: false,
        flame: false,
        magboots: false,
        resonance: false,
        ignitir: false,
        flamethrower: false
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
    this.healthDrops = [];
    this.effects = [];
    this.spawnEnemies();
    this.bossInteractions = {
      anchor: false,
      flame: false,
      magboots: false,
      resonance: false,
      ignitir: false,
      flamethrower: false
    };
    this.sawAnchor = {
      active: false,
      x: 0,
      y: 0,
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
    this.lastAttackFromGamepad = false;
    this.prevHealth = this.player.health;
    this.damageFlashTimer = 0;
    this.ignitirFlashTimer = 0;
    this.revCharge = 0;
    this.deathTimer = 0;
    this.gameOverTimer = 0;
    this.spawnPauseTimer = 0;
    this.ignitirCharge = 0;
    this.ignitirReady = false;
    this.lowHealthAlarmTimer = 0;
    this.ensureActiveWeaponAvailable();
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
    this.runPlayabilityCheck();
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
      this.bossActive = false;
      const tileSize = this.world.tileSize;
      const tileX = Math.floor(this.player.x / tileSize);
      const tileY = Math.floor(this.player.y / tileSize);
      const roomIndex = this.world.roomAtTile(tileX, tileY);
      if (roomIndex !== null && roomIndex !== undefined) {
        this.activeRoomIndex = roomIndex;
        this.handleRoomEntry(roomIndex);
      }
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
    if (this.state === 'loading') {
      this.title.update(dt);
      return;
    }
    this.input.updateGamepad();
    this.gamepadConnected = this.input.isGamepadConnected();
    this.updateControlScheme();
    if (this.state === 'editor') {
      this.input.clearVirtual();
    } else {
      const activeWeaponId = this.getActiveWeapon()?.id;
      this.mobileControls.setFlameToggleEnabled(activeWeaponId === 'chainsaw');
      const mobileActions = this.mobileControls.getActions(this.state, this.player?.facing ?? 1);
      const combinedActions = this.input.combineActions(mobileActions, this.input.getGamepadActions());
      this.input.setVirtual(combinedActions);
    }
    this.clock += dt;
    this.worldTime += dt;
    this.menuFlashTimer = Math.max(0, this.menuFlashTimer - dt);
    this.updateSystemPrompts(dt);
    this.playtestPauseLock = Math.max(0, this.playtestPauseLock - dt);

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

    if (
      this.playtestActive
      && this.state === 'playing'
      && this.input.wasPressed('pause')
      && this.playtestPauseLock <= 0
      && !this.isMobile
    ) {
      this.returnToEditorFromPlaytest();
      this.input.flush();
      return;
    }

    if (this.input.wasPressed('pause') && this.state === 'playing') {
      this.state = 'pause';
      this.minimapSelected = true;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
    } else if (this.input.wasPressed('pause') && this.state === 'pause') {
      this.minimapSelected = !this.minimapSelected;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
    }
    if (this.input.wasPressed('cancel') && ['dialog', 'shop', 'pause'].includes(this.state)) {
      this.state = 'playing';
      this.minimapSelected = false;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      this.input.flush();
      return;
    }

    if (this.state !== 'playing') {
      this.setRevAudio(false);
    }

    if (this.state === 'prompt') {
      if (this.input.wasPressed('interact') || this.input.wasPressed('cancel')) {
        if (this.modalPrompt) {
          this.modalPrompt.dismiss();
        }
        this.state = this.promptReturnState || 'playing';
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      this.input.flush();
      return;
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
      if (this.title.screen === 'intro') {
        if (this.input.wasPressed('interact') || (this.gamepadConnected && this.input.wasPressed('pause'))) {
          this.title.setScreen('main');
          this.audio.ui();
          this.recordFeedback('menu navigate', 'audio');
          this.recordFeedback('menu navigate', 'visual');
        }
        this.input.flush();
        return;
      }
      if (this.input.wasPressed('up')) {
        this.title.moveSelection(-1);
        this.audio.menu();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      if (this.input.wasPressed('down')) {
        this.title.moveSelection(1);
        this.audio.menu();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
      }
      if (this.input.wasPressed('interact')) {
        const action = this.title.getSelectedAction();
        if (this.title.screen === 'controls') {
          if (action === 'back') {
            this.title.setScreen('main');
          } else {
            this.setInputMode(action);
          }
          this.title.setControlsSelectionByMode(this.inputMode);
        } else if (action === 'options') {
          this.title.setControlsSelectionByMode(this.inputMode);
          this.title.setScreen('controls');
        } else if (action === 'endless') {
          this.startEndlessMode();
        } else if (action === 'editor') {
          this.enterEditor();
        } else {
          if (this.gameMode !== 'story' && this.storyData) {
            this.gameMode = 'story';
            this.applyWorldData(this.storyData);
            this.resetRun();
          } else {
            this.gameMode = 'story';
          }
          this.state = 'dialog';
        }
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
      this.input.flush();
      return;
    }

    if (this.state === 'dialog') {
      if (this.input.wasPressed('interact')) {
        const finished = this.dialog.next();
        if (finished) {
          this.state = 'playing';
          this.simulationActive = false;
          this.runPlayabilityCheck();
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
      if (!this.minimapSelected) {
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
      }
      this.input.flush();
      return;
    }

    this.testHarness.update(this.input, this);
    const debugSlow = this.testHarness.active && this.testHarness.slowMotion;
    const timeScale = this.slowTimer > 0 ? 0.25 : debugSlow ? 0.5 : 1;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt * timeScale);
    this.ignitirFlashTimer = Math.max(0, this.ignitirFlashTimer - dt * timeScale);
    this.doorCooldown = Math.max(0, this.doorCooldown - dt * timeScale);
    if (this.spawnPauseTimer > 0) {
      this.spawnPauseTimer = Math.max(0, this.spawnPauseTimer - dt);
      this.updateEffects(dt);
      this.setRevAudio(false);
      this.input.flush();
      return;
    }
    if (this.pickupPauseTimer > 0) {
      this.pickupPauseTimer = Math.max(0, this.pickupPauseTimer - dt);
      this.updateEffects(dt);
      this.setRevAudio(false);
      this.input.flush();
      return;
    }
    if (this.doorTransition) {
      this.updateDoorTransition(dt * timeScale);
      this.updateEffects(dt * timeScale);
      this.updateRoomCameraBounds();
      this.camera.follow(this.player, dt, this.cameraBounds);
      this.minimap.update(this.player);
      this.input.flush();
      return;
    }
    this.updateSpawnCooldowns(dt * timeScale);
    this.updateEndlessMode(dt * timeScale);
    this.attackTapTimer = Math.max(0, this.attackTapTimer - dt * timeScale);
    this.updateWeaponSelection(this.input);
    this.ensureActiveWeaponAvailable();
    const usingIgnitir = this.getActiveWeapon()?.id === 'ignitir';
    const usingFlamethrower = this.getActiveWeapon()?.id === 'flamethrower';
    this.updateIgnitirCharge(dt * timeScale);
    this.updateIgnitirSequence(dt * timeScale);
    if (this.input.wasPressed('attack')) {
      this.attackHoldTimer = 0;
      this.lastAttackFromGamepad = this.gamepadConnected && this.input.wasGamepadPressed('attack');
    }
    if (this.input.isDown('attack')) {
      this.attackHoldTimer += dt * timeScale;
    }
    if (!this.abilities.flame) {
      this.player.flameMode = false;
    } else if (this.input.wasPressed('flame')) {
      this.player.flameMode = !this.player.flameMode;
    }
    if (!usingIgnitir && this.input.wasPressed('throw')) {
      this.handleThrow();
    }

    if (this.ignitirSequence) {
      this.applyIgnitirPlayerImpulse();
    }
    const prevPlayer = { x: this.player.x, y: this.player.y };
    this.player.update(dt * timeScale, this.input, this.world, this.abilities);
    this.updateElevators(dt * timeScale, prevPlayer);
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    if (this.world.getTile(tileX, tileY) === 'D' && this.startDoorTransition(tileX, tileY, this.input)) {
      this.updateRoomCameraBounds();
      this.camera.follow(this.player, dt, this.cameraBounds);
      this.minimap.update(this.player);
      this.input.flush();
      return;
    }
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

    if (this.input.wasReleased('attack')) {
      const heldDuration = this.attackHoldTimer;
      this.attackHoldTimer = 0;
      if (usingIgnitir) {
        if (heldDuration > 0 && heldDuration <= this.attackHoldThreshold && this.ignitirReady) {
          this.fireIgnitir();
        } else if (heldDuration > 0 && heldDuration <= this.attackHoldThreshold && !this.ignitirReady) {
          this.audio.ignitirDud();
          this.recordFeedback('ignitir dud', 'audio');
          this.spawnIgnitirSpark();
        }
      } else if (usingFlamethrower) {
        // Flamethrower pours while held; no tap action on release.
      } else if (heldDuration > 0 && heldDuration <= this.attackHoldThreshold) {
        const doubleTap = this.attackTapTimer > 0;
        const allowAnchorShot = !this.gamepadConnected || !this.lastAttackFromGamepad;
        this.attackTapTimer = doubleTap ? 0 : this.attackTapWindow;
        if (this.sawAnchor.active) {
          this.startAnchorRetract(0.2);
        } else if (doubleTap) {
          if (!this.tryObstacleInteraction('attack')) {
            this.handleAttack();
          }
        } else if (this.abilities.anchor && allowAnchorShot) {
          this.handleAnchorShot();
        } else if (!this.tryObstacleInteraction('attack')) {
          this.handleAttack();
        }
      }
    } else if (!this.input.isDown('attack')) {
      this.attackHoldTimer = 0;
    }
    if (this.sawAnchor.embedded && this.input.wasPressed('jump')) {
      this.startAnchorRetract(0.2);
    }
    if (!usingIgnitir && !usingFlamethrower) {
      const revHeld = this.isRevHeld(this.input);
      const anchorRevActive = this.sawAnchor.active && this.sawAnchor.embedded && revHeld;
      if (revHeld || anchorRevActive) {
        this.revCharge = Math.min(1, this.revCharge + dt * timeScale * 2.2);
      } else {
        this.revCharge = Math.max(0, this.revCharge - dt * timeScale * 1.6);
      }
      if (revHeld && this.player.canRev() && !this.sawAnchor.active) {
        this.handleRev();
        this.tryObstacleInteraction('rev');
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
    } else {
      this.setRevAudio(false);
    }

    this.updateFlamethrower(dt * timeScale, usingFlamethrower);

    let interacted = false;
    if (this.input.wasPressed('interact')) {
      interacted = this.checkSavePoints();
      if (!interacted) {
        interacted = this.handleSwitchInteraction();
      }
    }

    this.updateEnemies(dt * timeScale);
    this.applyIgnitirEnemyPull(dt * timeScale);
    this.updateProjectiles(dt * timeScale);
    this.updateDebris(dt * timeScale);
    this.updateEffects(dt * timeScale);
    this.updateLootDrops(dt * timeScale);
    this.updateHealthDrops(dt * timeScale);
    this.checkPlayerDamage();
    this.updateLowHealthWarning(dt * timeScale);
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

    this.updateRoomCameraBounds();
    this.updateRoomRespawns(dt * timeScale);
    this.camera.follow(this.player, dt, this.cameraBounds);
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
    this.snapCameraToPlayer();
    this.player.credits = Math.max(0, this.player.credits - 10);
    this.player.loot = 0;
    this.player.oilLevel = 0;
    this.player.superCharge = 0;
    this.player.superReady = false;
    this.player.invulnTimer = 1;
    this.prevHealth = this.player.health;
    this.ignitirCharge = 0;
    this.ignitirReady = false;
    this.lowHealthAlarmTimer = 0;
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

  snapCameraToPlayer() {
    this.updateRoomCameraBounds();
    const desiredX = this.player.x - this.camera.width / 2;
    const desiredY = this.player.y - this.camera.height / 2;
    if (this.cameraBounds) {
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      this.camera.x = clamp(desiredX, this.cameraBounds.minX, this.cameraBounds.maxX);
      this.camera.y = clamp(desiredY, this.cameraBounds.minY, this.cameraBounds.maxY);
    } else {
      this.camera.x = desiredX;
      this.camera.y = desiredY;
    }
  }

  updateRoomCameraBounds() {
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    const currentTile = this.world.getTile(tileX, tileY);
    const roomIndex = this.world.roomAtTile(tileX, tileY);
    const previousRoom = this.activeRoomIndex;
    if (currentTile !== 'D' && roomIndex !== null) {
      this.activeRoomIndex = roomIndex;
    } else if (this.activeRoomIndex === null && roomIndex !== null) {
      this.activeRoomIndex = roomIndex;
    }

    if (previousRoom !== this.activeRoomIndex) {
      if (previousRoom !== null && previousRoom !== undefined) {
        this.roomExitTimes.set(previousRoom, this.clock);
        if (this.roomVisited.has(previousRoom) && this.hasMissingRoomEnemies(previousRoom)) {
          this.roomRespawnTimers.set(previousRoom, 4);
        }
      }
      if (this.activeRoomIndex !== null && this.activeRoomIndex !== undefined) {
        this.handleRoomEntry(this.activeRoomIndex);
      }
    }

    if (this.activeRoomIndex === null) {
      this.cameraBounds = null;
      return;
    }
    const room = this.world.getRoomBounds(this.activeRoomIndex);
    if (!room) {
      this.cameraBounds = null;
      return;
    }
    const doorPadding = tileSize * (this.isMobile ? 4 : 2);
    const worldRight = this.world.width * tileSize;
    const worldBottom = this.world.height * tileSize;
    const left = Math.max(0, room.minX * tileSize - doorPadding);
    const top = Math.max(0, room.minY * tileSize - doorPadding);
    const right = Math.min(worldRight, (room.maxX + 1) * tileSize + doorPadding);
    const bottom = Math.min(worldBottom, (room.maxY + 1) * tileSize + doorPadding);
    const roomWidth = right - left;
    const roomHeight = bottom - top;
    let minX = left;
    let maxX = right - this.camera.width;
    let minY = top;
    let maxY = bottom - this.camera.height;
    if (roomWidth <= this.camera.width) {
      const centerX = left + (roomWidth - this.camera.width) / 2;
      minX = centerX;
      maxX = centerX;
    }
    if (roomHeight <= this.camera.height) {
      const centerY = top + (roomHeight - this.camera.height) / 2;
      minY = centerY;
      maxY = centerY;
    }
    this.cameraBounds = { minX, maxX, minY, maxY };
  }

  hasMissingRoomEnemies(roomIndex) {
    const spawns = this.roomEnemySpawns.get(roomIndex) || [];
    if (!spawns.length) return false;
    const tileSize = this.world.tileSize;
    const activeKeys = new Set(this.enemies.filter((enemy) => !enemy.dead).map((enemy) => {
      const tx = Math.floor(enemy.x / tileSize);
      const ty = Math.floor(enemy.y / tileSize);
      return `${tx},${ty}`;
    }));
    return spawns.some((spawn) => !activeKeys.has(`${spawn.x},${spawn.y}`));
  }

  handleRoomEntry(roomIndex) {
    if (this.roomVisited.has(roomIndex)) {
      return;
    }
    this.roomVisited.add(roomIndex);
    this.respawnRoomEnemies(roomIndex);
    this.spawnRoomBosses(roomIndex);
  }

  updateRoomRespawns(dt) {
    if (!this.roomRespawnTimers.size) return;
    for (const [roomIndex, timer] of this.roomRespawnTimers.entries()) {
      if (this.activeRoomIndex === roomIndex) {
        continue;
      }
      const next = timer - dt;
      if (next > 0) {
        this.roomRespawnTimers.set(roomIndex, next);
        continue;
      }
      this.respawnRoomEnemies(roomIndex);
      this.roomRespawnTimers.delete(roomIndex);
    }
  }

  respawnRoomEnemies(roomIndex) {
    const spawns = this.roomEnemySpawns.get(roomIndex) || [];
    if (!spawns.length) return;
    const tileSize = this.world.tileSize;
    const activeKeys = new Set(this.enemies.filter((enemy) => !enemy.dead).map((enemy) => {
      const tx = Math.floor(enemy.x / tileSize);
      const ty = Math.floor(enemy.y / tileSize);
      return `${tx},${ty}`;
    }));
    spawns.forEach((spawn) => {
      const key = `${spawn.x},${spawn.y}`;
      if (activeKeys.has(key)) return;
      const worldX = (spawn.x + 0.5) * tileSize;
      const worldY = (spawn.y + 0.5) * tileSize;
      this.spawnEnemyByType(spawn.type, worldX, worldY);
    });
  }

  spawnRoomBosses(roomIndex) {
    const spawns = this.roomBossSpawns.get(roomIndex) || [];
    if (!spawns.length) return;
    const tileSize = this.world.tileSize;
    const existingKeys = new Set(this.enemies.map((enemy) => {
      const tx = Math.floor(enemy.x / tileSize);
      const ty = Math.floor(enemy.y / tileSize);
      return `${tx},${ty}`;
    }));
    spawns.forEach((spawn) => {
      const key = `${spawn.x},${spawn.y}`;
      if (spawn.type === 'finalboss') {
        if (this.boss) return;
        this.boss = new FinalBoss((spawn.x + 0.5) * tileSize, (spawn.y + 0.5) * tileSize);
        this.bossActive = false;
        return;
      }
      if (existingKeys.has(key)) return;
      const worldX = (spawn.x + 0.5) * tileSize;
      const worldY = (spawn.y + 0.5) * tileSize;
      this.spawnEnemyByType(spawn.type, worldX, worldY);
    });
  }

  findDoorExit(tileX, tileY, primaryDir) {
    const directions = [
      primaryDir,
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ].filter((dir, index, self) => dir && self.findIndex((d) => d.dx === dir.dx && d.dy === dir.dy) === index);
    const maxSteps = Math.max(this.world.width, this.world.height);
    for (const dir of directions) {
      let x = tileX;
      let y = tileY;
      for (let step = 0; step < maxSteps; step += 1) {
        x += dir.dx;
        y += dir.dy;
        if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) break;
        const tile = this.world.getTile(x, y);
        if (tile === 'D') continue;
        if (!this.world.isSolid(x, y, this.abilities)) {
          return { x, y };
        }
        break;
      }
    }
    return null;
  }

  startDoorTransition(tileX, tileY, input) {
    if (this.doorTransition || this.doorCooldown > 0) return false;
    const inputH = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const inputV = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    let primaryDir = { dx: 0, dy: 0 };
    if (Math.abs(this.player.vx) > Math.abs(this.player.vy) && Math.abs(this.player.vx) > 5) {
      primaryDir = { dx: Math.sign(this.player.vx), dy: 0 };
    } else if (Math.abs(this.player.vy) > 5) {
      primaryDir = { dx: 0, dy: Math.sign(this.player.vy) };
    } else if (inputH !== 0) {
      primaryDir = { dx: inputH, dy: 0 };
    } else if (inputV !== 0) {
      primaryDir = { dx: 0, dy: inputV };
    }
    if (primaryDir.dx === 0 && primaryDir.dy === 0) {
      primaryDir = null;
    }
    const target = this.findDoorExit(tileX, tileY, primaryDir);
    if (!target) return false;
    const tileSize = this.world.tileSize;
    const exitDir = {
      dx: Math.sign(target.x - tileX),
      dy: Math.sign(target.y - tileY)
    };
    const targetPos = { x: (target.x + 0.5) * tileSize, y: (target.y + 0.5) * tileSize };
    const distance = Math.hypot(targetPos.x - this.player.x, targetPos.y - this.player.y);
    const maxSpeed = Math.max(this.player.speed || MOVEMENT_MODEL.baseSpeed, MOVEMENT_MODEL.baseSpeed);
    const duration = Math.max(0.35, distance / maxSpeed);
    this.doorTransition = {
      from: { x: this.player.x, y: this.player.y },
      to: targetPos,
      progress: 0,
      duration,
      exitDir
    };
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.doorCooldown = 0.45;
    return true;
  }

  updateDoorTransition(dt) {
    if (!this.doorTransition) return;
    const transition = this.doorTransition;
    transition.progress = Math.min(transition.progress + dt, transition.duration);
    const t = transition.duration > 0 ? transition.progress / transition.duration : 1;
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    this.player.x = transition.from.x + (transition.to.x - transition.from.x) * eased;
    this.player.y = transition.from.y + (transition.to.y - transition.from.y) * eased;
    if (t >= 1) {
      if (transition.exitDir?.dy < 0) {
        this.player.vy = Math.min(this.player.vy, -this.player.jumpPower);
        this.player.onGround = false;
      }
      this.doorTransition = null;
    }
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
    const intensity = 0.3 + this.revCharge * 0.7;
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

  spawnEffect(type, x, y, options = null) {
    this.effects.push(new Effect(x, y, type, options));
  }

  isWeaponAvailable(slot) {
    if (!slot?.id) return false;
    if (!slot.ability) return true;
    return Boolean(this.abilities?.[slot.ability]);
  }

  getWeaponSlots() {
    return this.weaponSlots.map((slot) => ({
      ...slot,
      available: this.isWeaponAvailable(slot)
    }));
  }

  getActiveWeapon() {
    return this.weaponSlots[this.activeWeaponIndex] || null;
  }

  ensureActiveWeaponAvailable() {
    if (this.isWeaponAvailable(this.getActiveWeapon())) return;
    const index = this.weaponSlots.findIndex((slot) => this.isWeaponAvailable(slot));
    this.activeWeaponIndex = index >= 0 ? index : 0;
  }

  selectWeapon(index) {
    if (!this.weaponSlots[index]) return;
    if (!this.isWeaponAvailable(this.weaponSlots[index])) return;
    this.activeWeaponIndex = index;
  }

  updateWeaponSelection(input) {
    let nextIndex = null;
    if (input.wasPressedCode('Digit1')) nextIndex = 0;
    if (input.wasPressedCode('Digit2')) nextIndex = 1;
    if (input.wasPressedCode('Digit3')) nextIndex = 2;
    if (input.wasPressedCode('Digit4')) nextIndex = 3;
    if (input.wasGamepadPressed('dpadLeft')) nextIndex = this.activeWeaponIndex - 1;
    if (input.wasGamepadPressed('dpadRight')) nextIndex = this.activeWeaponIndex + 1;
    if (input.wasGamepadPressed('aimUp')) nextIndex = this.activeWeaponIndex - 1;
    if (input.wasGamepadPressed('aimDown')) nextIndex = this.activeWeaponIndex + 1;
    if (nextIndex !== null) {
      const total = this.weaponSlots.length;
      const clamped = ((nextIndex % total) + total) % total;
      this.selectWeapon(clamped);
    }
  }

  updateIgnitirCharge(dt) {
    if (!this.player || this.player.dead) return;
    if (!this.abilities.ignitir) {
      this.ignitirCharge = 0;
      this.ignitirReady = false;
      return;
    }
    if (this.ignitirSequence) {
      this.ignitirCharge = 0;
      this.ignitirReady = false;
      return;
    }
    const activeWeapon = this.getActiveWeapon();
    if (activeWeapon?.id !== 'ignitir') return;
    if (this.ignitirReady) return;
    this.ignitirCharge = Math.min(1, this.ignitirCharge + dt / 10);
    if (this.ignitirCharge >= 1) {
      this.ignitirReady = true;
      this.audio.ignitirReady();
      this.recordFeedback('ignitir ready', 'audio');
      this.recordFeedback('ignitir ready', 'visual');
    }
  }

  findIgnitirLandingTile(targetX, targetY, roomBounds) {
    const { minX, maxX, minY, maxY } = roomBounds;
    for (let radius = 0; radius <= 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const tileX = targetX + dx;
          const tileY = targetY + dy;
          if (tileX < minX || tileX > maxX || tileY < minY || tileY > maxY) continue;
          if (!this.world.isSolid(tileX, tileY)) {
            return { x: tileX, y: tileY };
          }
        }
      }
    }
    return { x: targetX, y: targetY };
  }

  spawnIgnitirFlames(roomBounds) {
    if (!roomBounds) return;
    const tileSize = this.world.tileSize;
    const width = roomBounds.maxX - roomBounds.minX + 1;
    const height = roomBounds.maxY - roomBounds.minY + 1;
    const count = Math.min(80, Math.floor((width * height) / 4));
    for (let i = 0; i < count; i += 1) {
      const tileX = roomBounds.minX + Math.floor(Math.random() * width);
      const tileY = roomBounds.minY + Math.floor(Math.random() * height);
      if (this.world.isSolid(tileX, tileY)) continue;
      this.spawnEffect('ignitir-flame', (tileX + 0.5) * tileSize, (tileY + 0.5) * tileSize);
    }
  }

  fireIgnitir() {
    if (this.ignitirSequence) return;
    const tileSize = this.world.tileSize;
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    const roomIndex = this.world.roomAtTile(tileX, tileY);
    const roomBounds = roomIndex !== null && roomIndex !== undefined ? this.world.getRoomBounds(roomIndex) : null;
    const aimVector = this.getAutoAimVector();
    const dirX = aimVector.x;
    const dirY = aimVector.y;
    const muzzleOffset = this.player.width * 0.9;
    const originX = this.player.x + dirX * muzzleOffset;
    const originY = this.player.y - 4 + dirY * muzzleOffset;
    const maxRange = tileSize * 12;
    const step = 8;
    let targetX = originX + dirX * maxRange;
    let targetY = originY + dirY * maxRange;
    let lastX = originX;
    let lastY = originY;
    for (let dist = 24; dist <= maxRange; dist += step) {
      const testX = originX + dirX * dist;
      const testY = originY + dirY * dist;
      const testTileX = Math.floor(testX / tileSize);
      const testTileY = Math.floor(testY / tileSize);
      if (this.world.isSolid(testTileX, testTileY, this.abilities)) {
        break;
      }
      lastX = testX;
      lastY = testY;
    }
    targetX = lastX;
    targetY = lastY;

    this.ignitirCharge = 0;
    this.ignitirReady = false;
    this.ignitirFlashTimer = 1.3;

    this.startIgnitirSequence({
      originX,
      originY,
      targetX,
      targetY,
      dirX,
      dirY,
      roomBounds
    });
  }

  startIgnitirSequence({ originX, originY, targetX, targetY, dirX, dirY, roomBounds }) {
    const beamLength = Math.max(40, Math.hypot(targetX - originX, targetY - originY));
    const targets = this.collectIgnitirTargets(roomBounds, targetX, targetY);
    this.ignitirSequence = {
      time: 0,
      duration: 8.6,
      originX,
      originY,
      targetX,
      targetY,
      dirX,
      dirY,
      beamLength,
      roomBounds,
      targets,
      implosionSpawned: false,
      explosionSpawned: false,
      dissolveStarted: false,
      residualShockwaveA: false,
      residualShockwaveB: false
    };

    this.spawnEffect('ignitir-target', targetX, targetY, { life: 1.1 });
    this.spawnEffect('ignitir-beam', originX, originY, {
      angle: Math.atan2(dirY, dirX),
      length: beamLength,
      life: 3.1,
      startWidth: 2,
      endWidth: 34,
      coreStart: 1,
      coreEnd: 12,
      follow: this.player,
      followOffsetX: dirX * (this.player.width * 0.9),
      followOffsetY: -4 + dirY * (this.player.width * 0.9),
      targetX,
      targetY
    });
    this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.9);
  }

  collectIgnitirTargets(roomBounds, targetX, targetY) {
    const maxDistance = this.world.tileSize * 5;
    const expandedBounds = roomBounds
      ? {
          minX: roomBounds.minX - 5,
          maxX: roomBounds.maxX + 5,
          minY: roomBounds.minY - 5,
          maxY: roomBounds.maxY + 5
        }
      : null;
    const targets = [];
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      if (expandedBounds) {
        if (!this.isInRoomBounds(enemy.x, enemy.y, expandedBounds)) return;
      } else if (Math.hypot(enemy.x - targetX, enemy.y - targetY) > maxDistance) {
        return;
      }
      targets.push(enemy);
    });
    if (this.boss && !this.boss.dead) {
      if (expandedBounds) {
        if (this.isInRoomBounds(this.boss.x, this.boss.y, expandedBounds)) {
          targets.push(this.boss);
        }
      } else if (this.isInRoomBounds(this.boss.x, this.boss.y, roomBounds)) {
        if (Math.hypot(this.boss.x - targetX, this.boss.y - targetY) <= maxDistance) {
          targets.push(this.boss);
        }
      }
    }
    targets.sort((a, b) => {
      const aDist = Math.hypot(a.x - targetX, a.y - targetY);
      const bDist = Math.hypot(b.x - targetX, b.y - targetY);
      return aDist - bDist;
    });
    return targets.map((entity, index) => ({
      entity,
      explodeAt: 3.6 + index * 0.12 + Math.random() * 0.35,
      exploded: false
    }));
  }

  isInRoomBounds(x, y, roomBounds) {
    if (!roomBounds) return true;
    const tileSize = this.world.tileSize;
    const tx = Math.floor(x / tileSize);
    const ty = Math.floor(y / tileSize);
    return tx >= roomBounds.minX && tx <= roomBounds.maxX && ty >= roomBounds.minY && ty <= roomBounds.maxY;
  }

  updateIgnitirSequence(dt) {
    const sequence = this.ignitirSequence;
    if (!sequence) return;
    sequence.time += dt;
    const time = sequence.time;
    const implosionTime = 2.6;
    const explosionTime = 3.3;
    const residualTimeA = 5.1;
    const residualTimeB = 6.6;

    if (time < 1.2) {
      this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.8);
    }

    if (!sequence.implosionSpawned && time >= implosionTime) {
      this.spawnEffect('ignitir-implosion', sequence.targetX, sequence.targetY, { life: 1.3, radius: 110 });
      sequence.implosionSpawned = true;
    }

    if (!sequence.explosionSpawned && time >= explosionTime) {
      this.spawnEffect('ignitir-blast', sequence.targetX, sequence.targetY, { life: 1.7, radius: 280 });
      this.spawnEffect('ignitir-lens', sequence.targetX, sequence.targetY, { life: 1.1 });
      this.spawnEffect('ignitir-shockwave', sequence.targetX, sequence.targetY, {
        life: 1.3,
        startRadius: 80,
        endRadius: 380,
        lineWidth: 8,
        color: 'rgba(210, 240, 255, 0.85)',
        fillColor: 'rgba(170, 215, 255, 0.5)'
      });
      this.spawnEffect('ignitir-shockwave', sequence.targetX, sequence.targetY, {
        life: 1.6,
        startRadius: 120,
        endRadius: 460,
        lineWidth: 6,
        color: 'rgba(255, 255, 255, 0.9)',
        fillColor: 'rgba(210, 235, 255, 0.45)'
      });
      this.audio.ignitirBlast();
      this.recordFeedback('ignitir blast', 'audio');
      this.recordFeedback('ignitir blast', 'visual');
      this.shakeTimer = Math.max(this.shakeTimer, 1.1);
      this.shakeMagnitude = Math.max(this.shakeMagnitude, 30);
      this.applyIgnitirObstacleBurst(sequence.targetX, sequence.targetY);
      sequence.explosionSpawned = true;
    }

    if (!sequence.dissolveStarted && time >= explosionTime) {
      sequence.targets.forEach((target) => {
        const entity = target.entity;
        if (!entity || entity.dead) return;
        entity.ignitirDissolveTimer = 1.4;
        entity.ignitirDissolveDuration = 1.4;
      });
      sequence.dissolveStarted = true;
    }

    sequence.targets.forEach((target) => {
      if (target.exploded) return;
      if (time >= target.explodeAt) {
        this.explodeIgnitirTarget(target.entity);
        target.exploded = true;
      }
    });

    if (!sequence.residualShockwaveA && time >= residualTimeA) {
      this.spawnEffect('ignitir-shockwave', sequence.targetX, sequence.targetY, {
        life: 4,
        startRadius: 200,
        endRadius: 720,
        lineWidth: 4,
        color: 'rgba(255, 255, 255, 0.85)',
        fillColor: 'rgba(255, 255, 255, 0.3)'
      });
      sequence.residualShockwaveA = true;
    }

    if (!sequence.residualShockwaveB && time >= residualTimeB) {
      this.spawnEffect('ignitir-shockwave', sequence.targetX, sequence.targetY, {
        life: 3.2,
        startRadius: 260,
        endRadius: 820,
        lineWidth: 3,
        color: 'rgba(255, 255, 255, 0.7)',
        fillColor: 'rgba(255, 255, 255, 0.25)'
      });
      sequence.residualShockwaveB = true;
    }

    if (time >= sequence.duration) {
      this.ignitirSequence = null;
    }
  }

  updateFlamethrower(dt, usingFlamethrower) {
    const tileSize = this.world.tileSize;
    const maxHeat = 5;
    const heatGainRate = 1.8;
    const heatCoolRate = 0.8;
    const minBurnRadius = tileSize * 0.45;
    const maxBurnRadius = tileSize * 1.5;
    const minBurnHeight = tileSize * 0.7;
    const maxBurnHeight = tileSize * 5;
    const minBurnSize = tileSize * 0.5;
    const maxBurnSize = (tileSize * 3) / 1.2;

    for (const [entity, timer] of this.flamethrowerDamageCooldowns.entries()) {
      const next = timer - dt;
      if (next <= 0) {
        this.flamethrowerDamageCooldowns.delete(entity);
      } else {
        this.flamethrowerDamageCooldowns.set(entity, next);
      }
    }
    for (const [key, data] of this.flamethrowerImpactHeat.entries()) {
      const next = data.heat - dt * heatCoolRate;
      if (next <= 0) {
        this.flamethrowerImpactHeat.delete(key);
      } else {
        this.flamethrowerImpactHeat.set(key, { ...data, heat: next });
      }
    }

    const burnFields = Array.from(this.flamethrowerImpactHeat.values());
    const applyResidualBurn = (entity) => {
      if (!entity || entity.dead || !burnFields.length) return;
      if (this.flamethrowerDamageCooldowns.has(entity)) return;
      for (const field of burnFields) {
        const heatProgress = Math.min(1, field.heat / maxHeat);
        const radius = minBurnRadius + (maxBurnRadius - minBurnRadius) * heatProgress;
        if (Math.hypot(entity.x - field.x, entity.y - field.y) <= radius) {
          entity.damage?.(1);
          this.spawnEffect('flamethrower-impact', entity.x, entity.y, {
            life: 0.25,
            size: 12 + heatProgress * 12
          });
          this.spawnEffect('flamethrower-burn', entity.x, entity.y, {
            life: 0.6,
            height: minBurnHeight + (maxBurnHeight - minBurnHeight) * heatProgress * 0.6,
            size: minBurnSize + (maxBurnSize - minBurnSize) * heatProgress * 0.4,
            intensity: 0.7 + heatProgress * 0.3
          });
          this.flamethrowerDamageCooldowns.set(entity, 0.35);
          return;
        }
      }
    };

    this.enemies.forEach(applyResidualBurn);
    if (this.boss && !this.boss.dead) {
      applyResidualBurn(this.boss);
    }

    if (!usingFlamethrower || !this.abilities.flamethrower) {
      this.flamethrowerEmitTimer = 0;
      this.flamethrowerSoundTimer = 0;
      this.flamethrowerAim = null;
      return;
    }
    const attackHeld = this.input.isDown('attack');
    if (!attackHeld || !this.player || this.player.dead) {
      this.flamethrowerEmitTimer = 0;
      this.flamethrowerSoundTimer = 0;
      this.flamethrowerAim = null;
      return;
    }

    this.flamethrowerEmitTimer -= dt;
    this.flamethrowerSoundTimer -= dt;

    const rawAimX = this.player.aimX ?? (this.player.facing || 1);
    const rawAimY = this.player.aimY ?? 0;
    if (!this.flamethrowerAim) {
      this.flamethrowerAim = { x: rawAimX, y: rawAimY };
    }
    const axes = this.input.getGamepadAxes?.() || { leftX: 0 };
    const stickDir = Math.abs(axes.leftX) > 0.25 ? Math.sign(axes.leftX) : 0;
    const moveDir = (this.input.isDown('right') ? 1 : 0) - (this.input.isDown('left') ? 1 : 0) || stickDir;
    let aimX = rawAimX;
    let aimY = rawAimY;
    if (moveDir !== 0 && this.flamethrowerAim.x !== 0 && Math.sign(moveDir) === -Math.sign(this.flamethrowerAim.x)) {
      aimX = this.flamethrowerAim.x;
      aimY = this.flamethrowerAim.y;
    } else {
      this.flamethrowerAim = { x: rawAimX, y: rawAimY };
    }
    const aimLength = Math.hypot(aimX, aimY) || 1;
    const dirX = aimX / aimLength;
    const dirY = aimY / aimLength;
    const duckOffset = this.player.ducking ? 6 : 0;
    const originX = this.player.x + dirX * 18;
    const originY = this.player.y - 6 + duckOffset + dirY * 8;
    const maxRange = tileSize * Math.max(this.world.width, this.world.height);
    const tileX = Math.floor(this.player.x / tileSize);
    const tileY = Math.floor(this.player.y / tileSize);
    const roomIndex = this.world.roomAtTile(tileX, tileY);
    const roomBounds = roomIndex !== null && roomIndex !== undefined ? this.world.getRoomBounds(roomIndex) : null;
    const getQuadraticPoint = (t, startX, startY, dx, dy, curveX, curveY) => {
      const inv = 1 - t;
      return {
        x: inv * inv * startX + 2 * inv * t * (startX + curveX) + t * t * (startX + dx),
        y: inv * inv * startY + 2 * inv * t * (startY + curveY) + t * t * (startY + dy)
      };
    };
    const initialArcDrop = Math.min(maxRange * 0.22, tileSize * 8);
    let streamDx = dirX * maxRange;
    let streamDy = dirY * maxRange + initialArcDrop;
    let controlX = streamDx * 0.5;
    let controlY = streamDy * 0.5 - initialArcDrop * 0.9;
    let impactX = originX + streamDx;
    let impactY = originY + streamDy;
    let impactTile = null;
    let lastPoint = { x: originX, y: originY };
    const steps = Math.max(20, Math.ceil(maxRange / (tileSize * 0.5)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const point = getQuadraticPoint(t, originX, originY, streamDx, streamDy, controlX, controlY);
      const pointTileX = Math.floor(point.x / tileSize);
      const pointTileY = Math.floor(point.y / tileSize);
      if (this.world.isSolid(pointTileX, pointTileY, this.abilities)) {
        impactTile = { x: pointTileX, y: pointTileY };
        impactX = (pointTileX + 0.5) * tileSize;
        impactY = (pointTileY + 0.5) * tileSize;
        break;
      }
      lastPoint = point;
    }
    streamDx = impactX - originX;
    streamDy = impactY - originY;
    const adjustedRange = Math.hypot(streamDx, streamDy);
    const arcDrop = Math.min(adjustedRange * 0.22, tileSize * 8);
    const wobbleScale = Math.min(40, adjustedRange * 0.18);
    const wobbleX = (Math.random() - 0.5) * wobbleScale;
    const wobbleY = (Math.random() - 0.5) * (wobbleScale * 0.65);
    controlX = streamDx * 0.5 + wobbleX;
    controlY = streamDy * 0.5 - arcDrop * 0.95 + wobbleY;

    if (this.flamethrowerSoundTimer <= 0) {
      this.audio.flamethrower();
      this.flamethrowerSoundTimer += 0.2;
    }

    const emitInterval = 0.05;
    if (this.flamethrowerEmitTimer <= 0) {
      this.flamethrowerEmitTimer += emitInterval;
      this.spawnEffect('flamethrower-stream', originX, originY, {
        dx: streamDx,
        dy: streamDy,
        controlX,
        controlY,
        width: 16,
        coreWidth: 7
      });
      for (let i = 0; i < 7; i += 1) {
        const t = 0.18 + Math.random() * 0.7;
        const point = getQuadraticPoint(t, originX, originY, streamDx, streamDy, controlX, controlY);
        const inv = 1 - t;
        const tangentX = 2 * inv * controlX + 2 * t * (streamDx - controlX);
        const tangentY = 2 * inv * controlY + 2 * t * (streamDy - controlY);
        const tangentLength = Math.hypot(tangentX, tangentY) || 1;
        const speed = 180 + Math.random() * 120;
        this.spawnEffect('flamethrower-flame', point.x, point.y, {
          life: 0.22 + Math.random() * 0.18,
          vx: (tangentX / tangentLength) * speed,
          vy: (tangentY / tangentLength) * speed,
          size: 5 + Math.random() * 4
        });
      }
      const impactKey = impactTile ? `${impactTile.x},${impactTile.y}` : null;
      const currentHeat = impactKey ? (this.flamethrowerImpactHeat.get(impactKey)?.heat ?? 0) : 0;
      const nextHeat = impactKey
        ? Math.min(maxHeat, currentHeat + emitInterval * heatGainRate)
        : currentHeat;
      if (impactKey) {
        this.flamethrowerImpactHeat.set(impactKey, { heat: nextHeat, x: impactX, y: impactY });
      }
      const impactHeat = impactKey ? nextHeat : 0;
      const heatProgress = Math.min(1, impactHeat / maxHeat);
      const burnHeight = minBurnHeight + (maxBurnHeight - minBurnHeight) * heatProgress;
      const burnSize = minBurnSize + (maxBurnSize - minBurnSize) * heatProgress;
      this.spawnEffect('flamethrower-impact', impactX, impactY, {
        life: 0.55 + Math.random() * 0.25 + impactHeat * 0.08,
        size: 16 + Math.random() * 10 + heatProgress * 18
      });
      if (impactTile) {
        const radius = minBurnRadius + (maxBurnRadius - minBurnRadius) * heatProgress;
        const tileRadius = Math.max(1, Math.ceil(radius / tileSize));
        const centerTileX = Math.floor(impactX / tileSize);
        const centerTileY = Math.floor(impactY / tileSize);
        for (let y = centerTileY - tileRadius; y <= centerTileY + tileRadius; y += 1) {
          for (let x = centerTileX - tileRadius; x <= centerTileX + tileRadius; x += 1) {
            const tileCenterX = (x + 0.5) * tileSize;
            const tileCenterY = (y + 0.5) * tileSize;
            if (Math.hypot(tileCenterX - impactX, tileCenterY - impactY) > radius) continue;
            this.applyObstacleDamage(x, y, 'flamethrower', {
              cooldown: 0,
              sound: false,
              effect: false
            });
          }
        }
      }
      if (impactTile) {
        this.spawnEffect('flamethrower-burn', impactX, impactY, {
          life: 1.4 + Math.random() * 0.5 + heatProgress * 0.8,
          height: burnHeight + Math.random() * 10,
          size: burnSize + Math.random() * 6,
          intensity: 0.8 + heatProgress * 0.6
        });
      }
    }

    const streamRadius = 18;
    const applyDamage = (entity) => {
      if (!entity || entity.dead) return;
      if (!this.isInRoomBounds(entity.x, entity.y, roomBounds)) return;
      const dx = entity.x - originX;
      const dy = entity.y - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRange || dist <= 0.01) return;
      const dot = (dx / dist) * dirX + (dy / dist) * dirY;
      if (dot <= 0) return;
      let closest = Infinity;
      for (let t = 0; t <= 1.0001; t += 0.07) {
        const point = getQuadraticPoint(t, originX, originY, streamDx, streamDy, controlX, controlY);
        const distance = Math.hypot(entity.x - point.x, entity.y - point.y);
        if (distance < closest) {
          closest = distance;
        }
      }
      if (closest > streamRadius) return;
      if (this.flamethrowerDamageCooldowns.has(entity)) return;
      entity.damage?.(1);
      this.spawnEffect('flamethrower-impact', entity.x, entity.y, {
        life: 0.3,
        size: 16 + Math.random() * 10
      });
      this.spawnEffect('flamethrower-burn', entity.x, entity.y, {
        life: 1.1 + Math.random() * 0.5,
        height: 20 + Math.random() * 10,
        size: 12 + Math.random() * 6
      });
      this.flamethrowerDamageCooldowns.set(entity, 0.2);
      this.testHarness.recordHit();
      this.recordFeedback('hit', 'visual');
      this.playability.recordEnemyHit(this.clock);
      if (entity.dead && entity !== this.boss && !entity.training) {
        this.spawnDeathDebris(entity);
        this.awardLoot(entity);
      }
    };

    this.player.attackTimer = Math.max(this.player.attackTimer, 0.12);
    this.enemies.forEach(applyDamage);
    if (this.boss && !this.boss.dead) {
      applyDamage(this.boss);
    }
  }

  applyIgnitirPlayerImpulse() {
    const sequence = this.ignitirSequence;
    if (!sequence || !this.player || this.player.dead) return;
    const time = sequence.time;
    if (time <= 2.6) {
      const ramp = Math.min(1, time / 2.6);
      const easedRamp = 0.5 - 0.5 * Math.cos(Math.PI * ramp);
      const recoilSpeed = 160 + easedRamp * 360;
      this.player.addImpulse(-sequence.dirX * recoilSpeed, -sequence.dirY * recoilSpeed * 0.6);
      this.player.onGround = false;
      if (easedRamp >= 0.55) {
        this.player.gravityLockTimer = Math.max(this.player.gravityLockTimer || 0, 0.12);
      }
    } else if (time >= 3.3 && time <= 4.4) {
      const dx = this.player.x - sequence.targetX;
      const dy = this.player.y - sequence.targetY;
      const dist = Math.hypot(dx, dy) || 1;
      const ramp = Math.min(1, (time - 3.3) / 1.1);
      const blastSpeed = 280 + ramp * 260;
      this.player.addImpulse((dx / dist) * blastSpeed, (dy / dist) * blastSpeed);
      this.player.onGround = false;
      this.player.gravityLockTimer = Math.max(this.player.gravityLockTimer || 0, 0.12);
    }
  }

  applyIgnitirEnemyPull(dt) {
    const sequence = this.ignitirSequence;
    if (!sequence) return;
    const time = sequence.time;
    if (time < 2.6 || time > 3.8) return;
    const ramp = Math.min(1, (time - 2.6) / 1.2);
    const pullStrength = 180 + ramp * 220;
    sequence.targets.forEach((target) => {
      const entity = target.entity;
      if (!entity || entity.dead) return;
      const dx = sequence.targetX - entity.x;
      const dy = sequence.targetY - entity.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) return;
      const pull = (pullStrength * dt * Math.min(1, 300 / dist));
      entity.x += (dx / dist) * pull;
      entity.y += (dy / dist) * pull;
      if (Number.isFinite(entity.vx)) {
        entity.vx *= 0.85;
      }
      if (Number.isFinite(entity.vy)) {
        entity.vy *= 0.85;
      }
    });
  }

  explodeIgnitirTarget(target) {
    if (!target || target.dead) return;
    target.noLootDrops = true;
    target.damage?.(999);
    this.spawnEffect('ignitir-fog', target.x, target.y);
    this.spawnEffect('ignitir-blast', target.x, target.y, { life: 1.1, radius: 160 });
    this.spawnEffect('ignitir-shockwave', target.x, target.y, {
      life: 0.9,
      startRadius: 30,
      endRadius: 160,
      lineWidth: 3,
      color: 'rgba(200, 230, 255, 0.8)',
      fillColor: 'rgba(150, 200, 240, 0.4)'
    });
  }

  drawIgnitirDissolve(ctx, enemy) {
    if (!enemy?.ignitirDissolveTimer) return;
    const duration = enemy.ignitirDissolveDuration || 1.4;
    const progress = 1 - Math.max(0, enemy.ignitirDissolveTimer) / duration;
    const width = enemy.width || 24;
    const height = enemy.height || 24;
    const count = Math.max(6, Math.floor(6 + progress * 26));
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    for (let i = 0; i < count; i += 1) {
      const size = 2 + Math.random() * 4;
      const px = (Math.random() - 0.5) * width;
      const py = (Math.random() - 0.5) * height;
      ctx.fillRect(px, py, size, size);
    }
    ctx.restore();
  }

  updateEffects(dt) {
    this.effects.forEach((effect) => effect.update(dt));
    this.effects = this.effects.filter((effect) => effect.alive);
  }

  checkPlayerDamage() {
    if (this.player.health < this.prevHealth) {
      this.audio.damage();
      this.spawnEffect('damage', this.player.x, this.player.y - 8);
      this.damageFlashTimer = 0.6;
      this.recordFeedback('take damage', 'audio');
      this.recordFeedback('take damage', 'visual');
    }
    this.prevHealth = this.player.health;
  }

  updateLowHealthWarning(dt) {
    if (!this.player || this.player.dead) return;
    const lowHealth = this.player.health <= 3;
    if (!lowHealth) {
      this.lowHealthAlarmTimer = 0;
      return;
    }
    this.lowHealthAlarmTimer = Math.max(0, this.lowHealthAlarmTimer - dt);
    if (this.lowHealthAlarmTimer <= 0) {
      this.audio.lowHealthAlarm();
      this.lowHealthAlarmTimer = 2.8;
      this.recordFeedback('low health alarm', 'audio');
    }
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

  isPlayerPositionClear(x, y) {
    return !this.isPlayerBlockedAt(x, y, { ignoreOneWay: true });
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
        if (this.world.isEnemySolid(tx, ty, this.abilities)) {
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
    const hitLeft = this.world.isEnemySolid(
      Math.floor(leftX / this.world.tileSize),
      Math.floor(testY / this.world.tileSize),
      this.abilities,
      { ignoreOneWay }
    );
    const hitRight = this.world.isEnemySolid(
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
        if (this.world.isEnemySolid(tx, ty, this.abilities, { ignoreOneWay: true })) {
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
      const relativeDir = Math.sign(enemy.x - this.player.x);
      const dir = relativeDir || Math.sign(this.player.vx) || this.player.facing;
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
      const targetX = this.player.x + overlapX * dir;
      if (this.isPlayerPositionClear(targetX, this.player.y)) {
        this.player.x = targetX;
        this.player.vx = 0;
      } else {
        const enemyTargetX = enemy.x - overlapX * dir;
        if (this.isEnemyPositionClear(enemy, enemyTargetX, enemy.y)) {
          enemy.x = enemyTargetX;
        }
      }
    } else {
      const dir = playerRect.y < enemyRect.y ? -1 : 1;
      const targetY = this.player.y + overlapY * dir;
      if (this.isPlayerPositionClear(this.player.x, targetY)) {
        this.player.y = targetY;
        this.player.vy = 0;
        if (dir < 0) {
          this.player.onGround = true;
        }
      } else {
        const enemyTargetY = enemy.y - overlapY * dir;
        if (this.isEnemyPositionClear(enemy, enemy.x, enemyTargetY)) {
          enemy.y = enemyTargetY;
        }
      }
    }
    return true;
  }

  resolvePlayerTileOverlap(options = {}) {
    const ignoreOneWay = options.ignoreOneWay ?? true;
    const tileSize = this.world.tileSize;
    let rect = this.player.rect;
    const overlaps = [];
    const startX = Math.floor(rect.x / tileSize);
    const endX = Math.floor((rect.x + rect.w) / tileSize);
    const startY = Math.floor(rect.y / tileSize);
    const endY = Math.floor((rect.y + rect.h) / tileSize);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.world.isSolid(tx, ty, this.abilities, { ignoreOneWay })) {
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
        const dir = rect.x < tileRect.x ? -1 : 1;
        this.player.x += overlapX * dir;
        this.player.vx = 0;
      } else {
        const dir = rect.y < tileRect.y ? -1 : 1;
        this.player.y += overlapY * dir;
        this.player.vy = 0;
        if (dir < 0) {
          this.player.onGround = true;
        }
      }
      rect = this.player.rect;
    });
    return overlaps.length > 0;
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
      const lungeDistance = this.world.tileSize * 5;
      const lungeDuration = lungeDistance / MOVEMENT_MODEL.dashSpeed;
      this.player.startLunge(targetX, {
        speed: MOVEMENT_MODEL.dashSpeed,
        duration: lungeDuration
      });
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
      return Math.abs(dx) < range && dy < verticalRange && enemy.health <= 1;
    });
    if (candidates.length === 0) return;
    const enemy = candidates[0];
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
  }

  awardLoot(enemy, execution = false) {
    if (enemy?.noLootDrops) return;
    const total = enemy.lootValue + (execution ? 1 : 0);
    this.lootDrops.push(new LootDrop(enemy.x, enemy.y, total));
    if (!enemy.training) {
      this.healthDrops.push(new HealthDrop(enemy.x, enemy.y));
      this.player.addOil(0.18);
      this.player.addSuperCharge(execution ? 0.25 : 0.18);
    }
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
      if (enemy.ignitirDissolveTimer > 0) {
        enemy.ignitirDissolveTimer = Math.max(0, enemy.ignitirDissolveTimer - dt);
      }
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
      if (dist < 24) {
        if (!enemy.training) {
          const tookDamage = this.player.takeDamage(1);
          if (tookDamage) {
            this.applyPlayerKnockback(enemy);
            enemy.hitPause = 0.2;
          }
        }
      }
      if (revHeld && this.player.revDamageTimer <= 0) {
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
      if (this.isPlayerBlockedAt(this.player.x, this.player.y, { ignoreOneWay: true })) {
        this.resolvePlayerTileOverlap({ ignoreOneWay: true });
      }

      if (enemy.tickDamage) {
        enemy.tickDamage(dt);
      }
    });

    if (this.boss && !this.boss.dead && this.bossActive) {
      if (this.boss.ignitirDissolveTimer > 0) {
        this.boss.ignitirDissolveTimer = Math.max(0, this.boss.ignitirDissolveTimer - dt);
      }
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
    this.lootDrops.forEach((drop) => drop.update(dt, this.world, this.abilities));
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
      }
    });
  }

  updateHealthDrops(dt) {
    this.healthDrops.forEach((drop) => drop.update(dt, this.world, this.abilities));
    this.healthDrops = this.healthDrops.filter((drop) => drop.life > 0 && !drop.collected);
    this.healthDrops.forEach((drop) => {
      const dist = Math.hypot(drop.x - this.player.x, drop.y - this.player.y);
      if (dist < 26) {
        drop.collect();
        const before = this.player.health;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
        if (this.player.health > before) {
          this.audio.pickup();
          this.spawnEffect('pickup', drop.x, drop.y - 8);
          this.recordFeedback('pickup', 'audio');
          this.recordFeedback('pickup', 'visual');
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
    this.audio.showcase();
    this.recordFeedback('menu navigate', 'audio');
    this.recordFeedback('menu navigate', 'visual');
  }

  showSystemToast(message) {
    if (!message) return;
    this.systemPrompts.push(new SystemPrompt(message, { mode: 'toast', duration: 2 }));
  }

  showModalPrompt(message) {
    if (!message) return;
    this.modalPrompt = new SystemPrompt(message, { mode: 'modal' });
    this.promptReturnState = this.state === 'prompt' ? 'playing' : this.state;
    this.state = 'prompt';
  }

  updateSystemPrompts(dt) {
    this.systemPrompts.forEach((prompt) => prompt.update(dt));
    this.systemPrompts = this.systemPrompts.filter((prompt) => !prompt.done);
    if (this.modalPrompt) {
      this.modalPrompt.update(dt);
      if (this.modalPrompt.done) {
        this.modalPrompt = null;
      }
    }
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
        if (pickup.ability === 'ignitir') {
          this.selectWeapon(0);
        }
        if (pickup.ability === 'flamethrower') {
          this.selectWeapon(2);
        }
        this.ensureActiveWeaponAvailable();
        const pickupPause = this.audio.pickup();
        this.pickupPauseTimer = Math.max(this.pickupPauseTimer, pickupPause || 0);
        this.spawnEffect('pickup', pickup.x, pickup.y - 8);
        this.recordFeedback('pickup', 'audio');
        this.recordFeedback('pickup', 'visual');
        const label = ABILITY_PICKUP_LABELS[pickup.ability] || 'Upgrade';
        this.showSystemToast(`${label} acquired`);
      }
    });

    this.world.mapPickups?.forEach((pickup) => {
      if (pickup.collected) return;
      const dist = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
      if (dist < 30) {
        pickup.collected = true;
        const roomIndex = this.world.roomAtTile?.(
          Math.floor(this.player.x / this.world.tileSize),
          Math.floor(this.player.y / this.world.tileSize)
        );
        this.minimap.revealNearbyRooms(roomIndex, 7);
        this.audio.download();
        this.spawnEffect('pickup', pickup.x, pickup.y - 8);
        this.recordFeedback('pickup', 'audio');
        this.recordFeedback('pickup', 'visual');
        this.showModalPrompt('Map updated');
      }
    });

    this.world.healthUpgrades.forEach((upgrade) => {
      if (upgrade.collected) return;
      const dist = Math.hypot(upgrade.x - this.player.x, upgrade.y - this.player.y);
      if (dist < 30) {
        upgrade.collected = true;
        this.player.gainMaxHealth(1);
        this.audio.spawnTune();
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

  getAutoAimVector() {
    const aimX = this.player.aimX ?? (this.player.facing || 1);
    const aimY = this.player.aimY ?? 0;
    const aimLength = Math.hypot(aimX, aimY) || 1;
    const baseX = aimX / aimLength;
    const baseY = aimY / aimLength;
    const range = 180;
    let best = null;
    let bestScore = -Infinity;
    const candidates = [...this.enemies];
    if (this.boss && !this.boss.dead) {
      candidates.push(this.boss);
    }
    candidates.forEach((enemy) => {
      if (!enemy || enemy.dead) return;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range || dist <= 0.01) return;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const dot = dirX * baseX + dirY * baseY;
      if (dot < 0.2) return;
      const score = dot * 2 - dist / range;
      if (score > bestScore) {
        bestScore = score;
        best = { x: dirX, y: dirY };
      }
    });
    return best || { x: baseX, y: baseY };
  }

  spawnIgnitirSpark() {
    if (!this.player) return;
    const aimVector = this.getAutoAimVector();
    const dirX = aimVector.x;
    const dirY = aimVector.y;
    const muzzleOffset = this.player.width * 0.9;
    const originX = this.player.x + dirX * muzzleOffset;
    const originY = this.player.y - 4 + dirY * muzzleOffset;
    this.spawnEffect('ignitir-spark', originX, originY, {
      dirX,
      dirY
    });
  }

  findAnchorHit() {
    const range = this.world.tileSize * 5;
    const step = 8;
    const aimVector = this.getAutoAimVector();
    const dirX = aimVector.x;
    const dirY = aimVector.y;
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
      const nx = dx / dist;
      const ny = dy / dist;
      const holdFactor = Math.min(1, this.attackHoldTimer / 1.2);
      const pullSpeed = 120 + holdFactor * 240;
      const step = Math.min(dist - tetherLimit, pullSpeed * dt);
      const targetX = this.player.x - nx * step;
      const targetY = this.player.y - ny * step;
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
      const horizontalDir = Math.sign(this.sawAnchor.x - this.player.x);
      if (horizontalDir !== 0 && Math.abs(this.sawAnchor.x - this.player.x) > 4) {
        const nextX = this.player.x + horizontalDir * climbSpeed * 0.25 * dt;
        if (!this.isPlayerBlockedAt(nextX, this.player.y, { ignoreOneWay: true })) {
          this.player.x = nextX;
        }
      }
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
      this.playability.recordEnemyHit(this.clock);
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
        const distanceToTop = playerRect.y + playerRect.h - boxRect.y;
        if (this.player.onGround && distanceToTop <= 14) {
          const targetY = boxRect.y - this.player.height / 2;
          if (this.isPlayerPositionClear(this.player.x, targetY)) {
            this.player.y = targetY;
            this.player.onGround = true;
            this.player.vy = Math.min(this.player.vy, 0);
            continue;
          }
        }
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

  getElevatorRectAt(x, y) {
    const width = this.world.tileSize - 12;
    const height = 12;
    return {
      x: x - width / 2,
      y: y - height / 2,
      w: width,
      h: height
    };
  }

  isPlayerOnElevator(playerRect, elevatorRect) {
    const footY = playerRect.y + playerRect.h;
    const withinX = playerRect.x + playerRect.w > elevatorRect.x + 2
      && playerRect.x < elevatorRect.x + elevatorRect.w - 2;
    return withinX && footY >= elevatorRect.y - 8 && footY <= elevatorRect.y + 12;
  }

  advanceElevator(platform, dt) {
    if (!platform.nextTile) return;
    const tileSize = this.world.tileSize;
    const targetX = (platform.nextTile.x + 0.5) * tileSize;
    const targetY = (platform.nextTile.y + 0.5) * tileSize;
    const dx = targetX - platform.x;
    const dy = targetY - platform.y;
    const distance = Math.hypot(dx, dy);
    const step = platform.speed * dt;
    if (distance <= step || distance === 0) {
      platform.x = targetX;
      platform.y = targetY;
      platform.prevTile = { x: platform.tileX, y: platform.tileY };
      platform.tileX = platform.nextTile.x;
      platform.tileY = platform.nextTile.y;
      const neighbors = this.getElevatorGroupNeighbors(platform);
      let nextTile = null;
      if (neighbors.length === 1) {
        nextTile = neighbors[0];
      } else if (neighbors.length > 1) {
        const preferred = {
          x: platform.tileX + platform.dir.dx,
          y: platform.tileY + platform.dir.dy
        };
        nextTile = neighbors.find((neighbor) => neighbor.x === preferred.x && neighbor.y === preferred.y)
          || neighbors.find((neighbor) => !platform.prevTile
            || neighbor.x !== platform.prevTile.x
            || neighbor.y !== platform.prevTile.y)
          || neighbors[0];
      }
      platform.nextTile = nextTile || platform.prevTile;
      if (platform.nextTile) {
        platform.dir = {
          dx: platform.nextTile.x - platform.tileX,
          dy: platform.nextTile.y - platform.tileY
        };
      } else {
        platform.dir = { dx: 0, dy: 0 };
      }
    } else {
      platform.x += (dx / distance) * step;
      platform.y += (dy / distance) * step;
    }
  }

  updateElevators(dt, prevPlayer) {
    if (!this.elevatorPlatforms.length) return;
    const prevPlayerRect = {
      x: prevPlayer.x - this.player.width / 2,
      y: prevPlayer.y - this.player.height / 2,
      w: this.player.width,
      h: this.player.height
    };
    const tileSize = this.world.tileSize;
    for (const platform of this.elevatorPlatforms) {
      const prevX = platform.x;
      const prevY = platform.y;
      const tileOffsets = platform.tiles || [{ dx: 0, dy: 0 }];
      const prevElevatorRects = tileOffsets.map((tile) => this.getElevatorRectAt(
        prevX + tile.dx * tileSize,
        prevY + tile.dy * tileSize
      ));
      this.advanceElevator(platform, dt);
      const nextElevatorRects = tileOffsets.map((tile) => this.getElevatorRectAt(
        platform.x + tile.dx * tileSize,
        platform.y + tile.dy * tileSize
      ));
      const deltaX = platform.x - prevX;
      const deltaY = platform.y - prevY;
      const wasOnElevator = prevElevatorRects.some((rect) => this.isPlayerOnElevator(prevPlayerRect, rect));
      if (wasOnElevator) {
        this.player.x += deltaX;
        this.player.y += deltaY;
        this.player.onGround = true;
        this.player.vy = Math.min(this.player.vy, 0);
      }
      const currentRect = this.player.rect;
      for (const nextElevatorRect of nextElevatorRects) {
        const wasAbove = prevPlayerRect.y + prevPlayerRect.h <= nextElevatorRect.y + 2;
        const nowOnTop = this.isPlayerOnElevator(currentRect, nextElevatorRect);
        if (this.player.vy >= 0 && wasAbove && nowOnTop) {
          this.player.y = nextElevatorRect.y - this.player.height / 2;
          this.player.vy = 0;
          this.player.onGround = true;
          break;
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

  applyObstacleDamage(tileX, tileY, tool, options = {}) {
    const tile = this.world.getTile(tileX, tileY);
    const obstacle = OBSTACLES[tile];
    if (!obstacle) return false;
    let interaction = obstacle.interactions?.[tool];
    if (!interaction && tool === 'flamethrower') {
      interaction = obstacle.interactions?.flame;
    }
    if (!interaction) return false;
    const key = `${tileX},${tileY}`;
    const prev = this.obstacleDamage.get(key) || 0;
    const next = prev + 1;
    this.obstacleDamage.set(key, next);
    if (interaction.noise) {
      this.triggerNoiseSpike(interaction.verb);
    }
    if (options.effect !== false) {
      this.spawnEffect('hit', tileX * this.world.tileSize + this.world.tileSize / 2, tileY * this.world.tileSize + this.world.tileSize / 2);
    }
    if (options.sound !== false) {
      this.audio.hit();
    }
    if (options.cooldown) {
      this.obstacleCooldown = options.cooldown;
    }
    if (next >= (interaction.hits || 1)) {
      this.world.setTile(tileX, tileY, '.');
      if (tile === 'B') {
        this.world.bossGate = null;
      }
      this.obstacleDamage.delete(key);
      this.spawnEffect('interact', tileX * this.world.tileSize + this.world.tileSize / 2, tileY * this.world.tileSize + this.world.tileSize / 2);
    }
    return true;
  }

  applyIgnitirObstacleBurst(targetX, targetY, radius = 6) {
    const tileSize = this.world.tileSize;
    const centerX = Math.floor(targetX / tileSize);
    const centerY = Math.floor(targetY / tileSize);
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        const dist = Math.hypot(x - centerX, y - centerY);
        if (dist > radius + 0.4) continue;
        this.applyObstacleDamage(x, y, 'ignitir', {
          cooldown: 0,
          sound: false,
          effect: false
        });
      }
    }
  }

  tryObstacleInteraction(mode) {
    if (this.sawAnchor.active) return false;
    if (this.obstacleCooldown > 0) return false;
    const tileSize = this.world.tileSize;
    const checkX = this.player.x + this.player.facing * tileSize * 0.55;
    const checkY = this.player.y - 6;
    const tileX = Math.floor(checkX / tileSize);
    const tileY = Math.floor(checkY / tileSize);
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
    if (!tool) return false;
    return this.applyObstacleDamage(tileX, tileY, tool, { cooldown: 0.2 });
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.state === 'loading') {
      this.title.draw(ctx, canvas.width, canvas.height, this.effectiveInputMode, {
        isMobile: this.deviceIsMobile,
        gamepadConnected: this.gamepadConnected
      });
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Loading...', canvas.width / 2, canvas.height - 180);
      ctx.restore();
      return;
    }

    if (this.state === 'title') {
      this.title.draw(ctx, canvas.width, canvas.height, this.effectiveInputMode, {
        isMobile: this.deviceIsMobile,
        gamepadConnected: this.gamepadConnected
      });
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
    this.drawElevators(ctx);
    this.drawBoxes(ctx);
    this.roomCoverageTest.drawWorld(ctx);
    this.drawInteractables(ctx);
    if (this.sawAnchor.active) {
      this.drawSawAnchor(ctx);
    }
    this.drawObjectiveBeacon(ctx);
    this.drawTutorialHints(ctx);

    this.enemies.forEach((enemy) => {
      if (!enemy.dead || enemy.deathTimer > 0) {
        enemy.draw(ctx);
        this.drawIgnitirDissolve(ctx, enemy);
      }
    });

    if (this.boss && !this.boss.dead) {
      this.boss.draw(ctx);
      this.drawIgnitirDissolve(ctx, this.boss);
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
    this.healthDrops.forEach((drop) => drop.draw(ctx));
    if (!this.player.dead) {
      if (this.getActiveWeapon()?.id === 'ignitir' && this.ignitirReady) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(120, 210, 255, 0.35)';
        ctx.shadowColor = 'rgba(120, 210, 255, 0.9)';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y - 6, 22 + Math.sin(this.clock * 8) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.player.draw(ctx);
      const tileSize = this.world.tileSize;
      const playerTileX = Math.floor(this.player.x / tileSize);
      const playerTileY = Math.floor(this.player.y / tileSize);
      const revealHiddenPaths = this.ignitirSequence
        && this.ignitirSequence.time >= 2.4
        && this.ignitirSequence.time <= 4.6;
      if (!revealHiddenPaths && this.world.getTile(playerTileX, playerTileY) === 'Z') {
        ctx.save();
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(playerTileX * tileSize, playerTileY * tileSize, tileSize, tileSize);
        ctx.strokeStyle = '#2b2b2b';
        ctx.strokeRect(playerTileX * tileSize, playerTileY * tileSize, tileSize, tileSize);
        ctx.strokeStyle = '#1f1f1f';
        ctx.strokeRect(playerTileX * tileSize + 2, playerTileY * tileSize + 2, tileSize - 4, tileSize - 4);
        ctx.restore();
      }
    }
    if (this.testHarness.active && this.testHarness.showCollision) {
      this.drawCollisionBoxes(ctx);
    }
    this.playability.drawWorld(ctx, this);
    this.drawBloom(ctx);
    ctx.restore();

    if (this.doorTransition) {
      const t = Math.min(1, this.doorTransition.progress / this.doorTransition.duration);
      const fadeOutEnd = 0.3;
      const fadeInStart = 0.72;
      let fade = 0;
      if (t <= fadeOutEnd) {
        fade = t / fadeOutEnd;
      } else if (t < fadeInStart) {
        fade = 1;
      } else {
        fade = 1 - (t - fadeInStart) / (1 - fadeInStart);
      }
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    if (this.damageFlashTimer > 0) {
      const pulse = Math.sin((1 - this.damageFlashTimer / 0.6) * Math.PI);
      ctx.save();
      ctx.globalAlpha = 0.2 + pulse * 0.35;
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (this.ignitirFlashTimer > 0) {
      const pulse = Math.sin((1 - this.ignitirFlashTimer / 0.9) * Math.PI);
      ctx.save();
      ctx.globalAlpha = 0.25 + pulse * 0.4;
      ctx.fillStyle = 'rgba(80, 180, 255, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    const sawUsing = this.player.attackTimer > 0 || this.sawAnchor.active;
    const sawBuzzing = this.revActive;
    this.hud.draw(ctx, this.player, this.objective, {
      shake: this.pauseMenu.shake,
      sawEmbedded: this.sawAnchor.embedded,
      sawUsing,
      sawBuzzing,
      sawHeld: this.player.chainsawHeld || this.sawAnchor.active,
      flameMode: this.player.flameMode && this.abilities.flame,
      weapons: this.getWeaponSlots(),
      activeWeaponIndex: this.activeWeaponIndex,
      ignitirCharge: this.ignitirCharge,
      ignitirReady: this.ignitirReady
    });
    const objectiveTarget = this.getObjectiveTarget();
    const minimapX = canvas.width - 180;
    const minimapY = 20;
    const minimapW = 160;
    const minimapH = 90;
    this.minimap.draw(ctx, minimapX, minimapY, minimapW, minimapH, this.player, {
      objective: objectiveTarget,
      showLegend: this.checklist.active
    });
    this.minimapBounds = { x: minimapX, y: minimapY, w: minimapW, h: minimapH };
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

    this.minimapBackBounds = null;
    if (this.state === 'pause' && this.minimapSelected) {
      this.drawMinimapOverlay(ctx, canvas.width, canvas.height, objectiveTarget);
    } else if (this.state === 'pause') {
      this.pauseMenu.draw(ctx, canvas.width, canvas.height, this.objective);
    }

    this.systemPrompts.forEach((prompt) => prompt.draw(ctx, canvas.width, canvas.height));
    if (this.modalPrompt) {
      this.modalPrompt.draw(ctx, canvas.width, canvas.height);
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

  getIgnitirTint() {
    if (!this.ignitirSequence) return 0;
    const time = this.ignitirSequence.time;
    if (time < 3 || time > 4.6) return 0;
    const rise = Math.min(1, (time - 3) / 0.4);
    const fall = time > 4 ? Math.max(0, 1 - (time - 4) / 0.6) : 1;
    return rise * fall;
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

  drawElevators(ctx) {
    const tileSize = this.world.tileSize;
    const platforms = this.elevatorPlatforms?.length ? this.elevatorPlatforms : (this.world.elevators || []);
    if (!platforms.length) return;
    ctx.save();
    ctx.strokeStyle = '#5c5c5c';
    ctx.lineWidth = 2;
    platforms.forEach((platform) => {
      const baseX = platform.tileX !== undefined ? platform.x : (platform.x + 0.5) * tileSize;
      const baseY = platform.tileY !== undefined ? platform.y : (platform.y + 0.5) * tileSize;
      const tileOffsets = platform.tiles || [{ dx: 0, dy: 0 }];
      tileOffsets.forEach((tile) => {
        const x = baseX + tile.dx * tileSize;
        const y = baseY + tile.dy * tileSize;
        const rect = this.getElevatorRectAt(x, y);
        const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        gradient.addColorStop(0, '#909090');
        gradient.addColorStop(0.55, '#6f6f6f');
        gradient.addColorStop(1, '#4e4e4e');
        ctx.fillStyle = gradient;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        const orbX = rect.x + rect.w / 2;
        const orbY = rect.y + rect.h / 2;
        const orbRadius = Math.min(rect.w, rect.h) * 0.22;
        const orbGradient = ctx.createRadialGradient(orbX, orbY, orbRadius * 0.2, orbX, orbY, orbRadius);
        orbGradient.addColorStop(0, '#c5f0ff');
        orbGradient.addColorStop(0.6, '#55b8ff');
        orbGradient.addColorStop(1, '#1f5aa8');
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  drawWorld(ctx, { showDoors = false } = {}) {
    const tileSize = this.world.tileSize;
    const time = this.worldTime;
    const ignitirTint = this.getIgnitirTint();
    const revealHiddenPaths = this.ignitirSequence
      && this.ignitirSequence.time >= 2.4
      && this.ignitirSequence.time <= 4.6;
    const isSolidTile = (tx, ty) => this.world.isSolid(tx, ty, this.abilities);
    const drawLiquid = (x, y, fill, highlight, surfaceActive = true) => {
      const baseX = x * tileSize;
      const baseY = y * tileSize;
      ctx.fillStyle = fill;
      ctx.fillRect(baseX, baseY, tileSize, tileSize);
      if (!surfaceActive) return;
      const wave = Math.sin(time * 2 + x * 0.7 + y * 0.4);
      const surface = baseY + tileSize * 0.35 + wave * 2;
      ctx.fillStyle = highlight;
      ctx.fillRect(baseX, surface, tileSize, baseY + tileSize - surface);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(baseX, surface);
      ctx.lineTo(baseX + tileSize, surface);
      ctx.stroke();
    };
    const drawBubbles = (x, y, color) => {
      const baseX = x * tileSize;
      const baseY = y * tileSize;
      ctx.save();
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i += 1) {
        const phase = (time * 0.6 + i * 1.3 + x * 0.2 + y * 0.15) % 1;
        const bubbleX = baseX + tileSize * (0.2 + 0.6 * ((i * 0.37) % 1)) + Math.sin(time + i) * 1.5;
        const bubbleY = baseY + tileSize * (0.75 - phase * 0.5);
        const radius = 1.5 + (1 - phase) * 1.5;
        ctx.globalAlpha = 0.3 + (1 - phase) * 0.4;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    const drawSteam = (x, y, color) => {
      const baseX = x * tileSize;
      const baseY = y * tileSize;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        const offsetX = tileSize * (0.2 + i * 0.3) + Math.sin(time * 1.2 + i + x * 0.4) * 2;
        const offsetY = Math.sin(time * 1.6 + y * 0.3 + i) * 2;
        ctx.globalAlpha = 0.2 + (Math.sin(time * 2 + i) + 1) * 0.15;
        ctx.beginPath();
        ctx.moveTo(baseX + offsetX, baseY + offsetY - 2);
        ctx.lineTo(baseX + offsetX + 2, baseY + offsetY - 10);
        ctx.stroke();
      }
      ctx.restore();
    };
    const drawSpikeTile = (x, y) => {
      const hasFloor = isSolidTile(x, y + 1);
      const hasCeiling = isSolidTile(x, y - 1);
      const hasLeft = isSolidTile(x - 1, y);
      const hasRight = isSolidTile(x + 1, y);
      let orientation = 'up';
      if (hasFloor) orientation = 'up';
      else if (hasCeiling) orientation = 'down';
      else if (hasLeft) orientation = 'right';
      else if (hasRight) orientation = 'left';
      const baseX = x * tileSize;
      const baseY = y * tileSize;
      const teeth = 4;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < teeth; i += 1) {
        if (orientation === 'up' || orientation === 'down') {
          const spikeW = tileSize / teeth;
          const spikeX = baseX + i * spikeW;
          const tipX = spikeX + spikeW / 2;
          const baseYPos = orientation === 'up' ? baseY + tileSize : baseY;
          const tipY = orientation === 'up' ? baseY + tileSize * 0.35 : baseY + tileSize * 0.65;
          ctx.beginPath();
          ctx.moveTo(spikeX, baseYPos);
          ctx.lineTo(spikeX + spikeW, baseYPos);
          ctx.lineTo(tipX, tipY);
          ctx.closePath();
          ctx.fill();
        } else {
          const spikeH = tileSize / teeth;
          const spikeY = baseY + i * spikeH;
          const tipY = spikeY + spikeH / 2;
          const baseXPos = orientation === 'right' ? baseX : baseX + tileSize;
          const tipX = orientation === 'right' ? baseX + tileSize * 0.65 : baseX + tileSize * 0.35;
          ctx.beginPath();
          ctx.moveTo(baseXPos, spikeY);
          ctx.lineTo(baseXPos, spikeY + spikeH);
          ctx.lineTo(tipX, tipY);
          ctx.closePath();
          ctx.fill();
        }
      }
    };
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
        if (tile === 'F') {
          ctx.fillStyle = '#bfe9ff';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#86c9f0';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 4, y * tileSize + tileSize - 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + 6);
          ctx.stroke();
        }
        if (tile === 'R') {
          ctx.fillStyle = '#8a5a2b';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#6d4221';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#4b2f17';
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
        if (tile === 'Y') {
          ctx.fillStyle = '#c08a58';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#7a4d24';
          ctx.strokeRect(x * tileSize + 3, y * tileSize + 3, tileSize - 6, tileSize - 6);
          ctx.strokeStyle = '#5a3617';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 6, y * tileSize + tileSize - 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + 6);
          ctx.stroke();
        }
        if (tile === 'N') {
          ctx.fillStyle = '#dff2ff';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#9ad9ff';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 4, y * tileSize + tileSize - 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + 4);
          ctx.stroke();
        }
        if (tile === 'P') {
          ctx.fillStyle = '#8a8f9f';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#646976';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#4a4e59';
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
        if (tile === '^' || tile === 'v') {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          if (tile === '^') {
            ctx.moveTo(x * tileSize, (y + 1) * tileSize);
            ctx.lineTo((x + 1) * tileSize, (y + 1) * tileSize);
            ctx.lineTo((x + 1) * tileSize, y * tileSize);
          } else {
            ctx.moveTo(x * tileSize, y * tileSize);
            ctx.lineTo(x * tileSize, (y + 1) * tileSize);
            ctx.lineTo((x + 1) * tileSize, (y + 1) * tileSize);
          }
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
        if (tile === '~') {
          const isSurface = this.world.getTile(x, y - 1) !== '~';
          drawLiquid(x, y, '#1f66aa', '#3b9fe0', isSurface);
        }
        if (tile === 'A') {
          const isSurface = this.world.getTile(x, y - 1) !== 'A';
          drawLiquid(x, y, '#1c7a46', '#4fe18b', isSurface);
          if (isSurface) {
            drawBubbles(x, y, 'rgba(188,255,214,0.7)');
          }
        }
        if (tile === 'L') {
          const isSurface = this.world.getTile(x, y - 1) !== 'L';
          drawLiquid(x, y, '#ff3b1e', '#ffb347', isSurface);
          if (isSurface) {
            drawSteam(x, y, 'rgba(255,220,200,0.6)');
          }
        }
        if (tile === 'Z' && !revealHiddenPaths) {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#2b2b2b';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#1f1f1f';
          ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
        if (tile === '*') {
          drawSpikeTile(x, y);
        }
        if (tile === 'I') {
          ctx.fillStyle = '#8fd6ff';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + 4, y * tileSize + tileSize - 6);
          ctx.lineTo(x * tileSize + tileSize - 6, y * tileSize + 6);
          ctx.stroke();
        }
        if (tile === '<' || tile === '>') {
          ctx.fillStyle = '#2b2b2b';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#1f1f1f';
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          if (tile === '<') {
            ctx.moveTo(x * tileSize + tileSize - 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + 14, y * tileSize + tileSize / 2 - 6);
            ctx.moveTo(x * tileSize + 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + 14, y * tileSize + tileSize / 2 + 6);
          } else {
            ctx.moveTo(x * tileSize + 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + tileSize - 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + tileSize - 14, y * tileSize + tileSize / 2 - 6);
            ctx.moveTo(x * tileSize + tileSize - 8, y * tileSize + tileSize / 2);
            ctx.lineTo(x * tileSize + tileSize - 14, y * tileSize + tileSize / 2 + 6);
          }
          ctx.stroke();
        }
        if (tile === 'D' && showDoors) {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
          ctx.beginPath();
          ctx.moveTo(x * tileSize + tileSize / 2, y * tileSize + 6);
          ctx.lineTo(x * tileSize + tileSize / 2, y * tileSize + tileSize - 6);
          ctx.stroke();
        }
        if (OBSTACLES[tile] && !['Y', 'N', 'P'].includes(tile)) {
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
        if (ignitirTint > 0 && isSolidTile(x, y)) {
          ctx.fillStyle = `rgba(90, 180, 255, ${0.35 * ignitirTint})`;
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
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
      resonance: 'TOOLS: RESONANCE CORE',
      ignitir: 'WEAPON: IGNITIR',
      flamethrower: 'WEAPON: FLAMETHROWER'
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

    this.world.mapPickups?.forEach((pickup) => {
      if (pickup.collected) return;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y - 12, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pickup.x - 6, pickup.y - 12);
      ctx.lineTo(pickup.x + 6, pickup.y - 12);
      ctx.moveTo(pickup.x, pickup.y - 18);
      ctx.lineTo(pickup.x, pickup.y - 6);
      ctx.stroke();
      this.drawLabel(ctx, pickup.x, pickup.y - 30, 'MAP CACHE', pickup);
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

  drawMinimapOverlay(ctx, width, height, objectiveTarget) {
    const mapWidth = Math.min(width * 0.72, 540);
    const mapHeight = Math.min(height * 0.6, 360);
    const mapX = (width - mapWidth) / 2;
    const mapY = (height - mapHeight) / 2;
    this.minimap.update(this.player);
    const buttonWidth = 130;
    const buttonHeight = 32;
    const buttonGap = 16;
    const buttonsTotal = buttonWidth * 2 + buttonGap;
    const buttonX = mapX + Math.max(0, (mapWidth - buttonsTotal) / 2);
    const buttonY = mapY + mapHeight + 28;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, width, height);
    this.minimap.draw(ctx, mapX, mapY, mapWidth, mapHeight, this.player, {
      objective: objectiveTarget,
      showLegend: true
    });
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', width / 2, mapY - 14);
    ctx.font = '12px Courier New';
    ctx.fillText('Back closes map • Esc resumes', width / 2, mapY + mapHeight + 18);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.fillRect(buttonX + buttonWidth + buttonGap, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeRect(buttonX + buttonWidth + buttonGap, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('BACK', buttonX + buttonWidth / 2, buttonY + 21);
    ctx.fillText('EXIT', buttonX + buttonWidth + buttonGap + buttonWidth / 2, buttonY + 21);
    ctx.restore();
    this.minimapBackBounds = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };
    this.minimapExitBounds = {
      x: buttonX + buttonWidth + buttonGap,
      y: buttonY,
      w: buttonWidth,
      h: buttonHeight
    };
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
    const order = ['anchor', 'flame', 'magboots', 'resonance', 'flamethrower', 'ignitir'];
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
      resonance: true,
      flamethrower: true
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
      resonance: true,
      flamethrower: true
    };
    const report = this.encounterAuditTest.run(this, abilities);
    this.testResults.encounter = report.status;
    this.testDashboard.setResults({ encounter: report.status });
    this.testDashboard.setDetails('encounter', report.lines);
    this.consoleOverlay.setReport(report.status, report.lines, 'ENCOUNTER AUDIT');
    console.log('Encounter Audit Report:', report);
  }

  runGoldenPathSimulation({
    restoreState = null,
    playtest = false,
    startWithEverything = true,
    maxSimSeconds = null,
    timeoutWarning = ''
  } = {}) {
    if (this.goldenPath.status === 'running') return null;
    const worldData = this.buildWorldData();
    const savedState = {
      state: this.state,
      playtestActive: this.playtestActive,
      editorActive: this.editor?.active ?? false,
      inputMode: this.inputMode
    };
    this.resetRun({ playtest, startWithEverything });
    this.state = 'playing';
    this.simulationActive = true;
    let report = this.goldenPathTest.start(this);
    let timedOut = false;
    this.testResults.golden = report.status;
    this.testDashboard.setResults({ golden: report.status });
    this.testDashboard.setDetails('golden', report.lines);
    if (report.status === 'running') {
      const maxSeconds = maxSimSeconds ?? this.goldenPath.data?.maxSimSeconds ?? 120;
      const maxSteps = Math.floor(maxSeconds * 60);
      const dt = 1 / 60;
      for (let step = 0; step < maxSteps && this.goldenPath.status === 'running'; step += 1) {
        this.goldenPath.preUpdate(dt, this);
        if (this.goldenPath.freeze) break;
        this.update(dt);
        this.goldenPath.postUpdate(dt, this);
      }
      timedOut = this.goldenPath.status === 'running';
      if (timedOut) {
        this.goldenPath.stop(this);
      }
      report = this.goldenPathTest.buildReport(this);
      this.testResults.golden = report.status;
      this.testDashboard.setResults({ golden: report.status });
      this.testDashboard.setDetails('golden', report.lines);
    } else if (report.status === 'fail') {
      this.simulationActive = false;
    }
    this.goldenPath.restoreSeed();
    this.goldenPath.active = false;
    this.goldenPath.freeze = false;
    this.simulationActive = false;
    if (restoreState) {
      this.applyWorldData(worldData);
      if (restoreState === 'editor') {
        this.state = 'editor';
        this.playtestActive = false;
        this.editor.activate();
        document.body.classList.add('editor-active');
      } else if (restoreState === 'playtest') {
        this.state = 'playing';
        this.playtestActive = true;
        this.resetRun({ playtest: true, startWithEverything });
      } else {
        this.state = savedState.state;
        this.playtestActive = savedState.playtestActive;
        if (savedState.editorActive) {
          this.editor.activate();
          document.body.classList.add('editor-active');
        }
      }
      if (savedState.inputMode) {
        this.inputMode = savedState.inputMode;
      }
    }
    if (timeoutWarning && timedOut) {
      this.showModalPrompt(timeoutWarning);
    }
    return report;
  }

  runAllTests(applyFixes = false) {
    this.runWorldValidityTest(applyFixes);
    this.runRoomCoverageTest();
    this.runEncounterAuditTest();
  }

  loadObstacleTestRoom() {
    this.world.applyData(ObstacleTestMap);
    this.refreshWorldCaches();
    this.abilities = {
      anchor: true,
      flame: true,
      magboots: true,
      resonance: true,
      flamethrower: true
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
        this.audio.ui();
        return;
      }
      if (action.type === 'runAll') {
        this.runAllTests(this.testDashboard.applyFixes);
        this.audio.ui();
      }
    }
    if (this.state === 'title' && !this.testDashboard.visible) {
      if (this.title.screen === 'intro') {
        this.title.setScreen('main');
        this.audio.ui();
        return;
      }
      const action = this.title.getActionAt(x, y);
      if (!action) return;
      if (this.title.screen === 'controls') {
        if (action === 'back') {
          this.title.setScreen('main');
        } else {
          this.setInputMode(action);
          this.title.setControlsSelectionByMode(this.inputMode);
        }
        this.audio.ui();
        return;
      }
      if (action === 'options') {
        this.title.setControlsSelectionByMode(this.inputMode);
        this.title.setScreen('controls');
        this.audio.ui();
        return;
      }
      if (action === 'editor') {
        this.enterEditor();
        return;
      }
      if (action === 'endless') {
        this.startEndlessMode();
        this.audio.ui();
        return;
      }
      if (action === 'campaign') {
        if (this.gameMode !== 'story' && this.storyData) {
          this.gameMode = 'story';
          this.applyWorldData(this.storyData);
          this.resetRun();
        } else {
          this.gameMode = 'story';
        }
        this.state = 'dialog';
        this.audio.ui();
      }
    }
  }

  handlePointerDown(payload) {
    if (this.state === 'editor') {
      this.editor.handlePointerDown(payload);
      return;
    }
    if (this.state === 'prompt' && this.modalPrompt?.okBounds) {
      const { x, y, w, h } = this.modalPrompt.okBounds;
      if (payload.x >= x && payload.x <= x + w && payload.y >= y && payload.y <= y + h) {
        this.modalPrompt.dismiss();
        this.state = this.promptReturnState || 'playing';
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        return;
      }
    }
    if (
      this.state === 'pause'
      && this.minimapSelected
      && this.minimapBackBounds
      && payload.x >= this.minimapBackBounds.x
      && payload.x <= this.minimapBackBounds.x + this.minimapBackBounds.w
      && payload.y >= this.minimapBackBounds.y
      && payload.y <= this.minimapBackBounds.y + this.minimapBackBounds.h
    ) {
      this.state = 'playing';
      this.minimapSelected = false;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      return;
    }
    if (
      this.state === 'pause'
      && this.minimapSelected
      && this.minimapExitBounds
      && payload.x >= this.minimapExitBounds.x
      && payload.x <= this.minimapExitBounds.x + this.minimapExitBounds.w
      && payload.y >= this.minimapExitBounds.y
      && payload.y <= this.minimapExitBounds.y + this.minimapExitBounds.h
    ) {
      this.state = 'playing';
      this.minimapSelected = false;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      return;
    }
    if (this.state === 'playing') {
      const weaponIndex = this.hud.getWeaponButtonAt(payload.x, payload.y);
      if (weaponIndex !== null && weaponIndex !== undefined) {
        this.selectWeapon(weaponIndex);
        this.audio.ui();
        this.recordFeedback('weapon select', 'audio');
        this.recordFeedback('weapon select', 'visual');
        return;
      }
    }
    if (
      (this.state === 'playing' || this.state === 'pause')
      && this.minimapBounds
      && payload.x >= this.minimapBounds.x
      && payload.x <= this.minimapBounds.x + this.minimapBounds.w
      && payload.y >= this.minimapBounds.y
      && payload.y <= this.minimapBounds.y + this.minimapBounds.h
    ) {
      this.state = 'pause';
      this.minimapSelected = true;
      this.audio.menu();
      this.recordFeedback('menu navigate', 'audio');
      this.recordFeedback('menu navigate', 'visual');
      return;
    }
    if (this.playtestActive && this.state === 'playing' && this.isPlaytestButtonHit(payload.x, payload.y)) {
      this.returnToEditorFromPlaytest();
      return;
    }
    if (this.state === 'title' && !this.testDashboard.visible) {
      if (this.title.screen === 'intro') {
        this.title.setScreen('main');
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        return;
      }
      const action = this.title.getActionAt(payload.x, payload.y);
      if (!action) {
        this.mobileControls.handlePointerDown(payload, this.state);
        return;
      }
      if (this.title.screen === 'controls') {
        if (action === 'back') {
          this.title.setScreen('main');
        } else {
          this.setInputMode(action);
          this.title.setControlsSelectionByMode(this.inputMode);
        }
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        return;
      }
      if (action === 'options') {
        this.title.setControlsSelectionByMode(this.inputMode);
        this.title.setScreen('controls');
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        return;
      }
      if (action === 'endless') {
        this.startEndlessMode();
        this.audio.ui();
        this.recordFeedback('menu navigate', 'audio');
        this.recordFeedback('menu navigate', 'visual');
        return;
      }
      if (action === 'editor') {
        this.enterEditor();
        return;
      }
      if (action === 'campaign') {
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
        return;
      }
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
