const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRaceTerrainTriangleArea(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const a = points[0];
  const b = points[1];
  const c = points[2];
  return Math.abs(
    (Number(b.x || 0) - Number(a.x || 0)) * (Number(c.z ?? c.y ?? 0) - Number(a.z ?? a.y ?? 0))
      - (Number(c.x || 0) - Number(a.x || 0)) * (Number(b.z ?? b.y ?? 0) - Number(a.z ?? a.y ?? 0))
  ) * 0.5;
}

export function triangulateRaceTerrainPolygon(polygon = []) {
  const clean = [];
  polygon.forEach((point) => {
    const previous = clean[clean.length - 1];
    if (previous && Math.hypot(
      Number(previous.x || 0) - Number(point.x || 0),
      Number(previous.z ?? previous.y ?? 0) - Number(point.z ?? point.y ?? 0)
    ) < 0.0001) return;
    clean.push(point);
  });
  if (clean.length > 2) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.hypot(
      Number(first.x || 0) - Number(last.x || 0),
      Number(first.z ?? first.y ?? 0) - Number(last.z ?? last.y ?? 0)
    ) < 0.0001) clean.pop();
  }
  if (clean.length < 3) return [];
  const triangles = [];
  for (let index = 1; index < clean.length - 1; index += 1) {
    const triangle = [clean[0], clean[index], clean[index + 1]];
    if (getRaceTerrainTriangleArea(triangle) > 0.000001) triangles.push(triangle);
  }
  return triangles;
}

