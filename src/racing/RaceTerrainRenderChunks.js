// Partition only the rendered terrain. Physics retains the complete canonical
// surface. Whole triangles stay together, so chunk culling cannot cut seams.
export function partitionRaceTerrainForRendering(packed, {chunkSizeM = 512, minTriangles = 4096} = {}) {
  const positions = packed?.positions;
  if (!positions?.length || positions.length / 9 < minTriangles) return [packed];
  const size = Math.max(40, Number(chunkSizeM) || 512);
  const buckets = new Map();
  for (let offset = 0; offset < positions.length; offset += 9) {
    const x = (positions[offset] + positions[offset + 3] + positions[offset + 6]) / 3;
    const z = (positions[offset + 2] + positions[offset + 5] + positions[offset + 8]) / 3;
    const key = `${Math.floor(x / size)},${Math.floor(z / size)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(offset / 9);
  }
  const artByTriangle = new Map();
  for (const group of packed.artGroups || []) {
    for (let vertex = group.start; vertex < group.start + group.count; vertex += 3) artByTriangle.set(vertex / 3, group.artRef);
  }
  return [...buckets.values()].map(indices => {
    const chunk = {...packed, triangleCount: indices.length, artGroups: []};
    for (const [name, stride] of [['positions',9],['colors',9],['textureColors',9],['uvs',6]]) {
      const source = packed[name];
      if (!source?.length) continue;
      const output = new Float32Array(indices.length * stride);
      indices.forEach((index, target) => output.set(source.subarray(index * stride, (index + 1) * stride), target * stride));
      chunk[name] = output;
    }
    indices.forEach((index, target) => {
      const artRef = artByTriangle.get(index);
      if (!artRef) return;
      const previous = chunk.artGroups.at(-1);
      if (previous?.artRef === artRef && previous.start + previous.count === target * 3) previous.count += 3;
      else chunk.artGroups.push({artRef, start: target * 3, count: 3});
    });
    return chunk;
  });
}
