# Last on the Grid: editable Chapter One cutscenes

The canonical dialogue is in [Chapter One: The Things We Leave Behind](../../AI/last-on-the-grid/SCRIPTS/01-rhode-island-full-draft.md). Keep the two existing Tower Hill scenes and the race's fail-forward behavior intact. The six required story stops are Tower Hill, Blue Hills, Providence, RI 116, Putnam Pike, and Pachaug. Thompson Speedway and the Boston outskirts are optional cuts. The broader free-play catalog is not part of the scripted story map.

## Build the candidate

Use a new staging-derived checkout or a separately scoped draft; do not run this on the active release branch. Make sure code and all existing data are present. Put user-approved **generated game art only** in a separate folder. Do not put reference photos in the repository, manifest, or artwork directory. Story stills require at least 1280 × 720, wide aspect ratio 3:2 through 2:1 (16:9 preferred), clean subtitles area, and no baked text. The Movie Maker imports the original pixels with an editable 256 × 144 logical layout.

```sh
cp data/server-storage/files/manifest.json /tmp/region1-baseline-manifest.json
node tools/campaigns/build_region1_cutscenes.mjs --inventory
node tools/campaigns/build_region1_cutscenes.mjs --project . --stills /path/to/generated-stills --dry-run
node tools/campaigns/build_region1_cutscenes.mjs --project . --stills /path/to/generated-stills
python3 tools/campaigns/reseal_region1_stock_previews.py --source . --baseline-manifest /tmp/region1-baseline-manifest.json
node --test tests/unit/region1Cutscenes.test.js tests/unit/campaignProgression.test.js tests/unit/campaignPaths.test.js tests/unit/campaignWorldReveal.test.js tests/unit/campaignSaves.test.js tests/unit/raceFinishCutscene.test.js
npx playwright test tests/playwright/region1-cutscenes.spec.js tests/playwright/campaign-paths.spec.js --workers=1
```

Do not skip resealing the stock-preview stamps before any draft push with the new project index. The reseal retains the exact existing car, tire, art, and model bytes and updates only the two existing proof manifests and generated metadata stamps. Verify the file diff for scope. Use the regular full CI and review gates for release.

## Builder timeline

Movie Maker lists all 15 new project saves with `r1-` names. A before/after pair is attached to each of the seven non-opening story-map races. The inspection of the M3 is a standalone optional movie source; it is not forced onto the mandatory path. The M3 salvage discussion stays in Providence's exit cutscene. Interactive salvage/restoration, radio cues during live driving, and moving construction hazards are separate gameplay work, not simulated as cutscene mechanics. In-game radio dialogue not yet bound to live triggers is played during the corresponding exit's lead-in.

Optional stills that improve close-ups without changing authored timing or dialogue: `blue-hills-cait-close.png`, `providence-salvage-close.png`, `ri116-rob-close.png`, `ri116-cait-close.png`, `pachaug-cups-close.png`, and `boston-guitar-close.png`. If absent, the relevant wide shot stays in the timeline. The source screenplay can be compiled again before editing in Movie Maker; after hand-editing a generated save, back it up before recompiling.

Region 1 keeps Providence's named route, event identity, existing race content and world-map pin. The regional route puts it third instead of last. The Pachaug finale returns to the world map, triggering the new-road animation when New Hampshire first becomes available. Older saves that already unlocked New Hampshire keep it without being marked as having seen the new Pachaug scene.
