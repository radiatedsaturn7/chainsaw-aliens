# Tasks: Editor UI Standard

**Input**: Design documents from `/specs/001-editor-ui-standard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/editor-ui-standard.md, quickstart.md

**Tests**: Required by the feature specification and constitution. Test tasks appear before implementation tasks in each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file paths

## Path Conventions

- Source: `src/ui/`, `src/ui/shared/`
- Unit tests: `tests/unit/`
- Browser tests: `tests/playwright/`
- Feature docs: `specs/001-editor-ui-standard/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing shared editor UI foundation and document the feature-specific validation scope.

- [X] T001 Verify current shared editor contract exports in src/ui/shared/editorMenuLayout.js and src/ui/shared/editorMenuSpec.js against specs/001-editor-ui-standard/contracts/editor-ui-standard.md
- [X] T002 Verify MIDI, Pixel, Level, Cutscene, and Actor editor entry points in src/ui/MidiComposerCore.js, src/ui/PixelStudio.js, src/ui/LevelEditorCore.js, src/ui/CutsceneEditor.js, and src/ui/ActorEditor.js
- [X] T003 [P] Add or update feature validation notes in specs/001-editor-ui-standard/quickstart.md for the exact local commands used during implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared validation scaffolding and contract metadata that all user stories rely on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add reference/comparison editor metadata for MIDI, Pixel, Level, Cutscene, and Actor in src/ui/shared/editorMenuSpec.js
- [X] T005 Add desktop left panel context role metadata for MIDI, Pixel, Level, Cutscene, and Actor in src/ui/shared/editorMenuSpec.js
- [X] T006 Add shared mode acceptance helpers for root surface, submenu surface, context surface, thumbstick policy, scroll policy, and focus policy in src/ui/shared/editorMenuLayout.js
- [X] T007 [P] Add unit coverage for reference/comparison editor metadata in tests/unit/editorMenuSpec.test.js
- [X] T008 [P] Add unit coverage for shared mode acceptance helpers in tests/unit/editorMenuLayout.test.js
- [X] T009 [P] Add controller focus and left slide-out acceptance coverage in tests/unit/controllerMenuStack.test.js
- [X] T010 Run foundational validation command `node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js tests/unit/controllerMenuStack.test.js tests/unit/editorInputActions.test.js`

**Checkpoint**: Shared metadata and acceptance helpers are ready for story implementation.

---

## Phase 3: User Story 1 - Establish a Reference Editor Standard (Priority: P1) MVP

**Goal**: Make the MIDI Editor the primary reference experience across portrait, landscape touch, desktop, and gamepad, with Pixel as the secondary quality comparison.

**Independent Test**: MIDI completes the same primary editing workflow in portrait, landscape touch, desktop, and gamepad without breaking the existing portrait flow.

### Tests for User Story 1

- [X] T011 [P] [US1] Add MIDI reference mode contract unit tests in tests/unit/midiPatternGridLayout.test.js
- [X] T012 [P] [US1] Add MIDI portrait rail and bottom-first preservation checks in tests/unit/portraitEditorMenuModels.test.js
- [X] T013 [P] [US1] Add MIDI desktop top menu and left context browser checks in tests/playwright/editor-layout-contract.spec.js
- [X] T014 [P] [US1] Add MIDI landscape touch right drill-down browser checks in tests/playwright/editor-layout-contract.spec.js
- [X] T015 [P] [US1] Add MIDI gamepad slide-out and no-virtual-thumbstick browser checks in tests/playwright/editor-layout-contract.spec.js

### Implementation for User Story 1

- [X] T016 [US1] Align MIDI portrait command rail, contextual action, and thumbstick policy in src/ui/MidiComposerCore.js
- [X] T017 [US1] Align MIDI desktop top menu behavior and left panel context content in src/ui/MidiComposerCore.js
- [X] T018 [US1] Align MIDI landscape touch left command rail and right drill-down behavior in src/ui/MidiComposerCore.js
- [X] T019 [US1] Align MIDI gamepad left slide-out navigation, focus behavior, and thumbstick suppression in src/ui/MidiComposerCore.js
- [X] T020 [US1] Route MIDI mode decisions through shared helpers from src/ui/shared/editorMenuLayout.js in src/ui/MidiComposerCore.js
- [X] T021 [US1] Verify Pixel remains a secondary reference without regression in src/ui/PixelStudio.js and tests/unit/pixelStudio.animation.test.js
- [X] T022 [US1] Run `node --test tests/unit/midiPatternGridLayout.test.js tests/unit/portraitEditorMenuModels.test.js`
- [X] T023 [US1] Skipped/deferred `npx playwright test tests/playwright/editor-layout-contract.spec.js` for phone development; Playwright is unsupported on Android/Termux and must run later on desktop/Linux CI

