import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  getEditorMenuSpec,
  getEditorRootMenuEntries
} from './editorMenuSpec.js';

const DEFAULT_DRAG_SCROLL = {
  enabled: true,
  thresholdPx: 8,
  suppressClickAfterDrag: true
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

const WORK_SURFACE_TYPES = {
  pixel: 'canvas',
  level: 'canvas',
  actor: 'stage',
  midi: 'grid',
  sfx: 'timeline',
  cutscene: 'stage'
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

export function getEditorPointerInteractionPolicy(editorId, {
  mode = EDITOR_LAYOUT_MODES.DESKTOP,
  pointerType = mode === EDITOR_LAYOUT_MODES.DESKTOP ? 'mouse' : 'touch',
  gamepadConnected = mode === EDITOR_LAYOUT_MODES.GAMEPAD
} = {}) {
  const workSurface = WORK_SURFACE_TYPES[editorId] || 'canvas';
  const desktop = mode === EDITOR_LAYOUT_MODES.DESKTOP;
  const gamepad = mode === EDITOR_LAYOUT_MODES.GAMEPAD || gamepadConnected;
  const touch = pointerType === 'touch' || mode === EDITOR_LAYOUT_MODES.PORTRAIT || mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH;
  const continuousPanEditors = new Set(['pixel', 'level', 'midi', 'sfx', 'cutscene']);
  const contextMenuEditors = new Set(['pixel', 'level', 'actor', 'cutscene']);
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
      rightDragPan: desktop && ['pixel', 'level', 'midi'].includes(editorId),
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
      fallbackPan: desktop && ['pixel', 'level', 'midi'].includes(editorId)
    }
  };
}

export function buildDesktopTopMenuPlan(editorId, {
  bounds = {},
  activeRootId = null,
  labelOverrides = {},
  maxVisibleItems = Infinity
} = {}) {
  const menuBounds = { ...DEFAULT_TOP_MENU, ...bounds };
  const entries = getEditorRootMenuEntries(editorId, { labelOverrides });
  const visibleEntries = entries.slice(0, Math.max(0, maxVisibleItems));
  const overflowEntries = entries.slice(visibleEntries.length);
  const availableW = Math.max(1, menuBounds.w - menuBounds.padding * 2 - Math.max(0, visibleEntries.length - 1) * menuBounds.gap);
  const rawItemW = visibleEntries.length ? Math.floor(availableW / visibleEntries.length) : menuBounds.itemMinWidth;
  const itemW = Math.max(menuBounds.itemMinWidth, Math.min(menuBounds.itemMaxWidth, rawItemW));
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
      labelOverrides
    })
    : null;
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    bounds: menuBounds,
    buttons,
    overflowEntries,
    dropdown
  };
}

export function buildDesktopDropdownPlan(editorId, rootId, {
  anchor = null,
  labelOverrides = {},
  rowHeight = 34,
  minWidth = 220,
  maxVisibleRows = 12
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
  const bounds = {
    x: anchor?.x || 0,
    y: (anchor?.y || 0) + (anchor?.h || 0),
    w: Math.max(minWidth, anchor?.w || 0),
    h: visibleRows * rowHeight
  };
  return {
    editorId,
    rootId: rootEntry?.id || rootId,
    specId: sectionId,
    title: section?.label || rootEntry?.label || '',
    bounds,
    rowHeight,
    items,
    scroll: { ...DEFAULT_DRAG_SCROLL }
  };
}

export function buildGamepadSlideOutMenuPlan(editorId, {
  rootOpen = true,
  activeRootId = null,
  focusedItemId = null,
  labelOverrides = {}
} = {}) {
  const rootEntries = getEditorRootMenuEntries(editorId, { labelOverrides });
  const activeRoot = rootEntries.find((entry) => entry.id === activeRootId || entry.specId === activeRootId)
    || rootEntries[0]
    || null;
  const submenu = activeRoot && !rootOpen
    ? buildDesktopDropdownPlan(editorId, activeRoot.id, { labelOverrides })
    : null;
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.GAMEPAD,
    rootOpen,
    rootCollapsed: Boolean(activeRoot && !rootOpen),
    activeRootId: activeRoot?.id || null,
    activeSpecId: activeRoot?.specId || null,
    focusedItemId,
    rootEntries,
    submenu,
    controls: {
      confirm: 'A',
      back: 'B',
      system: 'Start',
      focusToggle: 'Back',
      siblingPrev: 'LB',
      siblingNext: 'RB'
    },
    scroll: {
      root: { ...DEFAULT_DRAG_SCROLL },
      submenu: { ...DEFAULT_DRAG_SCROLL }
    }
  };
}
