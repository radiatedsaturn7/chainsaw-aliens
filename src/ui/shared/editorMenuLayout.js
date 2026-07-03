import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  getEditorControllerRootMenuEntries,
  getEditorMenuSpec,
  getEditorRootMenuEntries
} from './editorMenuSpec.js';
import { getSharedMobileLandscapeEditorLayout } from '../uiSuite.js';

const DEFAULT_DRAG_SCROLL = {
  enabled: true,
  thresholdPx: 8,
  suppressClickAfterDrag: true
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const pointInBounds = (point = {}, bounds = {}) => {
  const x = Number(point.x);
  const y = Number(point.y);
  return Number.isFinite(x)
    && Number.isFinite(y)
    && x >= Number(bounds.x || 0)
    && x <= Number(bounds.x || 0) + Number(bounds.w || 0)
    && y >= Number(bounds.y || 0)
    && y <= Number(bounds.y || 0) + Number(bounds.h || 0);
};

const DEFAULT_TOP_MENU = {
  x: 0,
  y: 0,
  w: 0,
  h: 40,
  itemMinWidth: 72,
  itemMaxWidth: 132,
  gap: 4,
  padding: 8
};

const DEFAULT_DESKTOP_SHELL = {
  topMenuHeight: 40,
  leftPanelMinWidth: 292,
  leftPanelMaxWidth: 360,
  leftPanelViewportRatio: 0.24,
  leftRibbonHeight: 58,
  gap: 8,
  minWorkSurfaceWidth: 320,
  minWorkSurfaceHeight: 220
};

const WORK_SURFACE_TYPES = {
  pixel: 'canvas',
  level: 'canvas',
  actor: 'stage',
  midi: 'grid',
  sfx: 'timeline',
  cutscene: 'stage',
  race: 'stage',
  car: 'stage'
};

export const COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT = 4;
export const COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH = 84;

export const SUPPRESSED_MODE_SURFACES = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'landscape-root-drawer',
    'landscape-right-submenu',
    'gamepad-slide-out'
  ],
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'gamepad-slide-out'
  ],
  [EDITOR_LAYOUT_MODES.DESKTOP]: [
    'bottom-action-rail',
    'bottom-tool-rail',
    'touch-thumbstick',
    'landscape-root-drawer',
    'landscape-right-submenu',
    'gamepad-hint-bar',
    'gamepad-slide-out'
  ],
  [EDITOR_LAYOUT_MODES.GAMEPAD]: [
    'desktop-top-menu',
    'desktop-dropdown',
    'desktop-left-inspector',
    'landscape-right-submenu',
    'landscape-root-drawer',
    'bottom-tool-rail',
    'touch-thumbstick'
  ]
};

export const REQUIRED_MODE_SURFACES = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: [
    'bottom-rail',
    'bottom-sheet',
    'bottom-action-rail'
  ],
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: [
    'left-rail',
    'left-overlay-drawer',
    'right-drawer',
    'bottom-rail'
  ],
  [EDITOR_LAYOUT_MODES.DESKTOP]: [
    'top-menu',
    'top-dropdown',
    'left-ribbon',
    'left-context-panel',
    'work-surface'
  ],
  [EDITOR_LAYOUT_MODES.GAMEPAD]: [
    'left-slide-rail',
    'left-slide-out-drawer',
    'work-surface-overlay'
  ]
};

export function getEditorModeSurfaceContract(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  const resolvedMode = Object.values(EDITOR_LAYOUT_MODES).includes(mode)
    ? mode
    : EDITOR_LAYOUT_MODES.DESKTOP;
  return {
    mode: resolvedMode,
    requiredModeSurfaces: [...(REQUIRED_MODE_SURFACES[resolvedMode] || [])],
    suppressedModeSurfaces: [...(SUPPRESSED_MODE_SURFACES[resolvedMode] || [])]
  };
}

export function validateEditorModeSurfaceContracts() {
  const errors = [];
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    const required = REQUIRED_MODE_SURFACES[mode];
    const suppressed = SUPPRESSED_MODE_SURFACES[mode];
    if (!Array.isArray(required) || !required.length) errors.push(`${mode} requires requiredModeSurfaces.`);
    if (!Array.isArray(suppressed)) errors.push(`${mode} requires suppressedModeSurfaces.`);
    const duplicateRequired = (required || []).filter((surface, index, list) => list.indexOf(surface) !== index);
    const duplicateSuppressed = (suppressed || []).filter((surface, index, list) => list.indexOf(surface) !== index);
    Array.from(new Set(duplicateRequired)).forEach((surface) => {
      errors.push(`${mode} duplicates required surface "${surface}".`);
    });
    Array.from(new Set(duplicateSuppressed)).forEach((surface) => {
      errors.push(`${mode} duplicates suppressed surface "${surface}".`);
    });
    const overlap = (required || []).filter((surface) => (suppressed || []).includes(surface));
    overlap.forEach((surface) => {
      errors.push(`${mode} cannot both require and suppress "${surface}".`);
    });
  });
  return errors;
}

export const MODE_PRESENTATION_CONTRACTS = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
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
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
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
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
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
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
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
  }
};

export const MODE_INTERACTION_CONTRACTS = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
    pointerType: 'touch',
    rowActivation: 'tap-release',
    gestureScroll: true,
    wheelRoutesToHoveredPanel: false,
    pinchZoomReservedForWorkSurface: true,
    confirm: null,
    back: null,
    siblingPrev: null,
    siblingNext: null
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
    pointerType: 'touch',
    rowActivation: 'tap-release',
    gestureScroll: true,
    wheelRoutesToHoveredPanel: false,
    pinchZoomReservedForWorkSurface: true,
    confirm: null,
    back: null,
    siblingPrev: null,
    siblingNext: null
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
    pointerType: 'mouse',
    rowActivation: 'release',
    gestureScroll: false,
    wheelRoutesToHoveredPanel: true,
    pinchZoomReservedForWorkSurface: true,
    confirm: null,
    back: null,
    siblingPrev: null,
    siblingNext: null
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
    pointerType: 'controller',
    rowActivation: 'confirm-button',
    gestureScroll: true,
    wheelRoutesToHoveredPanel: false,
    pinchZoomReservedForWorkSurface: true,
    confirm: 'A',
    back: 'B',
    siblingPrev: 'LB',
    siblingNext: 'RB'
  }
};

export function getEditorModePresentationInteractionContract(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  const resolvedMode = Object.values(EDITOR_LAYOUT_MODES).includes(mode)
    ? mode
    : EDITOR_LAYOUT_MODES.DESKTOP;
  return {
    mode: resolvedMode,
    presentation: { ...(MODE_PRESENTATION_CONTRACTS[resolvedMode] || {}) },
    interaction: { ...(MODE_INTERACTION_CONTRACTS[resolvedMode] || {}) }
  };
}

export function getEditorModeContract(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  const surface = getEditorModeSurfaceContract(mode);
  const presentationInteraction = getEditorModePresentationInteractionContract(surface.mode);
  return {
    mode: surface.mode,
    requiredModeSurfaces: surface.requiredModeSurfaces,
    suppressedModeSurfaces: surface.suppressedModeSurfaces,
    presentation: presentationInteraction.presentation,
    interaction: presentationInteraction.interaction
  };
}

