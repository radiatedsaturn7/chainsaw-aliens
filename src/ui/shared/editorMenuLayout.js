import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  SHARED_EDITOR_IDS,
  SUPPORTED_EDITOR_WORK_SURFACES,
  getEditorControllerRootMenuEntries,
  getEditorEditActionRole,
  getEditorMenuModeContract,
  getEditorMenuSpec,
  getEditorWorkSurfaceType,
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

const CONTINUOUS_PAN_EDITOR_IDS = new Set(SHARED_EDITOR_IDS);
const FALLBACK_PAN_EDITOR_IDS = new Set(SHARED_EDITOR_IDS);
const DESKTOP_CONTEXT_MENU_EDITOR_IDS = new Set(['pixel', 'level', 'actor', 'cutscene', 'race', 'car']);

export const COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT = 4;
export const COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH = 84;
export const EDITOR_SURFACES = Object.freeze({
  bottomRail: 'bottom-rail',
  bottomSheet: 'bottom-sheet',
  bottomActionRail: 'bottom-action-rail',
  bottomToolRail: 'bottom-tool-rail',
  touchThumbstick: 'touch-thumbstick',
  leftRail: 'left-rail',
  leftOverlayDrawer: 'left-overlay-drawer',
  rightDrawer: 'right-drawer',
  rightOverlayDrawer: 'right-overlay-drawer',
  landscapeRootDrawer: 'landscape-root-drawer',
  landscapeRightSubmenu: 'landscape-right-submenu',
  desktopTopMenu: 'desktop-top-menu',
  desktopDropdown: 'desktop-dropdown',
  desktopLeftInspector: 'desktop-left-inspector',
  topMenu: 'top-menu',
  topDropdown: 'top-dropdown',
  leftRibbon: 'left-ribbon',
  leftContextPanel: 'left-context-panel',
  workSurface: 'work-surface',
  workSurfaceOverlay: 'work-surface-overlay',
  gamepadHintBar: 'gamepad-hint-bar',
  gamepadSlideOut: 'gamepad-slide-out',
  leftSlideRail: 'left-slide-rail',
  leftSlideOutDrawer: 'left-slide-out-drawer'
});
export const LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT = {
  rootSurface: EDITOR_SURFACES.leftRail,
  compactCommandRailSurface: EDITOR_SURFACES.leftRail,
  commandSurface: EDITOR_SURFACES.rightDrawer,
  submenuSurface: EDITOR_SURFACES.rightDrawer,
  rightSubmenuSurface: EDITOR_SURFACES.rightDrawer,
  persistentContextSurface: EDITOR_SURFACES.bottomRail,
  rootDrawerSurface: EDITOR_SURFACES.leftOverlayDrawer,
  rootDrawerOverlayOrigin: 'left',
  rootDrawerKeepsSubmenuVisible: true,
  bottomRailRole: 'tool-options-ribbons-zoom',
  suppressedDesktopSurfaces: [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector
  ],
  compactCommandRail: {
    width: COMPACT_LANDSCAPE_COMMAND_RAIL_WIDTH,
    actionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT,
    commandRail: 'compact-landscape',
    rowActivation: 'tap-release',
    pointerType: 'touch',
    gestureScroll: false
  }
};
export const GAMEPAD_SLIDE_OUT_MENU_CONTRACT = {
  sourceSurface: EDITOR_SURFACES.gamepadSlideOut,
  rootSurface: EDITOR_SURFACES.leftSlideRail,
  submenuSurface: EDITOR_SURFACES.leftSlideOutDrawer,
  rightSubmenuSurface: null,
  submenuReplacesRootRail: true,
  rowActivation: 'confirm-button',
  pointerType: 'controller',
  gestureScroll: true,
  controls: {
    confirm: 'A',
    back: 'B',
    system: 'Start',
    focusToggle: 'Back',
    siblingPrev: 'LB',
    siblingNext: 'RB'
  },
  suppressedTouchSurfaces: [
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick
  ]
};
export const DESKTOP_CONTEXT_PANEL_CONTRACT = {
  surface: EDITOR_SURFACES.leftContextPanel,
  role: 'context-inspector',
  persistent: true,
  drawerCommandsStayInTopDropdown: true,
  duplicatesTopDropdownCommands: false,
  allowedContentRoles: [
    'document-summary',
    'selection-summary',
    'active-tool-summary',
    'transport',
    'status',
    'contextual-quick-actions'
  ],
  contextualQuickActionPolicy: {
    allowed: true,
    mustBeContextual: true,
    mustNotDuplicateOpenDropdown: true
  }
};
export const DESKTOP_SHELL_SURFACE_CONTRACT = {
  commandSurface: EDITOR_SURFACES.topDropdown,
  commandSurfaces: [EDITOR_SURFACES.topDropdown],
  persistentSurfaces: [EDITOR_SURFACES.topMenu, EDITOR_SURFACES.leftRibbon, EDITOR_SURFACES.leftContextPanel, EDITOR_SURFACES.workSurface],
  leftPanelRole: 'context-inspector',
  duplicatesCommandsInLeftPanel: false,
  desktopMobileRailsHidden: true,
  suppressedMobileSurfaces: [
    EDITOR_SURFACES.bottomActionRail,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.gamepadHintBar,
    EDITOR_SURFACES.gamepadSlideOut
  ]
};
export const DESKTOP_DROPDOWN_COMMAND_CONTRACT = {
  commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
  pointerType: 'mouse',
  rowActivation: 'release',
  kind: 'desktop-dropdown-item',
  desktopDropdownItem: true
};
export const DESKTOP_DROPDOWN_STATE_CONTRACT = {
  commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
  openedAtField: 'openedAtMs',
  motion: {
    type: 'slide-down',
    durationMs: 120,
    origin: EDITOR_SURFACES.topMenu
  },
  startsClosed: true,
  preservesOpenedAtForSameRoot: true,
  clickAwayPersistsClosedRoot: true
};
export const GAMEPAD_FOCUS_RING_CONTRACT = {
  visibleOnFocusedRows: true,
  surfaces: [GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface, GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface],
  rowActivation: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation,
  pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
  sourceSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface,
  focusRing: 'shared-focus-ring'
};

