# Goldilocks 1955: Mille Miglia Legend

Original local-only tribute to Stirling Moss / Denis Jenkinson’s Mercedes-Benz 300 SLR #722, winner on 1 May 1955. Full hydrated duplicate audit found no equivalent. Goldilocks was unused and clear of reserved stems. This is the open two-seat W196 S competition car, not a road 300 SL, Uhlenhaut coupé or modern SLR McLaren.

## Sources and boundaries
- [Mercedes-Benz Museum’s original #722 account](https://media.mercedes-benz.com/article/241a8222-086a-41a8-a8fa-a26eadcacb48) establishes crew, event/date, number and 07:22 start. It identifies the M196 S inline-eight and 203 kW continuous output at 7000 RPM. This rating is used instead of treating a later generic 310 PS peak claim as event dyno evidence. Its cockpit account explicitly says there was no speedometer.
- [Primary Daimler-Benz press packet dated 26 April 1955, archived by a third party](https://automotivemasterpieces.com/index.php/file/lqm82Lvrw0?app=) provides 2982 cc, injection, desmodromic actuation, dry sump, mechanical five-speed, drum brakes and staggered 6.00-16 / 7.00-16 tires. Its approximately 810 kg excludes fuel, water and oil, so is not running weight.
- [Manufacturer racing history](https://media.mercedes-benz.com/en/article/0ee71ec7-80ea-46c6-a0d4-c41b3f168a96) corroborates the winning crew and 10:07:48 record at 157.65 km/h average.

## Simulation approximations
1050 kg running mass, 235 lb-ft peak torque, full RPM curve, geometry, ratios/final drive, 170 mph / six-second 0–60 targets, suspension, aero, brake tuning and 200 L capacity are estimates, not measured Mille Miglia setup. A fixed nominal running mass does not reproduce changing endurance fuel load. Equal 175/80R16 tires approximate historical crossply stagger. Generic native physics do not reproduce swing-axle kinematics, drum fade, valve actuation or dry-sump lubrication. Auto Assist is accessibility, not a factory automatic. ABS/TC are off by default. No shared engine or renderer changes.

## Original art
New petrol-teal/copper/cream eight-view open body, enclosed fenders, low wraparound windscreen, twin headrest fairings and right-side exhausts. No copied silver/red livery, numbers, logos or third-party assets. Original period aluminum wheels and low aluminum/check-cloth cockpit with passenger route-scroll box. Digital speed/RPM/gear/fuel, shared steering wheel and generic engine audio are game conventions, not replica instrumentation. The pedal/tunnel arrangement and rectangular display are artistic approximations. Empty car-scoped wiper mounts avoid floating wipers over the open cockpit without changing the renderer. Source PNGs, prompts and hash provenance retained; wheel opacity normalization is on the decoded import copy only.

## QA
- Focused 8/8 and expanded prior-car/import/EV preservation 212/212 passed. Dynamics smoke 5/5 passed.
- Hydrated roster independently verifies 198 playable + 3 templates and unique runtime IDs. Eleven prior exact count snapshots advanced from 197 to 198 without relaxing identity or preservation assertions.
- Original source sheet, eight production-composited exterior views and editor/direct desktop/handheld cockpits reviewed: wheel fit and readable moving instruments confirmed. Open windscreen stays unobstructed; no floating shared wipers.
- Full initial manifest/assets validation: 2166 documents, 16 assets, current. Final repeat also passed. Serialized Playwright 5/5 passed, including actual desktop keyboard and handheld touch traversal 73 steps from the initial picker to index 73/page start 72, then production driving. Both later picker pages and resulting moving cockpits visually reviewed with legible live speed/RPM/gear/fuel and no page errors.
- Browser configuration uses official Google Headless Shell with `chromiumSandbox: true`, one worker, serialized QA. An initial run was intentionally stopped after the desktop drive to clear car-scoped open-cockpit wipers; the complete suite restarted on final configuration.
- The inherited showroom wheel override/rotation and handheld description ellipsis remain unchanged. Original period wheels are used in race/preview.
- Durable evidence/configuration in sibling `goldilocks-qa`. No remote writes, upload, integration or shared runtime edits. Full repository CI not run.