**Checkpoint**: MIDI is the validated reference editor and Pixel remains a stable comparison.

---

## Phase 4: User Story 2 - Apply Consistent Behavior Across Editors (Priority: P2)

**Goal**: Validate and repair consistency across Pixel, Level, Cutscene, and Actor while preserving each editor's unique workflow context.

**Independent Test**: Pixel, Level, Cutscene, and Actor share common command behavior with MIDI where workflows overlap, and their desktop left panels show editor-specific working context rather than duplicate top menu commands.

### Tests for User Story 2

- [X] T024 [P] [US2] Add comparison editor shared command placement tests in tests/unit/editorMenuSpec.test.js
- [X] T025 [P] [US2] Add desktop left panel context role tests for Pixel, Level, Cutscene, and Actor in tests/unit/editorMenuLayout.test.js
- [X] T026 [P] [US2] Add browser checks for Pixel, Level, Cutscene, and Actor desktop left panels in tests/playwright/editor-layout-contract.spec.js
- [X] T027 [P] [US2] Add browser checks for comparison editor landscape and gamepad navigation reachability in tests/playwright/editor-layout-contract.spec.js

### Implementation for User Story 2

- [X] T028 [US2] Align Pixel shared command surfaces and desktop left context metadata in src/ui/PixelStudio.js
- [X] T029 [US2] Align Level shared command surfaces and desktop left context metadata in src/ui/LevelEditorCore.js
- [X] T030 [US2] Align Cutscene shared command surfaces and desktop left context metadata in src/ui/CutsceneEditor.js
- [X] T031 [US2] Align Actor shared command surfaces and desktop left context metadata in src/ui/ActorEditor.js
- [X] T032 [US2] Document any justified editor-specific workflow exceptions in specs/001-editor-ui-standard/contracts/editor-ui-standard.md
- [X] T033 [US2] Run `node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js`
- [X] T034 [US2] Skipped/deferred `npx playwright test tests/playwright/editor-layout-contract.spec.js` for phone development; Playwright is unsupported on Android/Termux and must run later on desktop/Linux CI

**Checkpoint**: Comparison editors validate the standard without losing editor-specific context.

---

## Phase 5: User Story 3 - Preserve Portrait While Repairing Inconsistencies (Priority: P3)

**Goal**: Limit portrait changes to targeted repairs and keep existing portrait workflows stable.

**Independent Test**: Existing portrait checks pass after repairs, and changed portrait behavior is documented as consistency repair rather than redesign.

### Tests for User Story 3

- [X] T035 [P] [US3] Add portrait repair regression checks for MIDI, Pixel, Level, Cutscene, Actor, Race, Car, and SFX in tests/unit/portraitEditorMenuModels.test.js
- [X] T036 [P] [US3] Add portrait shared rail interaction checks in tests/unit/editorMenuLayout.test.js
- [X] T037 [P] [US3] Add portrait browser smoke checks for affected editors in tests/playwright/editor-flows.spec.js

### Implementation for User Story 3

- [X] T038 [US3] Repair documented portrait inconsistencies in src/ui/MidiComposerCore.js without moving primary controls unnecessarily
- [X] T039 [US3] Repair documented portrait inconsistencies in src/ui/PixelStudio.js without moving primary controls unnecessarily
- [X] T040 [US3] Repair documented portrait inconsistencies in src/ui/LevelEditorCore.js without moving primary controls unnecessarily
- [X] T041 [US3] Repair documented portrait inconsistencies in src/ui/CutsceneEditor.js without moving primary controls unnecessarily
- [X] T042 [US3] Repair documented portrait inconsistencies in src/ui/ActorEditor.js without moving primary controls unnecessarily
- [X] T043 [US3] Audit and repair documented Car portrait inconsistencies in src/ui/RaceEditor.js without moving primary controls unnecessarily
- [X] T044 [US3] Add timestamped user-visible change entry in src/ui/latestChanges.js if editor behavior changes are visible to users
- [X] T045 [US3] Run `node --test tests/unit/portraitEditorMenuModels.test.js tests/unit/editorMenuLayout.test.js`
- [X] T046 [US3] Skipped/deferred `npx playwright test tests/playwright/editor-flows.spec.js` for phone development; Playwright is unsupported on Android/Termux and must run later on desktop/Linux CI

