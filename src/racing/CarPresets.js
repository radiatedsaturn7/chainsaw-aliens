import awd from '../../data/system/car-presets/awd.json' with { type: 'json' };
import rwd from '../../data/system/car-presets/rwd.json' with { type: 'json' };
import fwd from '../../data/system/car-presets/fwd.json' with { type: 'json' };

// System documents live outside project storage and are never registered in its
// manifest. Loading a preset creates a separate, unsaved user document.
const documents = { awd, rwd, fwd };
export const CAR_PRESETS = Object.freeze(Object.entries(documents).map(([id, document]) =>
  Object.freeze({ id, label: document.car.name })
));

export function createCarFromPreset(id) {
  const document = documents[id];
  if (!document) throw new Error('Unknown car preset');
  const car = structuredClone(document.car);
  car.__editorDraft = true;
  return car;
}

export function isUserRaceCar(car) {
  return Boolean(car) && car.systemFile !== true && car.__systemPreset !== true && car.__editorDraft !== true;
}
