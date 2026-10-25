// Presentation-only index. Simulation cells and serialized snapshots stay unchanged.
const indexes = new WeakMap();
const bucketSize = 16;
const xOf = cell => Number(cell.worldX ?? cell.x);
const zOf = cell => Number(cell.worldZ ?? cell.z);
const within = (cell, bounds) => xOf(cell) >= bounds.minX && xOf(cell) <= bounds.maxX
  && zOf(cell) >= bounds.minZ && zOf(cell) <= bounds.maxZ;

function insert(index, key, cell) {
  const bucketKey = `${Math.floor(xOf(cell) / bucketSize)}:${Math.floor(zOf(cell) / bucketSize)}`;
  const previous = index.keyBuckets.get(key);
  if (previous && previous !== bucketKey) {
    const bucket = index.buckets.get(previous);
    bucket.delete(key);
    if (!bucket.size) index.buckets.delete(previous);
  }
  let bucket = index.buckets.get(bucketKey);
  if (!bucket) index.buckets.set(bucketKey, bucket = new Set());
  bucket.add(key);
  index.keyBuckets.set(key, bucketKey);
}

export function indexTrackStateCell(cells, key, cell) {
  const index = indexes.get(cells);
  if (index) {
    insert(index, key, cell);
    index.size = cells.size;
  }
}

export function queryTrackStateCells(cells, bounds = null) {
  if (!bounds) return [...cells.values()];
  if (![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)) {
    return [...cells.values()].filter(cell => within(cell, bounds));
  }
  let index = indexes.get(cells);
  if (!index || index.size !== cells.size) {
    index = { size: cells.size, buckets: new Map(), keyBuckets: new Map() };
    for (const [key, cell] of cells) insert(index, key, cell);
    indexes.set(cells, index);
  }
  const result = [];
  for (let z = Math.floor(bounds.minZ / bucketSize); z <= Math.floor(bounds.maxZ / bucketSize); z++) {
    for (let x = Math.floor(bounds.minX / bucketSize); x <= Math.floor(bounds.maxX / bucketSize); x++) {
      for (const key of index.buckets.get(`${x}:${z}`) || []) {
        const cell = cells.get(key);
        if (cell && within(cell, bounds)) result.push(cell);
      }
    }
  }
  return result;
}
