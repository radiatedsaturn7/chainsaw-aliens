# Feature Specification: Editor UI Standard

**Feature Branch**: `001-editor-ui-standard`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Build a consistent game and editor UI standard for
a large metroidvania and racing engine with future editors. Preserve the mostly
working mobile portrait experience while optimizing desktop, portrait,
landscape touch, and gamepad views. Desktop needs top File/Edit-style menus,
a left side panel, and optional bottom rail. Portrait uses a bottom-left virtual
thumbstick followed by Menu, Undo, Redo, and a contextual button. Landscape
should resemble portrait with the command rail on the left and drill-down
content on the right. Gamepad should feel game-like, with left-side slide-out
menus and no virtual thumbstick. One editor should be made to feel right first,
then used as the standard for other editors."

## Clarifications

### Session 2026-07-15

- Q: Which editor should become the reference editor standard? -> A: MIDI Editor primary, Pixel Editor secondary.
- Q: Which additional editors should be required comparison references? -> A: Level, Cutscene, and Actor.
- Q: What rollout rule should guide implementation? -> A: Finish MIDI first, then validate against comparison editors.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish a Reference Editor Standard (Priority: P1)

As a creator using the game editor, I want the MIDI Editor to feel complete and
coherent across portrait, landscape touch, desktop, and gamepad, with the Pixel
Editor serving as a secondary quality comparison, so that I can trust the result
as the model for all future editor work.

**Why this priority**: A single reference editor creates a concrete target for
the broader editor family and prevents every editor from inventing its own
layout, menu behavior, and input rules.

**Independent Test**: Select the reference editor and verify that the same core
workflows are recognizable and usable in portrait, landscape touch, desktop,
and gamepad without breaking the existing portrait flow.

**Acceptance Scenarios**:

1. **Given** the reference editor is opened in portrait, **When** the user
   accesses core commands, **Then** the bottom-first workflow remains familiar
   and the command sequence includes virtual thumbstick, Menu, Undo, Redo, and
   a contextual action where continuous movement is needed.
2. **Given** the reference editor is opened on desktop, **When** the user opens
   root menus such as File or Edit, **Then** commands appear from a top menu
   surface and the left side presents persistent context rather than duplicate
   menu commands.
3. **Given** the reference editor is opened in landscape touch, **When** the
   user opens the menu and drills into a section, **Then** root access remains
   on the left while active submenu content appears on the right and the work
   surface remains central.
4. **Given** the reference editor is used with a gamepad, **When** the user
   selects a menu item, **Then** the current left-side menu slides away and the
   next menu slides in with visible focus and no virtual thumbstick.

---

### User Story 2 - Apply Consistent Behavior Across Editors (Priority: P2)

As a creator moving between editors, I want the same menu, undo/redo, context,
drawer, rail, thumbstick, and gamepad patterns to behave consistently so that I
do not have to relearn basic controls for every editor.

**Why this priority**: The project contains multiple current editors and expects
more in the future. Consistency lowers cognitive load and makes the editor
suite feel like one product.

**Independent Test**: Compare Pixel, Level, Cutscene, and Actor Editors against
the MIDI reference editor and verify that common controls, menu placement,
scrolling, focus, and context surfaces behave the same where their workflows
overlap while preserving each editor's unique workflow.

**Acceptance Scenarios**:

1. **Given** two editors share a command such as File, Edit, Undo, Redo, or a
   contextual action, **When** the user switches between those editors in the
   same mode, **Then** the command location and activation behavior are
   consistent.
2. **Given** an editor has mode-specific content such as tracks, frames,
   palettes, tiles, or assets, **When** that content appears in portrait,
   landscape touch, desktop, or gamepad, **Then** it follows the shared surface
   pattern for that mode while preserving the editor's workflow needs.
3. **Given** a future editor is added, **When** its core menu structure is
   defined, **Then** it can adopt the same mode behavior without requiring a new
   UI model.
4. **Given** a desktop editor has a left side panel, **When** that editor is
   opened, **Then** the left side presents the editor's active tool, swatches,
   addable cutscene items, paint target, selected asset, or global editing
   context instead of duplicating top menu commands.
