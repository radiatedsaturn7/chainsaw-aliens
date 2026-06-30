import test from 'node:test';
import assert from 'node:assert/strict';

import ActorEditor, { buildActorPortraitMenuModel } from '../../src/ui/ActorEditor.js';
import { buildLevelMobileLandscapeRootTabs, buildLevelPortraitMenuModel, shouldShowLevelEditorTopPlaytestButton } from '../../src/ui/LevelEditorCore.js';
import { buildMidiPortraitMenuModel, buildMidiSharedRootMenuEntries } from '../../src/ui/MidiComposerCore.js';
import {
  applyPixelClipboardPixelsToLayer,
  buildPixelPortraitCanvasActionGroups,
  buildPixelMobileEditorLayout,
  buildPixelPortraitCanvasActions,
  buildPixelPortraitFrameActionGroups,
  buildPixelPortraitFrameActions,
  buildPixelPortraitLayerActionGroups,
  buildPixelPortraitLayerActions,
  buildPixelPortraitMenuModel,
  buildPixelPortraitPaletteRailEntries,
  buildPixelPortraitSelectionActionGroups,
  buildPixelPortraitSelectionActions,
  buildPixelQuantizedHueSamples,
  buildPixelQuantizedSvSamples,
  getPixelQuantizedHueSampleAt,
  getPixelQuantizedSvSampleAt,
  getPixelPortraitActionGridMetrics,
  getPixelPortraitToolGridMetrics,
  getPixelPortraitToolLabel,
  getPixelClipboardPasteOrigin,
  quantizePixelPaletteRgb
} from '../../src/ui/PixelStudio.js';
import PixelStudio from '../../src/ui/PixelStudio.js';
import { TOOL_IDS } from '../../src/ui/pixel-editor/tools.js';
import { buildSfxPortraitMenuModel, buildSfxSharedRootMenuEntries } from '../../src/ui/SfxEditor.js';
import { mergeBuiltInActorOverride } from '../../src/content/builtinActorOverrides.js';
import { BUILT_IN_ACTOR_VISUAL_SCALE, getBuiltInActorOverrideDrawSize } from '../../src/entities/BuiltInActorVisuals.js';
import {
  assertSharedPortraitRailActionCount,
  getSharedPortraitRailActionButtons,
  getSharedPortraitMultiRowTabLayout,
  getSharedTransportPopoverLayout,
  SHARED_PORTRAIT_RAIL_ACTION_COUNT
} from '../../src/ui/uiSuite.js';
import { readFileSync } from 'node:fs';

const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');
const actorEditorSource = readFileSync(new URL('../../src/ui/ActorEditor.js', import.meta.url), 'utf8');
const sfxEditorSource = readFileSync(new URL('../../src/ui/SfxEditor.js', import.meta.url), 'utf8');
const midiEditorSource = readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const cutsceneEditorSource = readFileSync(new URL('../../src/ui/CutsceneEditor.js', import.meta.url), 'utf8');
const projectBrowserSource = readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');
const levelEditorSource = readFileSync(new URL('../../src/ui/LevelEditorCore.js', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../../src/entities/Player.js', import.meta.url), 'utf8');
const companionSource = readFileSync(new URL('../../src/entities/FriendlyCompanion.js', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

test('Pixel portrait root menu exposes every major panel and file utility', () => {
  const model = buildPixelPortraitMenuModel();

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames']);
  assert.deepEqual(model.toolTabs.map((tab) => tab.id), ['draw', 'select', 'tools']);
  assert.deepEqual(model.fileHiddenIds, []);
  assert.ok(model.canvasUtilityIds.includes('copy-image'));
  assert.ok(model.canvasUtilityIds.includes('paste-image'));
  assert.ok(model.canvasUtilityIds.includes('import-image'));
  assert.ok(model.canvasUtilityIds.includes('canvas-export'));
  assert.equal(model.canvasUtilityIds.includes('sprite-sheet'), false);
  assert.equal(model.canvasUtilityIds.includes('export-gif'), false);
  assert.equal(model.canvasUtilityIds.includes('controls'), false);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'brush']);
  assertSharedPortraitRailActionCount(model.bottomRailActions.map((id) => ({ id })), { editor: 'pixel' });
});

test('Pixel portrait root tabs do not register pose timeline controls', () => {
  const rootTabsIndex = pixelStudioSource.indexOf('  drawMobilePortraitRootTabs(ctx, bounds)');
  const toolbarIndex = pixelStudioSource.indexOf('  drawMobileToolbar(ctx, x, y, w, h)', rootTabsIndex);
  assert.ok(rootTabsIndex >= 0);
  assert.ok(toolbarIndex > rootTabsIndex);
  const rootTabsBody = pixelStudioSource.slice(rootTabsIndex, toolbarIndex);

  assert.equal(rootTabsBody.includes('bone-timeline-zoom-slider'), false);
  assert.equal(rootTabsBody.includes('layout.sliderBounds'), false);
});

test('built-in player and companion actors are reserved visual overrides', () => {
  const player = mergeBuiltInActorOverride('Player', {
    states: [
      {
        id: 'run',
        name: 'Run Custom',
        animation: { frames: [{ imageDataUrl: 'data:image/png;base64,stub', durationMs: 80 }] }
      },
      {
        id: 'wall-slide',
        name: 'Wall Slide',
        animation: { fps: 8, frames: [] }
      }
    ]
  });

  assert.equal(player.id, 'player');
  assert.equal(player.name, 'Player');
  assert.equal(player.invulnerable, true);
  assert.equal(player.advanced.builtInActor, 'player');
  assert.equal(player.advanced.reserved, true);
  assert.ok(player.states.some((state) => state.id === 'idle'));
  assert.equal(player.states.find((state) => state.id === 'run').name, 'Run Custom');
  assert.ok(player.states.some((state) => state.id === 'wall-slide'));
});

test('built-in actor overrides appear in actor browser but not level enemy tools', () => {
  assert.equal(projectBrowserSource.includes('listBuiltInActorBrowserEntries'), true);
  assert.equal(actorEditorSource.includes('mergeBuiltInActorOverride'), true);
  assert.equal(actorEditorSource.includes('invalidateBuiltInActorVisualCache'), true);
  assert.equal(levelEditorSource.includes('isBuiltInActorName(name)'), true);
  assert.equal(levelEditorSource.includes('actor?.advanced?.builtInActor'), true);
  assert.equal(playerSource.includes('drawBuiltInActorOverride(ctx, this, this.getBuiltInActorVisualId())'), true);
  assert.equal(companionSource.includes("return 'companion';"), true);
});

test('built-in actor override scale is visual only', () => {
  const definition = mergeBuiltInActorOverride('Player', null);
  const entity = { width: 22, height: 34 };
  const size = getBuiltInActorOverrideDrawSize(definition, { width: 8, height: 8 }, entity);

  assert.equal(BUILT_IN_ACTOR_VISUAL_SCALE, 2.5);
  assert.deepEqual(size, { width: 55, height: 85 });
  assert.deepEqual(entity, { width: 22, height: 34 });
});

test('Pixel portrait menu root has enough height for a two-row full-feature tab strip', () => {
  const tabs = buildPixelPortraitMenuModel().rootTabs;

  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const open = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      menuSheetOpen: true
    });
    const layout = getSharedPortraitMultiRowTabLayout(open.rootRail, tabs, {
      minButtonWidth: 64,
      maxButtonWidth: 112,
      maxRows: 2,
      balanceLastRow: true
    });

    assert.equal(open.orientation, 'portrait');
    assert.equal(layout.buttons.length, tabs.length);
    assert.equal(layout.rows, 2);
    assert.equal(layout.fits, true);
    assert.ok(open.subRail.y + open.subRail.h <= open.rootRail.y);
  }
});

test('Pixel portrait tool menus use compact labels and multi-column grids', () => {
  assert.equal(getPixelPortraitToolLabel({ id: 'select-rect', name: 'Rect Select' }), 'Rect');
  assert.equal(getPixelPortraitToolLabel({ id: 'select-ellipse', name: 'Oval Select' }), 'Oval');
  assert.equal(getPixelPortraitToolLabel({ id: 'color-replace', name: 'Color Replace' }), 'Replace');
  assert.equal(getPixelPortraitToolLabel({ id: 'pencil', name: 'Pencil' }), 'Pencil');

  const narrow = getPixelPortraitToolGridMetrics(344, 260, 7, { minColumnWidth: 82 });
  assert.equal(narrow.columns, 3);
  assert.ok(narrow.cellWidth >= 82);
  assert.ok(narrow.visibleRows >= 4);
  assert.equal(narrow.maxScroll, 0);

  const cramped = getPixelPortraitToolGridMetrics(188, 112, 7, { minColumnWidth: 82 });
  assert.equal(cramped.columns, 2);
  assert.ok(cramped.maxScroll > 0);
});

