# Larkspur 1981

Legends tribute to Jean Ragnotti / Jean-Marc Andrié's 1981 Monte Carlo-winning Renault 5 Turbo Group 4. No exact driver/model duplicate was found. Original fictional plant label is unused; all reserved aliases including Marestail remain untouched.

## Sources and distinctions

- [Renault's heritage book](https://cdn.group.renault.com/ren/master/renault-classic/tools-and-services/Renault5TURBO.pdf.asset.pdf/d687c20fd2.pdf), printed pp12-13: winning crew/event and Group 4 development. Printed pp8-9 establish the 1397cc longitudinal mid-engine four-cylinder, rear-drive, turbocharged five-speed family architecture. Road-car output, mass and tire specifications were not transplanted into the race setup.
- [FIA homologation 669](https://historicdb.fia.com/car/renault-5-turbo-1397-0): Group 4, four cylinders and RWD. The listed 1956cc is turbo equivalence; physical engine displacement is 1397cc.
- [Renault manufacturer retrospective](https://media.renault.ch/fr/article/21306): early competition family output of 250 PS. Selected 247 bhp approximates this context, not an exact event dyno result. The later 408 PS evolution is excluded.

Not Maxi, Group B Tour de Corse, front-drive Alpine Turbo, or road Turbo 2. The source book explicitly separates later Group B development from this Group 4 era.

## Simulation estimates

900 kg, 220 lb-ft, the complete torque curve, 7200 rpm redline, 130 mph and 5.5-second acceleration targets are provisional game estimates. Exact event ratios/final drive, suspension, differential, geometry, brakes, aero, 76L tank and equal 205/60R15 Sport tires are likewise estimates. Historic stagger is not reproduced. Five-speed family architecture is distinguished from unsourced individual event ratios. Auto Assist is accessibility behavior, not a factory automatic. This uses shared authored-curve physics, not a new turbo simulation.

## Original art and integration

Original built-in generated plum/ivory/copper eight-view body, bronze mixed-tarmac wheels and stripped stepped cockpit. No third-party image assets or copied sponsor livery. Initial body had translucent backdrop pixels; image-generation background removal corrected the output before native import. Final PNG alpha is preserved unchanged. Native wheel opacity normalization affects only the decoded copy.

Dedicated left instrument aperture receives live speed, RPM, gear and fuel, with separate animated wheel below. Plum door panels, black bucket edges, narrow switch console and low central gear lever distinguish this cockpit. No painted wipers were generated; shared runtime wiper positioning remains unmodified. Art is a creative interpretation, not an exact event cockpit replica.

Native serializer/import path, measured wheel-well graphics anchors and original source hashes. Physical tire radius is not altered to fit artwork. No shared runtime, physics, renderer, UI or input changes.

## Validation

Final local validation passed:

- 58 focused unit/preservation tests, including prior Legends, Accord, Camry, van and native importer. Only previous Storksbill/Gromwell exact roster and unique-ID snapshots advanced from 182 to 183; no assertion was loosened.
- 5 serialized browser tests: actual desktop keyboard and handheld touch driving, initial/later paged picker selection, eight-angle production preview and live moving cockpit instruments.
- 5 dynamics smoke cases.
- Full manifest/assets check: 2,106 documents, 16 assets, manifest current.
- Independent roster audit: 183 non-system cars plus 3 templates, unique runtime identities and one Ragnotti/Renault 5 Turbo provenance match. Separate unpublished cars were not combined.

All eight exterior previews and both desktop/handheld moving cockpits were visually reviewed, plus actual handheld later-page picker. Original artwork, fitted wheels and readable live instruments are intact. Official Chrome for Testing Headless Shell 157.0.8103.78 used chromiumSandbox true, one worker and no traces. Durable evidence/configuration in sibling larkspur-qa; official executable reused from sibling storksbill-qa. Local-only; no push, merge, upload or deployment. Full CI not run.
