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
  mergeUp,
  flattenLayers,
  reorderLayer
} from './pixel-editor/layers.js';
import { createToolRegistry, TOOL_IDS } from './pixel-editor/tools.js';
import { createFrame, cloneFrame, exportAnimatedGif, exportSpriteSheet } from './pixel-editor/animation.js';
import {
  addMaskToBoneBinding,
  bakeBoneFrames,
  bakeBoneTimelineFrames,
  buildBoneGraph,
  cloneBoneRig,
  compositeBonePreview,
  constrainSharedJointPose,
  createBone,
  createDefaultBoneRig,
  createLayerBinding,
  createSelectionBinding,
  getBoneAffectedPixelCounts,
  getBoneInfluenceSets,
  getBoneJointUsageCount,
  getPosedBoneGeometry,
  getPoseKeyAtTime,
  moveBoneJoint,
  removeMaskFromBoneBinding,
  removeOrphanBoneJoints,
  removePoseKeyAtTime,
  normalizeBoneRig,
  normalizeBoneSkeleton,
  reverseBoneDirection,
  samplePoseTimeline,
  solveTwoBoneIkPose,
  setPoseKeyAtTime
} from './pixel-editor/bones.js';
import { GAMEPAD_HINTS } from './pixel-editor/gamepad.js';
import InputManager, { INPUT_ACTIONS } from './pixel-editor/inputManager.js';
import { UI_SUITE, SHARED_EDITOR_LEFT_MENU, buildSharedDesktopLeftPanelFrame, buildSharedEditorFileMenu, buildSharedLeftMenuLayout, buildSharedLeftMenuButtons, buildUnifiedFileDrawerItems, drawSharedContextRibbon, drawSharedFocusRing, drawSharedMenuButtonChrome, drawSharedMenuButtonLabel, drawSharedPanel, drawSharedPortraitActionRail, drawSharedPortraitMultiRowTabStrip, drawSharedPortraitScrollHints, drawSharedPortraitSheet, drawSharedThumbstick, drawSharedTransportPopover, getSharedEditorDrawerWidth, getSharedMobileDrawerWidth, getSharedMobileLandscapeEditorLayout, getSharedMobilePortraitEditorLayout, getSharedMobileRailWidth, getSharedPortraitActionRailLayout, getSharedPortraitMenuMetrics, getSharedThumbstickLayout, isMobileLandscapeLayout, isMobilePortraitLayout, normalizeSharedControlBounds, renderSharedFileDrawer, resetSharedThumbstickState, SharedEditorMenu, splitFileDrawerStickyExitItems } from './uiSuite.js';
import { TILE_LIBRARY } from './pixel-editor/tools/tileLibrary.js';
import { PIXEL_SIZE_PRESETS, createDitherMask } from './pixel-editor/input/dither.js';
import { clamp, lerp, bresenhamLine, generateEllipseMask, createPolygonMask, createRectMask, applySymmetryPoints } from './pixel-editor/render/geometry.js';
import { createViewportController } from './shared/viewportController.js';
import { listProjectFiles, loadProjectFile, saveProjectFile, sanitizeProjectFileName } from './projectFiles.js';
import { createEditorRuntime } from './shared/editor-runtime/EditorRuntime.js';
import { openChoiceOverlay, openTextInputOverlay } from './shared/textInputOverlay.js';
import { buildTransformHandleMeta, hitTestTransformHandles } from './shared/transformHandles.js';
import { drawSharedMobileZoomSlider, getSharedMobileZoomSliderLayout } from './shared/mobileZoomSlider.js';
import { ensurePixelArtStore, ensurePixelPreviewFrame, ensurePixelTileData } from '../editor/adapters/editorDataContracts.js';
import { resolveActorArtFrameDurationMs } from '../entities/ScriptedActor.js';
import { ControllerMenuStack, buildControllerExitConfirmMenu, buildControllerHelpMenu, buildControllerSystemMenu, drawCanvasControllerMenu } from './shared/input/controllerMenuStack.js';

const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 64;
const DEFAULT_BRUSH_SIZE = 7;
const DEFAULT_FRAME_DURATION_MS = Math.round(1000 / 32);
const DEFAULT_BONE_TIMELINE_DURATION_MS = 2000;
const DEFAULT_BONE_TIMELINE_STEP_MS = 500;
const shortestAngleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const ART_DIMENSION_MIN = 4;
const ART_DIMENSION_MAX = 4096;
const IMPORT_DIMENSION_MAX = 512;
const MAX_TILE_ART_DIMENSION = 128;
const BRUSH_SHAPES = ['circle', 'square', 'diamond', 'cross', 'x', 'hline', 'vline'];
const PIXEL_PORTRAIT_TOOL_TABS = ['draw', 'select', 'tools'];
const PIXEL_PORTRAIT_FILE_HIDE_IDS = new Set();
const PIXEL_PORTRAIT_COMPACT_TOOL_LABELS = {
  [TOOL_IDS.SELECT_RECT]: 'Rect',
  [TOOL_IDS.SELECT_ELLIPSE]: 'Oval',
  [TOOL_IDS.SELECT_LASSO]: 'Lasso',
  [TOOL_IDS.SELECT_MAGIC_LASSO]: 'Magic',
  [TOOL_IDS.SELECT_MAGIC_COLOR]: 'Magic',
  [TOOL_IDS.RECT]: 'Rect',
  [TOOL_IDS.COLOR_REPLACE]: 'Replace',
  [TOOL_IDS.HUE_SHIFT]: 'Hue'
};

export function getPixelPortraitToolLabel(tool) {
  if (!tool) return '';
  return PIXEL_PORTRAIT_COMPACT_TOOL_LABELS[tool.id] || tool.name || tool.id;
}

export function getPixelPortraitToolGridMetrics(width, height, itemCount, {
  minColumnWidth = 92,
  maxColumns = 3,
  rowHeight = 52,
  buttonHeight = 44,
  rowGap = 8,
  columnGap = 8
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  const allowedColumns = Math.max(1, Math.min(maxColumns, Math.floor((safeWidth + columnGap) / Math.max(1, minColumnWidth + columnGap))));
  const columns = Math.max(1, Math.min(maxColumns, allowedColumns, Math.max(1, count || 1)));
  const totalRows = Math.max(1, Math.ceil(Math.max(1, count) / columns));
  const visibleRows = Math.max(1, Math.floor((safeHeight + rowGap) / Math.max(1, rowHeight)));
  const maxScroll = Math.max(0, totalRows - visibleRows);
  const cellWidth = Math.floor((safeWidth - columnGap * Math.max(0, columns - 1)) / columns);
  return {
    columns,
    totalRows,
    visibleRows,
    maxScroll,
    rowHeight,
    buttonHeight,
    rowGap,
    columnGap,
    cellWidth
  };
}

export function getPixelPortraitActionGridMetrics(width, itemCount, {
  minColumnWidth = 82,
  maxColumns = 3,
  rowHeight = 50,
  buttonHeight = 42,
  gap = 8
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  const columns = Math.max(1, Math.min(maxColumns, Math.max(1, Math.floor((safeWidth + gap) / Math.max(1, minColumnWidth + gap))), Math.max(1, count || 1)));
  const cellWidth = Math.floor((safeWidth - gap * Math.max(0, columns - 1)) / columns);
  const rows = Math.max(1, Math.ceil(Math.max(1, count) / columns));
  return {
    columns,
    rows,
    cellWidth,
    rowHeight,
    buttonHeight,
    gap,
    totalHeight: rows * rowHeight
  };
}

export function buildPixelPortraitCanvasActions() {
  return [
    { id: 'canvas-view', label: 'View' },
    { id: 'canvas-bg', label: 'BG' },
    { id: 'canvas-transform', label: 'Transform' },
    { id: 'canvas-export', label: 'Export' }
  ];
}

export function buildPixelPortraitLayerActions() {
  return [
    { id: 'layer-add', label: '+Layer' },
    { id: 'layers-manage', label: 'Manage' },
    { id: 'layers-order', label: 'Order' }
  ];
}

export function buildPixelPortraitFrameActions() {
  return [
    { id: 'frame-add', label: '+Frame' },
    { id: 'frames-manage', label: 'Manage' },
    { id: 'frames-playback', label: 'Play' }
  ];
}

export function buildPixelPortraitCanvasActionGroups() {
  return {
    'canvas-view': {
      title: 'View',
      actions: [
        { id: 'grid', label: 'Grid' },
        { id: 'wrap', label: 'Wrap' },
        { id: 'sym-h', label: 'Sym H' },
        { id: 'sym-v', label: 'Sym V' },
        { id: 'tile-preview', label: 'Tile 3x3' }
      ]
    },
    'canvas-bg': {
      title: 'Background',
      actions: [
        { id: 'bg-white', label: 'White' },
        { id: 'bg-black', label: 'Black' },
        { id: 'bg-check', label: 'Check' },
        { id: 'bg-color', label: 'Color' }
      ]
    },
    'canvas-transform': {
      title: 'Transform',
      actions: [
        { id: 'resize', label: 'Resize' },
        { id: 'scale', label: 'Scale' },
        { id: 'crop', label: 'Crop' },
        { id: 'offset', label: 'Offset' }
      ]
    },
    'canvas-export': {
      title: 'Export',
      actions: [
        { id: 'sprite-sheet', label: 'Sheet' },
        { id: 'export-gif', label: 'GIF' }
      ]
    }
  };
}

export function buildPixelPortraitLayerActionGroups() {
  return {
    'layers-manage': {
      title: 'Manage',
      actions: [
        { id: 'layer-duplicate', label: 'Dup' },
        { id: 'layer-delete', label: 'Delete' },
        { id: 'layer-rename', label: 'Rename' },
        { id: 'layer-visibility', label: 'Show/Hide' },
        { id: 'layer-merge-up', label: 'Merge Up' },
        { id: 'layer-merge-down', label: 'Merge Down' }
      ]
    },
    'layers-order': {
      title: 'Order',
      actions: [
        { id: 'layer-up', label: 'Up' },
        { id: 'layer-down', label: 'Down' },
        { id: 'layer-merge-up', label: 'Merge Up' },
        { id: 'layer-merge-down', label: 'Merge Down' },
        { id: 'layer-flatten', label: 'Flatten' }
      ]
    }
  };
}

export function buildPixelPortraitFrameActionGroups() {
  return {
    'frames-manage': {
      title: 'Manage',
      actions: [
        { id: 'frame-duplicate', label: 'Dup' },
        { id: 'frame-delete', label: 'Delete' },
        { id: 'frame-delay', label: 'Delay' },
        { id: 'frame-loop', label: 'Loop' },
        { id: 'frame-up', label: 'Up' },
        { id: 'frame-down', label: 'Down' }
      ]
    },
    'frames-playback': {
      title: 'Playback',
      actions: [
        { id: 'frame-play', label: 'Play' },
        { id: 'frame-step', label: 'Step' },
        { id: 'frame-rewind', label: 'Rewind' }
      ]
    }
  };
}

export function buildPixelPortraitSelectionActionGroups() {
  return {
    'selection-mode': {
      title: 'Mode',
      actions: [
        { id: 'selection-replace', label: 'None' },
        { id: 'selection-add', label: 'Add' },
        { id: 'selection-subtract', label: 'Subtract' }
      ]
    },
    'selection-clipboard': {
      title: 'Clipboard',
      actions: [
        { id: 'selection-paste', label: 'Paste' },
        { id: 'selection-copy', label: 'Copy' },
        { id: 'selection-cut', label: 'Cut' },
        { id: 'selection-delete', label: 'Delete' }
      ]
    },
    'selection-select': {
      title: 'Select',
      actions: [
        { id: 'selection-all', label: 'All' },
        { id: 'selection-none', label: 'None' },
        { id: 'selection-invert', label: 'Invert' },
        { id: 'selection-grow', label: 'Grow' },
        { id: 'selection-contract', label: 'Contract' }
      ]
    },
    'selection-transform-tools': {
      title: 'Transform',
      actions: [
        { id: 'selection-transform', label: 'Move' },
        { id: 'selection-flip', label: 'Flip' },
        { id: 'selection-rotate', label: 'Rotate' },
        { id: 'selection-skew', label: 'Skew' },
        { id: 'selection-stretch', label: 'Stretch' }
      ]
    }
  };
}

export function buildPixelPortraitSelectionActions() {
  return [
    { id: 'selection-mode', label: 'Mode' },
    { id: 'selection-clipboard', label: 'Clip' },
    { id: 'selection-select', label: 'Select' },
    { id: 'selection-transform-tools', label: 'Tools' }
  ];
}

export function buildPixelPortraitBoneActions() {
  return [
    { id: 'bones', label: 'Build' },
    { id: 'bind', label: 'Rig' },
    { id: 'pose', label: 'Pose' },
    { id: 'time', label: 'Tools' }
  ];
}

export function buildPixelPortraitBoneActionGroups() {
  return {
    bones: {
      title: 'Build',
      actionIds: ['bone-add', 'bone-link', 'bone-reverse', 'bone-stretch', 'bone-ik', 'bone-delete']
    },
    bind: {
      title: 'Rig',
      actionIds: ['bind-mode', 'bind-rect', 'bind-oval', 'bind-lasso', 'bind-magic', 'bind-unassigned', 'bind-add', 'bind-remove', 'bind-layer', 'bind-clear']
    },
    pose: {
      title: 'Pose',
      actionIds: ['pose-target', 'pose-set', 'pose-reset', 'pose-copy', 'pose-paste', 'pose-delete', 'pose-length']
    },
    time: {
      title: 'Controls',
      actionIds: ['time-bake', 'time-hide-bones', 'time-frame-count', 'time-convert-layers', 'time-reverse-layers', 'time-list-bones']
    },
    nodes: {
      title: 'Nodes',
      actionIds: []
    }
  };
}

export function getPixelBoneTimelineDurationMs(poseTimeline = [], editor = {}) {
  const timeline = Array.isArray(poseTimeline) ? poseTimeline : [];
  const maxKeyTime = timeline.reduce((max, key) => Math.max(max, Number(key?.timeMs || 0)), 0);
  return Math.max(
    Number(editor.segmentMs ?? 0),
    Number(editor.durationMs ?? DEFAULT_BONE_TIMELINE_DURATION_MS),
    maxKeyTime
  );
}

export function getPixelBoneBakeSampleTimes(poseTimeline = []) {
  const keyTimes = [...new Set((Array.isArray(poseTimeline) ? poseTimeline : [])
    .map((key) => Number(key?.timeMs))
    .filter((timeMs) => Number.isFinite(timeMs) && timeMs >= 0))]
    .sort((a, b) => a - b);
  if (!keyTimes.length) return [0];
  if (keyTimes.length === 1) return keyTimes;
  const sampleTimes = [];
  for (let index = 0; index < keyTimes.length; index += 1) {
    const timeMs = keyTimes[index];
    if (index > 0) sampleTimes.push((keyTimes[index - 1] + timeMs) / 2);
    sampleTimes.push(timeMs);
  }
  return sampleTimes;
}

export function buildPixelPortraitPaletteRailEntries(recentIndices = [], paletteSize = 0) {
  const max = Math.max(0, Math.floor(Number(paletteSize) || 0));
  const unique = [];
  for (const raw of Array.isArray(recentIndices) ? recentIndices : []) {
    const index = Math.floor(Number(raw));
    if (!Number.isFinite(index) || index < 0 || index >= max || unique.includes(index)) continue;
    unique.push(index);
    if (unique.length >= 4) break;
  }
  return [
    { id: 'eraser', type: 'eraser' },
    ...unique.map((index) => ({ id: `recent-${index}`, type: 'swatch', index })),
    { id: 'palette', type: 'button', label: 'Palette' }
  ];
}

export function quantizePixelPaletteChannel(value, levels = 32) {
  const steps = clamp(Math.round(levels), 2, 256);
  const t = clamp(value, 0, 255) / 255;
  return Math.round((Math.round(t * (steps - 1)) / (steps - 1)) * 255);
}

export function quantizePixelPaletteRgb(rgb, levels = 32) {
  return {
    r: quantizePixelPaletteChannel(rgb?.r ?? 0, levels),
    g: quantizePixelPaletteChannel(rgb?.g ?? 0, levels),
    b: quantizePixelPaletteChannel(rgb?.b ?? 0, levels)
  };
}

function pixelPaletteHsvToRgb(h, s, v) {
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

export function buildPixelQuantizedHueSamples(levels = 32) {
  const count = clamp(Math.round(levels), 8, 64);
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const h = (i / Math.max(1, count - 1)) * 360;
    const rgb = quantizePixelPaletteRgb(pixelPaletteHsvToRgb(h, 1, 1), levels);
    samples.push({ h, rgb });
  }
  return samples;
}

export function getPixelQuantizedHueSampleAt(ratio, levels = 32) {
  const samples = buildPixelQuantizedHueSamples(levels);
  const index = clamp(Math.round(clamp(Number(ratio) || 0, 0, 1) * Math.max(0, samples.length - 1)), 0, Math.max(0, samples.length - 1));
  return samples[index] || { h: 0, rgb: quantizePixelPaletteRgb({ r: 255, g: 0, b: 0 }, levels) };
}

export function buildPixelQuantizedSvSamples(hue, levels = 32) {
  const count = clamp(Math.round(levels), 8, 32);
  const samples = [];
  for (let vy = 0; vy < count; vy += 1) {
    const v = 1 - (vy / Math.max(1, count - 1));
    for (let sx = 0; sx < count; sx += 1) {
      const s = sx / Math.max(1, count - 1);
      const rgb = quantizePixelPaletteRgb(pixelPaletteHsvToRgb(hue, s, v), levels);
      samples.push({ sx, vy, s, v, rgb });
    }
  }
  return { size: count, samples };
}

export function getPixelQuantizedSvSampleAt(hue, xRatio, yRatio, levels = 32) {
  const grid = buildPixelQuantizedSvSamples(hue, levels);
  const sx = clamp(Math.round(clamp(Number(xRatio) || 0, 0, 1) * Math.max(0, grid.size - 1)), 0, Math.max(0, grid.size - 1));
  const vy = clamp(Math.round(clamp(Number(yRatio) || 0, 0, 1) * Math.max(0, grid.size - 1)), 0, Math.max(0, grid.size - 1));
  return grid.samples.find((sample) => sample.sx === sx && sample.vy === vy)
    || { sx, vy, s: 0, v: 0, rgb: quantizePixelPaletteRgb({ r: 0, g: 0, b: 0 }, levels) };
}

export function buildPixelPortraitMenuModel() {
  return {
    rootTabs: [
      { id: 'file', panel: 'file', label: SHARED_EDITOR_LEFT_MENU.fileLabel },
      { id: 'draw', panel: 'draw', label: 'Draw' },
      { id: 'select', panel: 'select', label: 'Select' },
      { id: 'tools', panel: 'tools', label: 'Tools' },
      { id: 'canvas', panel: 'canvas', label: 'Canvas' },
      { id: 'layers', panel: 'layers', label: 'Layers' },
      { id: 'frames', panel: 'animation', label: 'Frames' }
    ],
    toolTabs: [
      { id: 'draw', label: 'Draw' },
      { id: 'select', label: 'Select' },
      { id: 'tools', label: 'Extra' }
    ],
    fileHiddenIds: Array.from(PIXEL_PORTRAIT_FILE_HIDE_IDS),
    canvasUtilityIds: ['copy-image', 'paste-image', 'import-image', 'canvas-export'],
    bottomRailActions: ['menu', 'undo', 'redo', 'brush']
  };
}

export function buildPixelMobileEditorLayout(width, height, {
  isMobile = true,
  drawerOpen = false,
  menuSheetOpen = false
} = {}) {
  if (isMobileLandscapeLayout({ isMobile, viewportWidth: width, viewportHeight: height })) {
    const layout = getSharedMobileLandscapeEditorLayout(width, height, {
      bottomRailHeight: 0,
      reserveRightRail: drawerOpen
    });
    return {
      ...layout,
      orientation: 'landscape',
      paletteStrip: null,
      toolbarStrip: null
    };
  }

  if (isMobilePortraitLayout({ isMobile, viewportWidth: width, viewportHeight: height })) {
    const layout = getSharedMobilePortraitEditorLayout(width, height, {
      middleRailHeight: 96,
      minTopHeight: 230,
      minMainHeight: 220
    });
    const rootRailH = Math.min(112, Math.max(104, Math.floor(layout.menuSheet.h * 0.24)));
    const rootRail = {
      x: layout.menuSheet.x,
      y: layout.menuSheet.y + layout.menuSheet.h - rootRailH,
      w: layout.menuSheet.w,
      h: rootRailH
    };
    const subRail = {
      x: layout.menuSheet.x,
      y: layout.menuSheet.y + layout.gap,
      w: layout.menuSheet.w,
      h: Math.max(1, rootRail.y - layout.gap - (layout.menuSheet.y + layout.gap))
    };
    const paletteStrip = menuSheetOpen
      ? null
      : {
        x: layout.workSurface.x,
        y: Math.max(layout.workSurface.y, layout.actionRail.y - layout.gap - 64),
        w: layout.workSurface.w,
        h: 64
      };
    const zoomStrip = paletteStrip
      ? {
        x: paletteStrip.x,
        y: Math.max(layout.workSurface.y, paletteStrip.y - layout.gap - 38),
        w: paletteStrip.w,
        h: 38
      }
      : null;
    const workSurfaceLimit = zoomStrip || paletteStrip;
    const workSurface = workSurfaceLimit
      ? {
        ...layout.workSurface,
        h: Math.max(1, workSurfaceLimit.y - layout.gap - layout.workSurface.y)
      }
      : layout.workSurface;
    return {
      ...layout,
      leftRail: rootRail,
      rightRail: subRail,
      rootTabs: rootRail,
      sheetContent: subRail,
      rootRail,
      subRail,
      workSurface,
      mainEditor: workSurface,
      orientation: 'portrait',
      paletteStrip,
      zoomStrip,
      toolbarStrip: layout.actionRail
    };
  }

  return null;
}

export function getPixelClipboardPasteOrigin(source, canvasWidth, canvasHeight, viewportBounds = null) {
  const srcW = Math.max(1, Math.floor(Number(source?.width || 1)));
  const srcH = Math.max(1, Math.floor(Number(source?.height || 1)));
  const maxX = Math.max(0, Math.floor(Number(canvasWidth || 0)) - srcW);
  const maxY = Math.max(0, Math.floor(Number(canvasHeight || 0)) - srcH);
  const originX = Number(source?.originX ?? source?.origin?.x);
  const originY = Number(source?.originY ?? source?.origin?.y);
  if (Number.isFinite(originX) && Number.isFinite(originY)) {
    return {
      x: clamp(Math.round(originX), 0, maxX),
      y: clamp(Math.round(originY), 0, maxY)
    };
  }
  const centerCol = Number.isFinite(viewportBounds?.centerCol)
    ? viewportBounds.centerCol
    : Number(canvasWidth || 0) / 2;
  const centerRow = Number.isFinite(viewportBounds?.centerRow)
    ? viewportBounds.centerRow
    : Number(canvasHeight || 0) / 2;
  return {
    x: clamp(Math.round(centerCol - srcW / 2), 0, maxX),
    y: clamp(Math.round(centerRow - srcH / 2), 0, maxY)
  };
}

export function applyPixelClipboardPixelsToLayer({ source, layerPixels, canvasWidth, canvasHeight, origin }) {
  const srcW = Math.max(0, Math.floor(Number(source?.width || 0)));
  const srcH = Math.max(0, Math.floor(Number(source?.height || 0)));
  const width = Math.max(0, Math.floor(Number(canvasWidth || 0)));
  const height = Math.max(0, Math.floor(Number(canvasHeight || 0)));
  const pixels = source?.pixels;
  if (!srcW || !srcH || !pixels || !layerPixels || !width || !height) return null;
  const startX = clamp(Math.round(Number(origin?.x || 0)), 0, Math.max(0, width - srcW));
  const startY = clamp(Math.round(Number(origin?.y || 0)), 0, Math.max(0, height - srcH));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < srcH; y += 1) {
    const dstY = startY + y;
    if (dstY < 0 || dstY >= height) continue;
    for (let x = 0; x < srcW; x += 1) {
      const dstX = startX + x;
      if (dstX < 0 || dstX >= width) continue;
      const value = pixels[y * srcW + x];
      if (!value) continue;
      const index = dstY * width + dstX;
      mask[index] = 1;
      layerPixels[index] = value;
    }
  }
  return { mask, bounds: { x: startX, y: startY, w: srcW, h: srcH } };
}

export default class PixelStudio {
  constructor(game) {
    this.game = game;
    this.sharedMenu = new SharedEditorMenu();
    this.controllerMenu = new ControllerMenuStack({
      siblingOrder: ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames']
    });
    this.tileLibrary = TILE_LIBRARY;
    this.decalEditSession = null;
    this.activeTile = this.tileLibrary[0] || null;
    this.tileIndex = 0;
    this.currentDocumentRef = null;
    this.savedSnapshot = null;
    this.tilePickerMode = false;
    this.tileEditSession = false;
    this.lastTileArtAutosaveAt = 0;
    this.tilePickerScroll = 0;
    this.tilePickerScrollFloat = 0;
    this.tilePickerScrollBounds = null;
    this.tilePickerMaxScroll = 0;
    this.forceArtDocumentSave = false;
    this.pendingSavePromise = null;
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
          if (ctx.decalEditSession?.type === 'actor-state' || !ctx.tileEditSession || ctx.forceArtDocumentSave) {
            return ctx.serializeCurrentAnimationAsArtDocument();
          }
          ctx.syncTileData({ persist: false });
          return ctx.game.world.pixelArt || { tiles: {} };
        },
        isEmptyDocument: (_ctx, data) => {
          if (!data || typeof data !== 'object') return true;
          const frames = Array.isArray(data.frames) ? data.frames : [];
          const hasFramePixels = frames.some((frame) => Array.isArray(frame) && frame.some((value) => typeof value === 'string' && value.trim()));
          if (hasFramePixels) return false;
          const tiles = data.tiles && typeof data.tiles === 'object' ? Object.values(data.tiles) : [];
          const hasTilePixels = tiles.some((tile) => Array.isArray(tile?.frames) && tile.frames.some((frame) => Array.isArray(frame) && frame.some((value) => typeof value === 'string' && value.trim())));
          return !hasTilePixels;
        },
        applyLoadedData: (ctx, data) => {
          if (ctx.shouldLoadArtAsAnimationDocument(data)) {
            ctx.loadAnimationArtDocument(data);
            return;
          }
          ctx.game.world.pixelArt = ctx.normalizeLoadedArtDocument(data);
          ctx.loadTileData({ skipRestore: true });
        },
        afterOpen: (ctx) => {
          ctx.mobileDrawer = null;
          ctx.pixelPortraitSubpanel = null;
          if (ctx.leftPanelTab === 'file') ctx.setLeftPanelTab('draw');
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
      brushHardness: 1,
      brushShape: 'circle',
      brushFalloff: 0,
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
      replaceScope: 'layer',
      hueShiftDegrees: 0,
      hueShiftSaturation: 100,
      cloneRotationDegrees: 0,
      cloneAlphaMode: 'skip'
    };
    this.brushProfiles = {};
    this.refreshDefaultBrushProfiles();
    this.canvasState = {
      width: 256,
      height: 256,
      layers: [createLayer(256, 256, 'Layer 1')],
      activeLayerIndex: 0
    };
    this.palettePresets = [];
    this.customPalettes = loadCustomPalettes();
    this.currentPalette = buildPalette(['#000000', '#ffffff'], 'Temp');
    this.paletteIndex = 1;
    this.secondaryPaletteIndex = 0;
    this.eraserColorActive = false;
    this.colorRegisters = [1, 0];
    this.activeColorRegister = 0;
    this.recentPaletteIndices = [1, 0];
    this.paletteQuantization = 32;
    this.paletteRamps = [];
    this.limitToPalette = false;
    this.selection = {
      active: false,
      mask: null,
      bounds: null,
      mode: null,
      combineMode: 'replace',
      baseMask: null,
      start: null,
      end: null,
      lassoPoints: [],
      floating: null,
      floatingMode: null,
      floatingBounds: null,
      offset: { x: 0, y: 0 }
    };
    this.moveTransformDrag = null;
    this.outsideCanvasTapGesture = { time: 0, x: 0, y: 0 };
    this.clipboard = null;
    this.bonePoseClipboard = null;
    this.magicLassoEdgeMap = null;
    this.magicLassoLastVector = null;
    this.magicLassoEdgeMax = 1;
    this.magicLassoRgbaMap = null;
    this.magicLassoAnchorRgba = null;
    this.view = {
      zoomLevels: [0.03125, 0.0625, 0.125, 0.25, 0.5, 0.75, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32],
      zoomIndex: 14,
      panX: 0,
      panY: 0,
      showGrid: false,
      backgroundMode: 'checker',
      backgroundColor: '#2f3640'
    };
    this.viewportController = createViewportController({
      minZoom: 0,
      maxZoom: this.view.zoomLevels.length - 1,
      zoomStep: 1
    });
    this.tiledPreview = { enabled: false, tiles: 3 };
    this.animation = {
      frames: [createFrame(this.canvasState.layers, DEFAULT_FRAME_DURATION_MS)],
      currentFrameIndex: 0,
      playing: false,
      loop: true,
      onion: { enabled: false, prev: 1, next: 1, opacity: 0.35 }
    };
    this.boneRig = createDefaultBoneRig();
    this.layerContentRevision = 1;
    this.boneDerivedCache = {
      revision: 1,
      layerRevision: 1,
      boneRevision: 1,
      overlay: null,
      overlayRaster: null,
      graphOverlayRaster: null,
      affectedPixelCounts: null,
      composite: null,
      preview: null,
      raster: null,
      geometry: null,
      mesh: null
    };
    this.boneEditor = {
      mode: 'bones',
      submenu: null,
      selectedJointId: null,
      selectedBoneId: null,
      selectedEdgeBoneId: null,
      linkMode: true,
      chainAnchor: null,
      drag: null,
      pendingBindNodeTap: null,
      preview: true,
      timeMs: 0,
      durationMs: DEFAULT_BONE_TIMELINE_DURATION_MS,
      bakeFrameCount: 0,
      reverseRigLayerOrder: false,
      hideBonesDuringPlayback: false,
      playing: false,
      segmentMs: DEFAULT_BONE_TIMELINE_STEP_MS,
      timelineZoom: 1,
      timelineScrollMs: 0
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
    this.cloneSourceSnapshot = null;
    this.cloneAngleCalibration = null;
    this.clonePickSourceArmed = false;
    this.clonePickTargetArmed = false;
    this.cloneColorPickArmed = false;
    this.panStart = null;
    this.longPressTimer = null;
    this.longPressOrigin = null;
    this.transportHold = null;
    this.transportPopover = null;
    this.transportPopoverButtons = [];
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
      toolOptions: 0,
      bones: 0
    };
    this.toolsPanelMeta = null;
    this.toolsListMeta = null;
    this.layerListMeta = null;
    this.frameListMeta = null;
    this.tempToolOverrides = new Map();
    this.menuOpen = false;
    this.controlsOverlayOpen = false;
    this.mobileDrawer = null;
    this.mobileDrawerBounds = null;
    this.pixelPortraitSubpanel = null;
    this.paletteBarScrollBounds = null;
    this.paletteModalSwatchScrollBounds = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
    this.brushPickerBounds = null;
    this.brushPickerSliders = null;
    this.canvasViewportBounds = null;
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
    this.brushPickerFocus = null;
    this.palettePickerDrag = null;
    this.paletteGridOpen = false;
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked = new Set();
    this.transformModal = null;
    this.pasteImportModal = null;
    this.paletteModalBounds = null;
    this.paletteColorPickerBounds = null;
    this.sidebars = { left: true };
    this.leftPanelTabs = ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'animation', 'bones'];
    this.leftPanelTabIndex = 0;
    this.leftPanelTab = this.leftPanelTabs[this.leftPanelTabIndex];
    this.uiButtons = [];
    this.boneUiRegions = [];
    this.boneTimelineMeta = null;
    this.boneTimelineGesture = null;
    this.menuScrollDrag = null;
    this.uiSliderDrag = null;
    this.artSizeDraft = { width: 256, height: 256 };
    this.paletteBounds = [];
    this.layerBounds = [];
    this.frameBounds = [];
    this.statusMessage = '';
    this.lastTime = 0;
    this.selectionMarchPhase = 0;
    this.spaceDown = false;
    this.altDown = false;
    this.lastActiveToolId = this.activeToolId;
    this.offscreen = document.createElement('canvas');
    this.offscreenCtx = this.offscreen.getContext('2d');
    this.offscreenCtx.imageSmoothingEnabled = false;
    this.bonePreviewCanvas = document.createElement('canvas');
    this.bonePreviewCtx = this.bonePreviewCanvas.getContext('2d');
    this.bonePreviewCtx.imageSmoothingEnabled = false;
    this.boneOverlayCanvas = document.createElement('canvas');
    this.boneOverlayCtx = this.boneOverlayCanvas.getContext('2d');
    this.boneOverlayCtx.imageSmoothingEnabled = false;
    this.boneGraphOverlayCanvas = document.createElement('canvas');
    this.boneGraphOverlayCtx = this.boneGraphOverlayCanvas.getContext('2d');
    this.boneGraphOverlayCtx.imageSmoothingEnabled = false;
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
      event.target.value = '';
    });
    this.backgroundColorInput = document.createElement('input');
    this.backgroundColorInput.type = 'color';
    this.backgroundColorInput.value = this.view.backgroundColor;
    this.backgroundColorInput.style.display = 'none';
    document.body.appendChild(this.backgroundColorInput);
    this.backgroundColorInput.addEventListener('input', (event) => {
      const next = typeof event.target.value === 'string' ? event.target.value : '';
      if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
      this.view.backgroundMode = 'color';
      this.view.backgroundColor = next;
    });
    this.imageFileInput = document.createElement('input');
    this.imageFileInput.type = 'file';
    this.imageFileInput.accept = 'image/*';
    this.imageFileInput.style.display = 'none';
    document.body.appendChild(this.imageFileInput);
    this.imageFileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      this.importImageFromFile(file).catch((error) => {
        console.warn('[PixelStudio] Failed to import image.', error);
      });
      event.target.value = '';
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

  async importImageFromFile(file) {
    if (!file) return;
    const image = await new Promise((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = reject;
      next.src = URL.createObjectURL(file);
    });
    const sourceWidth = clamp(Math.round(image.width || 16), 1, ART_DIMENSION_MAX);
    const sourceHeight = clamp(Math.round(image.height || 16), 1, ART_DIMENSION_MAX);
    const scale = Math.min(1, IMPORT_DIMENSION_MAX / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const drawCtx = canvas.getContext('2d');
    drawCtx.imageSmoothingEnabled = false;
    drawCtx.drawImage(image, 0, 0, width, height);
    const pixels = drawCtx.getImageData(0, 0, width, height).data;
    const layer = createLayer(width, height, 'Layer 1');
    for (let i = 0; i < width * height; i += 1) {
      const offset = i * 4;
      layer.pixels[i] = rgbaToUint32({
        r: pixels[offset],
        g: pixels[offset + 1],
        b: pixels[offset + 2],
        a: pixels[offset + 3]
      });
    }
    this.canvasState.width = width;
    this.canvasState.height = height;
    this.animation.frames = [createFrame([layer], DEFAULT_FRAME_DURATION_MS)];
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.clearSelection();
    this.zoomToFitCanvas();
    this.forceArtDocumentSave = true;
    this.tileEditSession = false;
    this.tilePickerMode = false;
    if (this.decalEditSession?.type !== 'actor-state') {
      const rawName = String(file.name || 'imported-art').replace(/\.[^.]+$/, '');
      const suggested = sanitizeProjectFileName(rawName) || 'imported-art';
      this.currentDocumentRef = { folder: 'art', name: suggested };
    }
    this.statusMessage = scale < 1
      ? `Imported ${file.name} (scaled to ${width}x${height})`
      : `Imported ${file.name}`;
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
    this.layerContentRevision = (this.layerContentRevision || 1) + 1;
    this.invalidateBoneDerivedCaches({ layers: true, bones: true });
  }

  markLayerPixelsDirty() {
    this.layerContentRevision = (this.layerContentRevision || 1) + 1;
  }

  invalidateBoneDerivedCaches(options = {}) {
    const invalidateLayers = options.layers !== false;
    const invalidateBones = options.bones !== false;
    if (!this.boneDerivedCache) {
      this.boneDerivedCache = { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, overlayRaster: null, graphOverlayRaster: null, overlayAdjacency: null, affectedPixelCounts: null, composite: null, preview: null, raster: null, geometry: null, mesh: null, rigContext: null, skeletonContext: null };
      return;
    }
    this.boneDerivedCache.revision += 1;
    if (!Object.prototype.hasOwnProperty.call(this.boneDerivedCache, 'layerRevision')) this.boneDerivedCache.layerRevision = this.boneDerivedCache.revision;
    if (!Object.prototype.hasOwnProperty.call(this.boneDerivedCache, 'boneRevision')) this.boneDerivedCache.boneRevision = this.boneDerivedCache.revision;
    if (invalidateLayers) {
      this.boneDerivedCache.layerRevision += 1;
      this.boneDerivedCache.composite = null;
      this.boneDerivedCache.raster = null;
      this.boneDerivedCache.preview = null;
      this.boneDerivedCache.mesh = null;
    }
    if (invalidateBones) {
      this.boneDerivedCache.boneRevision += 1;
      this.boneDerivedCache.overlay = null;
      this.boneDerivedCache.overlayRaster = null;
      this.boneDerivedCache.graphOverlayRaster = null;
      this.boneDerivedCache.overlayAdjacency = null;
      this.boneDerivedCache.affectedPixelCounts = null;
      this.boneDerivedCache.preview = null;
      this.boneDerivedCache.geometry = null;
      this.boneDerivedCache.mesh = null;
      this.boneDerivedCache.rigContext = null;
      this.boneDerivedCache.skeletonContext = null;
    }
  }

  getCachedBoneRigContext() {
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, rigContext: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision ?? 1;
    const existing = cache.rigContext;
    if (existing
      && existing.sourceRig === this.boneRig
      && existing.boneRevision === boneRevision) {
      return existing;
    }
    const normalizedRig = normalizeBoneRig(this.boneRig, { exclusive: false });
    const graph = buildBoneGraph(normalizedRig);
    cache.rigContext = {
      sourceRig: this.boneRig,
      boneRevision,
      normalizedRig,
      graph
    };
    return cache.rigContext;
  }

  getCachedBoneSkeletonContext() {
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, skeletonContext: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision ?? 1;
    const existing = cache.skeletonContext;
    if (existing
      && existing.sourceRig === this.boneRig
      && existing.boneRevision === boneRevision) {
      return existing;
    }
    const normalizedRig = normalizeBoneSkeleton(this.boneRig);
    const graph = buildBoneGraph(normalizedRig);
    const jointUsageCounts = new Map();
    normalizedRig.bones.forEach((bone) => {
      jointUsageCounts.set(bone.startJointId, (jointUsageCounts.get(bone.startJointId) || 0) + 1);
      jointUsageCounts.set(bone.endJointId, (jointUsageCounts.get(bone.endJointId) || 0) + 1);
    });
    cache.skeletonContext = {
      sourceRig: this.boneRig,
      boneRevision,
      normalizedRig,
      graph,
      jointUsageCounts
    };
    return cache.skeletonContext;
  }

  restoreStoredTileArtIfNeeded() {
    if (this.currentDocumentRef?.folder === 'art' && !this.tilePickerMode) return;
    const store = ensurePixelArtStore(this.game.world);
    // Restore logic must be data-driven, not route-driven: PixelStudio can be entered from
    // multiple UI flows, and navigation state should not decide whether persisted art reloads.
    const hadLoadedInMemory = this.hasLoadedPixelArtData(store);
    if (Object.keys(store.tiles || {}).length) {
      this.hydrateTileArtRefs();
    }
    const currentFolder = this.currentDocumentRef?.folder || null;
    if (hadLoadedInMemory && !this.tilePickerMode && currentFolder !== 'levels') {
      return;
    }
    const autosave = loadProjectFile('art', 'Tile Art Autosave');
    const autosaveHasTiles = Object.keys(autosave?.data?.tiles || {}).length > 0;
    if (autosave?.data && autosaveHasTiles) {
      const normalized = this.normalizeLoadedArtDocument(autosave.data);
      if (this.hasLoadedPixelArtData(normalized)) {
        this.game.world.pixelArt = normalized;
        this.hydrateTileArtRefs();
        this.currentDocumentRef = { folder: 'art', name: 'Tile Art Autosave' };
        return;
      }
    }
    const levelAutosave = loadProjectFile('levels', 'Level Editor Autosave');
    const levelPixelArt = levelAutosave?.data?.pixelArt;
    const levelAutosaveHasTiles = Object.keys(levelPixelArt?.tiles || {}).length > 0;
    if (levelAutosaveHasTiles) {
      const normalized = this.normalizeLoadedArtDocument(levelPixelArt);
      if (this.hasLoadedPixelArtData(normalized)) {
        this.game.world.pixelArt = normalized;
        this.hydrateTileArtRefs();
        this.currentDocumentRef = { folder: 'levels', name: 'Level Editor Autosave' };
        return;
      }
    }
    if (hadLoadedInMemory || this.hasLoadedPixelArtData(store)) return;
    const latestTileArt = this.findLatestTileArtDocument();
    const payload = latestTileArt?.payload || null;
    if (payload?.data) {
      this.game.world.pixelArt = this.normalizeLoadedArtDocument(payload.data);
      this.hydrateTileArtRefs();
      this.currentDocumentRef = { folder: 'art', name: latestTileArt.entry.name };
    }
  }

  hasLoadedPixelArtData(pixelArt = this.game?.world?.pixelArt) {
    const tiles = pixelArt?.tiles;
    if (!tiles || typeof tiles !== 'object') return false;
    return Object.values(tiles).some((tileData) => {
      if (!tileData || typeof tileData !== 'object') return false;
      if (!this.isTileArtEntry(tileData)) return false;
      const hasRef = typeof tileData.ref === 'string' && tileData.ref.length > 0;
      const frameCount = Array.isArray(tileData.frames) ? tileData.frames.length : 0;
      const editorFrameCount = Array.isArray(tileData.editor?.frames) ? tileData.editor.frames.length : 0;
      return editorFrameCount > 0 || (hasRef && frameCount > 0);
    });
  }

  isTileArtDocument(data, options = {}) {
    if (!data || typeof data !== 'object') return false;
    if (data.kind === 'actor-state-animation') return false;
    if (data.tiles && typeof data.tiles === 'object') {
      return Object.values(data.tiles).some((entry) => this.isTileArtEntry(entry, options));
    }
    return this.isTileArtEntry(data, options) && !data.kind;
  }

  isTileArtEntry(entry, { resolveRef = false } = {}) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.kind === 'actor-state-animation') return false;
    if (resolveRef && entry.ref) {
      const payload = loadProjectFile('art', entry.ref);
      if (!payload?.data || !this.isTileArtEntry(payload.data, { resolveRef: false })) {
        return false;
      }
    }
    const frameLength = Array.isArray(entry.frames?.[0]) ? entry.frames[0].length : 0;
    const inferredFrameSize = frameLength > 0 ? Math.sqrt(frameLength) : 0;
    const width = Number(entry.width || entry.editor?.width || entry.size || inferredFrameSize || 0);
    const height = Number(entry.height || entry.editor?.height || entry.size || width || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      if (!resolveRef || !entry.ref) return false;
      const payload = loadProjectFile('art', entry.ref);
      return payload?.data ? this.isTileArtEntry(payload.data, { resolveRef: false }) : false;
    }
    return width <= MAX_TILE_ART_DIMENSION && height <= MAX_TILE_ART_DIMENSION;
  }

  findLatestTileArtDocument() {
    const files = listProjectFiles('art');
    for (const entry of files) {
      if (!entry?.name) continue;
      const payload = loadProjectFile('art', entry.name);
      if (this.isTileArtDocument(payload?.data, { resolveRef: true })) {
        return { entry, payload };
      }
    }
    return null;
  }

  getLegacyTileArtDocName(tileChar) {
    const code = String(tileChar || '').charCodeAt(0);
    const safeCode = Number.isFinite(code) ? code.toString(16).padStart(2, '0') : '00';
    return `Tile Art ${safeCode}`;
  }

  getTileArtDocName(tileChar, tile = null) {
    const matchedTile = tile?.id
      ? tile
      : this.tileLibrary?.find((entry) => entry?.char === tileChar);
    const tileId = sanitizeProjectFileName(matchedTile?.id || '');
    if (tileId) return `Tile Art ${tileId}`;
    return this.getLegacyTileArtDocName(tileChar);
  }

  hydrateTileArtRefs() {
    const store = ensurePixelArtStore(this.game.world);
    Object.entries(store.tiles).forEach(([tileChar, tileData]) => {
      this.hydrateTileArtRef(tileChar, tileData, store);
    });
  }

  hydrateTileArtRef(tileChar, tileData, storeOverride = null) {
    if (!tileData || typeof tileData !== 'object') return tileData;
    if ((tileData.frames && tileData.frames.length) || (tileData.editor && tileData.editor.frames)) return tileData;
    if (!tileData.ref) return tileData;
    const payload = loadProjectFile('art', tileData.ref);
    if (!payload?.data || !this.isTileArtEntry(payload.data, { resolveRef: false })) return tileData;
    const hydrated = { ...payload.data, ref: tileData.ref };
    const store = storeOverride || ensurePixelArtStore(this.game.world);
    store.tiles[tileChar] = hydrated;
    return hydrated;
  }

  loadTileData(options = {}) {
    if (!options.skipRestore) {
      this.restoreStoredTileArtIfNeeded();
    }
    ensurePixelArtStore(this.game.world);
    const tileChar = this.activeTile?.char;
    if (!tileChar) return;
    const pixelData = ensurePixelTileData(this.game.world, tileChar, { size: 16, fps: 6 });
    const normalizeEditorData = (editor, fallbackSize) => {
      const width = Math.max(1, Number(editor?.width) || fallbackSize);
      const height = Math.max(1, Number(editor?.height) || fallbackSize);
      const total = width * height;
      const frames = Array.isArray(editor?.frames) ? editor.frames : [];
      const normalizedFrames = frames.map((frame) => ({
        durationMs: Math.max(20, Number(frame?.durationMs) || DEFAULT_FRAME_DURATION_MS),
        layers: (Array.isArray(frame?.layers) ? frame.layers : []).map((layer, index) => {
          const pixels = new Uint32Array(total);
          const source = layer?.pixels;
          if (source) {
            for (let i = 0; i < total; i += 1) {
              const value = Number(source[i] || 0);
              pixels[i] = Number.isFinite(value) ? (value >>> 0) : 0;
            }
          }
          return {
            name: layer?.name || `Layer ${index + 1}`,
            visible: layer?.visible !== false,
            locked: Boolean(layer?.locked),
            opacity: Number.isFinite(layer?.opacity) ? layer.opacity : 1,
            pixels
          };
        })
      }));
      if (!normalizedFrames.length || !normalizedFrames[0].layers.length) {
        normalizedFrames.length = 0;
        normalizedFrames.push(createFrame([createLayer(width, height, 'Layer 1')], DEFAULT_FRAME_DURATION_MS));
      }
      return {
        width,
        height,
        frames: normalizedFrames,
        activeLayerIndex: clamp(Number(editor?.activeLayerIndex) || 0, 0, normalizedFrames[0].layers.length - 1)
      };
    };
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
        frames: [createFrame([baseLayer], DEFAULT_FRAME_DURATION_MS)],
        activeLayerIndex: 0
      };
    } else {
      pixelData.editor = normalizeEditorData(pixelData.editor, pixelData.size || 16);
      const firstLayerPixels = pixelData.editor.frames?.[0]?.layers?.[0]?.pixels;
      const hasEditorPixels = firstLayerPixels && Array.from(firstLayerPixels).some((value) => (value >>> 24) > 0);
      const frameSource = Array.isArray(pixelData.frames) ? pixelData.frames[0] : null;
      const hasFrameColors = Array.isArray(frameSource) && frameSource.some((color) => typeof color === 'string');
      if (!hasEditorPixels && hasFrameColors) {
        const width = pixelData.editor.width;
        const height = pixelData.editor.height;
        const rebuilt = createLayer(width, height, 'Layer 1');
        for (let i = 0; i < width * height; i += 1) {
          const color = frameSource[i];
          if (!color) continue;
          rebuilt.pixels[i] = rgbaToUint32(hexToRgba(color));
        }
        pixelData.editor.frames = [createFrame([rebuilt], DEFAULT_FRAME_DURATION_MS)];
        pixelData.editor.activeLayerIndex = 0;
      }
    }
    this.forceArtDocumentSave = false;
    this.pendingSavePromise = null;
    this.canvasState.width = pixelData.editor.width;
    this.canvasState.height = pixelData.editor.height;
    this.animation.frames = pixelData.editor.frames;
    if (!this.boneEditor) this.boneEditor = { mode: 'bones', submenu: null, selectedJointId: null, selectedBoneId: null, selectedEdgeBoneId: null, linkMode: true, chainAnchor: null, drag: null, pendingBindNodeTap: null, preview: true, timeMs: 0, durationMs: DEFAULT_BONE_TIMELINE_DURATION_MS, bakeFrameCount: 0, reverseRigLayerOrder: false, hideBonesDuringPlayback: false, playing: false, segmentMs: DEFAULT_BONE_TIMELINE_STEP_MS, timelineZoom: 1, timelineScrollMs: 0 };
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'submenu')) this.boneEditor.submenu = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'selectedJointId')) this.boneEditor.selectedJointId = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'selectedEdgeBoneId')) this.boneEditor.selectedEdgeBoneId = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'linkMode')) this.boneEditor.linkMode = true;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'chainAnchor')) this.boneEditor.chainAnchor = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'timelineZoom')) this.boneEditor.timelineZoom = 1;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'timelineScrollMs')) this.boneEditor.timelineScrollMs = 0;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'bakeFrameCount')) this.boneEditor.bakeFrameCount = 0;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'reverseRigLayerOrder')) this.boneEditor.reverseRigLayerOrder = false;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'hideBonesDuringPlayback')) this.boneEditor.hideBonesDuringPlayback = false;
    this.resetLoadedBoneEditorState?.();
    this.boneRig = normalizeBoneRig(pixelData.editor.bones || createDefaultBoneRig());
    if (typeof this.ensureBoneNodeSelection === 'function') {
      this.ensureBoneNodeSelection();
    } else {
      this.boneEditor.selectedJointId = this.boneRig.bones[0]?.endJointId || this.boneRig.bones[0]?.startJointId || this.boneRig.joints[0]?.id || null;
      this.boneEditor.selectedBoneId = this.boneRig.bones[0]?.id || null;
    }
    this.boneEditor.durationMs = Math.max(this.boneEditor.segmentMs || DEFAULT_BONE_TIMELINE_STEP_MS, getPixelBoneTimelineDurationMs(this.boneRig.poseTimeline || [], { segmentMs: 0, durationMs: 0 }));
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = pixelData.editor.activeLayerIndex || 0;
    this.artSizeDraft.width = this.canvasState.width;
    this.artSizeDraft.height = this.canvasState.height;
    this.setFrameLayers(this.animation.frames[0].layers);
  }

  syncTileData({ persist = true } = {}) {
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
      activeLayerIndex: this.canvasState.activeLayerIndex,
      bones: cloneBoneRig(this.boneRig)
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
    if (persist) {
      const tileDocName = this.getTileArtDocName(tileChar, this.activeTile);
      const tileDocPayload = {
        size: pixelData.size,
        fps: pixelData.fps,
        frames: pixelData.frames,
        editor: pixelData.editor
      };
      const savedDoc = saveProjectFile('art', tileDocName, tileDocPayload, { createVersion: false });
      if (savedDoc?.name) {
        pixelData.ref = savedDoc.name;
      }
      this.persistTileArtAutosave();
    }
  }

  serializeCurrentAnimationAsArtDocument() {
    const width = Math.max(1, this.canvasState.width | 0);
    const height = Math.max(1, this.canvasState.height | 0);
    const size = width === height ? width : undefined;
    const frames = this.animation.frames.map((frame) => {
      const composite = compositeLayers(frame.layers, width, height);
      return Array.from(composite).map((value) => {
        if (!value) return null;
        const rgba = uint32ToRgba(value);
        if (rgba.a === 0) return null;
        return `#${[rgba.r, rgba.g, rgba.b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
      });
    });
    return {
      kind: 'actor-state-animation',
      width,
      height,
      ...(Number.isFinite(size) ? { size } : {}),
      fps: Math.max(1, Math.round(1000 / Math.max(1, Number(this.animation.frames[0]?.durationMs || DEFAULT_FRAME_DURATION_MS)))),
      frames,
      editor: {
        width,
        height,
        activeLayerIndex: this.canvasState.activeLayerIndex,
        frames: this.animation.frames,
        bones: cloneBoneRig(this.boneRig)
      }
    };
  }

  shouldLoadArtAsAnimationDocument(data) {
    if (this.decalEditSession?.type === 'actor-state') return true;
    if (!this.tileEditSession || this.forceArtDocumentSave) return true;
    if (data?.kind === 'actor-state-animation') return true;
    return false;
  }

  loadAnimationArtDocument(data = {}) {
    const inferredWidth = Number.isFinite(data?.editor?.width) ? Math.max(1, Math.round(data.editor.width)) : null;
    const inferredHeight = Number.isFinite(data?.editor?.height) ? Math.max(1, Math.round(data.editor.height)) : null;
    const frameWidth = Number.isFinite(data?.width) ? Math.max(1, Math.round(data.width)) : null;
    const frameHeight = Number.isFinite(data?.height) ? Math.max(1, Math.round(data.height)) : null;
    const inferredSize = Number.isFinite(data?.size) ? Math.max(1, Math.round(data.size)) : null;
    const width = clamp(inferredWidth || frameWidth || inferredSize || 16, ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const height = clamp(inferredHeight || frameHeight || inferredSize || width, ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const durationMs = Math.round(1000 / Math.max(1, Number(data?.fps || 8)));
    const normalizeLayerPixels = (source) => {
      const layer = createLayer(width, height, 'Layer 1');
      for (let i = 0; i < width * height; i += 1) {
        const value = source?.[i];
        if (typeof value === 'number') {
          layer.pixels[i] = value >>> 0;
        } else if (typeof value === 'string' && value.trim()) {
          layer.pixels[i] = rgbaToUint32(hexToRgba(value));
        }
      }
      return layer;
    };
    const editorFrames = Array.isArray(data?.editor?.frames) ? data.editor.frames : [];
    const loadedFrames = editorFrames.length
      ? editorFrames.map((frame) => {
          const layers = (Array.isArray(frame?.layers) && frame.layers.length ? frame.layers : [{ pixels: [] }]).map((layer, index) => ({
            ...normalizeLayerPixels(layer?.pixels || []),
            name: layer?.name || `Layer ${index + 1}`,
            visible: layer?.visible !== false,
            locked: Boolean(layer?.locked),
            opacity: Number.isFinite(layer?.opacity) ? layer.opacity : 1
          }));
          return createFrame(layers, Number(frame?.durationMs || durationMs));
        })
      : (Array.isArray(data?.frames) && data.frames.length
          ? data.frames.map((frame) => createFrame([normalizeLayerPixels(frame || [])], durationMs))
          : [createFrame([createLayer(width, height, 'Layer 1')], DEFAULT_FRAME_DURATION_MS)]);
    this.tileEditSession = false;
    this.tilePickerMode = false;
    this.forceArtDocumentSave = true;
    this.canvasState.width = width;
    this.canvasState.height = height;
    this.animation.frames = loadedFrames;
    if (!this.boneEditor) this.boneEditor = { mode: 'bones', submenu: null, selectedJointId: null, selectedBoneId: null, selectedEdgeBoneId: null, linkMode: true, chainAnchor: null, drag: null, pendingBindNodeTap: null, preview: true, timeMs: 0, durationMs: DEFAULT_BONE_TIMELINE_DURATION_MS, bakeFrameCount: 0, reverseRigLayerOrder: false, hideBonesDuringPlayback: false, playing: false, segmentMs: DEFAULT_BONE_TIMELINE_STEP_MS, timelineZoom: 1, timelineScrollMs: 0 };
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'submenu')) this.boneEditor.submenu = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'selectedJointId')) this.boneEditor.selectedJointId = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'selectedEdgeBoneId')) this.boneEditor.selectedEdgeBoneId = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'linkMode')) this.boneEditor.linkMode = true;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'chainAnchor')) this.boneEditor.chainAnchor = null;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'timelineZoom')) this.boneEditor.timelineZoom = 1;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'timelineScrollMs')) this.boneEditor.timelineScrollMs = 0;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'bakeFrameCount')) this.boneEditor.bakeFrameCount = 0;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'reverseRigLayerOrder')) this.boneEditor.reverseRigLayerOrder = false;
    if (!Object.prototype.hasOwnProperty.call(this.boneEditor, 'hideBonesDuringPlayback')) this.boneEditor.hideBonesDuringPlayback = false;
    this.resetLoadedBoneEditorState?.();
    this.boneRig = normalizeBoneRig(data?.editor?.bones || data?.bones || createDefaultBoneRig());
    if (typeof this.ensureBoneNodeSelection === 'function') {
      this.ensureBoneNodeSelection();
    } else {
      this.boneEditor.selectedJointId = this.boneRig.bones[0]?.endJointId || this.boneRig.bones[0]?.startJointId || this.boneRig.joints[0]?.id || null;
      this.boneEditor.selectedBoneId = this.boneRig.bones[0]?.id || null;
    }
    this.boneEditor.durationMs = Math.max(this.boneEditor.segmentMs || DEFAULT_BONE_TIMELINE_STEP_MS, getPixelBoneTimelineDurationMs(this.boneRig.poseTimeline || [], { segmentMs: 0, durationMs: 0 }));
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = clamp(Number(data?.editor?.activeLayerIndex) || 0, 0, this.animation.frames[0].layers.length - 1);
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.clearSelection?.();
    this.zoomToFitCanvas?.();
  }

  normalizeLoadedArtDocument(data) {
    if (!this.isTileArtDocument(data, { resolveRef: true })) {
      return { tiles: {} };
    }
    if (data?.tiles && typeof data.tiles === 'object') {
      const tileChar = this.activeTile?.char || this.tileLibrary?.[0]?.char || '#';
      const nextTiles = Object.fromEntries(
        Object.entries(data.tiles).filter(([, entry]) => this.isTileArtEntry(entry, { resolveRef: true }))
      );
      const firstEntry = Object.values(nextTiles).find((entry) => entry && typeof entry === 'object');
      if (!firstEntry) return { tiles: {} };
      if (tileChar && !nextTiles[tileChar]) nextTiles[tileChar] = firstEntry;
      if (!nextTiles['#']) nextTiles['#'] = firstEntry;
      return { ...data, tiles: nextTiles };
    }
    const hasFrameArray = Array.isArray(data?.frames) && data.frames.length > 0;
    if (!hasFrameArray) {
      return { tiles: {} };
    }
    const tileChar = this.activeTile?.char || this.tileLibrary?.[0]?.char || '#';
    const inferredWidth = Number.isFinite(data?.width) ? Math.max(1, Math.round(data.width)) : null;
    const inferredHeight = Number.isFinite(data?.height) ? Math.max(1, Math.round(data.height)) : null;
    const inferredSize = Number.isFinite(data?.size) ? Math.max(1, Math.round(data.size)) : null;
    const width = inferredWidth || inferredSize || 16;
    const height = inferredHeight || inferredSize || width;
    const size = inferredSize || width;
    const editor = data?.editor && typeof data.editor === 'object'
      ? data.editor
      : {
          width,
          height,
          frames: data.frames.map((frame) => {
            const layer = createLayer(width, height, 'Layer 1');
            for (let i = 0; i < width * height; i += 1) {
              const color = frame?.[i];
              if (!color) continue;
              layer.pixels[i] = rgbaToUint32(hexToRgba(color));
            }
            return createFrame([layer], Math.round(1000 / Math.max(1, Number(data?.fps || 8))));
          }),
          activeLayerIndex: 0
        };
    const tileEntry = {
      size,
      fps: Math.max(1, Number(data?.fps || 8)),
      frames: data.frames,
      editor
    };
    return {
      tiles: {
        [tileChar]: tileEntry,
        '#': tileEntry
      }
    };
  }

  buildActorStateArtDocName(actorId, stateId) {
    const slugifyPart = (value, fallback) => String(value || fallback || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
    const actor = slugifyPart(actorId, 'actor');
    const state = slugifyPart(stateId, 'state');
    return `${actor}-${state}-art`;
  }

  persistTileArtAutosave(force = false) {
    const now = Date.now();
    if (!force && now - this.lastTileArtAutosaveAt < 1000) return;
    this.lastTileArtAutosaveAt = now;
    const store = ensurePixelArtStore(this.game.world);
    const refs = {};
    Object.entries(store.tiles).forEach(([tileChar, tileData]) => {
      if (!tileData) return;
      const hasResolvableEntry = this.isTileArtEntry(tileData, { resolveRef: true });
      const hasInlineEntry = this.isTileArtEntry(tileData, { resolveRef: false });
      if (!hasResolvableEntry && !hasInlineEntry) return;
      const existingRef = typeof tileData.ref === 'string' ? tileData.ref : null;
      const preferredDocName = this.getTileArtDocName(tileChar);
      const legacyDocName = this.getLegacyTileArtDocName(tileChar);
      const shouldMigrateGeneratedRef = existingRef && existingRef === legacyDocName && preferredDocName !== legacyDocName;
      const docName = shouldMigrateGeneratedRef ? preferredDocName : (existingRef || preferredDocName);
      if (!existingRef || shouldMigrateGeneratedRef) {
        const tileDocPayload = {
          size: tileData.size,
          fps: tileData.fps,
          frames: tileData.frames,
          editor: tileData.editor
        };
        const savedTileDoc = saveProjectFile('art', docName, tileDocPayload, { createVersion: false });
        if (savedTileDoc?.name) {
          tileData.ref = savedTileDoc.name;
        }
      }
      refs[tileChar] = {
        ref: tileData.ref || docName,
        size: tileData.size,
        fps: tileData.fps,
        frames: tileData.frames,
        editor: tileData.editor
      };
    });
    if (!Object.keys(refs).length) {
      if (force) {
        const existingAutosave = loadProjectFile('art', 'Tile Art Autosave');
        const existingTiles = existingAutosave?.data?.tiles || {};
        if (!Object.keys(existingTiles).length) {
          saveProjectFile('art', 'Tile Art Autosave', { tiles: {} }, { createVersion: false });
        }
      }
      return;
    }
    const saved = saveProjectFile('art', 'Tile Art Autosave', { tiles: refs }, { createVersion: false });
    if (saved && this.tilePickerMode && !this.forceArtDocumentSave) {
      this.currentDocumentRef = { folder: 'art', name: saved.name };
    }
  }

  resetActiveTileArt() {
    if (this.decalEditSession) return;
    const tileChar = this.activeTile?.char;
    if (!tileChar || !this.game?.world?.pixelArt?.tiles) return;
    delete this.game.world.pixelArt.tiles[tileChar];
    this.persistTileArtAutosave(true);
    this.loadTileData({ skipRestore: true });
    this.game.editor?.persistAutosave?.();
  }

  setTilePickerMode(enabled) {
    this.tilePickerMode = Boolean(enabled);
    this.tileEditSession = this.tilePickerMode;
    if (this.tilePickerMode) {
      this.restoreStoredTileArtIfNeeded();
      this.hydrateTileArtRefs();
    }
  }

  exitTilePicker() {
    const returnState = this.game?.pixelStudioReturnState;
    this.game.exitPixelStudio({ toTitle: !['editor', 'actor-editor'].includes(returnState) });
  }

  drawTilePickerScreen(ctx, width, height) {
    const portrait = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: width,
      viewportHeight: height
    });
    const rowH = portrait ? 112 : 80;
    const previewSize = portrait ? 34 : 24;
    const listOuter = portrait
      ? (() => {
        const layout = getSharedMobilePortraitEditorLayout(width, height, {
          middleRailHeight: 96,
          maxBottomRailHeight: 96,
          minTopHeight: 160,
          minMainHeight: 220,
          sheetRatio: 0.32
        });
        const railLayout = getSharedPortraitActionRailLayout(layout.middleRail);
        this.panJoystick.center = railLayout.thumbstickCenter;
        this.panJoystick.radius = railLayout.thumbstickRadius;
        this.panJoystick.knobRadius = railLayout.knobRadius;
        this.mobileZoomSliderBounds = null;
        this.mobileZoomDrag = null;
        drawSharedPanel(ctx, layout.mainEditor, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
        drawSharedPanel(ctx, layout.middleRail, { fill: UI_SUITE.colors.panelStrong, border: UI_SUITE.colors.border });
        drawSharedThumbstick(ctx, this.panJoystick);
        const backBounds = {
          x: railLayout.actionArea.x,
          y: railLayout.actionArea.y,
          w: Math.min(104, railLayout.actionArea.w),
          h: Math.min(UI_SUITE.spacing.tap, railLayout.actionArea.h)
        };
        this.drawButton(ctx, backBounds, 'Back', false, { fontSize: 12 });
        this.uiButtons.push({ bounds: backBounds, onClick: () => this.exitTilePicker() });
        return {
          x: layout.mainEditor.x + 10,
          y: layout.mainEditor.y + 56,
          w: layout.mainEditor.w - 20,
          h: Math.max(80, layout.mainEditor.h - 70),
          titleX: layout.mainEditor.x + 14,
          titleY: layout.mainEditor.y + 28
        };
      })()
      : {
        x: 28,
        y: 96,
        w: width - 56,
        h: Math.max(80, height - 120),
        titleX: 28,
        titleY: 42
      };
    const left = listOuter.x;
    const startY = listOuter.y;
    const tiles = this.tileLibrary.filter((tile) => tile?.char);
    ctx.fillStyle = '#fff';
    ctx.font = `${portrait ? 20 : 24}px Courier New`;
    ctx.fillText('Tile Editor', listOuter.titleX, listOuter.titleY);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '13px Courier New';
    if (!portrait) {
      ctx.fillText('Pick a tile, then Edit or Reset.', left, 64);
      const backBounds = { x: width - 120, y: 20, w: 92, h: 36 };
      this.drawButton(ctx, backBounds, 'Back', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: backBounds, onClick: () => this.exitTilePicker() });
    } else {
      ctx.fillText('Pick a tile to edit or reset.', listOuter.titleX, listOuter.titleY + 22);
    }
    const listHeight = Math.max(rowH, listOuter.h);
    const visibleRows = Math.max(1, Math.floor(listHeight / rowH));
    this.tilePickerMaxScroll = Math.max(0, tiles.length - visibleRows);
    this.tilePickerScroll = clamp(this.tilePickerScroll || 0, 0, this.tilePickerMaxScroll);
    this.tilePickerScrollFloat = clamp(this.tilePickerScrollFloat ?? this.tilePickerScroll, 0, this.tilePickerMaxScroll);
    this.tilePickerScrollBounds = { x: left, y: startY, w: listOuter.w, h: visibleRows * rowH, rowH };
    tiles.slice(this.tilePickerScroll, this.tilePickerScroll + visibleRows).forEach((tile, visibleIndex) => {
      const index = this.tilePickerScroll + visibleIndex;
      const y = startY + visibleIndex * rowH;
      const rowBounds = { x: left, y, w: listOuter.w, h: rowH - 6 };
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(rowBounds.x, rowBounds.y, rowBounds.w, rowBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(rowBounds.x, rowBounds.y, rowBounds.w, rowBounds.h);
      ctx.fillStyle = '#111';
      ctx.fillRect(left + 8, y + 5, previewSize, previewSize);
      const tileData = this.hydrateTileArtRef(tile.char, this.game.world.pixelArt?.tiles?.[tile.char]);
      const frame = ensurePixelPreviewFrame(tileData, 0) || null;
      if (frame?.length) {
        const size = tileData.size || 16;
        const pixelSize = previewSize / size;
        for (let py = 0; py < size; py += 1) {
          for (let px = 0; px < size; px += 1) {
            const color = frame[py * size + px];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(left + 8 + px * pixelSize, y + 5 + py * pixelSize, pixelSize, pixelSize);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 14px Courier New';
        ctx.fillText(tile.char, left + 18, y + 21);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      const labelX = left + previewSize + 18;
      ctx.fillText(`${tile.label} [${tile.char}]`, labelX, y + (portrait ? 24 : 22));
      const buttonH = portrait ? UI_SUITE.spacing.tap : 36;
      const buttonW = portrait ? Math.max(76, Math.min(96, Math.floor((rowBounds.w - 16) / 2))) : 82;
      const resetW = portrait ? buttonW : 92;
      const actionY = portrait ? y + rowH - buttonH - 12 : y + 6;
      const actionX = portrait ? left + 8 : Math.max(left + 160, left + rowBounds.w - 184);
      const editBounds = { x: actionX, y: actionY, w: buttonW, h: buttonH };
      const resetBounds = { x: actionX + buttonW + 8, y: actionY, w: resetW, h: buttonH };
      this.drawButton(ctx, editBounds, 'Edit', false, { fontSize: portrait ? 12 : 11 });
      this.drawButton(ctx, resetBounds, 'Reset', false, { fontSize: portrait ? 12 : 11 });
      this.uiButtons.push({
        bounds: editBounds,
        onClick: () => {
          this.setActiveTile(tile);
          this.tilePickerMode = false;
        }
      });
      this.uiButtons.push({
        bounds: resetBounds,
        onClick: () => {
          this.setActiveTile(tile);
          this.resetActiveTileArt();
        }
      });
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '11px Courier New';
      ctx.fillText(`${index + 1}/${tiles.length}`, labelX, y + (portrait ? 46 : 42));
    });
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

  async saveDecalSessionAndReturn() {
    if (!this.decalEditSession) return;
    if (this.decalEditSession.type === 'actor-state') {
      const saved = await this.saveArtDocument();
      if (!saved) return;
      this.decalEditSession = null;
      this.game.exitPixelStudio();
      return;
    }
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
    const width = clamp(Math.round(image.width || 16), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const height = clamp(Math.round(image.height || 16), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
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
    this.animation.frames = [createFrame([layer], DEFAULT_FRAME_DURATION_MS)];
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.resetFocus();
  }


  async loadActorStateImageForEditing({ actorId, stateId, animation = {}, documentName = '', onCommit = null } = {}) {
    const fallbackWidth = 32;
    const fallbackHeight = 32;
    const artRefDoc = typeof animation?.artRef === 'string' && animation.artRef
      ? loadProjectFile('art', animation.artRef)
      : null;
    const sourceFramesFromArtDoc = Array.isArray(artRefDoc?.data?.frames)
      ? artRefDoc.data.frames
      : [];
    const inlineSources = Array.isArray(animation?.frames) && animation.frames.length
      ? animation.frames.filter((frame) => frame?.imageDataUrl)
      : (animation?.imageDataUrl
          ? [{ imageDataUrl: animation.imageDataUrl, durationMs: Math.round(1000 / Math.max(1, Number(animation?.fps || 8))) }]
          : []);
    const artRefSources = sourceFramesFromArtDoc.map((frame, frameIndex) => {
              const width = Math.max(1, Number(artRefDoc?.data?.width || artRefDoc?.data?.size || fallbackWidth));
              const height = Math.max(1, Number(artRefDoc?.data?.height || artRefDoc?.data?.size || fallbackHeight));
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const drawCtx = canvas.getContext('2d');
              const imageData = drawCtx.createImageData(width, height);
              for (let i = 0; i < width * height; i += 1) {
                const rgba = hexToRgba(frame?.[i] || '#000000');
                const base = i * 4;
                imageData.data[base] = rgba.r;
                imageData.data[base + 1] = rgba.g;
                imageData.data[base + 2] = rgba.b;
                imageData.data[base + 3] = frame?.[i] ? 255 : 0;
              }
              drawCtx.putImageData(imageData, 0, 0);
              return {
                imageDataUrl: canvas.toDataURL('image/png'),
                durationMs: resolveActorArtFrameDurationMs(artRefDoc, animation, frameIndex)
              };
            });
    const sources = artRefSources.length ? artRefSources : inlineSources;
    const loadedFrames = [];
    for (const source of sources) {
      const image = await new Promise((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = reject;
        next.src = source.imageDataUrl;
      });
      const safeWidth = clamp(Math.round(image.width || fallbackWidth), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
      const safeHeight = clamp(Math.round(image.height || fallbackHeight), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
      const layer = createLayer(safeWidth, safeHeight, 'Actor State Layer');
      const canvas = document.createElement('canvas');
      canvas.width = safeWidth;
      canvas.height = safeHeight;
      const drawCtx = canvas.getContext('2d');
      drawCtx.drawImage(image, 0, 0, safeWidth, safeHeight);
      const pixels = drawCtx.getImageData(0, 0, safeWidth, safeHeight).data;
      for (let i = 0; i < safeWidth * safeHeight; i += 1) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        const a = pixels[i * 4 + 3];
        layer.pixels[i] = rgbaToUint32({ r, g, b, a });
      }
      loadedFrames.push(createFrame([layer], Number(source.durationMs || DEFAULT_FRAME_DURATION_MS)));
      this.canvasState.width = safeWidth;
      this.canvasState.height = safeHeight;
      this.artSizeDraft.width = safeWidth;
      this.artSizeDraft.height = safeHeight;
    }
    if (!loadedFrames.length) {
      this.canvasState.width = fallbackWidth;
      this.canvasState.height = fallbackHeight;
      this.artSizeDraft.width = fallbackWidth;
      this.artSizeDraft.height = fallbackHeight;
      loadedFrames.push(createFrame([createLayer(fallbackWidth, fallbackHeight, 'Actor State Layer')], DEFAULT_FRAME_DURATION_MS));
    }
    const actorStateArtRef = typeof documentName === 'string' && documentName.trim()
      ? documentName.trim()
      : typeof animation?.artRef === 'string' && animation.artRef
        ? animation.artRef
        : this.buildActorStateArtDocName(actorId, stateId);
    this.currentDocumentRef = { folder: 'art', name: actorStateArtRef };
    this.decalEditSession = { type: 'actor-state', actorId, stateId, onCommit };
    this.animation.frames = loadedFrames;
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
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
    const width = clamp(Math.round(worldW), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const height = clamp(Math.round(worldH), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const scaleX = width / worldW;
    const scaleY = height / worldH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const drawCtx = canvas.getContext('2d');
    drawCtx.imageSmoothingEnabled = false;
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
    this.animation.frames = [createFrame([layer], DEFAULT_FRAME_DURATION_MS)];
    this.animation.currentFrameIndex = 0;
    this.canvasState.activeLayerIndex = 0;
    this.artSizeDraft.width = width;
    this.artSizeDraft.height = height;
    this.setFrameLayers(this.animation.frames[0].layers);
    this.view.showGrid = false;
    const requestedZoom = Number.isFinite(bounds?.zoom) ? bounds.zoom : null;
    const requestedScreenW = Number.isFinite(bounds?.screenW) ? bounds.screenW : null;
    const requestedScreenH = Number.isFinite(bounds?.screenH) ? bounds.screenH : null;
    if (requestedZoom && requestedZoom > 0 && requestedScreenW && requestedScreenH) {
      const targetZoom = Math.min((requestedScreenW * requestedZoom) / Math.max(1, width), (requestedScreenH * requestedZoom) / Math.max(1, height));
      let zoomIndex = 0;
      for (let i = 0; i < this.view.zoomLevels.length; i += 1) {
        if (this.view.zoomLevels[i] <= targetZoom) zoomIndex = i;
      }
      this.view.zoomIndex = zoomIndex;
      this.view.panX = 0;
      this.view.panY = 0;
    } else {
      this.zoomToFitCanvas();
    }
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

  mapSeamEditsToDecalPixels({
    entry,
    seamPixels,
    seamBasePixels,
    seamWidth,
    seamHeight,
    decalPixels,
    decalWidth,
    decalHeight
  }) {
    if (!entry || !seamPixels || !seamBasePixels || !decalPixels) return false;
    const safeSeamW = Math.max(1, seamWidth | 0);
    const safeSeamH = Math.max(1, seamHeight | 0);
    const safeDecalW = Math.max(1, decalWidth | 0);
    const safeDecalH = Math.max(1, decalHeight | 0);
    const invDecalW = 1 / safeDecalW;
    const invDecalH = 1 / safeDecalH;
    const entryW = Math.max(1e-6, Number(entry.canvasW) || 0);
    const entryH = Math.max(1e-6, Number(entry.canvasH) || 0);
    const entryX = Number(entry.canvasX) || 0;
    const entryY = Number(entry.canvasY) || 0;
    let changed = false;

    for (let decalRow = 0; decalRow < safeDecalH; decalRow += 1) {
      for (let decalCol = 0; decalCol < safeDecalW; decalCol += 1) {
        const u = (decalCol + 0.5) * invDecalW;
        const v = (decalRow + 0.5) * invDecalH;
        const seamCol = Math.floor(entryX + u * entryW);
        const seamRow = Math.floor(entryY + v * entryH);
        if (seamCol < 0 || seamRow < 0 || seamCol >= safeSeamW || seamRow >= safeSeamH) continue;
        const seamIndex = seamRow * safeSeamW + seamCol;
        if (seamPixels[seamIndex] === seamBasePixels[seamIndex]) continue;
        const decalIndex = decalRow * safeDecalW + decalCol;
        decalPixels[decalIndex] = seamPixels[seamIndex];
        changed = true;
      }
    }

    return changed;
  }

  commitActorStateArtRef({ clearSession = false } = {}) {
    const session = this.decalEditSession;
    if (session?.type !== 'actor-state') return null;
    const artRef = this.currentDocumentRef?.folder === 'art'
      ? String(this.currentDocumentRef.name || '').trim()
      : '';
    const firstFrame = this.animation.frames[0] || null;
    const fps = Math.max(1, Math.round(1000 / Math.max(1, Number(firstFrame?.durationMs || DEFAULT_FRAME_DURATION_MS))));
    session.onCommit?.({
      imageDataUrl: '',
      frames: [],
      fps,
      artRef
    });
    if (clearSession) this.decalEditSession = null;
    return { artRef, fps };
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
    if (this.decalEditSession.type === 'actor-state') {
      this.commitActorStateArtRef({ clearSession: true });
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
          decalCtx.imageSmoothingEnabled = false;
          decalCtx.drawImage(image, 0, 0, decalCanvas.width, decalCanvas.height);
          const imageData = decalCtx.getImageData(0, 0, decalCanvas.width, decalCanvas.height);
          const decalPixels = new Uint32Array(imageData.data.buffer);
          const changed = this.mapSeamEditsToDecalPixels({
            entry,
            seamPixels: currentComposite,
            seamBasePixels: baseComposite,
            seamWidth: this.canvasState.width,
            seamHeight: this.canvasState.height,
            decalPixels,
            decalWidth: decalCanvas.width,
            decalHeight: decalCanvas.height
          });
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
    if (this.pendingSavePromise) return this.pendingSavePromise;
    this.pendingSavePromise = (async () => {
      const result = await this.runtime.saveAsOrCurrent(options);
      if (!result) return result;
      if (this.decalEditSession?.type === 'actor-state') {
        if (result.name && this.currentDocumentRef?.folder !== 'art') {
          this.currentDocumentRef = { folder: 'art', name: result.name };
        }
        this.commitActorStateArtRef({ clearSession: false });
      }
      if (this.decalEditSession?.type !== 'actor-state' && !this.forceArtDocumentSave) {
        this.persistTileArtAutosave(true);
      }
      this.runtime.markSavedSnapshot?.();
      return result;
    })();
    try {
      return await this.pendingSavePromise;
    } finally {
      this.pendingSavePromise = null;
    }
  }

  async loadArtDocument() {
    if (this.pendingSavePromise) {
      try {
        await this.pendingSavePromise;
      } catch (_error) {
        // no-op: open flow below will handle current state
      }
    }
    await this.runtime.open();
  }

  async newArtDocument() {
    if (!(await this.runtime.confirmDiscardChanges())) return;
    const name = await this.promptForNewArtName();
    if (!name) return;
    const dims = await this.promptForArtDimensions(this.artSizeDraft);
    if (!dims) return;
    ensurePixelArtStore(this.game.world);
    this.game.world.pixelArt.tiles = {};
    this.currentDocumentRef = { folder: 'art', name };
    this.refreshDefaultBrushProfiles({ onlyStale: true });
    this.brushPickerOpen = false;
    this.brushPickerDraft = null;
    this.brushPickerDrag = null;
    this.brushPickerSliders = null;
    this.brushPickerFocus = null;
    this.loadTileData();
    this.artSizeDraft.width = dims.width;
    this.artSizeDraft.height = dims.height;
    this.resizeArtCanvas(dims.width, dims.height);
    this.runtime.markSavedSnapshot();
  }

  resizeArtCanvas(width, height) {
    const nextW = clamp(Math.round(width), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const nextH = clamp(Math.round(height), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
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
      label: `${kind === 'width' ? 'Pixel width' : 'Pixel height'} (${ART_DIMENSION_MIN}-${ART_DIMENSION_MAX}):`,
      initialValue: String(current),
      inputType: 'int',
      min: ART_DIMENSION_MIN,
      max: ART_DIMENSION_MAX
    });
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, ART_DIMENSION_MIN, ART_DIMENSION_MAX);
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
      width: clamp(parseInt(match[1], 10), ART_DIMENSION_MIN, ART_DIMENSION_MAX),
      height: clamp(parseInt(match[2], 10), ART_DIMENSION_MIN, ART_DIMENSION_MAX)
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
      scale: { scaleX: 1, scaleY: 1 },
      crop: { borderX: 1, borderY: 1 },
      offset: { dx: 0, dy: 0, wrap: true }
    };
    this.transformModal = {
      scope: 'canvas',
      type,
      values: { ...(defaults[type] || {}) },
      bounds: null,
      fields: [],
      buttons: []
    };
  }

  openSelectionTransformModal(type) {
    const defaults = {
      flip: { axis: 'horizontal' },
      rotate: { angle: 90 },
      stretch: { stretchX: 100, stretchY: 100 },
      skew: { skewX: 0, skewY: 0 }
    };
    this.transformModal = {
      scope: 'selection',
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
    const isScaleField = key === 'scaleX' || key === 'scaleY';
    if (isScaleField) {
      const clamped = clamp(parsed, 0.1, 10);
      this.transformModal.values[key] = clamped <= 1
        ? Math.round(clamped * 10) / 10
        : Math.round(clamped);
      return;
    }
    this.transformModal.values[key] = clamp(Math.round(parsed), min, max);
  }

  transformScaleValueToSliderT(value) {
    const clamped = clamp(Number(value) || 1, 0.1, 10);
    if (clamped <= 1) {
      return ((clamped - 0.1) / 0.9) * 0.5;
    }
    return 0.5 + ((clamped - 1) / 9) * 0.5;
  }

  transformSliderTToScaleValue(t) {
    const clamped = clamp(Number(t) || 0, 0, 1);
    if (clamped <= 0.5) {
      const normalized = clamped / 0.5;
      return Math.round((0.1 + normalized * 0.9) * 10) / 10;
    }
    const normalized = (clamped - 0.5) / 0.5;
    return clamp(Math.round(1 + normalized * 9), 1, 10);
  }

  async editTransformValue(field) {
    if (!this.transformModal || !field) return;
    const current = this.transformModal.values[field.key] ?? field.min;
    const raw = await openTextInputOverlay({
      title: `Set ${field.label}`,
      label: `${field.label} (${field.min}-${field.max})`,
      initialValue: String(Math.round(current)),
      inputType: field.key === 'scaleX' || field.key === 'scaleY' ? 'float' : 'int',
      min: field.min,
      max: field.max
    });
    if (raw == null) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    this.setTransformValue(field.key, parsed, field.min, field.max);
  }

  applyScaleCanvas(scaleX, scaleY) {
    const sx = clamp(Number(scaleX) || 1, 0.1, 10);
    const sy = clamp(Number(scaleY) || 1, 0.1, 10);
    if (sx === 1 && sy === 1) return;
    const srcW = this.canvasState.width;
    const srcH = this.canvasState.height;
    const nextW = clamp(Math.round(srcW * sx), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    const nextH = clamp(Math.round(srcH * sy), ART_DIMENSION_MIN, ART_DIMENSION_MAX);
    this.animation.frames = this.animation.frames.map((frame) => ({
      ...frame,
      layers: frame.layers.map((layer) => {
        const next = createLayer(nextW, nextH, layer.name);
        for (let row = 0; row < nextH; row += 1) {
          for (let col = 0; col < nextW; col += 1) {
            const srcRow = clamp(Math.floor(row / sy), 0, srcH - 1);
            const srcCol = clamp(Math.floor(col / sx), 0, srcW - 1);
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
    const nextW = clamp(srcW - bx * 2, 1, ART_DIMENSION_MAX);
    const nextH = clamp(srcH - by * 2, 1, ART_DIMENSION_MAX);
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
    const { scope = 'canvas', type, values } = this.transformModal;
    if (scope === 'selection') {
      this.applySelectionModalTransform(type, values);
      this.closeTransformModal();
      return;
    }
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

  applySelectionModalTransform(type, values = {}) {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return;
    if (type === 'flip') {
      this.transformSelection(values.axis === 'vertical' ? 'flip-v' : 'flip-h');
      return;
    }
    if (type === 'rotate') {
      this.applySelectionAffineTransform({ rotateDeg: Number(values.angle) || 0 }, `rotate ${Math.round(Number(values.angle) || 0)}°`);
      return;
    }
    if (type === 'stretch') {
      const sx = clamp((Number(values.stretchX) || 100) / 100, 0.01, 20);
      const sy = clamp((Number(values.stretchY) || 100) / 100, 0.01, 20);
      this.applySelectionAffineTransform({ scaleX: sx, scaleY: sy }, `stretch ${Math.round(sx * 100)}%/${Math.round(sy * 100)}%`);
      return;
    }
    if (type === 'skew') {
      const skewX = clamp(Number(values.skewX) || 0, -89, 89);
      const skewY = clamp(Number(values.skewY) || 0, -89, 89);
      this.applySelectionAffineTransform({ skewXDeg: skewX, skewYDeg: skewY }, `skew ${Math.round(skewX)}°/${Math.round(skewY)}°`);
    }
  }

  applySelectionAffineTransform(options = {}, label = 'transform') {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const mask = this.selection.mask;
    const sourcePixels = this.getSelectedPixelsSnapshot(mask);
    const center = this.getSelectionCenterPoint();
    const rotateDeg = Number(options.rotateDeg) || 0;
    const scaleX = Number.isFinite(options.scaleX) ? options.scaleX : 1;
    const scaleY = Number.isFinite(options.scaleY) ? options.scaleY : 1;
    const skewXDeg = Number(options.skewXDeg) || 0;
    const skewYDeg = Number(options.skewYDeg) || 0;
    const rad = rotateDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const kx = Math.tan(skewXDeg * (Math.PI / 180));
    const ky = Math.tan(skewYDeg * (Math.PI / 180));
    const a = cos * scaleX + (-sin) * ky * scaleY;
    const b = cos * kx * scaleX + (-sin) * scaleY;
    const c = sin * scaleX + cos * ky * scaleY;
    const d = sin * kx * scaleX + cos * scaleY;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-6) return;
    const invA = d / det;
    const invB = -b / det;
    const invC = -c / det;
    const invD = a / det;
    let minCol = width;
    let minRow = height;
    let maxCol = -1;
    let maxRow = -1;
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const i = row * width + col;
        if (!mask[i]) continue;
        const lx = col - center.col;
        const ly = row - center.row;
        const tx = center.col + (a * lx + b * ly);
        const ty = center.row + (c * lx + d * ly);
        minCol = Math.min(minCol, Math.floor(tx));
        maxCol = Math.max(maxCol, Math.ceil(tx));
        minRow = Math.min(minRow, Math.floor(ty));
        maxRow = Math.max(maxRow, Math.ceil(ty));
      }
    }
    if (maxCol < minCol || maxRow < minRow) return;
    minCol = clamp(minCol, 0, width - 1);
    maxCol = clamp(maxCol, 0, width - 1);
    minRow = clamp(minRow, 0, height - 1);
    maxRow = clamp(maxRow, 0, height - 1);
    const transformedPixels = new Uint32Array(width * height);
    const transformedMask = new Uint8Array(width * height);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const dx = col - center.col;
        const dy = row - center.row;
        const srcX = center.col + invA * dx + invB * dy;
        const srcY = center.row + invC * dx + invD * dy;
        const srcCol = Math.round(srcX);
        const srcRow = Math.round(srcY);
        if (srcCol < 0 || srcRow < 0 || srcCol >= width || srcRow >= height) continue;
        const srcIndex = srcRow * width + srcCol;
        if (!mask[srcIndex]) continue;
        const destIndex = row * width + col;
        transformedMask[destIndex] = 1;
        const value = sourcePixels[srcIndex];
        if (value) transformedPixels[destIndex] = value;
      }
    }
    this.startHistory(label);
    const nextLayer = new Uint32Array(this.activeLayer.pixels);
    for (let i = 0; i < nextLayer.length; i += 1) {
      if (mask[i]) nextLayer[i] = 0;
    }
    for (let i = 0; i < transformedPixels.length; i += 1) {
      const value = transformedPixels[i];
      if (value) nextLayer[i] = value;
    }
    this.activeLayer.pixels = nextLayer;
    this.selection.mask = transformedMask;
    this.selection.bounds = this.getMaskBounds(transformedMask);
    this.selection.active = Boolean(this.selection.bounds);
    this.commitHistory();
  }


  setActiveTile(tile) {
    this.activeTile = tile;
    const index = this.tileLibrary.findIndex((entry) => entry.id === tile?.id);
    if (index >= 0) this.tileIndex = index;
    this.restoreStoredTileArtIfNeeded();
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
    this.controllerMenu.resetFocus();
  }

  clearPixelEditorBlockingOverlays() {
    this.transformModal = null;
    this.pasteImportModal = null;
    this.brushPickerOpen = false;
    this.brushPickerBounds = null;
    this.brushPickerSliders = null;
    this.brushPickerDrag = null;
    this.brushPickerFocus = null;
    this.paletteGridOpen = false;
    this.paletteColorPickerOpen = false;
    this.paletteColorDraft = null;
    this.paletteRemoveMode = false;
    this.paletteRemoveMarked?.clear?.();
    this.palettePickerDrag = null;
    this.paletteModalBounds = null;
    this.paletteModalSwatchScrollBounds = null;
    this.paletteColorPickerBounds = null;
    this.selectionContextMenu = null;
    this.quickWheel = { active: false, type: null, center: { x: 0, y: 0 }, selectionIndex: null };
    this.transportPopover = null;
    this.transportPopoverButtons = [];
    this.uiSliderDrag = null;
    this.menuScrollDrag = null;
    this.controlsOverlayOpen = false;
    this.menuOpen = false;
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
    this.controllerMenu.resetFocus();
    if (this.isMobileLayout()) {
      this.mobileDrawer = 'panel';
      this.setLeftPanelTab('draw');
      this.setInputMode('canvas');
    }
  }

  resetToFileMenu() {
    this.setLeftPanelTab('file');
    if (this.isMobileLayout()) {
      this.mobileDrawer = null;
      this.pixelPortraitSubpanel = null;
    }
    this.controllerMenu.resetFocus();
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
    this.view.showGrid = false;
    this.setActiveTool(TOOL_IDS.CLONE);
    this.setBrushSize(16);
    this.setBrushHardness(0);
    this.setBrushOpacity(0.5);
    this.clonePickSourceArmed = true;
    this.clonePickTargetArmed = false;
    this.cloneAngleCalibration = null;
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
    const frameScale = dt > 0 ? (dt > 5 ? (dt / 16.6667) : (dt * 60)) : 1;
    this.selectionMarchPhase = (this.selectionMarchPhase + frameScale * 0.75) % 2048;
    this.updateAnimation(dt);
    this.handleInput(input, dt);
    this.applyMobilePanJoystick(dt);
    this.updateCursorPosition();
  }

  applyMobilePanJoystick(dt = 0) {
    if (!this.isMobileLayout() || !this.panJoystick.active) return;
    const frameScale = dt > 0 ? (dt > 5 ? (dt / 16.6667) : (dt * 60)) : 1;
    if (this.tilePickerMode) {
      this.tilePickerScrollFloat = clamp(
        (this.tilePickerScrollFloat ?? this.tilePickerScroll ?? 0) + this.panJoystick.dy * 0.12 * frameScale,
        0,
        this.tilePickerMaxScroll || 0
      );
      this.tilePickerScroll = clamp(Math.round(this.tilePickerScrollFloat), 0, this.tilePickerMaxScroll || 0);
      return;
    }
    const speed = 8;
    this.view.panX -= this.panJoystick.dx * speed * frameScale;
    this.view.panY -= this.panJoystick.dy * speed * frameScale;
  }

  syncBrushPickerDraft() {
    this.brushPickerDraft = {
      brushShape: this.toolOptions.brushShape,
      brushSize: this.toolOptions.brushSize,
      brushOpacity: this.toolOptions.brushOpacity,
      brushHardness: this.toolOptions.brushHardness,
      brushFalloff: this.toolOptions.brushFalloff
    };
  }

  openBrushPicker(focus = null) {
    this.handleToolPointerUp();
    this.cancelLongPress();
    this.syncBrushPickerDraft();
    this.brushPickerDrag = null;
    this.brushPickerFocus = focus;
    this.brushPickerOpen = true;
  }

  closeBrushPicker({ apply = false } = {}) {
    if (apply && this.brushPickerDraft) {
      this.toolOptions.brushShape = this.brushPickerDraft.brushShape;
      this.setBrushSize(this.brushPickerDraft.brushSize);
      this.setBrushOpacity(this.brushPickerDraft.brushOpacity);
      this.setBrushHardness(this.brushPickerDraft.brushHardness);
      this.toolOptions.brushFalloff = clamp(this.brushPickerDraft.brushFalloff ?? 0, 0, 1);
      this.saveBrushProfile();
    }
    this.brushPickerOpen = false;
    this.brushPickerDraft = null;
    this.brushPickerDrag = null;
    this.brushPickerSliders = null;
    this.brushPickerFocus = null;
  }

  updateAnimation(dt) {
    if (this.boneEditor?.playing) {
      const dtMs = dt > 5 ? dt : dt * 1000;
      const duration = this.getBoneTimelineDurationMs();
      this.boneEditor.timeMs += dtMs;
      if (this.boneEditor.timeMs >= duration) {
        if (this.animation.loop) {
          if (this.boneEditor.loopEndHeld) {
            this.boneEditor.timeMs = duration > 0 ? this.boneEditor.timeMs % duration : 0;
            this.boneEditor.loopEndHeld = false;
          } else {
            this.boneEditor.timeMs = duration;
            this.boneEditor.loopEndHeld = true;
          }
        } else {
          this.boneEditor.timeMs = duration;
          this.boneEditor.playing = false;
          this.boneEditor.loopEndHeld = false;
        }
      } else {
        this.boneEditor.loopEndHeld = false;
      }
    }
    if (!this.animation.playing) return;
    const frame = this.currentFrame;
    const dtMs = dt > 5 ? dt : dt * 1000;
    this.animation.previewElapsed = (this.animation.previewElapsed || 0) + dtMs;
    if (this.animation.previewElapsed >= frame.durationMs) {
      this.animation.previewElapsed = 0;
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

  closeOpenUiLayer() {
    if (this.paletteColorPickerOpen) {
      this.paletteColorPickerOpen = false;
      this.paletteColorDraft = null;
      this.palettePickerDrag = null;
      this.paletteColorPickerBounds = null;
      return true;
    }
    if (this.paletteGridOpen) {
      this.paletteGridOpen = false;
      this.paletteRemoveMode = false;
      this.paletteRemoveMarked.clear();
      return true;
    }
    if (this.brushPickerOpen) {
      this.closeBrushPicker({ apply: true });
      return true;
    }
    if (this.transformModal) {
      this.closeTransformModal();
      return true;
    }
    if (this.pasteImportModal) {
      this.pasteImportModal = null;
      return true;
    }
    if (this.selectionContextMenu) {
      this.selectionContextMenu = null;
      this.setInputMode('canvas');
      return true;
    }
    if (this.controlsOverlayOpen) {
      this.controlsOverlayOpen = false;
      return true;
    }
    if (this.controllerMenu?.active) {
      this.controllerMenu.closeToSurface();
      return true;
    }
    if (this.mobileDrawer === 'panel') {
      this.mobileDrawer = null;
      this.pixelPortraitSubpanel = null;
      this.setInputMode('canvas');
      return true;
    }
    if (this.menuOpen) {
      this.menuOpen = false;
      this.setInputMode('canvas');
      return true;
    }
    return false;
  }

  toggleMenu() {
    if (this.closeOpenUiLayer()) return;
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

    this.controllerMenu.setMenus(this.buildControllerMenus(), {
      siblingOrder: ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'bones']
    });
    this.controllerMenu.ensureInitialFocus();
    if (this.controllerMenu.handleActions(inputState.actions, inputState.axes, dt, this)) {
      return;
    }

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

  buildControllerMenus() {
    const action = (id, label, onSelect, options = {}) => ({ id, label, onSelect, ...options });
    const rootItem = (id, label, submenu = id) => ({
      id,
      label,
      submenu,
      onEnter: () => this.setLeftPanelTab(id === 'frames' ? 'animation' : id)
    });
    const surfaceAction = (id, label, onSelect, options = {}) => action(id, label, () => {
      onSelect();
      this.setInputMode('canvas');
    }, options);
    const toolItems = (category) => {
      return this.tools
      .filter((tool) => (tool.category || 'tools') === category)
      .filter((tool) => !(category === 'select' && tool.id === TOOL_IDS.MOVE))
      .slice(0, 20)
      .map((tool) => surfaceAction(tool.id, tool.name || tool.id, () => this.setActiveTool(tool.id)));
    };
    const fileItems = this.getFilePanelItems()
      .filter((item) => item?.id && !item.divider && !item.separator)
      .map((item) => action(item.id, item.label, item.onClick || item.action || (() => {})));
    return {
      root: {
        id: 'root',
        title: 'Pixel Editor',
        items: [
          rootItem('file', 'File'),
          rootItem('draw', 'Draw'),
          rootItem('select', 'Select'),
          rootItem('tools', 'Tools'),
          rootItem('canvas', 'Canvas'),
          rootItem('layers', 'Layers'),
          rootItem('animation', 'Frames', 'frames'),
          rootItem('bones', 'Rigging'),
          action('undo', 'Undo', () => this.runtime.undo()),
          action('redo', 'Redo', () => this.runtime.redo())
        ]
      },
      draw: { id: 'draw', title: 'Draw', items: toolItems('draw') },
      select: { id: 'select', title: 'Select', items: toolItems('select') },
      layers: {
        id: 'layers',
        title: 'Layers',
        items: this.canvasState.layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => surfaceAction(`layer-${index}`, `${index + 1}: ${layer.name || 'Layer'}`, () => { this.canvasState.activeLayerIndex = index; }))
      },
      frames: {
        id: 'frames',
        title: 'Frames',
        items: this.animation.frames.map((frame, index) => surfaceAction(`frame-${index}`, `Frame ${index + 1}`, () => {
            this.animation.currentFrameIndex = index;
            this.setFrameLayers(this.currentFrame.layers);
          }))
      },
      bones: {
        id: 'bones',
        title: 'Rigging',
        items: [
          action('bone-add', 'Add Bone', () => this.startBoneAddMode()),
          action('bone-bind-layer', 'Bind Layer', () => this.bindActiveLayerToSelectedBone()),
          action('bone-bind-selection', 'Bind Selection', () => this.bindSelectionToSelectedBone()),
          action('bone-bake', 'Bake Copy', () => this.bakeBoneAnimationToCopiedFrames())
        ]
      },
      canvas: {
        id: 'canvas',
        title: 'Canvas',
        items: [
          action('resize', 'Resize Canvas', () => this.resizeArtDocumentPrompt()),
          action('grid', this.showGrid ? 'Grid: On' : 'Grid: Off', () => { this.showGrid = !this.showGrid; }),
          action('onion', this.animation.onion.enabled ? 'Onion Skin: On' : 'Onion Skin: Off', () => { this.animation.onion.enabled = !this.animation.onion.enabled; })
        ]
      },
      file: {
        id: 'file',
        title: 'File',
        items: fileItems
      },
      tools: {
        id: 'tools',
        title: 'Tools',
        items: [
          action('undo', 'Undo', () => this.runtime.undo()),
          action('redo', 'Redo', () => this.runtime.redo()),
          action('copy', 'Copy', () => this.copySelection()),
          action('paste', 'Paste', () => this.pasteClipboard())
        ]
      },
      system: buildControllerSystemMenu({
        fileMenuId: 'file',
        toolsMenuId: 'tools',
        onExit: () => this.exitToMainMenu()
      }),
      'exit-confirm': buildControllerExitConfirmMenu({
        onExit: () => this.exitToMainMenu(),
        message: 'Exit Pixel Editor and return to the main menu.'
      }),
      help: buildControllerHelpMenu(['LS moves cursor on canvas', 'RS pans canvas'])
    };
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
      this.pixelPortraitSubpanel = null;
      return;
    }
    this.setLeftPanelTab('draw');
  }

  togglePixelPortraitDrawer() {
    if (this.mobileDrawer === 'panel') {
      this.mobileDrawer = null;
      this.pixelPortraitSubpanel = null;
      return;
    }
    this.mobileDrawer = 'panel';
  }

  setLeftPanelTab(tab) {
    const index = this.leftPanelTabs.indexOf(tab);
    if (index < 0) return;
    const wasBones = this.leftPanelTab === 'bones';
    const resetBoneState = typeof this.resetBoneEditorTransientState === 'function'
      ? this.resetBoneEditorTransientState
      : PixelStudio.prototype.resetBoneEditorTransientState;
    if (this.leftPanelTab !== tab) {
      if (wasBones) {
        resetBoneState.call(this, { normalizeSelection: false });
      }
      this.pixelPortraitSubpanel = null;
      this.focusScroll.toolOptions = 0;
    }
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
    if (tab === 'layers') {
      this.modeTab = 'draw';
    }
    if (tab === 'animation') {
      this.modeTab = 'animate';
    }
    if (tab === 'bones') {
      this.modeTab = 'bones';
      this.setInputMode('canvas');
      resetBoneState.call(this, { mode: this.boneEditor?.mode || 'bones' });
    }
    if (this.isMobileLayout() && ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'animation', 'bones'].includes(tab)) {
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
      { id: TOOL_IDS.COLOR_REPLACE, label: 'Replace' },
      { id: TOOL_IDS.HUE_SHIFT, label: 'Hue Shift' }
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
    const nextIndex = this.viewportController.zoomWithStep(this.view.zoomIndex, delta, {
      minZoom: 0,
      maxZoom: this.view.zoomLevels.length - 1,
      zoomStep: 1
    });
    this.setZoomIndexPreservingAnchor(nextIndex, this.getPreferredZoomAnchor());
  }

  getZoomAnchorFromScreen(screenX, screenY) {
    if (!this.canvasBounds) return null;
    const { mainX, mainY, x: startX, y: startY, cellSize } = this.canvasBounds;
    const originX = Number.isFinite(mainX) ? mainX : startX;
    const originY = Number.isFinite(mainY) ? mainY : startY;
    const zoom = Number(cellSize || this.view.zoomLevels[this.view.zoomIndex] || 1);
    if (!Number.isFinite(zoom) || zoom <= 0) return null;
    return {
      screenX,
      screenY,
      col: (screenX - originX) / zoom,
      row: (screenY - originY) / zoom
    };
  }

  getPreferredZoomAnchor(screenPoint = null) {
    if (!this.canvasBounds && !this.canvasViewportBounds) return null;
    if (screenPoint && Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y)) {
      return this.getZoomAnchorFromScreen(screenPoint.x, screenPoint.y);
    }
    const sourceX = this.gamepadCursor.active ? this.gamepadCursor.x : this.cursor.x;
    const sourceY = this.gamepadCursor.active ? this.gamepadCursor.y : this.cursor.y;
    if (this.canvasBounds && this.isPointInBounds({ x: sourceX, y: sourceY }, this.canvasBounds)) {
      return this.getZoomAnchorFromScreen(sourceX, sourceY);
    }
    const bounds = this.canvasViewportBounds || this.canvasBounds;
    if (!bounds) return null;
    return this.getZoomAnchorFromScreen(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
  }

  setZoomIndexPreservingAnchor(nextIndex, anchor = null) {
    const clampedIndex = clamp(Math.round(Number(nextIndex) || 0), 0, this.view.zoomLevels.length - 1);
    const resolvedAnchor = anchor || this.getPreferredZoomAnchor();
    this.view.zoomIndex = clampedIndex;
    if (!resolvedAnchor || !this.canvasViewportBounds) return;
    const zoom = this.view.zoomLevels[this.view.zoomIndex] || 1;
    const { width, height } = this.canvasState;
    const bounds = this.canvasViewportBounds;
    const gridW = width * zoom;
    const gridH = height * zoom;
    const baseX = bounds.x + (bounds.w - gridW) / 2;
    const baseY = bounds.y + (bounds.h - gridH) / 2;
    this.view.panX = resolvedAnchor.screenX - baseX - resolvedAnchor.col * zoom;
    this.view.panY = resolvedAnchor.screenY - baseY - resolvedAnchor.row * zoom;
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
    this.setZoomIndexPreservingAnchor(clamp(target, 0, this.view.zoomLevels.length - 1), this.getPreferredZoomAnchor());
  }

  startMenuScrollDrag(payload) {
    if (!payload.touchCount) return false;
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
      return true;
    }
    if (payload.touchCount && ['draw', 'select', 'tools'].includes(this.leftPanelTab) && this.toolsListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.toolsListMeta.scrollBounds)
      && this.toolsListMeta.maxScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.tools || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.toolsListMeta.lineHeight || 20),
        scrollGroup: 'tools',
        maxScroll: Math.max(0, this.toolsListMeta.maxScroll || 0)
      };
      return true;
    }
    if (payload.touchCount && this.tilePickerMode && this.tilePickerScrollBounds
      && this.isPointInBounds(payload, this.tilePickerScrollBounds)
      && this.tilePickerMaxScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.tilePickerScroll || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.tilePickerScrollBounds.rowH || 80),
        scrollGroup: 'tilePicker',
        maxScroll: this.tilePickerMaxScroll
      };
      return true;
    }
    if (payload.touchCount && ['draw', 'select', 'tools'].includes(this.leftPanelTab) && this.toolsPanelMeta?.optionsScrollBounds
      && this.isPointInBounds(payload, this.toolsPanelMeta.optionsScrollBounds)
      && this.toolsPanelMeta.maxToolOptionsScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.toolOptions || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.toolsPanelMeta.lineHeight || 20),
        scrollGroup: 'toolOptions',
        maxScroll: Math.max(0, this.toolsPanelMeta.maxToolOptionsScroll || 0)
      };
      return true;
    }
    if (payload.touchCount && this.leftPanelTab === 'layers' && this.layerListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.layerListMeta.scrollBounds)
      && this.layerListMeta.maxScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.layers || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.layerListMeta.lineHeight || 20),
        scrollGroup: 'layers',
        maxScroll: Math.max(0, this.layerListMeta.maxScroll || 0)
      };
      return true;
    }
    if (payload.touchCount && this.leftPanelTab === 'animation' && this.frameListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.frameListMeta.scrollBounds)
      && this.frameListMeta.maxScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.frames || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.frameListMeta.lineHeight || 20),
        scrollGroup: 'frames',
        maxScroll: Math.max(0, this.frameListMeta.maxScroll || 0)
      };
      return true;
    }
    if (payload.touchCount && this.leftPanelTab === 'bones' && this.boneListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.boneListMeta.scrollBounds)
      && this.boneListMeta.maxScroll > 0) {
      const hit = this.uiButtons.find((button) => this.isPointInBounds(payload, button.bounds));
      this.menuScrollDrag = {
        startY: payload.y,
        startScroll: this.focusScroll.bones || 0,
        moved: false,
        hitAction: hit?.onClick || null,
        lineHeight: Math.max(1, this.boneListMeta.lineHeight || 20),
        scrollGroup: 'bones',
        maxScroll: Math.max(0, this.boneListMeta.maxScroll || 0)
      };
      return true;
    }
    if (this.isMobileLayout() && this.paletteBarScrollBounds
      && this.isPointInBounds(payload, this.paletteBarScrollBounds)
      && (this.paletteBarScrollBounds.maxScroll || 0) > 0) {
      const tappedSwatch = this.paletteBounds.find((bounds) => this.isPointInBounds(payload, bounds));
      this.menuScrollDrag = {
        startX: payload.x,
        startScroll: this.focusScroll.palette || 0,
        moved: false,
        hitAction: tappedSwatch
          ? (typeof tappedSwatch.action === 'function'
            ? tappedSwatch.action
            : () => this.setPaletteIndex(tappedSwatch.index))
          : null,
        lineHeight: Math.max(1, this.paletteBarScrollBounds.step || 1),
        scrollGroup: 'paletteMobile',
        maxScroll: Math.max(0, this.paletteBarScrollBounds.maxScroll || 0)
      };
      return true;
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
      return true;
    }
    return false;
  }

  hitTestUiButton(point) {
    const buttons = Array.isArray(this.uiButtons) ? this.uiButtons : [];
    for (let index = buttons.length - 1; index >= 0; index -= 1) {
      const button = buttons[index];
      if (button?.bounds && this.isPointInBounds(point, button.bounds)) {
        return button;
      }
    }
    return null;
  }

  runSelectionAction(action) {
    if (typeof action !== 'function') return;
    this.selectionContextMenu = null;
    action();
  }

  isBoneEditorUiHit(point) {
    const uiHit = this.hitTestUiButton(point);
    if (uiHit) {
      const canvas = this.canvasBounds;
      const bounds = uiHit.bounds || {};
      const staleCanvasSizedHit = canvas
        && !uiHit.group
        && bounds.x === canvas.x
        && bounds.y === canvas.y
        && bounds.w === canvas.w
        && bounds.h === canvas.h;
      if (!staleCanvasSizedHit) return true;
    }
    return (this.boneUiRegions || []).some((bounds) => this.isPointInBounds(point, bounds));
  }

  isBoneEditorPointerUiHit(point) {
    if (this.leftPanelTab !== 'bones') return false;
    if (this.isBoneEditorUiHit(point)) return true;
    if (this.mobileDrawerBounds && this.isPointInBounds(point, this.mobileDrawerBounds)) return true;
    return false;
  }

  handlePriorityUiDragHit(payload) {
    const hitTest = typeof this.hitTestUiButton === 'function'
      ? this.hitTestUiButton
      : PixelStudio.prototype.hitTestUiButton;
    const hit = hitTest.call(this, payload);
    if (!hit || (hit.group !== 'bone-timeline' && hit.group !== 'selection-actions' && !hit.onDrag)) return false;
    if (hit.onHold) {
      this.startTransportHold(hit, payload);
      return true;
    }
    hit.onClick?.({ x: payload.x, y: payload.y, id: payload.id });
    if (hit.onDrag) {
      this.uiSliderDrag = { id: payload.id ?? null, onDrag: hit.onDrag };
      hit.onDrag({ x: payload.x, y: payload.y, id: payload.id });
    }
    this.pointerDownOnUi = true;
    return true;
  }

  shouldBoneCanvasOwnPointerDown(payload) {
    if (this.leftPanelTab !== 'bones') return false;
    const uiHit = typeof this.isBoneEditorPointerUiHit === 'function'
      ? this.isBoneEditorPointerUiHit(payload)
      : this.isBoneEditorUiHit(payload);
    if (uiHit) return false;
    const widgetHit = typeof this.getPoseRotateWidgetScreenHit === 'function'
      ? this.getPoseRotateWidgetScreenHit(payload)
      : null;
    if (widgetHit) return true;
    if (!this.canvasBounds || !this.isPointInBounds(payload, this.canvasBounds)) {
      return false;
    }
    const boneUiHit = typeof this.isBoneEditorPointerUiHit === 'function'
      ? this.isBoneEditorPointerUiHit(payload)
      : this.isBoneEditorUiHit(payload);
    return !boneUiHit;
  }

  getBoneEditorOffCanvasHitPoint(payload) {
    if (this.leftPanelTab !== 'bones' || !this.canvasViewportBounds) return null;
    if (!this.isPointInBounds(payload, this.canvasViewportBounds)) return null;
    if (this.canvasBounds && this.isPointInBounds(payload, this.canvasBounds)) return null;
    if (this.isBoneEditorPointerUiHit?.(payload)) return null;
    const point = this.getBoneCanvasPointFromScreen(payload.x, payload.y, { row: 0, col: 0 });
    if (!point) return null;
    const hit = this.boneEditor?.mode === 'bind'
      ? this.hitTestBoneNode(point)
      : this.hitTestBone(point);
    return hit ? point : null;
  }

  handlePointerDown(payload) {
    const button = payload.button ?? 0;
    const boneCanvasTap = this.leftPanelTab === 'bones'
      && this.canvasBounds
      && this.isPointInBounds(payload, this.canvasBounds);
    const boneCanvasOwnsTap = typeof this.shouldBoneCanvasOwnPointerDown === 'function'
      ? this.shouldBoneCanvasOwnPointerDown(payload)
      : boneCanvasTap;
    if (this.transportPopover) {
      const hit = this.transportPopoverButtons.find((entry) => this.isPointInBounds(payload, entry.bounds));
      if (hit) {
        hit.onClick?.({ x: payload.x, y: payload.y, id: payload.id });
        this.closeTransportPopover();
        this.pointerDownOnUi = true;
        return;
      }
      this.closeTransportPopover();
      this.pointerDownOnUi = true;
      return;
    }
    if (this.uiSliderDrag && (payload.id === undefined || payload.id === this.uiSliderDrag.id)) {
      this.uiSliderDrag.onDrag?.({ x: payload.x, y: payload.y, id: payload.id });
      return;
    }
    const handlePriorityUiDrag = typeof this.handlePriorityUiDragHit === 'function'
      ? this.handlePriorityUiDragHit
      : PixelStudio.prototype.handlePriorityUiDragHit;
    if (handlePriorityUiDrag.call(this, payload)) {
      return;
    }
    if (this.leftPanelTab === 'bones'
      && this.boneEditor?.submenu === 'nodes'
      && this.boneListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.boneListMeta.scrollBounds)
      && this.startMenuScrollDrag(payload)) {
      return;
    }
    if (this.leftPanelTab === 'bones') {
      const boneUiHit = typeof this.isBoneEditorPointerUiHit === 'function'
        ? this.isBoneEditorPointerUiHit(payload)
        : false;
      if (boneUiHit) {
        this.pointerDownOnUi = true;
        this.handleButtonClick(payload.x, payload.y, payload);
        return;
      }
    }
    if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'pose') {
      const widgetHit = typeof this.getPoseRotateWidgetScreenHit === 'function'
        ? this.getPoseRotateWidgetScreenHit(payload)
        : null;
      if (widgetHit?.point) {
        this.pointerDownOnUi = false;
        this.setInputMode('canvas');
        this.enforceBoneEditorToolMode(this.boneEditor?.mode || 'pose');
        if (this.handleBonePointerDown(widgetHit.point)) {
          this.cancelLongPress();
          return;
        }
      }
    }
    if (!boneCanvasOwnsTap && this.startMenuScrollDrag(payload)) {
      return;
    }
    if (this.menuOpen || this.controlsOverlayOpen || this.paletteGridOpen || this.selectionContextMenu || this.brushPickerOpen || this.transformModal || this.pasteImportModal) {
      this.pointerDownOnUi = this.handleButtonClick(payload.x, payload.y, payload);
      return;
    }
    if (this.mobileDrawerBounds) {
      if (this.isPointInBounds(payload, this.mobileDrawerBounds)) {
        this.pointerDownOnUi = true;
        this.handleButtonClick(payload.x, payload.y, payload);
        return;
      }
      this.mobileDrawer = null;
      this.mobileDrawerBounds = null;
      this.pixelPortraitSubpanel = null;
      if (!(this.leftPanelTab === 'bones' && this.canvasBounds && this.isPointInBounds(payload, this.canvasBounds))) {
        this.pointerDownOnUi = true;
        return;
      }
    }
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    if (this.longPressTimer && this.longPressOrigin) {
      const drift = Math.hypot(payload.x - this.longPressOrigin.x, payload.y - this.longPressOrigin.y);
      if (drift > 8) this.cancelLongPress();
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
    if (!boneCanvasOwnsTap) {
      if (this.handleButtonClick(payload.x, payload.y, payload)) {
        this.pointerDownOnUi = true;
        return;
      }
      const boneUiHit = typeof this.isBoneEditorPointerUiHit === 'function'
        ? this.isBoneEditorPointerUiHit(payload)
        : false;
      if (this.leftPanelTab === 'bones' && boneUiHit) {
        this.pointerDownOnUi = true;
        return;
      }
    }
    if (this.canvasBounds && this.isPointInBounds(payload, this.canvasBounds)) {
      this.setInputMode('canvas');
      if (this.spaceDown || button === 1 || button === 2) {
        this.panStart = this.viewportController.beginPan(payload, { x: this.view.panX, y: this.view.panY });
        return;
      }
      if (this.leftPanelTab === 'animation') {
        this.pointerDownOnUi = true;
        return;
      }
      if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'bind') {
        this.boneEditor.playing = false;
        this.boneEditor.drag = null;
        this.boneEditor.pendingBindNodeTap = null;
        this.ensureBindSelectionTool();
      } else if (this.leftPanelTab === 'bones') {
        this.enforceBoneEditorToolMode(this.boneEditor?.mode || 'bones');
      }
      const point = this.shouldUseUnboundedWrapPointer()
        ? this.getGridCellFromScreenUnbounded(payload.x, payload.y)
        : this.getGridCellFromScreen(payload.x, payload.y);
      if (point) {
        const bonePoint = this.getBoneCanvasPointFromScreen(payload.x, payload.y, point);
        if (this.handleBonePointerDown(bonePoint)) {
          this.cancelLongPress();
          return;
        }
        this.handleToolPointerDown(point, { altKey: this.altDown, fromTouch: payload.touchCount });
      }
      if (payload.touchCount) {
        this.startLongPress(payload);
      }
      return;
    }
    if (this.leftPanelTab === 'bones') {
      const offCanvasBonePoint = this.getBoneEditorOffCanvasHitPoint?.(payload);
      if (offCanvasBonePoint) {
        this.setInputMode('canvas');
        if (this.boneEditor?.mode === 'bind') {
          this.boneEditor.playing = false;
          this.boneEditor.drag = null;
          this.boneEditor.pendingBindNodeTap = null;
          this.ensureBindSelectionTool();
        } else {
          this.enforceBoneEditorToolMode(this.boneEditor?.mode || 'bones');
        }
        if (this.handleBonePointerDown(offCanvasBonePoint)) {
          this.cancelLongPress();
          return;
        }
      }
    }
    if (this.isBoneEditorBoneOnlyMode()) {
      this.clearSelection();
      this.setInputMode('canvas');
      this.cancelLongPress();
      return;
    }
    if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'bind') {
      this.ensureBindSelectionTool();
    }
    if (this.isSelectionToolActive()
      && this.canvasViewportBounds
      && this.isPointInBounds(payload, this.canvasViewportBounds)) {
      this.setInputMode('canvas');
      const point = this.getGridCellFromScreen(payload.x, payload.y, { clampToCanvas: true });
      if (point) {
        this.handleToolPointerDown(point, { altKey: this.altDown, fromTouch: payload.touchCount });
      }
      return;
    }
    if (this.activeToolId === TOOL_IDS.MOVE && this.selection.active && this.isPointNearCanvas(payload, 48)) {
      const freePoint = this.getGridCellFromScreenUnbounded(payload.x, payload.y);
      const hit = freePoint ? this.getSelectionTransformHit(freePoint) : null;
      if (hit?.type === 'rotate' || hit?.type === 'scale') {
        this.setInputMode('canvas');
        this.startMove(freePoint);
        return;
      }
    }
    if (payload.touchCount && this.selection.active) {
      const now = performance.now();
      const previous = this.outsideCanvasTapGesture || { time: 0, x: 0, y: 0 };
      const withinTime = now - previous.time <= 360;
      const withinDistance = Math.hypot(payload.x - previous.x, payload.y - previous.y) <= 28;
      if (withinTime && withinDistance) {
        this.clearSelection();
        this.outsideCanvasTapGesture = { time: 0, x: payload.x, y: payload.y };
      } else {
        this.outsideCanvasTapGesture = { time: now, x: payload.x, y: payload.y };
      }
    }
  }

  handlePointerMove(payload) {
    if (this.transportHold && Math.hypot(payload.x - this.transportHold.x, payload.y - this.transportHold.y) > 12) {
      this.cancelTransportHold();
    }
    if (this.transformModal) {
      if (this.transformModal.drag && (payload.id === undefined || payload.id === this.transformModal.drag.id)) {
        const field = this.transformModal.fields?.find((entry) => entry.key === this.transformModal.drag.key);
        if (field) {
          const ratio = clamp((payload.x - field.slider.x) / Math.max(1, field.slider.w), 0, 1);
          const next = (field.key === 'scaleX' || field.key === 'scaleY')
            ? this.transformSliderTToScaleValue(ratio)
            : field.min + ratio * (field.max - field.min);
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
          this.setPaletteDraftFromSvPointer(payload.x, payload.y, this.palettePickerDrag.bounds);
        } else if (this.palettePickerDrag.type === 'hue' && this.palettePickerDrag.bounds) {
          this.setPaletteDraftFromHuePointer(payload.y, this.palettePickerDrag.bounds);
        } else {
          this.updatePaletteSliderFromX(this.palettePickerDrag.type, payload.x, this.palettePickerDrag.bounds);
        }
      }
      return;
    }
    this.cursor.x = payload.x;
    this.cursor.y = payload.y;
    if (this.longPressTimer && this.longPressOrigin) {
      const drift = Math.hypot(payload.x - this.longPressOrigin.x, payload.y - this.longPressOrigin.y);
      if (drift > 8) this.cancelLongPress();
    }
    if (this.uiSliderDrag && (payload.id === undefined || payload.id === this.uiSliderDrag.id)) {
      this.uiSliderDrag.onDrag?.({ x: payload.x, y: payload.y, id: payload.id });
      return;
    }
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
        const maxScroll = ['toolOptions', 'tools', 'layers', 'frames', 'bones', 'paletteMobile', 'paletteModal', 'tilePicker'].includes(this.menuScrollDrag.scrollGroup)
          ? (this.menuScrollDrag.maxScroll || 0)
          : Math.max(0, total - maxVisible);
        const delta = this.menuScrollDrag.scrollGroup === 'paletteMobile' ? dx : dy;
        const next = this.menuScrollDrag.startScroll - Math.round(delta / this.menuScrollDrag.lineHeight);
        if (this.menuScrollDrag.scrollGroup === 'toolOptions') {
          this.focusScroll.toolOptions = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'tools') {
          this.focusScroll.tools = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'layers') {
          this.focusScroll.layers = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'frames') {
          this.focusScroll.frames = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'bones') {
          this.focusScroll.bones = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'paletteMobile') {
          this.focusScroll.palette = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'paletteModal') {
          this.focusScroll.paletteModal = clamp(next, 0, maxScroll);
        } else if (this.menuScrollDrag.scrollGroup === 'tilePicker') {
          this.tilePickerScroll = clamp(next, 0, maxScroll);
          this.tilePickerScrollFloat = this.tilePickerScroll;
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
    if (this.leftPanelTab === 'bones' && this.boneEditor?.drag) {
      const point = this.getBoneCanvasPointFromScreen(payload.x, payload.y, { row: 0, col: 0 });
      if (this.handleBonePointerMove(point)) return;
    }
    const dragActive = Boolean(
      this.strokeState
      || this.selection.start
      || this.linePreview
      || this.cloneAngleCalibration?.activeLine
      || this.curvePreview
      || this.shapePreview
      || this.gradientPreview
      || this.polygonPreview
    );
    const wrapDragActive = this.toolOptions.wrapDraw && Boolean(
      this.strokeState
      || this.linePreview
      || this.cloneAngleCalibration?.activeLine
      || this.curvePreview
      || this.shapePreview
      || this.gradientPreview
      || this.polygonPreview
    );
    const point = this.moveTransformDrag || wrapDragActive
      ? this.getGridCellFromScreenUnbounded(payload.x, payload.y)
      : this.getGridCellFromScreen(payload.x, payload.y, { clampToCanvas: dragActive });
    if (point) {
      const bonePoint = this.getBoneCanvasPointFromScreen(payload.x, payload.y, point);
      if (this.handleBonePointerMove(bonePoint)) return;
      this.handleToolPointerMove(point);
    }
  }

  handlePointerUp(payload = {}) {
    if (this.transportHold) {
      const hold = this.transportHold;
      this.cancelTransportHold();
      if (!hold.fired) hold.button.onClick?.({ x: payload.x, y: payload.y, id: payload.id });
      this.pointerDownOnUi = false;
      return;
    }
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
    if (this.pointerDownOnUi) {
      this.pointerDownOnUi = false;
      this.cancelLongPress();
      return;
    }
    this.cancelLongPress();
    if (this.handleBonePointerUp()) return;
    this.handleToolPointerUp();
  }

  handleWheel(payload) {
    if (this.handleBoneTimelineWheel?.(payload)) return;
    if (['draw', 'select', 'tools'].includes(this.leftPanelTab) && this.toolsListMeta?.scrollBounds
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
    if (['draw', 'select', 'tools'].includes(this.leftPanelTab) && this.toolsPanelMeta?.optionsScrollBounds
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
    if (this.leftPanelTab === 'layers' && this.layerListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.layerListMeta.scrollBounds)
      && this.layerListMeta.maxScroll > 0) {
      const delta = payload.deltaY > 0 ? 1 : -1;
      this.focusScroll.layers = clamp(
        (this.focusScroll.layers || 0) + delta,
        0,
        this.layerListMeta.maxScroll
      );
      return;
    }
    if (this.leftPanelTab === 'animation' && this.frameListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.frameListMeta.scrollBounds)
      && this.frameListMeta.maxScroll > 0) {
      const delta = payload.deltaY > 0 ? 1 : -1;
      this.focusScroll.frames = clamp(
        (this.focusScroll.frames || 0) + delta,
        0,
        this.frameListMeta.maxScroll
      );
      return;
    }
    if (this.leftPanelTab === 'bones' && this.boneListMeta?.scrollBounds
      && this.isPointInBounds(payload, this.boneListMeta.scrollBounds)
      && this.boneListMeta.maxScroll > 0) {
      const delta = payload.deltaY > 0 ? 1 : -1;
      this.focusScroll.bones = clamp(
        (this.focusScroll.bones || 0) + delta,
        0,
        this.boneListMeta.maxScroll
      );
      return;
    }
    const direction = payload.deltaY > 0 ? -1 : 1;
    const nextIndex = this.viewportController.zoomWithStep(this.view.zoomIndex, direction, {
      minZoom: 0,
      maxZoom: this.view.zoomLevels.length - 1,
      zoomStep: 1
    });
    this.setZoomIndexPreservingAnchor(nextIndex, this.getPreferredZoomAnchor({ x: payload.x, y: payload.y }));
  }

  shouldHandleGestureStart(payload) {
    const touches = Array.isArray(payload?.touches) ? payload.touches : [];
    if (touches.length >= 2) {
      const x = touches.reduce((sum, touch) => sum + Number(touch.x || 0), 0) / touches.length;
      const y = touches.reduce((sum, touch) => sum + Number(touch.y || 0), 0) / touches.length;
      if (this.getBoneTimelineHitLayout?.({ x, y })) return true;
    }
    return true;
  }

  handleGestureStart(payload) {
    const timelineLayout = this.getBoneTimelineHitLayout?.(payload);
    if (timelineLayout && payload?.distance) {
      this.viewportController.cancelInteractions();
      this.gesture = null;
      this.boneTimelineGesture = {
        startDistance: payload.distance,
        startX: payload.x,
        startY: payload.y,
        startZoom: timelineLayout.zoom,
        startScrollMs: timelineLayout.scrollMs,
        startVisibleMs: timelineLayout.visibleMs,
        anchorMs: this.boneTimelineXToMs(payload.x, timelineLayout),
        railW: timelineLayout.railBounds.w
      };
      this.boneEditor.playing = false;
      return;
    }
    if (!this.canvasBounds) return;
    if (!payload?.distance) return;
    this.viewportController.cancelInteractions();
    this.gesture = this.viewportController.beginPinch(payload, {
      startZoomIndex: this.view.zoomIndex,
      startPanX: this.view.panX,
      startPanY: this.view.panY,
      zoomAnchor: this.getZoomAnchorFromScreen(payload.x, payload.y)
    });
  }

  handleGestureMove(payload) {
    if (this.boneTimelineGesture?.startDistance) {
      const gesture = this.boneTimelineGesture;
      const duration = Math.max(1, this.getBoneTimelineDurationMs());
      const scale = Math.max(0.1, Number(payload?.distance || gesture.startDistance) / Math.max(1, gesture.startDistance));
      const nextZoom = clamp(Number(gesture.startZoom || 1) * scale, 1, 8);
      const nextVisible = duration / nextZoom;
      const ratio = clamp((Number(gesture.anchorMs || 0) - Number(gesture.startScrollMs || 0)) / Math.max(1, Number(gesture.startVisibleMs || 1)), 0, 1);
      const msPerPx = nextVisible / Math.max(1, Number(gesture.railW || 1));
      const deltaX = Number(payload?.x || gesture.startX) - Number(gesture.startX || 0);
      this.boneEditor.timelineZoom = nextZoom;
      this.boneEditor.timelineScrollMs = clamp(
        Number(gesture.anchorMs || 0) - ratio * nextVisible - deltaX * msPerPx,
        0,
        Math.max(0, duration - nextVisible)
      );
      this.boneEditor.playing = false;
      return;
    }
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
    const anchor = pinch.context.zoomAnchor
      ? { ...pinch.context.zoomAnchor, screenX: payload.x, screenY: payload.y }
      : this.getPreferredZoomAnchor({ x: payload.x, y: payload.y });
    this.setZoomIndexPreservingAnchor(closestIndex, anchor);
  }

  handleGestureEnd() {
    this.boneTimelineGesture = null;
    this.gesture = null;
    this.viewportController.endPinch();
  }

  startLongPress(payload) {
    this.cancelLongPress();
    this.longPressOrigin = { x: payload.x, y: payload.y };
    this.longPressTimer = setTimeout(() => {
      const point = this.getGridCellFromScreen(payload.x, payload.y);
      if (point) {
        this.pickColor(point);
      }
      this.longPressOrigin = null;
    }, 450);
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressOrigin = null;
  }

  handleToolPointerDown(point, modifiers = {}) {
    const handleCloneAngleDown = typeof this.handleCloneAngleCalibrationDown === 'function'
      ? this.handleCloneAngleCalibrationDown
      : PixelStudio.prototype.handleCloneAngleCalibrationDown;
    if (handleCloneAngleDown.call(this, point)) return;
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerDown) {
      tool.onPointerDown(point, modifiers);
    }
  }

  handleToolPointerMove(point) {
    const handleCloneAngleMove = typeof this.handleCloneAngleCalibrationMove === 'function'
      ? this.handleCloneAngleCalibrationMove
      : PixelStudio.prototype.handleCloneAngleCalibrationMove;
    if (handleCloneAngleMove.call(this, point)) return;
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerMove) {
      tool.onPointerMove(point);
    }
  }

  handleToolPointerUp() {
    const handleCloneAngleUp = typeof this.handleCloneAngleCalibrationUp === 'function'
      ? this.handleCloneAngleCalibrationUp
      : PixelStudio.prototype.handleCloneAngleCalibrationUp;
    if (handleCloneAngleUp.call(this)) return;
    const tool = this.tools.find((entry) => entry.id === this.getEffectiveToolId());
    if (tool?.onPointerUp) {
      tool.onPointerUp();
    }
  }

  shouldUseUnboundedWrapPointer() {
    if (!this.toolOptions.wrapDraw) return false;
    return [
      TOOL_IDS.PENCIL,
      TOOL_IDS.ERASER,
      TOOL_IDS.LINE,
      TOOL_IDS.CURVE,
      TOOL_IDS.RECT,
      TOOL_IDS.ELLIPSE,
      TOOL_IDS.POLYGON,
      TOOL_IDS.GRADIENT,
      TOOL_IDS.CLONE,
      TOOL_IDS.DITHER
    ].includes(this.getEffectiveToolId());
  }

  isSelectionToolActive() {
    return [
      TOOL_IDS.SELECT_RECT,
      TOOL_IDS.SELECT_ELLIPSE,
      TOOL_IDS.SELECT_LASSO,
      TOOL_IDS.SELECT_MAGIC_LASSO,
      TOOL_IDS.SELECT_MAGIC_COLOR
    ].includes(this.getEffectiveToolId());
  }

  setActiveTool(toolId) {
    const previousToolId = this.activeToolId;
    if (previousToolId) this.saveBrushProfile(previousToolId);
    this.activeToolId = toolId;
    this.lastActiveToolId = toolId;
    this.loadBrushProfile(toolId);
    this.linePreview = null;
    this.curvePreview = null;
    this.shapePreview = null;
    this.polygonPreview = null;
    this.gradientPreview = null;
    if (toolId !== TOOL_IDS.CLONE) {
      this.clonePickSourceArmed = false;
      this.clonePickTargetArmed = false;
      this.cloneColorPickArmed = false;
      this.cancelCloneAngleCalibration();
    }
    if ([TOOL_IDS.SELECT_RECT, TOOL_IDS.SELECT_ELLIPSE, TOOL_IDS.SELECT_LASSO, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR, TOOL_IDS.MOVE].includes(toolId)) {
      this.modeTab = 'select';
    } else if (toolId !== TOOL_IDS.EYEDROPPER) {
      this.modeTab = this.modeTab === 'animate' ? 'animate' : 'draw';
    }
    if (!this.menuOpen && !this.controlsOverlayOpen && !this.transformModal && !this.pasteImportModal && !this.paletteGridOpen && !this.brushPickerOpen) {
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
    const rightWidth = (!isMobile && ['layers', 'animation'].includes(this.leftPanelTab)) ? 220 : 0;
    const canvasW = Math.max(1, viewportW - leftWidth - rightWidth - padding * 2);
    const canvasH = Math.max(1, viewportH - (topBarHeight + padding) - bottomHeight);
    const targetZoom = Math.min(canvasW / Math.max(1, this.canvasState.width), canvasH / Math.max(1, this.canvasState.height));

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

  startHistory(label, options = {}) {
    const includeLayers = options.includeLayers !== false;
    this.pendingHistory = {
      label,
      frameIndex: this.animation.currentFrameIndex,
      frameIndexBefore: this.animation.currentFrameIndex,
      boneRigBefore: cloneBoneRig(this.boneRig)
    };
    if (includeLayers) {
      this.pendingHistory.layersBefore = this.canvasState.layers.map((layer) => new Uint32Array(layer.pixels));
    }
    if (options.includeFrames) {
      this.pendingHistory.framesBefore = this.animation.frames.map((frame) => cloneFrame(frame));
    }
    this.invalidateBoneDerivedCaches({ layers: includeLayers, bones: true });
  }

  commitHistory() {
    if (!this.pendingHistory) return;
    const includeLayers = Array.isArray(this.pendingHistory.layersBefore);
    this.pendingHistory.frameIndexAfter = this.animation.currentFrameIndex;
    if (includeLayers) {
      this.pendingHistory.layersAfter = this.canvasState.layers.map((layer) => new Uint32Array(layer.pixels));
    }
    if (this.pendingHistory.framesBefore) {
      this.pendingHistory.framesAfter = this.animation.frames.map((frame) => cloneFrame(frame));
    }
    this.pendingHistory.boneRigAfter = cloneBoneRig(this.boneRig);
    this.runtime.commitHistory(this.pendingHistory);
    this.pendingHistory = null;
    this.invalidateBoneDerivedCaches({ layers: includeLayers, bones: true });
    this.syncTileData();
  }


  applyHistoryEntry(entry, direction) {
    if (!entry) return;
    const frameSnapshots = direction === 'undo' ? entry.framesBefore : entry.framesAfter;
    if (Array.isArray(frameSnapshots) && frameSnapshots.length) {
      this.animation.frames = frameSnapshots.map((frame) => cloneFrame(frame));
      const targetFrameIndex = direction === 'undo'
        ? (entry.frameIndexBefore ?? entry.frameIndex ?? 0)
        : (entry.frameIndexAfter ?? entry.frameIndex ?? 0);
      this.animation.currentFrameIndex = clamp(targetFrameIndex, 0, this.animation.frames.length - 1);
    } else {
      this.animation.currentFrameIndex = clamp(entry.frameIndex || 0, 0, this.animation.frames.length - 1);
      const frame = this.animation.frames[this.animation.currentFrameIndex];
      const layerSnapshots = direction === 'undo' ? entry.layersBefore : entry.layersAfter;
      if (Array.isArray(layerSnapshots) && layerSnapshots.length === frame.layers.length) {
        frame.layers.forEach((layer, index) => {
          layer.pixels.set(layerSnapshots[index]);
        });
      }
    }
    const frame = this.animation.frames[this.animation.currentFrameIndex];
    const boneSnapshot = direction === 'undo' ? entry.boneRigBefore : entry.boneRigAfter;
    if (boneSnapshot) {
      this.boneRig = cloneBoneRig(boneSnapshot);
      this.ensureBoneNodeSelection();
    }
    this.setFrameLayers(frame.layers);
    this.invalidateBoneDerivedCaches();
    this.syncTileData();
  }

  startStroke(point, { mode }) {
    if (!this.activeLayer || this.activeLayer.locked) return;
    this.startHistory(`${mode} stroke`);
    this.cloneSourcePixels = mode === 'clone'
      ? new Uint32Array(this.cloneSourceSnapshot?.pixels || this.activeLayer.pixels)
      : null;
    this.strokeState = {
      mode,
      lastPoint: point,
      pathPoint: point,
      strokeDistance: 0,
      cloneDestinationAnchor: mode === 'clone' ? { row: point.row, col: point.col } : null,
      basePixels: mode === 'clone' ? null : new Uint32Array(this.activeLayer.pixels),
      alphaMap: mode === 'clone' ? null : new Float32Array(this.canvasState.width * this.canvasState.height)
    };
    this.applyBrush(point, 0);
  }

  continueStroke(point) {
    if (!this.strokeState) return;
    const targetPoint = point;
    const line = bresenhamLine(this.strokeState.pathPoint || this.strokeState.lastPoint, targetPoint);
    let strokeDistance = this.strokeState.strokeDistance || 0;
    let prevPoint = this.strokeState.pathPoint || this.strokeState.lastPoint;
    line.forEach((pt, index) => {
      if (index > 0) {
        strokeDistance += Math.hypot(pt.col - prevPoint.col, pt.row - prevPoint.row);
      }
      this.applyBrush(pt, strokeDistance);
      prevPoint = pt;
    });
    this.strokeState.strokeDistance = strokeDistance;
    this.strokeState.pathPoint = targetPoint;
    this.strokeState.lastPoint = point;
  }

  finishStroke() {
    if (!this.strokeState) return;
    this.strokeState = null;
    this.cloneSourcePixels = null;
    this.commitHistory();
  }

  getStrokeFalloffWeight(strokeDistance = 0) {
    const falloff = clamp(this.toolOptions.brushFalloff ?? 0, 0, 1);
    if (falloff <= 0.001) return 1;
    const decayDistance = lerp(600, 2, Math.pow(falloff, 1.3));
    return Math.exp(-Math.max(0, strokeDistance) / Math.max(1, decayDistance));
  }

  applyBrush(point, strokeDistance = 0) {
    const { width, height } = this.canvasState;
    const points = this.createBrushStamp(point);
    const symmetryPoints = applySymmetryPoints(points, width, height, this.toolOptions.symmetry);
    if (this.strokeState?.mode === 'clone') {
      this.strokeState.brushCenter = point;
    }
    let changed = false;
    symmetryPoints.forEach((pt) => {
      const row = this.wrapCoord(pt.row, height);
      const col = this.wrapCoord(pt.col, width);
      if (row < 0 || col < 0 || row >= height || col >= width) return;
      if (this.selection.active && this.selection.mask && !this.selection.mask[row * width + col]) return;
      const index = row * width + col;
      const target = this.activeLayer.pixels[index];
      const strokeWeight = this.getStrokeFalloffWeight(strokeDistance);
      const alpha = (pt.weight ?? 1) * (this.toolOptions.brushOpacity ?? 1) * strokeWeight;
      if (alpha <= 0) return;
      const strokeMode = this.strokeState?.mode || 'paint';
      if (strokeMode === 'clone') {
        this.applyCloneStroke({ row, col }, alpha);
        return;
      }
      let colorValue = this.getActiveColorValue();
      if (strokeMode === 'erase' || this.eraserColorActive) colorValue = 0;
      if (strokeMode === 'dither') {
        if (!this.shouldApplyDither(row, col)) return;
      }
      let alphaToApply = alpha;
      let blendSource = target;
      if (this.strokeState?.alphaMap && this.strokeState?.basePixels) {
        const prevAlpha = this.strokeState.alphaMap[index] || 0;
        if (alpha <= prevAlpha) return;
        this.strokeState.alphaMap[index] = alpha;
        alphaToApply = alpha;
        blendSource = this.strokeState.basePixels[index];
      }
      if (this.toolOptions.symmetry?.mirrorOnly && target === colorValue) return;
      const nextValue = alphaToApply >= 1
        ? colorValue
        : this.blendPixel(blendSource, colorValue, alphaToApply);
      if (this.activeLayer.pixels[index] === nextValue) return;
      this.activeLayer.pixels[index] = nextValue;
      changed = true;
    });
    if (changed) {
      if (typeof this.markLayerPixelsDirty === 'function') this.markLayerPixelsDirty();
      else this.layerContentRevision = (this.layerContentRevision || 1) + 1;
    }
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

  getBrushShapeEdgeT(shape, dx, dy, radius) {
    const safeRadius = Math.max(1, radius);
    if (shape === 'circle') {
      return clamp(Math.hypot(dx, dy) / Math.max(0.5, safeRadius), 0, 1);
    }
    if (shape === 'diamond') {
      return clamp((Math.abs(dx) + Math.abs(dy)) / safeRadius, 0, 1);
    }
    if (shape === 'cross' || shape === 'x') {
      return clamp(Math.max(Math.abs(dx), Math.abs(dy)) / safeRadius, 0, 1);
    }
    if (shape === 'hline') {
      return clamp(Math.abs(dx) / safeRadius, 0, 1);
    }
    if (shape === 'vline') {
      return clamp(Math.abs(dy) / safeRadius, 0, 1);
    }
    return clamp(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(0.5, safeRadius), 0, 1);
  }

  createBrushStamp(point) {
    const size = this.toolOptions.brushSize;
    const radius = Math.floor(size / 2);
    const points = [];
    const shape = this.toolOptions.brushShape;
    const hardness = clamp(this.toolOptions.brushHardness ?? 1, 0, 1);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.doesBrushShapeIncludeOffset(shape, dx, dy, radius)) continue;
        const edgeT = this.getBrushShapeEdgeT(shape, dx, dy, radius);
        // Hardness is a center-to-edge gradient control:
        // - hardness=1 => flat 1.0 opacity across the whole brush
        // - hardness=0 => full gradient (1.0 at center down to 0.0 at edge)
        // - hardness=0.5 => edge is 0.5 opacity, still 1.0 at center
        const edgeAlpha = hardness;
        const weight = lerp(1, edgeAlpha, edgeT);
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
    if (this.eraserColorActive) return 0;
    const hex = getPaletteSwatchHex(this.currentPalette, this.paletteIndex);
    return rgbaToUint32(hexToRgba(hex));
  }

  pickColor(point) {
    const composite = compositeLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    const value = composite[point.row * this.canvasState.width + point.col];
    if (!value) return;
    const rgba = uint32ToRgba(value);
    const sampledHex = `#${[rgba.r, rgba.g, rgba.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    let sampledIndex = this.currentPalette.colors.findIndex((entry) => entry?.hex === sampledHex);
    if (sampledIndex < 0) {
      this.currentPalette.colors.push({
        id: `color-${Date.now()}`,
        hex: sampledHex,
        rgba: { r: rgba.r, g: rgba.g, b: rgba.b, a: 255 }
      });
      sampledIndex = this.currentPalette.colors.length - 1;
    }
    this.setPaletteIndex(sampledIndex);
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
    const phase = this.selectionMarchPhase || 0;
    const drawPhase = (strokeStyle, offset) => {
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = Math.max(1, Math.min(2, zoom * 0.2));
      ctx.setLineDash([dash, dash]);
      ctx.lineDashOffset = phase + offset;
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
    this.prepareSelectionCombineBase();
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const contiguous = options.contiguous !== false;
    const threshold = clamp(Number(this.toolOptions.magicThreshold) || 0, 0, 255);
    let composite = this.getCachedBonePreviewComposite(width, height);
    if (this.activeToolId === TOOL_IDS.HUE_SHIFT && !this.isHueShiftNeutral()) {
      composite = this.buildHueShiftPreview(composite);
    }
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

    this.applySelectionMask(mask);
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

  shiftPixelHue(pixel, hueShiftDegrees = 0, saturationPercent = 100) {
    const rgba = uint32ToRgba(pixel || 0);
    const alpha = Number(rgba.a ?? 255);
    if (alpha <= 0) return pixel;
    const r = (rgba.r || 0) / 255;
    const g = (rgba.g || 0) / 255;
    const b = (rgba.b || 0) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    const saturationScale = clamp((Number(saturationPercent) || 100) / 100, 0, 2);
    const adjustedSaturation = clamp(saturation * saturationScale, 0, 1);
    const nextHue = ((hue + hueShiftDegrees) % 360 + 360) % 360;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * adjustedSaturation;
    const x = chroma * (1 - Math.abs(((nextHue / 60) % 2) - 1));
    const m = lightness - chroma / 2;
    let nr = 0; let ng = 0; let nb = 0;
    if (nextHue < 60) [nr, ng, nb] = [chroma, x, 0];
    else if (nextHue < 120) [nr, ng, nb] = [x, chroma, 0];
    else if (nextHue < 180) [nr, ng, nb] = [0, chroma, x];
    else if (nextHue < 240) [nr, ng, nb] = [0, x, chroma];
    else if (nextHue < 300) [nr, ng, nb] = [x, 0, chroma];
    else [nr, ng, nb] = [chroma, 0, x];
    return rgbaToUint32({
      r: Math.round((nr + m) * 255),
      g: Math.round((ng + m) * 255),
      b: Math.round((nb + m) * 255),
      a: alpha
    }) >>> 0;
  }

  applyHueShift() {
    if (!this.activeLayer || this.activeLayer.locked) return;
    const shift = Number(this.toolOptions.hueShiftDegrees || 0);
    const saturation = Number(this.toolOptions.hueShiftSaturation || 100);
    if (!Number.isFinite(shift) || Math.abs(shift) < 0.001) {
      if (Math.round(saturation) === 100) {
        this.statusMessage = 'Hue/Saturation adjustment is neutral.';
        return;
      }
    }
    if (!Number.isFinite(saturation)) {
      this.statusMessage = 'Saturation value is invalid.';
      return;
    }
    this.startHistory('hue shift');
    for (let i = 0; i < this.activeLayer.pixels.length; i += 1) {
      if (this.toolOptions.replaceScope === 'selection' && this.selection.mask && !this.selection.mask[i]) continue;
      this.activeLayer.pixels[i] = this.shiftPixelHue(this.activeLayer.pixels[i], shift, saturation);
    }
    this.commitHistory();
    this.statusMessage = `Hue ${Math.round(shift)}°, Saturation ${Math.round(saturation)}% (${this.toolOptions.replaceScope}).`;
  }

  isHueShiftNeutral() {
    const shift = Number(this.toolOptions.hueShiftDegrees || 0);
    const saturation = Number(this.toolOptions.hueShiftSaturation || 100);
    return Math.abs(shift) < 0.001 && Math.abs(saturation - 100) < 0.001;
  }

  buildHueShiftPreview(composite) {
    if (!(composite instanceof Uint32Array)) return composite;
    if (this.isHueShiftNeutral()) return composite;
    const shifted = new Uint32Array(composite.length);
    const shift = Number(this.toolOptions.hueShiftDegrees || 0);
    const saturation = Number(this.toolOptions.hueShiftSaturation || 100);
    for (let i = 0; i < composite.length; i += 1) {
      shifted[i] = this.shiftPixelHue(composite[i], shift, saturation);
    }
    return shifted;
  }

  startSelection(point, mode) {
    this.prepareSelectionCombineBase();
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
    const mask = this.selection.mode === 'ellipse'
      ? generateEllipseMask(this.canvasState.width, this.canvasState.height, bounds)
      : createRectMask(this.canvasState.width, this.canvasState.height, bounds);
    this.applySelectionMask(mask);
    this.selection.start = null;
    this.selection.end = null;
    if (this.selection.active && this.gamepadCursor.active) {
      this.openSelectionContextMenu();
    }
  }

  prepareSelectionCombineBase() {
    this.selection.baseMask = this.selection.mask
      ? new Uint8Array(this.selection.mask)
      : null;
  }

  applySelectionMask(mask) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const size = width * height;
    const combineMode = this.selection.combineMode || 'replace';
    const filterRigMask = typeof this.filterMaskToActiveLayerOpaque === 'function'
      ? this.filterMaskToActiveLayerOpaque
      : PixelStudio.prototype.filterMaskToActiveLayerOpaque;
    let filteredMask = mask;
    if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'bind') {
      filteredMask = filterRigMask.call(this, mask);
    }
    let nextMask = filteredMask;
    if (combineMode !== 'replace') {
      nextMask = this.selection.baseMask
        ? new Uint8Array(this.selection.baseMask)
        : new Uint8Array(size);
      filteredMask.forEach((value, index) => {
        if (!value) return;
        nextMask[index] = combineMode === 'subtract' ? 0 : 1;
      });
    }
    if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'bind') {
      nextMask = filterRigMask.call(this, nextMask);
    }
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
    this.selection.active = Boolean(this.selection.bounds);
    this.selection.baseMask = null;
    if (!this.selection.active) {
      this.selection.mask = null;
      this.selection.bounds = null;
    }
  }

  filterMaskToActiveLayerOpaque(mask) {
    if (!mask) return mask;
    const layerPixels = this.canvasState?.layers?.[this.canvasState?.activeLayerIndex || 0]?.pixels;
    if (!layerPixels) return mask;
    const nextMask = new Uint8Array(mask.length);
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] && layerPixels[index]) nextMask[index] = 1;
    }
    return nextMask;
  }

  cycleSelectionCombineMode(delta = 1) {
    const modes = ['replace', 'add', 'subtract'];
    const current = modes.indexOf(this.selection.combineMode || 'replace');
    const next = (current + delta + modes.length) % modes.length;
    this.selection.combineMode = modes[next];
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
    this.prepareSelectionCombineBase();
    let snapped = point;
    if (options.magic) {
      this.magicLassoEdgeMap = this.buildMagicLassoEdgeMap();
      this.magicLassoLastVector = null;
      snapped = this.getMagicLassoPoint(point);
      const idx = snapped.row * this.canvasState.width + snapped.col;
      this.magicLassoAnchorRgba = this.magicLassoRgbaMap?.[idx] || null;
    }
    this.selection.active = false;
    if ((this.selection.combineMode || 'replace') === 'replace') {
      this.selection.mask = null;
      this.selection.bounds = null;
    }
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
    this.cleanLassoPathArtifacts();
    if (segment.length) {
      const end = segment[segment.length - 1];
      this.selection.end = { row: end.row, col: end.col };
    } else {
      this.selection.end = snapped;
    }
  }

  cleanLassoPathArtifacts() {
    if (this.selection.lassoPoints.length < 3) return;
    const points = this.selection.lassoPoints;
    let changed = true;
    while (changed && points.length >= 3) {
      changed = false;
      // Remove immediate backtracks A->B->A.
      for (let i = 2; i < points.length; i += 1) {
        const a = points[i - 2];
        const c = points[i];
        if (a.x === c.x && a.y === c.y) {
          points.splice(i - 1, 1);
          changed = true;
          break;
        }
      }
      if (changed) continue;
      // Collapse collinear points.
      for (let i = 2; i < points.length; i += 1) {
        const p0 = points[i - 2];
        const p1 = points[i - 1];
        const p2 = points[i];
        const x1 = p1.x - p0.x;
        const y1 = p1.y - p0.y;
        const x2 = p2.x - p1.x;
        const y2 = p2.y - p1.y;
        if ((x1 * y2) - (y1 * x2) === 0) {
          points.splice(i - 1, 1);
          changed = true;
          break;
        }
      }
    }
  }

  getLassoPreviewPixels() {
    if (!this.selection.lassoPoints || this.selection.lassoPoints.length < 2) return [];
    const unique = new Set();
    const points = [];
    const push = (row, col) => {
      const key = `${row},${col}`;
      if (unique.has(key)) return;
      unique.add(key);
      points.push({ row, col });
    };
    for (let i = 1; i < this.selection.lassoPoints.length; i += 1) {
      const a = this.selection.lassoPoints[i - 1];
      const b = this.selection.lassoPoints[i];
      const line = bresenhamLine({ row: Math.floor(a.y), col: Math.floor(a.x) }, { row: Math.floor(b.y), col: Math.floor(b.x) });
      line.forEach((pt) => push(pt.row, pt.col));
    }
    return points;
  }

  buildMagicLassoEdgeMap() {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    let composite = compositeLayers(this.canvasState.layers, width, height);
    if (this.activeToolId === TOOL_IDS.HUE_SHIFT && !this.isHueShiftNeutral()) {
      composite = this.buildHueShiftPreview(composite);
    }
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
      if (this.selection.baseMask) {
        this.selection.mask = new Uint8Array(this.selection.baseMask);
        this.selection.bounds = this.getMaskBounds(this.selection.mask);
        this.selection.active = Boolean(this.selection.bounds);
      }
      this.selection.baseMask = null;
      this.selection.lassoPoints = [];
      this.magicLassoEdgeMap = null;
      this.magicLassoLastVector = null;
      this.magicLassoEdgeMax = 1;
      this.magicLassoRgbaMap = null;
      this.magicLassoAnchorRgba = null;
      return;
    }
    const mask = createPolygonMask(this.canvasState.width, this.canvasState.height, this.selection.lassoPoints);
    this.applySelectionMask(mask);
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
    const transformHit = this.getSelectionTransformHit(point);
    if (transformHit?.type === 'rotate' || transformHit?.type === 'scale') {
      const startMask = new Uint8Array(this.selection.mask);
      const startBounds = this.selection.bounds ? { ...this.selection.bounds } : null;
      this.moveTransformDrag = {
        type: transformHit.type,
        handle: transformHit.handle || null,
        start: point,
        current: point,
        center: this.getSelectionCenterPoint(),
        startMask,
        startPixels: this.getSelectedPixelsSnapshot(startMask),
        startBounds,
        startRotation: 0,
        startW: Math.max(1, startBounds?.w || 1),
        startH: Math.max(1, startBounds?.h || 1)
      };
      return;
    }
    this.moveTransformDrag = null;
    this.selection.floating = this.getSelectedPixelsSnapshot();
    this.selection.offset = { x: 0, y: 0 };
    this.selection.start = point;
  }

  updateMove(point) {
    if (this.moveTransformDrag) {
      this.moveTransformDrag.current = point;
      return;
    }
    if (!this.selection.floating || !this.selection.start) return;
    this.selection.offset = {
      x: point.col - this.selection.start.col,
      y: point.row - this.selection.start.row
    };
  }

  commitMove() {
    if (this.moveTransformDrag?.type === 'rotate' || this.moveTransformDrag?.type === 'scale') {
      const drag = this.moveTransformDrag;
      this.moveTransformDrag = null;
      this.commitSelectionTransformDrag(drag);
      return;
    }
    if (!this.selection.floating) return;
    this.startHistory('move selection');
    const nextLayer = new Uint32Array(this.activeLayer.pixels);
    if (this.selection.mask) {
      for (let i = 0; i < nextLayer.length; i += 1) {
        if (this.selection.mask[i]) nextLayer[i] = 0;
      }
    }
    this.pasteSelectionPixels(this.selection.floating, this.selection.offset.x, this.selection.offset.y, nextLayer);
    this.activeLayer.pixels = nextLayer;
    this.translateSelectionMask(this.selection.offset.x, this.selection.offset.y);
    this.selection.floating = null;
    this.selection.start = null;
    this.selection.offset = { x: 0, y: 0 };
    this.commitHistory();
  }

  getSelectionCenterPoint() {
    const bounds = this.selection.bounds;
    if (!bounds) return { col: 0, row: 0 };
    return {
      col: bounds.x + (bounds.w - 1) / 2,
      row: bounds.y + (bounds.h - 1) / 2
    };
  }

  getSelectionTransformMeta(rotationDeg = 0) {
    const bounds = this.selection.bounds;
    if (!bounds) return null;
    return buildTransformHandleMeta({
      x: bounds.x,
      y: bounds.y,
      w: Math.max(1, bounds.w),
      h: Math.max(1, bounds.h),
      rotationDeg,
      orbOffset: 7
    });
  }

  getSelectionTransformHit(point) {
    const meta = this.getSelectionTransformMeta(0);
    if (!meta) return null;
    const hit = hitTestTransformHandles({
      point: { x: point.col + 0.5, y: point.row + 0.5 },
      meta,
      radius: 2.0,
      rotateFirst: true
    });
    if (hit?.type === 'scale') return { type: 'scale', handle: hit.handle.key };
    if (hit?.type === 'rotate') return { type: 'rotate' };
    return null;
  }

  getSelectedPixelsSnapshot(mask = this.selection.mask) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const pixels = new Uint32Array(width * height);
    this.activeLayer.pixels.forEach((value, index) => {
      if (!mask || !mask[index]) return;
      pixels[index] = value;
    });
    return pixels;
  }

  buildSelectionTransformResult(drag) {
    if (!drag || !drag.startMask || !drag.startPixels || !drag.startBounds) return null;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const nextPixels = new Uint32Array(width * height);
    const nextMask = new Uint8Array(width * height);
    const centerX = drag.center.col;
    const centerY = drag.center.row;

    if (drag.type === 'rotate') {
      const startAngle = Math.atan2(drag.start.row - centerY, drag.start.col - centerX);
      const endAngle = Math.atan2(drag.current.row - centerY, drag.current.col - centerX);
      const angle = endAngle - startAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let minCol = width;
      let maxCol = -1;
      let minRow = height;
      let maxRow = -1;
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const srcIndex = row * width + col;
          if (!drag.startMask[srcIndex]) continue;
          const rx = col - centerX;
          const ry = row - centerY;
          const tx = centerX + rx * cos - ry * sin;
          const ty = centerY + rx * sin + ry * cos;
          minCol = Math.min(minCol, Math.floor(tx));
          maxCol = Math.max(maxCol, Math.ceil(tx));
          minRow = Math.min(minRow, Math.floor(ty));
          maxRow = Math.max(maxRow, Math.ceil(ty));
        }
      }
      if (maxCol < minCol || maxRow < minRow) return null;
      minCol = clamp(minCol, 0, width - 1);
      maxCol = clamp(maxCol, 0, width - 1);
      minRow = clamp(minRow, 0, height - 1);
      maxRow = clamp(maxRow, 0, height - 1);
      for (let destRow = minRow; destRow <= maxRow; destRow += 1) {
        for (let destCol = minCol; destCol <= maxCol; destCol += 1) {
          const dx = destCol - centerX;
          const dy = destRow - centerY;
          const srcX = centerX + dx * cos + dy * sin;
          const srcY = centerY - dx * sin + dy * cos;
          const srcCol = Math.round(srcX);
          const srcRow = Math.round(srcY);
          if (srcRow < 0 || srcCol < 0 || srcRow >= height || srcCol >= width) continue;
          const srcIndex = srcRow * width + srcCol;
          if (!drag.startMask[srcIndex]) continue;
          const destIndex = destRow * width + destCol;
          nextMask[destIndex] = 1;
          const value = drag.startPixels[srcIndex];
          if (value) nextPixels[destIndex] = value;
        }
      }
      return { pixels: nextPixels, mask: nextMask, rotationDeg: angle * (180 / Math.PI) };
    }

    if (drag.type === 'scale') {
      const worldX = drag.current.col;
      const worldY = drag.current.row;
      const bounds = drag.startBounds || { x: centerX, y: centerY, w: 1, h: 1 };
      const hasWest = drag.handle?.includes('w');
      const hasEast = drag.handle?.includes('e');
      const hasNorth = drag.handle?.includes('n');
      const hasSouth = drag.handle?.includes('s');

      const minSize = 1;
      const left = bounds.x;
      const right = bounds.x + Math.max(1, bounds.w) - 1;
      const top = bounds.y;
      const bottom = bounds.y + Math.max(1, bounds.h) - 1;

      let targetLeft = left;
      let targetRight = right;
      if (hasWest) {
        targetRight = right;
        targetLeft = Math.min(worldX, targetRight - (minSize - 1));
      } else if (hasEast) {
        targetLeft = left;
        targetRight = Math.max(worldX, targetLeft + (minSize - 1));
      } else {
        const halfW = Math.max(0.5, Math.abs(worldX - centerX));
        targetLeft = centerX - halfW;
        targetRight = centerX + halfW;
      }

      let targetTop = top;
      let targetBottom = bottom;
      if (hasNorth) {
        targetBottom = bottom;
        targetTop = Math.min(worldY, targetBottom - (minSize - 1));
      } else if (hasSouth) {
        targetTop = top;
        targetBottom = Math.max(worldY, targetTop + (minSize - 1));
      } else {
        const halfH = Math.max(0.5, Math.abs(worldY - centerY));
        targetTop = centerY - halfH;
        targetBottom = centerY + halfH;
      }

      const minCol = clamp(Math.floor(targetLeft), 0, width - 1);
      const maxCol = clamp(Math.ceil(targetRight), 0, width - 1);
      const minRow = clamp(Math.floor(targetTop), 0, height - 1);
      const maxRow = clamp(Math.ceil(targetBottom), 0, height - 1);
      if (maxCol < minCol || maxRow < minRow) return null;

      const anchorX = hasWest ? right : hasEast ? left : centerX;
      const anchorY = hasNorth ? bottom : hasSouth ? top : centerY;
      const targetW = Math.max(1, maxCol - minCol + 1);
      const targetH = Math.max(1, maxRow - minRow + 1);
      const scaleX = targetW / Math.max(1, drag.startW);
      const scaleY = targetH / Math.max(1, drag.startH);

      for (let destRow = minRow; destRow <= maxRow; destRow += 1) {
        for (let destCol = minCol; destCol <= maxCol; destCol += 1) {
          const srcX = anchorX + (destCol - anchorX) / Math.max(0.0001, scaleX);
          const srcY = anchorY + (destRow - anchorY) / Math.max(0.0001, scaleY);
          const srcCol = Math.round(srcX);
          const srcRow = Math.round(srcY);
          if (srcRow < 0 || srcCol < 0 || srcRow >= height || srcCol >= width) continue;
          const srcIndex = srcRow * width + srcCol;
          if (!drag.startMask[srcIndex]) continue;
          const destIndex = destRow * width + destCol;
          nextMask[destIndex] = 1;
          const value = drag.startPixels[srcIndex];
          if (value) nextPixels[destIndex] = value;
        }
      }
      return { pixels: nextPixels, mask: nextMask, rotationDeg: 0 };
    }


    return null;
  }

  buildMoveTransformPreview() {
    return this.buildSelectionTransformResult(this.moveTransformDrag);
  }

  commitSelectionTransformDrag(drag) {
    const transformed = this.buildSelectionTransformResult(drag);
    if (!transformed) return;
    this.startHistory(drag.type === 'rotate' ? 'rotate selection' : 'scale selection');
    const nextLayer = new Uint32Array(this.activeLayer.pixels);
    for (let i = 0; i < nextLayer.length; i += 1) {
      if (drag.startMask[i]) nextLayer[i] = 0;
    }
    for (let i = 0; i < transformed.pixels.length; i += 1) {
      const value = transformed.pixels[i];
      if (value) nextLayer[i] = value;
    }
    this.activeLayer.pixels = nextLayer;
    this.selection.mask = transformed.mask;
    this.selection.bounds = this.getMaskBounds(transformed.mask);
    this.selection.active = Boolean(this.selection.bounds);
    this.commitHistory();
  }

  translateSelectionMask(dx, dy) {
    if (!this.selection.mask) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const nextMask = new Uint8Array(width * height);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const srcIndex = row * width + col;
        if (!this.selection.mask[srcIndex]) continue;
        const destRow = row + dy;
        const destCol = col + dx;
        if (destRow < 0 || destCol < 0 || destRow >= height || destCol >= width) continue;
        nextMask[destRow * width + destCol] = 1;
      }
    }
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
    this.selection.active = Boolean(this.selection.bounds);
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

  pasteSelectionPixels(pixels, offsetX, offsetY, targetPixels = this.activeLayer.pixels) {
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
        targetPixels[destIndex] = value;
      }
    }
  }

  nudgeSelection(dx, dy) {
    if (!this.selection.active) return;
    this.startHistory('nudge selection');
    const pixels = this.extractSelectionPixels();
    this.pasteSelectionPixels(pixels, dx, dy);
    this.translateSelectionMask(dx, dy);
    this.commitHistory();
  }

  scaleSelectionByRatio(ratio) {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const bounds = this.selection.bounds;
    const srcMask = new Uint8Array(this.selection.mask);
    const pixels = this.extractSelectionPixels();
    const next = new Uint32Array(this.activeLayer.pixels);
    const nextMask = new Uint8Array(width * height);
    const targetW = Math.max(1, Math.round(bounds.w * ratio));
    const targetH = Math.max(1, Math.round(bounds.h * ratio));
    this.startHistory(`scale ${ratio.toFixed(2)}x`);
    for (let y = 0; y < targetH; y += 1) {
      for (let x = 0; x < targetW; x += 1) {
        const srcLocalX = clamp(Math.floor((x / Math.max(1, targetW)) * bounds.w), 0, bounds.w - 1);
        const srcLocalY = clamp(Math.floor((y / Math.max(1, targetH)) * bounds.h), 0, bounds.h - 1);
        const srcCol = bounds.x + srcLocalX;
        const srcRow = bounds.y + srcLocalY;
        const srcIndex = srcRow * width + srcCol;
        if (!srcMask[srcIndex]) continue;
        const destCol = bounds.x + x;
        const destRow = bounds.y + y;
        if (destRow < 0 || destCol < 0 || destRow >= height || destCol >= width) continue;
        const destIndex = destRow * width + destCol;
        nextMask[destIndex] = 1;
        const value = pixels[srcIndex];
        if (value) next[destIndex] = value;
      }
    }
    this.activeLayer.pixels = next;
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
    this.selection.active = Boolean(this.selection.bounds);
    this.commitHistory();
  }

  copySelection() {
    if (!this.selection.active || !this.selection.mask) {
      this.selectAllSelection();
    }
    const bounds = this.selection.bounds;
    if (!bounds || !this.selection.mask) return;
    const canvasWidth = this.canvasState.width;
    const width = Math.max(1, bounds.w);
    const height = Math.max(1, bounds.h);
    const pixels = new Uint32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const srcX = bounds.x + x;
        const srcY = bounds.y + y;
        const srcIndex = srcY * canvasWidth + srcX;
        if (!this.selection.mask[srcIndex]) continue;
        pixels[y * width + x] = this.activeLayer.pixels[srcIndex];
      }
    }
    this.clipboard = { width, height, pixels, originX: bounds.x, originY: bounds.y, internal: true };
    this.writeClipboardToSystem(this.clipboard).catch(() => {});
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

  async pasteClipboard() {
    await this.readClipboardFromSystem();
    if (!this.clipboard) return;
    const source = this.clipboard;
    const srcW = Number(source.width || 0);
    const srcH = Number(source.height || 0);
    if (!srcW || !srcH || !this.clipboard.pixels) return;
    const maxW = this.canvasState.width;
    const maxH = this.canvasState.height;
    if (srcW > maxW || srcH > maxH) {
      this.openPasteImportModal(source, { pasteToNewLayer: true });
      return;
    }
    this.applyClipboardPaste(source, { pasteToNewLayer: true });
  }

  applyClipboardPaste(source, options = {}) {
    const srcW = Number(source?.width || 0);
    const srcH = Number(source?.height || 0);
    if (!srcW || !srcH || !source?.pixels) return;
    const maxW = this.canvasState.width;
    const maxH = this.canvasState.height;
    const pasteToNewLayer = options.pasteToNewLayer === true;
    if (pasteToNewLayer) {
      this.addLayer();
    }
    this.startHistory('paste');
    const origin = getPixelClipboardPasteOrigin(source, maxW, maxH, this.getPasteViewportCenterCell());
    const pasted = applyPixelClipboardPixelsToLayer({
      source,
      layerPixels: this.activeLayer.pixels,
      canvasWidth: maxW,
      canvasHeight: maxH,
      origin
    });
    this.commitHistory();
    if (pasted?.mask) this.setSelectionMask(pasted.mask);
    this.setActiveTool(TOOL_IDS.MOVE);
  }

  getPasteViewportCenterCell() {
    const bounds = this.canvasViewportBounds || this.canvasBounds;
    if (bounds?.w > 0 && bounds?.h > 0) {
      const point = this.getGridCellFromScreen(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
      if (point) return { centerCol: point.col, centerRow: point.row };
    }
    return { centerCol: this.canvasState.width / 2, centerRow: this.canvasState.height / 2 };
  }

  openPasteImportModal(source, options = {}) {
    this.pasteImportModal = {
      source,
      mode: 'scale',
      crop: true,
      pasteToNewLayer: options.pasteToNewLayer === true,
      buttons: []
    };
  }

  async writeClipboardToSystem(clipboard) {
    if (!clipboard || !navigator?.clipboard || typeof ClipboardItem === 'undefined') return;
    const imageData = new ImageData(clipboard.width, clipboard.height);
    clipboard.pixels.forEach((value, index) => {
      const rgba = uint32ToRgba(value || 0);
      const base = index * 4;
      imageData.data[base] = rgba.r;
      imageData.data[base + 1] = rgba.g;
      imageData.data[base + 2] = rgba.b;
      imageData.data[base + 3] = rgba.a;
    });
    const canvas = document.createElement('canvas');
    canvas.width = clipboard.width;
    canvas.height = clipboard.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) return;
    const textBlob = new Blob([JSON.stringify({
      type: 'pixelstudio-clipboard',
      width: clipboard.width,
      height: clipboard.height,
      originX: Number.isFinite(clipboard.originX) ? clipboard.originX : null,
      originY: Number.isFinite(clipboard.originY) ? clipboard.originY : null,
      internal: true,
      pixels: Array.from(clipboard.pixels)
    })], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
        'text/plain': textBlob
      })
    ]);
  }

  async readClipboardFromSystem() {
    if (!navigator?.clipboard) return;
    try {
      if (typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        let imageClipboard = null;
        let parsedTextClipboard = null;
        let plainTextClipboard = '';
        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(bitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
            const pixels = new Uint32Array(bitmap.width * bitmap.height);
            for (let i = 0; i < pixels.length; i += 1) {
              const base = i * 4;
              pixels[i] = rgbaToUint32({
                r: imageData.data[base],
                g: imageData.data[base + 1],
                b: imageData.data[base + 2],
                a: imageData.data[base + 3]
              });
            }
            imageClipboard = { width: bitmap.width, height: bitmap.height, pixels };
            continue;
          }
          if (item.types.includes('text/html')) {
            const htmlBlob = await item.getType('text/html');
            const html = await htmlBlob.text();
            const htmlImageClipboard = await this.parseClipboardHtmlImage(html);
            if (htmlImageClipboard) {
              imageClipboard = htmlImageClipboard;
              continue;
            }
          }
          if (item.types.includes('text/plain')) {
            const textBlob = await item.getType('text/plain');
            const text = await textBlob.text();
            const parsedClipboard = await this.parseClipboardTextPayload(text);
            if (parsedClipboard) {
              parsedTextClipboard = parsedClipboard;
            } else {
              plainTextClipboard = text;
            }
          }
        }
        if (parsedTextClipboard) {
          this.clipboard = parsedTextClipboard;
          return;
        }
        if (imageClipboard) {
          this.clipboard = imageClipboard;
          return;
        }
        if (plainTextClipboard) {
          const choice = await this.promptClipboardTextChoice();
          if (choice !== 'text') return;
          const textClipboard = this.textToClipboardPayload(plainTextClipboard);
          if (textClipboard) this.clipboard = textClipboard;
        }
      } else if (typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        const parsedClipboard = await this.parseClipboardTextPayload(text);
        if (parsedClipboard) {
          this.clipboard = parsedClipboard;
          return;
        }
        if (text) {
          const choice = await this.promptClipboardTextChoice();
          if (choice === 'text') {
            const textClipboard = this.textToClipboardPayload(text);
            if (textClipboard) this.clipboard = textClipboard;
          }
        }
      }
    } catch (error) {
      console.warn('PixelStudio clipboard read failed; using internal clipboard fallback.', error);
    }
  }

  async promptClipboardTextChoice() {
    return openChoiceOverlay({
      title: 'Clipboard Text',
      message: 'The clipboard contains text. Choose how to handle it.',
      choices: [
        { label: 'Paste as Text Art', value: 'text', primary: true },
        { label: 'Use Internal Pixels', value: 'internal' }
      ],
      cancelText: 'Cancel'
    });
  }

  async parseClipboardHtmlImage(html) {
    const source = String(html || '');
    if (!source) return null;
    const imgSrcMatch = source.match(/<img[^>]+src=["']([^"']+)["']/i);
    const src = imgSrcMatch?.[1] || '';
    if (!src) return null;
    if (!/^data:image\//i.test(src) && !/^https?:\/\//i.test(src)) return null;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const pixels = new Uint32Array(bitmap.width * bitmap.height);
      for (let i = 0; i < pixels.length; i += 1) {
        const base = i * 4;
        pixels[i] = rgbaToUint32({
          r: imageData.data[base],
          g: imageData.data[base + 1],
          b: imageData.data[base + 2],
          a: imageData.data[base + 3]
        });
      }
      return { width: bitmap.width, height: bitmap.height, pixels };
    } catch {
      return null;
    }
  }

  scaleClipboardToFit(clipboard, maxW, maxH) {
    const srcW = Number(clipboard?.width || 0);
    const srcH = Number(clipboard?.height || 0);
    if (!srcW || !srcH || !clipboard?.pixels) return clipboard;
    const targetW = Math.max(1, Math.floor(maxW || srcW));
    const targetH = Math.max(1, Math.floor(maxH || srcH));
    if (targetW === srcW && targetH === srcH) return clipboard;
    const pixels = new Uint32Array(targetW * targetH);
    for (let y = 0; y < targetH; y += 1) {
      for (let x = 0; x < targetW; x += 1) {
        const srcX = Math.min(srcW - 1, Math.floor(((x + 0.5) / targetW) * srcW));
        const srcY = Math.min(srcH - 1, Math.floor(((y + 0.5) / targetH) * srcH));
        pixels[y * targetW + x] = clipboard.pixels[srcY * srcW + srcX];
      }
    }
    return { width: targetW, height: targetH, pixels };
  }

  cropClipboardToOpaqueBounds(clipboard) {
    const srcW = Number(clipboard?.width || 0);
    const srcH = Number(clipboard?.height || 0);
    if (!srcW || !srcH || !clipboard?.pixels) return clipboard;
    const alphaThreshold = 10;
    let minX = srcW;
    let minY = srcH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < srcH; y += 1) {
      for (let x = 0; x < srcW; x += 1) {
        const value = clipboard.pixels[y * srcW + x];
        if (!value || uint32ToRgba(value).a <= alphaThreshold) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return clipboard;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const pixels = new Uint32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        pixels[y * width + x] = clipboard.pixels[(minY + y) * srcW + (minX + x)];
      }
    }
    return { width, height, pixels };
  }

  async parseClipboardTextPayload(text) {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === 'pixelstudio-clipboard' && parsed?.width > 0 && parsed?.height > 0 && Array.isArray(parsed?.pixels)) {
        return {
          width: parsed.width,
          height: parsed.height,
          originX: Number.isFinite(parsed.originX) ? parsed.originX : null,
          originY: Number.isFinite(parsed.originY) ? parsed.originY : null,
          internal: Boolean(parsed.internal),
          pixels: Uint32Array.from(parsed.pixels)
        };
      }
    } catch {}
    const dataUrlMatch = String(text).match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
    if (!dataUrlMatch) return null;
    try {
      const response = await fetch(dataUrlMatch[0]);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const pixels = new Uint32Array(bitmap.width * bitmap.height);
      for (let i = 0; i < pixels.length; i += 1) {
        const base = i * 4;
        pixels[i] = rgbaToUint32({
          r: imageData.data[base],
          g: imageData.data[base + 1],
          b: imageData.data[base + 2],
          a: imageData.data[base + 3]
        });
      }
      return { width: bitmap.width, height: bitmap.height, pixels };
    } catch {
      return null;
    }
  }

  textToClipboardPayload(text) {
    const content = String(text || '').trim();
    if (!content) return null;
    const lines = content.slice(0, 1200).split(/\r?\n/).slice(0, 24);
    const fontSize = 16;
    const padding = 8;
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) return null;
    measure.font = `${fontSize}px monospace`;
    const textWidth = Math.ceil(lines.reduce((max, line) => Math.max(max, measure.measureText(line).width), 0));
    const width = Math.max(1, textWidth + padding * 2);
    const height = Math.max(1, lines.length * (fontSize + 4) + padding * 2);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillText(line, padding, padding + index * (fontSize + 4));
    });
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = new Uint32Array(width * height);
    for (let i = 0; i < pixels.length; i += 1) {
      const base = i * 4;
      pixels[i] = rgbaToUint32({
        r: imageData.data[base],
        g: imageData.data[base + 1],
        b: imageData.data[base + 2],
        a: imageData.data[base + 3]
      });
    }
    return { width, height, pixels };
  }

  selectAllSelection() {
    const size = this.canvasState.width * this.canvasState.height;
    const mask = new Uint8Array(size);
    mask.fill(1);
    if (this.leftPanelTab === 'bones' && this.boneEditor?.mode === 'bind') {
      this.applySelectionMask(mask);
      this.selection.mode = null;
      this.selection.start = null;
      this.selection.end = null;
      this.selection.lassoPoints = [];
      this.selectionContextMenu = null;
      return;
    }
    this.selection.mask = mask;
    this.selection.bounds = this.getMaskBounds(mask);
    this.selection.active = Boolean(this.selection.bounds);
    this.selection.mode = null;
    this.selection.start = null;
    this.selection.end = null;
    this.selection.lassoPoints = [];
    this.selectionContextMenu = null;
  }

  setSelectionMask(mask) {
    this.selection.mask = mask || null;
    this.selection.bounds = this.getMaskBounds(mask);
    this.selection.active = Boolean(this.selection.bounds);
    this.selection.mode = null;
    this.selection.baseMask = null;
    this.selection.start = null;
    this.selection.end = null;
    this.selection.lassoPoints = [];
    this.selectionContextMenu = null;
  }

  clearSelection() {
    this.selection.active = false;
    this.selection.mask = null;
    this.selection.bounds = null;
    this.selection.mode = null;
    this.selection.baseMask = null;
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
    if (!this.selection.active || !this.selection.mask) return;
    const size = this.canvasState.width * this.canvasState.height;
    const mask = new Uint8Array(this.selection.mask);
    for (let i = 0; i < size; i += 1) {
      mask[i] = mask[i] ? 0 : 1;
    }
    this.selection.mask = mask;
    this.selection.bounds = this.getMaskBounds(mask);
    this.selection.active = Boolean(this.selection.bounds);
  }

  expandSelection(delta) {
    if (!this.selection.active || !this.selection.mask) return;
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
    this.selection.active = Boolean(this.selection.bounds);
  }

  transformSelection(type) {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return;
    this.startHistory(`transform ${type}`);
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const bounds = this.selection.bounds;
    const pixels = this.extractSelectionPixels();
    const transformed = new Uint32Array(this.activeLayer.pixels);
    const nextMask = new Uint8Array(width * height);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const index = row * width + col;
        if (!this.selection.mask[index]) continue;
        const value = pixels[index];
        let targetRow = row;
        let targetCol = col;
        if (type === 'flip-h') targetCol = bounds.x + (bounds.w - 1 - (col - bounds.x));
        if (type === 'flip-v') targetRow = bounds.y + (bounds.h - 1 - (row - bounds.y));
        if (type === 'rotate-cw') {
          const localRow = row - bounds.y;
          const localCol = col - bounds.x;
          targetRow = bounds.y + localCol;
          targetCol = bounds.x + (bounds.h - 1 - localRow);
        }
        if (type === 'rotate-ccw') {
          const localRow = row - bounds.y;
          const localCol = col - bounds.x;
          targetRow = bounds.y + (bounds.w - 1 - localCol);
          targetCol = bounds.x + localRow;
        }
        if (targetRow < 0 || targetCol < 0 || targetRow >= height || targetCol >= width) continue;
        const targetIndex = targetRow * width + targetCol;
        if (value) transformed[targetIndex] = value;
        nextMask[targetIndex] = 1;
      }
    }
    this.activeLayer.pixels = transformed;
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
    this.selection.active = Boolean(this.selection.bounds);
    this.commitHistory();
  }

  scaleSelection(factor) {
    if (!this.selection.active || !this.selection.mask || !this.selection.bounds) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const bounds = this.selection.bounds;
    const pixels = this.extractSelectionPixels();
    const next = new Uint32Array(this.activeLayer.pixels);
    const nextMask = new Uint8Array(width * height);
    this.startHistory(`scale ${factor}x`);
    for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
      for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
        const srcIndex = row * width + col;
        if (!this.selection.mask[srcIndex]) continue;
        const value = pixels[srcIndex];
        for (let sy = 0; sy < factor; sy += 1) {
          for (let sx = 0; sx < factor; sx += 1) {
            const r = bounds.y + (row - bounds.y) * factor + sy;
            const c = bounds.x + (col - bounds.x) * factor + sx;
            if (r < 0 || c < 0 || r >= height || c >= width) continue;
            const destIndex = r * width + c;
            if (value) next[destIndex] = value;
            nextMask[destIndex] = 1;
          }
        }
      }
    }
    this.activeLayer.pixels = next;
    this.selection.mask = nextMask;
    this.selection.bounds = this.getMaskBounds(nextMask);
    this.selection.active = Boolean(this.selection.bounds);
    this.commitHistory();
  }

  handleCloneDown(point, modifiers = {}) {
    const touchInput = Boolean(modifiers.fromTouch);
    const shouldSetSource = Boolean(modifiers.altKey)
      || (touchInput && !this.clonePickTargetArmed && (this.clonePickSourceArmed || !this.cloneSource));
    if (shouldSetSource) {
      this.cloneSource = point;
      this.cloneOffset = null;
      this.cloneSourcePixels = null;
      this.cloneSourceSnapshot = this.activeLayer?.pixels
        ? {
          frameIndex: Number(this.animation?.currentFrameIndex || 0),
          layerIndex: Number(this.canvasState?.activeLayerIndex || 0),
          width: Number(this.canvasState?.width || 0),
          height: Number(this.canvasState?.height || 0),
          pixels: new Uint32Array(this.activeLayer.pixels)
        }
        : null;
      this.clonePickSourceArmed = false;
      this.clonePickTargetArmed = false;
      this.cloneColorPickArmed = false;
      const sourceFrame = Number(this.cloneSourceSnapshot?.frameIndex || 0) + 1;
      const sourceLayer = Number(this.cloneSourceSnapshot?.layerIndex || 0) + 1;
      this.statusMessage = touchInput
        ? `Clone source set F${sourceFrame} L${sourceLayer}. Tap destination.`
        : `Clone source set F${sourceFrame} L${sourceLayer}`;
      return;
    }
    if (this.clonePickTargetArmed) {
      if (!this.cloneSource) {
        this.clonePickTargetArmed = false;
        this.statusMessage = this.isMobileLayout()
          ? 'Tap Source, then tap canvas'
          : 'Set clone source first';
        return;
      }
      this.cloneOffset = { row: this.cloneSource.row - point.row, col: this.cloneSource.col - point.col };
      this.clonePickTargetArmed = false;
      this.cloneColorPickArmed = false;
      this.statusMessage = `Clone target set Δ ${this.cloneOffset.col >= 0 ? '+' : ''}${this.cloneOffset.col},${this.cloneOffset.row >= 0 ? '+' : ''}${this.cloneOffset.row}`;
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
    const sourcePoint = this.getCloneSamplePoint(point);
    const destWidth = this.canvasState.width;
    const sourcePixels = this.cloneSourcePixels || this.cloneSourceSnapshot?.pixels || this.activeLayer.pixels;
    const sourceWidth = Number(this.cloneSourceSnapshot?.width || this.canvasState.width);
    const sourceHeight = Number(this.cloneSourceSnapshot?.height || this.canvasState.height);
    if (sourcePoint.row < 0 || sourcePoint.col < 0 || sourcePoint.row >= sourceHeight || sourcePoint.col >= sourceWidth) return;
    const sourceIndex = sourcePoint.row * sourceWidth + sourcePoint.col;
    const destIndex = point.row * destWidth + point.col;
    if (this.selection.active && this.selection.mask && !this.selection.mask[destIndex]) return;
    const sourceValue = sourcePixels[sourceIndex];
    if ((this.toolOptions?.cloneAlphaMode || 'skip') === 'skip' && (sourceValue >>> 24) === 0) return;
    const nextValue = alpha >= 1
      ? sourceValue
      : this.blendPixel(this.activeLayer.pixels[destIndex], sourceValue, alpha);
    if (this.activeLayer.pixels[destIndex] === nextValue) return;
    this.activeLayer.pixels[destIndex] = nextValue;
    if (typeof this.markLayerPixelsDirty === 'function') this.markLayerPixelsDirty();
    else this.layerContentRevision = (this.layerContentRevision || 1) + 1;
  }

  getCloneSamplePoint(point) {
    const rotationDegrees = Number(this.toolOptions?.cloneRotationDegrees || 0);
    if (!Number.isFinite(rotationDegrees) || Math.abs(rotationDegrees) < 0.001) {
      return {
        row: point.row + this.cloneOffset.row,
        col: point.col + this.cloneOffset.col
      };
    }
    const center = this.strokeState?.cloneDestinationAnchor || this.strokeState?.brushCenter || point;
    const angle = -rotationDegrees * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.col - center.col;
    const dy = point.row - center.row;
    const rotatedCol = center.col + dx * cos - dy * sin;
    const rotatedRow = center.row + dx * sin + dy * cos;
    return {
      row: Math.round(rotatedRow + this.cloneOffset.row),
      col: Math.round(rotatedCol + this.cloneOffset.col)
    };
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

  getBrushProfileToolId(toolId = this.activeToolId) {
    return this.isBrushAdjustableTool(toolId)
      ? toolId
      : null;
  }

  isBrushAdjustableTool(toolId = this.activeToolId) {
    return [
      TOOL_IDS.PENCIL,
      TOOL_IDS.ERASER,
      TOOL_IDS.LINE,
      TOOL_IDS.CURVE,
      TOOL_IDS.POLYGON,
      TOOL_IDS.CLONE,
      TOOL_IDS.DITHER
    ].includes(toolId);
  }

  createDefaultBrushProfile() {
    return {
      brushSize: DEFAULT_BRUSH_SIZE,
      brushOpacity: 1,
      brushHardness: 1,
      brushShape: BRUSH_SHAPES[0],
      brushFalloff: 0
    };
  }

  isStaleMinimumBrushProfile(profile) {
    if (!profile) return true;
    return Math.round(profile.brushSize ?? BRUSH_SIZE_MIN) <= BRUSH_SIZE_MIN
      && clamp(profile.brushHardness ?? 0, 0, 1) <= 0
      && clamp(profile.brushOpacity ?? 1, 0.05, 1) === 1
      && (profile.brushShape || BRUSH_SHAPES[0]) === BRUSH_SHAPES[0]
      && clamp(profile.brushFalloff ?? 0, 0, 1) === 0;
  }

  refreshDefaultBrushProfiles({ onlyStale = false } = {}) {
    [
      TOOL_IDS.PENCIL,
      TOOL_IDS.ERASER,
      TOOL_IDS.LINE,
      TOOL_IDS.CURVE,
      TOOL_IDS.POLYGON,
      TOOL_IDS.CLONE,
      TOOL_IDS.DITHER
    ].forEach((toolId) => {
      if (onlyStale && !this.isStaleMinimumBrushProfile(this.brushProfiles?.[toolId])) return;
      this.brushProfiles[toolId] = this.createDefaultBrushProfile();
    });
    if (!onlyStale || this.isStaleMinimumBrushProfile(this.toolOptions)) {
      Object.assign(this.toolOptions, this.createDefaultBrushProfile());
    }
  }

  saveBrushProfile(toolId = this.activeToolId) {
    const profileId = this.getBrushProfileToolId(toolId);
    if (!profileId) return;
    this.brushProfiles[profileId] = {
      brushSize: this.toolOptions.brushSize,
      brushOpacity: this.toolOptions.brushOpacity,
      brushHardness: this.toolOptions.brushHardness,
      brushShape: this.toolOptions.brushShape,
      brushFalloff: this.toolOptions.brushFalloff
    };
  }

  loadBrushProfile(toolId = this.activeToolId) {
    const profileId = this.getBrushProfileToolId(toolId);
    if (!profileId) return;
    const profile = this.brushProfiles[profileId];
    if (!profile) return;
    this.toolOptions.brushSize = clamp(Math.round(profile.brushSize ?? DEFAULT_BRUSH_SIZE), BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
    this.toolOptions.brushOpacity = clamp(profile.brushOpacity ?? 1, 0.05, 1);
    this.toolOptions.brushHardness = clamp(profile.brushHardness ?? 1, 0, 1);
    this.toolOptions.brushShape = BRUSH_SHAPES.includes(profile.brushShape) ? profile.brushShape : BRUSH_SHAPES[0];
    const profileFalloff = typeof profile.brushFalloff === 'number'
      ? profile.brushFalloff
      : (profile.brushFalloff === 'soft' ? 0.65 : 0);
    this.toolOptions.brushFalloff = clamp(profileFalloff, 0, 1);
  }

  setBrushSize(size) {
    this.toolOptions.brushSize = clamp(Math.round(size), BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
    this.saveBrushProfile();
  }

  setBrushOpacity(opacity) {
    this.toolOptions.brushOpacity = clamp(opacity, 0.05, 1);
    this.saveBrushProfile();
  }

  setBrushHardness(hardness) {
    this.toolOptions.brushHardness = clamp(hardness, 0, 1);
    this.saveBrushProfile();
  }

  setBrushFalloff(falloff) {
    this.toolOptions.brushFalloff = clamp(falloff, 0, 1);
    this.saveBrushProfile();
  }

  setCloneRotationDegrees(degrees) {
    let value = Math.round(Number(degrees) || 0);
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    this.toolOptions.cloneRotationDegrees = value;
  }

  getCloneLineAngleDegrees(line) {
    if (!line?.start || !line?.end) return null;
    const dx = Number(line.end.col) - Number(line.start.col);
    const dy = Number(line.end.row) - Number(line.start.row);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    if (Math.hypot(dx, dy) < 0.001) return null;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  getCloneAngleDeltaDegrees(sourceLine, destinationLine) {
    const sourceAngle = this.getCloneLineAngleDegrees(sourceLine);
    const destinationAngle = this.getCloneLineAngleDegrees(destinationLine);
    if (sourceAngle == null || destinationAngle == null) return null;
    let value = destinationAngle - sourceAngle;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return Math.round(value);
  }

  startCloneAngleCalibration() {
    this.clonePickSourceArmed = false;
    this.cloneColorPickArmed = false;
    this.cloneSourcePixels = null;
    this.strokeState = null;
    this.cloneAngleCalibration = {
      phase: 'source',
      sourceLine: null,
      activeLine: null
    };
    this.statusMessage = 'Draw source angle';
  }

  armCloneSourcePick() {
    this.cancelCloneAngleCalibration();
    this.cloneSourcePixels = null;
    this.strokeState = null;
    this.clonePickSourceArmed = true;
    this.clonePickTargetArmed = false;
    this.cloneColorPickArmed = false;
    this.statusMessage = this.cloneSource
      ? 'Tap canvas to replace clone source'
      : 'Tap canvas to set clone source';
  }

  armCloneTargetPick() {
    this.cancelCloneAngleCalibration();
    this.strokeState = null;
    this.clonePickSourceArmed = false;
    this.clonePickTargetArmed = true;
    this.cloneColorPickArmed = false;
    this.statusMessage = this.cloneSource
      ? 'Tap canvas to set clone target'
      : 'Set clone source first';
  }

  cancelCloneAngleCalibration() {
    if (!this.cloneAngleCalibration) return;
    this.cloneAngleCalibration = null;
  }

  toggleCloneAngleCalibration() {
    if (this.cloneAngleCalibration) {
      this.cancelCloneAngleCalibration();
      this.statusMessage = 'Clone angle setup cancelled';
      return;
    }
    this.startCloneAngleCalibration();
  }

  resetCloneAlignment() {
    this.cancelCloneAngleCalibration();
    this.setCloneRotationDegrees(0);
    this.cloneOffset = null;
    this.cloneSourcePixels = null;
    this.clonePickSourceArmed = false;
    this.clonePickTargetArmed = false;
    this.statusMessage = this.cloneSource
      ? 'Clone alignment reset. Tap destination.'
      : 'Clone reset';
  }

  handleCloneAngleCalibrationDown(point) {
    if (this.activeToolId !== TOOL_IDS.CLONE || !this.cloneAngleCalibration) return false;
    const start = { row: point.row, col: point.col };
    this.cloneAngleCalibration.activeLine = {
      start,
      end: { ...start },
      latest: { ...start }
    };
    return true;
  }

  handleCloneAngleCalibrationMove(point) {
    if (this.activeToolId !== TOOL_IDS.CLONE || !this.cloneAngleCalibration?.activeLine) return false;
    const latest = { row: point.row, col: point.col };
    this.cloneAngleCalibration.activeLine.latest = latest;
    this.cloneAngleCalibration.activeLine.end = latest;
    return true;
  }

  handleCloneAngleCalibrationUp() {
    const calibration = this.cloneAngleCalibration;
    if (this.activeToolId !== TOOL_IDS.CLONE || !calibration) return false;
    const line = calibration.activeLine
      ? {
        start: calibration.activeLine.start,
        end: calibration.activeLine.latest || calibration.activeLine.end
      }
      : null;
    if (!line) return true;
    calibration.activeLine = null;
    if (this.getCloneLineAngleDegrees(line) == null) {
      this.statusMessage = calibration.phase === 'source'
        ? 'Draw a longer source angle'
        : 'Draw a longer destination angle';
      return true;
    }
    if (calibration.phase === 'source') {
      calibration.sourceLine = line;
      calibration.phase = 'destination';
      this.statusMessage = 'Draw destination angle';
      return true;
    }
    const degrees = this.getCloneAngleDeltaDegrees(calibration.sourceLine, line);
    if (degrees == null) {
      this.statusMessage = 'Draw a longer destination angle';
      return true;
    }
    this.setCloneRotationDegrees(degrees);
    this.cloneAngleCalibration = null;
    this.statusMessage = 'Clone angle set';
    return true;
  }

  setBrushSizeFromSlider(x, bounds) {
    if (!bounds || bounds.w <= 0) return;
    const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
    const value = BRUSH_SIZE_MIN + ratio * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
    this.setBrushSize(value);
  }

  setBrushSettingFromSlider(type, x, bounds) {
    if (!bounds || bounds.w <= 0) return;
    const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
    if (type === 'size') {
      this.setBrushSize(BRUSH_SIZE_MIN + ratio * (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN));
    } else if (type === 'opacity') {
      this.setBrushOpacity(0.05 + ratio * 0.95);
    } else if (type === 'hardness') {
      this.setBrushHardness(ratio);
    } else if (type === 'falloff') {
      this.setBrushFalloff(ratio);
    }
  }

  cycleBrushShape() {
    const index = BRUSH_SHAPES.indexOf(this.toolOptions.brushShape);
    this.toolOptions.brushShape = BRUSH_SHAPES[(index + 1 + BRUSH_SHAPES.length) % BRUSH_SHAPES.length];
    this.saveBrushProfile();
  }

  setPaletteIndex(index) {
    const maxIndex = Math.max(0, (this.currentPalette.colors?.length || 1) - 1);
    const nextIndex = clamp(index, 0, maxIndex);
    this.eraserColorActive = false;
    this.secondaryPaletteIndex = this.paletteIndex;
    this.paletteIndex = nextIndex;
    this.rememberPaletteIndex(nextIndex);
    if (Array.isArray(this.colorRegisters)) {
      this.colorRegisters[this.activeColorRegister] = nextIndex;
    }
    const shouldReturnToCanvas = !this.paletteGridOpen
      && !this.paletteColorPickerOpen
      && !(this.isMobileLayout() && this.mobileDrawer);
    if (shouldReturnToCanvas) {
      this.setInputMode('canvas');
    }
  }

  selectEraserColor() {
    this.eraserColorActive = true;
    const shouldReturnToCanvas = !this.paletteGridOpen
      && !this.paletteColorPickerOpen
      && !(this.isMobileLayout() && this.mobileDrawer);
    if (shouldReturnToCanvas) {
      this.setInputMode('canvas');
    }
  }

  rememberPaletteIndex(index) {
    const maxIndex = Math.max(0, (this.currentPalette.colors?.length || 1) - 1);
    const nextIndex = clamp(index, 0, maxIndex);
    const current = Array.isArray(this.recentPaletteIndices) ? this.recentPaletteIndices : [];
    this.recentPaletteIndices = [nextIndex, ...current.filter((entry) => entry !== nextIndex)]
      .filter((entry) => entry >= 0 && entry <= maxIndex)
      .slice(0, 4);
  }

  toggleActiveColorRegister() {
    if (!Array.isArray(this.colorRegisters) || this.colorRegisters.length < 2) return;
    this.activeColorRegister = this.activeColorRegister === 0 ? 1 : 0;
    const nextIndex = clamp(this.colorRegisters[this.activeColorRegister] ?? 0, 0, Math.max(0, (this.currentPalette.colors?.length || 1) - 1));
    this.eraserColorActive = false;
    this.paletteIndex = nextIndex;
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
    this.paletteColorDraft = { h: hsv.h, displayHue: hsv.h, s: hsv.s, v: hsv.v, r: rgba.r, g: rgba.g, b: rgba.b, quantization: this.paletteQuantization || 32 };
    this.syncPaletteDraftFromRgb();
    this.palettePickerDrag = null;
    this.paletteColorPickerOpen = true;
  }

  quantizeChannel(value, levels = 32) {
    return quantizePixelPaletteChannel(value, levels);
  }

  applyPaletteDraftQuantization() {
    if (!this.paletteColorDraft) return;
    const levels = this.paletteColorDraft.quantization || 32;
    const rgb = quantizePixelPaletteRgb(this.paletteColorDraft, levels);
    this.paletteColorDraft.r = rgb.r;
    this.paletteColorDraft.g = rgb.g;
    this.paletteColorDraft.b = rgb.b;
  }

  getPaletteDraftDisplayHue() {
    if (!this.paletteColorDraft) return 0;
    const hue = Number.isFinite(this.paletteColorDraft.displayHue)
      ? this.paletteColorDraft.displayHue
      : this.paletteColorDraft.h;
    return ((Number(hue) || 0) % 360 + 360) % 360;
  }

  setPaletteDraftDisplayHue(hue) {
    if (!this.paletteColorDraft) return;
    const next = ((Number(hue) || 0) % 360 + 360) % 360;
    this.paletteColorDraft.displayHue = next;
    this.paletteColorDraft.h = next;
  }

  syncPaletteDraftFromHsv() {
    if (!this.paletteColorDraft) return;
    const hue = this.getPaletteDraftDisplayHue();
    const rgb = this.hsvToRgb(hue, this.paletteColorDraft.s, this.paletteColorDraft.v);
    this.paletteColorDraft.r = rgb.r;
    this.paletteColorDraft.g = rgb.g;
    this.paletteColorDraft.b = rgb.b;
    this.syncPaletteDraftFromRgb({ neutralHue: hue });
  }

  syncPaletteDraftFromRgb({ neutralHue = null } = {}) {
    if (!this.paletteColorDraft) return;
    const previousHue = neutralHue ?? this.getPaletteDraftDisplayHue();
    this.applyPaletteDraftQuantization();
    const hsv = this.rgbToHsv(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b);
    const nextHue = hsv.s > 0.0001 ? hsv.h : previousHue;
    this.paletteColorDraft.h = nextHue;
    this.paletteColorDraft.displayHue = nextHue;
    this.paletteColorDraft.s = hsv.s;
    this.paletteColorDraft.v = hsv.v;
  }

  setPaletteDraftFromQuantizedHsv(h, s, v) {
    if (!this.paletteColorDraft) return;
    const levels = this.paletteColorDraft.quantization || 32;
    const sample = getPixelQuantizedSvSampleAt(h, s, 1 - v, levels);
    this.setPaletteDraftDisplayHue(h);
    this.paletteColorDraft.r = sample.rgb.r;
    this.paletteColorDraft.g = sample.rgb.g;
    this.paletteColorDraft.b = sample.rgb.b;
    this.syncPaletteDraftFromRgb({ neutralHue: h });
  }

  setPaletteDraftFromSvPointer(pointerX, pointerY, bounds) {
    if (!this.paletteColorDraft || !bounds) return;
    const xRatio = clamp((pointerX - bounds.x) / Math.max(1, bounds.w), 0, 1);
    const yRatio = clamp((pointerY - bounds.y) / Math.max(1, bounds.h), 0, 1);
    const levels = this.paletteColorDraft.quantization || 32;
    const hue = this.getPaletteDraftDisplayHue();
    const sample = getPixelQuantizedSvSampleAt(hue, xRatio, yRatio, levels);
    this.paletteColorDraft.r = sample.rgb.r;
    this.paletteColorDraft.g = sample.rgb.g;
    this.paletteColorDraft.b = sample.rgb.b;
    this.syncPaletteDraftFromRgb({ neutralHue: hue });
  }

  setPaletteDraftFromHuePointer(pointerY, bounds) {
    if (!this.paletteColorDraft || !bounds) return;
    const ratio = clamp((pointerY - bounds.y) / Math.max(1, bounds.h), 0, 1);
    const levels = this.paletteColorDraft.quantization || 32;
    const sample = getPixelQuantizedHueSampleAt(ratio, levels);
    this.setPaletteDraftFromQuantizedHsv(sample.h, this.paletteColorDraft.s, this.paletteColorDraft.v);
  }

  updatePaletteSliderFromX(type, pointerX, bounds) {
    if (!this.paletteColorDraft || !bounds) return;
    const t = clamp((pointerX - bounds.x) / Math.max(1, bounds.w), 0, 1);
    if (type === 'h') {
      const sample = getPixelQuantizedHueSampleAt(t, this.paletteColorDraft.quantization || 32);
      this.setPaletteDraftFromQuantizedHsv(sample.h, this.paletteColorDraft.s, this.paletteColorDraft.v);
      return;
    }
    if (type === 's') {
      this.setPaletteDraftFromQuantizedHsv(this.getPaletteDraftDisplayHue(), t, this.paletteColorDraft.v);
      return;
    }
    if (type === 'v') {
      this.setPaletteDraftFromQuantizedHsv(this.getPaletteDraftDisplayHue(), this.paletteColorDraft.s, t);
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
      h: { label: 'Hue (0-360)', min: 0, max: 360, value: this.getPaletteDraftDisplayHue(), kind: 'hsv' },
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
    if (type === 'h') this.setPaletteDraftDisplayHue(next);
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
    this.applyPaletteDraftQuantization();
    const hex = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b);
    this.currentPalette.colors.push({
      id: `color-${Date.now()}`,
      hex,
      rgba: { ...hexToRgba(hex), a: 255 }
    });
    this.paletteIndex = this.currentPalette.colors.length - 1;
    this.rememberPaletteIndex(this.paletteIndex);
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
    this.stopAnimationPreview();
    const layer = createLayer(this.canvasState.width, this.canvasState.height, `Layer ${this.canvasState.layers.length + 1}`);
    this.canvasState.layers.push(layer);
    this.canvasState.activeLayerIndex = this.canvasState.layers.length - 1;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  deleteLayer(index) {
    this.stopAnimationPreview();
    if (this.canvasState.layers.length <= 1) return;
    this.canvasState.layers.splice(index, 1);
    this.canvasState.activeLayerIndex = clamp(this.canvasState.activeLayerIndex, 0, this.canvasState.layers.length - 1);
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  duplicateLayer(index) {
    this.stopAnimationPreview();
    const layer = cloneLayer(this.canvasState.layers[index]);
    layer.name = `${layer.name} Copy`;
    this.canvasState.layers.splice(index + 1, 0, layer);
    this.canvasState.activeLayerIndex = index + 1;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  mergeLayerDown(index) {
    this.stopAnimationPreview();
    this.canvasState.layers = mergeDown(this.canvasState.layers, index);
    this.canvasState.activeLayerIndex = clamp(index - 1, 0, this.canvasState.layers.length - 1);
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  mergeLayerUp(index) {
    this.stopAnimationPreview();
    this.canvasState.layers = mergeUp(this.canvasState.layers, index);
    this.canvasState.activeLayerIndex = clamp(index, 0, this.canvasState.layers.length - 1);
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  flattenAllLayers() {
    this.stopAnimationPreview();
    this.canvasState.layers = flattenLayers(this.canvasState.layers, this.canvasState.width, this.canvasState.height);
    this.canvasState.activeLayerIndex = 0;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  reorderLayer(from, to) {
    this.stopAnimationPreview();
    this.canvasState.layers = reorderLayer(this.canvasState.layers, from, to);
    this.canvasState.activeLayerIndex = to;
    this.currentFrame.layers = this.canvasState.layers;
    this.syncTileData();
  }

  moveLayerBy(delta) {
    const from = this.canvasState.activeLayerIndex;
    const to = clamp(from + delta, 0, this.canvasState.layers.length - 1);
    if (to === from) return;
    this.reorderLayer(from, to);
  }

  async renameLayer(index) {
    const layer = this.canvasState.layers[index];
    if (!layer) return;
    const raw = await openTextInputOverlay({
      title: 'Rename Layer',
      label: 'Layer name:',
      initialValue: layer.name || `Layer ${index + 1}`,
      inputType: 'text'
    });
    if (raw == null) return;
    const name = raw.trim();
    if (!name) return;
    layer.name = name;
    this.syncTileData();
  }

  addFrame() {
    this.stopAnimationPreview();
    this.startHistory('add frame', { includeFrames: true });
    const newFrame = createFrame(this.canvasState.layers, this.currentFrame?.durationMs || DEFAULT_FRAME_DURATION_MS);
    this.animation.frames.push(newFrame);
    this.animation.currentFrameIndex = this.animation.frames.length - 1;
    this.setFrameLayers(newFrame.layers);
    this.commitHistory();
    this.syncTileData();
  }

  duplicateFrame(index) {
    this.stopAnimationPreview();
    this.startHistory('duplicate frame', { includeFrames: true });
    const clone = cloneFrame(this.animation.frames[index]);
    this.animation.frames.splice(index + 1, 0, clone);
    this.animation.currentFrameIndex = index + 1;
    this.setFrameLayers(clone.layers);
    this.commitHistory();
    this.syncTileData();
  }

  deleteFrame(index) {
    this.stopAnimationPreview();
    if (this.animation.frames.length <= 1) return;
    this.startHistory('delete frame', { includeFrames: true });
    this.animation.frames.splice(index, 1);
    this.animation.currentFrameIndex = clamp(this.animation.currentFrameIndex, 0, this.animation.frames.length - 1);
    this.setFrameLayers(this.animation.frames[this.animation.currentFrameIndex].layers);
    this.commitHistory();
    this.syncTileData();
  }

  moveFrameBy(delta) {
    const from = this.animation.currentFrameIndex;
    const to = clamp(from + delta, 0, this.animation.frames.length - 1);
    if (to === from) return;
    this.reorderFrame(from, to);
  }

  reorderFrame(from, to) {
    this.stopAnimationPreview();
    const safeFrom = clamp(Math.round(Number(from) || 0), 0, this.animation.frames.length - 1);
    const safeTo = clamp(Math.round(Number(to) || 0), 0, this.animation.frames.length - 1);
    if (safeFrom === safeTo) return;
    this.startHistory('reorder frame', { includeFrames: true });
    const frame = this.animation.frames.splice(safeFrom, 1)[0];
    this.animation.frames.splice(safeTo, 0, frame);
    this.animation.currentFrameIndex = safeTo;
    this.setFrameLayers(this.currentFrame.layers);
    this.commitHistory();
    this.syncTileData();
  }

  stopAnimationPreview() {
    this.animation.playing = false;
    this.animation.previewElapsed = 0;
  }

  async setCurrentFrameDelayMs() {
    const frame = this.currentFrame;
    if (!frame) return;
    const currentDelayMs = Math.max(20, Math.round(Number(frame.durationMs || DEFAULT_FRAME_DURATION_MS)));
    const raw = await openTextInputOverlay({
      title: 'Frame Delay',
      label: 'Delay (ms):',
      initialValue: String(currentDelayMs),
      inputType: 'int',
      min: 20,
      max: 10000
    });
    if (raw == null) return;
    const delayMs = clamp(Math.round(Number(raw.trim()) || DEFAULT_FRAME_DURATION_MS), 20, 10000);
    frame.durationMs = delayMs;
    this.animation.previewElapsed = 0;
    this.syncTileData();
  }

  async setCurrentFrameDelayFps() {
    return this.setCurrentFrameDelayMs();
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
    try {
      const blob = exportAnimatedGif(
        this.animation.frames,
        this.canvasState.width,
        this.canvasState.height
      );
      this.downloadDataUrl(URL.createObjectURL(blob), `${this.activeTile?.id || 'pixel-art'}.gif`);
    } catch (error) {
      console.warn('[PixelStudio] Failed to export GIF.', error);
    }
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

  setPaletteFromCurrentImage(maxColors = 24) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    let composite = compositeLayers(this.canvasState.layers, width, height);
    if (this.activeToolId === TOOL_IDS.HUE_SHIFT && !this.isHueShiftNeutral()) {
      composite = this.buildHueShiftPreview(composite);
    }
    const bins = new Map();
    for (let i = 0; i < composite.length; i += 1) {
      const rgba = uint32ToRgba(composite[i] || 0);
      if (rgba.a < 16) continue;
      const key = `${rgba.r >> 3},${rgba.g >> 3},${rgba.b >> 3}`;
      let entry = bins.get(key);
      if (!entry) {
        entry = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
        bins.set(key, entry);
      }
      entry.count += 1;
      entry.sumR += rgba.r;
      entry.sumG += rgba.g;
      entry.sumB += rgba.b;
    }
    const candidates = Array.from(bins.values()).map((entry) => {
      const r = Math.round(entry.sumR / Math.max(1, entry.count));
      const g = Math.round(entry.sumG / Math.max(1, entry.count));
      const b = Math.round(entry.sumB / Math.max(1, entry.count));
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sat = max <= 0 ? 0 : delta / max;
      let hue = 0;
      if (delta > 0) {
        if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        else if (max === g) hue = ((b - r) / delta + 2) / 6;
        else hue = ((r - g) / delta + 4) / 6;
      }
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { r, g, b, sat, hue, luminance, count: entry.count };
    }).sort((a, b) => b.count - a.count);
    if (!candidates.length) return;
    const selected = [];
    const addDistinct = (candidate) => {
      if (!candidate) return;
      const tooClose = selected.some((entry) => {
        const dist = Math.hypot(entry.r - candidate.r, entry.g - candidate.g, entry.b - candidate.b);
        return dist < 18;
      });
      if (!tooClose) selected.push(candidate);
    };
    addDistinct(candidates.find((entry) => entry.luminance < 50));
    addDistinct(candidates.find((entry) => entry.luminance > 210));
    addDistinct(candidates.find((entry) => entry.sat < 0.15 && entry.luminance >= 70 && entry.luminance <= 180));
    for (let sector = 0; sector < 8; sector += 1) {
      const start = sector / 8;
      const end = (sector + 1) / 8;
      addDistinct(candidates.find((entry) => entry.sat >= 0.18 && entry.hue >= start && entry.hue < end));
    }
    while (selected.length < maxColors && selected.length < candidates.length) {
      let best = null;
      let bestScore = -1;
      candidates.forEach((candidate) => {
        if (selected.includes(candidate)) return;
        const minDist = selected.length
          ? Math.min(...selected.map((entry) => Math.hypot(entry.r - candidate.r, entry.g - candidate.g, entry.b - candidate.b)))
          : 255;
        const score = minDist * 0.75 + Math.log2(candidate.count + 1) * 10;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      });
      if (!best) break;
      selected.push(best);
    }
    const colors = selected
      .slice(0, maxColors)
      .map((entry) => `#${[entry.r, entry.g, entry.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    if (!colors.length) return;
    this.currentPalette = buildPalette(colors, `${this.currentPalette.name || 'Palette'} Image`);
    this.paletteIndex = 0;
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

  isPointNearCanvas(point, padding = 40) {
    if (!this.canvasBounds) return false;
    return this.isPointInBounds(point, {
      x: this.canvasBounds.x - padding,
      y: this.canvasBounds.y - padding,
      w: this.canvasBounds.w + padding * 2,
      h: this.canvasBounds.h + padding * 2
    });
  }

  getGridCellFromScreen(x, y, options = {}) {
    if (!this.canvasBounds) return null;
    const { clampToCanvas = false } = options;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    let col = Math.floor((x - startX) / cellSize);
    let row = Math.floor((y - startY) / cellSize);
    if (this.toolOptions.wrapDraw) {
      col = ((col % this.canvasState.width) + this.canvasState.width) % this.canvasState.width;
      row = ((row % this.canvasState.height) + this.canvasState.height) % this.canvasState.height;
      return { row, col };
    }
    if (clampToCanvas) {
      return {
        row: clamp(row, 0, this.canvasState.height - 1),
        col: clamp(col, 0, this.canvasState.width - 1)
      };
    }
    if (col < 0 || row < 0 || col >= this.canvasState.width || row >= this.canvasState.height) return null;
    return { row, col };
  }

  getGridCellFromScreenUnbounded(x, y) {
    if (!this.canvasBounds) return null;
    const { mainX, mainY, x: startX, y: startY, cellSize } = this.canvasBounds;
    const originX = Number.isFinite(mainX) ? mainX : startX;
    const originY = Number.isFinite(mainY) ? mainY : startY;
    const col = Math.floor((x - originX) / cellSize);
    const row = Math.floor((y - originY) / cellSize);
    return {
      row: clamp(row, -this.canvasState.height * 2, this.canvasState.height * 3),
      col: clamp(col, -this.canvasState.width * 2, this.canvasState.width * 3)
    };
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
    if (this.pasteImportModal) {
      const bounds = this.pasteImportModal.bounds;
      if (bounds && !this.isPointInBounds({ x, y }, bounds)) {
        this.pasteImportModal = null;
        return true;
      }
      const hit = (this.pasteImportModal.buttons || []).find((entry) => this.isPointInBounds({ x, y }, entry.bounds));
      if (hit) {
        hit.onClick?.();
      }
      return true;
    }
    if (this.transformModal) {
      if (this.transformModal.bounds && !this.isPointInBounds({ x, y }, this.transformModal.bounds)) {
        this.closeTransformModal();
        return true;
      }
      const sliderHit = (this.transformModal.fields || []).find((field) => this.isPointInBounds({ x, y }, field.sliderHitBounds || field.slider));
      if (sliderHit) {
        const ratio = clamp((x - sliderHit.slider.x) / Math.max(1, sliderHit.slider.w), 0, 1);
        const next = (sliderHit.key === 'scaleX' || sliderHit.key === 'scaleY')
          ? this.transformSliderTToScaleValue(ratio)
          : sliderHit.min + ratio * (sliderHit.max - sliderHit.min);
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
      if (hit.onHold) {
        this.startTransportHold(hit, payload);
        return true;
      }
      hit.onClick?.({ x, y, id: payload.id });
      if (hit.onDrag) {
        this.uiSliderDrag = { id: payload.id ?? null, onDrag: hit.onDrag };
        hit.onDrag({ x, y, id: payload.id });
      }
      return true;
    }
    if (this.brushPickerOpen && this.brushPickerBounds && !this.isPointInBounds({ x, y }, this.brushPickerBounds)) {
      this.closeBrushPicker({ apply: true });
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
      if (typeof paletteHit.action === 'function') {
        paletteHit.action();
      } else if (this.paletteGridOpen && this.paletteRemoveMode) {
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
    const mobileLandscape = isMobileLandscapeLayout({ isMobile, viewportWidth: width, viewportHeight: height });
    const topBarHeight = 0;
    const statusHeight = 20;
    const paletteHeight = isMobile && !mobileLandscape ? 64 : 0;
    const toolbarHeight = isMobile && !mobileLandscape ? 72 : 0;
    const mobileZoomReserve = isMobile && !mobileLandscape ? 44 : 0;
    const timelineHeight = !isMobile && this.modeTab === 'animate' ? 120 : 0;
    const bottomHeight = menuFullScreen
      ? padding * 2
      : statusHeight + paletteHeight + timelineHeight + toolbarHeight + mobileZoomReserve + padding;
    const leftFrame = !isMobile && this.sidebars.left && !menuFullScreen
      ? buildSharedDesktopLeftPanelFrame({ viewportWidth: width, viewportHeight: height })
      : null;
    const mobileLayout = isMobile
      ? buildPixelMobileEditorLayout(width, height, {
        drawerOpen: Boolean(this.mobileDrawer && this.mobileDrawer !== 'timeline'),
        menuSheetOpen: Boolean(this.mobileDrawer === 'panel' || this.controllerMenu.active)
      })
      : null;
    const mobileLandscapeLayout = mobileLayout?.orientation === 'landscape' ? mobileLayout : null;
    const leftWidth = isMobile
      ? (mobileLandscapeLayout?.leftRail.w ?? getSharedMobileRailWidth(width, height))
      : (leftFrame ? leftFrame.panelW : (this.sidebars.left ? SHARED_EDITOR_LEFT_MENU.width() : 0));
    const rightWidth = (!isMobile && ['layers', 'animation'].includes(this.leftPanelTab)) ? 220 : 0;
    const mobileDrawerReserveW = isMobile && this.mobileDrawer && this.mobileDrawer !== 'timeline'
      ? getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 })
      : 0;

    this.uiButtons = [];
    this.boneUiRegions = [];
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

    if (this.tilePickerMode) {
      this.drawTilePickerScreen(ctx, width, height);
      this.drawFocusHighlight(ctx);
      ctx.restore();
      return;
    }

    if (isMobilePortraitLayout({ isMobile, viewportWidth: width, viewportHeight: height })) {
      this.drawMobilePortraitLayout(ctx, width, height);
      if (this.selectionContextMenu) this.drawSelectionContextMenu(ctx, width, height);
      if (this.quickWheel?.active) this.drawQuickWheel(ctx, width, height);
      if (this.transformModal) this.drawTransformModal(ctx, width, height);
      if (this.pasteImportModal) this.drawPasteImportModal(ctx, width, height);
      if (this.controlsOverlayOpen) this.drawControlsOverlay(ctx, width, height);
      drawCanvasControllerMenu(ctx, this.controllerMenu, {
        width,
        height,
        contextLabel: this.inputMode === 'ui' ? 'Pixel Chrome' : 'Pixel Canvas'
      });
      this.finalizeFocusGroups();
      this.drawFocusHighlight(ctx);
      ctx.restore();
      return;
    }

    const canvasX = mobileLandscapeLayout?.workSurface.x ?? (leftFrame ? leftFrame.contentX : (padding + leftWidth));
    const canvasY = mobileLandscapeLayout?.workSurface.y ?? (topBarHeight + padding);
    const canvasW = mobileLandscapeLayout?.workSurface.w ?? (leftFrame ? (leftFrame.contentW - rightWidth - (rightWidth > 0 ? 8 : 0)) : (width - leftWidth - rightWidth - padding * 2));
    const canvasH = mobileLandscapeLayout?.workSurface.h ?? (height - canvasY - bottomHeight);

    if (isMobile) {
      const rail = mobileLandscapeLayout?.leftRail ?? { x: 0, y: 0, w: leftWidth, h: height };
      this.drawMobileRail(ctx, rail.x, rail.y, rail.w, rail.h);
    } else if (this.sidebars.left) {
      this.drawLeftPanel(ctx, leftFrame.panelX, leftFrame.panelY, leftFrame.panelW, leftFrame.panelH, { isMobile: false });
    }

    if (!menuFullScreen && !isMobile && rightWidth > 0) {
      const rightX = canvasX + canvasW + 8;
      this.drawRightRail(ctx, rightX, canvasY, rightWidth, canvasH);
    }

    if (!menuFullScreen) {
      ctx.fillStyle = UI_SUITE.colors.panelAlt;
      ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);

      this.drawCanvasArea(ctx, canvasX, canvasY, canvasW, canvasH);
      if (!isMobile) {
        const activeLayer = this.canvasState.layers[this.canvasState.activeLayerIndex];
        ctx.fillStyle = '#4fc3ff';
        ctx.font = 'bold 14px Courier New';
        ctx.fillText(`Frame ${this.animation.currentFrameIndex + 1}`, padding + 10, padding + 16);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '12px Courier New';
        ctx.fillText(`Layer ${this.canvasState.activeLayerIndex + 1}: ${activeLayer?.name || 'Layer'}`, padding + 10, padding + 32);
      }
    } else {
      this.canvasBounds = null;
    }

    const paletteY = height - bottomHeight + padding;
    if (!menuFullScreen && paletteHeight > 0) {
      const paletteX = isMobile ? canvasX : padding;
      const paletteW = isMobile
        ? Math.max(120, width - paletteX - padding - mobileDrawerReserveW)
        : (width - padding * 2);
      if (['layers', 'animation'].includes(this.leftPanelTab)) {
        this.drawManagementActionRail(ctx, paletteX, paletteY, paletteW, paletteHeight, { isMobile });
      } else {
        this.drawPaletteBar(ctx, paletteX, paletteY, paletteW, paletteHeight, { isMobile });
      }
    }
    const statusY = paletteY + (paletteHeight > 0 ? paletteHeight + 6 : 0);
    if (!menuFullScreen && !isMobile) {
      this.drawStatusBar(ctx, padding, statusY, width - padding * 2, statusHeight, { isMobile });
    }

    if (!menuFullScreen && !isMobile && this.modeTab === 'animate') {
      const timelineY = statusY + statusHeight + 6;
      this.drawTimeline(ctx, canvasX, timelineY, canvasW, timelineHeight);
    }

    if (isMobile) {
      this.drawMobilePanZoomControls(ctx, width, height);
      if (this.mobileDrawer && this.mobileDrawer !== 'timeline') {
        const drawerW = mobileLandscapeLayout?.rightRail.w ?? getSharedMobileDrawerWidth(width, height, leftWidth, { edgePadding: 0 });
        const drawerX = mobileLandscapeLayout?.rightRail.x ?? (width - drawerW);
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
    if (this.pasteImportModal) {
      this.drawPasteImportModal(ctx, width, height);
    }

    if (this.controlsOverlayOpen) {
      this.drawControlsOverlay(ctx, width, height);
    }

    if (this.gamepadHintVisible && !isMobile) {
      this.drawGamepadHints(ctx, width - padding - 20, height - bottomHeight - 90);
    }

    drawCanvasControllerMenu(ctx, this.controllerMenu, {
      width,
      height,
      contextLabel: this.inputMode === 'ui' ? 'Pixel Chrome' : 'Pixel Canvas'
    });

    this.finalizeFocusGroups();
    this.drawFocusHighlight(ctx);

    ctx.restore();
  }

  drawButton(ctx, bounds, label, active = false, options = {}) {
    const controlBounds = normalizeSharedControlBounds(bounds);
    Object.assign(bounds, controlBounds);
    const fontSize = options.fontSize || 12;
    const color = drawSharedMenuButtonChrome(ctx, controlBounds, { active, subtle: Boolean(options.disabled) });
    drawSharedMenuButtonLabel(ctx, bounds, label, {
      fontSize,
      color: options.disabled ? UI_SUITE.colors.muted : color,
      y: controlBounds.y + controlBounds.h / 2 + 1
    });
    if (options.focused) {
      drawSharedFocusRing(ctx, controlBounds);
    }
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
    const modalTarget = this.transformModal.scope === 'selection' ? 'Selection' : 'Canvas';
    ctx.fillText(`${title} ${modalTarget}`, modal.x + 12, modal.y + 22);

    const rowsByType = {
      resize: [
        { key: 'width', label: 'Width', min: ART_DIMENSION_MIN, max: ART_DIMENSION_MAX },
        { key: 'height', label: 'Height', min: ART_DIMENSION_MIN, max: ART_DIMENSION_MAX }
      ],
      scale: [
        { key: 'scaleX', label: 'Scale X', min: 0.1, max: 10 },
        { key: 'scaleY', label: 'Scale Y', min: 0.1, max: 10 }
      ],
      crop: [
        { key: 'borderX', label: 'Border X', min: 0, max: Math.max(0, Math.floor((this.canvasState.width - 1) / 2)) },
        { key: 'borderY', label: 'Border Y', min: 0, max: Math.max(0, Math.floor((this.canvasState.height - 1) / 2)) }
      ],
      offset: [
        { key: 'dx', label: 'Shift X', min: -this.canvasState.width, max: this.canvasState.width },
        { key: 'dy', label: 'Shift Y', min: -this.canvasState.height, max: this.canvasState.height }
      ],
      rotate: [
        { key: 'angle', label: 'Angle', min: -360, max: 360 }
      ],
      stretch: [
        { key: 'stretchX', label: 'Stretch X %', min: 1, max: 500 },
        { key: 'stretchY', label: 'Stretch Y %', min: 1, max: 500 }
      ],
      skew: [
        { key: 'skewX', label: 'Skew X °', min: -89, max: 89 },
        { key: 'skewY', label: 'Skew Y °', min: -89, max: 89 }
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
      const t = (row.key === 'scaleX' || row.key === 'scaleY')
        ? this.transformScaleValueToSliderT(value)
        : clamp((value - row.min) / Math.max(1, row.max - row.min), 0, 1);
      const knobX = slider.x + t * slider.w;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Courier New';
      ctx.fillText(row.label, modal.x + 12, rowY);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(slider.x, slider.y, slider.w, slider.h);
      if (row.key === 'scaleX' || row.key === 'scaleY') {
        const centerT = clamp((1 - row.min) / Math.max(0.00001, row.max - row.min), 0, 1);
        const centerX = slider.x + centerT * slider.w;
        ctx.strokeStyle = 'rgba(160,220,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(centerX, slider.y - 3);
        ctx.lineTo(centerX, slider.y + slider.h + 3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText('0.1', slider.x, slider.y - 5);
        ctx.textAlign = 'center';
        ctx.fillText('1', centerX, slider.y - 5);
        ctx.textAlign = 'right';
        ctx.fillText('10', slider.x + slider.w, slider.y - 5);
      }
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(knobX - 2, slider.y - 2, 4, slider.h + 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(valueBounds.x, valueBounds.y, valueBounds.w, valueBounds.h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      const displayValue = (row.key === 'scaleX' || row.key === 'scaleY')
        ? Number(value).toFixed(1)
        : String(Math.round(value));
      ctx.fillText(displayValue, valueBounds.x + valueBounds.w - 6, rowY + 1);
      ctx.textAlign = 'left';
      this.transformModal.fields.push({ ...row, slider, sliderHitBounds, valueBounds });
      rowY += 38;
    });

    if (this.transformModal.type === 'flip') {
      const axis = this.transformModal.values.axis === 'vertical' ? 'vertical' : 'horizontal';
      const flipHB = { x: modal.x + 12, y: rowY - 12, w: 140, h: 22 };
      const flipVB = { x: modal.x + 158, y: rowY - 12, w: 140, h: 22 };
      this.drawButton(ctx, flipHB, 'Flip Horizontal', axis === 'horizontal', { fontSize: 12 });
      this.drawButton(ctx, flipVB, 'Flip Vertical', axis === 'vertical', { fontSize: 12 });
      this.uiButtons.push({ bounds: flipHB, onClick: () => { this.transformModal.values.axis = 'horizontal'; } });
      this.uiButtons.push({ bounds: flipVB, onClick: () => { this.transformModal.values.axis = 'vertical'; } });
      this.registerFocusable('menu', flipHB, () => { this.transformModal.values.axis = 'horizontal'; });
      this.registerFocusable('menu', flipVB, () => { this.transformModal.values.axis = 'vertical'; });
      rowY += 32;
    }

    if (this.transformModal.type === 'rotate') {
      const presets = [90, 180, 270];
      presets.forEach((angle, index) => {
        const b = { x: modal.x + 12 + index * 74, y: rowY - 12, w: 68, h: 22 };
        const active = Math.round(this.transformModal.values.angle || 0) === angle;
        this.drawButton(ctx, b, String(angle), active, { fontSize: 12 });
        this.uiButtons.push({ bounds: b, onClick: () => { this.transformModal.values.angle = angle; } });
        this.registerFocusable('menu', b, () => { this.transformModal.values.angle = angle; });
      });
      rowY += 32;
    }

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
    this.drawButton(ctx, okBounds, this.transformModal.scope === 'selection' ? 'OK' : 'Apply', true, { fontSize: 12 });
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

  drawPasteImportModal(ctx, width, height) {
    if (!this.pasteImportModal?.source) return;
    const modalW = Math.min(860, Math.max(560, width * 0.78));
    const modalH = Math.min(560, Math.max(360, height * 0.74));
    const modal = {
      x: Math.floor((width - modalW) / 2),
      y: Math.floor((height - modalH) / 2),
      w: Math.floor(modalW),
      h: Math.floor(modalH)
    };
    this.pasteImportModal.bounds = modal;
    this.pasteImportModal.buttons = [];
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,16,24,0.96)';
    ctx.fillRect(modal.x, modal.y, modal.w, modal.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(modal.x, modal.y, modal.w, modal.h);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('Paste Import Options', modal.x + 16, modal.y + 24);

    const sourceBase = this.pasteImportModal.crop
      ? this.cropClipboardToOpaqueBounds(this.pasteImportModal.source)
      : this.pasteImportModal.source;
    const previewTop = modal.y + 46;
    const previewW = Math.floor((modal.w - 48) / 2);
    const previewH = modal.h - 156;
    const leftPreview = { x: modal.x + 16, y: previewTop, w: previewW, h: previewH };
    const rightPreview = { x: modal.x + 32 + previewW, y: previewTop, w: previewW, h: previewH };
    this.drawPastePreviewCard(ctx, leftPreview, 'Scale to Canvas', this.scaleClipboardToFit(sourceBase, this.canvasState.width, this.canvasState.height), this.pasteImportModal.mode === 'scale');
    this.drawPastePreviewCard(ctx, rightPreview, 'Resize Canvas', sourceBase, this.pasteImportModal.mode === 'resize');

    const cropBounds = { x: modal.x + 16, y: modal.y + modal.h - 94, w: 170, h: 28 };
    this.drawButton(ctx, cropBounds, this.pasteImportModal.crop ? '☑ Crop' : '☐ Crop', this.pasteImportModal.crop, { fontSize: 12 });
    this.pasteImportModal.buttons.push({
      bounds: cropBounds,
      onClick: () => { this.pasteImportModal.crop = !this.pasteImportModal.crop; }
    });
    const cancelBounds = { x: modal.x + modal.w - 206, y: modal.y + modal.h - 94, w: 90, h: 28 };
    const importBounds = { x: modal.x + modal.w - 108, y: modal.y + modal.h - 94, w: 90, h: 28 };
    this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
    this.drawButton(ctx, importBounds, 'Import', true, { fontSize: 12 });
    this.pasteImportModal.buttons.push({ bounds: cancelBounds, onClick: () => { this.pasteImportModal = null; } });
    this.pasteImportModal.buttons.push({
      bounds: importBounds,
      onClick: () => {
        const working = this.pasteImportModal.crop
          ? this.cropClipboardToOpaqueBounds(this.pasteImportModal.source)
          : this.pasteImportModal.source;
        const pasteOptions = { pasteToNewLayer: this.pasteImportModal.pasteToNewLayer === true };
        const mode = this.pasteImportModal.mode;
        this.pasteImportModal = null;
        if (mode === 'resize') {
          this.resizeArtCanvas(working.width, working.height);
          this.applyClipboardPaste(working, pasteOptions);
        } else {
          this.applyClipboardPaste(
            this.scaleClipboardToFit(working, this.canvasState.width, this.canvasState.height),
            pasteOptions
          );
        }
      }
    });
  }

  drawPastePreviewCard(ctx, bounds, label, clipboard, active = false) {
    if (!clipboard?.pixels) return;
    ctx.fillStyle = active ? 'rgba(255,225,106,0.2)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = active ? 'rgba(255,225,106,0.9)' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    const titleBounds = { x: bounds.x + 8, y: bounds.y + 8, w: bounds.w - 16, h: 24 };
    this.drawButton(ctx, titleBounds, label, active, { fontSize: 11 });
    this.pasteImportModal.buttons.push({
      bounds,
      onClick: () => { this.pasteImportModal.mode = label.startsWith('Scale') ? 'scale' : 'resize'; }
    });
    const pxW = Number(clipboard?.width || 1);
    const pxH = Number(clipboard?.height || 1);
    const imageData = new ImageData(pxW, pxH);
    for (let i = 0; i < clipboard.pixels.length; i += 1) {
      const rgba = uint32ToRgba(clipboard.pixels[i] || 0);
      const base = i * 4;
      imageData.data[base] = rgba.r;
      imageData.data[base + 1] = rgba.g;
      imageData.data[base + 2] = rgba.b;
      imageData.data[base + 3] = rgba.a;
    }
    const off = document.createElement('canvas');
    off.width = pxW;
    off.height = pxH;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);
    const previewPad = 12;
    const previewArea = {
      x: bounds.x + previewPad,
      y: bounds.y + 40,
      w: bounds.w - previewPad * 2,
      h: bounds.h - 62
    };
    const fit = Math.min(previewArea.w / pxW, previewArea.h / pxH);
    const drawW = Math.max(1, Math.floor(pxW * fit));
    const drawH = Math.max(1, Math.floor(pxH * fit));
    const drawX = previewArea.x + Math.floor((previewArea.w - drawW) / 2);
    const drawY = previewArea.y + Math.floor((previewArea.h - drawH) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, drawX, drawY, drawW, drawH);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '11px Courier New';
    ctx.fillText(`${pxW}×${pxH}`, bounds.x + 10, bounds.y + bounds.h - 10);
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
    const previewX = x + (w - size) / 2;
    const previewY = y + (h - size) / 2;
    this.drawPixelBackground(ctx, previewX, previewY, size, size, Math.max(4, Math.floor(size / 16)));
    ctx.drawImage(this.offscreen, previewX, previewY, size, size);
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
      canvas: 'Settings',
      layers: 'Layers',
      animation: 'Anim',
      bones: 'Rigging'
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
      additionalButtons: [
        ...this.leftPanelTabs
          .filter((tab) => tab !== 'file')
          .map((tab) => ({ id: tab, label: labels[tab] || tab })),
        { id: 'undo', label: 'Undo' },
        { id: 'redo', label: 'Redo' }
      ],
      isMobile,
      width: tabColumn.w
    });

    topButtons.forEach((entry) => {
      const bounds = entry.bounds;
      const active = this.leftPanelTab === entry.id;
      this.drawButton(ctx, bounds, entry.label, active, {
        fontSize: isMobile ? 12 : 11,
        focused: this.controllerMenu.isFocusedItem('root', entry.id)
      });
      const onClick = entry.id === 'undo'
          ? () => this.runtime.undo()
          : entry.id === 'redo'
            ? () => this.runtime.redo()
            : () => this.setLeftPanelTab(entry.id);
      this.uiButtons.push({ bounds, onClick });
      this.registerFocusable('menu', bounds, onClick);
    });
    this.drawLeftPanelContent(ctx, content.x, content.y, content.w, content.h, options);
  }

  drawLeftPanelContent(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const portrait = isMobile && isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    const controllerPanelId = this.leftPanelTab === 'animation' ? 'frames' : this.leftPanelTab;
    if (!isMobile && this.controllerMenu.isMenuActive(controllerPanelId) && !['root', 'system', 'help', 'exit-confirm'].includes(controllerPanelId)) {
      this.drawControllerSubmenuPanel(ctx, x, y, w, h, controllerPanelId);
      return;
    }
    if (this.leftPanelTab === 'file') {
      this.drawFilePanel(ctx, x, y, w, h, { isMobile });
      return;
    }
    if (['draw', 'select', 'tools'].includes(this.leftPanelTab)) {
      this.drawToolsMenu(ctx, x, y, w, h, { isMobile, category: this.leftPanelTab, portrait });
      return;
    }
    if (this.leftPanelTab === 'canvas') {
      this.drawSwitchesPanel(ctx, x, y, w, h, { isMobile });
      return;
    }
    if (this.leftPanelTab === 'layers') {
      this.drawLayersPanel(ctx, x, y, w, h, { isMobile, controls: false });
      return;
    }
    if (this.leftPanelTab === 'animation') {
      this.drawFramesPanel(ctx, x, y, w, h, { isMobile, controls: false });
      return;
    }
    if (this.leftPanelTab === 'bones') {
      this.drawBoneEditorPanel(ctx, x, y, w, h, { isMobile, portrait });
    }
  }

  drawControllerSubmenuPanel(ctx, x, y, w, h, menuId) {
    const menu = this.controllerMenu.menus?.[menuId];
    if (!menu) return;
    const items = this.controllerMenu.getItems(menu);
    const rowHeight = 28;
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const visibleRows = Math.max(1, Math.floor(Math.max(0, h - 24) / Math.max(1, rowHeight + rowGap)));
    const scroll = this.controllerMenu.syncScrollToItem(
      menuId,
      this.controllerMenu.getFocusedItem(menuId)?.id,
      items,
      visibleRows,
      this.controllerMenu.scroll?.[menuId] || 0
    );
    this.sharedMenu.drawDrawer(ctx, {
      panel: { x, y, w, h },
      title: '',
      items,
      scroll,
      rowHeight,
      rowGap,
      buttonHeight: rowHeight,
      isMobile: false,
      showTitle: false,
      footerMode: 'none',
      drawButton: (bounds, item) => {
        this.drawButton(ctx, bounds, item.label, this.isControllerSubmenuItemActive(menuId, item.id), {
          fontSize: 12,
          focused: this.controllerMenu.isFocusedItem(menuId, item.id)
        });
        if (typeof item.onSelect === 'function') {
          this.uiButtons.push({ bounds, onClick: () => item.onSelect(this) });
          this.registerFocusable(menuId, bounds, () => item.onSelect(this));
        }
      }
    });
  }

  isControllerSubmenuItemActive(menuId, itemId) {
    if (['draw', 'select', 'tools'].includes(menuId)) return itemId === this.activeToolId;
    if (menuId === 'layers') return itemId === `layer-${this.canvasState.activeLayerIndex}`;
    if (menuId === 'frames') return itemId === `frame-${this.animation.currentFrameIndex}`;
    if (menuId === 'canvas') {
      if (itemId === 'grid') return Boolean(this.showGrid);
      if (itemId === 'onion') return Boolean(this.animation.onion.enabled);
    }
    return false;
  }

  drawToolsMenu(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const category = options.category || this.leftPanelTab || 'draw';
    if (isMobile && options.portrait) {
      this.drawToolsPanel(ctx, x, y, w, h, { isMobile, category, portrait: true });
      return;
    }
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

  drawPortraitToolTabs(ctx, x, y, w) {
    const tabs = buildPixelPortraitMenuModel().toolTabs;
    const gap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const buttonH = UI_SUITE.spacing.tap;
    const buttonW = Math.max(68, Math.floor((w - gap * (tabs.length - 1)) / tabs.length));
    tabs.forEach((tab, index) => {
      const bounds = { x: x + index * (buttonW + gap), y, w: buttonW, h: buttonH };
      this.drawButton(ctx, bounds, tab.label, this.leftPanelTab === tab.id, { fontSize: 12 });
      this.uiButtons.push({
        bounds,
        onClick: () => {
          this.setLeftPanelTab(tab.id);
          this.mobileDrawer = 'panel';
        }
      });
      this.registerFocusable('toolbar', bounds, () => this.setLeftPanelTab(tab.id));
    });
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
    let offsetY = toolsTop;
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

  drawBoneEditorPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const portrait = Boolean(options.portrait);
    this.boneUiRegions.push({ x, y, w, h });
    const rowH = isMobile ? 44 : 28;
    const gap = 8;
    let yPos = y + 8;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 14 : 13}px ${UI_SUITE.font.family}`;
    ctx.fillText('Rigging', x + 10, yPos + 14);
    yPos += 24;
    const selectedBone = this.getSelectedBone();
    if (!portrait) {
      const modes = [
        { id: 'bones', label: 'Build' },
        { id: 'bind', label: 'Rig' },
        { id: 'pose', label: 'Pose' },
        { id: 'time', label: 'Tools' }
      ];
      const modeW = Math.max(56, Math.floor((w - 20 - gap * (modes.length - 1)) / modes.length));
      modes.forEach((mode, index) => {
        const bounds = { x: x + 10 + index * (modeW + gap), y: yPos, w: modeW, h: rowH };
        this.drawButton(ctx, bounds, mode.label, this.boneEditor.mode === mode.id, { fontSize: 11 });
        const action = () => this.setBoneEditorMode(mode.id);
        this.uiButtons.push({ bounds, onClick: action, group: 'bone-ui' });
        this.registerFocusable('bones', bounds, action);
      });
      yPos += rowH + gap;
      const actions = this.getBoneEditorActions();
      const actionCols = isMobile ? 2 : 1;
      const actionW = Math.floor((w - 20 - gap * (actionCols - 1)) / actionCols);
      actions.forEach((entry, index) => {
        const col = index % actionCols;
        const row = Math.floor(index / actionCols);
        const bounds = { x: x + 10 + col * (actionW + gap), y: yPos + row * (rowH + gap), w: actionW, h: rowH };
        this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), { fontSize: 11, disabled: Boolean(entry.disabled) });
        if (!entry.disabled) {
          this.uiButtons.push({ bounds, onClick: entry.action, group: 'bone-ui' });
          this.registerFocusable('bones', bounds, entry.action);
        }
      });
      yPos += Math.ceil(actions.length / actionCols) * (rowH + gap) + 4;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${isMobile ? 11 : 10}px ${UI_SUITE.font.family}`;
    const edgeSummary = this.getAffectedEdgeSummary();
    const status = selectedBone
      ? (this.boneEditor.mode === 'pose'
          ? `${selectedBone.name}: drag tip rotate, body move`
          : `${edgeSummary || selectedBone.name}: ${this.boneEditor.mode} ${Math.round(this.boneEditor.timeMs || 0)}ms`)
      : 'Add a bone, bind pixels, set poses, then bake.';
    ctx.fillText(status.slice(0, 42), x + 10, yPos + 14);
    yPos += 24;
    if (this.boneEditor.mode === 'pose' || this.boneEditor.mode === 'time') {
      const timelineH = isMobile ? 64 : 56;
      this.drawBoneTimelineStrip(ctx, x + 10, yPos, Math.max(1, w - 20), timelineH);
      yPos += timelineH + 8;
    }
    if (!portrait && this.boneEditor.submenu === 'nodes') {
      this.drawBoneNodeList(ctx, x + 8, yPos, Math.max(1, w - 16), Math.max(40, h - (yPos - y) - 8), { isMobile });
    } else if (!portrait) {
      this.boneListMeta = null;
    }
  }

  drawBoneNodeList(ctx, x, y, w, h, options = {}) {
    const isMobile = Boolean(options.isMobile);
    const rowH = isMobile ? 44 : 28;
    const listH = Math.max(40, h);
    const visible = Math.max(1, Math.floor(listH / rowH));
    const bones = this.boneRig.bones;
    const maxScroll = Math.max(0, bones.length - visible);
    this.focusScroll.bones = clamp(this.focusScroll.bones || 0, 0, maxScroll);
    this.boneListMeta = { scrollBounds: { x, y, w, h: listH }, lineHeight: rowH, maxScroll };
    this.boneUiRegions.push(this.boneListMeta.scrollBounds);
    bones.slice(this.focusScroll.bones, this.focusScroll.bones + visible).forEach((bone, visibleIndex) => {
      const index = this.boneRig.bones.findIndex((entry) => entry.id === bone.id);
      const controlW = isMobile ? 40 : 34;
      const renameW = Math.min(isMobile ? 70 : 62, Math.max(52, Math.floor(w * 0.22)));
      const rowY = y + visibleIndex * rowH;
      const selectBounds = { x: x + 2, y: rowY, w: Math.max(1, w - renameW - controlW * 2 - 18), h: rowH - 6 };
      const upBounds = { x: selectBounds.x + selectBounds.w + 4, y: rowY, w: controlW, h: rowH - 6 };
      const downBounds = { x: upBounds.x + upBounds.w + 4, y: rowY, w: controlW, h: rowH - 6 };
      const renameBounds = { x: downBounds.x + downBounds.w + 4, y: rowY, w: renameW, h: rowH - 6 };
      const action = () => {
        this.boneEditor.selectedBoneId = bone.id;
        this.boneEditor.selectedEdgeBoneId = bone.id;
        this.boneEditor.selectedJointId = null;
        this.boneEditor.chainAnchor = null;
        this.boneEditor.selectionSource = 'list';
      };
      const label = bone.name || `Bone ${index + 1}`;
      this.drawButton(ctx, selectBounds, label, bone.id === this.boneEditor.selectedEdgeBoneId || bone.id === this.boneEditor.selectedBoneId, { fontSize: 11 });
      this.uiButtons.push({ bounds: selectBounds, onClick: action, group: options.group || 'bone-ui' });
      this.registerFocusable('bones', selectBounds, action);
      const renameAction = () => {
        action();
        this.renameSelectedBone();
      };
      this.drawButton(ctx, upBounds, 'Up', false, { fontSize: 10, disabled: index <= 0 });
      if (index > 0) {
        const upAction = () => this.moveBoneOrder(bone.id, -1);
        this.uiButtons.push({ bounds: upBounds, onClick: upAction, group: options.group || 'bone-ui' });
        this.registerFocusable('bones', upBounds, upAction);
      }
      this.drawButton(ctx, downBounds, 'Dn', false, { fontSize: 10, disabled: index >= this.boneRig.bones.length - 1 });
      if (index < this.boneRig.bones.length - 1) {
        const downAction = () => this.moveBoneOrder(bone.id, 1);
        this.uiButtons.push({ bounds: downBounds, onClick: downAction, group: options.group || 'bone-ui' });
        this.registerFocusable('bones', downBounds, downAction);
      }
      this.drawButton(ctx, renameBounds, 'Rename', false, { fontSize: 10 });
      this.uiButtons.push({ bounds: renameBounds, onClick: renameAction, group: options.group || 'bone-ui' });
      this.registerFocusable('bones', renameBounds, renameAction);
    });
    if (maxScroll > 0) {
      drawSharedPortraitScrollHints(ctx, this.boneListMeta.scrollBounds, {
        scroll: this.focusScroll.bones,
        scrollMax: maxScroll
      });
    }
  }

  getBoneTimelineLayout(x, y, w, h) {
    const duration = Math.max(1, this.getBoneTimelineDurationMs());
    const zoom = clamp(Number(this.boneEditor.timelineZoom || 1), 1, 8);
    const visibleMs = Math.max(1, duration / zoom);
    const maxScrollMs = Math.max(0, duration - visibleMs);
    const scrollMs = clamp(Number(this.boneEditor.timelineScrollMs || 0), 0, maxScrollMs);
    this.boneEditor.timelineZoom = zoom;
    this.boneEditor.timelineScrollMs = scrollMs;
    const sliderH = 8;
    const sliderGap = 8;
    const sliderW = Math.max(40, w - 16);
    const sliderRailBounds = {
      x: x + Math.max(0, Math.floor((w - sliderW) / 2)),
      y: y + Math.max(1, h - sliderH - 2),
      w: sliderW,
      h: sliderH
    };
    const sliderBounds = {
      x: sliderRailBounds.x,
      y: sliderRailBounds.y - 12,
      w: sliderRailBounds.w,
      h: sliderRailBounds.h + 24
    };
    const railBounds = { x, y, w: Math.max(1, w), h: Math.max(1, h - sliderH - sliderGap) };
    return {
      duration,
      zoom,
      visibleMs,
      maxScrollMs,
      scrollMs,
      railBounds,
      sliderRailBounds,
      sliderBounds
    };
  }

  boneTimelineMsToX(timeMs, layout) {
    const t = (Number(timeMs || 0) - layout.scrollMs) / Math.max(1, layout.visibleMs);
    return layout.railBounds.x + t * layout.railBounds.w;
  }

  boneTimelineXToMs(pointerX, layout) {
    const ratio = clamp((Number(pointerX || 0) - layout.railBounds.x) / Math.max(1, layout.railBounds.w), 0, 1);
    return Math.round(layout.scrollMs + ratio * layout.visibleMs);
  }

  getBoneTimelineHitLayout(point) {
    if (this.leftPanelTab !== 'bones') return null;
    if (!['pose', 'time'].includes(this.boneEditor?.mode)) return null;
    const meta = this.boneTimelineMeta;
    if (!meta?.bounds || !this.isPointInBounds(point, meta.bounds)) return null;
    return this.getBoneTimelineLayout(meta.bounds.x, meta.bounds.y, meta.bounds.w, meta.bounds.h);
  }

  adjustBoneTimelineZoom(multiplier, anchorMs = null) {
    const duration = Math.max(1, this.getBoneTimelineDurationMs());
    const oldZoom = clamp(Number(this.boneEditor.timelineZoom || 1), 1, 8);
    const nextZoom = clamp(oldZoom * Number(multiplier || 1), 1, 8);
    const oldVisible = duration / oldZoom;
    const oldStart = clamp(Number(this.boneEditor.timelineScrollMs || 0), 0, Math.max(0, duration - oldVisible));
    const anchor = clamp(Number(anchorMs ?? this.boneEditor.timeMs ?? 0), 0, duration);
    const ratio = oldVisible > 0 ? clamp((anchor - oldStart) / oldVisible, 0, 1) : 0.5;
    const nextVisible = duration / nextZoom;
    this.boneEditor.timelineZoom = nextZoom;
    this.boneEditor.timelineScrollMs = clamp(anchor - ratio * nextVisible, 0, Math.max(0, duration - nextVisible));
  }

  setBoneTimelineZoomFromSlider(pointerX, sliderBounds, anchorMs = null) {
    const ratio = clamp((Number(pointerX || 0) - sliderBounds.x) / Math.max(1, sliderBounds.w), 0, 1);
    const oldZoom = clamp(Number(this.boneEditor.timelineZoom || 1), 1, 8);
    const nextZoom = 1 + ratio * 7;
    this.adjustBoneTimelineZoom(nextZoom / Math.max(0.001, oldZoom), anchorMs ?? this.boneEditor.timeMs ?? 0);
    this.boneEditor.playing = false;
  }

  panBoneTimeline(deltaX, layout, startScrollMs = this.boneEditor.timelineScrollMs || 0) {
    const msPerPx = layout.visibleMs / Math.max(1, layout.railBounds.w);
    this.boneEditor.timelineScrollMs = clamp(Number(startScrollMs || 0) - Number(deltaX || 0) * msPerPx, 0, layout.maxScrollMs);
  }

  handleBoneTimelineWheel(payload = {}) {
    const layout = this.getBoneTimelineHitLayout(payload);
    if (!layout) return false;
    if (payload.ctrlKey || payload.metaKey || payload.shiftKey) {
      this.adjustBoneTimelineZoom(Number(payload.deltaY || 0) > 0 ? 1 / 1.15 : 1.15, this.boneTimelineXToMs(payload.x, layout));
    } else {
      const dominant = Math.abs(Number(payload.deltaX || 0)) > Math.abs(Number(payload.deltaY || 0))
        ? Number(payload.deltaX || 0)
        : Number(payload.deltaY || 0);
      this.boneEditor.timelineScrollMs = clamp(
        layout.scrollMs + dominant * (layout.visibleMs / Math.max(1, layout.railBounds.w)),
        0,
        layout.maxScrollMs
      );
    }
    this.boneEditor.playing = false;
    return true;
  }

  drawBoneTimelineStrip(ctx, x, y, w, h) {
    const layout = this.getBoneTimelineLayout(x, y, w, h);
    const { duration, railBounds } = layout;
    const timelineBounds = { x, y, w, h };
    this.boneTimelineMeta = { bounds: timelineBounds };
    const trackY = railBounds.y + 6;
    const labelH = 12;
    const trackH = Math.max(18, railBounds.h - labelH - 8);
    const railY = trackY + Math.floor(trackH * 0.5);
    ctx.save();
    ctx.fillStyle = 'rgba(3,9,14,0.82)';
    ctx.fillRect(railBounds.x, trackY, railBounds.w, trackH);
    ctx.strokeStyle = 'rgba(141,240,255,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect?.(railBounds.x + 0.5, trackY + 0.5, Math.max(1, railBounds.w - 1), Math.max(1, trackH - 1));
    const tickTarget = Math.max(4, Math.floor(railBounds.w / 56));
    const tickStep = Math.max(50, Math.pow(10, Math.floor(Math.log10(layout.visibleMs / tickTarget || 1))));
    const tickMultipliers = [1, 2, 5, 10];
    const niceStep = tickMultipliers.map((mult) => mult * tickStep).find((step) => layout.visibleMs / step <= tickTarget) || tickStep * 10;
    const firstTick = Math.ceil(layout.scrollMs / niceStep) * niceStep;
    for (let timeMs = firstTick; timeMs <= layout.scrollMs + layout.visibleMs + 0.001; timeMs += niceStep) {
      const tx = this.boneTimelineMsToX(timeMs, layout);
      const major = Math.round(timeMs / niceStep) % 2 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(tx, trackY + (major ? 2 : 7));
      ctx.lineTo(tx, trackY + trackH - 2);
      ctx.stroke();
      if (major && railBounds.w > 120) {
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.font = '9px Courier New';
        ctx.fillText(`${Math.round(timeMs)}ms`, tx + 3, trackY + 10);
      }
    }
    const cursorX = this.boneTimelineMsToX(this.boneEditor.timeMs || 0, layout);
    if (cursorX >= railBounds.x && cursorX <= railBounds.x + railBounds.w) {
      ctx.strokeStyle = '#ffe16a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, trackY);
      ctx.lineTo(cursorX, trackY + trackH);
      ctx.stroke();
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(cursorX - 3, trackY - 2, 6, 4);
    }
    const hitSize = this.isMobileLayout?.() ? 28 : 20;
    (this.boneRig.poseTimeline || []).forEach((key) => {
      const timeMs = Number(key.timeMs || 0);
      if (timeMs < layout.scrollMs || timeMs > layout.scrollMs + layout.visibleMs) return;
      const kx = this.boneTimelineMsToX(timeMs, layout);
      const active = Math.abs((this.boneEditor.timeMs || 0) - timeMs) <= 1;
      ctx.fillStyle = active ? '#ff9f6a' : '#8df0ff';
      ctx.strokeStyle = active ? '#ffe16a' : 'rgba(7,16,21,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(kx, railY - 7);
      ctx.lineTo(kx + 7, railY);
      ctx.lineTo(kx, railY + 7);
      ctx.lineTo(kx - 7, railY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px Courier New';
    const windowLabel = layout.zoom > 1 ? ` ${layout.zoom.toFixed(layout.zoom >= 4 ? 0 : 1)}x ${Math.round(layout.scrollMs)}-${Math.round(layout.scrollMs + layout.visibleMs)}ms` : ' fit';
    ctx.fillText(`${Math.round(this.boneEditor.timeMs || 0)} / ${Math.round(duration)}ms ${windowLabel}`, railBounds.x, railBounds.y + railBounds.h - 2);
    const sliderRatio = clamp((layout.zoom - 1) / 7, 0, 1);
    drawSharedMobileZoomSlider(ctx, layout.sliderRailBounds, sliderRatio, {
      knobColor: '#45f0ff',
      railColor: 'rgba(7,16,21,0.72)',
      railStroke: 'rgba(141,240,255,0.32)'
    });
    ctx.restore();
    const scrubBand = { x: railBounds.x, y: railY - Math.min(14, Math.floor(railBounds.h / 2)), w: railBounds.w, h: Math.min(28, railBounds.h) };
    let dragMode = 'pending';
    let startX = 0;
    let startY = 0;
    let startScrollMs = 0;
    let startInScrubBand = false;
    const setTimelineFromPointer = ({ x: pointerX }) => {
      this.boneEditor.timeMs = clamp(this.boneTimelineXToMs(pointerX, layout), 0, duration);
      this.boneEditor.playing = false;
    };
    const startTimelineDrag = ({ x: pointerX, y: pointerY }) => {
      dragMode = 'pending';
      startX = pointerX;
      startY = pointerY;
      startScrollMs = this.boneEditor.timelineScrollMs || 0;
      startInScrubBand = this.isPointInBounds({ x: pointerX, y: pointerY }, scrubBand);
      if (startInScrubBand) setTimelineFromPointer({ x: pointerX });
    };
    const updateTimelineDrag = ({ x: pointerX, y: pointerY }) => {
      if (dragMode === 'pending') {
        const dx = Number(pointerX || 0) - Number(startX || 0);
        const dy = Number(pointerY || 0) - Number(startY || 0);
        if (Math.hypot(dx, dy) >= 6) {
          dragMode = layout.zoom > 1 && Math.abs(dx) >= Math.abs(dy) ? 'pan' : 'scrub';
        } else {
          return;
        }
      }
      if (dragMode === 'pan') {
        this.panBoneTimeline(pointerX - startX, layout, startScrollMs);
      } else {
        setTimelineFromPointer({ x: pointerX });
      }
    };
    this.uiButtons.push({
      bounds: railBounds,
      id: 'bone-timeline',
      group: 'bone-timeline',
      onClick: startTimelineDrag,
      onDrag: updateTimelineDrag
    });
    (this.boneRig.poseTimeline || []).forEach((key) => {
      const timeMs = Number(key.timeMs || 0);
      if (timeMs < layout.scrollMs || timeMs > layout.scrollMs + layout.visibleMs) return;
      const kx = this.boneTimelineMsToX(timeMs, layout);
      this.uiButtons.push({
        bounds: { x: kx - hitSize / 2, y: railY - hitSize / 2, w: hitSize, h: hitSize },
        id: `bone-key-${timeMs}`,
        group: 'bone-timeline',
        onClick: () => {
          this.boneEditor.timeMs = clamp(Math.round(timeMs), 0, duration);
          this.boneEditor.playing = false;
        }
      });
    });
    this.uiButtons.push({
      bounds: layout.sliderBounds,
      id: 'bone-timeline-zoom-slider',
      group: 'bone-timeline',
      onClick: ({ x: pointerX }) => this.setBoneTimelineZoomFromSlider(pointerX, layout.sliderRailBounds),
      onDrag: ({ x: pointerX }) => this.setBoneTimelineZoomFromSlider(pointerX, layout.sliderRailBounds)
    });
  }

  isBindSelectionTool(toolId = this.activeToolId) {
    return [
      TOOL_IDS.SELECT_RECT,
      TOOL_IDS.SELECT_ELLIPSE,
      TOOL_IDS.SELECT_LASSO,
      TOOL_IDS.SELECT_MAGIC_LASSO,
      TOOL_IDS.SELECT_MAGIC_COLOR
    ].includes(toolId);
  }

  ensureBindSelectionTool() {
    if (!this.isBindSelectionTool(this.activeToolId)) {
      this.setActiveTool(TOOL_IDS.SELECT_RECT);
    }
  }

  clearBoneEditorBlockingSelectionState(options = {}) {
    if (!this.selection) return;
    const { clearActive = true } = options;
    if (clearActive) {
      if (typeof this.clearSelection === 'function') {
        this.clearSelection();
      } else {
        this.selection.active = false;
        this.selection.mask = null;
        this.selection.bounds = null;
      }
    } else {
      this.selection.mode = null;
      this.selection.baseMask = null;
      this.selection.start = null;
      this.selection.end = null;
      this.selection.lassoPoints = [];
      this.selectionContextMenu = null;
    }
    this.selection.floating = null;
    this.selection.floatingMode = null;
    this.selection.floatingBounds = null;
    this.selection.offset = { x: 0, y: 0 };
    this.moveTransformDrag = null;
  }

  resetLoadedBoneEditorState() {
    if (!this.boneEditor) return;
    const clearBlockingSelection = typeof this.clearBoneEditorBlockingSelectionState === 'function'
      ? this.clearBoneEditorBlockingSelectionState
      : PixelStudio.prototype.clearBoneEditorBlockingSelectionState;
    const clearBlockingOverlays = typeof this.clearPixelEditorBlockingOverlays === 'function'
      ? this.clearPixelEditorBlockingOverlays
      : PixelStudio.prototype.clearPixelEditorBlockingOverlays;
    clearBlockingOverlays.call(this);
    this.boneEditor.mode = 'bones';
    this.boneEditor.submenu = null;
    this.boneEditor.selectedJointId = null;
    this.boneEditor.selectedBoneId = null;
    this.boneEditor.selectedEdgeBoneId = null;
    this.boneEditor.drag = null;
    this.boneEditor.pendingBindNodeTap = null;
    this.boneEditor.chainAnchor = null;
    this.boneEditor.linkMode = true;
    this.boneEditor.playing = false;
    this.boneEditor.timeMs = 0;
    this.boneEditor.timelineZoom = 1;
    this.boneEditor.timelineScrollMs = 0;
    this.boneTimelineGesture = null;
    this.boneTimelineMeta = null;
    clearBlockingSelection.call(this, { clearActive: true });
  }

  enforceBoneEditorToolMode(mode = this.boneEditor?.mode || 'bones') {
    if (!this.boneEditor) return;
    const clearBlockingSelection = typeof this.clearBoneEditorBlockingSelectionState === 'function'
      ? this.clearBoneEditorBlockingSelectionState
      : PixelStudio.prototype.clearBoneEditorBlockingSelectionState;
    this.boneEditor.drag = null;
    this.boneEditor.pendingBindNodeTap = null;
    if (mode === 'bind') {
      this.boneEditor.playing = false;
      this.ensureBindSelectionTool();
      clearBlockingSelection.call(this, { clearActive: false });
    } else if (['bones', 'pose', 'time'].includes(mode)) {
      if (this.strokeState) this.strokeState = null;
      clearBlockingSelection.call(this, { clearActive: true });
      this.cancelLongPress?.();
      this.setInputMode?.('canvas');
    }
  }

  resetBoneEditorTransientState(options = {}) {
    if (!this.boneEditor) return;
    const mode = options.mode || this.boneEditor.mode || 'bones';
    const enforceBoneToolMode = typeof this.enforceBoneEditorToolMode === 'function'
      ? this.enforceBoneEditorToolMode
      : PixelStudio.prototype.enforceBoneEditorToolMode;
    enforceBoneToolMode.call(this, mode);
    if (!options.preserveEdgeSelection) {
      this.boneEditor.selectedEdgeBoneId = null;
    }
    if (options.normalizeSelection !== false && typeof this.ensureBoneNodeSelection === 'function') {
      this.ensureBoneNodeSelection();
    }
  }

  setBoneEditorMode(mode) {
    const previousMode = this.boneEditor.mode || 'bones';
    this.boneEditor.mode = mode;
    const resetBoneState = typeof this.resetBoneEditorTransientState === 'function'
      ? this.resetBoneEditorTransientState
      : PixelStudio.prototype.resetBoneEditorTransientState;
    resetBoneState.call(this, { mode, preserveEdgeSelection: previousMode === 'bones' && mode === 'bones' });
    if (mode !== 'bones') {
      this.boneEditor.linkMode = false;
      this.boneEditor.chainAnchor = this.getBoneChainAnchorFromSelection();
    }
    if (mode === 'bind') {
      this.boneEditor.playing = false;
    } else if (mode === 'pose' || mode === 'time') {
      this.setInputMode('canvas');
    }
  }

  isBoneEditorBoneOnlyMode() {
    return this.leftPanelTab === 'bones' && ['bones', 'pose', 'time'].includes(this.boneEditor?.mode);
  }

  setBindSelectionTool(toolId) {
    this.boneEditor.pendingBindNodeTap = null;
    this.boneEditor.drag = null;
    this.setActiveTool(toolId);
  }

  runBoneToolCommand(action, returnMode = 'pose') {
    if (typeof action === 'function') action();
    this.boneEditor.submenu = null;
    this.setBoneEditorMode(returnMode);
  }

  enterRiggingBuildMode() {
    this.setLeftPanelTab('bones');
    this.setBoneEditorMode('bones');
    this.boneEditor.submenu = null;
    this.mobileDrawer = null;
    this.mobileDrawerBounds = null;
    this.pixelPortraitSubpanel = null;
    this.boneListMeta = null;
  }

  getBoneEditorActions() {
    return this.getBoneContextActions(this.boneEditor.mode, { full: true });
  }

  getBoneContextActions(mode = this.boneEditor.mode, options = {}) {
    const selected = this.getSelectedBone();
    const affectedEdges = this.getAffectedEdgeBones();
    const hasSelection = Boolean(this.selection.active && this.selection.mask);
    const hasBindings = Boolean(this.boneRig.bindings.length);
    const full = Boolean(options.full);
    const activeLayerPixels = this.canvasState?.layers?.[this.canvasState?.activeLayerIndex || 0]?.pixels || null;
    const edgeModeLabels = {
      rotate: 'Rotate',
      fixed: 'Locked',
      free: 'Free',
      stretch: 'Stretch',
      spring: 'Spring',
      slide: 'Slide',
      hinge: 'Hinge'
    };
    const affectedModes = new Set(affectedEdges.map((bone) => bone.jointMode || (bone.stretch ? 'stretch' : 'rotate')));
    const selectedEdgeMode = affectedEdges[0]?.jointMode || (affectedEdges[0]?.stretch ? 'stretch' : 'rotate');
    const selectedEdgeLabel = edgeModeLabels[selectedEdgeMode] || 'Rotate';
    const edgeLabel = affectedModes.size > 1 ? 'Mixed' : selectedEdgeLabel;
    const affectedEdgeSuffix = affectedEdges.length > 1 ? ` (${affectedEdges.length})` : '';
    const selectedEdge = this.getSelectedEdgeBone();
    const selectedOrEdge = selectedEdge || selected;
    const bakeFrameCount = typeof this.getBoneBakeFrameCount === 'function'
      ? this.getBoneBakeFrameCount()
      : Math.max(1, Math.round(Number(this.boneEditor?.bakeFrameCount) || 1));
    const getPoseTargetEdge = typeof this.getPoseTargetEdgeBone === 'function'
      ? this.getPoseTargetEdgeBone
      : PixelStudio.prototype.getPoseTargetEdgeBone;
    const poseTargetEdge = mode === 'pose' ? getPoseTargetEdge.call(this) : null;
    const poseTargetLabel = poseTargetEdge ? `Target: ${poseTargetEdge.name || poseTargetEdge.id}` : 'Target';
    const actionsByMode = {
      bones: [
        { id: 'bone-add', label: 'Add', action: () => this.startBoneAddMode() },
        { id: 'bone-link', label: this.boneEditor.linkMode ? 'Link On' : 'Link Off', active: this.boneEditor.linkMode, action: () => this.toggleBoneLinkMode() },
        { id: 'bone-reverse', label: selectedEdge ? 'Reverse Edge' : 'Reverse', disabled: !selectedOrEdge, action: () => this.reverseSelectedBoneDirection() },
        { id: 'bone-stretch', label: `${edgeLabel}${affectedEdgeSuffix}`, active: affectedModes.size > 1 || selectedEdgeMode !== 'rotate', disabled: !affectedEdges.length, action: () => this.cycleSelectedBoneEdgeMode() },
        { id: 'bone-ik', label: affectedEdges.some((bone) => bone.jointSettings?.ikEnabled === false) ? 'IK Off' : 'IK On', active: affectedEdges.length > 0 && affectedEdges.every((bone) => bone.jointSettings?.ikEnabled !== false), disabled: !affectedEdges.length, action: () => this.toggleSelectedBoneIk() },
        { id: 'bone-delete', label: selectedEdge ? 'Delete Edge' : 'Delete', disabled: !selectedOrEdge, action: () => this.deleteSelectedBone() }
      ],
      bind: [
        { id: 'bind-mode', label: `Mode: ${this.selection.combineMode || 'replace'}`, action: () => this.cycleSelectionCombineMode() },
        { id: 'bind-rect', label: 'Rect', active: this.activeToolId === TOOL_IDS.SELECT_RECT, action: () => this.setBindSelectionTool(TOOL_IDS.SELECT_RECT) },
        ...(full ? [
          { id: 'bind-oval', label: 'Oval', active: this.activeToolId === TOOL_IDS.SELECT_ELLIPSE, action: () => this.setBindSelectionTool(TOOL_IDS.SELECT_ELLIPSE) },
          { id: 'bind-lasso', label: 'Lasso', active: this.activeToolId === TOOL_IDS.SELECT_LASSO, action: () => this.setBindSelectionTool(TOOL_IDS.SELECT_LASSO) },
          { id: 'bind-magic', label: 'Magic', active: this.activeToolId === TOOL_IDS.SELECT_MAGIC_COLOR, action: () => this.setBindSelectionTool(TOOL_IDS.SELECT_MAGIC_COLOR) }
        ] : []),
        { id: 'bind-unassigned', label: 'Unassigned', disabled: !activeLayerPixels, action: () => this.selectUnassignedRigPixels() },
        { id: 'bind-add', label: 'Assign', disabled: !selected || !hasSelection, action: () => this.addSelectionToSelectedBone() },
        { id: 'bind-remove', label: 'Remove', disabled: !selected || !hasSelection, action: () => this.removeSelectionFromSelectedBone() },
        ...(full ? [
          { id: 'bind-layer', label: 'Layer', disabled: !selected, action: () => this.bindActiveLayerToSelectedBone() },
          { id: 'bind-clear', label: 'Clear', disabled: !selected, action: () => this.clearSelectedBoneBindings() }
        ] : [
          { id: 'bind-layer', label: 'Layer', disabled: !selected, action: () => this.bindActiveLayerToSelectedBone() }
        ])
      ],
      pose: [
        { id: 'pose-target', label: poseTargetLabel, disabled: !selected, action: () => this.cyclePoseTargetEdge() },
        { id: 'pose-set', label: 'Set Key', disabled: !selected, action: () => this.setBoneTimelineKey() },
        { id: 'pose-reset', label: 'Reset', disabled: !selected, action: () => this.resetSelectedBonePose() },
        { id: 'pose-copy', label: 'Copy', disabled: !selected, action: () => this.copyCurrentBonePose() },
        { id: 'pose-paste', label: 'Paste', disabled: !selected || !this.bonePoseClipboard, action: () => this.pasteCopiedBonePose() },
        { id: 'pose-delete', label: 'Del Key', disabled: !this.getCurrentBoneTimelineKey(), action: () => this.deleteBoneTimelineKey() },
        { id: 'pose-length', label: 'Length', action: () => this.promptBoneTimelineLength() }
      ],
      time: [
        { id: 'time-bake', label: 'Bake', disabled: !hasBindings, action: () => this.bakeBoneAnimationToCopiedFrames() },
        { id: 'time-hide-bones', label: this.boneEditor.hideBonesDuringPlayback ? 'Hide Bones: On' : 'Hide Bones: Off', active: Boolean(this.boneEditor.hideBonesDuringPlayback), action: () => this.toggleHideBonesDuringPlayback() },
        { id: 'time-frame-count', label: `Frames: ${bakeFrameCount}`, action: () => this.promptBoneBakeFrameCount() },
        { id: 'time-convert-layers', label: 'Rig to Layers', disabled: !hasBindings || !activeLayerPixels, action: () => this.convertRigAssignmentsToLayers() },
        { id: 'time-reverse-layers', label: this.boneEditor.reverseRigLayerOrder ? 'Root Top: On' : 'Root Top: Off', active: Boolean(this.boneEditor.reverseRigLayerOrder), action: () => this.toggleReverseRigLayerOrder() },
        { id: 'time-list-bones', label: 'List Bones', active: this.boneEditor.submenu === 'nodes', action: () => { this.boneEditor.submenu = this.boneEditor.submenu === 'nodes' ? 'time' : 'nodes'; } }
      ]
    };
    return actionsByMode[mode] || actionsByMode.bones;
  }

  drawBoneContextRail(ctx, x, y, w, h, options = {}) {
    const rootActions = buildPixelPortraitBoneActions();
    this.boneUiRegions.push({ x, y, w, h });
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    const activeSubmenu = buildPixelPortraitBoneActionGroups()[this.boneEditor.submenu];
    if (activeSubmenu) {
      this.drawBoneContextSubmenuSheet(ctx, x, y, w, activeSubmenu);
    }

    this.drawPortraitActionGrid(ctx, x + 10, y + 10, Math.max(1, w - 20), rootActions.map((entry) => ({
      id: entry.id,
      label: entry.label,
      active: this.boneEditor.submenu === entry.id || (!this.boneEditor.submenu && this.boneEditor.mode === entry.id),
      action: () => {
        this.leftPanelTab = 'bones';
        this.setBoneEditorMode(entry.id);
        if (this.isMobileLayout()) {
          this.mobileDrawer = null;
          this.mobileDrawerBounds = null;
          this.pixelPortraitSubpanel = null;
        }
        this.boneEditor.submenu = this.boneEditor.submenu === entry.id ? null : entry.id;
      }
    })), {
      minColumnWidth: 70,
      maxColumns: 4,
      rowHeight: Math.max(40, h - 14),
      buttonHeight: Math.max(34, h - 18),
      group: 'bone-actions'
    });
  }

  drawBoneContextSubmenuSheet(ctx, railX, railY, railW, subpanel) {
    const sheetMargin = 8;
    const isPoseSheet = this.boneEditor.submenu === 'pose';
    const isNodesSheet = this.boneEditor.submenu === 'nodes';
    const sheetH = Math.min(isPoseSheet || isNodesSheet ? 300 : 230, Math.max(isPoseSheet || isNodesSheet ? 230 : 150, railY - sheetMargin * 2));
    const sheet = {
      x: railX,
      y: Math.max(sheetMargin, railY - sheetH - sheetMargin),
      w: railW,
      h: sheetH
    };
    this.boneUiRegions.push(sheet);
    const actionsById = new Map(this.getBoneContextActions(this.boneEditor.submenu, { full: true }).map((entry) => [entry.id, entry]));
    const actions = subpanel.actionIds.map((id) => actionsById.get(id)).filter(Boolean);
    drawSharedPortraitSheet(ctx, sheet, {
      fill: UI_SUITE.colors.panel,
      border: UI_SUITE.colors.border
    });
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(subpanel.title, sheet.x + 14, sheet.y + 24);
    const closeBounds = { x: sheet.x + sheet.w - 82, y: sheet.y + 8, w: 70, h: 30 };
    this.drawButton(ctx, closeBounds, 'Close', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: closeBounds, onClick: () => { this.boneEditor.submenu = null; }, group: 'bone-actions' });
    this.registerFocusable('bone-actions', closeBounds, () => { this.boneEditor.submenu = null; });

    let actionY = sheet.y + 48;
    if (isNodesSheet) {
      this.drawBoneNodeList(ctx, sheet.x + 12, actionY, Math.max(1, sheet.w - 24), Math.max(40, sheet.y + sheet.h - actionY - 10), { isMobile: true, group: 'bone-actions' });
      return;
    }
    if (isPoseSheet) {
      ctx.fillStyle = '#b9c7d8';
      ctx.font = '12px Courier New';
      const getPoseTargetLabel = typeof this.getPoseTargetLabel === 'function'
        ? this.getPoseTargetLabel
        : PixelStudio.prototype.getPoseTargetLabel;
      ctx.fillText(getPoseTargetLabel.call(this), sheet.x + 14, actionY + 12);
      actionY += 20;
      this.drawBoneTimelineStrip(ctx, sheet.x + 14, actionY, Math.max(1, sheet.w - 28), 58);
      actionY += 68;
    }

    this.drawPortraitActionGrid(ctx, sheet.x + 12, actionY, Math.max(1, sheet.w - 24), actions, {
      minColumnWidth: 88,
      maxColumns: 3,
      rowHeight: 52,
      buttonHeight: 44,
      group: 'bone-actions'
    });
  }

  getFilePanelItems() {
    return buildUnifiedFileDrawerItems({
      labels: {
        export: 'Export',
        import: 'Import'
      },
      actions: {
        new: () => this.newArtDocument(),
        save: () => (this.decalEditSession && this.decalEditSession.type !== 'actor-state'
          ? this.saveDecalSessionAndReturn()
          : this.saveArtDocument()),
        'save-as': () => this.saveArtDocument({ forceSaveAs: true }),
        open: () => this.loadArtDocument(),
        export: () => this.choosePixelExportFormat(),
        import: () => this.imageFileInput.click()
      },
      editorSpecific: [
        ...(this.decalEditSession
          ? (this.decalEditSession.type === 'actor-state'
              ? [{ id: 'test-actor-session', label: 'Test Actor', onClick: () => this.game.startActorEditorPlaytest(this.decalEditSession.actorId, this.game.actorEditor?.actor?.id === this.decalEditSession.actorId ? this.game.actorEditor.actor : null) }]
              : [
                  { id: 'save-decal-session', label: 'Save Changes', onClick: () => this.saveDecalSessionAndReturn() },
                  { id: 'abandon-decal-session', label: 'Abandon Changes', onClick: () => this.abandonDecalSessionAndReturn() }
                ])
          : []),
        { id: 'copy-image', label: 'Copy', onClick: () => this.copySelection() },
        { id: 'paste-image', label: 'Paste', onClick: () => this.pasteClipboard() },
        { id: 'exit-main', label: this.game.pixelStudioReturnState === 'editor'
          ? 'Return To Level Editor'
          : this.game.pixelStudioReturnState === 'actor-editor'
            ? 'Return To Actor'
            : 'Exit to Main Menu', onClick: () => this.exitToMainMenu() }
      ]
    });
  }

  ensureBoneNodeSelection() {
    if (!this.boneEditor) return;
    const hasJoint = this.boneEditor.selectedJointId
      && this.boneRig.joints.some((joint) => joint.id === this.boneEditor.selectedJointId);
    const hasEdge = this.boneEditor.selectedEdgeBoneId
      && this.boneRig.bones.some((bone) => bone.id === this.boneEditor.selectedEdgeBoneId);
    if (!hasEdge) this.boneEditor.selectedEdgeBoneId = null;
    if (!hasJoint) {
      const selectedBone = this.boneRig.bones.find((bone) => bone.id === this.boneEditor.selectedBoneId) || this.boneRig.bones[0] || null;
      this.boneEditor.selectedJointId = selectedBone?.endJointId || selectedBone?.startJointId || this.boneRig.joints[0]?.id || null;
    }
    const selectedBone = this.getBoneForSelectedJoint();
    this.boneEditor.selectedBoneId = selectedBone?.id || this.boneRig.bones[0]?.id || null;
  }

  getSelectedJoint() {
    this.ensureBoneNodeSelection();
    const jointId = this.boneEditor.selectedJointId;
    return this.boneRig.joints.find((joint) => joint.id === jointId) || null;
  }

  getBoneForSelectedJoint(jointId = this.boneEditor?.selectedJointId) {
    if (!jointId) return null;
    const downstream = this.boneRig.bones.find((bone) => bone.startJointId === jointId);
    if (downstream) return downstream;
    const incoming = this.boneRig.bones.find((bone) => bone.endJointId === jointId);
    if (incoming) return incoming;
    return this.boneRig.bones.find((bone) => bone.startJointId === jointId) || null;
  }

  getSelectedBone() {
    this.ensureBoneNodeSelection();
    return this.getBoneForSelectedJoint() || this.boneRig.bones.find((bone) => bone.id === this.boneEditor.selectedBoneId) || null;
  }

  getSelectedEdgeBone() {
    this.ensureBoneNodeSelection();
    if (!this.boneEditor) return null;
    return this.boneRig.bones.find((bone) => bone.id === this.boneEditor.selectedEdgeBoneId) || null;
  }

  getAffectedEdgeBones() {
    const selectedEdge = this.getSelectedEdgeBone();
    if (selectedEdge) return [selectedEdge];
    const jointId = this.boneEditor?.selectedJointId;
    const graph = jointId && typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : null;
    const outgoing = jointId
      ? (graph?.outgoingByJoint?.get(jointId) || this.boneRig.bones.filter((bone) => bone.startJointId === jointId))
      : [];
    if (outgoing.length) return outgoing;
    const selected = this.getSelectedBone();
    return selected ? [selected] : [];
  }

  getBoneEdgeModeDisplay(mode = 'rotate') {
    const displays = {
      rotate: { label: 'Rotate', marker: 'R', color: '#8df0ff' },
      fixed: { label: 'Locked', marker: 'K', color: '#ffe16a' },
      free: { label: 'Free', marker: 'F', color: '#ffffff' },
      stretch: { label: 'Stretch', marker: 'T', color: '#ff9f6a' },
      spring: { label: 'Spring', marker: 'S', color: '#82f59a' },
      slide: { label: 'Slide', marker: 'L', color: '#c6a5ff' },
      hinge: { label: 'Hinge', marker: 'H', color: '#6ad7ff' }
    };
    return displays[mode] || displays.rotate;
  }

  getAffectedEdgeSummary() {
    const affected = this.getAffectedEdgeBones();
    if (!affected.length) return null;
    const modes = new Set(affected.map((bone) => bone.jointMode || (bone.stretch ? 'stretch' : 'rotate')));
    const label = modes.size === 1 ? this.getBoneEdgeModeDisplay([...modes][0]).label : 'Mixed';
    return affected.length === 1 ? `1 edge: ${label}` : `${affected.length} outgoing edges: ${label}`;
  }

  getBoneAffectedPixelCountsForActiveLayer() {
    const cache = this.boneDerivedCache || { revision: 1, boneRevision: 1, affectedPixelCounts: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const layerIndex = this.canvasState?.activeLayerIndex ?? 0;
    const counts = cache.affectedPixelCounts;
    if (counts
      && counts.rig === this.boneRig
      && counts.boneRevision === boneRevision
      && counts.layerIndex === layerIndex) {
      return counts.values;
    }
    const values = getBoneAffectedPixelCounts(this.boneRig, layerIndex);
    cache.affectedPixelCounts = {
      rig: this.boneRig,
      boneRevision,
      layerIndex,
      values
    };
    return values;
  }

  getSelectedBoneAffectedPixelCount() {
    const selected = this.getSelectedBone();
    if (!selected) return 0;
    const counts = this.getBoneAffectedPixelCountsForActiveLayer();
    return counts[selected.id] || 0;
  }

  getSelectedBoneOwnerId() {
    this.ensureBoneNodeSelection();
    return this.boneEditor.selectedJointId || this.getSelectedBone()?.id || null;
  }

  ensureSelectedBoneVisible() {
    this.ensureBoneNodeSelection();
    const selectedIndex = this.boneRig.joints.findIndex((joint) => joint.id === this.boneEditor.selectedJointId);
    if (selectedIndex < 0) return;
    const visibleRows = this.boneListMeta
      ? Math.max(1, Math.floor((this.boneListMeta.scrollBounds?.h || 1) / Math.max(1, this.boneListMeta.lineHeight || 1)))
      : 1;
    if (selectedIndex < (this.focusScroll.bones || 0)) {
      this.focusScroll.bones = selectedIndex;
    } else if (selectedIndex >= (this.focusScroll.bones || 0) + visibleRows) {
      this.focusScroll.bones = Math.max(0, selectedIndex - visibleRows + 1);
    }
  }

  shouldShowBonePreview() {
    const mode = this.boneEditor?.mode;
    return Boolean(this.leftPanelTab === 'bones'
      && this.boneEditor.preview
      && this.boneRig?.bones?.length
      && this.boneRig?.bindings?.length
      && (mode === 'pose' || mode === 'time')
      && (this.boneEditor?.playing || mode === 'pose' || mode === 'time'));
  }

  shouldHideBoneOverlaysDuringPlayback() {
    return Boolean(this.leftPanelTab === 'bones'
      && this.boneEditor?.hideBonesDuringPlayback
      && this.boneEditor?.playing);
  }

  getDisplayedBonesForBoneEditor() {
    if (this.leftPanelTab !== 'bones') return this.boneRig?.bones || [];
    const mode = this.boneEditor?.mode;
    if (mode === 'pose' || mode === 'time') {
      const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, preview: null, raster: null, geometry: null };
      this.boneDerivedCache = cache;
      const boneRevision = cache.boneRevision ?? cache.revision;
      const poseSignature = this.getBonePoseCacheSignature();
      const geometry = cache.geometry;
      if (geometry
        && geometry.rig === this.boneRig
        && geometry.boneRevision === boneRevision
        && geometry.poseSignature === poseSignature) {
        return geometry.displayedBones;
      }
      const displayedBones = getPosedBoneGeometry(this.boneRig, this.getCurrentBonePreviewPose());
      cache.geometry = {
        rig: this.boneRig,
        boneRevision,
        poseSignature,
        displayedBones
      };
      return displayedBones;
    }
    return this.boneRig?.bones || [];
  }

  getDisplayedJointsForBoneEditor(displayedBones = this.getDisplayedBonesForBoneEditor()) {
    if (!this.boneRig?.joints?.length) return [];
    if (!['pose', 'time'].includes(this.boneEditor?.mode)) return this.boneRig.joints;
    const getDisplayedJointPoint = typeof this.getDisplayedJointPoint === 'function'
      ? this.getDisplayedJointPoint
      : (jointId, bones) => {
          const bone = bones.find((entry) => entry.startJointId === jointId || entry.endJointId === jointId);
          if (!bone) return null;
          return bone.startJointId === jointId ? bone.start : bone.end;
        };
    return this.boneRig.joints.map((joint) => {
      const displayed = getDisplayedJointPoint.call(this, joint.id, displayedBones);
      return displayed ? { ...joint, x: displayed.x, y: displayed.y } : joint;
    });
  }

  startBoneAddMode() {
    this.boneEditor.mode = 'bones';
    this.boneEditor.linkMode = true;
    this.boneEditor.pendingBindNodeTap = null;
    this.boneEditor.chainAnchor = this.getBoneChainAnchorFromSelection();
    this.boneEditor.drag = null;
    this.setInputMode('canvas');
    this.statusMessage = this.boneEditor.chainAnchor
      ? 'Tap to add a linked bone, or drag to create one'
      : 'Tap once to set a start point, then tap again to add linked bones';
  }

  toggleBoneLinkMode() {
    this.boneEditor.mode = 'bones';
    this.boneEditor.pendingBindNodeTap = null;
    this.boneEditor.linkMode = !this.boneEditor.linkMode;
    this.boneEditor.chainAnchor = this.boneEditor.linkMode ? this.getBoneChainAnchorFromSelection() : null;
    this.statusMessage = this.boneEditor.linkMode ? 'Linked bone creation on' : 'Linked bone creation off';
  }

  cycleSelectionCombineMode() {
    const modes = ['replace', 'add', 'subtract'];
    const current = modes.indexOf(this.selection.combineMode || 'replace');
    this.selection.combineMode = modes[(current + 1 + modes.length) % modes.length];
  }

  getBoneChainAnchorFromSelection(handle = 'end') {
    this.ensureBoneNodeSelection();
    const joint = this.getSelectedJoint();
    const bone = this.getSelectedBone();
    if (!joint) return null;
    return { boneId: bone?.id || null, jointId: joint.id, handle, x: joint.x, y: joint.y };
  }

  setBoneChainAnchor(bone, handle = 'end') {
    if (!bone) {
      this.boneEditor.chainAnchor = null;
      this.boneEditor.selectedEdgeBoneId = null;
      this.boneEditor.selectionSource = null;
      return;
    }
    const point = handle === 'start' ? bone.start : bone.end;
    const jointId = handle === 'start' ? bone.startJointId : bone.endJointId;
    this.boneEditor.selectedJointId = jointId;
    this.boneEditor.selectedBoneId = bone.id;
    this.boneEditor.selectedEdgeBoneId = null;
    this.boneEditor.selectionSource = null;
    this.boneEditor.chainAnchor = { boneId: bone.id, jointId, handle, x: point.x, y: point.y };
  }

  setBoneJointSelection(jointId, displayedPoint = null) {
    if (!jointId) return false;
    const joint = this.boneRig.joints.find((entry) => entry.id === jointId);
    if (!joint) return false;
    const getBoneForJoint = typeof this.getBoneForSelectedJoint === 'function'
      ? this.getBoneForSelectedJoint
      : PixelStudio.prototype.getBoneForSelectedJoint;
    const bone = getBoneForJoint.call(this, jointId) || this.boneRig.bones[0] || null;
    const point = displayedPoint || joint;
    this.boneEditor.selectedJointId = joint.id;
    this.boneEditor.selectedBoneId = bone?.id || null;
    this.boneEditor.selectedEdgeBoneId = null;
    this.boneEditor.selectionSource = null;
    this.boneEditor.chainAnchor = {
      boneId: bone?.id || null,
      jointId: joint.id,
      handle: bone?.startJointId === joint.id ? 'start' : 'end',
      x: point.x,
      y: point.y
    };
    return true;
  }

  createLinkedBoneFromAnchor(end) {
    const anchor = this.boneEditor.chainAnchor;
    if (!anchor) return false;
    const start = { x: anchor.x, y: anchor.y };
    if (Math.hypot(end.x - start.x, end.y - start.y) < 0.5) return false;
    this.startHistory('add linked bone', { includeLayers: false });
    const result = createBone(this.boneRig, start, end, { parentId: anchor.boneId || null, startJointId: anchor.jointId || null });
    this.boneRig = result.rig;
    this.setBoneChainAnchor(result.bone, 'end');
    this.ensureSelectedBoneVisible();
    this.commitHistory();
    return true;
  }

  bindActiveLayerToSelectedBone() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId || !this.activeLayer) return;
    this.startHistory('bind layer to bone', { includeLayers: false });
    this.boneRig = createLayerBinding(
      this.boneRig,
      this.canvasState.activeLayerIndex,
      [ownerId],
      this.canvasState.width,
      this.canvasState.height,
      this.activeLayer.pixels
    );
    this.commitHistory();
    this.finishBoneBindingAction();
  }

  bindSelectionToSelectedBone() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId || !this.selection.active || !this.selection.mask) return;
    const filterRigMask = typeof this.filterMaskToActiveLayerOpaque === 'function'
      ? this.filterMaskToActiveLayerOpaque
      : PixelStudio.prototype.filterMaskToActiveLayerOpaque;
    const mask = filterRigMask.call(this, this.selection.mask);
    if (!this.getMaskBounds(mask)) return;
    this.startHistory('bind selection to bone', { includeLayers: false });
    this.boneRig = createSelectionBinding(
      this.boneRig,
      this.canvasState.activeLayerIndex,
      [ownerId],
      mask,
      this.canvasState.width,
      this.canvasState.height
    );
    this.commitHistory();
    this.finishBoneBindingAction();
  }

  addSelectionToSelectedBone() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId || !this.selection.active || !this.selection.mask) return;
    const filterRigMask = typeof this.filterMaskToActiveLayerOpaque === 'function'
      ? this.filterMaskToActiveLayerOpaque
      : PixelStudio.prototype.filterMaskToActiveLayerOpaque;
    const mask = filterRigMask.call(this, this.selection.mask);
    if (!this.getMaskBounds(mask)) return;
    this.startHistory('add pixels to bone', { includeLayers: false });
    this.boneRig = addMaskToBoneBinding(
      this.boneRig,
      this.canvasState.activeLayerIndex,
      ownerId,
      mask,
      this.canvasState.width,
      this.canvasState.height
    );
    this.commitHistory();
    this.finishBoneBindingAction();
  }

  removeSelectionFromSelectedBone() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId || !this.selection.active || !this.selection.mask) return;
    const filterRigMask = typeof this.filterMaskToActiveLayerOpaque === 'function'
      ? this.filterMaskToActiveLayerOpaque
      : PixelStudio.prototype.filterMaskToActiveLayerOpaque;
    const mask = filterRigMask.call(this, this.selection.mask);
    if (!this.getMaskBounds(mask)) return;
    this.startHistory('remove pixels from bone', { includeLayers: false });
    this.boneRig = removeMaskFromBoneBinding(
      this.boneRig,
      this.canvasState.activeLayerIndex,
      ownerId,
      mask
    );
    this.commitHistory();
    this.finishBoneBindingAction();
  }

  getActiveLayerAssignedRigMask() {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const layerIndex = this.canvasState.activeLayerIndex;
    const mask = new Uint8Array(width * height);
    (this.boneRig?.bindings || []).forEach((binding) => {
      if (binding.layerIndex !== layerIndex) return;
      (binding.pixels || []).forEach((pixel) => {
        if (pixel.index >= 0 && pixel.index < mask.length) mask[pixel.index] = 1;
      });
    });
    return mask;
  }

  selectUnassignedRigPixels() {
    const layerPixels = this.canvasState?.layers?.[this.canvasState?.activeLayerIndex || 0]?.pixels;
    if (!layerPixels) return;
    const assigned = this.getActiveLayerAssignedRigMask();
    const mask = new Uint8Array(layerPixels.length);
    for (let index = 0; index < layerPixels.length; index += 1) {
      if (layerPixels[index] && !assigned[index]) mask[index] = 1;
    }
    this.setSelectionMask(mask);
    if (!this.selection.active) {
      this.statusMessage = 'No unassigned visible pixels on this layer';
      return;
    }
    this.boneEditor.mode = 'bind';
    this.ensureBindSelectionTool();
    this.statusMessage = 'Selected unassigned visible pixels';
  }

  getRigOwnerDepths() {
    const graph = buildBoneGraph(this.boneRig);
    const jointDepths = new Map();
    const incomingCounts = new Map();
    graph.rig.joints.forEach((joint) => incomingCounts.set(joint.id, 0));
    graph.rig.bones.forEach((bone) => {
      incomingCounts.set(bone.endJointId, (incomingCounts.get(bone.endJointId) || 0) + 1);
    });
    const queue = graph.rig.joints
      .filter((joint) => !incomingCounts.get(joint.id))
      .map((joint) => {
        jointDepths.set(joint.id, 0);
        return joint.id;
      });
    if (!queue.length && graph.rig.joints[0]) {
      jointDepths.set(graph.rig.joints[0].id, 0);
      queue.push(graph.rig.joints[0].id);
    }
    for (let index = 0; index < queue.length; index += 1) {
      const jointId = queue[index];
      const depth = jointDepths.get(jointId) || 0;
      (graph.outgoingByJoint.get(jointId) || []).forEach((bone) => {
        const nextDepth = depth + 1;
        if (!jointDepths.has(bone.endJointId) || nextDepth < jointDepths.get(bone.endJointId)) {
          jointDepths.set(bone.endJointId, nextDepth);
          queue.push(bone.endJointId);
        }
      });
    }
    const ownerDepths = new Map();
    graph.rig.joints.forEach((joint) => ownerDepths.set(joint.id, jointDepths.get(joint.id) || 0));
    graph.rig.bones.forEach((bone) => {
      ownerDepths.set(bone.id, jointDepths.get(bone.endJointId) ?? ((jointDepths.get(bone.startJointId) || 0) + 1));
    });
    return ownerDepths;
  }

  getRigOwnerLayerName(ownerId) {
    const jointIndex = this.boneRig.joints.findIndex((joint) => joint.id === ownerId);
    if (jointIndex >= 0) {
      const joint = this.boneRig.joints[jointIndex];
      return joint.name || `Node ${jointIndex + 1}`;
    }
    const boneIndex = this.boneRig.bones.findIndex((bone) => bone.id === ownerId);
    if (boneIndex >= 0) {
      const bone = this.boneRig.bones[boneIndex];
      return bone.name || `Bone ${boneIndex + 1}`;
    }
    return `Rig ${ownerId}`;
  }

  toggleReverseRigLayerOrder() {
    this.boneEditor.reverseRigLayerOrder = !this.boneEditor.reverseRigLayerOrder;
  }

  convertRigAssignmentsToLayers() {
    const layerPixels = this.canvasState?.layers?.[this.canvasState?.activeLayerIndex || 0]?.pixels;
    if (!layerPixels) return;
    const layerIndex = this.canvasState.activeLayerIndex;
    const ownerPixels = new Map();
    (this.boneRig?.bindings || []).forEach((binding) => {
      if (binding.layerIndex !== layerIndex) return;
      (binding.pixels || []).forEach((pixel) => {
        if (!layerPixels[pixel.index]) return;
        const weights = pixel.weights || {};
        const ownerIds = Object.keys(weights).filter((ownerId) => weights[ownerId] > 0);
        if (!ownerIds.length) ownerIds.push(...(binding.boneIds || []));
        ownerIds.forEach((ownerId) => {
          if (!ownerPixels.has(ownerId)) ownerPixels.set(ownerId, new Set());
          ownerPixels.get(ownerId).add(pixel.index);
        });
      });
    });
    if (!ownerPixels.size) {
      this.statusMessage = 'No visible rig assignments on this layer';
      return;
    }
    const ownerDepths = this.getRigOwnerDepths();
    const owners = [...ownerPixels.keys()].sort((a, b) => {
      const depthDelta = (ownerDepths.get(a) || 0) - (ownerDepths.get(b) || 0);
      if (depthDelta) return this.boneEditor.reverseRigLayerOrder ? -depthDelta : depthDelta;
      return this.getRigOwnerLayerName(a).localeCompare(this.getRigOwnerLayerName(b));
    });
    const nextLayers = owners.map((ownerId) => {
      const layer = createLayer(this.canvasState.width, this.canvasState.height, this.getRigOwnerLayerName(ownerId));
      ownerPixels.get(ownerId).forEach((index) => {
        layer.pixels[index] = layerPixels[index];
      });
      return layer;
    });
    const nextBindings = owners.map((ownerId, nextLayerIndex) => ({
      id: `binding-${Date.now().toString(36)}-${nextLayerIndex + 1}`,
      type: 'selection',
      layerIndex: nextLayerIndex,
      boneIds: [ownerId],
      skinningMode: 'rigid-layer',
      pixels: [...ownerPixels.get(ownerId)]
        .sort((a, b) => a - b)
        .map((index) => ({ index, weights: { [ownerId]: 1 } })),
      name: this.getRigOwnerLayerName(ownerId)
    }));
    this.startHistory('convert rig to layers');
    this.boneRig = {
      ...cloneBoneRig(this.boneRig),
      bindings: nextBindings
    };
    this.currentFrame.layers = nextLayers;
    this.canvasState.activeLayerIndex = clamp(this.canvasState.activeLayerIndex, 0, nextLayers.length - 1);
    this.setFrameLayers(nextLayers);
    this.commitHistory();
    this.statusMessage = `Converted rig assignments to ${nextLayers.length} layers`;
  }

  clearSelectedBoneBindings() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId) return;
    this.startHistory('clear bone bindings', { includeLayers: false });
    this.boneRig = {
      ...cloneBoneRig(this.boneRig),
      bindings: this.boneRig.bindings.filter((binding) => !binding.boneIds.includes(ownerId))
    };
    this.commitHistory();
    this.finishBoneBindingAction();
  }

  reverseSelectedBoneDirection() {
    const bone = this.getSelectedEdgeBone() || this.getSelectedBone();
    if (!bone) return;
    this.startHistory('reverse bone direction', { includeLayers: false });
    this.boneRig = reverseBoneDirection(this.boneRig, bone.id);
    const reversed = this.boneRig.bones.find((entry) => entry.id === bone.id);
    if (reversed) {
      this.setBoneChainAnchor(reversed, 'start');
      this.boneEditor.selectedEdgeBoneId = reversed.id;
    }
    this.commitHistory();
  }

  cycleSelectedBoneEdgeMode() {
    const affectedEdges = this.getAffectedEdgeBones();
    if (!affectedEdges.length) return;
    this.startHistory('set bone edge mode', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    const targetIds = new Set(affectedEdges.map((bone) => bone.id));
    const modes = ['rotate', 'fixed', 'free', 'stretch', 'spring', 'slide', 'hinge'];
    const currentModes = new Set(affectedEdges.map((bone) => bone.jointMode || (bone.stretch ? 'stretch' : 'rotate')));
    const current = currentModes.size === 1 ? [...currentModes][0] : 'rotate';
    const nextMode = modes[(modes.indexOf(current) + 1 + modes.length) % modes.length];
    next.bones.forEach((target) => {
      if (!targetIds.has(target.id)) return;
      target.jointMode = nextMode;
      target.stretch = nextMode === 'stretch';
      target.jointModeVersion = 2;
      target.jointSettings = target.jointSettings || { stiffness: 0.5, minAngle: -Math.PI, maxAngle: Math.PI };
    });
    this.boneRig = next;
    this.commitHistory();
  }

  toggleSelectedBoneIk() {
    const affectedEdges = this.getAffectedEdgeBones();
    if (!affectedEdges.length) return;
    this.startHistory('toggle bone ik', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    const targetIds = new Set(affectedEdges.map((bone) => bone.id));
    const enable = affectedEdges.some((bone) => bone.jointSettings?.ikEnabled === false);
    next.bones.forEach((target) => {
      if (!targetIds.has(target.id)) return;
      target.jointSettings = {
        stiffness: 0.5,
        minAngle: -Math.PI,
        maxAngle: Math.PI,
        ...(target.jointSettings || {}),
        ikEnabled: enable
      };
    });
    this.boneRig = next;
    this.commitHistory();
  }

  finishBoneBindingAction() {
    this.boneEditor.pendingBindNodeTap = null;
    this.clearSelection();
    if (this.boneEditor.mode === 'bind') {
      this.ensureBindSelectionTool();
    }
  }

  resetSelectedBonePose() {
    if (!this.getSelectedBone()) return;
    const timeMs = this.boneEditor.timeMs || 0;
    const bones = Object.fromEntries((this.boneRig?.bones || []).map((bone) => [
      bone.id,
      { angle: 0, dx: 0, dy: 0, scale: 1 }
    ]));
    const nodes = Object.fromEntries((this.boneRig?.joints || []).map((joint) => [
      joint.id,
      { angle: 0 }
    ]));
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig({ timeMs, bones, nodes })
      : constrainSharedJointPose(this.boneRig, { timeMs, bones, nodes });
    this.startHistory('reset bone pose', { includeLayers: false });
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, constrained.bones, constrained.nodes);
    this.boneEditor.previewPose = null;
    this.boneEditor.previewPoseTimeMs = null;
    this.boneEditor.previewPoseSignature = null;
    this.commitHistory();
  }

  copyCurrentBonePose() {
    if (!this.getSelectedBone()) return;
    const snapshot = this.getFullBoneTimelinePoseSnapshot(this.boneEditor.timeMs || 0);
    this.bonePoseClipboard = {
      bones: Object.fromEntries(Object.entries(snapshot.bones || {}).map(([id, pose]) => [id, { ...pose }])),
      nodes: Object.fromEntries(Object.entries(snapshot.nodes || {}).map(([id, pose]) => [id, { ...pose }]))
    };
    this.statusMessage = 'Pose copied';
  }

  pasteCopiedBonePose() {
    if (!this.getSelectedBone() || !this.bonePoseClipboard) return;
    const timeMs = this.boneEditor.timeMs || 0;
    const validBoneIds = new Set((this.boneRig?.bones || []).map((bone) => bone.id));
    const validJointIds = new Set((this.boneRig?.joints || []).map((joint) => joint.id));
    const bones = Object.fromEntries(Object.entries(this.bonePoseClipboard.bones || {})
      .filter(([id]) => validBoneIds.has(id))
      .map(([id, pose]) => [id, { ...pose }]));
    const nodes = Object.fromEntries(Object.entries(this.bonePoseClipboard.nodes || {})
      .filter(([id]) => validJointIds.has(id))
      .map(([id, pose]) => [id, { ...pose }]));
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig({ timeMs, bones, nodes })
      : constrainSharedJointPose(this.boneRig, { timeMs, bones, nodes });
    this.startHistory('paste bone pose', { includeLayers: false });
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, constrained.bones, constrained.nodes);
    this.boneEditor.previewPose = null;
    this.boneEditor.previewPoseTimeMs = null;
    this.boneEditor.previewPoseSignature = null;
    this.statusMessage = 'Pose pasted';
    this.commitHistory();
  }

  selectAdjacentBone(delta) {
    if (!this.boneRig.joints.length) return;
    this.ensureBoneNodeSelection();
    const current = Math.max(0, this.boneRig.joints.findIndex((joint) => joint.id === this.boneEditor.selectedJointId));
    const next = (current + delta + this.boneRig.joints.length) % this.boneRig.joints.length;
    const joint = this.boneRig.joints[next];
    const bone = this.getBoneForSelectedJoint(joint.id);
    this.boneEditor.selectedJointId = joint.id;
    this.boneEditor.selectedBoneId = bone?.id || null;
    this.boneEditor.chainAnchor = { boneId: bone?.id || null, jointId: joint.id, handle: 'end', x: joint.x, y: joint.y };
  }

  getBoneTimelineDurationMs() {
    return getPixelBoneTimelineDurationMs(this.boneRig?.poseTimeline || [], this.boneEditor);
  }

  getBoneBakeFrameCount() {
    const explicit = Math.round(Number(this.boneEditor?.bakeFrameCount) || 0);
    if (explicit > 0) return explicit;
    return Math.max(1, getPixelBoneBakeSampleTimes(this.boneRig?.poseTimeline || []).length);
  }

  getBoneBakeSampleTimes() {
    const explicit = Math.round(Number(this.boneEditor?.bakeFrameCount) || 0);
    if (explicit <= 0) return getPixelBoneBakeSampleTimes(this.boneRig?.poseTimeline || []);
    const durationMs = Math.max(1, Math.round(this.getBoneTimelineDurationMs()));
    const denominator = Math.max(1, explicit - 1);
    const sampleTimes = [];
    for (let index = 0; index < explicit; index += 1) {
      sampleTimes.push(explicit <= 1 ? 0 : Math.round((durationMs * index) / denominator));
    }
    return sampleTimes;
  }

  getBoneBakeFrameDurationMs(sampleTimes, index, fallbackMs = DEFAULT_FRAME_DURATION_MS) {
    const timeMs = Number(sampleTimes?.[index]);
    const nextTimeMs = Number(sampleTimes?.[index + 1]);
    if (Number.isFinite(timeMs) && Number.isFinite(nextTimeMs)) {
      return Math.max(1, Math.round(nextTimeMs - timeMs));
    }
    return Math.max(1, Math.round(Number(fallbackMs) || DEFAULT_FRAME_DURATION_MS));
  }

  renderBonePreviewBakeFrame(timeMs, durationMs, index, context = {}) {
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const layers = this.canvasState.layers || this.currentFrame?.layers || [];
    const rigContext = context.rigContext || (typeof this.getCachedBoneRigContext === 'function'
      ? this.getCachedBoneRigContext()
      : { normalizedRig: normalizeBoneRig(this.boneRig, { exclusive: false }), graph: buildBoneGraph(normalizeBoneRig(this.boneRig, { exclusive: false })) });
    const pose = samplePoseTimeline(rigContext.normalizedRig || this.boneRig, timeMs);
    const pixels = compositeBonePreview(layers, width, height, this.boneRig, pose, {
      meshCache: context.meshCache || new Map(),
      normalizedRig: rigContext.normalizedRig,
      graph: rigContext.graph
    });
    const layer = createLayer(width, height, `Baked Pose ${index + 1}`);
    layer.pixels.set(pixels);
    return createFrame([layer], durationMs);
  }

  toggleHideBonesDuringPlayback() {
    this.boneEditor.hideBonesDuringPlayback = !this.boneEditor.hideBonesDuringPlayback;
  }

  async promptBoneBakeFrameCount() {
    const current = this.getBoneBakeFrameCount();
    const raw = await openTextInputOverlay({
      title: 'Bake Frame Count',
      label: 'Frames to render when baked:',
      initialValue: String(current),
      inputType: 'number'
    });
    if (raw == null) return;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value <= 0) return;
    this.boneEditor.bakeFrameCount = clamp(value, 1, 4096);
  }

  async promptBoneTimelineLength() {
    const current = Math.round(this.getBoneTimelineDurationMs());
    const raw = await openTextInputOverlay({
      title: 'Pose Timeline Length',
      label: 'Length, e.g. 1500ms or 1.5s:',
      initialValue: `${current}ms`,
      inputType: 'text'
    });
    if (raw == null) return;
    const value = this.parseTimelineDurationMs(raw, current);
    if (!Number.isFinite(value) || value <= 0) return;
    this.boneEditor.durationMs = Math.max(this.boneEditor.segmentMs || DEFAULT_BONE_TIMELINE_STEP_MS, Math.round(value));
    this.boneEditor.timeMs = clamp(this.boneEditor.timeMs || 0, 0, this.getBoneTimelineDurationMs());
    this.boneEditor.playing = false;
  }

  parseTimelineDurationMs(raw, fallbackMs = 500) {
    const text = String(raw || '').trim().toLowerCase();
    if (!text) return fallbackMs;
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds)?$/);
    if (!match) return fallbackMs;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return fallbackMs;
    const unit = match[2] || 'ms';
    return unit === 'ms' ? value : value * 1000;
  }

  getCurrentBoneTimelineKey() {
    return getPoseKeyAtTime(this.boneRig, this.boneEditor.timeMs || 0);
  }

  getCurrentBonePreviewPose() {
    if (this.boneEditor?.previewPose && this.boneEditor.previewPoseTimeMs === (this.boneEditor.timeMs || 0)) {
      return this.boneEditor.previewPose;
    }
    return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
  }

  constrainBonePoseForCurrentRig(pose = {}) {
    const rigContext = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext()
      : { normalizedRig: normalizeBoneSkeleton(this.boneRig), graph: buildBoneGraph(this.boneRig) };
    return constrainSharedJointPose(rigContext.normalizedRig, pose, { graph: rigContext.graph }).bones;
  }

  constrainPoseForCurrentRig(pose = {}) {
    const rigContext = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext()
      : { normalizedRig: normalizeBoneSkeleton(this.boneRig), graph: buildBoneGraph(this.boneRig) };
    return constrainSharedJointPose(rigContext.normalizedRig, pose, { graph: rigContext.graph });
  }

  getFullBoneTimelinePoseSnapshot(timeMs = this.boneEditor?.timeMs || 0, basePose = null) {
    const sampled = basePose || samplePoseTimeline(this.boneRig, timeMs);
    const bones = {};
    (this.boneRig?.bones || []).forEach((bone) => {
      const pose = sampled.bones?.[bone.id] || {};
      bones[bone.id] = {
        angle: Number.isFinite(pose.angle) ? pose.angle : 0,
        dx: Number.isFinite(pose.dx) ? pose.dx : 0,
        dy: Number.isFinite(pose.dy) ? pose.dy : 0,
        scale: Number.isFinite(pose.scale) ? Math.max(0.05, pose.scale) : 1
      };
    });
    const nodes = {};
    (this.boneRig?.joints || []).forEach((joint) => {
      const pose = sampled.nodes?.[joint.id] || {};
      nodes[joint.id] = {
        angle: Number.isFinite(pose.angle) ? pose.angle : 0
      };
    });
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig({ timeMs, bones, nodes })
      : constrainSharedJointPose(this.boneRig, { timeMs, bones, nodes });
    return {
      timeMs,
      bones: constrained.bones,
      nodes: constrained.nodes
    };
  }

  setBonePosePatchAtCurrentTime(boneId, posePatch = {}) {
    const timeMs = this.boneEditor.timeMs || 0;
    const pose = samplePoseTimeline(this.boneRig, timeMs);
    const previous = pose.bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
    pose.bones[boneId] = {
      angle: Number.isFinite(posePatch.angle) ? posePatch.angle : previous.angle,
      dx: Number.isFinite(posePatch.dx) ? posePatch.dx : previous.dx,
      dy: Number.isFinite(posePatch.dy) ? posePatch.dy : previous.dy,
      scale: Number.isFinite(posePatch.scale) ? Math.max(0.05, posePatch.scale) : previous.scale
    };
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig(pose)
      : constrainSharedJointPose(this.boneRig, pose);
    pose.bones = constrained.bones;
    pose.nodes = constrained.nodes;
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, pose.bones, pose.nodes);
  }

  setBonePosePatchesAtCurrentTime(patches = {}) {
    const timeMs = this.boneEditor.timeMs || 0;
    const pose = samplePoseTimeline(this.boneRig, timeMs);
    Object.entries(patches).forEach(([boneId, posePatch]) => {
      const previous = pose.bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
      pose.bones[boneId] = {
        angle: Number.isFinite(posePatch?.angle) ? posePatch.angle : previous.angle,
        dx: Number.isFinite(posePatch?.dx) ? posePatch.dx : previous.dx,
        dy: Number.isFinite(posePatch?.dy) ? posePatch.dy : previous.dy,
        scale: Number.isFinite(posePatch?.scale) ? Math.max(0.05, posePatch.scale) : previous.scale
      };
    });
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig(pose)
      : constrainSharedJointPose(this.boneRig, pose);
    pose.bones = constrained.bones;
    pose.nodes = constrained.nodes;
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, pose.bones, pose.nodes);
  }

  setNodePosePatchesAtCurrentTime(patches = {}) {
    const timeMs = this.boneEditor.timeMs || 0;
    const pose = samplePoseTimeline(this.boneRig, timeMs);
    pose.nodes = { ...(pose.nodes || {}) };
    Object.entries(patches).forEach(([jointId, posePatch]) => {
      const previous = pose.nodes[jointId] || { angle: 0 };
      pose.nodes[jointId] = {
        angle: Number.isFinite(posePatch?.angle) ? posePatch.angle : previous.angle
      };
    });
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig(pose)
      : constrainSharedJointPose(this.boneRig, pose);
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, constrained.bones, constrained.nodes);
  }

  setBonePreviewPosePatchesAtCurrentTime(patches = {}, options = {}) {
    if (!(this instanceof PixelStudio)) {
      const hasOwnPatches = Object.prototype.hasOwnProperty.call(this, 'setBonePosePatchesAtCurrentTime');
      const hasOwnPatch = Object.prototype.hasOwnProperty.call(this, 'setBonePosePatchAtCurrentTime');
      const entries = Object.entries(patches);
      if (entries.length === 1 && hasOwnPatch) {
        const [boneId, patch] = entries[0];
        this.setBonePosePatchAtCurrentTime(boneId, patch);
        return;
      }
      if (hasOwnPatches) {
        this.setBonePosePatchesAtCurrentTime(patches);
        return;
      }
    }
    const timeMs = this.boneEditor.timeMs || 0;
    if (this.boneEditor?.drag?.type === 'pose') {
      this.boneEditor.drag.previewPatchBoneIds = Object.keys(patches || {});
    }
    const sourcePose = options.basePose || this.boneEditor?.drag?.basePose || samplePoseTimeline(this.boneRig, timeMs);
    const pose = {
      ...sourcePose,
      bones: { ...(sourcePose.bones || {}) },
      nodes: { ...(sourcePose.nodes || {}) }
    };
    Object.entries(patches).forEach(([boneId, posePatch]) => {
      const previous = pose.bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
      pose.bones[boneId] = {
        angle: Number.isFinite(posePatch?.angle) ? posePatch.angle : previous.angle,
        dx: Number.isFinite(posePatch?.dx) ? posePatch.dx : previous.dx,
        dy: Number.isFinite(posePatch?.dy) ? posePatch.dy : previous.dy,
        scale: Number.isFinite(posePatch?.scale) ? Math.max(0.05, posePatch.scale) : previous.scale
      };
    });
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig(pose)
      : constrainSharedJointPose(this.boneRig, pose);
    pose.bones = constrained.bones;
    pose.nodes = constrained.nodes;
    const previousSignature = this.boneEditor.previewPose
      ? JSON.stringify({ bones: this.boneEditor.previewPose.bones || {}, nodes: this.boneEditor.previewPose.nodes || {} })
      : '';
    const nextSignature = JSON.stringify({ bones: pose.bones || {}, nodes: pose.nodes || {} });
    if (previousSignature === nextSignature && this.boneEditor.previewPoseTimeMs === timeMs) return;
    this.boneEditor.previewPose = pose;
    this.boneEditor.previewPoseTimeMs = timeMs;
    this.boneEditor.previewPoseSignature = nextSignature;
  }

  setBonePreviewPosePatchAtCurrentTime(boneId, posePatch = {}) {
    const setPreviewPatches = typeof this.setBonePreviewPosePatchesAtCurrentTime === 'function'
      ? this.setBonePreviewPosePatchesAtCurrentTime
      : PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime;
    setPreviewPatches.call(this, { [boneId]: posePatch });
  }

  setNodePreviewPosePatchesAtCurrentTime(patches = {}, options = {}) {
    if (!(this instanceof PixelStudio) && Object.prototype.hasOwnProperty.call(this, 'setNodePosePatchesAtCurrentTime')) {
      this.setNodePosePatchesAtCurrentTime(patches);
      return;
    }
    const timeMs = this.boneEditor.timeMs || 0;
    if (this.boneEditor?.drag?.type === 'pose') {
      this.boneEditor.drag.previewPatchJointIds = Object.keys(patches || {});
    }
    const sourcePose = options.basePose || this.boneEditor?.drag?.basePose || samplePoseTimeline(this.boneRig, timeMs);
    const pose = {
      ...sourcePose,
      bones: { ...(sourcePose.bones || {}) },
      nodes: { ...(sourcePose.nodes || {}) }
    };
    Object.entries(patches).forEach(([jointId, posePatch]) => {
      const previous = pose.nodes[jointId] || { angle: 0 };
      pose.nodes[jointId] = {
        angle: Number.isFinite(posePatch?.angle) ? posePatch.angle : previous.angle
      };
    });
    const constrained = this.constrainPoseForCurrentRig
      ? this.constrainPoseForCurrentRig(pose)
      : constrainSharedJointPose(this.boneRig, pose);
    pose.bones = constrained.bones;
    pose.nodes = constrained.nodes;
    const previousSignature = this.boneEditor.previewPose
      ? JSON.stringify({ bones: this.boneEditor.previewPose.bones || {}, nodes: this.boneEditor.previewPose.nodes || {} })
      : '';
    const nextSignature = JSON.stringify({ bones: pose.bones || {}, nodes: pose.nodes || {} });
    if (previousSignature === nextSignature && this.boneEditor.previewPoseTimeMs === timeMs) return;
    this.boneEditor.previewPose = pose;
    this.boneEditor.previewPoseTimeMs = timeMs;
    this.boneEditor.previewPoseSignature = nextSignature;
  }

  setBoneTimelineKey() {
    const selected = this.getSelectedBone();
    if (!selected) return;
    this.startHistory('set bone key', { includeLayers: false });
    const timeMs = this.boneEditor.timeMs || 0;
    const snapshot = this.getFullBoneTimelinePoseSnapshot(timeMs);
    this.boneRig = setPoseKeyAtTime(this.boneRig, timeMs, snapshot.bones, snapshot.nodes);
    this.boneEditor.previewPose = null;
    this.boneEditor.previewPoseTimeMs = null;
    this.boneEditor.previewPoseSignature = null;
    this.commitHistory();
  }

  deleteBoneTimelineKey() {
    if (!this.getCurrentBoneTimelineKey()) return;
    this.startHistory('delete bone key', { includeLayers: false });
    this.boneRig = removePoseKeyAtTime(this.boneRig, this.boneEditor.timeMs || 0);
    this.commitHistory();
  }

  moveBoneTimelineKey(delta) {
    const timeline = this.boneRig.poseTimeline || [];
    if (!timeline.length) return;
    const currentTime = Number(this.boneEditor.timeMs || 0);
    const sorted = timeline.slice().sort((a, b) => a.timeMs - b.timeMs);
    let index = sorted.findIndex((key) => key.timeMs >= currentTime);
    if (index < 0) index = sorted.length - 1;
    if (delta < 0 && sorted[index]?.timeMs >= currentTime && index > 0) index -= 1;
    if (delta > 0 && sorted[index]?.timeMs <= currentTime && index < sorted.length - 1) index += 1;
    this.boneEditor.timeMs = sorted[clamp(index, 0, sorted.length - 1)].timeMs;
    this.boneEditor.playing = false;
  }

  nudgeBoneTime(deltaMs) {
    this.boneEditor.playing = false;
    this.boneEditor.timeMs = clamp(
      Math.round(Number(this.boneEditor.timeMs || 0) + Number(deltaMs || 0)),
      0,
      Math.max(this.getBoneTimelineDurationMs(), this.boneEditor.segmentMs || DEFAULT_BONE_TIMELINE_STEP_MS)
    );
  }

  toggleBoneTimelinePlayback() {
    if (this.boneEditor.playing) {
      this.boneEditor.playing = false;
      return;
    }
    if ((this.boneEditor.timeMs || 0) >= this.getBoneTimelineDurationMs()) this.boneEditor.timeMs = 0;
    this.boneEditor.playing = true;
    this.animation.playing = false;
  }

  moveBoneOrder(boneId, delta) {
    const id = String(boneId || '');
    const fromIndex = this.boneRig.bones.findIndex((bone) => bone.id === id);
    if (fromIndex < 0) return;
    const toIndex = clamp(fromIndex + Math.sign(delta || 0), 0, this.boneRig.bones.length - 1);
    if (toIndex === fromIndex) return;
    this.startHistory('reorder bones', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    const [bone] = next.bones.splice(fromIndex, 1);
    next.bones.splice(toIndex, 0, bone);
    this.boneRig = next;
    this.boneEditor.selectedBoneId = id;
    this.boneEditor.selectedEdgeBoneId = id;
    this.boneEditor.selectedJointId = bone.endJointId || bone.startJointId || this.boneEditor.selectedJointId;
    this.boneEditor.chainAnchor = {
      boneId: id,
      jointId: this.boneEditor.selectedJointId,
      handle: 'end',
      x: bone.end?.x || 0,
      y: bone.end?.y || 0
    };
    this.commitHistory();
    this.statusMessage = `${bone.name || 'Bone'} order ${toIndex > fromIndex ? 'down' : 'up'}: lower bones draw on top`;
  }

  async renameSelectedBone() {
    const bone = this.getSelectedBone();
    if (!bone) return;
    const raw = await openTextInputOverlay({
      title: 'Rename Bone',
      label: 'Bone name:',
      initialValue: bone.name || 'Bone',
      inputType: 'text'
    });
    const name = raw?.trim();
    if (!name) return;
    this.startHistory('rename bone', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    const target = next.bones.find((entry) => entry.id === bone.id);
    if (target) target.name = name;
    this.boneRig = next;
    this.commitHistory();
  }

  async renameSelectedBoneNode(jointId = this.boneEditor?.selectedJointId) {
    const joint = this.boneRig.joints.find((entry) => entry.id === jointId);
    if (!joint) return;
    const nodeIndex = this.boneRig.joints.findIndex((entry) => entry.id === joint.id) + 1;
    const raw = await openTextInputOverlay({
      title: 'Rename Node',
      label: 'Node name:',
      initialValue: joint.name || `Node ${nodeIndex}`,
      inputType: 'text'
    });
    const name = raw?.trim();
    if (!name) return;
    this.startHistory('rename bone node', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    const target = next.joints.find((entry) => entry.id === joint.id);
    if (target) target.name = name;
    this.boneRig = next;
    this.boneEditor.selectedJointId = joint.id;
    const bone = this.getBoneForSelectedJoint(joint.id);
    this.boneEditor.selectedBoneId = bone?.id || null;
    this.boneEditor.selectedEdgeBoneId = null;
    this.commitHistory();
  }

  deleteSelectedBone() {
    const selectedEdge = this.getSelectedEdgeBone();
    if (selectedEdge) {
      this.startHistory('delete bone edge', { includeLayers: false });
      const next = cloneBoneRig(this.boneRig);
      next.bones = next.bones.filter((entry) => entry.id !== selectedEdge.id);
      next.bindings = next.bindings.filter((binding) => !binding.boneIds.includes(selectedEdge.id));
      next.poses.forEach((pose) => { delete pose.bones[selectedEdge.id]; });
      (next.poseTimeline || []).forEach((pose) => { delete pose.bones[selectedEdge.id]; });
      const graph = buildBoneGraph(next);
      next.bones.forEach((entry) => {
        entry.parentId = graph.parentById.get(entry.id) || null;
      });
      const validJointIds = new Set(next.joints.map((joint) => joint.id));
      next.poses.forEach((pose) => {
        Object.keys(pose.nodes || {}).forEach((jointId) => {
          if (!validJointIds.has(jointId)) delete pose.nodes[jointId];
        });
      });
      (next.poseTimeline || []).forEach((pose) => {
        Object.keys(pose.nodes || {}).forEach((jointId) => {
          if (!validJointIds.has(jointId)) delete pose.nodes[jointId];
        });
      });
      this.boneRig = next;
      this.boneEditor.selectedEdgeBoneId = null;
      this.boneEditor.selectedBoneId = null;
      this.boneEditor.selectedJointId = selectedEdge.startJointId || this.boneRig.joints[0]?.id || null;
      this.ensureBoneNodeSelection();
      const selectedJoint = this.boneRig.joints.find((joint) => joint.id === this.boneEditor.selectedJointId) || null;
      this.boneEditor.chainAnchor = selectedJoint
        ? { boneId: null, jointId: selectedJoint.id, handle: 'end', x: selectedJoint.x, y: selectedJoint.y }
        : null;
      this.commitHistory();
      return;
    }
    const bone = this.getSelectedBone();
    const ownerId = this.getSelectedBoneOwnerId();
    if (!bone) return;
    this.startHistory('delete bone', { includeLayers: false });
    const next = cloneBoneRig(this.boneRig);
    next.bones = next.bones.filter((entry) => entry.id !== bone.id);
    next.bindings = next.bindings.filter((binding) => !binding.boneIds.includes(bone.id) && (!ownerId || !binding.boneIds.includes(ownerId)));
    next.poses.forEach((pose) => { delete pose.bones[bone.id]; });
    this.boneRig = removeOrphanBoneJoints(next);
    const validJointIds = new Set(this.boneRig.joints.map((joint) => joint.id));
    this.boneRig.poses.forEach((pose) => {
      Object.keys(pose.nodes || {}).forEach((jointId) => {
        if (!validJointIds.has(jointId)) delete pose.nodes[jointId];
      });
    });
    (this.boneRig.poseTimeline || []).forEach((pose) => {
      Object.keys(pose.nodes || {}).forEach((jointId) => {
        if (!validJointIds.has(jointId)) delete pose.nodes[jointId];
      });
    });
    this.boneEditor.selectedJointId = this.boneRig.bones[0]?.startJointId || this.boneRig.joints[0]?.id || null;
    this.ensureBoneNodeSelection();
    this.boneEditor.chainAnchor = this.getBoneChainAnchorFromSelection('end');
    this.commitHistory();
  }

  bakeBoneAnimationToCopiedFrames() {
    if (!this.boneRig.bindings.length) return;
    this.stopAnimationPreview();
    this.startHistory('bake bone animation', { includeFrames: true });
    const sourceFrame = cloneFrame(this.currentFrame);
    const sourceDurationMs = sourceFrame.durationMs || DEFAULT_FRAME_DURATION_MS;
    const baked = this.boneRig.poseTimeline?.length
      ? (() => {
          const sampleTimes = this.getBoneBakeSampleTimes();
          const rigContext = typeof this.getCachedBoneRigContext === 'function'
            ? this.getCachedBoneRigContext()
            : { normalizedRig: normalizeBoneRig(this.boneRig, { exclusive: false }), graph: buildBoneGraph(normalizeBoneRig(this.boneRig, { exclusive: false })) };
          const meshCache = new Map();
          return sampleTimes.map((timeMs, index) => this.renderBonePreviewBakeFrame(
            timeMs,
            this.getBoneBakeFrameDurationMs(sampleTimes, index, sourceDurationMs),
            index,
            { rigContext, meshCache }
          ));
        })()
      : bakeBoneFrames([sourceFrame], this.canvasState.width, this.canvasState.height, this.boneRig)
        .map((frame, index) => ({
          ...frame,
          layers: frame.layers.map((layer) => ({ ...layer, name: `${layer.name || 'Layer'} Bone ${index + 1}` }))
        }));
    const insertAt = clamp(this.animation.currentFrameIndex + 1, 0, this.animation.frames.length);
    this.animation.frames.splice(insertAt, 0, ...baked);
    this.animation.currentFrameIndex = insertAt;
    this.setFrameLayers(this.currentFrame.layers);
    this.commitHistory();
    this.leftPanelTab = 'animation';
    this.boneEditor.submenu = null;
    this.setBoneEditorMode('pose');
    this.statusMessage = 'Baked bone animation after current frame';
  }

  getRootPoseMoveBoneIds(jointId) {
    if (!jointId) return [];
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const hasIncoming = (graph.incomingByJoint.get(jointId) || []).length > 0;
    if (hasIncoming) return [];
    return (graph.outgoingByJoint.get(jointId) || [])
      .map((bone) => bone.id);
  }

  getPoseBranchMoveTarget(jointId, targetBone = null) {
    if (!jointId) return null;
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const incoming = graph.incomingByJoint.get(jointId) || [];
    const outgoing = graph.outgoingByJoint.get(jointId) || [];
    if (!incoming.length && !outgoing.length) return null;
    const selectedEdgeId = this.boneEditor?.selectedEdgeBoneId || targetBone?.id || null;
    const selectedIncoming = incoming.find((bone) => bone.id === selectedEdgeId);
    const selectedOutgoing = outgoing.find((bone) => bone.id === selectedEdgeId);
    const collectBoneTree = (bone, ids) => {
      if (!bone?.id || ids.has(bone.id)) return;
      ids.add(bone.id);
      (graph.childrenByParent.get(bone.id) || []).forEach((child) => collectBoneTree(child, ids));
    };
    const getBranchPatchBone = (bone) => {
      let patchBone = bone || null;
      while (patchBone) {
        const parentId = graph.parentById.get(patchBone.id);
        const parent = parentId ? graph.byId.get(parentId) : null;
        const inheritsParent = parent && parent.endJointId === patchBone.startJointId;
        const edgeMode = patchBone.jointMode || (patchBone.stretch ? 'stretch' : 'rotate');
        if (edgeMode !== 'fixed' || !inheritsParent) break;
        patchBone = parent;
      }
      return patchBone || bone || null;
    };
    if (incoming.length) {
      const rootBone = selectedIncoming || incoming[0];
      const boneIds = new Set();
      collectBoneTree(rootBone, boneIds);
      outgoing.forEach((bone) => collectBoneTree(bone, boneIds));
      const patchBone = getBranchPatchBone(rootBone);
      return {
        bone: rootBone,
        boneIds: Array.from(boneIds),
        patchBoneIds: patchBone?.id ? [patchBone.id] : [rootBone.id]
      };
    }
    const rootBones = outgoing.length ? outgoing : [selectedOutgoing || targetBone].filter(Boolean);
    const boneIds = new Set();
    rootBones.forEach((bone) => collectBoneTree(bone, boneIds));
    const patchBoneIds = [...new Set(rootBones
      .map((bone) => getBranchPatchBone(bone)?.id)
      .filter(Boolean))];
    return {
      bone: selectedOutgoing || outgoing[0] || targetBone,
      boneIds: Array.from(boneIds),
      patchBoneIds: patchBoneIds.length ? patchBoneIds : rootBones.map((bone) => bone.id)
    };
  }

  getBoneEdgeMode(bone = {}) {
    return bone.jointMode || (bone.stretch ? 'stretch' : 'rotate');
  }

  isPoseEditableBoneEdge(bone = {}) {
    const getMode = typeof this.getBoneEdgeMode === 'function'
      ? this.getBoneEdgeMode
      : PixelStudio.prototype.getBoneEdgeMode;
    return getMode.call(this, bone) !== 'fixed' && !bone.locked;
  }

  isPoseIkEnabledForBone(bone = {}) {
    return bone?.jointSettings?.ikEnabled !== false;
  }

  resolvePoseIkDragTarget(jointId, graph = null) {
    if (!jointId) return null;
    const resolvedGraph = graph || (typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig));
    const incoming = resolvedGraph.incomingByJoint.get(jointId) || [];
    const outgoing = resolvedGraph.outgoingByJoint.get(jointId) || [];
    if (incoming.length !== 1 || outgoing.length) return null;
    const child = incoming[0];
    const parentId = resolvedGraph.parentById.get(child.id);
    const parent = parentId ? resolvedGraph.byId.get(parentId) : null;
    if (!parent || parent.endJointId !== child.startJointId) return null;
    const isEditableEdge = typeof this.isPoseEditableBoneEdge === 'function'
      ? this.isPoseEditableBoneEdge
      : PixelStudio.prototype.isPoseEditableBoneEdge;
    const isIkEnabled = typeof this.isPoseIkEnabledForBone === 'function'
      ? this.isPoseIkEnabledForBone
      : PixelStudio.prototype.isPoseIkEnabledForBone;
    if (!isEditableEdge.call(this, parent) || !isEditableEdge.call(this, child)) return null;
    if (!isIkEnabled.call(this, parent) || !isIkEnabled.call(this, child)) return null;
    const getMode = typeof this.getBoneEdgeMode === 'function'
      ? this.getBoneEdgeMode
      : PixelStudio.prototype.getBoneEdgeMode;
    if (getMode.call(this, parent) === 'free' || getMode.call(this, child) === 'free') return null;
    return {
      action: 'ik-chain',
      bone: child,
      handle: 'end',
      jointId,
      parentBoneId: parent.id,
      childBoneId: child.id,
      ikBoneIds: [parent.id, child.id]
    };
  }

  resolvePoseNodeDragTarget(hit = {}) {
    const selectedEdgeId = this.boneEditor?.selectedEdgeBoneId || null;
    const hasSelectedJoint = Boolean(this.boneEditor?.selectedJointId || this.boneEditor?.chainAnchor?.jointId);
    const listSelectedBone = this.boneEditor?.selectionSource === 'list';
    if (listSelectedBone && !hasSelectedJoint && selectedEdgeId && hit.bone?.id === selectedEdgeId) {
      return {
        action: 'bone-move',
        bone: hit.bone,
        handle: 'body',
        jointId: null
      };
    }
    if (!hit.jointId) {
      return {
        action: 'edge',
        bone: hit.bone,
        handle: hit.handle || 'body',
        jointId: null
      };
    }
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const jointId = hit.jointId;
    const incoming = graph.incomingByJoint.get(jointId) || [];
    const outgoing = graph.outgoingByJoint.get(jointId) || [];
    const selectedIncoming = incoming.find((bone) => bone.id === selectedEdgeId);
    const selectedOutgoing = outgoing.find((bone) => bone.id === selectedEdgeId);
    const isEditableEdge = typeof this.isPoseEditableBoneEdge === 'function'
      ? this.isPoseEditableBoneEdge
      : PixelStudio.prototype.isPoseEditableBoneEdge;
    const getMode = typeof this.getBoneEdgeMode === 'function'
      ? this.getBoneEdgeMode
      : PixelStudio.prototype.getBoneEdgeMode;
    const selectedFreeIncoming = selectedIncoming && getMode.call(this, selectedIncoming) === 'free' && isEditableEdge.call(this, selectedIncoming);
    if (selectedFreeIncoming) return { action: 'edge', bone: selectedIncoming, handle: 'end', jointId };
    const selectedFreeOutgoing = selectedOutgoing && getMode.call(this, selectedOutgoing) === 'free' && isEditableEdge.call(this, selectedOutgoing);
    if (selectedFreeOutgoing) return { action: 'edge', bone: selectedOutgoing, handle: 'start', jointId };
    const hitFreeIncoming = hit.bone && incoming.find((bone) => bone.id === hit.bone.id && getMode.call(this, bone) === 'free' && isEditableEdge.call(this, bone));
    if (hitFreeIncoming) return { action: 'edge', bone: hitFreeIncoming, handle: 'end', jointId };
    const hitFreeOutgoing = hit.bone && outgoing.find((bone) => bone.id === hit.bone.id && getMode.call(this, bone) === 'free' && isEditableEdge.call(this, bone));
    if (hitFreeOutgoing) return { action: 'edge', bone: hitFreeOutgoing, handle: 'start', jointId };
    const ikTarget = this.resolvePoseIkDragTarget
      ? this.resolvePoseIkDragTarget(jointId, graph)
      : PixelStudio.prototype.resolvePoseIkDragTarget.call(this, jointId, graph);
    if (ikTarget && (!selectedEdgeId || selectedEdgeId === ikTarget.childBoneId)) return ikTarget;
    const branchTarget = typeof this.getPoseBranchMoveTarget === 'function'
      ? this.getPoseBranchMoveTarget(jointId, hit.bone || null)
      : PixelStudio.prototype.getPoseBranchMoveTarget.call(this, jointId, hit.bone || null);
    const selectedFixed = (selectedIncoming && !isEditableEdge.call(this, selectedIncoming))
      || (selectedOutgoing && !isEditableEdge.call(this, selectedOutgoing));
    if (selectedFixed && branchTarget?.boneIds?.length) {
      const selectedBone = selectedIncoming || selectedOutgoing || branchTarget.bone;
      return {
        action: 'branch-move',
        bone: branchTarget.bone || selectedBone,
        handle: selectedIncoming ? 'end' : 'start',
        jointId,
        branchMoveBoneIds: branchTarget.boneIds,
        branchMovePatchBoneIds: branchTarget.patchBoneIds
      };
    }
    if (selectedIncoming && isEditableEdge.call(this, selectedIncoming)) {
      return { action: 'edge', bone: selectedIncoming, handle: 'end', jointId };
    }
    if (selectedOutgoing && isEditableEdge.call(this, selectedOutgoing)) {
      return { action: 'edge', bone: selectedOutgoing, handle: 'start', jointId };
    }
    const editableIncoming = incoming.find((bone) => isEditableEdge.call(this, bone));
    if (editableIncoming) return { action: 'edge', bone: editableIncoming, handle: 'end', jointId };
    const editableOutgoing = outgoing.find((bone) => isEditableEdge.call(this, bone));
    if (!incoming.length && outgoing.length) {
      return {
        action: 'root-move',
        bone: editableOutgoing || outgoing[0],
        handle: 'start',
        jointId,
        rootMoveBoneIds: outgoing.map((bone) => bone.id)
      };
    }
    if (editableOutgoing) return { action: 'edge', bone: editableOutgoing, handle: 'start', jointId };
    const fallback = incoming[0] || outgoing[0] || hit.bone;
    if (branchTarget?.boneIds?.length) {
      return {
        action: 'branch-move',
        bone: branchTarget.bone || fallback,
        handle: fallback?.endJointId === jointId ? 'end' : 'start',
        jointId,
        branchMoveBoneIds: branchTarget.boneIds,
        branchMovePatchBoneIds: branchTarget.patchBoneIds
      };
    }
    return {
      action: 'blocked',
      bone: fallback,
      handle: fallback?.endJointId === jointId ? 'end' : 'start',
      jointId
    };
  }

  getPoseTargetForSelectedJoint() {
    const jointId = this.boneEditor?.selectedJointId || this.boneEditor?.chainAnchor?.jointId || null;
    if (!jointId) return null;
    const joint = this.boneRig.joints.find((entry) => entry.id === jointId) || null;
    const bone = this.getBoneForSelectedJoint(jointId) || this.boneRig.bones[0] || null;
    if (!joint || !bone) return null;
    const handle = bone.startJointId === jointId ? 'start' : 'end';
    return this.resolvePoseNodeDragTarget({
      bone,
      handle,
      jointId,
      joint
    });
  }

  getPoseTargetEdgeBone() {
    const getPoseTarget = typeof this.getPoseTargetForSelectedJoint === 'function'
      ? this.getPoseTargetForSelectedJoint
      : PixelStudio.prototype.getPoseTargetForSelectedJoint;
    const target = getPoseTarget.call(this);
    return target?.action === 'edge' ? target.bone : null;
  }

  getPoseTargetLabel() {
    if (this.boneEditor?.mode !== 'pose') return '';
    const getPoseTarget = typeof this.getPoseTargetForSelectedJoint === 'function'
      ? this.getPoseTargetForSelectedJoint
      : PixelStudio.prototype.getPoseTargetForSelectedJoint;
    const target = getPoseTarget.call(this);
    if (!target) return 'Tap node';
    if (target.action === 'ik-chain') return 'Drag node: solves chain';
    if (target.action === 'root-move') return 'Drag node: moves group';
    if (target.action === 'branch-move') return 'Drag node: moves branch';
    if (target.action === 'blocked') return 'Locked edge';
    const getMode = typeof this.getBoneEdgeMode === 'function'
      ? this.getBoneEdgeMode
      : PixelStudio.prototype.getBoneEdgeMode;
    if (target.bone && getMode.call(this, target.bone) === 'free') {
      return `Drag node: moves ${target.bone.name || target.bone.id}`;
    }
    const widgetTarget = this.getPoseWidgetRotationTarget?.(target.jointId || this.boneEditor?.selectedJointId, target.bone);
    if (widgetTarget?.bone) {
      const name = widgetTarget.bone.name || widgetTarget.bone.id;
      return widgetTarget.direction === 'outgoing' ? `Rotate children: ${name}` : `Rotate edge: ${name}`;
    }
    const name = target.bone?.name || target.bone?.id || 'edge';
    return `Drag node: rotates ${name}`;
  }

  getPoseWidgetRotationTarget(jointId = this.boneEditor?.selectedJointId, targetBone = null) {
    if (!jointId) return null;
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const isEditableEdge = typeof this.isPoseEditableBoneEdge === 'function'
      ? this.isPoseEditableBoneEdge
      : PixelStudio.prototype.isPoseEditableBoneEdge;
    const outgoing = (graph.outgoingByJoint.get(jointId) || [])
      .filter((bone) => isEditableEdge.call(this, bone));
    const incoming = (graph.incomingByJoint.get(jointId) || [])
      .filter((bone) => isEditableEdge.call(this, bone));
    const targetBoneId = targetBone?.id || targetBone?.boneId || targetBone?.bone?.id || null;
    const selectedEdgeId = this.boneEditor?.selectedEdgeBoneId || targetBoneId || null;
    const selectedOutgoing = outgoing.find((bone) => bone.id === selectedEdgeId);
    const selectedIncoming = incoming.find((bone) => bone.id === selectedEdgeId);
    if (selectedOutgoing || outgoing[0]) {
      const bone = selectedOutgoing || outgoing[0];
      return {
        jointId,
        bone,
        direction: 'outgoing',
        boneIds: [bone.id],
        localNode: true,
        baseAngle: bone.angle,
        vectorAngle: bone.angle
      };
    }
    if (selectedIncoming || incoming[0]) {
      const bone = selectedIncoming || incoming[0];
      return {
        jointId,
        bone,
        direction: 'incoming',
        boneIds: [bone.id],
        localNode: true,
        baseAngle: bone.angle + Math.PI,
        vectorAngle: bone.angle + Math.PI
      };
    }
    return null;
  }

  getDisplayedPoseWidgetRotationTarget(jointId = this.boneEditor?.selectedJointId, displayedBones = this.getDisplayedBonesForBoneEditor()) {
    const getWidgetTarget = typeof this.getPoseWidgetRotationTarget === 'function'
      ? this.getPoseWidgetRotationTarget
      : PixelStudio.prototype.getPoseWidgetRotationTarget;
    const target = getWidgetTarget.call(this, jointId);
    if (!target) return null;
    const displayedBone = target.bone
      ? displayedBones.find((bone) => bone.id === target.bone.id) || target.bone
      : null;
    const nodeAngle = this.getCurrentBonePreviewPose?.().nodes?.[jointId]?.angle || 0;
    const vectorAngle = displayedBone
      ? (target.direction === 'incoming' ? displayedBone.angle + Math.PI : displayedBone.angle)
      : (target.vectorAngle ?? target.baseAngle ?? target.bone?.angle ?? 0);
    return {
      ...target,
      bone: displayedBone,
      vectorAngle,
      baseAngle: vectorAngle + nodeAngle
    };
  }

  getPoseFanRotationTarget(jointId = this.boneEditor?.selectedJointId, targetBone = null) {
    if (!jointId) return null;
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const incoming = (graph.incomingByJoint.get(jointId) || [])
      .filter((bone) => this.isPoseEditableBoneEdge ? this.isPoseEditableBoneEdge(bone) : PixelStudio.prototype.isPoseEditableBoneEdge.call(this, bone));
    const outgoing = (graph.outgoingByJoint.get(jointId) || [])
      .filter((bone) => this.isPoseEditableBoneEdge ? this.isPoseEditableBoneEdge(bone) : PixelStudio.prototype.isPoseEditableBoneEdge.call(this, bone));
    if (!incoming.length || !outgoing.length) return null;
    const selectedEdgeId = this.boneEditor?.selectedEdgeBoneId || targetBone?.id || null;
    const selectedOutgoing = outgoing.find((bone) => bone.id === selectedEdgeId) || outgoing[0];
    const selectedIncoming = incoming.find((bone) => bone.id === selectedEdgeId) || incoming[0];
    return {
      jointId,
      incoming: selectedIncoming,
      outgoing: selectedOutgoing,
      boneIds: [selectedIncoming.id, selectedOutgoing.id]
    };
  }

  getPoseRotateWidgetGeometry(joint, cellSize = this.canvasBounds?.cellSize || 1, target = null) {
    if (!joint) return null;
    const safeCellSize = Math.max(1, Number(cellSize) || 1);
    const nodeHitRadius = Math.max(2.25, 28 / safeCellSize);
    const radius = nodeHitRadius + Math.max(0.9, 22 / safeCellSize);
    const knobRadius = Math.max(0.95, 24 / safeCellSize);
    const visualKnobRadius = Math.max(0.42, 9 / safeCellSize);
    const handleAngle = Number.isFinite(target?.baseAngle)
      ? target.baseAngle
      : Number.isFinite(target?.bone?.angle)
        ? target.bone.angle
        : -Math.PI / 4;
    return {
      center: { x: joint.x, y: joint.y },
      radius,
      knobRadius,
      visualKnobRadius,
      handleAngle,
      knob: {
        x: joint.x + Math.cos(handleAngle) * radius,
        y: joint.y + Math.sin(handleAngle) * radius
      }
    };
  }

  getPoseRotateWidgetHit(point) {
    if (this.leftPanelTab !== 'bones' || this.boneEditor?.mode !== 'pose') return null;
    const jointId = this.boneEditor?.selectedJointId || this.boneEditor?.chainAnchor?.jointId || null;
    if (!jointId) return null;
    const displayedBones = this.getDisplayedBonesForBoneEditor();
    const joint = this.getDisplayedJointPoint(jointId, displayedBones);
    if (!joint) return null;
    const getDisplayedWidgetTarget = typeof this.getDisplayedPoseWidgetRotationTarget === 'function'
      ? this.getDisplayedPoseWidgetRotationTarget
      : PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget;
    const widgetTarget = getDisplayedWidgetTarget.call(this, jointId, displayedBones);
    const { x: px, y: py } = this.getBonePointerCoords
      ? this.getBonePointerCoords(point)
      : {
        x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
        y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
      };
    const cellSize = Math.max(1, this.canvasBounds?.cellSize || 1);
    const geometry = this.getPoseRotateWidgetGeometry
      ? this.getPoseRotateWidgetGeometry(joint, cellSize, widgetTarget)
      : PixelStudio.prototype.getPoseRotateWidgetGeometry.call(this, joint, cellSize, widgetTarget);
    if (!geometry) return null;
    const distance = Math.hypot(px - geometry.knob.x, py - geometry.knob.y);
    if (distance > geometry.knobRadius) return null;
    const getPoseTarget = typeof this.getPoseTargetForSelectedJoint === 'function'
      ? this.getPoseTargetForSelectedJoint
      : PixelStudio.prototype.getPoseTargetForSelectedJoint;
    const fallbackTarget = getPoseTarget.call(this);
    const target = widgetTarget ? {
      action: 'edge',
      bone: widgetTarget.bone,
      handle: widgetTarget.direction === 'incoming' ? 'end' : 'start',
      jointId,
      widgetRotation: widgetTarget
    } : fallbackTarget;
    const bone = target?.bone || this.getBoneForSelectedJoint(jointId);
    if (!bone) return null;
    return {
      bone,
      handle: 'rotate-widget',
      jointId,
      joint,
      widget: geometry,
      poseTarget: target,
      distance
    };
  }

  getPoseRotateWidgetScreenHit(point) {
    if (!this.canvasBounds) return null;
    const { mainX, mainY, x: startX, y: startY, cellSize } = this.canvasBounds;
    const originX = Number.isFinite(mainX) ? mainX : startX;
    const originY = Number.isFinite(mainY) ? mainY : startY;
    const gridPoint = {
      x: (point.x - originX) / Math.max(1, cellSize),
      y: (point.y - originY) / Math.max(1, cellSize),
      col: Math.floor((point.x - originX) / Math.max(1, cellSize)),
      row: Math.floor((point.y - originY) / Math.max(1, cellSize))
    };
    const hit = this.getPoseRotateWidgetHit(gridPoint);
    return hit ? { ...hit, point: gridPoint } : null;
  }

  buildPoseRotationPatches(drag, bone, px, py) {
    const originalPose = drag.originalPose || { angle: 0, dx: 0, dy: 0, scale: 1 };
    if (drag.handle === 'rotate-widget') {
      const getWidgetTarget = typeof this.getPoseWidgetRotationTarget === 'function'
        ? this.getPoseWidgetRotationTarget
        : PixelStudio.prototype.getPoseWidgetRotationTarget;
      const target = drag.widgetRotation || getWidgetTarget.call(this, drag.jointId, bone);
      const targetBoneId = target?.boneId || target?.bone?.id || bone?.id || null;
      const targetBone = this.boneRig.bones.find((entry) => entry.id === targetBoneId) || bone;
      const original = drag.originalWidgetPoseByBone?.[targetBone.id] || originalPose;
      const pivot = drag.widgetPivot || (target?.direction === 'incoming' ? targetBone.end : targetBone.start);
      const direction = target?.direction || (targetBone.startJointId === drag.jointId ? 'outgoing' : 'incoming');
      const desiredAngle = direction === 'incoming'
        ? Math.atan2(pivot.y - py, pivot.x - px)
        : Math.atan2(py - pivot.y, px - pivot.x);
      const startAngle = Number.isFinite(drag.originalDisplayedAngle)
        ? drag.originalDisplayedAngle
        : targetBone.angle + (original.angle || 0);
      const angle = (original.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
      const patch = {
        angle,
        dx: original.dx || 0,
        dy: original.dy || 0,
        scale: original.scale || 1
      };
      if (direction === 'incoming') {
        patch.dx = pivot.x - Math.cos(desiredAngle) * targetBone.length - targetBone.start.x;
        patch.dy = pivot.y - Math.sin(desiredAngle) * targetBone.length - targetBone.start.y;
      }
      return { [targetBone.id]: patch };
    }
    const fan = drag.fanRotation || this.getPoseFanRotationTarget?.(drag.jointId, bone);
    if (fan?.incoming) {
      const incoming = this.boneRig.bones.find((entry) => entry.id === fan.incoming.id) || fan.incoming;
      const pivot = drag.fanPivot || incoming.start;
      const desiredAngle = Math.atan2(py - pivot.y, px - pivot.x);
      const originalIncoming = drag.originalFanPoseByBone?.[incoming.id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
      const startAngle = Number.isFinite(drag.fanStartAngle)
        ? drag.fanStartAngle
        : incoming.angle + (originalIncoming.angle || 0);
      const angle = (originalIncoming.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
      const patches = {
        [incoming.id]: {
          angle,
          dx: originalIncoming.dx || 0,
          dy: originalIncoming.dy || 0,
          scale: originalIncoming.scale || 1
        }
      };
      if (fan.outgoing?.id && fan.outgoing.id !== incoming.id) {
        const originalOutgoing = drag.originalFanPoseByBone?.[fan.outgoing.id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
        patches[fan.outgoing.id] = { ...originalOutgoing };
      }
      return patches;
    }
    const displayedStart = drag.originalStart || bone.start;
    const desiredAngle = Math.atan2(py - displayedStart.y, px - displayedStart.x);
    const startAngle = Number.isFinite(drag.originalDisplayedAngle)
      ? drag.originalDisplayedAngle
      : bone.angle + (originalPose.angle || 0);
    const angle = (originalPose.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
    return {
      [bone.id]: {
        angle,
        dx: originalPose.dx || 0,
        dy: originalPose.dy || 0,
        scale: originalPose.scale || 1
      }
    };
  }

  buildPoseNodeRotationPatches(drag, px, py) {
    const target = drag.widgetRotation || null;
    const jointId = target?.jointId || drag.jointId || null;
    if (!jointId) return {};
    const pivot = drag.widgetPivot || this.boneRig.joints.find((joint) => joint.id === jointId) || null;
    if (!pivot) return {};
    const baseAngle = Number.isFinite(target?.baseAngle) ? target.baseAngle : 0;
    const desiredAngle = Math.atan2(py - pivot.y, px - pivot.x);
    const original = drag.originalNodePoseByJoint?.[jointId] || { angle: 0 };
    const startAngle = Number.isFinite(drag.widgetStartAngle) ? drag.widgetStartAngle : baseAngle;
    const delta = Math.atan2(Math.sin(desiredAngle - startAngle), Math.cos(desiredAngle - startAngle));
    return {
      [jointId]: {
        angle: original.angle + delta
      }
    };
  }

  cyclePoseTargetEdge() {
    const jointId = this.boneEditor?.selectedJointId || this.boneEditor?.chainAnchor?.jointId || null;
    if (!jointId) return;
    const graph = typeof this.getCachedBoneSkeletonContext === 'function'
      ? this.getCachedBoneSkeletonContext().graph
      : buildBoneGraph(this.boneRig);
    const incoming = graph.incomingByJoint.get(jointId) || [];
    const outgoing = graph.outgoingByJoint.get(jointId) || [];
    const isEditableEdge = typeof this.isPoseEditableBoneEdge === 'function'
      ? this.isPoseEditableBoneEdge
      : PixelStudio.prototype.isPoseEditableBoneEdge;
    const connected = [...incoming, ...outgoing]
      .filter((bone, index, all) => all.findIndex((entry) => entry.id === bone.id) === index)
      .filter((bone) => isEditableEdge.call(this, bone));
    if (!connected.length) {
      this.boneEditor.selectedEdgeBoneId = null;
      this.statusMessage = 'No editable edge at selected node';
      return;
    }
    const getPoseTargetEdge = typeof this.getPoseTargetEdgeBone === 'function'
      ? this.getPoseTargetEdgeBone
      : PixelStudio.prototype.getPoseTargetEdgeBone;
    const currentId = this.boneEditor.selectedEdgeBoneId || getPoseTargetEdge.call(this)?.id || connected[0].id;
    const currentIndex = Math.max(0, connected.findIndex((bone) => bone.id === currentId));
    const next = connected[(currentIndex + 1) % connected.length];
    this.boneEditor.selectedEdgeBoneId = next.id;
    this.boneEditor.selectedBoneId = next.id;
    this.statusMessage = `Pose target: ${next.name || next.id}`;
  }

  getBonePointerCoords(point) {
    return {
      x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
      y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
    };
  }

  getBoneCanvasPointFromScreen(screenX, screenY, fallbackPoint) {
    if (!this.canvasBounds) return fallbackPoint;
    const { mainX, mainY, x: startX, y: startY, cellSize } = this.canvasBounds;
    const originX = Number.isFinite(mainX) ? mainX : startX;
    const originY = Number.isFinite(mainY) ? mainY : startY;
    const x = (screenX - originX) / Math.max(1, cellSize);
    const y = (screenY - originY) / Math.max(1, cellSize);
    return { ...fallbackPoint, x, y };
  }

  getBoneHitRadius() {
    const largeTargetMode = ['bind', 'pose', 'time'].includes(this.boneEditor?.mode);
    const basePixels = largeTargetMode ? 28 : 18;
    const minCells = largeTargetMode ? 2.25 : 1.5;
    return Math.max(minCells, basePixels / Math.max(1, this.canvasBounds?.cellSize || 1));
  }

  hitTestBone(point) {
    const hitRadius = this.getBoneHitRadius();
    const bones = this.getDisplayedBonesForBoneEditor();
    const { x: px, y: py } = this.getBonePointerCoords
      ? this.getBonePointerCoords(point)
      : {
        x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
        y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
      };
    const hitBoneJoint = typeof this.hitTestBoneJoint === 'function'
      ? this.hitTestBoneJoint
      : PixelStudio.prototype.hitTestBoneJoint;
    const nearestNode = hitBoneJoint.call(this, point, hitRadius);
    if (nearestNode && this.boneEditor?.mode === 'pose') {
      const selectedEdgeId = this.boneEditor?.selectedEdgeBoneId || null;
      const nodeCandidates = [
        ...bones
          .filter((bone) => bone.endJointId === nearestNode.jointId)
          .map((bone) => ({
            bone,
            handle: 'end',
            jointId: bone.endJointId,
            distance: Math.hypot(px - bone.end.x, py - bone.end.y)
          })),
        ...bones
          .filter((bone) => bone.startJointId === nearestNode.jointId)
          .map((bone) => ({
            bone,
            handle: 'start',
            jointId: bone.startJointId,
            distance: Math.hypot(px - bone.start.x, py - bone.start.y)
          }))
      ]
        .filter((candidate) => candidate.distance <= hitRadius)
        .sort((a, b) => a.distance - b.distance);
      const isFixedEdge = (candidate) => (candidate.bone.jointMode || (candidate.bone.stretch ? 'stretch' : 'rotate')) === 'fixed';
      const selectedFixed = nodeCandidates.find((candidate) => candidate.bone.id === selectedEdgeId && isFixedEdge(candidate));
      if (selectedFixed) return selectedFixed;
      const editableIncoming = nodeCandidates.find((candidate) => candidate.handle === 'end' && !isFixedEdge(candidate));
      if (editableIncoming) return editableIncoming;
      const editableOutgoing = nodeCandidates.find((candidate) => candidate.handle === 'start' && !isFixedEdge(candidate));
      if (editableOutgoing) return editableOutgoing;
      const incoming = nodeCandidates.find((candidate) => candidate.handle === 'end');
      if (incoming) return incoming;
    }
    if (nearestNode) return nearestNode;
    const edgeRadius = Math.max(0.45, hitRadius * 0.38);
    for (let index = bones.length - 1; index >= 0; index -= 1) {
      const bone = bones[index];
      const bodyDist = this.distanceToBoneSegment(px, py, bone);
      if (bodyDist <= edgeRadius) {
        return { bone, handle: 'body', jointId: null };
      }
    }
    return null;
  }

  hitTestBoneJoint(point, radius = this.getBoneHitRadius()) {
    const getDisplayedBones = typeof this.getDisplayedBonesForBoneEditor === 'function'
      ? this.getDisplayedBonesForBoneEditor
      : PixelStudio.prototype.getDisplayedBonesForBoneEditor;
    const displayedBones = getDisplayedBones.call(this);
    const getDisplayedJoints = typeof this.getDisplayedJointsForBoneEditor === 'function'
      ? this.getDisplayedJointsForBoneEditor
      : PixelStudio.prototype.getDisplayedJointsForBoneEditor;
    const joints = getDisplayedJoints.call(this, displayedBones);
    const { x: px, y: py } = this.getBonePointerCoords
      ? this.getBonePointerCoords(point)
      : {
        x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
        y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
      };
    let nearestJoint = null;
    joints.forEach((joint) => {
      const distance = Math.hypot(px - joint.x, py - joint.y);
      if (distance > radius) return;
      if (!nearestJoint || distance < nearestJoint.distance) {
        nearestJoint = { joint, distance };
      }
    });
    if (!nearestJoint) return null;
    const getBoneForJoint = typeof this.getBoneForSelectedJoint === 'function'
      ? this.getBoneForSelectedJoint
      : PixelStudio.prototype.getBoneForSelectedJoint;
    const bone = getBoneForJoint.call(this, nearestJoint.joint.id) || this.boneRig.bones[0] || null;
    if (!bone) return null;
    return {
      bone,
      handle: bone.startJointId === nearestJoint.joint.id ? 'start' : 'end',
      jointId: nearestJoint.joint.id,
      joint: nearestJoint.joint,
      distance: nearestJoint.distance
    };
  }

  hitTestBoneNode(point, radius = this.getBoneHitRadius()) {
    const hitBoneJoint = typeof this.hitTestBoneJoint === 'function'
      ? this.hitTestBoneJoint
      : PixelStudio.prototype.hitTestBoneJoint;
    return hitBoneJoint.call(this, point, radius);
  }

  distanceToBoneSegment(px, py, bone) {
    const ax = bone.start.x;
    const ay = bone.start.y;
    const bx = bone.end.x;
    const by = bone.end.y;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.0001) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  handleBonePointerDown(point) {
    if (this.leftPanelTab !== 'bones') return false;
    const { x: px, y: py } = this.getBonePointerCoords
      ? this.getBonePointerCoords(point)
      : {
        x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
        y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
      };
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    if (this.boneEditor.mode === 'time') {
      this.statusMessage = 'Choose a bone tool command first';
      return true;
    }
    if (this.boneEditor.mode === 'bind') {
      this.ensureBindSelectionTool();
      const hit = this.hitTestBoneNode(point);
      if (!hit) return false;
      const setJointSelection = typeof this.setBoneJointSelection === 'function'
        ? this.setBoneJointSelection
        : PixelStudio.prototype.setBoneJointSelection;
      setJointSelection.call(this, hit.jointId, hit.joint || null);
      this.boneEditor.pendingBindNodeTap = {
        type: 'node-select',
        hit,
        start: { ...point },
        current: { ...point },
        moved: false
      };
      return true;
    }
    const widgetHit = this.boneEditor.mode === 'pose' && typeof this.getPoseRotateWidgetHit === 'function'
      ? this.getPoseRotateWidgetHit(point)
      : null;
    const hit = widgetHit || this.hitTestBone(point);
    if (hit) {
      const resolvePoseTarget = typeof this.resolvePoseNodeDragTarget === 'function'
        ? this.resolvePoseNodeDragTarget
        : PixelStudio.prototype.resolvePoseNodeDragTarget;
      const poseTarget = widgetHit?.poseTarget || (this.boneEditor.mode === 'pose'
        ? resolvePoseTarget.call(this, hit)
        : null);
      const targetBone = poseTarget?.bone || hit.bone;
      const displayedBonesForDrag = this.boneEditor.mode === 'pose'
        ? this.getDisplayedBonesForBoneEditor()
        : null;
      const displayedBoneById = displayedBonesForDrag
        ? new Map(displayedBonesForDrag.map((bone) => [bone.id, bone]))
        : new Map();
      const displayedTargetBone = displayedBoneById.get(targetBone.id) || targetBone;
      const displayedTargetAngle = Math.atan2(
        displayedTargetBone.end.y - displayedTargetBone.start.y,
        displayedTargetBone.end.x - displayedTargetBone.start.x
      );
      let poseTargetWasSelected = true;
      if (this.boneEditor.mode === 'pose' && !widgetHit) {
        const selectedJointId = this.boneEditor.selectedJointId || null;
        const selectedEdgeBoneId = this.boneEditor.selectedEdgeBoneId || null;
        const poseJointId = hit.jointId || poseTarget?.jointId || null;
        const actionNeedsEdge = poseTarget?.action === 'edge'
          || poseTarget?.action === 'ik-chain'
          || poseTarget?.action === 'branch-move'
          || poseTarget?.action === 'bone-move';
        const alreadySelectedJoint = poseJointId
          ? selectedJointId === poseJointId && (!actionNeedsEdge || selectedEdgeBoneId === targetBone.id)
          : false;
        const alreadySelectedBoneMove = poseTarget?.action === 'bone-move'
          && selectedEdgeBoneId === targetBone.id
          && !selectedJointId;
        const alreadySelectedBody = !poseJointId && (
          selectedEdgeBoneId === targetBone.id || this.boneEditor.selectedBoneId === targetBone.id
        );
        poseTargetWasSelected = alreadySelectedJoint || alreadySelectedBody || alreadySelectedBoneMove;
      }
      this.boneEditor.selectedBoneId = targetBone.id;
      const restBone = this.boneRig.bones.find((entry) => entry.id === targetBone.id) || targetBone;
      if (hit.jointId) {
        const setJointSelection = typeof this.setBoneJointSelection === 'function'
          ? this.setBoneJointSelection
          : PixelStudio.prototype.setBoneJointSelection;
        setJointSelection.call(this, hit.jointId, hit.joint || null);
        if (this.boneEditor.mode === 'pose' && (poseTarget?.action === 'edge' || poseTarget?.action === 'ik-chain' || poseTarget?.action === 'branch-move')) {
          this.boneEditor.selectedEdgeBoneId = targetBone.id;
          this.boneEditor.selectedBoneId = targetBone.id;
        }
      } else {
        this.setBoneChainAnchor(restBone, hit.handle === 'start' ? 'start' : 'end');
        if (hit.handle === 'body') this.boneEditor.selectedEdgeBoneId = hit.bone.id;
      }
      if (this.boneEditor.mode === 'pose' && !widgetHit) {
        if (!poseTargetWasSelected) {
          this.boneEditor.drag = null;
          this.statusMessage = 'Selected bone. Drag again to pose';
          return true;
        }
      }
      const affectedPixels = typeof this.getSelectedBoneAffectedPixelCount === 'function'
        ? this.getSelectedBoneAffectedPixelCount()
        : 1;
      if (!affectedPixels && ['bones', 'pose', 'bind'].includes(this.boneEditor.mode)) {
        this.statusMessage = 'Selected bone has 0 assigned pixels on this layer';
      }
      if (this.boneEditor.mode === 'bind' || this.boneEditor.mode === 'time') {
        return true;
      }
      const pose = samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
      const originalPose = pose.bones[targetBone.id] || { angle: 0, dx: 0, dy: 0 };
      const fanRotation = this.boneEditor.mode === 'pose'
        ? this.getPoseFanRotationTarget?.(hit.jointId || poseTarget?.jointId, targetBone)
        : null;
      const getWidgetTarget = typeof this.getPoseWidgetRotationTarget === 'function'
        ? this.getPoseWidgetRotationTarget
        : PixelStudio.prototype.getPoseWidgetRotationTarget;
      const widgetRotation = widgetHit && this.boneEditor.mode === 'pose'
        ? (widgetHit.poseTarget?.widgetRotation || getWidgetTarget.call(this, hit.jointId || poseTarget?.jointId, targetBone))
        : null;
      const widgetBoneIds = widgetRotation?.boneIds || [];
      const originalWidgetPoseByBone = Object.fromEntries(widgetBoneIds.map((boneId) => [
        boneId,
        { angle: 0, dx: 0, dy: 0, scale: 1, ...(pose.bones[boneId] || {}) }
      ]));
      const widgetPivot = widgetRotation?.jointId
        ? (widgetHit?.joint
          || this.getDisplayedJointPoint?.(widgetRotation.jointId, displayedBonesForDrag || undefined)
          || this.boneRig.joints.find((joint) => joint.id === widgetRotation.jointId)
          || null)
        : null;
      const widgetStartAngle = widgetPivot ? Math.atan2(py - widgetPivot.y, px - widgetPivot.x) : null;
      const originalNodePoseByJoint = widgetRotation?.jointId
        ? {
            [widgetRotation.jointId]: {
              angle: 0,
              ...(pose.nodes?.[widgetRotation.jointId] || {})
            }
          }
        : {};
      const fanBoneIds = fanRotation?.boneIds || [];
      const originalFanPoseByBone = Object.fromEntries(fanBoneIds.map((boneId) => [
        boneId,
        { angle: 0, dx: 0, dy: 0, scale: 1, ...(pose.bones[boneId] || {}) }
      ]));
      const displayedFanIncoming = fanRotation?.incoming?.id
        ? displayedBoneById.get(fanRotation.incoming.id)
        : null;
      const fanPivot = displayedFanIncoming?.start
        ? { ...displayedFanIncoming.start }
        : (fanRotation?.incoming?.start ? { ...fanRotation.incoming.start } : null);
      const displayedFanAngle = displayedFanIncoming
        ? Math.atan2(
            displayedFanIncoming.end.y - displayedFanIncoming.start.y,
            displayedFanIncoming.end.x - displayedFanIncoming.start.x
          )
        : null;
      const rootMoveBoneIds = this.boneEditor.mode === 'pose'
        ? (poseTarget?.rootMoveBoneIds || [])
        : [];
      const originalRootPoseByBone = Object.fromEntries(rootMoveBoneIds.map((boneId) => [
        boneId,
        { angle: 0, dx: 0, dy: 0, scale: 1, ...(pose.bones[boneId] || {}) }
      ]));
      const branchMoveBoneIds = this.boneEditor.mode === 'pose'
        ? (poseTarget?.branchMoveBoneIds || [])
        : [];
      const branchMovePatchBoneIds = this.boneEditor.mode === 'pose'
        ? (poseTarget?.branchMovePatchBoneIds || branchMoveBoneIds)
        : [];
      const originalBranchPoseByBone = Object.fromEntries(branchMovePatchBoneIds.map((boneId) => [
        boneId,
        { angle: 0, dx: 0, dy: 0, scale: 1, ...(pose.bones[boneId] || {}) }
      ]));
      const ikBoneIds = this.boneEditor.mode === 'pose'
        ? (poseTarget?.ikBoneIds || [])
        : [];
      const originalIkPoseByBone = Object.fromEntries(ikBoneIds.map((boneId) => [
        boneId,
        { angle: 0, dx: 0, dy: 0, scale: 1, ...(pose.bones[boneId] || {}) }
      ]));
      if (this.boneEditor.mode === 'pose' && !this.boneRig.bindings.length) {
        this.statusMessage = 'Bind pixels to a bone before posing artwork';
      }
      this.boneEditor.drag = {
        type: this.boneEditor.mode === 'pose' ? 'pose' : 'edit',
        boneId: targetBone.id,
        handle: widgetHit ? 'rotate-widget' : (poseTarget?.handle || hit.handle),
        jointId: hit.jointId || null,
        start: { x: px, y: py },
        originalStart: { ...displayedTargetBone.start },
        originalEnd: { ...displayedTargetBone.end },
        originalDisplayedAngle: displayedTargetAngle,
        originalPose: { ...originalPose },
        basePose: {
          ...pose,
          bones: { ...(pose.bones || {}) },
          nodes: { ...(pose.nodes || {}) }
        },
        fanRotation: fanRotation ? {
          jointId: fanRotation.jointId,
          incoming: { id: fanRotation.incoming.id },
          outgoing: fanRotation.outgoing ? { id: fanRotation.outgoing.id } : null,
          boneIds: fanRotation.boneIds
        } : null,
        widgetRotation: widgetRotation ? {
          jointId: widgetRotation.jointId,
          boneId: widgetRotation.bone?.id || widgetRotation.boneId,
          direction: widgetRotation.direction,
          boneIds: widgetRotation.boneIds,
          localNode: Boolean(widgetRotation.localNode),
          baseAngle: Number.isFinite(widgetRotation.baseAngle) ? widgetRotation.baseAngle : widgetRotation.bone?.angle
        } : null,
        widgetPivot: widgetPivot ? { x: widgetPivot.x, y: widgetPivot.y } : null,
        widgetStartAngle,
        originalWidgetPoseByBone,
        originalNodePoseByJoint,
        fanPivot,
        fanStartAngle: displayedFanAngle,
        originalFanPoseByBone,
        rootMoveBoneIds,
        originalRootPoseByBone,
        branchMoveBoneIds,
        branchMovePatchBoneIds,
        originalBranchPoseByBone,
        ikTarget: poseTarget?.action === 'ik-chain' ? {
          parentBoneId: poseTarget.parentBoneId,
          childBoneId: poseTarget.childBoneId,
          jointId: poseTarget.jointId,
          ikBoneIds
        } : null,
        originalIkPoseByBone,
        poseTarget: poseTarget ? {
          action: poseTarget.action,
          boneId: targetBone.id,
          handle: widgetHit ? 'rotate-widget' : poseTarget.handle,
          jointId: poseTarget.jointId || null,
          parentBoneId: poseTarget.parentBoneId || null,
          childBoneId: poseTarget.childBoneId || null,
          ikBoneIds,
          branchMoveBoneIds,
          branchMovePatchBoneIds
        } : null,
        moved: false
      };
      if (this.boneEditor.drag.type === 'pose') {
        this.boneEditor.previewPose = null;
        this.boneEditor.previewPoseTimeMs = null;
        this.boneEditor.previewPoseSignature = null;
      }
      this.startHistory(this.boneEditor.drag.type === 'pose' ? 'pose bone' : 'edit bone', { includeLayers: false });
      return true;
    }
    if (this.boneEditor.mode === 'bones' && this.boneEditor.linkMode) {
      const anchor = this.boneEditor.chainAnchor;
      this.boneEditor.drag = {
        type: 'link-create',
        start: anchor ? { x: anchor.x, y: anchor.y } : { x: px, y: py },
        current: { x: px, y: py },
        parentId: anchor?.boneId || null,
        startJointId: anchor?.jointId || null,
        awaitingAnchor: !anchor,
        moved: false
      };
      return true;
    }
    if (this.boneEditor.mode === 'bones') {
      this.boneEditor.drag = { type: 'create', start: { x: px, y: py }, current: { x: px, y: py } };
      return true;
    }
    if (this.boneEditor.mode === 'pose') {
      this.statusMessage = 'Tap a bone node or edge to pose';
      return true;
    }
    return false;
  }

  handleBonePointerMove(point) {
    if (this.leftPanelTab === 'bones' && this.boneEditor.mode === 'time') return true;
    const pendingTap = this.boneEditor.pendingBindNodeTap;
    if (pendingTap && this.leftPanelTab === 'bones' && this.boneEditor.mode === 'bind') {
      pendingTap.current = { ...point };
      if (pendingTap.type === 'node-select') {
        pendingTap.moved = Math.hypot(point.col - pendingTap.start.col, point.row - pendingTap.start.row) >= 0.5;
        return true;
      }
      const distance = Math.hypot(point.col - pendingTap.start.col, point.row - pendingTap.start.row);
      if (distance >= 0.5) {
        this.boneEditor.pendingBindNodeTap = null;
        this.ensureBindSelectionTool();
        this.handleToolPointerDown(pendingTap.start);
        this.handleToolPointerMove(point);
        return true;
      }
      return true;
    }
    const drag = this.boneEditor.drag;
    if (!drag || this.leftPanelTab !== 'bones') return false;
    const { x: px, y: py } = this.getBonePointerCoords
      ? this.getBonePointerCoords(point)
      : {
        x: Number.isFinite(point?.x) ? point.x : point.col + 0.5,
        y: Number.isFinite(point?.y) ? point.y : point.row + 0.5
      };
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      if (drag.type === 'pose') drag.moved = false;
      return true;
    }
    if (drag.type === 'create' || drag.type === 'link-create') {
      drag.current = { x: px, y: py };
      drag.moved = Math.hypot(px - drag.start.x, py - drag.start.y) >= 0.5;
      return true;
    }
    const bone = this.boneRig.bones.find((entry) => entry.id === drag.boneId);
    if (!bone) return false;
    drag.moved = true;
    if (drag.type === 'pose') {
      const edgeMode = this.getBoneEdgeMode ? this.getBoneEdgeMode(bone) : (bone.jointMode || (bone.stretch ? 'stretch' : 'rotate'));
      if (edgeMode === 'free' && drag.handle !== 'rotate-widget') {
        const original = drag.originalPose || { angle: 0, dx: 0, dy: 0, scale: 1 };
        const anchor = drag.handle === 'start'
          ? (drag.originalStart || bone.start)
          : (drag.originalEnd || bone.end);
        const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
          ? this.setBonePreviewPosePatchAtCurrentTime
          : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
        setPreviewPatch.call(this, bone.id, {
          angle: original.angle || 0,
          dx: (original.dx || 0) + (px - anchor.x),
          dy: (original.dy || 0) + (py - anchor.y),
          scale: original.scale || 1
        });
        this.statusMessage = `Free moving ${bone.name || bone.id}`;
        return true;
      }
      if (drag.poseTarget?.action === 'ik-chain' && drag.ikTarget?.parentBoneId && drag.ikTarget?.childBoneId) {
        const parent = this.boneRig.bones.find((entry) => entry.id === drag.ikTarget.parentBoneId);
        const targetSide = parent
          ? Math.sign((Math.cos(parent.angle) * (py - parent.start.y)) - (Math.sin(parent.angle) * (px - parent.start.x)))
          : 0;
        const patches = solveTwoBoneIkPose(this.boneRig, drag.ikTarget.parentBoneId, drag.ikTarget.childBoneId, { x: px, y: py }, {
          currentPose: drag.basePose || this.getCurrentBonePreviewPose?.() || { bones: {} },
          bendSign: targetSide || undefined
        });
        if (!patches) {
          drag.moved = false;
          this.statusMessage = 'Could not solve this bone chain';
          return true;
        }
        Object.entries(drag.originalIkPoseByBone || {}).forEach(([boneId, original]) => {
          if (!patches[boneId]) return;
          patches[boneId] = {
            ...original,
            ...patches[boneId],
            dx: Number.isFinite(patches[boneId].dx) ? patches[boneId].dx : (original.dx || 0),
            dy: Number.isFinite(patches[boneId].dy) ? patches[boneId].dy : (original.dy || 0),
            scale: Number.isFinite(patches[boneId].scale) ? patches[boneId].scale : (original.scale || 1)
          };
        });
        const setPreviewPatches = typeof this.setBonePreviewPosePatchesAtCurrentTime === 'function'
          ? this.setBonePreviewPosePatchesAtCurrentTime
          : PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime;
        setPreviewPatches.call(this, patches, { basePose: drag.basePose });
        const names = Object.keys(patches)
          .map((boneId) => this.boneRig.bones.find((entry) => entry.id === boneId)?.name || boneId)
          .join(' + ');
        this.statusMessage = `Solving ${names}`;
        return true;
      }
      if (drag.handle === 'rotate-widget' || drag.handle === 'body' || drag.handle === 'start' || drag.poseTarget?.action === 'branch-move') {
        if (drag.poseTarget?.action === 'blocked') {
          drag.moved = false;
          this.statusMessage = 'Locked edges only follow parent or root movement';
          return true;
        }
        if (drag.poseTarget?.action === 'bone-move') {
          const dx = px - drag.start.x;
          const dy = py - drag.start.y;
          const original = drag.originalPose || { angle: 0, dx: 0, dy: 0, scale: 1 };
          const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
            ? this.setBonePreviewPosePatchAtCurrentTime
            : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
          setPreviewPatch.call(this, bone.id, {
            angle: original.angle || 0,
            dx: (original.dx || 0) + dx,
            dy: (original.dy || 0) + dy,
            scale: original.scale || 1
          });
          this.statusMessage = `Moving ${bone.name || bone.id}`;
          return true;
        }
        if (drag.handle === 'start' && drag.rootMoveBoneIds?.length) {
          const dx = px - drag.start.x;
          const dy = py - drag.start.y;
          const patches = {};
          drag.rootMoveBoneIds.forEach((boneId) => {
            const original = drag.originalRootPoseByBone?.[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
            patches[boneId] = {
              ...original,
              dx: (original.dx || 0) + dx,
              dy: (original.dy || 0) + dy
            };
          });
          const setPreviewPatches = typeof this.setBonePreviewPosePatchesAtCurrentTime === 'function'
            ? this.setBonePreviewPosePatchesAtCurrentTime
            : PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime;
          setPreviewPatches.call(this, patches);
          this.statusMessage = 'Moving root bone group';
          return true;
        }
        if (drag.poseTarget?.action === 'branch-move' && drag.branchMovePatchBoneIds?.length) {
          const dx = px - drag.start.x;
          const dy = py - drag.start.y;
          const patches = {};
          drag.branchMovePatchBoneIds.forEach((boneId) => {
            const original = drag.originalBranchPoseByBone?.[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
            patches[boneId] = {
              ...original,
              dx: (original.dx || 0) + dx,
              dy: (original.dy || 0) + dy
            };
          });
          const setPreviewPatches = typeof this.setBonePreviewPosePatchesAtCurrentTime === 'function'
            ? this.setBonePreviewPosePatchesAtCurrentTime
            : PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime;
          setPreviewPatches.call(this, patches, { basePose: drag.basePose });
          this.statusMessage = 'Moving locked branch';
          return true;
        }
        if (edgeMode === 'fixed') {
          drag.moved = false;
          this.statusMessage = 'Locked edges only follow parent or root movement';
          return true;
        }
        if (drag.handle === 'rotate-widget' && drag.widgetRotation?.localNode) {
          const buildNodePatches = typeof this.buildPoseNodeRotationPatches === 'function'
            ? this.buildPoseNodeRotationPatches
            : PixelStudio.prototype.buildPoseNodeRotationPatches;
          const patches = buildNodePatches.call(this, drag, px, py);
          const setPreviewNodePatches = typeof this.setNodePreviewPosePatchesAtCurrentTime === 'function'
            ? this.setNodePreviewPosePatchesAtCurrentTime
            : PixelStudio.prototype.setNodePreviewPosePatchesAtCurrentTime;
          setPreviewNodePatches.call(this, patches);
          const names = Object.keys(patches)
            .map((jointId) => this.boneRig.joints.find((entry) => entry.id === jointId)?.name || 'Node')
            .join(' + ');
          this.statusMessage = `Rotating ${names}`;
          return true;
        }
        if (drag.handle === 'rotate-widget' || (drag.handle === 'start' && drag.fanRotation?.incoming)) {
          const buildPatches = typeof this.buildPoseRotationPatches === 'function'
            ? this.buildPoseRotationPatches
            : PixelStudio.prototype.buildPoseRotationPatches;
          const patches = buildPatches.call(this, drag, bone, px, py);
          const setPreviewPatches = typeof this.setBonePreviewPosePatchesAtCurrentTime === 'function'
            ? this.setBonePreviewPosePatchesAtCurrentTime
            : PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime;
          setPreviewPatches.call(this, patches);
          const names = Object.keys(patches)
            .map((boneId) => this.boneRig.bones.find((entry) => entry.id === boneId)?.name || boneId)
            .join(' + ');
          this.statusMessage = `Rotating ${names}`;
          return true;
        }
        if (drag.handle === 'start' && drag.poseTarget?.action === 'edge') {
          const displayedStart = drag.originalStart || bone.start;
          const desiredAngle = Math.atan2(py - displayedStart.y, px - displayedStart.x);
          const startAngle = Number.isFinite(drag.originalDisplayedAngle)
            ? drag.originalDisplayedAngle
            : bone.angle + (drag.originalPose?.angle || 0);
          const angle = (drag.originalPose?.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
          const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
            ? this.setBonePreviewPosePatchAtCurrentTime
            : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
          setPreviewPatch.call(this, bone.id, {
            angle,
            dx: drag.originalPose?.dx || 0,
            dy: drag.originalPose?.dy || 0,
            scale: drag.originalPose?.scale || 1
          });
          this.statusMessage = `Rotating ${bone.name || bone.id}`;
          return true;
        }
        const skeletonContext = typeof this.getCachedBoneSkeletonContext === 'function'
          ? this.getCachedBoneSkeletonContext()
          : null;
        const jointUsageCounts = skeletonContext?.jointUsageCounts || null;
        const sharedStart = jointUsageCounts
          ? (jointUsageCounts.get(bone.startJointId) || 0) > 1
          : getBoneJointUsageCount(this.boneRig, bone.startJointId) > 1;
        const sharedEnd = jointUsageCounts
          ? (jointUsageCounts.get(bone.endJointId) || 0) > 1
          : getBoneJointUsageCount(this.boneRig, bone.endJointId) > 1;
        if (drag.handle === 'start' && sharedStart) {
          const graph = skeletonContext?.graph || buildBoneGraph(this.boneRig);
          const fixedIncoming = (graph.incomingByJoint.get(bone.startJointId) || [])
            .some((entry) => (entry.jointMode || (entry.stretch ? 'stretch' : 'rotate')) === 'fixed');
          if (fixedIncoming && edgeMode !== 'fixed') {
            const displayedStart = drag.originalStart || bone.start;
            const desiredAngle = Math.atan2(py - displayedStart.y, px - displayedStart.x);
            const startAngle = Number.isFinite(drag.originalDisplayedAngle)
              ? drag.originalDisplayedAngle
              : bone.angle + (drag.originalPose?.angle || 0);
            const angle = (drag.originalPose?.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
            const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
              ? this.setBonePreviewPosePatchAtCurrentTime
              : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
            setPreviewPatch.call(this, bone.id, {
              angle,
              dx: drag.originalPose?.dx || 0,
              dy: drag.originalPose?.dy || 0,
              scale: drag.originalPose?.scale || 1
            });
            return true;
          }
        }
        if (sharedStart || sharedEnd) {
          drag.moved = false;
          this.statusMessage = 'Rotate or move the shared joint to keep linked bones attached';
          return true;
        }
        const dx = (drag.originalPose?.dx || 0) + (px - drag.start.x);
        const dy = (drag.originalPose?.dy || 0) + (py - drag.start.y);
        const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
          ? this.setBonePreviewPosePatchAtCurrentTime
          : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
        setPreviewPatch.call(this, bone.id, { dx, dy });
        return true;
      }
      if (edgeMode === 'fixed') {
        drag.moved = false;
        this.statusMessage = 'Locked edges only follow parent or root movement';
        return true;
      }
      if (edgeMode === 'stretch' || edgeMode === 'spring') {
        const displayedStart = drag.originalStart || bone.start;
        const vx = px - displayedStart.x;
        const vy = py - displayedStart.y;
        const restUx = Math.cos(bone.angle);
        const restUy = Math.sin(bone.angle);
        const projectedLength = Math.max(0.05, vx * restUx + vy * restUy);
        const targetScale = edgeMode === 'spring'
          ? projectedLength / Math.max(1, bone.length)
          : Math.hypot(vx, vy) / Math.max(1, bone.length);
        const scale = edgeMode === 'spring'
          ? clamp(1 + (targetScale - 1) * 0.5, 0.25, 3)
          : Math.max(0.05, targetScale);
        const desiredAngle = Math.atan2(vy, vx);
        const startAngle = Number.isFinite(drag.originalDisplayedAngle)
          ? drag.originalDisplayedAngle
          : bone.angle + (drag.originalPose?.angle || 0);
        const angle = edgeMode === 'spring'
          ? (drag.originalPose?.angle || 0)
          : (drag.originalPose?.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
        const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
          ? this.setBonePreviewPosePatchAtCurrentTime
          : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
        setPreviewPatch.call(this, bone.id, {
          angle,
          dx: drag.originalPose?.dx || 0,
          dy: drag.originalPose?.dy || 0,
          scale
        });
        return true;
      }
      const displayedStart = drag.originalStart || bone.start;
      const desiredAngle = Math.atan2(py - displayedStart.y, px - displayedStart.x);
      const startAngle = Number.isFinite(drag.originalDisplayedAngle)
        ? drag.originalDisplayedAngle
        : bone.angle + (drag.originalPose?.angle || 0);
      const angle = (drag.originalPose?.angle || 0) + shortestAngleDelta(startAngle, desiredAngle);
      const setPreviewPatch = typeof this.setBonePreviewPosePatchAtCurrentTime === 'function'
        ? this.setBonePreviewPosePatchAtCurrentTime
        : PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime;
      setPreviewPatch.call(this, bone.id, {
        angle,
        dx: drag.originalPose?.dx || 0,
        dy: drag.originalPose?.dy || 0
      });
      this.statusMessage = `Rotating ${bone.name || bone.id}`;
      return true;
    }
    const endpointJointId = drag.jointId || (drag.handle === 'start' ? bone.startJointId : bone.endJointId);
    if ((drag.handle === 'start' || drag.handle === 'end') && endpointJointId) {
      this.boneRig = moveBoneJoint(this.boneRig, endpointJointId, { x: px, y: py });
      return true;
    }
    if (drag.handle === 'body') {
      const skeletonContext = typeof this.getCachedBoneSkeletonContext === 'function'
        ? this.getCachedBoneSkeletonContext()
        : null;
      const jointUsageCounts = skeletonContext?.jointUsageCounts || null;
      const sharedStart = jointUsageCounts
        ? (jointUsageCounts.get(bone.startJointId) || 0) > 1
        : getBoneJointUsageCount(this.boneRig, bone.startJointId) > 1;
      const sharedEnd = jointUsageCounts
        ? (jointUsageCounts.get(bone.endJointId) || 0) > 1
        : getBoneJointUsageCount(this.boneRig, bone.endJointId) > 1;
      if (sharedStart || sharedEnd) {
        this.statusMessage = 'Move the shared joint, not the linked bone body';
        return true;
      }
      const dx = px - drag.start.x;
      const dy = py - drag.start.y;
      this.boneRig = moveBoneJoint(this.boneRig, bone.startJointId, { x: drag.originalStart.x + dx, y: drag.originalStart.y + dy });
      this.boneRig = moveBoneJoint(this.boneRig, bone.endJointId, { x: drag.originalEnd.x + dx, y: drag.originalEnd.y + dy });
      return true;
    }
    return false;
  }

  handleBonePointerUp() {
    if (this.leftPanelTab === 'bones' && this.boneEditor.mode === 'time') return true;
    const pendingTap = this.boneEditor.pendingBindNodeTap;
    if (pendingTap) {
      this.boneEditor.pendingBindNodeTap = null;
      const { hit } = pendingTap;
      if (this.leftPanelTab === 'bones' && this.boneEditor.mode === 'bind' && hit?.bone && pendingTap.type !== 'node-select') {
        const restBone = this.boneRig.bones.find((entry) => entry.id === hit.bone.id) || hit.bone;
        this.setBoneChainAnchor(restBone, hit.handle === 'start' ? 'start' : 'end');
        return true;
      }
      if (this.leftPanelTab === 'bones' && this.boneEditor.mode === 'bind' && pendingTap.type === 'node-select') {
        return true;
      }
    }
    const drag = this.boneEditor.drag;
    if (!drag) return false;
    if (drag.type === 'link-create') {
      const start = drag.start;
      const end = drag.current || drag.start;
      if (drag.moved && Math.hypot(end.x - start.x, end.y - start.y) >= 1) {
        this.startHistory('add linked bone', { includeLayers: false });
        const result = createBone(this.boneRig, start, end, { parentId: drag.parentId || null, startJointId: drag.startJointId || null });
        this.boneRig = result.rig;
        this.boneEditor.selectedBoneId = result.bone.id;
        this.setBoneChainAnchor(result.bone, 'end');
        this.ensureSelectedBoneVisible();
        this.commitHistory();
      } else if (drag.awaitingAnchor) {
        this.boneEditor.chainAnchor = { boneId: null, handle: 'end', x: start.x, y: start.y };
        this.statusMessage = 'Tap another point to create the first bone';
      } else {
        this.createLinkedBoneFromAnchor(end);
      }
    } else if (drag.type === 'create') {
      const start = drag.start;
      const end = drag.current || drag.start;
      if (Math.hypot(end.x - start.x, end.y - start.y) >= 1) {
        this.startHistory('add bone', { includeLayers: false });
        const result = createBone(this.boneRig, start, end);
        this.boneRig = result.rig;
        this.boneEditor.selectedBoneId = result.bone.id;
        this.setBoneChainAnchor(result.bone, 'end');
        this.ensureSelectedBoneVisible();
        this.commitHistory();
      }
    } else if (drag.type === 'edit' || drag.type === 'pose') {
      if (drag.type === 'pose' && drag.moved && this.boneEditor.previewPose) {
        this.boneRig = setPoseKeyAtTime(
          this.boneRig,
          this.boneEditor.timeMs || 0,
          this.boneEditor.previewPose.bones,
          this.boneEditor.previewPose.nodes
        );
      }
      this.boneEditor.previewPose = null;
      this.boneEditor.previewPoseTimeMs = null;
      this.boneEditor.previewPoseSignature = null;
      if (drag.moved) this.commitHistory();
      else this.pendingHistory = null;
      const bone = this.boneRig.bones.find((entry) => entry.id === drag.boneId);
      if (drag.widgetRotation?.jointId) {
        const displayedBones = this.getDisplayedBonesForBoneEditor();
        const displayedJoint = this.getDisplayedJointPoint(drag.widgetRotation.jointId, displayedBones);
        this.setBoneJointSelection(drag.widgetRotation.jointId, displayedJoint);
        if (bone) this.boneEditor.selectedBoneId = bone.id;
      } else if (drag.poseTarget?.action === 'branch-move' && bone) {
        this.setBoneChainAnchor(bone, drag.handle === 'start' ? 'start' : 'end');
        this.boneEditor.selectedEdgeBoneId = bone.id;
      } else if (bone) {
        this.setBoneChainAnchor(bone, drag.handle === 'start' ? 'start' : 'end');
        if (drag.handle === 'body') this.boneEditor.selectedEdgeBoneId = bone.id;
      }
    }
    this.boneEditor.drag = null;
    return true;
  }

  getDisplayedBoneAdjacency(displayedBones = this.getDisplayedBonesForBoneEditor()) {
    const cache = this.boneDerivedCache || { revision: 1, boneRevision: 1, overlayAdjacency: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const existing = cache.overlayAdjacency;
    if (existing
      && existing.displayedBones === displayedBones
      && existing.boneRevision === boneRevision) {
      return existing;
    }
    const outgoingByJoint = new Map();
    const incomingByJoint = new Map();
    const jointPointById = new Map();
    displayedBones.forEach((bone) => {
      if (bone.startJointId) {
        if (!outgoingByJoint.has(bone.startJointId)) outgoingByJoint.set(bone.startJointId, []);
        outgoingByJoint.get(bone.startJointId).push(bone);
        if (!jointPointById.has(bone.startJointId)) jointPointById.set(bone.startJointId, bone.start);
      }
      if (bone.endJointId) {
        if (!incomingByJoint.has(bone.endJointId)) incomingByJoint.set(bone.endJointId, []);
        incomingByJoint.get(bone.endJointId).push(bone);
        if (!jointPointById.has(bone.endJointId)) jointPointById.set(bone.endJointId, bone.end);
      }
    });
    cache.overlayAdjacency = {
      displayedBones,
      boneRevision,
      outgoingByJoint,
      incomingByJoint,
      jointPointById
    };
    return cache.overlayAdjacency;
  }

  getActiveBoneOverlayIds(displayedBones = this.getDisplayedBonesForBoneEditor(), adjacency = null) {
    const activeIds = new Set();
    const selectedJointId = this.boneEditor.selectedJointId || this.boneEditor.chainAnchor?.jointId || null;
    if (!selectedJointId) return activeIds;
    const getAdjacency = typeof this.getDisplayedBoneAdjacency === 'function'
      ? this.getDisplayedBoneAdjacency
      : PixelStudio.prototype.getDisplayedBoneAdjacency;
    const graph = adjacency || getAdjacency.call(this, displayedBones);
    const visitJoint = (jointId) => {
      (graph.outgoingByJoint.get(jointId) || []).forEach((bone) => {
        if (activeIds.has(bone.id)) return;
        activeIds.add(bone.id);
        visitJoint(bone.endJointId);
      });
    };
    (graph.incomingByJoint.get(selectedJointId) || []).forEach((bone) => activeIds.add(bone.id));
    (graph.outgoingByJoint.get(selectedJointId) || []).forEach((bone) => activeIds.add(bone.id));
    visitJoint(selectedJointId);
    return activeIds;
  }

  getBoneOverlayNodeIds(displayedBones = this.getDisplayedBonesForBoneEditor(), adjacency = null) {
    const selectedJointId = this.boneEditor.selectedJointId || this.boneEditor.chainAnchor?.jointId || null;
    const downstream = new Set();
    if (!selectedJointId) return { selectedJointId: null, downstream };
    const getAdjacency = typeof this.getDisplayedBoneAdjacency === 'function'
      ? this.getDisplayedBoneAdjacency
      : PixelStudio.prototype.getDisplayedBoneAdjacency;
    const graph = adjacency || getAdjacency.call(this, displayedBones);
    const visitJoint = (jointId) => {
      (graph.outgoingByJoint.get(jointId) || []).forEach((bone) => {
        if (downstream.has(bone.endJointId)) return;
        downstream.add(bone.endJointId);
        visitJoint(bone.endJointId);
      });
    };
    visitJoint(selectedJointId);
    downstream.delete(selectedJointId);
    return { selectedJointId, downstream };
  }

  getDisplayedJointPoint(jointId, displayedBones = this.getDisplayedBonesForBoneEditor(), adjacency = null) {
    if (adjacency?.jointPointById?.has(jointId)) return adjacency.jointPointById.get(jointId);
    for (const bone of displayedBones) {
      if (bone.startJointId === jointId) return bone.start;
      if (bone.endJointId === jointId) return bone.end;
    }
    return this.boneRig.joints.find((joint) => joint.id === jointId) || null;
  }

  getSelectedBoneBindingOverlayIndexes() {
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId) return [];
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const layerIndex = this.canvasState.activeLayerIndex;
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, preview: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const overlay = cache.overlay;
    if (overlay
      && overlay.rig === this.boneRig
      && overlay.ownerId === ownerId
      && overlay.layerIndex === layerIndex
      && overlay.width === width
      && overlay.height === height
      && overlay.boneRevision === boneRevision) {
      return overlay.indexes;
    }
    const limit = width * height;
    const seen = new Set();
    this.boneRig.bindings.forEach((binding) => {
      if (binding.layerIndex !== layerIndex || !binding.boneIds.includes(ownerId)) return;
      binding.pixels.forEach((pixel) => {
        const index = Math.round(Number(pixel.index) || 0);
        if (index >= 0 && index < limit && pixel.weights?.[ownerId] > 0) seen.add(index);
      });
    });
    const indexes = [...seen];
    cache.overlay = {
      rig: this.boneRig,
      ownerId,
      layerIndex,
      width,
      height,
      boneRevision,
      indexes
    };
    return indexes;
  }

  getCachedSelectedBoneBindingOverlayRaster(indexes) {
    if (!indexes.length) return null;
    const ownerId = this.getSelectedBoneOwnerId();
    if (!ownerId) return null;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const layerIndex = this.canvasState.activeLayerIndex;
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, overlayRaster: null, preview: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const raster = cache.overlayRaster;
    if (raster
      && raster.rig === this.boneRig
      && raster.ownerId === ownerId
      && raster.layerIndex === layerIndex
      && raster.width === width
      && raster.height === height
      && raster.boneRevision === boneRevision
      && raster.indexes === indexes) {
      return raster.canvas;
    }
    if (!this.boneOverlayCanvas || !this.boneOverlayCtx) {
      if (typeof document === 'undefined') return null;
      this.boneOverlayCanvas = document.createElement('canvas');
      this.boneOverlayCtx = this.boneOverlayCanvas.getContext('2d');
      if (!this.boneOverlayCtx) return null;
      this.boneOverlayCtx.imageSmoothingEnabled = false;
    }
    this.boneOverlayCanvas.width = width;
    this.boneOverlayCanvas.height = height;
    this.boneOverlayCtx.imageSmoothingEnabled = false;
    this.boneOverlayCtx.clearRect?.(0, 0, width, height);
    this.boneOverlayCtx.fillStyle = 'rgba(130, 245, 154, 0.32)';
    indexes.forEach((index) => {
      const col = index % width;
      const row = Math.floor(index / width);
      this.boneOverlayCtx.fillRect(col, row, 1, 1);
    });
    cache.overlayRaster = {
      rig: this.boneRig,
      ownerId,
      layerIndex,
      width,
      height,
      boneRevision,
      indexes,
      canvas: this.boneOverlayCanvas
    };
    return this.boneOverlayCanvas;
  }

  drawSelectedBoneBindingOverlay(ctx, offsetX, offsetY, zoom) {
    if (this.shouldHideBoneOverlaysDuringPlayback()) return;
    const indexes = this.getSelectedBoneBindingOverlayIndexes();
    if (!indexes.length) return;
    const width = this.canvasState.width;
    const height = this.canvasState.height;
    const raster = this.getCachedSelectedBoneBindingOverlayRaster(indexes);
    if (raster) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(raster, offsetX, offsetY, width * zoom, height * zoom);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(130, 245, 154, 0.32)';
    indexes.forEach((index) => {
      const col = index % width;
      const row = Math.floor(index / width);
      ctx.fillRect(offsetX + col * zoom, offsetY + row * zoom, Math.max(1, zoom), Math.max(1, zoom));
    });
    ctx.restore();
  }

  getBoneGraphOverlaySignature(zoom) {
    const anchor = this.boneEditor?.chainAnchor || null;
    return JSON.stringify({
      mode: this.boneEditor?.mode || 'bones',
      selectedJointId: this.boneEditor?.selectedJointId || null,
      selectedBoneId: this.boneEditor?.selectedBoneId || null,
      selectedEdgeBoneId: this.boneEditor?.selectedEdgeBoneId || null,
      linkMode: Boolean(this.boneEditor?.linkMode),
      anchor: anchor ? {
        boneId: anchor.boneId || null,
        jointId: anchor.jointId || null,
        handle: anchor.handle || null,
        x: Number(anchor.x) || 0,
        y: Number(anchor.y) || 0
      } : null,
      pose: ['pose', 'time'].includes(this.boneEditor?.mode) ? this.getBonePoseCacheSignature() : null,
      zoom
    });
  }

  getBoneGraphOverlayBounds(displayedBones, zoom) {
    const points = [];
    displayedBones.forEach((bone) => {
      if (bone?.start) points.push(bone.start);
      if (bone?.end) points.push(bone.end);
    });
    const anchor = this.boneEditor?.mode === 'bones' && this.boneEditor?.linkMode ? this.boneEditor.chainAnchor : null;
    if (anchor) points.push(anchor);
    if (!points.length) return null;
    let padding = Math.max(3, 28 / Math.max(1, zoom));
    if (this.boneEditor?.mode === 'pose') {
      const selectedJointId = this.boneEditor?.selectedJointId || this.boneEditor?.chainAnchor?.jointId || null;
      const selectedPoint = selectedJointId ? this.getDisplayedJointPoint(selectedJointId, displayedBones) : null;
      if (selectedPoint) {
        const widgetTarget = this.getDisplayedPoseWidgetRotationTarget
          ? this.getDisplayedPoseWidgetRotationTarget(selectedJointId, displayedBones)
          : PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(this, selectedJointId, displayedBones);
        const geometry = this.getPoseRotateWidgetGeometry
          ? this.getPoseRotateWidgetGeometry(selectedPoint, zoom, widgetTarget)
          : PixelStudio.prototype.getPoseRotateWidgetGeometry.call(this, selectedPoint, zoom, widgetTarget);
        if (geometry) {
          points.push(geometry.knob);
          padding = Math.max(padding, geometry.radius + geometry.knobRadius + 0.75);
        }
      }
    }
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;
    points.forEach((point) => {
      minX = Math.min(minX, Number(point.x) || 0);
      minY = Math.min(minY, Number(point.y) || 0);
      maxX = Math.max(maxX, Number(point.x) || 0);
      maxY = Math.max(maxY, Number(point.y) || 0);
    });
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    return {
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY)
    };
  }

  getCachedBoneGraphOverlayRaster(zoom) {
    if (this.shouldHideBoneOverlaysDuringPlayback()) return null;
    if (this.boneEditor?.drag) return null;
    const displayedBones = this.getDisplayedBonesForBoneEditor();
    if (!displayedBones.length && !(this.boneEditor?.mode === 'bones' && this.boneEditor?.linkMode && this.boneEditor?.chainAnchor)) return null;
    if (!this.boneGraphOverlayCanvas || !this.boneGraphOverlayCtx) {
      if (typeof document === 'undefined') return null;
      this.boneGraphOverlayCanvas = document.createElement('canvas');
      this.boneGraphOverlayCtx = this.boneGraphOverlayCanvas.getContext('2d');
      if (!this.boneGraphOverlayCtx) return null;
      this.boneGraphOverlayCtx.imageSmoothingEnabled = false;
    }
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, graphOverlayRaster: null };
    this.boneDerivedCache = cache;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const signature = this.getBoneGraphOverlaySignature(zoom);
    const bounds = this.getBoneGraphOverlayBounds(displayedBones, zoom);
    if (!bounds) return null;
    const pixelWidth = Math.max(1, Math.ceil(bounds.w * zoom));
    const pixelHeight = Math.max(1, Math.ceil(bounds.h * zoom));
    const raster = cache.graphOverlayRaster;
    if (raster
      && raster.rig === this.boneRig
      && raster.boneRevision === boneRevision
      && raster.signature === signature
      && raster.width === pixelWidth
      && raster.height === pixelHeight) {
      return raster;
    }
    this.boneGraphOverlayCanvas.width = pixelWidth;
    this.boneGraphOverlayCanvas.height = pixelHeight;
    this.boneGraphOverlayCtx.imageSmoothingEnabled = false;
    this.boneGraphOverlayCtx.clearRect(0, 0, pixelWidth, pixelHeight);
    this.drawBoneOverlayVector(this.boneGraphOverlayCtx, -bounds.x * zoom, -bounds.y * zoom, zoom, displayedBones);
    cache.graphOverlayRaster = {
      rig: this.boneRig,
      boneRevision,
      signature,
      width: pixelWidth,
      height: pixelHeight,
      bounds,
      canvas: this.boneGraphOverlayCanvas
    };
    return cache.graphOverlayRaster;
  }

  drawBoneOverlay(ctx, offsetX, offsetY, zoom) {
    const raster = this.getCachedBoneGraphOverlayRaster(zoom);
    if (raster) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(raster.canvas, offsetX + raster.bounds.x * zoom, offsetY + raster.bounds.y * zoom);
      ctx.restore();
      return;
    }
    this.drawBoneOverlayVector(ctx, offsetX, offsetY, zoom);
  }

  drawBoneOverlayVector(ctx, offsetX, offsetY, zoom, cachedDisplayedBones = null) {
    if (this.shouldHideBoneOverlaysDuringPlayback()) return;
    ctx.save();
    const displayedBones = cachedDisplayedBones || this.getDisplayedBonesForBoneEditor();
    const adjacency = this.getDisplayedBoneAdjacency
      ? this.getDisplayedBoneAdjacency(displayedBones)
      : null;
    const influence = getBoneInfluenceSets(this.boneRig, this.boneEditor.selectedBoneId);
    const selectedEdgeBoneId = this.boneEditor.selectedEdgeBoneId || null;
    const getPoseTargetEdge = typeof this.getPoseTargetEdgeBone === 'function'
      ? this.getPoseTargetEdgeBone
      : PixelStudio.prototype.getPoseTargetEdgeBone;
    const poseTargetEdgeId = this.boneEditor.mode === 'pose' ? getPoseTargetEdge.call(this)?.id || null : null;
    const highlightedEdgeBoneId = selectedEdgeBoneId || poseTargetEdgeId;
    const activeBoneIds = selectedEdgeBoneId ? new Set() : this.getActiveBoneOverlayIds(displayedBones, adjacency);
    const affectedEdgeIds = new Set(this.getAffectedEdgeBones().map((bone) => bone.id));
    const overlayNodes = highlightedEdgeBoneId
      ? { selectedJointId: null, downstream: new Set() }
      : this.getBoneOverlayNodeIds(displayedBones, adjacency);
    const upstreamJointIds = new Set();
    displayedBones.forEach((bone) => {
      if (!influence.upstream.has(bone.id)) return;
      if (bone.startJointId) upstreamJointIds.add(bone.startJointId);
      if (bone.endJointId) upstreamJointIds.add(bone.endJointId);
    });
    const activeGreen = '#82f59a';
    const selectedYellow = '#ffe16a';
    const downstreamBlue = '#6ad7ff';
    const idleCyan = 'rgba(141,240,255,0.9)';
    const dimCyan = 'rgba(141,240,255,0.45)';
    displayedBones.forEach((bone) => {
      const active = activeBoneIds.has(bone.id);
      const affectedEdge = affectedEdgeIds.has(bone.id);
      const upstream = influence.upstream.has(bone.id);
      const sx = offsetX + bone.start.x * zoom;
      const sy = offsetY + bone.start.y * zoom;
      const ex = offsetX + bone.end.x * zoom;
      const ey = offsetY + bone.end.y * zoom;
      const selectedEdge = highlightedEdgeBoneId === bone.id;
      ctx.strokeStyle = selectedEdge ? selectedYellow : affectedEdge ? activeGreen : (active ? activeGreen : (upstream ? dimCyan : idleCyan));
      ctx.lineWidth = selectedEdge ? 4 : affectedEdge ? 4 : (active ? 3.5 : 2);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const angle = Math.atan2(ey - sy, ex - sx);
      const arrowX = sx + (ex - sx) * 0.64;
      const arrowY = sy + (ey - sy) * 0.64;
      const arrowSize = Math.max(5, Math.min(12, zoom * 0.36));
      ctx.fillStyle = selectedEdge ? selectedYellow : active ? activeGreen : 'rgba(141,240,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(arrowX + Math.cos(angle) * arrowSize, arrowY + Math.sin(angle) * arrowSize);
      ctx.lineTo(arrowX + Math.cos(angle + 2.45) * arrowSize, arrowY + Math.sin(angle + 2.45) * arrowSize);
      ctx.lineTo(arrowX + Math.cos(angle - 2.45) * arrowSize, arrowY + Math.sin(angle - 2.45) * arrowSize);
      ctx.closePath();
      ctx.fill();
      const modeDisplay = this.getBoneEdgeModeDisplay(bone.jointMode || (bone.stretch ? 'stretch' : 'rotate'));
      const badgeX = sx + (ex - sx) * 0.48;
      const badgeY = sy + (ey - sy) * 0.48;
      const badgeR = Math.max(5, Math.min(9, zoom * 0.34));
      ctx.fillStyle = modeDisplay.color;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.font = `${Math.max(8, Math.min(12, badgeR * 1.35))}px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(modeDisplay.marker, badgeX, badgeY + 0.5);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const drawnJoints = new Map();
    displayedBones.forEach((bone) => {
      [
        { id: bone.startJointId, x: bone.start.x, y: bone.start.y },
        { id: bone.endJointId, x: bone.end.x, y: bone.end.y }
      ].forEach((joint) => {
        if (!joint.id || drawnJoints.has(joint.id)) return;
        drawnJoints.set(joint.id, joint);
      });
    });
    drawnJoints.forEach((joint) => {
      const point = this.getDisplayedJointPoint(joint.id, displayedBones, adjacency) || joint;
      const sx = offsetX + point.x * zoom;
      const sy = offsetY + point.y * zoom;
      const selectedJoint = overlayNodes.selectedJointId === joint.id;
      const downstreamJoint = overlayNodes.downstream.has(joint.id);
      const upstream = upstreamJointIds.has(joint.id);
      const active = this.boneEditor.chainAnchor?.jointId === joint.id && this.boneEditor.mode !== 'pose';
      ctx.fillStyle = selectedJoint ? selectedYellow : downstreamJoint ? downstreamBlue : active ? '#ffffff' : upstream ? 'rgba(141,240,255,0.55)' : '#8df0ff';
      ctx.beginPath();
      ctx.arc(sx, sy, (active || selectedJoint) ? Math.max(6, zoom * 0.32) : Math.max(5, zoom * 0.24), 0, Math.PI * 2);
      ctx.fill();
    });
    if (this.boneEditor.mode === 'pose') {
      const selectedJointId = this.boneEditor.selectedJointId || this.boneEditor.chainAnchor?.jointId || null;
      const selectedPoint = selectedJointId ? this.getDisplayedJointPoint(selectedJointId, displayedBones) : null;
      if (selectedPoint) {
        const widgetTarget = this.getDisplayedPoseWidgetRotationTarget
          ? this.getDisplayedPoseWidgetRotationTarget(selectedJointId, displayedBones)
          : PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(this, selectedJointId, displayedBones);
        const geometry = this.getPoseRotateWidgetGeometry
          ? this.getPoseRotateWidgetGeometry(selectedPoint, zoom, widgetTarget)
          : PixelStudio.prototype.getPoseRotateWidgetGeometry.call(this, selectedPoint, zoom, widgetTarget);
        const sx = offsetX + geometry.center.x * zoom;
        const sy = offsetY + geometry.center.y * zoom;
        const radius = geometry.radius * zoom;
        const hx = offsetX + geometry.knob.x * zoom;
        const hy = offsetY + geometry.knob.y * zoom;
        const knobRadius = Math.max(7, geometry.visualKnobRadius * zoom);
        ctx.strokeStyle = selectedYellow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, geometry.handleAngle - Math.PI * 0.75, geometry.handleAngle + Math.PI * 0.75);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,225,106,0.25)';
        ctx.lineWidth = Math.max(12, geometry.knobRadius * zoom * 2);
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(1, knobRadius * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = selectedYellow;
        ctx.beginPath();
        ctx.arc(hx, hy, knobRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#101820';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(3, knobRadius * 0.45), 0, Math.PI * 1.4);
        ctx.stroke();
      }
    }
    const anchor = this.boneEditor.mode === 'bones' && this.boneEditor.linkMode ? this.boneEditor.chainAnchor : null;
    if (anchor) {
      const ax = offsetX + anchor.x * zoom;
      const ay = offsetY + anchor.y * zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(7, zoom * 0.36), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = activeGreen;
      ctx.beginPath();
      ctx.moveTo(ax - Math.max(9, zoom * 0.45), ay);
      ctx.lineTo(ax + Math.max(9, zoom * 0.45), ay);
      ctx.moveTo(ax, ay - Math.max(9, zoom * 0.45));
      ctx.lineTo(ax, ay + Math.max(9, zoom * 0.45));
      ctx.stroke();
    }
    const drag = this.boneEditor.drag;
    if ((drag?.type === 'create' || drag?.type === 'link-create') && drag.start && drag.current) {
      ctx.strokeStyle = 'rgba(130,245,154,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(offsetX + drag.start.x * zoom, offsetY + drag.start.y * zoom);
      ctx.lineTo(offsetX + drag.current.x * zoom, offsetY + drag.current.y * zoom);
      ctx.stroke();
    }
    ctx.restore();
  }


  async choosePixelExportFormat() {
    const choice = await openChoiceOverlay({
      title: 'Export',
      message: 'Choose an export format.',
      choices: [
        { label: 'PNG', value: 'png', primary: true },
        { label: 'GIF', value: 'gif' },
        { label: 'Sprite Sheet', value: 'sprite-sheet' }
      ],
      cancelText: 'Cancel'
    });
    if (choice === 'png') this.exportPng();
    if (choice === 'gif') this.exportGif();
    if (choice === 'sprite-sheet') this.exportSpriteSheet('horizontal');
  }

  drawFilePanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const portrait = isMobile && isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    const allActions = portrait
      ? this.getFilePanelItems().filter((item) => item.divider || !PIXEL_PORTRAIT_FILE_HIDE_IDS.has(item.id))
      : this.getFilePanelItems();
    const stickyExit = isMobile && (
      isMobilePortraitLayout({
        isMobile,
        viewportWidth: this.game?.canvas?.width || 0,
        viewportHeight: this.game?.canvas?.height || 0
      })
      || isMobileLandscapeLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
      })
    );
    const { listItems: actions, exitItem } = stickyExit
      ? splitFileDrawerStickyExitItems(allActions)
      : { listItems: allActions, exitItem: null };

    const rowHeight = this.sharedMenu.getButtonHeight(isMobile);
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const visibleRows = Math.max(1, Math.floor(Math.max(0, h - 24) / Math.max(1, rowHeight + rowGap)));
    this.focusScroll.file = this.controllerMenu.syncScrollToItem(
      'file',
      this.controllerMenu.getFocusedItem('file')?.id,
      actions,
      visibleRows,
      this.focusScroll.file || 0
    );
    const result = this.sharedMenu.drawDrawer(ctx, {
      panel: { x, y, w, h },
      title: '',
      items: actions,
      scroll: this.focusScroll.file || 0,
      isMobile,
      showTitle: false,
      footerMode: stickyExit && exitItem ? 'exit-only' : 'none',
      footerItem: exitItem,
      drawButton: (bounds, item) => {
        const onClick = item.onClick || item.action;
        this.drawButton(ctx, bounds, item.label, false, {
          fontSize: isMobile ? 12 : 12,
          focused: this.controllerMenu.isFocusedItem('file', item.id)
        });
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
        y: y + 10 + row * (buttonHeight + gap),
        w: controlWidth,
        h: buttonHeight
      };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });

    const controlRows = Math.ceil(paletteControls.length / perRow);
    let offsetY = y + 10 + controlRows * (buttonHeight + gap) + 8;
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

  drawStatusBar(ctx, x, y, w, h, options = {}) {
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

    if (['layers', 'animation'].includes(this.leftPanelTab)) {
      const actions = this.getBottomRailActions();
      const buttonW = 62;
      const gap = 6;
      let bx = x + w - (actions.length * (buttonW + gap));
      actions.forEach((entry) => {
        const bounds = { x: bx, y: y + 1, w: buttonW, h: h - 2 };
        this.drawButton(ctx, bounds, entry.label, false, { fontSize: 11 });
        this.uiButtons.push({ bounds, onClick: entry.action, group: options.group || 'menu' });
        this.registerFocusable('menu', bounds, entry.action);
        bx += buttonW + gap;
      });
    }
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
      const action = () => this.runSelectionAction(entry.onClick || entry.action);
      this.uiButtons.push({ bounds, onClick: action, group: 'selection-actions' });
      this.registerFocusable('menu', bounds, action);
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
      { id: 'brush', label: 'Brush', action: () => this.openBrushPicker() },
      { id: 'color', label: 'Color', action: () => { this.paletteGridOpen = true; } },
      { id: 'canvas', label: 'Canvas', action: () => { this.setLeftPanelTab('canvas'); this.mobileDrawer = 'panel'; } },
      { id: 'layers', label: 'Layers', action: () => { this.setLeftPanelTab('layers'); this.mobileDrawer = 'panel'; } },
      { id: 'animation', label: 'Anim', action: () => { this.setLeftPanelTab('animation'); this.mobileDrawer = 'panel'; } },
      { id: 'bones', label: 'Rigging', action: () => this.enterRiggingBuildMode() }
    ];
    const gap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const buttonH = SHARED_EDITOR_LEFT_MENU.buttonHeightMobile;
    const metrics = h < actions.length * (buttonH + gap) + 16
      ? getSharedPortraitMenuMetrics({ x, y, w, h }, { rowHeight: buttonH, rowGap: gap })
      : null;
    const listBounds = metrics?.listBounds || { x: x + 6, y: y + 8, w: w - 12, h: h - 16 };
    const buttonW = Math.min(listBounds.w, SHARED_EDITOR_LEFT_MENU.buttonWidthMobile);
    const visibleRows = metrics?.visibleRows ?? actions.length;
    const rootScroll = metrics
      ? this.controllerMenu.syncScrollToItem(
        'root',
        this.controllerMenu.getFocusedItem('root')?.id,
        actions,
        visibleRows,
        this.controllerMenu.scroll?.root || 0
      )
      : 0;
    actions.slice(rootScroll, rootScroll + visibleRows).forEach((entry, index) => {
      const bounds = {
        x: listBounds.x + (listBounds.w - buttonW) * 0.5,
        y: listBounds.y + index * (buttonH + gap),
        w: buttonW,
        h: buttonH
      };
      const active = entry.id === this.leftPanelTab && entry.id !== 'fit';
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: entry.action });
      this.registerFocusable('toolbar', bounds, entry.action);
    });
    if (metrics) {
      drawSharedPortraitScrollHints(ctx, { x, y, w, h }, {
        scroll: rootScroll,
        scrollMax: Math.max(0, actions.length - visibleRows)
      });
    }
  }

  drawMobilePortraitLayout(ctx, width, height) {
    const sheetOpen = this.mobileDrawer === 'panel' || this.controllerMenu.active;
    const layout = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      menuSheetOpen: sheetOpen
    });
    const { menuSheet, rootRail, subRail, actionRail, workSurface, paletteStrip, zoomStrip, padding } = layout;

    const railLayout = getSharedPortraitActionRailLayout(actionRail);
    const actionArea = railLayout.actionArea;
    this.panJoystick.center = railLayout.thumbstickCenter;
    this.panJoystick.radius = railLayout.thumbstickRadius;
    this.panJoystick.knobRadius = railLayout.knobRadius;
    this.mobileZoomSliderBounds = null;
    this.mobileZoomDrag = null;
    drawSharedPanel(ctx, actionRail, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    this.drawMobileToolbar(ctx, actionArea.x, actionArea.y, actionArea.w, actionArea.h);
    drawSharedThumbstick(ctx, this.panJoystick);

    ctx.fillStyle = UI_SUITE.colors.panelAlt;
    ctx.fillRect(workSurface.x, workSurface.y, workSurface.w, workSurface.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(workSurface.x, workSurface.y, workSurface.w, workSurface.h);
    this.drawCanvasArea(ctx, workSurface.x, workSurface.y, workSurface.w, workSurface.h);

    if (!sheetOpen && this.selection.active && this.leftPanelTab !== 'bones') {
      const ribbonH = 46;
      const ribbonBounds = {
        x: workSurface.x + 8,
        y: Math.max(workSurface.y + 8, workSurface.y + workSurface.h - ribbonH - 8),
        w: Math.max(1, workSurface.w - 16),
        h: ribbonH
      };
      drawSharedContextRibbon(ctx, ribbonBounds, [
        { id: 'paste', label: 'Paste', onClick: () => this.runSelectionAction(() => this.pasteClipboard()) },
        { id: 'copy', label: 'Copy', onClick: () => this.runSelectionAction(() => this.copySelection()) },
        { id: 'cut', label: 'Cut', onClick: () => this.runSelectionAction(() => this.cutSelection()) },
        { id: 'delete', label: 'Delete', onClick: () => this.runSelectionAction(() => this.deleteSelection()) },
        { id: 'clear', label: 'Clear', onClick: () => this.runSelectionAction(() => this.clearSelection()) }
      ], {
        title: '',
        drawButton: (bounds, action) => {
          this.drawButton(ctx, bounds, action.label, false, { fontSize: 11 });
          this.uiButtons.push({ bounds, onClick: action.onClick, group: 'selection-actions' });
          this.registerFocusable('selection-context', bounds, action.onClick);
        }
      });
    }

    if (zoomStrip) {
      this.drawPixelPortraitZoomSlider(ctx, zoomStrip);
    }

    if (paletteStrip && this.leftPanelTab === 'bones') {
      this.drawBoneContextRail(ctx, paletteStrip.x, paletteStrip.y, paletteStrip.w, paletteStrip.h, { isMobile: true });
    } else if (paletteStrip) {
      this.drawPaletteBar(ctx, paletteStrip.x, paletteStrip.y, paletteStrip.w, paletteStrip.h, { isMobile: true });
    }

    if (sheetOpen) {
      this.mobileDrawerBounds = { ...menuSheet };
      drawSharedPortraitSheet(ctx, menuSheet);
      this.drawMobilePortraitRootTabs(ctx, rootRail);
      this.drawLeftPanelContent(ctx, subRail.x + padding, subRail.y + padding, subRail.w - padding * 2, subRail.h - padding * 2, { isMobile: true });
    } else {
      this.mobileDrawerBounds = null;
    }

    if (this.brushPickerOpen) {
      this.drawBrushPickerModal(ctx, padding, workSurface.y + Math.max(12, workSurface.h * 0.08), width - padding * 2, Math.min(workSurface.h * 0.82, height - workSurface.y - padding * 2));
    }
    if (this.paletteGridOpen) {
      this.drawPaletteGridSheet(ctx, padding, workSurface.y + workSurface.h * 0.2, width - padding * 2, workSurface.h * 0.72);
    }
    if (this.modeTab === 'animate' && this.mobileDrawer === 'timeline') {
      this.drawTimelineSheet(ctx, padding, actionRail.y, width - padding * 2, actionRail.h);
    }
    this.drawTransportPopover(ctx);
  }

  drawPixelPortraitZoomSlider(ctx, bounds) {
    const rail = {
      x: bounds.x + 18,
      y: bounds.y + Math.floor((bounds.h - 10) / 2),
      w: Math.max(1, bounds.w - 36),
      h: 10
    };
    const hit = {
      x: rail.x,
      y: bounds.y,
      w: rail.w,
      h: bounds.h
    };
    this.mobileZoomSliderBounds = hit;
    const zoomT = this.view.zoomIndex / Math.max(1, this.view.zoomLevels.length - 1);
    ctx.save();
    drawSharedMobileZoomSlider(ctx, rail, zoomT);
    ctx.restore();
    this.uiButtons.push({
      bounds: hit,
      onClick: ({ x: pointerX }) => this.updateZoomFromSliderX(pointerX),
      onDrag: ({ x: pointerX }) => this.updateZoomFromSliderX(pointerX)
    });
  }

  drawMobilePortraitRootTabs(ctx, bounds) {
    const rootTabs = buildPixelPortraitMenuModel().rootTabs;
    const tabs = [...rootTabs, { id: 'bones', panel: 'bones', label: 'Rigging' }].map((tab) => ({
      ...tab,
      action: () => {
        if (tab.panel === 'bones') {
          this.enterRiggingBuildMode();
          return;
        }
        this.setLeftPanelTab(tab.panel);
        this.mobileDrawer = 'panel';
      }
    }));
    const activeId = this.leftPanelTab === 'animation' ? 'frames' : this.leftPanelTab;
    drawSharedPortraitMultiRowTabStrip(ctx, bounds, tabs, {
      activeId,
      focusedId: this.controllerMenu.getFocusedItem('root')?.id,
      minButtonWidth: 64,
      maxButtonWidth: 112,
      maxRows: 2,
      balanceLastRow: true,
      drawButton: (buttonBounds, tab, state) => {
        this.drawButton(ctx, buttonBounds, tab.label, state.active, {
          fontSize: 12,
          focused: state.focused
        });
        this.uiButtons.push({ bounds: buttonBounds, onClick: tab.action });
        this.registerFocusable('toolbar', buttonBounds, tab.action);
      }
    });
  }

  drawMobileToolbar(ctx, x, y, w, h) {
    const portrait = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    if (portrait) {
      const actions = [
        { id: 'menu', label: '☰', onClick: () => this.togglePixelPortraitDrawer() },
        { id: 'undo', label: '↶', onClick: () => this.runtime.undo() },
        { id: 'redo', label: '↷', onClick: () => this.runtime.redo() }
      ];
      if (this.leftPanelTab === 'animation') {
        actions.push({ id: 'play', label: this.animation.playing ? '⏸' : '▶', active: this.animation.playing, primary: true, onClick: () => { this.animation.playing = !this.animation.playing; }, onHold: true });
      } else if (this.leftPanelTab === 'bones') {
        actions.push({
          id: 'bone-play',
          label: this.boneEditor?.playing ? '⏸' : '▶',
          active: Boolean(this.boneEditor?.playing),
          primary: true,
          onClick: () => this.toggleBoneTimelinePlayback(),
          onHold: true,
          transportMode: 'bones'
        });
      } else if (this.decalEditSession?.type === 'actor-state') {
        actions.push({ id: 'test', label: '▶', primary: true, onClick: () => this.game.startActorEditorPlaytest(this.decalEditSession.actorId, this.game.actorEditor?.actor?.id === this.decalEditSession.actorId ? this.game.actorEditor.actor : null) });
      } else {
        actions.push({ id: 'brush', label: '', primary: true, onClick: () => this.openBrushPicker('size') });
      }
      drawSharedPortraitActionRail(ctx, { x, y, w, h }, null, actions, {
        drawPanel: false,
        reserveThumbstick: false,
        drawButton: (bounds, action) => {
          if (action.id === 'brush') {
            this.drawButton(ctx, bounds, '', Boolean(action.active), { fontSize: 14 });
            ctx.save();
            const chipInset = 7;
            this.drawBrushPreviewChip(ctx, {
              x: bounds.x + chipInset,
              y: bounds.y + chipInset,
              w: bounds.w - chipInset * 2,
              h: bounds.h - chipInset * 2
            });
            ctx.restore();
          } else {
            this.drawButton(ctx, bounds, action.label, Boolean(action.active), { fontSize: 14 });
          }
          this.uiButtons.push({ bounds, onClick: action.onClick || action.action, onHold: action.onHold, transportMode: action.transportMode });
          this.registerFocusable('toolbar', bounds, action.onClick || action.action);
        }
      });
      return;
    }
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    const buttonH = Math.max(34, h - 8);
    const buttonY = y + Math.floor((h - buttonH) / 2);
    const gap = 6;
    const previewSize = Math.min(40, Math.max(34, buttonH));
    const brushPreviewBounds = {
      x: x + 8,
      y: y + Math.floor((h - previewSize) / 2),
      w: previewSize,
      h: previewSize
    };
    this.drawBrushPreviewChip(ctx, brushPreviewBounds);
    this.uiButtons.push({ bounds: brushPreviewBounds, onClick: () => this.openBrushPicker() });
    this.registerFocusable('toolbar', brushPreviewBounds, () => this.openBrushPicker());

    const registerBounds = {
      x: brushPreviewBounds.x + brushPreviewBounds.w + gap,
      y: y + Math.floor((h - previewSize) / 2),
      w: previewSize,
      h: previewSize
    };
    this.drawColorRegisterToggle(ctx, registerBounds);

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
      ...(this.decalEditSession?.type === 'actor-state' ? [{ label: 'Test', action: () => this.game.startActorEditorPlaytest(this.decalEditSession.actorId, this.game.actorEditor?.actor?.id === this.decalEditSession.actorId ? this.game.actorEditor.actor : null) }] : []),
      { label: '☰', action: () => { this.mobileDrawer = 'panel'; } },
      { label: '↶', action: () => this.runtime.undo() },
      { label: '↷', action: () => this.runtime.redo() }
    );
    if (this.leftPanelTab === 'animation') {
      actions.unshift({
        label: this.animation.playing ? '⏸' : '▶',
        action: () => { this.animation.playing = !this.animation.playing; }
      });
    }

    const actionAreaStartX = registerBounds.x + registerBounds.w + gap;
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

  drawMobilePanZoomControls(ctx, width, height, surfaceBounds = null) {
    if (!this.isMobileLayout()) {
      this.resetMobilePanZoomControls();
      return;
    }
    const controlWidth = surfaceBounds?.w || width;
    const controlHeight = surfaceBounds?.h || height;
    const { center, radius: joystickRadius, knobRadius, controlMargin } = getSharedThumbstickLayout(controlWidth, controlHeight, {
      controlMargin: 18
    });
    const joystickCenter = surfaceBounds
      ? { x: surfaceBounds.x + center.x, y: surfaceBounds.y + center.y }
      : center;
    this.panJoystick.center = joystickCenter;
    this.panJoystick.radius = joystickRadius;
    this.panJoystick.knobRadius = knobRadius;

    let { railBounds, hitBounds } = getSharedMobileZoomSliderLayout({
      width: controlWidth,
      height: controlHeight,
      joystickCenterX: surfaceBounds ? center.x : joystickCenter.x,
      joystickRadius,
      controlMargin
    });
    if (surfaceBounds) {
      railBounds = { ...railBounds, x: railBounds.x + surfaceBounds.x, y: railBounds.y + surfaceBounds.y };
      hitBounds = { ...hitBounds, x: hitBounds.x + surfaceBounds.x, y: hitBounds.y + surfaceBounds.y };
    }
    this.mobileZoomSliderBounds = hitBounds;

    const zoomT = this.view.zoomIndex / Math.max(1, this.view.zoomLevels.length - 1);
    ctx.save();
    drawSharedMobileZoomSlider(ctx, railBounds, zoomT);

    drawSharedThumbstick(ctx, this.panJoystick);
    ctx.restore();

    this.uiButtons.push({
      bounds: this.mobileZoomSliderBounds,
      onClick: ({ x: pointerX }) => {
        this.updateZoomFromSliderX(pointerX);
      },
      onDrag: ({ x: pointerX }) => {
        this.updateZoomFromSliderX(pointerX);
      }
    });
  }

  resetMobilePanZoomControls() {
    this.mobileZoomSliderBounds = null;
    this.mobileZoomDrag = null;
    resetSharedThumbstickState(this.panJoystick);
  }

  drawColorRegisterToggle(ctx, bounds) {
    const backRegister = this.activeColorRegister === 0 ? 1 : 0;
    const frontHex = getPaletteSwatchHex(this.currentPalette, this.colorRegisters[this.activeColorRegister] ?? this.paletteIndex);
    const backHex = getPaletteSwatchHex(this.currentPalette, this.colorRegisters[backRegister] ?? this.paletteIndex);
    const inset = Math.max(6, Math.floor(bounds.w * 0.18));
    const backBounds = { x: bounds.x + inset, y: bounds.y + inset, w: bounds.w - inset, h: bounds.h - inset };
    const frontBounds = { x: bounds.x, y: bounds.y, w: bounds.w - inset, h: bounds.h - inset };

    ctx.fillStyle = backHex;
    ctx.fillRect(backBounds.x, backBounds.y, backBounds.w, backBounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(backBounds.x, backBounds.y, backBounds.w, backBounds.h);

    ctx.fillStyle = frontHex;
    ctx.fillRect(frontBounds.x, frontBounds.y, frontBounds.w, frontBounds.h);
    ctx.strokeStyle = '#ffe16a';
    ctx.lineWidth = 2;
    ctx.strokeRect(frontBounds.x, frontBounds.y, frontBounds.w, frontBounds.h);

    this.uiButtons.push({ bounds, onClick: () => this.toggleActiveColorRegister() });
    this.registerFocusable('toolbar', bounds, () => this.toggleActiveColorRegister());
  }

  drawBrushPreviewChip(ctx, bounds) {
    this.drawBrushShapePreview(ctx, bounds, this.toolOptions.brushShape, 7);
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
    } else if (type === 'falloff') {
      this.brushPickerDraft.brushFalloff = t;
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
      h: Math.max(270, h)
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
    const focusLabels = {
      shape: 'Shape',
      size: 'Size',
      opacity: 'Opacity',
      hardness: 'Hardness',
      falloff: 'Falloff'
    };
    const focusLabel = focusLabels[this.brushPickerFocus] || '';
    ctx.fillText(focusLabel ? `Brushes / ${focusLabel}` : 'Brushes', modal.x + 12, titleY);

    const cols = 4;
    const rowGap = 8;
    const cellGap = 8;
    const gridY = titleY + 10;
    const footerH = 138;
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
    const secondarySliderW = Math.floor((modal.w - 36) / 2);
    ctx.fillText(`Hardness: ${Math.round((draft.brushHardness ?? 0) * 100)}%`, modal.x + 12, hardnessLabelY);
    ctx.fillText(`Falloff: ${Math.round((draft.brushFalloff ?? 0) * 100)}%`, modal.x + modal.w / 2 + 6, hardnessLabelY);
    const hardnessSlider = { x: modal.x + 12, y: hardnessLabelY + 8, w: secondarySliderW, h: 12 };
    const falloffSlider = { x: modal.x + modal.w / 2 + 6, y: hardnessLabelY + 8, w: secondarySliderW, h: 12 };

    const drawSlider = (bounds, t, active = false) => {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      const knobX = bounds.x + clamp(t, 0, 1) * bounds.w;
      ctx.fillStyle = 'rgba(0,200,255,0.95)';
      ctx.fillRect(knobX - 2, bounds.y - 2, 4, bounds.h + 4);
    };
    drawSlider(sizeSlider, (draft.brushSize - BRUSH_SIZE_MIN) / Math.max(1, BRUSH_SIZE_MAX - BRUSH_SIZE_MIN), this.brushPickerFocus === 'size');
    drawSlider(opacitySlider, ((draft.brushOpacity ?? 1) - 0.05) / 0.95, this.brushPickerFocus === 'opacity');
    drawSlider(hardnessSlider, draft.brushHardness ?? 0, this.brushPickerFocus === 'hardness');
    drawSlider(falloffSlider, draft.brushFalloff ?? 0, this.brushPickerFocus === 'falloff');

    this.brushPickerSliders = { size: sizeSlider, opacity: opacitySlider, hardness: hardnessSlider, falloff: falloffSlider };

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
    this.uiButtons.push({
      bounds: { x: falloffSlider.x, y: falloffSlider.y - 8, w: falloffSlider.w, h: falloffSlider.h + 16 },
      onClick: ({ x: pointerX, id: pointerId }) => {
        if (!this.brushPickerDraft) this.syncBrushPickerDraft();
        this.brushPickerDrag = { type: 'falloff', id: pointerId ?? null };
        this.updateBrushPickerSliderFromX('falloff', pointerX);
      }
    });

    const buttonY = modal.y + modal.h - 34;
    const cancelBounds = { x: modal.x + modal.w - 212, y: buttonY - 2, w: 96, h: 28 };
    const okBounds = { x: modal.x + modal.w - 106, y: buttonY - 2, w: 96, h: 28 };
    this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
    this.drawButton(ctx, okBounds, 'OK', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: cancelBounds, onClick: () => this.closeBrushPicker({ apply: false }) });
    this.uiButtons.push({ bounds: okBounds, onClick: () => this.closeBrushPicker({ apply: true }) });
    ctx.restore();
  }

  drawPixelBackground(ctx, x, y, w, h, cellSize = 16) {
    const mode = this.view.backgroundMode || 'checker';
    if (mode === 'white' || mode === 'black' || mode === 'color') {
      ctx.fillStyle = mode === 'white'
        ? '#ffffff'
        : (mode === 'black' ? '#000000' : (this.view.backgroundColor || '#2f3640'));
      ctx.fillRect(x, y, w, h);
      return;
    }

    const size = clamp(Math.round(cellSize), 4, 32);
    const visibleX = Math.max(0, x);
    const visibleY = Math.max(0, y);
    const visibleEndX = Math.min(ctx.canvas.width, x + w);
    const visibleEndY = Math.min(ctx.canvas.height, y + h);
    if (visibleEndX <= visibleX || visibleEndY <= visibleY) return;

    const originRight = x + w;
    const originTop = y;
    const firstColFromRight = Math.floor((originRight - visibleEndX) / size);
    const firstRow = Math.floor((visibleY - originTop) / size);
    const maxColFromRight = Math.ceil((originRight - visibleX) / size);
    const maxRow = Math.ceil((visibleEndY - originTop) / size);
    for (let row = firstRow; row < maxRow; row += 1) {
      const cellY = originTop + row * size;
      const drawY = Math.max(visibleY, cellY);
      const drawH = Math.min(visibleEndY, cellY + size) - drawY;
      if (drawH <= 0) continue;
      for (let colFromRight = firstColFromRight; colFromRight < maxColFromRight; colFromRight += 1) {
        const cellRight = originRight - colFromRight * size;
        const cellX = cellRight - size;
        const drawX = Math.max(visibleX, cellX);
        const drawW = Math.min(visibleEndX, cellRight) - drawX;
        if (drawW <= 0) continue;
        ctx.fillStyle = ((colFromRight + row) % 2 === 0) ? '#747b86' : '#3a414a';
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }
    }
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

    const compactFooter = sheetW < 430;
    const footerH = compactFooter ? 82 : 44;
    const footerTop = sheetY + sheetH - footerH;
    const footerButtonH = 32;
    const footerGap = 6;
    const footerRowY = compactFooter ? footerTop + 4 : sheetY + sheetH - 44;
    const addBounds = { x: sheetX + 12, y: footerRowY, w: 54, h: footerButtonH };
    const removeBounds = { x: addBounds.x + addBounds.w + footerGap, y: footerRowY, w: 54, h: footerButtonH };
    const closeBounds = compactFooter
      ? { x: sheetX + sheetW - 96, y: footerTop + 44, w: 84, h: footerButtonH }
      : { x: sheetX + sheetW - 96, y: footerRowY, w: 84, h: footerButtonH };
    const setFromImageRight = compactFooter ? sheetX + sheetW - 12 : closeBounds.x - footerGap;
    const setFromImageBounds = {
      x: removeBounds.x + removeBounds.w + footerGap,
      y: footerRowY,
      w: Math.max(92, setFromImageRight - (removeBounds.x + removeBounds.w + footerGap)),
      h: footerButtonH
    };
    if (!this.paletteRemoveMode) {
      this.drawButton(ctx, addBounds, '+', false, { fontSize: 12 });
      this.drawButton(ctx, removeBounds, '-', false, { fontSize: 12 });
      this.drawButton(ctx, setFromImageBounds, 'Set From Image', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: addBounds, onClick: () => this.openPaletteColorPicker() });
      this.uiButtons.push({ bounds: removeBounds, onClick: () => { this.paletteRemoveMode = true; this.paletteRemoveMarked.clear(); } });
      this.uiButtons.push({ bounds: setFromImageBounds, onClick: () => this.setPaletteFromCurrentImage(24) });
    }

    const swatchSize = 38;
    const gap = 8;
    const topY = sheetY + 44;
    const swatchAreaH = Math.max(80, footerTop - topY - 6);
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
      const pickerFooterButtonH = 32;
      const pickerFooterGap = 6;
      const sliderH = 18;
      const sliderCount = 6;
      const contentY = pickerY + contentPadding;
      const contentH = pickerH - (contentPadding * 2) - pickerFooterButtonH - pickerFooterGap;
      const sliderGap = Math.max(12, Math.floor(pickerW * 0.015));
      const sliderW = Math.max(170, Math.floor(pickerW * 0.36));
      const leftW = Math.max(140, pickerW - (contentPadding * 2) - sliderGap - sliderW);
      const hueW = clamp(Math.floor(leftW * 0.11), 18, 28);
      const hexFieldH = 24;
      const hexGap = 8;
      const previewH = 30;
      const previewGap = 8;
      const leftAreaH = Math.max(120, contentH - hexFieldH - hexGap - previewH - previewGap);
      const svSize = Math.max(120, Math.min(leftW - hueW - contentPadding, leftAreaH));
      const sv = { x: pickerX + contentPadding, y: contentY, w: svSize, h: svSize };
      const hue = { x: sv.x + sv.w + contentPadding, y: sv.y, w: hueW, h: sv.h };
      const previewBounds = {
        x: sv.x,
        y: sv.y + sv.h + previewGap,
        w: Math.min(leftW, sv.w + contentPadding + hue.w),
        h: previewH
      };

      const sliderX = hue.x + hue.w + sliderGap;
      const sliderAreaH = Math.max(100, contentH);
      const sliderRowStep = Math.max(sliderH + 6, Math.floor(sliderAreaH / sliderCount));
      const sliderBlockH = sliderCount * sliderRowStep;

      const quantizationLevels = this.paletteColorDraft.quantization || 32;
      const displayHue = this.getPaletteDraftDisplayHue();
      const rgbToHex = (rgb) => this.rgbToHex(rgb.r, rgb.g, rgb.b);
      const svSamples = buildPixelQuantizedSvSamples(displayHue, quantizationLevels);
      const svBlockW = sv.w / svSamples.size;
      const svBlockH = sv.h / svSamples.size;
      svSamples.samples.forEach((sample) => {
        ctx.fillStyle = rgbToHex(sample.rgb);
        ctx.fillRect(sv.x + sample.sx * svBlockW, sv.y + sample.vy * svBlockH, Math.ceil(svBlockW), Math.ceil(svBlockH));
      });
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(sv.x, sv.y, sv.w, sv.h);

      const hueSamples = buildPixelQuantizedHueSamples(quantizationLevels);
      const hueBlockH = hue.h / Math.max(1, hueSamples.length);
      hueSamples.forEach((sample, index) => {
        ctx.fillStyle = rgbToHex(sample.rgb);
        ctx.fillRect(hue.x, hue.y + index * hueBlockH, hue.w, Math.ceil(hueBlockH));
      });
      ctx.strokeRect(hue.x, hue.y, hue.w, hue.h);

      const svX = sv.x + this.paletteColorDraft.s * sv.w;
      const svY = sv.y + (1 - this.paletteColorDraft.v) * sv.h;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(svX - 4, svY - 4, 8, 8);
      const hueY = hue.y + (displayHue / 360) * hue.h;
      ctx.strokeRect(hue.x - 2, hueY - 2, hue.w + 4, 4);

      const currentHex = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b).toUpperCase();
      ctx.fillStyle = currentHex;
      ctx.fillRect(previewBounds.x, previewBounds.y, previewBounds.w, previewBounds.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.strokeRect(previewBounds.x, previewBounds.y, previewBounds.w, previewBounds.h);
      const previewLuma = (this.paletteColorDraft.r * 0.299) + (this.paletteColorDraft.g * 0.587) + (this.paletteColorDraft.b * 0.114);
      ctx.fillStyle = previewLuma > 150 ? '#101010' : '#ffffff';
      ctx.font = '13px Courier New';
      ctx.fillText(currentHex, previewBounds.x + 8, previewBounds.y + Math.floor(previewBounds.h * 0.68));

      const buttonY = pickerY + pickerH - pickerFooterButtonH - 8;
      const pickerAddW = 58;
      const pickerCancelW = 70;
      const pickerQuantW = 76;
      const pickerOk = { x: pickerX + pickerW - contentPadding - pickerAddW, y: buttonY, w: pickerAddW, h: pickerFooterButtonH };
      const pickerCancel = { x: pickerOk.x - pickerFooterGap - pickerCancelW, y: buttonY, w: pickerCancelW, h: pickerFooterButtonH };
      const quantBounds = { x: pickerCancel.x - pickerFooterGap - pickerQuantW, y: buttonY, w: pickerQuantW, h: pickerFooterButtonH };
      const hexBounds = {
        x: sv.x,
        y: buttonY + Math.floor((footerButtonH - hexFieldH) / 2),
        w: Math.max(80, Math.min(sv.w, quantBounds.x - pickerFooterGap - sv.x)),
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
      addSlider('H', 'h', displayHue, 0, 360, sliderX, sy, sliderW);
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
        this.setPaletteDraftFromSvPointer(px, py, sv);
      } });
      this.uiButtons.push({ bounds: { x: hue.x, y: hue.y, w: hue.w, h: hue.h }, onClick: ({ y: py, id: pointerId }) => {
        this.palettePickerDrag = { type: 'hue', id: pointerId ?? null, bounds: hue };
        this.setPaletteDraftFromHuePointer(py, hue);
      } });

      const q = this.paletteColorDraft.quantization || 32;
      const quantLabel = q === 8 ? 'Q 8' : (q === 16 ? 'Q 16' : 'Q 32');
      this.drawButton(ctx, quantBounds, quantLabel, false, { fontSize: 12 });
      this.drawButton(ctx, pickerCancel, 'Cancel', false, { fontSize: 12 });
      this.drawButton(ctx, pickerOk, 'Add', false, { fontSize: 12 });
      this.uiButtons.push({
        bounds: quantBounds,
        onClick: () => {
          const levels = [8, 16, 32];
          const current = levels.indexOf(this.paletteColorDraft.quantization || 32);
          const next = levels[(current + 1 + levels.length) % levels.length];
          this.paletteColorDraft.quantization = next;
          this.paletteQuantization = next;
          this.syncPaletteDraftFromRgb();
        }
      });
      this.uiButtons.push({ bounds: pickerCancel, onClick: () => { this.paletteColorPickerOpen = false; this.paletteColorDraft = null; this.palettePickerDrag = null; this.paletteColorPickerBounds = null; } });
      this.uiButtons.push({ bounds: pickerOk, onClick: () => this.applyPaletteColorPickerAdd() });
      return;
    }

    if (!this.paletteColorPickerOpen) this.paletteColorPickerBounds = null;
    if (this.paletteRemoveMode) {
      const cancelBounds = compactFooter
        ? { x: sheetX + sheetW - 186, y: footerTop + 44, w: 84, h: footerButtonH }
        : { x: sheetX + sheetW - 186, y: footerRowY, w: 84, h: footerButtonH };
      const removeApplyBounds = compactFooter
        ? { x: sheetX + sheetW - 96, y: footerTop + 44, w: 84, h: footerButtonH }
        : { x: sheetX + sheetW - 96, y: footerRowY, w: 84, h: footerButtonH };
      this.drawButton(ctx, cancelBounds, 'Cancel', false, { fontSize: 12 });
      this.drawButton(ctx, removeApplyBounds, 'Remove', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: cancelBounds, onClick: () => { this.paletteRemoveMode = false; this.paletteRemoveMarked.clear(); } });
      this.uiButtons.push({ bounds: removeApplyBounds, onClick: () => this.applyPaletteSwatchRemoval() });
      this.registerFocusable('menu', cancelBounds, () => { this.paletteRemoveMode = false; this.paletteRemoveMarked.clear(); });
      this.registerFocusable('menu', removeApplyBounds, () => this.applyPaletteSwatchRemoval());
    } else {
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

  drawPortraitFramePlaybackRail(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const actions = [
      this.getPixelPortraitFrameAction({ id: 'frame-play', label: 'Play' }),
      this.getPixelPortraitFrameAction({ id: 'frame-step', label: 'Step' }),
      this.getPixelPortraitFrameAction({ id: 'frame-rewind', label: 'Rewind' })
    ];
    this.drawPortraitActionGrid(ctx, x + 10, y + 8, Math.max(1, w - 20), actions, {
      minColumnWidth: 74,
      maxColumns: 3,
      rowHeight: Math.max(38, h - 10),
      buttonHeight: Math.max(34, h - 16),
      group: 'frames'
    });
  }

  drawMenuOverlay(ctx, width, height, isMobile) {
    const items = [
      { label: 'Export', action: () => { this.choosePixelExportFormat(); this.menuOpen = false; } },
      { label: 'Copy', action: () => { this.copySelection(); this.menuOpen = false; } },
      { label: 'Paste', action: () => { this.pasteClipboard(); this.menuOpen = false; } },
      { label: 'Exit', action: () => { this.game.exitPixelStudio({ toTitle: true }); } }
    ];
    const boxW = Math.min(280, width - 40);
    const boxH = Math.max(180, 56 + items.length * 52);
    const boxX = width / 2 - boxW / 2;
    const boxY = height / 2 - boxH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('Menu', boxX + 16, boxY + 28);
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

  openPixelPortraitSubpanel(id) {
    this.pixelPortraitSubpanel = id;
    if (id === 'tool-options') this.focusScroll.toolOptions = 0;
  }

  drawPixelPortraitSubpanelHeader(ctx, x, y, w, title, backAction = null) {
    const backBounds = { x: x + 8, y: y + 4, w: 64, h: 40 };
    const onBack = typeof backAction === 'function'
      ? backAction
      : () => { this.pixelPortraitSubpanel = null; };
    this.drawButton(ctx, backBounds, 'Back', false, { fontSize: 12 });
    this.uiButtons.push({
      bounds: backBounds,
      onClick: onBack
    });
    this.registerFocusable('menu', backBounds, onBack);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText(title, x + 84, y + 28);
    return y + 54;
  }

  getPixelPortraitCanvasAction(entry) {
    const actions = {
      'sym-h': {
        active: this.toolOptions.symmetry.horizontal,
        action: () => { this.toolOptions.symmetry.horizontal = !this.toolOptions.symmetry.horizontal; }
      },
      'sym-v': {
        active: this.toolOptions.symmetry.vertical,
        action: () => { this.toolOptions.symmetry.vertical = !this.toolOptions.symmetry.vertical; }
      },
      wrap: {
        active: this.toolOptions.wrapDraw,
        action: () => { this.toolOptions.wrapDraw = !this.toolOptions.wrapDraw; }
      },
      grid: {
        active: this.view.showGrid !== false,
        action: () => { this.view.showGrid = this.view.showGrid === false; }
      },
      'bg-white': {
        active: this.view.backgroundMode === 'white',
        action: () => { this.view.backgroundMode = 'white'; }
      },
      'bg-black': {
        active: this.view.backgroundMode === 'black',
        action: () => { this.view.backgroundMode = 'black'; }
      },
      'bg-check': {
        active: this.view.backgroundMode === 'checker',
        action: () => { this.view.backgroundMode = 'checker'; }
      },
      'bg-color': {
        active: this.view.backgroundMode === 'color',
        action: () => {
          this.backgroundColorInput.value = this.view.backgroundColor || '#2f3640';
          this.backgroundColorInput.click();
        }
      },
      'tile-preview': {
        active: this.tiledPreview.enabled,
        action: () => { this.tiledPreview.enabled = !this.tiledPreview.enabled; }
      },
      resize: { active: this.transformModal?.type === 'resize', action: () => this.openTransformModal('resize') },
      scale: { active: this.transformModal?.type === 'scale', action: () => this.openTransformModal('scale') },
      crop: { active: this.transformModal?.type === 'crop', action: () => this.openTransformModal('crop') },
      offset: { active: this.transformModal?.type === 'offset', action: () => this.openTransformModal('offset') },
      copy: { action: () => this.copySelection() },
      paste: { action: () => this.pasteClipboard() },
      'import-image': { action: () => this.imageFileInput.click() },
      'canvas-export': { action: () => this.choosePixelExportFormat() },
      'sprite-sheet': { action: () => this.exportSpriteSheet('horizontal') },
      'export-gif': { action: () => this.exportGif() }
    };
    return { ...entry, ...(actions[entry.id] || {}) };
  }

  getPixelPortraitLayerAction(entry) {
    const activeLayer = this.activeLayer;
    const actions = {
      'layer-add': () => this.addLayer(),
      'layer-duplicate': () => this.duplicateLayer(this.canvasState.activeLayerIndex),
      'layer-delete': () => this.deleteLayer(this.canvasState.activeLayerIndex),
      'layer-rename': () => this.renameLayer(this.canvasState.activeLayerIndex),
      'layer-visibility': () => {
        const layer = this.activeLayer;
        if (!layer) return;
        layer.visible = !layer.visible;
        this.syncTileData();
      },
      'layer-up': () => this.moveLayerBy(-1),
      'layer-down': () => this.moveLayerBy(1),
      'layer-merge-up': () => this.mergeLayerUp(this.canvasState.activeLayerIndex),
      'layer-merge-down': () => this.mergeLayerDown(this.canvasState.activeLayerIndex),
      'layer-flatten': () => this.flattenAllLayers(),
      'layers-manage': () => this.openPixelPortraitSubpanel('layers-manage'),
      'layers-order': () => this.openPixelPortraitSubpanel('layers-order')
    };
    return {
      ...entry,
      label: entry.id === 'layer-visibility'
        ? (activeLayer?.visible === false ? 'Show' : 'Hide')
        : entry.label,
      action: actions[entry.id]
    };
  }

  getPixelPortraitFrameAction(entry) {
    const actions = {
      'frame-add': () => this.addFrame(),
      'frame-duplicate': () => this.duplicateFrame(this.animation.currentFrameIndex),
      'frame-delete': () => this.deleteFrame(this.animation.currentFrameIndex),
      'frame-delay': () => this.setCurrentFrameDelayMs(),
      'frame-loop': () => { this.animation.loop = !this.animation.loop; },
      'frame-play': () => { this.animation.playing = !this.animation.playing; },
      'frame-step': () => this.stepAnimationFrame(),
      'frame-rewind': () => this.rewindAnimationFrames(),
      'frame-up': () => this.moveFrameBy(-1),
      'frame-down': () => this.moveFrameBy(1),
      'frames-manage': () => this.openPixelPortraitSubpanel('frames-manage'),
      'frames-playback': () => this.openPixelPortraitSubpanel('frames-playback')
    };
    return {
      ...entry,
      label: entry.id === 'frame-loop'
        ? (this.animation.loop ? 'Loop On' : 'Loop')
        : entry.id === 'frame-play'
          ? (this.animation.playing ? 'Pause' : 'Play')
          : entry.label,
      active: entry.id === 'frame-loop' ? this.animation.loop : entry.id === 'frame-play' ? this.animation.playing : false,
      action: actions[entry.id]
    };
  }

  getPixelPortraitSelectionAction(entry) {
    const modeActions = {
      'selection-replace': () => { this.selection.combineMode = 'replace'; },
      'selection-add': () => { this.selection.combineMode = 'add'; },
      'selection-subtract': () => { this.selection.combineMode = 'subtract'; }
    };
    const actions = {
      ...modeActions,
      'selection-paste': () => this.pasteClipboard(),
      'selection-copy': () => this.copySelection(),
      'selection-cut': () => this.cutSelection(),
      'selection-delete': () => this.deleteSelection(),
      'selection-all': () => this.selectAllSelection(),
      'selection-none': () => this.clearSelection(),
      'selection-invert': () => this.invertSelection(),
      'selection-grow': () => this.expandSelection(1),
      'selection-contract': () => this.expandSelection(-1),
      'selection-transform': () => { this.setActiveTool(TOOL_IDS.MOVE); this.setInputMode('canvas'); },
      'selection-flip': () => this.applySelectionModalTransform('flip', { axis: 'horizontal' }),
      'selection-rotate': () => this.applySelectionModalTransform('rotate', { angle: 90 }),
      'selection-skew': () => this.applySelectionModalTransform('skew', { skewX: 20, skewY: 0 }),
      'selection-stretch': () => this.applySelectionModalTransform('stretch', { stretchX: 125, stretchY: 125 }),
      'selection-mode': () => this.openPixelPortraitSubpanel('selection-mode'),
      'selection-clipboard': () => this.openPixelPortraitSubpanel('selection-clipboard'),
      'selection-select': () => this.openPixelPortraitSubpanel('selection-select'),
      'selection-transform-tools': () => this.openPixelPortraitSubpanel('selection-transform-tools')
    };
    const needsSelection = new Set([
      'selection-copy',
      'selection-cut',
      'selection-delete',
      'selection-invert',
      'selection-grow',
      'selection-contract',
      'selection-transform',
      'selection-flip',
      'selection-rotate',
      'selection-skew',
      'selection-stretch'
    ]);
    const hasSelection = Boolean(this.selection.active && this.selection.mask);
    return {
      ...entry,
      label: entry.id === 'selection-transform' ? 'Trans' : entry.label,
      active: entry.id === 'selection-replace'
        ? (this.selection.combineMode || 'replace') === 'replace'
        : entry.id === 'selection-add'
          ? this.selection.combineMode === 'add'
          : entry.id === 'selection-subtract'
            ? this.selection.combineMode === 'subtract'
            : false,
      disabled: needsSelection.has(entry.id) && !hasSelection,
      action: actions[entry.id] ? () => this.runSelectionAction(actions[entry.id]) : undefined
    };
  }

  stepAnimationFrame() {
    this.animation.playing = false;
    const frameCount = Math.max(1, this.animation.frames.length);
    this.animation.currentFrameIndex = clamp(this.animation.currentFrameIndex + 1, 0, frameCount - 1);
    this.setFrameLayers(this.currentFrame.layers);
  }

  rewindAnimationFrames() {
    this.animation.playing = false;
    this.animation.currentFrameIndex = 0;
    this.setFrameLayers(this.currentFrame.layers);
  }

  goToLastAnimationFrame() {
    this.animation.playing = false;
    this.animation.currentFrameIndex = Math.max(0, this.animation.frames.length - 1);
    this.setFrameLayers(this.currentFrame.layers);
  }

  previousAnimationFrame() {
    this.animation.playing = false;
    const frameCount = Math.max(1, this.animation.frames.length);
    this.animation.currentFrameIndex = clamp(this.animation.currentFrameIndex - 1, 0, frameCount - 1);
    this.setFrameLayers(this.currentFrame.layers);
  }

  getTransportActions() {
    if (this.transportPopover?.mode === 'bones') return this.getBoneTransportActions();
    return [
      { id: 'start', label: '⏮', col: 0, row: 0, action: () => this.rewindAnimationFrames() },
      { id: 'back', label: '⏪', col: 0, row: 1, action: () => this.previousAnimationFrame() },
      { id: 'forward', label: '⏩', col: 0, row: 2, action: () => this.stepAnimationFrame() },
      { id: 'end', label: '⏭', col: 0, row: 3, action: () => this.goToLastAnimationFrame() },
      { id: 'play', label: this.animation.playing ? '⏸' : '▶', col: 1, row: 1, primary: true, active: this.animation.playing, action: () => { this.animation.playing = !this.animation.playing; } },
      { id: 'loop', label: '∞', col: 1, row: 2, active: this.animation.loop, action: () => { this.animation.loop = !this.animation.loop; } }
    ];
  }

  getBoneTransportActions() {
    return [
      {
        id: 'bone-start',
        label: '⏮',
        col: 0,
        row: 0,
        action: () => this.runBoneToolCommand(() => {
          this.boneEditor.timeMs = 0;
          this.boneEditor.playing = false;
        }, 'pose')
      },
      {
        id: 'bone-back',
        label: '⏪',
        col: 0,
        row: 1,
        action: () => this.runBoneToolCommand(() => this.nudgeBoneTime(-this.boneEditor.segmentMs), 'pose')
      },
      {
        id: 'bone-forward',
        label: '⏩',
        col: 0,
        row: 2,
        action: () => this.runBoneToolCommand(() => this.nudgeBoneTime(this.boneEditor.segmentMs), 'pose')
      },
      {
        id: 'bone-play',
        label: this.boneEditor.playing ? '⏸' : '▶',
        col: 1,
        row: 1,
        primary: true,
        active: this.boneEditor.playing,
        action: () => this.runBoneToolCommand(() => this.toggleBoneTimelinePlayback(), 'pose')
      },
      {
        id: 'bone-loop',
        label: '∞',
        col: 1,
        row: 2,
        active: this.animation.loop,
        action: () => this.runBoneToolCommand(() => {
          this.animation.loop = !this.animation.loop;
        }, 'pose')
      },
      {
        id: 'bone-hide',
        label: this.boneEditor.hideBonesDuringPlayback ? '◎' : '◌',
        col: 1,
        row: 3,
        active: Boolean(this.boneEditor.hideBonesDuringPlayback),
        action: () => this.runBoneToolCommand(() => this.toggleHideBonesDuringPlayback(), 'pose')
      }
    ];
  }

  openTransportPopover(anchor, mode = 'animation') {
    this.transportPopover = { anchor: { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h }, mode };
  }

  closeTransportPopover() {
    this.transportPopover = null;
    this.transportPopoverButtons = [];
  }

  startTransportHold(button, payload) {
    this.cancelTransportHold();
    this.transportHold = {
      x: payload.x,
      y: payload.y,
      button,
      fired: false,
      timer: window.setTimeout(() => {
        if (!this.transportHold) return;
        this.transportHold.fired = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
        this.openTransportPopover(button.bounds, button.transportMode || 'animation');
      }, 500)
    };
  }

  cancelTransportHold() {
    if (this.transportHold?.timer) window.clearTimeout(this.transportHold.timer);
    this.transportHold = null;
  }

  drawTransportPopover(ctx) {
    if (!this.transportPopover) return;
    const isBonePopover = this.transportPopover.mode === 'bones';
    const layout = drawSharedTransportPopover(ctx, this.transportPopover.anchor, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, this.getTransportActions(), {
      columns: 2,
      columnWidth: 54,
      rowHeight: 42,
      fill: isBonePopover ? 'rgba(8,10,14,0.98)' : undefined,
      border: isBonePopover ? UI_SUITE.colors.accent : undefined
    });
    this.transportPopoverButtons = layout.buttons.map((button) => ({ id: button.id, bounds: button.bounds, onClick: button.action }));
    this.transportPopoverButtons.forEach((button) => this.uiButtons.push(button));
  }

  hasPixelPortraitToolOptions() {
    return this.isBrushAdjustableTool(this.activeToolId)
      || [TOOL_IDS.RECT, TOOL_IDS.ELLIPSE, TOOL_IDS.POLYGON, TOOL_IDS.FILL, TOOL_IDS.DITHER, TOOL_IDS.CLONE, TOOL_IDS.GRADIENT, TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR, TOOL_IDS.HUE_SHIFT, TOOL_IDS.COLOR_REPLACE].includes(this.activeToolId);
  }

  drawToolsPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const category = options.category || this.leftPanelTab || 'draw';
    const fontSize = isMobile ? 14 : 12;
    const lineHeight = isMobile ? 52 : 20;
    const buttonHeight = isMobile ? 44 : 18;
    this.toolsPanelMeta = null;
    const selectionGroup = buildPixelPortraitSelectionActionGroups()[this.pixelPortraitSubpanel];
    if (options.portrait && (this.pixelPortraitSubpanel === 'tool-options' || selectionGroup)) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      ctx.fillText(selectionGroup ? selectionGroup.title : 'Tool Options', x + 14, y + 28);
      const optionsY = y + 42;
      const panelX = x + 12;
      const panelY = optionsY + 2;
      const panelW = Math.max(120, w - 24);
      const panelH = Math.max(80, y + h - panelY - 54);
      this.toolsPanelMeta = {
        optionsScrollBounds: { x: panelX - 2, y: panelY + 30, w: panelW + 4, h: Math.max(26, panelH - 34) },
        lineHeight,
        maxToolOptionsScroll: 0
      };
      this.drawToolOptions(ctx, panelX, panelY, { isMobile, panelWidth: panelW, panelHeight: panelH });
      const backAction = selectionGroup
        ? () => { this.pixelPortraitSubpanel = 'tool-options'; }
        : () => { this.pixelPortraitSubpanel = null; };
      const backBounds = { x: x + w - 84, y: y + h - 46, w: 72, h: 38 };
      this.drawButton(ctx, backBounds, 'Back', false, { fontSize: 12 });
      this.uiButtons.push({ bounds: backBounds, onClick: backAction });
      this.registerFocusable('menu', backBounds, backAction);
      return;
    }
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    const title = category === 'draw' ? 'Draw Tools' : category === 'select' ? 'Selection Tools' : 'Extra Tools';
    ctx.fillText(title, x + 12, y + 22);

    const list = this.tools.filter((tool) => (tool.category || 'tools') === category)
      .filter((tool) => !(category === 'select' && tool.id === TOOL_IDS.MOVE));
    const toolsTop = y + (isMobile ? 60 : 56);
    const toolsBottomPadding = isMobile ? (options.portrait ? 70 : (category === 'tools' ? 72 : 116)) : 132;
    const toolsAreaH = Math.max(lineHeight, h - toolsBottomPadding);
    const portraitGrid = Boolean(options.portrait);
    const gridMetrics = portraitGrid
      ? getPixelPortraitToolGridMetrics(w - 16, toolsAreaH, list.length, {
        rowHeight: lineHeight,
        buttonHeight,
        minColumnWidth: category === 'select' ? 82 : 88
      })
      : null;
    const maxVisible = portraitGrid
      ? gridMetrics.visibleRows * gridMetrics.columns
      : Math.max(1, Math.floor(toolsAreaH / lineHeight));
    this.focusGroupMeta.tools = { maxVisible };
    const controllerMenuId = category;
    const requestedStart = this.controllerMenu.isMenuActive(controllerMenuId)
      ? this.controllerMenu.syncScrollToSelection(controllerMenuId, maxVisible, this.focusScroll.tools || 0)
      : (this.focusScroll.tools || 0);
    const maxToolScroll = portraitGrid ? gridMetrics.maxScroll : Math.max(0, list.length - maxVisible);
    this.focusScroll.tools = clamp(requestedStart, 0, maxToolScroll);
    this.toolsListMeta = {
      scrollBounds: { x: x + 6, y: toolsTop - (isMobile ? 18 : 14), w: w - 12, h: (portraitGrid ? gridMetrics.visibleRows : maxVisible) * lineHeight + (isMobile ? 24 : 18) },
      lineHeight,
      maxScroll: maxToolScroll,
      columns: portraitGrid ? gridMetrics.columns : 1,
      visibleRows: portraitGrid ? gridMetrics.visibleRows : maxVisible,
      layout: portraitGrid ? 'grid' : 'list'
    };
    let offsetY = toolsTop;
    const visibleTools = portraitGrid
      ? list.slice(this.focusScroll.tools * gridMetrics.columns, (this.focusScroll.tools + gridMetrics.visibleRows) * gridMetrics.columns)
      : list.slice(this.focusScroll.tools, this.focusScroll.tools + maxVisible);
    visibleTools.forEach((tool, visibleIndex) => {
      const isActive = tool.id === this.activeToolId;
      const row = portraitGrid ? Math.floor(visibleIndex / gridMetrics.columns) : visibleIndex;
      const col = portraitGrid ? visibleIndex % gridMetrics.columns : 0;
      const bounds = portraitGrid
        ? {
          x: x + 8 + col * (gridMetrics.cellWidth + gridMetrics.columnGap),
          y: toolsTop + row * lineHeight - (isMobile ? 24 : 10),
          w: gridMetrics.cellWidth,
          h: buttonHeight
        }
        : { x: x + 8, y: offsetY - (isMobile ? 24 : 10), w: w - 16, h: buttonHeight };
      this.drawButton(ctx, bounds, portraitGrid ? getPixelPortraitToolLabel(tool) : tool.name, isActive, {
        fontSize,
        focused: this.controllerMenu.isFocusedItem(category, tool.id)
      });
      const action = tool.action || (() => { this.setActiveTool(tool.id); });
      this.uiButtons.push({ bounds, onClick: action });
      this.registerFocusable('tools', bounds, action);
      if (!portraitGrid) offsetY += lineHeight;
    });
    if (portraitGrid) {
      offsetY = toolsTop + gridMetrics.visibleRows * lineHeight;
    }
    if (maxToolScroll > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${isMobile ? 11 : 10}px ${UI_SUITE.font.family}`;
      const visibleToolRows = portraitGrid ? gridMetrics.visibleRows : maxVisible;
      ctx.fillText(`Tools ${this.focusScroll.tools + 1}/${maxToolScroll + 1}`, x + 12, toolsTop + visibleToolRows * lineHeight + 10);
      drawSharedPortraitScrollHints(ctx, this.toolsListMeta.scrollBounds, {
        scroll: this.focusScroll.tools,
        scrollMax: maxToolScroll
      });
    }

    if (options.portrait) {
      this.toolsPanelMeta = null;
      const hasOptions = this.hasPixelPortraitToolOptions() || category === 'select';
      const optionsBounds = {
        x: x + 12,
        y: Math.min(y + h - 50, offsetY + 4),
        w: Math.max(120, w - 24),
        h: 44
      };
      this.drawButton(ctx, optionsBounds, 'Tool Options', false, { fontSize: 12, disabled: !hasOptions });
      if (hasOptions) {
        this.uiButtons.push({ bounds: optionsBounds, onClick: () => this.openPixelPortraitSubpanel('tool-options') });
        this.registerFocusable('menu', optionsBounds, () => this.openPixelPortraitSubpanel('tool-options'));
      }
      return;
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
      const tileReset = { x: x + 232, y: offsetY - buttonHeight + 4, w: 56, h: buttonHeight };
      this.drawButton(ctx, tileLeft, '<', false, { fontSize });
      this.drawButton(ctx, tileRight, '>', false, { fontSize });
      this.drawButton(ctx, tileReset, 'Reset', false, { fontSize: Math.max(10, fontSize - 1) });
      this.uiButtons.push({ bounds: tileLeft, onClick: () => this.cycleTile(-1) });
      this.uiButtons.push({ bounds: tileRight, onClick: () => this.cycleTile(1) });
      this.uiButtons.push({ bounds: tileReset, onClick: () => this.resetActiveTileArt() });
      this.registerFocusable('menu', tileLeft, () => this.cycleTile(-1));
      this.registerFocusable('menu', tileRight, () => this.cycleTile(1));
      this.registerFocusable('menu', tileReset, () => this.resetActiveTileArt());
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
      optionsScrollBounds: { x: optionsX - 2, y: optionsY + 30, w: optionsW + 4, h: Math.max(26, optionsH - 34) },
      lineHeight,
      maxToolOptionsScroll: 0
    };
    offsetY = this.drawToolOptions(ctx, optionsX, optionsY, { isMobile, panelWidth: optionsW, panelHeight: optionsH });

    if (this.modeTab === 'animate') {
      this.drawAnimationControls(ctx, x + 12, offsetY, { isMobile });
    }

    if (this.modeTab === 'export') {
      this.drawExportControls(ctx, x + 12, offsetY, { isMobile });
    }
  }

  drawSwitchesPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const portrait = isMobile && isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    if (portrait) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px Courier New';
      const groups = buildPixelPortraitCanvasActionGroups();
      const subpanel = groups[this.pixelPortraitSubpanel];
      if (subpanel) {
        const panelY = this.drawPixelPortraitSubpanelHeader(ctx, x, y, w, subpanel.title);
        this.drawPortraitActionGrid(ctx, x + 12, panelY + 2, Math.max(1, w - 24), subpanel.actions.map((entry) => this.getPixelPortraitCanvasAction(entry)), {
          minColumnWidth: 82,
          maxColumns: 3,
          group: 'menu'
        });
        return;
      }
      ctx.fillText('Canvas', x + 12, y + 22);
      const actions = buildPixelPortraitCanvasActions().map((entry) => ({
        ...entry,
        action: entry.id === 'canvas-export'
          ? () => this.choosePixelExportFormat()
          : () => this.openPixelPortraitSubpanel(entry.id)
      }));
      this.drawPortraitActionGrid(ctx, x + 12, y + 44, Math.max(1, w - 24), actions, {
        minColumnWidth: 82,
        maxColumns: 3,
        group: 'menu'
      });
      return;
    }
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
    this.drawOptionToggle(ctx, x + 12, offsetY, 'Grid', this.view.showGrid !== false, () => {
      this.view.showGrid = this.view.showGrid === false;
    }, { isMobile });
    offsetY += lineHeight;
    this.drawBackgroundControls(ctx, x + 12, offsetY, Math.max(120, w - 24), { isMobile });
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

    if (portrait) {
      const utilityButtons = [
        { label: 'Copy', action: () => this.copySelection() },
        { label: 'Paste', action: () => this.pasteClipboard() },
        { label: 'Import', action: () => this.imageFileInput.click() },
        { label: 'Export', action: () => this.choosePixelExportFormat() }
      ];
      const cols = 2;
      const gap = 8;
      const buttonW = Math.max(78, Math.floor((w - 24 - gap) / cols));
      utilityButtons.forEach((entry, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const bounds = {
          x: x + 12 + col * (buttonW + gap),
          y: offsetY + row * (buttonHeight + gap) - buttonHeight + 4,
          w: buttonW,
          h: buttonHeight
        };
        this.drawButton(ctx, bounds, entry.label, false, { fontSize: 12 });
        this.uiButtons.push({ bounds, onClick: entry.action });
        this.registerFocusable('menu', bounds, entry.action);
      });
      offsetY += Math.ceil(utilityButtons.length / cols) * (buttonHeight + gap);
    }

    if (offsetY + lineHeight < y + h) {
      // intentionally no zoom controls here; zoom is handled via canvas gestures/shortcuts/mobile slider
    }
  }

  drawOptionToggle(ctx, x, y, label, active, onClick, options = {}) {
    const isMobile = options.isMobile;
    const defaultW = isMobile ? 180 : 120;
    const buttonW = Math.min(options.panelWidth || defaultW, defaultW);
    const buttonX = options.centered && options.panelWidth
      ? x + Math.max(0, Math.floor((options.panelWidth - buttonW) / 2))
      : x;
    const bounds = { x: buttonX, y: y - (isMobile ? 24 : 12), w: buttonW, h: isMobile ? 44 : 18 };
    this.drawButton(ctx, bounds, label, active, { fontSize: isMobile ? 12 : 12 });
    this.uiButtons.push({ bounds, onClick });
    this.registerFocusable('menu', bounds, onClick);
  }

  drawBackgroundControls(ctx, x, y, w, options = {}) {
    const isMobile = options.isMobile;
    const buttonH = isMobile ? 44 : 18;
    const buttonY = y - (isMobile ? 24 : 12);
    const gap = isMobile ? 6 : 5;
    const labelW = isMobile ? 34 : 24;
    const labels = [
      { mode: 'white', label: 'White' },
      { mode: 'black', label: 'Black' },
      { mode: 'checker', label: 'Check' },
      { mode: 'color', label: 'Color' }
    ];
    const buttonW = Math.max(isMobile ? 44 : 38, Math.floor((w - labelW - gap * labels.length) / labels.length));

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `${isMobile ? 12 : 11}px ${UI_SUITE.font.family}`;
    ctx.fillText('BG', x, y + (isMobile ? 4 : 5));

    let bx = x + labelW;
    labels.forEach((entry) => {
      const bounds = { x: bx, y: buttonY, w: buttonW, h: buttonH };
      this.drawButton(ctx, bounds, entry.label, this.view.backgroundMode === entry.mode, { fontSize: isMobile ? 11 : 10 });
      if (entry.mode === 'color') {
        const swatch = {
          x: bounds.x + 4,
          y: bounds.y + Math.max(4, Math.floor(bounds.h * 0.22)),
          w: Math.min(14, Math.max(10, bounds.w * 0.22)),
          h: Math.min(14, Math.max(10, bounds.h * 0.5))
        };
        ctx.fillStyle = this.view.backgroundColor || '#2f3640';
        ctx.fillRect(swatch.x, swatch.y, swatch.w, swatch.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.strokeRect(swatch.x, swatch.y, swatch.w, swatch.h);
      }
      const onClick = () => {
        if (entry.mode === 'color') {
          this.backgroundColorInput.value = this.view.backgroundColor || '#2f3640';
          this.backgroundColorInput.click();
          return;
        }
        this.view.backgroundMode = entry.mode;
      };
      this.uiButtons.push({ bounds, onClick });
      this.registerFocusable('menu', bounds, onClick);
      bx += buttonW + gap;
    });
  }

  drawBrushToolOptions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    const panelWidth = Math.max(120, options.panelWidth || 180);
    const lineHeight = isMobile ? 52 : 24;
    const buttonH = isMobile ? 44 : 20;
    let offsetY = y;
    const bounds = {
      x,
      y: offsetY - (isMobile ? 24 : 12),
      w: Math.min(panelWidth, isMobile ? panelWidth : 160),
      h: buttonH
    };
    const openBrushSettings = () => this.openBrushPicker('size');
    this.drawButton(ctx, bounds, 'Brush Settings', false, { fontSize: isMobile ? 12 : 11 });
    this.uiButtons.push({ bounds, onClick: openBrushSettings });
    this.registerFocusable('menu', bounds, openBrushSettings);
    offsetY += lineHeight;
    return offsetY;
  }

  drawPortraitToolOptionButton(ctx, x, y, label, onClick, options = {}) {
    const isMobile = options.isMobile;
    const panelWidth = Math.max(120, options.panelWidth || 180);
    const buttonH = isMobile ? 44 : 18;
    const bounds = {
      x,
      y: y - (isMobile ? 24 : 12),
      w: isMobile ? panelWidth : Math.min(panelWidth, 150),
      h: buttonH
    };
    this.drawButton(ctx, bounds, label, Boolean(options.active), { fontSize: isMobile ? 12 : 12 });
    this.uiButtons.push({ bounds, onClick });
    this.registerFocusable('menu', bounds, onClick);
    return y + (isMobile ? 52 : 20);
  }

  drawPortraitToolOptionStepper(ctx, x, y, label, value, onMinus, onPlus, options = {}) {
    const isMobile = options.isMobile;
    const panelWidth = Math.max(120, options.panelWidth || 180);
    const buttonH = isMobile ? 44 : 18;
    const gap = isMobile ? 8 : 6;
    const smallW = isMobile ? 44 : 28;
    const labelW = Math.max(44, panelWidth - smallW * 2 - gap * 2);
    const rowY = y - (isMobile ? 24 : 12);
    const labelBounds = { x, y: rowY, w: labelW, h: buttonH };
    const minus = { x: x + labelW + gap, y: rowY, w: smallW, h: buttonH };
    const plus = { x: minus.x + smallW + gap, y: rowY, w: smallW, h: buttonH };
    this.drawButton(ctx, labelBounds, `${label}: ${value}`, false, { fontSize: isMobile ? 12 : 12 });
    this.drawButton(ctx, minus, '-', false, { fontSize: isMobile ? 12 : 12 });
    this.drawButton(ctx, plus, '+', false, { fontSize: isMobile ? 12 : 12 });
    this.uiButtons.push({ bounds: minus, onClick: onMinus });
    this.uiButtons.push({ bounds: plus, onClick: onPlus });
    this.registerFocusable('menu', minus, onMinus);
    this.registerFocusable('menu', plus, onPlus);
    return y + (isMobile ? 52 : 20);
  }

  drawToolOptions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    const panelWidth = Math.max(120, options.panelWidth || 180);
    const panelHeight = Math.max(60, options.panelHeight || 120);
    const lineHeight = isMobile ? 52 : 20;
    const rowHeight = isMobile ? 52 : 22;
    const bodyY = y + (isMobile ? 8 : 14);
    const bodyH = Math.max(28, y + panelHeight - bodyY - 8);
    const scroll = Math.max(0, this.focusScroll.toolOptions || 0);
    const scrollY = scroll * rowHeight;
    let offsetY = bodyY + (isMobile ? 24 : 12);
    const startY = offsetY;
    let contentBottom = offsetY;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x - 6, y, panelWidth + 12, panelHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(x - 6, y, panelWidth + 12, panelHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${isMobile ? 12 : 11}px ${UI_SUITE.font.family}`;
    ctx.beginPath();
    ctx.rect(x - 4, bodyY - 2, panelWidth + 8, bodyH + 4);
    ctx.clip();
    offsetY -= scrollY;

    if (this.isBrushAdjustableTool(this.activeToolId)) {
      offsetY = this.drawBrushToolOptions(ctx, x, offsetY, { isMobile, panelWidth });
    }

    if ([TOOL_IDS.RECT, TOOL_IDS.ELLIPSE, TOOL_IDS.POLYGON].includes(this.activeToolId)) {
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, this.toolOptions.shapeFill ? 'Fill: On' : 'Fill: Off', () => {
        this.toolOptions.shapeFill = !this.toolOptions.shapeFill;
      }, { isMobile, panelWidth, active: this.toolOptions.shapeFill });
    }
    if (this.activeToolId === TOOL_IDS.FILL) {
      offsetY = this.drawPortraitToolOptionStepper(ctx, x, offsetY, 'Tolerance', this.toolOptions.fillTolerance, () => {
        this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance - 5, 0, 255);
      }, () => {
        this.toolOptions.fillTolerance = clamp(this.toolOptions.fillTolerance + 5, 0, 255);
      }, { isMobile, panelWidth });
    }
    if (this.activeToolId === TOOL_IDS.DITHER) {
      const patterns = ['bayer2', 'bayer4', 'checker'];
      const nextPattern = patterns[(patterns.indexOf(this.toolOptions.ditherPattern) + 1) % patterns.length];
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, `Pattern: ${this.toolOptions.ditherPattern}`, () => {
        this.toolOptions.ditherPattern = nextPattern;
      }, { isMobile, panelWidth });
      offsetY = this.drawPortraitToolOptionStepper(ctx, x, offsetY, 'Strength', this.toolOptions.ditherStrength, () => {
        this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength - 1, 1, 4);
      }, () => {
        this.toolOptions.ditherStrength = clamp(this.toolOptions.ditherStrength + 1, 1, 4);
      }, { isMobile, panelWidth });
    }
    if (this.activeToolId === TOOL_IDS.CLONE) {
      this.cloneColorPickArmed = false;
      const sourceLabel = this.clonePickSourceArmed ? 'Tap canvas to set source' : 'Set Source';
      const sourceW = Math.min(panelWidth, isMobile ? panelWidth : 170);
      const sourceBounds = { x: x + Math.max(0, Math.floor((panelWidth - sourceW) / 2)), y: offsetY - (isMobile ? 24 : 12), w: sourceW, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, sourceBounds, sourceLabel, this.clonePickSourceArmed, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({
        bounds: sourceBounds,
        onClick: () => {
          if (this.clonePickSourceArmed) {
            this.clonePickSourceArmed = false;
            this.statusMessage = 'Clone paint mode';
          } else {
            this.armCloneSourcePick();
          }
        }
      });
      this.registerFocusable('menu', sourceBounds, () => {
        if (this.clonePickSourceArmed) {
          this.clonePickSourceArmed = false;
          this.statusMessage = 'Clone paint mode';
        } else {
          this.armCloneSourcePick();
        }
      });
      offsetY += lineHeight;
      const rowY = offsetY - (isMobile ? 24 : 12);
      const angleGap = isMobile ? 8 : 6;
      const buttonW = Math.floor((panelWidth - angleGap) / 2);
      const setBounds = { x, y: rowY, w: buttonW, h: isMobile ? 44 : 18 };
      const resetBounds = { x: x + buttonW + angleGap, y: rowY, w: panelWidth - buttonW - angleGap, h: isMobile ? 44 : 18 };
      const setLabel = this.cloneAngleCalibration
        ? (this.cloneAngleCalibration.phase === 'source' ? 'Source Angle' : 'Dest Angle')
        : 'Set Angles';
      this.drawButton(ctx, setBounds, setLabel, Boolean(this.cloneAngleCalibration), { fontSize: isMobile ? 12 : 12 });
      this.drawButton(ctx, resetBounds, 'Reset', false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds: setBounds, onClick: () => this.toggleCloneAngleCalibration() });
      this.uiButtons.push({ bounds: resetBounds, onClick: () => this.resetCloneAlignment() });
      this.registerFocusable('menu', setBounds, () => this.toggleCloneAngleCalibration());
      this.registerFocusable('menu', resetBounds, () => this.resetCloneAlignment());
      offsetY += lineHeight;
      const targetLabel = this.clonePickTargetArmed ? 'Tap canvas to set target' : 'Target';
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, targetLabel, () => {
        if (this.clonePickTargetArmed) {
          this.clonePickTargetArmed = false;
          this.statusMessage = 'Clone paint mode';
        } else {
          this.armCloneTargetPick();
        }
      }, { isMobile, panelWidth, active: this.clonePickTargetArmed });
    }
    if (this.activeToolId === TOOL_IDS.GRADIENT) {
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, `Strength: ${this.toolOptions.gradientStrength}%`, () => {
        this.toolOptions.gradientStrength += 10;
        if (this.toolOptions.gradientStrength > 100) this.toolOptions.gradientStrength = 10;
      }, { isMobile, panelWidth });
    }
    if ([TOOL_IDS.SELECT_MAGIC_LASSO, TOOL_IDS.SELECT_MAGIC_COLOR].includes(this.activeToolId)) {
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, `Threshold: ${this.toolOptions.magicThreshold}`, () => {
        this.toolOptions.magicThreshold += 8;
        if (this.toolOptions.magicThreshold > 255) this.toolOptions.magicThreshold = 0;
      }, { isMobile, panelWidth });
    }
    if (this.activeToolId === TOOL_IDS.HUE_SHIFT) {
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, `Scope: ${this.toolOptions.replaceScope}`, () => {
        this.toolOptions.replaceScope = this.toolOptions.replaceScope === 'layer' ? 'selection' : 'layer';
      }, { isMobile, panelWidth });
    }
    if (this.activeToolId === TOOL_IDS.COLOR_REPLACE) {
      offsetY = this.drawPortraitToolOptionButton(ctx, x, offsetY, `Scope: ${this.toolOptions.replaceScope}`, () => {
        this.toolOptions.replaceScope = this.toolOptions.replaceScope === 'layer' ? 'selection' : 'layer';
      }, { isMobile, panelWidth });
    }

    if (this.leftPanelTab === 'select') {
      offsetY = this.drawSelectionActions(ctx, x, offsetY, {
        isMobile,
        fromToolOptions: true,
        panelWidth
      });
    }

    contentBottom = offsetY + scrollY;
    ctx.restore();
    const totalRows = Math.max(0, Math.ceil((contentBottom - startY) / rowHeight));
    const visibleRows = Math.max(1, Math.floor(bodyH / rowHeight));
    const maxScroll = Math.max(0, totalRows - visibleRows);
    this.focusScroll.toolOptions = clamp(this.focusScroll.toolOptions || 0, 0, maxScroll);
    if (this.toolsPanelMeta) {
      this.toolsPanelMeta.maxToolOptionsScroll = maxScroll;
    }
    if (maxScroll > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${isMobile ? 11 : 10}px ${UI_SUITE.font.family}`;
      ctx.fillText(`Scroll ${this.focusScroll.toolOptions + 1}/${maxScroll + 1}`, x + 2, y + panelHeight + 10);
      drawSharedPortraitScrollHints(ctx, this.toolsPanelMeta?.optionsScrollBounds || { x: x - 4, y: bodyY - 2, w: panelWidth + 8, h: bodyH + 4 }, {
        scroll: this.focusScroll.toolOptions,
        scrollMax: maxScroll
      });
    }
    return offsetY;
  }

  drawHueSaturationMobileRail(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Hue / Saturation', x + 10, y + 16);

    const actionGap = 8;
    const actionH = Math.min(38, Math.max(30, Math.floor(h * 0.32)));
    const actionY = y + h - actionH - 6;
    const sliderGap = 10;
    const sliderX = x + 10;
    const sliderW = Math.max(44, Math.floor((w - 20 - sliderGap) / 2));
    const sliderY = y + 24;
    const sliderH = Math.max(20, actionY - sliderY - 8);
    const hueTrack = { x: sliderX, y: sliderY, w: sliderW, h: sliderH };
    const satTrack = { x: sliderX + sliderW + sliderGap, y: sliderY, w: sliderW, h: sliderH };

    const hueGradient = ctx.createLinearGradient(hueTrack.x, 0, hueTrack.x + hueTrack.w, 0);
    hueGradient.addColorStop(0, '#ff0000');
    hueGradient.addColorStop(0.17, '#ffff00');
    hueGradient.addColorStop(0.33, '#00ff00');
    hueGradient.addColorStop(0.5, '#00ffff');
    hueGradient.addColorStop(0.67, '#0000ff');
    hueGradient.addColorStop(0.83, '#ff00ff');
    hueGradient.addColorStop(1, '#ff0000');
    ctx.fillStyle = hueGradient;
    ctx.fillRect(hueTrack.x, hueTrack.y, hueTrack.w, hueTrack.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(hueTrack.x, hueTrack.y, hueTrack.w, hueTrack.h);

    const hueShift = clamp(Number(this.toolOptions.hueShiftDegrees || 0), -180, 180);
    const hueT = (hueShift + 180) / 360;
    const hueKnobX = hueTrack.x + hueT * hueTrack.w;
    ctx.strokeStyle = '#101114';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hueKnobX, hueTrack.y - 3);
    ctx.lineTo(hueKnobX, hueTrack.y + hueTrack.h + 3);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '11px Courier New';
    ctx.fillText(`${Math.round(hueShift)}°`, hueTrack.x + 4, hueTrack.y + hueTrack.h - 6);

    const hueColor = `hsl(${((hueShift % 360) + 360) % 360} 100% 50%)`;
    const satGradient = ctx.createLinearGradient(satTrack.x, 0, satTrack.x + satTrack.w, 0);
    satGradient.addColorStop(0, '#808080');
    satGradient.addColorStop(1, hueColor);
    ctx.fillStyle = satGradient;
    ctx.fillRect(satTrack.x, satTrack.y, satTrack.w, satTrack.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(satTrack.x, satTrack.y, satTrack.w, satTrack.h);
    const satValue = clamp(Number(this.toolOptions.hueShiftSaturation || 100), 0, 200);
    const satKnobX = satTrack.x + (satValue / 200) * satTrack.w;
    ctx.strokeStyle = '#101114';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(satKnobX, satTrack.y - 3);
    ctx.lineTo(satKnobX, satTrack.y + satTrack.h + 3);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.round(satValue)}%`, satTrack.x + 4, satTrack.y + satTrack.h - 6);

    const updateHueFromX = (pointerX) => {
      const t = clamp((pointerX - hueTrack.x) / Math.max(1, hueTrack.w), 0, 1);
      this.toolOptions.hueShiftDegrees = Math.round(t * 360 - 180);
    };
    const updateSatFromX = (pointerX) => {
      const t = clamp((pointerX - satTrack.x) / Math.max(1, satTrack.w), 0, 1);
      this.toolOptions.hueShiftSaturation = Math.round(t * 200);
    };
    this.uiButtons.push({ bounds: hueTrack, onClick: ({ x: pointerX }) => updateHueFromX(pointerX), onDrag: ({ x: pointerX }) => updateHueFromX(pointerX) });
    this.uiButtons.push({ bounds: satTrack, onClick: ({ x: pointerX }) => updateSatFromX(pointerX), onDrag: ({ x: pointerX }) => updateSatFromX(pointerX) });

    const buttonW = Math.floor((w - 20 - actionGap) / 2);
    const applyBounds = { x: x + 10, y: actionY, w: buttonW, h: actionH };
    const resetBounds = { x: applyBounds.x + buttonW + actionGap, y: actionY, w: buttonW, h: actionH };
    const resetHue = () => {
      this.toolOptions.hueShiftDegrees = 0;
      this.toolOptions.hueShiftSaturation = 100;
    };
    this.drawButton(ctx, applyBounds, 'Apply', false, { fontSize: 12 });
    this.drawButton(ctx, resetBounds, 'Reset', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: applyBounds, onClick: () => this.applyHueShift() });
    this.uiButtons.push({ bounds: resetBounds, onClick: resetHue });
    this.registerFocusable('menu', applyBounds, () => this.applyHueShift());
    this.registerFocusable('menu', resetBounds, resetHue);

  }

  drawSelectionActions(ctx, x, y, options = {}) {
    const isMobile = options.isMobile;
    if (isMobile) {
      const panelWidth = Math.max(120, options.panelWidth || 180);
      const groups = buildPixelPortraitSelectionActionGroups();
      const subpanel = groups[this.pixelPortraitSubpanel];
      const actions = (subpanel ? subpanel.actions : buildPixelPortraitSelectionActions())
        .map((entry) => this.getPixelPortraitSelectionAction(entry));
      return this.drawPortraitActionGrid(ctx, x, y - 22, panelWidth, actions, {
        minColumnWidth: subpanel ? 84 : 76,
        maxColumns: subpanel ? 2 : 2,
        group: 'menu'
      }) + 8;
    }
    const fromToolOptions = Boolean(options.fromToolOptions);
    const rowStep = isMobile ? 52 : 20;
    const rowHeight = isMobile ? 44 : 18;
    const panelWidth = Math.max(120, options.panelWidth || (isMobile ? 180 : 120));
    const buttonWidth = fromToolOptions
      ? Math.max(120, Math.min(panelWidth, panelWidth - 6))
      : (isMobile ? 180 : 120);
    const modeEntries = [
      { label: 'None', mode: 'replace' },
      { label: 'Add', mode: 'add' },
      { label: 'Subtract', mode: 'subtract' }
    ];
    const modeGap = 6;
    const modeW = Math.max(42, Math.floor((buttonWidth - modeGap * 2) / 3));
    let offsetY = y;
    modeEntries.forEach((entry, index) => {
      const bounds = { x: x + index * (modeW + modeGap), y: offsetY, w: modeW, h: rowHeight };
      const active = (this.selection.combineMode || 'replace') === entry.mode;
      this.drawButton(ctx, bounds, entry.label, active, { fontSize: isMobile ? 11 : 10 });
      const onClick = () => { this.selection.combineMode = entry.mode; };
      this.uiButtons.push({ bounds, onClick });
      this.registerFocusable('menu', bounds, onClick);
    });
    offsetY += rowStep;

    const actions = [
      { label: 'Paste', action: () => this.runSelectionAction(() => this.pasteClipboard()) },
      { label: 'Copy', action: () => this.runSelectionAction(() => this.copySelection()) },
      { label: 'Cut', action: () => this.runSelectionAction(() => this.cutSelection()) },
      { label: 'Delete', action: () => this.runSelectionAction(() => this.deleteSelection()) },
      { label: 'Invert', action: () => this.runSelectionAction(() => this.invertSelection()) },
      { label: 'Grow', action: () => this.runSelectionAction(() => this.expandSelection(1)) },
      { label: 'Contract', action: () => this.runSelectionAction(() => this.expandSelection(-1)) }
    ];
    if (!this.selection.active || !this.selection.mask) {
      actions.splice(1);
    }
    actions.forEach((entry) => {
      const bounds = { x, y: offsetY, w: buttonWidth, h: rowHeight };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action), group: 'selection-actions' });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
      offsetY += rowStep;
    });
    return offsetY;
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
      { label: 'Export', action: () => this.choosePixelExportFormat() },
      { label: 'Copy', action: () => this.copySelection() },
      { label: 'Paste', action: () => this.pasteClipboard() },
      { label: 'Import', action: () => this.imageFileInput.click() }
    ];
    actions.forEach((entry, index) => {
      const bounds = { x, y: y + index * (isMobile ? 52 : 20), w: isMobile ? 190 : 140, h: isMobile ? 44 : 18 };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
      this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
      this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
    });
  }

  drawPortraitActionGrid(ctx, x, y, w, actions, options = {}) {
    const metrics = getPixelPortraitActionGridMetrics(w, actions.length, {
      minColumnWidth: options.minColumnWidth || 82,
      maxColumns: options.maxColumns || 3,
      rowHeight: options.rowHeight || 50,
      buttonHeight: options.buttonHeight || 42,
      gap: options.gap || 8
    });
    actions.forEach((entry, index) => {
      const col = index % metrics.columns;
      const row = Math.floor(index / metrics.columns);
      const bounds = {
        x: x + col * (metrics.cellWidth + metrics.gap),
        y: y + row * metrics.rowHeight,
        w: metrics.cellWidth,
        h: metrics.buttonHeight
      };
      this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), { fontSize: 12, disabled: Boolean(entry.disabled) });
      if (!entry.disabled && typeof entry.action === 'function') {
        const group = options.group || 'menu';
        this.uiButtons.push({ bounds, onClick: entry.action, group });
        this.registerFocusable(group, bounds, entry.action);
      }
    });
    return y + metrics.totalHeight;
  }

  drawLayersPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    this.layerListMeta = null;
    const portrait = isMobile && isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    const showPreview = options.showPreview;
    const showControls = options.controls !== false || portrait;
    const buttonHeight = isMobile ? 44 : 18;
    let offsetY = y;
    if (showPreview) {
      const previewH = Math.min(120, Math.max(90, Math.floor(h * 0.35)));
      this.drawPreviewPanel(ctx, x + 4, y + 4, w - 8, previewH - 16);
      offsetY += previewH;
    }
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    const layerGroups = buildPixelPortraitLayerActionGroups();
    const layerSubpanel = portrait ? layerGroups[this.pixelPortraitSubpanel] : null;
    const controls = portrait
      ? buildPixelPortraitLayerActions().map((entry) => this.getPixelPortraitLayerAction(entry))
      : [
        { label: '+', action: () => this.addLayer() },
        { label: 'Dup', action: () => this.duplicateLayer(this.canvasState.activeLayerIndex) },
        { label: '-', action: () => this.deleteLayer(this.canvasState.activeLayerIndex) },
        { label: 'M↑', action: () => this.mergeLayerUp(this.canvasState.activeLayerIndex) },
        { label: 'M↓', action: () => this.mergeLayerDown(this.canvasState.activeLayerIndex) },
        { label: 'Flatten', action: () => this.flattenAllLayers() }
      ];
    if (layerSubpanel) {
      offsetY = this.drawPixelPortraitSubpanelHeader(ctx, x, offsetY, w, layerSubpanel.title);
      this.drawPortraitActionGrid(ctx, x + 12, offsetY + 2, Math.max(1, w - 24), layerSubpanel.actions.map((entry) => this.getPixelPortraitLayerAction(entry)), {
        minColumnWidth: 84,
        maxColumns: 2,
        group: 'menu'
      });
      return;
    }
    ctx.fillText('Layers', x + 12, offsetY + 20);
    if (showControls) {
      if (portrait) {
        offsetY = this.drawPortraitActionGrid(ctx, x + 12, offsetY + 30, Math.max(1, w - 24), controls, {
          minColumnWidth: 84,
          maxColumns: 3,
          group: 'menu'
        }) + 18;
      } else {
        controls.forEach((entry, index) => {
          const bounds = { x: x + 12 + index * (buttonHeight + 6), y: offsetY + 28, w: buttonHeight, h: buttonHeight };
          this.drawButton(ctx, bounds, entry.label, false, { fontSize: isMobile ? 12 : 12 });
          this.uiButtons.push({ bounds, onClick: (entry.onClick || entry.action) });
          this.registerFocusable('menu', bounds, (entry.onClick || entry.action));
        });
        offsetY += 60;
      }
    } else {
      offsetY += 26;
    }
    this.layerBounds = [];
    const lineHeight = isMobile ? 52 : 20;
    const listHeight = Math.max(lineHeight, y + h - offsetY);
    this.focusGroupMeta.layers = { maxVisible: Math.max(1, Math.floor(listHeight / lineHeight)) };
    const maxLayerScroll = Math.max(0, this.canvasState.layers.length - this.focusGroupMeta.layers.maxVisible);
    this.layerListMeta = portrait
      ? {
        scrollBounds: { x: x + 6, y: offsetY - 24, w: w - 12, h: listHeight + 24 },
        lineHeight,
        maxScroll: maxLayerScroll
      }
      : null;
    const start = this.controllerMenu.isMenuActive('layers')
      ? this.controllerMenu.syncScrollToSelection('layers', this.focusGroupMeta.layers.maxVisible, this.focusScroll.layers || 0)
      : (this.focusScroll.layers || 0);
    this.focusScroll.layers = clamp(start, 0, maxLayerScroll);
    const layers = this.canvasState.layers.slice().reverse();
    layers.slice(this.focusScroll.layers, this.focusScroll.layers + this.focusGroupMeta.layers.maxVisible).forEach((layer, visibleIndex) => {
      const reversedIndex = this.focusScroll.layers + visibleIndex;
      const index = this.canvasState.layers.length - 1 - reversedIndex;
      const active = index === this.canvasState.activeLayerIndex;
      const bounds = { x: x + 8, y: offsetY - (isMobile ? 20 : 14), w: w - 16, h: buttonHeight, index };
      this.drawButton(ctx, bounds, '', active, {
        fontSize: isMobile ? 12 : 11,
        focused: this.controllerMenu.isFocusedItem('layers', `layer-${index}`)
      });
      const previewSize = isMobile ? 32 : 14;
      const previewBounds = {
        x: bounds.x + 8,
        y: bounds.y + Math.floor((bounds.h - previewSize) / 2),
        w: previewSize,
        h: previewSize
      };
      this.drawPixelPreviewPixels(ctx, layer.pixels, this.canvasState.width, this.canvasState.height, previewBounds);
      ctx.fillStyle = '#fff';
      ctx.font = `${isMobile ? 12 : 11}px Courier New`;
      const labelX = previewBounds.x + previewBounds.w + 8;
      const rightReserve = portrait ? 82 : 8;
      const labelW = Math.max(20, bounds.x + bounds.w - rightReserve - labelX);
      this.drawFittedText(ctx, `${layer.visible ? 'Vis' : 'Hid'} ${layer.name}`, labelX, bounds.y + bounds.h / 2 + 4, labelW, isMobile ? 12 : 11);
      this.layerBounds.push(bounds);
      this.uiButtons.push({ bounds, onClick: () => { this.canvasState.activeLayerIndex = index; } });
      this.registerFocusable('layers', bounds, () => { this.canvasState.activeLayerIndex = index; });
      if (portrait) {
        const buttonW = 34;
        const upBounds = { x: bounds.x + bounds.w - buttonW * 2 - 8, y: bounds.y + 5, w: buttonW, h: bounds.h - 10 };
        const downBounds = { x: bounds.x + bounds.w - buttonW - 4, y: bounds.y + 5, w: buttonW, h: bounds.h - 10 };
        this.drawButton(ctx, upBounds, 'Up', false, { fontSize: 10, disabled: index >= this.canvasState.layers.length - 1 });
        this.drawButton(ctx, downBounds, 'Dn', false, { fontSize: 10, disabled: index <= 0 });
        if (index < this.canvasState.layers.length - 1) {
          this.uiButtons.push({ bounds: upBounds, onClick: () => this.reorderLayer(index, index + 1) });
          this.registerFocusable('layers', upBounds, () => this.reorderLayer(index, index + 1));
        }
        if (index > 0) {
          this.uiButtons.push({ bounds: downBounds, onClick: () => this.reorderLayer(index, index - 1) });
          this.registerFocusable('layers', downBounds, () => this.reorderLayer(index, index - 1));
        }
      }
      offsetY += lineHeight;
    });
    if (portrait && maxLayerScroll > 0 && this.layerListMeta?.scrollBounds) {
      drawSharedPortraitScrollHints(ctx, this.layerListMeta.scrollBounds, {
        scroll: this.focusScroll.layers,
        scrollMax: maxLayerScroll
      });
    }
  }

  drawPixelPreviewPixels(ctx, pixels, width, height, bounds) {
    if (!pixels || !width || !height || !bounds || bounds.w <= 0 || bounds.h <= 0) return;
    this.offscreen.width = width;
    this.offscreen.height = height;
    const imageData = this.offscreenCtx.createImageData(width, height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(pixels);
    this.offscreenCtx.putImageData(imageData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.drawImage(this.offscreen, bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.restore();
  }

  drawFittedText(ctx, text, x, y, maxWidth, fontSize = 12) {
    const source = String(text || '');
    if (maxWidth <= 0) return;
    ctx.save();
    ctx.font = `${fontSize}px Courier New`;
    let label = source;
    while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
      label = `${label.slice(0, Math.max(1, label.length - 2))}…`;
    }
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  getLayerPixelRefs() {
    return this.canvasState.layers.map((layer) => layer.pixels);
  }

  layerPixelRefsMatch(refs = []) {
    return refs.length === this.canvasState.layers.length
      && refs.every((pixels, index) => pixels === this.canvasState.layers[index]?.pixels);
  }

  getBonePoseCacheSignature(pose = null) {
    if (pose && this.boneEditor?.previewPose === pose && this.boneEditor?.previewPoseSignature) {
      return this.boneEditor.previewPoseSignature;
    }
    if (pose) return JSON.stringify({ bones: pose?.bones || {}, nodes: pose?.nodes || {} });
    return `time:${Math.round(Number(this.boneEditor?.timeMs) || 0)}`;
  }

  isBonePoseVisuallyRest(pose = {}, epsilon = 0.0001) {
    const bones = pose?.bones || {};
    const nodes = pose?.nodes || {};
    return Object.values(bones).every((bonePose) => (
      Math.abs(Number(bonePose?.angle) || 0) <= epsilon
      && Math.abs(Number(bonePose?.dx) || 0) <= epsilon
      && Math.abs(Number(bonePose?.dy) || 0) <= epsilon
      && Math.abs((Number.isFinite(bonePose?.scale) ? bonePose.scale : 1) - 1) <= epsilon
    )) && Object.values(nodes).every((nodePose) => (
      Math.abs(Number(nodePose?.angle) || 0) <= epsilon
    ));
  }

  getCachedLayerComposite(width, height) {
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, overlayRaster: null, graphOverlayRaster: null, composite: null, preview: null, raster: null, geometry: null, mesh: null };
    this.boneDerivedCache = cache;
    const layerRevision = cache.layerRevision ?? cache.revision;
    const contentRevision = this.layerContentRevision || 1;
    const composite = cache.composite;
    if (composite
      && composite.layers === this.canvasState.layers
      && composite.width === width
      && composite.height === height
      && composite.frameIndex === this.animation.currentFrameIndex
      && composite.layerRevision === layerRevision
      && composite.contentRevision === contentRevision
      && this.layerPixelRefsMatch(composite.layerPixelRefs)) {
      return composite.pixels;
    }
    const pixels = compositeLayers(this.canvasState.layers, width, height);
    cache.composite = {
      layers: this.canvasState.layers,
      layerPixelRefs: this.getLayerPixelRefs(),
      width,
      height,
      frameIndex: this.animation.currentFrameIndex,
      layerRevision,
      contentRevision,
      pixels
    };
    return pixels;
  }

  getActivePosePreviewBoneIds(pose = null) {
    if (this.leftPanelTab !== 'bones' || this.boneEditor?.mode !== 'pose') return null;
    const drag = this.boneEditor?.drag;
    if (drag?.type !== 'pose') return null;
    const ids = new Set();
    if (drag.boneId) ids.add(drag.boneId);
    (drag.ikTarget?.ikBoneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.poseTarget?.ikBoneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.widgetRotation?.boneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.fanRotation?.boneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.previewPatchBoneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.rootMoveBoneIds || []).forEach((boneId) => ids.add(boneId));
    (drag.branchMoveBoneIds || []).forEach((boneId) => ids.add(boneId));
    return ids.size ? ids : null;
  }

  shouldCacheStaticCanvasRaster(options = {}) {
    return Boolean(this.bonePreviewCanvas
      && this.bonePreviewCtx
      && !options.selectionCutout
      && !options.hueShift
      && !this.strokeState
      && !this.linePreview
      && !this.curvePreview
      && !this.shapePreview
      && !this.polygonPreview
      && !this.gradientPreview);
  }

  getCachedBonePreviewComposite(width, height, pose = null) {
    if (!this.shouldShowBonePreview()) {
      const getLayerComposite = typeof this.getCachedLayerComposite === 'function'
        ? this.getCachedLayerComposite
        : PixelStudio.prototype.getCachedLayerComposite;
      return getLayerComposite.call(this, width, height);
    }
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, overlayRaster: null, graphOverlayRaster: null, composite: null, preview: null, raster: null, geometry: null, mesh: null };
    this.boneDerivedCache = cache;
    const layerRevision = cache.layerRevision ?? cache.revision;
    const contentRevision = this.layerContentRevision || 1;
    const boneRevision = cache.boneRevision ?? cache.revision;
    const dragPoseActive = this.leftPanelTab === 'bones'
      && this.boneEditor?.mode === 'pose'
      && this.boneEditor?.drag?.type === 'pose';
    let resolvedPose = pose || null;
    let activeBoneIds = null;
    if (dragPoseActive) {
      resolvedPose = resolvedPose || this.getCurrentBonePreviewPose();
      activeBoneIds = typeof this.getActivePosePreviewBoneIds === 'function'
        ? this.getActivePosePreviewBoneIds(resolvedPose)
        : null;
    }
    const poseSignature = this.getBonePoseCacheSignature(resolvedPose);
    const activeBoneSignature = activeBoneIds ? [...activeBoneIds].sort().join(',') : '';
    const preview = cache.preview;
    if (preview
      && preview.rig === this.boneRig
      && preview.layers === this.canvasState.layers
      && preview.width === width
      && preview.height === height
      && preview.frameIndex === this.animation.currentFrameIndex
      && preview.layerRevision === layerRevision
      && preview.contentRevision === contentRevision
      && preview.boneRevision === boneRevision
      && preview.activeBoneSignature === activeBoneSignature
      && preview.poseSignature === poseSignature
      && this.layerPixelRefsMatch(preview.layerPixelRefs)) {
      return preview.pixels;
    }
    resolvedPose = resolvedPose || this.getCurrentBonePreviewPose();
    const isRest = typeof this.isBonePoseVisuallyRest === 'function'
      ? this.isBonePoseVisuallyRest(resolvedPose)
      : false;
    if (isRest) {
      const getLayerComposite = typeof this.getCachedLayerComposite === 'function'
        ? this.getCachedLayerComposite
        : PixelStudio.prototype.getCachedLayerComposite;
      return getLayerComposite.call(this, width, height);
    }
    if (!cache.mesh) cache.mesh = new Map();
    const rigContext = typeof this.getCachedBoneRigContext === 'function'
      ? this.getCachedBoneRigContext()
      : { normalizedRig: normalizeBoneRig(this.boneRig, { exclusive: false }), graph: buildBoneGraph(this.boneRig) };
    const pixels = compositeBonePreview(this.canvasState.layers, width, height, this.boneRig, resolvedPose, {
      meshCache: cache.mesh,
      activeBoneIds,
      normalizedRig: rigContext.normalizedRig,
      graph: rigContext.graph
    });
    cache.preview = {
      rig: this.boneRig,
      layers: this.canvasState.layers,
      layerPixelRefs: this.getLayerPixelRefs(),
      width,
      height,
      frameIndex: this.animation.currentFrameIndex,
      layerRevision,
      contentRevision,
      boneRevision,
      activeBoneSignature,
      poseSignature,
      pixels
    };
    return pixels;
  }

  getCachedBoneCanvasRaster(width, height, pixels, options = {}) {
    const canCache = this.shouldShowBonePreview()
      ? this.shouldCacheStaticCanvasRaster(options)
      : (this.leftPanelTab === 'bones' && this.shouldCacheStaticCanvasRaster(options));
    if (!canCache) return null;
    const cache = this.boneDerivedCache || { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, overlayRaster: null, graphOverlayRaster: null, composite: null, preview: null, raster: null, geometry: null, mesh: null };
    this.boneDerivedCache = cache;
    const layerRevision = cache.layerRevision ?? cache.revision;
    const contentRevision = this.layerContentRevision || 1;
    const raster = cache.raster;
    if (raster
      && raster.pixels === pixels
      && raster.width === width
      && raster.height === height
      && raster.layerRevision === layerRevision
      && raster.contentRevision === contentRevision) {
      return raster.canvas;
    }
    this.bonePreviewCanvas.width = width;
    this.bonePreviewCanvas.height = height;
    const imageData = this.bonePreviewCtx.createImageData(width, height);
    new Uint32Array(imageData.data.buffer).set(pixels);
    this.bonePreviewCtx.putImageData(imageData, 0, 0);
    cache.raster = {
      pixels,
      width,
      height,
      layerRevision,
      contentRevision,
      canvas: this.bonePreviewCanvas
    };
    return this.bonePreviewCanvas;
  }

  shouldDrawCanvasGrid(width, height, zoom, wrapActive = false) {
    if (this.view.showGrid === false) return false;
    if (this.leftPanelTab !== 'bones') return true;
    if (wrapActive || this.tiledPreview?.enabled) return false;
    if (zoom < 6) return false;
    const lineCount = Math.max(0, Math.round(width || 0)) + Math.max(0, Math.round(height || 0)) + 2;
    return lineCount <= 192;
  }

  drawCanvasArea(ctx, x, y, w, h) {
    const { width, height } = this.canvasState;
    this.canvasViewportBounds = { x, y, w, h };
    const zoom = this.view.zoomLevels[this.view.zoomIndex];
    const gridW = width * zoom;
    const gridH = height * zoom;
    const offsetX = x + (w - gridW) / 2 + this.view.panX;
    const offsetY = y + (h - gridH) / 2 + this.view.panY;
    const wrapActive = Boolean(this.toolOptions.wrapDraw);
    this.canvasBounds = wrapActive
      ? { x: offsetX - gridW, y: offsetY - gridH, w: gridW * 3, h: gridH * 3, cellSize: zoom, mainX: offsetX, mainY: offsetY }
      : { x: offsetX, y: offsetY, w: gridW, h: gridH, cellSize: zoom, mainX: offsetX, mainY: offsetY };

    let composite = this.getCachedBonePreviewComposite(width, height);
    const hueShiftPreview = this.activeToolId === TOOL_IDS.HUE_SHIFT && !this.isHueShiftNeutral();
    if (hueShiftPreview) {
      composite = this.buildHueShiftPreview(composite);
    }
    const showGenericSelectionOverlays = this.leftPanelTab !== 'bones' || this.boneEditor?.mode === 'bind';
    const selectionCutout = Boolean(showGenericSelectionOverlays && this.selection.floating && !this.selection.floatingMode && this.selection.mask);
    let imageSource = this.getCachedBoneCanvasRaster(width, height, composite, {
      selectionCutout,
      hueShift: hueShiftPreview
    });
    if (!imageSource) {
      if (this.offscreen.width !== width) this.offscreen.width = width;
      if (this.offscreen.height !== height) this.offscreen.height = height;
      const imageData = this.offscreenCtx.createImageData(width, height);
      const bytes = new Uint32Array(imageData.data.buffer);
      bytes.set(composite);
      if (selectionCutout) {
        for (let i = 0; i < bytes.length; i += 1) {
          if (this.selection.mask[i]) bytes[i] = 0;
        }
      }
      this.offscreenCtx.putImageData(imageData, 0, 0);
      imageSource = this.offscreen;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const drawTileBackground = (tileX, tileY) => {
      this.drawPixelBackground(ctx, tileX, tileY, gridW, gridH, zoom);
    };
    const drawTileImage = (tileX, tileY, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(imageSource, tileX, tileY, gridW, gridH);
      ctx.globalAlpha = 1;
    };
    if (this.leftPanelTab === 'animation') {
      drawTileImage(offsetX, offsetY, 1);
      ctx.restore();
      return;
    }

    if (this.tiledPreview.enabled || wrapActive) {
      for (let row = -1; row <= 1; row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          drawTileBackground(offsetX + col * gridW, offsetY + row * gridH);
        }
      }
    } else {
      drawTileBackground(offsetX, offsetY);
    }

    if (this.animation.onion.enabled) {
      this.drawOnionSkin(ctx, offsetX, offsetY, gridW, gridH);
    }

    if (this.tiledPreview.enabled || wrapActive) {
      for (let row = -1; row <= 1; row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          const isCenter = row === 0 && col === 0;
          drawTileImage(offsetX + col * gridW, offsetY + row * gridH, isCenter ? 1 : (wrapActive ? 0.7 : 0.2));
        }
      }
    } else {
      drawTileImage(offsetX, offsetY, 1);
    }


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
    const drawGrid = this.shouldDrawCanvasGrid
      ? this.shouldDrawCanvasGrid(width, height, zoom, wrapActive)
      : this.view.showGrid !== false;
    if (drawGrid) {
      if (this.tiledPreview.enabled || wrapActive) {
        for (let row = -1; row <= 1; row += 1) {
          for (let col = -1; col <= 1; col += 1) {
            drawGridAt(offsetX + col * gridW, offsetY + row * gridH, row === 0 && col === 0 ? 0.2 : 0.12);
          }
        }
      } else {
        drawGridAt(offsetX, offsetY, 0.15);
      }
    }

    // Always show the primary image bounds, even when cell grid lines are hidden.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, gridW, gridH);

    if (showGenericSelectionOverlays && this.selection.active && this.selection.bounds) {
      this.drawSelectionMarchingAnts(ctx, offsetX, offsetY, zoom);
      if (this.activeToolId === TOOL_IDS.MOVE) {
        const transformPreview = this.buildMoveTransformPreview();
        if (transformPreview?.pixels) {
          this.floatingCanvas.width = width;
          this.floatingCanvas.height = height;
          const previewImage = this.floatingCtx.createImageData(width, height);
          const previewBytes = new Uint32Array(previewImage.data.buffer);
          previewBytes.set(transformPreview.pixels);
          this.floatingCtx.putImageData(previewImage, 0, 0);
          ctx.save();
          ctx.globalAlpha = 0.78;
          ctx.drawImage(this.floatingCanvas, offsetX, offsetY, gridW, gridH);
          ctx.restore();
          const previewBounds = this.getMaskBounds(transformPreview.mask);
          if (previewBounds) {
            ctx.save();
            ctx.strokeStyle = 'rgba(106,215,255,0.9)';
            ctx.lineWidth = Math.max(1, zoom * 0.1);
            ctx.strokeRect(offsetX + previewBounds.x * zoom, offsetY + previewBounds.y * zoom, previewBounds.w * zoom, previewBounds.h * zoom);
            ctx.restore();
          }
        }
        const previewRotation = transformPreview?.rotationDeg || 0;
        const meta = this.getSelectionTransformMeta(previewRotation) || this.getSelectionTransformMeta(0);
        if (meta) {
          const handleRadius = Math.max(4, zoom * 0.22);
        const handles = (meta.handles || []).map((handle) => ({
          key: handle.key,
          x: offsetX + handle.x * zoom,
          y: offsetY + handle.y * zoom
        }));
        const dragPoint = this.moveTransformDrag?.type === 'rotate' ? this.moveTransformDrag.current : null;
        const centerX = offsetX + meta.centerX * zoom;
        const topHandle = handles.find((entry) => entry.key === 'n') || { x: centerX, y: offsetY + meta.centerY * zoom };
        const rotateOrbX = dragPoint ? (offsetX + (dragPoint.col + 0.5) * zoom) : (offsetX + meta.rotateOrb.x * zoom);
        const rotateOrbY = dragPoint ? (offsetY + (dragPoint.row + 0.5) * zoom) : (offsetY + meta.rotateOrb.y * zoom);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,225,106,0.9)';
        ctx.lineWidth = Math.max(1, zoom * 0.1);
        ctx.beginPath();
        ctx.moveTo(topHandle.x, topHandle.y);
        ctx.lineTo(rotateOrbX, rotateOrbY);
        ctx.stroke();
        ctx.fillStyle = 'rgba(106,215,255,0.95)';
        handles.forEach((h) => {
          ctx.fillRect(h.x - handleRadius, h.y - handleRadius, handleRadius * 2, handleRadius * 2);
        });
        ctx.beginPath();
        ctx.arc(rotateOrbX, rotateOrbY, Math.max(5, zoom * 0.32), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,160,106,0.95)';
        ctx.fill();
        ctx.restore();
        }
      }
    }

    if (showGenericSelectionOverlays && this.selection.floating) {
      const floatingOffset = this.selection.floatingMode === 'paste'
        ? this.getFloatingPasteOffset()
        : (this.selection.offset || { x: 0, y: 0 });
      this.floatingCanvas.width = width;
      this.floatingCanvas.height = height;
      const imageData = this.floatingCtx.createImageData(width, height);
      const bytes = new Uint32Array(imageData.data.buffer);
      bytes.set(this.selection.floating);
      this.floatingCtx.putImageData(imageData, 0, 0);
      ctx.save();
      ctx.globalAlpha = this.selection.floatingMode === 'paste' ? 0.6 : 0.78;
      ctx.drawImage(
        this.floatingCanvas,
        offsetX + floatingOffset.x * zoom,
        offsetY + floatingOffset.y * zoom,
        gridW,
        gridH
      );
      ctx.restore();
    }

    if (showGenericSelectionOverlays && this.selection.start && this.selection.end && this.selection.mode === 'rect' && !this.selection.active) {
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

    if (showGenericSelectionOverlays && this.selection.lassoPoints.length > 1) {
      const previewPixels = this.getLassoPreviewPixels();
      if (previewPixels.length) {
        const color = this.activeToolId === TOOL_IDS.SELECT_MAGIC_LASSO ? 'rgba(141,240,255,0.9)' : 'rgba(255,204,106,0.9)';
        this.drawPixelPreview(ctx, previewPixels, offsetX, offsetY, zoom, color);
      }
    }

    if (this.linePreview) {
      const linePoints = bresenhamLine(this.linePreview.start, this.linePreview.end);
      this.drawPixelPreview(ctx, this.expandPreviewPoints(linePoints), offsetX, offsetY, zoom, 'rgba(255,225,106,0.72)');
    }

    if (this.cloneAngleCalibration) {
      if (this.cloneAngleCalibration.sourceLine) {
        const sourcePoints = bresenhamLine(this.cloneAngleCalibration.sourceLine.start, this.cloneAngleCalibration.sourceLine.end);
        this.drawPixelPreview(ctx, this.expandPreviewPoints(sourcePoints), offsetX, offsetY, zoom, 'rgba(255,225,106,0.78)');
      }
      if (this.cloneAngleCalibration.activeLine) {
        const activePoints = bresenhamLine(this.cloneAngleCalibration.activeLine.start, this.cloneAngleCalibration.activeLine.end);
        this.drawPixelPreview(ctx, this.expandPreviewPoints(activePoints), offsetX, offsetY, zoom, 'rgba(141,240,255,0.78)');
      }
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

    if (this.leftPanelTab === 'bones') {
      this.drawSelectedBoneBindingOverlay(ctx, offsetX, offsetY, zoom);
      this.drawBoneOverlay(ctx, offsetX, offsetY, zoom);
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

  getBottomRailActions() {
    if (this.leftPanelTab === 'layers') {
      return [
        { label: '+Layer', action: () => this.addLayer() },
        { label: '-Layer', action: () => this.deleteLayer(this.canvasState.activeLayerIndex) },
        { label: 'Merge↑', action: () => this.mergeLayerUp(this.canvasState.activeLayerIndex) },
        { label: 'Merge↓', action: () => this.mergeLayerDown(this.canvasState.activeLayerIndex) },
        { label: 'Flatten', action: () => this.flattenAllLayers() },
        { label: 'Rename', action: () => this.renameLayer(this.canvasState.activeLayerIndex) },
        {
          label: this.activeLayer?.visible === false ? 'Show' : 'Hide',
          action: () => {
            const layer = this.activeLayer;
            if (!layer) return;
            layer.visible = !layer.visible;
            this.syncTileData();
          }
        },
        { label: 'Up', action: () => this.moveLayerBy(-1) },
        { label: 'Down', action: () => this.moveLayerBy(1) }
      ];
    }
    if (this.leftPanelTab === 'animation') {
      return [
        { label: '+Frame', action: () => this.addFrame() },
        { label: '-Frame', action: () => this.deleteFrame(this.animation.currentFrameIndex) },
        { label: 'Delay', action: () => this.setCurrentFrameDelayMs() },
        { label: this.animation.loop ? 'Loop ✓' : 'Loop', action: () => { this.animation.loop = !this.animation.loop; } },
        { label: 'Up', action: () => this.moveFrameBy(-1) },
        { label: 'Down', action: () => this.moveFrameBy(1) }
      ];
    }
    return [];
  }

  drawManagementActionRail(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    const actions = this.getBottomRailActions();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const title = this.leftPanelTab === 'layers' ? 'Layer Actions' : 'Animation Actions';
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 12 : 14}px Courier New`;
    ctx.fillText(title, x + 10, y + 18);

    const gap = 8;
    const top = y + 22;
    const buttonH = Math.max(20, h - 30);
    const buttonW = Math.max(52, Math.floor((w - 20 - gap * Math.max(0, actions.length - 1)) / Math.max(1, actions.length)));
    let buttonX = x + 10;
    actions.forEach((entry) => {
      const bounds = { x: buttonX, y: top, w: buttonW, h: buttonH };
      this.drawButton(ctx, bounds, entry.label, false, { fontSize: 12 });
      this.uiButtons.push({ bounds, onClick: entry.action });
      this.registerFocusable('menu', bounds, entry.action);
      buttonX += buttonW + gap;
    });
  }

  drawMobileSelectionActionRail(ctx, x, y, w, h) {
    const groups = buildPixelPortraitSelectionActionGroups();
    const subpanel = groups[this.pixelPortraitSubpanel];
    const rootActions = buildPixelPortraitSelectionActions();
    this.paletteBounds = [];
    this.paletteBarScrollBounds = null;
    this.focusGroupMeta.palette = { maxVisible: 0 };
    if (subpanel) {
      this.drawMobileSelectionOptionsSheet(ctx, x, y, w, subpanel);
    }
    this.drawPortraitActionGrid(ctx, x + 10, y + 10, Math.max(1, w - 20), rootActions.map((entry) => this.getPixelPortraitSelectionAction(entry)), {
      minColumnWidth: 70,
      maxColumns: 4,
      rowHeight: Math.max(40, h - 14),
      buttonHeight: Math.max(34, h - 18),
      group: 'selection-actions'
    });
  }

  drawMobileSelectionOptionsSheet(ctx, railX, railY, railW, subpanel) {
    const sheetMargin = 8;
    const sheetH = Math.min(230, Math.max(150, railY - sheetMargin * 2));
    const sheet = {
      x: railX,
      y: Math.max(sheetMargin, railY - sheetH - sheetMargin),
      w: railW,
      h: sheetH
    };
    drawSharedPortraitSheet(ctx, sheet, {
      fill: UI_SUITE.colors.panel,
      border: UI_SUITE.colors.border
    });
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(subpanel.title, sheet.x + 14, sheet.y + 24);
    const closeBounds = { x: sheet.x + sheet.w - 82, y: sheet.y + 8, w: 70, h: 30 };
    this.drawButton(ctx, closeBounds, 'Close', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: closeBounds, onClick: () => { this.pixelPortraitSubpanel = null; } });
    this.registerFocusable('selection-actions', closeBounds, () => { this.pixelPortraitSubpanel = null; });

    this.drawPortraitActionGrid(ctx, sheet.x + 12, sheet.y + 48, Math.max(1, sheet.w - 24), subpanel.actions.map((entry) => this.getPixelPortraitSelectionAction(entry)), {
      minColumnWidth: 90,
      maxColumns: 3,
      rowHeight: 52,
      buttonHeight: 44,
      group: 'selection-actions'
    });
  }

  drawPaletteBar(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    if (isMobile && this.activeToolId === TOOL_IDS.HUE_SHIFT && this.leftPanelTab !== 'select') {
      this.drawHueSaturationMobileRail(ctx, x, y, w, h);
      return;
    }
    if (isMobile && this.leftPanelTab === 'animation') {
      this.drawMobileFrameTransportRail(ctx, x, y, w, h);
      return;
    }
    if (isMobile && this.activeToolId === TOOL_IDS.CLONE && this.leftPanelTab !== 'select') {
      this.drawMobileCloneActionRail(ctx, x, y, w, h);
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 12 : 14}px Courier New`;
    const mobileSelectRail = isMobile && (this.leftPanelTab === 'select' || this.isSelectionToolActive());
    if (mobileSelectRail) {
      this.drawMobileSelectionActionRail(ctx, x, y, w, h);
      return;
    }
    if (!isMobile) {
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

    const gap = 8;
    const paletteSize = this.currentPalette.colors.length;
    if (!Array.isArray(this.recentPaletteIndices) || !this.recentPaletteIndices.length) {
      this.recentPaletteIndices = [this.paletteIndex, this.secondaryPaletteIndex].filter((entry) => entry >= 0 && entry < paletteSize);
    }
    const entries = buildPixelPortraitPaletteRailEntries(this.recentPaletteIndices, paletteSize);
    const startX = x + 10;
    const top = y + 20;
    const paletteButtonW = clamp(Math.floor(w * 0.24), 76, 96);
    const swatchCount = entries.filter((entry) => entry.type === 'swatch' || entry.type === 'eraser').length;
    const swatchAreaW = Math.max(44, w - 20 - paletteButtonW - gap);
    const swatchSize = Math.max(34, Math.min(44, Math.floor((swatchAreaW - gap * Math.max(0, swatchCount - 1)) / Math.max(1, swatchCount || 1))));
    this.focusScroll.palette = 0;
    this.paletteBarScrollBounds = {
      x: startX,
      y: y + 18,
      w: w - 20,
      h: 56,
      maxScroll: 0,
      step: swatchSize + gap
    };

    this.paletteBounds = [];
    this.focusGroupMeta.palette = { maxVisible: entries.length };
    let itemX = startX;
    entries.forEach((entry) => {
      if (entry.type === 'eraser') {
        const bounds = { x: itemX, y: top, w: swatchSize, h: swatchSize, action: () => this.selectEraserColor(), eraser: true };
        this.drawEraserPaletteSwatch(ctx, bounds, this.eraserColorActive);
        this.paletteBounds.push(bounds);
        this.registerFocusable('palette', bounds, () => this.selectEraserColor());
        itemX += swatchSize + gap;
        return;
      }
      if (entry.type === 'swatch') {
        const color = this.currentPalette.colors[entry.index];
        if (!color) return;
        ctx.fillStyle = color.hex;
        ctx.fillRect(itemX, top, swatchSize, swatchSize);
        ctx.strokeStyle = entry.index === this.paletteIndex ? '#ffe16a' : 'rgba(255,255,255,0.3)';
        ctx.strokeRect(itemX, top, swatchSize, swatchSize);
        const bounds = { x: itemX, y: top, w: swatchSize, h: swatchSize, index: entry.index };
        this.paletteBounds.push(bounds);
        this.registerFocusable('palette', bounds, () => this.setPaletteIndex(entry.index));
        itemX += swatchSize + gap;
        return;
      }
    });
    const moreBounds = { x: x + w - 10 - paletteButtonW, y: y + 10, w: paletteButtonW, h: 44 };
    this.drawButton(ctx, moreBounds, 'Palette', false, { fontSize: 12 });
    this.uiButtons.push({ bounds: moreBounds, onClick: () => { this.paletteGridOpen = !this.paletteGridOpen; } });
    this.registerFocusable('menu', moreBounds, () => { this.paletteGridOpen = !this.paletteGridOpen; });
  }

  drawMobileCloneActionRail(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    this.paletteBounds = [];
    this.focusScroll.palette = 0;
    this.focusGroupMeta.palette = { maxVisible: 4 };
    this.paletteBarScrollBounds = null;
    const gap = 8;
    const buttonCount = 4;
    const buttonW = Math.max(54, Math.floor((w - 20 - gap * (buttonCount - 1)) / buttonCount));
    const totalW = buttonW * buttonCount + gap * (buttonCount - 1);
    let itemX = x + Math.max(10, Math.floor((w - totalW) / 2));
    const top = y + Math.max(8, Math.floor((h - 44) / 2));
    const actions = [
      {
        label: this.clonePickSourceArmed ? 'Src...' : 'Source',
        active: Boolean(this.clonePickSourceArmed),
        action: () => {
          if (this.clonePickSourceArmed) {
            this.clonePickSourceArmed = false;
            this.statusMessage = 'Clone paint mode';
          } else {
            this.armCloneSourcePick();
          }
        }
      },
      {
        label: this.cloneAngleCalibration
          ? (this.cloneAngleCalibration.phase === 'source' ? 'Src Ang' : 'Dst Ang')
          : 'Angles',
        active: Boolean(this.cloneAngleCalibration),
        action: () => this.toggleCloneAngleCalibration()
      },
      {
        label: 'Reset',
        active: false,
        action: () => this.resetCloneAlignment()
      },
      {
        label: this.clonePickTargetArmed ? 'Tgt...' : 'Target',
        active: Boolean(this.clonePickTargetArmed),
        action: () => {
          if (this.clonePickTargetArmed) {
            this.clonePickTargetArmed = false;
            this.statusMessage = 'Clone paint mode';
          } else {
            this.armCloneTargetPick();
          }
        }
      }
    ];
    actions.forEach((entry) => {
      const bounds = { x: itemX, y: top, w: buttonW, h: 44, action: entry.action };
      this.drawButton(ctx, bounds, entry.label, entry.active, { fontSize: 11 });
      this.uiButtons.push({ bounds, onClick: entry.action });
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, entry.action);
      itemX += buttonW + gap;
    });
  }

  drawMobileFrameTransportRail(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    this.paletteBounds = [];
    this.focusScroll.palette = 0;
    this.focusGroupMeta.palette = { maxVisible: 5 };
    this.paletteBarScrollBounds = null;
    const gap = 6;
    const buttonCount = 5;
    const buttonW = Math.max(44, Math.floor((w - 20 - gap * (buttonCount - 1)) / buttonCount));
    const totalW = buttonW * buttonCount + gap * (buttonCount - 1);
    let itemX = x + Math.max(10, Math.floor((w - totalW) / 2));
    const top = y + Math.max(8, Math.floor((h - 44) / 2));
    const actions = [
      { label: '⏮', active: false, action: () => this.rewindAnimationFrames() },
      { label: '◀', active: false, action: () => this.previousAnimationFrame() },
      { label: '∞', active: Boolean(this.animation.loop), action: () => { this.animation.loop = !this.animation.loop; } },
      { label: '▶', active: false, action: () => this.stepAnimationFrame() },
      { label: '⏭', active: false, action: () => this.goToLastAnimationFrame() }
    ];
    actions.forEach((entry) => {
      const bounds = { x: itemX, y: top, w: buttonW, h: 44, action: entry.action };
      this.drawButton(ctx, bounds, entry.label, entry.active, { fontSize: 16 });
      this.paletteBounds.push(bounds);
      this.registerFocusable('palette', bounds, entry.action);
      itemX += buttonW + gap;
    });
  }

  drawEraserPaletteSwatch(ctx, bounds, active = false) {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.3)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = '#d22630';
    ctx.lineWidth = Math.max(2, Math.floor(Math.min(bounds.w, bounds.h) / 10));
    ctx.beginPath();
    ctx.moveTo(bounds.x + 6, bounds.y + bounds.h - 6);
    ctx.lineTo(bounds.x + bounds.w - 6, bounds.y + 6);
    ctx.stroke();
    ctx.lineWidth = 1;
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


  drawRightRail(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    if (this.leftPanelTab === 'animation') {
      this.drawFramesPanel(ctx, x + 4, y + 4, w - 8, h - 8, { isMobile: false, controls: false });
      return;
    }
    this.drawLayersPanel(ctx, x + 4, y + 4, w - 8, h - 8, { isMobile: false, controls: false });
  }

  drawFramesPanel(ctx, x, y, w, h, options = {}) {
    const isMobile = options.isMobile;
    this.frameListMeta = null;
    const portrait = isMobile && isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.game?.canvas?.width || 0,
      viewportHeight: this.game?.canvas?.height || 0
    });
    const showControls = options.controls !== false || portrait;
    const buttonHeight = isMobile ? 44 : 18;
    const lineHeight = isMobile ? 52 : 20;
    const playbackRailH = portrait && this.animation.playing ? 56 : 0;
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px Courier New`;
    let offsetY = y + 34;
    const frameGroups = buildPixelPortraitFrameActionGroups();
    const frameSubpanel = portrait ? frameGroups[this.pixelPortraitSubpanel] : null;
    if (frameSubpanel) {
      const panelY = this.drawPixelPortraitSubpanelHeader(ctx, x, y, w, frameSubpanel.title);
      this.drawPortraitActionGrid(ctx, x + 12, panelY + 2, Math.max(1, w - 24), frameSubpanel.actions.map((entry) => this.getPixelPortraitFrameAction(entry)), {
        minColumnWidth: 84,
        maxColumns: 2,
        group: 'menu'
      });
      return;
    }
    ctx.fillText('Frames', x + 12, y + 20);
    if (showControls) {
      const controls = portrait
        ? buildPixelPortraitFrameActions().map((entry) => this.getPixelPortraitFrameAction(entry))
        : [
          { label: '+', action: () => this.addFrame() },
          { label: '-', action: () => this.deleteFrame(this.animation.currentFrameIndex) },
          { label: 'Dup', action: () => this.duplicateFrame(this.animation.currentFrameIndex) }
        ];
      if (portrait) {
        offsetY = this.drawPortraitActionGrid(ctx, x + 12, y + 30, Math.max(1, w - 24), controls, {
          minColumnWidth: 84,
          maxColumns: 3,
          group: 'menu'
        }) + 18;
      } else {
        controls.forEach((entry, index) => {
          const bounds = { x: x + 12 + index * (buttonHeight + 6), y: y + 28, w: buttonHeight + 10, h: buttonHeight };
          this.drawButton(ctx, bounds, entry.label, false, { fontSize: 12 });
          this.uiButtons.push({ bounds, onClick: entry.action });
          this.registerFocusable('menu', bounds, entry.action);
        });
        offsetY += 24;
      }
    }
    this.frameBounds = [];
    const listBottom = y + h - (playbackRailH ? playbackRailH + 8 : 0);
    const listHeight = Math.max(lineHeight, listBottom - offsetY);
    const maxVisible = Math.max(1, Math.floor(listHeight / lineHeight));
    this.focusGroupMeta.frames = { maxVisible };
    const maxFrameScroll = Math.max(0, this.animation.frames.length - maxVisible);
    this.frameListMeta = portrait
      ? {
        scrollBounds: { x: x + 6, y: offsetY - 24, w: w - 12, h: listHeight + 24 },
        lineHeight,
        maxScroll: maxFrameScroll
      }
      : null;
    const start = this.controllerMenu.isMenuActive('frames')
      ? this.controllerMenu.syncScrollToSelection('frames', maxVisible, this.focusScroll.frames || 0)
      : (this.focusScroll.frames || 0);
    this.focusScroll.frames = clamp(start, 0, maxFrameScroll);
    this.animation.frames.slice(this.focusScroll.frames, this.focusScroll.frames + maxVisible).forEach((frame, visibleIndex) => {
      const index = this.focusScroll.frames + visibleIndex;
      const active = index === this.animation.currentFrameIndex;
      const delayMs = Math.max(1, Math.round(Number(frame.durationMs || DEFAULT_FRAME_DURATION_MS)));
      const bounds = { x: x + 8, y: offsetY + visibleIndex * lineHeight - (isMobile ? 20 : 14), w: w - 16, h: buttonHeight, index };
      this.drawButton(ctx, bounds, '', active, {
        fontSize: 12,
        focused: this.controllerMenu.isFocusedItem('frames', `frame-${index}`)
      });
      const previewSize = isMobile ? 32 : 14;
      const previewBounds = {
        x: bounds.x + 8,
        y: bounds.y + Math.floor((bounds.h - previewSize) / 2),
        w: previewSize,
        h: previewSize
      };
      const composite = compositeLayers(frame.layers, this.canvasState.width, this.canvasState.height);
      this.drawPixelPreviewPixels(ctx, composite, this.canvasState.width, this.canvasState.height, previewBounds);
      ctx.fillStyle = '#fff';
      ctx.font = `${isMobile ? 12 : 11}px Courier New`;
      const labelX = previewBounds.x + previewBounds.w + 8;
      const rightReserve = portrait ? 82 : 8;
      const labelW = Math.max(20, bounds.x + bounds.w - rightReserve - labelX);
      this.drawFittedText(ctx, `F${index + 1} ${delayMs}ms`, labelX, bounds.y + bounds.h / 2 + 4, labelW, isMobile ? 12 : 11);
      this.frameBounds.push(bounds);
      this.uiButtons.push({ bounds, onClick: () => { this.animation.currentFrameIndex = index; this.setFrameLayers(this.currentFrame.layers); } });
      this.registerFocusable('frames', bounds, () => { this.animation.currentFrameIndex = index; this.setFrameLayers(this.currentFrame.layers); });
      if (portrait) {
        const buttonW = 34;
        const upBounds = { x: bounds.x + bounds.w - buttonW * 2 - 8, y: bounds.y + 5, w: buttonW, h: bounds.h - 10 };
        const downBounds = { x: bounds.x + bounds.w - buttonW - 4, y: bounds.y + 5, w: buttonW, h: bounds.h - 10 };
        this.drawButton(ctx, upBounds, 'Up', false, { fontSize: 10, disabled: index <= 0 });
        this.drawButton(ctx, downBounds, 'Dn', false, { fontSize: 10, disabled: index >= this.animation.frames.length - 1 });
        if (index > 0) {
          this.uiButtons.push({ bounds: upBounds, onClick: () => this.reorderFrame(index, index - 1) });
          this.registerFocusable('frames', upBounds, () => this.reorderFrame(index, index - 1));
        }
        if (index < this.animation.frames.length - 1) {
          this.uiButtons.push({ bounds: downBounds, onClick: () => this.reorderFrame(index, index + 1) });
          this.registerFocusable('frames', downBounds, () => this.reorderFrame(index, index + 1));
        }
      }
    });
    if (portrait && maxFrameScroll > 0 && this.frameListMeta?.scrollBounds) {
      drawSharedPortraitScrollHints(ctx, this.frameListMeta.scrollBounds, {
        scroll: this.focusScroll.frames,
        scrollMax: maxFrameScroll
      });
    }
    if (playbackRailH) {
      this.drawPortraitFramePlaybackRail(ctx, x + 6, y + h - playbackRailH, w - 12, playbackRailH - 4);
    }
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
