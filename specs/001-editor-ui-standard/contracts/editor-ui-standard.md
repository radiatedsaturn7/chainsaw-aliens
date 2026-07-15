# Contract: Editor UI Standard

This contract defines the user-visible behavior that implementation and tests
must enforce. It complements `UISpec.md` and `ui/EDITORS_UI_CONTRACT.md`.

## Reference Scope

- Primary reference editor: MIDI Editor
- Secondary comparison editor: Pixel Editor
- Required comparison editors: Level Editor, Cutscene Editor, Actor Editor
- Broader rollout editors: Race, Car, SFX, Tile, and future editors after the
  reference standard is validated

## Mode Contract

| Mode | Root command surface | Submenu/drill-down surface | Persistent context | Thumbstick policy |
|------|----------------------|----------------------------|--------------------|-------------------|
| Portrait | Bottom-first rail/sheet | Bottom sheet or hot menu | Top/status only when useful | Shown only when continuous movement or pan is needed |
| Landscape touch | Fixed left command rail | Right drawer/rail | Work surface plus optional bottom rail | Shown only when continuous movement or pan is needed |
| Desktop | Top menu bar/dropdown | Top dropdown | Left context panel plus work surface | Suppressed |
| Gamepad | Left slide-out root | Left slide-out submenu | Work surface overlay or mode context | Suppressed |

## Shared Command Contract

- Menu, Undo, Redo, and one contextual action must have consistent placement in
  portrait and landscape touch.
- File and Edit root menus must be reachable from the desktop top menu.
- Desktop left panels must not duplicate top-menu command rows.
- Gamepad menu items must have visible focus and confirm/back navigation.
- Drawers, sheets, rails, and grids must scroll by the expected input method
  without activating the original item after a drag.

## MIDI Reference Acceptance

MIDI passes the reference standard when:

- Portrait keeps the existing bottom-first workflow and stable primary actions.
- Desktop exposes File/Edit/root menus from the top menu and presents useful
  MIDI context on the left.
- Landscape touch uses left command access and right-side active submenu or
  context without hiding the grid/work surface.
- Gamepad uses left slide-out menu transitions with visible focus and no
  virtual thumbstick.
- Transport, grid, instruments, settings, and record flows remain reachable.

## Comparison Acceptance

Pixel, Level, Cutscene, and Actor pass comparison validation when:

- Shared commands appear in the same expected mode surfaces as MIDI.
- Each editor keeps its own workflow context on desktop left panels.
- Portrait changes are limited to consistency repairs.
- Landscape and gamepad navigation remain reachable and do not overlap critical
  work surfaces.

Current justified workflow differences:

- Pixel desktop left context emphasizes active tool, swatches, layers, and
  frames.
- Level desktop left context emphasizes active tool, tile palette, actor
  palette, and selected placement.
- Cutscene desktop left context emphasizes insert palette, selected clip,
  timeline, and scene settings.
- Actor desktop left context emphasizes actor properties, state list,
  linked parts, and preview settings.

These are context differences only. File/Edit command placement, desktop top
menus, landscape drill-down surfaces, and gamepad slide-out behavior must still
match the shared mode contract.

## Future Editor Onboarding Contract

A future editor must define:

- Stable editor id and root menus
- Per-mode command surfaces
- Desktop left panel context role
- Portrait contextual action
- Landscape contextual action
- Gamepad focus and back behavior
- Any documented workflow exception with validation requirements
