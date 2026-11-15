# Copperleaf 22 1998

Original badge-free 2994 rally coupe referencing the stock March 1998 Japanese Subaru Impreza 22B STI version: right-hand drive, two-door, 2212cc turbo flat-four, AWD and five-speed manual. Distinct from the modified STI Airslayer, Foresters, Ford RS200 and Alder wagon. Fresh staging, local catalog source/alias search and open PR titles/branches contained no equivalent 22B. This is a road homologation-inspired model, not a competition WRC simulation.

## Manufacturer evidence

- [STI heritage record](https://www.sti.jp/brand/heritage/1998/impreza-22b/) opened and read: 206kW at6000rpm,363Nm at3200rpm,1270kg reference mass,4365×1770×1390mm,2520mm wheelbase,1480/1500mm tracks,140mm clearance,235/40R17 tires and13:1 steering.
- [Subaru exact-grade catalog](https://ucar.subaru.jp/php/catalog/grade.php?cat_id=4501993) returned full indexed manufacturer specification text through search. Direct page opening returned403. It lists March1998 22B5MT ratios3.083/2.062/1.545/1.151/.825,reverse3.416 and final4.444. This access limitation is retained; no independently downloaded period homologation sheet is claimed.

206kW converts to276 mechanical hp;363Nm converts to268lb-ft after native scalar rounding. Subaru catalog uses362.8Nm and STI363Nm. Tire radius.3099m is nominal dimensional calculation. Mass is the manufacturer's reference figure.

## Game estimates and limits

Torque interpolation outside manufacturer anchors is estimated and constrained below the specified peak power. 7900rpm is mentioned as operating capability by STI, not an explicit limiter:7900 redline/8000 limiter and850idle remain estimates. 35percent-front AWD balance and differential coefficients approximate DCCD; variable center lock and real differential behavior are not simulated faithfully. Auto Assist automates this5MT and is not a factory automatic. Display245kph/5.0sec0-60,CG,weight distribution,body sectional shapes,overhang split,aero,brakes,springs/damping,grip,tire pressure and efficiency are explicit gameplay estimates. No acceleration or top-speed calibration certification.

## Art and validation

Original copper/orange coupe and charcoal/copper RHD dashboard generated with supported image generation, no badges, logos or film/rally livery. Eight separately authored directional body sprites use measured wheel openings and shared tire art. Fixed-rear camera and surface-specific smoke remain enabled. Shared steering wheel surrounds real runtime speed/RPM/gear gauges, with fuel bar; no painted counterfeit instruments. Production driving previews at desktop1280×720 and handheld390×844 are required alongside eight-angle exterior previews, unit contract tests and manifest validation.

Development is local in the existing isolated roster worktree on a new branch from preserved Alder5db7f6b3, staging base3aa27e7895f47eedcc579ee7c57e05567d728b3d. No map data, staging or main changes; no remote writes. Dedupe checks are bounded to source/alias catalog matches and current open PR titles/branches, not unpublished work held elsewhere.

Local results:47 catalog/import/camera/smoke regression checks plus9 wheel-coverage checks passed. Manifest validation passed1540documents/16assets. Six browser cases passed:both new-car eight-angle previews,Copperleaf desktop/touch driving,and desktop/handheld compositor stress coverage across nine roster changes. Copperleaf exterior test is additionally repeated after correcting the estimated upper torque curve; initial exterior pass is not final power evidence. Visual review inspected all eight directions and both actual driving captures. Evidence: `/tmp/copperleaf-final-browser`, `/tmp/copperleaf-corrected-exterior`, `/tmp/copperleaf-angles-review.png`.

Canonical catalog tooling measures79 playable entries/79 runtime identities,82 registered minus3 system/draft documents; no incomplete or missing art refs. Four legacy starter names share mechanical source IDs, so this is a playable-entry count, not79 independently certified distinct real-world trims. Live staging has77 entries and is unchanged at the above base. Full Campaign Artwork workflow deliberately not repeated; targeted vehicle/catalog checks only.