export function validateEditorModePresentationInteractionContracts() {
  const errors = [];
  const presentationKeys = [
    'rootSurface',
    'commandSurface',
    'submenuSurface',
    'persistentContextSurface',
    'persistentNavigationSurface',
    'rootDrawerSurface',
    'rootDrawerOverlayOrigin',
    'rootDrawerKeepsSubmenuVisible',
    'submenuReplacesRootRail',
    'rightSubmenuSurface'
  ];
  const interactionKeys = [
    'pointerType',
    'rowActivation',
    'gestureScroll',
    'wheelRoutesToHoveredPanel',
    'pinchZoomReservedForWorkSurface',
    'confirm',
    'back',
    'siblingPrev',
    'siblingNext'
  ];
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    const presentation = MODE_PRESENTATION_CONTRACTS[mode];
    const interaction = MODE_INTERACTION_CONTRACTS[mode];
    if (!presentation) {
      errors.push(`${mode} requires presentation contract.`);
    } else {
      presentationKeys.forEach((key) => {
        if (!(key in presentation)) errors.push(`${mode} presentation missing "${key}".`);
      });
    }
    if (!interaction) {
      errors.push(`${mode} requires interaction contract.`);
    } else {
      interactionKeys.forEach((key) => {
        if (!(key in interaction)) errors.push(`${mode} interaction missing "${key}".`);
      });
    }
  });
  const desktop = MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP] || {};
  if (desktop.pointerType !== 'mouse') errors.push('desktop pointerType must be mouse.');
  if (desktop.rowActivation !== 'release') errors.push('desktop rowActivation must be release.');
  if (desktop.wheelRoutesToHoveredPanel !== true) errors.push('desktop wheelRoutesToHoveredPanel must be true.');
  const gamepad = MODE_INTERACTION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD] || {};
  const gamepadPresentation = MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.GAMEPAD] || {};
  if (gamepad.pointerType !== 'controller') errors.push('gamepad pointerType must be controller.');
  if (gamepad.rowActivation !== 'confirm-button') errors.push('gamepad rowActivation must be confirm-button.');
  if (gamepad.confirm !== 'A' || gamepad.back !== 'B') errors.push('gamepad confirm/back controls must be A/B.');
  if (gamepadPresentation.submenuReplacesRootRail !== true) errors.push('gamepad submenuReplacesRootRail must be true.');
  [EDITOR_LAYOUT_MODES.PORTRAIT, EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].forEach((mode) => {
    const interaction = MODE_INTERACTION_CONTRACTS[mode] || {};
    if (interaction.pointerType !== 'touch') errors.push(`${mode} pointerType must be touch.`);
    if (interaction.rowActivation !== 'tap-release') errors.push(`${mode} rowActivation must be tap-release.`);
    if (interaction.gestureScroll !== true) errors.push(`${mode} gestureScroll must be true.`);
  });
  return errors;
}

export function resolveEditorLayoutMode({
  viewportWidth = 0,
  viewportHeight = 0,
  isMobile = false,
  gamepadConnected = false,
  forceDesktop = false
} = {}) {
  if (forceDesktop || !isMobile) return EDITOR_LAYOUT_MODES.DESKTOP;
  if (gamepadConnected && Number(viewportWidth) > Number(viewportHeight)) return EDITOR_LAYOUT_MODES.GAMEPAD;
  return Number(viewportWidth) > Number(viewportHeight)
    ? EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH
    : EDITOR_LAYOUT_MODES.PORTRAIT;
}

export function resolveEditorViewportModeFlags({
  viewportWidth = 0,
  viewportHeight = 0,
  isMobile = false,
  gamepadConnected = false,
  forceDesktop = false
} = {}) {
  const width = Number(viewportWidth) || 0;
  const height = Number(viewportHeight) || 0;
  const mode = resolveEditorLayoutMode({
    viewportWidth: width,
    viewportHeight: height,
    isMobile,
    gamepadConnected,
    forceDesktop
  });
  const isDesktop = mode === EDITOR_LAYOUT_MODES.DESKTOP;
  const isMobileViewport = !isDesktop;
  return {
    mode,
    modeContract: getEditorModeContract(mode),
    isDesktop,
    isMobileViewport,
    isMobilePortrait: isMobileViewport && height >= width,
    isMobileLandscape: isMobileViewport && width > height,
    isLandscapeTouch: mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    isGamepadLandscape: mode === EDITOR_LAYOUT_MODES.GAMEPAD
  };
}

export function getEditorMenuPlacement(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  return EDITOR_MENU_PLACEMENTS[mode] || EDITOR_MENU_PLACEMENTS[EDITOR_LAYOUT_MODES.DESKTOP];
}

export function buildEditorMenuLayoutPlan(editorId, options = {}) {
  const mode = options.mode || resolveEditorLayoutMode(options);
  const spec = getEditorMenuSpec(editorId);
  const placement = getEditorMenuPlacement(mode);
  const rootIds = spec?.root?.slice() || [];
  const isPortrait = mode === EDITOR_LAYOUT_MODES.PORTRAIT;
  const isLandscapeTouch = mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH;
  const isDesktop = mode === EDITOR_LAYOUT_MODES.DESKTOP;
  const isGamepad = mode === EDITOR_LAYOUT_MODES.GAMEPAD;
  const modeContract = getEditorModeContract(mode);
  const { presentation, interaction } = modeContract;
  const commandSurface = presentation.commandSurface;
  const persistentContextSurface = presentation.persistentContextSurface;
  const persistentNavigationSurface = presentation.persistentNavigationSurface;

  return {
    editorId,
    mode,
    title: spec?.title || '',
    rootIds,
    placement,
    modeSurfaces: {
      rootMenu: placement.root,
      compactCommandRail: isLandscapeTouch ? 'left-rail' : null,
      rootDrawer: isLandscapeTouch ? 'left-overlay-drawer' : null,
      submenu: placement.submenu,
      settings: placement.settings,
      primaryActions: isPortrait ? 'bottom-action-rail' : null,
      gestureScroll: isPortrait || isLandscapeTouch || isGamepad,
      rootDrawerKeepsSubmenuVisible: isLandscapeTouch
    },
    surfaceRoles: {
      commandSurface,
      persistentContextSurface,
      persistentNavigationSurface,
      duplicatesCommandsInPersistentContext: false,
      desktopMobileRailsHidden: isDesktop,
      persistentNavigationActionLimit: isLandscapeTouch ? 4 : null
    },
    presentation,
    interaction,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    modeContract,
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL },
      submenu: { ...DEFAULT_DRAG_SCROLL },
      settings: { ...DEFAULT_DRAG_SCROLL }
    },
    gamepad: {
      rootCollapsesAfterSelect: mode === EDITOR_LAYOUT_MODES.GAMEPAD,
      rootSurface: isGamepad ? 'left-slide-rail' : null,
      submenuSurface: isGamepad ? 'left-slide-out-drawer' : null,
      submenuReplacesRoot: mode === EDITOR_LAYOUT_MODES.GAMEPAD,
      confirm: 'A',
      back: 'B',
      system: 'Start',
      focusToggle: 'Back',
      siblingPrev: 'LB',
      siblingNext: 'RB'
    },
    desktop: {
      usesTopMenu: isDesktop,
      usesDropdowns: isDesktop,
      showPersistentLeftOptions: isDesktop,
      commandSurface: isDesktop ? 'top-dropdown' : null,
      leftPanelRole: isDesktop ? 'context-inspector' : null,
      duplicatesCommandsInLeftPanel: false
    },
    touch: {
      usesBottomMenus: isPortrait,
      usesSideRails: isLandscapeTouch,
      thumbstickAllowed: isPortrait || isLandscapeTouch || isGamepad
    }
  };
}

