# Robterspiel Controller Mapping

Robterspiel is the live gamepad performance layout used by the MIDI editor’s record mode. This document describes the expected behavior for note mode and chord mode so input changes don’t drift between releases.

## Global Controls
- **Left Stick**: selects the active scale degree (1–8). Stick up is degree **1**. Stick down selects **5** in the current scale (G in C major).
- **Right Stick**: whammy/pitch bend (always active).
- **Left Trigger (LT)**: sustain (hold for long sustain).
- **Right Trigger (RT)**: volume (fully pressed = silence).
- **D-pad Up/Down**: octave up/down.
- **D-pad Right**: toggle Note Mode ↔ Chord Mode.
- **L3**: open scale-mode selector (major modes: Ionian, Dorian, Phrygian, etc.). This always updates the gamepad scale degrees.
- **R3**: open scale-root selector (choose any of the 12 chromatic roots).

## Note Mode (examples in C major)

Primary notes (scale tones):
- **A = 1** (C)
- **X = 3** (E)
- **Y = 5** (G)
- **B = 8** (C, octave)

Passing notes (hold **LB**):
- **A = 2** (D)
- **X = 4** (F)
- **Y = 6** (A)
- **B = 7** (B)

Sharpen notes (hold **D-pad Left**):
- **A = 1♯**
- **X = 3♯**
- **Y = 5♯**
- **B = 8♯**
- **LB + A = 2♯**
- **LB + X = 4♯**
- **LB + Y = 6♯**
- **LB + B = 7♯**

Additional note modifiers:
- **RB**: octave up (global, applies after choosing the note).
- **Tritone (F#)**: use the right-stick bend to reach it.

## Chord Mode

Base chords:
- **A**: Major triad (root position).
- **X**: Major triad, 1st inversion.
- **Y**: Major triad, 2nd inversion.
- **B**: Power chord.

Chord modifiers:
- **LB + A**: Sus2 (replace the 3rd with the diatonic 2).
- **LB + X**: Sus4 (replace the 3rd with the diatonic 4).
- **LB + Y**: Diatonic 7th (context-aware).
- **LB + B**: add 9th (add the diatonic 2 an octave up).
- **D-pad Left + A**: Diminished triad.
- **D-pad Left + X**: Half-diminished (m7♭5).
- **D-pad Left + Y**: Augmented triad.
- **D-pad Left + B**: Altered dominant (auto-select 7♭9 or 7♯9).
- **LB + D-pad Left + A**: Minor 6.
- **LB + D-pad Left + X**: Diminished 7.
- **LB + D-pad Left + Y**: Augmented major 7.
- **LB + D-pad Left + B**: Minor 9♭5.

Chords are built from **scale steps**, not fixed chromatic intervals, so every modifier stays context-aware.

### Why RB Does Not Affect Harmony
RB is a **global octave-up performance modifier**. It applies identically in note mode and chord mode by shifting the chosen pitches up an octave **after** the chord or note is built. RB never selects chord types or alters chord qualities, so harmony decisions remain exclusively on LB and D-pad Left.

### Why the 7th Changes by Scale Degree
The LB + Y chord is a **diatonic 7th**, meaning the 7th is pulled from the active scale instead of forced to be a dominant 7th. This keeps the harmony aligned with the mode and degree:
- Degree 1 → Cmaj7
- Degree 2 → Dm7
- Degree 3 → Em7
- Degree 4 → Fmaj7
- Degree 5 → G7
- Degree 6 → Am7
- Degree 7 → Bm7♭5
