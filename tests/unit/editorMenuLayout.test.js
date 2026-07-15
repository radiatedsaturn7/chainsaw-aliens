import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyDesktopDropdownWheelScrollState,
  buildCompactLandscapeCommandRailActions,
  buildCompactLandscapeCommandRailButtonLayout,
  buildDesktopEditorShellPlan,
  buildDesktopDropdownPlan,
  buildDesktopDropdownRenderPlan,
  buildDesktopTopMenuPlan,
  buildEditorMenuLayoutPlan,
  buildGamepadSlideOutMenuPlan,
  buildLandscapeRootDrawerGridLayout,
  buildScrolledLandscapeRootDrawerItems,
  buildLandscapeTouchEditorShellPlan,
  buildMenuScrollDragState,
  applyDesktopDropdownCommandDataset,
  applyDesktopRootMenuDataset,
  createDesktopDropdownCommandHit,
  createDesktopRootMenuHit,
  createPendingDesktopDropdownHit,
  findScrollableMenuRegion,
  getEditorPointerInteractionPolicy,
  getEditorMenuPlacement,
  getMenuScrollPolicy,
  isGamepadLandscapeEditorMode,
  resolveClosedDesktopDropdownState,
  resolveDesktopDropdownHoverSwitch,
  resolveDesktopDropdownMotionProgress,
  resolveDesktopDropdownState,
  resolveDesktopDropdownWheelScroll,
  resolveDesktopRootMenuHit,
  resolveGamepadMenuState,
  resolveEditorViewportModeFlags,
  getEditorModeContract,
  getEditorModeSurfaceContract,
  getEditorModeSurfaceVisibility,
  getLandscapeTouchShellEffectiveSurfaceVisibility,
  getEditorPlanSurfaceVisibility,
  getEditorSurfaceVisibility,
  getEditorModePresentationInteractionContract,
  resolveMenuWheelScroll,
  resolveMenuScrollDrag,
  resolveEditorLayoutMode,
  canRenderEditorSurface,
  canRenderEditorPlanSurface,
  MODE_INTERACTION_CONTRACTS,
  MODE_PRESENTATION_CONTRACTS,
  DESKTOP_CONTEXT_PANEL_CONTRACT,
  DESKTOP_DROPDOWN_COMMAND_CONTRACT,
  DESKTOP_DROPDOWN_STATE_CONTRACT,
  DESKTOP_SHELL_SURFACE_CONTRACT,
  COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT,
  COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH,
  LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT,
  GAMEPAD_FOCUS_RING_CONTRACT,
  GAMEPAD_SLIDE_OUT_MENU_CONTRACT,
  EDITOR_MODE_ACCEPTANCE_CONTRACTS,
  EDITOR_SURFACES,
  REQUIRED_MODE_SURFACES,
  SUPPRESSED_MODE_SURFACES,
  getEditorModeAcceptanceContract,
  validateEditorModePresentationInteractionContracts,
  validateEditorModeAcceptanceContracts,
  validateEditorModeSurfaceContracts,
  validateEditorWorkSurfaceTypes,
  resolveOpenDesktopDropdownState,
  resolvePendingDesktopDropdownHit,
  shouldCloseDesktopDropdownOnPointerDown,
  shouldCloseDesktopDropdownOnDomPointerDown,
  shouldSuppressEditorContextMenu,
  shouldUseGamepadSlideOutMenu,
  updatePendingDesktopDropdownHit
} from '../../src/ui/shared/editorMenuLayout.js';
import {
  DESKTOP_FILE_BASELINE_ACTION_IDS,
  DESKTOP_FILE_FOOTER_ACTION_ID,
  EDITOR_LAYOUT_MODES,
  PORTRAIT_ROOT_MAX_ITEMS,
  SHARED_EDITOR_IDS,
  getEditorDesktopLeftContextRoles,
  getEditorMenuModeContract,
  getEditorMenuSection,
  getEditorRootMenuEntries
} from '../../src/ui/shared/editorMenuSpec.js';
import {
  SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES,
  drawSharedDesktopDropdown,
  drawSharedPortraitSheet
} from '../../src/ui/uiSuite.js';

const ALL_EDITOR_IDS = SHARED_EDITOR_IDS;
const uiSpecSource = readFileSync(new URL('../../UISpec.md', import.meta.url), 'utf8');
const editorUiContractSource = readFileSync(new URL('../../ui/EDITORS_UI_CONTRACT.md', import.meta.url), 'utf8');
const editorMenuLayoutSource = readFileSync(new URL('../../src/ui/shared/editorMenuLayout.js', import.meta.url), 'utf8');
const canvasEditorDesktopDropdownSources = {
  pixel: readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8'),
  tile: readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8'),
  level: readFileSync(new URL('../../src/ui/LevelEditorCore.js', import.meta.url), 'utf8'),
  midi: readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8'),
  sfx: readFileSync(new URL('../../src/ui/SfxEditor.js', import.meta.url), 'utf8'),
  cutscene: readFileSync(new URL('../../src/ui/CutsceneEditor.js', import.meta.url), 'utf8'),
  race: readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8'),
  car: readFileSync(new URL('../../src/ui/RaceEditor.js', import.meta.url), 'utf8')
};
const actorEditorSource = readFileSync(new URL('../../src/ui/ActorEditor.js', import.meta.url), 'utf8');
const editorDesktopDropdownSources = {
  ...canvasEditorDesktopDropdownSources,
  actor: actorEditorSource
};

test('layout mode resolver distinguishes portrait, landscape, desktop, and gamepad', () => {
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 390, viewportHeight: 844 }), EDITOR_LAYOUT_MODES.PORTRAIT);
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 844, viewportHeight: 390 }), EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  assert.equal(resolveEditorLayoutMode({ isMobile: false, viewportWidth: 1280, viewportHeight: 800 }), EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(resolveEditorLayoutMode({ isMobile: false, viewportWidth: 1280, viewportHeight: 800, gamepadConnected: true }), EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 844, viewportHeight: 390, gamepadConnected: true }), EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.equal(resolveEditorLayoutMode({ isMobile: true, viewportWidth: 390, viewportHeight: 844, gamepadConnected: true }), EDITOR_LAYOUT_MODES.PORTRAIT);
});

test('UI docs describe the shared desktop command and context surface contract', () => {
  assert.equal(uiSpecSource.includes('buildEditorMenuLayoutPlan()` exposes each mode'), true);
  assert.equal(uiSpecSource.includes('landscape `compactCommandRail`/`rootDrawer` split'), true);
  assert.equal(uiSpecSource.includes('Desktop command surfaces are `top-dropdown` drawers.'), true);
  assert.equal(uiSpecSource.includes('Desktop shell surfaces come from `DESKTOP_SHELL_SURFACE_CONTRACT`'), true);
  assert.equal(uiSpecSource.includes('Root menu drawers start closed, drop down only from explicit top-menu interaction'), true);
  assert.equal(uiSpecSource.includes('Desktop dropdown rows use `DESKTOP_DROPDOWN_COMMAND_CONTRACT`'), true);
  assert.equal(uiSpecSource.includes('Desktop dropdown state and motion use `DESKTOP_DROPDOWN_STATE_CONTRACT`'), true);
  assert.equal(uiSpecSource.includes('Opening a desktop drawer records shared `openedAtMs` timing'), true);
  assert.equal(uiSpecSource.includes('pass the live dropdown state into `buildDesktopDropdownRenderPlan()`'), true);
  assert.equal(uiSpecSource.includes('Clicking away closes the open drawer and it must stay closed on redraw'), true);
  assert.equal(uiSpecSource.includes('Every editor File drawer starts with the same desktop baseline order from `DESKTOP_FILE_BASELINE_ACTION_IDS`: New, Save, Save As, Open, Export, Import.'), true);
  assert.equal(uiSpecSource.includes('File drawers must not contain history, clipboard, or other Edit-role actions; those commands live in Edit.'), true);
  assert.equal(uiSpecSource.includes('Every editor Edit drawer starts with Undo and Redo.'), true);
  assert.equal(uiSpecSource.includes('After the history rows, Edit drawer role groups follow clipboard, selection, duplicate, target-specific edits, then destructive actions'), true);
  assert.equal(uiSpecSource.includes('Unsupported baseline actions should remain visible as disabled rows'), true);
  assert.equal(uiSpecSource.includes('Desktop left context panels should use contextual language such as `Active`, not `Menu`'), true);
  assert.equal(editorUiContractSource.includes("commandSurfaces: ['top-dropdown']"), true);
  assert.equal(editorUiContractSource.includes('Desktop dropdown drawers start closed.'), true);
  assert.equal(editorUiContractSource.includes('Shared desktop dropdown state owns `openedAtMs`'), true);
  assert.equal(editorUiContractSource.includes('Desktop dropdown state and motion use `DESKTOP_DROPDOWN_STATE_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('Desktop dropdown command rows use `DESKTOP_DROPDOWN_COMMAND_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('resolveDesktopDropdownState({ previousDropdown })'), true);
  assert.equal(editorUiContractSource.includes('so `slide-down` motion progress is driven by shared state'), true);
  assert.equal(editorUiContractSource.includes('Editors must not pass the active panel, active tool, selected tab, or selected document context as the default open dropdown root.'), true);
  assert.equal(editorUiContractSource.includes('Click-away state must survive the next draw'), true);
  assert.equal(editorUiContractSource.includes('File dropdown drawers must begin with `DESKTOP_FILE_BASELINE_ACTION_IDS`: `New`, `Save`, `Save As`, `Open`, `Export`, `Import`.'), true);
  assert.equal(editorUiContractSource.includes('File dropdown drawers must end with `DESKTOP_FILE_FOOTER_ACTION_ID`'), true);
  assert.equal(editorUiContractSource.includes('File dropdown drawers must not include history, clipboard, or other Edit-role actions'), true);
  assert.equal(editorUiContractSource.includes('Edit dropdown drawers must begin with the shared history row order `Undo`, `Redo`'), true);
  assert.equal(editorUiContractSource.includes('Edit dropdown role groups must follow `history -> clipboard -> selection -> duplicate -> targetEdit -> destructive`'), true);
  assert.equal(editorUiContractSource.includes('Unsupported baseline actions stay visible as disabled rows with inert hit targets.'), true);
  assert.equal(editorUiContractSource.includes('**Race Editor**, and **Car Editor**'), true);
  assert.equal(editorUiContractSource.includes("persistentSurfaces: ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']"), true);
  assert.equal(editorUiContractSource.includes('suppressedMobileSurfaces'), true);
  assert.equal(editorUiContractSource.includes('`gamepad-slide-out` so desktop cannot accidentally render mobile or controller chrome.'), true);
  assert.equal(editorUiContractSource.includes('surfaceRoles.desktopMobileRailsHidden'), true);
  assert.equal(editorUiContractSource.includes('Desktop must set `desktopMobileRailsHidden` to `true`.'), true);
  assert.equal(editorUiContractSource.includes('Shared desktop plans expose `leftContextPanelContract`'), true);
  assert.equal(editorUiContractSource.includes('Shared desktop shell plans expose `DESKTOP_SHELL_SURFACE_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('contextual quick actions must be contextual and must not duplicate the open dropdown'), true);
  assert.equal(editorUiContractSource.includes('modeSurfaces.compactCommandRail'), true);
  assert.equal(editorUiContractSource.includes('Shared landscape shell surfaces come from `LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('surfaceRoles.persistentNavigationActionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT'), true);
  assert.equal(uiSpecSource.includes('Gamepad slide-out surfaces, controls, row activation, and suppressed touch surfaces come from `GAMEPAD_SLIDE_OUT_MENU_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('Gamepad mode uses `GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface`'), true);
  assert.equal(editorUiContractSource.includes('suppressed touch surfaces from `GAMEPAD_SLIDE_OUT_MENU_CONTRACT`'), true);
  assert.equal(editorUiContractSource.includes('Shared gamepad slide-out plans expose `focusRingContract`'), true);
  assert.equal(editorUiContractSource.includes('Focus rings must be visible on every focused actionable row'), true);
  assert.equal(uiSpecSource.includes('Editors may opt the full root drawer to a right overlay or work-surface overlay'), false);
  assert.equal(editorUiContractSource.includes('Editors may opt into `right-overlay-drawer` or a work-surface overlay'), false);
  assert.equal(uiSpecSource.includes('The root drawer must originate from the compact left rail'), true);
  assert.equal(editorUiContractSource.includes('It originates from the compact left rail as `left-overlay-drawer`, while `RightRail` remains reserved'), true);
  assert.equal(uiSpecSource.includes("Bridge Actor Editor's DOM UI into the shared spec."), false);
  assert.equal(uiSpecSource.includes("Keep Actor Editor's DOM UI covered by the same shared desktop, landscape, portrait, and gamepad contracts as the canvas editors."), true);
});

test('shared editor surface ids are centralized and immutable', () => {
  assert.equal(Object.isFrozen(EDITOR_SURFACES), true);
  const knownSurfaces = new Set(Object.values(EDITOR_SURFACES));
  assert.equal(EDITOR_SURFACES.desktopTopMenu, 'desktop-top-menu');
  assert.equal(EDITOR_SURFACES.topDropdown, 'top-dropdown');
  assert.equal(EDITOR_SURFACES.leftOverlayDrawer, 'left-overlay-drawer');
  assert.equal(EDITOR_SURFACES.leftSlideOutDrawer, 'left-slide-out-drawer');
  assert.equal(DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface, EDITOR_SURFACES.topDropdown);
  assert.equal(knownSurfaces.has(DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface), true);
  assert.equal(DESKTOP_CONTEXT_PANEL_CONTRACT.surface, EDITOR_SURFACES.leftContextPanel);
  assert.deepEqual(DESKTOP_CONTEXT_PANEL_CONTRACT.allowedContentRoles, [...SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES]);
  assert.equal(LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer);
  assert.equal(GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface, EDITOR_SURFACES.gamepadSlideOut);
  assert.equal(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT].includes(EDITOR_SURFACES.bottomActionRail), true);
  assert.equal(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP].includes(EDITOR_SURFACES.touchThumbstick), true);
  assert.deepEqual(validateEditorModeSurfaceContracts(), []);
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    const contract = getEditorModeContract(mode);
    [
      contract.rootSurface,
      contract.commandSurface,
      contract.submenuSurface,
      contract.persistentContextSurface,
      contract.persistentNavigationSurface,
      contract.rootDrawerSurface,
      contract.rightSubmenuSurface
    ].filter(Boolean).forEach((surface) => {
      assert.equal(knownSurfaces.has(surface), true, `${mode}:${surface}`);
    });
  });
});

test('mode acceptance contracts define standard surfaces, input, and thumbstick behavior', () => {
  assert.equal(Object.isFrozen(EDITOR_MODE_ACCEPTANCE_CONTRACTS), true);
  assert.deepEqual(validateEditorModeAcceptanceContracts(), []);

  const portrait = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.PORTRAIT);
  assert.equal(portrait.rootCommandSurface, EDITOR_SURFACES.bottomRail);
  assert.equal(portrait.commandSurface, EDITOR_SURFACES.bottomSheet);
  assert.equal(portrait.thumbstickPolicy, 'required');
  assert.equal(portrait.menuDrillDirection, 'up');
  assert.equal(portrait.pointerType, 'touch');

  const landscape = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  assert.equal(landscape.rootCommandSurface, EDITOR_SURFACES.leftRail);
  assert.equal(landscape.submenuSurface, EDITOR_SURFACES.rightDrawer);
  assert.equal(landscape.thumbstickPolicy, 'required');
  assert.equal(landscape.menuDrillDirection, 'right');

  const desktop = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(desktop.rootCommandSurface, EDITOR_SURFACES.topMenu);
  assert.equal(desktop.commandSurface, EDITOR_SURFACES.topDropdown);
  assert.equal(desktop.persistentContextSurface, EDITOR_SURFACES.leftContextPanel);
  assert.equal(desktop.thumbstickPolicy, 'suppressed');
  assert.equal(desktop.menuDrillDirection, 'down');
  assert.equal(desktop.wheelRoutesToHoveredPanel, true);

  const gamepad = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.equal(gamepad.rootCommandSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface);
  assert.equal(gamepad.commandSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface);
  assert.equal(gamepad.thumbstickPolicy, 'suppressed');
  assert.equal(gamepad.menuDrillDirection, 'left-slide-replace');
  assert.equal(gamepad.focusPolicy, GAMEPAD_FOCUS_RING_CONTRACT.focusRing);

  assert.equal(getEditorModeAcceptanceContract('unknown-mode').mode, EDITOR_LAYOUT_MODES.DESKTOP);
});

test('comparison editor desktop left panels expose context roles instead of duplicated top menu commands', () => {
  const expectedRoles = {
    pixel: ['active-tool', 'swatches', 'layers', 'frames'],
    level: ['active-tool', 'tile-palette', 'actor-palette', 'selected-placement'],
    cutscene: ['insert-palette', 'selected-clip', 'timeline', 'scene-settings'],
    actor: ['actor-properties', 'state-list', 'linked-parts', 'preview-settings']
  };

  Object.entries(expectedRoles).forEach(([editorId, roles]) => {
    const plan = buildDesktopEditorShellPlan(editorId, {
      viewportWidth: 1280,
      viewportHeight: 720,
      rootEntries: getEditorRootMenuEntries(editorId)
    });
    assert.deepEqual(getEditorDesktopLeftContextRoles(editorId), roles, editorId);
    assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP, editorId);
    assert.equal(plan.leftContextPanelContract.surface, EDITOR_SURFACES.leftContextPanel, editorId);
    assert.equal(plan.leftContextPanelContract.duplicatesTopDropdownCommands, false, editorId);
    assert.equal(plan.leftContextPanelContract.contextualQuickActionPolicy.mustNotDuplicateOpenDropdown, true, editorId);
    roles.forEach((role) => {
      assert.equal(role.includes('menu') || role.includes('dropdown'), false, `${editorId}:${role}`);
    });
  });
});

