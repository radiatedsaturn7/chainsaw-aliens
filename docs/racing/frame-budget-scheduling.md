# Race frame-budget scheduling

The target is consistent display frames, not a promise that a browser can be forced to 60 FPS. Player tire/chassis equations and fixed-step rates remain unchanged. Nearby collision and local grip reads remain synchronous. Optional cache preparation must never change authoritative weather/cell state.

## Implemented

- `RaceFrameBudget`: cooperative bounded queue, priorities, resumable jobs, cost estimates, expiry, deferred/failed/overrun counters. Reserves at least 8 ms of a 16.67 ms frame for presentation/browser work; recent measured render CPU time can increase that reservation. This is not a hard real-time deadline and cannot interrupt a function already running. Budget starts at the race simulation boundary, so input/UI work outside it is not included.
- `RaceSimulationClock`: one admitted delta for active racing, at most 1/30 s per update, at most 1/15 s retained debt. Excess wall time is counted explicitly. All race physics, race time and runtime items use the admitted delta. The player solver's fixed timestep is unchanged. Severe overload slows the race relative to wall time rather than creating unbounded catch-up. Pause/results/intro clear pending debt. Countdown and rolling formation retain their presentation/music timing; displayed GO expiry follows wall time.
- Ahead preparation follows road curvature, sampling three lateral positions over a speed-dependent corridor, eight samples per resumable job. Immutable base-surface samples live in a separate 256-entry cache. No active cells, water transfers, checkpoint state or authoritative weather ticks are created by optional preparation. Isolated weather-profile recurrences may be prepared ahead as described below. Snapshot restore invalidates the preparation cache.
- Loading presentation performs the initial corridor slices before releasing the transition. Further slices run only with spare budget. Essential work can starve these jobs; expiry prevents unbounded queues but does not manufacture spare CPU time.
- Active weather-key binary searches compare existing numeric coordinates instead of repeatedly parsing string keys. Canonical ordering is unchanged.
- Performance captures retain frame-local budget statistics, admitted time, deferred time and discarded wall time. CPU stress reports include these fields and a diagnostic switch to compare scheduling enabled/disabled.

## Validation and limits

`raceFrameBudget.test.js` covers deadline reservation, priority, resumption, expiry, queue bounds, exceptions, hitch admission, pause/resume, actual live-race fixed-step limits, ahead cache/checksum parity and canonical key order. Capture tests verify snapshotting the budget diagnostics. Existing replay, controller mapping and dry/wet initialization tests pass.

Six existing broad-suite failures reproduce with the new scheduler/clock disabled and the old key comparator restored: four countdown fixture/behavior checks and two Track State checkpoint/replay checks. Logs are under `artifacts/mountain-stress/frame-budget-*`. They are not silently waived as passing.

The Node benchmark has no graphics, audio or browser compositor. Fixed 1/60 s input advances cannot by themselves demonstrate behavior under real-time load; hitch behavior is separately tested with an injected 0.5 s update. Browser recordings are still required to establish actual 60 FPS or end-to-end input latency. The scheduler does not currently defer authoritative weather evolution, active tire contacts or partial collision solves.

## Remaining work toward stable 60 FPS

- Reduce essential player/near-AI CPU time; the initial three-AI CPU benchmark still exceeds the entire display budget in most updates.
- Measure normal browser rendering alongside simulation. Reserve estimates currently use render CPU timing, not asynchronous GPU completion.
- Extend preparation to safe reusable cell templates/contact data where profiling proves a benefit, without changing creation order or water-flow behavior.
- Evaluate worker-owned preparation/planning, bounded snapshot publication, and adaptive visual detail. Do not change authoritative AI detail based on unrecorded wall-clock deadlines.
- Broaden clear/storm comparisons and long captures, including thermal slowdown and worst-case contact incidents. The overloaded 200-car benchmark is a diagnostic, not a target gameplay configuration.


## Initial normal-sized CPU comparison (2026-11-01)

Saved Mount Washington, clear/noon, three detailed opponents, autodrive, 600 updates (10 simulated seconds), no rendering. Isolated runs on the same Termux device, no simultaneous tests. These are single-run comparisons, not confidence intervals.

| Variant | Median update | P95 | P99 |
|---|---:|---:|---:|
| Scheduler/clock disabled | 24.37 ms | 31.08 ms | 37.88 ms |
| Scheduler/clock enabled | 23.76 ms | 29.99 ms | 34.48 ms |
| Enabled + numeric weather-key insertion | 20.21 ms | 28.79 ms | 37.31 ms |

All three yielded identical final opponent positions/speeds/orientations, player route/lateral state, and track checksum `286b944e`. No simulation time was discarded with fixed 1/60 s input. The scheduler deferred all runtime corridor jobs (591 deferrals, nine expired requests, zero job overruns), proving there was no spare time under its reserved budget—not that preparation made these runs faster. The initial loading-screen preparation is not executed by this rendering-free harness. The small scheduler-only timing difference should be treated as noise; the numeric-key change needs repeated measurements to establish its sustained benefit. None of these results establishes 60 FPS.


## Additional contact work and final clear run

The normal-sized profile identified repeated mount-to-tread body-bound calculation. Body bounds are now prepared once per piece per contact check, then reused for the same 13 path samples. Bounds still refresh for every check, including live geometry edits. No persistent mutable-geometry cache or contact approximation was added. Twenty thousand randomized box/convex comparisons match the prior reference exactly; the 38 contact/replay/reset tests passed.

The subsequent clear 600-update run measured median **21.23 ms**, P95 **27.36 ms**, P99 **34.04 ms**. Against the initial disabled run, final AI poses/speeds, player route state and track checksum all match. The median varies between runs (the preceding numeric-key run was 20.21 ms), so do not attribute a precise gain to the contact-bounds change alone. See `frame-budget-comparison.json`. Core CPU work still exceeds a 60 Hz display budget before rendering.

The frame coordinator now finishes optional work after runtime items and automatic recovery in the ordinary editor update path. Direct simulation benchmark calls finish their own budget. Finish is idempotent. Optional preparation failures are recorded and cannot abort racing/loading. Focused coordinator/controller/capture/architecture validation: 38 tests passed. Loading preparation has a bounded-slice test as well as checksum parity coverage.

The unrelated existing Latest Changes tests also fail: a date assertion hardcodes July 2026, and an existing change entry lacks the `details` field consumed by the dialog. These failures were observed while checking the timestamped status update; this patch does not change that dialog or those historical entries.


Full-intensity storm smoke run: three opponents, night/zero authored brightness, forced effective intensity 1, 60 seconds of weather history prewarmed, 300 updates. Completed with finite opponent state and no optional job failures/overruns. CPU median 23.21 ms, P95 31.09 ms, P99 42.99 ms. This has no rendered storm particles or headlights and is not a GPU measurement. Artifact: `storm-autodrive-frame-budget-full-storm-cpu.json`.

The stable-60-FPS objective remains open. The next investigation should distinguish mandatory simulation work from the profiler itself (`node:inspector.post` appeared prominently at profile shutdown) and evaluate existing worker ownership before changing any player physics frequency. Do not claim the scheduler alone solved the frame-rate problem.


## Scheduling research and worker investigation (2026-11-01)

60 FPS is a presentation target, not a browser guarantee. Reserve presentation/browser headroom inside the 16.67 ms interval; do not allocate all of it to simulation. Cooperative yielding cannot interrupt an already-running JavaScript function. Jobs must expose bounded slices and publish complete results. A half-completed tire/contact solve is not a safe presentation state.

Recommended priority order:
1. Input, player fixed-step physics, immediate interactions, and local road grip.
2. Nearby opponents' coupled physics/collision work, keeping interaction timestamps coherent.
3. Bounded, staggered AI advisory planning using the last complete plan between updates.
4. Local weather evolution on its own deterministic schedule; visual weather can degrade independently.
5. Distant weather/caches/scenery preparation with freshness limits, spatial interest and resumable work.

Do not let deadline-based deferral alter authoritative physics arbitrarily. Weather accumulation/flow needs bounded substeps and consistent cell boundaries, not a single enormous catch-up update when the player reaches a dormant region. For optional visual jobs, replace obsolete requests instead of retaining a FIFO backlog. Keep essential weather/grip reads synchronous until equivalent prepared values are available.

Other useful avenues: cache exact contact candidates and immutable terrain data, spatially restrict queries, pool hot-loop scratch storage, prepare textures/shaders during loading, retain staged car visual detail, and measure GPU/render cost separately. Adaptive resolution or particle counts should use hysteresis and never change tire physics. Workers can separate display responsiveness from simulation but still need throughput and memory qualification; a responsive display with growing simulation backlog is a failed result.

Research references:
- [Chrome rendering performance](https://web.dev/articles/rendering-performance): 16.67 ms display interval and browser overhead/headroom.
- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/): fixed steps, interpolation, bounded catch-up and the spiral of death.
- [MDN scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield): cooperative continuations, not hard real-time interruption; feature-detect availability.
- [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers): separate execution and data-transfer considerations.
- [MDN Long Animation Frames](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing): useful long-frame diagnostics, but worker script attribution is absent and the 50 ms threshold misses many 60 FPS budget violations. Keep our own per-frame measurements.

Worker safeguards implemented during this investigation:
- Skip live qualification/history copying when migration is unavailable, off, mobile-blocked or already qualified.
- Explicit worker pause/resume follows both menu pause and page visibility; listeners detach on close. Resume resets the worker clock rather than catching up paused time.
- Worker-owned simulation retains wall-clock race timing rather than also applying the main-thread bounded clock.
- Share prepared immutable static collision worlds among vehicles using the same definition array; reset that cache on race initialization. Per-vehicle environment outputs remain separate.

Focused client/entry/migration/frame-budget suite: 29 passed. The broader authority suite has three unresolved failures involving missing fixture wheel state and authoritative wheel positions; it is not reported as passing. The added authority resume-clock test passes. Mobile auto-migration remains disabled. The existing worker migration also promotes all active AI to full physics, so enabling it is not equivalent to our three-detailed-opponent policy.


Real packed-mountain worker probe, player + three detailed AI, 8 wall seconds, straight 35% throttle, no rendering: after sharing static preparation it initialized and completed (the initial unshared attempt exhausted the Node worker heap; this single comparison does not isolate every memory contributor). Main event-loop heartbeat median 16.15 ms, P95 16.67 ms, max 19.99 ms. Worker ticks median 129.11 ms, P95 180.55 ms; player achieved 59.80 steps/s against 120 Hz, opponents about 30.22 against 60 Hz. Player backlog grew to 461 steps. This is a failed throughput qualification despite responsive main-thread callbacks. It is neither a full ascent nor a browser FPS measurement, and is not directly comparable to the autodrive main-thread benchmark. Artifact: `artifacts/mountain-stress/mountain-four-shared-worker-probe.json`. Do not enable automatic mobile migration based on main-thread smoothness alone.


## Worker terrain parity and chassis attribution follow-up

The packed-worker environment now uses the existing per-vehicle `PhysicsTerrainQueryFrameCache` with a swept chassis bounding rectangle. It preserves the terrain frame across contact refreshes within a chassis step, and rebuilds it for subsequent steps, explicit fresh queries and recovery. Terrain support batches use pooled frame results, and the body solver can use the same local contact/edge fast paths as the main-thread environment. The wheel material/weather path remains separate and current.

Corrected the worker's maximum-terrain-height query: it previously returned the tallest corner of any overlapping triangle, even if that corner was far outside the car's rectangle. It now uses the shared clipped-triangle calculation. A synthetic slope regression checks that a local rectangle whose maximum height is 2 m does not inherit the distant 100 m corner. Tests also compare point heights/normals/triangle IDs, frame reuse and recovery invalidation. This is a correctness correction as well as an optimization; worker trajectories are not expected to match the previous incorrect envelope implementation.

Repeated 8-second four-vehicle worker probe: median worker tick 11.15 ms, P95 57.29 ms, max 123.97 ms; player throughput 114.47/120 steps per second, AI about 57.55/60. Player backlog ended at 39, rather than 461 before this change. Main heartbeat median 16.15 ms, max 26.10 ms. The short straight-throttle probe still fails sustained throughput qualification and does not establish browser FPS. Artifact: `mountain-four-terrain-cache-worker-probe.json`. Automatic mobile migration remains blocked. Full-ascent, interacting-car, real-browser and long thermal validation are still needed.

Added four optional physics accounting stages for chassis impulses, state publication, tire thermal/state publication and diagnostic publication. They separate actual integration from work previously hidden under one large chassis timer. `RTG_CHASSIS_PROFILE=1` records these stages in the CPU benchmark; diagnostic overhead means its total frame times must not be presented as uninstrumented performance.

Focused terrain, worker entry, packed environment and cost-accounting validation: 33 tests passed.


Chassis-stage measurement on saved Mount Washington, three detailed opponents, clear/noon, 600 updates: player tire thermal/contact publication accounted for 679.48 ms of 783.20 ms across the four chassis stages (1,190 measured chassis steps). A microprobe using an actual 103-field tire record found generic `Object.assign` bulk copying substantially slower than explicit own-key assignment on this Node/V8 build. The production change is limited to internal string-keyed tire/contact records, reads current keys each time (no stale schema), retains shallow references and destination-only fields, and leaves thermal equations/rates intact.

After the copy change, the same player stage measured 258.95 ms over the same 1,190 steps. Final AI states, player route state, and track checksum `286b944e` match. These are single instrumented comparisons, not statistical confidence intervals. The benchmark can separately enable AI stage accounting with `RTG_CHASSIS_PROFILE_AI=1`; the original two stage comparisons instrument player only. Thirty-six contact, transaction, replay, mechanical-thermal and publication tests pass, including changing-field copy parity and handbrake replay across render partitions. Instrumented artifacts: `clear-autodrive-chassis-stages-cpu.json` and `clear-autodrive-chassis-copy-cpu.json`.


Isolated uninstrumented A/B, same saved mountain/car configuration, clear/noon, three detailed opponents, 600 updates: old publication path median 23.29 ms / P95 30.54 ms / P99 39.89 ms; optimized path 20.88 / 26.93 / 32.05 ms. The diagnostic baseline loader restores only the old tire-record copy calls. Entire reported AI state lists, player route state and track checksum match exactly. These single-run CPU timings exclude browser rendering; thermal/runtime noise remains possible. Comparison artifact: `tire-publication-comparison.json`. Essential CPU work still exceeds the 16.67 ms target, and no stable-60-FPS completion is claimed.


## Follow-up: CPU placement, rejected copy experiment, collision energy audits

The expanded all-stage capture (`clear-autodrive-all-stages-cpu.json`) measured median 8.13 ms despite more instrumentation, while sampling CPU 7 at 3.4–3.6 GHz versus about 0.88 GHz in the preceding slow runs. This is not a new optimization result. The development device changes CPU frequency/placement substantially; cluster snapshots do not prove which CPU executed the work or why frequency changed. The harness now records `/proc/self/stat`'s last observed main-thread processor and that processor's sampled frequency, as well as CPU 0/7 probes. Reads occur outside the timed update and are diagnostic only; they neither pin the thread nor alter the governor. Do not normalize browser FPS from these Node frequency samples.

A candidate extension of explicit record copying into the tire force model was rejected. Four alternating, same-process reference comparisons showed no reliable benefit, so those production edits were reverted. The earlier independently measured tire-state publication change remains. Artifacts retain the experiment under `tire-force-*`; the rejected source substitutions are no longer applicable to the current force model.

Fresh V8 sampling (`clear-post-copy-sampling-ai-steady.cpuprofile`) highlighted repeated full-state spreads and energy calculations inside collision transactions. The energy audit now accepts a separate pose when evaluating old-position/orientation energy. It reuses identical kinetic/mechanical results only across consecutive audit fields with no intervening state mutation. Force integration, collision solving, recovery and fixed rates remain intact. This removes two full vehicle-record copies and duplicate energy evaluations per substep.

Validation: transaction/replay/recovery suites passed (14 tests); the collision transaction regression additionally checks that a 12 mm upward correction records the corresponding gravitational work. A test-only reference snapshot of the prior runner matches every state field across four alternating 240-frame runs, and every retained telemetry field across four 90-frame runs including airborne landing, braking and steering. Alternating timing is modestly better in three of four rounds, about 4.7% lower aggregate time in that synthetic probe; it is not a full mountain/FPS claim. Artifacts: `energy-audit-alternating-comparison.json`, `energy-audit-retained-parity.log`, and `energy-audit-regression-tests.log`.

