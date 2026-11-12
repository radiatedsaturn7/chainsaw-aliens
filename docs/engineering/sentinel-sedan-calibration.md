# 2024 Sentinel Sedan calibration

Original fictional 2994-style compact sedan, referencing the US 2024 Nissan Sentra S. Artwork has no manufacturer logos and is not a replica.

## Source facts

Source: https://usa.nissannews.com/en-US/releases/2024-nissan-sentra-specifications

The attributed record is embedded in `assets/car-catalog/sentinel-sedan-2024/import.json`.

- 149 hp at 6000 rpm; 146 lb-ft at 4000 rpm; 1997 cc inline-four; maximum engine speed 6600 rpm.
- 3036 lb curb mass; manufacturer rounded 61/39 front/rear distribution. Axle weights 1861/1175 lb imply a slightly different rounded percentage.
- FWD with genuine continuous CVT ratio range 0.357–2.805, reverse 1.797, final drive 5.034. These are not fixed or virtual gear steps.
- 182.9 × 71.5 × 56.9 in; 106.6 in wheelbase; 62.5/62.4 in front/rear tracks; 4.7 in clearance.
- 205/60R16 tires; nominal unloaded radius 0.3262 m, not a measured effective rolling radius.
- Drag coefficient 0.299; steering ratio 15.3. Lock-to-lock turns are recorded as provenance, not asserted to be separately wired into runtime.

Nissan table peak rpm values are retained despite secondary sources listing 6400/4400 rpm. A future source correction must preserve this distinction.

## Explicit simulation assumptions

Engine torque between/outside source peaks, 750 rpm idle, 6400 rpm redline below the sourced maximum, CVT controller behavior, drivetrain loss, converter coupling, suspension, braking, differential, tire grip/33 psi, CG height 0.5 m, aero frontal area and collision subdivisions are modeling assumptions. The source does not specify them.

The initial 120 mph and 9.2 s 0–60 display/calibration values are placeholders, not factory performance claims or measured simulator results. Do not tune power or mass away from source values just to hit these targets.

Per-view wheel anchors are manually measured graphical estimates. They do not alter wheelbase or track geometry. The eight body crops and transparent cockpit have passed source import inspection; actual rendered wheel alignment remains required.

## Candidate runtime checks

Tests run against an isolated snapshot of the CVT foundation, not yet a released foundation. Editor import/serialization retains `cvt` on tuning and selected automatic transmission. The sole forward array entry is maximum CVT envelope initialization, not a fixed gear. Controller assumptions: 1800 rpm cruise, 6000 rpm full-throttle target, 1 ratio-unit/second slew; converter slip 0.1 and multiplication 1.6; drivetrain efficiency 0.84.

On flat asphalt at 120 Hz chassis/360 Hz tires with traction control:

- Full-throttle launch after eight seconds: 17.917 m/s, ratio 2.271, engine 6598 rpm. This is not a claimed factory acceleration match; converter behavior can place engine rpm above controller target.
- Powered rolling from 20 m/s at 25% throttle for four seconds: 20.011 m/s, ratio 0.964. This is a basic rolling test, not economy/range calibration.
- Reverse at 50% throttle for three seconds: longitudinal position −4.006 m and signed speed −2.157 m/s; reverse reduction remains 1.797 × 5.034.

## Release gate

The separate true-CVT foundation and these documents must pass CI together. Eight actual exterior previews and cockpit placement still require rendered inspection. No world/map files or shared catalog manifests are changed by this model preparation. Source-art inspection and model tests alone do not establish factory handling fidelity.
