import { clamp } from './SimulationMath.js';

const q = (value) => Number((Number(value) || 0).toFixed(6));
const hash = (value) => [...String(value)].reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, 2166136261);

export function createWakeSources(vehicles = [], { maximumSources = 32 } = {}) {
  return vehicles.filter((vehicle) => vehicle && Number.isFinite(Number(vehicle.position?.x))
    && Number.isFinite(Number(vehicle.position?.z)))
    .map((vehicle, index) => ({
      id: String(vehicle.id ?? index),
      position: { x: Number(vehicle.position.x), y: Number(vehicle.position.y || 0), z: Number(vehicle.position.z) },
      yawRad: Number(vehicle.yawRad || 0), speedMps: Math.max(0, Number(vehicle.speedMps || 0)),
      widthM: clamp(Number(vehicle.widthM) || 1.8, 1, 3),
      dragAreaM2: clamp(Number(vehicle.dragAreaM2) || 0.75, 0.15, 2.5)
    })).sort((left, right) => left.id.localeCompare(right.id)).slice(0, maximumSources);
}

export function sampleWakeAtVehicle({ vehicle = {}, sources = [], windWorldMps = {}, stepIndex = 0 } = {}) {
  const position = vehicle.position || {};
  const contributions = [];
  sources.forEach((source) => {
    if (String(source.id) === String(vehicle.id)) return;
    const forward = { x: Math.sin(source.yawRad), z: Math.cos(source.yawRad) };
    const right = { x: Math.cos(source.yawRad), z: -Math.sin(source.yawRad) };
    const dx = Number(source.position.x) - Number(position.x || 0);
    const dz = Number(source.position.z) - Number(position.z || 0);
    const distanceBehindM = dx * forward.x + dz * forward.z;
    if (distanceBehindM <= 0 || distanceBehindM > 120) return;
    const travelTime = distanceBehindM / Math.max(8, source.speedMps);
    const crosswindMps = Number(windWorldMps.x || 0) * right.x + Number(windWorldMps.z || 0) * right.z;
    const wakeShiftM = crosswindMps * travelTime * 0.38;
    const lateralM = dx * right.x + dz * right.z - wakeShiftM;
    const halfWidthM = source.widthM * 0.65 + distanceBehindM * 0.055;
    const verticalM = Math.abs(Number(position.y || 0) - source.position.y);
    if (Math.abs(lateralM) > halfWidthM * 2.5 || verticalM > 4 + distanceBehindM * 0.03) return;
    const lateralScale = Math.exp(-0.5 * (lateralM / Math.max(0.2, halfWidthM)) ** 2);
    const decay = Math.exp(-distanceBehindM / 52);
    const speedScale = clamp(source.speedMps / 25, 0.15, 1.4);
    const intensity = clamp(lateralScale * decay * speedScale * source.dragAreaM2 / 0.75, 0, 1);
    const phase = ((hash(`${source.id}:${stepIndex}`) % 2001) / 1000) - 1;
    contributions.push({ sourceId: source.id, distanceBehindM: q(distanceBehindM), lateralM: q(lateralM),
      wakeShiftM: q(wakeShiftM), intensity: q(intensity), turbulence: q(intensity * (0.35 + Math.abs(phase) * 0.35)),
      lateralTurbulence: q(intensity * phase) });
  });
  const combined = contributions.reduce((remaining, entry) => remaining * (1 - entry.intensity), 1);
  const intensity = clamp(1 - combined, 0, 1);
  const turbulence = clamp(contributions.reduce((sum, entry) => sum + entry.turbulence, 0), 0, 1);
  const lateralTurbulence = clamp(contributions.reduce((sum, entry) => sum + entry.lateralTurbulence, 0), -1, 1);
  return {
    intensity: q(intensity), dragReduction: q(intensity * 0.42),
    frontDownforceLoss: q(clamp(intensity * 0.58 + turbulence * 0.08, 0, 0.68)),
    rearDownforceChange: q(clamp(-intensity * 0.18 + turbulence * 0.04, -0.35, 0.12)),
    turbulence: q(turbulence), lateralTurbulence: q(lateralTurbulence),
    crosswindRisk: q(clamp(turbulence + Math.abs(Number(windWorldMps.x || 0)) / 30, 0, 1)),
    contributions
  };
}
