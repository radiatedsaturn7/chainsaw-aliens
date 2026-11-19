# Local wave 02 — replay after the pending pilot

Base: `a6398ad5baf5889b27d18a374aa78c7d8454c8ca` (pilot PR #667).
This local change does not include Echo PR #666 and does not change either release branch.

Eight candidates are audited in `wave-02-queue.json`. One is implemented:
**Briar Trail 2024** / `briar-trail-2024`, US 2024 Subaru Forester Wilderness AWD CVT.
The factory source is a 2025 brochure that explicitly labels the carried-over **2024** Wilderness exceptions. The 2025 180-hp engine and 3,510-lb Base mass are not used. The mixed-year table does not explicitly supply Wilderness length, so 182.7 inches remains a modeling estimate, not a verified fact. Geometry, mass, engine curve and calibration are authored independently; only RTG-001 art references are reused. CVT ratios and calibration are estimates. No OEM off-road controller fidelity is asserted.

Counts on this isolated tree: **213 non-system entries**, three system templates; three shared-placeholder entries including the two pilot cars; 210 previously reported finished/drive-verified entries, **zero newly browser-drive-verified or original-art-finished cars**. These are not 660 completed identities. Eight candidates investigated does not mean eight fully researched cars: one factory-anchor review is sufficient for this build, two have partial anchors, and five need further primary source access/spec review.

The separate `wave-02-progress.json` leaves the pilot snapshot unchanged. It confirms 13 historical-row mappings, including eight newly resolved mappings (Wilderness plus seven existing entries); 647 historical rows remain unresolved. Existing Sentra S, Carnival LX7, C4 VTS180, Tiguan S, Abarth 124, representative Rally Fighter and prototype Racemo are reused rather than duplicated. The undated Racemo row is not reclassified as a production car. S660 alpha remains unresolved because the current reference alone does not establish that trim. Fuzzy matching is never accepted as identity proof.

## Validation and continuation

- `node --test --test-concurrency=1 tests/unit/carCatalogImport.test.js`: 21 passed, zero skipped. Includes shared-reference integrity, individual factory anchors, complete native roundtrip and production drivetrain movement with traction control on/off.
- `npx --no-install playwright test tests/playwright/car-catalog.spec.js --list`: seven cases, including exactly one new desktop and one new handheld case.
- Both new browser cases attempted with official Chrome Headless Shell and `chromiumSandbox: true`: browser initialization fails with `No usable sandbox!`; **no actual input/drive acceptance claimed**. No security settings changed. Logs retained under `/workspace/scratch/wave02-qa`.
- `python tools/project_manifest.py --check --validate-assets`: passed, 2,210 documents and 16 assets. All baseline manifest entries and referenced documents remain byte-identical; no existing runtime/race/art edits.

Replay the wave commit only after the pilot is present. Preserve Echo's additional import in the shared test registration files if reconciling after #666. The manifest addition is just Briar Trail. Regenerate reconciliation with `node tools/reconcile-car-phases.mjs --wave02` after integration and update counts to the actual combined roster; do not overwrite the pilot historical snapshot. Do not rerun the creation script on an already installed car: it intentionally refuses overwrite. Next research actions and exact candidate IDs are recorded in the queue. No workflow, renderer, race, original art or existing car changes are required.
