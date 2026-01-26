# Robterspiel Controller Mapping

Robterspiel is the live gamepad performance layout used by the MIDI editor’s record mode. This document describes the expected behavior for note mode and chord mode so input changes don’t drift between releases.

## Global Controls
- **Left Stick**: selects the active scale degree (1–8). Stick up is degree **1**. Stick down selects **5** in the current scale (G in C major).
- **Right Stick**: whammy/pitch bend (always active).
- **Left Trigger (LT)**: sustain (hold for long sustain).
- **Right Trigger (RT)**: volume (fully pressed = silence).
- **D-pad Up/Down**: octave up/down.
- **D-pad Right**: toggle Note Mode ↔ Chord Mode.
- **L3**: open scale-mode selector (major modes: Ionian, Dorian, Phrygian, etc.).
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

Non-scale notes (hold **D-pad Left**):
- **A = 2♭** (C# / Db)
- **X = 3♭** (D# / Eb)
- **Y = 6♭** (G# / Ab)
- **B = 7♭** (A# / Bb)

Additional note modifiers:
- **RB**: octave up for the played note.
- **Tritone (F#)**: use the right-stick bend to reach it.

## Chord Mode

Base chords (D-pad Left **not** held):
- **A**: Major triad (root position).
- **X**: Major triad, 1st inversion.
- **Y**: Major triad, 2nd inversion.
- **B**: Power chord.

Chord modifiers:
- **LB**: add 9th.
- **RB**: octave up (shift the chord up an octave).

Uncommon chords (hold **D-pad Left**):
- **A**: Sus2.
- **B**: Sus4.
- **X**: 7th (dominant).
- **Y**: Diminished.
