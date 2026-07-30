/**
 * The playtest session is the single authoritative vehicle aggregate.
 *
 * `vehicle3d` is a nested chassis component, not a second vehicle. Its pose and
 * suspension outputs are synchronized into session fields only for legacy
 * render/audio consumers.
 */
export function getAuthoritativeVehicleState(session = null) {
  return session && typeof session === 'object' ? session : null;
}

export function getAuthoritativeChassisState(vehicleState = null) {
  return vehicleState?.vehicle3d?.enabled ? vehicleState.vehicle3d : null;
}

export function getVehicleStateSnapshot(vehicleState = null) {
  const state = getAuthoritativeVehicleState(vehicleState);
  if (!state) return null;
  const chassis = getAuthoritativeChassisState(state);
  return {
    worldX: Number(state.worldX || 0),
    worldZ: Number(state.worldZ || 0),
    speedMps: Number(state.speedMps || 0),
    carYaw: Number(state.carYaw || 0),
    velocityYaw: Number(state.velocityYaw ?? state.carYaw ?? 0),
    bodyY: Number(chassis?.position?.y ?? state.bodyY ?? state.heightM ?? 0),
    verticalVelocityMps: Number(chassis?.linearVelocity?.y ?? state.verticalVelocityMps ?? 0),
    pitchRad: Number(chassis?.pitch ?? state.pitchRad ?? 0),
    rollRad: Number(chassis?.roll ?? state.rollRad ?? 0),
    chassis
  };
}
