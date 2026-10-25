// Subdivide decals in world space, then sample the same surface used by cars.
// Texture coordinates remain attached to the authored footprint on slopes.
export function buildRaceDecalTriangles(decal, sampleSurface) {
  const width = Math.max(0.25, Number(decal.widthM) || 3.2);
  const height = Math.max(0.25, Number(decal.heightM) || width);
  const cols = Math.min(128, Math.max(1, Math.ceil(width / 0.5)));
  const rows = Math.min(128, Math.max(1, Math.ceil(height / 0.5)));
  const yaw = Number(decal.rotation) || 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const vertices = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    let u = col / cols, v = row / rows;
    if (decal.shape === 'oval') {
      const a = u * 2 - 1, b = v * 2 - 1;
      u = (a * Math.sqrt(1 - b * b / 2) + 1) / 2;
      v = (b * Math.sqrt(1 - a * a / 2) + 1) / 2;
    }
    const x = Number(decal.x || 0) - c * (u - 0.5) * width + s * (v - 0.5) * height;
    const z = Number(decal.z || 0) + s * (u - 0.5) * width + c * (v - 0.5) * height;
    vertices.push({ x, z, elevation: Number(sampleSurface({ x, z })?.elevation || 0), u, v: 1 - v, roadDeckElevation: true });
  }
  const triangles = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = row * (cols + 1) + col, b = a + 1, d = a + cols + 1, c = d + 1;
    triangles.push([vertices[a], vertices[b], vertices[c]], [vertices[a], vertices[c], vertices[d]]);
  }
  return triangles;
}
