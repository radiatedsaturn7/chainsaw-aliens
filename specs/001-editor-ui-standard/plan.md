# Implementation Plan: Editor UI Standard

**Branch**: `001-editor-ui-standard` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-editor-ui-standard/spec.md`

## Summary

Standardize RTG Studio editor UI behavior by making the MIDI Editor the primary
reference editor across portrait, landscape touch, desktop, and gamepad, using
Pixel as the secondary comparison and Level, Cutscene, and Actor as required
comparison references. The technical approach is to extend existing shared menu
specs, mode contracts, layout helpers, and validation tests before applying
editor-specific repairs. MIDI must pass the shared mode standard before broad
rollout fixes become the main implementation focus.

## Technical Context

**Language/Version**: JavaScript ES modules running directly in the browser

**Primary Dependencies**: Existing browser canvas/DOM UI, `@tonejs/midi`,
`jszip`, `soundfont-player`; Playwright for browser validation

**Storage**: Existing local/project file storage through `src/ui/projectFiles.js`,
`src/ui/serverStorage.js`, and editor document helpers; no new storage system

**Testing**: Node test files under `tests/unit/` and Playwright specs under
`tests/playwright/`

**Target Platform**: Static browser app launched from `index.html`, with
desktop, mobile portrait, mobile landscape touch, and gamepad control modes

**Project Type**: Browser game and editor suite

**Performance Goals**: Mode changes, menu open/close, drill-down, and gamepad
menu transitions remain responsive during normal editor use; validation must
catch surface overlap, hidden navigation, and accidental command activation

**Constraints**: Preserve portrait behavior except documented repairs; prefer
shared helpers in `src/ui/shared/editorMenuLayout.js`, shared menu specs, shared
input semantics, and shared UI helpers before editor-specific branches; keep the
app runnable without a required build step or server

**Scale/Scope**: Primary implementation target is MIDI; required comparison
coverage spans Pixel, Level, Cutscene, and Actor; broader editors remain subject
to the shared standard but are not the first implementation focus

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Product specs**: PASS. This feature directly implements the convergence
  direction already captured in `UISpec.md` and must keep
  `ui/EDITORS_UI_CONTRACT.md` as the lower-level shell, token, and layout
  contract.
- **Shared architecture**: PASS. Work must start from `src/ui/shared/editorMenuSpec.js`,
  `src/ui/shared/editorMenuLayout.js`, `src/ui/shared/input/controllerMenuStack.js`,
  `src/ui/shared/input/editorInputActions.js`, and shared UI helpers in
  `src/ui/uiSuite.js` before editor-specific code is changed.
- **Mode behavior**: PASS. Portrait remains the baseline with repairs only.
  Landscape touch, desktop, and gamepad are first-class targets. The plan
  explicitly tracks required behavior for each mode.
- **Validation**: PASS. Unit, layout, controller, portrait, and Playwright
  validation paths are identified below, with MIDI first and comparison checks
  for Pixel, Level, Cutscene, and Actor.
- **Repository hygiene**: PASS. No generated `data/server-storage/` churn is
  part of this feature. Any user-visible editor change that updates
  `src/ui/latestChanges.js` must include both `date` and `time`.

Post-design re-check: PASS. Phase 0/1 artifacts keep the design aligned with
the constitution and do not introduce new framework, storage, or runtime
requirements.

## Project Structure

### Documentation (this feature)

```text
specs/001-editor-ui-standard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── editor-ui-standard.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/ui/
├── MidiComposer.js
├── MidiComposerCore.js
├── PixelStudio.js
├── LevelEditor.js
├── LevelEditorCore.js
├── CutsceneEditor.js
├── ActorEditor.js
├── RaceEditor.js
├── latestChanges.js
├── shared/
│   ├── editorMenuLayout.js
│   ├── editorMenuSpec.js
│   ├── input/
│   │   ├── controllerMenuStack.js
│   │   └── editorInputActions.js
│   └── editor-runtime/
│       └── EditorRuntime.js
└── uiSuite.js

tests/
├── unit/
│   ├── editorMenuLayout.test.js
│   ├── editorMenuSpec.test.js
│   ├── portraitEditorMenuModels.test.js
│   ├── controllerMenuStack.test.js
│   ├── editorInputActions.test.js
│   ├── midiPatternGridLayout.test.js
│   └── pixelStudio.*.test.js
└── playwright/
    ├── editor-layout-contract.spec.js
    ├── editor-flows.spec.js
    └── pixel-editor-*.spec.js
```

**Structure Decision**: Use the existing static browser app structure. Shared
contract changes belong in `src/ui/shared/` and `src/ui/uiSuite.js`; MIDI
reference work belongs in `src/ui/MidiComposer*.js`; comparison repairs use the
existing editor modules. Tests extend existing `tests/unit/` and
`tests/playwright/` coverage.

## Chainsaw Aliens Validation Plan

- Run focused shared contract tests:
  `node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js tests/unit/controllerMenuStack.test.js tests/unit/editorInputActions.test.js`
- Run focused portrait and reference editor tests:
  `node --test tests/unit/portraitEditorMenuModels.test.js tests/unit/midiPatternGridLayout.test.js`
- Run comparison/editor-specific unit tests relevant to touched files.
- Run browser contract validation:
  `npx playwright test tests/playwright/editor-layout-contract.spec.js`
- Manually validate the MIDI Editor in portrait, landscape touch, desktop, and
  gamepad mode using `quickstart.md`.
- Validate Pixel, Level, Cutscene, and Actor against the same shared command,
  surface, scroll, and focus expectations.
- Before staging, inspect git status and exclude unrelated `data/server-storage/`
  churn.

## Complexity Tracking

No constitution violations are planned. The feature is broad, but the rollout is
constrained by making MIDI pass first, then validating comparison editors before
broader rollout.
