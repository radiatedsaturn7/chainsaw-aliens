# RTG Studio Race And Car Editor Spec

This is the staged plan for adding SNES-style Mode 7 racing to the metroidvania.

## Product Shape

- `Race Editor`: creates circuit, point-to-point, destination, and chained races.
- `Car Editor`: creates car definitions, layered car art, turn animations, tire animation, spoilers/body attachments, drivetrain, and tuning.
- `Level Editor` integration: a `drive` trigger loads a race and defines finish behavior: return to origin, load level/room, load another race, or chain to a destination.
- Race Editor playtest starts by asking which Car Editor car to drive, then launches the race with that car, current race rules, enabled AI racers, hazards, and co-driver calls.
- Playtest must also support solo route testing with no opponents, AI race packs with driver/car selection, and combat route testing with attack entities and damage obstacles.

## Race Data

- Road is a sequence of segments with length, curve, elevation, width, surface, and optional square-turn hints.
- Surface can be color-striped Mode 7 style or repeated from a tile/sprite texture.
- Race supports weather, scenery sprites, checkpoint gates, laps, and finish behavior.
- Competition mode can be solo, AI race, combat run, or mixed.
- AI drivers reference Car Editor cars and include skill, aggression, rubber-band assist, and enabled state.
- Hazards include attack entities such as zombie packs, hard jumps, hairpin/square-turn danger zones, damage walls, traffic, destructibles, and other race-local obstacles.
- Co-driver instructions are timed/distance-based calls with severity, text, and optional segment links.
- Race segment metadata should support editor-visible difficulty notes for hairpins, jumps, wall impact zones, surface changes, and co-driver call placement.
- Vertical sprites are placed on either side of the road and projected by camera depth to create speed.

## Car Data

- Drivetrain: RWD, FWD, AWD.
- Tuning targets: power, weight, tires, brake balance, gearing/final drive, differential accel/decel, aero front/rear, springs, damping, anti-roll, ride height, alignment, and assist presets.
- Art layers: shell, tires, shadows, brake lights, spoilers, and turn frames.

## Runtime Plan

- Rendering: canvas pseudo-Mode 7 projection with horizon, road scanlines, surface texture repeat, side scenery sprites, weather overlay, and car sprite composition.
- Physics: deterministic 2D vehicle model using longitudinal/lateral slip, weight transfer approximation, drivetrain torque split, surface grip, braking, steering response, aero downforce, and tuning modifiers.
- Playtest: Race Editor opens a car picker using Car Editor car data, then starts a local race session with selected car, race hazards, enabled AI racers, and co-driver calls.
- Current playtest pass runs through the shared handheld race surface: it advances speed/distance from selected car tuning, supports steering, gear shifts, throttle, brake, handbrake, pause, camera switching, route progress, next co-driver call, next hazard, and AI count.
- Race logic: support no-opponent time/destination drives, FH-style AI race packs, and combat routes with Carmageddon-style attack entities and damage obstacles.
- Game integration: `drive` trigger stores the player origin, enters racing state, runs race completion, then executes finish behavior.
- AI runtime: each AI racer gets a route-following controller, target speed model, pass/block behavior, recovery logic, and optional rubber-band tuning so races can feel competitive without requiring opponents.
- Hazard runtime: race-local hazards can damage, slow, push, attack, or destroy cars, and the race editor should preview their trigger zones before playtest.
- Co-driver runtime: calls are queued by distance/segment progress and surfaced during playtest through text first, with voice/audio hooks later.

## Implementation Stages

1. Scaffold Race Editor, Car Editor, shared data contracts, and main menu entries.
2. Add persistent race/car project storage and editor controls for segment/car/tuning edits.
3. Add Race Editor playtest runtime: car picker, selected car session boot, solo/AI/combat toggles, hazard spawning, co-driver text calls, and return-to-editor.
4. Add runtime racing state with Mode 7 renderer and placeholder arcade physics.
5. Replace placeholder physics with drivetrain/surface/tuning simulation.
6. Add Level Editor `drive` trigger and finish behavior routing.

## Current Scaffold

- Race and Car Editor are available under the main Game menu.
- Race and Car Editor use shared desktop, portrait, landscape, and gamepad menu surfaces.
- Race data includes surfaces, competition mode, optional AI drivers, hazards, scenery, and co-driver calls.
- Playtest opens a car picker and starts a visible handheld race surface containing the selected car, enabled AI racers, hazards, and co-driver calls.
- Mobile playtest uses the shared portrait Game Boy-style and landscape Game Gear-style shells, with d-pad/analog steering, gear shifting, G throttle, R brake, double-tap R handbrake, pause, and first/third-person camera switching.
- The current playtest has player steering, speed-limited steering authority, selected-car tuning influence, route progress, co-driver/hazard HUD, and a first-person steering wheel. Collision, AI driving, hazard damage, and full pseudo-Mode 7 runtime physics remain the next large implementation step.
