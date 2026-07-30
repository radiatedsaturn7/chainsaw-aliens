# Tasks: Dynamic Track State

**Input**: Design documents from `/specs/002-dynamic-track-state/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This simulation is deterministic and physics-critical, so every
story includes focused tests before implementation.

**Organization**: Tasks are grouped by independently testable user story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature boundary and validation fixtures.

- [X] T001 Create Track State module directory and public export boundary in `src/racing/trackState/`
- [X] T002 [P] Create core deterministic test fixture in `tests/unit/raceTrackState.test.js`
- [X] T003 [P] Create race integration test fixture in `tests/unit/raceTrackStateIntegration.test.js`
- [X] T004 [P] Create adaptive AI test fixture in `tests/unit/raceTrackStateAi.test.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Deterministic identity, profiles, cells, events, and serialization
required by every user story.

- [X] T005 Implement numeric quantization, stable ordering, hashing, and one-meter swept-grid traversal in `src/racing/trackState/TrackStateMath.js`
- [X] T006 [P] Implement data-driven base material profiles in `src/racing/trackState/TrackStateProfiles.js`
- [X] T007 Implement cell creation, validation, clamping, and derived local grip/resistance in `src/racing/trackState/TrackStateCell.js`
- [X] T008 Implement normalized step-indexed event identities and ordering in `src/racing/trackState/TrackStateEvents.js`
- [X] T009 Implement stable snapshot, restore, checksum, and sync-packet contracts in `src/racing/trackState/TrackStateSerialization.js`
- [X] T010 Implement authoritative sparse session lifecycle and fixed-step scheduler in `src/racing/trackState/TrackState.js`

**Checkpoint**: Deterministic Track State foundation is independently usable.

---

## Phase 3: User Story 1 - Tires Feel the Exact Local Surface (Priority: P1) 🎯 MVP

**Goal**: Every grounded tire consumes and mutates its exact local one-meter
cell; airborne tires do neither.

**Independent Test**: Four wheels over four cells report distinct values,
swept contacts affect every crossed cell, and airborne contacts have no effect.

### Tests for User Story 1

- [X] T011 [US1] Add exact-cell, boundary, swept-contact, and airborne assertions in `tests/unit/raceTrackStateIntegration.test.js`

### Implementation for User Story 1

- [X] T012 [US1] Implement canonical geometry/weather adapters and tire contact event construction in `src/racing/trackState/TrackStateIntegration.js`
- [X] T013 [US1] Add Track State sampling to wheel surface/contact output in `src/racing/RaceVehicleSurfaceContact.js`
- [X] T014 [US1] Add Track State ownership and access through the shared surface subsystem in `src/racing/simulation/SurfaceModel.js`
- [X] T015 [US1] Initialize Track State in playtest sessions and pass exact local samples through `src/ui/RaceEditor.js`
- [X] T016 [US1] Queue grounded player tire events after resolved contact/load/slip in `src/racing/RaceSimulation.js`

**Checkpoint**: User Story 1 passes without weather or AI evolution.

---

## Phase 4: User Story 2 - Weather Evolves Every Cell (Priority: P1)

**Goal**: Cells evolve independently under temperature, rain, drainage,
downhill flow, evaporation, snow, and ice.

**Independent Test**: Differently exposed/elevated cells diverge predictably,
water transfer conserves mass, and phase changes remain non-negative.

### Tests for User Story 2

- [X] T017 [US2] Add weather, temperature, drainage, flow-conservation, snow, and ice tests in `tests/unit/raceTrackState.test.js`

### Implementation for User Story 2

- [X] T018 [US2] Implement deterministic local weather and thermal/phase evolution in `src/racing/trackState/TrackState.js`
- [X] T019 [US2] Implement two-phase downhill water flow and deterministic conservative loose-material displacement in `src/racing/trackState/TrackState.js`
- [X] T020 [US2] Map authored race weather/time data into per-cell forcing in `src/racing/trackState/TrackStateIntegration.js`
- [X] T021 [US2] Advance Track State from the race fixed simulation boundary and expose local rolling resistance in `src/racing/RaceSimulation.js`

**Checkpoint**: User Stories 1 and 2 form a local dynamic-weather surface.

---

## Phase 5: User Story 3 - Traffic Creates a Natural Racing Line (Priority: P1)

**Goal**: Tire traffic and crashes leave persistent rubber, drying, swept
marbles, dirt/mud trails, debris, and oil.

**Independent Test**: Repeated laps produce a measurably cleaner/rubbered line,
directional displacement conserves material, and crash contamination persists.

### Tests for User Story 3

- [X] T022 [US3] Add rubber, water displacement, marbles, carry/deposit, crash debris, and emergent-line tests in `tests/unit/raceTrackStateIntegration.test.js`

