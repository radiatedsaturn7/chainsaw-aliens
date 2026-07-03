# Editors UI Contract

Product-level editor menu behavior is specified in `../UISpec.md`. This file is the lower-level shell, layout, spacing, typography, and token contract used by the shared editor UI implementation.

This document defines the shared layout and token contract for **Pixel Editor**, **Level Editor**, **Actor Editor**, **MIDI Editor**, **SFX Editor**, **Cutscene Editor**, **Race Editor**, and **Car Editor**.

## 1) Fixed Layout Dimensions

- **Left rail width (desktop):** responsive `292px`-`360px` allocation, derived by the shared shell
- **Left rail width (mobile compact command rail):** `84px`
- **Top bar height:** `40px`
- **Status bar height (reserved token):** `20px`
- **Mobile toolbar height (reserved token):** `72px`

## 2) Layout Grid Rules

All editors should follow this shell structure:

1. Root shell fills viewport.
2. Top bar spans full width at the top and owns desktop root menu activation.
3. Body region below top bar is split into:
   - Left rail (fixed width)
   - Main content (flexes to remaining width)
4. Optional bottom regions (status/toolbar/transport) are editor-owned content inside main content area, but must consume shared height tokens.

Canonical region map:

- `EditorShell`
  - `TopBar`
  - `Body`
    - `LeftRail`
    - `MainContent`

Desktop-specific shell rules:

