# Mechanical failures and repairs

## Using it

- **Car Editor → Drivetrain → Mechanical systems** configures the simulation, time scale, battery/fuel capacity, rated boost, and each component’s durability, repair cost, and required replacement inventory ID. Existing car files work without migration. A boost value of zero describes a naturally aspirated engine; configuring healthy boost does not change the car’s existing torque curve.
- **Garage → Tune → Tires** contains both pressure and tire selection. Pressure remains adjustable without installing parts.
- **Garage → Tune → Repair** shows component condition and cost. Select a component to see its symptom and required part in the dialogue panel, then confirm Repair. Repair everything is one atomic transaction. Fluids & charge refuels, replenishes oil/coolant, and charges the battery; it does not fix leaks.
- **Pause → Headlights** switches lights off/on for keyboard, controller, and touch users. The simulation is paused while this menu is open.
- Both gauge editors offer `mechanical.*` instruments, including coolant/oil temperature in °C, oil/fuel pressure in bar, battery voltage/current, boost in bar, remaining fuel in liters, and each tire’s pressure in PSI and temperatures in °C. Existing number, bar, dial, artwork and text styling remain available. `fuel`, `charge`, `oil`, `coolant`, `tread`, and `pressureRatio` are fractions, not percentages. Set a gauge’s range/units for its measurement (for example voltage 8–15 V).

Warnings supplement existing damage indicators. Low voltage progressively dims instruments and powered light FX; a stopped engine stops its audio. Failed combustion or drive components disengage drive torque: momentum, steering, gravity, and available brakes still act on the car. Throttle automatically attempts a restart when fuel/electrical conditions recover and the starter works. There is no new ignition-button chore.

## Model and existing physics

`MechanicalModel.js` lives inside `VehicleDynamicsRunner` state. A 100 ms accumulator advances from the authoritative chassis timestep, including in the worker. Input timeline and worker protocol carry discrete headlight commands. Fluid, fault, hazard, seed, transient, and accumulator state are included in snapshots and restores. No wall-clock timers or `Math.random` select faults. Mechanical presentation is sent at 10 Hz alongside the existing compact worker snapshots; render interpolation does not advance mechanics.

Existing damage remains 0–100. Positive increases in the existing engine, transmission, panel, wheel-brake, tire, and suspension damage feed the associated components. Baseline degradation and existing collision/overrev behavior are retained. Below 50 damage there are no random failures. Above 50, integrated hazard rises cubically with damage and with actual operating stress. Seeded exponential thresholds determine events; severe damage increasingly selects persistent failures. Existing wear and damage are not replaced by a second chassis simulator.

- Ignition/ECU/fuel faults cause misfires or stalls; piston/bearing failure stops combustion.
- Radiator leaks lose coolant; circulation/fan faults and inadequate cooling raise coolant/oil temperature. Overheating damages pistons. Low oil pressure damages bearings; oil-seal leaks reduce oil level. Turbo temperature and lubrication damage reduce boost capability.
- Alternator output, battery capacity/charge, wiring and loads determine voltage. ECU/ignition, fuel pump, headlights and cooling fans consume current. Failed batteries cannot store charge. Lamps off conserve charge. Electrical failure does not directly zero vehicle velocity.
- Clutch damage causes load-dependent slip, gearbox failures lose gears, and differential/axle failure removes drive. Gearbox malfunctions can temporarily interrupt drive.
- Tire pressure loss and punctures change the existing contact model’s pressure/damage inputs. Tread and measured thermal state come from the existing tire model; persisted tread affects subsequent races. Failed dampers reduce damping, failed springs reduce spring rate, and asymmetric suspension/alignment damage adds steering pull.
- Brake heat uses measured per-wheel brake torque and wheel angular velocity where available, with cooling related to speed. Heat causes fade/pad wear; hydraulic failure removes that wheel’s service brake. Existing body damage still controls aerodynamics; front/rear impacts also expose radiator, lighting and fuel-system faults.

These are configurable arcade approximations, not manufacturer-validated thermal, electrical or failure specifications. The default time scale is 8:1 for fluid loss, electrical consumption and wear; hazard frequency has a separate multiplier. Brake heat uses an approximate 4000 J/°C effective thermal mass per wheel. Engine heat/load and electrical loads are estimated from existing RPM, throttle, vehicle speed, and enabled equipment. There is no detailed combustion chemistry, individual cylinder simulation, physical coolant circuit, axle fracture geometry, or battery electrochemistry. Wheel temperature and tire friction work are reused rather than fabricated.

