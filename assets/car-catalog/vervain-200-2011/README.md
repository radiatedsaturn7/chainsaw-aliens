# Vervain 200 2011

Original badge-free 2994 hatch based on **UK February 2011 Clio Renaultsport 200, standard Sport chassis, RHD three-door, front-engine FWD six-speed manual**. This satisfies the requested 2010-era selection with an explicitly dated accessible primary document. It does not identify the exact Forza trim or anyone's current vehicle.

## Source and trim choice

Renault UK manufacturer brochure, February 2011, part 7701380594, archived [full extracted document](https://device.report/m/446bfaedbe52b133746a262a1e2918a6774b107691e64b17f12ed562a0b2fc8a). Its standard 200 and Cup sections were compared. Standard Sport uses 1240 kg (786 front /454 rear); Cup is 1204 kg and has lower/stiffer suspension and quicker steering. The optional Cup chassis is not selected. The blocked 2010 brochure and failed direct PDF download were not treated as visually verified evidence.

Manufacturer anchors: 1998cc naturally aspirated four;147.5kW at7100rpm;215Nm at5400rpm;6MT;215/45R17;2585mm wheelbase;4017mm length;1520mm tracks;1484mm height;826/606mm overhangs. Document lists 141mph and6.9sec0–62. Engine scalar display rounds SI conversion to198hp/159lb-ft; curve keeps precise anchors.

The [FH5 list](https://forza.net/fh5cars/) includes a 2010 Clio R.S.; it is selection context, not a source for factory trim specifications. Vesper2003 is a materially different mid-engine RWD ClioV6. Live staging, open PRs and combined6745a7fb had no equivalent front-engine Clio200.

## Explicit simulation estimates

Manufacturer road speeds at1000rpm:4.91/7.84/10.87/13.70/17.00/20.36mph. Effective total reductions derive from nominal215/45R17 circumference. Final4.5 is an arbitrary simulation split, **not verified factory final drive**; individual gear ratios likewise are calculated equivalents, not tooth ratios. Reverse3.2 is estimated. Regression coverage checks the effective speeds and retained uncertainty.

Auto Assist shifts the6MT for accessibility; manual remains selectable and no factory automatic is claimed. Estimated width1.768m is not substituted for brochure2025mm mirror width. Idle/redline/limiter, steering ratio, off-anchor torque curve, CG, clearance, body sections, springs/damping, tire pressures/grip, brake/aero forces, efficiency and shift behavior remain gameplay estimates. Standard Sport stiffness is approximate, not a calibrated factory suspension model. PerfoHub/ESP/ABS electronics are not independently replicated. Estimated6.7sec0–60 is separate from the sourced0–62 figure; no measured-performance claim.

## Art and checks

Original supported image generation: teal/graphite body and charcoal/teal/coral RHD dashboard, no badges, branding or copied livery. Rear-quarter orientation and exterior door palette consistency corrected through supported image editing. Original PNGs pass through the standard importer; shared wheels have individually measured placements, fixed rear camera and surface smoke remain enabled. Shared steering wheel surrounds actual runtime gauges; no painted instrument substitute.

Targeted commands:

```
node --test tests/unit/vervainCatalog.test.js tests/unit/carCatalogImport.test.js
node --test --test-name-pattern=Vervain tests/unit/catalogWheelCoverage.test.js
```

Browser tests cover eight-direction production preview, driving cockpit with actual desktop and mobile device modes, and production compositor at1280x720/390x844. These exercise editor RaceSimulation/VehicleDynamics and rendering, not a full campaign endurance or hardware-performance certification.

Independent final-byte result:13 catalog/import tests,1 wheel-coverage test and5 browser cases passed. All eight production exterior frames and desktop/mobile driving cockpits visually inspected; gauges remain visible within the shared wheel opening. Evidence directory:`/tmp/vervain-browser`.
