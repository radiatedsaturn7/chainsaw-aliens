# Selfheal 2005 — First Keys family minivan

Reference: stock **US 2005 Dodge Grand Caravan SE**, long wheelbase, gasoline 3.3-liter OHV V6, four-speed automatic, front-wheel drive. Basic cloth front buckets and removable second/third-row benches (seven seats). Not SE Plus, SXT 3.8, cargo van, short-wheelbase Caravan, standard Stow ’n Go or a Honda Odyssey. Optional roof rack deliberately absent.

## Independent scope and duplicate audit

Added locally after verified Marjoram/Camry commit `be48763d56da19933979c277b9dd7e9b20a753ee`. No shared UI, renderer, physics or editor changes. No remote publication or integration with the separate 184-car checkpoint. Baseline before this car: 178 non-system cars plus 3 templates; local result: 179 plus 3, not a combined count.

All manifest car documents, including compressed exports, and catalog provenance were searched for Grand Caravan/Caravan. No exact configuration existed. Existing Lungwort 2005 is the Honda Odyssey EX: 255 hp, 5AT, 4475 lb, eight seats. Selfheal is 180 hp, 4AT, provisionally 3960 lb, seven seats, narrower stock tires and different suspension parameters. Its beige rounded long-body silhouette, plain gray wheel covers, gray column-shift dashboard and open lower bin are distinct from Lungwort. Selfheal does not overlap the seven unpublished aliases or pending Woodbetony.

## Sources and explicit uncertainty

- [Dodge factory specifications and equipment tables](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2005CaravanGrandCaravanSpecs.pdf): printed pp19–24, Grand Caravan feature tables pp13–16. 3301 cc; 180 hp at5000 rpm; 210 lb-ft at4000; maximum5600 rpm; 4AT ratios2.84/1.57/1/.69; **3.62 final drive**. Published2.49 is overall top gearing, not final drive.
- [US factory sales brochure](https://www.auto-brochures.com/makes/Dodge/Grand%20Caravan/Dodge_US%20GrandCaravan_2005.pdf): base SE benches,15-inch steel wheels/covers, optional rack and trim distinctions.
- [Other factory preliminary table](https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/specs/2005MinivanSpecs.pdf): conflicts on SE mass,4146 lb versus3960 lb in the more specific factory sheet. **3960 lb is selected provisionally**, not claimed as measured mass for this exact rackless bench-seat configuration. Both figures are retained in provenance.

Factory published height1.750 m includes a roof rack; rackless1.73 m is an estimate. Source ground-clearance inch/mm entries are internally rounded;138 mm used. CG, body subdivisions, suspension rates, tire coefficients/pressures, converter model, reverse ratio2.21, torque interpolation away from peaks, shift logic,108 mph and11.5-second targets are simulation estimates, not calibrated road tests. No passenger-load or seat-folding simulation. Manual Assist is a game control mode using the same4AT ratios, not a factory manual.

## Original art and import

Built-in image generation produced original transparent eight-view body, LHD dashboard, and eight-view ordinary gray wheel-cover/tire art. PNGs are retained unchanged. Native `normalizeTireSheetOpacity` solidifies only near-opaque250–254 alpha on the wheel import copy; this avoids the native opaque-region fitter selecting isolated specks. The new regression test requires substantial tread and hubcap texture regions. No shared art was edited.

Dashboard has blank left cluster, column selector, no painted steering wheel/needles, transparent windshield. Live speed/RPM/gear/fuel are fitted to measured dashboard pixels, with shared animated steering wheel below. Wiper mounts favor instrument visibility on desktop/handheld; inherited viewport-relative desktop floating placement is not corrected in shared code.

`build.mjs` is a car-scoped wrapper around existing production importers and serializers. It adds the original wheel document alongside body/dashboard and refuses overwriting existing catalog entries. Wheel-well anchors were measured from original body alpha, then checked against the production rig without changing physical tire radius.

## Validation

- Nine focused specifications, native roundtrip, original hash/frame identity, duplicate/roster identity, launch/contact, cockpit bounds, Odyssey distinction, tire texture-fit and wheel-well coverage tests pass.
- Eighteen Camry preservation and shared importer/roundtrip tests pass.
- Five vehicle-dynamics replay smoke cases pass.
- Full manifest/asset validation passes:2090 documents,16 assets, manifest current.
- Final serialized browser run: **5 passed in 3.9 minutes**, including production preview, desktop/handheld direct input drives, and actual picker-to-race keyboard/touch drives.
- Final picker drive samples: desktop 6.99 m/s and 13.30 m traveled; handheld 5.40 m/s and 9.60 m. Both continued accelerating with changing live RPM and no page errors.
- Final exterior side/diagonal images visually inspected: original gray wheel covers render correctly and fit the measured wheel wells. Actual desktop/390×844 handheld cockpit screenshots inspected: speed, RPM, gear and fuel clear, moving wheel below cluster.
- Combined final focused/regression command: **27 passed** (9 new-car checks plus18 Camry/importer preservation checks).
- Browser uses official Google Chrome for Testing headless shell157.0.8103.78 with `chromiumSandbox:true`, no security changes. Run serialized, without simultaneous browser processes or bulky trace snapshots, following the diagnosed Camry memory-pressure symptom.

```sh
node --test tests/unit/selfhealCatalog.test.js tests/unit/selfhealWheelCoverage.test.js
node --test tests/unit/marjoramCatalog.test.js tests/unit/marjoramWheelCoverage.test.js tests/unit/carCatalogImport.test.js tests/unit/catalogRoundtripDefaults.test.js
npm run test:vehicle-dynamics:smoke
python tools/project_manifest.py --check --validate-assets
npx playwright test tests/playwright/selfheal-preview.spec.js tests/playwright/selfheal-driving.spec.js tests/playwright/selfheal-static-picker.spec.js --workers=1 --trace=off
```

Full project/CI suite not run. No production deployment or publication authorized.
