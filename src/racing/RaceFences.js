import { normalizeRaceDoodadDocument } from './raceDoodads.js';

// Persist ordinary scenery placements so artwork, Undo, save/load, and both
// renderers use the same geometry. A fence ID groups one drawn stroke.
export function buildRaceFencePlacements(points, definition, { id = 'fence', ref = '' } = {}) {
  const doodad = normalizeRaceDoodadDocument(definition);
  if (!doodad.isFence || !Array.isArray(points)) return [];
  const repeat = Math.max(0.1, doodad.widthM);
  const placements = [];
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (![a?.x, a?.z, b?.x, b?.z].every(Number.isFinite)) continue;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    let at = 0;
    while (at < length - 0.00001) {
      const phase = ((traveled % repeat) + repeat) % repeat;
      const u0 = phase < 0.00001 || repeat - phase < 0.00001 ? 0 : phase / repeat;
      const width = Math.min(length - at, repeat * (1 - u0));
      const fraction = (at + width / 2) / length;
      placements.push({
        id: `${id}:${placements.length}`, fenceId: id, presetId: 'doodad', doodadRef: ref,
        label: doodad.name, artRef: doodad.artRef, x: a.x + dx * fraction, z: a.z + dz * fraction,
        yaw: Math.atan2(dz, -dx), widthM: width, heightM: doodad.heightM,
        fenceU0: u0, fenceU1: u0 + width / repeat, solid: true, state: 'standing',
        previewDoodad: { ...doodad, itemType: 'scenery', widthM: width, hitboxWidthM: width, hitboxHeightM: doodad.heightM, rules: [],
          defaultRule: { ...doodad.defaultRule, behavior: 'collide' } }
      });
      at += width; traveled += width;
    }
  }
  return placements;
}