export const SUPPRESSED_MODE_SURFACES = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.gamepadSlideOut
  ],
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.gamepadSlideOut
  ],
  [EDITOR_LAYOUT_MODES.DESKTOP]: [
    EDITOR_SURFACES.bottomActionRail,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.gamepadHintBar,
    EDITOR_SURFACES.gamepadSlideOut
  ],
  [EDITOR_LAYOUT_MODES.GAMEPAD]: [
    EDITOR_SURFACES.desktopTopMenu,
    EDITOR_SURFACES.desktopDropdown,
    EDITOR_SURFACES.desktopLeftInspector,
    EDITOR_SURFACES.landscapeRightSubmenu,
    EDITOR_SURFACES.landscapeRootDrawer,
    EDITOR_SURFACES.bottomToolRail,
    EDITOR_SURFACES.touchThumbstick
  ]
};

export const REQUIRED_MODE_SURFACES = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: [
    EDITOR_SURFACES.bottomRail,
    EDITOR_SURFACES.bottomSheet,
    EDITOR_SURFACES.bottomActionRail
  ],
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: [
    EDITOR_SURFACES.leftRail,
    EDITOR_SURFACES.leftOverlayDrawer,
    EDITOR_SURFACES.rightDrawer,
    EDITOR_SURFACES.bottomRail
  ],
  [EDITOR_LAYOUT_MODES.DESKTOP]: [
    EDITOR_SURFACES.topMenu,
    EDITOR_SURFACES.topDropdown,
    EDITOR_SURFACES.leftRibbon,
    EDITOR_SURFACES.leftContextPanel,
    EDITOR_SURFACES.workSurface
  ],
  [EDITOR_LAYOUT_MODES.GAMEPAD]: [
    EDITOR_SURFACES.leftSlideRail,
    EDITOR_SURFACES.leftSlideOutDrawer,
    EDITOR_SURFACES.workSurfaceOverlay
  ]
};

export function getEditorModeSurfaceContract(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  const resolvedMode = Object.values(EDITOR_LAYOUT_MODES).includes(mode)
    ? mode
    : EDITOR_LAYOUT_MODES.DESKTOP;
  return {
    mode: resolvedMode,
    requiredModeSurfaces: [...(REQUIRED_MODE_SURFACES[resolvedMode] || [])],
    suppressedModeSurfaces: [...(SUPPRESSED_MODE_SURFACES[resolvedMode] || [])],
    surfaceVisibility: getEditorModeSurfaceVisibility(resolvedMode)
  };
}

