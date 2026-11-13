# Axle tire dimensions

Opt in with `setup.tireSizeByAxle.front` and/or `.rear`, each containing
`widthMm`, `aspectRatio`, `wheelDiameterIn`. Missing components inherit
`setup.tireSize`. Existing single-size cars retain their authored scalar tuning
radius, including existing calibrations. The car tuning Size tab authors each
axle separately, using the existing scrolling slider panel. The global tire-size
setter and installing a complete saved tire replace all four tires and clear
axle overrides; loading a stock garage baseline preserves stock axle sizes.

Opted-in cars derive nominal radius from rim diameter plus sidewall. Player and
AI contact solvers use individual wheel radius, angular speed, footprint width,
pressure/size grip and thermal configuration. The scalar compatibility radius
is the driven-wheel harmonic mean (front for FWD, rear for RWD). Runner reset and
render hub pose use the same geometry. Staggered AI stays on the detailed path,
like CVT/EV, rather than silently using the legacy cheap solver. This increases
CPU cost with many staggered opponents; profile large grids before release.

Fidelity limits: nominal unloaded geometry is not a manufacturer's measured
loaded rolling circumference. Shared carcass stiffness, wheel inertia and
suspension calibration remain authored game approximations. Performance points
use average axle width, not an axle load transfer model. Hand-drawn billboard
art and tire artwork placement are not automatically stretched; authors still
need to position/scale those visual layers for each vehicle. The physical wheel
rig and render hub state reflect axle dimensions.

Example stock reference dimensions (not a vehicle definition):

```json
{"tireSize":{"widthMm":235,"aspectRatio":45,"wheelDiameterIn":17},
 "tireSizeByAxle":{"front":{"widthMm":235,"aspectRatio":45,"wheelDiameterIn":17},
                   "rear":{"widthMm":255,"aspectRatio":40,"wheelDiameterIn":17}}}
```

Validation: `node --test tests/unit/staggeredTires.test.js` and
`npx playwright test tests/playwright/staggered-tires-editor.spec.js`.

## Verification boundary for this increment

The focused and existing tire/AI/replay/EV/CVT suite passed locally (107 tests
before adding the driven-shaft check). Browser execution is not claimed locally:
bundled Playwright Chromium is absent and system Chromium fails to create its
process-singleton socket (`Operation not permitted`). The dedicated workflow runs
portrait and desktop authoring plus the actual Three.js physical wheel rig, both
with direct state dimensions and worker-profile fallback, and uploads screenshots.
Review that CI before merge.

Separately, `tests/unit/garageSavedTires.test.js` has a pre-existing failing
assertion at line 28 requiring Snow/Rally art to be identical to Dirt. Running it
in both this worktree and the untouched base checkout reproduces the same failure
(2 passing, 1 failing). This increment neither changes those assets nor marks that
regression passed; the new focused test covers stock baseline axle preservation.
