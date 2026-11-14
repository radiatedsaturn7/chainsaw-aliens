# Saffron 135 2010

Original badge-free 2994 three-door hatch based on **UK 2010 Fiat Punto Evo Sporting 1.4 MultiAir Turbo 135, RHD, five-speed manual**. Mark identified a Punto in Forza Motorsport 4; the exact screenshot trim was not established. This UK trim is the documented catalog choice. It is not the 105 six-speed, an Abarth, a five-door or a Dualogic model.

## Primary sources and units

[Fiat UK launch press kit, 21 January 2010](https://www.media.stellantis.com/uk-en/fiat/press/new-fiat-punto-evo-evolution-of-the-species), including its full technical/equipment/price tables, establishes the Sporting three-door: 1,155 kg DIN, 1,368 cc, 99 kW at 5,000 rpm, 206 Nm at 1,750 rpm, 2,510 mm wheelbase, 205/45 R17 and five forward gears. Length/width/height are 4,065/1,687/1,490 mm, tracks 1,473/1,466 mm.

[Fiat manufacturer technical sheet, 18 January 2010](https://www.media.stellantis.com/uploads/es/ES/2010/FIAT/SPECIFICATIONS/MODELS/PUNTO_EVO/100126_F_Fichas_Punto.pdf), page 2, was rendered and visually inspected. Its Turbo 135 column corroborates those main values and five gears, distinctly separate from the 105's six. UK Sporting equipment takes precedence over Spanish trim/tire alternatives.

The UK text labels 135 as bhp, while the SI 99 kW and Spanish 135 CV column indicate metric marketing power. The simulation uses 99 kW converted to approximately 132.76 mechanical hp, and 206 Nm converted to lb-ft. Marketing name remains 135. Native editor serialization rounds the scalar display values to 133 hp/152 lb-ft; the authored torque curve retains exact SI-converted anchors.

## Explicit gearing uncertainty

Only the **five-speed count** is verified. No credible exact-UK-trim final-drive evidence was established. Forward ratios 3.909/2.158/1.480/1.121/0.897, reverse 3.818 and final drive **3.563 are gameplay estimates**, not certified factory values. A third-party other-market transcription conflicts with this ratio family; it was not promoted to exact-trim evidence. `gearingStatus` records the limitation in the import and published car provenance, with a regression test to retain it.

Auto Assist automates the modeled five-speed manual for gameplay. It does not claim this trim had a factory automatic or Dualogic. Manual remains selectable.

Other estimates are detailed in `research.json`: idle/redline/limiter, off-anchor torque curve, front weight fraction, clearance/CG/overhang split, steering, alignment, suspension/brakes/aero, tire pressures, grip and driveline efficiency. Manufacturer 127 mph is a display target; estimated 8.2-second 0–60 is kept separate from sourced 8.5-second 0–62. Neither is calibrated game performance. Factory start-stop, MultiAir valve events, City steering and hill-holder are not separately simulated.

## Original art and verification

Original ochre/plum/ivory pixel artwork was generated using supported image_gen, with no badges, logos or copied film/game livery. The eight body views and RHD dashboard retain original PNG bytes through the native importer. Shared tire art uses individually measured wheel openings; shared steering wheel and runtime gauges fit the right binnacle. Fixed rear camera and surface-sensitive smoke are retained. No existing car or map/lighting/prop files changed.

Checks:

```
node --test tests/unit/saffronCatalog.test.js tests/unit/carCatalogImport.test.js
node --test --test-name-pattern=Saffron tests/unit/catalogWheelCoverage.test.js
```

Browser cases use the real editor's production simulation and renderer: eight-angle preview, desktop and touch/mobile driving cockpit, plus production compositor checks at 1280×720 and 390×844. Compositor stress frames have a plain QA background and do not substitute for the driving captures. No full campaign endurance or hardware performance claim.

Deduplication checked live staging d98379b05ddc1f5189d7b1975d3f809b10bb602d, combined d8a9620d and open work. No Punto or Saffron equivalent. Existing Fiat entries cover Panda, Multipla and 124 Spider. Previous combined snapshot is preserved separately.

Independent validation: 14 catalog/import tests and one Saffron wheel-coverage test passed; all five browser cases passed. Reviewed all eight rendered exterior directions and desktop/mobile driving captures: body/tire composition is intact and runtime gauges remain visible through the shared wheel opening. Browser evidence is in `/tmp/saffron-browser` on the test executor.