export function getMenuScrollPolicy({ pointerType = 'touch', mode = EDITOR_LAYOUT_MODES.PORTRAIT } = {}) {
  return {
    ...DEFAULT_DRAG_SCROLL,
    pointerType,
    mode,
    wheelRoutesToHoveredPanel: mode === EDITOR_LAYOUT_MODES.DESKTOP,
    pinchZoomReservedForWorkSurface: true
  };
}

export function findScrollableMenuRegion(regions = [], point = {}) {
  return (regions || []).find((entry) => (
    entry?.maxScroll > 0
    && pointInBounds(point, entry.bounds)
  )) || null;
}

export function buildMenuScrollDragState({
  regions = [],
  point = {},
  scrollState = {},
  pendingHit = null,
  thresholdPx = DEFAULT_DRAG_SCROLL.thresholdPx,
  defaultLineHeight = 44,
  defaultScrollScale = null
} = {}) {
  const region = findScrollableMenuRegion(regions, point);
  if (!region) return null;
  const menuId = region.menuId || region.id || 'menu';
  const scrollScale = Number.isFinite(region.scrollScale)
    ? Number(region.scrollScale)
    : Number.isFinite(defaultScrollScale)
      ? Number(defaultScrollScale)
      : null;
  return {
    menuId,
    scrollKey: menuId,
    startY: Number(point.y) || 0,
    startScroll: Number(scrollState?.[menuId] || 0),
    maxScroll: Math.max(0, Number(region.maxScroll) || 0),
    lineHeight: Math.max(1, Number(region.lineHeight) || defaultLineHeight),
    scrollScale,
    thresholdPx: Math.max(0, Number(thresholdPx) || 0),
    moved: false,
    pendingHit
  };
}

export function resolveMenuScrollDrag(drag = null, point = {}) {
  if (!drag) return null;
  const dy = (Number(point.y) || 0) - (Number(drag.startY) || 0);
  const moved = Boolean(drag.moved) || Math.abs(dy) > Math.max(0, Number(drag.thresholdPx) || 0);
  const rawNextScroll = Number.isFinite(drag.scrollScale)
    ? (Number(drag.startScroll) || 0) - dy * Number(drag.scrollScale)
    : (Number(drag.startScroll) || 0) - Math.round(dy / Math.max(1, Number(drag.lineHeight) || 1));
  const nextScroll = Math.max(0, Math.min(
    Math.max(0, Number(drag.maxScroll) || 0),
    rawNextScroll
  ));
  return {
    ...drag,
    moved,
    deltaY: dy,
    nextScroll
  };
}

export function resolveMenuWheelScroll({
  currentScroll = 0,
  maxScroll = 0,
  deltaY = 0,
  step = 1
} = {}) {
  const max = Math.max(0, Number(maxScroll) || 0);
  if (max <= 0) return null;
  const direction = Number(deltaY || 0) > 0 ? 1 : -1;
  return Math.max(0, Math.min(
    max,
    (Number(currentScroll) || 0) + direction * Math.max(1, Number(step) || 1)
  ));
}

export function resolveDesktopDropdownWheelScroll({
  dropdown = null,
  payload = {},
  scrollState = {}
} = {}) {
  if (!dropdown?.panelBounds || dropdown.maxScroll <= 0) return null;
  if (!pointInBounds(payload, dropdown.panelBounds)) return null;
  const rootId = dropdown.rootId || dropdown.id || 'dropdown';
  const nextScroll = resolveMenuWheelScroll({
    currentScroll: scrollState?.[rootId] || 0,
    maxScroll: dropdown.maxScroll,
    deltaY: payload.deltaY
  });
  return nextScroll === null ? null : { rootId, nextScroll };
}

export function applyDesktopDropdownWheelScrollState({
  dropdown = null,
  payload = {},
  scrollState = {}
} = {}) {
  const resolved = resolveDesktopDropdownWheelScroll({ dropdown, payload, scrollState });
  if (!resolved) return null;
  return {
    rootId: resolved.rootId,
    nextScroll: resolved.nextScroll,
    scrollState: {
      ...(scrollState || {}),
      [resolved.rootId]: resolved.nextScroll
    }
  };
}

export function resolveDesktopDropdownState({
  isDesktop = false,
  mode = null,
  dropdown = null,
  previousDropdown = null
} = {}) {
  const desktopMode = isDesktop || mode === EDITOR_LAYOUT_MODES.DESKTOP;
  if (!desktopMode || !dropdown) return null;
  const dropdownRootId = dropdown.rootId || dropdown.id || null;
  const previousRootId = previousDropdown?.rootId || previousDropdown?.id || null;
  const previousOpenedAtMs = Number(previousDropdown?.openedAtMs);
  return {
    ...dropdown,
    ...(
      dropdownRootId
      && dropdownRootId === previousRootId
      && Number.isFinite(previousOpenedAtMs)
        ? { openedAtMs: previousOpenedAtMs }
        : {}
    )
  };
}

export function resolveDesktopDropdownRootId({
  activeRootId = null,
  openRootId = null,
  closedRootId = null,
  isDesktop = true
} = {}) {
  if (!isDesktop) return null;
  const rootId = openRootId || activeRootId;
  if (!rootId) return null;
  return closedRootId === rootId ? null : rootId;
}

export function resolveDesktopRootMenuHit({
  buttons = [],
  point = {},
  rootIdKey = 'id',
  idPrefix = '',
  excludeIds = []
} = {}) {
  const excluded = new Set(excludeIds || []);
  const hit = (buttons || []).find((button) => {
    const rawId = button?.[rootIdKey] || button?.id;
    if (!rawId) return false;
    const rootId = idPrefix && String(rawId).startsWith(idPrefix)
      ? String(rawId).slice(idPrefix.length)
      : rawId;
    return !excluded.has(rootId) && pointInBounds(point, button.bounds || button);
  });
  if (!hit) return null;
  const rawId = hit[rootIdKey] || hit.id;
  const rootId = idPrefix && String(rawId).startsWith(idPrefix)
    ? String(rawId).slice(idPrefix.length)
    : rawId;
  return { rootId, button: hit };
}

export function resolveDesktopDropdownHoverSwitch({
  buttons = [],
  point = {},
  openRootId = null,
  rootIdKey = 'id',
  idPrefix = '',
  excludeIds = []
} = {}) {
  if (!openRootId) return null;
  const hit = resolveDesktopRootMenuHit({
    buttons,
    point,
    rootIdKey,
    idPrefix,
    excludeIds
  });
  if (!hit?.rootId || hit.rootId === openRootId) return null;
  return hit;
}

export function shouldCloseDesktopDropdownOnPointerDown({
  dropdown = null,
  point = {},
  rootButtons = [],
  rootIdKey = 'id',
  idPrefix = '',
  excludeIds = []
} = {}) {
  if (!dropdown) return false;
  const panel = dropdown.panelBounds || dropdown.bounds;
  if (panel && pointInBounds(point, panel)) return false;
  const rootHit = resolveDesktopRootMenuHit({
    buttons: rootButtons,
    point,
    rootIdKey,
    idPrefix,
    excludeIds
  });
  return !rootHit;
}

export function resolveClosedDesktopDropdownState({
  dropdown = null,
  openRootId = null,
  fallbackRootId = null
} = {}) {
  return {
    closedRootId: dropdown?.rootId || openRootId || fallbackRootId || null,
    openRootId: null,
    dropdown: null
  };
}