`RTG_ALL_PHYSICS_STAGES=1` together with chassis profiling now captures all accounting stages for the player and optionally detailed AI. These accounting stages have exclusive timings; the fresh sampling profile also contains inspector shutdown work (`node:inspector.post`), which must be excluded from gameplay bottleneck interpretation. Stable real-browser 60 FPS remains unverified.


Post-change saved-mountain smoke run: 600 updates, three detailed opponents, clear/noon, diagnostics off. CPU median 15.45 ms, P95 28.13 ms, P99 35.07 ms. Sampled main-thread placement moved among CPUs 0/1/4/5 and frequencies varied from 1.32 to 3.63 GHz, so this is not a clean timing comparison with the preceding 20.88 ms run. Reported AI states, player route state and track checksum match the pre-energy-change run exactly (`286b944e`). Artifact: `energy-audit-mountain-comparison.json`. The tail still exceeds the display interval even without rendering.


## Bounded weather-profile preparation ahead of the car

The existing background-weather scheduler already limits weather work and prohibits flow from stale cells. A remaining synchronous path is the first tire read of a new weather profile after a long race history. Ahead preparation now computes that exact recurrence in private slices, with at most 32 history ticks total per corridor job. It resumes the same point when the allowance is exhausted. It never inserts an active cell, publishes totals/revisions, advances simulation time or transfers water.

Prepared profiles use a separate four-entry cache, so optional work cannot evict the existing sixteen-entry demand cache. A demand read adopts a compatible prepared profile only when it does not exceed the requested tick; older requests retain the normal fallback. Already-current demand profiles can be read without mutation to avoid duplicated preparation. Missing preparation is completed synchronously by the normal authoritative read, so grip never uses an incomplete result. Cache state invalidates on history-map replacement or checkpoint base changes. Ordered per-tick additions remain intact rather than replacing them with an aggregate sum.

Validation covers partial preparation, snow/thaw, older requests, eviction, isolation of demand entries, exact cell/totals/checksum/revision parity, and runoff receiver exclusion. The frame recorder now includes cumulative prepared-tick and slice counters. Targeted suites passed 37 tests, followed by the additional runoff regression (38 unique tests across these suites). The later scheduler estimate change is covered by rerunning the focused suites.

A twelve-round, 7,200-tick storm-history probe shifted first-contact work into 225 optional slices. Most warmed first reads were about 0.07–0.11 ms versus about 0.8–0.9 ms cold. First-use outliers were present (the first preparation slice took 2.58 ms), and preparation used more total CPU than a synchronous replay because it repeatedly yields/reconstructs lookup inputs. This trades spare CPU for contact latency; it is not a demonstrated frame-rate gain. Artifact: `weather-preparation-probe.json`.

Saved Mount Washington integration smoke: zero AI, full storm/night/zero authored brightness, 180 seconds of weather history, 300 updates. Enabled preparation performed 96 recurrence ticks across three slices. Player route state and checksum matched preparation disabled (`795995f3`); no optional failures occurred. The scheduler deferred 126 times. Three jobs exceeded the estimated deadline, with maximum job time 0.955 ms; the initial ahead-job admission estimate was subsequently raised from 0.5 to 1 ms. Jobs remain cooperative, not interruptible. Artifact: `weather-ahead-comparison.json`. Timing is not presented as an isolated FPS improvement, and this is not the required real-browser/multi-car performance validation.

## Thirty-car attribution follow-up (2026-11-01)

Saved Mount Washington, clear/noon, player plus 29 AI, 600 updates. Production AI detail selection remained three detailed and 26 cheap/reduced-rate cars. The phase-only run (`clear-autodrive-combined-thirty-clear-cpu.json`) measured median 29.19 ms, P95 45.47 ms before rendering. Inclusive AI time over the 500 measured updates was 9,313.65 ms, of which 3,553.04 ms was inside the detailed physics method. These nested values must not be summed.

A separate V8-sampled run (`clear-thirty-ai-attribution-ai-steady.cpuprofile`) confirms that lowering advisory planning frequency alone is unlikely to solve this case. AI accounted for 9,434 ms sampled wall time. Work outside `updateRaceAiVehiclePhysics` accounted for 5,470.63 ms: 41.37% terrain/surface queries, 20.69% track state, 15.18% orchestration, 6.80% powertrain/mechanical, 5.66% distant integration and 5.13% driving/traffic planning. This outside-runner category includes contact/event preparation for detailed cars too; it must not be described as exclusively cheap AI. Track-state contact accumulation and road-deck/profile sampling are priority investigation sites. Repeated queries and mutation preparation should be measured before changing their cadence, since these influence actual grip and road changes.

The profile summarizer now separates inspector `post` stacks (including descendants) from gameplay. Stopping this capture consumed 1,979.52 ms in that harness path. Excluding it leaves 16,485.46 ms sampled gameplay/runtime time; GC remains unattributed rather than assigned to AI. Reports include outside-runner categories and self-time rankings. Two synthetic regression tests cover descendant filtering, zero-duration samples, detailed/outside attribution, GC isolation and all-inspector captures.

The sampled run's median 29.57 ms and P95 43.47 ms include instrumentation and are not an optimization result. No vehicle equations, update rates, or assets changed in this follow-up. Stable browser 60 FPS remains unproven. Next: reduce repeated terrain/deck lookup and contact-event preparation cost, preserving physical mutation totals and deterministic ordering, then compare saved-state parity and long phone captures.

## AI road-contact batch preparation (2026-11-01 20:12 UTC)

`sampleRaceAiWheelContacts` now uses the surface model's existing prepared-query context once per four-wheel batch. Previously each wheel separately resolved the same roadbed profile. Geometry projection, layered-deck selection, baked triangle lookup and live Track State reads remain per wheel. The context is not retained across batches, so changing the road/bake cannot leave an old profile attached to a car. Models without the prepared-context API keep their previous path.

Thirteen focused contact/surface tests pass. The new regression compares prepared and original contexts exactly across road elevation revisions and changing wet grip, checks four profile resolutions become one, and verifies retained contact results remain unchanged. Existing layered-surface tests cover bridges and vertically overlapping decks.

Saved Mount Washington, player + 29 AI, clear/noon, 600 updates: baseline and prepared runs have identical reported AI states, player drive state and track checksum `1ed245fc`. Baseline CPU median/P95/P99: 9.30/15.83/21.50 ms; prepared: 9.82/15.67/21.65 ms. Main-thread frequency samples were roughly 4.26–4.74 GHz baseline versus 3.76–4.07 GHz prepared, unlike the earlier slower-core profiles. These are not a controlled speedup result. The measured structural reduction is three profile resolutions per four-wheel batch; real-browser FPS remains unverified. Reference source, baseline loader and comparison are retained under `artifacts/mountain-stress/road-contact-context-*` and `road-context-comparison.json`.

## AI contact-event receipt allocation (2026-11-01 21:10 UTC)

AI drivers ignored the receipt list returned by `queueTrackStateTireEvents`, but the default path still allocated per-cell receipt records and nested result arrays. The driver now explicitly disables receipts and supplies the canonical sorted four-wheel list, avoiding repeated key enumeration/Set/sort work. Actual contact accumulation, flush ordering and road mutations remain enabled. This applies only to the AI call site whose return value was unused.

A candidate also reused contact input records through a per-car WeakMap. That pooling was removed after mixed timing and larger early outliers; the final implementation retains ordinary contact input records. Eight targeted tests pass, including exact aggregate and flush-event parity over 121 updates of 30 cars with cell crossings, brake lock and airborne wheels, plus existing wet-state/checkpoint/serialization checks. Both receipt-disabled and pooled candidate modes remain covered by the test.

Same-process alternating microbenchmark: after the first two rounds, six rounds total 2,711 ms original versus 2,546 ms without receipts (about 6% lower in this isolated path). Pooling was about 2,505 ms in those rounds but substantially worse in early rounds, insufficient benefit to justify retaining it. Each original 600-update round produced 72,000 receipts; both candidates produced none. This is not a frame-rate gain. Artifact: `ai-event-reuse-variants.json`.

A saved-mountain 30-car integration run of the pooled candidate matched reported AI state, player drive state and checksum `1ed245fc`, both against the earlier baseline and a fresh original-code baseline. Final non-pooled behavior is covered by exact event parity tests; this full integration capture includes the subsequently removed pooling. Timings were poor in both fresh runs: candidate median/P95/P99 31.83/173.70/204.52 ms, original 31.54/164.26/199.31 ms. The process also suffered extended wall-time delays during loading before the changed call site; sampled main-thread clocks were often 1.32 GHz. Do not claim the timing difference proves either a speedup or regression. Retained artifacts: `ai-contact-events-reference-source.txt`, `ai-contact-events-baseline-loader.mjs`, `ai-event-reuse-parity.json` and the corresponding CPU reports. Stable browser 60 FPS remains open.

## Direct contact-total accumulation (2026-11-01 21:13 UTC)

The contact accumulator's fixed 13-field physical-total loop now uses direct named field updates rather than dynamic property indexing. Multiplication/division order and addition order remain identical; no physics rate, contact sample, road mutation or precision is reduced. The field schema remains documented in `PHYSICAL_TOTAL_FIELDS`, which other accumulator operations still use.

Nine targeted tests pass. New supplied-total coverage compares the historical reference across 300 deterministic contacts with cell crossings, multiple time slices, missing/zero/invalid overrides and snapshot restoration. Existing tests cover wet-road checksums, ordered events, airborne wheels and 30-car contact accumulation.

An alternating same-process reference/current benchmark was faster in all eight rounds and preserved exact events and snapshots. The six rounds after the first two total 1,513.17 ms reference versus 973.70 ms direct (35.65% lower for this isolated accumulation/flush workload). This does not represent a 36% improvement in the entire game. Source reference and results: `contact-total-reference-source.txt`, `contact-totals-comparison.json`.

The combined final code (including receipt suppression without the rejected input pooling) completed the saved Mount Washington 30-car, clear/noon, 600-update run. Reported AI states, player drive state and track checksum `1ed245fc` match the preceding original-code baseline exactly. CPU median/P95/P99: 30.53/46.00/54.37 ms before rendering. This run no longer exhibited the prior baseline's extreme timing tail, but differing device conditions prevent attributing that difference to this change. Artifact: `direct-contact-totals-mountain-parity.json`. Stable browser 60 FPS remains unverified; a fresh phone capture has been requested to assess actual presentation costs alongside simulation.

## Rejected per-slice totals hoist and next cache boundary

A follow-up candidate moved physical-total calculation outside the per-cell piece loop. Nine targeted tests and alternating microbenchmark snapshot/event parity passed, but timing was mixed (three of the six post-warmup comparisons were slower; aggregate measurements did not establish a gain). The candidate was reverted exactly to `contact-slice-reference-source.txt`, retaining the earlier measured direct-field updates. `contact-slice-comparison.json` preserves the experiment. Do not report this candidate as shipped or as a speedup.

Inspection identified a broader possible cache boundary: distant-car geometry is already reused at the exact preceding pose, but `getRaceAiContactState` rebuilds material/contact records on that path. `TrackState.sample` already supports revision-aware scratch state. Any extension must guard track identity, step index, cell/sample revision, checkpoint lookup revision, bake identity and vehicle dimensions; cached mutable outputs must not alter retained contact records. This is a candidate for measurement, not an implemented optimization. The newest server-side phone capture still predates this work (2026-11-01 16:10 UTC); no new phone validation was available during this follow-up.

## Fresh phone capture: 2026-11-01 21:14:58 UTC

Capture `49294a4aa6e2804e4482bed6f9cc4b93cf5caea4318a95a5c198bb63d61345dd.json`: detailed, 60.009 seconds, Android Chrome, 29 opponents, full storm, main-thread physics. A newly started material-contact reuse experiment was set aside before analysis; its source is preserved as `material-reuse-*-candidate.txt`, and production was restored to the corresponding reference snapshots. The recording is evidence for the preceding code, not for this unvalidated candidate.

Whole-capture intervals: median 13.5 ms, P95 21.0, P99 27.7, maximum 152; 17 intervals over 33 ms and six over 50 ms. Excluding countdown/intro leaves 3,907 frames: median 14.0, P95 21.3, P99 28.1; 949 (24.3%) over 16.67 ms. These are recorded callback/frame intervals, not measured panel presentation FPS. Average instrumented update 6.84 ms and draw 6.29 ms; player physics 1.83 ms and AI 3.51 ms are nested inside update, not additional costs.

Submitted-car association (not an isolated A/B; route position, camera and race time differ): with zero/one submitted car, median/P95 intervals 10.5/16.7 ms and draw mean 4.61 ms; with 16+ submitted cars, 16.0/27.0 ms and draw mean 8.01 ms. Submitted counts include the player and do not measure terrain visibility. Car-sprite work rises from 0.45 to 3.66 ms average in those groups.

Worst CPU frame #3101 at capture 39.138 s: 148.8 ms instrumented, draw 107.2 ms, update 41.6 ms. `carSprites.paintScratch` accounts for 90.7 ms inclusive/90.2 ms self across eight paints; no new resting-frame cache builds occurred in that frame. This identifies the containing path, not the exact cause inside it: scratch clearing, painter execution, browser/Canvas stalls or GC cannot be distinguished by that scope. Compact nested trace stride 4 did not retain frame #3101's spans. Do not claim a confirmed 90 ms algorithmic paint cost or GC cause. Further splitting scratch clear and artwork callback scopes is warranted, together with investigating camera-turn repaint invalidation and texture copying.

Around 57.87–57.92 s, recovery failed twice with `Reset unavailable: Unable to converge static vehicle support`, then validated on attempt three. These frames include 12.1/8.1 ms in authoritative reset and about 8 ms in player tire work. The reset ultimately finished, but the stale error text remains in the last context. Avoid describing this as a proven final reset failure.

Weather catch-up max 2.7 ms, new wet-cell initialization max 0.4 ms, thunder max 0.3 ms; they do not explain the 152 ms hitch. Total Track State work still reaches 8 ms (P95 3.1) and is not negligible. Frame-budget diagnostics end with zero failures/debt/discarded time, 41 optional overruns and max job 5.7 ms. The scheduler is cooperative, not a hard deadline. GPU timing is unsupported; repeated coarse heap readings cannot establish or exclude GC. Analysis script/output: `artifacts/mountain-stress/analyze-latest-phone.py`, `latest-phone-analysis.txt`.

Priority from this evidence: car painting/copying under camera turns, retrying support placement during reset, then AI/contact work and fixed per-frame scenery-key validation. Current phone performance is substantially faster than the Node runs, but consistent 60-FPS frame pacing is not yet proven.

## Car-paint stall diagnostics (2026-11-01 21:20 UTC)

The fresh capture's large `paintScratch` scope did not distinguish clearing the two Canvas surfaces from invoking the car artwork callback. Those operations now have separate synchronous method boundaries, `clearScratch` and `paintArtwork`, wrapped only by detailed capture. Detailed captures also time projected car sprite drawing, billboard layers and resting-art lookup. Every frame's aggregate timings retain these scopes even when compact nested trace sampling skips that frame. No per-Canvas-primitive timers were added.

Per-frame repaint reasons distinguish initial images, full-rate drawing, viewport clipping, viewport changes, appearance changes, scale changes, camera rotation and normal refresh intervals. Reasons use the existing invalidation conditions and are copied into capture rows so subsequent frames cannot mutate earlier evidence. Existing refresh decisions, immediate lamp updates, clipped-image replacement, terrain depth and artwork are unchanged. The current eight-paint adaptive limiter only applies to compatible cached images; it is not a hard limit when those invalidation conditions fail. Whether that is the dominant source of actual spikes needs the new reason/timing data before relaxing any correctness checks.

42 rendering/capture tests pass; the sprite suite was rerun after adding explicit reason assertions for first paint, reuse, lights, full-rate rendering and clipping. Tests also verify the new timing scopes on frames omitted by trace stride, copied counters and hook restoration. This is an instrumentation improvement, not a claim that the 90 ms painting stall is fixed. The next independent task is the failed static-support reset attempts visible late in the phone capture.

### Cached-car projection cleanup (2026-11-01 22:09 UTC)

Inspection after the latest phone capture found two unused projections on each
resting-frame repaint: body-up (used only to rotate detailed layers) and shadow
screen position (used only by the detailed shadow painter). These now run after
the cached-frame return. Ground surface sampling remains before that return:
it supplies the depth-plane correction and cannot safely be removed merely
because the artwork is cached. Body anchor, size, emission and view selection
are unchanged. The regression compares cached paint coordinates and ground
metadata with the detailed path and verifies two fewer projection calls.
All 21 AI projection/depth-sprite tests pass. This is a bounded CPU cleanup,
not evidence that the 90 ms phone paint stall is resolved. The new detailed
clear/artwork/layer scopes are still needed to attribute that stall.

