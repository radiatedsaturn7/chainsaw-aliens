# Bramble 2021

Original logo-free 2994 salvage rally hatch and right-hand-drive cockpit inspired by the 2021 UK GR Yaris base six-speed. Not the Japanese power rating, Circuit Pack, or later update.

OEM UK brochure and launch technical press pack provide power, torque, minimum kerb mass, dimensions, tires, steering and ratios. The real gearbox has two final reductions: gears 1–4 use 3.941; fifth, sixth and reverse use 3.350. This game supports one final reduction, so those three effective ratios are scaled to preserve total reduction. Unit tests verify these products. These effective values are not represented as literal OEM gear ratios.

Normal nominal 60/40 front/rear AWD is approximated using 0.4 rear share. Dynamic manufacturer ECU behavior is not modeled. Open front/rear differentials match the base variant, not Circuit Pack Torsen.

Detailed sources, conflicting brochure/launch figures, and modeling estimates are explicitly recorded in import.json and research.json. No claim of measured in-game acceleration or production speed limiter. Eight individually calibrated wheel placements, shared steering wheel, RHD instruments and fixed rear camera; existing surface-sensitive smoke and spray. Native editor serialization only; no maps or worlds changed.

The default driving option is **Auto Assist (6MT)**, with the original manual option still selectable. This automates shifting using the same effective six-speed reductions and modeled shift/clutch timing; it does not claim a factory automatic trim or change the sourced specification.
