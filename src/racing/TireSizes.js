// Axle sizes opt in to nominal geometry. Legacy cars retain authored tuning radius.
export function tireSizeForWheel(setup = {}, wheelId = 'fl') {
  const axle = wheelId.startsWith('f') ? 'front' : 'rear';
  return { ...setup.tireSize, ...setup.tireSizeByAxle?.[axle] };
}
export function tireRadiusM(size = {}, fallback = .337) {
  const w = Number(size.widthMm), a = Number(size.aspectRatio), d = Number(size.wheelDiameterIn);
  return Number.isFinite(w + a + d) && w >= 125 && w <= 405 && a >= 20 && a <= 90 && d >= 10 && d <= 26
    ? d * .0254 / 2 + w * a / 100000 : fallback;
}
export function axleTireGeometry(setup = {}, tuning = {}) {
  if (!setup.tireSizeByAxle || !['front', 'rear'].some(a => setup.tireSizeByAxle[a])) return {};
  const wheelRadiusByWheelM = {}, wheelWidthByWheelM = {};
  for (const id of ['fl', 'fr', 'rl', 'rr']) {
    const size = tireSizeForWheel(setup, id);
    wheelRadiusByWheelM[id] = tireRadiusM(size, Number(tuning.wheelRadiusM) || .337);
    wheelWidthByWheelM[id] = Math.max(.125, Math.min(.405, Number(size.widthMm) / 1000 || .245));
  }
  const drive = String(tuning.drivetrain || 'awd').toLowerCase();
  // Equivalent radius for legacy scalar powertrain calculations; contact solver uses each wheel.
  const ids = drive === 'fwd' ? ['fl', 'fr'] : drive === 'rwd' ? ['rl', 'rr'] : ['fl', 'fr', 'rl', 'rr'];
  const wheelRadiusM = ids.length / ids.reduce((s, id) => s + 1 / wheelRadiusByWheelM[id], 0);
  return { wheelRadiusM, wheelRadiusByWheelM, wheelWidthByWheelM };
}
// Converted historical saves may deliberately opt into measured stock stagger.
// Garage-selected axle sizes override this fallback, and the existing scalar
// stays available for powertrain calculations not modeled by each contact.
export function authoredStockAxleGeometry(tuning = {}) {
  if (tuning.physics?.useAuthoredStockAxleRadii !== true) return {};
  const source = tuning.wheelRadiusByWheelM;
  if (!source || !['fl', 'fr', 'rl', 'rr'].every(id =>
    typeof source[id] === 'number' && Number.isFinite(source[id])
      && source[id] >= .18 && source[id] <= .82)) return {};
  if (Math.abs(source.fl - source.fr) > .0005 || Math.abs(source.rl - source.rr) > .0005
      || Math.abs(source.fl - source.rl) > .085) return {};
  return { wheelRadiusByWheelM: { fl: source.fl, fr: source.fr, rl: source.rl, rr: source.rr } };
}
export function wheelRadiusFor(config = {}, id) {
  const radius = Number(config.wheelRadiusByWheelM?.[id]);
  if (Number.isFinite(radius) && radius > 0) return radius;
  const scalar = Number(config.wheelRadiusM);
  return Number.isFinite(scalar) && scalar > 0 ? scalar : .337;
}
