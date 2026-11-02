# AI bottleneck measurements — 2026-10-29

The remaining measured simulation cost is primarily terrain/contact queries and
ordinary detailed vehicle integration, not driving decisions or repeated recovery.
The initial measurements below precede the optimization follow-up at the end.
Neither set is a rendered-FPS measurement.

## Method

Two sequential 7,200-step (120 simulated seconds at 60 Hz) Mount Washington
runs used the same source digest, seed 8730, original grid, saved four-car lineup,
clear/noon weather and brightness 1. The existing automatic player driver was
used in both. Only the opponent count changed: 0 versus 29 (30 total vehicles).
Both enabled the existing method timers and V8 sampling profiler. Sampling began
at frame 300. The table below also excludes frames 0–299 to match that window.

The runs executed on Android/Termux with Node, without browser/GPU rendering.
They ran sequentially to avoid competing simulation workloads. They are one pair,
not repeated statistical trials. Different traffic changes player/AI trajectories;
the zero-AI difference is not an exact subtraction of identical physics work.
Sampling adds overhead. Wall-time samples include OS scheduling; GC is retained
as unassigned rather than falsely attributed to whichever AI call contains it.
The 29-AI profile had seven sample intervals above 10 ms; sample-count shares and
weighted-time shares agree closely on the AI category ranking.

Source digest: `e69a88171c00` (prefix recorded by the benchmark).

| Simulation update, excluding first 5 seconds | 0 AI | 29 AI |
| --- | ---: | ---: |
| Median | 10.36 ms | 24.57 ms |
| P95 | 15.35 ms | 50.79 ms |
| P99 | 18.06 ms | 62.76 ms |
| Mean | 11.09 ms | 28.78 ms |

These times exclude rendering. 16.67 ms is the entire frame budget at 60 FPS;
the 29-AI simulation alone exceeds that budget at the median in this run.

## Attribution

AI accounts for 58.28% of sampled elapsed time in the populated run. GC accounts
for another 10.73%, compared with 2.75% in the empty run. That is evidence to
investigate allocation pressure, not proof that all GC was caused by AI.

Exclusive categories within sampled AI time (nearest recognized stack frame):

| Category | Share |
| --- | ---: |
| Terrain/surface queries | 33.29% |
| Chassis/physics integration | 20.84% |
| Tires/suspension | 11.00% |
| Engine/transmission/mechanical | 8.37% |
| Track-state updates | 8.13% |
| Body/scenery collision | 5.98% |
| Other AI orchestration | 5.61% |
| State/telemetry construction | 3.12% |
| Driving/traffic planning | 1.91% |
| Distant-car integration | 1.61% |
| Recovery/reset checks | 0.14% |

Terrain work called from a collision routine belongs to the terrain row above.
Counting entire collision call paths instead gives 7.94% of AI time. Inclusive
categories overlap and must not be added together. Therefore 5.98% is not an
estimate of every possible saving from a collision redesign.

Three opponents (ai-4, ai-2, ai-6) account for 81.8% of timed
`updateRaceAiVehiclePhysics` call duration. The largest recorded calls were
143.46 ms and 135.15 ms, on moving cars at about 8 m/s, classified `near-player`,
with zero penetration recoveries and zero backlog. This rules out stuck-car
recovery as the explanation for those calls. It does not separate GC from the
work inside each individual wall-timed spike.

Relevant hot paths include `integrateChassis`, `ContactPatchTireModel.step`,
`getRaceRawGroundElevationAtWorldPoint`, `getRaceAiContactState`, track-cell
creation/contact accumulation, and compatibility/render-state construction.
The shared driving plan is already relatively cheap.

## Behaviour findings

No AI reset occurred in the populated run and no backlog was recorded. However,
14 opponents ended below 1 m/s, mostly with zero target speed in traffic queues.
Some were queued around route distances 237–266 m, others near 870–890 m.
One car was slowly reversing and one was crawling. This is an unresolved traffic
progress issue; this run must not be described as all cars completing/progressing
successfully. The expensive physics calls were concentrated in other moving cars.

The run covers 120 seconds, not a complete mountain climb. It does not validate
storm behaviour, rendering occlusion, or browser GPU cost. No graphics/physics
features were disabled to obtain these results.

## Recommended order of work

1. Reduce fresh AI surface/material/height queries. Reuse validated local road
   geometry across AI updates, with explicit invalidation for changed surface
   state, leaving the road, discontinuities and unsupported wheels. Preserve
   live weather/grip rather than caching stale traction.
2. Add a cheaper grounded-driving tier for nearby but non-interacting AI.
   Detailed physics should resume before possible contact, jumps, major slip or
   off-road motion. Existing distant simulation already uses a 30/45 m hysteresis
   radius plus two seconds of closing speed; merely adding distance-based LOD
   again would duplicate what exists. The missing opportunity is reducing
   ordinary suspension/chassis work inside that nearby group safely.
3. Reduce allocation and repeated compatibility/telemetry construction, and
   coalesce AI track-state contact updates without losing their physical effects.
4. Fix the traffic queues as a separate correctness task. They are not the main
   measured physics bottleneck in this sample.
5. Measure `threeCarSpriteMs` and GPU/browser frames on the actual rendering
   device. This Node profile cannot quantify the remaining rendering share.

Do not start by disabling all AI collision except against the player: this profile
predicts a smaller payoff than the terrain/contact and chassis work, with larger
risks to traffic/scenery behaviour. Any proposed simplification needs its own
same-source A/B run plus collision/transition tests.