### Scenery validation overhead (2026-11-01 22:11 UTC)

Kept per-frame mutable placement validation: there is no complete mutation
revision contract to safely bypass it. Replaced the placement `every` callback
and spread-map validation arrays with short-circuit loops, preserving field
comparisons, ordering, immediate edit/removal detection and asset revision
checks. Nine scenery performance tests pass, including a new mutation matrix
covering all previously tracked fields, identity, session and surface changes.

`artifacts/mountain-stress/benchmark-doodad-key.mjs` compiles the old and new
methods with identical dependencies and validates identical scene keys. Eight
alternating-order rounds, each 400 checks of 18,000 unchanged placements, were
all faster for the candidate: approximately 0.84 ms/check reference versus
0.23 ms/check candidate overall. CPU frequency varies on this host; this is an
isolated Node CPU benchmark, not browser FPS or a fix for the car-paint stall.
Results: `artifacts/mountain-stress/doodad-key-comparison.json`.

### Combined validation and remaining acceptance gaps (2026-11-01)

A combined run of frame budget, AI physics budget, AI road contacts, AI contact
event reuse, recovery history, static reset equilibrium, AI projection, car
depth sprites, scenery validation, detailed instrumentation and capture tests
passes **104/104**. Log:
`artifacts/mountain-stress/combined-frame-pacing-tests.log`.
This checks interactions between the recent changes, not just each isolated
patch. It is not a full repository test run or browser rendering validation.

The stable-frame-pacing objective remains incomplete:

- Latest phone evidence still has 24.3% of active frame intervals over 16.67 ms
  and a 152 ms maximum interval. No later upload was present at this check.
- New clear/artwork/layer scopes and cache invalidation reasons have unit
  coverage but have not yet captured the phone's large painting stall.
- CPU microbenchmarks establish local savings, not GPU/presentation behavior.
- Cooperative job admission cannot interrupt a synchronous Canvas/driver stall
  or a physics solve already underway. A frame cap alone cannot guarantee 60 FPS.
- The reset retry change avoids one duplicate historical-pose solve; it does
  not establish why the first recorded pose failed support validation.

Next decisive evidence is the requested detailed phone capture after refresh.
Use its new paint subscopes and repaint reasons before relaxing clipping,
appearance or camera invalidation, changing texture ownership, or reducing
visual detail further. Preserve all-four-tires-on-road reset validation and
player physics while investigating.

### Consistent saved-pose validation (2026-11-01 22:15 UTC)

Found a reset-path inconsistency: placement-only restores checked body clearance
and four supported wheels on iteration zero, but after any initial rejection
required full force/moment equilibrium for the remaining iterations. The same
placement predicate now runs after each bounded settling correction. The runner
still checks upright orientation, wheel load, actual road region and contact
height across each tire's width. General static resets still require equilibrium.
Trace count now represents one entry per placement iteration.

Twelve equilibrium tests pass, including four saved-pose scenarios (flat,
12% uphill, 8% bank, and combined -12% downhill/-6% bank), each followed by
120 normal physics steps with upright checks and final four-wheel support.
Tests also retain off-road rejection, exact-pose one-rebuild restoration,
replay and bounded fallback coverage. This addresses an observed code path;
the specific phone reset cannot be claimed reproduced from its summary alone.

The broader symmetry run has two failures: stationary WRX2 bumpy-terrain hold
and zero-steer braking symmetry. Both reproduce with the prior solver restored,
so they are not introduced by this change. Prior-version comparison is logged
in `artifacts/mountain-stress/reset-symmetry-prior-solver.log`; new placement
coverage is in `artifacts/mountain-stress/placement-iteration-tests.log`.
These broader failures remain unresolved and must not be reported as green.

### AI terrain sample ownership (2026-11-01 22:20 UTC)

Investigation of the stationary bumpy-terrain test found its prepared-terrain
provider ignored the tire solver's `query.target`. `samplePoint` otherwise
returns the frame's shared scalar result; later wheel/body queries can overwrite
a retained sample. The main player provider already honors this target. The AI
provider in `updateRaceAiVehiclePhysics` did not, and now forwards it. This uses
the existing per-wheel iteration buffers, without adding per-query allocation
or changing physics frequency. The symmetry test provider now follows the same
ownership contract as production.

Eight AI rate/budget tests pass, including 0%/10% storm-road braking, bounded
catch-up, three detailed cars in a 30-car field, and a new production-provider
regression checking identity and retained sample contents after later wheel
and scalar queries. The previously failing bumpy stationary hold test now
passes for its 600 physics steps. The separate braking-symmetry test still
fails and remains unresolved. Logs: `ai-owned-terrain-tests.log` and
`reset-symmetry-owned-samples.log` under `artifacts/mountain-stress/`.

This is a contact correctness fix that can change AI results on uneven terrain;
old AI checksum parity is not an acceptance criterion for preserving this bug.
Its performance impact and connection to the phone hitch are not established.

### Remaining braking symmetry discrepancy quantified (2026-11-01)

Ran the six dynamic symmetry scenarios with diagnostic output and only the
final mirrored-force assertion bypassed in an artifact copy (not the real
test). All other assertions passed. The braking front-tire pair is
-16.348316/+22.342255 N: residual 5.993939 N against a 5 N test threshold,
with respective normal loads 6179.736822/6187.253103 N. After 30 steps at
120 Hz, lateral displacement from the initial x is -0.000046 m and lateral
velocity is +0.00024 m/s. The same sign appears in both translated runs.
Other tested scenarios stay within the existing force tolerance.

This is a real small symmetry discrepancy, not proof of a performance stall
or a reason to change player handling. Keep the assertion/tolerance unchanged;
its failure now prints both forces. Full diagnostic evidence:
`artifacts/mountain-stress/braking-symmetry-details.log` and its
`diagnose-braking-symmetry.mjs` runner. No physics change made for this finding.
Priority remains reproducing the phone Canvas painting stall with the new
subscopes. The newest uploaded capture remains the 21:14:58 UTC report.

## New phone capture: 2026-11-01 22:20:58 UTC

Upload `0d6f45b6f22f6f158a0c9b6d9e0f523aac2d7e655bb9075ccf2b4a69c1aac11a.json`
arrived during the upload check; work is no longer waiting for this evidence.
Detailed Android capture, 29 AI, full storm, main-thread physics, 406x228 race
viewport. New paint scopes are present; metadata does not establish precisely
which subsequent source edits were loaded. Do not attribute changes solely to
patches by comparing these uncontrolled driving runs.

Active frames: 3,684; interval median 14.2 ms, P95 28.1, P99 34.8;
1,109 (30.1%) over 16.67 ms. Average CPU update 8.25 ms, draw 6.27 ms.
The prior 90 ms painting spike did not recur: maximum summed paintArtwork per
frame 11.8 ms, same frame billboard layers 11.7 ms; clearScratch max 0.2 ms.
There are still occasional costly actual layer paints, but the worst new
frames are simulation-side. This does not prove the earlier stall is fixed.

Frame 2682 at 35.705 s: 114.1 ms measured CPU, 120.7 ms interval, update103.4,
player58.9, draw10.7, checkpoint10.7. Only two chassis/tire steps, 62 terrain
point queries, 150 prepared triangles, no active CCD. Multiple unrelated
scopes have roughly 5 ms pauses. Frame2684 at35.862s has physicsEnvironment
57.9ms in a single call, but modest terrain counts. This is consistent with
runtime scheduling/GC/host interruption, not proof of any specific one.

Sustained 40–50s slowdown is different: median24.8/P95 34.4ms; player8.43ms/frame.
Normalizing by completed steps removes catch-up amplification: player cost
rises from0.92ms/step during20–30s to3.08ms/step during40–50s. Body support
features rise4.55→1920 per step, adaptive features0.26→486, full envelopes
0.12→2.29, penetration searches0→10.58 iterations, terrain point queries
30.8→291.2. Frame3038 at43.429s generates10,116 support features and56 binary
search iterations across four steps. This is player underbody/terrain contact
work, not extra opponents rendered. No collision pose is stored here, so do
not claim whether the car was flipped, scraping, or off-road from counters alone.

Next priority: audit repeated player body-support/manifold/penetration work
without removing collision checks or altering player physics Hz. Separately
investigate the short runtime-wide pauses; weatherField averages0.17ms and
car painting is not the dominant sustained cost in this run. WebGL submission
also rises later (3.78ms self average50–60s), so rendering is not cost-free.
Artifacts: `phone-1722-analysis.txt`, `phone-1722-collision-summary.json`;
`analyze-latest-phone.py` now accepts an input capture path.

### Rejected rollback-predicate experiment (2026-11-01)

The 40–50s capture window led to inspecting the 14-trial local safe-pose search.
An experimental predicate kept identical candidate generation, terrain queries
and penetration math but stopped after proving any feature exceeded tolerance,
skipping full report construction. Ninety-six rough-terrain/pose combinations
matched the existing report decision. Existing three chassis-suite failures
(submerged recovery, bounded inverted overlap, descending rebound apexes) also
reproduced with the original full-report search via an import override.

However, six alternating-order benchmarks of96 searches x14 trials each were
ALL slower: reference439–519ms/round, candidate457–556ms/round. Each round's
summed safe-search fractions matched exactly. The reference retains its normal
penetration result cache; the candidate bypassed that cache. This experiment
does not isolate cache cost from JIT/branching effects, but establishes no
benefit for this implementation. Production source and its added test were
reverted; existing collision accuracy/search behavior is unchanged.

Artifacts preserve the candidate source, regression text, benchmark and results:
`penetration-predicate-candidate.txt`, `penetration-predicate-regression.txt`,
`benchmark-penetration-search.mjs`, `penetration-search-comparison.json`,
`penetration-reference-failures.log`. The benchmark imports the saved candidate,
so it remains reproducible after the production revert. Next investigate the
repeated adaptive support generation and terrain sampling, preserving existing
cache reuse, rather than shipping this failed optimization.

### Exact support-selection reuse (2026-11-01 22:32 UTC)

The pooled body support buffer now retains the selected body envelope for its
last exact orientation and collision-instance owner. Selecting downward-facing
candidates and their lowest local envelope does not depend on translation or
terrain. Translation-only corrections reuse that selection; quaternion values
are compared exactly (no angular rounding), and another car invalidates it.
World-point transforms, adaptive terrain subdivision, terrain samples, full
penetration reports and all14 rollback trials still execute normally. Counter
`bodySupportCandidateCacheHits` exposes actual usage in future captures.

29 targeted support/terrain/reset tests pass, including tiny quaternion changes,
owner changes, and48 full penetration-report comparisons against forced cache
misses on prepared sloping terrain. Reset tests cover resumed physics on slopes.

The complete14-trial prepared-terrain vertical-search benchmark ran six
alternating rounds of96 searches. All rounds improved; aggregate time
1037.34ms reference vs806.37ms candidate, **22.26%** lower. Summed safe-pose
fractions match in every round. This benchmark deliberately exercises constant
orientation; rotating poses will invalidate the cache and need selection work.
It is not a22% whole-game FPS claim, nor proof the phone slowdown is resolved.
Artifacts: `support-selection-reference.txt`, `benchmark-support-selection.mjs`,
`support-selection-comparison.json`, `support-selection-validation.log`.

### Recorder bookkeeping attribution (2026-11-01 22:36 UTC)

Detailed setup/attachment and frame-finalization work previously fell outside
the named game scopes. Captures now include per-frame `recorderSetupMs` (sum
of hook checks during update/draw) and `recorderFinalizeMs` (context/detail
copying, compact-phase packing, GPU polling and periodic memory sample). The
latter is set before the stop callback so immediate uploads retain it. Neither
is added to game phase totals. These are partial recorder costs: nested timer
wrapper overhead, stop/report serialization, uploading, GC and host scheduling
cannot be isolated by these fields. The report limitations state this explicitly.

31 capture/detailed instrumentation tests pass, including synthetic known
bookkeeping costs, unaltered game CPU totals and serialization in the stop
callback. No claim that recording caused the35.7s interruption; this improves
attribution for a future capture rather than guessing at its origin.


### Saved mountain terrain validation (2026-11-01)

The user confirmed the latest capture's 40–50s interval involved scraping or
crashing. Player physics averaged 3.076ms per step there, versus 0.916ms in the
20–30s window. This supports treating the sustained cost as collision recovery;
it does not explain the separate 35.7s runtime interruption.

The exact support-selection cache was compared with its reference on baked
Mount Washington terrain at 13 positions from that interval. These are synthetic
vertical correction poses at recorded positions, not a replay of the missing
recorded orientation/velocity. Six alternating rounds per case each ran 48
searches with 14 trials. Every search fraction matched exactly, and adaptive
feature/pair counts remained unchanged.

With constant orientation, all six rounds improved: aggregate 594.03ms to
444.08ms (25.24% reduction), median round 92.23ms to 73.78ms; each candidate
round recorded 640 selection cache hits. With changing orientation, there were
zero hits and aggregate time was effectively unchanged (626.74ms to 625.17ms).
The rotating case included a noisy final pair (137.82ms reference, 173.46ms
candidate); do not claim a rotating-case improvement from its median. The cache
helps translation corrections without approximating rotation, but does not
remove the cost of tumbling or establish phone frame-rate improvement.

Artifacts: `benchmark-mountain-support-selection.mjs`,
`mountain-support-selection-comparison.json`, `mountain-support-selection.log`.


### Penetration cache world identity (2026-11-01 22:41 UTC)

Review before further caching found that penetration reports were keyed by pose,
tolerance and query-frame sequence, but not the query-frame object. Independent
frame caches start at the same sequence. A regression using two real frame
instances and an instrumented report evaluator reproduced reuse of the first
frame's result in the second. The cache now invalidates on object identity or
sequence changes. Same-frame hits remain supported. Thirty targeted collision,
terrain-query and reset tests pass. This is cache correctness hardening, not a
measured explanation or fix for the phone's runtime hitch. Latest upload remains
the 22:20:58 UTC recording, preceding these changes.

Artifacts: `penetration-frame-identity-before.log`,
`penetration-frame-identity-after.log`.


### Phone capture 2026-11-01 22:43:55 UTC

Source `89eb2a361a90967bef9a2a127c04b2de98f62b1b9c1bd849855003b15a63eb09.json`.
User turned 180 degrees, went behind the line, climbed and crashed several times.
29 AI, three detailed, full storm, main-thread physics, Android Chrome156.
New recorder setup/finalization fields confirm newer diagnostics were loaded.
Active4020 frames: median13.7ms, P95 21.6ms, P99 26.6ms; 888/4020
(22.1%) exceed16.67ms. Prior capture:14.2/28.1/34.8ms and30.1% over.
These are uncontrolled driving comparisons, not a causal optimization benchmark.
Across all4394 frames, maximum interval65.6ms,15 intervals exceed33.33ms.
Worst game CPU61.7ms versus prior114.1ms. The prior100+ms event did not recur.

Player physics per completed step:0–20s1.059ms,20–40s0.912ms,
40–50s1.076ms,50–60s1.147ms. Prior40–50s was3.076ms with sustained
penetration rollback; this run has zero binary-search iterations in40–50s,
180 in50–60s, and only52 support-selection cache hits overall. Thus the
improved overall timing cannot be attributed primarily to the new cache;
the contact workload is materially different.

Largest events:
-19.119s:52.1ms game CPU,54.3ms interval. AI27 collision step26.3ms
 inclusive/25.8ms self over2 calls. AI counters show58 terrain queries,
178 triangles,12 lower-hull features, no CCD: no recorded work-count explosion.
-53.227s:61.7ms game CPU,65.6ms interval. Player-facing
 `getRaceWheelContactState`33.3ms self for one call; player physics itself3.7ms,
152 terrain queries/288 triangles across4 steps. AI1 also had nontrivial
wheel/body contacts (5549 triangles) but did not account for the33.3ms lookup.
-12.930s:car sprites20ms, artwork18.3ms,27 submitted cars but only4 paints.
-21.948s:29 clipped repaints, sprites12.8ms including3.2ms texture copying.
Do not bypass clipped repaint safety to improve this: it protects complete cars.

