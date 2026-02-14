# Editors UI Contract

This document defines the shared layout and token contract for **Level Editor**, **MIDI Editor**, and **Pixel Editor**.

## 1) Fixed Layout Dimensions

- **Left rail width (desktop):** `292px`
- **Left rail width (mobile/collapsed):** `72px`
- **Top bar height:** `40px`
- **Status bar height (reserved token):** `20px`
- **Mobile toolbar height (reserved token):** `72px`

## 2) Layout Grid Rules

All editors should follow this shell structure:

1. Root shell fills viewport.
2. Top bar spans full width at the top.
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
  - Shared header slot for file/menu/title/actions.
  - Must keep fixed contract height.

- **LeftRail**
  - Shared vertical navigation slot.
  - Uses fixed-width contract token.

- **MainContent**
  - Flexible content slot for each editor’s current rendering surface.

- **Modal (future shared primitive)**
  - Shared overlay + panel container pattern.
  - Not implemented in this foundation task.