## Artifacts and reproduction

- `artifacts/mountain-stress/clear-autodrive-ai-breakdown120-cpu.json`
- `artifacts/mountain-stress/clear-autodrive-ai-baseline120-cpu.json`
- `artifacts/mountain-stress/clear-ai-breakdown120-ai-steady.cpuprofile`
- `artifacts/mountain-stress/clear-ai-baseline120-ai-steady.cpuprofile`
- `artifacts/mountain-stress/ai-breakdown120-profile-summary.json`
- `artifacts/mountain-stress/ai-baseline120-profile-summary.json`

```sh
RTG_AI_COUNT=29 RTG_AUTODRIVE=1 RTG_TIME_OF_DAY=noon RTG_BRIGHTNESS=1 RTG_AI_PROFILE=1 RTG_CPU_PROFILE=1 RTG_CPU_PROFILE_START_FRAME=300 RTG_BENCHMARK_TAG=ai-breakdown120 node tools/loadtest/benchmark-mountain-stress.mjs clear 7200
# Repeat with RTG_AI_COUNT=0 and RTG_BENCHMARK_TAG=ai-baseline120.
node tools/loadtest/summarize-ai-cpu-profile.mjs artifacts/mountain-stress/clear-ai-breakdown120-ai-steady.cpuprofile artifacts/mountain-stress/ai-breakdown120-profile-summary.json
node --test tests/unit/aiCpuProfileSummary.test.js
```

The summarizer test verifies exclusive/inclusive nested attribution and separate
GC accounting. All benchmark processes completed. No gameplay changes, saves,
assets, commits or pushes were made for this measurement task.


## Optimization follow-up

Implemented after the baseline:

- AI contact queries now use prepared physics geometry on the road instead of
  the visual surface sampler. Off-road queries retain the full material path.
  Existing exact-pose contact reuse remains guarded by bake and track-state
  identity, with live traction resampled rather than cached.
- Healthy supported opponents can use the existing cheaper chassis path closer
  to the player (12/18 m hysteresis plus two seconds of closing speed). Swept
  player/traffic checks, scenery, road discontinuities, damage, slip and airborne
  conditions still select detailed handling. Player physics is unchanged. The
  worker-authority path still selects detailed physics; these measurements
  exercise local Node authority, not a worker-mode performance guarantee.
- Switching back to detailed physics now preserves queued collision impulses,
  collision history and reset sequences along with vehicle state.
- Two physically separated cars abreast on a bend no longer both treat the other
  as a stopped leader merely because each projects slightly ahead. Physical
  overlap and genuine stopped-leader braking remain protected by regression tests.
- Entirely offscreen AI billboards are rejected before painting car artwork.
  This last change has a draw-call regression test, but no local GPU measurement.

### Confirmation and variation

Same 7,200-step clear-weather scenario, 29 AI, seed 8730; statistics below exclude
frames 0–299. Each run had profiling enabled.

| Simulation update | Original | First optimized run | Clean final repeat |
| --- | ---: | ---: | ---: |
| Median | 24.57 ms | 12.36 ms | 22.82 ms |
| P95 | 50.79 ms | 19.76 ms | 44.51 ms |
| P99 | 62.76 ms | 26.49 ms | 59.38 ms |
| Mean | 28.78 ms | 13.35 ms | 26.30 ms |

The first optimized run overlapped a short unit-test run and preceded the final
collision-preservation and offscreen-paint safeguards. The clean repeat did not
run alongside tests. Both optimized runs produced the same final AI trajectories,
but wall times differed substantially. Device scheduling/clock variation is a
possible explanation, not a demonstrated cause. Do not advertise the first run's
roughly 50% improvement as a reliable overall speedup.

In the clean final repeat, timed detailed AI integration fell from 59.3 to 27.2
seconds cumulatively, and the full AI update from 137.1 to 113.1 seconds. These
are nested timers and must not be added together. Whole-simulation median improved
about 7%, P95 about 12%. Terrain remains the largest exclusive AI category (36.95%),
followed by powertrain/mechanics (12.78%) and chassis (12.64%). Further terrain and
allocation optimization, and browser rendering measurements, remain warranted.

Both optimized clear runs had zero AI resets and cleared the old 266 m deadlock.
Two opponents ended below 1 m/s, compared with 14 originally. They were crawling
near 761–765 m without a recorded traffic blocker, not all completing the mountain.
This is 120 simulated seconds, not a complete lap or climb.

Validation: 113 focused AI/depth-sprite tests passed, including contact sampling,
live grip changes, fallback sampling, near-player/closing-speed transitions,
scenery/terrain rejection, collision preservation, and the recorded traffic pair.

Artifacts:

- `artifacts/mountain-stress/clear-autodrive-ai-grounded-queue120-cpu.json`
- `artifacts/mountain-stress/clear-autodrive-ai-confirm-clear120-cpu.json`
- `artifacts/mountain-stress/ai-confirm-clear120-profile-summary.json`
- `artifacts/mountain-stress/ai-optimization-tests.log`


### Full storm validation

The final code also completed 7,200 steps with 29 AI, night, brightness 0, full
storm intensity and 60 seconds of track-weather preconditioning. No concurrent
tests ran. Source digest: `bc97e299f3deeb22` (prefix).

