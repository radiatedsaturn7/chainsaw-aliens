export const INSTRUMENTS = ['guitar', 'bass', 'piano', 'drums'];

export const MODE_LIBRARY = [
  { name: 'Ionian', steps: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'Aeolian', steps: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10] }
];

export const ROOT_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SETS = [
  {
    id: 'warm-up',
    title: 'Warm Up - The Neon Launchers',
    tier: 1,
    songs: [
      { name: 'Booster Alley', instrument: 'guitar', hint: 'Power chords on 1/4/5, steady downbeats.' },
      { name: 'Servo Sparks', instrument: 'bass', hint: 'Mostly B power chords, widen the degrees.' },
      { name: 'Idle Engines', instrument: 'guitar', hint: 'More root movement, still straight rhythms.' },
      { name: 'Runway Echo', instrument: 'piano', hint: 'Chords on the beat, simple turnarounds.' },
      { name: 'Launch Loop', instrument: 'guitar', hint: 'Tight power chord groove, no syncopation.' }
    ]
  },
  {
    id: 'openers',
    title: 'Openers - Chrome Static',
    tier: 2,
    songs: [
      { name: 'Voltage Parade', instrument: 'guitar', hint: 'Power chords with A/X/Y variations.' },
      { name: 'Crowd Circuit', instrument: 'bass', hint: 'More degrees, steadier pulse.' },
      { name: 'Pulse Check', instrument: 'piano', hint: 'Add chord inversions on the chorus.' },
      { name: 'Glow Stage', instrument: 'guitar', hint: 'Chords move faster between sections.' },
      { name: 'Skywire Intro', instrument: 'guitar', hint: 'Rhythms loosen, still no heavy syncopation.' }
    ]
  },
  {
    id: 'headliners-i',
    title: 'Headliners I - Rift Sirens',
    tier: 3,
    songs: [
      { name: 'Signal Flare', instrument: 'guitar', hint: 'First note phrases between chord hits.' },
      { name: 'Lumen Drive', instrument: 'bass', hint: 'Alternate riff notes and chord stabs.' },
      { name: 'Phase Shift', instrument: 'piano', hint: 'Note mode runs with chord anchors.' },
      { name: 'Arc Run', instrument: 'guitar', hint: 'RB octave-up accents appear.' },
      { name: 'Anchor Break', instrument: 'guitar', hint: 'Notes and chords trade every bar.' }
    ]
  },
  {
    id: 'headliners-ii',
    title: 'Headliners II - The Cold Orbiters',
    tier: 4,
    songs: [
      { name: 'Solar Rail', instrument: 'guitar', hint: 'LB sus modifiers enter chord mode.' },
      { name: 'Echo Market', instrument: 'piano', hint: 'Add9/sus chords on the turnaround.' },
      { name: 'Silent Orbit', instrument: 'bass', hint: 'Groove with diatonic 7ths.' },
      { name: 'Tidal Shift', instrument: 'guitar', hint: 'Chord modifiers on the chorus.' },
      { name: 'Neon Drift', instrument: 'guitar', hint: 'Still clean harmony, no tension yet.' }
    ]
  },
  {
    id: 'after-hours',
    title: 'After Hours - Hollow Flares',
    tier: 5,
    songs: [
      { name: 'Midnight Coil', instrument: 'guitar', hint: 'D-Left tension chords in controlled spots.' },
      { name: 'Velvet Shock', instrument: 'piano', hint: 'More syncopation with altered dominants.' },
      { name: 'Circuit Noir', instrument: 'bass', hint: 'Denser rhythms, sharper color.' },
      { name: 'Ghost Signal', instrument: 'guitar', hint: 'Passing notes weave between chords.' },
      { name: 'Afterglow Run', instrument: 'guitar', hint: 'Watch for quicker chord changes.' }
    ]
  },
  {
    id: 'deep-cut',
    title: 'Deep Cut - Obsidian Vice',
    tier: 6,
    songs: [
      { name: 'Blackout Bloom', instrument: 'guitar', hint: 'LB + D-Left dark jazz layers.' },
      { name: 'Gravity Lace', instrument: 'piano', hint: 'Passing chords with quick pivots.' },
      { name: 'Quasar Fever', instrument: 'bass', hint: 'Approach chords and deeper syncopation.' },
      { name: 'Mirage Breaker', instrument: 'guitar', hint: 'Faster changes, hold your groove.' },
      { name: 'Late Signal', instrument: 'guitar', hint: 'Dense patterns, keep the pulse locked.' }
    ]
  },
  {
    id: 'finale',
    title: 'Finale - Hyperion Youth',
    tier: 7,
    songs: [
      { name: 'Final Horizon', instrument: 'guitar', hint: 'Mode change possible mid-song.' },
      { name: 'Radiant Collapse', instrument: 'piano', hint: 'Mixed note + chord phrases.' },
      { name: 'Solar Strike', instrument: 'bass', hint: 'Highest density with fair patterns.' },
      { name: 'Starline Echo', instrument: 'guitar', hint: 'Watch for scale shift prompts.' },
      { name: 'Neon Oblivion', instrument: 'guitar', hint: 'Technical finale with everything combined.' }
    ]
  }
];

export const DIFFICULTY_WINDOWS = [
  { tier: 1, great: 0.1, good: 0.2 },
  { tier: 2, great: 0.095, good: 0.19 },
  { tier: 3, great: 0.09, good: 0.18 },
  { tier: 4, great: 0.085, good: 0.17 },
  { tier: 5, great: 0.08, good: 0.16 },
  { tier: 6, great: 0.075, good: 0.15 },
  { tier: 7, great: 0.07, good: 0.14 }
];

export const LANE_LABELS = ['A', 'X', 'Y', 'B'];
export const DRUM_LANES = ['Kick', 'Snare', 'Hat', 'Cymbal'];

export const GRADE_THRESHOLDS = [
  { grade: 'S', min: 0.98 },
  { grade: 'A', min: 0.94 },
  { grade: 'B', min: 0.88 },
  { grade: 'C', min: 0.8 },
  { grade: 'D', min: 0.7 }
];
