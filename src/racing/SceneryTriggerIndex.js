// Scenery is static during a race. Index centers once, then expand contact
// bounds by the largest trigger radius so even oversized props are included.
const CELL_M = 32;
export function buildSceneryTriggerIndex(sprites, getRadius) {
  const cells = new Map();
  let radius = 0;
  sprites.forEach((sprite, order) => {
    const x = Number(sprite.x || 0), z = Number(sprite.z || 0);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    radius = Math.max(radius, getRadius(sprite));
    const key = `${Math.floor(x / CELL_M)},${Math.floor(z / CELL_M)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({sprite, order});
  });
  return {cells, radius, sprites};
}

export function querySceneryTriggers(index, points) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const point of points) {
    const x = Number(point.x || 0), z = Number(point.z || 0);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  if (minX === Infinity) return [];
  const reach = index.radius + .34; // Largest wheel/body probe radius.
  const x0 = Math.floor((minX - reach) / CELL_M), x1 = Math.floor((maxX + reach) / CELL_M);
  const z0 = Math.floor((minZ - reach) / CELL_M), z1 = Math.floor((maxZ + reach) / CELL_M);
  // Conservative fallback for malformed/unusually spread contact probes.
  if ((x1-x0+1)*(z1-z0+1)>4096) return index.sprites;
  const found = [];
  for (let x=x0; x<=x1; x++) for (let z=z0; z<=z1; z++) {
    const entries=index.cells.get(`${x},${z}`);
    if (entries) for (const entry of entries) found.push(entry);
  }
  // Preserve authored collision/pickup order; each center belongs to one cell.
  found.sort((a,b)=>a.order-b.order);
  return found.map(entry=>entry.sprite);
}