test('Pixel portrait menu touch scroll starts before drawer button taps', () => {
  const pointerDownIndex = pixelStudioSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = pixelStudioSource.slice(pointerDownIndex, pixelStudioSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const scrollStartIndex = pointerDownBody.indexOf('this.startMenuScrollDrag(payload)');
  const menuOpenIndex = pointerDownBody.indexOf('this.menuOpen || this.controlsOverlayOpen');
  const drawerIndex = pointerDownBody.indexOf('this.mobileDrawerBounds');

  assert.ok(scrollStartIndex > 0);
  assert.ok(scrollStartIndex < menuOpenIndex);
  assert.ok(scrollStartIndex < drawerIndex);
  assert.equal(pixelStudioSource.includes("if (!drag.moved && drag.hitAction) drag.hitAction();"), true);
  assert.equal(pixelStudioSource.includes("'tilePicker'].includes(this.menuScrollDrag.scrollGroup)"), true);
});

test('Pixel portrait canvas, layer, and frame menus use drill-down action groups', () => {
  const canvasActions = buildPixelPortraitCanvasActions().map((entry) => entry.id);
  const layerActions = buildPixelPortraitLayerActions().map((entry) => entry.id);
  const frameActions = buildPixelPortraitFrameActions().map((entry) => entry.id);
  const canvasGroups = buildPixelPortraitCanvasActionGroups();
  const layerGroups = buildPixelPortraitLayerActionGroups();
  const frameGroups = buildPixelPortraitFrameActionGroups();

  assert.deepEqual(canvasActions, [
    'canvas-view',
    'canvas-bg',
    'canvas-transform',
    'canvas-export'
  ]);
  assert.deepEqual(layerActions, ['layer-add', 'layers-manage', 'layers-order']);
  assert.deepEqual(frameActions, ['frame-add', 'frames-manage', 'frames-playback']);
  assert.deepEqual(canvasGroups['canvas-view'].actions.map((entry) => entry.id), ['grid', 'wrap', 'sym-h', 'sym-v', 'tile-preview']);
  assert.deepEqual(canvasGroups['canvas-transform'].actions.map((entry) => entry.id), ['resize', 'scale', 'crop', 'offset']);
  assert.deepEqual(layerGroups['layers-manage'].actions.map((entry) => entry.id), ['layer-duplicate', 'layer-delete', 'layer-rename', 'layer-visibility', 'layer-merge-up', 'layer-merge-down']);
  assert.deepEqual(layerGroups['layers-order'].actions.map((entry) => entry.id), ['layer-up', 'layer-down', 'layer-merge-up', 'layer-merge-down', 'layer-flatten']);
  assert.deepEqual(frameGroups['frames-manage'].actions.map((entry) => entry.id), ['frame-duplicate', 'frame-delete', 'frame-delay', 'frame-loop', 'frame-up', 'frame-down']);
  assert.deepEqual(frameGroups['frames-playback'].actions.map((entry) => entry.id), ['frame-play', 'frame-step', 'frame-rewind']);

  const metrics = getPixelPortraitActionGridMetrics(344, canvasActions.length, { minColumnWidth: 82 });
  assert.equal(metrics.columns, 3);
  assert.ok(metrics.cellWidth >= 82);
  assert.equal(metrics.rows, 2);
});

test('Pixel portrait tool options and management panels avoid false scrollbars and hidden actions', () => {
  const toolOptionsIndex = pixelStudioSource.indexOf('  drawToolOptions(ctx, x, y, options = {})');
  const toolOptionsBody = pixelStudioSource.slice(toolOptionsIndex, pixelStudioSource.indexOf('  drawHueSaturationMobileRail', toolOptionsIndex));
  const layersIndex = pixelStudioSource.indexOf('  drawLayersPanel(ctx, x, y, w, h, options = {})');
  const layersBody = pixelStudioSource.slice(layersIndex, pixelStudioSource.indexOf('  drawCanvasArea', layersIndex));
  const framesIndex = pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})');
  const framesBody = pixelStudioSource.slice(framesIndex, pixelStudioSource.indexOf('  drawGamepadHints', framesIndex));
  const brushPreviewIndex = pixelStudioSource.indexOf('  drawBrushPreviewChip(ctx, bounds)');
  const brushPreviewBody = pixelStudioSource.slice(brushPreviewIndex, pixelStudioSource.indexOf('  updateBrushPickerSliderFromX', brushPreviewIndex));

  assert.equal(toolOptionsBody.includes('const bodyH = Math.max(28, y + panelHeight - bodyY - 8);'), true);
  assert.equal(toolOptionsBody.includes('const startY = offsetY;'), true);
  assert.equal(pixelStudioSource.includes('drawPortraitToolOptionButton'), true);
  assert.equal(pixelStudioSource.includes('drawPortraitToolOptionStepper'), true);
  assert.equal(toolOptionsBody.includes('drawPortraitToolOptionButton(ctx, x, offsetY, this.toolOptions.shapeFill'), true);
  assert.equal(toolOptionsBody.includes("drawPortraitToolOptionStepper(ctx, x, offsetY, 'Tolerance'"), true);
  assert.equal(toolOptionsBody.includes("drawPortraitToolOptionStepper(ctx, x, offsetY, 'Strength'"), true);
  assert.equal(toolOptionsBody.includes('const bodyY = y + (isMobile ? 8 : 14);'), true);
  assert.equal(pixelStudioSource.includes('isBrushAdjustableTool'), true);
  assert.equal(pixelStudioSource.includes("actions.push({ id: 'brush', label: '', primary: true, onClick: () => this.openBrushPicker('size') });"), true);
  assert.equal(pixelStudioSource.includes("this.drawBrushPreviewChip(ctx, {"), true);
  assert.equal(pixelStudioSource.includes("focusLabels[this.brushPickerFocus]"), true);
  assert.equal(pixelStudioSource.includes("Brushes / ${focusLabel}"), true);
  assert.equal(pixelStudioSource.includes('const DEFAULT_BRUSH_SIZE = 7;'), true);
  assert.equal(pixelStudioSource.includes('brushSize: DEFAULT_BRUSH_SIZE'), true);
  assert.equal(pixelStudioSource.includes('brushHardness: 1'), true);
  assert.equal(pixelStudioSource.includes('refreshDefaultBrushProfiles({ onlyStale: true })'), true);
  assert.equal(pixelStudioSource.includes('Brush Settings'), true);
  assert.equal(pixelStudioSource.includes("this.openBrushPicker('size')"), true);
  assert.equal(pixelStudioSource.includes('Shape: ${this.toolOptions.brushShape}'), false);
  assert.equal(pixelStudioSource.includes('Size: ${Math.round(this.toolOptions.brushSize)}px'), false);
  assert.equal(pixelStudioSource.includes('Opacity ${Math.round((this.toolOptions.brushOpacity ?? 1) * 100)}%'), false);
  assert.equal(pixelStudioSource.includes('Hardness ${Math.round((this.toolOptions.brushHardness ?? 0) * 100)}%'), false);
  assert.equal(pixelStudioSource.includes('Falloff ${Math.round((this.toolOptions.brushFalloff ?? 0) * 100)}%'), false);
  assert.equal(brushPreviewBody.includes('${Math.round(this.toolOptions.brushSize)}px'), false);
  assert.equal(pixelStudioSource.includes("this.pixelPortraitSubpanel === 'tool-options'"), true);
  assert.equal(pixelStudioSource.includes("this.openPixelPortraitSubpanel('tool-options')"), true);
  assert.equal(pixelStudioSource.includes('brushOpacity: this.toolOptions.brushOpacity'), true);
  assert.equal(pixelStudioSource.includes('brushHardness: this.toolOptions.brushHardness'), true);
  assert.equal(pixelStudioSource.includes('brushFalloff: this.toolOptions.brushFalloff'), true);
  assert.equal(layersBody.includes('buildPixelPortraitLayerActionGroups()'), true);
  assert.equal(layersBody.includes('this.layerListMeta = portrait'), true);
  assert.equal(framesBody.includes('buildPixelPortraitFrameActionGroups()'), true);
  assert.equal(framesBody.includes('this.frameListMeta = portrait'), true);
  assert.equal(framesBody.includes('playbackRailH'), true);
  assert.equal(framesBody.includes('drawPortraitFramePlaybackRail'), true);
  assert.equal(pixelStudioSource.includes('stepAnimationFrame()'), true);
  assert.equal(pixelStudioSource.includes('rewindAnimationFrames()'), true);
  assert.equal(pixelStudioSource.includes('drawMobileFrameTransportRail'), true);
  assert.equal(pixelStudioSource.includes("this.leftPanelTab === 'animation'"), true);
  assert.equal(pixelStudioSource.includes("{ label: '⏮', active: false, action: () => this.rewindAnimationFrames() }"), true);
  assert.equal(pixelStudioSource.includes("{ label: '◀', active: false, action: () => this.previousAnimationFrame() }"), true);
  assert.equal(pixelStudioSource.includes("{ label: '∞', active: Boolean(this.animation.loop), action: () => { this.animation.loop = !this.animation.loop; } }"), true);
  assert.equal(pixelStudioSource.includes("{ label: '▶', active: false, action: () => this.stepAnimationFrame() }"), true);
  assert.equal(pixelStudioSource.includes("{ label: '⏭', active: false, action: () => this.goToLastAnimationFrame() }"), true);
  assert.equal(pixelStudioSource.includes("if (this.leftPanelTab === 'animation') {\n      drawTileImage(offsetX, offsetY, 1);\n      ctx.restore();\n      return;\n    }"), true);
  assert.equal(pixelStudioSource.includes("if (this.leftPanelTab === 'animation') {\n        this.pointerDownOnUi = true;\n        return;\n      }"), true);
  assert.equal(pixelStudioSource.includes("scrollGroup: 'layers'"), true);
  assert.equal(pixelStudioSource.includes("scrollGroup: 'frames'"), true);
});

