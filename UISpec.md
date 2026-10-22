# RTG Studio Editor UI Spec

This is the canonical UI plan for RTG Studio editors. The lower-level shell and token contract lives in `ui/EDITORS_UI_CONTRACT.md`; this file defines the product behavior, menu structure, and input rules that all editor implementations should converge on.

## Priorities

- Preserve portrait mode as the source of truth. It is already close to the desired mobile experience, so changes should be small, targeted, and covered by tests.
- Standardize menus across Pixel, Tile, Level, Actor, MIDI, SFX, Cutscene, Race, Car, and Tire editors without forcing every editor into identical workflows.
- Treat landscape touch, desktop, and gamepad as first-class modes rather than accidental variants of portrait.
- Make drawers, sheets, and tool grids scrollable by tap-drag or pointer drag. Fixed command rails stay stable and do not scroll.
- Prefer shared menu specs, layout helpers, input semantics, and visual tokens over editor-specific one-off UI.

## Shared Menu Model

All editors should expose an `EditorMenuSpec` with this shape:

- `editorId`: stable id such as `pixel`, `level`, or `midi`.
- `title`: human-readable editor name.
- `root`: ordered top-level menu ids.
- `sections`: map of menu section id to label and action ids.
- `actions`: map of action id to label, role, placement hints, and optional icon hint.
- `placements`: per-mode placement hints for portrait, landscape touch, desktop, and gamepad.

Mode-specific rendering should consume the same menu spec wherever possible. Editor-specific callbacks can be attached at runtime by each editor.

Shared implementation helpers:

- `getEditorRootMenuEntries()` returns render-ready root menu ids while preserving spec ids through runtime aliases.
- `buildEditorMenuLayoutPlan()` exposes each mode's command surface, persistent context surface, navigation surface, desktop mobile-rail visibility, and landscape `compactCommandRail`/`rootDrawer` split.
- `buildDesktopTopMenuPlan()` and `buildDesktopDropdownPlan()` define the app-style desktop top menu and dropdown structure.
- `buildGamepadSlideOutMenuPlan()` defines root-open versus submenu-open gamepad menu state.
- `getEditorPointerInteractionPolicy()` defines menu scrolling, work-surface gestures, thumbstick visibility, and right-click behavior per mode.

## Mode Layouts

### Portrait

Pixel Editor and MIDI Editor are the design references for new and revised portrait screens. Inspect their current portrait implementations in `src/ui/PixelStudio.js` and `src/ui/MidiComposerCore.js`; preserve their shared visual language and interaction pattern instead of inventing another editor shell.

- Open directly into a persistent editing workspace. Do not use a wizard, an action-selection form, or a chain of dialogs as the editor's main interface. Routine selection and editing happen in the workspace and its menus. Focused property dialogs, file pickers, confirmations, and genuinely sequential import operations are allowed when they return to that workspace.
- The default portrait layout includes a bottom thumbstick beside **Menu / Undo / Redo / one special button**, a separate contextual hotbar, and a zoom scroller when the canvas, grid, timeline, or other work surface supports zoom. The special button provides the main contextual action, such as Brush, Play/Pause, or Playtest. Keep the standard action slots stable and disable unavailable history commands.
- The thumbstick performs meaningful pan, scrolling, or selection navigation. The hotbar provides quick access to tools, palettes, track controls, or other frequent contextual actions without reopening the main menu. Do not count the four standard action buttons as the hotbar.
- Place the hotbar and applicable zoom scroller in the shared lower control regions used by Pixel/MIDI, keeping the editing surface visible and all controls reachable. A non-zooming screen need not show an inert zoom control.
- Specialized screens may adapt or omit a surface for a concrete workflow reason, such as a picker or playback-only screen. Preserve the remaining shared controls and document the reason in the existing design or implementation notes. This is an exception to explain, not a new permission gate; implementation convenience does not justify a wizard-based editor.
- Validate the rendered portrait layout and actual thumbstick, menu, history, special-button, hotbar, and applicable zoom interactions against the references. Check small portrait viewports, overflowing content, and returning from dialogs; neither overlays nor footer hints may obscure or intercept the controls.
- These defaults apply specifically to portrait. Keep the separate desktop, landscape-touch, and gamepad layouts defined below.

- Exit belongs only in the File menu, never as a duplicate portrait root rail button.

- Keep the current bottom-first mobile workflow.
- Main/root menus stay near the bottom.
- Portrait root rails expose no more than 8 bottom menu items; editors must consolidate overflow into workflow submenus instead of adding more bottom roots.
- The persistent portrait action rail uses `STANDARD_EDITOR_ACTION_RAIL_PREFIX` through `getStandardEditorActionRailIds()`: Menu, Undo, Redo, then one editor-specific contextual command such as Brush, Play, Playtest, or Race Context.
- Submenus and settings use the shared bottom sheet by default. Top portrait controls are reserved for genuinely persistent context/status, not ordinary settings command menus.
- Menu sheets and action grids must scroll by tap-drag. A drag threshold should suppress accidental button activation.
- Level Editor may be tuned to keep primary menus lower and settings less intrusive, but avoid broad portrait redesign.

### Landscape Touch

- Landscape touch shell surfaces come from `LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT`. Root menu access starts from a fixed vertical rail on the left. Dense editors should use the shared 84px compact command rail with `Menu`, `Undo`, `Redo`, and one contextual quick action; this rail is not scrollable. `Menu` opens the full root drawer. The root drawer must originate from the compact left rail so it feels like an expanded main menu, show all categories in a grid when they fit, remain gesture-scrollable when they do not, and stay open while category picks switch the active section. The shared plan exposes this as `modeSurfaces.compactCommandRail: left-rail`, `modeSurfaces.rootDrawer: left-overlay-drawer`, `rootDrawerOverlayOrigin: left`, and `surfaceRoles.persistentNavigationActionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT`.
- Active submenu appears in a drawer/rail on the right. Opening the left root drawer must not hide or steal this right submenu rail; landscape touch should support roots on the left and the active submenu/context drawer on the right at the same time. The shared plan exposes this as `modeSurfaces.rootDrawerKeepsSubmenuVisible: true`.
- The center remains the canvas, stage, waveform, timeline, or grid work surface.
- The bottom rail is the persistent tool/options surface for ribbons, palette/context controls, transport, or quick actions when those controls should stay visible while the right submenu opens and closes. Pixel landscape keeps palette/layer/frame controls in this bottom rail and places zoom below the right submenu, not inside the bottom rail or a separate top strip.
- Editors may opt into a shared top zoom strip when a bottom rail is already dedicated to persistent tool/palette controls and an over-canvas zoom chip would collide with the work surface.
- Do not leave editor-specific landscape controls floating over the work surface when they can live in the shared bottom rail. If an editor omits the bottom rail, that should be because its active workflow has no persistent landscape control surface for the current mode.
- Full drawers, sheets, right rails, bottom rails, and tool grids must scroll by gesture drag when content overflows. The compact four-button left command rail stays fixed.
- Virtual thumbsticks appear only when continuous pan or play movement is needed. They must not cover active menus, and physical-gamepad slide-out menus suppress touch-only menu thumbsticks while the submenu owns the left rail.

### Desktop

- Desktop should behave like a regular app.
- Use a full-width horizontal top menu bar for all root menus.
- Root menu drawers start closed, drop down only from explicit top-menu interaction, and own the command surface for the selected root while open. Desktop dropdown state and motion use `DESKTOP_DROPDOWN_STATE_CONTRACT`. Opening a desktop drawer records shared `openedAtMs` timing; shell redraws must preserve that timing for the same root, and dropdown renderers must pass the live dropdown state into `buildDesktopDropdownRenderPlan()` so slide-down progress remains real instead of resetting or becoming static metadata.
- Desktop dropdown rows use `DESKTOP_DROPDOWN_COMMAND_CONTRACT` so command rows consistently identify as `top-dropdown`, mouse-pointer, release-activated desktop menu items.
- Clicking away closes the open drawer and it must stay closed on redraw instead of following the active tool, panel, tab, or document context.
- Desktop command surfaces are `top-dropdown` drawers. Mobile rails, touch thumbsticks, and gamepad hint bars must not be part of the persistent desktop chrome.
- Desktop shell surfaces come from `DESKTOP_SHELL_SURFACE_CONTRACT` so command surfaces, persistent top/left/work surfaces, suppressed mobile rails, and `desktopMobileRailsHidden` remain consistent across editors.
- Mode acceptance details come from `EDITOR_MODE_ACCEPTANCE_CONTRACTS`: root command surface, command/submenu surface, persistent context surface, thumbstick policy, drill direction, pointer type, row activation, scroll behavior, and focus policy must be read from the shared helper before adding editor-specific mode branches.
- Settings commands are also desktop `top-dropdown` drawer content. The left panel may summarize the active settings/context state, but it is not the settings command surface.
- Every editor File drawer starts with the same desktop baseline order from `DESKTOP_FILE_BASELINE_ACTION_IDS`: New, Save, Save As, Open, Export, Import. Unsupported baseline actions should remain visible as disabled rows rather than disappearing and changing the menu shape. File drawers must not contain history, clipboard, or other Edit-role actions; those commands live in Edit. `DESKTOP_FILE_FOOTER_ACTION_ID` keeps Exit to Main Menu as the final File command/footer in every editor.
- Every editor Edit drawer starts with Undo and Redo. After the history rows, Edit drawer role groups follow clipboard, selection, duplicate, target-specific edits, then destructive actions so copy/cut/paste, selection, duplicate/state/segment/layer edits, and delete/remove commands appear in a predictable order across editors.
- The left side starts below the top menu. Its ribbon appears at the top of the left column, with a persistent context/inspector panel directly below/south of the ribbon.
- Do not duplicate top drawer commands in the desktop left column. The left column should show current document, active section, mode, selected tool, selected asset, selection, transport, or inspector state that is useful to keep visible while the drawer opens and closes.
- Desktop left panel role metadata comes from `EDITOR_DESKTOP_LEFT_CONTEXT_ROLES`: MIDI is the primary reference, Pixel is the secondary reference, and Level, Cutscene, and Actor are required comparison editors with their own context roles.
- Desktop left context panels should use contextual language such as `Active`, not `Menu`, so they do not read as another command menu.
- Use mouse-first behavior: wheel zoom/scroll, middle or right drag pan where applicable, and right-click context menus for selected objects or work surfaces.
- When there is room, top drawers may show complete submenus instead of forcing mobile-style drill-down.

