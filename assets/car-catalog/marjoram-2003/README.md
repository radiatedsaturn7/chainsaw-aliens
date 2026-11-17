# Marjoram 2003: independent First Keys candidate

Reference: stock mainland-US 2003 Toyota Camry LE 2.4 four-cylinder with optional four-speed ECT-i automatic. Not SE, V6, XLE or Solara. Exact source facts and explicit simulation estimates are in `import.json`; U241E gearing is provisional adjacent-generation factory evidence rather than certified exact-year data.

## Scope and provenance

Created independently on staging `5051689269a83ea1c4b539285e76c1f6a8a0c64a`, not on the separate 184-car checkpoint. That base contains 177 non-system cars plus three system templates. With this candidate the local manifest has 178 non-system cars plus those templates, but Marjoram is **independently browser-verified for keyboard and handheld touch driving**. Do not add it to another branch's count before integration and duplicate checks.

Audited current car provenance and asset import records for Camry/Accord. The only preexisting Camry string is Buckwheat's adjacent-year Toyota technical-document URL; Buckwheat is a Tacoma. Marjoram has no exact-trim duplicate. Alias does not overlap Rockrose1994, Hawkbit1999, Pennycress2001, Melilot1993, Milkwort1999, Centaury1983, Cornsalad2005 or pending Woodbetony2002.

Original built-in generated body and dashboard PNGs were visually inspected. Eight 4x2 exterior views have transparent wheel wells; dashboard has transparent windshield, no painted steering wheel or gauges. Measured anchors fit shared wheel sprites without changing physical tire radius. Blank left cluster is fitted with live speed, RPM, gear and fuel widgets; shared steering wheel is separate. Original generation outputs remain outside this repository.

## Validation

- Focused specification, native roundtrip, distinct art/hash, roster identity, low-speed launch and wheel coverage tests pass.
- Shared importer/legacy-roundtrip tests: 11 pass.
- Vehicle-dynamics smoke command completed successfully.
- Full manifest/asset validation: 2086 documents, 16 assets, current manifest.
- Browser startup was recovered with official Google Chrome for Testing headless shell 157.0.8103.78, ZIP integrity checked, launched with `chromiumSandbox:true`. No browser security settings changed. Earlier bundled Chromium download was truncated and system Chromium hit singleton socket EPERM.
- Production editor preview and desktop real-picker/keyboard movement tests pass. Desktop reached 8.02 m/s and moved 11.78 m at the first motion sample; live RPM and speed changed without page errors.
- Final car-only wiper mount y=0.24 keeps speed, RPM, gear and fuel unobstructed on desktop and 390×844 handheld. Handheld park position fits the windshield base; desktop wipers retain an inherited floating placement. Shared renderer was not changed.
- Final direct-drive keyboard and touch tests: 2 passed. Desktop first motion sample 7.91 m/s and 11.76 m; handheld 8.26 m/s and 11.83 m. Both live cockpit screenshots inspected with unobstructed instruments and changing readings.
- Isolated handheld actual-picker-to-race test: passed in 2.2 minutes, retaining the 90-second startup assertion. Touch reached 8.70 m/s and moved 12.86 m, then live cockpit reached 14.60 m/s and 5286 RPM, with no page errors.

```sh
node --test tests/unit/marjoramCatalog.test.js tests/unit/marjoramWheelCoverage.test.js
node --test tests/unit/carCatalogImport.test.js tests/unit/catalogRoundtripDefaults.test.js
python tools/project_manifest.py --check --validate-assets
npm run test:vehicle-dynamics:smoke
npx playwright test tests/playwright/marjoram-static-picker.spec.js tests/playwright/marjoram-driving.spec.js --workers=1 --reporter=line
```

## Diagnosed retry and remaining limitations

The first combined browser run had two passes and one handheld startup timeout. A diagnostic retry retained a trace whose final image shows the countdown reaching 2, followed by `Target crashed`. This was not evidence of a permanently stuck countdown. The picker had hydrated 89 cars. Concurrent browser comparisons and trace capture may have increased memory pressure; that cause is an inference. Running handheld alone without trace snapshots passed without changing readiness, movement or input assertions. Run browser cases serially in this constrained environment.

An unchanged Woodrush desktop/handheld driving comparison passed both functional tests. Its desktop image also shows parked wipers floating in the windshield. Woodrush, Sandwort, Knapweed and Pearlwort all use viewport-based mounts. No general fitted-dashboard workaround was found, so Marjoram prioritizes clear instruments at both viewports. Separate Woodrush preview timed out; no shared fix or project-wide browser guarantee is claimed.

Eight-angle editor images were generated and side/diagonal wheel fit inspected. Full project/CI suite has not been run. This local result does not authorize publication or integration with the separate 184-car checkpoint.

The local browser command uses an external temporary Playwright config extending the repository config, with the official shell executable and `chromiumSandbox:true`, and runs both `marjoram-static-picker.spec.js` and `marjoram-preview.spec.js`. Local-only server: `node tools/playwright/static-server.cjs`, verified URL `http://127.0.0.1:4173/index.html?hideFullscreenForTesting`. No public preview or publication. Official version metadata: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json .
