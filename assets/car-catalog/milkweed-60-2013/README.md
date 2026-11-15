# Milkweed 60 2013

Original lavender/mint2994 battery-electric city hatchback based on European launch October2013 BMW i3 BEV, standard19inch wheels/base Atelier equipment and LHD. No range extender, US trim or later94/120Ah battery data mixed in. Fresh staging, local source/alias catalog and open PR titles/branches had no playable equivalent. The separate four-car potential release remains at9c8ac0175679c56743ad17a24195cfa65eccf899.

## Manufacturer evidence

[BMW October2013 launch press kit](https://newsroom.bmwgroup.com/global/the-bmw-i3). The original linked English PDF was downloaded from the current public newsroom page; page40 was visually inspected, page15 confirms motor ceiling. Older2014 attachment redirected to the homepage, so the exact supported launch2013 specification was selected instead.

BEV column:125kW,250Nm,1195kg DIN mass versus1270kg EU,18.8kWh usable versus22kWh gross,11400rpm motor ceiling,up-to50kW recuperation,RWD,47:53 distribution,.29drag,14.2 steering,155/70R19 both axles. The table publishes a **rounded9.7:1** single reduction; this is used directly without asserting independently verified9.665 precision. Body3999×1775×1578mm excludes roof fin;2570mm wheelbase,707/722mm overhangs,140mm clearance. No75kg EU allowance is added to DIN mass. The term hybrid synchronous describes motor topology, not a hybrid combustion vehicle.

## Runtime and estimates

Uses existing electric drivetrain with one forward reduction and electronic reverse, traction-energy accounting and bounded lift-off regeneration. Real battery percent/power gauges replace combustion RPM/fuel instruments. Tire smoke/spray remains appropriate; no exhaust pipes drawn and inherited combustion audio/mechanics are suppressed by EV runtime.

Unpublished track widths are explicitly estimated1.57m each. CG,bodysection shapes,suspension/brakes,tire grip/pressure,drive/regen efficiency,regen torque,accessory draw and lift-off calibration are game estimates. Manufacturer power/torque envelope is approximated as constant torque/constant power; no thermal/SOC power derating,OEM brake blending,charging infrastructure or range certification.150kph sourced display value is not independently calibrated game limiting;7.0sec0–60 is estimated separately from sourced7.2sec0–100. Nominal tire radius derives tire dimensions, not a loaded-radius measurement.

## Art and checks

Original supported image generation produced eight separate body views and a blank LHD dashboard binnacle. Native catalog serialization retains source hashes; shared wheel/tire art is fitted to measured openings. Fixed-rear camera and existing surfaceFX are preserved. No placeholder art or copied manufacturer imagery.

Dedicated dynamics checks prove launch/rolling energy consumption,bounded recovery on lift-off,and zero motor drive after depletion. Catalog tests protect net battery capacity,DIN mass,standard tires,rounded reduction,editor roundtrip and EV instrument sources. Browser checks use actual production editor simulation/rendering on desktop and touch/mobile plus eight-angle capture and compositor stress. No campaign endurance or OEM performance certification is claimed.

Work is isolated on a new local branch whose parent is the exact four-car snapshot9c8ac0175679c56743ad17a24195cfa65eccf899, on staging3aa27e7895f47eedcc579ee7c57e05567d728b3d. No existing map/world or car data changes; no remote writes.

Both axles explicitly opt into155/70R19 contact geometry; a runtime test checks155mm wheel widths. This matters because legacy scalar-only tire setups do not populate per-wheel widths. The initial exploratory browser captures precede this final axle setting and are not final dynamics evidence. Final browser output uses `/tmp/milkweed-axle-final-browser`; config/compositor copies are preserved under `/tmp` for reproduction.

Final validation: 79 targeted unit checks passed (67 catalog/electric/integration checks plus 12 wheel-coverage checks); six final Playwright checks passed on the explicit axle setup. All eight exterior captures and desktop/handheld driving captures were inspected. Manifest validation passed for 1,549 documents and 16 assets. Evidence is local under `/tmp/milkweed-axle-final-browser`, with logs `/tmp/milkweed-final-regression.log`, `/tmp/milkweed-final-wheel-regression.log`, `/tmp/milkweed-axle-final-browser.log` and `/tmp/milkweed-final-manifest.log`.
