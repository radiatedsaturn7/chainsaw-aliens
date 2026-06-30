import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  getEditorMenuSpec
} from './editorMenuSpec.js';

const DEFAULT_DRAG_SCROLL = {
  enabled: true,
  thresholdPx: 8,
  suppressClickAfterDrag: true
};

export function resolveEditorLayoutMode({
  viewportWidth = 0,
  viewportHeight = 0,
  isMobile = false,
  gamepadConnected = false,
  forceDesktop = false
} = {}) {
  if (gamepadConnected) return EDITOR_LAYOUT_MODES.GAMEPAD;
  if (forceDesktop || !isMobile) return EDITOR_LAYOUT_MODES.DESKTOP;
  return Number(viewportWidth) > Number(viewportHeight)
    ? EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH
    : EDITOR_LAYOUT_MODES.PORTRAIT;
}

export function getEditorMenuPlacement(mode = EDITOR_LAYOUT_MODES.DESKTOP) {
  return EDITOR_MENU_PLACEMENTS[mode] || EDITOR_MENU_PLACEMENTS[EDITOR_LAYOUT_MODES.DESKTOP];
}

export function buildEditorMenuLayoutPlan(editorId, options = {}) {
  const mode = options.mode || resolveEditorLayoutMode(options);
  const spec = getEditorMenuSpec(editorId);
  const placement = getEditorMenuPlacement(mode);
  const rootIds = spec?.root?.slice() || [];

  return {
    editorId,
    mode,
    title: spec?.title || '',
    rootIds,
    placement,
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL },
      submenu: { ...DEFAULT_DRAG_SCROLL },
      settings: { ...DEFAULT_DRAG_SCROLL }
    },
    gamepad: {
      rootCollapsesAfterSelect: mode === EDITOR_LAYOUT_MODES.GAMEPAD,
      confirm: 'A',
      back: 'B',
      system: 'Start',
      focusToggle: 'Back',
      siblingPrev: 'LB',
      siblingNext: 'RB'
    },
    desktop: {
      usesTopMenu: mode === EDITOR_LAYOUT_MODES.DESKTOP,
      usesDropdowns: mode === EDITOR_LAYOUT_MODES.DESKTOP,
      showPersistentLeftOptions: mode === EDITOR_LAYOUT_MODES.DESKTOP
    },
    touch: {
      usesBottomMenus: mode === EDITOR_LAYOUT_MODES.PORTRAIT,
      usesSideRails: mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
      thumbstickAllowed: mode === EDITOR_LAYOUT_MODES.PORTRAIT
        || mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH
        || mode === EDITOR_LAYOUT_MODES.GAMEPAD
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
