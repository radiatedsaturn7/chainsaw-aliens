import { clamp } from './SimulationMath.js';
import { createWakeSources } from './WakeModel.js';

const q = (value) => Number((Number(value) || 0).toFixed(6));

export function createDeterministicAtmosphere({ weatherState = {}, race = {}, timeSeconds = 0 } = {}) {
  const type = String(weatherState.id || race.weather || 'clear');
  const intensity = clamp(Number(weatherState.effectiveIntensity ?? weatherState.targetIntensity ?? race.weatherIntensity ?? 0), 0, 1);
  const directionRad = Number(race.windDirectionRad
    ?? (Number(race.windDirectionDeg ?? race.weatherWindDirectionDeg ?? 0) * Math.PI / 180));
  const defaultWindMps = type === 'storm' ? 18 : type === 'rain' ? 10 : type === 'snow' ? 7 : 4;
  const speedMps = Math.max(0, Number(race.windSpeedMps ?? defaultWindMps * (0.25 + intensity * 0.75)));
  const gustStrength = clamp(Number(race.gustStrength ?? (type === 'storm' ? 0.38 : 0.16)), 0, 1);
  const time = Number(timeSeconds || 0);
  const gust = speedMps * gustStrength * (
    Math.sin(time * 1.731 + 0.37) * 0.62 + Math.sin(time * 0.417 + 1.91) * 0.38
  );
  const lateralGust = speedMps * gustStrength * Math.sin(time * 0.913 + 2.47) * 0.35;
  const forward = { x: Math.sin(directionRad), z: Math.cos(directionRad) };
  const right = { x: Math.cos(directionRad), z: -Math.sin(directionRad) };
  return {
    windWorldMps: { x: q(forward.x * speedMps), y: 0, z: q(forward.z * speedMps) },
    gustWorldMps: {
      x: q(forward.x * gust + right.x * lateralGust),
      y: 0,
      z: q(forward.z * gust + right.z * lateralGust)
    },
    windSpeedMps: q(speedMps), windDirectionRad: q(directionRad), gustStrength: q(gustStrength)
  };
}

export function createRaceWakeSources(session = {}, { playerWidthM = 1.8 } = {}) {
  const vehicles = [{
    id: 'player',
    position: { x: Number(session.worldX || 0), y: Number(session.bodyY ?? session.heightM ?? 0), z: Number(session.worldZ || 0) },
    yawRad: Number(session.carYaw || 0), speedMps: Math.abs(Number(session.speedMps || 0)), widthM: playerWidthM
  }, ...(session.aiRuntime || []).map((ai, index) => ({
    id: String(ai.id || ai.driverId || `ai-${index}`),
    position: { x: Number(ai.worldX || 0), y: Number(ai.bodyY ?? ai.heightM ?? 0), z: Number(ai.worldZ || 0) },
    yawRad: Number(ai.carYaw || 0), speedMps: Math.abs(Number(ai.speedMps || 0)),
    widthM: Number(ai.vehicleDynamicsRunner?.config?.frontTrackWidthM || 1.8) + 0.25
  }))];
  return createWakeSources(vehicles);
}
