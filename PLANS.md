# Focused improvement pass (ESM/CJS, listener lifecycle, MidiComposer decomposition)

## What is broken / risky today
- **Node module warning risk**: `tools/robtersession/song-generator-harness.js` already uses ESM while root `package.json` previously had no `"type"`, so Node can warn about reparsing module type.
- **Lifecycle risk in input listeners**: `src/main.js` directly bound many DOM listeners without a shared disposer utility and without state-transition touch session reset; this can leave stale touch/pointer state during editor ↔ playtest transitions.
- **Editor listener consistency risk**: `src/editor/Editor.js` had direct `addEventListener` usage with no centralized disposal strategy.
- **MidiComposer maintainability risk**: `src/ui/MidiComposer.js` still owns state initialization, input-bus wiring, and rendering helpers in one large file.

## Decisions
1. **Module strategy: adopt ESM for project scripts**
   - Add `"type": "module"` to `package.json`.
   - Keep remaining CommonJS scripts as `.cjs` to avoid runtime ambiguity.
   - Convert Playwright config/tests to ESM syntax for consistency.
   - Rationale: removes module-type reparsing warnings while minimizing churn.
2. **Listener lifecycle strategy: shared disposer + DOM listener helper**
   - Introduce `src/input/disposables.js` with `addDOMListener` and `createDisposer`.
   - Use AbortController-backed listeners where available.
   - Make mode-transition input cleanup explicit in `main.js` via touch session reset on state changes.
3. **MidiComposer decomposition strategy**
   - Extract modular responsibilities without changing behavior:
     - `src/ui/midi/state/composerState.js` (state initialization)
     - `src/ui/midi/input/composerInputHandlers.js` (input bus registration)
     - `src/ui/midi/render/composerRender.js` (render helpers)

## Implementation steps
1. [x] Add `src/input/disposables.js` utility (`addDOMListener`, `createDisposer`).
2. [x] Refactor `src/main.js` listener registration to use shared lifecycle utility.
3. [x] Add state-transition touch/pointer cleanup in `src/main.js` loop to harden editor ↔ playtest round-trip behavior.
4. [x] Refactor `src/editor/Editor.js` DOM listener wiring to use `createDisposer`/`addDOMListener`.
5. [x] Choose/implement consistent module strategy:
   - Add `"type": "module"`.
   - Rename CommonJS scripts to `.cjs` and update script/config references.
   - Convert Playwright config/spec to ESM.
6. [x] Extract MidiComposer modules:
   - state init module
   - input registration module
   - render helper module
   and wire `MidiComposer` orchestration to call extracted functions.
7. [x] Add/extend automated smoke coverage for editor → playtest → editor input re-binding correctness.

## Acceptance criteria
- Running Node scripts does not emit "module type not specified / reparsing as ES module" warnings due to mixed module ambiguity.
- Event listener utility exists and is used in `main.js` + `Editor.js`.
- Entering playtest from editor and returning to editor does not leave stale touch/gesture state (no stuck thumbstick/pointer state).
- `MidiComposer.js` delegates state, input-bus wiring, and selected render helpers to extracted modules.
- Playwright smoke coverage includes editor→playtest→editor input continuity check.

## Rollback strategy
- If module migration causes tool breakage: revert `package.json` `type`, revert `.cjs` renames and ESM conversions in Playwright files.
- If input lifecycle changes regress interactions: revert `src/main.js` to previous direct listeners and remove touch-session reset block; keep utility file for future incremental use.
- If MidiComposer extraction introduces behavior drift: revert extracted module imports and restore in-file implementations for constructor/input/render methods.
