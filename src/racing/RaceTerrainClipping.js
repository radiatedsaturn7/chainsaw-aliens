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
  adapter = {}
} = {}) {
  if (!Array.isArray(triangle) || triangle.length < 3) return [];
  const center = {
    x: triangle.reduce((sum, point) => sum + Number(point?.x || 0), 0) / triangle.length,
    z: triangle.reduce((sum, point) => sum + Number(point?.z ?? point?.y ?? 0), 0) / triangle.length
  };
  const projection = adapter.projectWorldToTrack?.(center);
  if (!projection?.segment || !Number.isFinite(Number(projection.distance)) || !Number.isFinite(Number(projection.lateral))) {
    return [triangle];
  }
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
    else seamDistance = clamp(seamDistance, 0, routeEnd);
    const seamSection = adapter.getSurfaceSectionAtDistance?.(seamDistance, {
      routeLength: routeEnd,
      runtimeType,
      allowVisualExtension: runtimeType !== 'circuit'
    });
    const seam = boundaryLateral < 0
      ? (seamSection?.transitionLeft || seamSection?.terrainLeft || seamSection?.shoulderLeft)
      : (seamSection?.transitionRight || seamSection?.terrainRight || seamSection?.shoulderRight);
    if (seam) {
      return {
        ...seam,
        x: Number(seam.x || 0),
        z: Number(seam.z ?? seam.y ?? 0),
        y: Number(seam.z ?? seam.y ?? 0),
        elevation: adapter.clampElevation?.(seam.elevation) ?? Number(seam.elevation || 0),
        trackSeam: true,
        terrainClipDistance: seamDistance
      };
    }
    return {
      x: Number(a.x || 0) + (Number(b.x || 0) - Number(a.x || 0)) * t,
      z: Number(a.z ?? a.y ?? 0) + (Number(b.z ?? b.y ?? 0) - Number(a.z ?? a.y ?? 0)) * t,
      elevation: adapter.clampElevation?.(Number(a.elevation || 0) + (Number(b.elevation || 0) - Number(a.elevation || 0)) * t) ?? 0,
      trackSeam: true,
      terrainClipDistance: seamDistance
    };
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