## Persistence and repairs

`garage.cars[carRef].condition` stores legacy damage and mechanical state alongside installed parts and tune. Race completion waits for the existing item/garage storage transaction before opening another screen/race. Quit queues a condition save and reports failures; building the next car waits for queued writes. In-game restart and pose reset retain condition. Standalone editor playtests do not write campaign condition.

A repair clears only the selected component’s wear/fault/transient state and its relevant service items. It recalculates only the corresponding legacy damage group from the remaining components; unrelated groups are unchanged. Thus repairing an alternator does not rebuild a worn engine, and topping up coolant does not fix a radiator leak. Installed performance upgrades and tuning remain installed; swapping upgrades is not a free repair.

Required replacement IDs use the existing **Items** bag. In the Item Editor, create an Inventory effect targeting that exact ID, with amount 1, on collect. Existing race item pickups then grant the salvage. Different IDs (for example `wrx-alternator` versus `m3-alternator`) enforce compatibility. Components without a required ID can be fabricated/repaired with scrap alone. Shared required IDs require one item per repaired component. Repair everything fails as a whole if any part or scrap is missing. Storage failure does not spend scrap or consume parts.

## Missions

**Race Editor → Settings → Mechanical mission** sets starting faults, optional fluid/charge overrides, required replacement IDs, required salvage at finish, a minimum finish voltage, and an output-variable prefix. Starting overrides apply on each new entry; restarting the same attempt preserves current damage/fluids. Mission settings use the existing race document and item-placement system.

Example nighttime salvage mission:

1. Set night lighting in Skybox. Under Mechanical mission, configure **Alternator → Apply starting condition → Failed**, damage 100. Set required replacement ID `wrx-alternator`.
2. Enable fluid/charge overrides and start battery at 25%. Leave headlights on.
3. Place an item whose Inventory effect grants `wrx-alternator` along the route.
4. Require that inventory ID at the finish and optionally require at least 10 V. Return to the garage after the race to install it through Repair. Lower charge or raise the time scale to shorten the deadline.

Completing a race publishes `mechanical.success`, `mechanical.voltage`, `mechanical.fuel`, other measurements, and `mechanical.<component>.failed` / `.damage` into existing menu variables. The prefix is configurable. A failed requirement does not mark the race completed; the result screen reports the unmet mission and still lets the player leave. Configure menu/world-map conditions using these variables. Collected salvage remains in the existing persistent inventory. Race finish-node variables and destinations remain available.

Authored race data can additionally test specific conditions:

```json
{
  "mechanicalMission": {
    "components": { "alternator": { "damage": 100, "failed": true } },
    "requiredParts": { "alternator": "wrx-alternator" },
    "charge": 0.25,
    "headlights": true,
    "requiredInventory": "wrx-alternator",
    "minimumVoltage": 10,
    "outputPrefix": "mechanical",
    "completionConditions": [
      { "component": "bearings", "operational": true, "maxDamage": 70 },
      { "measurement": "coolantTemperatureC", "max": 125 }
    ]
  }
}
```

`completionConditions` is a data-only predicate list, not executable script. Repairs happen in the garage; this change does not add roadside repair interaction or per-part compatibility menus beyond exact inventory IDs. Per-car configuration applies to player cars; AI behavior/planning is not extended to decide when to repair.

## Validation

`tests/unit/mechanicalFailures.test.js` covers deterministic tick partitioning and restore, cascades, electrical consumption, healthy/disabled behavior, actual powertrain cutoffs, snapshots, mission variables, configuration serialization, targeted/atomic repair, salvage, and failed-save rollback. Existing garage, gauge, FX, input, travel, lighting, and physics tests provide regression coverage.

`tests/playwright/mechanical-settings.spec.js` covers the shared configuration forms at phone and desktop widths; the existing garage-tuner browser test includes the new Repair navigation. Browser checks require the repository’s supported Docker/CI Playwright environment; they were not run in Android/Termux.


### Mechanical warning instruments

Both Exterior Gauges and Interior Gauges offer **Engine light** (`enginelight`), plus `oillight`, `coolantlight`, `batterylight`, `brakelight`, `tirelight`, and `transmissionlight`. Use Icon format and assign Background / icon artwork for a custom lamp. Number format shows Warning or Critical; text templates can include `${enginelight}`. Lamps hide when healthy; selecting an off lamp in the editor shows it faintly for placement.

