# Feature Specification: Vehicle Dynamics Shadow Runner

**Feature Branch**: `003-vehicle-dynamics-shadow`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Create a deterministic fixed-step VehicleDynamicsRunner and operate it in shadow mode beside the current race simulation without changing player-visible vehicle behavior."

## User Scenarios & Testing

### User Story 1 - Compare Deterministic Shadow Dynamics (Priority: P1)

As a vehicle-physics developer, I can run a deterministic shadow simulation
beside the live race so future physics work can be measured without changing
what the player drives or sees.

**Why this priority**: A safely isolated comparison path is the prerequisite for
replacing or improving vehicle dynamics without risking existing handling.

**Independent Test**: Run an existing race with shadow mode enabled and verify
that the legacy race produces exactly the same gameplay state and visible
behavior as it does with shadow mode disabled while shadow snapshots and
differences are recorded.

**Acceptance Scenarios**:

1. **Given** a live player race, **When** shadow mode runs, **Then** legacy
   vehicle state remains authoritative for rendering, camera, lap progress,
   collisions, audio, and gameplay decisions.
2. **Given** shadow mode is enabled or disabled, **When** identical controls are
   applied to the legacy simulation, **Then** its resulting gameplay state is
   identical.
3. **Given** a shadow step completes, **When** telemetry is inspected, **Then**
   it includes shadow state and differences from legacy speed, position, yaw,
   yaw rate, lateral acceleration, wheel loads, wheel slip, engine speed, and
   suspension travel.

---

### User Story 2 - Replay Controls Independently of Rendering (Priority: P1)

As a vehicle-physics developer, I can replay timestamped driver controls through
one fixed-step clock and receive identical shadow state and telemetry regardless
of render-frame timing.

**Why this priority**: Render-independent input playback is the core
determinism guarantee needed for trustworthy comparisons and regression tests.

**Independent Test**: Play one analytical input timeline at 30, 60, 90, 120,
and 144 rendering frames per second and compare every final shadow snapshot and
telemetry record.

**Acceptance Scenarios**:

1. **Given** timestamped steering, throttle, brake, clutch, handbrake, requested
   gear, and assist settings, **When** fixed steps fall between samples,
   **Then** controls are interpolated deterministically.
2. **Given** the same input timeline and initial snapshot, **When** playback is
   repeated, **Then** the resulting state and telemetry are identical.
3. **Given** a render hitch, **When** the maximum catch-up budget is reached,
   **Then** work remains bounded and explicit backlog diagnostics describe the
   unprocessed simulation time.

---

### User Story 3 - Validate Representative Vehicle Maneuvers (Priority: P1)

As a vehicle-physics developer, I can exercise the shadow architecture across
representative acceleration, braking, steering, surface, suspension, airborne,
reverse, and hitch conditions before an independent tire-force model is added.

**Why this priority**: A broad deterministic fixture set prevents an
architecture that only works for straight-line nominal driving.

**Independent Test**: Run all twelve named maneuver fixtures under every
required render partition and compare state, telemetry, replay, substep counts,
and catch-up diagnostics.

**Acceptance Scenarios**:

1. **Given** any required maneuver fixture, **When** it runs at each supported
   render rate, **Then** its shadow result is identical.
2. **Given** split grip, curb contact, or ramp contact, **When** tire/contact
   substeps run faster than chassis integration, **Then** their deterministic
   order and counts remain stable.
3. **Given** a future independent tire-force subsystem, **When** it is attached
   at the tire/contact boundary, **Then** the runner clock, input timeline,
   chassis boundary, snapshots, and telemetry do not require redesign.

### Edge Cases

- Multiple render input samples can arrive before one fixed step.
- One render interval can span several fixed steps or include a 250-millisecond
  hitch.
- Duplicate timestamps retain deterministic sequence order.
- Requested gear is discrete and changes only at a deterministic sampling
  boundary; continuous controls interpolate between samples.
- Assist settings remain stable between explicit changes and are captured in
  replay records.
- Catch-up limits never discard or silently fast-forward unprocessed time.
- Tire/contact frequency must divide the chassis step into a deterministic
  integer number of substeps and cannot exceed 360 updates per second.
- Shadow mode can start, reset, snapshot, restore, and replay without reading
  camera, canvas, viewport, scene graph, or other rendering state.
- Missing legacy comparison fields produce explicit unavailable values rather
  than fabricated zero differences.

## Requirements

### Functional Requirements

- **FR-001**: The shadow runner MUST own exactly one authoritative fixed-step
  vehicle clock.
- **FR-002**: The initial chassis integration frequency MUST be 120 updates per
  second.
- **FR-003**: Tire/contact processing MUST support an independently
  configurable frequency no lower than the chassis frequency and no higher
  than 360 updates per second.
- **FR-004**: Tire/contact processing MUST execute a deterministic integer
  number of times within each chassis step.
- **FR-005**: Each render-frame control observation MUST enter a timestamped,
  stably ordered input timeline containing steering, throttle, brake, clutch,
  handbrake, requested gear, and assist settings.
- **FR-006**: Continuous controls MUST be interpolated deterministically between
  input samples.
- **FR-007**: Discrete requested-gear and assist-setting changes MUST resolve
  deterministically at fixed-step sample times.
- **FR-008**: An initial vehicle snapshot and an input timeline MUST be
  replayable without rendering or live input dependencies.
