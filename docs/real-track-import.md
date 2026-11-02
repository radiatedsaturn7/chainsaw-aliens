# Real track import

In Race Editor, choose **File → Import Real Track**. Common variants such as “Seekonk motorspeedway”, “NH motorspeedway”, “Leguna-Seca” and “Limerock” are recognized. The venue picker shows the actual search name. Enter a venue name and country/state if needed (for example, **New Hampshire Motor Speedway**), choose the matching venue, then choose a circuit outline. The yellow dot is the provisional start. Set a fallback road width, optionally reverse direction, and choose whether to obtain US elevations. Review the warnings, then open the result and use **Save As**.

The existing race remains in the project. The importer produces ordinary editable road nodes/segments, a closed start/finish seam, surfaces and a terrain tile grid—not a baked mesh or separate physics engine. The existing renderer builds the mesh. Banking is editable from the selected edge's **Banking** control (in portrait, the **Width** drawer). Coordinates use metres, east is +X and south is +Y/+Z. Elevations are relative to the first available road sample and stored in the engine's 12-metres-per-unit convention. Imported documents opt into a larger bounded elevation range; other races keep their original range.

## Services and limits

The existing Python server (`python3 tools/dev_server.py 8000`) handles `POST /__race-import`. No Python packages are needed. The browser-only/static host cannot perform this import and shows an explanation; saved imported races still work without the importer.

- Nominatim resolves the name, returning up to five choices. Search is explicit, never autocomplete. [Public usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires identification, attribution, caching, and at most one request per second across the application. This server enforces that interval and caches results for 30 days. For multiple deployments or substantial use, configure your own/contracted provider rather than independently using the public service on every device.
- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) fetches `highway=raceway` ways within 4 km of the venue. Connected loops are identified using shared OSM node IDs, respecting one-way directions. Nearby crossing geometry is not snapped together. Tagged or explicitly named pit lanes are excluded. Layout discovery has bounded work and offers up to 24 possibilities; junction combinations are candidate outlines, not guaranteed official named configurations. Open/incomplete circuits are rejected instead of inventing a connection. Long venues outside the search radius may need manual editing or a future expanded-area importer.
- [USGS 3DEP EPQS](https://epqs.nationalmap.gov/v1/docs) supplies terrain point elevations for US venues. At most 64 road points and a 5×5 surrounding terrain survey are queried, using four workers, a time budget and persistent caching. Road heights interpolate along track distance; terrain uses bilinear interpolation into a bounded editable grid. **This is approximate terrain, not a download of the highest-resolution 1 m DEM, laser-scanned track geometry, or accurate bridge deck height.** Missing road samples are interpolated with a warning; no coverage imports flat heights with a warning. Incomplete terrain surveys leave surrounding terrain flat.

OSM frequently lacks width and banking. Valid `width` tags take precedence over the fallback width. Banking starts at zero and must be edited. Start-line position is provisional; verify direction and layout. Buildings, artwork, barriers, bridge clearances and detailed surroundings are not imported. GPS here means georeferenced mapped geometry, not a real telemetry recording.

Configuration uses server environment variables (never client-provided URLs): `RTG_NOMINATIM_URL`, `RTG_OVERPASS_URL`, `RTG_OVERPASS_FALLBACK_URL` (empty disables fallback), `RTG_EPQS_URL`, `RTG_MAP_USER_AGENT`. Defaults are public Nominatim, overpass-api.de, Overpass private.coffee fallback, and USGS EPQS. Use an identifying user agent with operator contact for deployment. Cache: `data/server-storage/race-import-cache/` (ignored by git). Candidate tokens expire after 30 minutes. One operation runs at a time. Cancel aborts the browser request and discards the result; already-running provider calls may finish/cache within the server's bounded request budget.

## Attribution and distribution

Geometry is © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). The import flow displays attribution; the exported race retains it, source way IDs, origin and warnings. Preserve it and comply with ODbL obligations when distributing derived track data, including attribution in your game's credits. USGS supplies the elevation data. No third-party code, imagery or track artwork is copied.

## Verification

- `python3 -m unittest discover -s tests/python -p test_race_track_import.py`
- `node --test tests/unit/raceTrackImport.test.js tests/unit/raceTrackImportIntegration.test.js tests/unit/editorMenuSpec.test.js`
- Browser progress-form coverage: `tests/playwright/editor-form-actions.spec.js` (GitHub Playwright job is authoritative on Android/Termux).

Tests exercise segmented loops, junction alternatives, pit exclusion, disconnected roads, metric coordinates, loop elevation closure, missing elevation, terrain, API failures, cancellation, editor loading/round-trip persistence, extended heights and banking.

