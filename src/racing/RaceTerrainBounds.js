// Survey sizes are unbounded. Never spread their coordinates into function
// arguments: mobile JavaScript stacks can overflow on even 20,000 cells.
export function getRaceTerrainBounds(entries, cellSizeM = 1) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let count = 0;
  for (const [key] of entries) {
    const [x, z] = String(key).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    count++;
  }
  return count ? {
    minX: minX * cellSizeM, maxX: (maxX + 1) * cellSizeM,
    minZ: minZ * cellSizeM, maxZ: (maxZ + 1) * cellSizeM
  } : null;
}
