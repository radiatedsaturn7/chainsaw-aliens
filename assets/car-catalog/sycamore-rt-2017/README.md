# Sycamore RT 2017

Original sage/sand, badge-free 2994 crew-cab pickup referencing stock US2017 Honda Ridgeline RT2WD6AT. Naturally aspirated V6, front-wheel drive, unladen curb mass. No matching playable source model/alias or current open PR title/branch was found. Honeysuckle and the Alder/Copperleaf pair remain preserved on their exact refs.

A factory hybrid was considered but deferred: inspected `PowertrainModel.js` branches between electric and combustion torque paths, without demonstrated coupled hybrid assist/regen/SOC behavior. This addition uses the supported conventional drivetrain rather than claiming a hybrid through a combined combustion torque curve.

## Manufacturer sources

[Honda US2017 specifications](https://hondanews.com/en-US/releases/release-e176e4fdb4f8461e9b0f2ce3ce23b49b-2017-honda-ridgeline-u-s-specifications-features), May9,2016, opened and read: RT2WD column selected. Retains280hp6000rpm,262lb-ft4700rpm,3471cc,6800redline,4242lb curb mass,58.6percent front weight,245/60R18 tires and15.59 steering. Exact6AT ratios3.359/2.095/1.485/1.065/.754/.556,reverse2.269,final4.25. 2WD-specific tracks,height and clearance used rather than AWD values. Inches convert directly at.0254m/in; pounds at.45359237kg/lb. Companion rounded metric figures differ byabout1mm and are not mixed in.

[Honda powertrain press kit](https://hondanews.com/en-US/honda-automobiles/releases/release-d7a2667d4c8741a7851544e06ef9edc8-2017-honda-ridgeline-press-kit-overview), section2-Wheel Drive, explicitly confirms the front wheels are driven. This configuration has no AWD torque vectoring or low range. No manual transmission is added or claimed.

## Simulation limits

Factory6AT ratios are preserved; generic torque-converter slip/multiplication,shift timing,schedule and efficiency are estimates. VCM cylinder deactivation,factory Normal/Snow traction maps,VSA/ABS,cargo loading,towing and tailgate interaction are not modeled. Nominal tire radius is dimensional, not loaded radius. Idle750,limiter7000,torque interpolation outside sourced anchors,CG,overhang split,body sectional shapes,aero,brakes,springs/dampers,tire pressure/grip and display180kph/7.0sec0–60 are game estimates. No real-performance calibration claim.

## Art and verification

Original eight-direction body artwork and LHD dashboard use supported image generation; shared tire/wheel art is fitted to measured openings, with real runtime gauges in the binnacle. Fixed-rear camera and existing surface smoke retained. An initial pale dashboard backdrop was corrected through supported image editing before import. In the top250rows,542920pixels are fully transparent and80have alpha1/255; full-region regression limits both maximum alpha and total residue, rejecting visible backdrop. Source PNGs are retained unchanged after generation/correction and hashes are recorded by the native importer.

Tests cover exact trim/automatic-only configuration,editor roundtrip,eight unique frames,original hashes,windshield transparency,camera/smoke source parity and wheel-opening coverage. Source-import invariant is75. Browser verification uses the actual production editor simulation and rendering, including both desktop and touch/mobile; it is not a full campaign endurance or calibrated performance run.

Local branch parent2438f0906e420f6fbf305de36501e393eef9191f, staging base3aa27e7895f47eedcc579ee7c57e05567d728b3d. No maps,prior cars,staging,main or remote refs changed.

Reproduce targeted regression with `node --test tests/unit/{briar2024,bramble,thornbill,celandine,fenfire,saffron,vervain,alder,copperleaf,honeysuckle,sycamore}Catalog.test.js tests/unit/carCatalogImport.test.js tests/unit/catalogCameraSmoke.test.js` (53checks), plus those eleven names in `tests/unit/catalogWheelCoverage.test.js` (11checks). Manifest command: `python tools/project_manifest.py --check --validate-assets`. Local browser config/compositor selection are preserved at `/tmp/sycamore-final.config.mjs` and `/tmp/sycamore-compositor.spec.js`; capture directory `/tmp/sycamore-final-browser` and contact sheet `/tmp/sycamore-angles-review.png`.

Final results:53 catalog/import/camera/smoke regression checks and11 wheel-fit checks passed; manifest passed1546documents/16assets. Six browser cases passed:Sycamore andHoneysuckle eight-angle driving previews,two production compositor stress cases across eleven roster changes,and Sycamore desktop1280×720 plus handheld390×844 actual driving. All eight Sycamore exterior views and both driving captures were visually inspected. The initial strict alpha-zero assertion failed only on80 alpha1/255 pixels; final full-region maximum and aggregate alpha checks pass, and actual gameplay has no pale windshield backdrop. No campaign workflow or remote operations performed.