Name-lookup regression checks cover Seekonk motorspeedway, New hampshire motorspeedway, NH Motor Speedway, Leguna-Seca, Laguna Seca and Limerock. Temporary service failures offer Retry without repeating earlier selections. Live verification on 2026-10-28 passed search/layout/build and native editor loading for Seekonk, NHMS and Laguna Seca. Laguna’s road elevations loaded but its surrounding terrain survey was incomplete and correctly warned/fell back to flat surrounding terrain. Lime Rock geocoding succeeded, but both public Overpass providers timed out during the live check; do not interpret that as missing circuit geometry.

## Layout size and terrain correction (import version 2)

Main venue circuits are ranked before named short auxiliary courses. Lime Rock's default was previously its roughly 0.75 km autocross course; the main mapped layout produces about 2.405 km of editable road. No arbitrary enlargement is applied. Layouts now show km/miles plus a centered preview with their footprint in metres. Optional **Import all listed layouts** builds all listed candidate loops as separate races and applies them only after review; each still needs saving. Alternate junction combinations may share much of the same road. Layout tokens last two hours to accommodate batch elevation lookups (venue tokens remain thirty minutes).

Terrain sampling now uses cell centers to match native bilinear sampling, rather than corners. A road corridor with an interpolation/grade allowance is cut into the editable terrain, preventing the sparse surrounding survey or flat fallback from covering the more detailed road elevations. Existing hand-edited races are not rewritten. Re-import older Lime Rock data for these fixes.

### Point-to-point roads

File → Import Real Track → Point-to-point roads. Search an area (for example Mount Washington or Pikes Peak), choose the map radius, and select a result. In the road preview, tap to place Start, choose Edit next point, and tap Finish. Add intermediate waypoints before Finish to force preferred roads. Focus on a named road and zoom for more accurate placement. Review the calculated route and its kilometres/miles before building. The resulting destination race has one start and a separate finish, editable road nodes, and the same elevation/terrain conversion as circuit imports.

The default router is Valhalla's public FOSSGIS endpoint (`RTG_VALHALLA_URL` can replace it). Routing requests preserve waypoint order. `trace_attributes` supplies ordered OSM way IDs and shape endpoints; these are matched against fetched source ways, preserving travel direction and partial first/last edges. Mismatches and gaps fail matching. If routing is unavailable, connected OSM tracing is used and the preview explicitly reports the fallback. Direct tracing can also be selected manually. It obeys one-way direction and OSM node topology, but does not enforce access, seasonal restrictions, turn restrictions or legal vehicle access. This tool authors fictional races, not navigation advice. Add vias if the shortest connected path takes the wrong branch. Disconnected ways are never joined by drawing a straight line.

`source.routeReference` retains ordered waypoints, original geographic geometry with OSM way IDs, router response and matched edges where available. Reversing during import is recorded separately. Open routes preserve their final elevation; imported elevation bounds permit mountain climbs. USGS sampling remains approximate and bounded to 64 road points plus a coarse terrain survey; bridges, banking, steep hairpins and terrain require editor review.

All Nominatim, Overpass, Valhalla and USGS JSON responses share a 30-day disk cache under `data/server-storage/race-import-cache/`, ignored by Git. No requests are sent on every map tap. Nominatim remains user-initiated and throttled. The server sends an identifying User-Agent and X-Client-Id. Public services can be unavailable or rate limited; for deployment at scale configure your own endpoints and follow provider policy. The map preview is a road diagram, not imagery. Network areas are bounded to 20 km radius / 80,000 road points; routes to 16 waypoints / 100 km and 600 simplified editable nodes.

