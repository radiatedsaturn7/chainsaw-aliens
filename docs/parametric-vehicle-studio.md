# Phase 7: experimental 3D Car Design Studio

Open **Graphics → 3D Car Design**. Pick the WRX-dimensioned rally sedan, the box-flare coupe, or the low fastback. The same generator makes all three. The workbench starts in production material preview; drag to orbit, pinch to zoom/pan, or use the thumb control and zoom slider. Tap a part or find it in **Parts**. The design is automatically kept as an on-device draft. Use **Menu → Save design** to keep a portable editing file, or **Menu → Export game vehicle** to export the two native model documents with the native car document and attachments. **Load design** accepts both files and regenerates from the trusted genome rather than importing arbitrary mesh payloads. Export does not install a car into the catalog.

Use **Surface** for the hood, roof and rear-deck four-point interior patches, or open the preserved Surface Studio for the trimmed front fender and its control cage/reference overlays. The full-car view stays visible beside or above advanced controls. On portrait the browser workbench uses a non-modal bottom inspector and the familiar Menu/Undo/Redo/Test Drive rail; the two independently interactive canvases are why the inspector isn't drawn inside the game's normal canvas editor. Landscape uses a side inspector rather than concealing the full car in a popup. The integrated Surface Studio retains its prior panel workflow. Earlier experimental assets and production cars are not migrated.

**Test Drive** loads the currently generated body/wheels in a separate, temporary race editor using the existing renderer and vehicle dynamics on the built-in test course. On a phone use the race input deck; on a keyboard use **G** to accelerate and **R** to brake. Choose **Car Design** or press Escape to return. No temporary vehicle is saved to the project, and this session never creates campaign travel or completion progress.

## API

- `genome.mjs`: `createVehicle(family)`, `normalizeVehicle`, `updateDesign(genome, domain, key, value, property?)`, `createDesignSession()`, `serializeVehicle`, `loadVehicle`.
- `geometry.mjs`: `generateVehicle(genome, { quality })` returns Three.js geometry grouped by component, wheel/lamp mount landmarks, dimensions, measured triangle counts and issues. Call `disposeDesign(result)` after use.
- `export.mjs`: `exportVehicle(genome)` returns JSON `{genome, car, models, attachments, metrics}`. Each `models` value is a native `rtg-model`, indexed by the filename stem referenced in `car.car.art`; `car` is a native `race-car` document. Model Builder and Car Editor can consume their corresponding documents when installed under the matching names. The bundle is not a new roster format. IDs default deterministically to the design name; use distinct names for files intended for the same project.
- Browser: `window.vehicleDesigner` exposes edit/history, apply/save/load/reset/duplicate, diagnostics, component selection, display and lighting, `renderView({angle,mode,lighting,projection})` (PNG data URL), export and drive operations.

## Geometry and limitations

Shared wheel centers, roof/window rails, beltline stations and bumper/deck edges derive from the same genome. Axle-dependent fender cutouts and wheel diameters are recomputed, lights and trim follow their mounting zones, and stage-specific physics metadata is derived rather than replacing tire/suspension code. Checks reject detected out-of-range params, crossed stations, nonfinite meshes, unsupported fender trims and insufficient wheel-opening clearance. Export drops coincident/degenerate triangles. These are targeted checks, not a general mesh intersection solver: deliberate overlap exists at glazing seals, lights/trim, some layered parts and interior mounts. A tight fit from turning or bottoming the suspension is not proven by the static check. Badge text and logos do not appear.

Fender surface edits are mapped into the front panel on both sides, with exterior station boundaries held in the full vehicle. Hood/roof/rear-deck controls move the four interior patch points without moving the seams. Other components use simplified forms with size/shape/depth and available family/type choices; they do not have arbitrary 6-axis placement or labor-intensive automotive detail. The current glass, lamps, wheel wells, panel transitions and interiors are draft geometry, not Forza-level bodywork. Preview studio and daylight presets use the shared production automotive shader and reflection profiles, not a separate Blender look. Orthographic overlays are locally uploaded visual guides, not measured reference fitting. The generated tire texture is a demonstration, not baked photo detail.

