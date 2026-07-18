# Editors UI Contract

Product-level editor menu behavior is specified in `../UISpec.md`. This file is the lower-level shell, layout, spacing, typography, and token contract used by the shared editor UI implementation.

This document defines the shared layout and token contract for **Pixel Editor**, **Tile Editor**, **Level Editor**, **Actor Editor**, **MIDI Editor**, **SFX Editor**, **Cutscene Editor**, **Race Editor**, **Car Editor**, and **Doodad Editor**.

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
- Shared desktop dropdown state owns `openedAtMs`; shell rebuilds preserve it with `resolveDesktopDropdownState({ previousDropdown })`, and canvas/DOM drawers consume the live dropdown through `buildDesktopDropdownRenderPlan()` so `slide-down` motion progress is driven by shared state. Desktop dropdown state and motion use `DESKTOP_DROPDOWN_STATE_CONTRACT`.
- Desktop dropdown command rows use `DESKTOP_DROPDOWN_COMMAND_CONTRACT` for command surface, pointer type, row activation, item kind, and desktop-dropdown membership. Canvas rows expose it through shared hit records, and DOM rows expose matching datasets for action id, source id, desktop dropdown membership, command surface, pointer type, and row activation.
- `buildDesktopDropdownRenderPlan()` owns filtered drawer scroll metadata after hidden, duplicated, or separator rows are resolved. It must expose `visibleRows`, clamped `scrollIndex`, `maxScroll`, `scrollRegion`, and mouse wheel scroll policy so every editor routes long desktop drawers the same way.
- Desktop dropdown drawers start closed. Editors must not pass the active panel, active tool, selected tab, or selected document context as the default open dropdown root.
- Click-away state must survive the next draw; a closed drawer must not immediately reopen because another persistent context panel is active.
- Desktop dropdown drawers are the command/menu surface. They may contain full submenus, asset lists, and editor actions.
- File dropdown drawers must begin with `DESKTOP_FILE_BASELINE_ACTION_IDS`: `New`, `Save`, `Save As`, `Open`, `Export`, `Import`. Unsupported baseline actions stay visible as disabled rows with inert hit targets. File dropdown drawers must end with `DESKTOP_FILE_FOOTER_ACTION_ID` so Exit to Main Menu is always the final File command.
- File dropdown drawers must not include history, clipboard, or other Edit-role actions; those commands belong in the Edit drawer on desktop, not in File or the persistent left inspector column.
- Edit dropdown drawers must begin with the shared history row order `Undo`, `Redo`, followed by editor-specific edit actions.
- Edit dropdown role groups must follow `history -> clipboard -> selection -> duplicate -> targetEdit -> destructive` so desktop Edit drawers can group and render common actions consistently even when editor-specific command ids differ.
- Desktop Edit drawer render plans should mark the first row of each new action role group, and shared renderers should use that marker for subtle grouping separators without adding extra hit-target rows.
- `LeftRail` is a persistent context/inspector column below the top bar. It must not duplicate the active dropdown's command buttons.
- The top of `LeftRail` is a compact ribbon/title area. The area below it shows stable context such as document, mode, selected tool, selected asset, selected track/state/layer/frame, transport, or status.
- Shared desktop shell plans expose `commandSurfaces: ['top-dropdown']` and `persistentSurfaces: ['top-menu', 'left-ribbon', 'left-context-panel', 'work-surface']`.
- Shared desktop shell plans expose `DESKTOP_SHELL_SURFACE_CONTRACT` for command surfaces, persistent surfaces, suppressed mobile surfaces, the left panel role, and `desktopMobileRailsHidden`.
- Shared desktop plans expose `leftContextPanelContract` for the left inspector. It allows document summaries, selection summaries, active-tool summaries, transport, status, and contextual quick actions. Top dropdown commands must stay in top dropdown drawers; contextual quick actions must be contextual and must not duplicate the open dropdown.
- Shared desktop shell plans expose `suppressedMobileSurfaces` for `bottom-action-rail`, `bottom-tool-rail`, `touch-thumbstick`, `landscape-root-drawer`, `landscape-right-submenu`, `gamepad-hint-bar`, and `gamepad-slide-out` so desktop cannot accidentally render mobile or controller chrome.
- Shared mode plans expose `surfaceRoles.commandSurface`, `surfaceRoles.persistentContextSurface`, and `surfaceRoles.desktopMobileRailsHidden`. Desktop must set `desktopMobileRailsHidden` to `true`.
- Shared generic mode plans expose `presentation` and `interaction` metadata for every mode so editor code can distinguish desktop mouse dropdowns, portrait touch bottom sheets, landscape touch right drawers, and gamepad controller slide-outs before calling a specialized renderer.
- Shared menu specs expose `modeContracts` for the same four modes. A spec mode contract must agree with its placement root/submenu surfaces and with the renderer-facing presentation/interaction contract for root surface, command surface, pointer type, activation model, and gesture scrolling.
- Shared presentation/interaction mode contracts must validate for every mode; missing keys or mode-specific pointer/activation mismatches should fail contract tests before editor code can drift.
- `getEditorModeContract()` is the combined renderer-facing contract for `requiredModeSurfaces`, `suppressedModeSurfaces`, `presentation`, and `interaction`; editor renderers should prefer that single object over reassembling per-mode rules locally.
- `resolveEditorViewportModeFlags()` must return `modeContract` and `specModeContract` alongside the mode booleans so renderer entry points choose desktop, portrait, landscape, or gamepad behavior with the same shared renderer and menu-spec contract objects.
- Editor render entry points that call `resolveEditorViewportModeFlags()` must retain both `viewportMode.modeContract` and `viewportMode.specModeContract` on the active editor instance, or equivalent render-local state objects, before branching into desktop, portrait, landscape, or gamepad shells.
- In short, renderer entry points must retain `viewportMode.modeContract`; new work should also retain `viewportMode.specModeContract` so renderer and menu-spec mode semantics can be compared.
- Specialized desktop, landscape, and gamepad shell helpers must expose presentation/interaction metadata that matches the generic mode plan for the same mode.
- Specialized desktop, landscape, and gamepad shell helpers must also expose `modeContract`; helper-specific optional surfaces may narrow `presentation`, but required/suppressed surfaces and interaction semantics must still come from the combined shared contract.
- Shared portrait mode plans expose `suppressedModeSurfaces` for `desktop-top-menu`, `desktop-dropdown`, `desktop-left-inspector`, `landscape-root-drawer`, `landscape-right-submenu`, and `gamepad-slide-out` so portrait stays bottom-first and does not inherit desktop, landscape, or controller chrome.
- Shared portrait menu-spec contracts place root menus on the `bottom-rail` and both submenus and settings on the `bottom-sheet`. Top portrait regions are persistent context/status only, not default settings command surfaces.
- Shared portrait root menus must stay within `PORTRAIT_ROOT_MAX_ITEMS` bottom items; editors consolidate extra workflows into submenus instead of expanding the root rail.
- Shared portrait action rails must build from `STANDARD_EDITOR_ACTION_RAIL_PREFIX` via `getStandardEditorActionRailIds()`, keeping Menu, Undo, Redo, and one contextual editor command in a consistent four-slot bottom rail.
- Shared generic mode plans expose `suppressedModeSurfaces` in every mode so each editor has one authoritative list of chrome from other modes that must not render in the current mode.
- Shared generic mode plans expose `requiredModeSurfaces` in every mode so each editor has one authoritative list of chrome that must render for that mode, including portrait bottom rails/sheets, landscape left root/right submenu/bottom rail, desktop top menu/dropdown/left inspector/work surface, and gamepad left slide-out surfaces.
- Shared mode plans expose `surfaceVisibility`, a map from surface id to `required` or `suppressed`, so renderer code can query one mode contract instead of manually searching separate required/suppressed arrays.
- Renderers should use `getEditorSurfaceVisibility()` or `canRenderEditorSurface()` for mode-specific chrome gates such as desktop bottom rails, touch thumbsticks, desktop top menus, landscape right submenus, and gamepad slide-outs instead of open-coded surface checks. When a renderer has a concrete shell plan, prefer `getEditorPlanSurfaceVisibility()` / `canRenderEditorPlanSurface()` so optional helper-level omissions like a missing landscape right rail are respected.
- Shared mode surface contracts must validate with no overlap between `requiredModeSurfaces` and `suppressedModeSurfaces`; a surface cannot be both required and suppressed in the same mode.
- Specialized desktop, landscape, and gamepad shell helpers must expose the same generic `requiredModeSurfaces` and `suppressedModeSurfaces` as `buildEditorMenuLayoutPlan()` for their mode.
- Desktop context panels should label the selected context as `Active` or another inspector-style label, not `Menu`.
- Desktop context panel roles must come from `EDITOR_DESKTOP_LEFT_CONTEXT_ROLES` in `src/ui/shared/editorMenuSpec.js`. MIDI is the primary reference, Pixel is the secondary reference, and Level, Cutscene, and Actor are required comparison editors; new editors must declare their context roles before adding bespoke left-panel content.
- Editor-specific always-visible panels may live on the right or bottom when that better fits the workflow, for example Pixel layers on the right and frames along the bottom.

