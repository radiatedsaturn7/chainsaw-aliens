# Research: Dynamic Track State

## Decision: Sparse one-meter world grid

**Decision**: Use integer world-meter X/Z cells stored sparsely. Initialize a
cell from the existing canonical surface sampler when it is first observed or
affected, and activate neighbors only for actual fluid/material frontiers.

**Rationale**: This gives every square meter an independent identity while
avoiding per-step traversal of unused world regions. It works for circuits,
stages, terrain, shoulders, and city-style surfaces because initialization
comes from geometry/material data rather than track scripts.

**Alternatives considered**:

- Dense track-wide arrays: simple and exact, but prohibitively expensive for
  large tile maps and destination stages.
- Spline-distance strips: efficient for roads, but cannot naturally cover
  off-road terrain or city intersections.
- Variable-size quadtree cells: efficient but violates the one-square-meter
  interaction requirement and complicates deterministic transfers.

## Decision: Fixed 100 ms authoritative environment steps

**Decision**: Accumulate render delta and advance at 10 deterministic steps per
second, with at most five catch-up steps in one rendered frame.

**Rationale**: Weather, thermal, drainage, and gradual material evolution do not
need 60 Hz updates. Ten hertz gives stable fluid behavior, bounded cost, and
frame-rate independence. Tire contacts are queued with the next fixed-step
index so input ordering is explicit.

**Alternatives considered**:

- Render-frame stepping: directly violates replay determinism.
- 60 Hz full-grid stepping: too expensive and unnecessary.
- Variable adaptive steps: makes event ordering, checksums, and multiplayer
  synchronization difficult.

## Decision: Two-phase water flow and event-ordered material transfers

**Decision**: Compute downhill water outflows from an immutable view of the
current step, accumulate deltas, then commit them in stable cell and neighbor
order. Tire-driven loose-material displacement is conserved within each
stably ordered contact event.

**Rationale**: In-place flow depends on iteration order. A two-phase update
preserves mass, prevents negative depths, and is straightforward to verify.

**Alternatives considered**:

- In-place downhill flow: faster but order-dependent and non-deterministic.
- Full fluid solver: unnecessary complexity for gameplay-scale puddles.

## Decision: Deterministic rotating cell budget

**Decision**: Process at most a configured number of persistent cells per
100 ms step using a snapshot-persisted stable cursor. Cells sampled between
turns catch up from the authoritative weather timeline.

**Rationale**: A sparse map alone still grows into an unbounded whole-track
scan late in a race. Rotating deterministic work preserves state while
preventing recurring simulation stalls.

**Alternatives considered**:

- Update every allocated cell: simple but creates late-race periodic stalls.
- Drop old cells: fast but violates persistence and replay.
- Render-distance-only updates: makes results camera-dependent.

## Decision: Deterministic quantized numbers and stable ordering

**Decision**: Quantize persistent values to six decimal places at mutation
boundaries. Sort canonical cells and events by integer coordinates and stable
identity fields. Use a stable UTF-8 FNV-1a checksum over canonical JSON.

**Rationale**: Browser JavaScript uses consistent IEEE-754 arithmetic, but
quantization prevents tiny accumulation differences from becoming visible
state divergence. Stable ordering makes snapshots byte-comparable.

**Alternatives considered**:

- Typed fixed-point storage: strongest determinism but substantially harder to
  integrate with current physics units and debug output.
- Unquantized floats: easier but fragile for long replay/multiplayer sessions.
- Cryptographic hashing: unnecessary for divergence detection and slower in a
  synchronous browser loop.

## Decision: Data-driven material profiles

**Decision**: Define base thermal, permeability, drainage, roughness, loose
material, and exposure defaults by normalized surface/material ID, with a
generic fallback.

**Rationale**: Existing race documents already identify material and region.
Profiles let all tracks participate automatically while preserving authored
geometry as elevation authority.

**Alternatives considered**:

- Per-track scripts: explicitly prohibited by the feature.
- Hard-coded weather surface substitutions: current behavior is global and
  cannot express local evolution.

## Decision: Swept tire-contact events with carry state

**Decision**: Rasterize the line from each wheel's previous grounded contact to
its current contact and distribute a normalized event over every crossed cell.
Maintain dirt/mud carry by stable vehicle/wheel key inside Track State.

**Rationale**: Sampling only a frame endpoint skips cells at speed. Carry state
is necessary for gradual dirt/mud trails and must be part of deterministic
snapshots.

**Alternatives considered**:

- Endpoint-only mutation: violates the exact local/traversed-cell requirement.
- Vehicle-center tracks: conflicts with physical tire locations.

## Decision: AI candidate scoring with hysteresis

**Decision**: Sample center and lateral alternatives over several look-ahead
distances, scoring grip minus water, ice, oil, loose material, debris, and
steering distance. Require a meaningful score advantage and a one-second
cooldown before switching.

**Rationale**: It responds to the real evolving state but avoids oscillation
when paths are nearly equal. No candidate receives a predefined grip bonus.

**Alternatives considered**:

- Static racing line: explicitly prohibited.
- Always choose the highest instantaneous sample: unstable and visually poor.
- Global segment grip: misses local puddles and contamination.

## Decision: Snapshot/event/checksum synchronization contract

**Decision**: Provide transport-neutral APIs for full initial snapshots,
step-indexed event batches, periodic checksum packets, and restoration. Ghosts
record the Track State initial snapshot, ordered events, and final checksum.

**Rationale**: The repository does not currently have a race multiplayer
transport. A pure contract makes deterministic evolution available to replay
and any present/future transport without inventing networking infrastructure.

**Alternatives considered**:

- Serialize full state every frame: too large and slow.
- Synchronize derived grip only: cannot reproduce material evolution.
- Couple to a new WebSocket service: violates the static-browser constraint
  and exceeds the requested domain.
