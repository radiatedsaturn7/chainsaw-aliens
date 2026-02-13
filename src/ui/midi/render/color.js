export const toRgba = (hex, alpha) => {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(255,255,255,${alpha})`;
  }
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const value = parseInt(normalized.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};
