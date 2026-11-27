# Field Forgetmenot 2004 · Fit 12

The roster appearance uses a rounder, recessed twin-bowl headlight with a
continuous silver reflector backing, tucked outer front bumper corners, and
gold alloy wheel faces. The original wheel mesh, hub positions, rear lamp
origins, blue paint, reflection routing and car data are unchanged.
The native car and four wheels total 14,804 triangles (11,764 + 4 × 760).

Open `tools/vehicle-validation/wrx-fit12-genome.json` in Graphics → 3D Car Design
for further work. The silver headlight backing is an optional studio setting
and has no effect on existing designs unless enabled. To rebuild the bundled
native pair, run `node tools/vehicle-validation/build-wrx-fit12.mjs --write`.

Compare the previous appearance with `?wrxLook=fit10`; `wrxLook=legacy` and
`wrxLook=showcase` retain their earlier behavior. Fall back to an older pair
as a unit if the current one cannot load. This does not change physics, saves,
or the player's car selection. The source genome contains no reference photos.

The hood uses the Studio's optional **Smooth longitudinal hood sweep** control.
It replaces the stacked shaping fades across the middle rails with a single
curvature ramp between the stock cowl and nose edges. The outer fender rails,
hood scoop settings, headlight mounts, paint and triangle budget are unchanged.
Old genomes default to zero and retain their original geometry.
