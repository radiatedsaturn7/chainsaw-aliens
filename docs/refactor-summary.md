# Refactor / Transition Summary

## Running checklist (completed phases)
- [x] Phase 1 — Add a dedicated Playwright entrypoint with local static serving for CI/local parity.
- [x] Phase 2 — Add smoke coverage for app boot + editor traversal (Level Editor, Pixel Editor, MIDI Editor).
- [x] Phase 3 — Add regression coverage for editor → playtest → editor round trip and post-return input responsiveness.
- [x] Phase 4 — Hook Playwright runs into root `package.json` scripts for local runs and CI usage.
- [x] Phase 5 — Document transition/debugging notes and exact commands.

## Module / file moves
No module moves were required for this pass.

New files:
- `playwright.config.js`
- `tools/playwright/static-server.js`
- `tests/playwright/editor-flows.spec.js`
- `docs/refactor-summary.md`

## Transition model explanation
The tests validate the same state transitions used by runtime UI flows by driving `window.__game` transition methods directly:

1. **Boot**: wait until `window.__gameReady === true` and verify `#game` is visible.
2. **Editor traversal smoke**:
   - `enterEditor()` → assert `state === 'editor'` and editor/canvas view primitives exist.
   - `enterPixelStudio()` → assert `state === 'pixel-editor'` and pixel canvas bounds are initialized.
   - `enterMidiComposer()` → assert `state === 'midi-editor'` and grid bounds are initialized.
3. **Playtest round trip regression**:
   - `enterEditor()`
   - `exitEditor({ playtest: true })` → assert `state === 'playing'` and `playtestActive === true`.
   - `returnToEditorFromPlaytest()` → assert `state === 'editor'` and `playtestActive === false`.
   - send `ArrowRight` and assert `editor.camera.x` increases, proving editor input remains active after transition.

These are non-pixel assertions (state and data checks), so they are resilient to rendering differences.

## Debugging notes
- If tests fail before boot readiness, check for script/module load errors in browser console.
- If `pixelStudio.canvasBounds` or `midiComposer.gridBounds` is null, verify update/render loop is running and state actually switched before asserting.
- If the regression input assertion fails, check whether focus/modal state is active in editor; modal overlays can absorb keyboard input.
- To inspect transitions interactively, run headed mode and pause on failure (`--debug` or `--headed`).

## Exact test commands
- `npm run test:playwright`
- `npm run test:playwright:headed`
- `npx playwright test`
- `npx playwright test tests/playwright/editor-flows.spec.js --project=chromium --headed`
