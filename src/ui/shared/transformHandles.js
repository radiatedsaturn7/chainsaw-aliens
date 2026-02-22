export function buildTransformHandleMeta({ x, y, w, h, rotationDeg = 0, orbOffset = 24 }) {
  const width = Math.max(1, Number.isFinite(w) ? w : 1);
  const height = Math.max(1, Number.isFinite(h) ? h : 1);
  const centerX = (Number.isFinite(x) ? x : 0) + width * 0.5;
  const centerY = (Number.isFinite(y) ? y : 0) + height * 0.5;
  const rad = rotationDeg * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toWorld = (lx, ly) => ({
    x: centerX + lx * cos - ly * sin,
    y: centerY + lx * sin + ly * cos
  });
  const handles = [
    { key: 'nw', localX: -width * 0.5, localY: -height * 0.5 },
    { key: 'n', localX: 0, localY: -height * 0.5 },
    { key: 'ne', localX: width * 0.5, localY: -height * 0.5 },
    { key: 'e', localX: width * 0.5, localY: 0 },
    { key: 'se', localX: width * 0.5, localY: height * 0.5 },
    { key: 's', localX: 0, localY: height * 0.5 },
    { key: 'sw', localX: -width * 0.5, localY: height * 0.5 },
    { key: 'w', localX: -width * 0.5, localY: 0 }
  ].map((entry) => ({ ...entry, ...toWorld(entry.localX, entry.localY) }));
  const rotateOrb = toWorld(0, -height * 0.5 - orbOffset);
  return { centerX, centerY, handles, rotateOrb, rotationDeg, width, height };
}

export function hitTestTransformHandles({ point, meta, radius }) {
  if (!point || !meta) return null;
  const hitRadius = Math.max(0.0001, Number.isFinite(radius) ? radius : 1);
  for (const handle of meta.handles || []) {
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= hitRadius) {
      return { type: 'scale', handle, meta };
    }
  }
  if (meta.rotateOrb && Math.hypot(point.x - meta.rotateOrb.x, point.y - meta.rotateOrb.y) <= hitRadius * 1.2) {
    return { type: 'rotate', meta };
  }
  return null;
}
