// Pre-optimization canvas painters, retained for exact command parity tests.
// Source: RaceEditor.js at ddb4ad8aaf823cfee894f9aa1b4ec9c712eacece.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function appendRaceProjectedQuadPath(ctx, bounds, points = []) {
    if (!Array.isArray(points) || points.length < 3) return false;
    const bottom = Number(bounds.y || 0) + Number(bounds.h || 0) + 2;
    const top = Number(bounds.y || 0) - Number(bounds.h || 0) * 0.35;
    const sanitized = points.map((point) => ({
      x: Number(point?.screenX),
      y: clamp(Number(point?.screenY), top, bottom),
      cameraZ: Number(point?.cameraZ ?? point?.renderZ ?? 0),
      clippedToNearPlane: Boolean(point?.clippedToNearPlane),
      visible: Boolean(point?.visible || point?.clippedToNearPlane)
    }));
    if (sanitized.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    if (!sanitized.some((point) => point.visible)) return false;
    const clippedCount = sanitized.filter((point) => point.clippedToNearPlane).length;
    const ySpan = Math.max(...sanitized.map((point) => point.y)) - Math.min(...sanitized.map((point) => point.y));
    const xSpan = Math.max(...sanitized.map((point) => point.x)) - Math.min(...sanitized.map((point) => point.x));
    if (clippedCount >= 2 && ySpan < Math.max(3, Number(bounds.h || 1) * 0.018) && xSpan > Number(bounds.w || 1) * 0.32) return false;
    const hugeNearCameraPlane = clippedCount >= 2
      && xSpan > Number(bounds.w || 1) * 1.75
      && ySpan > Number(bounds.h || 1) * 0.72;
    if (hugeNearCameraPlane) return false;
    let area = 0;
    for (let index = 0; index < sanitized.length; index += 1) {
      const current = sanitized[index];
      const next = sanitized[(index + 1) % sanitized.length];
      area += current.x * next.y - next.x * current.y;
    }
    if (Math.abs(area) < 0.7) return false;
    ctx.moveTo(sanitized[0].x, sanitized[0].y);
    sanitized.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    return true;
  }

export function drawRaceProjectedVehicleQuad(ctx, bounds, points = [], fillStyle = '#58d6ff') {
    if (!Array.isArray(points) || points.length < 3) return false;
    const sanitized = points.map((point) => ({
      x: Number(point?.screenX),
      y: Number(point?.screenY),
      visible: Boolean(point?.visible || point?.clippedToNearPlane)
    }));
    if (sanitized.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    if (!sanitized.some((point) => point.visible)) return false;
    const minX = Math.min(...sanitized.map((point) => point.x));
    const maxX = Math.max(...sanitized.map((point) => point.x));
    const minY = Math.min(...sanitized.map((point) => point.y));
    const maxY = Math.max(...sanitized.map((point) => point.y));
    if (maxX < Number(bounds.x || 0) - Number(bounds.w || 0) * 0.5
      || minX > Number(bounds.x || 0) + Number(bounds.w || 0) * 1.5
      || maxY < Number(bounds.y || 0) - Number(bounds.h || 0) * 0.5
      || minY > Number(bounds.y || 0) + Number(bounds.h || 0) * 1.9) {
      return false;
    }
    let area = 0;
    for (let index = 0; index < sanitized.length; index += 1) {
      const current = sanitized[index];
      const next = sanitized[(index + 1) % sanitized.length];
      area += current.x * next.y - next.x * current.y;
    }
    if (Math.abs(area) < 0.7) return false;
    ctx.fillStyle = fillStyle || '#58d6ff';
    ctx.beginPath();
    ctx.moveTo(sanitized[0].x, sanitized[0].y);
    sanitized.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    return true;
  }

