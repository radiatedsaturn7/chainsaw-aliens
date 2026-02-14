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
    railWidthMobile: 72,
    panelWidthMobile: 292,
    leftMenuWidthDesktop: 292
  },
  font: {
    family: 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    size: 12
  }
};

export const SHARED_EDITOR_LEFT_MENU = {
  width: () => UI_SUITE.layout.leftMenuWidthDesktop,
  fileLabel: 'FILE',
  closeLabel: 'Close Menu',
  exitLabel: 'Exit to Main Menu'
};

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
