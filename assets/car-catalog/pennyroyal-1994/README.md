# Pennyroyal 1994

Original badge-free 2994 hatchback inspired by the French-market first-series Peugeot 106 Rallye 1294 cc catalyst five-speed manual, using the October/December 1993 brochure specification for the 1994 car. Base unassisted steering, no optional ABS or radio; no later 1.6 engine, UK weight convention, XSi or competition kit. Current and staged aliases and the old eleven-model crosswalk show no duplicate.

Both original brochure PDFs and inspected pages are retained. The selected CEE anchors are 72 kW at 7,200 rpm and 108 Nm at 5,400 rpm, converted to mechanical horsepower and lb-ft; the existing editor serializer rounds its headline values to 97 hp and 80 lb-ft. The exact conversions remain in import.json and the authored torque curve. The separately listed DIN 100 ch and 11.2 mkg are preserved as separate facts, never labelled SAE or mixed into the CEE curve. The brochure specifies 810 kg en ordre de marche; its driver convention is unresolved. Tire size is 175/60R14 H. Published 0–100 km/h is 10.3 seconds; the runtime 0–60 mph value is explicitly an estimate.

FIA A-5505 base-form pages 12–14 verify the standard manual transmission. Page 13 prints output/input ratios; runtime engine-to-wheel reductions are derived from the actual tooth counts: 41/12, 39/20, 38/28, 39/37, 35/41, reverse 43/12 and final drive 59/13. Later VO competition alternatives are excluded. Auto Assist (5MT) automates these same gears for game accessibility and is not a factory automatic. Remaining simulation estimates are listed in import.json.

Original generated body/dashboard PNGs and prompts are preserved. Eight individually fitted exterior views use shared moving tire layers. The angular first-series dashboard has its characteristic empty radio cubby above the vents and heater sliders below, fitted live speed/RPM/gear/fuel displays and the shared animated steering wheel. Painted metal and salvage repairs are an original 2994 interpretation.

Keyboard/touch gameplay uses production simulation on an in-memory route. The static picker smoke checks initial-page art, navigates to Pennyroyal on a later page, waits for exterior art, then drives its selected cockpit. No saved race or runtime/world file is altered. All original references and useful QA remain local.

Immediate base 46089a568ae3622b67bf599a2f58495a80590e35 has 106 playable cars. Pennyroyal makes 107, excluding three system templates. The old 104-car branch remains separate and untouched. No publication, remote writes, transfers or deletion.

Validation: all 28 final scoped tests pass. The initial log retains one test expectation failure caused by the editor's established whole-number headline rounding; only the test expectation and this documentation were corrected, with no runtime/source changes. Five focused follow-up checks also pass. Manifest validation passes with 1,871 documents and 16 assets. All eight exterior views and both moving cockpits were visually reviewed. The real picker begins with seven of 107 cars loaded and reaches Pennyroyal at index 69 on the page beginning at 68.

Read-only staging recheck observed 2b699e5d92fef0f520913cfac3a3694c9ca10286, tree 7dd651525fccdb9b0de4a903957eed40b7960d27. Its nine-file radio/countdown change has no car, race-data or asset changes. This local branch remains on the original batch base; saved checkpoints were not rebased or rewritten. See qa/staging-drift.json.

All four browser checks passed, including the later-page selection followed by moving cockpit gameplay. The final selected cockpit was visually reviewed. No unresolved validation blocker.