5. **Given** the MIDI Editor has not yet passed the shared mode standard,
   **When** work is prioritized, **Then** MIDI receives the first complete pass
   before broad fixes are applied to comparison editors.

---

### User Story 3 - Preserve Portrait While Repairing Inconsistencies (Priority: P3)

As a creator who currently focuses on mobile portrait, I want portrait changes
to be limited to repairs and consistency fixes so that the working mobile
experience remains stable while other modes improve.

**Why this priority**: Portrait is already the strongest mode and is the user's
current mental model. Broad redesigns there would slow progress and risk
regressing the best-working experience.

**Independent Test**: Run portrait-focused checks before and after the feature
work and verify that existing portrait workflows still complete, with only
documented consistency repairs changed.

**Acceptance Scenarios**:

1. **Given** an existing portrait workflow works before this feature, **When**
   the feature is completed, **Then** the workflow still works unless a specific
   portrait repair was documented.
2. **Given** portrait controls have inconsistent spacing, styling, scroll, or
   activation behavior, **When** they are repaired, **Then** the repair matches
   the shared style and does not move primary controls unnecessarily.

### Edge Cases

- A mode has less screen space than expected: root menus and command surfaces
  must remain reachable without overlapping the work surface or hiding critical
  context.
- A menu or tool list exceeds available space: the surface must scroll by the
  correct pointer, touch, or controller behavior without accidental activation.
- A command is unsupported in one editor: the editor must preserve predictable
  menu shape where the shared standard requires it and clearly indicate that the
  command is unavailable.
- A gamepad is connected while touch controls are visible: gamepad-owned menus
  must suppress touch-only menu thumbsticks where they would conflict.
- A future editor has a new workflow: the workflow may add editor-specific
  context, but shared mode behavior and common commands must remain consistent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor suite MUST use the MIDI Editor as the primary
  reference editor experience that demonstrates the target behavior for
  portrait, landscape touch, desktop, and gamepad.
- **FR-001a**: The Pixel Editor MUST serve as the secondary comparison editor
  for validating that the standard also fits an editor that is already in a
  strong state.
- **FR-002**: The reference editor MUST preserve existing portrait workflows
  except for documented repairs to inconsistent behavior, spacing, styling,
  scroll, focus, or activation.
- **FR-003**: Desktop editor views MUST provide a top menu surface for root
  menus such as File and Edit, with the left side used for persistent context
  instead of duplicate root menu commands.
- **FR-004**: Desktop editor views MAY include a bottom rail when persistent
  workflow controls benefit from remaining visible while menus open and close.
- **FR-005**: Portrait editor views MUST keep the bottom-first control model and
  expose Menu, Undo, Redo, and one contextual action in a consistent command
  sequence; a virtual thumbstick appears only where continuous movement or pan
  control is needed.
- **FR-006**: Landscape touch editor views MUST use a left-side command access
  pattern for Menu, Undo, Redo, and a contextual action, with drill-down or
  active submenu content appearing on the right.
- **FR-007**: Gamepad editor views MUST follow the landscape spatial model while
  replacing touch-specific controls with a gamepad menu flow where left-side
  menus slide between root and submenu states.
- **FR-008**: Gamepad editor views MUST NOT show a virtual thumbstick for menu
  navigation, and focus state MUST be visible on actionable menu items.
- **FR-009**: Shared commands such as File, Edit, Undo, Redo, menu open, menu
  back, and context action MUST have consistent placement and activation
  behavior across editors in the same mode.
- **FR-010**: Drawers, sheets, rails, and tool grids MUST support the expected
  scroll behavior for the active mode and MUST prevent drag gestures from
  accidentally activating a command.
- **FR-011**: The standard MUST support current metroidvania and racing editor
  needs while allowing future editors to adopt the same mode rules without
  redesigning the common UI model.
- **FR-012**: Any editor-specific exception to the shared behavior MUST be
  documented as a workflow need and must not weaken the common behavior for
  shared commands.
- **FR-013**: The feature MUST include validation coverage for the MIDI Editor
  in portrait, landscape touch, desktop, and gamepad, plus comparison checks for
  Pixel, Level, Cutscene, and Actor Editors.
