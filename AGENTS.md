# Agent Notes

- Treat `UISpec.md` as the canonical product spec for RTG Studio editor UI work.
- Treat `ui/EDITORS_UI_CONTRACT.md` as the lower-level shell, token, and layout contract.
- Preserve portrait editor behavior unless a task explicitly asks to change it.
- Use shared menu specs, shared input semantics, and shared UI helpers before adding editor-specific UI code.
- Do not blanket-stage generated data under `data/server-storage/`; this repo often has local storage/export churn.
