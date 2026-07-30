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
