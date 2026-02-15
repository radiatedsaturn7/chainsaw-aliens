export const UI_SUITE = {
  colors: {
    bg: '#0b0b0b',
    panel: 'rgba(12,14,18,0.95)',
    panelAlt: 'rgba(0,0,0,0.5)',
    border: 'rgba(255,255,255,0.2)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.7)',
    accent: '#ffe16a',
    accent2: '#9ddcff',
    shadow: 'rgba(0,0,0,0.45)'
  },
  spacing: {
    gap: 8,
    radius: 8,
    tap: 44
  },
  layout: {
    railWidthMobile: 216,
    panelWidthMobile: 292,
    leftMenuWidthDesktop: 292,
    drawerWidth: 292
  },
  font: {
    family: 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    size: 12
  },
  editorPanel: {
    alpha: 0.9,
    background: 'rgba(0,0,0,0.7)',
    border: '#fff',
    text: '#fff',
    titleFont: '14px Courier New',
    bodyFont: '12px Courier New'
  }
};

export const SHARED_EDITOR_LEFT_MENU = {
  width: () => UI_SUITE.layout.leftMenuWidthDesktop,
  tabWidthDesktop: 80,
  tabWidthMobile: 72,
  buttonWidthMobile: 188,
  buttonHeightDesktop: 36,
  buttonHeightMobile: 40,
  buttonGap: 8,
  panelPadding: 8,
  panelGap: 8,
  desktopOuterPadding: 16,
  desktopContentGap: 12,
  fileLabel: 'FILE',
  closeLabel: 'Close Menu',
  exitLabel: 'Exit to Main Menu'
};


export function drawSharedMenuButtonChrome(ctx, bounds, {
  active = false,
  subtle = false,
  alpha = 1
} = {}) {
  const fill = active
    ? 'rgba(255,225,106,0.7)'
    : subtle
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(0,0,0,0.6)';
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.globalAlpha = prevAlpha;
  return active ? '#0b0b0b' : '#fff';
}

export function drawSharedFocusRing(ctx, bounds, {
  color = UI_SUITE.colors.accent,
  lineWidth = 2,
  padding = 2
} = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(
    bounds.x - padding,
    bounds.y - padding,
    bounds.w + padding * 2,
    bounds.h + padding * 2
  );
  ctx.restore();
}

export function getSharedEditorDrawerWidth(viewportWidth, {
  minWidth = 220,
  edgePadding = 12,
  preferredWidth = UI_SUITE.layout.drawerWidth
} = {}) {
  const maxWidth = Math.max(0, viewportWidth - edgePadding * 2);
  return clampValue(preferredWidth, minWidth, maxWidth);
}

function clampValue(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (!Number.isFinite(min)) min = value;
  if (!Number.isFinite(max)) max = value;
  if (min > max) return min;
  return Math.max(min, Math.min(max, value));
}

export function buildMainMenuFooterEntries(config = {}) {
  const {
    closeId = 'close-menu',
    exitId = 'exit-main',
    closeLabel = SHARED_EDITOR_LEFT_MENU.closeLabel,
    exitLabel = SHARED_EDITOR_LEFT_MENU.exitLabel,
    closeTooltip = 'Close file menu',
    exitTooltip = 'Exit editor to title',
    onClose = null,
    onExit = null
  } = config;
  return [
    {
      id: closeId,
      label: closeLabel,
      tooltip: closeTooltip,
      onClick: onClose
    },
    {
      id: exitId,
      label: exitLabel,
      tooltip: exitTooltip,
      onClick: onExit
    }
  ];
}


export function buildSharedMenuFooterLayout({
  x,
  y,
  width,
  buttonHeight,
  horizontalPadding = 0,
  gap = 8,
  closeId = 'close-menu',
  exitId = 'exit-main'
}) {
  const innerX = x + horizontalPadding;
  const innerW = Math.max(0, width - horizontalPadding * 2);
  const buttonW = Math.floor((innerW - gap) / 2);
  const closeBounds = { x: innerX, y, w: buttonW, h: buttonHeight, id: closeId };
  const exitBounds = { x: innerX + buttonW + gap, y, w: buttonW, h: buttonHeight, id: exitId };
  return { closeBounds, exitBounds };
}





export function buildSharedDesktopLeftPanelFrame({
  viewportWidth,
  viewportHeight,
  outerPadding = SHARED_EDITOR_LEFT_MENU.desktopOuterPadding,
  contentGap = SHARED_EDITOR_LEFT_MENU.desktopContentGap
}) {
  const panelX = outerPadding;
  const panelY = outerPadding;
  const panelW = SHARED_EDITOR_LEFT_MENU.width();
  const panelH = Math.max(0, viewportHeight - outerPadding * 2);
  const contentX = panelX + panelW + contentGap;
  const contentW = Math.max(0, viewportWidth - contentX - outerPadding);
  return {
    panelX,
    panelY,
    panelW,
    panelH,
    contentX,
    contentW,
    outerPadding,
    contentGap
  };
}

export function buildSharedLeftMenuTopButtons({
  x,
  y,
  width,
  labels = [],
  isMobile = false,
  gap = SHARED_EDITOR_LEFT_MENU.buttonGap,
  buttonHeight = isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop
}) {
  return labels.map((label, index) => ({
    id: label.id,
    label: label.label,
    bounds: {
      x,
      y: y + index * (buttonHeight + gap),
      w: width,
      h: buttonHeight
    }
  }));
}

