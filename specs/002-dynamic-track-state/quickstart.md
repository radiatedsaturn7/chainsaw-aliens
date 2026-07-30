# Quickstart Validation: Dynamic Track State

## Prerequisites

- Run commands from the repository root.
- No generated `data/server-storage/` files are required.
- Node.js must support the repository's ES module tests.

## 1. Core deterministic cell simulation

```sh
node --test tests/unit/raceTrackState.test.js
```

Expected:

- all required fields persist per one-meter cell;
- weather, thermal phase changes, drainage, and downhill water flow pass;
- water/material conservation remains within the specified tolerance;
- 10,000 ordered events produce identical snapshots/checksums;
- restore-and-continue matches uninterrupted evolution.

## 2. Exact tire and race integration

```sh
node --test tests/unit/raceTrackStateIntegration.test.js
```

Expected:

- four wheels can read four distinct local cells;
- swept contacts modify all crossed cells;
- airborne wheels neither heat nor mutate cells;
- rubber, displaced water, swept marbles, dirt/mud carry, and crash debris
  persist in the race session;
- static geometry remains the authority for cell material and elevation.

## 3. Adaptive AI

```sh
node --test tests/unit/raceTrackStateAi.test.js
```

Expected:

- AI chooses a safer alternate path after a meaningful grip loss;
- target speed incorporates the candidate's local state;
- hysteresis prevents switching more often than once per second;
- no static candidate receives a grip bonus.

## 4. Existing race architecture and loading regressions

```sh
node --test \
  tests/unit/raceSimulationSystems.test.js \
  tests/unit/raceSimulationArchitecture.test.js \
  tests/unit/racePlaytestPreparation.test.js \
  tests/unit/raceTravel.test.js \
  tests/unit/racePackedSurfaceSampler.test.js
```

Expected: all pass.

## 5. Physics feel and browser validation

```sh
npm run test:race-physics-feel
```

Compare with the documented pre-feature baseline; do not retune unrelated
vehicle behavior merely to change thresholds.

GitHub's PR Playwright workflow is authoritative for:

- race start/loading in browser;
- projected/WebGL surface rendering;
- recurring-hiccup and frame-budget regression checks;
- editor portrait/landscape stability.

## 6. Repository hygiene

```sh
git diff --check
git status --short
```

Expected:

- no whitespace errors;
- no blanket-staged or feature-unrelated `data/server-storage/` churn.
