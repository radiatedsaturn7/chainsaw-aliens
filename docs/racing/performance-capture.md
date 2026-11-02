# On-device race performance capture

Use **Pause → Debug → Start performance capture**. This resumes the race.
Drive normally and reproduce the slowdown. In particular, spend several seconds
looking toward AI cars, then away, without changing weather or AI count. Pause
again and choose **Debug → Stop performance capture**, or let the 120-second
capture finish. Completed captures automatically upload to the same project
server, including when you exit the editor. Debug shows `uploading`, `saved`, or
`failed`; use **Upload performance report** to retry a failure. Failed captures
stay in memory, and starting another capture is disabled until upload succeeds
or you download the report as a fallback. Do not refresh/close the browser before
saving: large captures are not sent through unload/beacon APIs.

The server stores JSON in `data/server-storage/performance-captures/`, excluded
from Git and the project browser. `GET /__performance/captures` lists recordings;
`GET /__performance/captures/<id>` reads one. Uploads use content hashes for
idempotent retries, atomic writes, a 32 MiB request limit, and retention of the
newest 30 reports within 256 MiB. Older reports are removed automatically.
Static hosting without this Python server can still use the download fallback.

To capture the startup hitch, start recording, then use Pause → Restart and
play through the intro/countdown. Recording follows the new session in the same
race editor. A capture ends after 120 wall-clock seconds, 8,000 frames, or leaving
the editor. Pauses consume the time limit but are not counted as slow frames.
The report stays available in Debug until replaced or the editor is discarded.

The export contains:

- Frame-interval median/P95/P99, counts over 33/50 ms, and the 40 worst frames.
- CPU scopes for update/simulation, AI and main-thread physics, tires/body contact,
  track weather/checkpoints/water flow, precipitation, scenery, cars, HUD and
  WebGL submission. Exclusive/self time excludes instrumented child work;
  **do not add inclusive times together**. Scope percentiles cover frames in
  which that scope ran.
- Per-frame total AI/submitted car-billboard counts, car paints/reuses, uploaded texture pixels,
  texture resizes, draw calls/triangles, race elapsed time/countdown, weather,
  wall-clock timestamp (`wallClockMs`, Unix milliseconds), camera view/yaw, position and available backlog counts.
- Existing worker and physics summaries, kept separate from main-thread timings.
- Main-thread long-task notifications when the browser provides them.
- Asynchronous WebGL2 GPU timing when `EXT_disjoint_timer_query_webgl2` is
  available. Unsupported/unmeasured GPU time is **null**, never zero. GPU queries
  are capped at eight pending results and invalidated on disjoint/context loss.

These timings identify expensive work, but do not prove that any one subsystem
caused every gap. Frame intervals include browser scheduling and other work
outside this editor. A gap is attached to the preceding recorded frame, not the
next frame's work. GPU timings cover instrumented Three.js render calls, not
Canvas 2D rasterization or browser compositing. Pending GPU results are discarded
at stop/export; `gpuCalls` versus `gpuSamples` shows measurement completeness.
Worker summaries are rolling reports, not synchronous per-frame worker traces.
Long tasks are not a garbage-collection detector.

Instrumentation is opt-in. Stopping removes all method wrappers, disconnects the
observer and deletes outstanding queries. Serialization/upload starts after
stopping the timing hooks; it is not included in the captured frames. Large JSON
serialization can briefly occupy the main thread after capture. No third-party
telemetry service receives reports. Capture uses the existing scrollable pause/debug menu in
portrait, landscape, desktop and gamepad modes, with no additional HUD overlay.

Automated validation: `node --test tests/unit/racePerformanceCapture.test.js`.
Actual phone/GPU/browser behavior still needs an on-device capture; Node tests
validate timing attribution, cleanup, bounds, unsupported APIs and mocked GPU
query behavior.

A Node overhead smoke test (29 no-op AI runners, 1,200 update/draw pairs, five
rounds) measured median added bookkeeping of about 0.031 ms/frame; the slowest
round averaged 0.166 ms/frame. This excludes real GPU-query and browser-observer
cost. Reports were about 0.95 MB per 1,200 frames for that fixture. Actual report
size and instrumentation cost depend on active scopes. Raw observations:
`artifacts/performance-capture-overhead.json`.

Submitted car billboards include the player when drawn and may be occluded by
terrain. This is a rendering-work count, not a per-pixel visibility measurement;
it excludes cars drawn as 3D models. The total AI count remains independent.
Wall-clock timestamps derive from the initial Date.now plus monotonic elapsed
capture time, so wall-clock corrections during a capture do not shift frames.

## Open-source tool choices

