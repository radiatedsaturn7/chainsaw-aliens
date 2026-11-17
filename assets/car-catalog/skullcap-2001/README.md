# Skullcap 2001 / First Keys

Original logo-free US 2001 Mercury Grand Marquis GS, standard 4.6 SOHC V8 / 4R70W automatic, rear-wheel drive. No Handling Package, LS, police or Marauder equipment. Decoded native roster/provenance audit found no Grand Marquis, Crown Victoria, Town Car, Panther or Ranger reference at Bugle baseline. Skullcap is unused and outside all reserved aliases, including Yarrow, the separate seven and Woodbetony.

## Factory evidence

- Original US brochure: https://xr793.com/wp-content/uploads/2023/02/2001-Mercury-Grand-Marquis.pdf . PDF pp7–8 (printed10–13): 220 hp at4750,265lb-ft at4000; GS curb3958lb,19gal;211.9/78.2/56.8in,114.7in wheelbase,63.4/65.3in tracks. Front SLA/coils/stabilizer; rear solid axle/four links/Watts/coils; four-wheel discs12.4/11.1in. ABS/traction optional, omitted. P225/60SR16 WHITEWALL tires,16-inch chrome wire-basket LOCKING COVERS, not HPP alloys or LS luxury covers. Cloth twin-comfort split bench/powerdriver,manualclimate,analogcluster,cassette,powerwindows/locks,narrow brightinsert molding. No standard pinstripe/keypad. Page4 depicts optional LS leather/digital equipment and is not treated as GS proof.
- Official Ford owner manual: https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2001-GrandMarquis-version-3_om_EN-US_05_2001.pdf confirms4R70W. Its114.4inch wheelbase conflicts with its2913mm and brochure114.7; brochure selected.
- Factory-family4R70W service text (full URL in import.json) supports2.84/1.55/1/.70 and reverse2.32. This is family inference, not exact2001GS verification. **Exact final drive unverified;2.73 provisional simulation estimate.** ManualAssist is game control over identical automatic hardware,not a factory manual.

## Estimated and fictional values

Idle/redline/limit,off-peak torque,54/46distribution,CG.56,Cd.36,steering16.4,collider subdivision/overhangsplit,32psi/grip,springs/damping/antiroll,brakebias,converter/shiftbehavior,efficiency,108mph/9.4s targets are estimates,not road-test calibration. Open differential and zero rear antiroll are provisional base setup. Brochure lists Arizona Beige and Medium Parchment GS cloth separately; exact pairing is not confirmed by a matrix. Digital live speed/RPM/gear/fuel and common animated steeringwheel are game conventions, not the factory analog cluster. Weathered2994finish is fictional.

## Original art and scope

Eight original beige body views, parchment cloth bench/columnshift cabin,chrome wire-basket locking covers with cream whitewalls. Initial body sheet was regenerated for correct equal-cell spacing; final source PNGs remain unmodified. Native import normalizes decoded wheel opacity; wheel frame2/treadframe0. Source hashes preserved. Build uses existing production serializers without shared changes. Run build.mjs only into a destination without these documents.

## QA and inherited limitation

Durable sibling skullcap-qa holds factory brochure, logs, sandbox-enabled serialized browser configuration, motion/picker JSON and screenshots. The actual paged picker is traversed with keyboard/touch, then the authored selected vehicle is driven through RaceEditor using production physics and native controls. These tests do not assert campaign equipment preservation.

Inherited GarageSystem stock baseline overrides original wheel art with a common dark/gold tire/rim in picker/showroom. Authored preview and RaceEditor retain original locking covers/whitewalls. No shared runtime repair attempted. Inherited wipers can float above the dashboard; the live cluster must remain legible and unobstructed.

Alias-audit correction before checkpoint: the initial working label Meadowsweet conflicted with the existing 1992 rally model. The new car was renamed Skullcap; the earlier model and all its tests were restored unchanged, with explicit preservation/unique-production-reference coverage. Pre-rename interrupted evidence remains in sibling meadowsweet-qa; final evidence is skullcap-qa. Factory source PDFs also remain in marquis-source-qa and meadowsweet-qa/sources.

Final non-browser gates: 139/139 focused/preservation/import/roundtrip tests (including existing Meadowsweet),5/5 dynamics smoke checks. Manifest/asset validation:2,142documents,16assets;192playable plus3legacytemplates,independent of separate184. All previous manifest entries preserved; existing Meadowsweet tests byte-for-byte unchanged.

Final browser gates:5/5 passed in4.4minutes with official Chrome for Testing and chromiumSandbox:true,one worker. Actual desktop keyboard and handheld touch paged selection reached Skullcap at index156/start156 among192choices,followed by real-input moving drives. Eight production exterior views and both live cockpits visually reviewed;clear instrument panel,alpha windshield,working native wheel. Motion/picker logs report no page errors. Final alias-corrected browser run is skullcap-qa/final;earlier interrupted Meadowsweet-label run is not counted.
