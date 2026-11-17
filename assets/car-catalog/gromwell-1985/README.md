# Gromwell 1985

Local-only Legends tribute to Henri Toivonen / Neil Wilson's 1985 RAC Rally-winning Lancia Delta S4 Group B. Exact-event duplicate audit found no existing Toivonen/Delta S4 car. Gromwell is unused in this checkout; other reserved aliases remain untouched.

## Evidence and simulation limits

[Stellantis Heritage retrospective](https://www.media.stellantis.com/em-en/heritage-hub-italy/press/forty-years-after-the-legendary-delta-s4-lancia-is-back-in-the-race-with-the-ypsilon-rally4-hf) verifies the crew, event, competition identity, 1759cc mid-mounted four-cylinder, turbocharger plus supercharger and permanent AWD. This is not an Integrale or S4 Stradale.

The selected 493 hp (about 500 CV), 966 kg and 155 mph are retrospective-context approximations, **not measured RAC event-day figures**. Torque 360 lb-ft, complete engine curve, 8000 rpm redline and 3.5-second acceleration target are simulation estimates. The source's erroneous torque figure was not used. Twincharging is recorded as identity; this uses the shared authored-curve simulation, not a new compound-boost model.

Five-speed manual, individual ratios/final drive, nominal 30% front torque allocation, differentials, equal 205/65R15 Rally tires, geometry, aero, suspension, brakes and 90L tank are provisional game setup, not documented exact RAC equipment. Auto Assist uses the manual ratios for accessibility, not a claimed factory automatic. Full field-level provenance and estimates live in import.json and the exported car document.

## Original art

Built-in image generation created a logo-free offwhite/teal/orange body, squared roll-cage cockpit with blank left instrument panel, tall manual lever and blue bucket-seat edges, and opaque white gravel wheels. No third-party image assets, badges or sponsor graphics. Eight complete body views have transparent wheel wells. An initial front-right orientation error was corrected through image generation before import. PNGs retain original alpha unchanged; native opacity normalization is applied only to the decoded wheel import copy.

The dedicated cockpit carries moving software speed, RPM, gear and fuel plus a separate animated steering wheel. Instrument graphics and cockpit details are artistic interpretations, not exact event photographs. Existing viewport-relative wipers may float above painted parked wipers; no shared renderer change is made.

Car-scoped build.mjs uses native serializers and refuses overwrite. Measured wheel anchors affect graphics only, not physical tire radius. No shared physics, runtime, renderer or UI changes.

## Validation

Final local gates passed after the rear-right wheel-center correction and nominal AWD rear-share verification:

- 42 focused unit and preservation tests, including all eight prior Storksbill checks. Its exact roster/unique-ID snapshot was updated from 180 to 181 without loosening assertions.
- 5 serialized Playwright tests, using official Chrome for Testing Headless Shell 157.0.8103.78 with chromiumSandbox true, one worker and no traces. Desktop keyboard and actual handheld touch driving, initial/later paged-picker selection, eight-angle preview and live cockpit instruments passed.
- 5 dynamics smoke cases.
- Full manifest/assets validation: 2,098 documents / 16 assets, manifest current.
- Independent roster audit: 181 non-system cars plus 3 system templates, unique runtime identities, exactly one Toivonen/Delta S4 provenance match. No separate unpublished cars combined.

All eight exterior previews were visually reviewed; corrected rear-right alignment and final moving desktop/handheld cockpits were re-inspected. Durable local evidence and configuration are in sibling gromwell-qa, outside source checkout; it reuses the official executable in sibling storksbill-qa. Full CI not run; no pushing, merging, upload or deployment.
