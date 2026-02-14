# Mobile landscape visual check: editor left menu

This note records the requested **landscape mobile** visual verification for the three editors after the shared left-menu width alignment change.

## Environment

- Served app locally with: `python3 -m http.server 4173`
- Used Playwright emulation with iPhone-style mobile context in landscape viewport (`844x390`, touch enabled).
- Navigated editor states using runtime API:
  - `window.__game.enterEditor()`
  - `window.__game.enterPixelStudio()`
  - `window.__game.enterMidiComposer()`

## Captured screenshots

- Level editor (mobile landscape):
  - `browser:/tmp/codex_browser_invocations/e9831ac46b60b665/artifacts/artifacts/mobile-landscape-level.png`
- Pixel editor (mobile landscape):
  - `browser:/tmp/codex_browser_invocations/e9831ac46b60b665/artifacts/artifacts/mobile-landscape-pixel.png`
- MIDI editor (mobile landscape):
  - `browser:/tmp/codex_browser_invocations/e9831ac46b60b665/artifacts/artifacts/mobile-landscape-midi.png`

## Result

Landscape-mode visuals were captured successfully for all three editors as requested.
