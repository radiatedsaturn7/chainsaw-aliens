# Local wave 04 — reusable intake, four distinct configurations

Base `754a9d1b0e5592fadcfa7826ad433a6e3516137f`; branch `local/660-wave04-20261117`. This is additive local work, not a public PR or merge. Echo remains separate. Source records resolve four existing candidate slots; the 660-slot backlog itself is unchanged.

| Alias / runtime ID | Resolved production variant | Key source boundary |
|---|---|---|
| Heatherbell S 1987 / `heatherbell-s-1987` | 1987 European Porsche 959 S 6MT AWD | Porsche supplies 379kW/515PS, 561Nm, 1,350kg DIN and dimensions for the S. Not standard Komfort or Dakar. Six estimated ratios approximate G plus five road gears. Source torque at 6500rpm implies about382kW; the curve is capped at379kW, yielding about508hp/411lb-ft in the editor, while both source anchors remain in provenance. |
| Bogbean 2020 / `bogbean-2020` | 2020 European launch Ferrari Roma coupe 8DCT | Ferrari launch release supplies456kW/620CV,760Nm and dimensions. Published1,472kg is **dry with lightweight options**; estimated running mass1,610kg is separate. Generic automatic controller approximates DCT, not OEM boost-by-gear or active aero. |
| Sea Holly 2024 / `sea-holly-2024` | 2024 US Mustang Dark Horse standard6MT | Ford-authored release confirms500hp/418lb-ft on premium fuel; North American launch confirms Tremec6MT. No European453PS, GTD or optional Handling Package substitution. Mass, geometry, ratios and damping calibration estimated. |
| Thornapple ACR 2016 / `thornapple-acr-2016` | 2016 US Viper ACR standard aero6MT | FCA confirms645hp/600lb-ft,3.55final,50/50weight distribution and295/25R19front,355/30R19rear. Actual per-wheel radii differ. Excludes Extreme Aero; its one-ton downforce and genericViper206mph are not claimed. Old separate Fireweed is base SRT, not this ACR. |

No same-variant production reference was found in the local/staging inventory; ordinary prior Mustangs, Porsches and the old base Viper are not counted as exact matches. F40/F355 remain deferred for stronger primary access rather than filling their slots with guessed verified values. All original cars/art/races/runtime remain unchanged. Only RTG-001 art references are reused; generated documents contain their own physical configurations and explicit estimate parameters. There are no new art assets.

## Reusable pipeline

`node scripts/car-catalog-placeholder-batch.mjs <intake.json> --dry-run` validates sources, unit conversions, positive physical inputs, gear count/order, existing660slot membership, ID/alias/candidate duplication and overwrite protection before any writes. It never uses dry weight as curb mass. Run without `--dry-run` only for a genuinely absent reviewed batch. Fixed metadata time and a pure normalizer make the intake repeatable. Existing entries are intentionally rejected; no cleanup/reset is needed.

The reusable validator is `tools/vehicle-catalog/placeholder-intake.mjs`. This version supports ICE manual and conventional automatic/DCT approximations; it rejects EV/CVT intake rather than silently assigning incorrect semantics. Existing EV/CVT wave builders/checkpoints are preserved. Future waves should extend typed intake deliberately, keep verified facts separate from estimates, audit production identity before generation, and register scenarios via an existing CI-selected catalog spec. Wave04 uses one parameterized picker harness for all four vehicles rather than copying four test bodies.

## Accounting and validation

Local entries: **219 non-system + three templates**; nine shared placeholders and210 previously reported finished entries. This wave adds four authored/unit-tested configurations, **zero new original-art or browser-drive-verified cars**. All nine explicit placeholder IDs occupy existing backlog slots, not new slots. Do not sum candidates, templates or Echo into drive-tested counts.

Validation logs are retained in `/workspace/scratch/wave04-*`. Catalog/intake units: **48 passed, zero failures/skips**. Full manifest/assets pass: **2,216 documents,16 assets**. Final changed car documents are separately revalidated after the torque-curve correction. Eight targeted cases are registered in the existing hosted-selected spec (19 total with prior cases). All eight local attempts stop at Chrome initialization with `No usable sandbox!`; no input driving occurred, no security settings were changed. Actual driving acceptance remains pending a supported environment.

Replay this additive commit after the prior local chain; reconcile manifest and test-import additions without discarding Echo or pilot changes when they land. The original intake and generated document hashes should be retained. Next actions: obtain supported hosted driving coverage after the pending PRs settle, then feed the next primary-sourced distinct slots through this intake rather than duplicating per-car generation scripts.
