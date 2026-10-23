import { createRaceNetworkQueryIndex } from './RaceNetworkQueryIndex.js';
import { buildRaceNetworkGeometry } from './RaceNetworkGeometry.js';
import { buildRaceCanonicalSurfaceMesh } from './RaceCanonicalSurfaceMesh.js';
import { packRaceCanonicalSurfaceMesh } from './RaceBakedSurfaceSampler.js';

export function buildRaceNetworkWorld(network, {
  key = '', routeLength = 1, stepM = 2.5, textureWorldM = 2.5,
  elevationScaleM = 12, buildSurfaceSampler = true, retainTerrainCells = true,
  sampleTerrain = () => 0, tileAt = () => null, paintedCells = [], tileSizeM = 5
} = {}) {
  const geometry = buildRaceNetworkGeometry(network, { stepM, elevationScaleM });
  const authored = [...network.nodes, ...network.edges.flatMap(e => e.points)];
  const minX = Math.floor((Math.min(...authored.map(p => p.x)) - 160)/tileSizeM)*tileSizeM, maxX = Math.max(...authored.map(p => p.x)) + 160;
  const minZ = Math.floor((Math.min(...authored.map(p => p.z)) - 160)/tileSizeM)*tileSizeM, maxZ = Math.max(...authored.map(p => p.z)) + 160;
  const cellSize = Math.max(tileSizeM, Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 160 / tileSizeM)*tileSizeM);
  const paintedBlocks=new Set(paintedCells.map(p=>`${Math.floor((p.x-minX)/cellSize)},${Math.floor((p.z-minZ)/cellSize)}`));
  const groundRoutes = { ...network, edges: network.edges.filter(e => e.structure === 'road') };
  const tunnels = { ...network, edges: network.edges.filter(e => e.structure === 'tunnel') };
  const groundIndex = createRaceNetworkQueryIndex(groundRoutes);
  const tunnelIndex = createRaceNetworkQueryIndex(tunnels);
  const tunnelAt = (x, z) => tunnelIndex.project({ x, z });
  const isPortalOpening = (x, z) => {
    const tunnel = tunnelAt(x, z);
    if (!tunnel || tunnel.distanceToRoute > tunnel.edge.widthM / 2 + 1) return false;
    const groundM = Number(sampleTerrain({ x, z }) || 0) * elevationScaleM;
    return tunnel.heightM + tunnel.edge.clearanceM >= groundM - 0.5;
  };
  const vertexCache = new Map();
  const vertex = (x, z) => {
    const id = `${x},${z}`;
    if (vertexCache.has(id)) return vertexCache.get(id);
    let elevation = Number(sampleTerrain({ x, z }) || 0);
    const road = groundIndex.project({ x, z });
    if (road) {
      const gap = Math.max(0, road.distanceToRoute - road.edge.widthM / 2);
      const blend = Math.max(0, 1 - gap / 20);
      elevation += (road.heightM / elevationScaleM - elevation) * blend;
      if (gap < 0.1) elevation -= 0.03 / elevationScaleM;
    }
    const result = { x, z, elevation };
    vertexCache.set(id, result); return result;
  };
  const cells = [];
  const addCell = (x, z, size) => {
    // Excavate daylight portions of tunnel ramps. Keeping an ordinary height
    // field above the entrance would make cars drive over the tunnel instead
    // of descending into it. Buried portions retain the terrain overhead.
    if (isPortalOpening(x + size / 2, z + size / 2)) return;
    cells.push({ key: `network-ground:${x}:${z}`, tileCell: tileAt({ x:x+size/2, z:z+size/2 }), terrainRegion: 'terrain',
      points: [vertex(x, z), vertex(x + size, z), vertex(x + size, z + size), vertex(x, z + size)] });
  };
  for (let z = minZ; z < maxZ; z += cellSize) for (let x = minX; x < maxX; x += cellSize) {
    const tunnel = tunnelAt(x + cellSize / 2, z + cellSize / 2);
    let divisions=paintedBlocks.has(`${Math.round((x-minX)/cellSize)},${Math.round((z-minZ)/cellSize)}`)?cellSize/tileSizeM:1;
    if(tunnel && tunnel.distanceToRoute < tunnel.edge.widthM / 2 + cellSize)divisions*=Math.ceil(cellSize/divisions/2);
    const size = cellSize / divisions;
    for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) addCell(x + col * size, z + row * size, size);
  }
  const terrainMesh = buildRaceCanonicalSurfaceMesh({ terrainCells: cells, elevationScaleM });
  const mesh = geometry.mesh, offset = mesh.vertices.length;
  mesh.vertices.push(...terrainMesh.vertices); mesh.normals.push(...terrainMesh.normals);
  for (const triangle of terrainMesh.triangles) {
    mesh.groups[triangle.region].push(mesh.triangles.length);
    mesh.triangles.push({ ...triangle, indices: triangle.indices.map(i => i + offset) });
  }
  mesh.stats.vertices = mesh.vertices.length; mesh.stats.triangles = mesh.triangles.length;
  return {
    key, surfaceRevision: key, terrainTopology: 'route-network', routeLength, runtimeType: 'destination',
    terrainSize: cellSize, textureWorldM, mesh,
    surfaceBake: { sections: geometry.paths.flatMap(p => p.sections), paths: geometry.paths, routeLength, runtimeType: 'destination', step: stepM },
    terrainCells: retainTerrainCells ? cells : [], terrainBaseCells: retainTerrainCells ? cells : [],
    terrainRefinementCells: [], terrainChunks: [], terrainCellsRetained: retainTerrainCells,
    staticColliders: geometry.staticColliderDefinitions, structureMeshes: geometry.structureMeshes,
    terrainGenerationStats: { terrainTopology: 'route-network', canonicalVertices: mesh.vertices.length, canonicalTriangles: mesh.triangles.length },
    surfaceSampler: buildSurfaceSampler ? packRaceCanonicalSurfaceMesh(mesh, { elevationScaleM }) : null,
    validation: null
  };
}
