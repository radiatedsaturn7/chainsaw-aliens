import assert from 'node:assert/strict';
// Texture intent is independent of the saved physical cell. New visual assets
// must declare their actual substrate rather than inheriting the cell's ID.
export const terrainArtMaterials = Object.freeze({
 'ground-brown-dirt-v2':'dirt', 'ground-industrial-concrete-v2':'asphalt',
 'ground-industrial-rubble-v2':'gravel', 'ground-canyon-rock-v2':'gravel',
 'ground-gray-gravel-v2':'gravel', 'ground-red-gravel-v2':'gravel',
 'ground-desert-scrub-v2':'dirt', 'ground-alpine-rock-v2':'gravel',
 'ground-alpine-snow-granite-v1':'snow', 'ground-decomposed-granite-dirt-v1':'dirt',
 'ground-plains-snow-straw-v1':'snow', 'ground-prairie-grass-v1':'grass', 'ground-snow-chaparral-v1':'snow', 'ground-winter-snow-litter-v1':'snow', 'ground-temperate-grass-v1':'grass'
});
export function assertTerrainArtMaterial(cell, normalized) {
 for (const slot of ['artRef','roughArtRef']) {
  const expected=terrainArtMaterials[cell[slot]];
  if(expected) assert.equal(normalized.tileId,expected,`${slot} ${cell[slot]} must visually represent ${normalized.tileId}`);
 }
}