Excluding frames 0–299: median 41.00 ms, P95 77.18 ms, P99 96.96 ms, mean 47.39 ms.
There were zero AI resets, zero final physics backlog, no sampled car more than
6 m below the road while inside the road corridor, and no opponent below 1 m/s
at the end. These are progress/safety checks, not proof of no possible collisions
or off-road incidents. Rendering is excluded; night brightness does not measure
lighting or weather GPU cost in this harness. Storm performance remains expensive.
There is no matched pre-change storm run here, so no storm speedup is claimed.

Artifact: `artifacts/mountain-stress/storm-autodrive-ai-final-storm120-cpu.json`.

```sh
RTG_AI_COUNT=29 RTG_AUTODRIVE=1 RTG_TIME_OF_DAY=night RTG_BRIGHTNESS=0 RTG_FULL_WEATHER=1 RTG_WEATHER_PREWARM_SECONDS=60 RTG_AI_PROFILE=1 RTG_CPU_PROFILE=1 RTG_CPU_PROFILE_START_FRAME=300 RTG_BENCHMARK_TAG=ai-final-storm120 node tools/loadtest/benchmark-mountain-stress.mjs storm 7200
```

No saved cars, tracks or artwork were changed by this optimization pass. No
commit, push or server restart was performed. All benchmark processes completed.


## Lightweight road metrics follow-up

AI lane-candidate and contact-setup width queries now call
`getRaceSurfaceMetricsAtDistance`, backed by `RaceSurfaceModel.getCorridorAtDistance`.
The full cross-section builder uses the same corridor method, preserving authored
widths, banks and roadbed options while planning skips terrain-edge construction.
No approximate spatial cache or stale grip cache was added.

On 300 locations along the saved Mount Washington route, complete metrics matched
exactly. Six alternating same-process measurements took a median 43.26 ms for the
full cross sections and 12.85 ms for lightweight metrics. Each full pass made 6,000
raw terrain calls; each lightweight pass made zero. This is a lookup benchmark,
not a claim of a 70% whole-game speedup.

120 focused AI/surface tests passed. The reproducible microbenchmark is
`tools/loadtest/benchmark-ai-road-metrics.mjs`; results are in
`artifacts/mountain-stress/road-metrics-lookup.json`.

The race harness supports `RTG_AI_LEGACY_ROAD_METRICS=1` to compare the previous
lookup with the new one on identical source. This diagnostic setting is not saved
in car or race files.


The same-source full-race A/B completed 7,200 steps per run with 29 AI, seed 8730,
clear/noon conditions. Old/new final AI state arrays and player driving state
matched exactly. No AI resets occurred.

| Update time, excluding first 300 frames | Full cross-section lookup | Lightweight lookup |
| --- | ---: | ---: |
| Median | 38.00 ms | 15.27 ms |
| P95 | 59.91 ms | 45.21 ms |
| Mean | 42.15 ms | 20.82 ms |

These are observed wall times, **not an attributable 60% speedup**. CPU clock
samples differed: median CPU0/CPU7 frequencies were 1324.8/883.2 MHz in the old
run and 787.2/3129.6 MHz in the new run. These readings do not identify which core
ran every update. The alternating microbenchmark and eliminated query counts are
stronger evidence for the lookup improvement than the full-run timing ratio.

Artifacts: `clear-autodrive-road-metrics120-1-cpu.json` (old) and
`clear-autodrive-road-metrics120-0-cpu.json` (new), under
`artifacts/mountain-stress/`. Full profiles use the corresponding
`clear-road-metrics120-{1,0}-ai-steady.cpuprofile` names.

Further inspection found that track contacts already aggregate per wheel, cell
and fixed step. Broader batching must preserve contact ordering and integrated
physical effects. Contact payloads are quantized during construction and again
in canonical normalization; this is a candidate for a separate bit-equivalence
and replay-tested optimization. No track-state event semantics or render snapshot
ownership were changed in this pass.


## Accumulated tire-event construction follow-up

The contact accumulator now sends its internal aggregate directly to a specialized
canonical event builder. This avoids constructing a temporary 28-field payload,
sorting its keys and recursively copying it into a second object. The final
payload is constructed in the same sorted order. Public/imported events retain
the generic canonicalizer. Both paths share duplicate/stale-event rejection,
sequence assignment and pending-event insertion.

Both numeric quantization passes are deliberately preserved: eliminating one
without bounds would risk changing extreme floating-point values and replay hashes.
No tire contact, physical total, weather step or track mutation was dropped or
combined differently. Existing custom accumulator adapters retain their old path.

Six alternating same-process trials of 10,000 events produced byte-identical
serialized events. Median elapsed time fell from 63.49 ms to 24.34 ms (about 62%).
Median measured heap growth was 37.67 MB versus 24.02 MB (about 36% less). Heap
deltas are observations around the isolated operation, not total allocation counts
or a guarantee of proportional game-wide GC savings.

Validation: 186 focused AI and track-state tests passed. New differential tests
cover 4,000 aggregates including nonfinite/extreme inputs, canonical field order,
wet-road event history, checksums, snapshot restore and duplicate rejection.

Reproduce the isolated comparison with
`node --expose-gc tools/loadtest/benchmark-track-contact-events.mjs`.
Results: `artifacts/mountain-stress/contact-event-benchmark.json`.
Regression log: `artifacts/mountain-stress/contact-event-regression-tests.log`.
The race harness accepts `RTG_LEGACY_CONTACT_EVENTS=1` for the previous path and
records the final track-state checksum for full-race equivalence checking.


