export const radialIndexFromStick = (x, y, count) => {
  if (!count) return 0;
  const angle = Math.atan2(y, x);
  const normalized = (angle + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
  const slice = (Math.PI * 2) / count;
  return Math.round(normalized / slice) % count;
};
