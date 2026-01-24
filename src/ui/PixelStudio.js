import {
  buildPalette,
  loadPalettePresets,
  loadCustomPalettes,
  saveCustomPalettes,
  parsePaletteText,
  paletteToHexList,
  getNearestPaletteIndex,
  getPaletteSwatchHex,
  hexToRgba,
  rgbaToUint32,
  uint32ToRgba
} from './pixel-editor/palette.js';
import {
  createLayer,
  cloneLayer,
  compositeLayers,
  mergeDown,
  flattenLayers,
  reorderLayer
} from './pixel-editor/layers.js';
import { createToolRegistry, TOOL_IDS } from './pixel-editor/tools.js';
import { createFrame, cloneFrame, exportSpriteSheet } from './pixel-editor/animation.js';
import UndoStack from './pixel-editor/undo.js';
import { GAMEPAD_HINTS, updateGamepadCursor } from './pixel-editor/gamepad.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

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

const bresenhamLine = (start, end) => {
  const points = [];
  let x0 = start.col;
  let y0 = start.row;
  const x1 = end.col;
  const y1 = end.row;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
};

const generateEllipseMask = (width, height, bounds) => {
  const mask = new Uint8Array(width * height);
  const rx = bounds.w / 2;
  const ry = bounds.h / 2;
  const cx = bounds.x + rx;
  const cy = bounds.y + ry;
  for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
    for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
      const dx = (col + 0.5 - cx) / rx;
      const dy = (row + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        mask[row * width + col] = 1;
      }
    }
  }
  return mask;
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const createPolygonMask = (width, height, points) => {
  const mask = new Uint8Array(width * height);
  if (points.length < 3) return mask;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = clamp(Math.floor(Math.min(...xs)), 0, width - 1);
  const maxX = clamp(Math.ceil(Math.max(...xs)), 0, width - 1);
  const minY = clamp(Math.floor(Math.min(...ys)), 0, height - 1);
  const maxY = clamp(Math.ceil(Math.max(...ys)), 0, height - 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
};

const createRectMask = (width, height, bounds) => {
  const mask = new Uint8Array(width * height);
  for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
    for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
      mask[row * width + col] = 1;
    }
  }
  return mask;
};

const applySymmetryPoints = (points, width, height, symmetry) => {
  const output = new Map();
  points.forEach(({ row, col }) => {
    const candidates = [{ row, col }];
    if (symmetry.horizontal) {
      candidates.push({ row, col: width - 1 - col });
    }
    if (symmetry.vertical) {
      candidates.push({ row: height - 1 - row, col });
    }
    if (symmetry.horizontal && symmetry.vertical) {
      candidates.push({ row: height - 1 - row, col: width - 1 - col });
    }
    candidates.forEach((point) => {
      output.set(`${point.row},${point.col}`, point);
    });
  });
  return Array.from(output.values());
};

