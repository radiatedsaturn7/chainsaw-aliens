# VFS review notes (2026-05-13)

## What I checked
- Confirmed VFS supports all four folders: `levels`, `art`, `music`, and `actors`.
- Confirmed `vfsLoad`/`vfsSave` infrastructure is used by the game entry points for loading:
  - level files from `levels`
  - pixel art files from `art`
  - MIDI files from `music`
  - actor files from `actors`

## Empty-browser check: verify server VFS bootstrap works
Use this exact flow when you start with an empty browser profile/localStorage.

1. Open the game in a fresh browser profile (or clear site storage first).
2. In the title menu, open **Storage** and enable **Server Storage**.
3. Wait for the toast confirming merge stats, e.g.:
   - `Server storage enabled (X local, Y server).`
4. Open **Storage / Project Browser** and check each folder:
   - `levels`
   - `art`
   - `music`
   - `actors`
5. Open one file from each folder to verify editor loading paths still work.
6. Refresh the page once and verify those files are still visible (confirms local snapshot write).

If step 3 shows a conflict prompt, pick `server` when you want server copy to win on duplicates.

## Why this works (code path)
- On boot, `GameCore.init()` calls `bootstrapServerStorage()` when server storage is enabled.
- `bootstrapServerStorage()` fetches `/__storage/snapshot`, merges local+server snapshots, then writes the merged snapshot into localStorage (`robter:vfs:*` keys + `robter:vfs:index`).

## How to self-verify quickly (non-empty browser)
1. Start the game.
2. Open **Storage / Project Browser**.
3. Verify each folder has entries and can be opened:
   - `levels` → should open in Level Editor.
   - `art` → should open in Pixel Editor.
   - `music` → should open in MIDI Editor.
   - `actors` → should open in Actor Editor.
4. Save one small edit in each editor and reopen the same file to ensure persistence.

## Automated coverage status in this environment
- Playwright browser tests are present but could not run here because Chromium is not installed in this container.
- Unit tests exist for VFS-adjacent pixel art restore flows.
