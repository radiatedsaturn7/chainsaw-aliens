# Refactor Summary

## What changed
- Broke the pixel editor input cycle by extracting shared action constants to `src/ui/pixel-editor/inputBindings.js` and updating both `inputManager.js` and `gamepadInput.js` to depend on it.
- Added a lightweight game state system (`StateManager` + state modules) and connected `Game` to transition through the manager for core editor/play states.
- Added deterministic enter/exit hooks for title/gameplay/editor-family/robtersession states, including gameplay-to-editor input cleanup to reduce post-playtest stuck input issues.

## Files created
- `src/ui/pixel-editor/inputBindings.js`
- `src/game/state/IState.js`
- `src/game/state/StateManager.js`
- `src/game/state/states/TitleState.js`
- `src/game/state/states/GameplayState.js`
- `src/game/state/states/EditorState.js`
- `src/game/state/states/PixelEditorState.js`
- `src/game/state/states/MidiEditorState.js`
- `src/game/state/states/RobterSessionState.js`

## How to run tests
- `npm run test:dashboard`
- `npm run test:robtersession-songs`
- `npm run test:robtersession-midi`

## How to debug state transitions
- Set breakpoints in `src/game/state/StateManager.js` at `transition()`.
- Inspect `prevState`, `nextState`, and `context` in the transition callback configured in `Game` constructor.
- For gameplay->editor input issues, inspect `src/game/state/states/GameplayState.js` `exit()` cleanup path.
