import { PEDAL_DEFINITION_BY_TYPE } from './pedalDefinitions.js';
import { createDefaultPedal } from './pedalDefaults.js';

const SLOT_COUNT = 4;

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

export const EMPTY_MIDI_PEDALS = Object.freeze([null, null, null, null]);
