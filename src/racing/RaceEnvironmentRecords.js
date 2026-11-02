// Every overlay field is assigned by the caller immediately after copying the
// source record. Keeping those slots avoids deleting/recreating them at each
// fixed step, including when a wheel moves between a Track State cell and null.
export const RACE_MATERIAL_OVERLAY_KEYS = new Set([
  'baseSurfaceId', 'surfaceId', 'effectiveGrip', 'effectiveGripMultiplier',
  'surfaceGripScale', 'grip', 'trackStateConditionApplied'
]);

export const RACE_TIRE_OVERLAY_KEYS = new Set([
  'temperatureF', 'treadTemperatureC', 'carcassTemperatureC',
  'internalAirTemperatureC', 'effectivePressurePsi', 'pressurePsi', 'wear',
  'damage', 'rollingResistanceCoefficient'
]);

// This updates an already-owned scratch record; it never changes its lifetime
// or creates a shared record. RaceSimulation retains its per-authority eight-slot
// ring, and nested source values retain the previous shallow-copy semantics.
export function updateRaceEnvironmentRecord(target, source, overlayKeys = null) {
  const prototype = source && Object.getPrototypeOf(source);
  if (source && prototype !== Object.prototype && prototype !== null) {
    // Noncanonical adapters may expose enumerable inherited fields. Preserve
    // their original delete/copy contract rather than treating them as cells.
    for (const key in target) delete target[key];
    for (const key in source) target[key] = source[key];
    return target;
  }
  for (const key in target) {
    if (overlayKeys?.has(key)) continue;
    if (source && Object.prototype.propertyIsEnumerable.call(source, key)) continue;
    delete target[key];
  }
  if (source) {
    for (const key in source) target[key] = source[key];
  }
  return target;
}
