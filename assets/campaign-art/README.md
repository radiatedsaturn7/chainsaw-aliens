# Campaign artwork source PNGs

Additive artwork library for Last on the Grid. Existing saved art and race documents are unchanged. These PNGs are source artwork for Codex to import into the game's art storage and reference from doodads, surfaces and races.

## Laurel Highlands first delivery

- `roads/road-asphalt-patched.png`: frost-damaged patched pavement, vertical center markings.
- `ground/ground-frozen-forest.png`: frosted leaves and needles.
- `ground/ground-snow-dead-grass.png`: patchy snow over dead grass.
- `vegetation/leafless-tree-01.png` through `03`: bare hardwood variants.
- `regions/laurel-highlands/forest-cabin.png`: signature cabin landmark.
- `regions/laurel-highlands/stone-retaining-wall.png`: short scenery section.
- `regions/laurel-highlands/park-sign.png`: regional roadside sign.

Additional vegetation and rocks are shared across regions. Consult batch generation manifests for completed files.

## Import and validation notes

Generated using the built-in image generator, with the existing `house1`, `tree`, `frozenbush` and `asphaltRoad` saved artwork as visual references. Preserve existing assets; import these under new IDs. Sprite alpha is intentional. Original generator resolution is preserved rather than pretending these are 512-pixel exports. PNG dimensions and alpha are recorded in the validation inventory.

Texture prompts request seamless repetition, but exact edge continuity is **not guaranteed** and these originals are **not certified seamless**. Check a repeated preview and finish seams before production integration. Road image height runs along the road; do not rotate tire tracks/markings sideways. The existing road assets are 512×512, so import sizing must be considered. Use subtle road lighting in-game.

Art alone does not add physical ruts, collision, or drivable bridges. Short walls and structures require appropriate geometry/collision setup. This delivery does not change gameplay, manifests in server storage, or race placement. Codex can implement independently without conflicts in those files.
