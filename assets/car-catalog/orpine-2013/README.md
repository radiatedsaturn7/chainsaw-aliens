# Orpine 2013

Legends tribute to Sébastien Loeb's 30 June 2013 Pikes Peak-winning Peugeot 208 T16 Unlimited. Then-course record 8:13.878, not the current outright record. Duplicate audit found no Loeb/208 T16 entry. Existing Vatanen 405 T16 is a different car/event. Not the 1.6L five-speed 208 T16 R5 or a road 208.

## Sources and units

- [PPIHC organizer overview, p12](https://ppihc.org/wp-content/uploads/2022-PPIHC-Event-Overview.pdf): 2013 driver/result/time.
- [Period Peugeot manufacturer release](https://www.media.stellantis.com/de-de/peugeot/press/mit-875-turbo-ps-zum-gipfel-in-pikes-peak-rallye-rekordweltmeister-sebastien-loeb-startet-im-peugeot-208-t16-pikes-peak-beim-bekanntesten-bergrennen-der-welt): rear-mid 3.2L twin-turbo V6, AWD, tubular chassis, 875kg, explicitly 875PS, splitter and large rear wing.
- [Original Peugeot Sport French technical sheet, third-party archive](https://www.autorennsport.ch/fr/files/fichetechnique208pp.pdf): 24 valves, 90mkg, maximum7800rpm, 240km/h, claimed0–100km/h1.8s, six-speed paddle sequential, carbon body,4.5×2×1.3m,2.695m wheelbase,40L tank,18×13wheels and31/71×18racing tires.
- [Manufacturer retrospective](https://www.media.stellantis.com/fr-fr/peugeot/press/sebastien-loeb-et-la-peugeot-208-t16-pikes-peak-presents-aux-grandes-heures-automobiles): exact2013win date,875ch at7800rpm and875kg. This is corroboration, not a claim that a2017demonstration was the selected event.

875PS/ch converts to approximately863 mechanical hp;90mkg to883Nm/651lb-ft. English release's loose875hp wording is not silently treated as SAE bhp. Manufacturer0–100km/h1.8s is preserved separately; the game0–60mph1.9s is an estimated target, not a conversion of that claim.

The source's two1690mm “overhangs” cannot fit the stated length/wheelbase. They are explicitly excluded, not reinterpreted as track widths. Chosen front1.0/rear0.805m overhangs and1.65m tracks are simulation estimates.

## Simulation

875kg published mass and sourced principal dimensions are retained. Individual six ratios/final drive, complete torque curve/peak RPM,1400idle,7600warning threshold, shifting/launch, nominal60%rear torque allocation, differentials,CG,pressure,colliders,brakes and suspension settings are estimates.31/71×18race geometry is approximated as310/41R18 for the native editor. Physical radius0.3557m is not adjusted to fit graphics.

AeroFront0.7/AeroRear0.9 andCd0.68 express a high-downforce prototype using existing physics; these are not measured coefficients, a claimed real underfloor-load distribution, or validated altitude compensation. Published performance is not an event-day telemetry guarantee. Native manual controls represent sequential shift commands; Auto Assist is accessibility behavior.

## Original art

Original slate-blue/chartreuse hatch-prototype, enlarged splitter, wide elevated wing, mid-engine intakes and diffuser; black slick wheels; stripped carbon cockpit with blank telemetry screen. No third-party image assets, logos or copied sponsor livery. Initial low-roof concept was rejected, then hatch silhouette/aero were developed and sprites repacked with clear gutters. Only final generated PNGs are imported, unchanged. Native near-opaque wheel normalization affects the decoded copy only.

Dedicated display receives live speed, RPM, gear and fuel with animated wheel below. Shared round steering wheel is a gameplay convention, not an exact paddle-wheel replica. Original cockpit interpretation does not claim exact seating/control geometry. Shared runtime wiper positioning remains unchanged.

No shared physics, renderer, UI or input edits. Native serializers preserve provenance and original image hashes; graphics-only measured wheel anchors fit all eight angles.

## Validation

- Independent roster audit: 185 playable cars plus 3 excluded templates, all playable runtime IDs unique; exactly one Loeb / 208 T16 provenance match.
- 74 focused and prior-preservation unit tests passed, including all new catalog/fit checks and Groundsel, Marestail, prior Legends, Camry, Grand Caravan and importer coverage. The three older exact-count snapshots changed only from 184 to 185; unique-ID checks remain.
- Five serialized browser gates passed: eight-angle production preview, desktop keyboard driving, handheld touch driving, and actual initial/later paged-picker navigation followed by driving on both devices. No input or physics substitution. An additional two-picker run passed after the final description-spacing correction; its desktop picker and handheld moving cockpit were reviewed.
- All five vehicle-dynamics smoke cases passed. Full manifest/assets validation: 2,114 documents and 16 assets, manifest current.
- Visual review covered all eight rendered exterior angles, the desktop and handheld moving instrument screens, and integrated paged-picker selection. Large aero, hatch-prototype silhouette, fitted wheels and legible live telemetry were confirmed. Handheld descriptions retain the existing UI ellipsis; shared wiper overlay and round wheel are unchanged game conventions.

Durable evidence/config: sibling `orpine-qa`, including `final`, `text-final`, gate logs and eight-angle review sheets. Official Headless Shell 157.0.8103.78 reused from `storksbill-qa`, with `chromiumSandbox: true`, one worker and no traces. Local-only: no push, upload, merge or deployment. Full CI not run.
