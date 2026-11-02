# Race runtime performance fixes

Base revision: `8b33a7ee11d959ae5daa73c29de98db28794a13b`.

This patch addresses repeatable unnecessary work found in the Mount Washington
investigation. It does not establish a single cause for every reported hitch,
and the operation-count tests below are not phone FPS measurements.

## Changes and their purpose

| Area | Change | Evidence and limits |
| --- | --- | --- |
| Three render resolution | Apply the selected and dynamic resolution scale to the actual WebGL drawing buffer. Keep the camera aspect, sprite projection, and final composite in logical viewport coordinates. | A 1920×1080 viewport at 50% uses a 960×540 target. An additional 0.8 dynamic scale uses 768×432. Repeated capability and draw requests do not resize the target again. The existing dynamic-scale threshold policy is unchanged. |
| Tire marks | Keep fixed-capacity geometry per 512-ID chunk, append only newly published marks, upload only modified attribute ranges, and retire old marks through draw ranges. | 512 sequential appends process each new segment once rather than rebuilding every growing prefix. Tests cover gaps, degenerate marks, partial retirement, full disposal, session replacement, and Three r160's actual upload lifecycle. New chunks still allocate buffers; this is not a zero-allocation renderer. |
| Distant AI | Select detailed physics from an interaction region instead of always granting three distant cars a solver. Add distance/rank hysteresis and simulation-time residence. | The real 29-car distant fleet performs zero positive-delta detailed solver calls over 90 updates. Four pending impacts and four imminent player contacts each override the ordinary three-car cap. Promotions still reconstruct the detailed runner where the existing state-transfer contract requires it. |
| Warm scenery | Register stable race-owned placements, reuse their partitions, and rebuild only affected 128 m chunks for pickup/destruction ID changes. | Ten warmed Three/projected frames over 18,419 proxied authored placements read zero placement properties. A pickup in a three-chunk scene rebuilds one chunk, preserving the other groups. Editor mutations, asset revisions, and source replacements invalidate conservatively; unregistered mutable callers retain full validation. Initial construction and broad invalidation are still synchronous. |
| Physics scratch records | Update existing tire, material, and brake records in place; delete only fields that actually disappeared. | Canonical steady updates perform no property deletions. Real-runner tests compare all physical states against the previous delete/refill behavior through the existing eight-slot environment ring. Custom inherited adapters retain the legacy fallback. |
| Reset diagnostics | Disable expensive reset-only history and symmetry snapshots for ordinary named realtime/high-fidelity profiles and production AI. Preserve explicit diagnostics and legacy custom callers. | Diagnostics on/off produce identical physical states across 610 parked/driving steps and graded/banked support tests. Fresh construction was not collecting this reset history; this change does not explain no-reset hitches by itself. |
| Frame timing | Pass uncapped animation elapsed time to the race's bounded clock, retain a capped delta for unrelated game systems, and record admitted/deferred/discarded/excluded time. | A 95 ms callback admits at most 33.333 ms now and retains bounded debt instead of silently losing upstream time. Pauses, hidden tabs, input blocking, session transitions, and already-consumed callbacks cannot become catch-up work. This improves accounting and time consistency; it does not create CPU capacity. |
| Capture finalization | Defer report construction, JSON encoding, and upload initiation until driving is paused or exited. Reuse the prepared report/JSON and snapshot bounded stopped summaries. | 60 s/120 s automatic-stop tests perform no report build or upload while driving. Tests cover immediate resume, concurrent export/upload, retries, replacement cancellation, and reused physics accounting records. Server-side processing may still overlap a later resume. |
| Session ownership | Release workers, recording hooks, pending reset generators, frame jobs, and renderer references when the owning session ends. | Actual editor tests exercise End Drive, Restart, replacement Play, Finish, successful/failed asynchronous travel, car preview replacement, both global editor exits, and export. Cleanup preserves ghost/snapshot consumers and replacement-session caches. Shared editor assets remain cached. |

## Regression coverage

The final local focused run passed **146/146 named cases**, with zero failures,
cancellations, or skips. Eight additional existing editor/renderer/worker suites
passed **50/50 cases**, including the real GameCore finish-presentation tests. Physics state/replay/performance and the additional AI
scheduling/recovery checks also passed their focused runs.

The new frame-pacing CI step in `.github/workflows/merge-tests.yml` runs the
focused AI, physics-record, timing, lifecycle, resolution, scenery, and capture
tests. Existing CI steps continue to run tire-mark, restart, renderer, and full
vehicle-validation coverage.

Local verification uses named subtests with isolation disabled. The local Node
24 runner otherwise sometimes returned file-only results for deep editor imports;
those results were not counted as executed behavioral cases. Node 22 CI uses the
compatible `--experimental-test-isolation=none` flag for the added step.