Full-race validation: both same-source 120-second runs completed in a night/full
storm, brightness 0, 60-second weather preconditioning, 29 AI and seed 8730.
All final AI states and player driving state matched exactly. Both final road-state
checksums were `058c3b93`; neither run had AI resets or final physics backlog.

| Update time (frames 300 onward) | Old event construction | Direct construction |
| --- | ---: | ---: |
| Median | 14.01 ms | 21.77 ms |
| P95 | 35.29 ms | 50.74 ms |
| Mean | 17.69 ms | 26.35 ms |

The new full-race run was slower in wall time. This pair does not establish an
end-to-end speedup. Recorded median CPU0/CPU7 clocks differed substantially:
1276.8/4339.2 MHz in the old run, 2054.4/883.2 MHz in the new run. Core residency
and thermal state were not controlled, so the timing difference cannot safely be
attributed to either the patch or clock variation alone. The alternating isolated
benchmark demonstrates the narrower event-construction improvement; the full runs
demonstrate equivalent gameplay state. A controlled browser/device frame-time
comparison remains outstanding.

Artifacts under `artifacts/mountain-stress/`:
`storm-autodrive-contact-events120-1-cpu.json` (old) and
`storm-autodrive-contact-events120-0-cpu.json` (new), with corresponding profiles
`storm-contact-events120-{1,0}-ai-steady.cpuprofile`.
All benchmark processes completed. No saved game assets, commits or pushes changed.


## Current cost and hitch audit

A fresh 7,200-step night/full-storm run with 29 AI and GC/frame-span recording
completed with final track checksum `058c3b93`, matching the previous equivalence
runs. Median simulation update was 18.85 ms, P95 36.20 ms, maximum 330.91 ms,
excluding the first 300 frames. Browser rendering remains excluded.

Whole sampled run, exclusive nearest-classified-stack attribution:

| Category | Share |
| --- | ---: |
| Terrain/surface queries | 18.55% |
| Track state | 17.40% |
| Chassis integration | 16.01% |
| Other runtime/orchestration | 10.67% |
| Engine/transmission/mechanical | 10.54% |
| Tires/suspension | 8.76% |
| GC, unattributed | 7.95% |
| Body/scenery collision | 4.18% |
| State/telemetry construction | 2.47% |
| Distant integration | 1.80% |
| Driving/traffic planning | 1.57% |
| Recovery/reset | 0.06% |

The immediately preceding profile ranked track state first (18.94%) and terrain
second (16.69%). Their exact ordering varies; both are major remaining costs.
Two opponents, ai-2 and ai-1, account for 86.49% of timed detailed AI integration
in the fresh run. These timers are inclusive and overlap other categories.

Call-path inspection of the preceding current-code storm profile found about
9.09 seconds in physics-geometry sampling beneath the simplified AI advance path,
versus 1.43 seconds beneath initial AI contact setup. Weather-to-cell updates
consumed about 11.37 seconds inclusively across AI and other runtime; full cell
clamping was prominent underneath weather catch-up. These inclusive figures must
not be added to the exclusive table.

GC/frame overlap audit: 15 updates exceeded 100 ms; nine overlapped recorded GC
activity and six did not. The slowest update was 330.91 ms with 41.67 ms of recorded
GC overlap. Most other roughly 300 ms stalls overlapped about 21–45 ms of GC.
Unioned GC overlap covered 1.31% of measured frame spans. This is **not** equivalent
to the sampling profiler's 7.95% GC attribution: sampled wall-time attribution and
GC performance entries have different measurement behavior and include different
intervals. Neither establishes exact blocked CPU time. The stalls cannot be
explained solely by the recorded GC intervals. Their remaining cause is unresolved;
phase/work counters and controlled device scheduling are the next diagnostic step.

Recommended targets:
1. Reuse validated baked triangle/patch geometry for moving AI wheel destinations,
   with exact boundary/bridge/discontinuity fallback and live grip sampling.
2. Reduce unnecessary full cell normalization during weather updates, preserving
   rounding order, evolving fields, checksums and checkpoint invalidation.
3. Audit detailed integration for the small near-player group; retain player
   physics and collision safety. Collision-only removal still has limited payoff.
4. Add phase/work counters around the large stalls before attributing them to
   checkpoints, GC, excessive substeps or OS scheduling.

Tools: `summarize-ai-cpu-profile.mjs` now also reports whole-run exclusive categories;
`summarize-frame-stalls.mjs` unions GC overlaps with measured frames. Both tools'
unit tests pass. Use `RTG_GC_PROFILE=1` in the race harness to record GC events and
frame spans. No gameplay code changed in this audit.

Artifacts under `artifacts/mountain-stress/`:
- `storm-autodrive-cost-audit120-cpu.json`
- `storm-cost-audit120-ai-steady.cpuprofile`
- `cost-audit120-profile.json`
- `cost-audit120-stalls.json`


## Weather, packed geometry, nearby traffic and phase instrumentation

Weather scheduling was already sparse: only materialized cells exist, background
weather visits at most 512 cells per 100 ms tick by default, and tire observations
catch a cell up before using its grip. Catch-up replays fixed 100 ms weather steps,
not one giant elapsed-time step. Flow transfers at most 22% of the source's current
standing water per processed flow operation; dormant time does not multiply it.
This is a bounded arcade surface model, not a full-map fluid simulation.

