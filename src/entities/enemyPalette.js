export const ENEMY_PALETTE = {
  body: '#d63a3a',
  flash: '#ff9a9a',
  accent: '#111111'
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const mixColors = (base, tint, amount) => {
  const mixAmount = clamp(amount, 0, 1);
  if (mixAmount <= 0) return base;
  const baseRgb = hexToRgb(base);
  const tintRgb = hexToRgb(tint);
  const r = Math.round(baseRgb.r + (tintRgb.r - baseRgb.r) * mixAmount);
  const g = Math.round(baseRgb.g + (tintRgb.g - baseRgb.g) * mixAmount);
  const b = Math.round(baseRgb.b + (tintRgb.b - baseRgb.b) * mixAmount);
  return `rgb(${r}, ${g}, ${b})`;
};

export const applyEnemyPalette = (ctx, flash, alpha = ctx.globalAlpha, tint = null) => {
  ctx.globalAlpha = alpha;
  const baseColor = flash ? ENEMY_PALETTE.flash : ENEMY_PALETTE.body;
  const tintAmount = tint?.amount ?? 0;
  const tintColor = tint?.color ?? '#ff79c6';
  ctx.fillStyle = tintAmount > 0 ? mixColors(baseColor, tintColor, tintAmount) : baseColor;
  ctx.strokeStyle = ENEMY_PALETTE.accent;
};
