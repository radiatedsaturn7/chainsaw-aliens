# buse1 race investigation

The saved 78-node pencil circuit is 1436.8879 m long after path smoothing. The saved race and WRX2 documents were read without modification.

Changes:

- Generated shoulder/road-edge collision boxes are omitted where they intrude into another drivable road corridor. Ordinary edge barriers and authored scenery colliders remain. Grade-separated roads are checked by elevation.
- Route progress reconciles small local projection differences against the authoritative vehicle position. This prevents accumulating progress error around tight bends, while rejecting distant branch jumps. It never changes the physical vehicle pose.
- Expensive route signatures and raw node conversion are cached during each synchronous physics/render call. Caches expire after the call and clear on explicit geometry invalidation.
- Track State dirt/loose-material patches render as soft ground geometry in the same Three.js camera and depth pass as the road and vehicle. The old screen-space overlay is suppressed for this renderer; the diagnostic overlay and software fallback remain. Patches sample baked surface heights, and unchanged cell data reuses geometry.
- The shared tire-track shader relies on Three.js's injected color attribute, avoiding a duplicate GLSL declaration.

## Verification

`artifacts/buse1/lap-verified.json` records the saved WRX2 completing the circuit using steering and pedals only: 13,132 frames at 60 Hz (218.87 simulated seconds), all 78 checkpoints, finish registered, no resets or failed simulation frames. Maximum lateral distance from the road center was 1.5581 m. The final frame includes finish/ghost serialization, so it is not representative of driving performance.

The saved circuit regression checks road support and at least 3 m of centerline clearance from generated barriers every metre around the entire circuit. The fixture is `tests/fixtures/buse1RaceDocument.json`.

A matched acceleration benchmark before/after the geometry caching change measured median simulation updates of 35.88 ms versus 15.43 ms (p95 47.89 versus 20.71 ms), excluding the first 30 warm-up frames. Final speed and distance matched exactly. These are headless simulation measurements, not browser frame rates. Source reports are `artifacts/buse1/baseline.json` and `artifacts/buse1/cached.json`.

- 15 targeted unit tests passed across `raceImportedCircuitRegression`, `raceTireTrackRenderer`, `staticRaceColliderWorld`, and `raceAuthoritativeState`.
- The broader physics-feel/Track State integration run passed 24 tests during this investigation.
- Two legacy layout tests that directly set compatibility speed/yaw fields failed identically on both the working code and temporary pristine HEAD modules: “car position is free-moving” and “route progress advances from car heading.” They are not new failures; temporary baseline modules were removed.
- `tests/playwright/race-track-state-ground.spec.js` checks actual WebGL patch color, depth occlusion, and suppression of the legacy overlay. Browser execution is pending the authoritative GitHub Docker run; Chromium is unavailable in this Termux environment.
- The local server returns HTTP 200 for the updated sources on port 8000.

Reproduce the pedal/steering lap locally:

```sh
BUSE_LAP=1 BUSE_REPORT=artifacts/buse1/lap.json node tools/diagnose-buse1.mjs
```

The diagnostic defaults to the locally saved buse1 and WRX2 files. `BUSE_RACE` overrides the race document, and the first positional argument overrides the car document. Without `BUSE_LAP=1`, it runs a three-second acceleration benchmark.

## Follow-up: skid spikes and gamepad steering

A six-second WRX2 acceleration/turn/countersteer reproduction identified unnecessary surface resampling when rebuilding asphalt skid-mark chunks: the renderer constructed an outer ribbon even though its color was empty. Both rendering paths now skip that ribbon, and new marks use the baked surface sampler when available.

For frames 90–229 of the matched reproduction, Three.js geometry preparation median fell from 21.50 ms to 1.00 ms, and p95 from 80.26 ms to 5.54 ms. Final physical position and speed matched exactly. This measures CPU preparation, not GPU rendering or overall browser FPS; the baseline also had CPU profiling enabled. Reports: `artifacts/buse1/skid-before.json` and `skid-after.json`.

Gamepad Sport/Accessible steering gains up to 10% additional angle. The bonus ramps smoothly from 7.5 to 15 m/s, retains the speed-dependent envelope and rack-angle limit, and leaves keyboard and simulation-wheel mapping unchanged. The authoritative rack and visible wheel commands receive the same speed-dependent bonus. The response filter itself is unchanged.

The final steering/skid tests pass 22 cases; the imported-circuit regression suite also passed during this follow-up. Reproduce the turn/skid diagnostic with `node tools/diagnose-buse1-skid.mjs`. Browser/device frame pacing still needs confirmation.
