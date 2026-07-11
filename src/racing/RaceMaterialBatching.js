export function drawRaceWebGLTerrainMeshBatch({
  renderer = null,
  cells = [],
  camera = null,
  cameraYaw = 0,
  bounds = {},
  textureWorldM = 2.5,
  textured = false,
  tileMap = null,
  useSunShading = false,
  stats = null,
  adapter = {}
} = {}) {
  const gl = renderer?.gl;
  if (!gl || !renderer.terrainProgram || !Array.isArray(cells) || !cells.length || !camera) return false;
  const buildStartMs = adapter.now?.() || 0;
  const vertices = adapter.getTerrainMeshVertices?.(cells, {
    textureWorldM,
    textured,
    tileMap,
    useSunShading
  }) || new Float32Array();
  if (stats && buildStartMs > 0) stats.terrainMeshBuildMs = (Number(stats.terrainMeshBuildMs) || 0) + Math.max(0, (adapter.now?.() || buildStartMs) - buildStartMs);
  if (vertices.length < 54) return false;
  gl.useProgram(renderer.terrainProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.terrainBuffer);
  const requiredFloats = vertices.length;
  if (!renderer.terrainUploadArray || renderer.terrainUploadCapacity < requiredFloats) {
    let capacity = Math.max(2048, renderer.terrainUploadCapacity || 0);
    while (capacity < requiredFloats) capacity *= 2;
    renderer.terrainUploadArray = new Float32Array(capacity);
    renderer.terrainUploadCapacity = capacity;
    gl.bufferData(gl.ARRAY_BUFFER, renderer.terrainUploadArray.byteLength, gl.DYNAMIC_DRAW);
    renderer.terrainBufferCapacity = capacity;
    if (stats) stats.terrainBufferReallocations = (Number(stats.terrainBufferReallocations) || 0) + 1;
  } else if (renderer.terrainBufferCapacity !== renderer.terrainUploadCapacity) {
    gl.bufferData(gl.ARRAY_BUFFER, renderer.terrainUploadArray.byteLength, gl.DYNAMIC_DRAW);
    renderer.terrainBufferCapacity = renderer.terrainUploadCapacity;
    if (stats) stats.terrainBufferReallocations = (Number(stats.terrainBufferReallocations) || 0) + 1;
  }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
  const stride = 36;
  gl.enableVertexAttribArray(renderer.terrainLocations.worldPosition);
  gl.vertexAttribPointer(renderer.terrainLocations.worldPosition, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(renderer.terrainLocations.texCoord);
  gl.vertexAttribPointer(renderer.terrainLocations.texCoord, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(renderer.terrainLocations.tint);
  gl.vertexAttribPointer(renderer.terrainLocations.tint, 4, gl.FLOAT, false, stride, 20);
  gl.uniform1i(renderer.terrainLocations.textureSampler, 0);
  gl.uniform1f(renderer.terrainLocations.useTexture, textured ? 1 : 0);
  gl.uniform3f(renderer.terrainLocations.cameraPosition, Number(camera.x || 0), Number(camera.elevation || 0), Number(camera.z || 0));
  gl.uniform1f(renderer.terrainLocations.cameraYaw, Number(cameraYaw || 0));
  gl.uniform2f(renderer.terrainLocations.viewport, Number(bounds.w || 1), Number(bounds.h || 1));
  gl.uniform1f(renderer.terrainLocations.focal, Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04)));
  gl.uniform1f(renderer.terrainLocations.roadWidthScale, Number(camera.roadWidthScale) || 2.2);
  gl.uniform1f(renderer.terrainLocations.horizonRatio, Number(camera.horizonRatio) || 0.31);
  gl.uniform1f(renderer.terrainLocations.roadDepthRatio, Number(camera.roadDepthRatio) || 0.7);
  gl.uniform1f(renderer.terrainLocations.nearPlane, Math.max(1.2, Number(camera.nearPlane) || 1.6));
  gl.uniform1f(renderer.terrainLocations.farPlane, Math.max(10, Number(camera.farPlane) || 2200));
  if (!renderer.meshBlendEnabled) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    renderer.meshBlendEnabled = true;
  }
  const drawStartMs = adapter.now?.() || 0;
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 9);
  if (stats) {
    stats.terrainWorldMeshDrawCalls = (Number(stats.terrainWorldMeshDrawCalls) || 0) + 1;
    stats.terrainWorldMeshPolygons = (Number(stats.terrainWorldMeshPolygons) || 0) + vertices.length / 27;
    stats.polygons = (Number(stats.polygons) || 0) + vertices.length / 27;
    stats.bufferUploads = (Number(stats.bufferUploads) || 0) + 1;
    stats.uploadedFloats = (Number(stats.uploadedFloats) || 0) + requiredFloats;
    if (textured) stats.terrainMeshTexturePolygons = (Number(stats.terrainMeshTexturePolygons) || 0) + vertices.length / 27;
    if (drawStartMs > 0) stats.webglUploadDrawMs = (Number(stats.webglUploadDrawMs) || 0) + Math.max(0, (adapter.now?.() || drawStartMs) - drawStartMs);
  }
  return true;
}

