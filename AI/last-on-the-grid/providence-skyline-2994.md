# Providence skyline 2994 art revision

Target: existing `providence` art, consumed by Studio Sprint and Studio Sprint Copy (also STUDIO_SPRINT_GRAPHIC_SETTINGS). `providenceGround` is not the skyline. The separate Providence Landmark Run uses `skybox-tower-hill` and is intentionally unchanged.

Original decoded 512×171 opaque source is preserved as `assets/campaign-art/skyboxes/providence-legacy.png`. New source is `providence-2994.png`, generated from the exact existing skyline reference, imported through `tools/art/import_campaign_art.py` using the new expanded-art registry entry. Runtime stays 512×171, nearest-neighbor, alpha 255 everywhere. No road geometry, lighting, camera offsets, race data, or other existing assets changed.

Art direction: keep the ultra-wide composition, familiar Providence building masses and stepped tower, orange sunset right, cloud palette, water/horizon height and edge continuity. Replace pristine architecture with centuries-old jagged tower tops, exposed floor ribs, dark broken windows, rust, roof vegetation and breached quay. A restrained blue machine service spine and relay imply machine survival without a bright human city. No text, logos, people, UI or changed weather.

Validation: source and final runtime pixels visually reviewed; dimensions/opaque alpha verified; second importer run produces identical document SHA256 `195cec215c42681b041cc1dbd8209944cca7469b8d7fa3fec16b903f4f0aa772`; git diff whitespace check passed.

Native-render diagnostic: read-only landmark-integration runtime fixture with exact replacement art response rendered Studio Sprint at 960×540 desktop and 390×844 handheld, using original lighting and camera. Art resolved at width 512. Default route horizon masks most building bodies (also a limitation of the existing composition/framing); this revision does not claim to solve skyline sightlines. No offset or scene change made to disguise it. This is a fixture diagnostic, not exact-branch full runtime acceptance. Parent integration should recheck live staging gameplay. Diagnostic script and frames retained under /tmp/providence-skyline.