test('Race and Car desktop left panels use shared workflow context roles', () => {
  const expectedRoles = {
    race: ['active-tool', 'tile-palette', 'route-painting', 'track-settings'],
    car: ['active-tool', 'car-properties', 'paint-swatches', 'test-drive-settings']
  };

  Object.entries(expectedRoles).forEach(([editorId, roles]) => {
    const plan = buildDesktopEditorShellPlan(editorId, {
      viewportWidth: 1280,
      viewportHeight: 720,
      activeRootId: 'file',
      rootEntries: getEditorRootMenuEntries(editorId)
    });
    const fileDropdown = buildDesktopDropdownPlan(editorId, 'file');
    const editDropdown = buildDesktopDropdownPlan(editorId, 'edit');

    assert.deepEqual(getEditorDesktopLeftContextRoles(editorId), roles, editorId);
    assert.equal(plan.leftContextPanelContract.surface, EDITOR_SURFACES.leftContextPanel, editorId);
    assert.equal(plan.leftContextPanelContract.duplicatesTopDropdownCommands, false, editorId);
    assert.equal(plan.dropdown.rootId, 'file', editorId);
    assert.deepEqual(fileDropdown.items.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length).map((item) => item.id), DESKTOP_FILE_BASELINE_ACTION_IDS, editorId);
    assert.deepEqual(editDropdown.items.slice(0, 2).map((item) => item.id), ['undo', 'redo'], editorId);
    roles.forEach((role) => {
      assert.equal(role.includes('menu') || role.includes('dropdown'), false, `${editorId}:${role}`);
    });
  });

  assert.equal(canvasEditorDesktopDropdownSources.race.includes('contentRoles: getEditorDesktopLeftContextRoles(this.editorId)'), true);
});

test('all desktop editors expose shared left context roles and shared dropdown helpers', () => {
  const expectedRoles = {
    pixel: ['active-tool', 'swatches', 'layers', 'frames'],
    tile: ['active-tool', 'tile-palette', 'tile-properties', 'preview-settings'],
    level: ['active-tool', 'tile-palette', 'actor-palette', 'selected-placement'],
    actor: ['actor-properties', 'state-list', 'linked-parts', 'preview-settings'],
    midi: ['active-tool', 'transport', 'global-music-settings', 'tracks'],
    sfx: ['active-tool', 'timeline', 'oscillator-settings', 'envelope-settings'],
    cutscene: ['insert-palette', 'selected-clip', 'timeline', 'scene-settings'],
    race: ['active-tool', 'tile-palette', 'route-painting', 'track-settings'],
    car: ['active-tool', 'car-properties', 'paint-swatches', 'test-drive-settings']
  };

  Object.entries(expectedRoles).forEach(([editorId, roles]) => {
    const plan = buildDesktopEditorShellPlan(editorId, {
      viewportWidth: 1280,
      viewportHeight: 720,
      activeRootId: 'file',
      rootEntries: getEditorRootMenuEntries(editorId)
    });
    const source = editorDesktopDropdownSources[editorId];

    assert.deepEqual(getEditorDesktopLeftContextRoles(editorId), roles, editorId);
    assert.equal(plan.topMenu.buttons.length > 0, true, editorId);
    assert.equal(plan.leftContextPanelContract.duplicatesTopDropdownCommands, false, editorId);
    assert.equal(plan.dropdown.rootId, 'file', editorId);
    assert.deepEqual(
      buildDesktopDropdownPlan(editorId, 'file').items.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length).map((item) => item.id),
      DESKTOP_FILE_BASELINE_ACTION_IDS,
      editorId
    );
    assert.deepEqual(buildDesktopDropdownPlan(editorId, 'edit').items.slice(0, 2).map((item) => item.id), ['undo', 'redo'], editorId);
    assert.equal(source.includes('buildDesktopEditorShellPlan('), true, `${editorId}:shell`);
    assert.equal(source.includes('buildDesktopDropdownRenderPlan('), true, `${editorId}:dropdown`);
    roles.forEach((role) => assert.equal(role.includes('menu') || role.includes('dropdown'), false, `${editorId}:${role}`));
  });

  assert.equal(canvasEditorDesktopDropdownSources.pixel.includes("contentRoles: getEditorDesktopLeftContextRoles('pixel')"), true);
  assert.equal(canvasEditorDesktopDropdownSources.tile.includes("contentRoles: getEditorDesktopLeftContextRoles('tile')"), true);
  assert.equal(canvasEditorDesktopDropdownSources.midi.includes("contentRoles: getEditorDesktopLeftContextRoles('midi')"), true);
  assert.equal(canvasEditorDesktopDropdownSources.sfx.includes("contentRoles: getEditorDesktopLeftContextRoles('sfx')"), true);
});

test('portrait shared rail interactions stay bottom-first with touch activation', () => {
  const acceptance = getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.PORTRAIT);
  const plan = buildEditorMenuLayoutPlan('midi', {
    viewportWidth: 390,
    viewportHeight: 844,
    isMobile: true
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.PORTRAIT);
  assert.equal(acceptance.rootCommandSurface, EDITOR_SURFACES.bottomRail);
  assert.equal(acceptance.commandSurface, EDITOR_SURFACES.bottomSheet);
  assert.equal(acceptance.submenuSurface, EDITOR_SURFACES.bottomSheet);
  assert.equal(acceptance.thumbstickPolicy, 'required');
  assert.equal(acceptance.pointerType, 'touch');
  assert.equal(acceptance.rowActivation, 'tap-release');
  assert.equal(acceptance.gestureScroll, true);
  assert.equal(plan.touch.usesBottomMenus, true);
  assert.equal(plan.touch.usesSideRails, false);
  assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.bottomRail), true);
  assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.touchThumbstick), true);
  assert.notEqual(getEditorPlanSurfaceVisibility(plan, EDITOR_SURFACES.topMenu), 'required');
  assert.notEqual(getEditorPlanSurfaceVisibility(plan, EDITOR_SURFACES.leftSlideOutDrawer), 'required');
});

test('desktop dropdown rows expose command metadata for release activation across editors', () => {
  Object.entries(editorDesktopDropdownSources).forEach(([editorId, source]) => {
    assert.equal(
      source.includes('desktopDropdownItem: true')
        || source.includes("btn.dataset.desktopDropdownItem = 'true'")
        || source.includes('createDesktopDropdownCommandHit(')
        || source.includes('applyDesktopDropdownCommandDataset('),
      true,
      `${editorId} should mark desktop dropdown rows`
    );
    assert.equal(
      source.includes('id: item.id')
        || source.includes('btn.dataset.actionId = action.id')
        || source.includes('createDesktopDropdownCommandHit(')
        || source.includes('applyDesktopDropdownCommandDataset('),
      true,
      `${editorId} should preserve dropdown command ids`
    );
    assert.equal(
      source.includes('action')
        || source.includes('btn.dataset.sourceId = action.sourceId || action.id')
        || source.includes('createDesktopDropdownCommandHit('),
      true,
      `${editorId} should expose dropdown command actions`
    );
  });
});

test('shared desktop dropdown command hit helper normalizes command metadata', () => {
  let fired = 0;
  const action = () => { fired += 1; };
  const hit = createDesktopDropdownCommandHit({
    id: 'copy',
    editActionRole: 'clipboard',
    desktopActionRole: 'clipboard',
    editActionRoleGroupIndex: 2,
    startsEditActionRoleGroup: true,
    sourceRootId: 'edit',
    commandSurface: DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface,
    pointerType: DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType,
    rowActivation: DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation
  }, { x: 10, y: 20, w: 90, h: 30 }, action);

  assert.equal(hit.id, 'copy');
  assert.deepEqual(hit.bounds, { x: 10, y: 20, w: 90, h: 30, id: 'copy' });
  assert.equal(hit.desktopDropdownItem, DESKTOP_DROPDOWN_COMMAND_CONTRACT.desktopDropdownItem);
  assert.equal(hit.kind, DESKTOP_DROPDOWN_COMMAND_CONTRACT.kind);
  assert.equal(hit.editActionRole, 'clipboard');
  assert.equal(hit.desktopActionRole, 'clipboard');
  assert.equal(hit.editActionRoleGroupIndex, 2);
  assert.equal(hit.startsEditActionRoleGroup, true);
  assert.equal(hit.sourceRootId, 'edit');
  assert.equal(hit.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface);
  assert.equal(hit.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType);
  assert.equal(hit.rowActivation, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation);
  assert.equal(hit.action, action);
  assert.equal(hit.onClick, action);
  hit.action();
  assert.equal(fired, 1);
});

test('compatible canvas editors use the shared desktop dropdown command hit helper', () => {
  Object.keys(canvasEditorDesktopDropdownSources).forEach((editorId) => {
    assert.equal(
      canvasEditorDesktopDropdownSources[editorId].includes('createDesktopDropdownCommandHit('),
      true,
      `${editorId} should use the shared dropdown hit helper`
    );
  });
});

test('canvas desktop dropdown hit paths preserve shared Edit role metadata through the helper', () => {
  ['pixel', 'level'].forEach((editorId) => {
    const source = canvasEditorDesktopDropdownSources[editorId];
    assert.equal(source.includes('createDesktopDropdownCommandHit('), true, `${editorId}:helper`);
  });
  assert.equal(canvasEditorDesktopDropdownSources.pixel.includes('sourceRootId: shell.dropdown.rootId || null'), true);
  assert.equal(canvasEditorDesktopDropdownSources.level.includes('sourceRootId: dropdownRootId || null'), true);
});

test('Actor desktop DOM dropdown rows expose shared dataset command metadata', () => {
  assert.equal(actorEditorSource.includes('btn.dataset.actionId = action.id'), true);
  assert.equal(actorEditorSource.includes('btn.dataset.sourceId = action.sourceId || action.id'), true);
  assert.equal(actorEditorSource.includes('applyDesktopDropdownCommandDataset(btn, action, {'), true);
  assert.equal(actorEditorSource.includes('commandSurface: this.activeSpecModeContract?.commandSurface'), true);
  assert.equal(actorEditorSource.includes('pointerType: this.activeSpecModeContract?.pointerType'), true);
  assert.equal(actorEditorSource.includes('rowActivation: this.activeSpecModeContract?.rowActivation'), true);
  assert.equal(actorEditorSource.includes("action.startsEditActionRoleGroup ? ' role-group-start' : ''"), true);
});

test('shared desktop dropdown dataset helper normalizes DOM command metadata', () => {
  const element = { dataset: {} };
  const metadata = applyDesktopDropdownCommandDataset(element, {
    id: 'copy-state',
    editActionRole: 'clipboard',
    desktopActionRole: 'clipboard',
    editActionRoleGroupIndex: 1,
    startsEditActionRoleGroup: true
  }, {
    sourceRootId: 'edit'
  });
  assert.equal(metadata.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface);
  assert.equal(element.dataset.desktopDropdownItem, 'true');
  assert.equal(element.dataset.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface);
  assert.equal(element.dataset.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType);
  assert.equal(element.dataset.rowActivation, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation);
  assert.equal(element.dataset.sourceRootId, 'edit');
  assert.equal(element.dataset.editActionRole, 'clipboard');
  assert.equal(element.dataset.desktopActionRole, 'clipboard');
  assert.equal(element.dataset.startsEditActionRoleGroup, 'true');
  assert.equal(element.dataset.editActionRoleGroupIndex, '1');
});

test('shared desktop root menu hit helper normalizes top menu root metadata', () => {
  let fired = 0;
  const action = () => { fired += 1; };
  const hit = createDesktopRootMenuHit({
    id: 'settings',
    bounds: { x: 4, y: 0, w: 72, h: 40 }
  }, action, { kind: 'button' });

  assert.equal(hit.id, 'settings');
  assert.deepEqual(hit.bounds, { x: 4, y: 0, w: 72, h: 40, id: 'settings' });
  assert.equal(hit.desktopRootId, 'settings');
  assert.equal(hit.rootId, 'settings');
  assert.equal(hit.kind, 'button');
  assert.equal(hit.commandSurface, EDITOR_SURFACES.topMenu);
  assert.equal(hit.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType);
  assert.equal(hit.rowActivation, 'press');
  hit.onClick();
  assert.equal(fired, 1);

  const prefixed = createDesktopRootMenuHit({ id: 'add', bounds: { x: 0, y: 0, w: 80, h: 40 } }, null, {
    idPrefix: 'desktop-root:'
  });
  assert.equal(prefixed.id, 'desktop-root:add');
  assert.equal(prefixed.bounds.id, 'desktop-root:add');
  assert.equal(prefixed.desktopRootId, 'add');
  assert.equal(prefixed.rootId, 'add');
});

test('shared desktop root menu dataset helper normalizes DOM root metadata', () => {
  const element = { dataset: {} };
  const metadata = applyDesktopRootMenuDataset(element, {
    id: 'collision',
    bounds: { x: 0, y: 0, w: 96, h: 40 }
  });
  assert.equal(metadata.rootId, 'collision');
  assert.equal(metadata.desktopRootId, 'collision');
  assert.equal(element.dataset.rootId, 'collision');
  assert.equal(element.dataset.desktopRootId, 'collision');
  assert.equal(element.dataset.commandSurface, EDITOR_SURFACES.topMenu);
  assert.equal(element.dataset.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType);
  assert.equal(element.dataset.rowActivation, 'press');
  assert.equal(element.dataset.kind, 'desktop-root-menu-item');
});

test('canvas desktop top menu root hit paths use the shared helper', () => {
  Object.keys(canvasEditorDesktopDropdownSources).forEach((editorId) => {
    const source = canvasEditorDesktopDropdownSources[editorId];
    assert.equal(source.includes('createDesktopRootMenuHit('), true, `${editorId}:root-helper`);
  });
  assert.equal(canvasEditorDesktopDropdownSources.pixel.includes('hoverRootId: button.id'), true);
  assert.equal(canvasEditorDesktopDropdownSources.level.includes('const rootHit = createDesktopRootMenuHit(entry, def.action);'), true);
  assert.equal(canvasEditorDesktopDropdownSources.midi.includes('const bounds = createDesktopRootMenuHit(button, null);'), true);
  assert.equal(canvasEditorDesktopDropdownSources.cutscene.includes("createDesktopRootMenuHit(button, null, { idPrefix: 'desktop-root:' })"), true);
  assert.equal(canvasEditorDesktopDropdownSources.pixel.includes('this.uiButtons.push({ bounds, onClick, hoverRootId: button.id });'), false);
  assert.equal(canvasEditorDesktopDropdownSources.level.includes("this.addUIButton(entry.bounds, def.action, '', { desktopRootId: entry.id });"), false);
  assert.equal(canvasEditorDesktopDropdownSources.midi.includes('bounds.desktopRootId = button.id;'), false);
  assert.equal(canvasEditorDesktopDropdownSources.sfx.includes("this.buttons.push({ ...button.bounds, kind: 'button', action: () => this.invokeWithHistory(action), desktopRootId: button.id });"), false);
  assert.equal(canvasEditorDesktopDropdownSources.cutscene.includes('const bounds = { ...button.bounds };\n      this.bounds.buttons.push(bounds);'), false);
});

test('Actor desktop DOM top menu roots expose shared root metadata', () => {
  assert.equal(actorEditorSource.includes('applyDesktopRootMenuDataset(btn, entry);'), true);
  assert.equal(actorEditorSource.includes('btn.dataset.rootId = entry.id;'), false);
});

test('main editor renderer entry points retain the shared viewport mode contract', () => {
  for (const [editorId, source] of Object.entries(editorDesktopDropdownSources)) {
    assert.equal(
      source.includes('this.activeModeContract = viewportMode.modeContract;'),
      true,
      `${editorId} renderer should retain viewportMode.modeContract before mode-specific branches`
    );
    assert.equal(
      source.includes('this.activeSpecModeContract = viewportMode.specModeContract;'),
      true,
      `${editorId} renderer should retain viewportMode.specModeContract before mode-specific branches`
    );
  }
  assert.equal(
    actorEditorSource.includes('this.collisionModeContract = collisionViewportMode.modeContract;'),
    true,
    'actor collision panel should retain its separate collision mode contract'
  );
  assert.equal(
    canvasEditorDesktopDropdownSources.race.includes('this.activeShellModeContract = shell.modeContract;'),
    true,
    'race/car specialized shell renderers should retain helper mode contracts'
  );
  assert.equal(
    canvasEditorDesktopDropdownSources.race.includes('this.activeGamepadMenuModeContract = menuPlan.modeContract;'),
    true,
    'race/car gamepad slide-out renderer should retain the gamepad menu mode contract'
  );
  assert.equal(
    editorUiContractSource.includes('must retain `viewportMode.modeContract`'),
    true,
    'lower-level UI contract should document renderer contract retention'
  );
  assert.equal(
    editorUiContractSource.includes('must retain both `viewportMode.modeContract` and `viewportMode.specModeContract`'),
    true,
    'lower-level UI contract should document renderer/spec contract retention'
  );
});

test('viewport mode flags expose shared desktop, touch, and gamepad layout booleans', () => {
  assert.deepEqual(resolveEditorViewportModeFlags({
    isMobile: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    gamepadConnected: true
  }), {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    modeContract: getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP),
    specModeContract: getEditorMenuModeContract(null, EDITOR_LAYOUT_MODES.DESKTOP),
    isDesktop: true,
    isMobileViewport: false,
    isMobilePortrait: false,
    isMobileLandscape: false,
    isLandscapeTouch: false,
    isGamepadLandscape: false
  });

  assert.deepEqual(resolveEditorViewportModeFlags({
    isMobile: true,
    viewportWidth: 390,
    viewportHeight: 844
  }), {
    mode: EDITOR_LAYOUT_MODES.PORTRAIT,
    modeContract: getEditorModeContract(EDITOR_LAYOUT_MODES.PORTRAIT),
    specModeContract: getEditorMenuModeContract(null, EDITOR_LAYOUT_MODES.PORTRAIT),
    isDesktop: false,
    isMobileViewport: true,
    isMobilePortrait: true,
    isMobileLandscape: false,
    isLandscapeTouch: false,
    isGamepadLandscape: false
  });

  assert.deepEqual(resolveEditorViewportModeFlags({
    isMobile: true,
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true
  }), {
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    modeContract: getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD),
    specModeContract: getEditorMenuModeContract(null, EDITOR_LAYOUT_MODES.GAMEPAD),
    isDesktop: false,
    isMobileViewport: true,
    isMobilePortrait: false,
    isMobileLandscape: true,
    isLandscapeTouch: false,
    isGamepadLandscape: true
  });
});

