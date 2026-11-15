# Fenfire 1800 1986

Original, badge-free 2994 mid-engine coupe based on the **stock 1986 Ford RS200 1.8 road homologation car**, LHD, five-speed manual and factory-delivered AWD. This is not an S, 2.1-litre Evolution or competition-power car. Teal, ivory and ochre salvage bodywork is original fictional art, with no Ford badges, sponsor marks or copied livery.

## Primary evidence

- [Ford owner's manual, Issue 1, archived by owners club](https://www.rs200.org/downloads/RS200_Manual.pdf): PDF pages 16–19 (printed 01-3 through 01-6) personally rendered and read. These cover road engine, transmission, suspension, tires, dimensions, full-fuel kerb mass and road-speed tables. The manual explicitly offers LHD and RHD and says cars are delivered fixed in AWD.
- [FIA road-car account](https://historicdb.fia.com/node/67469) corroborates 250 hp at 6,500 rpm and 215 lb-ft at 4,500 rpm, separating the road version from competition/Evolution. This resolves the manual's ambiguous power-unit typography; no claim that the unclear 187 figure means PS.
- [Ford FIA B-280 original homologation form](https://historicdb.fia.com/sites/default/files/car_attachment/1601077501/ford_rs_200_homologation_280_group_b_-_full_copy.pdf): base pages 2, 6–8 inspected. Do not substitute later competition extensions for road specs.

Owner-manual values: 1,803.5 cc; 1,180 kg including full fuel, fluids, tools and spare; axle weights 545/635 kg; 37/63 front/rear torque split; 4,000 × 1,764 × 1,322 mm; 2,530 mm wheelbase; tracks 1,502/1,498 mm; 180 mm sill clearance; 225/50 VR16 tires at 29 psi, nominal rolling radius 308.8 mm. Five-speed ratios 2.692/1.824/1.318/1.043/0.786, reverse 3.083, axle reduction 4.375 and **separate primary transfer 1.043**.

The engine has one final-drive field, so the two final reductions are multiplied once (4.563125), while raw gear ratios remain intact. A unit test cross-checks all five overall reductions and km/h per 1,000 rpm against Ford's independently rounded tables. Auto Assist shifts this same manual gearbox; it does not imply a factory automatic. Manual is selectable.

## Declared modeling limitations

`research.json` identifies sourced fields and gameplay estimates. The body envelope uses the road manual's width rather than homologation width. The manual's front overhang 788 mm yields a 10 mm length inconsistency; the rig explicitly uses the original FIA form's 778 mm to reconcile the stated 4,000 mm overall length. No hidden source averaging. Viscous differentials use simplified game locking values; no exact temperature-dependent viscous behavior or RWD selector. Idle, visual redline, CG, drag, steering ratio, much suspension/braking/aero and off-peak torque are estimates. Display performance targets are not calibrated measured results.

## Artwork and local verification

Original 2172×724 exterior and dashboard PNGs generated through supported image_gen and imported through the native catalog importer. Eight distinct exterior directions; measured wheel openings use shared tire art. Fixed rear camera, shared steering wheel, surface-sensitive smoke and live instruments are retained. No original map, lighting, props or existing car documents changed.

Independent checks: 14 catalog/import tests plus one wheel-coverage test passed. Three standard preview/compositor browser tests passed. All eight actual production driving-preview exterior captures and the driving cockpit were visually inspected. Desktop (1280×720) and handheld (390×844) production compositor captures show numeric gauges inside the shared wheel; their stress readings use a plain QA background and are separate from actual driving captures. Additional actual driving-preview tests cover both viewport sizes.

Commands:

```
node --test tests/unit/fenfireCatalog.test.js tests/unit/carCatalogImport.test.js
node --test --test-name-pattern=Fenfire tests/unit/catalogWheelCoverage.test.js
```

Browser coverage: `car-catalog-preview.spec.js` Fenfire case, `fenfire-cockpit.spec.js`, and a bounded copy of the existing cockpit compositor test. Captures/logs are under `/tmp/fenfire-browser`, `/tmp/fenfire-driving`, and `/tmp/fenfire-*.log` in this executor.

Deduplication: live staging d98379b05ddc1f5189d7b1975d3f809b10bb602d and earlier combined c91ac9a9 were searched by RS200/source model and fictional aliases; none found. Open PRs were checked read-only; none proposed this car. One addition completes this bounded batch; no speculative Baja entry or second unverified car was added.

Both additional driving-preview tests passed (1280×720 and 390×844); actual viewport captures were inspected. This brings independent browser coverage to five passing tests. These use the real editor driving simulation/renderer, not a full campaign race or a hardware-device performance test.