Whole-capture means: detailed AI2.273ms/frame, lightweight AI1.035ms/frame;
WebGL submission self1.847ms, artwork0.560ms, clearScratch0.004ms.
40–50s WebGL submission inclusive3.59ms/frame is a sustained remaining cost.
GPU timing unsupported, so this is CPU submission/wait time, not measured GPU
render duration. Cars16+ had median13.1/P95 21.4ms; this camera-dependent
comparison does not isolate car cost from scenery or driving conditions.
Weather integration averaged0.17ms active, max4.8ms across the capture.
Recorder setup/finalize averaged0.170/0.102ms, maxima5.4/3ms; in the worst
frame they were0.2/0.3ms. They do not explain its long stall; nested timer
wrapper overhead remains outside those bookkeeping fields.

Next evidence targets are sub-scopes within wheel contact construction and the
ordinary AI collision path, plus scenery/WebGL submission draw-call reduction.
Runtime/GC interruption remains possible but unproven. Do not lower player
physics fidelity or blame weather based on this capture. Stable60FPS remains
unverified and the frame-time tail still exceeds its16.67ms budget.
Artifact: `artifacts/mountain-stress/phone-1745-analysis.txt`.


### Mount Washington polygon bucket audit (2026-11-01)

Rebuilt the saved mountain using the same race transfer bake options, then
sampled player locations every30 frames of the22:43:55 phone capture plus
frames1589 and3888. Five synthetic probes per location (center and four fixed
world-axis offsets); these are not recorded wheel positions or AI positions.
Each range probe is0.8m square. Frame preparation uses a16m square around the
player and the existing moving local index. Artifact records all probe counts.

The baked sampler has51,123 triangles,24m coarse buckets,41,412 occupied
buckets and253,264 triangle references. Coarse bucket occupancy median4,
P95 10,max76. Importantly, prepared physics queries use an additional1m
fine grid; explaining only the coarse buckets omitted that existing mechanism.
All sampled point probes used the fine grid. Point candidates median3/P95 9/
max16; range queries likewise returned median3/P95 9/max16 after deduplication
and bounds filtering. Raw range entries including duplicates median12/P95 30/
max60. Local cached regions held134–240 triangles, but each query did not scan
all of those triangles.

At53.227s, all five probes returned2 candidates. At19.119s, player-location
probes returned2–6 point candidates (2–5 range candidates); that event's AI
car position is not reconstructed, so this cannot directly establish its local
bucket occupancy. Recorded AI workload counters independently show only178
triangle visits across2 steps at that spike. The local index was reused at
both sampled player spike positions. Across the synthetic traversal there
were19 builds, median0.832ms and max10.803ms; these are local Node timings,
not phone timings or evidence of a matching phone index-build stall.

Conclusion: no evidence of excessive bucket density/fallback scans at sampled
player locations, especially the53s stall. This does not rule out repeated
queries, large swept bounds during other crashes, separate contact-state lookup
paths, or different AI positions. Avoid changing bucket sizes without evidence.
Next investigation should trace the33.3ms contact-state lookup internally;
this geometry audit does not explain that elapsed time.

Reproducer: `artifacts/mountain-stress/audit-mountain-buckets.mjs`.
Results: `artifacts/mountain-stress/mountain-bucket-audit.json` and`.log`.


### General contact lookup versus tire solving (2026-11-02 00:01 UTC)

Tracing frame3888's33.3ms editor.getRaceWheelContactState reveals a separate
legacy/general surface lookup, not ContactPatchTireModel. It calls SurfaceModel
getWheelContactState, four RaceSurfaceModel.sampleWorld queries (route projection,
sampleTrack/roadbed profile, baked sample), then builds contact records including
four trackState.sample calls for grounded wheels. The normal update calls
getRaceWheelSurfaceState immediately beforehand without sharing sampledContacts,
so overlapping surface work exists. The two APIs have different physicsContact
flags and material semantics; do not merge blindly without parity tests.

Correction to bucket-audit interpretation: its1m prepared physics grid does not
establish the candidate set or total cost of this general surface lookup. The
low local density remains useful, but cannot clear this separate call path.

An isolated200-call check on the saved mountain at fixed synthetic wheel offsets
near53.227s, with runtime geometry cache/signature scope and no dynamic track
state, measured median0.470ms/P95 0.825ms/max10.135ms. Across200 calls there
were800 sampleWorld/projection/sampleTrack/baked queries. Baked adapter time
was5.401ms total (~0.027ms per four-wheel call); sampleTrack69.765ms inclusive,
projection16.477ms, roadbed profile17.778ms (nested; do not sum all). An initial
harness without runtime geometry caching measured~18ms median, mostly profile/
route preparation. That initial harness was not representative of live play.
Neither run reproduces the phone33.3ms event or proves cache invalidation/GC.

Detailed recording now measures surfaceLookup.sampleWorld/sampleTrack/
sampleRawTerrain/sampleBakedSurface, surface subsystem contact/surface assembly,
trackState.sample, and editor roadbed-profile/route-length calls. Aggregate-only
wrappers avoid per-triangle trace growth; they still add diagnostic overhead.
20 detailed-capture tests pass including nested cost attribution, result
preservation and wrapper restoration. No vehicle physics behavior changed.
Artifacts: audit-general-contact-lookup.mjs, general-contact-lookup-audit.json,
general-contact-lookup-audit.log, contact-lookup-diagnostics-tests.log in
artifacts/mountain-stress.


### Controlled geometry versus track-weather lookup test (2026-11-02)

Reproducer `artifacts/mountain-stress/benchmark-contact-weather-ab.mjs`, results
`contact-weather-ab.json`/`.log`. Saved Mount Washington mesh and RTG tuning,
four fixed synthetic wheel offsets near captured53.227s position. Six cases,
four alternating-order rounds,20 calls each (480 measured four-wheel lookups).
Weather cases use a fresh real TrackState advanced532 ticks at0.1s with clear
or full-storm forcing. Preparation is outside query timing. Existing-cell cases
first sample the exact positions; new-cell cases first touch them inside timing.
Runtime geometry-cache wrapper/signature caching enabled except explicit control.
Actual resulting storm water depth0.303739mm; clear0mm. No rendering, AI, tire
events, moving wheel poses or phone-runtime replay. Cell histories have constant
forcing and no pre-existing disturbed/persistent puddles; cannot generalize this
to every weather history or old modified cell.

Four-wheel lookup median/P95/max(ms):
- Cached geometry only:0.304/0.975/1.779.
- Existing clear cells:0.329/0.750/1.026.
- Existing storm cells:0.337/0.592/0.831.
- New clear cells:0.919/1.898/2.269.
- New storm cells:1.208/1.638/2.004.
- Geometry-cache-disabled control, no TrackState:18.078/167.105/183.264.
Control outliers are not attributed to particular runtime events by this test.

Existing storm TrackState.sample costs0.045ms mean total for four calls; new
storm sampling0.827ms, including0.449ms in base-surface lookup (nested).
The control's baked triangle sampling costs0.020ms/call mean; sampleTrack27.495ms
inclusive and roadbed profile17.628ms inclusive dominate its29.617ms mean.
These nested timings must not be summed. New cell initialization includes its
weather history application; timing only catchUpCellWeather after creation
would undercount weather work.

Conclusion: ordinary accumulated water and first-touch53s storm cells do not
reproduce33.3ms in this test. Uncached road/profile preparation does produce
similar or worse cost without weather. This elevates cache-path validation as
an investigation target, not proof the captured spike was a cache failure.
Production normally enables that cache. Current phone capture cannot resolve
the newly instrumented surface/profile/track-state subscopes retroactively.


### Test-only runtime contact attribution (2026-11-02)

User explicitly requested diagnosis/tests only, no fixes. Added standalone
Node preload `artifacts/mountain-stress/profile-contact-runtime.mjs` wrapping
real contact lookup subcalls and checking geometry-cache scope; no production
behavior changes. Saved mountain,29AI, full storm,53s weather history,600 real
updates at1/60s under existing autodriver. No rendering. Existing harness skips
browser render prewarming; startup conclusions are limited to this harness.

601 in-update lookups all had runtime geometry cache and persistent signature
scope. Signature construction occurred only on the first update (2 path calls,
1 surface-signature call); zero no-scope queries. Median0.373ms,P95 0.479ms,
max29.129ms. Maximum was first update: new cell creation13.466ms inclusive,
surface revision key7.842ms inclusive, path signatures2.267ms (nested).
Thus a cold first-update lookup reproduces tens of milliseconds, but ordinary
running did NOT show recurring signature invalidations. This contradicts any
claim that recurring cache failure has already been demonstrated.

Largest later call5.629ms at frame537: surface.sampleTrack5.202ms self, no
observed GC overlap. Another3.076ms at frame8 was mostly TrackState.sample self.
292 GC events observed overall; none overlaps those selected slow calls.
These are Node events, not evidence about GC in the original phone capture.
Results preserved as `contact-runtime-profile-first.json`, benchmark summary
`storm-autodrive-contact-runtime-cpu.json`, log`contact-runtime-run.log`.
A longer1800-update run with V8 CPU sampling is being performed to investigate
steady-state scopes; do not treat the600-update test as a full-climb replay.


The longer1800-update/30s simulation run completed with29AI and V8 CPU sampling
started at update300.1801 contact lookups: all had cache/scope, only3 signature
construction calls, all first update. After5s:1500 lookups median0.332ms,
P95 0.392ms,max5.758ms. First-update call22.223ms, including9.388ms cell
creation self and3.077ms surface signature self. Later outliers occurred in
surface.sampleTrack(frame537), track.sample(frames1051/1606), and unclassified
outer lookup time(frame1052). No observed GC overlap for those calls.
No33ms mid-run contact event reproduced. This is evidence AGAINST recurring
geometry signature work in this live-update scenario; do not treat the uncached
control as the diagnosis of the phone stall.

CPU profile contains3.292s attributed to GC and2.295s in inspector.post across
~48.2s sampled wall time. Profile shutdown itself contributes to the latter;
these are not game-only costs or phone GC proof. The current profiler timestamp
origin was not calibrated to performance.now, so exact5ms-span CPU attribution
requires a calibrated followup rather than guessing an offset. Preserve results
`contact-runtime-profile.json`, `storm-contact-runtime-long-ai-steady.cpuprofile`,
`storm-autodrive-contact-runtime-long-cpu.json`, `contact-runtime-long.log`.
Summarizer: `summarize-contact-runtime.py`. Tests only; no fixes applied.


### Calibrated CPU-sample attribution (2026-11-02)

Test-only runtime preload now records monotonic-clock calibration and thread CPU
at contact boundaries. Calibration start/end offset drift0.279us, acquisition
uncertainty1.562us/0.573us. Profiler samples map to matching game call stacks
inside measured spans. ThreadCpuUsage is too coarsely accounted on this host:
median steady lookup reports0 CPU despite~0.339ms elapsed, some report more CPU
than elapsed. Do not use these individual thread readings for precise attribution.
The30ms wait/work sanity test distinguishes broad behavior but is insufficient
for submillisecond resolution; retain it as diagnostic evidence, not proof of
fine-grained timing accuracy.

Two largest steady contact outliers have direct sampled GC evidence:
-Frame535:5.652ms elapsed. CPU samples at+1.291,+2.360,+3.458,+4.528ms
are V8(garbage collector), bracketed by lookup code at+0.227/+5.603ms.
-Frame1044:5.336ms elapsed. Samples at+0.382,+1.442,+2.534,+3.597,+4.691ms
are(garbage collector). No signature rebuilds in either call.
These are positive GC attribution for reproduced NODE5ms events, not proof
that the phone33ms event was GC. Earlier statements of no GC overlap referred
only to PerformanceObserver entries; that event log did not expose these
intervals and cannot exclude GC. CPU profile is stronger evidence here.

Artifacts: `contact-runtime-profile-thread.json`,
`storm-contact-runtime-thread-ai-steady.cpuprofile`,
`contact-runtime-thread-analysis.txt`, `analyze-contact-thread.py`,
`thread-timing-validation.json`, `validate-thread-timing.mjs`.
A separate allocation-sampling run is in progress to identify allocation sources
without changing simulation behavior. No fixes applied.


### Allocation-sampling diagnosis (2026-11-02)

Separate1200-update saved mountain29AI/full-storm run; sampled allocations for
updates301–1200 only (900updates,15 simulated seconds),64KiB sampling interval,
including objects reclaimed by minor/major GC. Diagnostics only, no fixes.
V8 estimates5234MiB cumulative allocated bytes, NOT retained memory. This is a
sampling estimate under Node instrumentation, not a phone allocation-rate claim.
Diagnostic preload files account for~3.21MiB direct self allocations; this does
not quantify all indirect instrumentation perturbation. Autodriver and harness
also allocate, so do not equate total estimate to browser gameplay allocations.

Leading self allocation estimates: route projection241.89MiB, deck sampling
169.55MiB, track condition sample129.67MiB, wheel cylinder pose111.48MiB,
wheel vector interpolation102.01MiB, default-car construction100.62MiB,
contact-record construction98.74MiB. Inclusive totals (nested; not additive):
getRaceCarTuning224.70MiB,createDefaultCar113.26MiB, deck sampling404.15MiB,
track-condition sample213.08MiB,cylinderPoseAt252.51MiB.

Source check: getRaceCarTuning calls createBuiltInRaceCars().find(...) before
choosing tuning.physicalVehicleProfile || car.physicalVehicleProfile || fallback,
so built-in default construction is performed even when a custom profile exists.
This establishes redundant reconstruction as an allocation target, not its
isolated FPS impact. The profile identifies allocations across real simulation
and road/contact bookkeeping; GC can interrupt any currently executing function.
No claim that a function containing a GC pause created all its garbage.

Artifacts: profile-contact-allocations.mjs, contact-runtime-allocations.heapprofile,
contact-runtime-allocations-analysis.txt, summarize-contact-allocations.py,
contact-runtime-allocations.log. Original33ms phone event remains unproven;
reproduced5ms Node pauses have GC samples, initialization22–29ms combines
cold geometry keys and cell construction, repeated geometry-cache failure was
not reproduced. Continue diagnosis without applying fixes.


### GC control without CPU/allocation samplers (2026-11-02)

900-update control: saved mountain29AI/full storm,53s prehistory,autodriver;
no contact diagnostic preload, no inspector CPU or heap sampler. V8 GC trace
and PerformanceObserver enabled. Last600 updates span20.438s wall time;
trace records approximately3519MiB allocated between GC cycles in that window
(cumulative allocation, not retained heap). GC events total1166.704ms/129events.
This independently supports substantial allocation churn without the detailed
profiler. Trace logging/observer and normal harness remain overhead, so it is
not an uninstrumented phone performance measurement.

Only7 observed GC events overlap measured update+autodriver spans, totaling
87.190ms overlap. Two included full26.921ms and30.282ms major-GC events.
Most observed GC occurred between updates where the harness yields with
setImmediate; a463.928ms major collection was wholly outside measured spans.
Do not claim that463ms was a collision call or that all1.167s was update CPU.
Time between updates still matters for real-time pacing, but this harness has
no rendering/compositor and is not a phone frame-interval replay.

Exclusive attribution of the prior allocation profile by ancestor call paths:
other AI planning/events25.4%,detailed AI22.5%,cheap AI movement/contact13.2%,
player physics excluding track-state14.3%,player track-state effects9.2%,
other shared race update12.3%,autodriver1.3%,other harness1.9%. Categories
attribute sampled self bytes once, unlike summing inclusive profiler totals.
These estimates describe the29AI workload, not equivalent per-car cost.
Artifacts: allocation-subsystem-summary.json, contact-gc-control-summary.json,
contact-gc-control.log, storm-autodrive-contact-gc-control-cpu.json.
No fixes applied. Fresh detailed phone capture requested to connect the new
sub-scopes to the original unexplained mid-race phone stall.


### Zero-AI control and repeated wheel-pose test (2026-11-02)

Repeated GC control with0 AI, same saved mountain/full-storm/53s prehistory and
900updates. Comparing last600 updates:29AI ~3519MiB allocation vs0AI1143MiB,
~67.5% lower without AI. GC event totals1166.7ms/129events vs115.27ms/45events;
max463.93ms vs14.32ms. Elapsed windows20.44s vs7.96s; cumulative allocation
comparison uses equal update counts, not equal wall duration. Whole-run median
update+driver28.16ms vs8.84ms, P95 46.07ms vs14.88ms. These are Node CPU test
conditions with GC trace output, not phone FPS. Final player progress180.09m vs
179.89m and lateral-0.7462 vs-0.7468m: similar route, not bitwise-identical runs.
AI includes its track-state/contact events, not merely steering calculations.
Artifacts: contact-gc-zero-ai.log, storm-autodrive-contact-gc-zero-ai-cpu.json.

