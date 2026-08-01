import { clamp } from './SimulationMath.js';

const q = (value, precision = 6) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(precision)) : 0;
};
const fahrenheitToCelsius = (value) => (Number(value) - 32) * 5 / 9;
const celsiusToFahrenheit = (value) => Number(value) * 9 / 5 + 32;

export function createTireThermalState(previous = {}, tire = {}, ambientTemperatureC = 21) {
  const legacyTemperatureC = fahrenheitToCelsius(previous.temperatureF ?? 70);
  const treadTemperatureC = Number(previous.treadTemperatureC ?? legacyTemperatureC);
  const carcassTemperatureC = Number(previous.carcassTemperatureC ?? treadTemperatureC);
  const internalAirTemperatureC = Number(previous.internalAirTemperatureC ?? carcassTemperatureC);
  const coldPressurePsi = Number(previous.coldPressurePsi ?? tire.coldPressurePsi
    ?? tire.pressurePsi ?? tire.targetPressurePsi ?? 32);
  return {
    treadTemperatureC: q(treadTemperatureC),
    carcassTemperatureC: q(carcassTemperatureC),
    internalAirTemperatureC: q(internalAirTemperatureC),
    coldPressurePsi: q(coldPressurePsi),
    pressureReferenceTemperatureC: q(Number(previous.pressureReferenceTemperatureC ?? ambientTemperatureC))
  };
}

export function advanceTireThermalState({
  previous = {},
  tire = {},
  patch = {},
  material = {},
  ambientTemperatureC = 21,
  dt = 0
} = {}) {
  const state = createTireThermalState(previous, tire, ambientTemperatureC);
  const seconds = Math.max(0, Number(dt) || 0);
  const treadMassKg = clamp(Number(tire.treadThermalMassKg ?? 3.4), 1.2, 8);
  const carcassMassKg = clamp(Number(tire.carcassThermalMassKg ?? 6.8), 2.5, 14);
  const airHeatCapacityJPerC = clamp(Number(tire.airHeatCapacityJPerC ?? 1100), 400, 2600);
  const treadHeatCapacity = treadMassKg * 1650;
  const carcassHeatCapacity = carcassMassKg * 1500;
  const speedMps = Math.hypot(
    Number(patch.longitudinalVelocityMps || 0),
    Number(patch.lateralVelocityMps || 0)
  );
  const rollingSurfaceSpeed = Number(patch.wheelAngularVelocityRadps || 0)
    * Number(patch.effectiveRollingRadiusM || 0);
  const longitudinalSlipSpeed = rollingSurfaceSpeed - Number(patch.longitudinalVelocityMps || 0);
  const longitudinalWorkW = Math.abs(Number(patch.longitudinalForceN || 0) * longitudinalSlipSpeed);
  const lateralWorkW = Math.abs(Number(patch.lateralForceN || 0) * Number(patch.lateralVelocityMps || 0));
  const frictionHeatingW = (longitudinalWorkW + lateralWorkW) * 0.78;
  const loadN = Math.max(0, Number(patch.suspensionNormalLoadN ?? patch.normalLoadN ?? 0));
  const loadHeatingW = loadN * speedMps * 0.0028;
  const flexHeatingW = loadN * Math.abs(Number(patch.slipRatio || 0)) * 0.34
    + loadN * Math.abs(Number(patch.slipAngleRad || 0)) * 0.42;
  const surfaceTemperatureC = Number(material.surfaceTemperatureC ?? ambientTemperatureC);
  const waterDepthMm = Math.max(0, Number(material.standingWaterDepthMm || 0));
  const snowDepthMm = Math.max(0, Number(material.snowDepthMm || 0));
  const iceDepthMm = Math.max(0, Number(material.iceDepthMm || 0));
  const contactScale = loadN > 1 ? 1 : 0;
  const surfaceConductanceWPerC = contactScale * (32 + Math.min(90, loadN / 55));
  const treadCarcassConductanceWPerC = 38;
  const carcassAirConductanceWPerC = 16;
  const airflowWPerC = 4.5 + Math.sqrt(speedMps) * 7.5;
  const waterCoolingWPerC = contactScale * clamp(waterDepthMm / 2.5, 0, 1) * (45 + speedMps * 5);
  const frozenCoolingWPerC = contactScale
    * (clamp(snowDepthMm / 25, 0, 1) * 32 + clamp(iceDepthMm / 2, 0, 1) * 48);
  const treadToSurfaceW = (surfaceTemperatureC - state.treadTemperatureC) * surfaceConductanceWPerC;
  const treadToCarcassW = (state.treadTemperatureC - state.carcassTemperatureC) * treadCarcassConductanceWPerC;
  const carcassToAirW = (state.carcassTemperatureC - state.internalAirTemperatureC) * carcassAirConductanceWPerC;
  const ambientCoolingW = (state.treadTemperatureC - ambientTemperatureC)
    * (airflowWPerC + waterCoolingWPerC + frozenCoolingWPerC);
  const nextTreadC = clamp(state.treadTemperatureC + (
    frictionHeatingW + treadToSurfaceW - treadToCarcassW - ambientCoolingW
  ) * seconds / treadHeatCapacity, -45, 230);
  const nextCarcassC = clamp(state.carcassTemperatureC + (
    flexHeatingW + loadHeatingW + treadToCarcassW - carcassToAirW
    - (state.carcassTemperatureC - ambientTemperatureC) * (2.5 + Math.sqrt(speedMps) * 1.3)
  ) * seconds / carcassHeatCapacity, -45, 200);
  const nextAirC = clamp(state.internalAirTemperatureC + (
    carcassToAirW - (state.internalAirTemperatureC - ambientTemperatureC) * 0.65
  ) * seconds / airHeatCapacityJPerC, -45, 180);
  const referenceKelvin = Math.max(180, state.pressureReferenceTemperatureC + 273.15);
  const absoluteColdPsi = state.coldPressurePsi + 14.6959;
  const effectivePressurePsi = clamp(
    absoluteColdPsi * (nextAirC + 273.15) / referenceKelvin - 14.6959,
    8,
    80
  );
  return {
    treadTemperatureC: q(nextTreadC),
    carcassTemperatureC: q(nextCarcassC),
    internalAirTemperatureC: q(nextAirC),
    temperatureF: q(celsiusToFahrenheit(nextTreadC)),
    coldPressurePsi: state.coldPressurePsi,
    pressureReferenceTemperatureC: state.pressureReferenceTemperatureC,
    effectivePressurePsi: q(effectivePressurePsi),
    frictionHeatingWorkJ: q(frictionHeatingW * seconds),
    carcassFlexHeatingWorkJ: q(flexHeatingW * seconds),
    loadHeatingWorkJ: q(loadHeatingW * seconds),
    surfaceConductionWorkJ: q(treadToSurfaceW * seconds),
    ambientCoolingWorkJ: q(Math.max(0, ambientCoolingW) * seconds)
  };
}
