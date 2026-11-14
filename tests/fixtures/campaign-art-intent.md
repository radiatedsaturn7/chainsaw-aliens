# Campaign artwork validation intent

The default is actual placement in an enabled campaign event. Campaign menu generation defines that event set; registration, preloading, disabled events, and unrelated library races do not establish campaign use. Removed scenery does not count. Existing deferred authoring entries and the pre-existing ground-snow-dead-grass exception remain unchanged by this repair.

`campaign-art-intent.json` records the approved editor-library scope: the ten import-only regional fence definitions and the Providence editor skybox. Source identity must match the import ledger. Unit validation loads their saved artwork and definitions. The Campaign Artwork browser command also opens each through the real Race Editor project picker, hydrates the saved art, and checks that it renders nontransparent pixels. Missing editor assets fail; editor intent is not a generic unused-art exemption.

The single configured-unused diagnostic is road-snow-patchy in Pikes Peak Highway's snow mapping. It emits `UNUSED CONFIGURED ART` while no actual campaign segment uses it. Removing its configuration without resolving the diagnostic is an error. Additional configured-unused refs are rejected. This diagnostic is intentionally visible and nonblocking under the approved policy; it is not proof that the snow texture is currently used.

The expanded-art fence gate checks complete saved paths against runtime solid colliders, including minimum collider widths, overlap padding, thickness, and flared path points. Every panel must match the path rebuild. Continuous segment-to-oriented-rectangle distance checks the entire road sweep, including authored start/finish continuations. The larger half-width per road span conservatively covers width changes. Any contact/intrusion fails. Network-road fences fail closed pending a network-specific proof. Non-fence setbacks and unrelated gates retain their existing requirements.

Run the unchanged workflow commands from the repository root:

```
npm ci
node --test tests/unit/campaignArtIntegration.test.js tests/unit/americaCampaign.test.js tests/unit/raceTerrainTextureBlend.test.js tests/unit/raceRoadTextures.test.js tests/unit/raceDecals.test.js tests/unit/raceVisualFx.test.js
CI=true npx playwright test tests/playwright/race-road-textures.spec.js --workers=1 --reporter=line
```

This repair changes validation only; it does not place, remove, move, brighten, or alter any game asset.