export function clipRaceTerrainTriangleOutsideTrackCorridor(triangle = [], {
  runtimeType = 'destination',
  routeLength = 1,
  includeTransition = true,
  piecewise = true,
  maxPieceWorldM = 160,
  maxPieceDepth = 1,
  adapter = {}
} = {}) {
  if (!Array.isArray(triangle) || triangle.length < 3) return [];
  if (piecewise) {
    const split = splitRaceTerrainTriangleForLocalCorridor(triangle, {
      maxPieceWorldM,
      maxPieceDepth,
      runtimeType,
      routeLength,
      adapter
    });
    if (split.length > 1) {
      const retained = [];
      split.forEach((piece) => {
        clipRaceTerrainTriangleOutsideTrackCorridor(piece, {
          runtimeType,
          routeLength,
          includeTransition,
          piecewise: false,
          maxPieceWorldM,
          maxPieceDepth,
          adapter
        }).forEach((polygon) => retained.push(polygon));
      });
      return retained;
    }
  }
  const center = {
    x: triangle.reduce((sum, point) => sum + Number(point?.x || 0), 0) / triangle.length,
    z: triangle.reduce((sum, point) => sum + Number(point?.z ?? point?.y ?? 0), 0) / triangle.length
  };
  const projection = adapter.projectWorldToTrack?.(center);
  if (!projection?.segment || !Number.isFinite(Number(projection.distance)) || !Number.isFinite(Number(projection.lateral))) {
    return [triangle];
  }
  const visualRange = adapter.getVisualDistanceRange?.({ routeLength, runtimeType }) || {};
  const minVisualDistance = runtimeType === 'circuit'
    ? 0
    : Number.isFinite(Number(visualRange.minVisualDistance)) ? Number(visualRange.minVisualDistance) : 0;
  const maxVisualDistance = runtimeType === 'circuit'
    ? routeLength
    : Number.isFinite(Number(visualRange.maxVisualDistance)) ? Number(visualRange.maxVisualDistance) : routeLength;
  const section = adapter.getSurfaceSectionAtDistance?.(Number(projection.distance || 0), {
    routeLength,
    runtimeType,
    allowVisualExtension: runtimeType !== 'circuit'
  });
  const deck = section?.center;
  if (!deck) return [triangle];
  const metrics = section.metrics || adapter.getCorridorMetrics?.(deck, deck.segment || projection.segment);
  const halfWidth = Math.max(0, Number(includeTransition ? metrics?.outerHalfWidth : metrics?.hardHalfWidth) || 0);
  if (halfWidth <= 0) return [triangle];
  const right = adapter.getRightVector?.(Number(deck.yaw || projection.yaw || 0)) || { x: 1, z: 0 };
  const forward = adapter.getForwardVector?.(Number(deck.yaw || projection.yaw || 0)) || { x: 0, z: 1 };
  const centerDistance = Number(projection.distance || 0);
  const routeEnd = Math.max(1, Number(routeLength || adapter.getRouteLength?.() || 1) || 1);
  const localize = (point = {}) => {
    const dx = Number(point.x || 0) - Number(deck.x || 0);
    const dz = Number(point.z ?? point.y ?? 0) - Number(deck.z ?? deck.y ?? 0);
    return {
      ...point,
      __trackLateral: dx * Number(right.x || 0) + dz * Number(right.z || 0),
      __trackLongitudinal: dx * Number(forward.x || 0) + dz * Number(forward.z || 0)
    };
  };
  const localTriangle = triangle.map(localize);
  const allInside = localTriangle.every((point) => Math.abs(Number(point.__trackLateral || 0)) < halfWidth - 0.0001);
  if (allInside) return [];
  const allOutsideSameSide = localTriangle.every((point) => Number(point.__trackLateral || 0) <= -halfWidth + 0.0001)
    || localTriangle.every((point) => Number(point.__trackLateral || 0) >= halfWidth - 0.0001);
  if (allOutsideSameSide) return [triangle];
  const makeSeamPoint = (a = {}, b = {}, boundaryLateral = 0) => {
    const denom = Number(b.__trackLateral || 0) - Number(a.__trackLateral || 0);
    const t = Math.abs(denom) < 0.000001 ? 0 : clamp((boundaryLateral - Number(a.__trackLateral || 0)) / denom, 0, 1);
    const localDistance = Number(a.__trackLongitudinal || 0)
      + (Number(b.__trackLongitudinal || 0) - Number(a.__trackLongitudinal || 0)) * t;
    let seamDistance = centerDistance + localDistance;
    if (runtimeType === 'circuit') seamDistance = ((seamDistance % routeEnd) + routeEnd) % routeEnd;
    else seamDistance = clamp(seamDistance, minVisualDistance, maxVisualDistance);
    const seamSection = adapter.getSurfaceSectionAtDistance?.(seamDistance, {
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit'
    });
    const seam = includeTransition
      ? (boundaryLateral < 0
        ? (seamSection?.transitionLeft || seamSection?.terrainLeft || seamSection?.shoulderLeft)
        : (seamSection?.transitionRight || seamSection?.terrainRight || seamSection?.shoulderRight))
      : (boundaryLateral < 0
        ? (seamSection?.shoulderLeft || seamSection?.marginLeft || seamSection?.left)
        : (seamSection?.shoulderRight || seamSection?.marginRight || seamSection?.right));
    if (seam) {
      const welded = {
        ...seam,
        x: Number(seam.x || 0),
        z: Number(seam.z ?? seam.y ?? 0),
        y: Number(seam.z ?? seam.y ?? 0),
        elevation: adapter.clampElevation?.(seam.elevation) ?? Number(seam.elevation || 0),
        trackSeam: true,
        terrainClipDistance: seamDistance
      };
      return adapter.weldSeamPoint?.(welded, {
        distance: seamDistance,
        side: boundaryLateral < 0 ? 'left' : 'right'
      }) || welded;
    }
    const fallback = {
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z ?? a.y ?? 0) + (Number(b.z ?? b.y ?? 0) - Number(a.z ?? a.y ?? 0)) * t,
      elevation: adapter.clampElevation?.(Number(a.elevation || 0) + (Number(b.elevation || 0) - Number(a.elevation || 0)) * t) ?? 0,
      trackSeam: true,
      terrainClipDistance: seamDistance
    };
    return adapter.weldSeamPoint?.(fallback, {
      distance: seamDistance,
      side: boundaryLateral < 0 ? 'left' : 'right'
    }) || fallback;
  };
  const clipHalfPlane = (polygon = [], keepPoint, boundaryLateral) => {
    if (!polygon.length) return [];
    const output = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = keepPoint(current);
      const previousInside = keepPoint(previous);
      if (currentInside !== previousInside) output.push(makeSeamPoint(previous, current, boundaryLateral));
      if (currentInside) output.push(current);
    }
    return output;
  };
  const left = clipHalfPlane(localTriangle, (point) => Number(point.__trackLateral || 0) <= -halfWidth, -halfWidth);
  const rightSide = clipHalfPlane(localTriangle, (point) => Number(point.__trackLateral || 0) >= halfWidth, halfWidth);
  return [left, rightSide]
    .filter((polygon) => Array.isArray(polygon) && polygon.length >= 3)
    .map((polygon) => polygon.map((point) => {
      const { __trackLateral, __trackLongitudinal, ...clean } = point;
      return clean;
    }));
}

