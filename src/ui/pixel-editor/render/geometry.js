export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export const bresenhamLine = (start, end) => {
  const points = [];
  let x0 = start.col;
  let y0 = start.row;
  const x1 = end.col;
  const y1 = end.row;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const generateEllipseMask = (width, height, bounds) => {
  const mask = new Uint8Array(width * height);
  const rx = bounds.w / 2;
  const ry = bounds.h / 2;
  const cx = bounds.x + rx;
  const cy = bounds.y + ry;
  for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
    for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
      const dx = (col + 0.5 - cx) / rx;
      const dy = (row + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        mask[row * width + col] = 1;
      }
    }
  }
  return mask;
};

export const createPolygonMask = (width, height, points) => {
  const mask = new Uint8Array(width * height);
  if (points.length < 3) return mask;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = clamp(Math.floor(Math.min(...xs)), 0, width - 1);
  const maxX = clamp(Math.ceil(Math.max(...xs)), 0, width - 1);
  const minY = clamp(Math.floor(Math.min(...ys)), 0, height - 1);
  const maxY = clamp(Math.ceil(Math.max(...ys)), 0, height - 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
};

export const createRectMask = (width, height, bounds) => {
  const mask = new Uint8Array(width * height);
  for (let row = bounds.y; row < bounds.y + bounds.h; row += 1) {
    for (let col = bounds.x; col < bounds.x + bounds.w; col += 1) {
      mask[row * width + col] = 1;
    }
  }
  return mask;
};

export const applySymmetryPoints = (points, width, height, symmetry) => {
  const output = new Map();
  points.forEach(({ row, col }) => {
    const candidates = [{ row, col }];
    if (symmetry.horizontal) candidates.push({ row, col: width - 1 - col });
    if (symmetry.vertical) candidates.push({ row: height - 1 - row, col });
    if (symmetry.horizontal && symmetry.vertical) {
      candidates.push({ row: height - 1 - row, col: width - 1 - col });
    }
    candidates.forEach((point) => output.set(`${point.row},${point.col}`, point));
  });
  return Array.from(output.values());
};
