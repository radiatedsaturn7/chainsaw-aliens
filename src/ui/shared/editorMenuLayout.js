import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_PLACEMENTS,
  getEditorMenuSpec,
  getEditorRootMenuEntries
} from './editorMenuSpec.js';
import { getSharedMobileLandscapeEditorLayout } from '../uiSuite.js';

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

export function isGamepadLandscapeEditorMode({
  viewportWidth = 0,
  viewportHeight = 0,
  gamepadConnected = false,
  isMobile = true,
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
  isMobile = true,
  menuActive = false,
  activeMenuId = null
} = {}) {
  return Boolean(
    isGamepadLandscapeEditorMode({ viewportWidth, viewportHeight, gamepadConnected, isMobile })
    && menuActive
    && activeMenuId
  );
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
  const itemW = rawItemW < menuBounds.itemMinWidth
    ? Math.max(1, rawItemW)
    : Math.min(menuBounds.itemMaxWidth, Math.max(menuBounds.itemMinWidth, rawItemW));
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
  minWorkSurfaceHeight = DEFAULT_DESKTOP_SHELL.minWorkSurfaceHeight
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
  const topMenu = buildDesktopTopMenuPlan(editorId, {
    bounds: { x: 0, y: 0, w: width, h: topH },
    activeRootId,
    labelOverrides
  });
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.DESKTOP,
    bounds: { x: 0, y: 0, w: width, h: height },
    topMenu,
    dropdown: topMenu.dropdown,
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
  reserveRightRail = true,
  thumbstick = null,
  padding = undefined,
  gap = undefined
} = {}) {
  const layout = getSharedMobileLandscapeEditorLayout(viewportWidth, viewportHeight, {
    leftRailWidth,
    rightRailWidth,
    bottomRailHeight,
    reserveRightRail,
    thumbstick,
    ...(padding === undefined ? {} : { padding }),
    ...(gap === undefined ? {} : { gap })
  });
  return {
    editorId,
    mode: EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH,
    placement: getEditorMenuPlacement(EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH),
    bounds: {
      x: 0,
      y: 0,
      w: Math.max(1, Number(viewportWidth) || 0),
      h: Math.max(1, Number(viewportHeight) || 0)
    },
    labelOverrides,
    ...layout,
    scroll: {
      leftRail: { ...DEFAULT_DRAG_SCROLL, pointerType: 'touch' },
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

export function buildDesktopDropdownPlan(editorId, rootId, {
  anchor = null,
  containerBounds = null,
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
