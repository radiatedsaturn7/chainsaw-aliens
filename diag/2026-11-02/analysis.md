# Analysis and current performance

## Current architecture and constraints

Three nearby opponents receive detailed physics; remaining opponents use cheaper simulation (29 opponents in the principal recent tests: three detailed, 26 cheap). Player contact/grip and nearby collisions remain authoritative. Existing player fixed-step physics is preserved. The cooperative frame-budget queue schedules optional preparation; it cannot preempt a running synchronous function. Bounded admitted time avoids unlimited catch-up, but overload can slow simulated race time relative to wall time. Therefore assess simulation throughput as well as presentation intervals.

Preserve deterministic behavior, saved cars/races, live weather and tire properties, collision correctness, input support and recovery placement. Do not fix performance by silently removing simulation steps or letting cars pass through terrain.

## Latest phone capture

Capture `c7e7edd86d7c5680807db1c19c84e40d2cfa89405947a0969fe526287a3b45ef.json`, started 2026-11-02 12:52:37 UTC. Mount Washington, detailed recording, full storm, 29 AI, three detailed. Approximately 60 seconds; 4,667 active frame records, excluding intro/countdown. No pending recovery.

| Frame interval | Measurement |
| --- | ---: |
| Median | 11.5 ms |
| P95 | 18.6 ms |
| P99 | 22.8 ms |
| Maximum | 94.7 ms |
| Above 16.67 ms | 11% |
| Above 33.33 ms | 6 intervals |
| Above 50 ms | 2 intervals |

These are recorded intervals, not GPU-completion measurements or guaranteed displayed FPS. A 60 FPS presentation budget is 16.67 ms. The prior two captures had P95 20.2/22.4 ms and 14/12 intervals over 33 ms, but driving and resets differed: this is observational improvement, not causal proof.

| Average recorded phase | Elapsed time per active frame |
| --- | ---: |
| Rendering | 5.08 ms |
| All AI | 2.92 ms |
| Player physics | 1.52 ms |
| Weather field | 0.16 ms |

Nested measurements: car sprites 0.94 ms; detailed AI 1.90 ms; lightweight AI 0.99 ms; player terrain collision 0.19 ms; player tires 0.32 ms. **Do not add child timings to parent timings.** Instrumented elapsed scopes are not OS thread CPU measurements, despite some legacy field names containing `Cpu`.

At 46.452 seconds, AI 5 iterative tire contact solving took 37.6 ms over eight calls/two steps. Neighboring frames had the same eight calls/two steps and 76 point queries; prepared triangle visits were 168 before, 166 during, 153 afterward. The loop is bounded at one or three iterations per wheel. This is not an iteration-count explosion. Raw terrain sampling also spiked. At 43.892 seconds, lightweight AI self time reached 37 ms. Unrelated small scopes can absorb large elapsed interruptions.

Suspension setup maxima were 4.1 ms for AI and 2.9 ms for player, versus earlier AI spikes of 27.3/31.6 ms. The large setup spike did not recur; the run does not prove permanent elimination.

## Ten-minute GC investigation

Completed 36,000 updates / 600 simulated seconds in 798.6 seconds wall time; full storm, 29 AI, production tiering, approximately 4.93 km autodriven. Node headless, no renderer/audio/browser recorder. Natural GC events and main-thread/process CPU were measured; no forced GC, allocation sampling or CPU sampling during the primary run.

After excluding the first five updates:

- 7,089 minor GC events: median 4.31 ms, P95 7.21 ms, maximum 211.61 ms.
- 149 major GC events: median 26.70 ms, P95 600.03 ms, maximum 1,159.35 ms.
- 150 incremental events; total reported GC elapsed time approximately 57.02 seconds.
- Of 1,052 loop intervals over 50 ms, only 70 had GC occupying more than half.
- Of 680 intervals over 100 ms, only 65 had GC occupying more than half.

GC sometimes occurs between updates; inspect start-to-next-start intervals, not just update scopes. Frame 22202 had a 32.61 ms update inside a 1,193.92 ms interval with 1,160.61 ms GC overlap. Frame 21180 had a 15.49 ms update inside a 1,138.12 ms interval with 1,115.73 ms GC overlap.

Conversely, frame 35854 took 1,480.25 ms elapsed with 18.98 ms main-thread CPU and no GC overlap. This demonstrates substantial non-GC interruption as well. GC elapsed duration can include scheduling delays; main-thread CPU excludes background GC workers. These Node observations do not establish Chrome's pause distribution or FPS.

## Allocation reductions now in production

Removed repeated built-in editable car construction from tuning fallback; reduced route-query temporary allocation; reused projection/deck results within the same off-road lookup; reused private weather-calculation intermediates; removed temporary deck vectors and disposable wheel-contact merge objects. Returned records retain required ownership; weather/grip math and simulation frequency were not reduced.

A 1,200-update headless workload sampled frames 301–1200 (15 simulated seconds), Mount Washington, seed 8730, 29 AI, full storm. Estimated cumulative allocations: pre-batch 4,894.36 MiB; intermediate batch 4,474.45 MiB; final batch 4,365.40 MiB (**10.81% lower**). This counts allocated objects including collected objects, not resident heap. Sampling estimates are variable; the final comparison used saved prior trials, not a fresh repeated interleaved baseline.

Final player state, all AI states, track checksum, weather, counters, physics steps and simulation time matched exactly. Source hashes appropriately changed. No fresh phone capture validates the final batch yet. Do not translate 10.81% allocation savings into an FPS or GC-pause reduction.

Remaining sampled self-allocation sites included deck sampling 133 MiB, cell sampling 110 MiB, string join 103 MiB, environment provider 87 MiB and contact construction 72 MiB. These are cumulative sampled estimates in that window. Scalar-looking sites can allocate boxed numbers. Nested inclusive stacks must not be summed.

## Longer-run behavior and resets

Earlier consecutive storm captures showed tracked cells increasing from about 10,518 to 18,169 to 25,924, alongside increased frame costs. Changing terrain, visible cars and crashes prevent attributing that trend to cell count alone. Car-art cache estimates did not steadily grow in those captures.

Incremental reset recovery spreads validated placement work across frames. A separate capture showed roughly one second spent drawing a car during a fully opaque reset hold, while recovery slices themselves were only a few milliseconds. Hidden world/car/weather/HUD drawing is now bypassed during that opaque interval. The latest capture had no resets, so it cannot validate reset presentation or rollover correctness.
