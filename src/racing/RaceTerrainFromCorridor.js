const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(Number(value) || 0, 0, 1);
  return t * t * (3 - 2 * t);
};

const pointZ = (point = {}) => Number(point.z ?? point.y ?? 0);
const distance2d = (a = {}, b = {}) => Math.hypot(Number(a.x || 0) - Number(b.x || 0), pointZ(a) - pointZ(b));
const signedArea = (points = []) => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += Number(a.x || 0) * pointZ(b) - Number(b.x || 0) * pointZ(a);
  }
  return area * 0.5;
};

const isFinitePoint = (point = {}) => Number.isFinite(Number(point.x))
  && Number.isFinite(pointZ(point))
  && Number.isFinite(Number(point.elevation));

function getSectionDistance(section = {}) {
  return Number(section.center?.routeDistance ?? section.center?.distance ?? section.deck?.distance ?? 0) || 0;
}

function normalizeSectionList(sections = [], { runtimeType = 'destination' } = {}) {
  const source = Array.isArray(sections) ? sections.filter((section) => section?.center && section?.metrics) : [];
  const sorted = [...source].sort((a, b) => getSectionDistance(a) - getSectionDistance(b));
  const result = [];
  let previous = null;
  sorted.forEach((section, index) => {
    if (!previous) {
      result.push(section);
      previous = section;
      return;
    }
    const prevCenter = previous.center || {};
    const center = section.center || {};
    const metrics = section.metrics || {};
    const prevMetrics = previous.metrics || {};
    const headingDelta = Math.abs(Math.atan2(
      Math.sin(Number(center.yaw || 0) - Number(prevCenter.yaw || 0)),
      Math.cos(Number(center.yaw || 0) - Number(prevCenter.yaw || 0))
    ));
    const elevationDelta = Math.abs(Number(center.elevation || 0) - Number(prevCenter.elevation || 0));
    const widthDelta = Math.max(
      Math.abs(Number(metrics.roadEnd || 0) - Number(prevMetrics.roadEnd || 0)),
      Math.abs(Number(metrics.marginEnd || 0) - Number(prevMetrics.marginEnd || 0)),
      Math.abs(Number(metrics.shoulderEnd || 0) - Number(prevMetrics.shoulderEnd || 0)),
      Math.abs(Number(metrics.leftTransitionEnd || metrics.transitionEnd || 0) - Number(prevMetrics.leftTransitionEnd || prevMetrics.transitionEnd || 0)),
      Math.abs(Number(metrics.rightTransitionEnd || metrics.transitionEnd || 0) - Number(prevMetrics.rightTransitionEnd || prevMetrics.transitionEnd || 0))
    );
    const sectionDistance = Math.abs(getSectionDistance(section) - getSectionDistance(previous));
    const lateralDisplacement = distance2d(center, prevCenter);
    const mustKeep = index === sorted.length - 1
      || headingDelta > 0.045
      || elevationDelta > 0.035
      || widthDelta > 0.25
      || sectionDistance >= 10
      || lateralDisplacement >= 10;
    if (mustKeep) {
      result.push(section);
      previous = section;
    }
  });
  if (runtimeType === 'circuit' && result.length > 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if (distance2d(first.center, last.center) < 0.001) result.pop();
  }
  return result;
}

function getCanonicalSectionList(sections = [], { runtimeType = 'destination' } = {}) {
  const sorted = (Array.isArray(sections) ? sections : [])
    .filter((section) => section?.center && section?.metrics)
    .sort((a, b) => getSectionDistance(a) - getSectionDistance(b));
  if (runtimeType === 'circuit' && sorted.length > 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (distance2d(first.center, last.center) < 0.001) return sorted.slice(0, -1);
  }
  return sorted;
}

function getSectionDeckElevationAtLateral(section = {}, lateral = 0) {
  const centerElevation = Number(section.center?.elevation ?? section.deck?.elevation ?? 0) || 0;
  const numericLateral = Number(lateral || 0);
  if (Math.abs(numericLateral) < 0.0001) return centerElevation;
  const rightLateral = Number(section.right?.lateralOffset);
  const rightElevation = Number(section.right?.elevation);
  if (Number.isFinite(rightLateral) && Math.abs(rightLateral) > 0.0001 && Number.isFinite(rightElevation)) {
    return centerElevation + ((rightElevation - centerElevation) / rightLateral) * numericLateral;
  }
  const leftLateral = Number(section.left?.lateralOffset);
  const leftElevation = Number(section.left?.elevation);
  if (Number.isFinite(leftLateral) && Math.abs(leftLateral) > 0.0001 && Number.isFinite(leftElevation)) {
    return centerElevation + ((leftElevation - centerElevation) / leftLateral) * numericLateral;
  }
  return centerElevation;
}

