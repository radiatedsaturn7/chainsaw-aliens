# Local placeholder wave 05

Base: `8a9eead877d5f19d05ae4fad03875b6dd6ed5b23`. Branch: `local/660-wave05-20261117`.

Three distinct Porsche road configurations occupy existing slots, without increasing the 660-slot target:

- Sandspurry Six 1970: European 914/6 901/36 5MT road targa. Factory service scan distinguishes 110 DIN metric horsepower from 125 SAE period gross; only the metric rating supplies runtime power. Printed pages 13, 15, 17 provide mass basis, geometry and engine anchors.
- Harebell RS 1973: 911 Carrera RS 2.7 M471 Sport, 960 kg, 210 PS and 255 Nm. Not M472 Touring, RSR or the existing Linaria 992 GT3. Five-speed selection/ratios and geometry remain provisional estimates here.
- Sea Lavender GTS 1993: European 928 GTS M28/49, G28/57 five-speed, 257 kW and 500 Nm. Factory manual OCR supports the engine anchors; mass is the generic European DIN basis, not an independently verified equipment-specific curb figure. PSD and Weissach kinematics are not reproduced.

Sources and field-level facts/estimates are in `wave-05-research.json` and each runtime provenance object. No secondary-site figures silently promoted to factory facts. The factory 914 scan corrected the preliminary 980 kg assumption to its printed 940 kg DIN unladen basis; runtime adoption is explicit in estimates. Art remains shared RTG-001 references, with no copied physics or new asset binaries.

The complete local production-reference audit found existing Porsche 944 Turbo (Sainfoin), 992.1 GT3 (Linaria), 956 (Houndstongue), 917 KH (Sanicle) and 959 S (Heatherbell S), none of these three road variants. Prior original-eleven crosswalk has no Porsche. Duplicate aliases, runtime IDs and candidate slots additionally fail intake before writes.

Counts: 222 implemented non-system entries, plus 3 system templates; 12 shared placeholders. Prior 210 finished entries remain the reported baseline. This wave adds 3 implemented/unit-tested, **0 independently drive-tested, 0 original-art-complete**. Echo and any pending/parked vehicles are excluded. Counts are not 222 certified finished vehicles or 222 confirmed matches within the historical 660 list.

Validation: 58 catalog/intake tests pass, no skips, including full native roundtrip, shared-art references, individual source facts and TC on/off acceleration. Six keyboard/touch paged-picker scenarios are discovered exactly once through the existing catalog CI spec. A supported sandboxed local Chrome launch fails before page load with `No usable sandbox!`; no local driving result is claimed. Local evidence is retained outside the game tree under `/workspace/scratch/wave05-qa/`. No workflow changes, publication or pending PR branch updates.

Resume: replay this commit after wave04 on the chosen local baseline; do not regenerate over existing entries. Execute the six registered scenarios under an existing supported hosted environment before promoting independent-drive status. Source gaps remain estimates and later artwork work must preserve finished art. The intake builder now accepts explicit ABS/TC choices; its defaults for earlier records remain unchanged. No existing car or race documents were altered.

Full asset/manifest validation passed; the three final new documents were also validated separately and the final complete manifest matches the tree. All prior catalog documents and manifest entries were compared byte-for-byte to wave04.
