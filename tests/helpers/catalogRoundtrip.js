// Explicit legacy schema migration for assertions, not the runtime normalizer.
// Keep a full-car deep equality check: only these seven previously absent gauge
// fields may be added. Authored values (including false, zero and null) win.
export function withLegacyGaugeDefaults(car) {
  const expected = structuredClone(car);
  const defaults = {opacity: 1, damageArtTint: false, fuelIconAngle: null,
    fuelIconOffsetX: 0, fuelIconOffsetY: 0, fuelIconScale: 1, highBeamArtRef: ''};
  for (const scope of ['interior', 'exterior']) {
    for (const widget of expected.art?.gauges?.[scope]?.widgets || []) {
      for (const [key, value] of Object.entries(defaults)) {
        if (!Object.hasOwn(widget, key)) widget[key] = value;
      }
    }
  }
  return expected;
}