test('gamepad landscape helpers gate slide-out menus to mobile landscape controller mode', () => {
  assert.equal(isGamepadLandscapeEditorMode({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    isMobile: true
  }), true);
  assert.equal(isGamepadLandscapeEditorMode({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true
  }), false);
  assert.equal(isGamepadLandscapeEditorMode({
    viewportWidth: 390,
    viewportHeight: 844,
    gamepadConnected: true,
    isMobile: true
  }), false);
  assert.equal(isGamepadLandscapeEditorMode({
    viewportWidth: 1280,
    viewportHeight: 800,
    gamepadConnected: true,
    isMobile: false
  }), false);
  assert.equal(shouldUseGamepadSlideOutMenu({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    isMobile: true,
    menuActive: true,
    activeMenuId: 'tools'
  }), true);
  assert.equal(shouldUseGamepadSlideOutMenu({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    menuActive: true,
    activeMenuId: 'tools'
  }), false);
  assert.equal(shouldUseGamepadSlideOutMenu({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    isMobile: true,
    menuActive: false,
    activeMenuId: 'tools'
  }), false);

  assert.deepEqual(resolveGamepadMenuState({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    isMobile: true,
    menuActive: true,
    activeMenuId: 'tools'
  }), {
    isLandscapeMenuMode: true,
    activeSubmenuId: 'tools',
    drawSlideOut: true,
    drawControllerOverlay: false
  });
  assert.deepEqual(resolveGamepadMenuState({
    viewportWidth: 844,
    viewportHeight: 390,
    gamepadConnected: true,
    isMobile: true,
    menuActive: true,
    activeMenuId: 'system'
  }), {
    isLandscapeMenuMode: true,
    activeSubmenuId: null,
    drawSlideOut: false,
    drawControllerOverlay: true
  });
});

test('layout placements match the RTG Studio editor UI contract', () => {
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.PORTRAIT), {
    root: EDITOR_SURFACES.bottomRail,
    submenu: EDITOR_SURFACES.bottomSheet,
    settings: EDITOR_SURFACES.bottomSheet
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH), {
    root: EDITOR_SURFACES.leftRail,
    submenu: EDITOR_SURFACES.rightDrawer,
    settings: EDITOR_SURFACES.rightDrawer
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.DESKTOP), {
    root: EDITOR_SURFACES.topMenu,
    submenu: 'dropdown',
    settings: 'dropdown'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.GAMEPAD), {
    root: EDITOR_SURFACES.leftSlideRail,
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer'
  });
});

test('editor menu layout plan exposes mode-specific behavior flags', () => {
  const desktop = buildEditorMenuLayoutPlan('pixel', { isMobile: false, viewportWidth: 1280, viewportHeight: 800 });
  assert.equal(desktop.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.deepEqual(desktop.modeSurfaces, {
    rootMenu: EDITOR_SURFACES.topMenu,
    compactCommandRail: null,
    rootDrawer: null,
    submenu: EDITOR_SURFACES.topDropdown,
    settings: EDITOR_SURFACES.topDropdown,
    primaryActions: null,
    gestureScroll: false,
    rootDrawerKeepsSubmenuVisible: false
  });
  assert.equal(desktop.desktop.usesTopMenu, true);
  assert.equal(desktop.desktop.showPersistentLeftOptions, true);
  assert.equal(desktop.desktop.commandSurface, DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface);
  assert.equal(desktop.desktop.leftPanelRole, DESKTOP_SHELL_SURFACE_CONTRACT.leftPanelRole);
  assert.equal(desktop.desktop.duplicatesCommandsInLeftPanel, DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel);
  assert.deepEqual(desktop.desktop.leftContextPanelContract, DESKTOP_CONTEXT_PANEL_CONTRACT);
  assert.deepEqual(desktop.surfaceRoles, {
    commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
    persistentContextSurface: DESKTOP_CONTEXT_PANEL_CONTRACT.surface,
    persistentNavigationSurface: EDITOR_SURFACES.topMenu,
    duplicatesCommandsInPersistentContext: DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel,
    desktopMobileRailsHidden: DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden,
    persistentNavigationActionLimit: null,
    persistentContextContract: DESKTOP_CONTEXT_PANEL_CONTRACT
  });
  assert.equal(desktop.touch.usesBottomMenus, false);
  assert.ok(desktop.rootIds.includes('layers'));

  const gamepad = buildEditorMenuLayoutPlan('level', { isMobile: true, viewportWidth: 844, viewportHeight: 390, gamepadConnected: true });
  assert.equal(gamepad.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.deepEqual(gamepad.modeSurfaces, {
    rootMenu: EDITOR_SURFACES.leftSlideRail,
    compactCommandRail: null,
    rootDrawer: null,
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer',
    primaryActions: null,
    gestureScroll: true,
    rootDrawerKeepsSubmenuVisible: false
  });
  assert.equal(gamepad.desktop.commandSurface, null);
  assert.equal(gamepad.desktop.leftPanelRole, null);
  assert.equal(gamepad.desktop.leftContextPanelContract, null);
  assert.equal(gamepad.gamepad.rootCollapsesAfterSelect, true);
  assert.equal(gamepad.gamepad.rootSurface, EDITOR_SURFACES.leftSlideRail);
  assert.equal(gamepad.gamepad.submenuSurface, EDITOR_SURFACES.leftSlideOutDrawer);
  assert.equal(gamepad.gamepad.submenuReplacesRoot, true);
  assert.equal(gamepad.gamepad.confirm, 'A');
  assert.equal(gamepad.gamepad.back, 'B');
  assert.equal(gamepad.touch.usesSideRails, false);
  assert.deepEqual(gamepad.surfaceRoles, {
    commandSurface: EDITOR_SURFACES.leftSlideOutDrawer,
    persistentContextSurface: EDITOR_SURFACES.workSurfaceOverlay,
    persistentNavigationSurface: EDITOR_SURFACES.leftSlideRail,
    duplicatesCommandsInPersistentContext: false,
    desktopMobileRailsHidden: false,
    persistentNavigationActionLimit: null
  });

  const desktopWithController = buildEditorMenuLayoutPlan('level', { isMobile: false, viewportWidth: 1280, viewportHeight: 800, gamepadConnected: true });
  assert.equal(desktopWithController.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(desktopWithController.desktop.usesTopMenu, true);
  assert.equal(desktopWithController.gamepad.rootCollapsesAfterSelect, false);
});

test('landscape menu layout plan separates left root drawers from right submenus', () => {
  const landscape = buildEditorMenuLayoutPlan('pixel', {
    isMobile: true,
    viewportWidth: 844,
    viewportHeight: 390
  });

  assert.equal(landscape.mode, EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  assert.equal(landscape.modeSurfaces.rootMenu, EDITOR_SURFACES.leftRail);
  assert.equal(landscape.modeSurfaces.compactCommandRail, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface);
  assert.equal(landscape.modeSurfaces.rootDrawer, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface);
  assert.equal(landscape.modeSurfaces.submenu, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.submenuSurface);
  assert.equal(landscape.modeSurfaces.rootDrawerKeepsSubmenuVisible, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerKeepsSubmenuVisible);
  assert.equal(landscape.surfaceRoles.commandSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.commandSurface);
  assert.equal(landscape.surfaceRoles.persistentNavigationActionLimit, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.actionLimit);
  assert.equal(uiSpecSource.includes('modeSurfaces.rootDrawerKeepsSubmenuVisible: true'), true);
  assert.equal(editorUiContractSource.includes('modeSurfaces.rootDrawerKeepsSubmenuVisible'), true);
});

test('portrait menu layout plan keeps roots and submenus bottom-first across every editor', () => {
  assert.deepEqual(drawSharedPortraitSheet(null, { x: 0, y: 0, w: 390, h: 280 }), {
    surface: EDITOR_SURFACES.bottomSheet,
    role: 'portrait-command-sheet',
    commandSurface: EDITOR_SURFACES.bottomSheet,
    pointerType: 'touch',
    rowActivation: 'tap-release',
    gestureScroll: true
  });
  for (const editorId of ALL_EDITOR_IDS) {
    const plan = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 390,
      viewportHeight: 844
    });

    assert.equal(plan.mode, EDITOR_LAYOUT_MODES.PORTRAIT);
    assert.equal(plan.modeSurfaces.rootMenu, EDITOR_SURFACES.bottomRail);
    assert.equal(plan.modeSurfaces.submenu, EDITOR_SURFACES.bottomSheet);
    assert.equal(plan.modeSurfaces.primaryActions, EDITOR_SURFACES.bottomActionRail);
    assert.equal(plan.modeSurfaces.gestureScroll, true);
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT]);
    assert.deepEqual(plan.suppressedModeSurfaces, [
      EDITOR_SURFACES.desktopTopMenu,
      EDITOR_SURFACES.desktopDropdown,
      EDITOR_SURFACES.desktopLeftInspector,
      EDITOR_SURFACES.landscapeRootDrawer,
      EDITOR_SURFACES.landscapeRightSubmenu,
      EDITOR_SURFACES.gamepadSlideOut
    ]);
    assert.deepEqual(plan.surfaceRoles, {
      commandSurface: EDITOR_SURFACES.bottomSheet,
      persistentContextSurface: EDITOR_SURFACES.bottomSheet,
      persistentNavigationSurface: EDITOR_SURFACES.bottomRail,
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: null
    });
    assert.deepEqual(plan.presentation, {
      rootSurface: EDITOR_SURFACES.bottomRail,
      commandSurface: EDITOR_SURFACES.bottomSheet,
      submenuSurface: EDITOR_SURFACES.bottomSheet,
      persistentContextSurface: EDITOR_SURFACES.bottomSheet,
      persistentNavigationSurface: EDITOR_SURFACES.bottomRail,
      rootDrawerSurface: null,
      rootDrawerOverlayOrigin: null,
      rootDrawerKeepsSubmenuVisible: false,
      submenuReplacesRootRail: false,
      rightSubmenuSurface: null
    });
    assert.deepEqual(plan.interaction, {
      pointerType: 'touch',
      rowActivation: 'tap-release',
      gestureScroll: true,
      wheelRoutesToHoveredPanel: false,
      pinchZoomReservedForWorkSurface: true,
      confirm: null,
      back: null,
      siblingPrev: null,
      siblingNext: null
    });
    assert.deepEqual(plan.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.PORTRAIT]);
    assert.deepEqual(plan.interaction, MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.PORTRAIT]);
    assert.deepEqual(plan.modeContract, getEditorModeContract(plan.mode));
    assert.deepEqual(plan.specModeContract, getEditorMenuModeContract(editorId, plan.mode));
    assert.equal(plan.touch.usesBottomMenus, true);
    assert.equal(plan.touch.usesSideRails, false);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.bottomRail), true, `${editorId} portrait should render the bottom root rail`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.bottomSheet), true, `${editorId} portrait should render bottom command sheets`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.bottomActionRail), true, `${editorId} portrait should render the bottom action rail`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.touchThumbstick), true, `${editorId} portrait should keep the virtual thumbstick available`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.desktopTopMenu), false, `${editorId} portrait should suppress desktop top menu`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.desktopDropdown), false, `${editorId} portrait should suppress desktop dropdowns`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.landscapeRootDrawer), false, `${editorId} portrait should suppress landscape root drawers`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.landscapeRightSubmenu), false, `${editorId} portrait should suppress landscape right drill-downs`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.gamepadSlideOut), false, `${editorId} portrait should suppress gamepad slide-out chrome`);
  }
  assert.equal(uiSpecSource.includes(`Portrait root rails expose no more than ${PORTRAIT_ROOT_MAX_ITEMS} bottom menu items`), true);
  assert.equal(editorUiContractSource.includes('Shared portrait mode plans expose `suppressedModeSurfaces`'), true);
  assert.equal(editorUiContractSource.includes('Shared portrait root menus must stay within `PORTRAIT_ROOT_MAX_ITEMS` bottom items'), true);
  assert.equal(editorUiContractSource.includes('Shared generic mode plans expose `suppressedModeSurfaces` in every mode'), true);
  assert.equal(editorUiContractSource.includes('Shared generic mode plans expose `requiredModeSurfaces` in every mode'), true);
  assert.equal(editorUiContractSource.includes('Desktop context/inspector slot and landscape compact command rail host; portrait navigation remains bottom-first'), true);
  assert.equal(editorUiContractSource.includes('Shared vertical navigation slot on mobile and shared context/inspector slot on desktop.'), false);
  assert.equal(editorUiContractSource.includes('a surface cannot be both required and suppressed in the same mode.'), true);
  assert.equal(editorUiContractSource.includes('Shared presentation/interaction mode contracts must validate for every mode'), true);
  assert.equal(editorUiContractSource.includes('`getEditorModeContract()` is the combined renderer-facing contract'), true);
  assert.equal(editorUiContractSource.includes('Specialized desktop, landscape, and gamepad shell helpers must expose the same generic `requiredModeSurfaces` and `suppressedModeSurfaces`'), true);
  assert.equal(editorUiContractSource.includes('so portrait stays bottom-first and does not inherit desktop, landscape, or controller chrome.'), true);
});