- `TopBar` renders horizontal root menus. Selecting or hovering a root opens a dropdown drawer below the top bar.
- `TopBar` plans expose `fit.visibleCount`, `fit.totalCount`, `fit.isCompressed`, `fit.hasHiddenOverflow`, `fit.allRootMenusVisible`, and `fit.minimumRecommendedWidth` so every editor handles narrow desktop widths from the same geometry contract instead of inventing per-editor menu wrapping.
- Shared desktop dropdown state owns `openedAtMs`; shell rebuilds preserve it with `resolveDesktopDropdownState({ previousDropdown })`, and canvas/DOM drawers consume the live dropdown through `buildDesktopDropdownRenderPlan()` so `slide-down` motion progress is driven by shared state.
- `buildDesktopDropdownRenderPlan()` owns filtered drawer scroll metadata after hidden, duplicated, or separator rows are resolved. It must expose `visibleRows`, clamped `scrollIndex`, `maxScroll`, `scrollRegion`, and mouse wheel scroll policy so every editor routes long desktop drawers the same way.
- Desktop dropdown drawers start closed. Editors must not pass the active panel, active tool, selected tab, or selected document context as the default open dropdown root.
- Click-away state must survive the next draw; a closed drawer must not immediately reopen because another persistent context panel is active.
- Desktop dropdown drawers are the command/menu surface. They may contain full submenus, asset lists, and editor actions.
- File dropdown drawers must begin with the shared baseline row order `New`, `Save`, `Save As`, `Open`, `Export`, `Import`. Unsupported baseline actions stay visible as disabled rows with inert hit targets.
- Edit dropdown drawers must begin with the shared history row order `Undo`, `Redo`, followed by editor-specific edit actions. History commands live in the Edit drawer on desktop, not in the persistent left inspector column.
- `LeftRail` is a persistent context/inspector column below the top bar. It must not duplicate the active dropdown's command buttons.
- The top of `LeftRail` is a compact ribbon/title area. The area below it shows stable context such as document, mode, selected tool, selected asset, selected track/state/layer/frame, transport, or status.
- Shared desktop shell plans expose `commandSurfaces: ['top-dropdown']` and `persistentSurfaces: ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']`.
- Shared desktop shell plans expose `suppressedMobileSurfaces` for `bottom-action-rail`, `bottom-tool-rail`, `touch-thumbstick`, `landscape-root-drawer`, `landscape-right-submenu`, `gamepad-hint-bar`, and `gamepad-slide-out` so desktop cannot accidentally render mobile or controller chrome.
- Shared mode plans expose `surfaceRoles.commandSurface`, `surfaceRoles.persistentContextSurface`, and `surfaceRoles.desktopMobileRailsHidden`. Desktop must set `desktopMobileRailsHidden` to `true`.
- Shared generic mode plans expose `presentation` and `interaction` metadata for every mode so editor code can distinguish desktop mouse dropdowns, portrait touch bottom sheets, landscape touch right drawers, and gamepad controller slide-outs before calling a specialized renderer.
- Shared presentation/interaction mode contracts must validate for every mode; missing keys or mode-specific pointer/activation mismatches should fail contract tests before editor code can drift.
- `getEditorModeContract()` is the combined renderer-facing contract for `requiredModeSurfaces`, `suppressedModeSurfaces`, `presentation`, and `interaction`; editor renderers should prefer that single object over reassembling per-mode rules locally.
- `resolveEditorViewportModeFlags()` must return `modeContract` alongside the mode booleans so renderer entry points choose desktop, portrait, landscape, or gamepad behavior with the same shared contract object.
- Editor render entry points that call `resolveEditorViewportModeFlags()` must retain `viewportMode.modeContract` on the active editor instance, or an equivalent render-local state object, before branching into desktop, portrait, landscape, or gamepad shells.
- Specialized desktop, landscape, and gamepad shell helpers must expose presentation/interaction metadata that matches the generic mode plan for the same mode.
- Specialized desktop, landscape, and gamepad shell helpers must also expose `modeContract`; helper-specific optional surfaces may narrow `presentation`, but required/suppressed surfaces and interaction semantics must still come from the combined shared contract.
- Shared portrait mode plans expose `suppressedModeSurfaces` for `desktop-top-menu`, `desktop-dropdown`, `desktop-left-inspector`, `landscape-root-drawer`, `landscape-right-submenu`, and `gamepad-slide-out` so portrait stays bottom-first and does not inherit desktop, landscape, or controller chrome.
- Shared generic mode plans expose `suppressedModeSurfaces` in every mode so each editor has one authoritative list of chrome from other modes that must not render in the current mode.
- Shared generic mode plans expose `requiredModeSurfaces` in every mode so each editor has one authoritative list of chrome that must render for that mode, including portrait bottom rails/sheets, landscape left root/right submenu/bottom rail, desktop top menu/dropdown/left inspector/work surface, and gamepad left slide-out surfaces.
- Shared mode surface contracts must validate with no overlap between `requiredModeSurfaces` and `suppressedModeSurfaces`; a surface cannot be both required and suppressed in the same mode.
- Specialized desktop, landscape, and gamepad shell helpers must expose the same generic `requiredModeSurfaces` and `suppressedModeSurfaces` as `buildEditorMenuLayoutPlan()` for their mode.
- Desktop context panels should label the selected context as `Active` or another inspector-style label, not `Menu`.
- Editor-specific always-visible panels may live on the right or bottom when that better fits the workflow, for example Pixel layers on the right and frames along the bottom.

Landscape touch shell rules:

- `LeftRail` is the persistent fixed compact command rail and maps to `surfaces.compactCommandRail` in the shared landscape shell plan. It is `84px` wide, shows `Menu`, `Undo`, `Redo`, and one contextual quick action, and does not scroll.
- `RootDrawer` is the full root menu opened by `Menu` and maps to `surfaces.rootDrawer`. It originates from the compact left rail as `left-overlay-drawer` by default for dense editors, while `RightRail` remains reserved for active submenus and contextual drawers. Root drawers should use an all-visible grid when possible, remain gesture-scrollable when content overflows, and stay open while category picks switch the active section.
- `RightRail` is the active submenu or settings drawer when a submenu is open. Do not conflate it with `RootDrawer` when an editor needs the main menu to expand from the left rail and submenus/context drawers to remain on the right. Opening `RootDrawer` must keep `RightRail` available for the active submenu; this is exposed as `modeSurfaces.rootDrawerKeepsSubmenuVisible`.
- `BottomRail` is the persistent tool/options/zoom/ribbon surface and maps to `surfaces.toolOptions`, `surfaces.zoom`, and `surfaces.ribbon` in the shared landscape shell plan. Pixel landscape intentionally draws zoom from its bottom control rail while leaving the shell `surfaces.zoom` null, so the fixed left rail, left-origin root drawer, right submenu rail, and bottom controls do not compete for separate zoom space.
- `TopRail` is opt-in and maps to `surfaces.topRail`; when present it may own `surfaces.zoom` so zoom controls can stay off both the work surface and a bottom rail already used for tool/palette controls.
- Shared mode plans expose `modeSurfaces.compactCommandRail`, `modeSurfaces.rootDrawer`, and `surfaceRoles.persistentNavigationActionLimit: 4` so editors do not treat the left compact rail as a scrollable full root menu.
- Landscape touch drawers, right rails, bottom rails, and tool grids must remain gesture-scrollable with tap-drag suppression for accidental activation. The compact command rail itself stays fixed.
- Shared landscape shell plans expose `suppressedDesktopSurfaces` for `desktop-top-menu`, `desktop-dropdown`, and `desktop-left-inspector` so touch landscape cannot accidentally render desktop app chrome.
- Gamepad slide-out mode may omit `RightRail`; the submenu then replaces the left root rail instead of duplicating the landscape right drawer.