export function getEditorModeSurfaceVisibility(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  const resolvedMode = Object.values(EDITOR_LAYOUT_MODES).includes(mode)
    ? mode
    : EDITOR_LAYOUT_MODES.DESKTOP;
  const visibility = {};
  (REQUIRED_MODE_SURFACES[resolvedMode] || []).forEach((surface) => {
    visibility[surface] = 'required';
  });
  (SUPPRESSED_MODE_SURFACES[resolvedMode] || []).forEach((surface) => {
    visibility[surface] = 'suppressed';
  });
  return visibility;
}

export function getEditorSurfaceVisibility(mode = EDITOR_LAYOUT_MODES.DESKTOP, surface = '') {
  const visibility = getEditorModeSurfaceVisibility(mode);
  return visibility[String(surface || '')] || 'optional';
}

export function canRenderEditorSurface(mode = EDITOR_LAYOUT_MODES.DESKTOP, surface = '') {
  return getEditorSurfaceVisibility(mode, surface) !== 'suppressed';
}

export function getEditorPlanSurfaceVisibility(plan = null, surface = '') {
  const key = String(surface || '');
  if (!key) return 'optional';
  return plan?.effectiveSurfaceVisibility?.[key]
    || plan?.surfaceVisibility?.[key]
    || 'optional';
}

export function canRenderEditorPlanSurface(plan = null, surface = '') {
  return getEditorPlanSurfaceVisibility(plan, surface) !== 'suppressed';
}

export function getLandscapeTouchShellEffectiveSurfaceVisibility({
  reserveRightRail = true,
  bottomRailHeight = 0
} = {}) {
  const visibility = {
    ...getEditorModeSurfaceVisibility(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH)
  };
  if (!reserveRightRail) {
    visibility[EDITOR_SURFACES.rightDrawer] = 'suppressed';
    visibility[EDITOR_SURFACES.landscapeRightSubmenu] = 'suppressed';
  }
  visibility[EDITOR_SURFACES.leftOverlayDrawer] = 'required';
  visibility[EDITOR_SURFACES.rightOverlayDrawer] = 'optional';
  if (Number(bottomRailHeight) <= 0) {
    visibility[EDITOR_SURFACES.bottomRail] = 'optional';
    visibility[EDITOR_SURFACES.bottomToolRail] = 'optional';
  } else {
    visibility[EDITOR_SURFACES.bottomRail] = 'required';
    visibility[EDITOR_SURFACES.bottomToolRail] = 'required';
  }
  return visibility;
}

export function validateEditorModeSurfaceContracts() {
  const errors = [];
  const knownSurfaces = new Set(Object.values(EDITOR_SURFACES));
  const assertKnownSurface = (mode, source, surface) => {
    if (surface === null || surface === undefined) return;
    if (!knownSurfaces.has(surface)) errors.push(`${mode} ${source} uses unknown editor surface "${surface}".`);
  };
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
    (required || []).forEach((surface) => assertKnownSurface(mode, 'requiredModeSurfaces', surface));
    (suppressed || []).forEach((surface) => assertKnownSurface(mode, 'suppressedModeSurfaces', surface));
    const presentation = MODE_PRESENTATION_CONTRACTS[mode] || {};
    [
      'rootSurface',
      'commandSurface',
      'submenuSurface',
      'persistentContextSurface',
      'persistentNavigationSurface',
      'rootDrawerSurface',
      'rightSubmenuSurface'
    ].forEach((key) => assertKnownSurface(mode, `presentation.${key}`, presentation[key]));
  });
  return errors;
}

