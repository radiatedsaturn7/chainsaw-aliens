# Attempt ledger

“Not proven” is different from “proved useless.” Historical timing comparisons often changed CPU placement/frequency or driving workload. Do not reuse isolated percentage gains as whole-game claims.

| Attempt / hypothesis | Result and current disposition |
| --- | --- |
| One stuck AI in an infinite recovery loop explains the slowdown | Stuck/queued-car bugs were real, but historical AI profiling put recovery around 0.14% and moving detailed cars dominated. Not a general explanation. |
| Optimize planning/traffic checks alone | Planning was around 1–2% of historical AI work; terrain, chassis, tire/suspension and powertrain cost dominated. Scheduling planning helps but cannot remove most cost. |
| Reduce detailed AI count | Production now uses three detailed opponents. Useful workload reduction, but lightweight AI, rendering and player stalls remain. |
| Broad frame-budget scheduling | Implemented for optional work. Cannot interrupt expensive synchronous mandatory work; some benchmarks deferred all runtime preparation because there was no spare budget. Bounded catch-up is not proof of sufficient simulation throughput. |
| Move simulation into a worker | Initial probe exhausted worker heap; shared preparation improved it. A later terrain-cache correction achieved about 114.47/120 player steps/s, with backlog still accumulating in a short probe. Main-thread responsiveness was better but throughput qualification failed. Automatic mobile migration remains disabled. |
| Assume triangle count explains the tire spikes | Recent neighboring frames have nearly identical calls and triangle visits but drastically different elapsed times. Collisions still cost real CPU during crashes; count alone is insufficient. |
| Wheel-pose cache prototype | Active branch improved substantially, but eager cache bookkeeping worsened smooth fast paths. Whole-run speedup was not demonstrated. Later lazy/active-path production reuse avoids unnecessary preparation. |
| Optimize callbacks/arrays in tire-event mutation | Warmed allocation results overlapped: roughly 78.78/79.99 MB baseline versus 77.33/79.43 MB candidate. Exact-output tests passed, but reliable benefit did not. Candidate reverted. |
| Weather wind-direction cache fragmentation | Synthetic pathology reproduced, but live forcing caller defaults direction to zero. Not a demonstrated cause of current workloads. |
| Weather catch-up is always the dominant bottleneck | Live counts show bursts and maintenance work, but no minutes-stale-cell event in the short observed run. Latest phone weather phase averaged 0.16 ms. Sample/material copying and allocation are separate from water/weather evolution. |
| Blindly pool one contact output per AI | Unsafe: lightweight AI holds old contacts while sampling proposed movement; recovery also retains selected contacts. Overwriting old results corrupts height/normal checks. Use explicit independent lifetimes. |
| Small AI scratch-only experiment | Lower allocations but only ~2.4% noisy isolated CPU difference. Does not justify broad speed claims or stronger unsafe pooling. |
| Reuse road metrics / direct contact event construction | Large isolated gains and parity; whole-run timings varied or even reversed. Useful targeted work, not a demonstrated equivalent FPS gain. |
| Read browser heap totals to determine GC | Coarsened/constant heap readings could not answer the question. Natural Node GC event tracing proved local GC involvement, not browser attribution. |
| Incremental reset recovery alone | Solver slices became bounded, but hidden car drawing during black hold still caused a huge measured stall. Added hidden-render bypass; needs fresh rollover validation. |
| Car rendering cache/detail tiers | Implemented and useful, but did not eliminate intermittent rendering costs. Do not discard required authored graphics to force a small cache. |
| Treat optimistic first benchmark as a speedup | Historical 29-AI median update 24.57 ms briefly appeared to improve to 12.36 ms; a clean repeat was 22.82 ms. The defensible comparison was much smaller and still not a browser FPS result. |

## Promising but not shipped

The environment provider clears and repopulates material records every wheel update, including many track-cell fields. The bundled stable-material prototype preserves matching slots, deletes only stale keys, and retains seven runtime overlay slots. Its isolated 200-transition parity test passes. Four warmed allocation samples estimated roughly 88% less allocation for this one operation.

It has **not passed whole-simulation, AI ownership or browser validation** and is not imported by production. The loader only replaces the player material-update block and fails if its exact source marker changes. It does not optimize AI or packed worker material construction.

## Progress we can defend

Recent production allocation changes preserve the tested complete simulation state and reduce estimated cumulative allocation about 10.8% in the matched headless workload. Specific bugs such as hidden rendering during opaque recovery have actionable fixes. The latest phone capture is encouraging. We cannot honestly provide a controlled “one day ago versus now” whole-game speedup, because recordings and runtime conditions were not held constant.
