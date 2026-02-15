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
  closeLabel: 'Close Drawer',
  exitLabel: 'Exit to Main Menu'
};

export class SharedEditorMenu {
  constructor(options = {}) {
    this.options = {
      desktopWidth: SHARED_EDITOR_LEFT_MENU.width(),
      mobileWidth: UI_SUITE.layout.railWidthMobile,
      panelPadding: SHARED_EDITOR_LEFT_MENU.panelPadding,
      buttonGap: SHARED_EDITOR_LEFT_MENU.buttonGap,
      ...options
    };
  }

  getButtonHeight(isMobile) {
    return isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop;
  }

  getPanelWidth(isMobile) {
    return isMobile ? this.options.mobileWidth : this.options.desktopWidth;
  }

  draw(ctx, {
    x,
    y,
    height,
    isMobile = false,
    buttons = [],
    activeId = null,
    drawButton,
    registerButton
  }) {
    const panelW = this.getPanelWidth(isMobile);
    const panelH = Math.max(0, height);
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, panelW, panelH);

    const padding = this.options.panelPadding;
    const gap = this.options.buttonGap;
    const buttonH = this.getButtonHeight(isMobile);
    const buttonW = Math.max(0, panelW - padding * 2);
    let cursorY = y + padding;
    const rendered = [];
    buttons.forEach((entry) => {
      const bounds = { x: x + padding, y: cursorY, w: buttonW, h: buttonH, id: entry.id };
      const isActive = activeId === entry.id;
      drawButton(bounds, entry, isActive);
      if (typeof registerButton === 'function') {
        registerButton(bounds, entry);
      }
      rendered.push({ ...entry, bounds, active: isActive });
      cursorY += buttonH + gap;
    });
    return { panel: { x, y, w: panelW, h: panelH }, buttons: rendered };
  }

  drawDrawer(ctx, {
    panel,
    title = 'File',
    isMobile = false,
    items = [],
    scroll = 0,
    drawButton
  }) {
    const rowHeight = this.getButtonHeight(isMobile);
    return renderSharedFileDrawer(ctx, {
      panel,
      title,
      items,
      scroll,
      rowHeight,
      rowGap: this.options.buttonGap,
      buttonHeight: rowHeight,
      isMobile,
      footerMode: 'stacked',
      showTitle: true,
      layout: {
        padding: this.options.panelPadding,
        headerHeight: rowHeight + this.options.panelPadding * 2,
        footerHeight: rowHeight,
        footerBottomPadding: this.options.panelPadding,
        footerGap: this.options.buttonGap
      },
      drawButton
    });
  }
}


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