export function resolveOpenDesktopDropdownState({
  rootId = null,
  currentOpenRootId = null,
  closedRootId = null,
  dropdown = null,
  skipIfAlreadyOpen = false,
  nowMs = null
} = {}) {
  const nextRootId = rootId || currentOpenRootId || null;
  if (!nextRootId) return null;
  if (skipIfAlreadyOpen && nextRootId === currentOpenRootId && !closedRootId) {
    return null;
  }
  const previousOpenedAtMs = Number(dropdown?.openedAtMs);
  const preserveOpenedAt = nextRootId === currentOpenRootId
    && Number.isFinite(previousOpenedAtMs)
    && !closedRootId;
  const openedAtMs = preserveOpenedAt
    ? previousOpenedAtMs
    : (Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now());
  return {
    closedRootId: null,
    openRootId: nextRootId,
    dropdown: dropdown
      ? { ...dropdown, openedAtMs }
      : { rootId: nextRootId, openedAtMs },
    openedAtMs
  };
}

export function resolveDesktopDropdownMotionProgress({
  dropdown = null,
  nowMs = null,
  durationMs = 120
} = {}) {
  const duration = Math.max(1, Number(durationMs) || 120);
  const rawOpenedAtMs = dropdown?.openedAtMs;
  if (rawOpenedAtMs == null) return 1;
  const openedAtMs = Number(rawOpenedAtMs);
  if (!Number.isFinite(openedAtMs) || openedAtMs <= 0) return 1;
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  return clampNumber((now - openedAtMs) / duration, 0, 1);
}

export function createPendingDesktopDropdownHit(hit = null, point = {}) {
  if (!hit) return null;
  return {
    ...hit,
    startX: Number(point.x) || 0,
    startY: Number(point.y) || 0,
    moved: false
  };
}

export function createDesktopDropdownCommandHit(item = {}, bounds = {}, action = null, extra = {}) {
  const id = item?.id || bounds?.id || extra?.id || null;
  const normalizedBounds = { ...bounds, ...(id ? { id } : {}) };
  return {
    ...bounds,
    ...extra,
    ...(id ? { id } : {}),
    bounds: normalizedBounds,
    action,
    onClick: action,
    kind: extra.kind || 'desktop-dropdown-item',
    desktopDropdownItem: true
  };
}

export function updatePendingDesktopDropdownHit(pending = null, point = {}, thresholdPx = 6) {
  if (!pending) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  const startX = Number(pending.startX);
  const startY = Number(pending.startY);
  if (
    Number.isFinite(x)
    && Number.isFinite(y)
    && Number.isFinite(startX)
    && Number.isFinite(startY)
    && Math.hypot(x - startX, y - startY) > Math.max(0, Number(thresholdPx) || 0)
  ) {
    return { ...pending, moved: true };
  }
  return pending;
}

export function resolvePendingDesktopDropdownHit(pending = null, point = {}) {
  if (!pending) {
    return { hit: null, releasedInside: false, shouldActivate: false };
  }
  const x = Number(point.x);
  const y = Number(point.y);
  const releasedInside = Number.isFinite(x) && Number.isFinite(y)
    ? pointInBounds({ x, y }, pending.bounds || pending)
    : true;
  return {
    hit: pending,
    releasedInside,
    shouldActivate: !pending.moved && releasedInside
  };
}

export function shouldCloseDesktopDropdownOnDomPointerDown({
  dropdown = null,
  event = null,
  menuSelector = ''
} = {}) {
  if (!dropdown) return false;
  const target = event?.target;
  if (menuSelector && target?.closest?.(menuSelector)) return false;
  return true;
}

export function getEditorPointerInteractionPolicy(editorId, {
  mode = EDITOR_LAYOUT_MODES.DESKTOP,
  pointerType = mode === EDITOR_LAYOUT_MODES.DESKTOP ? 'mouse' : 'touch',
  gamepadConnected = mode === EDITOR_LAYOUT_MODES.GAMEPAD
} = {}) {
  const workSurface = WORK_SURFACE_TYPES[editorId] || 'canvas';
  const desktop = mode === EDITOR_LAYOUT_MODES.DESKTOP;
  const gamepad = mode === EDITOR_LAYOUT_MODES.GAMEPAD || gamepadConnected;
  const touch = pointerType === 'touch' || mode === EDITOR_LAYOUT_MODES.PORTRAIT || mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH;
  const continuousPanEditors = new Set(['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car']);
  const contextMenuEditors = new Set(['pixel', 'level', 'actor', 'cutscene', 'race', 'car']);
  const fallbackPanEditors = new Set(['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car']);
  return {
    editorId,
    mode,
    pointerType,
    workSurface,
    menuScroll: getMenuScrollPolicy({ pointerType, mode }),
    workSurfaceGestures: {
      pinchZoom: touch,
      wheelZoom: desktop && ['canvas', 'stage', 'grid', 'timeline'].includes(workSurface),
      dragPan: desktop || touch || gamepad,
      rightDragPan: desktop && fallbackPanEditors.has(editorId),
      middleDragPan: desktop
    },
    thumbstick: {
      allowed: gamepad || (touch && continuousPanEditors.has(editorId)),
      showForMenus: false,
      showForWorkSurface: gamepad || (touch && continuousPanEditors.has(editorId)),
      avoidMenuOverlap: true
    },
    rightClick: {
      suppressBrowserMenu: true,
      opensContextMenu: desktop && contextMenuEditors.has(editorId),
      fallbackPan: desktop && fallbackPanEditors.has(editorId)
    }
  };
}

export function shouldSuppressEditorContextMenu({
  editorId = 'level',
  mode = EDITOR_LAYOUT_MODES.DESKTOP,
  pointerType = mode === EDITOR_LAYOUT_MODES.DESKTOP ? 'mouse' : 'touch',
  gamepadConnected = mode === EDITOR_LAYOUT_MODES.GAMEPAD
} = {}) {
  return Boolean(getEditorPointerInteractionPolicy(editorId, {
    mode,
    pointerType,
    gamepadConnected
  }).rightClick.suppressBrowserMenu);
}

export function isGamepadLandscapeEditorMode({
  viewportWidth = 0,
  viewportHeight = 0,
  gamepadConnected = false,
  isMobile = false,
  mobileMaxMinorAxis = 900
} = {}) {
  const width = Number(viewportWidth) || 0;
  const height = Number(viewportHeight) || 0;
  return Boolean(
    gamepadConnected
    && isMobile
    && Math.min(width, height) <= mobileMaxMinorAxis
    && width > height
  );
}

export function shouldUseGamepadSlideOutMenu({
  viewportWidth = 0,
  viewportHeight = 0,
  gamepadConnected = false,
  isMobile = false,
  menuActive = false,
  activeMenuId = null
} = {}) {
  return Boolean(
    isGamepadLandscapeEditorMode({ viewportWidth, viewportHeight, gamepadConnected, isMobile })
    && menuActive
    && activeMenuId
  );
}

