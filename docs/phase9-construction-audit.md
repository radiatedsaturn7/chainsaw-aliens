# Vehicle Studio Phase 9 construction audit

## Scope

Same rounded rally sedan genome and engine path, no fleet migration. “Vertices” count position attributes before native expansion, and triangle counts include four wheel instances. Emitted axis degenerates are discarded at native export. The photo-fitted WRX study is measured separately and is not a stock asset.

| Design and mesh | Body triangles | Per wheel | Total triangles | Emitted vertices |
|---|---:|---:|---:|---:|
| Phase 8B rally preview | 41,144 | 2,572 | 51,432 | 27,320 |
| RALLY preview | 46,770 | 1,562 | 53,018 | 34,017 |
| RALLY drive | 25,064 | 1,322 | 30,352 | 19,954 |
| RALLY opponent | 22,688 | 964 | 26,544 | 17,624 |
| RALLY cockpit | 48,014 | 1,322 | 53,302 | 34,266 |
| RALLY export | 63,996 | 1,562 | 70,244 | 43,592 |
| WRX preview | 44,824 | 1,658 | 51,456 | 33,113 |
| WRX drive | 23,804 | 1,298 | 28,996 | 19,193 |
| WRX opponent | 21,482 | 1,012 | 25,530 | 17,062 |
| WRX cockpit | 46,068 | 1,298 | 51,260 | 33,122 |
| WRX export | 61,520 | 1,658 | 68,152 | 42,364 |

## Exact rally per-component accounting

The old editor embeds some seam lips/backing in adjacent panel counts. Phase 9 labels those separately. The wheel table is for **one** template; four matching instances are used in this audited design. The previous rotor and caliper were 240 and 12 triangles per wheel within its generic chrome/trim groups.

| Phase 8B section/material | Triangles | Position attributes |
|---|---:|---:|
| body/console/chrome | 12 | 24 |
| body/console/interior | 288 | 187 |
| body/console/trim | 288 | 187 |
| body/dash/interior | 288 | 187 |
| body/doors/paint | 3,024 | 1,890 |
| body/doors/seamDark | 468 | 336 |
| body/exhaust/chrome | 176 | 115 |
| body/exhaust/trim | 96 | 148 |
| body/fogs/opticCover | 240 | 146 |
| body/fogs/paint | 96 | 96 |
| body/fogs/projector | 108 | 74 |
| body/fogs/reflector | 180 | 110 |
| body/fogs/trim | 336 | 242 |
| body/frontBumper/floor | 448 | 264 |
| body/frontBumper/paint | 5,326 | 2,896 |
| body/frontBumper/trim | 252 | 184 |
| body/frontFenders/paint | 2,560 | 1,514 |
| body/frontFenders/seamDark | 156 | 112 |
| body/frontFenders/trim | 192 | 150 |
| body/glass/glass | 1,488 | 862 |
| body/grille/paint | 48 | 48 |
| body/grille/trim | 252 | 184 |
| body/handles/seamDark | 1,152 | 748 |
| body/handles/trim | 1,152 | 748 |
| body/headlights/head | 240 | 170 |
| body/headlights/indicator | 60 | 42 |
| body/headlights/opticCover | 240 | 146 |
| body/headlights/paint | 96 | 96 |
| body/headlights/projector | 108 | 74 |
| body/headlights/reflector | 180 | 110 |
| body/headlights/trim | 336 | 242 |
| body/hood/paint | 1,280 | 759 |
| body/hood/rubber | 256 | 165 |
| body/hood/seamDark | 192 | 132 |
| body/instruments/head | 192 | 296 |
| body/instruments/trim | 288 | 187 |
| body/mirrors/chrome | 576 | 374 |
| body/mirrors/paint | 576 | 374 |
| body/mirrors/trim | 24 | 48 |
| body/pillars/seamDark | 264 | 184 |
| body/pillars/trim | 648 | 464 |
| body/rearBumper/floor | 448 | 264 |
| body/rearBumper/paint | 5,122 | 2,726 |
| body/rearFenders/paint | 2,664 | 1,570 |
| body/rearFenders/seamDark | 156 | 112 |
| body/rearFenders/trim | 192 | 150 |
| body/rockers/floor | 12 | 24 |
| body/rockers/paint | 320 | 204 |
| body/roof/paint | 408 | 234 |
| body/scoop/paint | 260 | 154 |
| body/scoop/trim | 288 | 187 |
| body/seats/floor | 12 | 24 |
| body/seats/interior | 1,152 | 748 |
| body/seats/seat | 1,440 | 935 |
| body/spoiler/paint | 864 | 561 |
| body/steering/rubber | 576 | 333 |
| body/steering/trim | 12 | 24 |
| body/tails/head | 60 | 42 |
| body/tails/opticCover | 240 | 146 |
| body/tails/paint | 96 | 96 |
| body/tails/reflector | 360 | 220 |
| body/tails/tail | 216 | 148 |
| body/tails/trim | 336 | 242 |
| body/trunk/paint | 1,280 | 759 |
| body/trunk/rubber | 256 | 165 |
| body/trunk/seamDark | 192 | 132 |
| oneWheelAssembly/tires/rubber | 800 | 451 |
| oneWheelAssembly/wheels/chrome | 360 | 364 |
| oneWheelAssembly/wheels/trim | 12 | 24 |
| oneWheelAssembly/wheels/wheel | 1,400 | 966 |

