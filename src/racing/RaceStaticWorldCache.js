const fields = ['surfaceRevision','terrainCells','textureScale','terrainArtwork','artworkReady',
  'texturesEnabled','sunShading','tileRevision','textureFilter','trackMeshes'];
export function staticWorldKeyChanges(previous, next) {
  if (!previous) return ['initial'];
  const before = previous.split('::three-static::'), after = next.split('::three-static::');
  return fields.filter((field, index) => before[index] !== after[index]);
}