test('landscape, desktop, and gamepad menu layout plans expose distinct mode surfaces', () => {
  assert.deepEqual(validateEditorModeSurfaceContracts(), []);
  assert.deepEqual(validateEditorModePresentationInteractionContracts(), []);
  assert.deepEqual(validateEditorWorkSurfaceTypes(), []);
  assert.deepEqual(getEditorModeSurfaceContract('unknown-mode'), {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    requiredModeSurfaces: REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP],
    suppressedModeSurfaces: SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP],
    surfaceVisibility: getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP)
  });
  assert.deepEqual(getEditorModePresentationInteractionContract('unknown-mode'), {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    presentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP],
    interaction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]
  });
  assert.deepEqual(getEditorModeContract('unknown-mode'), {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    requiredModeSurfaces: REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP],
    suppressedModeSurfaces: SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP],
    surfaceVisibility: getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP),
    presentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP],
    interaction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP],
    acceptance: getEditorModeAcceptanceContract(EDITOR_LAYOUT_MODES.DESKTOP)
  });
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT], [
    EDITOR_SURFACES.bottomRail,
    EDITOR_SURFACES.bottomSheet,
    EDITOR_SURFACES.bottomActionRail
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP], [
    EDITOR_SURFACES.topMenu,
    EDITOR_SURFACES.topDropdown,
    EDITOR_SURFACES.leftRibbon,
    EDITOR_SURFACES.leftContextPanel,
    EDITOR_SURFACES.workSurface
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH], [
    EDITOR_SURFACES.leftRail,
    EDITOR_SURFACES.leftOverlayDrawer,
    EDITOR_SURFACES.rightDrawer,
    EDITOR_SURFACES.bottomRail
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD], [
    EDITOR_SURFACES.leftSlideRail,
    EDITOR_SURFACES.leftSlideOutDrawer,
    EDITOR_SURFACES.workSurfaceOverlay
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT], [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.gamepadSlideOut
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP], [
    EDITOR_SURFACES.bottomActionRail,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.gamepadHintBar,
    EDITOR_SURFACES.gamepadSlideOut
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH], [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.gamepadSlideOut
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD], [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.rightDrawer,
    EDITOR_SURFACES.rightOverlayDrawer,
    EDITOR_SURFACES.leftOverlayDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick
  ]);

  for (const editorId of ALL_EDITOR_IDS) {
    const landscape = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 844,
      viewportHeight: 390
    });
    const desktop = buildEditorMenuLayoutPlan(editorId, {
      isMobile: false,
      viewportWidth: 1280,
      viewportHeight: 800
    });
    const gamepad = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 844,
      viewportHeight: 390,
      gamepadConnected: true
    });

    assert.deepEqual(landscape.modeSurfaces, {
      rootMenu: EDITOR_SURFACES.leftRail,
      compactCommandRail: EDITOR_SURFACES.leftRail,
      rootDrawer: EDITOR_SURFACES.leftOverlayDrawer,
      submenu: EDITOR_SURFACES.rightDrawer,
      settings: EDITOR_SURFACES.rightDrawer,
      primaryActions: null,
      gestureScroll: true,
      rootDrawerKeepsSubmenuVisible: true
    });
    assert.deepEqual(landscape.surfaceRoles, {
      commandSurface: EDITOR_SURFACES.rightDrawer,
      persistentContextSurface: EDITOR_SURFACES.bottomRail,
      persistentNavigationSurface: EDITOR_SURFACES.leftRail,
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT
    });
    assert.deepEqual(landscape.presentation, {
      rootSurface: EDITOR_SURFACES.leftRail,
      commandSurface: EDITOR_SURFACES.rightDrawer,
      submenuSurface: EDITOR_SURFACES.rightDrawer,
      persistentContextSurface: EDITOR_SURFACES.bottomRail,
      persistentNavigationSurface: EDITOR_SURFACES.leftRail,
      rootDrawerSurface: EDITOR_SURFACES.leftOverlayDrawer,
      rootDrawerOverlayOrigin: 'left',
      rootDrawerKeepsSubmenuVisible: true,
      submenuReplacesRootRail: false,
      rightSubmenuSurface: EDITOR_SURFACES.rightDrawer
    });
    assert.deepEqual(landscape.interaction, {
      pointerType: 'touch',
      rowActivation: 'tap-release',
      gestureScroll: true,
      wheelRoutesToHoveredPanel: false,
      pinchZoomReservedForWorkSurface: true,
      confirm: null,
      back: null,
      siblingPrev: null,
      siblingNext: null
    });
    assert.deepEqual(landscape.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(landscape.interaction, MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(landscape.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(landscape.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(landscape.modeContract, getEditorModeContract(landscape.mode));
    assert.deepEqual(landscape.specModeContract, getEditorMenuModeContract('pixel', landscape.mode));
    assert.deepEqual(getEditorModeSurfaceContract(landscape.mode), {
      mode: landscape.mode,
      requiredModeSurfaces: landscape.requiredModeSurfaces,
      suppressedModeSurfaces: landscape.suppressedModeSurfaces,
      surfaceVisibility: landscape.surfaceVisibility
    });
    assert.equal(landscape.surfaceVisibility[EDITOR_SURFACES.leftRail], 'required');
    assert.equal(landscape.surfaceVisibility[EDITOR_SURFACES.desktopTopMenu], 'suppressed');
    assert.deepEqual(desktop.modeSurfaces, {
      rootMenu: EDITOR_SURFACES.topMenu,
      compactCommandRail: null,
      rootDrawer: null,
      submenu: EDITOR_SURFACES.topDropdown,
      settings: EDITOR_SURFACES.topDropdown,
      primaryActions: null,
      gestureScroll: false,
      rootDrawerKeepsSubmenuVisible: false
    });
    assert.deepEqual(desktop.surfaceRoles, {
      commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
    persistentContextSurface: DESKTOP_CONTEXT_PANEL_CONTRACT.surface,
    persistentNavigationSurface: EDITOR_SURFACES.topMenu,
    duplicatesCommandsInPersistentContext: DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel,
    desktopMobileRailsHidden: DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden,
    persistentNavigationActionLimit: null,
    persistentContextContract: DESKTOP_CONTEXT_PANEL_CONTRACT
  });
    assert.deepEqual(desktop.presentation, {
      rootSurface: EDITOR_SURFACES.topMenu,
      commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
      submenuSurface: EDITOR_SURFACES.topDropdown,
      persistentContextSurface: DESKTOP_CONTEXT_PANEL_CONTRACT.surface,
      persistentNavigationSurface: EDITOR_SURFACES.topMenu,
      rootDrawerSurface: null,
      rootDrawerOverlayOrigin: null,
      rootDrawerKeepsSubmenuVisible: false,
      submenuReplacesRootRail: false,
      rightSubmenuSurface: null
    });
    assert.deepEqual(desktop.interaction, {
      pointerType: 'mouse',
      rowActivation: 'release',
      gestureScroll: false,
      wheelRoutesToHoveredPanel: true,
      pinchZoomReservedForWorkSurface: true,
      confirm: null,
      back: null,
      siblingPrev: null,
      siblingNext: null
    });
    assert.deepEqual(desktop.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(desktop.interaction, MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(desktop.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(desktop.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(desktop.modeContract, getEditorModeContract(desktop.mode));
    assert.deepEqual(desktop.specModeContract, getEditorMenuModeContract('pixel', desktop.mode));
    assert.deepEqual(getEditorModeSurfaceContract(desktop.mode), {
      mode: desktop.mode,
      requiredModeSurfaces: desktop.requiredModeSurfaces,
      suppressedModeSurfaces: desktop.suppressedModeSurfaces,
      surfaceVisibility: desktop.surfaceVisibility
    });
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.topMenu], 'required');
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.topDropdown], 'required');
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.bottomActionRail], 'suppressed');
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.bottomToolRail], 'suppressed');
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.touchThumbstick], 'suppressed');
    assert.equal(desktop.surfaceVisibility[EDITOR_SURFACES.gamepadHintBar], 'suppressed');
    assert.deepEqual(gamepad.modeSurfaces, {
      rootMenu: EDITOR_SURFACES.leftSlideRail,
      compactCommandRail: null,
      rootDrawer: null,
      submenu: 'slide-out-drawer',
      settings: 'slide-out-drawer',
      primaryActions: null,
      gestureScroll: true,
      rootDrawerKeepsSubmenuVisible: false
    });
    assert.deepEqual(gamepad.surfaceRoles, {
      commandSurface: EDITOR_SURFACES.leftSlideOutDrawer,
      persistentContextSurface: EDITOR_SURFACES.workSurfaceOverlay,
      persistentNavigationSurface: EDITOR_SURFACES.leftSlideRail,
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: null
    });
    assert.deepEqual(gamepad.presentation, {
      rootSurface: EDITOR_SURFACES.leftSlideRail,
      commandSurface: EDITOR_SURFACES.leftSlideOutDrawer,
      submenuSurface: EDITOR_SURFACES.leftSlideOutDrawer,
      persistentContextSurface: EDITOR_SURFACES.workSurfaceOverlay,
      persistentNavigationSurface: EDITOR_SURFACES.leftSlideRail,
      rootDrawerSurface: null,
      rootDrawerOverlayOrigin: null,
      rootDrawerKeepsSubmenuVisible: false,
      submenuReplacesRootRail: true,
      rightSubmenuSurface: null
    });
    assert.deepEqual(gamepad.interaction, {
      pointerType: 'controller',
      rowActivation: 'confirm-button',
      gestureScroll: true,
      wheelRoutesToHoveredPanel: false,
      pinchZoomReservedForWorkSurface: true,
      confirm: 'A',
      back: 'B',
      siblingPrev: 'LB',
      siblingNext: 'RB'
    });
    assert.deepEqual(gamepad.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(gamepad.interaction, MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(gamepad.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(gamepad.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(gamepad.modeContract, getEditorModeContract(gamepad.mode));
    assert.deepEqual(gamepad.specModeContract, getEditorMenuModeContract('pixel', gamepad.mode));
    assert.deepEqual(getEditorModeSurfaceContract(gamepad.mode), {
      mode: gamepad.mode,
      requiredModeSurfaces: gamepad.requiredModeSurfaces,
      suppressedModeSurfaces: gamepad.suppressedModeSurfaces,
      surfaceVisibility: gamepad.surfaceVisibility
    });
    assert.equal(gamepad.surfaceVisibility[EDITOR_SURFACES.leftSlideOutDrawer], 'required');
    assert.equal(gamepad.surfaceVisibility[EDITOR_SURFACES.landscapeRightSubmenu], 'suppressed');
    assert.equal(gamepad.gamepad.rootSurface, EDITOR_SURFACES.leftSlideRail);
    assert.equal(gamepad.gamepad.submenuSurface, EDITOR_SURFACES.leftSlideOutDrawer);
    assert.equal(gamepad.gamepad.submenuReplacesRoot, true);
  }
});

test('shared surface render helper blocks suppressed chrome by mode', () => {
  assert.equal(getEditorSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.bottomActionRail), 'suppressed');
  assert.equal(getEditorSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.leftContextPanel), 'required');
  assert.equal(getEditorSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.workSurface), 'required');
  assert.equal(getEditorSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP, 'editor-owned-status'), 'optional');
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.bottomActionRail), false);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.bottomToolRail), false);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.touchThumbstick), false);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.DESKTOP, EDITOR_SURFACES.topMenu), true);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.PORTRAIT, EDITOR_SURFACES.desktopTopMenu), false);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.PORTRAIT, EDITOR_SURFACES.bottomSheet), true);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH, EDITOR_SURFACES.bottomRail), true);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.GAMEPAD, EDITOR_SURFACES.landscapeRightSubmenu), false);
  assert.equal(canRenderEditorSurface(EDITOR_LAYOUT_MODES.GAMEPAD, EDITOR_SURFACES.leftSlideOutDrawer), true);
});

test('shared plan surface render helper prefers effective shell visibility', () => {
  const landscape = buildLandscapeTouchEditorShellPlan('sfx', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 72,
    reserveRightRail: false
  });

  assert.equal(getEditorSurfaceVisibility(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH, EDITOR_SURFACES.rightDrawer), 'required');
  assert.equal(getEditorPlanSurfaceVisibility(landscape, EDITOR_SURFACES.rightDrawer), 'suppressed');
  assert.equal(canRenderEditorPlanSurface(landscape, EDITOR_SURFACES.rightDrawer), false);
  assert.equal(canRenderEditorPlanSurface(landscape, EDITOR_SURFACES.bottomToolRail), true);
  assert.equal(canRenderEditorPlanSurface(landscape, EDITOR_SURFACES.leftOverlayDrawer), true);
  assert.equal(canRenderEditorPlanSurface(null, 'unknown-surface'), true);
});

test('menu scroll policy always reserves pinch zoom for work surfaces', () => {
  const touch = getMenuScrollPolicy({ pointerType: 'touch', mode: EDITOR_LAYOUT_MODES.PORTRAIT });
  assert.equal(touch.enabled, true);
  assert.equal(touch.thresholdPx, 8);
  assert.equal(touch.suppressClickAfterDrag, true);
  assert.equal(touch.pinchZoomReservedForWorkSurface, true);
  assert.equal(touch.wheelRoutesToHoveredPanel, false);

  const desktop = getMenuScrollPolicy({ pointerType: 'mouse', mode: EDITOR_LAYOUT_MODES.DESKTOP });
  assert.equal(desktop.wheelRoutesToHoveredPanel, true);
});

test('shared menu scroll drag helper suppresses taps only after threshold movement', () => {
  const regions = [
    { menuId: 'root', bounds: { x: 0, y: 0, w: 80, h: 180 }, maxScroll: 4, lineHeight: 40 },
    { menuId: 'drawer', bounds: { x: 100, y: 0, w: 120, h: 180 }, maxScroll: 0, lineHeight: 40 }
  ];

  assert.equal(findScrollableMenuRegion(regions, { x: 110, y: 20 })?.menuId, 'drawer');
  assert.equal(findScrollableMenuRegion(regions, { x: 20, y: 20 })?.menuId, 'root');

  const drag = buildMenuScrollDragState({
    regions,
    point: { x: 20, y: 20 },
    scrollState: { root: 1 },
    pendingHit: { id: 'file' }
  });
  assert.equal(drag.menuId, 'root');
  assert.equal(drag.startScroll, 1);
  assert.equal(drag.pendingHit.id, 'file');

  const tap = resolveMenuScrollDrag(drag, { x: 20, y: 25 });
  assert.equal(tap.moved, false);
  assert.equal(tap.nextScroll, 1);

  const scroll = resolveMenuScrollDrag(drag, { x: 20, y: -70 });
  assert.equal(scroll.moved, true);
  assert.equal(scroll.nextScroll, 3);

  const staticDrag = buildMenuScrollDragState({
    regions,
    point: { x: 110, y: 20 },
    scrollState: { drawer: 0 },
    pendingHit: { id: 'static-row' }
  });
  assert.equal(staticDrag.menuId, 'drawer');
  const staticScroll = resolveMenuScrollDrag(staticDrag, { x: 110, y: -48 });
  assert.equal(staticScroll.moved, true);
  assert.equal(staticScroll.nextScroll, 0);

  const staticCanvasTap = buildMenuScrollDragState({
    regions,
    point: { x: 110, y: 20 },
    scrollState: { drawer: 0 }
  });
  assert.equal(staticCanvasTap, null);
});

test('shared menu scroll drag helper supports continuous pixel scroll panels', () => {
  const drag = buildMenuScrollDragState({
    regions: [{
      menuId: 'panel',
      bounds: { x: 0, y: 0, w: 240, h: 180 },
      maxScroll: 100,
      scrollScale: 0.5
    }],
    point: { x: 20, y: 40 },
    scrollState: { panel: 10 },
    thresholdPx: 6
  });

  assert.equal(drag.menuId, 'panel');
  assert.equal(drag.scrollKey, 'panel');
  assert.equal(drag.scrollScale, 0.5);

  const scrollDown = resolveMenuScrollDrag(drag, { x: 20, y: 0 });
  assert.equal(scrollDown.moved, true);
  assert.equal(scrollDown.nextScroll, 30);

  const scrollUp = resolveMenuScrollDrag(drag, { x: 20, y: 80 });
  assert.equal(scrollUp.moved, true);
  assert.equal(scrollUp.nextScroll, 0);
});

test('shared desktop dropdown wheel helper clamps hovered drawer scrolling', () => {
  const dropdown = {
    rootId: 'file',
    maxScroll: 5,
    panelBounds: { x: 10, y: 40, w: 220, h: 160 }
  };

  assert.deepEqual(resolveDesktopDropdownWheelScroll({
    dropdown,
    payload: { x: 24, y: 80, deltaY: 120 },
    scrollState: { file: 2 }
  }), { rootId: 'file', nextScroll: 3 });

  assert.deepEqual(resolveDesktopDropdownWheelScroll({
    dropdown,
    payload: { x: 24, y: 80, deltaY: -120 },
    scrollState: { file: 0 }
  }), { rootId: 'file', nextScroll: 0 });

  assert.equal(resolveDesktopDropdownWheelScroll({
    dropdown,
    payload: { x: 260, y: 80, deltaY: 120 },
    scrollState: { file: 2 }
  }), null);

  assert.equal(resolveMenuWheelScroll({ currentScroll: 5, maxScroll: 5, deltaY: 120 }), 5);
  assert.equal(resolveMenuWheelScroll({ currentScroll: 0, maxScroll: 0, deltaY: 120 }), null);

  assert.deepEqual(applyDesktopDropdownWheelScrollState({
    dropdown,
    payload: { x: 24, y: 80, deltaY: 120 },
    scrollState: { file: 2, edit: 1 }
  }), {
    rootId: 'file',
    nextScroll: 3,
    scrollState: { file: 3, edit: 1 }
  });
});

test('shared desktop dropdown state clears drawers outside desktop mode', () => {
  const dropdown = { rootId: 'file', panelBounds: { x: 0, y: 40, w: 220, h: 102 } };
  assert.deepEqual(resolveDesktopDropdownState({ isDesktop: true, dropdown }), dropdown);
  assert.deepEqual(resolveDesktopDropdownState({ mode: EDITOR_LAYOUT_MODES.DESKTOP, dropdown }), dropdown);
  assert.deepEqual(
    resolveDesktopDropdownState({
      isDesktop: true,
      dropdown,
      previousDropdown: { rootId: 'file', openedAtMs: 1200 }
    }),
    { ...dropdown, openedAtMs: 1200 }
  );
  assert.deepEqual(
    resolveDesktopDropdownState({
      isDesktop: true,
      dropdown: { rootId: 'edit' },
      previousDropdown: { rootId: 'file', openedAtMs: 1200 }
    }),
    { rootId: 'edit' }
  );
  assert.equal(resolveDesktopDropdownState({ isDesktop: false, dropdown }), null);
  assert.equal(resolveDesktopDropdownState({ mode: EDITOR_LAYOUT_MODES.PORTRAIT, dropdown }), null);
  assert.equal(resolveDesktopDropdownState({ mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH, dropdown }), null);
  assert.equal(resolveDesktopDropdownState({ mode: EDITOR_LAYOUT_MODES.GAMEPAD, dropdown }), null);
});

test('shared desktop dropdown close state records the closed root consistently', () => {
  assert.deepEqual(resolveClosedDesktopDropdownState({
    dropdown: { rootId: 'file' },
    openRootId: 'edit',
    fallbackRootId: 'draw'
  }), {
    closedRootId: 'file',
    openRootId: null,
    dropdown: null
  });
  assert.deepEqual(resolveClosedDesktopDropdownState({
    openRootId: 'edit',
    fallbackRootId: 'draw'
  }), {
    closedRootId: 'edit',
    openRootId: null,
    dropdown: null
  });
  assert.deepEqual(resolveClosedDesktopDropdownState({
    fallbackRootId: 'draw'
  }), {
    closedRootId: 'draw',
    openRootId: null,
    dropdown: null
  });
});

test('shared desktop dropdown open state clears stale closed roots', () => {
  assert.deepEqual(resolveOpenDesktopDropdownState({
    rootId: 'edit',
    currentOpenRootId: 'file',
    closedRootId: 'edit',
    dropdown: { rootId: 'file' },
    nowMs: 2400
  }), {
    closedRootId: null,
    openRootId: 'edit',
    dropdown: { rootId: 'file', openedAtMs: 2400 },
    openedAtMs: 2400
  });
  assert.equal(resolveOpenDesktopDropdownState({
    rootId: null,
    currentOpenRootId: null
  }), null);
  assert.equal(resolveOpenDesktopDropdownState({
    rootId: 'file',
    currentOpenRootId: 'file',
    closedRootId: null,
    skipIfAlreadyOpen: true
  }), null);
  assert.equal(resolveDesktopDropdownMotionProgress({
    dropdown: { rootId: 'file', openedAtMs: 1000 },
    nowMs: 1060,
    durationMs: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs
  }), 0.5);
  assert.equal(resolveDesktopDropdownMotionProgress({
    dropdown: { rootId: 'file', openedAtMs: 1000 },
    nowMs: 2000,
    durationMs: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs
  }), 1);
});

test('shared desktop dropdown pending-hit helper activates only clean release hits', () => {
  const pending = createPendingDesktopDropdownHit(
    { id: 'save', bounds: { x: 10, y: 20, w: 100, h: 32 }, action: () => {} },
    { x: 30, y: 30 }
  );

  assert.equal(pending.id, 'save');
  assert.equal(pending.startX, 30);
  assert.equal(pending.startY, 30);
  assert.equal(pending.moved, false);

  const still = updatePendingDesktopDropdownHit(pending, { x: 34, y: 33 });
  assert.equal(still.moved, false);
  const moved = updatePendingDesktopDropdownHit(pending, { x: 60, y: 60 });
  assert.equal(moved.moved, true);

  assert.deepEqual(resolvePendingDesktopDropdownHit(still, { x: 40, y: 34 }), {
    hit: still,
    releasedInside: true,
    shouldActivate: true
  });
  assert.equal(resolvePendingDesktopDropdownHit(moved, { x: 40, y: 34 }).shouldActivate, false);
  assert.equal(resolvePendingDesktopDropdownHit(still, { x: 240, y: 34 }).shouldActivate, false);
});

test('shared DOM desktop dropdown close helper ignores clicks inside the top menu', () => {
  const dropdown = { rootId: 'file' };
  const insideEvent = {
    target: {
      closest: (selector) => selector === '.desktop-top-menu'
    }
  };
  const outsideEvent = {
    target: {
      closest: () => null
    }
  };

  assert.equal(shouldCloseDesktopDropdownOnDomPointerDown({ dropdown: null, event: outsideEvent, menuSelector: '.desktop-top-menu' }), false);
  assert.equal(shouldCloseDesktopDropdownOnDomPointerDown({ dropdown, event: insideEvent, menuSelector: '.desktop-top-menu' }), false);
  assert.equal(shouldCloseDesktopDropdownOnDomPointerDown({ dropdown, event: outsideEvent, menuSelector: '.desktop-top-menu' }), true);
});