function splitRaceTerrainTriangleForLocalCorridor(triangle = [], {
  maxPieceWorldM = 160,
  maxPieceDepth = 1,
  depth = 0,
  runtimeType = 'destination',
  routeLength = 1,
  adapter = {}
} = {}) {
  if (depth >= Math.max(0, Number(maxPieceDepth) || 0)) return [triangle];
  const maxEdge = Math.max(4, Number(maxPieceWorldM) || 10);
  const distanceValues = triangle.map((point) => {
    const projection = adapter.projectWorldToTrack?.(point);
    return Number.isFinite(Number(projection?.distance)) ? Number(projection.distance) : null;
  }).filter((value) => value !== null);
  const routeEnd = Math.max(1, Number(routeLength || adapter.getRouteLength?.() || 1) || 1);
  const distanceSpan = distanceValues.length
    ? Math.max(...distanceValues) - Math.min(...distanceValues)
    : 0;
  const edgeLength = (a = {}, b = {}) => Math.hypot(
    Number(a.x || 0) - Number(b.x || 0),
    Number(a.z ?? a.y ?? 0) - Number(b.z ?? b.y ?? 0)
  );
  const longestEdge = Math.max(
    edgeLength(triangle[0], triangle[1]),
    edgeLength(triangle[1], triangle[2]),
    edgeLength(triangle[2], triangle[0])
  );
  const shouldSplit = longestEdge > maxEdge || (
    runtimeType !== 'circuit'
      ? distanceSpan > maxEdge
      : Math.min(distanceSpan, routeEnd - distanceSpan) > maxEdge
  );
  if (!shouldSplit) return [triangle];
  const midpoint = (a = {}, b = {}) => ({
    x: (Number(a.x || 0) + Number(b.x || 0)) * 0.5,
    z: (Number(a.z ?? a.y ?? 0) + Number(b.z ?? b.y ?? 0)) * 0.5,
    y: (Number(a.z ?? a.y ?? 0) + Number(b.z ?? b.y ?? 0)) * 0.5,
    elevation: (Number(a.elevation || 0) + Number(b.elevation || 0)) * 0.5,
    tile: a.tile || b.tile,
    materialId: a.materialId || b.materialId
  });
  const [a, b, c] = triangle;
  const ab = midpoint(a, b);
  const bc = midpoint(b, c);
  const ca = midpoint(c, a);
  const pieces = [
    [a, ab, ca],
    [ab, b, bc],
    [ca, bc, c],
    [ab, bc, ca]
  ];
  const nextMax = maxEdge;
  return pieces.flatMap((piece) => splitRaceTerrainTriangleForLocalCorridor(piece, {
    maxPieceWorldM: nextMax,
    maxPieceDepth,
    depth: depth + 1,
    runtimeType,
    routeLength,
    adapter
  }));
}

export function getRaceTerrainTrianglesOutsideTrackCorridor(points = [], options = {}) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const triangles = points.length === 3
    ? [points]
    : [
      [points[0], points[1], points[2]],
      [points[0], points[2], points[3]]
    ];
  const retained = [];
  triangles.forEach((triangle) => {
    const clipped = clipRaceTerrainTriangleOutsideTrackCorridor(triangle, options);
    clipped.forEach((polygon) => {
      triangulateRaceTerrainPolygon(polygon).forEach((result) => {
        if (getRaceTerrainTriangleArea(result) > 0.000001) retained.push(result);
      });
    });
  });
  return retained;
}

