export const PEDAL_COLORS = {
  red: '#d64a43',
  green: '#58b96d',
  purple: '#8b68d9',
  yellow: '#d8bb49',
  blue: '#4a8fd8',
  orange: '#d58b3f'
};

export const PEDAL_DEFINITIONS = [
  {
    type: 'octave',
    name: 'Bone Twin',
    color: 'yellow',
    description: 'Adds spooky octave doubles above and below.',
    knobs: [
      { key: 'up', label: 'Up', min: 0, max: 2, step: 1, defaultValue: 1 },
      { key: 'down', label: 'Down', min: 0, max: 2, step: 1, defaultValue: 0 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.75 },
      { key: 'tightness', label: 'Tight', min: 0, max: 1, step: 0.01, defaultValue: 0.2 }
    ]
  },
  { type: 'compressor', name: 'Neck Snapper', color: 'blue', description: 'Tames peaks and boosts ghosts.', knobs: [
    { key: 'threshold', label: 'Thresh', min: 0, max: 1, step: 0.01, defaultValue: 0.55 },
    { key: 'ratio', label: 'Ratio', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
    { key: 'makeup', label: 'Makeup', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'punch', label: 'Punch', min: 0, max: 1, step: 0.01, defaultValue: 0.25 }
  ] },
  { type: 'wah', name: 'Toad Funk', color: 'green', description: 'Animated filter sweeps via CC74.', knobs: [
    { key: 'sweep', label: 'Sweep', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
    { key: 'q', label: 'Q', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'rate', label: 'Rate', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.7 }
  ] },
  { type: 'chorus', name: 'Ghost Choir', color: 'purple', description: 'Subtle doubles and drift.', knobs: [
    { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, defaultValue: 0.4 },
    { key: 'spread', label: 'Spread', min: 0, max: 1, step: 0.01, defaultValue: 0.35 },
    { key: 'drift', label: 'Drift', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.6 }
  ] },
  { type: 'eq', name: 'Rust Dial', color: 'orange', description: 'MIDI tone-shaping with velocity and filter CC.', knobs: [
    { key: 'low', label: 'Low', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'mid', label: 'Mid', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'high', label: 'High', min: 0, max: 1, step: 0.01, defaultValue: 0.55 },
    { key: 'presence', label: 'Pres', min: 0, max: 1, step: 0.01, defaultValue: 0.45 }
  ] },
  { type: 'overdrive', name: 'Grime Lord', color: 'red', description: 'Aggressive velocity and bite shaping.', knobs: [
    { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'bite', label: 'Bite', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.7 }
  ] },
  { type: 'reverb', name: 'Coffin Air', color: 'blue', description: 'Reverb/send style CC generation.', knobs: [
    { key: 'room', label: 'Room', min: 0, max: 1, step: 0.01, defaultValue: 0.45 },
    { key: 'decay', label: 'Decay', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'dampen', label: 'Dampen', min: 0, max: 1, step: 0.01, defaultValue: 0.4 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.55 }
  ] },
  { type: 'phaser', name: 'Skull Sweep', color: 'purple', description: 'Moving modulation CC curves.', knobs: [
    { key: 'rate', label: 'Rate', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, defaultValue: 0.55 },
    { key: 'sweep', label: 'Sweep', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
    { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, defaultValue: 0.65 }
  ] }
];

export const PEDAL_DEFINITION_BY_TYPE = Object.fromEntries(PEDAL_DEFINITIONS.map((def) => [def.type, def]));
