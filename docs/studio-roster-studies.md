# 3D Car Design: roster studies

Open **Graphics → 3D Car Design → Menu → Roster studies** to edit a copy
of a design. Undo returns to the previous working design. Choose the existing
**3D** version of the same car in a race or garage to see its bundled study.
The 2D versions, car documents, progression, handling and saves are unchanged.
To view the earlier 3D artwork, add `studioRoster=legacy` to the game URL.

| Existing 3D roster name | Reference vehicle | Studio exercise |
| --- | --- | --- |
| Linaria 2021 | 2021 Porsche 911 GT3 (992.1) | Compound surfaces, fixed wing |
| Linum 1983 | John Buffum Audi quattro A1 R44 tribute | Angular bodywork and rally lamp openings |
| Ember Pod Prototype | Tata TAMO Racemo | Compact, multi-opening fascia |
| 2018 Kestrel 660 | Honda S660 6MT | Kei-car width, short overhangs and separate tracks |
| 2005 Flint Coupe | Citroën C4 Coupé VTS 180 | Raked roof and glass |
| 2024 Caravan-9 | Kia Carnival LX7 | Three seating rows |
| Dustjack V8 | Local Motors Rally Fighter | High stance and underbody |
| Lark 1600 1990 | Mazda MX-5 Miata 1.6 NA | Roadster hardpoints and lamps-down silhouette |
| Briar XT 2004 | Subaru Forester 2.5XT | Boxy body and hood scoop |

These editable studies are not photo-accurate replicas. This pass adds:

- **Linaria:** adjustable swan-neck supports that attach from above.
- **Linum:** flatter nose with a wider grille and more rectangular lamps,
  revised coupe profile and side molding.
- **Ember Pod:** a continuous dark fascia finish spanning the separate
  front apertures, with independent front and rear insert controls.
- **Kestrel:** dark fabric targa cover, lower nose and reshaped apertures.
- **Flint:** two rear glazing faces separated by a physical divider.
- **Caravan-9:** longer roof, upright hatch and 2+2+3 seating.
- **Dustjack:** visible suspension links, axles and skid plates; static
  body geometry only, not a suspension-physics change.
- **Lark:** two flush headlamp lids with recessed shutlines.
- **Briar:** longer roof, upright framed hatch, rails and taller tail lamps.

The Honda roof and Miata roof/headlamp lids are not animated. The Carnival
still uses the shared door/glass layout rather than modeled sliding doors.
The Rally Fighter suspension geometry is a visual approximation.

Run `node tools/vehicle-validation/build-studio-roster.mjs --write` to
regenerate the bundled model pairs from the editable genes. Append study IDs
to re-export only those packs without dropping the other registry entries.
The packs bind only to those existing model references. Compact geometry is capped at
15,000 triangles with four wheels and fitted to existing wheel hardpoints.
If a pair fails to load, the game uses that car's earlier assets.