The focused regression command is:

```sh
node --test --experimental-test-isolation=none --test-reporter=spec \
  tests/unit/raceAiInteractionBudget.test.js \
  tests/unit/raceAiPhysicsBudget.test.js \
  tests/unit/raceAiDistantPhysics.test.js \
  tests/unit/raceEnvironmentRecords.test.js \
  tests/unit/vehiclePostResetDiagnostics.test.js \
  tests/unit/raceFrameTiming.test.js \
  tests/unit/raceFrameBudget.test.js \
  tests/unit/raceSessionResources.test.js \
  tests/unit/raceSessionLifecycle.test.js \
  tests/unit/raceRenderResolution.test.js \
  tests/unit/raceSceneryPerformance.test.js \
  tests/unit/compactFramePhases.test.js \
  tests/unit/racePerformanceCapture.test.js \
  tests/unit/racePerformanceUpload.test.js \
  tests/unit/racePerformanceStatus.test.js \
  tests/unit/raceTireTrackRenderer.test.js
```

Additional verification includes existing AI scheduling/rate/terrain/recovery
tests, vehicle state/replay/performance tests, and editor start/restart/preview
and renderer regressions. Specific baseline limitations are recorded below
rather than represented as passing suites.

## Review findings corrected before publication

- The clock change initially removed a countdown presentation variable. The
  fallback countdown now has a real-editor regression, including a 95 ms callback.
- A stopped capture initially retained a pooled accounting frame. It now snapshots
  only the bounded summaries; a test wraps the real pool before deferred export.
- Capture supersession now uses a generation token across async continuations,
  including a queue entry serviced immediately before a replacement capture.
- Three r160 does not clear update ranges after its initial `bufferData`. Attribute
  upload callbacks now clear them, and a regression uses the shipped WebGLAttributes
  implementation to verify that the next mark uploads only its new vertices.
- Chunk cleanup protects shared materials still used by other live chunks even
  after the small material cache evicts them.
- Preview reset passes an explicit null when no preview exists, so the default
  session argument cannot accidentally dispose an ordinary active race.
- Capture deferral and raw callback timing also cover real car-editor test drives;
  an older capture waits while either editor's currently displayed drive is active.
- The P2 browser stress observer now traverses chunk groups to count real fence
  meshes and times only the outer scenery pass. Its mesh-count and radius limits
  remain intact. A managed 1,384 m bent-fence regression verifies every authored
  panel, UVs, triangle counts, bounded meshes, and isolated removal gaps.
- The cold-travel browser winding assertion now inspects the active draw range,
  excluding unused capacity in persistent skid buffers. Its positive-normal
  and nonempty-geometry assertions remain intact.
- An actual-editor pause/Nitro/resume regression checks effect duration, admitted
  time, and authoritative movement. The existing browser boost assertion retains
  its timeout and threshold and now reports bounded failure state if it fails.

## Existing validation limitations

- The original vehicle substep tire-energy equality case fails on the pinned base
  and on this patch with the same quantization/contact-generation mismatch. Three
  other substep cases pass. This patch does not change solver integration rates.
- Thirteen existing reset-equilibrium cases pass locally. The fixture-backed
  Studio Sprint 2 hill incident case requires the repository's 25 MB fixture,
  which was not present in the local working mirror. Its diagnostic configuration
  now opts in explicitly; execution of that case remains a CI/full-checkout check.
- No local test measures Android presentation latency, GPU fill cost, browser GC
  pauses, thermal throttling, or a sustained Mount Washington 60 FPS result.

## On-device comparison

Use the same phone, browser, orientation, resolution setting, Mount Washington
point-to-point route, AI count, car, and weather for the base and patch. Run an
initial warm pass and at least three comparable longer passes. Include repeated
Play → End → Play cycles, tire marks, a recovery, and scenery pickups/destruction.

Compare frame-interval p95/p99, counts over 33.34/50 ms, and their timing within
the drive. Use standard capture for the ordinary comparison; use detailed capture
only to inspect a reproducible event because instrumentation changes the workload.
Pause before waiting for upload. A completed report identifies client callback
intervals, not measured screen presentation or a proven GC cause.

Also confirm that the measured render-target size matches the chosen scale,
distant detailed-physics counts fall to zero, collisions still resolve promptly,
weather and race time advance consistently, and workers/caches return to the
expected ownership after leaving a session.

## Work intentionally left separate

This patch does not replace the renderer or physics engine with WASM, change the
physics model, suppress authoritative track-state updates, or rewrite checkpoint
serialization. Read-only AI queries creating mutable track cells, unsliced
checkpoint boundaries, and cold world construction remain separate candidates
from the audit. Measure the residual frame-time tails before choosing the next
architectural change.
