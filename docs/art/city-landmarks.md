# City landmark artwork batches

Source of truth: `AI/last-on-the-grid/state-expansion-landmark-artwork.json`.
The 200 exact `suggestedArtRef` names are stable keys. Use the individual
`artBrief`, the local architectural references, and the abandoned year-2994
setting. Preserve recognizable silhouettes without labels, mileage, UI,
background scenery or logos. PNGs need true alpha and a grounded rubble edge.
Snow coverage follows location rather than a blanket winter treatment.

## Narrow, resumable workflow

1. Inspect the existing reference art. Generate and visually review a batch.
2. Save source PNGs at `assets/campaign-art/landmarks/STATE/exact-ref.png`.
   Append each to `data/campaigns/america/expanded-art.json` with its exact
   `name`, relative `source`, sensible `heightM`, `kind: "sprite"`, and an empty
   `placements` list. Do not overwrite someone else's source or saved sprite.
3. Run the existing PNG importer with **one `--only exact-ref` per asset**:
   `python tools/art/import_campaign_art.py --only landmark-city-ri-rhode-island-state-house`
   This preserves unrelated art and unrelated pending-import records. As before,
   a saved art document changed outside the importer is protected from overwrite.
4. After all four sprites for the city are saved, run:
   `node tools/campaigns/import_landmark_batch.mjs Providence`
   This creates only absent doodad definitions and absent deterministic props;
   it never rewrites road geometry, terrain, lighting, textures or existing props.
   An unsafe existing prop causes an error rather than being silently moved.
   Do **not** run `apply_campaign_art.mjs` to apply this batch to maps.
   If real screenshots reject the initial placement, add only the selected exact
   references to `landmark-placement-reviews.json` and explicitly run
   `node tools/campaigns/import_landmark_batch.mjs Providence --review-positions`.
   This is opt-in repositioning of this batch's owned landmark IDs, never generic
   scenery. It ranks safe candidates using approach angle/readability and rough
   occlusion rays, rejecting candidates whose nearest route is another branch.
   Opposite-side placement requires explicit per-reference configuration.
   Scores are only a shortlist; they cannot approve real rendered visibility.
   Raw GPS references are retained separately in the progress ledger.
5. Check `landmark-art-progress.json` under `data/campaigns/america/state-expansion`.
   Source, saved artwork, definition, safe placement, and actual visual QA are
   separate stages. All 200 entries remain available for resumable work.
6. Render each landmark on approach inside the game on desktop and mobile.
   Check silhouette recognition, scale, grounded bottom, occlusion and readability
   at the intended route position. GPS/mileage are references, not sightline
   guarantees. A candidate placement with safe clearance is **not** visually
   approved. Mark `visualQA: "passed"` only after actual image review, and save
   screenshot paths in `visualEvidence`. Record any remaining placement changes.
7. Run focused validation below and final exact-head CI before a staging merge.

## Placement safety

The planner samples the complete route at 2m and includes authored untimed road
continuations. Every segment is checked, including the far side of intersections
and folded-back roads. A 2m sampling allowance is added to the road half-width.
The collision bound is the circumscribed radius of the **square** runtime solid
scenery collider, not a width/2 circle. A further 5m clear margin is mandatory.
The search preserves the requested side when possible, moves only new landmarks,
and fails instead of placing one on the road. Existing scenery also receives
conservative separation. Large GPS offsets are bounded to a candidate roadside
corridor; zero offsets are never applied literally.

Reruns preserve existing assets, definitions and placement IDs. A source/prop/
definition signature change resets visual QA to pending. Current road geometry
hash and clearance are recorded on every run, and tests recompute them.

## Checks

```
node --test tests/unit/landmarkPlacement.test.js tests/unit/landmarkBatch.test.js
node --test tests/unit/stateExpansion.test.js
python -m unittest discover -s tests/python -p test_campaign_art_import.py
python tools/campaigns/test_state_expansion.py
python tools/art/validate_campaign_pngs.py --root assets/campaign-art/landmarks/RI
```

Before publication, compare the full decoded base race with the candidate after
removing only the new landmark IDs. No other field may differ. Review the exact
changed paths rather than blanket-staging `data/server-storage`.

The Providence pilot is four of 200 assets. Other cities remain pending.

`facingApproachBeforeM` in a per-reference review entry sets the sprite's world yaw
normal toward a selected on-road approach sample. This fixes edge-on sprites on
bends without moving their centers or widening their collision bounds. It is
applied on ordinary scoped resumes, is recorded in placementDetails, and any yaw
change invalidates prior visual QA through the placement signature. Other refs
are not reoriented. State House uses the reviewed 150m-before approach.
