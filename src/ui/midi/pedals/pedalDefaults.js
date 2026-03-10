import { PEDAL_DEFINITION_BY_TYPE } from './pedalDefinitions.js';

const uid = () => `pedal_${Math.random().toString(36).slice(2, 9)}`;

export const createDefaultPedal = (type) => {
  const def = PEDAL_DEFINITION_BY_TYPE[type];
  if (!def) return null;
  return {
    id: uid(),
    type: def.type,
    name: def.name,
    color: def.color,
    enabled: true,
    knobs: Object.fromEntries(def.knobs.map((knob) => [knob.key, knob.defaultValue]))
  };
};
