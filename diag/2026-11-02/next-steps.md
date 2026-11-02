# Next investigation

## Priorities

1. Capture the current production build on the phone before adding further changes. Include ordinary driving, an early look at AI, scraping, rollover and reset; label each interval. Keep heavy Termux jobs stopped.
2. Separate elapsed stalls from actual thread CPU and browser/GPU presentation. Correlate frame intervals with workload counts, GC where observable, scheduling, thermal state and render submissions. Avoid declaring the currently interrupted function to be the cause.
3. Validate the stable-material candidate end to end before promoting it. Preserve every required field and old/new contact record lifetime. Include packed worker behavior and live material transitions.
4. Investigate longer-run growth using matched routes and conditions: active/tracked cells, event history, maintenance work, allocation rate, cache size and process memory. Test clear and storm independently.
5. Revisit visible car painting/upload/compositor work if phone rendering tails remain. Node headless timing cannot answer that question.

## Measurement protocol

- Record commit, saved race identity/checksum, car/tires, AI count/detail count, weather, brightness, camera, device/browser, recording mode and any concurrent work.
- Keep seed, route, time-step admission, physics step counts and final state comparable for simulation A/B trials. Check deterministic parity and admitted versus wall time; fewer simulated steps can create a false speedup.
- Use repeated paired/interleaved trials with warmup. Do not run allocation sampling concurrently with a timing benchmark or phone capture.
- Report interval median/P95/P99/max and counts above 16.67/33.33/50/100 ms. Separate reset/intro/countdown from driving while also reporting reset stalls separately.
- Report actual rendering CPU and GPU/compositor evidence separately where available. Avoid summing inclusive parent and child timings.
- In GC tests include between-update intervals and thread/process CPU; GC duration is elapsed, not necessarily equivalent CPU execution.
- Detailed instrumentation has overhead. Previous setup/finalization probes were small on average, but did not capture all per-call timing or allocation costs. Compare instrumentation modes under matched workloads.
- Do not infer causation from one spike. A high-contact frame can be fast; a low-contact frame can be interrupted.

## Relevant code entry points

Search for these modules rather than relying on old line numbers:

- `src/racing/RaceSimulation.js`: player environment/material construction and simulation coordination.
- `src/racing/RaceAiSimulation.js`: detailed opponent environment and simulation.
- `RaceAiDistantPhysics.js`: cheaper AI movement, simultaneous old/new contact ownership.
- `RaceSurfaceModel.js`, `RaceVehicleSurfaceContact.js`: projection/deck/terrain lookup and contact records.
- `TrackState.js`, `TrackStateCell.js`: authoritative weather/material state, sampling and evolution.
- `ContactPatchTireModel.js`, `ChassisBodyCollision.js`, `SuspensionGeometry.js`: tire/chassis/suspension work.
- `RacePerformanceCapture.js`: recorder fields; elapsed timers must not be mistaken for OS CPU measurements.
- `tools/loadtest/benchmark-mountain-stress.mjs`: headless stress harness.

## Guardrails

Preserve browser-first portability and existing keyboard/gamepad/touch controls. Keep real grip/contact and damage behavior. Do not change authoritative detail based on unrecorded wall-clock deadlines. Do not narrow material fields without auditing all downstream consumers. Do not pool returned records without proving their lifetimes. Keep reset validity tied to an upright car with all four wheels supported by actual road. Do not treat passing unit/CI tests as proof of frame pacing.
