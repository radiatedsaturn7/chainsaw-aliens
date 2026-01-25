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

## Pixel Studio (Pixel Art Editor)
Open from the title screen **Tools** menu (`Pixel Editor`). The editor is an Aseprite-lite canvas with layers, palette presets, and frame animation.

### Tools
- Pencil, Eraser, Eyedropper
- Line (Bresenham, optional perfect pixels)
- Fill (contiguous or global, tolerance)
- Rect/Ellipse/Lasso select
- Move selection (nudge), Transform (flip/rotate/scale)
- Clone stamp (Alt/long-press to set source)
- Dither brush (Bayer 2x2, Bayer 4x4, Checker)
- Color Replace (layer or selection scope)

### Shortcuts (Desktop)
| Shortcut | Action |
| --- | --- |
| **B / E / G / I / V / S** | Pencil / Eraser / Fill / Eyedropper / Move / Select |
| **Ctrl/Cmd + C / X / V** | Copy / Cut / Paste selection |
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Shift + Z** or **Ctrl/Cmd + Y** | Redo |
| **[ / ]** | Brush size down/up |
| **+ / -** | Zoom in/out |
| **0** | Reset zoom |
| **Arrow keys** | Nudge cursor/selection (when canvas focused) |
| **Left click/touch** | Draw |
| **Right click** or **Space + drag** | Pan canvas |

### Controller Mapping (Xbox-style)
| Control | Action |
| --- | --- |
| **LT** | Deselect area (selection mask) |
| **RT** | Draw selection area |
| **D-pad** | Navigate UI lists (menu-first) |
| **Left Stick** | Move canvas cursor (grid-quantized) |
| **Right Stick** | Pan canvas (default) / scrub timeline when focused |
| **A** | Draw / use active tool |
| **B** | Undo |
| **X** | Eraser |
| **Y** | Redo |
| **LB / RB** | Switch left-panel tabs |
| **L3** | Color wheel (8 swatches) |
| **R3** | Tool wheel (8 tools) |
| **Start** | Menu (or Play/Pause when timeline focused) |
| **Back/Select** | Toggle **UI** ↔ **Canvas** focus mode |

### Mobile Gestures
- **1 finger**: draw
- **2 fingers**: pan
- **Pinch**: zoom (nearest-neighbor)
- **Long-press**: eyedropper

### Controls Overlay
Open the **Menu** (☰) inside Pixel Studio and choose **Controls** to view shortcuts and mappings.

### Export
- **PNG**: current frame
- **Sprite Sheet PNG + JSON**: timeline strip with metadata (frame rects + durations)
- **Palette**: export as JSON or HEX list, import via palette editor

## MIDI Pattern Sequencer
Open the sequencer from the title screen **Tools** menu (`MIDI Editor`). The editor is built around a Track → Pattern → Notes model, with full General MIDI (GM) program support:
- **Track**: channel (1–16), GM program (1–128), optional bank MSB/LSB, mute/solo, volume, and patterns.
- **Pattern**: a bar-length timeline that expands as you add notes (use an end marker to define a loop).
- **Notes**: start tick, duration tick, pitch, velocity.

### General MIDI Quick Notes
- **128 melodic programs** are available in the instrument picker (grouped by family with search).
- **Channel 10** (MIDI channel 9 in 0-based terms) is reserved for **drums** and uses the GM percussion map.
- **SoundFont required**: audio playback uses the FluidR3_GM SoundFont sample pack via CDN (no files committed to the repo). Audio starts after a user gesture; configure it in **Settings → Audio**.

If you hear no sound, wait for the “Loading instrument bank…” banner to finish or switch to another GM SoundFont.

### Recording Mode (Live Input)
1. Open the **MIDI Editor**, then press the **Record** button in the transport bar.
2. The layout switches to **Record Mode** (grid on top, live instrument UI on bottom). Use **Stop Recording** in the lower-right corner to finish.
3. Notes are captured with start time, duration, pitch, and velocity and are placed onto the grid automatically.

**Gamepad mapping (Xbox/Backbone)**
- **Left Stick**: set root note (silent).
- **D-Pad Right** = toggle **Note/Chord Mode** · hold **D-Pad Left** for sharps.
- **A** = 1, **A + LB** = 2, **X** = 3, **X + LB** = 4.
- **Y** = 5, **Y + LB** = 6, **B + LB** = 7, **B** = 8.
- **RB + A** = sus2 · **RB + X** = sus4 · **RB + Y** = dom7 · **RB + B** = 9th · **LB + RB** = diminished.
- **LT**: sustain (CC64) · **RT**: velocity (full volume when released → silent when fully pulled).
- **Right Stick**: pitch bend (± whole tone).
- **L3**: circular selector for scale mode (use left stick to choose).
- **R3**: circular selector for scale root (use right stick to choose).