### Gamepad

- Gamepad uses the landscape spatial model.
- Root menu appears on the left while choosing a section.
- After selecting a section, the root rail collapses or slides away and the submenu slides out.
- Gamepad slide-out surfaces, controls, row activation, and suppressed touch surfaces come from `GAMEPAD_SLIDE_OUT_MENU_CONTRACT` so every editor replaces the touch landscape menu stack, including generic left/right touch drawers, the same way.
- `A` selects, `B` backs out of submenu/root, `Start` opens the system menu, and `Back` toggles focus.
- `LB/RB` switch sibling root sections. D-pad and left stick navigate focus. Right stick pans the work surface. `LT/RT` zoom where applicable.
- Focus rings must be visible on every actionable item.

## Editor Menus

### Pixel Editor

- Root: File, Edit, View, Draw, Select, Tools, Canvas, Layers, Frames, Rigging.
- File includes Info, showing the current image name, width and height in pixels, total pixels per frame, current-frame layer count, and animation frame count in a read-only dialog.
- Edit: undo, redo, copy, cut, paste, clear.
- View: zoom in, zoom out, fit, grid, tile preview, onion skin.
- Draw: pencil, brush, fill, line, shape, and brush settings.
- Select: rectangular select, ellipse select, lasso, magic tools, and move.
- Tools: eraser, eyedropper, gradient, clone, dither, color replace, and hue shift.
- Canvas: wrap, symmetry, resize, scale, crop, offset, import image, export image.
- Layers: add, duplicate, delete, rename, visibility, order, merge up, merge down, flatten.
- Frames: add, duplicate, delete, delay, loop, playback, step, rewind, reorder.
- Rigging: add bones, bind layer, bind selection, bake.

### Tile Editor

- Root: File, Edit, View, Tiles, Properties.
- Edit: undo, redo, edit tile art, reset tile override.
- View: fit tile art and tile preview.
- Tiles: previous tile, next tile. Edit owns edit tile art and reset tile override so target-edit/destructive commands have one desktop home.
- Properties: edit properties, collision toggles, one-way toggle, destructible toggle.
- Desktop left panel should show selected tile, character, collision, slipperiness, conveyor, hazard, and destructible state while top drawers own tile commands.

### Level Editor

- Root: File, Edit, View, Tools, Tiles, Tile Art, Actors/NPCs, Triggers, Powerups, Structures, Graphics/Decals, Music, Settings, Playtest.
- Edit: undo, redo, copy, cut, paste, delete.
- Tools: tile, actor, structure, shape, erase.
- Assets: scrollable lists for tiles, actors, triggers, powerups, structures, decals, and tile art.
- Settings: level metadata, MIDI, world settings.
- New and art-free level documents use the built-in gray solid tile and never inherit the global Tile Art autosave; explicit level tile-art overrides remain document-owned.
- Solid collision cells retain a visible editor-only blue silhouette and boundary even when their authored tile artwork is black or transparent; gameplay renders only the authored artwork.
- Playtest starts the authored level immediately from one runtime reset. Startup triggers execute once, and automated golden-path validation remains an explicit testing action rather than a hidden playtest prerequisite.
- Triggers may use Start Race to choose a saved race and either a specific saved car or a runtime Player Chooses picker. Cold race files yield to a cancellable loading screen before hydration, then terrain prepares off the main thread and transfers packed render and physics buffers instead of retaining per-triangle objects. Physics, timers, audio, and controls start only after preparation completes. Starting a race preserves the live level and durable player state so race completion can return to the exact departure point or continue into another authored destination.
- Desktop left panel should expose current mode/tool/asset context without hiding the level canvas; the top drawers own asset and command selection.

### Actor Editor

- Root: File, Edit, View, Settings, States, Linked Parts, Visuals, Collision, Behavior, Preview.
- Edit: undo, redo, copy state, paste state, duplicate state, delete state.
- States: add state and select state from the state list. Edit owns duplicate/delete state.
- Visuals: animation, art references, frame timing.
- Collision: hitbox and hurtbox zones.
- Behavior: conditions, actions, movement, loot, audio.
- Preview: play scene and test controls.

### MIDI Editor

- Root: File, Edit, View, Grid, Song, Tracks/Mixer, Record, Pedals.
- Edit: undo, redo, copy, cut, paste, select all, delete.
- Grid: direct note placement/erase on the grid, quantize, note length.
- Song: play, stop, loop, tempo.
- Tracks/Mixer: dynamic track rows from the runtime mixer.
- Record: enter record mode and single-note record.
- Pedals: pedal chain controls.

### SFX Editor

- Root: File, Edit, View, Timeline, Layers, Envelopes, Generate, Tools.
- Edit: undo, redo, copy, cut, paste, delete.
- Timeline: play, stop, start, end.
- Layers: add, duplicate, delete.
- Envelopes: volume, pitch, pan, add point, delete point.
- Generate: waveform and generator controls.
- Tools: split, trim, normalize, fade, reverse, bitcrusher, time stretch, loop wizard.

### Cutscene Editor

- Root: File, Edit, View, Add, Timeline, Clips, Keyframes, Stage, Audio.
- Edit: undo, redo, copy, cut, paste, delete.
- Add: art, actor, text, color board, music, SFX, effect, pause.
- View: canvas, split, timeline, timeline zoom out, timeline zoom in, fit timeline.
- Timeline: play and step frame.
- Clips: selected clip options, duplicate, move to track, new track.
- Keyframes: set start, set end, set key, delete key, previous/next key, key mode, easing.
- Stage: scene duration, fade in/out, snap/grid, snap size.
- Audio: selected audio volume, fade, loop, and master volume.
- Export/import actions live under File; there is no separate Export top-level drawer.

### Race Editor

- Root: File, Edit, View, Track, Ground, Sprites, Settings.
- Portrait bottom menu: File, Ground, Sprites, Settings. Track is the first mode in the Ground mode picker rather than a separate portrait root; choosing it exposes Add, Move, and the selection-contextual node/edge controls on the work surface.
- Edit: undo, redo, copy segment, paste segment, delete segment.
- File: standard document actions plus From Image, generate random race, and load built-in reference tracks.
- From Image accepts a photo or uploaded image of a pencil route. Users crop one drawing from a page, select a highlighted route, review its inferred circuit/open shape, choose start/direction and scale, and import a new editable race. Processing stays local and cancellable; ambiguous drawings offer manual point tracing. Import preserves existing races and supports Undo. No race is created until Import Track is selected.
- Track (legacy roads): Add is the road placement command; Branching Routes opts into network editing. Add is a persistent placement mode; empty-map taps add draggable nodes, while existing nodes are always selected and moved by direct tap-drag. Node and edge editing is selection-contextual rather than duplicated in the Track menu. Selected interior nodes expose Smooth, Tight, and Hard corner styles; selected edges expose insert/delete, edge tile, surface, width, bumpiness, boundary, and snow condition. Circuit versus point-to-point behavior is inferred from whether the route endpoints connect; there must not be explicit Circuit/Destination menu toggles.
- File → New (including lane-count choices) creates Branching Valley: an editable connected network with Y/T/four-way junctions, an overpass, an underpass tunnel, a shallow ford, gentle grass hills, and distinct start/finish markers.
- The racing minimap draws all network roads as separate paths, with gold bridges, dashed blue tunnels, water areas, explicit start/finish markers, and physical player/AI positions.
- Branching Routes is an opt-in Track command for existing legacy roads. It converts the existing road into connected routes while retaining the sampled shape. Branching mode provides Select, Connect/Extend, Split Route, Y/T/Four-way junctions, Join Junctions, Properties, Start/Finish, Delete, and Water Level. Coincident coordinates do not connect roads; Join is explicit and requires matching heights.
- In portrait Track mode, the first hotbar item remains Track and opens the Ground/Track mode picker. The Add drawer contains Select, Connect / extend, Delete selection and the other network tools; Edit opens selected properties. Multi enables unlimited touch selection of nodes and edges; tapping toggles membership, and Done keeps the selection. In Multi mode (or with Shift), dragging anywhere on the track canvas draws a live selection rectangle and adds enclosed nodes plus edges whose centerline crosses the box. Existing selections are retained; shrinking the rectangle removes only provisional hits. The gesture can begin on a node or road and never moves geometry or creates history. Edit opens group translation (X/Z meters), scale, clockwise rotation, road-width multiplier and surface selection. Geometry rotates/scales around the selected bounds; edges include endpoints, shared endpoints move once, and boundary road curves remain connected. Width/surface apply to selected edges and roads touching explicitly selected nodes. Heights are preserved and widths clamp to 3–40 m. Track/Add also exposes Transform Selection, Select All and Clear Selection. Dragging a selected node/edge after Done translates the group with one Undo step. Group edits and selection survive Undo/Redo; transformed geometry survives save/load. Join/Connect require exactly two nodes and no selected edges. Join merges the second node into the first and reconnects its roads; Connect selected nodes adds a road without merging. Shift-tap also extends selection on desktop. Menu/Undo/Redo/Playtest, thumbstick pan, and zoom retain their existing positions. Legacy tracks also group Select, Add and Delete Node inside Add. Other layouts expose the same commands through Track.
- Race terrain retains its surface colors (grass green, dirt brown) with textures enabled. Painted tile/sprite artwork takes priority over the underlying terrain color only on its assigned cells; transparent or unavailable artwork reveals that base color. Network terrain respects the five-meter paint grid, including on large tracks.
- Race Editor starts with New Race: a single flat 100-meter straight, one Start marker, no Finish marker, scenery, water or painted terrain. File → New and lane variants use this same template. Start / finish allows Finish=None. The previous branching example is preserved as the saved race Demo Track.
- Track direct editing: tap a node to select, drag beyond a 6-pixel threshold to move it, or tap empty ground to extend from the selected node. Taps and tiny finger movements create no history entry. A drag or extension is one undo step; extra pointers cannot move the active node. The map stays framed during editing; pan/zoom remain available, and Zoom Fit explicitly reframes it.
- Node properties include Normal, Y, T and Four-way types as well as world X/Z and height in metres. Changing type preserves authored connections and adds missing arms. Switching types removes only unused generated arms, retaining any that have been extended. Types and generated-arm ownership persist with race saves. Connected sampled curves move smoothly with a junction. Route properties set road/bridge/tunnel, width, surface, direction, and tunnel clearance. When a finish is set, start and finish are distinct named junctions connected by a reachable path. A start-only track supports free-drive playtests.
- Water Level defines a rectangular water volume with a surface height and lower limit in metres. Terrain remains authored with Ground tools. Shallow water slows a car; flooding above the engine intake applies persistent 100% engine damage for that race. Bridges above the water and tunnels below its lower limit remain dry.
- Ground: selected ground tile, paint ground, paint elevation, raise/lower, and brush size.
- Ground triggers are selected from the portrait Ground hot menu alongside Track, Ground, Elevation, Sprite, and Doodad. Trigger mode uses the contextual hot rail for effect, target, and management controls; empty-map taps place triggers while marker taps select them. Triggers are placed in world space and may play a sprite or animation, create a saved doodad, or change race weather when the player enters their radius.
- Sprites: add, move, delete, size, and behavior for vertical scenery sprites. The Sprite chooser is available in desktop, portrait, landscape-touch and gamepad layouts; branching tracks display the same scenery, decals and trigger markers as legacy tracks.
- First-person racing cameras retain the driver heading through spins instead of applying exterior drift or eight-angle tracking. Chase cameras entering tunnels stay between the floor and ceiling and retract when the sight line crosses a tunnel wall.
- Settings: road width, AI racer count, weather clear/rain/storm/snow, and On Race Complete behavior. On Race Complete supports Return to Origin, Next Race using the current car, or Load Level at a required tile selected from a full-level preview.
- Race start settings select a saved MIDI track, enable or disable the 3-2-1-GO countdown, and enable a rolling start with an authored initial speed.
- Race precipitation uses layered screen-space perspective: snow drifts gently while falling from the top of the race view, and rain/storm drops fall with a consistent downward wind vector. Far particles grow and spread mildly as accumulated vehicle travel brings them toward the camera. Braking may slow future approach but must never reverse precipitation, jump existing particles backward, or make it radiate around the car.
- Debug: Physics Surface View is a session-only driving view of the exact triangles and wheel contacts used by vehicle physics. It is available from the editor Settings drawer and the playtest pause menu without adding a portrait root.
- Top Play/Pause: Playtest opens a car picker, then launches the race in the handheld race playtest surface. The physics debug view suppresses authored road, terrain, scenery, and effects while retaining driving controls, HUD, and pause access.
- Playtest pause includes Restart Race, which restarts the current race with the same car and a fresh countdown without exiting to the editor or cancelling race travel. Playtest pause uses the same scaled in-game text menu as Level Editor playtest. Race-specific Settings and Debug rows remain available, but editor button chrome must never render inside the pause surface.
- Desktop left panel should show selected race, inferred route shape, segment count, weather, and active tool while top drawers own commands.