- **FR-009**: The runner MUST expose canonical vehicle-state snapshots that can
  initialize, restore, and compare simulations.
- **FR-010**: Every chassis step MUST execute subsystems in one documented and
  testable deterministic order.
- **FR-011**: The deterministic order MUST include control sampling,
  tire/contact substeps, chassis integration, state finalization, telemetry,
  and legacy comparison.
- **FR-012**: The runner MUST bound chassis work per advance with a configurable
  maximum catch-up budget.
- **FR-013**: Catch-up diagnostics MUST expose completed steps, remaining
  backlog, dropped-time count if dropping is explicitly requested, and peak
  backlog without changing the clock silently.
- **FR-014**: Shadow telemetry MUST include clock, sampled controls, subsystem
  order, substep counts, vehicle state, and catch-up diagnostics.
- **FR-015**: Shadow comparison MUST record differences for speed, position,
  yaw, yaw rate, lateral acceleration, each wheel's load and slip, engine RPM,
  and each wheel's suspension travel.
- **FR-016**: The legacy race simulation MUST remain authoritative for rendered
  position, camera, lap progress, collisions, audio, AI decisions, and all
  player-visible vehicle behavior.
- **FR-017**: Shadow output MUST NOT be written back into legacy vehicle,
  rendering, camera, collision, lap, audio, or AI state.
- **FR-018**: The runner MUST NOT read rendering state.
- **FR-019**: Straight-line acceleration, coast-down, constant-speed cruising,
  constant-radius steering, step steer, emergency braking, split-grip
  acceleration, split-grip braking, one-wheel curb contact, ramp takeoff and
  landing, reverse driving, and render-hitch recovery MUST each have a
  deterministic fixture.
- **FR-020**: Every required fixture MUST produce identical shadow state and
  telemetry at 30, 60, 90, 120, and 144 rendering frames per second.
- **FR-021**: Input playback MUST reproduce the original shadow state and
  telemetry exactly.
- **FR-022**: The tire/contact boundary MUST accept a future independent
  tire-force implementation without changing the runner clock, input timeline,
  snapshot, telemetry, or chassis-integration contracts.
- **FR-023**: This milestone MUST NOT change vehicle tuning, force calibration,
  collision response, camera behavior, lap logic, audio, AI, or other
  player-visible behavior.

### Editor UI Contract Alignment

- **Canonical spec impact**: No editor shell, menu, layout, or visible workflow
  changes are required.
- **Shell/layout contract impact**: Unchanged.
- **Mode impact**: Portrait, landscape touch, desktop, and gamepad behavior
  remain unchanged.
- **Shared helper impact**: No editor layout or menu helper changes are needed.

### Key Entities

- **Vehicle Dynamics Runner**: Owns the shadow fixed-step clock, subsystem
  sequence, state, diagnostics, and advance lifecycle.
- **Control Input Sample**: One timestamped, sequenced set of continuous
  controls, requested gear, and assist settings.
- **Input Timeline**: Canonical ordered control samples that can be sampled or
  replayed at fixed-step times.
- **Vehicle State Snapshot**: Canonical kinematic, powertrain, tire, and
  suspension state at one fixed-step boundary.
- **Tire/Contact Substep Result**: Per-wheel forces, loads, slip, suspension,
  and contact metadata produced for chassis integration.
- **Simulation Telemetry Record**: Immutable per-step timing, controls,
  subsystem order, state, diagnostics, and legacy-difference data.
- **Legacy Comparison Snapshot**: Read-only gameplay-authoritative state
  captured after the legacy update for shadow difference reporting.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One and only one shadow clock determines 100% of shadow chassis
  and tire/contact step timestamps.
- **SC-002**: All twelve fixtures produce identical final snapshots, telemetry,
  step counts, substep counts, and diagnostics at all five required rendering
  frame rates.
- **SC-003**: Replaying every fixture from its initial snapshot and recorded
  input timeline reproduces byte-identical canonical shadow output.
- **SC-004**: A render hitch never exceeds the configured catch-up step budget
  and reports all remaining backlog explicitly.
- **SC-005**: With shadow mode enabled and disabled, all existing
  gameplay-authoritative vehicle and physics-feel regression outputs remain
  identical.
- **SC-006**: Shadow comparison telemetry contains every requested scalar,
  vector, and per-wheel difference for 100% of steps where the corresponding
  legacy value is available.
- **SC-007**: Static and runtime dependency checks find zero reads from
  rendering, camera, viewport, scene-graph, audio, lap, collision, or AI state
  inside the runner core.
- **SC-008**: A test double can replace the tire/contact subsystem and drive the
  existing chassis boundary without changing the runner, timeline, snapshot,
  or telemetry interfaces.

## Assumptions

- Shadow mode initially uses a deliberately simple deterministic dynamics
  implementation; matching legacy handling is not required during this
  architecture milestone because its output is non-authoritative.
- Existing race setup and vehicle tuning data may be copied into an immutable
  runner configuration before simulation begins.
- The legacy simulation can provide a read-only comparison snapshot after its
  authoritative update without accepting shadow output.
- Tire/contact frequencies initially use supported integer multiples of the
  120-Hz chassis clock: 120, 240, or 360 Hz.
- Unprocessed catch-up time remains queued by default instead of being dropped.
- No new UI, tuning controls, content, weather, AI behavior, or player-facing
  telemetry is part of this milestone.
