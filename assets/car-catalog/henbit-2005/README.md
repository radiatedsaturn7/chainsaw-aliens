# Henbit 2005: ordinary First Keys automatic

Reference: mainland-US2005 Chevrolet Malibu base Sedan,nominal2.2L Ecotec DOHC four-cylinder,4T45-E four-speed automatic,FWD/LHD. Not Malibu Classic,Maxx,LS/LT,V6,SS or sport/appearance package. Plain cloth/manual A/C,powerwindows/locks/mirrors,floor automatic shifter,15-inch steel wheels with broad five-split-spoke full covers. No optional ABS/traction control,fogs,spoiler or sunroof. Muted blue2994 salvage paint,gray automatic cabin.

## Primary evidence

[Direct GM2005 Heritage kit](https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/2005-Chevrolet-Malibu.pdf),physicalPDFpp12–14/printed4–6,downloaded and visually inspected:3174lb/1440kg base curb mass,62/38 distribution;WB2700mm,L4783,W1776,H1461,tracks1524/1506,clearance154. Exact4T45-E ratios2.96/1.62/1/.68,reverse2.14,final3.63. P205/65R15 on15x6.5steel;frontdisc276x26/reardrum230x40;15.9electric rack steering;frontstruts/tubular stabilizer,rear4-link/solid stabilizer;6500maximum engine speed;16.3USgal tank.

[Original2005 GM US sales specsheet](https://xr793.com/wp-content/uploads/2023/07/2005-Chevrolet-Malibu-Spec-Sheet.pdf),p2:145hp at5600rpm,155lb-ft at4000,exactbase2.2/4AT,equipment and five broad split/Y-like full wheel-cover pattern. Optional ABS+TC not fitted. Wide plain chrome grillebar retained without logo.

Source discrepancies preserved:technical kit144hp vs sales145hp,both5600rpm;145selected. Technical displacement2189cc appears inconsistent,so nominal2.2L only,not an exactcc claim. Technical tank16.3gal selected over salesapproximately16. Bodycolorhandles/blackmirrors corroborated by exact-base appearance listings,not primary text;blackmolding supported by factory appearance package adding body-color moldings.

## Estimates and gameplay conventions

6200redline distinct from sourced6500maximum,750idle,off-peak torque interpolation,CG.54m,Cd.34,collider subdivisions/overhang split,tiregrip/pressure,spring/damper/anti-roll coefficients,brake bias,converter behavior,shift timing,efficiency and performance targets are simulation estimates. No measured road-test replication claim. Manual Assist retains the4AT ratios/hardware and is not a factory manual. Generic audio,digital live instruments and common animated steeringwheel are game conventions.

## Audit and art

Decoded every current car export,including compressed documents,and searched production provenance: no Malibu duplicate. Henbit unused,avoids all reserved aliases including rejectedYarrow and pendingWoodbetony. Prior independent cars preserved unchanged.

Original built-in imagegen eight-angle body,plain automatic cockpit/two pedals and stock split-spoke wheel-cover textures. Rejected initial hazy body/extraction outputs; regenerated clean-alpha body,then corrected plain chrome grillebar and removed foglights. Wheelcover pattern corrected against factory image. Final original PNGs retained unchanged; native decoded wheel-alpha normalization,region fitting,body/wheel-anchor calibration and live speed/RPM/gear/fuel placement. Prompt record in art-prompts.md. No shared runtime/renderer edits.

## Independent checkpoint and QA

Base26d599c09f2ea8ef5b44fd228b69dcbd9dacba95 had187 playable+3templates. Addition yields188+3 independently,not merged with separate184checkpoint. Existing Storksbill/Gromwell/Larkspur/Orpine/Navelwort exact-count assertions updated only for this addition,all uniqueness/other assertions retained.

Verified locally on 2026-11-17:

- 99 focused/preservation unit tests pass, including all eleven independent continuation cars, native imports/roundtrips, launch/contact and wheel-opening coverage.
- Five vehicle-dynamics smoke tests pass.
- Full `python tools/project_manifest.py --check --validate-assets` passes: 2126 documents, 16 assets, complete manifest.
- Five sandbox-enabled, single-worker Playwright tests pass in 5.6 minutes: production preview, keyboard/touch drives, and actual initial/later-page picker selection followed by real-input editor drives. No page errors or crashes.
- Both pickers select Henbit at page start 80 of 188 choices; 87 cars loaded, not eager-loading the whole roster. Desktop picker-drive sample: 36.16 m traveled, 12.38 m/s. Handheld: 28.26 m, 12.46 m/s, RPM changing from idle to 4432. These are QA samples, not performance specifications.
- All eight production-rendered exterior angles and desktop/handheld live cockpits visually reviewed. Stock split-spoke covers fit authored wheel openings; instruments remain legible and unobstructed. Actual picker shared-Stock cosmetic mismatch confirmed separately below.

Tests are `henbit-{preview,driving,static-picker}.spec.js` and `henbit{Catalog,WheelCoverage}.test.js`; sibling configuration retains official Chrome for Testing sandbox, one worker and trace off. Durable evidence in sibling henbit-qa;factory kit/table evidence in malibu-source-qa. Full project CI not claimed. No push/upload/merge/deployment.

Inherited garage caveat: actual picker uses GarageSystem.stockBaseline(),unconditionally applying sharedStock tire definition. This replaces authored covers with common gold/dark tireart. Correct original wheelcovers remain in authored-car/editor/race previews. Picker tests select real entry then load that selected authored car into race editor;campaign garage preservation is not claimed. Shared override unchanged. Inherited desktop wipers may float above dash,but must not obstruct live instruments.
