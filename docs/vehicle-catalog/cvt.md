# CVT support

Opt in with a `cvt` object on the car tuning and selected automatic transmission.
Keep one forward entry in `gearRatios` (the maximum continuous ratio), and source
`reverseRatio` and `gearFinalDrive` separately. Do not put manual-mode simulated
steps in the gear array. The runtime normalizer enforces one D gear.

Required positive finite fields: `minRatio`, `maxRatio`, `cruiseRpm`, `powerRpm`,
`ratioRatePerSecond`. The ratio bounds exclude final drive. The bounds must be
ordered, as must the two RPM targets. Store this configuration in car-editor JSON;
the existing Gear Ratios panel edits these fields for CVT cars instead of gears.

The controller interpolates its target engine RPM from cruise to power RPM with
throttle, computes the corresponding continuous ratio from driven-shaft speed,
and slews the ratio at the authored rate. D remains gear 1; N and R retain normal
neutral and reverse handling, including direction-change clutch interruption.
The ratio is explicit simulation state, included in snapshots/replay and telemetry.
Wheel overspeed limits use that actual ratio, not a fictitious first gear.
Launch uses the existing converter or automatic clutch take-up model.

This is a **simulation approximation**, not an OEM CVT calibration. RPM targets,
ratio slew rate, clutch/converter take-up, losses and thermal behavior must not be
presented as sourced real-world specifications. There is no belt slip, hydraulic
pressure model, thermal derating, manual-mode emulated steps or OEM shift logic.
A gameplay reposition/reset initializes the ratio to maximum for safe relaunch;
ordinary replay and snapshot restore preserve it.

No production car documents are migrated by this foundation. In particular,
published virtual manual-mode ratios alone do not verify a CVT's continuous
limits. Verify model year, trim and market before migration. Real-road performance
and image/style validation are separate acceptance checks.