The short native test loop is a validation path, not a catalog importer or performance benchmark. 60 FPS on physical target hardware, deep cross-component intersection analysis, detailed manufacturing geometry and production-quality rollout are separate gates.

## Front-end shape

Open **Vehicle → Front-end shape** or select **Parts → Front bumper**. **Nose shape** changes the whole front cap in plan: **Square / classic** leaves a broad flat center, **Rounded / rally** sweeps the corners back on an arc, and **Pointed V / hypercar** gives the nose a softened apex. **Corner sweep** controls the depth of the profile without moving the wheels, **Hood-to-bumper roll** controls the leading-edge curve, and **Nose drop** lowers the front center independently of cabin/ride height. Use **Top** to tune the plan and **Side** for the drop and rollover. These are shape controls, independent of grille style or lamp size. Front lamps and grille trim sample the new surface, including in exports and test drives. They are surface-conforming prototype parts, not separately modeled cavities.

The saved design fields live under `components.frontBumper` (`profile`, `sweep`, `rollover`, `drop`); older vehicle designs open with these four values filled from their body family. The editor does not write to or regenerate the production roster.

## Phase 8A: front and rear fascia

Open **Front Design** or **Rear Design** in the Studio. In **Shape**, choose square, rounded, V or tapered, then adjust sweep, projection, taper, rake, upper/lower roll, panel wrap, shoulder, crease and drop at either end independently. The shared rails drive the hood or trunk and quarter panels; their physical part gaps remain visible. **Intakes / Valance** controls duct layout and related components. **Optics** separates nine housing families and their editable outlines from four internal light layouts, positioning, depth, convexity and finish options. The body mesh is actually trimmed to the same boundary the light, grille and duct assemblies mount to. Shared seams use matching samples instead of approximated floating plates.

Choose **Edit control points** to drag a spline control along its guide over a live orthographic view, or enter its normalized value using the numeric fields. Plan, longitudinal and transverse guides are independent and do not change axle locations. The four complete studies under **Starting-point studies** are editable data presets from the same generator; undo restores the prior draft. They are construction demonstrations, not branded production assets or a final model-quality gate.

The design JSON keeps `schemaVersion: 1` and now records `generatorVersion: 2`. Importing an older v1 genome explicitly migrates its nose and lamp controls to current parameters and regenerates the surfaces. It does not recreate the old rectangular geometry bit-for-bit. Earlier native body and wheel documents are concrete meshes and remain usable unchanged. The programmable entry points are `createFasciaDemo(key)` and `updateDesign(genome, 'fascia' | 'optics', 'front' | 'rear', value, property)`. Curves accept four normalized Bernstein control offsets per direction and lamp outlines accept eight bounded offsets. The result exposes sampled rails and trim validation under `generateVehicle(g).fascia`; upper rollover, side corner and valance connect to one terminal surface. Headlight/taillight mounts and wheel joints keep their names for the existing game.

Apertures occupy deliberately disjoint mounting zones; this is not a free-position CAD or optical ray-tracing system. Corner taper is limited by the wheel opening. Trims, surface fit and finite geometry are checked at generation, but no general collision solver or physical-handset frame-rate validation is implied.

## Phase 8B: master rails, contextual handles, and Wizard

Tap a visible seam, wheel arch, lamp outline, styling crease, roof edge or body panel. **Features** shows the controlling dimensions and neighboring surface settings for what you picked; this is also an accessible list when a small feature is hard to tap. **Basic** prioritizes styling, **Advanced** adds measured controls, and **Expert** exposes continuity weights and the existing fascia/Surface Studio editing. **Direct edit** locks a suitable ortho view and displays an axis-constrained handle. Preview a deterministic change in **Wizard**, compare with the original, then accept it as one undoable change or discard it. Preview does not alter the saved genome or native export.

