# Storksbill 1977 — Legends / Sandro Munari

Historical reference: **Sandro Munari / Silvio Maiga, 1977 Rallye Monte Carlo-winning Lancia Stratos HF Group 4**. Not the road Stradale, Stratos Zero, Group 5 turbo or Lancia 037. Original logo-free 2994 interpretation, not an exact replica or claim of driver endorsement.

## Provenance and uncertainty

The manufacturer Monte Carlo winners table explicitly records1977 Munari/Maiga/Stratos HF. FIA homologation640 identifies Group4 and2418cc. WRC's model history confirms mid-engine Dino V6, competition-family output up to280bhp and five-speed manual. Stellantis Heritage confirms rear-mid/RWD architecture. Full source URLs and field attribution are retained in `import.json` and exported `catalogProvenance`.

**280bhp is a selected family-reference figure, not verified event-day power.** All remaining numeric setup including950kg,200lbft,torque interpolation,7800rpm,ratios/final drive,dimensions/CG/geometry,suspension,alignment,tank,tire sizing and140mph/5s targets is explicitly estimated. Equal205/65R14 tires are a current simulation approximation, not a claim to reproduce historical stagger. No exact24-valve or chassis-number claim. Auto Assist uses five manual ratios for accessibility, not a factory automatic. Munari won the1977 FIA Cup, not a WRC drivers championship (introduced1979).

## Local-only scope

Base `cfcb92a52646e9019bd66e153531a83e1892fac1`, retaining independently completed Camry/Marjoram and Grand Caravan/Selfheal. All decoded manifest car documents were checked: no Stratos/Munari exact entry. Storksbill alias is unused here and avoids reserved Rockrose,Hawkbit,Pennycress,Melilot,Milkwort,Centaury,Cornsalad,Woodbetony. Local count180 non-system cars +3templates, not combined with separate unpublished cars.

## Art and import

Original built-in generated PNGs: eight complete exterior angles with open wheel wells; dedicated sparse1970s rally cockpit with wraparound windshield,roll cage,red bucket edges,metal toggle panel and manual shifter; eight-view gold rally wheel. New asymmetrical forest-green/crimson/off-white blocks do not copy sponsor graphics. No third-party image assets or sponsors.

Blank left cluster receives live speed,RPM,gear and fuel. Animated steering wheel sits below it. Original PNG alpha preserved. The existing near-opaque wheel alpha normalization is used only on a decoded import copy. Initial spoked wheel was rejected because transparent spoke holes made native fitter choose only its small hub; final opaque recessed gold wheel is regenerated rather than weakening fit checks. Art/calibration are interpretations rather than exact event cockpit measurements.

Car-scoped `build.mjs` uses existing production serializers and refuses overwrites. Measured original wheel-well anchors adjust graphics only, not physical tire radius. No shared physics,renderer,input or UI changes. Existing viewport-relative animated wipers may float above painted parked wipers on desktop; this inherited cosmetic limitation is not corrected in shared code, and instruments remain unobstructed.

## Validation

Final serialized local validation passed:

- 35 focused unit and preservation tests, including native serialization, original asset hashes, wheel fitting, and production launch with traction aid on/off.
- 5 sandbox-enabled Playwright tests: all eight exterior frames, desktop keyboard driving, handheld touch driving, and actual touchscreen pagination/selection in the integrated picker. Moving speed, RPM, gear, and fuel were visually reviewed on desktop and portrait handheld.
- 5 existing dynamics smoke cases.
- Full manifest and asset validation: 2,094 documents, 16 assets; manifest current.
- Independent roster audit: 180 non-system cars plus 3 system templates. Exactly one Munari/Stratos provenance match. Separate unpublished cars were not combined.

QA used official Chrome for Testing Headless Shell 157.0.8103.78 with `chromiumSandbox: true`, one worker, and traces disabled. Durable local evidence and configuration are in the sibling `storksbill-qa` directory, outside the source checkout. Front/right and rear/left diagonals, fitted wheels, and moving cockpits were visually inspected.

Full project/CI suite not run. No pushing, merging, uploading, or deployment.
