# Feature Specification: Dynamic Track State

**Feature Branch**: `staging`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Implement a dynamic Track State simulation where every square meter of the racing surface evolves independently throughout a session."

## User Scenarios & Testing

### User Story 1 - Tires Feel the Exact Local Surface (Priority: P1)

As a driver, every tire responds to the evolving one-square-meter surface cell
directly beneath its physical contact patch, so grip and resistance change
locally rather than applying one value to the whole track segment.

**Why this priority**: Local tire interaction is the foundation that makes all
other Track State changes affect gameplay.

**Independent Test**: Place different contamination and moisture values in
adjacent cells, drive individual wheels across their boundary, and verify each
wheel reports and uses the state of its own contact cell.

**Acceptance Scenarios**:

1. **Given** four tires are over cells with different grip-affecting state,
   **When** the vehicle physics step runs, **Then** each tire receives a
   different deterministic local surface sample.
2. **Given** a tire is not in contact with the ground, **When** the simulation
   advances, **Then** it neither reads ground grip nor changes a surface cell.
3. **Given** a road, terrain, apron, or shoulder cell, **When** a tire contacts
   it, **Then** the same Track State rules apply without track-specific scripts.

---

### User Story 2 - Weather Evolves Every Cell (Priority: P1)

As a driver, I encounter locally changing temperature, moisture, puddles, snow,
and ice because weather, elevation, drainage, sun, wind, and neighboring cells
affect each square meter independently.

**Why this priority**: Weather must produce spatially meaningful conditions
rather than a global grip multiplier.

**Independent Test**: Apply identical rain to cells with different elevation,
drainage, sun, and wind values and verify pooling, runoff, evaporation, snow,
and ice diverge predictably while conserving transferred water.

**Acceptance Scenarios**:

1. **Given** rain falls on connected cells, **When** Track State advances,
   **Then** water accumulates and flows toward lower neighbors according to
   elevation and drainage.
2. **Given** wet cells with different sun and wind exposure, **When** rain
   stops, **Then** they dry at different deterministic rates.
3. **Given** water or snow and freezing surface temperatures, **When** the
   simulation advances, **Then** local ice forms; when warmed, it melts back
   into water.
4. **Given** a dry rubbered cell and a wet rubbered cell, **When** sampled,
   **Then** the dry cell gains grip while the wet cell becomes comparatively
   slippery.

---

### User Story 3 - Traffic Creates a Natural Racing Line (Priority: P1)

As racers drive, their tires lay rubber, displace water, sweep marbles, and
move dirt or mud, so a faster line emerges from traffic instead of from a
predefined racing-line mask.

**Why this priority**: Vehicle traffic is the primary mechanism that turns the
surface into a living strategic system.

**Independent Test**: Run repeated deterministic laps on one path and compare
it with unused neighboring cells; the traveled cells must become more rubbered,
drier, and cleaner while displaced material appears in plausible neighboring
cells.

**Acceptance Scenarios**:

1. **Given** repeated dry tire traffic, **When** tires follow the same path,
   **Then** rubber accumulates in the contacted cells and dry grip increases.
2. **Given** standing water, **When** a tire passes through, **Then** water is
   displaced from the contact cell into deterministic neighboring cells.
3. **Given** marbles on the driven path, **When** tires pass over them,
   **Then** the path is swept and marbles move away from the tire trajectory.
4. **Given** a tire transitions from dirt or mud to pavement, **When** it
   continues driving, **Then** it deposits a diminishing trail of carried
   material onto subsequent cells.
5. **Given** a crash with debris-producing damage, **When** the crash is
   recorded, **Then** persistent local debris contamination remains at the
   crash location and affects later tires.

---

### User Story 4 - AI Adapts to Evolving Grip (Priority: P2)

As a player racing AI, I see opponents choose lines and speeds based on current
surface observations rather than always following a static ideal path.

**Why this priority**: A dynamic surface is strategically meaningful only when
other drivers respond to it.

**Independent Test**: Create two viable paths where the initially preferred
path becomes wet or contaminated and verify AI samples both, selects the
better predicted-grip path, and later returns when conditions reverse.

**Acceptance Scenarios**:

1. **Given** multiple reachable lines through an upcoming section, **When** AI
   evaluates them, **Then** it incorporates current local grip, standing water,
   loose material, and contamination.
2. **Given** a line changes condition during the race, **When** AI next reaches
   its observation window, **Then** its target line and safe speed adapt without
   requiring authored racing-line changes.
3. **Given** uncertain or nearly equal conditions, **When** AI chooses a line,
   **Then** it remains stable enough to avoid frame-to-frame line oscillation.

---

### User Story 5 - Sessions Reproduce the Same Surface (Priority: P2)

As a replay or multiplayer participant, I experience the same evolving Track
State when the same initial state and ordered events are simulated.

**Why this priority**: Deterministic state is required for trustworthy replays,
multiplayer synchronization, debugging, and saved session continuity.

