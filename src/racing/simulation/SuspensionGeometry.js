import { clamp } from './SimulationMath.js';

const RAD = Math.PI / 180;
const q = (v) => Number((Number(v) || 0).toFixed(6));
const DEFAULTS = Object.freeze({
  macpherson: { camberGainDegPerM: -12, toeGainDegPerM: 0.8, motionRatio: 1, rollCenterHeightM: 0.12 },
  'double-wishbone': { camberGainDegPerM: -20, toeGainDegPerM: 0.35, motionRatio: 0.82, rollCenterHeightM: 0.09 },
  multilink: { camberGainDegPerM: -16, toeGainDegPerM: 1.2, motionRatio: 0.88, rollCenterHeightM: 0.11 },
  'trailing-arm': { camberGainDegPerM: -4, toeGainDegPerM: 0.2, motionRatio: 0.96, rollCenterHeightM: 0.18 },
  'solid-axle': { camberGainDegPerM: 0, toeGainDegPerM: 0, motionRatio: 1, rollCenterHeightM: 0.3 }
});

export function normalizeSuspensionDefinition(value = {}, fallbackType = 'macpherson') {
  const type = String(value.type || fallbackType).toLowerCase();
  const base = DEFAULTS[type] || DEFAULTS.macpherson;
  return Object.freeze({
    type: DEFAULTS[type] ? type : 'macpherson',
    hardpoints: value.hardpoints || null,
    camberGainRadPerM: Number(value.camberGainRadPerM ?? Number(value.camberGainDegPerM ?? base.camberGainDegPerM) * RAD),
    toeGainRadPerM: Number(value.toeGainRadPerM ?? Number(value.toeGainDegPerM ?? base.toeGainDegPerM) * RAD),
    casterRad: Number(value.casterRad ?? Number(value.casterDeg ?? 6) * RAD),
    kingpinInclinationRad: Number(value.kingpinInclinationRad ?? Number(value.kingpinInclinationDeg ?? 12) * RAD),
    scrubRadiusM: Number(value.scrubRadiusM ?? 0.035),
    mechanicalTrailM: Number(value.mechanicalTrailM ?? 0.045),
    rollCenterHeightM: Number(value.rollCenterHeightM ?? base.rollCenterHeightM),
    rollCenterGain: Number(value.rollCenterGain ?? 0.12),
    motionRatio: clamp(Number(value.motionRatio ?? base.motionRatio), 0.35, 1.5),
    antiDive: clamp(Number(value.antiDive ?? 0), 0, 1),
    antiSquat: clamp(Number(value.antiSquat ?? 0), 0, 1)
  });
}

export function solveSuspensionGeometry({ definition = {}, compressionM = 0, steeringAngleRad = 0,
  staticCamberRad = 0, staticToeRad = 0, springRateNpm = 30000 } = {}) {
  const d = normalizeSuspensionDefinition(definition);
  const travel = Number(compressionM) || 0;
  const bumpSteerRad = d.toeGainRadPerM * travel;
  const motionRatio = clamp(d.motionRatio * (1 - Math.abs(travel) * 0.08), 0.3, 1.5);
  return {
    type: d.type,
    camberRad: q(staticCamberRad + d.camberGainRadPerM * travel),
    toeRad: q(staticToeRad + bumpSteerRad),
    bumpSteerRad: q(bumpSteerRad),
    casterRad: q(d.casterRad),
    kingpinInclinationRad: q(d.kingpinInclinationRad),
    scrubRadiusM: q(d.scrubRadiusM),
    mechanicalTrailM: q(d.mechanicalTrailM + Math.tan(d.casterRad) * 0.01),
    rollCenterHeightM: q(d.rollCenterHeightM + travel * d.rollCenterGain),
    motionRatio: q(motionRatio),
    antiDive: q(d.antiDive),
    antiSquat: q(d.antiSquat),
    wheelRateNpm: q(Number(springRateNpm) * motionRatio * motionRatio),
    steeringAxisTrailMomentArmM: q(d.mechanicalTrailM + d.scrubRadiusM * Math.sin(steeringAngleRad))
  };
}