### Implementation for User Story 3

- [X] T023 [US3] Implement tire rubber/heat, directional displacement, sweeping, and carry/deposit mutations in `src/racing/trackState/TrackState.js`
- [X] T024 [US3] Queue AI tire traffic through the same contact contract in `src/racing/RaceAiSimulation.js`
- [X] T025 [US3] Convert race damage/collision records into debris and oil events in `src/racing/trackState/TrackStateIntegration.js`
- [X] T026 [US3] Integrate crash contamination and deterministic event history in `src/racing/RaceSimulation.js`
- [X] T027 [US3] Expose visual wetness/rubber/contamination cells through the existing race surface debug/render path in `src/ui/RaceEditor.js`

**Checkpoint**: Traffic creates an observable emergent surface line.

---

## Phase 6: User Story 4 - AI Adapts to Evolving Grip (Priority: P2)

**Goal**: AI selects physically reachable paths and speeds from current Track
State with stable hysteresis.

**Independent Test**: AI leaves a path after a 15% grip loss within one
observation window and does not switch more than once per second.

### Tests for User Story 4

- [X] T028 [US4] Add alternate-path, speed-risk, hysteresis, and no-static-bonus tests in `tests/unit/raceTrackStateAi.test.js`

### Implementation for User Story 4

- [X] T029 [US4] Implement deterministic candidate-line Track State scoring in `src/racing/trackState/TrackStateIntegration.js`
- [X] T030 [US4] Integrate adaptive line offsets and target grip/speed into `src/racing/RaceAiSimulation.js`

**Checkpoint**: AI strategy responds to the same evolving cells as the player.

---

## Phase 7: User Story 5 - Sessions Reproduce the Same Surface (Priority: P2)

**Goal**: Replay, restore, and transport-neutral multiplayer contracts preserve
deterministic evolution.

**Independent Test**: 10,000 events match byte-for-byte and snapshot restore
plus 5,000 events equals uninterrupted simulation.

### Tests for User Story 5

- [X] T031 [US5] Add event-order, 10,000-event, restore/continue, packet idempotency, and checksum divergence tests in `tests/unit/raceTrackState.test.js`
- [X] T032 [US5] Add race-session ghost/snapshot persistence assertions in `tests/unit/raceTrackStateIntegration.test.js`

### Implementation for User Story 5

- [X] T033 [US5] Embed initial snapshot, applied event stream, and final checksum in race ghost data through `src/ui/RaceEditor.js`
- [X] T034 [US5] Expose snapshot/events/checksum synchronization packets through `src/racing/trackState/TrackState.js`
- [X] T035 [US5] Preserve Track State data through supported race travel session lifecycle in `src/game/GameCore.js`

**Checkpoint**: The living surface can be replayed, restored, and synchronized.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Performance, documentation, architecture, and regression proof.

- [X] T036 Add bounded-work, sparse-allocation, and no-recurring-stall performance assertions in `tests/unit/raceTrackState.test.js`
- [X] T037 Add Track State ownership and no-UI-dynamics architecture assertions in `tests/unit/raceSimulationArchitecture.test.js`
- [X] T038 Update subsystem ownership and Track State contracts in `src/racing/simulation/README.md`
- [X] T039 Run all commands in `specs/002-dynamic-track-state/quickstart.md` and record results in `specs/002-dynamic-track-state/validation.md`
- [X] T040 Verify requirement-to-evidence coverage, mark all tasks complete, and exclude unrelated `data/server-storage/` churn in `specs/002-dynamic-track-state/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup has no dependency.
- Foundational depends on Setup and blocks every story.
- US1 depends on Foundational.
- US2 and US3 depend on US1 exact local sampling.
- US4 depends on US1 and US2 samples.
- US5 depends on the authoritative state/event model but can otherwise proceed
  after Foundational.
- Polish depends on all stories.

### User Story Dependencies

```text
Foundation ──> US1 ──> US2 ──> US4
                 └──> US3
Foundation ─────────> US5
US1 + US2 + US3 + US4 + US5 ──> Polish
```

### Parallel Opportunities

- T002, T003, and T004 use separate test files.
- T006 can proceed alongside T005.
- After Foundational, serialization-focused US5 tests can be developed while
  US1 integration proceeds.
- Rendering/debug exposure can be developed after the visual-cell contract
  without touching AI scoring.

## Implementation Strategy

1. Deliver the deterministic core and exact local tire sampling first.
2. Add weather and conservative flow without changing unrelated tire tuning.
3. Add traffic mutations and validate the emergent line quantitatively.
4. Make AI consume the same samples.
5. Finish replay/sync/travel persistence.
6. Validate performance and every specification requirement before completion.
