import test from 'node:test';
import assert from 'node:assert/strict';

import ActorEditor, { buildActorPortraitEditorLayout, buildActorPortraitMenuModel } from '../../src/ui/ActorEditor.js';
import { buildCutscenePortraitEditorLayout, buildCutscenePortraitMenuModel } from '../../src/ui/CutsceneEditor.js';
import { buildLevelMobileLandscapeRootTabs, buildLevelPortraitMenuModel, shouldShowLevelEditorTopPlaytestButton } from '../../src/ui/LevelEditorCore.js';
import { buildMidiPortraitMenuModel, buildMidiSharedRootMenuEntries, getMidiPortraitControlLayout, getMidiPortraitFullScreenSheetLayout } from '../../src/ui/MidiComposerCore.js';
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
import { buildSfxPortraitEditorLayout, buildSfxPortraitMenuModel, buildSfxSharedRootMenuEntries } from '../../src/ui/SfxEditor.js';
import {
  buildLandscapeTouchEditorShellPlan,
  COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT,
  COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH,
  getEditorModeAcceptanceContract
} from '../../src/ui/shared/editorMenuLayout.js';
import { EDITOR_LAYOUT_MODES, PORTRAIT_ROOT_MAX_ITEMS, SHARED_EDITOR_IDS, STANDARD_EDITOR_ACTION_RAIL_PREFIX, getEditorPortraitRootMenuEntries, getStandardEditorActionRailIds } from '../../src/ui/shared/editorMenuSpec.js';
import { buildCarPortraitMenuModel, buildRacePortraitMenuModel } from '../../src/ui/RaceEditor.js';
import { mergeBuiltInActorOverride } from '../../src/content/builtinActorOverrides.js';
import { BUILT_IN_ACTOR_VISUAL_SCALE, getBuiltInActorOverrideDrawSize } from '../../src/entities/BuiltInActorVisuals.js';
import {
  assertSharedPortraitRailActionCount,
  getSharedMobilePortraitEditorLayout,
  getSharedPortraitRailActionButtons,
  getSharedPortraitMultiRowTabLayout,
  getSharedTransportPopoverLayout,
  SHARED_PORTRAIT_RAIL_ACTION_COUNT,
  SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES,
  drawSharedDesktopContextPanel,
  drawSharedDesktopRibbon,
  drawSharedDesktopTopMenu,
  drawSharedPortraitSheet,
  UI_SUITE
} from '../../src/ui/uiSuite.js';
import { readFileSync } from 'node:fs';

const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');
const actorEditorSource = readFileSync(new URL('../../src/ui/ActorEditor.js', import.meta.url), 'utf8');
const sfxEditorSource = readFileSync(new URL('../../src/ui/SfxEditor.js', import.meta.url), 'utf8');
const midiEditorSource = readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const cutsceneEditorSource = readFileSync(new URL('../../src/ui/CutsceneEditor.js', import.meta.url), 'utf8');
const raceEditorSource = readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8');
const projectBrowserSource = readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');
const levelEditorSource = readFileSync(new URL('../../src/ui/LevelEditorCore.js', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../../src/entities/Player.js', import.meta.url), 'utf8');
const companionSource = readFileSync(new URL('../../src/entities/FriendlyCompanion.js', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const uiSuiteSource = readFileSync(new URL('../../src/ui/uiSuite.js', import.meta.url), 'utf8');
const editorMenuLayoutSource = readFileSync(new URL('../../src/ui/shared/editorMenuLayout.js', import.meta.url), 'utf8');
const editorMenuSpecSource = readFileSync(new URL('../../src/ui/shared/editorMenuSpec.js', import.meta.url), 'utf8');
const editorSourceById = {
  pixel: pixelStudioSource,
  level: levelEditorSource,
  actor: actorEditorSource,
  midi: midiEditorSource,
  sfx: sfxEditorSource,
  cutscene: cutsceneEditorSource,
  race: raceEditorSource,
  car: raceEditorSource,
  tile: pixelStudioSource
};

test('editor viewport mode resolution is centralized per editor shell', () => {
  const helpers = {
    pixel: 'resolvePixelViewportMode',
    level: 'resolveLevelViewportMode',
    actor: 'resolveActorViewportMode',
    midi: 'resolveMidiViewportMode',
    sfx: 'resolveSfxViewportMode',
    cutscene: 'resolveCutsceneViewportMode',
    race: 'resolveRaceViewportMode'
  };

  Object.entries(helpers).forEach(([editorId, helperName]) => {
    const source = editorSourceById[editorId];
    const helperIndex = source.indexOf(`  ${helperName}(`);
    assert.ok(helperIndex >= 0, `${editorId} should expose ${helperName}`);
    const directResolverCalls = source.match(/resolveEditorViewportModeFlags\(\{/g) || [];
    const expectedResolverCalls = ['pixel', 'level'].includes(editorId) ? 2 : 1;
    assert.equal(directResolverCalls.length, expectedResolverCalls, `${editorId} should keep resolveEditorViewportModeFlags calls centralized`);
    if (editorId === 'pixel') {
      const layoutHelperIndex = source.indexOf('export function buildPixelMobileEditorLayout');
      assert.ok(layoutHelperIndex >= 0);
      assert.equal(source.indexOf('resolveEditorViewportModeFlags({'), source.indexOf('resolveEditorViewportModeFlags({', layoutHelperIndex), 'pixel standalone mobile layout helper should use the shared viewport resolver');
      assert.ok(source.indexOf('resolveEditorViewportModeFlags({', helperIndex) > helperIndex, 'pixel class resolver should keep its shared viewport resolver call');
    } else if (editorId === 'level') {
      const topPlaytestHelperIndex = source.indexOf('export function shouldShowLevelEditorTopPlaytestButton');
      assert.ok(topPlaytestHelperIndex >= 0);
      assert.equal(source.indexOf('resolveEditorViewportModeFlags({'), source.indexOf('resolveEditorViewportModeFlags({', topPlaytestHelperIndex), 'level standalone top-playtest helper should use the shared viewport resolver');
      assert.ok(source.indexOf('resolveEditorViewportModeFlags({', helperIndex) > helperIndex, 'level class resolver should keep its shared viewport resolver call');
    } else {
      assert.equal(source.indexOf('resolveEditorViewportModeFlags({'), source.indexOf('resolveEditorViewportModeFlags({', helperIndex), `${editorId} direct resolver call should live in ${helperName}`);
    }
  });
});

test('editor mobile mode detection accepts shared deviceIsMobile flag across editors', () => {
  ['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene'].forEach((editorId) => {
    const source = editorSourceById[editorId];
    const helperIndex = source.indexOf('  isMobileLayout() {');
    assert.ok(helperIndex >= 0, `${editorId} should expose isMobileLayout()`);
    const helperBody = source.slice(helperIndex, source.indexOf('\n  }', helperIndex) + 5);
    assert.equal(
      helperBody.includes('this.game?.deviceIsMobile || this.game?.isMobile'),
      true,
      `${editorId} should resolve mobile mode from deviceIsMobile or isMobile`
    );
    assert.equal(
      helperBody.includes('return Boolean(this.game?.isMobile);')
        || helperBody.includes('return Boolean(this.game.isMobile);'),
      false,
      `${editorId} should not depend only on game.isMobile`
    );
  });
  assert.equal(
    raceEditorSource.includes('isMobile: Boolean(this.game?.deviceIsMobile || this.game?.isMobile),'),
    true,
    'race/car should keep the same mobile detection input'
  );
});

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

test('portrait root menus stay bottom-sized across all editors', () => {
  const models = {
    pixel: buildPixelPortraitMenuModel(),
    level: buildLevelPortraitMenuModel(),
    actor: buildActorPortraitMenuModel(),
    midi: buildMidiPortraitMenuModel(),
    sfx: buildSfxPortraitMenuModel(),
    cutscene: buildCutscenePortraitMenuModel(),
    race: buildRacePortraitMenuModel(),
    car: buildCarPortraitMenuModel(),
    tile: {
      rootTabs: getEditorPortraitRootMenuEntries('tile'),
      portraitRootPlacement: 'bottom-rail'
    }
  };

  Object.entries(models).forEach(([editor, model]) => {
    assert.ok(model.rootTabs.length <= PORTRAIT_ROOT_MAX_ITEMS, `${editor} portrait root menu should have no more than ${PORTRAIT_ROOT_MAX_ITEMS} bottom items`);
    assert.equal(model.portraitRootPlacement, 'bottom-rail', `${editor} portrait roots should be bottom-first`);
  });
});

test('portrait submenu sheets expose shared bottom command metadata', () => {
  assert.deepEqual(drawSharedPortraitSheet(null, { x: 0, y: 520, w: 390, h: 260 }), {
    surface: 'bottom-sheet',
    role: 'portrait-command-sheet',
    commandSurface: 'bottom-sheet',
    pointerType: 'touch',
    rowActivation: 'tap-release',
    gestureScroll: true
  });
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('drawSharedPortraitSheet'), true);
  });
});

test('portrait editor action rails share the standard Menu Undo Redo prefix', () => {
  const models = {
    pixel: buildPixelPortraitMenuModel(),
    level: buildLevelPortraitMenuModel(),
    actor: buildActorPortraitMenuModel(),
    midi: buildMidiPortraitMenuModel(),
    sfx: buildSfxPortraitMenuModel(),
    cutscene: buildCutscenePortraitMenuModel(),
    race: buildRacePortraitMenuModel(),
    car: buildCarPortraitMenuModel()
  };
  const expectedContextActions = {
    pixel: 'brush',
    level: 'playtest',
    actor: 'playtest',
    midi: 'play',
    sfx: 'play',
    cutscene: 'play',
    race: 'race-context',
    car: 'test-drive'
  };

  Object.entries(models).forEach(([editorId, model]) => {
    assert.deepEqual(model.bottomRailActions.slice(0, 3), STANDARD_EDITOR_ACTION_RAIL_PREFIX, editorId);
    assert.deepEqual(model.bottomRailActions, getStandardEditorActionRailIds(expectedContextActions[editorId]), editorId);
    assertSharedPortraitRailActionCount(model.bottomRailActions.map((id) => ({ id })), { editor: editorId });
  });
  Object.values(editorSourceById).forEach((source) => {
    assert.equal(source.includes("bottomRailActions: ['menu', 'undo', 'redo'"), false);
  });
});

test('MIDI portrait preserves bottom-first rail and virtual thumbstick policy', () => {
  const model = buildMidiPortraitMenuModel();
  const acceptance = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.PORTRAIT);

  assert.equal(model.portraitRootPlacement, 'bottom-rail');
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'play']);
  assert.deepEqual(model.bottomRailActions.slice(0, STANDARD_EDITOR_ACTION_RAIL_PREFIX.length), STANDARD_EDITOR_ACTION_RAIL_PREFIX);
  assert.equal(model.rootTabs.length <= PORTRAIT_ROOT_MAX_ITEMS, true);
  assert.equal(acceptance.rootCommandSurface, 'bottom-rail');
  assert.equal(acceptance.commandSurface, 'bottom-sheet');
  assert.equal(acceptance.thumbstickPolicy, 'required');
});

test('portrait repair targets preserve shared rail behavior across affected editors', () => {
  const models = {
    midi: buildMidiPortraitMenuModel(),
    pixel: buildPixelPortraitMenuModel(),
    level: buildLevelPortraitMenuModel(),
    cutscene: buildCutscenePortraitMenuModel(),
    actor: buildActorPortraitMenuModel(),
    race: buildRacePortraitMenuModel(),
    car: buildCarPortraitMenuModel(),
    sfx: buildSfxPortraitMenuModel()
  };
  const expectedContextActions = {
    midi: 'play',
    pixel: 'brush',
    level: 'playtest',
    cutscene: 'play',
    actor: 'playtest',
    race: 'race-context',
    car: 'test-drive',
    sfx: 'play'
  };
  const acceptance = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.PORTRAIT);

  Object.entries(models).forEach(([editorId, model]) => {
    assert.equal(model.portraitRootPlacement, 'bottom-rail', editorId);
    assert.ok(model.rootTabs.length <= PORTRAIT_ROOT_MAX_ITEMS, editorId);
    assert.deepEqual(
      model.bottomRailActions,
      getStandardEditorActionRailIds(expectedContextActions[editorId]),
      editorId
    );
    assert.equal(acceptance.commandSurface, 'bottom-sheet', editorId);
    assert.equal(acceptance.rowActivation, 'tap-release', editorId);
  });
});

test('Race and Car portrait menu models use the shared bottom rail contract', () => {
  const raceModel = buildRacePortraitMenuModel();
  const carModel = buildCarPortraitMenuModel();

  assert.deepEqual(raceModel.rootTabs.map((tab) => tab.id), ['file', 'track', 'ground', 'sprites', 'settings']);
  assert.deepEqual(carModel.rootTabs.map((tab) => tab.id), ['file', 'art', 'drivetrain', 'tuning']);
  assert.deepEqual(raceModel.bottomRailActions, ['menu', 'undo', 'redo', 'race-context']);
  assert.deepEqual(carModel.bottomRailActions, ['menu', 'undo', 'redo', 'test-drive']);
  assertSharedPortraitRailActionCount(raceModel.bottomRailActions.map((id) => ({ id })), { editor: 'race' });
  assertSharedPortraitRailActionCount(carModel.bottomRailActions.map((id) => ({ id })), { editor: 'car' });
  assert.equal(raceEditorSource.includes('buildRacePortraitMenuModel(this.editorId).bottomRailActions'), true);
  assert.equal(raceEditorSource.includes('buildRacePortraitMenuModel(this.editorId).rootTabs'), true);
});

test('portrait editor root rails are bottom anchored across layout systems', () => {
  const sharedLayout = getSharedMobilePortraitEditorLayout(390, 844);
  assert.equal(sharedLayout.rootRail.y, sharedLayout.menuSheet.y + sharedLayout.menuSheet.h - sharedLayout.rootRail.h);
  assert.equal(sharedLayout.subRail.y < sharedLayout.rootRail.y, true);
  assert.equal(sharedLayout.portraitRootPlacement, 'bottom-rail');

  const pixelLayout = buildPixelMobileEditorLayout(390, 844, { isMobile: true, menuSheetOpen: true });
  assert.equal(pixelLayout.rootRail.y, pixelLayout.menuSheet.y + pixelLayout.menuSheet.h - pixelLayout.rootRail.h);
  assert.deepEqual(pixelLayout.rootTabs, pixelLayout.rootRail);
  assert.deepEqual(pixelLayout.subRail, pixelLayout.sheetContent);
  assert.equal(pixelLayout.portraitRootPlacement, 'bottom-rail');
  assert.equal(pixelLayout.subRail.y < pixelLayout.rootRail.y, true);

  const midiLayout = getMidiPortraitControlLayout(390, 844, { rootRailHeight: 144 });
  const midiSheetLayout = getMidiPortraitFullScreenSheetLayout(390, 844);
  assert.equal(midiLayout.rootRail.y, midiLayout.bottomRail.y - midiLayout.gap - midiLayout.rootRail.h);
  assert.deepEqual(midiLayout.rootTabs, midiLayout.rootRail);
  assert.deepEqual(midiLayout.subRail, midiLayout.sheetContent);
  assert.deepEqual(midiLayout.subRail, midiLayout.workSurface);
  assert.equal(midiLayout.portraitRootPlacement, 'bottom-rail');
  assert.equal(midiLayout.rootRail.y < midiLayout.bottomRail.y, true);
  assert.equal(midiLayout.subRail.y < midiLayout.rootRail.y, true);
  assert.deepEqual(midiSheetLayout.rootTabs, midiSheetLayout.rootRail);
  assert.deepEqual(midiSheetLayout.subRail, midiSheetLayout.sheetContent);
  assert.equal(midiSheetLayout.portraitRootPlacement, 'bottom-rail');
  assert.equal(midiSheetLayout.subRail.y < midiSheetLayout.rootRail.y, true);

  const levelLayout = getSharedMobilePortraitEditorLayout(390, 844, {
    middleRailHeight: 88,
    minTopHeight: 230,
    minMainHeight: 220
  });
  assert.equal(levelLayout.rootRail.y, levelLayout.menuSheet.y + levelLayout.menuSheet.h - levelLayout.rootRail.h);
  assert.deepEqual(levelLayout.rootTabs, levelLayout.rootRail);
  assert.deepEqual(levelLayout.subRail, levelLayout.sheetContent);
  assert.equal(levelLayout.portraitRootPlacement, 'bottom-rail');

  const actorLayout = buildActorPortraitEditorLayout(390, 844);
  assert.equal(actorLayout.rootRail.y, actorLayout.menuSheet.y + actorLayout.menuSheet.h - actorLayout.rootRail.h);
  assert.deepEqual(actorLayout.rootTabs, actorLayout.rootRail);
  assert.deepEqual(actorLayout.subRail, actorLayout.sheetContent);
  assert.equal(actorLayout.portraitRootPlacement, 'bottom-rail');
  assert.equal(actorLayout.sheetContent.y < actorLayout.rootRail.y, true);
  assert.equal(actorEditorSource.includes('buildActorPortraitEditorLayout(viewportW - portraitInset * 2, viewportH - portraitInset * 2)'), true);
  assert.equal(actorEditorSource.includes('actor-editor-portrait-bottom-menu-sheet'), true);
  assert.equal(actorEditorSource.includes('left.style.height = `${portraitLayout.rootTabs.h}px`;'), true);
  assert.equal(actorEditorSource.includes('rightRail.style.height = `${portraitLayout.subRail.h}px`;'), true);
  assert.ok(actorEditorSource.indexOf('if (rightRailContent) menuSheet.appendChild(rightRail);') < actorEditorSource.indexOf('menuSheet.appendChild(left);'));
});

test('Cutscene portrait tabs are drawn at the bottom of the sheet', () => {
  const drawIndex = cutsceneEditorSource.indexOf('  drawMenu(ctx, bounds, isPortrait)');
  const drawBlock = cutsceneEditorSource.slice(drawIndex, cutsceneEditorSource.indexOf('  drawLandscapeSubmenuPanel(ctx, bounds)', drawIndex));
  const layout = buildCutscenePortraitEditorLayout(390, 844);
  assert.ok(drawIndex >= 0);
  assert.equal(layout.rootRail.y, layout.menuSheet.y + layout.menuSheet.h - layout.rootRail.h);
  assert.ok(layout.rootRail.h >= 96);
  assert.equal(layout.sheetContent.y < layout.rootRail.y, true);
  assert.equal(drawBlock.includes('const rootRail = isPortrait ? (bounds.rootTabs || bounds.rootRail || bounds) : bounds;'), true);
  assert.equal(drawBlock.includes('const sheetContent = isPortrait ? (bounds.subRail || bounds.sheetContent || bounds) : bounds;'), true);
  assert.equal(drawBlock.includes('drawSharedPortraitMultiRowTabStrip(ctx, rootRail, CUTSCENE_MENU_TABS, {'), true);
  assert.equal(drawBlock.includes("verticalAlign: 'bottom'"), true);
  assert.equal(drawBlock.includes('const tabY = isPortrait ? rootRail.y + Math.max(pad, rootRail.h - pad - tabStripH) : bounds.y + pad;'), false);
  assert.equal(drawBlock.includes('h: Math.max(1, sheetContent.h - pad * 2)'), true);
  assert.equal(drawBlock.includes('h: Math.max(1, tabY - bounds.y - pad - gap)'), false);
});

test('Pixel portrait root tabs do not register pose timeline controls', () => {
  const rootTabsIndex = pixelStudioSource.indexOf('  drawMobilePortraitRootTabs(ctx, bounds)');
  const toolbarIndex = pixelStudioSource.indexOf('  drawMobileToolbar(ctx, x, y, w, h)', rootTabsIndex);
  assert.ok(rootTabsIndex >= 0);
  assert.ok(toolbarIndex > rootTabsIndex);
  const rootTabsBody = pixelStudioSource.slice(rootTabsIndex, toolbarIndex);

  assert.equal(rootTabsBody.includes('bone-timeline-zoom-slider'), false);
  assert.equal(rootTabsBody.includes('layout.sliderBounds'), false);
  assert.equal(pixelStudioSource.includes('drawPortraitToolTabs('), false);
});

test('Level controller drawers expose concrete desktop action rows', () => {
  const buildIndex = levelEditorSource.indexOf('  buildControllerMenus()');
  const nextMethodIndex = levelEditorSource.indexOf('  keepCursorInView()', buildIndex);
  assert.ok(buildIndex >= 0);
  assert.ok(nextMethodIndex > buildIndex);
  const buildBody = levelEditorSource.slice(buildIndex, nextMethodIndex);

  assert.equal(buildBody.includes("items: panelItems('triggers')"), true);
  assert.equal(buildBody.includes("const panelAction ="), false);
  assert.equal(buildBody.includes("panelAction('toolbox', 'Open Toolbox')"), false);
  assert.equal(buildBody.includes("panelAction('graphics', 'Open Graphics')"), false);
  assert.equal(buildBody.includes("panelAction('music', 'Open Music')"), false);
  assert.equal(buildBody.includes("graphics: { id: 'graphics', title: 'Graphics', items: panelItems('graphics') }"), true);
  assert.equal(buildBody.includes("...panelItems('music')"), true);
  assert.equal(buildBody.includes("items: panelItems('level-settings')"), true);
  assert.equal(buildBody.includes("surfaceAction('tile-paint', 'Paint Selected Tile'"), true);
  assert.equal(buildBody.includes("surfaceAction('enemy-mode', 'Actor Mode'"), true);
  assert.equal(buildBody.includes("surfaceAction('powerup-place', 'Place Selected Powerup'"), true);
  assert.equal(buildBody.includes("surfaceAction('prefab-mode', 'Structure Mode'"), true);
  assert.equal(buildBody.includes("'open-midi-composer'"), true);
});

test('generated controller menu rows do not fall back to clickable no-op actions', () => {
  const pixelBuildIndex = pixelStudioSource.indexOf('  buildControllerMenus()');
  const pixelBuildBody = pixelStudioSource.slice(pixelBuildIndex, pixelStudioSource.indexOf('  applyInputActions(', pixelBuildIndex));
  const levelBuildIndex = levelEditorSource.indexOf('  buildControllerMenus()');
  const levelBuildBody = levelEditorSource.slice(levelBuildIndex, levelEditorSource.indexOf('  keepCursorInView()', levelBuildIndex));
  const levelFileMenuIndex = levelEditorSource.indexOf('  getLevelFileMenuItems({ includePlaytest = false, includeFooter = false } = {})');
  const levelFileMenuBody = levelEditorSource.slice(levelFileMenuIndex, levelEditorSource.indexOf('  getLevelEditMenuItems()', levelFileMenuIndex));

  assert.ok(pixelBuildIndex >= 0);
  assert.ok(levelBuildIndex >= 0);
  assert.ok(levelFileMenuIndex >= 0);
  assert.equal(pixelBuildBody.includes('item.onClick || item.action || (() => {})'), false);
  assert.equal(levelBuildBody.includes('item.onClick || item.action || (() => {})'), false);
  assert.equal(levelFileMenuBody.includes('entry.onClick || entry.action || (() => {})'), false);
  assert.equal(pixelBuildBody.includes("disabled: Boolean(item.disabled) || typeof handler !== 'function'"), true);
  assert.equal(levelBuildBody.includes("disabled: Boolean(item.disabled) || typeof handler !== 'function'"), true);
  assert.equal(levelFileMenuBody.includes("disabled: Boolean(entry.disabled) || (!entry.divider && !entry.separator && typeof handler !== 'function')"), true);
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
      balanceLastRow: true,
      verticalAlign: 'bottom'
    });
    const bottomY = Math.max(...layout.buttons.map((button) => button.bounds.y + button.bounds.h));

    assert.equal(open.orientation, 'portrait');
    assert.equal(layout.buttons.length, tabs.length);
    assert.equal(layout.rows, 2);
    assert.equal(layout.fits, true);
    assert.equal(bottomY, open.rootRail.y + open.rootRail.h - 8);
    assert.ok(open.subRail.y + open.subRail.h <= open.rootRail.y);
  }
});

test('Pixel mobile layout helper resolves mode through the shared viewport contract', () => {
  const layoutIndex = pixelStudioSource.indexOf('export function buildPixelMobileEditorLayout');
  const layoutBody = pixelStudioSource.slice(layoutIndex, pixelStudioSource.indexOf('export function buildPixelPortraitCanvasActionGroups', layoutIndex));

  assert.ok(layoutIndex >= 0);
  assert.equal(layoutBody.includes('resolveEditorViewportModeFlags({'), true);
  assert.equal(layoutBody.includes("editorId = 'pixel'"), true);
  assert.equal(layoutBody.includes('gamepadConnected = false'), true);
  assert.equal(layoutBody.includes('isMobileLandscapeLayout({'), false);
  assert.equal(layoutBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(pixelStudioSource.includes('isMobileLandscapeLayout'), false);
  assert.equal(pixelStudioSource.includes('isMobilePortraitLayout'), false);
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
  const leftPanelIndex = pixelStudioSource.indexOf('  drawLeftPanelContent(ctx, x, y, w, h, options = {})');
  const leftPanelBody = pixelStudioSource.slice(leftPanelIndex, pixelStudioSource.indexOf('  drawFilePanel(ctx, x, y, w, h, options = {})', leftPanelIndex));
  const filePanelIndex = pixelStudioSource.indexOf('  drawFilePanel(ctx, x, y, w, h, options = {})');
  const filePanelBody = pixelStudioSource.slice(filePanelIndex, pixelStudioSource.indexOf('  drawButton(ctx, x, y, w, h, label, active = false, options = {})', filePanelIndex));
  const toolOptionsIndex = pixelStudioSource.indexOf('  drawToolOptions(ctx, x, y, options = {})');
  const toolOptionsBody = pixelStudioSource.slice(toolOptionsIndex, pixelStudioSource.indexOf('  drawHueSaturationMobileRail', toolOptionsIndex));
  const toolsPanelIndex = pixelStudioSource.indexOf('  drawToolsPanel(ctx, x, y, w, h, options = {})');
  const toolsPanelBody = pixelStudioSource.slice(toolsPanelIndex, pixelStudioSource.indexOf('  drawSwitchesPanel(ctx, x, y, w, h, options = {})', toolsPanelIndex));
  const switchesPanelIndex = pixelStudioSource.indexOf('  drawSwitchesPanel(ctx, x, y, w, h, options = {})');
  const switchesPanelBody = pixelStudioSource.slice(switchesPanelIndex, pixelStudioSource.indexOf('  drawOptionToggle(ctx, x, y, label, active, onClick, options = {})', switchesPanelIndex));
  const hueRailIndex = pixelStudioSource.indexOf('  drawHueSaturationMobileRail(ctx, x, y, w, h)');
  const hueRailBody = pixelStudioSource.slice(hueRailIndex, pixelStudioSource.indexOf('  setHueShiftFromPointer(type, pointerX, track)', hueRailIndex));
  const layersIndex = pixelStudioSource.indexOf('  drawLayersPanel(ctx, x, y, w, h, options = {})');
  const layersBody = pixelStudioSource.slice(layersIndex, pixelStudioSource.indexOf('  drawCanvasArea', layersIndex));
  const framesIndex = pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})');
  const framesBody = pixelStudioSource.slice(framesIndex);
  const brushPreviewIndex = pixelStudioSource.indexOf('  drawBrushPreviewChip(ctx, bounds)');
  const brushPreviewBody = pixelStudioSource.slice(brushPreviewIndex, pixelStudioSource.indexOf('  updateBrushPickerSliderFromX', brushPreviewIndex));

  assert.equal(leftPanelBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(leftPanelBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(filePanelBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(filePanelBody.includes("const stickyExit = isMobile && this.activeViewportMode !== 'desktop';"), true);
  assert.equal(filePanelBody.includes("this.activeViewportMode === 'landscape'"), false);
  assert.equal(filePanelBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(toolOptionsBody.includes('const bodyH = Math.max(28, y + panelHeight - bodyY - 8);'), true);
  assert.equal(toolOptionsBody.includes('const startY = offsetY;'), true);
  assert.equal(pixelStudioSource.includes('drawPortraitToolOptionButton'), true);
  assert.equal(pixelStudioSource.includes('drawPortraitToolOptionStepper'), true);
  assert.equal(toolOptionsBody.includes('drawPortraitToolOptionButton(ctx, x, offsetY, this.toolOptions.shapeFill'), true);
  assert.equal(toolOptionsBody.includes("drawPortraitToolOptionStepper(ctx, x, offsetY, 'Tolerance'"), true);
  assert.equal(toolOptionsBody.includes("drawPortraitToolOptionStepper(ctx, x, offsetY, 'Strength'"), true);
  assert.equal(toolOptionsBody.includes('const bodyY = y + (isMobile ? 8 : 14);'), true);
  assert.equal(pixelStudioSource.includes('isBrushAdjustableTool'), true);
  assert.equal(pixelStudioSource.includes("brush: { id: 'brush', label: '', primary: true, onClick: () => this.openBrushPicker('size') }"), true);
  assert.equal(pixelStudioSource.includes("this.drawBrushPreviewChip(ctx, {"), true);
  assert.equal(pixelStudioSource.includes("focusLabels[this.brushPickerFocus]"), true);
  assert.equal(pixelStudioSource.includes("Brushes / ${focusLabel}"), true);
  assert.equal(pixelStudioSource.includes('const DEFAULT_BRUSH_SIZE = 7;'), true);
  assert.equal(pixelStudioSource.includes('brushSize: DEFAULT_BRUSH_SIZE'), true);
  assert.equal(pixelStudioSource.includes('brushHardness: 1'), true);
  assert.equal(pixelStudioSource.includes('refreshDefaultBrushProfiles({ onlyStale: true })'), true);
  assert.equal(pixelStudioSource.includes('Brush Settings'), true);
  assert.equal(toolsPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(toolsPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(toolsPanelBody.includes('ctx.font = `16px ${UI_SUITE.font.family}`;'), true);
  assert.equal(toolsPanelBody.includes("ctx.font = '16px Courier New';"), false);
  assert.equal(switchesPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(switchesPanelBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(switchesPanelBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(switchesPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(switchesPanelBody.includes('ctx.font = `16px ${UI_SUITE.font.family}`;'), true);
  assert.equal(switchesPanelBody.includes("ctx.font = '16px Courier New';"), false);
  assert.equal(hueRailBody.includes('drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(hueRailBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(hueRailBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(hueRailBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(hueRailBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(hueRailBody.includes("ctx.font = '11px Courier New';"), false);
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
  assert.equal(pixelStudioSource.includes('buildPixelPortraitMenuModel().bottomRailActions'), true);
  assert.equal(pixelStudioSource.includes('getPixelPortraitPrimaryToolbarAction()'), true);
  assert.equal(layersBody.includes('buildPixelPortraitLayerActionGroups()'), true);
  assert.equal(layersBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(layersBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(layersBody.includes('this.layerListMeta = portrait'), true);
  assert.equal(framesBody.includes('buildPixelPortraitFrameActionGroups()'), true);
  assert.equal(framesBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(framesBody.includes('isMobilePortraitLayout({'), false);
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

test('Pixel file menu uses the shared editor file menu model', () => {
  const fileItemsIndex = pixelStudioSource.indexOf('  getFilePanelItems()');
  const fileItemsBody = pixelStudioSource.slice(fileItemsIndex, pixelStudioSource.indexOf('  ensureBoneNodeSelection()', fileItemsIndex));

  assert.equal(fileItemsBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileItemsBody.includes('undo: false'), false);
  assert.equal(fileItemsBody.includes('redo: false'), false);
  assert.equal(fileItemsBody.includes('includeFooter: false'), true);
  assert.equal(fileItemsBody.includes('extras: ['), true);
  assert.equal(fileItemsBody.includes("{ id: 'copy-image', label: 'Copy'"), false);
  assert.equal(fileItemsBody.includes("{ id: 'paste-image', label: 'Paste'"), false);
  assert.equal(fileItemsBody.includes('filter((item) => !item.disabled)'), true);
});

test('Pixel Edit drawer disables selection-only actions when nothing is selected', () => {
  const controllerIndex = pixelStudioSource.indexOf('  buildControllerMenus()');
  const controllerBody = pixelStudioSource.slice(controllerIndex, pixelStudioSource.indexOf('  resizeArtDocumentPrompt()', controllerIndex));
  const canvasMenuIndex = controllerBody.indexOf("      canvas: {");
  const canvasMenuBody = controllerBody.slice(canvasMenuIndex, controllerBody.indexOf("      view: {", canvasMenuIndex));

  assert.equal(controllerBody.includes('const hasSelection = Boolean(this.selection?.active && this.selection?.mask);'), true);
  assert.equal(controllerBody.includes("action('copy', 'Copy', () => this.copySelection())"), true);
  assert.equal(controllerBody.includes("action('paste', 'Paste', () => this.pasteClipboard())"), true);
  assert.equal(controllerBody.includes("action('cut', 'Cut', () => this.cutSelection(), { disabled: !hasSelection })"), true);
  assert.equal(controllerBody.includes("action('clear', 'Clear Selection', () => this.clearSelection(), { disabled: !hasSelection })"), true);
  assert.equal(canvasMenuBody.includes("action('resize', 'Resize Canvas'"), true);
  assert.equal(canvasMenuBody.includes("action('grid'"), false);
  assert.equal(canvasMenuBody.includes("action('onion'"), false);
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
  const toolbarIndex = pixelStudioSource.indexOf('  drawMobileToolbar(ctx, x, y, w, h)');
  const toolbarBody = pixelStudioSource.slice(toolbarIndex, pixelStudioSource.indexOf('  drawMobilePanZoomControls(ctx, width, height, surfaceBounds = null)', toolbarIndex));

  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    const layout = buildPixelMobileEditorLayout(width, height, {
      isMobile: true,
      drawerOpen: false
    });

    assert.equal(layout.orientation, 'landscape');
    assert.equal(layout.paletteStrip, null);
    assert.equal(layout.zoomStrip, null);
    assert.equal(layout.surfaces.topRail, null);
    assert.equal(layout.toolbarStrip, null);
    assert.equal(layout.compactLandscapeRootRail, true);
    assert.equal(layout.drawerOverlaysWorkSurface, false);
    assert.equal(layout.drawerOpensFromLeftRail, true);
    assert.equal(layout.rootDrawerSurface, 'left-overlay-drawer');
    assert.equal(layout.rootDrawerOverlayOrigin, 'left');
    assert.equal(layout.leftRail.h, height);
    assert.ok(layout.surfaces.overlayDrawer);
    assert.ok(layout.surfaces.rootDrawer);
    assert.equal(layout.surfaces.rootDrawer.x >= layout.leftRail.x + layout.leftRail.w, true);
    assert.equal(layout.surfaces.rootDrawer.x < layout.workSurface.x + layout.workSurface.w, true);
    assert.equal(layout.surfaces.rootDrawer.y >= layout.bounds.y, true);
    assert.equal(layout.surfaces.rootDrawer.y + layout.surfaces.rootDrawer.h <= layout.bottomRail.y, true);
    assert.equal(layout.leftRail.w <= 96, true);
    assert.equal(intersects(layout.surfaces.rootDrawer, layout.bottomRail), false);
    assert.equal(intersects(layout.surfaces.rootDrawer, layout.zoomStrip), false);
    assert.deepEqual(layout.surfaces.rootMenu, layout.leftRail);
    assert.deepEqual(layout.surfaces.submenu, null);
    assert.deepEqual(layout.surfaces.toolOptions, layout.bottomRail);
    assert.equal(layout.surfaces.zoom, null);
    assert.deepEqual(layout.surfaces.workSurface, layout.workSurface);
    assert.equal(layout.bottomRailRole, 'tool-options-ribbons-zoom');
    assert.ok(layout.workSurface.x >= layout.leftRail.x + layout.leftRail.w);
    assert.ok(layout.workSurface.x + layout.workSurface.w <= width);
    assert.ok(layout.workSurface.y + layout.workSurface.h <= height);
    assert.ok(layout.bottomRail.y >= layout.workSurface.y + layout.workSurface.h);
    assert.ok(layout.bottomRail.h > 0);
    assert.equal(intersects(layout.workSurface, layout.bottomRail), false);
    assert.equal(intersects(layout.workSurface, layout.paletteStrip), false);
    assert.equal(intersects(layout.workSurface, layout.toolbarStrip), false);
  }
  assert.equal(pixelStudioSource.includes('const mobileToolOptionsSurface = mobileLandscapeLayout?.surfaces?.toolOptions;'), true);
  assert.equal(pixelStudioSource.includes('viewportMode\n      })'), true);
  assert.equal(pixelStudioSource.includes('viewportMode: this.activeViewportMode'), true);
  assert.equal(pixelStudioSource.includes('const resolvedViewportMode = typeof viewportMode === \'string\''), true);
  assert.equal(pixelStudioSource.includes('resolvedViewportMode?.isLandscapeTouch || resolvedViewportMode?.isGamepadLandscape'), true);
  assert.equal(pixelStudioSource.includes("resolvedMode === 'landscape-touch'"), true);
  assert.equal(pixelStudioSource.includes('const mobileZoomSurface = mobileLandscapeLayout?.surfaces?.zoom;'), false);
  assert.equal(pixelStudioSource.includes('topRailHeight: 0,'), true);
  assert.equal(pixelStudioSource.includes("rootDrawerSurface: 'work-surface-menu-overlay'"), false);
  assert.equal(pixelStudioSource.includes("rootDrawerOverlayOrigin: 'work-surface'"), false);
  assert.equal(pixelStudioSource.includes('reserveRightRail: drawerOpen,'), true);
  assert.equal(pixelStudioSource.includes('const mobileRootDrawerSurface = mobileLandscapeLayout?.surfaces?.rootDrawer;'), true);
  assert.equal(pixelStudioSource.includes('const mobileOverlayDrawerSurface = mobileLandscapeLayout?.surfaces?.overlayDrawer;'), true);
  assert.equal(pixelStudioSource.includes("this.drawMobileDrawer(ctx, mobileSubmenuSurface.x, mobileSubmenuSurface.y, mobileSubmenuSurface.w, mobileSubmenuSurface.h, 'submenu');"), true);
  assert.equal(pixelStudioSource.includes('if (!menuFullScreen && mobileLandscape && mobileToolOptionsSurface?.h > 0) {'), true);
  assert.equal(pixelStudioSource.includes('this.drawPixelLandscapeBottomControls(ctx, mobileToolOptionsSurface);'), true);
  assert.equal(pixelStudioSource.includes('this.drawPixelLandscapeZoomControl(ctx, mobileZoomSurface);'), false);
  assert.equal(pixelStudioSource.includes('this.drawPixelLandscapeZoomControl(ctx, {'), true);
  assert.equal(pixelStudioSource.includes('this.drawMobilePanZoomControls(ctx, width, height, mobileLandscape ? mobileWorkSurface : null);'), false);
  assert.equal(pixelStudioSource.includes('resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(toolbarBody.includes("this.drawBrushPreviewChip(ctx, brushPreviewBounds);"), true);
  assert.equal(toolbarBody.includes('this.drawColorRegisterToggle(ctx, registerBounds);'), true);
  assert.equal(toolbarBody.includes("label: this.animation.playing ? '⏸' : '▶'"), true);
  assert.equal(toolbarBody.includes("{ label: '☰', action: () => { this.mobileDrawer = 'panel'; } }"), false);
  assert.equal(toolbarBody.includes("{ label: '↶', action: () => this.runtime.undo() }"), false);
  assert.equal(toolbarBody.includes("{ label: '↷', action: () => this.runtime.redo() }"), false);
  assert.equal(COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT, 4);
  assert.equal(COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH, 84);
  assert.equal(editorMenuLayoutSource.includes('leftRailWidth: leftRailWidth ?? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.width'), true);
});

test('Pixel mobile landscape uses a compact four-action rail instead of a scrolling root menu', () => {
  const railIndex = pixelStudioSource.indexOf('  drawMobileRail(ctx, x, y, w, h)');
  const portraitIndex = pixelStudioSource.indexOf('  drawMobilePortraitLayout(ctx, width, height)', railIndex);
  assert.ok(railIndex >= 0);
  assert.ok(portraitIndex > railIndex);
  const railBody = pixelStudioSource.slice(railIndex, portraitIndex);

  assert.equal(railBody.includes("id: 'menu', label: 'Menu'"), true);
  assert.equal(railBody.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(railBody.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(railBody.includes("id: 'brush'"), true);
  assert.equal(railBody.includes("id: 'file'"), false);
  assert.equal(railBody.includes('getSharedPortraitMenuMetrics'), false);
  assert.equal(railBody.includes('drawSharedPortraitScrollHints'), false);
  assert.equal(pixelStudioSource.includes('reserveThumbstickSpace: false'), true);
  assert.equal(pixelStudioSource.includes('leftRailWidth: 84'), false);
});

test('shared landscape touch shells default to a narrow portrait-style command rail', () => {
  SHARED_EDITOR_IDS.forEach((editorId) => {
    const layout = buildLandscapeTouchEditorShellPlan(editorId, {
      viewportWidth: 844,
      viewportHeight: 390,
      reserveRightRail: false,
      bottomRailHeight: 72
    });
    assert.equal(layout.surfaces.compactCommandRail.w, COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH, `${editorId} should inherit the shared compact rail width`);
    assert.equal(layout.surfaces.rootMenu.w, COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH, `${editorId} root menu surface should match compact rail width`);
    assert.equal(layout.compactCommandRailActionLimit, COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT);
    assert.equal(layout.scroll.compactCommandRail.enabled, false);
    assert.equal(layout.scroll.leftRail.enabled, false);
    assert.equal(layout.scroll.rootDrawer.enabled, true);
  });
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
  const mobileBranchIndex = levelEditorSource.indexOf('    if (viewportMode.isMobileViewport) {');
  const levelPortraitSubmenuIndex = levelEditorSource.indexOf('const portraitSubmenuTabs = portraitLayout && [\'assets\', \'settings\'].includes(portraitRootId)', mobileBranchIndex);
  const levelContentHeightIndex = levelEditorSource.indexOf('let contentHeight = Math.max(0, drawerY + drawerH - contentY - reservedBottom - fileFooterReserved);', mobileBranchIndex);
  const levelDrawSubmenuIndex = levelEditorSource.indexOf('if (portraitSubmenuTabs.length) {', levelContentHeightIndex);
  const sharedLayout = getSharedMobilePortraitEditorLayout(390, 844, {
    middleRailHeight: 88,
    minTopHeight: 230,
    minMainHeight: 220
  });
  const tabLayout = getSharedPortraitMultiRowTabLayout(sharedLayout.rootRail, model.rootTabs, {
    minButtonWidth: 64,
    maxButtonWidth: 116,
    maxRows: 2,
    balanceLastRow: true,
    verticalAlign: 'bottom',
    padding: 6
  });
  const bottomY = Math.max(...tabLayout.buttons.map((button) => button.bounds.y + button.bounds.h));

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'tools', 'assets', 'settings']);
  assert.deepEqual(model.assetTabs.map((tab) => tab.id), ['tiles', 'pixels', 'npcs', 'triggers', 'powerups', 'prefabs', 'music', 'graphics']);
  assert.deepEqual(model.assetTabs.find((tab) => tab.id === 'pixels')?.label, 'Tile Art');
  assert.deepEqual(model.assetTabs.find((tab) => tab.id === 'graphics')?.label, 'Decals');
  assert.deepEqual(model.settingsTabs.map((tab) => tab.id), ['level-settings', 'midi']);
  assert.equal(levelEditorSource.includes("'level-settings', 'midi'"), true);
  assert.equal(levelEditorSource.includes("} else if (activeTab === 'midi') {"), true);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'playtest']);
  assert.equal(model.rootTabs.some((tab) => tab.id === 'playtest' || tab.panel === 'playtest'), false);
  assert.equal(model.assetTabs.some((tab) => tab.id === 'playtest'), false);
  assert.equal(model.settingsTabs.some((tab) => tab.id === 'playtest'), false);
  assert.equal(tabLayout.fits, true);
  assert.equal(bottomY, sharedLayout.rootRail.y + sharedLayout.rootRail.h - 6);
  assert.equal(levelEditorSource.includes('buildLevelPortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean)'), true);
  assert.equal(levelEditorSource.includes('drawSharedPortraitMultiRowTabStrip(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, tabs, {'), true);
  assert.equal(levelEditorSource.includes("verticalAlign: 'bottom'"), true);
  assert.equal(levelEditorSource.includes('drawSharedPortraitTabStrip(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, tabs'), false);
  assert.ok(levelPortraitSubmenuIndex > 0);
  assert.ok(levelContentHeightIndex > levelPortraitSubmenuIndex);
  assert.ok(levelDrawSubmenuIndex > levelContentHeightIndex);
  assert.equal(levelEditorSource.includes('const portraitSubmenuTop = portraitSubmenuRows\n          ? Math.max(contentY, drawerY + drawerH - 12 - portraitSubmenuH)\n          : 0;'), true);
  assert.equal(levelEditorSource.includes('const reservedBottom = 12 + (portraitSubmenuRows ? portraitSubmenuH + 8 : 0);'), true);
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
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: false,
    viewportWidth: 844,
    viewportHeight: 390,
    viewportMode: { mode: 'portrait' }
  }), false);
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: true,
    viewportWidth: 390,
    viewportHeight: 844,
    viewportMode: 'landscape'
  }), true);
  assert.equal(shouldShowLevelEditorTopPlaytestButton({
    isMobile: true,
    viewportWidth: 844,
    viewportHeight: 390,
    viewportMode: { mode: 'landscape-touch', isLandscapeTouch: true }
  }), true);
  const topPlaytestIndex = levelEditorSource.indexOf('export function shouldShowLevelEditorTopPlaytestButton');
  const topPlaytestBody = levelEditorSource.slice(topPlaytestIndex, levelEditorSource.indexOf('export default class Editor', topPlaytestIndex));
  assert.ok(topPlaytestIndex >= 0);
  assert.equal(topPlaytestBody.includes('resolveEditorViewportModeFlags({'), true);
  assert.equal(topPlaytestBody.includes("editorId: 'level'"), true);
  assert.equal(topPlaytestBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(levelEditorSource.includes('isMobileLandscapeLayout'), false);
  assert.equal(levelEditorSource.includes('isMobilePortraitLayout'), false);
  assert.equal(sfxEditorSource.includes('isMobilePortraitLayout'), false);
  assert.equal(levelEditorSource.includes('viewportMode\n    }))'), true);
  assert.equal(levelEditorSource.includes("viewportMode: this.activeViewportMode"), true);
});

test('Level mobile landscape root drawer exposes every root action in a grid', () => {
  const tabs = buildLevelMobileLandscapeRootTabs();

  assert.deepEqual(tabs.map((tab) => tab.id), [
    'file',
    'edit',
    'view',
    'toolbox',
    'tiles',
    'pixels',
    'npcs',
    'triggers',
    'powerups',
    'prefabs',
    'graphics',
    'music',
    'level-settings'
  ]);
  assert.equal(new Set(tabs.map((tab) => tab.id)).size, tabs.length);
  assert.ok(tabs.length > 7);
  assert.equal(levelEditorSource.includes('buildCompactLandscapeCommandRailActions({'), true);
  assert.equal(levelEditorSource.includes("id: 'menu',"), true);
  assert.equal(levelEditorSource.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(levelEditorSource.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(levelEditorSource.includes("quickAction = { id: 'playtest', label: 'Play'"), true);
  assert.equal(levelEditorSource.includes('const rootItems = buildLevelMobileLandscapeRootTabs();'), true);
  assert.equal(levelEditorSource.includes('this.drawer.rootOpen = nextOpen;'), true);
  const rootDrawerIndex = levelEditorSource.indexOf('const rootItems = buildLevelMobileLandscapeRootTabs();');
  const rootDrawerBody = levelEditorSource.slice(rootDrawerIndex, levelEditorSource.indexOf('if (!rootDrawerOpen)', rootDrawerIndex));
  assert.equal(rootDrawerBody.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(rootDrawerBody.includes('this.panelScrollMax.root = 0;'), true);
  assert.equal(rootDrawerBody.includes('const scrolledGrid = buildScrolledLandscapeRootDrawerItems(grid, this.panelScroll.root || 0);'), false);
  assert.equal(rootDrawerBody.includes('this.panelScroll.root = 0;'), true);
  assert.equal(rootDrawerBody.includes('grid.items.forEach(({ index, bounds }) => {'), true);
  assert.equal(rootDrawerBody.includes('scrolledGrid.items.forEach(({ index, bounds }) => {'), false);
  assert.equal(rootDrawerBody.includes('rootItems.slice(rootScroll, rootScroll + visibleRows).forEach((entry, index) => {'), false);
  assert.equal(rootDrawerBody.includes('this.drawer.rootOpen = true;'), true);
  assert.equal(rootDrawerBody.includes('this.drawer.rootOpen = false;'), false);
  assert.equal(rootDrawerBody.includes("entry.id === 'undo'"), false);
  assert.equal(rootDrawerBody.includes("entry.id === 'redo'"), false);
  assert.equal(levelEditorSource.includes("const suppressLandscapeThumbstick = this.drawer.open || !canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(levelEditorSource.includes('if (suppressLandscapeThumbstick) {\n        resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(levelEditorSource.includes("const suppressLandscapeMenuThumbstick = this.activeViewportMode === 'landscape-touch' && this.drawer.open"), true);
  assert.equal(levelEditorSource.includes("const suppressLandscapeMenuThumbstick = this.activeViewportMode === 'landscape' && this.drawer.open"), false);
  assert.equal(levelEditorSource.includes('const suppressLandscapeMenuThumbstick = isMobileLandscapeLayout({'), false);
  assert.equal(levelEditorSource.includes("|| !canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(levelEditorSource.includes('if (!suppressLandscapeMenuThumbstick && this.isPointInCircle(payload.x, payload.y, this.panJoystick.center, this.panJoystick.radius * 1.2))'), true);
});

test('Level mobile landscape rail is backed by shared editor menu aliases', () => {
  const tabs = buildLevelMobileLandscapeRootTabs();

  assert.equal(levelEditorSource.includes('const LEVEL_LANDSCAPE_BOTTOM_RAIL_HEIGHT = 72;'), true);
  assert.equal(levelEditorSource.includes('bottomRailHeight: LEVEL_LANDSCAPE_BOTTOM_RAIL_HEIGHT'), true);
  assert.equal(levelEditorSource.includes('reserveRightRail: this.drawer.open && !gamepadSubmenuOnLeft'), true);
  assert.equal(levelEditorSource.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(levelEditorSource.includes("const canRenderLandscapeBottomRail = !portraitLayout\n        && canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail');"), true);
  assert.equal(levelEditorSource.includes("const canRenderLandscapeRightSubmenu = !portraitLayout\n        && canRenderEditorPlanSurface(landscapeLayout, 'right-drawer')"), true);
  assert.equal(levelEditorSource.includes("&& canRenderEditorPlanSurface(landscapeLayout, 'landscape-right-submenu');"), true);
  assert.equal(levelEditorSource.includes("const canRenderLandscapeRootDrawer = !portraitLayout\n        && canRenderEditorPlanSurface(landscapeLayout, 'left-overlay-drawer');"), true);
  assert.equal(levelEditorSource.includes("canRenderEditorPlanSurface(landscapeLayout, 'right-overlay-drawer')"), false);
  assert.equal(levelEditorSource.includes('const landscapeToolOptionsSurface = canRenderLandscapeBottomRail\n        ? landscapeLayout?.surfaces.toolOptions\n        : null;'), true);
  assert.equal(levelEditorSource.includes('const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu\n        ? landscapeLayout?.surfaces.submenu\n        : null;'), true);
  assert.equal(levelEditorSource.includes('const landscapeRootDrawerSurface = canRenderLandscapeRootDrawer\n        ? (landscapeLayout?.surfaces.rootDrawer ?? landscapeLayout?.surfaces.overlayDrawer)\n        : null;'), true);
  assert.equal(levelEditorSource.includes('const landscapeActiveDrawerSurface = this.drawer.rootOpen'), true);
  assert.equal(levelEditorSource.includes(': (landscapeSubmenuSurface ?? landscapeRootDrawerSurface);'), true);
  assert.equal(levelEditorSource.includes('const landscapeSubmenuDrawer = rootDrawerOpen && landscapeSubmenuSurface'), true);
  assert.equal(levelEditorSource.includes('if (!rootDrawerOpen || landscapeSubmenuDrawer) {'), true);
  assert.equal(levelEditorSource.includes('let drawerH = portraitLayout ? portraitLayout.rightRail.h : (landscapeActiveDrawerSurface?.h ?? height);'), true);
  assert.equal(levelEditorSource.includes('sliderX = landscapeToolOptionsSurface.x + 16;'), true);
  assert.equal(levelEditorSource.includes('this.zoomSlider.bounds = { x: sliderX, y: sliderY - 14, w: sliderWidth, h: sliderHeight + 28 };'), true);
  assert.equal(levelEditorSource.includes('getSharedMobileDrawerWidth(width, height, railWidth, { edgePadding: 0 })'), true);
  assert.equal(levelEditorSource.includes("const LEVEL_CONTROLLER_ROOTS = getEditorControllerRootMenuIds('level');"), true);
  assert.equal(levelEditorSource.includes('siblingOrder: LEVEL_CONTROLLER_ROOTS'), true);
  assert.equal(levelEditorSource.includes('const panelTab = getLevelPanelTabForRootId(entry.id);'), true);
  assert.equal(levelEditorSource.includes('return rootItem(entry.id, entry.label, panelTab, panelTab);'), true);
  assert.equal(tabs.find((tab) => tab.id === 'pixels')?.specId, 'tile-art');
  assert.equal(tabs.find((tab) => tab.id === 'npcs')?.specId, 'actors');
  assert.equal(tabs.find((tab) => tab.id === 'prefabs')?.specId, 'structures');
  assert.equal(tabs.find((tab) => tab.id === 'level-settings')?.specId, 'settings');
  assert.equal(tabs.some((tab) => tab.id === 'playtest'), false);
});

test('Level gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const gamepadStateIndex = levelEditorSource.indexOf('  getGamepadMenuState(width = this.getViewportSize().width, height = this.getViewportSize().height) {');
  const gamepadStateBody = levelEditorSource.slice(gamepadStateIndex, levelEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)', gamepadStateIndex));

  assert.equal(levelEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(levelEditorSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(levelEditorSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(levelEditorSource.includes('  resolveLevelViewportMode(width = this.game?.viewport?.width || this.game.canvas?.width || 0, height = this.game?.viewport?.height || this.game.canvas?.height || 0) {'), true);
  assert.equal(levelEditorSource.includes('const portraitLayout = viewportMode.isMobilePortrait'), true);
  assert.equal(levelEditorSource.includes('if (viewportMode.isMobileViewport) {'), true);
  assert.equal(levelEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(levelEditorSource.includes('return this.getGamepadMenuState(width, height).drawSlideOut;'), true);
  assert.equal(levelEditorSource.includes('const viewportMode = this.resolveLevelViewportMode(width, height);'), true);
  assert.equal(gamepadStateBody.includes('gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.()),'), true);
  assert.equal(gamepadStateBody.includes('gamepadConnected: this.game?.input?.isGamepadConnected?.(),'), false);
  assert.equal(gamepadStateBody.includes('isMobile: viewportMode.isMobileViewport,'), true);
  assert.equal(gamepadStateBody.includes('isMobile: this.isMobileLayout()'), false);
  assert.equal(levelEditorSource.includes("resolveGamepadMenuState('level'"), false);
  assert.equal(levelEditorSource.includes('const rootMenuSurface = landscapeLayout.surfaces.compactCommandRail ?? landscapeLayout.surfaces.rootMenu;'), true);
  assert.equal(levelEditorSource.includes('const workSurface = landscapeLayout.surfaces.workSurface;'), true);
  assert.equal(levelEditorSource.includes('const gamepadMenuState = !portraitLayout ? this.getGamepadMenuState(width, height) : null;'), true);
  assert.equal(levelEditorSource.includes('const gamepadSubmenuOnLeft = Boolean(gamepadMenuState?.drawSlideOut);'), true);
  assert.equal(levelEditorSource.includes('const drawerOpenForLayout = Boolean(this.drawer.open && (portraitLayout || !gamepadSubmenuOnLeft));'), true);
  assert.equal(levelEditorSource.includes('reserveRightRail: this.drawer.open && !gamepadSubmenuOnLeft'), true);
  assert.equal(levelEditorSource.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(levelEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH });'), true);
  assert.equal(levelEditorSource.includes('this.panelScrollHitBounds = { ...listBounds };'), true);
  assert.equal(levelEditorSource.includes('this.panelScrollMax[menuId] = Math.max(0, items.length - visibleRows);'), true);
  assert.equal(levelEditorSource.includes('this.panelScroll[menuId] ?? this.controllerMenu.scroll?.[menuId] ?? 0'), true);
  assert.equal(levelEditorSource.includes('return this.getGamepadMenuState(width, height).drawControllerOverlay;'), true);
});

test('Level desktop right button pans instead of erasing or placing content', () => {
  const pointerDownIndex = levelEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = levelEditorSource.slice(pointerDownIndex, levelEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const policyIndex = pointerDownBody.indexOf("const pointerPolicy = getEditorPointerInteractionPolicy('level'");
  const rightPanIndex = pointerDownBody.indexOf('if (shouldPanWithButton) {');
  const dragModeIndex = pointerDownBody.indexOf('const dragMode = this.resolveDragMode(this.mode);');

  assert.ok(policyIndex > 0);
  assert.ok(rightPanIndex > policyIndex);
  assert.ok(rightPanIndex > 0);
  assert.ok(dragModeIndex > rightPanIndex);
  assert.equal(pointerDownBody.includes("const isDesktopMode = this.activeViewportMode === 'desktop';"), true);
  assert.equal(pointerDownBody.includes('const isTouchMode = !isDesktopMode;'), true);
  assert.equal(pointerDownBody.includes('if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({'), true);
  assert.equal(pointerDownBody.includes('if (isDesktopMode) {\n      const desktopDropdownHit = this.uiButtons.find'), true);
  assert.equal(pointerDownBody.includes('if (this.isMobileLayout())'), false);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.rightDragPan'), true);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.middleDragPan'), true);
  assert.equal(levelEditorSource.includes('getEditorPointerInteractionPolicy'), true);
  assert.equal(pointerDownBody.includes("this.tileTool = 'erase';"), false);
});

test('Level mobile rail and drawer scroll uses shared drag helper', () => {
  const pointerDownIndex = levelEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = levelEditorSource.slice(pointerDownIndex, levelEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const pointerMoveIndex = levelEditorSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = levelEditorSource.slice(pointerMoveIndex, levelEditorSource.indexOf('  handlePointerUp(payload)', pointerMoveIndex));
  const pointerUpIndex = levelEditorSource.indexOf('  handlePointerUp(payload = {})');
  const pointerUpBody = levelEditorSource.slice(pointerUpIndex, levelEditorSource.indexOf('  handleWheel(payload)', pointerUpIndex));

  assert.equal(levelEditorSource.includes('buildMenuScrollDragState'), true);
  assert.equal(levelEditorSource.includes('resolveMenuScrollDrag'), true);
  assert.equal(pointerMoveBody.includes("const isTouchMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(pointerUpBody.includes("const isTouchMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(pointerDownBody.includes('this.panelScrollDrag = buildMenuScrollDragState({'), true);
  assert.equal(pointerDownBody.includes('scrollScale: 1 / Math.max(1, scrollUnit)'), true);
  assert.equal(pointerDownBody.includes('pendingHit: { x: payload.x, y: payload.y, id: payload.id ?? null }'), true);
  assert.equal(pointerMoveBody.includes('this.panelScrollDrag = resolveMenuScrollDrag(this.panelScrollDrag, payload);'), true);
  assert.equal(pointerMoveBody.includes('this.panelScroll[activeTab] = clamp(this.panelScrollDrag.nextScroll, 0, maxScroll);'), true);
  assert.equal(pointerMoveBody.includes('if (this.isMobileLayout())'), false);
  assert.equal(pointerUpBody.includes('if (this.isMobileLayout())'), false);
});

test('Level editor keeps settings and tile art reachable from desktop rail', () => {
  const desktopIndex = levelEditorSource.indexOf('const topButtonDefs = shellLayout.topMenu.buttons.map((entry) => ({');
  const desktopTopMenuBlock = levelEditorSource.slice(desktopIndex, levelEditorSource.indexOf('drawSharedPanel(ctx, shellLayout.leftRibbon', desktopIndex));

  assert.equal(levelEditorSource.includes('const LEVEL_PANEL_TABS = ['), true);
  assert.equal(levelEditorSource.includes("    .filter((id) => !['edit', 'playtest'].includes(id)),"), true);
  assert.equal(levelEditorSource.includes("  'midi'"), true);
  assert.equal(levelEditorSource.includes("const LEVEL_DRAWER_TABS = LEVEL_PANEL_TABS.filter((id) => id !== 'view');"), true);
  assert.equal(levelEditorSource.includes('this.panelTabs = LEVEL_PANEL_TABS.slice();'), true);
  assert.equal(levelEditorSource.includes('tabs: LEVEL_DRAWER_TABS.slice(),'), true);
  assert.ok(desktopIndex > 0);
  assert.equal(desktopTopMenuBlock.includes("const topButtonDefById = new Map(topButtonDefs.map((entry) => [entry.id, entry]));"), true);
  assert.equal(desktopTopMenuBlock.includes("const def = topButtonDefById.get(entry.id);"), true);
  assert.equal(levelEditorSource.includes("{ id: 'pixels', title: 'Tile Art'"), true);
  assert.equal(desktopTopMenuBlock.includes("const topButtonDefs = ["), false);
  assert.equal(desktopTopMenuBlock.includes("{ id: 'toolbox', label: 'Toolbox' }"), false);
  assert.equal(desktopTopMenuBlock.includes("{ id: 'npcs', label: 'NPCs' }"), false);
  assert.equal(desktopTopMenuBlock.includes("{ id: 'playtest', label: 'Playtest' }"), false);
  assert.equal(desktopTopMenuBlock.includes("{ id: 'toolbox', label: 'TOOLBOX' }"), false);
  assert.equal(desktopTopMenuBlock.includes("{ id: 'npcs', label: 'NPCS' }"), false);
});

test('Level random size dialog uses shared RTG Studio panel chrome', () => {
  const hudIndex = levelEditorSource.indexOf('  drawHUD(ctx, width, height) {');
  const dialogIndex = levelEditorSource.indexOf('    if (this.randomLevelDialog.open) {', hudIndex);
  const dialogBody = levelEditorSource.slice(dialogIndex, levelEditorSource.indexOf('    if (this.radialMenu.active', dialogIndex));

  assert.ok(hudIndex > 0);
  assert.ok(dialogIndex > hudIndex);
  assert.equal(dialogBody.includes('drawSharedPanel(ctx, { x: dialogX, y: dialogY, w: dialogW, h: dialogH }, {'), true);
  assert.equal(dialogBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(dialogBody.includes('border: UI_SUITE.colors.border'), true);
  assert.equal(dialogBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(dialogBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(dialogBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(dialogBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(dialogBody.includes("ctx.font = '14px Courier New';"), false);
  assert.equal(dialogBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(dialogBody.includes("ctx.strokeStyle = '#fff';"), false);
});

test('Level editor HUD overlays use shared RTG Studio text tokens', () => {
  const overlayIndex = levelEditorSource.indexOf('    const zones = this.game.world.musicZones || [];');
  const overlayBody = levelEditorSource.slice(overlayIndex, levelEditorSource.indexOf('  drawHUD(ctx, width, height) {', overlayIndex));
  const hudIndex = levelEditorSource.indexOf('  drawHUD(ctx, width, height) {');
  const hudBody = levelEditorSource.slice(hudIndex, levelEditorSource.indexOf('\n  }\n}', hudIndex));

  assert.ok(overlayIndex > 0);
  assert.ok(hudIndex > overlayIndex);
  assert.equal(overlayBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(overlayBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(overlayBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.85)';"), false);
  assert.equal(overlayBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.92)';"), false);
  assert.equal(hudBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(hudBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(hudBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(hudBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(hudBody.includes('ctx.strokeStyle = UI_SUITE.colors.border;'), true);
  assert.equal(hudBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(hudBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.8)';"), false);
});

test('Level drawer content and picker previews use shared RTG Studio chrome', () => {
  const hudIndex = levelEditorSource.indexOf('  drawHUD(ctx, width, height) {');
  const tilePreviewIndex = levelEditorSource.indexOf('    const drawTilePreview = (x, y, size, tile) => {', hudIndex);
  const tilePreviewBody = levelEditorSource.slice(tilePreviewIndex, levelEditorSource.indexOf('    const drawPrefabPreview = (x, y, size, prefab) => {', tilePreviewIndex));
  const prefabPreviewIndex = levelEditorSource.indexOf('    const drawPrefabPreview = (x, y, size, prefab) => {', hudIndex);
  const prefabPreviewBody = levelEditorSource.slice(prefabPreviewIndex, levelEditorSource.indexOf('    const drawEnemyPreview = (x, y, size, enemy) => {', prefabPreviewIndex));
  const enemyPreviewIndex = levelEditorSource.indexOf('    const drawEnemyPreview = (x, y, size, enemy) => {', hudIndex);
  const enemyPreviewBody = levelEditorSource.slice(enemyPreviewIndex, levelEditorSource.indexOf('    const drawButton = (x, y, w, h, label, active, onClick', enemyPreviewIndex));
  const drawerPanelIndex = levelEditorSource.indexOf('        drawSharedPanel(ctx, { x: contentX, y: contentY, w: contentW, h: contentHeight }, {', hudIndex);
  const drawerPanelBody = levelEditorSource.slice(drawerPanelIndex, levelEditorSource.indexOf('        const fileHeaderOffset = helperH ? helperH + 14 : 0;', drawerPanelIndex));

  assert.ok(tilePreviewIndex > hudIndex);
  assert.ok(prefabPreviewIndex > tilePreviewIndex);
  assert.ok(enemyPreviewIndex > prefabPreviewIndex);
  assert.ok(drawerPanelIndex > hudIndex);
  assert.equal(drawerPanelBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(drawerPanelBody.includes('fill: UI_SUITE.colors.panel,'), true);
  assert.equal(drawerPanelBody.includes('border: UI_SUITE.colors.border'), true);
  assert.equal(drawerPanelBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.08)';"), false);
  assert.equal(tilePreviewBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(tilePreviewBody.includes('ctx.font = `10px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tilePreviewBody.includes("ctx.font = '10px Courier New';"), false);
  assert.equal(prefabPreviewBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(prefabPreviewBody.includes('ctx.font = `10px ${UI_SUITE.font.family}`;'), true);
  assert.equal(prefabPreviewBody.includes("ctx.font = '10px Courier New';"), false);
  assert.equal(enemyPreviewBody.includes('ctx.font = `10px ${UI_SUITE.font.family}`;'), true);
  assert.equal(enemyPreviewBody.includes("ctx.font = '10px Courier New';"), false);
});

test('Level NPC separators stay inert instead of clickable no-op rows', () => {
  assert.equal(levelEditorSource.includes("separator: true, onClick: () => {}"), false);
  assert.equal(levelEditorSource.includes("separator: true, active: false, tooltip: 'Ambient weather and spawners', onClick: () => {}"), false);
  assert.equal(levelEditorSource.includes("separator: true, active: false, tooltip: 'Standard enemies', onClick: () => {}"), false);
  assert.equal(levelEditorSource.includes("separator: true, active: false, tooltip: 'Boss enemies', onClick: () => {}"), false);
  assert.equal(levelEditorSource.includes("separator: true, active: false, tooltip: 'Custom actor roots', onClick: () => {}"), false);
  assert.equal(levelEditorSource.includes('if (item.divider || item.separator) return;'), true);
  assert.equal(levelEditorSource.includes('if (item.divider || item.separator) {'), true);
});

test('Level trigger value readouts are disabled instead of clickable no-op controls', () => {
  assert.equal(levelEditorSource.includes('false, () => {}, label'), false);
  assert.equal(levelEditorSource.includes("false, () => {}, 'Volume'"), false);
  assert.equal(levelEditorSource.includes('`${label}: ${draft.params[key] || 0}`, false, null, label, null, false, true'), true);
  assert.equal(levelEditorSource.includes("`Volume: ${volumePercent}%`, false, null, 'Volume', null, false, true"), true);
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
  assert.equal(levelEditorSource.includes('const panelTab = getLevelPanelTabForRootId(entry.id);'), true);
  assert.equal(levelEditorSource.includes('return rootItem(entry.id, entry.label, panelTab, panelTab);'), true);
  assert.equal(levelEditorSource.includes("edit: {\n        id: 'edit',\n        title: 'Edit',\n        items: this.getLevelEditMenuItems().map((item) => action(item.id, item.label, item.onClick, {\n          disabled: Boolean(item.disabled)\n        }))\n      }"), true);
  assert.equal(levelEditorSource.includes("} else if (tabId === 'view') {"), true);
  assert.equal(levelEditorSource.includes("id: 'zoom-reset',"), true);
});

test('Level Settings menu exposes a live MIDI command across panel drawers', () => {
  const panelIndex = levelEditorSource.indexOf("    } else if (tabId === 'level-settings') {");
  const panelBody = levelEditorSource.slice(panelIndex, levelEditorSource.indexOf("    } else if (tabId === 'tiles')", panelIndex));
  const drawerIndex = levelEditorSource.indexOf("        } else if (activeTab === 'level-settings') {");
  const drawerBody = levelEditorSource.slice(drawerIndex, levelEditorSource.indexOf("        } else if (activeTab === 'tiles')", drawerIndex));

  assert.equal(panelBody.includes("id: 'midi'"), true);
  assert.equal(panelBody.includes("onClick: () => this.setPanelTab('midi')"), true);
  assert.equal(drawerBody.includes("id: 'midi'"), true);
  assert.equal(drawerBody.includes("onClick: () => this.setPanelTab('midi')"), true);
});

test('Level mobile draw path keeps portrait layout scoped for the whole branch', () => {
  const layoutBoundsIndex = levelEditorSource.indexOf('  updateLayoutBounds(');
  const layoutBoundsBody = levelEditorSource.slice(layoutBoundsIndex, levelEditorSource.indexOf('  update(dt)', layoutBoundsIndex));
  const portraitIndex = levelEditorSource.indexOf('    const portraitLayout = viewportMode.isMobilePortrait');
  const mobileBranchIndex = levelEditorSource.indexOf('    if (viewportMode.isMobileViewport) {', portraitIndex);
  const mobileBranchEnd = levelEditorSource.indexOf('      if (!this.drawer.open) {', mobileBranchIndex);
  const mobileBranch = levelEditorSource.slice(mobileBranchIndex, mobileBranchEnd);
  const editItemsIndex = levelEditorSource.indexOf('  getLevelEditMenuItems()');
  const editItemsBody = levelEditorSource.slice(editItemsIndex, levelEditorSource.indexOf('  getLevelEditDeleteTooltip()', editItemsIndex));

  assert.ok(portraitIndex >= 0);
  assert.ok(mobileBranchIndex > portraitIndex);
  assert.ok(mobileBranchEnd > mobileBranchIndex);
  assert.equal(levelEditorSource.includes('const mobilePortraitLayout = viewportMode.isMobilePortrait'), false);
  assert.equal(mobileBranch.includes('const portraitLayout = mobilePortraitLayout;'), false);
  assert.equal(mobileBranch.includes('const landscapeRootMenuSurface = canRenderLandscapeRootRail'), true);
  assert.equal(levelEditorSource.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(mobileBranch.includes('const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu'), true);
  assert.equal(mobileBranch.includes('const landscapeWorkSurface = landscapeLayout?.surfaces.workSurface;'), true);
  assert.equal(mobileBranch.includes('const drawerOpenForLayout = Boolean(this.drawer.open && (portraitLayout || !gamepadSubmenuOnLeft));'), true);
  assert.equal(mobileBranch.includes('reserveRightRail: this.drawer.open && !gamepadSubmenuOnLeft'), true);
  assert.equal(mobileBranch.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(mobileBranch.includes('let drawerWidth = drawerOpenForLayout'), true);
  assert.equal(mobileBranch.includes('this.drawerBounds = drawerOpenForLayout'), true);
  assert.equal(mobileBranch.includes('if (drawerOpenForLayout) {'), true);
  assert.equal(mobileBranch.includes('landscapeLayout.leftRail'), false);
  assert.equal(mobileBranch.includes('landscapeLayout.rightRail'), false);
  assert.equal(mobileBranch.includes('landscapeLayout.mainEditor'), false);
  assert.equal(mobileBranch.includes('this.getLevelFileMenuItems({ includePlaytest: !portraitLayout })'), true);
  assert.equal(layoutBoundsBody.includes('reserveRightRail: this.drawer.open && !gamepadSubmenuOnLeft'), true);
  assert.equal(layoutBoundsBody.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(layoutBoundsBody.includes('const submenuSurface = landscapeLayout.surfaces.submenu;'), true);
  assert.equal(layoutBoundsBody.includes('const activeDrawerSurface = this.drawer.rootOpen'), true);
  assert.equal(layoutBoundsBody.includes('? rootDrawerSurface'), true);
  assert.equal(layoutBoundsBody.includes(': (submenuSurface ?? rootDrawerSurface);'), true);
  assert.equal(layoutBoundsBody.includes('activeDrawerSurface?.x ?? (rootMenuSurface.x + rootMenuSurface.w)'), true);
  assert.equal(editItemsBody.includes("id: 'undo'"), true);
  assert.equal(editItemsBody.includes("id: 'redo'"), true);
  assert.equal(editItemsBody.includes("id: 'copy'"), true);
  assert.equal(editItemsBody.includes("id: 'cut'"), true);
  assert.equal(editItemsBody.includes("id: 'paste'"), true);
  assert.equal(editItemsBody.includes("id: 'delete'"), true);
  assert.equal(editItemsBody.includes('onClick: () => {}'), false);
  assert.equal(editItemsBody.includes('onClick: () => this.copyLevelEditSelection()'), true);
  assert.equal(editItemsBody.includes('onClick: () => this.cutLevelEditSelection()'), true);
  assert.equal(editItemsBody.includes('onClick: () => this.pasteLevelEditSelection()'), true);
  assert.equal(editItemsBody.includes('const hasSelection = Boolean(this.getLevelEditSelection());'), true);
  assert.equal(editItemsBody.includes('const hasClipboard = Boolean(this.levelClipboard?.value);'), true);
  assert.equal(editItemsBody.includes("id: 'copy',\n        label: 'Copy',\n        disabled: !hasSelection"), true);
  assert.equal(editItemsBody.includes("id: 'cut',\n        label: 'Cut',\n        disabled: !hasSelection"), true);
  assert.equal(editItemsBody.includes("id: 'paste',\n        label: clipboardLabel,\n        disabled: !hasClipboard"), true);
  assert.equal(editItemsBody.includes("id: 'delete',\n        label: 'Delete',\n        disabled: !hasSelection"), true);
  assert.equal(levelEditorSource.includes('this.levelClipboard = null;'), true);
  assert.equal(levelEditorSource.includes('  copyLevelEditSelection()'), true);
  assert.equal(levelEditorSource.includes('  cutLevelEditSelection()'), true);
  assert.equal(levelEditorSource.includes('  pasteLevelEditSelection()'), true);
});

test('Level desktop dropdown uses the selected top root menu', () => {
  const dropdownIndex = levelEditorSource.indexOf('if (shellLayout.dropdown) {');
  const dropdownBlock = levelEditorSource.slice(dropdownIndex, levelEditorSource.indexOf('const infoLines = []', dropdownIndex));
  const desktopIndex = levelEditorSource.indexOf('shellLayout.topMenu.buttons.forEach((entry) => {');
  const desktopTopMenuBlock = levelEditorSource.slice(desktopIndex, levelEditorSource.indexOf('drawSharedPanel(ctx, shellLayout.leftRibbon', desktopIndex));
  const leftPanelIndex = levelEditorSource.indexOf('const { contextBounds: contextPanel } = buildSharedDesktopContextTransportLayout(shellLayout.leftOptions, {');
  const leftPanelBlock = levelEditorSource.slice(leftPanelIndex, dropdownIndex);
  const drawButtonIndex = levelEditorSource.indexOf('const drawButton = (x, y, w, h, label, active, onClick');
  const drawButtonBlock = levelEditorSource.slice(drawButtonIndex, levelEditorSource.indexOf('const drawSlider =', drawButtonIndex));

  assert.equal(levelEditorSource.includes('const desktopHoverRoot = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(levelEditorSource.includes("const LEVEL_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('level');"), true);
  assert.equal(levelEditorSource.includes('const getLevelDesktopPanelLabel = (tabId) => {'), true);
  assert.equal(levelEditorSource.includes("excludeIds: ['playtest']"), true);
  assert.equal(levelEditorSource.includes('if (desktopHoverRoot?.rootId) {'), true);
  assert.equal(levelEditorSource.includes('rootId: desktopHoverRoot.rootId,'), true);
  assert.equal(levelEditorSource.includes("dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0"), true);
  assert.equal(levelEditorSource.includes('active: Boolean(entry.active)'), true);
  assert.equal(levelEditorSource.includes('label: entry.label'), true);
  assert.equal(levelEditorSource.includes('active: activeTab === entry.id'), false);
  assert.equal(leftPanelBlock.includes('drawSharedDesktopContextPanel(ctx, contextPanel, {'), true);
  assert.equal(levelEditorSource.includes('subtitle: getLevelDesktopPanelLabel(activeTab)'), true);
  assert.equal(leftPanelBlock.includes('`Active: ${getLevelDesktopPanelLabel(activeTab)}`'), true);
  assert.equal(leftPanelBlock.includes('includeTransport: false'), true);
  assert.equal(leftPanelBlock.includes('`Tile: ${this.tileType?.label || this.tileType?.id || \'None\'}`'), true);
  assert.equal(leftPanelBlock.includes('`NPC: ${this.enemyType?.label || this.enemyType?.name || this.enemyType?.id || \'None\'}`'), true);
  assert.equal(leftPanelBlock.includes("ctx.fillText('Assets'"), true);
  assert.equal(leftPanelBlock.includes("id: 'desktop-assets-tiles'"), true);
  assert.equal(leftPanelBlock.includes("id: 'desktop-assets-actors'"), true);
  assert.equal(leftPanelBlock.includes("id: 'desktop-assets-powerups'"), true);
  assert.equal(leftPanelBlock.includes("id: 'desktop-assets-structures'"), true);
  assert.equal(leftPanelBlock.includes("this.setPanelTab('tiles');"), true);
  assert.equal(leftPanelBlock.includes("this.setPanelTab('npcs');"), true);
  assert.equal(leftPanelBlock.includes("this.setPanelTab('powerups');"), true);
  assert.equal(leftPanelBlock.includes("this.setPanelTab('prefabs');"), true);
  assert.equal(leftPanelBlock.includes('renderSharedFileDrawer'), false);
  assert.equal(leftPanelBlock.includes('items.forEach((item, index) => {'), false);
  assert.equal(dropdownBlock.includes('const dropdownRootId = shellLayout.dropdown.rootId;'), true);
  assert.equal(dropdownBlock.includes('const dropdownPanelId = getLevelPanelTabForRootId(dropdownRootId);'), true);
  assert.equal(dropdownBlock.includes('const controllerMenus = this.buildControllerMenus();'), true);
  assert.equal(dropdownBlock.includes('const controllerMenu = controllerMenus[dropdownPanelId] || controllerMenus[dropdownRootId] || controllerMenus[shellLayout.dropdown.specId];'), true);
  assert.equal(dropdownBlock.includes('const controllerItems = this.controllerMenu.getItems(controllerMenu);'), true);
  assert.equal(dropdownBlock.includes('const { items: fallbackItems } = this.getPanelConfig(dropdownPanelId);'), false);
  assert.equal(dropdownBlock.includes('const dropdownItems = controllerItems.length ? controllerItems : fallbackItems;'), false);
  assert.equal(dropdownBlock.includes('const dropdownPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(dropdownBlock.includes('items: controllerItems'), true);
  assert.equal(dropdownBlock.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(dropdownBlock.includes('drawSharedPanel(ctx, dropdownPlan.panelBounds'), false);
  assert.equal(dropdownBlock.includes('const buttonBounds = dropdownPlan.itemBounds[index];'), false);
  assert.equal(dropdownBlock.includes('getActiveState(item, dropdownPanelId)'), true);
  assert.equal(dropdownBlock.includes('this.controllerMenu.isFocusedItem(dropdownPanelId, item.id, index)'), true);
  assert.equal(dropdownBlock.includes('renderItem: ({ item, index, bounds, active, focused }) => {'), true);
  assert.equal(dropdownBlock.includes("typeof item.onSelect === 'function' ? () => item.onSelect(this) : null"), true);
  assert.equal(dropdownBlock.includes("preview,"), true);
  assert.equal(dropdownBlock.includes('Boolean(item.disabled)'), true);
  assert.equal(dropdownBlock.includes('createDesktopDropdownCommandHit('), true);
  assert.equal(dropdownBlock.includes('sourceRootId: dropdownRootId || null'), true);
  assert.equal(levelEditorSource.includes('}, { tile }))'), true);
  assert.equal(levelEditorSource.includes('}, { enemy }))'), true);
  assert.equal(levelEditorSource.includes('}, { prefab }))'), true);
  assert.equal(drawButtonBlock.includes('disabled = false'), true);
  assert.equal(drawButtonBlock.includes('metadata = {}'), true);
  assert.equal(drawButtonBlock.includes('subtle: Boolean(disabled)'), true);
  assert.equal(drawButtonBlock.includes('color: disabled ? UI_SUITE.colors.muted'), true);
  assert.equal(drawButtonBlock.includes('if (!disabled) this.addUIButton(bounds, onClick, tooltip, metadata);'), true);
});

test('Level desktop dropdown commands only fire on release', () => {
  const pointerDownIndex = levelEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = levelEditorSource.slice(pointerDownIndex, levelEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const pointerMoveIndex = levelEditorSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = levelEditorSource.slice(pointerMoveIndex, levelEditorSource.indexOf('  handlePointerUp(payload = {})', pointerMoveIndex));
  const pointerUpIndex = levelEditorSource.indexOf('  handlePointerUp(payload = {})');
  const pointerUpBody = levelEditorSource.slice(pointerUpIndex, levelEditorSource.indexOf('  handleWheel(payload)', pointerUpIndex));
  const handleClickIndex = levelEditorSource.indexOf('  handleUIClick(x, y)');
  const handleClickBody = levelEditorSource.slice(handleClickIndex, levelEditorSource.indexOf('  isPointInBounds(x, y, bounds)', handleClickIndex));

  assert.ok(pointerDownIndex >= 0);
  assert.ok(pointerMoveIndex > pointerDownIndex);
  assert.ok(pointerUpIndex > pointerMoveIndex);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, payload);'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.onClick?.();'), false);
  assert.equal(pointerMoveBody.includes('this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);'), true);
  assert.equal(pointerUpBody.includes('if (this.pendingDesktopDropdownHit) {'), true);
  assert.equal(pointerUpBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, { x, y });'), true);
  assert.equal(pointerUpBody.includes('if (shouldActivate) {'), true);
  assert.equal(pointerUpBody.includes('hit.onClick?.();'), true);
  assert.equal(pointerUpBody.includes('const nextDropdown = resolveClosedDesktopDropdownState({'), true);
  assert.equal(pointerUpBody.includes('this.desktopDropdown = nextDropdown.dropdown;'), true);
  assert.equal(handleClickBody.includes('if (button.desktopDropdownItem) continue;'), true);
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
  assert.deepEqual(midiModel.bottomRailActions, ['menu', 'undo', 'redo', 'play']);
  assert.deepEqual(sfxModel.bottomRailActions, ['menu', 'undo', 'redo', 'play']);
  assertSharedPortraitRailActionCount(midiModel.bottomRailActions.map((id) => ({ id })), { editor: 'midi' });
  assertSharedPortraitRailActionCount(sfxModel.bottomRailActions.map((id) => ({ id })), { editor: 'sfx' });
  assert.equal(midiModel.bottomRailActions.some((id) => id.toLowerCase().includes('loop')), false);
  assert.equal(sfxModel.bottomRailActions.some((id) => id.toLowerCase().includes('loop')), false);
  assert.equal(midiEditorSource.includes("menu: { id: 'menu', boundsKey: 'fileButton'"), true);
  assert.equal(midiEditorSource.includes("undo: { id: 'undo', boundsKey: 'undoButton'"), true);
  assert.equal(midiEditorSource.includes("redo: { id: 'redo', boundsKey: 'redoButton'"), true);
  assert.equal(midiEditorSource.includes('this.bounds[button.boundsKey || button.id] = bounds;'), true);
  assert.equal(midiEditorSource.includes('buildMidiPortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean)'), true);
  assert.equal(midiEditorSource.includes("if (this.activeViewportMode === 'desktop') {\n        this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);\n      } else {\n        this.activateLeftRailTab(tabHit.id);\n      }"), true);
  assert.equal(midiEditorSource.includes('if (this.isMobileLayout()) {\n        this.activateLeftRailTab(tabHit.id);\n      } else {\n        this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);\n      }'), false);
  assert.equal(midiEditorSource.includes('drawMidiPortraitGridQuickStrip(ctx, x, y, w, h, track)'), true);
  assert.equal(midiEditorSource.includes('drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(midiEditorSource.includes('drawSharedPanel(ctx, bounds, { fill: this.editorShellTheme.surfaceAlt, border: UI_SUITE.colors.border });'), false);
  assert.equal(midiEditorSource.includes("drawSharedPortraitMultiRowTabStrip(ctx, bounds, items, {\n      activeId: this.song.loopEnabled ? 'loop' : null,"), true);
  assert.equal(midiEditorSource.includes("rowHeight: 42,\n      gap: 6,\n      padding: 6,\n      verticalAlign: 'bottom',"), true);
  assert.equal(sfxEditorSource.includes('buildSfxPortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean)'), true);
  assert.ok(midiModel.menuLoopIds.length > 0);
  assert.ok(sfxModel.menuLoopIds.length > 0);
});

test('SFX portrait starts on a compact Generate workflow', () => {
  const constructorIndex = sfxEditorSource.indexOf('  constructor(game)');
  const constructorBody = sfxEditorSource.slice(constructorIndex, sfxEditorSource.indexOf('  isMobileLayout()', constructorIndex));
  const newDocumentIndex = sfxEditorSource.indexOf('  async newDocument()');
  const newDocumentBody = sfxEditorSource.slice(newDocumentIndex, sfxEditorSource.indexOf('  async save(', newDocumentIndex));
  const bottomRailIndex = sfxEditorSource.indexOf('  drawBottomRail(ctx, bounds)');
  const bottomRailBody = sfxEditorSource.slice(bottomRailIndex, sfxEditorSource.indexOf('  drawGeneratePanel(ctx, bounds, y)', bottomRailIndex));
  const generateIndex = sfxEditorSource.indexOf('  drawGeneratePanel(ctx, bounds, y)');
  const generateBody = sfxEditorSource.slice(generateIndex, sfxEditorSource.indexOf('  drawCustomWaveEditor(ctx, bounds)', generateIndex));
  const drawIndex = sfxEditorSource.indexOf('  draw(ctx, width, height)');
  const portraitDrawBody = sfxEditorSource.slice(
    sfxEditorSource.indexOf('if (isMobilePortrait)', drawIndex),
    sfxEditorSource.indexOf('    if (!isMobileViewport)', drawIndex)
  );

  assert.equal(constructorBody.includes("this.leftTab = 'generate';"), true);
  assert.equal(newDocumentBody.includes("this.leftTab = 'generate';"), true);
  assert.equal(bottomRailBody.includes("this.leftTab = 'generate';"), true);
  assert.equal(bottomRailBody.includes('this.controllerMenu.resetFocus();'), true);
  assert.equal(bottomRailBody.includes("this.controllerMenu.scroll = { ...(this.controllerMenu.scroll || {}), root: 0 };"), true);
  assert.equal(generateBody.includes("if (this.isMobilePortrait) {"), true);
  assert.equal(generateBody.includes("ctx.fillText('Pick a wave, then Generate.'"), true);
  assert.equal(generateBody.includes('const columns = 2;'), true);
  assert.equal(generateBody.includes('waves.forEach((wave, index) => {'), true);
  assert.equal(generateBody.includes("const mobileCustomWave = this.isMobilePortrait && this.sfx.toolOptions.generateWave === 'custom';"), true);
  assert.equal(generateBody.includes('if (mobileCustomWave) {'), true);
  assert.equal(generateBody.includes("if (this.sfx.toolOptions.generateWave === 'custom' && !mobileCustomWave) {"), true);
  assert.equal(portraitDrawBody.includes('if (isMobilePortrait) {'), true);
  assert.equal(portraitDrawBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(portraitDrawBody.includes('this.drawBottomRail(ctx, layout.middleRail);'), true);
  assert.equal(portraitDrawBody.includes('this.drawMobilePanJoystick(ctx, width, height);'), false);
});

test('SFX portrait root menu uses a Pixel-style bottom multi-row rail', () => {
  const layout = buildSfxPortraitEditorLayout(390, 844);
  const model = buildSfxPortraitMenuModel();
  const tabLayout = getSharedPortraitMultiRowTabLayout(layout.rootRail, model.rootTabs, {
    minButtonWidth: 64,
    maxButtonWidth: 116,
    maxRows: 2,
    balanceLastRow: true,
    verticalAlign: 'bottom'
  });
  const drawLeftRailIndex = sfxEditorSource.indexOf('  drawLeftRail(ctx, x, y, w, h)');
  const drawLeftRailBody = sfxEditorSource.slice(drawLeftRailIndex, sfxEditorSource.indexOf('  drawWaveform(ctx, bounds)', drawLeftRailIndex));

  assert.equal(layout.rootRail.y, layout.menuSheet.y + layout.menuSheet.h - layout.rootRail.h);
  assert.equal(layout.portraitRootPlacement, 'bottom-rail');
  assert.ok(layout.rootRail.h >= 96);
  assert.equal(tabLayout.rows, 2);
  assert.equal(tabLayout.fits, true);
  assert.equal(sfxEditorSource.includes('this.drawLeftRail(ctx, layout.rootTabs.x, layout.rootTabs.y, layout.rootTabs.w, layout.rootTabs.h);'), true);
  assert.equal(sfxEditorSource.includes('this.drawRightPanel(ctx, layout.subRail);'), true);
  assert.equal(drawLeftRailBody.includes('drawSharedPortraitMultiRowTabStrip(ctx, { x, y, w, h }, tabs, {'), true);
  assert.equal(drawLeftRailBody.includes("verticalAlign: 'bottom'"), true);
  assert.equal(drawLeftRailBody.includes('drawSharedPortraitTabStrip(ctx, { x, y, w, h }, tabs'), false);
});

test('SFX portrait Generate panel clips and scrolls inside the menu sheet', () => {
  const panelIndex = sfxEditorSource.indexOf('  drawRightPanel(ctx, bounds)');
  const panelBody = sfxEditorSource.slice(panelIndex, sfxEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', panelIndex));

  assert.equal(panelBody.includes('const clipMenuPanel = this.isMobilePortrait || this.isMobileLandscape;'), true);
  assert.equal(panelBody.includes('includeDesktopTransport'), false);
  assert.equal(panelBody.includes("if (this.leftTab === 'view') y = this.drawControllerMenuPanel(ctx, 'view', panelBounds, y);"), true);
  assert.equal(panelBody.includes("const scrollableGenerate = clipMenuPanel && this.leftTab === 'generate';"), true);
  assert.equal(panelBody.includes('ctx.rect(panelBounds.x, panelBounds.y, panelBounds.w, panelBounds.h);'), true);
  assert.equal(panelBody.includes('ctx.clip();'), true);
  assert.equal(panelBody.includes('this.activeMenuClipBounds = { ...panelBounds };'), true);
  assert.equal(panelBody.includes('this.activeMenuClipBounds = null;'), true);
  assert.equal(sfxEditorSource.includes('shouldRegisterControlBounds(bounds)'), true);
  assert.equal(sfxEditorSource.includes('if (action && this.shouldRegisterControlBounds(controlBounds))'), true);
  assert.equal(sfxEditorSource.includes('drawSharedContextRibbon'), true);
  assert.equal(panelBody.includes("this.menuScrollRegions.push({\n        menuId: 'generate',"), true);
  assert.equal(panelBody.includes('drawSharedPortraitScrollHints(ctx, panelBounds'), true);
});

test('SFX settings, envelope, and action labels use shared RTG Studio text tokens', () => {
  const settingsIndex = sfxEditorSource.indexOf('  drawSettingsPanel(ctx, bounds, y)');
  const settingsBody = sfxEditorSource.slice(settingsIndex, sfxEditorSource.indexOf('  drawEnvelopesPanel(ctx, bounds, y)', settingsIndex));
  const envelopesIndex = sfxEditorSource.indexOf('  drawEnvelopesPanel(ctx, bounds, y)');
  const envelopesBody = sfxEditorSource.slice(envelopesIndex, sfxEditorSource.indexOf('  drawGeneratePanel(ctx, bounds, y)', envelopesIndex));
  const actionRailIndex = sfxEditorSource.indexOf('  drawBottomRail(ctx, bounds)');
  const actionRailBody = sfxEditorSource.slice(actionRailIndex, sfxEditorSource.indexOf('  drawTransportPopover(ctx)', actionRailIndex));

  assert.ok(settingsIndex > 0);
  assert.ok(envelopesIndex > settingsIndex);
  assert.ok(actionRailIndex > 0);
  for (const body of [settingsBody, envelopesBody, actionRailBody]) {
    assert.equal(body.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
    assert.equal(body.includes("ctx.fillStyle = 'rgba(255,255,255,0.72)';"), false);
  }
  assert.equal(settingsBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(envelopesBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(actionRailBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(settingsBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(envelopesBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(actionRailBody.includes("ctx.font = '12px Courier New';"), false);
});

test('SFX waveform and custom wave editor use shared RTG Studio panel chrome', () => {
  const waveformIndex = sfxEditorSource.indexOf('  drawWaveform(ctx, bounds)');
  const waveformBody = sfxEditorSource.slice(waveformIndex, sfxEditorSource.indexOf('  getSelectedLayerLane(bounds)', waveformIndex));
  const customWaveIndex = sfxEditorSource.indexOf('  drawCustomWaveEditor(ctx, bounds)');
  const customWaveBody = sfxEditorSource.slice(customWaveIndex, sfxEditorSource.indexOf('  getCustomWavePointAt(x, y)', customWaveIndex));

  assert.ok(waveformIndex > 0);
  assert.ok(customWaveIndex > waveformIndex);
  assert.equal(waveformBody.includes('drawSharedPanel(ctx, wave, {'), true);
  assert.equal(waveformBody.includes('drawSharedPanel(ctx, { x: bounds.x + 12, y: layerY, w: bounds.w - 24, h: 42 }, {'), true);
  assert.equal(waveformBody.includes('drawSharedPanel(ctx, { x: bounds.x + 12, y: stripY, w: bounds.w - 24, h: 46 }, {'), true);
  assert.equal(waveformBody.includes('fill: UI_SUITE.colors.panel,'), true);
  assert.equal(waveformBody.includes('border: UI_SUITE.colors.border'), true);
  assert.equal(waveformBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.04)';"), false);
  assert.equal(waveformBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.08)';"), false);
  assert.equal(customWaveBody.includes('drawSharedPanel(ctx, bounds, {'), true);
  assert.equal(customWaveBody.includes('fill: UI_SUITE.colors.panel,'), true);
  assert.equal(customWaveBody.includes('border: UI_SUITE.colors.border'), true);
  assert.equal(customWaveBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.055)';"), false);
  assert.equal(customWaveBody.includes("ctx.strokeStyle = 'rgba(255,255,255,0.22)';\n    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);"), false);
});

test('audio editor shared roots expose desktop and landscape menu ids', () => {
  const midi = buildMidiSharedRootMenuEntries();
  const sfx = buildSfxSharedRootMenuEntries();

  assert.deepEqual(midi.map((tab) => tab.id), ['file', 'edit', 'view', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings']);
  assert.equal(midi.find((tab) => tab.id === 'instruments')?.specId, 'tracks');
  assert.equal(midi.find((tab) => tab.id === 'virtual-instruments')?.specId, 'record');
  assert.deepEqual(sfx.map((tab) => tab.id), ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings']);
  assert.equal(midi.some((tab) => tab.id === 'undo' || tab.id === 'redo'), false);
  assert.equal(sfx.some((tab) => tab.id === 'undo' || tab.id === 'redo'), false);
  assert.equal(midiEditorSource.includes('includeUndoRedo'), false);
  assert.equal(sfxEditorSource.includes('includeUndoRedo'), false);
});

test('SFX gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const drawIndex = sfxEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBodyStart = sfxEditorSource.indexOf('const gamepadMenuState = this.getGamepadMenuState(width, height);', drawIndex);
  const drawBody = sfxEditorSource.slice(drawBodyStart, sfxEditorSource.indexOf('    if (gamepadMenuState.drawControllerOverlay) {', drawBodyStart));
  const gamepadStateIndex = sfxEditorSource.indexOf('  getGamepadMenuState(width = 0, height = 0) {');
  const gamepadStateBody = sfxEditorSource.slice(gamepadStateIndex, sfxEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)', gamepadStateIndex));

  assert.equal(sfxEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(sfxEditorSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(sfxEditorSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(sfxEditorSource.includes('  resolveSfxViewportMode(width = this.game?.canvas?.width || 0, height = this.game?.canvas?.height || 0) {'), true);
  assert.equal(sfxEditorSource.includes('this.isGamepadMenuMode = viewportMode.isGamepadLandscape;'), true);
  assert.equal(sfxEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width = 0, height = 0)'), true);
  assert.equal(sfxEditorSource.includes('return this.getGamepadMenuState(width, height).drawSlideOut;'), true);
  assert.equal(sfxEditorSource.includes('const viewportMode = this.resolveSfxViewportMode(width, height);'), true);
  assert.equal(gamepadStateBody.includes('isMobile: viewportMode.isMobileViewport,'), true);
  assert.equal(gamepadStateBody.includes('isMobile: this.isMobileLayout()'), false);
  assert.equal(sfxEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, left);'), true);
  assert.equal(drawBody.includes('const gamepadMenuState = this.getGamepadMenuState(width, height);'), true);
  assert.equal(drawBody.includes('const gamepadSubmenuOnLeft = gamepadMenuState.drawSlideOut;'), true);
  assert.equal(drawBody.includes('reserveRightRail: !gamepadSubmenuOnLeft'), true);
  assert.equal(drawBody.includes("const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(landscapeLayout, 'right-drawer')"), true);
  assert.equal(drawBody.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(drawBody.includes('landscapeLayout?.surfaces.rootMenu'), true);
  assert.equal(drawBody.includes('landscapeLayout?.surfaces.submenu'), true);
  assert.equal(drawBody.includes('const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu ? landscapeLayout?.surfaces.submenu : null;'), true);
  assert.equal(drawBody.includes('const landscapeOverlayDrawerSurface = canRenderLandscapeRootDrawer ? landscapeLayout?.surfaces.overlayDrawer : null;'), true);
  assert.equal(drawBody.includes('const landscapeRootDrawerSurface = canRenderLandscapeRootDrawer ? landscapeLayout?.surfaces.rootDrawer : null;'), true);
  assert.equal(drawBody.includes('const activeDrawerSurface = landscapeSubmenuSurface ?? landscapeOverlayDrawerSurface;'), true);
  assert.equal(drawBody.includes('const rightW = activeDrawerSurface?.w ??'), true);
  assert.equal(drawBody.includes('const right = activeDrawerSurface ??'), true);
  assert.equal(drawBody.includes('landscapeLayout?.surfaces.toolOptions'), true);
  assert.equal(drawBody.includes('landscapeLayout?.surfaces.workSurface'), true);
  assert.equal(drawBody.includes('if (gamepadSubmenuOnLeft) {'), true);
  assert.equal(drawBody.includes('if (!gamepadSubmenuOnLeft && this.landscapeRootDrawerOpen && landscapeRootDrawerSurface) {'), true);
  assert.equal(drawBody.includes('if (!gamepadSubmenuOnLeft && right.w > 0) {'), true);
  assert.equal(drawBody.includes("|| !canRenderEditorSurface(viewportMode.mode, 'touch-thumbstick');"), true);
  assert.equal(drawBody.includes('if (suppressLandscapeThumbstick) {\n      resetSharedThumbstickState(this.panJoystick);\n    } else {\n      this.drawMobilePanJoystick(ctx, width, height);\n    }'), true);
  assert.equal(drawBody.includes('this.drawGamepadRightOptionsPanel(ctx, right);'), false);
  assert.equal(sfxEditorSource.includes('drawGamepadRightOptionsPanel'), false);
  assert.equal(sfxEditorSource.includes("const activeMenuId = menuId || this.controllerMenu.rootId || 'root';"), true);
  assert.equal(sfxEditorSource.includes('const controllerMenus = this.controllerMenu.menus?.root ? this.controllerMenu.menus : this.buildControllerMenus();'), true);
  assert.equal(sfxEditorSource.includes('if (item.submenu) {\n            item.onEnter?.(this);\n            this.controllerMenu.openSubmenu(item.submenu);'), true);
  assert.equal(sfxEditorSource.includes('menuId: activeMenuId'), true);
  assert.equal(sfxEditorSource.includes('return this.getGamepadMenuState(width, height).drawControllerOverlay;'), true);
  assert.equal(sfxEditorSource.includes('if (gamepadMenuState.drawControllerOverlay) {'), true);
});

test('SFX mobile rails and drawers support gesture drag scrolling', () => {
  assert.equal(sfxEditorSource.includes('this.menuScrollRegions = [];'), true);
  assert.equal(sfxEditorSource.includes('if (this.startMenuScrollDrag(payload)) return;'), true);
  assert.equal(sfxEditorSource.includes('buildMenuScrollDragState'), true);
  assert.equal(sfxEditorSource.includes('resolveMenuScrollDrag'), true);
  assert.equal(sfxEditorSource.includes('this.controllerMenu.scroll[nextDrag.menuId] = nextDrag.nextScroll;'), true);
  assert.equal(sfxEditorSource.includes('if (!drag.moved) drag.pendingHit?.action?.();'), true);
  assert.equal(sfxEditorSource.includes("const SFX_CONTROLLER_ROOTS = getEditorControllerRootMenuIds('sfx');"), true);
  assert.equal(sfxEditorSource.includes('siblingOrder: SFX_CONTROLLER_ROOTS'), true);
  assert.equal(sfxEditorSource.includes('items: SFX_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem(entry.id, entry.label))'), true);
  assert.equal(sfxEditorSource.includes('export function buildSfxSharedRootMenuEntries()'), true);
  assert.equal(sfxEditorSource.includes("menuId: 'root'"), true);
  assert.equal(sfxEditorSource.includes("menuId: 'file'"), true);
  assert.equal(sfxEditorSource.includes("menuId: 'layers'"), true);
});

test('SFX mobile landscape uses compact left rail and all-visible root drawer', () => {
  const leftRailIndex = sfxEditorSource.indexOf('  drawLeftRail(ctx, x, y, w, h)');
  const leftRailBody = sfxEditorSource.slice(leftRailIndex, sfxEditorSource.indexOf('  drawWaveform(ctx, bounds)', leftRailIndex));
  const rightPanelIndex = sfxEditorSource.indexOf('  drawRightPanel(ctx, bounds)');
  const rightPanelBody = sfxEditorSource.slice(rightPanelIndex, sfxEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', rightPanelIndex));
  const bottomRailIndex = sfxEditorSource.indexOf('  drawBottomRail(ctx, bounds)');
  const bottomRailBody = sfxEditorSource.slice(bottomRailIndex, sfxEditorSource.indexOf('  drawTransportPopover(ctx)', bottomRailIndex));

  assert.equal(sfxEditorSource.includes('buildCompactLandscapeCommandRailActions'), true);
  assert.equal(sfxEditorSource.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(sfxEditorSource.includes('this.landscapeRootDrawerOpen = false;'), true);
  assert.equal(sfxEditorSource.includes('if (!isMobileLandscape || gamepadSubmenuOnLeft) this.landscapeRootDrawerOpen = false;'), true);
  assert.equal(sfxEditorSource.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(leftRailBody.includes('if (this.isMobileLandscape) {'), true);
  assert.equal(leftRailBody.includes("id: 'menu'"), true);
  assert.equal(leftRailBody.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(leftRailBody.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(leftRailBody.includes("id: 'play'"), true);
  assert.equal(rightPanelBody.includes('if (this.isMobileLandscape && this.landscapeRootDrawerOpen) {'), false);
  assert.equal(rightPanelBody.includes('this.drawLandscapeRootDrawer(ctx, panelBounds);'), false);
  assert.equal(sfxEditorSource.includes("const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(landscapeLayout, 'right-drawer')"), true);
  assert.equal(sfxEditorSource.includes("&& canRenderEditorPlanSurface(landscapeLayout, 'landscape-right-submenu');"), true);
  assert.equal(sfxEditorSource.includes("const canRenderLandscapeBottomRail = canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail');"), true);
  assert.equal(sfxEditorSource.includes("const canRenderLandscapeRootDrawer = canRenderEditorPlanSurface(landscapeLayout, 'left-overlay-drawer')"), true);
  assert.equal(sfxEditorSource.includes("canRenderEditorPlanSurface(landscapeLayout, 'right-overlay-drawer')"), false);
  assert.equal(sfxEditorSource.includes('const landscapeOverlayDrawerSurface = canRenderLandscapeRootDrawer ? landscapeLayout?.surfaces.overlayDrawer : null;'), true);
  assert.equal(sfxEditorSource.includes('const landscapeRootDrawerSurface = canRenderLandscapeRootDrawer ? landscapeLayout?.surfaces.rootDrawer : null;'), true);
  assert.equal(sfxEditorSource.includes('reserveRightRail: !gamepadSubmenuOnLeft'), true);
  assert.equal(sfxEditorSource.includes('reserveRightRail: !gamepadSubmenuOnLeft && !this.landscapeRootDrawerOpen'), false);
  assert.equal(sfxEditorSource.includes('const activeDrawerSurface = landscapeSubmenuSurface ?? landscapeOverlayDrawerSurface;'), true);
  assert.equal(sfxEditorSource.includes('if (!gamepadSubmenuOnLeft && this.landscapeRootDrawerOpen && landscapeRootDrawerSurface) {'), true);
  assert.equal(sfxEditorSource.includes('if (bottom.h > 0 && canRenderLandscapeBottomRail)'), true);
  assert.equal(sfxEditorSource.includes("|| !canRenderEditorSurface(viewportMode.mode, 'touch-thumbstick');"), true);
  assert.equal(sfxEditorSource.includes('if (suppressLandscapeThumbstick) {\n      resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(sfxEditorSource.includes("|| !canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(sfxEditorSource.includes('if (!suppressLandscapeMenuThumbstick && pointerPolicy.thumbstick.allowed'), true);
  assert.equal(sfxEditorSource.includes('const right = activeDrawerSurface ??'), true);
  assert.equal(sfxEditorSource.includes('  drawLandscapeRootDrawer(ctx, panelBounds)'), true);
  assert.equal(sfxEditorSource.includes('const tabs = buildSfxSharedRootMenuEntries();'), true);
  assert.equal(sfxEditorSource.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(sfxEditorSource.includes('grid.items.forEach(({ index, bounds }) => {'), true);
  assert.equal(sfxEditorSource.includes('const scrolledGrid = buildScrolledLandscapeRootDrawerItems(grid, this.controllerMenu.scroll.root || 0);'), false);
  assert.equal(sfxEditorSource.includes('this.controllerMenu.scroll.root = 0;'), true);
  assert.equal(sfxEditorSource.includes('scrolledGrid.items.forEach(({ index, bounds }) => {'), false);
  assert.equal(sfxEditorSource.includes('maxScroll: scrolledGrid.maxScroll,'), false);
  assert.equal(sfxEditorSource.includes('tabs.slice(start, start + visibleRows).forEach((tab, index) => {'), false);
  assert.equal(sfxEditorSource.includes("menuId: 'root',\n      bounds: grid.listBounds,"), false);
  const rootDrawerIndex = sfxEditorSource.indexOf('  drawLandscapeRootDrawer(ctx, panelBounds)');
  const rootSelectBody = sfxEditorSource.slice(rootDrawerIndex, sfxEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', rootDrawerIndex));
  assert.equal(rootSelectBody.includes('this.landscapeRootDrawerOpen = true;'), true);
  assert.equal(rootSelectBody.includes('this.landscapeRootDrawerOpen = false;'), false);
  assert.equal(bottomRailBody.includes("{ label: '☰', action: () => { this.leftTab = this.leftTab === 'timeline' ? 'file' : 'timeline'; } }"), false);
  assert.equal(bottomRailBody.includes("{ label: '⏮'"), true);
  assert.equal(bottomRailBody.includes("{ label: '⏹'"), true);
});

test('SFX Edit drawer disables unavailable layer actions instead of showing dead buttons', () => {
  const editItemsIndex = sfxEditorSource.indexOf('  getSfxEditMenuItems()');
  const editItemsBody = sfxEditorSource.slice(editItemsIndex, sfxEditorSource.indexOf('  drawFilePanel(ctx, bounds, y)', editItemsIndex));
  const controllerIndex = sfxEditorSource.indexOf('  buildControllerMenus()');
  const controllerBody = sfxEditorSource.slice(controllerIndex, sfxEditorSource.indexOf('  enter()', controllerIndex));

  assert.equal(editItemsBody.includes('const hasLayer = Boolean(this.selectedLayer);'), true);
  assert.equal(editItemsBody.includes('const hasClipboard = Boolean(this.layerClipboard);'), true);
  assert.equal(editItemsBody.includes("id: 'copy', label: 'Copy', disabled: !hasLayer"), true);
  assert.equal(editItemsBody.includes("id: 'cut', label: 'Cut', disabled: !hasLayer"), true);
  assert.equal(editItemsBody.includes("id: 'paste', label: 'Paste', disabled: !hasClipboard"), true);
  assert.equal(editItemsBody.includes("id: 'delete', label: 'Delete', disabled: !hasLayer"), true);
  assert.equal(controllerBody.includes('disabled: Boolean(item.disabled)'), true);
});

test('SFX desktop keeps transport in the left column instead of a bottom rail', () => {
  const desktopIndex = sfxEditorSource.indexOf('if (!isMobileViewport) {');
  const desktopBlock = sfxEditorSource.slice(desktopIndex, sfxEditorSource.indexOf('const landscapeLayout = isMobileLandscape', desktopIndex));
  const waveformIndex = sfxEditorSource.indexOf('  drawWaveform(ctx, bounds)');
  const waveformBody = sfxEditorSource.slice(waveformIndex, sfxEditorSource.indexOf('  drawWavePreview(ctx, frame, layer, bounds)', waveformIndex));
  const wavePreviewIndex = sfxEditorSource.indexOf('  drawWavePreview(ctx, frame, layer, bounds)');
  const wavePreviewBody = sfxEditorSource.slice(wavePreviewIndex, sfxEditorSource.indexOf('  getSelectedLayerLane(bounds)', wavePreviewIndex));
  const timelineIndex = sfxEditorSource.indexOf('  drawTimeline(ctx, frame, bounds)');
  const timelineBody = sfxEditorSource.slice(timelineIndex, sfxEditorSource.indexOf('  drawClipWavePreview(ctx, layer, bounds)', timelineIndex));
  const desktopPanelIndex = sfxEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds)');
  const desktopPanelBody = sfxEditorSource.slice(desktopPanelIndex, sfxEditorSource.indexOf('  drawRightPanel(ctx, bounds)', desktopPanelIndex));
  const mobilePanelIndex = sfxEditorSource.indexOf('  drawRightPanel(ctx, bounds)');
  const mobilePanelBody = sfxEditorSource.slice(mobilePanelIndex, sfxEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', mobilePanelIndex));
  const transportPanelIndex = sfxEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)');
  const transportPanelBody = sfxEditorSource.slice(transportPanelIndex, sfxEditorSource.indexOf('  getPanelRowHeight()', transportPanelIndex));
  const ribbonIndex = sfxEditorSource.indexOf('  drawDesktopRibbon(ctx, bounds)');
  const ribbonBody = sfxEditorSource.slice(ribbonIndex, sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)', ribbonIndex));
  const dropdownIndex = sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)');
  const dropdownBody = sfxEditorSource.slice(dropdownIndex, sfxEditorSource.indexOf('  getActiveGamepadMenuId()', dropdownIndex));
  const pointerDownIndex = sfxEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = sfxEditorSource.slice(pointerDownIndex, sfxEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));

  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('this.drawBottomRail(ctx, shell.bottomBar)'), false);
  assert.equal(desktopBlock.includes('resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(desktopBlock.includes('this.drawDesktopLeftOptions(ctx, shell.leftOptions);'), true);
  assert.equal(desktopBlock.includes('this.drawRightPanel(ctx, shell.leftOptions'), false);
  assert.equal(sfxEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
  assert.equal(sfxEditorSource.includes("const SFX_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('sfx');"), true);
  assert.equal(ribbonBody.includes('const section = SFX_CONTROLLER_ROOT_LABELS[this.leftTab] || this.leftTab;'), true);
  assert.equal(ribbonBody.includes("this.leftTab[0]?.toUpperCase() + this.leftTab.slice(1)"), false);
  assert.equal(desktopPanelBody.includes('buildSharedDesktopContextTransportLayout(bounds, {'), true);
  assert.equal(desktopPanelBody.includes('includeTransport: true,'), true);
  assert.equal(desktopPanelBody.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(desktopPanelBody.includes('const activeLabel = SFX_CONTROLLER_ROOT_LABELS[this.leftTab] || this.leftTab;'), true);
  assert.equal(desktopPanelBody.includes('`Active: ${activeLabel}`'), true);
  assert.equal(desktopPanelBody.includes('const frame = this.selectedFrame;'), true);
  assert.equal(desktopPanelBody.includes('const layer = this.selectedLayer;'), true);
  assert.equal(desktopPanelBody.includes('if (transportBounds) this.drawDesktopTransportPanel(ctx, transportBounds);'), true);
  assert.equal(desktopPanelBody.includes('Math.min(118, Math.max(96'), false);
  assert.equal(transportPanelBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(transportPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(transportPanelBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(transportPanelBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(waveformBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(waveformBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(waveformBody.includes('ctx.font = `15px ${UI_SUITE.font.family}`;'), true);
  assert.equal(waveformBody.includes("ctx.font = '15px Courier New';"), false);
  assert.equal(wavePreviewBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(wavePreviewBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(wavePreviewBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(timelineBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(timelineBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(timelineBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(mobilePanelBody.includes('includeDesktopTransport'), false);
  assert.equal(mobilePanelBody.includes('drawDesktopTransportPanel'), false);
  assert.equal(dropdownBody.includes('const controllerMenus = this.buildControllerMenus();'), true);
  assert.equal(dropdownBody.includes('const menu = controllerMenus[dropdown.rootId] || controllerMenus[dropdown.specId] || this.controllerMenu.menus?.[dropdown.rootId] || this.controllerMenu.menus?.[dropdown.specId];'), true);
  assert.equal(dropdownBody.includes('const dropdownPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(dropdownBody.includes('disableActionlessItems: true'), true);
  assert.equal(dropdownBody.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(dropdownBody.includes('const controllerItem = dropdownPlan.actionById.get(item.id);'), true);
  assert.equal(dropdownBody.includes("registerButton: ({ item, bounds }) => {"), true);
  assert.equal(dropdownBody.includes('this.desktopDropdownItems.push(createDesktopDropdownCommandHit(item, bounds, invokeAction));'), true);
  assert.equal(dropdownBody.includes('this.buttons.push({ ...bounds, kind: \'button\', action: () => this.invokeWithHistory(action) });'), false);
  assert.equal(sfxEditorSource.includes('getEditorPointerInteractionPolicy'), true);
  assert.equal(pointerDownBody.includes("getEditorPointerInteractionPolicy('sfx'"), true);
  assert.equal(pointerDownBody.includes("|| !canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(pointerDownBody.includes('if (!suppressLandscapeMenuThumbstick && pointerPolicy.thumbstick.allowed && payload.touchCount > 0 && this.panJoystick.radius > 0)'), true);
  assert.equal(pointerDownBody.includes('if ((this.isMobileLandscape || this.isMobilePortrait) && payload.touchCount > 0 && this.panJoystick.radius > 0)'), false);
});

test('SFX desktop dropdown commands only fire on release', () => {
  const pointerDownIndex = sfxEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = sfxEditorSource.slice(pointerDownIndex, sfxEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const pointerMoveIndex = sfxEditorSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = sfxEditorSource.slice(pointerMoveIndex, sfxEditorSource.indexOf('  handlePointerUp(payload = {})', pointerMoveIndex));
  const pointerUpIndex = sfxEditorSource.indexOf('  handlePointerUp(payload = {})');
  const pointerUpBody = sfxEditorSource.slice(pointerUpIndex, sfxEditorSource.indexOf('  getEnvelopeAt', pointerUpIndex));

  assert.ok(pointerDownIndex >= 0);
  assert.ok(pointerMoveIndex > pointerDownIndex);
  assert.ok(pointerUpIndex > pointerMoveIndex);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, payload);'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.action?.();'), false);
  assert.equal(pointerMoveBody.includes('this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);'), true);
  assert.equal(pointerUpBody.includes('if (this.pendingDesktopDropdownHit) {'), true);
  assert.equal(pointerUpBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, payload);'), true);
  assert.equal(pointerUpBody.includes('if (shouldActivate) {'), true);
  assert.equal(pointerUpBody.includes('hit.action?.();'), true);
  assert.equal(pointerUpBody.includes('const nextDropdown = resolveClosedDesktopDropdownState({'), true);
  assert.equal(pointerUpBody.includes('this.desktopDropdown = nextDropdown.dropdown;'), true);
});

test('SFX desktop drawers avoid duplicate open-current-panel rows and settings commands', () => {
  const controllerIndex = sfxEditorSource.indexOf('  buildControllerMenus()');
  const controllerBody = sfxEditorSource.slice(controllerIndex, sfxEditorSource.indexOf('  resetTransientInteractionState()', controllerIndex));

  assert.equal(controllerBody.includes("action('open-generate', 'Open Generate Panel'"), false);
  assert.equal(controllerBody.includes("action('open-settings', 'Open Settings'"), false);
  assert.equal(editorMenuSpecSource.includes("generate: section('generate', 'Generate', ['open-generate'"), false);
  assert.equal(controllerBody.includes("id: 'generate',\n        title: 'Generate',\n        items: [\n          action('generate', 'Generate'"), true);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: []"), true);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: [\n          action('loop'"), false);
  assert.equal(editorMenuSpecSource.includes("settings: section('settings', 'Settings', ['loop'"), false);
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
  assert.equal(fileItemsBody.includes('undo: false'), false);
  assert.equal(fileItemsBody.includes('redo: false'), false);
  assert.equal(sfxEditorSource.includes('items: SFX_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem(entry.id, entry.label))'), true);
  assert.equal(sfxEditorSource.includes("edit: {\n        id: 'edit',\n        title: 'Edit',\n        items: this.getSfxEditMenuItems().map((item) => action(item.id, item.label, item.onClick, {\n          disabled: Boolean(item.disabled)\n        }))\n      }"), true);
  assert.equal(sfxEditorSource.includes("if (this.leftTab === 'edit') y = this.drawEditPanel(ctx, panelBounds, y);"), true);
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
  assert.equal(midiEditorSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(midiEditorSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(midiEditorSource.includes('  resolveMidiViewportMode(width = this.viewportWidth || 0, height = this.viewportHeight || 0) {'), true);
  assert.equal(midiEditorSource.includes('const viewportMode = this.resolveMidiViewportMode(width, height);'), true);
  assert.equal(midiEditorSource.includes('const isMobile = viewportMode.isMobileViewport;'), true);
  assert.equal(midiEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(midiEditorSource.includes('const gamepadMenuState = this.getGamepadMenuState(width, height);'), true);
  assert.equal(midiEditorSource.includes('const gamepadOwnsLandscapeMenu = gamepadMenuState.isLandscapeMenuMode;'), true);
  assert.equal(midiEditorSource.includes('const gamepadSubmenuOnLeft = gamepadMenuState.drawSlideOut;'), true);
  assert.equal(midiEditorSource.includes('const isLandscape = viewportMode.isMobileLandscape;'), true);
  assert.equal(midiEditorSource.includes('const isLandscape = width > height;'), false);
  assert.equal(midiEditorSource.includes('const showLandscapeRightDrawer = isLandscape && !gamepadOwnsLandscapeMenu && this.isMidiLandscapeRightDrawerTab(this.activeTab);'), true);
  assert.equal(midiEditorSource.includes("const showsGridBottomRail = isLandscape && (this.activeTab === 'grid' || this.activeTab === 'song') && !gamepadOwnsLandscapeMenu;"), true);
  assert.equal(midiEditorSource.includes('if (gamepadSubmenuOnLeft) {\n      this.drawGamepadSlideOutPanel(ctx, { x: sidebarX, y: sidebarY, w: sidebarW, h: sidebarH });'), true);
  assert.equal(midiEditorSource.includes('return this.getGamepadMenuState(width, height).drawSlideOut;'), true);
  assert.equal(midiEditorSource.includes('isMobile: viewportMode.isMobileViewport'), true);
  assert.equal(midiEditorSource.includes('return viewportMode.isMobileLandscape\n      && this.activeTab === \'grid\'\n      && !this.recordModeActive;'), true);
  assert.equal(midiEditorSource.includes('if (!viewportMode.isMobileViewport || this.recordModeActive) return false;'), true);
  assert.equal(midiEditorSource.includes('if (viewportMode.isMobileLandscape) {'), true);
  assert.equal(midiEditorSource.includes("const MIDI_CONTROLLER_SIBLING_ORDER = getEditorControllerRootMenuIds('midi');"), true);
  assert.equal(midiEditorSource.includes('siblingOrder: MIDI_CONTROLLER_SIBLING_ORDER'), true);
  assert.equal(midiEditorSource.includes('items: MIDI_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem('), true);
  assert.equal(midiEditorSource.includes('MIDI_CONTROLLER_ROOT_TO_TAB[entry.id] || entry.id'), true);
  assert.equal(midiEditorSource.includes('this.drawGamepadSlideOutPanel(ctx, { x: sidebarX, y: sidebarY, w: sidebarW, h: sidebarH });'), true);
  assert.equal(midiEditorSource.includes("scrollGroup: 'gamepadSubmenu'"), true);
  assert.equal(midiEditorSource.includes('this.gamepadSlideOutMenuMeta = {'), true);
  assert.equal(midiEditorSource.includes("this.dragState?.mode === 'gamepad-submenu-scroll'"), true);
  assert.equal(midiEditorSource.includes('this.controllerMenu.scroll[this.dragState.menuId] = this.dragState.nextScroll;'), true);
  assert.equal(midiEditorSource.includes('return this.getGamepadMenuState(width, height).drawControllerOverlay;'), true);
});

test('MIDI landscape touch uses compact left rail, left root drawer, and right utility drawers', () => {
  const drawerIndex = midiEditorSource.indexOf('  drawMidiLandscapeRootDrawer(ctx, bounds)');
  const drawerBody = midiEditorSource.slice(drawerIndex, midiEditorSource.indexOf('  drawMidiLandscapeRightDrawer(ctx, bounds)', drawerIndex));

  assert.equal(midiEditorSource.includes('showLandscapeRightDrawer'), true);
  assert.equal(midiEditorSource.includes('reserveRightRail: showLandscapeRightDrawer'), true);
  assert.equal(midiEditorSource.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(midiEditorSource.includes("const canRenderLandscapeRightSubmenu = canRenderEditorPlanSurface(landscapeLayout, 'right-drawer')"), true);
  assert.equal(midiEditorSource.includes("&& canRenderEditorPlanSurface(landscapeLayout, 'landscape-right-submenu');"), true);
  assert.equal(midiEditorSource.includes("const canRenderLandscapeBottomRail = canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail');"), true);
  assert.equal(midiEditorSource.includes("const canRenderLandscapeRootDrawer = canRenderEditorPlanSurface(landscapeLayout, 'left-overlay-drawer')"), true);
  assert.equal(midiEditorSource.includes("canRenderEditorPlanSurface(landscapeLayout, 'right-overlay-drawer')"), false);
  assert.equal(midiEditorSource.includes('const submenuDrawerSurface = canRenderLandscapeRightSubmenu ? landscapeLayout?.surfaces.submenu : null;'), true);
  assert.equal(midiEditorSource.includes('const overlayDrawerSurface = canRenderLandscapeRootDrawer ? landscapeLayout?.surfaces.overlayDrawer : null;'), true);
  assert.equal(midiEditorSource.includes('const rootDrawerSurface = canRenderLandscapeRootDrawer ? (landscapeLayout?.surfaces.rootDrawer ?? overlayDrawerSurface) : null;'), true);
  assert.equal(midiEditorSource.includes('h: (submenuDrawerSurface ?? overlayDrawerSurface)?.h ?? height'), true);
  assert.equal(midiEditorSource.includes('buildCompactLandscapeCommandRailActions({'), true);
  assert.equal(midiEditorSource.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(midiEditorSource.includes('const rootMenuSurface = landscapeLayout?.surfaces.compactCommandRail ?? landscapeLayout?.surfaces.rootMenu;'), true);
  assert.equal(midiEditorSource.includes('const workSurface = landscapeLayout?.surfaces.workSurface;'), true);
  assert.equal(midiEditorSource.includes('const rightDrawerW = isLandscape && !gamepadOwnsLandscapeMenu'), true);
  assert.equal(midiEditorSource.includes('const rootDrawerW = isLandscape && !gamepadOwnsLandscapeMenu'), true);
  assert.equal(midiEditorSource.includes("|| !canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(midiEditorSource.includes('if (!suppressLandscapeMenuThumbstick && this.isMobileLandscapeThumbZoomMode() && payload.touchCount > 0 && this.panJoystick.radius > 0)'), true);
  assert.equal(midiEditorSource.includes('if (showsGridBottomRail && canRenderLandscapeBottomRail)'), true);
  assert.equal(midiEditorSource.includes('if (this.landscapeRootDrawerOpen) {\n      resetSharedThumbstickState(this.panJoystick);\n      return;\n    }'), true);
  assert.equal(midiEditorSource.includes('x: (submenuDrawerSurface ?? overlayDrawerSurface)?.x ?? width - rightDrawerW'), true);
  assert.equal(midiEditorSource.includes('x: rootDrawerSurface?.x ?? (sidebarX + sidebarW)'), true);
  assert.equal(midiEditorSource.includes('y: (submenuDrawerSurface ?? overlayDrawerSurface)?.y ?? 0'), true);
  assert.equal(midiEditorSource.includes('const toolOptionsSurface = canRenderLandscapeBottomRail ? landscapeLayout?.surfaces.toolOptions : null;'), true);
  assert.equal(midiEditorSource.includes('this.drawMidiLandscapeRootDrawer(ctx, rootDrawer);'), true);
  assert.equal(midiEditorSource.includes('if (showLandscapeRightDrawer) {\n        this.drawMidiLandscapeRightDrawer(ctx, submenuSurface);\n      }'), true);
  assert.equal(midiEditorSource.includes('this.drawMidiLandscapeRightDrawer(ctx, submenuSurface);'), true);
  assert.equal(midiEditorSource.includes('this.drawMidiLandscapeRightDrawer(ctx, landscapeLayout.rightRail);'), false);
  assert.equal(midiEditorSource.includes('drawMidiHorizontalZoomSlider(ctx, x, y, w, h)'), true);
  assert.equal(midiEditorSource.includes('const MIDI_LANDSCAPE_RIGHT_DRAWER_TABS = new Set('), true);
  assert.equal(midiEditorSource.includes("    .filter((entry) => ['file', 'view', 'record', 'settings'].includes(entry.specId || entry.id))"), true);
  assert.equal(midiEditorSource.includes('return MIDI_LANDSCAPE_RIGHT_DRAWER_TABS.has(tabId);'), true);
  assert.equal(midiEditorSource.includes("return ['file', 'view', 'settings', 'virtual-instruments'].includes(tabId);"), false);
  assert.equal(midiEditorSource.includes('const MIDI_WORKSPACE_TAB_IDS = new Set('), true);
  assert.equal(midiEditorSource.includes("    .filter((entry) => !['file', 'settings'].includes(entry.specId || entry.id))"), true);
  assert.equal(midiEditorSource.includes('if (MIDI_WORKSPACE_TAB_IDS.has(tab.id)) this.bounds.tabs.push({ ...buttonBounds, id: tab.id });'), true);
  assert.equal(midiEditorSource.includes('if (MIDI_WORKSPACE_TAB_IDS.has(entry.id)) this.bounds.tabs.push(bounds);'), true);
  assert.equal(midiEditorSource.includes("entry.id !== 'file' && entry.id !== 'settings'"), false);
  assert.equal(midiEditorSource.includes("this.drawControllerSubmenuPanel(ctx, content.x, content.y, content.w, content.h, 'view', { isMobile: true, layoutMode: 'list' });"), true);
  assert.equal(midiEditorSource.includes('const rootEntries = buildMidiSharedRootMenuEntries();'), true);
  assert.equal(midiEditorSource.includes("id: 'menu',\n          label: 'Menu'"), true);
  assert.equal(midiEditorSource.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(midiEditorSource.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(midiEditorSource.includes("id: 'play',"), true);
  assert.equal(drawerBody.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(drawerBody.includes('grid.items.forEach(({ index, bounds }) => {'), true);
  assert.equal(drawerBody.includes('this.mobileLandscapeRootMenuScrollMax = 0;'), true);
  assert.equal(drawerBody.includes('const scrolledGrid = buildScrolledLandscapeRootDrawerItems(grid, this.controllerMenu.scroll.root || 0);'), false);
  assert.equal(drawerBody.includes('this.controllerMenu.scroll.root = 0;'), true);
  assert.equal(drawerBody.includes('scrolledGrid.items.forEach(({ index, bounds }) => {'), false);
  assert.equal(drawerBody.includes('rootEntries.slice(rootScroll, rootScroll + visibleRows).forEach((entry, index) => {'), false);
  const rootTapIndex = midiEditorSource.indexOf('  handleMobileLandscapeRootMenuTap(id)');
  const rootTapBody = midiEditorSource.slice(rootTapIndex, midiEditorSource.indexOf('  closeMidiPortraitTrackPicker()', rootTapIndex));
  assert.equal(rootTapBody.includes('this.landscapeRootDrawerOpen = false;'), false);
  assert.equal(midiEditorSource.includes('buildMenuScrollDragState'), true);
  assert.equal(midiEditorSource.includes('resolveMenuScrollDrag'), true);
  assert.equal(midiEditorSource.includes("menuId: 'root'"), true);
  assert.equal(midiEditorSource.includes('this.controllerMenu.scroll.root = this.dragState.nextScroll;'), true);
});

test('MIDI desktop keeps transport in the left column instead of a bottom rail', () => {
  const desktopIndex = midiEditorSource.indexOf('  drawDesktopLayout(ctx, width, height, track, pattern)');
  const desktopBlock = midiEditorSource.slice(desktopIndex, midiEditorSource.indexOf('  getDesktopControllerMenuId', desktopIndex));
  const tabRailIndex = midiEditorSource.indexOf('  drawTabs(ctx, x, y, w, h)');
  const tabRailBody = midiEditorSource.slice(tabRailIndex, midiEditorSource.indexOf('  drawTransportBar(ctx, x, y, w, h)', tabRailIndex));
  const transportRailIndex = midiEditorSource.indexOf('  drawTransportBar(ctx, x, y, w, h)');
  const transportRailBody = midiEditorSource.slice(transportRailIndex, midiEditorSource.indexOf('  drawGridTab(ctx, x, y, w, h, track, pattern)', transportRailIndex));
  const topBarIndex = midiEditorSource.indexOf('  drawTopBar(ctx, x, y, w, h, track)');
  const topBarBody = midiEditorSource.slice(topBarIndex, midiEditorSource.indexOf('  drawTransport(ctx, x, y, w, h)', topBarIndex));
  const leftOptionsIndex = midiEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds, options = {})');
  const leftOptionsBody = midiEditorSource.slice(leftOptionsIndex, midiEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', leftOptionsIndex));
  const transportIndex = midiEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)');
  const transportBody = midiEditorSource.slice(transportIndex, midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)', transportIndex));
  const dropdownIndex = midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)');
  const dropdownBody = midiEditorSource.slice(dropdownIndex, midiEditorSource.indexOf('  drawControllerSubmenuPanel(ctx, x, y, w, h, menuId', dropdownIndex));
  const trackQuickActionsIndex = midiEditorSource.indexOf('  drawDesktopTrackQuickActions(ctx, contextBounds, track)');
  const trackQuickActionsBody = midiEditorSource.slice(trackQuickActionsIndex, midiEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', trackQuickActionsIndex));
  const gridControlsIndex = midiEditorSource.indexOf('  drawGridControls(ctx, x, y, w, track)');
  const gridControlsBody = midiEditorSource.slice(gridControlsIndex, midiEditorSource.indexOf('  clearGridZoomButtonBounds()', gridControlsIndex));
  const songTabIndex = midiEditorSource.indexOf('  drawSongTab(ctx, x, y, w, h, options = {})');
  const songTabBody = midiEditorSource.slice(songTabIndex, midiEditorSource.indexOf('  drawSongZoomControls(ctx, bounds)', songTabIndex));
  const songTabModeBody = midiEditorSource.slice(songTabIndex, midiEditorSource.indexOf('    let baseMixRailH', songTabIndex));

  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('this.drawTransportBar(ctx, shellLayout.bottomBar'), false);
  assert.equal(desktopBlock.includes("this.drawDesktopLeftOptions(ctx, shellLayout.leftOptions, { includeDesktopTransport: this.activeTab !== 'instruments' });"), true);
  assert.equal(midiEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
  assert.equal(midiEditorSource.includes("const MIDI_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('midi');"), true);
  assert.equal(midiEditorSource.includes('getDesktopMenuLabel(menuId = this.getDesktopControllerMenuId())'), true);
  assert.equal(midiEditorSource.includes('const tabLabel = this.getDesktopMenuLabel();'), true);
  assert.equal(leftOptionsBody.includes('buildSharedDesktopContextTransportLayout(bounds, {'), true);
  assert.equal(leftOptionsBody.includes('includeTransport: includeDesktopTransport,'), true);
  assert.equal(leftOptionsBody.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(leftOptionsBody.includes('this.drawDesktopTrackQuickActions(ctx, contextBounds, track);'), true);
  assert.equal(leftOptionsBody.includes('`Active: ${this.getDesktopMenuLabel(menuId)}`'), true);
  assert.equal(leftOptionsBody.includes('const track = this.song?.tracks?.[this.selectedTrackIndex] || null;'), true);
  assert.equal(leftOptionsBody.includes('const pattern = track?.patterns?.[this.selectedPatternIndex] || track?.patterns?.[0] || null;'), true);
  assert.equal(leftOptionsBody.includes('this.drawControllerSubmenuPanel'), false);
  assert.equal(leftOptionsBody.includes('Math.min(172, Math.max(144'), false);
  assert.equal(trackQuickActionsBody.includes('drawSharedPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, {'), true);
  assert.equal(trackQuickActionsBody.includes("ctx.fillText('Track Tools'"), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.instrumentPrev'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.instrumentLabel'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.instrumentNext'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.noteLength'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.chordMode'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.barsMinus'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.barsLabel'), true);
  assert.equal(trackQuickActionsBody.includes('this.bounds.barsPlus'), true);
  assert.equal(gridControlsBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(gridControlsBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(gridControlsBody.includes('if (!isMobile) {'), true);
  assert.equal(gridControlsBody.includes('return extraHeight;'), true);
  assert.equal(songTabModeBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(songTabModeBody.includes("const isPortrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(songTabModeBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(songTabModeBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(tabRailBody.includes('ctx.fillStyle = UI_SUITE.colors.panelAlt;'), true);
  assert.equal(tabRailBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(tabRailBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(tabRailBody.includes('ctx.fillStyle = this.editorShellTheme.surfaceAlt;'), false);
  assert.equal(topBarBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(topBarBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(transportRailBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(transportRailBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(transportRailBody.includes('ctx.fillStyle = UI_SUITE.colors.panelAlt;'), true);
  assert.equal(transportRailBody.includes('ctx.fillStyle = this.editorShellTheme.surfaceAlt;'), false);
  assert.equal(transportRailBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(transportRailBody.includes('ctx.fillStyle = UI_SUITE.colors.accent2;'), true);
  assert.equal(transportRailBody.includes('ctx.fillStyle = UI_SUITE.colors.accent;'), true);
  assert.equal(transportRailBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(transportRailBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(transportBody.includes('drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(transportBody.includes('this.editorShellTheme.surfaceAlt'), false);
  assert.equal(transportBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(transportBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(transportBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(dropdownBody.includes('const controllerMenus = this.buildControllerMenus();'), true);
  assert.equal(dropdownBody.includes('const menu = controllerMenus[menuId] || controllerMenus[dropdown.rootId] || this.controllerMenu.menus?.[menuId] || this.controllerMenu.menus?.[dropdown.rootId];'), true);
  assert.equal(dropdownBody.includes('const dropdownPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(dropdownBody.includes("hiddenIds: menuId === 'grid' ? ['place-note', 'erase-note'] : []"), true);
  assert.equal(dropdownBody.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(dropdownBody.includes("registerButton: ({ item, bounds }) => {"), true);
});

test('MIDI settings dialog uses shared RTG Studio panel chrome', () => {
  const settingsIndex = midiEditorSource.indexOf('  drawSettingsDialog(ctx, width, height)');
  const settingsBody = midiEditorSource.slice(settingsIndex, midiEditorSource.indexOf('  drawInstrumentPickerModal(ctx, width, height, track)', settingsIndex));
  const instrumentModalIndex = midiEditorSource.indexOf('  drawInstrumentPickerModal(ctx, width, height, track)');
  const instrumentModalBody = midiEditorSource.slice(instrumentModalIndex, midiEditorSource.indexOf('  drawInstrumentPicker(ctx, width, height)', instrumentModalIndex));

  assert.ok(settingsIndex > 0);
  assert.ok(instrumentModalIndex > settingsIndex);
  assert.equal(settingsBody.includes('drawSharedPanel(ctx, { x: dialogX, y: dialogY, w: dialogW, h: dialogH }, {'), true);
  assert.equal(settingsBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(settingsBody.includes('border: UI_SUITE.colors.border'), true);
  assert.equal(settingsBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(settingsBody.includes('ctx.font = `18px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentModalBody.includes("const isPortrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(instrumentModalBody.includes('isMobile: this.isMobileLayout(),'), false);
  assert.equal(settingsBody.includes("ctx.fillStyle = 'rgba(12,14,18,0.95)';"), false);
  assert.equal(settingsBody.includes("ctx.font = '18px Courier New';"), false);
});

test('MIDI settings and help panels use shared RTG Studio drawer chrome', () => {
  const settingsIndex = midiEditorSource.indexOf('  drawSettingsPanel(ctx, x, y, w, h)');
  const settingsBody = midiEditorSource.slice(settingsIndex, midiEditorSource.indexOf('  drawHelpPanel(ctx, x, y, w, h)', settingsIndex));
  const helpIndex = midiEditorSource.indexOf('  drawHelpPanel(ctx, x, y, w, h)');
  const helpBody = midiEditorSource.slice(helpIndex, midiEditorSource.indexOf('  drawTrackMixer(ctx, x, y, w)', helpIndex));

  assert.ok(settingsIndex > 0);
  assert.ok(helpIndex > settingsIndex);
  assert.equal(settingsBody.includes('drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(settingsBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(settingsBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(settingsBody.includes('ctx.font = `16px ${UI_SUITE.font.family}`;'), true);
  assert.equal(settingsBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(settingsBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(settingsBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(settingsBody.includes("const portraitStacked = this.activeViewportMode === 'portrait';"), true);
  assert.equal(settingsBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(settingsBody.includes('ctx.fillStyle = this.editorShellTheme.surfaceAlt;'), false);
  assert.equal(settingsBody.includes("ctx.font = '16px Courier New';"), false);
  assert.equal(settingsBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(settingsBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(settingsBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(helpBody.includes('drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(helpBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(helpBody.includes('ctx.font = `18px ${UI_SUITE.font.family}`;'), true);
  assert.equal(helpBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(helpBody.includes("ctx.font = '18px Courier New';"), false);
  assert.equal(helpBody.includes("ctx.font = '13px Courier New';"), false);
});

test('MIDI instrument and mixer panels use shared RTG Studio workflow chrome', () => {
  const instrumentIndex = midiEditorSource.indexOf('  drawInstrumentPanel(ctx, x, y, w, h, track, options = {})');
  const instrumentBody = midiEditorSource.slice(instrumentIndex, midiEditorSource.indexOf('  drawSettingsPanel(ctx, x, y, w, h)', instrumentIndex));
  const mixerIndex = midiEditorSource.indexOf('  drawTrackMixer(ctx, x, y, w)');
  const mixerBody = midiEditorSource.slice(mixerIndex, midiEditorSource.indexOf('  drawTopBar(ctx, x, y, w, h, track)', mixerIndex));
  const trackListIndex = midiEditorSource.indexOf('  drawTrackList(ctx, x, y, w, h)');
  const trackListBody = midiEditorSource.slice(trackListIndex, midiEditorSource.indexOf('  drawPatternEditor(ctx, x, y, w, h, track, pattern, options = {})', trackListIndex));

  assert.ok(instrumentIndex > 0);
  assert.ok(mixerIndex > instrumentIndex);
  assert.ok(trackListIndex > mixerIndex);
  assert.equal(instrumentBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(instrumentBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(instrumentBody.includes('drawSharedPanel(ctx, { x, y, w, h: listH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(instrumentBody.includes('drawSharedPanel(ctx, { x: leftX, y: leftY, w: leftW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(instrumentBody.includes('drawSharedPanel(ctx, { x: rightX, y: rightY, w: rightW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(instrumentBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(instrumentBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(instrumentBody.includes('ctx.font = `15px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(instrumentBody.includes("ctx.font = '15px Courier New';"), false);
  assert.equal(instrumentBody.includes("ctx.font = '14px Courier New';"), false);
  assert.equal(instrumentBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(instrumentBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(instrumentBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(instrumentBody.includes("ctx.fillStyle = '#fff';"), false);
  assert.equal(instrumentBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.7)';"), false);
  assert.equal(instrumentBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.6)';"), false);
  assert.equal(instrumentBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.75)';"), false);
  assert.equal(mixerBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(mixerBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(trackListBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(trackListBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(mixerBody.includes('drawSharedPanel(ctx, masterBounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(mixerBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(mixerBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(mixerBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(mixerBody.includes("ctx.fillStyle = '#fff';"), false);
});

test('MIDI utility popovers use shared RTG Studio panel chrome', () => {
  const noteLengthIndex = midiEditorSource.indexOf('  drawNoteLengthMenu(ctx, width, height)');
  const noteLengthBody = midiEditorSource.slice(noteLengthIndex, midiEditorSource.indexOf('  drawTempoSlider(ctx, width, height)', noteLengthIndex));
  const tempoIndex = midiEditorSource.indexOf('  drawTempoSlider(ctx, width, height)');
  const tempoBody = midiEditorSource.slice(tempoIndex, midiEditorSource.indexOf('  drawSettingsDialog(ctx, width, height)', tempoIndex));

  assert.ok(noteLengthIndex > 0);
  assert.ok(tempoIndex > noteLengthIndex);
  assert.equal(noteLengthBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(noteLengthBody.includes('drawSharedPanel(ctx, { x: menuX, y: menuY, w: menuW, h: menuH }, {'), true);
  assert.equal(noteLengthBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(noteLengthBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(noteLengthBody.includes("ctx.fillStyle = 'rgba(12,14,18,0.95)';"), false);
  assert.equal(tempoBody.includes('drawSharedPanel(ctx, { x: sliderX, y: sliderY, w: sliderW, h: sliderH }, {'), true);
  assert.equal(tempoBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(tempoBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(tempoBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tempoBody.includes("ctx.font = '12px Courier New';"), false);
  assert.equal(tempoBody.includes("ctx.fillStyle = 'rgba(12,14,18,0.95)';"), false);
});

test('MIDI portrait utility panels use shared RTG Studio panel chrome', () => {
  const trackPickerIndex = midiEditorSource.indexOf('  drawMidiPortraitTrackPicker(ctx, anchorBounds)');
  const trackPickerBody = midiEditorSource.slice(trackPickerIndex, midiEditorSource.indexOf('  drawMidiPortraitMasterVolumePanel(ctx, anchorBounds)', trackPickerIndex));
  const masterVolumeIndex = midiEditorSource.indexOf('  drawMidiPortraitMasterVolumePanel(ctx, anchorBounds)');
  const masterVolumeBody = midiEditorSource.slice(masterVolumeIndex, midiEditorSource.indexOf('  drawMidiPortraitRecordSettingsPanel(ctx, panel)', masterVolumeIndex));
  const recordSettingsIndex = midiEditorSource.indexOf('  drawMidiPortraitRecordSettingsPanel(ctx, panel)');
  const recordSettingsBody = midiEditorSource.slice(recordSettingsIndex, midiEditorSource.indexOf('  drawMobileSidebar(ctx, x, y, w, h, track, options = {})', recordSettingsIndex));

  assert.ok(trackPickerIndex > 0);
  assert.ok(masterVolumeIndex > trackPickerIndex);
  assert.ok(recordSettingsIndex > masterVolumeIndex);
  for (const body of [trackPickerBody, masterVolumeBody, recordSettingsBody]) {
    assert.equal(body.includes('fill: UI_SUITE.colors.panelAlt'), true);
    assert.equal(body.includes('border: UI_SUITE.colors.border'), true);
    assert.equal(body.includes("fill: 'rgba(12,14,18,0.98)'"), false);
  }
  assert.equal(trackPickerBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(masterVolumeBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(recordSettingsBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
});

test('MIDI record mode keeps desktop on the shared desktop shell', () => {
  const drawIndex = midiEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBody = midiEditorSource.slice(drawIndex, midiEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)', drawIndex));
  const recordIndex = midiEditorSource.indexOf('  drawRecordMode(ctx, width, height, track, pattern)');
  const recordBody = midiEditorSource.slice(recordIndex, midiEditorSource.indexOf('  drawRecordModeSidebar(ctx, x, y, w, h)', recordIndex));
  const pointerDownIndex = midiEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = midiEditorSource.slice(pointerDownIndex, midiEditorSource.indexOf('    if (this.qaOverlayOpen)', pointerDownIndex));
  const settingsClickBody = midiEditorSource.slice(
    midiEditorSource.indexOf('    const isPortraitMainWorkspace =', pointerDownIndex),
    midiEditorSource.indexOf('    if (this.openDesktopDropdownRootId', pointerDownIndex)
  );

  assert.equal(drawBody.includes('if (this.recordModeActive && isMobile) {'), true);
  assert.equal(drawBody.includes('this.drawDesktopLayout(ctx, width, height, track, pattern);'), true);
  assert.equal(recordBody.includes('const viewportMode = this.resolveMidiViewportMode(width, height);'), true);
  assert.equal(recordBody.includes('const isMobile = viewportMode.isMobileViewport;'), true);
  assert.equal(recordBody.includes('if (viewportMode.isDesktop) {\n      this.drawDesktopLayout(ctx, width, height, track, pattern);\n      return;\n    }'), true);
  assert.equal(recordBody.includes('if (viewportMode.isMobilePortrait) {'), true);
  assert.equal(recordBody.includes("nowPlayingPlacement: viewportMode.isMobileLandscape ? 'preview' : 'instrument'"), true);
  assert.equal(recordBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(recordBody.includes('nowPlayingPlacement: this.isMobileLayout()'), false);
  assert.equal(pointerDownBody.includes("if (this.activeViewportMode === 'desktop') {\n          this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);\n        } else {\n          this.activateLeftRailTab(tabHit.id);\n        }"), true);
  assert.equal(pointerDownBody.includes("if (this.activeViewportMode === 'desktop') {\n          this.openMidiDesktopDropdown('file');\n        } else {\n          this.activeTab = 'file';\n        }"), true);
  assert.equal(pointerDownBody.includes("if (this.activeViewportMode === 'desktop') {\n          this.openMidiDesktopDropdown('settings');\n        } else {\n          this.activeTab = 'settings';\n        }"), true);
  assert.equal(settingsClickBody.includes("const isPortraitMainWorkspace = this.activeViewportMode === 'portrait'\n      && isMidiPortraitMainWorkspaceTab(this.activeTab)\n      && !this.mobilePortraitMenuSheetBounds;"), true);
  assert.equal(settingsClickBody.includes('isMobilePortraitLayout({\n      isMobile: this.isMobileLayout(),'), false);
  assert.equal(pointerDownBody.includes('if (this.isMobileLayout()) {\n          this.activateLeftRailTab(tabHit.id);\n        } else {\n          this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);\n        }'), false);
  assert.equal(midiEditorSource.includes('drawDesktopLeftPanel(ctx'), false);
  assert.equal(midiEditorSource.includes('buildSharedDesktopLeftPanelFrame'), false);
  assert.equal(midiEditorSource.includes('buildSharedLeftMenuLayout'), false);
  assert.equal(midiEditorSource.includes('buildSharedLeftMenuButtons'), false);
});

test('MIDI desktop grid pan uses the shared pointer policy', () => {
  const pointerDownIndex = midiEditorSource.indexOf('  handleGridPointerDown(payload)');
  const pointerDownBody = midiEditorSource.slice(pointerDownIndex, midiEditorSource.indexOf('  handleGridPointerMove(payload)', pointerDownIndex));
  const noteHandleIndex = midiEditorSource.indexOf('  getNoteHandleWidth(rect)');
  const noteHandleBody = midiEditorSource.slice(noteHandleIndex, midiEditorSource.indexOf('  getResizeMinimumTicksForLayout()', noteHandleIndex));
  const snapTickIndex = midiEditorSource.indexOf('  snapTick(tick)');
  const snapTickBody = midiEditorSource.slice(snapTickIndex, midiEditorSource.indexOf('  snapTickForTrack(tick, track = this.getActiveTrack())', snapTickIndex));
  const snapTickForTrackIndex = midiEditorSource.indexOf('  snapTickForTrack(tick, track = this.getActiveTrack())');
  const snapTickForTrackBody = midiEditorSource.slice(snapTickForTrackIndex, midiEditorSource.indexOf('  getChordForTick(tick)', snapTickForTrackIndex));
  const patternEditorIndex = midiEditorSource.indexOf('  drawPatternEditor(ctx, x, y, w, h, track, pattern, options = {})');
  const patternEditorBody = midiEditorSource.slice(patternEditorIndex, midiEditorSource.indexOf('  drawGridNotes(ctx, track, pattern)', patternEditorIndex));
  const policyIndex = pointerDownBody.indexOf("getEditorPointerInteractionPolicy('midi'");
  const panIndex = pointerDownBody.indexOf('if ((payload.touchCount && !hit) || modifiers.alt || shouldPanWithButton) {');

  assert.ok(pointerDownIndex >= 0);
  assert.ok(noteHandleIndex > 0);
  assert.ok(snapTickIndex > 0);
  assert.ok(snapTickForTrackIndex > 0);
  assert.ok(patternEditorIndex > 0);
  assert.ok(policyIndex > 0);
  assert.ok(panIndex > policyIndex);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.middleDragPan'), true);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.rightDragPan'), true);
  assert.equal(pointerDownBody.includes("const pointerPolicy = this.activeViewportMode === 'desktop'"), true);
  assert.equal(pointerDownBody.includes('payload.button === 1 || payload.button === 2'), false);
  assert.equal(noteHandleBody.includes("const isPortrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(noteHandleBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(snapTickBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(snapTickBody.includes('this.isMobileLayout()'), false);
  assert.equal(snapTickForTrackBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(snapTickForTrackBody.includes('this.isMobileLayout()'), false);
  assert.equal(patternEditorBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(patternEditorBody.includes("const isPortrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(patternEditorBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(patternEditorBody.includes('isMobilePortraitLayout({ isMobile, viewportWidth, viewportHeight });'), false);
  assert.equal(midiEditorSource.includes('getEditorPointerInteractionPolicy'), true);
});

test('MIDI desktop top menu switches drawers on hover', () => {
  assert.equal(midiEditorSource.includes('handleDesktopTopMenuHover(x, y)'), true);
  assert.equal(midiEditorSource.includes('this.handleDesktopTopMenuHover(payload.x, payload.y);'), true);
  assert.equal(midiEditorSource.includes('const rootHit = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(midiEditorSource.includes('buttons: this.getDesktopRootButtons(),'), true);
  assert.equal(midiEditorSource.includes("rootIdKey: 'desktopRootId'"), true);
  assert.equal(midiEditorSource.includes('this.openMidiDesktopDropdown(nextTab);'), true);
  assert.equal(midiEditorSource.includes("const isDesktopMode = this.activeViewportMode === 'desktop';"), true);
  assert.equal(midiEditorSource.includes('if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({'), true);
  assert.equal(midiEditorSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.dragState) {"), true);
  assert.equal(midiEditorSource.includes('this.closeMidiDesktopDropdown();'), true);
  assert.equal(midiEditorSource.includes('this.activateLeftRailTab(nextTab);'), false);
});

test('MIDI desktop dropdown commands only fire on release', () => {
  const pointerDownIndex = midiEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = midiEditorSource.slice(pointerDownIndex, midiEditorSource.indexOf('  handlePointerUp(payload)', pointerDownIndex));
  const pointerMoveIndex = midiEditorSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = midiEditorSource.slice(pointerMoveIndex, midiEditorSource.indexOf('  handlePointerUp(payload)', pointerMoveIndex));
  const pointerUpIndex = midiEditorSource.indexOf('  handlePointerUp(payload)');
  const pointerUpBody = midiEditorSource.slice(pointerUpIndex, midiEditorSource.indexOf('  handleWheel(payload)', pointerUpIndex));

  assert.ok(pointerDownIndex >= 0);
  assert.ok(pointerMoveIndex > pointerDownIndex);
  assert.ok(pointerUpIndex > pointerDownIndex);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, { x, y });'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.action?.();'), false);
  assert.equal(pointerMoveBody.includes('this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);'), true);
  assert.equal(pointerUpBody.includes('const desktopDropdownHit = this.bounds.desktopDropdownItems?.find((item) => this.pointInBounds(x, y, item));'), false);
  assert.equal(pointerUpBody.includes('const pendingDesktopDropdownHit = this.pendingDesktopDropdownHit;'), true);
  assert.equal(pointerUpBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(pendingDesktopDropdownHit, { x, y });'), true);
  assert.equal(pointerUpBody.includes('if (shouldActivate) {'), true);
  assert.equal(pointerUpBody.includes('pendingDesktopDropdownHit.action?.();'), true);
  assert.equal(pointerUpBody.includes('this.closeMidiDesktopDropdown();'), true);
});

test('MIDI file menu uses the shared editor file menu model', () => {
  const fileItemsIndex = midiEditorSource.indexOf('  getFileMenuItems()');
  const fileItemsBody = midiEditorSource.slice(fileItemsIndex, midiEditorSource.indexOf('  drawFilePanel(ctx, x, y, w, h)', fileItemsIndex));
  const controllerIndex = midiEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = midiEditorSource.slice(controllerIndex, midiEditorSource.indexOf('      system:', controllerIndex));
  const filePanelIndex = midiEditorSource.indexOf('  drawFilePanel(ctx, x, y, w, h)');
  const filePanelBody = midiEditorSource.slice(filePanelIndex, midiEditorSource.indexOf('  drawGenreMenu(ctx, width, height)', filePanelIndex));

  assert.equal(midiEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(midiEditorSource.includes('buildUnifiedFileDrawerItems'), false);
  assert.equal(fileItemsBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileItemsBody.includes('undo: false'), false);
  assert.equal(fileItemsBody.includes('redo: false'), false);
  assert.equal(fileItemsBody.includes('includeFooter: false'), true);
  assert.equal(fileItemsBody.includes('extras: ['), true);
  assert.equal(fileItemsBody.includes("{ id: 'nav-grid', label: 'Grid' }"), false);
  assert.equal(fileItemsBody.includes("{ id: 'nav-instruments', label: 'Mixer' }"), false);
  assert.equal(fileItemsBody.includes("{ id: 'nav-virtual-instruments', label: 'Record' }"), false);
  assert.equal(fileItemsBody.includes("{ id: 'nav-pedals', label: 'Pedals' }"), false);
  assert.equal(fileItemsBody.includes("{ id: 'nav-settings', label: 'Settings' }"), false);
  assert.equal(fileItemsBody.includes("{ id: 'rescue-save', label: 'Rescue Save' }"), true);
  assert.equal(fileItemsBody.includes("{ id: 'exit-main', label: 'Exit to Main Menu' }"), true);
  assert.equal(fileItemsBody.includes("new: () => this.handleFileMenu('new')"), true);
  assert.equal(fileItemsBody.includes("open: () => this.handleFileMenu('load')"), true);
  assert.equal(fileItemsBody.includes("export: () => this.handleFileMenu('export-json')"), true);
  assert.equal(fileItemsBody.includes('filter((item) => !item.disabled)'), true);
  assert.equal(controllerBody.includes('items: this.getFileMenuItems().map((item) => ('), true);
  assert.equal(controllerBody.includes("action(item.id, item.label, () => this.handleFileMenu(item.id))"), true);
  assert.equal(filePanelBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(filePanelBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(filePanelBody.includes("const stickyExit = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(filePanelBody.includes('const stickyExit = isMobile || isMobileLandscapeLayout({'), false);
  assert.equal(filePanelBody.includes('const allFileItems = this.getFileMenuItems();'), true);
  assert.equal(midiEditorSource.includes('isMobileLandscapeLayout'), false);
  assert.equal(midiEditorSource.includes('isMobilePortraitLayout'), false);
});

test('MIDI desktop exposes edit commands outside the grid drawing workflow', () => {
  const controllerIndex = midiEditorSource.indexOf('  buildControllerMenus()');
  const controllerBody = midiEditorSource.slice(controllerIndex, midiEditorSource.indexOf('      song: {', controllerIndex));
  const editIndex = midiEditorSource.indexOf('  getMidiEditMenuItems()');
  const editBody = midiEditorSource.slice(editIndex, midiEditorSource.indexOf('  pasteSelection()', editIndex));

  assert.equal(controllerBody.includes('items: MIDI_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem('), true);
  assert.equal(midiEditorSource.includes("edit: 'grid'"), true);
  assert.equal(controllerBody.includes("edit: {\n        id: 'edit',\n        title: 'Edit',\n        items: this.getMidiEditMenuItems().map((item) => action(item.id, item.label, item.onClick, {\n          disabled: Boolean(item.disabled)\n        }))\n      }"), true);
  assert.equal(controllerBody.includes("'Place Note'"), false);
  assert.equal(controllerBody.includes("'Erase Note'"), false);
  assert.equal(midiEditorSource.includes('const CONTROLLER_ACTIONS'), false);
  assert.equal(midiEditorSource.includes("label: 'Place Note'"), false);
  assert.equal(midiEditorSource.includes("label: 'Erase Note'"), false);
  assert.equal(editBody.includes("id: 'undo'"), true);
  assert.equal(editBody.includes("id: 'redo'"), true);
  assert.equal(editBody.includes("id: 'select-all'"), true);
  assert.equal(editBody.includes("id: 'copy'"), true);
  assert.equal(editBody.includes("id: 'cut'"), true);
  assert.equal(editBody.includes("id: 'paste'"), true);
  assert.equal(editBody.includes("id: 'delete'"), true);
  assert.equal(editBody.includes('const selectedNotes = this.getSelectedNotes();'), true);
  assert.equal(editBody.includes('const hasSelection = selectedNotes.length > 0;'), true);
  assert.equal(editBody.includes('const pattern = this.getActivePattern();'), true);
  assert.equal(editBody.includes('const hasPatternNotes = Boolean(pattern?.notes?.length);'), true);
  assert.equal(editBody.includes('const hasClipboard = Boolean(this.clipboard);'), true);
  assert.equal(editBody.includes("{ id: 'select-all', label: 'Select All', disabled: !hasPatternNotes"), true);
  assert.equal(editBody.includes("{ id: 'copy', label: 'Copy', disabled: !hasSelection"), true);
  assert.equal(editBody.includes("id: 'cut',\n        label: 'Cut',\n        disabled: !hasSelection"), true);
  assert.equal(editBody.includes("{ id: 'paste', label: 'Paste', disabled: !hasClipboard"), true);
  assert.equal(editBody.includes("{ id: 'delete', label: 'Delete', disabled: !hasSelection"), true);
});

test('MIDI desktop drawers avoid duplicate open-current-panel rows and settings commands', () => {
  const controllerIndex = midiEditorSource.indexOf('  buildControllerMenus()');
  const controllerBody = midiEditorSource.slice(controllerIndex, midiEditorSource.indexOf('  advancePlayhead(dt)', controllerIndex));

  assert.equal(controllerBody.includes("surfaceAction('open-grid', 'Open Grid'"), false);
  assert.equal(controllerBody.includes("surfaceAction('open-song', 'Open Song'"), false);
  assert.equal(controllerBody.includes("surfaceAction('open-tracks', 'Open Mixer'"), false);
  assert.equal(controllerBody.includes("action('open-record', 'Open Record Tab'"), false);
  assert.equal(controllerBody.includes("surfaceAction('open-pedals', 'Open Pedals'"), false);
  assert.equal(controllerBody.includes("surfaceAction('open-mixer', 'Open Mixer'"), false);
  assert.equal(controllerBody.includes("action('open-settings', 'Open Settings'"), false);
  assert.equal(controllerBody.includes("action('enter-record', 'Enter Record Mode'"), true);
  assert.equal(controllerBody.includes("surfaceAction('select-pedal-chain', 'Pedal Chain'"), true);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: []"), true);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: [\n          action('quantize'"), false);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: [\n          action('preview'"), false);
  assert.equal(controllerBody.includes("id: 'settings',\n        title: 'Settings',\n        items: [\n          action('contrast'"), false);
  assert.equal(editorMenuSpecSource.includes("settings: section('settings', 'Settings', ['quantize', 'preview', 'contrast'"), false);
});

test('MIDI desktop pedal board shows inline pedal settings instead of only generic slot dots', () => {
  const pedalPanelIndex = midiEditorSource.indexOf('  drawPedalBoardPanel(ctx, x, y, w, h, track, options = {})');
  const pedalPanelBody = midiEditorSource.slice(pedalPanelIndex, midiEditorSource.indexOf('  getSidebarWidth(viewWidth, {', pedalPanelIndex));

  assert.ok(pedalPanelIndex >= 0);
  assert.equal(pedalPanelBody.includes("const desktopOverview = this.activeViewportMode === 'desktop' && !embedded && !compact && !portraitGrid && h >= 180;"), true);
  assert.equal(pedalPanelBody.includes('const desktopOverview = !this.isMobileLayout()'), false);
  assert.equal(pedalPanelBody.includes('if (desktopOverview) {'), true);
  assert.equal(pedalPanelBody.includes('const knobDefs = pedalDef?.knobs?.slice(0, 4) || [];'), true);
  assert.equal(pedalPanelBody.includes("ctx.fillText('Click to edit'"), true);
  assert.equal(pedalPanelBody.includes('} else {\n          const knobY = b.y + b.h - 16;'), true);
});

test('MIDI pedal board overview and picker use shared RTG Studio chrome', () => {
  const pedalPanelIndex = midiEditorSource.indexOf('  drawPedalBoardPanel(ctx, x, y, w, h, track, options = {})');
  const pedalPanelBody = midiEditorSource.slice(pedalPanelIndex, midiEditorSource.indexOf('    const selectedSlot = this.pedalUiState.selectedSlot;', pedalPanelIndex));

  assert.ok(pedalPanelIndex >= 0);
  assert.equal(pedalPanelBody.includes('drawSharedPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(pedalPanelBody.includes('drawSharedPanel(ctx, { x: mx, y: my, w: mw, h: mh }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(pedalPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(pedalPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(pedalPanelBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pedalPanelBody.includes('ctx.font = `24px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pedalPanelBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pedalPanelBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pedalPanelBody.includes('ctx.fillStyle = this.editorShellTheme.surfaceAlt;'), false);
  assert.equal(pedalPanelBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(pedalPanelBody.includes("ctx.font = '24px Courier New';"), false);
  assert.equal(pedalPanelBody.includes("ctx.font = '14px Courier New';"), false);
  assert.equal(pedalPanelBody.includes("ctx.font = '11px Courier New';"), false);
});

test('MIDI destructive action buttons use shared RTG Studio danger chrome', () => {
  const dangerIndex = midiEditorSource.indexOf('  drawDangerButton(ctx, bounds, label)');
  const dangerBody = midiEditorSource.slice(dangerIndex, midiEditorSource.indexOf('  drawDesktopLayout(ctx, width, height, track, pattern)', dangerIndex));

  assert.ok(dangerIndex >= 0);
  assert.equal(dangerBody.includes('ctx.fillStyle = UI_SUITE.colors.danger'), true);
  assert.equal(dangerBody.includes('ctx.strokeStyle = UI_SUITE.colors.dangerBorder || UI_SUITE.colors.border;'), true);
  assert.equal(dangerBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(dangerBody.includes('ctx.font = `700 12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(dangerBody.includes("ctx.fillStyle = 'rgba(145,30,30,0.95)';"), false);
  assert.equal(dangerBody.includes("ctx.fillStyle = '#fff';"), false);
  assert.equal(dangerBody.includes("ctx.font = '12px Courier New';"), false);
});

test('MIDI shared button primitives use active viewport mode for typography', () => {
  const buttonIndex = midiEditorSource.indexOf('  drawButton(ctx, bounds, label, active, subtle, focused = false)');
  const buttonBody = midiEditorSource.slice(buttonIndex, midiEditorSource.indexOf('  drawSmallButton(ctx, bounds, label, active)', buttonIndex));
  const toggleIndex = midiEditorSource.indexOf('  drawToggle(ctx, bounds, label, active)');
  const toggleBody = midiEditorSource.slice(toggleIndex, midiEditorSource.indexOf('\n}', toggleIndex));

  assert.ok(buttonIndex > 0);
  assert.ok(toggleIndex > buttonIndex);
  assert.equal(buttonBody.includes("const isMobile = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(buttonBody.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(toggleBody.includes("fontSize: this.activeViewportMode !== 'desktop' ? 14 : 12,"), true);
  assert.equal(toggleBody.includes('fontSize: this.isMobileLayout() ? 14 : 12,'), false);
});

test('MIDI Song edit overlays use active viewport mode for touch sizing', () => {
  const selectionIndex = midiEditorSource.indexOf('  drawSongSelectionMenu(ctx)');
  const selectionBody = midiEditorSource.slice(selectionIndex, midiEditorSource.indexOf('  drawSongSplitTool(ctx)', selectionIndex));
  const splitIndex = midiEditorSource.indexOf('  drawSongSplitTool(ctx)');
  const splitBody = midiEditorSource.slice(splitIndex, midiEditorSource.indexOf('  drawSongShiftTool(ctx)', splitIndex));
  const shiftIndex = midiEditorSource.indexOf('  drawSongShiftTool(ctx)');
  const shiftBody = midiEditorSource.slice(shiftIndex, midiEditorSource.indexOf('  drawSongAutomationOverlay(ctx, laneBounds, track, options = {})', shiftIndex));
  const automationIndex = midiEditorSource.indexOf('  drawSongAutomationOverlay(ctx, laneBounds, track, options = {})');
  const automationBody = midiEditorSource.slice(automationIndex, midiEditorSource.indexOf('  drawAutomationLane(ctx, bounds, keyframes, minValue, maxValue, label, timeline, indicator = null)', automationIndex));
  const automationLaneIndex = midiEditorSource.indexOf('  drawAutomationLane(ctx, bounds, keyframes, minValue, maxValue, label, timeline, indicator = null)');
  const automationLaneBody = midiEditorSource.slice(automationLaneIndex, midiEditorSource.indexOf('  drawPedalBoardPanel(ctx, x, y, w, h, track, options = {})', automationLaneIndex));

  assert.ok(selectionIndex > 0);
  assert.ok(splitIndex > selectionIndex);
  assert.ok(shiftIndex > splitIndex);
  assert.ok(automationIndex > shiftIndex);
  assert.equal(selectionBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(selectionBody.includes("const isPortrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(selectionBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(selectionBody.includes('this.isMobileLayout() ? 188 : 168'), false);
  assert.equal(splitBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(splitBody.includes('const grabW = isTouchViewportMode ? 72 : 56;'), true);
  assert.equal(splitBody.includes('this.isMobileLayout() ? 72 : 56'), false);
  assert.equal(shiftBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(shiftBody.includes('const sliderW = isTouchViewportMode ? 28 : 22;'), true);
  assert.equal(shiftBody.includes('this.isMobileLayout() ? 28 : 22'), false);
  assert.equal(automationBody.includes("const markerSize = this.activeViewportMode !== 'desktop' ? 18 : 14;"), true);
  assert.equal(automationBody.includes('this.isMobileLayout() ? 18 : 14'), false);
  assert.equal(automationLaneBody.includes("const keyframeSize = this.activeViewportMode !== 'desktop' ? 24 : 20;"), true);
  assert.equal(automationLaneBody.includes('this.isMobileLayout() ? 24 : 20'), false);
});

test('Pixel gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  assert.equal(pixelStudioSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(pixelStudioSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(pixelStudioSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(pixelStudioSource.includes('  resolvePixelViewportMode(width = this.game?.canvas?.width || 0, height = this.game?.canvas?.height || 0, { editorId = this.tilePickerMode ? \'tile\' : \'pixel\' } = {}) {'), true);
  assert.equal(pixelStudioSource.includes("const viewportMode = this.resolvePixelViewportMode(width, height, { editorId: 'pixel' });"), true);
  assert.equal(pixelStudioSource.includes("const viewportMode = this.resolvePixelViewportMode(width, height, { editorId: 'tile' });"), true);
  assert.equal(pixelStudioSource.includes('const mobileLandscape = viewportMode.isMobileLandscape;'), true);
  assert.equal(pixelStudioSource.includes('if (viewportMode.isMobilePortrait) {'), true);
  assert.equal(pixelStudioSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(pixelStudioSource.includes('const gamepadSubmenuOnLeft = this.shouldDrawGamepadSubmenuOnLeft(width, height);'), true);
  assert.equal(pixelStudioSource.includes("drawerOpen: Boolean(this.mobileDrawer && this.mobileDrawer !== 'timeline' && !gamepadSubmenuOnLeft)"), true);
  assert.equal(pixelStudioSource.includes('if (gamepadSubmenuOnLeft) {\n        this.drawGamepadSlideOutPanel(ctx, rail);'), true);
  assert.equal(pixelStudioSource.includes('return this.getGamepadMenuState(width, height).drawSlideOut;'), true);
  const gamepadStateIndex = pixelStudioSource.indexOf('  getGamepadMenuState(width = this.game?.canvas?.width || 0, height = this.game?.canvas?.height || 0) {');
  const gamepadStateBody = pixelStudioSource.slice(gamepadStateIndex, pixelStudioSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)', gamepadStateIndex));
  assert.ok(gamepadStateIndex > 0);
  assert.equal(gamepadStateBody.includes('const viewportMode = this.resolvePixelViewportMode(width, height, {'), true);
  assert.equal(gamepadStateBody.includes('gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.()),'), true);
  assert.equal(gamepadStateBody.includes('gamepadConnected: this.game?.input?.isGamepadConnected?.(),'), false);
  assert.equal(gamepadStateBody.includes('isMobile: viewportMode.isMobileViewport,'), true);
  assert.equal(gamepadStateBody.includes('isMobile: this.isMobileLayout(),'), false);
  assert.equal(pixelStudioSource.includes("getEditorControllerRootMenuEntries('pixel')"), true);
  assert.equal(pixelStudioSource.includes('const PIXEL_LEFT_PANEL_TABS = PIXEL_CONTROLLER_ROOT_ENTRIES.map((entry) => entry.id);'), true);
  assert.equal(pixelStudioSource.includes("const PIXEL_MOBILE_DRAWER_TABS = PIXEL_LEFT_PANEL_TABS.filter((id) => !['edit', 'view'].includes(id));"), true);
  assert.equal(pixelStudioSource.includes('this.leftPanelTabs = PIXEL_LEFT_PANEL_TABS.slice();'), true);
  assert.equal(pixelStudioSource.includes("this.activeViewportMode !== 'desktop' && PIXEL_MOBILE_DRAWER_TABS.includes(tab)"), true);
  assert.equal(pixelStudioSource.includes('this.isMobileLayout() && PIXEL_MOBILE_DRAWER_TABS.includes(tab)'), false);
  assert.equal(pixelStudioSource.includes("if (this.activeViewportMode !== 'desktop' && this.paletteBarScrollBounds"), true);
  assert.equal(pixelStudioSource.includes('if (this.isMobileLayout() && this.paletteBarScrollBounds'), false);
  assert.equal(pixelStudioSource.includes("isTouchViewportMode() {\n    return (this.activeViewportMode || 'desktop') !== 'desktop';\n  }"), true);
  assert.equal(pixelStudioSource.includes("if (this.isTouchViewportMode()) {\n      this.mobileDrawer = 'panel';"), true);
  assert.equal(pixelStudioSource.includes("if (this.isTouchViewportMode()) {\n      this.mobileDrawer = null;"), true);
  assert.equal(pixelStudioSource.includes("if (this.isTouchViewportMode()) {\n          this.mobileDrawer = null;"), true);
  assert.equal(pixelStudioSource.includes("if (this.isMobileLayout()) {\n          this.mobileDrawer = null;"), false);
  assert.equal(pixelStudioSource.includes('if (this.isTouchViewportMode()) return false;'), true);
  assert.equal(pixelStudioSource.includes('!(this.isTouchViewportMode() && this.mobileDrawer)'), true);
  assert.equal(pixelStudioSource.includes("this.statusMessage = this.isTouchViewportMode()\n          ? 'Tap Source, then tap canvas'"), true);
  assert.equal(pixelStudioSource.includes("this.statusMessage = this.isTouchViewportMode()\n        ? 'Tap Set Source, then tap canvas'"), true);
  assert.equal(pixelStudioSource.includes('const hitSize = this.isTouchViewportMode() ? 28 : 20;'), true);
  assert.equal(pixelStudioSource.includes('const hitSize = this.isMobileLayout?.() ? 28 : 20;'), false);
  const mobileDrawerIndex = pixelStudioSource.indexOf('  drawMobileDrawer(ctx, x, y, w, h, type) {');
  const mobileDrawerBody = pixelStudioSource.slice(mobileDrawerIndex, pixelStudioSource.indexOf('  drawColorPickerPanel(ctx, x, y, w, h)', mobileDrawerIndex));
  assert.ok(mobileDrawerIndex > 0);
  assert.equal(mobileDrawerBody.includes("const isLandscape = this.activeViewportMode === 'landscape-touch'"), true);
  assert.equal(mobileDrawerBody.includes("this.activeViewportMode === 'landscape'\n"), false);
  assert.equal(mobileDrawerBody.includes('isMobileLandscapeLayout({\n        isMobile: this.isMobileLayout(),'), false);
  assert.equal(pixelStudioSource.includes("this.isMobileLayout() && ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'animation', 'bones'].includes(tab)"), false);
  assert.equal(pixelStudioSource.includes('!(this.isMobileLayout() && this.mobileDrawer)'), false);
  assert.equal(pixelStudioSource.includes('if (this.isMobileLayout()) return false;'), false);
  assert.equal(pixelStudioSource.includes('entry.controllerMenuId'), true);
  assert.equal(pixelStudioSource.includes('siblingOrder: PIXEL_CONTROLLER_SIBLING_ORDER'), true);
  assert.equal(pixelStudioSource.includes('items: PIXEL_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem('), true);
  assert.equal(pixelStudioSource.includes("if (this.leftPanelTab === 'view') {\n      this.drawControllerSubmenuPanel(ctx, x, y, w, h, 'view');"), true);
  assert.equal(pixelStudioSource.includes('const mobileRootMenuSurface = mobileLandscapeLayout?.surfaces?.compactCommandRail ?? mobileLandscapeLayout?.surfaces?.rootMenu;'), true);
  assert.equal(pixelStudioSource.includes('const mobileSubmenuSurface = mobileLandscapeLayout?.surfaces?.submenu;'), true);
  assert.equal(pixelStudioSource.includes('const mobileWorkSurface = mobileLandscapeLayout?.surfaces?.workSurface;'), true);
  assert.equal(pixelStudioSource.includes('this.drawGamepadSlideOutPanel(ctx, rail);'), true);
  assert.equal(pixelStudioSource.includes("scrollGroup: 'gamepadSubmenu'"), true);
  assert.equal(pixelStudioSource.includes('this.gamepadSlideOutMenuMeta = {'), true);
  assert.equal(pixelStudioSource.includes("this.menuScrollDrag.scrollGroup === 'gamepadSubmenu'"), true);
  assert.equal(pixelStudioSource.includes('this.controllerMenu.scroll[menuId] = clamp(next, 0, maxScroll);'), true);
  assert.equal(pixelStudioSource.includes('return this.getGamepadMenuState(width, height).drawControllerOverlay;'), true);
});

test('Pixel landscape touch keeps a fixed four-button rail, left root drawer, and right submenu rail', () => {
  const layout = buildPixelMobileEditorLayout(844, 390, {
    isMobile: true,
    drawerOpen: true
  });

  assert.equal(layout.orientation, 'landscape');
  assert.equal(layout.compactLandscapeRootRail, true);
  assert.equal(layout.drawerOverlaysWorkSurface, false);
  assert.equal(layout.drawerOpensFromLeftRail, true);
  assert.ok(layout.surfaces.submenu);
  assert.equal(layout.rootDrawerSurface, 'left-overlay-drawer');
  assert.equal(layout.rootDrawerOverlayOrigin, 'left');
  assert.equal(layout.surfaces.rootDrawer.x >= layout.surfaces.compactCommandRail.x + layout.surfaces.compactCommandRail.w, true);
  assert.equal(layout.surfaces.rootDrawer.x < layout.surfaces.submenu.x, true);
  assert.equal(layout.surfaces.submenu.x + layout.surfaces.submenu.w, 844);
  assert.equal(layout.surfaces.compactCommandRail.w <= 96, true);
  assert.equal(layout.surfaces.compactCommandRail.h, 390);
  assert.equal(layout.surfaces.toolOptions.y >= layout.surfaces.workSurface.y + layout.surfaces.workSurface.h, true);
  assert.equal(layout.surfaces.zoom, null);
  assert.equal(intersects(layout.surfaces.rootDrawer, layout.surfaces.toolOptions), false);
  assert.equal(intersects(layout.surfaces.submenu, layout.surfaces.toolOptions), false);
  assert.equal(pixelStudioSource.includes("const mobileDrawerReserveW = isMobile && !mobileLandscape && this.mobileDrawer && this.mobileDrawer !== 'timeline'"), true);
  assert.equal(pixelStudioSource.includes('drawPixelLandscapeMenuDrawer(ctx, x, y, w, h)'), true);
  assert.equal(pixelStudioSource.includes('drawPixelLandscapeZoomControl(ctx, bounds)'), true);
  assert.equal(pixelStudioSource.includes('drawSharedPanel(ctx, zoomBounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(pixelStudioSource.includes("drawSharedPanel(ctx, zoomBounds, { fill: 'rgba(15,18,24,0.88)', border: UI_SUITE.colors.border });"), false);
  assert.equal(pixelStudioSource.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(pixelStudioSource.includes('getPixelLandscapeRootMenuItems()'), true);
  assert.equal(pixelStudioSource.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(pixelStudioSource.includes('const scrolledGrid = buildScrolledLandscapeRootDrawerItems(grid, this.focusScroll.landscapeRoot || 0);'), false);
  assert.equal(pixelStudioSource.includes('this.focusScroll.landscapeRoot = 0;'), true);
  assert.equal(pixelStudioSource.includes('this.landscapeRootMenuMeta = {'), true);
  assert.equal(pixelStudioSource.includes('grid.items.forEach(({ index, bounds }) => {'), true);
  assert.equal(pixelStudioSource.includes('maxScroll: 0,'), true);
  assert.equal(pixelStudioSource.includes("this.mobileDrawer = 'panel';"), true);
  assert.equal(pixelStudioSource.includes('this.drawPixelPortraitZoomSlider(ctx, zoomBounds);'), true);
  assert.equal(pixelStudioSource.includes('x: workBounds.x + padding,'), false);
  assert.equal(pixelStudioSource.includes('x: workBounds.x + workBounds.w - zoomW - padding,'), false);
  assert.equal(pixelStudioSource.includes('drawSharedPortraitScrollHints(ctx, rootBounds, {'), true);
  const landscapeBottomIndex = pixelStudioSource.indexOf('  drawPixelLandscapeBottomControls(ctx, bounds)');
  const landscapeZoomIndex = pixelStudioSource.indexOf('  drawPixelLandscapeZoomControl(ctx, bounds)');
  const landscapeBottomBody = pixelStudioSource.slice(landscapeBottomIndex, landscapeZoomIndex);
  assert.equal(landscapeBottomBody.includes('this.drawPixelLandscapeZoomControl(ctx, {'), true);
  assert.equal(landscapeBottomBody.includes('w: showZoom ? Math.max(1, bounds.w - zoomW - gap) : bounds.w,'), true);
  assert.equal(pixelStudioSource.includes('items.slice(start, start + visibleRows).forEach((entry, index) => {'), false);
});

test('editors inherit the shared landscape left-origin root drawer default', () => {
  SHARED_EDITOR_IDS.forEach((editorId) => {
    assert.equal(
      editorSourceById[editorId].includes("rootDrawerOverlayOrigin: 'left'"),
      false,
      `${editorId} should rely on the shared landscape root drawer default`
    );
  });
});

test('Pixel desktop keeps layers on the right rail and frames on the bottom strip', () => {
  const desktopIndex = pixelStudioSource.indexOf("      ? buildDesktopEditorShellPlan('pixel', {");
  const desktopBlock = pixelStudioSource.slice(desktopIndex, pixelStudioSource.indexOf('      })', desktopIndex));
  const rightRailIndex = pixelStudioSource.indexOf('  drawRightRail(ctx, x, y, w, h)');
  const rightRailBody = pixelStudioSource.slice(rightRailIndex, pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})', rightRailIndex));
  const layersPanelIndex = pixelStudioSource.indexOf('  drawLayersPanel(ctx, x, y, w, h, options = {})');
  const layersPanelBody = pixelStudioSource.slice(layersPanelIndex, pixelStudioSource.indexOf('  drawPixelPreviewPixels(ctx, pixels, width, height, bounds)', layersPanelIndex));
  const frameStripIndex = pixelStudioSource.indexOf('  drawDesktopFrameStrip(ctx, x, y, w, h)');
  const frameStripBody = pixelStudioSource.slice(frameStripIndex, pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})', frameStripIndex));
  const framesPanelIndex = pixelStudioSource.indexOf('  drawFramesPanel(ctx, x, y, w, h, options = {})');
  const framesPanelBody = pixelStudioSource.slice(framesPanelIndex);
  const desktopChromeIndex = pixelStudioSource.indexOf('  drawDesktopShellChrome(ctx, shell)');
  const desktopChromeBody = pixelStudioSource.slice(desktopChromeIndex, pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)', desktopChromeIndex));
  const contextIndex = pixelStudioSource.indexOf('  drawDesktopContextPanel(ctx, bounds)');
  const contextBody = pixelStudioSource.slice(contextIndex, pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)', contextIndex));
  const statusIndex = pixelStudioSource.indexOf('  drawStatusBar(ctx, x, y, w, h, options = {})');
  const statusBody = pixelStudioSource.slice(statusIndex, pixelStudioSource.indexOf('  drawSelectionContextMenu(ctx, width, height)', statusIndex));

  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(pixelStudioSource.includes('const desktopShell = viewportMode.isDesktop && !menuFullScreen'), true);
  assert.equal(pixelStudioSource.includes('const desktopShell = viewportMode.isDesktop && this.sidebars.left'), false);
  assert.equal(desktopBlock.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(desktopBlock.includes('dropdownScroll: this.desktopDropdownScroll?.[desktopRootId] || 0'), false);
  assert.equal(pixelStudioSource.includes("const PIXEL_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('pixel');"), true);
  assert.equal(rightRailBody.includes('this.drawFramesPanel(ctx'), false);
  assert.equal(rightRailBody.includes('this.drawLayersPanel(ctx, x + 4, y + 4, w - 8, h - 8, { isMobile: false });'), true);
  assert.equal(pixelStudioSource.includes('this.drawDesktopFrameStrip(ctx, canvasX, timelineY, canvasW, frameStripHeight);'), true);
  assert.equal(layersPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(layersPanelBody.includes('UI_SUITE.editorPanel.bodyFont'), true);
  assert.equal(frameStripBody.includes('ctx.font = UI_SUITE.editorPanel.titleFont;'), true);
  assert.equal(framesPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(framesPanelBody.includes('UI_SUITE.editorPanel.bodyFont'), true);
  assert.equal(desktopChromeBody.includes('this.drawDesktopContextPanel(ctx, shell.leftOptions);'), true);
  assert.equal(desktopChromeBody.includes('this.drawLeftPanelContent(ctx, shell.leftOptions.x'), false);
  assert.equal(desktopChromeBody.includes('subtitle: this.getDesktopPanelLabel()'), true);
  assert.equal(contextBody.includes('const { contextBounds } = buildSharedDesktopContextTransportLayout(bounds, {'), true);
  assert.equal(contextBody.includes('includeTransport: false'), true);
  assert.equal(contextBody.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(contextBody.includes('`Active: ${this.getDesktopPanelLabel()}`'), true);
  assert.equal(contextBody.includes('`Tool: ${activeTool?.label || this.activeToolId || \'Unknown\'}`'), true);
  assert.equal(contextBody.includes('`Layer: ${this.canvasState.activeLayerIndex + 1}/${layerCount}${layer?.name ? ` ${layer.name}` : \'\'}'), true);
  assert.equal(statusBody.includes('getBottomRailActions()'), false);
  assert.equal(statusBody.includes("['layers', 'animation'].includes(this.leftPanelTab)"), false);
});

test('Pixel modal shells use shared RTG Studio panel chrome', () => {
  const transformIndex = pixelStudioSource.indexOf('  drawTransformModal(ctx, width, height)');
  const transformBody = pixelStudioSource.slice(transformIndex, pixelStudioSource.indexOf('  drawPasteImportModal(ctx, width, height)', transformIndex));
  const pasteIndex = pixelStudioSource.indexOf('  drawPasteImportModal(ctx, width, height)');
  const pasteBody = pixelStudioSource.slice(pasteIndex, pixelStudioSource.indexOf('  drawPastePreviewCard(ctx, bounds, label, clipboard, active = false)', pasteIndex));
  const brushIndex = pixelStudioSource.indexOf('  drawBrushPickerModal(ctx, x, y, w, h)');
  const brushBody = pixelStudioSource.slice(brushIndex, pixelStudioSource.indexOf('  drawPixelBackground(ctx, x, y, w, h, cellSize = 16)', brushIndex));

  assert.ok(transformIndex > 0);
  assert.ok(pasteIndex > transformIndex);
  assert.ok(brushIndex > pasteIndex);
  assert.equal(transformBody.includes('drawSharedPanel(ctx, modal, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(transformBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(transformBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(transformBody.includes("ctx.fillStyle = '#1b1b1b';"), false);
  assert.equal(transformBody.includes("ctx.font = '14px Courier New';"), false);
  assert.equal(pasteBody.includes('drawSharedPanel(ctx, modal, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(pasteBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(pasteBody.includes('ctx.font = `16px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pasteBody.includes("ctx.fillStyle = 'rgba(12,16,24,0.96)';"), false);
  assert.equal(pasteBody.includes("ctx.font = '16px Courier New';"), false);
  assert.equal(brushBody.includes('drawSharedPanel(ctx, modal, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(brushBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(brushBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(brushBody.includes("ctx.font = '12px monospace';"), false);
});

test('Pixel tile picker screen uses shared RTG Studio text tokens', () => {
  const tilePickerIndex = pixelStudioSource.indexOf('  drawTilePickerScreen(ctx, width, height)');
  const tilePickerBody = pixelStudioSource.slice(tilePickerIndex, pixelStudioSource.indexOf('  async promptForNewArtName()', tilePickerIndex));
  const tilePickerPortraitBranch = tilePickerBody.slice(
    tilePickerBody.indexOf('const listOuter = portrait'),
    tilePickerBody.indexOf(': desktopShell', tilePickerBody.indexOf('const listOuter = portrait'))
  );
  const tileChromeIndex = pixelStudioSource.indexOf('  drawTilePickerDesktopChrome(ctx, shell)');
  const tileChromeBody = pixelStudioSource.slice(tileChromeIndex, pixelStudioSource.indexOf('  async promptForNewArtName()', tileChromeIndex));

  assert.ok(tilePickerIndex > 0);
  assert.ok(tileChromeIndex > tilePickerIndex);
  assert.equal(tilePickerBody.includes("editorId: 'tile'"), true);
  assert.equal(tilePickerBody.includes('this.activeModeContract = viewportMode.modeContract;'), true);
  assert.equal(tilePickerBody.includes('this.activeSpecModeContract = viewportMode.specModeContract;'), true);
  assert.equal(tilePickerBody.includes('const isMobile = viewportMode.isMobileViewport;'), true);
  assert.equal(tilePickerBody.includes('const desktop = viewportMode.isDesktop;'), true);
  assert.equal(tilePickerBody.includes('const portrait = viewportMode.isPortrait;'), true);
  assert.equal(tilePickerBody.includes('const gamepad = viewportMode.isGamepad;'), true);
  assert.equal(tilePickerBody.includes('this.activeViewportMode = viewportMode.mode;'), true);
  assert.equal(tilePickerBody.includes('if (desktop) resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(tilePickerBody.includes("buildLandscapeTouchEditorShellPlan('tile', {"), true);
  assert.equal(tilePickerBody.includes("buildGamepadSlideOutMenuPlan('tile', {"), true);
  assert.equal(tilePickerBody.includes("const canRenderTileLandscapeRootRail = canRenderEditorPlanSurface(tileLandscapeShell, 'left-rail');"), true);
  assert.equal(tilePickerBody.includes("const canRenderTileLandscapeBottomRail = canRenderEditorPlanSurface(tileLandscapeShell, 'bottom-tool-rail');"), true);
  assert.equal(tilePickerBody.includes("const canRenderTileLandscapeRightSubmenu = canRenderEditorPlanSurface(tileLandscapeShell, 'right-drawer')"), true);
  assert.equal(tilePickerBody.includes("&& canRenderEditorPlanSurface(tileLandscapeShell, 'landscape-right-submenu');"), true);
  assert.equal(tilePickerBody.includes('if (tileRootRailSurface) this.drawTileLandscapeRail(ctx, tileRootRailSurface);'), true);
  assert.equal(tilePickerBody.includes('if (tileBottomRailSurface) this.drawTileLandscapeBottomRail(ctx, tileBottomRailSurface);'), true);
  assert.equal(tilePickerBody.includes('if (tileRootDrawerSurface) this.drawTileLandscapeRootDrawer(ctx, tileRootDrawerSurface);'), true);
  assert.equal(tilePickerBody.includes('if (tileSubmenuSurface) this.drawTileLandscapeSubmenu(ctx, tileSubmenuSurface);'), true);
  assert.equal(tilePickerBody.includes('const portraitActions = this.getTilePortraitToolbarActions();'), true);
  assert.equal(tilePickerBody.includes('drawSharedPortraitActionRail(ctx, layout.middleRail, this.panJoystick, portraitActions, {'), true);
  assert.equal(tilePickerBody.includes("if (canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail')) {"), true);
  assert.equal(tilePickerPortraitBranch.includes("this.drawButton(ctx, backBounds, 'Back'"), false);
  assert.equal(tilePickerBody.includes("const canRenderTileGamepadRootRail = canRenderEditorPlanSurface(tileGamepadShell, 'left-rail');"), true);
  assert.equal(tilePickerBody.includes("const canRenderTileGamepadBottomRail = canRenderEditorPlanSurface(tileGamepadShell, 'bottom-tool-rail');"), true);
  assert.equal(tilePickerBody.includes("const canRenderTileGamepadSlideOut = canRenderEditorPlanSurface(tileGamepadShell, 'left-overlay-drawer');"), true);
  assert.equal(tilePickerBody.includes('if (!tileGamepadPlan && canRenderTileGamepadRootRail) this.drawTileLandscapeRail(ctx, tileGamepadShell.surfaces.compactCommandRail);'), true);
  assert.equal(tilePickerBody.includes('if (canRenderTileGamepadBottomRail) this.drawTileLandscapeBottomRail(ctx, tileGamepadShell.surfaces.toolOptions);'), true);
  assert.equal(tilePickerBody.includes('this.drawTileGamepadRootDrawer(ctx, slideOut, tileGamepadPlan);'), true);
  assert.equal(tilePickerBody.includes('this.drawTileGamepadSubmenu(ctx, slideOut, tileGamepadPlan);'), true);
  assert.equal(tilePickerBody.includes("buildDesktopEditorShellPlan('tile', {"), true);
  assert.equal(tilePickerBody.includes('this.drawTilePickerDesktopChrome(ctx, desktopShell);'), true);
  assert.equal(tilePickerBody.includes('drawSharedPanel(ctx, surface, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(tilePickerBody.includes('if (desktopShell) this.drawDesktopShellDropdown(ctx, desktopShell);'), true);
  assert.equal(tilePickerBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(tilePickerBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(tilePickerBody.includes('ctx.font = `${portrait ? 20 : 24}px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tilePickerBody.includes('ctx.font = `13px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tilePickerBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tilePickerBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(tilePickerBody.includes("ctx.font = '13px Courier New';"), false);
  assert.equal(tilePickerBody.includes("ctx.font = '14px Courier New';"), false);
  assert.equal(tilePickerBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(tilePickerBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.8)';"), false);
  assert.equal(tileChromeBody.includes('drawSharedDesktopTopMenu(ctx, shell.topMenu, {'), true);
  assert.equal(tileChromeBody.includes('resolveOpenDesktopDropdownState({'), true);
  assert.equal(tileChromeBody.includes('drawSharedDesktopRibbon(ctx, shell.leftRibbon, {'), true);
  assert.equal(tileChromeBody.includes("title: 'Tile Editor'"), true);
  assert.equal(tileChromeBody.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(tileChromeBody.includes('`Active: ${tile?.label || \'Tile\'}`'), true);
  assert.equal(tileChromeBody.includes("this.drawButton(ctx, backBounds, 'Back to Game Menu'"), true);
  assert.equal(pixelStudioSource.includes('const TILE_CONTROLLER_ROOT_ENTRIES = getEditorControllerRootMenuEntries(\'tile\');'), true);
  assert.equal(pixelStudioSource.includes('buildTileControllerMenus()'), true);
  {
    const tileListIndex = pixelStudioSource.indexOf("      'tile-list': {");
    const tileListBody = pixelStudioSource.slice(tileListIndex, pixelStudioSource.indexOf("      'tile-properties': {", tileListIndex));
    assert.equal(tileListBody.includes("action('tile-prev', 'Previous Tile'"), true);
    assert.equal(tileListBody.includes("action('tile-next', 'Next Tile'"), true);
    assert.equal(tileListBody.includes("action('tile-edit-art'"), false);
    assert.equal(tileListBody.includes("action('tile-reset'"), false);
  }
  assert.equal(pixelStudioSource.includes('getTilePortraitToolbarActions()'), true);
  assert.equal(pixelStudioSource.includes("return ['menu', 'undo', 'redo', 'edit']"), true);
  assert.equal(pixelStudioSource.includes("'tile-file': {"), true);
  assert.equal(pixelStudioSource.includes("'tile-properties': {"), true);
  assert.equal(pixelStudioSource.includes('drawTileLandscapeRail(ctx, bounds)'), true);
  assert.equal(pixelStudioSource.includes('drawTileLandscapeRootDrawer(ctx, bounds)'), true);
  assert.equal(pixelStudioSource.includes('drawTileLandscapeSubmenu(ctx, bounds)'), true);
  assert.equal(pixelStudioSource.includes('drawTileGamepadRootDrawer(ctx, bounds, plan = null)'), true);
  assert.equal(pixelStudioSource.includes('drawTileGamepadSubmenu(ctx, bounds, plan = null)'), true);
  assert.equal(pixelStudioSource.includes('drawSharedGamepadSlideOutHeader(ctx, bounds'), true);
  assert.equal(pixelStudioSource.includes("sourceSurface: submenu?.sourceSurface || 'gamepad-slide-out'"), true);
  assert.equal(pixelStudioSource.includes('handleTilePickerCancel()'), true);
  assert.equal(pixelStudioSource.includes("if (!this.tilePickerMode || this.activeViewportMode !== 'gamepad' || this.mobileDrawer !== 'panel') return false;"), true);
  assert.equal(pixelStudioSource.includes('if (this.tileGamepadSubmenuOpen) {\n      this.tileGamepadSubmenuOpen = false;'), true);
  assert.equal(pixelStudioSource.includes('this.mobileDrawer = null;\n    this.tileGamepadFocusedItemId = null;\n    return true;'), true);
});

test('Pixel preview panels use shared RTG Studio panel chrome', () => {
  const pastePreviewIndex = pixelStudioSource.indexOf('  drawPastePreviewCard(ctx, bounds, label, clipboard, active = false)');
  const pastePreviewBody = pixelStudioSource.slice(pastePreviewIndex, pixelStudioSource.indexOf('  isMobileLayout()', pastePreviewIndex));
  const previewPanelIndex = pixelStudioSource.indexOf('  drawPreviewPanel(ctx, x, y, w, h)');
  const previewPanelBody = pixelStudioSource.slice(previewPanelIndex, pixelStudioSource.indexOf('  drawLeftPanel(ctx, x, y, w, h, options = {})', previewPanelIndex));

  assert.ok(pastePreviewIndex > 0);
  assert.ok(previewPanelIndex > pastePreviewIndex);
  assert.equal(pastePreviewBody.includes('drawSharedPanel(ctx, bounds, {'), true);
  assert.equal(pastePreviewBody.includes('fill: UI_SUITE.colors.panelAlt,'), true);
  assert.equal(pastePreviewBody.includes('border: active ? UI_SUITE.colors.accent : UI_SUITE.colors.border'), true);
  assert.equal(pastePreviewBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(pastePreviewBody.includes('ctx.font = `11px ${UI_SUITE.font.family}`;'), true);
  assert.equal(pastePreviewBody.includes("ctx.fillStyle = 'rgba(0,0,0,0.45)';"), false);
  assert.equal(pastePreviewBody.includes("ctx.font = '11px Courier New';"), false);
  assert.equal(previewPanelBody.includes('drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(previewPanelBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(previewPanelBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(previewPanelBody.includes("ctx.fillStyle = 'rgba(0,0,0,0.5)';"), false);
  assert.equal(previewPanelBody.includes("ctx.font = '12px Courier New';"), false);
});

test('Pixel desktop layer and frame drawers include management commands before dynamic selectors', () => {
  const controllerIndex = pixelStudioSource.indexOf('  buildControllerMenus()');
  const controllerBody = pixelStudioSource.slice(controllerIndex, pixelStudioSource.indexOf('  applyInputActions(', controllerIndex));

  assert.equal(controllerBody.includes('const layerManagementItems = ['), true);
  assert.equal(controllerBody.includes("action('layer-add', 'Add Layer'"), true);
  assert.equal(controllerBody.includes("action('layer-merge-up', 'Merge Up'"), true);
  assert.equal(controllerBody.includes("action('layer-merge-down', 'Merge Down'"), true);
  assert.equal(controllerBody.includes("action('layer-flatten', 'Flatten Layers'"), true);
  assert.equal(controllerBody.includes("{ id: 'layer-selection-divider', divider: true }"), true);
  assert.equal(controllerBody.includes('...this.canvasState.layers'), true);
  assert.equal(controllerBody.includes('const frameManagementItems = ['), true);
  assert.equal(controllerBody.includes("action('frame-add', 'Add Frame'"), true);
  assert.equal(controllerBody.includes("action('frame-delay', 'Frame Delay'"), true);
  assert.equal(controllerBody.includes("action('frame-play', this.animation.playing ? 'Pause Playback' : 'Play Playback'"), true);
  assert.equal(controllerBody.includes("action('frame-rewind', 'Rewind Frames'"), true);
  assert.equal(controllerBody.includes("{ id: 'frame-selection-divider', divider: true }"), true);
  assert.equal(controllerBody.includes('...this.animation.frames.map'), true);
});

test('Pixel layer and frame fitted labels use shared RTG Studio typography', () => {
  const layersIndex = pixelStudioSource.indexOf('  drawLayersPanel(ctx, x, y, w, h, options = {})');
  const layersBody = pixelStudioSource.slice(layersIndex, pixelStudioSource.indexOf('  drawPixelPreviewPixels(ctx, pixels, width, height, bounds)', layersIndex));
  const fittedIndex = pixelStudioSource.indexOf('  drawFittedText(ctx, text, x, y, maxWidth, fontSize = 12)');
  const fittedBody = pixelStudioSource.slice(fittedIndex, pixelStudioSource.indexOf('  getLayerPixelRefs()', fittedIndex));

  assert.ok(layersIndex > 0);
  assert.ok(fittedIndex > layersIndex);
  assert.equal(layersBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(layersBody.includes('ctx.font = isMobile ? UI_SUITE.editorPanel.titleFont : UI_SUITE.editorPanel.bodyFont;'), true);
  assert.equal(layersBody.includes('ctx.font = `${isMobile ? 16 : 14}px Courier New`;'), false);
  assert.equal(fittedBody.includes('ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;'), true);
  assert.equal(fittedBody.includes('ctx.font = `${fontSize}px Courier New`;'), false);
});

test('Pixel desktop canvas pan uses the shared pointer policy', () => {
  const pointerDownIndex = pixelStudioSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = pixelStudioSource.slice(pointerDownIndex, pixelStudioSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const policyIndex = pointerDownBody.indexOf("getEditorPointerInteractionPolicy('pixel'");
  const panIndex = pointerDownBody.indexOf('if (this.spaceDown || shouldPanWithButton) {');

  assert.ok(pointerDownIndex >= 0);
  assert.ok(policyIndex > 0);
  assert.ok(panIndex > policyIndex);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.middleDragPan'), true);
  assert.equal(pointerDownBody.includes('pointerPolicy.workSurfaceGestures.rightDragPan'), true);
  assert.equal(pointerDownBody.includes("const isDesktopMode = this.activeViewportMode === 'desktop';"), true);
  assert.equal(pointerDownBody.includes('const isTouchMode = !isDesktopMode;'), true);
  assert.equal(pointerDownBody.includes('if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({'), true);
  assert.equal(pointerDownBody.includes('if (isDesktopMode) {\n      const desktopDropdownHit = this.uiButtons.find'), true);
  assert.equal(pointerDownBody.includes('if (isTouchMode && this.mobileDrawerBounds)'), true);
  assert.equal(pointerDownBody.includes('if (this.mobileDrawerBounds) {'), false);
  assert.equal(pointerDownBody.includes('const pointerPolicy = isDesktopMode'), true);
  assert.equal(pointerDownBody.includes('this.spaceDown || button === 1 || button === 2'), false);
  assert.equal(pixelStudioSource.includes('getEditorPointerInteractionPolicy'), true);
});

test('Pixel desktop dropdown caps rendered rows to drawer bounds', () => {
  const dropdownIndex = pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)');
  const dropdownBody = pixelStudioSource.slice(dropdownIndex, pixelStudioSource.indexOf('  getActiveGamepadMenuId()', dropdownIndex));

  assert.equal(dropdownBody.includes('const controllerMenus = this.tilePickerMode ? this.buildTileControllerMenus() : this.buildControllerMenus();'), true);
  assert.equal(dropdownBody.includes('const menu = controllerMenus[menuId] || this.controllerMenu.menus?.[menuId];'), true);
  assert.equal(dropdownBody.includes('const menuItems = this.controllerMenu.getItems(menu);'), true);
  assert.equal(dropdownBody.includes('const dropdownPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(dropdownBody.includes('disableActionlessItems: true'), true);
  assert.equal(dropdownBody.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(dropdownBody.includes('registerButton: ({ item, bounds: buttonBounds }) => {'), true);
  assert.equal(dropdownBody.includes('this.uiButtons.push(createDesktopDropdownCommandHit(item, buttonBounds, onClick, {'), true);
  assert.equal(dropdownBody.includes('sourceRootId: shell.dropdown.rootId || null'), true);
  assert.equal(dropdownBody.includes('this.registerFocusable(menuId, buttonBounds, onClick);'), true);
});

test('Pixel desktop dropdown commands only fire on release', () => {
  const pointerDownIndex = pixelStudioSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = pixelStudioSource.slice(pointerDownIndex, pixelStudioSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const pointerMoveIndex = pixelStudioSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = pixelStudioSource.slice(pointerMoveIndex, pixelStudioSource.indexOf('  handlePointerUp(payload = {})', pointerMoveIndex));
  const pointerUpIndex = pixelStudioSource.indexOf('  handlePointerUp(payload = {})');
  const pointerUpBody = pixelStudioSource.slice(pointerUpIndex, pixelStudioSource.indexOf('  handleWheel(payload)', pointerUpIndex));
  const priorityIndex = pixelStudioSource.indexOf('    let hit = null;');
  const priorityBody = pixelStudioSource.slice(priorityIndex, pixelStudioSource.indexOf('    if (hit) {', priorityIndex));

  assert.ok(pointerDownIndex >= 0);
  assert.ok(pointerMoveIndex > pointerDownIndex);
  assert.ok(pointerUpIndex > pointerMoveIndex);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, payload);'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.onClick?.('), false);
  assert.equal(pointerMoveBody.includes('this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);'), true);
  assert.equal(pointerUpBody.includes('if (this.pendingDesktopDropdownHit) {'), true);
  assert.equal(pointerUpBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, payload);'), true);
  assert.equal(pointerUpBody.includes('if (shouldActivate) {'), true);
  assert.equal(pointerUpBody.includes('hit.onClick?.({ x: payload.x, y: payload.y, id: payload.id });'), true);
  assert.equal(pointerUpBody.includes('if (!this.shouldKeepDesktopDropdownOpenAfterCommand(hit)) {'), true);
  assert.equal(pointerUpBody.includes('const nextDropdown = resolveClosedDesktopDropdownState({'), true);
  assert.equal(pointerUpBody.includes('this.desktopDropdown = nextDropdown.dropdown;'), true);
  assert.equal(pixelStudioSource.includes("shouldKeepDesktopDropdownOpenAfterCommand(hit = {})"), true);
  assert.equal(pixelStudioSource.includes("new Set(['draw', 'select', 'tools', 'layers', 'frames', 'bones']).has(menuId)"), true);
  assert.equal(pixelStudioSource.includes('desktopDropdownMenuId: menuId'), true);
  assert.equal(priorityBody.includes('if (button.desktopDropdownItem) continue;'), true);
});

test('desktop dropdown drawers are backed by live action menus across editors', () => {
  const pixelDropdown = pixelStudioSource.slice(
    pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)'),
    pixelStudioSource.indexOf('  getActiveGamepadMenuId()', pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)'))
  );
  const levelDropdown = levelEditorSource.slice(
    levelEditorSource.indexOf('if (shellLayout.dropdown) {'),
    levelEditorSource.indexOf('const infoLines = []', levelEditorSource.indexOf('if (shellLayout.dropdown) {'))
  );
  const midiDropdown = midiEditorSource.slice(
    midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'),
    midiEditorSource.indexOf('  drawControllerSubmenuPanel(ctx, x, y, w, h, menuId', midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'))
  );
  const sfxDropdown = sfxEditorSource.slice(
    sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'),
    sfxEditorSource.indexOf('  getActiveGamepadMenuId()', sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'))
  );
  const cutsceneDropdown = cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)'),
    cutsceneEditorSource.indexOf('  getTransportActions()', cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)'))
  );
  const actorDropdown = actorEditorSource.slice(
    actorEditorSource.indexOf('  renderDesktopDropdown(shellLayout)'),
    actorEditorSource.indexOf('  renderDesktopLeftPanel(optionsPanel)', actorEditorSource.indexOf('  renderDesktopDropdown(shellLayout)'))
  );

  [
    pixelDropdown,
    levelDropdown,
    midiDropdown,
    sfxDropdown,
    cutsceneDropdown
  ].forEach((dropdownBody) => {
    assert.equal(dropdownBody.includes('this.buildControllerMenus()'), true);
    assert.equal(dropdownBody.includes('drawSharedDesktopDropdown'), true);
  });

  assert.equal(actorDropdown.includes('const actions = this.getActorDesktopDropdownActions(rootId);'), true);
  assert.equal(actorDropdown.includes('items: actions'), true);
  assert.equal(actorEditorSource.includes('active: Boolean(item.active)'), true);
  assert.equal(pixelDropdown.includes('dropdown.items'), false);
  assert.equal(levelDropdown.includes('items: controllerItems'), true);
  assert.equal(midiDropdown.includes('items,'), true);
  assert.equal(sfxDropdown.includes('items: controllerItems'), true);
  assert.equal(cutsceneDropdown.includes('items: controllerItems'), true);
  [
    levelDropdown,
    midiDropdown,
    sfxDropdown,
    cutsceneDropdown
  ].forEach((dropdownBody) => {
    assert.equal(dropdownBody.includes('dropdown.items'), false);
    assert.equal(dropdownBody.includes('dropdownItems = controllerItems.length'), false);
    assert.equal(dropdownBody.includes('fallbackItems'), false);
  });
  [
    pixelDropdown,
    levelDropdown,
    midiDropdown,
    sfxDropdown,
    actorDropdown,
    cutsceneDropdown
  ].forEach((dropdownBody) => {
    assert.equal(dropdownBody.includes('disableActionlessItems: true'), true);
  });
  assert.equal(cutsceneDropdown.includes('this.handleButton(item.id)'), false);
});

test('shared desktop dropdown renderers register drag-safe regions where editor region registries exist', () => {
  const pixelDropdown = pixelStudioSource.slice(
    pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)'),
    pixelStudioSource.indexOf('  getActiveGamepadMenuId()', pixelStudioSource.indexOf('  drawDesktopShellDropdown(ctx, shell)'))
  );
  const levelDropdown = levelEditorSource.slice(
    levelEditorSource.indexOf('if (shellLayout.dropdown) {'),
    levelEditorSource.indexOf('const infoLines = []', levelEditorSource.indexOf('if (shellLayout.dropdown) {'))
  );
  const midiDropdown = midiEditorSource.slice(
    midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'),
    midiEditorSource.indexOf('  drawControllerSubmenuPanel(ctx, x, y, w, h, menuId', midiEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'))
  );
  const sfxDropdown = sfxEditorSource.slice(
    sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'),
    sfxEditorSource.indexOf('  getActiveGamepadMenuId()', sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)'))
  );
  const cutsceneDropdown = cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)'),
    cutsceneEditorSource.indexOf('  getTransportActions()', cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)'))
  );
  const raceDropdown = raceEditorSource.slice(
    raceEditorSource.indexOf('if (shell.dropdown) {'),
    raceEditorSource.indexOf('if (this.playtestPickerOpen)', raceEditorSource.indexOf('if (shell.dropdown) {'))
  );

  [
    pixelDropdown,
    levelDropdown,
    midiDropdown,
    sfxDropdown,
    cutsceneDropdown,
    raceDropdown
  ].forEach((dropdownBody) => {
    assert.equal(dropdownBody.includes('registerScrollRegion: (region) => {'), true);
    assert.equal(dropdownBody.includes('.push(region);'), true);
  });
  assert.equal(pixelStudioSource.includes('this.desktopDropdownRegions = [];'), true);
  assert.equal(pixelStudioSource.includes('const desktopDropdownRegion = this.desktopDropdownRegions?.find((region) => ('), true);
  assert.equal(levelEditorSource.includes('this.desktopDropdownRegions = [];'), true);
  assert.equal(levelEditorSource.includes('const desktopDropdownRegion = this.desktopDropdownRegions?.find((region) => ('), true);
  assert.equal(midiEditorSource.includes('const desktopDropdownRegion = findScrollableMenuRegion(this.menuScrollRegions, payload);'), true);
  assert.equal(sfxEditorSource.includes('const desktopDropdownRegion = this.menuScrollRegions?.find((region) => ('), true);
  assert.equal(cutsceneEditorSource.includes('const desktopDropdownRegion = isDesktopMode'), true);
  assert.equal(cutsceneEditorSource.includes('this.menuScrollRegions?.find((region) => region?.bounds && this.pointIn(region.bounds, x, y))'), true);
});

test('mobile editor layouts clear stale desktop dropdown state', () => {
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    actorEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('resolveDesktopDropdownState'), true);
  });
  assert.equal(pixelStudioSource.includes('previousDropdown: this.desktopDropdown'), true);
  assert.equal(levelEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });'), true);
  assert.equal(midiEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });'), true);
  assert.equal(sfxEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });'), true);
  assert.equal(cutsceneEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });'), true);
  assert.equal(raceEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });'), true);
  assert.equal(raceEditorSource.includes('this.desktopDropdown = null;\n    if (height >= width)'), false);
  assert.equal(actorEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({'), true);
  assert.equal(actorEditorSource.includes('isDesktop: isDesktopLayout,'), true);
  assert.equal(actorEditorSource.includes('dropdown: desktopShell?.dropdown'), true);
});

test('Pixel desktop top menu switches drawers on hover', () => {
  assert.equal(pixelStudioSource.includes('hoverRootId: button.id'), true);
  assert.equal(pixelStudioSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(pixelStudioSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount) {"), true);
  assert.equal(pixelStudioSource.includes("rootIdKey: 'hoverRootId'"), true);
  assert.equal(pixelStudioSource.includes('resolveOpenDesktopDropdownState({'), true);
  assert.equal(pixelStudioSource.includes('rootId: hoverRoot.rootId,'), true);
  assert.equal(pixelStudioSource.includes('items: PIXEL_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem('), true);
  assert.equal(pixelStudioSource.includes("edit: {\n        id: 'edit',\n        title: 'Edit'"), true);
  assert.equal(pixelStudioSource.includes("action('cut', 'Cut', () => this.cutSelection(), { disabled: !hasSelection })"), true);
  assert.equal(pixelStudioSource.includes('drawSharedDesktopTopMenu(ctx, shell.topMenu, {'), true);
  assert.equal(pixelStudioSource.includes('registerButton: (button) => {'), true);
  assert.equal(pixelStudioSource.includes('if (panelId && this.leftPanelTab !== panelId) this.setLeftPanelTab(panelId);'), false);
});

test('desktop top menus switch drawers on hover across editors', () => {
  assert.equal(pixelStudioSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount) {"), true);
  assert.equal(pixelStudioSource.includes("rootIdKey: 'hoverRootId'"), true);

  assert.equal(levelEditorSource.includes('const desktopHoverRoot = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(levelEditorSource.includes("excludeIds: ['playtest']"), true);
  assert.equal(levelEditorSource.includes('if (desktopHoverRoot?.rootId) {'), true);
  assert.equal(levelEditorSource.includes('rootId: desktopHoverRoot.rootId,'), true);

  assert.equal(midiEditorSource.includes('handleDesktopTopMenuHover(x, y)'), true);
  assert.equal(midiEditorSource.includes('this.handleDesktopTopMenuHover(payload.x, payload.y);'), true);
  assert.equal(midiEditorSource.includes('const rootHit = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(midiEditorSource.includes('buttons: this.getDesktopRootButtons(),'), true);
  assert.equal(midiEditorSource.includes('this.openMidiDesktopDropdown(nextTab);'), true);

  assert.equal(sfxEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(sfxEditorSource.includes("rootIdKey: 'desktopRootId'"), true);
  assert.equal(sfxEditorSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.sliderDrag) {"), true);
  assert.equal(sfxEditorSource.includes('if (rootHit?.rootId) {'), true);
  assert.equal(sfxEditorSource.includes('rootId: rootHit.rootId,'), true);
  assert.equal(sfxEditorSource.includes('this.leftTab = rootHit.rootId;'), false);

  assert.equal(cutsceneEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(cutsceneEditorSource.includes("idPrefix: 'desktop-root:'"), true);
  assert.equal(cutsceneEditorSource.includes('if (rootButton) {'), true);
  assert.equal(cutsceneEditorSource.includes('const rootId = rootButton.rootId;'), true);
  assert.equal(cutsceneEditorSource.includes('rootId: nextTab,'), true);

  assert.equal(actorEditorSource.includes('btn.onmouseenter = () => {'), false);
  assert.equal(actorEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(actorEditorSource.includes('const maybeSwitchOpenDropdown = () => {'), true);
  assert.equal(actorEditorSource.includes('btn.onmouseenter = maybeSwitchOpenDropdown;'), true);
  assert.equal(actorEditorSource.includes('btn.onfocus = maybeSwitchOpenDropdown;'), true);
  assert.equal(actorEditorSource.includes('btn.onfocus = () => {\n        this.openActorDesktopDropdown(entry.id);\n      };'), false);

  assert.equal(raceEditorSource.includes('const hover = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(raceEditorSource.includes('if (this.isDesktopMode() && !payload.touchCount) {\n      const hover = resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(raceEditorSource.includes('buttons: this.buttons.filter((button) => button.desktopRootId),'), true);
  assert.equal(raceEditorSource.includes('rootId: hover.rootId,'), true);
});

test('desktop top-menu drawer selection does not mutate persistent context panels', () => {
  const pixelTopMenu = pixelStudioSource.slice(
    pixelStudioSource.indexOf('  drawDesktopShellChrome(ctx, shell)'),
    pixelStudioSource.indexOf('  drawDesktopContextPanel(ctx, bounds)')
  );
  const levelTopMenu = levelEditorSource.slice(
    levelEditorSource.indexOf('const topButtonDefs = shellLayout.topMenu.buttons.map((entry) => ({'),
    levelEditorSource.indexOf('drawSharedDesktopRibbon(ctx, shellLayout.leftRibbon', levelEditorSource.indexOf('const topButtonDefs = shellLayout.topMenu.buttons.map((entry) => ({'))
  );
  const midiOpen = midiEditorSource.slice(
    midiEditorSource.indexOf('  openMidiDesktopDropdown(rootId)'),
    midiEditorSource.indexOf('  closeMidiDesktopDropdown()')
  );
  const sfxRootHitIndex = sfxEditorSource.indexOf('      const rootHit = resolveDesktopDropdownHoverSwitch({');
  const sfxHoverAndTopMenu = `${sfxEditorSource.slice(
    sfxRootHitIndex,
    sfxEditorSource.indexOf('    if (this.panJoystick.active', sfxRootHitIndex)
  )}\n${sfxEditorSource.slice(
    sfxEditorSource.indexOf('  drawDesktopTopMenu(ctx, plan)'),
    sfxEditorSource.indexOf('  drawDesktopDropdown(ctx, dropdown)', sfxEditorSource.indexOf('  drawDesktopTopMenu(ctx, plan)'))
  )}`;
  const actorOpen = actorEditorSource.slice(
    actorEditorSource.indexOf('  openActorDesktopDropdown(rootId)'),
    actorEditorSource.indexOf('  closeActorDesktopDropdown()')
  );
  const cutsceneDesktopRoot = `${cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.drag && !this.menuScrollDrag) {"),
    cutsceneEditorSource.indexOf('    if (this.menuScrollDrag) {', cutsceneEditorSource.indexOf("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.drag && !this.menuScrollDrag) {"))
  )}\n${cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf("if (id?.startsWith?.('desktop-root:')) {"),
    cutsceneEditorSource.indexOf("      if (id?.startsWith?.('landscape-tab:'))", cutsceneEditorSource.indexOf("if (id?.startsWith?.('desktop-root:')) {"))
  )}`;

  assert.equal(pixelTopMenu.includes('this.setLeftPanelTab('), false);
  assert.equal(levelTopMenu.includes('this.setPanelTab('), false);
  assert.equal(midiOpen.includes('this.activeTab'), false);
  assert.equal(sfxHoverAndTopMenu.includes('this.leftTab ='), false);
  assert.equal(actorOpen.includes('setActorDesktopRoot'), false);
  assert.equal(actorOpen.includes('activeMenuSection'), false);
  assert.equal(cutsceneDesktopRoot.includes('this.activeMenuTab ='), false);
});

test('desktop dropdown wheel scrolling uses the shared resolver across editors', () => {
  for (const source of [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    actorEditorSource,
    raceEditorSource
  ]) {
    assert.equal(source.includes('applyDesktopDropdownWheelScrollState'), true);
  }
  assert.equal(editorMenuLayoutSource.includes('export function applyDesktopDropdownWheelScrollState'), true);
  assert.equal(editorMenuLayoutSource.includes('resolveDesktopDropdownWheelScroll({ dropdown, payload, scrollState })'), true);
  assert.equal(actorEditorSource.includes('resolveMenuWheelScroll'), false);
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('this.desktopDropdownScroll = desktopDropdownScroll.scrollState;'), true);
    assert.equal(source.includes('this.desktopDropdownScroll[desktopDropdownScroll.rootId] = desktopDropdownScroll.nextScroll;'), false);
  });
  assert.equal(actorEditorSource.includes('this.desktopDropdownScroll = nextScroll.scrollState;'), true);
  assert.equal(actorEditorSource.includes('this.desktopDropdownScroll[nextScroll.rootId] = nextScroll.nextScroll;'), false);
});

test('desktop dropdown shell scroll keys follow the open drawer root', () => {
  assert.equal(pixelStudioSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(levelEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(midiEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(sfxEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(cutsceneEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(actorEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(raceEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  [pixelStudioSource, levelEditorSource, midiEditorSource, sfxEditorSource, cutsceneEditorSource, actorEditorSource, raceEditorSource].forEach((source) => {
    assert.equal(source.includes('this.desktopDropdownScroll = {};'), true);
  });
  [pixelStudioSource, levelEditorSource, midiEditorSource, sfxEditorSource, cutsceneEditorSource, raceEditorSource].forEach((source) => {
    assert.equal(source.includes('this.desktopDropdown = null;'), true);
  });
  assert.equal(midiEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId || desktopRootId] || 0'), false);
  assert.equal(sfxEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId || this.leftTab] || 0'), false);
  assert.equal(cutsceneEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[activeRootId] || 0'), false);
  assert.equal(raceEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[activeRootId] || 0'), false);
  assert.equal(actorEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId || actorDesktopRoot] || 0'), false);
});

test('desktop dropdown click-away close state uses the shared resolver across editors', () => {
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    actorEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('resolveClosedDesktopDropdownState'), true);
  });
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('this.closedDesktopDropdownRootId = this.desktopDropdown?.rootId || this.openDesktopDropdownRootId'), false);
  });
  assert.equal(actorEditorSource.includes('this.closedDesktopDropdownRootId = desktopShell.dropdown.rootId || this.openDesktopDropdownRootId'), false);
});

test('desktop dropdowns do not default open from active panels or tabs', () => {
  const sources = [
    ['Pixel', pixelStudioSource],
    ['Level', levelEditorSource],
    ['MIDI', midiEditorSource],
    ['SFX', sfxEditorSource],
    ['Cutscene', cutsceneEditorSource],
    ['Actor', actorEditorSource],
    ['Race', raceEditorSource],
    ['Car', raceEditorSource]
  ];

  sources.forEach(([editor, source]) => {
    const matches = source.match(/resolveDesktopDropdownRootId\(\{[\s\S]*?\}\)/g) || [];
    assert.ok(matches.length > 0, `${editor} should use the shared desktop dropdown root resolver`);
    matches.forEach((block) => {
      assert.equal(block.includes('activeRootId:'), false, `${editor} must not force a desktop drawer open from active context`);
    });
  });
  const cutsceneChromeIndex = cutsceneEditorSource.indexOf('  drawDesktopShellChrome(ctx, shell)');
  const cutsceneChromeBody = cutsceneEditorSource.slice(
    cutsceneChromeIndex,
    cutsceneEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds)', cutsceneChromeIndex)
  );
  assert.equal(cutsceneChromeBody.includes('const openRootId = resolveDesktopDropdownRootId({'), true);
  assert.equal(cutsceneChromeBody.includes('this.openDesktopDropdownRootId || this.activeMenuTab'), false);
});

test('desktop dropdown release activation closes drawers through shared state', () => {
  const blocks = {
    pixel: pixelStudioSource.slice(
      pixelStudioSource.indexOf('  handlePointerUp(payload = {})'),
      pixelStudioSource.indexOf('  handleDoubleClick(payload)', pixelStudioSource.indexOf('  handlePointerUp(payload = {})'))
    ),
    level: levelEditorSource.slice(
      levelEditorSource.indexOf('  handlePointerUp(payload = {})'),
      levelEditorSource.indexOf('  handleDoubleClick(payload = {})', levelEditorSource.indexOf('  handlePointerUp(payload = {})'))
    ),
    midi: midiEditorSource.slice(
      midiEditorSource.indexOf('  closeMidiDesktopDropdown()'),
      midiEditorSource.indexOf('  drawDesktopTopMenu(ctx, plan)', midiEditorSource.indexOf('  closeMidiDesktopDropdown()'))
    ),
    sfx: sfxEditorSource.slice(
      sfxEditorSource.indexOf('  handlePointerUp(payload = {})'),
      sfxEditorSource.indexOf('  startMenuScrollDrag(payload)', sfxEditorSource.indexOf('  handlePointerUp(payload = {})'))
    ),
    cutscene: cutsceneEditorSource.slice(
      cutsceneEditorSource.indexOf('  handlePointerUp(payload = {})'),
      cutsceneEditorSource.indexOf('  handleWheel(payload)', cutsceneEditorSource.indexOf('  handlePointerUp(payload = {})'))
    )
  };

  Object.entries(blocks).forEach(([editor, block]) => {
    assert.equal(block.includes('resolveClosedDesktopDropdownState({'), true, `${editor} should close release-activated desktop dropdowns through the shared resolver`);
    assert.equal(block.includes('closedRootId: this.desktopDropdown?.rootId || this.openDesktopDropdownRootId'), false, `${editor} should not hand-roll closed root ids`);
    assert.equal(block.includes('openRootId: null'), false, `${editor} should not hand-roll open root ids`);
    assert.equal(block.includes('this.desktopDropdown = null'), false, `${editor} should not hand-roll dropdown clearing`);
  });
});

test('desktop editors enter the shared desktop shell instead of mobile chrome', () => {
  SHARED_EDITOR_IDS.forEach((editor) => {
    const source = editorSourceById[editor];
    assert.equal(
      source.includes(`buildDesktopEditorShellPlan('${editor}'`) || source.includes('buildDesktopEditorShellPlan(this.editorId'),
      true,
      `${editor} should build the shared desktop shell`
    );
    if (editor === 'actor') {
      assert.equal(source.includes('renderDesktopTopMenu(shellLayout)'), true, 'actor should render its DOM top menu from the shared desktop shell layout');
      assert.equal(source.includes("const top = el('div', 'actor-editor-desktop-top-menu');"), true, 'actor should render app-style desktop top menu DOM chrome');
      assert.equal(source.includes('renderDesktopDropdown(shellLayout)'), true, 'actor should render DOM desktop dropdown drawers from the shared shell layout');
      return;
    }
    assert.equal(source.includes('drawSharedDesktopTopMenu'), true, `${editor} should draw the shared desktop top menu`);
    assert.equal(source.includes('drawSharedDesktopRibbon'), true, `${editor} should draw the shared desktop ribbon`);
    assert.equal(source.includes('drawSharedDesktopContextPanel'), true, `${editor} should draw the shared desktop context panel`);
    assert.equal(source.includes('drawSharedDesktopDropdown'), true, `${editor} should draw shared desktop dropdowns`);
  });

  assert.equal(actorEditorSource.includes("buildDesktopEditorShellPlan('actor'"), true);
  assert.equal(actorEditorSource.includes('renderDesktopTopMenu(desktopShell)'), true);
  assert.equal(actorEditorSource.includes('renderDesktopDropdown(shellLayout)'), true);
  assert.equal(actorEditorSource.includes('renderDesktopLeftPanel(desktopRailContent)'), true);
  assert.equal(actorEditorSource.includes('const rightRailContent = isDesktopLayout\n      ? null\n      :'), true);
  assert.equal(actorEditorSource.includes("const canRenderLandscapeBottomRail = landscapeLayout\n      && canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail');"), true);
  assert.equal(actorEditorSource.includes("if (landscapeToolOptionsSurface) {\n      center.appendChild(this.renderLandscapeBottomRail());\n    }"), true);
  assert.equal(actorEditorSource.includes('if (isDesktopLayout) {\n      center.appendChild(this.renderLandscapeBottomRail());'), false);
});

test('Pixel zoom-to-fit uses the shared viewport mode instead of raw mobile chrome sizing', () => {
  const zoomBlock = pixelStudioSource.slice(
    pixelStudioSource.indexOf('  zoomToFitCanvas()'),
    pixelStudioSource.indexOf('  handleArrowKey(key)', pixelStudioSource.indexOf('  zoomToFitCanvas()'))
  );

  assert.equal(zoomBlock.includes('const viewportMode = this.resolvePixelViewportMode(viewportW, viewportH, {\n      editorId: this.tilePickerMode ? \'tile\' : \'pixel\'\n    });'), true);
  assert.equal(zoomBlock.includes('resolveEditorViewportModeFlags({'), false);
  assert.equal(zoomBlock.includes('const isMobile = viewportMode.isMobileViewport;'), true);
  assert.equal(zoomBlock.includes('const mobileLandscape = viewportMode.isMobileLandscape;'), true);
  assert.equal(zoomBlock.includes('const paletteHeight = isMobile && !mobileLandscape ? 64 : 0;'), true);
  assert.equal(zoomBlock.includes('const isMobile = this.isMobileLayout();'), false);
  assert.equal(zoomBlock.includes('const paletteHeight = isMobile ? 64 : 0;'), false);
}
);

test('editor file menus do not import legacy unified drawer item builders', () => {
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    actorEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('buildUnifiedFileDrawerItems'), false);
    assert.equal(source.includes('buildSharedFileDrawerLayout'), false);
  });
});

test('editor file menu builders keep history commands out of File drawers', () => {
  const fileMenuBodies = [
    pixelStudioSource.slice(pixelStudioSource.indexOf('  getFilePanelItems()'), pixelStudioSource.indexOf('  ensureBoneNodeSelection()', pixelStudioSource.indexOf('  getFilePanelItems()'))),
    levelEditorSource.slice(levelEditorSource.indexOf('  getLevelFileMenuItems('), levelEditorSource.indexOf('  getLevelEditMenuItems()', levelEditorSource.indexOf('  getLevelFileMenuItems('))),
    midiEditorSource.slice(midiEditorSource.indexOf('  getFileMenuItems()'), midiEditorSource.indexOf('  drawFilePanel(ctx, x, y, w, h)', midiEditorSource.indexOf('  getFileMenuItems()'))),
    sfxEditorSource.slice(sfxEditorSource.indexOf('  getSfxFileMenuItems()'), sfxEditorSource.indexOf('  getSfxEditMenuItems()', sfxEditorSource.indexOf('  getSfxFileMenuItems()'))),
    cutsceneEditorSource.slice(cutsceneEditorSource.indexOf("if (tabId === 'file') {"), cutsceneEditorSource.indexOf("    if (tabId === 'edit')", cutsceneEditorSource.indexOf("if (tabId === 'file') {"))),
    actorEditorSource.slice(actorEditorSource.indexOf('  getActorFileMenuItems()'), actorEditorSource.indexOf('  getActorEditMenuItems()', actorEditorSource.indexOf('  getActorFileMenuItems()'))),
    raceEditorSource.slice(raceEditorSource.indexOf("    if (rootId === 'file') {"), raceEditorSource.indexOf('    const spec = getEditorMenuSpec', raceEditorSource.indexOf("    if (rootId === 'file') {")))
  ];

  fileMenuBodies.forEach((body) => {
    assert.ok(body.includes('buildSharedEditorFileMenu({'));
    assert.equal(body.includes('undo: false'), false);
    assert.equal(body.includes('redo: false'), false);
    assert.equal(body.includes("undo: ()"), false);
    assert.equal(body.includes("redo: ()"), false);
    assert.equal(body.includes("id: 'undo'"), false);
    assert.equal(body.includes("id: 'redo'"), false);
    assert.equal(body.includes("id: 'copy'"), false);
    assert.equal(body.includes("id: 'copy-image'"), false);
    assert.equal(body.includes("id: 'cut'"), false);
    assert.equal(body.includes("id: 'paste'"), false);
    assert.equal(body.includes("id: 'paste-image'"), false);
    assert.equal(body.includes("id: 'clear'"), false);
  });
});

test('desktop editors do not draw persistent mobile gamepad hint bars', () => {
  assert.equal(pixelStudioSource.includes('if (this.gamepadHintVisible && !isMobile) {'), false);
  assert.equal(pixelStudioSource.includes('this.drawGamepadHints(ctx, width - padding - 20, height - bottomHeight - 90);'), false);
  assert.equal(pixelStudioSource.includes('drawGamepadHints(ctx'), false);
  assert.equal(pixelStudioSource.includes("import { GAMEPAD_HINTS } from './pixel-editor/gamepad.js';"), false);
  assert.equal(pixelStudioSource.includes('gamepadHintVisible'), false);
  assert.equal(pixelStudioSource.includes("console.info('[PixelStudio] Gamepad detected.');"), false);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode !== 'desktop' && this.game?.input?.isGamepadConnected?.() && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {"), true);
  assert.equal(midiEditorSource.includes("if (isMobile && this.game?.input?.isGamepadConnected?.() && canRenderEditorSurface(viewportMode.mode, 'gamepad-hint-bar')) {"), true);
  assert.equal(midiEditorSource.includes("if (viewportMode.isMobileLandscape && canRenderEditorSurface(viewportMode.mode, 'touch-thumbstick')) {"), true);
  assert.equal(sfxEditorSource.includes("if (gamepadConnected && canRenderEditorSurface(viewportMode.mode, 'gamepad-hint-bar')) {\n        this.drawGamepadHintBar"), true);
  assert.equal(sfxEditorSource.includes("if (gamepadConnected && canRenderEditorSurface(viewportMode.mode, 'gamepad-hint-bar')) {\n      this.drawGamepadHintBar"), true);
  assert.equal(actorEditorSource.includes("if (isGamepadConnected && !isDesktopLayout && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {"), true);
  assert.equal(pixelStudioSource.includes("if (this.getGamepadMenuState(width, height).isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {"), true);
  assert.equal(cutsceneEditorSource.includes("if (gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {"), true);
  assert.equal(raceEditorSource.includes("if (gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {"), true);
});

test('Level editor render gates use active viewport mode for desktop versus touch chrome', () => {
  const updateIndex = levelEditorSource.indexOf('  update(input, dt) {');
  const updateBody = levelEditorSource.slice(updateIndex, levelEditorSource.indexOf('  handleKeyboard(input, dt = 0)', updateIndex));
  const setPanelTabIndex = levelEditorSource.indexOf('  setPanelTab(tabId) {');
  const setPanelTabBody = levelEditorSource.slice(setPanelTabIndex, levelEditorSource.indexOf('  cyclePanelTab(direction)', setPanelTabIndex));
  const closeFileMenuIndex = levelEditorSource.indexOf('  closeFileMenu() {');
  const closeFileMenuBody = levelEditorSource.slice(closeFileMenuIndex, levelEditorSource.indexOf('  exitToMainMenu()', closeFileMenuIndex));
  const hapticIndex = levelEditorSource.indexOf('  triggerHaptic() {');
  const hapticBody = levelEditorSource.slice(hapticIndex, levelEditorSource.indexOf('  endPrecisionZoom() {', hapticIndex));
  const panelNavigationIndex = levelEditorSource.indexOf('  navigatePanelMenu(input) {');
  const panelNavigationBody = levelEditorSource.slice(panelNavigationIndex, levelEditorSource.indexOf('  handleGamepad(input, dt)', panelNavigationIndex));
  const uiClickIndex = levelEditorSource.indexOf('  handleUIClick(x, y) {');
  const uiClickBody = levelEditorSource.slice(uiClickIndex, levelEditorSource.indexOf('  handleSliderPointerDown(payload)', uiClickIndex));
  const drawIndex = levelEditorSource.indexOf('  draw(ctx, width = this.getViewportSize().width, height = this.getViewportSize().height)');
  const drawBody = levelEditorSource.slice(drawIndex, levelEditorSource.indexOf('    ctx.restore();\n  }\n}', drawIndex));

  assert.ok(drawIndex >= 0);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode === 'desktop' && this.panelScrollBounds) {"), true);
  assert.equal(levelEditorSource.includes("if (!this.isMobileLayout() && this.panelScrollBounds) {"), false);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode !== 'desktop' && !this.isPointerInEditorArea(this.lastPointer.x, this.lastPointer.y)) {"), true);
  assert.equal(levelEditorSource.includes("if (this.isMobileLayout() && !this.isPointerInEditorArea(this.lastPointer.x, this.lastPointer.y)) {"), false);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode === 'desktop') return true;"), true);
  assert.equal(levelEditorSource.includes("if (!this.isMobileLayout()) return true;"), false);
  assert.equal(levelEditorSource.includes("const canRenderLandscapeThumbstick = canRenderEditorPlanSurface(landscapeLayout, 'touch-thumbstick')\n          && canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick');"), true);
  assert.equal(levelEditorSource.includes("const canRenderLandscapeBottomRail = canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail')\n          && canRenderEditorSurface(this.activeViewportMode, 'bottom-tool-rail');"), true);
  assert.equal(levelEditorSource.includes("const hasLandscapeZoomRail = this.zoomSlider.bounds\n      && this.zoomSlider.bounds.w > 0\n      && this.zoomSlider.bounds.h > 0;"), true);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode !== 'desktop' && !portraitLayout && hasLandscapeZoomRail) {"), true);
  assert.equal(levelEditorSource.includes("} else if (this.activeViewportMode !== 'desktop' && !portraitLayout) {"), true);
  assert.equal(levelEditorSource.includes("if (this.isMobileLayout() && !portraitLayout && canRenderEditorSurface(this.activeViewportMode, 'bottom-tool-rail')) {"), false);
  assert.equal(drawBody.includes("const stickyExit = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(drawBody.includes("const stickyExit = portraitLayout || this.activeViewportMode === 'landscape';"), false);
  assert.equal(drawBody.includes('const stickyExit = portraitLayout || isMobileLandscapeLayout({'), false);
  assert.equal(levelEditorSource.includes("const touchViewportMode = this.activeViewportMode !== 'desktop';\n        const panelWidth = touchViewportMode ? Math.min(width - 24, 440) : 420;"), true);
  assert.equal(levelEditorSource.includes("const touchViewportMode = this.activeViewportMode !== 'desktop';\n      const panelX = touchViewportMode\n        ? this.editorBounds.x + this.editorBounds.w - panelWidth - 12"), true);
  assert.equal(levelEditorSource.includes("const touchViewportMode = this.activeViewportMode !== 'desktop';\n      const panelX = touchViewportMode\n        ? this.editorBounds.x + 12"), true);
  assert.equal(levelEditorSource.includes('const panelWidth = this.isMobileLayout() ? Math.min(width - 24, 440) : 420;'), false);
  assert.equal(levelEditorSource.includes('const panelX = this.isMobileLayout()\n        ? this.editorBounds.x + this.editorBounds.w - panelWidth - 12'), false);
  assert.equal(levelEditorSource.includes('const panelX = this.isMobileLayout()\n        ? this.editorBounds.x + 12'), false);
  assert.equal(updateBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(updateBody.includes('if (!isTouchViewportMode) {'), true);
  assert.equal(updateBody.includes("canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')"), true);
  assert.equal(updateBody.includes('if (!this.isMobileLayout()) {'), false);
  assert.equal(setPanelTabBody.includes("if (this.activeViewportMode !== 'desktop') {\n        this.drawer.open = true;"), true);
  assert.equal(setPanelTabBody.includes('if (this.isMobileLayout()) {\n        this.drawer.open = true;'), false);
  assert.equal(closeFileMenuBody.includes("if (this.activeViewportMode !== 'desktop') {\n      this.drawer.open = false;"), true);
  assert.equal(closeFileMenuBody.includes('if (this.isMobileLayout()) {\n      this.drawer.open = false;'), false);
  assert.equal(hapticBody.includes("if (this.activeViewportMode === 'desktop') return;"), true);
  assert.equal(hapticBody.includes('if (!this.isMobileLayout()) return;'), false);
  assert.equal(panelNavigationBody.includes("includeExtras: this.activeViewportMode !== 'desktop'"), true);
  assert.equal(panelNavigationBody.includes("nextItem.tooltip && this.activeViewportMode === 'desktop'"), true);
  assert.equal(panelNavigationBody.includes('includeExtras: this.isMobileLayout()'), false);
  assert.equal(panelNavigationBody.includes('nextItem.tooltip && !this.isMobileLayout()'), false);
  assert.equal(uiClickBody.includes("button.tooltip && this.activeViewportMode === 'desktop'"), true);
  assert.equal(uiClickBody.includes("tooltip && this.activeViewportMode === 'desktop' && isHovered"), true);
  assert.equal(uiClickBody.includes('button.tooltip && !this.isMobileLayout()'), false);
  assert.equal(uiClickBody.includes('tooltip && !this.isMobileLayout() && isHovered'), false);
  assert.equal(levelEditorSource.includes("if (this.activeViewportMode !== 'desktop'\n      && canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail')\n      && !this.drawer.open"), true);
  assert.equal(levelEditorSource.includes('if (this.isMobileLayout() && !this.drawer.open && this.editorBounds) {'), false);
  assert.equal(drawBody.includes("const isTouchViewportMode = this.activeViewportMode !== 'desktop';"), true);
  assert.equal(drawBody.includes('const mapSize = isTouchViewportMode ? 140 : 180;'), true);
  assert.equal(drawBody.includes('isMobile: isTouchViewportMode,'), true);
  assert.equal(drawBody.includes('const playButtonW = isTouchViewportMode ? 112 : 96;'), true);
  assert.equal(drawBody.includes('const boxWidth = isTouchViewportMode'), true);
  assert.equal(drawBody.includes("this.activeViewportMode === 'desktop' && this.tooltipTimer > 0 ? this.activeTooltip : ''"), true);
  assert.equal(drawBody.includes('this.isMobileLayout() ? 140 : 180'), false);
  assert.equal(drawBody.includes('isMobile: this.isMobileLayout(),'), false);
  assert.equal(drawBody.includes('const playButtonW = this.isMobileLayout() ? 112 : 96;'), false);
  assert.equal(drawBody.includes('!this.isMobileLayout() && this.tooltipTimer > 0'), false);
});

test('desktop canvas editors clear stale mobile thumbstick state', () => {
  const pixelDrawIndex = pixelStudioSource.indexOf('  draw(ctx, width, height)');
  const pixelDrawBody = pixelStudioSource.slice(pixelDrawIndex, pixelStudioSource.indexOf('  drawLayerOverlay', pixelDrawIndex));
  const pixelToolbarIndex = pixelStudioSource.indexOf('  drawMobileToolbar(ctx, x, y, w, h)');
  const pixelToolbarBody = pixelStudioSource.slice(pixelToolbarIndex, pixelStudioSource.indexOf('  drawMobilePanZoomControls(ctx, width, height, surfaceBounds = null)', pixelToolbarIndex));
  assert.ok(pixelDrawIndex >= 0);
  assert.ok(pixelToolbarIndex >= 0);
  assert.equal(
    pixelDrawBody.includes('if (!isMobile) resetSharedThumbstickState(this.panJoystick);'),
    true,
    'Pixel desktop draw should clear stale mobile thumbstick geometry'
  );
  assert.equal(pixelDrawBody.includes('this.activeViewportMode = viewportMode.mode;'), true);
  assert.equal(pixelToolbarBody.includes("const portrait = this.activeViewportMode === 'portrait';"), true);
  assert.equal(pixelToolbarBody.includes('isMobilePortraitLayout({'), false);
  assert.equal(pixelToolbarBody.includes('this.isMobileLayout()'), false);
  assert.equal(pixelStudioSource.includes("&& canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')\n      && this.isPointInCircle(payload.x, payload.y, this.panJoystick.center, this.panJoystick.radius * 1.2)"), true);
  assert.equal(pixelStudioSource.includes("if (canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')\n      && this.panJoystick.active"), true);
  assert.equal(pixelStudioSource.includes("this.mobileZoomSliderBounds = canRenderEditorSurface(this.activeViewportMode, 'bottom-tool-rail') ? hitBounds : null;"), true);
  assert.equal(pixelStudioSource.includes("if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick') || !this.panJoystick.active) return;"), true);
  assert.equal(pixelStudioSource.includes('if (!this.isMobileLayout() || !this.panJoystick.active) return;'), false);

  const levelDrawIndex = levelEditorSource.indexOf('  draw(ctx, width = this.getViewportSize().width, height = this.getViewportSize().height)');
  const levelDrawBody = levelEditorSource.slice(levelDrawIndex, levelEditorSource.indexOf('  handleResize(width, height)', levelDrawIndex));
  assert.ok(levelDrawIndex >= 0);
  assert.equal(levelDrawBody.includes('this.resetMobilePanZoomControls();'), true);
  assert.equal(levelEditorSource.includes('resetSharedThumbstickState(this.panJoystick);'), true);

  const midiDrawIndex = midiEditorSource.indexOf('  draw(ctx, width, height)');
  const midiDrawBody = midiEditorSource.slice(midiDrawIndex, midiEditorSource.indexOf('  drawDesktopLayout(ctx, width, height, track, pattern)', midiDrawIndex));
  const midiPanIndex = midiEditorSource.indexOf('  applyMobilePanJoystick(dt = 0)');
  const midiPanBody = midiEditorSource.slice(midiPanIndex, midiEditorSource.indexOf('  updatePanJoystick(x, y)', midiPanIndex));
  assert.ok(midiDrawIndex >= 0);
  assert.equal(midiDrawBody.includes('resetSharedThumbstickState(this.panJoystick);'), true);
  assert.ok(midiPanIndex >= 0);
  assert.equal(midiPanBody.includes("if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')"), true);
  assert.equal(midiPanBody.includes('|| !this.isMobileLandscapeThumbZoomMode()'), true);

  const sfxDrawIndex = sfxEditorSource.indexOf('  draw(ctx, width, height)');
  const sfxDrawBody = sfxEditorSource.slice(sfxDrawIndex, sfxEditorSource.indexOf('  drawWaveform(ctx, bounds)', sfxDrawIndex));
  assert.ok(sfxDrawIndex >= 0);
  assert.equal(sfxDrawBody.includes('resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(sfxEditorSource.includes("if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')\n      || !(this.isMobileLandscape || this.isMobilePortrait)\n      || !this.panJoystick.active) {"), true);
  assert.equal(sfxEditorSource.includes("if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')\n      || !(this.isMobileLandscape || this.isMobilePortrait)) {"), true);

  const cutsceneLayoutIndex = cutsceneEditorSource.indexOf('  computeLayout(width, height, { gamepadMenuState = null } = {})');
  const cutsceneDesktopIndex = cutsceneEditorSource.indexOf('    if (isDesktop) {', cutsceneLayoutIndex);
  const cutsceneDesktopBody = cutsceneEditorSource.slice(cutsceneDesktopIndex, cutsceneEditorSource.indexOf('    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });', cutsceneDesktopIndex));
  assert.ok(cutsceneDesktopIndex > cutsceneLayoutIndex);
  assert.equal(cutsceneDesktopBody.includes('resetSharedThumbstickState(this.panJoystick);'), true);
});

test('gamepad disconnect closes controller menus across editors', () => {
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('if (this.controllerMenu.active) this.controllerMenu.closeToSurface();'), true);
  });
  assert.equal(actorEditorSource.includes('if (this.controllerMenu.active) {\n        this.controllerMenu.closeToSurface();\n        this.render();\n      }'), true);
});

test('Cutscene desktop layout clears stale mobile thumbstick state', () => {
  const layoutIndex = cutsceneEditorSource.indexOf('  computeLayout(width, height, { gamepadMenuState = null } = {})');
  const desktopIndex = cutsceneEditorSource.indexOf('    if (isDesktop) {', layoutIndex);
  const desktopBody = cutsceneEditorSource.slice(desktopIndex, cutsceneEditorSource.indexOf('    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });', desktopIndex));
  const pointerDownIndex = cutsceneEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = cutsceneEditorSource.slice(pointerDownIndex, cutsceneEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const thumbstickPanIndex = cutsceneEditorSource.indexOf('  updateThumbstickPan(dt)');
  const thumbstickPanBody = cutsceneEditorSource.slice(thumbstickPanIndex, cutsceneEditorSource.indexOf('  drawTimelineZoomSlider(ctx, bounds)', thumbstickPanIndex));
  const contextIndex = cutsceneEditorSource.indexOf('  handleDesktopContextPointer(x, y)');
  const contextBody = cutsceneEditorSource.slice(contextIndex, pointerDownIndex);

  assert.ok(layoutIndex >= 0);
  assert.ok(desktopIndex > layoutIndex);
  assert.equal(cutsceneEditorSource.includes('resetSharedThumbstickState'), true);
  assert.equal(desktopBody.includes('resetSharedThumbstickState(this.panJoystick);'), true);
  assert.equal(cutsceneEditorSource.includes('this.viewportWidth = 0;'), true);
  assert.equal(cutsceneEditorSource.includes('this.viewportHeight = 0;'), true);
  assert.equal(cutsceneEditorSource.includes('  resolveCutsceneViewportMode(width = this.viewportWidth || this.game?.canvas?.width || 0, height = this.viewportHeight || this.game?.canvas?.height || 0) {'), true);
  assert.equal(cutsceneEditorSource.includes('const viewportMode = this.resolveCutsceneViewportMode(width, height);'), true);
  assert.equal(pointerDownBody.includes('const pointerMode = this.activeViewportMode || this.resolveCutsceneViewportMode().mode;'), true);
  assert.equal(pointerDownBody.includes('mode: pointerMode,'), true);
  assert.equal(pointerDownBody.includes("pointerType: pointerMode === 'desktop' ? 'mouse' : 'touch',"), true);
  assert.equal(cutsceneEditorSource.includes('getEditorPointerInteractionPolicy'), true);
  assert.equal(pointerDownBody.includes("getEditorPointerInteractionPolicy('cutscene'"), true);
  assert.equal(pointerDownBody.includes('if ((payload.button ?? 0) === 2 && pointerPolicy.rightClick.opensContextMenu) {'), true);
  assert.ok(pointerDownBody.indexOf('this.handleDesktopContextPointer(x, y)') < pointerDownBody.indexOf("type: 'clip-duration'"));
  assert.equal(pointerDownBody.includes('if (pointerPolicy.thumbstick.allowed && this.panJoystick?.radius > 0 && this.pointInThumbstick(x, y))'), true);
  assert.ok(thumbstickPanIndex >= 0);
  assert.equal(thumbstickPanBody.includes("if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')"), true);
  assert.equal(thumbstickPanBody.includes('|| !this.panJoystick?.active'), true);
  assert.equal(contextBody.includes('this.clipOptionsOpen = true;'), true);
  assert.equal(contextBody.includes("this.statusText = 'No context item';"), true);
  assert.equal(contextBody.includes("type: 'clip-timeline'"), false);
  assert.equal(contextBody.includes("type: 'track-reorder'"), false);
});

test('editors use shared gamepad menu state instead of legacy landscape wrappers', () => {
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    cutsceneEditorSource,
    actorEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.equal(source.includes('isGamepadLandscapeMenuMode('), false);
    assert.equal(source.includes('getGamepadMenuState('), true);
  });
});

test('Actor portrait menu matches compact shared rail contract', () => {
  const model = buildActorPortraitMenuModel();

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'settings', 'states', 'preview']);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'playtest']);
  assert.equal(model.primaryActionLabel, 'Play Scene');
  assertSharedPortraitRailActionCount(model.bottomRailActions.map((id) => ({ id })), { editor: 'actor' });
  assert.equal(model.rootTabs.some((tab) => tab.id === 'undo' || tab.id === 'redo'), false);
  assert.equal(model.rootTabs.some((tab) => tab.id === 'linked-parts'), false);
  assert.equal(actorEditorSource.includes("portraitRootPlacement: 'bottom-rail'"), true);
  assert.equal(actorEditorSource.includes('rootTabs: layout.rootRail'), true);
  assert.equal(actorEditorSource.includes('subRail: layout.subRail'), true);
  assert.equal(actorEditorSource.includes('const sheetOpen = this.fileMenuOpen || this.actorPortraitMenuOpen || this.controllerMenu.active;'), true);
  assert.equal(actorEditorSource.includes('getSharedPortraitRailActionButtons(railBounds, actions, { reserveThumbstick: true })'), true);
  assert.equal(actorEditorSource.includes("btn.style.width = '54px';"), false);
});

test('Actor desktop top menu renders app-style dropdown drawers', () => {
  const topMenuIndex = actorEditorSource.indexOf('  renderDesktopTopMenu(shellLayout)');
  const topMenuBody = actorEditorSource.slice(topMenuIndex, actorEditorSource.indexOf('  renderDesktopDropdown(shellLayout)', topMenuIndex));
  const dropdownIndex = actorEditorSource.indexOf('  renderDesktopDropdown(shellLayout)');
  const dropdownBody = actorEditorSource.slice(dropdownIndex, actorEditorSource.indexOf('  renderDesktopLeftPanel(optionsPanel)', dropdownIndex));

  assert.equal(actorEditorSource.includes('renderDesktopDropdown(shellLayout)'), true);
  assert.equal(actorEditorSource.includes('const dropdown = this.renderDesktopDropdown(shellLayout);'), true);
  assert.equal(actorEditorSource.includes("const wrap = el('div', 'actor-editor-desktop-top-menu-wrap');"), true);
  assert.equal(actorEditorSource.includes("top.setAttribute('role', 'menubar');"), true);
  assert.equal(actorEditorSource.includes("top.setAttribute('aria-label', 'Actor editor menu');"), true);
  assert.equal(actorEditorSource.includes("overflow: 'visible'"), true);
  assert.equal(dropdownBody.includes("overflowY: 'hidden'"), false);
  assert.equal(actorEditorSource.includes('if (dropdown) wrap.appendChild(dropdown);'), true);
  assert.equal(actorEditorSource.includes('const liveDropdownPlan = this.desktopDropdown?.rootId === rootId ? this.desktopDropdown : dropdownPlan;'), true);
  assert.equal(actorEditorSource.includes("top: `${liveDropdownPlan.bounds.y}px`"), true);
  assert.equal(actorEditorSource.includes('const renderPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(actorEditorSource.includes('useVisibleItemsSlice: true'), true);
  assert.equal(actorEditorSource.includes('renderPlan.renderedItems.forEach((action) => {'), true);
  assert.equal(dropdownBody.includes('pendingDropdownHit = createPendingDesktopDropdownHit({'), true);
  assert.equal(dropdownBody.includes('pendingDropdownHit = updatePendingDesktopDropdownHit(pendingDropdownHit, {'), true);
  assert.equal(dropdownBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, {'), true);
  assert.equal(dropdownBody.includes('if (!shouldActivate) return;'), true);
  assert.equal(dropdownBody.includes('btn.onclick ='), false);
  assert.equal(dropdownBody.includes("action.startsEditActionRoleGroup ? ' role-group-start' : ''"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown-btn\.role-group-start \{[\s\S]*margin-top: 6px;[\s\S]*box-shadow: inset 0 1px 0 rgba\(190,215,245,0\.24\);/);
  assert.equal(actorEditorSource.includes('getActorDesktopDropdownActions(rootId)'), true);
  assert.equal(actorEditorSource.includes('this.desktopDropdownScroll = {};'), true);
  assert.equal(actorEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0'), true);
  assert.equal(actorEditorSource.includes('dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId || actorDesktopRoot] || 0'), false);
  assert.equal(actorEditorSource.includes('activeRootId: actorDesktopRoot'), false);
  assert.equal(actorEditorSource.includes('const scrollIndex = Math.max(0, Math.min(maxScroll, this.desktopDropdownScroll?.[rootId] || liveDropdownPlan.scrollIndex || 0));'), true);
  assert.equal(actorEditorSource.includes('drawer.onwheel = (event) => {'), true);
  assert.equal(actorEditorSource.includes('openActorDesktopDropdown(rootId)'), true);
  assert.equal(actorEditorSource.includes('resolveOpenDesktopDropdownState({'), true);
  assert.equal(actorEditorSource.includes('dropdown: this.desktopDropdown,'), true);
  assert.equal(actorEditorSource.includes('skipIfAlreadyOpen: true'), true);
  assert.equal(actorEditorSource.includes('if (rootId === this.openDesktopDropdownRootId && !this.closedDesktopDropdownRootId) return;'), false);
  assert.equal(actorEditorSource.includes('if (!rootId || rootId === this.openDesktopDropdownRootId) return;'), false);
  assert.equal(actorEditorSource.includes('closeActorDesktopDropdown()'), true);
  assert.equal(actorEditorSource.includes('const nextDropdown = resolveClosedDesktopDropdownState({'), true);
  assert.equal(actorEditorSource.includes('openRootId: this.openDesktopDropdownRootId,'), true);
  assert.equal(actorEditorSource.includes('shouldCloseDesktopDropdownOnDomPointerDown({'), true);
  assert.equal(actorEditorSource.includes("menuSelector: '.actor-editor-desktop-top-menu-wrap'"), true);
  assert.equal(actorEditorSource.includes('shell.addEventListener(\'pointerdown\', (event) => {'), true);
  assert.equal(actorEditorSource.includes('overlay.addEventListener(\'contextmenu\', (event) => {'), true);
  assert.equal(actorEditorSource.includes('resolveClosedDesktopDropdownState({'), true);
  assert.equal(actorEditorSource.includes('fallbackRootId: this.getActiveActorDesktopRoot()'), true);
  assert.equal(actorEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(actorEditorSource.includes('const isActive = Boolean(entry.active);'), true);
  assert.equal(topMenuBody.includes('applyDesktopRootMenuDataset(btn, entry);'), true);
  assert.equal(topMenuBody.includes("btn.setAttribute('role', 'menuitem');"), true);
  assert.equal(topMenuBody.includes("btn.setAttribute('aria-haspopup', 'menu');"), true);
  assert.equal(topMenuBody.includes("btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');"), true);
  assert.equal(topMenuBody.includes('actor-editor-desktop-menu-btn'), true);
  assert.equal(topMenuBody.includes('this.styleRailButton(btn, isActive);'), false);
  assert.equal(actorEditorSource.includes('btn.onclick = () => this.openActorDesktopDropdown(entry.id);'), true);
  assert.equal(actorEditorSource.includes('const maybeSwitchOpenDropdown = () => {'), true);
  assert.equal(actorEditorSource.includes('btn.onmouseenter = maybeSwitchOpenDropdown;'), true);
  assert.equal(actorEditorSource.includes('btn.onfocus = maybeSwitchOpenDropdown;'), true);
  assert.equal(actorEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(actorEditorSource.includes('btn.onfocus = () => {'), false);
  assert.equal(dropdownBody.includes('actor-editor-desktop-dropdown-btn'), true);
  assert.equal(dropdownBody.includes("drawer.setAttribute('role', 'menu');"), true);
  assert.equal(dropdownBody.includes('drawer.dataset.rootId = rootId;'), true);
  assert.equal(dropdownBody.includes('const motion = renderPlan.motion || {};'), true);
  assert.equal(dropdownBody.includes("drawer.dataset.motion = motion.type || 'slide-down';"), true);
  assert.equal(dropdownBody.includes("drawer.dataset.motionOrigin = motion.origin || 'top-menu';"), true);
  assert.equal(dropdownBody.includes("drawer.style.setProperty('--desktop-dropdown-motion-duration'"), true);
  assert.equal(dropdownBody.includes("btn.dataset.actionId = action.id || '';"), true);
  assert.equal(dropdownBody.includes('applyDesktopDropdownCommandDataset(btn, action, {'), true);
  assert.equal(dropdownBody.includes('commandSurface: this.activeSpecModeContract?.commandSurface'), true);
  assert.equal(dropdownBody.includes('pointerType: this.activeSpecModeContract?.pointerType'), true);
  assert.equal(dropdownBody.includes('rowActivation: this.activeSpecModeContract?.rowActivation'), true);
  assert.equal(dropdownBody.includes("btn.setAttribute('role', 'menuitem');"), true);
  assert.equal(dropdownBody.includes("${action.disabled ? ' disabled' : ''}"), true);
  assert.equal(dropdownBody.includes('action.onClick?.();'), true);
  assert.equal(dropdownBody.includes('this.closeActorDesktopDropdown();'), true);
  assert.equal(dropdownBody.includes('\n      btn.onclick = action.onClick;'), false);
  assert.equal(dropdownBody.includes("btn.style.opacity = '0.5'"), false);
  assert.equal(dropdownBody.includes('this.styleRailButton(btn, Boolean(action.active));'), false);
  assert.equal(topMenuBody.includes('background: UI_SUITE.colors.panel'), false);
  assert.equal(dropdownBody.includes('background: UI_SUITE.colors.panel'), false);
  assert.equal(dropdownBody.includes("boxShadow: '0 12px 28px rgba(0,0,0,0.35)'"), false);
  assert.match(stylesSource, /\.actor-editor-desktop-top-menu \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border-bottom: 1px solid var\(--ui-border\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-top-menu \.actor-editor-btn \{[\s\S]*background: transparent;[\s\S]*box-shadow: none;/);
  assert.match(stylesSource, /\.actor-editor-desktop-menu-btn \{[\s\S]*text-align: center;[\s\S]*background: transparent;[\s\S]*color: var\(--ui-text\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border: 1px solid var\(--ui-border\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown \{[\s\S]*animation: actor-desktop-dropdown-slide var\(--desktop-dropdown-motion-duration, 120ms\) ease-out both;/);
  assert.match(stylesSource, /@keyframes actor-desktop-dropdown-slide \{[\s\S]*transform: translateY\(-12px\);[\s\S]*transform: translateY\(0\);/);
  assert.equal((stylesSource.match(/^\.actor-editor-desktop-dropdown \{/gm) || []).length, 1);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown-btn \{[\s\S]*text-align: left;[\s\S]*background: var\(--ui-panel-alt\);[\s\S]*border-left-color: rgba\(190,215,245,0\.32\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown-btn\.active \{[\s\S]*background: rgba\(255,225,106,0\.16\);[\s\S]*border-left-color: var\(--ui-accent\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown-btn\.disabled,[\s\S]*\.actor-editor-desktop-dropdown-btn:disabled \{[\s\S]*color: var\(--ui-muted\);[\s\S]*opacity: 0\.55;/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown-btn:not\(:disabled\):hover,[\s\S]*\.actor-editor-desktop-dropdown-btn:not\(:disabled\):focus-visible/);
});

test('Actor desktop options stay in the left panel instead of the mobile right rail', () => {
  const leftPanelIndex = actorEditorSource.indexOf('  renderDesktopLeftPanel(optionsPanel)');
  const leftPanelBody = actorEditorSource.slice(leftPanelIndex, actorEditorSource.indexOf('  getActorDesktopRootLabel()', leftPanelIndex));
  const optionsIndex = actorEditorSource.indexOf('  renderDesktopOptionsPanel()');
  const optionsBody = actorEditorSource.slice(optionsIndex, actorEditorSource.indexOf('  getActorDesktopActions(rootId)', optionsIndex));
  const collisionModalIndex = actorEditorSource.indexOf('  openCollisionZoneEditor(');
  const collisionModalBody = actorEditorSource.slice(collisionModalIndex, actorEditorSource.indexOf('  renderMainPanel(actor, state)', collisionModalIndex));

  assert.equal(actorEditorSource.includes('const rightRailContent = isDesktopLayout'), true);
  assert.equal(actorEditorSource.includes(': this.renderRightRail();'), true);
  assert.equal(actorEditorSource.includes('const desktopRailContent = isDesktopLayout ? this.renderDesktopOptionsPanel() : null;'), true);
  assert.equal(actorEditorSource.includes('if (rightRailContent) rightRail.appendChild(rightRailContent);'), true);
  assert.equal(actorEditorSource.includes('left.appendChild(this.renderDesktopLeftPanel(desktopRailContent));'), true);
  assert.equal(actorEditorSource.includes('const activeRailContent = desktopRailContent || rightRailContent;'), false);
  assert.equal(actorEditorSource.includes('rightRail.appendChild(activeRailContent)'), false);
  assert.equal(optionsBody.includes("const title = el('div', 'actor-editor-field-label', 'Active');"), true);
  assert.equal(optionsBody.includes("['Actor', this.actor?.name || 'Untitled']"), true);
  assert.equal(optionsBody.includes("['State', state?.name || state?.id || 'None']"), true);
  assert.equal(actorEditorSource.includes("const ACTOR_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('actor');"), true);
  assert.equal(actorEditorSource.includes('const rootId = this.getActiveActorDesktopRoot();\n    return ACTOR_CONTROLLER_ROOT_LABELS[rootId] || ACTOR_CONTROLLER_ROOT_LABELS.settings || \'Settings\';'), true);
  assert.equal(optionsBody.includes("const labels = {\n      file: 'File'"), false);
  assert.equal(optionsBody.includes('this.getActorDesktopActions(rootId).forEach'), false);
  assert.equal(optionsBody.includes("el('button', `actor-editor-btn"), false);
  assert.equal(leftPanelBody.includes('background: UI_SUITE.colors.panel'), false);
  assert.equal(leftPanelBody.includes('title.innerHTML'), false);
  assert.equal(optionsBody.includes('background: UI_SUITE.colors.panel'), false);
  assert.equal(optionsBody.includes('UI_SUITE.colors.muted'), false);
  assert.equal(optionsBody.includes('textOverflow'), false);
  assert.equal(optionsBody.includes("el('span', 'actor-editor-desktop-context-key', label)"), true);
  assert.equal(optionsBody.includes("el('span', 'actor-editor-desktop-context-value', String(value))"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-left-panel \{[\s\S]*display: flex;[\s\S]*gap: var\(--ui-gap\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-ribbon \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border: 1px solid var\(--ui-border\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-ribbon-title \{[\s\S]*overflow: hidden;/);
  assert.match(stylesSource, /\.actor-editor-desktop-ribbon-title strong,[\s\S]*\.actor-editor-desktop-ribbon-title span \{[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
  assert.match(stylesSource, /\.actor-editor-desktop-options \{[\s\S]*background: var\(--ui-panel\);[\s\S]*overflow-y: auto;/);
  assert.match(stylesSource, /\.actor-editor-desktop-context-row \{[\s\S]*grid-template-columns: 80px minmax\(0, 1fr\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-context-value \{[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
  assert.equal(actorEditorSource.includes('getEditorPointerInteractionPolicy'), true);
  assert.equal(collisionModalBody.includes("getEditorPointerInteractionPolicy('actor'"), true);
  assert.equal(collisionModalBody.includes("const showCollisionThumbstick = collisionPointerPolicy.thumbstick.allowed\n      && canRenderEditorSurface(collisionViewportMode.mode, 'touch-thumbstick');"), true);
  assert.equal(collisionModalBody.includes("gridTemplateColumns: showCollisionThumbstick ? '96px 1fr' : '1fr'"), true);
  assert.equal(collisionModalBody.includes('if (showCollisionThumbstick) bottomTools.appendChild(thumbCol);'), true);
});

test('Actor file menu uses the shared editor file menu model', () => {
  const fileMenuIndex = actorEditorSource.indexOf('  getActorFileMenuItems()');
  const fileMenuBody = actorEditorSource.slice(fileMenuIndex, actorEditorSource.indexOf('  renderDesktopOptionsPanel()', fileMenuIndex));
  const controllerIndex = actorEditorSource.indexOf("      file: {\n        id: 'file',");
  const controllerBody = actorEditorSource.slice(controllerIndex, actorEditorSource.indexOf('      system:', controllerIndex));

  assert.equal(actorEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(fileMenuBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileMenuBody.includes('export: false'), true);
  assert.equal(fileMenuBody.includes('import: false'), true);
  assert.equal(fileMenuBody.includes('onClose: () => this.closeFileMenu()'), true);
  assert.equal(fileMenuBody.includes('onExit: () => this.exitToMenu()'), true);
  assert.equal(fileMenuBody.includes('.filter((item) => !item.disabled)'), false);
  assert.equal(fileMenuBody.includes('disabled: Boolean(item.disabled),'), true);
  assert.equal(actorEditorSource.includes('file: this.getActorFileMenuItems(),'), true);
  assert.equal(actorEditorSource.includes('const fileItems = this.getActorFileMenuItems();'), true);
  assert.equal(controllerBody.includes('items: this.getActorFileMenuItems().map((item) => ('), true);
});

test('Actor gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const slideOutIndex = actorEditorSource.indexOf('  renderGamepadSlideOutRail(menuId)');
  const slideOutBody = actorEditorSource.slice(slideOutIndex, actorEditorSource.indexOf('  renderDesktopTopMenu(shellLayout)', slideOutIndex));

  assert.equal(actorEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(actorEditorSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(actorEditorSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(actorEditorSource.includes('  getViewportSize(fallbackWidth = 0, fallbackHeight = 0) {'), true);
  assert.equal(actorEditorSource.includes('  resolveActorViewportMode(width = null, height = null) {'), true);
  assert.equal(actorEditorSource.includes('const viewportMode = this.resolveActorViewportMode(viewportW, viewportH);'), true);
  assert.equal(actorEditorSource.includes('const viewportMode = this.resolveActorViewportMode();\n    const isPortraitPhone = viewportMode.isMobilePortrait;'), true);
  assert.equal(actorEditorSource.includes('const viewportMode = this.resolveActorViewportMode();\n    const isPortraitMobile = viewportMode.isMobilePortrait;'), true);
  assert.equal(actorEditorSource.includes('const isMobileViewport = this.resolveActorViewportMode().isMobileViewport;'), true);
  assert.equal(actorEditorSource.includes('const gamepadMenuState = this.getGamepadMenuState(viewportW, viewportH);'), true);
  assert.equal(actorEditorSource.includes('const gamepadSlideOutMenuId = gamepadMenuState.activeSubmenuId;'), true);
  assert.equal(actorEditorSource.includes('const shouldDrawGamepadSlideOut = gamepadMenuState.drawSlideOut;'), true);
  assert.equal(actorEditorSource.includes('Boolean(viewportMode.isGamepadLandscape && this.controllerMenu.active && gamepadSlideOutMenuId)'), false);
  assert.equal(actorEditorSource.includes('reserveRightRail: !shouldDrawGamepadSlideOut'), true);
  assert.equal(actorEditorSource.includes('reserveRightRail: !shouldDrawGamepadSlideOut && !this.landscapeRootDrawerOpen'), false);
  assert.equal(actorEditorSource.includes("const canRenderLandscapeBottomRail = landscapeLayout\n      && canRenderEditorPlanSurface(landscapeLayout, 'bottom-tool-rail');"), true);
  assert.equal(actorEditorSource.includes('const landscapeToolOptionsSurface = canRenderLandscapeBottomRail\n      ? landscapeLayout?.surfaces.toolOptions\n      : null;'), true);
  assert.equal(actorEditorSource.includes('left.appendChild(this.renderGamepadSlideOutRail(gamepadSlideOutMenuId));'), true);
  assert.equal(actorEditorSource.includes('return this.getGamepadMenuState(width, height).drawControllerOverlay;'), true);
  assert.equal(slideOutBody.includes("el('div', 'actor-editor-gamepad-slideout-title'"), true);
  assert.equal(slideOutBody.includes("el('div', 'actor-editor-gamepad-slideout-hint', plan.headerHint)"), true);
  assert.equal(slideOutBody.includes("el('div', 'actor-editor-gamepad-slideout-hint', 'A Select  B Back')"), false);
  assert.equal(slideOutBody.includes('Object.assign(title.style'), false);
  assert.equal(slideOutBody.includes('Object.assign(hint.style'), false);
  assert.match(stylesSource, /\.actor-editor-menu-rail,[\s\S]*\.actor-editor-file-subrail-list,[\s\S]*\.actor-editor-gamepad-slideout \{[\s\S]*touch-action: pan-y;/);
  assert.match(stylesSource, /\.actor-editor-gamepad-slideout > \.actor-editor-menu-rail \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow-y: auto;/);
});

test('Actor gamepad root menus match the desktop/spec section set', () => {
  const controllerIndex = actorEditorSource.indexOf('  buildControllerMenus()');
  const controllerBody = actorEditorSource.slice(controllerIndex, actorEditorSource.indexOf('  renderSidebarMenu()', controllerIndex));
  const desktopActionsIndex = actorEditorSource.indexOf('  getActorDesktopActions(rootId) {');
  const desktopActionsBody = actorEditorSource.slice(desktopActionsIndex, actorEditorSource.indexOf('  getActorEditMenuItems()', desktopActionsIndex));
  const editIndex = actorEditorSource.indexOf('  getActorEditMenuItems()');
  const editBody = actorEditorSource.slice(editIndex, actorEditorSource.indexOf('  getActorDesktopDropdownActions(rootId)', editIndex));

  assert.equal(actorEditorSource.includes("getEditorControllerRootMenuEntries('actor')"), true);
  assert.equal(actorEditorSource.includes("const ACTOR_CONTROLLER_ROOTS = getEditorControllerRootMenuIds('actor');"), true);
  assert.equal(actorEditorSource.includes("getEditorMenuSection('actor', rootId)"), true);
  assert.equal(actorEditorSource.includes('return section.actions\n      .map((id) => actionById.get(id))\n      .filter(Boolean);'), true);
  assert.equal(desktopActionsBody.includes("states: [\n        { id: 'add-state'"), true);
  assert.equal(desktopActionsBody.includes("{ id: 'duplicate-state', label: 'Duplicate State'"), true);
  assert.equal(desktopActionsBody.includes("{ id: 'delete-state', label: 'Delete State'"), true);
  assert.equal(desktopActionsBody.includes("const section = getEditorMenuSection('actor', rootId);"), true);
  assert.equal(desktopActionsBody.includes('return section.actions\n      .map((id) => actionById.get(id))'), true);
  assert.equal(actorEditorSource.includes('siblingOrder: ACTOR_CONTROLLER_ROOTS'), true);
  assert.equal(controllerBody.includes('items: ACTOR_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem('), true);
  assert.equal(controllerBody.includes("getEditorDesktopSectionId('actor', entry.id)"), true);
  assert.equal(controllerBody.includes('...Object.fromEntries(ACTOR_CONTROLLER_ROOT_ENTRIES'), true);
  assert.equal(controllerBody.includes(".filter((entry) => entry.id !== 'file')"), true);
  assert.equal(controllerBody.includes('active: Boolean(item.active)'), true);
  assert.equal(controllerBody.includes('sourceId: item.id || null'), true);
  assert.equal(actorEditorSource.includes("async openLinkChildActorBrowser()"), true);
  assert.equal(actorEditorSource.includes("{ id: 'add-linked-part', label: 'Link Child Actor', onClick: () => this.openLinkChildActorBrowser() }"), true);
  assert.equal(actorEditorSource.includes("add.onclick = () => this.openLinkChildActorBrowser();"), true);
  assert.equal(actorEditorSource.includes("{ id: 'add-linked-part', label: 'Root Actor Settings'"), false);
  assert.equal(controllerBody.includes("toolsMenuId: 'preview'"), true);
  assert.equal(actorEditorSource.includes('edit: this.getActorEditMenuItems(),'), true);
  assert.equal(editBody.includes("id: 'undo'"), true);
  assert.equal(editBody.includes("id: 'redo'"), true);
  assert.equal(editBody.includes("id: 'copy-state'"), true);
  assert.equal(editBody.includes("id: 'paste-state'"), true);
  assert.equal(editBody.includes("id: 'duplicate-state'"), true);
  assert.equal(editBody.includes("id: 'delete-state'"), true);
});

test('Actor landscape touch uses compact left rail, left root drawer, and right submenu rail', () => {
  const renderIndex = actorEditorSource.indexOf('  render()');
  const renderBody = actorEditorSource.slice(renderIndex, actorEditorSource.indexOf('  getActiveActorDesktopRoot()', renderIndex));
  const commandRailIndex = actorEditorSource.indexOf('  renderLandscapeCommandRail(bounds = null)');
  const commandRailBody = actorEditorSource.slice(commandRailIndex, actorEditorSource.indexOf('  renderLandscapeRootDrawer()', commandRailIndex));
  const drawerIndex = actorEditorSource.indexOf('  renderLandscapeRootDrawer(bounds = null)');
  const drawerBody = actorEditorSource.slice(drawerIndex, actorEditorSource.indexOf('  renderLandscapeBottomRail()', drawerIndex));
  const bottomRailIndex = actorEditorSource.indexOf('  renderLandscapeBottomRail()');
  const bottomRailBody = actorEditorSource.slice(bottomRailIndex, actorEditorSource.indexOf('  renderPortraitRailThumbstick()', bottomRailIndex));

  assert.equal(actorEditorSource.includes('buildLandscapeTouchEditorShellPlan'), true);
  assert.equal(actorEditorSource.includes('buildCompactLandscapeCommandRailActions'), true);
  assert.equal(actorEditorSource.includes('buildCompactLandscapeCommandRailButtonLayout'), true);
  assert.equal(renderBody.includes('const landscapeLayout = isMobileLandscape'), true);
  assert.equal(renderBody.includes('const landscapeLayout = isMobileLandscape && !shouldDrawGamepadSlideOut'), false);
  assert.equal(renderBody.includes('leftRailWidth: getSharedMobileRailWidth(viewportW, viewportH)'), false);
  assert.equal(renderBody.includes('rightRailWidth: getSharedMobileRailWidth(viewportW, viewportH)'), true);
  assert.equal(renderBody.includes('bottomRailHeight: ACTOR_LANDSCAPE_BOTTOM_RAIL_HEIGHT'), true);
  assert.equal(renderBody.includes('reserveRightRail: !shouldDrawGamepadSlideOut'), true);
  assert.equal(renderBody.includes('reserveRightRail: !shouldDrawGamepadSlideOut && !this.landscapeRootDrawerOpen'), false);
  assert.equal(renderBody.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(renderBody.includes('this.landscapeRootDrawerOpen'), true);
  assert.equal(renderBody.includes('const landscapeRootDrawerContent = landscapeRootDrawerSurface && this.landscapeRootDrawerOpen && !shouldDrawGamepadSlideOut'), true);
  assert.equal(renderBody.includes("const landscapeRootDrawerHost = landscapeRootDrawerContent\n      ? el('div', 'actor-editor-landscape-root-drawer-host')"), true);
  assert.equal(renderBody.includes('this.renderLandscapeRootDrawer(landscapeRootDrawerSurface)'), true);
  assert.equal(renderBody.includes('if (landscapeRootDrawerHost) body.appendChild(landscapeRootDrawerHost);'), true);
  assert.equal(renderBody.includes('rightRail.style.left = `${activeLandscapeSubmenuSurface?.x ?? viewportW - rightRailWidth}px`;'), true);
  assert.equal(renderBody.includes('body.append(left, center);'), true);
  assert.equal(renderBody.includes('if (rightRailContent) body.appendChild(rightRail);'), true);
  assert.equal(renderBody.includes('left.appendChild(this.renderLandscapeCommandRail(landscapeRootMenuSurface));'), true);
  assert.equal(renderBody.includes("const canRenderLandscapeRightSubmenu = landscapeLayout\n      && canRenderEditorPlanSurface(landscapeLayout, 'right-drawer')"), true);
  assert.equal(renderBody.includes("&& canRenderEditorPlanSurface(landscapeLayout, 'landscape-right-submenu');"), true);
  assert.equal(renderBody.includes("const canRenderLandscapeRootDrawer = landscapeLayout\n      && canRenderEditorPlanSurface(landscapeLayout, 'left-overlay-drawer');"), true);
  assert.equal(actorEditorSource.includes("canRenderEditorPlanSurface(landscapeLayout, 'right-overlay-drawer')"), false);
  assert.equal(renderBody.includes('const landscapeRootMenuSurface = canRenderLandscapeRootRail'), true);
  assert.equal(renderBody.includes('const landscapeSubmenuSurface = canRenderLandscapeRightSubmenu'), true);
  assert.equal(renderBody.includes('const landscapeOverlayDrawerSurface = canRenderLandscapeRootDrawer'), true);
  assert.equal(renderBody.includes('const landscapeRootDrawerSurface = canRenderLandscapeRootDrawer'), true);
  assert.equal(renderBody.includes('const landscapeToolOptionsSurface = canRenderLandscapeBottomRail'), true);
  assert.equal(renderBody.includes('const mainPanel = this.renderMainPanel(actor, state);'), true);
  assert.equal(renderBody.includes("flex: '1 1 auto'"), true);
  assert.equal(renderBody.includes("overflowY: 'auto'"), true);
  assert.equal(renderBody.includes('center.appendChild(this.renderLandscapeBottomRail());'), true);
  assert.equal(renderBody.includes('if (landscapeRootMenuSurface) left.style.height = `${landscapeRootMenuSurface.h}px`;'), true);
  assert.equal(renderBody.includes('const activeLandscapeDrawerSurface = this.landscapeRootDrawerOpen ? landscapeRootDrawerSurface : (landscapeSubmenuSurface ?? landscapeOverlayDrawerSurface);'), false);
  assert.equal(renderBody.includes('const activeLandscapeSubmenuSurface = landscapeSubmenuSurface ?? landscapeOverlayDrawerSurface;'), true);
  assert.equal(renderBody.includes('const rightRailWidth = activeLandscapeSubmenuSurface?.w ?? railWidth;'), true);
  assert.equal(renderBody.includes('if (activeLandscapeSubmenuSurface) {'), true);
  assert.equal(renderBody.includes('landscapeRootDrawerHost.style.left = `${landscapeRootDrawerSurface.x}px`;'), true);
  assert.equal(renderBody.includes("rightRail.style.position = 'absolute';"), true);
  assert.equal(renderBody.includes('rightRail.style.left = `${activeLandscapeSubmenuSurface?.x ?? viewportW - rightRailWidth}px`;'), true);
  assert.equal(renderBody.includes('rightRail.style.height = `${activeLandscapeSubmenuSurface?.h ?? viewportH}px`;'), true);
  assert.equal(renderBody.includes('landscapeLayout.leftRail'), false);
  assert.equal(renderBody.includes('landscapeLayout.rightRail'), false);
  assert.equal(renderBody.includes("left.style.overflow = 'hidden';"), true);
  assert.equal(actorEditorSource.includes("menu.style.overflowX = 'hidden';"), true);
  assert.equal(actorEditorSource.includes("menu.style.touchAction = isPortraitMobile ? 'auto' : 'pan-y';"), true);
  assert.equal(actorEditorSource.includes('const ACTOR_LANDSCAPE_BOTTOM_RAIL_HEIGHT = 72;'), true);
  assert.equal(actorEditorSource.includes('renderLandscapeBottomRail()'), true);
  assert.equal(actorEditorSource.includes('actor-editor-landscape-bottom-rail'), true);
  assert.equal(commandRailBody.includes('buildCompactLandscapeCommandRailActions({'), true);
  assert.equal(commandRailBody.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(commandRailBody.includes("display: 'block'"), true);
  assert.equal(commandRailBody.includes("position: 'relative'"), true);
  assert.equal(commandRailBody.includes("btn.style.position = 'absolute';"), true);
  assert.equal(commandRailBody.includes("id: 'menu'"), true);
  assert.equal(commandRailBody.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(commandRailBody.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(commandRailBody.includes("id: 'play-scene'"), true);
  assert.equal(drawerBody.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(drawerBody.includes('ACTOR_CONTROLLER_ROOT_ENTRIES.forEach((entry, index) => {'), true);
  assert.equal(drawerBody.includes('this.landscapeRootDrawerOpen = true;'), true);
  assert.equal(drawerBody.includes('this.landscapeRootDrawerOpen = false;'), false);
  assert.equal(drawerBody.includes("this.actorPortraitMenuOpen = true;"), true);
  assert.equal(drawerBody.includes("display: 'block'"), true);
  assert.equal(drawerBody.includes("position: 'relative'"), true);
  assert.equal(drawerBody.includes("btn.style.position = 'absolute';"), true);
  assert.equal(drawerBody.includes('const buttonBounds = grid.items[index].bounds;'), true);
  assert.equal(drawerBody.includes("overflow: 'hidden'"), true);
  assert.equal(drawerBody.includes("touchAction: 'manipulation'"), true);
  assert.equal(drawerBody.includes("overflowY: 'auto'"), false);
  assert.equal(bottomRailBody.includes("id: 'state-graph', label: 'State Graph'"), true);
  assert.equal(bottomRailBody.includes("id: 'hitbox-zones', label: 'Collision Zones'"), true);
  assert.equal(bottomRailBody.includes("id: 'add-state', label: 'Add State'"), true);
  assert.equal(bottomRailBody.includes("{ id: 'play-scene', label: 'Play Scene', primary: true, onClick: () => this.playActorScene() }"), false);
});

test('Cutscene gamepad mode replaces the left landscape rail with submenu slide-out', () => {
  const drawIndex = cutsceneEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBody = cutsceneEditorSource.slice(drawIndex, cutsceneEditorSource.indexOf('  computeLayout(width, height, { gamepadMenuState = null } = {})', drawIndex));
  const landscapeIndex = cutsceneEditorSource.indexOf("const landscape = buildLandscapeTouchEditorShellPlan('cutscene'");
  const landscapeStart = cutsceneEditorSource.lastIndexOf('    const resolvedGamepadMenuState', landscapeIndex);
  const landscapeBody = cutsceneEditorSource.slice(landscapeStart, cutsceneEditorSource.indexOf('    const work = landscape.surfaces.workSurface;', landscapeIndex));

  assert.equal(cutsceneEditorSource.includes('buildGamepadSlideOutMenuPlan'), true);
  assert.equal(cutsceneEditorSource.includes('ControllerMenuStack'), true);
  assert.equal(cutsceneEditorSource.includes('resolveGamepadMenuState({'), true);
  assert.equal(cutsceneEditorSource.includes('resolveEditorViewportModeFlags'), true);
  assert.equal(cutsceneEditorSource.includes('shouldDrawGamepadSubmenuOnLeft(width, height)'), true);
  assert.equal(cutsceneEditorSource.includes('return this.getGamepadMenuState(width, height).drawSlideOut;'), true);
  assert.equal(cutsceneEditorSource.includes('const viewportMode = this.resolveCutsceneViewportMode(width, height);\n    return resolveGamepadMenuState({'), true);
  assert.equal(cutsceneEditorSource.includes('isMobile: viewportMode.isMobileViewport,'), true);
  assert.equal(drawBody.includes('const gamepadMenuState = this.getGamepadMenuState(safeW, safeH);'), true);
  assert.equal(drawBody.includes('this.viewportWidth = safeW;'), true);
  assert.equal(drawBody.includes('this.viewportHeight = safeH;'), true);
  assert.equal(drawBody.includes('const layout = this.computeLayout(safeW, safeH, { gamepadMenuState });'), true);
  assert.equal(drawBody.includes('const drawGamepadLeft = gamepadMenuState.drawSlideOut;'), true);
  assert.equal(drawBody.includes('if (canRenderLandscapeRootRail && !drawGamepadLeft) this.drawLandscapeRootRail(ctx, layout.leftMenuBounds);'), true);
  assert.equal(drawBody.includes('this.drawGamepadSlideOutPanel(ctx, layout.leftMenuBounds);'), true);
  assert.equal(drawBody.includes("const canRenderLandscapeBottomRail = layout.isLandscapeTouch\n        ? canRenderEditorPlanSurface(layout.landscapeShell, 'bottom-tool-rail')"), true);
  assert.equal(drawBody.includes('if (!layout.isDesktop && (layout.isPortrait || canRenderLandscapeBottomRail)) {'), true);
  assert.equal(drawBody.includes("gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')"), true);
  assert.equal(cutsceneEditorSource.includes('computeLayout(width, height, { gamepadMenuState = null } = {})'), true);
  assert.equal(landscapeBody.includes('const resolvedGamepadMenuState = gamepadMenuState || this.getGamepadMenuState(width, height);'), true);
  assert.equal(landscapeBody.includes('const gamepadSubmenuOnLeft = resolvedGamepadMenuState.drawSlideOut;'), true);
  assert.equal(landscapeBody.includes('reserveRightRail: !gamepadSubmenuOnLeft && (this.landscapeRootDrawerOpen || this.menuOpen || this.clipOptionsOpen)'), true);
  assert.equal(landscapeBody.includes('reserveRightRail: !this.shouldDrawGamepadSubmenuOnLeft(width, height)'), false);
  assert.equal(drawBody.includes('if (gamepadMenuState.drawControllerOverlay) {'), true);
  assert.equal(cutsceneEditorSource.includes('this.bounds.gamepadMenuContent = list;'), true);
  assert.equal(cutsceneEditorSource.includes("menuId: 'gamepad-submenu'"), true);
  assert.equal(cutsceneEditorSource.includes("scrollState: { 'gamepad-submenu': this.controllerMenu.scroll?.[menuId] || 0 }"), true);
  assert.equal(cutsceneEditorSource.includes('this.controllerMenu.scroll[menuId] = drag.nextScroll;'), true);
});

test('Cutscene gamepad slide-out rows render focused state', () => {
  const drawBody = cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'),
    cutsceneEditorSource.indexOf('  isControllerMenuItemActive(menuId, itemId)', cutsceneEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'))
  );

  assert.ok(drawBody.includes('focused: this.controllerMenu.isFocusedItem(menuId, item.id, index)'));
});

test('Cutscene landscape touch uses compact left rail, left root drawer, and right submenu drawer', () => {
  const actionRailIndex = cutsceneEditorSource.indexOf('  drawActionRail(ctx, bounds, isPortrait)');
  const actionRailBody = cutsceneEditorSource.slice(actionRailIndex, cutsceneEditorSource.indexOf('  drawActionButton(ctx, bounds, action)', actionRailIndex));
  const landscapeActionBody = actionRailBody.slice(actionRailBody.indexOf(': ['));

  assert.equal(cutsceneEditorSource.includes("buildLandscapeTouchEditorShellPlan('cutscene'"), true);
  assert.equal(cutsceneEditorSource.includes('isLandscapeTouch: true'), true);
  assert.equal(cutsceneEditorSource.includes('this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });\n    resetSharedThumbstickState(this.panJoystick);\n    const railH = 86;'), true);
  assert.equal(cutsceneEditorSource.includes('const work = landscape.surfaces.workSurface;'), true);
  assert.equal(cutsceneEditorSource.includes('railBounds: landscape.surfaces.toolOptions'), true);
  assert.equal(cutsceneEditorSource.includes('landscapeShell: landscape,'), true);
  assert.equal(cutsceneEditorSource.includes('leftMenuBounds: commandRail'), true);
  assert.equal(cutsceneEditorSource.includes('reserveRightRail: !gamepadSubmenuOnLeft && (this.landscapeRootDrawerOpen || this.menuOpen || this.clipOptionsOpen)'), true);
  assert.equal(cutsceneEditorSource.includes("rootDrawerOverlayOrigin: 'left'"), false);
  assert.equal(cutsceneEditorSource.includes('const submenuDrawer = landscape.surfaces.submenu;'), true);
  assert.equal(cutsceneEditorSource.includes('const overlayDrawer = landscape.surfaces.overlayDrawer;'), true);
  assert.equal(cutsceneEditorSource.includes('const rootDrawer = landscape.surfaces.rootDrawer ?? overlayDrawer;'), true);
  assert.equal(cutsceneEditorSource.includes('const commandRail = landscape.surfaces.compactCommandRail ?? landscape.surfaces.rootMenu;'), true);
  assert.equal(cutsceneEditorSource.includes('const drawerSurface = submenuDrawer ?? overlayDrawer;'), true);
  assert.equal(cutsceneEditorSource.includes('const drawerW = drawerSurface?.w ?? getSharedMobileDrawerWidth(width, height, commandRail?.w || 76, { edgePadding: 0 });'), true);
  assert.equal(cutsceneEditorSource.includes('const rootDrawerW = rootDrawer?.w ?? drawerW;'), true);
  assert.equal(cutsceneEditorSource.includes('rootMenuBounds: {'), true);
  assert.equal(cutsceneEditorSource.includes('x: rootDrawer?.x ?? commandRail.x + commandRail.w,'), true);
  assert.equal(cutsceneEditorSource.includes('h: drawerSurface?.h ?? height'), true);
  assert.equal(cutsceneEditorSource.includes("const canRenderLandscapeBottomRail = layout.isLandscapeTouch\n        ? canRenderEditorPlanSurface(layout.landscapeShell, 'bottom-tool-rail')"), true);
  assert.equal(cutsceneEditorSource.includes("const canRenderLandscapeSubmenu = layout.isLandscapeTouch\n        && canRenderEditorPlanSurface(layout.landscapeShell, 'right-drawer')"), true);
  assert.equal(cutsceneEditorSource.includes("&& canRenderEditorPlanSurface(layout.landscapeShell, 'landscape-right-submenu');"), true);
  assert.equal(cutsceneEditorSource.includes("const canRenderLandscapeRootDrawer = layout.isLandscapeTouch\n        && canRenderEditorPlanSurface(layout.landscapeShell, 'left-overlay-drawer');"), true);
  assert.equal(cutsceneEditorSource.includes("canRenderEditorPlanSurface(layout.landscapeShell, 'right-overlay-drawer')"), false);
  assert.equal(cutsceneEditorSource.includes('if (canRenderLandscapeRootRail && !drawGamepadLeft) this.drawLandscapeRootRail(ctx, layout.leftMenuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes('buildCompactLandscapeCommandRailActions({'), true);
  assert.equal(cutsceneEditorSource.includes('buildCompactLandscapeCommandRailButtonLayout({'), true);
  assert.equal(cutsceneEditorSource.includes("id: 'landscape-menu'"), true);
  assert.equal(cutsceneEditorSource.includes("id: 'undo', label: 'Undo'"), true);
  assert.equal(cutsceneEditorSource.includes("id: 'redo', label: 'Redo'"), true);
  assert.equal(cutsceneEditorSource.includes("quick: { id: 'play'"), true);
  assert.equal(cutsceneEditorSource.includes('if (canRenderLandscapeRootDrawer) this.drawLandscapeRootDrawer(ctx, layout.rootMenuBounds ?? layout.menuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes('if (canRenderLandscapeSubmenu) this.drawLandscapeSubmenuPanel(ctx, layout.menuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes('buildLandscapeRootDrawerGridLayout({'), true);
  assert.equal(cutsceneEditorSource.includes('grid.items.forEach(({ index, bounds }) => {'), true);
  assert.equal(cutsceneEditorSource.includes('this.bounds.landscapeRootScrollMax = 0;'), true);
  assert.equal(cutsceneEditorSource.includes('const scrolledGrid = buildScrolledLandscapeRootDrawerItems(grid, this.landscapeRootScroll || 0);'), false);
  assert.equal(cutsceneEditorSource.includes('this.landscapeRootScroll = 0;'), true);
  assert.equal(cutsceneEditorSource.includes('scrolledGrid.items.forEach(({ index, bounds }) => {'), false);
  assert.equal(cutsceneEditorSource.includes('CUTSCENE_CONTROLLER_ROOTS.slice(this.landscapeRootScroll, this.landscapeRootScroll + visibleRows)'), false);
  assert.equal(cutsceneEditorSource.includes('const getCutsceneMenuLabel = (id, fallback = \'Add\') => CUTSCENE_DESKTOP_MENU_LABELS[id] || fallback;'), true);
  assert.equal(cutsceneEditorSource.includes('const entry = CUTSCENE_CONTROLLER_ROOT_ENTRIES[index];'), true);
  assert.equal(cutsceneEditorSource.includes('drawSharedMenuButtonLabel(ctx, button, entry.label || getCutsceneMenuLabel(id, id), { color, fontSize: 11, maxWidth: button.w - 8 });'), true);
  assert.equal(cutsceneEditorSource.includes("ctx.fillText(getCutsceneMenuLabel(this.activeMenuTab, 'Menu'), bounds.x + pad, bounds.y + 20, bounds.w - pad * 2);"), true);
  assert.equal(cutsceneEditorSource.includes('buildMenuScrollDragState'), true);
  assert.equal(cutsceneEditorSource.includes('resolveMenuScrollDrag'), true);
  assert.equal(cutsceneEditorSource.includes("menuId: 'landscape-root'"), true);
  assert.equal(cutsceneEditorSource.includes("menuId: 'submenu'"), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'landscape-menu') {"), true);
  const landscapeTabIndex = cutsceneEditorSource.indexOf("      if (id?.startsWith?.('landscape-tab:')) {");
  const landscapeTabBody = cutsceneEditorSource.slice(landscapeTabIndex, cutsceneEditorSource.indexOf("      if (id?.startsWith?.('tab:'))", landscapeTabIndex));
  assert.equal(landscapeTabBody.includes('this.landscapeRootDrawerOpen = true;'), true);
  assert.equal(landscapeTabBody.includes('this.landscapeRootDrawerOpen = false;'), false);
  assert.equal(cutsceneEditorSource.includes('if (!drag.moved && drag.pendingHit?.id) this.handleButton(drag.pendingHit.id);'), true);
  assert.equal(actionRailBody.includes("id: 'view-canvas', label: 'Canvas'"), true);
  assert.equal(actionRailBody.includes("id: 'view-split', label: 'Split'"), true);
  assert.equal(actionRailBody.includes("id: 'view-timeline', label: 'Time'"), true);
  assert.equal(actionRailBody.includes("id: 'timeline-zoom-out', label: 'Zoom -'"), true);
  assert.equal(actionRailBody.includes("id: 'timeline-zoom-in', label: 'Zoom +'"), true);
  {
    const timelineMenuIndex = cutsceneEditorSource.indexOf("    if (tabId === 'timeline') {");
    const timelineMenuBody = cutsceneEditorSource.slice(timelineMenuIndex, cutsceneEditorSource.indexOf("    if (tabId === 'clips') {", timelineMenuIndex));
    assert.equal(timelineMenuBody.includes("id: 'play'"), true);
    assert.equal(timelineMenuBody.includes("id: 'step-frame'"), true);
    assert.equal(timelineMenuBody.includes("id: 'view-canvas'"), false);
    assert.equal(timelineMenuBody.includes("id: 'timeline-zoom-in'"), false);
  }
  assert.equal(landscapeActionBody.includes("{ id: 'undo', label: '↶', onClick: () => this.undo() }"), false);
  assert.equal(landscapeActionBody.includes("{ id: 'redo', label: '↷', onClick: () => this.redo() }"), false);
});

test('Cutscene portrait menu exposes compact bottom-first roots and rail actions', () => {
  const model = buildCutscenePortraitMenuModel();

  assert.deepEqual(model.rootTabs.map((tab) => tab.id), ['file', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'settings']);
  assert.deepEqual(model.bottomRailActions, ['menu', 'undo', 'redo', 'play']);
  assertSharedPortraitRailActionCount(model.bottomRailActions.map((id) => ({ id })), { editor: 'cutscene' });
  assert.equal(model.rootTabs.some((tab) => tab.id === 'edit'), false);
  assert.equal(model.rootTabs.some((tab) => tab.id === 'export'), false);
  assert.equal(cutsceneEditorSource.includes('const CUTSCENE_MENU_TABS = buildCutscenePortraitMenuModel().rootTabs;'), true);
  assert.equal(cutsceneEditorSource.includes('buildCutscenePortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean)'), true);
  assert.equal(cutsceneEditorSource.includes("portraitRootPlacement: 'bottom-rail'"), true);
  assert.equal(cutsceneEditorSource.includes('rootTabs: shared.rootTabs'), true);
  assert.equal(cutsceneEditorSource.includes('const rootRail = isPortrait ? (bounds.rootTabs || bounds.rootRail || bounds) : bounds;'), true);
  assert.equal(cutsceneEditorSource.includes('const sheetContent = isPortrait ? (bounds.subRail || bounds.sheetContent || bounds) : bounds;'), true);
  assert.equal(cutsceneEditorSource.includes('const items = this.getMenuItems().filter((item) => !item.divider && !item.separator);'), true);
});

test('Cutscene desktop keeps transport in the left column instead of a bottom rail', () => {
  const drawIndex = cutsceneEditorSource.indexOf('  draw(ctx, width, height)');
  const drawBlock = cutsceneEditorSource.slice(drawIndex, cutsceneEditorSource.indexOf('  computeLayout(width, height, { gamepadMenuState = null } = {})', drawIndex));
  const drawShellBody = drawBlock.slice(0, drawBlock.indexOf('      const gamepadMenuState = this.getGamepadMenuState(safeW, safeH);'));
  const timelineIndex = cutsceneEditorSource.indexOf('  drawTimeline(ctx, bounds)');
  const timelineBody = cutsceneEditorSource.slice(timelineIndex, cutsceneEditorSource.indexOf('  getClipAt(x, y)', timelineIndex));
  const desktopIndex = cutsceneEditorSource.indexOf('    if (isDesktop) {');
  const desktopBlock = cutsceneEditorSource.slice(desktopIndex, cutsceneEditorSource.indexOf('    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });', desktopIndex));
  const chromeIndex = cutsceneEditorSource.indexOf('  drawDesktopShellChrome(ctx, shell)');
  const chromeBody = cutsceneEditorSource.slice(chromeIndex, cutsceneEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds)', chromeIndex));
  const panelIndex = cutsceneEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds)');
  const panelBody = cutsceneEditorSource.slice(panelIndex, cutsceneEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', panelIndex));

  assert.equal(cutsceneEditorSource.includes('const isDesktop = viewportMode.isDesktop;'), true);
  assert.equal(drawBlock.includes("const canRenderLandscapeBottomRail = layout.isLandscapeTouch\n        ? canRenderEditorPlanSurface(layout.landscapeShell, 'bottom-tool-rail')"), true);
  assert.equal(drawBlock.includes('if (!layout.isDesktop && (layout.isPortrait || canRenderLandscapeBottomRail)) {'), true);
  assert.equal(drawShellBody.includes('ctx.fillStyle = UI_SUITE.colors.bg;'), true);
  assert.equal(drawShellBody.includes("ctx.fillStyle = '#071015';"), false);
  assert.equal(timelineBody.includes("drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border, title: 'Timeline', titleSize: 13 });"), true);
  assert.equal(cutsceneEditorSource.includes("fill: '#101922'"), false);
  assert.equal(cutsceneEditorSource.includes("fill: '#0d1720'"), false);
  assert.equal(desktopBlock.includes('bottomBarHeight'), false);
  assert.equal(desktopBlock.includes('railBounds: null'), true);
  assert.equal(drawBlock.includes('this.drawDesktopLeftOptions(ctx, layout.menuBounds);'), true);
  assert.equal(cutsceneEditorSource.includes('drawDesktopMenuPanel'), false);
  assert.equal(cutsceneEditorSource.includes('drawDesktopTransportPanel(ctx, bounds)'), true);
  assert.equal(chromeBody.includes('subtitle: getCutsceneMenuLabel(this.activeMenuTab)'), true);
  assert.equal(chromeBody.includes("subtitle: CUTSCENE_DESKTOP_MENU_LABELS[this.activeMenuTab] || this.activeMenuTab || 'Add'"), false);
  assert.equal(chromeBody.includes("subtitle: (this.activeMenuTab || 'add').toUpperCase()"), false);
  assert.equal(panelBody.includes('buildSharedDesktopContextTransportLayout(bounds, {'), true);
  assert.equal(panelBody.includes('includeTransport: true,'), true);
  assert.equal(panelBody.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(panelBody.includes('`Active: ${getCutsceneMenuLabel(this.activeMenuTab)}`'), true);
  assert.equal(panelBody.includes('const selectedClip = this.getSelectedClip();'), true);
  assert.equal(panelBody.includes('const selectedTrack = this.getSelectedTrack();'), true);
  assert.equal(panelBody.includes('const items = this.getMenuItems()'), false);
  assert.equal(panelBody.includes('Math.min(118, Math.max(96'), false);
  assert.equal(panelBody.includes('this.bounds.desktopMenuButtons.push(button)'), false);
  assert.equal(panelBody.includes('this.bounds.desktopMenuButtons'), false);
});

test('Cutscene draw recovery screen uses shared RTG Studio chrome', () => {
  const errorIndex = cutsceneEditorSource.indexOf('  drawError(ctx, width, height, error)');
  const errorBody = cutsceneEditorSource.slice(errorIndex, cutsceneEditorSource.indexOf('  getTimelineViewportOptions(bounds = this.bounds.timeline)', errorIndex));

  assert.ok(errorIndex > 0);
  assert.equal(errorBody.includes('ctx.fillStyle = UI_SUITE.colors.bg;'), true);
  assert.equal(errorBody.includes('drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });'), true);
  assert.equal(errorBody.includes('ctx.fillStyle = UI_SUITE.colors.text;'), true);
  assert.equal(errorBody.includes('ctx.fillStyle = UI_SUITE.colors.muted;'), true);
  assert.equal(errorBody.includes('ctx.font = `14px ${UI_SUITE.font.family}`;'), true);
  assert.equal(errorBody.includes('ctx.font = `12px ${UI_SUITE.font.family}`;'), true);
  assert.equal(errorBody.includes("ctx.fillStyle = '#12080b';"), false);
  assert.equal(errorBody.includes("ctx.fillStyle = '#fff';"), false);
  assert.equal(errorBody.includes("ctx.font = '14px Courier New';"), false);
});

test('Cutscene timeline scrollbars use shared RTG Studio chrome tokens', () => {
  const timelineIndex = cutsceneEditorSource.indexOf('  drawTimeline(ctx, bounds)');
  const timelineBody = cutsceneEditorSource.slice(timelineIndex, cutsceneEditorSource.indexOf('  drawActionRail(ctx, bounds, isPortrait)', timelineIndex));

  assert.ok(timelineIndex > 0);
  assert.equal(timelineBody.includes('drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border'), true);
  assert.equal(timelineBody.includes('ctx.fillStyle = UI_SUITE.colors.panel;\n      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);'), true);
  assert.equal(timelineBody.includes('ctx.strokeStyle = UI_SUITE.colors.border;\n      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);'), true);
  assert.equal(timelineBody.includes('ctx.fillStyle = UI_SUITE.colors.accent;\n      ctx.fillRect(thumbX, bar.y, thumbW, bar.h);'), true);
  assert.equal(timelineBody.includes('ctx.fillStyle = UI_SUITE.colors.accent;\n      ctx.fillRect(bar.x, thumbY, bar.w, thumbH);'), true);
  assert.equal(timelineBody.includes("ctx.fillStyle = 'rgba(255,255,255,0.15)';"), false);
  assert.equal(timelineBody.includes("ctx.fillStyle = '#ffe16a';\n      ctx.fillRect(thumbX, bar.y, thumbW, bar.h);"), false);
});

test('Cutscene desktop dropdown hits are separate from the left context panel', () => {
  const dropdownIndex = cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)');
  const dropdownBody = cutsceneEditorSource.slice(dropdownIndex, cutsceneEditorSource.indexOf('  getTransportActions()', dropdownIndex));
  const pointerDownIndex = cutsceneEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = cutsceneEditorSource.slice(pointerDownIndex, cutsceneEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));

  assert.ok(dropdownIndex >= 0);
  assert.ok(pointerDownIndex > dropdownIndex);
  assert.equal(dropdownBody.includes('this.bounds.desktopDropdownItems = [];'), true);
  assert.equal(dropdownBody.includes('this.bounds.desktopDropdownItems.push(button);'), true);
  assert.equal(dropdownBody.includes('this.bounds.desktopMenuButtons.push(button)'), false);
  assert.equal(pointerDownBody.includes("const desktopDropdownHit = isDesktopMode\n      ? this.bounds.desktopDropdownItems?.find((entry) => this.pointIn(entry, x, y))\n      : null;"), true);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, { x, y });'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.action?.();'), false);
  assert.equal(pointerDownBody.includes('if (isDesktopMode && this.bounds.desktopMenuPanel && this.pointIn(this.bounds.desktopMenuPanel, x, y)) {'), true);
  assert.equal(pointerDownBody.includes('this.bounds.desktopMenuButtons'), false);
});

test('Cutscene desktop left panel keeps Add commands in the top dropdown only', () => {
  const leftOptionsIndex = cutsceneEditorSource.indexOf('  drawDesktopLeftOptions(ctx, bounds)');
  const leftOptionsBody = cutsceneEditorSource.slice(leftOptionsIndex, cutsceneEditorSource.indexOf('  drawDesktopTransportPanel(ctx, bounds)', leftOptionsIndex));
  const clipsIndex = cutsceneEditorSource.indexOf("    if (tabId === 'clips') {");
  const clipsBody = cutsceneEditorSource.slice(clipsIndex, cutsceneEditorSource.indexOf("    if (tabId === 'keyframes')", clipsIndex));
  const audioIndex = cutsceneEditorSource.indexOf("    if (tabId === 'audio') {");
  const audioBody = cutsceneEditorSource.slice(audioIndex, cutsceneEditorSource.indexOf("    if (tabId === 'settings') {", audioIndex));
  const settingsIndex = cutsceneEditorSource.indexOf("    if (tabId === 'settings') {");
  const settingsBody = cutsceneEditorSource.slice(settingsIndex, cutsceneEditorSource.indexOf('    }\n    return [', settingsIndex));
  const stageBody = cutsceneEditorSource.slice(
    cutsceneEditorSource.indexOf('    return [', settingsIndex),
    cutsceneEditorSource.indexOf('  getClipLabel(clip)', settingsIndex)
  );

  assert.ok(leftOptionsIndex >= 0);
  assert.equal(leftOptionsBody.includes('this.drawDesktopAddQuickActions(ctx, contextBounds);'), false);
  assert.equal(cutsceneEditorSource.includes('  drawDesktopAddQuickActions(ctx, bounds)'), false);
  assert.equal(cutsceneEditorSource.includes("const addItems = this.getMenuItems('add').filter((item) => !item.disabled);"), false);
  assert.equal(cutsceneEditorSource.includes("ctx.fillText('Add'"), false);
  assert.equal(clipsBody.includes("id: 'clip-options'"), true);
  assert.equal(clipsBody.includes("id: 'duplicate'"), true);
  assert.equal(clipsBody.includes("id: 'copy'"), false);
  assert.equal(clipsBody.includes("id: 'paste'"), false);
  assert.equal(clipsBody.includes("id: 'delete'"), false);
  assert.equal(audioBody.includes("id: 'volume'"), true);
  assert.equal(audioBody.includes("id: 'fade'"), true);
  assert.equal(audioBody.includes("id: 'loop'"), true);
  assert.equal(audioBody.includes("id: 'music'"), false);
  assert.equal(audioBody.includes("id: 'sfx'"), false);
  assert.equal(audioBody.includes("id: 'master-volume'"), true);
  assert.equal(stageBody.includes("id: 'scene-duration'"), true);
  assert.equal(stageBody.includes("id: 'snap-size'"), true);
  assert.equal(stageBody.includes("id: 'master-volume'"), false);
  assert.equal(settingsBody.includes('return [];'), true);
  assert.equal(settingsBody.includes("id: 'view-canvas'"), false);
  assert.equal(settingsBody.includes("id: 'scene-duration'"), false);
  assert.equal(settingsBody.includes("id: 'master-volume'"), false);
});

test('Cutscene desktop dropdown commands only fire on release', () => {
  const pointerDownIndex = cutsceneEditorSource.indexOf('  handlePointerDown(payload)');
  const pointerDownBody = cutsceneEditorSource.slice(pointerDownIndex, cutsceneEditorSource.indexOf('  handlePointerMove(payload)', pointerDownIndex));
  const pointerMoveIndex = cutsceneEditorSource.indexOf('  handlePointerMove(payload)');
  const pointerMoveBody = cutsceneEditorSource.slice(pointerMoveIndex, cutsceneEditorSource.indexOf('  handlePointerUp(payload = {})', pointerMoveIndex));
  const pointerUpIndex = cutsceneEditorSource.indexOf('  handlePointerUp(payload = {})');
  const pointerUpBody = cutsceneEditorSource.slice(pointerUpIndex, cutsceneEditorSource.indexOf('  handleWheel(payload)', pointerUpIndex));

  assert.ok(pointerDownIndex >= 0);
  assert.ok(pointerMoveIndex > pointerDownIndex);
  assert.ok(pointerUpIndex > pointerMoveIndex);
  assert.equal(pointerDownBody.includes('this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, { x, y });'), true);
  assert.equal(pointerDownBody.includes('desktopDropdownHit.action?.();'), false);
  assert.equal(pointerMoveBody.includes('this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, { x, y });'), true);
  assert.equal(pointerUpBody.includes('if (this.pendingDesktopDropdownHit) {'), true);
  assert.equal(pointerUpBody.includes('const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, { x, y });'), true);
  assert.equal(pointerUpBody.includes('if (shouldActivate) {'), true);
  assert.equal(pointerUpBody.includes('hit.action?.();'), true);
  assert.equal(pointerUpBody.includes('const nextDropdown = resolveClosedDesktopDropdownState({'), true);
  assert.equal(pointerUpBody.includes('this.desktopDropdown = nextDropdown.dropdown;'), true);
});

test('Cutscene desktop dropdown uses the selected top root menu', () => {
  const dropdownIndex = cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)');
  const dropdownBody = cutsceneEditorSource.slice(dropdownIndex, cutsceneEditorSource.indexOf('  getTransportActions()', dropdownIndex));

  assert.equal(dropdownBody.includes('const controllerMenus = this.buildControllerMenus();'), true);
  assert.equal(dropdownBody.includes('const controllerMenu = controllerMenus[shell.dropdown.rootId] || controllerMenus[shell.dropdown.specId];'), true);
  assert.equal(dropdownBody.includes('const controllerItems = this.controllerMenu.getItems(controllerMenu);'), true);
  assert.equal(dropdownBody.includes('const dropdownItems = controllerItems.length ? controllerItems : this.getMenuItems(shell.dropdown.rootId);'), false);
  assert.equal(dropdownBody.includes('this.getMenuItems().filter'), false);
  assert.equal(cutsceneEditorSource.includes('active: Boolean(item.active),'), true);
});

test('Cutscene desktop dropdown caps rendered rows to drawer bounds', () => {
  const dropdownIndex = cutsceneEditorSource.indexOf('  drawDesktopDropdown(ctx, shell)');
  const dropdownBody = cutsceneEditorSource.slice(dropdownIndex, cutsceneEditorSource.indexOf('  getTransportActions()', dropdownIndex));

  assert.equal(dropdownBody.includes('const dropdownPlan = buildDesktopDropdownRenderPlan({'), true);
  assert.equal(dropdownBody.includes('items: controllerItems'), true);
  assert.equal(dropdownBody.includes('filter((item) => !item.disabled)'), false);
  assert.equal(dropdownBody.includes('drawSharedDesktopDropdown(ctx, dropdownPlan, {'), true);
  assert.equal(dropdownBody.includes('registerButton: ({ item, bounds }) => {'), true);
  assert.equal(dropdownBody.includes('disableActionlessItems: true'), true);
  assert.equal(dropdownBody.includes('const action = item.action || item.onClick'), true);
  assert.equal(dropdownBody.includes("typeof item.onSelect === 'function' ? () => item.onSelect(this) : null"), true);
  assert.equal(dropdownBody.includes('const button = createDesktopDropdownCommandHit(item, bounds, action);'), true);
  assert.equal(dropdownBody.includes('if (button.action) this.bounds.desktopDropdownItems.push(button);'), true);
  assert.equal(cutsceneEditorSource.includes('hit.action?.();'), true);
  assert.equal(cutsceneEditorSource.includes('fallbackRootId: this.activeMenuTab'), true);
});

test('Cutscene desktop top menu switches drawers on hover', () => {
  assert.equal(cutsceneEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(cutsceneEditorSource.includes("idPrefix: 'desktop-root:'"), true);
  assert.equal(cutsceneEditorSource.includes('const rootId = rootButton.rootId;'), true);
  assert.equal(cutsceneEditorSource.includes('rootId: nextTab,'), true);
  assert.equal(cutsceneEditorSource.includes("const isDesktopMode = this.activeViewportMode === 'desktop';"), true);
  assert.equal(cutsceneEditorSource.includes('if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({'), true);
  assert.equal(cutsceneEditorSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.drag && !this.menuScrollDrag) {"), true);
  assert.equal(cutsceneEditorSource.includes('this.activeMenuTab = nextTab;'), false);
});

test('SFX desktop top menu switches drawers on hover', () => {
  assert.equal(sfxEditorSource.includes('createDesktopRootMenuHit(button, () => this.invokeWithHistory(action), { kind: \'button\' })'), true);
  assert.equal(sfxEditorSource.includes('resolveDesktopDropdownHoverSwitch({'), true);
  assert.equal(sfxEditorSource.includes("rootIdKey: 'desktopRootId'"), true);
  assert.equal(sfxEditorSource.includes('rootId: rootHit.rootId,'), true);
  assert.equal(sfxEditorSource.includes("const isDesktopMode = this.activeViewportMode === 'desktop';"), true);
  assert.equal(sfxEditorSource.includes('if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({'), true);
  assert.equal(sfxEditorSource.includes("if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.sliderDrag) {"), true);
  assert.equal(sfxEditorSource.includes("mode: isDesktopMode\n        ? 'desktop'"), true);
  assert.equal(sfxEditorSource.includes('resolveClosedDesktopDropdownState({'), true);
  assert.equal(sfxEditorSource.includes('fallbackRootId: this.leftTab'), true);
  assert.equal(sfxEditorSource.includes('this.leftTab = rootHit.rootId;'), false);
});

test('Cutscene file menu uses the shared editor file menu model', () => {
  const fileMenuIndex = cutsceneEditorSource.indexOf("if (tabId === 'file') {");
  const fileMenuBody = cutsceneEditorSource.slice(fileMenuIndex, cutsceneEditorSource.indexOf("    if (tabId === 'edit')", fileMenuIndex));
  const editMenuIndex = cutsceneEditorSource.indexOf("    if (tabId === 'edit') {", fileMenuIndex);
  const editMenuBody = cutsceneEditorSource.slice(editMenuIndex, cutsceneEditorSource.indexOf("    if (tabId === 'add')", editMenuIndex));

  assert.equal(cutsceneEditorSource.includes('buildSharedEditorFileMenu'), true);
  assert.equal(fileMenuBody.includes('return buildSharedEditorFileMenu({'), true);
  assert.equal(fileMenuBody.includes('undo: false'), false);
  assert.equal(fileMenuBody.includes('redo: false'), false);
  assert.equal(fileMenuBody.includes("export: 'Export MP4'"), true);
  assert.equal(fileMenuBody.includes('actions: {'), true);
  assert.equal(fileMenuBody.includes('new: () => this.newDocument()'), true);
  assert.equal(fileMenuBody.includes('open: () => this.openDocument()'), true);
  assert.equal(fileMenuBody.includes('save: () => this.saveDocument()'), true);
  assert.equal(fileMenuBody.includes("'save-as': () => this.saveDocument({ forceSaveAs: true })"), true);
  assert.equal(fileMenuBody.includes('export: () => this.exportMovieMp4()'), true);
  assert.equal(fileMenuBody.includes('import: () => this.importImageClip()'), true);
  assert.equal(fileMenuBody.includes("item.id === 'export'"), true);
  assert.equal(cutsceneEditorSource.includes("getEditorControllerRootMenuEntries('cutscene')"), true);
  assert.equal(cutsceneEditorSource.includes("const CUTSCENE_CONTROLLER_ROOTS = getEditorControllerRootMenuIds('cutscene');"), true);
  assert.equal(cutsceneEditorSource.includes('items: CUTSCENE_CONTROLLER_ROOT_ENTRIES.map(rootItem)'), true);
  assert.equal(cutsceneEditorSource.includes('...Object.fromEntries(CUTSCENE_CONTROLLER_ROOT_ENTRIES.map((entry) => [entry.id, menuForTab(entry.id)]))'), true);
  assert.equal(cutsceneEditorSource.includes('itemCount: CUTSCENE_CONTROLLER_ROOT_ENTRIES.length'), true);
  assert.equal(cutsceneEditorSource.includes('const entry = CUTSCENE_CONTROLLER_ROOT_ENTRIES[index];'), true);
  assert.equal(editMenuBody.includes("{ id: 'undo', label: 'Undo' }"), true);
  assert.equal(editMenuBody.includes("{ id: 'redo', label: 'Redo' }"), true);
  assert.equal(editMenuBody.includes("{ id: 'copy', label: 'Copy', disabled: !selected }"), true);
  assert.equal(editMenuBody.includes("{ id: 'cut', label: 'Cut', disabled: !selected }"), true);
  assert.equal(editMenuBody.includes("{ id: 'paste', label: 'Paste', disabled: !this.clipboardClip }"), true);
  assert.equal(editMenuBody.includes("{ id: 'delete', label: 'Delete', disabled: !selected }"), true);
  assert.equal(cutsceneEditorSource.includes('disabled: Boolean(item.disabled),'), true);
  assert.equal(cutsceneEditorSource.includes('active: Boolean(item.active),'), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'export' || id === 'export-mp4') await this.exportMovieMp4();"), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'back' || id === 'exit-main') this.game.exitCutsceneEditor?.();"), true);
  assert.equal(cutsceneEditorSource.includes("items: this.getMenuItems(shell.dropdown.rootId).filter((item) => !item.disabled)"), false);
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
  assert.equal(actorEditorSource.includes("'.actor-editor-portrait-bottom-menu .actor-editor-state-list'"), true);
  assert.equal(actorEditorSource.includes('actor-editor-portrait-top'), false);
  assert.equal(actorEditorSource.includes("'.actor-editor-state-list'"), true);
  assert.ok(actorEditorSource.indexOf("'.actor-editor-portrait-bottom-menu .actor-editor-state-list'") < actorEditorSource.indexOf("'.actor-editor-center'"));
  assert.equal(actorEditorSource.includes("scrollTarget.scrollTop += dy * 0.8"), true);
  assert.equal(actorEditorSource.includes('selectActorState(stateId, { closePortraitMenu = false } = {})'), true);
  assert.equal(actorEditorSource.includes('this.actorPortraitMenuOpen = false;'), true);
  assert.equal(actorEditorSource.includes('this.controllerMenu.closeToSurface();'), true);
  assert.equal(actorEditorSource.includes("btn.onclick = () => this.selectActorState(state.id, { closePortraitMenu: true });"), true);
  assert.equal(actorEditorSource.includes("el('div', 'actor-editor-state-list actor-editor-rail-state-list')"), true);
  assert.equal(actorEditorSource.includes("row.style.touchAction = 'pan-y';"), true);
  assert.equal(actorEditorSource.includes('row.dataset.ignoreClick'), true);
  assert.equal(stylesSource.includes('.actor-editor-state-list'), true);
  assert.equal(stylesSource.includes('.actor-editor-portrait-bottom-menu .actor-editor-rail-state-list'), true);
  assert.equal(stylesSource.includes('.actor-editor-portrait-top'), false);
  assert.equal(stylesSource.includes('-webkit-overflow-scrolling: touch;'), true);
  assert.equal(stylesSource.includes('overscroll-behavior: contain;'), true);
  assert.equal(stylesSource.includes('touch-action: pan-y;'), true);
});

test('Actor collision editor thumbstick follows the shared touch surface contract', () => {
  const collisionBlock = actorEditorSource.slice(
    actorEditorSource.indexOf('  openCollisionZoneEditor(actor, { state = null } = {})'),
    actorEditorSource.indexOf('    const editingState = state ? clone(state) : null;', actorEditorSource.indexOf('  openCollisionZoneEditor(actor, { state = null } = {})'))
  );

  assert.equal(collisionBlock.includes('const collisionViewportMode = this.resolveActorViewportMode();'), true);
  assert.equal(collisionBlock.includes('getEditorPointerInteractionPolicy'), true);
  assert.equal(collisionBlock.includes("&& canRenderEditorSurface(collisionViewportMode.mode, 'touch-thumbstick')"), true);
});

test('Actor editor shared DOM controls use rounded tokenized chrome', () => {
  assert.equal(stylesSource.includes('--ui-bg: #07090e;'), true);
  assert.equal(stylesSource.includes('--ui-panel: rgba(8, 12, 20, 0.88);'), true);
  assert.equal(stylesSource.includes('--ui-panel-alt: rgba(18, 28, 42, 0.82);'), true);
  assert.equal(stylesSource.includes('--ui-border: rgba(190, 215, 245, 0.36);'), true);
  assert.equal(stylesSource.includes('--ui-font: Arial, Helvetica, sans-serif;'), true);
  assert.equal(stylesSource.includes('--editor-bg: var(--ui-bg);'), true);
  assert.equal(stylesSource.includes('--editor-surface: var(--ui-panel);'), true);
  assert.equal(stylesSource.includes('--editor-surface-alt: var(--ui-panel-alt);'), true);
  assert.equal(stylesSource.includes('--editor-border: var(--ui-border);'), true);
  assert.equal(stylesSource.includes('--editor-text: var(--ui-text);'), true);
  assert.equal(stylesSource.includes('--editor-text-muted: var(--ui-muted);'), true);
  assert.equal(stylesSource.includes('--editor-accent: var(--ui-accent);'), true);
  assert.equal(stylesSource.includes('--editor-accent-2: var(--ui-accent-2);'), true);
  assert.equal(stylesSource.includes('--editor-top-bar-height: 40px;'), true);
  assert.equal(stylesSource.includes('.actor-editor-btn { min-height: 36px; background: linear-gradient(to bottom, rgba(255,255,255,0.045), rgba(18,28,42,0.82)); color: var(--ui-text); border: 1px solid var(--ui-border); border-left: 4px solid rgba(111,171,231,0.72); border-radius: 6px;'), true);
  assert.equal(stylesSource.includes('.actor-editor-btn.active { background: linear-gradient(to bottom, rgba(255,225,106,0.22), rgba(46,86,132,0.72)); border-left-color: var(--ui-accent); color: #ffffff; }'), true);
  assert.equal(stylesSource.includes('.actor-editor-card { background: var(--ui-panel); border: 1px solid var(--ui-border); padding: 12px; border-radius: 6px; }'), true);
  assert.equal(stylesSource.includes('actor-editor-card input, .actor-editor-card select { min-height: 40px; background: rgba(18,28,42,0.82); color: var(--ui-text); border: 1px solid var(--ui-border); padding: 8px; border-radius: 6px;'), true);
  assert.equal(stylesSource.includes('.actor-editor-state-row, .actor-editor-list-row { display: flex; gap: 10px; align-items: center; background: rgba(18,28,42,0.72); border: 1px solid var(--ui-border); padding: 10px; border-radius: 6px; }'), true);
  assert.equal(stylesSource.includes('.actor-editor-gamepad-hint {\n  min-height: 30px;'), true);
  assert.equal(stylesSource.includes('background: rgba(8, 12, 20, 0.86);'), true);
  assert.equal(stylesSource.includes('.actor-editor-gamepad-prompts {\n  color: var(--ui-muted);'), true);
  assert.equal(stylesSource.includes('.actor-editor-gamepad-slideout {\n  background: var(--ui-panel);\n  border: 1px solid var(--ui-border);'), true);
  assert.equal(stylesSource.includes('.actor-editor-gamepad-slideout-title {\n  color: var(--ui-accent);'), true);
  assert.equal(stylesSource.includes('.actor-editor-gamepad-slideout-hint {\n  color: var(--ui-muted);'), true);
  assert.equal(stylesSource.includes('.actor-editor-portrait-bottom-menu .actor-editor-btn {\n  min-height: 44px;\n  border-radius: 6px;'), true);
});

test('shared editor canvas theme matches RTG Studio main menu palette', () => {
  assert.equal(UI_SUITE.colors.bg, '#07090e');
  assert.equal(UI_SUITE.colors.panel, 'rgba(8,12,20,0.88)');
  assert.equal(UI_SUITE.colors.panelAlt, 'rgba(18,28,42,0.82)');
  assert.equal(UI_SUITE.colors.border, 'rgba(190,215,245,0.36)');
  assert.equal(UI_SUITE.colors.text, '#f8fbff');
  assert.equal(UI_SUITE.colors.muted, 'rgba(198,220,245,0.78)');
  assert.equal(UI_SUITE.colors.accent, '#ffe16a');
  assert.equal(UI_SUITE.colors.accent2, '#5fb8a8');
  assert.equal(UI_SUITE.font.family, 'Arial, Helvetica, sans-serif');
  assert.equal(UI_SUITE.editorPanel.background, 'rgba(8,12,20,0.88)');
  assert.equal(UI_SUITE.editorPanel.border, 'rgba(190,215,245,0.36)');
  assert.equal(UI_SUITE.editorPanel.titleFont, '600 14px Arial');
});

test('gamepad hint bars use the shared RTG Studio chrome helper', () => {
  const hintBlocks = [
    pixelStudioSource.slice(pixelStudioSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), pixelStudioSource.indexOf('  getGamepadMenuState(width =', pixelStudioSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'))),
    levelEditorSource.slice(levelEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), levelEditorSource.indexOf('  getActiveGamepadMenuId()', levelEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'))),
    midiEditorSource.slice(midiEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), midiEditorSource.indexOf('  getActiveGamepadMenuId()', midiEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'))),
    sfxEditorSource.slice(sfxEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), sfxEditorSource.indexOf('  drawDesktopTopMenu(ctx, plan)', sfxEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'))),
    cutsceneEditorSource.slice(cutsceneEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), cutsceneEditorSource.indexOf('  getGamepadMenuState(width =', cutsceneEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'))),
    raceEditorSource.slice(raceEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)'), raceEditorSource.indexOf('  getRaceHandheldLayout(width, height)', raceEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)')))
  ];

  assert.equal(uiSuiteSource.includes('export function drawSharedGamepadHintBar'), true);
  assert.equal(uiSuiteSource.includes('UI_SUITE.colors.accent'), true);
  assert.equal(uiSuiteSource.includes('UI_SUITE.colors.muted'), true);
  assert.equal(uiSuiteSource.includes('UI_SUITE.font.family'), true);
  hintBlocks.forEach((block) => {
    assert.ok(block.length > 0);
    assert.equal(block.includes('drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS'), true);
    assert.equal(block.includes('Courier New'), false);
    assert.equal(block.includes('rgba(255,255,255'), false);
  });
});

test('editor gamepad slide-out panels share the RTG Studio header chrome', () => {
  const slideOutBlocks = [
    pixelStudioSource.slice(pixelStudioSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'), pixelStudioSource.indexOf('  drawTransformModal(ctx, width, height)', pixelStudioSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'))),
    levelEditorSource.slice(levelEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'), levelEditorSource.indexOf('  drawGamepadHintBar(ctx, bounds, contextLabel)', levelEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'))),
    midiEditorSource.slice(midiEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'), midiEditorSource.indexOf('  drawDangerButton(ctx, bounds, label)', midiEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'))),
    sfxEditorSource.slice(sfxEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'), sfxEditorSource.indexOf('  drawDesktopTopMenu(ctx, plan)', sfxEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'))),
    cutsceneEditorSource.slice(cutsceneEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)'), cutsceneEditorSource.indexOf('  isControllerMenuItemActive(menuId, itemId)', cutsceneEditorSource.indexOf('  drawGamepadSlideOutPanel(ctx, bounds)')))
  ];

  assert.equal(uiSuiteSource.includes('export function drawSharedGamepadSlideOutHeader'), true);
  assert.equal(uiSuiteSource.includes("hint = 'A Select  B Back  LB/RB Tabs  Start System'"), true);
  slideOutBlocks.forEach((block) => {
    assert.ok(block.length > 0);
    const headerIndex = block.indexOf('drawSharedGamepadSlideOutHeader(ctx, bounds,');
    assert.ok(headerIndex >= 0);
    const headerBlock = block.slice(Math.max(0, headerIndex - 220), headerIndex + 220);
    assert.equal(headerBlock.includes('A Select  B Back'), false);
    assert.equal(headerBlock.includes('Courier New'), false);
    assert.equal(headerBlock.includes('rgba(255,255,255'), false);
  });
  slideOutBlocks.forEach((block) => {
    assert.equal(block.includes('{ hint: plan.headerHint }'), true);
  });
  slideOutBlocks.forEach((block) => {
    assert.equal(block.includes('const plannedFocusById = new Map(plannedItems.map((item) => [item.id, Boolean(item.focused)]));'), true);
    assert.equal(block.includes('plan.focus?.submenuItemId'), true);
    assert.equal(block.includes('plan.focus?.rootItemId'), true);
  });
  const actorSlideOutBlock = actorEditorSource.slice(
    actorEditorSource.indexOf('  renderGamepadSlideOutRail(menuId)'),
    actorEditorSource.indexOf('  renderDesktopTopMenu(shellLayout)', actorEditorSource.indexOf('  renderGamepadSlideOutRail(menuId)'))
  );
  assert.equal(actorSlideOutBlock.includes("el('div', 'actor-editor-gamepad-slideout-hint', plan.headerHint)"), true);
  assert.equal(actorSlideOutBlock.includes("el('div', 'actor-editor-gamepad-slideout-hint', 'A Select  B Back')"), false);
  assert.equal(actorSlideOutBlock.includes('const plannedFocusById = new Map(plannedItems.map((item) => [item.id, Boolean(item.focused)]));'), true);
  assert.equal(actorSlideOutBlock.includes('plan.focus?.submenuItemId'), true);
  assert.equal(actorSlideOutBlock.includes('plan.focus?.rootItemId'), true);
  assert.equal(actorEditorSource.includes('renderControllerSubmenuRail(menuId, { plannedFocusById, focusedItemId })'), true);
  assert.equal(actorEditorSource.includes('Boolean(plannedFocusById.get(item.id))'), true);
});

test('desktop editor ribbons share the RTG Studio ribbon chrome', () => {
  assert.match(uiSuiteSource, /export function drawSharedDesktopRibbon/);
  assert.match(uiSuiteSource, /fill = UI_SUITE\.colors\.panelAlt/);
  assert.match(uiSuiteSource, /ctx\.fillStyle = UI_SUITE\.colors\.accent/);
  assert.match(uiSuiteSource, /ctx\.fillStyle = UI_SUITE\.colors\.muted/);
  assert.match(uiSuiteSource, /UI_SUITE\.font\.family/);
  assert.equal(uiSuiteSource.includes("clipMenuLabel(ctx, String(title || ''), labelMaxW)"), true);
  assert.equal(uiSuiteSource.includes("clipMenuLabel(ctx, String(subtitle), labelMaxW)"), true);
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.match(source, /drawSharedDesktopRibbon/);
  });
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.doesNotMatch(source, /drawSharedPanel\(ctx, .*leftRibbon/);
  });
  assert.equal(actorEditorSource.includes("el('div', 'actor-editor-menu-rail actor-editor-desktop-ribbon')"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-ribbon \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border: 1px solid var\(--ui-border\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-ribbon-title \{[\s\S]*color: var\(--ui-accent\);/);
});

test('shared desktop ribbon clips long title and subtitle text', () => {
  const textCalls = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText(value, x, y, maxWidth) {
      textCalls.push({ value: String(value), x, y, maxWidth });
    },
    measureText(value) {
      return { width: String(value || '').length * 8 };
    },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; }
  };
  drawSharedDesktopRibbon(ctx, { x: 0, y: 0, w: 96, h: 58 }, {
    title: 'Extremely Long Desktop Ribbon Title',
    subtitle: 'Very Long Desktop Ribbon Subtitle'
  });

  assert.equal(textCalls.length, 2);
  assert.equal(textCalls.every((call) => call.maxWidth === 72), true);
  assert.equal(textCalls.every((call) => call.value.endsWith('…')), true);
});

test('desktop top menus share the RTG Studio menu chrome', () => {
  assert.match(uiSuiteSource, /export function drawSharedDesktopTopMenu/);
  assert.equal(uiSuiteSource.includes("rendered.surface = 'top-menu';"), true);
  assert.equal(uiSuiteSource.includes("rendered.role = 'desktop-root-menu';"), true);
  assert.equal(uiSuiteSource.includes('rendered.fit = plan?.fit || null;'), true);
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.match(source, /drawSharedDesktopTopMenu/);
  });
  const rendered = drawSharedDesktopTopMenu(null, {
    bounds: { x: 0, y: 0, w: 400, h: 40 },
    fit: {
      visibleCount: 3,
      totalCount: 5,
      hasHiddenOverflow: true
    }
  });
  assert.equal(Array.isArray(rendered), true);
  assert.equal(rendered.surface, 'top-menu');
  assert.equal(rendered.role, 'desktop-root-menu');
  assert.deepEqual(rendered.fit, {
    visibleCount: 3,
    totalCount: 5,
    hasHiddenOverflow: true
  });
  assert.equal(actorEditorSource.includes("const top = el('div', 'actor-editor-desktop-top-menu');"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-top-menu \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border-bottom: 1px solid var\(--ui-border\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-menu-btn \{[\s\S]*background: transparent;[\s\S]*color: var\(--ui-text\);/);
});

test('desktop context panels share the RTG Studio context chrome', () => {
  assert.match(uiSuiteSource, /export function drawSharedDesktopContextPanel/);
  assert.equal(uiSuiteSource.includes('SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES'), true);
  assert.equal(uiSuiteSource.includes("title = 'Active'"), true);
  assert.equal(uiSuiteSource.includes("title = 'Context'"), false);
  assert.equal(uiSuiteSource.includes("role = 'context-inspector'"), true);
  assert.equal(uiSuiteSource.includes("surface = 'left-context-panel'"), true);
  assert.equal(uiSuiteSource.includes("clipMenuLabel(ctx, String(title || 'Context'), textMaxWidth)"), true);
  assert.equal(uiSuiteSource.includes('clipMenuLabel(ctx, String(line), textMaxWidth)'), true);
  assert.equal(uiSuiteSource.includes('clipMenuLabel(ctx, String(status), textMaxWidth)'), true);
  assert.equal(uiSuiteSource.includes('duplicatesTopDropdownCommands: false'), true);
  assert.deepEqual(drawSharedDesktopContextPanel(null, { x: 0, y: 0, w: 10, h: 10 }, {
    contentRoles: ['document-summary', 'top-dropdown', 'status', 'document-summary', 'menu-command']
  }), {
    surface: 'left-context-panel',
    role: 'context-inspector',
    contentRoles: ['document-summary', 'status'],
    duplicatesTopDropdownCommands: false
  });
  assert.equal(SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES.includes('top-dropdown'), false);
  assert.equal(SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES.includes('menu-command'), false);
  assert.match(uiSuiteSource, /export function buildSharedDesktopContextTransportLayout/);
  assert.equal(uiSuiteSource.includes('includeTransport = false,'), true);
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.match(source, /drawSharedDesktopContextPanel/);
  });
  assert.equal(pixelStudioSource.includes('`Menu: ${this.leftPanelTab}`'), false);
  assert.equal(levelEditorSource.includes('`Menu: ${activeTab}`'), false);
  assert.equal(midiEditorSource.includes("`Menu: ${menuId === 'tracks' ? 'Mixer' : menuId}`"), false);
  assert.equal(sfxEditorSource.includes('`Menu: ${this.leftTab}`'), false);
  assert.equal(cutsceneEditorSource.includes('`Menu: ${CUTSCENE_DESKTOP_MENU_LABELS[this.activeMenuTab] || this.activeMenuTab || \'Add\'}`'), false);
  assert.equal(raceEditorSource.includes('`Menu: ${this.activeAction || \'None\'}`'), false);
  assert.equal(pixelStudioSource.includes('`Active: ${this.getDesktopPanelLabel()}`'), true);
  assert.equal(pixelStudioSource.includes("contentRoles: getEditorDesktopLeftContextRoles('pixel')"), true);
  assert.equal(levelEditorSource.includes('`Active: ${getLevelDesktopPanelLabel(activeTab)}`'), true);
  assert.equal(levelEditorSource.includes("contentRoles: getEditorDesktopLeftContextRoles('level')"), true);
  assert.equal(midiEditorSource.includes('`Active: ${this.getDesktopMenuLabel(menuId)}`'), true);
  assert.equal(midiEditorSource.includes("contentRoles: ['document-summary', 'selection-summary', 'contextual-quick-actions', 'transport', 'status']"), true);
  assert.equal(sfxEditorSource.includes('`Active: ${activeLabel}`'), true);
  assert.equal(sfxEditorSource.includes("contentRoles: ['document-summary', 'selection-summary', 'transport', 'status']"), true);
  assert.equal(cutsceneEditorSource.includes('`Active: ${getCutsceneMenuLabel(this.activeMenuTab)}`'), true);
  assert.equal(cutsceneEditorSource.includes("contentRoles: getEditorDesktopLeftContextRoles('cutscene')"), true);
  assert.equal(cutsceneEditorSource.includes("contentRoles: ['document-summary', 'selection-summary', 'contextual-quick-actions', 'transport', 'status']"), false);
  assert.equal(raceEditorSource.includes('`Active: ${this.activeAction || \'None\'}`'), true);
  assert.equal(raceEditorSource.includes("contentRoles: ['document-summary', 'selection-summary', 'status']"), true);
  assert.equal(raceEditorSource.includes('this.mode === \'car\''), true);
  assert.equal(raceEditorSource.includes('`Race: ${race.name}`'), true);
  assert.equal(raceEditorSource.includes('`${this.selectedCar.name} tuning`'), true);
  assert.equal(actorEditorSource.includes("['Menu', this.getActorDesktopRootLabel()]"), false);
  assert.equal(actorEditorSource.includes("['Active', this.getActorDesktopRootLabel()]"), true);
  assert.equal(actorEditorSource.includes("wrap.dataset.surface = 'left-context-panel';"), true);
  assert.equal(actorEditorSource.includes("wrap.dataset.role = 'context-inspector';"), true);
  assert.equal(actorEditorSource.includes("wrap.dataset.contentRoles = 'document-summary selection-summary status';"), true);
  assert.equal(actorEditorSource.includes("rail.dataset.duplicatesTopDropdownCommands = 'false';"), true);
  assert.equal(pixelStudioSource.includes('const { contextBounds } = buildSharedDesktopContextTransportLayout(bounds, {'), true);
  assert.equal(pixelStudioSource.includes('drawSharedDesktopContextPanel(ctx, contextBounds, {'), true);
  assert.equal(levelEditorSource.includes('const { contextBounds: contextPanel } = buildSharedDesktopContextTransportLayout(shellLayout.leftOptions, {'), true);
  assert.equal(levelEditorSource.includes('includeTransport: false'), true);
  assert.equal(actorEditorSource.includes("const wrap = el('div', 'actor-editor-desktop-left-panel');"), true);
  assert.equal(actorEditorSource.includes("el('span', 'actor-editor-desktop-context-key', label)"), true);
  assert.equal(actorEditorSource.includes("el('span', 'actor-editor-desktop-context-value', String(value))"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-left-panel \{[\s\S]*display: flex;[\s\S]*gap: var\(--ui-gap\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-options \{[\s\S]*background: var\(--ui-panel\);[\s\S]*overflow-y: auto;/);
  const pixelShellChrome = pixelStudioSource.slice(
    pixelStudioSource.indexOf('  drawDesktopShellChrome(ctx, shell)'),
    pixelStudioSource.indexOf('  drawDesktopContextPanel(ctx, bounds)')
  );
  assert.equal(pixelShellChrome.includes('drawSharedPanel(ctx, shell.leftOptions)'), false);
});

test('shared desktop context panel clips long title, line, and status text', () => {
  const textCalls = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText(value, x, y, maxWidth) {
      textCalls.push({ value: String(value), x, y, maxWidth });
    },
    measureText(value) {
      return { width: String(value || '').length * 8 };
    },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; }
  };
  drawSharedDesktopContextPanel(ctx, { x: 0, y: 0, w: 96, h: 130 }, {
    title: 'Very Long Desktop Context Panel Title',
    lines: ['Active: Extremely Long Tool Context That Should Not Overflow'],
    status: 'Status: Long-running desktop command description'
  });

  assert.equal(textCalls.length, 3);
  assert.equal(textCalls.every((call) => call.maxWidth === 80), true);
  assert.equal(textCalls.every((call) => call.value.endsWith('…')), true);
});

test('desktop dropdown drawers share the RTG Studio dropdown chrome', () => {
  assert.match(uiSuiteSource, /export function drawSharedDesktopDropdown/);
  [
    pixelStudioSource,
    levelEditorSource,
    midiEditorSource,
    sfxEditorSource,
    cutsceneEditorSource,
    raceEditorSource
  ].forEach((source) => {
    assert.match(source, /drawSharedDesktopDropdown/);
  });
  assert.match(uiSuiteSource, /renderItem = null/);
  assert.match(uiSuiteSource, /typeof renderItem === 'function'/);
  assert.match(uiSuiteSource, /ctx\.shadowColor = shadow/);
  assert.match(uiSuiteSource, /ctx\.shadowBlur = 28/);
  assert.match(uiSuiteSource, /ctx\.shadowOffsetY = 12/);
  assert.equal(actorEditorSource.includes("const drawer = el('div', 'actor-editor-desktop-dropdown');"), true);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown \{[\s\S]*box-shadow: 0 12px 28px rgba\(0,0,0,0\.35\);/);
  assert.match(stylesSource, /\.actor-editor-desktop-dropdown \{[\s\S]*background: var\(--ui-panel\);[\s\S]*border: 1px solid var\(--ui-border\);/);
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
  assert.equal(actorEditorSource.includes('const rightRailContent = isDesktopLayout'), true);
  assert.equal(actorEditorSource.includes(': this.renderRightRail();'), true);
  assert.equal(actorEditorSource.includes('if (rightRailContent) menuSheet.appendChild(rightRail);'), true);
  assert.equal(actorEditorSource.includes("this.actorPortraitMenuOpen = !(isPortraitMobile && id === 'actor');"), true);
  assert.equal(actorEditorSource.includes("this.actorPortraitMenuOpen = true;\n          this.fileMenuOpen = false;\n          this.activeMenuSection = 'actor';"), true);
});

test('Actor desktop collision body damage focuses contact damage settings', () => {
  const actionsIndex = actorEditorSource.indexOf('  getActorDesktopActions(rootId)');
  const dropdownIndex = actorEditorSource.indexOf('  getActorDesktopDropdownActions(rootId)', actionsIndex);
  assert.ok(actionsIndex >= 0);
  assert.ok(dropdownIndex > actionsIndex);
  const actionsBody = actorEditorSource.slice(actionsIndex, dropdownIndex);
  const collisionIndex = actionsBody.indexOf('      collision: [');
  const behaviorIndex = actionsBody.indexOf('      behavior: [', collisionIndex);
  assert.ok(collisionIndex >= 0);
  assert.ok(behaviorIndex > collisionIndex);
  const collisionBody = actionsBody.slice(collisionIndex, behaviorIndex);

  assert.equal(collisionBody.includes("active: this.activeMenuSection === 'actor' && this.activeActorSettingsFocus === 'contactDamage'"), true);
  assert.equal(collisionBody.includes("onClick: () => openActorSettings('contactDamage')"), true);
  assert.equal(collisionBody.includes("{ id: 'body-damage', label: 'Body Damage', onClick: openStateEditor }"), false);
  assert.equal(actorEditorSource.includes('this.activeActorSettingsFocus = focusKey;'), true);
  assert.equal(actorEditorSource.includes("addField('Body contact damage'"), true);
  assert.equal(actorEditorSource.includes("{ key: 'contactDamage' }"), true);
  assert.equal(stylesSource.includes('.actor-editor-field.focused'), true);
});

test('controller root menus keep history commands inside Edit drawers', () => {
  const rootBlocks = [
    pixelStudioSource.slice(
      pixelStudioSource.indexOf("      root: {\n        id: 'root',\n        title: 'Pixel Editor'"),
      pixelStudioSource.indexOf("      draw: { id: 'draw'", pixelStudioSource.indexOf("      root: {\n        id: 'root',\n        title: 'Pixel Editor'"))
    ),
    levelEditorSource.slice(
      levelEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Level Editor'"),
      levelEditorSource.indexOf("      edit: {\n        id: 'edit'", levelEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Level Editor'"))
    ),
    midiEditorSource.slice(
      midiEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'MIDI Composer'"),
      midiEditorSource.indexOf("      grid: {", midiEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'MIDI Composer'"))
    ),
    sfxEditorSource.slice(
      sfxEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'SFX Editor'"),
      sfxEditorSource.indexOf("      edit: {\n        id: 'edit'", sfxEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'SFX Editor'"))
    ),
    actorEditorSource.slice(
      actorEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Actor Editor'"),
      actorEditorSource.indexOf("      edit: desktopMenu('edit', 'Edit')", actorEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Actor Editor'"))
    ),
    cutsceneEditorSource.slice(
      cutsceneEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Cutscene Editor'"),
      cutsceneEditorSource.indexOf('      ...Object.fromEntries', cutsceneEditorSource.indexOf("      root: {\n        id: 'root',\n        title: 'Cutscene Editor'"))
    )
  ];

  rootBlocks.forEach((block) => {
    assert.ok(block.length > 0);
    assert.equal(block.includes("action('undo'"), false);
    assert.equal(block.includes("action('redo'"), false);
    assert.equal(block.includes("id: 'undo'"), false);
    assert.equal(block.includes("id: 'redo'"), false);
  });

  const pixelToolsIndex = pixelStudioSource.indexOf("      tools: {\n        id: 'tools',\n        title: 'Tools'");
  const pixelSystemIndex = pixelStudioSource.indexOf('      system: buildControllerSystemMenu({', pixelToolsIndex);
  assert.ok(pixelToolsIndex >= 0);
  assert.ok(pixelSystemIndex > pixelToolsIndex);
  const pixelToolsBlock = pixelStudioSource.slice(pixelToolsIndex, pixelSystemIndex);
  assert.equal(pixelToolsBlock.includes("items: toolItems('tools')"), true);
  assert.equal(pixelToolsBlock.includes("action('undo'"), false);
  assert.equal(pixelToolsBlock.includes("action('redo'"), false);
  assert.equal(pixelToolsBlock.includes("action('copy'"), false);
  assert.equal(pixelToolsBlock.includes("action('paste'"), false);
});

test('desktop ribbons do not duplicate Edit history commands', () => {
  assert.equal(pixelStudioSource.includes("this.drawButton(ctx, undoBounds, 'Undo'"), false);
  assert.equal(pixelStudioSource.includes("this.drawButton(ctx, redoBounds, 'Redo'"), false);
  assert.equal(levelEditorSource.includes("drawButton(undoBounds.x, undoBounds.y, undoBounds.w, undoBounds.h, 'Undo'"), false);
  assert.equal(levelEditorSource.includes("drawButton(redoBounds.x, redoBounds.y, redoBounds.w, redoBounds.h, 'Redo'"), false);
  assert.equal(midiEditorSource.includes("this.drawButton(ctx, this.bounds.undoButton, 'Undo'"), false);
  assert.equal(midiEditorSource.includes("this.drawButton(ctx, this.bounds.redoButton, 'Redo'"), false);
  assert.equal(midiEditorSource.includes('this.bounds.undoButton = null;'), true);
  assert.equal(midiEditorSource.includes('this.bounds.redoButton = null;'), true);
  assert.equal(actorEditorSource.includes("const undoBtn = el('button', 'actor-editor-btn', 'Undo');"), false);
  assert.equal(actorEditorSource.includes("const redoBtn = el('button', 'actor-editor-btn', 'Redo');"), false);
  assert.equal(actorEditorSource.includes("['Undo', () => this.undo()]"), false);
  assert.equal(actorEditorSource.includes("['Redo', () => this.redo()]"), false);
  assert.equal(cutsceneEditorSource.includes("const undoBounds = { x: shell.leftRibbon.x"), false);
  assert.equal(cutsceneEditorSource.includes("const redoBounds = { x: shell.leftRibbon.x"), false);
  assert.equal(cutsceneEditorSource.includes("button.id === 'undo' ? 'Undo' : 'Redo'"), false);
});
