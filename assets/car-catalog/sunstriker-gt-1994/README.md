# Sunstriker GT 1994 source checkpoint

Original fictional faded-orange long-hood coupe for2994, broadly inspired by stock US1994 Supra Turbo6MT. Not a factory replica, not the tuned movie hero car. No logos or sponsor graphics. Wheel-less eight-angle body and blank dashboard are original PNG assets; retain shared steering wheel and live game gauges/wipers.

Source-only: not imported, not counted as finished. Runtime needs source-specific dimensions, exact US6MT3.133 final drive, stock staggered235/45R17front and255/40R17rear support, wheel-opening calibration and full editor visual/motion tests. `research.json` records the two inspected OEM publications and conflicts. `provenance.json` records generation and alpha validation. No world/map/runtime files changed.

## Runtime preparation (not release-ready)

Imported via actual Car Editor serializer. Eight alpha-opening hub pairs and blank cluster are measured in `calibration.json`; front/rear tire centers under opaque fascia are inferred. Individual dashboard instruments/shared wheel, fixed-rear camera, default surface smoke configured. Stock standard-roof1549kg; source dimensional conflict retained in provenance. Staggered tire object settings require the separately developed axle-aware tire foundation. Runtime visual/motion QA and foundation tests remain release gates.
