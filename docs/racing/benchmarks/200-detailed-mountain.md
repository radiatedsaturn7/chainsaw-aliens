# 200 detailed cars on Mount Washington

This diagnostic harness loads the saved Mount Washington race and RTG-001, prepares the actual baked terrain, and creates 200 independently owned AI runtimes along the road. An additional player uses the existing benchmark autodriver. It does not edit the race file or change production car limits.

Each opponent is forced onto the full 60 Hz AI chassis/tire solver used by the game. The test-only property override rejects downgrades from the normal three-car selector. Each frame verifies no opponent entered distant simulation and records each runner's fixed-step index. Traffic planning, terrain contact, suspension, powertrain, collisions and ordinary recovery remain enabled. Weather is clear. This is Node CPU simulation with no graphics or sound rendering, not browser FPS.

Run a short, very expensive sample:

```sh
node --max-old-space-size=2048 tools/loadtest/stress-200-detailed.mjs 5 200-detailed
node tools/loadtest/summarize-detailed-stress.mjs artifacts/mountain-stress/clear-autodrive-200-detailed-cpu.json artifacts/mountain-stress/200-detailed-summary.json
node tools/loadtest/summarize-ai-cpu-profile.mjs artifacts/mountain-stress/clear-200-detailed-ai-steady.cpuprofile artifacts/mountain-stress/200-detailed-profile-summary.json
node --expose-gc tools/loadtest/benchmark-physics-memory.mjs
```

The duration is **simulated seconds**. Five seconds involves 60,000 opponent fixed steps and can take several minutes. Cars are spread along the mountain to exercise multiple road/elevation regions simultaneously; this is not a complete ascent. The heap flag applies to this Node process only and is not a proposed browser fix. The harness retains the production geometry and physics caches rather than secretly shrinking them to fit.

Outputs include inclusive and exclusive physics timing totals, operation counters, the slowest individual car updates with their contact state, per-car step counts, driving/off-road observations, GC events, a sampled V8 CPU profile, and periodic progress JSON. Nested inclusive timings overlap; do not sum them. Detailed instrumentation itself adds cost. The CPU profile begins after one simulated second; total-frame percentiles omit the first five updates. SIGINT requests a graceful stop after the current update so reports can be written.

The constructor memory probe estimates retained allocations after garbage collection in a separate process. Typed-array `arrayBuffers` are included in `external`, so do not add those two fields together. This is not a full retained-heap attribution of the race.

## Measured run — 2026-11-01

The initial 1 GiB-default-heap pilot aborted after approximately one simulated second with a V8 out-of-memory error. Its log is `artifacts/mountain-stress/200-pilot.log`. Near-limit GC distorted its later update times; it must not be treated as a clean CPU baseline.

The 2 GiB-heap run completed **5 simulated seconds / 300 updates / 60,000 opponent fixed steps**, taking **231.4 wall seconds including preparation**. All 200 opponents advanced exactly 300 steps; no cheap simulation was used. There was one additional player. At the end 177 opponents exceeded 1 m/s and 23 were below that threshold despite nonzero target speed. There were no automatic AI resets or sampled off-road/below-road observations. The short run includes acceleration from rest; the 23 slow cars do not establish permanent stuck behavior.

| Whole simulation update, with detailed instrumentation | Time |
|---|---:|
| Median after five warmup updates | 592.7 ms |
| P95 | 1069.7 ms |
| P99 | 1507.7 ms |
| Maximum after warmup | 1893.8 ms |
| Maximum including startup | 10772.0 ms |

These are deliberately overloaded CPU update times, not normal-game FPS or GPU measurements. All update calls together took 197.2 seconds. No complete mountain ascent was performed; cars began spread along the saved route so many terrain sections were exercised at once.

The sampled AI-time breakdown was approximately 36.7% chassis/physics integration, 21.2% terrain/surface queries, 20.4% tires/suspension, 5.7% body/scenery collision, 5.4% track state, 2.0% engine/transmission/mechanics and 1.1% driving/traffic planning. Category attribution uses the nearest recognized stack frame; this is a useful direction, not precise subsystem accounting. Nested exact timers independently identified suspension setup (9.50 seconds), tire-force integration (8.61 seconds), penetration validation (5.88 seconds), powertrain (5.73 seconds), contact validation (5.08 seconds), and footprint/kinematics (5.03 seconds). Terrain queries visited 15.87 million triangles during the measured post-warmup steps.

GC occupied 12.2% of sampled profile time. The separate GC observer recorded 1535 events totaling 14.89 seconds, with a longest event of 661.8 ms across the observed run. These methods cover different intervals/attribution and their totals should not be equated. A standalone constructor probe found approximately 0.492 MB JS heap for a runner and 1.179 MB JS heap + 0.648 MB array buffers for the AI's 128-result terrain-query cache, before local triangle data. The larger default 256-result cache was measured separately and is not the AI allocation figure.

The slowest retained individual AI update took 229.8 ms at route distance about 1459 m. Its physics timer attributed 227.2 ms to the environment provider, with only 94 triangles visited, valid four-wheel support, and no overlapping observed GC event. That does **not** establish a runaway triangle loop: further environment-path sampling is warranted. Another car near 11.5 km repeatedly had expensive wheel-cylinder collision work (1408–2149 triangle visits in selected slow updates) despite valid tire contacts. One such update overlapped 42.5 ms of GC. This is a candidate for investigating unnecessary full collision activation, not permission to disable collision checks solely because tires are supported.

