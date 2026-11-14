# Alder RS 1994

Original badge-free 2994 performance wagon based on the **stock early-1994 European Audi Avant RS2, LHD, turbo five-cylinder, permanent AWD and six-speed manual**. This is distinct from the existing FWD Volvo T-5R wagon and from newer SUVs/hatchbacks. No RS2, S2 or Audi alias matched fresh staging, open roster work or the completed local catalog.

## Manufacturer evidence

- [Archived February 1994 English Audi brochure](https://www.brochure-catalogue-voiture-neuve.fr/brochures/audi/80/audi-80-1991/B4-4-ANG-02-1994-AVANT-RS2/): linked twelve-page PDF downloaded; technical page11 visually read. The page explicitly says **provisional data/summary**, not final homologation. Values remain qualified accordingly.
- [Audi historical model record](https://www.audi.com/de/der-aufstieg-ins-premiumsegment-17326): independently corroborates engine output/displacement,1595kg unladen mass,width andheight. Lists4509mm length versus period4510mm; period figure governs this config.
- [Audi 1994 engine record](https://www.audi-mediacenter.com/en/photos/detail/audi-avant-rs-2-b4-model-year-1994-37228): corroborates410Nm at3000rpm and232kW at6500rpm.

Period selection:2226cc,1595kg unladen;4510×1695×1386mm;2597mm wheelbase;1448/1474mm tracks;245/40ZR17 on7J17. The published six forward ratios are3.500/1.889/1.320/1.034/.857/.711,reverse3.455,final4.111. No invented gearbox ratios are presented as verified. Options can increase mass. Engine scalars convert SI to311mechanicalhp/302lb-ft after native rounding; marketing315 is metricPS.

## Simulation limits

The factory data are provisional early-brochure specifications, not independently final-production-certified. Conflicting secondary235mm tire/2611mm wheelbase claims are not mixed into this selection. Nominal.3139m radius derives from245/40R17, not measured loaded radius.

Auto Assist is gameplay automation of the6MT, not a factory automatic; manual remains selectable. AWDbalance50:50 and differential coefficients approximate the original drivetrain; actual Torsen bias and switched rear-lock behavior with25km/h disengagement are not reproduced. Unpublished chassis/control values, tire pressures, steering ratio, spring/damper/brake forces, grip, CG, overhang split, clearances, aero, efficiency, idle/redline/limiter and torque curve outside the two manufacturer anchors are explicit estimates in research.json. Display5.2sec0-60 is estimated separately from sourced5.4sec0-100; no measured acceleration/top-speed certification.

## Original art and validation

Original indigo/graphite wagon and charcoal/indigo LHD dashboard generated through supported image generation, with no logos or copied promotional art. Eight separate body views import through native serializers; measured wheel openings use shared wheel art. Fixed-rear camera and existing surface-specific smoke remain enabled. Shared steering wheel surrounds runtime gauges in the authored binnacle. Blank ancillary recesses are decorative, not invented instrument readouts.

Tests cover exact trim anchors/provisional qualification, gearbox values, native editor manual/assist round trip, original PNG hashes, eight unique frames, all sourced camera/smoke parity and measured graphical wheel coverage. Browser checks use actual editor production simulation and renderer at desktop and touch/mobile sizes plus compositor stress frames; this is not a full campaign endurance test.

A new whole-repository checkout exceeded executor disk capacity. Development therefore uses the existing clean isolated roster worktree on a new branch from verified staging3aa27e7895f47eedcc579ee7c57e05567d728b3d; prior refs/snapshots remain unchanged. No maps or other world data changed.

Final local validation:49 targeted catalog/camera/smoke/wheel checks passed; manifest validation passed1537documents/16assets;6 browser cases passed on a clean fresh-port rerun. Scope:Alder desktop/mobile driving;Alder andVervain eight-angle physics previews;1280x720/390x844 compositor across eight changes. All Alder exterior frames and both actual driving captures were visually inspected. Evidence:`/tmp/alder-final-browser`, `/tmp/alder-angles-review.png`. Initial stopped browser run and its port-conflicted retry are not counted as passes. Only one complete car is included in this batch.