test('desktop dropdown click-away keeps registered interactive regions open', () => {
  const dropdown = {
    rootId: 'file',
    panelBounds: { x: 20, y: 32, w: 120, h: 160 }
  };
  const rootButtons = [{ desktopRootId: 'file', bounds: { x: 20, y: 0, w: 60, h: 32 } }];
  const interactiveRegions = [{ bounds: { x: 142, y: 36, w: 90, h: 48 } }];

  assert.equal(shouldCloseDesktopDropdownOnPointerDown({
    dropdown,
    point: { x: 160, y: 52 },
    rootButtons,
    interactiveRegions,
    rootIdKey: 'desktopRootId'
  }), false);
  assert.equal(shouldCloseDesktopDropdownOnPointerDown({
    dropdown,
    point: { x: 260, y: 52 },
    rootButtons,
    interactiveRegions,
    rootIdKey: 'desktopRootId'
  }), true);
});

test('desktop dropdown click-away accepts raw bounds and every canvas editor passes interactive regions', () => {
  const dropdown = {
    rootId: 'file',
    panelBounds: { x: 20, y: 32, w: 120, h: 160 }
  };
  const rootButtons = [{ desktopRootId: 'file', bounds: { x: 20, y: 0, w: 60, h: 32 } }];

  assert.equal(shouldCloseDesktopDropdownOnPointerDown({
    dropdown,
    point: { x: 160, y: 52 },
    rootButtons,
    interactiveRegions: [{ x: 142, y: 36, w: 90, h: 48 }],
    rootIdKey: 'desktopRootId'
  }), false);

  Object.entries(canvasEditorDesktopDropdownSources).forEach(([editorId, source]) => {
    assert.equal(
      source.includes('shouldCloseDesktopDropdownOnPointerDown({'),
      true,
      `${editorId} should use the shared desktop click-away helper`
    );
    assert.equal(
      source.includes('interactiveRegions:'),
      true,
      `${editorId} should keep dropdown scroll/row regions interactive for click-away`
    );
  });
});

test('shared desktop root menu hit helper resolves custom ids and prefixed ids', () => {
  const buttons = [
    { hoverRootId: 'file', bounds: { x: 0, y: 0, w: 80, h: 40 } },
    { hoverRootId: 'draw', bounds: { x: 80, y: 0, w: 80, h: 40 } }
  ];
  assert.deepEqual(resolveDesktopRootMenuHit({
    buttons,
    point: { x: 12, y: 20 },
    rootIdKey: 'hoverRootId'
  })?.rootId, 'file');

  const prefixed = [
    { id: 'desktop-root:add', x: 0, y: 0, w: 96, h: 40 },
    { id: 'desktop-root:clips', x: 96, y: 0, w: 96, h: 40 }
  ];
  assert.deepEqual(resolveDesktopRootMenuHit({
    buttons: prefixed,
    point: { x: 120, y: 20 },
    idPrefix: 'desktop-root:'
  })?.rootId, 'clips');
  assert.equal(resolveDesktopRootMenuHit({
    buttons: prefixed,
    point: { x: 120, y: 20 },
    idPrefix: 'desktop-root:',
    excludeIds: ['clips']
  }), null);
});

test('shared desktop hover switch only changes already-open drawers', () => {
  const buttons = [
    { id: 'file', bounds: { x: 0, y: 0, w: 80, h: 32 } },
    { id: 'edit', bounds: { x: 84, y: 0, w: 80, h: 32 } }
  ];

  assert.equal(resolveDesktopDropdownHoverSwitch({
    buttons,
    point: { x: 90, y: 12 },
    openRootId: null
  }), null);
  assert.equal(resolveDesktopDropdownHoverSwitch({
    buttons,
    point: { x: 10, y: 12 },
    openRootId: 'file'
  }), null);
  assert.equal(resolveDesktopDropdownHoverSwitch({
    buttons,
    point: { x: 90, y: 12 },
    openRootId: 'file'
  })?.rootId, 'edit');
});

test('desktop top menu plan creates bounded root buttons and active dropdown', () => {
  const plan = buildDesktopTopMenuPlan('level', {
    bounds: { x: 10, y: 4, w: 760, h: 38 },
    activeRootId: 'pixels',
    labelOverrides: { file: 'Menu' }
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.equal(plan.buttons[0].id, 'file');
  assert.equal(plan.buttons[0].label, 'Menu');
  assert.ok(plan.buttons.every((button) => button.bounds.y === 4));
  assert.ok(plan.buttons.every((button) => button.bounds.x + button.bounds.w <= plan.bounds.x + plan.bounds.w - plan.bounds.padding));
  assert.equal(plan.buttons.find((button) => button.id === 'pixels')?.active, true);
  assert.equal(plan.dropdown.rootId, 'pixels');
  assert.equal(plan.dropdown.specId, 'tile-art');
  assert.equal(plan.dropdown.title, 'Tile Art');
  assert.ok(plan.dropdown.bounds.y >= 42);
  assert.ok(plan.dropdown.bounds.x + plan.dropdown.bounds.w <= plan.bounds.x + plan.bounds.w - plan.bounds.padding);
  assert.equal(plan.fit.totalCount, getEditorRootMenuEntries('level').length);
  assert.equal(plan.fit.visibleCount, plan.buttons.length);
  assert.equal(plan.fit.isCompressed, true);
  assert.equal(plan.fit.hasHiddenOverflow, false);
  assert.equal(plan.fit.allRootMenusVisible, true);
  assert.ok(plan.fit.minimumRecommendedWidth > plan.bounds.w);
});

test('desktop shell top menus expose shared fit metadata for every editor', () => {
  ALL_EDITOR_IDS.forEach((editorId) => {
    const shell = buildDesktopEditorShellPlan(editorId, {
      viewportWidth: 1280,
      viewportHeight: 800
    });
    const entries = getEditorRootMenuEntries(editorId);

    assert.equal(shell.topMenu.fit.totalCount, entries.length, editorId);
    assert.equal(shell.topMenu.fit.visibleCount, shell.topMenu.buttons.length, editorId);
    assert.equal(shell.topMenu.fit.hasHiddenOverflow, false, editorId);
    assert.equal(shell.topMenu.fit.allRootMenusVisible, true, editorId);
    assert.equal(shell.topMenu.buttons.length, entries.length, editorId);
    assert.ok(shell.topMenu.buttons.every((button) => button.bounds.x + button.bounds.w <= shell.topMenu.bounds.w - shell.topMenu.bounds.padding), editorId);
    assert.equal(shell.topMenu.fit.minimumRecommendedWidth >= shell.topMenu.bounds.padding * 2, true, editorId);
  });
});

test('desktop top menu fit metadata reports intentional overflow separately from compression', () => {
  const plan = buildDesktopTopMenuPlan('cutscene', {
    bounds: { x: 0, y: 0, w: 1280, h: 40 },
    maxVisibleItems: 5
  });

  assert.equal(plan.buttons.length, 5);
  assert.equal(plan.overflowEntries.length, getEditorRootMenuEntries('cutscene').length - 5);
  assert.equal(plan.fit.visibleCount, 5);
  assert.equal(plan.fit.totalCount, getEditorRootMenuEntries('cutscene').length);
  assert.equal(plan.fit.hasHiddenOverflow, true);
  assert.equal(plan.fit.allRootMenusVisible, false);
  assert.equal(plan.fit.isCompressed, false);
});

test('desktop dropdown plan resolves section actions through runtime aliases', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'virtual-instruments', {
    anchor: { x: 120, y: 8, w: 96, h: 32 }
  });

  assert.equal(dropdown.rootId, 'virtual-instruments');
  assert.equal(dropdown.specId, 'record');
  assert.equal(dropdown.title, 'Record');
  assert.deepEqual(dropdown.items.map((item) => item.id), ['enter-record', 'single-note']);
  assert.deepEqual(dropdown.bounds, { x: 120, y: 40, w: 220, h: 68 });
  assert.deepEqual(dropdown.panelBounds, { x: 120, y: 40, w: 220, h: 68 });
  assert.equal(dropdown.visibleRows, 2);
  assert.equal(dropdown.maxScroll, 0);
  assert.deepEqual(dropdown.itemBounds[0], { id: 'enter-record', x: 128, y: 42, w: 204, h: 30 });
  assert.deepEqual(dropdown.itemBounds[1], { id: 'single-note', x: 128, y: 76, w: 204, h: 30 });
});

test('desktop dropdown plan clamps to container bounds when supplied', () => {
  const dropdown = buildDesktopDropdownPlan('level', 'playtest', {
    anchor: { x: 700, y: 4, w: 52, h: 38 },
    containerBounds: { x: 10, y: 4, w: 760, h: 38, padding: 8 }
  });

  assert.equal(dropdown.rootId, 'playtest');
  assert.equal(dropdown.bounds.w, 220);
  assert.equal(dropdown.bounds.x + dropdown.bounds.w <= 10 + 760 - 8, true);
  assert.equal(dropdown.bounds.y, 42);
});

test('desktop dropdown plan exposes shared clipped row geometry for long menus', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'file', {
    anchor: { x: 16, y: 0, w: 84, h: 40 },
    maxVisibleRows: 4
  });

  assert.equal(dropdown.visibleRows, 4);
  assert.equal(dropdown.maxScroll, dropdown.items.length - 4);
  assert.equal(dropdown.scrollIndex, 0);
  assert.equal(dropdown.panelBounds.h, 136);
  assert.deepEqual(dropdown.renderedItems.map((item) => item.id), ['new', 'save', 'save-as', 'open']);
  assert.deepEqual(dropdown.itemBounds.map((bounds) => bounds.id), ['new', 'save', 'save-as', 'open']);
  assert.deepEqual(dropdown.itemBounds[3], { id: 'open', x: 24, y: 144, w: 204, h: 30 });
});

test('desktop dropdown plan applies shared scroll offsets for long menus', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'file', {
    anchor: { x: 16, y: 0, w: 84, h: 40 },
    maxVisibleRows: 4,
    scroll: 2
  });

  assert.equal(dropdown.visibleRows, 4);
  assert.equal(dropdown.scrollIndex, 2);
  assert.deepEqual(dropdown.renderedItems.map((item) => item.id), ['save-as', 'open', 'export', 'import']);
  assert.deepEqual(dropdown.itemBounds.map((bounds) => bounds.id), ['save-as', 'open', 'export', 'import']);
});

test('desktop dropdown render plan maps shared rows to live action items', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'file', {
    anchor: { x: 16, y: 0, w: 84, h: 40 },
    maxVisibleRows: 4,
    scroll: 1
  });
  const items = dropdown.items.map((item) => ({
    ...item,
    onSelect: () => item.id
  }));
  const plan = buildDesktopDropdownRenderPlan({ dropdown, items });

  assert.deepEqual(plan.renderedItems.map((item) => item.id), ['save', 'save-as', 'open', 'export']);
  assert.equal(typeof plan.actionById.get('save')?.onSelect, 'function');
  assert.deepEqual(plan.renderedItems.map((item) => [item.id, item.sourceRootId, item.commandSurface, item.pointerType, item.rowActivation]), [
    ['save', 'file', DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation],
    ['save-as', 'file', DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation],
    ['open', 'file', DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation],
    ['export', 'file', DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface, DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType, DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation]
  ]);
  assert.equal(plan.panelBounds.h, dropdown.rowHeight * 4);
  assert.equal(plan.visibleRows, 4);
  assert.equal(plan.scrollIndex, 1);
  assert.equal(plan.maxScroll, dropdown.items.length - 4);
  assert.equal(plan.scrollRegion.maxScroll, dropdown.items.length - 4);
  assert.equal(plan.scrollRegion.pointerType, 'mouse');
  assert.deepEqual(plan.itemBounds.map((bounds) => bounds.id), ['save', 'save-as', 'open', 'export']);
  assert.deepEqual(plan.motion, {
    type: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.type,
    progress: 1,
    durationMs: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs,
    origin: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.origin,
    translateY: 0,
    opacity: 1
  });

  const openingPlan = buildDesktopDropdownRenderPlan({
    dropdown,
    items,
    motionProgress: 0.25,
    motionDurationMs: 140
  });
  assert.equal(openingPlan.motion.type, DESKTOP_DROPDOWN_STATE_CONTRACT.motion.type);
  assert.equal(openingPlan.motion.origin, DESKTOP_DROPDOWN_STATE_CONTRACT.motion.origin);
  assert.equal(openingPlan.motion.progress, 0.25);
  assert.equal(openingPlan.motion.durationMs, 140);
  assert.ok(openingPlan.motion.translateY < 0);
  assert.ok(openingPlan.motion.opacity > 0.7 && openingPlan.motion.opacity < 1);

  const editDropdown = buildDesktopDropdownPlan('pixel', 'edit', {
    anchor: { x: 16, y: 0, w: 84, h: 40 },
    maxVisibleRows: 6
  });
  const editPlan = buildDesktopDropdownRenderPlan({
    dropdown: editDropdown,
    items: editDropdown.items.map((item) => ({ ...item, onSelect: () => item.id }))
  });
  assert.deepEqual(editPlan.renderedItems.map((item) => [item.id, item.editActionRole]), [
    ['undo', 'history'],
    ['redo', 'history'],
    ['copy', 'clipboard'],
    ['cut', 'clipboard'],
    ['paste', 'clipboard'],
    ['clear', 'destructive']
  ]);
  assert.deepEqual(editPlan.renderedItems.map((item) => [
    item.id,
    item.editActionRoleGroupIndex,
    Boolean(item.startsEditActionRoleGroup)
  ]), [
    ['undo', 0, false],
    ['redo', 0, false],
    ['copy', 1, true],
    ['cut', 1, false],
    ['paste', 1, false],
    ['clear', 2, true]
  ]);
  assert.equal(editPlan.actionById.get('copy')?.desktopActionRole, 'clipboard');
  assert.equal(editPlan.actionById.get('clear')?.sourceRootId, 'edit');

  const grid = buildDesktopDropdownPlan('midi', 'grid', {
    anchor: { x: 16, y: 0, w: 84, h: 40 }
  });
  const gridPlan = buildDesktopDropdownRenderPlan({
    dropdown: grid,
    items: [
      { id: 'place-note', label: 'Place Note' },
      { id: 'erase-note', label: 'Erase Note' },
      { id: 'select', label: 'Select' },
      { id: 'copy', label: 'Copy' }
    ],
    hiddenIds: ['place-note', 'erase-note']
  });
  assert.deepEqual(gridPlan.visibleItems.map((item) => item.id), ['select', 'copy']);
  assert.deepEqual(gridPlan.renderedItems.map((item) => item.id), ['select', 'copy']);

  const dividerPlan = buildDesktopDropdownRenderPlan({
    dropdown: { ...dropdown, scrollIndex: 0, visibleRows: 4 },
    items: [
      { id: 'new', label: 'New' },
      { divider: true },
      { id: 'save', label: 'Save' },
      { separator: true },
      { id: 'open', label: 'Open' }
    ],
    useVisibleItemsSlice: true
  });
  assert.deepEqual(dividerPlan.visibleItems.map((item) => item.id || (item.divider ? 'divider' : 'separator')), ['new', 'divider', 'save', 'separator', 'open']);
  assert.deepEqual(dividerPlan.renderedItems.map((item) => item.id || (item.divider ? 'divider' : 'separator')), ['new', 'divider', 'save', 'separator']);
  assert.deepEqual(dividerPlan.itemBounds.map((bounds) => bounds.id), ['new', 'separator-1', 'save', 'separator-3']);

  const livePlan = buildDesktopDropdownRenderPlan({
    dropdown: { ...dropdown, scrollIndex: 1, visibleRows: 2 },
    items: [
      { id: 'state:a', label: 'A' },
      { id: 'state:b', label: 'B' },
      { id: 'state:c', label: 'C' }
    ],
    useVisibleItemsSlice: true
  });
  assert.deepEqual(livePlan.renderedItems.map((item) => item.id), ['state:b', 'state:c']);

  const strictPlan = buildDesktopDropdownRenderPlan({
    dropdown: { ...dropdown, scrollIndex: 0, visibleRows: 3 },
    items: [
      { id: 'copy', label: 'Copy', onSelect: () => {} },
      { id: 'empty', label: 'Empty' },
      { id: 'paste', label: 'Paste', disabled: true, onClick: () => {} }
    ],
    useVisibleItemsSlice: true,
    disableActionlessItems: true
  });
  assert.equal(strictPlan.actionById.get('copy')?.disabled, false);
  assert.equal(strictPlan.actionById.get('empty')?.disabled, true);
  assert.equal(strictPlan.actionById.get('paste')?.disabled, true);

  const filteredScrollPlan = buildDesktopDropdownRenderPlan({
    dropdown: { ...dropdown, scrollIndex: 8, visibleRows: 2 },
    items: [
      { id: 'new', label: 'New' },
      { id: 'save', label: 'Save' },
      { id: 'open', label: 'Open' },
      { id: 'export', label: 'Export' }
    ],
    hiddenIds: ['save'],
    useVisibleItemsSlice: true
  });
  assert.equal(filteredScrollPlan.visibleItems.length, 3);
  assert.equal(filteredScrollPlan.maxScroll, 1);
  assert.equal(filteredScrollPlan.scrollIndex, 1);
  assert.deepEqual(filteredScrollPlan.renderedItems.map((item) => item.id), ['open', 'export']);
  assert.equal(filteredScrollPlan.scrollRegion.maxScroll, 1);

  const dedupedPlan = buildDesktopDropdownRenderPlan({
    dropdown: { ...dropdown, scrollIndex: 0, visibleRows: 5 },
    items: [
      { id: 'animation', label: 'Animation' },
      { divider: true },
      { id: 'animation', label: 'Animation duplicate' },
      { id: 'state-graph', label: 'State Graph' }
    ],
    useVisibleItemsSlice: true
  });
  assert.deepEqual(
    dedupedPlan.visibleItems.map((item) => item.id || (item.divider ? 'divider' : 'separator')),
    ['animation', 'divider', 'state-graph']
  );
  assert.deepEqual(
    dedupedPlan.renderedItems.map((item) => item.id || (item.divider ? 'divider' : 'separator')),
    ['animation', 'divider', 'state-graph']
  );
});

