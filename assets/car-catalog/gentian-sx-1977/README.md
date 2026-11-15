# Gentian SX 1977

Original ivory/coral, badge-free 2994 classic coupe based on the stock French 1977 Alpine A110 1600 SX road berlinette. It complements Milkweed's battery-electric drivetrain with a lightweight rear-engine, naturally aspirated RWD five-speed manual. No rally livery, Group 4 power, earlier S/SC specification or modern A110 data is substituted.

Fresh staging remained `3aa27e7895f47eedcc579ee7c57e05567d728b3d`. No Alpine/A110 equivalent was found in the source/alias catalog, and open PR titles and branches had no competing roster addition. Work starts from preserved Milkweed snapshot `c52da4a875375b6d5bc6e0df1c0cff298d71e911`; the earlier four-car snapshot `9c8ac0175679c56743ad17a24195cfa65eccf899` remains separate.

## Manufacturer evidence

The [original 1977 Alpine-Renault brochure, archived by Guide Autosport](https://www.guide-autosport.com/wp-content/uploads/2017/12/Catalogue_Alpine_A110_1977.pdf), was downloaded and its final technical page visually inspected. It specifies 1,647 cc, 95 metric ch at 6,000 rpm, 790 kg running-order mass, five forward gears, an 8×31 final drive (3.875), 15:1 steering, 165 HR13 tires and a 50-litre tank. The source power converts to 93.7004 mechanical hp; native editor serialization rounds its scalar display to 94 hp while the curve retains the sourced power anchor.

The dimension drawing gives 3,850 × 1,550 × 1,120 mm, 2,100 mm wheelbase, 1,315/1,346 mm front/rear tracks, 840/910 mm overhangs and 140 mm clearance. These exact brochure dimensions take precedence over conflicting generic online listings. [Alpine's manufacturer retrospective](https://media.alpinecars.com/a-trio-of-iconic-alpine-a110-models-to-star-at-retromobile-classic-event-as-current-version-enters-last-months-of-production/?lang=eng) independently confirms the 1977 stock SX engine, mass, gearbox and 195 km/h maximum.

## Explicit game estimates

Individual forward ratios and reverse, 128 Nm torque peak, curve interpolation, idle/redline/limiter, 40% front weight, CG, spring/damper/brake and tire calibration, efficiency and drag are estimates. The brochure does not print a tire aspect ratio: 80% is an explicit nominal approximation, not a verified loaded radius. Automatic mode is assisted shifting of the same five-speed, not a claimed factory automatic. Displayed 0–60 time is estimated; no OEM acceleration, range, suspension-kinematic or speed-limiter fidelity is claimed. The sourced fuel capacity is applied; consumption and other mechanical-system values use existing defaults.

## Artwork and verification

Unmodified original generated PNGs supply eight distinct exterior directions and a blank LHD instrument binnacle. The native importer preserves original hashes. Existing tire and steering-wheel art is fitted to the measured openings; speed, RPM, gear and fuel are live instruments. Fixed rear camera and existing surface effects are retained. No existing car, map, lighting, scenery or world files are changed.

Actual production editor driving previews, eight-direction captures and desktop/handheld cockpit checks are used; these are not a claim of full campaign endurance testing. Reproduction configuration and compositor spec are retained in `/tmp/gentian-local.config.mjs` and `/tmp/gentian-compositor.spec.js`. Evidence and logs are under `/tmp/gentian-*`.

Validation completed: 71 catalog/drivetrain/import checks and 13 wheel-fit regressions passed; all four Gentian unit checks passed again after the final Street-compound and fuel-capacity settings. Manifest validation passed for 1,552 documents and 16 assets. Eight combined browser cases passed. Gentian's final exterior/desktop/handheld rerun passed three cases; a blank handheld screenshot in that rerun prompted a strengthened rendered-pixel assertion and an isolated two-case desktop/handheld rerun, both passed and visually inspected. Final driving evidence is `/tmp/gentian-capture-final-browser`; final exterior evidence is `/tmp/gentian-street-final-browser`. The blank preliminary capture is not counted as visual acceptance. Full-sized cockpit compositor captures also passed at both sizes.