Each lamp derives 0 (off), 1 (steady warning), or 2 (flashing critical) directly from current simulation state. An active intermittent malfunction gives a warning; failed components give a critical indication. Wear percentages alone do not illuminate a lamp: unsafe measured temperatures, pressures or fluid levels still do. Engine light covers ignition, pistons, bearings, ECU, fuel pump, turbo, cooling and lubrication faults. Active misfires, engine shutdown, running oil pressure below 0.7 bar, coolant temperature at least 120°C, or coolant below 10% trigger critical engine warnings. Cosmetic body damage alone does not illuminate it. These are the game's arcade diagnostics, not a simulation of a specific manufacturer's OBD protocol.

Critical artwork and overlays flash together every 300 ms using the simulation tick, so pausing freezes the phase. Disabled mechanical simulation produces no warnings. Electrical instrument dimming still applies.

Existing measured gauges include coolant/oil temperatures, oil/fuel pressure, battery voltage/current/charge, boost, fuel remaining, coolant/oil levels, and each tire's pressure, temperature, tread and brake temperature. Every component additionally exposes `mechanical.components.<id>.damage` (0–100) and `.failed` (0/1); these are diagnostic condition values, not invented physical sensor readings. Repairs change the underlying condition, and warning states follow it; a repaired cooling component can still warn until the actual overheating subsides.


Driver-status gauges are separate from faults: **ABS Off** (`absofflight`) and **Traction Control Off** (`tractioncontrolofflight`) illuminate steadily when the session's corresponding assist is disabled. **Handbrake / E-brake** (`handbrakelight`) follows the applied authoritative handbrake, including timed pulses, in both worker and main-thread physics. These do not indicate ABS/TC intervention or hardware faults. They remain usable when mechanical failures are disabled. Use Icon format and custom artwork; Number format uses On/Off text. All three work in both gauge layouts and text templates.


### Indicator artwork sheets
In Car Editor → Art → Indicators, choose **Add / cut indicator**, choose a saved artwork sheet, and drag a rectangle around an icon. Adjust the integer pixel coordinates if needed, name the cutout, select its warning/status signal and Apply. The original image is unchanged. Save the car to retain its library.

In Exterior Gauges or Interior Gauges, use **+ Indicator** to place a saved cutout. Position and resize it using normal gauge controls. It automatically follows its assigned signal, including flashing for critical mechanical faults. Each placed gauge copies the cutout settings; later edits or removal of its library entry do not modify placed gauges. Replacing its Background / icon artwork resets the crop to the full replacement image.


### Racing thermal balance
Coolant and oil evolve on real elapsed simulation seconds, independent of accelerated wear/leak time scaling. Coolant has explicit lumped thermal inertia, radiator rejection, progressive thermostat opening and speed/fan airflow. Minor wear through 25 damage retains cooling capacity. Oil follows coolant/load through a 90-second response time. Healthy full-throttle operation must tolerate a ten-minute race; tests cover low/high road speeds, 35°C ambient, minor wear and idle starts. Pump/radiator failures and oil starvation still cascade into damage. This is a gameplay-calibrated thermal approximation.

The legacy wear rule no longer damages engines at 98.5% of the limiter. It requires actual measured RPM above 108% of the limiter, preserving consequences for mechanical overspeed rather than ordinary limiter operation. Saved temperatures remain persistent; the development RTG-001 save received a one-time correction of old-model heat and excess thermal piston damage, preserving externally recorded damage and other progress.


### Fuel economy and tank capacity
Car Editor → Drivetrain → Mechanical systems configures US MPG (`fuelMpg`), US-gallon capacity (`fuelTankGallons`), idle burn, consumption multiplier and filler-door side. Old `fuelLiters` capacities migrate without losing their size. Fuel fraction remains the persisted quantity, and readings include `${fuel}` (percent), `${fuel.gallons}`, `${fuel.capacity}` and `${fuel.mpg}` (reference economy, not instantaneous MPG).

At reference cruise load, distance / MPG determines gallons burned. Heavy throttle and high RPM increase that rate; idling consumes a configurable gallons/hour floor. Closed-throttle overrun above idle cuts fuel. Normal consumption uses real simulation time, separately from accelerated leak/wear time. This is an arcade economy model, not a manufacturer-validated engine fuel map. Mechanical systems must be enabled for consumption; existing AI does not yet simulate individual fuel/repair states.