**Independent Test**: Advance two Track State instances from identical initial
snapshots using the same fixed-step weather, tire, and crash event stream, then
compare their canonical serialized snapshots and checksums.

**Acceptance Scenarios**:

1. **Given** identical initial data and event order, **When** two simulations
   advance for the same fixed steps, **Then** their cell values and checksums
   remain identical.
2. **Given** a Track State snapshot, **When** it is serialized, restored, and
   advanced, **Then** it matches an uninterrupted simulation.
3. **Given** a remote or replay event arrives with a deterministic step index,
   **When** it is applied, **Then** all peers apply it in the same ordering.
4. **Given** any supported race surface and terrain data, **When** a race
   starts, **Then** Track State initializes automatically from that data.

### Edge Cases

- Cells outside the active race world remain unallocated until sampled or
  affected, without changing results for active cells.
- Water at the world boundary drains out only when the source surface data
  identifies an open drainage boundary; otherwise it remains conserved.
- A cell with missing metadata receives deterministic defaults derived from its
  base material and geometry.
- Multiple tires or vehicles touching one cell in the same simulation step are
  accumulated in stable event order before state is clamped.
- A tire crossing several cells during one step affects every traversed cell
  rather than only the final cell.
- Snow, ice, water, and mud transitions never produce negative material depth.
- Pausing a race does not advance Track State; resuming continues from the same
  deterministic step.
- Large time deltas are resolved as bounded fixed steps so results do not
  depend on rendering frame rate.
- Corrupt or version-incompatible snapshots fail safely and fall back to a
  fresh state rather than partially applying data.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST represent racing-surface state at a spatial
  resolution of one square meter or finer.
- **FR-002**: Each active cell MUST persist surface temperature, moisture depth,
  standing water depth, rubber accumulation, loose marbles, dust, dirt, mud,
  oil contamination, snow accumulation, ice formation, surface roughness,
  drainage rate, sun exposure, and wind exposure for the session.
- **FR-003**: Cell initialization MUST derive from existing surface material,
  terrain/road geometry, elevation, authored weather, and deterministic
  defaults without circuit-specific scripts.
- **FR-004**: Track State MUST cover road, apron, shoulder, terrain, dirt road,
  rally stage, circuit, and city-street surfaces through one data-driven model.
- **FR-005**: Weather forcing MUST be evaluated independently for every active
  cell.
- **FR-006**: Rain MUST add moisture and standing water according to local
  intensity, permeability, elevation, saturation, and drainage.
- **FR-007**: Standing water MUST flow downhill into neighboring cells using a
  deterministic, mass-conserving transfer step.
- **FR-008**: Surface temperature MUST evolve from ambient conditions, sun,
  wind, precipitation, base material, and tire energy.
- **FR-009**: Wind and sun exposure MUST influence drying, cooling, snow melt,
  and ice melt independently per cell.
- **FR-010**: Snow MUST accumulate under appropriate precipitation and
  temperature conditions and MUST compact, melt, or convert to ice according
  to local conditions and tire traffic.
- **FR-011**: Ice MUST form from local water or compacted snow under freezing
  conditions and melt back into water when warmed.
- **FR-012**: Rubber MUST increase dry grip and MUST reduce wet grip relative to
  an otherwise equivalent unrubbered wet cell.
- **FR-013**: Marbles, dust, dirt, mud, oil, snow, ice, water, roughness, and
  debris MUST contribute independently to a cell's effective tire grip and
  rolling resistance.
- **FR-014**: Every grounded tire MUST sample the exact local Track State at its
  physical contact point during the vehicle physics step.
- **FR-015**: Airborne tires MUST NOT heat, sweep, deposit on, displace, or
  otherwise modify Track State.
- **FR-016**: Tires MUST lay rubber based on contact load, slip energy, compound,
  speed, and traveled distance.
- **FR-017**: Tires MUST displace water and loose material along and across
  their travel direction while conserving transferred material except for
  explicit drainage, evaporation, or material shedding.
- **FR-018**: Tires MUST sweep marbles from frequently traveled cells.
- **FR-019**: Tires MUST pick up dirt and mud from contaminated cells and
  deposit a diminishing carried load on later contacted cells.
- **FR-020**: Crash events MUST be able to leave persistent debris and fluid/oil
  contamination at their physical world locations.
- **FR-021**: The ideal dry or wet racing line MUST be an emergent consequence
  of cell evolution and traffic, not a predefined grip modifier.
- **FR-022**: AI MUST sample Track State along multiple reachable candidate
  lines and use current grip and risk to adapt line choice and target speed.
- **FR-023**: AI line adaptation MUST use hysteresis or an equivalent stability
  rule to avoid rapid oscillation between near-equal paths.
- **FR-024**: Track State evolution MUST use fixed, explicitly indexed
  simulation steps independent of rendering frame rate.
- **FR-025**: All Track State mutation inputs MUST be represented as
  deterministic, orderable events or deterministic environmental forcing.
