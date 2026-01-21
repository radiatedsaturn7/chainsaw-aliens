const DEFAULT_PALETTE = [
  { id: 'clear', label: 'Clear', color: null },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'black', label: 'Black', color: '#101010' },
  { id: 'gray', label: 'Gray', color: '#7b7b7b' },
  { id: 'blue', label: 'Blue', color: '#4fb7ff' },
  { id: 'red', label: 'Red', color: '#ff6a6a' },
  { id: 'orange', label: 'Orange', color: '#ff9c42' },
  { id: 'yellow', label: 'Yellow', color: '#ffd24a' },
  { id: 'green', label: 'Green', color: '#55d68a' },
  { id: 'purple', label: 'Purple', color: '#b48dff' },
  { id: 'teal', label: 'Teal', color: '#43d5d0' },
  { id: 'pink', label: 'Pink', color: '#ff8ad4' }
];

const TOOL_LIST = [
  { id: 'paint', label: 'Paint' },
  { id: 'erase', label: 'Erase' },
  { id: 'copy', label: 'Copy' },
  { id: 'paste', label: 'Paste' },
  { id: 'clone', label: 'Clone' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'oval', label: 'Oval' },
  { id: 'rounded-rect', label: 'Rounded Rectangle' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'dropper', label: 'Color Dropper' },
  { id: 'fill', label: 'Fill' },
  { id: 'preview', label: 'Preview' },
  { id: 'tiled', label: 'Tiled Mode' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'zoom-out', label: 'Zoom Out' },
  { id: 'cut-image', label: 'Cut From Image' }
];