function makeRailPoint(section = {}, side = 'left', lateralAbs = 0, {
  region = 'terrain',
  blend = 1,
  deckElevation = null,
  adapter = {}
} = {}) {
  const center = section.center || {};
  const metrics = section.metrics || {};
  const sign = side === 'left' ? -1 : 1;
  const lateral = sign * Math.max(0, Number(lateralAbs) || 0);
  const right = center.right || adapter.getRightVector?.(Number(center.yaw || 0)) || { x: Math.cos(Number(center.yaw || 0)), z: Math.sin(Number(center.yaw || 0)) };
  const x = Number(center.x || 0) + Number(right.x || 0) * lateral;
  const z = Number(center.z ?? center.y ?? 0) + Number(right.z || 0) * lateral;
  const deck = Number.isFinite(Number(deckElevation)) ? Number(deckElevation) : Number(center.elevation || 0);
  const raw = adapter.sampleRawTerrain?.({ x, z }, deck) || { elevation: deck, tile: null, materialId: 'grass', surfaceId: 'grass' };
  const flatJoinStart = Math.max(0, Number(metrics.shoulderEnd || 0));
  const hardCorridorEnd = Math.max(Number(metrics.roadEnd || 0), Number(metrics.marginEnd || metrics.roadEnd || 0));
  const sideTransitionEnd = side === 'left'
    ? Number(metrics.leftTransitionEnd || metrics.transitionEnd || flatJoinStart)
    : Number(metrics.rightTransitionEnd || metrics.transitionEnd || flatJoinStart);
  let elevation = Number(raw.elevation || 0);
  let roadDeckElevation = false;
  if (region === 'shoulder' || region === 'flat-join') {
    elevation = deck;
    roadDeckElevation = true;
  } else if (region === 'transition') {
    const denominator = Math.max(0.001, sideTransitionEnd - flatJoinStart);
    const t = smoothstep((Math.max(0, Number(lateralAbs) || 0) - flatJoinStart) / denominator);
    elevation = deck * (1 - t) + Number(raw.elevation || deck) * t;
  }
  return {
    x,
    z,
    y: z,
    elevation: adapter.clampElevation?.(elevation) ?? elevation,
    lateralOffset: lateral,
    hardCorridorEnd,
    roadDistance: getSectionDistance(section),
    routeDistance: getSectionDistance(section),
    distance: getSectionDistance(section),
    edge: `terrain-${side}-${region}`,
    region,
    terrainRegion: region,
    terrainBlend: blend,
    roadDeckElevation,
    tile: raw.tile,
    tileCell: raw.tile,
    materialId: raw.materialId || raw.surfaceId,
    surfaceId: raw.surfaceId || raw.materialId,
    segment: center.segment || section.deck?.segment || null
  };
}

function getInnerBoundary(section = {}, side = 'left') {
  const metrics = section.metrics || {};
  const marginEnabled = Number(metrics.marginWidth || 0) > 0.0001;
  if (side === 'left') return marginEnabled ? (section.marginLeft || section.left) : section.left;
  return marginEnabled ? (section.marginRight || section.right) : section.right;
}