### Car Editor

- File → Car Description edits a short multiline description saved in the car document. The default Choose Your Car screen displays the highlighted car’s wrapped description in place of the HP/torque graph and class/specification panel; the Menu Editor exposes a Car Description widget bound to the selected car.

- Root: File, Edit, View, Art, Drivetrain, Tuning, Aero, Suspension, Drive.
- File → Load Preset offers AWD, RWD, and FWD. These native car documents live in system storage, outside the project manifest. Loading creates an independent unsaved editor copy; its first Save uses Save As. System templates and unsaved preset copies never appear in race car selections or AI settings. Saved user copies behave like ordinary cars. Legacy exported WRX/BRZ/Civic starter records are also excluded from file and vehicle lists; separately named user copies remain available.
- Edit: undo, redo.
- Art opens a shared three-row category menu: Exterior, Interior, and Camera Settings. Exterior owns shell frame assignment, previous/next shell frame, reverse frame, tire treads, add-ons, and per-component Body/Tires/Brakes/Shadow size and position controls. Each exterior component keeps artwork reset separate from a lower-right Reset Size action that restores `1.00x` scale and zero position offsets.
- Exterior provides left/right 45° camera controls and a named 1–8 view indicator shared by Body, Tires, Brakes, and Shadow. Art assigns only the selected component at the current angle; Reset restores that component's default at that angle. Each angle also owns independent component size, position, and visibility overrides, including front/rear/left/right tire visibility. Left and Right refer to the car’s own sides and show both tires on that side. Imported tire artwork defaults to Auto visibility: front tires at 0°, rear tires at 180°, right tires at 45°/90°/135°, and left tires at 225°/270°/315°. Auto also applies to older artwork without a visibility override; explicit manual choices remain available and are preserved. Changing a graphic preserves its overrides; Reset Size restores only that component and angle to 1.00x and zero offsets. All 32 assignments persist in the car document and use the physical camera bearing during races. Unassigned angles inherit existing artwork. The preview camera stays at the selected angle relative to the moving car and shows brake artwork while editing. Compact panels place position and size controls side by side to keep component tabs accessible.
- New car body imports and saved-tire assignments use a bundled snapshot of WRX4’s per-angle placement (position, scale, body rotation, and tire spacing). Existing per-angle adjustments take precedence when replacing artwork. Source images, frame mappings, tire visibility, and vehicle tuning remain specific to the imported car.
- Art > Import Graphic imports Body, Brakes, or Shadow. Tires use a Tire selector that opens the saved tire library; tire graphics are authored in the Tire Editor. Import accepts a 2-row, 4-column image, maps its eight frames to 0° through 315° in row order, previews rotation in 45° steps, and allows swapping frame assignments per angle before applying. Background cleanup defaults to removing alpha values of 8/255 or below, with an adjustable 0–32 threshold; processing always uses a copy of the original pixels. The importer finds transparent gutters near the grid separately for each row, rejects sheets that cannot be safely separated, crops visible bounds, and centers frames without rescaling on matching canvases with a one-pixel transparent border. The rotating preview uses these processed frames. Applying an import installs every assigned frame into the live editor preview immediately, including previews restricted to preloaded artwork. Image dimensions need not divide evenly by four and two. Imported frames preserve transparency and component transforms; Cancel leaves the car unchanged.
- Dragging artwork scale, position, or rotation updates the live preview without restarting the driving simulation. Each slider drag creates one Undo/Redo step, including mirrored adjustments. Tire Spacing moves the graphic wheels apart or together about each axle without changing wheel size or physical track width; it is saved per angle and resets with scale. Reuse loaded images and the preview canvas; keep the normal preview render cadence during dragging and redraw the final value on release. Saving snapshots the document without replacing the live edited car. Opening a car, including reopening the same file, cancels pending preview preparation and recreates the preview from the loaded adjustments.
- Overridden body artwork is a camera-facing billboard whose existing 50%-across/58%-down pivot is attached to the live physical rear-axle midpoint, located half the authored wheelbase behind the physics chassis center. Brake-light and add-on art share that anchor; tires remain on their physical wheel centers, the shadow remains on the ground footprint, and collision stays centered on the physics chassis.
- Interior owns independent Dashboard and Steering Wheel artwork overrides with size, position, clear, Reset Size, and Reset Position controls. Either missing override falls back independently to the procedural tinted dashboard or steering wheel; authored steering-wheel art rotates with steering input.
- Physical controller pedals follow trigger pressure directly, including release; keyboard/touch pedals retain their ramp. Gamepad steering uses one response filter, reaching 90% of a step in about 165 ms. Lower control sensitivity softens small stick movements while retaining full steering and camera travel.
- Right-stick direction selects a car-relative orbit: up looks forward from behind, down looks backward from in front, right places the camera on the car’s left looking right, and left does the reverse. Diagonals select intermediate views using the raw stick direction, independent of sensitivity. Dynamic Fixed selects manual 45-degree views directly, without drift hysteresis. Releasing recenters smoothly; crossing the rear direction takes the shortest arc. Manual look remains relative to the car during skids and keeps body, tires, and procedural models visible. Tire-cylinder steering is relative to the physical car and retains its direction through all eight camera bearings.
- Camera Settings saves Dynamic or Fixed Rear tracking per car. Dynamic retains travel/drift-aware chase yaw. Fixed Rear uses the physical rear axle as an exact, non-lagging chase origin, permits a temporary manual-look offset, and recenters behind the car when look input is released. When overridden body and tire art are both active, tire X positions remain rigidly aligned to that rear-axle body rig while physical suspension and terrain contact continue to control tire Y positions.
- Drivetrain: nested drivetrain menu, engine sound, power curve, weight/balance.
- Tuning: default tires, tire pressure, tire size, brake balance, final drive, differential accel/decel.
- Aero: front and rear aero tuning through slider-style controls.
- Suspension: front/rear springs, damping, and anti-roll through slider-style controls.
- Drive: Playtest directly tests the current edited car without presenting presets in a car-selection screen. Race and Car playtests hide the handheld shell and virtual controls when a physical controller connects, use the full viewport, and restore touch controls on disconnect. Connecting clears held touch inputs.
- Playtest pause shares the Level Editor in-game text-menu scale, layout, selection treatment, and hit-target geometry through the common Race/Car playtest renderer.
- Desktop left panel should show selected car, drivetrain, power, weight, and active tool while top drawers own commands.

### Tire Editor