The new weather normalizer touches only moisture, standing water, snow, ice and
temperature, the fields changed by weather. Canonical cells opt in at creation or
first weather normalization; arbitrary mutations recheck eligibility. Unknown or
extreme records retain full normalization. Material properties, contamination and
baselines still receive full normalization on their mutation paths. Small time
steps, rounding, bookkeeping, checkpoints and flow scheduling are preserved.
Six alternating 50,000-cell-step trials measured median full normalization-path
weather time of 111.51 ms versus 22.81 ms (about 80% lower), with byte-identical
cell values and conservation totals. This is an isolated benchmark, not a whole
race speedup. Reproduce with `tools/loadtest/benchmark-weather-normalization.mjs`.

For AI road contacts, packed geometry now supports a bounded shared cache of
candidate triangles in 2 m tiles, at most 2,048 entries per sampler. Candidate
order is preserved. Overlapping decks and materials remain in the list; actual
barycentric, height, region and priority checks still run at each query. Cached
lists invalidate on bake revision, packed-position replacement or triangle count
change. Unpacked geometry retains the existing path. Live grip is never cached.
An initial whole-query-frame approach was replaced before full-run validation,
because layered imported roads need explicit height-aware support selection.

Healthy steady same-direction AI can use simplified chassis handling at a smaller
7/10 m hysteresis distance, retaining closing-speed, yaw/slip and grounded guards.
Other traffic keeps the previous 12/18 m distances. Swept car/scenery checks,
terrain support, damage and collision-impulse promotion remain active. Player
physics is unchanged. Diagnostic flag `RTG_FULL_CONVOY_PHYSICS=1` restores the
previous envelope. Other A/B flags are `RTG_NO_CONTACT_CACHE=1` and
`RTG_FULL_WEATHER_CLAMP=1`.

`RTG_PHASE_PROFILE=1` records inclusive AI, player physics, detailed AI physics,
track advance, weather-cell steps, flow, events and checkpoint timings; detailed
physics work counts and process CPU time are recorded alongside frame wall time.
Use `tools/loadtest/summarize-race-phases.mjs` to inspect phase totals and the worst
updates. Nested phase times overlap and must not be summed. The final comparison
uses these timers without V8 sampling to investigate measurement overhead.

### Final 120-second validation of this pass

Artifacts: `artifacts/mountain-stress/storm-autodrive-next-cost120-{baseline,parity,convoy}-cpu.json`, with corresponding `next-cost120-*-phases.json` and `*-stalls.json`. Each run simulates 7,200 frames with 29 AI plus the player, full storm, night, brightness zero, and 60 seconds of weather prewarming. The table excludes the first 300 frames. Phase instrumentation and GC observation are enabled; V8 CPU sampling is disabled.

| Variant | Median update | P95 | P99 | Worst | Updates over 100 ms | Detailed AI substeps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline toggles | 33.92 ms | 69.34 ms | 87.74 ms | 593.05 ms | 28 | 10,828 |
| Geometry/weather changes only | 36.78 ms | 68.01 ms | 84.99 ms | 761.21 ms | 36 | 10,828 |
| All changes, including steady convoy | 14.50 ms | 35.70 ms | 47.27 ms | 258.02 ms | 10 | 2,929 |

These are instrumented Node simulation timings, not browser frame rates. Recorded phone CPU clocks vary substantially across runs, so this is not a controlled wall-time speedup claim. In particular, the parity run does not demonstrate an overall timing improvement. The deterministic work reduction is clearer: the convoy run performs 72.95% fewer detailed AI physics substeps. Player substeps remain 13,800 in every measured window.

The baseline and parity runs have identical final player state, all AI states, and track-state checksum `058c3b93`. Both perform exactly 8,799,937 weather cell steps. Convoy changes trajectories as expected, yielding checksum `fad5d165` and 9,748,497 weather cell steps. No variant records AI resets, pending physics backlog, or sampled below-road positions. Four convoy cars end below 2 m/s; their stuck counters are at most 0.05 seconds, not evidence of a persistent stuck loop. This short run does not establish an entire mountain ascent or rule out later traffic jams.

In the final run, inclusive phase totals are AI updates 59.51 s, player physics 49.44 s, track advance 22.85 s, weather cell integration 10.00 s, detailed AI physics 5.41 s, checkpoint work 2.39 s, and water flow 1.80 s. These overlap and must not be added. In its five worst frames, weather cell integration is only 0.20–0.50 ms; spikes are mainly observed inside player physics and AI updates, with checkpoint work sometimes contributing. Only one of ten updates above 100 ms overlaps a recorded GC event. Process CPU time exceeds wall time on several spikes, so thread activity must be distinguished from main-thread algorithm cost before attributing the remaining stalls. These measurements do not establish that weather or garbage collection alone causes the remaining hitches.

Validation includes packed-sampler overlap/material/revision parity, weather history/checksum parity through rain/snow/freeze/thaw, and a nonzero downhill water-transfer test after 60 seconds of dormant-cell catch-up. That test verifies the next transfer remains capped at 22% of source water and conserves water between the two cells. It protects against multiplying flow by dormant duration; it is not a claim that this arcade water model is a full hydrodynamic simulation.

The focused suite passes 202 tests. Browser/GPU and GitHub Playwright verification remain outstanding; nothing was merged. The 16.7 ms total-frame target is still unmet at the tail, even before rendering.

## Player physics audit: 120-second isolated scenarios

