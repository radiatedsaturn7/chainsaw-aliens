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
  createDesktopDropdownCommandHit,
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
  getEditorModePresentationInteractionContract,
  resolveMenuWheelScroll,
  resolveMenuScrollDrag,
  resolveEditorLayoutMode,
  MODE_INTERACTION_CONTRACTS,
  MODE_PRESENTATION_CONTRACTS,
  REQUIRED_MODE_SURFACES,
  SUPPRESSED_MODE_SURFACES,
  validateEditorModePresentationInteractionContracts,
  validateEditorModeSurfaceContracts,
  resolveOpenDesktopDropdownState,
  resolvePendingDesktopDropdownHit,
  shouldCloseDesktopDropdownOnDomPointerDown,
  shouldSuppressEditorContextMenu,
  shouldUseGamepadSlideOutMenu,
  updatePendingDesktopDropdownHit
} from '../../src/ui/shared/editorMenuLayout.js';
import { EDITOR_LAYOUT_MODES, getEditorMenuSection, getEditorRootMenuEntries } from '../../src/ui/shared/editorMenuSpec.js';
import { drawSharedDesktopDropdown } from '../../src/ui/uiSuite.js';

const ALL_EDITOR_IDS = ['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car'];
const uiSpecSource = readFileSync(new URL('../../UISpec.md', import.meta.url), 'utf8');
const editorUiContractSource = readFileSync(new URL('../../ui/EDITORS_UI_CONTRACT.md', import.meta.url), 'utf8');
const canvasEditorDesktopDropdownSources = {
  pixel: readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8'),
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
  assert.equal(uiSpecSource.includes('Root menu drawers start closed, drop down only from explicit top-menu interaction'), true);
  assert.equal(uiSpecSource.includes('Opening a desktop drawer records shared `openedAtMs` timing'), true);
  assert.equal(uiSpecSource.includes('pass the live dropdown state into `buildDesktopDropdownRenderPlan()`'), true);
  assert.equal(uiSpecSource.includes('Clicking away closes the open drawer and it must stay closed on redraw'), true);
  assert.equal(uiSpecSource.includes('Every editor File drawer starts with the same desktop baseline order: New, Save, Save As, Open, Export, Import.'), true);
  assert.equal(uiSpecSource.includes('Every editor Edit drawer starts with Undo and Redo, then editor-specific edit actions'), true);
  assert.equal(uiSpecSource.includes('Unsupported baseline actions should remain visible as disabled rows'), true);
  assert.equal(uiSpecSource.includes('Desktop left context panels should use contextual language such as `Active`, not `Menu`'), true);
  assert.equal(editorUiContractSource.includes("commandSurfaces: ['top-dropdown']"), true);
  assert.equal(editorUiContractSource.includes('Desktop dropdown drawers start closed.'), true);
  assert.equal(editorUiContractSource.includes('Shared desktop dropdown state owns `openedAtMs`'), true);
  assert.equal(editorUiContractSource.includes('resolveDesktopDropdownState({ previousDropdown })'), true);
  assert.equal(editorUiContractSource.includes('so `slide-down` motion progress is driven by shared state'), true);
  assert.equal(editorUiContractSource.includes('Editors must not pass the active panel, active tool, selected tab, or selected document context as the default open dropdown root.'), true);
  assert.equal(editorUiContractSource.includes('Click-away state must survive the next draw'), true);
  assert.equal(editorUiContractSource.includes('File dropdown drawers must begin with the shared baseline row order `New`, `Save`, `Save As`, `Open`, `Export`, `Import`.'), true);
  assert.equal(editorUiContractSource.includes('Edit dropdown drawers must begin with the shared history row order `Undo`, `Redo`'), true);
  assert.equal(editorUiContractSource.includes('Unsupported baseline actions stay visible as disabled rows with inert hit targets.'), true);
  assert.equal(editorUiContractSource.includes('**Race Editor**, and **Car Editor**'), true);
  assert.equal(editorUiContractSource.includes("persistentSurfaces: ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']"), true);
  assert.equal(editorUiContractSource.includes('suppressedMobileSurfaces'), true);
  assert.equal(editorUiContractSource.includes('`gamepad-slide-out` so desktop cannot accidentally render mobile or controller chrome.'), true);
  assert.equal(editorUiContractSource.includes('surfaceRoles.desktopMobileRailsHidden'), true);
  assert.equal(editorUiContractSource.includes('Desktop must set `desktopMobileRailsHidden` to `true`.'), true);
  assert.equal(editorUiContractSource.includes('modeSurfaces.compactCommandRail'), true);
  assert.equal(editorUiContractSource.includes('surfaceRoles.persistentNavigationActionLimit: 4'), true);
  assert.equal(uiSpecSource.includes('Editors may opt the full root drawer to a right overlay or work-surface overlay'), false);
  assert.equal(editorUiContractSource.includes('Editors may opt into `right-overlay-drawer` or a work-surface overlay'), false);
  assert.equal(uiSpecSource.includes('The root drawer should originate from the compact left rail by default'), true);
  assert.equal(editorUiContractSource.includes('It originates from the compact left rail as `left-overlay-drawer` by default'), true);
  assert.equal(uiSpecSource.includes("Bridge Actor Editor's DOM UI into the shared spec."), false);
  assert.equal(uiSpecSource.includes("Keep Actor Editor's DOM UI covered by the same shared desktop, landscape, portrait, and gamepad contracts as the canvas editors."), true);
});

