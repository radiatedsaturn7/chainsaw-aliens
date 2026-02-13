const STICK_DIRECTION_LABELS = { 1: 'N', 2: 'NE', 3: 'E', 4: 'SE', 5: 'S', 6: 'SW', 7: 'W', 8: 'NW' };
const STICK_DIRECTION_ICONS = { 1: '↑', 2: '↗', 3: '→', 4: '↘', 5: '↓', 6: '↙', 7: '←', 8: '↖' };

export const getStickDirectionLabel = (degree) => STICK_DIRECTION_LABELS[degree] || `${degree ?? ''}`;
export const getStickDirectionIcon = (degree) => STICK_DIRECTION_ICONS[degree] || `${degree ?? ''}`;