- **FR-026**: Track State MUST support a versioned canonical snapshot containing
  initialization metadata, fixed-step index, active cell state, and pending
  deterministic events.
- **FR-027**: Canonical snapshots MUST serialize cells and events in stable
  order and support a deterministic checksum.
- **FR-028**: Restoring a canonical snapshot and replaying the same subsequent
  events MUST reproduce the uninterrupted Track State.
- **FR-029**: Multiplayer synchronization MUST be able to exchange initial
  snapshots, step-indexed events, and periodic checksums without relying on
  rendering state.
- **FR-030**: Track State MUST remain session-persistent across pause, replay
  recording/playback, and supported race travel transitions until the session
  is explicitly reset.
- **FR-031**: The system MUST allocate and update cells sparsely so inactive
  world regions do not incur per-step work.
- **FR-032**: The simulation MUST bound per-frame work and preserve responsive
  race play by processing environmental evolution at deterministic fixed
  intervals and prioritizing active regions.
- **FR-033**: Debug and test interfaces MUST expose local cell state, effective
  grip, fixed-step index, event counts, checksum, and material conservation
  totals without changing simulation results.

### Editor UI Contract Alignment

- **Canonical spec impact**: No editor shell, menu, typography, or layout change
  is required. Any later visualization must be additive to the existing race
  physics debug view and separately specified against `UISpec.md`.
- **Shell/layout contract impact**: Unchanged.
- **Mode impact**: Portrait, landscape touch, desktop, and gamepad editor
  behavior remain unchanged.
- **Shared helper impact**: No new editor-specific layout branch is permitted
  for this feature.

### Key Entities

- **Track State Session**: The authoritative evolving surface for one race,
  including schema version, seed, fixed-step index, active cells, pending
  events, and checksum metadata.
- **Track State Cell**: One spatial square containing persistent material,
  thermal, exposure, geometry, drainage, and derived grip state.
- **Base Surface Profile**: Data-driven material defaults used to initialize
  cells for asphalt, wet asphalt, gravel, dirt, mud, snow, grass, metal, and
  other supported surfaces.
- **Track State Event**: A deterministic, step-indexed mutation such as tire
  contact, crash debris, oil spill, or synchronized remote input.
- **Tire Contact Event**: A swept world-space contact carrying wheel identity,
  load, slip energy, compound, velocity, and carried dirt/mud.
- **Weather Forcing**: The deterministic ambient temperature, precipitation,
  wind, sun, and snow conditions evaluated for a fixed step.
- **Local Surface Sample**: The exact cell-derived grip, resistance, depth,
  contamination, and material values consumed by tire or AI physics.
- **Canonical Snapshot**: A stable, versioned serialization of authoritative
  Track State used by replay, save/restore, multiplayer, and determinism tests.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a four-wheel boundary test, 100% of grounded tires consume the
  state of the correct one-square-meter cell and airborne tires produce no
  surface mutations.
- **SC-002**: In deterministic rain tests, total water after each step equals
  prior water plus precipitation minus drainage and evaporation within a
  relative error of 0.1%.
- **SC-003**: Repeated traffic produces a measurable emergent line: after 20
  dry laps, contacted cells have at least 20% more rubber and less loose
  material than equivalent untraveled neighboring cells.
- **SC-004**: In wet-line testing, AI selects a safer alternate path within one
  observation window after its current path loses at least 15% effective grip,
  without switching more than once per second.
- **SC-005**: Two simulations using identical initial snapshots and 10,000
  ordered events produce byte-identical canonical snapshots and matching
  checksums.
- **SC-006**: Snapshot restore followed by 5,000 additional events produces the
  same final checksum as an uninterrupted simulation.
- **SC-007**: Track State automatically initializes and operates on every
  built-in race type and supported base material with no per-track behavior
  script.
- **SC-008**: A representative race session maintains its existing target frame
  rate with Track State enabled, with no recurring half-second stalls and no
  single Track State update exceeding the available simulation-frame budget in
  the performance test fixture.
- **SC-009**: A player can observe distinct strategic dry, wet, dirty, snowy,
  icy, and oil-contaminated handling outcomes at the exact affected locations.

## Assumptions

- One world unit in race geometry can be converted consistently to meters; cell
  coordinates use that existing world-space convention.
- The first implementation uses deterministic fixed-step simulation and sparse
  active cells rather than continuously updating every possible world cell.
- Existing race weather definitions supply precipitation type/intensity;
  deterministic ambient temperature, sun, and wind defaults fill missing data.
- Existing road and terrain sampling remain the geometric authority for base
  elevation and material.
- Tire compounds use existing car setup data, and crash contamination uses
  existing damage/collision events.
- Multiplayer may not yet provide a complete transport layer; this feature
  must provide deterministic snapshot/event/checksum contracts that a present
  or future transport can carry.
- Visual puddle, rubber, dirt, snow, and debris rendering is desirable but is
  secondary to correct physical state, determinism, and exposed render data.
