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
- Flame-Saw Mode Toggle: **F**
- Throw Chainsaw (embed anchor): **L**
- Interact / Advance dialog: **Space**
- Pause: **Esc**
- Test Dashboard (title screen): **T** (or click **Run Tests**)
- Golden Path Simulation (title screen or in-game after tests pass): **G**
- Feasibility Validator: **V** (current stage)
- Staged Feasibility Validator: **Shift+V** (all stages summary)
- Room Coverage Validator: **C**
- Encounter Audit: **E**
- Readability Validation Overlay + Minimap Legend: **F1**
- Debug Overlay (Playability Verification Layer): **F3**
- Obstacle Test Room (debug): **B**

## MIDI Pattern Sequencer
Open the sequencer from the title screen **Tools** menu (`MIDI Editor`). The editor is built around a Track → Pattern → Notes model:
- **Track**: instrument, mute/solo, volume, and patterns.
- **Pattern**: a bar-length loop (1–8 bars).
- **Notes**: start tick, duration tick, pitch, velocity.

### Core Workflow
1. Add a track, select an instrument, and set the loop length (1/2/4/8 bars).
2. Paint notes in the piano roll grid, press **Play**, and adjust tempo/quantize.
3. Use **Export JSON** to save a song, or **Import JSON** to load one.

### Editor Controls (mouse/touch/keyboard)
- **Click/drag on empty grid**: paint notes (snapped to quantize).
- **Alt/Option + drag** or **Right-click**: erase notes.
- **Drag note body**: move note (snapped).
- **Drag note edge**: resize note (snapped).
- **Shift + drag note**: duplicate and move.
- **Ctrl/Cmd + drag**: box select notes.
- **Ctrl/Cmd + C / V**: copy/paste selection.
- **Ctrl/Cmd + D**: duplicate selection forward.
- **Ruler drag**: scrub playhead (optional audition toggle).

### Import / Export Format
Songs are stored as JSON with this schema:
```json
{
  "tempo": 120,
  "loopBars": 4,
  "key": 0,
  "scale": "minor",
  "tracks": [
    {
      "id": "track-id",
      "name": "Lead",
      "instrument": "lead",
      "volume": 0.8,
      "mute": false,
      "solo": false,
      "patterns": [
        {
          "id": "pattern-id",
          "bars": 4,
          "notes": [
            { "id": "note-id", "startTick": 0, "durationTicks": 4, "pitch": 60, "velocity": 0.8 }
          ]
        }
      ]
    }
  ],
  "progression": [
    { "root": 0, "quality": "min", "startBar": 1, "lengthBars": 1 }
  ]
}
```

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
- Press **F3** to toggle the Playability Verification Overlay (collision boxes, solid tiles, invariant status, log panel).

## Gameplay Tips
- Hunt for tool upgrades that unlock material interactions:
  - Chainsaw Throw rig (anchors into walls for vertical rides)
  - Flame-Saw attachment (burns wood, melts metal, noisy + fuel-heavy)
  - Mag Boots (push-to-stick wall jumps; heat risk)
  - Resonance Core (shatters brittle walls, ruptures the rift seal)
- Materials block paths instead of key gates: wood barricades, welded plates, brittle walls, heavy debris.
- Material interaction quick guide:
  - **Wood Barricade**: cut with the chainsaw (slow/quiet) or burn in Flame-Saw mode (fast/loud/fuel-heavy).
  - **Welded Metal Plate**: melt with Flame-Saw mode.
  - **Brittle Wall / Rift Seal**: shatter with Resonance (rev pulses).
  - **Heavy Debris**: clear by triggering nearby counterweight switches.
- Mag Boots engage only while pressing into a wall; wall jumps always kick away and build heat toward a brief overheat lockout.
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
