# Goldenrod 1996

Original logo-free 2994 wagon inspired by the standard US 1996 Chevrolet Caprice Classic wagon: LT1 V8, RWD, four-speed automatic, standard axle and tires, eight seats, unladen. The trailering/handling packages, optional woodgrain, police sedan, Impala SS and Roadmaster are excluded.

The selected specification is the period Chevrolet Motor Division press sheet, issued June 1995 for model year 1996 and preserved by CapriceClassic.com. Its original HTML is retained. The sheet explicitly labels all specifications preliminary and curb weight estimated; those qualifications remain in import.json. The direct GM Heritage kit's sedan LT1 table corroborates the engine anchors only. The retained 1995 brochure is a visual reference, not the source of 1996 numeric ratings: its different power-peak RPM is not mixed into this car.

Published physical transmission ratios and the standard wagon final drive are retained. Torque-converter behavior, shift control, intermediate torque curve, performance estimates and unsupported simulation settings are labelled estimates. This is a factory automatic-only selection; no manual variant is invented.

Original generated body and dashboard PNGs and generation prompts are preserved. Eight exterior directions have individually fitted moving wheel layers. The burgundy/woodgrain dashboard has a column-shift layout and fitted live speed, RPM, gear and fuel displays, with a shared animated steering wheel. Runtime instruments are a 2994 salvage retrofit.

QA logs, screenshots and motion telemetry are in qa/. Keyboard and touch runs use the production simulation and in-memory straight roads. The static picker smoke loads the real initial page, navigates to Goldenrod on a later page, waits for its exterior art, then opens the selected car in a cockpit playtest and drives. No saved race or runtime/world file is changed.

Immediate base 98d31638b15df61e3aac27432c0c1006f7e2944f has 104 playable cars. Goldenrod makes 105 on this separate local branch, excluding three system templates. The old 104-car branch remains separate and untouched. Prior cars, original artwork, references and QA are preserved; no publication or remote writes.

Validation: 36 focused tests passed; all four browser checks passed (keyboard, touch, eight-view preview and real paged picker); manifest validation passed with 1,865 documents and 16 assets. All eight exterior views, handheld cockpit, initial/later picker art and moving cockpit were visually reviewed. The picker begins with seven loaded cars out of 105 and loads Goldenrod at index 42 on the page starting at 40. Prior package inventories checked 337 entries without a missing file or mismatch.