test('desktop dropdown render plan registers drag-safe regions even when contents fit', () => {
  const dropdown = buildDesktopDropdownPlan('midi', 'record', {
    anchor: { x: 16, y: 0, w: 84, h: 40 },
    maxVisibleRows: 8
  });
  const plan = buildDesktopDropdownRenderPlan({ dropdown });

  assert.equal(plan.maxScroll, 0);
  assert.equal(plan.scrollRegion.menuId, 'virtual-instruments');
  assert.deepEqual(plan.scrollRegion.bounds, plan.panelBounds);
  assert.equal(plan.scrollRegion.maxScroll, 0);
  assert.equal(plan.scrollRegion.lineHeight, dropdown.rowHeight);
  assert.equal(plan.scrollRegion.pointerType, 'mouse');
});

test('shared desktop dropdown renders disabled rows without registering clicks', () => {
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    rect() {},
    clip() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    measureText: (text) => ({ width: String(text || '').length * 7 }),
    setLineDash() {}
  };
  const dropdownPlan = {
    panelBounds: { x: 0, y: 0, w: 220, h: 68 },
    motion: {
      type: 'slide-down',
      progress: 0.5,
      durationMs: 120,
      origin: EDITOR_SURFACES.topMenu,
      translateY: -9,
      opacity: 0.86
    },
    itemBounds: [
      { id: 'copy', x: 8, y: 4, w: 204, h: 30 },
      { id: 'separator-1', x: 8, y: 38, w: 204, h: 20 },
      { id: 'paste', x: 8, y: 62, w: 204, h: 30 }
    ],
    scrollRegion: {
      menuId: 'edit',
      bounds: { x: 0, y: 0, w: 220, h: 68 },
      maxScroll: 0,
      lineHeight: 34,
      pointerType: 'mouse'
    },
    renderedItems: [
      { id: 'copy', label: 'Copy', disabled: true },
      { divider: true },
      { id: 'paste', label: 'Paste' }
    ]
  };
  const registeredRegions = [];

  const rendered = drawSharedDesktopDropdown(ctx, dropdownPlan, {
    registerButton: (entry) => calls.push(entry.item.id),
    registerScrollRegion: (region) => registeredRegions.push(region)
  });

  assert.deepEqual(rendered.map((entry) => entry.item.id || 'divider'), ['copy', 'divider', 'paste']);
  assert.deepEqual(calls, ['paste']);
  assert.equal(rendered[2].bounds.y, 53);
  assert.equal(registeredRegions.length, 1);
  assert.equal(registeredRegions[0].menuId, 'edit');
  assert.deepEqual(registeredRegions[0].bounds, { x: 0, y: -9, w: 220, h: 68 });
  assert.equal(registeredRegions[0].maxScroll, 0);
});

test('shared file menu specs include the actions used by editor surfaces', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('pixel', 'tools').actions, ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']);
  assert.deepEqual(getEditorMenuSection('level', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'load-wrx', 'load-brz', 'load-civic', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('level', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('actor', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('actor', 'edit').actions, ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']);
  assert.deepEqual(getEditorMenuSection('midi', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'rescue-save', 'export-midi', 'export-midi-zip', 'export-wav', 'save-paint', 'play-robtersession', 'theme', 'sample', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('midi', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'select-all', 'delete']);
  assert.deepEqual(getEditorMenuSection('sfx', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('sfx', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('race', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'generate-random-race', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('race', 'edit').actions, ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']);
  assert.deepEqual(getEditorMenuSection('car', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('car', 'edit').actions, ['undo', 'redo']);

  const sharedEditBaseline = ['undo', 'redo'];
  ALL_EDITOR_IDS.forEach((editorId) => {
    const dropdown = buildDesktopDropdownPlan(editorId, 'file');
    assert.deepEqual(
      dropdown.items.slice(0, DESKTOP_FILE_BASELINE_ACTION_IDS.length).map((item) => item.id),
      DESKTOP_FILE_BASELINE_ACTION_IDS,
      `${editorId} desktop File dropdown should start with the shared baseline`
    );
    assert.equal(
      dropdown.items.at(-1)?.id,
      DESKTOP_FILE_FOOTER_ACTION_ID,
      `${editorId} desktop File dropdown should keep Exit to Main Menu as the footer`
    );
    const editDropdown = buildDesktopDropdownPlan(editorId, 'edit');
    assert.deepEqual(
      editDropdown.items.slice(0, sharedEditBaseline.length).map((item) => item.id),
      sharedEditBaseline,
      `${editorId} desktop Edit dropdown should start with Undo and Redo`
    );
    assert.equal(
      editDropdown.items.length,
      getEditorMenuSection(editorId, 'edit').actions.length,
      `${editorId} desktop Edit dropdown should mirror the shared edit action count`
    );
  });

  const pixelDropdown = buildDesktopDropdownPlan('pixel', 'file');
  assert.deepEqual(pixelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.equal(pixelDropdown.items.some((item) => ['copy-image', 'paste-image'].includes(item.id)), false);
  assert.equal(getEditorMenuSection('pixel', 'canvas').actions.includes('import-image'), true);
  assert.equal(getEditorMenuSection('pixel', 'edit').actions.includes('copy'), true);
  assert.equal(getEditorMenuSection('pixel', 'edit').actions.includes('paste'), true);
  const pixelToolsDropdown = buildDesktopDropdownPlan('pixel', 'tools');
  assert.deepEqual(pixelToolsDropdown.items.map((item) => item.id), ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']);

  const levelDropdown = buildDesktopDropdownPlan('level', 'file');
  assert.deepEqual(levelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'load-wrx', 'load-brz', 'load-civic', 'exit-main']);
  assert.deepEqual(buildDesktopDropdownPlan('level', 'playtest').items.map((item) => item.id), ['playtest']);
  const levelEditDropdown = buildDesktopDropdownPlan('level', 'edit');
  assert.deepEqual(levelEditDropdown.items.map((item) => item.id), ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);

  const actorDropdown = buildDesktopDropdownPlan('actor', 'file');
  assert.deepEqual(actorDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);

  const raceDropdown = buildDesktopDropdownPlan('race', 'file');
  assert.deepEqual(raceDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'generate-random-race', 'exit-main']);
  const raceEditDropdown = buildDesktopDropdownPlan('race', 'edit');
  assert.deepEqual(raceEditDropdown.items.map((item) => item.id), ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']);

  const carDropdown = buildDesktopDropdownPlan('car', 'file');
  assert.deepEqual(carDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  const carEditDropdown = buildDesktopDropdownPlan('car', 'edit');
  assert.deepEqual(carEditDropdown.items.map((item) => item.id), ['undo', 'redo']);
});

test('desktop editor shell plan reserves top menus and left ribbon/options', () => {
  const plan = buildDesktopEditorShellPlan('sfx', {
    viewportWidth: 1280,
    viewportHeight: 720,
    activeRootId: 'generate',
    leftPanelWidth: 312,
    leftRibbonHeight: 56
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.deepEqual(plan.topMenu.bounds, { x: 0, y: 0, w: 1280, h: 40, itemMinWidth: 72, itemMaxWidth: 132, gap: 4, padding: 8 });
  assert.equal(plan.topMenu.buttons.find((button) => button.id === 'generate')?.active, true);
  assert.equal(plan.dropdown.rootId, 'generate');
  assert.deepEqual(plan.leftRibbon, { x: 8, y: 48, w: 304, h: 56 });
  assert.deepEqual(plan.leftOptions, { x: 8, y: 112, w: 304, h: 600 });
  assert.deepEqual(plan.workSurface, { x: 320, y: 48, w: 952, h: 664 });
  assert.equal(Object.hasOwn(plan, 'bottomBar'), false);
  assert.equal(plan.commandSurface, DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface);
  assert.deepEqual(plan.commandSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.commandSurfaces);
  assert.deepEqual(plan.persistentSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.persistentSurfaces);
  assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
  assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
  assert.deepEqual(plan.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP));
  assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP));
  assert.deepEqual(plan.suppressedMobileSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.suppressedMobileSurfaces);
  assert.equal(plan.leftPanelRole, DESKTOP_SHELL_SURFACE_CONTRACT.leftPanelRole);
  assert.equal(plan.duplicatesCommandsInLeftPanel, DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel);
  assert.deepEqual(plan.leftContextPanelContract, DESKTOP_CONTEXT_PANEL_CONTRACT);
  assert.equal(plan.leftContextPanelContract.drawerCommandsStayInTopDropdown, true);
  assert.equal(plan.leftContextPanelContract.duplicatesTopDropdownCommands, false);
  assert.deepEqual(plan.leftContextPanelContract.contextualQuickActionPolicy, {
    allowed: true,
    mustBeContextual: true,
    mustNotDuplicateOpenDropdown: true
  });
  assert.equal(plan.desktopMobileRailsHidden, DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden);
  assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.bottomActionRail], 'suppressed');
  assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.gamepadHintBar], 'suppressed');
  assert.equal(plan.scroll.leftOptions.suppressClickAfterDrag, true);
});

test('desktop editor shell defaults are shared across every editor', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const plan = buildDesktopEditorShellPlan(editorId, {
      viewportWidth: 1440,
      viewportHeight: 900,
      activeRootId: 'file'
    });

    assert.equal(plan.mode, EDITOR_LAYOUT_MODES.DESKTOP);
    assert.equal(plan.topMenu.bounds.h, 40);
    assert.equal(plan.leftColumn.w, 338);
    assert.equal(plan.leftRibbon.h, 58);
    assert.equal(plan.leftOptions.x, plan.leftRibbon.x);
    assert.equal(plan.workSurface.x, plan.leftColumn.x + plan.leftColumn.w + 8);
    assert.equal(plan.commandSurface, DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface);
    assert.deepEqual(plan.commandSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.commandSurfaces);
    assert.deepEqual(plan.persistentSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.persistentSurfaces);
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(plan.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.DESKTOP));
    assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP));
    assert.deepEqual(plan.suppressedMobileSurfaces, DESKTOP_SHELL_SURFACE_CONTRACT.suppressedMobileSurfaces);
    assert.equal(plan.leftPanelRole, DESKTOP_SHELL_SURFACE_CONTRACT.leftPanelRole);
    assert.equal(plan.duplicatesCommandsInLeftPanel, DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel);
    assert.deepEqual(plan.leftContextPanelContract, DESKTOP_CONTEXT_PANEL_CONTRACT);
    assert.equal(plan.desktopMobileRailsHidden, DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden);
    assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.topMenu], 'required');
    assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.bottomToolRail], 'suppressed');
    const genericDesktop = buildEditorMenuLayoutPlan(editorId, {
      isMobile: false,
      viewportWidth: 1440,
      viewportHeight: 900
    });
    assert.deepEqual(plan.presentation, genericDesktop.presentation);
    assert.deepEqual(plan.interaction, genericDesktop.interaction);
    assert.ok(plan.topMenu.buttons.length > 0, `${editorId} should expose desktop top menu buttons`);
    assert.equal(plan.topMenu.buttons[0].id, 'file');
  }
});

test('desktop editor shell clamps the shared left panel for narrow and wide desktops', () => {
  const narrow = buildDesktopEditorShellPlan('pixel', {
    viewportWidth: 900,
    viewportHeight: 700
  });
  assert.equal(narrow.leftColumn.w, 284);
  assert.equal(narrow.workSurface.w, 592);

  const wide = buildDesktopEditorShellPlan('pixel', {
    viewportWidth: 1920,
    viewportHeight: 1080
  });
  assert.equal(wide.leftColumn.w, 352);
  assert.equal(wide.workSurface.w, 1544);
});

test('desktop editor shell caps dropdown drawers to the visible desktop viewport', () => {
  const plan = buildDesktopEditorShellPlan('midi', {
    viewportWidth: 900,
    viewportHeight: 220,
    activeRootId: 'file'
  });

  assert.equal(plan.dropdown.rootId, 'file');
  assert.equal(plan.dropdown.visibleRows, 5);
  assert.equal(plan.dropdown.panelBounds.y + plan.dropdown.panelBounds.h <= plan.bounds.h, true);
  assert.equal(plan.dropdown.maxScroll, plan.dropdown.items.length - 5);
  assert.deepEqual(plan.dropdown.renderedItems.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export']);
});

test('landscape touch shell plan standardizes side rails, bottom rail, and gesture scroll', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 72,
    reserveRightRail: true
  });

  assert.equal(plan.mode, EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  assert.deepEqual(plan.placement, {
    root: EDITOR_SURFACES.leftRail,
    submenu: EDITOR_SURFACES.rightDrawer,
    settings: EDITOR_SURFACES.rightDrawer
  });
  assert.equal(plan.rootMenuSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootSurface);
  assert.equal(plan.submenuSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.submenuSurface);
  assert.deepEqual(plan.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH));
  assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.leftRail], 'required');
  assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.desktopTopMenu], 'suppressed');
  assert.equal(plan.bottomRailRole, 'tool-options-ribbons-zoom');
  assert.equal(plan.gestureScroll, true);
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.submenu, plan.rightRail);
  assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail);
  assert.deepEqual(plan.surfaces.zoom, plan.bottomRail);
  assert.deepEqual(plan.surfaces.ribbon, plan.bottomRail);
  assert.deepEqual(plan.surfaces.workSurface, plan.workSurface);
  assert.equal(plan.leftRail.x, 0);
  assert.equal(plan.leftRail.w, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.width);
  assert.equal(plan.compactCommandRailActionLimit, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.actionLimit);
  assert.equal(plan.rightRail.x + plan.rightRail.w, 844);
  assert.equal(plan.workSurface.x > plan.leftRail.x + plan.leftRail.w, true);
  assert.equal(plan.bottomRail.y >= plan.workSurface.y + plan.workSurface.h, true);
  assert.equal(plan.scroll.leftRail.pointerType, 'touch');
  assert.equal(plan.scroll.leftRail.enabled, false);
  assert.equal(plan.scroll.rightRail.suppressClickAfterDrag, true);
  assert.equal(plan.scroll.workSurface.pinchZoomReservedForWorkSurface, true);
  assert.equal(uiSpecSource.includes('The bottom rail is the persistent tool/options surface for zoom, ribbons, palette/context controls, transport, or quick actions'), true);
  assert.equal(uiSpecSource.includes('Pixel landscape should keep zoom in this bottom rail beside palette/layer/frame controls instead of reintroducing a separate top zoom strip.'), true);
  assert.equal(uiSpecSource.includes('Dense editors should use the shared 84px compact command rail with `Menu`, `Undo`, `Redo`, and one contextual quick action; this rail is not scrollable.'), true);
  assert.equal(uiSpecSource.includes('The compact four-button left command rail stays fixed.'), true);
  assert.equal(editorUiContractSource.includes('`BottomRail` is the persistent tool/options/zoom/ribbon surface'), true);
  assert.equal(editorUiContractSource.includes('Pixel landscape intentionally draws zoom from its bottom control rail while leaving the shell `surfaces.zoom` null'), true);
  assert.equal(editorUiContractSource.includes('`LeftRail` is the persistent fixed compact command rail and maps to `surfaces.compactCommandRail`'), true);
  assert.equal(editorUiContractSource.includes('It is `84px` wide, shows `Menu`, `Undo`, `Redo`, and one contextual quick action, and does not scroll.'), true);
  assert.equal(editorUiContractSource.includes('`RootDrawer` is the full root menu opened by `Menu` and maps to `surfaces.rootDrawer`'), true);
  assert.equal(editorUiContractSource.includes('maps to `surfaces.toolOptions`, `surfaces.zoom`, and `surfaces.ribbon`'), true);
  assert.equal(editorUiContractSource.includes('suppressedDesktopSurfaces'), true);
  assert.equal(editorUiContractSource.includes('`desktop-top-menu`, `desktop-dropdown`, and `desktop-left-inspector`'), true);
});

test('landscape touch shell can reserve an opt-in top zoom rail', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 78,
    topRailHeight: 40,
    reserveRightRail: false,
    reserveThumbstickSpace: false,
    rootDrawerOverlayOrigin: 'left'
  });

  assert.ok(plan.surfaces.topRail);
  assert.deepEqual(plan.surfaces.zoom, plan.surfaces.topRail);
  assert.equal(plan.surfaces.topRail.h, 40);
  assert.equal(plan.surfaces.workSurface.y >= plan.surfaces.topRail.y + plan.surfaces.topRail.h, true);
  assert.equal(plan.bottomRailRole, 'tool-options-ribbons-zoom');
  assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail);
  assert.deepEqual(plan.surfaces.ribbon, plan.bottomRail);
});

test('compact landscape command rail keeps four canonical actions', () => {
  const undoAction = { id: 'undo', disabled: true, onClick: null };
  const quickAction = { id: 'play', primary: true, onClick() {} };
  const actions = buildCompactLandscapeCommandRailActions({
    menu: { id: 'menu' },
    undo: undoAction,
    redo: { id: 'redo' },
    quick: quickAction
  });

  assert.deepEqual(actions.map((action) => action.id), ['menu', 'undo', 'redo', 'play']);
  assert.deepEqual(actions.map((action) => action.displayLabel), ['☰', '↶', '↷', undefined]);
  assert.deepEqual(actions.map((action) => action.slot), ['menu', 'undo', 'redo', 'quick']);
  actions.forEach((action) => {
    assert.equal(action.surface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface);
    assert.equal(action.commandRail, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.commandRail);
    assert.equal(action.rowActivation, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.rowActivation);
    assert.equal(action.gestureScroll, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.gestureScroll);
  });
  assert.equal(actions[1].disabled, true);
  assert.equal(actions[1].onClick, null);
  assert.equal(actions[3].primary, true);
  assert.equal(actions[3].onClick, quickAction.onClick);
  assert.deepEqual(buildCompactLandscapeCommandRailActions({
    menu: { id: 'menu' },
    undo: null,
    redo: { id: 'redo' },
    quick: { id: 'brush' }
  }).map((action) => action.id), ['menu', 'redo', 'brush']);
});