Added opt-in `RTG_PLAYER_PROFILE=1` detail to the benchmark phase profiler. It measures the player runner's fixed steps, authoritative environment callback, tire subsystem, body collision subsystem, chassis integration, support history, and recovery. The callback is wrapped on `vehicleDynamicsAuthority`, because RaceSimulation reassigns the runner callback on every update. A named player-advance wrapper also lets the sampled profile distinguish player stacks from detailed AI stacks. These changes are diagnostic tools only; vehicle equations, stepping frequency, and gameplay remain unchanged.

Each scenario runs 7,200 simulated frames on the mountain benchmark, excluding the first 300 for analysis. All use night/brightness zero; clear versus full storm isolates precipitation while holding lighting constant. Storms have 60 seconds of prewarming. All current optimizations remain enabled. These are Node simulation measurements with phase timers, V8 sampling, and GC observation, not rendered FPS. Sequential phone runs have varying CPU clocks and observer overhead, so timings are observations, not controlled causal speedup estimates.

| Scenario | Median | P95 | P99 | Worst | Updates >100 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clear, player only | 4.25 ms | 6.55 ms | 7.96 ms | 167.46 ms | 1 |
| Full storm, player only | 4.77 ms | 14.34 ms | 16.17 ms | 29.29 ms | 0 |
| Full storm, player +29 AI | 19.93 ms | 49.31 ms | 84.38 ms | 728.17 ms | 55 |

### The player timer includes shared world work

`VehicleDynamicsRunner.advance()` invokes `onFixedStep` after each `runStep()`. The race callback advances shared Track State, processes contacts and checkpoint maintenance. This is inside the old `playerPhysics` timer. Therefore calling that timer's entire duration "vehicle dynamics" was misleading.

| Mean per measured frame | Clear /0 AI | Storm /0 AI | Storm /29 AI |
| --- | ---: | ---: | ---: |
| Inclusive player runner | 3.41 ms | 4.66 ms | 10.38 ms |
| Actual player fixed-step calls | 3.14 ms | 3.36 ms | 5.74 ms |
| Shared Track State advance | 0.15 ms | 1.17 ms | 4.35 ms |
| AI update | <0.01 ms | <0.01 ms | 12.98 ms |

These timings overlap: shared track advance belongs inside the inclusive player runner. Shared track advance accounts for approximately 25% of the player timer in storm/0 AI and 42% in storm/29 AI. It grows as AI adds track mutations and active weather cells. The player performs exactly 13,800 fixed steps in every measured window, with zero `recoverFromPenetration` calls. Extra tire/body calls above the fixed-step count are only 7, 4, and 6 respectively. There is no evidence here of a runaway player recovery loop or excessive physics catch-up.

Within actual player steps, the largest measured subsystem is tires (including powertrain), followed by chassis integration, body collision, and environment lookup. In the crowded storm run their mean inclusive times are approximately 2.10, 0.89, 0.85, and 0.75 ms per frame respectively. These leave other step bookkeeping and mechanical work. Shared `VehicleDynamicsRunner`, tire, and powertrain improvements can also benefit detailed AI; distant AI does not execute all these paths.

### Bounded cell count is not bounded integration work

The weather scheduler limits selected background **cells**, but `catchUpCellWeather` can replay many historical 100 ms steps for each selected cell. New-cell initialization and contact reads also request weather catch-up. Observed maximum weather integration calls per frame: 8,483 for storm/0 AI and 17,676 for storm/29 AI.

In storm/0 AI, 1,053 frames with more than 1,000 weather integrations have median update 12.76 ms; the other 5,847 frames have median 4.47 ms. Their average shared track advance costs are 7.28 ms and 0.067 ms respectively. At frame 7037, 7,827 weather integrations occur; track advance costs 12.94 ms while the two player fixed steps together cost 2.83 ms. This establishes recurring weather catch-up bursts separately from rare runtime stalls.

Next work should bound replayed cell-steps, prioritize current contact cells, and incrementally service distant work. Do not enlarge integration dt or multiply downhill transfers by dormant time. Simply postponing all weather could move the hitch to the moment a car arrives. Exact snapshots, forcing-history changes, drainage order and mandatory current contact reads require explicit tests. A lower-risk first optimization is reducing repeated mutation/visual/checkpoint bookkeeping during one cell's contiguous catch-up while preserving state and snapshot boundaries.

### Rare hitches remain a separate problem

The clear run has one 167 ms update with just two player steps and no recorded GC overlap. In the crowded storm run, only 18 of 55 updates over 100 ms overlap a recorded GC event. At its worst update, weather integration is 9.06 ms, player fixed steps 88.81 ms, and AI updates 587.45 ms, despite normal step counts. The next-worst update similarly inflates several independent phases. Process CPU exceeds wall time on these spikes (all process threads are included), which is insufficient to distinguish compilation, GC workers, scheduling, or other runtime effects by itself.

A separate `--trace-opt --trace-deopt` run investigates optimization churn. Diagnostic wrappers and trace logging can themselves perturb optimization and timing, so deoptimizations are evidence to investigate, not proof that they cause the browser's hitches. Avoid interpreting broad category "Chassis/physics integration" from sampled profiles as only `integrateChassis`: nearest-frame classification also includes runner orchestration and some profiler overhead.

