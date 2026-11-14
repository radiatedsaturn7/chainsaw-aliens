# Regional repeating scenery fences

These are **editor-ready, solid scenic barriers**, not campaign placements.
Select Race editor → Paint → Fence → Art, choose a `fence-region-*` doodad,
then add path nodes. The existing fence system handles phase-continuous repeat
around corners and slopes; the full `widthM` is one texture repeat.

The original scenery assets and all saved race files are unchanged.

## Collision semantics

Every existing fence panel is a continuous solid box, including transparent
pixels. Gaps in an illustrated hedge, broken fence or facade are not driveable
openings. Do not place these across the road, junctions, driveways or escape
routes. Create separate paths leaving a real geometric gap for a driveable
opening. Use ordinary doodads for sparse or breakable individual vegetation.
Building rows are facades along a path, not volumetric buildings. Keep them far
enough off road to avoid revealing their thin depth; vary separate paths rather
than expecting different houses on every repeat.

## Art and import contract

`data/campaigns/america/regional-fences.json` is the curated kit. Source PNGs
live under `assets/campaign-art/regional-fences/`. True RGBA alpha, grounded
bottom, un-cropped full rectangular UV, no sky/UI. Organic strips opt in to
`fenceMirrorRepeat`: alternate tiles traverse UVs backward, meeting at the same
source edge without modifying the original PNG. Architectural rows never mirror;
their clear outer margins form repeated alleys. Those illustrated alleys are
still solid unless a real gap is left in the fence path.
Existing campaign import uses nearest-neighbor sampling, capped at 512 pixels.

Run `python tools/art/import_regional_fences.py` from the repository root.
It scopes the existing art importer to this kit, registers art and `isFence`
doodads, preserves unrelated invalid-source reports, and refuses modified
saved art or doodad targets. Re-running unchanged inputs is idempotent.

Do not run a campaign scatter/placement installer to expose this kit. The
manifest registration alone makes it available through the existing picker.

## Validation of the initial ten-tile kit

- Native Three renderer: all ten reviewed at desktop 960×540 and handheld
  390×844, using imported registered artwork and real fence placements.
- Legacy WebGL fallback: alternate mirrored UV traversal exercised in the same
  runtime fixture; hardwood desktop/handheld frames reviewed for continuity.
- Fixture is disposable and deliberately presents fences front-on. It never
  saves or changes a campaign race. Missing fixture terrain/sky textures can
  appear magenta and are not baked into the fence artwork.
- 16 focused unit tests cover fence editing, save/load, collision, repeat UVs,
  registered alpha artwork and dimensions. Source PNGs remain byte-identical.
- Mirroring solves edge jumps, not repetition: organic repeated patterns can
  still be recognizable. Use shorter separated paths and multiple variants.
