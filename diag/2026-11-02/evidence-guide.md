# Evidence and reproduction guide

## Included

`evidence/` contains copied compact analysis outputs; `evidence-manifest.json` records source paths, sizes and SHA-256 hashes. These are historical result files, not newly rerun benchmarks.

- `latest-nov2-summary.json/.txt`: latest phone interval statistics, selected worst-frame details and phase summaries.
- `gc-ten-minute-analysis.json/.txt`: natural-GC run analysis, overlap statistics and examples.
- `gc-ten-minute-source-hashes.json`: source hashes recorded for that historical run, before subsequent optimizations.
- `gc-paired-allocation-comparison.json`: initial profile/route optimization comparison.
- `gc-batch-comparison.json`: broader allocation batch comparison.
- `gc-contact-comparison.json`: final contact-merge comparison; `sourceDigest: false` is expected because implementation files changed, not a gameplay parity failure.
- `tire-mutation-loop-allocation.json`: rejected callback/loop rewrite evidence.
- `wheel-pose-branch-comparison.json`: synthetic smooth/active branch tradeoff.
- `material-update-allocation.json`: isolated unshipped material-record experiment.

Some JSON contains machine-local paths or historical artifact references; those are provenance, not portable dependencies. Cumulative allocation is not retained heap. Timing from allocation-sampled runs is not a clean FPS measurement.

## Bundled experiment

`experiments/material-update-candidate.mjs`, its test and guarded loader are diagnostic source only, **not game integration**. Only the test's relative import was adjusted when packaging.

From repository root, the small correctness check is:

```sh
node --test diag/2026-11-02/experiments/material-update-candidate.test.mjs
```

This verifies 200 material transitions, including missing cells, live values, custom/inherited fields and overlay behavior. It is not a whole-simulation test. The loader uses Node's `registerHooks` (historically run on Node 24.17) and is an opt-in source transformation. It modifies only the imported player block in memory; do not assume AI/worker coverage or silently enable it in production.

## Large raw evidence not packaged

On the original device, relative to repository root:

- `data/server-storage/performance-captures/c7e7edd86d7c5680807db1c19c84e40d2cfa89405947a0969fe526287a3b45ef.json` — latest analyzed phone capture, about 99 MiB.
- `artifacts/mountain-stress/storm-autodrive-gc-ten-minute-cpu.json` — raw ten-minute run and natural GC events.
- `artifacts/mountain-stress/gc-current-allocations.heapprofile` and `gc-*-before/after.heapprofile` / `gc-contact-after.heapprofile` — allocation profiles.
- `artifacts/mountain-stress/analyze-latest-nov2.py` — phone summary generator; it selects the latest upload by modification time, so pin the input before reproducing an old report.
- `artifacts/mountain-stress/gc-ten-minute-run.mjs` and `analyze-gc-ten-minute.py` — historical instrumented wrapper and overlap analysis. The wrapper transforms exact harness strings and requires source compatibility; do not assume it runs unchanged against future revisions.

These raw files are local/ignored, not available from a GitHub-only checkout. Obtain them separately if detailed attribution needs independent verification. Do not confuse absent raw files with absent tests; the compact results were copied from completed local runs.

## Existing repository documentation

- [Chronological investigation](../../docs/racing/frame-budget-scheduling.md)
- [Historical AI measurements](../../docs/racing/ai-bottleneck-measurements.md)
- [Mountain stress harness](../../docs/racing/mount-washington-stress.md)
- [Performance capture format/workflow](../../docs/racing/performance-capture.md)
- [AI road planning](../../docs/racing/ai-road-plan.md)

The chronology includes earlier failed tests, prototypes and superseded status. Later full CI passed for PR #555; that does not retroactively turn every isolated experiment into a successful optimization or validate FPS.