The untrimmed longitudinal side master combines entering position, tangent and curvature over bounded transition strips. Both shaped panel edges, rollover lips and recessed backing reference that datum while retaining a physical gap in meters. Roof, window and pillar surfaces reference the same top rail. Unlike a general CAD surface solver, the join weights are local, and the cap and roof still have separate parameter charts. Alignment mode displays sampled measurements for known rails; it does not discover every possible interference elsewhere on the body. Intentional style creases are explicit exceptions. The fascia optical trims still match the regenerated openings.

JSON format 1 now identifies generator revision 3. v1/v2 files migrate into it while retaining their original editable settings; revision 3 applies the new master surfaces and therefore does not recreate the exact earlier meshes. Previously exported native meshes remain frozen. Browser controls and the programmatic `featureControls`, `proposeFeatureEdit`, and `dragFeature` are two interfaces to the same validated genome; the wizard does not run mesh code supplied by a user.

The preview uses chord-error-controlled side tessellation and separate optical sampling density. `generateVehicle(g,{quality:'lod'})` and `exportVehicle(g,{quality:'lod'})` produce deterministic reduced meshes with the same named mounts, not automatic game camera-distance switching. There is no new runtime LOD policy, hardware 60 FPS certification, general collision solver, or photometric optical simulation. This work does not migrate the production roster.

## Phase 9: construction, profiles, and runtime mesh

**Construction** provides seating layouts, wing profiles, outlet groups, styling curves and paired parts. Advanced edits measured values; Expert accepts a small arithmetic expression language in an optical perimeter, wing profile, or side-surface stamp. Use inputs such as `0.35*cos(3*theta)` for a lens or `0.04*sin(pi*u)` for a character line. The generator parses expressions, limits input size/nesting and clamps their effect. It does not execute JavaScript.

For front or rear lamps, **Mirrored** copies the shared settings and reflects the local envelope, including the formula. **Linked** keeps a shared definition and allows a formula to use the signed side coordinate. **Independent** overrides one side without modifying the other. Fog lamps, mirrors, fender shape and side-skirt generators can consume per-side shape overrides. The current native wheel binding still uses one wheel model on all four corners; the paired mode stored for wheels is not yet an independent wheel-model binding.

**Test Drive** uses the driving mesh. Native export can select garage, drive, cockpit, or opponent; existing saves and the production fleet are not switched automatically. Geometry accounting and a texture-memory estimate are attached to native export metadata. The design JSON schema remains 1; generator revision 4 migrates older drafts while retaining their editable settings. Exported mesh documents do not need regeneration. See [the Phase 9 construction audit](phase9-construction-audit.md) for measured mesh budgets and remaining limits.

### Native WRX fitting controls

Matching the existing hand-authored Field Forgetmenot exposed controls that could not be replaced by one vehicle preset. The editor now offers separately shaped and positioned upper/lower openings, blank fog inserts, bumper-seam station, upper fascia height/width, lamp outboard placement and grille-side reach, and roof length/shoulder/glass-bow controls. Vehicle width/stance now separates front and rear track and the outside tire reserve; the well-liner calculation follows the authored axle tracks. The wing has additional rise independent of its airfoil thickness.

Generator revision 5 retains all v1–v4 authored fields and defaults the new controls. A reconstructed genome retains native proportions and identical wheel centers when set accordingly, but it is not a mesh importer. In particular, an optic at a rear corner cannot yet cut across the fascia-to-quarter seam as a single continuous aperture, and the existing hand-built undercarriage and cabin details are not traced automatically. The stock package stays unchanged.

### Elevated photo review and formed hoods

Under **View → Review camera**, Front / Rear • slightly above are perspective
cameras tilted down about 13° and 14° toward the car respectively. The existing
straight orthographic views are unchanged, including when entering fascia editing.
The local reference overlay can target the elevated and three-quarter views.
These are review camera presets, not gameplay camera or exposure changes.

