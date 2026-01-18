const DEFAULT_TILE_TYPES = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'ice-solid', label: 'Icy Solid Block', char: 'F' },
  { id: 'rock-solid', label: 'Rock Solid Block', char: 'R' },
  { id: 'triangle', label: 'Triangle Block', char: '^' },
  { id: 'triangle-flip', label: 'Triangle Block (Flipped)', char: 'v' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'elevator-path', label: 'Elevator Path', char: null, special: 'elevator-path' },
  { id: 'elevator-platform', label: 'Elevator Platform', char: null, special: 'elevator-platform' },
  { id: 'water', label: 'Water', char: '~' },
  { id: 'acid', label: 'Acid', char: 'A' },
  { id: 'lava', label: 'Lava', char: 'L' },
  { id: 'spikes', label: 'Spikes', char: '*' },
  { id: 'ice', label: 'Ice Block', char: 'I' },
  { id: 'conveyor-left', label: 'Conveyor Left', char: '<' },
  { id: 'conveyor-right', label: 'Conveyor Right', char: '>' },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'wood', label: 'Wood Barricade', char: 'W' },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C' },
  { id: 'debris', label: 'Heavy Debris', char: 'U' },
  { id: 'box', label: 'Pull Box', char: 'K' },
  { id: 'switch', label: 'Counterweight Switch', char: 'T' },
  { id: 'bossGate', label: 'Rift Seal', char: 'B' },
  { id: 'door', label: 'Door', char: 'D' },
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
  { id: 'puzzle', label: 'Puzzle Kit', short: 'PZ' },
  { id: 'door', label: 'Door', short: 'DR' },
  { id: 'water-pit', label: 'Water Pit', short: 'WP' },
  { id: 'lava-pit', label: 'Lava Pit', short: 'LP' },
  { id: 'acid-pit', label: 'Acid Pit', short: 'AP' },
  { id: 'spike-pit', label: 'Spike Pit', short: 'SP' },
  { id: 'spike-wall-pit', label: 'Spike Wall Pit', short: 'SW' },
  { id: 'spike-ceiling-pit', label: 'Spike Ceiling Pit', short: 'SC' },
  { id: 'large-t-solid', label: 'Large T Solid', short: 'TS' },
  { id: 'large-t-ice', label: 'Large T Ice', short: 'TI' },
  { id: 'solid-platform', label: 'Platform (Solid)', short: 'PS' },
  { id: 'industrial-platform', label: 'Industrial Platform', short: 'IP' },
  { id: 'conveyor-belt', label: 'Conveyor Belt', short: 'CB' },
  { id: 'elevator', label: 'Elevator', short: 'EL' },
  { id: 'moving-platform', label: 'Moving Platform', short: 'MP' },
  { id: 'stalactite', label: 'Stalactite', short: 'ST' },
  { id: 'stalagmite', label: 'Stalagmite', short: 'SM' },
  { id: 'cave-platform', label: 'Cave Platform', short: 'CP' }
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