test('Pixel portrait selection actions drill down and keep paste visible', () => {
  const rootActions = buildPixelPortraitSelectionActions().map((entry) => entry.id);
  const groups = buildPixelPortraitSelectionActionGroups();

  assert.deepEqual(rootActions, ['selection-mode', 'selection-clipboard', 'selection-select', 'selection-transform-tools']);
  assert.equal(buildPixelPortraitSelectionActions().find((entry) => entry.id === 'selection-transform-tools')?.label, 'Tools');
  assert.deepEqual(groups['selection-mode'].actions.map((entry) => entry.id), ['selection-replace', 'selection-add', 'selection-subtract']);
  assert.deepEqual(groups['selection-clipboard'].actions.map((entry) => entry.id), ['selection-paste', 'selection-copy', 'selection-cut', 'selection-delete']);
  assert.deepEqual(groups['selection-transform-tools'].actions.map((entry) => entry.id), ['selection-transform', 'selection-flip', 'selection-rotate', 'selection-skew', 'selection-stretch']);
  assert.equal(pixelStudioSource.includes("title: 'Selection'"), false);
  assert.equal(pixelStudioSource.includes("disabled: !hasOptions"), true);
  assert.equal(pixelStudioSource.includes('drawMobileSelectionActionRail'), true);
  assert.equal(pixelStudioSource.includes('drawMobileSelectionOptionsSheet'), true);
  assert.equal(pixelStudioSource.includes("ctx.fillText('Selection Actions'"), false);
  assert.equal(pixelStudioSource.includes("ctx.fillText(`Palette: ${this.currentPalette.name}`"), true);
  assert.equal(pixelStudioSource.includes("if (!isMobile) {\n      ctx.fillText(`Palette: ${this.currentPalette.name}`"), true);
  assert.equal(pixelStudioSource.includes('Mode: Eyedropper'), false);
  assert.equal(pixelStudioSource.includes("label: entry.id === 'selection-transform' ? 'Trans' : entry.label"), true);
  assert.equal(pixelStudioSource.includes("this.leftPanelTab === 'select' || this.isSelectionToolActive()"), true);
  assert.equal(pixelStudioSource.includes('buildPixelPortraitSelectionActions()'), true);
  assert.equal(pixelStudioSource.includes("this.drawButton(ctx, closeBounds, 'Close'"), true);
});

test('Pixel portrait palette rail uses recent swatches and palette button', () => {
  const entries = buildPixelPortraitPaletteRailEntries([7, 2, 7, 1, 8, 0], 8);

  assert.deepEqual(entries, [
    { id: 'eraser', type: 'eraser' },
    { id: 'recent-7', type: 'swatch', index: 7 },
    { id: 'recent-2', type: 'swatch', index: 2 },
    { id: 'recent-1', type: 'swatch', index: 1 },
    { id: 'recent-0', type: 'swatch', index: 0 },
    { id: 'palette', type: 'button', label: 'Palette' }
  ]);
  assert.equal(pixelStudioSource.includes('buildPixelPortraitPaletteRailEntries(this.recentPaletteIndices'), true);
  assert.equal(pixelStudioSource.includes("entry.type === 'eraser'"), true);
  assert.equal(pixelStudioSource.includes('drawEraserPaletteSwatch'), true);
  assert.equal(pixelStudioSource.includes('selectEraserColor()'), true);
  assert.equal(pixelStudioSource.includes('drawMobileCloneActionRail'), true);
  assert.equal(pixelStudioSource.includes("this.activeToolId === TOOL_IDS.CLONE"), true);
  assert.equal(pixelStudioSource.includes('armCloneSourcePick()'), true);
  assert.equal(pixelStudioSource.includes('armCloneTargetPick()'), true);
  assert.equal(pixelStudioSource.includes("label: this.clonePickSourceArmed ? 'Src...' : 'Source'"), true);
  assert.equal(pixelStudioSource.includes("label: 'Reset'"), true);
  assert.equal(pixelStudioSource.includes("label: this.clonePickTargetArmed ? 'Tgt...' : 'Target'"), true);
  assert.equal(pixelStudioSource.includes("label: alphaMode === 'copy' ? 'Alpha C' : 'Alpha S'"), false);
  assert.equal(pixelStudioSource.includes('this.uiButtons.push({ bounds, onClick: entry.action });'), true);
  assert.equal(pixelStudioSource.includes("this.drawButton(ctx, moreBounds, 'Palette'"), true);
});

test('Pixel menu button closes open overlays before opening the file menu', () => {
  assert.equal(pixelStudioSource.includes('closeOpenUiLayer()'), true);
  assert.equal(pixelStudioSource.includes('if (this.closeOpenUiLayer()) return;'), true);
  assert.equal(pixelStudioSource.includes('this.controllerMenu.closeToSurface();'), true);
  assert.equal(pixelStudioSource.includes("this.mobileDrawer === 'panel'"), true);
  assert.equal(pixelStudioSource.includes('this.paletteGridOpen = false;'), true);
});

test('Pixel palette quantization snaps exact RGB values', () => {
  assert.deepEqual(quantizePixelPaletteRgb({ r: 255, g: 0, b: 1 }, 32), { r: 255, g: 0, b: 0 });
  assert.deepEqual(quantizePixelPaletteRgb({ r: 250, g: 10, b: 10 }, 8), { r: 255, g: 0, b: 0 });
  assert.equal(pixelStudioSource.includes('this.applyPaletteDraftQuantization();'), true);
  assert.equal(pixelStudioSource.includes('const hex = this.rgbToHex(this.paletteColorDraft.r, this.paletteColorDraft.g, this.paletteColorDraft.b);'), true);
});

test('Pixel palette picker persists quantization and renders quantized samples', () => {
  const validChannel = (value) => value === quantizePixelPaletteRgb({ r: value, g: value, b: value }, 8).r;
  const hueSamples = buildPixelQuantizedHueSamples(8);
  const svSamples = buildPixelQuantizedSvSamples(0, 8);

  assert.equal(hueSamples.length, 8);
  assert.equal(svSamples.size, 8);
  for (const sample of hueSamples) {
    assert.equal(validChannel(sample.rgb.r), true);
    assert.equal(validChannel(sample.rgb.g), true);
    assert.equal(validChannel(sample.rgb.b), true);
  }
  for (const sample of svSamples.samples) {
    assert.equal(validChannel(sample.rgb.r), true);
    assert.equal(validChannel(sample.rgb.g), true);
    assert.equal(validChannel(sample.rgb.b), true);
  }
  assert.equal(pixelStudioSource.includes('this.paletteQuantization = 32;'), true);
  assert.equal(pixelStudioSource.includes('quantization: this.paletteQuantization || 32'), true);
  assert.equal(pixelStudioSource.includes('this.paletteQuantization = next;'), true);
  assert.equal(pixelStudioSource.includes('buildPixelQuantizedHueSamples(quantizationLevels)'), true);
  assert.equal(pixelStudioSource.includes('buildPixelQuantizedSvSamples(displayHue, quantizationLevels)'), true);
  assert.equal(pixelStudioSource.includes('setPaletteDraftFromSvPointer'), true);
  assert.equal(pixelStudioSource.includes('setPaletteDraftFromHuePointer'), true);
  assert.equal(pixelStudioSource.includes('previewBounds'), true);
});