- Open from the Game editor list or the Car Editor's tire selector. Returning from the Tire Editor restores the Car Editor when opened there.
- Root: File, Edit, View, Art, Properties. Use the shared portrait, landscape, desktop, and gamepad shell. Portrait keeps Menu, Undo, Redo, and Properties in its action rail.
- Select Tire lists saved tires first, separately from built-in templates explicitly marked as having no artwork. It preselects the current tire, loads its graphics before enabling Apply, and explains which appearance will be used. Apply installs the chosen tire; the Car Editor displays the applied tire name. Built-in templates remain available when starting a new tire. Save and Save As persist named tire documents in Tires. Import/Open and Export/Save As use project storage, consistent with Car Editor.
- Art supports existing single-frame artwork, saved multi-frame artwork, and sprite-sheet import using 2×1, 1×2, 2×2, or 4×2 layouts. The tread and rim texture fitting, transparent-gutter splitting, background cleanup, and rotating cylinder preview are shared with the car artwork pipeline. Preview provides 45° view controls and Spin/Pause.
- Properties exposes surface grip for all eight surfaces (dry/wet asphalt, dirt/mud, dry/wet gravel, snow/slush), water evacuation, tread depth, wear rate, physical tire dimensions, and default cold pressure. Values use the simulation's supported units and bounds; compound-specific pressure behavior inherits the selected base tire.
- Surface grip is based on the contacted ground, not a separate weather multiplier. Wet snow blends toward Slush grip, including snow accumulated on other surfaces. Property help explains each condition; older saved weather multipliers are retired on load without changing their surface-grip values.
- Tire graphics and properties support Undo/Redo. A car's Tire button applies the saved tire's graphics and physics while preserving the car's per-angle tire scale, offsets, and visibility. Cars save an embedded snapshot of the selected definition; reselect a saved tire to apply later changes. Existing cars without saved tire selections retain their built-in compound behavior.

### Doodad Editor

- Root: File, Edit, View, Artwork, Size, Hitbox, Collision, Preview.
- Edit: undo, redo.
- Artwork: pick art.
- Size: width, height, plant/ground offset, and weight adjustments.
- Hitbox: hitbox width and height adjustments.
- Collision: default and speed-threshold behavior controls.
- Desktop left panel should keep active doodad artwork, size, hitbox, and collision settings visible while top drawers own document and command actions.

## Gesture And Pointer Rules

- Tap/click on a menu item activates it only when pointer movement stays below the drag threshold.
- Dragging a menu rail, drawer, or grid scrolls it and must not activate the original button on release.
- Pinch zoom is reserved for work surfaces, not menu panels.
- Mouse wheel routes to the hovered scrollable menu first; otherwise it routes to canvas/timeline zoom or scroll.
- Right-click should not open the browser context menu on the canvas. It should map to editor context menus or pan behavior depending on the editor.

## Rollout Order

1. Add this spec, `AGENTS.md`, and a shared pure menu-spec module.
2. Add shared layout helpers for scrollable rails/drawers and desktop dropdowns.
3. Migrate Level, MIDI, and SFX first because they already use shared rails and controller menus.
4. Migrate Pixel carefully, preserving existing portrait tests.
5. Keep Actor Editor's DOM UI covered by the same shared desktop, landscape, portrait, and gamepad contracts as the canvas editors.
6. Keep Cutscene Editor on the shared controller/menu stack while preserving its timeline-specific surfaces.
7. Keep new editors such as Tile, Race, and Car in the shared spec from their first scaffold so they never ship with one-off desktop chrome.
8. Keep desktop top menu/dropdown behavior, click-away close, hover-switching, and right-click context behavior consistent across all editors.
9. Keep gamepad slide-out behavior, shared hints, and focus rings consistent across all editors.
10. Polish the shared RTG Studio visual style across menus, drawers, and launcher.

## Validation

- Unit tests must cover each editor's root ids, section ids, and required action ids.
- Existing portrait tests should remain stable unless a portrait change is explicitly part of a task.
- Add layout tests for portrait, landscape touch, desktop, and gamepad placement.
- Add gesture tests for tap-drag scrolling versus button activation.
- Add controller tests for `A` select, `B` back, `LB/RB` section changes, and submenu collapse.

- Imported car body frames automatically fit their visible pixel bounds to the projected car body width and height, with per-angle size values editable afterward. Body preview controls rotate the artwork in 1° steps up to ±45° per angle; the degree button resets rotation. Rotation persists with the car and is independent of Reset Size.

- Exterior X/Y offsets span −16 to +16. Mirror edits defaults to On and links subsequent transform edits between 0°/180°, 45°/315°, 90°/270°, and 135°/225°: same size and Y offset, opposite X offset and body rotation. Each angle retains its own graphic and frame. Toggle Mirror edits Off for independent adjustments; toggling alone does not overwrite existing adjustments.

- Car Art menu includes Import Graphic and Settings. Import selects Body/Tires/Brakes/Shadow inside its dialog. Settings contains the Mirror toggle. Exterior adjustments are ordered Position, Body Rotation (−45° to +45° slider), then Scale, with compact columns on short panels. Reset opens checkboxes for Position, Rotation (body), Scale, and optional Graphic; only selected categories reset. Preview overlay import, rotation buttons, and Mirror controls are removed.

- Tire imports use surface textures rather than eight directional tire pictures. Select a 2×1, 1×2, 2×2, or 4×2 sheet (columns × rows). Default tread is frame 1; default wheel/rim is frame 3 on eight-frame sheets, frame 2 otherwise. Both roles can be reassigned. Only the chosen two frames drive wheel rendering; other frames remain in the saved Art document. The import preview and live renderer project a textured 3D cylinder with tread on its curved surface and wheel/rim on its end caps, spinning around the axle and steering as one object. Cardinal views show tread or rim; diagonal views show both. All sheets require safe transparent gutters; tire imports never fall back to cuts through visible pixels. Tire surface UVs use the maximum-area fully opaque rectangle within the selected tread frame and the largest fully opaque circle (centers searched at half-pixel increments) inside the wheel frame, including internal holes and source edges. Tire imports normalize alpha 250–254 to fully opaque on a copy before fitting, so nearly opaque generated artwork can cover the cylinder; lower-alpha edges and transparent gutters remain unchanged. The preview reports the number of solidified pixels. Preview and saved car use the same fitted regions; missing opaque regions block import.

- Choosing saved exterior Art opens Single Frame (with source-frame selection), Sprite Sheet (split selected frame in the import dialog), or Use Existing Frames for supported animations (8 frames; tires also 2/4). The saved art is not modified. Import detects opaque light/checkerboard backgrounds and offers an enabled removal checkbox for detected cases; removal floods only light neutral border-connected pixels, before safe sprite separation and tire fitting. The original source remains available when toggling removal off.

- Car camera settings offer Dynamic, Dynamic Fixed, and Fixed Rear. Dynamic Fixed retains dynamic chase position and selects 45° camera bearings relative to the car, with hysteresis between views, so pixel-art body frames and tire projections share an angle. Tire animation follows signed wheel spin, including reverse and wheel slip; saving retains tire texture crop and cylinder settings.

### 3D Object Editor

- Graphics includes **3D Object Editor**. Model documents live in the Models project folder.
- Desktop roots are File, Edit, View, Mesh, Rig, Animation, and Texture. Portrait roots use File, Tools, Camera, Mesh, Rig, Anim, and UV; Tools and Camera expose the corresponding desktop commands through the shared nested menu shell.
- Portrait retains the shared thumbstick and exactly four bottom controls: Menu, Undo, Redo, and animation Play/Pause. The work surface has a modeling hotbar and the shared zoom slider above that rail.
- New 3D documents start with a cube and a visible view-aligned grid. The modeling hotbar has exactly four grouped controls: Vertices/Faces/Object, Orbit/X/Y/Z, Move/Rotate/Scale, and Tools (Extrude/Weld/Mirror). Tap geometry to select it; a red X, green Y, and blue Z transform widget appears immediately for vertices, faces, and connected objects. Drag arrows to move, rings to rotate, or square handles to scale on an axis. The white center handle moves freely or scales uniformly. Each drag is one undo step; Escape cancels it. Existing free viewport transforms remain available after choosing Move/Rotate/Scale, and the thumbstick orbits/pans independently.
- Mesh tools create primitives, place/select/move vertices, join ordered vertices into polygons, extrude selected faces, and weld two vertices. Copy/cut/paste, duplicate, mirror, and independent X/Y/Z symmetry live under Edit/Tools.
- X/Y/Z orthographic views and an orbit view share stable framing. Zoom Fit explicitly reframes geometry. Background images support tracing. Selected faces and vertices are highlighted.
- Rig tools support roots, child joints, hierarchy changes, weighted vertex assignment, posing, and optional IK. Animation clips have keyframes, timing, looping, and playback.
- UV mode displays editable UVs and a simultaneous rendered model preview. Painting targets the chosen material; imported multi-material models retain their separate textures.
- Native JSON, OBJ, and glTF/GLB imports create editable model documents. glTF supports rigid-node and skeletal animation; morph targets and compressed meshes requiring external decoders are not supported.
- Model bindings select a saved model, optional animation clip, playback speed, and position/rotation/scale. Actor states, tile properties, Level scenery, car bodies/wheels, and Race doodads/tiles expose these bindings. Level models render from the side. Race models use continuous 3D orientation and retain the existing camera modes.

## Race AI car selection and performance

- Car Editor → Drivetrain → Category & Performance sets car/truck/van/suv and displays an automatically recalculated, estimated 0–1000 PP rating. The breakdown includes power-to-weight, acceleration, top speed, grip, braking, and suspension damping. Classes are E (0–199), D (200–399), C (400–599), B (600–799), and A (800–1000). Category persists in the car document; PP derives from current tuning.
- Race Editor → Settings → AI Cars & Classes selects available cars, category, performance class, and a default racer. These settings persist with the race. Existing races initially offer saved custom cars, excluding the built-in documents.
- At race start, exclude the player's exact saved-car identity, filter available cars by category and class, shuffle them, and use each once. Fill remaining slots with the selected default even if outside the filters. If that default is unavailable or is the player's car, use another matching car, then another stock/catalog car. Never use the player as the fallback. An explicitly empty available pool uses only fallback cars.
- Saved variants sharing a stock chassis ID remain distinct. Each AI keeps its own runtime car snapshot, artwork, and tuning. Portrait and desktop use the same accessible, scrollable selection dialogs.

- AI car sprites and procedural fallbacks use the same active Three camera as the track and player overlays. Body pose and tire hubs come from each opponent’s canonical render state; road-center elevation is only a fallback before physical state exists. Artwork preloading and drawing resolve exact saved identities/runtime snapshots, including variants sharing a stock chassis ID.

### Menu Editor