const ZOOM_LEVELS = [8, 12, 16, 20, 24, 28, 32];
const TILE_LIBRARY = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'hidden-path', label: 'Hidden Path Block', char: 'Z' },
  { id: 'ice-solid', label: 'Icy Solid Block', char: 'F' },
  { id: 'rock-solid', label: 'Rock Solid Block', char: 'R' },
  { id: 'sand-solid', label: 'Sand Block', char: 'E' },
  { id: 'purple-solid', label: 'Purple Solid Block', char: 'Q' },
  { id: 'crystal-blue', label: 'Blue Crystal Block', char: 'J' },
  { id: 'crystal-green', label: 'Green Crystal Block', char: 'G' },
  { id: 'crystal-purple', label: 'Purple Crystal Block', char: 'V' },
  { id: 'triangle', label: 'Triangle Block', char: '^' },
  { id: 'triangle-flip', label: 'Triangle Block (Flipped)', char: 'v' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'sand-platform', label: 'Sand Platform', char: 's' },
  { id: 'water', label: 'Water', char: '~' },
  { id: 'acid', label: 'Acid', char: 'A' },
  { id: 'lava', label: 'Lava', char: 'L' },
  { id: 'spikes', label: 'Spikes', char: '*' },
  { id: 'crystal-spikes', label: 'Crystal Spikes', char: '!' },
  { id: 'ice', label: 'Ice Block', char: 'I' },
  { id: 'conveyor-left', label: 'Conveyor Left', char: '<' },
  { id: 'conveyor-right', label: 'Conveyor Right', char: '>' },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'wood', label: 'Wood Barricade', char: 'W' },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C' },
  { id: 'debris', label: 'Heavy Debris', char: 'U' },
  { id: 'snow', label: 'Snow Block', char: 'N' },
  { id: 'lead', label: 'Lead Block', char: 'P' },
  { id: 'box', label: 'Pull Box', char: 'K' },
  { id: 'switch', label: 'Counterweight Switch', char: 'T' },
  { id: 'bossGate', label: 'Rift Seal', char: 'B' },
  { id: 'door', label: 'Door', char: 'D' },
  { id: 'abilityG', label: 'Tools: Chainsaw Throw', char: 'g' },
  { id: 'abilityP', label: 'Tools: Flame-Saw', char: 'p' },
  { id: 'abilityM', label: 'Ability: Mag Boots', char: 'm' },
  { id: 'abilityR', label: 'Ability: Resonance', char: 'r' },
  { id: 'abilityF', label: 'Weapon: Flamethrower', char: 'f' },
  { id: 'health', label: 'Vitality Core', char: 'H' },
  { id: 'checkpoint', label: 'Checkpoint', char: 'S' },
  { id: 'shop', label: 'Shop', char: '$' },
  { id: 'objective', label: 'Objective', char: 'O' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hexToRgb = (hex) => {
  if (!hex) return null;
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const colorDistance = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
};

const rgbToHex = (rgb) => {
  const toHex = (value) => value.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

const lerp = (a, b, t) => a + (b - a) * t;
const POINT_IN_POLYGON_EPSILON = 1e-6;

export default class PixelStudio {
  constructor(game) {
    this.game = game;
    this.tools = TOOL_LIST;
    this.toolIndex = 0;
    this.palette = DEFAULT_PALETTE;
    this.paletteIndex = 1;
    this.secondaryPaletteIndex = 2;
    this.lastPaletteIndex = this.paletteIndex;
    this.objectEntries = [];
    this.objectIndex = 0;
    this.objectScroll = 0;
    this.tileLibrary = TILE_LIBRARY;
    this.tileIndex = 0;
    this.tileScroll = 0;
    this.tileBounds = [];
    this.activeTile = this.tileLibrary[0] || null;
    this.focus = 'tools';
    this.gridSize = 16;
    this.zoomIndex = 2;
    this.previewEnabled = true;
    this.tiledMode = false;
    this.pixels = Array(this.gridSize * this.gridSize).fill(null);
    this.clipboard = null;
    this.cloneSource = null;
    this.cloneOffset = null;
    this.clonePainting = false;
    this.painting = false;
    this.shapeActive = false;
    this.shapeStart = null;
    this.shapeEnd = null;
    this.shapeTool = null;
    this.canvasBounds = null;
    this.paletteBounds = [];
    this.toolBounds = [];
    this.objectBounds = [];
    this.toolScroll = 0;
    this.toolVisibleCount = 0;
    this.objectVisibleCount = 0;
    this.axisCooldown = 0;
    this.leftTriggerHeld = false;
    this.rightTriggerHeld = false;
    this.cutBounds = null;
    this.cutImageRect = null;
    this.cutSelection = null;
    this.cutDragging = false;
    this.cutSelectionStart = null;
    this.cutImage = null;
    this.gesture = null;
    this.cutCanvas = document.createElement('canvas');
    this.cutCanvasCtx = this.cutCanvas.getContext('2d');
    this.imageInput = document.createElement('input');
    this.imageInput.type = 'file';
    this.imageInput.accept = 'image/*';
    this.imageInput.style.display = 'none';
    document.body.appendChild(this.imageInput);
    this.imageInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        this.cutImage = img;
        this.cutSelection = null;
      };
      img.src = URL.createObjectURL(file);
    });
    if (this.activeTile) {
      this.setActiveTile(this.activeTile);
    }
    this.getObjectEntries();
  }

  resetFocus() {
    this.focus = 'tools';
  }

  getObjectEntries() {
    const entries = [];
    const pushEntry = (label, indent, selectable = false, tile = null) => {
      entries.push({ label, indent, selectable, tile });
    };

    pushEntry('Tiles', 0, false);
    this.tileLibrary.forEach((tile) => {
      pushEntry(tile.label, 1, true, tile);
    });
    pushEntry('Entities', 0, false);
    pushEntry('Player', 1, false);
    pushEntry('Idle', 2, false);
    pushEntry('Running', 2, false);
    pushEntry('Enemy', 1, false);
    pushEntry('Idle', 2, false);
    pushEntry('Moving', 2, false);
    pushEntry('Attacking', 2, false);

    this.objectEntries = entries;
    return entries;
  }

  getSelectableObjectEntries() {
    return this.objectEntries.filter((entry) => entry.selectable);
  }

  getSelectedObjectEntry() {
    const selectable = this.getSelectableObjectEntries();
    return selectable[this.objectIndex] || null;
  }

  getTilePixels(tileChar) {
    if (!tileChar) {
      return { pixelData: null, frame: this.pixels };
    }
    if (!this.game?.world?.pixelArt) {
      this.game.world.pixelArt = { tiles: {} };
    }
    if (!this.game.world.pixelArt.tiles) {
      this.game.world.pixelArt.tiles = {};
    }
    const tiles = this.game.world.pixelArt.tiles;
    if (!tiles[tileChar]) {
      tiles[tileChar] = { size: this.gridSize, frames: [Array(this.gridSize * this.gridSize).fill(null)], fps: 6 };
    }
    const pixelData = tiles[tileChar];
    if (!Array.isArray(pixelData.frames) || pixelData.frames.length === 0) {
      pixelData.frames = [Array(pixelData.size * pixelData.size).fill(null)];
    }
    if (pixelData.size !== this.gridSize) {
      pixelData.size = this.gridSize;
      pixelData.frames = [Array(this.gridSize * this.gridSize).fill(null)];
    }
    return { pixelData, frame: pixelData.frames[0] };
  }

  setActiveTile(tile) {
    this.activeTile = tile;
    if (!tile?.char) {
      this.pixels = Array(this.gridSize * this.gridSize).fill(null);
      return;
    }
    const { frame } = this.getTilePixels(tile.char);
    this.pixels = frame;
  }

  update(input, dt = 0) {
    const left = input.wasPressed('left');
    const right = input.wasPressed('right');
    const up = input.wasPressed('up');
    const down = input.wasPressed('down');
    const dpadLeft = input.wasGamepadPressed('dpadLeft');
    const dpadRight = input.wasGamepadPressed('dpadRight');
    const dpadUp = input.wasGamepadPressed('dpadUp');
    const dpadDown = input.wasGamepadPressed('dpadDown');
    const interact = input.wasPressed('interact');
    const axes = input.getGamepadAxes?.() || {};
    const axisX = axes.leftX || 0;
    const leftTrigger = axes.leftTrigger || 0;
    const rightTrigger = axes.rightTrigger || 0;

    this.axisCooldown = Math.max(0, this.axisCooldown - dt);
    if (Math.abs(axisX) > 0.55 && this.axisCooldown === 0) {
      this.focus = 'palette';
      this.paletteIndex = (this.paletteIndex + (axisX > 0 ? 1 : -1) + this.palette.length) % this.palette.length;
      this.axisCooldown = 0.18;
    }

    if (leftTrigger > 0.6 && !this.leftTriggerHeld) {
      this.zoomIndex = clamp(this.zoomIndex - 1, 0, ZOOM_LEVELS.length - 1);
      this.leftTriggerHeld = true;
    }
    if (leftTrigger < 0.4) {
      this.leftTriggerHeld = false;
    }
    if (rightTrigger > 0.6 && !this.rightTriggerHeld) {
      this.zoomIndex = clamp(this.zoomIndex + 1, 0, ZOOM_LEVELS.length - 1);
      this.rightTriggerHeld = true;
    }
    if (rightTrigger < 0.4) {
      this.rightTriggerHeld = false;
    }

    if (this.focus === 'tools') {
      if (up || dpadUp) this.toolIndex = (this.toolIndex - 1 + this.tools.length) % this.tools.length;
      if (down || dpadDown) this.toolIndex = (this.toolIndex + 1) % this.tools.length;
      if (left || dpadLeft) this.focus = 'objects';
      if (right || dpadRight) this.focus = 'canvas';
      if ((down || dpadDown) && this.toolIndex === this.tools.length - 1) {
        this.focus = 'palette';
      }
    } else if (this.focus === 'objects') {
      this.getObjectEntries();
      const selectable = this.getSelectableObjectEntries();
      if (selectable.length) {
        if (up || dpadUp) this.objectIndex = (this.objectIndex - 1 + selectable.length) % selectable.length;
        if (down || dpadDown) this.objectIndex = (this.objectIndex + 1) % selectable.length;
      }
      if (right || dpadRight) this.focus = 'tools';
      if (interact) {
        const selected = this.getSelectedObjectEntry();
        if (selected?.tile) {
          const tileIndex = this.tileLibrary.findIndex((tile) => tile.id === selected.tile.id);
          if (tileIndex >= 0) {
            this.tileIndex = tileIndex;
          }
          this.setActiveTile(selected.tile);
        }
      }
    } else if (this.focus === 'palette') {
      if (left) this.paletteIndex = (this.paletteIndex - 1 + this.palette.length) % this.palette.length;
      if (right) this.paletteIndex = (this.paletteIndex + 1) % this.palette.length;
      if (up) this.focus = 'tools';
    } else if (this.focus === 'canvas') {
      if (left) this.focus = 'tools';
      if (down) this.focus = 'palette';
      if (up && this.cutImage) this.focus = 'cut';
    } else if (this.focus === 'cut') {
      if (down) this.focus = 'canvas';
      if (left) this.focus = 'tools';
    }

    if (this.paletteIndex !== this.lastPaletteIndex) {
      this.secondaryPaletteIndex = this.lastPaletteIndex;
      this.lastPaletteIndex = this.paletteIndex;
    }

    if (interact) {
      const tool = this.tools[this.toolIndex];
      if (!tool) return;
      if (tool.id === 'preview') {
        this.startPreview();
      }
      if (tool.id === 'zoom-in') {
        this.zoomIndex = clamp(this.zoomIndex + 1, 0, ZOOM_LEVELS.length - 1);
      }
      if (tool.id === 'zoom-out') {
        this.zoomIndex = clamp(this.zoomIndex - 1, 0, ZOOM_LEVELS.length - 1);
      }
      if (tool.id === 'copy') {
        this.clipboard = [...this.pixels];
      }
      if (tool.id === 'paste' && this.clipboard) {
        this.pixels = [...this.clipboard];
      }
      if (tool.id === 'clone') {
        this.cloneSource = null;
        this.cloneOffset = null;
        this.clonePainting = false;
      }
      if (tool.id === 'fill') {
        this.applyFillAll();
      }
      if (tool.id === 'cut-image') {
        if (!this.cutImage) {
          this.imageInput.click();
        } else if (this.cutSelection) {
          this.applyCutSelection();
        }
      }
      if (tool.id === 'tiled') {
        this.tiledMode = !this.tiledMode;
      }
    }
  }

  startPreview() {
    if (!this.activeTile?.char) return;
    if (this.game?.enterPixelPreview) {
      this.game.enterPixelPreview(this.activeTile);
    }
  }

  handleGestureStart(payload) {
    if (!this.canvasBounds || !this.isPointInBounds(payload.x, payload.y, this.canvasBounds)) return;
    this.gesture = {
      startDistance: payload.distance,
      startZoom: ZOOM_LEVELS[this.zoomIndex]
    };
  }

  handleGestureMove(payload) {
    if (!this.gesture?.startDistance) return;
    const scale = payload.distance / this.gesture.startDistance;
    const minZoom = ZOOM_LEVELS[0];
    const maxZoom = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    const targetZoom = clamp(this.gesture.startZoom * scale, minZoom, maxZoom);
    let closestIndex = 0;
    let closestDelta = Infinity;
    ZOOM_LEVELS.forEach((level, index) => {
      const delta = Math.abs(level - targetZoom);
      if (delta < closestDelta) {
        closestDelta = delta;
        closestIndex = index;
      }
    });
    this.zoomIndex = closestIndex;
  }

  handleGestureEnd() {
    this.gesture = null;
  }

  handlePointerDown(payload) {
    const { x, y } = payload;
    if (this.canvasBounds && this.isPointInBounds(x, y, this.canvasBounds)) {
      const tool = this.tools[this.toolIndex];
      if (tool?.id === 'fill') {
        const cell = this.getGridCellFromPoint(x, y);
        if (cell) {
          this.applyFillAt(cell.row, cell.col);
        }
      } else if (['rectangle', 'oval', 'rounded-rect', 'polygon', 'gradient'].includes(tool?.id)) {
        const cell = this.getGridCellFromPoint(x, y);
        if (cell) {
          this.shapeActive = true;
          this.shapeStart = cell;
          this.shapeEnd = cell;
          this.shapeTool = tool.id;
        }
      } else if (tool?.id === 'clone') {
        const cell = this.getGridCellFromPoint(x, y);
        if (!cell) return;
        if (!this.cloneSource) {
          this.cloneSource = cell;
        } else {
          this.cloneOffset = { row: this.cloneSource.row - cell.row, col: this.cloneSource.col - cell.col };
          this.clonePainting = true;
          this.paintAt(x, y);
        }
      } else {
        this.painting = true;
        this.paintAt(x, y);
      }
      this.focus = 'canvas';
      return;
    }
    const paletteHit = this.paletteBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (paletteHit) {
      this.paletteIndex = paletteHit.index;
      this.focus = 'palette';
      return;
    }
    const toolHit = this.toolBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (toolHit) {
      this.toolIndex = toolHit.index;
      this.focus = 'tools';
      const tool = this.tools[this.toolIndex];
      if (tool?.id === 'clone') {
        this.cloneSource = null;
        this.cloneOffset = null;
        this.clonePainting = false;
      }
      return;
    }
    const objectHit = this.objectBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (objectHit) {
      this.objectIndex = objectHit.index;
      this.focus = 'objects';
      const selected = this.getSelectedObjectEntry();
      if (selected?.tile) {
        const tileIndex = this.tileLibrary.findIndex((tile) => tile.id === selected.tile.id);
        if (tileIndex >= 0) {
          this.tileIndex = tileIndex;
        }
        this.setActiveTile(selected.tile);
      }
      return;
    }
    if (this.cutImageRect && this.isPointInBounds(x, y, this.cutImageRect)) {
      this.cutDragging = true;
      this.cutSelectionStart = { x, y };
      this.cutSelection = { x, y, w: 1, h: 1 };
      this.focus = 'cut';
    }
  }

  handlePointerMove(payload) {
    if (this.painting || this.clonePainting) {
      this.paintAt(payload.x, payload.y);
    }
    if (this.shapeActive && this.canvasBounds) {
      const cell = this.getGridCellFromPoint(payload.x, payload.y);
      if (cell) {
        this.shapeEnd = cell;
      }
    }
    if (this.cutDragging && this.cutImageRect) {
      const start = this.cutSelectionStart;
      const endX = clamp(payload.x, this.cutImageRect.x, this.cutImageRect.x + this.cutImageRect.w);
      const endY = clamp(payload.y, this.cutImageRect.y, this.cutImageRect.y + this.cutImageRect.h);
      const x = Math.min(start.x, endX);
      const y = Math.min(start.y, endY);
      const w = Math.abs(endX - start.x);
      const h = Math.abs(endY - start.y);
      this.cutSelection = { x, y, w, h };
    }
  }

  handlePointerUp() {
    this.painting = false;
    this.clonePainting = false;
    this.cutDragging = false;
    this.cutSelectionStart = null;
    if (this.shapeActive && this.shapeStart && this.shapeEnd) {
      this.applyShape(this.shapeStart, this.shapeEnd, this.shapeTool);
    }
    this.shapeActive = false;
    this.shapeStart = null;
    this.shapeEnd = null;
    this.shapeTool = null;
  }

  paintAt(x, y) {
    if (!this.canvasBounds) return;
    const cell = this.getGridCellFromPoint(x, y);
    if (!cell) return;
    const { row, col } = cell;
    const tool = this.tools[this.toolIndex];
    if (!tool) return;
    const index = row * this.gridSize + col;
    if (tool.id === 'clone') {
      if (!this.cloneOffset) return;
      const sourceRow = row + this.cloneOffset.row;
      const sourceCol = col + this.cloneOffset.col;
      if (sourceRow < 0 || sourceCol < 0 || sourceRow >= this.gridSize || sourceCol >= this.gridSize) return;
      const sourceIndex = sourceRow * this.gridSize + sourceCol;
      this.pixels[index] = this.pixels[sourceIndex];
      return;
    }
    if (!['paint', 'erase', 'dropper'].includes(tool.id)) return;
    if (tool.id === 'dropper') {
      const current = this.pixels[index];
      const paletteIndex = this.palette.findIndex((entry) => entry.color === current);
      if (paletteIndex >= 0) {
        this.paletteIndex = paletteIndex;
      }
      return;
    }
    const color = tool.id === 'erase' ? null : this.palette[this.paletteIndex]?.color ?? null;
    this.pixels[index] = color;
  }

  applyFillAll() {
    const color = this.palette[this.paletteIndex]?.color ?? null;
    this.pixels.forEach((_, index) => {
      this.pixels[index] = color;
    });
  }

  applyFillAt(row, col) {
    const targetIndex = row * this.gridSize + col;
    const targetColor = this.pixels[targetIndex];
    const replacement = this.palette[this.paletteIndex]?.color ?? null;
    if (targetColor === replacement) return;
    const stack = [{ row, col }];
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      const key = `${current.row},${current.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const idx = current.row * this.gridSize + current.col;
      if (this.pixels[idx] !== targetColor) continue;
      this.pixels[idx] = replacement;
      if (current.row > 0) stack.push({ row: current.row - 1, col: current.col });
      if (current.row < this.gridSize - 1) stack.push({ row: current.row + 1, col: current.col });
      if (current.col > 0) stack.push({ row: current.row, col: current.col - 1 });
      if (current.col < this.gridSize - 1) stack.push({ row: current.row, col: current.col + 1 });
    }
  }

  applyShape(start, end, toolId) {
    if (!start || !end) return;
    if (toolId === 'gradient') {
      this.applyGradient(start, end);
      return;
    }
    const color = this.palette[this.paletteIndex]?.color ?? null;
    const [minRow, maxRow] = [Math.min(start.row, end.row), Math.max(start.row, end.row)];
    const [minCol, maxCol] = [Math.min(start.col, end.col), Math.max(start.col, end.col)];
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    const radius = Math.max(1, Math.floor(Math.min(width, height) * 0.25));

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        let hit = false;
        if (toolId === 'rectangle') {
          hit = true;
        } else if (toolId === 'oval') {
          const rx = width / 2;
          const ry = height / 2;
          const cx = minCol + rx;
          const cy = minRow + ry;
          const dx = (col + 0.5 - cx) / rx;
          const dy = (row + 0.5 - cy) / ry;
          hit = dx * dx + dy * dy <= 1;
        } else if (toolId === 'rounded-rect') {
          const left = minCol;
          const right = maxCol;
          const top = minRow;
          const bottom = maxRow;
          const innerLeft = left + radius;
          const innerRight = right - radius;
          const innerTop = top + radius;
          const innerBottom = bottom - radius;
          if (col >= innerLeft && col <= innerRight) {
            hit = row >= top && row <= bottom;
          } else if (row >= innerTop && row <= innerBottom) {
            hit = col >= left && col <= right;
          } else {
            const cornerX = col < innerLeft ? innerLeft : innerRight;
            const cornerY = row < innerTop ? innerTop : innerBottom;
            const dx = col - cornerX;
            const dy = row - cornerY;
            hit = dx * dx + dy * dy <= radius * radius;
          }
        } else if (toolId === 'polygon') {
          const polygon = this.getPolygonVertices(minRow, maxRow, minCol, maxCol, 6);
          hit = this.isPointInPolygon({ x: col + 0.5, y: row + 0.5 }, polygon);
        }
        if (hit) {
          this.pixels[row * this.gridSize + col] = color;
        }
      }
    }
  }

  getPolygonVertices(minRow, maxRow, minCol, maxCol, sides) {
    const cx = (minCol + maxCol + 1) / 2;
    const cy = (minRow + maxRow + 1) / 2;
    const radiusX = Math.max(1, (maxCol - minCol + 1) / 2);
    const radiusY = Math.max(1, (maxRow - minRow + 1) / 2);
    const vertices = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
      vertices.push({
        x: cx + Math.cos(angle) * radiusX,
        y: cy + Math.sin(angle) * radiusY
      });
    }
    return vertices;
  }

  isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + POINT_IN_POLYGON_EPSILON) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  applyGradient(start, end) {
    const primary = this.palette[this.paletteIndex]?.color ?? null;
    const secondary = this.palette[this.secondaryPaletteIndex]?.color ?? primary ?? null;
    const [minRow, maxRow] = [Math.min(start.row, end.row), Math.max(start.row, end.row)];
    const [minCol, maxCol] = [Math.min(start.col, end.col), Math.max(start.col, end.col)];
    const startPoint = { x: start.col + 0.5, y: start.row + 0.5 };
    const endPoint = { x: end.col + 0.5, y: end.row + 0.5 };
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const primaryRgb = hexToRgb(primary);
    const secondaryRgb = hexToRgb(secondary);

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const proj = ((col + 0.5 - startPoint.x) * dx + (row + 0.5 - startPoint.y) * dy) / lengthSq;
        const t = clamp(proj, 0, 1);
        let color = primary;
        if (!primary || !secondary) {
          color = t < 0.5 ? primary : secondary;
        } else if (primaryRgb && secondaryRgb) {
          const blended = {
            r: Math.round(lerp(primaryRgb.r, secondaryRgb.r, t)),
            g: Math.round(lerp(primaryRgb.g, secondaryRgb.g, t)),
            b: Math.round(lerp(primaryRgb.b, secondaryRgb.b, t))
          };
          color = rgbToHex(blended);
        }
        this.pixels[row * this.gridSize + col] = color;
      }
    }
  }

  getGridCellFromPoint(x, y) {
    if (!this.canvasBounds) return null;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    const col = Math.floor((x - startX) / cellSize);
    const row = Math.floor((y - startY) / cellSize);
    if (col < 0 || row < 0 || col >= this.gridSize || row >= this.gridSize) return null;
    return { row, col };
  }

  applyCutSelection() {
    if (!this.cutImage || !this.cutSelection || !this.cutImageRect) return;
    const { x, y, w, h } = this.cutSelection;
    const scaleX = this.cutImage.width / this.cutImageRect.w;
    const scaleY = this.cutImage.height / this.cutImageRect.h;
    const sx = Math.floor(clamp((x - this.cutImageRect.x) * scaleX, 0, this.cutImage.width));
    const sy = Math.floor(clamp((y - this.cutImageRect.y) * scaleY, 0, this.cutImage.height));
    const sw = Math.max(1, Math.floor(clamp(w * scaleX, 1, this.cutImage.width - sx)));
    const sh = Math.max(1, Math.floor(clamp(h * scaleY, 1, this.cutImage.height - sy)));

    this.cutCanvas.width = this.cutImage.width;
    this.cutCanvas.height = this.cutImage.height;
    this.cutCanvasCtx.clearRect(0, 0, this.cutCanvas.width, this.cutCanvas.height);
    this.cutCanvasCtx.drawImage(this.cutImage, 0, 0);
    const imageData = this.cutCanvasCtx.getImageData(sx, sy, sw, sh);
    const data = imageData.data;

    const paletteColors = this.palette
      .filter((entry) => entry.color)
      .map((entry) => ({ entry, rgb: hexToRgb(entry.color) }));

    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const sampleX = Math.floor(((col + 0.5) / this.gridSize) * sw);
        const sampleY = Math.floor(((row + 0.5) / this.gridSize) * sh);
        const idx = (sampleY * sw + sampleX) * 4;
        const alpha = data[idx + 3] / 255;
        if (alpha < 0.15) {
          this.pixels[row * this.gridSize + col] = null;
          continue;
        }
        const sample = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
        let closest = paletteColors[0]?.entry?.color ?? null;
        let closestDist = Number.POSITIVE_INFINITY;
        paletteColors.forEach((candidate) => {
          const dist = colorDistance(sample, candidate.rgb);
          if (dist < closestDist) {
            closestDist = dist;
            closest = candidate.entry.color;
          }
        });
        this.pixels[row * this.gridSize + col] = closest;
      }
    }
  }

  isPointInBounds(x, y, bounds) {
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = '24px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Pixel Editor', 24, 40);

    const leftWidth = 300;
    const bottomHeight = 140;
    const panelPadding = 16;

    const panelX = 20;
    const panelY = 70;
    const panelH = height - bottomHeight - panelY - 20;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(panelX, panelY, leftWidth, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX, panelY, leftWidth, panelH);

    const sectionGap = 18;
    const toolsBoxH = Math.floor(panelH * 0.4);
    const objectsBoxH = panelH - toolsBoxH - sectionGap - 12;

    const toolsBoxY = panelY + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(panelX + 12, toolsBoxY, leftWidth - 24, toolsBoxH);
    ctx.strokeStyle = this.focus === 'tools' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX + 12, toolsBoxY, leftWidth - 24, toolsBoxH);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Tools', panelX + 24, toolsBoxY + 20);

    this.toolBounds = [];
    const toolListStartY = toolsBoxY + 36;
    const toolLineHeight = 18;
    this.toolVisibleCount = Math.max(1, Math.floor((toolsBoxH - 44) / toolLineHeight));
    const toolMaxScroll = Math.max(0, this.tools.length - this.toolVisibleCount);
    this.toolScroll = clamp(this.toolScroll, 0, toolMaxScroll);
    if (this.toolIndex < this.toolScroll) {
      this.toolScroll = this.toolIndex;
    } else if (this.toolIndex >= this.toolScroll + this.toolVisibleCount) {
      this.toolScroll = Math.min(toolMaxScroll, this.toolIndex - this.toolVisibleCount + 1);
    }
    this.tools.slice(this.toolScroll, this.toolScroll + this.toolVisibleCount).forEach((tool, index) => {
      const listIndex = this.toolScroll + index;
      const y = toolListStartY + index * toolLineHeight;
      const isSelected = listIndex === this.toolIndex;
      ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(tool.label, panelX + 32, y);
      this.toolBounds.push({
        x: panelX + 20,
        y: y - 12,
        w: leftWidth - 40,
        h: 16,
        index: listIndex
      });
    });

    const objectsBoxY = toolsBoxY + toolsBoxH + sectionGap;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(panelX + 12, objectsBoxY, leftWidth - 24, objectsBoxH);
    ctx.strokeStyle = this.focus === 'objects' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX + 12, objectsBoxY, leftWidth - 24, objectsBoxH);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Objects', panelX + 24, objectsBoxY + 20);

    const objectListStartY = objectsBoxY + 36;
    const objectLineHeight = 18;
    this.objectVisibleCount = Math.max(1, Math.floor((objectsBoxH - 44) / objectLineHeight));
    const entries = this.getObjectEntries();
    const selectable = this.getSelectableObjectEntries();
    const selectedEntry = selectable[this.objectIndex] || null;
    const objectMaxScroll = Math.max(0, entries.length - this.objectVisibleCount);
    this.objectScroll = clamp(this.objectScroll, 0, objectMaxScroll);
    const selectedIndex = entries.findIndex((entry) => entry === selectedEntry);
    if (selectedIndex >= 0) {
      if (selectedIndex < this.objectScroll) {
        this.objectScroll = selectedIndex;
      } else if (selectedIndex >= this.objectScroll + this.objectVisibleCount) {
        this.objectScroll = Math.min(objectMaxScroll, selectedIndex - this.objectVisibleCount + 1);
      }
    }

    this.objectBounds = [];
    entries.slice(this.objectScroll, this.objectScroll + this.objectVisibleCount).forEach((entry, index) => {
      const listIndex = this.objectScroll + index;
      const y = objectListStartY + index * objectLineHeight;
      const isSelected = entries[listIndex] === selectedEntry;
      ctx.fillStyle = entry.selectable ? (isSelected ? '#ffe16a' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.5)';
      const indentX = panelX + 32 + entry.indent * 14;
      const label = entry.tile?.char ? `${entry.label} [${entry.tile.char}]` : entry.label;
      ctx.fillText(label, indentX, y);
      if (entry.selectable) {
        const selectableIndex = selectable.findIndex((item) => item === entry);
        this.objectBounds.push({
          x: panelX + 20,
          y: y - 12,
          w: leftWidth - 40,
          h: 16,
          index: selectableIndex
        });
      }
    });

    const canvasX = leftWidth + 60;
    const canvasY = 80;
    const canvasW = width - canvasX - 20;
    const canvasH = height - bottomHeight - canvasY - 20;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
    ctx.strokeStyle = this.focus === 'canvas' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);

    const maxPixelSize = Math.min((canvasW - 40) / this.gridSize, (canvasH - 60) / this.gridSize);
    const pixelSize = Math.min(ZOOM_LEVELS[this.zoomIndex], maxPixelSize);
    const gridW = pixelSize * this.gridSize;
    const gridH = pixelSize * this.gridSize;
    const gridX = canvasX + (canvasW - gridW) / 2;
    const gridY = canvasY + 40;

    this.canvasBounds = { x: gridX, y: gridY, w: gridW, h: gridH, cellSize: pixelSize };

    if (this.tiledMode) {
      this.drawTiledPreview(ctx, canvasX, canvasY, canvasW, canvasH, gridX, gridY, pixelSize, gridW, gridH);
    }

    ctx.fillStyle = '#101010';
    ctx.fillRect(gridX, gridY, gridW, gridH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(gridX, gridY, gridW, gridH);

    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const color = this.pixels[row * this.gridSize + col];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(gridX + col * pixelSize, gridY + row * pixelSize, pixelSize, pixelSize);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i < this.gridSize; i += 1) {
      ctx.beginPath();
      ctx.moveTo(gridX + i * pixelSize, gridY);
      ctx.lineTo(gridX + i * pixelSize, gridY + gridH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gridX, gridY + i * pixelSize);
      ctx.lineTo(gridX + gridW, gridY + i * pixelSize);
      ctx.stroke();
    }

    if (this.shapeActive && this.shapeStart && this.shapeEnd) {
      const minRow = Math.min(this.shapeStart.row, this.shapeEnd.row);
      const maxRow = Math.max(this.shapeStart.row, this.shapeEnd.row);
      const minCol = Math.min(this.shapeStart.col, this.shapeEnd.col);
      const maxCol = Math.max(this.shapeStart.col, this.shapeEnd.col);
      ctx.strokeStyle = '#ffcc6a';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        gridX + minCol * pixelSize,
        gridY + minRow * pixelSize,
        (maxCol - minCol + 1) * pixelSize,
        (maxRow - minRow + 1) * pixelSize
      );
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(`Zoom: ${pixelSize}px`, canvasX + 20, canvasY + 24);
    ctx.fillText(`Tool: ${this.tools[this.toolIndex]?.label || ''}`, canvasX + 180, canvasY + 24);
    if (this.tiledMode) {
      ctx.fillStyle = '#ffe16a';
      ctx.fillText('Tiled Mode On', canvasX + 360, canvasY + 24);
    }
    if (this.cloneSource && this.tools[this.toolIndex]?.id === 'clone') {
      ctx.fillStyle = '#9ddcff';
      ctx.fillText('Clone Source Set', canvasX + 20, canvasY + 44);
    }

    if (this.previewEnabled) {
      const previewSize = 80;
      const previewX = canvasX + canvasW - previewSize - 20;
      const previewY = canvasY + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(previewX, previewY, previewSize, previewSize);
      ctx.strokeStyle = '#ffe16a';
      ctx.strokeRect(previewX, previewY, previewSize, previewSize);
      const previewPixel = previewSize / this.gridSize;
      for (let row = 0; row < this.gridSize; row += 1) {
        for (let col = 0; col < this.gridSize; col += 1) {
          const color = this.pixels[row * this.gridSize + col];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(previewX + col * previewPixel, previewY + row * previewPixel, previewPixel, previewPixel);
        }
      }
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText('Preview', previewX + 8, previewY + previewSize + 16);
    }

    this.cutImageRect = null;
    if (this.cutImage) {
      const cutW = Math.min(canvasW * 0.35, 240);
      const cutH = cutW;
      const cutX = canvasX + 20;
      const cutY = canvasY + canvasH - cutH - 20;
      this.cutBounds = { x: cutX, y: cutY, w: cutW, h: cutH };
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cutX, cutY, cutW, cutH);
      ctx.strokeStyle = this.focus === 'cut' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
      ctx.strokeRect(cutX, cutY, cutW, cutH);
      const scale = Math.min(cutW / this.cutImage.width, cutH / this.cutImage.height);
      const imgW = this.cutImage.width * scale;
      const imgH = this.cutImage.height * scale;
      const imgX = cutX + (cutW - imgW) / 2;
      const imgY = cutY + (cutH - imgH) / 2;
      this.cutImageRect = { x: imgX, y: imgY, w: imgW, h: imgH };
      ctx.drawImage(this.cutImage, imgX, imgY, imgW, imgH);
      if (this.cutSelection) {
        ctx.strokeStyle = '#ffcc6a';
        ctx.strokeRect(this.cutSelection.x, this.cutSelection.y, this.cutSelection.w, this.cutSelection.h);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText('Cut From Image', cutX + 6, cutY - 6);
    }

    const paletteY = height - bottomHeight + 30;
    const paletteX = 20;
    const paletteW = width - 40;
    const swatchSize = 32;
    const swatchGap = 12;
    const totalSwatchesWidth = this.palette.length * swatchSize + (this.palette.length - 1) * swatchGap;
    let startX = paletteX + (paletteW - totalSwatchesWidth) / 2;
    if (totalSwatchesWidth > paletteW) {
      startX = paletteX;
    }

    this.paletteBounds = [];
    this.palette.forEach((entry, index) => {
      const x = startX + index * (swatchSize + swatchGap);
      const y = paletteY;
      ctx.fillStyle = entry.color || '#101010';
      ctx.fillRect(x, y, swatchSize, swatchSize);
      ctx.strokeStyle = index === this.paletteIndex || this.focus === 'palette' ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(x, y, swatchSize, swatchSize);
      if (!entry.color) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + swatchSize - 4, y + swatchSize - 4);
        ctx.stroke();
      }
      this.paletteBounds.push({ x, y, w: swatchSize, h: swatchSize, index });
    });

    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Swatches', paletteX + 4, paletteY - 8);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Courier New';
    ctx.fillText('Joystick: palette • D-pad: tools/objects • Triggers: zoom • Enter: apply tool • Esc: back', 24, height - 14);

    ctx.restore();
  }

  drawTiledPreview(ctx, canvasX, canvasY, canvasW, canvasH, gridX, gridY, pixelSize, gridW, gridH) {
    const startX = gridX - gridW * 2;
    const startY = gridY - gridH * 2;
    const endX = canvasX + canvasW;
    const endY = canvasY + canvasH;
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let tileY = startY; tileY < endY; tileY += gridH) {
      for (let tileX = startX; tileX < endX; tileX += gridW) {
        for (let row = 0; row < this.gridSize; row += 1) {
          for (let col = 0; col < this.gridSize; col += 1) {
            const color = this.pixels[row * this.gridSize + col];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(tileX + col * pixelSize, tileY + row * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    }
    ctx.restore();
  }
}
