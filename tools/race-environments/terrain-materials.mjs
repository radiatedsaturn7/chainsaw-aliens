import assert from 'node:assert/strict';
// Texture intent is independent of the saved physical cell. New visual assets
// must declare their actual substrate rather than inheriting the cell's ID.
export const terrainArtMaterials = Object.freeze({
 'ground-frosted-grass-v1':'grass', 'ground-clean-snow-v2':'snow', 'ground-dirty-snow-v2':'snow',
 'ground-frozen-forest':'dirt', 'environment-v1-ground-ohio-wet-leaf-litter':'dirt',
 'environment-v1-ground-finnish-boreal-verge':'grass', 'environment-v1-ground-dormant-prairie':'grass', 'environment-v1-ground-sebring-olive':'grass', 'road-slush':'slush',
 'ground-volcanic-cinder-v1':'gravel', 'ground-volcanic-snow-v1':'snow',
 'ground-brown-dirt-v2':'dirt', 'ground-industrial-concrete-v2':'asphalt',
 'ground-industrial-rubble-v2':'metal', 'ground-canyon-rock-v2':'gravel',
 'ground-gray-gravel-v2':'gravel', 'ground-red-gravel-v2':'gravel',
 'ground-desert-scrub-v2':'dirt', 'ground-alpine-rock-v2':'gravel',
 'ground-alpine-snow-granite-v1':'snow', 'ground-decomposed-granite-dirt-v1':'dirt',
 'ground-plains-snow-straw-v1':'snow', 'ground-prairie-grass-v1':'grass', 'ground-snow-chaparral-v1':'snow', 'ground-winter-snow-litter-v1':'snow', 'ground-patchy-snow-leaf-v1':'snow', 'ground-temperate-grass-v1':'grass'
});
export function assertTerrainArtMaterial(cell, normalized) {
 for (const slot of ['artRef','roughArtRef']) {
  if(!cell[slot]) continue;
  const expected=terrainArtMaterials[cell[slot]];
  assert.ok(expected,`Unclassified terrain art: ${cell[slot]}`);
  if(expected) assert.equal(normalized.tileId,expected,`${slot} ${cell[slot]} must visually represent ${normalized.tileId}`);
 }
}