| Phase 9 driving section/material | Triangles | Position attributes |
|---|---:|---:|
| Body / console / chrome | 28 | 46 |
| Body / console / interior | 80 | 42 |
| Body / console / trim | 76 | 78 |
| Body / dash / interior | 208 | 144 |
| Body / dash / trim | 28 | 24 |
| Body / doors / interior | 112 | 80 |
| Body / doors / paint | 1,256 | 770 |
| Body / doors / seat | 72 | 56 |
| Body / exhaust / chrome | 224 | 144 |
| Body / exhaust / floor | 12 | 24 |
| Body / exhaust / seamDark | 72 | 48 |
| Body / exhaust / trim | 72 | 48 |
| Body / fogs / opticCover | 180 | 110 |
| Body / fogs / paint | 72 | 72 |
| Body / fogs / projector | 72 | 50 |
| Body / fogs / reflector | 120 | 74 |
| Body / fogs / trim | 252 | 182 |
| Body / frontBumper / paint | 2,326 | 1,328 |
| Body / frontBumper / trim | 210 | 154 |
| Body / frontBumper / underbody | 56 | 48 |
| Body / frontFenders / paint | 1,128 | 690 |
| Body / frontFenders / trim | 336 | 240 |
| Body / frontFenders / underbody | 136 | 108 |
| Body / glass / glass | 1,488 | 862 |
| Body / grille / paint | 36 | 36 |
| Body / grille / trim | 210 | 154 |
| Body / handles / seamDark | 320 | 264 |
| Body / handles / trim | 320 | 264 |
| Body / headlights / head | 180 | 130 |
| Body / headlights / opticCover | 180 | 110 |
| Body / headlights / paint | 72 | 72 |
| Body / headlights / projector | 72 | 50 |
| Body / headlights / reflector | 120 | 74 |
| Body / headlights / signalL | 30 | 21 |
| Body / headlights / signalR | 30 | 21 |
| Body / headlights / trim | 252 | 182 |
| Body / hood / paint | 352 | 207 |
| Body / instruments / interior | 54 | 29 |
| Body / instruments / trim | 120 | 192 |
| Body / mirrors / chrome | 576 | 374 |
| Body / mirrors / paint | 576 | 374 |
| Body / mirrors / trim | 24 | 48 |
| Body / panel seams / backing / seamDark | 804 | 584 |
| Body / panel seams / lip / paint | 1,248 | 968 |
| Body / panel seams / seal / rubber | 352 | 230 |
| Body / pillars / interior | 204 | 152 |
| Body / pillars / seamDark | 144 | 104 |
| Body / pillars / trim | 636 | 472 |
| Body / rearBumper / paint | 2,304 | 1,293 |
| Body / rearBumper / seamDark | 54 | 37 |
| Body / rearBumper / trim | 126 | 91 |
| Body / rearBumper / underbody | 56 | 48 |
| Body / rearFenders / paint | 1,200 | 730 |
| Body / rearFenders / trim | 336 | 240 |
| Body / rearFenders / underbody | 136 | 108 |
| Body / rockers / paint | 320 | 204 |
| Body / roof / paint | 408 | 234 |
| Body / scoop / paint | 224 | 146 |
| Body / scoop / seamDark | 120 | 92 |
| Body / scoop / trim | 96 | 65 |
| Body / seats / floor | 168 | 112 |
| Body / seats / interior | 80 | 54 |
| Body / seats / seat | 916 | 478 |
| Body / spoiler / paint | 424 | 304 |
| Body / steering / interior | 60 | 98 |
| Body / steering / rubber | 220 | 138 |
| Body / steering / trim | 72 | 120 |
| Body / tails / opticClear | 60 | 42 |
| Body / tails / opticCover | 180 | 110 |
| Body / tails / opticRed | 144 | 100 |
| Body / tails / paint | 72 | 72 |
| Body / tails / reflector | 240 | 148 |
| Body / tails / runningRed | 60 | 42 |
| Body / tails / signalL | 30 | 21 |
| Body / tails / signalR | 30 | 21 |
| Body / tails / trim | 252 | 182 |
| Body / trunk / paint | 352 | 207 |
| Body / underbody / floor | 72 | 49 |
| Body / underbody / trim | 40 | 44 |
| Body / underbody / underbody | 684 | 406 |
| Wheel template / brake caliper / caliper | 36 | 20 |
| Wheel template / brake rotor / rotor | 224 | 136 |
| Wheel template / tires / rubber | 400 | 231 |
| Wheel template / wheels / barrel | 200 | 126 |
| Wheel template / wheels / trim | 30 | 35 |
| Wheel template / wheels / wheel | 432 | 298 |

