# Local wave 03: two implemented shared-art configurations

Base `b71e82d76f86e66fed403d8e1dab051863ee33aa`; branch `local/660-wave03-20261117`. Preserve prior wave02/reconciliation snapshots. No Echo merge, remote write or changes to pending PR branches.

| Runtime ID / alias | Exact reference | Verified anchors / estimated limits |
|---|---|---|
| `snowbell-gt-2023` / Snowbell GT 2023 | 2023 US Kia EV6 GT AWD single reduction | Official GT table: 430 kW, separately published 576 hp, 545 lb-ft, 4,795-lb minimum curb, 10.65 reduction, 77.4-kWh nominal pack, dimensions and 12.56 steering. Runtime normalizes 430 kW to mechanical hp; document display rounds to 576. 74-kWh usable pack, motor cutoff, regen/efficiency, tracks, load and handling are estimates. Malformed official tire string is not claimed as verified; 255/40R21 is an explicit provisional interpretation of its 21-inch wheel. No GT-Line/EU/later-model substitution. |
| `arrowleaf-gt-2013` / Arrowleaf GT 2013 | 2013 US Dodge Dart GT 2.4 six-speed manual | Chrysler GT announcement confirms 184 hp, 174 lb-ft, 2.4L, manual six-speed, 18-inch wheels and sport suspension. Approximately 1,500-kg mass, dimensions, FWD layout, fuel capacity, peak RPM, six ratios and all handling/performance calibration remain explicit modeling estimates. Earlier brochure's proposed R/T is not used as GT mass proof. |

Sources and exact estimate parameters are in `wave-03-research.json` and each runtime document's provenance. Both cars share RTG-001 artwork by reference, with independently authored geometry/powertrain/handling. Snowbell rebinds the existing fuel gauge widgets to traction-battery percent; no graphic files are copied. The existing single-speed EV controller handles energy accounting; no combustion idle or fictitious multigear CVT is added. Shared stock graphics are placeholders, not original model-specific bodies or fitted cabins.

S660 was checked first. Existing Kestrel 660 has 830 kg, 658cc, RWD, approximately 47kW and the six factory manual ratios. Alpha trim is not proven; mechanical overlap is sufficient to avoid another duplicate pending evidence. No Kestrel changes.

## Count and tests

Local runtime: **215 non-system entries + three templates**. Five are phase-2 shared-art configurations (two pilot, one Wilderness, two here); 210 are the previously reported finished baseline. This wave adds **two authored/unit-tested configurations, zero browser-drive-verified cars and zero original-art-finished cars**. Echo remains separate. The original candidate ledger remains 660 slots; these two explicit IDs resolve existing rows rather than adding target slots. Reconciliation snapshots remain historical and intentionally are not overwritten.

- `node --test --test-concurrency=1 tests/unit/carCatalogImport.test.js`: 30 passed. Includes complete native roundtrips, shared art references, sourced-versus-estimated assertions and actual drivetrain movement with TC on/off.
- Electric powertrain, authoritative EV runner and identity-reconciliation suites: 27 passed. Snowbell-specific runner test spends energy and gives zero motor torque with an empty battery.
- Catalog Playwright discovery: 11 total cases, including exactly four new desktop/touch cases. All four attempted using official Chrome Headless Shell with `chromiumSandbox: true`; launch fails with `No usable sandbox!` before gameplay. No input driving or visuals certified, no security changes. Logs retained in `/workspace/scratch/wave03-qa`.
- Full manifest/assets validation passed: 2,212 documents, 16 assets. Final two car documents also revalidated after the gauge edit. Existing runtime/race/art files and prior car documents are unchanged.

Replay this wave's commit after the saved local wave02/reconciliation chain; preserve Echo's and pilot's test registration imports when reconciling. New runtime entries and manifest keys are additive only. The creation script refuses overwrite; do not run it again on an installed wave. Run the catalog cases against a supported sandbox-enabled browser before increasing drive-verified counts. Regenerate reconciliation against exact integrated revisions into a new snapshot rather than rewriting prior evidence.
