# Validation: Dynamic Track State

**Validated**: 2026-07-29 10:08 EDT

## Feature tests

- `node --test tests/unit/raceTrackState.test.js`
  - PASS: 10/10
  - Includes 10,000 deterministic ordered events, snapshot/restore/continue,
    synchronization, conservation, and the rotating persistent-cell budget.
- `node --test tests/unit/raceTrackStateIntegration.test.js`
  - PASS: 9/9
  - Includes exact grounded wheel cells, airborne exclusion, authored material
    initialization, swept contacts, emergent traffic effects, crash
    contamination, weather forcing, and ghost replay embedding.
- `node --test tests/unit/raceTrackStateAi.test.js`
  - PASS: 3/3
  - Includes alternate-line selection, predictive grip/risk, symmetry without
    a predefined line bonus, hysteresis, and switch cooldown.

## Race architecture and loading regressions

Command:

```sh
node --test \
  tests/unit/raceSimulationSystems.test.js \
  tests/unit/raceSimulationArchitecture.test.js \
  tests/unit/racePlaytestPreparation.test.js \
  tests/unit/raceTravel.test.js \
  tests/unit/racePackedSurfaceSampler.test.js
```

Result: PASS, 25/25.

This includes exact saved race/car travel loading, packed terrain preparation,
Track State subsystem ownership, and Track State snapshot preservation across
chained race travel.

## Physics-feel baseline

`npm run test:race-physics-feel` completed with 1/4 passing and three existing
dirt-power expectation failures:

- 1200 HP AWD dirt yaw rate did not exceed `0.85`;
- partial-throttle overpowered dirt speed did not exceed the stock case;
- AWD/RWD/FWD dirt yaw rate did not exceed `0.85`.

The same three assertions still failed after temporarily disabling Track State
immediately after race startup, proving they are independent of this feature.
No unrelated vehicle tuning or test thresholds were changed.

## Static and hygiene checks

- Syntax checks passed for all new Track State modules and modified runtime
  integration modules.
- Scoped `git diff --check` passed.
- Existing unrelated `data/server-storage/` and export-session churn remains
  untouched and unstaged.
- Browser/Playwright execution is deferred to GitHub's authoritative merge
  workflow per repository policy.

## Requirement-to-evidence audit

| Requirements | Primary evidence |
|---|---|
| FR-001–FR-004 | One-meter cell/material/profile tests and authored road-vs-terrain initialization test |
| FR-005–FR-011 | Independent weather, thermal, drainage, conservative downhill flow, snow, ice, and melt tests |
| FR-012–FR-020 | Dry/wet rubber, per-contaminant grip/resistance, compound/load/slip/speed/distance, swept/airborne, traffic, carry, and crash-location tests |
| FR-021–FR-023 | AI alternate-path, no-static-bonus, predictive risk, smooth reachable offset, hysteresis, and cooldown tests/integration |
| FR-024–FR-030 | Fixed-step/event ordering, 10,000-event determinism, restore/continue, sync packets, ghost replay data, pause boundary, and chained travel tests |
| FR-031–FR-033 | Sparse allocation, 100 ms bounded rotating work-budget assertion, debug/checksum/conservation interfaces, and physics-view overlays |

All 33 functional requirements and all nine measurable outcomes have
implementation or automated-test evidence. The only non-green command is the
documented pre-existing physics-feel baseline above.