Recommended next experiments:

1. Allocate terrain-query buffers lazily and measure actual high-water usage before resizing defaults. Compare memory and GC under this exact harness.
2. Investigate chassis integration/step overhead and input-history sorting (visible in sampled self time); preserve replay ordering and forces.
3. Compare repeated wheel kinematics/footprints and stable contact-plane reuse against fresh authoritative queries.
4. Reproduce the upper-mountain wheel-cylinder activations locally with fewer cars, checking whether they are genuine road geometry hazards or redundant collision work.
5. Add narrower environment-provider attribution around the isolated slow update rather than calling it tire solving or GC without evidence.

Reports: `artifacts/mountain-stress/200-detailed-summary.json`, `200-detailed-profile-summary.json`, `clear-autodrive-200-detailed-cpu.json`, `clear-200-detailed-ai-steady.cpuprofile`, and `constructor-memory.json`. These findings do not reproduce or explain the user's rare stuck-player stall. No production physics, race files or car-count limits were changed by this test.


## Terrain cache optimization — 2026-11-01

The next increment retains the existing physics and collision rules:

- Allocate wheel/body batch buffers on demand, sized to the queries actually made, and retain them for reuse. Mutable buffers remain vehicle-local.
- Reduce the direct-mapped exact point cache from 8192 to 1024 slots. Hash collisions trigger a fresh query; coordinates are checked exactly, with no contact approximation.
- Retain exact non-layered geometry samples across steps while sampler identity, revision and elevation scale match. Layered roads still query with height every time. Weather/material sampling is separate.
- Share immutable edge classifications between vehicles in the same terrain bucket range. Weak sampler ownership and a 128-range LRU bound retention. Local triangle indices remain vehicle-local.
- Sort discontinuity edges by their minimum X during preparation. Bounds scans stop beyond the query extent, retaining the original Y/Z bounds, feature counts and classification priorities. Existing wheel sweeps remain enabled under the same conditions.

Constructor-only probe: the 128-result AI terrain cache fell from about 1.179 MB JS heap + 0.648 MB array buffers to 0.328 MB + 0.067 MB: approximately 78% less initial allocation. This is not total car memory or peak race memory; buffers grow on demand.

Validation: terrain cache, reset, replay and AI collision targeted tests passed (26 tests before adding the exhaustive feature-scan regression, which also passed). The 30-case 30 m/s high-energy collision subset passed. The broader collision run passed 54 tests but exposed four existing failures: deeply submerged recovery, bounded inverted overlap, rebound-apex telemetry, and the WRX2 curb-contact assertion. All four reproduced using the saved pre-optimization terrain implementation through a Node loader. The full high-energy render/contact/hitch matrix was stopped after two minutes; only its explicit 30-case subset is claimed as completed.

The first optimized stress attempt overlapped collision tests and was stopped after 47 updates; do not use its timing as a comparison. The isolated rerun uses tag `200-detailed-optimized-isolated`. The benchmark source digest now includes PhysicsTerrainQueryFrame.js, which the earlier digest omitted. No browser/GPU performance is measured here.


### Isolated rerun results

| Measurement | Previous run | Optimized run |
|---|---:|---:|
| Wall time including preparation | 231.4 s | 212.5 s |
| Median update | 592.7 ms | 550.5 ms |
| P95 update | 1069.7 ms | 1423.1 ms |
| P99 update | 1507.7 ms | 1633.6 ms |
| Maximum after warmup | 1893.8 ms | 1855.7 ms |
| Maximum including startup | 10772.0 ms | 4095.2 ms |
| GC observer total | 14.89 s | 15.74 s |
| Longest observed GC | 661.8 ms | 721.2 ms |

Both runs completed 60,000 detailed opponent steps (300 per car), with zero cheap opponents, AI resets or sampled off-road/below-road observations. Final X/Z/height, speed, yaw, roll, route distance and vertical speed matched exactly for every opponent. Track-state checksum matched: `8b1f8247`. See `terrain-optimization-state-comparison.json` in the artifacts directory.

This is a memory/startup improvement and a roughly 7% median-time improvement in a single pair, **not a tail-latency fix**. P95/P99 and GC worsened. Phone CPU scheduling/thermal state and GC timing introduce run-to-run variation; repeated runs and a normal three-detailed-opponent browser capture are needed before claiming a steady gameplay gain. No graphics were discarded and physics rates/forces were unchanged.

Prepared triangle visits were effectively unchanged: 15.866 million versus 15.876 million. The smaller cache lost about 0.6% of point-cache hits in this moving-car workload; buffer growths rose from 18 to 96 as expected from lazy allocation. Neither explains away the remaining millions of contact tests. The sampled AI split remains approximately 36.9% chassis integration, 20.9% tires/suspension and 20.3% terrain queries, with planning only 1.1%. Next candidates are allocation within these per-step paths and track-state cell creation/active-key insertion, rather than further reducing AI planning frequency. Player-attributed samples spent substantial time in those track-state functions; that attribution does not imply the player's tire force math alone caused the pauses.
