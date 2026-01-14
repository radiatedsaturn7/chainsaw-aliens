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
- Validator: **V**
- Visual Readability Checklist + Minimap Legend: **L**

## Test Mode & Validation
- From the title screen, press **T** to enter TEST MODE with a controlled map.
- Press **V** in-game to run the Autoplay Validator (also runs once on new game start).
- Press **L** to toggle the Visual Readability Checklist + minimap legend overlay.

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

## Known Limitations
- The validator is a conservative reachability approximation and does not simulate full physics or enemy combat.
