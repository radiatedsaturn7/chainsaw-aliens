# Research: Editor UI Standard

## Decision: Use MIDI as the primary reference editor

**Rationale**: MIDI is one of the strongest current editors and has complex
grid, transport, instrument, record, settings, and controller workflows. Making
MIDI pass in portrait, landscape touch, desktop, and gamepad gives the shared
standard a demanding proving ground.

**Alternatives considered**: Pixel is also strong, but it is better as a
secondary comparison because its art workflows are different from MIDI. Level,
Cutscene, and Actor are useful comparison references, but they are less complex
than MIDI and need smaller repairs.

## Decision: Preserve portrait as the baseline

**Rationale**: The spec and constitution identify portrait as mostly working and
highest-risk to disrupt. Portrait work should focus on consistency repairs:
spacing, style, scroll, focus, activation, and shared rail behavior.

**Alternatives considered**: Redesigning portrait alongside every other mode
would increase rework risk and violate the project constitution unless a task
explicitly scopes a portrait change.

## Decision: Desktop uses top menus plus editor-specific left context

**Rationale**: Desktop should behave like a regular app. Top menus own command
drawers such as File/Edit. The left side should show useful editor context:
current tool, swatches, addable cutscene items, tile/race paint targets,
selected assets, actor properties, or MIDI tempo/global settings.

**Alternatives considered**: Duplicating top menu commands in the left panel
would make the app harder to scan and conflict with `ui/EDITORS_UI_CONTRACT.md`.

## Decision: Landscape touch keeps commands left and drill-down right

**Rationale**: Landscape should feel related to portrait but use the available
horizontal space. A fixed left command rail keeps Menu, Undo, Redo, and context
stable; active submenu content on the right keeps the work surface central.

**Alternatives considered**: Putting all landscape menus on one side would
reduce the distinction between root access and active submenu context. Floating
controls over the work surface would conflict with the shared contract.

## Decision: Gamepad uses left slide-out menus and suppresses touch thumbsticks

**Rationale**: Gamepad mode needs a game-like interaction model with visible
focus and confirm/back navigation. Root and submenu surfaces should slide on
the left; virtual thumbsticks are touch controls and should not compete with the
controller menu.

**Alternatives considered**: Reusing landscape touch right drawers would make
gamepad feel like touch UI with controller input, not a controller-first mode.

## Decision: Extend existing shared contracts and tests

**Rationale**: The repo already has shared editor menu specs, layout contracts,
controller menu stack tests, portrait model tests, and Playwright layout
contract tests. Extending these paths is lower risk than creating a parallel
layout system.

**Alternatives considered**: Creating new per-editor layout branches would move
faster in one editor but would work against the feature goal and constitution.

## Decision: Validate comparison editors before broad rollout

**Rationale**: Pixel, Level, Cutscene, and Actor exercise distinct workflows
without requiring all editors to be fixed at once. They provide enough coverage
to prove the standard supports editor uniqueness.

**Alternatives considered**: Standardizing all editors in one pass would make
the scope too large. Auditing every editor before MIDI is right would delay the
reference baseline.