Gamepad-specific shell rules:

- Gamepad mode uses `surfaceRoles.persistentNavigationSurface: 'left-slide-rail'`, not the static landscape `left-rail`.
- Gamepad menus expose `gamepad.rootSurface: 'left-slide-rail'`, `gamepad.submenuSurface: 'left-slide-out-drawer'`, and `gamepad.submenuReplacesRoot: true`.
- `buildGamepadSlideOutMenuPlan()` must expose `presentation` and `interaction` metadata for controller menus. Submenus keep action rows from the shared menu spec but identify as `sourceSurface: 'gamepad-slide-out'`, `surface: 'left-slide-out-drawer'`, `replacesRootRail: true`, `rowActivation: 'confirm-button'`, and controller-owned gesture scroll so editors do not treat gamepad submenus as desktop dropdown drawers.
- Shared gamepad slide-out plans expose `suppressedTouchSurfaces` for `landscape-right-submenu`, `landscape-root-drawer`, `bottom-tool-rail`, and `touch-thumbstick` so controller menus replace the touch landscape menu stack instead of duplicating it.
- Selecting a root with `A` replaces the left root rail with that submenu drawer; `B` returns to the root rail or exits the menu stack according to the shared controller menu state.
- When a landscape or gamepad menu drawer owns rail space, editors should suppress touch-only virtual menu thumbsticks so the drawer remains the only interactive menu surface in that area.

## 3) Spacing Scale

Use only shared spacing tokens from this scale:

- `4px`
- `8px`
- `12px`
- `16px`
- `24px`
- `32px`

## 4) Typography Scale

Use shared type tokens:

- **Font family:** UI sans stack token
- **XS:** `10px`
- **SM:** `12px`
- **MD:** `14px`
- **LG:** `16px`
- **XL:** `18px`

## 5) Color Token Names

Editors should consume only shared color tokens:

- `--editor-bg`
- `--editor-surface`
- `--editor-surface-alt`
- `--editor-border`
- `--editor-text`
- `--editor-text-muted`
- `--editor-accent`
- `--editor-accent-2`
- `--editor-shadow`

## 6) Shared Component Responsibilities

- **EditorShell**
  - Owns root layout composition.
  - Creates and exposes `TopBar`, `LeftRail`, `MainContent` containers.
  - Applies only generic shell styling (no editor-specific visual rules).

- **TopBar**
  - Shared header slot for root menus, file/menu/title/actions.
  - Must keep fixed contract height.
  - Owns desktop dropdown open/close state.

- **LeftRail**
  - Shared vertical navigation slot on mobile and shared context/inspector slot on desktop.
  - Uses fixed-width contract token.
  - On desktop, must not render duplicate command rows for the active top menu drawer.

- **MainContent**
  - Flexible content slot for each editor’s current rendering surface.

- **Modal (future shared primitive)**
  - Shared overlay + panel container pattern.
  - Not implemented in this foundation task.