export function resolveGamepadMenuState({
  viewportWidth = 0,
  viewportHeight = 0,
  gamepadConnected = false,
  isMobile = false,
  menuActive = false,
  activeMenuId = null,
  rootMenuId = 'root',
  overlayMenuIds = ['system', 'help', 'exit-confirm']
} = {}) {
  const overlayIds = new Set(overlayMenuIds || []);
  const isLandscapeMenuMode = isGamepadLandscapeEditorMode({
    viewportWidth,
    viewportHeight,
    gamepadConnected,
    isMobile
  });
  const activeSubmenuId = activeMenuId && activeMenuId !== rootMenuId && !overlayIds.has(activeMenuId)
    ? activeMenuId
    : null;
  const drawSlideOut = shouldUseGamepadSlideOutMenu({
    viewportWidth,
    viewportHeight,
    gamepadConnected,
    isMobile,
    menuActive,
    activeMenuId: activeSubmenuId
  });
  return {
    isLandscapeMenuMode,
    activeSubmenuId,
    drawSlideOut,
    drawControllerOverlay: !isLandscapeMenuMode || Boolean(activeMenuId && overlayIds.has(activeMenuId))
  };
}

export function buildDesktopTopMenuPlan(editorId, {
  bounds = {},
  activeRootId = null,
  labelOverrides = {},
  maxVisibleItems = Infinity,
  maxVisibleDropdownRows = undefined,
  dropdownScroll = 0
} = {}) {
  const menuBounds = { ...DEFAULT_TOP_MENU, ...bounds };
  const entries = getEditorRootMenuEntries(editorId, { labelOverrides });
  const visibleEntries = entries.slice(0, Math.max(0, maxVisibleItems));
  const overflowEntries = entries.slice(visibleEntries.length);
  const availableW = Math.max(1, menuBounds.w - menuBounds.padding * 2 - Math.max(0, visibleEntries.length - 1) * menuBounds.gap);
  const rawItemW = visibleEntries.length ? Math.floor(availableW / visibleEntries.length) : menuBounds.itemMinWidth;
  const desiredItemW = Math.min(menuBounds.itemMaxWidth, Math.max(menuBounds.itemMinWidth, rawItemW));
  const itemW = rawItemW < menuBounds.itemMinWidth
    ? Math.max(1, rawItemW)
    : desiredItemW;
  const minRecommendedWidth = menuBounds.padding * 2
    + visibleEntries.length * menuBounds.itemMinWidth
    + Math.max(0, visibleEntries.length - 1) * menuBounds.gap;
  const buttons = visibleEntries.map((entry, index) => ({
    ...entry,
    bounds: {
      x: menuBounds.x + menuBounds.padding + index * (itemW + menuBounds.gap),
      y: menuBounds.y,
      w: itemW,
      h: menuBounds.h
    },
    active: entry.id === activeRootId || entry.specId === activeRootId
  }));
  const dropdown = activeRootId
    ? buildDesktopDropdownPlan(editorId, activeRootId, {
      anchor: buttons.find((button) => button.id === activeRootId || button.specId === activeRootId)?.bounds,
      containerBounds: menuBounds,
      labelOverrides,
      ...(maxVisibleDropdownRows === undefined ? {} : { maxVisibleRows: maxVisibleDropdownRows }),
      scroll: dropdownScroll
    })
    : null;
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    bounds: menuBounds,
    buttons,
    overflowEntries,
    fit: {
      visibleCount: visibleEntries.length,
      totalCount: entries.length,
      itemWidth: itemW,
      desiredItemWidth: desiredItemW,
      minimumRecommendedWidth: minRecommendedWidth,
      isCompressed: itemW < menuBounds.itemMinWidth,
      hasHiddenOverflow: overflowEntries.length > 0,
      allRootMenusVisible: overflowEntries.length === 0
    },
    dropdown
  };
}

export function buildDesktopEditorShellPlan(editorId, {
  viewportWidth = 0,
  viewportHeight = 0,
  activeRootId = null,
  labelOverrides = {},
  topMenuHeight = DEFAULT_DESKTOP_SHELL.topMenuHeight,
  leftPanelWidth = null,
  leftRibbonHeight = DEFAULT_DESKTOP_SHELL.leftRibbonHeight,
  gap = DEFAULT_DESKTOP_SHELL.gap,
  minWorkSurfaceWidth = DEFAULT_DESKTOP_SHELL.minWorkSurfaceWidth,
  minWorkSurfaceHeight = DEFAULT_DESKTOP_SHELL.minWorkSurfaceHeight,
  dropdownScroll = 0
} = {}) {
  const width = Math.max(1, Number(viewportWidth) || 0);
  const height = Math.max(1, Number(viewportHeight) || 0);
  const topH = Math.max(0, Number(topMenuHeight) || 0);
  const spacing = Math.max(0, Number(gap) || 0);
  const standardPanelW = Math.round(Math.min(
    DEFAULT_DESKTOP_SHELL.leftPanelMaxWidth,
    Math.max(DEFAULT_DESKTOP_SHELL.leftPanelMinWidth, width * DEFAULT_DESKTOP_SHELL.leftPanelViewportRatio)
  ));
  const requestedPanelW = leftPanelWidth === null || leftPanelWidth === undefined
    ? standardPanelW
    : Number(leftPanelWidth) || 0;
  const panelW = Math.max(0, Math.min(requestedPanelW, width - spacing - minWorkSurfaceWidth));
  const ribbonH = Math.max(0, Number(leftRibbonHeight) || 0);
  const contentY = topH + spacing;
  const contentH = Math.max(1, height - contentY - spacing);
  const leftColumn = {
    x: spacing,
    y: contentY,
    w: Math.max(1, panelW - spacing),
    h: contentH
  };
  const leftRibbon = {
    x: leftColumn.x,
    y: leftColumn.y,
    w: leftColumn.w,
    h: Math.min(leftColumn.h, ribbonH)
  };
  const optionsY = leftRibbon.y + leftRibbon.h + spacing;
  const leftOptions = {
    x: leftColumn.x,
    y: optionsY,
    w: leftColumn.w,
    h: Math.max(1, leftColumn.y + leftColumn.h - optionsY)
  };
  const workX = leftColumn.x + leftColumn.w + spacing;
  const workSurface = {
    x: workX,
    y: contentY,
    w: Math.max(minWorkSurfaceWidth, width - workX - spacing),
    h: Math.max(minWorkSurfaceHeight, contentH)
  };
  const dropdownAvailableH = Math.max(34, height - topH - spacing);
  const maxVisibleDropdownRows = Math.max(1, Math.floor(dropdownAvailableH / 34));
  const modeContract = getEditorModeContract(EDITOR_LAYOUT_MODES.DESKTOP);
  const topMenu = buildDesktopTopMenuPlan(editorId, {
    bounds: { x: 0, y: 0, w: width, h: topH },
    activeRootId,
    labelOverrides,
    maxVisibleDropdownRows,
    dropdownScroll
  });
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    bounds: { x: 0, y: 0, w: width, h: height },
    topMenu,
    dropdown: topMenu.dropdown,
    commandSurface: 'top-dropdown',
    commandSurfaces: ['top-dropdown'],
    persistentSurfaces: ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface'],
    modeContract,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    suppressedMobileSurfaces: modeContract.suppressedModeSurfaces,
    leftPanelRole: 'context-inspector',
    duplicatesCommandsInLeftPanel: false,
    desktopMobileRailsHidden: true,
    presentation: modeContract.presentation,
    interaction: modeContract.interaction,
    leftColumn,
    leftRibbon,
    leftOptions,
    workSurface,
    scroll: {
      topMenu: { ...DEFAULT_DRAG_SCROLL, pointerType: 'mouse' },
      dropdown: { ...DEFAULT_DRAG_SCROLL, pointerType: 'mouse' },
      leftRibbon: { ...DEFAULT_DRAG_SCROLL, pointerType: 'mouse' },
      leftOptions: { ...DEFAULT_DRAG_SCROLL, pointerType: 'mouse' }
    }
  };
}

