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
- Test Mode (title screen): **T**
- Golden Path Simulation (title screen): **G**
- Feasibility Validator: **V** (current stage)
- Staged Feasibility Validator: **Shift+V** (all stages summary)
- Readability Validation Overlay + Minimap Legend: **F1**
- Debug Overlay (Playability Verification Layer): **L**

## Test Mode & Validation
- From the title screen, press **T** to enter TEST MODE with a controlled map.
- From the title screen, press **G** to run the automated Golden Path Simulation.
- Press **V** in-game to run the feasibility validator for the current objective (also runs once on new game start).
- Press **Shift+V** to run the staged feasibility validator across every ability stage with a summary table.
- Press **F1** to toggle the Readability Validation Overlay + minimap legend overlay.
- Press **L** to toggle the Playability Verification Overlay (collision boxes, solid tiles, invariant status, log panel).
- Test Mode also shows the Execution Checklist, Combat Checklist, and Action Feedback checklist panels.

### Test Mode Toggles
- **I**: Invulnerable
- **F**: Infinite fuel
- **O**: Slow motion
- **C**: Show collision boxes
- **H**: Show gate requirements
- **Y**: Seeded RNG (deterministic)
- **G / P / M / R**: Toggle Grapple / Phase / Mag Boots / Resonance
- **1–6**: Teleport to regions (in order listed by the minimap legend)

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