const EDITOR_AUTOSAVE_KEY = 'chainsaw-editor-autosave';

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
    this.pendingElevatorPaths = new Map();
    this.pendingElevators = new Map();
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
    this.panelTabs = ['tools', 'tiles', 'enemies', 'prefabs', 'shapes'];
    this.panelTabIndex = 0;
    this.panelScroll = {
      tools: 0,
      tiles: 0,
      enemies: 0,
      prefabs: 0,
      shapes: 0
    };
    this.panelScrollMax = {
      tools: 0,
      tiles: 0,
      enemies: 0,
      prefabs: 0,
      shapes: 0
    };
    this.panelScrollBounds = null;
    this.panelScrollView = null;
    this.panelMenuIndex = {
      tools: 0,
      tiles: 0,
      enemies: 0,
      prefabs: 0,
      shapes: 0
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
    this.randomLevelSize = { width: 150, height: 100 };
    this.randomLevelSlider = {
      active: null,
      bounds: {
        width: null,
        height: null
      }
    };
    this.randomLevelDialog = { open: false };
    this.autosaveKey = EDITOR_AUTOSAVE_KEY;
    this.autosaveLoaded = false;
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
          this.persistAutosave();
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
    this.loadAutosaveOrSeed();
    this.restorePlaytestSpawn();
    this.resetView();
  }

  deactivate() {
    this.active = false;
    this.dragging = false;
    this.dragMode = null;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.pendingElevatorPaths.clear();
    this.pendingElevators.clear();
    this.moveSelection = null;
    this.moveTarget = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.dragSource = null;
    this.gamepadCursor.active = false;
  }

  loadAutosaveOrSeed() {
    if (this.autosaveLoaded) return;
    this.autosaveLoaded = true;
    if (this.loadAutosave()) return;
    this.createRandomLevel(150, 100);
  }

  getStorage() {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  loadAutosave() {
    const storage = this.getStorage();
    if (!storage) return false;
    const raw = storage.getItem(this.autosaveKey);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data || !data.tiles || !data.width || !data.height) {
        storage.removeItem(this.autosaveKey);
        return false;
      }
      this.game.applyWorldData(data);
      return true;
    } catch (error) {
      storage.removeItem(this.autosaveKey);
      return false;
    }
  }

  persistAutosave() {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.autosaveKey, JSON.stringify(this.game.buildWorldData()));
    } catch (error) {
      console.warn('Unable to save editor autosave:', error);
    }
  }

  resetView() {
    const { canvas } = this.game;
    const focus = this.game.world.spawnPoint || this.game.spawnPoint || this.game.player || { x: 0, y: 0 };
    this.zoom = 1;
    const bounds = this.getCameraBounds();
    this.camera.x = clamp(focus.x - canvas.width / 2, bounds.minX, bounds.maxX);
    this.camera.y = clamp(focus.y - canvas.height / 2, bounds.minY, bounds.maxY);
  }

  update(input, dt) {
    this.handleKeyboard(input, dt);
    this.handleGamepad(input, dt);
    if (!this.isMobileLayout()) {
      if (this.panJoystick.active || this.panJoystick.dx !== 0 || this.panJoystick.dy !== 0) {
        this.panJoystick.active = false;
        this.panJoystick.id = null;
        this.panJoystick.dx = 0;
        this.panJoystick.dy = 0;
      }
      if (this.zoomSlider.active) {
        this.zoomSlider.active = false;
        this.zoomSlider.id = null;
      }
    } else if (Math.abs(this.panJoystick.dx) > 0.01 || Math.abs(this.panJoystick.dy) > 0.01) {
      const panSpeed = 320 * dt * (1 / this.zoom);
      this.camera.x += this.panJoystick.dx * panSpeed;
      this.camera.y += this.panJoystick.dy * panSpeed;
      this.clampCamera();
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
      if (input.isDownCode('ArrowLeft')) this.camera.x -= panSpeed;
      if (input.isDownCode('ArrowRight')) this.camera.x += panSpeed;
      if (input.isDownCode('ArrowUp')) this.camera.y -= panSpeed;
      if (input.isDownCode('ArrowDown')) this.camera.y += panSpeed;
      this.clampCamera();
    } else {
      if (input.isDownCode('ArrowUp')) this.adjustZoom(0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
      if (input.isDownCode('ArrowDown')) this.adjustZoom(-0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
    }
  }

  getActivePanelTab() {
    return this.panelTabs[this.panelTabIndex] || 'tools';
  }

  setPanelTab(tabId) {
    const index = this.panelTabs.indexOf(tabId);
    if (index === -1) return;
    this.panelTabIndex = index;
  }

  cyclePanelTab(direction) {
    const cycleTabs = ['tools', 'tiles', 'enemies'];
    const current = this.getActivePanelTab();
    const currentIndex = Math.max(0, cycleTabs.indexOf(current));
    const nextIndex = (currentIndex + direction + cycleTabs.length) % cycleTabs.length;
    const nextTab = cycleTabs[nextIndex];
    this.setPanelTab(nextTab);
    if (nextTab === 'tiles') {
      this.mode = 'tile';
      this.tileTool = 'paint';
    } else if (nextTab === 'enemies') {
      this.mode = 'enemy';
    }
  }

  getPanelConfig(tabId, { includeExtras = false } = {}) {
    const tileToolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles. (E)' },
      { id: 'move', label: 'Move', tooltip: 'Move items or pan. (M)' }
    ];
    let items = [];
    let columns = 1;

    if (tabId === 'tools') {
      items = [
        ...tileToolButtons.map((tool) => ({
          id: `tile-${tool.id}`,
          label: `Tool: ${tool.label}`,
          tooltip: tool.tooltip,
          onClick: () => {
            this.mode = 'tile';
            this.tileTool = tool.id;
          }
        })),
        {
          id: 'undo',
          label: 'Undo',
          tooltip: 'Undo last change (Ctrl+Z)',
          onClick: () => this.undo()
        },
        {
          id: 'redo',
          label: 'Redo',
          tooltip: 'Redo last change (Ctrl+Y)',
          onClick: () => this.redo()
        },
        {
          id: 'random-level',
          label: 'Random Level',
          tooltip: 'Create a random level layout',
          onClick: () => this.promptRandomLevel()
        }
      ];
      columns = 2;
    } else if (tabId === 'tiles') {
      items = DEFAULT_TILE_TYPES.map((tile) => ({
        id: tile.id,
        label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
        tile,
        tooltip: `Tile: ${tile.label}`,
        onClick: () => {
          this.setTileType(tile);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      }));
    } else if (tabId === 'enemies') {
      items = ENEMY_TYPES.map((enemy) => ({
        id: enemy.id,
        label: `${enemy.label} [${enemy.glyph}]`,
        enemy,
        tooltip: `Enemy: ${enemy.label}`,
        onClick: () => {
          this.setEnemyType(enemy);
          this.mode = 'enemy';
        }
      }));
    } else if (tabId === 'prefabs') {
      items = PREFAB_TYPES.map((prefab) => ({
        id: prefab.id,
        label: prefab.label,
        prefab,
        tooltip: `Prefab: ${prefab.label}`,
        onClick: () => {
          this.setPrefabType(prefab);
          this.mode = 'prefab';
        }
      }));
    } else if (tabId === 'shapes') {
      items = SHAPE_TOOLS.map((shape) => ({
        id: shape.id,
        label: shape.label,
        shape,
        tooltip: `Shape: ${shape.label}`,
        onClick: () => {
          this.setShapeTool(shape);
          this.mode = 'shape';
        }
      }));
    }

    if (includeExtras) {
      items.push(
        {
          id: 'save',
          label: 'Save',
          tooltip: 'Save world JSON',
          onClick: () => this.saveToFile()
        },
        {
          id: 'load',
          label: 'Load',
          tooltip: 'Load world JSON',
          onClick: () => this.openFileDialog()
        },
        {
          id: 'exit',
          label: 'Exit',
          tooltip: 'Exit editor',
          onClick: () => this.game.exitEditor({ playtest: false })
        }
      );
    }

    return { items, columns };
  }

  navigatePanelMenu(input) {
    const activeTab = this.getActivePanelTab();
    const { items, columns } = this.getPanelConfig(activeTab, { includeExtras: this.isMobileLayout() });
    if (items.length === 0) return false;
    if (!input.wasGamepadPressed('up')
      && !input.wasGamepadPressed('down')
      && !input.wasGamepadPressed('left')
      && !input.wasGamepadPressed('right')) {
      return false;
    }
    const total = items.length;
    const index = Math.max(0, Math.min(this.panelMenuIndex[activeTab] ?? 0, total - 1));
    let nextIndex = index;
    if (input.wasGamepadPressed('up')) nextIndex -= columns;
    else if (input.wasGamepadPressed('down')) nextIndex += columns;
    else if (input.wasGamepadPressed('left')) nextIndex -= 1;
    else if (input.wasGamepadPressed('right')) nextIndex += 1;
    nextIndex = ((nextIndex % total) + total) % total;
    this.panelMenuIndex[activeTab] = nextIndex;
    const nextItem = items[nextIndex];
    if (this.panelScrollView) {
      const { contentHeight, buttonHeight, buttonGap, columns, padding } = this.panelScrollView;
      const row = Math.floor(nextIndex / columns);
      const itemTop = padding + row * (buttonHeight + buttonGap);
      const itemBottom = itemTop + buttonHeight;
      let scrollY = this.panelScroll[activeTab] || 0;
      if (itemTop < scrollY) {
        scrollY = itemTop;
      } else if (itemBottom > scrollY + contentHeight - padding) {
        scrollY = itemBottom - (contentHeight - padding);
      }
      this.panelScroll[activeTab] = clamp(scrollY, 0, this.panelScrollMax[activeTab] || 0);
    }
    nextItem.onClick();
    if (nextItem.tooltip) {
      this.activeTooltip = nextItem.tooltip;
      this.tooltipTimer = 2;
    }
    return true;
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
      this.navigatePanelMenu(input);
    }

    if (lookX !== 0 || lookY !== 0) {
      this.camera.x += lookX * panSpeed;
      this.camera.y += lookY * panSpeed;
      this.clampCamera();
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
      this.cyclePanelTab(-1);
    }
    if (input.wasGamepadPressed('rev')) {
      this.cyclePanelTab(1);
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
      this.camera.x = this.gamepadCursor.x - margin / this.zoom;
    } else if (this.gamepadCursor.x > maxX) {
      this.camera.x = this.gamepadCursor.x - viewW / this.zoom + margin / this.zoom;
    }
    if (this.gamepadCursor.y < minY) {
      this.camera.y = this.gamepadCursor.y - margin / this.zoom;
    } else if (this.gamepadCursor.y > maxY) {
      this.camera.y = this.gamepadCursor.y - viewH / this.zoom + margin / this.zoom;
    }
    this.clampCamera();
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
    this.randomLevelDialog.open = true;
  }

  confirmRandomLevel() {
    this.randomLevelDialog.open = false;
    this.createRandomLevel(this.randomLevelSize.width, this.randomLevelSize.height);
  }

  cancelRandomLevel() {
    this.randomLevelDialog.open = false;
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
    const elevatorPaths = [];
    const elevators = [];
    const elevatorPathSet = new Set();
    const elevatorSet = new Set();
    const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const blockWidth = 38;
    const blockHeight = 18;
    const minRoomSpacing = 6;
    const roomPadding = Math.max(1, Math.floor(minRoomSpacing / 2));
    const cols = Math.max(1, Math.floor((width - 2) / blockWidth));
    const rows = Math.max(1, Math.floor((height - 2) / blockHeight));
    const maxRooms = cols * rows;

    const setTile = (x, y, char) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      tiles[y][x] = char;
    };
    const addElevatorPath = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const key = `${x},${y}`;
      if (elevatorPathSet.has(key)) return;
      elevatorPathSet.add(key);
      elevatorPaths.push({ x, y });
    };
    const addElevatorPlatform = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const key = `${x},${y}`;
      if (elevatorSet.has(key)) return;
      elevatorSet.add(key);
      elevators.push({ x, y });
    };
    const getRoomWallTile = (room) => room.wallTile || '#';

    const carveRectRoom = (room) => {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          const wall = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
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
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
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
          setTile(x, y + room.y, wall ? getRoomWallTile(room) : '.');
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
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
        }
      }
    };

    const roomsOverlap = (room) => rooms.some((other) => (
      room.x < other.x + other.w
      && room.x + room.w > other.x
      && room.y < other.y + other.h
      && room.y + room.h > other.y
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
        setTile(spot.x, spot.y, getRoomWallTile(room));
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

    const buildCenteredPattern = (widths) => {
      const height = widths.length;
      const width = Math.max(...widths);
      const coords = [];
      widths.forEach((rowWidth, rowIndex) => {
        const left = Math.floor((width - rowWidth) / 2);
        for (let x = 0; x < rowWidth; x += 1) {
          coords.push({ dx: left + x, dy: rowIndex });
        }
      });
      return { coords, width, height };
    };

    const prefabPatterns = {
      stalactite: buildCenteredPattern([7, 7, 5, 5, 3, 3, 1]),
      stalagmite: buildCenteredPattern([1, 3, 3, 5, 5, 7, 7]),
      largeT: {
        width: 7,
        height: 6,
        coords: [
          ...Array.from({ length: 7 }, (_, x) => ({ dx: x, dy: 0 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 2, dy: y + 1 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 3, dy: y + 1 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 4, dy: y + 1 }))
        ]
      },
      cavePlatform: {
        width: 6,
        height: 4,
        coords: [
          ...Array.from({ length: 4 }, (_, x) => ({ dx: x + 1, dy: 0 })),
          ...Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 1 })),
          ...Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 2 })),
          ...Array.from({ length: 4 }, (_, x) => ({ dx: x + 1, dy: 3 }))
        ]
      },
      industrialPlatform: {
        width: 6,
        height: 1,
        coords: Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 0 }))
      }
    };

    const placePatternInRoom = (room, pattern, options = {}) => {
      const { width, height, coords } = pattern;
      if (room.w < width + 2 || room.h < height + 2) return false;
      const attempts = options.attempts ?? 30;
      const tileChar = options.tileChar || getRoomWallTile(room);
      const minX = room.x + 1;
      const maxX = room.x + room.w - width - 1;
      const minY = room.y + 1;
      const maxY = room.y + room.h - height - 1;
      if (maxX < minX || maxY < minY) return false;
      for (let i = 0; i < attempts; i += 1) {
        const originX = randInt(minX, maxX);
        let originY = randInt(minY, maxY);
        if (options.anchor === 'ceiling') {
          originY = room.y + 1;
        } else if (options.anchor === 'floor') {
          originY = room.y + room.h - height - 1;
        }
        const canPlace = coords.every(({ dx, dy }) => tiles[originY + dy]?.[originX + dx] === '.');
        if (!canPlace) continue;
        coords.forEach(({ dx, dy }) => setTile(originX + dx, originY + dy, tileChar));
        return true;
      }
      return false;
    };

    const addIcePatch = (room) => {
      if (room.w < 8) return;
      const spot = findFloorInRoom(room);
      if (!spot) return;
      const length = randInt(3, Math.min(8, room.w - 4));
      const startX = clamp(spot.x - Math.floor(length / 2), room.x + 1, room.x + room.w - length - 1);
      for (let x = startX; x < startX + length; x += 1) {
        if (tiles[spot.y]?.[x] === '.') setTile(x, spot.y, 'I');
      }
    };

    const addStalactite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalactite, { anchor: 'ceiling' });
    };

    const addStalagmite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalagmite, { anchor: 'floor' });
    };

    const addCavePlatform = (room) => {
      placePatternInRoom(room, prefabPatterns.cavePlatform);
    };

    const addIndustrialPlatform = (room) => {
      placePatternInRoom(room, prefabPatterns.industrialPlatform);
    };

    const addIndustrialT = (room) => {
      placePatternInRoom(room, prefabPatterns.largeT, { anchor: 'floor' });
    };

    const addSwitchTile = (room) => {
      const spot = findFloorInRoom(room);
      if (!spot) return;
      setTile(spot.x, spot.y, 'T');
    };

    const addConveyor = (room) => {
      if (room.w < 10) return;
      const spot = findFloorInRoom(room);
      if (!spot) return;
      const length = randInt(4, Math.min(10, room.w - 4));
      const startX = clamp(spot.x - Math.floor(length / 2), room.x + 1, room.x + room.w - length - 1);
      const dir = Math.random() < 0.5 ? '<' : '>';
      for (let x = startX; x < startX + length; x += 1) {
        if (tiles[spot.y]?.[x] === '.') setTile(x, spot.y, dir);
      }
    };

    const addPit = (room, hazard) => {
      const pitWidth = 6;
      const pitHeight = 2;
      if (room.w < pitWidth + 2 || room.h < pitHeight + 2) return;
      const wallTile = getRoomWallTile(room);
      const startX = randInt(room.x + 1, room.x + room.w - pitWidth - 1);
      const startY = randInt(room.y + 1, room.y + room.h - pitHeight - 1);
      for (let y = 0; y < pitHeight; y += 1) {
        for (let x = 0; x < pitWidth; x += 1) {
          const tileX = startX + x;
          const tileY = startY + y;
          const isBottom = y === pitHeight - 1;
          const isWall = x === 0 || x === pitWidth - 1;
          const char = isBottom || isWall ? wallTile : hazard;
          setTile(tileX, tileY, char);
        }
      }
    };

    const addHazardFloor = (room, hazard) => {
      const minSize = 8;
      if (room.w < minSize || room.h < minSize) return;
      const floorY = room.y + room.h - 2;
      const depth = randInt(1, 2);
      const topY = Math.max(room.y + 1, floorY - depth + 1);
      for (let y = topY; y <= floorY; y += 1) {
        for (let x = room.x + 1; x <= room.x + room.w - 2; x += 1) {
          if (tiles[y]?.[x] === '.') setTile(x, y, hazard);
        }
      }
    };

    const addElevator = (room) => {
      const shaftHeight = 6;
      if (room.h < shaftHeight + 4) return;
      const shaftX = randInt(room.x + 2, room.x + room.w - 3);
      const shaftY = randInt(room.y + 2, room.y + room.h - shaftHeight - 2);
      for (let y = 0; y < shaftHeight; y += 1) {
        const tileY = shaftY + y;
        setTile(shaftX, tileY, '.');
        addElevatorPath(shaftX, tileY);
      }
      addElevatorPlatform(shaftX, shaftY + shaftHeight - 1);
    };

    const addTriangleBlocks = (room) => {
      const count = randInt(1, 3);
      const wallTile = getRoomWallTile(room);
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
              if (tiles[tileY]?.[tileX] === '.') setTile(tileX, tileY, wallTile);
            }
          }
        }
      }
    };

    const biomeTypes = ['cave', 'industrial', 'ice'];
    const biomeSeeds = [];
    const usedSeedKeys = new Set();
    while (biomeSeeds.length < biomeTypes.length) {
      const seedCol = randInt(0, cols - 1);
      const seedRow = randInt(0, rows - 1);
      const key = `${seedCol},${seedRow}`;
      if (usedSeedKeys.has(key)) continue;
      usedSeedKeys.add(key);
      biomeSeeds.push({ col: seedCol, row: seedRow, type: biomeTypes[biomeSeeds.length] });
    }
    const biomeMap = Array.from({ length: rows }, () => Array.from({ length: cols }, () => biomeTypes[0]));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        let bestSeed = biomeSeeds[0];
        let bestDistance = Infinity;
        biomeSeeds.forEach((seed) => {
          const distance = Math.abs(seed.col - col) + Math.abs(seed.row - row);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestSeed = seed;
          }
        });
        biomeMap[row][col] = bestSeed.type;
      }
    }

    const carveConnection = (from, to) => {
      const horizontal = from.y === to.y;
      const wideJoin = Math.random() < 0.3;
      const span = wideJoin ? 4 : 2;
      const doorwayTile = span === 2 ? 'D' : '.';

      if (horizontal) {
        const doorX = to.x > from.x ? from.x + from.w - 1 : from.x;
        const otherDoorX = to.x > from.x ? to.x : to.x + to.w - 1;
        const minY = Math.max(from.y + 1, to.y + 1);
        const maxY = Math.min(from.y + from.h - 2, to.y + to.h - 2);
        const startY = clamp(Math.floor(from.y + from.h / 2) - Math.floor(span / 2), minY, maxY - (span - 1));
        for (let i = 0; i < span; i += 1) {
          setTile(doorX, startY + i, doorwayTile);
          setTile(otherDoorX, startY + i, doorwayTile);
        }
        const startX = Math.min(doorX, otherDoorX) + 1;
        const endX = Math.max(doorX, otherDoorX) - 1;
        for (let i = 0; i < span; i += 1) {
          for (let x = startX; x <= endX; x += 1) {
            setTile(x, startY + i, doorwayTile);
          }
        }
        return;
      }

      const doorY = to.y > from.y ? from.y + from.h - 1 : from.y;
      const otherDoorY = to.y > from.y ? to.y : to.y + to.h - 1;
      const minX = Math.max(from.x + 1, to.x + 1);
      const maxX = Math.min(from.x + from.w - 2, to.x + to.w - 2);
      const startX = clamp(Math.floor(from.x + from.w / 2) - Math.floor(span / 2), minX, maxX - (span - 1));
      for (let i = 0; i < span; i += 1) {
        setTile(startX + i, doorY, doorwayTile);
        setTile(startX + i, otherDoorY, doorwayTile);
      }
      const startY = Math.min(doorY, otherDoorY) + 1;
      const endY = Math.max(doorY, otherDoorY) - 1;
      for (let i = 0; i < span; i += 1) {
        for (let y = startY; y <= endY; y += 1) {
          setTile(startX + i, y, doorwayTile);
        }
      }
    };

    const addRoomDetails = (room) => {
      addPillars(room);
      if (Math.random() < 0.65) addPlatform(room);
      if (room.h >= 28) {
        addPlatformRun(room);
        addStaircase(room);
      }
      addTriangleBlocks(room);
      if (room.biome === 'cave') {
        if (Math.random() < 0.5) addStalactite(room);
        if (Math.random() < 0.5) addStalagmite(room);
        if (Math.random() < 0.45) addCavePlatform(room);
        if (Math.random() < 0.6) addPit(room, pickOne(['~', 'L']));
      } else if (room.biome === 'industrial') {
        if (Math.random() < 0.5) addIndustrialPlatform(room);
        if (Math.random() < 0.4) addIndustrialT(room);
        if (Math.random() < 0.35) addSwitchTile(room);
        if (Math.random() < 0.5) addConveyor(room);
        if (Math.random() < 0.35) addElevator(room);
        if (Math.random() < 0.45) addPit(room, '*');
      } else if (room.biome === 'ice') {
        if (Math.random() < 0.6) addIcePatch(room);
        if (Math.random() < 0.4) addPit(room, '~');
        if (Math.random() < 0.35) addPit(room, '*');
      }
    };

    const cellIndex = (col, row) => row * cols + col;
    const cellFromIndex = (index) => ({ col: index % cols, row: Math.floor(index / cols) });
    const cellCenterDistance = (col, row) => {
      const centerX = 1 + col * blockWidth + Math.floor(blockWidth / 2);
      const centerY = 1 + row * blockHeight + Math.floor(blockHeight / 2);
      return Math.hypot(centerX - spawn.x, centerY - spawn.y);
    };
    const targetRooms = clamp(Math.floor(maxRooms * 0.7), 3, maxRooms);
    const occupied = new Set();
    const adjacency = new Map();
    const startCellIndex = (() => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const dist = cellCenterDistance(col, row);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = cellIndex(col, row);
          }
        }
      }
      return bestIndex;
    })();
    occupied.add(startCellIndex);
    adjacency.set(startCellIndex, new Set());
    while (occupied.size < targetRooms) {
      const frontier = Array.from(occupied).filter((index) => {
        const { col, row } = cellFromIndex(index);
        return (
          (col > 0 && !occupied.has(cellIndex(col - 1, row)))
          || (col < cols - 1 && !occupied.has(cellIndex(col + 1, row)))
          || (row > 0 && !occupied.has(cellIndex(col, row - 1)))
          || (row < rows - 1 && !occupied.has(cellIndex(col, row + 1)))
        );
      });
      if (frontier.length === 0) break;
      const fromIndex = pickOne(frontier);
      const { col, row } = cellFromIndex(fromIndex);
      const neighbors = [];
      if (col > 0 && !occupied.has(cellIndex(col - 1, row))) neighbors.push(cellIndex(col - 1, row));
      if (col < cols - 1 && !occupied.has(cellIndex(col + 1, row))) neighbors.push(cellIndex(col + 1, row));
      if (row > 0 && !occupied.has(cellIndex(col, row - 1))) neighbors.push(cellIndex(col, row - 1));
      if (row < rows - 1 && !occupied.has(cellIndex(col, row + 1))) neighbors.push(cellIndex(col, row + 1));
      if (neighbors.length === 0) break;
      const nextIndex = pickOne(neighbors);
      occupied.add(nextIndex);
      if (!adjacency.has(fromIndex)) adjacency.set(fromIndex, new Set());
      if (!adjacency.has(nextIndex)) adjacency.set(nextIndex, new Set());
      adjacency.get(fromIndex).add(nextIndex);
      adjacency.get(nextIndex).add(fromIndex);
    }

    const biomeRoomTypes = {
      cave: ['cave', 'circular'],
      industrial: ['room'],
      ice: ['room', 'circular']
    };
    const biomeWallTiles = {
      cave: 'R',
      ice: 'F',
      industrial: '#'
    };

    occupied.forEach((index) => {
      const { col, row } = cellFromIndex(index);
      const biome = biomeMap[row]?.[col] || 'industrial';
      const roomType = pickOne(biomeRoomTypes[biome] || ['room']);
      const roomX = 1 + col * blockWidth + roomPadding;
      const roomY = 1 + row * blockHeight + roomPadding;
      const roomW = Math.max(6, blockWidth - roomPadding * 2);
      const roomH = Math.max(6, blockHeight - roomPadding * 2);
      const room = {
        x: roomX,
        y: roomY,
        w: roomW,
        h: roomH,
        type: roomType,
        biome,
        wallTile: biomeWallTiles[biome] || '#',
        cellIndex: index
      };
      placeRoom(room);
      if (roomType === 'cave') {
        carveCaveRoom(room);
      } else if (roomType === 'circular') {
        carveCircularRoom(room);
      } else {
        carveRectRoom(room);
      }
      addRoomDetails(room);
    });

    rooms.forEach((room) => {
      room.center = {
        x: Math.floor(room.x + room.w / 2),
        y: Math.floor(room.y + room.h / 2)
      };
      room.area = room.w * room.h;
    });

    const linkedPairs = new Set();
    const pairKey = (a, b) => {
      const left = Math.min(a, b);
      const right = Math.max(a, b);
      return `${left}:${right}`;
    };
    const roomByCell = new Map(rooms.map((room) => [room.cellIndex, room]));
    const addConnection = (aIndex, bIndex) => {
      const key = pairKey(aIndex, bIndex);
      if (linkedPairs.has(key)) return;
      linkedPairs.add(key);
      const fromRoom = roomByCell.get(aIndex);
      const toRoom = roomByCell.get(bIndex);
      if (!fromRoom || !toRoom) return;
      carveConnection(fromRoom, toRoom);
    };
    adjacency.forEach((neighbors, index) => {
      neighbors.forEach((neighbor) => addConnection(index, neighbor));
    });

    rooms.forEach((room) => {
      const { col, row } = cellFromIndex(room.cellIndex);
      const extraNeighbors = [];
      if (col > 0) extraNeighbors.push(cellIndex(col - 1, row));
      if (col < cols - 1) extraNeighbors.push(cellIndex(col + 1, row));
      if (row > 0) extraNeighbors.push(cellIndex(col, row - 1));
      if (row < rows - 1) extraNeighbors.push(cellIndex(col, row + 1));
      extraNeighbors.forEach((neighbor) => {
        if (!occupied.has(neighbor)) return;
        if (Math.random() < 0.25) addConnection(room.cellIndex, neighbor);
      });
    });

    const findRoomDoorTiles = (room) => {
      const doors = [];
      const topY = room.y;
      const bottomY = room.y + room.h - 1;
      const leftX = room.x;
      const rightX = room.x + room.w - 1;
      for (let x = leftX; x <= rightX; x += 1) {
        if (tiles[topY]?.[x] === 'D') doors.push({ x, y: topY, side: 'top' });
        if (tiles[bottomY]?.[x] === 'D') doors.push({ x, y: bottomY, side: 'bottom' });
      }
      for (let y = topY; y <= bottomY; y += 1) {
        if (tiles[y]?.[leftX] === 'D') doors.push({ x: leftX, y, side: 'left' });
        if (tiles[y]?.[rightX] === 'D') doors.push({ x: rightX, y, side: 'right' });
      }
      return doors;
    };

    const clearDoorFronts = () => {
      const clearDepth = 2;
      const extraSolidDepth = 3;
      const clearSpan = 0;
      const isSolidBlock = (room, tile) => tile === getRoomWallTile(room);
      rooms.forEach((room) => {
        const doors = findRoomDoorTiles(room);
        doors.forEach((door) => {
          if (door.side === 'top' || door.side === 'bottom') {
            const dir = door.side === 'top' ? 1 : -1;
            for (let dy = 1; dy <= clearDepth; dy += 1) {
              for (let dx = -clearSpan; dx <= clearSpan; dx += 1) {
                const nx = door.x + dx;
                const ny = door.y + dir * dy;
                if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                if (tiles[ny]?.[nx] !== 'D') setTile(nx, ny, '.');
              }
            }
            if (door.side === 'top') {
              for (let dy = clearDepth + 1; dy <= extraSolidDepth; dy += 1) {
                for (let dx = -clearSpan; dx <= clearSpan; dx += 1) {
                  const nx = door.x + dx;
                  const ny = door.y + dir * dy;
                  if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                  if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                  if (tiles[ny]?.[nx] !== 'D' && isSolidBlock(room, tiles[ny]?.[nx])) {
                    setTile(nx, ny, '.');
                  }
                }
              }
            }
          } else {
            const dir = door.side === 'left' ? 1 : -1;
            for (let dx = 1; dx <= clearDepth; dx += 1) {
              for (let dy = -clearSpan; dy <= clearSpan; dy += 1) {
                const nx = door.x + dir * dx;
                const ny = door.y + dy;
                if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                if (tiles[ny]?.[nx] !== 'D') setTile(nx, ny, '.');
              }
            }
          }
        });
      });
    };

    const addUpperDoorSupports = () => {
      const supportChance = 0.9;
      rooms.forEach((room) => {
        const topY = room.y;
        const supportY = room.y + 3;
        if (supportY >= room.y + room.h - 1) return;
        let segmentStart = null;
        for (let x = room.x; x <= room.x + room.w - 1; x += 1) {
          const isDoor = tiles[topY]?.[x] === 'D';
          if (isDoor && segmentStart === null) {
            segmentStart = x;
          }
          if ((!isDoor || x === room.x + room.w - 1) && segmentStart !== null) {
            const segmentEnd = isDoor ? x : x - 1;
            if (Math.random() < supportChance) {
              const supportChar = Math.random() < 0.55 ? '=' : getRoomWallTile(room);
              for (let sx = segmentStart; sx <= segmentEnd; sx += 1) {
                if (tiles[supportY]?.[sx] === '.') {
                  setTile(sx, supportY, supportChar);
                }
              }
            }
            segmentStart = null;
          }
        }
      });
    };

    const addLowerDoorPlatforms = () => {
      rooms.forEach((room) => {
        const bottomY = room.y + room.h - 1;
        const platformY = bottomY - 2;
        if (platformY <= room.y) return;
        let segmentStart = null;
        for (let x = room.x; x <= room.x + room.w - 1; x += 1) {
          const isDoor = tiles[bottomY]?.[x] === 'D';
          if (isDoor && segmentStart === null) {
            segmentStart = x;
          }
          if ((!isDoor || x === room.x + room.w - 1) && segmentStart !== null) {
            const segmentEnd = isDoor ? x : x - 1;
            for (let sx = segmentStart; sx <= segmentEnd; sx += 1) {
              if (tiles[platformY]?.[sx] === '.') {
                setTile(sx, platformY, '=');
              }
            }
            segmentStart = null;
          }
        }
      });
    };

    clearDoorFronts();
    addUpperDoorSupports();
    addLowerDoorPlatforms();

    let spawnRoom = rooms[0];
    let bestDistance = Infinity;
    rooms.forEach((room) => {
      const dist = Math.hypot(room.center.x - spawn.x, room.center.y - spawn.y);
      if (dist < bestDistance) {
        bestDistance = dist;
        spawnRoom = room;
      }
    });
    spawn.x = spawnRoom.center.x;
    spawn.y = spawnRoom.center.y;
    setTile(spawn.x, spawn.y, '.');

    const addHazardRooms = () => {
      const hazardTypes = ['L', 'A', '~'];
      const candidates = rooms.filter((room) => room !== spawnRoom && room.w >= 8 && room.h >= 8);
      if (candidates.length === 0) return;
      const targetCount = clamp(Math.floor(candidates.length * 0.3), 1, Math.min(4, candidates.length));
      for (let i = 0; i < targetCount; i += 1) {
        const index = randInt(0, candidates.length - 1);
        const room = candidates.splice(index, 1)[0];
        addHazardFloor(room, pickOne(hazardTypes));
      }
    };

    addHazardRooms();

    const addSpawnPitPlatform = () => {
      const wallTile = getRoomWallTile(spawnRoom);
      const topY = spawn.y + 1;
      const bottomY = spawn.y + 2;
      const leftX = spawn.x - 2;
      const rightX = spawn.x + 2;
      if (topY >= height || bottomY >= height) return;
      for (let x = leftX; x <= rightX; x += 1) {
        if (x < 0 || x >= width) continue;
        if (tiles[bottomY]?.[x] !== 'D') setTile(x, bottomY, wallTile);
        if (x === leftX || x === rightX) {
          if (tiles[topY]?.[x] !== 'D') setTile(x, topY, wallTile);
        } else if (tiles[topY]?.[x] !== 'D') {
          setTile(x, topY, '=');
        }
      }
    };

    addSpawnPitPlatform();

    const isSpawnBufferTile = (x, y) => Math.abs(x - spawn.x) <= 3 && Math.abs(y - spawn.y) <= 3;
    const isSpawnPlatformTile = (x, y) => {
      const dx = x - spawn.x;
      const dy = y - spawn.y;
      return (dy === 1 && Math.abs(dx) <= 2) || (dy === 2 && Math.abs(dx) <= 2);
    };
    const clearSpawnBufferTiles = () => {
      for (let y = spawn.y - 3; y <= spawn.y + 3; y += 1) {
        for (let x = spawn.x - 3; x <= spawn.x + 3; x += 1) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (isSpawnPlatformTile(x, y)) continue;
          setTile(x, y, '.');
        }
      }
    };

    clearSpawnBufferTiles();

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
    const regionCols = 3;
    const regionRows = 2;
    const regionWidth = Math.floor(width / regionCols);
    const regionHeight = Math.floor(height / regionRows);
    BIOME_THEMES.forEach((theme, index) => {
      const col = index % regionCols;
      const row = Math.floor(index / regionCols);
      const x = col * regionWidth;
      const y = row * regionHeight;
      const w = col === regionCols - 1 ? width - x : regionWidth;
      const h = row === regionRows - 1 ? height - y : regionHeight;
      regions.push({
        id: theme.id,
        name: theme.name,
        color: theme.color,
        rect: [x, y, w, h]
      });
    });

    const filteredEnemies = enemies.filter((enemy) => !isSpawnBufferTile(enemy.x, enemy.y));
    const filteredElevatorPaths = elevatorPaths.filter((path) => !isSpawnBufferTile(path.x, path.y));
    const filteredElevators = elevators.filter((platform) => !isSpawnBufferTile(platform.x, platform.y));

    const data = {
      schemaVersion: 1,
      tileSize: this.game.world.tileSize,
      width,
      height,
      spawn,
      tiles: tiles.map((row) => row.join('')),
      regions,
      enemies: filteredEnemies,
      elevatorPaths: filteredElevatorPaths,
      elevators: filteredElevators
    };

    this.game.applyWorldData(data);
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.persistAutosave();
    this.resetView();
  }

  undo() {
    const action = this.undoStack.pop();
    if (!action) return;
    this.applyAction(action, 'undo');
    this.redoStack.push(action);
    this.persistAutosave();
  }

  redo() {
    const action = this.redoStack.pop();
    if (!action) return;
    this.applyAction(action, 'redo');
    this.undoStack.push(action);
    this.persistAutosave();
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

    if (action.elevatorPaths) {
      const changes = direction === 'undo'
        ? action.elevatorPaths.map((path) => ({ x: path.x, y: path.y, active: path.prev }))
        : action.elevatorPaths.map((path) => ({ x: path.x, y: path.y, active: path.next }));
      changes.forEach((path) => {
        this.game.world.setElevatorPath(path.x, path.y, path.active);
      });
    }

    if (action.elevators) {
      const changes = direction === 'undo'
        ? action.elevators.map((platform) => ({ x: platform.x, y: platform.y, active: platform.prev }))
        : action.elevators.map((platform) => ({ x: platform.x, y: platform.y, active: platform.next }));
      changes.forEach((platform) => {
        this.game.world.setElevatorPlatform(platform.x, platform.y, platform.active);
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
    const elevatorPaths = Array.from(this.pendingElevatorPaths.values());
    const elevators = Array.from(this.pendingElevators.values());
    if (tiles.length > 0 || this.pendingSpawn || enemies.length > 0 || elevatorPaths.length > 0 || elevators.length > 0) {
      const action = {
        tiles,
        spawn: this.pendingSpawn,
        enemies,
        elevatorPaths,
        elevators
      };
      this.undoStack.push(action);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.game.refreshWorldCaches();
      this.persistAutosave();
    }
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.pendingElevatorPaths.clear();
    this.pendingElevators.clear();
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
    if (this.randomLevelDialog.open) {
      if (this.isPointInBounds(payload.x, payload.y, this.randomLevelSlider.bounds.width)) {
        this.randomLevelSlider.active = 'width';
        this.updateRandomLevelSlider('width', payload.x);
        return;
      }
      if (this.isPointInBounds(payload.x, payload.y, this.randomLevelSlider.bounds.height)) {
        this.randomLevelSlider.active = 'height';
        this.updateRandomLevelSlider('height', payload.x);
        return;
      }
      this.handleUIClick(payload.x, payload.y);
      return;
    }
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

    if (this.isMobileLayout()) {
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
    if (this.isMobileLayout()) {
      if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
        this.updatePanJoystick(payload.x, payload.y);
        return;
      }
      if (this.zoomSlider.active && (payload.id === undefined || this.zoomSlider.id === payload.id)) {
        this.updateZoomFromSlider(payload.x);
        return;
      }
    }

    if (this.randomLevelDialog.open && this.randomLevelSlider.active) {
      this.updateRandomLevelSlider(this.randomLevelSlider.active, payload.x);
      return;
    }
    if (this.randomLevelDialog.open) return;
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
      this.camera.x = this.panStart.camX - dx;
      this.camera.y = this.panStart.camY - dy;
      this.clampCamera();
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

    if (this.isMobileLayout()) {
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
    }

    if (this.randomLevelDialog.open && this.randomLevelSlider.active) {
      this.randomLevelSlider.active = null;
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
    this.camera.x = this.gestureStart.camX - dx;
    this.camera.y = this.gestureStart.camY - dy;
    this.clampCamera();
  }

  handleGestureEnd() {
    if (!this.active) return;
    this.gestureStart = null;
  }

  handleWheel(payload) {
    if (!this.active) return;
    if (!this.isMobileLayout() && this.panelScrollBounds) {
      const { x, y, w, h } = this.panelScrollBounds;
      if (payload.x >= x && payload.x <= x + w && payload.y >= y && payload.y <= y + h) {
        const activeTab = this.getActivePanelTab();
        const maxScroll = this.panelScrollMax[activeTab] || 0;
        const nextScroll = clamp((this.panelScroll[activeTab] || 0) + payload.deltaY, 0, maxScroll);
        this.panelScroll[activeTab] = nextScroll;
        return;
      }
    }
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

  updateRandomLevelSlider(kind, x) {
    const bounds = this.randomLevelSlider.bounds[kind];
    if (!bounds || bounds.w <= 0) return;
    const t = clamp((x - bounds.x) / bounds.w, 0, 1);
    const min = bounds.min;
    const max = bounds.max;
    const value = Math.round(min + (max - min) * t);
    if (kind === 'width') {
      this.randomLevelSize.width = value;
    } else {
      this.randomLevelSize.height = value;
    }
  }

  getCameraBounds() {
    const tileSize = this.game.world.tileSize;
    const worldW = this.game.world.width * tileSize;
    const worldH = this.game.world.height * tileSize;
    const viewW = this.game.canvas.width / this.zoom;
    const viewH = this.game.canvas.height / this.zoom;
    let extraLeft = 0;
    let extraRight = 0;
    if (this.isMobileLayout()) {
      extraLeft = (this.drawerBounds?.w || 0) / this.zoom;
    } else {
      extraRight = 372 / this.zoom;
    }
    const minX = -extraLeft;
    const maxX = Math.max(worldW - viewW + extraRight, minX);
    const minY = 0;
    const maxY = Math.max(worldH - viewH, minY);
    return { minX, maxX, minY, maxY };
  }

  clampCamera() {
    const bounds = this.getCameraBounds();
    this.camera.x = clamp(this.camera.x, bounds.minX, bounds.maxX);
    this.camera.y = clamp(this.camera.y, bounds.minY, bounds.maxY);
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
      if (this.tileType.special === 'elevator-path') {
        this.setElevatorPath(safeX, safeY, false);
        return;
      }
      if (this.tileType.special === 'elevator-platform') {
        this.setElevatorPlatform(safeX, safeY, false);
        return;
      }
      this.setTile(safeX, safeY, '.');
      return;
    }

    if (this.tileType.special === 'spawn') {
      this.setSpawn(safeX, safeY);
      return;
    }

    if (this.tileType.special === 'elevator-path') {
      this.setElevatorPath(safeX, safeY, true);
      return;
    }

    if (this.tileType.special === 'elevator-platform') {
      this.setElevatorPlatform(safeX, safeY, true);
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
    let triangleChar = char;
    if (char === '^' || char === 'v') {
      const highPoint = start.y <= end.y ? start : end;
      const lowPoint = start.y <= end.y ? end : start;
      if (lowPoint.x !== highPoint.x) {
        triangleChar = lowPoint.x > highPoint.x ? 'v' : '^';
      }
    }

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
            tiles.push({ x, y, char: triangleChar });
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
            tiles.push({ x, y, char: triangleChar });
          }
        }
      }
    }
    return tiles;
  }

  buildPrefabTiles(start, end) {
    const bounds = this.getDragBounds(start, end);
    const prefab = {
      tiles: [],
      elevatorPaths: [],
      elevators: []
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;
    const addTile = (x, y, char) => {
      prefab.tiles.push({ x, y, char });
    };
    const addElevatorPath = (x, y) => {
      prefab.elevatorPaths.push({ x, y });
    };
    const addElevatorPlatform = (x, y) => {
      prefab.elevators.push({ x, y });
    };
    const buildFixed = (width, height, callback) => {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const tileX = start.x + signX * x;
          const tileY = start.y + signY * y;
          const char = callback(x, y, width, height);
          if (char) addTile(tileX, tileY, char);
        }
      }
    };

    if (this.prefabType.id === 'room' || this.prefabType.id === 'arena') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const wall = x === bounds.x1 || x === bounds.x2 || y === bounds.y1 || y === bounds.y2;
          addTile(x, y, wall ? '#' : '.');
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
          addTile(x, y, wall ? '#' : '.');
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
          addTile(x, y, wall ? '#' : '.');
        }
      }
    } else if (this.prefabType.id === 'corridor') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          addTile(x, start.y, '.');
          addTile(x, start.y + signY, '.');
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          addTile(start.x, y, '.');
          addTile(start.x + signX, y, '.');
        }
      }
    } else if (this.prefabType.id === 'staircase') {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i += 1) {
        addTile(start.x + signX * i, start.y + signY * i, '#');
      }
    } else if (this.prefabType.id === 'platform') {
      for (let x = bounds.x1; x <= bounds.x2; x += 1) {
        addTile(x, start.y, '=');
      }
    } else if (this.prefabType.id === 'puzzle') {
      const switchTile = { x: start.x, y: start.y, char: 'T' };
      const doorTile = { x: end.x, y: end.y, char: 'B' };
      addTile(switchTile.x, switchTile.y, switchTile.char);
      addTile(doorTile.x, doorTile.y, doorTile.char);
      if (Math.abs(dx) >= Math.abs(dy)) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        for (let x = minX + 1; x < maxX; x += 1) {
          addTile(x, start.y, 'a');
        }
      } else {
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        for (let y = minY + 1; y < maxY; y += 1) {
          addTile(start.x, y, 'a');
        }
      }
    } else if (this.prefabType.id === 'door') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          addTile(x, y, 'D');
        }
      }
    } else if (this.prefabType.id === 'water-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : '~';
      });
    } else if (this.prefabType.id === 'lava-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : 'L';
      });
    } else if (this.prefabType.id === 'acid-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : 'A';
      });
    } else if (this.prefabType.id === 'spike-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : '*';
      });
    } else if (this.prefabType.id === 'spike-wall-pit') {
      buildFixed(6, 3, (x, y, width, height) => {
        if (y === height - 1) return '#';
        if (y === 0) return x === 0 || x === width - 1 ? '#' : '.';
        return x === 0 || x === width - 1 ? '*' : '.';
      });
    } else if (this.prefabType.id === 'spike-ceiling-pit') {
      buildFixed(6, 3, (x, y, width, height) => {
        if (y === height - 1) return '#';
        if (y === 0) return x === 0 || x === width - 1 ? '#' : '*';
        return x === 0 || x === width - 1 ? '#' : '.';
      });
    } else if (this.prefabType.id === 'large-t-solid') {
      buildFixed(7, 6, (x, y) => {
        if (y === 0) return '#';
        return x >= 2 && x <= 4 ? '#' : null;
      });
    } else if (this.prefabType.id === 'large-t-ice') {
      buildFixed(7, 6, (x, y) => {
        if (y === 0) return 'I';
        return x >= 2 && x <= 4 ? 'I' : null;
      });
    } else if (this.prefabType.id === 'solid-platform') {
      buildFixed(6, 1, () => '#');
    } else if (this.prefabType.id === 'industrial-platform') {
      buildFixed(6, 1, () => '#');
    } else if (this.prefabType.id === 'conveyor-belt') {
      const dir = signX < 0 ? '<' : '>';
      buildFixed(6, 1, () => dir);
    } else if (this.prefabType.id === 'elevator') {
      const height = 6;
      for (let y = 0; y < height; y += 1) {
        const tileX = start.x;
        const tileY = start.y + signY * y;
        addTile(tileX, tileY, '.');
        addElevatorPath(tileX, tileY);
      }
      addElevatorPlatform(start.x, start.y + signY * (height - 1));
    } else if (this.prefabType.id === 'moving-platform') {
      const width = 6;
      for (let x = 0; x < width; x += 1) {
        const tileX = start.x + signX * x;
        const tileY = start.y;
        addTile(tileX, tileY, '.');
        addElevatorPath(tileX, tileY);
      }
      addElevatorPlatform(start.x, start.y);
    } else if (this.prefabType.id === 'stalactite') {
      const widths = [7, 7, 5, 5, 3, 3, 1];
      buildFixed(7, 7, (x, y, width) => {
        const rowWidth = widths[y] || 1;
        const left = Math.floor((width - rowWidth) / 2);
        return x >= left && x < left + rowWidth ? '#' : null;
      });
    } else if (this.prefabType.id === 'stalagmite') {
      const widths = [1, 3, 3, 5, 5, 7, 7];
      buildFixed(7, 7, (x, y, width) => {
        const rowWidth = widths[y] || 1;
        const left = Math.floor((width - rowWidth) / 2);
        return x >= left && x < left + rowWidth ? '#' : null;
      });
    } else if (this.prefabType.id === 'cave-platform') {
      buildFixed(6, 4, (x, y, width, height) => {
        const edgeRows = y === 0 || y === height - 1;
        if (edgeRows) {
          return x >= 1 && x <= width - 2 ? '#' : null;
        }
        return '#';
      });
    }
    return prefab;
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
    const prefab = this.buildPrefabTiles(start, end);
    prefab.tiles.forEach((tile) => {
      const ensured = this.ensureInBounds(tile.x, tile.y);
      if (!ensured) return;
      this.setTile(ensured.tileX, ensured.tileY, tile.char);
    });
    prefab.elevatorPaths.forEach((path) => {
      const ensured = this.ensureInBounds(path.x, path.y);
      if (!ensured) return;
      this.setElevatorPath(ensured.tileX, ensured.tileY, true);
    });
    prefab.elevators.forEach((platform) => {
      const ensured = this.ensureInBounds(platform.x, platform.y);
      if (!ensured) return;
      this.setElevatorPlatform(ensured.tileX, ensured.tileY, true);
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

  recordElevatorPathChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingElevatorPaths.has(key)) {
      this.pendingElevatorPaths.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingElevatorPaths.get(key);
      entry.next = next;
    }
  }

  recordElevatorPlatformChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingElevators.has(key)) {
      this.pendingElevators.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingElevators.get(key);
      entry.next = next;
    }
  }

  setElevatorPath(tileX, tileY, active) {
    const prev = this.game.world.hasElevatorPath(tileX, tileY);
    if (prev === active) return;
    this.game.world.setElevatorPath(tileX, tileY, active);
    this.triggerHaptic();
    this.recordElevatorPathChange(tileX, tileY, prev, active);
  }

  setElevatorPlatform(tileX, tileY, active) {
    const prev = this.game.world.hasElevatorPlatform(tileX, tileY);
    if (prev === active) return;
    this.game.world.setElevatorPlatform(tileX, tileY, active);
    this.triggerHaptic();
    this.recordElevatorPlatformChange(tileX, tileY, prev, active);
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
    this.clearSpawnBuffer(tileX, tileY);
  }

  isSpawnPlatformTile(spawnX, spawnY, tileX, tileY) {
    const dx = tileX - spawnX;
    const dy = tileY - spawnY;
    return (dy === 1 && Math.abs(dx) <= 2) || (dy === 2 && Math.abs(dx) <= 2);
  }

  clearSpawnBuffer(spawnX, spawnY) {
    for (let y = spawnY - 3; y <= spawnY + 3; y += 1) {
      for (let x = spawnX - 3; x <= spawnX + 3; x += 1) {
        if (!this.isInBounds(x, y)) continue;
        if (this.isSpawnPlatformTile(spawnX, spawnY, x, y)) continue;
        if (this.game.world.hasElevatorPath(x, y)) {
          this.setElevatorPath(x, y, false);
        }
        if (this.game.world.hasElevatorPlatform(x, y)) {
          this.setElevatorPlatform(x, y, false);
        }
        if (this.game.world.enemyAt(x, y)) {
          this.removeEnemy(x, y);
        }
        this.setTile(x, y, '.');
      }
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
    if (this.game.world.hasElevatorPlatform(tileX, tileY)) {
      return { kind: 'elevator', origin: { x: tileX, y: tileY } };
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
    if (kind === 'elevator') {
      this.setElevatorPlatform(origin.x, origin.y, false);
      this.setElevatorPlatform(safeX, safeY, true);
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
    if (this.game.world.hasElevatorPlatform(tileX, tileY)) {
      const platformTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'elevator-platform');
      if (platformTile) {
        this.setTileType(platformTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
    if (this.game.world.hasElevatorPath(tileX, tileY)) {
      const pathTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'elevator-path');
      if (pathTile) {
        this.setTileType(pathTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
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
    this.clampCamera();
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
    this.game.drawWorld(ctx, { showDoors: true });
    this.drawEditorMarkers(ctx);
    this.drawGrid(ctx);
    this.drawCursor(ctx);
    ctx.restore();
    this.drawHUD(ctx, canvas.width, canvas.height);
  }

  drawEditorMarkers(ctx) {
    const { tileSize } = this.game.world;
    if (this.game.world.elevatorPaths?.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,0.7)';
      ctx.lineWidth = 2;
      this.game.world.elevatorPaths.forEach((path) => {
        const cx = path.x * tileSize + tileSize / 2;
        const cy = path.y * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy);
        ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx, cy + 6);
        ctx.stroke();
      });
      ctx.restore();
    }
    if (this.game.world.elevators?.length) {
      ctx.save();
      ctx.strokeStyle = '#ffd36a';
      ctx.lineWidth = 2;
      this.game.world.elevators.forEach((platform) => {
        const x = platform.x * tileSize + 6;
        const y = platform.y * tileSize + tileSize / 2 - 6;
        ctx.strokeRect(x, y, tileSize - 12, 12);
      });
      ctx.restore();
    }
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
      const prefabPreviewTiles = Array.isArray(previewTiles)
        ? previewTiles
        : [
          ...previewTiles.tiles,
          ...previewTiles.elevatorPaths.map((tile) => ({ ...tile, char: '.' })),
          ...previewTiles.elevators.map((tile) => ({ ...tile, char: '.' }))
        ];
      const previewColor = this.mode === 'shape'
        ? 'rgba(100,200,255,0.2)'
        : 'rgba(190,170,255,0.2)';
      drawGhostTiles(prefabPreviewTiles, previewColor);
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
      if (this.tileType.special === 'elevator-path') {
        ctx.strokeStyle = 'rgba(180,240,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ghostX + tileSize / 2 - 6, ghostY + tileSize / 2);
        ctx.lineTo(ghostX + tileSize / 2 + 6, ghostY + tileSize / 2);
        ctx.moveTo(ghostX + tileSize / 2, ghostY + tileSize / 2 - 6);
        ctx.lineTo(ghostX + tileSize / 2, ghostY + tileSize / 2 + 6);
        ctx.stroke();
      } else if (this.tileType.special === 'elevator-platform') {
        ctx.strokeStyle = 'rgba(255,220,140,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ghostX + 6, ghostY + tileSize / 2 - 6, tileSize - 12, 12);
      } else if (this.tileType.char) {
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
    const tileToolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles. (E)' },
      { id: 'move', label: 'Move', tooltip: 'Move items or pan. (M)' }
    ];
    ctx.save();
    ctx.font = '13px Courier New';
    ctx.textAlign = 'left';
    this.uiButtons = [];
    let hoverTooltip = '';
    const pointer = this.lastPointer;
    this.randomLevelSlider.bounds.width = null;
    this.randomLevelSlider.bounds.height = null;

    const isHovered = (x, y, w, h) => (
      pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h
    );

    const drawTilePreview = (x, y, size, tile) => {
      const char = tile?.char;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, size, size);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      if (tile?.special === 'spawn') {
        ctx.strokeStyle = '#ff6';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
        ctx.beginPath();
        ctx.moveTo(centerX, y + 4);
        ctx.lineTo(centerX, y + size - 4);
        ctx.stroke();
      } else if (tile?.special === 'elevator-path') {
        ctx.strokeStyle = 'rgba(140,220,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - size * 0.25, centerY);
        ctx.lineTo(centerX + size * 0.25, centerY);
        ctx.moveTo(centerX, centerY - size * 0.25);
        ctx.lineTo(centerX, centerY + size * 0.25);
        ctx.stroke();
      } else if (tile?.special === 'elevator-platform') {
        ctx.strokeStyle = 'rgba(255,220,140,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, centerY - size * 0.15, size - 8, size * 0.3);
      } else if (char === '#') {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      } else if (char === '^') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + 2);
        ctx.closePath();
        ctx.fill();
      } else if (char === 'v') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + size - 2);
        ctx.closePath();
        ctx.fill();
      } else if (char === '=') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 3, centerY);
        ctx.lineTo(x + size - 3, centerY);
        ctx.stroke();
      } else if (char === 'e' || char === 'E') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(centerX, y + 4);
        ctx.lineTo(centerX, y + size - 4);
        ctx.stroke();
        if (char === 'E') {
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + size - 4, y + 4);
          ctx.moveTo(x + 4, y + size - 4);
          ctx.lineTo(x + size - 4, y + size - 4);
          ctx.stroke();
        }
      } else if (char === '~' || char === 'A' || char === 'L') {
        ctx.fillStyle = char === '~' ? '#3b9fe0' : char === 'A' ? '#36c777' : '#f25a42';
        ctx.fillRect(x + 2, y + size / 2, size - 4, size / 2 - 2);
      } else if (char === '*') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + size - 4);
        ctx.lineTo(centerX, y + size / 2);
        ctx.lineTo(x + size - 4, y + size - 4);
        ctx.stroke();
      } else if (char === 'I') {
        ctx.fillStyle = '#8fd6ff';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      } else if (char === '<' || char === '>') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        if (char === '<') {
          ctx.moveTo(x + size - 4, centerY);
          ctx.lineTo(x + 4, centerY);
          ctx.lineTo(x + 8, centerY - 4);
          ctx.moveTo(x + 4, centerY);
          ctx.lineTo(x + 8, centerY + 4);
        } else {
          ctx.moveTo(x + 4, centerY);
          ctx.lineTo(x + size - 4, centerY);
          ctx.lineTo(x + size - 8, centerY - 4);
          ctx.moveTo(x + size - 4, centerY);
          ctx.lineTo(x + size - 8, centerY + 4);
        }
        ctx.stroke();
      } else if (char === 'D') {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
        ctx.beginPath();
        ctx.moveTo(centerX, y + 5);
        ctx.lineTo(centerX, y + size - 5);
        ctx.stroke();
      } else if (char === 'a') {
        ctx.strokeStyle = '#6cf';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size * 0.18);
        ctx.lineTo(centerX, centerY + size * 0.18);
        ctx.stroke();
      } else if (char) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.toUpperCase(), centerX, centerY + 1);
      }
      ctx.restore();
    };

    const drawPrefabPreview = (x, y, size, prefab) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(x, y, size, size);
      ctx.fillStyle = 'rgba(180,180,255,0.12)';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#fff';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prefab?.short || prefab?.label?.slice(0, 2) || 'PR', x + size / 2, y + size / 2);
      ctx.restore();
    };

    const drawButton = (x, y, w, h, label, active, onClick, tooltip = '', preview = null) => {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.textBaseline = 'middle';
      const previewSize = preview ? Math.min(22, h - 8) : 0;
      const previewX = x + 8;
      const previewY = y + (h - previewSize) / 2;
      if (preview?.type === 'tile') {
        drawTilePreview(previewX, previewY, previewSize, preview.tile);
      } else if (preview?.type === 'prefab') {
        drawPrefabPreview(previewX, previewY, previewSize, preview.prefab);
      }
      const textOffset = preview ? previewSize + 14 : 8;
      ctx.fillText(label, x + textOffset, y + h / 2);
      ctx.restore();
      this.addUIButton({ x, y, w, h }, onClick, tooltip);
      if (tooltip && !this.isMobileLayout() && isHovered(x, y, w, h)) {
        hoverTooltip = tooltip;
      }
    };

    const drawSlider = (x, y, w, label, value, min, max, kind) => {
      const clampedValue = clamp(value, min, max);
      const t = max === min ? 0 : (clampedValue - min) / (max - min);
      const h = 10;
      const knobX = x + t * w;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(knobX, y + h / 2, h * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${label}: ${Math.round(clampedValue)}`, x, y - 4);
      ctx.restore();
      this.randomLevelSlider.bounds[kind] = { x, y: y - 16, w, h: h + 26, min, max };
    };

    const controlMargin = 18;
    const controlBase = Math.min(width, height);
    let joystickRadius = 0;
    let knobRadius = 0;
    let joystickCenter = { x: 0, y: 0 };
    let sliderX = 0;
    let sliderWidth = 0;
    const sliderHeight = 10;
    let sliderY = height;

    if (this.isMobileLayout()) {
      joystickRadius = Math.min(78, controlBase * 0.14);
      knobRadius = Math.max(22, joystickRadius * 0.45);
      joystickCenter = {
        x: controlMargin + joystickRadius,
        y: height - controlMargin - joystickRadius
      };
      this.panJoystick.center = joystickCenter;
      this.panJoystick.radius = joystickRadius;
      this.panJoystick.knobRadius = knobRadius;

      sliderX = joystickCenter.x + joystickRadius + 24;
      sliderWidth = width - sliderX - controlMargin;
      sliderY = height - controlMargin - sliderHeight;
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
    } else {
      this.panJoystick.center = { x: 0, y: 0 };
      this.panJoystick.radius = 0;
      this.panJoystick.knobRadius = 0;
      this.zoomSlider.bounds = { x: 0, y: 0, w: 0, h: 0 };
    }

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
        const isPreviewTab = activeTab === 'tiles' || activeTab === 'prefabs';
        const buttonHeight = isPreviewTab ? 52 : 44;
        const buttonGap = 10;
        const contentX = panelX + 12;
        const contentW = panelW - 24;
        let items = [];
        let columns = 2;

        if (activeTab === 'tools') {
          items = [
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
              id: 'undo',
              label: 'UNDO',
              active: false,
              tooltip: 'Undo last change (Ctrl+Z)',
              onClick: () => this.undo()
            },
            {
              id: 'redo',
              label: 'REDO',
              active: false,
              tooltip: 'Redo last change (Ctrl+Y)',
              onClick: () => this.redo()
            },
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
            preview: { type: 'tile', tile },
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
            preview: { type: 'prefab', prefab },
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
          drawButton(x, y, columnWidth, buttonHeight, item.label, item.active, item.onClick, item.tooltip, item.preview);
        });

      }
      this.panelScrollBounds = null;
      this.panelScrollView = null;
    } else {
      this.editorBounds = { x: 0, y: 0, w: width, h: height };
      const panelWidth = 360;
      const panelX = width - panelWidth - 12;
      const panelY = 12;
      const panelH = height - 24;
      const tabs = [
        { id: 'tools', label: 'TOOLS' },
        { id: 'tiles', label: 'TILES' },
        { id: 'enemies', label: 'ENEMIES' },
        { id: 'prefabs', label: 'STRUCTURES' },
        { id: 'shapes', label: 'SHAPES' }
      ];
      const tabMargin = 12;
      const tabGap = 6;
      const tabHeight = 26;
      const tabWidth = (panelWidth - tabMargin * 2 - tabGap * (tabs.length - 1)) / tabs.length;
      const tabY = panelY;
      const activeTab = this.getActivePanelTab();

      tabs.forEach((tab, index) => {
        const x = panelX + tabMargin + index * (tabWidth + tabGap);
        drawButton(
          x,
          tabY,
          tabWidth,
          tabHeight,
          tab.label,
          activeTab === tab.id,
          () => this.setPanelTab(tab.id),
          `${tab.label} panel`
        );
      });

      const contentY = tabY + tabHeight + 10;
      const contentHeight = Math.max(0, panelY + panelH - contentY);
      const contentX = panelX;
      const contentW = panelWidth;
      const contentPadding = 12;
      const buttonGap = 8;
      const isTallButtons = activeTab === 'tiles' || activeTab === 'prefabs';
      const buttonHeight = isTallButtons ? 36 : 28;
      const { items, columns } = this.getPanelConfig(activeTab);

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(contentX, contentY, contentW, contentHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(contentX, contentY, contentW, contentHeight);

      const columnWidth = (contentW - contentPadding * 2 - buttonGap * (columns - 1)) / columns;
      const rows = Math.ceil(items.length / columns);
      const totalHeight = rows * (buttonHeight + buttonGap) - buttonGap + contentPadding * 2;
      const maxScroll = Math.max(0, totalHeight - contentHeight);
      this.panelScrollMax[activeTab] = maxScroll;
      const scrollY = clamp(this.panelScroll[activeTab] || 0, 0, maxScroll);
      this.panelScroll[activeTab] = scrollY;
      this.panelScrollBounds = { x: contentX, y: contentY, w: contentW, h: contentHeight };
      this.panelScrollView = {
        contentHeight,
        buttonHeight,
        buttonGap,
        columns,
        padding: contentPadding
      };

      const getActiveState = (item) => {
        if (activeTab === 'tools') {
          if (item.id.startsWith('mode-')) {
            return this.mode === item.id.replace('mode-', '');
          }
          if (item.id.startsWith('tile-')) {
            return this.mode === 'tile' && this.tileTool === item.id.replace('tile-', '');
          }
          return false;
        }
        if (activeTab === 'tiles') return this.tileType.id === item.id;
        if (activeTab === 'enemies') return this.enemyType.id === item.id;
        if (activeTab === 'prefabs') return this.prefabType.id === item.id;
        if (activeTab === 'shapes') return this.shapeTool.id === item.id;
        return false;
      };

      items.forEach((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = contentX + contentPadding + col * (columnWidth + buttonGap);
        const y = contentY + contentPadding + row * (buttonHeight + buttonGap) - scrollY;
        if (y + buttonHeight < contentY + 4 || y > contentY + contentHeight - 4) return;
        const preview = item.tile
          ? { type: 'tile', tile: item.tile }
          : item.prefab
            ? { type: 'prefab', prefab: item.prefab }
            : null;
        drawButton(x, y, columnWidth, buttonHeight, item.label, getActiveState(item), item.onClick, item.tooltip, preview);
      });

      const infoLines = [
        `Mode: ${modeLabel} | Tool: ${tileToolLabel}`,
        `Tile: ${tileLabel} | Enemy: ${enemyLabel}`,
        `Prefab: ${prefabLabel} | Shape: ${shapeLabel}`,
        `Grid: ${tileSize}px | Region: ${this.regionName}`,
        `Zoom: ${this.zoom.toFixed(2)}x`,
        `Drag: LMB paint | RMB erase | Space+drag pan`,
        `Move: drag to reposition | Two-finger: pan/zoom`,
        `Arrows: pan | Shift+Arrows: zoom`,
        `Gamepad: LS cursor | D-pad tools | A paint | B erase | X tool | Y mode`,
        `LB/RB tabs | LT/RT zoom | Start exit | Back playtest`,
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

    if (this.isMobileLayout()) {
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
    }

    if (this.randomLevelDialog.open) {
      const dialogW = Math.min(420, width * 0.8);
      const dialogH = 170;
      const dialogX = (width - dialogW) / 2;
      const dialogY = (height - dialogH) / 2;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(12,14,18,0.95)';
      ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Random Level Size', dialogX + dialogW / 2, dialogY + 12);

      const sliderW = dialogW - 40;
      const sliderX = dialogX + 20;
      const sliderY = dialogY + 56;
      drawSlider(sliderX, sliderY, sliderW, 'Width', this.randomLevelSize.width, 50, 256, 'width');
      drawSlider(sliderX, sliderY + 32, sliderW, 'Height', this.randomLevelSize.height, 30, 256, 'height');

      const buttonW = 110;
      const buttonH = 28;
      const buttonY = dialogY + dialogH - 42;
      drawButton(
        dialogX + dialogW / 2 - buttonW - 10,
        buttonY,
        buttonW,
        buttonH,
        'CANCEL',
        false,
        () => this.cancelRandomLevel(),
        'Cancel random level'
      );
      drawButton(
        dialogX + dialogW / 2 + 10,
        buttonY,
        buttonW,
        buttonH,
        'OK',
        false,
        () => this.confirmRandomLevel(),
        'Generate random level'
      );
      ctx.restore();
    }

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
    const sliderSafeY = this.isMobileLayout()
      ? sliderY - tooltipHeight - 12
      : baseTooltipY;
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