Test-only instrumented WheelCylinderCollision source (loaded in memory) counts
cylinderPoseAt calls without changing returned values. Four cylinders with
24 radial samples, valid ordinary tread, obstacle classification forced active,
prepared query frame returning no intersections:144 feature segment queries,
292 pose evaluations, only8 distinct(wheel,fraction) pairs (start/end per wheel).
Instrumented result deep-equals original result. This verifies repeated pose
interpolation/axis normalization/object construction across wheel probes. It
applies when detailed cylinder collision activates, not smooth-road fast paths;
a real impact adds additional hit-fraction work. No hoisting/cache fix applied,
and no FPS improvement claimed. Reproducer audit-wheel-pose-repetition.mjs,
results wheel-pose-repetition.json/.log.


### Fresh phone capture: November 1, 20:13 local

Capture `29d10bd0584d9df5a03179cdf03182142618eeac4eaa2b8266980bfe9ac9e2d2`
started 2026-11-02 01:12:07 UTC. Android Chrome 156, Mount Washington,
29 AI (3 detailed, 26 lightweight), full storm. New surface/track-state
sub-scopes are present. Analysis only; no production changes made.

Active driving, previous 17:45 capture versus this one:
- Median interval: 13.7 -> 14.6 ms.
- P95: 21.6 -> 22.5 ms; P99: 26.6 -> 29.1 ms.
- Above 16.67 ms: 22.1% -> 28.8%.
- Mean instrumented CPU: 12.86 -> 13.90 ms.
Whole-capture maximum interval: 65.6 -> 73.9 ms; intervals over 50 ms:
2 -> 6. These are uncontrolled driving runs, with additional diagnostic
wrappers in the new capture. They do not establish a regression or improvement
caused by code. Frame intervals are not measured presentation FPS.

New attribution:
- At 24.550 s, 65.6 ms instrumented CPU / 67.2 ms interval. A lightweight
  AI update includes 27.5 ms in trackState.replaySharedCellWeather (5 calls).
  Adjacent frames have 2-20 calls taking 0-0.2 ms. Cumulative requested
  catch-up steps increase by 895 here versus 2154 in the following frame;
  neither requested steps nor replay-cache misses explains the spike.
  Cache hits/misses remain zero: short segments can integrate directly,
  and noncanonical cells can reject replay. Zero hits does not prove a
  cache invalidation bug. Exact executed replay steps are not isolated.
- At 53.256 s, adaptive body support takes 19.8 ms for 3 calls. The previous
  frame takes 0.3 ms for 3 calls, with 323 vs 318 body support features and
  1034 vs 1035 triangle visits. A bigger triangle search does not explain it.
- At 57.694 s, raw terrain sampling takes 23.6 ms for 73 calls. Nearby frames
  have 71-72 calls taking 0.2 ms. This scope includes terrain normals/material
  lookup, not TrackState weather replay. Counts alone cannot establish GC.
- At 57.620 s, the worst frame has 71.2 ms instrumented CPU / 73.9 ms interval:
  draw self 23 ms, AI 21.6 ms, player physics 12.1 ms. Player collision really
  is busier here: 4827 support features / 8198 triangle visits over 4 steps.
  The adjacent crash sequence mixes genuine increased work with isolated
  disproportionate delays. It is not entirely a weather or tire-solver issue.

Across all frames, baked-surface sampling averages 0.121 ms, max 2.7 ms;
raw terrain 0.138 ms, max 23.6 ms; TrackState.sample 0.385 ms, max 29.6 ms.
These are aggregate inclusive scopes; do not sum them with parent timings.
Active mean carSprites is 1.07 ms (previous 1.08), player physics 1.99 ms
(previous 1.76), AI 3.88 ms (previous 3.59), drawing 6.47 ms (previous 5.86).

Conclusion: phone evidence localizes multiple spikes, but does not directly
identify GC. Independent Node CPU profiles already positively reproduced GC
inside contact lookups; allocations remain a credible shared explanation for
some disproportionate phone spikes, not a proven explanation of each one.
The prepared triangle search is not demonstrated to be the dominant problem.
Priorities for a later authorized implementation experiment: reduce repeated
object construction and invariant profile setup, reuse wheel poses within
identical queries, then separately bound/measure weather-history replay and
adaptive crash-contact work. Preserve physics semantics and compare controlled
replays before claiming frame-rate gains.

Raw summary: artifacts/mountain-stress/phone-2013-analysis.txt.


### Allocation ownership and precomputation investigation (2026-11-02)

Reclassified self allocation bytes in contact-runtime-allocations.heapprofile
by stack ancestry, counting each node once. This is the existing 900-update,
29-AI Node sampling experiment, not a new phone measurement. Weather evolution
and replay roots account for 71.20 MiB (1.36%); getTrackStateCellSample and
children 213.08 MiB (4.07%); cell creation including base geometry 39.82 MiB
(0.76%); selected tire-disturbance processing roots 423.68 MiB (8.09%). Other
allocation is 85.71%. These categories are deliberately narrow: they do not
claim to encompass every weather renderer or every TrackState bookkeeping
operation. Cumulative sampled allocation is not retained heap. Arithmetic
functions also appear in V8 allocation stacks; sampled bytes are not a census
of explicit JS object literals. Results: allocation-weather-attribution.json.

Source-confirmed objects and work:
- getRaceCarTuning unconditionally calls createBuiltInRaceCars even when the
  authored physical profile is present. It spreads tuning/transmission data,
  resolves body configuration, and maps gear ratios on each call. The sampled
  tuning subtree is ~224.7 MiB, of which ~48.5 MiB is the benchmark autodriver;
  the remaining callers include simulation, wear/damage, and scenery collision.
  A fallback-profile table belongs at load/module initialization. Resolved
  tuning requires invalidation on upgrades, tire/setup changes, transmission
  changes, and any dynamic modifications; do not freeze live damage modifiers.
- Surface lookup constructs world/projection records, segment wrappers, road
  deck records and tangent/right/normal vectors. Existing road profiles and
  spatial indices already cache static geometry. The missing opportunity is
  stable derived segment metadata plus caller-owned output storage; arbitrary
  moving coordinates must still be projected/interpolated accurately.
- cylinderPoseAt constructs hub/axis/fallback vectors for each feature. Static
  wheel probe angles/trigonometry can be prepared for a configuration; dynamic
  wheel pose can only be shared within the same step/fraction. Prior test found
  292 pose constructions for 8 distinct wheel/fraction pairs.
- getTrackStateCellSample creates current/baseline condition objects, a result
  and its visual object unless caller-owned target and scratch are supplied.
  Some physics consumers already use these parameters; sampleRaceAiWheelContacts
  calls createRaceWheelContactStateFromSamples without these storage arguments,
  so the reusable API is not used everywhere. Returned records retained by
  contacts must not be shared across cars/wheels or overwritten before use.
- Weather profile lookup builds map/join string keys, clones profile cells,
  and appends precipitation/evaporation/drainage totals. Mutation can clone a
  cell for an in-progress frozen checkpoint. These preserve live state and
  cannot simply be removed. Rain evolution itself mostly mutates numeric cell
  fields; it is not constructing an entire terrain mesh on each sample.

New isolated test: probe-cell-sample-allocation.mjs/.json. 100 varying-condition
cases pass deep equality between fresh-output and reusable-output APIs. Over
100,000 reads per trial, fresh output allocates an estimated 152.1-153.6 MiB,
reuse 33.6-34.3 MiB (~78% less). Six alternating timing trials per mode give
median ~105.4 ms fresh versus ~87.1 ms reused (~17% less). Water changes each
query, so the result is recomputed rather than cached stale. No production
patch. This excludes lookup, history integration, mutations and rendering;
no corresponding whole-game FPS gain is claimed.

Precomputation boundary:
- Save/load: road segment metadata, immutable material/drainage/exposure data,
  wheel/body local probe geometry, built-in fallback profiles.
- Race load/setup changes: resolved per-car configuration and scratch buffers,
  initial weather history for known profiles and nearby initial cells.
- Runtime: live water/snow/ice, disturbed patches, temperature, tire contact
  forces, arbitrary-coordinate projection, moving wheel poses. Reuse storage
  and revision-cache derived cell conditions, and prepare future baseline
  profiles in bounded slices. Existing fresh-cell profile sharing already does
  part of this. Do not generate every 1m cell on a mountain at load time.
- Exact future weather is not generically precomputable: debug/mission changes,
  tire displacement, compaction and spills alter it. Homogeneous untouched
  baseline profiles are shareable; locally disturbed cells retain individual
  state. Existing replay cache keys include live state, so replacing them with
  material-only keys would be incorrect.

Weather replay remains a candidate for bounded-work testing, but it is not the
major allocation producer in this workload. The fresh phone hitch still lacks
GC events/executed-replay-step attribution sufficient to identify its cause.


### Isolated fallback-profile precomputation experiment (2026-11-02)

Test-only Node module load hook tuning-profile-cache-loader.mjs replaces the
single getRaceCarTuning fallback construction with a module-initialized map of
built-in physical profiles. It does not cache merged tuning, change production
files, or alter weather. Source matching asserts exactly one replacement.
probe-tuning-profile-cache.mjs verifies 30 output-equality cases across saved
cars, altered power/gearing, missing profiles and both transmission choices.
5,000-call trials: original ~302-303 MiB sampled allocation, cached ~175-178 MiB
(~42% reduction). Median lookup-loop duration ~527 vs391 ms (~26% reduction).
This measures only this function, not overall performance.

Two serial 900-update saved-mountain tests (29 AI, storm, 53s initial weather,
seeded autodriver) match final track checksum 9c81dbc6, complete recorded AI
states and player route/lateral position exactly. Last600 updates baseline
median30.36 ms/P95 156.92/max198.42 versus cached26.93/P95 160.99/max382.17.
Only one run each; CPU core/frequency migration and scheduling are uncontrolled.
The baseline preparation briefly overlapped the finishing isolated probe;
the measured last600 updates did not. These results do not establish an11%
whole-game speedup, and show no tail-latency improvement. Observer GC total
1812 vs886 ms, but only40.7 vs30.0 ms overlaps timed update spans; most GC
occurred between yielded updates. Cannot attribute the long update stalls to
those GC totals. This pair indicates remaining stall sources beyond this
allocation reduction and calls for long-frame CPU-vs-wall attribution.
Artifacts: tuning-fallback-comparison.json, probe-tuning-profile-cache.json,
storm-autodrive-tuning-fallback-{baseline,cached}-cpu.json and corresponding logs.
No user-visible production changes or fidelity compromises.


### Long local stalls: CPU versus elapsed time control (2026-11-02)

profile-update-cpu-wall.mjs wraps only updatePlaytestSafely in a Node preload,
recording wall, main-thread CPU and whole-process CPU time. No production
changes. 900 updates, same 29AI/storm/mountain/53s initial history as the prior
pair. Final track checksum, recorded AI states and player driveState all
exactly match the baseline. Last600 updates: median wall23.81 ms, thread20.61;
35 updates exceed100 ms, median wall177.70 ms versus thread22.39 ms. Those35
sum6034.34 ms elapsed but892.50 ms threadCPU (~85% of time off-CPU).
Example frame837 wall204.36, thread21.48, whole process21.90 ms. These large
waits cannot be treated as200 ms of geometry/weather arithmetic. Coarse thread
accounting is adequate for this large distinction, not submillisecond scopes.

Confirmed running Node process /proc PID cgroup membership: cpu/background,
cpuset/moderate, blkio/low; allowed CPUs0-1,4-5. Exact cgroup quota files are
permission-denied. Thus background scheduling/throttling is a candidate, not a
proved specific kernel mechanism. Do not change system scheduling settings.

Independent control probe-background-scheduling.mjs does only a fixed integer
arithmetic loop, then setImmediate,150 iterations; no game code, weather, terrain
or rendering. Four >100ms pauses reproduced: elapsed163.15/174.03/180.93/185.21 ms
versus thread12.77/11.07/11.61/9.12 ms. This positively establishes similar long
local waits without any racing system. Arithmetic loop does not allocate JS
objects per iteration; the small measurement records are allocated outside it.

Implication: large local tail times in the fallback-profile A/B cannot establish
an equivalent game-code bottleneck. Allocation reductions remain measured, and
prior CPU-profiler GC samples remain real; neither justifies attributing all
elapsed spikes to GC. Phone captures have no threadCPU/scheduler evidence, so
this finding must not be generalized to the user's browser. Continue prioritizing
actual allocation/CPU hot paths and verify eventual changes with phone captures.
Artifacts: update-cpu-wall.json, update-cpu-wall-analysis.json,
storm-autodrive-cpu-wall-cpu.json, background-scheduling.json and test scripts.


### Wheel-pose reuse experiment (2026-11-02)

Test-only wheel-pose-cache-loader.mjs transforms WheelCylinderCollision in memory.
Each synchronous sweep gets a WeakMap keyed by cylinder identity, then a Map
keyed by exact fraction. Scope ends in finally; nested calls restore prior cache.
No rounding, skipped probes, cross-step reuse, or production edits. Standalone
pointForFeature calls remain uncached. Prototype uses maps for clarity; a
production implementation can use owned endpoint storage after profiling.

probe-wheel-pose-cache.mjs compares30 changing-pose/tread cases, then six
alternating trials of1000 sweeps. Prepared query frame forces active-cylinder
work but returns no intersections. Median main-thread CPU ~240.18 ms baseline
versus116.55 ms reused (~51% less). Cumulative sampled allocations480.1-480.6 MiB
versus179.2-180.7 MiB (~62.5% less). Wall timings vary greatly due to known local
scheduling waits; CPU-time batches are used here. This is an active collision
microbenchmark, not ordinary smooth-road or whole-race speedup.

Existing wheelCylinderCollision.test.js:13pass/1fail both baseline and prototype.
Same pre-existing WRX2 curb-impact5m/s failure reports identical vehicle position
and velocity. Additional RTG_TEST_POSE_PARITY=1 reruns each tested sweep with
cache disabled and deep-compares complete returned results, including curb,
sidewall, ramp, crest, and triangle-contact fixtures. No parity assertions fail;
the same original test still fails. Do not describe the whole suite as green.

Latest phone capture29d10... has active cylinder counters in1282/3751 active
player frames (~34.2%). This shows relevance beyond a never-used branch, but
not its percentage of CPU time: one frame can contain several steps, and there
is no dedicated cylinder-cost phase in that capture. The remaining adaptive
body-contact work is separate and not reduced by this experiment.
Artifacts: wheel-pose-cache-probe.json/.log, wheel-pose-{reference,cache}-tests.log,
wheel-pose-cache-parity-tests.log, test-only loader/probe scripts.


### Weather catch-up scaling and stale-cell preparation gap (2026-11-02)

probe-weather-catchup-scaling.mjs constructs32 asphalt cells, idle gaps of60,
300 and720 seconds at100ms steps, constant forcing or precipitation changing
each step, and three scenarios: never-seen, existing identical, existing with
unique water/compaction. Background maintenance is deliberately bypassed to
isolate cold encounters; this is not evidence that live cells normally become
12minutes stale. Counts measure applyWeatherToCell invocations, not all work.

At720seconds:
-32new cells:7200 evolution calls, shared first-touch profile (both forcing cases).
-32existing identical cells:7200 calls under constant forcing,230400 with
 changing forcing. Short segments integrate directly and bypass block caching.
-32existing differently disturbed cells:230400 calls in either forcing case.
With distinct cells the counts scale19200 ->96000 ->230400 for60/300/720s.
At720s measured threadCPU ~134ms constant/distinct and107ms changing/distinct
for the32-cell batch. Single timings include JIT effects; count scaling is
stronger evidence. Shared identical constant replay still costs~59ms despite
fewer evolution calls: reused blocks iterate their per-step precipitation,
evaporation and drainage totals to preserve floating-point addition order.
Sharing recurrence does not make all accounting O(1).

Verified source path and executable assertion:
prepareNewCellWeather returns {complete:true,steps:0} immediately for any existing
cell. An existing test cell atstep0 while currentstep7200 gets no preparation;
subsequent sample performs7200 weather updates synchronously. sample calls
catchUpCellWeather without maxSteps, whose default isInfinity. Background
maintenance's maxWeatherStepsPerStep does not bound this demand path.
Result artifact stale-weather-preparation-gap.json.

