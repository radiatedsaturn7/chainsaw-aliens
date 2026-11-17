# Heartsease 1991: Bathurst Group A Legend

Original local-only tribute to Jim Richards / Mark Skaife’s #1 Nissan Skyline GT-R R32 Group A, winner of the Tooheys 1000 at Mount Panorama on 6 October 1991. No equivalent R32/BNR32 or crew/event provenance was found across hydrated native cars. Heartsease was unused and not reserved. This is not a road GT-R with race graphics, the 1992 winner, a Japanese Calsonic car or Spa #25.

## Evidence boundaries
- [Supercars official history](https://www.supercars.com/news/30-years-on-skaife-richards-and-godzilla-attack-the-mountain) identifies the date, crew, #1 and one-lap win. Its 293 km/h Conrod observation is event context, not a universal top-speed promise.
- [Nissan anniversary release](https://usa.nissannews.com/en-US/releases/nissan-celebrates-25-years-since-first-bathurst-1000-victory) corroborates the 1991 R32 win and crew; the 2016 tribute Altima is not the reference car.
- [Holinger GRA-6N](https://holinger.com.au/showroom/gra-6n) establishes the manufacturer’s Group A six-speed designed for Nissan Motorsport’s R32 and 4WD transfer case, distinct from the standard five-speed and later sequential design. Exact Bathurst ratios are not provided.
- [Nissan’s 1991 Spa Group A exhibit](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/327_zexel_skyline_gt-r.html) corroborates RB26DETT 2568 cc twin-turbo inline-six and ATTESA torque-split AWD architecture. Its dimensions/wheelbase serve as platform reference, not Australian event measurements; its 1250 kg/550 PS specification is not imported as Bathurst tuning.

## Explicit simulation approximations
620 hp, 450 lb-ft, 1360 kg, complete torque/RPM curve, 182 mph and 3.8-second 0–60 mph targets are estimates, not exact 1991 dyno/ballast figures. No road 280 PS or 1992 restrictions silently substituted. Tracks, gear ratios/final drive, suspension, aero, brake tuning, 120 L tank and 265/40R18 tires are estimates. The native model uses a fixed nominal 65% rear bias with generic differential load sharing, not the authentic adaptive ATTESA hydraulic controller or Gibson boost/ECU strategy. No shared drivetrain implementation was altered. Six-speed manual architecture and visibly stripped competition cabin distinguish this from a road build. Auto Assist is accessibility only; no ABS/TC by default.

## Original artwork
New forest-green/sand/lavender eight-view shell with rectangular headlights, restrained wing, round rear lights, cage and race splitter. No copied 1991 red-white-blue or 1992 tobacco livery, sponsors, numbers or logos. New off-white touring slick wheels and a right-hand molded black dashboard, cage and bare alloy floor. Live speed/RPM/gear/fuel occupy its blank binnacle. Source PNGs, prompts and SHA-256 provenance retained; native opacity normalization affects only decoded tire copy. Measured wheel anchors preserve physical tire radius. Generic audio, digital telemetry and shared wheel/wipers are game conventions.

## QA
- Focused unit tests: 8/8; focused plus prior-car/import preservation: 167/167.
- Vehicle dynamics smoke: 5/5. Full manifest/assets validation: 2158 documents, 16 assets, current.
- Independent hydrated roster audit: 196 playable cars + 3 templates, all playable runtime IDs unique. Nine prior exact-count snapshots advanced from 195 to 196 without relaxing unique-ID or preservation checks.
- Reviewed original source sheet, all eight production-rendered angles, editor cockpit and moving desktop/handheld cockpits. Tires cover their openings without flattened geometry; instruments remain inside the right-side binnacle and readable in motion. The inherited showroom dark/gold wheel override differs from the race’s off-white wheels. Shared wipers sit high in the race windshield and along the roof edge in editor preview; neither covers the instruments. These shared behaviors were not changed.
- Serialized Playwright: 5/5 passed, including real keyboard and handheld touch navigation from the initial picker page to index 80, then production-physics driving and changing live instruments. Both later-page pickers and resulting moving cockpits reviewed; handheld description truncation is the existing picker convention. Official Google Headless Shell runs with `chromiumSandbox: true`; durable evidence and configuration are in sibling `heartsease-qa`.
- Full repository CI was not run. Local-only; no shared runtime edits, remote writes or cross-checkpoint integration.
