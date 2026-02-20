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
import { openTextInputOverlay } from './shared/textInputOverlay.js';
import { ensurePixelArtStore, ensurePixelTileData } from '../editor/adapters/editorDataContracts.js';

const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 64;
const DEFAULT_BRUSH_SIZE = 1;
const BRUSH_SHAPES = ['square', 'circle', 'diamond', 'cross', 'x', 'hline', 'vline'];
const BRUSH_FALLOFFS = ['solid', 'soft'];


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
      brushSize: DEFAULT_BRUSH_SIZE,
      brushOpacity: 1,
      brushHardness: 0,
      brushShape: 'square',
      brushFalloff: 'solid',
      shapeFill: false,
      polygonSides: 5,
      magicThreshold: 24,
      gradientStrength: 100,
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
    this.magicLassoEdgeMap = null;
    this.magicLassoLastVector = null;
    this.magicLassoEdgeMax = 1;
    this.magicLassoRgbaMap = null;
    this.magicLassoAnchorRgba = null;
    this.view = {
      zoomLevels: [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32],
      zoomIndex: 8,
      panX: 0,
      panY: 0
    };
    this.viewportController = createViewportController({
      minZoom: 0,
      maxZoom: 8,
      zoomStep: 1
    });
    this.tiledPreview = { enabled: false, tiles: 3 };
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
    this.curvePreview = null;
    this.shapePreview = null;
    this.polygonPreview = null;
    this.gradientPreview = null;
    this.cloneSource = null;
    this.cloneOffset = null;
    this.cloneSourcePixels = null;
    this.clonePickSourceArmed = false;
    this.cloneColorPickArmed = false;
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
      paletteModal: 0,
      palettePresets: 0,
      layers: 0,
      timeline: 0,
      toolbar: 0,
      menu: 0,
      file: 0,
      toolOptions: 0
    };
    this.toolsPanelMeta = null;
    this.toolsListMeta = null;
    this.tempToolOverrides = new Map();
    this.menuOpen = false;
    this.controlsOverlayOpen = false;
    this.mobileDrawer = null;
    this.mobileDrawerBounds = null;
    this.paletteBarScrollBounds = null;
    this.paletteModalSwatchScrollBounds = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
    this.brushPickerBounds = null;
    this.brushPickerSliders = null;
    this.panJoystick = {
      active: false,
      id: null,
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0,
      dx: 0,
      dy: 0
    };
    this.mobileZoomSliderBounds = null;
    this.mobileZoomDrag = null;
    this.brushPickerOpen = false;
    this.brushPickerDraft = null;
    this.brushPickerDrag = null;
    this.brushPickerSliders = null;
    this.palettePickerDrag = null;
    this.paletteGridOpen = false;
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked = new Set();
    this.transformModal = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
    this.sidebars = { left: true };
    this.leftPanelTabs = ['file', 'draw', 'select', 'tools', 'canvas'];
    this.leftPanelTabIndex = 1;
    this.leftPanelTab = this.leftPanelTabs[this.leftPanelTabIndex];
    this.uiButtons = [];
    this.menuScrollDrag = null;
    this.uiSliderDrag = null;
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
    const value = await openTextInputOverlay({
      title: 'New Art File',
      label: 'New art file name?',
      initialValue: fallback,
      inputType: 'text'
    });
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  exitToMainMenu() {
    this.commitDecalEditIfNeeded();
    this.game.exitEditorToMainMenu('pixel');
  }

  saveDecalSessionAndReturn() {
    if (!this.decalEditSession) return;
    this.commitDecalEditIfNeeded();
    this.game.exitPixelStudio();
  }

  abandonDecalSessionAndReturn() {
    if (!this.decalEditSession) return;
    this.decalEditSession = null;
    this.game.exitPixelStudio();
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
    this.decalEditSession = { type: 'single', decalId };
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

  async loadVisibleDecalsForSeamFix({ bounds, decals } = {}) {
    if (!Array.isArray(decals) || !decals.length) return;
    const minX = Number.isFinite(bounds?.x)
      ? bounds.x
      : Math.min(...decals.map((decal) => Number.isFinite(decal.x) ? decal.x : 0));
    const minY = Number.isFinite(bounds?.y)
      ? bounds.y
      : Math.min(...decals.map((decal) => Number.isFinite(decal.y) ? decal.y : 0));
    const maxX = Number.isFinite(bounds?.w)
      ? minX + bounds.w
      : Math.max(...decals.map((decal) => (Number.isFinite(decal.x) ? decal.x : 0) + Math.max(1, Number.isFinite(decal.w) ? decal.w : 1)));
    const maxY = Number.isFinite(bounds?.h)
      ? minY + bounds.h
      : Math.max(...decals.map((decal) => (Number.isFinite(decal.y) ? decal.y : 0) + Math.max(1, Number.isFinite(decal.h) ? decal.h : 1)));
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const width = clamp(Math.round(worldW), 8, 512);
    const height = clamp(Math.round(worldH), 8, 512);
    const scaleX = width / worldW;
    const scaleY = height / worldH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const drawCtx = canvas.getContext('2d');
    drawCtx.clearRect(0, 0, width, height);

    const entries = [];
    for (const decal of decals) {
      if (!decal?.imageDataUrl) continue;
      const image = await new Promise((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = reject;
        next.src = decal.imageDataUrl;
      });
      const x = Number.isFinite(decal.x) ? decal.x : 0;
      const y = Number.isFinite(decal.y) ? decal.y : 0;
      const w = Math.max(1, Number.isFinite(decal.w) ? decal.w : image.width || 1);
      const h = Math.max(1, Number.isFinite(decal.h) ? decal.h : image.height || 1);
      const ix = (x - minX) * scaleX;
      const iy = (y - minY) * scaleY;
      const iw = w * scaleX;
      const ih = h * scaleY;
      drawCtx.drawImage(image, ix, iy, iw, ih);
      entries.push({
        decalId: decal.id,
        srcWidth: image.naturalWidth || image.width || 1,
        srcHeight: image.naturalHeight || image.height || 1,
        x,
        y,
        w,
        h,
        canvasX: ix,
        canvasY: iy,
        canvasW: iw,
        canvasH: ih
      });
    }

    const pixels = drawCtx.getImageData(0, 0, width, height).data;
    const layer = createLayer(width, height, 'Seam Fix Layer');
    for (let i = 0; i < width * height; i += 1) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const a = pixels[i * 4 + 3];
      layer.pixels[i] = rgbaToUint32({ r, g, b, a });
    }

    this.decalEditSession = {
      type: 'seams',
      bounds: { x: minX, y: minY, w: worldW, h: worldH },
      entries,
      baseComposite: new Uint32Array(layer.pixels)
    };
    this.canvasState.width = width;
    this.canvasState.height = height;
    this.animation.frames = [createFrame([layer], 120)];
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.zoomToFitCanvas();
    this.resetFocus();
    this.configureSeamFixCloneDefaults();
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
    if (!this.decalEditSession) return;
    if (this.decalEditSession.type === 'single' && this.decalEditSession.decalId) {
      const decal = (this.game.world.decals || []).find((entry) => entry.id === this.decalEditSession.decalId);
      if (decal) {
        decal.imageDataUrl = this.exportCurrentFrameDataUrl();
        this.game.editor?.persistAutosave?.();
      }
      this.decalEditSession = null;
      return;
    }
    if (this.decalEditSession.type === 'seams' && Array.isArray(this.decalEditSession.entries)) {
      const apply = async () => {
        const currentComposite = compositeLayers(this.currentFrame.layers, this.canvasState.width, this.canvasState.height);
        const baseComposite = this.decalEditSession.baseComposite || new Uint32Array(currentComposite.length);
        const decals = this.game.world.decals || [];
        for (const entry of this.decalEditSession.entries) {
          const decal = decals.find((item) => item.id === entry.decalId);
          if (!decal || !decal.imageDataUrl) continue;
          const image = await new Promise((resolve, reject) => {
            const next = new Image();
            next.onload = () => resolve(next);
            next.onerror = reject;
            next.src = decal.imageDataUrl;
          });
          const decalCanvas = document.createElement('canvas');
          decalCanvas.width = Math.max(1, Math.round(entry.srcWidth));
          decalCanvas.height = Math.max(1, Math.round(entry.srcHeight));
          const decalCtx = decalCanvas.getContext('2d');
          decalCtx.drawImage(image, 0, 0, decalCanvas.width, decalCanvas.height);
          const imageData = decalCtx.getImageData(0, 0, decalCanvas.width, decalCanvas.height);
          const decalPixels = new Uint32Array(imageData.data.buffer);
          const startX = Math.max(0, Math.floor(entry.canvasX));
          const endX = Math.min(this.canvasState.width, Math.ceil(entry.canvasX + entry.canvasW));
          const startY = Math.max(0, Math.floor(entry.canvasY));
          const endY = Math.min(this.canvasState.height, Math.ceil(entry.canvasY + entry.canvasH));
          let changed = false;
          for (let row = startY; row < endY; row += 1) {
            for (let col = startX; col < endX; col += 1) {
              const seamIndex = row * this.canvasState.width + col;
              if (currentComposite[seamIndex] === baseComposite[seamIndex]) continue;
              const u = (col + 0.5 - entry.canvasX) / Math.max(1e-6, entry.canvasW);
              const v = (row + 0.5 - entry.canvasY) / Math.max(1e-6, entry.canvasH);
              if (u < 0 || u > 1 || v < 0 || v > 1) continue;
              const decalCol = clamp(Math.floor(u * decalCanvas.width), 0, decalCanvas.width - 1);
              const decalRow = clamp(Math.floor(v * decalCanvas.height), 0, decalCanvas.height - 1);
              const decalIndex = decalRow * decalCanvas.width + decalCol;
              decalPixels[decalIndex] = currentComposite[seamIndex];
              changed = true;
            }
          }
          if (changed) {
            decalCtx.putImageData(imageData, 0, 0);
            decal.imageDataUrl = decalCanvas.toDataURL('image/png');
          }
        }
        this.game.editor?.persistAutosave?.();
        this.decalEditSession = null;
      };
      apply().catch((error) => {
        console.warn('Failed to apply seam decal edits', error);
      });
      return;
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
    const dims = await this.promptForArtDimensions(this.artSizeDraft);
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

  async setArtSizeDraftFromPrompt(kind) {
    const current = kind === 'width' ? this.artSizeDraft.width : this.artSizeDraft.height;
    const raw = await openTextInputOverlay({
      title: kind === 'width' ? 'Canvas Width' : 'Canvas Height',
      label: `${kind === 'width' ? 'Pixel width' : 'Pixel height'} (8-512):`,
      initialValue: String(current),
      inputType: 'int',
      min: 8,
      max: 512
    });
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, 8, 512);
    if (kind === 'width') this.artSizeDraft.width = next;
    else this.artSizeDraft.height = next;
  }

  async promptForArtDimensions(initial = null) {
    const current = initial || this.artSizeDraft || { width: this.canvasState.width, height: this.canvasState.height };
    const raw = await openTextInputOverlay({
      title: 'Set Art Size',
      label: 'Art size (e.g. 32x32, 64x32, 128x256):',
      initialValue: `${current.width}x${current.height}`,
      inputType: 'text'
    });
    if (raw == null) return null;
    const match = String(raw).toLowerCase().match(/(\d+)\s*[x,]\s*(\d+)/);
    if (!match) return null;
    return {
      width: clamp(parseInt(match[1], 10), 8, 512),
      height: clamp(parseInt(match[2], 10), 8, 512)
    };
  }

  async resizeArtDocumentPrompt() {
    const dims = await this.promptForArtDimensions({ width: this.canvasState.width, height: this.canvasState.height });
    if (!dims) return;
    this.artSizeDraft.width = dims.width;
    this.artSizeDraft.height = dims.height;
    this.resizeArtCanvas(dims.width, dims.height);
  }

  openTransformModal(type) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const defaults = {
      resize: { width, height },
      scale: { scaleX: 2, scaleY: 2 },
      crop: { borderX: 1, borderY: 1 },
      offset: { dx: 0, dy: 0, wrap: true }
    };
    this.transformModal = {
      type,
      values: { ...(defaults[type] || {}) },
      bounds: null,
      fields: [],
      buttons: []
    };
  }

  closeTransformModal() {
    this.transformModal = null;
  }

  setTransformValue(key, value, min = -9999, max = 9999) {
    if (!this.transformModal?.values) return;
    const parsed = Number.isFinite(value) ? value : Number(value);
    if (!Number.isFinite(parsed)) return;
    this.transformModal.values[key] = clamp(Math.round(parsed), min, max);
  }

  async editTransformValue(field) {
    if (!this.transformModal || !field) return;
    const current = this.transformModal.values[field.key] ?? field.min;
    const raw = await openTextInputOverlay({
      title: `Set ${field.label}`,
      label: `${field.label} (${field.min}-${field.max})`,
      initialValue: String(Math.round(current)),
      inputType: 'int',
      min: field.min,
      max: field.max
    });
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    this.setTransformValue(field.key, parsed, field.min, field.max);
  }

  applyScaleCanvas(scaleX, scaleY) {
    const sx = clamp(Math.round(scaleX), 1, 16);
    const sy = clamp(Math.round(scaleY), 1, 16);
    if (sx === 1 && sy === 1) return;
    const srcW = this.canvasState.width;
    const srcH = this.canvasState.height;
    const nextW = clamp(srcW * sx, 8, 512);
    const nextH = clamp(srcH * sy, 8, 512);
    this.animation.frames = this.animation.frames.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => {
        const next = createLayer(nextW, nextH, layer.name);
        for (let row = 0; row < nextH; row += 1) {
          for (let col = 0; col < nextW; col += 1) {
            const srcRow = Math.floor(row / sy);
            const srcCol = Math.floor(col / sx);
            next.pixels[row * nextW + col] = layer.pixels[srcRow * srcW + srcCol] || 0;
          }
        }
        return next;
      })
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

  cropCanvas(borderX, borderY) {
    const bx = clamp(Math.round(borderX), 0, 255);
    const by = clamp(Math.round(borderY), 0, 255);
    const srcW = this.canvasState.width;
    const srcH = this.canvasState.height;
    const nextW = clamp(srcW - bx * 2, 1, 512);
    const nextH = clamp(srcH - by * 2, 1, 512);
    if (nextW === srcW && nextH === srcH) return;
    this.animation.frames = this.animation.frames.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => {
        const next = createLayer(nextW, nextH, layer.name);
        for (let row = 0; row < nextH; row += 1) {
          for (let col = 0; col < nextW; col += 1) {
            const srcRow = row + by;
            const srcCol = col + bx;
            if (srcRow < 0 || srcCol < 0 || srcRow >= srcH || srcCol >= srcW) continue;
            next.pixels[row * nextW + col] = layer.pixels[srcRow * srcW + srcCol] || 0;
          }
        }
        return next;
      })
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

  applyTransformModal() {
    if (!this.transformModal) return;
    const { type, values } = this.transformModal;
    this.startHistory(type);
    if (type === 'resize') {
      this.resizeArtCanvas(values.width, values.height);
    } else if (type === 'scale') {
      this.applyScaleCanvas(values.scaleX, values.scaleY);
    } else if (type === 'crop') {
      this.cropCanvas(values.borderX, values.borderY);
    } else if (type === 'offset') {
      this.offsetCanvas(values.dx, values.dy, values.wrap !== false, { recordHistory: false });
    }
    this.commitHistory();
    this.closeTransformModal();
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
    this.uiSliderDrag = null;
    this.gesture = null;
    this.viewportController.cancelInteractions();
    this.selectionContextMenu = null;
    this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
    this.controlsOverlayOpen = false;
    this.menuOpen = false;
    this.paletteGridOpen = false;
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked.clear();
    this.palettePickerDrag = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
  }

  resetFocus() {
    this.ensurePrimaryPaletteSwatches();
    this.setPaletteIndex(0);
    this.secondaryPaletteIndex = Math.min(1, Math.max(0, (this.currentPalette.colors?.length || 1) - 1));
    this.setInputMode('canvas');
    this.clearSelection();
    this.selection.floating = null;
    this.selection.floatingMode = null;
    this.selection.floatingBounds = null;
    this.setActiveTool(TOOL_IDS.PENCIL);
    this.triggerSelectionReady = false;
    if (this.isMobileLayout()) {
      this.mobileDrawer = 'panel';
      this.setLeftPanelTab('draw');
      this.setInputMode('canvas');
    }
  }

  ensurePrimaryPaletteSwatches() {
    const colors = this.currentPalette?.colors;
    if (!Array.isArray(colors)) return;
    const normalized = colors.map((entry) => ({
      ...entry,
      hex: typeof entry?.hex === 'string' ? entry.hex.toLowerCase() : '#000000'
    }));
    const black = normalized.find((entry) => entry.hex === '#000000') || { hex: '#000000' };
    const white = normalized.find((entry) => entry.hex === '#ffffff') || { hex: '#ffffff' };
    const rest = normalized.filter((entry) => entry.hex !== '#000000' && entry.hex !== '#ffffff');
    this.currentPalette.colors = [black, white, ...rest];
  }

  configureSeamFixCloneDefaults() {
    this.setActiveTool(TOOL_IDS.CLONE);
    this.clonePickSourceArmed = true;
    this.cloneSource = null;
    this.cloneOffset = null;
    this.statusMessage = 'Tap canvas to set clone source';
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
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selection.active) {
      this.deleteSelection();
      this.clearSelection();
      event.preventDefault();
      return;
    }
    if (key === 'b') this.setActiveTool(TOOL_IDS.PENCIL);
    if (key === 'e') this.setActiveTool(TOOL_IDS.ERASER);
    if (key === 'g') this.setActiveTool(TOOL_IDS.FILL);
    if (key === 'i') this.setActiveTool(TOOL_IDS.EYEDROPPER);
    if (key === 'c') this.setActiveTool(TOOL_IDS.CURVE);
    if (key === 'v') this.setActiveTool(TOOL_IDS.MOVE);
    if (key === 's') this.setActiveTool(TOOL_IDS.SELECT_RECT);
    if (key === '[') this.setBrushSize(this.toolOptions.brushSize - 1);
    if (key === ']') this.setBrushSize(this.toolOptions.brushSize + 1);
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
    this.applyMobilePanJoystick(dt);
    this.updateCursorPosition();
  }

  applyMobilePanJoystick(dt = 0) {
    if (!this.isMobileLayout() || !this.panJoystick.active) return;
    const frameScale = dt > 0 ? (dt > 5 ? (dt / 16.6667) : (dt * 60)) : 1;
    const speed = 8;
    this.view.panX -= this.panJoystick.dx * speed * frameScale;
    this.view.panY -= this.panJoystick.dy * speed * frameScale;
  }

  syncBrushPickerDraft() {
    this.brushPickerDraft = {
      brushShape: this.toolOptions.brushShape,
      brushSize: this.toolOptions.brushSize,
      brushOpacity: this.toolOptions.brushOpacity,
      brushHardness: this.toolOptions.brushHardness
    };
  }

  openBrushPicker() {
    this.handleToolPointerUp();
    this.cancelLongPress();
    this.syncBrushPickerDraft();
    this.brushPickerDrag = null;
    this.brushPickerOpen = true;
  }

  closeBrushPicker({ apply = false } = {}) {
    if (apply && this.brushPickerDraft) {
      this.toolOptions.brushShape = this.brushPickerDraft.brushShape;
      this.setBrushSize(this.brushPickerDraft.brushSize);
      this.setBrushOpacity(this.brushPickerDraft.brushOpacity);
      this.setBrushHardness(this.brushPickerDraft.brushHardness);
    }
    this.brushPickerOpen = false;
    this.brushPickerDraft = null;
    this.brushPickerDrag = null;
    this.brushPickerSliders = null;
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
            && [TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR, TOOL_IDS.MOVE].includes(this.activeToolId)) {
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
    if (this.transformModal) {
      this.closeTransformModal();
      return;
    }
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
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked.clear();
    this.palettePickerDrag = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
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
    this.setLeftPanelTab('draw');
    this.setInputMode('ui');
    this.uiFocus.group = 'menu';
    this.uiFocus.index = 0;
  }

  closeFileMenu() {
    if (this.isMobileLayout()) {
      this.mobileDrawer = null;
      return;
    }
    this.setLeftPanelTab('draw');
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
    if (tab === 'draw') {
      this.modeTab = 'draw';
      if (![TOOL_IDS.PENCIL, TOOL_IDS.LINE, TOOL_IDS.CURVE, TOOL_IDS.RECT, TOOL_IDS.ELLIPSE, TOOL_IDS.POLYGON, TOOL_IDS.FILL].includes(this.activeToolId)) {
        this.setActiveTool(TOOL_IDS.PENCIL);
      }
    }
    if (tab === 'select') {
      this.modeTab = 'select';
      if (![TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR].includes(this.activeToolId)) {
        this.setActiveTool(TOOL_IDS.SELECT_RECT);
      }
    }
    if (tab === 'tools') {
      this.modeTab = 'draw';
    }
    if (this.isMobileLayout() && ['file', 'draw', 'select', 'tools', 'canvas'].includes(tab)) {
      this.mobileDrawer = 'panel';
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
      { id: TOOL_IDS.CURVE, label: 'Curve' },
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

  updateZoomFromSliderX(pointerX) {
    if (!this.mobileZoomSliderBounds) return;
    const sliderX = this.mobileZoomSliderBounds.x;
    const sliderWidth = this.mobileZoomSliderBounds.w;
    const ratio = clamp((pointerX - sliderX) / Math.max(1, sliderWidth), 0, 1);
    const target = Math.round(ratio * (this.view.zoomLevels.length - 1));
    this.view.zoomIndex = clamp(target, 0, this.view.zoomLevels.length - 1);
  }

  handlePointerDown(payload) {
    const button = payload.button ?? 0;
    if (this.menuOpen || this.controlsOverlayOpen || this.paletteGridOpen || this.selectionContextMenu || this.brushPickerOpen || this.transformModal) {
      this.handleButtonClick(payload.x, payload.y, payload);
      return;
    }
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    if (this.uiSliderDrag && (payload.id === undefined || payload.id === this.uiSliderDrag.id)) {
      this.uiSliderDrag.onDrag?.({ x: payload.x, y: payload.y, id: payload.id });
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
    if (payload.touchCount && this.leftPanelTab === 'tools' && this.toolsListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.toolsListMeta.scrollBounds)
      && this.toolsListMeta.maxScroll > 0) {
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.tools || 0,
        moved: false,
        hitAction: null,
        lineHeight: Math.max(1, this.toolsListMeta.lineHeight || 20),
        scrollGroup: 'tools',
        maxScroll: Math.max(0, this.toolsListMeta.maxScroll || 0)
      };
      return;
    }
    if (payload.touchCount && this.leftPanelTab === 'tools' && this.toolsPanelMeta?.optionsScrollBounds
      && this.isPointInBounds(payload, this.toolsPanelMeta.optionsScrollBounds)
      && this.toolsPanelMeta.maxToolOptionsScroll > 0) {
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.toolOptions || 0,
        moved: false,
        hitAction: null,
        lineHeight: Math.max(1, this.toolsPanelMeta.lineHeight || 20),
        scrollGroup: 'toolOptions',
        maxScroll: Math.max(0, this.toolsPanelMeta.maxToolOptionsScroll || 0)
      };
      return;
    }
    if (this.isMobileLayout() && this.paletteBarScrollBounds
      && this.isPointInBounds(payload, this.paletteBarScrollBounds)
      && (this.paletteBarScrollBounds.maxScroll || 0) > 0) {
      const tappedSwatch = this.paletteBounds.find((bounds) => this.isPointInBounds(payload, bounds));
      this.menuScrollDrag = {
        startX: payload.x,
        startScroll: this.focusScroll.palette || 0,
        moved: false,
        hitAction: tappedSwatch ? () => this.setPaletteIndex(tappedSwatch.index) : null,
        lineHeight: Math.max(1, this.paletteBarScrollBounds.step || 1),
        scrollGroup: 'paletteMobile',
        maxScroll: Math.max(0, this.paletteBarScrollBounds.maxScroll || 0)
      };
      return;
    }
    if (this.paletteGridOpen && this.paletteModalSwatchScrollBounds
      && this.isPointInBounds(payload, this.paletteModalSwatchScrollBounds)
      && (this.paletteModalSwatchScrollBounds.maxScroll || 0) > 0) {
      const tappedSwatch = this.paletteBounds.find((bounds) => this.isPointInBounds(payload, bounds));
      this.menuScrollDrag = {
        startX: payload.x,
        startScroll: this.focusScroll.paletteModal || 0,
        moved: false,
        hitAction: tappedSwatch ? () => this.setPaletteIndex(tappedSwatch.index) : null,
        lineHeight: Math.max(1, this.paletteModalSwatchScrollBounds.step || 1),
        scrollGroup: 'paletteModal',
        maxScroll: Math.max(0, this.paletteModalSwatchScrollBounds.maxScroll || 0)
      };
      return;
    }
    if (this.mobileZoomSliderBounds && this.isPointInBounds(payload, this.mobileZoomSliderBounds)) {
      this.mobileZoomDrag = { id: payload.id ?? null };
      this.updateZoomFromSliderX(payload.x);
      return;
    }
    if (this.isMobileLayout() && this.isPointInCircle(payload.x, payload.y, this.panJoystick.center, this.panJoystick.radius * 1.2)) {
      this.panJoystick.active = true;
      this.panJoystick.id = payload.id ?? null;
      this.updatePanJoystick(payload.x, payload.y);
      return;
    }
    if (this.activeToolId === TOOL_IDS.POLYGON && this.polygonPreview
      && (!this.canvasBounds || !this.isPointInBounds(payload, this.canvasBounds))) {
      this.finishPolygon();
      return;
    }
    if (this.handleButtonClick(payload.x, payload.y, payload)) return;
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
    if (this.transformModal) {
      if (this.transformModal.drag && (payload.id === undefined || payload.id === this.transformModal.drag.id)) {
        const field = this.transformModal.fields?.find((entry) => entry.key === this.transformModal.drag.key);
        if (field) {
          const ratio = clamp((payload.x - field.slider.x) / Math.max(1, field.slider.w), 0, 1);
          const next = field.min + ratio * (field.max - field.min);
          this.setTransformValue(field.key, next, field.min, field.max);
        }
      }
      return;
    }
    if (this.brushPickerOpen) {
      if (this.brushPickerDrag && (payload.id === undefined || payload.id === this.brushPickerDrag.id)) {
        this.updateBrushPickerSliderFromX(this.brushPickerDrag.type, payload.x);
      }
      return;
    }
    if (this.paletteColorPickerOpen) {
      if (this.palettePickerDrag && (payload.id === undefined || payload.id === this.palettePickerDrag.id)) {
        if (this.palettePickerDrag.type === 'sv' && this.palettePickerDrag.bounds) {
          const sv = this.palettePickerDrag.bounds;
          this.paletteColorDraft.s = clamp((payload.x - sv.x) / Math.max(1, sv.w), 0, 1);
          this.paletteColorDraft.v = clamp(1 - (payload.y - sv.y) / Math.max(1, sv.h), 0, 1);
          this.syncPaletteDraftFromHsv();
        } else if (this.palettePickerDrag.type === 'hue' && this.palettePickerDrag.bounds) {
          const hue = this.palettePickerDrag.bounds;
          this.paletteColorDraft.h = clamp((payload.y - hue.y) / Math.max(1, hue.h), 0, 1) * 360;
          this.syncPaletteDraftFromHsv();
        } else {
          this.updatePaletteSliderFromX(this.palettePickerDrag.type, payload.x, this.palettePickerDrag.bounds);
        }
      }
      return;
    }
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    if (this.mobileZoomDrag && (payload.id === undefined || payload.id === this.mobileZoomDrag.id)) {
      this.updateZoomFromSliderX(payload.x);
      return;
    }
    if (this.menuScrollDrag) {
      const dy = payload.y - this.menuScrollDrag.startY;
      const dx = this.menuScrollDrag.startX != null ? payload.x - this.menuScrollDrag.startX : 0;
      if (Math.abs(dy) > 8 || Math.abs(dx) > 8) this.menuScrollDrag.moved = true;
      if (this.menuScrollDrag.moved) {
        const total = (this.focusGroups.file || []).length;
        const maxVisible = this.focusGroupMeta.file?.maxVisible || 1;
        const maxScroll = ['toolOptions', 'tools', 'paletteMobile', 'paletteModal'].includes(this.menuScrollDrag.scrollGroup)
          ? (this.menuScrollDrag.maxScroll || 0)
          : Math.max(0, total - maxVisible);
        const delta = this.menuScrollDrag.scrollGroup === 'paletteMobile' ? dx : dy;
        const next = this.menuScrollDrag.startScroll - Math.round(delta / this.menuScrollDrag.lineHeight);
        if (this.menuScrollDrag.scrollGroup === 'toolOptions') {
          this.focusScroll.toolOptions = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'tools') {
          this.focusScroll.tools = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'paletteMobile') {
          this.focusScroll.palette = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'paletteModal') {
          this.focusScroll.paletteModal = clamp(next, 0, maxScroll);
        } else {
          this.focusScroll.file = clamp(next, 0, maxScroll);
        }
      }
      return;
    }
    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
      this.updatePanJoystick(payload.x, payload.y);
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

  handlePointerUp(payload = {}) {
    if (this.transformModal?.drag && (payload.id === undefined || payload.id === this.transformModal.drag.id)) {
      this.transformModal.drag = null;
    }
    if (this.uiSliderDrag && (payload.id === undefined || payload.id === this.uiSliderDrag.id)) {
      this.uiSliderDrag = null;
    }
    if (this.brushPickerDrag && (payload.id === undefined || payload.id === this.brushPickerDrag.id)) {
      this.brushPickerDrag = null;
    }
    if (this.palettePickerDrag && (payload.id === undefined || payload.id === this.palettePickerDrag.id)) {
      this.palettePickerDrag = null;
    }
    if (this.transformModal) return;
    if (this.brushPickerOpen) return;
    if (this.paletteColorPickerOpen) return;
    if (this.mobileZoomDrag && (payload.id === undefined || payload.id === this.mobileZoomDrag.id)) {
      this.mobileZoomDrag = null;
    }
    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
      this.panJoystick.active = false;
      this.panJoystick.id = null;
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
    }
    if (this.menuScrollDrag) {
      const drag = this.menuScrollDrag;
      this.menuScrollDrag = null;
    this.uiSliderDrag = null;
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
    if (this.leftPanelTab === 'tools' && this.toolsListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.toolsListMeta.scrollBounds)
      && this.toolsListMeta.maxScroll > 0) {
      const delta = payload.deltaY > 0 ? 1 : -1;
      this.focusScroll.tools = clamp(
        (this.focusScroll.tools || 0) + delta,
        0,
        this.toolsListMeta.maxScroll
      );
      return;
    }
    if (this.leftPanelTab === 'tools' && this.toolsPanelMeta?.optionsScrollBounds
      && this.isPointInBounds(payload, this.toolsPanelMeta.optionsScrollBounds)
      && this.toolsPanelMeta.maxToolOptionsScroll > 0) {
      const delta = payload.deltaY > 0 ? 1 : -1;
      this.focusScroll.toolOptions = clamp(
        (this.focusScroll.toolOptions || 0) + delta,
        0,
        this.toolsPanelMeta.maxToolOptionsScroll
      );
      return;
    }
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
    this.linePreview = null;
    this.curvePreview = null;
    this.shapePreview = null;
    this.polygonPreview = null;
    this.gradientPreview = null;
    if (toolId !== TOOL_IDS.CLONE) {
      this.clonePickSourceArmed = false;
      this.cloneColorPickArmed = false;
    }
    if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR, TOOL_IDS.MOVE].includes(toolId)) {
      this.modeTab = 'select';
    } else if (toolId !== TOOL_IDS.EYEDROPPER) {
      this.modeTab = this.modeTab === 'animate' ? 'animate' : 'draw';
    }
    if (!this.menuOpen && !this.controlsOverlayOpen && !this.transformModal && !this.paletteGridOpen && !this.brushPickerOpen) {
      this.setInputMode('canvas');
    }
  }

  setTempTool(source, toolId) {
    this.tempToolOverrides.set(source, toolId);
  }

  clearTempTool(source) {
    this.tempToolOverrides.delete(source);
  }

  getEffectiveToolId() {
    if (this.cloneColorPickArmed) return TOOL_IDS.EYEDROPPER;
    if (this.tempToolOverrides.has('eyedropper')) return TOOL_IDS.EYEDROPPER;
    if (this.tempToolOverrides.has('erase')) return this.tempToolOverrides.get('erase');
    return this.activeToolId;
  }

  toggleDrawSelectMode() {
    if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR, TOOL_IDS.MOVE].includes(this.activeToolId)) {
      this.setActiveTool(TOOL_IDS.PENCIL);
      return;
    }
    this.setActiveTool(this.selection.active ? TOOL_IDS.MOVE : TOOL_IDS.SELECT_RECT);
  }

  resetZoom() {
    this.view.zoomIndex = this.view.zoomLevels.indexOf(16);
    if (this.view.zoomIndex < 0) this.view.zoomIndex = Math.min(this.view.zoomLevels.length - 1, 0);
    this.view.panX = 0;
    this.view.panY = 0;
  }

  zoomToFitCanvas() {
    const viewportW = this.game?.canvas?.width || 0;
    const viewportH = this.game?.canvas?.height || 0;
    if (!viewportW || !viewportH) {
      this.view.zoomIndex = 0;
      this.view.panX = 0;
      this.view.panY = 0;
      return;
    }

    const isMobile = this.isMobileLayout();
    const padding = isMobile ? 12 : 16;
    const topBarHeight = 0;
    const statusHeight = 20;
    const paletteHeight = isMobile ? 64 : 0;
    const toolbarHeight = isMobile ? 72 : 0;
    const mobileZoomReserve = isMobile ? 44 : 0;
    const timelineHeight = !isMobile && this.modeTab === 'animate' ? 120 : 0;
    const bottomHeight = statusHeight + paletteHeight + timelineHeight + toolbarHeight + padding;
    const leftWidth = isMobile ? getSharedMobileRailWidth(viewportW, viewportH) : SHARED_EDITOR_LEFT_MENU.width();
    const rightWidth = 0;
    const mobileDrawerReserveW = isMobile ? getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 }) : 0;

    const canvasW = Math.max(1, viewportW - leftWidth - rightWidth - padding * 2);
    const canvasH = Math.max(1, viewportH - (topBarHeight + padding) - bottomHeight);
    const targetZoom = Math.max(1, Math.floor(Math.min(canvasW / Math.max(1, this.canvasState.width), canvasH / Math.max(1, this.canvasState.height))));

    let zoomIndex = 0;
    for (let i = 0; i < this.view.zoomLevels.length; i += 1) {
      if (this.view.zoomLevels[i] <= targetZoom) zoomIndex = i;
    }
    this.view.zoomIndex = zoomIndex;
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
    let targetPoint = point;
    if (this.toolOptions.wrapDraw) {
      const last = this.strokeState.lastPoint;
      const width = this.canvasState.width;
      const height = this.canvasState.height;
      const deltaCol = point.col - last.col;
      const deltaRow = point.row - last.row;
      const wrappedDeltaCol = Math.abs(deltaCol) > width / 2
        ? deltaCol - Math.sign(deltaCol) * width
        : deltaCol;
      const wrappedDeltaRow = Math.abs(deltaRow) > height / 2
        ? deltaRow - Math.sign(deltaRow) * height
        : deltaRow;
      targetPoint = {
        row: last.row + wrappedDeltaRow,
        col: last.col + wrappedDeltaCol
      };
    }
    const line = bresenhamLine(this.strokeState.lastPoint, targetPoint);
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
    const points = this.createBrushStamp(point);
    const symmetryPoints = applySymmetryPoints(points, width, height, this.toolOptions.symmetry);
    symmetryPoints.forEach((pt) => {
      const row = this.wrapCoord(pt.row, height);
      const col = this.wrapCoord(pt.col, width);
      if (row < 0 || col < 0 || row >= height || col >= width) return;
      if (this.selection.active && this.selection.mask && !this.selection.mask[row * width + col]) return;
      const index = row * width + col;
      const target = this.activeLayer.pixels[index];
      const alpha = (pt.weight ?? 1) * (this.toolOptions.brushOpacity ?? 1);
      if (alpha <= 0) return;
      const strokeMode = this.strokeState?.mode || 'paint';
      if (strokeMode === 'clone') {
        this.applyCloneStroke({ row, col }, alpha);
        return;
      }
      let colorValue = this.getActiveColorValue();
      if (strokeMode === 'erase') colorValue = 0;
      if (strokeMode === 'dither') {
        if (!this.shouldApplyDither(row, col)) return;
      }
      if (this.toolOptions.symmetry?.mirrorOnly && target === colorValue) return;
      this.activeLayer.pixels[index] = alpha >= 1
        ? colorValue
        : this.blendPixel(target, colorValue, alpha);
    });
  }

  doesBrushShapeIncludeOffset(shape, dx, dy, radius) {
    if (shape === 'circle') {
      const maxDist = Math.max(0.5, radius + 0.5);
      return Math.hypot(dx, dy) <= maxDist;
    }
    if (shape === 'diamond') {
      return Math.abs(dx) + Math.abs(dy) <= radius;
    }
    if (shape === 'cross') {
      return dx === 0 || dy === 0;
    }
    if (shape === 'x') {
      return Math.abs(dx) === Math.abs(dy);
    }
    if (shape === 'hline') {
      return dy === 0;
    }
    if (shape === 'vline') {
      return dx === 0;
    }
    return true;
  }

  createBrushStamp(point) {
    const size = this.toolOptions.brushSize;
    const radius = Math.floor(size / 2);
    const points = [];
    const shape = this.toolOptions.brushShape;
    const isSoft = this.toolOptions.brushFalloff === 'soft';
    const hardness = clamp(this.toolOptions.brushHardness ?? 0, 0, 1);
    const maxDist = Math.max(0.5, radius + 0.5);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.doesBrushShapeIncludeOffset(shape, dx, dy, radius)) continue;
        const dist = shape === 'circle' ? Math.hypot(dx, dy) : Math.max(Math.abs(dx), Math.abs(dy));
        let weight = 1;
        if (isSoft || hardness > 0) {
          const edgeT = clamp(dist / maxDist, 0, 1);
          weight = clamp(1 - edgeT * Math.max(hardness, isSoft ? 0.45 : 0), 0, 1);
        }
        points.push({ row: point.row + dy, col: point.col + dx, weight });
      }
    }
    return points;
  }

  blendPixel(dst, src, alpha) {
    const a = clamp(alpha, 0, 1);
    if (a <= 0) return dst;
    if (a >= 1) return src;
    const d = uint32ToRgba(dst);
    const s = uint32ToRgba(src);
    return rgbaToUint32({
      r: Math.round(d.r + (s.r - d.r) * a),
      g: Math.round(d.g + (s.g - d.g) * a),
      b: Math.round(d.b + (s.b - d.b) * a),
      a: Math.round(d.a + (s.a - d.a) * a)
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
    if (this.cloneColorPickArmed) {
      this.cloneColorPickArmed = false;
      this.statusMessage = 'Clone paint mode';
    }
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
    points.forEach((pt) => this.applyBrush(pt));
    this.linePreview = null;
    this.curvePreview = null;
    this.shapePreview = null;
    this.polygonPreview = null;
    this.gradientPreview = null;
    this.commitHistory();
  }



  startCurve(point) {
    if (!this.curvePreview) {
      this.curvePreview = {
        start: point,
        end: point,
        control1: null,
        control2: null,
        phase: 'line',
        dragging: true
      };
      return;
    }
    this.curvePreview.dragging = true;
    if (this.curvePreview.phase === 'control1') this.curvePreview.control1 = point;
    if (this.curvePreview.phase === 'control2') this.curvePreview.control2 = point;
  }

  updateCurve(point) {
    if (!this.curvePreview || !this.curvePreview.dragging) return;
    if (this.curvePreview.phase === 'line') {
      this.curvePreview.end = point;
      return;
    }
    if (this.curvePreview.phase === 'control1') {
      this.curvePreview.control1 = point;
      return;
    }
    if (this.curvePreview.phase === 'control2') {
      this.curvePreview.control2 = point;
    }
  }

  sampleCurvePoints(preview, steps = 64) {
    const p0 = preview.start;
    const p3 = preview.end;
    const p1 = preview.control1 || {
      row: Math.round((p0.row + p3.row) * 0.5),
      col: Math.round((p0.col + p3.col) * 0.5)
    };
    const p2 = preview.control2 || p1;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const mt = 1 - t;
      const col = mt * mt * mt * p0.col
        + 3 * mt * mt * t * p1.col
        + 3 * mt * t * t * p2.col
        + t * t * t * p3.col;
      const row = mt * mt * mt * p0.row
        + 3 * mt * mt * t * p1.row
        + 3 * mt * t * t * p2.row
        + t * t * t * p3.row;
      points.push({ row: Math.round(row), col: Math.round(col) });
    }
    return points;
  }

  commitCurve() {
    if (!this.curvePreview) return;
    if (this.curvePreview.phase === 'line') {
      this.curvePreview.dragging = false;
      this.curvePreview.phase = 'control1';
      this.curvePreview.control1 = {
        row: Math.round((this.curvePreview.start.row + this.curvePreview.end.row) * 0.5),
        col: Math.round((this.curvePreview.start.col + this.curvePreview.end.col) * 0.5)
      };
      this.statusMessage = 'Curve: set weight 1';
      return;
    }
    if (this.curvePreview.phase === 'control1') {
      this.curvePreview.dragging = false;
      this.curvePreview.phase = 'control2';
      this.curvePreview.control2 = { ...this.curvePreview.control1 };
      this.statusMessage = 'Curve: set weight 2';
      return;
    }
    if (!this.activeLayer || this.activeLayer.locked) {
      this.curvePreview = null;
      return;
    }
    this.startHistory('curve');
    const points = this.sampleCurvePoints(this.curvePreview, 96);
    points.forEach((pt) => this.applyBrush(pt));
    this.curvePreview = null;
    this.statusMessage = '';
    this.commitHistory();
  }

  startShape(point, type = 'rect') {
    this.shapePreview = { start: point, end: point, type };
  }

  updateShape(point) {
    if (!this.shapePreview) return;
    this.shapePreview.end = point;
  }

  buildRegularPolygonPoints(bounds, sides) {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const rx = Math.max(1, bounds.w / 2);
    const ry = Math.max(1, bounds.h / 2);
    const total = clamp(Math.round(sides || 5), 3, 12);
    const points = [];
    for (let i = 0; i < total; i += 1) {
      const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
      points.push({ col: Math.round(cx + Math.cos(angle) * rx), row: Math.round(cy + Math.sin(angle) * ry) });
    }
    return points;
  }

  commitShape() {
    if (!this.shapePreview || !this.activeLayer || this.activeLayer.locked) return;
    const bounds = this.getBoundsFromPoints(this.shapePreview.start, this.shapePreview.end);
    let mask = null;
    if (this.shapePreview.type === 'rect') {
      mask = createRectMask(this.canvasState.width, this.canvasState.height, bounds);
    } else if (this.shapePreview.type === 'ellipse') {
      mask = generateEllipseMask(this.canvasState.width, this.canvasState.height, bounds);
    } else {
      const points = this.buildRegularPolygonPoints(bounds, this.toolOptions.polygonSides);
      mask = createPolygonMask(this.canvasState.width, this.canvasState.height, points);
    }
    const fill = Boolean(this.toolOptions.shapeFill);
    this.startHistory(`${this.shapePreview.type} shape`);
    const colorValue = this.getActiveColorValue();
    for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
      for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
        const idx = row * this.canvasState.width + col;
        if (!mask[idx]) continue;
        if (!fill) {
          const left = col > 0 ? mask[idx - 1] : false;
          const right = col < this.canvasState.width - 1 ? mask[idx + 1] : false;
          const up = row > 0 ? mask[idx - this.canvasState.width] : false;
          const down = row < this.canvasState.height - 1 ? mask[idx + this.canvasState.width] : false;
          if (left && right && up && down) continue;
        }
        if (this.selection.active && this.selection.mask && !this.selection.mask[idx]) continue;
        this.activeLayer.pixels[idx] = colorValue;
      }
    }
    this.shapePreview = null;
    this.commitHistory();
  }

  getShapePreviewMask(preview) {
    if (!preview) return { mask: null, bounds: null };
    const bounds = this.getBoundsFromPoints(preview.start, preview.end);
    let mask = null;
    if (preview.type === 'rect') {
      mask = createRectMask(this.canvasState.width, this.canvasState.height, bounds);
    } else if (preview.type === 'ellipse') {
      mask = generateEllipseMask(this.canvasState.width, this.canvasState.height, bounds);
    } else {
      const points = this.buildRegularPolygonPoints(bounds, this.toolOptions.polygonSides);
      mask = createPolygonMask(this.canvasState.width, this.canvasState.height, points);
    }
    return { mask, bounds };
  }

  expandPreviewPoints(points) {
    const unique = new Set();
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const source = Array.isArray(points) ? points : [];
    source.forEach((point) => {
      const stamps = this.createBrushStamp(point);
      const symmetryPoints = applySymmetryPoints(stamps, width, height, this.toolOptions.symmetry);
      symmetryPoints.forEach((pt) => {
        const row = this.wrapCoord(pt.row, height);
        const col = this.wrapCoord(pt.col, width);
        if (row < 0 || col < 0 || row >= height || col >= width) return;
        const idx = row * width + col;
        if (this.selection.active && this.selection.mask && !this.selection.mask[idx]) return;
        unique.add(`${row},${col}`);
      });
    });
    return Array.from(unique, (key) => {
      const [row, col] = key.split(',').map((value) => Number.parseInt(value, 10));
      return { row, col };
    });
  }

  getShapePreviewPoints() {
    if (this.activeToolId === TOOL_IDS.POLYGON) return this.getPolygonPreviewPoints(false);
    if (!this.shapePreview) return [];
    const { mask, bounds } = this.getShapePreviewMask(this.shapePreview);
    if (!mask || !bounds) return [];
    const fill = Boolean(this.toolOptions.shapeFill);
    const points = [];
    for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
      for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
        const idx = row * this.canvasState.width + col;
        if (!mask[idx]) continue;
        if (!fill) {
          const left = col > 0 ? mask[idx - 1] : false;
          const right = col < this.canvasState.width - 1 ? mask[idx + 1] : false;
          const up = row > 0 ? mask[idx - this.canvasState.width] : false;
          const down = row < this.canvasState.height - 1 ? mask[idx + this.canvasState.width] : false;
          if (left && right && up && down) continue;
        }
        if (this.selection.active && this.selection.mask && !this.selection.mask[idx]) continue;
        points.push({ row, col });
      }
    }
    return points;
  }

  drawPixelPreview(ctx, points, offsetX, offsetY, zoom, color = 'rgba(255,225,106,0.75)') {
    if (!Array.isArray(points) || !points.length) return;
    ctx.save();
    ctx.fillStyle = color;
    points.forEach((point) => {
      ctx.fillRect(
        Math.floor(offsetX + point.col * zoom),
        Math.floor(offsetY + point.row * zoom),
        Math.max(1, Math.ceil(zoom)),
        Math.max(1, Math.ceil(zoom))
      );
    });
    ctx.restore();
  }

  getSelectionEdgeSegments() {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return [];
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const bounds = this.selection.bounds;
    const segments = [];
    for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
      for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
        if (row < 0 || col < 0 || row >= height || col >= width) continue;
        const idx = row * width + col;
        if (!this.selection.mask[idx]) continue;
        const top = row === 0 || !this.selection.mask[idx - width];
        const bottom = row === height - 1 || !this.selection.mask[idx + width];
        const left = col === 0 || !this.selection.mask[idx - 1];
        const right = col === width - 1 || !this.selection.mask[idx + 1];
        if (top) segments.push({ x1: col, y1: row, x2: col + 1, y2: row });
        if (bottom) segments.push({ x1: col, y1: row + 1, x2: col + 1, y2: row + 1 });
        if (left) segments.push({ x1: col, y1: row, x2: col, y2: row + 1 });
        if (right) segments.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 });
      }
    }
    return segments;
  }

  drawSelectionMarchingAnts(ctx, offsetX, offsetY, zoom) {
    const segments = this.getSelectionEdgeSegments();
    if (!segments.length) return;
    const dash = Math.max(2, Math.round(zoom * 0.6));
    const speed = (this.lastTime || 0) * 0.02;
    const drawPhase = (strokeStyle, offset) => {
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = Math.max(1, Math.min(2, zoom * 0.2));
      ctx.setLineDash([dash, dash]);
      ctx.lineDashOffset = -(speed + offset);
      ctx.beginPath();
      segments.forEach((segment) => {
        ctx.moveTo(offsetX + segment.x1 * zoom, offsetY + segment.y1 * zoom);
        ctx.lineTo(offsetX + segment.x2 * zoom, offsetY + segment.y2 * zoom);
      });
      ctx.stroke();
      ctx.restore();
    };
    drawPhase('#000', 0);
    drawPhase('#fff', dash);
  }

  startPolygon(point) {
    if (!this.polygonPreview) {
      this.polygonPreview = { points: [point], hover: point };
      return;
    }
    const first = this.polygonPreview.points[0];
    if (first && this.polygonPreview.points.length >= 3
      && Math.abs(point.col - first.col) <= 1
      && Math.abs(point.row - first.row) <= 1) {
      this.finishPolygon();
      return;
    }
    this.polygonPreview.points.push(point);
    this.polygonPreview.hover = point;
  }

  updatePolygon(point) {
    if (!this.polygonPreview) return;
    this.polygonPreview.hover = point;
  }

  commitPolygonSegment() {
    if (!this.polygonPreview) return;
    this.polygonPreview.hover = this.polygonPreview.points[this.polygonPreview.points.length - 1];
  }

  getPolygonPreviewPoints(closeLoop = false) {
    if (!this.polygonPreview?.points?.length) return [];
    const vertices = [...this.polygonPreview.points];
    if (this.polygonPreview.hover) vertices.push(this.polygonPreview.hover);
    const linePoints = [];
    for (let i = 1; i < vertices.length; i += 1) {
      linePoints.push(...bresenhamLine(vertices[i - 1], vertices[i]));
    }
    if (closeLoop && this.polygonPreview.points.length >= 3) {
      linePoints.push(...bresenhamLine(this.polygonPreview.points[this.polygonPreview.points.length - 1], this.polygonPreview.points[0]));
    }
    return this.expandPreviewPoints(linePoints);
  }

  finishPolygon() {
    if (!this.polygonPreview || this.polygonPreview.points.length < 3 || !this.activeLayer || this.activeLayer.locked) return;
    this.startHistory('polygon');
    const points = this.getPolygonPreviewPoints(true);
    points.forEach((pt) => this.applyBrush(pt));
    this.polygonPreview = null;
    this.commitHistory();
  }

  startGradient(point) {
    this.gradientPreview = { start: point, end: point };
  }

  updateGradient(point) {
    if (!this.gradientPreview) return;
    this.gradientPreview.end = point;
  }

  commitGradient() {
    if (!this.gradientPreview || !this.activeLayer || this.activeLayer.locked) return;
    const start = this.gradientPreview.start;
    const end = this.gradientPreview.end;
    const dx = end.col - start.col;
    const dy = end.row - start.row;
    const denom = Math.max(1, dx * dx + dy * dy);
    const baseColor = this.getActiveColorValue();
    this.startHistory('gradient');
    for (let row = 0; row < this.canvasState.height; row += 1) {
      for (let col = 0; col < this.canvasState.width; col += 1) {
        const idx = row * this.canvasState.width + col;
        if (this.selection.active && this.selection.mask && !this.selection.mask[idx]) continue;
        const t = clamp((((col - start.col) * dx) + ((row - start.row) * dy)) / denom, 0, 1);
        const alpha = (this.toolOptions.gradientStrength / 100) * t;
        this.activeLayer.pixels[idx] = this.blendPixel(this.activeLayer.pixels[idx], baseColor, alpha);
      }
    }
    this.gradientPreview = null;
    this.commitHistory();
  }

  applyMagicSelection(point, options = {}) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const contiguous = options.contiguous !== false;
    const threshold = clamp(Number(this.toolOptions.magicThreshold) || 0, 0, 255);
    const composite = compositeLayers(this.canvasState.layers, width, height);
    const startIdx = point.row * width + point.col;
    const targetRgba = uint32ToRgba(composite[startIdx] || 0);
    const mask = new Uint8Array(width * height);

    if (contiguous) {
      const queue = [point];
      const seen = new Uint8Array(width * height);
      while (queue.length) {
        const current = queue.pop();
        if (current.row < 0 || current.col < 0 || current.row >= height || current.col >= width) continue;
        const idx = current.row * width + current.col;
        if (seen[idx]) continue;
        seen[idx] = 1;
        const rgba = uint32ToRgba(composite[idx] || 0);
        const dist = Math.hypot(rgba.r - targetRgba.r, rgba.g - targetRgba.g, rgba.b - targetRgba.b);
        if (dist > threshold) continue;
        mask[idx] = 1;
        queue.push({ row: current.row - 1, col: current.col });
        queue.push({ row: current.row + 1, col: current.col });
        queue.push({ row: current.row, col: current.col - 1 });
        queue.push({ row: current.row, col: current.col + 1 });
      }
    } else {
      for (let idx = 0; idx < composite.length; idx += 1) {
        const rgba = uint32ToRgba(composite[idx] || 0);
        const dist = Math.hypot(rgba.r - targetRgba.r, rgba.g - targetRgba.g, rgba.b - targetRgba.b);
        if (dist <= threshold) mask[idx] = 1;
      }
    }

    this.selection.mask = mask;
    this.selection.bounds = this.getMaskBounds(mask);
    this.selection.active = Boolean(this.selection.bounds);
    this.selection.mode = contiguous ? 'magic-lasso' : 'magic-color';
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

  startLasso(point, options = {}) {
    let snapped = point;
    if (options.magic) {
      this.magicLassoEdgeMap = this.buildMagicLassoEdgeMap();
      this.magicLassoLastVector = null;
      snapped = this.getMagicLassoPoint(point);
      const idx = snapped.row * this.canvasState.width + snapped.col;
      this.magicLassoAnchorRgba = this.magicLassoRgbaMap?.[idx] || null;
    }
    this.selection.active = false;
    this.selection.mask = null;
    this.selection.bounds = null;
    this.selection.mode = options.magic ? 'magic-lasso' : 'lasso';
    this.selection.start = snapped;
    this.selection.end = snapped;
    this.selection.lassoPoints = [{ x: snapped.col + 0.5, y: snapped.row + 0.5 }];
    this.selectionContextMenu = null;
  }

  updateLasso(point, options = {}) {
    if (!this.selection.lassoPoints.length) return;
    const last = this.selection.lassoPoints[this.selection.lassoPoints.length - 1];
    const start = { row: Math.floor(last.y), col: Math.floor(last.x) };
    const snapped = options.magic ? this.getMagicLassoPoint(point, start) : point;
    const segment = options.magic
      ? this.traceMagicLassoSegment(start, snapped)
      : bresenhamLine(start, snapped).slice(1);
    segment.forEach((pt) => {
      const next = { x: pt.col + 0.5, y: pt.row + 0.5 };
      const prior = this.selection.lassoPoints[this.selection.lassoPoints.length - 1];
      if (prior && prior.x === next.x && prior.y === next.y) return;
      this.selection.lassoPoints.push(next);
    });
    if (segment.length) {
      const end = segment[segment.length - 1];
      this.selection.end = { row: end.row, col: end.col };
    } else {
      this.selection.end = snapped;
    }
  }

  buildMagicLassoEdgeMap() {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const composite = compositeLayers(this.canvasState.layers, width, height);
    const rgba = Array.from(composite, (value) => uint32ToRgba(value || 0));
    const edge = new Float32Array(width * height);
    this.magicLassoRgbaMap = rgba;

    const indexAt = (row, col) => row * width + col;
    const diff = (a, b) => {
      if (!a || !b) return 0;
      const colorDelta = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
      const alphaDelta = Math.abs(a.a - b.a);
      return colorDelta + alphaDelta * 3.5;
    };

    let maxEdge = 1;
    for (let row = 1; row < height - 1; row += 1) {
      for (let col = 1; col < width - 1; col += 1) {
        const idx = indexAt(row, col);
        const left = rgba[indexAt(row, col - 1)];
        const right = rgba[indexAt(row, col + 1)];
        const up = rgba[indexAt(row - 1, col)];
        const down = rgba[indexAt(row + 1, col)];
        const upLeft = rgba[indexAt(row - 1, col - 1)];
        const upRight = rgba[indexAt(row - 1, col + 1)];
        const downLeft = rgba[indexAt(row + 1, col - 1)];
        const downRight = rgba[indexAt(row + 1, col + 1)];

        const gx = diff(right, left) + diff(downRight, downLeft) * 0.5 + diff(upRight, upLeft) * 0.5;
        const gy = diff(down, up) + diff(downRight, upRight) * 0.5 + diff(downLeft, upLeft) * 0.5;
        const strength = Math.hypot(gx, gy);
        edge[idx] = strength;
        if (strength > maxEdge) maxEdge = strength;
      }
    }

    this.magicLassoEdgeMax = Math.max(1, maxEdge);
    return edge;
  }

  getMagicLassoPoint(point, origin = null) {
    const edge = this.magicLassoEdgeMap;
    if (!edge) return point;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const threshold = clamp(Number(this.toolOptions.magicThreshold) || 0, 0, 255);
    const radius = clamp(2 + Math.round(threshold / 80), 2, 5);
    const centerRow = clamp(point.row, 0, height - 1);
    const centerCol = clamp(point.col, 0, width - 1);
    let bestRow = centerRow;
    let bestCol = centerCol;
    let bestScore = -Infinity;

    const desiredVec = origin
      ? { x: centerCol - origin.col, y: centerRow - origin.row }
      : null;
    const desiredLen = desiredVec ? Math.hypot(desiredVec.x, desiredVec.y) : 0;

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const row = centerRow + dy;
        const col = centerCol + dx;
        if (row < 0 || col < 0 || row >= height || col >= width) continue;
        const idx = row * width + col;
        const edgeNorm = (edge[idx] || 0) / this.magicLassoEdgeMax;
        const distancePenalty = Math.hypot(dx, dy) * 0.2;
        const candidateRgba = this.magicLassoRgbaMap?.[idx];
        let anchorPenalty = 0;
        if (this.magicLassoAnchorRgba && candidateRgba) {
          const colorDistance = Math.hypot(
            candidateRgba.r - this.magicLassoAnchorRgba.r,
            candidateRgba.g - this.magicLassoAnchorRgba.g,
            candidateRgba.b - this.magicLassoAnchorRgba.b,
            (candidateRgba.a - this.magicLassoAnchorRgba.a) * 1.7
          );
          anchorPenalty = (colorDistance / 255) * 0.35;
        }
        let directionBonus = 0;
        if (origin && desiredLen > 0.001) {
          const dirX = col - origin.col;
          const dirY = row - origin.row;
          const dirLen = Math.hypot(dirX, dirY);
          if (dirLen > 0.001) {
            directionBonus = ((dirX * desiredVec.x) + (dirY * desiredVec.y)) / (dirLen * desiredLen) * 0.22;
          }
        }
        const score = (edgeNorm * 1.5) + directionBonus - distancePenalty - anchorPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
          bestCol = col;
        }
      }
    }

    return { row: bestRow, col: bestCol };
  }

  traceMagicLassoSegment(start, target) {
    const edge = this.magicLassoEdgeMap;
    if (!edge) return bresenhamLine(start, target).slice(1);

    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const threshold = clamp(Number(this.toolOptions.magicThreshold) || 0, 0, 255);
    const padding = clamp(2 + Math.round(threshold / 72), 2, 6);

    const minRow = clamp(Math.min(start.row, target.row) - padding, 0, height - 1);
    const maxRow = clamp(Math.max(start.row, target.row) + padding, 0, height - 1);
    const minCol = clamp(Math.min(start.col, target.col) - padding, 0, width - 1);
    const maxCol = clamp(Math.max(start.col, target.col) + padding, 0, width - 1);

    const nodeCount = width * height;
    const gScore = new Float32Array(nodeCount);
    const cameFrom = new Int32Array(nodeCount);
    const closed = new Uint8Array(nodeCount);
    gScore.fill(Number.POSITIVE_INFINITY);
    cameFrom.fill(-1);

    const startIdx = start.row * width + start.col;
    const targetIdx = target.row * width + target.col;
    gScore[startIdx] = 0;

    const open = [{ idx: startIdx, f: 0 }];
    const inOpen = new Set([startIdx]);

    const rowOf = (idx) => Math.floor(idx / width);
    const colOf = (idx) => idx % width;

    const heuristic = (row, col) => Math.hypot(target.row - row, target.col - col);

    const getStepCost = (fromIdx, toIdx, dx, dy) => {
      const toEdgeNorm = (edge[toIdx] || 0) / this.magicLassoEdgeMax;
      const stepLen = (dx && dy) ? 1.414 : 1;
      const edgePenalty = (1 - toEdgeNorm) * 12;
      const from = cameFrom[fromIdx];
      let turnPenalty = 0;
      if (from >= 0) {
        const pRow = rowOf(from);
        const pCol = colOf(from);
        const aX = colOf(fromIdx) - pCol;
        const aY = rowOf(fromIdx) - pRow;
        const aLen = Math.hypot(aX, aY) || 1;
        const bLen = Math.hypot(dx, dy) || 1;
        const dot = ((aX / aLen) * (dx / bLen)) + ((aY / aLen) * (dy / bLen));
        turnPenalty = (1 - dot) * 0.7;
      } else if (this.magicLassoLastVector) {
        const prev = this.magicLassoLastVector;
        const aLen = Math.hypot(prev.x, prev.y) || 1;
        const bLen = Math.hypot(dx, dy) || 1;
        const dot = ((prev.x / aLen) * (dx / bLen)) + ((prev.y / aLen) * (dy / bLen));
        turnPenalty = (1 - dot) * 0.5;
      }
      let anchorPenalty = 0;
      const candidateRgba = this.magicLassoRgbaMap?.[toIdx];
      if (this.magicLassoAnchorRgba && candidateRgba) {
        const colorDistance = Math.hypot(
          candidateRgba.r - this.magicLassoAnchorRgba.r,
          candidateRgba.g - this.magicLassoAnchorRgba.g,
          candidateRgba.b - this.magicLassoAnchorRgba.b,
          (candidateRgba.a - this.magicLassoAnchorRgba.a) * 1.7
        );
        anchorPenalty = (colorDistance / 255) * 1.6;
      }
      return stepLen * (1 + edgePenalty + turnPenalty + anchorPenalty);
    };

    let found = false;
    let iterations = 0;
    const maxIterations = Math.max(200, (maxRow - minRow + 1) * (maxCol - minCol + 1) * 2);

    while (open.length && iterations < maxIterations) {
      iterations += 1;
      let bestOpenIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (open[i].f < open[bestOpenIndex].f) bestOpenIndex = i;
      }
      const currentNode = open.splice(bestOpenIndex, 1)[0];
      inOpen.delete(currentNode.idx);
      const currentIdx = currentNode.idx;
      if (currentIdx === targetIdx) {
        found = true;
        break;
      }
      if (closed[currentIdx]) continue;
      closed[currentIdx] = 1;

      const currentRow = rowOf(currentIdx);
      const currentCol = colOf(currentIdx);

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const row = currentRow + dy;
          const col = currentCol + dx;
          if (row < minRow || row > maxRow || col < minCol || col > maxCol) continue;
          const neighborIdx = row * width + col;
          if (closed[neighborIdx]) continue;

          const tentative = gScore[currentIdx] + getStepCost(currentIdx, neighborIdx, dx, dy);
          if (tentative >= gScore[neighborIdx]) continue;

          cameFrom[neighborIdx] = currentIdx;
          gScore[neighborIdx] = tentative;
          const f = tentative + heuristic(row, col) * 0.35;
          if (!inOpen.has(neighborIdx)) {
            open.push({ idx: neighborIdx, f });
            inOpen.add(neighborIdx);
          } else {
            for (let i = 0; i < open.length; i += 1) {
              if (open[i].idx === neighborIdx) {
                open[i].f = f;
                break;
              }
            }
          }
        }
      }
    }

    if (!found) {
      return bresenhamLine(start, target).slice(1);
    }

    const reversed = [];
    let walk = targetIdx;
    while (walk >= 0 && walk !== startIdx) {
      reversed.push({ row: rowOf(walk), col: colOf(walk) });
      walk = cameFrom[walk];
      if (walk < 0) break;
    }
    const path = reversed.reverse();
    if (!path.length) return bresenhamLine(start, target).slice(1);

    const last = path[path.length - 1];
    const beforeLast = path.length > 1 ? path[path.length - 2] : start;
    this.magicLassoLastVector = {
      x: last.col - beforeLast.col,
      y: last.row - beforeLast.row
    };
    return path;
  }

  commitLasso() {
    if (this.selection.lassoPoints.length < 3) {
      this.selection.lassoPoints = [];
      this.magicLassoEdgeMap = null;
      this.magicLassoLastVector = null;
      this.magicLassoEdgeMax = 1;
      this.magicLassoRgbaMap = null;
      this.magicLassoAnchorRgba = null;
      return;
    }
    this.selection.mask = createPolygonMask(this.canvasState.width, this.canvasState.height, this.selection.lassoPoints);
    this.selection.bounds = this.getMaskBounds(this.selection.mask);
    this.selection.active = Boolean(this.selection.bounds);
    this.selection.lassoPoints = [];
    this.magicLassoEdgeMap = null;
    this.magicLassoLastVector = null;
    this.magicLassoEdgeMax = 1;
    this.magicLassoRgbaMap = null;
    this.magicLassoAnchorRgba = null;
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
    this.magicLassoEdgeMap = null;
    this.magicLassoLastVector = null;
    this.magicLassoEdgeMax = 1;
    this.magicLassoRgbaMap = null;
    this.magicLassoAnchorRgba = null;
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
    const touchInput = Boolean(modifiers.fromTouch);
    const shouldSetSource = Boolean(modifiers.altKey)
      || (touchInput && (this.clonePickSourceArmed || !this.cloneSource));
    if (shouldSetSource) {
      this.cloneSource = point;
      this.cloneOffset = null;
      this.clonePickSourceArmed = false;
      this.cloneColorPickArmed = false;
      this.statusMessage = touchInput
        ? 'Clone source set. Tap again to paint.'
        : 'Clone source set';
      return;
    }
    if (!this.cloneSource) {
      this.statusMessage = this.isMobileLayout()
        ? 'Tap Set Source, then tap canvas'
        : 'Set clone source with Alt-click first';
      return;
    }
    if (!this.cloneOffset) {
      this.cloneOffset = { row: this.cloneSource.row - point.row, col: this.cloneSource.col - point.col };
    }
    this.startStroke(point, { mode: 'clone' });
  }

  applyClone(point, alpha = 1) {
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
    this.activeLayer.pixels[destIndex] = alpha >= 1
      ? sourcePixels[sourceIndex]
      : this.blendPixel(this.activeLayer.pixels[destIndex], sourcePixels[sourceIndex], alpha);
  }

  applyCloneStroke(point, alpha = 1) {
    if (!this.cloneOffset) return;
    this.applyClone(point, alpha);
  }

  cyclePalette(delta) {
    const count = this.currentPalette.colors.length;
    this.setPaletteIndex((this.paletteIndex + delta + count) % count);
  }

  updatePanJoystick(x, y) {
    const { center, radius } = this.panJoystick;
    if (!radius) {
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    const dx = x - center.x;
    const dy = y - center.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.0001) {
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    const angle = Math.atan2(dy, dx);
    const clamped = Math.min(dist, radius);
    const scaled = clamped / radius;
    this.panJoystick.dx = Math.cos(angle) * scaled;
    this.panJoystick.dy = Math.sin(angle) * scaled;
  }

  setBrushSize(size) {
    this.toolOptions.brushSize = clamp(Math.round(size), BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
  }

  setBrushOpacity(opacity) {
    this.toolOptions.brushOpacity = clamp(opacity, 0.05, 1);
  }

  setBrushHardness(hardness) {
    this.toolOptions.brushHardness = clamp(hardness, 0, 1);
  }

  setBrushSizeFromSlider(x, bounds) {
    if (!bounds || bounds.w <= 0) return;
    const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
    const value = BRUSH_SIZE_MIN + ratio * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
    this.setBrushSize(value);
  }

  cycleBrushShape() {
    const index = BRUSH_SHAPES.indexOf(this.toolOptions.brushShape);
    this.toolOptions.brushShape = BRUSH_SHAPES[(index + 1 + BRUSH_SHAPES.length) % BRUSH_SHAPES.length];
  }

  cycleBrushFalloff() {
    const index = BRUSH_FALLOFFS.indexOf(this.toolOptions.brushFalloff);
    this.toolOptions.brushFalloff = BRUSH_FALLOFFS[(index + 1 + BRUSH_FALLOFFS.length) % BRUSH_FALLOFFS.length];
  }

  setPaletteIndex(index) {
    this.secondaryPaletteIndex = this.paletteIndex;
    this.paletteIndex = index;
    if (!this.paletteGridOpen && !this.paletteColorPickerOpen) {
      this.setInputMode('canvas');
      if (this.isMobileLayout()) this.mobileDrawer = null;
    }
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

  applyPaletteSwatchRemoval() {
    if (!this.paletteRemoveMarked?.size) {
      this.paletteRemoveMode = false;
      return;
    }
    const marked = Array.from(this.paletteRemoveMarked).sort((a, b) => b - a);
    marked.forEach((index) => {
      if (this.currentPalette.colors.length <= 1) return;
      if (index < 0 || index >= this.currentPalette.colors.length) return;
      this.currentPalette.colors.splice(index, 1);
    });
    this.paletteIndex = clamp(this.paletteIndex, 0, this.currentPalette.colors.length - 1);
    this.paletteRemoveMarked.clear();
    this.paletteRemoveMode = false;
  }


  rgbToHsv(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max <= 0 ? 0 : (d / max);
    const v = max;
    return { h, s, v };
  }

  hsvToRgb(h, s, v) {
    const hh = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = v - c;
    let rn = 0; let gn = 0; let bn = 0;
    if (hh < 60) { rn = c; gn = x; bn = 0; }
    else if (hh < 120) { rn = x; gn = c; bn = 0; }
    else if (hh < 180) { rn = 0; gn = c; bn = x; }
    else if (hh < 240) { rn = 0; gn = x; bn = c; }
    else if (hh < 300) { rn = x; gn = 0; bn = c; }
    else { rn = c; gn = 0; bn = x; }
    return {
      r: Math.round((rn + m) * 255),
      g: Math.round((gn + m) * 255),
      b: Math.round((bn + m) * 255)
    };
  }

  rgbToHex(r, g, b) {
    return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
  }

  openPaletteColorPicker() {
    const activeHex = this.currentPalette.colors[this.paletteIndex]?.hex || '#ffffff';
    const rgba = hexToRgba(activeHex);
    const hsv = this.rgbToHsv(rgba.r, rgba.g, rgba.b);
    this.paletteColorDraft = { h: hsv.h, s: hsv.s, v: hsv.v, r: rgba.r, g: rgba.g, b: rgba.b, quantization: 32 };
    this.palettePickerDrag = null;
    this.paletteColorPickerOpen = true;
  }

  quantizeChannel(value, levels = 32) {
    const steps = clamp(Math.round(levels), 2, 256);
    const t = clamp(value, 0, 255) / 255;
    return Math.round((Math.round(t * (steps - 1)) / (steps - 1)) * 255);
  }

  applyPaletteDraftQuantization() {
    if (!this.paletteColorDraft) return;
    const levels = this.paletteColorDraft.quantization || 32;
    this.paletteColorDraft.r = this.quantizeChannel(this.paletteColorDraft.r, levels);
    this.paletteColorDraft.g = this.quantizeChannel(this.paletteColorDraft.g, levels);
    this.paletteColorDraft.b = this.quantizeChannel(this.paletteColorDraft.b, levels);
  }

  syncPaletteDraftFromHsv() {
    if (!this.paletteColorDraft) return;
    const rgb = this.hsvToRgb(this.paletteColorDraft.h, this.paletteColorDraft.s, this.paletteColorDraft.v);
    this.paletteColorDraft.r = rgb.r;
    this.paletteColorDraft.g = rgb.g;
    this.paletteColorDraft.b = rgb.b;
    this.applyPaletteDraftQuantization();
  }

  syncPaletteDraftFromRgb() {
    if (!this.paletteColorDraft) return;
    this.applyPaletteDraftQuantization();
    const hsv = this.rgbToHsv(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b);
    this.paletteColorDraft.h = hsv.h;
    this.paletteColorDraft.s = hsv.s;
    this.paletteColorDraft.v = hsv.v;
  }

  updatePaletteSliderFromX(type, pointerX, bounds) {
    if (!this.paletteColorDraft || !bounds) return;
    const t = clamp((pointerX - bounds.x) / Math.max(1, bounds.w), 0, 1);
    if (type === 'h') {
      this.paletteColorDraft.h = t * 360;
      this.syncPaletteDraftFromHsv();
      return;
    }
    if (type === 's') {
      this.paletteColorDraft.s = t;
      this.syncPaletteDraftFromHsv();
      return;
    }
    if (type === 'v') {
      this.paletteColorDraft.v = t;
      this.syncPaletteDraftFromHsv();
      return;
    }
    if (type === 'r') this.paletteColorDraft.r = Math.round(t * 255);
    if (type === 'g') this.paletteColorDraft.g = Math.round(t * 255);
    if (type === 'b') this.paletteColorDraft.b = Math.round(t * 255);
    this.syncPaletteDraftFromRgb();
  }

  async editPaletteSliderValue(type) {
    if (!this.paletteColorDraft) return;
    const meta = {
      h: { label: 'Hue (0-360)', min: 0, max: 360, value: this.paletteColorDraft.h, kind: 'hsv' },
      s: { label: 'Saturation (0-100)', min: 0, max: 100, value: this.paletteColorDraft.s * 100, kind: 'hsv' },
      v: { label: 'Value (0-100)', min: 0, max: 100, value: this.paletteColorDraft.v * 100, kind: 'hsv' },
      r: { label: 'Red (0-255)', min: 0, max: 255, value: this.paletteColorDraft.r, kind: 'rgb' },
      g: { label: 'Green (0-255)', min: 0, max: 255, value: this.paletteColorDraft.g, kind: 'rgb' },
      b: { label: 'Blue (0-255)', min: 0, max: 255, value: this.paletteColorDraft.b, kind: 'rgb' }
    }[type];
    if (!meta) return;
    const raw = await openTextInputOverlay({
      title: `Set ${meta.label.split(' ')[0]}`,
      label: meta.label,
      initialValue: String(Math.round(meta.value)),
      inputType: meta.kind === 'hsv' ? 'float' : 'int',
      min: meta.min,
      max: meta.max
    });
    if (raw == null) return;
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, meta.min, meta.max);
    if (type === 'h') this.paletteColorDraft.h = next;
    if (type === 's') this.paletteColorDraft.s = next / 100;
    if (type === 'v') this.paletteColorDraft.v = next / 100;
    if (type === 'r') this.paletteColorDraft.r = Math.round(next);
    if (type === 'g') this.paletteColorDraft.g = Math.round(next);
    if (type === 'b') this.paletteColorDraft.b = Math.round(next);
    if (meta.kind === 'hsv') this.syncPaletteDraftFromHsv();
    else this.syncPaletteDraftFromRgb();
  }

  async editPaletteHexValue() {
    if (!this.paletteColorDraft) return;
    const fallback = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b).toUpperCase();
    const raw = await openTextInputOverlay({
      title: 'Hex Color',
      label: 'Hex color (#RRGGBB):',
      initialValue: fallback,
      inputType: 'text'
    });
    if (raw == null) return;
    let next = raw.trim();
    if (!next) return;
    if (!next.startsWith('#')) next = `#${next}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
    const rgba = hexToRgba(next);
    this.paletteColorDraft.r = rgba.r;
    this.paletteColorDraft.g = rgba.g;
    this.paletteColorDraft.b = rgba.b;
    this.syncPaletteDraftFromRgb();
  }

  applyPaletteColorPickerAdd() {
    if (!this.paletteColorDraft) return;
    const hex = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b);
    this.currentPalette.colors.push({
      id: `color-${Date.now()}`,
      hex,
      rgba: { ...hexToRgba(hex), a: 255 }
    });
    this.paletteIndex = this.currentPalette.colors.length - 1;
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked.clear();
    this.palettePickerDrag = null;
    this.paletteColorPickerBounds = null;
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

  offsetCanvas(dx, dy, wrap = true, options = {}) {
    const recordHistory = options.recordHistory !== false;
    if (recordHistory) this.startHistory('offset');
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
    if (recordHistory) this.commitHistory();
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

  isPointInCircle(x, y, center, radius) {
    if (!center || !radius) return false;
    return Math.hypot(x - center.x, y - center.y) <= radius;
  }

  isPointInBounds(point, bounds) {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.w
      && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
  }

  getGridCellFromScreen(x, y) {
    if (!this.canvasBounds) return null;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    let col = Math.floor((x - startX) / cellSize);
    let row = Math.floor((y - startY) / cellSize);
    if (this.toolOptions.wrapDraw) {
      col = ((col % this.canvasState.width) + this.canvasState.width) % this.canvasState.width;
      row = ((row % this.canvasState.height) + this.canvasState.height) % this.canvasState.height;
      return { row, col };
    }
    if (col < 0 || row < 0 || col >= this.canvasState.width || row >= this.canvasState.height) return null;
    return { row, col };
  }

  getScreenFromGridCell(row, col) {
    if (!this.canvasBounds) return null;
    const { mainX, mainY, x: startX, y: startY, cellSize } = this.canvasBounds;
    const originX = Number.isFinite(mainX) ? mainX : startX;
    const originY = Number.isFinite(mainY) ? mainY : startY;
    return {
      x: originX + col * cellSize + cellSize / 2,
      y: originY + row * cellSize + cellSize / 2
    };
  }

  handleButtonClick(x, y, payload = {}) {
    if (this.transformModal) {
      if (this.transformModal.bounds && !this.isPointInBounds({ x, y }, this.transformModal.bounds)) {
        this.closeTransformModal();
        return true;
      }
      const sliderHit = (this.transformModal.fields || []).find((field) => this.isPointInBounds({ x, y }, field.sliderHitBounds || field.slider));
      if (sliderHit) {
        const ratio = clamp((x - sliderHit.slider.x) / Math.max(1, sliderHit.slider.w), 0, 1);
        const next = sliderHit.min + ratio * (sliderHit.max - sliderHit.min);
        this.setTransformValue(sliderHit.key, next, sliderHit.min, sliderHit.max);
        this.transformModal.drag = { key: sliderHit.key, id: payload.id ?? null };
        return true;
      }
      const valueHit = (this.transformModal.fields || []).find((field) => field.valueBounds && this.isPointInBounds({ x, y }, field.valueBounds));
      if (valueHit) {
        this.editTransformValue(valueHit);
        return true;
      }
      const buttonHit = (this.transformModal.buttons || []).find((entry) => this.isPointInBounds({ x, y }, entry.bounds));
      if (buttonHit) {
        buttonHit.onClick?.();
        return true;
      }
      return true;
    }
    if (this.paletteGridOpen) {
      const activeBounds = this.paletteColorPickerOpen ? this.paletteColorPickerBounds : this.paletteModalBounds;
      if (activeBounds && !this.isPointInBounds({ x, y }, activeBounds)) {
        return true;
      }
    }
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
      hit.onClick?.({ x, y, id: payload.id });
      if (hit.onDrag) {
        this.uiSliderDrag = { id: payload.id ?? null, onDrag: hit.onDrag };
        hit.onDrag({ x, y, id: payload.id });
      }
      return true;
    }
    if (this.brushPickerOpen && this.brushPickerBounds && !this.isPointInBounds({ x, y }, this.brushPickerBounds)) {
      this.closeBrushPicker({ apply: false });
      return true;
    }
    if (this.mobileDrawer && this.mobileDrawerBounds && !this.isPointInBounds({ x, y }, this.mobileDrawerBounds)) {
      this.mobileDrawer = null;
      // Allow the same tap to continue onto canvas interactions instead of requiring a second tap.
      if (this.canvasBounds && this.isPointInBounds({ x, y }, this.canvasBounds)) {
        return false;
      }
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
      if (this.paletteGridOpen && this.paletteRemoveMode) {
        if (this.paletteRemoveMarked.has(paletteHit.index)) this.paletteRemoveMarked.delete(paletteHit.index);
        else this.paletteRemoveMarked.add(paletteHit.index);
      } else {
        this.setPaletteIndex(paletteHit.index);
      }
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
    const mobileZoomReserve = isMobile ? 44 : 0;
    const timelineHeight = !isMobile && this.modeTab === 'animate' ? 120 : 0;
    const bottomHeight = menuFullScreen
      ? padding * 2
      : statusHeight + paletteHeight + timelineHeight + toolbarHeight + mobileZoomReserve + padding;
    const leftFrame = !isMobile && this.sidebars.left && !menuFullScreen
      ? buildSharedDesktopLeftPanelFrame({ viewportWidth: width, viewportHeight: height })
      : null;
    const leftWidth = isMobile
      ? getSharedMobileRailWidth(width, height)
      : (leftFrame ? leftFrame.panelW : (this.sidebars.left ? SHARED_EDITOR_LEFT_MENU.width() : 0));
    const rightWidth = 0;
    const mobileDrawerReserveW = isMobile ? getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 }) : 0;

    this.uiButtons = [];
    this.paletteBounds = [];
    this.layerBounds = [];
    this.frameBounds = [];
    this.focusGroups = {};
    this.focusGroupMeta = {};
    this.mobileDrawerBounds = null;
    this.paletteBarScrollBounds = null;
    this.paletteModalSwatchScrollBounds = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
    this.brushPickerBounds = null;
    this.brushPickerSliders = null;

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
      const paletteX = isMobile ? canvasX : padding;
      const paletteW = isMobile
        ? Math.max(120, width - paletteX - padding - mobileDrawerReserveW)
        : (width - padding * 2);
      this.drawPaletteBar(ctx, paletteX, paletteY, paletteW, paletteHeight, { isMobile });
    }
    const statusY = paletteY + (paletteHeight > 0 ? paletteHeight + 6 : 0);
    if (!menuFullScreen && !isMobile) {
      this.drawStatusBar(ctx, padding, statusY, width - padding * 2, statusHeight);
    }

    if (!menuFullScreen && !isMobile && this.modeTab === 'animate') {
      const timelineY = statusY + statusHeight + 6;
      this.drawTimeline(ctx, canvasX, timelineY, canvasW, timelineHeight);
    }

    if (isMobile) {
      const toolbarY = height - toolbarHeight - padding - mobileZoomReserve;
      this.drawMobileToolbar(ctx, canvasX, toolbarY, Math.max(120, width - canvasX - padding - mobileDrawerReserveW), toolbarHeight);
      this.drawMobilePanZoomControls(ctx, width, height);
      if (this.mobileDrawer && this.mobileDrawer !== 'timeline') {
        const drawerW = getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 });
        const drawerX = width - drawerW;
        this.drawMobileDrawer(ctx, drawerX, 0, drawerW, height, this.mobileDrawer);
      }
      if (this.brushPickerOpen) {
        this.drawBrushPickerModal(ctx, padding, canvasY + Math.max(24, canvasH * 0.08), width - padding * 2, Math.min(canvasH * 0.82, height - toolbarHeight - padding * 2));
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

    if (this.transformModal) {
      this.drawTransformModal(ctx, width, height);
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

  drawTransformModal(ctx, width, height) {
    if (!this.transformModal) return;
    const modalW = Math.min(420, Math.max(280, width * 0.45));
    const modalH = Math.min(290, Math.max(220, height * 0.42));
    const modal = {
      x: Math.floor((width - modalW) / 2),
      y: Math.floor((height - modalH) / 2),
      w: Math.floor(modalW),
      h: Math.floor(modalH)
    };
    this.transformModal.bounds = modal;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(modal.x, modal.y, modal.w, modal.h);
    ctx.strokeStyle = '#ffe16a';
    ctx.strokeRect(modal.x, modal.y, modal.w, modal.h);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    const title = this.transformModal.type[0].toUpperCase() + this.transformModal.type.slice(1);
    ctx.fillText(`${title} Canvas`, modal.x + 12, modal.y + 22);

    const rowsByType = {
      resize: [
        { key: 'width', label: 'Width', min: 8, max: 512 },
        { key: 'height', label: 'Height', min: 8, max: 512 }
      ],
      scale: [
        { key: 'scaleX', label: 'Scale X', min: 1, max: 16 },
        { key: 'scaleY', label: 'Scale Y', min: 1, max: 16 }
      ],
      crop: [
        { key: 'borderX', label: 'Border X', min: 0, max: Math.max(0, Math.floor((this.canvasState.width - 1) / 2)) },
        { key: 'borderY', label: 'Border Y', min: 0, max: Math.max(0, Math.floor((this.canvasState.height - 1) / 2)) }
      ],
      offset: [
        { key: 'dx', label: 'Shift X', min: -this.canvasState.width, max: this.canvasState.width },
        { key: 'dy', label: 'Shift Y', min: -this.canvasState.height, max: this.canvasState.height }
      ]
    };
    const rows = rowsByType[this.transformModal.type] || [];
    this.transformModal.fields = [];

    let rowY = modal.y + 50;
    rows.forEach((row) => {
      const valueW = 52;
      const slider = { x: modal.x + 108, y: rowY - 12, w: Math.max(40, modal.w - 190), h: 18 };
      const sliderHitBounds = { x: slider.x - 6, y: slider.y - 10, w: slider.w + 12, h: slider.h + 20 };
      const valueBounds = { x: slider.x + slider.w + 8, y: rowY - 12, w: valueW, h: 18 };
      const value = this.transformModal.values[row.key] ?? row.min;
      const t = clamp((value - row.min) / Math.max(1, row.max - row.min), 0, 1);
      const knobX = slider.x + t * slider.w;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      ctx.fillText(row.label, modal.x + 12, rowY);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(slider.x, slider.y, slider.w, slider.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(knobX - 2, slider.y - 2, 4, slider.h + 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(value)), valueBounds.x + valueBounds.w - 6, rowY + 1);
      ctx.textAlign = 'left';
      this.transformModal.fields.push({ ...row, slider, sliderHitBounds, valueBounds });
      rowY += 38;
    });

    if (this.transformModal.type === 'offset') {
      const wrapBounds = { x: modal.x + 12, y: rowY - 12, w: 110, h: 20 };
      const wrap = this.transformModal.values.wrap !== false;
      this.drawButton(ctx, wrapBounds, wrap ? 'Wrap: On' : 'Wrap: Off', wrap, { fontSize: 12 });
      this.uiButtons.push({ bounds: wrapBounds, onClick: () => { this.transformModal.values.wrap = !wrap; } });
      this.registerFocusable('menu', wrapBounds, () => { this.transformModal.values.wrap = !wrap; });
      rowY += 28;
    }

    const cancelBounds = { x: modal.x + modal.w - 180, y: modal.y + modal.h - 34, w: 80, h: 24 };
    const okBounds = { x: modal.x + modal.w - 92, y: modal.y + modal.h - 34, w: 80, h: 24 };
    this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
    this.drawButton(ctx, okBounds, 'Apply', true, { fontSize: 12 });
    this.transformModal.buttons = [
      { bounds: cancelBounds, onClick: () => this.closeTransformModal() },
      { bounds: okBounds, onClick: () => this.applyTransformModal() }
    ];
    this.uiButtons.push({ bounds: cancelBounds, onClick: () => this.closeTransformModal() });
    this.uiButtons.push({ bounds: okBounds, onClick: () => this.applyTransformModal() });
    this.registerFocusable('menu', cancelBounds, () => this.closeTransformModal());
    this.registerFocusable('menu', okBounds, () => this.applyTransformModal());
    ctx.restore();
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
      draw: 'Draw',
      select: 'Select',
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
    this.drawLeftPanelContent(ctx, content.x, content.y, content.w, content.h, options);
  }

  drawLeftPanelContent(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    if (this.leftPanelTab === 'file') {
      this.drawFilePanel(ctx, x, y, w, h, { isMobile });
      return;
    }
    if (['draw', 'select', 'tools'].includes(this.leftPanelTab)) {
      this.drawToolsMenu(ctx, x, y, w, h, { isMobile, category: this.leftPanelTab });
      return;
    }
    if (this.leftPanelTab === 'canvas') {
      this.drawSwitchesPanel(ctx, x, y, w, h, { isMobile });
      return;
    }
  }

  drawToolsMenu(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const category = options.category || this.leftPanelTab || 'draw';
    if (isMobile) {
      this.drawToolsPanel(ctx, x, y, w, h, { isMobile, category });
      return;
    }
    const gap = 12;
    const colWidth = Math.max(160, Math.floor((w - gap) / 2));
    const leftX = x;
    const rightX = x + colWidth + gap;
    const columnHeight = h;
    this.drawToolsPanel(ctx, leftX, y, colWidth, columnHeight, { isMobile, category });
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
        ...(this.decalEditSession ? [
          { id: 'save-decal-session', label: 'Save Changes', onClick: () => this.saveDecalSessionAndReturn() },
          { id: 'abandon-decal-session', label: 'Abandon Changes', onClick: () => this.abandonDecalSessionAndReturn() }
        ] : []),
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
    const cloneOffsetText = this.activeToolId === TOOL_IDS.CLONE && this.cloneOffset
      ? ` | Clone Δ ${this.cloneOffset.col >= 0 ? '+' : ''}${this.cloneOffset.col},${this.cloneOffset.row >= 0 ? '+' : ''}${this.cloneOffset.row}`
      : '';
    const statusText = `Tool ${this.getEffectiveToolId()} | Brush ${this.toolOptions.brushSize}px | Color ${getPaletteSwatchHex(this.currentPalette, this.paletteIndex)} | Layer ${this.canvasState.activeLayerIndex + 1}/${this.canvasState.layers.length} | Frame ${this.animation.currentFrameIndex + 1}/${this.animation.frames.length} | Zoom ${zoomPercent}% | Cursor ${this.cursor.col},${this.cursor.row}${cloneOffsetText}`;
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
      { id: 'draw', label: 'Draw', action: () => { this.setLeftPanelTab('draw'); this.mobileDrawer = 'panel'; } },
      { id: 'select', label: 'Select', action: () => { this.setLeftPanelTab('select'); this.mobileDrawer = 'panel'; } },
      { id: 'tools', label: 'Tools', action: () => { this.setLeftPanelTab('tools'); this.mobileDrawer = 'panel'; } },
      { id: 'canvas', label: 'Canvas', action: () => { this.setLeftPanelTab('canvas'); this.mobileDrawer = 'panel'; } }
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

    const buttonH = h - 16;
    const buttonY = y + 8;
    const gap = 6;
    const brushBounds = { x: x + 8, y: buttonY, w: 84, h: buttonH };
    this.drawButton(ctx, brushBounds, 'Brush', this.brushPickerOpen, { fontSize: 12 });
    this.uiButtons.push({ bounds: brushBounds, onClick: () => this.openBrushPicker() });
    this.registerFocusable('toolbar', brushBounds, () => this.openBrushPicker());

    const previewSize = Math.min(48, Math.max(34, buttonH));
    const previewBounds = {
      x: brushBounds.x + brushBounds.w + gap,
      y: y + Math.floor((h - previewSize) / 2),
      w: previewSize,
      h: previewSize
    };
    this.drawBrushPreviewChip(ctx, previewBounds);

    const actions = [];
    if (this.activeToolId === TOOL_IDS.CLONE) {
      actions.push(
        {
          label: this.cloneColorPickArmed ? 'Clr✓' : 'Clr',
          action: () => {
            this.cloneColorPickArmed = !this.cloneColorPickArmed;
            this.statusMessage = this.cloneColorPickArmed ? 'Clone eyedropper mode' : 'Clone paint mode';
          },
          active: this.cloneColorPickArmed
        },
        {
          label: this.clonePickSourceArmed ? 'Src✓' : 'Src',
          action: () => {
            this.clonePickSourceArmed = !this.clonePickSourceArmed;
            this.cloneColorPickArmed = false;
            this.statusMessage = this.clonePickSourceArmed ? 'Tap canvas to set clone source' : 'Clone paint mode';
          },
          active: this.clonePickSourceArmed
        }
      );
    }
    actions.push(
      { label: 'Undo', action: () => this.runtime.undo() },
      { label: 'Redo', action: () => this.runtime.redo() }
    );

    const actionAreaStartX = previewBounds.x + previewBounds.w + gap;
    const availableW = Math.max(120, x + w - 8 - actionAreaStartX);
    const buttonW = Math.max(52, Math.min(90, Math.floor((availableW - gap * Math.max(0, actions.length - 1)) / Math.max(1, actions.length))));
    let currentX = x + w - 8 - buttonW;
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const entry = actions[index];
      const bounds = {
        x: currentX,
        y: buttonY,
        w: buttonW,
        h: buttonH
      };
      this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('toolbar', bounds, (entry.onClick || entry.action));
      currentX -= buttonW + gap;
      if (currentX < actionAreaStartX) break;
    }
  }

  drawMobilePanZoomControls(ctx, width, height) {
    if (!this.isMobileLayout()) {
      this.mobileZoomSliderBounds = null;
      this.panJoystick.center = { x: 0, y: 0 };
      this.panJoystick.radius = 0;
      this.panJoystick.knobRadius = 0;
      return;
    }
    const controlMargin = 18;
    const controlBase = Math.min(width, height);
    const joystickRadius = Math.min(78, controlBase * 0.14);
    const knobRadius = Math.max(22, joystickRadius * 0.45);
    const joystickCenter = {
      x: controlMargin + joystickRadius,
      y: height - controlMargin - joystickRadius
    };
    this.panJoystick.center = joystickCenter;
    this.panJoystick.radius = joystickRadius;
    this.panJoystick.knobRadius = knobRadius;

    let sliderX = joystickCenter.x + joystickRadius + 24;
    const sliderRightPadding = Math.max(controlMargin + 132, width * 0.2);
    let sliderWidth = width - sliderX - sliderRightPadding;
    const sliderHeight = 10;
    const sliderY = height - controlMargin - sliderHeight;
    if (sliderWidth < 140) {
      sliderX = controlMargin;
      sliderWidth = Math.max(140, width - controlMargin * 2 - 132);
    }
    this.mobileZoomSliderBounds = { x: sliderX, y: sliderY - 14, w: sliderWidth, h: sliderHeight + 28 };

    const zoomT = this.view.zoomIndex / Math.max(1, this.view.zoomLevels.length - 1);
    const knobX = sliderX + zoomT * sliderWidth;
    const centerY = sliderY + sliderHeight / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.44)';
    ctx.strokeRect(sliderX, sliderY, sliderWidth, sliderHeight);
    ctx.fillStyle = 'rgba(0,200,255,0.95)';
    ctx.beginPath();
    ctx.arc(knobX, centerY, Math.max(5, sliderHeight * 0.75), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.stroke();

    const joystickKnobX = joystickCenter.x + this.panJoystick.dx * joystickRadius;
    const joystickKnobY = joystickCenter.y + this.panJoystick.dy * joystickRadius;
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

    this.uiButtons.push({
      bounds: this.mobileZoomSliderBounds,
      onClick: ({ x: pointerX }) => {
        this.updateZoomFromSliderX(pointerX);
      }
    });
  }

  drawBrushPreviewChip(ctx, bounds) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    const radius = Math.max(1, Math.floor(this.toolOptions.brushSize / 2));
    const centerX = Math.floor(bounds.x + bounds.w / 2);
    const centerY = Math.floor(bounds.y + bounds.h / 2);
    const scale = Math.max(1, Math.floor(Math.min(bounds.w, bounds.h) / Math.max(3, radius * 2 + 1)));
    const shape = this.toolOptions.brushShape;
    ctx.fillStyle = '#000';
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.doesBrushShapeIncludeOffset(shape, dx, dy, radius)) continue;
        const px = centerX + dx * scale - Math.floor(scale / 2);
        const py = centerY + dy * scale - Math.floor(scale / 2);
        ctx.fillRect(px, py, scale, scale);
      }
    }
  }



  updateBrushPickerSliderFromX(type, pointerX) {
    if (!this.brushPickerDraft || !this.brushPickerSliders) return;
    const bounds = this.brushPickerSliders[type];
    if (!bounds) return;
    const t = clamp((pointerX - bounds.x) / Math.max(1, bounds.w), 0, 1);
    if (type === 'size') {
      this.brushPickerDraft.brushSize = BRUSH_SIZE_MIN + t * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
    } else if (type === 'opacity') {
      this.brushPickerDraft.brushOpacity = 0.05 + t * 0.95;
    } else if (type === 'hardness') {
      this.brushPickerDraft.brushHardness = t;
    }
  }

  drawBrushShapePreview(ctx, bounds, shape, size = 7) {
    const radius = Math.max(1, Math.floor(size / 2));
    const centerX = Math.floor(bounds.x + bounds.w / 2);
    const centerY = Math.floor(bounds.y + bounds.h / 2);
    const scale = Math.max(1, Math.floor(Math.min(bounds.w, bounds.h) / Math.max(3, radius * 2 + 1)));
    ctx.fillStyle = '#fff';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#000';
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.doesBrushShapeIncludeOffset(shape, dx, dy, radius)) continue;
        const px = centerX + dx * scale - Math.floor(scale / 2);
        const py = centerY + dy * scale - Math.floor(scale / 2);
        ctx.fillRect(px, py, scale, scale);
      }
    }
  }

  drawBrushPickerModal(ctx, x, y, w, h) {
    const modal = {
      x: x + Math.max(0, Math.floor((w - Math.min(w, 520)) / 2)),
      y,
      w: Math.min(w, 520),
      h: Math.max(240, h)
    };
    this.brushPickerBounds = modal;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(modal.x, modal.y, modal.w, modal.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(modal.x, modal.y, modal.w, modal.h);

    const titleY = modal.y + 20;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = '12px monospace';
    ctx.fillText('Brushes', modal.x + 12, titleY);

    const cols = 4;
    const rowGap = 8;
    const cellGap = 8;
    const gridY = titleY + 10;
    const footerH = 114;
    const gridH = Math.max(90, modal.h - footerH - 34);
    const rows = Math.ceil(BRUSH_SHAPES.length / cols);
    const cellW = Math.floor((modal.w - 24 - (cols - 1) * cellGap) / cols);
    const cellH = Math.max(34, Math.floor((gridH - Math.max(0, rows - 1) * rowGap) / Math.max(1, rows)));
    const draft = this.brushPickerDraft || this.toolOptions;

    BRUSH_SHAPES.forEach((shape, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const bounds = {
        x: modal.x + 12 + col * (cellW + cellGap),
        y: gridY + row * (cellH + rowGap),
        w: cellW,
        h: cellH
      };
      const active = draft.brushShape === shape;
      this.drawButton(ctx, bounds, '', active, { fontSize: 11 });
      const previewPad = 8;
      this.drawBrushShapePreview(ctx, { x: bounds.x + previewPad, y: bounds.y + previewPad, w: bounds.w - previewPad * 2, h: bounds.h - previewPad * 2 }, shape, 7);
      this.uiButtons.push({
        bounds,
        onClick: () => {
          if (!this.brushPickerDraft) this.syncBrushPickerDraft();
          this.brushPickerDraft.brushShape = shape;
        }
      });
    });

    const footerY = modal.y + modal.h - footerH;
    const sliderLabelY = footerY + 16;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.fillText(`Size: ${Math.round(draft.brushSize)}`, modal.x + 12, sliderLabelY);
    ctx.fillText(`Opacity: ${Math.round((draft.brushOpacity ?? 1) * 100)}%`, modal.x + modal.w / 2 + 6, sliderLabelY);

    const sliderY = sliderLabelY + 8;
    const sliderW = Math.floor((modal.w - 36) / 2);
    const sizeSlider = { x: modal.x + 12, y: sliderY, w: sliderW, h: 12 };
    const opacitySlider = { x: modal.x + modal.w / 2 + 6, y: sliderY, w: sliderW, h: 12 };
    const hardnessLabelY = sliderY + 30;
    ctx.fillText(`Hardness: ${Math.round((draft.brushHardness ?? 0) * 100)}%`, modal.x + 12, hardnessLabelY);
    const hardnessSlider = { x: modal.x + 12, y: hardnessLabelY + 8, w: modal.w - 24, h: 12 };

    const drawSlider = (bounds, t) => {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      const knobX = bounds.x + clamp(t, 0, 1) * bounds.w;
      ctx.fillStyle = 'rgba(0,200,255,0.95)';
      ctx.fillRect(knobX - 2, bounds.y - 2, 4, bounds.h + 4);
    };
    drawSlider(sizeSlider, (draft.brushSize - BRUSH_SIZE_MIN) / Math.max(1, BRUSH_SIZE_MAX - BRUSH_SIZE_MIN));
    drawSlider(opacitySlider, ((draft.brushOpacity ?? 1) - 0.05) / 0.95);
    drawSlider(hardnessSlider, draft.brushHardness ?? 0);

    this.brushPickerSliders = { size: sizeSlider, opacity: opacitySlider, hardness: hardnessSlider };

    this.uiButtons.push({
      bounds: { x: sizeSlider.x, y: sizeSlider.y - 8, w: sizeSlider.w, h: sizeSlider.h + 16 },
      onClick: ({ x: pointerX, id: pointerId }) => {
        if (!this.brushPickerDraft) this.syncBrushPickerDraft();
        this.brushPickerDrag = { type: 'size', id: pointerId ?? null };
        this.updateBrushPickerSliderFromX('size', pointerX);
      }
    });
    this.uiButtons.push({
      bounds: { x: opacitySlider.x, y: opacitySlider.y - 8, w: opacitySlider.w, h: opacitySlider.h + 16 },
      onClick: ({ x: pointerX, id: pointerId }) => {
        if (!this.brushPickerDraft) this.syncBrushPickerDraft();
        this.brushPickerDrag = { type: 'opacity', id: pointerId ?? null };
        this.updateBrushPickerSliderFromX('opacity', pointerX);
      }
    });
    this.uiButtons.push({
      bounds: { x: hardnessSlider.x, y: hardnessSlider.y - 8, w: hardnessSlider.w, h: hardnessSlider.h + 16 },
      onClick: ({ x: pointerX, id: pointerId }) => {
        if (!this.brushPickerDraft) this.syncBrushPickerDraft();
        this.brushPickerDrag = { type: 'hardness', id: pointerId ?? null };
        this.updateBrushPickerSliderFromX('hardness', pointerX);
      }
    });

    const buttonY = modal.y + modal.h - 34;
    const cancelBounds = { x: modal.x + modal.w - 180, y: buttonY, w: 80, h: 24 };
    const okBounds = { x: modal.x + modal.w - 92, y: buttonY, w: 80, h: 24 };
    this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
    this.drawButton(ctx, okBounds, 'OK', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: cancelBounds, onClick: () => this.closeBrushPicker({ apply: false }) });
    this.uiButtons.push({ bounds: okBounds, onClick: () => this.closeBrushPicker({ apply: true }) });
    ctx.restore();
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
    const canvasW = this.canvasBounds?.w || 0;
    const canvasH = this.canvasBounds?.h || 0;
    const targetW = Math.max(760, canvasW * 2.5);
    const targetH = Math.max(640, canvasH * 2.5);
    const sheetW = Math.min(w - 8, targetW);
    const sheetH = Math.min(h - 8, targetH);
    const sheetX = x + Math.floor((w - sheetW) / 2);
    const sheetY = y + Math.floor((h - sheetH) / 2);
    this.paletteModalBounds = { x: sheetX, y: sheetY, w: sheetW, h: sheetH };

    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(sheetX, sheetY, sheetW, sheetH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(sheetX, sheetY, sheetW, sheetH);
    ctx.fillStyle = '#fff';
    ctx.font = '15px Courier New';
    ctx.fillText('Palette', sheetX + 12, sheetY + 24);

    const addBounds = { x: sheetX + 12, y: sheetY + sheetH - 44, w: 54, h: 32 };
    const removeBounds = { x: sheetX + 72, y: sheetY + sheetH - 44, w: 54, h: 32 };
    if (!this.paletteRemoveMode) {
      this.drawButton(ctx, addBounds, '+', false, { fontSize: 12 });
      this.drawButton(ctx, removeBounds, '-', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: addBounds, onClick: () => this.openPaletteColorPicker() });
      this.uiButtons.push({ bounds: removeBounds, onClick: () => { this.paletteRemoveMode = true; this.paletteRemoveMarked.clear(); } });
    }

    const swatchSize = 38;
    const gap = 8;
    const topY = sheetY + 44;
    const swatchAreaH = Math.max(80, sheetH - 106);
    const rowsVisible = Math.max(1, Math.floor((swatchAreaH + gap) / (swatchSize + gap)));
    const colsVisible = Math.max(1, Math.floor((sheetW - 24 + gap) / (swatchSize + gap)));
    const maxVisible = rowsVisible * colsVisible;
    const maxScroll = Math.max(0, this.currentPalette.colors.length - maxVisible);
    this.focusScroll.paletteModal = clamp(this.focusScroll.paletteModal || 0, 0, maxScroll);
    this.paletteModalSwatchScrollBounds = {
      x: sheetX + 10,
      y: topY - 4,
      w: sheetW - 20,
      h: rowsVisible * (swatchSize + gap),
      step: swatchSize + gap,
      maxScroll
    };
    const start = this.focusScroll.paletteModal || 0;
    this.paletteBounds = [];
    this.currentPalette.colors.slice(start, start + maxVisible).forEach((color, localIndex) => {
      const index = start + localIndex;
      const row = Math.floor(localIndex / colsVisible);
      const col = localIndex % colsVisible;
      const swatchX = sheetX + 12 + col * (swatchSize + gap);
      const swatchY = topY + row * (swatchSize + gap);
      ctx.fillStyle = color.hex;
      ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
      const marked = this.paletteRemoveMarked?.has(index);
      ctx.strokeStyle = this.paletteRemoveMode
        ? 'rgba(255,80,80,0.95)'
        : (index === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)');
      ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);
      if (this.paletteRemoveMode && marked) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(swatchX + 6, swatchY + 6);
        ctx.lineTo(swatchX + swatchSize - 6, swatchY + swatchSize - 6);
        ctx.moveTo(swatchX + swatchSize - 6, swatchY + 6);
        ctx.lineTo(swatchX + 6, swatchY + swatchSize - 6);
        ctx.stroke();
      }
      const bounds = { x: swatchX, y: swatchY, w: swatchSize, h: swatchSize, index };
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, () => this.setPaletteIndex(index));
    });

    if (this.paletteColorPickerOpen && this.paletteColorDraft) {
      const basePickerW = sheetW - 12;
      const basePickerH = sheetH - 16;
      const pickerW = Math.min(sheetW - 4, Math.floor(basePickerW * 1.1));
      const pickerH = Math.min(sheetH - 4, Math.floor(basePickerH * 1.1));
      const pickerX = sheetX + Math.floor((sheetW - pickerW) / 2);
      const pickerY = sheetY + Math.floor((sheetH - pickerH) / 2);
      this.paletteColorPickerBounds = { x: pickerX, y: pickerY, w: pickerW, h: pickerH };
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(pickerX, pickerY, pickerW, pickerH);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(pickerX, pickerY, pickerW, pickerH);

      const contentPadding = 14;
      const footerButtonH = 32;
      const footerGap = 10;
      const sliderH = 18;
      const sliderCount = 6;
      const contentY = pickerY + contentPadding;
      const contentH = pickerH - (contentPadding * 2) - footerButtonH - footerGap;
      const sliderGap = Math.max(12, Math.floor(pickerW * 0.015));
      const sliderW = Math.max(170, Math.floor(pickerW * 0.36));
      const leftW = Math.max(140, pickerW - (contentPadding * 2) - sliderGap - sliderW);
      const hueW = clamp(Math.floor(leftW * 0.11), 18, 28);
      const hexFieldH = 24;
      const hexGap = 8;
      const leftAreaH = Math.max(120, contentH - hexFieldH - hexGap - footerButtonH - 6);
      const svSize = Math.max(120, Math.min(leftW - hueW - contentPadding, leftAreaH));
      const sv = { x: pickerX + contentPadding, y: contentY, w: svSize, h: svSize };
      const hue = { x: sv.x + sv.w + contentPadding, y: sv.y, w: hueW, h: sv.h };

      const sliderX = hue.x + hue.w + sliderGap;
      const sliderAreaH = Math.max(100, contentH);
      const sliderRowStep = Math.max(sliderH + 6, Math.floor(sliderAreaH / sliderCount));
      const sliderBlockH = sliderCount * sliderRowStep;

      const quantizationLevels = this.paletteColorDraft.quantization || 32;
      const quantizeHex = (rgb) => this.rgbToHex(this.quantizeChannel(rgb.r, quantizationLevels), this.quantizeChannel(rgb.g, quantizationLevels), this.quantizeChannel(rgb.b, quantizationLevels));
      const svSteps = clamp(Math.round(quantizationLevels), 8, 32);
      const svBlockW = sv.w / svSteps;
      const svBlockH = sv.h / svSteps;
      for (let vy = 0; vy < svSteps; vy += 1) {
        const v = 1 - (vy / Math.max(1, svSteps - 1));
        for (let sx = 0; sx < svSteps; sx += 1) {
          const sat = sx / Math.max(1, svSteps - 1);
          const rgb = this.hsvToRgb(this.paletteColorDraft.h, sat, v);
          ctx.fillStyle = quantizeHex(rgb);
          ctx.fillRect(sv.x + sx * svBlockW, sv.y + vy * svBlockH, Math.ceil(svBlockW), Math.ceil(svBlockH));
        }
      }
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(sv.x, sv.y, sv.w, sv.h);

      const hueSteps = clamp(Math.round(quantizationLevels), 8, 64);
      const hueBlockH = hue.h / hueSteps;
      for (let i = 0; i < hueSteps; i += 1) {
        const hNorm = i / Math.max(1, hueSteps - 1);
        const rgb = this.hsvToRgb(hNorm * 360, 1, 1);
        ctx.fillStyle = quantizeHex(rgb);
        ctx.fillRect(hue.x, hue.y + i * hueBlockH, hue.w, Math.ceil(hueBlockH));
      }
      ctx.strokeRect(hue.x, hue.y, hue.w, hue.h);

      const svX = sv.x + this.paletteColorDraft.s * sv.w;
      const svY = sv.y + (1 - this.paletteColorDraft.v) * sv.h;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(svX - 4, svY - 4, 8, 8);
      const hueY = hue.y + (this.paletteColorDraft.h / 360) * hue.h;
      ctx.strokeRect(hue.x - 2, hueY - 2, hue.w + 4, 4);

      const currentHex = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b).toUpperCase();
      const buttonY = pickerY + pickerH - footerButtonH - 8;
      const hexBounds = {
        x: sv.x,
        y: buttonY + Math.floor((footerButtonH - hexFieldH) / 2),
        w: Math.max(88, sv.w),
        h: hexFieldH
      };
      ctx.fillStyle = '#fff';
      ctx.fillText('HEX', hexBounds.x, hexBounds.y - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(hexBounds.x, hexBounds.y, hexBounds.w, hexBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(hexBounds.x, hexBounds.y, hexBounds.w, hexBounds.h);
      ctx.fillStyle = '#fff';
      ctx.fillText(currentHex, hexBounds.x + 8, hexBounds.y + Math.floor(hexBounds.h * 0.7));
      this.uiButtons.push({ bounds: hexBounds, onClick: () => this.editPaletteHexValue() });

      const addSlider = (label, type, val, min, max, x0, y0, w0) => {
        const labelW = 18;
        const valueW = 44;
        const trackX = x0 + labelW + 8;
        const trackW = Math.max(40, w0 - labelW - valueW - 18);
        const valueX = trackX + trackW + 8;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x0, y0 + Math.floor(sliderH * 0.72));
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(trackX, y0, trackW, sliderH);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.strokeRect(trackX, y0, trackW, sliderH);
        const t = (val - min) / Math.max(1e-6, (max - min));
        const kx = trackX + clamp(t, 0, 1) * trackW;
        ctx.fillStyle = '#00c8ff';
        ctx.fillRect(kx - 3, y0 - 2, 6, sliderH + 4);

        const valueBounds = { x: valueX, y: y0, w: valueW, h: sliderH };
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(String(Math.round(val)), valueBounds.x + valueBounds.w - 6, y0 + Math.floor(sliderH * 0.72));
        ctx.textAlign = 'left';

        const trackBounds = { x: trackX, y: y0 - 8, w: trackW, h: sliderH + 18 };
        this.uiButtons.push({
          bounds: trackBounds,
          onClick: ({ x: px, id: pointerId }) => {
            this.palettePickerDrag = { type, id: pointerId ?? null, bounds: { x: trackX, y: y0, w: trackW, h: sliderH } };
            this.updatePaletteSliderFromX(type, px, { x: trackX, y: y0, w: trackW, h: sliderH });
          }
        });
        this.uiButtons.push({ bounds: valueBounds, onClick: () => this.editPaletteSliderValue(type) });
      };

      let sy = contentY + Math.floor((sliderAreaH - sliderBlockH) / 2);
      addSlider('H', 'h', this.paletteColorDraft.h, 0, 360, sliderX, sy, sliderW);
      sy += sliderRowStep;
      addSlider('S', 's', this.paletteColorDraft.s * 100, 0, 100, sliderX, sy, sliderW);
      sy += sliderRowStep;
      addSlider('V', 'v', this.paletteColorDraft.v * 100, 0, 100, sliderX, sy, sliderW);
      sy += sliderRowStep;
      addSlider('R', 'r', this.paletteColorDraft.r, 0, 255, sliderX, sy, sliderW);
      sy += sliderRowStep;
      addSlider('G', 'g', this.paletteColorDraft.g, 0, 255, sliderX, sy, sliderW);
      sy += sliderRowStep;
      addSlider('B', 'b', this.paletteColorDraft.b, 0, 255, sliderX, sy, sliderW);

      this.uiButtons.push({ bounds: sv, onClick: ({ x: px, y: py, id: pointerId }) => {
        this.palettePickerDrag = { type: 'sv', id: pointerId ?? null, bounds: sv };
        this.paletteColorDraft.s = clamp((px - sv.x) / Math.max(1, sv.w), 0, 1);
        this.paletteColorDraft.v = clamp(1 - (py - sv.y) / Math.max(1, sv.h), 0, 1);
        this.syncPaletteDraftFromHsv();
      } });
      this.uiButtons.push({ bounds: { x: hue.x, y: hue.y, w: hue.w, h: hue.h }, onClick: ({ y: py, id: pointerId }) => {
        this.palettePickerDrag = { type: 'hue', id: pointerId ?? null, bounds: hue };
        this.paletteColorDraft.h = clamp((py - hue.y) / Math.max(1, hue.h), 0, 1) * 360;
        this.syncPaletteDraftFromHsv();
      } });

      const quantBounds = { x: pickerX + 10, y: pickerY + 10, w: 140, h: footerButtonH };
      const pickerCancel = { x: pickerX + pickerW - 186, y: buttonY, w: 84, h: footerButtonH };
      const pickerOk = { x: pickerX + pickerW - 94, y: buttonY, w: 84, h: footerButtonH };
      const q = this.paletteColorDraft.quantization || 32;
      const quantLabel = q === 8 ? 'Q: 8-bit' : (q === 16 ? 'Q: 16-bit' : 'Q: 32-bit');
      this.drawButton(ctx, quantBounds, quantLabel, false, { fontSize: 12 });
      this.drawButton(ctx, pickerCancel, 'cancel', false, { fontSize: 12 });
      this.drawButton(ctx, pickerOk, 'add', false, { fontSize: 12 });
      this.uiButtons.push({
        bounds: quantBounds,
        onClick: () => {
          const levels = [8, 16, 32];
          const current = levels.indexOf(this.paletteColorDraft.quantization || 32);
          const next = levels[(current + 1 + levels.length) % levels.length];
          this.paletteColorDraft.quantization = next;
          this.syncPaletteDraftFromRgb();
        }
      });
      this.uiButtons.push({ bounds: pickerCancel, onClick: () => { this.paletteColorPickerOpen = false; this.paletteColorDraft = null; this.palettePickerDrag = null; this.paletteColorPickerBounds = null; } });
      this.uiButtons.push({ bounds: pickerOk, onClick: () => this.applyPaletteColorPickerAdd() });
    }

    if (!this.paletteColorPickerOpen) this.paletteColorPickerBounds = null;
    if (this.paletteRemoveMode) {
      const cancelBounds = { x: sheetX + sheetW - 186, y: sheetY + sheetH - 44, w: 84, h: 32 };
      const removeApplyBounds = { x: sheetX + sheetW - 96, y: sheetY + sheetH - 44, w: 84, h: 32 };
      this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
      this.drawButton(ctx, removeApplyBounds, 'Remove', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: cancelBounds, onClick: () => { this.paletteRemoveMode = false; this.paletteRemoveMarked.clear(); } });
      this.uiButtons.push({ bounds: removeApplyBounds, onClick: () => this.applyPaletteSwatchRemoval() });
      this.registerFocusable('menu', cancelBounds, () => { this.paletteRemoveMode = false; this.paletteRemoveMarked.clear(); });
      this.registerFocusable('menu', removeApplyBounds, () => this.applyPaletteSwatchRemoval());
    } else {
      const closeBounds = { x: sheetX + sheetW - 96, y: sheetY + sheetH - 44, w: 84, h: 32 };
      const closeLabel = this.paletteColorPickerOpen ? 'Add' : 'Close';
      this.drawButton(ctx, closeBounds, closeLabel, false, { fontSize: 12 });
      this.uiButtons.push({
        bounds: closeBounds,
        onClick: () => {
          if (this.paletteColorPickerOpen) {
            this.applyPaletteColorPickerAdd();
            return;
          }
          this.paletteGridOpen = false;
          this.paletteColorPickerOpen = false;
          this.paletteColorDraft = null;
          this.paletteRemoveMode = false;
          this.paletteRemoveMarked.clear();
          this.palettePickerDrag = null;
          this.paletteColorPickerBounds = null;
          this.paletteModalBounds = null;
        }
      });
      this.registerFocusable('menu', closeBounds, () => {
        if (this.paletteColorPickerOpen) {
          this.applyPaletteColorPickerAdd();
          return;
        }
        this.paletteGridOpen = false;
        this.paletteColorPickerOpen = false;
        this.paletteColorDraft = null;
        this.paletteRemoveMode = false;
        this.paletteRemoveMarked.clear();
        this.palettePickerDrag = null;
        this.paletteColorPickerBounds = null;
        this.paletteModalBounds = null;
      });
    }
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
    const category = options.category || this.leftPanelTab || 'draw';
    const fontSize = isMobile ? 14 : 12;
    const lineHeight = isMobile ? 52 : 20;
    const buttonHeight = isMobile ? 44 : 18;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    const title = category === 'draw' ? 'Draw Tools' : category === 'select' ? 'Selection Tools' : 'Extra Tools';
    ctx.fillText(title, x + 12, y + 22);

    const list = this.tools.filter((tool) => (tool.category || 'tools') === category);
    const maxVisible = Math.max(1, Math.floor((h - 140) / lineHeight));
    this.focusGroupMeta.tools = { maxVisible };
    const start = this.focusScroll.tools || 0;
    const maxToolScroll = Math.max(0, list.length - maxVisible);
    this.focusScroll.tools = clamp(start, 0, maxToolScroll);
    this.toolsListMeta = {
      scrollBounds: { x: x + 6, y: y + 26, w: w - 12, h: maxVisible * lineHeight + 8 },
      lineHeight,
      maxScroll: maxToolScroll
    };
    let offsetY = y + 36;
    list.slice(this.focusScroll.tools, this.focusScroll.tools + maxVisible).forEach((tool) => {
      const isActive = tool.id === this.activeToolId;
      const bounds = { x: x + 8, y: offsetY - buttonHeight + 4, w: w - 16, h: buttonHeight };
      this.drawButton(ctx, bounds, tool.name, isActive, { fontSize });
      this.uiButtons.push({ bounds, onClick: () => { this.setActiveTool(tool.id); } });
      this.registerFocusable('tools', bounds, () => this.setActiveTool(tool.id));
      offsetY += lineHeight;
    });
    if (maxToolScroll > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${isMobile ? 11 : 10}px ${UI_SUITE.font.family}`;
      ctx.fillText(`Tools ${this.focusScroll.tools + 1}/${maxToolScroll + 1}`, x + 12, y + 26 + maxVisible * lineHeight + 10);
    }

    if (!isMobile) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
      ctx.fillText(`Brush Size: ${this.toolOptions.brushSize}`, x + 12, offsetY);
      const brushMinus = { x: x + 160, y: offsetY - buttonHeight + 4, w: 28, h: buttonHeight };
      const brushPlus = { x: x + 262, y: offsetY - buttonHeight + 4, w: 28, h: buttonHeight };
      const brushSlider = { x: x + 192, y: offsetY - buttonHeight + 8, w: 66, h: Math.max(8, buttonHeight - 8) };
      const brushT = (this.toolOptions.brushSize - BRUSH_SIZE_MIN) / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
      const brushKnobX = brushSlider.x + brushT * brushSlider.w;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(brushSlider.x, brushSlider.y, brushSlider.w, brushSlider.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeRect(brushSlider.x, brushSlider.y, brushSlider.w, brushSlider.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(brushKnobX - 2, brushSlider.y - 2, 4, brushSlider.h + 4);
      this.drawButton(ctx, brushMinus, '-', false, { fontSize });
      this.drawButton(ctx, brushPlus, '+', false, { fontSize });
      this.uiButtons.push({ bounds: brushMinus, onClick: () => { this.setBrushSize(this.toolOptions.brushSize - 1); } });
      this.uiButtons.push({ bounds: brushPlus, onClick: () => { this.setBrushSize(this.toolOptions.brushSize + 1); } });
      this.uiButtons.push({ bounds: brushSlider, onClick: ({ x: pointerX }) => this.setBrushSizeFromSlider(pointerX, brushSlider), onDrag: ({ x: pointerX }) => this.setBrushSizeFromSlider(pointerX, brushSlider) });
      this.registerFocusable('menu', brushMinus, () => { this.setBrushSize(this.toolOptions.brushSize - 1); });
      this.registerFocusable('menu', brushPlus, () => { this.setBrushSize(this.toolOptions.brushSize + 1); });
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
      ctx.fillText('Canvas Transform', x + 12, offsetY);
      offsetY += lineHeight;
      const transformButtons = [
        { label: 'Resize', action: () => this.openTransformModal('resize') },
        { label: 'Scale', action: () => this.openTransformModal('scale') },
        { label: 'Crop', action: () => this.openTransformModal('crop') },
        { label: 'Offset', action: () => this.openTransformModal('offset') }
      ];
      transformButtons.forEach((entry, index) => {
        const bounds = {
          x: x + 12 + (index % 2) * (72 + 8),
          y: offsetY + Math.floor(index / 2) * (buttonHeight + 6),
          w: 72,
          h: buttonHeight
        };
        this.drawButton(ctx, bounds, entry.label, this.transformModal?.type === entry.label.toLowerCase(), { fontSize });
        this.uiButtons.push({ bounds, onClick: entry.action });
        this.registerFocusable('menu', bounds, entry.action);
      });
      offsetY += buttonHeight * 2 + 12;
    }

    const optionsX = x + 12;
    const optionsY = offsetY;
    const optionsW = Math.max(120, w - 24);
    const optionsH = Math.max(60, y + h - optionsY - 6);
    this.toolsPanelMeta = {
      optionsScrollBounds: { x: optionsX - 2, y: optionsY - 18, w: optionsW + 4, h: optionsH + 20 },
      lineHeight,
      maxToolOptionsScroll: 0
    };
    offsetY = this.drawToolOptions(ctx, optionsX, optionsY, { isMobile, panelWidth: optionsW, panelHeight: optionsH });

    if (this.leftPanelTab === 'select') {
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

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
    ctx.fillText('Tile Preview: 3x3', x + 12, offsetY);
    offsetY += lineHeight;

    const transformButtons = [
      { label: 'Resize', action: () => this.openTransformModal('resize') },
      { label: 'Scale', action: () => this.openTransformModal('scale') },
      { label: 'Crop', action: () => this.openTransformModal('crop') },
      { label: 'Offset', action: () => this.openTransformModal('offset') }
    ];
    transformButtons.forEach((entry, index) => {
      const bounds = { x: x + 12 + (index % 2) * 84, y: offsetY + Math.floor(index / 2) * (buttonHeight + 8) - buttonHeight + 4, w: 78, h: buttonHeight };
      this.drawButton(ctx, bounds, entry.label, this.transformModal?.type === entry.label.toLowerCase(), { fontSize });
      this.uiButtons.push({ bounds, onClick: entry.action });
      this.registerFocusable('menu', bounds, entry.action);
    });
    offsetY += buttonHeight * 2 + 18;

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
    const panelWidth = Math.max(120, options.panelWidth || 180);
    const panelHeight = Math.max(60, options.panelHeight || 120);
    const lineHeight = isMobile ? 52 : 20;
    const rowHeight = isMobile ? 52 : 22;
    const startY = y;
    const scroll = Math.max(0, this.focusScroll.toolOptions || 0);
    const scrollY = scroll * rowHeight;
    let offsetY = y;
    let contentBottom = y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 16, panelWidth + 8, panelHeight + 20);
    ctx.clip();
    offsetY -= scrollY;
    ctx.fillStyle = '#fff';
    ctx.fillText('Tool Options', x, offsetY);
    offsetY += 18;
    const usesBrush = [TOOL_IDS.PENCIL, TOOL_IDS.ERASER, TOOL_IDS.DITHER, TOOL_IDS.CLONE].includes(this.activeToolId);
    if (usesBrush) {
      const shapeBounds = { x, y: offsetY - (isMobile ? 24 : 12), w: Math.min(panelWidth, isMobile ? 200 : 170), h: isMobile ? 44 : 18 };
      this.drawButton(ctx, shapeBounds, `Brush Shape: ${this.toolOptions.brushShape}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds: shapeBounds, onClick: () => this.cycleBrushShape() });
      this.registerFocusable('menu', shapeBounds, () => this.cycleBrushShape());
      offsetY += lineHeight;

      const falloffBounds = { x, y: offsetY - (isMobile ? 24 : 12), w: Math.min(panelWidth, isMobile ? 200 : 170), h: isMobile ? 44 : 18 };
      this.drawButton(ctx, falloffBounds, `Brush Falloff: ${this.toolOptions.brushFalloff}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds: falloffBounds, onClick: () => this.cycleBrushFalloff() });
      this.registerFocusable('menu', falloffBounds, () => this.cycleBrushFalloff());
      offsetY += lineHeight;
    }
    if ([TOOL_IDS.RECT, TOOL_IDS.ELLIPSE, TOOL_IDS.POLYGON].includes(this.activeToolId)) {
      this.drawOptionToggle(ctx, x, offsetY, this.toolOptions.shapeFill ? 'Fill: On' : 'Fill: Off', this.toolOptions.shapeFill, () => {
        this.toolOptions.shapeFill = !this.toolOptions.shapeFill;
      }, { isMobile });
      offsetY += lineHeight;
      if (this.activeToolId === TOOL_IDS.POLYGON) {
        const finishBounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 150, h: isMobile ? 44 : 18 };
        const canFinish = Boolean(this.polygonPreview && this.polygonPreview.points.length >= 3);
        this.drawButton(ctx, finishBounds, canFinish ? 'Finish Polygon' : 'Polygon: tap 3+ pts', canFinish, { fontSize: isMobile ? 12 : 12 });
        this.uiButtons.push({ bounds: finishBounds, onClick: () => this.finishPolygon() });
        this.registerFocusable('menu', finishBounds, () => this.finishPolygon());
        offsetY += lineHeight;
      }
    }
    if (this.activeToolId === TOOL_IDS.FILL) {
      this.drawOptionToggle(ctx, x, offsetY, 'Contiguous', this.toolOptions.fillContiguous, () => {
        this.toolOptions.fillContiguous = !this.toolOptions.fillContiguous;
      }, { isMobile });
      offsetY += lineHeight;
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
      offsetY += rowHeight;
    }
    if (this.activeToolId === TOOL_IDS.DITHER) {
      const patterns = ['bayer2', 'bayer4', 'checker'];
      const nextPattern = patterns[(patterns.indexOf(this.toolOptions.ditherPattern) + 1) % patterns.length];
      const bounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 120, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, `Pattern: ${this.toolOptions.ditherPattern}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: () => { this.toolOptions.ditherPattern = nextPattern; } });
      this.registerFocusable('menu', bounds, () => { this.toolOptions.ditherPattern = nextPattern; });
      offsetY += lineHeight;
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
      offsetY += rowHeight;
    }
    if (this.activeToolId === TOOL_IDS.CLONE) {
      const modeLabel = this.cloneColorPickArmed ? 'Mode: Eyedropper' : 'Mode: Paint';
      const modeBounds = { x, y: offsetY - (isMobile ? 24 : 12), w: Math.min(panelWidth, isMobile ? 200 : 170), h: isMobile ? 44 : 18 };
      this.drawButton(ctx, modeBounds, modeLabel, this.cloneColorPickArmed, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({
        bounds: modeBounds,
        onClick: () => {
          this.cloneColorPickArmed = !this.cloneColorPickArmed;
          this.statusMessage = this.cloneColorPickArmed ? 'Clone eyedropper mode' : 'Clone paint mode';
        }
      });
      this.registerFocusable('menu', modeBounds, () => {
        this.cloneColorPickArmed = !this.cloneColorPickArmed;
        this.statusMessage = this.cloneColorPickArmed ? 'Clone eyedropper mode' : 'Clone paint mode';
      });
      offsetY += lineHeight;
      const sourceLabel = this.clonePickSourceArmed ? 'Tap canvas to set source' : 'Set Source';
      const sourceBounds = { x, y: offsetY - (isMobile ? 24 : 12), w: Math.min(panelWidth, isMobile ? 200 : 170), h: isMobile ? 44 : 18 };
      this.drawButton(ctx, sourceBounds, sourceLabel, this.clonePickSourceArmed, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({
        bounds: sourceBounds,
        onClick: () => {
          this.clonePickSourceArmed = !this.clonePickSourceArmed;
          this.statusMessage = this.clonePickSourceArmed ? 'Tap canvas to set clone source' : '';
        }
      });
      this.registerFocusable('menu', sourceBounds, () => {
        this.clonePickSourceArmed = !this.clonePickSourceArmed;
        this.statusMessage = this.clonePickSourceArmed ? 'Tap canvas to set clone source' : '';
      });
      offsetY += lineHeight;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Clone Size: ${this.toolOptions.brushSize}`, x, offsetY);
      const sliderRight = Math.max(x + 150, x + panelWidth - 32);
      const minus = { x: x + 120, y: offsetY - (isMobile ? 28 : 14), w: 28, h: isMobile ? 44 : 18 };
      const plus = { x: sliderRight, y: offsetY - (isMobile ? 28 : 14), w: 28, h: isMobile ? 44 : 18 };
      const slider = {
        x: x + 152,
        y: offsetY - (isMobile ? 22 : 9),
        w: Math.max(36, plus.x - (x + 152) - 4),
        h: isMobile ? 12 : 8
      };
      const sliderT = (this.toolOptions.brushSize - BRUSH_SIZE_MIN) / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
      const knobX = slider.x + sliderT * slider.w;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeRect(slider.x, slider.y, slider.w, slider.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(knobX - 2, slider.y - 2, 4, slider.h + 4);
      this.uiButtons.push({
        bounds: minus,
        onClick: () => { this.setBrushSize(this.toolOptions.brushSize - 1); }
      });
      this.uiButtons.push({
        bounds: plus,
        onClick: () => { this.setBrushSize(this.toolOptions.brushSize + 1); }
      });
      this.uiButtons.push({ bounds: slider, onClick: ({ x: pointerX }) => this.setBrushSizeFromSlider(pointerX, slider), onDrag: ({ x: pointerX }) => this.setBrushSizeFromSlider(pointerX, slider) });
      this.drawButton(ctx, minus, '-', false, { fontSize: isMobile ? 12 : 12 });
      this.drawButton(ctx, plus, '+', false, { fontSize: isMobile ? 12 : 12 });
      this.registerFocusable('menu', minus, () => { this.setBrushSize(this.toolOptions.brushSize - 1); });
      this.registerFocusable('menu', plus, () => { this.setBrushSize(this.toolOptions.brushSize + 1); });
      offsetY += rowHeight;

    }
    if (this.activeToolId === TOOL_IDS.GRADIENT) {
      const bounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 150, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, `Strength: ${this.toolOptions.gradientStrength}%`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: () => { this.toolOptions.gradientStrength += 10; if (this.toolOptions.gradientStrength > 100) this.toolOptions.gradientStrength = 10; } });
      this.registerFocusable('menu', bounds, () => { this.toolOptions.gradientStrength += 10; if (this.toolOptions.gradientStrength > 100) this.toolOptions.gradientStrength = 10; });
      offsetY += lineHeight;
    }
    if ([TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR].includes(this.activeToolId)) {
      const bounds = { x, y: offsetY - (isMobile ? 24 : 12), w: isMobile ? 180 : 150, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, `Threshold: ${this.toolOptions.magicThreshold}`, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: () => { this.toolOptions.magicThreshold += 8; if (this.toolOptions.magicThreshold > 255) this.toolOptions.magicThreshold = 0; } });
      this.registerFocusable('menu', bounds, () => { this.toolOptions.magicThreshold += 8; if (this.toolOptions.magicThreshold > 255) this.toolOptions.magicThreshold = 0; });
      offsetY += lineHeight;
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
      offsetY += lineHeight;
    }
    contentBottom = offsetY;
    ctx.restore();
    const totalRows = Math.max(0, Math.ceil((contentBottom - startY) / rowHeight));
    const visibleRows = Math.max(1, Math.floor((panelHeight + 20) / rowHeight));
    const maxScroll = Math.max(0, totalRows - visibleRows);
    this.focusScroll.toolOptions = clamp(this.focusScroll.toolOptions || 0, 0, maxScroll);
    if (this.toolsPanelMeta) {
      this.toolsPanelMeta.maxToolOptionsScroll = maxScroll;
    }
    if (maxScroll > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${isMobile ? 11 : 10}px ${UI_SUITE.font.family}`;
      ctx.fillText(`Scroll ${this.focusScroll.toolOptions + 1}/${maxScroll + 1}`, x, startY + panelHeight + 10);
    }
    return offsetY;
  }

  drawSelectionActions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    const actions = [
      { label: 'Rect', action: () => this.setActiveTool(TOOL_IDS.SELECT_RECT) },
      { label: 'Oval', action: () => this.setActiveTool(TOOL_IDS.SELECT_ELLIPSE) },
      { label: 'Lasso', action: () => this.setActiveTool(TOOL_IDS.SELECT_LASSO) },
      { label: 'Magic Lasso', action: () => this.setActiveTool(TOOL_IDS.SELECT_MAGIC_LASSO) },
      { label: 'Color All', action: () => this.setActiveTool(TOOL_IDS.SELECT_MAGIC_COLOR) },
      { label: 'Reverse', action: () => this.invertSelection() },
      { label: 'Copy', action: () => this.copySelection() },
      { label: 'Cut', action: () => this.cutSelection() },
      { label: 'Delete', action: () => this.deleteSelection() },
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
    const wrapActive = Boolean(this.toolOptions.wrapDraw);
    this.canvasBounds = wrapActive
      ? { x: offsetX - gridW, y: offsetY - gridH, w: gridW * 3, h: gridH * 3, cellSize: zoom, mainX: offsetX, mainY: offsetY }
      : { x: offsetX, y: offsetY, w: gridW, h: gridH, cellSize: zoom, mainX: offsetX, mainY: offsetY };

    this.offscreen.width = width;
    this.offscreen.height = height;
    const composite = compositeLayers(this.canvasState.layers, width, height);
    const imageData = this.offscreenCtx.createImageData(width, height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    this.offscreenCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (this.tiledPreview.enabled || wrapActive) {
      for (let row = -1; row <= 1; row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          const isCenter = row === 0 && col === 0;
          ctx.globalAlpha = isCenter ? 1 : (wrapActive ? 0.7 : 0.2);
          ctx.drawImage(this.offscreen, offsetX + col * gridW, offsetY + row * gridH, gridW, gridH);
        }
      }
      ctx.globalAlpha = 1;
    }

    if (this.animation.onion.enabled) {
      this.drawOnionSkin(ctx, offsetX, offsetY, gridW, gridH);
    }

    ctx.drawImage(this.offscreen, offsetX, offsetY, gridW, gridH);

    const drawGridAt = (tileX, tileY, alpha = 0.15) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      for (let row = 0; row <= height; row += 1) {
        ctx.beginPath();
        ctx.moveTo(tileX, tileY + row * zoom);
        ctx.lineTo(tileX + gridW, tileY + row * zoom);
        ctx.stroke();
      }
      for (let col = 0; col <= width; col += 1) {
        ctx.beginPath();
        ctx.moveTo(tileX + col * zoom, tileY);
        ctx.lineTo(tileX + col * zoom, tileY + gridH);
        ctx.stroke();
      }
    };
    if (this.tiledPreview.enabled || wrapActive) {
      for (let row = -1; row <= 1; row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          drawGridAt(offsetX + col * gridW, offsetY + row * gridH, row === 0 && col === 0 ? 0.2 : 0.12);
        }
      }
    } else {
      drawGridAt(offsetX, offsetY, 0.15);
    }

    if (this.selection.active && this.selection.bounds) {
      this.drawSelectionMarchingAnts(ctx, offsetX, offsetY, zoom);
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

    if (this.selection.lassoPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.activeToolId === TOOL_IDS.SELECT_MAGIC_LASSO ? '#8df0ff' : '#ffcc6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.selection.lassoPoints.forEach((pt, index) => {
        const x = offsetX + pt.x * zoom;
        const y = offsetY + pt.y * zoom;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (this.linePreview) {
      const linePoints = bresenhamLine(this.linePreview.start, this.linePreview.end);
      this.drawPixelPreview(ctx, this.expandPreviewPoints(linePoints), offsetX, offsetY, zoom, 'rgba(255,225,106,0.72)');
    }

    if (this.curvePreview) {
      const samples = this.sampleCurvePoints(this.curvePreview, 96);
      this.drawPixelPreview(ctx, this.expandPreviewPoints(samples), offsetX, offsetY, zoom, 'rgba(141,240,255,0.72)');
      const handles = [this.curvePreview.control1, this.curvePreview.control2].filter(Boolean);
      if (handles.length) {
        ctx.fillStyle = '#8df0ff';
        handles.forEach((handle) => {
          const hx = offsetX + (handle.col + 0.5) * zoom;
          const hy = offsetY + (handle.row + 0.5) * zoom;
          ctx.fillRect(hx - 3, hy - 3, 6, 6);
        });
      }
    }

    if (this.shapePreview || this.polygonPreview) {
      this.drawPixelPreview(ctx, this.getShapePreviewPoints(), offsetX, offsetY, zoom, 'rgba(106,215,255,0.72)');
    }

    if (this.gradientPreview) {
      ctx.strokeStyle = '#9ddcff';
      ctx.beginPath();
      ctx.moveTo(offsetX + (this.gradientPreview.start.col + 0.5) * zoom, offsetY + (this.gradientPreview.start.row + 0.5) * zoom);
      ctx.lineTo(offsetX + (this.gradientPreview.end.col + 0.5) * zoom, offsetY + (this.gradientPreview.end.row + 0.5) * zoom);
      ctx.stroke();
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

    const previewSource = this.gamepadCursor.active
      ? { x: this.gamepadCursor.x, y: this.gamepadCursor.y }
      : { x: this.cursor.x, y: this.cursor.y };
    const previewPoint = this.getGridCellFromScreen(previewSource.x, previewSource.y);
    if (previewPoint) {
      const radius = Math.floor(this.toolOptions.brushSize / 2);
      const previewX = offsetX + (previewPoint.col - radius) * zoom;
      const previewY = offsetY + (previewPoint.row - radius) * zoom;
      const previewSize = this.toolOptions.brushSize * zoom;
      ctx.strokeStyle = 'rgba(255, 225, 106, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(previewX, previewY, previewSize, previewSize);
    }

    ctx.restore();
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
    const controlGap = 6;
    const controlY = y + 10;
    const controlH = 44;
    const prevBounds = { x: 0, y: controlY, w: 28, h: controlH };
    const nextBounds = { x: 0, y: controlY, w: 28, h: controlH };
    const paletteButtonW = clamp(Math.floor(w * 0.22), 68, 92);
    const moreBounds = { x: 0, y: controlY, w: paletteButtonW, h: controlH };

    let controlX = x + w - 10;
    [moreBounds, nextBounds, prevBounds].forEach((bounds) => {
      controlX -= bounds.w;
      bounds.x = controlX;
      controlX -= controlGap;
    });

    const startX = x + 10;
    const swatchAreaW = Math.max(44, prevBounds.x - controlGap - startX);
    const maxPerRow = Math.max(1, Math.floor(swatchAreaW / (swatchSize + gap)));
    const total = this.currentPalette.colors.length;
    const maxScroll = Math.max(0, total - maxPerRow);
    this.focusScroll.palette = clamp(this.focusScroll.palette || 0, 0, maxScroll);
    this.paletteBarScrollBounds = {
      x: startX,
      y: y + 18,
      w: swatchAreaW,
      h: swatchSize + 12,
      maxScroll,
      step: swatchSize + gap
    };

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

    this.drawButton(ctx, prevBounds, '◀', false, { fontSize: 12 });
    this.drawButton(ctx, nextBounds, '▶', false, { fontSize: 12 });
    this.drawButton(ctx, moreBounds, this.paletteGridOpen ? 'Palette ▾' : 'Palette ▸', false, { fontSize: 12 });

    this.uiButtons.push({ bounds: prevBounds, onClick: () => { this.focusScroll.palette = clamp((this.focusScroll.palette || 0) - 1, 0, maxScroll); } });
    this.uiButtons.push({ bounds: nextBounds, onClick: () => { this.focusScroll.palette = clamp((this.focusScroll.palette || 0) + 1, 0, maxScroll); } });
    this.uiButtons.push({ bounds: moreBounds, onClick: () => { this.paletteGridOpen = !this.paletteGridOpen; } });

    this.registerFocusable('menu', prevBounds, () => { this.focusScroll.palette = clamp((this.focusScroll.palette || 0) - 1, 0, maxScroll); });
    this.registerFocusable('menu', nextBounds, () => { this.focusScroll.palette = clamp((this.focusScroll.palette || 0) + 1, 0, maxScroll); });
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