test('Pixel palette picker selects from the same quantized samples it renders', () => {
  const validChannel = (value) => value === quantizePixelPaletteRgb({ r: value, g: value, b: value }, 8).r;
  const hueSample = getPixelQuantizedHueSampleAt(0.51, 8);
  const svSample = getPixelQuantizedSvSampleAt(hueSample.h, 0.49, 0.72, 8);

  assert.equal(validChannel(hueSample.rgb.r), true);
  assert.equal(validChannel(hueSample.rgb.g), true);
  assert.equal(validChannel(hueSample.rgb.b), true);
  assert.equal(validChannel(svSample.rgb.r), true);
  assert.equal(validChannel(svSample.rgb.g), true);
  assert.equal(validChannel(svSample.rgb.b), true);
  assert.equal(Number.isInteger(svSample.sx), true);
  assert.equal(Number.isInteger(svSample.vy), true);
  assert.equal(pixelStudioSource.includes('const sample = getPixelQuantizedSvSampleAt'), true);
  assert.equal(pixelStudioSource.includes('const sample = getPixelQuantizedHueSampleAt'), true);
});

test('Pixel palette picker preserves selected hue when choosing neutral gradient colors', () => {
  const studio = Object.create(PixelStudio.prototype);
  studio.paletteColorDraft = {
    h: 225,
    displayHue: 225,
    s: 1,
    v: 1,
    r: 0,
    g: 73,
    b: 255,
    quantization: 8
  };

  studio.setPaletteDraftFromSvPointer(0, 0, { x: 0, y: 0, w: 100, h: 100 });
  assert.deepEqual(
    { r: studio.paletteColorDraft.r, g: studio.paletteColorDraft.g, b: studio.paletteColorDraft.b },
    { r: 255, g: 255, b: 255 }
  );
  assert.equal(Math.round(studio.paletteColorDraft.displayHue), 225);
  assert.equal(Math.round(studio.paletteColorDraft.h), 225);

  studio.paletteColorDraft.r = 0;
  studio.paletteColorDraft.g = 73;
  studio.paletteColorDraft.b = 255;
  studio.syncPaletteDraftFromRgb();
  assert.notEqual(Math.round(studio.paletteColorDraft.displayHue), 225);
  assert.ok(studio.paletteColorDraft.s > 0);
});

function intersects(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

test('Pixel mobile landscape keeps palette and toolbar off the canvas', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    const layout = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      drawerOpen: false
    });

    assert.equal(layout.orientation, 'landscape');
    assert.equal(layout.paletteStrip, null);
    assert.equal(layout.toolbarStrip, null);
    assert.ok(layout.workSurface.x >= layout.leftRail.x + layout.leftRail.w);
    assert.ok(layout.workSurface.y >= 0);
    assert.ok(layout.workSurface.x + layout.workSurface.w <= width);
    assert.ok(layout.workSurface.y + layout.workSurface.h <= height);
    assert.equal(intersects(layout.workSurface, layout.paletteStrip), false);
    assert.equal(intersects(layout.workSurface, layout.toolbarStrip), false);
  }
});

test('Pixel portrait reserves a compact swatch strip only when the sheet is closed', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const closed = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      menuSheetOpen: false
    });
    const open = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      menuSheetOpen: true
    });

    assert.equal(closed.orientation, 'portrait');
    assert.ok(closed.paletteStrip);
    assert.ok(closed.zoomStrip);
    assert.ok(closed.zoomStrip.y >= closed.workSurface.y + closed.workSurface.h);
    assert.ok(closed.zoomStrip.y + closed.zoomStrip.h <= closed.paletteStrip.y);
    assert.ok(closed.paletteStrip.y >= closed.workSurface.y + closed.workSurface.h);
    assert.ok(closed.paletteStrip.y + closed.paletteStrip.h <= closed.actionRail.y);
    assert.ok(closed.paletteStrip.x >= 0);
    assert.ok(closed.paletteStrip.x + closed.paletteStrip.w <= width);
    assert.equal(intersects(closed.workSurface, closed.paletteStrip), false);
    assert.equal(intersects(closed.workSurface, closed.zoomStrip), false);
    assert.equal(intersects(closed.zoomStrip, closed.paletteStrip), false);
    assert.equal(open.paletteStrip, null);
    assert.equal(open.zoomStrip, null);
    assert.ok(open.workSurface.h > closed.workSurface.h);
  }
});

test('Pixel clipboard paste preserves internal origin and centers external content', () => {
  const internal = getPixelClipboardPasteOrigin(
    { width: 3, height: 2, originX: 5, originY: 6 },
    16,
    16,
    { centerCol: 10, centerRow: 10 }
  );
  assert.deepEqual(internal, { x: 5, y: 6 });

  const external = getPixelClipboardPasteOrigin(
    { width: 4, height: 2 },
    16,
    16,
    { centerCol: 8, centerRow: 8 }
  );
  assert.deepEqual(external, { x: 6, y: 7 });

  const pixels = new Uint32Array([0xff0000ff, 0, 0x00ff00ff, 0xffffffff]);
  const layer = new Uint32Array(6 * 5);
  const pasted = applyPixelClipboardPixelsToLayer({
    source: { width: 2, height: 2, pixels },
    layerPixels: layer,
    canvasWidth: 6,
    canvasHeight: 5,
    origin: { x: 3, y: 2 }
  });

  assert.equal(layer[2 * 6 + 3], 0xff0000ff);
  assert.equal(layer[3 * 6 + 3], 0x00ff00ff);
  assert.equal(layer[3 * 6 + 4], 0xffffffff);
  assert.equal(pasted.mask[2 * 6 + 3], 1);
  assert.equal(pasted.mask[2 * 6 + 4], 0);
  assert.deepEqual(pasted.bounds, { x: 3, y: 2, w: 2, h: 2 });
});

test('Pixel paste selects only pasted pixels and switches to transform move mode', () => {
  const studio = Object.create(PixelStudio.prototype);
  studio.canvasState = {
    width: 6,
    height: 5,
    activeLayerIndex: 0,
    layers: [{ name: 'Layer 1', pixels: new Uint32Array(30) }]
  };
  studio.selection = {};
  studio.startHistory = () => {};
  studio.commitHistory = () => {};
  studio.getPasteViewportCenterCell = () => ({ centerCol: 3, centerRow: 2 });
  studio.setActiveTool = (toolId) => { studio.activeToolId = toolId; };

  studio.applyClipboardPaste({
    width: 2,
    height: 2,
    originX: 4,
    originY: 1,
    pixels: new Uint32Array([0xff0000ff, 0, 0, 0x00ff00ff])
  }, { pasteToNewLayer: false });

  assert.equal(studio.activeToolId, TOOL_IDS.MOVE);
  assert.equal(studio.selection.active, true);
  assert.deepEqual(studio.selection.bounds, { x: 4, y: 1, w: 2, h: 2 });
  assert.equal(studio.selection.mask[1 * 6 + 4], 1);
  assert.equal(studio.selection.mask[1 * 6 + 5], 0);
  assert.equal(studio.selection.mask[2 * 6 + 5], 1);
});

test('Pixel animation playback advances preview without mutating frame layer data', () => {
  const studio = Object.create(PixelStudio.prototype);
  const frameA = {
    durationMs: 10,
    layers: [
      { name: 'A', visible: true, locked: false, opacity: 1, pixels: new Uint32Array([1, 0, 0, 0]) },
      { name: 'B', visible: false, locked: false, opacity: 0.5, pixels: new Uint32Array([0, 2, 0, 0]) }
    ]
  };
  const frameB = {
    durationMs: 10,
    layers: [
      { name: 'C', visible: true, locked: false, opacity: 1, pixels: new Uint32Array([0, 0, 3, 0]) }
    ]
  };
  studio.animation = { playing: true, loop: false, currentFrameIndex: 0, frames: [frameA, frameB] };
  studio.canvasState = { layers: frameA.layers };
  studio.setFrameLayers = (layers) => { studio.canvasState.layers = layers; };
  const before = studio.animation.frames.map((frame) => ({
    durationMs: frame.durationMs,
    layers: frame.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      pixels: Array.from(layer.pixels)
    }))
  }));

  studio.updateAnimation(20);

  const after = studio.animation.frames.map((frame) => ({
    durationMs: frame.durationMs,
    layers: frame.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      pixels: Array.from(layer.pixels)
    }))
  }));
  assert.deepEqual(after, before);
  assert.equal(studio.animation.currentFrameIndex, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(frameA, 'elapsed'), false);
});

