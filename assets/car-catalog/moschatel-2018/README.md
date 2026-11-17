# Moschatel 2018: electric Pikes Peak Legend

Original local-only tribute to Romain Dumas’s Volkswagen I.D. R Pikes Peak, overall record winner on 24 June 2018 in 7:57.148. The full hydrated roster contained no equivalent; Orpine’s Dumas reference was comparison context, not this car. Moschatel was unused and clear of reserved local/separate stems. This is not the revised 2019 Nürburgring, Goodwood or Tianmen configuration.

## Primary evidence
- [PPIHC organizer history](https://ppihc.org/course-record-holder-romain-dumas-returns-for-the-99th-running-of-the-race-to-the-clouds/) establishes driver, 2018 car and record result.
- [Volkswagen’s launch release](https://www.vwpress.ch/press/der-volkswagen-id-r-pikes-peak-motorsport-treibt-elektromobilitaet-auf-die-spitze) establishes twin electric motors, combined 500 kW and 650 Nm, and the 24 June event. Use kW as canonical: 680 PS is not 680 mechanical hp.
- [VW-group drivetrain release](https://www.porscheholding-newsroom.at/pressemeldungen/detail/2018-06-12-hochkomplex-und-hocheffizient-die-antriebstechnologie-des-id-r-pikes-peak) describes separate axle motors, linked lithium-ion battery blocks, active torque distribution and brake-by-wire energy recovery.
- [Manufacturer-authored 2018 technical sheet, third-party archive](https://www.wwwatts.net/news/2018/04/img/2018-04-12_vwms_ppihc2018_technische-daten_idr-pp_en.pdf) provides 5.20 × 2.35 × 1.20 m, 2.85 m wheelbase, 1.60 m track, 31/71-18 tires, under 1100 kg including driver, approximate 240 km/h and grip-dependent 2.25 seconds 0–100 km/h. That is not a 0–60 mph figure or an exact event weigh-in.

## Honest native EV model
The existing production electric powertrain bypasses combustion torque, idle, clutch, shifting and combustion audio. It models combined motor torque/power, a fixed reduction, real battery energy depletion and bounded regeneration, and zero propulsion at an empty battery. The cockpit displays live speed, battery power in kW, direction gear and battery reserve, not a fake fuel gauge or combustion tachometer. The displayed battery input includes modeled losses and conservative substep energy accounting, so it can exceed the 500 kW mechanical motor limit; it is not labeled motor output.

Unpublished quantities are explicit simulation assumptions: 40 kWh usable capacity, 9:1 reduction, 18000 motor RPM, efficiencies, regeneration limits and lift-off behavior. Selected running mass is 1090 kg, below the published bound, not a verified race measurement. Generic AWD uses nominal 50% rear distribution and differential load sharing, not authentic independent axle/inverter control. No faithful thermal, voltage, cooling, charging or brake-by-wire blend is claimed. No guaranteed 20% energy recovery or reproduction of the record time.

A new test initially inherited another car’s 60 mph in five seconds assertion. Measured here, the generic TC-enabled fixture reaches 23.925 m/s (53.52 mph) in five seconds. The final car-specific test explicitly guards the measured 20–30 m/s band, one forward ratio, zero combustion torque and battery expenditure. No tuning was changed to hide that result; existing preservation and gameplay assertions were retained. The metadata’s 2.2-second 0–60 target is an estimate, not achieved performance. OEM acceleration is context only.

Aero, suspension, CG, brake tuning, tire pressure and collision envelope are estimates. Shared runtime was not edited.

## Original art and fit
Original midnight-plum/ivory/mint eight-view prototype, central canopy, separate sculpted fenders, huge high-downforce wing and no exhaust, sponsor marks or copied silver-blue livery. Original graphite slick wheels and carbon cockpit overlay; the centered single-seat dashboard is artistic interpretation, not an exact cockpit survey. Source PNGs and prompts retained with hashes. Native opacity normalization affects only the decoded wheel copy. Wheel anchors fit original openings without changing physical tire radius.

## QA
- Focused: 11/11. Expanded preservation including prior cars, importer, EV runner/worker/integration and Volt-Hound: 204/204. Dynamics smoke: 5/5.
- Full manifest/assets validation: 2162 documents, 16 assets, current. Independent hydrated audit: 197 playable + 3 templates, unique runtime IDs. Ten prior exact-count snapshots advanced from 196 to 197, preserving all identity/preservation assertions.
- Eight production-rendered angles, editor cockpit, direct keyboard/handheld drives, and both desktop/handheld paged-picker-to-drive reviewed. Original wheel openings covered and live battery instruments fit. Serialized Playwright 5/5 passed: actual keyboard/touch navigation 79 steps backward to selection index 118 (page start 116), then production driving with changing battery telemetry, single forward ratio and no combustion sound.
- Shared wipers remain high in the windshield/at the editor roof edge without hiding instruments. The shared showroom overrides wheel appearance and rotates the selected car, so front/rear views look narrower than side views. Handheld descriptions use existing ellipsis. EV editor hp conversion displays an inherited long decimal; no shared UI edits.
- Official Google Headless Shell uses `chromiumSandbox: true`, one worker, serialized tests. Durable logs/configuration/screenshots live in sibling `moschatel-qa`.
- No remote writes, uploads, shared runtime changes or cross-checkpoint integration. Full repository CI not run.
