# Vehicle research ledger

`research.json` tracks candidates toward the requested 660 individual-spec vehicles. It is **not a runtime car definition**, an import instruction, or a count of finished cars. It deliberately contains unfinished entries.

- Identify every specification by model year, trim, market and original source unit. `facts` carry a source key into `sources`; RPM applies only to the associated peak value.
- `null` means missing/unverified, never zero. A missing fact must not silently become a simulation default presented as measured data.
- `research_only` means enough cited facts exist to begin review, not that artwork, physics, licensing or driving tests are complete. `needs_source_confirmation` highlights conflicts/incomplete access. `pending_research` entries preserve user must-haves without invented specifications.
- Source access records distinguish full reads, indexed extracts and teammate-verified evidence. Resolve uncertainties before runtime release. Keep curb mass, driver-inclusive mass, gross mass, hp, PS and kW distinct.
- Put any deliberate game-physics approximation in `simulationEstimates`, with a rationale, separately from sourced facts. None have been supplied yet. CVT virtual steps must not be mislabeled a conventional fixed-ratio gearbox.
- Do not pad the target with badge-only duplicates. Researching multiple trims does not automatically qualify them as separate completed cars.
- Artwork and runtime fields stay empty until individually generated, inspected, implemented through the existing car schema/editor and tested. Existing steering-wheel reuse is preferred.
- Movie-inspired entries default to researching stock production vehicles. Modified hero, stunt clone and fictional on-screen claims are not interchangeable.

This ledger does not authorize or modify map/world files. No runtime cars or artwork are installed by these files.