- Graphics includes **Menu Editor**. Menu documents use the Menus project folder. File provides New, Save, Save As, Open, Export, Import and Exit to Main Menu.
- Desktop roots: File, Edit, View, Screens, Insert, Properties, Flow. Portrait uses the shared Menu/Undo/Redo/Preview rail and bottom sheets; landscape and controller use the shared editor shell.
- The canvas uses proportional positions so screens adapt to portrait and desktop. Select an element, drag to move it, or drag its gold corner to resize. A drag is one undo step. Properties offers precise placement, colors, labels, parameter bindings and selectable options. Screen selection, duplication, deletion and starting-screen selection are explicit commands.
- Elements include text, artwork, buttons, choices, sliders, toggles, key mappings, video, spinning car previews, car statistics and HP/torque plots. Animation offers an optional dropdown of None, Pulse, Fade, Bob and Rotate effects, with speed and repeat settings. Raw keyframe commands are not exposed; existing saved motion remains readable. Screens support backgrounds, weather/star effects and saved music.
- Actions open screens, go back, set arbitrary typed parameters, play movies, launch races, launch levels, or launch a single saved race. Movies can chain into the next action after completion. Race completion follows the launched race’s own finish behavior, including another race, a level, or return to the originating menu. The Menu Editor does not own race schedules.
- Flow > Use for Main Play saves the menu and selects it as the main Play destination. Use Default Menu restores the starter splash menu. Main Play always opens the designated document at its saved first screen, or the starter splash when none is designated. Preview This Screen opens the currently edited screen, including unsaved changes, without changing the saved start screen. Play From Start explicitly tests the full flow. Preview runs the full flow, including movies, real races, race finish destinations and levels. It preserves the unsaved menu and original world for return to authoring.
- The starter flow is Game Start → Car Selection → World Map → Garage → Race. The splash screen defaults to Game Start and also offers Option Mode, which opens Settings with Difficulty. Confirmation activates the focused control before falling back to the screen start action. Car selection only handles choosing a car. It includes settings and keyboard mapping screens. FX volume, music volume, brightness and control sensitivity are persistent runtime settings. Every destination receives the current named configuration; car and difficulty have built-in race behavior, while custom names remain available to gameplay systems.

- Menu Designer always exposes +, Clip, Send and Properties (in that order) in a bottom hotbar beneath the canvas. Widget, Send and Clip open in-editor dropdowns upward from that bar, with paging for short viewports. Widget selection inserts immediately; Properties is an explicit next step. Desktop also offers a scrollable widget list and property commands in its context panel. Touch roots must resolve `menu-designer`, never fall back to Race/Ground tools.
- Properties is specific to each widget. Buttons choose named destinations; choices/sliders/toggles bind to named values. Sliders offer FX/music/brightness/sensitivity/rotation presets. Car rotators support a fixed car or a selection parameter, automatic rotation, fixed angle or a slider-controlled angle.
- Images can be chosen from saved artwork or imported from the device and saved as artwork. Images preserve aspect by default, with contain/cover/stretch options. Screen background image uses the same source picker.
- Property displays bind to cars, actors, doodads or custom item/configuration objects and expose a property path with suggestions and units/precision. Actor/item images resolve idle artwork or an explicit artwork-reference property. All widget configuration survives menu save/open and reacts to shared values at runtime.
- Sprite bodies and textured tire cylinders share one quantized viewing bearing through each 45-degree sector in the menu and race renderer. Rolling spin and physical steering remain live; fully 3D cars keep continuous camera rotation.

- Menu shapes support rectangle, ellipse and triangle fills with optional outlines. The bottom hotbar’s Send drawer includes Send Backward, Bring Forward, Send to Back and Send to Front; layer order is within the selected widget’s container. Clip contains Copy, Cut, Paste and Delete. The hotbar stays one row; Layers and Screens remain available through the main menus.
- Containers group widgets in screen coordinates: membership changes preserve placement; dragging or resizing the container moves or resizes its descendants together. Container Properties chooses members, and Layout & Style assigns a parent container. New widgets join the selected container. Copy/cut/paste/delete and layer ordering operate on the entire group; undo restores it. Containers show authoring outlines only and hidden containers hide their children in runtime.

- Menu authoring and playback use a centered 16:9 canvas fitted within the available viewport, preserving proportions in desktop, portrait, landscape-touch and gamepad modes. Pointer editing and preview hit testing use the fitted rectangle. Shape fill/outline controls are identical in Properties and Layout & Style, and menu color controls use color pickers rather than raw hex fields.

- Menu preview and playback use the shared level/race handheld screen, shell and MobileControls on portrait/landscape touch devices. D-pad and left stick navigate immediately and repeat held directions after 280 ms, then every 120 ms. A selects, B returns, Start confirms, and Select exits preview. A physical controller hides touch controls; desktop supports mouse, arrows, Tab/Shift+Tab and Enter. Explicit positive Navigation order values are visited first, ascending, with automatic (0) items afterward in drawing order; hidden widgets are skipped.
- Screens > Menu Default Background sets the document background color, saved artwork and effect. New screens inherit it; Screen Properties can use the menu default or a custom background. Changing a screen background field switches it to custom. Defaults, inheritance and navigation order persist with the menu.

- Menu Editor forms open with focus on the non-editable dialog heading, never an input. Menu Save As initially focuses the browser surface. Tapping a field or navigating with Tab begins editing; opening a form must not summon the mobile keyboard. Shared property forms use this neutral initial-focus behavior.

- Menu Editor has a shared top Play control in every layout. Play starts preview; pressing the active top Pause button ends preview and returns to authoring, as does Exit Preview. The P keyboard shortcut can still suspend/resume playback. Race/level destinations use their existing playtest controls. Race return destinations resume the menu; leaving a preview-launched level (including race-to-level travel) restores menu authoring and the original world.

- During menu playback, Left/Right moves focus between visible controls in the same row when a button or key binding is focused; it never activates those controls. Choices, sliders and toggles retain Left/Right value adjustment. Confirm activates the focused control; Up/Down and Tab retain navigation order.


## Radio and Mix Tapes

- Radio Editor uses the shared editor shell: desktop top menus and inspector, portrait thumbstick plus Menu / Undo / Redo / Play rail, landscape command rail and drawers, and gamepad slide-out menus. Its persistent workspace lists selectable stations and tracks; properties and artwork are individual actions, not a wizard. File imports MP3s and saves the library; Edit provides durable undo/redo; Stations and Tracks edit metadata, artwork, membership and order. Play/Pause previews the selected song, including locked or unassigned tracks, without changing station membership or player unlocks. Selecting a different song stops the old preview; Play starts the new selection, and Pause/Play resumes the same song. Preview stops when leaving the editor. Playback advances through the station (or the visible library when auditioning an unassigned song), keeping the selected song in sync. Repeat cycles Off / All / Song; Off stops after the final song. Tap the transport button to play/pause; hold it for 500 ms to open the shared Pixel/MIDI transport popup with previous, rewind to start, next, stop, play/pause and repeat. The Playback menu exposes the same commands for keyboard/gamepad access.
- Audio > Radio Editor imports MP3 tracks with stable IDs, song title, artist, album and album artwork. Stations group tracks and have names and logos. Artwork uses saved Pixel Editor art or image upload. Station and track metadata persist independently of player unlocks.
- Doodad Editor > Art exposes Import Image and Item / Mix Tape, including in portrait. A mix tape references one radio track. Race placement uses the existing doodad tools; Level Editor > Graphics > Add Mix Tape uses existing graphic move/resize/delete controls.
- Mix tapes rotate during gameplay. Contact unlocks the referenced track without car damage or velocity changes. The collectible disappears only after durable save; failures allow retry. Unlocks survive reload and renaming songs or stations. Collecting works even with radio playback disabled.
- Level and race pause menus expose Radio when both Options > Radio and that level/race's Radio setting are enabled. Radio supports stations, Play/Pause, Skip, Rewind/Previous and toggling unlocked tracks. Song lists page within the shared gameplay menu. Station logo, album cover, artist and album accompany playback.
- Radio Editor → Tracks → Music Drops configures song timestamps in seconds for the race start drop (default 3 seconds) and an optional finish/chorus drop. Set Start/Finish Drop at Playhead captures the selected song's preview position; Playback previews either transition. Cues persist with the library and undo/redo. Race radio automatically plays an unlocked, enabled song from an allowed station, falling back to another allowed playable station without saving a global station change. A three-second fade-in follows the actual countdown and lands on the start cue at GO (the final countdown second); early cues wait silently. Pausing the countdown pauses its music. The countdown waits up to five seconds for music to prepare; after that, racing proceeds and late media catches up to the current countdown. No-countdown races start at the cue. Existing radio enable/disable, station restrictions and song unlocks still apply; Car Editor previews never start race radio.
- Completed races display Race Results and finish time with Continue, using the shared gameplay menu. Music fades out for 0.6 seconds then jumps to the configured finish cue at full music volume, once per finish. Without a finish cue, the song continues. Continue performs the existing race/level/return finish action. Restart and leaving the race cancel pending music transitions.
- Race Editor → Settings → Radio opens a focused Race Radio dialog with On/Off, a checkbox for each station, and OK/Cancel. All stations are selected by default, including for older races. OK records one undoable change; Cancel changes nothing. Save/Open preserves the enabled state and station selection. Selecting all also includes future stations; selecting none allows no stations. Race playback and its pause menu only offer the selected stations, without changing global radio preferences.
- Music volume defaults to 0.4; saved settings load at startup and remain authoritative. MP3 radio and Radio Editor previews apply both master and music volume, with race fade gain applied afterward (including mute and track changes). Radio suppresses the MIDI music bus while playing; pausing or stopping restores it. Leaving gameplay stops radio. Turning radio off hides its pause entry without deleting unlocks.

### Item Editor

- Game → Item Editor reuses the Doodad artwork workspace and the shared portrait action rail, contextual hotbar, thumbstick, and zoom scroller. Properties and individual effects are focused dialogs; the editor remains a persistent workspace.
- Item files live in `items`. Each contains artwork, level pixel dimensions, race dimensions, and an ordered list of data-only effects: health, max health, armor, currency, keys, weapons, abilities, inventory, devices, unlocks, player modifiers, maps, and timed speed effects. Built-in level pickups are defined in `src/content/items.json`; the editor can open a template and save an override using its existing name.
- Grants persist in player progress. The “Remember collection between runs” option determines whether that placement stays collected on later runs; disabling it permits repeat collection in a new run. A failed save leaves the item available.
- Music tracks are inventory in the Radio bag; mix tapes grant tracks using the Inventory effect. Existing radio unlocks migrate into that bag. Existing doodad mix tapes remain loadable and can be imported into Item Editor; new artwork and pickup settings belong here.
- Level Editor places item files as movable sprites through Powerups or Graphics. Race Editor paints item files through Sprites → Place Item, rendering them like doodads without collision damage. Saved placements retain their item definition.

