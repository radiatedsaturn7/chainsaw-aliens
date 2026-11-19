# Cicely 2010

Original Legends tribute to Carlos Sainz / Lucas Cruz's 2010 Dakar-winning Volkswagen Race Touareg 2 TDI prototype. Not the later Race Touareg 3, the 2011 winner or a road Touareg SUV. Duplicate and alias audits found no existing Sainz/RT2 entry or Cicely collision, including reserved aliases such as Yarrow.

## Sources and boundaries

- [Volkswagen's original Dakar 2010 dossier](https://www.volkswagen.es/comunicacion/dossier/rally-dakar-2010/), published 23 December 2009: names RT2 and Sainz/Cruz; technical table verifies the 2.5-litre twin-turbo inline-five diesel behind the front axle, permanent AWD and longitudinal five-speed sequential. It lists 1787.5 kg minimum, 4.171 × 1.996 × 1.762 m dimensions, 2.82 m wheelbase, 1.75 m tracks, 235/85R16 tires and 250 mm travel. These are competition figures, not road-SUV specifications.
- [Volkswagen's following-year final report](https://www.volkswagen.es/comunicacion/triunfo-de-volkswagen-al-attiyah-gottschalk-ganan-el-dakar/): historical paragraph confirms Sainz/Cruz won in 2010. The report's current-event RT3 and 310 CV are deliberately excluded.
- [Driver's contemporary official report](https://www.carlos-sainz.com/inicio-positivo-de-carlos-sainz-en-el-dakar/): identifies Sainz/Cruz and Race Touareg 2 at Dakar 2010.

The original dossier conflicts internally: its prose says 300 CV, while its technical table says about 280 CV. This simulation conservatively uses the table baseline, 280 metric CV ≈ 276 mechanical hp, without claiming a settled event-day output. Estimated 450 lb-ft is about 610 Nm, consistent with the published “over 600 Nm,” not a measured peak. Published minimum mass is used, not asserted fully fueled stage mass. The published 0–100 km/h claim of 6.1 seconds is distinct from the estimated game 0–60 mph target of 6.2 seconds.

## Native diesel approximation

Read-only inspection verified `PowertrainModel.getTorqueNmAtRpm` consumes authored curves and the existing drivetrain supports AWD/differential distribution. Runtime resolution preserves the low-RPM curve, 900 idle, 4500 warning redline, 5000 limiter and 0.40295 m physical tire radius. No shared engine/drivetrain code was changed. Diesel delivery is approximated through the curve; there is no new diesel combustion, turbo-stage, altitude, sound or thermodynamic model. Generic engine audio remains.

Five-speed sequential is represented by existing manual shift commands; Auto Assist is accessibility, not a factory automatic. Individual ratios, 4.4 final drive, nominal equal torque split, differential locks, RPM thresholds, complete torque curve, shift/launch behavior, CG, overhang split, springs/damping, pressure, brakes, aero and underbody protection are estimates. Sourced external dimensions, tire size and suspension travel are retained.

Existing generic fuel mechanics are retained. Estimated 250 L capacity fits the unchanged 100-US-gallon native cap. Reference 12 US MPG and 0.3 US gal/hour idle are gameplay assumptions, not verified Dakar consumption or range. No fuel-type selector or exact fuel-mass calculation was invented.

## Original art and fit

Original turquoise/orange/sand compact rally-raid body, roof cooling intake, rear vents, skid plates, tall cabin and substantial clearance. Dark allterrain wheels, tubular cockpit, blank roadbook roller, unlit navigation screens and ventilation hoses. No sponsor livery, logos or third-party assets. Three built-in generated PNGs copied unchanged; prompts recorded alongside. The roadbook/navigation displays are decorative, not functioning navigation.

Live speed/RPM/gear/fuel fit the blank left instrument screen, animated shared wheel below. These instruments, wheel and wipers are game conventions rather than exact cockpit replicas. Graphics-only measured wheel anchors do not change physical tire size. Native wheel opacity normalization affects the decoded copy only. The inherited static showroom rotates/scales thumbnails and uses its shared wheel appearance rather than the authored tire texture; production race/preview uses the fitted dark allterrain wheels. No shared garage, rendering or input changes.

## Validation

All local gates passed:

- 108 focused/preservation unit tests, including native diesel-curve resolution, dirt/gravel 8.75% grade climbs, Henbit, preceding Legends, Accord, Camry/van and native importer.
- Five serialized browser tests in 4.1 minutes: actual desktop keyboard and handheld touch driving, initial/later paged-picker-to-drive flows on both devices, and eight-angle production preview/cockpit compositing.
- Five vehicle-dynamics smoke cases passed.
- Full manifest/assets validation: 2,130 documents and 16 assets; manifest current.
- Independent audit: 189 playable cars plus 3 excluded templates, unique playable runtime identities and exactly one Sainz/RT2 provenance entry. Separate unpublished cars were not combined.

Eight rendered exterior angles, moving desktop/handheld instruments, preview cockpit and integrated picker-to-drive evidence were visually reviewed. Original fitted wheels and live telemetry are intact. Handheld descriptions retain the shared UI ellipsis. Prior Storksbill/Gromwell/Larkspur/Orpine/Navelwort exact snapshots changed only from 188 to 189; unique-ID checks and all other coverage remain.

Durable evidence/configuration: sibling `cicely-qa`, including `final`, eight-angle review sheet and gate logs. Official Headless Shell 157.0.8103.78 reused from `storksbill-qa` with `chromiumSandbox: true`, one worker and traces off. Local-only; no push, upload, merge or deployment. Full CI not run.