export const MODE_PRESENTATION_CONTRACTS = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
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
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
    rootSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootSurface,
    commandSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.commandSurface,
    submenuSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.submenuSurface,
    persistentContextSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.persistentContextSurface,
    persistentNavigationSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface,
    rootDrawerSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface,
    rootDrawerOverlayOrigin: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerOverlayOrigin,
    rootDrawerKeepsSubmenuVisible: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerKeepsSubmenuVisible,
    submenuReplacesRootRail: false,
    rightSubmenuSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rightSubmenuSurface
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
    rootSurface: EDITOR_SURFACES.topMenu,
    commandSurface: EDITOR_SURFACES.topDropdown,
    submenuSurface: EDITOR_SURFACES.topDropdown,
    persistentContextSurface: EDITOR_SURFACES.leftContextPanel,
    persistentNavigationSurface: EDITOR_SURFACES.topMenu,
    rootDrawerSurface: null,
    rootDrawerOverlayOrigin: null,
    rootDrawerKeepsSubmenuVisible: false,
    submenuReplacesRootRail: false,
    rightSubmenuSurface: null
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
    rootSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface,
    commandSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface,
    submenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface,
    persistentContextSurface: EDITOR_SURFACES.workSurfaceOverlay,
    persistentNavigationSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface,
    rootDrawerSurface: null,
    rootDrawerOverlayOrigin: null,
    rootDrawerKeepsSubmenuVisible: false,
    submenuReplacesRootRail: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail,
    rightSubmenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rightSubmenuSurface
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
    pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
    rowActivation: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation,
    gestureScroll: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.gestureScroll,
    wheelRoutesToHoveredPanel: false,
    pinchZoomReservedForWorkSurface: true,
    confirm: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.confirm,
    back: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.back,
    siblingPrev: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.siblingPrev,
    siblingNext: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.siblingNext
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
    surfaceVisibility: surface.surfaceVisibility,
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
  if (gamepad.pointerType !== GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType) errors.push(`gamepad pointerType must be ${GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType}.`);
  if (gamepad.rowActivation !== GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation) errors.push(`gamepad rowActivation must be ${GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation}.`);
  if (gamepad.confirm !== GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.confirm || gamepad.back !== GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.back) {
    errors.push(`gamepad confirm/back controls must be ${GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.confirm}/${GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls.back}.`);
  }
  if (gamepadPresentation.submenuReplacesRootRail !== GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail) errors.push(`gamepad submenuReplacesRootRail must be ${GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail}.`);
  [EDITOR_LAYOUT_MODES.PORTRAIT, EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH].forEach((mode) => {
    const interaction = MODE_INTERACTION_CONTRACTS[mode] || {};
    if (interaction.pointerType !== 'touch') errors.push(`${mode} pointerType must be touch.`);
    if (interaction.rowActivation !== 'tap-release') errors.push(`${mode} rowActivation must be tap-release.`);
    if (interaction.gestureScroll !== true) errors.push(`${mode} gestureScroll must be true.`);
  });
  return errors;
}

export function validateEditorWorkSurfaceTypes() {
  const errors = [];
  SHARED_EDITOR_IDS.forEach((editorId) => {
    const workSurface = getEditorMenuSpec(editorId)?.workSurface;
    if (!workSurface) {
      errors.push(`Missing work surface type for shared editor "${editorId}".`);
    } else if (!SUPPORTED_EDITOR_WORK_SURFACES.includes(workSurface)) {
      errors.push(`${editorId} work surface type "${workSurface}" is unsupported.`);
    }
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
  editorId = null,
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
    specModeContract: getEditorMenuModeContract(editorId, mode),
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
  const specModeContract = getEditorMenuModeContract(editorId, mode);
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
      compactCommandRail: isLandscapeTouch ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface : null,
      rootDrawer: isLandscapeTouch ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface : null,
      submenu: isDesktop ? MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP].submenuSurface : placement.submenu,
      settings: isDesktop ? MODE_PRESENTATION_CONTRACTS[EDITOR_LAYOUT_MODES.DESKTOP].submenuSurface : placement.settings,
      primaryActions: isPortrait ? EDITOR_SURFACES.bottomActionRail : null,
      gestureScroll: isPortrait || isLandscapeTouch || isGamepad,
      rootDrawerKeepsSubmenuVisible: isLandscapeTouch ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerKeepsSubmenuVisible : false
    },
    surfaceRoles: {
      commandSurface,
      persistentContextSurface,
      persistentNavigationSurface,
      duplicatesCommandsInPersistentContext: DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel,
      desktopMobileRailsHidden: isDesktop ? DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden : false,
      persistentNavigationActionLimit: isLandscapeTouch ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.actionLimit : null,
      ...(isDesktop ? { persistentContextContract: DESKTOP_CONTEXT_PANEL_CONTRACT } : {})
    },
    presentation,
    interaction,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    surfaceVisibility: modeContract.surfaceVisibility,
    modeContract,
    specModeContract,
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL },
      submenu: { ...DEFAULT_DRAG_SCROLL },
      settings: { ...DEFAULT_DRAG_SCROLL }
    },
    gamepad: {
      rootCollapsesAfterSelect: mode === EDITOR_LAYOUT_MODES.GAMEPAD,
      rootSurface: isGamepad ? GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface : null,
      submenuSurface: isGamepad ? GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface : null,
      submenuReplacesRoot: mode === EDITOR_LAYOUT_MODES.GAMEPAD,
      ...GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls
    },
    desktop: {
      usesTopMenu: isDesktop,
      usesDropdowns: isDesktop,
      showPersistentLeftOptions: isDesktop,
      commandSurface: isDesktop ? DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface : null,
      leftPanelRole: isDesktop ? DESKTOP_SHELL_SURFACE_CONTRACT.leftPanelRole : null,
      duplicatesCommandsInLeftPanel: DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel,
      leftContextPanelContract: isDesktop ? DESKTOP_CONTEXT_PANEL_CONTRACT : null
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
    entry
    && Number(entry.maxScroll) >= 0
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
  const openedAtField = DESKTOP_DROPDOWN_STATE_CONTRACT.openedAtField;
  const previousOpenedAtMs = Number(dropdown?.[openedAtField]);
  const preserveOpenedAt = DESKTOP_DROPDOWN_STATE_CONTRACT.preservesOpenedAtForSameRoot
    && nextRootId === currentOpenRootId
    && Number.isFinite(previousOpenedAtMs)
    && !closedRootId;
  const openedAtMs = preserveOpenedAt
    ? previousOpenedAtMs
    : (Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now());
  return {
    closedRootId: null,
    openRootId: nextRootId,
    dropdown: dropdown
      ? { ...dropdown, [openedAtField]: openedAtMs }
      : { rootId: nextRootId, [openedAtField]: openedAtMs },
    openedAtMs
  };
}