- Effect editing uses a single compact form with only relevant fields. Recipient means Player, Allies, Opponents, or Everyone; weapons, abilities, items, tracks and stats use named selectors, never raw IDs.
- Effects run when Collected, Used, or when a Projectile hits. Items with use/impact effects remain in the Items bag until used. Inventory is available in level/race pause menus; Use resumes play, and U repeats the selected available item. Nitro and Slow shot templates provide timed speed boosts and opponent projectiles. Race effects pass through the authoritative physics runner and worker input; expiry restores neutral handling.

- Selecting or importing 2D item artwork sets level dimensions to the image pixel dimensions and matches race width to its aspect ratio at the current race height. The preview preserves the image proportions; Properties can still override placement sizes.
- Item Art supports 2D artwork or a saved 3D model. Model Animation selects a named clip (or None) and playback speed without selecting the file again; the binding survives item saves and level/race placements. Level items render the animated model through the shared side-view renderer; races use model geometry and retain collectible behavior. Actors expose the same animation selector per state.
- The 3D Object Editor supports multiple named animations in one object via Animation New / Select / Properties. New animations start at time zero in bind pose, independently of the previously edited clip.

### Player garage and car parts

- Item Editor → Parts defines an installable car part: an author-named slot, credit price, shop availability, optional unlock requirement, compatible saved cars, required installed parts, stat changes, RPM-dependent torque multipliers, tire replacement, and tuning ranges. Parts use item files and can be purchased, collected in levels/races, or granted by Inventory effects. Starter workshop items are editable JSON data, not item-specific runtime branches.
- Player inventory owns part copies. Garage configurations are stored per saved car reference in item progress, separately from source car documents. One copy can be installed on one car at a time; replacing/removing a part returns availability without deleting ownership. Removing a required part is refused until dependent parts are removed. Removing a tuning part also removes settings it enabled.
- Purchases, fitting, removal and tuning are persisted through the same serialized item transaction. Failed saves change neither credits nor the active setup. Shop unlock requirements govern purchasing; finding a part grants ownership directly.
- Race travel builds a fresh car clone from the selected source and installed parts. Changes cover torque/HP curves, gearbox variants, mass, suspension and saved tire physics/artwork/pressures. The runtime setup never overwrites saved car art or stock tuning. Race continuations reuse the same garage context without stacking modifications.
- Menu Editor can add a Garage Screen from its screen picker. New menu documents include one linked from Choose Car. Garage uses regular choice, property, car preview/stat and button widgets. Choices can source Garage Parts; Player Garage data exposes credits, price, ownership, installation and status. Actions buy, install, remove, tune and reset the selected car. Authors can rearrange these or connect them to their own screens. Garage Tuning leaves unavailable categories and settings visible in grey with part requirements. Tire pressure is always adjustable; other numeric ranges come from installed parts.
- Menu preview uses an isolated copy of garage inventory and credits. Preview purchases and installations cannot alter player progress.

- Project file lists and car selectors exclude deleted documents even when version history remains on the server. Retained history does not count as an existing file.

- On the mobile main menu, offer Full screen once per page load with OK selected and Cancel available. There is no separate Enter Fullscreen button. Keyboard/controller navigation stays in the prompt while open. After dismissal, wait for confirm/cancel release and consume trailing clicks before resuming the menu; OK must not also activate Play. Cancel leaves fullscreen unchanged.

- Race launches load saved opponent cars and their artwork before creating the AI grid. System presets and legacy starter records are never candidates.

### Garage menu widgets

The starter car-selection screen uses an editable Car Showroom widget bound to `carRef`. Show at most four cars per page, parked at the front-left view; left/right changes the selected car, enlarges and rotates it and dims the others. Linked statistics update on highlight. Confirm opens the world map. Pointer selection highlights a different car on first tap and confirms an already selected car. Additional cars remain reachable with left/right paging.

The Garage screen starts focused on Play, includes a car preview and statistics, and opens a dedicated Upgrade screen with the Garage Parts Browser. The browser drills into authored section → installation slot → upgrade tier; Back returns one level before leaving the screen. None / Stock removes that slot's upgrade without selling it. Item Editor supplies actual upgrades, section, tier, price, unlocks and car compatibility; no placeholder upgrades change physics. Buying and installing together is one saved transaction. Car Editor Drivetrain → Installable Upgrades defaults to all slots, including future slots, and supports a restricted set.

Both widgets are available through the Menu Editor's + picker and Insert menu. Showroom properties expose angle, rotation duration, visible count, selected scale and unselected brightness; On Select and On Confirm are separate serializable actions. Screens and other widgets retain normal layout/style, grouping, undo and preview behavior. Existing saved menus are preserved; the Screens picker can add a Car Showroom template and its standard destination screens. The existing responsive menu canvas and portrait controller shell remain shared.

- The default Garage has exactly three buttons: Play starts the race selected on World Map; Tune opens the dedicated Tuning screen with eight category tiles and in-game sliders; Upgrade opens the dedicated parts browser. These are ordinary editable menu screens. Back/Escape/controller B returns to the previous screen, retaining the chosen car.

- Car selection shows the cars and live specifications without a heading, car-count counter or confirmation instructions. Keyboard, gamepad and touch highlighting share the selected car parameter with the stats and power curve.
- World Map is a standard editable widget. Nodes have race destinations, positions, optional unlock-variable equality conditions and completion variables. Confirming an unlocked node opens Garage with that race selected; locked nodes can be highlighted but cannot open Garage or launch. With no authored nodes, project races form a sequence: finishing the preceding race unlocks the next. Properties edits individual nodes; Layout & Style moves the map as a whole.
- Race Editor → On Race Complete → Menu / Variables configures a menu document/screen and saved variables, or adds variables to an existing race/level destination. Races automatically set `raceCompleted.<race_name>` (spaces/punctuation become underscores). All supplied and currently saved races return to World Map by default. Level Editor triggers expose Open Menu / World Map and Set Menu Variables. Progress persists between sessions; menu previews use isolated progress.

- Racing simulated D-pad steering uses the gamepad rack-response profile, with the existing vertical gear-shift and pause-navigation controls preserved. Touch brakes apply and release on the next input update; physical analog trigger pressure remains proportional.

- Cars without an authored service-brake force use a mass-scaled 12.5 N/kg brake budget (minimum 9000 N), before pressure and front/rear bias. Explicit positive brake-force settings are respected by the authoritative simulation. Tire contact and ABS continue to limit achievable deceleration for every input device.

- Radio Editor Playback → Keep Screen Awake defaults on for the editor session. A screen wake lock is held only while preview audio is playing; pause, stop, errors, editor exit, and hidden documents release it. Returning to a visible document reacquires it if playback is still active. The menu reports Active, Off, Unavailable, or Released by Device. Requires browser wake-lock support and a secure origin (HTTPS or trusted localhost); it does not prevent manual locking or promise background playback while the phone is locked.

- Radio Editor’s top transport places `<<` (previous song) to the left of Play/Pause and `>>` (next song) to its right in every layout. The currently playing track has a green border and a “▶ Playing” label, and track changes bring its row into view. Pausing removes the playing indicator while retaining selection. Rewind to Start remains in the transport menu.

- Splash and Choose Car default to solid black backgrounds without background effects. The default showroom has no runtime selection border; its highlighted car scales to 125% with a 0.18-second zoom transition and a four-second full rotation. Showroom Properties expose size, zoom time, and rotation duration. Layout & Style → Selection indicator offers Cursor (configurable text or artwork at the left edge), Border (an outline), and Disabled (no selection indicator) on any menu element. Disabled changes only the indicator, not interaction. Authoring selection outlines and resize handles remain visible. Existing Show/Hide border settings migrate to Border/Disabled.

- Splash, Options/Settings and Input Mapping use solid black screens and controls with a `>` selection cursor. Every element’s Layout & Style supports a font family, optional uploaded WOFF2/WOFF/TTF/OTF font, cursor text, project cursor artwork, an optional uploaded PNG/WebP/GIF/JPEG cursor image, and cursor size. Uploaded assets are embedded in the menu document for save/export and undo/redo. Uploads are decoded before applying; cancellation leaves the item unchanged. Project cursor art overrides the uploaded image; text is the fallback while images load.

- Confirming a showroom car locks it for the current game. Game Start explicitly begins a new car selection using the editable Start new game action; reopening the menu alone does not unlock the existing game. Confirmation clears pre-game navigation history so Back cannot return to the splash screen or car selection during the game; ordinary links to car selection redirect to World Map. The previous saved car is replaced only when the new selection saves successfully. Highlighting alone does not commit a car, and saving must succeed before confirmation proceeds. Menu Editor previews keep an independent, temporary lock.
- Garage and Tuning use solid black backgrounds. Every car can adjust all four tire pressures without buying or installing parts; these settings persist, apply to the race car, and reset to the stock car values. Other tuning settings remain unlocked by installed upgrades.

- Menu Editor → Screens → Menu Default Font sets the inherited font family or embedded uploaded font for all screens. Items use Menu default unless Custom font is chosen under Layout & Style. The menu font survives save/export and undo. Text-control cursors sit beside their centered label. The starter showroom reserves a taller description panel for an additional line at both wide and portrait sizes.

- Options → Cheat Codes opens an editable black menu screen containing a Code Entry widget. Up/down cycles uppercase A–Z with wraparound, left/right selects a character, Confirm submits, and B/Escape returns. Touch uses the arrows over/under each letter and ENTER. The widget exposes its parameter and letter count in Properties; its confirmation action is configurable as Redeem cheat code.
- NOLOVE adds $1,000,000; LONELY grants/unlocks all authored upgrades and equips the highest-tier compatible parts (price breaks ties, dependencies and car restrictions are honored); IGNORE blocks player and vehicle damage. LONELY entered before car selection equips once when the car is loaded. Saved effects persist; editor previews use isolated inventory and money. Invalid codes and failed saves grant nothing.

