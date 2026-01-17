const DEFAULT_TILE_TYPES = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'triangle', label: 'Triangle Block', char: '^' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'hazard', label: 'Hazard', char: '!' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'wood', label: 'Wood Barricade', char: 'W' },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C' },
  { id: 'debris', label: 'Heavy Debris', char: 'U' },
  { id: 'box', label: 'Pull Box', char: 'K' },
  { id: 'switch', label: 'Counterweight Switch', char: 'T' },
  { id: 'bossGate', label: 'Rift Seal', char: 'B' },
  { id: 'abilityG', label: 'Tools: Chainsaw Throw', char: 'g' },
  { id: 'abilityP', label: 'Tools: Flame-Saw', char: 'p' },
  { id: 'abilityM', label: 'Ability: Mag Boots', char: 'm' },
  { id: 'abilityR', label: 'Ability: Resonance', char: 'r' },
  { id: 'health', label: 'Vitality Core', char: 'H' },
  { id: 'spawn', label: 'Player Spawn', char: null, special: 'spawn' },
  { id: 'checkpoint', label: 'Checkpoint', char: 'S' },
  { id: 'shop', label: 'Shop', char: '$' },
  { id: 'objective', label: 'Objective', char: 'O' }
];

const ENEMY_TYPES = [
  { id: 'practice', label: 'Practice Drone', glyph: 'PD' },
  { id: 'skitter', label: 'Skitter', glyph: 'SK' },
  { id: 'spitter', label: 'Spitter', glyph: 'SP' },
  { id: 'bulwark', label: 'Bulwark', glyph: 'BW' },
  { id: 'floater', label: 'Floater', glyph: 'FL' },
  { id: 'drifter', label: 'Drifter', glyph: 'DF' },
  { id: 'bobber', label: 'Bobber', glyph: 'BB' },
  { id: 'harrier', label: 'Harrier', glyph: 'HR' },
  { id: 'slicer', label: 'Slicer', glyph: 'SL' },
  { id: 'hivenode', label: 'Hive Node', glyph: 'HN' },
  { id: 'bouncer', label: 'Bouncer', glyph: 'BO' },
  { id: 'pouncer', label: 'Pouncer', glyph: 'PN' },
  { id: 'coward', label: 'Coward', glyph: 'CW' },
  { id: 'ranger', label: 'Ranger', glyph: 'RG' },
  { id: 'sentinel', label: 'Sentinel', glyph: 'SE' },
  { id: 'finalboss', label: 'Rift Tyrant', glyph: 'RT' },
  { id: 'sunderbehemoth', label: 'Sunder Behemoth', glyph: 'SB' },
  { id: 'riftram', label: 'Rift Ram', glyph: 'RR' },
  { id: 'broodtitan', label: 'Brood Titan', glyph: 'BT' },
  { id: 'nullaegis', label: 'Null Aegis', glyph: 'NA' },
  { id: 'hexmatron', label: 'Hex Matron', glyph: 'HM' },
  { id: 'gravewarden', label: 'Grave Warden', glyph: 'GW' },
  { id: 'obsidiancrown', label: 'Obsidian Crown', glyph: 'OC' },
  { id: 'cataclysmcolossus', label: 'Cataclysm Colossus', glyph: 'CC' }
];

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle Fill', short: 'RECT' },
  { id: 'hollow', label: 'Hollow Rectangle', short: 'HOLL' },
  { id: 'line', label: 'Line', short: 'LINE' },
  { id: 'stair', label: 'Stair Generator', short: 'ST' },
  { id: 'triangle', label: 'Triangle Fill', short: 'TRI' },
  { id: 'triangle-1x1', label: 'Triangle Block 1x1', short: 'T1' },
  { id: 'triangle-2x1', label: 'Triangle Block 2x1', short: 'T2W' },
  { id: 'triangle-1x2', label: 'Triangle Block 1x2', short: 'T2H' }
];

const PREFAB_TYPES = [
  { id: 'room', label: 'Room', short: 'RM', roomType: true },
  { id: 'circular', label: 'Circular Room', short: 'CIR', roomType: true },
  { id: 'cave', label: 'Cave Room', short: 'CAV', roomType: true },
  { id: 'corridor', label: 'Corridor', short: 'CR' },
  { id: 'staircase', label: 'Staircase', short: 'SC' },
  { id: 'platform', label: 'Platform Run', short: 'PL' },
  { id: 'arena', label: 'Arena', short: 'AR', roomType: true },
  { id: 'puzzle', label: 'Puzzle Kit', short: 'PZ' }
];

const MODE_LABELS = {
  tile: 'Tile',
  enemy: 'Enemies',
  prefab: 'Structures',
  shape: 'Shapes'
};

const TILE_TOOL_LABELS = {
  paint: 'Paint',
  erase: 'Erase',
  move: 'Move'
};