export function buildLandscapeTouchEditorShellPlan(editorId, {
  viewportWidth = 0,
  viewportHeight = 0,
  labelOverrides = {},
  leftRailWidth = null,
  rightRailWidth = null,
  bottomRailHeight = 0,
  topRailHeight = 0,
  reserveRightRail = true,
  reserveThumbstickSpace = true,
  rootDrawerOverlayOrigin = 'left',
  minLeftRailHeight = undefined,
  thumbstick = null,
  padding = undefined,
  gap = undefined
} = {}) {
  const layout = getSharedMobileLandscapeEditorLayout(viewportWidth, viewportHeight, {
    leftRailWidth: leftRailWidth ?? COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH,
    rightRailWidth,
    bottomRailHeight,
    reserveRightRail,
    reserveThumbstickSpace,
    ...(minLeftRailHeight === undefined ? {} : { minLeftRailHeight }),
    thumbstick,
    ...(padding === undefined ? {} : { padding }),
    ...(gap === undefined ? {} : { gap })
  });
  const safeTopRailHeight = clampNumber(
    Math.round(Number(topRailHeight) || 0),
    0,
    Math.max(0, (layout.workSurface?.h || 0) - 1)
  );
  const topRail = safeTopRailHeight > 0
    ? {
      x: layout.workSurface.x,
      y: layout.workSurface.y,
      w: layout.workSurface.w,
      h: safeTopRailHeight
    }
    : null;
  const resolvedWorkSurface = topRail
    ? {
      ...layout.workSurface,
      y: topRail.y + topRail.h + layout.gap,
      h: Math.max(1, layout.workSurface.h - topRail.h - layout.gap)
    }
    : layout.workSurface;
  const resolvedLayout = topRail
    ? {
      ...layout,
      topRail,
      workSurface: resolvedWorkSurface,
      mainEditor: resolvedWorkSurface
    }
    : layout;
  const useLeftRootOverlay = rootDrawerOverlayOrigin === 'left';
  const leftRootDrawerX = layout.leftRail.x + layout.leftRail.w + layout.gap;
  const safeViewportWidth = Math.max(1, Number(viewportWidth) || 1);
  const leftRootDrawerRight = reserveRightRail && layout.rightRail?.w > 0
    ? Math.max(leftRootDrawerX + 1, layout.rightRail.x - layout.gap)
    : safeViewportWidth - layout.padding;
  const leftRootDrawer = {
    x: leftRootDrawerX,
    y: 0,
    w: Math.min(
      layout.overlayDrawer.w,
      Math.max(1, leftRootDrawerRight - leftRootDrawerX)
    ),
    h: layout.overlayDrawer.h
  };
  const rootDrawer = useLeftRootOverlay
    ? leftRootDrawer
    : (reserveRightRail ? layout.rightRail : layout.overlayDrawer);
  const modeContract = getEditorModeContract(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  const presentation = {
    ...modeContract.presentation,
    commandSurface: reserveRightRail ? modeContract.presentation.commandSurface : null,
    submenuSurface: reserveRightRail ? modeContract.presentation.submenuSurface : null,
    persistentContextSurface: bottomRailHeight > 0 ? modeContract.presentation.persistentContextSurface : null,
    rootDrawerSurface: useLeftRootOverlay
      ? modeContract.presentation.rootDrawerSurface
      : (reserveRightRail ? 'right-drawer' : 'right-overlay-drawer'),
    rootDrawerOverlayOrigin: useLeftRootOverlay ? modeContract.presentation.rootDrawerOverlayOrigin : 'right',
    rootDrawerKeepsSubmenuVisible: reserveRightRail,
    rightSubmenuSurface: reserveRightRail ? modeContract.presentation.rightSubmenuSurface : null
  };
  const resolvedModeContract = {
    ...modeContract,
    presentation
  };
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    placement: getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH),
    rootMenuSurface: 'left-rail',
    submenuSurface: reserveRightRail ? 'right-drawer' : null,
    bottomRailRole: bottomRailHeight > 0 ? 'tool-options-ribbons-zoom' : null,
    gestureScroll: true,
    bounds: {
      x: 0,
      y: 0,
      w: Math.max(1, Number(viewportWidth) || 0),
      h: Math.max(1, Number(viewportHeight) || 0)
    },
    labelOverrides,
    ...resolvedLayout,
    compactCommandRailSurface: 'left-rail',
    compactCommandRailActionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT,
    rootDrawerSurface: useLeftRootOverlay ? 'left-overlay-drawer' : (reserveRightRail ? 'right-drawer' : 'right-overlay-drawer'),
    rootDrawerOverlayOrigin: useLeftRootOverlay ? 'left' : 'right',
    modeContract: resolvedModeContract,
    presentation,
    interaction: modeContract.interaction,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    suppressedDesktopSurfaces: modeContract.suppressedModeSurfaces
      .filter((surface) => surface.startsWith('desktop-')),
    leftRootDrawer,
    surfaces: {
      compactCommandRail: layout.leftRail,
      rootMenu: layout.leftRail,
      rootDrawer,
      submenu: reserveRightRail ? layout.rightRail : null,
      overlayDrawer: layout.overlayDrawer,
      topRail,
      toolOptions: bottomRailHeight > 0 ? layout.bottomRail : null,
      zoom: topRail || (bottomRailHeight > 0 ? layout.bottomRail : null),
      ribbon: bottomRailHeight > 0 ? layout.bottomRail : null,
      workSurface: resolvedLayout.workSurface || resolvedLayout.mainEditor
    },
    scroll: {
      compactCommandRail: { ...DEFAULT_DRAG_SCROLL, enabled: false, pointerType: 'touch' },
      rootDrawer: { ...DEFAULT_DRAG_SCROLL, pointerType: 'touch' },
      leftRail: { ...DEFAULT_DRAG_SCROLL, enabled: false, pointerType: 'touch' },
      rightRail: { ...DEFAULT_DRAG_SCROLL, pointerType: 'touch' },
      bottomRail: { ...DEFAULT_DRAG_SCROLL, pointerType: 'touch' },
      workSurface: {
        ...DEFAULT_DRAG_SCROLL,
        pointerType: 'touch',
        pinchZoomReservedForWorkSurface: true
      }
    }
  };
}

export function buildCompactLandscapeCommandRailActions({
  menu = null,
  undo = null,
  redo = null,
  quick = null
} = {}) {
  const displayLabels = {
    menu: '\u2630',
    'landscape-menu': '\u2630',
    undo: '\u21b6',
    redo: '\u21b7'
  };
  return [menu, undo, redo, quick]
    .filter(Boolean)
    .slice(0, COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT)
    .map((action) => ({
      ...action,
      displayLabel: action.displayLabel ?? displayLabels[action.id] ?? action.label
    }));
}