Protocol references: [Valhalla routing](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/), [map matching](https://valhalla.github.io/valhalla/api/map-matching/api-reference/), [public endpoint policy](https://github.com/valhalla/valhalla#demo-server), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/). No external routing implementation or assets are copied.

Named-road lookups (including “Mt. Washington”) now fetch the matching named OSM segments first. The preview explicitly labels this scope; it does not include unrelated surrounding roads. Area lookups use an outward-rounded bounding box instead of an expensive radius/geometry query. Cached responses from either Overpass provider are checked before contacting a provider, so an unavailable primary does not delay an already cached mirror response. Retry dialogs include the failed import stage.

Mount Washington verification: the retrieved named road traces 12,314 m from base to summit, simplifies to 318 editor nodes, and builds as a destination race. The sampled finish is approximately 1,419 m above the start. Some USGS samples were unavailable: missing road samples were interpolated, and the incomplete surrounding survey used the documented editable flat-terrain fallback.

Imported terrain keeps its survey cell size through normalization, editing and save/reload (`tileMap.preserveCellSize`). Converting a 40 m survey to the legacy 5 m grid previously duplicated each cell 64 times, causing very large saves and mobile loading stalls. Legacy non-imported maps retain their 5 m migration. Terrain paint brush sizes on imported maps follow the retained cell size.

Long imported routes (>5 km) default to 10 m runtime surface sections, unless a surface step is explicitly authored; editable OSM nodes are preserved. Distant terrain bands expand geometrically beyond 720 m rather than filling the whole mountain at 160 m intervals. Packed physics indexes select a larger bucket size when necessary to bound index references, retaining every triangle and exact point-in-triangle/elevation checks. These changes address a separate Playtest preparation memory failure after document loading.

Mountain editor/runtime follow-up: the 2D editor shares geometry reads for each draw and projects preview vertices once per frame. Imported surveyed terrain uses the existing constrained heightmap builder, subtracting the road/shoulder footprint before triangulation; distant terrain strips can no longer cross back over nearby hairpins. A Mount Washington check sampled 4,476 points across the driving surface with no terrain triangle overlap. The local warm map-draw check measured about 21–25 ms (previously 660–780 ms); browser/GPU performance varies. The complete worker package built in approximately 15.5 seconds under a 512 MB heap limit.

Settings → Reverse Start / End reverses linear routes with Undo support. The map's physical terrain/scenery positions stay fixed. Imported routes without FX settings receive a noon lighting preset; sun position and lighting remain editable through Skybox settings.

Mountain launch/height correction: imported route elevations and surveyed terrain share the same datum. The roadbed builder therefore uses imported node heights as absolute elevations, while legacy authored races retain terrain-relative offsets. Start poses sample the finished road deck (including a legitimate zero height). During Playtest the chase camera checks the baked collision surface instead of raw survey heights that have been cut away. Rectangular imported surveys extend their boundary elevations outside the sampled area rather than falling back to zero, avoiding kilometre-high triangles at the edge. Boundary extension also handles the packed terrain transferred to Playtest; sparse authored maps keep their existing fallback behavior. This is an edge extension of a coarse survey, not additional surveyed mountain detail.

Roadside continuity follow-up: the complete imported heightmap is clipped only to the road/margin/shoulder edge, regardless of survey size. The previous large-survey branch clipped to the transition boundary without emitting the transition, leaving a missing strip. Clipping operates on infinite half-planes, so all seam heights are now resolved again against the finite baked road edges; inherited seam flags cannot pin a point to an unrelated edge endpoint. Non-degenerate triangles outside curved roads are retained even when all three vertices lie on seams. Imported roadbeds use one 2.5 m elevation solution while mesh samples remain decimated to the requested render step, keeping spawn extensions and the worker mesh consistent.

The saved Mount Washington route was repaired with a version backup to remove a roughly 36 m out-and-back spur immediately after its reversed start. Two identical route points bracketed the spur, producing overlapping decks at different elevations under the starting car. Original geographic route/waypoint reference metadata remains unchanged and the removed nodes are recorded under source.repairs. Validation uses the saved RTG-001 and the packed worker environment, rather than only the editor's main-thread simulation; coverage checks sample both roadside edges along the full route.

### Mountain terrain seams and render culling

Imported terrain must retain collinear boundary vertices: their elevations can
vary even where their map coordinates form a straight line. The constrained
terrain pass now includes road section boundary vertices and uses boundary-preserving triangulation
for split triangles. Generic ear clipping had discarded these height samples,
leaving visible vertical cracks despite complete coverage in a top-down test.
Grid bucket lookups include the seam tolerance on both sides of a cell boundary.
Nearby road intersections retain their original map coordinates instead of being
moved onto a different edge.

Large terrain render packets are partitioned into 512 m chunks, preserving whole
triangles, artwork, UVs and lighting. Three.js can cull each chunk by its actual
bounding sphere; physics still receives the complete canonical surface. Small
tracks retain the single-mesh path. Terrain outside the road neighborhood also
avoids an unnecessary full-route nearest-point search during preparation.

Mount Washington validation (2026-10-28): 938,880 map-area sample positions with
no missing surface; a 3D shared-edge audit found no remaining discontinuities
above 2 cm. Across 30 route camera positions, frustum testing submitted an
average of 10,985 of 42,195 terrain triangles (about 74% fewer), with 19,082 at
the busiest sampled view. These are geometry workload measurements, not phone
FPS measurements. Browser/GPU timing still depends on the device.

### Imported elevation smoothing

New imports request a 20 m triangular elevation smoothing radius through
`source.elevationSmoothingRadiusM` (bounded to 60 m). The shared roadbed builder
filters the distance-sampled profile at load time, so rendering, terrain fitting
and vehicle contact use the same rounded crests/troughs. Horizontal route nodes,
road widths, source GPS metadata and textures stay intact. Legacy races retain
their previous behavior unless opted in. This is approximate road reconstruction,
not additional surveyed elevation data.

Mount Washington was opted in after backing up the complete saved document to
`artifacts/mount-washington-before-crest-smoothing-20261029.json`; the storage save
also requests a version backup. A cached re-import was tested separately, but its
incomplete terrain survey was not substituted for the repaired saved terrain.
On the 4,832-sample profile, the 99th-percentile adjacent grade change fell from
0.0512 to 0.0214; maximum fell from 0.0640 to 0.0450. These are geometry checks,
not a completed driving lap.