Landscape touch shell rules:

- Shared landscape shell surfaces come from `LANDSCAPE_TOUCH_SHELL_SURFACE_CONTRACT`, including the compact left command rail, left-origin root drawer, right submenu drawer, bottom tool/options rail role, suppressed desktop surfaces, and fixed compact-rail action metadata.
- Landscape shell plans keep the generic `surfaceVisibility` from the canonical landscape mode contract and also expose `effectiveSurfaceVisibility` for the concrete helper instance. When a renderer intentionally omits the right rail, `effectiveSurfaceVisibility['right-drawer']` and `effectiveSurfaceVisibility['landscape-right-submenu']` are `suppressed` even though the generic landscape contract still treats the right submenu as the normal required surface.
- `LeftRail` is the persistent fixed compact command rail and maps to `surfaces.compactCommandRail` in the shared landscape shell plan. It is `84px` wide, shows `Menu`, `Undo`, `Redo`, and one contextual quick action, and does not scroll. Shared compact rail actions expose `slot`, `surface: left-rail`, `commandRail: compact-landscape`, `rowActivation: tap-release`, and `gestureScroll: false` so renderers do not treat the fixed rail like a scrollable root drawer.
- `RootDrawer` is the full root menu opened by `Menu` and maps to `surfaces.rootDrawer`. It originates from the compact left rail as `left-overlay-drawer`, while `RightRail` remains reserved for active submenus and contextual drawers. Root drawers should use an all-visible grid when possible, remain gesture-scrollable when content overflows, and stay open while category picks switch the active section.
- `RightRail` is the active submenu or settings drawer when a submenu is open. Do not conflate it with `RootDrawer` when an editor needs the main menu to expand from the left rail and submenus/context drawers to remain on the right. Opening `RootDrawer` must keep `RightRail` available for the active submenu; this is exposed as `modeSurfaces.rootDrawerKeepsSubmenuVisible`.
- `BottomRail` is the persistent tool/options/zoom/ribbon surface and maps to `surfaces.toolOptions`, `surfaces.zoom`, and `surfaces.ribbon` in the shared landscape shell plan. Pixel landscape keeps palette/layer/frame controls in the bottom rail, caps the right submenu to the compact left rail height, and uses a right-side `surfaces.zoom` slot directly below that submenu so zoom remains south of the right menu without competing with palette controls.
- `TopRail` is opt-in and maps to `surfaces.topRail`; when present it may own `surfaces.zoom` so zoom controls can stay off both the work surface and a bottom rail already used for tool/palette controls.
- Shared mode plans expose `modeSurfaces.compactCommandRail`, `modeSurfaces.rootDrawer`, and `surfaceRoles.persistentNavigationActionLimit: COMPACT_LANDSCAPE_COMMAND_RAIL_ACTION_LIMIT` so editors do not treat the left compact rail as a scrollable full root menu.
- Landscape touch drawers, right rails, bottom rails, and tool grids must remain gesture-scrollable with tap-drag suppression for accidental activation. The compact command rail itself stays fixed.
- Shared landscape shell plans expose `suppressedDesktopSurfaces` for `desktop-top-menu`, `desktop-dropdown`, and `desktop-left-inspector` so touch landscape cannot accidentally render desktop app chrome.
- Gamepad slide-out mode may omit `RightRail`; the submenu then replaces the left root rail instead of duplicating the landscape right drawer.

