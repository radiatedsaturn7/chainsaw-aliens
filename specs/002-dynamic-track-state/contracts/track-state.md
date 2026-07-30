# Track State Interface Contract

All interfaces accept and return plain deterministic data. They do not read
wall-clock time, rendering state, or unordered external collections.

## Session lifecycle

### `createTrackState(options) -> TrackState`

Required options:

- deterministic `seed`;
- `sampleBaseSurface(worldPoint)` adapter returning material, region,
  elevation, normal, and base friction.

Optional options:

- fixed-step interval;
- profile overrides;
- initial snapshot;
- event-history limit.

### `advance(deltaSeconds, weatherForcing) -> AdvanceResult`

Accumulates render time and executes zero or more fixed steps.

Result:

- completed step count;
- current `stepIndex`;
- active-cell/event counts;
- conservation deltas;
- whether catch-up remains.

### `sample(worldPoint, options) -> LocalSurfaceSample`

Samples the exact one-meter cell containing `worldPoint`. Sampling may lazily
initialize the cell but does not otherwise mutate material state.

## Mutation events

### `queueEvent(event) -> eventId`

Normalizes, quantizes, and queues an event at an explicit step. Missing sequence
values are assigned by the authoritative session before serialization.

### `queueTireContact(contact) -> eventIds[]`

Ignores airborne/non-contact tires. Rasterizes a swept contact into stable
per-cell events.

### `queueCrashContamination(crash) -> eventId`

Queues persistent debris and optional oil at a physical world location.

## Determinism and synchronization

### `createSnapshot() -> CanonicalSnapshot`

Returns a versioned, stable-order, JSON-compatible authoritative snapshot.

### `restoreSnapshot(snapshot) -> TrackState`

Validates and restores a canonical snapshot. Invalid snapshots throw without
partially changing an existing session.

### `getChecksum() -> string`

Returns a stable checksum for the current canonical payload.

### `createSyncPacket(kind, options) -> TrackStateSyncPacket`

Produces a snapshot, ordered event batch, or checksum packet.

### `applySyncPacket(packet) -> SyncResult`

Applies valid snapshot/events packets idempotently or reports checksum
agreement/divergence. It performs no network operation.

### `createReplayRecord() -> TrackStateReplay`

Returns the canonical initial snapshot/checksum, applied deterministic events,
weather-forcing timeline, final step/checksum, and a final canonical snapshot.
Playback may reconstruct from the initial data or restore the final snapshot
directly without reading render state.

## AI observation

### `evaluateTrackStateCandidates(options) -> CandidateDecision`

Inputs:

- route/world-pose sampler;
- current distance and line;
- candidate lateral offsets;
- look-ahead distances;
- current step and prior decision/cooldown.

Outputs:

- stable candidate scores and observations;
- chosen offset;
- grip/risk scale;
- whether a switch occurred;
- next permitted switch step.

No candidate receives a predefined racing-line grip bonus.

## Rendering/debug

### `getDebugState(options) -> DebugTrackState`

Returns current step, cell/event counts, checksum, conservation totals, and
optionally cells within world bounds.

### `getVisualCells(bounds) -> VisualCell[]`

Returns active cells intersecting world bounds with wetness, rubber, loose
material, snow, ice, oil, debris, and a compositing tint. The result is derived
and cannot mutate Track State.
