# Mount Washington stress scenario

The saved Mount Washington Auto Road race now contains 8,948 deterministic tree
placements outside the road corridor and six connected perimeter fence paths
(10,716 repeated guardrail panels). Together these make 19,664 scenery
placements. Road clearance is checked against the entire route, including
switchbacks, rather than only the placement's source road segment. The closest
tree center is 14.80 m outside the road edge.

The grid contains the player and 29 opponents. The authoring slider, car pool
selection, serialized configuration and runtime now share a 29-opponent limit;
ordinary existing races keep their current counts. Storm intensity is 100%,
with automatic visibility. Maximum rainstorm was heavier than maximum snowfall
in the initial local CPU comparison. This is the game's severe-storm setting,
not a claim that it reproduces all hurricane physics.

The terrain uses `providenceGround`. Road and margin settings are copied from
P1: `asphaltRoad` at 3 m length and width repeats, plus `apron`. The prior saved
race is retained through the storage API's version mechanism.

## Implemented optimizations

- Stationary sprite scenery shares material/spatial batches, using the existing
  128 m fence batching path. Animated pickups and model instances remain
  separate. Collision placements are unchanged. The stress scene retains all
  39,328 scenery triangles in 374 render meshes.
- Off-road nearest-route queries use an exact bounding-volume tree instead of
  scanning every segment when the local road bucket cannot resolve a point.
  Tests compare this with exhaustive search across long, curved routes.
- Race startup uses the existing scoped geometry read cache.
- AI footprint probes use the prepared canonical terrain query frame for
  geometry, avoiding repeated full material/weather/road reconstruction for
  each footprint point. Missing support stays missing instead of becoming
  height zero. Material and weather calculations still run for each wheel's
  primary contact.