Gamepad-specific shell rules:

- Gamepad mode uses `GAMEPAD_SLIDE_OUT_MENU_CONTRACT.rootSurface` for `surfaceRoles.persistentNavigationSurface`, not the static landscape `left-rail`.
- Gamepad menus expose `gamepad.rootSurface`, `gamepad.submenuSurface`, controls, row activation, source surface, and suppressed touch surfaces from `GAMEPAD_SLIDE_OUT_MENU_CONTRACT`; `gamepad.submenuReplacesRoot` must stay `true`.
- Generic mode acceptance must come from `EDITOR_MODE_ACCEPTANCE_CONTRACTS`/`getEditorModeAcceptanceContract()`, including root command surface, command/submenu surface, persistent context surface, thumbstick policy, drill direction, pointer type, row activation, scroll policy, and focus policy.
- `buildGamepadSlideOutMenuPlan()` must expose `presentation` and `interaction` metadata for controller menus. Submenus keep action rows from the shared menu spec but identify as `sourceSurface: 'gamepad-slide-out'`, `surface: 'left-slide-out-drawer'`, `replacesRootRail: true`, `rowActivation: 'confirm-button'`, and controller-owned gesture scroll so editors do not treat gamepad submenus as desktop dropdown drawers.
- Shared gamepad slide-out plans expose `suppressedTouchSurfaces` for `right-drawer`, `right-overlay-drawer`, `left-overlay-drawer`, `landscape-right-submenu`, `landscape-root-drawer`, `bottom-tool-rail`, and `touch-thumbstick` so controller menus replace the touch landscape menu stack instead of duplicating it.
- Selecting a root with `A` replaces the left root rail with that submenu drawer; `B` returns to the root rail or exits the menu stack according to the shared controller menu state.
- Shared gamepad slide-out plans expose `focusRingContract` and row-level `focused`/`focusRing` metadata for both root and submenu rows. Focus rings must be visible on every focused actionable row, using controller `confirm-button` activation on the `gamepad-slide-out` source surface.
- When a landscape or gamepad menu drawer owns rail space, editors should suppress touch-only virtual menu thumbsticks so the drawer remains the only interactive menu surface in that area.
- Menu drawers and tool lists should register a shared gesture region even when their current contents fit without overflow. Dragging inside the region must suppress tap activation, while `maxScroll: 0` keeps the scroll position clamped; overflow panels use the same region metadata to scroll by tap-drag or wheel where appropriate.

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
  - Desktop context/inspector slot and landscape compact command rail host; portrait navigation remains bottom-first and does not use this component for root menus.
  - Uses the desktop fixed-width contract token or the landscape compact command rail token depending on the active mode contract.
  - On desktop, must not render duplicate command rows for the active top menu drawer.

- **MainContent**
  - Flexible content slot for each editor’s current rendering surface.

- **Modal (future shared primitive)**
  - Shared overlay + panel container pattern.
  - Not implemented in this foundation task.

## Future Editor Onboarding

Before a new editor ships, add it to the shared menu spec with:

- Stable editor id, root menus, portrait roots, and desktop File/Edit/View roots.
- Per-mode command surfaces through the shared placement and acceptance helpers.
- Desktop left context roles in `EDITOR_DESKTOP_LEFT_CONTEXT_ROLES`.
- Portrait and landscape contextual action ids for the shared Menu/Undo/Redo/action rail.
- Gamepad focus/back behavior through the shared controller menu stack and slide-out helpers.
- Any workflow exception documented in the feature contract with a unit or browser validation path.