export function buildSharedLeftMenuButtons({
  x,
  y,
  height,
  additionalButtons = [],
  isMobile = false,
  gap = SHARED_EDITOR_LEFT_MENU.buttonGap,
  buttonHeight = isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop,
  width = isMobile ? SHARED_EDITOR_LEFT_MENU.tabWidthMobile : SHARED_EDITOR_LEFT_MENU.tabWidthDesktop
}) {
  const labels = [
    { id: 'file', label: SHARED_EDITOR_LEFT_MENU.fileLabel },
    ...additionalButtons
  ];
  if (!labels.length) return [];
  const count = labels.length;
  const availableHeight = Math.max(0, height);
  const minButtonHeight = isMobile ? 28 : 18;
  const maxGap = count > 1 ? Math.max(2, Math.floor((availableHeight - minButtonHeight * count) / (count - 1))) : gap;
  const fittedGap = Math.max(2, Math.min(gap, maxGap));
  const fittedButtonHeight = count > 0
    ? Math.max(minButtonHeight, Math.min(buttonHeight, Math.floor((availableHeight - fittedGap * (count - 1)) / count)))
    : buttonHeight;
  return buildSharedLeftMenuTopButtons({
    x,
    y,
    width,
    labels,
    isMobile,
    gap: fittedGap,
    buttonHeight: fittedButtonHeight
  });
}

export function buildSharedLeftMenuLayout({
  x,
  y,
  width,
  height,
  isMobile = false,
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  gap = SHARED_EDITOR_LEFT_MENU.panelGap,
  tabWidthDesktop = SHARED_EDITOR_LEFT_MENU.tabWidthDesktop,
  tabWidthMobile = SHARED_EDITOR_LEFT_MENU.tabWidthMobile
}) {
  const tabWidth = isMobile ? tabWidthMobile : tabWidthDesktop;
  const tabX = x + padding;
  const tabY = y + padding;
  const contentX = tabX + tabWidth + gap;
  const contentY = tabY;
  const contentW = Math.max(0, width - (contentX - x) - padding);
  const contentH = Math.max(0, height - padding * 2);
  return {
    tabColumn: { x: tabX, y: tabY, w: tabWidth, h: Math.max(0, height - padding * 2) },
    content: { x: contentX, y: contentY, w: contentW, h: contentH }
  };
}
const STANDARD_FILE_ORDER = ['new', 'save', 'save-as', 'open', 'export', 'import', 'undo', 'redo'];

export function buildStandardFileMenu(config = {}) {
  const {
    supported = {},
    labels = {},
    tooltips = {},
    actions = {},
    extras = []
  } = config;

  const entries = STANDARD_FILE_ORDER.map((id) => ({
    id,
    label: labels[id] || defaultLabelForFileId(id),
    disabled: supported[id] === false,
    tooltip: tooltips[id] || (supported[id] === false ? 'Not available in this editor yet' : ''),
    onClick: actions[id] || null
  }));

  return [...entries, ...extras];
}


export function buildSharedEditorFileMenu(config = {}) {
  const {
    supported = {},
    labels = {},
    tooltips = {},
    actions = {},
    extras = [],
    includeFooter = true,
    footer = {}
  } = config;
  const entries = buildStandardFileMenu({ supported, labels, tooltips, actions });
  if (!includeFooter) return [...entries, ...extras];
  const footerEntries = buildMainMenuFooterEntries(footer).map((entry) => ({
    id: entry.id,
    label: entry.label,
    tooltip: entry.tooltip,
    onClick: entry.onClick,
    action: entry.onClick
  }));
  return [...entries, ...extras, { divider: true }, ...footerEntries];
}

function defaultLabelForFileId(id) {
  switch (id) {
    case 'new': return 'New';
    case 'save': return 'Save';
    case 'save-as': return 'Save As';
    case 'open': return 'Open';
    case 'export': return 'Export';
    case 'import': return 'Import';
    case 'undo': return 'Undo';
    case 'redo': return 'Redo';
    default: return id;
  }
}

export function fileTypeBadge(filename = '') {
  const value = String(filename).toLowerCase();
  if (value.endsWith('.mid') || value.endsWith('.midi')) return 'MIDI';
  if (value.endsWith('.json')) return 'JSON';
  if (value.endsWith('.png')) return 'PNG';
  if (value.endsWith('.gif')) return 'GIF';
  if (value.endsWith('.zip')) return 'ZIP';
  return 'FILE';
}

const MENU_LABEL_ACRONYMS = new Set(['JSON', 'MIDI', 'ZIP', 'PNG', 'GIF', 'GM', 'QA', 'UI', 'VFS']);

export function formatMenuLabel(label = '') {
  const value = String(label ?? '');
  if (!/[A-Za-z]/.test(value)) return value;
  if (/[a-z]/.test(value)) return value;
  return value.replace(/[A-Z][A-Z0-9']*/g, (word) => {
    if (MENU_LABEL_ACRONYMS.has(word)) return word;
    const lower = word.toLowerCase();
    return `${lower[0].toUpperCase()}${lower.slice(1)}`;
  });
}
