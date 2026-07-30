export const TRACK_STATE_PRECISION = 1e6;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function quantizeTrackStateNumber(value = 0, precision = TRACK_STATE_PRECISION) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * precision) / precision;
}

export function getTrackStateCellCoordinates(point = {}, cellSizeM = 1) {
  const size = Math.max(0.001, Number(cellSizeM) || 1);
  return {
    x: Math.floor(Number(point.x || 0) / size),
    z: Math.floor(Number(point.z ?? point.y ?? 0) / size)
  };
}

export function getTrackStateCellKey(x = 0, z = 0) {
  if (typeof x === 'object') return `${Math.trunc(Number(x.x) || 0)},${Math.trunc(Number(x.z) || 0)}`;
  return `${Math.trunc(Number(x) || 0)},${Math.trunc(Number(z) || 0)}`;
}

export function parseTrackStateCellKey(key = '0,0') {
  const [x, z] = String(key).split(',').map((value) => Math.trunc(Number(value) || 0));
  return { x, z };
}

export function getTrackStateCellCenter(coords = {}, cellSizeM = 1) {
  const size = Math.max(0.001, Number(cellSizeM) || 1);
  return {
    x: (Math.trunc(Number(coords.x) || 0) + 0.5) * size,
    z: (Math.trunc(Number(coords.z) || 0) + 0.5) * size
  };
}

export function compareTrackStateCellKeys(left = '', right = '') {
  const a = parseTrackStateCellKey(left);
  const b = parseTrackStateCellKey(right);
  return a.x - b.x || a.z - b.z;
}

export function traceTrackStateCells(from = {}, to = from, cellSizeM = 1) {
  const start = getTrackStateCellCoordinates(from, cellSizeM);
  const end = getTrackStateCellCoordinates(to, cellSizeM);
  const cells = [{ ...start, key: getTrackStateCellKey(start) }];
  if (start.x === end.x && start.z === end.z) return cells;

  const size = Math.max(0.001, Number(cellSizeM) || 1);
  const x0 = Number(from.x || 0) / size;
  const z0 = Number(from.z ?? from.y ?? 0) / size;
  const x1 = Number(to.x || 0) / size;
  const z1 = Number(to.z ?? to.y ?? 0) / size;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const stepX = Math.sign(dx);
  const stepZ = Math.sign(dz);
  const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
  const tDeltaZ = stepZ ? Math.abs(1 / dz) : Infinity;
  let cellX = start.x;
  let cellZ = start.z;
  let tMaxX = stepX > 0
    ? ((cellX + 1) - x0) / dx
    : stepX < 0
      ? (cellX - x0) / dx
      : Infinity;
  let tMaxZ = stepZ > 0
    ? ((cellZ + 1) - z0) / dz
    : stepZ < 0
      ? (cellZ - z0) / dz
      : Infinity;
  const maxCells = Math.abs(end.x - start.x) + Math.abs(end.z - start.z) + 4;
  while ((cellX !== end.x || cellZ !== end.z) && cells.length < maxCells) {
    if (tMaxX <= tMaxZ) {
      cellX += stepX;
      tMaxX += tDeltaX;
    } else {
      cellZ += stepZ;
      tMaxZ += tDeltaZ;
    }
    cells.push({ x: cellX, z: cellZ, key: getTrackStateCellKey(cellX, cellZ) });
  }
  return cells;
}

function canonicalize(value) {
  if (typeof value === 'number') return quantizeTrackStateNumber(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function stableTrackStateStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashTrackStateValue(value) {
  const source = typeof value === 'string' ? value : stableTrackStateStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    if (code > 0xff) {
      hash ^= code >>> 8;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}
