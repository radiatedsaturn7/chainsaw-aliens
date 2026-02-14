# Mobile landscape fullscreen visual check: File button and tab-size parity

Follow-up verification was performed in mobile landscape fullscreen to confirm cross-editor File-button parity.

## Method

- Served app locally with `python3 -m http.server 4173`.
- Opened the app in Playwright with iPhone-style landscape emulation (`844x390`, touch enabled).
- Clicked the upper-left fullscreen CTA area.
- Switched editor states with:
  - `window.__game.enterEditor()`
  - `window.__game.enterPixelStudio()`
  - `window.__game.enterMidiComposer()`
- Captured screenshots for each state.

## Screenshots

- Level editor (mobile landscape fullscreen check):
  - `browser:/tmp/codex_browser_invocations/69e98a17db9ba48c/artifacts/artifacts/level-file-size-focus.png`
- Pixel editor (mobile landscape fullscreen check):
  - `browser:/tmp/codex_browser_invocations/69e98a17db9ba48c/artifacts/artifacts/pixel-file-size-focus.png`
- MIDI editor (mobile landscape fullscreen check):
  - `browser:/tmp/codex_browser_invocations/69e98a17db9ba48c/artifacts/artifacts/midi-file-size-focus.png`

## Conclusion

The `File` button is rendered with the same shared dimensions across Level, Pixel, and MIDI mobile editor screens.
Other tab widths can still vary by editor-specific layout columns, but `File` itself is parity-sized across all three.
