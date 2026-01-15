# Chainsaw Aliens

A static, browser-only 2D metroidvania prototype. Open `index.html` directly in your browser — no server, no build step.

## How to Play
1. Double-click `index.html` (or drag it into a browser tab).
2. Press **Space** to start and advance dialog.

### Optional local server
If you prefer a local server:

```bash
./run.sh
```

Then visit `http://localhost:8000/index.html`.

## Controls
- Move: **WASD** or **Arrow Keys**
- Jump: **W** / **Arrow Up** / **Space**
- Dash: **Shift**
- Attack (bite): **J**
- Rev / Execute: **K** (hold)
- Interact / Advance dialog: **Space**
- Pause: **Esc**
- Test Dashboard (title screen): **T** (or click **Run Tests**)
- Golden Path Simulation (title screen or in-game after tests pass): **G**
- Feasibility Validator: **V** (current stage)
- Staged Feasibility Validator: **Shift+V** (all stages summary)
- Room Coverage Validator: **C**
- Encounter Audit: **E**
- Readability Validation Overlay + Minimap Legend: **F1**
- Debug Overlay (Playability Verification Layer): **L**

## Test Dashboard & Validation
- Tests never run automatically on boot. Open the **Test Dashboard** from the title screen (press **T** or click **Run Tests**) to run them explicitly.
- Run each test from the menu:
  - **World Validity Test**
  - **Full Room Coverage Test**
  - **Combat/Encounter Feasibility Audit**
  - **Golden Path Run**
- The dashboard defaults to **Dry Run (report only)**. Toggle **Apply Fixes** to write deterministic patches to `src/content/repairs.json`, then reload to apply them. (Apply Fixes requires a dev server or the Playwright harness.)
- Press **G** from the title screen to run the Golden Path Simulation after the first three tests pass.
- Press **V** in-game to run the feasibility validator for the current objective.
- Press **Shift+V** to run the staged feasibility validator across every ability stage with a summary table.
- Press **C** to run the Room Coverage Validator (also toggles the room reachability overlay).
- Press **E** to run the Encounter Audit.
- Press **F1** to toggle the Readability Validation Overlay + minimap legend overlay.
- Press **L** to toggle the Playability Verification Overlay (collision boxes, solid tiles, invariant status, log panel).

## Gameplay Tips
- Hunt for the four abilities to unlock new areas:
  - Grapple Spike
  - Phase Wedge
  - Mag Boots
  - Resonance Core
- Enemies drop weapon loot — sell it at shops for credits.
- Equip modular chainsaw upgrades at shops to customize your build.
- Find save pylons to set checkpoints.
- Collect Vitality Cores to increase max health and restore durability.

## Known Limitations
- PASS/WARN/FAIL indicates whether critical invariants and feasibility checks are satisfied; FAIL entries list the target, stage, nearest reachable node, and a suggested fix category.
- The feasibility validator uses a conservative movement envelope with short input-search probes and does not simulate full enemy combat AI.

## Automated Test Harness (dev-only)
Run a full automated pass of the Test Dashboard (including the Golden Path) in a real browser context:

```bash
node tools/test-runner/run.js
```

The harness will start a local static server, open `index.html`, run the tests, and write artifacts to `tools/test-runner/output/` (console logs, JSON report, and final screenshot). If Playwright is not installed, run `npm install --prefix tools/test-runner` first.
