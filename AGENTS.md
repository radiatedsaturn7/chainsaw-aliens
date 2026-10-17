# Agent Notes

- Treat `UISpec.md` as the canonical product spec for RTG Studio editor UI work.
- Treat `ui/EDITORS_UI_CONTRACT.md` as the lower-level shell, token, and layout contract.
- Preserve portrait editor behavior unless a task explicitly asks to change it.
- Use the shared landscape and gamepad helpers in `src/ui/shared/editorMenuLayout.js` for all editor mode layout decisions before adding editor-specific branches.
- Use shared menu specs, shared input semantics, and shared UI helpers before adding editor-specific UI code.
- When updating `src/ui/latestChanges.js`, include both `date` and `time` so the Latest Changes dialog shows timestamped work history.
- Playwright tests are merge-gating on GitHub; do not merge Playwright-related PRs to `main` until the merge workflow's Playwright job passes. On Android/Termux, write or fix tests locally but use the GitHub PR Docker run as authoritative execution.
- Do not blanket-stage generated data under `data/server-storage/`; this repo often has local storage/export churn.

## Portrait editor design

- For every new or revised portrait editor, inspect the existing Pixel Editor (`src/ui/PixelStudio.js`) and MIDI Editor (`src/ui/MidiComposerCore.js`) portrait implementations before designing the screen. Follow their shared controls, spacing, behavior, and bottom-first layout.
- Start with a persistent editing workspace, a bottom thumbstick plus **Menu / Undo / Redo / one special button** action rail, a contextual hotbar, and a zoom scroller when the work surface supports zoom. The special button serves the editor's main action, such as Brush, Play/Pause, or Playtest. Keep the four action slots in that order; disable unavailable history actions instead of removing them.
- The hotbar is a separate quick-access surface for tools, palette, track controls, or other frequent contextual actions; it does not replace the standard action rail. Give the thumbstick meaningful pan, scroll, or selection behavior. Keep zoom in the shared slider/scroller surface when applicable.
- Do not create a wizard or a chain of modal forms as the portrait editor's main interface. Users should select and edit items in the workspace and its menus without repeatedly restarting a dialog flow. A focused property dialog, file picker, confirmation, or genuinely sequential import operation may return to that same workspace; it must not become the editor itself.
- Reuse the shared portrait layout, action rail, hotbar/ribbon, bottom sheet, zoom, and input helpers. Keep menus/settings bottom-first, and ensure controls and their hit targets remain reachable without overlays covering them.
- A specialized screen may deviate where its workflow needs it. Keep the rest of the UI uniform and record the concrete reason in the existing implementation notes, spec, or PR; convenience or faster implementation is not a reason to substitute a wizard. This does not add a separate approval step.
- Validate affected portrait screens against Pixel and MIDI with rendered layout and interaction checks: thumbstick, Menu, Undo/Redo, special action, hotbar, and zoom where applicable. These portrait rules do not replace the separate desktop, landscape-touch, or gamepad contracts.
