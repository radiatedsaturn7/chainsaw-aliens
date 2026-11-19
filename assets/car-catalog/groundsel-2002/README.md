# Groundsel 2002: ordinary First Keys sedan

Reference: stock mainland-US 2002 Ford Focus SE four-door sedan, 2.0L SOHC SPI four-cylinder, standard iB5 five-speed manual, FWD/LHD. Not SVT, ZX3, ZTS, Zetec, ST, wagon or SE Comfort. Dark teal paint, factory five-spoke 15-inch alloys, body-color side moldings, black handles/mirrors, cloth, A/C and solid roof. No optional ABS, traction control, rear stabilizer, spoiler or fog lights.

## Sources and limits

- [Original Ford US brochure](https://xr793.com/wp-content/uploads/2016/10/2002-Ford-Focus.pdf), pp7–9: exact trim, SPI/5MT, 195/60R15 and five-spoke alloys, body-color moldings, equipment, front struts and rear independent Control Blade, no SPI rear stabilizer, optional ABS and 13.2 USgal tank.
- [Direct Ford owner guide](https://www.fordservicecontent.com/Ford_Content/catalog/owner_guides/02focog3e.pdf), printed pp320–321: 110hp at5000rpm,125lb-ft at3750rpm,9.35:1,2615mm wheelbase. Exact printed page images inspected. Exterior dimension ranges are not exact trim values; printed length mm/in conversions conflict.
- [Factory iB5 workshop specification archive](https://workshop-manuals.com/ford/focus_1999_08.1998-12.2004/mechanical_repairs/3_powertrain/308_manual_transmission-transaxle_clutch_and_transfer_case/308-03a_manual_transmission-transaxle_vehicles_with_5-speed_manual_transmission_%28ib5%29/specifications/): SPI column ratios3.154/1.926/1.281/.951/.756,reverse3.615,final3.610.
- [Factory rear drum specification archive](https://workshop-manuals.com/ford/focus_1999_08.1998-12.2004/mechanical_repairs/2_chassis/206_brake_system/206-02_drum_brake/specifications/):203mm nominal drum. No precise front rotor diameter claim.

1180kg mass is explicitly provisional, not verified exact SE manual curb weight. Width1.70m,length4.445m,height1.445m,tracks1.485/1.477m are estimated baseline geometry; wheelbase is sourced. Front60% weight, CG.55m, steering15.8, redline5500/limit5800, off-peak torque, tire grip/pressure, suspension/damping, brake bias, driveline losses, shift timing and performance targets remain simulation estimates. Do not call this a measured road-test replica. Auto Assist uses the same manual hardware ratios, not the separately offered factory automatic.

## Duplicate audit and original art

Decoded all current exported car documents, including compressed ones, and searched production provenance. Only existing Focus is Aster1702003, an SVT ZX3 six-speed three-door; not a duplicate of this SOHC sedan. Separate unpublished Escort shares engine lineage but is a different model/platform. Groundsel alias is unused; none of the reserved unpublished aliases were added.

Eight original logo-free body views, blank-cluster LHD manual dashboard and plain five-spoke wheel texture were generated with built-in imagegen. Targeted body edit corrected standard SE moldings and cell padding. Original final PNGs retained unchanged; native import normalizes near-opaque decoded tire alpha, fits tire regions, calibrates wheel openings and installs live instruments. See art-prompts.md. No shared runtime or renderer edits. Existing generic animated steering wheel/audio and digital instrument style are game conventions. Inherited viewport-dependent wiper placement is accepted only if the live cluster remains unobstructed.

## Independent checkpoint and QA

Base a83f4ed07224557e378fddb5604f76bdfd6afa39 had183 non-system cars plus3 templates. Groundsel yields184 playable plus3 templates **in this independent continuation**, not integration with the other unpublished184 checkpoint. Storksbill/Gromwell/Larkspur exact-count assertions are updated only to reflect this addition; uniqueness and all other assertions remain.

Verified locally 2026-11-17:
-67 focused/preservation unit tests pass, covering all seven independent continuation cars, native imports/roundtrips, launch/contact and wheel coverage. The final front/rear tire anchor fit is included.
-Five vehicle-dynamics smoke tests pass.
-Full `python tools/project_manifest.py --check --validate-assets` passes:2110 documents,16 assets,complete published manifest.
-Five sandbox-enabled serialized Playwright tests pass in5.2minutes:actual production preview,desktop keyboard drive,handheld touch drive,and both actual initial/later-page pickers followed by real-input driving. No page errors or crashes.
-Both picker tests select Groundsel at page start68 of184 choices with75 cars loaded, not eager-loading the whole roster. Handheld picker drive reaches11.93m/s and travels25.00m,RPM750→5480;desktop picker drive reaches9.98m/s and24.93m. QA movement samples are not measured performance specifications.
-Visually reviewed all eight final production-composited angles,initial/later picker pages and desktop/handheld live cockpits. Front/rear wheel presentation was improved during review,then the complete final browser suite rerun. Instrument cluster remains legible and unobstructed; inherited desktop wipers can float above the dash without covering it.

Commands: `node --test tests/unit/{groundsel,marestail,marjoram,selfheal,storksbill,gromwell,larkspur}{Catalog,WheelCoverage}.test.js tests/unit/carCatalogImport.test.js tests/unit/catalogRoundtripDefaults.test.js`; `npm run test:vehicle-dynamics:smoke`; Playwright `groundsel-{preview,driving,static-picker}.spec.js` with sibling sandbox-on configuration,workers1,traceoff. Durable logs, screenshots and sandbox-enabled single-worker browser configuration are in sibling groundsel-qa; factory source evidence is in focus-source-qa. No push, upload, merge or deployment; full project CI not claimed.
