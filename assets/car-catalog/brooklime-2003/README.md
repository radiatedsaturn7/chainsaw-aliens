# Brooklime 2003 / First Keys

Stock US 2003 Ford Ranger XL Regular Cab, six-foot Styleside bed, 2WD, 2.3 DOHC four-cylinder / Mazda M5OD-R1 five-speed manual. Oxford White with Dark Graphite vinyl. Not Edge, FX4, Flareside, SuperCab, V6 or a lifted/off-road pickup. Decoded roster audit found no Ranger/B2300 reference; tracked name-stem audit across assets/docs/tests found Brooklime unused. Separate Dakota and pending Buick are not imported or conflated.

## Primary evidence

[Original Ford brochure](https://www.therangerstation.com/resources/pdf_documents/2003_ford_ranger_brochure.pdf), PDF8–11:143hp5250/154lb-ft3750;2.3/manual3.73axle;187.5/69.4/64.9in length/width/height,111.4in wheelbase,33.3/42.8in overhangs. P225/70R15 blackwalls and15inch argent stampedsteel wheels/smallcentercaps. Vinyl60/40bench,blackvinylfloor,AM/FM2speakers,manualwindows/locks,heater without optionalAC,smallfloortray2cupholders. Paintedbumpers,bodycolor grille surround/platinumpaintedbars,flat hood,no fogs/alloys/powerpackage. OxfordWhite/graphite pairing in factory chart. FrontSLA/rear2stageleafsprings/frontstabilizer;standard4wheelABS/EBD,frontdisc/reardrum,powerrackpinion.

[Ford Service Engineering 2003 powertrain guide](https://www.fordexplorerclub.ru/powertrain/2003_powertrain.pdf), PDF25/printed30, visually verified: MazdaHofu M5OD-R1 for2.3/3.0,ratios3.72/2.20/1.50/1/.79,reverse3.40. Thus manual gearing and final are primary-supported. AutoAssist is an accessibility/game shift mode over these same5MT ratios,not a factory automatic.

[Factory owner manual](https://www.therangerstation.com/resources/manuals/2003_ford_ranger_owners_manual.pdf):58.5/57.3in tracks and16.5USgal SWB tank. Its62.7in height conflicts with brochure64.9;brochure selected.

## Explicit estimates

**Curbmass3002lb/1362kg is provisional,not independently factory-verified.** Idle750/redline6000/limit6250,offpeak torque,58percentfront,CG.65,Cd.43,steering18.2,bodycollider subshapes/CG placement,bodygroundclearance.20m(not brochure rearaxle clearance),32psi/grip.78,suspension/damping/antiroll,brakebias,clutch/shiftbehavior,efficiency.86 and100mph/11s targets are estimates,not road-test calibration. Open rear differential is a baseline inference;limited-slip was optional. Native digital instruments/common animated wheel/generic audio and worn2994finish are game conventions.

## Original art and implementation

Original logo-free eight-view white regular-cab body,graphitevinyl manualcockpit/crankwindows/threepedals,and plainargentsteel/blackwalltire sheet. Added small factory-style dualcupholdertray next to gearboot. Final PNGs unchanged;native importer normalizes decoded wheelalpha. Separate treadframe0/roundwheelframe2;source hashes recorded. No shared runtime/editor changes. The car-scoped build.mjs uses existing serializers;run only into a destination lacking this car/art.

## QA scope and inherited caveat

Sibling brooklime-qa retains source PDF/text,serialized sandbox-enabled browser config/logs,motion and pickerJSON,screenshots and unit/manifest/dynamics logs. Real desktop keyboard and handheld touch traverse the actual paged picker,then drive the authored selection with production physics in RaceEditor. This does not claim campaign equipment preservation.

Inherited GarageSystem stock baseline overrides original wheel graphics with the common dark/gold tire/rim in picker/showroom. Authored-car preview and RaceEditor drive preserve argent steel wheels. No shared fix attempted. Inherited wipers can float above dash;live instruments must remain clear and readable. This is one independent local addition,not integration with the separate184 checkpoint.

Art QA correction: the cupholder edit introduced a tinted windshield gradient. It was rejected in the actual desktop driving screenshot and repaired through imagegen. Final original PNG now has exactalpha0 at nine central windshield sample points, covered by a regression test. Only final-art browser results count; rejected evidence is retained separately under brooklime-qa/pre-alpha-fix.

Handheld visual fitting: native cluster moved lower within the existing blank binnacle ([290,400,290,80] in1536x1024) to keep inherited wiper artwork clear of the live number row. This changes only this car's instrument anchors,not shared rendering. Final run uses both repaired transparency and lower cluster; earlier fitting evidence retained separately.

Verified final local gates:149/149 focused/preservation/import/roundtrip tests;5/5 vehicle-dynamics smoke;5/5 serialized sandbox-enabled browser tests. Both actual paged pickers selected Brooklime atindex25 among193choices;real keyboard/touch drives and live instruments passed without page errors. All eight production angles,final desktop/handheld cockpits and both picker screens visually reviewed. Manifest asset check:2146documents/16assets,plus final post-fitting manifest recheck. Independent193playable+3legacytemplates;not a combined playable count with separate184. Earlier interrupted art-fitting runs are not counted.
