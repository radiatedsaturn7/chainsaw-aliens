# Electric powertrain: bounded runtime implementation

Opt in using `car.tuning.powertrainType = "electric"` and the explicit
`electricPowertrain` fields below. Existing cars remain ICE; no car or map data
changes here. This is not an OEM-validated EV6 calibration.

## Configuration and editor

Required: `peakTorqueNm`, `peakPowerKw`, `maxMotorRpm`, `reductionRatio`,
`usableBatteryKwh`, `driveEfficiency`, `regenEfficiency`, `maxRegenTorqueNm`,
`maxRegenPowerKw`, `standstillLossKw`, `regenFullSpeedRadps`.
Optional `liftOffRegen` is 0–1 demand; omission disables lift-off regen.
Torque/power describe the combined motor system, not each motor. Battery
capacity is usable energy, not a gross pack rating.

Editor documents preserve all these fields. Electric cars use model sliders
in the existing Power Curve panel. Fixed reduction is editable up to 20:1,
idle is 0, and there is one forward ratio plus reverse. Runtime normalization
removes inherited clutch/converter behavior without changing ICE defaults.

## Runtime

- Constant-torque/constant-power envelope and overspeed cutoff. Stop before
  changing travel direction. All numerical settings are explicit assumptions.
- Deterministic traction energy in `powertrainState.electric.batteryEnergyJ`,
  retained through replay, snapshot and gameplay reset, separate from 12 V charge.
- Conservative substep drive-work reservation includes shaft acceleration and
  tire reaction. Empty-pack torque scales to available energy even at zero RPM.
- Lift-off-only regeneration: no service-brake blending. Regen disables with
  service brake, handbrake, lost contact or driven-wheel slip. Low-speed/full-pack
  taper and shaft stopping/kinetic-energy bounds prevent recovery through zero.
- Traction assists and general motor/transmission damage apply before energy
  accounting. Electric AI always uses authoritative rather than cheap ICE physics.
- Gauges: `tractionBattery.percent`, `.kwh`, `.powerKw` (positive drain, negative
  recovery). Worker snapshot side-channel carries the same battery values.
- Inherited combustion audio is muted for EVs; tire/world audio remains.

## Deliberate limitations

No independent front/rear motors, voltage/current, thermal/SOC power derating,
charging infrastructure, or OEM brake blending. ICE fuel/oil/stall/alternator
mechanical progression is suppressed for EVs; existing damage and tire/contact
conditions still apply. EV component wear/accessory/DC-DC simulation is future
work. Detailed EV AI costs more CPU until an energy-aware reduced model exists.
Rendered mobile editor/in-game calibration still need visual QA.

Do not infer usable capacity or per-motor torque from EV6 GT's published 77.4 kWh
pack rating and combined peaks. Keep sourced facts separate from simulation
assumptions. This is a bounded drivetrain increment, not complete EV fidelity.