**Checkpoint**: Portrait remains stable, with only documented consistency repairs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and repository hygiene.

- [X] T047 Update UISpec.md with any finalized reference-editor behavior that changed during implementation
- [X] T048 Update ui/EDITORS_UI_CONTRACT.md with any finalized shell, surface, scroll, or focus contract changes
- [X] T049 Create or update future-editor onboarding checklist/template in specs/001-editor-ui-standard/contracts/editor-ui-standard.md
- [X] T050 Update specs/001-editor-ui-standard/quickstart.md with final validation commands and manual outcomes
- [X] T051 Run focused validation `node --test tests/unit/editorMenuLayout.test.js tests/unit/editorMenuSpec.test.js tests/unit/controllerMenuStack.test.js tests/unit/editorInputActions.test.js tests/unit/portraitEditorMenuModels.test.js tests/unit/midiPatternGridLayout.test.js`
- [X] T052 Skipped/deferred browser validation `npx playwright test tests/playwright/editor-layout-contract.spec.js tests/playwright/editor-flows.spec.js` for phone development; Playwright is unsupported on Android/Termux and must run later on desktop/Linux CI
- [X] T053 Inspect `git status --short` and confirm unrelated data/server-storage/ churn is excluded from staging

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 MIDI Reference (Phase 3)**: Depends on Foundational; MVP scope.
- **US2 Comparison Editors (Phase 4)**: Depends on US1 because the MIDI standard must exist before comparison repairs.
- **US3 Portrait Repairs (Phase 5)**: Depends on Foundational and may run after US1, but final acceptance depends on US1 and US2 validation.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: Required first. Establishes MIDI as the reference editor.
- **US2**: Depends on US1. Applies and validates the standard against Pixel, Level, Cutscene, and Actor.
- **US3**: Can identify issues after Foundational, but final repairs must not conflict with US1 or US2.

### Within Each User Story

- Tests are written before implementation.
- Shared contract updates precede editor-specific changes.
- MIDI fixes precede comparison-editor rollout.
- Portrait repairs must be documented and validated before completion.

## Parallel Opportunities

- T003 can run alongside setup verification.
- T007, T008, and T009 can run in parallel after T004-T006 are defined.
- T011-T015 can run in parallel because they target different validation surfaces.
- T024-T027 can run in parallel because they target different comparison checks.
- T035-T037 can run in parallel because they target different portrait validation layers.
- T047-T050 can run in parallel after implementation behavior is finalized.

## Parallel Example: User Story 1

```bash
Task: "Add MIDI reference mode contract unit tests in tests/unit/midiPatternGridLayout.test.js"
Task: "Add MIDI portrait rail and bottom-first preservation checks in tests/unit/portraitEditorMenuModels.test.js"
Task: "Add MIDI desktop top menu and left context browser checks in tests/playwright/editor-layout-contract.spec.js"
Task: "Add MIDI landscape touch right drill-down browser checks in tests/playwright/editor-layout-contract.spec.js"
Task: "Add MIDI gamepad slide-out and no-virtual-thumbstick browser checks in tests/playwright/editor-layout-contract.spec.js"
```

## Parallel Example: User Story 2

```bash
Task: "Add comparison editor shared command placement tests in tests/unit/editorMenuSpec.test.js"
Task: "Add desktop left panel context role tests for Pixel, Level, Cutscene, and Actor in tests/unit/editorMenuLayout.test.js"
Task: "Add browser checks for Pixel, Level, Cutscene, and Actor desktop left panels in tests/playwright/editor-layout-contract.spec.js"
Task: "Add browser checks for comparison editor landscape and gamepad navigation reachability in tests/playwright/editor-layout-contract.spec.js"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 so MIDI becomes the fully validated reference editor.
3. Stop and validate MIDI independently in portrait, landscape touch, desktop, and gamepad.

### Incremental Delivery

1. Establish MIDI reference behavior.
2. Validate Pixel, Level, Cutscene, and Actor against the standard.
3. Apply portrait-only repairs where needed.
4. Update docs and quickstart with final validation.

### Broader Rollout

After US1-US3 pass, use the same contracts for Race, Car, SFX, Tile, and future editors.

## Notes

- All user-story tasks include [US1], [US2], or [US3] labels.
- [P] tasks use different files or independent validation surfaces.
- Do not blanket-stage generated data under data/server-storage/.
- Preserve portrait unless the task explicitly documents a repair.