Artifacts: `player-audit120-comparison.json`, `{clear,storm}-autodrive-player-audit120-{clear0,storm0,storm29}-cpu.json`, corresponding profiles, phase summaries and stall summaries under `artifacts/mountain-stress/`. The crowded run's final checksum is `fad5d165`, matching the preceding optimized benchmark. Browser/GPU performance remains unmeasured.

The completed 120-second optimization trace records 295 deoptimizations after the first 300 frames, including 178 `wrong map` events. `runStep` accounts for 13, `advanceRaceAiDistantPhysics` for 9, and `stepTerrain` for 8; anonymous/ambiguous method names are not treated as unique components. Events continue through the final ten seconds. This supports investigating stable object layouts across player/AI/recovery modes, but does not prove a causal frame-time improvement from changing them. The trace run preserves the sampled run's final player state, all AI states, and checksum `fad5d165`. Summary: `player-trace120-deopts.json`; raw trace: `player-trace120.log`. All five diagnostic tests pass, including player-provider reassignment, exclusive sampled attribution, GC interval accounting, and deoptimization-log parsing. `git diff --check` passes.

## Budgeted weather and physics allocation pass

Implemented after the player audit:

- Runtime Track State, including the worker authority, limits background replay to 2,048 cell-steps per 100 ms tick. Standalone TrackState defaults to the legacy unlimited-work policy; callers may override `maxWeatherStepsPerStep`. Selected cells share the allowance, and the selection count never exceeds the allowance, preventing starvation when configured below the cell-count cap. Integration retains its original 100 ms step and per-step quantization.
- Current wheel/contact reads remain synchronous and exact. The cap applies to **background work**, not all weather work in a frame. A cold contact read or new-cell initialization can still need additional work. Counters distinguish background replay from total weather integration calls.
- Only fully caught-up source and receiver cells participate in budgeted background flow. No receiver is created or replayed by that path. The existing 22% source-water transfer cap remains. This deliberately reduces distant runoff frequency and expansion into unvisited cells; it is not bit-identical to the old background hydrology schedule. It avoids increasing the time step or multiplying water transfers by dormant time.
- A contiguous catch-up prepares mutation/checkpoint bookkeeping once, then publishes the same final revision counts. Each weather integration and conservation-total addition retains its original order. This change alone preserves checksums.
- Budgeted snapshots add optional weather scheduling metadata: work allowance, active list/cursor, pending wake order, insertion order, and maintenance queue. Older snapshots remain readable. Saving/loading a partly caught-up map, including later changes between rain/snow/clear, resumes deterministically. Unlimited-work snapshots keep the prior format.
- Tire, brush-tire, powertrain, control, assist, and pooled substep records retain existing fields when possible; fields absent from new source settings are removed. Transient tire overlays are reset before recomputation. Automatic gearbox calculations pass the small set of overrides directly instead of spreading the entire tuning object on each call. Missing gear arrays use the existing empty-array ratio fallback consistently.

Validation: 117 focused tests pass (weather, snapshots/sync, tire force, powertrain, shared physics replay, assists, state and contact transactions), plus the diagnostic profiler checks. New tests cover actual background work bounds, fairness, exact on-demand catch-up through weather transitions, water transfer restrictions/conservation, deterministic saved scheduling, and reused tire inputs versus fresh models after fields disappear.

A broader cross-frequency tire-energy test still fails on quantization and contact-generation fields at 240 Hz versus 120 Hz. Reverting this pass's runner record-copying changes reproduces the same failure; that fixture injects its own tire subsystem and does not execute the modified tire/powertrain code. Evidence is retained in `substep-prior-record-behavior.log`. Other unrelated editor/worker fixture failures appeared in the broad exploratory run; this pass does not claim the whole repository suite is green.

The completed 120-second unbudgeted parity run (29 AI, full storm, night/brightness zero) matches the previous player audit **exactly** for final player state, every AI state, and track checksum `fad5d165`. Its measured median/P95 are 17.27/37.52 ms, but clock variation and the previous audit's V8 sampling mean these are not a controlled speedup ratio. Artifact: `storm-autodrive-weather-budget120-parity-cpu.json`.

### Final budget validation

Both final budgeted runs completed 7,200 frames on the final scheduler/save implementation. No heavy tests ran concurrently with these final runs. The first 300 frames are excluded below. `weather-budget120-comparison.json` contains the numbers.

| Run | Median update | P95 | Worst | Peak background cell-steps/tick | Peak total weather calls/frame | Total weather calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New vehicle code, unlimited weather, 29 AI | 17.27 ms | 37.52 ms | 399.62 ms | 16,445 | 17,676 | 9,748,497 |
| Budgeted weather, 29 AI | 31.41 ms | 52.93 ms | 569.76 ms | 2,048 | 3,955 | 4,750,264 |
| Budgeted weather, no AI | 9.82 ms | 17.72 ms | 247.49 ms | 2,048 | 2,074 | 1,984,322 |

The crowded case performs **51.27% fewer weather calls**, and peak calls fall **77.63%**. The actual background work cap is enforced, while remaining contact/initialization work explains why total weather calls can exceed 2,048. All runs record zero sampled below-road AI, AI resets, and pending AI physics backlog.

**Raw timings got worse in the budgeted runs; do not claim an overall frame-rate improvement from these measurements.** The phone execution environment varied: the second sampled CPU frequency had median 2,668,800 kHz in the unlimited run versus 883,200 kHz in the crowded budgeted run. Mean actual player fixed-step time also doubled (4.08 to 8.08 ms/frame) despite unchanged step counts. Frequency samples do not establish which core executed each frame, so they explain why comparison is confounded, not a precise normalization. Browser/GPU timing and steady 60 FPS remain unverified/unmet.