For all six distinct-cell duration/forcing combinations, repeated32-step
catch-up chunks produce exactly equal final cell values and aggregate totals
to one synchronous catch-up. This establishes exact chunkability for the
isolated weather recurrence, not arbitrary early mutation in a live race:
flow, tire events, checkpoint revisions and timing of totals still require
integration safeguards. Existing-cell speculative preparation should use a
shadow state and invalidate it on real cell mutations, or otherwise integrate
with the authoritative scheduling contract. Do not silently return stale grip.

This is a concrete scaling risk and advance-preparation coverage gap, not proof
that the24.55s phone replay spike was7200-step work. That phone frame's maximum
recorded backlog was180steps. Instrument actual executed work before mapping
this worst-case to observed pauses. No production change or weather-fidelity
reduction. Recommend existing-cell bounded preparation first; quantizing drainage
would alter results and is not yet justified by these tests.
Artifacts: weather-catchup-scaling.json/.log and probe script.


### Wind-only cache fragmentation: reproduced but not live caller (2026-11-02)

probe-weather-wind-fragmentation.mjs keeps all water/temperature forcing equal,
varying only wind direction at each100ms step.32identical stale asphalt cells,
7200steps: constant direction creates1segment,7200evolution calls and223200
reused steps; changing direction creates7200segments,230400evolution calls,
zero reuse. Final cells and aggregate totals deep-equal. TrackState weather
recurrence does not read windDirectionRad, but weatherForcingEqual compares it.
A separate recurrence-specific timeline could avoid this without discarding
recorded wind history. HOWEVER current RaceSimulation forcing creation passes
weatherState/race/target but no windDirectionRad, so it defaults to0. This lead
is not a demonstrated cause of the current phone or Node race workload. Do not
prioritize it as the explanation for observed cache misses. Result artifact
weather-wind-fragmentation.json. No production modifications.


### Live 30-second weather demand counts (2026-11-02)

profile-weather-demand.mjs runs1800seeded mountain updates,29AI,storm with53s
initial history. Counts applyWeatherToCell and catchUpCellWeather, labeling the
immediate TrackState operation; no per-call timing. Last1500updates:
- sample:230458catch-up checks,258285requested steps,258147executed,max71backlog.
- tire events:262503checks,182150requested,182118executed,max74backlog.
- maintenance step:16000checks,250159requested,249719executed,max82backlog.
All-weather executed/frame median182,P952693,P993088,max3285. Worst frame671:
282steps from sample demand,955from tire events,2048from maintenance;1573checks.
The max2048 maintenance budget is per track-state tick, not per render frame.

This ordinary short run does NOT reproduce minutes-stale cells. The prior
12minute synthetic test establishes a risk, not the usual workload. The live
spikes in step counts are accumulated small updates plus periodic maintenance,
not a single giant demand replay. Most requested steps actually execute here;
cache reuse alone will not eliminate changes specific to disturbed cells.
No CPU/FPS claim from these counts. The independent wind-only cache pathology
is ruled out for the current forcing caller. Next prioritization should favor
known allocation duplication and measured player/AI collision work over assuming
weather is the primary cause; bounded stale-cell preparation remains a resilience
improvement, not an established fix for the phone's27.5ms replay interval.
Artifacts: weather-demand-runtime.json, weather-demand-runtime-analysis.json,
storm-autodrive-weather-demand-cpu.json, test-only preload and analysis script.


### AI contact scratch ownership experiment (2026-11-02)

ai-condition-scratch-loader.mjs adds test-only per-AI, per-wheel condition
scratch to createRaceWheelContactStateFromSamples. No target/output reuse:
contact.trackState retains returned samples, so blindly reusing them would
mutate previously returned contacts. Scratch holds internal current/baseline
calculation records and cell-lookup metadata only. No production changes.

Four existing raceAiRoadContacts tests pass. probe-ai-condition-scratch.mjs
uses real RaceSurfaceModel/baked two-triangle plane and TrackState.60moving,
changing-water comparisons deep-equal baseline; previously returned friction
and visual values stay unchanged and successive trackState outputs are distinct.
3000 four-wheel queries/trial, six alternating timing trials: median threadCPU
91.07ms baseline versus88.87ms reused (~2.4%, too small/noisy to establish a
meaningful CPU improvement). Sampled allocations89.74/102.82MiB baseline versus
82.73/82.76MiB reused (~8-20% across samples). Do not generalize the earlier78%
isolated fully-reused sample allocation gain to this ownership-preserving full
contact path. Geometry/contact construction remains dominant in this fixture.
Prioritize wheel-pose reuse above this smaller candidate; stronger output reuse
requires auditing consumers' record lifetimes rather than silently changing the
public contract. Artifacts: ai-condition-scratch-probe.json/.log,
ai-condition-scratch-tests.log and test-only loader/probe.


### Contact ownership audit: two simultaneously live samples (2026-11-02)

RaceAiDistantPhysics.advanceRaceAiDistantPhysics keeps contactState.contacts from
its current position while querying contacts for the proposed position. It then
compares both average heights and reads old normals to reject unsupported steps.
One shared output perAI would overwrite the old values and could defeat those
terrain-step checks. Cheap recovery can query up to3candidate placements and
retains the successful contacts on ai.distantContactState. Any stronger contact
pool needs explicit query roles/lifetimes and separate start/end/recovery slots;
blindly pooling a single record is a correctness regression. The scratch-only
experiment avoided this issue. No production changes.


### Full mountain wheel-pose prototype: parity, no demonstrated speedup (2026-11-02)

900update29AI/storm/mountain run with wheel-pose-cache-loader plus the same
threadCPU/wall wrapper as earlier baseline. Final AI states, player driveState
and track checksum exactly match. Last600updates median threadCPU27.72ms versus
earlier baseline20.61ms; P9544.87vs37.79ms; totals18271vs13053ms. Wallmedian29.63
vs23.81ms. This is a noncontemporaneous pair with uncontrolled clock/core
placement; it cannot establish either a real regression or improvement. Crucially
it does NOT validate the isolated51%gain as a whole-race speedup. Prototype Map/
WeakMap overhead on fast paths also needs separating from CPU-frequency drift.
No production promotion. Next useful experiment is paired same-process replay
of actual sweep arguments or separately measured smooth/active branches, with
output parity and allocation counts. Artifacts wheel-pose-runtime-comparison.json,
update-cpu-wall-wheel-pose.json, update-cpu-wall-baseline.json,
storm-autodrive-wheel-pose-cached-cpu.json and runtime log.


### Same-process smooth versus active wheel-cache branches (2026-11-02)

probe-wheel-pose-branches.mjs alternates six CPU-timed trials per implementation
and branch, then samples cumulative allocation. Synthetic prepared query frame,
no triangle hits; unchanged returned results asserted. Measurements:
- Smooth classification tag,50000calls: baseline0.478us/query,prototype1.765us;
  allocation31.16vs37.77MiB.
- Smooth bounds classification,50000calls:0.915vs2.302us/query;
  allocation38.28vs44.31MiB.
- Active cylinders,2000calls:228.60vs125.57us/query;
  allocation876.56vs376.06MiB.
Thus prototype cache wrapper costs~1.3us per smooth query while saving~103us per
active query in this fixture. It is a real fast-path overhead, but not enough
at the ordinary physics-step count to explain the separate full-run~7ms CPU
median difference. CPU-placement/frequency variation remains unresolved.
Production design should avoid creating cache storage until a pose is needed,
or after an authoritative smooth-path rejection, preserving existing behavior.
No whole-game speedup proven; no production changes.

Asked user whether to move from prior diagnostic-only instruction to applying
the two tested exact-result candidates (wheel-pose reuse and built-in fallback
profile preparation), followed by phone validation. Await explicit answer before
production work. Existing full-run parity and baseline test failure documented
above. Artifacts wheel-pose-branch-comparison.json/.log and probe script.


### Lazy wheel-pose cache preparation while approval pending (2026-11-02)

Test-only lazy variant allocates its WeakMap only upon the first pose request,
using a sentinel for an active cache scope. Smooth tagged/bounds fixtures now
allocate~30.86/35.11MiB versus baseline31.04/37.26MiB over50000queries; there is
no added cache storage on the smooth early-return path. Wrapper CPU overhead
remains:2.06/2.58us vs0.48/0.95us perquery. Active branch127.23vs242.23us and
374.79vs893.15MiB per2000queries. Different JIT/source-loading conditions remain
limitations; no whole-race gain asserted. Lazy parity unit run still13pass/1same
baseline curb failure, no cache-vs-reference result assertion failures.
Artifacts wheel-pose-lazy-branch-comparison.json, wheel-pose-lazy-parity-tests.log,
probe-wheel-pose-lazy-branches.mjs and wheel-pose-lazy-cache-loader.mjs.
Production implementation remains pending user decision on the existing
investigation-only constraint. No additional permission question sent.

### November 2, 03:22 UTC: phone rollover/reset diagnosis

Capture `a483a974c82d750827bed6366fd1ae09c2094c8d7c9368734a362b658173142d`
(after active-sweep wheel-pose reuse) does not establish a whole-game gain:
driving median/P95/P99 intervals were 15.4/25.2/32.8 ms, versus
14.6/22.5/29.1 in the preceding capture. Driving paths and collision workloads differ.

At 16.771–17.312 seconds there were six reset attempts. The first five failed
static support convergence; reset inclusive times were 63.6, 97.8, 95.8, 71.7,
77.9 ms, followed by a successful 8.8 ms attempt. No verified road-history pose
was selected. Source inspection shows a fallback attempt can solve the initial
candidate plus one alternative, each up to 64 iterations, synchronously. Limiting
candidate count therefore does not bound frame time. The previous capture had no
player reset calls, so its maximum frame time is not an equivalent recovery test.

At 49.637 seconds AI[5] spent about 58 ms in tire/body calls; the recording does
not establish whether CPU work or a runtime pause explains that outlier. The final
five seconds averaged 8,291 player prepared-triangle visits/frame and 540 static
collider narrowphase tests/frame, compared with 5,781 and zero previously.
Weather replay peaked at 0.6 ms in this capture, unlike the prior 27.5 ms outlier.

New capture diagnostics distinguish recording rejection (orientation, support,
road region, height, geometry, projection) from selection rejection (lap,
spacing, AI proximity). They retain compact failed static-support iteration and
residual summaries. The simulation's qualification checks, candidate order, and
solver behavior are unchanged. Counters update in place; snapshots allocate only
when the recorder requests diagnostics. These observations are required before
claiming that missing history is specifically a traffic-exclusion problem.

### Incremental reset solver experiment

`artifacts/mountain-stress/probe-incremental-reset.mjs` transforms a private copy
of the existing static support solver into a generator; production behavior is
unchanged. Yield boundaries precede each iteration and the final contact rebuild.
Nine real tire-subsystem fixtures cover flat ground, grade, bank, combined slope,
higher initial placement, saved-pose validation/settling, invalid terrain, and a
throwing tire subsystem. Complete returned state, residuals, result and trace match
the synchronous solver exactly. Authoritative input state remains unchanged after
every slice. Each slice invokes the tire subsystem at most once. Results are in
`artifacts/mountain-stress/incremental-reset-parity.json`.

This establishes an iteration boundary, not an absolute millisecond bound: one
iteration can still stall. It does not validate asynchronous environment lifetimes,
interleaving shared tire scratch buffers with ordinary racing, cancellation on race
exit, or final placement against moving traffic. Integration must address these
before shipping. A synchronous wrapper could retain existing loading/worker APIs.
The user has been asked about the visible tradeoff: a longer reset fade versus
avoiding many settling iterations in one render frame. No production scheduling
change has been applied pending that answer.

### AI spike drill-down, same 22:17 phone capture

Reproducible extraction: `artifacts/mountain-stress/analyze-ai-spike.py`, output
`phone-2217-ai-spike.json`. AI index 5 at 49.637 seconds spent 35.0 ms in
`tireFootprintAndKinematics` for eight calls, versus 0.3 ms/eight calls immediately
before and 0.1 ms/eight calls immediately after. Wheel-cylinder features remained
264 in all three frames. Body support did increase (227 -> 1,384 -> 2,568), but
the following frame performed more support work without the same stall. The next
largest AI tire-setup observation anywhere in the capture was 4.3 ms.

The timed tire-setup region resolves existing footprint samples and wheel
kinematics; terrain refinement is separately timed as `iterativeTireContactSolving`
and took only 0.2 ms on the spike. This does not justify approximating weather or
reducing terrain sampling to fix this particular 35 ms observation. A runtime
pause remains plausible, not proven. All 118 heap samples reported the same used
heap value; this browser memory feed cannot corroborate GC or allocation changes.
The independently expensive 22 ms body call remains incompletely attributed.

### Recovery interleaving and missing exported collision timings

`probe-incremental-reset-interleaved.mjs` additionally runs unrelated full support
solves through the *same* tire subsystem and body-collision instance between every
slice. Four cases (grade, bank, both, invalid terrain) preserve complete output and
trace parity, and cancellation leaves authoritative state unchanged and does not
poison subsequent synchronous solves. This is stronger scratch-ownership evidence,
not a substitute for validating live moving traffic/environment generations.

Found and corrected an exporter omission: the player and AI physics timer filters
matched tire/body/terrain names but excluded `wheelCylinder*` and `staticCollider*`.
Those timers existed in accounting but were discarded from the uploaded report.
Both filters now retain them. A regression test checks all six relevant timers for
both player and AI, including detached snapshots. All 13 capture tests pass.
No new timing calls are introduced; this retains already-collected measurements.
The old uploaded capture cannot recover the missing timing entries retroactively.

### Live mountain recovery-history probe

`probe-live-recovery-history.mjs` runs the existing 29-AI mountain benchmark for
360 updates and explicitly calls the editor recovery-history update after each
simulation update. The ordinary benchmark omits this editor-level call; the first
probe without it returned null history and was not informative. The corrected
probe produced 23 accepted/stored poses with no recording rejections. Selection
excluded 19 for AI proximity and two for redundant spacing, returning two usable
poses. Player distance reached 62.443 m. Output:
`storm-autodrive-recovery-history-cpu.json`.

This rules out an always-broken recorder on the loaded mountain/startup fixture,
not on every route/vehicle state. It demonstrates that the eight-metre AI proximity
filter eliminates most valid saved placements while racing near the pack. The
phone's early 180-degree turn is different from this centerline autodriver, so
traffic exclusion remains a hypothesis for its empty selection until a refreshed
capture contains the new rejection counters. Do not remove traffic protection on
this evidence alone. This probe is about validity/counts, not browser FPS.

### Approved incremental player reset integration (November 2, 04:12 UTC)

Following user approval to prioritize smooth reset frames, the static support
solver and authoritative-reset transaction now expose incremental generators.
Existing synchronous methods drain those generators, preserving loading, replay,
AI and worker call contracts. The editor's staged player reset retains one job and
advances at most two slices per frame, ending sooner after approximately 2 ms.
Each support slice executes at most one tire solve. This is a cooperative bound,
not a hard real-time guarantee: a single expensive operation/runtime pause can
still exceed 2 ms.

While a job is pending, the reset fade remains black and the inline race simulation
returns before advancing its clock, player, AI or weather. This prevents changing
vehicle conditions/environment between support iterations and avoids charging race
time for the incremental wait. Normal pause handling still takes precedence.
Successful completion installs the candidate atomically; failures retain the
existing bounded candidate retry behavior and road/upright checks. Race exit
closes the suspended job. Worker-side resets keep their synchronous backend;
the browser continues to wait for the existing upright acknowledgement.

Regression coverage includes complete synchronous/incremental reset result parity,
authoritative state unchanged between slices, one tire solve maximum per slice,
cancellation, editor step budgeting/job reuse, simulation clock hold, and exit
cleanup. The capture reports whether incremental recovery is in progress. Actual
phone hitch reduction remains to be validated with a refreshed recording.

Validation outcome: integration suite 46/47 passed; the remaining WRX2 zero-steer
braking symmetry failure (`-16.348316 + 22.342255 N`) reproduces exactly with the
pre-incremental synchronous implementation restored through the test-only loader
`pre-incremental-reset-loader.mjs`. Separate clock/cancellation suite: 17/17 pass.

### 23:12 phone upload (9552bef…)