test('compact landscape command rail button layout centers shared four-action rails', () => {
  const actions = buildCompactLandscapeCommandRailActions({
    menu: { id: 'menu' },
    undo: { id: 'undo' },
    redo: { id: 'redo' },
    quick: { id: 'play' }
  });
  const rows = buildCompactLandscapeCommandRailButtonLayout({
    bounds: { x: 0, y: 0, w: 80, h: 240 },
    actions,
    buttonHeight: 40,
    buttonGap: 8,
    paddingX: 6,
    paddingY: 8,
    maxButtonWidth: 60
  });

  assert.deepEqual(rows.map((row) => row.action.id), ['menu', 'undo', 'redo', 'play']);
  assert.deepEqual(rows.map((row) => row.bounds), [
    { x: 10, y: 28, w: 60, h: 40, id: 'menu' },
    { x: 10, y: 76, w: 60, h: 40, id: 'undo' },
    { x: 10, y: 124, w: 60, h: 40, id: 'redo' },
    { x: 10, y: 172, w: 60, h: 40, id: 'play' }
  ]);
});

test('landscape root drawer grid layout keeps root categories visible without scroll for standard editor roots', () => {
  const grid = buildLandscapeRootDrawerGridLayout({
    bounds: { x: 500, y: 0, w: 340, h: 312 },
    itemCount: 8,
    padding: 8,
    gap: 8,
    rowHeight: 44
  });

  assert.equal(grid.columns, 4);
  assert.equal(grid.items.length, 8);
  assert.equal(grid.maxScroll, 0);
  assert.deepEqual(grid.listBounds, { x: 508, y: 8, w: 324, h: 296 });
  assert.deepEqual(grid.items[0].bounds, { x: 508, y: 8, w: 75, h: 42 });
  assert.deepEqual(grid.items[4].bounds, { x: 508, y: 58, w: 75, h: 42 });

  const narrow = buildLandscapeRootDrawerGridLayout({
    bounds: { x: 280, y: 0, w: 280, h: 220 },
    itemCount: 7,
    padding: 10,
    gap: 6,
    rowHeight: 40
  });
  assert.equal(narrow.columns, 3);
  assert.equal(narrow.items[2].bounds.x + narrow.items[2].bounds.w <= narrow.listBounds.x + narrow.listBounds.w, true);
  assert.equal(narrow.maxScroll, 0);
});

test('landscape root drawer grid keeps every editor root category visible at phone-landscape size', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const shell = buildLandscapeTouchEditorShellPlan(editorId, {
      viewportWidth: 844,
      viewportHeight: 390,
      bottomRailHeight: 72,
      reserveRightRail: false
    });
    const rootCount = getEditorRootMenuEntries(editorId).length;
    const grid = buildLandscapeRootDrawerGridLayout({
      bounds: shell.surfaces.rootDrawer,
      itemCount: rootCount
    });

    assert.equal(grid.maxScroll, 0, `${editorId} root drawer should show all root categories without scroll`);
    assert.equal(grid.items.length, rootCount, `${editorId} root drawer should lay out every root category`);
    grid.items.forEach((item) => {
      assert.equal(item.bounds.x >= grid.listBounds.x, true, `${editorId} root item should stay inside drawer horizontally`);
      assert.equal(item.bounds.x + item.bounds.w <= grid.listBounds.x + grid.listBounds.w, true, `${editorId} root item should fit drawer width`);
      assert.equal(item.bounds.y >= grid.listBounds.y, true, `${editorId} root item should stay inside drawer vertically`);
      assert.equal(item.bounds.y + item.bounds.h <= grid.listBounds.y + grid.listBounds.h, true, `${editorId} root item should fit drawer height`);
    });
  }
});

test('scrolled landscape root drawer items clamp and expose only visible bounds', () => {
  const grid = buildLandscapeRootDrawerGridLayout({
    bounds: { x: 0, y: 0, w: 120, h: 92 },
    itemCount: 9,
    padding: 4,
    gap: 4,
    minColumns: 1,
    maxColumns: 1,
    wideWidth: 999,
    rowHeight: 32,
    minRowHeight: 32,
    maxRowHeight: 32
  });
  const result = buildScrolledLandscapeRootDrawerItems(grid, 2);

  assert.equal(result.scroll, 2);
  assert.equal(result.maxScroll, grid.maxScroll);
  assert.deepEqual(result.listBounds, grid.listBounds);
  assert.deepEqual(result.items.map((item) => item.index), [2, 3, 4]);
  assert.equal(result.items[0].bounds.y, grid.items[2].bounds.y - result.scroll * result.lineHeight);
  assert.equal(buildScrolledLandscapeRootDrawerItems(grid, 99).scroll, grid.maxScroll);
  assert.equal(buildScrolledLandscapeRootDrawerItems(grid, -4).scroll, 0);
});

test('landscape touch shell can keep compact command rails full height', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 78,
    reserveRightRail: false,
    reserveThumbstickSpace: false
  });

  assert.equal(plan.leftRail.h, 390);
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.submenu, null);
  assert.ok(plan.surfaces.overlayDrawer.y + plan.surfaces.overlayDrawer.h <= plan.bottomRail.y);
});

test('landscape touch shell keeps compact rails tall enough for four actions', () => {
  const plan = buildLandscapeTouchEditorShellPlan('sfx', {
    viewportWidth: 640,
    viewportHeight: 260,
    bottomRailHeight: 72,
    reserveRightRail: false
  });

  assert.equal(plan.leftRail.h >= 200, true);
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.equal(plan.leftRail.h <= plan.bounds.h, true);
});

test('landscape touch shell role contract is shared across every editor', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const plan = buildLandscapeTouchEditorShellPlan(editorId, {
      viewportWidth: 844,
      viewportHeight: 390,
      bottomRailHeight: 64,
      reserveRightRail: true
    });

    assert.equal(plan.rootMenuSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootSurface);
    assert.equal(plan.submenuSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.submenuSurface);
    assert.equal(plan.compactCommandRailSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface);
    assert.equal(plan.compactCommandRailActionLimit, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.actionLimit);
    assert.equal(plan.rootDrawerSurface, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface);
    assert.equal(plan.rootDrawerOverlayOrigin, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerOverlayOrigin);
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(plan.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH));
    assert.deepEqual(plan.effectiveSurfaceVisibility, getLandscapeTouchShellEffectiveSurfaceVisibility({
      reserveRightRail: true,
      rootDrawerOverlayOrigin: 'left',
      bottomRailHeight: 64
    }));
    assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH));
    assert.deepEqual(plan.suppressedDesktopSurfaces, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.suppressedDesktopSurfaces);
    assert.equal(plan.bottomRailRole, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.bottomRailRole);
    assert.equal(plan.gestureScroll, true);
    const genericLandscape = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 844,
      viewportHeight: 390
    });
    assert.deepEqual(plan.presentation, genericLandscape.presentation);
    assert.deepEqual(plan.interaction, genericLandscape.interaction);
    assert.deepEqual(plan.surfaces.compactCommandRail, plan.leftRail);
    assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
    assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
    assert.deepEqual(plan.surfaces.submenu, plan.rightRail);
    assert.ok(plan.surfaces.overlayDrawer);
    assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail);
    assert.deepEqual(plan.surfaces.zoom, plan.bottomRail);
    assert.deepEqual(plan.surfaces.ribbon, plan.bottomRail);
    assert.deepEqual(plan.surfaces.workSurface, plan.workSurface);
    assert.equal(plan.surfaces.rootDrawer.x >= plan.leftRail.x + plan.leftRail.w, true);
    assert.equal(plan.surfaces.rootDrawer.x + plan.surfaces.rootDrawer.w <= plan.rightRail.x - plan.gap, true);
    assert.equal(plan.scroll.leftRail.pointerType, 'touch');
    assert.equal(plan.scroll.leftRail.enabled, false);
    assert.equal(plan.scroll.compactCommandRail.pointerType, 'touch');
    assert.equal(plan.scroll.compactCommandRail.enabled, false);
    assert.equal(plan.scroll.rootDrawer.pointerType, 'touch');
    assert.equal(plan.scroll.rightRail.pointerType, 'touch');
    assert.equal(plan.scroll.bottomRail.pointerType, 'touch');
  }
});

test('landscape touch editors use left command/root surfaces and suppress desktop and gamepad chrome', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const plan = buildLandscapeTouchEditorShellPlan(editorId, {
      viewportWidth: 844,
      viewportHeight: 390,
      bottomRailHeight: 68,
      reserveRightRail: true,
      reserveThumbstickSpace: false
    });
    const actions = buildCompactLandscapeCommandRailActions({
      menu: { id: 'menu' },
      undo: { id: 'undo' },
      redo: { id: 'redo' },
      quick: { id: `${editorId}-context` }
    });

    assert.deepEqual(actions.map((action) => action.slot), ['menu', 'undo', 'redo', 'quick'], `${editorId} command slots`);
    assert.equal(actions.length, COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT, `${editorId} command action count`);
    actions.forEach((action) => {
      assert.equal(action.surface, EDITOR_SURFACES.leftRail, `${editorId} command rail action surface`);
      assert.equal(action.rowActivation, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.rowActivation, `${editorId} command rail activation`);
      assert.equal(action.gestureScroll, false, `${editorId} command rail scroll`);
    });

    assert.equal(plan.mode, EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH, `${editorId} mode`);
    assert.equal(plan.compactCommandRailSurface, EDITOR_SURFACES.leftRail, `${editorId} compact command rail`);
    assert.equal(plan.rootMenuSurface, EDITOR_SURFACES.leftRail, `${editorId} root menu surface`);
    assert.equal(plan.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer, `${editorId} root drawer surface`);
    assert.equal(plan.rootDrawerOverlayOrigin, 'left', `${editorId} root drawer origin`);
    assert.equal(plan.submenuSurface, EDITOR_SURFACES.rightDrawer, `${editorId} submenu surface`);
    assert.equal(plan.bottomRailRole, LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.bottomRailRole, `${editorId} bottom rail role`);
    assert.deepEqual(plan.surfaces.compactCommandRail, plan.leftRail, `${editorId} compact rail bounds`);
    assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail, `${editorId} root rail bounds`);
    assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer, `${editorId} left root drawer bounds`);
    assert.deepEqual(plan.surfaces.submenu, plan.rightRail, `${editorId} right submenu bounds`);
    assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail, `${editorId} bottom context bounds`);
    assert.equal(plan.surfaces.rootDrawer.x >= plan.leftRail.x + plan.leftRail.w, true, `${editorId} root drawer starts after left rail`);
    assert.equal(plan.surfaces.rootDrawer.x + plan.surfaces.rootDrawer.w <= plan.rightRail.x - plan.gap, true, `${editorId} root drawer leaves right drill-down visible`);
    assert.equal(plan.surfaces.submenu.x >= plan.bounds.w - plan.surfaces.submenu.w, true, `${editorId} submenu is right anchored`);
    assert.equal(plan.interaction.pointerType, 'touch', `${editorId} pointer type`);
    assert.equal(plan.interaction.rowActivation, 'tap-release', `${editorId} row activation`);

    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.leftRail), true, `${editorId} left rail visible`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.leftOverlayDrawer), true, `${editorId} left root drawer visible`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.rightDrawer), true, `${editorId} right submenu visible`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.bottomToolRail), true, `${editorId} bottom rail visible`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.desktopTopMenu), false, `${editorId} desktop top suppressed`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.desktopDropdown), false, `${editorId} desktop dropdown suppressed`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.desktopLeftInspector), false, `${editorId} desktop inspector suppressed`);
    assert.equal(canRenderEditorPlanSurface(plan, EDITOR_SURFACES.gamepadSlideOut), false, `${editorId} gamepad slide-out suppressed`);
  }
});

test('landscape touch shell omits the right submenu surface when gamepad slide-out owns submenus', () => {
  const plan = buildLandscapeTouchEditorShellPlan('level', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 72,
    reserveRightRail: false
  });

  assert.equal(plan.rootMenuSurface, EDITOR_SURFACES.leftRail);
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.compactCommandRailSurface, EDITOR_SURFACES.leftRail);
  assert.equal(plan.compactCommandRailActionLimit, 4);
  assert.equal(plan.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer);
  assert.equal(plan.rootDrawerOverlayOrigin, 'left');
  assert.equal(plan.surfaces.submenu, null);
  assert.ok(plan.surfaces.overlayDrawer);
  assert.deepEqual(plan.surfaces.compactCommandRail, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
  assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail);
  assert.deepEqual(plan.surfaces.zoom, plan.bottomRail);
  assert.deepEqual(plan.surfaces.ribbon, plan.bottomRail);
  assert.equal(plan.rightRail.w, 0);
  assert.equal(plan.surfaces.rootDrawer.x >= plan.leftRail.x + plan.leftRail.w, true);
  assert.equal(plan.surfaces.rootDrawer.x < plan.bounds.w / 2, true);
  assert.ok(plan.surfaces.rootDrawer.h <= plan.bottomRail.y);
  assert.ok(plan.surfaces.rootDrawer.y + plan.surfaces.rootDrawer.h <= plan.bottomRail.y);
  assert.equal(plan.surfaceVisibility[EDITOR_SURFACES.rightDrawer], 'required');
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.rightDrawer], 'suppressed');
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.landscapeRightSubmenu], 'suppressed');
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.leftOverlayDrawer], 'required');
  assert.deepEqual(plan.effectiveSurfaceVisibility, getLandscapeTouchShellEffectiveSurfaceVisibility({
    reserveRightRail: false,
    rootDrawerOverlayOrigin: 'left',
    bottomRailHeight: 72
  }));
});

test('landscape touch shell can originate root drawers from the compact left rail', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 78,
    reserveRightRail: false,
    reserveThumbstickSpace: false,
    rootDrawerOverlayOrigin: 'left'
  });

  assert.equal(plan.rootMenuSurface, EDITOR_SURFACES.leftRail);
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer);
  assert.equal(plan.rootDrawerOverlayOrigin, 'left');
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
  assert.notDeepEqual(plan.surfaces.rootDrawer, plan.surfaces.overlayDrawer);
  assert.equal(plan.surfaces.rootDrawer.x >= plan.leftRail.x + plan.leftRail.w, true);
  assert.equal(plan.surfaces.rootDrawer.x < plan.bounds.w / 2, true);
  assert.equal(plan.surfaces.overlayDrawer.x + plan.surfaces.overlayDrawer.w, plan.bounds.w);
  assert.ok(plan.surfaces.rootDrawer.y + plan.surfaces.rootDrawer.h <= plan.bottomRail.y);
});

test('landscape touch shell coerces stale right-origin root drawers back to the left', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 78,
    reserveRightRail: false,
    reserveThumbstickSpace: false,
    rootDrawerOverlayOrigin: 'right'
  });

  assert.equal(plan.rootMenuSurface, EDITOR_SURFACES.leftRail);
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer);
  assert.equal(plan.rootDrawerOverlayOrigin, 'left');
  assert.equal(plan.presentation.rootDrawerOverlayOrigin, 'left');
  assert.equal(plan.presentation.rootDrawerSurface, EDITOR_SURFACES.leftOverlayDrawer);
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.leftOverlayDrawer], 'required');
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.rightOverlayDrawer], 'optional');
  assert.equal(plan.effectiveSurfaceVisibility[EDITOR_SURFACES.rightDrawer], 'suppressed');
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
  assert.notDeepEqual(plan.surfaces.rootDrawer, plan.surfaces.overlayDrawer);
  assert.equal(plan.surfaces.overlayDrawer.x + plan.surfaces.overlayDrawer.w, plan.bounds.w);
  assert.ok(plan.surfaces.rootDrawer.y + plan.surfaces.rootDrawer.h <= plan.bottomRail.y);
});

