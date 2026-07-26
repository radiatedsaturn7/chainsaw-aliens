import { getRaceTerrainTriangleArea, triangulateRaceTerrainPolygon } from './RaceTerrainClipping.js';

export function validateRaceSurfaceGeometry(worldBake = null, { surfaceModel = null } = {}) {
  const corridorFirst = ['road-origin-indexed', 'corridor-first', 'constrained-road-first'].includes(String(worldBake?.terrainTopology || ''));
  const constrainedRoadFirst = String(worldBake?.terrainTopology || '') === 'constrained-road-first';
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
    invalidBoundaryIntersections: Number(worldBake?.terrainGenerationStats?.invalidBoundaryIntersections || 0),
    internalOpenEdgeCount: 0,
    terrainCoverageHoleCount: 0,
    apronSeamMismatchCount: 0,
    terrainSeamHeightConflictCount: 0,
    terrainSeamNearVerticalTriangles: 0,
    terrainJoinPathologicalTriangles: 0,
    terrainJoinMaxAspectRatio: 0,
    terrainJoinMinAltitudeM: null,
    allowedDomainPerimeterEdges: 0,
    allowedRoadSeamEdges: 0,
    allowedOuterJoinEdges: 0,
    topologyOpenEdges: 0
  };
  const canonicalMesh = worldBake?.mesh;
  if (canonicalMesh?.topology === 'road-origin-indexed') {
    counters.canonicalVertices = Number(canonicalMesh.stats?.vertices || canonicalMesh.vertices?.length || 0);
    counters.canonicalTriangles = Number(canonicalMesh.stats?.triangles || canonicalMesh.triangles?.length || 0);
    counters.canonicalRejectedDegenerateTriangles = Number(canonicalMesh.stats?.rejectedDegenerateTriangles || 0);
    counters.canonicalCorrectedWindingTriangles = Number(canonicalMesh.stats?.correctedWindingTriangles || 0);
    counters.canonicalNonManifoldEdges = Number(canonicalMesh.stats?.nonManifoldEdges || 0);
    counters.canonicalDownwardNormals = (canonicalMesh.normals || [])
      .filter((normal) => Number(normal?.y || 0) <= 0)
      .length;
  }
  const edgeCounts = new Map();
  const edgePoints = new Map();
  const completeTerrainEdgeCounts = new Map();
  const completeTerrainEdgePoints = new Map();
  const terrainSeamElevations = new Map();
  const elevationScaleM = Math.max(0.001, Number(surfaceModel?.elevationScaleM) || 12);
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
    edgePoints.set(key, [a, b]);
    return key;
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
      const seamTriangle = triangle.some((point) => (
        point?.trackSeam === true || point?.terrainRegion === 'transition'
      ));
      if (seamTriangle) {
        triangle.forEach((point) => {
          const key = `${Math.round(Number(point.x || 0) * 1000)},${Math.round(Number(point.z ?? point.y ?? 0) * 1000)}`;
          const elevations = terrainSeamElevations.get(key) || [];
          elevations.push(Number(point.elevation || 0));
          terrainSeamElevations.set(key, elevations);
        });
        const a = {
          x: Number(triangle[1].x || 0) - Number(triangle[0].x || 0),
          y: (Number(triangle[1].elevation || 0) - Number(triangle[0].elevation || 0)) * elevationScaleM,
          z: Number(triangle[1].z ?? triangle[1].y ?? 0) - Number(triangle[0].z ?? triangle[0].y ?? 0)
        };
        const b = {
          x: Number(triangle[2].x || 0) - Number(triangle[0].x || 0),
          y: (Number(triangle[2].elevation || 0) - Number(triangle[0].elevation || 0)) * elevationScaleM,
          z: Number(triangle[2].z ?? triangle[2].y ?? 0) - Number(triangle[0].z ?? triangle[0].y ?? 0)
        };
        const normal = {
          x: a.y * b.z - a.z * b.y,
          y: a.z * b.x - a.x * b.z,
          z: a.x * b.y - a.y * b.x
        };
        const normalLength = Math.hypot(normal.x, normal.y, normal.z);
        if (normalLength > 0.000001 && Math.abs(normal.y) / normalLength < Math.cos(80 * Math.PI / 180)) {
          counters.terrainSeamNearVerticalTriangles += 1;
        }
        const edgeLengths = [
          Math.hypot(a.x, a.z),
          Math.hypot(b.x, b.z),
          Math.hypot(
            Number(triangle[2].x || 0) - Number(triangle[1].x || 0),
            Number(triangle[2].z ?? triangle[2].y ?? 0) - Number(triangle[1].z ?? triangle[1].y ?? 0)
          )
        ];
        const longestEdgeM = Math.max(...edgeLengths);
        const areaM2 = getRaceTerrainTriangleArea(triangle);
        const minimumAltitudeM = longestEdgeM > 0.000001 ? (areaM2 * 2) / longestEdgeM : 0;
        const aspectRatio = longestEdgeM / Math.max(0.000001, minimumAltitudeM);
        counters.terrainJoinMaxAspectRatio = Math.max(counters.terrainJoinMaxAspectRatio, aspectRatio);
        counters.terrainJoinMinAltitudeM = counters.terrainJoinMinAltitudeM == null
          ? minimumAltitudeM
          : Math.min(counters.terrainJoinMinAltitudeM, minimumAltitudeM);
        if (longestEdgeM > 1 && (minimumAltitudeM < 0.05 || aspectRatio > 250)) {
          counters.terrainJoinPathologicalTriangles += 1;
        }
      }
      triangle.forEach((point) => {
        if (point?.exactRoadSeam !== true || !Number.isFinite(Number(point.roadSeamElevation))) return;
        if (Math.abs(Number(point.elevation || 0) - Number(point.roadSeamElevation || 0)) > 0.000001) {
          counters.apronSeamMismatchCount += 1;
        }
      });
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
      if (canonicalMesh?.topology !== 'road-origin-indexed'
        && !constrainedRoadFirst
        && !cell?.completeHeightmapCell
        && (cell?.roadAdjacent || cell?.clippedToTrackCorridor || cell?.terrainSide !== 'raw')) probes.forEach((point) => {
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
      const triangleEdges = [
        [triangle[0], triangle[1]],
        [triangle[1], triangle[2]],
        [triangle[2], triangle[0]]
      ];
      triangleEdges.forEach(([a, b]) => {
        const key = addEdge(a, b);
        if (cell?.completeHeightmapCell && key) {
          completeTerrainEdgeCounts.set(key, (completeTerrainEdgeCounts.get(key) || 0) + 1);
          completeTerrainEdgePoints.set(key, [a, b]);
        }
      });
    });
  });
  edgeCounts.forEach((count) => {
    if (count === 1) counters.openEdges += 1;
    if (count > 2) counters.nonManifoldEdges += 1;
  });
  terrainSeamElevations.forEach((elevations) => {
    if ((Math.max(...elevations) - Math.min(...elevations)) * elevationScaleM > 0.02) {
      counters.terrainSeamHeightConflictCount += 1;
    }
  });
  const completeBounds = worldBake?.terrainGenerationStats?.completeHeightmapBounds;
  const completeGridSize = Number(worldBake?.terrainGenerationStats?.completeHeightmapGridSizeM || 0);
  if (completeBounds && completeGridSize > 0) {
    const minX = Number(completeBounds.minGridX) * completeGridSize;
    const maxX = (Number(completeBounds.maxGridX) + 1) * completeGridSize;
    const minZ = Number(completeBounds.minGridZ) * completeGridSize;
    const maxZ = (Number(completeBounds.maxGridZ) + 1) * completeGridSize;
    const onDomainPerimeter = (point = {}) => {
      const x = Number(point.x || 0);
      const z = Number(point.z ?? point.y ?? 0);
      return Math.abs(x - minX) < 0.001
        || Math.abs(x - maxX) < 0.001
        || Math.abs(z - minZ) < 0.001
        || Math.abs(z - maxZ) < 0.001;
    };
    completeTerrainEdgeCounts.forEach((count, key) => {
      if (count !== 1) return;
      const points = completeTerrainEdgePoints.get(key) || [];
      if (points.length === 2 && points.every(onDomainPerimeter)) counters.allowedDomainPerimeterEdges += 1;
      else counters.internalOpenEdgeCount += 1;
    });
    counters.terrainCoverageHoleCount = counters.internalOpenEdgeCount;
  }
  const adaptiveBounds = worldBake?.terrainGenerationStats?.adaptiveTerrainBounds;
  const adaptiveGridSize = Number(worldBake?.terrainGenerationStats?.adaptiveTerrainFarSizeM || 0);
  if (constrainedRoadFirst && adaptiveBounds && adaptiveGridSize > 0) {
    const minX = Number(adaptiveBounds.minGridX) * adaptiveGridSize;
    const maxX = (Number(adaptiveBounds.maxGridX) + 1) * adaptiveGridSize;
    const minZ = Number(adaptiveBounds.minGridZ) * adaptiveGridSize;
    const maxZ = (Number(adaptiveBounds.maxGridZ) + 1) * adaptiveGridSize;
    const onDomainPerimeter = (point = {}) => {
      const x = Number(point.x || 0);
      const z = Number(point.z ?? point.y ?? 0);
      return Math.abs(x - minX) < 0.001
        || Math.abs(x - maxX) < 0.001
        || Math.abs(z - minZ) < 0.001
        || Math.abs(z - maxZ) < 0.001;
    };
    counters.internalOpenEdgeCount = 0;
    counters.allowedDomainPerimeterEdges = 0;
    edgeCounts.forEach((count, key) => {
      if (count !== 1) return;
      const points = edgePoints.get(key) || [];
      if (points.length === 2 && points.every(onDomainPerimeter)) {
        counters.allowedDomainPerimeterEdges += 1;
      } else if (points.length === 2 && points.every((point) => point?.terrainDomainCap === true)) {
        counters.allowedDomainPerimeterEdges += 1;
      } else if (points.length === 2
        && points.some((point) => point?.outerTerrainJoin === true)
        && points.every((point) => ['terrain', 'transition'].includes(String(point?.terrainRegion || point?.region || 'terrain')))
        && Math.abs(Number(points[1].elevation || 0) - Number(points[0].elevation || 0)) * elevationScaleM <= 0.02) {
        counters.allowedOuterJoinEdges += 1;
      } else if (points.length === 2 && points.every((point) => (
        point?.trackSeam === true
        && point?.exactRoadSeam === true
        && Number.isFinite(Number(point?.roadSeamElevation))
      ))) {
        counters.allowedRoadSeamEdges += 1;
      } else {
        counters.internalOpenEdgeCount += 1;
      }
    });
    counters.terrainCoverageHoleCount = counters.internalOpenEdgeCount;
  }
  counters.topologyOpenEdges = counters.openEdges;
  if ((completeBounds && completeGridSize > 0) || constrainedRoadFirst) counters.openEdges = counters.internalOpenEdgeCount;
  counters.openTerrainEdges = counters.openEdges;
  counters.nonManifoldTerrainEdges = counters.nonManifoldEdges;
  counters.magentaEdges = counters.degenerateTriangles
    + counters.nonManifoldEdges
    + counters.hardCorridorIntersections
    + counters.internalOpenEdgeCount
    + counters.apronSeamMismatchCount;
  return counters;
}
