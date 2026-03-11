import { PEDAL_DEFINITION_BY_TYPE } from './pedalDefinitions.js';
import { createDefaultPedal } from './pedalDefaults.js';

const SLOT_COUNT = 4;

export const PEDAL_SIGNAL_CHAIN_ORDER = Object.freeze([
  'compressor',
  'octave',
  'overdrive',
  'eq',
  'wah',
  'phaser',
  'chorus',
  'pitchPhaser',
  'panPhaser',
  'volumePhaser',
  'echo',
  'reverb'
]);

const pedalSignalOrderIndex = (type) => {
  const index = PEDAL_SIGNAL_CHAIN_ORDER.indexOf(type);
  return index === -1 ? PEDAL_SIGNAL_CHAIN_ORDER.length : index;
};

export const normalizeMidiPedals = (input) => {
  const source = Array.isArray(input) ? input : [];
  const slots = new Array(SLOT_COUNT).fill(null);
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const pedal = source[i];
    if (!pedal || typeof pedal !== 'object') continue;
    const def = PEDAL_DEFINITION_BY_TYPE[pedal.type];
    if (!def) continue;
    const fallback = createDefaultPedal(def.type);
    slots[i] = {
      ...fallback,
      id: pedal.id || fallback.id,
      name: pedal.name || def.name,
      color: pedal.color || def.color,
      enabled: pedal.enabled !== false,
      knobs: {
        ...fallback.knobs,
        ...(pedal.knobs && typeof pedal.knobs === 'object' ? pedal.knobs : {})
      }
    };
  }
  return slots;
};

export const sortMidiPedalsBySignalChain = (input) => {
  const normalized = normalizeMidiPedals(input);
  const sorted = normalized
    .filter(Boolean)
    .sort((a, b) => pedalSignalOrderIndex(a.type) - pedalSignalOrderIndex(b.type));
  const slots = new Array(SLOT_COUNT).fill(null);
  for (let i = 0; i < Math.min(SLOT_COUNT, sorted.length); i += 1) {
    slots[i] = sorted[i];
  }
  return slots;
};

export const EMPTY_MIDI_PEDALS = Object.freeze([null, null, null, null]);