test('gamepad slide-out plan keeps root open until a submenu is selected', () => {
  const root = buildGamepadSlideOutMenuPlan('sfx', {
    rootOpen: true,
    activeRootId: 'timeline'
  });

  assert.equal(root.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.equal(root.rootMenuSurface, 'left-slide-rail');
  assert.equal(root.submenuSurface, 'left-slide-out-drawer');
  assert.equal(root.submenuReplacesRootRail, true);
  assert.equal(root.rightSubmenuSurface, null);
  assert.deepEqual(root.controls, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls);
  assert.deepEqual(root.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.equal(root.interaction.rowActivation, 'confirm-button');
  assert.equal(root.interaction.pointerType, 'controller');
  assert.equal(root.interaction.gestureScroll, true);
  assert.deepEqual(root.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.deepEqual(root.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.deepEqual(root.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.GAMEPAD));
  assert.equal(root.surfaceVisibility['left-slide-out-drawer'], 'required');
  assert.equal(root.surfaceVisibility['landscape-right-submenu'], 'suppressed');
  assert.deepEqual(root.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
  assert.deepEqual(root.suppressedTouchSurfaces, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.suppressedTouchSurfaces);
  assert.equal(root.rootCollapsed, false);
  assert.equal(root.submenu, null);
  assert.equal(root.controls.confirm, 'A');
  assert.equal(root.controls.back, 'B');
  assert.equal(root.controls.system, 'Start');
  assert.equal(root.controls.focusToggle, 'Back');
  assert.equal(root.controls.siblingPrev, 'LB');
  assert.equal(root.controls.siblingNext, 'RB');
  assert.equal(root.headerHint, 'A Select  B Back  LB/RB Tabs  Start System');

  const submenu = buildGamepadSlideOutMenuPlan('sfx', {
    rootOpen: false,
    activeRootId: 'timeline',
    focusedItemId: 'play'
  });
  assert.equal(submenu.rootCollapsed, true);
  assert.equal(submenu.activeRootId, 'timeline');
  assert.equal(submenu.activeSpecId, 'timeline');
  assert.equal(submenu.focusedItemId, 'play');
  assert.equal(submenu.focusedSubmenuItem.id, 'play');
  assert.equal(submenu.focus.surface, 'submenu');
  assert.equal(submenu.focus.submenuItemId, 'play');
  assert.deepEqual(submenu.submenu.items.map((item) => item.id), ['play', 'stop', 'start', 'end']);
  assert.equal(submenu.submenu.surface, 'left-slide-out-drawer');
  assert.equal(submenu.submenu.sourceSurface, 'gamepad-slide-out');
  assert.equal(submenu.submenu.replacesRootRail, true);
  assert.equal(submenu.submenu.rightSubmenuSurface, null);
  assert.equal(submenu.submenu.rowActivation, 'confirm-button');
  assert.equal(submenu.submenu.pointerType, 'controller');
  assert.equal(submenu.submenu.gestureScroll, true);
  assert.equal(submenu.scroll.submenu.thresholdPx, 8);
  assert.equal(submenu.scroll.submenu.pointerType, 'controller');
  assert.equal(submenu.scroll.submenu.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
});

test('gamepad slide-out plan exposes focused root and submenu metadata', () => {
  const root = buildGamepadSlideOutMenuPlan('pixel', {
    rootOpen: true,
    activeRootId: 'draw',
    focusedItemId: 'tools'
  });
  assert.equal(root.focus.surface, 'root');
  assert.equal(root.focusedRootEntry.id, 'tools');
  assert.equal(root.focus.rootItemId, 'tools');
  assert.equal(root.focus.submenuItemId, null);

  const submenu = buildGamepadSlideOutMenuPlan('cutscene', {
    rootOpen: false,
    activeRootId: 'timeline',
    focusedItemId: 'play'
  });
  assert.equal(submenu.focus.surface, 'submenu');
  assert.equal(submenu.focusedRootEntry, null);
  assert.equal(submenu.focusedSubmenuItem.id, 'play');
  assert.equal(submenu.focus.submenuItemId, 'play');
});

test('gamepad slide-out role contract is shared across every editor', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const root = buildGamepadSlideOutMenuPlan(editorId, {
      rootOpen: true,
      activeRootId: 'file'
    });
    const submenu = buildGamepadSlideOutMenuPlan(editorId, {
      rootOpen: false,
      activeRootId: 'file'
    });

    assert.equal(root.rootMenuSurface, 'left-slide-rail');
    assert.equal(root.submenuSurface, 'left-slide-out-drawer');
    assert.equal(root.submenuReplacesRootRail, true);
    assert.equal(root.rightSubmenuSurface, null);
    assert.deepEqual(root.controls, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls);
    assert.deepEqual(root.presentation, submenu.presentation);
    assert.equal(root.presentation.submenuSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface);
    assert.equal(root.presentation.submenuReplacesRootRail, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail);
    assert.equal(root.interaction.confirm, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.confirm);
    assert.equal(root.interaction.back, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.back);
    assert.equal(root.interaction.rowActivation, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation);
    assert.equal(root.interaction.pointerType, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType);
    assert.deepEqual(root.focusRingContract, GAMEPAD_FOCUS_RING_CONTRACT);
    assert.deepEqual(root.focus.focusRingContract, GAMEPAD_FOCUS_RING_CONTRACT);
    assert.deepEqual(submenu.focusRingContract, GAMEPAD_FOCUS_RING_CONTRACT);
    assert.ok(submenu.focusedSubmenuItem?.id, `${editorId} gamepad submenu should default to a focused row`);
    assert.equal(submenu.submenu.items.some((item) => item.focused && item.focusRing), true, `${editorId} gamepad submenu should render one focused row`);
    assert.equal(submenu.focus.submenuItemId, submenu.focusedSubmenuItem.id, `${editorId} gamepad submenu focus id should match the focused row`);
    assert.equal(root.focusRingContract.visibleOnFocusedRows, true);
    assert.deepEqual(root.focusRingContract.surfaces, [GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface]);
    assert.equal(root.scroll.root.pointerType, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType);
    assert.equal(submenu.scroll.submenu.pointerType, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType);
    assert.deepEqual(root.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(root.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(root.surfaceVisibility, getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.GAMEPAD));
    assert.deepEqual(submenu.surfaceVisibility, root.surfaceVisibility);
    assert.deepEqual(root.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
    assert.deepEqual(submenu.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
    assert.deepEqual(root.suppressedTouchSurfaces, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.suppressedTouchSurfaces);
    const genericGamepad = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 844,
      viewportHeight: 390,
      gamepadConnected: true
    });
    assert.deepEqual(root.presentation, genericGamepad.presentation);
    assert.equal(root.interaction.rowActivation, genericGamepad.interaction.rowActivation);
    assert.equal(root.interaction.pointerType, genericGamepad.interaction.pointerType);
    assert.equal(root.interaction.gestureScroll, genericGamepad.interaction.gestureScroll);
    assert.deepEqual(submenu.suppressedTouchSurfaces, root.suppressedTouchSurfaces);
    assert.equal(root.rootCollapsed, false);
    assert.equal(submenu.rootCollapsed, true);
    assert.ok(submenu.submenu.items.length > 0);
    assert.equal(submenu.submenu.surface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface);
    assert.equal(submenu.submenu.sourceSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface);
    assert.equal(submenu.submenu.replacesRootRail, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail);
    assert.equal(submenu.submenu.pointerType, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType);
    assert.equal(root.rootEntries.every((entry) => entry.rowActivation === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation), true, `${editorId} root activation`);
    assert.equal(root.rootEntries.every((entry) => entry.pointerType === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType), true, `${editorId} root pointer`);
    assert.equal(root.rootEntries.every((entry) => entry.sourceSurface === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface), true, `${editorId} root source`);
    assert.equal(root.rootEntries.every((entry) => entry.surface === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface), true, `${editorId} root surface`);
    assert.equal(submenu.submenu.items.every((item) => item.rowActivation === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation), true, `${editorId} submenu activation`);
    assert.equal(submenu.submenu.items.every((item) => item.pointerType === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType), true, `${editorId} submenu pointer`);
    assert.equal(submenu.submenu.items.every((item) => item.sourceSurface === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface), true, `${editorId} submenu source`);
    assert.equal(submenu.submenu.items.every((item) => item.surface === GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface), true, `${editorId} submenu surface`);
    assert.equal(submenu.submenu.items.every((item) => 'focused' in item && 'focusRing' in item), true, `${editorId} submenu focus metadata`);
  }
});

test('gamepad editors use left slide-out navigation and suppress touch and desktop menu surfaces', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const root = buildGamepadSlideOutMenuPlan(editorId, {
      rootOpen: true,
      activeRootId: 'file',
      focusedItemId: 'file'
    });
    const submenu = buildGamepadSlideOutMenuPlan(editorId, {
      rootOpen: false,
      activeRootId: 'file'
    });
    const layout = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 844,
      viewportHeight: 390,
      gamepadConnected: true
    });

    assert.equal(layout.mode, EDITOR_LAYOUT_MODES.GAMEPAD, `${editorId} layout mode`);
    assert.equal(root.rootMenuSurface, EDITOR_SURFACES.leftSlideRail, `${editorId} root rail`);
    assert.equal(root.submenuSurface, EDITOR_SURFACES.leftSlideOutDrawer, `${editorId} submenu drawer`);
    assert.equal(submenu.submenu?.surface, EDITOR_SURFACES.leftSlideOutDrawer, `${editorId} submenu surface`);
    assert.equal(submenu.submenu?.rightSubmenuSurface, null, `${editorId} right submenu suppressed`);
    assert.equal(root.submenuReplacesRootRail, true, `${editorId} submenu replaces root`);
    assert.equal(root.rootCollapsed, false, `${editorId} root remains visible before select`);
    assert.equal(submenu.rootCollapsed, true, `${editorId} root collapses after select`);
    assert.equal(root.interaction.pointerType, 'controller', `${editorId} pointer`);
    assert.equal(root.interaction.rowActivation, 'confirm-button', `${editorId} activation`);
    assert.equal(root.controls.confirm, 'A', `${editorId} confirm`);
    assert.equal(root.controls.back, 'B', `${editorId} back`);
    assert.equal(root.controls.siblingPrev, 'LB', `${editorId} previous root`);
    assert.equal(root.controls.siblingNext, 'RB', `${editorId} next root`);
    assert.equal(root.focusRingContract.visibleOnFocusedRows, true, `${editorId} visible focus rings`);
    assert.equal(root.rootEntries.some((entry) => entry.focused && entry.focusRing), true, `${editorId} focused root row`);
    assert.equal(submenu.submenu.items.some((item) => item.focused && item.focusRing), true, `${editorId} focused submenu row`);
    assert.equal(root.surfaceVisibility[EDITOR_SURFACES.touchThumbstick], 'suppressed', `${editorId} touch thumbstick suppressed`);
    assert.equal(root.surfaceVisibility[EDITOR_SURFACES.landscapeRightSubmenu], 'suppressed', `${editorId} landscape right submenu suppressed`);
    assert.equal(root.surfaceVisibility[EDITOR_SURFACES.desktopTopMenu], 'suppressed', `${editorId} desktop top suppressed`);
    assert.equal(root.surfaceVisibility[EDITOR_SURFACES.desktopDropdown], 'suppressed', `${editorId} desktop dropdown suppressed`);
    assert.equal(root.surfaceVisibility[EDITOR_SURFACES.rightDrawer], 'suppressed', `${editorId} right drawer suppressed`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.touchThumbstick), false, `${editorId} no virtual thumbstick`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.rightDrawer), false, `${editorId} no touch right drawer`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.landscapeRightSubmenu), false, `${editorId} no touch drilldown`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.desktopTopMenu), false, `${editorId} no desktop top menu`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.desktopDropdown), false, `${editorId} no desktop dropdown`);
    assert.equal(canRenderEditorPlanSurface(root, EDITOR_SURFACES.leftSlideOutDrawer), true, `${editorId} slide-out visible`);
  }
});

test('gamepad slide-out plan annotates focused root and submenu rows for visible focus rings', () => {
  const root = buildGamepadSlideOutMenuPlan('pixel', {
    rootOpen: true,
    activeRootId: 'file',
    focusedItemId: 'draw'
  });
  const focusedRoot = root.rootEntries.find((entry) => entry.specId === 'draw');
  const unfocusedRoot = root.rootEntries.find((entry) => entry.specId === 'file');

  assert.equal(focusedRoot.focused, true);
  assert.equal(focusedRoot.focusRing, true);
  assert.equal(root.focus.rootItemId, focusedRoot.id);
  assert.equal(unfocusedRoot.focused, false);
  assert.equal(unfocusedRoot.focusRing, false);

  const submenu = buildGamepadSlideOutMenuPlan('pixel', {
    rootOpen: false,
    activeRootId: 'draw',
    focusedItemId: 'brush'
  });
  const focusedItem = submenu.submenu.items.find((item) => item.id === 'brush');
  const unfocusedItem = submenu.submenu.items.find((item) => item.id === 'pencil');

  assert.equal(focusedItem.focused, true);
  assert.equal(focusedItem.focusRing, true);
  assert.equal(submenu.focus.submenuItemId, 'brush');
  assert.equal(unfocusedItem.focused, false);
  assert.equal(unfocusedItem.focusRing, false);
  assert.equal(submenu.submenu.items.every((item) => 'focusRing' in item), true);
});

test('gamepad slide-out plan uses controller root entry submenu ids', () => {
  const pixel = buildGamepadSlideOutMenuPlan('pixel', {
    rootOpen: true,
    activeRootId: 'animation'
  });
  const pixelFrames = pixel.rootEntries.find((entry) => entry.specId === 'frames');
  const pixelRigging = pixel.rootEntries.find((entry) => entry.specId === 'rigging');
  assert.deepEqual(
    [pixelFrames?.id, pixelFrames?.controllerMenuId, pixelRigging?.id, pixelRigging?.controllerMenuId],
    ['animation', 'frames', 'bones', 'bones']
  );
  assert.equal(pixel.activeRootId, 'animation');
  assert.equal(pixel.activeSpecId, 'frames');

  const level = buildGamepadSlideOutMenuPlan('level', {
    rootOpen: true,
    activeRootId: 'pixels'
  });
  const levelTileArt = level.rootEntries.find((entry) => entry.specId === 'tile-art');
  assert.deepEqual(
    [levelTileArt?.id, levelTileArt?.controllerMenuId, level.activeRootId, level.activeSpecId],
    ['pixels', 'pixels', 'pixels', 'tile-art']
  );

  const midi = buildGamepadSlideOutMenuPlan('midi', {
    rootOpen: true,
    activeRootId: 'instruments'
  });
  const midiTracks = midi.rootEntries.find((entry) => entry.specId === 'tracks');
  assert.deepEqual(
    [midiTracks?.id, midiTracks?.controllerMenuId, midi.activeRootId, midi.activeSpecId],
    ['instruments', 'tracks', 'instruments', 'tracks']
  );

  const tile = buildGamepadSlideOutMenuPlan('tile', {
    rootOpen: false,
    activeRootId: 'tiles'
  });
  assert.equal(tile.submenuReplacesRootRail, true);
  assert.equal(tile.rightSubmenuSurface, null);
  assert.equal(tile.submenu.surface, 'left-slide-out-drawer');
  assert.equal(tile.submenu.sourceSurface, 'gamepad-slide-out');
  assert.deepEqual(
    [tile.activeRootId, tile.activeSpecId, tile.submenu.specId],
    ['tiles', 'tiles', 'tiles']
  );
});

test('pointer interaction policy separates desktop mouse from touch gestures', () => {
  const desktopPixel = getEditorPointerInteractionPolicy('pixel', {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    pointerType: 'mouse'
  });

  assert.equal(desktopPixel.workSurface, 'canvas');
  assert.equal(desktopPixel.workSurfaceGestures.wheelZoom, true);
  assert.equal(desktopPixel.workSurfaceGestures.rightDragPan, true);
  assert.equal(desktopPixel.rightClick.opensContextMenu, true);
  assert.equal(desktopPixel.rightClick.suppressBrowserMenu, true);
  assert.equal(desktopPixel.thumbstick.allowed, false);

  const landscapeSfx = getEditorPointerInteractionPolicy('sfx', {
    mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    pointerType: 'touch'
  });
  assert.equal(landscapeSfx.workSurface, 'timeline');
  assert.equal(landscapeSfx.workSurfaceGestures.pinchZoom, true);
  assert.equal(landscapeSfx.menuScroll.suppressClickAfterDrag, true);
  assert.equal(landscapeSfx.thumbstick.showForMenus, false);
  assert.equal(landscapeSfx.thumbstick.avoidMenuOverlap, true);

  const portraitActor = getEditorPointerInteractionPolicy('actor', {
    mode: EDITOR_LAYOUT_MODES.PORTRAIT,
    pointerType: 'touch'
  });
  assert.equal(portraitActor.thumbstick.allowed, true);
  assert.equal(portraitActor.thumbstick.showForWorkSurface, true);
});

test('desktop pointer policy treats every editor work surface as an app surface', () => {
  const editors = ALL_EDITOR_IDS;
  assert.equal(editorMenuLayoutSource.includes('const CONTINUOUS_PAN_EDITOR_IDS = new Set(SHARED_EDITOR_IDS);'), true);
  assert.equal(editorMenuLayoutSource.includes('const FALLBACK_PAN_EDITOR_IDS = new Set(SHARED_EDITOR_IDS);'), true);
  assert.equal(editorMenuLayoutSource.includes('const DESKTOP_CONTEXT_MENU_EDITOR_IDS = new Set(SHARED_EDITOR_IDS);'), true);
  assert.equal(editorMenuLayoutSource.includes('const WORK_SURFACE_TYPES = {'), false);
  assert.equal(editorMenuLayoutSource.includes('getEditorWorkSurfaceType(editorId)'), true);
  assert.equal(editorMenuLayoutSource.includes("new Set(['pixel', 'tile', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car'])"), false);
  editors.forEach((editorId) => {
    const policy = getEditorPointerInteractionPolicy(editorId, {
      mode: EDITOR_LAYOUT_MODES.DESKTOP,
      pointerType: 'mouse'
    });

    assert.equal(policy.workSurfaceGestures.wheelZoom, true, `${editorId} wheel zoom`);
    assert.equal(policy.workSurfaceGestures.middleDragPan, true, `${editorId} middle-drag pan`);
    assert.equal(policy.workSurfaceGestures.rightDragPan, true, `${editorId} right-drag pan`);
    assert.equal(policy.rightClick.suppressBrowserMenu, true, `${editorId} suppress browser menu`);
    assert.equal(policy.rightClick.opensContextMenu, true, `${editorId} context menu availability`);
    assert.equal(policy.rightClick.fallbackPan, true, `${editorId} fallback pan`);
    assert.equal(policy.thumbstick.allowed, false, `${editorId} desktop thumbstick hidden`);
  });
});

test('shared context-menu suppression follows the editor pointer policy', () => {
  ALL_EDITOR_IDS.forEach((editorId) => {
    assert.equal(shouldSuppressEditorContextMenu({
      editorId,
      mode: EDITOR_LAYOUT_MODES.DESKTOP,
      pointerType: 'mouse'
    }), true, editorId);
  });
  assert.equal(shouldSuppressEditorContextMenu({
    editorId: 'level',
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    pointerType: 'gamepad',
    gamepadConnected: true
  }), true);
});

test('gamepad pointer policy enables work surface pan without changing menu controls', () => {
  const gamepadLevel = getEditorPointerInteractionPolicy('level', {
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    pointerType: 'gamepad',
    gamepadConnected: true
  });

  assert.equal(gamepadLevel.workSurfaceGestures.dragPan, true);
  assert.equal(gamepadLevel.thumbstick.allowed, true);
  assert.equal(gamepadLevel.thumbstick.showForWorkSurface, true);
  assert.equal(gamepadLevel.thumbstick.showForMenus, false);
  assert.equal(gamepadLevel.rightClick.opensContextMenu, false);
});