[Perfetto](https://perfetto.dev/docs/getting-started/other-formats) can visualize
Chrome JSON timelines and counters. It is a useful next analysis/viewer layer;
our server reports remain compact game-specific JSON. Detailed captures can
now be converted with `tools/performance_trace.py`, preserving measured span
timestamps rather than inventing start times from aggregated phase durations.
[Spector.js](https://github.com/BabylonJS/Spector.js) is MIT-licensed and inspects
WebGL commands/resources for individual frames. Use it for targeted rendering
investigation, not as an always-on replacement for lightweight game telemetry.
Neither tool automatically supplies race time, AI counts, weather, or physics
state. No new profiling dependency has been installed in the game.

## Detailed capture from a phone

Choose **Pause → Debug → Recording → Record** and drive through the
slowdown. It resumes automatically, records up to 60 seconds / 8,000 frames /
400,000 nested spans, then uploads using the same server workflow. Stop early
with the existing Stop performance capture action. No browser developer tools,
computer connection, or manual export is required from the player.

Detailed mode adds synchronous boundaries inside player/AI physics substeps,
chassis integration, surface consistency, collision recovery, wheel collision
support, snapshots, car drawing, sprite batches, surface queries and snow updates.
Existing broad weather/render/physics scopes are also recorded as nested spans.
It does not instrument every helper, per-triangle operation, worker internals,
or browser engine functions. AI runner scopes identify the runtime array index.

`trace.names` interns scope names; each compact span stores name ID, monotonic
start milliseconds, duration, exclusive time, frame index and nesting depth.
Slots are reserved on entry and completed on exit, including exceptional exits.
If the buffer fills, open ancestors still finish; omitted calls are counted in
`droppedSpans`, and recording ends at the end of that frame. Standard mode does
not collect spans or install the extra hooks. Detailed profiling adds overhead;
compare standard and detailed captures before treating small timings as exact.

For analysis on the server (the player does not run this):

```
python tools/performance_trace.py data/server-storage/performance-captures/ID.json artifacts/race.trace.json
```

The resulting Chrome trace JSON opens in Perfetto as a nested flame chart, with
frame context markers for timestamps, AI counts, weather and rendering work.
These are measured calls, not sampled stacks or fabricated durations. Self time
includes uninstrumented descendants. GPU timing remains in the original report;
we do not align GPU execution with CPU submission timestamps artificially.


The race Debug menu groups controls into Performance recording, AI racers,
Weather & lighting, Vehicle & indicators, and Physics & debug overlays. Back
returns to Debug before returning to the main pause menu. The race screen and
pause screen show a small top-center capture badge: red REC with elapsed/limit,
yellow uploading, green submitted after server acknowledgment, or a retry error.
The submitted status remains until the next capture or editor exit. The badge
stays inside the race viewport rather than the surrounding virtual controller.
The 60-second capture retains safety caps, so an unusually busy capture can end
early with `span-limit` or `frame-limit` recorded in the report.

Recording now uses short labels: Mode, Record, Stop, Upload, Export. Mode defaults
to Detailed (60s); tap Mode or use left/right to switch to Standard (120s).
Detailed captures include nested timings; Standard includes broad system timings.
Uploads remain automatic; Upload is available for retries.


## Follow-up to the October 29 phone captures

Fixed the car-render pass guard: diagnostics from the player painter are merged
back into the caller's stats object. The Canvas AI overlay now sees that the
cars were already submitted to the depth-tested pass. Counts and texture-upload
metrics survive the same handoff.

Static road/terrain rebuilding now owns and disposes only its scene objects;
scenery, player/AI models and car sprite caches survive a late road texture.
Loading waits for deferred artwork and three subsequent rendered frames, with a
30-second escape for a stalled optional worker. This can increase loading time
but keeps ordinary late-art rebuilds behind the loading screen.

AI candidate lane evaluation shares weather samples for identical cells within
one decision. It never reuses them across decisions; tire contacts, spills,
weather and lane-scoring rules remain authoritative and unchanged.

Detailed recordings now separate AI surface planning, contact queries, thunder
audio generation and scenery/static geometry preparation. Per-cell weather
catch-up/event/creation scopes are aggregated without retaining every span, to
avoid exhausting the 60-second trace buffer. Frame work includes scenery/static
rebuild counts, total weather cells and the last tick's weather integration work.

A constant-weather lookup micro-optimization was tested and removed: paired
headless benchmark rounds did not demonstrate a consistent speedup. The evidence
is in `artifacts/storm-catchup-comparison.jsonl`; all rounds retained the same
weather checksum. Further weather optimization requires the new granular
recording. None of the headless checks establishes a phone FPS improvement.


### Follow-up: music and occlusion regression

The next two captures were `ae4131ff…` (36.24 seconds, span limit) and
`7e99b554…` (60 seconds). The first pinned its countdown at 4000 ms for about
10 seconds. Music seeks now retry on media readiness events, and an ignored seek
cannot keep the countdown pinned indefinitely. The project server now supports
single byte ranges for audio/video files. Songs without cues remain continuous;
there is still no seek at GO. A persistently unseekable song falls back to the
normal countdown rather than guaranteeing drop alignment.

Car sprites now use a conservative occlusion plane at the camera-facing edge
of the car's physical footprint, rather than through the rear axle. Rendering
remains depth-tested against terrain. This is an approximation for 2D artwork,
validated geometrically on uphill/downhill roads and multiple headings; actual
appearance on the phone still needs checking.

Detailed recording retains spans on alternate frames (`trace.frameStride=2`),
with subsystem timings on every frame. This reduces trace-buffer pressure over
a minute; a buffer limit can still stop an exceptionally busy recording early.
The server converter keeps the original timestamps and does not interpolate
missing call spans. Road weather catch-up remains an unresolved major cost in
the second recording (roughly 13–20 ms/frame through its busy portion).


### Exact weather replay sharing

Old existing road cells must replay missed fixed weather ticks when sampled by
wheels or AI. The runtime background budget does not cap this authoritative
on-demand work. A detailed phone capture showed roughly 19 ms/frame of catch-up
late in the recording, and a 216 ms catch-up spike.

Long identical replays now share their exact result. Cache keys include the
starting weather state, exposure/drainage/compaction profile, timestep, and time
interval; weather-history changes invalidate the cache. Every precipitation,
evaporation and drainage addition is replayed in its original order, preserving
checksums. Only weather fields are copied: tire deposits and runoff remain
independent. Mutation notifications still capture checkpoint state before writes.
The cache holds at most 256 entries / 32,768 simulated steps. Small replays (<32
steps), extremely long replays (>2,048 steps), noncanonical cells and the full-clamp
reference path retain ordinary integration. Cache misses remain exact integration.

Report work counters `weatherReplayCacheHits`, `weatherReplayCacheMisses` and
`weatherReplayReusedSteps` are cumulative; take differences between frames.
`weatherIntegrationSteps` still counts logical background steps, including reused
steps, to preserve scheduling. Counters are diagnostic and not saved physics state.

Run `node tools/benchmarks/race-weather-replay.mjs` for the paired CPU-only fixture:
512 existing matching storm cells, each 600 ticks behind. Warm paired runs went
from approximately 67–78 ms to 16–20 ms, with identical checksums. This isolates
repeated weather work, not rendering or whole-race FPS. Varied runoff and exposure
reduce reuse; a new phone capture is needed to quantify the actual race improvement.


### Follow-up: buildup history, car repainting, and thunder

The four phone captures at 22:43–22:47 on October 29 showed only 2.7–5.9% reuse
for the original whole-interval weather cache. It did not solve the race backlog.
`getWeatherForStep` also walked the whole transition Map for every tick: buildup
can append hundreds of transitions. The history now has an incrementally appended,
binary-searchable index. Catch-up resolves constant-forcing segments and shares
bounded 32-tick blocks; runs shorter than 16 ticks bypass hashing. Keys omit
absolute age (not a recurrence input), but include all weather/profile inputs and
forcing segment identity. Transitions, checkpoint replacement, fixed-step changes,
and per-cell modifications remain authoritative. There is no coarser weather
step or change to runoff scheduling. The cache now holds at most 1,024 entries /
32,768 simulated steps and handles replays longer than 2,048 ticks in bounded blocks.

`node tools/benchmarks/race-weather-history.mjs` compares the old linear lookup,
indexed direct replay, and segmented/block replay with staggered existing cells
and a 300-tick buildup history. Warm runs measured approximately 1,008–1,110 ms,
33–59 ms, and 24–46 ms respectively, with the same checksum. These are synthetic
CPU tests, not phone FPS. Cold/JIT results were slower and should not be omitted
when assessing startup; the script prints every round.

Car artwork uses Canvas composition plus texture upload, unlike retained doodad
meshes. AI now refreshes artwork at distance-dependent intervals with frame spacing
and a soft eight-paint budget, while positions/depth are updated every frame.
Authored angle changes, substantial attitude/view changes, and light/brake/signal
changes invalidate reuse. A 250 ms soft-budget deadline prevents starvation; new
or invalidated images can exceed the budget. The player stays full-rate. A 20-FPS,
30-opponent test verifies more than two cached reuses per repaint and immediate
light changes. This is artwork LOD, not lower-rate vehicle physics.

The static road cache no longer changes at rain/snow material thresholds: authored
base surfaces remain static and existing dynamic Track State overlays own local
water/snow. Every remaining static rebuild records `staticGeometryReasons` to
identify late artwork, terrain, or other invalidation. Geometry, markings, UVs,
terrain collision and the renderer's depth testing are unchanged.

Thunder synthesis starts when lightning is spawned, before its sound-travel delay.
A module worker fills the seeded samples; unsupported/failed workers use scheduled
2,048-sample chunks. Playback only copies prepared samples and starts audio nodes.
Pause/exit invalidates pending results and terminates preparation. Worker/fallback
outputs match exactly; preparation does not alter the storm RNG or sound delay.

Detailed captures now include collision subscopes for terrain sweeps, penetration
validation, support generation and static colliders. `physicsDetail` copies the
latest completed player physics frame, including its sequence, counters and selected
timings, rather than the cached 15-frame summary. These timings describe the same
work as the enclosing capture phases; do not add them together. Collision physics
was not simplified without evidence identifying the expensive contact path.

Additional work counters: `weatherHistoryEntries` is current transition count;
`weatherCatchUpRequestedSteps` is cumulative logical replay demand;
`weatherCatchUpMaxSteps` is the largest single requested replay. Cache hit/miss
counters now count blocks rather than entire catch-up calls, so compare reused
steps and actual CPU cost across versions, not hit percentages alone.


## 2026-10-30 04:03 UTC — new captures, sprite clipping, reset search

The six captures from 03:35–03:43 UTC show weather catch-up averaging
0.34–0.74 ms/frame and no static-world rebuilds. The newest capture averages
3.91 ms inclusive car-sprite drawing with 11–31 submitted billboards. Counts
include occluded cars; these are CPU timings, not GPU or presentation FPS.

The stuck-player capture performs 580 tire evaluations in one frame despite
only four normal chassis steps. Staged road resets now bound nested fallback
equilibrium searches to one candidate per attempt and advance the search on
subsequent attempts. Four loaded road contacts and upright validation remain
mandatory. Direct/immediate reset defaults remain unchanged.

Detailed recording explicitly requests physics accounting for its duration,
restores that request on stop, and excludes duplicate/stale physics-detail
frames. A new `player.resetAuthoritativeState` scope (and AI equivalents)
separates reset work from ordinary driving.

Car sprite caches no longer reuse viewport-clipped images. Their depth plane
also fits painted ground contact bounds, using the existing shadow ground query.
This handles authored wheels below the physical footprint while retaining
nearer-terrain occlusion. The correction is bounded by vehicle length; it is
still a billboard approximation, not a per-pixel 3D car mesh. Visual validation
on the phone and new performance captures remain necessary.

## Distant 2D car resting-frame cache

AI with authored 2D body artwork switches to resting frames beyond 40 metres
of camera depth and returns to live detail inside 30 metres. Significant roll
or pitch, 3D models, unsupported dynamic FX, and electrically dimmed lamps keep
live rendering. Player rendering and all vehicle physics remain unchanged.

Resting frames are canonical 128-pixel-wide compositions, shared by matching
art/setup, eight-way view, frame/mirroring, and actual lamp states (including
brakes, reverse, signals, high beams and auxiliary lamps). Their wheels use
zero steering/spin and authored resting placement. Distant shadows are omitted.
Emissive lamp artwork is cached separately so rally lights retain emission.

Generation is demand-driven and limited to two new variants per rendered frame.
A cold miss uses the live path until ready; this avoids disappearing cars, but
means the first sight of a new group can still cost more than the warmed case.
The shared LRU stores at most 96 variants / 4,194,304 pixels including emission
(16 MiB RGBA, excluding two reusable scratch canvases and per-car GPU textures).
New sessions clear the cache; replaced art/setup and tire compound changes get
new identities. Oversized artwork uses live rendering rather than a clipped
cached frame.

A resting car's existing depth texture is reprojected and resized every frame
without periodic composition/upload. View/light changes, viewport changes,
clipped images and returning to live detail invalidate it. Thus movement and
terrain occlusion remain current even though suspension/wheel animation is
omitted at distance.

Recordings expose `carRestFrameBuilds`, `carRestFrameHits`,
`carRestFrameDeferred`, and `carRestFramePixels`. Builds are canonical image
preparation; `carPaints`/`uploadedPixels` still describe per-car depth textures.
A deterministic 30-car / 120-frame test requires only 30 initial paints/uploads
for unchanged distant appearances. This is a work-count test, not phone FPS.

## Exact road recovery and shared AI surface observations

Recovery history previously checked actual tire contacts but saved a projected
road-centre target. The reset runner could project it again, then demand static
force/moment equilibrium with up to 64 contact rebuilds per candidate. Exhausted
attempts also left automatic recovery free to start the same search again.

History now retains the actual verified position, orientation and suspension
geometry. The main-thread history reset bypasses route substitution and static
equilibrium: rebuild contacts once, validate four loaded tread widths against
current road geometry/height and body clearance, then resume ordinary dynamics
with zero velocity. Fuel, damage and tire condition are not rewound. Replays
preserve the validated-placement mode. Worker reset messages now also receive
the exact saved position/orientation, but retain their existing equilibrium
solver because the current compact protocol has no suspension snapshot field.
Successful resets retain safe history for another immediate tumble. Exhausting
attempts suppresses automatic retriggering until the car moves six metres or
becomes upright; manual recovery remains available.

The latest AI-heavy frames include lane/grip observation cost and terrain/body
sweeps, not evidence of an infinite planning loop. A slow frame previously forced
distant cars into immediate full-rate processing; that promotion is removed.
Accumulated simulation time is retained. Advisory lane evaluations now share
cell observations across cars for one Track State tick (normally 100 ms), with
2,048 cached cells maximum. Live tire forces/collision geometry do not use this
advisory cache. Track replacement/tick advancement invalidates it.

Capture context now includes pending reset attempts, verified-history selection,
automatic-retry suppression, last installed reset status, and displayed reset
errors. This distinguishes successful placement from repeated failed attempts.
Focused recovery/AI integration: 45 tests passed; four selected equilibrium and
placement tests passed, including exact pose, one rebuild, road rejection and
validated-placement replay. Phone timing improvements remain unmeasured until
new captures arrive.

### 2026-10-31: prepare static collision world during loading

Capture `42a137a8ff` starts with a 657.9 ms interval during countdown (41,744 route projections, 243,207 prepared-triangle visits). The first simulation environment lazily built static collision data, including ground-height queries for solid scenery/fences. Startup drawing now calls `prepareRaceStartupCollisionWorld` before presenting/releasing loading; simulation reuses the same authority cache. This does not advance physics, AI, countdown, fuel, or damage. Cache misses still rebuild for a changed world. Also guard a missing cache when the bake is undefined (direct/local startup).

Seventeen targeted startup/scheduling/AI-terrain tests pass, including actual editor startup invocation, fence height-query reuse on the first simulation request, and world replacement. Phone timing has not been remeasured; the recording's simulation self scope does not isolate every millisecond of the startup hitch.

Busy 10–20 s window (356 frames), exclusive CPU averages summed across opponents: tire contact 4.21 ms/frame, runStep self 3.33, integrateChassis 3.20, outer AI self 2.54, terrain collision step 0.61, AI contact lookup 0.58, AI update wrapper 0.52, adaptive support 0.44. Surface-candidate planning 0.19. Inclusive AI is 16.77 ms/frame; these exclusive components must not be added to that inclusive total. Reduced-frequency scheduling batches elapsed simulation time rather than removing all fixed physics steps. These findings favor reducing distant AI physical detail with tested transition rules over further route-planning simplification. GPU time is unavailable and this is not a controlled A/B.

### 2026-10-31: four nearest detailed opponents

The active main-thread simulation now selects the four nearest AI by physical world distance (including height when available), with stable tie ordering. All others use the existing aggregate powertrain and terrain-following chassis at a staggered 20 Hz. Selection is independent of camera direction and route progress. The player keeps its existing full simulation. Standing/rolling countdown also obeys the budget; initial cheap state construction advances zero full-solver steps.

Cheap opponents no longer escalate the whole pack to full physics because of proximity, terrain curvature, or traffic. Valid road motion retains per-car gearing, power, tires, grip, weather, grade, mechanical time and race progress. Engine/drive and brake mechanical effects apply to aggregate forces. Unsafe movement yields in place instead of running the detailed solver; it retries when clear. An overturned/unsupported demoted car is held rather than snapped upright; full recovery resumes when it enters the nearest four. Consequently, distant pileups can wait longer and distant collisions are approximations, not equivalent to full rigid-body simulation. Promotion preserves pose, motion, mechanics, wheel spin, simulation time and pending collision impulses. The optional worker backend retains its existing physics policy; the budget applies to the current phone/main-thread path.

Captures expose `context.aiPhysics.full`, `.cheap`, and `.held`. Forty-seven focused tests pass, including 30 real editor AI advancing for 90 frames with exactly 360 full-solver update calls (four per frame), all 26 cheap cars progressing, countdown budget, promotion continuity, blocked/resumed movement, overturned-pose preservation and mechanical force degradation.

A 600-frame CPU-only Mount Washington/full-storm fixture run with 29 opponents completed with four detailed and 25 cheap cars, no AI resets or backlog, and all opponents moving at the end (rear grid cars still on the extension before route distance zero). Artifact: `artifacts/mountain-stress/storm-nearest-four-cpu.json`. This is not a browser/FPS test or a controlled before/after comparison. Instrumented CPU median was 43.7 ms and P95 79.6 ms on this host; substantial non-fixed-solver AI/contact work remains, so a phone capture is needed to measure the actual improvement. The earlier straight-track integration test proves the cap, not a steady frame-rate target.

### 2026-10-31: Mount Washington loading regression

Moving static collision construction into `RaceEditor.draw` bypassed the `withRaceGeometryReadCache` scope normally supplied by simulation. The saved Mount Washington document has 19,880 scenery entries: repeated ground samples outside that scope regenerate imported-road signatures instead of sharing them. The unscoped reproduction stalled; scoped construction completed in 7.8 seconds on this host. `prepareRaceStartupCollisionWorld` now establishes that scope itself (retaining existing nested scopes), and releases it on success or error.

A real collision build also starts a fresh first-frame presentation deadline. Loading preparation must not consume the 5-second presentation watchdog; ordinary cache hits do not extend the watchdog. Twelve targeted startup/geometry-cache tests pass, including repeated fence queries in one scope, scope cleanup on exceptions, no second-build queries, and deadline behavior. Saved-track reproduction is in `artifacts/repro-mountain-startup.mjs`; browser/GPU presentation still needs device verification.

### 2026-10-31: held opponents, checkpoint slices and three artwork tiers

The user confirmed some late player terrain contact cost was caused by crashes; player collision fidelity is unchanged. Cheap opponents previously had no recovery for a demoted unsupported/overturned/overlapping pose. Held retries now run at 1 Hz for structural failures and 4 Hz for other blockers, while mechanical and race clocks continue. After four simulated seconds, structural failures beyond 120 m can attempt at most three road-center placements at current progress or 6/12 m behind. Placement requires road-supported wheels, usable attitude, static obstacle clearance and no traffic overlap. Attempts are limited to one car per update and one per car per four seconds. Fuel, damage and lap remain unchanged. This is simplified opponent recovery, not player rewind; traffic queues alone do not qualify. Captures include held IDs/reasons/durations, recovery and promotion counts.

Checkpoint service no longer chains capture, assembly, hash and commit phases within one call. Existing frozen-baseline/replay parity tests pass. Freeze and commit now have individual capture scopes. These changes do not establish the exact cause of every 300 ms stall: allocation/GC or browser scheduling cannot be proven from the current self-time scopes. Phone remeasurement is still required.

Artwork now uses player-relative distance rather than camera depth: far cache beyond 55 m on retreat (until 50 m on approach), medium cache at 30–50 m on approach, live within 30 m (until 32 m on retreat). Medium canonical width is 256 versus 128 pixels; cache keys include tier so the per-car depth texture is repainted on transition instead of continuing to magnify a far-distance raster. Both tiers share the existing 96-entry/4M-pixel LRU budget and two-build-per-frame limit, with separate reusable scratch canvases. Crash attitudes, 3D models and unsupported animated FX retain the live path. Actual visual quality and device frame-time impact need a browser capture.

### 2026-10-31 11:05 UTC: bound surface visual sampling and reuse overlay buffers

Newest phone capture `76f2fe58ee` covers 60 seconds later in the same race: median interval 36.9 ms, P95 52.8 ms, 131 frames over 50 ms. Its 332.9 ms frame at 54.63 seconds contains 247.1 ms self time in visual-cell collection and 42.3 ms in surface geometry. The four-full/25-cheap AI budget remains active. A separate 91.7 ms frame includes 54.9 ms in contact flushing; checkpoints and thunder do not explain these particular stalls. These are CPU observations, not GPU timings or proof that allocation/GC caused every spike.

Main-thread visual queries now heapify raw spatial candidates by distance, sampling nearest cells until the existing visible limit is filled (320 mobile, 1,400 desktop). Dry cells do not consume the limit. Records preserve the prior distance and grid tie ordering. Reusable sample scratch avoids constructing full records for discarded cells. Simulation state, player collision fidelity, grip and weather evolution are unchanged. Worker presentation retains its existing query path. Weather overlay geometry now reuses its mesh and typed attribute buffers, with explicit draw counts and bounds; capacity growth releases old GPU buffers.

Synthetic 14,400-wet-cell CPU benchmark, 12 alternating rounds: old query median 61.87 ms, bounded query 13.04 ms (about 79% less), with identical returned records. Artifact: `artifacts/bounded-visual-benchmark.json`; script: `artifacts/benchmark-bounded-visuals.mjs`. This is not an end-to-end phone FPS result. Regression coverage verifies only 320 of 3,600 wet cells are sampled, unchanged state checksum, dry-cell handling, mesh reuse/growth and moving/shrinking bounds. Thirty-nine focused tests pass.

Capture context now includes visual candidate/sample/return counts and last/maximum flushed contact batch sizes. Detailed profiling also measures contact enqueue time. Event ordering and flush semantics are unchanged; these diagnostics should distinguish unusually large batches from pauses within otherwise routine processing. Remaining AI cost and intermittent flush spikes still require measurement; this change does not claim those are resolved.

### 2026-10-31 11:46 UTC: three detailed opponents and staggered advisory planning

Captures `d6e59976d6` and `fda71bb029` show median intervals of 16.7 and 34.7 ms, respectively. The latter averages 13.25 ms inclusive AI, including 7.72 ms in detailed vehicle updates; the remainder includes shared and lightweight work and cannot be attributed entirely to cheap cars. Surface overlay time is down to 0.83 ms/frame versus 2.80 in the prior late capture. A separate 369 ms stall includes unusually slow tire/event/checkpoint execution with an ordinary 199-event contact batch; allocation/GC or OS pauses remain unproven hypotheses.

At the user's request, main-thread detailed physics now covers the three nearest opponents (26 cheap with the usual 29 opponents). The optional worker path retains its previous policy. Speed/braking lookahead uses staggered simulation-time phases: 10 Hz detailed and 4 Hz cheap. Lightweight traffic-following speed limits refresh every 150 ms; detailed traffic following remains live. Cheap lane/surface decisions run at 4 Hz within 180 m and 2 Hz farther away. Initial advice is computed immediately, and subsequent decisions are distributed by car index; missed intervals produce one fresh decision rather than a backlog.

Pure-pursuit steering, current pace/heading/end-of-route speed caps, and movement swept collision checks remain live. Traffic snapshots still rebuild once per AI update. Promotions, new sessions, displacement over 12 m, heading changes over 0.35 radians and grip/braking degradation over 10% invalidate advice early. This trades some distant planning responsiveness for less repeated work; it does not lower player simulation fidelity or remove collision checks.

Sixty-two focused tests pass, including a real 30-opponent run with exactly 270 detailed updates over 90 frames, all 27 cheap opponents progressing, standing-start budget, 30/60/120 Hz advisory cadence, fleet staggering, no decision catch-up backlog, live steering and detailed traffic response, invalidation, road plans, cheap recovery and swept traffic bounds. Phone timing improvements have not yet been measured.

### 2026-10-31 12:13 UTC: destructible scenery broadphase and hiccup attribution

Newest capture `2f62d0d41d` has 39.2 ms median / 53.2 ms P95 intervals, 129 frames over 50 ms. Three detailed opponents are active; detailed AI updates average 6.36 ms/frame versus 7.72 in the earlier four-car late capture. However, simulation self time increased from 1.37 to 6.40 ms/frame. The newly planted 2,090 destructible bushes activated a legacy trigger pass that checked every bush against all vehicle contact probes every update. The preceding all-solid planting had no such candidates. This is a confirmed source of additional steady work, not proof that it explains the full 201.7 ms simulation-self spike in this capture.

Scenery triggers now use a 32 m center-cell spatial index. Queries cover the actual vehicle contact bounds expanded by the maximum authored trigger radius and probe radius; narrow collision and pickup checks are unchanged. Candidates retain authored order, with no duplicate processing. Replaced/appended scenery and fresh sessions rebuild; Car Editor previews rebuild for live edits. Static collision preparation also prepares this index under loading. Solid rocks, trees and fences remain in the existing physics broadphase.

At the captured road position, the local 120-update fixture went from 2,090 doodad reads/update and 4.95 ms median to zero nearby doodad reads and 0.117 ms median (P95 0.464 ms). These are separate CPU-only fixture runs, not a phone frame-rate comparison. Script and results: `artifacts/benchmark-mountain-scenery-triggers.mjs`, `artifacts/mountain-scenery-trigger-cost.json`. All 69 selected tests pass, including exhaustive-versus-indexed overlap parity, negative coordinates/large props, authored order, one-shot flattening, teleport queries, pickup persistence, loading preparation and AI budget integration.

Detailed capture now wraps scenery collisions, wear/damage, diagnostics, actual tire-particle stepping, engine/tire audio, ghost recording, triggers, reset fades and checkpoint progress. High-frequency route projections and wheel surface/contact queries use aggregate-only timings. AI work has separate `AI.detailedCars` / `AI.lightweightCars` totals and aggregate-only per-runtime-index `AIcar[index].tier` phases; promotion changes the tier immediately. These phases are nested: inclusive totals must not be added to their child timings. Work outside driver updates remains in the outer AI scope. Per-frame `context.sceneryTriggers` reports total and nearby candidates. Hooks restore on stop; the extra profiling is enabled for detailed recordings only. Wall-clock scopes can include GC or OS interruptions and cannot independently prove those causes.

### 2026-10-31 12:43 UTC: advisory staggering and allocation reduction

Captures `fad01dead5` / `06efd37e69` show 15.8 / 31.3 ms median frame intervals. Late scenery trigger checks average 0.104 ms with at most one nearby candidate, confirming the broadphase fix. The late AI split is 7.00 ms for detailed-car work and 4.15 ms for lightweight-car work; player physics is 6.87 ms. Broad stalls persist: 103 ms in contact enqueue, 96 ms scenery self time without a rebuild, and 88 ms in cell lookup plus 54 ms checkpoint processing in another frame. The latest detailed recording retains 270,436 trace spans. These observations motivate allocation reduction and cheaper instrumentation, but do not prove GC or a particular browser scheduling cause.

Speed lookahead and lightweight traffic advice now have offset phases. Healthy lightweight cars prefer traffic when both jobs become due, and speed advice yields to an update that refreshed surface/lane advice. Advice age limits prevent starvation: speed may exceed its normal 100/250 ms interval by 50 ms before forcing a refresh; lightweight traffic forces refresh at 200 ms (subject to the next movement update). Initialization, promotion, teleport, sharp heading changes and sudden grip/brake loss still refresh immediately. Detailed-car immediate traffic checks, pure-pursuit steering, tire forces, collision checks and both player/detailed AI physics rates are unchanged. Captures include cumulative surface/speed/traffic planning counts.

Cached scenery rendering reuses the visible-placement array and hidden-ID set rather than allocating another ~18,000-element array each frame. It still checks authored visibility state on every draw. Only animated pickups/models are traversed for animation on cache hits; static meshes are left alone. Asset/transform checks remain active.

Surface cell hits no longer allocate coordinate records or look up the same Map key twice. Accumulated tire contacts construct their canonical event header directly, avoiding temporary header/empty payload records while retaining double quantization and serialized field order. Checkpoint copies avoid temporary key arrays and unnecessary writes to already-copied scalar properties. Existing checkpoint freeze/commit ordering and physics/weather evolution are unchanged.

Recorder timing entries are reused by nesting depth, and wrapped calls pass their receiver/arguments directly rather than allocating another callback. UI Detailed captures use compact traces: all per-frame method aggregates remain, but high-frequency physics substeps omit individual trace arrays, and ordinary trace frames are sampled every fourth frame. Individual AI aggregates and reset traces remain available. This is a tradeoff in flame-graph temporal detail, not a reduction in aggregate hiccup timing coverage.

Ninety focused tests pass, including exact contact-event serialization/state/checksum parity, checkpoint copy/replay parity, scheduling at multiple frame rates, bounded advisory delays, immediate steering/traffic safeguards, real 30-opponent budget integration, visible scenery edit/collection handling, model/pickup animation and profiler nesting/exception cleanup. Synthetic 600-frame recording benchmark (current pooled timer in both detailed modes): full traces 16,800 versus compact 1,800; median CPU 167.95 versus 157.64 ms total (baseline uninstrumented workload 4.79 ms). This measures instrumentation overhead, not race FPS. Alternating 15,000-cell checkpoint-copy benchmark: prior 101.57 versus revised 77.66 ms median, with identical output. Artifacts: `artifacts/recorder-compact-benchmark.json`, `artifacts/checkpoint-copy-allocation-benchmark.json`. Phone remeasurement is still required; the large transient stalls are not claimed resolved.

### AI tire-contact spike investigation — 2026-10-31 14:14 UTC

The 13:59 capture's 20.965-second hitch spent 87 ms in `AI[27].tireContactSubsystem.step`, across two calls. Nearby frames had the same two calls costing 0.3–0.4 ms. The promotion count stayed at 27 through the spike, and physics backlog remained zero. This is not evidence of extra catch-up steps or an unbounded retry loop. Browser scheduling/GC pauses are included in wall-clock scopes and cannot be distinguished from calculation cost by the old subsystem timer alone.

Detailed captures now include `aiPhysicsDetail` with car index/ID, fresh physics-frame sequence, counters, and selected timings. `tireContactSetup` covers footprint, kinematics and suspension; `iterativeTireContactSolving` is nested inside it. `tireGripForces`, `tirePowertrain`, and `tireForceIntegration` separate the other sections of the tire subsystem. These are drill-downs, not extra CPU to add to parent timings. AI accounting is enabled only during detailed recording, uses frame totals instead of detailed per-substep histories, and restores prior configuration on stop. Physics forces and frequencies are unchanged.

The visible-cell query now reuses its candidate array, distance buffer and sampling scratch. Returned samples remain independently owned and nearest-visible ordering is unchanged. This removes recurring query-buffer allocation, but does not establish that either recorded hitch was caused by GC. A fresh phone capture is still needed to validate tail latency.

### Memory observations — 2026-10-31 14:24 UTC

Standard and detailed uploads include `memory.samples` at most every 500 ms, capped at 512 samples. Each sample includes optional `performance.memory` used/committed/limit bytes, recorder frame/span/phase-record counts, renderer geometry/texture counts, cached car-art RGBA byte estimates, and Track State cell/event/checkpoint-copy counts. Sampling occurs only while recording. Unsupported/rejected heap reads leave `heap: null`; resource counters still work. These counts do not establish total CPU/GPU memory consumption.

This intentionally uses a read-only optional heap API rather than heap snapshots or forced GC during racing. Chromium's legacy heap data may be rounded, stale, or incomplete; Safari/Firefox may not provide it. A decrease does not identify a GC event or its duration. Detailed tire work counts and timestamps can be correlated with memory observations, but actual browser GC attribution requires a browser profiler trace. Existing upload storage preserves the added section automatically. Tests cover bounded sampling, unavailable APIs, independent samples, unchanged timing totals and stopping collection.

References: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory and https://developer.chrome.com/docs/devtools/memory-problems . A web page cannot portably raise the engine heap limit; Node heap flags are not a phone-browser setting (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management).

### Hitch fixes and recorder memory — 2026-10-31 15:32 UTC

Car sprite bounds tracking/proxy methods, active IDs, depth-projection vectors, stats and cached camera rotation are reused. Texture crops keep their allocated dimensions while visible instead of shrinking/re-growing across 32-pixel boundaries. Actual artwork copy dimensions, painted bounds and terrain depth tests are unchanged; hidden entries still expire after two seconds. The crop-oscillation test resizes twice in 20 repaints instead of on every boundary crossing. This trades temporary retained texture capacity for fewer backing-store/GPU reallocations.

Detailed scopes now separate `carSprites.paintScratch`, `getOrCreateEntry`, `resizeTexture`, `copyTexture`, `updateTexture`, `fitPaintDepth` and `place`. `copyTexture` measures Canvas copying and marking the texture dirty; actual GPU uploads may happen later during WebGL submission. `slowCalls` preserves up to 24 synchronous calls >=8 ms per frame, including the sprite key for a slow `carSprites.draw`, on unsampled frames too. Parent and child durations overlap; do not sum them.

Compact recordings pool live phase records and retain each completed frame as packed numeric values. The public `frames[].phases` schema stays unchanged and is materialized on report access/serialization. All per-frame aggregates remain available. Ordinary nested trace spans are limited to depth 3 (reset traces are exempt); the trace ceiling now stops appending spans rather than prematurely ending compact recordings. Frame/duration limits still apply. Full noncompact traces retain their existing span-limit behavior. Memory samples include packed-phase byte counts. AI diagnostic accounting retains just the latest frame while recording, avoiding cloned per-car diagnostic histories; player history and physical simulation rates are unchanged.

Adaptive terrain support stops checking neighbor pairs once its existing adaptive-sample budget is full. Those omitted subdivision calls were no-ops; point ordering and contact selection are unchanged. `adaptiveBodySupportPairChecks` records the work, and AI drill-down now includes broadphase/manifold/penetration timers as well as tire timings.

Local benchmark (`artifacts/hitch-fixes-default-budget-benchmark.json`): 24 poses have exact old/new adaptive support parity. At the default 32-sample budget, 100 synthetic support queries took median 22.24 ms before versus 12.82 ms after (~42% reduction). A 1,500-frame synthetic recorder run retained 12.26 MB versus 6.42 MB including typed buffers (~48% reduction); timing overhead was similar (668 versus 655 ms). These are local workload measurements, not phone FPS or proof of GC. GC was forced only between benchmark rounds to measure retained memory, never in gameplay.

Validation: 75 focused tests passed across sprite depth/caching/crop sizes, compact frame serialization/nesting/errors, trace limits, memory capture, accounting cleanup, terrain queries, persistent manifolds, and deterministic replay. The broader chassis suite has three existing failures: submerged reset reason, bounded inverted overlap recovery, and rebound-apex telemetry. All three also fail with the pre-change collision module, verified by `artifacts/hitch-baseline-failures.log`. Browser/GPU and on-phone hitch verification remains necessary; the 166 ms pause is not claimed fully eliminated.

### Collision/weather follow-up — 2026-10-31 18:05 UTC

Latest three captures (17:46–17:49 UTC) showed worsening median intervals (11.5 / 20.2 / 29.4 ms). The largest frame was 285.1 ms, including 231.8 ms of player physics with 33 body sweep slices and 4,695 support features. A separate WebGL submission took 88 ms with only one car sprite submitted. Neither observation proves garbage collection; heap readings were identical throughout. No physics backlog/reset search was recorded in the 285 ms frame.

Adaptive neighbor checks now normalize each sampled terrain normal once per support query rather than once per pair, and calculate pair distances without temporary vectors. Contact ordering, budgets, forces and update rates remain unchanged. Weather catch-up seeks the applicable history segment directly; short replays seek once and advance through transitions rather than searching once per tick. Missing forcing and exact transition boundaries are preserved.

Detailed recordings now include `webgl.texImage2D`, `texSubImage2D`, `texStorage2D`, compressed texture uploads, `bufferData`, `bufferSubData`, `compileShader` and `linkProgram` when the host permits method wrapping. These are CPU API-call durations, nested inside submission, not GPU execution times. Wrappers exist only during detailed capture and are restored afterward; individual draw calls are deliberately not wrapped. Tire setup adds nested `tireFootprintAndKinematics`, `tireSuspensionSetup` and `tireContactValidation` sections for both player and detailed AI.

Paired local benchmark: `artifacts/hitch-followup-{before,after}.json`. Exact SHA-256 equality for 24 pose support outputs and weather cell states; exact equality for precipitation/drainage/evaporation totals. Catching up 256 cells after 8,192 forcing transitions took 31.8 ms before / 13.2 ms after. Warm collision query times were effectively unchanged (~20–21 ms per 200 queries). This does not establish an on-phone frame-rate improvement or eliminate the crash hitch. The benchmark and pre-change loader are in `artifacts/hitch-followup-benchmark.mjs` and `artifacts/hitch-followup-loader.mjs`.

Validation: focused collision, persistent manifold, terrain, weather, deterministic replay and capture suite passed 67 tests; an additional detailed-tire-accounting parity test passes. New regressions cover bounded late-history lookup, missing weather/transition boundaries, GL timing attribution, original return values/receiver, method restoration and unchanged physics with detailed timing enabled. Browser/GPU and fresh phone captures remain necessary to resolve the long-session slowdown and unassigned submission stalls.

### Surface and detailed-AI hitch work — 2026-11-01 13:07 UTC

The latest three captures (2026-10-31 18:22/18:24/18:25 UTC) peaked at 176/206/165 ms. They included a 72 ms cell lookup/creation call, a 51 ms weather catch-up, a 98.5 ms surface visual update, and an AI environment preparation interval of 70.5 ms. WebGL upload calls stayed below approximately 1.5 ms. These measurements identify timed intervals, not proof that every millisecond is algorithmic work or garbage collection.

Implemented:

- Weather replay blocks survive appended forcing history. Rewritten/replaced history rebuilds the indexed segments and invalidates cached results. Cache limits, recurrence order, rounding and ordered totals are unchanged. A paired 100-cell changing-weather benchmark (`artifacts/surface-weather-{before,after}.json`) reduced replay misses from 1,900 to 19 (1,881 hits); elapsed time was 64.9 ms versus 27.9 ms, with identical checksum and precipitation/drainage/evaporation totals. This is a local CPU benchmark, not measured phone FPS.
- Cell creation is separated from existing-cell lookup for profiling. Sorted insertion compares stored numeric coordinates instead of repeatedly splitting keys/allocating coordinate records. Ordering and cursor behavior are preserved.
- Main-thread road-weather selection and mesh building yield every 32 cells. The editor advances at most four groups per invocation, with a soft 2 ms budget per stage. Candidate indexing/heap setup and a single group cannot be preempted. Existing synchronous callers (debug/atlas/tests) retain the original complete-query interface. Visual jobs own scratch independently; map replacement, empty maps, explicit invalidation and large position changes discard stale selection jobs. Worker visual packet selection retains its existing path.
- Meshes build into a separate reusable geometry buffer, then swap atomically. Existing geometry stays visible during normal refreshes, without partially rewritten colors/positions. Both visible and spare geometries are disposed with the scene. This intentionally trades a bounded extra geometry buffer and a few frames of appearance latency for less burst work; tire grip and contact simulation do not wait for these jobs.
- Detailed AI wheel kinematics reuse per-car targets/computation scratch. Tests compare changing orientations and steering to the original allocating calculation within 1e-11, and verify isolation between cars. Physics rates, collision thresholds and suspension behavior are unchanged. Local CPU timing is noisy, so no whole-AI speedup is claimed.

Added detailed scopes for cell creation, base-surface lookup, pristine dry/wet initialization and shared weather replay. `editor.getRaceTrackStateVisualCells` separates visual-query CPU time from the surrounding mesh-update scope. Work records include `surfaceVisualQueryPending` and `surfaceMeshBuildPending`. AI physics timings now split environment terrain preparation, wheel kinematics, wheel material lookup, footprint geometry and collision classification. AI terrain frames also report their actual query counters through the existing accounting interface.

Validation: the physics/weather/AI regression batch passed 56 tests; the final presentation/capture batch passed 42 tests (overlapping suites). New tests cover incremental query equality and scratch isolation, per-slice height-query bounds, exact mesh output, atomic geometry swaps, job progress/cancellation, numeric cell ordering, AI scratch parity, and weather-cache append/rewrite behavior. An existing wet-initialization test failed on the pre-change baseline because its supposedly uncached reference still used the newer shared-block cache; the reference now explicitly disables both caches, preserving the stronger 24,000-step oracle. See `artifacts/surface-hitch-baseline-test.log` and `artifacts/surface-hitch-*-tests.log` / `surface-hitch-verification.log`.

Remaining validation: fresh phone captures are required to assess sustained frame rate and residual scheduling/driver/GC pauses. No browser or phone-GPU run was available locally; these changes do not establish that every 100+ ms hitch is eliminated.

### Clear-weather recovery investigation — 2026-11-01 16:19 UTC

Five retained clear-weather/three-AI captures cover race minutes 8.9–13.9. Median frame intervals are 16.5–16.9 ms; worst retained frame is 159.1 ms. The reported earlier sustained 1–2 FPS incident is not present, so these uploads cannot establish player tires as its cause. Capture disk retention is raised from 256 MiB to 1 GiB (still maximum 30 files / 96 MiB each), to retain a longer continuous climb. Deleted reports cannot be recovered.

AI #3 invokes reset 14–15 times per retained minute. The player invokes reset 23 times during the third capture; its recorded error is `saved road pose no longer has four clear supported wheels`. Rejected reset attempts retain the crash pose, explaining one way the user can remain inverted without a successful reset installing an upside-down pose.

A verified-history reset still first attempts its existing one-rebuild validation. If that fails, it can now run a bounded 32-iteration static settle at the same horizontal road position. Successful candidates must still pass the existing upright-body, clearance and four-loaded-road-wheel validation. There is no acceptance of grass/unsupported poses or blind forced teleport. Regression tests exercise an elevated saved pose settling to supported contact while preserving X/Z, and the existing immediate valid-pose/replay checks remain.

Detailed AI now records the same strict all-wheel-road history as the player and prioritizes these verified poses during recovery. If no history candidate is usable, failed centerline retries progress farther back instead of cycling only the same six offsets forever. Each main-thread attempt allows at most one additional route candidate. Worker placement still uses the worker's authoritative validation. Capture context includes failed/pending AI recovery attempts, error text, waiting time and successful reset count so the next run can distinguish rejection from a subsequent flip.

Validation: 54 tests pass across reset/recovery, detailed capture and deterministic replay; three broader reset-equilibrium tests fail both with and without the new settle option (wake hold duration, slope/crest matrix, Studio Sprint 2 equilibrium hold). See `artifacts/reset-preexisting-failures.log` and `artifacts/reset-followup-verification.log`. Two capture-store Python tests pass. These results do not claim all reset behavior or the missing 1–2 FPS incident is resolved; fresh mountain captures remain necessary.

### Reset and stall follow-up — 2026-11-01 16:51 UTC

The three previously failing reset-equilibrium tests are now fixed and pass. Resolved terrain samples without a `queryPosition` had written `(0,0,0)` into contact telemetry. Parked reset validation compared a wheel's slope height with terrain at that incorrect position, repeatedly scheduling `stationary-reset-terrain-change` transactions. Contact patches now retain the actual iterative query point. This resolves the real Studio Sprint fixture's repeated reset generations as well as the slope hold failure. Driving release uses the settled support for its throttle-suppressed transition step, and statically solved suspension retains coupled tire/spring balance rather than accelerating the unsprung mass from tire deflection alone.

Terrain query frames retain a one-bucket guard band and reuse it while the requested envelope remains contained. Point/range filtering remains authoritative, and revision changes invalidate the cache. A 120-step bucket-boundary oscillation regression rebuilds the grid once and compares every sample with an independent freshly built frame. Detailed physics accounting now separates `terrainLocalIndexBuild` and `terrainEdgeClassificationBuild` from the surrounding terrain preparation cost.

Checkpoint capture counts **visited entries**, including stale/already-copied entries, against its slice limit. Previously skipped entries could bypass the budget and scan the entire queue. Runtime adaptive copy batches are capped at 64 rather than 512; standalone defaults remain unchanged. Weather/checkpoint tests verify frozen snapshot/replay parity, rainfall/freeze-thaw behavior, and a 100,000-entry stale queue's bounded cursor advance. This is a checkpoint fix, not evidence that every cold-cell weather catch-up spike is gone.

Inverted AI recovery now participates in the shared director's one-attempt-per-update budget, preserving a deferred request for the next update. The distant retry path no longer charges that budget twice. Existing dwell, authoritative reset checks, history selection and occupancy checks remain.

Car depth sprites retain recently visible inactive resources for up to 30 seconds rather than two, under an 8 MiB inactive CPU-canvas/GPU-texture budget including emissive artwork. Older resources are disposed first, and shutdown disposes all. This avoids recreating all opponent resources together after a brief look away; it does not establish the cause of the earlier 208 ms GL submission.

Validation: `artifacts/mountain-followup-suite.log` — 144/144 passing; `artifacts/terrain-instrumentation-tests.log` — 38/38 passing (overlapping tests). The combined suite includes all nine reset-equilibrium tests, deterministic replay, real AI recovery, weather replay/snapshots, terrain queries and sprite bounds/depth/resource retention. No browser/phone GPU run was available. The missing sustained 1–2 FPS incident is still unconfirmed; fresh phone captures remain necessary to attribute any remaining stall. The server responds on port 8000; refresh clients to load these changes.
