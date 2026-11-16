# Teasel 2006

Original badge-free 2994 interpretation of the Canadian 2006 HUMMER H3 base five-door with the 3.5-litre Vortec inline-five and optional Hydra-Matic 4L60-E automatic. Standard P265/75R16 tires, cloth cabin, solid roof and side rails; no Adventure/Lux package, 33-inch tires, roof crossbars, brush guard, rear locker, later 3.7-litre engine, Alpha V8 or H3T pickup.

The primary source is the original June 2005 GM Canada brochure, publication 122-06-B-002E. The complete PDF is retained unchanged with rendered specification, equipment and cockpit pages. Manufacturer values include 220 SAE hp at 5600 rpm, 225 lb-ft at 2800 rpm, standard tire size and 87-litre tank. The general 2132 kg curb figure is applied to this base automatic as an explicit modeling assumption: the brochure does not tie that mass to a particular transmission. It is not the 2654 kg GVWR and no driver or cargo is added.

The simulation represents the documented 4 High Open mode with 40:60 front/rear distribution using existing AWD semantics. It does not offer the real vehicle's selectable high/low locks or transfer neutral. The base configuration excludes the Adventure rear locker. No new drivetrain controls or global behavior were added; existing traction control and ABS are not claimed to reproduce factory calibrations.

## Estimates and source conflicts

The brochure verifies the automatic type but not individual gears or axle ratio. The modeled 3.06/1.63/1.00/0.70, reverse 2.29 and 4.56 axle remain explicitly provisional. Converter behavior, shifts, torque interpolation, idle/rev limits, front mass distribution, drag, steering ratio, tire pressure/grip, spring and damping response, CG/colliders, brake bias and performance are estimates. Nominal tire dimensions give a 0.40195 m unloaded radius; loaded rolling radius is not verified.

Published metric dimensions are retained. Printed front/rear overhang pairs are internally inconsistent (300 mm/31.5 inches and 394 mm/35.2 inches); they are not treated as verified. The model uses an estimated 0.80/1.10 m split matching the total length with spare. Brochure width/height differ from other circulated figures, so this version follows its stated 1872/1892 mm and does not claim resolved measurement conventions. Off-road grade, obstacle and fording claims are not validated by the simulation.

## Artwork, evidence and preservation

Original slate-blue exterior artwork provides all eight directions with shared animated tire layers. The black dashboard, silver center stack and passenger grab bar are period-inspired, with fitted live speed/RPM/gear/fuel and shared moving steering. Simplified instruments, generic sound and fictional restoration details remain. No source photo pixels or badges enter the artwork. Initial and corrected artwork originals are retained byte-for-byte.

QA covers real keyboard and handheld touch movement, all eight actual game composites, cockpit legibility, initial and later static picker pages with loaded art, and subsequent driving. Test routes exist only in browser memory. Focused tests, manifest validation and file/ref/hash checks accompany the checkpoint. Previous cars, races, original artwork, refs and QA remain intact. The older 104-car branch remains separate. No external writes, publication, transfers or deletion.
