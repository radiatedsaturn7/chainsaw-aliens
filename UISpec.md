# RTG Studio Editor UI Spec

This is the canonical UI plan for RTG Studio editors. The lower-level shell and token contract lives in `ui/EDITORS_UI_CONTRACT.md`; this file defines the product behavior, menu structure, and input rules that all editor implementations should converge on.

## Priorities

- Preserve portrait mode as the source of truth. It is already close to the desired mobile experience, so changes should be small, targeted, and covered by tests.
- Standardize menus across Pixel, Tile, Level, Actor, MIDI, SFX, Cutscene, Race, and Car editors without forcing every editor into identical workflows.
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
- The bottom rail is the persistent tool/options surface for zoom, ribbons, palette/context controls, transport, or quick actions when those controls should stay visible while the right submenu opens and closes. Pixel landscape should keep zoom in this bottom rail beside palette/layer/frame controls instead of reintroducing a separate top zoom strip.
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
- Settings commands are also desktop `top-dropdown` drawer content. The left panel may summarize the active settings/context state, but it is not the settings command surface.
- Every editor File drawer starts with the same desktop baseline order from `DESKTOP_FILE_BASELINE_ACTION_IDS`: New, Save, Save As, Open, Export, Import. Unsupported baseline actions should remain visible as disabled rows rather than disappearing and changing the menu shape. File drawers must not contain history, clipboard, or other Edit-role actions; those commands live in Edit. `DESKTOP_FILE_FOOTER_ACTION_ID` keeps Exit to Main Menu as the final File command/footer in every editor.
- Every editor Edit drawer starts with Undo and Redo. After the history rows, Edit drawer role groups follow clipboard, selection, duplicate, target-specific edits, then destructive actions so copy/cut/paste, selection, duplicate/state/segment/layer edits, and delete/remove commands appear in a predictable order across editors.
- The left side starts below the top menu. Its ribbon appears at the top of the left column, with a persistent context/inspector panel directly below/south of the ribbon.
- Do not duplicate top drawer commands in the desktop left column. The left column should show current document, active section, mode, selected tool, selected asset, selection, transport, or inspector state that is useful to keep visible while the drawer opens and closes.
- Desktop left context panels should use contextual language such as `Active`, not `Menu`, so they do not read as another command menu.
- Use mouse-first behavior: wheel zoom/scroll, middle or right drag pan where applicable, and right-click context menus for selected objects or work surfaces.
- When there is room, top drawers may show complete submenus instead of forcing mobile-style drill-down.

### Gamepad

- Gamepad uses the landscape spatial model.
- Root menu appears on the left while choosing a section.
- After selecting a section, the root rail collapses or slides away and the submenu slides out.
- Gamepad slide-out surfaces, controls, row activation, and suppressed touch surfaces come from `GAMEPAD_SLIDE_OUT_MENU_CONTRACT` so every editor replaces the touch landscape menu stack the same way.
- `A` selects, `B` backs out of submenu/root, `Start` opens the system menu, and `Back` toggles focus.
- `LB/RB` switch sibling root sections. D-pad and left stick navigate focus. Right stick pans the work surface. `LT/RT` zoom where applicable.
- Focus rings must be visible on every actionable item.

## Editor Menus

### Pixel Editor

- Root: File, Edit, View, Draw, Select, Tools, Canvas, Layers, Frames, Rigging.
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

- Root: File, Edit, View, Grid, Song, Tracks/Mixer, Record, Pedals, Settings.
- Edit: undo, redo, copy, cut, paste, select all, delete.
- Grid: direct note placement/erase on the grid, quantize, note length.
- Song: play, stop, loop, tempo.
- Tracks/Mixer: dynamic track rows from the runtime mixer.
- Record: enter record mode and single-note record.
- Pedals: pedal chain controls.

### SFX Editor

- Root: File, Edit, View, Timeline, Layers, Envelopes, Generate, Tools, Settings.
- Edit: undo, redo, copy, cut, paste, delete.
- Timeline: play, stop, start, end.
- Layers: add, duplicate, delete.
- Envelopes: volume, pitch, pan, add point, delete point.
- Generate: waveform and generator controls.
- Tools: split, trim, normalize, fade, reverse, bitcrusher, time stretch, loop wizard.

### Cutscene Editor

- Root: File, Edit, View, Add, Timeline, Clips, Keyframes, Stage, Audio, Settings.
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
- Portrait bottom menu: File, Track, Ground, Sprites, Settings.
- Edit: undo, redo, copy segment, paste segment, delete segment.
- File: standard document actions plus generate random race and load built-in reference tracks.
- Track: draw road, add/move/remove nodes, remove edges, assign edge tile, asphalt, dirt, gravel, snow, wet asphalt, segment width, bumpiness, and snow condition. Circuit versus point-to-point behavior is inferred from whether the route endpoints connect; there must not be explicit Circuit/Destination menu toggles.
- Ground: selected ground tile, paint ground, paint elevation, raise/lower, and brush size.
- Sprites: add, move, delete, size, and behavior for vertical scenery sprites.
- Settings: road width, AI racer count, weather clear/rain/storm/snow, and finish behavior.
- Top Play/Pause: Playtest opens a car picker, then launches the race in the handheld race playtest surface. Runtime diagnostics and AI checks stay in code/tests rather than visible editor menu buttons.
- Desktop left panel should show selected race, inferred route shape, segment count, weather, and active tool while top drawers own commands.

### Car Editor

- Root: File, Edit, View, Art, Drivetrain, Tuning, Aero, Suspension, Drive.
- Edit: undo, redo.
- Art: shell frame assignment, previous/next shell frame, reverse frame, tire treads, add-ons.
- Drivetrain: nested drivetrain menu, engine sound, power curve, weight/balance.
- Tuning: default tires, tire pressure, tire size, brake balance, final drive, differential accel/decel.
- Aero: front and rear aero tuning through slider-style controls.
- Suspension: front/rear springs, damping, and anti-roll through slider-style controls.
- Drive: Playtest opens a car picker and starts the same handheld race playtest surface.
- Desktop left panel should show selected car, drivetrain, power, weight, and active tool while top drawers own commands.

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
