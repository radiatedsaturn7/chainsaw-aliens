# Campaign artwork source PNG library

134 additive source PNGs for Last on the Grid, covering the requested campaign environment list. Existing saved art, races, gameplay, and smoke/spray effects are unchanged. This is the artwork handoff for Codex to import and implement.

## Start here

`inventory.json` is the authoritative file list. It includes stable IDs, relative paths, dimensions, alpha information, sizes, SHA-256 hashes, and an explicit reusable kit for each of the eleven regions. Import under new IDs rather than replacing the current art.

- `roads/`: 13 asphalt, dirt, gravel, snow, and slush surfaces.
- `ground/`: 12 ground materials and 3 shoulder transitions. Use the ten `-v2.png` ground materials listed in the inventory; rejected first attempts are not shipped.
- `vegetation/`: 18 tree, bush, log, and stump variants.
- `rocks/`: 11 rock/boulder/outcrop variants.
- `roadside/`: 23 barriers, fences, signs, markers, poles, props, and abandoned cars.
- `regions/`: 46 additional landmarks/supporting props across all eleven locations.
- `decals/`: 8 overhead transparent surface-detail patches.

The requested short retaining-wall section reuses `regions/laurel-highlands/stone-retaining-wall.png`. Tower Hill reuses the four existing houses and the shared wooden utility pole. Mount Washington reuses alpine outcrops and the snow-depth pole. Laurel's hardwoods are the three shared leafless trees. These mappings are explicit in the inventory, so duplicate PNGs are unnecessary.

## Laurel Highlands first handoff

- `roads/road-asphalt-patched.png`
- `ground/ground-frozen-forest.png`
- `ground/ground-snow-dead-grass.png`
- `vegetation/leafless-tree-01.png` through `03`
- `regions/laurel-highlands/forest-cabin.png`
- `regions/laurel-highlands/stone-retaining-wall.png`
- `regions/laurel-highlands/park-sign.png`

Shared frozen bushes, gray rocks, barriers, markers, and signs can expand the initial kit. The initial nine-file validation record remains in the Laurel folder.

## Important import limits

These are original built-in image-generator outputs. Native resolutions are retained, not falsely labelled as 512×512 exports. Most textures are 1254×1254 and sprite dimensions vary. Choose appropriate import dimensions and scaling for the game; do not load all high-resolution sources as runtime assets indiscriminately. The originals total approximately 302 MB.

**Textures are not certified seamless.** Prompts requested repetition, but exact edge continuity is not guaranteed. Check repeated previews and finish edges before production integration. Ground materials should repeat on both axes; asymmetric shoulder transitions repeat longitudinally only. Road image height runs along the road: tire tracks and center markings are vertical.

Sprites and decals have genuine alpha transparency. Some have faint peripheral pixels or more transparent padding than ideal, especially narrow poles. Adjust anchors and padding during import. Meaningful silhouettes were inspected for cropping. Do not confuse zero-alpha RGB colors shown by some previewers with an opaque background.

Art does not add physical ruts, collision, bridges, or overhead structures. The Ohio bridge and mesa/mountain silhouettes are background scenery, not drive-through geometry. Walls and buildings still need appropriate geometry/collision setup. Painted lighting is restrained, but test at in-game scale, at night, and in weather.

## Validation and provenance

Per-family `provenance*.json`, `generation.json`, and QA files record prompts and checks. Reference artwork was decoded from the existing `house1`, `tree`, `frozenbush`, and `asphaltRoad` documents for style matching. The new art expands rather than replaces those assets.

Run from repository root, with Pillow installed:

    python tools/art/build_campaign_inventory.py
    python tools/art/validate_campaign_pngs.py

Checks decode actual PNG bytes and record dimensions, hashes, alpha extrema, and visible bounds. Visual QA checked content, orientation, silhouettes, and relevant sign spelling. `npm run test:campaign-loading` passed 25/25 existing races. This is not a runtime visual/integration test of the new artwork; importing and placing it remains the implementation step.
