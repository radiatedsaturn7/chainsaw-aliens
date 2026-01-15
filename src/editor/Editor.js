const DEFAULT_TILE_TYPES = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'hazard', label: 'Hazard', char: '!' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'gate', label: 'Gate (Grapple)', char: 'G' },
  { id: 'spawn', label: 'Player Spawn', char: null, special: 'spawn' },
  { id: 'checkpoint', label: 'Checkpoint', char: 'S' },
  { id: 'shop', label: 'Shop', char: '$' },
  { id: 'objective', label: 'Objective', char: 'O' }
];

const TOOL_LABELS = {
  paint: 'Paint',
  erase: 'Erase',
  select: 'Select'
};

export default class Editor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.tool = 'paint';
    this.tileType = DEFAULT_TILE_TYPES[0];
    this.customTile = null;
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
    this.dragging = false;
    this.dragMode = null;
    this.dragStart = null;
    this.panStart = null;
    this.pendingChanges = new Map();
    this.pendingSpawn = null;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.hoverTile = null;
    this.regionName = 'Unknown';
    this.lastPointer = { x: 0, y: 0 };

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
  }

  resetView() {
    const { canvas } = this.game;
    const focus = this.game.player || { x: 0, y: 0 };
    this.zoom = 1;
    this.camera.x = Math.max(0, focus.x - canvas.width / 2);
    this.camera.y = Math.max(0, focus.y - canvas.height / 2);
  }

  update(input) {
    this.handleKeyboard(input);
    this.updateHover();
  }

  handleKeyboard(input) {
    if (input.wasPressedCode('KeyQ')) this.tool = 'paint';
    if (input.wasPressedCode('KeyE')) this.tool = 'erase';
    if (input.wasPressedCode('KeyR')) this.tool = 'select';

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

    this.game.refreshWorldCaches();
  }

  beginStroke(mode, tileX, tileY) {
    this.dragging = true;
    this.dragMode = mode;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    if (mode === 'pan') {
      this.panStart = { x: this.lastPointer.x, y: this.lastPointer.y, camX: this.camera.x, camY: this.camera.y };
      return;
    }
    if (mode === 'select') {
      this.selectTile(tileX, tileY);
      this.dragging = false;
      this.dragMode = null;
      return;
    }
    this.applyPaint(tileX, tileY, mode);
  }

  endStroke() {
    if (!this.dragging) return;
    if (this.dragMode === 'pan') {
      this.dragging = false;
      this.dragMode = null;
      return;
    }

    const tiles = Array.from(this.pendingChanges.values());
    if (tiles.length > 0 || this.pendingSpawn) {
      const action = {
        tiles,
        spawn: this.pendingSpawn
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
    this.dragging = false;
    this.dragMode = null;
  }

  handlePointerDown(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (payload.button === 1 || (payload.button === 0 && this.game.input.isDownCode('Space'))) {
      this.beginStroke('pan', tileX, tileY);
      return;
    }

    if (payload.button === 2) {
      this.tool = 'erase';
      this.beginStroke('erase', tileX, tileY);
      return;
    }

    if (this.tool === 'select') {
      this.beginStroke('select', tileX, tileY);
      return;
    }

    this.tool = 'paint';
    this.beginStroke('paint', tileX, tileY);
  }

  handlePointerMove(payload) {
    if (!this.active) return;
    this.lastPointer = { x: payload.x, y: payload.y };
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (!this.dragging) return;

    if (this.dragMode === 'pan' && this.panStart) {
      const dx = (payload.x - this.panStart.x) / this.zoom;
      const dy = (payload.y - this.panStart.y) / this.zoom;
      this.camera.x = Math.max(0, this.panStart.camX - dx);
      this.camera.y = Math.max(0, this.panStart.camY - dy);
      return;
    }

    if (this.dragMode === 'paint' || this.dragMode === 'erase') {
      this.applyPaint(tileX, tileY, this.dragMode);
    }
  }

  handlePointerUp() {
    if (!this.active) return;
    this.endStroke();
  }

  handleWheel(payload) {
    if (!this.active) return;
    const zoomFactor = payload.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(3, Math.max(0.5, this.zoom * zoomFactor));
    if (Math.abs(nextZoom - this.zoom) < 0.001) return;
    const worldPos = this.screenToWorld(payload.x, payload.y);
    this.zoom = nextZoom;
    this.camera.x = worldPos.x - payload.x / this.zoom;
    this.camera.y = worldPos.y - payload.y / this.zoom;
  }

  applyPaint(tileX, tileY, mode) {
    if (!this.isInBounds(tileX, tileY)) return;

    if (mode === 'erase') {
      this.setTile(tileX, tileY, '.');
      return;
    }

    if (this.tileType.special === 'spawn') {
      this.setSpawn(tileX, tileY);
      return;
    }

    const char = this.tileType.char || '.';
    this.setTile(tileX, tileY, char);
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
      }
    }

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
    if (!this.isInBounds(this.hoverTile.x, this.hoverTile.y)) return;
    const tileSize = this.game.world.tileSize;
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.hoverTile.x * tileSize, this.hoverTile.y * tileSize, tileSize, tileSize);
    ctx.restore();
  }

  drawHUD(ctx, width, height) {
    const tileSize = this.game.world.tileSize;
    const tileLabel = this.tileType.label || 'Unknown';
    const toolLabel = TOOL_LABELS[this.tool] || 'Paint';

    const lines = [
      `EDITOR MODE`,
      `Tool: ${toolLabel}`,
      `Tile: ${tileLabel}`,
      `Grid: ${tileSize}px`,
      `Region: ${this.regionName}`,
      `Zoom: ${this.zoom.toFixed(2)}x`,
      ``,
      `Mouse: LMB paint | RMB erase | MMB or Space+drag pan`,
      `Wheel: zoom`,
      `1-9: tile types | Q/E/R: tools`,
      `Ctrl+Z / Ctrl+Y: undo/redo`,
      `S: save JSON | L: load JSON`,
      `P: playtest | F2: toggle editor | Esc: exit`
    ];

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(12, 12, 360, lines.length * 18 + 12);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(12, 12, 360, lines.length * 18 + 12);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    lines.forEach((line, index) => {
      ctx.fillText(line, 24, 36 + index * 18);
    });
    ctx.restore();
  }
}