**Gamepad mapping (Drums)**
- **LT** = Kick · **RB** = Closed Hi-Hat · **RT** = Open Hi-Hat.
- **A** = Snare · **X** = Low Tom · **Y** = Mid Tom · **B** = High Tom.
- **D-Pad Up** = Crash · **D-Pad Down** = Ride · **D-Pad Left/Right** = Cymbals.

**Keyboard mapping (desktop)**
- **White keys**: `A S D F G H J K L ;`
- **Black keys**: `W E T Y U O P`
- **Z/X**: octave down/up
- **C/V**: velocity down/up
- **Space**: sustain (optional)
- **Enter**: start/stop recording

**Touch / mobile fallback**
- If no gamepad is connected, the bottom panel shows an instrument selector: **Guitar / Bass / Keyboard / Drums**.
- Tap the instrument to trigger notes; visuals animate on interaction.
- Drums use a GM-style mapping (kick/snare/hats/toms/crash/ride) and record to the drum channel when available.

### Mobile + Controller Controls
- **Tabs**: switch between **Grid**, **Instruments**, **Settings**, and **Help**.
- **Transport bar (bottom)**: Play/Pause, Stop, Loop, Prev/Next bar, Return to Start, Set Start, Set End, Metronome, and time display.
- **Grid controls (Grid tab)**: tool selection (Draw/Erase/Select), quantize grid, note length, and snap/scale lock.
- **Ruler gestures**: tap/drag to scrub, **long-press** to set Start, **Shift + click** to set End, **Alt/right-click** to clear markers.

**Controller mapping (default)**
- Move cursor: D-pad / Left stick
- Place note: **A**
- Erase note: **B**
- Switch tool: **X**
- Open Instruments: **Y**
- Octave up/down: **LB / RB**
- Scrub time: **LT / RT**
- Play/Pause: **Start**
- Stop/Return: **Back**

Remap controller buttons from **Settings → Controller**.

### Instrument Selection
- **Family tabs** across the top (Piano/Keys, Guitars, Bass, Strings, Brass, Woodwinds, Synth, Drums/Perc, FX, Choir/Voice, Ethnic, Misc).
- **Large tiles** for selection (2 columns on mobile, 3–4 on larger screens).
- **Recent** and **Favorites** sections at the top; tap the star on a tile to favorite.
- **Search** is optional and never auto-focuses.

### Looping + Start/End
- Use **Set Start** / **Set End** in the Transport bar or set them from the ruler.
- Enable **Loop** to repeat between Start and End markers.
- **Return** jumps the playhead back to the Start marker (or bar 1 if not set).

### Core Workflow
1. Add a track, select a GM program (or set Channel 10 for drums), and place notes in the expanding piano roll grid.
2. Press **Play**, adjust tempo/quantize, and choose the note length from the Grid tab controls.
3. Set Start/End markers from the ruler or Transport bar, and toggle **Loop** if you want a repeat.
4. Use **Export JSON** to save a song, or **Import JSON** to load one.

### SoundFont Tips
- Use **Settings → Audio → SoundFont Instruments** to enable/disable sample playback (fallback synth is used when off).
- Use **Settings → Audio → SoundFont CDN** to switch between GitHub Pages and jsDelivr hosting for FluidR3_GM.
- Use **Settings → Audio → Preload Instrument** to fetch the active track’s SoundFont on demand.
- The UI shows “Loading SoundFont…” until the bank and required programs are ready.

### Editor Controls (mouse/touch/keyboard)
- **Click/tap on a grid cell**: toggle a note on/off (snapped to quantize).
- **Click/drag on empty grid**: paint notes (snapped to quantize).
- **Alt/Option + drag** or **Right-click**: erase notes.
- **Drag note body**: move note (snapped).
- **Drag note edge**: resize note (snapped).
- **Shift + drag note**: duplicate and move.
- **Ctrl/Cmd + drag**: box select notes.
- **Ctrl/Cmd + C / V**: copy/paste selection.
- **Ctrl/Cmd + D**: duplicate selection forward.
- **Ruler drag**: scrub playhead (optional audition toggle).
- **Long-press ruler**: set start marker.
- **Shift + click ruler**: set end marker.
- **Alt/Option + click ruler**: clear start/end markers.

### Import / Export Format
Songs are stored as JSON with this schema:
```json
{
  "schemaVersion": 2,
  "tempo": 120,
  "loopBars": 4,
  "loopStartTick": null,
  "loopEndTick": null,
  "loopEnabled": false,
  "highContrast": false,
  "key": 0,
  "scale": "minor",
  "tracks": [
    {
      "id": "track-id",
      "name": "Lead",
      "channel": 0,
      "program": 0,
      "instrumentFamily": "Piano",
      "bankMSB": 0,
      "bankLSB": 0,
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
