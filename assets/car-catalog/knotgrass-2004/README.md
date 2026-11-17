# Knotgrass 2004: ordinary First Keys sedan

Reference: mainland-US2004 Hyundai Accent GL FOUR-DOOR,1.6DOHC four-cylinder,standard five-speed manual,FWD/LHD. No Popular Equipment Package,GT sport trim,3-door or later-generation hardware. Skinny175/70R13 steel wheels/deluxe covers,body-color handles/mirrors/moldings/bumpers,manual windows/locks/mirrors,cassette,standard A/C,gray cloth. Beige faded2994 salvage finish is creative,not a factory color claim.

## Evidence and uncertainty

[Original2004US factory brochure](https://xr793.com/wp-content/uploads/2017/02/2004-Hyundai-Accent.pdf),physicalPDFpp8–9 downloaded,table text and renderedpage9 inspected:103hp5800rpm,106lb-ft3000,10:1 compression,2290lbmanual mass,11.9USgal. Dimensions166.7x65.7x54.9in,96.1wheelbase,tracks56.5/56.1. Front MacPherson/rear independent multilink coils,frontdisc/reardrum,power rack-and-pinion. Standard5MT and rounded3.84final. Manual windows/locks/mirrors rather than optional power package; no GT14-inch alloys,fogs,spoiler or sport suspension.

[Archived2005 factoryLC1.6 service manual,page32](https://www.manualslib.com/manual/4537474/Hyundai-Accent-2005.html?page=32):M5AF3 ratios3.615/2.053/1.370/1.031/.825,reverse3.250,final3.842. Applying detailed ratios to2004 is explicitly an adjacent-year hardware inference,not exact-year verification. Auto Assist uses the selected manual hardware,not the optional4AT.

Unverified simulation values:6200redline/6500limiter,750idle,off-peak torque interpolation,16.5steering ratio,60%front weight,CG.51m,Cd.32,collider subdivisions/overhang split,tire grip/pressure,spring/damper/anti-roll coefficients,brake bias,shift/clutch behavior,drivetrain efficiency and performance targets. ABS/TC off is the selected simulation baseline; brochure does not establish ABS availability or rear anti-roll hardware. No measured performance replication claim.

## Duplicate audit and original art

Decoded current native car documents including compressed exports; searched production references and aliases. No Accent duplicate. Existing Hyundai references are TiburonGT and Veloster,not this sedan. Knotgrass unused; reserved unpublished aliases excluded. Preserve all prior independent cars unchanged.

Original built-in-generated eight-angle body,plain LHD manual cockpit/window cranks and skinny tire/full wheel-cover textures. Targeted body cleanup corrected equal-cell containment and alpha edges. Original final PNGs retained unchanged; native importer normalizes decoded near-opaque tire alpha,fits wheel regions,and calibrates body/wheel anchors and live speed/RPM/gear/fuel instruments. No shared runtime/renderer edits. Generic audio,digital gauges and common animated steering wheel are game conventions. Wipers may retain inherited desktop positioning but must not obstruct the live cluster.

## Independent checkpoint and validation

Base5cc2d78bfa4268ef4fd6a468fc73703795fa7b29 had185 playable+3templates. This adds one to186+3 independently,not merged with the separate184 checkpoint. Storksbill/Gromwell/Larkspur/Orpine strict exact-count tests updated only for this count; unique IDs and every other assertion retained.

Verified locally2026-11-17:83 focused/preservation unit tests pass (all nine continuation models plus catalog import/roundtrip),five vehicle-dynamics smoke tests pass,and full manifest/assets check passes:2118 documents,16assets. Five serialized sandbox-enabled Playwright tests pass in6.0minutes:actual production preview,desktop keyboard/handheld touch drives,and actual initial/later-page picker selection followed by real-input drives. No page errors or crashes.

Both pickers reach page start84 of186 choices with91cars loaded. Desktop picker-drive sample travels24.21m at9.57m/s;handheld travels30.59m at12.44m/s with750→3394rpm and gear2. Movement samples are not performance specifications. All eight production-rendered angles plus final desktop/handheld live cockpits reviewed;native instrument cluster remains unobstructed and legible.

**Inherited garage/showroom limitation:** actual picker renders the common gold/dark Stock tire art instead of this car's plain covers. `GarageSystem.stockBaseline()` unconditionally calls `applyTireDefinition(...,'Stock')`,which replaces tireSurfaces and per-angle tiregraphics. Stock authored car/editor/race-preview drives retain correct custom skinny covers. Tests select the real picker then load the selected authored car into the race editor;they do not prove preservation through a campaign garage build. No car-scoped bypass found;shared garage/runtime unchanged. This cosmetic/equipment override is explicitly not claimed fixed. Inherited desktop wipers can also float above the dash,but do not cover instruments. Durable sources,screenshots/logs and sandbox-enabled serialized browser configuration live in sibling knotgrass-qa; additional source evidence in accent-source-qa. Full project CI not claimed. No push/upload/merge/deployment.
