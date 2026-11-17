# Butterbur 1991: rotary endurance Legend

Original local-only tribute to Johnny Herbert, Volker Weidler and Bertrand Gachot’s 1991 Le Mans overall-winning Mazda 787B #55, chassis 787B-002. Not the earlier 787/767B, a road RX-7 or a later demonstration tune. Exact provenance duplicate and all local/reserved alias audits were clear for Butterbur before import.

## Primary references and unit boundaries
- [Mazda chassis and team specifications](https://www.mazda.com/en/experience/mspr/motorsports/lemans/mazda787b/): #55/002, winning crew, dimensions4.782×1.994×1.003m, wheelbase2.662m, tracks1.534/1.504m, Mazda-Porsche five-speed, carbon brakes, four654cc rotors and4,708.8cc FISA equivalency.
- [Mazda R26B technical history](https://www.mazda.com/en/experience/mspr/motorsports/lemans/r26b/):700PS at9000rpm and62kg-m at6500rpm; naturally aspirated four-rotor architecture, variable intake and three-plug ignition.
- [Mazda UK anniversary](https://uk.mazda-press.com/news/2021/2021-marks-the-30th-anniversary-of-mazdas-famous-win-at-the-1991-le-mans-24-hours-/): confirms23June1991 victory and crew. Its700bhp shorthand is not treated as identical to the technical700PS.
- [ACO account](https://www.24h-lemans.com/en/news/mazda-787b-treasure-of-le-mans-2128): corroborates crew and1991 overall result. Historical claims about later Japanese victories remain time-bound.

The configuration converts700PS to about690.4 mechanical hp and62kg-m to about448.4lb-ft; native serializer rounds headline values to690hp/448lb-ft. The curve retains converted endpoints.2.616L means swept rotary volume, not piston capacity or the4.7088L regulatory equivalent. Detailed Mazda table says over839kg while its overview says830kg;850kg is an illustrative game mass, not an asserted loaded event weight.

## Implementation estimates
Native torque/RPM dynamics and generic engine audio do not simulate rotary cycles, variable intake, three-plug firing or the distinctive R26B scream. No shared engine/audio changes. All intermediate curve points, idle/limiter,205mph and3.2second0–60 targets, gear ratios/final drive, mass distribution, suspension, aero coefficients, brake tuning and100L tank are estimates. Equal325/33.5R18 tires approximate mean diameter, not actual300-640R18 front/355-710R18 rear stagger. Manual five-speed architecture is sourced; Auto Assist is accessibility only. No ABS or traction control by default.

## Original visual interpretation
New silver/indigo/coral eight-angle Group C silhouette: low bubble cockpit, flat wedge nose, covered lamps, cooling sidepods, elevated rear wing and diffuser. No Renown green/orange diamonds, copied livery, sponsor logos, race numbers or third-party assets. New silver center-lock-style slick wheels and close carbon-composite right-hand cockpit with toggle bank and gear lever. Runtime speed/RPM/gear/fuel occupy the blank binnacle; digital readout and shared steering wheel/wipers are game conventions. Source PNGs retained unchanged, SHA-256 provenance, native decoded-wheel opacity normalization and measured wheel openings. Physical radius is not enlarged for graphic fit.

## Validation
- Focused car/fit tests:8/8 passed. Prior-car/import preservation:142/142 plus Skullcap9/9 passed (151 total).
- All five dynamics smoke cases passed: acceleration, steering, braking, curb strike, airborne landing.
- Full manifest/assets validation passed:2,150 documents,16 assets. Independent native roster audit:194 playable cars,three excluded templates,194 unique runtime identities.
- Original exterior eight-view composites, measured wheel fit, live right-hand cockpit and direct desktop/mobile driving visually reviewed. Instruments remain unobstructed. Shared wipers sit high across the windshield in drive and near the roof edge in editor preview; left unchanged. Shared showroom overrides authored wheels with dark/gold appearance; actual race and preview retain original silver slicks. Mobile description ellipsis is inherited.
- High-power RWD without TC can spin tires under prolonged first-gear full throttle. Driver inputs should include throttle modulation and shifting; no historic handling fidelity claim.
- Seven prior exact count snapshots updated193→194; unique-ID checks and other coverage preserved. Full repository CI was not run.
- Serialized official Google Headless Shell with Chromium sandbox enabled, one worker:5/5 browser tests passed. Actual keyboard/touch paged pickers traversed31 steps, selected Butterbur and drove production physics; direct drive and editor preview also passed. Both picker pages and resulting moving cockpits visually reviewed; live samples were about36mph desktop and51mph handheld with changing RPM and no page errors.

Evidence remains in sibling `butterbur-qa`; no remote writes, shared runtime changes or cross-checkpoint integration.