export function buildCompactLandscapeCommandRailButtonLayout({
  bounds = {},
  actions = [],
  buttonHeight = 44,
  buttonGap = 8,
  paddingX = 6,
  paddingY = 8,
  maxButtonWidth = null
} = {}) {
  const source = (Array.isArray(actions) ? actions : [])
    .filter(Boolean)
    .slice(0, COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT);
  const rail = {
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    w: Math.max(1, Number(bounds.w) || 1),
    h: Math.max(1, Number(bounds.h) || 1)
  };
  const padX = Math.max(0, Number(paddingX) || 0);
  const padY = Math.max(0, Number(paddingY) || 0);
  const rowH = Math.max(1, Number(buttonHeight) || 1);
  const gap = Math.max(0, Number(buttonGap) || 0);
  const listBounds = {
    x: rail.x + padX,
    y: rail.y + padY,
    w: Math.max(1, rail.w - padX * 2),
    h: Math.max(1, rail.h - padY * 2)
  };
  const buttonW = Math.min(
    listBounds.w,
    Math.max(1, Number(maxButtonWidth) || listBounds.w)
  );
  const totalH = source.length * rowH + Math.max(0, source.length - 1) * gap;
  const startY = listBounds.y + Math.max(0, Math.floor((listBounds.h - totalH) / 2));
  return source.map((action, index) => ({
    action,
    bounds: {
      x: listBounds.x + (listBounds.w - buttonW) * 0.5,
      y: startY + index * (rowH + gap),
      w: buttonW,
      h: rowH,
      id: action.id
    }
  }));
}

export function buildLandscapeRootDrawerGridLayout({
  bounds = {},
  itemCount = 0,
  padding = 8,
  gap = 8,
  minColumns = 3,
  maxColumns = 4,
  wideWidth = 340,
  rowHeight = 40,
  maxRowHeight = 42,
  minRowHeight = 38,
  headerHeight = 0
} = {}) {
  const panel = {
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    w: Math.max(1, Number(bounds.w) || 1),
    h: Math.max(1, Number(bounds.h) || 1)
  };
  const pad = Math.max(0, Number(padding) || 0);
  const itemGap = Math.max(0, Number(gap) || 0);
  const minCols = Math.max(1, Math.floor(Number(minColumns) || 1));
  const maxCols = Math.max(minCols, Math.floor(Number(maxColumns) || minCols));
  const cols = panel.w >= Math.max(1, Number(wideWidth) || 1) ? maxCols : minCols;
  const rowH = Math.max(
    1,
    Math.min(
      Math.max(1, Number(maxRowHeight) || Number(rowHeight) || 1),
      Math.max(Math.max(1, Number(minRowHeight) || 1), Number(rowHeight) || 1)
    )
  );
  const headerH = Math.max(0, Number(headerHeight) || 0);
  const listBounds = {
    x: panel.x + pad,
    y: panel.y + pad + headerH,
    w: Math.max(1, panel.w - pad * 2),
    h: Math.max(1, panel.h - pad * 2 - headerH)
  };
  const safeCount = Math.max(0, Math.floor(Number(itemCount) || 0));
  const buttonW = Math.max(1, Math.floor((listBounds.w - Math.max(0, cols - 1) * itemGap) / cols));
  const rows = Math.max(1, Math.ceil(safeCount / cols));
  const contentHeight = rows * rowH + Math.max(0, rows - 1) * itemGap;
  const maxScroll = Math.max(0, Math.ceil((contentHeight - listBounds.h) / Math.max(1, rowH + itemGap)));
  const items = Array.from({ length: safeCount }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      index,
      col,
      row,
      bounds: {
        x: listBounds.x + col * (buttonW + itemGap),
        y: listBounds.y + row * (rowH + itemGap),
        w: buttonW,
        h: rowH
      }
    };
  });
  return {
    panel,
    listBounds,
    columns: cols,
    rowHeight: rowH,
    gap: itemGap,
    buttonWidth: buttonW,
    contentHeight,
    maxScroll,
    lineHeight: rowH + itemGap,
    items
  };
}

export function buildScrolledLandscapeRootDrawerItems(grid = {}, scroll = 0) {
  const items = Array.isArray(grid.items) ? grid.items : [];
  const listBounds = grid.listBounds || { x: 0, y: 0, w: 1, h: 1 };
  const lineHeight = Math.max(1, Number(grid.lineHeight) || 1);
  const maxScroll = Math.max(0, Number(grid.maxScroll) || 0);
  const scrollIndex = clampNumber(Math.round(Number(scroll) || 0), 0, maxScroll);
  const visibleItems = items
    .map((item) => {
      const sourceBounds = item?.bounds || {};
      const bounds = {
        ...sourceBounds,
        y: (Number(sourceBounds.y) || 0) - scrollIndex * lineHeight
      };
      return { ...item, bounds };
    })
    .filter((item) => item.bounds.y + item.bounds.h >= listBounds.y
      && item.bounds.y <= listBounds.y + listBounds.h);
  return {
    scroll: scrollIndex,
    maxScroll,
    lineHeight,
    listBounds,
    items: visibleItems
  };
}

export function buildDesktopDropdownPlan(editorId, rootId, {
  anchor = null,
  containerBounds = null,
  labelOverrides = {},
  rowHeight = 34,
  minWidth = 220,
  maxVisibleRows = 12,
  padding = 8,
  rowGap = 4,
  scroll = 0
} = {}) {
  const spec = getEditorMenuSpec(editorId);
  const rootEntry = getEditorRootMenuEntries(editorId, { labelOverrides })
    .find((entry) => entry.id === rootId || entry.specId === rootId);
  const sectionId = rootEntry?.specId || rootId;
  const section = spec?.sections?.[sectionId];
  const items = (section?.actions || []).map((actionId) => ({
    id: actionId,
    label: spec?.actions?.[actionId]?.label || labelOverrides[actionId] || actionId
  }));
  const visibleRows = Math.min(maxVisibleRows, Math.max(1, items.length || 1));
  const width = Math.max(minWidth, anchor?.w || 0);
  const minX = containerBounds?.x ?? 0;
  const maxX = containerBounds
    ? Math.max(minX, containerBounds.x + containerBounds.w - width - (containerBounds.padding || 0))
    : Infinity;
  const bounds = {
    x: Math.max(minX, Math.min(anchor?.x || 0, maxX)),
    y: (anchor?.y || 0) + (anchor?.h || 0),
    w: width,
    h: visibleRows * rowHeight
  };
  const maxScroll = Math.max(0, items.length - visibleRows);
  const scrollIndex = Math.max(0, Math.min(maxScroll, Math.round(Number(scroll) || 0)));
  const renderedItems = items.slice(scrollIndex, scrollIndex + visibleRows);
  const panelBounds = {
    ...bounds,
    h: Math.max(rowHeight, renderedItems.length * rowHeight)
  };
  const itemRowHeight = Math.max(24, rowHeight - rowGap);
  const itemBounds = renderedItems.map((item, index) => ({
    id: item.id,
    x: panelBounds.x + padding,
    y: panelBounds.y + index * rowHeight + Math.floor(rowGap / 2),
    w: Math.max(1, panelBounds.w - padding * 2),
    h: itemRowHeight
  }));
  return {
    editorId,
    rootId: rootEntry?.id || rootId,
    specId: sectionId,
    title: section?.label || rootEntry?.label || '',
    bounds,
    panelBounds,
    rowHeight,
    padding,
    rowGap,
    visibleRows,
    scrollIndex,
    maxScroll,
    items,
    renderedItems,
    itemBounds,
    scroll: { ...DEFAULT_DRAG_SCROLL }
  };
}