**Parts → Hood / Scoop → Open Hood shoulders and scoop** exposes the underlying
molded surface and scoop. A paired profile shapes the sheet metal below the
shoulder (with a soft return and swept position); its influence vanishes at the
shared panel edges. The mouth has independent width, rise and corner shape;
its inner sleeve is actual geometry. Zero width and rise retain the legacy
Size / Shape mapping. The new settings live in `construction.hood`; older
version-5 records omit them and retain their previous geometry.

### Painted glazing frames, door hardware and split lamps

Parts → Pillars → Painted frame keeps the A and C frames and roof rail in
body color, with a dark center divider and narrow seals. Parts → Door handles
→ Painted lever adds body-color grips over recessed pockets while leaving
earlier handle types unchanged. The Cabin workbench's Rear glass upper sweep
control bends the rear glass and adjoining side perimeter without moving their
endpoints. Factory split lens is available for the front and rear optics; the
rear separates the red and clear zones while the front has a distinct amber
section and twin reflector modules. Fog cover and rear license pocket dimensions
are editable from the fascia controls. These options require no imported meshes
and are stored in the normal editable vehicle design JSON.

### Lamps that turn the corner, trunk seams, and valance

In **Front / Rear → Optics**, **Wrap lamp into side** extends the same lens
outline and cavity from the face around the exterior corner as a single cut.
The cavity, reflector and lens use the local body-surface normal for depth.
The original front-face behavior is unchanged at zero. Controls continue to
respect linked or independent optical pairs.

In **Rear → Shape**, turn up **Trunk panel recess / seam** and set the trunk
width and depth. The deck insert is cut into the shared panel with painted
lips and a dark closed return. Its boundary is constrained by the lamps and
plate recess. **Lower valance rise** and **Width of raised valance** (under
Valance) shape the bottom edge and the attached backing, not a separate
floating skirt. These are geometry controls, not baked-on highlights.

**Parts → Mirrors → Folded rectangle** gives the mirror housing its own
rolled painted shell, dark base and separate inset mirror glass. Existing
elliptical mirror variants are unchanged.

In Front → Optics, **Rounder reflector bowls** adjusts the internal reflector's
physical aspect using the local surface dimensions. **Reflector flute definition**
adds a separate rolled bowl, bezel and projector plus reusable radial material
detail. It does not change the lamp perimeter or lighting channel.
The **Stamped bumper line** controls under Shape form a raised shoulder with a
shallow return in the bumper surface, with independent height and corner sweep.

### Cabin sweep, boxed wing, and wheel opening fit

- **Cabin** has separate rear pillar base sweep, rear roof edge position and
  painted pillar frame width. The matching rear glazing and upper trunk are
  built from the resulting boundaries.
- **Parts → Wheels / Tires / Fenders → Wheel opening fit** adjusts the visual
  front and rear arch crown and fore/aft gaps independently. Wheel joints and
  tire dimensions remain fixed; the internal wheel-well liner continues to
  protect the swept envelope, separately from the painted opening.
- **Wing → Boxed wing** builds a flat section with two wide wraparound end
  frames. The frame width and rake and the wing height are adjustable.
- **Rear → Shape** has a bumper tuck and a visible plate mount with its own
  height position. An active mount has a painted recess, blank insert and
  fasteners; the legacy plain recess is retained when the mount is at zero.

### Flare profile, door stamping, and gloss finish

**Parts → Wheels, Tires, or Fenders → Wheel opening fit** now separates
the arch's folded lip, shoulder flare, sill return and tire gap. Reduce the
flare without shrinking or moving the tire itself. **Parts → Doors → Door
character line** forms a raised body line with an undercut; the edge and
door gaps are preserved. **Rear → Shape** includes a tighter corner
turn-under profile and a body-color plate pocket without a dummy plate.
**Rear → Optics → Factory split lens** supports a silver upper reflector and
red lower lens with a separate functioning reverse lamp.

**View → Lighting → Gloss booth** is an optional strip-light reflection rig
for inspecting curvature. **View → Adjust paint finish** edits paint and
clearcoat roughness. Those values are shared by the editor and runtime export
and do not require stronger direct light or turning the paint metallic.
Existing designs retain their original finish by default.