export function clipRaceTerrainTriangleOutsideSignedCorridor(triangle = [], {
  runtimeType = 'destination',
  routeLength = 1,
  maxDepth = 2,
  adapter = {}
} = {}) {
  if (!Array.isArray(triangle) || triangle.length !== 3) return [];
  const routeEnd = Math.max(1, Number(routeLength) || 1);
  const classificationCache = new Map();
  const classify = (point = {}) => {
    const cacheKey = `${Math.round(Number(point.x || 0) * 10000)},${Math.round(Number(point.z ?? point.y ?? 0) * 10000)}`;
    const cached = classificationCache.get(cacheKey);
    if (cached) return cached;
    const projection = adapter.projectWorldToTrack?.(point);
    if (!projection?.segment || !Number.isFinite(Number(projection.distance)) || !Number.isFinite(Number(projection.lateral))) {
      const outside = { signed: Number.POSITIVE_INFINITY, projection, metrics: null };
      classificationCache.set(cacheKey, outside);
      return outside;
    }
    const section = adapter.getSurfaceSectionAtDistance?.(Number(projection.distance || 0), {
      runtimeType,
      routeLength: routeEnd,
      allowVisualExtension: runtimeType !== 'circuit'
    });
    const metrics = section?.metrics || adapter.getCorridorMetrics?.(section?.center || projection, projection.segment) || {};
    const hardHalfWidth = Math.max(0, Number(metrics.hardHalfWidth ?? metrics.shoulderEnd ?? metrics.marginEnd ?? metrics.roadEnd) || 0);
    const result = {
      signed: Math.abs(Number(projection.lateral || 0)) - hardHalfWidth,
      projection,
      metrics
    };
    classificationCache.set(cacheKey, result);
    return result;
  };
  const midpoint = (a = {}, b = {}) => ({
    x: (Number(a.x || 0) + Number(b.x || 0)) * 0.5,
    z: (Number(a.z ?? a.y ?? 0) + Number(b.z ?? b.y ?? 0)) * 0.5,
    elevation: (Number(a.elevation || 0) + Number(b.elevation || 0)) * 0.5
  });
  const centroid = (points = []) => ({
    x: points.reduce((sum, point) => sum + Number(point.x || 0), 0) / points.length,
    z: points.reduce((sum, point) => sum + Number(point.z ?? point.y ?? 0), 0) / points.length,
    elevation: points.reduce((sum, point) => sum + Number(point.elevation || 0), 0) / points.length
  });
  const findSeam = (inside = {}, outside = {}) => {
    let low = inside;
    let high = outside;
    let lowClass = classify(low);
    let highClass = classify(high);
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const candidate = midpoint(low, high);
      const candidateClass = classify(candidate);
      if (candidateClass.signed < 0) {
        low = candidate;
        lowClass = candidateClass;
      } else {
        high = candidate;
        highClass = candidateClass;
      }
    }
    const seamClass = Math.abs(lowClass.signed) < Math.abs(highClass.signed) ? lowClass : highClass;
    const seamPoint = Math.abs(lowClass.signed) < Math.abs(highClass.signed) ? low : high;
    const projection = seamClass.projection || {};
    const welded = {
      ...seamPoint,
      x: Number(seamPoint.x || 0),
      z: Number(seamPoint.z ?? seamPoint.y ?? 0),
      y: Number(seamPoint.z ?? seamPoint.y ?? 0),
      lateralOffset: Number(projection.lateral || 0),
      roadDistance: Number(projection.distance || 0),
      terrainClipDistance: Number(projection.distance || 0),
      hardCorridorEnd: Number(seamClass.metrics?.hardHalfWidth || 0),
      trackSeam: true
    };
    return adapter.weldSeamPoint?.(welded, {
      distance: welded.terrainClipDistance,
      side: welded.lateralOffset < 0 ? 'left' : 'right'
    }) || welded;
  };
  const clip = (points = [], depth = 0) => {
    const classes = points.map(classify);
    const center = centroid(points);
    const centerClass = classify(center);
    const edgeClasses = points.map((point, index) => classify(midpoint(point, points[(index + 1) % points.length])));
    const allOutside = classes.every((entry) => entry.signed >= -0.0001);
    const allInside = classes.every((entry) => entry.signed < 0.0001);
    const probesOutside = centerClass.signed >= -0.0001 && edgeClasses.every((entry) => entry.signed >= -0.0001);
    const probesInside = centerClass.signed < 0.0001 && edgeClasses.every((entry) => entry.signed < 0.0001);
    if (allOutside && probesOutside) return [points];
    if (allInside && probesInside) return [];
    if (depth < Math.max(0, Number(maxDepth) || 0) && (allOutside || allInside)) {
      const [a, b, c] = points;
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      return [
        [a, ab, ca],
        [ab, b, bc],
        [ca, bc, c],
        [ab, bc, ca]
      ].flatMap((piece) => clip(piece, depth + 1));
    }
    if (allOutside || allInside) return [];
    const output = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[(index + points.length - 1) % points.length];
      const currentClass = classify(current);
      const previousClass = classify(previous);
      const currentOutside = currentClass.signed >= 0;
      const previousOutside = previousClass.signed >= 0;
      if (currentOutside !== previousOutside) {
        output.push(currentOutside ? findSeam(previous, current) : findSeam(current, previous));
      }
      if (currentOutside) output.push(current);
    }
    return output.length >= 3 ? [output] : [];
  };
  return clip(triangle).flatMap((polygon) => triangulateRaceTerrainPolygon(polygon));
}