function buildSideRails(section = {}, side = 'left', { guardDistanceM = 720, adapter = {} } = {}) {
  const metrics = section.metrics || {};
  const inner = getInnerBoundary(section, side);
  if (!inner) return [];
  const sideSign = side === 'left' ? -1 : 1;
  const deckElevationAt = (lateralAbs) => getSectionDeckElevationAtLateral(section, sideSign * Math.max(0, Number(lateralAbs) || 0));
  const sideTransitionEnd = side === 'left'
    ? Number(metrics.leftTransitionEnd || metrics.transitionEnd || metrics.shoulderEnd || 0)
    : Number(metrics.rightTransitionEnd || metrics.transitionEnd || metrics.shoulderEnd || 0);
  const innerAbs = Math.abs(Number(inner.lateralOffset || 0));
  const hardCorridorEnd = innerAbs;
  const shoulderEnd = Math.max(innerAbs, Number(metrics.shoulderEnd || innerAbs));
  const flatJoinEnd = Math.max(shoulderEnd, Number(metrics.flatJoinEnd || shoulderEnd));
  const transitionEnd = Math.max(flatJoinEnd, sideTransitionEnd);
  const transitionSpan = Math.max(0.001, transitionEnd - flatJoinEnd);
  const guardEnd = transitionEnd + Math.max(120, Number(guardDistanceM) || 720);
  const rawOffsets = [];
  rawOffsets.push(guardEnd);
  const rails = [{
    rail: 'inner',
    lateralAbs: innerAbs,
    point: {
      ...inner,
      x: Number(inner.x || 0),
      z: pointZ(inner),
      y: pointZ(inner),
      elevation: Number(inner.elevation ?? deckElevationAt(innerAbs)),
      terrainRegion: 'inner',
      roadDeckElevation: true,
      corridorBoundary: true,
      hardCorridorEnd
    }
  }];
  if (shoulderEnd > innerAbs + 0.0001) {
    rails.push({
      rail: 'shoulder',
      lateralAbs: shoulderEnd,
      point: makeRailPoint(section, side, shoulderEnd, {
        region: 'shoulder',
        blend: 0,
        deckElevation: deckElevationAt(shoulderEnd),
        adapter
      })
    });
  }
  if (flatJoinEnd > shoulderEnd + 0.0001) {
    rails.push({
      rail: 'flat-join',
      lateralAbs: flatJoinEnd,
      point: makeRailPoint(section, side, flatJoinEnd, {
        region: 'flat-join',
        blend: 0,
        deckElevation: deckElevationAt(flatJoinEnd),
        adapter
      })
    });
  }
  [0.5].forEach((ratio) => {
    const lateralAbs = flatJoinEnd + transitionSpan * ratio;
    if (lateralAbs > flatJoinEnd + 0.0001 && lateralAbs < transitionEnd - 0.0001) {
      rails.push({
        rail: `transition-${ratio}`,
        lateralAbs,
        point: makeRailPoint(section, side, lateralAbs, {
          region: 'transition',
          blend: ratio,
          deckElevation: deckElevationAt(lateralAbs),
          adapter
        })
      });
    }
  });
  if (transitionEnd > flatJoinEnd + 0.0001) {
    rails.push({
      rail: 'transition-outer',
      lateralAbs: transitionEnd,
      point: makeRailPoint(section, side, transitionEnd, {
        region: 'transition',
        blend: 1,
        deckElevation: deckElevationAt(transitionEnd),
        adapter
      })
    });
  }
  rawOffsets.forEach((lateralAbs, index) => {
    rails.push({
      rail: `raw-${index}`,
      lateralAbs,
      point: makeRailPoint(section, side, lateralAbs, {
        region: 'terrain',
        blend: 1,
        deckElevation: deckElevationAt(lateralAbs),
        adapter
      })
    });
  });
  return rails.filter((rail, index, list) => {
    if (!isFinitePoint(rail.point)) return false;
    if (index === 0) return true;
    return Math.abs(Number(rail.lateralAbs || 0) - Number(list[index - 1]?.lateralAbs || 0)) > 0.0001;
  });
}

function makeTerrainCell(points = [], {
  key = '',
  groupKey = '',
  layer = 'base',
  side = '',
  rail = '',
  tileCell = null,
  roadAdjacent = true,
  adapter = {},
  validateIntrusion = true
} = {}) {
  if (!Array.isArray(points) || points.length < 3 || points.some((point) => !isFinitePoint(point))) return null;
  if (validateIntrusion && typeof adapter.sampleWorld === 'function') {
    const intrudes = points.some((point) => {
      if (point?.terrainRegion === 'inner') return false;
      const sample = adapter.sampleWorld(point, Number(point.elevation || 0));
      if (sample?.region !== 'road' && sample?.region !== 'margin') return false;
      const absLateral = Math.abs(Number(sample.projection?.lateral || 0));
      const limit = sample.region === 'margin'
        ? Number(sample.metrics?.marginEnd || 0)
        : Number(sample.metrics?.roadEnd || 0);
      return absLateral < limit - 0.001;
    });
    if (intrudes) return null;
  }
  const area = signedArea(points);
  if (Math.abs(area) <= 0.000001) return null;
  const oriented = area < 0 ? [...points].reverse() : points;
  const center = {
    x: oriented.reduce((sum, point) => sum + Number(point.x || 0), 0) / oriented.length,
    z: oriented.reduce((sum, point) => sum + pointZ(point), 0) / oriented.length
  };
  const cellTile = tileCell || oriented.find((point) => point.tileCell || point.tile)?.tileCell || oriented.find((point) => point.tile)?.tile || null;
  return {
    points: oriented,
    tileCell: cellTile,
    key,
    groupKey,
    terrainLayer: layer,
    terrainTopology: 'corridor-first',
    terrainSide: side,
    terrainRail: rail,
    roadAdjacent,
    nearRoad: roadAdjacent,
    roadDistance: 0,
    corridorDistance: 0,
    centerX: center.x,
    centerZ: center.z,
    clippedToTrackCorridor: false
  };
}

