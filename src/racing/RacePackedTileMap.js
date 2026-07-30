const PACKED_RACE_TILE_MAP_VERSION = 1;

function cleanString(value = '') {
  return String(value || '').trim();
}

function getCellCoordinates(key = '') {
  const separator = String(key).indexOf(',');
  if (separator < 0) return null;
  const cellX = Number(String(key).slice(0, separator));
  const cellY = Number(String(key).slice(separator + 1));
  if (!Number.isInteger(cellX) || !Number.isInteger(cellY)) return null;
  if (cellX < -2147483648 || cellX > 2147483647
    || cellY < -2147483648 || cellY > 2147483647) return null;
  return { cellX, cellY };
}

function normalizeWeights(cell = {}, fallbackTileId = 'grass') {
  const requestedTileId = cleanString(cell.tileId) || fallbackTileId;
  const source = cell.tileWeights
    && typeof cell.tileWeights === 'object'
    && !Array.isArray(cell.tileWeights)
    ? cell.tileWeights
    : { [requestedTileId]: 1 };
  const weights = Object.entries(source)
    .map(([tileId, weight]) => [cleanString(tileId), Math.max(0, Number(weight) || 0)])
    .filter(([tileId, weight]) => tileId && weight > 0.0005);
  const total = weights.reduce((sum, entry) => sum + entry[1], 0);
  if (!(total > 0)) return [[requestedTileId, 1]];
  return weights
    .map(([tileId, weight]) => [tileId, weight / total])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function findPackedCellIndex(packed = null, cellX = 0, cellY = 0) {
  if (!isPackedRaceTileMap(packed)) return -1;
  const x = Math.trunc(Number(cellX) || 0);
  const y = Math.trunc(Number(cellY) || 0);
  let low = 0;
  let high = packed.count - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const middleY = packed.cellY[middle];
    const middleX = packed.cellX[middle];
    if (middleY < y || (middleY === y && middleX < x)) {
      low = middle + 1;
    } else if (middleY > y || (middleY === y && middleX > x)) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  return -1;
}

function decodeWeightPattern(packed, patternIndex) {
  if (!packed._decodedWeightPatterns) {
    Object.defineProperty(packed, '_decodedWeightPatterns', {
      configurable: true,
      enumerable: false,
      value: new Map()
    });
  }
  const cached = packed._decodedWeightPatterns.get(patternIndex);
  if (cached) return cached;
  const start = packed.weightPatternOffsets[patternIndex] || 0;
  const end = packed.weightPatternOffsets[patternIndex + 1] || start;
  const weights = {};
  for (let index = start; index < end; index += 1) {
    const tileId = packed.tileIds[packed.weightTileIndices[index]];
    if (tileId) weights[tileId] = packed.weightValues[index];
  }
  const decoded = Object.freeze(weights);
  packed._decodedWeightPatterns.set(patternIndex, decoded);
  return decoded;
}

export function isPackedRaceTileMap(packed = null) {
  return Boolean(
    packed
    && packed.packed === true
    && packed.version === PACKED_RACE_TILE_MAP_VERSION
    && Number.isInteger(packed.count)
    && packed.count >= 0
    && packed.cellX instanceof Int32Array
    && packed.cellY instanceof Int32Array
    && packed.elevations instanceof Float64Array
    && packed.tileIndices instanceof Uint32Array
    && packed.artIndices instanceof Uint32Array
    && packed.weightPatternIndices instanceof Uint32Array
    && packed.weightPatternOffsets instanceof Uint32Array
    && packed.weightTileIndices instanceof Uint32Array
    && packed.weightValues instanceof Float64Array
    && packed.cellX.length === packed.count
    && packed.cellY.length === packed.count
    && packed.elevations.length === packed.count
    && packed.tileIndices.length === packed.count
    && packed.artIndices.length === packed.count
    && packed.weightPatternIndices.length === packed.count
  );
}

export function packRaceTileMapForRuntime(tileMap = {}) {
  const defaultTileId = cleanString(tileMap.defaultTileId) || 'grass';
  const entries = Object.entries(
    tileMap.cells && typeof tileMap.cells === 'object' && !Array.isArray(tileMap.cells)
      ? tileMap.cells
      : {}
  )
    .map(([key, cell]) => {
      const coordinates = getCellCoordinates(key);
      return coordinates && cell && typeof cell === 'object'
        ? { ...coordinates, cell }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.cellY - b.cellY || a.cellX - b.cellX);

  const tileIds = [];
  const tileIdIndexes = new Map();
  const getTileIndex = (tileId) => {
    const clean = cleanString(tileId) || defaultTileId;
    if (!tileIdIndexes.has(clean)) {
      tileIdIndexes.set(clean, tileIds.length);
      tileIds.push(clean);
    }
    return tileIdIndexes.get(clean);
  };
  getTileIndex(defaultTileId);

  const artRefs = [''];
  const artRefIndexes = new Map([['', 0]]);
  const getArtIndex = (artRef) => {
    const clean = cleanString(artRef);
    if (!artRefIndexes.has(clean)) {
      artRefIndexes.set(clean, artRefs.length);
      artRefs.push(clean);
    }
    return artRefIndexes.get(clean);
  };

  const weightPatterns = [];
  const weightPatternIndexes = new Map();
  const getWeightPatternIndex = (cell) => {
    const normalized = normalizeWeights(cell, defaultTileId);
    const indexed = normalized.map(([tileId, weight]) => [getTileIndex(tileId), weight]);
    const key = indexed.map(([tileIndex, weight]) => `${tileIndex}:${weight}`).join('|');
    if (!weightPatternIndexes.has(key)) {
      weightPatternIndexes.set(key, weightPatterns.length);
      weightPatterns.push(indexed);
    }
    return weightPatternIndexes.get(key);
  };

  const count = entries.length;
  const cellX = new Int32Array(count);
  const cellY = new Int32Array(count);
  const elevations = new Float64Array(count);
  const tileIndices = new Uint32Array(count);
  const artIndices = new Uint32Array(count);
  const weightPatternIndices = new Uint32Array(count);
  const artRefCounts = new Map();

  entries.forEach((entry, index) => {
    const tileId = cleanString(entry.cell.tileId) || defaultTileId;
    const artRef = cleanString(entry.cell.artRef || entry.cell.tileArtRef);
    cellX[index] = entry.cellX;
    cellY[index] = entry.cellY;
    elevations[index] = Number(entry.cell.elevation) || 0;
    tileIndices[index] = getTileIndex(tileId);
    artIndices[index] = getArtIndex(artRef);
    weightPatternIndices[index] = getWeightPatternIndex(entry.cell);
    if (artRef) artRefCounts.set(artRef, (artRefCounts.get(artRef) || 0) + 1);
  });

  const weightEntryCount = weightPatterns.reduce((sum, pattern) => sum + pattern.length, 0);
  const weightPatternOffsets = new Uint32Array(weightPatterns.length + 1);
  const weightTileIndices = new Uint32Array(weightEntryCount);
  const weightValues = new Float64Array(weightEntryCount);
  let weightOffset = 0;
  weightPatterns.forEach((pattern, patternIndex) => {
    weightPatternOffsets[patternIndex] = weightOffset;
    pattern.forEach(([tileIndex, weight]) => {
      weightTileIndices[weightOffset] = tileIndex;
      weightValues[weightOffset] = weight;
      weightOffset += 1;
    });
  });
  weightPatternOffsets[weightPatterns.length] = weightOffset;

  const dominantArtRef = [...artRefCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
  return {
    packed: true,
    version: PACKED_RACE_TILE_MAP_VERSION,
    count,
    defaultTileId,
    cellSizeM: Math.max(1, Number(tileMap.cellSizeM) || 5),
    cellX,
    cellY,
    elevations,
    tileIndices,
    artIndices,
    weightPatternIndices,
    tileIds,
    artRefs,
    weightPatternOffsets,
    weightTileIndices,
    weightValues,
    stats: {
      cellCount: count,
      dominantArtRef,
      hasPaintedTerrainCells: count > 0,
      artRefCounts: [...artRefCounts.entries()]
    }
  };
}

export function samplePackedRaceTileMapCell(packed = null, cellX = 0, cellY = 0) {
  const index = findPackedCellIndex(packed, cellX, cellY);
  if (index < 0) return null;
  const tileId = packed.tileIds[packed.tileIndices[index]] || packed.defaultTileId || 'grass';
  return {
    tileId,
    tileWeights: decodeWeightPattern(packed, packed.weightPatternIndices[index]),
    artRef: packed.artRefs[packed.artIndices[index]] || '',
    elevation: packed.elevations[index],
    source: 'runtime-packed',
    tileLabel: null,
    explicit: true
  };
}

export function getPackedRaceTileMapStats(packed = null) {
  if (!isPackedRaceTileMap(packed)) {
    return { dominantArtRef: '', hasPaintedTerrainCells: false, cellCount: 0, artRefCounts: [] };
  }
  return {
    dominantArtRef: cleanString(packed.stats?.dominantArtRef),
    hasPaintedTerrainCells: packed.stats?.hasPaintedTerrainCells === true || packed.count > 0,
    cellCount: packed.count,
    artRefCounts: Array.isArray(packed.stats?.artRefCounts) ? packed.stats.artRefCounts : []
  };
}

export function getPackedRaceTileMapArtRefs(packed = null) {
  if (!isPackedRaceTileMap(packed)) return [];
  return packed.artRefs.filter(Boolean);
}

export function getPackedRaceTileMapTransferables(packed = null) {
  if (!isPackedRaceTileMap(packed)) return [];
  return [...new Set([
    packed.cellX.buffer,
    packed.cellY.buffer,
    packed.elevations.buffer,
    packed.tileIndices.buffer,
    packed.artIndices.buffer,
    packed.weightPatternIndices.buffer,
    packed.weightPatternOffsets.buffer,
    packed.weightTileIndices.buffer,
    packed.weightValues.buffer
  ])];
}

export function forEachPackedRaceTileMapCell(packed = null, callback = () => {}) {
  if (!isPackedRaceTileMap(packed) || typeof callback !== 'function') return;
  for (let index = 0; index < packed.count; index += 1) {
    const tileId = packed.tileIds[packed.tileIndices[index]] || packed.defaultTileId || 'grass';
    callback({
      tileId,
      tileWeights: decodeWeightPattern(packed, packed.weightPatternIndices[index]),
      artRef: packed.artRefs[packed.artIndices[index]] || '',
      elevation: packed.elevations[index],
      source: 'runtime-packed',
      tileLabel: null,
      explicit: true
    }, {
      cellX: packed.cellX[index],
      cellY: packed.cellY[index],
      index
    });
  }
}
