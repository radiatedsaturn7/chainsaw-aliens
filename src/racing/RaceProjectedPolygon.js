// Canvas consumes coordinates synchronously. Keep validation, culling and area
// calculations scalar rather than allocating sanitized vertices and map/filter
// arrays for every car wheel/body polygon and road overlay.
function paintPolygon(ctx, bounds, points, vehicle, fillStyle) {
  if (!Array.isArray(points) || points.length < 3) return false;
  const bottom = Number(bounds.y || 0) + Number(bounds.h || 0) + 2;
  const top = Number(bounds.y || 0) - Number(bounds.h || 0) * 0.35;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let clippedCount = 0, visible = false, area = 0;
  let firstX = 0, firstY = 0, previousX = 0, previousY = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const x = Number(point?.screenX);
    const y = vehicle ? Number(point?.screenY) : Math.max(top, Math.min(bottom, Number(point?.screenY)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (point?.clippedToNearPlane) clippedCount++;
    if (point?.visible || point?.clippedToNearPlane) visible = true;
    if (i === 0) { firstX = x; firstY = y; }
    else area += previousX * y - x * previousY;
    previousX = x; previousY = y;
  }
  if (!visible) return false;
  if (vehicle) {
    if (maxX < Number(bounds.x || 0) - Number(bounds.w || 0) * 0.5
      || minX > Number(bounds.x || 0) + Number(bounds.w || 0) * 1.5
      || maxY < Number(bounds.y || 0) - Number(bounds.h || 0) * 0.5
      || minY > Number(bounds.y || 0) + Number(bounds.h || 0) * 1.9) return false;
  } else {
    const xSpan = maxX - minX, ySpan = maxY - minY;
    if (clippedCount >= 2 && ySpan < Math.max(3, Number(bounds.h || 1) * 0.018)
      && xSpan > Number(bounds.w || 1) * 0.32) return false;
    if (clippedCount >= 2 && xSpan > Number(bounds.w || 1) * 1.75
      && ySpan > Number(bounds.h || 1) * 0.72) return false;
  }
  area += previousX * firstY - firstX * previousY;
  if (Math.abs(area) < 0.7) return false;
  if (vehicle) {
    ctx.fillStyle = fillStyle || '#58d6ff';
    ctx.beginPath();
  }
  ctx.moveTo(firstX, firstY);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    ctx.lineTo(Number(point.screenX), vehicle ? Number(point.screenY)
      : Math.max(top, Math.min(bottom, Number(point.screenY))));
  }
  ctx.closePath();
  if (vehicle) ctx.fill();
  return true;
}
export function appendRaceProjectedQuadPath(ctx, bounds, points) {
  return paintPolygon(ctx, bounds, points, false);
}
export function drawRaceProjectedVehicleQuad(ctx, bounds, points, fillStyle = '#58d6ff') {
  return paintPolygon(ctx, bounds, points, true, fillStyle);
}
