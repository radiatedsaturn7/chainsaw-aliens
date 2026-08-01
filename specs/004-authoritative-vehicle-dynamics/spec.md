# Feature Specification: Authoritative Vehicle Dynamics

**Feature Branch**: `004-authoritative-vehicle-dynamics`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Make VehicleDynamicsRunner the authoritative vehicle simulation for Race, Level, and Car playtests."

## User Scenarios & Testing

### User Story 1 - Drive One Physical Vehicle State (Priority: P1)

As a player, I drive a vehicle whose complete motion follows one coherent set
of physical forces and moments in Race, Level, and Car playtests.

**Why this priority**: A single pose authority eliminates divergent planar and
three-dimensional movement and makes tire, suspension, collision, and airborne
behavior physically consistent.

**Independent Test**: Exercise acceleration, braking, steering, airborne,
landing, collision, rollover, and reverse maneuvers while proving that one
state exclusively owns pose and velocity and all legacy fields are derived.

**Acceptance Scenarios**:

1. **Given** any supported playtest, **When** the vehicle advances, **Then** its
   position and orientation result only from accumulated forces, moments, and
   impulses.
2. **Given** tire grip changes at one wheel, **When** the vehicle moves, **Then**
   the resulting trajectory reflects that wheel's force and application point.
3. **Given** a jump or collision, **When** contact changes, **Then** the same
   authoritative state continues through airborne motion, impact, and recovery.

---

### User Story 2 - Choose Explicit Handling Assistance (Priority: P1)

As a player, I can select Simulation, Sport, or Accessible handling knowing
that assistance is explicit, bounded, and observable rather than hidden in a
second motion model.

**Why this priority**: Moving recovery behavior behind named presets preserves
polish without compromising physical authority or masking interventions.

**Independent Test**: Repeat the same maneuver under all three presets and
verify that Simulation adds no stabilization, Sport applies restrained help,
Accessible applies forgiving help, and every intervention is recorded.

**Acceptance Scenarios**:

1. **Given** Simulation mode, **When** the vehicle oversteers, **Then** no hidden
   yaw, pose, velocity, or steering correction occurs.
2. **Given** Sport or Accessible mode, **When** assistance activates, **Then**
   telemetry identifies its type, requested magnitude, applied magnitude, and
   affected physical quantity.

---

### User Story 3 - Race Physically Consistent AI (Priority: P1)

As a player, I encounter AI vehicles governed by the same contact, tire,
powertrain, suspension, aerodynamic, gravity, and collision laws as my car
whenever they are visibly interacting.

**Why this priority**: Unrelated AI movement undermines collisions, racing
lines, surface effects, and the credibility of the authoritative model.

**Independent Test**: Place player and AI cars in matching visible conditions
and verify equivalent physical response while allowing only reduced rates or
sleeping for distant non-interacting cars.

**Acceptance Scenarios**:

1. **Given** a visible AI car, **When** it accelerates, brakes, hits split grip,
   becomes airborne, or collides, **Then** it uses the same physical laws and
   state contract as the player.
2. **Given** a distant sleeping AI car, **When** it approaches visible
   interaction range, **Then** it resumes authoritative simulation without a
   discontinuity in pose or velocity.

### Edge Cases

- Fixed-step catch-up includes multiple contacts, collision impulses, and an
  assist intervention without changing subsystem order.
- One or more wheels unload while remaining wheels continue applying forces at
  distinct points.
- A vehicle crosses zero speed, reverses, rolls over, or lands on a banked road.
- Race completion, reset, respawn, replay restore, travel between Level and
  Race, and Car preview restart each replace the full authoritative snapshot.
- Rendering, camera, audio, UI, Track State, and old tests may read derived
  compatibility fields but cannot write physical state.
- Distant AI sleeping cannot be used during visible contact or collision risk.

## Requirements

### Functional Requirements

- **FR-001**: One authoritative chassis state MUST exclusively own world
  position, linear velocity, body orientation, angular velocity, wheel
  rotation, suspension, tire, and powertrain state.
- **FR-002**: Yaw, pitch, roll, speed, travel heading, and legacy pose fields
  MUST be derived compatibility outputs and MUST NOT feed another integrator.
- **FR-003**: Every fixed step MUST deterministically calculate suspension,
  four independent tire contacts, drive and brake, aerodynamics, gravity,
  grade, collision impulses, handling assistance, and state integration.
