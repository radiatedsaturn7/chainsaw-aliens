# Robterspiel Highway HUD

## Highway + Note Rendering
- **Highway lanes**: Four perspective lanes align to A/X/Y/B. Notes travel down the highway toward the hit line at the BPM-derived scroll speed.
- **Note gems**:
  - **Primary label**: the button (A/X/Y/B).
  - **Secondary label**: the resolved pitch (note mode) or chord name (chord mode).
  - **Chord stacks**: chord notes render as a 3-bar stack to indicate triad tones and sustain length.

## Mode Indicator (NOTE vs CHORD)
- The top-center mode pill shows NOTE and CHORD states.
- The active mode is highlighted so players always know whether input resolves to a note or a chord.

## Controller State HUD
- **Left Stick compass**: highlights the current 8-way direction (N, NE, E, SE, S, SW, W, NW).
  - The highlighted direction maps to the current **degree/root selector**.
- **Modifier strip**:
  - **LB**: chord color / passing tone modifier.
  - **D-Pad Left**: tension/accidental modifier.
  - **RB**: octave up modifier.
- **Octave meter**: vertical indicator showing the current octave offset.
  - The highway also draws a horizontal octave line that moves up/down with octave changes.
- **Live mapping**:
  - A/X/Y/B are resolved in real time to the current pitch or chord label, based on stick direction + modifiers.

## Hit Feedback + Wrong Note Diagnostics
- **Hit feedback**: shows a brief “Perfect/Good/Practice” callout and flashes the lane.
- **Wrong note feedback**:
  - “Expected: <note/chord>” vs “You played: <note/chord>”.
  - Inputs are listed as: `LStick=<dir> Modifiers=<LB/D-Left/RB> Button=<A/X/Y/B>`.
- **Misses**: show “Expected” with a blank “You played” entry.

## Listen / Practice / Play
- **Listen First**: autoplay preview, no scoring.
- **Practice**: no fail, optional ghost notes (chart plays while you try), adjustable speed.
- **Play**: normal scoring + streak tracking.

## Settings
- **Note Size**: scales gem sizes for mobile readability.
- **Highway Zoom**: scales lane width and perspective depth.
- **Label Mode**: Buttons only / Pitch only / Both.
- **Input HUD**: Compact or Full.