- World Map uses no outer selection box, heading, bottom selected-race caption, or Back button. Nodes and connections remain, including the active-node ring. An editable Race Description widget bound to raceRef displays the highlighted race description in the lower-right black area; descriptions are entered under Race Editor → File → Race Description and saved with the race. Blank descriptions render blank.
- Splash Game Start and Option Mode sit higher over the artwork and have transparent control backgrounds. Layout & Style exposes a Transparent control background checkbox for menu elements independently of text, cursor and selection styling.

- Adjust Tuning uses a 4 × 2 grid: Tire Pressure, Tire Type, Engine & Weight, Gearing, Suspension, Alignment & Aero, Brakes, and Differential. Exit is at the bottom right. Grey categories remain selectable for their requirement message but cannot be opened until an available setting exists. Individual unavailable fields also remain grey.
- A opens a category, then selects a setting. Left/right changes its slider draft; one press changes one authored step, and holding accelerates after a delay. A saves the value; B cancels the draft without changing the car. B from a field list returns to categories, and B/Exit from categories returns to Garage. Touch uses the same handheld A/B controls, with draggable sliders and minus/plus buttons. No number-entry forms are used.
- Tire Type is a discrete slider over Stock and owned, compatible tire upgrades with an available copy. Applying preserves ownership and enforces dependency/installation constraints. All accepted settings persist in per-car game progress and are applied on subsequent races without editing the source car. Menu previews use isolated garage progress. The editable Garage Tuner widget and existing Tune car action both use this flow; the saved Game Menu uses the new grid.

- Upgrade Parts Browser uses fixed four-column, two-row pages at every drill-down level. Left/right advances between cards and pages; up/down moves between rows, then Exit. Touch uses the same card geometry and Back/Prev/Next footer. Installed, locked, owned, and price labels remain visible. The saved Game Menu and new Upgrade screens use this layout.
- Race Editor File → Scale Race accepts 10–1000 percent, scales the horizontal layout around the origin, and optionally scales road widths/scenery sizes and elevations. Roads, network geometry, scenery, decals, water footprints, race triggers, hazards, and co-driver distances stay aligned. Painted terrain is resampled at the fixed 5-meter resolution, so shrinking can remove details. Invalid supported dimensions reject the operation. Scaling is one Undo step and requires Save to persist.

- Menu screen navigation, including Back and Menu Editor previews, fades the outgoing screen to black over 150 ms and fades in the destination over 150 ms. The menu viewport alone fades; handheld controls and preview exit stay available. Navigation input is ignored during the transition to prevent double selection. Screen changes capture one outgoing frame using the canvas pixel transform so portrait/high-DPI snapshots exclude the handheld shell. Destination setup and rendering wait until a black frame has been displayed; the fade-in begins after the destination has rendered beneath black. Closing playback releases the snapshot.

- Race Playtest supports start-only networks as free driving: a reachable road supplies the spawn direction and route samples, while Finish remains unset and driving past the road end does not complete a race. Missing start roads and invalid explicit finish references show actionable errors before creating a playtest session.

- The Car/Tire Editor saved-tire picker refreshes the server tire index whenever opened, preserves its selected tire during refresh, and keeps cached choices usable offline.

- The tire catalog includes Stock, Street, Tarmac Race, Rally, Offroad, Rain, Drift and Snow. Saved custom definitions have matching tire shop items; tuning offers the stock car configuration and owned compatible sets. Stock Tires cost zero; purchase still records ownership. Tarmac Race trades wet/loose-surface grip and wear life for dry-road grip. The initial saved catalog uses Offroad artwork as a placeholder.

- Menu element Layout & Style supports solid text color/tint, two-color gradients, and three-color gradients with color pickers and top-to-bottom or left-to-right direction. Gradient defaults are blue/white/blue; text/button gradients span the lettering rather than the control background. Font family/upload and menu-default inheritance remain independent of text coloring. Text appearance survives save/export and Undo/Redo.

- Screens → Upload Menu Font (TTF…) opens the device font picker directly for the inherited menu font. Properties → Upload Item Font (TTF…) applies a custom font to the selected item. Both accept TTF/OTF/WOFF/WOFF2, validate the font, embed it in menu saves and support cancellation and Undo/Redo. The Default Font form uses the same file chooser.

- Layout & Style includes text outline thickness (0 disables it) and color. Outlines draw behind solid or gradient text and scale with font size. The saved Game Menu applies a black 1.5 outline to items using LastOnTheGrid_Pixel.ttf; other fonts are not automatically outlined, and the uploaded font file is unchanged.

- Car showroom rendered sprite frames are reused without reparsing evicted large artwork documents. Cache reuse checks source identity; edits, replacements and explicit cache clearing rebuild affected frames.

- Screens → Screen FX offers None, Snow, Rain and Stars with intensity and wind controls. Snow/rain reuse shared level/cutscene weather motion and rendering, are clipped to the menu, and appear above background artwork but behind controls. Weather state is bounded, pauses with preview time, and resets when the viewport/effect changes. The saved Game Menu splash uses Snow.

- Screens → Background Rules maps the most recently completed race or current chapter to artwork, with editable priority (first match wins). No match uses the normal screen background. Race completion saves lastCompletedRace; the race Menu Destination form provides Chapter (blank preserves current). Rules preserve FX and use persisted menu progress; Configuration Parameters preview them on the canvas. The saved Game Menu keeps original splash art 8576. Garage uses providenceSplashBackground as its changing scenery, with a fixed full-screen garage image widget above it and below the car/UI; background rules belong to Garage. The saved garage car preview is 1.5× its original size, centered slightly right and shifted down half its original height.

- Menu Editor → Screens → Screen Music selects saved MP3 or MIDI music per screen and configures track volume, fade-in seconds, fade-out seconds on exit, looping and start position. Upload MP3 / MIDI saves a Music project asset and assigns it to the current screen; menu save/export and undo preserve playback settings. Preview pause also pauses HTML audio. Global music/master volume applies to MP3 playback.
- Radio Editor → File → Add Saved MP3 / MIDI selects project Music tracks; Upload MP3 / MIDI creates a shared Music asset and a radio entry. MIDI supports pause/resume, seek, repeat and race-drop cues using an independent MIDI bus so radio ducking does not mute it. Current composer MIDI uses 24 ticks per beat; legacy songs use 8.
- Project Browser → Music lists MP3s alongside MIDI and supports uploading, auditioning, renaming, duplicating, deleting and version management. MP3 Open auditions the audio without opening the MIDI editor; closing the browser stops preview. Existing embedded/hosted radio MP3s become Music assets while retaining track IDs, station membership, unlocks and cue settings.

- Network-track rendering generates default white dashed center lines, nonzero-width left/right margin artwork strips and roadside posts on each baked branch, including elevated roads. Markings follow branch geometry rather than connecting unrelated flattened sections. Narrow roads also show center dashes. Margin visibility and artwork remain controlled by the race settings; untextured network margins alternate red/yellow.

- Menu buttons support saved artwork backgrounds through Properties → Choose Artwork, with contain/cover/stretch under Layout & Style. Artwork draws behind the label and retains the selected cursor or border; Transparent Background only disables the solid color fill.

- Upgrades and Tuning offer one free Stock choice per slot. Stock restores the original non-tire parts; the tire slot uses the saved Stock tire definition (stock template when unavailable), with no duplicate purchasable Stock entry. Every gameplay car starts with this baseline unless a tire upgrade is equipped; saved upgrades and pressure tuning are retained. Garage, Tuning and Upgrades share the authored garage overlay and chapter background rules. Tuning respects Transparent Background.

- Screen Properties includes an Instant transition group. Navigation between screens with the same nonempty group skips the visual fade, including Back; entering or leaving the group retains the normal fade. Garage, Tuning and Upgrades share the garage group and matching car previews behind their controls.

- Tuning omits the Adjust Tuning heading, passive controller instructions, and category/list Back or Exit buttons. Category navigation stays within the eight tiles; the standard Back input returns to the previous view. Setting names, values, Set/Cancel controls, and actionable status/error messages remain.

- Upgrade omits the screen title, root Upgrades breadcrumb, B/Exit and Prev/Next footer, and on-screen Exit button. Category/slot context remains while drilling down. Removed footer areas have no invisible touch actions; standard Back and directional paging remain.

- Routine menu navigation and Tuning initialization do not show transient Loading text. Explicit status and error messages remain visible. Garage-family credits panels use a taller button-art background.

- Player-facing currency is named Scrap, including balance panels, shop prices, insufficient-funds errors and cheat rewards. Backend credits fields and saved balances retain their existing names and values.

- Upgrade and Tuning widgets use their Choose Artwork reference as the background for internal tiles/buttons, stretched to the control bounds. Labels and focus outlines draw above the artwork; locked controls darken it. Unassigned or loading artwork falls back to the standard fill.

- Tuning and Upgrade category grids share fixed four-column/two-row card geometry independent of label length; saved screens use matching bounds. Tuning list row height is constant regardless of setting count. Unselected menu controls/panels darken slightly, while unavailable artwork is greyscale and darker. Disabled in Layout & Style persists through save and prevents focus, touch and activation. Locked or unaffordable upgrades are greyed out and cannot be purchased; their details remain inspectable.

- Garage-family controls use brightness to distinguish selection without rectangular selection borders. Upgrade/Tuning internal buttons have no focus outline; unselected controls render at 55% brightness, selected controls at full brightness, and disabled controls stay greyed out.

- World-map nodes are inset enough to keep their complete circle and selection-ring stroke within the widget clipping area, including dense automatic maps in portrait. Rendering, connectors and touch targeting use the same inset positions.

- All Panel controls in Tuning use the same Upgrade grid tile width and height: categories, individual settings, minus/plus, Set and Cancel. Settings use paged 4×2 grids with directional navigation; edit actions occupy four equal bottom-row tiles. Label length never resizes a tile.

- Panel artwork fits its visible alpha bounds, ignoring nearly transparent export padding; bounds are cached per canvas. Taller equal-size tile rows keep header space, and the saved Tuning/Upgrade description panels span 97% width near the bottom edge.