export function subtractRaceTerrainPolygonByConvexPolygon(subject = [], clipPolygon = [], {
  markSeam = true,
  seamEdges = null
} = {}) {
  if (!Array.isArray(subject) || subject.length < 3 || !Array.isArray(clipPolygon) || clipPolygon.length < 3) {
    return Array.isArray(subject) && subject.length >= 3 ? [subject] : [];
  }
  const clipArea = clipPolygon.reduce((sum, point, index) => {
    const next = clipPolygon[(index + 1) % clipPolygon.length];
    return sum + Number(point.x || 0) * Number(next.z ?? next.y ?? 0)
      - Number(next.x || 0) * Number(point.z ?? point.y ?? 0);
  }, 0);
  const orientation = clipArea >= 0 ? 1 : -1;
  const signedEdge = (point = {}, a = {}, b = {}) => orientation * (
    (Number(b.x || 0) - Number(a.x || 0)) * (Number(point.z ?? point.y ?? 0) - Number(a.z ?? a.y ?? 0))
      - (Number(b.z ?? b.y ?? 0) - Number(a.z ?? a.y ?? 0)) * (Number(point.x || 0) - Number(a.x || 0))
  );
  const clipIntersectionArea = () => {
    let polygon = subject.map((point) => ({
      x: Number(point.x || 0),
      z: Number(point.z ?? point.y ?? 0)
    }));
    for (let edgeIndex = 0; edgeIndex < clipPolygon.length && polygon.length >= 3; edgeIndex += 1) {
      const edgeA = clipPolygon[edgeIndex];
      const edgeB = clipPolygon[(edgeIndex + 1) % clipPolygon.length];
      const output = [];
      for (let pointIndex = 0; pointIndex < polygon.length; pointIndex += 1) {
        const current = polygon[pointIndex];
        const previous = polygon[(pointIndex + polygon.length - 1) % polygon.length];
        const currentSigned = signedEdge(current, edgeA, edgeB);
        const previousSigned = signedEdge(previous, edgeA, edgeB);
        const currentInside = currentSigned >= -0.000001;
        const previousInside = previousSigned >= -0.000001;
        if (currentInside !== previousInside) {
          const denominator = previousSigned - currentSigned;
          const t = Math.abs(denominator) < 0.0000001
            ? 0.5
            : clamp(previousSigned / denominator, 0, 1);
          output.push({
            x: previous.x + (current.x - previous.x) * t,
            z: previous.z + (current.z - previous.z) * t
          });
        }
        if (currentInside) output.push(current);
      }
      polygon = output;
    }
    if (polygon.length < 3) return 0;
    return Math.abs(polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point.x * next.z - next.x * point.z;
    }, 0)) * 0.5;
  };
  // Bounding boxes are only a broad phase. Do not partition a terrain polygon
  // along the infinite lines of a nearby road triangle unless their areas
  // genuinely overlap.
  if (clipIntersectionArea() <= 0.000001) return [subject];
  const intersection = (a = {}, b = {}, edgeA = {}, edgeB = {}, markEdge = markSeam) => {
    const da = signedEdge(a, edgeA, edgeB);
    const db = signedEdge(b, edgeA, edgeB);
    const denominator = da - db;
    const t = Math.abs(denominator) < 0.0000001 ? 0.5 : clamp(da / denominator, 0, 1);
    const x = Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t;
    const z = Number(a.z ?? a.y ?? 0) + (Number(b.z ?? b.y ?? 0) - Number(a.z ?? a.y ?? 0)) * t;
    const edgeDx = Number(edgeB.x || 0) - Number(edgeA.x || 0);
    const edgeDz = Number(edgeB.z ?? edgeB.y ?? 0) - Number(edgeA.z ?? edgeA.y ?? 0);
    const edgeLengthSq = edgeDx * edgeDx + edgeDz * edgeDz;
    const edgeT = edgeLengthSq > 0.0000001
      ? clamp(((x - Number(edgeA.x || 0)) * edgeDx + (z - Number(edgeA.z ?? edgeA.y ?? 0)) * edgeDz) / edgeLengthSq, 0, 1)
      : 0;
    const roadSeamElevation = Number(edgeA.elevation || 0)
      + (Number(edgeB.elevation || 0) - Number(edgeA.elevation || 0)) * edgeT;
    return {
      ...a,
      x,
      z,
      y: z,
      elevation: roadSeamElevation,
      roadSeamElevation,
      exactRoadSeam: markEdge,
      trackSeam: markEdge
    };
  };
  const clipHalfPlane = (polygon = [], edgeA = {}, edgeB = {}, keepInside = true, markEdge = markSeam) => {
    const output = [];
    const markPointOnEdge = (point = {}) => {
      if (!markEdge || Math.abs(signedEdge(point, edgeA, edgeB)) > 0.00001) return point;
      const edgeDx = Number(edgeB.x || 0) - Number(edgeA.x || 0);
      const edgeDz = Number(edgeB.z ?? edgeB.y ?? 0) - Number(edgeA.z ?? edgeA.y ?? 0);
      const edgeLengthSq = edgeDx * edgeDx + edgeDz * edgeDz;
      const edgeT = edgeLengthSq > 0.0000001
        ? clamp((
          (Number(point.x || 0) - Number(edgeA.x || 0)) * edgeDx
            + (Number(point.z ?? point.y ?? 0) - Number(edgeA.z ?? edgeA.y ?? 0)) * edgeDz
        ) / edgeLengthSq, 0, 1)
        : 0;
      point.trackSeam = true;
      point.exactRoadSeam = true;
      point.roadSeamElevation = Number(edgeA.elevation || 0)
        + (Number(edgeB.elevation || 0) - Number(edgeA.elevation || 0)) * edgeT;
      point.elevation = point.roadSeamElevation;
      return point;
    };
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = keepInside
        ? signedEdge(current, edgeA, edgeB) >= -0.000001
        : signedEdge(current, edgeA, edgeB) <= 0.000001;
      const previousInside = keepInside
        ? signedEdge(previous, edgeA, edgeB) >= -0.000001
        : signedEdge(previous, edgeA, edgeB) <= 0.000001;
      if (currentInside !== previousInside) output.push(intersection(previous, current, edgeA, edgeB, markEdge));
      if (currentInside) output.push(markPointOnEdge(current));
    }
    return output;
  };
  let pending = [subject];
  const retained = [];
  for (let edgeIndex = 0; edgeIndex < clipPolygon.length && pending.length; edgeIndex += 1) {
    const edgeA = clipPolygon[edgeIndex];
    const edgeB = clipPolygon[(edgeIndex + 1) % clipPolygon.length];
    const markEdge = markSeam && (!Array.isArray(seamEdges) || seamEdges[edgeIndex] === true);
    const nextPending = [];
    pending.forEach((piece) => {
      const outside = clipHalfPlane(piece, edgeA, edgeB, false, markEdge);
      if (outside.length >= 3) retained.push(outside);
      const inside = clipHalfPlane(piece, edgeA, edgeB, true, markEdge);
      if (inside.length >= 3) nextPending.push(inside);
    });
    pending = nextPending;
  }
  return retained.length ? retained : (pending.length ? [] : [subject]);
}
