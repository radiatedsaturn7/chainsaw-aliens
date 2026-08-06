# Race simulation architecture

`RaceEditor` owns editor lifecycle, input collection, asset lookup, rendering,
and the compatibility methods used by older tests and callers. It creates one
frozen `RaceSimulationSystems` registry and passes that registry, the current
input, and the authoritative playtest session to `RaceSimulation`.

The playtest session is the single authoritative vehicle aggregate. Its nested
`vehicle3d` object is the chassis component; legacy session pose fields are
derived compatibility outputs and must not become a second independently
integrated vehicle.

Subsystem responsibilities:

- `ChassisIntegrator`: rigid-body/chassis integration, load transfer, yaw,
  wheel poses, vertical motion, roll, and 3D contact stepping.
- `TireModel`: load sensitivity, friction-circle capacity, slip relaxation,
  pressure, temperature, wear multipliers, and surface grip.
- `SuspensionModel`: ride height/travel/rates and bump-load modulation.
- `PowertrainModel`: gears, torque, engine braking, driven wheels, and
  differential/traction allocation.
- `BrakeModel`: brake demand, ABS, wheel lock, and applied wheel force.
- `AeroModel`: downforce, drag, rolling resistance, and grade projection.
- `SurfaceModel`: canonical static geometry/material sampling, exact wheel
  contact adapters, and the public Track State integration boundary.
- `DamageModel`: normalized damage state, damage effects, wear, and collision
  damage updates.
- `HandlingAssist`: steering response, self-alignment, setup modifiers, and
  traction-control state transitions.

Subsystem methods accept plain values/objects and return values or explicit
next-state records. Persistent mutable state remains in the playtest session,
not in subsystem instances.

## Dynamic Track State

Each running race session owns one `TrackState` instance. It is a sparse,
one-meter world grid whose cells initialize from `SurfaceModel` geometry and
material samples. Road, apron, shoulder, and terrain therefore use the same
data-driven cell model; no race-specific surface script owns grip.

Track State advances at an authoritative 100 ms fixed interval. Weather
forcing is derived once from authored race weather and then evaluated per
active cell using local material, elevation, drainage, sun, and wind
properties. Standing-water flow uses a two-phase deterministic transfer so
iteration order cannot create or destroy water.

The player and AI both queue step-indexed tire-contact events after resolved
wheel load, contact, and slip are known. Swept contact paths visit every
crossed cell. Airborne wheels do not sample or mutate dynamic cells. Tire
events lay rubber, heat/compact the surface, displace water and loose
material, and carry dirt or mud; damage records queue debris/oil events at the
vehicle's physical world position.

`TrackState` is the sole owner of dynamic surface mutation. `RaceSimulation`
advances it and queues player/crash events, `RaceAiSimulation` consumes the
same local samples and queues AI traffic, and `RaceEditor` only owns session
lifecycle, debug visualization, snapshot handoff, and transport adapters.

Snapshots are versioned and canonically ordered. Replay records contain the
initial snapshot, applied event stream, weather timeline, final snapshot, and
checksums. Snapshot/event/checksum packets are transport-neutral so a future
multiplayer transport can synchronize the same authoritative state without
depending on rendering state.

## Physics incident capture

`PhysicsIncidentRecorder` is a dormant-by-default diagnostic attached to every
`VehicleDynamicsRunner`. An armed capture keeps a bounded two-second 360 Hz
ring and automatically opens an incident on suspension reach loss, compression
overflow, body penetration, emergency recovery, or a repeated recovery region.
The post-roll is three seconds, producing a five-second deterministic fixture.

Race capture is armed only by setting
`globalThis.__RTG_CAPTURE_PHYSICS_INCIDENTS__ = true` before the runner is
created. This keeps normal gameplay free of recorder allocation and query-copy
cost. `tools/capture-studio-sprint2-physics-incident.mjs` performs that setup,
loads the exact saved Studio Sprint 2 and WRX2 documents, and writes the compact
fixture. The generated JSON stores packed substep frames, deduplicated exact
tire/body surface samples, the swept prepared triangles, source and replay
checksums, and the physical vehicle configuration.

## Full-bump terrain support

All authoritative terrain queries cross the `SurfaceSample` boundary. A sample
is either explicitly valid—with physical height, normalized normal, region,
source, triangle identity, and query position—or explicitly invalid with a
reason. Missing and non-finite terrain is never coerced into a zero-metre
surface.

Wheel contact distinguishes missing terrain, terrain below droop reach,
airborne proximity, ordinary suspension support, full-bump support, sidewall
geometry, wrong-side support, and body occlusion. Terrain above the suspension
travel limit clamps hub compression but remains load-bearing. The excess is
reported as overtravel and resolved by tire vertical compliance, progressive
bump-stop load, and a mechanical hard-stop load at the physical tread point.

Tread projection resamples the same prepared surface up to three times until
height changes by less than one millimetre and normal changes by less than half
a degree. Body bottoming remains a separate compound-body constraint. Its
split stabilizer may translate and rotate the pose without changing velocity,
so a chassis straddling a convex crest pitches onto its support manifold rather
than requiring a large vertical correction or an emergency route recovery.

## Swept wheel-cylinder collision

Every tire also owns a finite-width collision cylinder that is distinct from
its powered lower-tread patch. The cylinder is swept from the previous to the
proposed 360 Hz wheel pose. A bounded radial-and-width support set catches
leading tread, partial-width, and sidewall contact at the earliest prepared
terrain triangle or authoritative height transition; flat terrain takes a
cheap prepared-surface broadphase path.

Cylinder contacts enter the chassis manifold as physical normal and friction
impulses at their actual wheel point. They never receive drive torque or the
body solver's positional lift. Once terrain rotates beneath the tire and the
ordinary lower tread becomes valid, propulsion and lateral tire force return
to `ContactPatchTireModel`. Triangle identity, terrain source, width fraction,
time of impact, and the separate wheel-cylinder impulse are retained in fixed-
step telemetry.

## Catastrophic penetration recovery

Recovery runs only after sweep rollback, tire/full-bump support, the iterative
body manifold, and bounded split-impulse stabilization have failed. Residual
penetration above the normal contact tolerance is tracked once per complete
chassis step; it cannot trigger recovery from a single 360 Hz contact pass.
Immediate recovery is reserved for deep penetration, invalid authoritative
terrain, non-finite state, or a body below the terrain envelope without a valid
wheel/body manifold.

Each active failure has a stable incident identity derived from quantized world
and route regions, authoritative triangle IDs, contact features, terrain
sources, and the vehicle body profile. Every selected recovery source and known
failed swept path remains blacklisted until the car has remained clear for the
configured duration and travelled the configured distance away. An incident
may use one verified historical state, then one terrain-aligned route pose; a
further failure stops at another verified safe pose and records a hard failure.

Recovery velocity is projected onto the blocking surface tangent and capped at
the low recovery-speed limit. Repeated incidents restore zero velocity and
clear pitch/roll angular rate. Route recovery preserves verified historical
distance, tries the nearest valid projection, and searches backward without
ever interpreting a missing projection as route distance zero.
