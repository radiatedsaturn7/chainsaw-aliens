# Lark 1600 1990: source artwork checkpoint

Original logo-free faded-teal compact two-seat roadster for the year-2994 salvage setting. Broad mechanical inspiration is a stock 1990 US Mazda MX-5 Miata base 1.6L five-speed manual, not a licensed replica. Black closed soft top, grey repaired doors and weathered surfaces distinguish this fictional design.

`body.png` contains eight wheel-less views in two rows: front, front three-quarter facing left, left profile, rear three-quarter facing right; rear, opposite rear three-quarter, right profile, opposite front three-quarter. Transparent open wheel wells are intended for separate wheel sprites. Views require individually measured atlas regions: do not assume each body fits one equal-width cell.

`dashboard.png` is an original compact left-hand-drive dashboard with an empty instrument binnacle and transparent windshield. No baked gauges, steering wheel or wipers. Shared wheel and live instruments must be calibrated to this dashboard during runtime import.

`research.json` records primary-source specifications and the unresolved mass conflict. The selected future implementation basis is **early 7/89 brochure base 2160 lb (979.7595 kg converted)**, not the 2182 lb Package A. A later 1/90 OEM sheet prints 2116 lb manual; this remains documented, not silently reconciled. Forward gears 3.136/1.888/1.330/1.000/0.814, reverse 3.758, final 4.300; stock square 185/60R14 tires. Any inferred physics parameters must remain explicitly estimates.

Source only, not imported or counted as a finished playable car. Pending: atlas and wheel-opening calibration, fixed-rear camera, individual dashboard overlays, exhaust/tire smoke, actual editor round-trip, motion screenshots and CI. No maps/world files or other vehicles changed. Initial two built-in image-generation calls only; no image modifications or correction calls.

## Runtime candidate (not visually release-approved)

`import.json` imports through the real Car Editor normalization and serialization pipeline using `scripts/car-catalog-import.mjs`. Eight alpha-separated sprite crops (not equal grid cells) and individual wheel-opening anchors are calibrated without changing the original PNGs. Runtime art and the new car are registered in the project manifest. No world or map documents are changed.

Fixed-rear camera, existing surface-specific smoke, shared steering wheel, and individual dashboard-space speed/RPM/gear/fuel instrumentation are configured. The blank binnacle uses authored pixels [220,540,570,130]; wheel pivot/width [505,793,250] on the1983×793 source. This is fictional cockpit calibration, not a claim of exact manufacturer instrument layout. Exterior gauges retain the existing shared configuration.

Base manual steering18:1, RWD, open differential,185/60R14 tires and five forward ratios use the sources in research.json. Only the published peak torque and power anchors are factual curve inputs. All interpolation, ECU limiter, aero, suspension, CG and performance displays remain provisional game settings, individually disclosed in import.json. Full dynamic/performance calibration and human review of actual editor screenshots are required before claiming a finished car.