const createDitherMask = (pattern, size) => {
  if (pattern === 'checker') {
    return [
      [0, 1],
      [1, 0]
    ];
  }
  if (pattern === 'bayer4') {
    return [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
  }
  return [
    [0, 2],
    [3, 1]
  ];
};

export default class PixelStudio {
  constructor(game) {
    this.game = game;
    this.tileLibrary = TILE_LIBRARY;
    this.activeTile = this.tileLibrary[0] || null;
    this.tileIndex = 0;
    this.modeTab = 'draw';
    this.tools = createToolRegistry(this);
    this.activeToolId = TOOL_IDS.PENCIL;
    this.toolOptions = {
      brushSize: 1,
      linePerfect: true,
      fillContiguous: true,
      fillTolerance: 0,
      symmetry: { horizontal: false, vertical: false },
      wrapDraw: false,
      ditherPattern: 'bayer2',
      ditherStrength: 2,
      replaceScope: 'layer'
    };
    this.canvasState = {
      width: 16,
      height: 16,
      layers: [createLayer(16, 16, 'Layer 1')],
      activeLayerIndex: 0
    };
    this.palettePresets = [];
    this.customPalettes = loadCustomPalettes();
    this.currentPalette = buildPalette(['#000000', '#ffffff'], 'Temp');
    this.paletteIndex = 0;
    this.secondaryPaletteIndex = 1;
    this.paletteRamps = [];
    this.limitToPalette = false;
    this.selection = {
      active: false,
      mask: null,
      bounds: null,
      mode: null,
      start: null,
      end: null,
      lassoPoints: [],
      floating: null,
      offset: { x: 0, y: 0 }
    };
    this.clipboard = null;
    this.view = {
      zoomLevels: [6, 8, 10, 12, 16, 20, 24, 28, 32],
      zoomIndex: 4,
      panX: 0,
      panY: 0
    };
    this.tiledPreview = { enabled: false, tiles: 2 };
    this.animation = {
      frames: [createFrame(this.canvasState.layers, 120)],
      currentFrameIndex: 0,
      playing: false,
      loop: true,
      onion: { enabled: false, prev: 1, next: 1, opacity: 0.35 }
    };
    this.undoStack = new UndoStack(75);
    this.pendingHistory = null;
    this.strokeState = null;
    this.linePreview = null;
    this.cloneSource = null;
    this.cloneOffset = null;
    this.panStart = null;
    this.longPressTimer = null;
    this.cursor = { row: 0, col: 0, x: 0, y: 0 };
    this.gamepadCursor = { x: 0, y: 0, active: false, initialized: false };
    this.gamepadDrawing = false;
    this.gamepadErase = false;
    this.gamepadHintVisible = false;
    this.uiFocusMode = false;
    this.uiFocusIndex = 0;
    this.uiButtons = [];
    this.paletteBounds = [];
    this.layerBounds = [];
    this.frameBounds = [];
    this.statusMessage = '';
    this.lastTime = 0;
    this.spaceDown = false;
    this.altDown = false;
    this.offscreen = document.createElement('canvas');
    this.offscreenCtx = this.offscreen.getContext('2d');
    this.exportLink = document.createElement('a');
    this.paletteFileInput = document.createElement('input');
    this.paletteFileInput.type = 'file';
    this.paletteFileInput.accept = '.json,.txt';
    this.paletteFileInput.style.display = 'none';
    document.body.appendChild(this.paletteFileInput);
    this.paletteFileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        const colors = typeof text === 'string' ? parsePaletteText(text) : [];
        if (colors.length) {
          const palette = buildPalette(colors, `Imported ${Date.now()}`);
          this.customPalettes.push(palette);
          saveCustomPalettes(this.customPalettes);
          this.currentPalette = palette;
          this.paletteIndex = 0;
        }
      };
      reader.readAsText(file);
    });
    this.initializePalettes();
    this.loadTileData();
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.handleKeyUp(event));
  }

  async initializePalettes() {
    this.palettePresets = await loadPalettePresets();
    this.currentPalette = this.palettePresets[0] || this.currentPalette;
  }

  get activeLayer() {
    return this.canvasState.layers[this.canvasState.activeLayerIndex];
  }

  get currentFrame() {
    return this.animation.frames[this.animation.currentFrameIndex];
  }

  setFrameLayers(layers) {
    this.canvasState.layers = layers;
    this.currentFrame.layers = layers;
  }

  loadTileData() {
    if (!this.game?.world?.pixelArt) {
      this.game.world.pixelArt = { tiles: {} };
    }
    if (!this.game.world.pixelArt.tiles) {
      this.game.world.pixelArt.tiles = {};
    }
    const tiles = this.game.world.pixelArt.tiles;
    const tileChar = this.activeTile?.char;
    if (!tileChar) return;
    if (!tiles[tileChar]) {
      tiles[tileChar] = { size: 16, frames: [Array(16 * 16).fill(null)], fps: 6 };
    }
    const pixelData = tiles[tileChar];
    if (!pixelData.editor) {
      const size = pixelData.size || 16;
      const baseLayer = createLayer(size, size, 'Layer 1');
      const frame = pixelData.frames?.[0] || Array(size * size).fill(null);
      frame.forEach((color, index) => {
        if (!color) return;
        const rgba = hexToRgba(color);
        baseLayer.pixels[index] = rgbaToUint32(rgba);
      });
      pixelData.editor = {
        width: size,
        height: size,
        frames: [createFrame([baseLayer], 120)],
        activeLayerIndex: 0
      };
    }
    this.canvasState.width = pixelData.editor.width;
    this.canvasState.height = pixelData.editor.height;
    this.animation.frames = pixelData.editor.frames;
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = pixelData.editor.activeLayerIndex || 0;
    this.setFrameLayers(this.animation.frames[0].layers);
  }

  syncTileData() {
    const tileChar = this.activeTile?.char;
    if (!tileChar || !this.game?.world?.pixelArt?.tiles) return;
    const tiles = this.game.world.pixelArt.tiles;
    if (!tiles[tileChar]) return;
    const pixelData = tiles[tileChar];
    pixelData.editor = {
      width: this.canvasState.width,
      height: this.canvasState.height,
      frames: this.animation.frames,
      activeLayerIndex: this.canvasState.activeLayerIndex
    };
    pixelData.size = this.canvasState.width;
    pixelData.frames = this.animation.frames.map((frame) => {
      const composite = compositeLayers(frame.layers, this.canvasState.width, this.canvasState.height);
      return Array.from(composite).map((value) => {
        if (!value) return null;
        const rgba = uint32ToRgba(value);
        const hex = `#${[rgba.r, rgba.g, rgba.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
        return rgba.a === 0 ? null : hex;
      });
    });
    pixelData.fps = Math.round(1000 / (this.animation.frames[0]?.durationMs || 120));
  }

  setActiveTile(tile) {
    this.activeTile = tile;
    const index = this.tileLibrary.findIndex((entry) => entry.id === tile?.id);
    if (index >= 0) this.tileIndex = index;
    this.loadTileData();
  }

  resetFocus() {
    this.uiFocusMode = false;
  }

  handleKeyDown(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (event.key === ' ') this.spaceDown = true;
    if (event.key === 'Alt') this.altDown = true;
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      this.undo();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (event.shiftKey && key === 'z'))) {
      this.redo();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      this.copySelection();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'x') {
      this.cutSelection();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'v') {
      this.pasteClipboard();
      event.preventDefault();
      return;
    }
    if (key === 'b') this.activeToolId = TOOL_IDS.PENCIL;
    if (key === 'e') this.activeToolId = TOOL_IDS.ERASER;
    if (key === 'g') this.activeToolId = TOOL_IDS.FILL;
    if (key === 'i') this.activeToolId = TOOL_IDS.EYEDROPPER;
    if (key === 'v') this.activeToolId = TOOL_IDS.MOVE;
    if (key === 's') this.activeToolId = TOOL_IDS.SELECT_RECT;
    if (key === '[') this.toolOptions.brushSize = clamp(this.toolOptions.brushSize - 1, 1, 8);
    if (key === ']') this.toolOptions.brushSize = clamp(this.toolOptions.brushSize + 1, 1, 8);
    if (key === '+' || key === '=') this.zoomBy(1);
    if (key === '-') this.zoomBy(-1);
    const tool = this.tools.find((entry) => entry.id === this.activeToolId);
    tool?.onKeyDown?.(event);
  }

  handleKeyUp(event) {
    if (event.key === ' ') this.spaceDown = false;
    if (event.key === 'Alt') this.altDown = false;
  }

  update(input, dt = 0) {
    this.lastTime += dt;
    this.updateAnimation(dt);
    this.handleGamepad(input, dt);
    this.updateCursorPosition();
  }

  updateAnimation(dt) {
    if (!this.animation.playing) return;
    const frame = this.currentFrame;
    frame.elapsed = (frame.elapsed || 0) + dt;
    if (frame.elapsed >= frame.durationMs) {
      frame.elapsed = 0;
      const nextIndex = this.animation.currentFrameIndex + 1;
      if (nextIndex >= this.animation.frames.length) {
        if (this.animation.loop) {
          this.animation.currentFrameIndex = 0;
        } else {
          this.animation.playing = false;
        }
      } else {
        this.animation.currentFrameIndex = nextIndex;
      }
      this.setFrameLayers(this.currentFrame.layers);
    }
  }

  handleGamepad(input, dt) {
    const axes = input.getGamepadAxes?.() || { leftX: 0, leftY: 0, leftTrigger: 0, rightTrigger: 0 };
    const connected = input.isGamepadConnected?.() || false;
    if (connected && !this.gamepadHintVisible) {
      console.info('[PixelStudio] Gamepad detected.');
      this.gamepadHintVisible = true;
    }
    if (!connected) {
      this.gamepadCursor.active = false;
      return;
    }

    if (this.canvasBounds && !this.gamepadCursor.initialized) {
      this.gamepadCursor.x = this.canvasBounds.x + this.canvasBounds.w / 2;
      this.gamepadCursor.y = this.canvasBounds.y + this.canvasBounds.h / 2;
      this.gamepadCursor.initialized = true;
    }
    this.gamepadCursor = updateGamepadCursor(this.gamepadCursor, axes, dt, 320);
    this.gamepadCursor.active = true;
    if (this.canvasBounds) {
      this.gamepadCursor.x = clamp(this.gamepadCursor.x, this.canvasBounds.x, this.canvasBounds.x + this.canvasBounds.w);
      this.gamepadCursor.y = clamp(this.gamepadCursor.y, this.canvasBounds.y, this.canvasBounds.y + this.canvasBounds.h);
    }

    const actions = input.getGamepadActions?.() || {};
    const aDown = actions.jump;
    const bDown = actions.dash;
    const xPressed = input.wasGamepadPressed?.('rev');
    const yPressed = input.wasGamepadPressed?.('throw');
    const lbPressed = input.wasGamepadPressed?.('aimUp');
    const rbPressed = input.wasGamepadPressed?.('aimDown');
    const startPressed = input.wasGamepadPressed?.('pause');
    const backPressed = input.wasGamepadPressed?.('cancel');
    const r3Pressed = input.wasGamepadPressed?.('flame');
    const dpadLeft = input.wasGamepadPressed?.('dpadLeft');
    const dpadRight = input.wasGamepadPressed?.('dpadRight');
    const dpadUp = input.wasGamepadPressed?.('dpadUp');
    const dpadDown = input.wasGamepadPressed?.('dpadDown');

    if (lbPressed) this.cyclePalette(-1);
    if (rbPressed) this.cyclePalette(1);
    if (axes.leftTrigger > 0.6) this.zoomBy(-1);
    if (axes.rightTrigger > 0.6) this.zoomBy(1);
    if (xPressed) this.activeToolId = TOOL_IDS.EYEDROPPER;
    if (yPressed) this.activeToolId = this.selection.active ? TOOL_IDS.MOVE : TOOL_IDS.SELECT_RECT;
    if (startPressed) this.animation.playing = !this.animation.playing;
    if (backPressed) {
      if (this.modeTab === 'animate') {
        this.animation.onion.enabled = !this.animation.onion.enabled;
      } else {
        this.tiledPreview.enabled = !this.tiledPreview.enabled;
      }
    }
    if (r3Pressed) this.uiFocusMode = !this.uiFocusMode;

    if (this.uiFocusMode && (dpadLeft || dpadRight || dpadUp || dpadDown)) {
      const direction = dpadLeft || dpadUp ? -1 : 1;
      if (this.uiButtons.length) {
        this.uiFocusIndex = (this.uiFocusIndex + direction + this.uiButtons.length) % this.uiButtons.length;
      }
    }

    if (this.uiFocusMode && aDown && this.uiButtons[this.uiFocusIndex]) {
      this.uiButtons[this.uiFocusIndex].onClick?.();
      return;
    }

    if (dpadLeft || dpadRight || dpadUp || dpadDown) {
      const tool = this.tools.find((entry) => entry.id === this.activeToolId);
      if (tool?.onGamepad) {
        if (dpadLeft) tool.onGamepad('dpadLeft');
        if (dpadRight) tool.onGamepad('dpadRight');
        if (dpadUp) tool.onGamepad('dpadUp');
        if (dpadDown) tool.onGamepad('dpadDown');
      }
    }

    if (aDown && !this.gamepadDrawing) {
      this.gamepadDrawing = true;
      const point = this.getGridCellFromScreen(this.gamepadCursor.x, this.gamepadCursor.y);
      if (point) this.handleToolPointerDown(point, { fromGamepad: true });
    }
    if (!aDown && this.gamepadDrawing) {
      this.gamepadDrawing = false;
      this.handleToolPointerUp();
    }
    if (this.gamepadDrawing) {
      const point = this.getGridCellFromScreen(this.gamepadCursor.x, this.gamepadCursor.y);
      if (point) this.handleToolPointerMove(point);
    }

    if (bDown) {
      if (!this.gamepadErase) {
        this.gamepadErase = true;
        this.activeToolId = TOOL_IDS.ERASER;
      }
    } else if (this.gamepadErase) {
      this.gamepadErase = false;
      this.activeToolId = TOOL_IDS.PENCIL;
    }
  }

  zoomBy(delta) {
    this.view.zoomIndex = clamp(this.view.zoomIndex + delta, 0, this.view.zoomLevels.length - 1);
  }

  updateCursorPosition() {
    if (!this.canvasBounds) return;
    const sourceX = this.gamepadCursor.active ? this.gamepadCursor.x : this.cursor.x;
    const sourceY = this.gamepadCursor.active ? this.gamepadCursor.y : this.cursor.y;
    const cell = this.getGridCellFromScreen(sourceX, sourceY);
    if (cell) {
      this.cursor.row = cell.row;
      this.cursor.col = cell.col;
    }
  }

  handlePointerDown(payload) {
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    const button = payload.button ?? 0;
    if (this.handleButtonClick(payload.x, payload.y)) return;
    if (this.canvasBounds && this.isPointInBounds(payload, this.canvasBounds)) {
      if (this.spaceDown || button === 1) {
        this.panStart = { x: payload.x, y: payload.y, panX: this.view.panX, panY: this.view.panY };
        return;
      }
      const point = this.getGridCellFromScreen(payload.x, payload.y);
      if (point) {
        this.handleToolPointerDown(point, { altKey: this.altDown, fromTouch: payload.touchCount });
      }
      if (payload.touchCount) {
        this.startLongPress(payload);
      }
    }
  }

  handlePointerMove(payload) {
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    if (this.panStart && payload.buttons) {
      this.view.panX = this.panStart.panX + (payload.x - this.panStart.x);
      this.view.panY = this.panStart.panY + (payload.y - this.panStart.y);
      return;
    }
    const point = this.getGridCellFromScreen(payload.x, payload.y);
    if (point) {
      this.handleToolPointerMove(point);
    }
  }

  handlePointerUp() {
    if (this.panStart) {
      this.panStart = null;
    }
    this.cancelLongPress();
    this.handleToolPointerUp();
  }

  handleWheel(payload) {
    const direction = payload.deltaY > 0 ? -1 : 1;
    this.zoomBy(direction);
  }

  handleGestureStart(payload) {
    if (!this.canvasBounds) return;
    if (!payload?.distance) return;
    this.gesture = { startDistance: payload.distance, startZoomIndex: this.view.zoomIndex };
  }

  handleGestureMove(payload) {
    if (!this.gesture?.startDistance) return;
    const scale = payload.distance / this.gesture.startDistance;
    const levels = this.view.zoomLevels;
    const target = levels[this.gesture.startZoomIndex] * scale;
    let closestIndex = 0;
    let closest = Infinity;
    levels.forEach((value, index) => {
      const delta = Math.abs(value - target);
      if (delta < closest) {
        closest = delta;
        closestIndex = index;
      }
    });
    this.view.zoomIndex = closestIndex;
  }

  handleGestureEnd() {
    this.gesture = null;
  }

  startLongPress(payload) {
    this.cancelLongPress();
    this.longPressTimer = setTimeout(() => {
      const point = this.getGridCellFromScreen(payload.x, payload.y);
      if (point) {
        this.pickColor(point);
      }
    }, 450);
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  handleToolPointerDown(point, modifiers = {}) {
    const tool = this.tools.find((entry) => entry.id === this.activeToolId);
    if (tool?.onPointerDown) {
      tool.onPointerDown(point, modifiers);
    }
  }

  handleToolPointerMove(point) {
    const tool = this.tools.find((entry) => entry.id === this.activeToolId);
    if (tool?.onPointerMove) {
      tool.onPointerMove(point);
    }
  }

  handleToolPointerUp() {
    const tool = this.tools.find((entry) => entry.id === this.activeToolId);
    if (tool?.onPointerUp) {
      tool.onPointerUp();
    }
  }

  handleMoveKey(event) {
    if (!this.selection.active) return;
    const delta = { x: 0, y: 0 };
    if (event.key === 'ArrowLeft') delta.x = -1;
    if (event.key === 'ArrowRight') delta.x = 1;
    if (event.key === 'ArrowUp') delta.y = -1;
    if (event.key === 'ArrowDown') delta.y = 1;
    if (delta.x || delta.y) {
      this.nudgeSelection(delta.x, delta.y);
    }
  }

  handleMoveGamepad(action) {
    if (!this.selection.active) return;
    if (action === 'dpadLeft') this.nudgeSelection(-1, 0);
    if (action === 'dpadRight') this.nudgeSelection(1, 0);
    if (action === 'dpadUp') this.nudgeSelection(0, -1);
    if (action === 'dpadDown') this.nudgeSelection(0, 1);
  }

  startHistory(label) {
    this.pendingHistory = {
      label,
      frameIndex: this.animation.currentFrameIndex,
      layersBefore: this.canvasState.layers.map((layer) => new Uint32Array(layer.pixels))
    };
  }

  commitHistory() {
    if (!this.pendingHistory) return;
    const layersAfter = this.canvasState.layers.map((layer) => new Uint32Array(layer.pixels));
    this.pendingHistory.layersAfter = layersAfter;
    this.undoStack.push(this.pendingHistory);
    this.pendingHistory = null;
    this.syncTileData();
  }

  undo() {
    const entry = this.undoStack.undo();
    if (!entry) return;
    this.animation.currentFrameIndex = entry.frameIndex;
    const frame = this.animation.frames[this.animation.currentFrameIndex];
    frame.layers.forEach((layer, index) => {
      layer.pixels.set(entry.layersBefore[index]);
    });
    this.setFrameLayers(frame.layers);
    this.syncTileData();
  }

  redo() {
    const entry = this.undoStack.redo();
    if (!entry) return;
    this.animation.currentFrameIndex = entry.frameIndex;
    const frame = this.animation.frames[this.animation.currentFrameIndex];
    frame.layers.forEach((layer, index) => {
      layer.pixels.set(entry.layersAfter[index]);
    });
    this.setFrameLayers(frame.layers);
    this.syncTileData();
  }

  startStroke(point, { mode }) {
    if (!this.activeLayer || this.activeLayer.locked) return;
    this.startHistory(`${mode} stroke`);
    this.strokeState = {
      mode,
      lastPoint: point
    };
    this.applyBrush(point);
  }

  continueStroke(point) {
    if (!this.strokeState) return;
    const line = bresenhamLine(this.strokeState.lastPoint, point);
    line.forEach((pt) => this.applyBrush(pt));
    this.strokeState.lastPoint = point;
  }

  finishStroke() {
    if (!this.strokeState) return;
    this.strokeState = null;
    this.commitHistory();
  }

  applyBrush(point) {
    const { width, height } = this.canvasState;
    const size = this.toolOptions.brushSize;
    const radius = Math.floor(size / 2);
    const points = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        points.push({ row: point.row + dy, col: point.col + dx });
      }
    }
    const symmetryPoints = applySymmetryPoints(points, width, height, this.toolOptions.symmetry);
    symmetryPoints.forEach((pt) => {
      const row = this.wrapCoord(pt.row, height);
      const col = this.wrapCoord(pt.col, width);
      if (row < 0 || col < 0 || row >= height || col >= width) return;
      if (this.selection.active && this.selection.mask && !this.selection.mask[row * width + col]) return;
      const index = row * width + col;
      const target = this.activeLayer.pixels[index];
      if (this.strokeState.mode === 'clone') {
        this.applyCloneStroke({ row, col });
        return;
      }
      let colorValue = this.getActiveColorValue();
      if (this.strokeState.mode === 'erase') colorValue = 0;
      if (this.strokeState.mode === 'dither') {
        if (!this.shouldApplyDither(row, col)) return;
      }
      if (this.toolOptions.symmetry?.mirrorOnly && target === colorValue) return;
      this.activeLayer.pixels[index] = colorValue;
    });
  }

  shouldApplyDither(row, col) {
    const pattern = this.toolOptions.ditherPattern;
    const strength = Math.max(1, this.toolOptions.ditherStrength);
    const matrix = createDitherMask(pattern, 2);
    const size = matrix.length;
    const value = matrix[row % size][col % size];
    return value % strength === 0;
  }

  getActiveColorValue() {
    const hex = getPaletteSwatchHex(this.currentPalette, this.paletteIndex);
    return rgbaToUint32(hexToRgba(hex));
  }

  pickColor(point) {
    const composite = compositeLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    const value = composite[point.row * this.canvasState.width + point.col];
    if (!value) return;
    const rgba = uint32ToRgba(value);
    this.paletteIndex = getNearestPaletteIndex(this.currentPalette, rgba);
  }

  startLine(point) {
    this.linePreview = { start: point, end: point };
  }

  updateLine(point) {
    if (!this.linePreview) return;
    this.linePreview.end = point;
  }

  commitLine() {
    if (!this.linePreview) return;
    this.startHistory('line');
    const points = bresenhamLine(this.linePreview.start, this.linePreview.end);
    const filtered = this.toolOptions.linePerfect ? this.applyPerfectPixels(points) : points;
    filtered.forEach((pt) => this.applyBrush(pt));
    this.linePreview = null;
    this.commitHistory();
  }

  applyPerfectPixels(points) {
    if (points.length < 3) return points;
    const filtered = [points[0]];
    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];
      if ((prev.row !== current.row && prev.col !== current.col)
        && (next.row !== current.row && next.col !== current.col)) {
        continue;
      }
      filtered.push(current);
    }
    filtered.push(points[points.length - 1]);
    return filtered;
  }

  applyFill(point) {
    if (!this.activeLayer || this.activeLayer.locked) return;
    this.startHistory('fill');
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const index = point.row * width + point.col;
    const target = this.activeLayer.pixels[index];
    const replacement = this.getActiveColorValue();
    if (target === replacement) {
      this.pendingHistory = null;
      return;
    }
    if (!this.toolOptions.fillContiguous) {
      const tolerance = this.toolOptions.fillTolerance;
      const targetRgba = uint32ToRgba(target);
      for (let i = 0; i < this.activeLayer.pixels.length; i += 1) {
        if (this.selection.mask && this.selection.active && !this.selection.mask[i]) continue;
        const currentValue = this.activeLayer.pixels[i];
        const currentRgba = uint32ToRgba(currentValue);
        const dist = Math.hypot(currentRgba.r - targetRgba.r, currentRgba.g - targetRgba.g, currentRgba.b - targetRgba.b);
        if (dist > tolerance) continue;
        this.activeLayer.pixels[i] = replacement;
      }
      this.commitHistory();
      return;
    }
    const queue = [point];
    const visited = new Set();
    const tolerance = this.toolOptions.fillTolerance;
    const targetRgba = uint32ToRgba(target);
    while (queue.length) {
      const current = queue.pop();
      const key = `${current.row},${current.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const idx = current.row * width + current.col;
      if (this.selection.mask && this.selection.active && !this.selection.mask[idx]) continue;
      const currentValue = this.activeLayer.pixels[idx];
      const currentRgba = uint32ToRgba(currentValue);
      const dist = Math.hypot(currentRgba.r - targetRgba.r, currentRgba.g - targetRgba.g, currentRgba.b - targetRgba.b);
      if (dist > tolerance) continue;
      this.activeLayer.pixels[idx] = replacement;
      if (current.row > 0) queue.push({ row: current.row - 1, col: current.col });
      if (current.row < height - 1) queue.push({ row: current.row + 1, col: current.col });
      if (current.col > 0) queue.push({ row: current.row, col: current.col - 1 });
      if (current.col < width - 1) queue.push({ row: current.row, col: current.col + 1 });
    }
    this.commitHistory();
  }

  replaceColor(point) {
    if (!this.activeLayer || this.activeLayer.locked) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const index = point.row * width + point.col;
    const target = this.activeLayer.pixels[index];
    if (!target) return;
    const replacement = this.getActiveColorValue();
    this.startHistory('replace color');
    for (let i = 0; i < this.activeLayer.pixels.length; i += 1) {
      if (this.activeLayer.pixels[i] !== target) continue;
      if (this.toolOptions.replaceScope === 'selection' && this.selection.mask && !this.selection.mask[i]) continue;
      this.activeLayer.pixels[i] = replacement;
    }
    this.commitHistory();
  }

  startSelection(point, mode) {
    this.selection.active = false;
    this.selection.mode = mode;
    this.selection.start = point;
    this.selection.end = point;
  }

  updateSelection(point) {
    if (!this.selection.start) return;
    this.selection.end = point;
  }

  commitSelection() {
    if (!this.selection.start || !this.selection.end) return;
    const bounds = this.getBoundsFromPoints(this.selection.start, this.selection.end);
    this.selection.bounds = bounds;
    this.selection.mask = this.selection.mode === 'ellipse'
      ? generateEllipseMask(this.canvasState.width, this.canvasState.height, bounds)
      : createRectMask(this.canvasState.width, this.canvasState.height, bounds);
    this.selection.active = true;
  }

  addLassoPoint(point) {
    if (!this.selection.lassoPoints.length) {
      this.selection.lassoPoints = [{ x: point.col + 0.5, y: point.row + 0.5 }];
      this.selection.active = false;
      return;
    }
    const last = this.selection.lassoPoints[this.selection.lassoPoints.length - 1];
    if (Math.hypot(point.col + 0.5 - last.x, point.row + 0.5 - last.y) < 1) {
      this.commitLasso();
      return;
    }
    this.selection.lassoPoints.push({ x: point.col + 0.5, y: point.row + 0.5 });
  }

  commitLasso() {
    if (this.selection.lassoPoints.length < 3) return;
    this.selection.mask = createPolygonMask(this.canvasState.width, this.canvasState.height, this.selection.lassoPoints);
    this.selection.bounds = this.getMaskBounds(this.selection.mask);
    this.selection.active = true;
    this.selection.lassoPoints = [];
  }

  startMove(point) {
    if (!this.selection.active) return;
    this.selection.floating = this.extractSelectionPixels();
    this.selection.offset = { x: 0, y: 0 };
    this.selection.start = point;
  }

  updateMove(point) {
    if (!this.selection.floating || !this.selection.start) return;
    this.selection.offset = {
      x: point.col - this.selection.start.col,
      y: point.row - this.selection.start.row
    };
  }

  commitMove() {
    if (!this.selection.floating) return;
    this.startHistory('move selection');
    this.pasteSelectionPixels(this.selection.floating, this.selection.offset.x, this.selection.offset.y);
    this.selection.floating = null;
    this.commitHistory();
  }

  extractSelectionPixels() {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = new Uint32Array(width * height);
    this.activeLayer.pixels.forEach((value, index) => {
      if (!this.selection.mask || !this.selection.mask[index]) return;
      pixels[index] = value;
      this.activeLayer.pixels[index] = 0;
    });
    return pixels;
  }

  pasteSelectionPixels(pixels, offsetX, offsetY) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const srcIndex = row * width + col;
        const value = pixels[srcIndex];
        if (!value) continue;
        const destRow = row + offsetY;
        const destCol = col + offsetX;
        if (destRow < 0 || destCol < 0 || destRow >= height || destCol >= width) continue;
        const destIndex = destRow * width + destCol;
        this.activeLayer.pixels[destIndex] = value;
      }
    }
  }

  nudgeSelection(dx, dy) {
    if (!this.selection.active) return;
    this.startHistory('nudge selection');
    const pixels = this.extractSelectionPixels();
    this.pasteSelectionPixels(pixels, dx, dy);
    this.commitHistory();
  }

  copySelection() {
    if (!this.selection.active || !this.selection.mask) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = new Uint32Array(width * height);
    this.activeLayer.pixels.forEach((value, index) => {
      if (!this.selection.mask[index]) return;
      pixels[index] = value;
    });
    this.clipboard = { width, height, pixels };
  }

  cutSelection() {
    if (!this.selection.active) return;
    this.copySelection();
    this.startHistory('cut selection');
    this.activeLayer.pixels.forEach((_, index) => {
      if (!this.selection.mask[index]) return;
      this.activeLayer.pixels[index] = 0;
    });
    this.commitHistory();
  }

  pasteClipboard() {
    if (!this.clipboard) return;
    this.startHistory('paste');
    this.clipboard.pixels.forEach((value, index) => {
      if (!value) return;
      this.activeLayer.pixels[index] = value;
    });
    this.commitHistory();
  }

  clearSelection() {
    this.selection.active = false;
    this.selection.mask = null;
    this.selection.bounds = null;
  }

  invertSelection() {
    const size = this.canvasState.width * this.canvasState.height;
    if (!this.selection.mask) {
      this.selection.mask = new Uint8Array(size);
    }
    for (let i = 0; i < size; i += 1) {
      this.selection.mask[i] = this.selection.mask[i] ? 0 : 1;
    }
    this.selection.bounds = this.getMaskBounds(this.selection.mask);
    this.selection.active = true;
  }

  expandSelection(delta) {
    if (!this.selection.mask) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const nextMask = new Uint8Array(this.selection.mask);
    const radius = Math.abs(delta);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const index = row * width + col;
        if (delta > 0 && this.selection.mask[index]) {
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const r = row + dy;
              const c = col + dx;
              if (r < 0 || c < 0 || r >= height || c >= width) continue;
              nextMask[r * width + c] = 1;
            }
          }
        } else if (delta < 0 && this.selection.mask[index]) {
          let keep = true;
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const r = row + dy;
              const c = col + dx;
              if (r < 0 || c < 0 || r >= height || c >= width) continue;
              if (!this.selection.mask[r * width + c]) {
                keep = false;
                break;
              }
            }
            if (!keep) break;
          }
          if (!keep) nextMask[index] = 0;
        }
      }
    }
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
  }

  transformSelection(type) {
    if (!this.selection.mask) return;
    this.startHistory(`transform ${type}`);
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = this.extractSelectionPixels();
    const transformed = new Uint32Array(this.activeLayer.pixels);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const index = row * width + col;
        const value = pixels[index];
        if (!value) continue;
        let targetRow = row;
        let targetCol = col;
        if (type === 'flip-h') targetCol = width - 1 - col;
        if (type === 'flip-v') targetRow = height - 1 - row;
        if (type === 'rotate-cw') {
          targetRow = col;
          targetCol = width - 1 - row;
        }
        if (type === 'rotate-ccw') {
          targetRow = height - 1 - col;
          targetCol = row;
        }
        transformed[targetRow * width + targetCol] = value;
      }
    }
    this.activeLayer.pixels = transformed;
    this.commitHistory();
  }

  scaleSelection(factor) {
    if (!this.selection.mask) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = this.extractSelectionPixels();
    const next = new Uint32Array(this.activeLayer.pixels);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const value = pixels[row * width + col];
        if (!value) continue;
        for (let sy = 0; sy < factor; sy += 1) {
          for (let sx = 0; sx < factor; sx += 1) {
            const r = row * factor + sy;
            const c = col * factor + sx;
            if (r < height && c < width) {
              next[r * width + c] = value;
            }
          }
        }
      }
    }
    this.activeLayer.pixels = next;
    this.commitHistory();
  }

  handleCloneDown(point, modifiers = {}) {
    if (modifiers.altKey || modifiers.fromTouch) {
      this.cloneSource = point;
      this.statusMessage = 'Clone source set';
      return;
    }
    if (!this.cloneSource) return;
    this.cloneOffset = { row: this.cloneSource.row - point.row, col: this.cloneSource.col - point.col };
    this.startStroke(point, { mode: 'clone' });
  }

  applyClone(point) {
    if (!this.cloneOffset) return;
    const row = point.row + this.cloneOffset.row;
    const col = point.col + this.cloneOffset.col;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    if (row < 0 || col < 0 || row >= height || col >= width) return;
    const sourceIndex = row * width + col;
    const destIndex = point.row * width + point.col;
    if (this.selection.active && this.selection.mask && !this.selection.mask[destIndex]) return;
    this.activeLayer.pixels[destIndex] = this.activeLayer.pixels[sourceIndex];
  }

  applyCloneStroke(point) {
    if (!this.cloneOffset) return;
    this.applyClone(point);
  }

  cyclePalette(delta) {
    const count = this.currentPalette.colors.length;
    this.setPaletteIndex((this.paletteIndex + delta + count) % count);
  }

  setPaletteIndex(index) {
    this.secondaryPaletteIndex = this.paletteIndex;
    this.paletteIndex = index;
  }

  generateRamp(steps = 4) {
    const start = this.currentPalette.colors[this.paletteIndex];
    const end = this.currentPalette.colors[this.secondaryPaletteIndex] || start;
    if (!start || !end) return;
    const colors = [];
    for (let i = 0; i < steps; i += 1) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const r = Math.round(lerp(start.rgba.r, end.rgba.r, t));
      const g = Math.round(lerp(start.rgba.g, end.rgba.g, t));
      const b = Math.round(lerp(start.rgba.b, end.rgba.b, t));
      colors.push({
        id: `ramp-${Date.now()}-${i}`,
        hex: `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`,
        rgba: { r, g, b, a: 255 }
      });
    }
    this.currentPalette.colors.push(...colors);
  }

  addPaletteColor() {
    const color = this.currentPalette.colors[this.paletteIndex];
    if (!color) return;
    const copy = {
      id: `color-${Date.now()}`,
      hex: color.hex,
      rgba: { ...color.rgba }
    };
    this.currentPalette.colors.splice(this.paletteIndex + 1, 0, copy);
    this.paletteIndex += 1;
  }

  removePaletteColor() {
    if (this.currentPalette.colors.length <= 1) return;
    this.currentPalette.colors.splice(this.paletteIndex, 1);
    this.paletteIndex = clamp(this.paletteIndex, 0, this.currentPalette.colors.length - 1);
  }

  movePaletteColor(delta) {
    const nextIndex = clamp(this.paletteIndex + delta, 0, this.currentPalette.colors.length - 1);
    if (nextIndex === this.paletteIndex) return;
    const [item] = this.currentPalette.colors.splice(this.paletteIndex, 1);
    this.currentPalette.colors.splice(nextIndex, 0, item);
    this.paletteIndex = nextIndex;
  }

  saveCurrentPalette() {
    const palette = buildPalette(this.currentPalette.colors.map((entry) => entry.hex), `${this.currentPalette.name} Copy`);
    this.customPalettes.push(palette);
    saveCustomPalettes(this.customPalettes);
  }

  cycleTile(delta) {
    const count = this.tileLibrary.length;
    this.tileIndex = (this.tileIndex + delta + count) % count;
    this.setActiveTile(this.tileLibrary[this.tileIndex]);
  }

  wrapCoord(value, max) {
    if (!this.toolOptions.wrapDraw) return value;
    return (value + max) % max;
  }

  getBoundsFromPoints(start, end) {
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    return { x: minCol, y: minRow, w: maxCol - minCol + 1, h: maxRow - minRow + 1 };
  }

  getMaskBounds(mask) {
    if (!mask) return null;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    let minRow = height;
    let maxRow = 0;
    let minCol = width;
    let maxCol = 0;
    let found = false;
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        if (!mask[row * width + col]) continue;
        found = true;
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
      }
    }
    if (!found) return null;
    return { x: minCol, y: minRow, w: maxCol - minCol + 1, h: maxRow - minRow + 1 };
  }

  offsetCanvas(dx, dy, wrap = true) {
    this.startHistory('offset');
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    this.canvasState.layers.forEach((layer) => {
      const next = new Uint32Array(width * height);
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const value = layer.pixels[row * width + col];
          if (!value) continue;
          let targetRow = row + dy;
          let targetCol = col + dx;
          if (wrap) {
            targetRow = (targetRow + height) % height;
            targetCol = (targetCol + width) % width;
          }
          if (targetRow < 0 || targetCol < 0 || targetRow >= height || targetCol >= width) continue;
          next[targetRow * width + targetCol] = value;
        }
      }
      layer.pixels = next;
    });
    this.commitHistory();
  }

  addLayer() {
    const layer = createLayer(this.canvasState.width, this.canvasState.height, `Layer ${this.canvasState.layers.length + 1}`);
    this.canvasState.layers.push(layer);
    this.canvasState.activeLayerIndex = this.canvasState.layers.length - 1;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  deleteLayer(index) {
    if (this.canvasState.layers.length <= 1) return;
    this.canvasState.layers.splice(index, 1);
    this.canvasState.activeLayerIndex = clamp(this.canvasState.activeLayerIndex, 0, this.canvasState.layers.length - 1);
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  duplicateLayer(index) {
    const layer = cloneLayer(this.canvasState.layers[index]);
    layer.name = `${layer.name} Copy`;
    this.canvasState.layers.splice(index + 1, 0, layer);
    this.canvasState.activeLayerIndex = index + 1;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  mergeLayerDown(index) {
    this.canvasState.layers = mergeDown(this.canvasState.layers, index);
    this.canvasState.activeLayerIndex = clamp(index - 1, 0, this.canvasState.layers.length - 1);
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  flattenAllLayers() {
    this.canvasState.layers = flattenLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    this.canvasState.activeLayerIndex = 0;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  reorderLayer(from, to) {
    this.canvasState.layers = reorderLayer(this.canvasState.layers, from, to);
    this.canvasState.activeLayerIndex = to;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  addFrame() {
    const newFrame = createFrame(this.canvasState.layers, 120);
    this.animation.frames.push(newFrame);
    this.animation.currentFrameIndex = this.animation.frames.length - 1;
    this.setFrameLayers(newFrame.layers);
    this.syncTileData();
  }

  duplicateFrame(index) {
    const clone = cloneFrame(this.animation.frames[index]);
    this.animation.frames.splice(index + 1, 0, clone);
    this.animation.currentFrameIndex = index + 1;
    this.setFrameLayers(clone.layers);
    this.syncTileData();
  }

  deleteFrame(index) {
    if (this.animation.frames.length <= 1) return;
    this.animation.frames.splice(index, 1);
    this.animation.currentFrameIndex = clamp(this.animation.currentFrameIndex, 0, this.animation.frames.length - 1);
    this.setFrameLayers(this.animation.frames[this.animation.currentFrameIndex].layers);
    this.syncTileData();
  }

  exportPng() {
    const composite = compositeLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasState.width;
    canvas.height = this.canvasState.height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    ctx.putImageData(imageData, 0, 0);
    this.downloadDataUrl(canvas.toDataURL('image/png'), `${this.activeTile?.id || 'pixel-art'}.png`);
  }

  exportSpriteSheet(layout = 'horizontal') {
    try {
      const { canvas, metadata } = exportSpriteSheet(
        this.animation.frames,
        this.canvasState.width,
        this.canvasState.height,
        { layout, columns: 4 }
      );
      this.downloadDataUrl(canvas.toDataURL('image/png'), `${this.activeTile?.id || 'pixel-art'}-sheet.png`);
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      this.downloadDataUrl(URL.createObjectURL(blob), `${this.activeTile?.id || 'pixel-art'}-sheet.json`);
    } catch (error) {
      console.warn('[PixelStudio] Failed to export sprite sheet.', error);
    }
  }

  exportGif() {
    console.warn('[PixelStudio] GIF export not implemented. Use sprite sheet export instead.');
  }

  exportPaletteJson() {
    const blob = new Blob([JSON.stringify({
      name: this.currentPalette.name,
      colors: this.currentPalette.colors.map((entry) => entry.hex)
    }, null, 2)], { type: 'application/json' });
    this.downloadDataUrl(URL.createObjectURL(blob), `${this.currentPalette.name}-palette.json`);
  }

  exportPaletteHex() {
    const blob = new Blob([paletteToHexList(this.currentPalette)], { type: 'text/plain' });
    this.downloadDataUrl(URL.createObjectURL(blob), `${this.currentPalette.name}-palette.txt`);
  }

  downloadDataUrl(url, filename) {
    this.exportLink.href = url;
    this.exportLink.download = filename;
    this.exportLink.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  isPointInBounds(point, bounds) {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.w
      && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
  }

  getGridCellFromScreen(x, y) {
    if (!this.canvasBounds) return null;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    const col = Math.floor((x - startX) / cellSize);
    const row = Math.floor((y - startY) / cellSize);
    if (col < 0 || row < 0 || col >= this.canvasState.width || row >= this.canvasState.height) return null;
    return { row, col };
  }

  handleButtonClick(x, y) {
    const hit = this.uiButtons.find((button) => x >= button.bounds.x
      && x <= button.bounds.x + button.bounds.w
      && y >= button.bounds.y
      && y <= button.bounds.y + button.bounds.h);
    if (hit) {
      hit.onClick?.();
      return true;
    }
    const paletteHit = this.paletteBounds.find((bounds) => this.isPointInBounds({ x, y }, bounds));
    if (paletteHit) {
      this.setPaletteIndex(paletteHit.index);
      return true;
    }
    const layerHit = this.layerBounds.find((bounds) => this.isPointInBounds({ x, y }, bounds));
    if (layerHit) {
      this.canvasState.activeLayerIndex = layerHit.index;
      return true;
    }
    const frameHit = this.frameBounds.find((bounds) => this.isPointInBounds({ x, y }, bounds));
    if (frameHit) {
      this.animation.currentFrameIndex = frameHit.index;
      this.setFrameLayers(this.currentFrame.layers);
      return true;
    }
    return false;
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const leftWidth = 260;
    const rightWidth = 240;
    const bottomHeight = 170;
    const topBarHeight = 50;

    ctx.fillStyle = '#fff';
    ctx.font = '20px Courier New';
    ctx.fillText('Pixel Studio', 24, 32);

    const tabs = ['Draw', 'Select', 'Animate', 'Export'];
    const tabX = 220;
    this.uiButtons = [];
    tabs.forEach((tab, index) => {
      const bounds = { x: tabX + index * 90, y: 16, w: 84, h: 26 };
      const active = this.modeTab.toLowerCase() === tab.toLowerCase();
      this.drawButton(ctx, bounds, tab, active);
      this.uiButtons.push({ bounds, onClick: () => { this.modeTab = tab.toLowerCase(); } });
    });

    const zoom = this.view.zoomLevels[this.view.zoomIndex];
    const statusText = `Tool: ${this.activeToolId} | Brush ${this.toolOptions.brushSize}px | Color ${getPaletteSwatchHex(this.currentPalette, this.paletteIndex)} | Layer ${this.canvasState.activeLayerIndex + 1}/${this.canvasState.layers.length} | Frame ${this.animation.currentFrameIndex + 1}/${this.animation.frames.length} | Zoom ${zoom}x | Cursor ${this.cursor.col},${this.cursor.row}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    ctx.fillText(statusText, 24, height - bottomHeight - 8);

    const toolsX = 20;
    const toolsY = topBarHeight + 10;
    const toolsH = height - bottomHeight - topBarHeight - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(toolsX, toolsY, leftWidth, toolsH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(toolsX, toolsY, leftWidth, toolsH);

    this.drawToolsPanel(ctx, toolsX, toolsY, leftWidth, toolsH);

    const layersX = width - rightWidth - 20;
    const layersY = topBarHeight + 10;
    const layersH = height - bottomHeight - topBarHeight - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(layersX, layersY, rightWidth, layersH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(layersX, layersY, rightWidth, layersH);

    this.drawLayersPanel(ctx, layersX, layersY, rightWidth, layersH);

    const canvasX = leftWidth + 40;
    const canvasY = topBarHeight + 20;
    const canvasW = width - leftWidth - rightWidth - 80;
    const canvasH = height - bottomHeight - topBarHeight - 40;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);

    this.drawCanvasArea(ctx, canvasX, canvasY, canvasW, canvasH);

    this.drawPaletteBar(ctx, 20, height - bottomHeight + 20, width - 40, bottomHeight - 40);
    this.drawTimeline(ctx, canvasX, height - bottomHeight + 20, canvasW, bottomHeight - 40);

    if (this.gamepadHintVisible) {
      this.drawGamepadHints(ctx, width - rightWidth - 40, height - bottomHeight - 90);
    }

    if (this.uiFocusMode && this.uiButtons[this.uiFocusIndex]) {
      const bounds = this.uiButtons[this.uiFocusIndex].bounds;
      ctx.strokeStyle = '#9ddcff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);
    }

    ctx.restore();
  }

  drawButton(ctx, bounds, label, active = false) {
    ctx.fillStyle = active ? 'rgba(255,225,106,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#0b0b0b' : '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 4);
    ctx.textAlign = 'left';
  }

  drawToolsPanel(ctx, x, y, w, h) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Tools', x + 12, y + 20);

    const list = this.tools.map((tool) => tool);
    const lineHeight = 20;
    let offsetY = y + 36;
    list.forEach((tool) => {
      const isActive = tool.id === this.activeToolId;
      ctx.fillStyle = isActive ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(tool.name, x + 16, offsetY);
      const bounds = { x: x + 8, y: offsetY - 14, w: w - 16, h: 18 };
      this.uiButtons.push({ bounds, onClick: () => { this.activeToolId = tool.id; } });
      offsetY += lineHeight;
    });

    offsetY += 8;
    ctx.fillStyle = '#fff';
    ctx.fillText('Options', x + 12, offsetY);
    offsetY += 18;

    this.drawOptionToggle(ctx, x + 12, offsetY, 'Symmetry H', this.toolOptions.symmetry.horizontal, () => {
      this.toolOptions.symmetry.horizontal = !this.toolOptions.symmetry.horizontal;
    });
    offsetY += 20;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Symmetry V', this.toolOptions.symmetry.vertical, () => {
      this.toolOptions.symmetry.vertical = !this.toolOptions.symmetry.vertical;
    });
    offsetY += 20;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Wrap Draw', this.toolOptions.wrapDraw, () => {
      this.toolOptions.wrapDraw = !this.toolOptions.wrapDraw;
    });
    offsetY += 20;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Tiled Preview', this.tiledPreview.enabled, () => {
      this.tiledPreview.enabled = !this.tiledPreview.enabled;
    });
    offsetY += 24;
    const tileSizeBounds = { x: x + 12, y: offsetY - 12, w: 120, h: 18 };
    this.drawButton(ctx, tileSizeBounds, `Tiles: ${this.tiledPreview.tiles}x${this.tiledPreview.tiles}`);
    this.uiButtons.push({
      bounds: tileSizeBounds,
      onClick: () => { this.tiledPreview.tiles = this.tiledPreview.tiles === 2 ? 3 : 2; }
    });
    offsetY += 24;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Brush Size: ${this.toolOptions.brushSize}`, x + 12, offsetY);
    this.uiButtons.push({
      bounds: { x: x + 160, y: offsetY - 14, w: 30, h: 18 },
      onClick: () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize - 1, 1, 8); }
    });
    this.uiButtons.push({
      bounds: { x: x + 196, y: offsetY - 14, w: 30, h: 18 },
      onClick: () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize + 1, 1, 8); }
    });
    this.drawButton(ctx, { x: x + 160, y: offsetY - 14, w: 28, h: 16 }, '-');
    this.drawButton(ctx, { x: x + 196, y: offsetY - 14, w: 28, h: 16 }, '+');
    offsetY += 24;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Tile: ${this.activeTile?.label || 'None'}`, x + 12, offsetY);
    this.uiButtons.push({
      bounds: { x: x + 160, y: offsetY - 14, w: 30, h: 18 },
      onClick: () => this.cycleTile(-1)
    });
    this.uiButtons.push({
      bounds: { x: x + 196, y: offsetY - 14, w: 30, h: 18 },
      onClick: () => this.cycleTile(1)
    });
    this.drawButton(ctx, { x: x + 160, y: offsetY - 14, w: 28, h: 16 }, '<');
    this.drawButton(ctx, { x: x + 196, y: offsetY - 14, w: 28, h: 16 }, '>');
    offsetY += 24;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Offset Canvas', x + 12, offsetY);
    offsetY += 20;
    const offsetButtons = [
      { label: '←', action: () => this.offsetCanvas(-1, 0, true) },
      { label: '→', action: () => this.offsetCanvas(1, 0, true) },
      { label: '↑', action: () => this.offsetCanvas(0, -1, true) },
      { label: '↓', action: () => this.offsetCanvas(0, 1, true) },
      { label: '½W', action: () => this.offsetCanvas(Math.floor(this.canvasState.width / 2), 0, true) },
      { label: '½H', action: () => this.offsetCanvas(0, Math.floor(this.canvasState.height / 2), true) }
    ];
    offsetButtons.forEach((entry, index) => {
      const bounds = { x: x + 12 + (index % 3) * 44, y: offsetY + Math.floor(index / 3) * 20, w: 40, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
    offsetY += 44;

    offsetY = this.drawToolOptions(ctx, x + 12, offsetY);

    if (this.modeTab === 'select') {
      this.drawSelectionActions(ctx, x + 12, offsetY);
    }

    if (this.modeTab === 'animate') {
      this.drawAnimationControls(ctx, x + 12, offsetY);
    }

    if (this.modeTab === 'export') {
      this.drawExportControls(ctx, x + 12, offsetY);
    }
  }

  drawOptionToggle(ctx, x, y, label, active, onClick) {
    const bounds = { x, y: y - 12, w: 120, h: 18 };
    this.drawButton(ctx, bounds, label, active);
    this.uiButtons.push({ bounds, onClick });
  }

  drawToolOptions(ctx, x, y) {
    let offsetY = y;
    ctx.fillStyle = '#fff';
    ctx.fillText('Tool Options', x, offsetY);
    offsetY += 18;
    if (this.activeToolId === TOOL_IDS.LINE) {
      this.drawOptionToggle(ctx, x, offsetY, 'Perfect Pixels', this.toolOptions.linePerfect, () => {
        this.toolOptions.linePerfect = !this.toolOptions.linePerfect;
      });
      offsetY += 20;
    }
    if (this.activeToolId === TOOL_IDS.FILL) {
      this.drawOptionToggle(ctx, x, offsetY, 'Contiguous', this.toolOptions.fillContiguous, () => {
        this.toolOptions.fillContiguous = !this.toolOptions.fillContiguous;
      });
      offsetY += 20;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Tolerance: ${this.toolOptions.fillTolerance}`, x, offsetY);
      this.uiButtons.push({
        bounds: { x: x + 120, y: offsetY - 14, w: 30, h: 18 },
        onClick: () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance - 5, 0, 255); }
      });
      this.uiButtons.push({
        bounds: { x: x + 156, y: offsetY - 14, w: 30, h: 18 },
        onClick: () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance + 5, 0, 255); }
      });
      this.drawButton(ctx, { x: x + 120, y: offsetY - 14, w: 28, h: 16 }, '-');
      this.drawButton(ctx, { x: x + 156, y: offsetY - 14, w: 28, h: 16 }, '+');
      offsetY += 22;
    }
    if (this.activeToolId === TOOL_IDS.DITHER) {
      const patterns = ['bayer2', 'bayer4', 'checker'];
      const nextPattern = patterns[(patterns.indexOf(this.toolOptions.ditherPattern) + 1) % patterns.length];
      const bounds = { x, y: offsetY - 12, w: 120, h: 18 };
      this.drawButton(ctx, bounds, `Pattern: ${this.toolOptions.ditherPattern}`);
      this.uiButtons.push({ bounds, onClick: () => { this.toolOptions.ditherPattern = nextPattern; } });
      offsetY += 20;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Strength: ${this.toolOptions.ditherStrength}`, x, offsetY);
      this.uiButtons.push({
        bounds: { x: x + 120, y: offsetY - 14, w: 30, h: 18 },
        onClick: () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength - 1, 1, 4); }
      });
      this.uiButtons.push({
        bounds: { x: x + 156, y: offsetY - 14, w: 30, h: 18 },
        onClick: () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength + 1, 1, 4); }
      });
      this.drawButton(ctx, { x: x + 120, y: offsetY - 14, w: 28, h: 16 }, '-');
      this.drawButton(ctx, { x: x + 156, y: offsetY - 14, w: 28, h: 16 }, '+');
      offsetY += 22;
    }
    if (this.activeToolId === TOOL_IDS.COLOR_REPLACE) {
      const bounds = { x, y: offsetY - 12, w: 120, h: 18 };
      this.drawButton(ctx, bounds, `Scope: ${this.toolOptions.replaceScope}`);
      this.uiButtons.push({
        bounds,
        onClick: () => {
          this.toolOptions.replaceScope = this.toolOptions.replaceScope === 'layer' ? 'selection' : 'layer';
        }
      });
      offsetY += 20;
    }
    return offsetY;
  }

  drawSelectionActions(ctx, x, y) {
    const actions = [
      { label: 'Clear', action: () => this.clearSelection() },
      { label: 'Invert', action: () => this.invertSelection() },
      { label: 'Expand', action: () => this.expandSelection(1) },
      { label: 'Contract', action: () => this.expandSelection(-1) },
      { label: 'Flip H', action: () => this.transformSelection('flip-h') },
      { label: 'Flip V', action: () => this.transformSelection('flip-v') },
      { label: 'Rot CW', action: () => this.transformSelection('rotate-cw') },
      { label: 'Rot CCW', action: () => this.transformSelection('rotate-ccw') },
      { label: 'Scale 2x', action: () => this.scaleSelection(2) },
      { label: 'Scale 3x', action: () => this.scaleSelection(3) },
      { label: 'Scale 4x', action: () => this.scaleSelection(4) }
    ];
    actions.forEach((entry, index) => {
      const bounds = { x, y: y + index * 20, w: 120, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
  }

  drawAnimationControls(ctx, x, y) {
    const controls = [
      { label: this.animation.playing ? 'Pause' : 'Play', action: () => { this.animation.playing = !this.animation.playing; } },
      { label: 'Onion Skin', action: () => { this.animation.onion.enabled = !this.animation.onion.enabled; } },
      { label: 'Loop', action: () => { this.animation.loop = !this.animation.loop; } }
    ];
    controls.forEach((entry, index) => {
      const bounds = { x, y: y + index * 20, w: 120, h: 18 };
      const active = entry.label === 'Loop' ? this.animation.loop : entry.label === 'Onion Skin' ? this.animation.onion.enabled : false;
      this.drawButton(ctx, bounds, entry.label, active);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
    const onionOffset = y + controls.length * 20 + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Prev: ${this.animation.onion.prev}`, x, onionOffset);
    this.uiButtons.push({
      bounds: { x: x + 60, y: onionOffset - 14, w: 24, h: 16 },
      onClick: () => { this.animation.onion.prev = clamp(this.animation.onion.prev - 1, 0, 3); }
    });
    this.uiButtons.push({
      bounds: { x: x + 88, y: onionOffset - 14, w: 24, h: 16 },
      onClick: () => { this.animation.onion.prev = clamp(this.animation.onion.prev + 1, 0, 3); }
    });
    this.drawButton(ctx, { x: x + 60, y: onionOffset - 14, w: 22, h: 16 }, '-');
    this.drawButton(ctx, { x: x + 88, y: onionOffset - 14, w: 22, h: 16 }, '+');
    const nextOffset = onionOffset + 20;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Next: ${this.animation.onion.next}`, x, nextOffset);
    this.uiButtons.push({
      bounds: { x: x + 60, y: nextOffset - 14, w: 24, h: 16 },
      onClick: () => { this.animation.onion.next = clamp(this.animation.onion.next - 1, 0, 3); }
    });
    this.uiButtons.push({
      bounds: { x: x + 88, y: nextOffset - 14, w: 24, h: 16 },
      onClick: () => { this.animation.onion.next = clamp(this.animation.onion.next + 1, 0, 3); }
    });
    this.drawButton(ctx, { x: x + 60, y: nextOffset - 14, w: 22, h: 16 }, '-');
    this.drawButton(ctx, { x: x + 88, y: nextOffset - 14, w: 22, h: 16 }, '+');
  }

  drawExportControls(ctx, x, y) {
    const actions = [
      { label: 'Export PNG', action: () => this.exportPng() },
      { label: 'Sprite Sheet', action: () => this.exportSpriteSheet('horizontal') },
      { label: 'Export GIF', action: () => this.exportGif() },
      { label: 'Palette JSON', action: () => this.exportPaletteJson() },
      { label: 'Palette HEX', action: () => this.exportPaletteHex() },
      { label: 'Import Palette', action: () => this.paletteFileInput.click() }
    ];
    actions.forEach((entry, index) => {
      const bounds = { x, y: y + index * 20, w: 140, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
  }

  drawLayersPanel(ctx, x, y, w, h) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Layers', x + 12, y + 20);
    const controls = [
      { label: '+', action: () => this.addLayer() },
      { label: 'Dup', action: () => this.duplicateLayer(this.canvasState.activeLayerIndex) },
      { label: '-', action: () => this.deleteLayer(this.canvasState.activeLayerIndex) },
      { label: 'Merge', action: () => this.mergeLayerDown(this.canvasState.activeLayerIndex) },
      { label: 'Flatten', action: () => this.flattenAllLayers() }
    ];
    controls.forEach((entry, index) => {
      const bounds = { x: x + 12 + index * 44, y: y + 28, w: 40, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
    let offsetY = y + 60;
    this.layerBounds = [];
    this.canvasState.layers.slice().reverse().forEach((layer, reversedIndex) => {
      const index = this.canvasState.layers.length - 1 - reversedIndex;
      const active = index === this.canvasState.activeLayerIndex;
      ctx.fillStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(`${layer.visible ? '👁' : '⛔'} ${layer.name}`, x + 12, offsetY);
      const bounds = { x: x + 8, y: offsetY - 14, w: w - 16, h: 18, index };
      this.layerBounds.push(bounds);
      offsetY += 20;
    });
  }

  drawCanvasArea(ctx, x, y, w, h) {
    const { width, height } = this.canvasState;
    const zoom = this.view.zoomLevels[this.view.zoomIndex];
    const gridW = width * zoom;
    const gridH = height * zoom;
    const offsetX = x + (w - gridW) / 2 + this.view.panX;
    const offsetY = y + (h - gridH) / 2 + this.view.panY;
    this.canvasBounds = { x: offsetX, y: offsetY, w: gridW, h: gridH, cellSize: zoom };

    this.offscreen.width = width;
    this.offscreen.height = height;
    const composite = compositeLayers(this.canvasState.layers, width, height);
    const imageData = this.offscreenCtx.createImageData(width, height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    this.offscreenCtx.putImageData(imageData, 0, 0);

    if (this.tiledPreview.enabled) {
      const tileCount = this.tiledPreview.tiles;
      for (let row = -1; row <= tileCount; row += 1) {
        for (let col = -1; col <= tileCount; col += 1) {
          ctx.globalAlpha = 0.2;
          ctx.drawImage(this.offscreen, offsetX + col * gridW, offsetY + row * gridH, gridW, gridH);
        }
      }
      ctx.globalAlpha = 1;
    }

    if (this.animation.onion.enabled) {
      this.drawOnionSkin(ctx, offsetX, offsetY, gridW, gridH);
    }

    ctx.drawImage(this.offscreen, offsetX, offsetY, gridW, gridH);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let row = 0; row <= height; row += 1) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + row * zoom);
      ctx.lineTo(offsetX + gridW, offsetY + row * zoom);
      ctx.stroke();
    }
    for (let col = 0; col <= width; col += 1) {
      ctx.beginPath();
      ctx.moveTo(offsetX + col * zoom, offsetY);
      ctx.lineTo(offsetX + col * zoom, offsetY + gridH);
      ctx.stroke();
    }

    if (this.selection.active && this.selection.bounds) {
      ctx.strokeStyle = '#ffcc6a';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        offsetX + this.selection.bounds.x * zoom,
        offsetY + this.selection.bounds.y * zoom,
        this.selection.bounds.w * zoom,
        this.selection.bounds.h * zoom
      );
    }

    if (this.linePreview) {
      const bounds = this.getBoundsFromPoints(this.linePreview.start, this.linePreview.end);
      ctx.strokeStyle = '#9ddcff';
      ctx.strokeRect(
        offsetX + bounds.x * zoom,
        offsetY + bounds.y * zoom,
        bounds.w * zoom,
        bounds.h * zoom
      );
    }

    if (this.toolOptions.symmetry.horizontal) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      const xMid = offsetX + gridW / 2;
      ctx.beginPath();
      ctx.moveTo(xMid, offsetY);
      ctx.lineTo(xMid, offsetY + gridH);
      ctx.stroke();
    }
    if (this.toolOptions.symmetry.vertical) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      const yMid = offsetY + gridH / 2;
      ctx.beginPath();
      ctx.moveTo(offsetX, yMid);
      ctx.lineTo(offsetX + gridW, yMid);
      ctx.stroke();
    }

    if (this.gamepadCursor.active) {
      ctx.strokeStyle = '#9ddcff';
      ctx.strokeRect(this.gamepadCursor.x - 4, this.gamepadCursor.y - 4, 8, 8);
    }

    const previewSize = 72;
    const previewX = x + w - previewSize - 12;
    const previewY = y + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(previewX, previewY, previewSize, previewSize);
    ctx.strokeStyle = '#ffe16a';
    ctx.strokeRect(previewX, previewY, previewSize, previewSize);
    ctx.drawImage(this.offscreen, previewX, previewY, previewSize, previewSize);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Courier New';
    ctx.fillText('Preview', previewX, previewY + previewSize + 12);
  }

  drawOnionSkin(ctx, offsetX, offsetY, gridW, gridH) {
    const { prev, next, opacity } = this.animation.onion;
    const total = this.animation.frames.length;
    for (let i = 1; i <= prev; i += 1) {
      const index = this.animation.currentFrameIndex - i;
      if (index < 0) continue;
      const composite = compositeLayers(this.animation.frames[index].layers, this.canvasState.width, this.canvasState.height);
      this.drawGhost(ctx, composite, offsetX, offsetY, gridW, gridH, opacity * (1 - i * 0.2));
    }
    for (let i = 1; i <= next; i += 1) {
      const index = this.animation.currentFrameIndex + i;
      if (index >= total) continue;
      const composite = compositeLayers(this.animation.frames[index].layers, this.canvasState.width, this.canvasState.height);
      this.drawGhost(ctx, composite, offsetX, offsetY, gridW, gridH, opacity * (1 - i * 0.2));
    }
  }

  drawGhost(ctx, composite, offsetX, offsetY, gridW, gridH, alpha) {
    const imageData = this.offscreenCtx.createImageData(this.canvasState.width, this.canvasState.height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    this.offscreenCtx.putImageData(imageData, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.offscreen, offsetX, offsetY, gridW, gridH);
    ctx.restore();
  }

  drawPaletteBar(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(`Palette: ${this.currentPalette.name}`, x + 10, y + 18);

    const paletteControls = [
      { label: '+', action: () => this.addPaletteColor() },
      { label: '-', action: () => this.removePaletteColor() },
      { label: '<', action: () => this.movePaletteColor(-1) },
      { label: '>', action: () => this.movePaletteColor(1) },
      { label: 'Ramp', action: () => this.generateRamp(4) },
      { label: 'Save', action: () => this.saveCurrentPalette() },
      { label: this.limitToPalette ? 'Limit ✓' : 'Limit', action: () => { this.limitToPalette = !this.limitToPalette; } }
    ];
    paletteControls.forEach((entry, index) => {
      const bounds = { x: x + 200 + index * 44, y: y + 4, w: 40, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });

    const swatchSize = 26;
    const gap = 8;
    const total = this.currentPalette.colors.length;
    let startX = x + 10;
    const maxPerRow = Math.floor((w - 20) / (swatchSize + gap));
    this.paletteBounds = [];
    for (let i = 0; i < total; i += 1) {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const swatchX = startX + col * (swatchSize + gap);
      const swatchY = y + 30 + row * (swatchSize + gap);
      ctx.fillStyle = this.currentPalette.colors[i].hex;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      ctx.strokeStyle = i === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
      this.paletteBounds.push({ x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index: i });
    }

    const presetX = x + w - 180;
    const presetY = y + 8;
    const allPalettes = [...this.palettePresets, ...this.customPalettes];
    allPalettes.forEach((preset, index) => {
      const bounds = { x: presetX, y: presetY + index * 20, w: 160, h: 18 };
      this.drawButton(ctx, bounds, preset.name, preset.name === this.currentPalette.name);
      this.uiButtons.push({ bounds, onClick: () => { this.currentPalette = preset; this.paletteIndex = 0; } });
    });
  }

  drawTimeline(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Timeline', x + 10, y + 18);

    const thumbSize = 36;
    const gap = 10;
    const startX = x + 10;
    const startY = y + 30;
    this.frameBounds = [];
    this.animation.frames.forEach((frame, index) => {
      const thumbX = startX + index * (thumbSize + gap);
      const thumbY = startY;
      ctx.fillStyle = index === this.animation.currentFrameIndex ? '#ffe16a' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
      const composite = compositeLayers(frame.layers, this.canvasState.width, this.canvasState.height);
      const imageData = this.offscreenCtx.createImageData(this.canvasState.width, this.canvasState.height);
      const bytes = new Uint32Array(imageData.data.buffer);
      bytes.set(composite);
      this.offscreenCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(this.offscreen, thumbX, thumbY, thumbSize, thumbSize);
      this.frameBounds.push({ x: thumbX, y: thumbY, w: thumbSize, h: thumbSize, index });
    });

    const controls = [
      { label: '+', action: () => this.addFrame() },
      { label: 'Dup', action: () => this.duplicateFrame(this.animation.currentFrameIndex) },
      { label: '-', action: () => this.deleteFrame(this.animation.currentFrameIndex) },
      { label: this.animation.playing ? 'Pause' : 'Play', action: () => { this.animation.playing = !this.animation.playing; } }
    ];
    controls.forEach((entry, index) => {
      const bounds = { x: x + 10 + index * 52, y: y + h - 28, w: 46, h: 18 };
      this.drawButton(ctx, bounds, entry.label);
      this.uiButtons.push({ bounds, onClick: entry.action });
    });
  }

  drawGamepadHints(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, 200, 140);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, 200, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Courier New';
    GAMEPAD_HINTS.forEach((hint, index) => {
      ctx.fillText(hint, x + 10, y + 16 + index * 12);
    });
  }
}
