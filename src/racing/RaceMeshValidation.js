import { getRaceTerrainTriangleArea, triangulateRaceTerrainPolygon } from './RaceTerrainClipping.js';

export function validateRaceSurfaceGeometry(worldBake = null, { surfaceModel = null } = {}) {
  const corridorFirst = String(worldBake?.terrainTopology || '') === 'corridor-first';
  const counters = {
    surfaceRevision: worldBake?.surfaceRevision || worldBake?.key || '',
    terrainTriangles: 0,
    degenerateTriangles: 0,
    openEdges: 0,
    nonManifoldEdges: 0,
    seamVertices: 0,
    rejectedByCorridor: 0,
    hardCorridorIntersections: 0,
    magentaEdges: 0,
    openTerrainEdges: 0,
    nonManifoldTerrainEdges: 0,
    invertedTerrainQuads: 0,
    roadsideBoundaryMismatchCount: Number(worldBake?.terrainGenerationStats?.roadsideBoundaryMismatchCount || 0),
    roadsideBoundaryMaxErrorM: Number(worldBake?.terrainGenerationStats?.roadsideBoundaryMaxErrorM || 0),
    terrainRoadIntrusionCount: 0,
    invalidBoundaryIntersections: Number(worldBake?.terrainGenerationStats?.invalidBoundaryIntersections || 0)
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
    if (points.length >= 4) {
      let quadArea = 0;
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        quadArea += Number(a.x || 0) * Number(b.z ?? b.y ?? 0) - Number(b.x || 0) * Number(a.z ?? a.y ?? 0);
      }
      if (quadArea < -0.000001) counters.invertedTerrainQuads += 1;
    }
    const triangles = triangulateRaceTerrainPolygon(points);
    if (cell?.clippedToTrackCorridor) counters.rejectedByCorridor += 1;
    triangles.forEach((triangle) => {
      counters.terrainTriangles += 1;
      if (getRaceTerrainTriangleArea(triangle) <= 0.000001) counters.degenerateTriangles += 1;
      if (triangle.some((point) => point?.trackSeam === true)) counters.seamVertices += triangle.filter((point) => point?.trackSeam === true).length;
      const probes = [
        ...triangle,
        {
          x: (Number(triangle[0].x || 0) + Number(triangle[1].x || 0)) * 0.5,
          z: (Number(triangle[0].z ?? triangle[0].y ?? 0) + Number(triangle[1].z ?? triangle[1].y ?? 0)) * 0.5,
          elevation: (Number(triangle[0].elevation || 0) + Number(triangle[1].elevation || 0)) * 0.5,
          roadDistance: (Number(triangle[0].roadDistance ?? triangle[0].distance ?? 0) + Number(triangle[1].roadDistance ?? triangle[1].distance ?? 0)) * 0.5,
          lateralOffset: (Number(triangle[0].lateralOffset || 0) + Number(triangle[1].lateralOffset || 0)) * 0.5,
          hardCorridorEnd: (Number(triangle[0].hardCorridorEnd || 0) + Number(triangle[1].hardCorridorEnd || 0)) * 0.5,
          terrainRegion: triangle[0].terrainRegion === triangle[1].terrainRegion ? triangle[0].terrainRegion : 'interior'
        },
        {
          x: (Number(triangle[1].x || 0) + Number(triangle[2].x || 0)) * 0.5,
          z: (Number(triangle[1].z ?? triangle[1].y ?? 0) + Number(triangle[2].z ?? triangle[2].y ?? 0)) * 0.5,
          elevation: (Number(triangle[1].elevation || 0) + Number(triangle[2].elevation || 0)) * 0.5,
          roadDistance: (Number(triangle[1].roadDistance ?? triangle[1].distance ?? 0) + Number(triangle[2].roadDistance ?? triangle[2].distance ?? 0)) * 0.5,
          lateralOffset: (Number(triangle[1].lateralOffset || 0) + Number(triangle[2].lateralOffset || 0)) * 0.5,
          hardCorridorEnd: (Number(triangle[1].hardCorridorEnd || 0) + Number(triangle[2].hardCorridorEnd || 0)) * 0.5,
          terrainRegion: triangle[1].terrainRegion === triangle[2].terrainRegion ? triangle[1].terrainRegion : 'interior'
        },
        {
          x: (Number(triangle[2].x || 0) + Number(triangle[0].x || 0)) * 0.5,
          z: (Number(triangle[2].z ?? triangle[2].y ?? 0) + Number(triangle[0].z ?? triangle[0].y ?? 0)) * 0.5,
          elevation: (Number(triangle[2].elevation || 0) + Number(triangle[0].elevation || 0)) * 0.5,
          roadDistance: (Number(triangle[2].roadDistance ?? triangle[2].distance ?? 0) + Number(triangle[0].roadDistance ?? triangle[0].distance ?? 0)) * 0.5,
          lateralOffset: (Number(triangle[2].lateralOffset || 0) + Number(triangle[0].lateralOffset || 0)) * 0.5,
          hardCorridorEnd: (Number(triangle[2].hardCorridorEnd || 0) + Number(triangle[0].hardCorridorEnd || 0)) * 0.5,
          terrainRegion: triangle[2].terrainRegion === triangle[0].terrainRegion ? triangle[2].terrainRegion : 'interior'
        },
        {
          x: (Number(triangle[0].x || 0) + Number(triangle[1].x || 0) + Number(triangle[2].x || 0)) / 3,
          z: (Number(triangle[0].z ?? triangle[0].y ?? 0) + Number(triangle[1].z ?? triangle[1].y ?? 0) + Number(triangle[2].z ?? triangle[2].y ?? 0)) / 3,
          elevation: (Number(triangle[0].elevation || 0) + Number(triangle[1].elevation || 0) + Number(triangle[2].elevation || 0)) / 3,
          roadDistance: (Number(triangle[0].roadDistance ?? triangle[0].distance ?? 0) + Number(triangle[1].roadDistance ?? triangle[1].distance ?? 0) + Number(triangle[2].roadDistance ?? triangle[2].distance ?? 0)) / 3,
          lateralOffset: (Number(triangle[0].lateralOffset || 0) + Number(triangle[1].lateralOffset || 0) + Number(triangle[2].lateralOffset || 0)) / 3,
          hardCorridorEnd: (Number(triangle[0].hardCorridorEnd || 0) + Number(triangle[1].hardCorridorEnd || 0) + Number(triangle[2].hardCorridorEnd || 0)) / 3,
          terrainRegion: 'interior'
        }
      ];
      probes.forEach((point) => {
        const localHardEnd = Number(point?.hardCorridorEnd || 0);
        const outsideLocalHardCorridor = corridorFirst
          && localHardEnd > 0
          && Math.abs(Number(point?.lateralOffset || 0)) >= localHardEnd - 0.001;
        const sample = surfaceModel?.sampleWorld?.(point, Number(point.elevation || 0), {
          runtimeType: worldBake.runtimeType,
          routeLength: worldBake.routeLength
        });
        const sampleDistance = Number(sample?.projection?.distance || 0);
        const pointDistance = Number(point?.roadDistance ?? point?.distance ?? sampleDistance);
        const routeLength = Math.max(1, Number(worldBake.routeLength || 1) || 1);
        const rawDistanceDelta = Math.abs(sampleDistance - pointDistance);
        const wrappedDistanceDelta = ((rawDistanceDelta % routeLength) + routeLength) % routeLength;
        const distanceDelta = worldBake.runtimeType === 'circuit'
          ? Math.min(wrappedDistanceDelta, routeLength - wrappedDistanceDelta)
          : rawDistanceDelta;
        const ownProjection = !corridorFirst || distanceDelta <= 12;
        if ((sample?.region === 'road' || sample?.region === 'margin' || sample?.region === 'shoulder')
          && ownProjection
          && !outsideLocalHardCorridor
          && Math.abs(Number(sample.elevation || 0) - Number(point.elevation || 0)) > 0.0001) {
          counters.hardCorridorIntersections += 1;
        }
        if (ownProjection && (sample?.region === 'road' || sample?.region === 'margin')) {
          const absLateral = Math.abs(Number(sample.projection?.lateral || 0));
          const limit = sample.region === 'margin'
            ? Number(sample.metrics?.marginEnd || 0)
            : Number(sample.metrics?.roadEnd || 0);
          if (!outsideLocalHardCorridor && absLateral < limit - 0.001 && point?.terrainRegion !== 'inner') counters.terrainRoadIntrusionCount += 1;
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
  counters.openTerrainEdges = counters.openEdges;
  counters.nonManifoldTerrainEdges = counters.nonManifoldEdges;
  counters.magentaEdges = counters.degenerateTriangles + counters.nonManifoldEdges + counters.hardCorridorIntersections;
  return counters;
}
