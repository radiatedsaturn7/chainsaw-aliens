import { buildEditorFileMenu } from './editorFileMenu.js';

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

export function buildStandardFileMenu(config = {}) {
  return buildEditorFileMenu(config);
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
