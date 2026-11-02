# Shared load-time AI road plan

`RaceAiRoadPlan.js` builds transient data during race startup, before countdown.
The data belongs to the playtest session, not to a car or a persisted race file.
Restarting after editing/loading/reversing a track builds a new plan. There is no
track-name check or preselected car specification.

The selected route is sampled at intervals of at most eight metres. Shared arrays
hold conservative nearby curvature, usable road half-width, slope and a
steep/narrow-road risk hint. The authored centerline remains the reference path;
this is a safe corridor hint, not an optimal racing-line solver or a complete
cliff classifier. Exact steering target geometry and live support/collision
validation remain authoritative.

A backward pass builds a braking envelope around corners. Circuit profiles
propagate across the start seam; destination finishes are crossed at speed.
The envelope stores squared speed divided by lateral acceleration. Changing
weather or tire grip scales it immediately instead of rebuilding an entire
track-sized speed table. Braking/cornering ratios select conservatively rounded
profiles; common ratios are warmed during loading, and at most 16 are retained.
Exceptional routes exceeding 131,072 samples fall back to online planning rather
than using dangerously coarse geometry or unbounded allocation.

Each decision applies current road grip, tire grip, driver corner/brake settings,
car brake-force/mass capability, and mechanical brake effects. Current power and
setup still supply the top-speed cap. Faster/slower cars are never forced to
match a prerecorded trajectory. Gear choice, hill-launch force, engine damage,
traction, collision response and actual acceleration remain in the existing
controllers/physics. The cached grade saves a geometry query for hill-launch
feed-forward; this is not a baked throttle schedule. Nearby traffic still
reduces the target speed immediately.

`debugAiNoRoadPlan` (benchmark environment `RTG_AI_NO_ROAD_PLAN=1`) retains online
planning for controlled comparisons. `benchmark-ai-road-plan.mjs` isolates driver
planning on a fixed synthetic 8 km route; it does not measure rendered FPS.
`benchmark-mountain-stress.mjs` records the plan sample/profile counts alongside
full simulation measurements. Current validation/results are in
`mount-washington-stress.md`.

## Validation

106 AI tests and 35 startup/preparation tests pass. Tests cover live tire/brake
changes, slower cars, mechanical brake failure, shared geometry, bounded profile
storage, circuit wrapping, finish crossing and fresh-session invalidation.
A same-source 120-second Mount Washington comparison with 29 AI measured median
simulation updates of 45.83 ms online and 38.87 ms precomputed; all 29 cars ended
moving in the precomputed run. This is Node simulation timing, not browser FPS.
See the stress report for the complete comparison and remaining limitations.
