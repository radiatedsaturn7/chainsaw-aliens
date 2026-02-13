const BASE_FILE_IDS = ['new', 'save', 'save-as', 'open', 'export', 'import', 'undo', 'redo'];

export const ROOM_SIZE_PRESETS = [
  [1, 1], [2, 1], [3, 1], [4, 1],
  [1, 2], [1, 3], [1, 4],
  [2, 2], [3, 3], [4, 4]
];

export const PIXEL_SIZE_PRESETS = [16, 32, 64, 128, 256];
export const MIDI_TIME_SIGNATURE_OPTIONS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '12/8'];
export const MIDI_KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function defaultLabelForId(id) {
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

export function normalizeMenuItems(items = [], actions = {}) {
  return items.map((item) => {
    if (!item || item.divider) return { divider: true };
    const id = item.id || item.action;
    return {
      ...item,
      id,
      label: item.label || defaultLabelForId(id),
      onClick: item.onClick || item.action || actions[id] || null
    };
  });
}

export function buildEditorFileMenu(config = {}) {
  const {
    labels = {},
    supported = {},
    tooltips = {},
    actions = {},
    extras = []
  } = config;

  const baseItems = BASE_FILE_IDS.map((id) => ({
    id,
    label: labels[id] || defaultLabelForId(id),
    disabled: supported[id] === false,
    tooltip: tooltips[id] || (supported[id] === false ? 'Not available in this editor yet' : ''),
    onClick: actions[id] || null
  }));

  return normalizeMenuItems([...baseItems, ...extras], actions);
}

function promptText(message, fallback = '') {
  const value = window.prompt(message, String(fallback ?? ''));
  if (value == null) return null;
  return value.trim();
}

export async function openNewDocumentDialog(type, defaults = {}) {
  if (type === 'level' || type === 'art') {
    const fallbackName = defaults.name || `new-${type}-${Date.now()}`;
    const name = promptText(`${type === 'level' ? 'Level' : 'Art'} name:`, fallbackName);
    if (name == null) return null;
    const presets = type === 'level'
      ? ROOM_SIZE_PRESETS.map(([w, h], index) => `${index + 1}:${w}x${h}`)
      : PIXEL_SIZE_PRESETS.map((size, index) => `${index + 1}:${size}x${size}`);
    const rawSize = promptText(
      `Choose preset (${presets.join(', ')}) or enter custom WxH:`,
      defaults.width && defaults.height ? `${defaults.width}x${defaults.height}` : (type === 'level' ? '38x18' : '32x32')
    );
    if (rawSize == null) return null;
    const presetIndex = Number.parseInt(rawSize, 10) - 1;
    let width;
    let height;
    if (type === 'level' && Number.isInteger(presetIndex) && ROOM_SIZE_PRESETS[presetIndex]) {
      [width, height] = ROOM_SIZE_PRESETS[presetIndex];
      width *= defaults.roomBaseWidth || 38;
      height *= defaults.roomBaseHeight || 18;
    } else if (type === 'art' && Number.isInteger(presetIndex) && PIXEL_SIZE_PRESETS[presetIndex]) {
      width = PIXEL_SIZE_PRESETS[presetIndex];
      height = PIXEL_SIZE_PRESETS[presetIndex];
    } else {
      const match = rawSize.toLowerCase().match(/(\d+)\s*[x,]\s*(\d+)/);
      if (!match) return null;
      width = Number.parseInt(match[1], 10);
      height = Number.parseInt(match[2], 10);
    }
    const min = type === 'level' ? 24 : 8;
    const max = type === 'level' ? 512 : 512;
    return {
      name: name || fallbackName,
      width: Math.max(min, Math.min(max, Math.round(width))),
      height: Math.max(min, Math.min(max, Math.round(height)))
    };
  }

  if (type === 'midi') {
    const name = promptText('Song name:', defaults.name || `new-song-${Date.now()}`);
    if (name == null) return null;
    const tempoRaw = promptText('Tempo (40-240):', defaults.tempo || 120);
    if (tempoRaw == null) return null;
    const timeSignature = promptText(`Time signature (${MIDI_TIME_SIGNATURE_OPTIONS.join(', ')}):`, defaults.timeSignature || '4/4');
    if (timeSignature == null) return null;
    const key = promptText(`Key (${MIDI_KEY_LABELS.join(', ')}):`, defaults.key || 'C');
    if (key == null) return null;
    const scale = promptText('Scale (major/minor):', defaults.scale || 'major');
    if (scale == null) return null;
    const loopBarsRaw = promptText('Loop bars (1-128):', defaults.loopBars || 16);
    if (loopBarsRaw == null) return null;
    return {
      name,
      tempo: Math.max(40, Math.min(240, Number.parseInt(tempoRaw, 10) || 120)),
      timeSignature,
      key,
      scale: String(scale).toLowerCase() === 'minor' ? 'minor' : 'major',
      loopBars: Math.max(1, Math.min(128, Number.parseInt(loopBarsRaw, 10) || 16))
    };
  }

  return null;
}