export function drawRaceWebGLWorldMeshBatch({
  renderer = null,
  meshes = [],
  camera = null,
  cameraYaw = 0,
  bounds = {},
  textureWorldM = 2.5,
  stats = null,
  depthTest = true,
  adapter = {}
} = {}) {
  if (!renderer?.gl || !Array.isArray(meshes) || !meshes.length) return false;
  const { gl } = renderer;
  const grouped = new Map();
  meshes.forEach((mesh) => {
    if (!mesh?.points?.length) return;
    const color = mesh.color || '#ffffff';
    const artRef = String(mesh.artRef || '').trim();
    const textured = Boolean(mesh.textured);
    const depthOffset = Number(mesh.depthOffset || 0);
    const key = `${textured ? 1 : 0}|${artRef}|${depthOffset}|${color}`;
    const meshTextureWorldM = Number(mesh.textureWorldM || textureWorldM);
    let textureOriginX = 0;
    let textureOriginZ = 0;
    if (textured) {
      const scale = Math.max(0.0001, meshTextureWorldM || 2.5);
      const xs = mesh.points.map((point) => Number(point?.x || 0)).filter(Number.isFinite);
      const zs = mesh.points.map((point) => Number(point?.z || 0)).filter(Number.isFinite);
      textureOriginX = Math.floor((xs.length ? Math.min(...xs) : 0) / scale) * scale;
      textureOriginZ = Math.floor((zs.length ? Math.min(...zs) : 0) / scale) * scale;
    }
    const buildStartMs = adapter.now?.() || 0;
    const vertices = adapter.getWorldMeshVertices?.(bounds, mesh.points, {
      camera,
      cameraYaw,
      textureWorldM: meshTextureWorldM,
      textured,
      projectedPolygon: mesh.projectedPolygon,
      depthOffset,
      elevationOffset: Number.isFinite(Number(mesh.elevationOffset))
        ? Number(mesh.elevationOffset)
        : adapter.getElevationOffsetForSource?.(mesh.source || '') || 0,
      minScreenY: mesh.minScreenY,
      meshSource: mesh.source || '',
      rawTerrainPolygons: Boolean(mesh.rawTerrainPolygons),
      textureOriginX,
      textureOriginZ,
      stats
    }) || [];
    if (stats && buildStartMs > 0) stats.meshBuildMs = (Number(stats.meshBuildMs) || 0) + Math.max(0, (adapter.now?.() || buildStartMs) - buildStartMs);
    if (!vertices.length) return;
    if (stats) {
      stats.polygons = (Number(stats.polygons) || 0) + vertices.length / 18;
      if ((mesh.source || '') === 'terrain' && textured) {
        stats.terrainMeshTexturePolygons = (Number(stats.terrainMeshTexturePolygons) || 0) + vertices.length / 18;
      }
    }
    if (!grouped.has(key)) grouped.set(key, { color, textured, artRef, vertices: [] });
    grouped.get(key).vertices.push(...vertices);
  });
  let drew = false;
  if (!depthTest) {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    if (stats) stats.depthOverlayDrawCalls = (Number(stats.depthOverlayDrawCalls) || 0) + grouped.size;
  }
  grouped.forEach((group) => {
    const drawStartMs = adapter.now?.() || 0;
    if (group.textured) adapter.bindMeshTexture?.(renderer, group.artRef, stats);
    const didDraw = adapter.drawMeshVertices?.(renderer, group.vertices, {
      color: group.color,
      textured: group.textured,
      stats
    });
    if (stats && drawStartMs > 0) stats.webglUploadDrawMs = (Number(stats.webglUploadDrawMs) || 0) + Math.max(0, (adapter.now?.() || drawStartMs) - drawStartMs);
    if (didDraw && stats) {
      stats.drawCalls = (Number(stats.drawCalls) || 0) + 1;
      if (group.textured) stats.texturedDrawCalls = (Number(stats.texturedDrawCalls) || 0) + 1;
    }
    drew = didDraw || drew;
  });
  if (!depthTest) {
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }
  return drew;
}

export function addRaceThreeMeshGroups({
  renderer = null,
  meshes = [],
  textureWorldM = 2.5,
  stats = null,
  defaultDepthWrite = true,
  defaultPolygonOffset = true,
  renderOrder = 0,
  THREE = null,
  adapter = {}
} = {}) {
  if (!renderer?.scene || !Array.isArray(meshes) || !meshes.length || !THREE?.Mesh) return { polygons: 0, drawCalls: 0 };
  const grouped = new Map();
  meshes.forEach((mesh) => {
    if (!Array.isArray(mesh?.points) || mesh.points.length < 3) return;
    const artRef = String(mesh.artRef || '').trim();
    const textured = Boolean(mesh.textured && artRef);
    const color = mesh.color || '#ffffff';
    const key = `${textured ? 1 : 0}|${artRef}|${Number(mesh.textureWorldM || textureWorldM)}|${adapter.getMeshLiftM?.(mesh) || 0}`;
    if (!grouped.has(key)) grouped.set(key, { textured, artRef, color, meshes: [] });
    grouped.get(key).meshes.push(mesh);
  });
  let polygons = 0;
  let drawCalls = 0;
  grouped.forEach((group) => {
    const geometry = adapter.getMeshGeometry?.(group.meshes, { textureWorldM });
    if (!geometry) return;
    const texture = group.textured ? adapter.getTexture?.(renderer, group.artRef) : null;
    const material = adapter.getMaterial?.(renderer, {
      texture,
      depthWrite: defaultDepthWrite,
      polygonOffset: defaultPolygonOffset
    });
    if (!material) return;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder;
    renderer.scene.add(mesh);
    const triangleCount = Math.floor((geometry.getAttribute('position')?.count || 0) / 3);
    polygons += triangleCount;
    drawCalls += 1;
  });
  if (stats) {
    stats.polygons = (Number(stats.polygons) || 0) + polygons;
    stats.drawCalls = (Number(stats.drawCalls) || 0) + drawCalls;
    stats.threeWorldPolygons = (Number(stats.threeWorldPolygons) || 0) + polygons;
    stats.threeWorldDrawCalls = (Number(stats.threeWorldDrawCalls) || 0) + drawCalls;
  }
  return { polygons, drawCalls };
}
