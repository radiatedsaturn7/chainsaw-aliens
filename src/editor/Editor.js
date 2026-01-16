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

const TOOL_LABELS = {
  paint: 'Paint',
  erase: 'Erase',
  select: 'Select',
  move: 'Move',
  enemy: 'Enemy',
  pan: 'Pan',
  zoom: 'Zoom'
};

export default class Editor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.tool = 'paint';
    this.tileType = DEFAULT_TILE_TYPES[0];
    this.customTile = null;
    this.enemyType = ENEMY_TYPES[0];
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
    this.uiSections = { tools: true, tiles: true, enemies: true };
    this.mobileTab = 'tools';
    this.activeTooltip = '';
    this.tooltipTimer = 0;
    this.editorBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.moveSelection = null;
    this.moveTarget = null;

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
    if (input.wasPressedCode('KeyQ')) this.tool = 'paint';
    if (input.wasPressedCode('KeyE')) this.tool = 'erase';
    if (input.wasPressedCode('KeyR')) this.tool = 'select';
    if (input.wasPressedCode('KeyM')) this.tool = 'move';
    if (input.wasPressedCode('KeyT')) this.tool = 'enemy';
    if (input.wasPressedCode('KeyZ')
      && !input.isShiftDown()
      && !input.isDownCode('ControlLeft')
      && !input.isDownCode('ControlRight')) {
      this.tool = 'zoom';
    }
    if (input.wasPressedCode('KeyX')) this.tool = 'pan';

    for (let i = 1; i <= 9; i += 1) {
      if (input.wasPressedCode(`Digit${i}`)) {
        const type = DEFAULT_TILE_TYPES[i - 1];
        if (type) {
          this.tileType = type;
          this.customTile = null;
          this.tool = 'paint';
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
    if (mode === 'select') {
      this.selectTile(tileX, tileY);
      this.dragging = false;
      this.dragMode = null;
      return;
    }
    if (mode === 'move') {
      const selection = this.pickMoveSelection(tileX, tileY);
      if (!selection) {
        this.dragging = false;
        this.dragMode = null;
        return;
      }
      this.moveSelection = selection;
      this.moveTarget = { x: tileX, y: tileY };
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
      return;
    }
    if (this.dragMode === 'zoom') {
      this.dragging = false;
      this.dragMode = null;
      this.zoomStart = null;
      return;
    }
    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      this.applyMove(this.moveTarget.x, this.moveTarget.y);
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
  }

  handlePointerDown(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.handleUIClick(payload.x, payload.y)) return;
    if (this.isMobileLayout() && !this.isPointerInEditorArea(payload.x, payload.y)) return;
    this.dragButton = payload.button;
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (payload.button === 1 || (payload.button === 0 && this.game.input.isDownCode('Space'))) {
      this.beginStroke('pan', tileX, tileY);
      return;
    }

    if (payload.button === 2) {
      if (this.tool === 'enemy') {
        this.beginStroke('enemy', tileX, tileY);
      } else {
        this.tool = 'erase';
        this.beginStroke('erase', tileX, tileY);
      }
      return;
    }

    if (this.tool === 'select') {
      this.beginStroke('select', tileX, tileY);
      return;
    }

    if (this.tool === 'pan') {
      this.beginStroke('pan', tileX, tileY);
      return;
    }

    if (this.tool === 'zoom') {
      this.beginStroke('zoom', tileX, tileY);
      return;
    }

    if (this.tool === 'erase') {
      this.beginStroke('erase', tileX, tileY);
      return;
    }

    if (this.tool === 'move') {
      this.beginStroke('move', tileX, tileY);
      return;
    }

    if (this.tool === 'enemy') {
      this.beginStroke('enemy', tileX, tileY);
      return;
    }

    this.tool = 'paint';
    this.beginStroke('paint', tileX, tileY);
  }

  handlePointerMove(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
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
    this.endStroke();
  }

  handleGestureStart(payload) {
    if (!this.active) return;
    this.dragging = false;
    this.dragMode = null;
    this.panStart = null;
    this.zoomStart = null;
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

  setTile(tileX, tileY, char) {
    const key = `${tileX},${tileY}`;
    const prev = this.game.world.getTile(tileX, tileY);
    if (prev === char) return;
    this.game.world.setTile(tileX, tileY, char);

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
    this.recordEnemyChange(tileX, tileY, prev?.type || null, type);
  }

  removeEnemy(tileX, tileY) {
    const prev = this.game.world.enemyAt(tileX, tileY);
    if (!prev) return;
    this.game.world.removeEnemy(tileX, tileY);
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
      this.tileType = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'spawn');
      this.customTile = null;
      return;
    }
    const char = this.game.world.getTile(tileX, tileY);
    const known = DEFAULT_TILE_TYPES.find((tile) => tile.char === char);
    if (known) {
      this.tileType = known;
      this.customTile = null;
      return;
    }
    this.customTile = { id: 'custom', label: `Tile ${char}`, char };
    this.tileType = this.customTile;
  }

  updateHover() {
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
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
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
      ctx.lineWidth = 2;
      ctx.strokeRect(tileX * tileSize, tileY * tileSize, tileSize, tileSize);
      ctx.restore();
    };

    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      drawHighlight(this.moveSelection.origin.x, this.moveSelection.origin.y, '#f66');
      drawHighlight(this.moveTarget.x, this.moveTarget.y, '#6f6');
      return;
    }

    drawHighlight(this.hoverTile.x, this.hoverTile.y, '#fff');
  }

  drawHUD(ctx, width, height) {
    const tileSize = this.game.world.tileSize;
    const tileLabel = this.tileType.label || 'Unknown';
    const toolLabel = TOOL_LABELS[this.tool] || 'Paint';
    const enemyLabel = this.enemyType?.label || 'Enemy';
    const toolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles/enemies. (E)' },
      { id: 'select', label: 'Pick', tooltip: 'Pick tile under cursor. (R)' },
      { id: 'move', label: 'Move', tooltip: 'Move tile, spawn, or enemy. (M)' },
      { id: 'enemy', label: 'Enemy', tooltip: 'Place enemies. (T)' },
      { id: 'pan', label: 'Pan', tooltip: 'Pan the camera. (X)' },
      { id: 'zoom', label: 'Zoom', tooltip: 'Drag to zoom. (Z)' }
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
      if (tooltip && isHovered(x, y, w, h)) {
        hoverTooltip = tooltip;
      }
    };

    if (this.isMobileLayout()) {
      const isLandscape = this.game.viewport.width >= this.game.viewport.height;
      const panelSize = Math.max(240, (isLandscape ? width : height) * 0.5);
      const panelX = 0;
      const panelY = isLandscape ? 0 : height - panelSize;
      const panelW = isLandscape ? panelSize : width;
      const panelH = isLandscape ? height : panelSize;
      this.editorBounds = isLandscape
        ? { x: panelW, y: 0, w: width - panelW, h: height }
        : { x: 0, y: 0, w: width, h: height - panelH };
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12);
      ctx.font = '15px Courier New';

      const tabs = [
        { id: 'tools', label: 'TOOLS' },
        { id: 'tiles', label: 'TILES' },
        { id: 'enemies', label: 'ENEMIES' }
      ];
      const tabMargin = 16;
      const tabGap = 10;
      const tabHeight = 30;
      const tabWidth = (panelW - tabMargin * 2 - tabGap * (tabs.length - 1)) / tabs.length;
      const tabY = panelY + 12;
      tabs.forEach((tab, index) => {
        const x = panelX + tabMargin + index * (tabWidth + tabGap);
        drawButton(x, tabY, tabWidth, tabHeight, tab.label, this.mobileTab === tab.id, () => {
          this.mobileTab = tab.id;
        }, `${tab.label} tab`);
      });

      const contentY = tabY + tabHeight + 14;
      const contentHeight = panelY + panelH - contentY - 18;
      const buttonHeight = 34;
      const buttonGap = 8;
      const contentX = panelX + 16;
      const contentW = panelW - 32;

      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(contentX, contentY, contentW, contentHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(contentX, contentY, contentW, contentHeight);

      let items = [];
      let columns = 2;
      if (this.mobileTab === 'tools') {
        items = [
          {
            id: 'playtest',
            label: 'PLAYTEST',
            active: false,
            tooltip: 'Start playtest run.',
            onClick: () => {
              this.game.exitEditor({ playtest: true });
            }
          },
          {
            id: 'exit',
            label: 'EXIT EDITOR',
            active: false,
            tooltip: 'Exit editor.',
            onClick: () => {
              this.game.exitEditor({ playtest: false });
            }
          },
          ...toolButtons.map((tool) => ({
            id: tool.id,
            label: tool.label.toUpperCase(),
            active: this.tool === tool.id,
            tooltip: tool.tooltip,
            onClick: () => {
              this.tool = tool.id;
            }
          }))
        ];
        columns = 2;
      } else if (this.mobileTab === 'tiles') {
        items = DEFAULT_TILE_TYPES.map((tile) => ({
          id: tile.id,
          label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
          active: this.tileType.id === tile.id,
          tooltip: `Tile: ${tile.label}`,
          onClick: () => {
            this.tileType = tile;
            this.customTile = null;
            this.tool = 'paint';
          }
        }));
      } else {
        items = ENEMY_TYPES.map((enemy) => ({
          id: enemy.id,
          label: `${enemy.label} [${enemy.glyph}]`,
          active: this.enemyType.id === enemy.id,
          tooltip: `Enemy: ${enemy.label}`,
          onClick: () => {
            this.enemyType = enemy;
            this.tool = 'enemy';
          }
        }));
      }
      const columnWidth = (contentW - buttonGap * (columns - 1)) / columns;
      items.forEach((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = contentX + col * (columnWidth + buttonGap);
        const y = contentY + 8 + row * (buttonHeight + buttonGap);
        if (y + buttonHeight > contentY + contentHeight - 8) return;
        drawButton(x, y, columnWidth, buttonHeight, item.label, item.active, item.onClick, item.tooltip);
      });
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
        const rows = Math.ceil(toolButtons.length / columns);
        const sectionHeight = rows * (buttonHeight + buttonGap) + sectionPadding;
        drawSectionBody(sectionHeight);
        toolButtons.forEach((tool, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const columnWidth = (panelWidth - sectionPadding * 2 - buttonGap) / columns;
          const x = panelX + sectionPadding + col * (columnWidth + buttonGap);
          const y = cursorY + 6 + row * (buttonHeight + buttonGap);
          drawButton(x, y, columnWidth, buttonHeight, tool.label, this.tool === tool.id, () => {
            this.tool = tool.id;
          }, tool.tooltip);
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
            this.tileType = tile;
            this.customTile = null;
            this.tool = 'paint';
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
            this.enemyType = enemy;
            this.tool = 'enemy';
          }, `Enemy: ${enemy.label}`);
        });
        cursorY += sectionHeight + 10;
      }

      const infoLines = [
        `Tool: ${toolLabel} | Tile: ${tileLabel}`,
        `Enemy: ${enemyLabel}`,
        `Grid: ${tileSize}px | Region: ${this.regionName}`,
        `Zoom: ${this.zoom.toFixed(2)}x`,
        `Drag: LMB paint | RMB erase | Space+drag pan`,
        `Zoom/Pan tools: click + drag`,
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

    const tooltip = hoverTooltip || (this.tooltipTimer > 0 ? this.activeTooltip : '');
    const fallbackTooltip = `Tool: ${toolLabel} | Tile: ${tileLabel} | Enemy: ${enemyLabel}`;
    const tooltipText = tooltip || fallbackTooltip;
    const tooltipHeight = 24;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, height - tooltipHeight, width, tooltipHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0, height - tooltipHeight, width, tooltipHeight);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tooltipText, width / 2, height - 7);
    ctx.restore();
  }
}
