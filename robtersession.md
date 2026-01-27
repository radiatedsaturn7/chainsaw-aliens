# RobterSESSION — Rhythm Training Mode

RobterSESSION is a Rock Band–style trainer minigame built into Chainsaw Aliens. It generates songs deterministically from their names and teaches Robterspiel input through a scrolling lane gameplay loop.

## Flow
Main Menu → RobterSESSION → Setlist → Song Detail → Set Scale → Play → Results → Setlist.

## Setlist & Progress
- 7 sets × 5 songs, each with a themed “band” set title.
- Sets unlock sequentially.
- Best score, accuracy, and grade are saved in localStorage.
- A **Random Song** entry creates a deterministic song from a stored random seed.

## Controls
RobterSESSION follows the Robterspiel controller layout.

### Gamepad (Robterspiel)
- **Left Stick**: choose scale degree (1–8).
- **A / X / Y / B**: play notes or chords (depends on Note/Chord mode).
- **D-pad Right**: toggle Note Mode ↔ Chord Mode.
- **LB**: harmony modifier (passing notes / sus/7/add9).
- **D-pad Left**: sharp/tension modifier.
- **RB**: global octave-up performance modifier.
- **D-pad Up/Down**: octave shift.
- **Start**: pause menu.
- **Back**: activate Star Power (only while in Robtergroove and meter > 0).

### Keyboard (Fallback)
- **WASD / Arrow Keys**: choose scale degree (8-directional).
- **J / U / I / K**: map to **A / X / Y / B**.
- **Tab**: toggle Note Mode ↔ Chord Mode.
- **Q**: LB modifier.
- **E**: D-pad Left modifier.
- **R**: RB octave-up modifier.
- **1 / 2**: octave up/down.
- **Esc**: pause menu.
- **Backspace**: Star Power.

## Scoring & Groove
- **Great** and **Good** timing windows scale with difficulty.
- Build a streak to enter **Robtergroove** (visualized by a blue measure bar).
- **Star Power** fills during special phrase sections and can be activated while in Robtergroove.
- Star Power doubles score while active.

## Deterministic Generation
- Song name → stable hash → deterministic RNG.
- The RNG selects:
  - Root + mode for the Set Scale screen.
  - Tempo range and target BPM.
  - Section structure (verse/chorus/bridge/solo).
  - Harmonic progressions and rhythmic density.
  - Notes vs chords and Robterspiel modifiers based on difficulty tier.

## Instruments
- **Guitar / Bass**: riff-forward, chord hits.
- **Piano**: chord-focused with occasional arpeggios.
- **Drums**: 4-lane GM-style pattern (kick/snare/hat/cymbal).

## Debug
- When running on `localhost`, press **H** to toggle a debug overlay showing upcoming input descriptors.
