# Trailglass 2024

Original fictional salvage compact SUV referencing the **2024 US Volkswagen Tiguan S FWD**, seven-seat configuration. Not the short-wheelbase/new-generation European model, AWD trim, or a factory visual replica.

`import.json` carries manufacturer-source URLs, raw paired units, exact 8AT ratios and explicit simulation estimates. Key anchors: 1693 kg NHTSA curb mass, 184 SAE hp at 4400 rpm, 221 lb-ft at 1600 rpm, 215/65 R17 standard tires, 2.791 m wheelbase. The original Volkswagen technical PDF resolves previous dealer-data uncertainty.

Body and dashboard PNGs were visually inspected. Twelve oblique/side wheel anchors were measured from transparent openings and checked for bounded, centered placement. Straight front/rear anchors are visual estimates behind the shell corners. The existing placement helper calibrates all eight angles without changing physical geometry. The existing shared steering wheel is reused.

Validation: `node --test tests/unit/trailglassCatalog.test.js` (three tests: source anchors, original wheel openings, eight-angle build/editor roundtrip). Isolated generated documents are in `/tmp/trailglass-built`, not the shared runtime catalog. Browser exterior/cockpit and driving QA remain required before claiming integration complete.

Unknown factory data (full torque curve, shift/lockup behavior, CG and spring/damper rates) are explicitly modeled, not presented as verified. Nominal unloaded tire radius is calculated from sidewall designation, not a measured rolling radius. The source artwork is custom fictional salvage styling; its cabin is not advertised as the Tiguan's original cockpit.
