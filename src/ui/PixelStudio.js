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
import { GAMEPAD_HINTS } from './pixel-editor/gamepad.js';
import InputManager, { INPUT_ACTIONS } from './pixel-editor/inputManager.js';
import { UI_SUITE, SHARED_EDITOR_LEFT_MENU, buildSharedDesktopLeftPanelFrame, buildSharedEditorFileMenu, buildSharedLeftMenuLayout, buildSharedLeftMenuButtons, buildUnifiedFileDrawerItems, drawSharedFocusRing, drawSharedMenuButtonChrome, drawSharedMenuButtonLabel, getSharedEditorDrawerWidth, getSharedMobileDrawerWidth, getSharedMobileRailWidth, renderSharedFileDrawer, SharedEditorMenu } from './uiSuite.js';
import { TILE_LIBRARY } from './pixel-editor/tools/tileLibrary.js';
import { PIXEL_SIZE_PRESETS, createDitherMask } from './pixel-editor/input/dither.js';
import { clamp, lerp, bresenhamLine, generateEllipseMask, createPolygonMask, createRectMask, applySymmetryPoints } from './pixel-editor/render/geometry.js';
import { createViewportController } from './shared/viewportController.js';
import { createEditorRuntime } from './shared/editor-runtime/EditorRuntime.js';
import { ensurePixelArtStore, ensurePixelTileData } from '../editor/adapters/editorDataContracts.js';