function buildRailCells(rows = [], side = 'left', { runtimeType = 'destination', adapter = {} } = {}) {
  const cells = [];
  let rejected = 0;
  if (rows.length < 2) return { cells, rejected };
  const pairCount = runtimeType === 'circuit' ? rows.length : rows.length - 1;
  for (let rowIndex = 0; rowIndex < pairCount; rowIndex += 1) {
    const current = rows[rowIndex];
    const next = rows[(rowIndex + 1) % rows.length];
    const railCount = Math.min(current.rails.length, next.rails.length);
    for (let railIndex = 0; railIndex < railCount - 1; railIndex += 1) {
      const a = current.rails[railIndex].point;
      const b = current.rails[railIndex + 1].point;
      const c = next.rails[railIndex + 1].point;
      const d = next.rails[railIndex].point;
      const cell = makeTerrainCell([a, b, c, d], {
        key: `corridor:${side}:${rowIndex}:${railIndex}`,
        groupKey: `corridor:${side}:${railIndex}`,
        layer: railIndex <= 4 ? 'base' : 'refinement',
        side,
        rail: current.rails[railIndex].rail,
        tileCell: b.tileCell || c.tileCell || a.tileCell || d.tileCell,
        roadAdjacent: railIndex <= 6,
        adapter,
        validateIntrusion: false
      });
      if (cell) cells.push(cell);
      else rejected += 1;
    }
  }
  return { cells, rejected };
}

function validateRoadsideBoundary(leftRows = [], rightRows = []) {
  let mismatchCount = 0;
  let maxError = 0;
  [...leftRows, ...rightRows].forEach((row) => {
    const inner = row.rails?.[0]?.point;
    const canonical = row.inner;
    if (!inner || !canonical) return;
    const error = Math.hypot(
      Number(inner.x || 0) - Number(canonical.x || 0),
      pointZ(inner) - pointZ(canonical),
      Number(inner.elevation || 0) - Number(canonical.elevation || 0)
    );
    if (error > 0.000001) mismatchCount += 1;
    if (error > maxError) maxError = error;
  });
  return { mismatchCount, maxError };
}

export function buildRaceTerrainFromCorridor({
  surfaceBake = null,
  runtimeType = 'destination',
  guardDistanceM = 720,
  adapter = {}
} = {}) {
  const canonicalSections = getCanonicalSectionList(surfaceBake?.sections || [], { runtimeType });
  const sections = canonicalSections.length ? canonicalSections : normalizeSectionList(surfaceBake?.sections || [], { runtimeType });
  if (sections.length < 2) {
    return {
      terrainCells: [],
      terrainBaseCells: [],
      terrainRefinementCells: [],
      stats: {
        terrainTopology: 'corridor-first',
        invalidBoundaryIntersections: 1,
        roadsideBoundaryMismatchCount: 0,
        roadsideBoundaryMaxErrorM: 0
      }
    };
  }
  const leftRows = sections.map((section, index) => ({
    section,
    index,
    inner: getInnerBoundary(section, 'left'),
    rails: buildSideRails(section, 'left', { guardDistanceM, adapter })
  })).filter((row) => row.rails.length >= 2);
  const rightRows = sections.map((section, index) => ({
    section,
    index,
    inner: getInnerBoundary(section, 'right'),
    rails: buildSideRails(section, 'right', { guardDistanceM, adapter })
  })).filter((row) => row.rails.length >= 2);
  const leftResult = buildRailCells(leftRows, 'left', { runtimeType, adapter });
  const rightResult = buildRailCells(rightRows, 'right', { runtimeType, adapter });
  const leftCells = leftResult.cells;
  const rightCells = rightResult.cells;
  const terrainCells = [...leftCells, ...rightCells];
  const terrainBaseCells = terrainCells.filter((cell) => cell.terrainLayer !== 'refinement');
  const terrainRefinementCells = terrainCells.filter((cell) => cell.terrainLayer === 'refinement');
  const boundary = validateRoadsideBoundary(leftRows, rightRows);
  return {
    terrainCells,
    terrainBaseCells,
    terrainRefinementCells,
    terrainChunks: [],
    leftRows,
    rightRows,
    stats: {
      terrainTopology: 'corridor-first',
      corridorSections: sections.length,
      canonicalSurfaceSections: canonicalSections.length,
      corridorLeftRows: leftRows.length,
      corridorRightRows: rightRows.length,
      terrainBaseTriangles: terrainBaseCells.length * 2,
      terrainRefinementTriangles: terrainRefinementCells.length * 2,
      terrainCoverageDropped: 0,
      terrainRefinementDropped: 0,
      roadsideBoundaryMismatchCount: boundary.mismatchCount,
      roadsideBoundaryMaxErrorM: boundary.maxError,
      invalidBoundaryIntersections: Number(leftResult.rejected || 0) + Number(rightResult.rejected || 0)
    }
  };
}

export default buildRaceTerrainFromCorridor;
