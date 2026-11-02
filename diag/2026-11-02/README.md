# Performance investigation handoff — 2026-11-02

## Start here

The game is Last on the Grid, a browser-first arcade racer inside RTG Studio. The unresolved problem is intermittent frame stalls on Mount Washington, especially with AI, weather, crashes and resets. We have measured specific improvements but have **not established stable 60 FPS or a controlled whole-game percentage speedup**.

This packet describes production source at `3d4bde952f246ff1b38078eeec3163d17a429bf3` (main after PR #555). The newest analyzed phone capture **predates the final allocation optimizations**. Do not assume its numbers measure those changes. Packaging this handoff does not change gameplay.

Read in this order:

1. [Analysis and current measurements](analysis.md).
2. [Attempt ledger: rejected, inconclusive and limited approaches](attempts.md).
3. [Next investigation and measurement protocol](next-steps.md).
4. [Evidence inventory and reproduction notes](evidence-guide.md).

## Main findings

- Latest phone capture: median/P95/P99 frame intervals **11.5 / 18.6 / 22.8 ms**, maximum **94.7 ms**; 11% exceeded the 16.67 ms target. Full storm, 29 AI, three detailed. No pending reset in that capture.
- A ten-minute headless simulation confirmed GC-related stalls, but also large stalls without GC. It does not prove the same cause in Chrome.
- A matched headless sample found approximately **10.8% less cumulative allocation** after recent production changes, with exact simulation-state parity. This is not a measured FPS improvement.
- Collision workload counts do not explain every collision-timed stall. A timer can include GC, descheduling and unrelated runtime interruptions.
- Stable material-record updates are a promising **unshipped experiment**, not an established fix.

## Critical environment constraint

The user plays on the **same Android phone that runs the Termux server**. Do not run CPU-intensive benchmarks, large capture parsing, heap sampling or builds while asking the user to record. At least one previous recording overlapped a heavy local test. Android CPU frequency, thermal conditions and scheduling also confound uncontrolled comparisons.

## Evidence availability

Selected compact summaries and an isolated prototype are included here so a reviewer with only GitHub access has useful evidence. The large raw phone captures, raw ten-minute timeline and heap profiles remain local and are **not included**. See [the evidence guide](evidence-guide.md) for exact locations and limitations. The summaries are derived evidence, not substitutes for raw traces when verifying attribution.

The chronological investigation remains in [frame-budget-scheduling.md](../../docs/racing/frame-budget-scheduling.md), with historical AI measurements in [ai-bottleneck-measurements.md](../../docs/racing/ai-bottleneck-measurements.md). Those logs contain superseded experiments and observations; read their dates and caveats.
