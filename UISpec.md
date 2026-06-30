# RTG Studio Editor UI Spec

This is the canonical UI plan for RTG Studio editors. The lower-level shell and token contract lives in `ui/EDITORS_UI_CONTRACT.md`; this file defines the product behavior, menu structure, and input rules that all editor implementations should converge on.

## Priorities

- Preserve portrait mode as the source of truth. It is already close to the desired mobile experience, so changes should be small, targeted, and covered by tests.
- Standardize menus across Pixel, Level, Actor, MIDI, SFX, and Cutscene editors without forcing every editor into identical workflows.
- Treat landscape touch, desktop, and gamepad as first-class modes rather than accidental variants of portrait.
- Make all menu rails, drawers, sheets, and tool grids scrollable by tap-drag or pointer drag.
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
- `buildDesktopTopMenuPlan()` and `buildDesktopDropdownPlan()` define the app-style desktop top menu and dropdown structure.
- `buildGamepadSlideOutMenuPlan()` defines root-open versus submenu-open gamepad menu state.
- `getEditorPointerInteractionPolicy()` defines menu scrolling, work-surface gestures, thumbstick visibility, and right-click behavior per mode.

## Mode Layouts

### Portrait

- Keep the current bottom-first mobile workflow.
- Main/root menus stay near the bottom.
- Settings and contextual controls may appear above the top work area only when they need persistent visibility.
- Menu sheets and action grids must scroll by tap-drag. A drag threshold should suppress accidental button activation.
- Level Editor may be tuned to keep primary menus lower and settings less intrusive, but avoid broad portrait redesign.

### Landscape Touch

- Root menu appears as a vertical rail on the left.
- Active submenu appears in a drawer/rail on the right.
- The center remains the canvas, stage, waveform, timeline, or grid work surface.
- Every rail and drawer must scroll by gesture drag.
- Virtual thumbsticks appear only when continuous pan or play movement is needed. They must not cover active menus.

### Desktop

- Desktop should behave like a regular app.
- Use a top menu bar with dropdown drawers for root menus.
- Left side should show active tool options, asset lists, tracks, layers, inspectors, or other persistent lists.
- Use mouse-first behavior: wheel zoom/scroll, middle or right drag pan where applicable, and right-click context menus for selected objects or work surfaces.
- When there is room, show complete submenus instead of forcing mobile-style drill-down.

### Gamepad

- Gamepad uses the landscape spatial model.
- Root menu appears on the left while choosing a section.
- After selecting a section, the root rail collapses or slides away and the submenu slides out.
- `A` selects, `B` backs out of submenu/root, `Start` opens the system menu, and `Back` toggles focus.
- `LB/RB` switch sibling root sections. D-pad and left stick navigate focus. Right stick pans the work surface. `LT/RT` zoom where applicable.
- Focus rings must be visible on every actionable item.

## Editor Menus

### Pixel Editor

- Root: File, Draw, Select, Tools, Canvas, Layers, Frames, Rigging.
- Draw: pencil, brush, eraser, fill, line, shape, clone, and brush settings.
- Select: rectangular select, ellipse select, lasso, magic tools, move, copy, cut, paste, clear.
- Canvas: grid, wrap, symmetry, tile preview, resize, scale, crop, offset, import, export.
- Layers: layer list, add, duplicate, delete, rename, visibility, order, merge up, merge down, flatten.
- Frames: frame list, add, duplicate, delete, delay, loop, reorder, playback.
- Rigging: bones, bind layer, bind selection, timeline, bake.

### Level Editor

- Root: File, Tools, Tiles, Tile Art, Actors/NPCs, Triggers, Powerups, Structures, Graphics/Decals, Music, Settings, Playtest.
- Tools: tile, actor, structure, shape, erase.
- Assets: scrollable lists for tiles, actors, triggers, powerups, structures, decals, and tile art.
- Settings: level metadata, MIDI, world settings.
- Desktop left panel should expose the current asset/tool list without hiding the level canvas.

### Actor Editor

- Root: File, Settings, States, Linked Parts, Visuals, Collision, Behavior, Preview.
- States: add, duplicate, delete, select state.
- Visuals: animation, art references, frame timing.
- Collision: hitbox and hurtbox zones.
- Behavior: conditions, actions, movement, loot, audio.
- Preview: play scene and test controls.

### MIDI Editor

- Root: File, Grid, Song, Tracks/Mixer, Record, Pedals, Settings.
- Grid: note tools, selection, copy, paste, quantize, note length.
- Song: play, stop, loop, tempo, arrangement.
- Tracks/Mixer: track list, instruments, volume, pan, mute, solo.
- Record: virtual instruments, single-note record, input settings.
- Pedals: pedal board and mixer shortcuts.

### SFX Editor

- Root: File, Timeline, Layers, Envelopes, Generate, Tools, Settings.
- Timeline: play, stop, scrub, start, end.
- Layers: layer list, add, duplicate, delete, reorder.
- Envelopes: volume, pitch, pan, add point, delete point.
- Generate: waveform and generator controls.
- Tools: copy, cut, paste, split, undo, redo.

### Cutscene Editor

- Root: File, Add, Timeline, Clips, Keyframes, Stage, Audio, Export, Settings.
- Add: art, actor, text, color board, music, SFX, effect, pause.
- Clips: selected clip options, asset binding, track placement.
- Keyframes: position, scale, opacity, easing, start/end/playhead mode.
- Stage: scene length, fade, snap/grid, master volume.
- Export: MP4/export actions and progress.

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
5. Bridge Actor Editor's DOM UI into the shared spec.
6. Bring Cutscene Editor onto the shared controller/menu stack.
7. Add desktop top menu/dropdown behavior and right-click context menus.
8. Add gamepad slide-out behavior and consistent focus rings.
9. Polish the shared RTG Studio visual style across menus, drawers, and launcher.

## Validation

- Unit tests must cover each editor's root ids, section ids, and required action ids.
- Existing portrait tests should remain stable unless a portrait change is explicitly part of a task.
- Add layout tests for portrait, landscape touch, desktop, and gamepad placement.
- Add gesture tests for tap-drag scrolling versus button activation.
- Add controller tests for `A` select, `B` back, `LB/RB` section changes, and submenu collapse.
