# Kestrel exterior revision

Replaced the original body sheet with a targeted built-in image-generation edit on 2026-11-13. The original teal salvage roadster, eight-direction order, wheel-less body construction, dimensions and dashboard are retained. Front lamps are now a matched pair in a level fascia; the rear has a symmetric paired-light treatment and one consistent exhaust.

Prompt: edit the original four-by-two sheet; correct mismatched headlight height/size into matching horizontal warm-white housings, simplify and symmetrize rear lamps/bumper and use one exhaust; preserve the teal salvage identity, luggage, camera directions and empty wheel arches. Transparent background, no text, badges, logos or wheels.

Imported using the same `prepareCarSheet`, `carSheetDocument`, `assignCarSheet` and `calibrateCatalogPlacement` helpers as the Car Editor/catalog importer. Remeasured shifted wheel openings and recalibrated graphics-only anchors/transforms for the revised alpha bounds. No mechanical tuning, transmission, interior, gauges, camera, smoke or world documents changed. No manifest entry changes are necessary for replacement of an existing art document.

Release gate: actual eight-angle production editor preview screenshots must be reviewed from the exact PR head before merge. A passing unit test alone does not establish visual correctness.