A separate six-round alternating in-process benchmark isolates background scheduling: 8,192 flat cells over 240 storm ticks. Median background time is **1,188.21 ms unlimited versus 666.05 ms budgeted (43.95% reduction)**. Foreground reads are excluded from that timing and subsequently checked for exact per-cell parity between both states. This measures cheaper/deferred background work, not total simulation speedup or reduced work if every cell is immediately queried. Tool: `tools/loadtest/benchmark-weather-budget.mjs`; results: `weather-budget-isolated.json`.

No claim is made that all V8 deoptimizations are eliminated. This pass removes identified full-object copies and clear/repopulate operations; quantifying remaining optimization churn requires another trace under comparable conditions. No changes were committed, merged, or pushed during this pass.

### Visible cars and strict recovery — 2026-10-29

AI scheduling/director code does not use camera/frustum visibility to promote
physics. The visible sprite path nevertheless rebuilt tuning for wheel placement
before checking already-authoritative wheel poses. Tuning construction also
creates built-in vehicle profiles. Wheel rendering now resolves tuning lazily,
only for the legacy position fallback. Visible shadows use prepared surface
geometry at car height when a world bake exists; unavailable samples retain the
legacy fallback.

Alternating six-round Node microbenchmark, 29 cars × 60 wheel-layout calls:
median sampled batch time was 125.24 ms with eager tuning versus 5.98 ms with
lazy tuning. This measures one CPU path, not GPU work or whole-game FPS.
Raw timings: `artifacts/visible-car-wheel-work.json`.

Recovery history now verifies each loaded tire's center and both width edges
against valid `road` geometry at its contact height; terrain, shoulders, unloaded
wheels and inverted poses are rejected. Worker snapshots use their explicit
wheel contact fields. The newest valid sample is eligible immediately, and safe
samples no longer expire while the car is stranded; the queue remains bounded.
The final reset equilibrium solver still checks upright four-wheel road support.

All 17 focused recovery/visible-car/depth-sprite checks pass. Broader equilibrium
and symmetry suites have six failures, reproduced with the pre-change recovery
and render code through `artifacts/recovery-before-loader.mjs`; they are not
introduced by this patch. Logs: `artifacts/recovery-visible-regressions.log` and
`artifacts/recovery-before-baseline.log`. Phone/GPU verification remains pending.


### Visible tire artwork: controlled CPU investigation — 2026-10-29

`tools/loadtest/benchmark-visible-car-art.mjs` replays saved RTG/CT/PZ/BUSE
front-diagonal artwork through the real billboard and tire-cylinder painters.
Its Canvas context records commands without rasterization. It intentionally
excludes physics, terrain, browser compositing, GPU uploads and whole-frame FPS.
The initial harness used a Proxy for the mock Canvas itself; those preliminary
`baseline`, `verified-*` and `profile` timings include harness overhead. Use the
`stable-*` results, whose Canvas methods are stable plain functions, for CPU
comparisons. Artwork dimensions are read from actual saved assets and cached
with file modification timestamps; asset decoding is outside the timed loop.

The profiler and tire/FX isolation identify the tire-cylinder drawing path,
particularly the per-triangle bounds Proxy, as a major visible-car cost. Each
visible diagonal wheel draws 48 clipped textured triangles. The 29-car fixture
issues 2,784 clips per repaint batch. Previously every transformed `drawImage`
expanded sprite bounds using the entire source texture, ignoring clipping.

The wheel painter now supplies one conservative analytic outer bound, then
issues the identical triangle commands directly to Canvas. No geometry detail,
artwork, steering, wheel spin or tire physics is removed. Tests compare complete
paint-command sequences and verify all triangle vertices fit the recorded bounds
at front, side and diagonal views, including transformed contexts.

Controlled 120-batch comparison (29 cars, actual saved artwork dimensions):

| Metric | Before | After |
| --- | ---: | ---: |
| Median CPU artwork batch | 10.69 ms | 3.12 ms |
| P95 CPU artwork batch | 14.77 ms | 5.08 ms |
| Recorded cropped area per batch | 9,821,496 px | 7,323,861 px |

CPU median falls about 71%; conservative cropped area falls about 25%. The area
is before texture-size rounding, not measured GPU bytes. Real runtime caches AI
art at up to 30 Hz and culls offscreen cars, whereas this deliberately repaints
all fixture cars in every batch. Do not interpret these numbers as game FPS.

Reproduce before with `MODES=full FRAMES=120 CARS=29 TAG=stable-before node
--expose-gc --loader ./tools/loadtest/visible-car-art-baseline-loader.mjs
tools/loadtest/benchmark-visible-car-art.mjs`, and after without the loader and
with `TAG=stable-after`. Reports are under `artifacts/visible-car-art/`.

Remaining visible-car work: triangle rasterization itself, texture uploads and
scaled-layer canvas churn (2,537 allocations in the 120-batch fixture). GPU cost
still requires an actual browser/device capture. Runtime render diagnostics now
include `threeCarSpriteUploadedPixels` and `threeCarSpriteTextureResizes`, alongside
paint/reuse counts and sprite CPU time. All 80 related rendering/art/FX regression
tests passed; the final 13 wheel/depth tests also cover the new counters.
