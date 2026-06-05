export const DISPLAY_MODES = Object.freeze({
  SEPIA: 'sepia',
  NIGHT_VISION: 'night-vision',
  COLOR: 'color'
});

export const DISPLAY_MODE_OPTIONS = Object.freeze([
  { id: DISPLAY_MODES.SEPIA, action: 'display-sepia', label: 'Display: Sepia' },
  { id: DISPLAY_MODES.NIGHT_VISION, action: 'display-night-vision', label: 'Display: Night Vision' },
  { id: DISPLAY_MODES.COLOR, action: 'display-color', label: 'Display: Color' }
]);

export const DEFAULT_DISPLAY_MODE = DISPLAY_MODES.SEPIA;

const ACTION_TO_MODE = new Map(DISPLAY_MODE_OPTIONS.map((option) => [option.action, option.id]));
const VALID_MODES = new Set(Object.values(DISPLAY_MODES));

export function normalizeDisplayMode(mode) {
  return VALID_MODES.has(mode) ? mode : DEFAULT_DISPLAY_MODE;
}

export function getDisplayModeForAction(action) {
  return ACTION_TO_MODE.get(action) || null;
}

export function getDisplayActionForMode(mode) {
  const normalized = normalizeDisplayMode(mode);
  return DISPLAY_MODE_OPTIONS.find((option) => option.id === normalized)?.action || DISPLAY_MODE_OPTIONS[0].action;
}

export function getDisplayModeLabelForAction(action) {
  return DISPLAY_MODE_OPTIONS.find((option) => option.action === action)?.label || '';
}