## Color/detail maps and editing performance

- RALLY: driving package has 37,896 base-color bytes and approximately 51,883 ORM/normal bytes with mipmaps (89,779 combined, RGBA8 estimate; cache and other scene textures excluded). Preview geometry CPU: 309, 174, 143 ms; drive geometry: 145, 123, 92 ms, three local Node passes; not draw time.
- WRX: driving package has 37,896 base-color bytes and approximately 49,152 ORM/normal bytes with mipmaps (87,048 combined, RGBA8 estimate; cache and other scene textures excluded). Preview geometry CPU: 207, 152, 139 ms; drive geometry: 102, 104, 110 ms, three local Node passes; not draw time.

The existing native material path supports linear ORM (occlusion, roughness, metalness) and normal maps; these are procedural material-coordinate details. They are not a high-poly or directional lighting bake. The new Studio-only lamp material channels distinguish headlamps, running, brake, reverse and optional turn/hazard inputs. This is not a physical optical ray trace.

Underbody: contoured tray and four inner wheel vaults, inward returns and rear tub. The initial enclosure blocked 100 sampled opposite-wheel rays and retained roughly 24 mm of conservative inboard tire margin in the representative fit. This is a local swept-envelope/ray check, not all-state collision certification. The remaining visible underbody is primarily protective paneling, not a detailed drivetrain.

The design preview/cockpit/garage mesh retains detail; the driving and opponent exports reduce primarily fascia/optical tessellation, hidden cabin rows, return geometry, wheel segments and cap density. No automatic LOD application to the 660-car fleet. Raised outlet groups have hollow tips, pipe runs, mufflers and heat shields; arbitrary elevated fascia cutouts are not yet generated for them. Cavity materials and sharper rotor shaping improve the mechanical read, but the shader is not a full local ray-traced occlusion solution. Software WebGL provides image/draw-call checks, not reliable GPU frame time for target hardware. Physical-device 60 FPS and Forza-grade fidelity remain unverified.