- **FR-004**: Every force and impulse MUST identify its world direction,
  magnitude, and physical application point; every moment MUST identify its
  axis and magnitude.
- **FR-005**: Linear and angular trajectories MUST result from summed forces,
  moments, and impulses rather than direct pose, speed, or yaw correction.
- **FR-006**: Normal driving MUST contain no planar follower and MUST NOT
  preserve a separately integrated planar position.
- **FR-007**: Race, Level, and Car playtests MUST use the same authoritative
  runner lifecycle and snapshot contract.
- **FR-008**: Simulation handling MUST apply no hidden stabilization or
  recovery intervention.
- **FR-009**: Sport handling MUST provide restrained controller and stability
  assistance without directly setting pose or velocity.
- **FR-010**: Accessible handling MUST provide forgiving current-style
  assistance without creating a second integrator.
- **FR-011**: Every assist intervention MUST be recorded with its source,
  trigger, requested value, applied value, and physical effect.
- **FR-012**: Visible AI MUST use the same physical subsystem laws and state
  contract as the player.
- **FR-013**: AI optimization MAY reduce substep rates or sleep distant cars,
  but MUST preserve continuous snapshots and MUST NOT substitute unrelated
  visible movement.
- **FR-014**: Acceleration, braking, skidpad, step steer, split grip, curb
  strike, airborne motion, landing, collision, rollover, reverse driving, and
  countersteer recovery MUST be deterministic at 30, 60, 90, 120, and 144
  rendering frames per second.
- **FR-015**: Race completion, camera, AI, damage, replay, Track State, editor,
  and compatibility consumers MUST continue to function from authoritative or
  derived state.
- **FR-016**: State ownership checks MUST reject normal-runtime writes to
  physical compatibility fields outside the authoritative synchronization
  boundary.

### Editor UI Contract Alignment

- **Canonical spec impact**: No editor shell, menu, or layout change; Race,
  Level, and Car playtest behavior changes only in vehicle simulation.
- **Shell/layout contract impact**: Unchanged.
- **Mode impact**: Portrait, landscape touch, desktop, and gamepad editor
  layouts remain unchanged.
- **Shared helper impact**: Existing input semantics remain shared; no new
  editor-specific layout branch is required.

### Key Entities

- **Authoritative Vehicle State**: Complete pose, motion, wheel, suspension,
  tire, powertrain, contact, collision, and assist state at a fixed boundary.
- **Physical Contribution**: A force, moment, or impulse with source,
  magnitude, direction, application point, and fixed-step timestamp.
- **Handling Preset**: Simulation, Sport, or Accessible policy defining
  permitted physical interventions.
- **Compatibility Output**: Read-only legacy field derived from authoritative
  state for existing rendering, camera, audio, UI, and test consumers.
- **AI Simulation Residency**: Visible/full-rate, reduced-rate, or sleeping
  status with continuity requirements for transitions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Ownership instrumentation finds exactly one writer for 100% of
  physical pose, velocity, wheel, suspension, tire, and powertrain fields
  during ordinary Race, Level, and Car playtests.
- **SC-002**: All twelve required trajectories produce identical final state,
  telemetry, and replay output at all five supported render rates.
- **SC-003**: Removing all tire force produces no tire-driven acceleration or
  turning, proving the trajectory is force-derived.
- **SC-004**: Simulation mode records zero stabilization interventions in every
  validation maneuver.
- **SC-005**: Sport and Accessible modes record 100% of applied interventions
  without any direct pose or velocity assignment.
- **SC-006**: Visible player and AI vehicles produce equivalent physical
  response from equivalent state, controls, vehicle configuration, and surface.
- **SC-007**: Static and runtime checks find zero ordinary planar followers and
  zero ordinary uses of planar-position preservation.
- **SC-008**: Existing race completion, camera, damage, replay, Track State,
  editor, AI, and supported browser validation remain green.

## Assumptions

- Sport is the default migration preset to preserve polished controller feel;
  existing accessibility-oriented recovery maps into Accessible.
- Compatibility fields remain temporarily available as read-only derived data
  while consumers migrate.
- Respawn, explicit reset, editor placement, replay restore, and teleport-like
  authored travel are state replacement boundaries rather than normal driving.
- Collision detection may remain outside the runner initially, provided it
  submits deterministic physical impulses rather than setting trajectory.
- Performance sleeping is limited to AI outside visible interaction and
  collision relevance.
- No new vehicle content, weather, editor UI, or unrelated handling feature is
  included.
