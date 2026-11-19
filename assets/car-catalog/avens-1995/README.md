# Avens 1995 / First Keys

Original logo-free interpretation of a US 1995 Oldsmobile Ciera Sedan Series I, GM A-body four-door, 2.2 LN2 / Hydra-Matic 3T40 three-speed automatic. Not Cutlass Supreme, N-body, wagon or V6. No matching production reference existed at the Cicely baseline. Avens does not conflict with existing or separately reserved aliases.

## Evidence and uncertainty

Original factory brochure: https://www.outrightolds.com/PDFBrochure/1995OldsmobileCiera.pdf (PDF page 9 specifications/color chart; pages 4–5 cabin and wheel covers). Series I is the brochure designation, not an inferred SL badge. 120 hp at 5,200 rpm, 130 lb-ft at 4,000; generic sedan curb 2,931 lb; 190.3 × 69.5 × 54.1 inches, 104.9-inch wheelbase, tracks 58.7/57.0 inches; 16.5 US gallons. P185/75R14 whitewalls with plain bolt-on full covers, ABS front disc/rear drum. Bright White/Ruby Red cloth is factory-valid. Divided 55/45 bench, column shift, manual windows, power locks, A/C and tilt.

Factory bulletin 47-71-36 identifies exact 1995 LN2/3T40 MD9 hardware (source URL in import.json). Ratios 2.84/1.60/1.00 and reverse 2.07 are family inference. **Exact final drive remains unverified; 3.18 is a provisional simulation estimate**, not a brochure fact. Manual Assist is a game control over identical automatic ratios, not a factory manual option.

Idle, redline/limit, off-peak torque, 60/40 distribution, CG, steering ratio, Cd, collider subdivision, tire pressure/grip, springs/damping/antiroll, brake bias, converter/shift behavior, drivetrain losses and performance targets are estimates. Rear suspension architecture is not asserted. See import.json for explicit provenance. Live digital speed/RPM/gear/fuel and the common animated thin-rim wheel are game conventions; factory instrumentation was analog, without a visible tach.

## Assets and scope

Eight original body angles, burgundy bench/column-shift cockpit, and full covers with aged cream whitewall rings were generated specifically for this car. Rear lamps were corrected to two separate stacked three-band clusters. All final source PNGs are unmodified. The native importer normalizes decoded tire opacity and explicitly maps wheel frame 0 / tread frame 2. Source hashes are recorded in the native car document. Only this car/art, tests, manifest, and count-only prior snapshot changes are in scope.

Rebuild with `node assets/car-catalog/avens-1995/build.mjs` only into a target without these documents. Existing production serializers and renderer are unchanged.

## QA and inherited behavior

Durable evidence is held in sibling avens-qa: focused/preservation, dynamics, manifest and serialized sandbox-enabled browser logs; actual keyboard and handheld-touch drives, paged picker selection, eight production-rendered views and live cockpit screenshots. Browser tests select the real picker item, then load the authored car into RaceEditor for a drive. They do not claim campaign equipment preservation.

The inherited GarageSystem stock baseline replaces authored wheel graphics with the common stock tire/rim in the picker/showroom. Authored-car production preview and RaceEditor drive retain the original whitewall full covers. This is an inherited equipment/cosmetic override, not repaired by changing shared runtime. Inherited wipers can float above the dash; native instruments must remain legible and unobstructed.

Verified local result: 190 playable + 3 legacy system templates, independent of the separate 184 checkpoint. 117/117 focused and prior-preservation/import/roundtrip tests; 5/5 vehicle-dynamics smoke tests; 5/5 serialized browser tests (3.2 minutes). Manifest asset check passed: 2,134 documents / 16 assets. Visual review covered all eight production exterior angles, desktop and handheld live instruments, both actual paged picker screens and drives. No page errors; native cluster remains clear of column lever and wheel. Final source facts retain the stated transmission/physics uncertainties.
