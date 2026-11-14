# Providence skyline 2994 art revision

Target: existing `providence` art, consumed by Studio Sprint and Studio Sprint Copy (also STUDIO_SPRINT_GRAPHIC_SETTINGS). `providenceGround` is not the skyline. The separate Providence Landmark Run uses `skybox-tower-hill` and is intentionally unchanged.

Original decoded 512×171 opaque source is preserved as `assets/campaign-art/skyboxes/providence-legacy.png`. New source is `providence-2994.png`, generated from the exact existing skyline reference, imported through `tools/art/import_campaign_art.py` using the new expanded-art registry entry. Runtime stays 512×171, nearest-neighbor, alpha 255 everywhere. No road geometry, lighting, camera offsets, race data, or other existing assets changed.

Art direction: keep the ultra-wide composition, familiar Providence building masses and stepped tower, orange sunset right, cloud palette, water/horizon height and edge continuity. Replace pristine architecture with centuries-old jagged tower tops, exposed floor ribs, dark broken windows, rust, roof vegetation and breached quay. A restrained blue machine service spine and relay imply machine survival without a bright human city. No text, logos, people, UI or changed weather.

Validation: source and final runtime pixels visually reviewed; dimensions/opaque alpha verified; second importer run produces identical document SHA256 `195cec215c42681b041cc1dbd8209944cca7469b8d7fa3fec16b903f4f0aa772`; git diff whitespace check passed.

Native-render diagnostic: read-only landmark-integration runtime fixture with exact replacement art response rendered Studio Sprint at 960×540 desktop and 390×844 handheld, using original lighting and camera. Art resolved at width 512. Default route horizon masks most building bodies (also a limitation of the existing composition/framing); this revision does not claim to solve skyline sightlines. No offset or scene change made to disguise it. This is a fixture diagnostic, not exact-branch full runtime acceptance. Parent integration should recheck live staging gameplay. Diagnostic script and frames retained under /tmp/providence-skyline.

## Visibility follow-up (preferred second revision)

Preserved first draft in commit 61e9d36. Renderer anchors the image using `horizon - height * .56`, so only roughly the top 56% clears the terrain horizon with zero vertical offset. First artwork's skyline was too low. Used a second built-in imagegen edit with the first runtime image as reference: move entire city and sunset/water horizon upward toward 52% image height, towers into 15–25% and low roofs into 35–45%, extend reflective foreground water below, preserve ruin/pixel palette and horizontal masses. No code, race settings, camera or lighting changes.

The second asset was imported and actual same-fixture default desktop/handheld frames reviewed. Ruined skyline and sparse machine structures now visibly clear the terrain horizon in both views. Mobile's native sepia/filter and HUD remain unchanged. This solves the visibility issue through artwork only; still a fixture diagnostic rather than exact latest-staging full runtime validation. Before/after are `/tmp/providence-skyline/before-{960,390}.png` and `native-{960,390}.png`. Source is the current `assets/campaign-art/skyboxes/providence-2994.png`; original draft remains recoverable from prior commit.
