# Navelwort 1978

Original Legends tribute to Markku Alén / Ilkka Kivimäki's 1978 1000 Lakes Rally-winning Fiat 131 Abarth Rally Group 4. Duplicate audit found no existing Alén/131 Abarth provenance entry. Navelwort is distinct from local and reserved separate-checkout aliases. An initial uncommitted Yarrow label was rejected by preservation tests because it was already reserved elsewhere; those exclusions remain unchanged.

## Sources and variant boundaries

- [Rally Finland organizer winners list](https://sectorallyfinland.fi/voittajat-kautta-aikojen/): explicitly confirms the 1978 winning crew and Fiat 131 Abarth.
- [FIA homologation 647](https://historicdb.fia.com/car/fiat-abarth-131-rally): Group 4, 1995 cc, four cylinders and rear-wheel drive. Later homologation extensions do not establish which parts were fitted at this event.
- [Manufacturer heritage history](https://dev-heritagehubitaly-com.aem.stellantis.com/en-uk/heritage/stories/goodwood-fiat-131-abarth): competition two-litre engine used Kugelfischer injection instead of the road car's Weber carburetor. Describes lightweight two-door saloon, large arches and cooling vents, with output developing beyond 230 horsepower. This retrospective is not a Finland 1978 dyno sheet.
- [Stellantis Heritage exhibit description](https://www.media.stellantis.com/em-en/heritage-hub-italy/press/autolook-week-heritage-takes-to-the-field-with-the-monarchs-of-rallying): confirms 1995 cc DOHC 16-valve four, five gears and independent rear suspension in the competition family. Its 215 hp and twin-carburetor description of a 1977 exhibit conflicts with the competition-injection history. Those figures are not adopted as verified 1978 equipment. Nor is its loose “1978 World Championship for Drivers” language repeated: the contemporary achievement was the FIA Drivers Cup.

## Simulation, not a homologation replica

Front-longitudinal naturally aspirated four, RWD and five-speed manual represent the competition architecture. The 227 mechanical hp target is an illustrative 230 PS-class approximation, not an assertion that an exact 230 PS event measurement exists. Mass of 1000 kg, 170 lb-ft, the complete torque curve and RPM thresholds are estimates, not road Stradale specifications or undifferentiated late-evolution figures.

All event-day ratios/final drive, differential, suspension, brakes, aero, dimensions/track widths, CG and weight distribution, 80 L tank, 185/70R15 gravel tire choice, 118 mph and 6.5-second 0–60 targets are approximate game setup. Original physical tire radius is 0.32 m; graphics fitting does not change it. Auto Assist is an accessibility mode, not a factory automatic. Production physics and generic sound remain unchanged. No validated claim about actual stage pace is made.

## Original art and fit

Ochre, forest-green and cream boxy two-door saloon, vented arches, auxiliary lights and modest spoilers. Original silver gravel wheels and a stripped felt dashboard with toggle panel, map tray and navigation box. No logos, sponsors, copied livery or third-party images. All three originals were generated with the built-in image tool. The first body had an unwanted backdrop; a targeted generation removed it and preserved the eight body views. Final PNGs are retained unchanged. Native wheel opacity normalization applies to the decoded import copy only.

Measured wheel anchors fit eight body views without altering physical wheel size. Live speed/RPM/gear/fuel occupy the left blank binnacle, with the animated wheel below. Digital telemetry, shared steering wheel and wipers are gameplay conventions, not an exact 1978 cockpit replica. The inherited static showroom picker renders its shared dark/gold-style wheel appearance instead of the authored silver gravel wheel texture; actual production race and car-editor previews use the fitted original silver wheels. This pre-existing garage distinction is documented rather than patched. No shared garage, renderer, input or physics edits.

## Validation

All local gates passed:

- 90 focused/preservation tests, including Knotgrass, Orpine, preceding Legends, Accord, Camry, Grand Caravan and native importer. Eight Navelwort tests also reran successfully after strengthening reserved-alias coverage.
- Five serialized browser tests in 5.7 minutes: desktop keyboard and handheld touch driving, actual initial/later paged-picker navigation followed by gameplay on both devices, and eight-angle production preview/cockpit compositing.
- All five vehicle-dynamics smoke cases passed.
- Full manifest/assets validation: 2,122 documents, 16 assets; manifest current.
- Independent roster audit: 187 playable cars plus 3 excluded templates, unique playable runtime identities and exactly one Alén/131 Abarth provenance entry. Separate unpublished cars were not combined.

Eight exterior preview angles, race/preview instruments, both moving cockpit layouts and the final handheld paged-picker-to-driving flow were visually reviewed. Readable live instruments and fitted original wheels are intact. Handheld descriptions use the inherited UI ellipsis. Prior Storksbill/Gromwell/Larkspur/Orpine exact roster snapshots changed only from 186 to 187, preserving unique-ID checks and all other coverage.

Evidence and sandbox-enabled configuration are in sibling `navelwort-qa`, including `final`, `eight-angle-review-detail.jpg` and gate logs. Official Headless Shell 157.0.8103.78 from sibling `storksbill-qa`, one worker and traces off. Local-only: no push, upload, merge or deployment. Full CI not run.