test('Level portrait menu exposes compact roots and keeps playtest on bottom rail only', () => {
  const model = buildLevelPortraitMenuModel();

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'tools', 'assets', 'settings']);
  assert.deepEqual(model.assetTabs.map((tab) => tab.id), ['tiles', 'pixels', 'npcs', 'triggers', 'powerups', 'prefabs', 'music', 'graphics']);
  assert.deepEqual(model.assetTabs.find((tab) => tab.id === 'pixels')?.label, 'Tile Art');
  assert.deepEqual(model.assetTabs.find((tab) => tab.id === 'graphics')?.label, 'Decals');
  assert.deepEqual(model.settingsTabs.map((tab) => tab.id), ['level-settings', 'midi']);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'playtest']);
  assert.equal(model.rootTabs.some((tab) => tab.id === 'playtest' || tab.panel === 'playtest'), false);
  assert.equal(model.assetTabs.some((tab) => tab.id === 'playtest'), false);
  assert.equal(model.settingsTabs.some((tab) => tab.id === 'playtest'), false);
});

test('Level top playtest button is hidden only in mobile portrait', () => {
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: true,
    viewportWidth: 390,
    viewportHeight: 844
  }), false);
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: true,
    viewportWidth: 844,
    viewportHeight: 390
  }), true);
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: false,
    viewportWidth: 390,
    viewportHeight: 844
  }), true);
});

test('Level mobile landscape rail exposes every root action for scrolling', () => {
  const tabs = buildLevelMobileLandscapeRootTabs();

  assert.deepEqual(tabs.map((tab) => tab.id), [
    'file',
    'toolbox',
    'tiles',
    'pixels',
    'npcs',
    'triggers',
    'powerups',
    'prefabs',
    'graphics',
    'music',
    'level-settings',
    'undo',
    'redo'
  ]);
  assert.equal(new Set(tabs.map((tab) => tab.id)).size, tabs.length);
  assert.ok(tabs.length > 7);
});

test('Level mobile landscape rail is backed by shared editor menu aliases', () => {
  const tabs = buildLevelMobileLandscapeRootTabs();

  assert.equal(tabs.find((tab) => tab.id === 'pixels')?.specId, 'tile-art');
  assert.equal(tabs.find((tab) => tab.id === 'npcs')?.specId, 'actors');
  assert.equal(tabs.find((tab) => tab.id === 'prefabs')?.specId, 'structures');
  assert.equal(tabs.find((tab) => tab.id === 'level-settings')?.specId, 'settings');
  assert.equal(tabs.some((tab) => tab.id === 'playtest'), false);
});

