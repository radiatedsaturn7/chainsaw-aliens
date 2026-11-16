# Madder 1969

Original logo-free 2994 interpretation of the Italian 1969 Fiat 128 standard two-door berlina, 1116 cc 128A.000, FWD and standard four-speed manual. This is a production car, not a Group 1 race preparation, later Rally, coupe, wagon, four-door or US emissions version.

## Source decisions

The original Fiat/ACI homologation 5304 initial 1969 form supplies the body, dimensions, fuel capacity, engine and standard gearbox. Only the initial form is used; optional gearing and subsequent extensions are excluded. The later original Fiat repair-data manual cross-checks the same engine's DIN rating and identifies the saloon final drive. Both scans and reviewed pages are retained in `references/`; public URLs and field-level distinctions are in `import.json`.

- 55 metric CV DIN at 6000 rpm converts to 54.2476 mechanical hp. The native editor rounds the summary to 54 hp; this is not a gross-to-net conversion.
- 7.9 kgm converts to about 57.14 lb-ft, rounded by the native editor to 57. The original 1969 form specifies 3400 rpm; the later repair manual specifies 3000. The car retains the original 3400 rpm anchor and labels interpolation as estimated.
- The form's 725 kg includes water, oil and spare but excludes fuel and tools. Runtime 755 kg is an explicit estimate adding a 30 kg fuel/tools allowance, not a verified curb-weight claim. No driver is added.
- Standard ratios are 3.583 / 2.235 / 1.454 / 1.037, reverse 3.714, final 53/13. Auto Assist uses those manual gears; no factory automatic is implied.
- Tire aspect ratio, aerodynamic coefficient, mass distribution, CG, suspension, alignment, losses, rev limits, shifts and acceleration are simulation estimates. Later model mass and torque RPM are not silently substituted.

`body-initial.png`, `body.png` and `dashboard.png` preserve generated originals byte-for-byte. The corrected atlas provides all eight camera directions, transparent wheel openings and no badges. Production art contains no source-image pixels. The fitted dashboard has live speed, fuel, RPM and gear; numeric RPM/gear aids and shared animated wheel/steering assets are fictional restoration equipment.

## Verification

The focused tests exercise source boundaries, native car-editor roundtrip, drivetrain, roster identity/count, eight unique exterior frames, source hashes and wheel coverage. Browser checks use real keyboard and CDP touch input with moving physics, and review eight exterior views plus cockpit. The static menu check verifies a visible initial entry with loaded art, pages to Madder, waits for exterior art, then opens that selected car in the editor and drives in cockpit view. Its straight road exists only in memory; no saved race is edited.

The first unit run expected fractional summary power and failed because the native editor rounds it. The corrected test expects rounding while retaining precise source data. Initial browser evidence is retained; visual review moved the steering wheel left to uncover the RPM display before the final browser run. Final logs and compact image/JSON evidence are in `qa/`.

This local checkpoint adds one runnable car. The older unpublished 104-car branch remains separate; none of its eleven cars is imported. Existing cars, races, artwork and prior QA remain intact. No runtime/world changes, publication, uploads or remote writes.
