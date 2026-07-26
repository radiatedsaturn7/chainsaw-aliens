# Agent Notes

- Treat `UISpec.md` as the canonical product spec for RTG Studio editor UI work.
- Treat `ui/EDITORS_UI_CONTRACT.md` as the lower-level shell, token, and layout contract.
- Preserve portrait editor behavior unless a task explicitly asks to change it.
- Use the shared landscape and gamepad helpers in `src/ui/shared/editorMenuLayout.js` for all editor mode layout decisions before adding editor-specific branches.
- Use shared menu specs, shared input semantics, and shared UI helpers before adding editor-specific UI code.
- When updating `src/ui/latestChanges.js`, include both `date` and `time` so the Latest Changes dialog shows timestamped work history.
- Playwright tests are merge-gating on GitHub; do not merge Playwright-related PRs to `main` until the merge workflow's Playwright job passes. On Android/Termux, write or fix tests locally but use the GitHub PR Docker run as authoritative execution.
- Do not blanket-stage generated data under `data/server-storage/`; this repo often has local storage/export churn.