test('desktop dropdown rows expose command metadata for release activation across editors', () => {
  Object.entries(editorDesktopDropdownSources).forEach(([editorId, source]) => {
    assert.equal(
      source.includes('desktopDropdownItem: true')
        || source.includes("btn.dataset.desktopDropdownItem = 'true'")
        || source.includes('createDesktopDropdownCommandHit('),
      true,
      `${editorId} should mark desktop dropdown rows`
    );
    assert.equal(
      source.includes('id: item.id')
        || source.includes('btn.dataset.actionId = action.id')
        || source.includes('createDesktopDropdownCommandHit('),
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
  const hit = createDesktopDropdownCommandHit({ id: 'new' }, { x: 10, y: 20, w: 90, h: 30 }, action);

  assert.equal(hit.id, 'new');
  assert.deepEqual(hit.bounds, { x: 10, y: 20, w: 90, h: 30, id: 'new' });
  assert.equal(hit.desktopDropdownItem, true);
  assert.equal(hit.kind, 'desktop-dropdown-item');
  assert.equal(hit.action, action);
  assert.equal(hit.onClick, action);
  hit.action();
  assert.equal(fired, 1);
});

test('compatible canvas editors use the shared desktop dropdown command hit helper', () => {
  ['midi', 'sfx', 'cutscene', 'race', 'car'].forEach((editorId) => {
    assert.equal(
      canvasEditorDesktopDropdownSources[editorId].includes('createDesktopDropdownCommandHit('),
      true,
      `${editorId} should use the shared dropdown hit helper`
    );
  });
});

test('Actor desktop DOM dropdown rows expose shared dataset command metadata', () => {
  assert.equal(actorEditorSource.includes('btn.dataset.actionId = action.id'), true);
  assert.equal(actorEditorSource.includes('btn.dataset.sourceId = action.sourceId || action.id'), true);
  assert.equal(actorEditorSource.includes("btn.dataset.desktopDropdownItem = 'true'"), true);
});

test('main editor renderer entry points retain the shared viewport mode contract', () => {
  for (const [editorId, source] of Object.entries(editorDesktopDropdownSources)) {
    assert.equal(
      source.includes('this.activeModeContract = viewportMode.modeContract;'),
      true,
      `${editorId} renderer should retain viewportMode.modeContract before mode-specific branches`
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
    root: 'bottom-rail',
    submenu: 'bottom-sheet',
    settings: 'top-context'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH), {
    root: 'left-rail',
    submenu: 'right-drawer',
    settings: 'right-drawer'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.DESKTOP), {
    root: 'top-menu',
    submenu: 'dropdown',
    settings: 'left-panel'
  });
  assert.deepEqual(getEditorMenuPlacement(EDITOR_LAYOUT_MODES.GAMEPAD), {
    root: 'left-slide-rail',
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer'
  });
});

test('editor menu layout plan exposes mode-specific behavior flags', () => {
  const desktop = buildEditorMenuLayoutPlan('pixel', { isMobile: false, viewportWidth: 1280, viewportHeight: 800 });
  assert.equal(desktop.mode, EDITOR_LAYOUT_MODES.DESKTOP);
  assert.deepEqual(desktop.modeSurfaces, {
    rootMenu: 'top-menu',
    compactCommandRail: null,
    rootDrawer: null,
    submenu: 'dropdown',
    settings: 'left-panel',
    primaryActions: null,
    gestureScroll: false,
    rootDrawerKeepsSubmenuVisible: false
  });
  assert.equal(desktop.desktop.usesTopMenu, true);
  assert.equal(desktop.desktop.showPersistentLeftOptions, true);
  assert.equal(desktop.desktop.commandSurface, 'top-dropdown');
  assert.equal(desktop.desktop.leftPanelRole, 'context-inspector');
  assert.equal(desktop.desktop.duplicatesCommandsInLeftPanel, false);
  assert.deepEqual(desktop.surfaceRoles, {
    commandSurface: 'top-dropdown',
    persistentContextSurface: 'left-panel',
    persistentNavigationSurface: 'top-menu',
    duplicatesCommandsInPersistentContext: false,
    desktopMobileRailsHidden: true,
    persistentNavigationActionLimit: null
  });
  assert.equal(desktop.touch.usesBottomMenus, false);
  assert.ok(desktop.rootIds.includes('layers'));

  const gamepad = buildEditorMenuLayoutPlan('level', { isMobile: true, viewportWidth: 844, viewportHeight: 390, gamepadConnected: true });
  assert.equal(gamepad.mode, EDITOR_LAYOUT_MODES.GAMEPAD);
  assert.deepEqual(gamepad.modeSurfaces, {
    rootMenu: 'left-slide-rail',
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
  assert.equal(gamepad.gamepad.rootCollapsesAfterSelect, true);
  assert.equal(gamepad.gamepad.rootSurface, 'left-slide-rail');
  assert.equal(gamepad.gamepad.submenuSurface, 'left-slide-out-drawer');
  assert.equal(gamepad.gamepad.submenuReplacesRoot, true);
  assert.equal(gamepad.gamepad.confirm, 'A');
  assert.equal(gamepad.gamepad.back, 'B');
  assert.equal(gamepad.touch.usesSideRails, false);
  assert.deepEqual(gamepad.surfaceRoles, {
    commandSurface: 'left-slide-out-drawer',
    persistentContextSurface: 'work-surface-overlay',
    persistentNavigationSurface: 'left-slide-rail',
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
  assert.equal(landscape.modeSurfaces.rootMenu, 'left-rail');
  assert.equal(landscape.modeSurfaces.compactCommandRail, 'left-rail');
  assert.equal(landscape.modeSurfaces.rootDrawer, 'left-overlay-drawer');
  assert.equal(landscape.modeSurfaces.submenu, 'right-drawer');
  assert.equal(landscape.modeSurfaces.rootDrawerKeepsSubmenuVisible, true);
  assert.equal(landscape.surfaceRoles.commandSurface, 'right-drawer');
  assert.equal(landscape.surfaceRoles.persistentNavigationActionLimit, 4);
  assert.equal(uiSpecSource.includes('modeSurfaces.rootDrawerKeepsSubmenuVisible: true'), true);
  assert.equal(editorUiContractSource.includes('modeSurfaces.rootDrawerKeepsSubmenuVisible'), true);
});

test('portrait menu layout plan keeps roots and submenus bottom-first across every editor', () => {
  for (const editorId of ALL_EDITOR_IDS) {
    const plan = buildEditorMenuLayoutPlan(editorId, {
      isMobile: true,
      viewportWidth: 390,
      viewportHeight: 844
    });

    assert.equal(plan.mode, EDITOR_LAYOUT_MODES.PORTRAIT);
    assert.equal(plan.modeSurfaces.rootMenu, 'bottom-rail');
    assert.equal(plan.modeSurfaces.submenu, 'bottom-sheet');
    assert.equal(plan.modeSurfaces.primaryActions, 'bottom-action-rail');
    assert.equal(plan.modeSurfaces.gestureScroll, true);
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT]);
    assert.deepEqual(plan.suppressedModeSurfaces, [
      'desktop-top-menu',
      'desktop-dropdown',
      'desktop-left-inspector',
      'landscape-root-drawer',
      'landscape-right-submenu',
      'gamepad-slide-out'
    ]);
    assert.deepEqual(plan.surfaceRoles, {
      commandSurface: 'bottom-sheet',
      persistentContextSurface: 'top-context',
      persistentNavigationSurface: 'bottom-rail',
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: null
    });
    assert.deepEqual(plan.presentation, {
      rootSurface: 'bottom-rail',
      commandSurface: 'bottom-sheet',
      submenuSurface: 'bottom-sheet',
      persistentContextSurface: 'top-context',
      persistentNavigationSurface: 'bottom-rail',
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
    assert.equal(plan.touch.usesBottomMenus, true);
    assert.equal(plan.touch.usesSideRails, false);
  }
  assert.equal(editorUiContractSource.includes('Shared portrait mode plans expose `suppressedModeSurfaces`'), true);
  assert.equal(editorUiContractSource.includes('Shared generic mode plans expose `suppressedModeSurfaces` in every mode'), true);
  assert.equal(editorUiContractSource.includes('Shared generic mode plans expose `requiredModeSurfaces` in every mode'), true);
  assert.equal(editorUiContractSource.includes('a surface cannot be both required and suppressed in the same mode.'), true);
  assert.equal(editorUiContractSource.includes('Shared presentation/interaction mode contracts must validate for every mode'), true);
  assert.equal(editorUiContractSource.includes('`getEditorModeContract()` is the combined renderer-facing contract'), true);
  assert.equal(editorUiContractSource.includes('Specialized desktop, landscape, and gamepad shell helpers must expose the same generic `requiredModeSurfaces` and `suppressedModeSurfaces`'), true);
  assert.equal(editorUiContractSource.includes('so portrait stays bottom-first and does not inherit desktop, landscape, or controller chrome.'), true);
});

test('landscape, desktop, and gamepad menu layout plans expose distinct mode surfaces', () => {
  assert.deepEqual(validateEditorModeSurfaceContracts(), []);
  assert.deepEqual(validateEditorModePresentationInteractionContracts(), []);
  assert.deepEqual(getEditorModeSurfaceContract('unknown-mode'), {
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    requiredModeSurfaces: REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP],
    suppressedModeSurfaces: SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]
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
    presentation: MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP],
    interaction: MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP]
  });
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT], [
    'bottom-rail',
    'bottom-sheet',
    'bottom-action-rail'
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP], [
    'top-menu',
    'top-dropdown',
    'left-ribbon',
    'left-context-panel',
    'work-surface'
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH], [
    'left-rail',
    'left-overlay-drawer',
    'right-drawer',
    'bottom-rail'
  ]);
  assert.deepEqual(REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD], [
    'left-slide-rail',
    'left-slide-out-drawer',
    'work-surface-overlay'
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.PORTRAIT], [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'landscape-root-drawer',
    'landscape-right-submenu',
    'gamepad-slide-out'
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP], [
    'bottom-action-rail',
    'bottom-tool-rail',
    'touch-thumbstick',
    'landscape-root-drawer',
    'landscape-right-submenu',
    'gamepad-hint-bar',
    'gamepad-slide-out'
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH], [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'gamepad-slide-out'
  ]);
  assert.deepEqual(SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD], [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'landscape-right-submenu',
    'landscape-root-drawer',
    'bottom-tool-rail',
    'touch-thumbstick'
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
      rootMenu: 'left-rail',
      compactCommandRail: 'left-rail',
      rootDrawer: 'left-overlay-drawer',
      submenu: 'right-drawer',
      settings: 'right-drawer',
      primaryActions: null,
      gestureScroll: true,
      rootDrawerKeepsSubmenuVisible: true
    });
    assert.deepEqual(landscape.surfaceRoles, {
      commandSurface: 'right-drawer',
      persistentContextSurface: 'bottom-rail',
      persistentNavigationSurface: 'left-rail',
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: 4
    });
    assert.deepEqual(landscape.presentation, {
      rootSurface: 'left-rail',
      commandSurface: 'right-drawer',
      submenuSurface: 'right-drawer',
      persistentContextSurface: 'bottom-rail',
      persistentNavigationSurface: 'left-rail',
      rootDrawerSurface: 'left-overlay-drawer',
      rootDrawerOverlayOrigin: 'left',
      rootDrawerKeepsSubmenuVisible: true,
      submenuReplacesRootRail: false,
      rightSubmenuSurface: 'right-drawer'
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
    assert.deepEqual(getEditorModeSurfaceContract(landscape.mode), {
      mode: landscape.mode,
      requiredModeSurfaces: landscape.requiredModeSurfaces,
      suppressedModeSurfaces: landscape.suppressedModeSurfaces
    });
    assert.deepEqual(desktop.modeSurfaces, {
      rootMenu: 'top-menu',
      compactCommandRail: null,
      rootDrawer: null,
      submenu: 'dropdown',
      settings: 'left-panel',
      primaryActions: null,
      gestureScroll: false,
      rootDrawerKeepsSubmenuVisible: false
    });
    assert.deepEqual(desktop.surfaceRoles, {
      commandSurface: 'top-dropdown',
      persistentContextSurface: 'left-panel',
      persistentNavigationSurface: 'top-menu',
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: true,
      persistentNavigationActionLimit: null
    });
    assert.deepEqual(desktop.presentation, {
      rootSurface: 'top-menu',
      commandSurface: 'top-dropdown',
      submenuSurface: 'dropdown',
      persistentContextSurface: 'left-panel',
      persistentNavigationSurface: 'top-menu',
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
    assert.deepEqual(getEditorModeSurfaceContract(desktop.mode), {
      mode: desktop.mode,
      requiredModeSurfaces: desktop.requiredModeSurfaces,
      suppressedModeSurfaces: desktop.suppressedModeSurfaces
    });
    assert.deepEqual(gamepad.modeSurfaces, {
      rootMenu: 'left-slide-rail',
      compactCommandRail: null,
      rootDrawer: null,
      submenu: 'slide-out-drawer',
      settings: 'slide-out-drawer',
      primaryActions: null,
      gestureScroll: true,
      rootDrawerKeepsSubmenuVisible: false
    });
    assert.deepEqual(gamepad.surfaceRoles, {
      commandSurface: 'left-slide-out-drawer',
      persistentContextSurface: 'work-surface-overlay',
      persistentNavigationSurface: 'left-slide-rail',
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: false,
      persistentNavigationActionLimit: null
    });
    assert.deepEqual(gamepad.presentation, {
      rootSurface: 'left-slide-rail',
      commandSurface: 'left-slide-out-drawer',
      submenuSurface: 'left-slide-out-drawer',
      persistentContextSurface: 'work-surface-overlay',
      persistentNavigationSurface: 'left-slide-rail',
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
    assert.deepEqual(getEditorModeSurfaceContract(gamepad.mode), {
      mode: gamepad.mode,
      requiredModeSurfaces: gamepad.requiredModeSurfaces,
      suppressedModeSurfaces: gamepad.suppressedModeSurfaces
    });
    assert.equal(gamepad.gamepad.rootSurface, 'left-slide-rail');
    assert.equal(gamepad.gamepad.submenuSurface, 'left-slide-out-drawer');
    assert.equal(gamepad.gamepad.submenuReplacesRoot, true);
  }
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

  assert.equal(findScrollableMenuRegion(regions, { x: 110, y: 20 }), null);
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
    durationMs: 120
  }), 0.5);
  assert.equal(resolveDesktopDropdownMotionProgress({
    dropdown: { rootId: 'file', openedAtMs: 1000 },
    nowMs: 2000,
    durationMs: 120
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
  assert.equal(plan.panelBounds.h, dropdown.rowHeight * 4);
  assert.equal(plan.visibleRows, 4);
  assert.equal(plan.scrollIndex, 1);
  assert.equal(plan.maxScroll, dropdown.items.length - 4);
  assert.equal(plan.scrollRegion.maxScroll, dropdown.items.length - 4);
  assert.equal(plan.scrollRegion.pointerType, 'mouse');
  assert.deepEqual(plan.itemBounds.map((bounds) => bounds.id), ['save', 'save-as', 'open', 'export']);
  assert.deepEqual(plan.motion, {
    type: 'slide-down',
    progress: 1,
    durationMs: 120,
    origin: 'top-menu',
    translateY: 0,
    opacity: 1
  });

  const openingPlan = buildDesktopDropdownRenderPlan({
    dropdown,
    items,
    motionProgress: 0.25,
    motionDurationMs: 140
  });
  assert.equal(openingPlan.motion.type, 'slide-down');
  assert.equal(openingPlan.motion.origin, 'top-menu');
  assert.equal(openingPlan.motion.progress, 0.25);
  assert.equal(openingPlan.motion.durationMs, 140);
  assert.ok(openingPlan.motion.translateY < 0);
  assert.ok(openingPlan.motion.opacity > 0.7 && openingPlan.motion.opacity < 1);

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
      origin: 'top-menu',
      translateY: -9,
      opacity: 0.86
    },
    itemBounds: [
      { id: 'copy', x: 8, y: 4, w: 204, h: 30 },
      { id: 'separator-1', x: 8, y: 38, w: 204, h: 20 },
      { id: 'paste', x: 8, y: 62, w: 204, h: 30 }
    ],
    renderedItems: [
      { id: 'copy', label: 'Copy', disabled: true },
      { divider: true },
      { id: 'paste', label: 'Paste' }
    ]
  };

  const rendered = drawSharedDesktopDropdown(ctx, dropdownPlan, {
    registerButton: (entry) => calls.push(entry.item.id)
  });

  assert.deepEqual(rendered.map((entry) => entry.item.id || 'divider'), ['copy', 'divider', 'paste']);
  assert.deepEqual(calls, ['paste']);
  assert.equal(rendered[2].bounds.y, 53);
});

test('shared file menu specs include the actions used by editor surfaces', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'copy-image', 'paste-image', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('pixel', 'tools').actions, ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']);
  assert.deepEqual(getEditorMenuSection('level', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'playtest', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('level', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('actor', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('actor', 'edit').actions, ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']);
  assert.deepEqual(getEditorMenuSection('midi', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'rescue-save', 'export-midi', 'export-midi-zip', 'export-wav', 'save-paint', 'play-robtersession', 'theme', 'sample', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('midi', 'edit').actions, ['undo', 'redo', 'select-all', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('sfx', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('sfx', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('race', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('race', 'edit').actions, ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']);
  assert.deepEqual(getEditorMenuSection('car', 'file').actions, ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  assert.deepEqual(getEditorMenuSection('car', 'edit').actions, ['undo', 'redo', 'copy-layer', 'paste-layer', 'delete-layer']);

  const sharedFileBaseline = ['new', 'save', 'save-as', 'open', 'export', 'import'];
  const sharedEditBaseline = ['undo', 'redo'];
  ALL_EDITOR_IDS.forEach((editorId) => {
    const dropdown = buildDesktopDropdownPlan(editorId, 'file');
    assert.deepEqual(
      dropdown.items.slice(0, sharedFileBaseline.length).map((item) => item.id),
      sharedFileBaseline,
      `${editorId} desktop File dropdown should start with the shared baseline`
    );
    const editDropdown = buildDesktopDropdownPlan(editorId, 'edit');
    assert.deepEqual(
      editDropdown.items.slice(0, sharedEditBaseline.length).map((item) => item.id),
      sharedEditBaseline,
      `${editorId} desktop Edit dropdown should start with Undo and Redo`
    );
    assert.ok(
      editDropdown.items.length > sharedEditBaseline.length,
      `${editorId} desktop Edit dropdown should keep editor-specific edit actions after history`
    );
  });

  const pixelDropdown = buildDesktopDropdownPlan('pixel', 'file');
  assert.deepEqual(pixelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'copy-image', 'paste-image', 'exit-main']);
  const pixelToolsDropdown = buildDesktopDropdownPlan('pixel', 'tools');
  assert.deepEqual(pixelToolsDropdown.items.map((item) => item.id), ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']);

  const levelDropdown = buildDesktopDropdownPlan('level', 'file');
  assert.deepEqual(levelDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'playtest', 'exit-main']);
  const levelEditDropdown = buildDesktopDropdownPlan('level', 'edit');
  assert.deepEqual(levelEditDropdown.items.map((item) => item.id), ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);

  const actorDropdown = buildDesktopDropdownPlan('actor', 'file');
  assert.deepEqual(actorDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);

  const raceDropdown = buildDesktopDropdownPlan('race', 'file');
  assert.deepEqual(raceDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  const raceEditDropdown = buildDesktopDropdownPlan('race', 'edit');
  assert.deepEqual(raceEditDropdown.items.map((item) => item.id), ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']);

  const carDropdown = buildDesktopDropdownPlan('car', 'file');
  assert.deepEqual(carDropdown.items.map((item) => item.id), ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']);
  const carEditDropdown = buildDesktopDropdownPlan('car', 'edit');
  assert.deepEqual(carEditDropdown.items.map((item) => item.id), ['undo', 'redo', 'copy-layer', 'paste-layer', 'delete-layer']);
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
  assert.equal(plan.commandSurface, 'top-dropdown');
  assert.deepEqual(plan.commandSurfaces, ['top-dropdown']);
  assert.deepEqual(plan.persistentSurfaces, ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']);
  assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
  assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
  assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP));
  assert.deepEqual(plan.suppressedMobileSurfaces, [
    'bottom-action-rail',
    'bottom-tool-rail',
    'touch-thumbstick',
    'landscape-root-drawer',
    'landscape-right-submenu',
    'gamepad-hint-bar',
    'gamepad-slide-out'
  ]);
  assert.equal(plan.leftPanelRole, 'context-inspector');
  assert.equal(plan.duplicatesCommandsInLeftPanel, false);
  assert.equal(plan.desktopMobileRailsHidden, true);
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
    assert.equal(plan.commandSurface, 'top-dropdown');
    assert.deepEqual(plan.commandSurfaces, ['top-dropdown']);
    assert.deepEqual(plan.persistentSurfaces, ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']);
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.DESKTOP]);
    assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP));
    assert.deepEqual(plan.suppressedMobileSurfaces, [
      'bottom-action-rail',
      'bottom-tool-rail',
      'touch-thumbstick',
      'landscape-root-drawer',
      'landscape-right-submenu',
      'gamepad-hint-bar',
      'gamepad-slide-out'
    ]);
    assert.equal(plan.leftPanelRole, 'context-inspector');
    assert.equal(plan.duplicatesCommandsInLeftPanel, false);
    assert.equal(plan.desktopMobileRailsHidden, true);
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
    root: 'left-rail',
    submenu: 'right-drawer',
    settings: 'right-drawer'
  });
  assert.equal(plan.rootMenuSurface, 'left-rail');
  assert.equal(plan.submenuSurface, 'right-drawer');
  assert.equal(plan.bottomRailRole, 'tool-options-ribbons-zoom');
  assert.equal(plan.gestureScroll, true);
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.submenu, plan.rightRail);
  assert.deepEqual(plan.surfaces.toolOptions, plan.bottomRail);
  assert.deepEqual(plan.surfaces.zoom, plan.bottomRail);
  assert.deepEqual(plan.surfaces.ribbon, plan.bottomRail);
  assert.deepEqual(plan.surfaces.workSurface, plan.workSurface);
  assert.equal(plan.leftRail.x, 0);
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

    assert.equal(plan.rootMenuSurface, 'left-rail');
    assert.equal(plan.submenuSurface, 'right-drawer');
    assert.equal(plan.compactCommandRailSurface, 'left-rail');
    assert.equal(plan.compactCommandRailActionLimit, 4);
    assert.equal(plan.rootDrawerSurface, 'left-overlay-drawer');
    assert.equal(plan.rootDrawerOverlayOrigin, 'left');
    assert.deepEqual(plan.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(plan.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]);
    assert.deepEqual(plan.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH));
    assert.deepEqual(plan.suppressedDesktopSurfaces, ['desktop-top-menu', 'desktop-dropdown', 'desktop-left-inspector']);
    assert.equal(plan.bottomRailRole, 'tool-options-ribbons-zoom');
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

test('landscape touch shell omits the right submenu surface when gamepad slide-out owns submenus', () => {
  const plan = buildLandscapeTouchEditorShellPlan('level', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 72,
    reserveRightRail: false
  });

  assert.equal(plan.rootMenuSurface, 'left-rail');
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.compactCommandRailSurface, 'left-rail');
  assert.equal(plan.compactCommandRailActionLimit, 4);
  assert.equal(plan.rootDrawerSurface, 'left-overlay-drawer');
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

  assert.equal(plan.rootMenuSurface, 'left-rail');
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.rootDrawerSurface, 'left-overlay-drawer');
  assert.equal(plan.rootDrawerOverlayOrigin, 'left');
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
  assert.notDeepEqual(plan.surfaces.rootDrawer, plan.surfaces.overlayDrawer);
  assert.equal(plan.surfaces.rootDrawer.x >= plan.leftRail.x + plan.leftRail.w, true);
  assert.equal(plan.surfaces.rootDrawer.x < plan.bounds.w / 2, true);
  assert.equal(plan.surfaces.overlayDrawer.x + plan.surfaces.overlayDrawer.w, plan.bounds.w);
  assert.ok(plan.surfaces.rootDrawer.y + plan.surfaces.rootDrawer.h <= plan.bottomRail.y);
});

test('landscape touch shell can opt root drawers back to the right overlay', () => {
  const plan = buildLandscapeTouchEditorShellPlan('pixel', {
    viewportWidth: 844,
    viewportHeight: 390,
    bottomRailHeight: 78,
    reserveRightRail: false,
    reserveThumbstickSpace: false,
    rootDrawerOverlayOrigin: 'right'
  });

  assert.equal(plan.rootMenuSurface, 'left-rail');
  assert.equal(plan.submenuSurface, null);
  assert.equal(plan.rootDrawerSurface, 'right-overlay-drawer');
  assert.equal(plan.rootDrawerOverlayOrigin, 'right');
  assert.deepEqual(plan.surfaces.rootMenu, plan.leftRail);
  assert.deepEqual(plan.surfaces.rootDrawer, plan.surfaces.overlayDrawer);
  assert.notDeepEqual(plan.surfaces.rootDrawer, plan.leftRootDrawer);
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
  assert.deepEqual(root.presentation, MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.equal(root.interaction.rowActivation, 'confirm-button');
  assert.equal(root.interaction.pointerType, 'controller');
  assert.equal(root.interaction.gestureScroll, true);
  assert.deepEqual(root.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.deepEqual(root.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
  assert.deepEqual(root.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
  assert.deepEqual(root.suppressedTouchSurfaces, [
    'landscape-right-submenu',
    'landscape-root-drawer',
    'bottom-tool-rail',
    'touch-thumbstick'
  ]);
  assert.equal(root.rootCollapsed, false);
  assert.equal(root.submenu, null);
  assert.equal(root.controls.confirm, 'A');
  assert.equal(root.controls.back, 'B');
  assert.equal(root.headerHint, 'A Select  B Back  LB/RB Tabs');

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
    focusedItemId: 'timeline-fit'
  });
  assert.equal(submenu.focus.surface, 'submenu');
  assert.equal(submenu.focusedRootEntry, null);
  assert.equal(submenu.focusedSubmenuItem.id, 'timeline-fit');
  assert.equal(submenu.focus.submenuItemId, 'timeline-fit');
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
    assert.deepEqual(root.presentation, submenu.presentation);
    assert.equal(root.presentation.submenuSurface, 'left-slide-out-drawer');
    assert.equal(root.presentation.submenuReplacesRootRail, true);
    assert.equal(root.interaction.confirm, 'A');
    assert.equal(root.interaction.back, 'B');
    assert.equal(root.interaction.rowActivation, 'confirm-button');
    assert.equal(root.interaction.pointerType, 'controller');
    assert.equal(root.scroll.root.pointerType, 'controller');
    assert.equal(submenu.scroll.submenu.pointerType, 'controller');
    assert.deepEqual(root.requiredModeSurfaces, REQUIRED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(root.suppressedModeSurfaces, SUPPRESSED_MODE_SURFACES[EDITOR_LAYOUT_MODES.GAMEPAD]);
    assert.deepEqual(root.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
    assert.deepEqual(submenu.modeContract, getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD));
    assert.deepEqual(root.suppressedTouchSurfaces, [
      'landscape-right-submenu',
      'landscape-root-drawer',
      'bottom-tool-rail',
      'touch-thumbstick'
    ]);
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
    assert.equal(submenu.submenu.surface, 'left-slide-out-drawer');
    assert.equal(submenu.submenu.sourceSurface, 'gamepad-slide-out');
    assert.equal(submenu.submenu.replacesRootRail, true);
    assert.equal(submenu.submenu.pointerType, 'controller');
  }
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
  const editors = ['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car'];
  editors.forEach((editorId) => {
    const policy = getEditorPointerInteractionPolicy(editorId, {
      mode: EDITOR_LAYOUT_MODES.DESKTOP,
      pointerType: 'mouse'
    });

    assert.equal(policy.workSurfaceGestures.wheelZoom, true, `${editorId} wheel zoom`);
    assert.equal(policy.workSurfaceGestures.middleDragPan, true, `${editorId} middle-drag pan`);
    assert.equal(policy.workSurfaceGestures.rightDragPan, true, `${editorId} right-drag pan`);
    assert.equal(policy.rightClick.suppressBrowserMenu, true, `${editorId} suppress browser menu`);
    assert.equal(policy.rightClick.fallbackPan, true, `${editorId} fallback pan`);
    assert.equal(policy.thumbstick.allowed, false, `${editorId} desktop thumbstick hidden`);
  });
});

test('shared context-menu suppression follows the editor pointer policy', () => {
  ['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car'].forEach((editorId) => {
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