export function buildDesktopDropdownRenderPlan({
  dropdown = null,
  items = [],
  hiddenIds = [],
  useVisibleItemsSlice = false,
  disableActionlessItems = false,
  motionProgress = null,
  motionDurationMs = 120
} = {}) {
  if (!dropdown) {
    return {
      menuId: null,
      visibleItems: [],
      actionById: new Map(),
      renderedItems: [],
      panelBounds: null,
      itemBounds: [],
      motion: {
        type: 'slide-down',
        progress: 0,
        durationMs: Math.max(0, Math.round(Number(motionDurationMs) || 0)),
        origin: 'top-menu',
        translateY: 0,
        opacity: 0
      }
    };
  }
  const hidden = new Set(hiddenIds || []);
  const sourceItems = Array.isArray(items) && items.length ? items : (dropdown.items || []);
  const hasItemAction = (item) => (
    typeof item?.onSelect === 'function'
    || typeof item?.onClick === 'function'
    || typeof item?.action === 'function'
  );
  const seenActionIds = new Set();
  const visibleItems = sourceItems.filter((item) => {
    if (!item) return false;
    if (item.divider || item.separator) return true;
    if (hidden.has(item.id)) return false;
    if (item.id && seenActionIds.has(item.id)) return false;
    if (item.id) seenActionIds.add(item.id);
    return true;
  }).map((item) => {
    if (!disableActionlessItems || item.divider || item.separator) return item;
    return {
      ...item,
      disabled: Boolean(item.disabled) || !hasItemAction(item)
    };
  });
  const hasVisualSeparators = visibleItems.some((item) => item.divider || item.separator);
  const actionById = new Map(visibleItems
    .filter((item) => !item.divider && !item.separator)
    .map((item) => [item.id, item]));
  const visibleRows = Math.max(1, Number(dropdown.visibleRows) || 1);
  const maxScroll = Math.max(0, visibleItems.length - visibleRows);
  const scrollIndex = Math.max(0, Math.min(maxScroll, Math.round(Number(dropdown.scrollIndex) || 0)));
  const renderedItems = useVisibleItemsSlice || hidden.size || hasVisualSeparators
    ? visibleItems.slice(scrollIndex, scrollIndex + visibleRows)
    : (dropdown.renderedItems || []).map((item) => actionById.get(item.id) || item);
  const panelBounds = {
    ...dropdown.panelBounds,
    h: Math.max(dropdown.rowHeight || 1, renderedItems.length * (dropdown.rowHeight || 1))
  };
  const progress = motionProgress != null && Number.isFinite(Number(motionProgress))
    ? clampNumber(Number(motionProgress), 0, 1)
    : resolveDesktopDropdownMotionProgress({ dropdown, durationMs: motionDurationMs });
  const slideDistance = Math.min(18, Math.max(6, panelBounds.h * 0.18));
  const motion = {
    type: 'slide-down',
    progress,
    durationMs: Math.max(0, Math.round(Number(motionDurationMs) || 0)),
    origin: 'top-menu',
    translateY: Math.round((progress - 1) * slideDistance * 1000) / 1000,
    opacity: Math.round((0.72 + progress * 0.28) * 1000) / 1000
  };
  const rowHeight = Math.max(1, Number(dropdown.rowHeight) || 1);
  const rowGap = Math.max(0, Number(dropdown.rowGap) || 0);
  const padding = Math.max(0, Number(dropdown.padding) || 0);
  const itemRowHeight = Math.max(24, rowHeight - rowGap);
  const itemBounds = renderedItems.map((item, index) => ({
    ...(dropdown.itemBounds?.[index] || {
      x: panelBounds.x + padding,
      y: panelBounds.y + index * rowHeight + Math.floor(rowGap / 2),
      w: Math.max(1, panelBounds.w - padding * 2),
      h: itemRowHeight
    }),
    id: item.id || `separator-${index}`
  }));
  const scrollRegion = maxScroll > 0
    ? {
      menuId: dropdown.rootId || dropdown.specId || 'desktop-dropdown',
      bounds: { ...panelBounds },
      maxScroll,
      lineHeight: rowHeight,
      scrollScale: 1 / rowHeight,
      pointerType: 'mouse'
    }
    : null;
  return {
    menuId: dropdown.specId || dropdown.rootId,
    visibleItems,
    actionById,
    renderedItems,
    panelBounds,
    itemBounds,
    scrollIndex,
    maxScroll,
    visibleRows,
    scrollRegion,
    scroll: {
      ...DEFAULT_DRAG_SCROLL,
      pointerType: 'mouse',
      wheelRoutesToHoveredPanel: true
    },
    motion
  };
}

export function buildGamepadSlideOutMenuPlan(editorId, {
  rootOpen = true,
  activeRootId = null,
  focusedItemId = null,
  labelOverrides = {}
} = {}) {
  const rootEntries = getEditorControllerRootMenuEntries(editorId, { labelOverrides });
  const activeRoot = rootEntries.find((entry) => entry.id === activeRootId || entry.specId === activeRootId)
    || rootEntries[0]
    || null;
  const submenu = activeRoot && !rootOpen
    ? buildDesktopDropdownPlan(editorId, activeRoot.id, { labelOverrides })
    : null;
  const gamepadSubmenu = submenu
    ? {
      ...submenu,
      surface: 'left-slide-out-drawer',
      sourceSurface: 'gamepad-slide-out',
      replacesRootRail: true,
      rightSubmenuSurface: null,
      rowActivation: 'confirm-button',
      pointerType: 'controller',
      gestureScroll: true,
      scroll: {
        ...DEFAULT_DRAG_SCROLL,
        pointerType: 'controller',
        mode: EDITOR_LAYOUT_MODES.GAMEPAD
      }
    }
    : null;
  const focusedRootEntry = rootEntries.find((entry) => (
    entry.id === focusedItemId
    || entry.specId === focusedItemId
    || entry.controllerMenuId === focusedItemId
  )) || (rootOpen ? activeRoot : null);
  const submenuItems = gamepadSubmenu?.items || [];
  const focusedSubmenuItem = submenuItems.find((item) => item.id === focusedItemId) || null;
  const modeContract = getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD);
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    rootMenuSurface: 'left-slide-rail',
    submenuSurface: 'left-slide-out-drawer',
    submenuReplacesRootRail: true,
    rightSubmenuSurface: null,
    modeContract,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    suppressedTouchSurfaces: modeContract.suppressedModeSurfaces
      .filter((surface) => (
        surface.startsWith('landscape-')
        || surface.startsWith('bottom-')
        || surface.startsWith('touch-')
      )),
    rootOpen,
    rootCollapsed: Boolean(activeRoot && !rootOpen),
    activeRootId: activeRoot?.id || null,
    activeSpecId: activeRoot?.specId || null,
    focusedItemId,
    focusedRootEntry,
    focusedSubmenuItem,
    presentation: modeContract.presentation,
    interaction: modeContract.interaction,
    focus: {
      surface: rootOpen ? 'root' : 'submenu',
      rootItemId: focusedRootEntry?.id || null,
      submenuItemId: focusedSubmenuItem?.id || (!rootOpen ? focusedItemId : null)
    },
    rootEntries,
    submenu: gamepadSubmenu,
    controls: {
      confirm: 'A',
      back: 'B',
      system: 'Start',
      focusToggle: 'Back',
      siblingPrev: 'LB',
      siblingNext: 'RB'
    },
    headerHint: 'A Select  B Back  LB/RB Tabs',
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL, pointerType: 'controller', mode: EDITOR_LAYOUT_MODES.GAMEPAD },
      submenu: { ...DEFAULT_DRAG_SCROLL, pointerType: 'controller', mode: EDITOR_LAYOUT_MODES.GAMEPAD }
    }
  };
}