export default class PixelStudio {
  constructor(game) {
    this.game = game;
    this.sharedMenu = new SharedEditorMenu();
    this.tileLibrary = TILE_LIBRARY;
    this.decalEditSession = null;
    this.activeTile = this.tileLibrary[0] || null;
    this.tileIndex = 0;
    this.currentDocumentRef = null;
    this.savedSnapshot = null;
    this.runtime = createEditorRuntime({
      context: this,
      document: {
        folder: 'art',
        strings: {
          saveAsTitle: 'Save Art As',
          openTitle: 'Open Art',
          discardChanges: 'Discard unsaved art changes?',
          closePrompt: 'Save changes before closing?'
        },
        confirm: (ctx, message) => ctx.game?.showInlineConfirm?.(message),
        serialize: (ctx) => {
          ctx.syncTileData();
          return ctx.game.world.pixelArt || { tiles: {} };
        },
        applyLoadedData: (ctx, data) => {
          ctx.game.world.pixelArt = data;
          ctx.loadTileData();
        }
      },
      history: {
        limit: 75,
        onUndo: (entry) => this.applyHistoryEntry(entry, 'undo'),
        onRedo: (entry) => this.applyHistoryEntry(entry, 'redo')
      }
    });
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
      floatingMode: null,
      floatingBounds: null,
      offset: { x: 0, y: 0 }
    };
    this.clipboard = null;
    this.view = {
      zoomLevels: [6, 8, 10, 12, 16, 20, 24, 28, 32],
      zoomIndex: 4,
      panX: 0,
      panY: 0
    };
    this.viewportController = createViewportController({
      minZoom: 0,
      maxZoom: 8,
      zoomStep: 1
    });
    this.tiledPreview = { enabled: false, tiles: 2 };
    this.animation = {
      frames: [createFrame(this.canvasState.layers, 120)],
      currentFrameIndex: 0,
      playing: false,
      loop: true,
      onion: { enabled: false, prev: 1, next: 1, opacity: 0.35 }
    };
    this.history = this.runtime.history;
    this.pendingHistory = null;
    this.strokeState = null;
    this.linePreview = null;
    this.cloneSource = null;
    this.cloneOffset = null;
    this.cloneSourcePixels = null;
    this.panStart = null;
    this.longPressTimer = null;
    this.cursor = { row: 0, col: 0, x: 0, y: 0 };
    this.gamepadCursor = { x: 0, y: 0, active: false, initialized: false };
    this.gamepadDrawing = false;
    this.gamepadHintVisible = false;
    this.gamepadSelection = { active: false, mode: null };
    this.selectionContextMenu = null;
    this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
    this.quickPalettePage = 0;
    this.quickPaletteStartIndex = 0;
    this.quickToolPage = 0;
    this.quickToolStartIndex = 0;
    this.leftStickMoveTimer = 0;
    this.triggerSelectionReady = false;
    this.inputManager = new InputManager();
    this.inputMode = 'canvas';
    this.inputManager.setMode(this.inputMode);
    this.uiFocus = { group: 'tools', index: 0 };
    this.focusGroups = {};
    this.focusOrder = [];
    this.focusGroupMeta = {};
    this.focusScroll = {
      tools: 0,
      objects: 0,
      palette: 0,
      palettePresets: 0,
      layers: 0,
      timeline: 0,
      toolbar: 0,
      menu: 0,
      file: 0
    };
    this.tempToolOverrides = new Map();
    this.menuOpen = false;
    this.controlsOverlayOpen = false;
    this.mobileDrawer = null;
    this.mobileDrawerBounds = null;
    this.paletteGridOpen = false;
    this.sidebars = { left: true };
    this.leftPanelTabs = ['file', 'tools', 'canvas'];
    this.leftPanelTabIndex = 1;
    this.leftPanelTab = this.leftPanelTabs[this.leftPanelTabIndex];
    this.uiButtons = [];
    this.menuScrollDrag = null;
    this.artSizeDraft = { width: 16, height: 16 };
    this.paletteBounds = [];
    this.layerBounds = [];
    this.frameBounds = [];
    this.statusMessage = '';
    this.lastTime = 0;
    this.spaceDown = false;
    this.altDown = false;
    this.lastActiveToolId = this.activeToolId;
    this.offscreen = document.createElement('canvas');
    this.offscreenCtx = this.offscreen.getContext('2d');
    this.offscreenCtx.imageSmoothingEnabled = false;
    this.floatingCanvas = document.createElement('canvas');
    this.floatingCtx = this.floatingCanvas.getContext('2d');
    this.floatingCtx.imageSmoothingEnabled = false;
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
    this.runtime.markSavedSnapshot();
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
    ensurePixelArtStore(this.game.world);
    const tileChar = this.activeTile?.char;
    if (!tileChar) return;
    const pixelData = ensurePixelTileData(this.game.world, tileChar, { size: 16, fps: 6 });
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
    this.artSizeDraft.width = this.canvasState.width;
    this.artSizeDraft.height = this.canvasState.height;
    this.setFrameLayers(this.animation.frames[0].layers);
  }

  syncTileData() {
    if (this.decalEditSession) return;
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

  async promptForNewArtName() {
    const fallback = this.currentDocumentRef?.name || 'new-art';
    const value = window.prompt('New art file name?', fallback);
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  exitToMainMenu() {
    this.commitDecalEditIfNeeded();
    this.game.exitEditorToMainMenu('pixel');
  }

  async loadDecalImageForEditing(decalId, imageDataUrl) {
    if (!imageDataUrl) return;
    const image = await new Promise((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = reject;
      next.src = imageDataUrl;
    });
    const width = clamp(Math.round(image.width || 16), 8, 512);
    const height = clamp(Math.round(image.height || 16), 8, 512);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const drawCtx = canvas.getContext('2d');
    drawCtx.drawImage(image, 0, 0, width, height);
    const pixels = drawCtx.getImageData(0, 0, width, height).data;
    const layer = createLayer(width, height, 'Decal Layer');
    for (let i = 0; i < width * height; i += 1) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const a = pixels[i * 4 + 3];
      layer.pixels[i] = rgbaToUint32({ r, g, b, a });
    }
    this.decalEditSession = { decalId };
    this.canvasState.width = width;
    this.canvasState.height = height;
    this.animation.frames = [createFrame([layer], 120)];
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.resetFocus();
  }

  exportCurrentFrameDataUrl() {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const composite = compositeLayers(this.currentFrame.layers, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < composite.length; i += 1) {
      const rgba = uint32ToRgba(composite[i]);
      const offset = i * 4;
      imageData.data[offset] = rgba.r;
      imageData.data[offset + 1] = rgba.g;
      imageData.data[offset + 2] = rgba.b;
      imageData.data[offset + 3] = rgba.a;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  commitDecalEditIfNeeded() {
    if (!this.decalEditSession?.decalId) return;
    const decal = (this.game.world.decals || []).find((entry) => entry.id === this.decalEditSession.decalId);
    if (decal) {
      decal.imageDataUrl = this.exportCurrentFrameDataUrl();
      this.game.editor?.persistAutosave?.();
    }
    this.decalEditSession = null;
  }


  async saveArtDocument(options = {}) {
    return this.runtime.saveAsOrCurrent(options);
  }

  loadArtDocument() {
    this.runtime.open();
  }

  async newArtDocument() {
    if (!this.runtime.confirmDiscardChanges()) return;
    const name = await this.promptForNewArtName();
    if (!name) return;
    const dims = this.promptForArtDimensions(this.artSizeDraft);
    if (!dims) return;
    ensurePixelArtStore(this.game.world);
    this.game.world.pixelArt.tiles = {};
    this.currentDocumentRef = { folder: 'art', name };
    this.loadTileData();
    this.artSizeDraft.width = dims.width;
    this.artSizeDraft.height = dims.height;
    this.resizeArtCanvas(dims.width, dims.height);
    this.runtime.markSavedSnapshot();
  }

  resizeArtCanvas(width, height) {
    const nextW = clamp(Math.round(width), 8, 512);
    const nextH = clamp(Math.round(height), 8, 512);
    if (nextW === this.canvasState.width && nextH === this.canvasState.height) return;
    const resizeLayer = (layer) => {
      const next = createLayer(nextW, nextH, layer.name);
      const copyW = Math.min(this.canvasState.width, nextW);
      const copyH = Math.min(this.canvasState.height, nextH);
      for (let row = 0; row < copyH; row += 1) {
        const srcOffset = row * this.canvasState.width;
        const dstOffset = row * nextW;
        for (let col = 0; col < copyW; col += 1) {
          next.pixels[dstOffset + col] = layer.pixels[srcOffset + col];
        }
      }
      return next;
    };
    this.animation.frames = this.animation.frames.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => resizeLayer(layer))
    }));
    this.canvasState.width = nextW;
    this.canvasState.height = nextH;
    this.artSizeDraft.width = nextW;
    this.artSizeDraft.height = nextH;
    this.animation.currentFrameIndex = clamp(this.animation.currentFrameIndex, 0, this.animation.frames.length - 1);
    this.setFrameLayers(this.animation.frames[this.animation.currentFrameIndex].layers);
    this.canvasState.activeLayerIndex = clamp(this.canvasState.activeLayerIndex, 0, this.canvasState.layers.length - 1);
    this.syncTileData();
  }

  setArtSizeDraftFromPrompt(kind) {
    const current = kind === 'width' ? this.artSizeDraft.width : this.artSizeDraft.height;
    const raw = window.prompt(`${kind === 'width' ? 'Pixel width' : 'Pixel height'} (8-512):`, String(current));
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, 8, 512);
    if (kind === 'width') this.artSizeDraft.width = next;
    else this.artSizeDraft.height = next;
  }

  promptForArtDimensions(initial = null) {
    const current = initial || this.artSizeDraft || { width: this.canvasState.width, height: this.canvasState.height };
    const raw = window.prompt('Art size (e.g. 32x32, 64x32, 128x256):', `${current.width}x${current.height}`);
    if (raw == null) return null;
    const match = String(raw).toLowerCase().match(/(\d+)\s*[x,]\s*(\d+)/);
    if (!match) return null;
    return {
      width: clamp(parseInt(match[1], 10), 8, 512),
      height: clamp(parseInt(match[2], 10), 8, 512)
    };
  }

  resizeArtDocumentPrompt() {
    const dims = this.promptForArtDimensions({ width: this.canvasState.width, height: this.canvasState.height });
    if (!dims) return;
    this.artSizeDraft.width = dims.width;
    this.artSizeDraft.height = dims.height;
    this.resizeArtCanvas(dims.width, dims.height);
  }


  setActiveTile(tile) {
    this.activeTile = tile;
    const index = this.tileLibrary.findIndex((entry) => entry.id === tile?.id);
    if (index >= 0) this.tileIndex = index;
    this.loadTileData();
  }

  resetTransientInteractionState() {
    this.stopGamepadDraw();
    this.cancelLongPress();
    this.panStart = null;
    this.menuScrollDrag = null;
    this.gesture = null;
    this.viewportController.cancelInteractions();
    this.selectionContextMenu = null;
    this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
    this.controlsOverlayOpen = false;
    this.menuOpen = false;
    this.paletteGridOpen = false;
  }

  resetFocus() {
    this.setInputMode('canvas');
    this.clearSelection();
    this.selection.floating = null;
    this.selection.floatingMode = null;
    this.selection.floatingBounds = null;
    this.setActiveTool(TOOL_IDS.PENCIL);
    this.triggerSelectionReady = false;
  }

  handleKeyDown(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    const mappedActions = this.inputManager.mapKeyboardEvent(event);
    if (mappedActions.length) {
      this.applyInputActions(mappedActions, {}, 0);
      event.preventDefault();
    }
    if (event.key === ' ') this.spaceDown = true;
    if (event.key === 'Alt') this.altDown = true;
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      this.runtime.undo();
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (event.shiftKey && key === 'z'))) {
      this.runtime.redo();
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
    if (key === 'b') this.setActiveTool(TOOL_IDS.PENCIL);
    if (key === 'e') this.setActiveTool(TOOL_IDS.ERASER);
    if (key === 'g') this.setActiveTool(TOOL_IDS.FILL);
    if (key === 'i') this.setActiveTool(TOOL_IDS.EYEDROPPER);
    if (key === 'v') this.setActiveTool(TOOL_IDS.MOVE);
    if (key === 's') this.setActiveTool(TOOL_IDS.SELECT_RECT);
    if (key === '[') this.toolOptions.brushSize = clamp(this.toolOptions.brushSize - 1, 1, 8);
    if (key === ']') this.toolOptions.brushSize = clamp(this.toolOptions.brushSize + 1, 1, 8);
    if (key === '+' || key === '=') this.zoomBy(1);
    if (key === '-') this.zoomBy(-1);
    if (key === '0') this.resetZoom();
    if (event.key.startsWith('Arrow')) {
      this.handleArrowKey(event.key);
      event.preventDefault();
    }
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
    this.handleInput(input, dt);
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

  setInputMode(mode) {
    this.inputMode = mode === 'ui' ? 'ui' : 'canvas';
    this.inputManager.setMode(this.inputMode);
  }

  toggleInputMode() {
    this.setInputMode(this.inputMode === 'ui' ? 'canvas' : 'ui');
  }

  toggleMenu() {
    if (this.controlsOverlayOpen) {
      this.controlsOverlayOpen = false;
      return;
    }
    this.openFileTab();
  }

  handleInput(input, dt) {
    const inputState = this.inputManager.updateGamepad(input, dt, {
      mode: this.inputMode,
      animationMode: this.modeTab === 'animate',
      timelineFocused: this.uiFocus.group === 'timeline'
    });
    if (inputState.connected && !this.gamepadHintVisible) {
      console.info('[PixelStudio] Gamepad detected.');
      this.gamepadHintVisible = true;
    }
    if (!inputState.connected) {
      this.gamepadCursor.active = false;
      this.triggerSelectionReady = false;
      return;
    }

    if (this.canvasBounds && !this.gamepadCursor.initialized) {
      this.gamepadCursor.x = this.canvasBounds.x + this.canvasBounds.w / 2;
      this.gamepadCursor.y = this.canvasBounds.y + this.canvasBounds.h / 2;
      this.gamepadCursor.initialized = true;
    }
    this.gamepadCursor.active = true;

    this.applyInputActions(inputState.actions, inputState, dt);
    this.handleTriggerSelection(inputState);
    this.updateQuickWheel(inputState, dt);
    if (this.inputMode === 'ui' && !this.quickWheel?.active) {
      this.handleAnalogFocus(inputState, dt);
    }

    if (this.gamepadDrawing && this.inputMode === 'canvas') {
      const point = this.getGridCellFromScreen(this.gamepadCursor.x, this.gamepadCursor.y);
      if (point) this.handleToolPointerMove(point);
    }
  }

  applyInputActions(actions = [], inputState = {}, dt = 0) {
    actions.forEach((action) => {
      switch (action.type) {
        case INPUT_ACTIONS.TOGGLE_UI_MODE:
          this.toggleInputMode();
          break;
        case INPUT_ACTIONS.UNDO:
          if (this.selectionContextMenu) {
            this.selectionContextMenu = null;
            break;
          }
          if (this.inputMode === 'canvas'
            && [TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.MOVE].includes(this.activeToolId)) {
            this.setActiveTool(TOOL_IDS.PENCIL);
            break;
          }
          this.runtime.undo();
          break;
        case INPUT_ACTIONS.REDO:
          this.runtime.redo();
          break;
        case INPUT_ACTIONS.MENU:
          if (this.modeTab === 'animate' && this.inputMode === 'ui' && this.uiFocus.group === 'timeline') {
            this.animation.playing = !this.animation.playing;
          } else {
            this.openFileTab();
          }
          break;
        case INPUT_ACTIONS.CANCEL:
          this.handleCancel();
          break;
        case INPUT_ACTIONS.CONFIRM:
          if (this.inputMode === 'ui') {
            this.activateFocusedItem();
          }
          break;
        case INPUT_ACTIONS.TOGGLE_MODE:
          if (action.tool === 'eyedropper') {
            if (this.activeToolId === TOOL_IDS.EYEDROPPER) {
              this.setActiveTool(this.lastActiveToolId || TOOL_IDS.PENCIL);
            } else {
              this.lastActiveToolId = this.activeToolId;
              this.setActiveTool(TOOL_IDS.EYEDROPPER);
            }
          } else {
            this.toggleDrawSelectMode();
          }
          break;
        case INPUT_ACTIONS.SET_TOOL:
          if (action.tool === 'eraser') {
            this.setActiveTool(TOOL_IDS.ERASER);
          }
          break;
        case INPUT_ACTIONS.ERASE_PRESS:
          if (this.inputMode === 'canvas') {
            this.setTempTool('erase', TOOL_IDS.ERASER);
            if (this.selection.floatingMode === 'paste') {
              this.commitFloatingPaste();
            } else {
              this.startGamepadDraw();
            }
          }
          break;
        case INPUT_ACTIONS.ERASE_RELEASE:
          if (this.inputMode === 'canvas') {
            this.stopGamepadDraw();
          }
          this.clearTempTool('erase');
          break;
        case INPUT_ACTIONS.PANEL_PREV:
          this.cycleLeftPanel(-1);
          break;
        case INPUT_ACTIONS.PANEL_NEXT:
          this.cycleLeftPanel(1);
          break;
        case INPUT_ACTIONS.QUICK_COLOR:
          this.openQuickWheel('color');
          break;
        case INPUT_ACTIONS.QUICK_TOOL:
          this.openQuickWheel('tool');
          break;
        case INPUT_ACTIONS.NAV_UP:
          if (this.inputMode === 'canvas') {
            this.handleCanvasNav('up');
          } else {
            this.handleNav('up');
          }
          break;
        case INPUT_ACTIONS.NAV_DOWN:
          if (this.inputMode === 'canvas') {
            this.handleCanvasNav('down');
          } else {
            this.handleNav('down');
          }
          break;
        case INPUT_ACTIONS.NAV_LEFT:
          if (this.inputMode === 'canvas') {
            this.handleCanvasNav('left');
          } else {
            this.handleNav('left');
          }
          break;
        case INPUT_ACTIONS.NAV_RIGHT:
          if (this.inputMode === 'canvas') {
            this.handleCanvasNav('right');
          } else {
            this.handleNav('right');
          }
          break;
        case INPUT_ACTIONS.DRAW_PRESS:
          if (this.inputMode === 'canvas' && this.selection.floatingMode === 'paste') {
            this.commitFloatingPaste();
          } else if (this.inputMode === 'canvas') {
            this.startGamepadDraw();
          }
          break;
        case INPUT_ACTIONS.DRAW_RELEASE:
          if (this.inputMode === 'canvas') {
            this.stopGamepadDraw();
          }
          break;
        case INPUT_ACTIONS.PAN_XY:
          if (!this.quickWheel?.active) {
            this.handlePanAction(action, dt, inputState);
          }
          break;
        default:
          break;
      }
    });

    this.handleCursorMove(inputState, dt);
  }

  handleCancel() {
    if (this.controlsOverlayOpen) {
      this.controlsOverlayOpen = false;
      return;
    }
    if (this.menuOpen) {
      this.menuOpen = false;
      return;
    }
    if (this.selectionContextMenu) {
      this.clearSelection();
      this.setInputMode('canvas');
      this.setActiveTool(TOOL_IDS.PENCIL);
      return;
    }
    if (this.selection.floatingMode === 'paste') {
      this.selection.floating = null;
      this.selection.floatingMode = null;
      this.selection.floatingBounds = null;
      this.setActiveTool(TOOL_IDS.PENCIL);
      return;
    }
    if (this.quickWheel?.active) {
      this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
      return;
    }
    if (this.paletteGridOpen) {
      this.paletteGridOpen = false;
      return;
    }
    if (this.mobileDrawer) {
      this.mobileDrawer = null;
      return;
    }
    if (this.selection.active) {
      this.clearSelection();
      return;
    }
    if (this.inputMode === 'ui') {
      this.setInputMode('canvas');
    }
  }

  handleNav(direction) {
    if (this.inputMode !== 'ui') {
      this.setInputMode('ui');
      this.uiFocus.group = 'menu';
      this.uiFocus.index = 0;
    }
    this.moveFocus(direction);
  }

  handleCanvasNav(direction) {
    const delta = { x: 0, y: 0 };
    if (direction === 'left') delta.x = -1;
    if (direction === 'right') delta.x = 1;
    if (direction === 'up') delta.y = -1;
    if (direction === 'down') delta.y = 1;
    if (!delta.x && !delta.y) return;
    if (this.selection.active && this.activeToolId === TOOL_IDS.MOVE) {
      this.nudgeSelection(delta.x, delta.y);
      return;
    }
    this.nudgeCursor(delta.x, delta.y);
  }

  handleCursorMove(inputState, dt) {
    if (!this.canvasBounds) return;
    const allowCursorInMenu = Boolean(this.selectionContextMenu);
    if (this.inputMode !== 'canvas' && !allowCursorInMenu) return;
    const axes = inputState.axes || { leftX: 0, leftY: 0 };
    if (this.quickWheel?.active) return;
    const threshold = 0.35;
    const magnitude = Math.hypot(axes.leftX, axes.leftY);
    if (magnitude > threshold) {
      this.leftStickMoveTimer -= dt;
      if (this.leftStickMoveTimer <= 0) {
        const useX = Math.abs(axes.leftX) >= Math.abs(axes.leftY);
        const dx = useX ? (axes.leftX > 0 ? 1 : -1) : 0;
        const dy = useX ? 0 : (axes.leftY > 0 ? 1 : -1);
        this.nudgeCursor(dx, dy);
        this.leftStickMoveTimer = 0.08;
      }
    } else {
      this.leftStickMoveTimer = 0;
    }
  }

  handleAnalogFocus(inputState, dt) {
    if (this.selectionContextMenu) return;
    const axes = inputState.axes || { leftY: 0 };
    if (Math.abs(axes.leftY) > 0.55) {
      this.analogFocusTimer = (this.analogFocusTimer || 0) - dt;
      if (this.analogFocusTimer <= 0) {
        this.moveFocus(axes.leftY < 0 ? 'up' : 'down');
        this.analogFocusTimer = 0.2;
      }
    } else {
      this.analogFocusTimer = 0;
    }
  }

  cycleLeftPanel(delta) {
    const total = this.leftPanelTabs.length;
    const nextIndex = (this.leftPanelTabIndex + delta + total) % total;
    this.setLeftPanelTab(this.leftPanelTabs[nextIndex]);
  }

  openQuickWheel(type) {
    const isSameWheel = this.quickWheel?.active && this.quickWheel.type === type;
    if (type === 'color') {
      const count = this.currentPalette.colors?.length || 0;
      if (!isSameWheel) {
        const pages = Math.max(1, Math.ceil(count / 8));
        this.quickPaletteStartIndex = count
          ? this.quickPaletteStartIndex % count
          : 0;
        if (this.quickPalettePage >= pages) {
          this.quickPalettePage = 0;
        }
      } else {
        this.advanceQuickWheelPage('color');
      }
    }
    if (type === 'tool') {
      const list = this.getQuickToolList();
      if (!isSameWheel) {
        const pages = Math.max(1, Math.ceil(list.length / 8));
        this.quickToolStartIndex = list.length
          ? this.quickToolStartIndex % list.length
          : 0;
        if (this.quickToolPage >= pages) {
          this.quickToolPage = 0;
        }
      } else {
        this.advanceQuickWheelPage('tool');
      }
    }
    const centerX = this.gamepadCursor.active ? this.gamepadCursor.x : this.cursor.x;
    const centerY = this.gamepadCursor.active ? this.gamepadCursor.y : this.cursor.y;
    this.quickWheel = {
      active: true,
      type,
      center: { x: centerX, y: centerY },
      selectionIndex: null
    };
  }

  advanceQuickWheelPage(type) {
    if (type === 'color') {
      const total = this.currentPalette.colors?.length || 0;
      const pages = Math.max(1, Math.ceil(total / 8));
      this.quickPalettePage = (this.quickPalettePage + 1) % pages;
    }
    if (type === 'tool') {
      const total = this.getQuickToolList().length;
      const pages = Math.max(1, Math.ceil(total / 8));
      this.quickToolPage = (this.quickToolPage + 1) % pages;
    }
  }

  openFileTab() {
    this.sidebars.left = true;
    this.setLeftPanelTab('tools');
    this.setInputMode('ui');
    this.uiFocus.group = 'menu';
    this.uiFocus.index = 0;
  }

  closeFileMenu() {
    if (this.isMobileLayout()) {
      this.mobileDrawer = null;
      return;
    }
    this.setLeftPanelTab('tools');
  }

  setLeftPanelTab(tab) {
    const index = this.leftPanelTabs.indexOf(tab);
    if (index < 0) return;
    this.leftPanelTabIndex = index;
    this.leftPanelTab = tab;
    if (tab === 'canvas') {
      this.setInputMode('canvas');
    } else {
      this.setInputMode('ui');
    }
    if (tab === 'animate') {
      this.modeTab = 'animate';
      return;
    }
    if (this.modeTab === 'animate') {
      if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.MOVE].includes(this.activeToolId)) {
        this.modeTab = 'select';
      } else {
        this.modeTab = 'draw';
      }
    }
  }

  updateQuickWheel(inputState) {
    if (!this.quickWheel?.active) return;
    const axes = inputState.axes || { leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
    const useRight = this.quickWheel.type === 'tool';
    const axisX = useRight ? axes.rightX : axes.leftX;
    const axisY = useRight ? axes.rightY : axes.leftY;
    const magnitude = Math.hypot(axisX, axisY);
    const selectThreshold = 0.35;
    const releaseThreshold = 0.2;
    if (magnitude > selectThreshold) {
      const angle = (Math.atan2(axisY, axisX) + Math.PI * 2) % (Math.PI * 2);
      const slice = Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8;
      this.quickWheel.selectionIndex = slice;
      return;
    }
    if (magnitude < releaseThreshold && this.quickWheel.selectionIndex !== null) {
      this.applyQuickWheelSelection(this.quickWheel.selectionIndex);
      this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
    }
  }

  applyQuickWheelSelection(index) {
    if (this.quickWheel.type === 'color') {
      const entries = this.getQuickPaletteEntries();
      const entry = entries[index];
      if (entry) this.setPaletteIndex(entry.index);
      return;
    }
    if (this.quickWheel.type === 'tool') {
      const tools = this.getQuickToolEntries();
      const entry = tools[index];
      if (entry) this.setActiveTool(entry.id);
    }
  }

  getQuickPaletteEntries() {
    const colors = this.currentPalette.colors || [];
    const count = Math.max(1, colors.length);
    const pageOffset = this.quickPalettePage * 8;
    const baseIndex = this.quickPaletteStartIndex % count;
    const entries = [];
    for (let i = 0; i < 8; i += 1) {
      const index = (baseIndex + pageOffset + i) % count;
      entries.push({ index, hex: colors[index]?.hex || '#000000' });
    }
    return entries;
  }

  getQuickToolList() {
    return [
      { id: TOOL_IDS.PENCIL, label: 'Pencil' },
      { id: TOOL_IDS.ERASER, label: 'Erase' },
      { id: TOOL_IDS.FILL, label: 'Fill' },
      { id: TOOL_IDS.LINE, label: 'Line' },
      { id: TOOL_IDS.EYEDROPPER, label: 'Pick' },
      { id: TOOL_IDS.SELECT_RECT, label: 'Rect' },
      { id: TOOL_IDS.SELECT_ELLIPSE, label: 'Ellipse' },
      { id: TOOL_IDS.SELECT_LASSO, label: 'Lasso' },
      { id: TOOL_IDS.MOVE, label: 'Move' },
      { id: TOOL_IDS.CLONE, label: 'Clone' },
      { id: TOOL_IDS.DITHER, label: 'Dither' },
      { id: TOOL_IDS.COLOR_REPLACE, label: 'Replace' }
    ];
  }

  getQuickToolEntries() {
    const list = this.getQuickToolList();
    if (!list.length) return [];
    const pageOffset = this.quickToolPage * 8;
    const baseIndex = this.quickToolStartIndex % list.length;
    const entries = [];
    for (let i = 0; i < 8; i += 1) {
      const index = (baseIndex + pageOffset + i) % list.length;
      entries.push(list[index]);
    }
    return entries;
  }

  handleTriggerSelection(inputState) {
    if (!this.triggerSelectionReady) {
      if (!inputState.ltHeld && !inputState.rtHeld) {
        this.triggerSelectionReady = true;
      }
      if (!inputState.ltPressed && !inputState.rtPressed) {
        return;
      }
      this.triggerSelectionReady = true;
    }
    if (this.quickWheel?.active) return;
    const point = this.getGridCellFromScreen(this.gamepadCursor.x, this.gamepadCursor.y);
    if (inputState.rtPressed && point) {
      this.startTriggerSelection('add', point);
    }
    if (inputState.ltPressed && point) {
      this.startTriggerSelection('subtract', point);
    }
    if (this.gamepadSelection.active && point) {
      this.updateSelection(point);
    }
    if (inputState.rtReleased && this.gamepadSelection.mode === 'add') {
      this.commitTriggerSelection('add');
    }
    if (inputState.ltReleased && this.gamepadSelection.mode === 'subtract') {
      this.commitTriggerSelection('subtract');
    }
  }

  startTriggerSelection(mode, point) {
    this.gamepadSelection = { active: true, mode };
    this.selectionContextMenu = null;
    this.setInputMode('canvas');
    this.selection.mode = 'rect';
    this.selection.start = point;
    this.selection.end = point;
    this.selection.active = false;
  }

  commitTriggerSelection(mode) {
    if (!this.selection.start || !this.selection.end) {
      this.gamepadSelection = { active: false, mode: null };
      return;
    }
    const bounds = this.getBoundsFromPoints(this.selection.start, this.selection.end);
    const mask = createRectMask(this.canvasState.width, this.canvasState.height, bounds);
    const size = this.canvasState.width * this.canvasState.height;
    const nextMask = this.selection.mask ? new Uint8Array(this.selection.mask) : new Uint8Array(size);
    if (mode === 'add') {
      mask.forEach((value, index) => {
        if (value) nextMask[index] = 1;
      });
    } else if (mode === 'subtract') {
      mask.forEach((value, index) => {
        if (value) nextMask[index] = 0;
      });
    }
    this.selection.mask = nextMask;
    if (this.selection.mask) {
      this.selection.bounds = this.getMaskBounds(this.selection.mask);
      this.selection.active = Boolean(this.selection.bounds);
      if (!this.selection.bounds) {
        this.clearSelection();
      }
    }
    this.selection.start = null;
    this.selection.end = null;
    this.gamepadSelection = { active: false, mode: null };
    if (this.selection.active) {
      this.openSelectionContextMenu();
    }
  }

  openSelectionContextMenu() {
    const anchorX = this.gamepadCursor.active ? this.gamepadCursor.x : this.cursor.x;
    const anchorY = this.gamepadCursor.active ? this.gamepadCursor.y : this.cursor.y;
    this.selectionContextMenu = { x: anchorX, y: anchorY };
    this.setInputMode('ui');
    this.uiFocus.group = 'menu';
    this.uiFocus.index = 0;
  }

  handlePanAction(action, dt, inputState) {
    const axes = inputState.axes || { rightX: 0, rightY: 0 };
    const panX = -axes.rightX;
    const panY = -axes.rightY;
    const panSpeed = 420;
    if (this.modeTab === 'animate' && this.inputMode === 'ui' && this.uiFocus.group === 'timeline') {
      const threshold = 0.4;
      this.timelineScrubTimer = (this.timelineScrubTimer || 0) - dt;
      if (Math.abs(panX) > threshold && this.timelineScrubTimer <= 0) {
        const direction = panX > 0 ? 1 : -1;
        this.animation.currentFrameIndex = clamp(
          this.animation.currentFrameIndex + direction,
          0,
          this.animation.frames.length - 1
        );
        this.setFrameLayers(this.currentFrame.layers);
        this.timelineScrubTimer = 0.15;
      }
      return;
    }
    this.view.panX += panX * panSpeed * dt;
    this.view.panY += panY * panSpeed * dt;
  }

  startGamepadDraw() {
    const point = this.getGridCellFromScreen(this.gamepadCursor.x, this.gamepadCursor.y);
    if (point) {
      this.handleToolPointerDown(point, { fromGamepad: true });
    }
    this.gamepadDrawing = true;
  }

  stopGamepadDraw() {
    if (this.gamepadDrawing) {
      this.handleToolPointerUp();
    }
    this.gamepadDrawing = false;
  }

  zoomBy(delta) {
    this.view.zoomIndex = this.viewportController.zoomWithStep(this.view.zoomIndex, delta, {
      minZoom: 0,
      maxZoom: this.view.zoomLevels.length - 1,
      zoomStep: 1
    });
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
    if (this.menuOpen || this.controlsOverlayOpen || this.paletteGridOpen || this.selectionContextMenu) {
      this.handleButtonClick(payload.x, payload.y);
      return;
    }
    if (payload.touchCount && this.leftPanelTab === 'file' && this.filePanelScroll
      && this.isPointInBounds(payload, this.filePanelScroll)) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.file || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.filePanelScroll.lineHeight || 20)
      };
      return;
    }
    if (this.handleButtonClick(payload.x, payload.y)) return;
    if (this.canvasBounds && this.isPointInBounds(payload, this.canvasBounds)) {
      this.setInputMode('canvas');
      if (this.spaceDown || button === 1 || button === 2) {
        this.panStart = this.viewportController.beginPan(payload, { x: this.view.panX, y: this.view.panY });
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
    if (this.menuScrollDrag) {
      const dy = payload.y - this.menuScrollDrag.startY;
      if (Math.abs(dy) > 8) this.menuScrollDrag.moved = true;
      if (this.menuScrollDrag.moved) {
        const total = (this.focusGroups.file || []).length;
        const maxVisible = this.focusGroupMeta.file?.maxVisible || 1;
        const maxScroll = Math.max(0, total - maxVisible);
        const next = this.menuScrollDrag.startScroll - Math.round(dy / this.menuScrollDrag.lineHeight);
        this.focusScroll.file = clamp(next, 0, maxScroll);
      }
      return;
    }
    if (this.panStart && payload.buttons) {
      const pan = this.viewportController.updatePan(payload);
      if (!pan) return;
      this.view.panX = pan.x;
      this.view.panY = pan.y;
      return;
    }
    const point = this.getGridCellFromScreen(payload.x, payload.y);
    if (point) {
      this.handleToolPointerMove(point);
    }
  }

  handlePointerUp() {
    if (this.menuScrollDrag) {
      const drag = this.menuScrollDrag;
      this.menuScrollDrag = null;
      if (!drag.moved && drag.hitAction) drag.hitAction();
      return;
    }
    if (this.panStart) {
      this.panStart = null;
      this.viewportController.endPan();
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
    this.viewportController.cancelInteractions();
    this.gesture = this.viewportController.beginPinch(payload, {
      startZoomIndex: this.view.zoomIndex,
      startPanX: this.view.panX,
      startPanY: this.view.panY
    });
  }

  handleGestureMove(payload) {
    if (!this.gesture?.startDistance) return;
    const pinch = this.viewportController.updatePinch(payload);
    if (!pinch) return;
    const scale = pinch.scale;
    const levels = this.view.zoomLevels;
    const target = levels[pinch.context.startZoomIndex] * scale;
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
    this.view.panX = pinch.context.startPanX + pinch.deltaX;
    this.view.panY = pinch.context.startPanY + pinch.deltaY;
  }

  handleGestureEnd() {
    this.gesture = null;
    this.viewportController.endPinch();
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
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerDown) {
      tool.onPointerDown(point, modifiers);
    }
  }

  handleToolPointerMove(point) {
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerMove) {
      tool.onPointerMove(point);
    }
  }

  handleToolPointerUp() {
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerUp) {
      tool.onPointerUp();
    }
  }

  setActiveTool(toolId) {
    this.activeToolId = toolId;
    this.lastActiveToolId = toolId;
    if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.MOVE].includes(toolId)) {
      this.modeTab = 'select';
    } else if (toolId !== TOOL_IDS.EYEDROPPER) {
      this.modeTab = this.modeTab === 'animate' ? 'animate' : 'draw';
    }
  }

  setTempTool(source, toolId) {
    this.tempToolOverrides.set(source, toolId);
  }

  clearTempTool(source) {
    this.tempToolOverrides.delete(source);
  }

  getEffectiveToolId() {
    if (this.tempToolOverrides.has('eyedropper')) return TOOL_IDS.EYEDROPPER;
    if (this.tempToolOverrides.has('erase')) return this.tempToolOverrides.get('erase');
    return this.activeToolId;
  }

  toggleDrawSelectMode() {
    if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.MOVE].includes(this.activeToolId)) {
      this.setActiveTool(TOOL_IDS.PENCIL);
      return;
    }
    this.setActiveTool(this.selection.active ? TOOL_IDS.MOVE : TOOL_IDS.SELECT_RECT);
  }

  resetZoom() {
    this.view.zoomIndex = 4;
    this.view.panX = 0;
    this.view.panY = 0;
  }

  handleArrowKey(key) {
    if (this.inputMode === 'ui') {
      if (key === 'ArrowLeft') this.moveFocus('left');
      if (key === 'ArrowRight') this.moveFocus('right');
      if (key === 'ArrowUp') this.moveFocus('up');
      if (key === 'ArrowDown') this.moveFocus('down');
      return;
    }
    if (this.selection.active && this.activeToolId === TOOL_IDS.MOVE) {
      if (key === 'ArrowLeft') this.nudgeSelection(-1, 0);
      if (key === 'ArrowRight') this.nudgeSelection(1, 0);
      if (key === 'ArrowUp') this.nudgeSelection(0, -1);
      if (key === 'ArrowDown') this.nudgeSelection(0, 1);
      return;
    }
    if (key === 'ArrowLeft') this.nudgeCursor(-1, 0);
    if (key === 'ArrowRight') this.nudgeCursor(1, 0);
    if (key === 'ArrowUp') this.nudgeCursor(0, -1);
    if (key === 'ArrowDown') this.nudgeCursor(0, 1);
  }

  nudgeCursor(dx, dy) {
    if (!this.canvasBounds) return;
    const nextCol = clamp(this.cursor.col + dx, 0, this.canvasState.width - 1);
    const nextRow = clamp(this.cursor.row + dy, 0, this.canvasState.height - 1);
    this.cursor.col = nextCol;
    this.cursor.row = nextRow;
    const screen = this.getScreenFromGridCell(nextRow, nextCol);
    if (screen) {
      this.gamepadCursor.x = screen.x;
      this.gamepadCursor.y = screen.y;
      this.gamepadCursor.active = true;
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
    this.runtime.commitHistory(this.pendingHistory);
    this.pendingHistory = null;
    this.syncTileData();
  }


  applyHistoryEntry(entry, direction) {
    if (!entry) return;
    this.animation.currentFrameIndex = entry.frameIndex;
    const frame = this.animation.frames[this.animation.currentFrameIndex];
    const layerSnapshots = direction === 'undo' ? entry.layersBefore : entry.layersAfter;
    frame.layers.forEach((layer, index) => {
      layer.pixels.set(layerSnapshots[index]);
    });
    this.setFrameLayers(frame.layers);
    this.syncTileData();
  }

  startStroke(point, { mode }) {
    if (!this.activeLayer || this.activeLayer.locked) return;
    this.startHistory(`${mode} stroke`);
    this.cloneSourcePixels = mode === 'clone'
      ? new Uint32Array(this.activeLayer.pixels)
      : null;
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
    this.cloneSourcePixels = null;
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
    if (this.selection.active && this.gamepadCursor.active) {
      this.openSelectionContextMenu();
    }
  }

  getSelectionPixels() {
    if (!this.selection.mask) return null;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = new Uint32Array(width * height);
    this.activeLayer.pixels.forEach((value, index) => {
      if (!this.selection.mask[index]) return;
      pixels[index] = value;
    });
    return pixels;
  }

  startFloatingPaste(mode) {
    if (!this.selection.active || !this.selection.mask) return;
    const bounds = this.selection.bounds || this.getMaskBounds(this.selection.mask);
    if (!bounds) return;
    this.copySelection();
    let floating = null;
    if (mode === 'cut') {
      this.startHistory('cut selection');
      floating = this.extractSelectionPixels();
      this.commitHistory();
    } else {
      floating = this.getSelectionPixels();
    }
    if (!floating) return;
    this.selection.floating = floating;
    this.selection.floatingMode = 'paste';
    this.selection.floatingBounds = { ...bounds };
    this.clearSelection();
    this.setActiveTool(TOOL_IDS.PENCIL);
    this.setInputMode('canvas');
  }

  getFloatingPasteOffset() {
    const bounds = this.selection.floatingBounds;
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: this.cursor.col - bounds.x,
      y: this.cursor.row - bounds.y
    };
  }

  commitFloatingPaste() {
    if (!this.selection.floating || this.selection.floatingMode !== 'paste') return;
    const offset = this.getFloatingPasteOffset();
    this.startHistory('paste selection');
    this.pasteSelectionPixels(this.selection.floating, offset.x, offset.y);
    this.commitHistory();
    this.selection.floating = null;
    this.selection.floatingMode = null;
    this.selection.floatingBounds = null;
    this.setActiveTool(TOOL_IDS.PENCIL);
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
    if (this.selection.active && this.gamepadCursor.active) {
      this.openSelectionContextMenu();
    }
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

  deleteSelection() {
    if (!this.selection.active || !this.selection.mask) return;
    this.startHistory('delete selection');
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
    this.selection.mode = null;
    this.selection.start = null;
    this.selection.end = null;
    this.selection.lassoPoints = [];
    this.selectionContextMenu = null;
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
    const sourcePixels = this.cloneSourcePixels || this.activeLayer.pixels;
    this.activeLayer.pixels[destIndex] = sourcePixels[sourceIndex];
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

  getScreenFromGridCell(row, col) {
    if (!this.canvasBounds) return null;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    return {
      x: startX + col * cellSize + cellSize / 2,
      y: startY + row * cellSize + cellSize / 2
    };
  }

  handleButtonClick(x, y) {
    let hit = null;
    for (let index = this.uiButtons.length - 1; index >= 0; index -= 1) {
      const button = this.uiButtons[index];
      if (x >= button.bounds.x
        && x <= button.bounds.x + button.bounds.w
        && y >= button.bounds.y
        && y <= button.bounds.y + button.bounds.h) {
        hit = button;
        break;
      }
    }
    if (hit) {
      hit.onClick?.();
      return true;
    }
    if (this.mobileDrawer && this.mobileDrawerBounds && !this.isPointInBounds({ x, y }, this.mobileDrawerBounds)) {
      this.mobileDrawer = null;
      return true;
    }
    if (this.selectionContextMenu?.bounds && !this.isPointInBounds({ x, y }, this.selectionContextMenu.bounds)) {
      this.selectionContextMenu = null;
      this.setInputMode('canvas');
      this.setActiveTool(TOOL_IDS.PENCIL);
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

  registerFocusable(group, bounds, onActivate) {
    if (!this.focusGroups[group]) {
      this.focusGroups[group] = [];
    }
    this.focusGroups[group].push({ bounds, onActivate });
  }

  finalizeFocusGroups() {
    let order = Object.keys(this.focusGroups).filter((group) => this.focusGroups[group]?.length);
    if (this.controlsOverlayOpen || this.menuOpen || this.selectionContextMenu) {
      order = order.filter((group) => group === 'menu');
    } else if (this.paletteGridOpen) {
      order = order.filter((group) => group === 'palette' || group === 'menu');
    }
    this.focusOrder = order;
    if (!this.focusOrder.length) return;
    if (!this.focusGroups[this.uiFocus.group]) {
      this.uiFocus.group = this.focusOrder[0];
      this.uiFocus.index = 0;
    }
    const items = this.focusGroups[this.uiFocus.group] || [];
    if (!items.length) {
      this.uiFocus.group = this.focusOrder[0];
      this.uiFocus.index = 0;
    } else {
      this.uiFocus.index = clamp(this.uiFocus.index, 0, items.length - 1);
    }
    this.ensureFocusVisible(this.uiFocus.group);
  }

  ensureFocusVisible(group) {
    const meta = this.focusGroupMeta[group];
    if (!meta) return;
    const total = (this.focusGroups[group] || []).length;
    const maxVisible = meta.maxVisible;
    if (!maxVisible || total <= maxVisible) return;
    let start = this.focusScroll[group] || 0;
    if (this.uiFocus.index < start) start = this.uiFocus.index;
    if (this.uiFocus.index >= start + maxVisible) start = this.uiFocus.index - maxVisible + 1;
    this.focusScroll[group] = clamp(start, 0, Math.max(0, total - maxVisible));
  }

  moveFocus(direction) {
    if (!this.focusOrder.length) return;
    const groupIndex = this.focusOrder.indexOf(this.uiFocus.group);
    if (direction === 'left' || direction === 'right') {
      const delta = direction === 'left' ? -1 : 1;
      const nextGroup = this.focusOrder[(groupIndex + delta + this.focusOrder.length) % this.focusOrder.length];
      this.uiFocus.group = nextGroup;
      this.uiFocus.index = clamp(this.uiFocus.index, 0, (this.focusGroups[nextGroup]?.length || 1) - 1);
      this.ensureFocusVisible(nextGroup);
      return;
    }
    const items = this.focusGroups[this.uiFocus.group] || [];
    if (!items.length) return;
    const delta = direction === 'up' ? -1 : 1;
    this.uiFocus.index = clamp(this.uiFocus.index + delta, 0, items.length - 1);
    this.ensureFocusVisible(this.uiFocus.group);
  }

  activateFocusedItem() {
    const items = this.focusGroups[this.uiFocus.group] || [];
    const item = items[this.uiFocus.index];
    item?.onActivate?.();
  }

  drawFocusHighlight(ctx) {
    if (this.inputMode !== 'ui') return;
    const isGamepadFocus = Boolean(this.game?.input?.isGamepadConnected?.());
    if (!isGamepadFocus) return;
    const items = this.focusGroups[this.uiFocus.group] || [];
    const item = items[this.uiFocus.index];
    if (!item) return;
    const bounds = item.bounds;
    drawSharedFocusRing(ctx, bounds);
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    const isMobile = this.isMobileLayout();
    const menuFullScreen = false;
    const padding = isMobile ? 12 : 16;
    const topBarHeight = 0;
    const statusHeight = 20;
    const paletteHeight = isMobile ? 64 : 0;
    const toolbarHeight = isMobile ? 72 : 0;
    const timelineHeight = !isMobile && this.modeTab === 'animate' ? 120 : 0;
    const bottomHeight = menuFullScreen
      ? padding * 2
      : statusHeight + paletteHeight + timelineHeight + toolbarHeight + padding;
    const leftFrame = !isMobile && this.sidebars.left && !menuFullScreen
      ? buildSharedDesktopLeftPanelFrame({ viewportWidth: width, viewportHeight: height })
      : null;
    const leftWidth = isMobile
      ? getSharedMobileRailWidth(width, height)
      : (leftFrame ? leftFrame.panelW : (this.sidebars.left ? SHARED_EDITOR_LEFT_MENU.width() : 0));
    const rightWidth = 0;

    this.uiButtons = [];
    this.paletteBounds = [];
    this.layerBounds = [];
    this.frameBounds = [];
    this.focusGroups = {};
    this.focusGroupMeta = {};
    this.mobileDrawerBounds = null;

    const canvasX = leftFrame ? leftFrame.contentX : (padding + leftWidth);
    const canvasY = topBarHeight + padding;
    const canvasW = leftFrame ? leftFrame.contentW : (width - leftWidth - rightWidth - padding * 2);
    const canvasH = height - canvasY - bottomHeight;

    if (isMobile) {
      this.drawMobileRail(ctx, 0, 0, leftWidth, height);
    } else if (this.sidebars.left) {
      this.drawLeftPanel(ctx, leftFrame.panelX, leftFrame.panelY, leftFrame.panelW, leftFrame.panelH, { isMobile: false });
    }

    if (!menuFullScreen) {
      ctx.fillStyle = UI_SUITE.colors.panelAlt;
      ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);

      this.drawCanvasArea(ctx, canvasX, canvasY, canvasW, canvasH);
    } else {
      this.canvasBounds = null;
    }

    const paletteY = height - bottomHeight + padding;
    if (!menuFullScreen && paletteHeight > 0) {
      this.drawPaletteBar(ctx, padding, paletteY, width - padding * 2, paletteHeight, { isMobile });
    }
    const statusY = paletteY + (paletteHeight > 0 ? paletteHeight + 6 : 0);
    if (!menuFullScreen) {
      this.drawStatusBar(ctx, padding, statusY, width - padding * 2, statusHeight);
    }

    if (!menuFullScreen && !isMobile && this.modeTab === 'animate') {
      const timelineY = statusY + statusHeight + 6;
      this.drawTimeline(ctx, canvasX, timelineY, canvasW, timelineHeight);
    }

    if (isMobile) {
      const toolbarY = height - toolbarHeight - padding;
      this.drawMobileToolbar(ctx, canvasX, toolbarY, width - canvasX - padding, toolbarHeight);
      if (this.mobileDrawer && this.mobileDrawer !== 'timeline') {
        const drawerW = getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 });
        const drawerX = width - drawerW;
        this.drawMobileDrawer(ctx, drawerX, 0, drawerW, height, this.mobileDrawer);
      }
      if (this.paletteGridOpen) {
        this.drawPaletteGridSheet(ctx, padding, canvasY + canvasH * 0.25, width - padding * 2, canvasH * 0.7);
      }
      if (this.modeTab === 'animate' && this.mobileDrawer === 'timeline') {
        this.drawTimelineSheet(ctx, padding, height - toolbarHeight - padding - 180, width - padding * 2, 170);
      }
    }

    if (this.selectionContextMenu) {
      this.drawSelectionContextMenu(ctx, width, height);
    }
    if (this.quickWheel?.active) {
      this.drawQuickWheel(ctx, width, height);
    }

    if (this.controlsOverlayOpen) {
      this.drawControlsOverlay(ctx, width, height);
    }

    if (this.gamepadHintVisible && !isMobile) {
      this.drawGamepadHints(ctx, width - padding - 20, height - bottomHeight - 90);
    }

    this.finalizeFocusGroups();
    this.drawFocusHighlight(ctx);

    ctx.restore();
  }

  drawButton(ctx, bounds, label, active = false, options = {}) {
    const fontSize = options.fontSize || 12;
    const color = drawSharedMenuButtonChrome(ctx, bounds, { active });
    drawSharedMenuButtonLabel(ctx, bounds, label, {
      fontSize,
      color,
      y: bounds.y + bounds.h / 2 + 1
    });
  }

  isMobileLayout() {
    return Boolean(this.game?.isMobile);
  }

  drawPreviewPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffe16a';
    ctx.strokeRect(x, y, w, h);
    const composite = compositeLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    const imageData = this.offscreenCtx.createImageData(this.canvasState.width, this.canvasState.height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    this.offscreenCtx.putImageData(imageData, 0, 0);
    const size = Math.min(w, h);
    ctx.drawImage(this.offscreen, x + (w - size) / 2, y + (h - size) / 2, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Preview', x + 4, y + h + 14);
  }

  drawLeftPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    const labels = {
      file: SHARED_EDITOR_LEFT_MENU.fileLabel,
      tools: 'Tools',
      canvas: 'Canvas'
    };
    const { tabColumn, content } = buildSharedLeftMenuLayout({
      x,
      y,
      width: w,
      height: h,
      isMobile
    });

    const topButtons = buildSharedLeftMenuButtons({
      x: tabColumn.x,
      y: tabColumn.y,
      height: tabColumn.h,
      additionalButtons: this.leftPanelTabs
        .filter((tab) => tab !== 'file')
        .map((tab) => ({ id: tab, label: labels[tab] || tab })),
      isMobile,
      width: tabColumn.w
    });

    topButtons.forEach((entry) => {
      const bounds = entry.bounds;
      const active = this.leftPanelTab === entry.id;
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: isMobile ? 12 : 11 });
      this.uiButtons.push({ bounds, onClick: () => this.setLeftPanelTab(entry.id) });
      this.registerFocusable('menu', bounds, () => this.setLeftPanelTab(entry.id));
    });
    const lastY = topButtons[topButtons.length - 1]?.bounds?.y || tabColumn.y;
    const undoBounds = { x: tabColumn.x, y: lastY + SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop + SHARED_EDITOR_LEFT_MENU.buttonGap, w: tabColumn.w, h: isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop };
    this.drawButton(ctx, undoBounds, 'Undo / Redo', false, { fontSize: isMobile ? 12 : 11 });
    this.uiButtons.push({ bounds: undoBounds, onClick: () => this.runtime.undo() });
    this.registerFocusable('menu', undoBounds, () => this.runtime.undo());

    this.drawLeftPanelContent(ctx, content.x, content.y, content.w, content.h, options);
  }

  drawLeftPanelContent(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    if (this.leftPanelTab === 'file') {
      this.drawFilePanel(ctx, x, y, w, h, { isMobile });
      return;
    }
    if (this.leftPanelTab === 'tools') {
      this.drawToolsMenu(ctx, x, y, w, h, { isMobile });
      return;
    }
    if (this.leftPanelTab === 'canvas') {
      this.drawSwitchesPanel(ctx, x, y, w, h, { isMobile });
      return;
    }
  }

  drawToolsMenu(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const gap = 12;
    const colWidth = Math.max(160, Math.floor((w - gap * 2) / 3));
    const leftX = x;
    const middleX = x + colWidth + gap;
    const rightX = x + (colWidth + gap) * 2;
    const columnHeight = h;
    this.drawToolsPanel(ctx, leftX, y, colWidth, columnHeight, { isMobile });
    this.drawLayersPanel(ctx, middleX, y, colWidth, columnHeight, { isMobile, showPreview: !isMobile });
    this.drawPalettePanel(ctx, rightX, y, colWidth, columnHeight, { isMobile });
  }

  drawObjectsPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px ${UI_SUITE.font.family}`;
    ctx.fillText('Objects', x + 12, y + 20);
    const lineHeight = isMobile ? 52 : 20;
    const maxVisible = Math.max(1, Math.floor((h - 30) / lineHeight));
    this.focusGroupMeta.objects = { maxVisible };
    const start = this.focusScroll.objects || 0;
    let offsetY = y + 36;
    this.tileLibrary.slice(start, start + maxVisible).forEach((tile, visibleIndex) => {
      const index = start + visibleIndex;
      const active = tile.id === this.activeTile?.id;
      const bounds = { x: x + 8, y: offsetY - (isMobile ? 28 : 14), w: w - 16, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, tile.label, active, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: () => this.setActiveTile(tile) });
      this.registerFocusable('objects', bounds, () => this.setActiveTile(tile));
      offsetY += lineHeight;
    });
  }

  drawAnimatePanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    ctx.fillText('Animate', x + 12, y + 20);
    const startY = y + 36;
    this.drawAnimationControls(ctx, x + 12, startY, { isMobile });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${isMobile ? 12 : 11}px Courier New`;
    ctx.fillText('Timeline appears below canvas.', x + 12, y + h - 18);
  }

  drawFilePanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const actions = buildUnifiedFileDrawerItems({
      labels: {
        export: 'Export PNG',
        import: 'Import Palette'
      },
      actions: {
        new: () => this.newArtDocument(),
        save: () => this.saveArtDocument(),
        'save-as': () => this.saveArtDocument({ forceSaveAs: true }),
        open: () => this.loadArtDocument(),
        export: () => this.exportPng(),
        import: () => this.paletteFileInput.click()
      },
      editorSpecific: [
        { id: 'sprite-sheet', label: 'Sprite Sheet', onClick: () => this.exportSpriteSheet('horizontal') },
        { id: 'export-gif', label: 'Export GIF', onClick: () => this.exportGif() },
        { id: 'palette-json', label: 'Palette JSON', onClick: () => this.exportPaletteJson() },
        { id: 'palette-hex', label: 'Palette HEX', onClick: () => this.exportPaletteHex() },
        { id: 'controls', label: 'Controls', onClick: () => { this.controlsOverlayOpen = true; } }
      ]
    });

    const rowHeight = this.sharedMenu.getButtonHeight(isMobile);
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const result = this.sharedMenu.drawDrawer(ctx, {
      panel: { x, y, w, h },
      title: '',
      items: actions,
      scroll: this.focusScroll.file || 0,
      isMobile,
      showTitle: false,
      drawButton: (bounds, item) => {
        const onClick = item.footer
          ? (item.id === 'close-menu' ? () => this.closeFileMenu() : () => this.exitToMainMenu())
          : (item.onClick || item.action);
        const footerExitLabel = this.game.pixelStudioReturnState === 'editor' ? 'Return To Level Editor' : 'Exit to Main Menu';
        const label = item.footer && item.id !== 'close-menu' ? footerExitLabel : item.label;
        this.drawButton(ctx, bounds, label, false, { fontSize: isMobile ? 12 : 12 });
        this.uiButtons.push({ bounds, onClick });
        this.registerFocusable('file', bounds, onClick);
      }
    });

    this.focusScroll.file = result.scroll;
    this.focusGroupMeta.file = { maxVisible: Math.max(1, Math.floor(result.layout.listH / Math.max(1, rowHeight + rowGap))) };
    this.filePanelScroll = result.listBounds
      ? { x: result.listBounds.x, y: result.listBounds.y, w: result.listBounds.w, h: result.listBounds.h, lineHeight: rowHeight + rowGap }
      : null;
  }


  drawPalettePanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const fontSize = isMobile ? 14 : 12;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    ctx.fillText(`Palette: ${this.currentPalette.name}`, x + 12, y + 20);

    const buttonHeight = isMobile ? 44 : 18;
    const gap = isMobile ? 10 : 6;
    const controlWidth = isMobile ? 70 : 50;
    const paletteControls = [
      { label: '+', action: () => this.addPaletteColor() },
      { label: '-', action: () => this.removePaletteColor() },
      { label: '<', action: () => this.movePaletteColor(-1) },
      { label: '>', action: () => this.movePaletteColor(1) },
      { label: 'Ramp', action: () => this.generateRamp(4) },
      { label: 'Save', action: () => this.saveCurrentPalette() },
      { label: this.limitToPalette ? 'Limit ✓' : 'Limit', action: () => { this.limitToPalette = !this.limitToPalette; } },
      { label: 'Grid', action: () => { this.paletteGridOpen = !this.paletteGridOpen; } }
    ];
    const perRow = Math.max(1, Math.floor((w - 16) / (controlWidth + gap)));
    paletteControls.forEach((entry, index) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const bounds = {
        x: x + 8 + col * (controlWidth + gap),
        y: y + 30 + row * (buttonHeight + gap),
        w: controlWidth,
        h: buttonHeight
      };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });

    const controlRows = Math.ceil(paletteControls.length / perRow);
    let offsetY = y + 30 + controlRows * (buttonHeight + gap) + 8;
    const swatchSize = isMobile ? 36 : 26;
    const swatchGap = isMobile ? 10 : 8;
    const availableHeight = Math.max(80, h - offsetY - (isMobile ? 80 : 60));
    const maxPerRow = Math.max(1, Math.floor((w - 20) / (swatchSize + swatchGap)));
    const maxRows = Math.max(1, Math.floor(availableHeight / (swatchSize + swatchGap)));
    const maxVisible = maxPerRow * maxRows;
    this.paletteBounds = [];
    this.focusGroupMeta.palette = { maxVisible };
    const start = this.focusScroll.palette || 0;
    for (let i = start; i < Math.min(this.currentPalette.colors.length, start + maxVisible); i += 1) {
      const relative = i - start;
      const row = Math.floor(relative / maxPerRow);
      const col = relative % maxPerRow;
      const swatchX = x + 10 + col * (swatchSize + swatchGap);
      const swatchY = offsetY + row * (swatchSize + swatchGap);
      ctx.fillStyle = this.currentPalette.colors[i].hex;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      ctx.strokeStyle = i === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
      const bounds = { x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index: i };
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, () => this.setPaletteIndex(i));
    }

    offsetY += maxRows * (swatchSize + swatchGap) + 12;
    if (offsetY + 20 < y + h) {
      ctx.fillStyle = '#fff';
      ctx.font = `${isMobile ? 14 : 12}px Courier New`;
      ctx.fillText('Presets', x + 12, offsetY);
      offsetY += 18;
      const lineHeight = isMobile ? 52 : 20;
      const maxPresetVisible = Math.max(1, Math.floor((y + h - offsetY - 8) / lineHeight));
      this.focusGroupMeta.palettePresets = { maxVisible: maxPresetVisible };
      const presetStart = this.focusScroll.palettePresets || 0;
      const allPalettes = [...this.palettePresets, ...this.customPalettes];
      allPalettes.slice(presetStart, presetStart + maxPresetVisible).forEach((preset, visibleIndex) => {
        const bounds = {
          x: x + 8,
          y: offsetY + visibleIndex * lineHeight - (isMobile ? 28 : 14),
          w: w - 16,
          h: isMobile ? 44 : 18
        };
        this.drawButton(ctx, bounds, preset.name, preset.name === this.currentPalette.name, { fontSize });
        this.uiButtons.push({ bounds, onClick: () => { this.currentPalette = preset; this.paletteIndex = 0; } });
        this.registerFocusable('palettePresets', bounds, () => { this.currentPalette = preset; this.paletteIndex = 0; });
      });
    }
  }

  drawStatusBar(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const zoom = this.view.zoomLevels[this.view.zoomIndex];
    const zoomPercent = Math.round(zoom * 100);
    const statusText = `Tool ${this.getEffectiveToolId()} | Brush ${this.toolOptions.brushSize}px | Color ${getPaletteSwatchHex(this.currentPalette, this.paletteIndex)} | Layer ${this.canvasState.activeLayerIndex + 1}/${this.canvasState.layers.length} | Frame ${this.animation.currentFrameIndex + 1}/${this.animation.frames.length} | Zoom ${zoomPercent}% | Cursor ${this.cursor.col},${this.cursor.row}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '12px Courier New';
    ctx.fillText(statusText, x + 8, y + 14);
  }

  drawSelectionContextMenu(ctx, width, height) {
    const items = [
      { label: 'Copy', action: () => this.startFloatingPaste('copy') },
      { label: 'Cut', action: () => this.startFloatingPaste('cut') },
      { label: 'Delete', action: () => { this.deleteSelection(); this.clearSelection(); this.setActiveTool(TOOL_IDS.PENCIL); this.setInputMode('canvas'); } },
      { label: 'Cancel', action: () => { this.clearSelection(); this.setActiveTool(TOOL_IDS.PENCIL); this.setInputMode('canvas'); } }
    ];
    const boxW = 160;
    const boxH = items.length * 42 + 20;
    const padding = 8;
    const anchorX = this.selectionContextMenu?.x ?? width / 2;
    const anchorY = this.selectionContextMenu?.y ?? height / 2;
    const boxX = clamp(anchorX + 12, padding, width - boxW - padding);
    const boxY = clamp(anchorY - boxH / 2, padding, height - boxH - padding);
    this.selectionContextMenu.bounds = { x: boxX, y: boxY, w: boxW, h: boxH };

    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    items.forEach((entry, index) => {
      const bounds = { x: boxX + 10, y: boxY + 10 + index * 42, w: boxW - 20, h: 34 };
      const active = entry.id === this.leftPanelTab && entry.id !== 'fit';
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawQuickWheel(ctx, width, height) {
    const center = this.quickWheel.center || { x: width / 2, y: height / 2 };
    const radius = 72;
    const innerRadius = 20;
    const items = this.quickWheel.type === 'tool' ? this.getQuickToolEntries() : this.getQuickPaletteEntries();
    const labelFont = '10px Courier New';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius + 18, 0, Math.PI * 2);
    ctx.fill();

    items.forEach((entry, index) => {
      const angle = index * (Math.PI / 4);
      const cx = center.x + Math.cos(angle) * radius;
      const cy = center.y + Math.sin(angle) * radius;
      const selected = this.quickWheel.selectionIndex === index;
      ctx.beginPath();
      ctx.fillStyle = this.quickWheel.type === 'color' ? entry.hex : 'rgba(0,0,0,0.6)';
      ctx.strokeStyle = selected ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (this.quickWheel.type === 'tool') {
        ctx.fillStyle = selected ? '#ffe16a' : '#fff';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.fillText(entry.label.slice(0, 3), cx, cy + 4);
      }
    });

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  drawMobileRail(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const actions = [
      { id: 'file', label: SHARED_EDITOR_LEFT_MENU.fileLabel, action: () => { this.setLeftPanelTab('file'); this.mobileDrawer = 'panel'; } },
      { id: 'tools', label: 'Tools', action: () => { this.setLeftPanelTab('tools'); this.mobileDrawer = 'panel'; } },
      { id: 'canvas', label: 'Canvas', action: () => { this.setLeftPanelTab('canvas'); this.mobileDrawer = 'panel'; } },
      { id: 'undo', label: 'Undo / Redo', action: () => { this.runtime.undo(); } }
    ];
    const gap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const buttonH = SHARED_EDITOR_LEFT_MENU.buttonHeightMobile;
    const buttonW = Math.min(w - 12, SHARED_EDITOR_LEFT_MENU.buttonWidthMobile);
    actions.forEach((entry, index) => {
      const bounds = {
        x: x + 6 + (w - 12 - buttonW) * 0.5,
        y: y + 8 + index * (buttonH + gap),
        w: buttonW,
        h: buttonH
      };
      const active = entry.id === this.leftPanelTab && entry.id !== 'fit';
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: entry.action });
      this.registerFocusable('toolbar', bounds, entry.action);
    });
  }

  drawMobileToolbar(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const actions = [
      { label: this.leftPanelTab.slice(0, 2).toUpperCase(), action: () => { this.mobileDrawer = this.mobileDrawer === 'panel' ? null : 'panel'; } },
      { label: '🎨', action: () => { this.paletteGridOpen = !this.paletteGridOpen; } },
      { label: '↺', action: () => this.runtime.undo() },
      { label: '↻', action: () => this.runtime.redo() },
      { label: '🔍', action: () => this.zoomBy(this.view.zoomIndex >= this.view.zoomLevels.length - 1 ? -1 : 1) },
      { label: 'Tools', action: () => { this.setLeftPanelTab('tools'); this.mobileDrawer = 'panel'; } },
      { label: 'Canvas', action: () => { this.setLeftPanelTab('canvas'); this.mobileDrawer = null; } }
    ];
    const gap = 8;
    const buttonW = Math.min(68, Math.max(44, Math.floor((w - gap * (actions.length - 1)) / actions.length)));
    actions.forEach((entry, index) => {
      const bounds = {
        x: x + index * (buttonW + gap),
        y: y + 8,
        w: buttonW,
        h: h - 16
      };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('toolbar', bounds, (entry.onClick || entry.action));
    });
  }

  drawMobileDrawer(ctx, x, y, w, h, type) {
    this.mobileDrawerBounds = { x, y, w, h };
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    if (type === 'panel') {
      const panelY = y;
      const panelH = h;
      this.drawLeftPanelContent(ctx, x + 8, panelY, w - 16, panelH, { isMobile: true });
    }
  }

  drawPaletteGridSheet(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Palette', x + 12, y + 22);
    const swatchSize = 44;
    const gap = 10;
    const maxPerRow = Math.max(1, Math.floor((w - 20) / (swatchSize + gap)));
    let offsetY = y + 30;
    this.paletteBounds = [];
    this.currentPalette.colors.forEach((color, index) => {
      const row = Math.floor(index / maxPerRow);
      const col = index % maxPerRow;
      const swatchX = x + 12 + col * (swatchSize + gap);
      const swatchY = offsetY + row * (swatchSize + gap);
      if (swatchY + swatchSize > y + h - 40) return;
      ctx.fillStyle = color.hex;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      ctx.strokeStyle = index === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
      const bounds = { x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index };
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, () => this.setPaletteIndex(index));
    });

    const closeBounds = { x: x + w - 110, y: y + h - 50, w: 90, h: 44 };
    this.drawButton(ctx, closeBounds, 'Close', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: closeBounds, onClick: () => { this.paletteGridOpen = false; } });
    this.registerFocusable('menu', closeBounds, () => { this.paletteGridOpen = false; });
  }

  drawTimelineSheet(ctx, x, y, w, h) {
    this.drawTimeline(ctx, x, y, w, h);
  }

  drawMenuOverlay(ctx, width, height, isMobile) {
    const boxW = Math.min(280, width - 40);
    const boxH = 180;
    const boxX = width / 2 - boxW / 2;
    const boxY = height / 2 - boxH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('Menu', boxX + 16, boxY + 28);

    const items = [
      { label: 'Controls', action: () => { this.controlsOverlayOpen = true; this.menuOpen = false; } },
      { label: 'Export PNG', action: () => { this.exportPng(); this.menuOpen = false; } },
      { label: 'Exit', action: () => { this.game.exitPixelStudio({ toTitle: true }); } }
    ];
    items.forEach((entry, index) => {
      const bounds = { x: boxX + 20, y: boxY + 50 + index * 52, w: boxW - 40, h: 44 };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: 13 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawControlsOverlay(ctx, width, height) {
    const boxW = Math.min(560, width - 40);
    const boxH = Math.min(420, height - 40);
    const boxX = width / 2 - boxW / 2;
    const boxY = height / 2 - boxH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('Controls', boxX + 16, boxY + 24);

    ctx.font = '12px Courier New';
    const lines = [
      'Gamepad: D-pad fine move | LS cursor (grid) | RS pan/scrub',
      'A draw/use | X erase | B draw mode/undo | Y redo',
      'LT deselect | RT select | LB/RB panels | Start tools | Back UI mode',
      'L3 color pages | R3 tool pages',
      '',
      'Keyboard: B pencil | E eraser | G fill | I eyedropper | V move | S select',
      'Ctrl+Z undo | Ctrl+Shift+Z / Ctrl+Y redo | [ ] brush size',
      '+/- zoom | 0 reset zoom | Arrow keys nudge cursor/selection',
      '',
      'Touch: 1 finger draw | 2-finger pan | pinch zoom | long-press eyedropper'
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, boxX + 16, boxY + 50 + index * 18);
    });

    const closeBounds = { x: boxX + boxW - 110, y: boxY + boxH - 50, w: 90, h: 44 };
    this.drawButton(ctx, closeBounds, 'Close', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: closeBounds, onClick: () => { this.controlsOverlayOpen = false; } });
    this.registerFocusable('menu', closeBounds, () => { this.controlsOverlayOpen = false; });
  }

  drawToolsPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const fontSize = isMobile ? 14 : 12;
    const lineHeight = isMobile ? 52 : 20;
    const buttonHeight = isMobile ? 44 : 18;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    ctx.fillText('Tools', x + 12, y + 22);

    const list = this.tools.map((tool) => tool);
    const maxVisible = Math.max(1, Math.floor((h - 140) / lineHeight));
    this.focusGroupMeta.tools = { maxVisible };
    const start = this.focusScroll.tools || 0;
    let offsetY = y + 36;
    list.slice(start, start + maxVisible).forEach((tool) => {
      const isActive = tool.id === this.activeToolId;
      const bounds = { x: x + 8, y: offsetY - buttonHeight + 4, w: w - 16, h: buttonHeight };
      this.drawButton(ctx, bounds, tool.name, isActive, { fontSize });
      this.uiButtons.push({ bounds, onClick: () => { this.setActiveTool(tool.id); } });
      this.registerFocusable('tools', bounds, () => this.setActiveTool(tool.id));
      offsetY += lineHeight;
    });

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
    ctx.fillText(`Brush Size: ${this.toolOptions.brushSize}`, x + 12, offsetY);
    const brushMinus = { x: x + 160, y: offsetY - buttonHeight + 4, w: 30, h: buttonHeight };
    const brushPlus = { x: x + 196, y: offsetY - buttonHeight + 4, w: 30, h: buttonHeight };
    this.drawButton(ctx, brushMinus, '-', false, { fontSize });
    this.drawButton(ctx, brushPlus, '+', false, { fontSize });
    this.uiButtons.push({ bounds: brushMinus, onClick: () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize - 1, 1, 8); } });
    this.uiButtons.push({ bounds: brushPlus, onClick: () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize + 1, 1, 8); } });
    this.registerFocusable('menu', brushMinus, () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize - 1, 1, 8); });
    this.registerFocusable('menu', brushPlus, () => { this.toolOptions.brushSize = clamp(this.toolOptions.brushSize + 1, 1, 8); });
    offsetY += lineHeight;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
    ctx.fillText(`Tile: ${this.activeTile?.label || 'None'}`, x + 12, offsetY);
    const tileLeft = { x: x + 160, y: offsetY - buttonHeight + 4, w: 30, h: buttonHeight };
    const tileRight = { x: x + 196, y: offsetY - buttonHeight + 4, w: 30, h: buttonHeight };
    this.drawButton(ctx, tileLeft, '<', false, { fontSize });
    this.drawButton(ctx, tileRight, '>', false, { fontSize });
    this.uiButtons.push({ bounds: tileLeft, onClick: () => this.cycleTile(-1) });
    this.uiButtons.push({ bounds: tileRight, onClick: () => this.cycleTile(1) });
    this.registerFocusable('menu', tileLeft, () => this.cycleTile(-1));
    this.registerFocusable('menu', tileRight, () => this.cycleTile(1));
    offsetY += lineHeight;

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
    ctx.fillText('Offset Canvas', x + 12, offsetY);
    offsetY += lineHeight;
    const offsetButtons = [
      { label: '←', action: () => this.offsetCanvas(-1, 0, true) },
      { label: '→', action: () => this.offsetCanvas(1, 0, true) },
      { label: '↑', action: () => this.offsetCanvas(0, -1, true) },
      { label: '↓', action: () => this.offsetCanvas(0, 1, true) },
      { label: '½W', action: () => this.offsetCanvas(Math.floor(this.canvasState.width / 2), 0, true) },
      { label: '½H', action: () => this.offsetCanvas(0, Math.floor(this.canvasState.height / 2), true) }
    ];
    offsetButtons.forEach((entry, index) => {
      const bounds = {
        x: x + 12 + (index % 3) * (buttonHeight + 8),
        y: offsetY + Math.floor(index / 3) * (buttonHeight + 6),
        w: buttonHeight,
        h: buttonHeight
      };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
    offsetY += buttonHeight * 2 + 12;

    offsetY = this.drawToolOptions(ctx, x + 12, offsetY, { isMobile });

    if (this.modeTab === 'select') {
      this.drawSelectionActions(ctx, x + 12, offsetY, { isMobile });
    }

    if (this.modeTab === 'animate') {
      this.drawAnimationControls(ctx, x + 12, offsetY, { isMobile });
    }

    if (this.modeTab === 'export') {
      this.drawExportControls(ctx, x + 12, offsetY, { isMobile });
    }
  }

  drawSwitchesPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const fontSize = isMobile ? 14 : 12;
    const lineHeight = isMobile ? 52 : 20;
    const buttonHeight = isMobile ? 44 : 18;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    ctx.fillText('Switches', x + 12, y + 22);

    let offsetY = y + 44;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Symmetry H', this.toolOptions.symmetry.horizontal, () => {
      this.toolOptions.symmetry.horizontal = !this.toolOptions.symmetry.horizontal;
    }, { isMobile });
    offsetY += lineHeight;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Symmetry V', this.toolOptions.symmetry.vertical, () => {
      this.toolOptions.symmetry.vertical = !this.toolOptions.symmetry.vertical;
    }, { isMobile });
    offsetY += lineHeight;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Wrap Draw', this.toolOptions.wrapDraw, () => {
      this.toolOptions.wrapDraw = !this.toolOptions.wrapDraw;
    }, { isMobile });
    offsetY += lineHeight;
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Tiled Preview', this.tiledPreview.enabled, () => {
      this.tiledPreview.enabled = !this.tiledPreview.enabled;
    }, { isMobile });
    offsetY += lineHeight;

    const tileSizeBounds = { x: x + 12, y: offsetY - buttonHeight + 4, w: 160, h: buttonHeight };
    this.drawButton(ctx, tileSizeBounds, `Tiles: ${this.tiledPreview.tiles}x${this.tiledPreview.tiles}`, false, { fontSize });
    this.uiButtons.push({
      bounds: tileSizeBounds,
      onClick: () => { this.tiledPreview.tiles = this.tiledPreview.tiles === 2 ? 3 : 2; }
    });
    this.registerFocusable('menu', tileSizeBounds, () => {
      this.tiledPreview.tiles = this.tiledPreview.tiles === 2 ? 3 : 2;
    });
    offsetY += lineHeight;

    if (offsetY + lineHeight < y + h) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
      ctx.fillText(`Zoom: ${Math.round(this.view.zoomLevels[this.view.zoomIndex] * 100)}%`, x + 12, offsetY);
    }
  }

  drawOptionToggle(ctx, x, y, label, active, onClick, options = {}) {
    const isMobile = options.isMobile;
    const bounds = { x, y: y - (isMobile ? 24 : 12), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
    this.drawButton(ctx, bounds, label, active, { fontSize: isMobile ? 12 : 12 });
    this.uiButtons.push({ bounds, onClick });
    this.registerFocusable('menu', bounds, onClick);
  }

  drawToolOptions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    let offsetY = y;
    ctx.fillStyle = '#fff';
    ctx.fillText('Tool Options', x, offsetY);
    offsetY += 18;
    if (this.activeToolId === TOOL_IDS.LINE) {
      this.drawOptionToggle(ctx, x, offsetY, 'Perfect Pixels', this.toolOptions.linePerfect, () => {
        this.toolOptions.linePerfect = !this.toolOptions.linePerfect;
      }, { isMobile });
      offsetY += isMobile ? 52 : 20;
    }
    if (this.activeToolId === TOOL_IDS.FILL) {
      this.drawOptionToggle(ctx, x, offsetY, 'Contiguous', this.toolOptions.fillContiguous, () => {
        this.toolOptions.fillContiguous = !this.toolOptions.fillContiguous;
      }, { isMobile });
      offsetY += isMobile ? 52 : 20;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Tolerance: ${this.toolOptions.fillTolerance}`, x, offsetY);
      const minus = { x: x + 120, y: offsetY - (isMobile ? 28 : 14), w: 36, h: isMobile ? 44 : 18 };
      const plus = { x: x + 160, y: offsetY - (isMobile ? 28 : 14), w: 36, h: isMobile ? 44 : 18 };
      this.uiButtons.push({
        bounds: minus,
        onClick: () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance - 5, 0, 255); }
      });
      this.uiButtons.push({
        bounds: plus,
        onClick: () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance + 5, 0, 255); }
      });
      this.drawButton(ctx, minus, '-', false, { fontSize: isMobile ? 12 : 12 });
      this.drawButton(ctx, plus, '+', false, { fontSize: isMobile ? 12 : 12 });
      this.registerFocusable('menu', minus, () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance - 5, 0, 255); });
      this.registerFocusable('menu', plus, () => { this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance + 5, 0, 255); });
      offsetY += isMobile ? 52 : 22;
    }
    if (this.activeToolId === TOOL_IDS.DITHER) {
      const patterns = ['bayer2', 'bayer4', 'checker'];
      const nextPattern = patterns[(patterns.indexOf(this.toolOptions.ditherPattern) + 1) % patterns.length];
      const bounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, `Pattern: ${this.toolOptions.ditherPattern}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: () => { this.toolOptions.ditherPattern = nextPattern; } });
      this.registerFocusable('menu', bounds, () => { this.toolOptions.ditherPattern = nextPattern; });
      offsetY += isMobile ? 52 : 20;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Strength: ${this.toolOptions.ditherStrength}`, x, offsetY);
      const minus = { x: x + 120, y: offsetY - (isMobile ? 28 : 14), w: 36, h: isMobile ? 44 : 18 };
      const plus = { x: x + 160, y: offsetY - (isMobile ? 28 : 14), w: 36, h: isMobile ? 44 : 18 };
      this.uiButtons.push({
        bounds: minus,
        onClick: () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength - 1, 1, 4); }
      });
      this.uiButtons.push({
        bounds: plus,
        onClick: () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength + 1, 1, 4); }
      });
      this.drawButton(ctx, minus, '-', false, { fontSize: isMobile ? 12 : 12 });
      this.drawButton(ctx, plus, '+', false, { fontSize: isMobile ? 12 : 12 });
      this.registerFocusable('menu', minus, () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength - 1, 1, 4); });
      this.registerFocusable('menu', plus, () => { this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength + 1, 1, 4); });
      offsetY += isMobile ? 52 : 22;
    }
    if (this.activeToolId === TOOL_IDS.COLOR_REPLACE) {
      const bounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, `Scope: ${this.toolOptions.replaceScope}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({
        bounds,
        onClick: () => {
          this.toolOptions.replaceScope = this.toolOptions.replaceScope === 'layer' ? 'selection' : 'layer';
        }
      });
      this.registerFocusable('menu', bounds, () => {
        this.toolOptions.replaceScope = this.toolOptions.replaceScope === 'layer' ? 'selection' : 'layer';
      });
      offsetY += isMobile ? 52 : 20;
    }
    return offsetY;
  }

  drawSelectionActions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
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
      const bounds = { x, y: y + index * (isMobile ? 52 : 20), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawAnimationControls(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    const controls = [
      { label: this.animation.playing ? 'Pause' : 'Play', action: () => { this.animation.playing = !this.animation.playing; } },
      { label: 'Onion Skin', action: () => { this.animation.onion.enabled = !this.animation.onion.enabled; } },
      { label: 'Loop', action: () => { this.animation.loop = !this.animation.loop; } }
    ];
    controls.forEach((entry, index) => {
      const bounds = { x, y: y + index * (isMobile ? 52 : 20), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
      const active = entry.label === 'Loop' ? this.animation.loop : entry.label === 'Onion Skin' ? this.animation.onion.enabled : false;
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
    const onionOffset = y + controls.length * (isMobile ? 52 : 20) + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Prev: ${this.animation.onion.prev}`, x, onionOffset);
    const prevMinus = { x: x + 60, y: onionOffset - (isMobile ? 28 : 14), w: 32, h: isMobile ? 44 : 16 };
    const prevPlus = { x: x + 96, y: onionOffset - (isMobile ? 28 : 14), w: 32, h: isMobile ? 44 : 16 };
    this.uiButtons.push({
      bounds: prevMinus,
      onClick: () => { this.animation.onion.prev = clamp(this.animation.onion.prev - 1, 0, 3); }
    });
    this.uiButtons.push({
      bounds: prevPlus,
      onClick: () => { this.animation.onion.prev = clamp(this.animation.onion.prev + 1, 0, 3); }
    });
    this.drawButton(ctx, prevMinus, '-', false, { fontSize: isMobile ? 12 : 12 });
    this.drawButton(ctx, prevPlus, '+', false, { fontSize: isMobile ? 12 : 12 });
    this.registerFocusable('menu', prevMinus, () => { this.animation.onion.prev = clamp(this.animation.onion.prev - 1, 0, 3); });
    this.registerFocusable('menu', prevPlus, () => { this.animation.onion.prev = clamp(this.animation.onion.prev + 1, 0, 3); });
    const nextOffset = onionOffset + 20;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Next: ${this.animation.onion.next}`, x, nextOffset);
    const nextMinus = { x: x + 60, y: nextOffset - (isMobile ? 28 : 14), w: 32, h: isMobile ? 44 : 16 };
    const nextPlus = { x: x + 96, y: nextOffset - (isMobile ? 28 : 14), w: 32, h: isMobile ? 44 : 16 };
    this.uiButtons.push({
      bounds: nextMinus,
      onClick: () => { this.animation.onion.next = clamp(this.animation.onion.next - 1, 0, 3); }
    });
    this.uiButtons.push({
      bounds: nextPlus,
      onClick: () => { this.animation.onion.next = clamp(this.animation.onion.next + 1, 0, 3); }
    });
    this.drawButton(ctx, nextMinus, '-', false, { fontSize: isMobile ? 12 : 12 });
    this.drawButton(ctx, nextPlus, '+', false, { fontSize: isMobile ? 12 : 12 });
    this.registerFocusable('menu', nextMinus, () => { this.animation.onion.next = clamp(this.animation.onion.next - 1, 0, 3); });
    this.registerFocusable('menu', nextPlus, () => { this.animation.onion.next = clamp(this.animation.onion.next + 1, 0, 3); });
  }

  drawExportControls(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    const actions = [
      { label: 'Export PNG', action: () => this.exportPng() },
      { label: 'Sprite Sheet', action: () => this.exportSpriteSheet('horizontal') },
      { label: 'Export GIF', action: () => this.exportGif() },
      { label: 'Palette JSON', action: () => this.exportPaletteJson() },
      { label: 'Palette HEX', action: () => this.exportPaletteHex() },
      { label: 'Import Palette', action: () => this.paletteFileInput.click() }
    ];
    actions.forEach((entry, index) => {
      const bounds = { x, y: y + index * (isMobile ? 52 : 20), w: isMobile ? 190 : 140, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawLayersPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const showPreview = options.showPreview;
    const buttonHeight = isMobile ? 44 : 18;
    let offsetY = y;
    if (showPreview) {
      const previewH = Math.min(120, Math.max(90, Math.floor(h * 0.35)));
      this.drawPreviewPanel(ctx, x + 4, y + 4, w - 8, previewH - 16);
      offsetY += previewH;
    }
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    ctx.fillText('Layers', x + 12, offsetY + 20);
    const controls = [
      { label: '+', action: () => this.addLayer() },
      { label: 'Dup', action: () => this.duplicateLayer(this.canvasState.activeLayerIndex) },
      { label: '-', action: () => this.deleteLayer(this.canvasState.activeLayerIndex) },
      { label: 'Merge', action: () => this.mergeLayerDown(this.canvasState.activeLayerIndex) },
      { label: 'Flatten', action: () => this.flattenAllLayers() }
    ];
    controls.forEach((entry, index) => {
      const bounds = { x: x + 12 + index * (buttonHeight + 6), y: offsetY + 28, w: buttonHeight, h: buttonHeight };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
    offsetY += 60;
    this.layerBounds = [];
    const lineHeight = isMobile ? 52 : 20;
    this.focusGroupMeta.layers = { maxVisible: Math.max(1, Math.floor((h - 80) / lineHeight)) };
    const start = this.focusScroll.layers || 0;
    const layers = this.canvasState.layers.slice().reverse();
    layers.slice(start, start + this.focusGroupMeta.layers.maxVisible).forEach((layer, visibleIndex) => {
      const reversedIndex = start + visibleIndex;
      const index = this.canvasState.layers.length - 1 - reversedIndex;
      const active = index === this.canvasState.activeLayerIndex;
      const bounds = { x: x + 8, y: offsetY - (isMobile ? 20 : 14), w: w - 16, h: buttonHeight, index };
      ctx.fillStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.font = `${isMobile ? 13 : 12}px Courier New`;
      ctx.fillText(`${layer.visible ? '👁' : '⛔'} ${layer.name}`, x + 12, offsetY);
      this.layerBounds.push(bounds);
      this.registerFocusable('layers', bounds, () => { this.canvasState.activeLayerIndex = index; });
      offsetY += lineHeight;
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

    if (this.selection.floating && this.selection.floatingMode === 'paste') {
      const floatingOffset = this.getFloatingPasteOffset();
      this.floatingCanvas.width = width;
      this.floatingCanvas.height = height;
      const imageData = this.floatingCtx.createImageData(width, height);
      const bytes = new Uint32Array(imageData.data.buffer);
      bytes.set(this.selection.floating);
      this.floatingCtx.putImageData(imageData, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(
        this.floatingCanvas,
        offsetX + floatingOffset.x * zoom,
        offsetY + floatingOffset.y * zoom,
        gridW,
        gridH
      );
      ctx.restore();
    }

    if (this.selection.start && this.selection.end && this.selection.mode === 'rect' && !this.selection.active) {
      const bounds = this.getBoundsFromPoints(this.selection.start, this.selection.end);
      ctx.strokeStyle = '#ffcc6a';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        offsetX + bounds.x * zoom,
        offsetY + bounds.y * zoom,
        bounds.w * zoom,
        bounds.h * zoom
      );
    }

    if (this.linePreview) {
      const bounds = this.getBoundsFromPoints(this.linePreview.start, this.linePreview.end);
      ctx.strokeStyle = UI_SUITE.colors.accent;
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
      ctx.strokeStyle = UI_SUITE.colors.accent;
      ctx.strokeRect(this.gamepadCursor.x - 4, this.gamepadCursor.y - 4, 8, 8);
    }

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

  drawPaletteBar(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 12 : 14}px Courier New`;
    ctx.fillText(`Palette: ${this.currentPalette.name}`, x + 10, y + 18);

    if (!isMobile) {
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
        this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
        this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
      });

      const swatchSize = 26;
      const gap = 8;
      const total = this.currentPalette.colors.length;
      const startX = x + 10;
      const maxPerRow = Math.max(1, Math.floor((w - 20) / (swatchSize + gap)));
      const maxRows = Math.max(1, Math.floor((h - 30) / (swatchSize + gap)));
      const maxVisible = maxPerRow * maxRows;
      this.paletteBounds = [];
      this.focusGroupMeta.palette = { maxVisible };
      const start = this.focusScroll.palette || 0;
      for (let i = start; i < Math.min(total, start + maxVisible); i += 1) {
        const relative = i - start;
        const row = Math.floor(relative / maxPerRow);
        const col = relative % maxPerRow;
        const swatchX = startX + col * (swatchSize + gap);
        const swatchY = y + 30 + row * (swatchSize + gap);
        ctx.fillStyle = this.currentPalette.colors[i].hex;
        ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
        ctx.strokeStyle = i === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
        ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
        const bounds = { x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index: i };
        this.paletteBounds.push(bounds);
        this.registerFocusable('palette', bounds, () => this.setPaletteIndex(i));
      }

      const presetX = x + w - 180;
      const presetY = y + 8;
      const allPalettes = [...this.palettePresets, ...this.customPalettes];
      allPalettes.forEach((preset, index) => {
        const bounds = { x: presetX, y: presetY + index * 20, w: 160, h: 18 };
        this.drawButton(ctx, bounds, preset.name, preset.name === this.currentPalette.name);
        this.uiButtons.push({ bounds, onClick: () => { this.currentPalette = preset; this.paletteIndex = 0; } });
        this.registerFocusable('menu', bounds, () => { this.currentPalette = preset; this.paletteIndex = 0; });
      });
      return;
    }

    const swatchSize = 44;
    const gap = 8;
    const maxPerRow = Math.max(1, Math.floor((w - 140) / (swatchSize + gap)));
    const startX = x + 10;
    const total = this.currentPalette.colors.length;
    this.paletteBounds = [];
    this.focusGroupMeta.palette = { maxVisible: maxPerRow };
    const start = this.focusScroll.palette || 0;
    for (let i = start; i < Math.min(total, start + maxPerRow); i += 1) {
      const col = i - start;
      const swatchX = startX + col * (swatchSize + gap);
      const swatchY = y + 20;
      ctx.fillStyle = this.currentPalette.colors[i].hex;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      ctx.strokeStyle = i === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
      const bounds = { x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index: i };
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, () => this.setPaletteIndex(i));
    }

    const moreBounds = { x: x + w - 112, y: y + 10, w: 100, h: 44 };
    this.drawButton(ctx, moreBounds, this.paletteGridOpen ? 'Palette ▾' : 'Palette ▸', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: moreBounds, onClick: () => { this.paletteGridOpen = !this.paletteGridOpen; } });
    this.registerFocusable('menu', moreBounds, () => { this.paletteGridOpen = !this.paletteGridOpen; });
  }

  drawTimeline(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Timeline', x + 10, y + 18);

    const thumbSize = 40;
    const gap = 10;
    const startX = x + 10;
    const startY = y + 30;
    this.frameBounds = [];
    const maxVisible = Math.max(1, Math.floor((w - 20) / (thumbSize + gap)));
    this.focusGroupMeta.timeline = { maxVisible };
    const start = this.focusScroll.timeline || 0;
    this.animation.frames.slice(start, start + maxVisible).forEach((frame, visibleIndex) => {
      const index = start + visibleIndex;
      const thumbX = startX + visibleIndex * (thumbSize + gap);
      const thumbY = startY;
      ctx.fillStyle = index === this.animation.currentFrameIndex ? '#ffe16a' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
      const composite = compositeLayers(frame.layers, this.canvasState.width, this.canvasState.height);
      const imageData = this.offscreenCtx.createImageData(this.canvasState.width, this.canvasState.height);
      const bytes = new Uint32Array(imageData.data.buffer);
      bytes.set(composite);
      this.offscreenCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(this.offscreen, thumbX, thumbY, thumbSize, thumbSize);
      const bounds = { x: thumbX, y: thumbY, w: thumbSize, h: thumbSize, index };
      this.frameBounds.push(bounds);
      this.registerFocusable('timeline', bounds, () => {
        this.animation.currentFrameIndex = index;
        this.setFrameLayers(this.currentFrame.layers);
      });
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
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawGamepadHints(ctx, x, y) {
    const height = GAMEPAD_HINTS.length * 12 + 20;
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, 220, height);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, 220, height);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Courier New';
    GAMEPAD_HINTS.forEach((hint, index) => {
      ctx.fillText(hint, x + 10, y + 16 + index * 12);
    });
  }
}
