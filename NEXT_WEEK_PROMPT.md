# Next Week Prompt

Resume the RTG Studio editor UI consistency goal from the `staging` branch.

Current goal:
- Make every editor use the same RTG Studio style and shared menu semantics.
- Desktop should behave like a desktop app: horizontal top menus, dropdown drawers, click-away close, hover switching, persistent left-side contextual/tool panels, and no mobile bottom rails.
- Portrait should preserve the working bottom-first flow and keep submenus at the bottom wherever possible.
- Mobile landscape should use a left main menu, right submenu, and bottom rail for zoom/ribbons/tool options when appropriate.
- Gamepad should mirror landscape, but selecting a main menu replaces the left rail with the submenu; A selects and B backs out.

Most recent completed work:
- Race playtest rendering now samples segment-authored elevation as one continuous profile.
- Race playtest camera renders above the road surface and no longer uses elapsed-time horizon wobble.
- Random race generation now chooses between oval, road-course, sprint, mixed-rally, and severe-rally archetypes.
- Shared editor menu/layout tests and race editor tests were updated around current behavior.

Next useful pass:
- Audit desktop editor menu behavior across Pixel, Level, MIDI, SFX, Cutscene, Actor, Tile, Race, and Car.
- Prioritize real desktop-app behavior: top menus should stay open while selecting drawer rows, hover should switch drawers, click-away should close drawers, and left panels should contain persistent contextual tools instead of duplicate top-menu items.
- Preserve portrait behavior unless a portrait inconsistency is explicitly targeted.
- Keep using `UISpec.md`, `ui/EDITORS_UI_CONTRACT.md`, `src/ui/shared/editorMenuLayout.js`, and `src/ui/shared/editorMenuSpec.js` as the source of truth.

Before committing:
- Do not blanket-stage `data/server-storage/`.
- Keep `src/ui/latestChanges.js` timestamped with both date and time.
- Run focused editor UI tests before pushing.
