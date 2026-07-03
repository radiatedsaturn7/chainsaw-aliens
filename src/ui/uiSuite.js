export const UI_SUITE = {
  colors: {
    bg: '#07090e',
    panel: 'rgba(8,12,20,0.88)',
    panelAlt: 'rgba(18,28,42,0.82)',
    border: 'rgba(190,215,245,0.36)',
    text: '#f8fbff',
    muted: 'rgba(198,220,245,0.78)',
    accent: '#ffe16a',
    accent2: '#5fb8a8',
    danger: 'rgba(255,140,140,0.9)',
    shadow: 'rgba(0,0,0,0.55)'
  },
  spacing: {
    gap: 8,
    radius: 8,
    tap: 44,
    compact: 40
  },
  layout: {
    railWidthMobile: 216,
    panelWidthMobile: 292,
    leftMenuWidthDesktop: 292,
    drawerWidth: 292
  },
  font: {
    family: 'Arial, Helvetica, sans-serif',
    size: 12
  },
  editorPanel: {
    alpha: 0.9,
    background: 'rgba(8,12,20,0.88)',
    border: 'rgba(190,215,245,0.36)',
    text: '#f8fbff',
    titleFont: '600 14px Arial',
    bodyFont: '12px Arial'
  }
};

export function drawSharedPanel(ctx, bounds, {
  fill = UI_SUITE.colors.panel,
  border = UI_SUITE.colors.border,
  alpha = 1,
  title = '',
  titleX = null,
  titleY = null,
  titleSize = 15
} = {}) {
  if (!bounds) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.strokeStyle = border;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
  if (title) {
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `${titleSize}px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, titleX ?? bounds.x + 12, titleY ?? bounds.y + 24);
    ctx.restore();
  }
}

export function drawSharedBottomRail(ctx, bounds, options = {}) {
  drawSharedPanel(ctx, bounds, {
    fill: options.fill ?? UI_SUITE.colors.panel,
    border: options.border ?? UI_SUITE.colors.border,
    alpha: options.alpha ?? 1
  });
}

export function drawSharedStatusToast(ctx, bounds, message, {
  fill = 'rgba(0,0,0,0.78)',
  color = UI_SUITE.colors.accent,
  border = UI_SUITE.colors.border
} = {}) {
  if (!message || !bounds) return;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.strokeStyle = border;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.fillStyle = color;
  ctx.font = `13px ${UI_SUITE.font.family}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(message), bounds.x + 12, bounds.y + bounds.h / 2);
  ctx.restore();
}

