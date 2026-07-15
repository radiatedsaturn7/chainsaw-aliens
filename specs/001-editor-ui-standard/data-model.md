# Data Model: Editor UI Standard

This feature primarily defines UI behavior contracts, not persisted gameplay
data. The entities below are planning entities used to structure implementation,
validation, and future editor onboarding.

## ReferenceEditorStandard

**Purpose**: Captures the approved behavior baseline for the MIDI Editor across
all target modes.

**Fields**
- `primaryEditor`: `midi`
- `secondaryEditor`: `pixel`
- `requiredComparisonEditors`: `level`, `cutscene`, `actor`
- `modes`: `portrait`, `landscape-touch`, `desktop`, `gamepad`
- `status`: `draft`, `midi-validating`, `comparison-validating`, `ready-for-rollout`

**Validation Rules**
- MIDI must pass all target modes before status can become
  `comparison-validating`.
- Comparison validation must include Pixel, Level, Cutscene, and Actor before
  status can become `ready-for-rollout`.

## EditorModeExperience

**Purpose**: Describes the expected user-visible behavior for one editor in one
mode.

**Fields**
- `editorId`: stable editor id such as `midi`, `pixel`, `level`, `cutscene`,
  or `actor`
- `mode`: one of `portrait`, `landscape-touch`, `desktop`, `gamepad`
- `rootCommandSurface`: where root command access appears
- `submenuSurface`: where drill-down or submenu content appears
- `persistentContextSurface`: where stable editor context appears
- `thumbstickPolicy`: `shown-when-needed`, `suppressed`, or `not-applicable`
- `scrollPolicy`: pointer/touch/controller scroll expectation
- `focusPolicy`: focus visibility and activation expectation

**Validation Rules**
- Desktop mode must use top menu command access and left context.
- Portrait mode must remain bottom-first.
- Landscape touch must keep fixed left command access and right drill-down.
- Gamepad must use left slide-out menus and suppress touch-only thumbsticks.

## CommonCommandSurface

**Purpose**: Defines shared command placement and activation expectations across
editors.

**Fields**
- `commandIds`: File, Edit, Menu, Undo, Redo, context action, and editor-specific
  commands
- `surfaceByMode`: expected command surface per mode
- `activationByMode`: tap, click release, confirm button, or back behavior
- `disabledBehavior`: visible disabled row, hidden command, or unavailable state

**Validation Rules**
- File and Edit command roots must be consistent on desktop.
- Undo and Redo must keep consistent placement in shared rails or menus.
- Unsupported desktop baseline actions remain predictable and clearly
  unavailable where the shared contract requires stable menu shape.

## DesktopLeftPanelContext

**Purpose**: Represents editor-specific working context shown on desktop left
panels.

**Fields**
- `editorId`
- `contextRole`: active tool, swatches, insert palette, paint target, selected
  asset, actor properties, transport, global music settings, or status
- `duplicatesTopMenuCommands`: boolean
- `persistentWhileMenusOpen`: boolean

**Validation Rules**
- `duplicatesTopMenuCommands` must be false for top-menu commands.
- The panel must present context that helps the current editor workflow.

## EditorSpecificWorkflowException

**Purpose**: Records a justified deviation from the shared behavior.

**Fields**
- `editorId`
- `mode`
- `exception`
- `workflowNeed`
- `validationRequirement`

**Validation Rules**
- Exceptions must preserve shared command behavior.
- Exceptions must be documented before implementation tasks are generated.