const BIOME_THEMES = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'light-blue', name: 'Light Blue', color: '#9ad9ff' },
  { id: 'dark-green', name: 'Dark Green', color: '#1f6b3a' },
  { id: 'light-grey', name: 'Light Grey', color: '#c7c7c7' },
  { id: 'red', name: 'Red', color: '#e04646' },
  { id: 'purple', name: 'Purple', color: '#8b4cc7' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (list) => list[randInt(0, list.length - 1)];

export default class Editor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.mode = 'tile';
    this.tileTool = 'paint';
    this.tileType = DEFAULT_TILE_TYPES[0];
    this.customTile = null;
    this.enemyType = ENEMY_TYPES[0];
    this.shapeTool = SHAPE_TOOLS[0];
    this.prefabType = PREFAB_TYPES[0];
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
    this.dragging = false;
    this.dragMode = null;
    this.dragStart = null;
    this.panStart = null;
    this.zoomStart = null;
    this.gestureStart = null;
    this.dragButton = null;
    this.pendingChanges = new Map();
    this.pendingSpawn = null;
    this.pendingEnemies = new Map();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.hoverTile = null;
    this.regionName = 'Unknown';
    this.lastPointer = { x: 0, y: 0 };
    this.uiButtons = [];
    this.uiSections = {
      tools: true,
      tiles: true,
      enemies: true,
      prefabs: true,
      shapes: true
    };
    this.drawer = {
      open: true,
      tabIndex: 0,
      tabs: ['tools', 'tiles', 'enemies', 'prefabs', 'shapes'],
      swipeStart: null
    };
    this.drawerBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.activeTooltip = '';
    this.tooltipTimer = 0;
    this.editorBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.moveSelection = null;
    this.moveTarget = null;
    this.pendingPointer = null;
    this.longPressTimer = null;
    this.longPressFired = false;
    this.radialMenu = { active: false, x: 0, y: 0, items: [] };
    this.recentTiles = [];
    this.recentEnemies = [];
    this.recentPrefabs = [];
    this.recentShapes = [];
    this.rotation = 0;
    this.playtestPressTimer = null;
    this.playtestPressActive = false;
    this.playtestSpawnOverride = null;
    this.precisionZoom = null;
    this.playButtonBounds = null;
    this.dragSource = null;
    this.panJoystick = {
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0,
      dx: 0,
      dy: 0,
      active: false,
      id: null
    };
    this.zoomSlider = {
      bounds: { x: 0, y: 0, w: 0, h: 0 },
      active: false,
      id: null
    };
    this.gamepadCursor = {
      x: 0,
      y: 0,
      active: false
    };
    this.dragStart = null;
    this.dragTarget = null;
    this.recordRecent('tiles', this.tileType);
    this.recordRecent('enemies', this.enemyType);
    this.recordRecent('prefabs', this.prefabType);
    this.recordRecent('shapes', this.shapeTool);

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.game.applyWorldData(data);
          this.resetView();
        } catch (error) {
          console.error('Failed to load world data:', error);
        }
      };
      reader.readAsText(file);
      this.fileInput.value = '';
    });

    window.addEventListener('keydown', (event) => {
      if (!this.active) return;
      const codes = ['KeyS', 'KeyL', 'KeyZ', 'KeyY', 'KeyP'];
      if (event.ctrlKey || codes.includes(event.code)) {
        event.preventDefault();
      }
    });
  }

  activate() {
    this.active = true;
    this.resetView();
    this.restorePlaytestSpawn();
  }

  deactivate() {
    this.active = false;
    this.dragging = false;
    this.dragMode = null;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.moveSelection = null;
    this.moveTarget = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.dragSource = null;
    this.gamepadCursor.active = false;
  }

  resetView() {
    const { canvas } = this.game;
    const focus = this.game.player || { x: 0, y: 0 };
    this.zoom = 1;
    this.camera.x = Math.max(0, focus.x - canvas.width / 2);
    this.camera.y = Math.max(0, focus.y - canvas.height / 2);
  }

  update(input, dt) {
    this.handleKeyboard(input, dt);
    this.handleGamepad(input, dt);
    if (Math.abs(this.panJoystick.dx) > 0.01 || Math.abs(this.panJoystick.dy) > 0.01) {
      const panSpeed = 320 * dt * (1 / this.zoom);
      this.camera.x = Math.max(0, this.camera.x + this.panJoystick.dx * panSpeed);
      this.camera.y = Math.max(0, this.camera.y + this.panJoystick.dy * panSpeed);
    }
    this.updateHover();
    if (this.tooltipTimer > 0) {
      this.tooltipTimer = Math.max(0, this.tooltipTimer - dt);
    }
  }

  handleKeyboard(input, dt = 0) {
    if (input.wasPressedCode('KeyQ')) {
      this.mode = 'tile';
      this.tileTool = 'paint';
    }
    if (input.wasPressedCode('KeyE')) {
      this.mode = 'tile';
      this.tileTool = 'erase';
    }
    if (input.wasPressedCode('KeyM')) {
      this.mode = 'tile';
      this.tileTool = 'move';
    }
    if (input.wasPressedCode('KeyT')) this.mode = 'enemy';
    if (input.wasPressedCode('KeyR')) this.mode = 'prefab';
    if (input.wasPressedCode('KeyG')) this.mode = 'shape';

    for (let i = 1; i <= 9; i += 1) {
      if (input.wasPressedCode(`Digit${i}`)) {
        const type = DEFAULT_TILE_TYPES[i - 1];
        if (type) {
          this.setTileType(type);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      }
    }

    if (input.wasPressedCode('KeyS')) {
      this.saveToFile();
    }
    if (input.wasPressedCode('KeyL')) {
      this.openFileDialog();
    }
    if (input.wasPressedCode('KeyP')) {
      this.game.exitEditor({ playtest: true });
    }

    if (input.wasPressedCode('Escape')) {
      this.game.exitEditor({ playtest: false });
    }

    if ((input.isDownCode('ControlLeft') || input.isDownCode('ControlRight')) && input.wasPressedCode('KeyZ')) {
      this.undo();
    }
    if ((input.isDownCode('ControlLeft') || input.isDownCode('ControlRight')) && input.wasPressedCode('KeyY')) {
      this.redo();
    }

    const panSpeed = 320 * dt * (1 / this.zoom);
    if (!input.isShiftDown()) {
      if (input.isDownCode('ArrowLeft')) this.camera.x = Math.max(0, this.camera.x - panSpeed);
      if (input.isDownCode('ArrowRight')) this.camera.x = Math.max(0, this.camera.x + panSpeed);
      if (input.isDownCode('ArrowUp')) this.camera.y = Math.max(0, this.camera.y - panSpeed);
      if (input.isDownCode('ArrowDown')) this.camera.y = Math.max(0, this.camera.y + panSpeed);
    } else {
      if (input.isDownCode('ArrowUp')) this.adjustZoom(0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
      if (input.isDownCode('ArrowDown')) this.adjustZoom(-0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
    }
  }

  handleGamepad(input, dt) {
    if (!input.isGamepadConnected()) {
      if (this.dragging && this.dragSource === 'gamepad') {
        this.endStroke();
      }
      this.gamepadCursor.active = false;
      return;
    }

    if (!this.gamepadCursor.active) {
      const centerX = this.game.canvas.width / 2;
      const centerY = this.game.canvas.height / 2;
      const worldCenter = this.screenToWorld(centerX, centerY);
      this.gamepadCursor = { x: worldCenter.x, y: worldCenter.y, active: true };
      this.lastPointer = { x: centerX, y: centerY };
    }

    const axes = input.getGamepadAxes();
    const tileSize = this.game.world.tileSize;
    const moveSpeed = 420 * dt * (1 / this.zoom);
    const panSpeed = 320 * dt * (1 / this.zoom);
    const deadzone = 0.18;
    const stickX = Math.abs(axes.leftX) > deadzone ? axes.leftX : 0;
    const stickY = Math.abs(axes.leftY) > deadzone ? axes.leftY : 0;
    const lookX = Math.abs(axes.rightX) > deadzone ? axes.rightX : 0;
    const lookY = Math.abs(axes.rightY) > deadzone ? axes.rightY : 0;

    this.gamepadCursor.x += stickX * moveSpeed;
    this.gamepadCursor.y += stickY * moveSpeed;

    if (stickX === 0 && stickY === 0) {
      const digitalSpeed = tileSize * 6 * dt;
      if (input.isGamepadDown('left')) this.gamepadCursor.x -= digitalSpeed;
      if (input.isGamepadDown('right')) this.gamepadCursor.x += digitalSpeed;
      if (input.isGamepadDown('up')) this.gamepadCursor.y -= digitalSpeed;
      if (input.isGamepadDown('down')) this.gamepadCursor.y += digitalSpeed;
    }

    if (lookX !== 0 || lookY !== 0) {
      this.camera.x = Math.max(0, this.camera.x + lookX * panSpeed);
      this.camera.y = Math.max(0, this.camera.y + lookY * panSpeed);
    }

    const zoomDelta = (axes.rightTrigger - axes.leftTrigger) * dt * 1.4;
    if (Math.abs(zoomDelta) > 0.0001) {
      this.setZoom(this.zoom + zoomDelta, this.lastPointer.x, this.lastPointer.y);
    }

    const maxWorldX = this.game.world.width * tileSize - 1;
    const maxWorldY = this.game.world.height * tileSize - 1;
    this.gamepadCursor.x = clamp(this.gamepadCursor.x, 0, maxWorldX);
    this.gamepadCursor.y = clamp(this.gamepadCursor.y, 0, maxWorldY);

    this.keepCursorInView();
    const screenPos = this.worldToScreen(this.gamepadCursor.x, this.gamepadCursor.y);
    this.lastPointer = { x: screenPos.x, y: screenPos.y };

    if (input.wasGamepadPressed('throw')) {
      this.cycleMode(1);
    }
    if (input.wasGamepadPressed('dash')) {
      this.cycleTileTool();
    }
    if (input.wasGamepadPressed('flame')) {
      this.cycleSelection(-1);
    }
    if (input.wasGamepadPressed('rev')) {
      this.cycleSelection(1);
    }

    if (input.wasGamepadPressed('pause')) {
      this.game.exitEditor({ playtest: false });
      return;
    }
    if (input.wasGamepadPressed('cancel')) {
      this.startPlaytestFromCursor();
      return;
    }

    const primaryDown = input.isGamepadDown('jump');
    const secondaryDown = input.isGamepadDown('attack');
    const pressPrimary = input.wasGamepadPressed('jump');
    const pressSecondary = input.wasGamepadPressed('attack');

    if (pressPrimary || pressSecondary) {
      if (this.handleUIClick(this.lastPointer.x, this.lastPointer.y)) {
        return;
      }
      if (this.isPointInBounds(this.lastPointer.x, this.lastPointer.y, this.playButtonBounds)) {
        this.game.exitEditor({ playtest: true });
        return;
      }
    }

    if ((pressPrimary || pressSecondary) && (!this.dragging || this.dragSource === 'gamepad')) {
      this.dragButton = pressSecondary ? 2 : 0;
      const { tileX, tileY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
      const dragMode = pressSecondary
        ? (this.mode === 'enemy' ? 'enemy' : 'erase')
        : this.resolveDragMode(this.mode);
      this.beginStroke(dragMode, tileX, tileY, 'gamepad');
    }

    if (this.dragging && this.dragSource === 'gamepad') {
      if (primaryDown || secondaryDown) {
        const { tileX, tileY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
        if (this.dragMode === 'paint' || this.dragMode === 'erase') {
          this.applyPaint(tileX, tileY, this.dragMode);
        }
        if (this.dragMode === 'enemy') {
          const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
          this.applyEnemy(tileX, tileY, paintMode);
        }
        if (this.dragMode === 'move') {
          this.moveTarget = { x: tileX, y: tileY };
        }
        if (this.dragMode === 'shape' || this.dragMode === 'prefab') {
          this.dragTarget = { x: tileX, y: tileY };
        }
      } else {
        this.endStroke();
      }
    }
  }

  keepCursorInView() {
    const margin = 80;
    const viewW = this.game.canvas.width;
    const viewH = this.game.canvas.height;
    const minX = this.camera.x + margin / this.zoom;
    const maxX = this.camera.x + viewW / this.zoom - margin / this.zoom;
    const minY = this.camera.y + margin / this.zoom;
    const maxY = this.camera.y + viewH / this.zoom - margin / this.zoom;
    if (this.gamepadCursor.x < minX) {
      this.camera.x = Math.max(0, this.gamepadCursor.x - margin / this.zoom);
    } else if (this.gamepadCursor.x > maxX) {
      this.camera.x = Math.max(0, this.gamepadCursor.x - viewW / this.zoom + margin / this.zoom);
    }
    if (this.gamepadCursor.y < minY) {
      this.camera.y = Math.max(0, this.gamepadCursor.y - margin / this.zoom);
    } else if (this.gamepadCursor.y > maxY) {
      this.camera.y = Math.max(0, this.gamepadCursor.y - viewH / this.zoom + margin / this.zoom);
    }
  }

  cycleMode(direction) {
    const modes = ['tile', 'enemy', 'prefab', 'shape'];
    const currentIndex = Math.max(0, modes.indexOf(this.mode));
    const nextIndex = (currentIndex + direction + modes.length) % modes.length;
    this.mode = modes[nextIndex];
    if (this.mode === 'tile') {
      this.tileTool = 'paint';
    }
  }

  cycleTileTool() {
    if (this.mode !== 'tile') {
      this.mode = 'tile';
    }
    const tools = ['paint', 'erase', 'move'];
    const currentIndex = Math.max(0, tools.indexOf(this.tileTool));
    this.tileTool = tools[(currentIndex + 1) % tools.length];
  }

  cycleSelection(direction) {
    if (this.mode === 'tile') {
      const tiles = DEFAULT_TILE_TYPES;
      const index = Math.max(0, tiles.findIndex((tile) => tile.id === this.tileType.id));
      const next = tiles[(index + direction + tiles.length) % tiles.length];
      this.setTileType(next);
      this.tileTool = 'paint';
      return;
    }
    if (this.mode === 'enemy') {
      const index = Math.max(0, ENEMY_TYPES.findIndex((enemy) => enemy.id === this.enemyType.id));
      const next = ENEMY_TYPES[(index + direction + ENEMY_TYPES.length) % ENEMY_TYPES.length];
      this.setEnemyType(next);
      return;
    }
    if (this.mode === 'prefab') {
      const index = Math.max(0, PREFAB_TYPES.findIndex((prefab) => prefab.id === this.prefabType.id));
      const next = PREFAB_TYPES[(index + direction + PREFAB_TYPES.length) % PREFAB_TYPES.length];
      this.setPrefabType(next);
      return;
    }
    if (this.mode === 'shape') {
      const index = Math.max(0, SHAPE_TOOLS.findIndex((shape) => shape.id === this.shapeTool.id));
      const next = SHAPE_TOOLS[(index + direction + SHAPE_TOOLS.length) % SHAPE_TOOLS.length];
      this.setShapeTool(next);
    }
  }

  resolveDragMode(mode, tileTool = this.tileTool) {
    if (mode === 'tile') {
      if (tileTool === 'move') return 'move';
      if (tileTool === 'erase') return 'erase';
      return 'paint';
    }
    if (mode === 'enemy') return 'enemy';
    if (mode === 'prefab') return 'prefab';
    if (mode === 'shape') return 'shape';
    return 'paint';
  }

  openFileDialog() {
    this.fileInput.click();
  }

  saveToFile() {
    const data = this.game.buildWorldData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chainsaw-world.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  promptRandomLevel() {
    const currentSize = `${this.game.world.width}x${this.game.world.height}`;
    const input = window.prompt('Enter level size (width x height):', currentSize);
    if (!input) return;
    const size = this.parseLevelSize(input);
    if (!size) {
      this.activeTooltip = 'Invalid size. Use format: width x height (e.g. 96x64).';
      this.tooltipTimer = 2;
      return;
    }
    this.createRandomLevel(size.width, size.height);
  }

  parseLevelSize(value) {
    if (!value) return null;
    const match = value.toLowerCase().match(/(\d+)\s*[x,]\s*(\d+)/);
    if (!match) return null;
    const width = clamp(parseInt(match[1], 10), 48, 256);
    const height = clamp(parseInt(match[2], 10), 48, 256);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height };
  }

  createRandomLevel(width, height) {
    const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));
    const rooms = [];
    const roomPrefabs = PREFAB_TYPES.filter((prefab) => prefab.roomType);
    const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const minRoomWidth = 32;
    const minRoomHeight = 18;
    const maxRoomWidth = Math.min(96, width - 4);
    const maxRoomHeight = Math.min(96, height - 4);

    const setTile = (x, y, char) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      tiles[y][x] = char;
    };

    const carveRectRoom = (room) => {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          const wall = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
          setTile(x, y, wall ? '#' : '.');
        }
      }
    };

    const carveCircularRoom = (room) => {
      const centerX = room.x + room.w / 2;
      const centerY = room.y + room.h / 2;
      const radiusX = Math.max(room.w / 2, 1);
      const radiusY = Math.max(room.h / 2, 1);
      const isInside = (x, y) => {
        const dx = (x + 0.5 - centerX) / radiusX;
        const dy = (y + 0.5 - centerY) / radiusY;
        return dx * dx + dy * dy <= 1;
      };
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          setTile(x, y, wall ? '#' : '.');
        }
      }
    };

    const carveCaveRoom = (room) => {
      const widthSpan = room.w;
      const heightSpan = room.h;
      const maxSideInset = Math.min(2, Math.max(0, Math.floor(widthSpan / 2) - 1));
      const maxBottomInset = Math.min(2, Math.max(0, Math.floor(heightSpan / 2) - 1));
      const leftInsetByRow = [];
      const rightInsetByRow = [];
      const bottomInsetByColumn = [];

      for (let y = 0; y < heightSpan; y += 1) {
        let leftInset = Math.floor(Math.random() * (maxSideInset + 1));
        let rightInset = Math.floor(Math.random() * (maxSideInset + 1));
        if (leftInset + rightInset >= widthSpan - 1) {
          rightInset = Math.max(0, widthSpan - 2 - leftInset);
        }
        leftInsetByRow[y] = leftInset;
        rightInsetByRow[y] = rightInset;
      }

      for (let x = 0; x < widthSpan; x += 1) {
        bottomInsetByColumn[x] = Math.floor(Math.random() * (maxBottomInset + 1));
      }

      for (let y = 0; y < heightSpan; y += 1) {
        const leftEdge = room.x + leftInsetByRow[y];
        const rightEdge = room.x + widthSpan - 1 - rightInsetByRow[y];
        for (let x = room.x; x < room.x + widthSpan; x += 1) {
          const columnIndex = x - room.x;
          const bottomEdge = room.y + heightSpan - 1 - bottomInsetByColumn[columnIndex];
          if (x < leftEdge || x > rightEdge || y + room.y > bottomEdge) continue;
          const wall = x === leftEdge || x === rightEdge || y + room.y === room.y || y + room.y === bottomEdge;
          setTile(x, y + room.y, wall ? '#' : '.');
        }
      }
    };

    const carveTriangleRoom = (room, orientation) => {
      const widthSpan = Math.max(room.w - 1, 1);
      const heightSpan = Math.max(room.h - 1, 1);
      const signX = orientation.x;
      const signY = orientation.y;
      const origin = {
        x: signX > 0 ? room.x : room.x + room.w - 1,
        y: signY > 0 ? room.y : room.y + room.h - 1
      };
      const isInside = (x, y) => {
        const relX = signX * (x - origin.x);
        const relY = signY * (y - origin.y);
        return relX >= 0 && relY >= 0 && (relX / widthSpan + relY / heightSpan <= 1);
      };
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          setTile(x, y, wall ? '#' : '.');
        }
      }
    };

    const roomsOverlap = (room) => rooms.some((other) => (
      room.x - 2 < other.x + other.w
      && room.x + room.w + 2 > other.x
      && room.y - 2 < other.y + other.h
      && room.y + room.h + 2 > other.y
    ));

    const placeRoom = (room) => {
      if (room.x < 1 || room.y < 1 || room.x + room.w >= width - 1 || room.y + room.h >= height - 1) {
        return false;
      }
      if (roomsOverlap(room)) return false;
      room.area = room.w * room.h;
      rooms.push(room);
      return true;
    };

    const findFloorInRoom = (room, attempts = 40) => {
      for (let i = 0; i < attempts; i += 1) {
        const x = randInt(room.x + 1, room.x + room.w - 2);
        const y = randInt(room.y + 1, room.y + room.h - 2);
        if (tiles[y]?.[x] === '.') return { x, y };
      }
      return null;
    };

    const carveCorridor = (start, end) => {
      const widen = (x, y) => {
        setTile(x, y, '.');
        setTile(x + 1, y, '.');
      };
      const carveLine = (x1, y1, x2, y2) => {
        const dx = Math.sign(x2 - x1);
        const dy = Math.sign(y2 - y1);
        let x = x1;
        let y = y1;
        widen(x, y);
        while (x !== x2 || y !== y2) {
          if (x !== x2) x += dx;
          if (y !== y2) y += dy;
          widen(x, y);
        }
      };
      if (Math.random() < 0.5) {
        carveLine(start.x, start.y, end.x, start.y);
        carveLine(end.x, start.y, end.x, end.y);
      } else {
        carveLine(start.x, start.y, start.x, end.y);
        carveLine(start.x, end.y, end.x, end.y);
      }
    };

    const addPillars = (room) => {
      if (room.w < 16 || room.h < 16) return;
      const pillars = randInt(1, 3);
      for (let i = 0; i < pillars; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        setTile(spot.x, spot.y, '#');
      }
    };

    const addPlatform = (room) => {
      if (room.w < 14 || room.h < 10) return;
      const platformY = randInt(room.y + 2, room.y + room.h - 3);
      const platformStart = randInt(room.x + 2, room.x + Math.floor(room.w / 2));
      const platformEnd = randInt(platformStart + 3, room.x + room.w - 3);
      for (let x = platformStart; x <= platformEnd; x += 1) {
        if (tiles[platformY]?.[x] === '.') setTile(x, platformY, '=');
      }
    };

    const addPlatformRun = (room) => {
      if (room.h < 24 || room.w < 18) return;
      const runCount = clamp(Math.floor(room.h / 18), 2, 4);
      for (let i = 0; i < runCount; i += 1) {
        const platformY = randInt(room.y + 2, room.y + room.h - 3);
        const minSpan = Math.max(8, Math.floor(room.w * 0.45));
        const platformStart = randInt(room.x + 2, room.x + room.w - minSpan - 2);
        const platformEnd = randInt(platformStart + minSpan, room.x + room.w - 2);
        for (let x = platformStart; x <= platformEnd; x += 1) {
          if (tiles[platformY]?.[x] === '.') setTile(x, platformY, '=');
        }
      }
    };

    const addStaircase = (room) => {
      if (room.h < 24 || room.w < 12) return;
      const maxSteps = Math.min(room.h - 4, room.w - 4, 18);
      const startLeft = Math.random() < 0.5;
      const stepX = startLeft ? 1 : -1;
      const startX = startLeft ? room.x + 2 : room.x + room.w - 3;
      const startY = room.y + room.h - 3;
      for (let i = 0; i < maxSteps; i += 1) {
        const x = startX + stepX * i;
        const y = startY - i;
        if (tiles[y]?.[x] === '.') setTile(x, y, '=');
      }
    };

    const addTraps = (room) => {
      const traps = clamp(Math.floor(room.area / 180), 1, 4);
      for (let i = 0; i < traps; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        if (spot.x === spawn.x && spot.y === spawn.y) continue;
        setTile(spot.x, spot.y, '!');
      }
    };

    const addTriangleBlocks = (room) => {
      const count = randInt(1, 3);
      const triangleSizes = [
        { w: 1, h: 1 },
        { w: 2, h: 1 },
        { w: 1, h: 2 }
      ];
      for (let i = 0; i < count; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        const size = pickOne(triangleSizes);
        const orientation = pickOne([
          { x: 1, y: 1 },
          { x: -1, y: 1 },
          { x: 1, y: -1 },
          { x: -1, y: -1 }
        ]);
        const origin = {
          x: orientation.x > 0 ? spot.x : spot.x + size.w - 1,
          y: orientation.y > 0 ? spot.y : spot.y + size.h - 1
        };
        const widthSpan = Math.max(size.w - 1, 1);
        const heightSpan = Math.max(size.h - 1, 1);
        for (let y = 0; y < size.h; y += 1) {
          for (let x = 0; x < size.w; x += 1) {
            const tileX = origin.x + orientation.x * x;
            const tileY = origin.y + orientation.y * y;
            const relX = orientation.x * (tileX - origin.x);
            const relY = orientation.y * (tileY - origin.y);
            if (relX / widthSpan + relY / heightSpan <= 1) {
              if (tiles[tileY]?.[tileX] === '.') setTile(tileX, tileY, '#');
            }
          }
        }
      }
    };

    const ensureSpawnRoom = () => {
      const spawnRoomWidth = clamp(32, minRoomWidth, maxRoomWidth);
      const spawnRoomHeight = clamp(18, minRoomHeight, maxRoomHeight);
      const room = {
        x: clamp(spawn.x - Math.floor(spawnRoomWidth / 2), 1, width - spawnRoomWidth - 1),
        y: clamp(spawn.y - Math.floor(spawnRoomHeight / 2), 1, height - spawnRoomHeight - 1),
        w: spawnRoomWidth,
        h: spawnRoomHeight,
        type: 'room'
      };
      room.area = room.w * room.h;
      rooms.push(room);
      carveRectRoom(room);
      return room;
    };

    const addRoomDetails = (room) => {
      addPillars(room);
      if (Math.random() < 0.65) addPlatform(room);
      if (room.h >= 28) {
        addPlatformRun(room);
        addStaircase(room);
      }
      addTraps(room);
      addTriangleBlocks(room);
    };

    const spawnRoom = ensureSpawnRoom();

    const requiredRooms = [
      {
        kind: 'tall',
        wRange: [Math.min(minRoomWidth, maxRoomWidth), Math.min(48, maxRoomWidth)],
        hRange: [Math.min(32, maxRoomHeight), maxRoomHeight]
      },
      {
        kind: 'long',
        wRange: [Math.min(Math.max(48, minRoomWidth), maxRoomWidth), maxRoomWidth],
        hRange: [Math.min(minRoomHeight, maxRoomHeight), Math.min(32, maxRoomHeight)]
      },
      {
        kind: 'triangle',
        wRange: [Math.min(minRoomWidth, maxRoomWidth), Math.min(64, maxRoomWidth)],
        hRange: [Math.min(Math.max(minRoomHeight, 24), maxRoomHeight), Math.min(64, maxRoomHeight)]
      }
    ];

    requiredRooms.forEach((spec) => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const w = randInt(spec.wRange[0], spec.wRange[1]);
        const h = randInt(spec.hRange[0], spec.hRange[1]);
        const room = {
          x: randInt(1, width - w - 2),
          y: randInt(1, height - h - 2),
          w,
          h,
          type: spec.kind
        };
        if (!placeRoom(room)) continue;
        if (spec.kind === 'triangle') {
          carveTriangleRoom(room, pickOne([
            { x: 1, y: 1 },
            { x: -1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: -1 }
          ]));
        } else {
          carveRectRoom(room);
        }
        addRoomDetails(room);
        break;
      }
    });

    const targetRooms = clamp(Math.floor((width * height) / 900), 8, 18);
    let attempts = 0;
    while (rooms.length < targetRooms && attempts < targetRooms * 20) {
      attempts += 1;
      const prefab = pickOne(roomPrefabs);
      const w = randInt(minRoomWidth, maxRoomWidth);
      const h = randInt(minRoomHeight, maxRoomHeight);
      const room = {
        x: randInt(1, width - w - 2),
        y: randInt(1, height - h - 2),
        w,
        h,
        type: prefab.id
      };
      if (!placeRoom(room)) continue;
      if (prefab.id === 'circular') {
        carveCircularRoom(room);
      } else if (prefab.id === 'cave') {
        carveCaveRoom(room);
      } else {
        carveRectRoom(room);
      }
      addRoomDetails(room);
    }

    rooms.forEach((room) => {
      room.center = {
        x: Math.floor(room.x + room.w / 2),
        y: Math.floor(room.y + room.h / 2)
      };
      room.area = room.w * room.h;
    });

    const maxCorridorLength = 10;
    const maxCorridorDistance = maxCorridorLength;
    const linkedPairs = new Set();
    const pairKey = (a, b) => {
      const left = Math.min(a, b);
      const right = Math.max(a, b);
      return `${left}:${right}`;
    };
    const roomDistance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    rooms.forEach((room, index) => {
      let closest = null;
      let closestIndex = -1;
      let closestDist = Infinity;
      rooms.forEach((candidate, candidateIndex) => {
        if (candidate === room) return;
        const dist = roomDistance(room.center, candidate.center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = candidate;
          closestIndex = candidateIndex;
        }
      });
      if (!closest || closestDist > maxCorridorDistance) return;
      const key = pairKey(index, closestIndex);
      if (linkedPairs.has(key)) return;
      linkedPairs.add(key);
      carveCorridor(room.center, closest.center);
    });

    setTile(spawn.x, spawn.y, '.');

    const enemies = [];
    const difficultyOrder = ['practice', 'skitter', 'spitter', 'bulwark', 'floater', 'slicer', 'hivenode', 'sentinel'];
    const maxDist = Math.hypot(width / 2, height / 2) || 1;
    rooms.forEach((room) => {
      if (room === spawnRoom) return;
      const enemyCount = clamp(Math.floor(room.area / 220), 1, 5);
      const distance = Math.hypot(room.center.x - spawn.x, room.center.y - spawn.y);
      const ratio = clamp(distance / maxDist, 0, 1);
      const baseIndex = Math.floor(ratio * (difficultyOrder.length - 1));
      for (let i = 0; i < enemyCount; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        const index = clamp(baseIndex + randInt(0, 1), 0, difficultyOrder.length - 1);
        enemies.push({ x: spot.x, y: spot.y, type: difficultyOrder[index] });
      }
    });

    const regions = [];
    const cols = 3;
    const rows = 2;
    const regionWidth = Math.floor(width / cols);
    const regionHeight = Math.floor(height / rows);
    BIOME_THEMES.forEach((theme, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * regionWidth;
      const y = row * regionHeight;
      const w = col === cols - 1 ? width - x : regionWidth;
      const h = row === rows - 1 ? height - y : regionHeight;
      regions.push({
        id: theme.id,
        name: theme.name,
        color: theme.color,
        rect: [x, y, w, h]
      });
    });

    const data = {
      schemaVersion: 1,
      tileSize: this.game.world.tileSize,
      width,
      height,
      spawn,
      tiles: tiles.map((row) => row.join('')),
      regions,
      enemies
    };

    this.game.applyWorldData(data);
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.resetView();
  }

  undo() {
    const action = this.undoStack.pop();
    if (!action) return;
    this.applyAction(action, 'undo');
    this.redoStack.push(action);
  }

  redo() {
    const action = this.redoStack.pop();
    if (!action) return;
    this.applyAction(action, 'redo');
    this.undoStack.push(action);
  }

  applyAction(action, direction) {
    const applyTiles = direction === 'undo'
      ? action.tiles.map((tile) => ({ x: tile.x, y: tile.y, char: tile.prev }))
      : action.tiles.map((tile) => ({ x: tile.x, y: tile.y, char: tile.next }));

    applyTiles.forEach((tile) => {
      this.game.world.setTile(tile.x, tile.y, tile.char);
    });

    if (action.spawn) {
      const spawn = direction === 'undo' ? action.spawn.prev : action.spawn.next;
      if (spawn) {
        this.game.world.setSpawnTile(spawn.x, spawn.y);
      }
    }

    if (action.enemies) {
      const changes = direction === 'undo'
        ? action.enemies.map((enemy) => ({ x: enemy.x, y: enemy.y, type: enemy.prev }))
        : action.enemies.map((enemy) => ({ x: enemy.x, y: enemy.y, type: enemy.next }));
      changes.forEach((enemy) => {
        if (enemy.type) {
          this.game.world.setEnemy(enemy.x, enemy.y, enemy.type);
        } else {
          this.game.world.removeEnemy(enemy.x, enemy.y);
        }
      });
    }

    this.game.refreshWorldCaches();
  }

  beginStroke(mode, tileX, tileY, source = 'pointer') {
    this.dragging = true;
    this.dragMode = mode;
    this.dragSource = source;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.moveSelection = null;
    this.moveTarget = null;
    if (mode === 'pan') {
      this.panStart = { x: this.lastPointer.x, y: this.lastPointer.y, camX: this.camera.x, camY: this.camera.y };
      return;
    }
    if (mode === 'zoom') {
      this.zoomStart = {
        x: this.lastPointer.x,
        y: this.lastPointer.y,
        zoom: this.zoom
      };
      return;
    }
    if (mode === 'move') {
      const selection = this.pickMoveSelection(tileX, tileY);
      if (selection) {
        this.moveSelection = selection;
        this.moveTarget = { x: tileX, y: tileY };
        return;
      }
      this.panStart = { x: this.lastPointer.x, y: this.lastPointer.y, camX: this.camera.x, camY: this.camera.y };
      this.dragMode = 'pan';
      return;
    }
    if (mode === 'shape' || mode === 'prefab') {
      this.dragStart = { x: tileX, y: tileY };
      this.dragTarget = { x: tileX, y: tileY };
      return;
    }
    if (mode === 'enemy') {
      const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
      this.applyEnemy(tileX, tileY, paintMode);
      return;
    }
    this.applyPaint(tileX, tileY, mode);
  }

  endStroke() {
    if (!this.dragging) return;
    if (this.dragMode === 'pan') {
      this.dragging = false;
      this.dragMode = null;
      this.panStart = null;
      this.endPrecisionZoom();
      return;
    }
    if (this.dragMode === 'zoom') {
      this.dragging = false;
      this.dragMode = null;
      this.zoomStart = null;
      this.endPrecisionZoom();
      return;
    }
    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      this.applyMove(this.moveTarget.x, this.moveTarget.y);
    }
    if (this.dragMode === 'shape' && this.dragStart && this.dragTarget) {
      this.applyShape(this.dragStart, this.dragTarget);
    }
    if (this.dragMode === 'prefab' && this.dragStart && this.dragTarget) {
      this.applyPrefab(this.dragStart, this.dragTarget);
    }

    const tiles = Array.from(this.pendingChanges.values());
    const enemies = Array.from(this.pendingEnemies.values());
    if (tiles.length > 0 || this.pendingSpawn || enemies.length > 0) {
      const action = {
        tiles,
        spawn: this.pendingSpawn,
        enemies
      };
      this.undoStack.push(action);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.game.refreshWorldCaches();
    }
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.dragging = false;
    this.dragMode = null;
    this.dragButton = null;
    this.dragSource = null;
    this.zoomStart = null;
    this.moveSelection = null;
    this.moveTarget = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.endPrecisionZoom();
  }

  handlePointerDown(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.isPointInBounds(payload.x, payload.y, this.playButtonBounds)) {
      this.playtestPressActive = true;
      if (this.playtestPressTimer) {
        clearTimeout(this.playtestPressTimer);
      }
      this.playtestPressTimer = setTimeout(() => {
        this.playtestPressTimer = null;
        if (this.playtestPressActive) {
          this.playtestPressActive = false;
          this.startPlaytestFromCursor();
        }
      }, 450);
      return;
    }

    if (this.isPointInCircle(payload.x, payload.y, this.panJoystick.center, this.panJoystick.radius * 1.2)) {
      this.panJoystick.active = true;
      this.panJoystick.id = payload.id ?? null;
      this.updatePanJoystick(payload.x, payload.y);
      return;
    }

    if (this.isPointInBounds(payload.x, payload.y, this.zoomSlider.bounds)) {
      this.zoomSlider.active = true;
      this.zoomSlider.id = payload.id ?? null;
      this.updateZoomFromSlider(payload.x);
      return;
    }

    if (this.radialMenu.active) {
      if (this.handleUIClick(payload.x, payload.y)) return;
      this.closeRadialMenu();
      return;
    }

    if (this.handleUIClick(payload.x, payload.y)) return;

    if (this.isMobileLayout() && this.isPointInBounds(payload.x, payload.y, this.drawerBounds)) {
      this.drawer.swipeStart = { x: payload.x, y: payload.y };
      return;
    }

    if (this.isMobileLayout()) {
      if (!this.isPointerInEditorArea(payload.x, payload.y)) return;
      const { tileX, tileY } = this.screenToTile(payload.x, payload.y);
      this.pendingPointer = {
        x: payload.x,
        y: payload.y,
        tileX,
        tileY,
        mode: this.mode,
        tileTool: this.tileTool,
        shapeTool: this.shapeTool,
        prefabType: this.prefabType
      };
      this.longPressFired = false;
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        if (!this.pendingPointer) return;
        this.longPressFired = true;
        this.openRadialMenu(this.pendingPointer.x, this.pendingPointer.y);
        this.pendingPointer = null;
      }, 520);
      return;
    }

    this.dragButton = payload.button;
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (payload.button === 1 || (payload.button === 0 && this.game.input.isDownCode('Space'))) {
      this.beginStroke('pan', tileX, tileY);
      return;
    }

    if (payload.button === 2) {
      if (this.mode === 'enemy') {
        this.beginStroke('enemy', tileX, tileY);
      } else {
        this.mode = 'tile';
        this.tileTool = 'erase';
        this.beginStroke('erase', tileX, tileY);
      }
      return;
    }

    const dragMode = this.resolveDragMode(this.mode);
    if (dragMode === 'move' || dragMode === 'erase' || dragMode === 'enemy' || dragMode === 'prefab' || dragMode === 'shape') {
      this.beginStroke(dragMode, tileX, tileY);
      return;
    }

    this.mode = 'tile';
    this.tileTool = 'paint';
    this.beginStroke('paint', tileX, tileY);
  }

  handlePointerMove(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
      this.updatePanJoystick(payload.x, payload.y);
      return;
    }
    if (this.zoomSlider.active && (payload.id === undefined || this.zoomSlider.id === payload.id)) {
      this.updateZoomFromSlider(payload.x);
      return;
    }
    if (this.isMobileLayout() && this.drawer.swipeStart) {
      const dx = payload.x - this.drawer.swipeStart.x;
      const dy = payload.y - this.drawer.swipeStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
        const direction = dx > 0 ? -1 : 1;
        const nextIndex = (this.drawer.tabIndex + direction + this.drawer.tabs.length) % this.drawer.tabs.length;
        this.drawer.tabIndex = nextIndex;
        this.drawer.swipeStart = null;
      }
      return;
    }

    if (this.isMobileLayout() && this.pendingPointer) {
      const dx = payload.x - this.pendingPointer.x;
      const dy = payload.y - this.pendingPointer.y;
      if (Math.hypot(dx, dy) > 10) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        const { tileX, tileY } = this.screenToTile(this.pendingPointer.x, this.pendingPointer.y);
        this.dragButton = 0;
        const dragMode = this.resolveDragMode(this.pendingPointer.mode, this.pendingPointer.tileTool);
        if (this.pendingPointer.shapeTool) {
          this.shapeTool = this.pendingPointer.shapeTool;
        }
        if (this.pendingPointer.prefabType) {
          this.prefabType = this.pendingPointer.prefabType;
        }
        this.beginStroke(dragMode, tileX, tileY);
        if (['paint', 'erase', 'enemy'].includes(dragMode)) {
          this.startPrecisionZoom();
        }
        this.pendingPointer = null;
      } else {
        return;
      }
    }

    if (this.isMobileLayout() && !this.isPointerInEditorArea(payload.x, payload.y) && !this.dragging) return;
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (!this.dragging) return;

    if (this.dragMode === 'pan' && this.panStart) {
      const dx = (payload.x - this.panStart.x) / this.zoom;
      const dy = (payload.y - this.panStart.y) / this.zoom;
      this.camera.x = Math.max(0, this.panStart.camX - dx);
      this.camera.y = Math.max(0, this.panStart.camY - dy);
      return;
    }

    if (this.dragMode === 'zoom' && this.zoomStart) {
      const dy = payload.y - this.zoomStart.y;
      const factor = 1 - dy * 0.005;
      this.setZoom(this.zoomStart.zoom * factor, this.zoomStart.x, this.zoomStart.y);
      return;
    }

    if (this.dragMode === 'move') {
      this.moveTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.dragMode === 'shape' || this.dragMode === 'prefab') {
      this.dragTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.dragMode === 'paint' || this.dragMode === 'erase') {
      this.applyPaint(tileX, tileY, this.dragMode);
    }

    if (this.dragMode === 'enemy') {
      const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
      this.applyEnemy(tileX, tileY, paintMode);
    }
  }

  handlePointerUp(payload = {}) {
    if (!this.active) return;
    if (this.playtestPressActive) {
      this.playtestPressActive = false;
      if (this.playtestPressTimer) {
        clearTimeout(this.playtestPressTimer);
        this.playtestPressTimer = null;
        this.game.exitEditor({ playtest: true });
      }
      return;
    }

    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
      this.panJoystick.active = false;
      this.panJoystick.id = null;
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }

    if (this.zoomSlider.active && (payload.id === undefined || this.zoomSlider.id === payload.id)) {
      this.zoomSlider.active = false;
      this.zoomSlider.id = null;
      return;
    }

    if (this.drawer.swipeStart) {
      this.drawer.swipeStart = null;
    }

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.pendingPointer) {
      const { tileX, tileY } = this.screenToTile(this.pendingPointer.x, this.pendingPointer.y);
      if (!this.longPressFired) {
        const dragMode = this.resolveDragMode(this.pendingPointer.mode, this.pendingPointer.tileTool);
        if (this.pendingPointer.shapeTool) {
          this.shapeTool = this.pendingPointer.shapeTool;
        }
        if (this.pendingPointer.prefabType) {
          this.prefabType = this.pendingPointer.prefabType;
        }
        this.beginStroke(dragMode, tileX, tileY);
        this.endStroke();
      }
      this.pendingPointer = null;
      return;
    }

    this.endStroke();
  }

  handleGestureStart(payload) {
    if (!this.active) return;
    this.dragging = false;
    this.dragMode = null;
    this.panStart = null;
    this.zoomStart = null;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.pendingPointer = null;
    this.gestureStart = {
      x: payload.x,
      y: payload.y,
      camX: this.camera.x,
      camY: this.camera.y,
      zoom: this.zoom,
      distance: payload.distance
    };
  }

  handleGestureMove(payload) {
    if (!this.active || !this.gestureStart) return;
    const zoomFactor = payload.distance / this.gestureStart.distance;
    this.setZoom(this.gestureStart.zoom * zoomFactor, payload.x, payload.y);
    const dx = (payload.x - this.gestureStart.x) / this.zoom;
    const dy = (payload.y - this.gestureStart.y) / this.zoom;
    this.camera.x = Math.max(0, this.gestureStart.camX - dx);
    this.camera.y = Math.max(0, this.gestureStart.camY - dy);
  }

  handleGestureEnd() {
    if (!this.active) return;
    this.gestureStart = null;
  }

  handleWheel(payload) {
    if (!this.active) return;
    const zoomFactor = payload.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * zoomFactor, payload.x, payload.y);
  }

  addUIButton(bounds, onClick, tooltip = '') {
    this.uiButtons.push({ ...bounds, onClick, tooltip });
  }

  handleUIClick(x, y) {
    for (const button of this.uiButtons) {
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
        button.onClick();
        if (button.tooltip) {
          this.activeTooltip = button.tooltip;
          this.tooltipTimer = 3;
        }
        return true;
      }
    }
    return false;
  }

  isPointInBounds(x, y, bounds) {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  isPointInCircle(x, y, center, radius) {
    const dx = x - center.x;
    const dy = y - center.y;
    return Math.hypot(dx, dy) <= radius;
  }

  updatePanJoystick(x, y) {
    const { center, radius } = this.panJoystick;
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.01) {
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    const clamped = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    const scaled = clamped / radius;
    this.panJoystick.dx = Math.cos(angle) * scaled;
    this.panJoystick.dy = Math.sin(angle) * scaled;
  }

  updateZoomFromSlider(x) {
    const { bounds } = this.zoomSlider;
    if (!bounds || bounds.w <= 0) return;
    const t = Math.min(1, Math.max(0, (x - bounds.x) / bounds.w));
    const minZoom = 0.5;
    const maxZoom = 3;
    const nextZoom = minZoom + (maxZoom - minZoom) * t;
    this.setZoom(nextZoom, this.game.canvas.width / 2, this.game.canvas.height / 2);
  }

  setTileType(tile) {
    this.tileType = tile;
    this.customTile = null;
    this.recordRecent('tiles', tile);
  }

  setEnemyType(enemy) {
    this.enemyType = enemy;
    this.recordRecent('enemies', enemy);
  }

  setShapeTool(tool) {
    this.shapeTool = tool;
    this.recordRecent('shapes', tool);
  }

  setPrefabType(prefab) {
    this.prefabType = prefab;
    this.recordRecent('prefabs', prefab);
  }

  recordRecent(kind, item) {
    const listMap = {
      tiles: this.recentTiles,
      enemies: this.recentEnemies,
      prefabs: this.recentPrefabs,
      shapes: this.recentShapes
    };
    const list = listMap[kind] || [];
    const next = [item, ...list.filter((entry) => entry.id !== item.id)];
    const trimmed = next.slice(0, 6);
    if (kind === 'tiles') {
      this.recentTiles = trimmed;
    } else {
      if (kind === 'enemies') {
        this.recentEnemies = trimmed;
      } else if (kind === 'prefabs') {
        this.recentPrefabs = trimmed;
      } else if (kind === 'shapes') {
        this.recentShapes = trimmed;
      }
    }
  }

  openRadialMenu(x, y) {
    const items = [];
    this.recentTiles.slice(0, 3).forEach((tile) => {
      items.push({
        id: `tile-${tile.id}`,
        label: tile.char ? tile.char.toUpperCase() : 'SP',
        tooltip: tile.label,
        action: () => {
          this.setTileType(tile);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      });
    });
    this.recentEnemies.slice(0, 2).forEach((enemy) => {
      items.push({
        id: `enemy-${enemy.id}`,
        label: enemy.glyph,
        tooltip: enemy.label,
        action: () => {
          this.setEnemyType(enemy);
          this.mode = 'enemy';
        }
      });
    });
    this.recentPrefabs.slice(0, 2).forEach((prefab) => {
      items.push({
        id: `prefab-${prefab.id}`,
        label: prefab.short || 'PF',
        tooltip: `Prefab: ${prefab.label}`,
        action: () => {
          this.setPrefabType(prefab);
          this.mode = 'prefab';
        }
      });
    });
    this.recentShapes.slice(0, 2).forEach((shape) => {
      items.push({
        id: `shape-${shape.id}`,
        label: shape.short || 'SH',
        tooltip: `Shape: ${shape.label}`,
        action: () => {
          this.setShapeTool(shape);
          this.mode = 'shape';
        }
      });
    });
    items.push({
      id: 'quick-erase',
      label: 'ER',
      tooltip: 'Erase',
      action: () => {
        this.mode = 'tile';
        this.tileTool = 'erase';
      }
    });
    items.push({
      id: 'quick-rotate',
      label: '⟳',
      tooltip: 'Rotate',
      action: () => {
        this.rotation = (this.rotation + 90) % 360;
        this.activeTooltip = `Rotation: ${this.rotation}°`;
        this.tooltipTimer = 2;
      }
    });

    this.radialMenu = { active: true, x, y, items };
  }

  closeRadialMenu() {
    this.radialMenu = { active: false, x: 0, y: 0, items: [] };
  }

  triggerHaptic() {
    if (!this.isMobileLayout()) return;
    if (navigator?.vibrate) {
      navigator.vibrate(12);
    }
  }

  startPrecisionZoom() {
    if (!this.isMobileLayout()) return;
    if (this.precisionZoom) return;
    if (this.zoom >= 1.3) return;
    this.precisionZoom = { previous: this.zoom };
    this.setZoom(1.4, this.lastPointer.x, this.lastPointer.y);
  }

  endPrecisionZoom() {
    if (!this.precisionZoom) return;
    const previous = this.precisionZoom.previous;
    this.precisionZoom = null;
    this.setZoom(previous, this.lastPointer.x, this.lastPointer.y);
  }

  startPlaytestFromCursor() {
    const hover = this.hoverTile;
    if (!hover) return;
    const previous = this.game.world.spawn ? { ...this.game.world.spawn } : null;
    this.playtestSpawnOverride = previous;
    const ensured = this.ensureInBounds(hover.x, hover.y);
    if (ensured) {
      this.game.world.setSpawnTile(ensured.tileX, ensured.tileY);
    }
    this.game.exitEditor({ playtest: true });
  }

  restorePlaytestSpawn() {
    if (!this.playtestSpawnOverride) return;
    const previous = this.playtestSpawnOverride;
    this.playtestSpawnOverride = null;
    if (previous) {
      this.game.world.setSpawnTile(previous.x, previous.y);
    }
  }

  applyPaint(tileX, tileY, mode) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured) return;
    const { tileX: safeX, tileY: safeY } = ensured;

    if (mode === 'erase') {
      this.setTile(safeX, safeY, '.');
      return;
    }

    if (this.tileType.special === 'spawn') {
      this.setSpawn(safeX, safeY);
      return;
    }

    const char = this.tileType.char || '.';
    this.setTile(safeX, safeY, char);
  }

  getDragBounds(start, end) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    return {
      x1,
      x2,
      y1,
      y2,
      width: x2 - x1 + 1,
      height: y2 - y1 + 1
    };
  }

  buildShapeTiles(start, end, char) {
    const tool = this.shapeTool;
    const bounds = this.getDragBounds(start, end);
    const tiles = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;
    const widthSpan = Math.max(bounds.width - 1, 1);
    const heightSpan = Math.max(bounds.height - 1, 1);

    if (tool.id === 'rect') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y, char });
        }
      }
    } else if (tool.id === 'hollow') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          if (x === bounds.x1 || x === bounds.x2 || y === bounds.y1 || y === bounds.y2) {
            tiles.push({ x, y, char });
          }
        }
      }
    } else if (tool.id === 'line') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y: start.y, char });
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          tiles.push({ x: start.x, y, char });
        }
      }
    } else if (tool.id === 'stair') {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i += 1) {
        const x = start.x + signX * i;
        const y = start.y + signY * i;
        tiles.push({ x, y, char });
      }
    } else if (tool.id === 'triangle') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const relX = signX * (x - start.x);
          const relY = signY * (y - start.y);
          if (relX >= 0 && relY >= 0 && (relX / widthSpan + relY / heightSpan <= 1)) {
            tiles.push({ x, y, char });
          }
        }
      }
    } else if (tool.id === 'triangle-1x1' || tool.id === 'triangle-2x1' || tool.id === 'triangle-1x2') {
      const sizeMap = {
        'triangle-1x1': { w: 1, h: 1 },
        'triangle-2x1': { w: 2, h: 1 },
        'triangle-1x2': { w: 1, h: 2 }
      };
      const size = sizeMap[tool.id];
      const widthSpanFixed = Math.max(size.w - 1, 1);
      const heightSpanFixed = Math.max(size.h - 1, 1);
      const target = {
        x: start.x + signX * (size.w - 1),
        y: start.y + signY * (size.h - 1)
      };
      const fixedBounds = this.getDragBounds(start, target);
      for (let y = fixedBounds.y1; y <= fixedBounds.y2; y += 1) {
        for (let x = fixedBounds.x1; x <= fixedBounds.x2; x += 1) {
          const relX = signX * (x - start.x);
          const relY = signY * (y - start.y);
          if (relX >= 0 && relY >= 0 && (relX / widthSpanFixed + relY / heightSpanFixed <= 1)) {
            tiles.push({ x, y, char });
          }
        }
      }
    }
    return tiles;
  }

  buildPrefabTiles(start, end) {
    const bounds = this.getDragBounds(start, end);
    const tiles = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;

    if (this.prefabType.id === 'room' || this.prefabType.id === 'arena') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const wall = x === bounds.x1 || x === bounds.x2 || y === bounds.y1 || y === bounds.y2;
          tiles.push({ x, y, char: wall ? '#' : '.' });
        }
      }
    } else if (this.prefabType.id === 'circular') {
      const centerX = (bounds.x1 + bounds.x2) / 2;
      const centerY = (bounds.y1 + bounds.y2) / 2;
      const radiusX = Math.max((bounds.x2 - bounds.x1) / 2, 1);
      const radiusY = Math.max((bounds.y2 - bounds.y1) / 2, 1);
      const isInside = (x, y) => {
        const dxNorm = (x - centerX) / radiusX;
        const dyNorm = (y - centerY) / radiusY;
        return dxNorm * dxNorm + dyNorm * dyNorm <= 1;
      };

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          tiles.push({ x, y, char: wall ? '#' : '.' });
        }
      }
    } else if (this.prefabType.id === 'cave') {
      const width = bounds.x2 - bounds.x1 + 1;
      const height = bounds.y2 - bounds.y1 + 1;
      const maxSideInset = Math.min(2, Math.max(0, Math.floor(width / 2) - 1));
      const maxBottomInset = Math.min(2, Math.max(0, Math.floor(height / 2) - 1));
      const leftInsetByRow = [];
      const rightInsetByRow = [];
      const bottomInsetByColumn = [];

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        const rowIndex = y - bounds.y1;
        let leftInset = Math.floor(Math.random() * (maxSideInset + 1));
        let rightInset = Math.floor(Math.random() * (maxSideInset + 1));
        if (leftInset + rightInset >= width - 1) {
          rightInset = Math.max(0, width - 2 - leftInset);
        }
        leftInsetByRow[rowIndex] = leftInset;
        rightInsetByRow[rowIndex] = rightInset;
      }

      for (let x = bounds.x1; x <= bounds.x2; x += 1) {
        const columnIndex = x - bounds.x1;
        bottomInsetByColumn[columnIndex] = Math.floor(Math.random() * (maxBottomInset + 1));
      }

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        const rowIndex = y - bounds.y1;
        const leftEdge = bounds.x1 + leftInsetByRow[rowIndex];
        const rightEdge = bounds.x2 - rightInsetByRow[rowIndex];
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const columnIndex = x - bounds.x1;
          const bottomEdge = bounds.y2 - bottomInsetByColumn[columnIndex];
          if (x < leftEdge || x > rightEdge || y > bottomEdge) continue;
          const wall = x === leftEdge || x === rightEdge || y === bounds.y1 || y === bottomEdge;
          tiles.push({ x, y, char: wall ? '#' : '.' });
        }
      }
    } else if (this.prefabType.id === 'corridor') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y: start.y, char: '.' });
          tiles.push({ x, y: start.y + signY, char: '.' });
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          tiles.push({ x: start.x, y, char: '.' });
          tiles.push({ x: start.x + signX, y, char: '.' });
        }
      }
    } else if (this.prefabType.id === 'staircase') {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i += 1) {
        tiles.push({ x: start.x + signX * i, y: start.y + signY * i, char: '#' });
      }
    } else if (this.prefabType.id === 'platform') {
      for (let x = bounds.x1; x <= bounds.x2; x += 1) {
        tiles.push({ x, y: start.y, char: '=' });
      }
    } else if (this.prefabType.id === 'puzzle') {
      const switchTile = { x: start.x, y: start.y, char: 'T' };
      const doorTile = { x: end.x, y: end.y, char: 'B' };
      tiles.push(switchTile, doorTile);
      if (Math.abs(dx) >= Math.abs(dy)) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        for (let x = minX + 1; x < maxX; x += 1) {
          tiles.push({ x, y: start.y, char: 'a' });
        }
      } else {
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        for (let y = minY + 1; y < maxY; y += 1) {
          tiles.push({ x: start.x, y, char: 'a' });
        }
      }
    }
    return tiles;
  }

  applyShape(start, end) {
    const char = this.tileType.char || '.';
    const tiles = this.buildShapeTiles(start, end, char);
    tiles.forEach((tile) => {
      const ensured = this.ensureInBounds(tile.x, tile.y);
      if (!ensured) return;
      this.setTile(ensured.tileX, ensured.tileY, tile.char);
    });
    if (this.shapeTool.placeholder) {
      this.activeTooltip = `${this.shapeTool.label}: tile art pending`;
      this.tooltipTimer = 2;
    }
  }

  applyPrefab(start, end) {
    const tiles = this.buildPrefabTiles(start, end);
    tiles.forEach((tile) => {
      const ensured = this.ensureInBounds(tile.x, tile.y);
      if (!ensured) return;
      this.setTile(ensured.tileX, ensured.tileY, tile.char);
    });
  }

  setTile(tileX, tileY, char) {
    const key = `${tileX},${tileY}`;
    const prev = this.game.world.getTile(tileX, tileY);
    if (prev === char) return;
    this.game.world.setTile(tileX, tileY, char);
    this.triggerHaptic();

    if (!this.pendingChanges.has(key)) {
      this.pendingChanges.set(key, { x: tileX, y: tileY, prev, next: char });
    } else {
      const entry = this.pendingChanges.get(key);
      entry.next = char;
    }
  }

  setSpawn(tileX, tileY) {
    const prev = this.game.world.spawn || null;
    this.game.world.setSpawnTile(tileX, tileY);
    this.triggerHaptic();
    if (!this.pendingSpawn) {
      this.pendingSpawn = {
        prev,
        next: { x: tileX, y: tileY }
      };
    } else {
      this.pendingSpawn.next = { x: tileX, y: tileY };
    }
  }

  ensureInBounds(tileX, tileY) {
    if (this.isInBounds(tileX, tileY)) {
      return { tileX, tileY };
    }
    const { offsetX, offsetY } = this.game.world.expandToInclude(tileX, tileY);
    if (offsetX || offsetY) {
      const tileSize = this.game.world.tileSize;
      this.camera.x += offsetX * tileSize;
      this.camera.y += offsetY * tileSize;
    }
    return { tileX: tileX + offsetX, tileY: tileY + offsetY };
  }

  recordEnemyChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingEnemies.has(key)) {
      this.pendingEnemies.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingEnemies.get(key);
      entry.next = next;
    }
  }

  setEnemy(tileX, tileY, type) {
    const prev = this.game.world.enemyAt(tileX, tileY);
    if (prev?.type === type) return;
    this.game.world.setEnemy(tileX, tileY, type);
    this.triggerHaptic();
    this.recordEnemyChange(tileX, tileY, prev?.type || null, type);
  }

  removeEnemy(tileX, tileY) {
    const prev = this.game.world.enemyAt(tileX, tileY);
    if (!prev) return;
    this.game.world.removeEnemy(tileX, tileY);
    this.triggerHaptic();
    this.recordEnemyChange(tileX, tileY, prev.type, null);
  }

  applyEnemy(tileX, tileY, mode) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured) return;
    const { tileX: safeX, tileY: safeY } = ensured;
    if (mode === 'erase') {
      this.removeEnemy(safeX, safeY);
      return;
    }
    this.setEnemy(safeX, safeY, this.enemyType.id);
  }

  pickMoveSelection(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) return null;
    const enemy = this.game.world.enemyAt(tileX, tileY);
    if (enemy) {
      return { kind: 'enemy', type: enemy.type, origin: { x: tileX, y: tileY } };
    }
    const spawn = this.game.world.spawn;
    if (spawn && spawn.x === tileX && spawn.y === tileY) {
      return { kind: 'spawn', origin: { x: tileX, y: tileY } };
    }
    const char = this.game.world.getTile(tileX, tileY);
    if (char && char !== '.') {
      return { kind: 'tile', char, origin: { x: tileX, y: tileY } };
    }
    return null;
  }

  applyMove(tileX, tileY) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured || !this.moveSelection) return;
    const { tileX: safeX, tileY: safeY } = ensured;
    const { kind, origin } = this.moveSelection;
    if (origin.x === safeX && origin.y === safeY) return;
    if (kind === 'enemy') {
      this.removeEnemy(origin.x, origin.y);
      this.setEnemy(safeX, safeY, this.moveSelection.type);
      return;
    }
    if (kind === 'spawn') {
      this.setSpawn(safeX, safeY);
      return;
    }
    if (kind === 'tile') {
      this.setTile(origin.x, origin.y, '.');
      this.setTile(safeX, safeY, this.moveSelection.char);
    }
  }

  selectTile(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) return;
    const spawn = this.game.world.spawn;
    if (spawn && spawn.x === tileX && spawn.y === tileY) {
      const spawnTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'spawn');
      if (spawnTile) {
        this.setTileType(spawnTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
    const char = this.game.world.getTile(tileX, tileY);
    const known = DEFAULT_TILE_TYPES.find((tile) => tile.char === char);
    if (known) {
      this.setTileType(known);
      this.mode = 'tile';
      this.tileTool = 'paint';
      return;
    }
    this.customTile = { id: 'custom', label: `Tile ${char}`, char };
    this.tileType = this.customTile;
    this.mode = 'tile';
    this.tileTool = 'paint';
  }

  updateHover() {
    if (this.isMobileLayout() && !this.isPointerInEditorArea(this.lastPointer.x, this.lastPointer.y)) {
      this.hoverTile = null;
      return;
    }
    const { tileX, tileY, worldX, worldY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
    this.hoverTile = { x: tileX, y: tileY, worldX, worldY };
    const region = this.game.world.regionAt(worldX, worldY);
    this.regionName = region.name || region.id;
  }

  isMobileLayout() {
    return Boolean(this.game.isMobile);
  }

  isPointerInEditorArea(x, y) {
    if (!this.isMobileLayout()) return true;
    return x >= this.editorBounds.x
      && x <= this.editorBounds.x + this.editorBounds.w
      && y >= this.editorBounds.y
      && y <= this.editorBounds.y + this.editorBounds.h;
  }

  adjustZoom(delta, anchorX, anchorY) {
    this.setZoom(this.zoom + delta * 0.02, anchorX, anchorY);
  }

  setZoom(nextZoom, anchorX, anchorY) {
    const clamped = Math.min(3, Math.max(0.5, nextZoom));
    if (Math.abs(clamped - this.zoom) < 0.001) return;
    const worldPos = this.screenToWorld(anchorX, anchorY);
    this.zoom = clamped;
    this.camera.x = worldPos.x - anchorX / this.zoom;
    this.camera.y = worldPos.y - anchorY / this.zoom;
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.camera.x) * this.zoom,
      y: (y - this.camera.y) * this.zoom
    };
  }

  screenToWorld(x, y) {
    return {
      x: x / this.zoom + this.camera.x,
      y: y / this.zoom + this.camera.y
    };
  }

  screenToTile(x, y) {
    const world = this.screenToWorld(x, y);
    const tileSize = this.game.world.tileSize;
    return {
      worldX: world.x,
      worldY: world.y,
      tileX: Math.floor(world.x / tileSize),
      tileY: Math.floor(world.y / tileSize)
    };
  }

  isInBounds(tileX, tileY) {
    return tileX >= 0 && tileY >= 0 && tileX < this.game.world.width && tileY < this.game.world.height;
  }

  draw(ctx) {
    const { canvas } = this.game;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    this.game.drawWorld(ctx);
    this.drawEditorMarkers(ctx);
    this.drawGrid(ctx);
    this.drawCursor(ctx);
    ctx.restore();
    this.drawHUD(ctx, canvas.width, canvas.height);
  }

  drawEditorMarkers(ctx) {
    const { tileSize } = this.game.world;
    for (let y = 0; y < this.game.world.height; y += 1) {
      for (let x = 0; x < this.game.world.width; x += 1) {
        const tile = this.game.world.getTile(x, y);
        const cx = x * tileSize + tileSize / 2;
        const cy = y * tileSize + tileSize / 2;
        if (tile === 'S') {
          ctx.strokeStyle = '#6cf';
          ctx.strokeRect(cx - 8, cy - 16, 16, 18);
        }
        if (tile === '$') {
          ctx.strokeStyle = '#9f6';
          ctx.beginPath();
          ctx.arc(cx, cy - 6, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (tile === 'O') {
          ctx.strokeStyle = '#ffb84d';
          ctx.beginPath();
          ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (tile === 'a') {
          ctx.strokeStyle = '#6cf';
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, cy - 6);
          ctx.lineTo(cx, cy + 6);
          ctx.stroke();
        }
        if (['g', 'p', 'm', 'r'].includes(tile)) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText(tile.toUpperCase(), cx, cy + 4);
        }
      }
    }

    this.game.world.enemies.forEach((enemy) => {
      const cx = enemy.x * tileSize + tileSize / 2;
      const cy = enemy.y * tileSize + tileSize / 2;
      const marker = ENEMY_TYPES.find((entry) => entry.id === enemy.type);
      ctx.save();
      ctx.strokeStyle = '#f66';
      ctx.strokeRect(cx - 10, cy - 10, 20, 20);
      ctx.fillStyle = '#f66';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(marker?.glyph || 'EN', cx, cy + 4);
      ctx.restore();
    });

    const spawn = this.game.world.spawn;
    if (spawn) {
      ctx.save();
      ctx.strokeStyle = '#ff6';
      ctx.lineWidth = 2;
      ctx.strokeRect(spawn.x * tileSize + 6, spawn.y * tileSize + 6, tileSize - 12, tileSize - 12);
      ctx.beginPath();
      ctx.moveTo(spawn.x * tileSize + tileSize / 2, spawn.y * tileSize + 6);
      ctx.lineTo(spawn.x * tileSize + tileSize / 2, spawn.y * tileSize + tileSize - 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGrid(ctx) {
    const tileSize = this.game.world.tileSize;
    ctx.save();
    const glow = this.dragging || this.radialMenu.active;
    ctx.strokeStyle = glow ? 'rgba(120,200,255,0.2)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = glow ? 1.4 : 1;
    if (glow) {
      ctx.shadowColor = 'rgba(120,200,255,0.35)';
      ctx.shadowBlur = 8;
    }
    for (let x = 0; x <= this.game.world.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, 0);
      ctx.lineTo(x * tileSize, this.game.world.height * tileSize);
      ctx.stroke();
    }
    for (let y = 0; y <= this.game.world.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileSize);
      ctx.lineTo(this.game.world.width * tileSize, y * tileSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCursor(ctx) {
    if (!this.hoverTile) return;
    const tileSize = this.game.world.tileSize;
    const drawHighlight = (tileX, tileY, color) => {
      if (!this.isInBounds(tileX, tileY)) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(tileX * tileSize, tileY * tileSize, tileSize, tileSize);
      ctx.restore();
    };

    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      drawHighlight(this.moveSelection.origin.x, this.moveSelection.origin.y, '#f66');
      drawHighlight(this.moveTarget.x, this.moveTarget.y, '#6f6');
      return;
    }

    const drawGhostTiles = (tiles, color) => {
      ctx.save();
      ctx.fillStyle = color;
      tiles.forEach((tile) => {
        if (!this.isInBounds(tile.x, tile.y)) return;
        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
      });
      ctx.restore();
    };

    if (this.mode === 'shape' || this.mode === 'prefab') {
      const previewStart = this.dragStart || { x: this.hoverTile.x, y: this.hoverTile.y };
      const previewEnd = this.dragTarget || { x: this.hoverTile.x, y: this.hoverTile.y };
      const previewTiles = this.mode === 'shape'
        ? this.buildShapeTiles(previewStart, previewEnd, this.tileType.char || '.')
        : this.buildPrefabTiles(previewStart, previewEnd);
      const previewColor = this.mode === 'shape'
        ? 'rgba(100,200,255,0.2)'
        : 'rgba(190,170,255,0.2)';
      drawGhostTiles(previewTiles, previewColor);
    }

    const ghostX = this.hoverTile.x * tileSize;
    const ghostY = this.hoverTile.y * tileSize;
    ctx.save();
    if (this.mode === 'tile' && this.tileTool === 'erase') {
      ctx.fillStyle = 'rgba(255,80,80,0.25)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
    } else if (this.mode === 'enemy') {
      ctx.fillStyle = 'rgba(255,120,120,0.18)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
      ctx.fillStyle = 'rgba(255,180,180,0.85)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(this.enemyType?.glyph || 'EN', ghostX + tileSize / 2, ghostY + tileSize / 2 + 4);
    } else if (this.mode === 'tile') {
      ctx.fillStyle = 'rgba(140,200,255,0.2)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
      if (this.tileType.char) {
        ctx.fillStyle = 'rgba(220,240,255,0.8)';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.tileType.char.toUpperCase(), ghostX + tileSize / 2, ghostY + tileSize / 2 + 4);
      }
    }
    ctx.restore();

    const color = this.mode === 'tile' && this.tileTool === 'erase'
      ? '#ff6b6b'
      : this.mode === 'enemy'
        ? '#ff9a9a'
        : this.mode === 'prefab'
          ? '#bba8ff'
          : this.mode === 'shape'
            ? '#7fd9ff'
            : '#ffffff';
    drawHighlight(this.hoverTile.x, this.hoverTile.y, color);
  }

  drawHUD(ctx, width, height) {
    const tileSize = this.game.world.tileSize;
    const tileLabel = this.tileType.label || 'Unknown';
    const modeLabel = MODE_LABELS[this.mode] || 'Tile';
    const tileToolLabel = TILE_TOOL_LABELS[this.tileTool] || 'Paint';
    const enemyLabel = this.enemyType?.label || 'Enemy';
    const prefabLabel = this.prefabType?.label || 'Prefab';
    const shapeLabel = this.shapeTool?.label || 'Shape';
    const modeButtons = [
      { id: 'tile', label: 'Tile', tooltip: 'Tile mode. (Q/E/M)' },
      { id: 'enemy', label: 'Enemy', tooltip: 'Enemy mode. (T)' },
      { id: 'prefab', label: 'Prefab', tooltip: 'Structure mode. (R)' },
      { id: 'shape', label: 'Shape', tooltip: 'Shape mode. (G)' }
    ];
    const tileToolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles. (E)' },
      { id: 'move', label: 'Move', tooltip: 'Move items or pan. (M)' }
    ];
    const toolItems = [
      ...modeButtons.map((tool) => ({
        id: `mode-${tool.id}`,
        label: `Mode: ${tool.label}`,
        active: this.mode === tool.id,
        tooltip: tool.tooltip,
        onClick: () => {
          this.mode = tool.id;
        }
      })),
      ...tileToolButtons.map((tool) => ({
        id: `tile-${tool.id}`,
        label: `Tile: ${tool.label}`,
        active: this.mode === 'tile' && this.tileTool === tool.id,
        tooltip: tool.tooltip,
        onClick: () => {
          this.mode = 'tile';
          this.tileTool = tool.id;
        }
      })),
      {
        id: 'random-level',
        label: 'Random Level',
        active: false,
        tooltip: 'Create a random level layout',
        onClick: () => this.promptRandomLevel()
      }
    ];

    ctx.save();
    ctx.font = '13px Courier New';
    ctx.textAlign = 'left';
    this.uiButtons = [];
    let hoverTooltip = '';
    const pointer = this.lastPointer;

    const isHovered = (x, y, w, h) => (
      pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h
    );

    const drawButton = (x, y, w, h, label, active, onClick, tooltip = '') => {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 8, y + h / 2);
      ctx.restore();
      this.addUIButton({ x, y, w, h }, onClick, tooltip);
      if (tooltip && !this.isMobileLayout() && isHovered(x, y, w, h)) {
        hoverTooltip = tooltip;
      }
    };

    const controlMargin = 18;
    const controlBase = Math.min(width, height);
    const joystickRadius = this.isMobileLayout()
      ? Math.min(78, controlBase * 0.14)
      : Math.min(70, controlBase * 0.12);
    const knobRadius = Math.max(22, joystickRadius * 0.45);
    const joystickCenter = {
      x: controlMargin + joystickRadius,
      y: height - controlMargin - joystickRadius
    };
    this.panJoystick.center = joystickCenter;
    this.panJoystick.radius = joystickRadius;
    this.panJoystick.knobRadius = knobRadius;

    let sliderX = joystickCenter.x + joystickRadius + 24;
    let sliderWidth = width - sliderX - controlMargin;
    const sliderHeight = 10;
    const sliderY = height - controlMargin - sliderHeight;
    if (sliderWidth < 160) {
      sliderX = controlMargin;
      sliderWidth = width - controlMargin * 2;
    }
    this.zoomSlider.bounds = {
      x: sliderX,
      y: sliderY - 14,
      w: sliderWidth,
      h: sliderHeight + 28
    };

    if (this.isMobileLayout()) {
      const drawerWidth = Math.floor(width * 0.5);
      const collapsedWidth = 64;
      const panelW = this.drawer.open ? drawerWidth : collapsedWidth;
      const panelX = 0;
      const panelY = 0;
      const panelH = height;
      this.editorBounds = { x: panelW, y: 0, w: width - panelW, h: height };
      this.drawerBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(8,10,12,0.9)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      const handleAreaH = 28;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(panelX, panelY, panelW, handleAreaH);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(panelX + panelW / 2 - 18, panelY + 10, 36, 4);
      this.addUIButton(
        { x: panelX, y: panelY, w: panelW, h: handleAreaH },
        () => {
          this.drawer.open = !this.drawer.open;
        },
        this.drawer.open ? 'Collapse drawer' : 'Expand drawer'
      );

      if (!this.drawer.open) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        let summary = `${modeLabel}`;
        if (this.mode === 'tile') {
          summary = `${modeLabel} (${tileToolLabel})`;
        } else if (this.mode === 'enemy') {
          summary = `${modeLabel}`;
        } else if (this.mode === 'prefab') {
          summary = `${modeLabel}`;
        } else if (this.mode === 'shape') {
          summary = `${modeLabel}`;
        }
        ctx.fillText(summary, panelW / 2, panelY + 46);
      } else {
        const tabs = [
          { id: 'tools', label: 'TOOLS' },
          { id: 'tiles', label: 'TILES' },
          { id: 'enemies', label: 'ENEMIES' },
          { id: 'prefabs', label: 'STRUCTURES' },
          { id: 'shapes', label: 'SHAPES' }
        ];
        const activeTab = this.drawer.tabs[this.drawer.tabIndex];
        const tabMargin = 12;
        const tabGap = 6;
        const tabHeight = 26;
        const tabWidth = (panelW - tabMargin * 2 - tabGap * (tabs.length - 1)) / tabs.length;
        const tabY = panelY + handleAreaH + 8;
        tabs.forEach((tab, index) => {
          const x = panelX + tabMargin + index * (tabWidth + tabGap);
          drawButton(
            x,
            tabY,
            tabWidth,
            tabHeight,
            tab.label,
            activeTab === tab.id,
            () => {
              this.drawer.tabIndex = index;
            },
            `${tab.label} drawer`
          );
        });

        const contentY = tabY + tabHeight + 10;
        const reservedBottom = joystickRadius * 2 + 32;
        const contentHeight = Math.max(0, panelY + panelH - contentY - reservedBottom);
        const buttonHeight = 44;
        const buttonGap = 10;
        const contentX = panelX + 12;
        const contentW = panelW - 24;
        let items = [];
        let columns = 2;

        if (activeTab === 'tools') {
          items = [
            ...modeButtons.map((tool) => ({
              id: `mode-${tool.id}`,
              label: `MODE: ${tool.label.toUpperCase()}`,
              active: this.mode === tool.id,
              tooltip: tool.tooltip,
              onClick: () => {
                this.mode = tool.id;
              }
            })),
            ...tileToolButtons.map((tool) => ({
              id: `tile-${tool.id}`,
              label: `${tool.label.toUpperCase()} TOOL`,
              active: this.tileTool === tool.id && this.mode === 'tile',
              tooltip: tool.tooltip,
              onClick: () => {
                this.mode = 'tile';
                this.tileTool = tool.id;
              }
            })),
            {
              id: 'random-level',
              label: 'RANDOM LEVEL',
              active: false,
              tooltip: 'Create a random level layout',
              onClick: () => this.promptRandomLevel()
            },
            {
              id: 'save',
              label: 'SAVE',
              active: false,
              tooltip: 'Save world JSON',
              onClick: () => this.saveToFile()
            },
            {
              id: 'load',
              label: 'LOAD',
              active: false,
              tooltip: 'Load world JSON',
              onClick: () => this.openFileDialog()
            },
            {
              id: 'exit',
              label: 'EXIT',
              active: false,
              tooltip: 'Exit editor',
              onClick: () => this.game.exitEditor({ playtest: false })
            }
          ];
          columns = 2;
        } else if (activeTab === 'tiles') {
          items = DEFAULT_TILE_TYPES.map((tile) => ({
            id: tile.id,
            label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
            active: this.tileType.id === tile.id,
            tooltip: `Tile: ${tile.label}`,
            onClick: () => {
              this.setTileType(tile);
              this.mode = 'tile';
              this.tileTool = 'paint';
            }
          }));
          columns = 2;
        } else if (activeTab === 'enemies') {
          items = ENEMY_TYPES.map((enemy) => ({
            id: enemy.id,
            label: `${enemy.label} [${enemy.glyph}]`,
            active: this.enemyType.id === enemy.id,
            tooltip: `Enemy: ${enemy.label}`,
            onClick: () => {
              this.setEnemyType(enemy);
              this.mode = 'enemy';
            }
          }));
          columns = 2;
        } else if (activeTab === 'prefabs') {
          items = PREFAB_TYPES.map((prefab) => ({
            id: prefab.id,
            label: prefab.label,
            active: this.prefabType.id === prefab.id,
            tooltip: `Prefab: ${prefab.label}`,
            onClick: () => {
              this.setPrefabType(prefab);
              this.mode = 'prefab';
            }
          }));
          columns = 2;
        } else {
          items = SHAPE_TOOLS.map((shape) => ({
            id: shape.id,
            label: shape.label,
            active: this.shapeTool.id === shape.id,
            tooltip: `Shape: ${shape.label}`,
            onClick: () => {
              this.setShapeTool(shape);
              this.mode = 'shape';
            }
          }));
          columns = 2;
        }

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(5,6,8,0.6)';
        ctx.fillRect(contentX, contentY, contentW, contentHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(contentX, contentY, contentW, contentHeight);

        const columnWidth = (contentW - buttonGap * (columns - 1)) / columns;
        items.forEach((item, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const x = contentX + col * (columnWidth + buttonGap);
          const y = contentY + 8 + row * (buttonHeight + buttonGap);
          if (y + buttonHeight > contentY + contentHeight - 8) return;
          drawButton(x, y, columnWidth, buttonHeight, item.label, item.active, item.onClick, item.tooltip);
        });
      }
    } else {
      this.editorBounds = { x: 0, y: 0, w: width, h: height };
      const panelWidth = 360;
      const panelX = width - panelWidth - 12;
      let cursorY = 12;
      const buttonHeight = 22;
      const buttonGap = 6;
      const sectionPadding = 12;

      const drawSectionHeader = (title, sectionKey) => {
        const headerHeight = 24;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(panelX, cursorY, panelWidth, headerHeight);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(panelX, cursorY, panelWidth, headerHeight);
        ctx.fillStyle = '#fff';
        const indicator = this.uiSections[sectionKey] ? '▾' : '▸';
        ctx.fillText(`${indicator} ${title}`, panelX + 12, cursorY + 16);
        this.addUIButton(
          { x: panelX, y: cursorY, w: panelWidth, h: headerHeight },
          () => {
            this.uiSections[sectionKey] = !this.uiSections[sectionKey];
          },
          `${title} panel`
        );
        cursorY += headerHeight + 6;
      };

      const drawSectionBody = (height) => {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(panelX, cursorY, panelWidth, height);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(panelX, cursorY, panelWidth, height);
      };

      drawSectionHeader('TOOLS', 'tools');
      if (this.uiSections.tools) {
        const columns = 2;
        const rows = Math.ceil(toolItems.length / columns);
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        toolItems.forEach((tool, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const columnWidth = (panelWidth - sectionPadding * 2 - buttonGap) / columns;
          const x = panelX + sectionPadding + col * (columnWidth + buttonGap);
          const y = cursorY + 6 + row * (buttonHeight + buttonGap);
          drawButton(x, y, columnWidth, buttonHeight, tool.label, tool.active, tool.onClick, tool.tooltip);
        });
        cursorY += sectionHeight + 10;
      }

      drawSectionHeader('TILES', 'tiles');
      if (this.uiSections.tiles) {
        const columns = 1;
        const rows = DEFAULT_TILE_TYPES.length;
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        DEFAULT_TILE_TYPES.forEach((tile, index) => {
          const x = panelX + sectionPadding;
          const y = cursorY + 6 + index * (buttonHeight + buttonGap);
          const label = tile.char ? `${tile.label} [${tile.char}]` : tile.label;
          drawButton(x, y, panelWidth - sectionPadding * 2, buttonHeight, label, this.tileType.id === tile.id, () => {
            this.setTileType(tile);
            this.mode = 'tile';
            this.tileTool = 'paint';
          }, `Tile: ${tile.label}`);
        });
        cursorY += sectionHeight + 10;
      }

      drawSectionHeader('ENEMIES', 'enemies');
      if (this.uiSections.enemies) {
        const columns = 1;
        const rows = ENEMY_TYPES.length;
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        ENEMY_TYPES.forEach((enemy, index) => {
          const x = panelX + sectionPadding;
          const y = cursorY + 6 + index * (buttonHeight + buttonGap);
          const label = `${enemy.label} [${enemy.glyph}]`;
          drawButton(x, y, panelWidth - sectionPadding * 2, buttonHeight, label, this.enemyType.id === enemy.id, () => {
            this.setEnemyType(enemy);
            this.mode = 'enemy';
          }, `Enemy: ${enemy.label}`);
        });
        cursorY += sectionHeight + 10;
      }

      drawSectionHeader('STRUCTURES', 'prefabs');
      if (this.uiSections.prefabs) {
        const columns = 1;
        const rows = PREFAB_TYPES.length;
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        PREFAB_TYPES.forEach((prefab, index) => {
          const x = panelX + sectionPadding;
          const y = cursorY + 6 + index * (buttonHeight + buttonGap);
          drawButton(x, y, panelWidth - sectionPadding * 2, buttonHeight, prefab.label, this.prefabType.id === prefab.id, () => {
            this.setPrefabType(prefab);
            this.mode = 'prefab';
          }, `Prefab: ${prefab.label}`);
        });
        cursorY += sectionHeight + 10;
      }

      drawSectionHeader('SHAPES', 'shapes');
      if (this.uiSections.shapes) {
        const columns = 1;
        const rows = SHAPE_TOOLS.length;
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        SHAPE_TOOLS.forEach((shape, index) => {
          const x = panelX + sectionPadding;
          const y = cursorY + 6 + index * (buttonHeight + buttonGap);
          drawButton(x, y, panelWidth - sectionPadding * 2, buttonHeight, shape.label, this.shapeTool.id === shape.id, () => {
            this.setShapeTool(shape);
            this.mode = 'shape';
          }, `Shape: ${shape.label}`);
        });
        cursorY += sectionHeight + 10;
      }

      const infoLines = [
        `Mode: ${modeLabel} | Tool: ${tileToolLabel}`,
        `Tile: ${tileLabel} | Enemy: ${enemyLabel}`,
        `Prefab: ${prefabLabel} | Shape: ${shapeLabel}`,
        `Grid: ${tileSize}px | Region: ${this.regionName}`,
        `Zoom: ${this.zoom.toFixed(2)}x`,
        `Drag: LMB paint | RMB erase | Space+drag pan`,
        `Move: drag to reposition | Two-finger: pan/zoom`,
        `Arrows: pan | Shift+Arrows: zoom`,
        `Gamepad: LS cursor | A paint | B erase | X tool | Y mode`,
        `LB/RB cycle selection | LT/RT zoom | Start exit | Back playtest`,
        `Ctrl+Z / Ctrl+Y: undo/redo`,
        `S: save JSON | L: load JSON`,
        `P: playtest | F2: toggle editor | Esc: exit`
      ];
      const infoHeight = infoLines.length * 18 + 12;
      ctx.globalAlpha = 0.85;
      const infoX = 12;
      const infoY = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(infoX, infoY, panelWidth, infoHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(infoX, infoY, panelWidth, infoHeight);
      ctx.fillStyle = '#fff';
      infoLines.forEach((line, index) => {
        ctx.fillText(line, infoX + 12, infoY + 22 + index * 18);
      });
    }

    const zoomMin = 0.5;
    const zoomMax = 3;
    const zoomT = Math.min(1, Math.max(0, (this.zoom - zoomMin) / (zoomMax - zoomMin)));
    const sliderKnobX = sliderX + zoomT * sliderWidth;
    const sliderCenterY = sliderY + sliderHeight / 2;
    const sliderKnobRadius = sliderHeight * 1.6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sliderX, sliderCenterY - sliderHeight / 2, sliderWidth, sliderHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sliderX, sliderCenterY);
    ctx.lineTo(sliderX + sliderWidth, sliderCenterY);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sliderKnobX, sliderCenterY, sliderKnobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.stroke();
    ctx.restore();

    const joystickKnobX = joystickCenter.x + this.panJoystick.dx * joystickRadius;
    const joystickKnobY = joystickCenter.y + this.panJoystick.dy * joystickRadius;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(joystickCenter.x, joystickCenter.y, joystickRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(joystickKnobX, joystickKnobY, knobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.restore();

    if (this.radialMenu.active && this.radialMenu.items.length > 0) {
      const centerX = this.radialMenu.x;
      const centerY = this.radialMenu.y;
      const radius = 86;
      const itemRadius = 26;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(10,12,14,0.9)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
      ctx.fill();
      const step = (Math.PI * 2) / this.radialMenu.items.length;
      this.radialMenu.items.forEach((item, index) => {
        const angle = -Math.PI / 2 + index * step;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        ctx.fillStyle = 'rgba(20,24,28,0.95)';
        ctx.beginPath();
        ctx.arc(x, y, itemRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, x, y + 1);
        this.addUIButton(
          { x: x - itemRadius, y: y - itemRadius, w: itemRadius * 2, h: itemRadius * 2 },
          () => {
            item.action();
            this.closeRadialMenu();
          },
          item.tooltip
        );
      });
      ctx.restore();
    }

    const playSize = this.isMobileLayout() ? 58 : 52;
    const playPadding = 16;
    const playX = width - playSize - playPadding;
    const playY = this.editorBounds.y + this.editorBounds.h - playSize - playPadding;
    this.playButtonBounds = { x: playX, y: playY, w: playSize, h: playSize };
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(0,180,120,0.95)';
    ctx.beginPath();
    ctx.arc(playX + playSize / 2, playY + playSize / 2, playSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(playX + playSize * 0.42, playY + playSize * 0.34);
    ctx.lineTo(playX + playSize * 0.42, playY + playSize * 0.66);
    ctx.lineTo(playX + playSize * 0.7, playY + playSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const tooltip = hoverTooltip || (this.tooltipTimer > 0 ? this.activeTooltip : '');
    const fallbackTooltip = `Mode: ${modeLabel} | Tile: ${tileLabel} | Enemy: ${enemyLabel} | Prefab: ${prefabLabel} | Shape: ${shapeLabel}`;
    const tooltipText = tooltip || fallbackTooltip;
    const tooltipHeight = this.isMobileLayout() ? 22 : 24;
    const baseTooltipY = this.isMobileLayout()
      ? this.editorBounds.y + this.editorBounds.h - tooltipHeight
      : height - tooltipHeight;
    const sliderSafeY = sliderY - tooltipHeight - 12;
    const tooltipY = Math.max(0, Math.min(baseTooltipY, sliderSafeY));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, tooltipY, width, tooltipHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0, tooltipY, width, tooltipHeight);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tooltipText, width / 2, tooltipY + tooltipHeight - 7);
    ctx.restore();
  }
}