Editable baselines now follow the verified reference variants in the table below. The generic fallback filler side remains right; CT-86 explicitly uses left.

Race Editor → Settings → Starting fuel sets saved level, gallons or percent. An explicit override takes precedence over the legacy mission fuel fraction, clamps to capacity, and is applied to the selected player car. Persistent-condition restarts retain fuel. Empty fuel uses the existing stall/coasting behavior; garage fluid service refills it.

Fuel gauges share the tachometer renderer and styling, with reversed safe/danger arc assignment for a low-fuel zone, E/F labels and a pump/door-side icon. The current RTG-001 exterior layout includes one below the gear number. Browser interaction coverage is authored for phone and desktop; Android local runs use unit checks, with browser execution deferred to CI.


### Verified fuel baselines (2026-10-26)

All MPG and gallon values in the game are **US** units. Combined road-test ratings seed the arcade reference-cruise parameter; they are not expected racing MPG. European converted ratings use different certification cycles from EPA, so the rows are not a standardized comparison. No existing engine power, drivetrain, or damage was changed to match these donor cars.

| Game car | Reference variant | Reference US MPG | US gallons | Filler side (facing forward) |
|---|---|---:|---:|---|
| RTG-001 | 2026 WRX 2.4 manual | 22 | 16.6 | Right |
| PZ-24 | 2026 M3 sedan, base manual | 19 | 15.6 | Right |
| CT-86 | Final third-generation MR2 Roadster 1.8 manual | 31.8 | 12.6803 (48 L) | Left |
| BUSE-019 | Final-generation Clio RS 200 EDC (2018 brochure) | 39.9 | 11.8877 (45 L) | Right |

Sources:
- [EPA 2026 guide](https://www.fueleconomy.gov/feg/pdfs/guides/FEG2026.pdf), M3 manual 19 combined and WRX manual 22 combined.
- [Subaru 2026 resources](https://www.subaru.com/owners/vehicle-resources.html?model=2026-WRX-TUH), 16.6-gallon capacity. [Current-generation Subaru manual, archived](https://device.report/m/31f81603d60aa1869569725e70f0c038bc0a814656eb4e19ade0dea62176dee7), right-side filler.
- [BMW current specifications](https://www.bmwusa.com/vehicles/m-series/m3-series/bmw-m3-sedan-technical-highlights.html), 15.6 gallons. [G80 owner manual, archived](https://www.manualzz.com/doc/80070500/bmw-m3-2025-owner-manual), refueling illustrations.
- [Toyota final MR2 specifications, manufacturer sheet archived](https://xr793.com/wp-content/uploads/2022/12/2007-Toyota-MR2-Specs-UK.pdf), 7.4 L/100 km and 48 L; [Toyota third-generation manual](https://assets.sia.toyota.com/publications/en/om-s/OM17511U/pdf/OM17511U.pdf), left-side filler. Convert L/100 km using 235.214583 / consumption, not UK MPG directly.
- [Renault June 2018 brochure](https://imotorrenault.s3.amazonaws.com/brochure-pdf/_clio_and_clio_r-s-_brochure_june18.pdf), RS Sport/Cup 5.9 L/100 km and 45 L. [Renault Clio IV phase 2 manual](https://www.user-manual.renault.com/en/content/x98/section-1-getting-know-your-vehicle/tank-13), capacity and right-rear filler illustration. This baseline is RS 200, not an assumed Trophy variant.

### Upgrades and fuel

Garage builds compare the installed and stock physics torque curves over the stock operating RPM range (33 RPM-weighted samples). For power ratio R, cruise consumption multiplies by 1 + 0.25 × (R − 1); the additional load multiplier ramps from neutral at 35% throttle to R divided by that cruise multiplier at full throttle. Thus a uniform 50% torque increase costs 12.5% more fuel at reference cruise and 50% more under full load. Idle fuel and overrun fuel cut remain unchanged. This is an editable arcade approximation, not measured race-engine efficiency.

Item Editor part modifiers and unlocked Engine & weight tuning now support fuelMpg, fuelConsumptionScale and fuelIdleGallonsPerHour. Explicit efficiency changes compose with automatic power costs. Non-power parts do not receive a tier-based penalty. Each build starts with the saved stock car; uninstalling restores its baseline without accumulating penalties. Fuel capacity, filler side and saved fuel fraction are retained. Instantaneous speed/load still affect actual burn, including effects of gearing and weight on driving; there is no separate tire rolling-resistance or aerodynamic fuel map.
