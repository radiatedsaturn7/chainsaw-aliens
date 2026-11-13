# Route and timing-line review

The previous H01-S01 selection was a northbound Pawtucket-to-Massachusetts path.
Its search snapshot did not extend to Providence; therefore it could not contain
Thurbers Avenue. RIDOT identifies Pawtucket S-curves and the Thurbers Avenue curve
as separate I-95 locations:
https://www.ri.gov/press/view/15071

The replacement uses explicit directed waypoints on southbound I-95, from South
Attleboro (41.9040701, -71.350996) to beyond Thurbers Avenue
(41.7830262, -71.4238989). It is approximately 17.97 km, estimated 325 seconds with
the existing fast-build planner, not a measured gameplay time. All traversed OSM
way IDs are retained, including ways whose vertices disappear in simplification.
The imported control points are within 1.5 m of the source motorway polylines.
Widths reflect three to five mapped lanes. DEM/bridge heights remain approximate.

The internal race reference is retained for save/progression compatibility. The
campaign button now identifies the southbound Pawtucket/Thurbers route. Existing
art, sky, weather and tire/road texture settings were preserved; scenery and decals
were re-anchored to the new road. Existing score records were not erased.

## Timing lines

`data/campaigns/america/line-placement-audit.json` records all 110 installed events.
63 tracks had timing lines moved: open stages are trimmed to nearby existing
straight portions, closed circuits have their seam rotated without changing the
loop. Removed timed road remains in explicit untimed continuations, with terrain
and scenery retained. Distance-based annotations and catalog lengths move with the
line. No synthetic straight was inserted into a mapped road.

The desired straight window is 80 m; constrained roads/short ovals can use 40 m.
The threshold is 10 degrees accumulated heading change. Circuit grid windows are
centered across the seam; open stages use an outbound start/inbound finish window.
These are gameplay line placements, **not verified official venue timing lines**.
Tower Hill's scripted opening and Mount Washington's existing summit finish are
explicitly preserved. The authoring tool fingerprints geometry to prevent repeated
runs creeping farther along the road.

Reproduce a highway refresh:

```
python tools/campaigns/import_side_races.py --only H01-S01 --rebuild
node tools/campaigns/refresh_side_geometry.mjs H01-S01
python tools/campaigns/audit_race_lines.py --apply
```

Other future imports should run the same audit after installation. An audit without
`--apply` reports proposed changes only. Committed source snapshots support offline
routing; uncached elevation tiles still require network access.

## Camera and notes

Fixed-rear yaw stays locked to the car. Its horizon now uses local smoothed deck
grade in the viewing direction, with exponential smoothing. Descents move the
horizon upward so the road stays visible. Tests cover 12%/25% descents in Three's
actual projection and a sampled Bear Notch descent. First-person orientation and
other camera tracking modes retain their prior behavior.

Hairpins now require a compact 150–220 degree reversal, effective radius no more
than 22 m, span no more than 90 m, and substantial steering demand. An acute call
requires at least 165 degrees and radius no more than 10 m. Broad U-bends and long
spirals remain numbered turns. These thresholds are our game calibration; they do
not imply every real rally hairpin requires stopping or reversing.

Validation includes saved asset references, mapped highway proximity/direction,
line-placement geometry preservation/idempotence, camera projection, recce calls,
and co-driver runtime tests. Two existing skybox tests in
`raceFirstPersonCamera.test.js` fail identically on the pre-change RaceEditor code;
the orientation/projection tests and new downhill tests pass. No rendered phone
playthrough has been performed for this change.
