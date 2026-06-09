export const PEDAL_COLORS = {
  red: '#d64a43',
  green: '#58b96d',
  purple: '#8b68d9',
  yellow: '#d8bb49',
  blue: '#4a8fd8',
  orange: '#d58b3f'
};

export const PEDAL_FONTS = {
  octave: 'bold 12px Georgia',
  compressor: 'bold 12px Trebuchet MS',
  wah: 'bold 12px Verdana',
  chorus: 'bold 12px Times New Roman',
  eq: 'bold 12px Arial',
  overdrive: 'bold 12px Impact',
  reverb: 'bold 12px Palatino',
  phaser: 'bold 12px Courier New',
  pitchPhaser: 'bold 12px Garamond',
  volumePhaser: 'bold 12px Tahoma',
  panPhaser: 'bold 12px Lucida Console',
  echo: 'bold 12px Comic Sans MS',
  studioEq: 'bold 12px Arial',
  tape: 'bold 12px Trebuchet MS',
  limiter: 'bold 12px Verdana'
};

export const PEDAL_DEFINITIONS = [
  {
    type: 'octave',
    name: 'Bone Twin',
    effectLabel: 'Octave',
    color: 'yellow',
    description: 'Adds spooky octave doubles above and below.',
    knobs: [
      { key: 'up', label: 'Up', min: 0, max: 2, step: 1, defaultValue: 1 },
      { key: 'down', label: 'Down', min: 0, max: 2, step: 1, defaultValue: 0 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.75 }
    ]
  },
  {
    type: 'compressor',
    name: 'Neck Snapper',
    effectLabel: 'Compressor',
    color: 'blue',
    description: 'Tames peaks and boosts ghosts.',
    knobs: [
      { key: 'threshold', label: 'Thresh', min: 0, max: 1, step: 0.01, defaultValue: 0.42 },
      { key: 'ratio', label: 'Ratio', min: 0, max: 1, step: 0.01, defaultValue: 0.45 },
      { key: 'makeup', label: 'Makeup', min: 0, max: 1, step: 0.01, defaultValue: 0.32 }
    ]
  },
  {
    type: 'wah',
    name: 'Toad Funk',
    effectLabel: 'Auto-Wah',
    color: 'green',
    description: 'Animated filter sweeps via CC74.',
    knobs: [
      { key: 'sweep', label: 'Sweep', min: 0, max: 1, step: 0.01, defaultValue: 0.48 },
      { key: 'rate', label: 'Rate', min: 0, max: 1, step: 0.01, defaultValue: 0.38 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.48 }
    ]
  },
  {
    type: 'chorus',
    name: 'Ghost Choir',
    effectLabel: 'Chorus',
    color: 'purple',
    description: 'Subtle doubles and drift.',
    knobs: [
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, defaultValue: 0.38 },
      { key: 'spread', label: 'Spread', min: 0, max: 1, step: 0.01, defaultValue: 0.36 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.42 }
    ]
  },
  {
    type: 'eq',
    name: 'Rust Dial',
    effectLabel: 'Tone EQ',
    color: 'orange',
    description: 'MIDI tone-shaping with velocity and filter CC.',
    knobs: [
      { key: 'low', label: 'Low', min: 0, max: 1, step: 0.01, defaultValue: 0.52 },
      { key: 'mid', label: 'Mid', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
      { key: 'high', label: 'High', min: 0, max: 1, step: 0.01, defaultValue: 0.54 },
      { key: 'presence', label: 'Presence', min: 0, max: 1, step: 0.01, defaultValue: 0.52 }
    ]
  },
  {
    type: 'overdrive',
    name: 'Ghost Drive',
    effectLabel: 'Overdrive',
    color: 'red',
    description: 'Aggressive velocity and bite shaping.',
    knobs: [
      { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, defaultValue: 0.42 },
      { key: 'bite', label: 'Bite', min: 0, max: 1, step: 0.01, defaultValue: 0.4 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, defaultValue: 0.55 }
    ]
  },
  {
    type: 'reverb',
    name: 'Coffin Air',
    effectLabel: 'Reverb',
    color: 'blue',
    description: 'Reverb/send style CC generation.',
    knobs: [
      { key: 'room', label: 'Room', min: 0, max: 1, step: 0.01, defaultValue: 0.45 },
      { key: 'decay', label: 'Decay', min: 0, max: 1, step: 0.01, defaultValue: 0.44 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.34 }
    ]
  },
  {
    type: 'phaser',
    name: 'Skull Sweep',
    effectLabel: 'Phaser',
    color: 'purple',
    description: 'Moving modulation CC curves.',
    knobs: [
      { key: 'rate', label: 'Rate', min: 0, max: 1, step: 0.01, defaultValue: 0.42 },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, defaultValue: 0.42 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.38 }
    ]
  },
  {
    type: 'pitchPhaser',
    name: 'Pitch Phaser',
    effectLabel: 'Pitch Phase',
    color: 'yellow',
    description: 'Alternates half-step pitch motion over measures.',
    knobs: [
      { key: 'down', label: 'Halfstep-', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
      { key: 'up', label: 'Halfstep+', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
      { key: 'phase', label: 'Measure', min: 0, max: 1, step: 0.01, defaultValue: 0.5 }
    ]
  },
  {
    type: 'volumePhaser',
    name: 'Volume Phaser',
    effectLabel: 'Volume Phase',
    color: 'green',
    description: 'Pulses note velocity by measure phase.',
    knobs: [
      { key: 'down', label: 'Min Vol', min: 0, max: 1, step: 0.01, defaultValue: 0.35 },
      { key: 'up', label: 'Max Vol', min: 0, max: 1, step: 0.01, defaultValue: 0.95 },
      { key: 'phase', label: 'Measure', min: 0, max: 1, step: 0.01, defaultValue: 0.55 }
    ]
  },
  {
    type: 'panPhaser',
    name: 'Pan Phaser',
    effectLabel: 'Pan Phase',
    color: 'blue',
    description: 'Sweeps pan left/right in phase.',
    knobs: [
      { key: 'left', label: 'Max L', min: 0, max: 1, step: 0.01, defaultValue: 0.85 },
      { key: 'right', label: 'Max R', min: 0, max: 1, step: 0.01, defaultValue: 0.85 },
      { key: 'phase', label: 'Phase', min: 0, max: 1, step: 0.01, defaultValue: 0.6 }
    ]
  },
  {
    type: 'echo',
    name: 'Grave Echo',
    effectLabel: 'Echo',
    color: 'orange',
    description: 'Creates note repeats with decay.',
    knobs: [
      { key: 'time', label: 'Time', min: 0, max: 1, step: 0.01, defaultValue: 0.32 },
      { key: 'feedback', label: 'Feedback', min: 0, max: 1, step: 0.01, defaultValue: 0.24 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.34 }
    ]
  },
  {
    type: 'studioEq',
    name: 'Mix Polish',
    effectLabel: 'Studio EQ',
    color: 'blue',
    description: 'Board-ready cleanup with low cut, warmth, presence, and air.',
    knobs: [
      { key: 'lowCut', label: 'Low Cut', min: 0, max: 1, step: 0.01, defaultValue: 0.32 },
      { key: 'warmth', label: 'Warmth', min: 0, max: 1, step: 0.01, defaultValue: 0.52 },
      { key: 'presence', label: 'Presence', min: 0, max: 1, step: 0.01, defaultValue: 0.54 },
      { key: 'air', label: 'Air', min: 0, max: 1, step: 0.01, defaultValue: 0.5 }
    ]
  },
  {
    type: 'tape',
    name: 'Tape Deck',
    effectLabel: 'Tape',
    color: 'orange',
    description: 'Gentle saturation, glue, and tiny pitch movement.',
    knobs: [
      { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, defaultValue: 0.34 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, defaultValue: 0.52 },
      { key: 'wow', label: 'Wow', min: 0, max: 1, step: 0.01, defaultValue: 0.18 }
    ]
  },
  {
    type: 'limiter',
    name: 'Final Guard',
    effectLabel: 'Limiter',
    color: 'red',
    description: 'Final safety stage to catch peaks before output.',
    knobs: [
      { key: 'threshold', label: 'Thresh', min: 0, max: 1, step: 0.01, defaultValue: 0.58 },
      { key: 'ceiling', label: 'Ceiling', min: 0, max: 1, step: 0.01, defaultValue: 0.72 },
      { key: 'release', label: 'Release', min: 0, max: 1, step: 0.01, defaultValue: 0.34 }
    ]
  }
];

export const PEDAL_DEFINITION_BY_TYPE = Object.fromEntries(PEDAL_DEFINITIONS.map((def) => [def.type, def]));