function clipMenuLabel(ctx, label, maxWidth) {
  const text = String(label ?? '');
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let clipped = text;
  while (clipped.length > 0 && ctx.measureText(clipped + ellipsis).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped ? `${clipped}${ellipsis}` : ellipsis;
}

export function drawSharedMenuButtonLabel(ctx, bounds, label, {
  fontSize = UI_SUITE.font.size,
  fontFamily = UI_SUITE.font.family,
  color = '#fff',
  align = 'center',
  baseline = 'middle',
  padding = 6,
  x = null,
  y = null,
  maxWidth = null,
  format = true
} = {}) {
  const text = format ? formatMenuLabel(label) : String(label ?? '');
  const textY = y ?? (bounds.y + bounds.h / 2);
  const textX = x ?? (align === 'center' ? (bounds.x + bounds.w / 2) : (bounds.x + padding));
  const availableWidth = Number.isFinite(maxWidth)
    ? maxWidth
    : Math.max(0, bounds.w - padding * 2);
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const renderText = clipMenuLabel(ctx, text, availableWidth);
  ctx.fillText(renderText, textX, textY);
  ctx.restore();
}


export function getSharedMobileRailWidth(viewportWidth, viewportHeight, {
  portraitWidth = UI_SUITE.layout.railWidthMobile,
  landscapeWidth = 164,
  minWidth = 120
} = {}) {
  const landscape = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportWidth > viewportHeight;
  const preferred = landscape ? landscapeWidth : portraitWidth;
  const ratioCap = landscape ? 0.24 : 0.36;
  const maxByRatio = Number.isFinite(viewportWidth)
    ? Math.max(minWidth, Math.floor(viewportWidth * ratioCap))
    : preferred;
  return clampValue(preferred, minWidth, maxByRatio);
}

export function getSharedMobileDrawerWidth(viewportWidth, viewportHeight, railWidth, {
  minWidth = 220,
  portraitPreferred = UI_SUITE.layout.drawerWidth,
  landscapePreferred = 248,
  minContentPortrait = 180,
  minContentLandscape = 260,
  edgePadding = 0
} = {}) {
  const landscape = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportWidth > viewportHeight;
  const preferred = landscape ? landscapePreferred : portraitPreferred;
  const minContent = landscape ? minContentLandscape : minContentPortrait;
  const maxWidth = Number.isFinite(viewportWidth)
    ? Math.max(minWidth, Math.floor(viewportWidth - railWidth - minContent - edgePadding * 2))
    : preferred;
  return clampValue(preferred, minWidth, maxWidth);
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

export function buildSharedFileDrawerLayout({
  x,
  y,
  width,
  height,
  padding = 12,
  headerHeight = 58,
  footerHeight = 30,
  footerBottomPadding = 10,
  footerGap = 8,
  closeId = 'close-menu',
  exitId = 'exit-main'
}) {
  const titleX = x + padding;
  const titleY = y + 28;
  const listX = x + padding;
  const listY = y + headerHeight;
  const footerY = y + height - footerHeight - footerBottomPadding;
  const listH = Math.max(0, footerY - listY - 8);
  const { closeBounds, exitBounds } = buildSharedMenuFooterLayout({
    x,
    y: footerY,
    width,
    buttonHeight: footerHeight,
    horizontalPadding: padding,
    gap: footerGap,
    closeId,
    exitId
  });
  return {
    titleX,
    titleY,
    listX,
    listY,
    listW: Math.max(0, width - padding * 2),
    listH,
    footerY,
    footerBottomPadding,
    closeBounds,
    exitBounds
  };
}





export function renderSharedFileDrawer(ctx, {
  panel,
  items = [],
  title = 'File',
  scroll = 0,
  rowHeight = 32,
  rowGap = 8,
  buttonHeight = null,
  isMobile = false,
  layout = {},
  drawButton,
  drawDivider = null,
  showTitle = true,
  footerMode = 'split',
  footerRowGap = null,
  drawPanel = true,
  panelFill = UI_SUITE.colors.panel,
  panelBorder = UI_SUITE.colors.border,
  panelAlpha = 1
} = {}) {
  const drawerLayout = buildSharedFileDrawerLayout({
    x: panel.x,
    y: panel.y,
    width: panel.w,
    height: panel.h,
    ...layout
  });


  if (drawPanel) {
    ctx.save();
    ctx.globalAlpha = panelAlpha;
    ctx.fillStyle = panelFill;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = panelBorder;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.restore();
  }

  if (showTitle && title) {
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 16 : 14}px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, drawerLayout.titleX, drawerLayout.titleY);
  }

  const listBounds = {
    x: drawerLayout.listX - 2,
    y: drawerLayout.listY - 4,
    w: drawerLayout.listW + 4,
    h: drawerLayout.listH + 8
  };
  const stride = rowHeight + rowGap;
  const visibleRows = Math.max(1, Math.floor(drawerLayout.listH / Math.max(1, stride)));
  const scrollMax = Math.max(0, items.length - visibleRows);
  const nextScroll = Math.max(0, Math.min(scrollMax, Math.round(scroll || 0)));
  const visibleItems = items.slice(nextScroll, nextScroll + visibleRows);
  let cursorY = drawerLayout.listY;
  const itemBounds = [];
  visibleItems.forEach((item) => {
    if (item?.divider) {
      const dividerY = cursorY + 8;
      if (typeof drawDivider === 'function') {
        drawDivider({ x: drawerLayout.listX, y: dividerY, w: drawerLayout.listW, h: 0 }, item);
      } else {
        ctx.strokeStyle = UI_SUITE.colors.border;
        ctx.beginPath();
        ctx.moveTo(drawerLayout.listX, dividerY);
        ctx.lineTo(drawerLayout.listX + drawerLayout.listW, dividerY);
        ctx.stroke();
      }
      cursorY += Math.max(14, Math.round(Math.max(16, rowHeight) * 0.4));
      return;
    }
    const bounds = {
      x: drawerLayout.listX,
      y: cursorY,
      w: drawerLayout.listW,
      h: buttonHeight ?? Math.max(18, rowHeight),
      id: item?.id
    };
    drawButton(bounds, item);
    itemBounds.push(bounds);
    cursorY += stride;
  });

  let { closeBounds, exitBounds } = drawerLayout;
  if (footerMode === 'stacked') {
    const footerButtonH = buttonHeight ?? Math.max(18, rowHeight);
    const gap = Number.isFinite(footerRowGap) ? footerRowGap : rowGap;
    const exitY = panel.y + panel.h - drawerLayout.footerBottomPadding - footerButtonH;
    const closeY = exitY - gap - footerButtonH;
    closeBounds = { x: drawerLayout.listX, y: closeY, w: drawerLayout.listW, h: footerButtonH, id: drawerLayout.closeBounds.id };
    exitBounds = { x: drawerLayout.listX, y: exitY, w: drawerLayout.listW, h: footerButtonH, id: drawerLayout.exitBounds.id };
  }
  drawButton(closeBounds, { id: closeBounds.id, label: SHARED_EDITOR_LEFT_MENU.closeLabel, footer: true });
  drawButton(exitBounds, { id: exitBounds.id, label: SHARED_EDITOR_LEFT_MENU.exitLabel, footer: true });

  return {
    layout: drawerLayout,
    listBounds: scrollMax > 0 ? listBounds : null,
    itemBounds,
    closeBounds,
    exitBounds,
    scroll: nextScroll,
    scrollMax
  };
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


export function buildUnifiedFileDrawerItems({
  actions = {},
  labels = {},
  tooltips = {},
  editorSpecific = []
} = {}) {
  const mk = (id, fallback) => ({
    id,
    label: labels[id] || fallback,
    tooltip: tooltips[id] || '',
    onClick: actions[id] || null
  });
  return [
    mk('new', 'New'),
    mk('save', 'Save'),
    mk('save-as', 'Save As'),
    mk('open', 'Open'),
    { divider: true },
    mk('import', 'Import'),
    mk('export', 'Export'),
    ...(editorSpecific.length ? [{ divider: true }, ...editorSpecific] : [])
  ];
}

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