export function drawSharedGamepadHintBar(ctx, bounds, contextLabel, hints = [], {
  maxHints = 6
} = {}) {
  if (!ctx || !bounds) return;
  const label = String(contextLabel || 'Controls');
  const hintText = (hints || []).slice(0, maxHints).join('  |  ');
  drawSharedPanel(ctx, bounds, {
    fill: 'rgba(8,12,20,0.86)',
    border: UI_SUITE.colors.border
  });
  ctx.save();
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `12px ${UI_SUITE.font.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, bounds.x + 10, bounds.y + bounds.h / 2, Math.max(40, bounds.w * 0.36));
  ctx.fillStyle = UI_SUITE.colors.muted;
  ctx.textAlign = 'right';
  ctx.fillText(hintText, bounds.x + bounds.w - 10, bounds.y + bounds.h / 2, Math.max(40, bounds.w * 0.62));
  ctx.restore();
}

export function drawSharedGamepadSlideOutHeader(ctx, bounds, title, {
  hint = 'A Select  B Back  LB/RB Tabs  Start System',
  titleSize = 12,
  hintSize = 10
} = {}) {
  if (!ctx || !bounds) return;
  ctx.save();
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `${titleSize}px ${UI_SUITE.font.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(String(title || 'Menu'), bounds.x + 12, bounds.y + 18, Math.max(1, bounds.w - 24));
  ctx.fillStyle = UI_SUITE.colors.muted;
  ctx.font = `${hintSize}px ${UI_SUITE.font.family}`;
  ctx.fillText(String(hint), bounds.x + 12, bounds.y + 36, Math.max(1, bounds.w - 24));
  ctx.restore();
}

export function drawSharedControllerMenuOverlay(ctx, {
  x = 18,
  y = 18,
  w = 320,
  h = 240,
  width = 0,
  height = 0,
  contextLabel = 'Editor',
  title = 'Menu',
  rows = [],
  selectedIndex = 0,
  prompt = 'LS/D-pad Move   A Select   B Back   LB/RB Tabs   Start System',
  rowHeight = 42,
  rowGap = 8
} = {}) {
  if (!ctx) return null;
  const safeRows = Array.isArray(rows) ? rows : [];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(0, 0, width, height);
  drawSharedPanel(ctx, { x, y, w, h }, {
    fill: UI_SUITE.colors.panel,
    border: UI_SUITE.colors.border
  });
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `13px ${UI_SUITE.font.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(String(contextLabel || 'Editor'), x + 16, y + 22, Math.max(1, w - 32));
  ctx.fillStyle = UI_SUITE.colors.text;
  ctx.font = `18px ${UI_SUITE.font.family}`;
  ctx.fillText(String(title || 'Menu'), x + 16, y + 48, Math.max(1, w - 32));
  let rowY = y + 68;
  safeRows.forEach((row) => {
    const active = row.index === selectedIndex;
    const rowBounds = { x: x + 12, y: rowY, w: w - 24, h: rowHeight };
    ctx.fillStyle = active ? 'rgba(255,225,106,0.28)' : UI_SUITE.colors.panelAlt;
    ctx.fillRect(rowBounds.x, rowBounds.y, rowBounds.w, rowBounds.h);
    ctx.strokeStyle = active ? UI_SUITE.colors.accent : UI_SUITE.colors.border;
    ctx.strokeRect(rowBounds.x, rowBounds.y, rowBounds.w, rowBounds.h);
    ctx.fillStyle = row.disabled ? UI_SUITE.colors.muted : UI_SUITE.colors.text;
    ctx.font = `14px ${UI_SUITE.font.family}`;
    ctx.fillText(String(row.label || ''), rowBounds.x + 14, rowY + 26, Math.max(1, rowBounds.w - 28));
    rowY += rowHeight + rowGap;
  });
  ctx.fillStyle = UI_SUITE.colors.muted;
  ctx.font = `11px ${UI_SUITE.font.family}`;
  ctx.fillText(String(prompt || ''), x + 16, y + h - 15, Math.max(1, w - 32));
  ctx.restore();
  return { x, y, w, h };
}

export function drawSharedTimeLabel(ctx, bounds, label, {
  color = UI_SUITE.colors.muted,
  fontSize = 12,
  align = 'left'
} = {}) {
  if (!bounds) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const x = align === 'center' ? bounds.x + bounds.w / 2 : bounds.x;
  ctx.fillText(String(label ?? ''), x, bounds.y + bounds.h / 2);
  ctx.restore();
}

export function drawSharedSlider(ctx, bounds, {
  label = '',
  value = 0,
  min = 0,
  max = 1,
  accent = UI_SUITE.colors.accent2,
  decimals = null
} = {}) {
  if (!bounds) return { track: null, nextY: 0 };
  const t = clampValue((Number(value) - min) / Math.max(0.0001, max - min), 0, 1);
  const valueText = Number(value).toFixed(decimals ?? (Math.abs(max - min) > 10 ? 0 : 2));
  const track = { x: bounds.x, y: bounds.y + 18, w: bounds.w, h: 12 };
  ctx.save();
  ctx.fillStyle = UI_SUITE.colors.muted;
  ctx.font = `11px ${UI_SUITE.font.family}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${label}: ${valueText}`, bounds.x, bounds.y + 8);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(track.x, track.y, track.w, track.h);
  ctx.fillStyle = accent;
  ctx.fillRect(track.x, track.y, track.w * t, track.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(track.x, track.y, track.w, track.h);
  ctx.restore();
  return { track, nextY: bounds.y + Math.max(38, bounds.h) + UI_SUITE.spacing.gap };
}

export function drawSharedSegmentedControl(ctx, bounds, segments = [], {
  activeId = null,
  gap = 4,
  drawButton = null
} = {}) {
  const count = Math.max(1, segments.length);
  const buttonW = Math.floor((bounds.w - gap * (count - 1)) / count);
  return segments.map((segment, index) => {
    const buttonBounds = {
      x: bounds.x + index * (buttonW + gap),
      y: bounds.y,
      w: index === count - 1 ? Math.max(0, bounds.x + bounds.w - (bounds.x + index * (buttonW + gap))) : buttonW,
      h: bounds.h,
      id: segment.id
    };
    if (drawButton) drawButton(buttonBounds, segment, segment.id === activeId);
    return { ...segment, bounds: buttonBounds, active: segment.id === activeId };
  });
}

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
  fileLabel: 'File',
  closeLabel: 'Close Drawer',
  exitLabel: 'Exit to Main Menu'
};

export const SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES = Object.freeze([
  'document-summary',
  'selection-summary',
  'active-tool-summary',
  'transport',
  'status',
  'contextual-quick-actions'
]);

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
    showTitle = true,
    footerMode = 'stacked',
    footerItem = null,
    layoutMode = isMobile ? 'auto-grid' : 'list',
    minColumnWidth = 120,
    maxColumns = 2,
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
      footerMode,
      footerItem,
      showTitle,
      layoutMode,
      minColumnWidth,
      maxColumns,
      layout: {
        padding: this.options.panelPadding,
        headerHeight: showTitle
          ? rowHeight + this.options.panelPadding * 2
          : 0,
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
    ? 'rgba(46,86,132,0.72)'
    : subtle
      ? 'rgba(255,255,255,0.045)'
      : 'rgba(18,28,42,0.82)';
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.fillStyle = active ? 'rgba(255,225,106,0.22)' : 'rgba(255,255,255,0.045)';
  ctx.fillRect(bounds.x, bounds.y, bounds.w, Math.max(1, Math.floor(bounds.h / 2)));
  ctx.fillStyle = active ? UI_SUITE.colors.accent : 'rgba(111,171,231,0.72)';
  ctx.fillRect(bounds.x, bounds.y, 4, bounds.h);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.globalAlpha = prevAlpha;
  return active ? '#ffffff' : 'rgba(238,245,255,0.9)';
}

export function normalizeSharedControlBounds(bounds, {
  minWidth = UI_SUITE.spacing.compact,
  minHeight = UI_SUITE.spacing.compact
} = {}) {
  if (!bounds) return bounds;
  const next = { ...bounds };
  if (Number.isFinite(minWidth) && next.w < minWidth) {
    const delta = minWidth - next.w;
    next.x -= delta / 2;
    next.w = minWidth;
  }
  if (Number.isFinite(minHeight) && next.h < minHeight) {
    const delta = minHeight - next.h;
    next.y -= delta / 2;
    next.h = minHeight;
  }
  return next;
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

export function drawSharedDesktopTopMenu(ctx, plan, {
  focusedId = null,
  activeId = null,
  idPrefix = '',
  maxLabelPadding = 8,
  registerButton = null
} = {}) {
  const rendered = [];
  rendered.surface = 'top-menu';
  rendered.role = 'desktop-root-menu';
  rendered.fit = plan?.fit || null;
  if (!ctx || !plan?.bounds) return rendered;
  drawSharedPanel(ctx, plan.bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
  (plan.buttons || []).forEach((button) => {
    const id = button.id;
    const bounds = { ...button.bounds, id: idPrefix ? `${idPrefix}${id}` : id };
    const active = Boolean(button.active || (activeId && id === activeId));
    const focused = Boolean(focusedId && id === focusedId);
    const color = drawSharedMenuButtonChrome(ctx, bounds, { active });
    drawSharedMenuButtonLabel(ctx, bounds, button.label, {
      color,
      fontSize: 12,
      maxWidth: Math.max(1, bounds.w - maxLabelPadding)
    });
    if (focused) drawSharedFocusRing(ctx, bounds, { padding: 1 });
    const renderedButton = { ...button, bounds };
    rendered.push(renderedButton);
    if (typeof registerButton === 'function') registerButton(renderedButton);
  });
  return rendered;
}

export function drawSharedDesktopContextPanel(ctx, bounds, {
  title = 'Active',
  lines = [],
  status = '',
  role = 'context-inspector',
  surface = 'left-context-panel',
  contentRoles = ['document-summary', 'active-tool-summary', 'selection-summary', 'status'],
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  titleSize = 13,
  lineSize = 11,
  lineGap = 20,
  titleY = 20,
  firstLineY = 46,
  fill = UI_SUITE.colors.panel,
  border = UI_SUITE.colors.border
} = {}) {
  const allowedContentRoles = new Set(SHARED_DESKTOP_CONTEXT_ALLOWED_CONTENT_ROLES);
  const safeContentRoles = Array.isArray(contentRoles)
    ? [...new Set(contentRoles
      .filter(Boolean)
      .map((entry) => String(entry))
      .filter((entry) => allowedContentRoles.has(entry)))]
    : [];
  const panelModel = {
    surface,
    role,
    contentRoles: safeContentRoles,
    duplicatesTopDropdownCommands: false
  };
  if (!ctx || !bounds) return panelModel;
  drawSharedPanel(ctx, bounds, { fill, border });
  const safeLines = Array.isArray(lines) ? lines.filter((line) => line !== null && line !== undefined) : [];
  ctx.save();
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `${titleSize}px ${UI_SUITE.font.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const textMaxWidth = Math.max(1, bounds.w - padding * 2);
  ctx.fillText(
    clipMenuLabel(ctx, String(title || 'Context'), textMaxWidth),
    bounds.x + padding,
    bounds.y + titleY,
    textMaxWidth
  );
  ctx.fillStyle = UI_SUITE.colors.text;
  ctx.font = `${lineSize}px ${UI_SUITE.font.family}`;
  safeLines.forEach((line, index) => {
    const y = bounds.y + firstLineY + index * lineGap;
    if (y <= bounds.y + bounds.h - 12) {
      ctx.fillText(clipMenuLabel(ctx, String(line), textMaxWidth), bounds.x + padding, y, textMaxWidth);
    }
  });
  if (status) {
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.fillText(clipMenuLabel(ctx, String(status), textMaxWidth), bounds.x + padding, bounds.y + bounds.h - 18, textMaxWidth);
  }
  ctx.restore();
  return panelModel;
}

export function drawSharedDesktopRibbon(ctx, bounds, {
  title = '',
  subtitle = '',
  padding = 12,
  titleY = 18,
  subtitleY = 38,
  titleSize = 12,
  subtitleSize = 11,
  fill = UI_SUITE.colors.panelAlt,
  border = UI_SUITE.colors.border
} = {}) {
  if (!ctx || !bounds) return;
  drawSharedPanel(ctx, bounds, { fill, border });
  const labelMaxW = Math.max(1, bounds.w - padding * 2);
  ctx.save();
  ctx.fillStyle = UI_SUITE.colors.accent;
  ctx.font = `${titleSize}px ${UI_SUITE.font.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(clipMenuLabel(ctx, String(title || ''), labelMaxW), bounds.x + padding, bounds.y + titleY, labelMaxW);
  if (subtitle) {
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `${subtitleSize}px ${UI_SUITE.font.family}`;
    ctx.fillText(clipMenuLabel(ctx, String(subtitle), labelMaxW), bounds.x + padding, bounds.y + subtitleY, labelMaxW);
  }
  ctx.restore();
}

export function buildSharedDesktopContextTransportLayout(bounds, {
  includeTransport = false,
  transportMinHeight = 96,
  transportMaxHeight = 118,
  transportRatio = 0.24,
  gap = SHARED_EDITOR_LEFT_MENU.desktopContentGap,
  minContextHeight = 120
} = {}) {
  if (!bounds) return { contextBounds: null, transportBounds: null, gap: 0, transportHeight: 0 };
  if (!includeTransport) {
    return {
      contextBounds: { ...bounds },
      transportBounds: null,
      gap: 0,
      transportHeight: 0
    };
  }
  const safeGap = Math.max(0, Number(gap) || 0);
  const minH = Math.max(0, Number(transportMinHeight) || 0);
  const maxH = Math.max(minH, Number(transportMaxHeight) || minH);
  const ratio = Math.max(0, Number(transportRatio) || 0);
  const transportHeight = Math.min(maxH, Math.max(minH, Math.floor(bounds.h * ratio)));
  const contextBounds = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: Math.max(Math.max(1, Number(minContextHeight) || 0), bounds.h - transportHeight - safeGap)
  };
  const transportBounds = {
    x: bounds.x,
    y: contextBounds.y + contextBounds.h + safeGap,
    w: bounds.w,
    h: transportHeight
  };
  return { contextBounds, transportBounds, gap: safeGap, transportHeight };
}

export function drawSharedDesktopDropdown(ctx, dropdownPlan, {
  isActive = null,
  isFocused = null,
  renderItem = null,
  registerButton = null,
  registerScrollRegion = null,
  fontSize = 11,
  maxLabelPadding = 8,
  shadow = UI_SUITE.colors.shadow
} = {}) {
  if (!ctx || !dropdownPlan?.panelBounds) return [];
  const motion = dropdownPlan.motion || {};
  const translateY = Number(motion.translateY) || 0;
  const alpha = Math.max(0, Math.min(1, Number(motion.opacity ?? 1)));
  const panelBounds = {
    ...dropdownPlan.panelBounds,
    y: dropdownPlan.panelBounds.y + translateY
  };
  if (typeof registerScrollRegion === 'function' && dropdownPlan.scrollRegion) {
    registerScrollRegion({
      ...dropdownPlan.scrollRegion,
      bounds: {
        ...dropdownPlan.scrollRegion.bounds,
        y: Number(dropdownPlan.scrollRegion.bounds?.y || 0) + translateY
      }
    });
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = UI_SUITE.colors.panel;
  ctx.fillRect(
    panelBounds.x,
    panelBounds.y,
    panelBounds.w,
    panelBounds.h
  );
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  drawSharedPanel(ctx, panelBounds, {
    fill: UI_SUITE.colors.panel,
    border: UI_SUITE.colors.border
  });
  const renderedButtons = [];
  (dropdownPlan.renderedItems || []).forEach((item, index) => {
    const sourceBounds = dropdownPlan.itemBounds?.[index] || {};
    const bounds = {
      ...sourceBounds,
      y: Number(sourceBounds.y || 0) + translateY,
      id: item.id || `separator-${index}`
    };
    if (item.divider || item.separator) {
      const lineY = bounds.y + Math.floor(bounds.h / 2);
      ctx.save();
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(bounds.x + 6, lineY);
      ctx.lineTo(bounds.x + Math.max(6, bounds.w - 6), lineY);
      ctx.stroke();
      ctx.restore();
      renderedButtons.push({ item, index, bounds, separator: true });
      return;
    }
    const active = typeof isActive === 'function' ? Boolean(isActive(item, index)) : Boolean(item.active);
    const focused = typeof isFocused === 'function' ? Boolean(isFocused(item, index)) : false;
    const rendered = { item, index, bounds };
    if (item.startsEditActionRoleGroup) {
      ctx.save();
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      ctx.moveTo(bounds.x + 6, bounds.y - 2);
      ctx.lineTo(bounds.x + Math.max(6, bounds.w - 6), bounds.y - 2);
      ctx.stroke();
      ctx.restore();
    }
    if (typeof renderItem === 'function') {
      renderItem({ item, index, bounds, active, focused });
    } else {
      const color = drawSharedMenuButtonChrome(ctx, bounds, { active, subtle: Boolean(item.disabled) });
      drawSharedMenuButtonLabel(ctx, bounds, item.label, {
        color: item.disabled ? UI_SUITE.colors.muted : color,
        fontSize,
        maxWidth: Math.max(1, bounds.w - maxLabelPadding)
      });
      if (focused) drawSharedFocusRing(ctx, bounds);
    }
    renderedButtons.push(rendered);
    if (typeof registerButton === 'function' && !item.disabled) registerButton(rendered);
  });
  ctx.restore();
  return renderedButtons;
}

export function drawSharedPlayStopButton(ctx, bounds, {
  isActive = false,
  stopWhenActive = false,
  alpha = 0.95,
  subtle = false,
  icon = stopWhenActive
    ? (isActive ? '⏹' : '▶')
    : (isActive ? '❚❚' : '▶')
} = {}) {
  drawSharedTransportIconButton(ctx, bounds, {
    icon,
    active: isActive,
    subtle,
    alpha,
    emphasis: true
  });
}

export function drawSharedTransportIconButton(ctx, bounds, {
  icon,
  active = false,
  emphasis = false,
  subtle = false,
  alpha = 0.95,
  role = 'default'
} = {}) {
  if (!bounds) return;
  const isRecord = role === 'record';
  const fill = isRecord
    ? 'rgba(255,106,106,0.86)'
    : active
      ? 'rgba(46,86,132,0.72)'
      : subtle
        ? 'rgba(255,255,255,0.045)'
        : 'rgba(18,28,42,0.82)';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  if (emphasis) {
    ctx.fillStyle = active ? 'rgba(255,225,106,0.22)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(bounds.x + 1, bounds.y + 1, Math.max(0, bounds.w - 2), Math.max(0, Math.floor(bounds.h * 0.38)));
  }
  ctx.fillStyle = active ? UI_SUITE.colors.accent : 'rgba(111,171,231,0.72)';
  ctx.fillRect(bounds.x, bounds.y, 4, bounds.h);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = active && !isRecord ? '#ffffff' : UI_SUITE.colors.text;
  const baseSize = Math.max(12, Math.min(20, Math.round(bounds.h * 0.45)));
  const fontSize = emphasis ? baseSize + 2 : baseSize;
  ctx.font = `${fontSize}px ${UI_SUITE.font.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon ?? '', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 1);
  ctx.restore();
}

export const drawSharedTransportButton = drawSharedTransportIconButton;

export function getSharedTransportPopoverLayout(anchorBounds, viewportBounds, items = [], {
  columns = 2,
  rowHeight = UI_SUITE.spacing.tap,
  columnWidth = 64,
  gap = UI_SUITE.spacing.gap,
  padding = UI_SUITE.spacing.gap
} = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const safeColumns = Math.max(1, columns);
  const maxRow = safeItems.reduce((max, item, index) => Math.max(max, Number.isInteger(item.row) ? item.row : Math.floor(index / safeColumns)), 0);
  const rows = Math.max(1, maxRow + 1);
  const panelW = padding * 2 + safeColumns * columnWidth + Math.max(0, safeColumns - 1) * gap;
  const panelH = padding * 2 + rows * rowHeight + Math.max(0, rows - 1) * gap;
  const viewport = viewportBounds || { x: 0, y: 0, w: 0, h: 0 };
  const anchor = anchorBounds || { x: viewport.x + viewport.w / 2, y: viewport.y + viewport.h, w: 1, h: 1 };
  const idealX = anchor.x + anchor.w - panelW;
  const idealY = anchor.y - panelH - gap;
  const panel = {
    x: clampValue(idealX, viewport.x + padding, Math.max(viewport.x + padding, viewport.x + viewport.w - panelW - padding)),
    y: clampValue(idealY, viewport.y + padding, Math.max(viewport.y + padding, viewport.y + viewport.h - panelH - padding)),
    w: panelW,
    h: panelH
  };
  const buttons = safeItems.map((item, index) => {
    const col = clampValue(Number.isInteger(item.col) ? item.col : index % safeColumns, 0, safeColumns - 1);
    const row = Math.max(0, Number.isInteger(item.row) ? item.row : Math.floor(index / safeColumns));
    return {
      ...item,
      bounds: {
        x: panel.x + padding + col * (columnWidth + gap),
        y: panel.y + padding + row * (rowHeight + gap),
        w: columnWidth,
        h: rowHeight
      }
    };
  });
  return { panel, buttons, rows, columns: safeColumns };
}

export function drawSharedTransportPopover(ctx, anchorBounds, viewportBounds, items = [], options = {}) {
  const layout = getSharedTransportPopoverLayout(anchorBounds, viewportBounds, items, options);
  drawSharedPanel(ctx, layout.panel, {
    fill: options.fill ?? UI_SUITE.colors.panel,
    border: options.border ?? UI_SUITE.colors.accent
  });
  layout.buttons.forEach((button) => {
    drawSharedTransportIconButton(ctx, button.bounds, {
      icon: button.label,
      active: Boolean(button.active),
      emphasis: Boolean(button.primary)
    });
  });
  return layout;
}

export function getSharedThumbstickLayout(width, height, {
  controlMargin = null,
  maxRadius = 78,
  radiusScale = 0.14,
  knobScale = 0.45,
  minKnobRadius = 22
} = {}) {
  const controlBase = Math.min(width || 0, height || 0);
  const margin = Number.isFinite(controlMargin) ? controlMargin : Math.max(16, controlBase * 0.04);
  const radius = Math.min(maxRadius, controlBase * radiusScale);
  const knobRadius = Math.max(minKnobRadius, radius * knobScale);
  return {
    center: {
      x: margin + radius,
      y: height - margin - radius
    },
    radius,
    knobRadius,
    controlMargin: margin
  };
}

export function drawSharedThumbstick(ctx, {
  center = { x: 0, y: 0 },
  radius = 0,
  knobRadius = 0,
  dx = 0,
  dy = 0
} = {}, {
  fill = 'rgba(0,0,0,0.42)',
  border = 'rgba(255,255,255,0.35)',
  knob = 'rgba(255,255,255,0.85)'
} = {}) {
  if (!ctx || !center || radius <= 0) return;
  const knobX = center.x + dx * radius;
  const knobY = center.y + dy * radius;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function resetSharedThumbstickState(thumbstick) {
  if (!thumbstick) return;
  thumbstick.center = { x: 0, y: 0 };
  thumbstick.radius = 0;
  thumbstick.knobRadius = 0;
  thumbstick.active = false;
  thumbstick.id = null;
  thumbstick.dx = 0;
  thumbstick.dy = 0;
}

export function getSharedPortraitActionRailLayout(actionRail, {
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  gap = SHARED_EDITOR_LEFT_MENU.panelGap,
  maxThumbstickSize = 72,
  minThumbstickSize = 56
} = {}) {
  const rail = actionRail || { x: 0, y: 0, w: 0, h: 0 };
  const safePadding = Math.max(0, padding);
  const safeGap = Math.max(0, gap);
  const thumbstickSize = clampValue(
    Math.min(maxThumbstickSize, Math.max(0, rail.h - safePadding * 2)),
    Math.min(minThumbstickSize, Math.max(0, rail.h - safePadding * 2)),
    maxThumbstickSize
  );
  const thumbstickBounds = {
    x: rail.x + safePadding,
    y: rail.y + Math.max(0, Math.floor((rail.h - thumbstickSize) / 2)),
    w: thumbstickSize,
    h: thumbstickSize
  };
  const thumbstickRadius = Math.max(1, Math.floor(thumbstickSize / 2));
  const thumbstickCenter = {
    x: thumbstickBounds.x + thumbstickBounds.w / 2,
    y: thumbstickBounds.y + thumbstickBounds.h / 2
  };
  const actionX = thumbstickBounds.x + thumbstickBounds.w + safeGap;
  const actionArea = {
    x: actionX,
    y: rail.y + safePadding,
    w: Math.max(1, rail.x + rail.w - safePadding - actionX),
    h: Math.max(1, rail.h - safePadding * 2)
  };
  return {
    actionRail: rail,
    thumbstickBounds,
    thumbstickCenter,
    thumbstickRadius,
    knobRadius: Math.max(18, Math.floor(thumbstickRadius * 0.45)),
    actionArea
  };
}

export function getSharedPortraitRailActionButtons(actionRail, actions = [], {
  buttonHeight = UI_SUITE.spacing.tap,
  minButtonWidth = UI_SUITE.spacing.tap,
  maxButtonWidth = 58,
  gap = SHARED_EDITOR_LEFT_MENU.buttonGap,
  menuWidth = 54,
  reserveThumbstick = true
} = {}) {
  const railLayout = reserveThumbstick
    ? getSharedPortraitActionRailLayout(actionRail)
    : {
      actionRail,
      thumbstickBounds: { x: 0, y: 0, w: 0, h: 0 },
      thumbstickCenter: { x: 0, y: 0 },
      thumbstickRadius: 0,
      knobRadius: 0,
      actionArea: actionRail || { x: 0, y: 0, w: 0, h: 0 }
    };
  const safeActions = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const actionArea = railLayout.actionArea;
  const safeGap = Math.max(0, gap);
  const safeButtonH = Math.min(buttonHeight, Math.max(1, actionArea.h));
  const y = actionArea.y + Math.floor((actionArea.h - safeButtonH) / 2);
  const slots = safeActions.length;
  if (!slots) return { ...railLayout, buttons: [] };
  const preferredWidths = safeActions.map((action, index) => {
    if (Number.isFinite(action.width)) return action.width;
    if (index === 0 && action.id === 'menu') return menuWidth;
    if (action.primary) return Math.max(minButtonWidth, Math.min(96, actionArea.w * 0.34));
    return maxButtonWidth;
  });
  const preferredTotal = preferredWidths.reduce((sum, width) => sum + width, 0) + safeGap * Math.max(0, slots - 1);
  const scale = preferredTotal > actionArea.w
    ? Math.max(0.1, (actionArea.w - safeGap * Math.max(0, slots - 1)) / Math.max(1, preferredWidths.reduce((sum, width) => sum + width, 0)))
    : 1;
  const buttons = [];
  let x = actionArea.x;
  safeActions.forEach((action, index) => {
    const remaining = slots - index;
    const remainingGap = safeGap * Math.max(0, remaining - 1);
    const maxRemainingW = actionArea.x + actionArea.w - x - remainingGap;
    const width = index === slots - 1
      ? Math.max(minButtonWidth, maxRemainingW)
      : clampValue(Math.floor(preferredWidths[index] * scale), minButtonWidth, Math.max(minButtonWidth, maxButtonWidth));
    buttons.push({
      ...action,
      bounds: { x, y, w: width, h: safeButtonH }
    });
    x += width + safeGap;
  });
  return { ...railLayout, buttons };
}

export const SHARED_PORTRAIT_RAIL_ACTION_COUNT = 4;

export function getSharedPortraitRailActionIds(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .filter(Boolean)
    .map((action) => action.id);
}

export function assertSharedPortraitRailActionCount(actions = [], {
  editor = 'editor',
  expected = SHARED_PORTRAIT_RAIL_ACTION_COUNT
} = {}) {
  const ids = getSharedPortraitRailActionIds(actions);
  if (ids.length !== expected) {
    throw new Error(`${editor} portrait action rail must expose exactly ${expected} actions; received ${ids.length}: ${ids.join(', ')}`);
  }
  return ids;
}

export function drawSharedPortraitActionRail(ctx, actionRail, thumbstick, actions = [], {
  drawButton,
  drawPanel = true,
  reserveThumbstick = true
} = {}) {
  if (!ctx || !actionRail) return { buttons: [] };
  if (drawPanel) drawSharedBottomRail(ctx, actionRail);
  const layout = getSharedPortraitRailActionButtons(actionRail, actions, { reserveThumbstick });
  if (thumbstick && reserveThumbstick) {
    thumbstick.center = layout.thumbstickCenter;
    thumbstick.radius = layout.thumbstickRadius;
    thumbstick.knobRadius = layout.knobRadius;
    drawSharedThumbstick(ctx, thumbstick);
  }
  if (typeof drawButton === 'function') {
    layout.buttons.forEach((button) => drawButton(button.bounds, button));
  }
  return layout;
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

export function isMobilePortraitLayout({
  isMobile = false,
  viewportWidth = 0,
  viewportHeight = 0
} = {}) {
  return Boolean(isMobile && Number(viewportHeight) > Number(viewportWidth));
}

export function getSharedMobilePortraitEditorLayout(viewportWidth, viewportHeight, {
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  gap = SHARED_EDITOR_LEFT_MENU.panelGap,
  middleRailHeight = 104,
  maxBottomRailHeight = 96,
  minTopHeight = 220,
  minMainHeight = 220,
  topRatio = 0.5,
  sheetRatio = 0.68
} = {}) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const safePadding = Math.max(0, padding);
  const safeGap = Math.max(0, gap);
  const preferredMiddleH = clampValue(
    middleRailHeight,
    72,
    Math.max(72, Math.min(maxBottomRailHeight, Math.floor(height * 0.14)))
  );
  const contentX = safePadding;
  const contentW = Math.max(1, width - safePadding * 2);
  const actionRail = {
    x: contentX,
    y: Math.max(safePadding, height - safePadding - preferredMiddleH),
    w: contentW,
    h: preferredMiddleH
  };
  const workSurface = {
    x: contentX,
    y: safePadding,
    w: contentW,
    h: Math.max(1, actionRail.y - safeGap - safePadding)
  };
  const sheetH = clampValue(
    Math.round(height * clampValue(sheetRatio, 0.45, 0.82)),
    Math.min(minTopHeight, Math.max(1, height - safePadding * 2)),
    Math.max(1, height - safePadding * 2 - Math.min(96, preferredMiddleH))
  );
  const menuSheet = {
    x: contentX,
    y: Math.max(safePadding, actionRail.y - safeGap - sheetH),
    w: contentW,
    h: sheetH
  };
  const rootRailH = Math.min(52, Math.max(44, Math.floor(sheetH * 0.16)));
  const rootRail = {
    x: menuSheet.x,
    y: menuSheet.y + menuSheet.h - rootRailH,
    w: menuSheet.w,
    h: rootRailH
  };
  const subRail = {
    x: menuSheet.x,
    y: menuSheet.y + safeGap,
    w: menuSheet.w,
    h: Math.max(1, rootRail.y - safeGap - (menuSheet.y + safeGap))
  };
  const bottomRail = actionRail;
  const rootTabs = rootRail;
  const sheetContent = subRail;
  return {
    isPortrait: height > width,
    topMenus: menuSheet,
    menuPanel: menuSheet,
    menuSheet,
    leftRail: rootRail,
    rightRail: subRail,
    middleRail: actionRail,
    mainEditor: workSurface,
    bottomRail,
    rootTabs,
    sheetContent,
    rootRail,
    subRail,
    portraitRootPlacement: 'bottom-rail',
    actionRail,
    workSurface,
    padding: safePadding,
    gap: safeGap,
    rowHeight: UI_SUITE.spacing.compact,
    touchRowHeight: UI_SUITE.spacing.tap,
    workSurfaceRatio: workSurface.h / height
  };
}

export function drawSharedPortraitSheet(ctx, bounds, {
  fill = UI_SUITE.colors.panel,
  border = UI_SUITE.colors.border,
  scrim = true
} = {}) {
  const model = {
    surface: 'bottom-sheet',
    role: 'portrait-command-sheet',
    commandSurface: 'bottom-sheet',
    pointerType: 'touch',
    rowActivation: 'tap-release',
    gestureScroll: true
  };
  if (!ctx || !bounds) return model;
  ctx.save();
  if (scrim) {
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  drawSharedPanel(ctx, bounds, { fill, border });
  ctx.restore();
  return model;
}

export function drawSharedPortraitTabStrip(ctx, bounds, tabs = [], {
  activeId = null,
  focusedId = null,
  rowHeight = UI_SUITE.spacing.compact,
  gap = SHARED_EDITOR_LEFT_MENU.buttonGap,
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  maxButtonWidth = 116,
  minButtonWidth = 72,
  drawButton
} = {}) {
  if (!ctx || !bounds || !tabs.length || !drawButton) return { firstIndex: 0, visibleCount: 0 };
  const innerX = bounds.x + padding;
  const innerY = bounds.y + Math.max(0, Math.floor((bounds.h - rowHeight) / 2));
  const innerW = Math.max(1, bounds.w - padding * 2);
  const visibleCount = Math.max(1, Math.floor((innerW + gap) / Math.max(1, minButtonWidth + gap)));
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === (focusedId || activeId)));
  const firstIndex = clampValue(activeIndex - Math.floor(visibleCount / 2), 0, Math.max(0, tabs.length - visibleCount));
  const shown = tabs.slice(firstIndex, firstIndex + visibleCount);
  const buttonW = clampValue(Math.floor((innerW - gap * Math.max(0, shown.length - 1)) / Math.max(1, shown.length)), minButtonWidth, maxButtonWidth);
  shown.forEach((tab, index) => {
    drawButton({
      x: innerX + index * (buttonW + gap),
      y: innerY,
      w: buttonW,
      h: rowHeight
    }, tab, {
      active: tab.id === activeId,
      focused: tab.id === focusedId
    });
  });
  drawSharedPortraitScrollHints(ctx, bounds, {
    scroll: firstIndex,
    scrollMax: Math.max(0, tabs.length - visibleCount)
  });
  return { firstIndex, visibleCount };
}

export function getSharedPortraitMultiRowTabLayout(bounds, tabs = [], {
  rowHeight = UI_SUITE.spacing.compact,
  gap = SHARED_EDITOR_LEFT_MENU.buttonGap,
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  minButtonWidth = 68,
  maxButtonWidth = 116,
  maxRows = 2,
  maxColumns = null,
  balanceLastRow = false,
  verticalAlign = 'center'
} = {}) {
  if (!bounds || !Array.isArray(tabs) || tabs.length === 0) {
    return { buttons: [], rows: 0, columns: 0, rowHeight, totalHeight: 0, fits: true };
  }
  const innerW = Math.max(1, bounds.w - padding * 2);
  const safeRows = Math.max(1, maxRows);
  const maxColumnsByWidth = Math.max(1, Math.floor((innerW + gap) / Math.max(1, minButtonWidth + gap)));
  const columnCap = Number.isFinite(maxColumns) ? Math.max(1, Math.floor(maxColumns)) : maxColumnsByWidth;
  const allowedColumns = Math.min(maxColumnsByWidth, columnCap);
  const rows = Math.min(safeRows, Math.max(1, Math.ceil(tabs.length / allowedColumns)));
  const columns = Math.max(1, Math.min(columnCap, Math.ceil(tabs.length / rows), allowedColumns));
  const totalHeight = rows * rowHeight + Math.max(0, rows - 1) * gap;
  const startX = bounds.x + padding;
  const availableH = Math.max(1, bounds.h - padding * 2);
  const freeY = Math.max(0, availableH - totalHeight);
  const verticalOffset = verticalAlign === 'bottom'
    ? freeY
    : verticalAlign === 'top'
      ? 0
      : Math.floor(freeY / 2);
  const startY = bounds.y + padding + verticalOffset;
  const buttons = tabs.map((tab, index) => {
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const remaining = Math.max(1, tabs.length - rowStart);
    const rowColumns = balanceLastRow ? Math.min(columns, remaining) : columns;
    const col = index - rowStart;
    const rawButtonW = Math.floor((innerW - gap * Math.max(0, rowColumns - 1)) / rowColumns);
    const buttonW = Math.min(Math.max(1, rawButtonW), Math.min(maxButtonWidth, innerW));
    return {
      ...tab,
      bounds: {
        x: startX + col * (buttonW + gap),
        y: startY + row * (rowHeight + gap),
        w: buttonW,
        h: rowHeight
      },
      row,
      col
    };
  });
  const minWidthMet = buttons.every((button) => button.bounds.w >= minButtonWidth);
  return {
    buttons,
    rows,
    columns,
    rowHeight,
    totalHeight,
    fits: minWidthMet && totalHeight <= Math.max(1, bounds.h - padding * 2)
  };
}

export function drawSharedPortraitMultiRowTabStrip(ctx, bounds, tabs = [], {
  activeId = null,
  focusedId = null,
  drawButton,
  ...layoutOptions
} = {}) {
  const layout = getSharedPortraitMultiRowTabLayout(bounds, tabs, layoutOptions);
  if (!ctx || !drawButton) return layout;
  layout.buttons.forEach((entry) => {
    drawButton(entry.bounds, entry, {
      active: entry.id === activeId,
      focused: entry.id === focusedId
    });
  });
  return layout;
}

export function getSharedPortraitMenuMetrics(bounds, {
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  rowHeight = UI_SUITE.spacing.compact,
  rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap
} = {}) {
  const safePadding = Math.max(0, padding);
  const safeRowH = Math.max(32, rowHeight);
  const safeGap = Math.max(0, rowGap);
  const listBounds = {
    x: bounds.x + safePadding,
    y: bounds.y + safePadding,
    w: Math.max(1, bounds.w - safePadding * 2),
    h: Math.max(1, bounds.h - safePadding * 2)
  };
  return {
    listBounds,
    rowHeight: safeRowH,
    rowGap: safeGap,
    visibleRows: Math.max(1, Math.floor((listBounds.h + safeGap) / Math.max(1, safeRowH + safeGap)))
  };
}

export function drawSharedPortraitScrollHints(ctx, bounds, {
  scroll = 0,
  scrollMax = 0,
  color = UI_SUITE.colors.accent,
  trackColor = 'rgba(255,255,255,0.14)',
  minThumbHeight = 24
} = {}) {
  if (!ctx || !bounds || scrollMax <= 0) return;
  const trackW = 4;
  const trackPad = 8;
  const track = {
    x: bounds.x + bounds.w - trackPad - trackW,
    y: bounds.y + trackPad,
    w: trackW,
    h: Math.max(1, bounds.h - trackPad * 2)
  };
  const maxScroll = Math.max(1, Number(scrollMax) || 1);
  const current = clampValue(Number(scroll) || 0, 0, maxScroll);
  const visibleRatio = clampValue(1 / (maxScroll + 1), 0.18, 1);
  const thumbH = Math.max(Math.min(track.h, minThumbHeight), Math.round(track.h * visibleRatio));
  const travel = Math.max(0, track.h - thumbH);
  const thumbY = track.y + Math.round(travel * (current / maxScroll));
  ctx.save();
  ctx.fillStyle = trackColor;
  ctx.fillRect(track.x, track.y, track.w, track.h);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(track.x - 1, thumbY, track.w + 2, thumbH);
  ctx.restore();
  return { track, thumb: { x: track.x - 1, y: thumbY, w: track.w + 2, h: thumbH } };
}

export function drawSharedContextRibbon(ctx, bounds, actions = [], {
  title = '',
  padding = 8,
  gap = 6,
  minButtonWidth = 54,
  maxButtonWidth = 132,
  drawButton,
  registerAction
} = {}) {
  if (!ctx || !bounds) return { bounds, buttons: [] };
  const visible = (Array.isArray(actions) ? actions : []).filter((action) => action && !action.hidden);
  if (!visible.length) return { bounds, buttons: [] };
  drawSharedPanel(ctx, bounds, {
    fill: UI_SUITE.colors.panel,
    border: UI_SUITE.colors.border,
    alpha: 0.96
  });
  const titleW = title ? Math.min(96, Math.max(54, Math.floor(bounds.w * 0.24))) : 0;
  if (title) {
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, bounds.x + padding, bounds.y + bounds.h / 2);
    ctx.restore();
  }
  const listX = bounds.x + padding + titleW + (titleW ? gap : 0);
  const listW = Math.max(1, bounds.x + bounds.w - padding - listX);
  const buttonH = Math.max(32, Math.min(44, bounds.h - padding * 2));
  const buttonY = bounds.y + Math.max(0, Math.floor((bounds.h - buttonH) / 2));
  const count = Math.max(1, visible.length);
  const buttonW = clampValue(Math.floor((listW - gap * (count - 1)) / count), minButtonWidth, maxButtonWidth);
  const buttons = [];
  visible.forEach((action, index) => {
    const buttonBounds = {
      x: listX + index * (buttonW + gap),
      y: buttonY,
      w: Math.min(buttonW, Math.max(1, bounds.x + bounds.w - padding - (listX + index * (buttonW + gap)))),
      h: buttonH,
      id: action.id
    };
    if (buttonBounds.w < minButtonWidth * 0.66) return;
    if (typeof drawButton === 'function') {
      drawButton(buttonBounds, action);
    } else {
      const textColor = drawSharedMenuButtonChrome(ctx, buttonBounds, { active: Boolean(action.active), subtle: Boolean(action.disabled) });
      drawSharedMenuButtonLabel(ctx, buttonBounds, action.label || action.icon || action.id, {
        color: action.disabled ? UI_SUITE.colors.muted : textColor,
        fontSize: 11
      });
    }
    if (typeof registerAction === 'function' && !action.disabled) {
      registerAction(buttonBounds, action);
    }
    buttons.push({ ...action, bounds: buttonBounds });
  });
  return { bounds, buttons };
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

export function isMobileLandscapeLayout({
  isMobile = false,
  viewportWidth = 0,
  viewportHeight = 0
} = {}) {
  return Boolean(isMobile && Number(viewportWidth) > Number(viewportHeight));
}

export function getSharedMobileLandscapeEditorLayout(viewportWidth, viewportHeight, {
  padding = SHARED_EDITOR_LEFT_MENU.panelPadding,
  gap = SHARED_EDITOR_LEFT_MENU.panelGap,
  leftRailWidth = null,
  rightRailWidth = null,
  bottomRailHeight = 0,
  reserveRightRail = true,
  reserveThumbstickSpace = true,
  minLeftRailHeight = SHARED_EDITOR_LEFT_MENU.buttonHeightMobile * 4 + SHARED_EDITOR_LEFT_MENU.buttonGap * 3 + SHARED_EDITOR_LEFT_MENU.panelPadding * 2,
  thumbstick = null
} = {}) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const safePadding = Math.max(0, padding);
  const safeGap = Math.max(0, gap);
  const stick = thumbstick || getSharedThumbstickLayout(width, height, {
    maxRadius: 72,
    radiusScale: 0.16
  });
  const thumbstickBounds = {
    x: Math.max(0, Math.round(stick.center.x - stick.radius - safeGap)),
    y: Math.max(0, Math.round(stick.center.y - stick.radius - safeGap)),
    w: Math.round((stick.radius + safeGap) * 2),
    h: Math.round((stick.radius + safeGap) * 2)
  };
  const railW = Math.round(leftRailWidth || getSharedMobileRailWidth(width, height));
  const rightW = reserveRightRail
    ? Math.round(rightRailWidth || getSharedMobileDrawerWidth(width, height, railW, {
      landscapePreferred: railW,
      minContentLandscape: 300
    }))
    : 0;
  const overlayDrawerW = Math.round(rightRailWidth || getSharedMobileDrawerWidth(width, height, railW, {
    edgePadding: 0,
    landscapePreferred: railW,
    minContentLandscape: 300
  }));
  const bottomH = clampValue(Math.round(bottomRailHeight || 0), 0, Math.max(0, Math.floor(height * 0.34)));
  const railMinH = clampValue(Math.round(minLeftRailHeight || 0), 0, height);
  const reservedRailH = Math.max(1, thumbstickBounds.y - safeGap);
  const leftRail = {
    x: 0,
    y: 0,
    w: railW,
    h: reserveThumbstickSpace ? Math.min(height, Math.max(reservedRailH, railMinH)) : height
  };
  const rightRail = reserveRightRail
    ? { x: Math.max(0, width - rightW), y: 0, w: rightW, h: height }
    : { x: width, y: 0, w: 0, h: height };
  const workX = railW + safeGap;
  const workRight = reserveRightRail ? rightRail.x - safeGap : width - safePadding;
  const workBottom = height - safePadding - bottomH;
  const workSurface = {
    x: workX,
    y: safePadding,
    w: Math.max(1, workRight - workX),
    h: Math.max(1, workBottom - safePadding)
  };
  const bottomRail = {
    x: workSurface.x,
    y: workSurface.y + workSurface.h + safeGap,
    w: workSurface.w,
    h: Math.max(0, bottomH - safeGap)
  };
  const overlayDrawer = {
    x: Math.max(0, width - overlayDrawerW),
    y: 0,
    w: overlayDrawerW,
    h: bottomH > 0 ? Math.max(1, bottomRail.y - safeGap) : height
  };
  return {
    isLandscape: width > height,
    leftRail,
    rightRail,
    overlayDrawer,
    workSurface,
    mainEditor: workSurface,
    bottomRail,
    thumbstick: stick,
    thumbstickBounds,
    padding: safePadding,
    gap: safeGap
  };
}

export function splitFileDrawerStickyExitItems(items = [], exitId = 'exit-main') {
  const source = Array.isArray(items) ? items : [];
  const exitItem = source.find((item) => item?.id === exitId) || null;
  const listItems = source.filter((item) => item?.id !== exitId);
  while (listItems.length && (listItems[listItems.length - 1]?.divider || listItems[listItems.length - 1]?.separator)) {
    listItems.pop();
  }
  return { listItems, exitItem };
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
  footerItem = null,
  drawPanel = true,
  panelFill = UI_SUITE.colors.panel,
  panelBorder = UI_SUITE.colors.border,
  panelAlpha = 1,
  layoutMode = 'list',
  minColumnWidth = 120,
  maxColumns = 3
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
  const canGrid = layoutMode === 'auto-grid' && items.length > 1;
  const maxGridColumns = Math.max(1, Math.floor(maxColumns || 1));
  const gridColumns = canGrid
    ? clampValue(
      Math.floor((drawerLayout.listW + rowGap) / Math.max(1, minColumnWidth + rowGap)),
      1,
      maxGridColumns
    )
    : 1;
  const columns = gridColumns > 1 ? gridColumns : 1;
  const cellW = columns > 1
    ? Math.floor((drawerLayout.listW - rowGap * (columns - 1)) / columns)
    : drawerLayout.listW;
  const visibleRows = Math.max(1, Math.floor(drawerLayout.listH / Math.max(1, stride)));
  const visibleCapacity = Math.max(1, visibleRows * columns);
  const scrollMax = Math.max(0, items.length - visibleCapacity);
  const nextScroll = Math.max(0, Math.min(scrollMax, Math.round(scroll || 0)));
  const visibleItems = items.slice(nextScroll, nextScroll + visibleCapacity);
  let cursorY = drawerLayout.listY;
  let gridSlot = 0;
  const itemBounds = [];
  visibleItems.forEach((item) => {
    if (item?.divider) {
      if (columns > 1) return;
      if (columns > 1 && gridSlot % columns !== 0) {
        gridSlot += columns - (gridSlot % columns);
      }
      const dividerRow = columns > 1 ? Math.floor(gridSlot / columns) : 0;
      const dividerY = columns > 1
        ? drawerLayout.listY + dividerRow * stride + Math.max(8, Math.round(Math.max(16, rowHeight) * 0.4))
        : cursorY + 8;
      if (typeof drawDivider === 'function') {
        drawDivider({ x: drawerLayout.listX, y: dividerY, w: drawerLayout.listW, h: 0 }, item);
      } else {
        ctx.strokeStyle = UI_SUITE.colors.border;
        ctx.beginPath();
        ctx.moveTo(drawerLayout.listX, dividerY);
        ctx.lineTo(drawerLayout.listX + drawerLayout.listW, dividerY);
        ctx.stroke();
      }
      if (columns > 1) {
        gridSlot += columns;
        cursorY = drawerLayout.listY + Math.floor(gridSlot / columns) * stride;
      } else {
        cursorY += Math.max(14, Math.round(Math.max(16, rowHeight) * 0.4));
      }
      return;
    }
    const col = columns > 1 ? gridSlot % columns : 0;
    const row = columns > 1 ? Math.floor(gridSlot / columns) : itemBounds.length;
    const bounds = {
      x: drawerLayout.listX + col * (cellW + rowGap),
      y: columns > 1 ? drawerLayout.listY + row * stride : cursorY,
      w: columns > 1 ? cellW : drawerLayout.listW,
      h: buttonHeight ?? Math.max(18, rowHeight),
      id: item?.id
    };
    drawButton(bounds, item);
    itemBounds.push(bounds);
    if (columns > 1) {
      gridSlot += 1;
      cursorY = drawerLayout.listY + (row + 1) * stride;
    } else {
      cursorY += stride;
    }
  });

  let { closeBounds, exitBounds } = drawerLayout;
  if (footerMode === 'none') {
    return {
      layout: drawerLayout,
      listBounds: scrollMax > 0 ? listBounds : null,
      itemBounds,
      closeBounds: null,
      exitBounds: null,
      scroll: nextScroll,
      scrollMax,
      columns,
      visibleRows,
      visibleCapacity
    };
  }
  if (footerMode === 'exit-only') {
    const footerButtonH = buttonHeight ?? Math.max(18, rowHeight);
    const exitY = panel.y + panel.h - drawerLayout.footerBottomPadding - footerButtonH;
    exitBounds = { x: drawerLayout.listX, y: exitY, w: drawerLayout.listW, h: footerButtonH, id: drawerLayout.exitBounds.id };
    drawButton(exitBounds, footerItem || { id: exitBounds.id, label: SHARED_EDITOR_LEFT_MENU.exitLabel, footer: true });
    return {
      layout: drawerLayout,
      listBounds: scrollMax > 0 ? listBounds : null,
      itemBounds,
      closeBounds: null,
      exitBounds,
      scroll: nextScroll,
      scrollMax,
      columns,
      visibleRows,
      visibleCapacity
    };
  }
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
    scrollMax,
    columns,
    visibleRows,
    visibleCapacity
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
const STANDARD_FILE_ORDER = ['new', 'save', 'save-as', 'open', 'export', 'import'];


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
    onClick: actions[id] || null,
    action: actions[id] || null
  }));

  return [...entries, ...extras];
}

function normalizeSharedMenuEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  if (entry.divider || entry.separator) return { ...entry };
  const callback = entry.onClick || entry.action || null;
  return {
    ...entry,
    onClick: callback,
    action: callback
  };
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
  const entries = buildStandardFileMenu({ supported, labels, tooltips, actions }).map(normalizeSharedMenuEntry);
  const normalizedExtras = extras.map(normalizeSharedMenuEntry);
  if (!includeFooter) return [...entries, ...normalizedExtras];
  const footerEntries = buildMainMenuFooterEntries(footer).map((entry) => ({
    id: entry.id,
    label: entry.label,
    tooltip: entry.tooltip,
    onClick: entry.onClick,
    action: entry.onClick
  }));
  return [...entries, ...normalizedExtras, { divider: true }, ...footerEntries];
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
  if (value.endsWith('.wav')) return 'WAV';
  return 'File';
}

const MENU_LABEL_ACRONYMS = new Set(['JSON', 'MIDI', 'SFX', 'WAV', 'ZIP', 'PNG', 'GIF', 'GM', 'QA', 'UI']);

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