Started 04:11:27 UTC; recovery reports lack the new `incremental` field and include
the synchronous reset scope, so it does not validate incremental reset scheduling.
The one recorded reset at 43.157 s used verified history and succeeded first try
in 12.4 ms; eight candidates survived selection, only two excluded by traffic.
Driving median/P95/P99: 18.9/36.4/45.4 ms. At 52.912 s the interval was 384.3 ms
(instrumented elapsed CPU scopes 374.6 ms), with 52 body sweep slices, 6,357 body
support features and 7,612 prepared triangle visits. Previous frame: 52 slices,
6,988 support features; much lower elapsed cost. Penetration validation jumped
from 3.2 ms/57 calls to 108.3 ms/58 calls. Multiple normally small unrelated stages
also inflated by ~5–10 ms in that frame. At 22.457 s another 271.1 ms interval
occurred with no player body/wheel CCD activations, only 349 player triangle
visits, and raw terrain lookup taking 109 ms. These are not explained solely by
query counts.

Sustained final-ten-second costs: player terrain collision 3.62 ms/frame, wheel
triangle sweeps 0.56 ms/frame; detailed AI 6.24 ms/frame and lightweight AI 3.41.
The player collision phase nests support/penetration timers; do not add those
again. Collision is a substantial target but not the sole cost.

A local CPU-intensive symmetry test overlapped this upload's recording period.
Asked whether the browser and Termux server run on the same physical device;
if so, CPU contention invalidates treating these extreme elapsed stalls as a
clean game-only comparison. Tests are finished; no stress jobs remain running.

### November 2, 06:05–06:08 local phone recordings

Reviewed captures 153afad5…, 1012439a…, 75e90c8c… in chronological order.
Artifacts: `three-nov2-summary.json/.txt` and reproducer `analyze-three-nov2.py`.
These are consecutive portions of one mountain race (race clock about 0–58,
67–125, 129–188 seconds), all with 29 AI and 100% storm. No concurrent heavy tests
were launched during this analysis; the recordings were made hours after the
previous test processes finished.

Driving frame interval median/P95/P99, excluding pending resets:
11.1/17.7/21.7 ms; 14.9/24.8/31.7 ms; 16.6/28.1/33.8 ms.
Including resets, capture 2 maximum is 1,069.2 ms; captures 1/3 maxima 67.2/234.2.
Capture 2 at 3.821 s attributes 1,037.4 ms to drawRaceCarBillboardLayers, drawing
one player car (64,512 uploaded pixels) while incremental recovery is pending.
Recovery update itself takes 2.8 ms there; subsequent pending solver updates
2.8/2.2/2.0/1.9 ms. First reset succeeds with verified pose; second rejects two
saved candidates for four-road-wheel support, succeeds on third. Incremental
settling works, but expensive hidden drawing remains during the black hold.
Do not attribute the 1-second drawing span to polygon counts or GC without more
evidence inside the drawing call. Avoiding hidden rendering is an actionable next
step, along with preventing provisional reset session placement from reaching
rendering before installation.

Mean player terrain-collision phase: .14/.55/.33 ms per driving frame. Player
wheel-cylinder triangle sweep .017/.058/.022 ms; total detailed AI wheel sweeps
.020/.030/.034 ms. These timings do not support wheel collision as the dominant
average cost. Rendering averages 5.11/6.12/6.81 ms; all AI 2.72/4.15/4.91 ms;
player physics 1.38/2.91/3.25 ms. Timings nest; do not sum parent and child phases.
Isolated spikes still occur in collision, drawing, AI integration and track lookup.
Run 3 at 9.303 s: 234.2 ms interval, with sampleTrack 60.6 ms self. Tire-contact
queueing spikes ~38 ms at 56.724 s in run 2 and 43.222 s in run 3. Those methods
need workload/runtime-pause discrimination; not evidence to coarsen drainage yet.

Tracked cells increase to 10,518, then 18,169, then 25,924; event history is bounded
but variable (ending 5,842/7,909/14,541). Growing persistent state/maintenance is a
candidate for the later-run cost increase, not proven causation given changing
location, crashes and visibility. Heap API again reports identical values across
samples, so cannot establish GC. Car-art cache estimate does not grow across the
three endings (~4.08/4.15/3.88 million pixels).

### Opaque reset hold rendering fix (11:22 UTC)

The fully opaque interval (620–870 ms remaining, matching the existing fade alpha)
now draws only the black viewport, pause overlay when needed, and display filter.
It bypasses hidden world/car/weather/HUD drawing, including provisional reset
placement, and clears stale scene submission counters for that frame. Partially
visible fade-out/fade-in continue through the unchanged rendering path. Three
focused tests pass, covering both camera modes, overlay ordering, viewport bounds,
exact opaque boundaries, visible fade paths and stale stats. No heavy benchmark
was run on the user's phone. This avoids the observed hidden draw call; it does
not prove the source of its one-second duration or guarantee visible drawing cannot
stall. Browser validation of reset presentation remains outstanding.

### Ground-state attribution follow-up

`three-nov2-track-costs.json` separates recorded phase costs, excluding resets.
Checkpoint means .064/.209/.371 ms/frame; trackState means .396/.942/1.385.
Calls/frame grow .57/1.16/1.83 and 1.40/1.90/2.11 respectively, so part of the
per-frame increase is more fixed steps per slower frame, not solely more cells.
Shared-weather replay means .031/.145/.268 ms, maxima .7/3.9/4.8 ms. These nested
phases must not be added indiscriminately.

The ~38 ms queueAccumulatedTireContact spikes call a fixed event normalizer plus
Set membership/insertion and Array.push; they do not scan cells or run weather
integration. Collection resize/rehash or runtime pauses remain hypotheses. Nearby
sampled history counts are 7,862 -> 9,035 in run 2 and 10,630 -> 11,545 in run 3;
that does not establish a shared threshold or prove rehashing. Checkpoint commit
already rebuilds eventIds from retained/pending events, preventing indefinite
retention of all historical event IDs. No drainage approximation is justified by
these observations. A useful next diagnostic would distinguish normalization,
duplicate lookup, Set insertion and pending-array append only on selected calls,
without adding broad per-wheel timer overhead.

### Detailed event-queue probe (11:27 UTC)

Added optional `TrackEventQueueProbe`: detailed captures attach it to TrackState,
restore the previous property at stop, and export aggregate timings plus at most
48 >=4 ms stage samples. Stages: normalization, duplicate/sequence lookup,
Set insertion, pending-array insertion. Slow samples retain event-ID count,
pending/history length and ground-cell count. Probe bookkeeping is excluded from
the following insertion stage via a fresh timestamp. Snapshots are made at report
export, not each wheel/frame. Ordinary play never enables clocks for this probe;
its simulation path only checks an absent property. No scheduling/physics results
change. Sixteen focused capture/probe tests passed; event semantics and duplicate
rejection match with/without probing, samples are bounded, exported data detached,
and capture cleanup restores prior configuration. This provides attribution, not
proof that any particular pause is GC. Small detailed-recording timing overhead
remains; no heavy phone benchmark was run.


### 2026-11-02 11:45 UTC — two follow-up phone captures

Offline analysis only; no concurrent simulation benchmarks. Captures `42a67b39` (11:38:41 UTC) and `cd9ad735` (11:39:46 UTC) contain the new event-queue probe. Reproduction: `artifacts/mountain-stress/analyze-two-new-nov2.py`; summary and selected neighboring-frame details saved alongside it.

Driving frame intervals (excluding pending recovery): median 13.3 / 15.5 ms; P95 20.2 / 22.4 ms; P99 25.4 / 27.6 ms; maximum 82.0 / 84.9 ms. These are recorder loop intervals, not measured presented FPS. Different driving prevents a controlled speedup claim.

Second capture has three recovery operations. Incremental frames cost 4.8–8.6 ms interval, with draw 0–0.1 ms; each completed on its first reset attempt. Hidden-rendering stall did not recur. First capture has no reset.

Event queue: roughly 174k normalization calls across both captures; no recorded stage >=4 ms. Normalize maximum 3.2 ms, lookup maximum 0.2 ms, ID insertion maximum 0.4 ms, queue insertion maximum 0.1 ms. Thus no evidence of event Set/array insertion stalls in this batch; this does not rule out earlier intermittent pauses.

Remaining spikes: first capture at 32.973s has AI9 tireSuspensionSetup 31.6 ms over eight calls; at 56.164s AI3 same stage 27.3 ms over eight calls. Second at 31.044s AI contact-state self time 42.5 ms; at 59.882s player prepareAdaptiveSupportCandidates self time 47.9 ms over three calls. Last event is genuine heavy collision context (48 body sweep slices, 4589 support features, 6894 prepared-triangle visits), but previous frame has 57 slices/9568 features/6807 visits and only 22.9 ms interval. This is not proportional to geometry volume. Timed scopes are elapsed time, not thread CPU; GC/OS interruption remains unproven.

Mean driving draw 6.26/6.75 ms; AI 3.25/3.92 ms; player physics 1.60/2.66 ms. Player wheel triangle sweeps average 0.020/0.069 ms; chassis terrain collision 0.14/0.64 ms. Next investigation should isolate suspension setup/contact-state work and adaptive-support collection, including allocation and runtime interruption, rather than reduce triangle accuracy or weather precision without evidence. No gameplay changes made for this analysis.


### 2026-11-02 — suspension definition reuse

Following the 27–32 ms tireSuspensionSetup scopes, source inspection found solveSuspensionGeometry normalizing/freezing a fresh definition and axis for every wheel on every step, even though vehicle config already owns normalized immutable definitions. Added weakly held reuse only for definitions created by normalizeSuspensionDefinition. Arbitrary caller objects remain uncached so editor mutations still work. The cached value is the historical second normalization, rather than bypassing it, preserving exact numerical axis behavior. Cache lifetime follows config lifetime; dynamic compression, steering and spring calculations remain live.

After warm-up this eliminates two explicit object constructions/freezes per wheel call (the definition and axis). No wall-time speedup or spike elimination is claimed. 40 targeted tests passed in 5.45 seconds, including 500 exact output comparisons against uncached caller copies, mutable-input regression coverage, tire model and suspension dynamics. Log: artifacts/mountain-stress/suspension-definition-reuse-tests.log. No long benchmark was run.


### 2026-11-02 — narrow suspension spike attribution

Chassis source audit confirms support buffers and prepared sweep candidates are already reused. Adaptive terrain sampling still creates normalized sample objects, but no new evidence ties those allocations to the 47.9 ms pause; no collision-accuracy changes applied. Added four nested detailed-only tireSuspensionSetup stages: InitialContact, Dynamics, Geometry, Kinematics (all prefixed tireSuspension). They distinguish validity checks, spring/damper integration, definition/geometry conversion, and final contact pose calculation. Existing pooled accounting tokens are used; ordinary gameplay has no new timing calls. Parent inclusive timing is unchanged in meaning; its exclusive timing now excludes these children. These must not be summed with parent inclusive timing.

46 targeted tests passed (tire model, physics accounting, capture export) in 1.76 seconds. Instrumented and uninstrumented tire outputs are exactly equal, all four children occur once per wheel, and scopes close. Log artifacts/mountain-stress/suspension-stage-tests.log. Next refreshed phone recording should test immutable suspension reuse and localize any remaining suspension spike. No heavy simulations running.


### 2026-11-02 — recorder overhead audit

No newer captures than 42a67b39/cd9ad735 as of this audit. Recorder setup mean 0.151/0.158 ms, P95 0.3 ms, maxima 5.7/6.2 ms; finalization mean 0.095/0.129 ms, P95 0.2 ms, maxima 3.5/3.3 ms. These explicit costs do not explain the 30–48 ms contact-scope spikes, but exclude per-call instrumentation overhead and possible downstream allocation effects. Heap reports are unchanged at 588 MB used in both captures and cannot establish GC events.

Removed repeated wrapper-factory/default-options allocation by checking missing/already instrumented methods before building a hook factory. New runner/renderer instances remain discoverable on repeated attach. No timings dropped, no changes to ordinary (nonrecording) gameplay. All 15 capture tests passed, including repeated attach, new target discovery, exact phase timing, cleanup and restoration (1.68 seconds). Log artifacts/mountain-stress/recorder-wrap-reuse-tests.log. This is measurement-hygiene work, not evidence that the game stutter is solved.


### 2026-11-02 — recovered upload c7e7edd8

Capture started 12:52:37 UTC, uploaded 13:06:38 UTC after server limit increase. Stored report 103,587,362 bytes (98.8 MiB), exceeding the previous 96 MiB bound. Detailed suspension child timers present. 29 AI (3 detailed), full storm. No pending reset observed.

Active frames: median 11.5 ms, P95 18.6, P99 22.8, max94.7; 6 intervals >33.33 ms, 2 >50, 11% >16.67. Previous two captures P95 20.2/22.4, >33ms counts14/12. Different driving and no resets mean this is observational improvement, not a controlled causal claim. Mean draw5.08ms, AI2.92, player1.52. Event enqueue stages all <4ms.

AI suspension setup max4.1ms vs prior27.3/31.6; player max2.9. No large suspension setup spike recurred. Remaining worst at46.452s: AI5 iterativeTireContactSolving37.6ms (8 calls, 2 steps), followed by raw terrain sampling20.8ms. Neighbor before: same8 calls/2steps/76pointqueries,168prepared triangle visits, timer rounds0ms; spike:76queries/166visits; after:76queries/153visits,timer rounds0ms. Not a contact-iteration count explosion. Loop source bounded at1or3iterations per wheel. Another hitch43.892s: lightweight AI14self37ms, total53.2ms interval. This spread across unrelated scopes remains consistent with runtime interruptions but does not prove GC. Need avoid treating elapsed scope time as threadCPU. No simulation changes made during this report review; no heavy benchmark.

Summary: artifacts/mountain-stress/latest-nov2-summary.json and .txt; reproducible with analyze-latest-nov2.py (selects latest upload).


### 2026-11-02 — direct ten-minute natural GC investigation

User explicitly requested GC-focused long simulation. Completed 36,000 updates, exactly 600 simulated seconds, 798.6 seconds wall time, latest saved Mount Washington, full storm, 29 opponents with production tiering (3 detailed/26 cheap). Autodriver progressed ~4.93 km. Node headless: no browser, renderer, audio or phone recorder. No forced GC, allocation sampling or CPU sampling during primary run. Natural perf_hooks GC events and per-update main-thread/process CPU measured. CPU frequency/placement varied during run; cannot equate these figures with Chrome FPS. This supersedes assumptions based on constant/coarsened browser heap readings.

After excluding first five startup updates: 7089 minor GC events (median4.31ms, P95 7.21ms, max211.61ms);149major (median26.70ms,P95 600.03ms,max1159.35ms);150incremental. Reported GC elapsed durations total57.02s. Durations include possible scheduling delays; they are not proof of equivalent CPU work. GC often occurred between updates, so analyze start-to-next-start loop intervals, not just update scopes. Of1052intervals>50ms,70had GC occupying more than half; of680>100ms,65had GC occupying more than half. GC is a verified local contributor, not the sole cause.

Examples: frame22202 update32.61ms,full interval1193.92ms,GC overlap1160.61ms;frame21180 update15.49ms,interval1138.12ms,GC1115.73ms. Worst frame35854 update1480.25ms,threadCPU18.98ms,noGC overlap: substantial non-GC runtime/scheduling interruption also exists. Other slow frames had hundreds of ms threadCPU but much longer elapsed time. Main-thread CPU cannot account for background GC worker CPU. This is not a blanket GC explanation.

Separate post-run allocation sample (frames301–1200,15simulatedseconds,131072-byte sampling interval,includes collected objects) estimates4864MiB cumulative allocation, not retained heap. Top self allocation sites: routeprojection239MiB,decksampling163MiB,trackstatesample130MiB,defaultcarconstruction94MiB,wheelkinematics93MiB,contactstate93MiB. Nested inclusive AI driver total2966MiB (~61% of sampled total); do not add nested inclusives. Sampling run overlapped offline result analysis briefly; its timings must not be used as a performance benchmark. Primary run had no concurrent test/analysis load.

Artifacts: gc-ten-minute-run.mjs; storm-autodrive-gc-ten-minute-cpu.json; gc-ten-minute-analysis.json/.txt; analyze-gc-ten-minute.py; gc-ten-minute-source-hashes.json; gc-current-allocations.heapprofile; gc-current-allocations-summary.txt. One initial analysis process used a quadratic overlap scan and was terminated, then replaced by ordered linear scanning; primary simulation had already finished. Both simulation and allocation jobs completed. No production gameplay changes in this investigation. Next work: reduce repeated shared configuration/route/sample allocations with ownership tests; separately investigate off-CPU stalls. Verify browser benefit with phone captures rather than claim Node GC timing proves Chrome cause.