- **FR-014**: Desktop left panels MUST preserve each editor's unique working
  context, such as active tool, swatches, cutscene insert type, tile or race
  paint target, selected asset, actor properties, or global music settings.
- **FR-015**: Portrait repairs MUST account for current editor condition:
  Actor and Race are mostly stable, Car and Level likely need more repair, and
  all portrait changes remain limited to consistency fixes unless explicitly
  scoped otherwise.
- **FR-016**: Implementation MUST complete the MIDI Editor standard first, then
  validate the standard against Pixel, Level, Cutscene, and Actor before
  applying broad rollout fixes to other editors.

### Editor UI Contract Alignment *(include for RTG Studio editor UI work)*

- **Canonical spec impact**: This feature directly advances `UISpec.md` by
  making the editor UI standard concrete through one reference editor, then
  applying the standard to the broader editor suite.
- **Shell/layout contract impact**: This feature must preserve the shell,
  spacing, typography, surface, scroll, and input behavior described in
  `ui/EDITORS_UI_CONTRACT.md`.
- **Mode impact**: Portrait remains the baseline and should receive only
  consistency repairs. Landscape touch adopts the left command rail and right
  drill-down pattern. Desktop uses top root menus with a persistent left context
  panel and optional bottom rail. Gamepad uses left-side slide-out menus with
  visible focus and no virtual thumbstick.
- **Shared helper impact**: Feature planning must prefer shared menu specs,
  shared input semantics, shared UI helpers, and the shared editor menu layout
  helpers before approving editor-specific behavior.

### Key Entities *(include if feature involves data)*

- **Reference Editor Standard**: The approved MIDI Editor behavior baseline
  across portrait, landscape touch, desktop, and gamepad, with Pixel Editor as
  the secondary comparison.
- **Editor Mode Experience**: The user-visible layout, menu placement, input
  semantics, focus behavior, and scroll behavior for a specific editor mode.
- **Common Command Surface**: A shared command location or menu surface that
  holds commands such as File, Edit, Menu, Undo, Redo, and contextual actions.
- **Editor-Specific Workflow Exception**: A documented case where an editor
  needs mode-specific presentation while preserving shared command behavior.
- **Desktop Left Panel Context**: The editor-specific working context shown on
  the desktop left side, such as a current tool, swatch set, insert palette,
  paint target, selected asset, properties, or global setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the MIDI Editor, a user can complete the same primary editing
  workflow in portrait, landscape touch, desktop, and gamepad with no
  mode-specific blocker.
- **SC-002**: At least 90% of shared commands checked across the MIDI, Pixel,
  Level, Cutscene, and Actor Editors appear in the expected mode-specific
  surface and use the expected activation behavior.
- **SC-003**: Existing portrait validation for affected editors remains passing,
  except for explicitly documented consistency repairs.
- **SC-004**: In landscape touch and gamepad validation, menu drill-down or
  slide-out navigation can move from root menu to submenu and back without
  hiding the work surface or leaving the user without a visible navigation path.
- **SC-005**: In desktop validation, File and Edit root menus are reachable from
  the top menu surface and the left side displays persistent editor context
  rather than duplicated top menu command rows.
- **SC-006**: At least one future-editor checklist or template path exists so a
  new editor can declare its root menus, mode behavior, and exceptions before
  implementation begins.
- **SC-007**: MIDI Editor validation passes in all four target modes before
  comparison-editor fixes are treated as the primary implementation focus.

## Assumptions

- The MIDI Editor is the primary reference editor because it is one of the
  strongest current editors and has especially complex workflows. The Pixel
  Editor is the secondary comparison because it is also in a strong state.
- Level, Cutscene, and Actor Editors are additional comparison references
  because they are in good shape, exercise distinct editor workflows, and need
  smaller improvements rather than a full reset.
- The rollout sequence is MIDI first, then comparison validation across Pixel,
  Level, Cutscene, and Actor, then broader editor rollout.
- The feature covers editor UI behavior and editor shell consistency, not the
  full gameplay HUD or every future editor's final feature set.
- Portrait is treated as the current baseline and should be changed only where
  needed to repair inconsistency or align common controls.
- Future editors are expected to follow the same mode model unless their
  workflow exception is explicitly documented and validated.