export function resolveDesktopDropdownMotionProgress({
  dropdown = null,
  nowMs = null,
  durationMs = DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs
} = {}) {
  const duration = Math.max(1, Number(durationMs) || DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs);
  const rawOpenedAtMs = dropdown?.[DESKTOP_DROPDOWN_STATE_CONTRACT.openedAtField];
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
  const metadata = getDesktopDropdownCommandMetadata(item, extra);
  return {
    ...bounds,
    ...extra,
    ...(id ? { id } : {}),
    bounds: normalizedBounds,
    action,
    onClick: action,
    ...metadata
  };
}

export function getDesktopDropdownCommandMetadata(item = {}, extra = {}) {
  return {
    editActionRole: item?.editActionRole || extra?.editActionRole || null,
    desktopActionRole: item?.desktopActionRole || extra?.desktopActionRole || item?.editActionRole || extra?.editActionRole || null,
    editActionRoleGroupIndex: item?.editActionRoleGroupIndex ?? extra?.editActionRoleGroupIndex ?? null,
    startsEditActionRoleGroup: Boolean(item?.startsEditActionRoleGroup || extra?.startsEditActionRoleGroup),
    sourceRootId: item?.sourceRootId || extra?.sourceRootId || null,
    commandSurface: item?.commandSurface || extra?.commandSurface || DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface,
    pointerType: item?.pointerType || extra?.pointerType || DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType,
    rowActivation: item?.rowActivation || extra?.rowActivation || DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation,
    kind: extra.kind || DESKTOP_DROPDOWN_COMMAND_CONTRACT.kind,
    desktopDropdownItem: DESKTOP_DROPDOWN_COMMAND_CONTRACT.desktopDropdownItem
  };
}

export function applyDesktopDropdownCommandDataset(element, item = {}, extra = {}) {
  if (!element?.dataset) return null;
  const metadata = getDesktopDropdownCommandMetadata(item, extra);
  element.dataset.desktopDropdownItem = metadata.desktopDropdownItem ? 'true' : 'false';
  element.dataset.commandSurface = metadata.commandSurface;
  element.dataset.pointerType = metadata.pointerType;
  element.dataset.rowActivation = metadata.rowActivation;
  if (metadata.sourceRootId) element.dataset.sourceRootId = metadata.sourceRootId;
  if (metadata.editActionRole) element.dataset.editActionRole = metadata.editActionRole;
  if (metadata.desktopActionRole) element.dataset.desktopActionRole = metadata.desktopActionRole;
  if (metadata.startsEditActionRoleGroup) element.dataset.startsEditActionRoleGroup = 'true';
  if (Number.isFinite(Number(metadata.editActionRoleGroupIndex))) {
    element.dataset.editActionRoleGroupIndex = String(metadata.editActionRoleGroupIndex);
  }
  return metadata;
}

