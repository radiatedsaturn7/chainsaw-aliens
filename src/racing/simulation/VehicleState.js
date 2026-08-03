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
  if (vehicleState?.vehicleDynamicsRunner?.state) return vehicleState.vehicleDynamicsRunner.state;
  return vehicleState?.vehicle3d?.enabled ? vehicleState.vehicle3d : null;
}

export function syncVehicleDynamicsCompatibilityOutputs(runner = null, session = null) {
  if (!runner?.state || !session) return session;
  const state = runner.state;
  session.vehicleDynamicsRunner = runner;
  session.worldX = Number(state.position.x || 0);
  session.worldY = Number(state.position.y || 0);
  session.worldZ = Number(state.position.z || 0);
  session.bodyX = session.worldX;
  session.bodyY = session.worldY;
  session.bodyZ = session.worldZ;
  session.velocityX = Number(state.velocity.x || 0);
  session.velocityY = Number(state.velocity.y || 0);
  session.velocityZ = Number(state.velocity.z || 0);
  session.speedMps = Number(state.speedMps || 0);
  session.groundSpeedMps = Number(state.groundSpeedMps ?? Math.hypot(session.velocityX, session.velocityZ));
  session.bodyLongitudinalSpeedMps = Number(state.bodyLongitudinalSpeedMps ?? state.speedMps ?? 0);
  session.bodyLateralSpeedMps = Number(state.bodyLateralSpeedMps || 0);
  session.signedTravelSpeedMps = Number(state.signedTravelSpeedMps ?? state.speedMps ?? 0);
  session.velocityYaw = Math.atan2(session.velocityX, session.velocityZ);
  session.carYaw = Number(state.yawRad || 0);
  session.yawVelocityRadps = Number(state.angularVelocityWorld?.y || 0);
  session.pitchRad = Number(state.pitchRad || 0);
  session.rollRad = Number(state.rollRad || 0);
  session.pitchRate = Number(state.angularVelocityWorld?.x || 0);
  session.rollRate = Number(state.angularVelocityWorld?.z || 0);
  session.verticalVelocityMps = session.velocityY;
  session.engineRpm = Number(state.powertrainState?.engineRpm ?? state.engineRpm ?? 0);
  session.gear = Number(state.powertrainState?.gear ?? state.gear ?? 0);
  session.suspensionTravel = { ...(state.suspensionTravel || {}) };
  session.diagnostics = {
    ...(session.diagnostics || {}),
    tireTemperature: Object.fromEntries(Object.entries(state.tireState || {}).map(([wheelId, tire]) => [
      wheelId, Number(tire.temperatureF ?? 70)
    ])),
    tireWear: Object.fromEntries(Object.entries(state.tireState || {}).map(([wheelId, tire]) => [
      wheelId, Number(tire.wear || 0)
    ]))
  };
  session.wheelAngularVelocityRadps = { ...(state.wheelAngularVelocityRadps || {}) };
  session.wheelContacts = { ...(state.contactPatches || {}) };
  session.grounded = state.grounded !== false;
  session.airborne = !session.grounded;
  session.vehicle3d = {
    ...(session.vehicle3d || {}),
    enabled: true,
    authoritativeSource: 'VehicleDynamicsRunner',
    position: { ...state.position },
    linearVelocity: { ...state.velocity },
    orientation: { ...state.orientation },
    angularVelocity: { ...state.angularVelocityWorld },
    yaw: session.carYaw,
    pitch: session.pitchRad,
    roll: session.rollRad,
    wheels: Object.fromEntries(Object.entries(state.contactPatches || {}).map(([wheelId, patch]) => [
      wheelId,
      {
        ...(session.vehicle3d?.wheels?.[wheelId] || {}),
        id: wheelId,
        inContact: Number(patch.normalLoadN || 0) > 1,
        normalLoadN: Number(patch.normalLoadN || 0),
        angularSpeedRadps: Number(state.wheelAngularVelocityRadps?.[wheelId] || 0),
        compressionRatio: Number(state.suspensionTravel?.[wheelId] || 0),
        contactPoint: { ...patch.contactPointWorld },
        normal: { ...patch.surfaceNormalWorld },
        longitudinalSlipRatio: Number(patch.slipRatio || 0),
        slipLateral: Math.abs(Math.tan(Number(patch.slipAngleRad || 0))),
        tireLimitN: Number(patch.combinedSlipLimitN || 0),
        loadSensitivityMultiplier: Number(patch.gripCoefficient || 1),
        gripCoefficient: Number(patch.gripCoefficient || 1),
        frictionCircleScale: Math.max(0.5, Math.min(1, 1 - Number(patch.utilization || 0) * 0.42))
      }
    ]))
  };
  return session;
}

export function getVehicleStateSnapshot(vehicleState = null) {
  const state = getAuthoritativeVehicleState(vehicleState);
  if (!state) return null;
  const chassis = getAuthoritativeChassisState(state);
  return {
    worldX: Number(state.worldX || 0),
    worldZ: Number(state.worldZ || 0),
    speedMps: Number(state.speedMps || 0),
    groundSpeedMps: Number(state.groundSpeedMps ?? Math.hypot(
      Number(state.velocityX || 0),
      Number(state.velocityZ || 0)
    )),
    bodyLongitudinalSpeedMps: Number(state.bodyLongitudinalSpeedMps ?? state.speedMps ?? 0),
    bodyLateralSpeedMps: Number(state.bodyLateralSpeedMps || 0),
    signedTravelSpeedMps: Number(state.signedTravelSpeedMps ?? state.speedMps ?? 0),
    carYaw: Number(state.carYaw || 0),
    velocityYaw: Number(state.velocityYaw ?? state.carYaw ?? 0),
    bodyY: Number(chassis?.position?.y ?? state.bodyY ?? state.heightM ?? 0),
    verticalVelocityMps: Number(chassis?.linearVelocity?.y ?? state.verticalVelocityMps ?? 0),
    pitchRad: Number(chassis?.pitch ?? state.pitchRad ?? 0),
    rollRad: Number(chassis?.roll ?? state.rollRad ?? 0),
    chassis
  };
}
