import { getRaceTerrainTriangleArea, triangulateRaceTerrainPolygon } from './RaceTerrainClipping.js';

export function validateRaceSurfaceGeometry(worldBake = null, { surfaceModel = null } = {}) {
  const counters = {
    surfaceRevision: worldBake?.surfaceRevision || worldBake?.key || '',
    terrainTriangles: 0,
    degenerateTriangles: 0,
    openEdges: 0,
    nonManifoldEdges: 0,
    seamVertices: 0,
    rejectedByCorridor: 0,
    hardCorridorIntersections: 0,
    magentaEdges: 0
  };
  const edgeCounts = new Map();
  const vertexKey = (point = {}) => [
    Math.round(Number(point.x || 0) * 1000),
    Math.round(Number(point.elevation || 0) * 1000),
    Math.round(Number(point.z ?? point.y ?? 0) * 1000)
  ].join(',');
  const addEdge = (a = {}, b = {}) => {
    const ak = vertexKey(a);
    const bk = vertexKey(b);
    if (ak === bk) return;
    const key = ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  };
  (worldBake?.terrainCells || []).forEach((cell) => {
    const points = Array.isArray(cell?.points) ? cell.points : [];
    const triangles = triangulateRaceTerrainPolygon(points);
    if (cell?.clippedToTrackCorridor) counters.rejectedByCorridor += 1;
    triangles.forEach((triangle) => {
      counters.terrainTriangles += 1;
      if (getRaceTerrainTriangleArea(triangle) <= 0.000001) counters.degenerateTriangles += 1;
      if (triangle.some((point) => point?.trackSeam === true)) counters.seamVertices += triangle.filter((point) => point?.trackSeam === true).length;
      triangle.forEach((point) => {
        const sample = surfaceModel?.sampleWorld?.(point, Number(point.elevation || 0), {
          runtimeType: worldBake.runtimeType,
          routeLength: worldBake.routeLength
        });
        if ((sample?.region === 'road' || sample?.region === 'margin' || sample?.region === 'shoulder')
          && Math.abs(Number(sample.elevation || 0) - Number(point.elevation || 0)) > 0.0001) {
          counters.hardCorridorIntersections += 1;
        }
      });
      addEdge(triangle[0], triangle[1]);
      addEdge(triangle[1], triangle[2]);
      addEdge(triangle[2], triangle[0]);
    });
  });
  edgeCounts.forEach((count) => {
    if (count === 1) counters.openEdges += 1;
    if (count > 2) counters.nonManifoldEdges += 1;
  });
  counters.magentaEdges = counters.degenerateTriangles + counters.nonManifoldEdges + counters.hardCorridorIntersections;
  return counters;
}
