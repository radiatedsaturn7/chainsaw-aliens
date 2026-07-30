# Implementation Plan: Dynamic Track State

**Branch**: `staging` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-dynamic-track-state/spec.md`

## Summary

Add a deterministic, sparse one-meter Track State grid to every race session.
Cells are initialized from the existing canonical road/terrain sampler, evolve
at a fixed rate under local weather and mass-conserving material transfers, and
are sampled/mutated at exact physical tire contacts. Traffic creates rubber,
drying, swept marbles, dirt/mud carry, and crash contamination. AI evaluates
candidate paths against the same local samples. Stable snapshot, event, hash,
replay, and synchronization contracts preserve the authoritative state.

## Technical Context

**Language/Version**: Browser-native JavaScript ES modules on the repository's
current Node.js test runtime

**Primary Dependencies**: Existing race simulation modules, canonical surface
sampler, Three.js bridge, and browser platform APIs; no new runtime dependency

**Storage**: Authoritative in-memory race-session state with versioned,
JSON-compatible canonical snapshots embedded in ghost/replay or transport data

**Testing**: Node.js built-in test runner, focused race integration tests, and
existing Playwright race tests on GitHub

**Target Platform**: Static browser application, including Android/Termux
development and desktop/mobile browsers

**Project Type**: Static browser game and editor

**Performance Goals**: Preserve the existing race frame target; fixed
environment work at 10 Hz; sparse active cells; bounded catch-up; no recurring
half-second stalls; stable 10,000-event determinism test

**Constraints**: No build step or server dependency; one-meter world cells;
fixed-step and stable event order; deterministic quantization; no global
frame-rate-dependent mutations; no direct vehicle-dynamics ownership in
`RaceEditor`; preserve existing portrait/editor behavior

**Scale/Scope**: All race runtime types, materials, road bands, shoulders, and
terrain; player plus up to 11 AI vehicles; thousands to low hundreds of
thousands of sparse active cells over a session

## Constitution Check

- **Product specs**: This is race gameplay simulation, not editor shell work.
  `UISpec.md` and `ui/EDITORS_UI_CONTRACT.md` remain unchanged. A surface
  visualization may reuse the existing race physics debug view but cannot add a
  new editor shell.
- **Shared architecture**: No menu or layout branch is added. Simulation work
  lives under `src/racing/trackState/` and is accessed through the shared race
  `SurfaceModel`.
- **Mode behavior**: Portrait, landscape touch, desktop, and gamepad editor
  behavior are explicitly unchanged.
- **Validation**: Add pure unit tests for cells, weather, flow, contacts,
  snapshots, event ordering, AI decisions, and integration. Run existing race
  simulation, loading, terrain, and physics-feel tests. Use GitHub Playwright as
  authoritative for browser gates.
- **Repository hygiene**: Do not stage or alter unrelated
  `data/server-storage/` churn. No `latestChanges.js` entry is required until a
  user-visible visualization is delivered; any entry must include date and
  time.

Post-design check: PASS. The design adds no editor UI divergence, new
dependency, build step, or generated storage coupling.

## Project Structure

### Documentation (this feature)

```text
specs/002-dynamic-track-state/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── track-state.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
src/racing/
├── trackState/
│   ├── TrackState.js
│   ├── TrackStateCell.js
│   ├── TrackStateEvents.js
│   ├── TrackStateProfiles.js
│   ├── TrackStateSerialization.js
│   ├── TrackStateIntegration.js
│   └── index.js
├── simulation/
│   └── SurfaceModel.js
├── RaceSimulation.js
├── RaceAiSimulation.js
└── RaceVehicleSurfaceContact.js

src/ui/
└── RaceEditor.js

tests/unit/
├── raceTrackState.test.js
├── raceTrackStateIntegration.test.js
└── raceTrackStateAi.test.js
```

**Structure Decision**: Track State is a pure racing-domain subsystem adjacent
to the modular vehicle simulation. `TrackState` owns authoritative surface
state and deterministic evolution. `TrackStateIntegration` translates existing
race weather, canonical geometry, tire telemetry, damage, replay, and rendering
data. `RaceEditor` only creates/forwards session-owned state and exposes
compatibility/debug accessors.

## Architecture and Execution Order

1. `TrackState` partitions world X/Z into deterministic one-meter integer keys.
2. A cell is initialized lazily through the canonical surface sampler and a
   data-driven material profile. Dormant cells retain implicit baseline state;
   active wet/material frontiers allocate neighbors as needed.
3. Rendering-frame input is accumulated, but authoritative evolution occurs in
   indexed 100 ms fixed steps with a bounded catch-up count.
4. Weather forcing updates a deterministic rotating cell budget; an exact
   sample catches a stale cell up through the same step-indexed timeline.
5. Downhill water flow is calculated into a second buffer and committed in
   stable key/direction order. Tire-driven loose-material transfers are
   conserved inside stably ordered contact events.
6. Tire and crash inputs are normalized into step-indexed events. Swept tire
   paths enumerate every crossed cell and events are sorted by step, vehicle,
   wheel, sequence, and cell.
7. Local samples combine base material with persistent cell values to return
   grip, rolling resistance, hydroplaning risk, and debug/visual data.
8. The player and AI tire models consume the exact local sample. Grounded tires
   emit mutation events after their resolved contact/load/slip step; airborne
   tires emit nothing.
9. AI samples several physically reachable lateral candidates ahead, scores
   current state, and switches only when the advantage exceeds hysteresis and
   cooldown rules.
10. Canonical snapshots sort cells/events/carry state and quantize numeric
    fields before checksum. Replay and multiplayer contracts transport the
    initial snapshot, indexed events, and periodic checksums.

## Chainsaw Aliens Validation Plan

- `node --test tests/unit/raceTrackState.test.js`
- `node --test tests/unit/raceTrackStateIntegration.test.js`
- `node --test tests/unit/raceTrackStateAi.test.js`
- `node --test tests/unit/raceSimulationSystems.test.js tests/unit/raceSimulationArchitecture.test.js`
- `node --test tests/unit/racePlaytestPreparation.test.js tests/unit/raceTravel.test.js tests/unit/racePackedSurfaceSampler.test.js`
- `npm run test:race-physics-feel` and compare with the documented pre-feature
  baseline without retuning unrelated vehicle physics
- `git diff --check`
- GitHub PR Playwright job for browser rendering/performance authority

## Complexity Tracking

No constitution violations require justification.