- Garage Dialogue is a reusable Menu Editor widget. Tuning uses the highlighted category's supplied dialogue, including inside its setting pages; Upgrade uses the highlighted section. Mouse hover updates highlight without activating, while touch and controller selection use the same context. The saved Tuning/Upgrade menus place wrapped dialogue inside bottomtextpanel; Garage has a small upper-left dialogue area for return/story events.
- Dialogue uses the supplied Last on the Grid lines verbatim. Insufficient scrap, spending at least 60% of available scrap, highest installed tier in a slot, confirming/installing, and spending the last scrap select the corresponding special lines. Transient events yield to a new highlight or expire after 6.5 seconds. Successful installs speak only after saving succeeds.
- Returning after a completed race speaks once per completion, including repeat runs. Every fifth ordinary garage arrival can use city/quiet/personal dialogue; tuning/upgrade backtracking does not count as another arrival. The engine memory line is occasional when revisiting Engine.
- Race Menu Destination → Garage dialogue after completion selects any supplied special/story line, including won, badRace, repaired, highway, damaged and journey. These rely on authored events rather than inferring wins, repairs, damage or travel from unrelated state. The saved variable is garageDialogueEvent; changing the race completion count/chapter allows a new occurrence. Blank uses automatic return dialogue. Events wait until entering Garage/Tuning/Upgrade, not World Map.

- Garage dialogue respects its authored font size (34 in the saved Tuning/Upgrade menus), wraps in a taller bottom panel, and only reduces size as needed to fit a complete line. The saved screens reserve 30% of their height for the description panel and keep the tile grids above it.
- Tire pressure is standard tuning, never an installable upgrade. The legacy Tire Pressure Kit is not sold, listed in upgrade menus, or granted/equipped by the upgrade cheat. Existing kit records are retained for save compatibility but do not constrain pressure tuning; all four pressures are available without parts.

- Upgrade/Tuning titles, values and prices receive the same brightness/greyscale treatment as their panel artwork. Selected items remain bright; unselected labels dim with the panel.
- Menu Editor → Animation → Typewriter (text) reveals ordinary labels and Garage Dialogue character by character. Speed / Repeat configures characters per second and the extra pause after periods, question marks and exclamation marks. Selecting Typewriter defaults to Play once. Dialogue restarts when its contents change and lays out the complete line before revealing letters so wrapping and size stay stable. Static editing shows complete text; animated canvas and game previews play the effect. Saved garage dialogue uses 40 characters/second with 0.35-second punctuation pauses.

- Garage labels its launch button Drive. Highlighting Drive, Tune or Upgrade selects the supplied short prompt in the speech callout; mouse hover changes highlight without activating, and controller focus uses the same dialogue context. The callout/text move together, with text inset inside the dark center.

- First-person racing attaches the eye and viewing axes to the interpolated vehicle body pose. Body lean, pitch, roll and full inversion rotate the view and sky without upright horizon correction; head look remains relative to the cabin. Third-person camera behavior is unchanged.

- First-person skybox artwork uses the same viewport-based scale and yaw scrolling as third person. Extra coverage for camera roll extends the draw area only; it never enlarges artwork or multiplies parallax speed.

- Race Editor → Settings → Road Textures opens the shared editor form for saved Road artwork, Margin artwork, independent repeat lengths in meters, and built-in lane markings. Image width spans the entire road or individual margin; image height repeats along centerline distance. Centered vertical artwork lines follow bends, width changes, and elevated road decks. Margin visibility/width remain in the existing Margin settings. Default surface removes the ribbon override; save/load and Undo retain these choices.
- Road texture ribbons continue through ordinary two-edge network joins. Multi-way junction aprons retain their base material because they have no single travel direction. Textures affect appearance only, not tire grip or collision width. Preview in Playtest; the editor overview remains its schematic track view. Settings use the existing responsive shared form and preserve portrait action rails and workspace controls.

- Car Editor interior artwork is hydrated and installed into prepared frames before preview use, and assignments, clearing, position and size updates synchronize the live runtime car. First-person dashboards preserve source aspect ratio and transparent windshield space, anchored to the bottom; steering-wheel artwork preserves its source proportions and rotates around its center. Saved RTG-001/CT-86/PZ-24/BUSE-019 use their matching rtginterior/ctinterior/pzinterior/buseinterior graphic and shared steeringwheel art.

- Car Editor → Art → Interior → Steering Wheel → Center opens the shared form for the rotation hub in source-image pixels. The normalized center is saved per car, defaults to the image midpoint, and remains at the wheel Position anchor during steering. Pivot edits update live without rebuilding preview resources. All four saved cars use hub (255,255) for the shared 512×468 wheel, half the prior wheel scale, and dashboard position 7% of the viewport lower.

- Interior artwork sliders explicitly distinguish Width/Height from Position X/Y. Steering Wheel Position places the rotation hub. All four saved cars place the wheel one-third across the viewport with its hub at the bottom edge, leaving approximately the upper half visible inside the clipped first-person view.

- World-map race descriptions support the Menu Editor Typewriter animation with stable full-text wrapping. The saved Game Menu uses the same 40 characters/second, 0.35-second punctuation pauses and play-once settings as Tuning/Upgrades. Changing the description restarts typing; static editing shows the complete text.

- World-map descriptions stay in their original lower-right black panel (y 0.76, height 0.22). Race-description text fits its complete contents by reducing font size only when required, before typewriter reveal; no expanding upward over the map. Car-description truncation behavior is unchanged.

- Menu Editor world maps have a persistent node-editing mode. Tap the map or open its Properties to enter; tap/drag nodes with mouse, touch or the existing gamepad pointer. The shared + / Clip / Send / Properties hotbar remains intact and exposes map tools while editing. Add Race/Junction arms placement on the next map tap; Connect joins two tapped nodes. Selecting a line enables connection styling/deletion. Finish / move widget returns to whole-widget layout, and Properties re-enters node editing. Node drags create one Undo step; node deletion removes incident connections and is undoable. Escape cancels an active drag or placement/connection tool.
- Nodes support distinct unselected/selected/disabled saved artwork, labels, race assignments, manual disabled status, unlock/completion variables, and numeric positioning. Junctions connect paths but are excluded from playable race selection. Locked/disabled races remain inspectable but cannot launch. Map Style / Cursor sets state colors and brightness, icon scale, default line color/width/pattern, and ring/text/image/no cursor. Each connection may override its line style. Cursor artwork and text use the existing menu resources; cursor upload remains available in Layout & Style.
- Existing automatic maps keep their project-race list and sequential connections until edited. Authored maps store explicit node IDs and connections; an empty manual map stays empty. Use project races restores automatic behavior. Connections are visual paths; existing unlock rules still control race availability. Node positions, icon references, styles and links survive menu save/load. Portrait retains its workspace and bottom action rail; tool drawers and focused property forms reuse the existing Menu Editor shell.

World-map authoring readability: while editing nodes, replace gameplay icons, labels and cursors with dark-filled, cyan-outlined handles and dark-outlined cyan connections. Selected nodes/connections are gold; junction handles are diamonds and race handles are circles. Keep the screen artwork visible and omit floating canvas labels. Tap/drag handles to position them; Properties opens the selected node or connection directly, or map styling when nothing is selected. Preview retains the actual gameplay artwork and styling. Existing bottom hotbar and portrait action rail remain unchanged.

World-map widget workflow clarification: a world map is an ordinary menu widget and initially moves/resizes like other widgets. Properties opens its tools; Edit nodes explicitly enables node dragging over the existing screen background. Properties on a selected node/connection edits that item; tap empty map space then Properties to reopen map tools. Done / move widget exits node editing. The +, Clip and Send drawers retain their ordinary widget functions. Map properties offer both Screen background image and optional Widget background image; widget artwork uses the usual image fit and stays visible during node editing and gameplay.

Menu editor/game consistency (supersedes earlier map authoring mode notes): on first editor entry, open the saved menu configured in menu-launch, just as Play does. Never replace an already opened/new document or edits made while loading. Map node/icon rendering remains the runtime renderer; authoring adds thin contrasting outlines, never replaces artwork with opaque handles. Tapping a node directly selects it for dragging and Properties; Properties on an unselected map still offers add/connect/style tools. Empty space on an inactive map can move the widget; Done / move widget exits node editing. Screen and widget background artwork remain visible.

World-map gameplay navigation: arrows, D-pad and stick directions choose an available race in that direction using rendered node positions, preferring nearby aligned nodes. Do not cycle by node array order or wrap across the map. Up/down navigate map nodes while focused on the map; Tab still changes widgets. Junctions, disabled nodes and progression-locked nodes are never selectable in gameplay, including by touch. Initial selection chooses an available race; an all-unavailable map has no selection and cannot launch a race. Disabled nodes remain editable in the Menu Editor.

Disabled gameplay menu controls remain visible but cannot receive selection, hover focus or touch activation. This includes unavailable Upgrade cards and locked Tuning categories/settings: directional navigation skips them and initial section selection picks an enabled setting. Tapping a disabled ordinary button consumes the tap instead of activating a screen action or a control underneath. Editor selection of disabled controls remains available for authoring.

Upgrade availability distinguishes installation from purchase: an already-owned available spare is selectable for installation even without its purchase unlock or enough scrap to buy another copy. Installed parts remain selectable. Purchase restrictions still apply when another copy must be bought.

Race Road Textures supports independent repeat length and repeat width in meters for road and margin artwork. Width 0 preserves one image fitted across the strip; a positive width repeats at that physical spacing across the road while keeping the texture centered through bends and width changes.

Custom road artwork automatically suppresses generated lane markings in all runtime render paths, including races saved with built-in markings enabled. Margin artwork alone preserves lane markings. Removing road artwork restores the saved built-in-markings preference. The lane-marking checkbox is shown only for untextured roads.

Road Textures also provides separate road/margin filtering (inherit, crisp, balanced, smooth), distance mipmaps, and angled-distance detail (anisotropy 1–16, capped by hardware, active with smooth filtering and mipmaps). These settings save with the race and apply to both renderers. Disabling mipmaps preserves hard pixels but can shimmer at distance.

Road/margin mipmap distance multipliers range from 0.25 to 16 (default 1). Higher values delay mip-level reduction using negative LOD bias; lower values soften earlier. Repeat width/length are unchanged. Both renderers apply the bias, and it is ignored with mipmaps disabled.