### 2026-11-02 — eliminate full document construction in runtime profile lookup

Applied getBuiltInRacePhysicalProfile in raceData and used it in getRaceCarTuning. Previous fallback constructed all three editable default-car documents each call, even when an authored profile already existed. Direct lookup reads the same canonical tuning profile references and returns null for noncanonical IDs. It does not cache resolved per-car tuning, so live edits and upgrades remain live. Direct reads also preserve changes to exported default tuning profile references; no shared ownership semantics changed.

Six tests passed in3.25s, including exact full tuning-output parity against the prior implementation loaded through a test-only module hook, authored tuning/root profile precedence, manual/automatic transmissions, unknown identities and WRX physical config integration. Separate short paired allocation sample (2,000 calls each,baseline/direct/direct/baseline) estimated96.81/94.47MBbaseline versus41.33/42.28MBdirect:56.3% lower cumulative allocation in this isolated resolver. Sampling also affects timings; recorded threadCPU145.5/177.1msbaseline versus83.1/94.8msdirect is not a whole-game speedup claim. Artifacts: built-in-profile-lookup-tests.log,profile-lookup-allocation-comparison.json,measure-profile-lookup.mjs. No long simulation run after this change yet.


### 2026-11-02 — route projection query allocation

Non-network route projection now uses nested numeric bucket maps instead of per-query formatted coordinate strings, and an ordered two-pass candidate loop instead of allocating a closure per query. Same candidate order, arithmetic, exact off-road nearest-index fallback and fresh return-object ownership. Samples-identity invalidation preserved. No approximations, persistent per-car result cache, or physics changes.

Four tests passed in0.386s: exact frozen-reference parity over2000near/far/hairpin/degenerate points; fallback exhaustive equivalence; ties/emptyroutes; retained output independence and replaced-sample invalidation. Additional1000point exact comparison against immediately previous method passed in isolated allocation probe. Initial short sample was noisy, so repeated after longer warmup. Three paired20000querysamples: before35.89/42.46/40.16MB,after15.39/10.82/10.60MB,~69%meanreduction in this isolated projection call. Not a whole-game allocation/FPS result. Saved baseline/artifacts: route-projection-before-reuse.mjs,measure-route-projection-reuse.mjs,route-projection-reuse-allocation.json,route-projection-reuse-tests.log. Whole-game validation of this and direct profile lookup remains outstanding.


### 2026-11-02 — paired whole-simulation allocation validation

Ran sequential1200update Mount Washington headless trials,29AI/fullstorm/autodrive,same saved track andseed. Sampled frames301–1200 (15simulatedseconds) with131072-byte allocation sampling including collected objects. Baseline uses a test-only loader restoring the pre-fix tuning fallback and route projection; updated trial uses production source. No renderer or browser. Baseline4881.67MiB cumulative sampled allocation;updated4536.73MiB:7.07%reduction across the headless simulation. These are estimated cumulative allocated bytes, not retainedheap. One paired trial, not a statistical performance claim.

Exact equality confirmed for final track checksum,player driveState,all29AI states,per-car contact/physics-call counts,1200frames and admitted20s/frameclock. Thus reduction did not come from fewer simulated steps or opponents. Larger isolated percentage improvements must not be presented as whole-game speedups. Phone CPU frequency and allocation sampling overhead make wall timing unsuitable for FPS comparison. Both runs completed; no background tests remain.

Artifacts: pre-gc-allocation-fixes-loader.mjs;gc-paired-before/after.heapprofile;storm-autodrive-gc-paired-before/after-cpu.json;gc-paired-allocation-comparison.json. Remaining top self allocation sites afterfix:decksampling165.56MiB,trackcell sampling128.90MiB,wheelcontact construction99.65MiB,stringjoin98.17MiB,wheelkinematics89.26MiB. Further ownership-safe allocation work warranted; GC pauses not yet shown reduced in Chrome.


### 2026-11-02 — same-query off-road surface fallback reuse

Source audit found samplePhysicsGeometry performs route projection and deck sampling before classifying a point, then calls sampleWorld for transition/terrain regions, which repeated both operations for the same synchronous query. Pass the already-computed projection/deck through an optional internal argument. Preserve explicit context.deckSample and network-deck precedence; no result retained across calls and no weather/geometry time approximation.

12targeted tests passed in0.40s (corridor reuse,layered surfaces,canonical mesh). New test compares exact output against a model that discards the prepared argument to restore the previous fallback, over both sides/multiple distances, validates one projection/one deck sample per off-road query, live width/elevation edits, retained output independence and explicit deckoverride. Whole-game allocation and browser-pacing benefit of this incremental change remain unmeasured. Log same-query-surface-reuse-tests.log.

### 2026-11-02 — weather sample intermediate ownership

TrackState.sample now reuses per-instance current/baseline condition calculation objects when the caller does not supply scratch. These are intermediate scalar calculations, not returned samples or shared lookup memoization. Every ordinary sample and visual object remains independently owned; explicit caller scratch/target behavior remains unchanged. consumeVisualDelta similarly reuses a private temporary sample/condition scratch, copying all scalar visual fields into each emitted entry. No weather/drainage frequency, quantization, grip math or persisted state changes.

23 focused tests passed (sample ownership, weather replay cache, partial weather, visual performance), 0.62s. New tests compare exact sample values with the uncached cell sampler across water/snow/ice/oil/rubber mutations and verify retained samples and visual deltas do not change on subsequent calls. A short isolated allocation comparison used warmed cells and 20,000 samples per trial, before/after/after/before, 16KiB sampling including collected objects. Estimated cumulative bytes before44.25/49.07MB, after22.89/21.62MB: approximately52.3% reduction for this isolated default-sample path. This is not whole-game allocation or FPS improvement; callers already providing scratch do not gain the same reduction. Script and results: artifacts/mountain-stress/measure-weather-sample-reuse.mjs,weather-sample-reuse-allocation.json,weather-sample-reuse-tests.log. All short jobs completed.

### 2026-11-02 — deck vector temporary allocation

sampleDeckAtDistance now normalizes scalar components directly rather than allocating copied forward/right inputs and an intermediate cross-product vector. Adapter-owned vectors remain untouched, returned tangent/right/normal remain fresh, and the arithmetic and fallback conversions are preserved. This removes three explicit temporary objects per deck sample without changing collision geometry or reducing update frequency. normalizeVector3 delegates to the same scalar helper for its existing callers.

Five focused tests passed in0.49s, including 1,000 exact historical-method comparisons with varied yaw/grade/banking/width, frozen adapter vectors, zero vectors, retained-output independence, and corridor fallback tests. Historical method fixture: tests/unit/fixtures/deckSampleBeforeScalarVectors.js. A short before/after/after/before allocation sample of20,000calls each estimated35.55/37.38MBbefore and32.22/23.79MBafter. Estimates were variable; both updated trials allocated less, but no precise reduction or whole-game FPS improvement is claimed. Artifacts: deck-vector-tests.log,measure-deck-vectors.mjs,deck-vector-allocation.json. All jobs finished. Further whole-simulation validation should include this, same-query fallback reuse and weather sample scratch reuse together.

### 2026-11-02 — combined allocation batch validation

Ran a fresh sequential baseline/updated pair on the same saved Mount Washington, seed8730,29AI/fullstorm/autodrive,1200updates. Each sampled frames301–1200 with131072-byte allocation sampling including collected objects. Test-only baseline loader restores original built-in profile construction, route projection, same-query surface fallback, deck vector temporaries, and weather sampling temporaries. Production files were not toggled for the baseline.

Estimated cumulative allocation fell from4894.36MiB to4474.45MiB (8.58%). Exact equality verified for track checksum,player driveState,all29AIstates,detailedCounters,detailedSteps,frameClock,finalWeatherState,frames,simulatedSeconds,and sourceDigest. This validates the combined allocation direction with unchanged simulation results, not browser FPS or reduced long-GC pauses. Separate isolated percentages must not be summed or presented as total improvement. Sampling and phone scheduling/frequency changes preclude an FPS comparison. Both test processes exited successfully; no simulation jobs remain.

Remaining top self sites include deck sampling136.42MiB,cell sampling112.52MiB,join102.41MiB,wheel-contact creation96.40MiB,quantization89.26MiB,environment provider87.84MiB,wheel kinematics86.89MiB. Allocation stacks also show tire-event mutation and normalization; high scalar-function allocation can include boxed numbers, not just explicit object literals. Nested inclusive same-function totals can double-count recursion/repeated stack occurrences and must not be summed. Next investigation should target environment/contact/event data ownership and broader sample construction rather than assuming drainage frequency itself is the problem.

Artifacts: pre-gc-allocation-batch-loader.mjs;gc-batch-before/after.heapprofile;storm-autodrive-gc-batch-before/after-cpu.json;analyze-gc-batch.py;gc-batch-comparison.json;gc-batch-before/after.log.

### 2026-11-02 — rejected tire-event callback candidate

Investigated applyTireContactEvent allocation stacks. Candidate replaced per-event physicalTotal closure, material arrays/forEach callbacks, and receiver callbacks with shared helpers/constants and loops, preserving separate receiver passes and carry ownership. Five tests passed including exact water/material/carry/snapshot/visual parity over400events. However the allocation benchmark did not show a reliable gain. After10,000warmup calls per implementation, paired20,000wet-event trials estimated78.78/79.99MBbefore and77.33/79.43MBcandidate. Differences are small and overlapping; initial shorter trials were more variable. This suggests optimized runtime behavior already removes much of the apparent callback/array overhead, though no JIT diagnostic proves that explanation.

Restored only this candidate method/helper change; all earlier validated optimizations remain. Do not claim a tire-event speedup. Candidate and parity test preserved as artifact text, not production code. Results: tire-mutation-loop-allocation.json; candidate tire-event-loop-candidate.txt; baseline tire-event-before-loop.txt; test tire-event-loop-parity-test.txt; test log tire-mutation-loop-tests.log. The benchmark script records the trial setup but its former temporary fixture imports must be restored to rerun. Next work should focus larger contact/environment output construction and retained event payloads rather than further callback micro-optimizations. All jobs completed.

### 2026-11-02 — remove disposable wheel-contact sample merge

createRaceWheelContactStateFromSamples previously spread raw terrain metadata and normalized authoritative geometry into a disposable object per unprepared wheel. It now reads projection/segment/material/friction from raw input and normalized region/normal/validity from authoritative input directly. No pooling or lifetime change; returned samples remain independently owned, explicit target reuse and prepared-query paths remain supported. Four merged objects removed per ordinary four-wheel call.

New tests compare historical constructor output exactly over200four-wheel batches with live track state, changing materials/positions, invalid normals/heights, airborne wheels, prepared samples, retained outputs and explicit target reuse. Broader validation:8/9passed (surfaceSample,raceAiRoadContacts,raceAiSurfaceReuse,wheelContactSampleOwnership). The one failure is the independent preexisting surfaceSample test expected shape missing supportFamilyId/supportFamilyDriveable/supportEdgeClassification; that test imports only unchanged SurfaceSample.js, not modified contact code. Do not claim all tests passed. Log:wheel-contact-merge-tests.log.

Short isolated warmed constructor sampling,20,000calls per before/after/after/before trial:104.12/107.76MBbefore,83.60/83.83MBafter,~21%less estimated allocation in this path. No whole-game or FPS claim. Artifacts:measure-wheel-contact-merge.mjs,wheel-contact-merge-allocation.json. Exact historical reference in tests/unit/fixtures/wheelContactBeforeMergeRemoval.js. All tests/measurement jobs completed. Followup full-simulation parity/allocation remains warranted.

### 2026-11-02 — contact merge full-simulation check and browser handoff

Completed1200update Mount Washington fullstorm29AI/autodrive with same sampling window301–1200. Cumulative sampled allocation4365.40MiB versus4474.45MiBprevious batch and4894.36MiBprebatch:2.44%incremental reduction,10.81%combined. Compared against saved prior trials, not a new interleaved repeated baseline; sampling estimates/no FPS claim. Track checksum,player driveState,all29AIstates,counters,steps,frameClock,finalWeatherState,frames and simulatedSeconds equal previous trial exactly. sourceDigest differs as expected because it hashes implementation files including the edited contact constructor and TrackState. Source digest is not a gameplay-state checksum.

HTTP localhost:8000 responses matched current disk bytes for RaceVehicleSurfaceContact.js,TrackState.js,RaceSurfaceModel.js,raceData.js. Test session exited0. No heavy jobs remain. Fresh phone detailed capture requested to verify real browser frame pacing/rollover behavior; Node allocation savings do not establish smoother Chrome frames or GC pause reduction. Artifacts:gc-contact-after.heapprofile,storm-autodrive-gc-contact-after-cpu.json,gc-contact-comparison.json,gc-contact-after.log. Remaining self allocation includes deck133MiB,cell110MiB,join103MiB,environment87MiB,contact72MiB. Need reassess actual browser stalls before assuming further micro-allocation work is highest-value.

### 2026-11-02 — material ownership audit while browser capture pending

No new performance upload yet (latest remains c7e7). Kept heavy tests stopped and production files unchanged to preserve the build being recorded. Read-only audit identifies a stronger next candidate than callback rewrites: RaceSimulation environment provider clears every materialByWheel property then copies every TrackState cell field at lines1956ff, despite reusing the outer objects. Detailed AI builds equivalent full-cell spreads in RaceAiSimulation lines477ff. These include baseline/drainage/coordinates/normal metadata beyond the material values read directly by ContactPatchTireModel. Deleting/repopulating properties may incur dictionary/backing-store and numeric boxing costs; this is a hypothesis, not measured attribution for all87MiB provider self allocation.

Known consumers: ContactPatchTireModel chooses trackStateByWheel then materialByWheel, reads grip/condition flags, moisture/water/snow/ice/marbles/dirt/mud/oil/roughness/rubber, temperature and publication fields. PackedRaceWorkerEnvironment has its own material construction; worker parity must be considered. A stable explicit physics-material schema could avoid full-cell copies, but must audit all transitive helper/publication consumers before dropping fields. Lower-risk alternative: retain matching keys and only remove stale keys, analogous to existing tire configuration overlay handling in ContactPatchTireModel. Either candidate must preserve transition from cell to no-cell, live grip changes, material switching, saved snapshots and worker output. Do not change weather update cadence to solve data-copy overhead.

Next controlled experiment after browser handoff: compare old and stable material update with actual canonical cell shapes and repeated mutations; keep only if warmed allocation evidence and end-to-end simulation parity justify it. Current browser build remains the10.8%allocation-reduction batch.

### 2026-11-02 — isolated stable-material candidate prepared

Created artifacts-only updateMaterialCell prototype. It preserves every enumerable cell field, retains the seven always-overwritten runtime overlay slots, and deletes only stale fields; arbitrary inherited adapter records use the original clearing fallback. This avoids prematurely narrowing the material schema. A tiny correctness test passed200sequential transitions across canonical cells,null cells,live water/grip mutations,added/removed custom fields,nonenumerable fields,inherited records and null-prototype records, with exact post-overlay equality and normal reference ownership. Test process0.14s; no profiling or simulation run. Prototype is NOT imported by production, live build unchanged.

Artifacts:material-update-candidate.mjs,material-update-candidate.test.mjs,material-update-candidate-tests.log. Performance benefit unmeasured. Also found tireByWheel and brakeDamage records use delete/repopulate in the same provider; these are further candidates only after measuring material update. Existing browser capture request still pending; latestupload remains c7e7. Keep long/heavy tests stopped during phone recording.

### 2026-11-02 — stable-material isolated allocation evidence

Small warmed material update benchmark uses a canonical TrackState cell, changes water every iteration, removes the cell every100updates, and overwrites all seven runtime overlays. Four3000call trials before/after/after/before estimated29.42/30.08MBbaseline versus3.31/3.86MBcandidate (~88%meanreduction for this isolated operation). Whole process completed0.12s; sampling timestamps15:40:35.017–15:40:35.101UTC (2026-11-02) retained to identify any overlap with a phone capture. This is not whole-game allocation/FPS evidence. Keeping existing property slots appears materially different from merely replacing callbacks.

No production integration yet. Prepared material-update-loader.mjs for opt-in headless integration, with exact-source marker guard and no disk mutation. It replaces only the player material clearing/copy block, leaving field values and all physics math unchanged; AI pooling not attempted because ownership needs independent validation. Artifacts:measure-material-update.mjs,material-update-allocation.json,material-update-loader.mjs. Latest browser upload still c7e7. Full simulation validation deferred while requested browser recording pending; no heavy jobs running.
