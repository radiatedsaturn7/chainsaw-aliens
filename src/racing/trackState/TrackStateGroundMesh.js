import * as THREE from '../../vendorBridge/three.js';

// Track State cells are simulation samples, not screen-space tiles. Draw soft
// ground patches in the same camera/depth pass as the road and vehicle.
export function buildTrackStateGroundGeometry(cells, sampleHeight) {
  const positions = [];
  const colors = [];
  for (const cell of cells) {
    const weights = [
      [Math.max(cell.wetness || 0, cell.dampness || 0), [30, 112, 178]],
      [cell.standingWater || 0, [66, 151, 218]],
      [(cell.rubber || 0) * 0.9, [25, 24, 28]],
      [Math.max(cell.loose || 0, cell.marbles || 0), [157, 116, 65]],
      [cell.dirt || 0, [139, 101, 59]],
      [cell.mud || 0, [91, 66, 43]],
      [cell.snow || 0, [232, 242, 249]],
      [cell.ice || 0, [118, 224, 246]],
      [cell.oil || 0, [66, 35, 82]],
      [cell.debris || 0, [215, 77, 48]]
    ].map(([weight, color]) => [Math.max(0, Math.min(1, weight)), color]);
    const total = weights.reduce((sum, [weight]) => sum + weight, 0);
    if (!total || !Number.isFinite(cell.x) || !Number.isFinite(cell.z)) continue;
    const rgb = [0, 1, 2].map((channel) => weights.reduce(
      (sum, [weight, color]) => sum + weight * color[channel], 0
    ) / total / 255);
    const alpha = Math.min(0.32, 0.08 + Math.max(...weights.map(([weight]) => weight)) * 0.24);
    const point = (dx, dz) => {
      const x = cell.x + dx;
      const z = cell.z + dz;
      const height = sampleHeight?.(x, z);
      return [x, (Number.isFinite(height) ? height : Number(cell.elevationM || 0)) + 0.025, z];
    };
    const center = point(0, 0);
    const corners = [point(-0.5, -0.5), point(-0.5, 0.5), point(0.5, 0.5), point(0.5, -0.5)];
    for (let i = 0; i < 4; i += 1) {
      positions.push(...center, ...corners[i], ...corners[(i + 1) % 4]);
      colors.push(...rgb, alpha, ...rgb, 0, ...rgb, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeBoundingSphere();
  return geometry;
}