These follow the batching guidance in [MDN's WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
and the bounding-volume requirements in the [Three.js documentation](https://threejs.org/manual/pages/how-to-update-things.html).
No renderer, physics engine, or mandatory dependency was replaced.

## Reproduction and limits

`node tools/loadtest/create-mountain-stress.mjs` creates a candidate and setup
report under `artifacts/mountain-stress`. `--save` persists it with a version
backup. This requires the development server on port 8000 and the saved car,
artwork, doodad and P1 files. The generator replaces only its own prior stress
placements on repeated runs.

`node tools/loadtest/benchmark-mountain-stress.mjs storm 360` exercises the
production prepared-world transfer package and 30-car runtime in Node. Replace
`storm` with `snow` for comparison. This runs synchronous fallback physics;
it is **not a browser FPS test**, does not time GPU rendering, and does not
measure the browser worker/main-thread split. The short comparison's median
update time fell from about 637 ms to about 331 ms locally. These measurements
are nowhere near a 16.7 ms total frame budget. Do not advertise 60 FPS support
for this scenario on the basis of these results.

The longer 360-update run retained all 30 cars and measured 314 ms median,
588 ms p95, and 802 ms p99 per synchronous update. It covers six simulated
seconds with straight-ahead throttle, not a complete ascent or a browser
playthrough. The remaining CPU cost is predominantly AI vehicle updates.

`node tools/loadtest/benchmark-mountain-scenery.mjs` isolates geometry batching
with flat ground and no GPU. It verifies triangle retention and measures warm
scenery synchronization separately. The initial result was 374 meshes with
roughly 8 ms median warm synchronization locally.

The remaining major expense is running 29 full vehicle simulations alongside
the player. Hardware/browser profiling and further AI/physics scheduling work
are needed before claiming this stress case meets 60 FPS. Artifacts are local
performance evidence, not files to stage indiscriminately.

## AI optimization follow-up

The next pass reuses the player's conservative swept terrain classification for
AI cars and supplies the shared prepared static collider world. Smooth supported
roads may skip dense probes; discontinuities, unsupported terrain, bottoming,
and roll still request collision handling. Wheel centers now use the prepared
terrain frame and its material-signature cache. The editor wrapper also forwards
already-computed AI contact state instead of silently resampling it.

Racing-line surface decisions run at 10 Hz within 60 m of the player, 4 Hz within
180 m, and 2 Hz beyond that. Decisions use simulated elapsed time, are staggered,
and refresh immediately on approach or track-state replacement. Steering,
traffic avoidance, braking and the actual 120 Hz vehicle physics remain active.
This is a decision-frequency optimization, not distant vehicle physics LOD yet.

The latest 120-update Node storm run measured 207 ms median and 257 ms p95,
with all 30 cars retained. Method instrumentation includes nested calls and cold
startup: AI vehicle physics totaled 15.3 seconds, AI contact queries 2.3 seconds,
and the older longitudinal calculations 1.6 seconds. These totals must not be
added as independent frame costs. No 60 FPS claim is justified. The next major
work is a cheaper distant-car simulation with continuous progress, safe handoff
to full physics near the player, and full-route/browser validation.

## Distant chassis model

Healthy opponents now use a terrain-following bicycle chassis beyond 45 m,
retaining the existing tire/engine longitudinal acceleration, braking and speed
planning. They return to full physics inside 30 m. Both distances grow by two
seconds of relative closing speed. This hysteresis prevents repeated handoffs.
The player always uses the existing full vehicle simulation.

The cheap path requires four supported road contacts and rejects nearby static
colliders, close opponents, road steps, off-road contact, sliding, airborne or
rolled cars, active reset holds, and mechanical failures/damage. Position and
heading are integrated in world space, not snapped to the route centerline.
Fuel and mechanical state continue advancing. Full-physics restoration rebuilds
solver caches while preserving position, velocity, persistent condition and
simulation time. This model simplifies distant suspension/airborne dynamics;
it does not claim identical handling to the full solver. Optional worker mode
currently retains full simulation for every opponent.

Tests cover position/speed/clock preservation, ongoing fuel consumption,
collision/terrain guards, approach hysteresis and actual RaceEditor progression
and return to full physics. The final 180-update local run with the terrain-step guard recorded
121 ms median and 207 ms p95, with 18 distant opponents
late in the run. This remains a short CPU test, not a full ascent or browser FPS
validation. `RTG_AI_PROFILE=1` enables nested method timings in the benchmark;
results also retain each opponent's final progress and check for non-finite
positions/speeds. Remaining work includes further reduction of per-car contact,
control and surface-event work, plus complete-route and browser/GPU profiling.

## Moving-grid validation and contact-query fixes

An opt-in `RTG_AUTODRIVE=1` benchmark now steers/brakes through normal player
input instead of holding throttle on a straight. It records actual route
progress, completion, opponent fallback reasons, source digest, and timings
excluding the first five updates. SIGINT saves a partial result rather than
claiming completion. `RTG_CPU_PROFILE=1` captures a CPU profile beginning at
frame 300 (override with `RTG_CPU_PROFILE_START_FRAME`).

This exposed missing altitude in AI contact queries, previously projecting
some elevated-road queries from near zero height. AI query sessions now carry
physical altitude, initial chassis attitude follows the grade/bank, and moving
initial states include the road's vertical velocity. Tests cover a road above
500 m and braking on a 10% storm hill. AI detailed physics now runs at 60 Hz;
the player's rate is unchanged. The corrected hill test and existing steering,
recovery, and rendering tests pass at this rate.

Distant AI reuse their exact wheel geometry for surface effects and for the
next unchanged pose. Dynamic Track State is sampled again. Pose, bake, or
Track State replacement invalidates reuse. Traffic selection uses conservative
swept oriented rectangles, replacing oversized circles that unnecessarily
promoted side-by-side cars to full physics.

The moving-grid test is materially harder than the earlier startup timings:
900 updates covered only 187.7 m (15 simulated seconds), with all 30 cars, and
measured 222 ms median / 319 ms p95. The full route was NOT completed. Nested
steady AI physics time was 96.1 seconds, legacy longitudinal work 17.2 seconds,
and contact queries 11.7 seconds. These overlap with aggregate AI timings.
Actual bunching, roadside obstacles and off-road cars still increase full-solver
usage. The 60 FPS objective remains unmet; no browser/GPU FPS is claimed.

## Driver commands, collision allocations, and road profile keys

Detailed AI now computes driver throttle/brake/gear commands once and takes its
wheel-slip/lock/temperature presentation from the authoritative chassis/tire
telemetry. It no longer runs a second longitudinal force model before the full
solver. The distant solver still uses that longitudinal model; worker mode also
keeps its existing path until equivalent tire telemetry is available there.

Static collider segment/triangle intersection uses cached triangle edge scalars
and scalar arithmetic on misses, avoiding temporary vector allocations. A frozen
reference parity test covers 20,000 deterministic randomized segments plus
coplanar and zero-length cases, with exact hit/normal/fraction agreement.

Road surface profile caches now group short distance keys by geometry revision.
The scoped geometry read cache resolves each bucket once, avoiding repeated
concatenation/hashing of the full imported-track signature. The original quarter
metre cache quantization is unchanged. Cache invalidation also clears scoped
bucket references. Four revision buckets, each bounded to 4097 samples, limit
retention. Tests cover shoulder variants, distance reuse, revision changes, and
explicit invalidation within a read scope.

Validation: 58 AI/contact/cache tests pass. The broader collision run has 131
passes and 25 failures in high-energy runtime tests. Four representative failures
(flat floor at 300 mph, sloped floor at 60 m/s, triangle seam at 300 mph, narrow
crest at 60 m/s) reproduce with the original vector intersection implementation
loaded through a test-only Node module hook. This is not a claim that all 25
failures have been individually baseline-verified. Logs and the hook are under
`artifacts/mountain-stress/`. The 20,000-case direct parity test passes separately.

Per-body-point swept bounds now reject unreachable triangle groups before
intersection. Padding includes solver tolerance and barycentric/endpoint epsilon.
Convex solids and open sheets can reject the whole candidate; solid-below and
other half-space mesh overlap checks remain intact. Five hundred randomized
moving/rotating body sweeps match unfiltered impact events exactly while reducing
triangle checks from 37,500 to 11,855 (68%). The solid-below regression confirms a
point below a mesh still receives penetration recovery despite skipping triangle
sweeps. Nine focused collision/cache tests pass.

Two completed 900-update/30-car/full-storm moving-grid measurements:

| Revision | Median CPU update | p95 | p99 |
| --- | ---: | ---: | ---: |
| Before scalar/control/cache changes | 209.8 ms | 346.0 ms | 706.0 ms |
| Scalar intersections + commands + short profile keys | 132.0 ms | 202.6 ms | 339.6 ms |
| Plus per-point collision bounds | 102.4 ms | 169.6 ms | 190.6 ms |

All finish at the same player distance, 187.6629 m, with 29 AI plus the player.
These are CPU-only samples, NOT full-ascent completion or browser FPS. The phone
CPU governor varied substantially during the second run (CPU7 readings 883,200
and 2,668,800 kHz), so exact percentage speedup needs repeated controlled timing.
Independent collision work counts confirm reduced work rather than fewer cars.
The latest steady profile no longer lists collision triangle loops among its
30 largest self-time entries. GC, chassis integration, tire simulation, terrain
sampling, and repeated settings/signature reads remain significant.

Artifacts: `storm-scalar-cache-cpu.json`, `storm-point-bounds-cpu.json`, matching
`.cpuprofile` files, `point-bounds-tests.log`. The benchmark source digest now
also includes RaceEditor, RaceAiControls, and StaticRaceColliderWorld. No 60 FPS
claim is made; full ascent and browser/GPU verification remain required.

## Rotation allocations and remaining road lookups

Quaternion vector rotation now uses scalar intermediates while preserving the
original arithmetic order and malformed-input fallback. Twenty thousand random
cases and non-finite/degenerate inputs match the old vector result exactly. Road
corridor caches now use revision buckets with short distance keys, and roadbed
profiles reuse resolved entries within a synchronous read scope. Explicit sample
arrays bypass those caches. Geometry invalidation clears the scoped references.
Selected race/car lookups avoid allocating callbacks and retain saved-identity
precedence, fallback selection, and immediate visibility of editor changes.

The final targeted run passes 67 AI/cache/rotation/inertia/collision tests. The
full original-vector high-energy reference run completed with 126 passes and 25
failures; its failure names exactly match all 25 from the earlier scalar run.
The latest complete high-energy run (including point bounds and scalar rotation)
is recorded separately in `current-full-collision-tests.log` and must be checked
before claiming broad collision validation.

The next 900-update startup comparison recorded 55.1 ms median, 74.0 ms p95,
102.7 ms p99, and identical player route progress. Its CPU7 clock samples were
roughly 4.0–4.65 GHz, considerably faster than some earlier measurements; do not
attribute the full elapsed-time change to source changes. Output is
`storm-autodrive-road-cache-rotation-cpu.json` with matching profile/log. The
benchmark now records CPU clocks where available and accepts
`RTG_BENCHMARK_TAG` to preserve separate results.

### Mature storm and full ascent scope

Audit found that previous startup runs used authored storm intensity 100% but
still followed the normal storm buildup. They did **not** establish peak
wet-road performance. `RTG_FULL_WEATHER=1` now uses the existing debug weather
path to start at peak storm forcing. `RTG_WEATHER_PREWARM_SECONDS=120` advances
the actual Track State weather simulation for two minutes before driving, rather
than injecting arbitrary grip values. Initial/final weather forcing is recorded
in results. The one-frame `mature-storm-smoke` check initializes all 30 cars,
19,664 placements, and confirms effective storm intensity 1 with 120 seconds of
pre-wetting. It is only an initialization test, not a performance or driving test.

Full-route command (still requires completion and browser/GPU verification):

```sh
RTG_AUTODRIVE=1 RTG_FULL_WEATHER=1 RTG_WEATHER_PREWARM_SECONDS=120 RTG_BENCHMARK_TAG=full-ascent node tools/loadtest/benchmark-mountain-stress.mjs storm 60000
```

No renderer is exercised by this Node command. Browser rendering remains a
separate required measurement; the 60 FPS goal is still unproven.

## Full-ascent run and further allocation cleanup

The complete current high-energy suite finished with the same 25 failure names
as the original-vector reference (no new failures). This covers scalar rotation
and per-point collision bounds as well as scalar intersection; the known
high-energy failures remain unresolved.

A 60,000-update full-ascent run was launched using peak storm forcing and 120 s
of Track State pre-wetting. Its live log is `full-ascent.log`; final output will
be `storm-autodrive-full-ascent-cpu.json`. It is not complete merely because the
process was launched. The process retains source digest
`a1bee1d766fa3443f4eb4303771372acb2c19a47fe64850b176dba8b48918dd3` and does not
include changes made after launch. Actual completion, route progress, all 30
cars, weather state, and timing must be inspected when it terminates.

Subsequent changes: unchanged margin settings and normalized tile maps are
reused within each synchronous geometry-read scope. Object replacement,
geometry invalidation, and the next scope force normalization again. Tests
verify all three invalidation routes; the AI/terrain/cache suite has 67 passes.
Detailed AI now reuses a compatibility presentation container per runner via a
WeakMap rather than discarding its reusable records every frame. Runner
replacement resets the container/profile. Thirteen driving, handoff, recovery,
and control tests pass, including assertions that body/suspension records are
reused. These changes have not yet had an isolated performance measurement.

## Exact wet-history initialization reuse

Newly encountered wet cells previously replayed their full weather history
independently. A bounded 16-profile cache now shares the exact quantized weather
recurrence for untouched cells with identical initial water/temperature,
exposure, drainage, permeability, saturation, compaction, heat-response and
history-base values. Already-existing cells, tire contamination, runoff and
per-cell changes retain independent simulation. Timeline replacement, history
rebasing and older-step requests invalidate or bypass reuse.

The cache records per-step precipitation/evaporation/drainage contributions and
replays their additions in their original order, rather than multiplying a
rounded aggregate. Cell sample revisions and visual revisions also retain the
original mutation counts; checkpoint mutation is prepared before applying the
cached state. This preserves exact cells, totals and canonical snapshots in
storm, freeze/thaw and changing-weather comparisons. Twenty same-profile cells
after 120 s of storm require 1,200 weather recurrence calls instead of 24,000.
All 58 Track State tests pass, including replay/checkpoint/worker ownership.

The original full-ascent attempt was intentionally interrupted after this fix
was validated: 1,931 updates, 408.24 m, all 30 cars, peak storm. It recorded
162.9 ms median / 390.4 ms p95 / 589.1 ms p99 at often-low CPU clocks; concurrent
unit tests also mean these are diagnostic timings, not a controlled A/B result.
Its log/result are preserved and explicitly say `interrupted:true`,
`finished:false`. It is NOT a completed ascent.

A fresh complete-route attempt now runs with the wet cache and preceding
normalization/presentation reuse changes. Inspect
`full-ascent-wet-cache.log` and, once complete,
`storm-autodrive-full-ascent-wet-cache-cpu.json`. Do not restart this process just
because polling is slow. Check its live handle/process and actual progress.
The benchmark digest now includes TrackState.js. Completion and browser FPS
remain unverified.

## Live allocation evidence and geometric temporary objects

Attached the local Node inspector to the existing wet-cache ascent without
restarting it and collected 20 seconds of sampled allocations, including
objects reclaimed by minor/major GC. See `live-allocations.heapprofile` and
`live-allocations.log`. Sampling introduces overhead; this window is diagnostic,
not FPS evidence. Large sampled allocation sites included quaternion rotation
(162.8 MiB), string joins (155.8 MiB), tread validity (108.5 MiB), wheel feature
points (103.9 MiB), route candidate projection (100.8 MiB), and convex overlap
(76.3 MiB). These are allocation estimates across the window, not retained heap.

Post-launch optimizations preserve the original math:
- Route projection retains only the winning candidate's scalars and constructs
  one result. It exactly matches a frozen reference on 2,000 route/far-field/
  duplicate-point queries, including tie behavior.
- Convex overlap retains the closest plane reference rather than allocating
  temporary plane copies for candidates that may ultimately miss.
- Wheel feature points compute radial and offset sums without intermediate
  vector objects. Twenty thousand randomized constructions match the original
  vector arithmetic exactly.

Nine projection/static-collision tests pass. The wheel run has 14 passes and
one failure (`WRX2 curb impact remains identical ...`); loading the original
wheel feature function reproduces that same 5 m/s curb failure with identical
reported position and velocity. See `reference-wheel-tests.log`.

Allocation call stacks also exposed benchmark-only work: the automatic driver
was querying road geometry outside the synchronous read cache. Subsequent
benchmark runs now share the scope across automatic-driver decisions and the
simulation update. They record `driverMs`, `updateMs`, total `frameCpuMs`, and
separate percentile series. Use total frame CPU for conservative budget analysis
so moving signature work into the driver phase cannot make it disappear from
the result. The currently running ascent predates this harness correction and
these geometry changes; it remains useful for complete-route diagnostics, not
final-version FPS verification. Its source digest is retained in final output.

## Starting grid obstruction and corrected full-ascent attempt

Live inspection found AI20–29 stalled around x1696/z-805 behind a fence at
x1693.49. The six-fence stress perimeter enclosed authored road nodes only;
the 29-opponent grid extends farther behind the start and crossed that fence.
The generator now includes actual `createRaceAiRuntime` spawn positions in its
bounds, with 130 m clearance. Two regression tests cover the whole 30-car grid
and invalid geometry. Saved scenario retains 8,948 trees and six fences, now
10,932 panels (19,880 scenery placements). The prior candidate is preserved as
`candidate-fence-obstructed.json`; the storage save preserves a prior version.

The obstructed wet-cache run was intentionally stopped with SIGINT after the
fix was validated. Its partial result remains diagnostic, not a complete lap.
The new `full-ascent-clear-grid` run includes the corrected fence layout,
geometry allocation reductions, tread-contact vector scratch reuse, and the
benchmark driver geometry-cache scope. It still requires a completed ascent
and browser/GPU verification. No 60 FPS claim is supported yet.

Tread validity now reuses per-wheel vector scratch and quaternion rotation can
write into an existing target. Twenty thousand exact randomized contact-validity
comparisons plus rotation alias/nonfinite cases and tire-model tests pass
(25 tests, `tread-vector-tests.log`). The benchmark source digest now includes
ContactPatchTireModel.js so this optimization is identifiable in results.

## Shared rigid-body sweep poses

Static collision sweeps now compute each slice-boundary car pose once and share
it across body points. Point transforms reuse the rotated output for translation,
removing a second vector allocation without changing arithmetic. Sweep event
points still own their storage. Seven static collision tests pass, including
200 exact full-result comparisons against the original per-point pose calculation
and original allocating transform (`static-pose-tests.log`). The running
clear-grid ascent predates this change; it is not a measurement of this latest
optimization. No change to collision candidate coverage or physics timestep.

## Clear-grid CPU profile and contact aggregation lookup

A 20-second live CPU sample of the corrected run (`clear-grid-live.cpuprofile`)
put contact accumulation first at 2,942 ms self time, followed by GC at 2,110 ms
and chassis integration at 1,002 ms. Profiling perturbs timing. Inspection of
accumulateSlice found a linear scan of up to 120 vehicle/wheel cache entries
for every contact piece. Replaced it with nested vehicle/wheel Maps, with the
lookup once per slice. Clear/restore invalidate these lookup caches as before;
aggregate ordering, event keys and floating-point additions remain unchanged.

All 60 Track State tests pass (`contact-lookup-tests.log`), including a new
30-car exact comparison against the frozen original accumulator through flush,
snapshot restoration and clear. Six alternating isolated benchmark pairs of
36,000 contacts each were faster with the Map lookup: approximately 12–30%
lower subsystem time (`contact-lookup-timings.json`). These are not whole-game
FPS measurements. The already-running clear-grid ascent predates this change;
concurrent tests also perturb its diagnostic timings. Future benchmark source
digests now include TrackStateContactAccumulator.js.

Live AI inspection at player distance 223.75 m found every opponent beyond the
start (11.11–217.28 m), moving at 9.61–17.01 m/s. The corrected fence placement
therefore resolves the original rear-grid obstruction in running simulation.

## Path sample lookup within read scopes

The clear-grid CPU sample attributed 472 ms self time to getRacePathSamplesCached.
Although geometry signatures were already scoped, each query still looked up
samples using the long signature. The synchronous geometry read scope now also
holds sample arrays by numeric sampling interval. Both legacy and network paths
reuse their existing persistent caches on the first query. Runtime surface cache
invalidation clears the scoped sample map; leaving the scope requires signature
validation again on the next call. Ten cache/projection tests pass, covering
1,000 repeated lookups, multiple intervals, explicit invalidation, subsequent
scopes, edits, network geometry, and exact projection parity. See
`path-sample-scope-tests.log`. The running ascent predates this change; no
end-to-end speedup is claimed yet.

## Weather queries and stopped traffic

Weather overrides now copy only weather, intensity and visibility, rather than
the full authored race object per query. Eleven weather tests pass, including
exact comparisons with the original method across presets, trigger overrides,
debug overrides, invalid/intensity values and elapsed time. See
`weather-query-tests.log`.

Live inspection around player distance 708 m found several queued opponents
with target speed zero, brake zero and negative speed: they were rolling back
on the grade. Driver controls now hold full brake below 0.5 m/s when the target
is at most 0.05 m/s, releasing as soon as a forward target returns. This keeps
normal approach braking proportional. Ten AI controls/distant-physics tests
pass (`ai-brake-hold-tests.log`), covering stopped/rolling-back hold, release,
positive creep, near physics and distant handoff. Actual uphill queue behavior
still needs a subsequent runtime verification; the running ascent predates it.

## Requested next integration: live Debug AI controls

User requested adding/removing AI racers from the race Debug screen. Implement
live session controls alongside the weather/tire entries in getRacePauseMenuItems
(around RaceEditor.js 20315). Preserve authored race AI settings. Add opponents
safely near the current race position, avoid overlapping existing cars, maintain
unique identities, and handle worker registration/removal as applicable. Remove
opponents cleanly from rendering/collision/worker state. Respect 0–29 opponents
(the player makes 30 total). Test both controls and session lifecycle; retain the
full 30-car thunderstorm performance objective.

## Live Debug AI controls implemented

Pause → Debug now has Add AI racer (current count / 29) and Remove AI racer.
These alter only the active session. New opponents reuse a loaded car, search
for a road-supported position 15–450 m behind the player, leave at least 12 m
between cars, and reject nearby static colliders. Each gets a new identity and
normal dynamics runner. Removal updates the session roster. At the limits the
appropriate row is disabled; if no clear location exists a message explains why.

Worker support shares the already-loaded immutable world when constructing a
new runner, removes opponents from the authority/input/wake tables, and clears
client history. Late removed-vehicle snapshots are ignored and transferable
buffers recycled. The player cannot be removed. Existing pause-menu row/input
layout is reused; no new portrait layout is introduced. Browser rendering and
actual device interaction have not been verified here.

Eight focused local/worker-entry/client tests passed, plus an authority removal
test; an additional late-snapshot client regression is in debug-ai-client-tests.log.
The broader worker-authority suite has three failures involving old wheel/reset
snapshot expectations. Removing the new authority method reproduces the same
three failures (baseline log also includes the expected failure of the new
removal test when its method is deliberately absent). These are not claimed fixed.
The long ascent remains running and predates the Debug feature and recent
optimizations; 60 FPS and a completed ascent remain unproven.

## Two-output differential allocation

Powertrain force allocation now has a scalar path for its normal two-output
case (axle wheels or front/rear differential). The generic path remains for
other output counts. It preserves input key ordering, proportional allocation,
capacity redistribution, thresholding and arithmetic order. Twenty thousand
random exact comparisons plus zero/negative/nonfinite/string/special-key cases
pass against the frozen original. All five allocation/AI-control tests pass
(`powertrain-allocation-tests.log`). Six alternating isolated 100,000-call
comparisons were faster (12–51 ms vs 193–239 ms) in
`force-allocation-timings.json`; this is not an end-to-end FPS claim. The benchmark
source digest now includes PowertrainModel.js.

A separate 600-update `current-combined` full-weather startup run profiles the
combined previous optimizations without interrupting the full ascent. It
predates the two-output change. Both CPU runs compete on this device, so timing
is diagnostic and not a controlled A/B comparison. The full-ascent-clear-grid
process remains live; no restart was performed.

The combined startup profile completed 600 updates / 118.67 m. Total CPU frame
median was 96.48 ms and p95 181.85 ms under concurrent load/profiling (not FPS).
GC led self time at 5,336 ms; raw ground elevation was 1,877 ms, selected-race
lookup 1,207 ms, chassis integration 1,204 ms, longitudinal AI physics 1,200 ms.
Contact accumulation was 692 ms. This points next toward ground-query and
allocation work. The full ascent was confirmed live at 1,477 m afterward.

## Numeric raw terrain lookup within read scopes

Raw terrain elevation was the leading application self-time site in the
current-combined profile. The synchronous geometry read scope now retains
numeric cell-coordinate height lookups per tile-map identity/revision. Authored
cell heights can be reused regardless of fallback elevation; hits from the old
persistent cache retain its exact quantized fallback key. Missing/unpainted
cells continue through the original calculation. Explicit surface invalidation
clears the scope map, and empty editors bypass it safely.

Fifteen terrain/cache tests passed, including 1,000 exact comparisons against
the frozen original with imported rectangular boundary extension, negative
coordinates, varying fallbacks, warmed persistent caches, revision changes and
explicit invalidation. A subsequent focused test covers an empty editor too.
See raw-terrain-cache-tests.log and raw-terrain-focused-tests.log. Six alternating
72,000-query microbenchmarks were all faster: 20–37 ms current vs 37–68 ms
original (raw-terrain-timings.json). These isolate repeated terrain queries and
are not whole-game FPS. The full clear-grid ascent remains running and predates
this optimization.

## Scoped weather calculations and AI tire-effect records

Weather state calculations now reuse a result within the synchronous read scope
when all eight relevant authored/session/debug inputs match. Each caller still
receives an independent shallow result, so consumer mutation cannot corrupt the
cache. Changes to elapsed time, triggers, intensity, visibility, or debug options
are checked on every call. Twelve weather tests pass, including 1,000 repeated
queries with output mutation and each input changed in turn. Six alternating
72,000-query benchmarks were faster (10–32 ms vs 60–67 ms), recorded in
weather-scope-timings.json. This comparison includes the prior weather-field-only
copy optimization; it is not a whole-game speedup claim.

Detailed AI tire effects now reuse owned per-opponent records for loads, slip,
contact scale, wheelspin, brake effects and temperature instead of allocating
eight records per synchronization. All four wheels are overwritten each call;
legacy-to-detailed handoff reinstates these owned records rather than retaining
unrelated legacy fields. Eleven AI control/distant-physics tests pass, including
identity, contact loss, handoff and independent-opponent checks
(ai-tire-record-tests.log). End-to-end allocation benefit remains to be measured.
The full ascent continues (1,800.6 m observed), predating both changes.

## AI lane probe geometry reuse

The surface planner evaluates five offsets at four shared distances. Its world
point callback previously recomputed road pose, section metrics and right vector
20 times per decision. A decision-local probe now computes each distance once
(four geometry queries) while preserving all 20 separate Track State samples,
scoring, hysteresis and cooldown. Ten AI probe/controls/Track State tests pass,
including exact lane coordinates, fallback/clamp behavior and fresh geometry
on the next decision (`ai-surface-probe-tests.log`). The helper is included in
future benchmark source digests.

Started `current-allocation-pass`, a 900-update CPU profile of all current
allocation/cache changes with 30 cars and prewarmed full storm. It runs alongside
the unchanged full-ascent process, confirmed live at 1,845 m. Results remain
diagnostic due to concurrency; this does not replace the full route or browser
FPS requirements. No 60 FPS claim is made.

## Failed AI recovery locations

Live inspection at player 1,872 m found AI3 still overturned around 533 m with
`Unable to converge static vehicle support`, while other opponents queued nearby.
The old recovery repeatedly requested the identical location. Recovery now tries
backward offsets 0/8/16/24/40/64 m after failures (one attempt per existing 1.5 s
dwell), rejects occupied positions within 8 m, and clears attempts after local
success or worker acknowledgment. It never advances race progress to recover.
Eleven recovery/control tests pass, including real-authority reset after a
rejected support location, traffic clearance, normal reset and worker behavior.

Location-only and captured-car-state reproductions on the newly baked mountain
both successfully reset at the original position (mountain-recovery-results.json,
mountain-recovery-captured-results.json). Thus these offline reproductions do NOT
reproduce the running race's failure: they lack its full live Track State and
solver/environment history. The recovery fallback is regression-tested, but its
ability to clear this exact live obstruction remains unverified. Captured state
is preserved in stuck-ai-snapshot.json. The original full-ascent process remains
untouched and was observed at 1,984.8 m.

The current-allocation-pass profile completed 900 updates / 184.45 m. CPU frame
median 86.14 ms, p95 195.14 ms, p99 312.53 ms under concurrent profiling/load;
not a controlled comparison or browser FPS. GC remains largest self-time site
(7,758 ms), then chassis integration (2,935 ms), runStep (2,305 ms) and legacy AI
longitudinal physics (1,889 ms). Full-route and 60 FPS verification remain open.

## Road-surface event allocation reduction

Canonical payload normalization no longer allocates a mapped entry array plus
one two-element array per object field. It visits sorted keys directly and
preserves Object.fromEntries semantics for an own __proto__ property using an
explicit data property. Numeric quantization, recursion, array holes, getter
access order and serialized key order remain unchanged. Fourteen event/parity/
integration tests pass, including 10,000 exact value and JSON comparisons
(event-normalization-tests.log). Six alternating 20,000-event benchmarks took
118–147 ms current vs 253–507 ms original (event-normalization-timings.json).
These are isolated measurements, not whole-game FPS. Added TrackStateEvents.js
to future benchmark digests. The full ascent was confirmed live after 32 minutes
wall time, beyond 2 km; it predates this change.

## Quaternion normalization temporary removed

rotateVectorByQuaternion now normalizes quaternion components into scalars,
removing its per-call normalized-quaternion object. It retains normalizeQuaternion's
input coercion, near-zero identity fallback, arithmetic order and nonfinite
fallback behavior. Twenty-six rotation/contact/tread/static-sweep tests pass
(scalar-quaternion-tests.log), including exact randomized parity and target
aliasing. Six alternating 500,000-call microbenchmarks are mixed: first two
pairs slightly slower, remaining four faster under changing CPU load
(quaternion-inline-timings.json). Therefore no isolated speedup claim is made;
the allocation is removed, and end-to-end GC benefit still needs profiling.
The live ascent is past 2,114 m and predates this change. Browser FPS and full
route completion remain unverified.


## Full-ascent memory failure and follow-up

The preserved `full-ascent-clear-grid` process terminated with V8 heap exhaustion,
not a completed ascent. Its final reported frame was 10,260 at 2,167.4 m, with
29 opponents; heap use approached 1 GB. Late updates exceeded 900 ms and the
last reported update took 1,366 ms. This older-source run does not validate the
latest optimizations or the 60 FPS goal.

The current harness supports `RTG_MEMORY_PROFILE=1` and Node `--expose-gc`.
Every 300 frames it records retained heap after explicit GC and collection
sizes for editor caches, session, track state, and each opponent runner. These
samples are written incrementally, so a failed run retains diagnostic evidence.
Explicit GC and diagnostic work are outside the timed update but this run is
for memory investigation, not an uncontaminated performance comparison.

AI wheel grip now shares one normalized setup across four wheel queries in each
longitudinal calculation. Twelve focused control/grip/storm tests pass, including
per-wheel pressure, temperature, surface, weather, and damage parity. The
prepared path avoids repeating tire-size normalization for each wheel.


### Checkpoint cadence investigation

The memory diagnostic reached 712.9 MB retained heap at frame 1500, compared
with 473.3 MB at frame zero. Live inspection showed 82,350 retained events,
an 8,192-event target, and only one completed checkpoint. Capture/assembly was
limited to 16 cells per 10 Hz surface tick. `advance` now services one bounded
slice on calls between surface ticks too; it does not freeze a new checkpoint
except at the existing completed-step boundary.

The 39 existing Track State/integration/authority tests passed. The new test
initially incorrectly expected the complete checksum to stay unchanged across
history rotation (it includes checkpoint metadata); corrected to compare cells,
physical totals, step count, and restored-checkpoint checksum, it passes.
Evidence: checkpoint-cadence-tests.log and checkpoint-cadence-regression.log.
The new 1800-frame memory-checkpoint-cadence run measures retention under the
same 30-car mature storm. It remains in progress; no full-ascent or FPS claim.


### Incremental hash traversal

Checkpoint hashing now walks canonical JSON with a depth-sized stack and one
generator. Scalar object fields emit a single token; character-budget splitting
and checksum bytes remain unchanged. This avoids nested generator delegation
and repeated resumption for each key/colon/value in terrain cells. The hash
input remains the immutable checkpoint payload.

A frozen reference validates 1,000 nested payloads across character budgets,
Unicode, omitted values, holes, nonfinite numbers, and unusual keys. A deep-input
test also passes. The existing checksum, checkpoint-boundary, and between-tick
replay tests pass. Six alternating isolated 4,000-cell hash measurements were
474/853, 520/908, 808/848, 726/603, 881/1264, and 731/1175 ms (new/reference).
Five of six improved, but CPU contention and thermal variation preclude a
whole-game speedup claim. Evidence: hash-traversal-tests.log,
hash-checkpoint-focused-tests.log, hash-traversal-timings.json.

The cadence comparison at frame 600 retained 528.6 MB and 12,740 events,
versus 563.2 MB and 29,423 events before the cadence change. The running
comparison predates the hash traversal change. Full-route memory stability and
60 FPS remain unproven.


### Traffic broadphase reuse and latest ascent

Each distant opponent now constructs a traffic probe once per proposed motion,
with lazy reuse of its swept rectangle across other cars. An L1 bound including
translation and rotation padding rejects only pairs that cannot overlap; close
pairs retain the original four-axis swept-rectangle test. 60,000 randomized
motion/heading/dimension cases match the frozen original. Ten traffic and
distant-physics tests pass (`traffic-probe-tests.log`).

An isolated spaced 30-car field (450,000 comparisons per sample) took 46–63 ms
versus 161–301 ms in six alternating comparisons, with identical zero-contact
results. This is broadphase throughput, not a whole-game frame-rate result.
See traffic-probe-timings.json. Dense and colliding cases are covered by parity
and runtime tests rather than that throughput measurement.

The 1800-frame cadence comparison completed at approximately 380 m. At frame
1500 retained heap was 600.8 MB versus 712.9 MB, and history length was 26,200
versus 79,120. Concurrent test activity and thermal variation contaminate CPU
timing comparisons; the retained-size measurements are the useful evidence.

The latest full ascent is `full-ascent-checkpoint`, started with all 29 opponents,
full storm forcing, 120 seconds of weather prewarm, memory diagnostics and the
latest checkpoint/hash/traffic changes. Its log and incremental memory samples
are saved under artifacts/mountain-stress. Do not restart this live run merely
to incorporate later micro-optimizations. Completion, sustained memory bounds,
and rendered 60 FPS remain unverified. The previous combined checkpoint/hash
suite completed 42/42; final scalar-token hashing additionally passed focused
checksum/replay and 1,000-payload reference parity tests.


### Live profile caveat and elevation-limit reuse

`checkpoint-current-live.cpuprofile` initially appeared to attribute 4.1 seconds
to the selectedRace getter. Inspection of individual timeDeltas showed one
3,973.6 ms sampling gap accounted for almost all of that apparent hotspot.
Do not interpret that interval as getter CPU consumption. The profile summary
now ranks observed samples and separately flags intervals over 10 ms; such
gaps may include scheduling delays and cannot reliably be charged to a leaf.
With that caveat, GC, chassis integration, runStep, longitudinal AI, tire physics,
and repeated geometry-signature work remain the important candidates.

Live instrumentation counted 408,435 selected-race reads over 2,030.6 ms.
Caching the getter itself was slower in a six-pair isolated test and was not
implemented. Instead clampRaceElevation caches normalized limits in the existing
immutable synchronous geometry scope. Explicit geometry invalidation clears
those bounds, and unscoped calls still read live values without allocating a
bounds object. Thirteen cache/terrain tests pass, including fallback values,
range changes, invalidation, nested scopes and exception cleanup. One million
clamps took 14–19 ms versus 30–31 ms in six alternating measurements with equal
outputs. This is an isolated optimization, not evidence of a major frame gain.

The full-ascent-checkpoint run remains live and predates elevation-limit reuse;
at frame 2400 it retained 641.8 MB, 37,451 events and had completed seven
checkpoints. Preserve that run for route/memory evidence. Its profiling and GC
diagnostics make it unsuitable for a clean frame-time comparison.


### Retain static signatures while a baked race runs

The geometry read scope now retains only path/surface signature maps across
frames for the same running session, bake, race, road, tile map and revision.
Pauses, preparation, results, non-running state, identity/revision changes and
explicit geometry invalidation discard them. Dynamic samples, weather, raw
terrain reads and per-frame normalization remain scoped to each call. Retained
signature maps are capped at 128 keys to bound arbitrary sampling parameters.

Six alternating tests on the actual mountain document, with 200 frame scopes
and three path sampling steps, took 1.2–3.1 ms with retained keys versus
269–346 ms with per-frame rebuilding. Signatures matched exactly (26,427
characters). Sixteen geometry/cache tests pass, covering live revisions, edits,
pause/resume, session/bake replacements, nested invalidation and fresh dynamic
caches. Evidence: playtest-signature-tests.log and
playtest-signature-timings.json. This saves approximately 1.3–1.7 ms per frame
in that isolated workload, not a measured whole-race FPS improvement.

The preserved full-ascent-checkpoint process predates this change. At frame
4500 it held 18,305 surface cells and 81,887 historical events (770.1 MB after
GC). Thus checkpoint backlog still grows with surface size: cadence alone is
not a proven full-route memory fix. Further work must address the expanding
capture/assembly/hash workload rather than merely raising the heap limit.


### Runtime deferred checkpoints and size-aware copy scheduling

Local/worker race factories now select deferred checkpoint hashing, a target of
120 capture slices (up to 512 cells per slice, minimum existing configured
budget), and 1,024 references per assembly slice. Standalone TrackState keeps
its original incremental mode; callers can explicitly select that mode.
These scheduling options do not change the authoritative snapshot schema.

A completed owned checkpoint exposes the same enumerable checksum property.
Its first replay/export/sync read computes the canonical checksum and replaces
the getter with the memoized string. JSON and structured-clone output remain
compatible. Most intermediate checkpoints are discarded without ever needing
their checksum. Export can therefore incur checksum computation that no longer
runs eagerly during racing; this is an explicit tradeoff, not a free speedup.

Nineteen focused tests pass: live render-rate independence, local/worker
integration, deferred property/wire compatibility, frozen baseline preservation
through subsequent weather/contacts, exact replay reconstruction, and bounded
copy scheduling. Seven existing checkpoint/worker tests also pass. An initial
new test incorrectly waited for an unfrozen checkpoint with advance(0), which
cannot freeze by design; it was stopped and corrected to service the checkpoint
at its completed simulation boundary with a bounded loop.

A synthetic 10,000-cell, 600-frame storm with 36,000 debris events retained
36,000 events and completed zero checkpoints in incremental mode; runtime mode
retained 11,160, peaked at 15,120 and completed three checkpoints. Weather totals
matched exactly. Total times were 5,930/6,176 ms (incremental/runtime), and maximum
slice times 7.9/16.6 ms. This demonstrates backlog reduction, not a CPU or FPS
win: completing more checkpoint work sooner costs time and still needs tuning.
Evidence: deferred-checkpoint-tests.log, deferred-checkpoint-focused.log,
checkpoint-retention-timings.json. The ongoing full-ascent-checkpoint process
predates these changes and must not be presented as their validation.


### Direct checkpoint cell copying and new full ascent

The older full-ascent-checkpoint run terminated with heap exhaustion after its
last reported frame 7,680 at 1,638.15 m. This is a failed run, not an observation
timeout, and it predates deferred checksums and the larger capture/assembly
budgets. Its log is preserved.

Checkpoint cell copying now directly copies ordinary scalar records plus their
normal vectors, preserving JSON number/omission behavior. Extended records use
the previous JSON round trip. Three thousand generated cell comparisons,
independent vector ownership, fallback values, deferred snapshot/replay tests,
and existing checkpoint tests pass.

An initial faster copy built fields one by one, producing V8 dictionary-mode
objects. A just-started full-ascent-deferred run was deliberately interrupted
during preparation (two frames ultimately recorded, interrupted=true) after
that memory regression was verified. The corrected copy uses object spread to
retain fast properties. Native V8 layout inspection is confined to a diagnostic
artifact; game code requires no native syntax or flags.

Six alternating 10,000-copy measurements took 58–73 ms versus 248–260 ms for
JSON copying. Retained-memory samples of 20,000 copies measured about 824 versus
720 bytes/cell, so the faster version still costs approximately 104 bytes per
copied cell. This explicit tradeoff is small relative to retiring tens of
thousands of pending events, but full-route memory validation remains required.
See checkpoint-cell-tests.log, checkpoint-cell-replay-tests.log,
checkpoint-cell-timings.json, checkpoint-cell-memory.json.

The current full attempt is full-ascent-compact-checkpoint, with 29 AI, mature
storm, 120-second weather prewarm, memory diagnostics, deferred checksums,
adaptive checkpoint budgets, compact direct copying, and retained static
geometry signatures. It remains in progress; do not confuse the interrupted
two-frame deferred attempt with this run. An additional synthetic retention
measurement is recorded separately as checkpoint-retention-fast-copy.json.

### Corridor sampling and requested pause

Removed a duplicate corridor-metrics calculation in sampleTrack: classification
already computes those exact boundaries, so the returned sample now reuses its
metrics. No cross-frame cache or altered surface classification is involved.
Two thousand generated corridor comparisons cover both sides, banking, road,
margin, shoulder, transition, and terrain; an editor-width change remains live.
Eleven focused surface/normalization tests pass (corridor-reuse-tests.log).
Six alternating 100,000-sample microbenchmarks measured 55.9–59.4 ms versus
61.0–64.3 ms with duplicate calculation, with equal result checksums. This is
only a sampling microbenchmark, not a demonstrated whole-frame improvement.

The experimental cell-normalization write-skipping change was reverted: it
showed no consistent timing or allocation improvement. Its frozen original and
randomized parity test remain available for future work.

At the user's request, the full-ascent-compact-checkpoint process was gracefully
interrupted and results saved after 5,963 frames / 1,262.37 m. All 30 cars were
present; finished=false, interrupted=true. CPU frame median was 51.57 ms,
p95 117.79 ms, p99 250.30 ms. This run predates the corridor reuse change and
includes diagnostic GC and profiling interference. The complete ascent and
60 FPS target remain unverified and unmet; browser/GPU validation is also
outstanding. Work is paused, with no benchmark left running.

### Controlled AI/weather comparison (2026-10-28)

Requested comparison, without further gameplay optimization: same mountain
stress candidate (19,880 scenery entries), RTG-001, autonomous driving at 60 Hz,
fresh process per case. Tested clear/day/brightness 1 and full storm/night/
brightness 0, each with 0 and 29 AI. The supported maximum is 29 opponents plus
the player, not 30 opponents. Each case ran twice, with reversed second-run
order, 900 simulated frames, first 180 excluded. Weather prewarm was 120 seconds.
No forced GC, CPU profiler, or concurrent benchmark was enabled. All runs
completed and validated finite AI state. These are CPU simulation timings only:
no renderer, graphics preload, browser, or GPU work was measured.

Pooled results (1,440 measured updates per case), milliseconds:

| Case | Median | P95 | P99 | Mean inside AI update |
| --- | ---: | ---: | ---: | ---: |
| Clear, no AI | 3.91 | 5.70 | 6.88 | 0.001 |
| Clear, 29 AI | 31.74 | 50.42 | 62.55 | 25.74 |
| Night/full storm/zero brightness, no AI | 3.93 | 7.82 | 9.33 | 0.001 |
| Night/full storm/zero brightness, 29 AI | 34.14 | 60.23 | 76.67 | 28.34 |

AI update accounts for 77–78% of mean simulation time with opponents, including
its physics/contact/terrain queries. Removing AI also reduces shared work outside
that method. Every measured crowded update exceeded 16.67 ms; no measured
zero-AI update exceeded it. This is not a rendered FPS result. Night lighting,
rain rendering, and headlight GPU cost remain unmeasured.

Repeat variability is material: clear/no-AI medians 3.06 and 4.70 ms;
clear/29-AI 25.94 and 35.06; storm/no-AI 3.84 and 4.00; storm/29-AI 33.33 and
34.94. Scheduling/clock/thermal variation limits fine-grained weather comparisons.
The large AI cost is robust in both repetitions. These tests cover the opening
15 seconds (~185–188 m), not the entire ascent or its later memory behavior.

Artifacts: comparison-summary.json, comparison-progress.log, and eight
{weather}-autodrive-comparison-{case}-r{1,2}-cpu.json files under
artifacts/mountain-stress/. Harness supports RTG_AI_COUNT, RTG_TIME_OF_DAY,
RTG_BRIGHTNESS, RTG_WARMUP_FRAMES; defaults retain previous behavior.

### 120-second comparison (2026-10-28)

Extended each of the four cases to 7,200 updates at 1/60 s (120 simulated
seconds), excluding the first 180 updates from overall timing statistics.
Each case ran once in a fresh process, sequentially: clear/no-AI, clear/29-AI,
night/full-storm/zero-brightness/29-AI, then night/full-storm/zero-brightness/no-AI.
All completed, reaching approximately 1.53 km. The same candidate, car,
autodriver, 120-second weather prewarm, and source digest were retained.
No forced GC or profiler was active. No gameplay optimization was introduced.

| Scenario | Median ms | P95 ms | P99 ms | First 3–15 s median | Last 90–120 s median |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clear, no AI | 3.05 | 4.72 | 5.78 | 2.85 | 2.92 |
| Clear, 29 AI | 48.64 | 113.76 | 233.63 | 29.80 | 65.52 |
| Night/full storm/brightness 0, 29 AI | 72.01 | 185.28 | 365.19 | 35.98 | 91.21 |
| Night/full storm/brightness 0, no AI | 10.24 | 55.83 | 74.74 | 10.32 | 9.96 |

Rounded first/last window values are illustrative; exact values are preserved
in comparison120-summary.json. AI updates accounted for 82.6% and 77.5% of mean
simulation time in the clear and storm crowded cases. This includes their
physics, terrain sampling, contacts, and recovery work. Some late AI remained
in reverse/recovery or other detailed-simulation states; this is a profiling
lead, not proof of the specific root cause of spikes.

An additional 120-second clear/no-AI control immediately after all four runs
completed at median 4.68 ms, P95 12.15 ms, P99 14.98 ms. Its opening median was
9.64 ms and final-window median 4.35 ms. CPU clock/core scheduling changed
throughout the sequence, so exact weather deltas and progression cannot be
attributed exclusively to game work. The large AI-associated cost is clear;
weather-only stalls also merit investigation, but need controlled profiling.

These are Node CPU simulation measurements, not rendered FPS. Browser/GPU rain,
headlight, and skybox costs remain unmeasured, and this is not the entire ascent.
All five processes ended. The optimization goal remains paused; this request
was measurement only. Results, window statistics, per-update timings, and
progress logs are under artifacts/mountain-stress/comparison120* and
{weather}-autodrive-comparison120-*-cpu.json. No saved tracks were changed.

### Published approaches and next optimization direction

Research checked on 2026-10-28:

- Turn 10 describes separate driving-line and throttle/brake/steering controller
  components, with trained lines for car/track/weather combinations. Its 2025
  update adds multiple lines and blending in traffic. These descriptions do
  **not** establish a particular off-screen physics LOD implementation, so we
  must not claim Forza disables physics for distant opponents.
  https://forza.net/news/forza-motorsport-drivatars-tire-physics
  https://forza.net/news/forza-motorsport-drivatar-changes
- The original GT Sophy paper reports 10 Hz agent/game interaction while game
  physics enforces the actions. This supports lower-rate decisions, not a claim
  that Gran Turismo's physics itself runs at 10 Hz. Learned policies and their
  cloud training are unnecessary dependencies for this arcade game's needs.
  https://sam.barrettnexus.com/publications/papers/nature22.pdf
- Game AI Pro, chapter 38 (Simon Tomlinson and Nic Melder), explicitly describes
  a simple racing model using a spline with parametric cornering, acceleration,
  braking and obstacle checks. It separates strategic, tactical and control
  layers. This is a suitable basis for a more aggressive remote-opponent tier,
  while nearby collisions should retain responsive physical handling.
  https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter38_An_Architecture_Overview_for_AI_in_Racing_Games.pdf
- NVIDIA's indexed PhysX vehicle documentation describes reduced-detail vehicles
  with less frequent suspension queries and potentially omitted vehicle updates.
  Direct opens of the old guide URLs returned 404 during this session; the
  indexed primary-source excerpts support the concept, but we did not import
  any source code or assume PhysX is our engine.

The first candidate batches distant AI contact/planning work at 20 Hz with
three staggered phases. Near-player or rapidly approaching vehicles, pending
collision impulses, and worker-backed vehicles bypass that schedule. Physics
runners retain their internal substeps; no elapsed time is intentionally lost.
This is an initial optimization, not the intended final remote approximation.
A route-following far tier, bounded terrain/weather work, smooth presentation,
and browser/GPU verification remain necessary investigations for 60 FPS.

### Multirate AI experiment results and terrain artwork correction

The initial conservative update envelope produced clear median/P95
59.37/94.68 ms versus full-rate 60.63/94.77 ms: no convincing improvement.
Storm initial candidate median/P95 was 64.08/120.76 versus full-rate
75.36/129.44 ms. Each run covered 1,800 frames (30 simulated seconds), with
180 excluded. Device clock/core assignment varied; these are not controlled
hardware guarantees.

The refined envelope uses 30 m plus two seconds of radial closing speed instead
of summing both vehicle speeds, which unnecessarily promoted same-direction
traffic. It commonly schedules 26/29 AI at 20 Hz. Clear median/P95 became
51.45/113.29 ms and storm 39.10/86.84 ms. The clear tail regression means this
is **not** validated as a steady-frame-rate solution. No 120-second candidate
verification, browser visual/interpolation verification, or 60 FPS proof yet.
Broader raceAi*.test.js suite: 66/66 passing, including elapsed-time accounting,
fast approaches, phase staggering, detailed-physics handoff and recovery.
Artifacts: multirate-progress.log, multirate-refined-progress.log,
ai-multirate-all-tests.log and per-case CPU JSON/logs.

The implementation remains an intermediate stage: detailed distant recovery
still consumes full chassis substeps, and batching can concentrate that work.
Next work must remove/simplify far-car physics rather than rely on batching
alone, and investigate storm catch-up/normalization. Existing keyboard/player
physics is untouched. All benchmark/test processes for this stage ended.

The user's additional Mount Washington ground-art issue was reproduced from
its saved document: groundPlaneArtRef is providenceGround, but 12,879 explicit
height-map cells with default grass and empty art suppressed that fallback.
Default-only surface cells now inherit the race ground artwork even when they
contain elevation data. Custom art, other painted surfaces, and mixed weights
retain priority. Canonical terrain packing also handles raw default-surface
cells, so appearanceVersion no longer disables the ground fallback without
replacing it with an artwork group.

Nine terrain appearance/chunk tests pass. A fresh transfer of the actual saved
Mount Washington race contains 42,195 terrain triangles, all assigned to
providenceGround. Scene-material tests verify the corresponding artwork overlay.
No saved race data was rewritten. Browser visual confirmation remains
outstanding. See providence-ground-verification.json and ground-texture-tests.log.

### Explicit cell normalization experiment

`clampTrackStateCell` now uses fixed property accesses, retaining both original
normalization passes and their order. This avoids dynamic numeric-property
boxing without changing weather, contamination, quantization, or invalid-value
handling. The frozen reference remains in tests; 5,000 randomized records match
exactly, including repeat normalization and nonfinite values. All 77 relevant
surface/weather/checkpoint/replay tests pass (`clamp-explicit-tests.log`).

An alternating six-pair microbenchmark of 100,000 normalizations measured median
381.21 ms reference versus 85.52 ms explicit. Inspector sampled allocations were
110.55 MB versus 68.30 MB. These are isolated-function measurements, not frame
rates. Artifacts: `cell-clamp-explicit-timings.json` and its benchmark script.

Full-runtime comparison uses `run-clamp-comparison.py`: separate sequential
processes, 7,200 frames each, 180 excluded warmup, mature full storm/night/zero
brightness, no AI. Only the reference process uses `clamp-reference-loader.mjs`
to replace normalization with the frozen original at module load; production
source is not swapped on disk. Both JSONs therefore share the disk source digest;
the loader and variant tag identify which implementation actually ran.

Both 120-second runs completed (7,200 frames). Reference update median/P95/P99:
9.892/52.339/65.313 ms; explicit: 9.856/25.584/31.091 ms. Including autopilot
CPU work, P95 was 52.497 versus 25.769 ms. Final distance and lateral position
matched exactly (1,533.2120401760126 m / 0.22422403392389728). This is a substantial
storm-tail reduction with nearly unchanged median, still above the 16.67 ms
60 FPS budget. CPU0 sampled median clock was 1.786 GHz reference and 1.555 GHz
explicit; uncontrolled mobile scheduling remains a limitation. These are CPU
simulation measurements, not browser/GPU FPS or a full ascent. Both processes
are terminal; no benchmark is running for this experiment.

Next priorities remain: simplify near/far AI physics rather than merely batch
full substeps, and profile the remaining storm surface/flow/checkpoint peaks.
The 30-second multirate logs averaged about four near-player detailed AI even
while most cars used the distant model; distant traffic/recovery also promotes
full work. Reducing only far planning frequency cannot remove this cost.

### AI 30 Hz experiment and player recovery follow-up

An artifact-only loader lowers detailed AI chassis/tire rate from 60 to 30 Hz;
production remains 60 Hz pending validation. Nine initial AI braking/support/
distant-handoff tests pass at 30 Hz. A 1,800-frame clear Mount Washington run
with 29 opponents completed with finite opponent states: update median/P95/P99
23.779/54.387/69.869 ms. This run used the explicit cell normalization change.
It needs a fresh matching 60 Hz comparison, longer driving and collision/
presentation checks before adopting it. Artifacts: `ai-rate30-loader.mjs`,
`ai-rate30-tests.log`, `clear-ai-rate30.log`, `clear-autodrive-ai-rate30-cpu.json`.
This is not proof of 60 FPS and does not change the player's physics rate.

The user also requested reliable recovery from being stuck upside down.
`RaceRecoveryHistory.js` keeps up to 12 simulated seconds of session-local
upright, four-wheel-supported road placements at 4 Hz. Manual/automatic reset
prefers a placement at least two seconds old, skips nearby AI, retains network
edge/altitude, and uses the existing authoritative settled-stop reset. Fuel,
damage and race time are not rewound. Successful local reset clears history.
Small inverted rocking/sliding no longer restarts the stationary timer; a
sustained slow inversion without reported support also recovers after four
seconds. Moving/tumbling faster remains uninterrupted. After a transient reset
retry, older safe placements are tried, with eight attempts maximum so the
screen cannot remain black indefinitely.

Two old control fixtures assumed the former long default track and failed even
with history disabled (`recovery-baseline-tests.log`). They now explicitly build
a 500 m legacy road. Dedicated new tests cover actual network history placement,
altitude, traffic, expiry, airborne/off-road rejection, damage/fuel preservation,
rocking, missing support, older retries and bounded failure. On-device visual
verification, including asynchronous worker reset rejection, remains outstanding.

Recovery combined suite: 34/34 pass (`recovery-final-tests.log`). A final guard
rejects snapshots from previous laps, preventing recovery from replaying a
start-line crossing; all seven history tests pass afterward
(`recovery-lap-tests.log`). All tests and the 30 Hz exploratory benchmark for
this stage are terminal. No performance comparison process remains running.
Next performance action: fresh 60 Hz control against the 30 Hz experiment,
then extended collision/handling and 120-second validation if retained.

### Remote aggregate powertrain

A fresh 60 Hz control (1,800 frames, before enabling the remote aggregate)
measured update median/P95/P99 39.427/178.964/243.169 ms, versus the earlier
30 Hz experiment 23.779/54.387/69.869 ms. CPU scheduling/frequencies varied
substantially, so this does not isolate the rate change. Production detailed
AI remains 60 Hz; 30 Hz is still an artifact-only experiment.

`RaceAiRemotePowertrain.js` now replaces repeated differential and wheel-load
solves for healthy, supported opponents more than 120 m away, after the existing
distant-physics eligibility checks. It uses actual car torque/gearing/power,
mass, each tire's grip/pressure/temperature, normal loads, braking, drag and road
grade. An aggregate friction circle reserves grip for turns. The approximation
omits detailed load-transfer/differential/contact-patch relaxation, preserving
car-dependent performance rather than assigning all AI the same acceleration.
Existing swept obstacle/traffic and terrain-step checks can still promote the
car to detailed physics. Worker-backed vehicles retain their existing path.
Near-player physics and player physics are unchanged. Existing mechanical/fuel
updates and per-wheel TrackState event data remain in use. Transitions still
need browser visual verification.

All 70 raceAi*.test.js tests pass before the final worker-exclusion guard (which
only narrows eligibility). Focused new checks cover distance gating, acceleration,
braking, authored torque, road grade, low grip, turning and surface-event data.
An alternating six-pair 1,000-call microbenchmark measured roughly 260–443 ms
for the previous calculation versus 76–90 ms for remote aggregate. Straight
acceleration in that case was 4.68846 versus 4.68760 m/s². This is not a whole-frame
or FPS result. See `remote-powertrain-micro.json`, `remote-ai-all-tests.log`.

The benchmark now records the aggregate-mode opponent count and supports
`RTG_AI_DETAILED_LONGITUDINAL=1` as an explicit comparison toggle. Its digest
includes the new module. A 7,200-frame clear/29-opponent run is in progress:
`remote120-clear.log`, expected JSON `clear-autodrive-remote120-clear-cpu.json`.
At launch the live exec session is 20214. Revalidate that handle before waiting;
do not infer completion from this documentation. No 120-second result yet.

### Completed remote120 clear run: target not met

Session 20214 finished normally: 7,200 frames / 120 simulated seconds, 29 AI,
1,536.19 m of player progress, no race finish. Median/P95/P99 CPU update times
were **55.947/214.408/399.944 ms**, last-30-second median 57.997 ms. Only 51 of
7,020 measured updates were within 16.67 ms. AI updates consumed about 78.94%
of measured update time. This does not establish an overall improvement over
previous runs; mobile scheduling varied, and the aggregate-function microbench
win did not solve the full-runtime problem. Browser/GPU performance remains
unmeasured. See `remote120-clear-summary.json` and the full CPU JSON/log.

Final opponent states reveal a queue around 496–545 m: 13 opponents are under
1 m/s, including eight whose sampled reason is reverse (the reason precedes
that frame's integration, so a near-zero final positive speed can still carry
that reason). During the second half only about 14–16 of 29 opponents retained
the cheaper chassis. Far traffic and tiny rollback kept reactivating full
physics. Heap readings fluctuated roughly within 0.5–0.8 GB rather than growing
without bound in this run. No invalid states/OOM were reported.

A targeted follow-up now permits a distant supported car to hold a stopped
queue when its planner requests <=0.05 m/s and actual rollback is no worse than
0.75 m/s. Normal reversing remains detailed. A zero-displacement, brake-held
step can retain its existing contacts without treating another stationary
traffic bounding box as a new swept collision; moving cars still test against
it, and near-player/pending-impulse gates retain full physics. Mechanics and
simulation clocks continue. Eighteen focused AI tests pass, including holding,
real reversing, moving obstacles/traffic, near-player promotion and clock/fuel
continuity. `distant-queue-tests.log`. This fix has **not** had a full-course
performance retest yet. Final benchmark opponent diagnostics now include target
speed/throttle/brake to distinguish genuine queued holds from driving attempts.

Next substantial change: a far road-following trajectory model with braking/
traffic avoidance and continuous physical handoff. Faster longitudinal math
alone leaves too many distant cars in full recovery simulation. Presentation
smoothing is also required before lowering distant update frequency further.
Do not call this goal achieved, or substitute successful unit tests for 60 FPS.
All processes in this stage are terminal; no benchmark is currently running.

### Far road-following trajectory candidate

`RaceAiRouteMotion.js` now supplies motion for otherwise-eligible distant cars
at least 120 m away. It follows the authored route center plus the driver's
chosen lateral lane, preserving the current lateral position on entry and
limiting lateral movement to 0.8 m/s (less at low speed). Its signed lateral
convention matches `getRaceRightVector`. Wrong branches, off-road placement,
reverse headings, discontinuous path geometry, and nearby cars do not enter.
This is explicitly a constrained arcade trajectory, not full tire/chassis
simulation. Existing car-specific longitudinal forces still control speed.
Body heading eases toward the trajectory with the existing grip/yaw-rate limit.

The distant commit still samples wheel support, preserves height/grade, checks
static obstacles and updates mechanics, fuel, wheel spin, clocks and render
state. Traffic conflicts on a far route now yield at the current position
instead of invoking a full collision solver; traffic moving into it still sees
the car. Nearby/pending-impulse/unsafe gates retain detailed simulation and the
existing state-preserving handoff. Smooth uphill rises above 0.25 m are no
longer rejected solely for absolute rise: the existing normal-predicted height
continuity check still rejects abrupt steps.

76 AI tests pass (`route-ai-all-tests.log`), plus final lane-convention tests
(`route-motion-final-tests.log`). New cases verify a sustained geometric bend,
bounded lane merging, no wrong-branch/off-road snapping, yielding and resuming
without replacing the runner or mechanical state, and smooth steep climbs.
No browser visual/interpolation verification yet; simulation remains 20 Hz for
distant cars and 60 Hz for detailed AI. Player physics remains unchanged.

The 7,200-frame clear/29-opponent run completed normally (session 51276):
`route120-clear.log`, `clear-autodrive-route120-clear-cpu.json`.
Median CPU frame time was 56.17 ms, P95 181.59 ms, P99 257.71 ms; the last
30 seconds had a 65.91 ms median. AI consumed 71.36% of measured time.
The player reached 1,535.78 m, not the summit. Twenty of 29 opponents ended
below 1 m/s, versus thirteen in the preceding aggregate-powertrain run.
Although more distant cars stayed on the cheap path, median performance did
not improve and traffic progress regressed. Tail timings alone do not prove
an improvement given phone scheduling variation. These are Node CPU timings,
not rendered browser FPS. Sustained 60 FPS and smooth visual handoff remain
unproven. `RTG_AI_BICYCLE_ONLY=1` disables the trajectory for comparisons.

The final diagnostics exposed an uphill launch issue: low requested crawl
speeds produced insufficient throttle to overcome gravity. A focused control
correction now uses existing road grade, resistance, mass and available drive
force to supply low-speed launch throttle. It fades out by 3 m/s and retains
brake-held stops when the requested speed is zero. Ten focused controls and
powertrain tests pass (`ai-hill-launch-tests.log`), including an uphill restart
and subsequent stopped hold. The broader AI suite also passes all 77 tests
(`ai-hill-launch-all-tests.log`). This correction has not been performance-retested
and does not establish that the traffic queues are resolved.

Work is stopping at the user's request after validating this correction; no
new benchmark is planned. Remaining issues include AI queue behavior and
contact/planning cost, weather tail latency, browser rendering validation,
and a complete mountain ascent.

### Shared director experiment (resumed at user request)

The user authorized shared planning and approximate distant driving. The first
increment centralizes static corner observations in `RaceAiDirector.js` and
builds one spatial traffic snapshot per AI update. Road curvature uses 8 m bins
and the maximum of adjacent intervals, intentionally braking slightly early
at sharp corners. Drivers retain independent grip, braking ability, steering,
and speed limits. Dynamic weather is not stored in the static road cache.
The cache is bounded to 4,096 curvature entries and 4,100 headings and is
separate for each session/race/runtime/route length. Snapshot traffic planning
removes dependence on which car was advanced first; physical collision checks
still use live vehicle states. This is not a centralized physics replacement.

82 AI tests pass (`director-ai-tests.log`), including cache bounds, circuit
wrapping, cold endpoint reuse, shared driver reuse, cell-boundary traffic and
snapshot consistency. An initial benchmark was deliberately interrupted after
a cold-cache test exposed duplicate heading queries; it is not a completed
performance result. The corrected 120-second run uses tag `director120-v2`,
exec session 47946, and `director120-v2-clear.log`. Check the live handle and
terminal JSON before making a performance claim. The environment switch
`RTG_AI_INDEPENDENT_PLANNING=1` restores independent planning for comparisons.

The director120-v2 run completed all 7,200 frames: median 49.83 ms, P95
122.69 ms, P99 189.96 ms, player progress 1,485.91 m. Twenty-two AI finished
below 1 m/s. Thirteen were persistently route-yielding. This is a behavior
regression despite lower observed timings than the prior run; CPU profiling
was active after frame 1,800, hardware clocks vary, and no isolated director
speedup is claimed. The profile `clear-director120-v2-ai-steady.cpuprofile`
shows GC, chassis integration, tire solving and terrain support as leading
costs. Sharing route planning alone is insufficient.

A targeted queue test reproduces a front car being held by speculative padding
around a rear car that is physically clear. Route traffic now refines the
broadphase with a 1 cm clearance sweep (retaining angular sweep bounds).
An already-overlapping pair requests the real collision solver instead of
freezing in route-yield forever. Imminent contacts still yield. Default broad
traffic probes are unchanged. All 83 AI tests pass (`director-queue-tests.log`).
A fresh unprofiled 120-second run is being recorded as `director-queue120`;
its result must be inspected before claiming queue behavior is fixed.

The queue120 run completed: median 56.78 ms, P95 140.35 ms, P99 187.38 ms,
player progress 1,525.13 m. Seventeen opponents ended below 1 m/s; three were
route-yielding, with several upright/off-road/tilted stalled leaders. Diagnostics
identified leading cars yielding to followers. Preserving the along-road
projection residual in route motion prevents tiny launch steps from snapping
backwards into a follower; a regression test checks a 1 mm forward launch.

Important benchmarking limitation discovered: startup shuffles eligible cars
and may use the shuffled first car as the fallback for most of the grid. Earlier
unseeded runs therefore do not isolate code performance. The harness now seeds
startup selection (default 8730), restores normal Math.random afterward, and
records seed, car IDs, positions, height, vertical velocity, reset counts and
physics backlog. All future A/B runs must use the same seed/source scenario.

The user reported a possible AI falling through terrain and repeated work when
stuck. The inspected main physics advance is bounded, but opponents previously
allowed 60 catch-up substeps per update. This is now capped at four with debt
retained, tested to drain completely without discarded simulation time. Player
physics is unchanged. A new simulation-time watchdog requests the existing
validated reset after one second >6 m below its road corridor, or eight seconds
of a healthy distant car attempting to drive without moving 0.75 m. Normal
queues, mechanical failures, nearby stopped cars and brief falls are excluded.
Attempts have a four-second cooldown; the director permits only one new
watchdog reset per AI update. Recovery still checks occupancy/support and
preserves fuel, damage and lap state. Upside-down recovery remains intact.
89 AI tests passed before the final direct-call budget guard; the focused
11-test recovery suite passes afterward, including failed-reset retry cadence.
A seeded 120-second validation is running with tag `director-watchdog120`.
This is a guard against pathological states, not proof of the original terrain
failure's root cause or proof of 60 FPS.

Seeded watchdog120 completed 7,200 frames: median 67.93 ms, P95 108.67 ms,
P99 294.83 ms, progress 1,525.69 m, sixteen AI below 1 m/s. It is not a 60 FPS
result. AI backlog remained zero in recorded samples. One upside-down recovery
resumed driving (12.72 m/s at the end); no below-road watchdog reset fired.
`director-watchdog-height-check.json` compares the three detailed stalled cars
with their route: 11–30 m laterally away and 1–4.5 m below road height. This
supports off-road stalls but does not prove terrain penetration. There is no
rendered-browser reproduction of the user's observed fall-through yet.

Final review found two of those cars requested only 18–28% throttle, below the
initial stuck-watchdog threshold. The threshold now accepts >10% throttle and
requested speed >1 m/s, retaining the other exclusions. Runtime watchdog status
and failed component names are included in final benchmark diagnostics. Also,
the recovery wheel-contact query now passes the known road elevation as the
support-height hint; formerly it omitted that hint even on elevated routes.
These final adjustments require a new long-run comparison before any further
performance claim. Unit coverage includes low-throttle detection, bounded failed
reset retries, preserved fuel/damage, and altitude passed to recovery contacts.
No benchmark remains live after watchdog120.

Final validation: all 93 AI tests pass (`director-final-ai-tests.log`), including
normal AI update dispatch through the stuck watchdog to the real reset authority.
The test process exited successfully; no Node benchmark/test process remains.

## Controlled center-line experiment (2026-10-29)

User hypothesis: cars leaving the narrow mountain road and becoming stuck, rather
than ordinary uphill driving, cause the worst stalls. Added opt-in harness flags
`RTG_AI_CENTER_SLOW=1` (zero desired lateral offset; target speed capped at 8 m/s)
and `RTG_AI_SPACED_GRID=1` (initial road-center positions 20 m apart, 200–760 m).
Neither changes normal gameplay defaults. Steering/physics remain active; cars
are not teleported along a rail. A control test verifies the driving intent cap
without forcing position; all six controls tests pass.

All three runs completed 7,200 frames / 120 simulated seconds, clear noon,
brightness 1, 29 opponents, seed 8730, identical selected car lineup, excluding
180 warmup frames. These are Node simulation update timings, not rendered FPS.
Per-car wall timers include any GC/scheduling occurring within the measured call.

| Scenario / artifact tag | Median ms | P95 ms | P99 ms | Last 30s median ms | AI ending below 1 m/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal, `center-ab-0` | 69.21 | 113.49 | 370.11 | 79.45 | 16 |
| Center/slow, original grid, `center-ab-1` | 23.90 | 99.46 | 121.25 | 20.15 | 24 |
| Center/slow, spaced road grid, `center-spaced120` | 31.34 | 49.45 | 185.88 | 31.02 | 0 |

The original-grid center/slow run is not evidence of 29 moving cars: many queued
near the start. The spaced control fixes that confound but changes initial
positions, traffic and proximity/detail distribution, so it is not a strict
single-variable A/B. All 29 cars advanced 677–795 m from their starting positions
and ended driving at 5.62–7.40 m/s. At one-second road samples, none left the road
or fell below it; maximum observed center offset was 0.258 m. No resets occurred.
Original-grid off-road sample counters include behind-start grid positions whose
route projection clamps to zero; do not interpret those totals as departures.

Normal-run per-car evidence is stronger than the aggregate comparison:
- ai-3 (PZ-24): 68.91 seconds of detailed-physics calls, 12.87% of total measured
  simulation time. One call took 718.27 ms within a 973.83 ms update (frame 6052).
- ai-16 (BUSE-019): 51.19 seconds / 9.56%.
- ai-2 (CT-86): 45.39 seconds / 8.48%.
- These three stopped cars consumed 30.92% of simulation time combined, averaging
  23.57 ms per measured frame. PZ and BUSE reported failed recovery with
  `Unable to converge static vehicle support`; CT reported occupied recovery.
  Their mechanical states were healthy. Recorded physics backlog was zero.

This supports pathological stopped-car physics/recovery as a major source of
hitches, including a single car dominating an update. It does not establish a
literal infinite loop, isolate the static support solver's share of every call,
or prove terrain penetration. Centered moving cars are substantially cheaper,
but the control still misses 16.67 ms and has significant tail spikes. Next
priorities: safer mountain driving/start placement, reliable bounded recovery,
and preventing unrecoverable distant wrecks from repeatedly consuming expensive
physics. Ordinary driving and allocation costs still need attention afterward.

Raw results and summaries are under `artifacts/mountain-stress/`, named
`clear-autodrive-<tag>-cpu.json` and `<tag>-summary.json`; reproduce summaries with
`node artifacts/mountain-stress/summarize-center-ab.mjs <tag>`.
All three experiment processes exited successfully; none remains running.

## Recovery and mountain driving changes (2026-10-29)

Implemented after the controlled experiment:
- After a static support convergence failure, the next recovery uses the existing
  authoritative airborne-reset path: upright road pose plus 25 cm, collision
  validation retained, then real gravity/suspension settling. No direct mutation
  to a fake grounded pose, repair, fuel refill, or forward progress award.
- Failed distant main-thread recoveries wait four simulated seconds between
  attempts without accumulating physics catch-up debt. Approaching within 120 m
  resumes normal physics. One waiting recovery attempt is admitted per director
  update. Worker physics is not put to sleep by this main-thread guard.
- Steep/narrow road geometry reduces desired lateral offset, lookahead and pace;
  no Mount Washington name check or forced 18 MPH gameplay cap. Wide flat-road
  pace is unchanged. This is conservative geometry-based driving, not a new
  terrain-cliff detector.
- Route heading changes are bounded by distance traveled, wheelbase and steering
  angle. Previously a barely-moving car could rotate toward its target lane,
  enlarge its swept box into a physically clear follower and mutually queue.

98 AI tests pass, including real authoritative airborne reset/settling with
preserved fuel/damage/lap, recovery wait/wake behavior, narrow/hill line planning,
and the crawl-launch heading bound. No player physics changes.

First normal-grid validation (`recovery-landing120`, before the route-heading
fix): median 20.80 ms, P95 59.38 ms, P99 189.88 ms, last-30s median 28.24 ms.
Previously stuck CT was moving at the end; 17 cars still queued. Therefore that
performance result alone does not establish successful race-wide progress.
A second complete 120-second run (`recovery-queue120`) validates the heading fix.

The heading-only run completed: median 36.78 ms, P95 198.82 ms, P99 242.30 ms,
last-30s median 24.97 ms; 17 cars still stopped. Thus the heading bound alone
was insufficient. No final car reported a static-support reset error. The worst
recorded individual call (939.70 ms) was a moving CT near the player, not a stuck
recovery. Wall-time instrumentation cannot distinguish GC/OS stalls from the
work inside that call; these tail spikes still need separate profiling.

Inspecting the exact final poses of ai-12 and ai-19 showed a collision-clear
forward path despite their blocked merge. The subsequent fix defers the lane
change at crawl speeds and rechecks straight-ahead motion against every opponent,
static scenery and normal road-support validation. Real overlap still requests
the collision solver. This does not ignore a follower or disable collisions.
Worker reset rejections now recognize asynchronous static-support failures and
use the landing fallback on retry while retaining the acknowledgment timeout.
All 100 AI tests pass (`recovery-forward-tests.log`). The final validation tag is
`recovery-forward120`; its summary is recorded below after completion.

Final `recovery-forward120` completed all 7,200 frames successfully with the
same seed/car lineup, original grid and no diagnostic centering/speed/spacing:

| Metric | Original `center-ab-0` | Final `recovery-forward120` |
| --- | ---: | ---: |
| Median simulation update | 69.21 ms | 21.77 ms |
| P95 | 113.49 ms | 85.63 ms |
| P99 | 370.11 ms | 204.06 ms |
| Last 30 seconds median | 79.45 ms | 14.35 ms |
| Last 30 seconds P95 | 133.32 ms | 26.30 ms |
| Opponents ending below 1 m/s | 16 | 2 |

27 cars ended above 1 m/s. The remaining two were creeping at 0.009 and 0.370 m/s,
not frozen in recovery. No car ended waiting for recovery or reporting a reset
error. PZ completed one ai-stuck recovery and was driving afterward. Backlog
remained zero in the recorded samples. All 100 AI tests pass.

This is substantially better progress and typical simulation cost, not a claim
of steady rendered 60 FPS. The worst instrumented call still took 934.95 ms,
while a CT was moving at 8.84 m/s near the player. Isolating allocation/GC,
terrain/contact cost and OS scheduling requires further profiling; it would be
incorrect to attribute every remaining spike to stuck AI. Phone clock/scheduling
variation also prevents treating these single runs as a precise universal speedup.
The two crawling opponents remain a follow-up traffic/launch investigation.

The user requested finishing this work and stopping to discuss. Final benchmark
and test processes exited; no further optimization is running. Dev server was
not stopped or restarted. No commit/push was requested or performed.

## Generic load-time road plan (2026-10-29)

See `ai-road-plan.md` for architecture and limitations. A planning-only comparison
on a fixed synthetic 8 km route measured 44.31 ms versus 16.21 ms per 10,000
queries (about 2.7x faster). Geometry queries dropped from 3.020 to 1 per decision.
Building its 1,001-sample plan/common envelopes took 8.34 ms. These are isolated
Node measurements, not game frame-rate claims; checksum differences reflect the
new conservative braking envelope.

The first Mount Washington integration (`roadplan120`) built 1,511 road samples
and nine envelope profiles. Median update was 41.07 ms, P95 72.43 ms, but 15 cars
ended stationary in a queue. This was not accepted as a successful integration.
The lead car's recorded actual 1.83 m x 4.67 m hull had a clear forward sweep;
only the speculative 1 cm margin blocked it against a stopped follower. The
crawl escape now uses physical swept hulls (current overlaps still go through
collision resolution), retaining road support and scenery checks. A regression
test reproduces those exact positions. All 106 AI tests pass.

`roadplan-clearance120` reruns the complete scenario after this correction.

Final controlled pair completed 7,200 frames each, same source digest and car
lineup/seed (8730), clear/noon, brightness 1, original grid, 29 AI plus player.
Both include the clearance correction; only `RTG_AI_NO_ROAD_PLAN` differs.

| Metric | Online / `roadplan-disabled120` | Precomputed / `roadplan-clearance120` |
| --- | ---: | ---: |
| Median simulation update | 45.83 ms | 38.87 ms |
| P95 | 86.91 ms | 82.56 ms |
| P99 | 124.77 ms | 110.58 ms |
| AI finishing below 1 m/s | 6 | 0 |

Median simulation work was 15.2% lower in this pair. All 29 AI finished moving
with the precomputed plan; none reported a reset error or waited for recovery.
The plan remains enabled. This is evidence from one Node timing pair on a phone,
not a universal speedup or rendered 60 FPS claim. The changed driving hints also
change traffic trajectories, so the isolated microbenchmark is the cleaner
measure of planning cost alone. Significant whole-simulation spikes remain.

Validation complete: 106 AI tests plus 35 race-startup/preparation tests pass.
All benchmark and test processes have exited; no long-running experiment remains.
No vehicle/race save migration, source asset edits, commit or push was performed.
