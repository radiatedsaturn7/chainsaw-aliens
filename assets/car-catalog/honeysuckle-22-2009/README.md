# Honeysuckle 22 2009

Original cream/plum, badge-free 2994 roadster based on the stock US2009 Honda S2000 base six-speed manual. LHD, closed soft top, naturally aspirated RWD. This is neither the CR nor a film-car configuration. Fresh staging, current open PR titles/branches and the local source/alias catalog showed no playable equivalent. The S2000 film backlog entry is explicitly unimplemented and specifies no trim/year; it remains untouched.

## Exact trim and mechanical representation

[Honda's US2009 specification sheet](https://hondanews.com/en-US/releases/release-14bd1d0c629deb9de1f115004c34bc7f-2009-honda-s2000-specifications-and-features), dated August27,2008, was opened and read. Base-column selection preserves237hp at7800rpm,162lb-ft at6800rpm,2157cc,8000rpm redline,2864lb curb mass and50:50 distribution. The base has14.9 steering and215/45R17 front,245/40R17 rear tires; CR values are not mixed in.

Six primary ratios3.133/2.045/1.481/1.161/.942/.763,reverse2.800,physical final4.100 and secondary1.208 are sourced. The runtime has one final-reduction field: **effective4.9528 =4.100×1.208**, applied exactly once to both forward and reverse. This is not a claim that the factory ring-and-pinion is4.9528. Regression checks preserve the combined ratios. Inch dimensions and pound mass are converted explicitly. Axle-specific nominal tire geometry is retained through the native runtime rather than flattening staggered tires into one axle size.

## Estimates and limits

Auto Assist automates the six-speed; no factory automatic claimed. Differential coefficients approximate Torsen behavior, without exact torque-bias/VSA/ABS emulation. Limiter8200rpm,idle850,torque interpolation outside sourced anchors,CG,clearance,overhang split,body sections,aero,brake/spring/damper settings,tire pressure/grip and efficiency are gameplay estimates. Display240kph and5.8sec0–60 are estimates, not measured simulation results or manufacturer facts. Tire radius is nominal, not measured loaded radius. See research.json for the field-level source/estimate split.

## Original assets and local QA

Original body and dashboard PNGs were generated through supported image generation and copied unchanged. Eight authored directional sprites use measured transparent wheel openings, shared tires and native import serialization. The LHD dashboard has an empty instrument binnacle for live game gauges and the fitted shared steering wheel. Fixed-rear camera and existing surface smoke remain active. No film livery, manufacturer logo or placeholder art.

New branch derives from exact preserved Alder/Copperleaf snapshot b1347968d2818bca2afa29eb2634a2a05fb08761, on staging3aa27e7895f47eedcc579ee7c57e05567d728b3d. Existing maps/world documents and prior cars remain unchanged. No remote writes.

Reproducible targeted units: `node --test tests/unit/{briar2024,bramble,thornbill,celandine,fenfire,saffron,vervain,alder,copperleaf,honeysuckle}Catalog.test.js tests/unit/carCatalogImport.test.js tests/unit/catalogCameraSmoke.test.js` (49checks). Wheel coverage selects those ten names in `tests/unit/catalogWheelCoverage.test.js` (10checks). The source-import count invariant is74 with unique source IDs and exact source-to-published parity. Manifest command: `python tools/project_manifest.py --check --validate-assets`. Browser config and compositor case selection are preserved in `/tmp/honeysuckle-final.config.mjs` and `/tmp/honeysuckle-compositor.spec.js`; production captures are in `/tmp/honeysuckle-final-browser`.

Final local outcome:49 catalog/import/camera/smoke checks and10 wheel-coverage checks passed; manifest passed1543documents/16assets. Seven browser cases passed on this candidate:three-car eight-angle driving previews,Honeysuckle desktop and touch/mobile cockpit driving,and two compositor stress cases across ten roster changes. All eight Honeysuckle exteriors and both actual driving captures were visually inspected. These are production editor driving previews, not a full campaign endurance or measured acceleration test. The saved prior pair is unchanged, and fresh live staging still matches the stated base.
