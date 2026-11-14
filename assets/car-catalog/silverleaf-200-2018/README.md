# Silverleaf 200 2018

Original, unbadged 2994 survivor inspired by the launch 2018 European W177 A 200 five-door hatchback, petrol FWD 7G-DCT. Mark's requested addition. Technical source URLs, unit conversions and uncertainty notes are in `import.json`. The nominal 17-inch wheel option is selected. No OEM logo or copied model/texture is used.

The 120 kW, 250 Nm plateau, 1332 cc displacement, 43 L fuel capacity, 1375 kg published mass, overall geometry and performance references are sourced. **Gear ratios/final drive and unsourced chassis, boost and shift parameters are explicit simulation estimates**, not an OEM-accurate transmission claim. The 8.0 second source is 0–62 mph; the separate 0–60 game scalar is estimated. No performance benchmark calibration claim is made.

`body.png` and `dashboard.png` are original generated RGBA sources. The body has eight directions, empty wheel wells and no baked wheels. Cockpit has a blank cluster; the game draws its shared WRX-size steering wheel and live speed/RPM/gear within the upper opening. Native Car Editor import is reproducible using `scripts/car-catalog-import.mjs`. Fixed-rear camera, automatic-only seven-speed configuration, surface-specific tire smoke/dust/spray and existing exterior gauges are retained. Global new-game transmission defaults are untouched. There is no separately authored exhaust-particle effect in this car.

## Local acceptance, 2026-11-14

- `node --test tests/unit/silverleafCatalog.test.js`: 3 passed (source anchors, native save/load round trip, real preview motion and four unoccluded tire contacts).
- Existing production Playwright exterior/cockpit test: passed, all eight direction screenshots personally inspected. No missing body, wheel mirroring, transparent gaps around side wheels or direction mismatch found at runtime scale.
- Existing preserved-cockpit test: desktop 1280×720 and handheld 390×844 passed and images inspected. Live numbers are visible through the shared wheel's upper arch and in the authored black instrument cluster.
- Initial combined browser run passed preview and handheld, but desktop browser context crashed at creation. Isolated desktop rerun passed. This is recorded, not hidden as an all-green combined run.
- Captures: `/tmp/qa-a200` (eight exterior views, native editor cockpit, handheld cockpit) and `/tmp/qa-a200-desktop` (desktop cockpit). Captures are local evidence, not shipped game assets.
- QA is against isolated local staging base `98d96b2b9c35fccb5d6191e933892af7f2433360`. No race, terrain, landmark or global scene changes. No remote push/merge performed.