test('Level gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  assert.equal(levelEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(levelEditorSource.includes('isGamepadLandscapeMenuMode(width'), true);
  assert.equal(levelEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(levelEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH });'), true);
  assert.equal(levelEditorSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('Level desktop right button pans instead of erasing or placing content', () => {
  const pointerDownIndex = levelEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = levelEditorSource.slice(pointerDownIndex, levelEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const rightPanIndex = pointerDownBody.indexOf("payload.button === 1 || payload.button === 2 || (payload.button === 0 && this.game.input.isDownCode('Space'))");
  const dragModeIndex = pointerDownBody.indexOf('const dragMode = this.resolveDragMode(this.mode);');

  assert.ok(rightPanIndex > 0);
  assert.ok(dragModeIndex > rightPanIndex);
  assert.equal(pointerDownBody.includes("this.tileTool = 'erase';"), false);
});

test('Level editor keeps settings and tile art reachable from desktop rail', () => {
  assert.equal(levelEditorSource.includes("this.panelTabs = ['file', 'toolbox', 'tiles', 'pixels', 'npcs', 'triggers', 'powerups', 'prefabs', 'graphics', 'music', 'level-settings']"), true);
  assert.equal(levelEditorSource.includes("const topButtonDefById = new Map(topButtonDefs.map((entry) => [entry.id, entry]));"), true);
  assert.equal(levelEditorSource.includes("const def = topButtonDefById.get(entry.id);"), true);
  assert.equal(levelEditorSource.includes("{ id: 'pixels', title: 'Tile Art'"), true);
});

test('Level file menu uses one shared item source across surfaces', () => {
  const fileItemsIndex = levelEditorSource.indexOf('  getLevelFileMenuItems(');
  const fileItemsBody = levelEditorSource.slice(fileItemsIndex, levelEditorSource.indexOf('  getPanelConfig(tabId', fileItemsIndex));
  const panelIndex = levelEditorSource.indexOf("    } else if (tabId === 'file') {");
  const panelBody = levelEditorSource.slice(panelIndex, levelEditorSource.indexOf("    } else if (tabId === 'level-settings')", panelIndex));
  const controllerIndex = levelEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = levelEditorSource.slice(controllerIndex, levelEditorSource.indexOf('      system:', controllerIndex));
  const drawerIndex = levelEditorSource.indexOf("        if (activeTab === 'file') {");
  const drawerBody = levelEditorSource.slice(drawerIndex, levelEditorSource.indexOf("        } else if (activeTab === 'level-settings')", drawerIndex));

  assert.equal(fileItemsBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileItemsBody.includes('includeFooter,'), true);
  assert.equal(fileItemsBody.includes("id: 'playtest'"), true);
  assert.equal(fileItemsBody.includes("id: 'exit-main'"), true);
  assert.equal(panelBody.includes('items = this.getLevelFileMenuItems();'), true);
  assert.equal(controllerBody.includes('items: this.getLevelFileMenuItems().map((item) => ('), true);
  assert.equal(drawerBody.includes('this.getLevelFileMenuItems({ includePlaytest: !portraitLayout })'), true);
});

test('Level desktop dropdown uses the selected top root menu', () => {
  const dropdownIndex = levelEditorSource.indexOf('if (shellLayout.dropdown) {');
  const dropdownBlock = levelEditorSource.slice(dropdownIndex, levelEditorSource.indexOf('const infoLines = []', dropdownIndex));

  assert.equal(dropdownBlock.includes('const dropdownRootId = shellLayout.dropdown.rootId;'), true);
  assert.equal(dropdownBlock.includes('const { items: dropdownItems } = this.getPanelConfig(dropdownRootId);'), true);
  assert.equal(dropdownBlock.includes('getActiveState(item, dropdownRootId)'), true);
  assert.equal(dropdownBlock.includes('this.controllerMenu.isFocusedItem(dropdownRootId, item.id, index)'), true);
});

test('Level editor Tile Art opens the supported tile picker only', () => {
  const panelStart = levelEditorSource.indexOf("} else if (tabId === 'pixels') {");
  const panelEnd = levelEditorSource.indexOf("} else if (tabId === 'music') {", panelStart);
  const panelBlock = levelEditorSource.slice(panelStart, panelEnd);
  const drawerStart = levelEditorSource.indexOf("} else if (activeTab === 'pixels') {");
  const drawerEnd = levelEditorSource.indexOf("} else if (activeTab === 'music') {", drawerStart);
  const drawerBlock = levelEditorSource.slice(drawerStart, drawerEnd);

  assert.ok(panelBlock.includes("id: 'tile-art-picker'"));
  assert.ok(panelBlock.includes('this.openTileArtPicker()'));
  assert.ok(drawerBlock.includes("id: 'tile-art-picker'"));
  assert.ok(drawerBlock.includes('this.openTileArtPicker()'));
  for (const removedId of ['pixel-brush', 'pixel-erase', 'pixel-prev-frame', 'pixel-next-frame', 'pixel-add-frame', 'pixel-remove-frame', 'pixel-fps-up', 'pixel-fps-down']) {
    assert.equal(panelBlock.includes(removedId), false);
    assert.equal(drawerBlock.includes(removedId), false);
  }
  assert.ok(levelEditorSource.includes("this.game?.enterPixelStudio?.({ returnState: 'editor', resetFocus: false, tilePicker: true });"));
});

test('Pixel tile picker Back respects the PixelStudio return state', () => {
  assert.ok(pixelStudioSource.includes('exitTilePicker()'));
  assert.ok(pixelStudioSource.includes("const returnState = this.game?.pixelStudioReturnState;"));
  assert.ok(pixelStudioSource.includes("this.game.exitPixelStudio({ toTitle: !['editor', 'actor-editor'].includes(returnState) });"));
  assert.ok(pixelStudioSource.includes('onClick: () => this.exitTilePicker()'));
});

test('shared portrait action rail keeps canonical controls visible on phone widths', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const rail = { x: 8, y: height - 96, w: width - 16, h: 88 };
    const layout = getSharedPortraitRailActionButtons(rail, [
      { id: 'menu', label: '☰' },
      { id: 'undo', label: '↶' },
      { id: 'redo', label: '↷' },
      { id: 'primary', label: '▶', primary: true }
    ]);

    assert.deepEqual(layout.buttons.map((button) => button.id), ['menu', 'undo', 'redo', 'primary']);
    assert.ok(layout.thumbstickBounds.w >= 56);
    layout.buttons.forEach((button) => {
      assert.ok(button.bounds.w >= 44);
      assert.ok(button.bounds.h >= 44);
      assert.ok(button.bounds.x >= layout.actionArea.x);
      assert.ok(button.bounds.x + button.bounds.w <= rail.x + rail.w);
    });
  }
});

test('shared portrait action rail accepts exactly four visible actions', () => {
  const canonicalActions = [
    { id: 'menu' },
    { id: 'undo' },
    { id: 'redo' },
    { id: 'primary' }
  ];

  assert.equal(assertSharedPortraitRailActionCount(canonicalActions, { editor: 'test' }).length, SHARED_PORTRAIT_RAIL_ACTION_COUNT);
  assert.throws(
    () => assertSharedPortraitRailActionCount(canonicalActions.slice(0, 3), { editor: 'test' }),
    /exactly 4 actions/
  );
  assert.throws(
    () => assertSharedPortraitRailActionCount([...canonicalActions, { id: 'loop' }], { editor: 'test' }),
    /exactly 4 actions/
  );
});

test('shared transport popover anchors above the bottom play button', () => {
  const layout = getSharedTransportPopoverLayout(
    { x: 312, y: 748, w: 64, h: 56 },
    { x: 0, y: 0, w: 390, h: 844 },
    [
      { id: 'start', label: '⏮', col: 0, row: 0 },
      { id: 'back', label: '⏪', col: 0, row: 1 },
      { id: 'forward', label: '⏩', col: 0, row: 2 },
      { id: 'end', label: '⏭', col: 0, row: 3 },
      { id: 'play', label: '▶', col: 1, row: 1 },
      { id: 'loop', label: '∞', col: 1, row: 2 }
    ],
    { columns: 2, columnWidth: 54, rowHeight: 42 }
  );

  assert.ok(layout.panel.y + layout.panel.h <= 748);
  assert.ok(layout.panel.x >= 0);
  assert.ok(layout.panel.x + layout.panel.w <= 390);
  assert.deepEqual(layout.buttons.map((button) => button.id), ['start', 'back', 'forward', 'end', 'play', 'loop']);
  assert.equal(layout.buttons.find((button) => button.id === 'play').bounds.x > layout.buttons[0].bounds.x, true);
});

test('audio editor portrait rails keep loop in menus instead of the rail', () => {
  const midiModel = buildMidiPortraitMenuModel();
  const sfxModel = buildSfxPortraitMenuModel();

  assert.deepEqual(midiModel.rootTabs.map((tab) => tab.id), ['file', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings']);
  assert.deepEqual(sfxModel.rootTabs.map((tab) => tab.id), ['file', 'generate', 'timeline', 'layers', 'envelopes', 'tools', 'settings']);
  assert.deepEqual(midiModel.bottomRailActions, ['fileButton', 'undoButton', 'redoButton', 'play']);
  assert.deepEqual(sfxModel.bottomRailActions, ['menu', 'undo', 'redo', 'play']);
  assertSharedPortraitRailActionCount(midiModel.bottomRailActions.map((id) => ({ id })), { editor: 'midi' });
  assertSharedPortraitRailActionCount(sfxModel.bottomRailActions.map((id) => ({ id })), { editor: 'sfx' });
  assert.equal(midiModel.bottomRailActions.some((id) => id.toLowerCase().includes('loop')), false);
  assert.equal(sfxModel.bottomRailActions.some((id) => id.toLowerCase().includes('loop')), false);
  assert.ok(midiModel.menuLoopIds.length > 0);
  assert.ok(sfxModel.menuLoopIds.length > 0);
});

test('audio editor shared roots expose desktop and landscape menu ids', () => {
  const midi = buildMidiSharedRootMenuEntries({ includeUndoRedo: true });
  const sfx = buildSfxSharedRootMenuEntries();

  assert.deepEqual(midi.map((tab) => tab.id), ['file', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings', 'undo', 'redo']);
  assert.equal(midi.find((tab) => tab.id === 'instruments')?.specId, 'tracks');
  assert.equal(midi.find((tab) => tab.id === 'virtual-instruments')?.specId, 'record');
  assert.deepEqual(sfx.map((tab) => tab.id), ['file', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings', 'undo', 'redo']);
});

test('SFX gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const drawIndex = sfxEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBody = sfxEditorSource.slice(sfxEditorSource.indexOf('const gamepadSubmenuOnLeft', drawIndex), sfxEditorSource.indexOf('    if (bottom.h > 0)', drawIndex));

  assert.equal(sfxEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(sfxEditorSource.includes('this.isGamepadMenuMode = gamepadConnected && isMobileLandscape;'), true);
  assert.equal(sfxEditorSource.includes('shouldDrawGamepadSubmenuOnLeft()'), true);
  assert.equal(sfxEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, left);'), true);
  assert.equal(drawBody.includes('const gamepadSubmenuOnLeft = this.shouldDrawGamepadSubmenuOnLeft();'), true);
  assert.equal(drawBody.includes('reserveRightRail: !gamepadSubmenuOnLeft'), true);
  assert.equal(drawBody.includes('if (gamepadSubmenuOnLeft) {'), true);
  assert.equal(drawBody.includes('if (right.w > 0) {'), true);
  assert.equal(sfxEditorSource.includes('drawGamepadRightOptionsPanel(ctx, bounds)'), true);
  assert.equal(sfxEditorSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('SFX desktop keeps transport in the left column instead of a bottom rail', () => {
  const desktopIndex = sfxEditorSource.indexOf('if (!isMobileViewport) {');
  const desktopBlock = sfxEditorSource.slice(desktopIndex, sfxEditorSource.indexOf('const landscapeLayout = isMobileLandscape', desktopIndex));

  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('this.drawBottomRail(ctx, shell.bottomBar)'), false);
  assert.equal(desktopBlock.includes('this.drawRightPanel(ctx, shell.leftOptions, { includeDesktopTransport: true });'), true);
  assert.equal(sfxEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
});

test('SFX file menu uses the shared editor file menu model', () => {
  const fileItemsIndex = sfxEditorSource.indexOf('  getSfxFileMenuItems()');
  const fileItemsBody = sfxEditorSource.slice(fileItemsIndex, sfxEditorSource.indexOf('  drawFilePanel(ctx, bounds, y)', fileItemsIndex));
  const filePanelIndex = sfxEditorSource.indexOf('  drawFilePanel(ctx, bounds, y)');
  const filePanelBody = sfxEditorSource.slice(filePanelIndex, sfxEditorSource.indexOf('  drawTimelineMenuPanel', filePanelIndex));
  const controllerIndex = sfxEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = sfxEditorSource.slice(controllerIndex, sfxEditorSource.indexOf('      system:', controllerIndex));

  assert.equal(sfxEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(fileItemsBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileItemsBody.includes('undo: () => this.undo()'), true);
  assert.equal(fileItemsBody.includes('redo: () => this.redo()'), true);
  assert.equal(fileItemsBody.includes('onClose: () => {'), true);
  assert.equal(fileItemsBody.includes("this.leftTab = 'timeline';"), true);
  assert.equal(fileItemsBody.includes('onExit: () => this.exit()'), true);
  assert.equal(controllerBody.includes('items: this.getSfxFileMenuItems().map((item) => ('), true);
  assert.equal(filePanelBody.includes('const rows = this.getSfxFileMenuItems();'), true);
  assert.equal(filePanelBody.includes('if (divider)'), true);
  assert.equal(filePanelBody.includes('action || onClick'), true);
});

test('MIDI gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  assert.equal(midiEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(midiEditorSource.includes('isGamepadLandscapeMenuMode(width'), true);
  assert.equal(midiEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(midiEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, { x: sidebarX, y: sidebarY, w: sidebarW, h: sidebarH });'), true);
  assert.equal(midiEditorSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('MIDI landscape touch reserves right drawer for utility submenus', () => {
  assert.equal(midiEditorSource.includes('showLandscapeRightDrawer'), true);
  assert.equal(midiEditorSource.includes('reserveRightRail: showLandscapeRightDrawer'), true);
  assert.equal(midiEditorSource.includes('this.drawMidiLandscapeRightDrawer(ctx, landscapeLayout.rightRail);'), true);
  assert.equal(midiEditorSource.includes("return ['file', 'settings', 'virtual-instruments'].includes(tabId);"), true);
});

test('MIDI desktop keeps transport in the left column instead of a bottom rail', () => {
  const desktopIndex = midiEditorSource.indexOf('  drawDesktopLayout(ctx, width, height, track, pattern)');
  const desktopBlock = midiEditorSource.slice(desktopIndex, midiEditorSource.indexOf('  getDesktopControllerMenuId', desktopIndex));

  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('this.drawTransportBar(ctx, shellLayout.bottomBar'), false);
  assert.equal(desktopBlock.includes("this.drawDesktopLeftOptions(ctx, shellLayout.leftOptions, { includeDesktopTransport: this.activeTab !== 'instruments' });"), true);
  assert.equal(midiEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
});

test('MIDI file menu uses one shared drawer item source across surfaces', () => {
  const fileItemsIndex = midiEditorSource.indexOf('  getFileMenuItems()');
  const fileItemsBody = midiEditorSource.slice(fileItemsIndex, midiEditorSource.indexOf('  drawFilePanel(ctx, x, y, w, h)', fileItemsIndex));
  const controllerIndex = midiEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = midiEditorSource.slice(controllerIndex, midiEditorSource.indexOf('      system:', controllerIndex));
  const filePanelIndex = midiEditorSource.indexOf('  drawFilePanel(ctx, x, y, w, h)');
  const filePanelBody = midiEditorSource.slice(filePanelIndex, midiEditorSource.indexOf('  drawGenreMenu(ctx, width, height)', filePanelIndex));

  assert.equal(midiEditorSource.includes('buildUnifiedFileDrawerItems'), true);
  assert.equal(fileItemsBody.includes('return buildUnifiedFileDrawerItems({'), true);
  assert.equal(fileItemsBody.includes("{ id: 'nav-grid', label: 'Grid' }"), true);
  assert.equal(fileItemsBody.includes("{ id: 'rescue-save', label: 'Rescue Save' }"), true);
  assert.equal(fileItemsBody.includes("{ id: 'exit-main', label: 'Exit to Main Menu' }"), true);
  assert.equal(controllerBody.includes('items: this.getFileMenuItems().map((item) => ('), true);
  assert.equal(controllerBody.includes("action(item.id, item.label, () => this.handleFileMenu(item.id))"), true);
  assert.equal(filePanelBody.includes('const allFileItems = this.getFileMenuItems();'), true);
});

test('Pixel gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  assert.equal(pixelStudioSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(pixelStudioSource.includes('isGamepadLandscapeMenuMode(width'), true);
  assert.equal(pixelStudioSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(pixelStudioSource.includes('this.drawGamepadSlideOutPanel(ctx, rail);'), true);
  assert.equal(pixelStudioSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('Pixel desktop keeps layer and frame actions in the side rail, not the status bar', () => {
  const rightRailIndex = pixelStudioSource.indexOf('  drawRightRail(ctx, x, y, w, h)');
  const rightRailBody = pixelStudioSource.slice(rightRailIndex, pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})', rightRailIndex));
  const statusIndex = pixelStudioSource.indexOf('  drawStatusBar(ctx, x, y, w, h, options = {})');
  const statusBody = pixelStudioSource.slice(statusIndex, pixelStudioSource.indexOf('  drawSelectionContextMenu(ctx, width, height)', statusIndex));

  assert.equal(rightRailBody.includes('{ isMobile: false, controls: false }'), false);
  assert.equal(rightRailBody.includes('this.drawFramesPanel(ctx, x + 4, y + 4, w - 8, h - 8, { isMobile: false });'), true);
  assert.equal(rightRailBody.includes('this.drawLayersPanel(ctx, x + 4, y + 4, w - 8, h - 8, { isMobile: false });'), true);
  assert.equal(statusBody.includes('getBottomRailActions()'), false);
  assert.equal(statusBody.includes("['layers', 'animation'].includes(this.leftPanelTab)"), false);
});

test('Actor portrait menu matches compact shared rail contract', () => {
  const model = buildActorPortraitMenuModel();

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'actor', 'states', 'tools']);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'playtest']);
  assert.equal(model.primaryActionLabel, 'Play Scene');
  assertSharedPortraitRailActionCount(model.bottomRailActions.map((id) => ({ id })), { editor: 'actor' });
  assert.equal(model.rootTabs.some((tab) => tab.id === 'undo' || tab.id === 'redo'), false);
  assert.equal(model.rootTabs.some((tab) => tab.id === 'linked-parts'), false);
});

test('Actor desktop top menu renders an active root dropdown drawer', () => {
  assert.equal(actorEditorSource.includes('renderDesktopDropdown(shellLayout)'), true);
  assert.equal(actorEditorSource.includes('const dropdown = this.renderDesktopDropdown(shellLayout);'), true);
  assert.equal(actorEditorSource.includes("top: `${dropdownPlan.bounds.y}px`"), true);
  assert.equal(actorEditorSource.includes('getActorDesktopDropdownActions(rootId)'), true);
});

test('Actor file menu uses the shared editor file menu model', () => {
  const fileMenuIndex = actorEditorSource.indexOf('  getActorFileMenuItems()');
  const fileMenuBody = actorEditorSource.slice(fileMenuIndex, actorEditorSource.indexOf('  renderDesktopOptionsPanel()', fileMenuIndex));
  const controllerIndex = actorEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = actorEditorSource.slice(controllerIndex, actorEditorSource.indexOf('      system:', controllerIndex));

  assert.equal(actorEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(fileMenuBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileMenuBody.includes('export: false'), true);
  assert.equal(fileMenuBody.includes('onClose: () => this.closeFileMenu()'), true);
  assert.equal(fileMenuBody.includes('onExit: () => this.exitToMenu()'), true);
  assert.equal(actorEditorSource.includes('file: this.getActorFileMenuItems(),'), true);
  assert.equal(actorEditorSource.includes('const fileItems = this.getActorFileMenuItems();'), true);
  assert.equal(controllerBody.includes('items: this.getActorFileMenuItems().map((item) => ('), true);
});

test('Actor gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  assert.equal(actorEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(actorEditorSource.includes('isGamepadLandscapeMenuMode(viewportW, viewportH)'), true);
  assert.equal(actorEditorSource.includes('shouldDrawGamepadSlideOut'), true);
  assert.equal(actorEditorSource.includes('left.appendChild(this.renderGamepadSlideOutRail(gamepadSlideOutMenuId));'), true);
  assert.equal(actorEditorSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('Actor landscape touch uses shared left root rail and right submenu rail layout', () => {
  const renderIndex = actorEditorSource.indexOf('  render()');
  const renderBody = actorEditorSource.slice(renderIndex, actorEditorSource.indexOf('  getActiveActorDesktopRoot()', renderIndex));

  assert.equal(actorEditorSource.includes('getSharedMobileLandscapeEditorLayout'), true);
  assert.equal(renderBody.includes('const landscapeLayout = isMobileLandscape && !shouldDrawGamepadSlideOut'), true);
  assert.equal(renderBody.includes('leftRailWidth: getSharedMobileRailWidth(viewportW, viewportH)'), true);
  assert.equal(renderBody.includes('rightRailWidth: getSharedMobileRailWidth(viewportW, viewportH)'), true);
  assert.equal(renderBody.includes('body.append(left, center, rightRail);'), true);
  assert.equal(renderBody.includes('left.appendChild(this.renderSidebarMenu());'), true);
  assert.equal(renderBody.includes('if (landscapeLayout) left.style.height = `${landscapeLayout.leftRail.h}px`;'), true);
  assert.equal(renderBody.includes('const rightRailWidth = landscapeLayout ? landscapeLayout.rightRail.w : railWidth;'), true);
  assert.equal(renderBody.includes('if (landscapeLayout) rightRail.style.height = `${landscapeLayout.rightRail.h}px`;'), true);
});

test('Cutscene gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const drawIndex = cutsceneEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBody = cutsceneEditorSource.slice(drawIndex, cutsceneEditorSource.indexOf('  computeLayout(width, height)', drawIndex));
  const landscapeIndex = cutsceneEditorSource.indexOf('const landscape = getSharedMobileLandscapeEditorLayout(width, height');
  const landscapeBody = cutsceneEditorSource.slice(landscapeIndex, cutsceneEditorSource.indexOf('    const work = landscape.workSurface;', landscapeIndex));

  assert.equal(cutsceneEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(cutsceneEditorSource.includes('ControllerMenuStack'), true);
  assert.equal(cutsceneEditorSource.includes('isGamepadLandscapeMenuMode(width'), true);
  assert.equal(cutsceneEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(safeW, safeH)'), true);
  assert.equal(drawBody.includes('if (layout.isLandscapeTouch && !drawGamepadLeft) this.drawLandscapeRootRail(ctx, layout.leftMenuBounds);'), true);
  assert.equal(drawBody.includes('this.drawGamepadSlideOutPanel(ctx, layout.leftMenuBounds);'), true);
  assert.equal(landscapeBody.includes('reserveRightRail: !this.shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(cutsceneEditorSource.includes("return Boolean(activeId && ['system', 'help', 'exit-confirm'].includes(activeId));"), true);
});

test('Cutscene landscape touch uses left root rail and right submenu drawer', () => {
  assert.equal(cutsceneEditorSource.includes('getSharedMobileLandscapeEditorLayout(width, height'), true);
  assert.equal(cutsceneEditorSource.includes('isLandscapeTouch: true'), true);
  assert.equal(cutsceneEditorSource.includes('leftMenuBounds: landscape.leftRail'), true);
  assert.equal(cutsceneEditorSource.includes('menuBounds: landscape.rightRail'), true);
  assert.equal(cutsceneEditorSource.includes('this.drawLandscapeRootRail(ctx, layout.leftMenuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes('this.drawLandscapeSubmenuPanel(ctx, layout.menuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes("target: 'landscape-root'"), true);
});

test('Cutscene desktop keeps transport in the left column instead of a bottom rail', () => {
  const drawIndex = cutsceneEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBlock = cutsceneEditorSource.slice(drawIndex, cutsceneEditorSource.indexOf('  computeLayout(width, height)', drawIndex));
  const desktopIndex = cutsceneEditorSource.indexOf('if (isDesktop) {');
  const desktopBlock = cutsceneEditorSource.slice(desktopIndex, cutsceneEditorSource.indexOf('const landscape = getSharedMobileLandscapeEditorLayout', desktopIndex));

  assert.equal(drawBlock.includes('if (!layout.isDesktop) this.drawActionRail(ctx, railBounds, layout.isPortrait);'), true);
  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('railBounds: null'), true);
  assert.equal(cutsceneEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
});

test('Cutscene desktop dropdown uses the selected top root menu', () => {
  const dropdownIndex = cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)');
  const dropdownBody = cutsceneEditorSource.slice(dropdownIndex, cutsceneEditorSource.indexOf('  getTransportActions()', dropdownIndex));

  assert.equal(dropdownBody.includes('this.getMenuItems(shell.dropdown.rootId)'), true);
  assert.equal(dropdownBody.includes('this.getMenuItems().filter'), false);
});

test('Cutscene file menu uses the shared editor file menu model', () => {
  const fileMenuIndex = cutsceneEditorSource.indexOf("if (tabId === 'file') {");
  const fileMenuBody = cutsceneEditorSource.slice(fileMenuIndex, cutsceneEditorSource.indexOf("    if (tabId === 'add')", fileMenuIndex));

  assert.equal(cutsceneEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(fileMenuBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileMenuBody.includes("export: 'Export MP4'"), true);
  assert.equal(fileMenuBody.includes("item.id === 'export'"), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'export' || id === 'export-mp4') await this.exportMovieMp4();"), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'back' || id === 'exit-main') this.game.exitCutsceneEditor?.();"), true);
  assert.equal(cutsceneEditorSource.includes("this.getMenuItems().filter((item) => !item.divider && !item.separator)"), true);
});

test('Actor editor bottom play action launches the full actor scene playtest', () => {
  const calls = [];
  const game = {
    registerRuntimeActorDefinition(actor) { calls.push(['register', actor.id, actor.name]); },
    startActorEditorPlaytest(id, actor) { calls.push(['start-scene', id, actor.name]); }
  };
  const editor = new ActorEditor(game);
  editor.actor = {
    name: 'Scene Runner',
    states: [{ id: 'idle', name: 'Idle', animation: { frames: [] } }],
    initialStateId: 'idle'
  };

  editor.playActorScene();

  assert.deepEqual(calls, [
    ['register', 'scene-runner', 'Scene Runner'],
    ['start-scene', 'scene-runner', 'Scene Runner']
  ]);
});

test('Actor portrait thumbstick and state selection support mobile scrolling workflow', () => {
  assert.equal(actorEditorSource.includes('getActorEditorThumbstickScrollTarget()'), true);
  assert.equal(actorEditorSource.includes("'.actor-editor-collision-scroll'"), true);
  assert.equal(actorEditorSource.includes("'.actor-editor-state-graph-card'"), true);
  assert.equal(actorEditorSource.includes("'.actor-editor-portrait-top .actor-editor-state-list'"), true);
  assert.equal(actorEditorSource.includes("'.actor-editor-state-list'"), true);
  assert.ok(actorEditorSource.indexOf("'.actor-editor-portrait-top .actor-editor-state-list'") < actorEditorSource.indexOf("'.actor-editor-center'"));
  assert.equal(actorEditorSource.includes("scrollTarget.scrollTop += dy * 0.8"), true);
  assert.equal(actorEditorSource.includes('selectActorState(stateId, { closePortraitMenu = false } = {})'), true);
  assert.equal(actorEditorSource.includes('this.actorPortraitMenuOpen = false;'), true);
  assert.equal(actorEditorSource.includes('this.controllerMenu.closeToSurface();'), true);
  assert.equal(actorEditorSource.includes("btn.onclick = () => this.selectActorState(state.id, { closePortraitMenu: true });"), true);
  assert.equal(actorEditorSource.includes("el('div', 'actor-editor-state-list actor-editor-rail-state-list')"), true);
  assert.equal(actorEditorSource.includes("row.style.touchAction = 'pan-y';"), true);
  assert.equal(actorEditorSource.includes('row.dataset.ignoreClick'), true);
  assert.equal(stylesSource.includes('.actor-editor-state-list'), true);
  assert.equal(stylesSource.includes('.actor-editor-portrait-top .actor-editor-rail-state-list'), true);
  assert.equal(stylesSource.includes('-webkit-overflow-scrolling: touch;'), true);
  assert.equal(stylesSource.includes('overscroll-behavior: contain;'), true);
  assert.equal(stylesSource.includes('touch-action: pan-y;'), true);
});

test('Actor portrait removes variant preview rail and keeps graph/collision controls reachable', () => {
  assert.equal(actorEditorSource.includes('Variant preview'), false);
  assert.equal(actorEditorSource.includes('this.stateGraphOpen = true;'), true);
  assert.equal(actorEditorSource.includes('this.actorPortraitMenuOpen = false;'), true);
  assert.equal(actorEditorSource.includes("card.classList.add('actor-editor-state-graph-card')"), true);
  assert.equal(actorEditorSource.includes("card.classList.add('actor-editor-collision-card')"), true);
  assert.equal(actorEditorSource.includes("viewportWrap.className = 'actor-editor-collision-scroll'"), true);
  assert.equal(actorEditorSource.includes('actor-editor-collision-actions'), true);
  assert.equal(actorEditorSource.includes("maxHeight: 'calc(100dvh - 24px)'"), true);
  assert.equal(actorEditorSource.includes("if (this.activeMenuSection === 'actor') return null;"), true);
  assert.equal(actorEditorSource.includes('const rightRailContent = this.renderRightRail();'), true);
  assert.equal(actorEditorSource.includes('if (rightRailContent) topMenus.appendChild(rightRail);'), true);
  assert.equal(actorEditorSource.includes("this.actorPortraitMenuOpen = !(isPortraitMobile && id === 'actor');"), true);
});
