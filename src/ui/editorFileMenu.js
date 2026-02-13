import { buildStandardFileMenu } from './uiSuite.js';

export const LEVEL_ROOM_PRESETS = [
  [1, 1], [2, 1], [3, 1], [4, 1],
  [1, 2], [1, 3], [1, 4],
  [2, 2], [3, 3], [4, 4]
];

export const PIXEL_SIZE_PRESETS = [16, 32, 64, 128, 256];
export const MIDI_NEW_SONG_TIME_SIGNATURE_OPTIONS = ['3/4', '4/4', '5/4', '6/4', '7/4'];

const DEFAULT_FILE_LABELS = {
  new: 'New',
  save: 'Save',
  'save-as': 'Save As',
  open: 'Open',
  export: 'Export',
  import: 'Import',
  undo: 'Undo',
  redo: 'Redo'
};

export function normalizeMenuItems(items = []) {
  return items.map((item) => {
    if (!item || item.divider) return { divider: true };
    const id = item.id || item.actionId || item.action || item.label;
    return {
      ...item,
      id,
      label: item.label || DEFAULT_FILE_LABELS[id] || String(id),
      onClick: item.onClick || item.action || null
    };
  });
}

export function buildEditorFileMenu({ labels = {}, actions = {}, extras = [], supported = {}, tooltips = {} } = {}) {
  const base = buildStandardFileMenu({
    labels: { ...DEFAULT_FILE_LABELS, ...labels },
    actions,
    supported,
    tooltips
  });
  return normalizeMenuItems([...base, ...extras]);
}

export async function openNewDocumentDialog(type, defaults = {}) {
  const fallbackName = defaults.name || `new-${type}-${Date.now()}`;
  const name = window.prompt('Document name?', fallbackName);
  if (name == null) return null;
  const trimmedName = name.trim() || fallbackName;

  if (type === 'level' || type === 'art') {
    const widthDefault = defaults.width ?? (type === 'level' ? 76 : 32);
    const heightDefault = defaults.height ?? (type === 'level' ? 36 : 32);
    const presetHint = type === 'level'
      ? 'Preset rooms: 1x1,2x1,3x1,4x1,1x2,1x3,1x4,2x2,3x3,4x4'
      : `Presets: ${PIXEL_SIZE_PRESETS.join(', ')}`;
    const size = window.prompt(`${presetHint}\nSize (WxH):`, `${widthDefault}x${heightDefault}`);
    if (size == null) return null;
    const lowered = String(size).toLowerCase().trim();
    const match = lowered.match(/(\d+)\s*[x,]\s*(\d+)/);
    if (!match) return null;
    let width = Number.parseInt(match[1], 10);
    let height = Number.parseInt(match[2], 10);
    if (type === 'level') {
      const preset = LEVEL_ROOM_PRESETS.find(([rw, rh]) => rw === width && rh === height);
      if (preset) {
        width *= 38;
        height *= 18;
      }
    }
    return {
      name: trimmedName,
      width,
      height
    };
  }

  if (type === 'midi') {
    const tempoRaw = window.prompt('Tempo (BPM):', String(defaults.tempo ?? 120));
    if (tempoRaw == null) return null;
    const timeSignature = window.prompt(
      `Time signature (${MIDI_NEW_SONG_TIME_SIGNATURE_OPTIONS.join(', ')}):`,
      defaults.timeSignature || '4/4'
    );
    if (timeSignature == null) return null;
    const keyRaw = window.prompt('Key (C, C#, D, ...):', defaults.key || 'C');
    if (keyRaw == null) return null;
    const scaleRaw = window.prompt('Scale (major/minor):', defaults.scale || 'major');
    if (scaleRaw == null) return null;
    const loopBarsRaw = window.prompt('Loop bars:', String(defaults.loopBars ?? 16));
    if (loopBarsRaw == null) return null;
    return {
      name: trimmedName,
      tempo: Number.parseInt(tempoRaw, 10),
      timeSignature: timeSignature.trim(),
      key: keyRaw.trim(),
      scale: scaleRaw.trim().toLowerCase(),
      loopBars: Number.parseInt(loopBarsRaw, 10)
    };
  }

  return { name: trimmedName };
}
