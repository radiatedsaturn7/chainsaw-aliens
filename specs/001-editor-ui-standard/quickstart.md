# Quickstart: Editor UI Standard Validation

## Prerequisites

- Run from the repository root.
- Install project dependencies if needed: `npm install`.
- For Playwright validation, install browser dependencies if needed:
  `npm run prepare:playwright`.

## Focused Unit Validation

Run shared contract and input tests:

```bash
node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js tests/unit/controllerMenuStack.test.js tests/unit/editorInputActions.test.js
```

Run portrait and MIDI-focused checks:

```bash
node --test tests/unit/portraitEditorMenuModels.test.js tests/unit/midiPatternGridLayout.test.js
```

Run the full focused feature validation:

```bash
node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js tests/unit/controllerMenuStack.test.js tests/unit/editorInputActions.test.js tests/unit/portraitEditorMenuModels.test.js tests/unit/midiPatternGridLayout.test.js
```

Expected outcome: all tests pass, with failures pointing to a shared contract,
portrait model, controller stack, or MIDI layout issue that must be resolved
before broad rollout.

## Browser Contract Validation

Run the editor layout contract:

```bash
npx playwright test tests/playwright/editor-layout-contract.spec.js
```

Run editor flow smoke checks:

```bash
npx playwright test tests/playwright/editor-flows.spec.js
```

Expected outcome: desktop, portrait, landscape touch, and gamepad shell
expectations remain aligned with shared contracts.

Note: Playwright browser execution is not supported in the Termux/Android
environment. Run this command from a supported desktop/Linux CI environment.

## Manual Reference Validation

Open the app:

```bash
./run.sh
```

Then visit `http://localhost:8000/index.html`.

Validate MIDI Editor first:

1. Portrait: confirm bottom-first workflow, Menu, Undo, Redo, contextual action,
   and any needed virtual thumbstick remain usable.
2. Desktop: confirm root menus are in the top menu, File/Edit are reachable, and
   the left panel shows useful MIDI context rather than duplicate menu commands.
3. Landscape touch: confirm command access is on the left and drill-down or
   active submenu content appears on the right without hiding the grid.
4. Gamepad: confirm menus slide on the left, focus is visible, back navigation
   works, and no virtual thumbstick appears for menu navigation.

## Comparison Validation

After MIDI passes, validate Pixel, Level, Cutscene, and Actor:

1. Shared commands match MIDI's expected mode surfaces.
2. Desktop left panels preserve editor-specific context: swatches, active tool,
   selected asset, cutscene insert type, actor properties, or similar context.
3. Portrait changes are limited to repairs and do not move primary controls
   without explicit scope.
4. Landscape touch and gamepad menus remain reachable and do not obscure the
   primary work surface.

## Repository Hygiene Check

Before staging changes:

```bash
git status --short
```

Expected outcome: do not blanket-stage unrelated `data/server-storage/` churn.
If `src/ui/latestChanges.js` changes, confirm the new entry has both `date` and
`time`.