export function createDesktopRootMenuHit(button = {}, action = null, extra = {}) {
  const sourceRootId = button?.desktopRootId || button?.rootId || button?.id || extra?.desktopRootId || extra?.rootId || null;
  const idPrefix = extra?.idPrefix || '';
  const id = extra?.id || (sourceRootId && idPrefix ? `${idPrefix}${sourceRootId}` : sourceRootId);
  const desktopRootId = sourceRootId || (idPrefix && String(id || '').startsWith(idPrefix)
    ? String(id).slice(idPrefix.length)
    : id || null);
  const bounds = { ...(button?.bounds || button), ...(id ? { id } : {}) };
  return {
    ...(button?.bounds || button),
    ...extra,
    ...(id ? { id } : {}),
    bounds,
    action,
    onClick: action,
    desktopRootId,
    rootId: desktopRootId,
    kind: extra.kind || 'desktop-root-menu-item',
    commandSurface: extra.commandSurface || EDITOR_SURFACES.topMenu,
    pointerType: extra.pointerType || DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType,
    rowActivation: extra.rowActivation || 'press'
  };
}

export function applyDesktopRootMenuDataset(element, button = {}, extra = {}) {
  if (!element?.dataset) return null;
  const metadata = createDesktopRootMenuHit(button, null, extra);
  element.dataset.rootId = metadata.rootId || '';
  element.dataset.desktopRootId = metadata.desktopRootId || '';
  element.dataset.commandSurface = metadata.commandSurface;
  element.dataset.pointerType = metadata.pointerType;
  element.dataset.rowActivation = metadata.rowActivation;
  element.dataset.kind = metadata.kind;
  return metadata;
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
  const workSurface = getEditorWorkSurfaceType(editorId);
  const desktop = mode === EDITOR_LAYOUT_MODES.DESKTOP;
  const gamepad = mode === EDITOR_LAYOUT_MODES.GAMEPAD || gamepadConnected;
  const touch = pointerType === 'touch' || mode === EDITOR_LAYOUT_MODES.PORTRAIT || mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH;
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
      rightDragPan: desktop && FALLBACK_PAN_EDITOR_IDS.has(editorId),
      middleDragPan: desktop
    },
    thumbstick: {
      allowed: gamepad || (touch && CONTINUOUS_PAN_EDITOR_IDS.has(editorId)),
      showForMenus: false,
      showForWorkSurface: gamepad || (touch && CONTINUOUS_PAN_EDITOR_IDS.has(editorId)),
      avoidMenuOverlap: true
    },
    rightClick: {
      suppressBrowserMenu: true,
      opensContextMenu: desktop && DESKTOP_CONTEXT_MENU_EDITOR_IDS.has(editorId),
      fallbackPan: desktop && FALLBACK_PAN_EDITOR_IDS.has(editorId)
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
    commandSurface: DESKTOP_SHELL_SURFACE_CONTRACT.commandSurface,
    commandSurfaces: [...DESKTOP_SHELL_SURFACE_CONTRACT.commandSurfaces],
    persistentSurfaces: [...DESKTOP_SHELL_SURFACE_CONTRACT.persistentSurfaces],
    modeContract,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    surfaceVisibility: modeContract.surfaceVisibility,
    suppressedMobileSurfaces: [...DESKTOP_SHELL_SURFACE_CONTRACT.suppressedMobileSurfaces],
    leftPanelRole: DESKTOP_SHELL_SURFACE_CONTRACT.leftPanelRole,
    duplicatesCommandsInLeftPanel: DESKTOP_SHELL_SURFACE_CONTRACT.duplicatesCommandsInLeftPanel,
    leftContextPanelContract: DESKTOP_CONTEXT_PANEL_CONTRACT,
    desktopMobileRailsHidden: DESKTOP_SHELL_SURFACE_CONTRACT.desktopMobileRailsHidden,
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
    leftRailWidth: leftRailWidth ?? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.width,
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
  const resolvedRootDrawerOverlayOrigin = LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerOverlayOrigin;
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
  const rootDrawer = leftRootDrawer;
  const modeContract = getEditorModeContract(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH);
  const presentation = {
    ...modeContract.presentation,
    commandSurface: reserveRightRail ? modeContract.presentation.commandSurface : null,
    submenuSurface: reserveRightRail ? modeContract.presentation.submenuSurface : null,
    persistentContextSurface: bottomRailHeight > 0 ? modeContract.presentation.persistentContextSurface : null,
    rootDrawerSurface: modeContract.presentation.rootDrawerSurface,
    rootDrawerOverlayOrigin: resolvedRootDrawerOverlayOrigin,
    rootDrawerKeepsSubmenuVisible: reserveRightRail,
    rightSubmenuSurface: reserveRightRail ? modeContract.presentation.rightSubmenuSurface : null
  };
  const resolvedModeContract = {
    ...modeContract,
    presentation
  };
  const effectiveSurfaceVisibility = getLandscapeTouchShellEffectiveSurfaceVisibility({
    reserveRightRail,
    bottomRailHeight
  });
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    placement: getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH),
    rootMenuSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootSurface,
    submenuSurface: reserveRightRail ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.submenuSurface : null,
    bottomRailRole: bottomRailHeight > 0 ? LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.bottomRailRole : null,
    gestureScroll: true,
    bounds: {
      x: 0,
      y: 0,
      w: Math.max(1, Number(viewportWidth) || 0),
      h: Math.max(1, Number(viewportHeight) || 0)
    },
    labelOverrides,
    ...resolvedLayout,
    compactCommandRailSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface,
    compactCommandRailActionLimit: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.actionLimit,
    rootDrawerSurface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.rootDrawerSurface,
    rootDrawerOverlayOrigin: resolvedRootDrawerOverlayOrigin,
    modeContract: resolvedModeContract,
    presentation,
    interaction: modeContract.interaction,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    surfaceVisibility: modeContract.surfaceVisibility,
    effectiveSurfaceVisibility,
    suppressedDesktopSurfaces: [...LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.suppressedDesktopSurfaces],
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
    .map((action, index) => ({
      ...action,
      displayLabel: action.displayLabel ?? displayLabels[action.id] ?? action.label,
      slot: ['menu', 'undo', 'redo', 'quick'][index],
      surface: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRailSurface,
      commandRail: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.commandRail,
      rowActivation: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.rowActivation,
      gestureScroll: LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT.compactCommandRail.gestureScroll
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
  motionDurationMs = DESKTOP_DROPDOWN_STATE_CONTRACT.motion.durationMs
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
        type: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.type,
        progress: 0,
        durationMs: Math.max(0, Math.round(Number(motionDurationMs) || 0)),
        origin: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.origin,
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
  const dropdownRootId = dropdown.rootId || dropdown.specId || dropdown.menuId || null;
  let previousEditActionRole = null;
  let editActionRoleGroupIndex = -1;
  const visibleItems = sourceItems.filter((item) => {
    if (!item) return false;
    if (item.divider || item.separator) return true;
    if (hidden.has(item.id)) return false;
    if (item.id && seenActionIds.has(item.id)) return false;
    if (item.id) seenActionIds.add(item.id);
    return true;
  }).map((item) => {
    if (item.divider || item.separator) {
      previousEditActionRole = null;
      return item;
    }
    const editActionRole = dropdownRootId === 'edit' ? getEditorEditActionRole(item.id) : null;
    const startsEditActionRoleGroup = Boolean(
      editActionRole
      && previousEditActionRole
      && previousEditActionRole !== editActionRole
    );
    if (editActionRole && previousEditActionRole !== editActionRole) editActionRoleGroupIndex += 1;
    if (editActionRole) previousEditActionRole = editActionRole;
    const annotatedItem = {
      ...item,
      sourceRootId: item.sourceRootId || dropdownRootId,
      commandSurface: item.commandSurface || DESKTOP_DROPDOWN_COMMAND_CONTRACT.commandSurface,
      pointerType: item.pointerType || DESKTOP_DROPDOWN_COMMAND_CONTRACT.pointerType,
      rowActivation: item.rowActivation || DESKTOP_DROPDOWN_COMMAND_CONTRACT.rowActivation,
      ...(editActionRole ? {
        editActionRole,
        desktopActionRole: editActionRole,
        editActionRoleGroupIndex,
        startsEditActionRoleGroup
      } : {})
    };
    if (!disableActionlessItems) return annotatedItem;
    return {
      ...annotatedItem,
      disabled: Boolean(annotatedItem.disabled) || !hasItemAction(annotatedItem)
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
    type: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.type,
    progress,
    durationMs: Math.max(0, Math.round(Number(motionDurationMs) || 0)),
    origin: DESKTOP_DROPDOWN_STATE_CONTRACT.motion.origin,
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
  const scrollRegion = {
    menuId: dropdown.rootId || dropdown.specId || 'desktop-dropdown',
    bounds: { ...panelBounds },
    maxScroll,
    lineHeight: rowHeight,
    scrollScale: 1 / rowHeight,
    pointerType: 'mouse'
  };
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
  const baseRootEntries = getEditorControllerRootMenuEntries(editorId, { labelOverrides });
  const rootEntries = baseRootEntries.map((entry) => {
    const focused = Boolean(
      focusedItemId
      && (
        entry.id === focusedItemId
        || entry.specId === focusedItemId
        || entry.controllerMenuId === focusedItemId
      )
    );
    return {
      ...entry,
      focused,
      focusRing: focused,
      rowActivation: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation,
      pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
      sourceSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface,
      surface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface
    };
  });
  const activeRoot = rootEntries.find((entry) => entry.id === activeRootId || entry.specId === activeRootId)
    || rootEntries[0]
    || null;
  const submenu = activeRoot && !rootOpen
    ? buildDesktopDropdownPlan(editorId, activeRoot.id, { labelOverrides })
    : null;
  const rawSubmenuItems = submenu?.items || [];
  const defaultFocusedSubmenuItem = !rootOpen
    ? rawSubmenuItems.find((item) => !item.disabled && !item.divider && item.id) || rawSubmenuItems.find((item) => item.id) || null
    : null;
  const effectiveFocusedSubmenuItemId = rawSubmenuItems.some((item) => item.id === focusedItemId)
    ? focusedItemId
    : defaultFocusedSubmenuItem?.id || null;
  const submenuItems = rawSubmenuItems.map((item) => {
    const focused = Boolean(effectiveFocusedSubmenuItemId && item.id === effectiveFocusedSubmenuItemId);
    return {
      ...item,
      focused,
      focusRing: focused,
      rowActivation: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation,
      pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
      sourceSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface,
      surface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface
    };
  });
  const gamepadSubmenu = submenu
    ? {
      ...submenu,
      items: submenuItems,
      surface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface,
      sourceSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.sourceSurface,
      replacesRootRail: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail,
      rightSubmenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rightSubmenuSurface,
      rowActivation: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rowActivation,
      pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
      gestureScroll: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.gestureScroll,
      scroll: {
        ...DEFAULT_DRAG_SCROLL,
        pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType,
        mode: EDITOR_LAYOUT_MODES.GAMEPAD
      }
    }
    : null;
  const focusedRootEntry = rootEntries.find((entry) => entry.focused) || (rootOpen ? activeRoot : null);
  const focusedSubmenuItem = submenuItems.find((item) => item.id === effectiveFocusedSubmenuItemId) || null;
  const modeContract = getEditorModeContract(EDITOR_LAYOUT_MODES.GAMEPAD);
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    rootMenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface,
    submenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuSurface,
    submenuReplacesRootRail: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.submenuReplacesRootRail,
    rightSubmenuSurface: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rightSubmenuSurface,
    modeContract,
    requiredModeSurfaces: modeContract.requiredModeSurfaces,
    suppressedModeSurfaces: modeContract.suppressedModeSurfaces,
    surfaceVisibility: modeContract.surfaceVisibility,
    suppressedTouchSurfaces: [...GAMEPAD_SLIDE_OUT_MENU_CONTRACT.suppressedTouchSurfaces],
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
      submenuItemId: focusedSubmenuItem?.id || (!rootOpen ? effectiveFocusedSubmenuItemId : null),
      focusRingContract: { ...GAMEPAD_FOCUS_RING_CONTRACT }
    },
    focusRingContract: { ...GAMEPAD_FOCUS_RING_CONTRACT },
    rootEntries,
    submenu: gamepadSubmenu,
    controls: { ...GAMEPAD_SLIDE_OUT_MENU_CONTRACT.controls },
    headerHint: 'A Select  B Back  LB/RB Tabs  Start System',
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL, pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType, mode: EDITOR_LAYOUT_MODES.GAMEPAD },
      submenu: { ...DEFAULT_DRAG_SCROLL, pointerType: GAMEPAD_SLIDE_OUT_MENU_CONTRACT.pointerType, mode: EDITOR_LAYOUT_MODES.GAMEPAD }
    }
  };
}
