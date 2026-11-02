const buffers = new WeakMap();
// Reuse the placement-list backing store during play. Still inspect authored
// state every frame so edits, pickups and destroyed props disappear immediately.
export function getVisibleRaceDoodadSprites(scenery, session) {
  let buffer = session && buffers.get(session);
  if (!buffer) {
    buffer = {sprites: [], hidden: new Set()};
    if (session) buffers.set(session, buffer);
  }
  const {sprites, hidden} = buffer;
  hidden.clear();
  for (const id of session?.removedSceneryIds || []) hidden.add(id);
  for (const id of session?.flattenedSceneryIds || []) hidden.add(id);
  let count = 0;
  for (const sprite of scenery) {
    if (sprite && sprite.state !== 'removed' && sprite.state !== 'flattened'
      && !hidden.has(sprite.id) && (sprite.presetId === 'doodad' || sprite.doodadRef || sprite.previewDoodad)) {
      sprites[count++] = sprite;
    }
  }
  sprites.length = count;
  return sprites;
}
