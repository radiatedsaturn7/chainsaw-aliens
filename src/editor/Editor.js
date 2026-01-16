const DEFAULT_TILE_TYPES = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'hazard', label: 'Hazard', char: '!' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'wood', label: 'Wood Barricade', char: 'W' },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C' },
  { id: 'debris', label: 'Heavy Debris', char: 'U' },
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
  { id: 'slicer', label: 'Slicer', glyph: 'SL' },
  { id: 'hivenode', label: 'Hive Node', glyph: 'HN' },
  { id: 'sentinel', label: 'Sentinel', glyph: 'SE' },
  { id: 'finalboss', label: 'Rift Tyrant', glyph: 'RT' }
];

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle Fill', short: 'RECT' },
  { id: 'hollow', label: 'Hollow Rectangle', short: 'HOLL' },
  { id: 'line', label: 'Line', short: 'LINE' },
  { id: 'stair', label: 'Stair Generator', short: 'ST' },
  { id: 'triangle', label: 'Triangle Placeholder', short: 'TRI', placeholder: true }
];

const PREFAB_TYPES = [
  { id: 'room', label: 'Room', short: 'RM' },
  { id: 'corridor', label: 'Corridor', short: 'CR' },
  { id: 'staircase', label: 'Staircase', short: 'SC' },
  { id: 'platform', label: 'Platform Run', short: 'PL' },
  { id: 'arena', label: 'Arena', short: 'AR' },
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

  beginStroke(mode, tileX, tileY) {
    this.dragging = true;
    this.dragMode = mode;
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

  handlePointerUp() {
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
    } else if (this.prefabType.id === 'corridor') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y: start.y, char: '.' });
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          tiles.push({ x: start.x, y, char: '.' });
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
      }))
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

    if (this.isMobileLayout()) {
      const drawerHeight = Math.min(260, height * 0.36);
      const collapsedHeight = 56;
      const panelH = this.drawer.open ? drawerHeight : collapsedHeight;
      const panelX = 0;
      const panelY = height - panelH;
      const panelW = width;
      this.editorBounds = { x: 0, y: 0, w: width, h: height - panelH };
      this.drawerBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(8,10,12,0.9)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      const handleAreaH = 24;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(panelX, panelY, panelW, handleAreaH);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(panelX + panelW / 2 - 24, panelY + 9, 48, 5);
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
          summary = `${modeLabel} (${tileToolLabel}) • ${tileLabel}`;
        } else if (this.mode === 'enemy') {
          summary = `${modeLabel} • ${enemyLabel}`;
        } else if (this.mode === 'prefab') {
          summary = `${modeLabel} • ${prefabLabel}`;
        } else if (this.mode === 'shape') {
          summary = `${modeLabel} • ${shapeLabel}`;
        }
        ctx.fillText(summary, panelW / 2, panelY + 42);
      } else {
        const tabs = [
          { id: 'tools', label: 'TOOLS' },
          { id: 'tiles', label: 'TILES' },
          { id: 'enemies', label: 'ENEMIES' },
          { id: 'prefabs', label: 'STRUCTURES' },
          { id: 'shapes', label: 'SHAPES' }
        ];
        const activeTab = this.drawer.tabs[this.drawer.tabIndex];
        const tabMargin = 16;
        const tabGap = 10;
        const tabHeight = 28;
        const tabWidth = (panelW - tabMargin * 2 - tabGap * (tabs.length - 1)) / tabs.length;
        const tabY = panelY + handleAreaH + 10;
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

        const contentY = tabY + tabHeight + 12;
        const contentHeight = panelY + panelH - contentY - 16;
        const buttonHeight = 44;
        const buttonGap = 10;
        const contentX = panelX + 16;
        const contentW = panelW - 32;
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
    const tooltipY = this.isMobileLayout()
      ? this.editorBounds.y + this.editorBounds.h - tooltipHeight
      : height - tooltipHeight;
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
