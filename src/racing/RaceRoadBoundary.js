// Only weld numerical copies of a baked ground-road edge. Nearby terrain is
// not an edge: dragging it onto the road collapses real strips and opens holes.
export function createRaceRoadBoundary(edges, bucketSize = 20) {
  const tolerance = 0.000001;
  const buckets = new Map();
  const z = p => Number(p.z ?? p.y ?? 0);
  for (const [a, b] of edges) {
    const edge = { a, b };
    for (let iz = Math.floor((Math.min(z(a), z(b)) - tolerance) / bucketSize); iz <= Math.floor((Math.max(z(a), z(b)) + tolerance) / bucketSize); iz++) {
      for (let ix = Math.floor((Math.min(a.x, b.x) - tolerance) / bucketSize); ix <= Math.floor((Math.max(a.x, b.x) + tolerance) / bucketSize); ix++) {
        const key = `${ix},${iz}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(edge);
      }
    }
  }
  const nearest = (point, reach = tolerance) => {
      let best = null;
      const candidates = new Set();
      for (let iz = Math.floor((z(point)-reach)/bucketSize); iz <= Math.floor((z(point)+reach)/bucketSize); iz++) {
        for (let ix = Math.floor((point.x-reach)/bucketSize); ix <= Math.floor((point.x+reach)/bucketSize); ix++) {
          for (const edge of buckets.get(`${ix},${iz}`) || []) candidates.add(edge);
        }
      }
      for (const { a, b } of candidates) {
        const dx = b.x - a.x, dz = z(b) - z(a);
        const lengthSq = dx * dx + dz * dz;
        if (!lengthSq) continue;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (z(point) - z(a)) * dz) / lengthSq));
        const x = a.x + dx * t, edgeZ = z(a) + dz * t;
        const distance = Math.hypot(point.x - x, z(point) - edgeZ);
        if (distance > reach || (best && distance >= best.distance)) continue;
        const ad = Number(a.roadDistance ?? a.routeDistance ?? a.distance);
        const bd = Number(b.roadDistance ?? b.routeDistance ?? b.distance);
        best = { x, z: edgeZ, distance, elevation: a.elevation + (b.elevation - a.elevation) * t,
          routeDistance: Number.isFinite(ad) && Number.isFinite(bd) ? ad + (bd - ad) * t : null };
      }
      return best;
  };
  return {
    nearest,
    // Road-adjacent samples must converge continuously to the same baked
    // boundary, even when analytic route projection selects another segment.
    constrainHeight(point, elevationScaleM = 12, reach = 2) {
      const edge = nearest(point, reach);
      if (!edge) return false;
      const maxDelta = edge.distance * 0.75 / elevationScaleM;
      point.elevation = Math.max(edge.elevation - maxDelta,
        Math.min(edge.elevation + maxDelta, point.elevation));
      return true;
    },
    snap(point) {
      const best = nearest(point);
      if (!best) {
        point.trackSeam = false;
        point.exactRoadSeam = false;
        delete point.roadSeamElevation;
        delete point.roadSeamDistance;
        return false;
      }
      Object.assign(point, { x: best.x, z: best.z, y: best.z,
        elevation: best.elevation, roadSeamElevation: best.elevation,
        trackSeam: true, exactRoadSeam: true });
      if (best.routeDistance !== null) point.roadSeamDistance = best.routeDistance;
      return true;
    }
  };
}
