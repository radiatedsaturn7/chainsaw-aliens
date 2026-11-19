# Marestail 2003 — First Keys

Stock mainland-US **2003 Honda Accord DX four-door sedan, 2.4-liter four-cylinder, standard five-speed manual**. Ordinary black base trim and 15-inch full wheel covers, not LX/EX, V6, coupe or Europe/Japan Accord. No sunroof or accessory air conditioning in the selected baseline. Silver-gray original 2994 hand-me-down artwork.

## Sources

- [Official Honda US specifications, July 29, 2002](https://hondanews.com/en-US/honda-automobiles/releases/release-70a2bcad7a6cc95be46391004c34c6ec-2003-honda-accord-sedan-specifications): exact DX/manual column. 2354 cc, 160 hp at 5500 rpm, 161 lb-ft at 4500; 2989 lb manual mass, axle weights 1810/1179 lb; five manual ratios and 4.389 final drive.
- [Official Honda US features](https://hondanews.com/en-US/honda-automobiles/releases/release-e9f432bd4dd807d4c1fc34004c34c6eb-2003-honda-accord-sedan-features): black mirrors, handles, moldings/window trim, basic equipment. Power windows do not imply power locks or luxury trim.
- [Original US sales brochure, archived copy](https://xr793.com/wp-content/uploads/2019/05/2003-Honda-Accord.pdf): downloaded and table text inspected. Confirms standard 5MT, P195/65R15 full covers, 2989 lb, double-wishbone front/five-link rear, front disc/rear drum ABS, 25.4 mm front stabilizer and no rear stabilizer.

The brochure's 61.2-inch rear track is selected; the earlier press table gives 61.1 for DX. Their turning-circle figures also differ (36.1 vs 36.9 ft), neither claimed as a calibrated game result. Full field-level facts and uncertainty remain in import.json and exported provenance.

## Estimates and distinctions

Redline/rev limit, idle, off-peak torque interpolation, steering ratio, CG/clearance, drag, collider subdivisions, spring/damper coefficients, tire grip/pressure, shift/clutch behavior, efficiency and performance targets are explicit simulation estimates. The rear anti-roll coefficient is zero, consistent with DX having no rear bar. Auto Assist uses the selected manual hardware ratios for accessibility, not the separately offered factory 5AT. Generic audio and digital live instrumentation are game conventions.

Duplicate audit decoded every current car, including compressed exports, and searched catalog provenance. Existing Redbud V6 2007 is an EX-L V6 coupe; Marjoram 2003 is a Toyota Camry. No exact DX sedan/manual duplicate. Marestail alias is unused and does not overlap unpublished/reserved names.

## Art and workflow

Original built-in generated eight-angle exterior, blank-cluster LHD manual cockpit and ordinary wheel-cover sheet are included. Initial body generation had a pale translucent backdrop; a targeted built-in background-extraction edit corrected it before import. No source photographs or logos. Original final PNGs are unchanged; native near-opaque normalization is applied to the decoded wheel import copy to obtain full tire texture regions.

Car-scoped build.mjs uses existing serializers, tire-region fitting, cockpit anchors and wheel-well calibration. It refuses overwrite. Shared renderer/runtime files remain unchanged. Viewport-relative parked wipers can float on desktop, but must not cover the live speed/RPM/gear/fuel cluster. Separate animated wheel sits below the instruments.

## Independent checkpoint and QA

Base: `a915dbb76cfdf5ba88044e944b5760796662589f`, 181 non-system cars plus 3 templates. This addition yields 182 plus 3 locally, independent from the separate 184-car checkpoint. Earlier Storksbill/Gromwell exact-count tests are updated to 182 while retaining unique-ID, duplicate-event and reserved-alias assertions. Prior car definitions and assets remain unchanged.

Verified locally on 2026-11-17:

- 51 focused/preservation unit tests pass, including eight new Marestail tests and preserved Marjoram, Selfheal, Storksbill, Gromwell, catalog import and roundtrip checks.
- All five `npm run test:vehicle-dynamics:smoke` subprocess tests pass.
- `python tools/project_manifest.py --check --validate-assets` passes: 2102 documents, 16 assets, complete published manifest.
- Five serialized Playwright tests pass in 6.0 minutes: production preview, desktop keyboard drive, handheld touch drive, desktop actual paged picker and handheld actual paged picker. No page errors or browser crashes.
- Both picker tests select Marestail at page start 96 among 182 choices, after real control traversal; 93 cars hydrated rather than all 182. No stale/missing target art.
- Actual handheld picker drive travels 29.29 m and reaches 12.54 m/s with RPM changing from 750 to 3345 and gear 2. Desktop keyboard drive reaches 11.16 m/s and travels 30.31 m. These are QA input/movement samples, not performance specifications.
- Visually reviewed all eight production-composited exterior angles plus desktop and handheld moving cockpits. Wheels cover their cutouts, stock gray dashboard has legible live speed/RPM/gear/fuel instruments, and no cluster occlusion. Inherited desktop wiper placement remains imperfect but does not obstruct instruments.

Browser specs: `tests/playwright/marestail-{preview,driving,static-picker}.spec.js`; run serialized with the sandbox-enabled sibling configuration. Durable local evidence, sources, browser configuration and logs are in sibling `marestail-qa`, outside source checkout. Official Chrome for Testing Headless Shell is sandbox-enabled, one worker, no simultaneous browsers or large traces. Full project CI is not run. No push, upload or deployment.
