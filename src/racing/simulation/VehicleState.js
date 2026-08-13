/**
 * The playtest session is the single authoritative vehicle aggregate.
 *
 * `vehicle3d` is a nested chassis component, not a second vehicle. Its pose and
 * suspension outputs are synchronized into session fields only for legacy
 * render/audio consumers.
 */
function copyRecordInto(target, source) {
  for (const key in target) {
    if (!Object.hasOwn(source || {}, key)) delete target[key];
  }
  for (const key in source || {}) target[key] = source[key];
  return target;
}

function copyVectorInto(target, source, includeW = false) {
  target.x = Number(source?.x || 0);
  target.y = Number(source?.y || 0);
  target.z = Number(source?.z || 0);
  if (includeW) target.w = Number(source?.w ?? 1);
  return target;
}

export function getAuthoritativeVehicleState(session = null) {
  return session && typeof session === 'object' ? session : null;
}

export function getAuthoritativeChassisState(vehicleState = null) {
  if (vehicleState?.vehicle3d?.authoritativeSource === 'VehicleDynamicsWorker'
    && vehicleState?.vehicleDynamicsPresentationState) {
    return vehicleState.vehicleDynamicsPresentationState;
  }
  if (vehicleState?.vehicleDynamicsRunner?.state) return vehicleState.vehicleDynamicsRunner.state;
  return vehicleState?.vehicle3d?.enabled ? vehicleState.vehicle3d : null;
}

export function syncVehicleDynamicsCompatibilityOutputs(runner = null, session = null) {
  if (!runner?.state || !session) return session;
  const state = runner.state;
  session.vehicleDynamicsPresentationState = null;
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
  session.suspensionTravel = copyRecordInto(
    session.suspensionTravel || {},
    state.suspensionTravel
  );
  const diagnostics = session.diagnostics || {};
  const tireTemperature = diagnostics.tireTemperature || {};
  const tireWear = diagnostics.tireWear || {};
  const tireState = state.tireState || {};
  for (const wheelId in tireTemperature) {
    if (!Object.hasOwn(tireState, wheelId)) delete tireTemperature[wheelId];
  }
  for (const wheelId in tireWear) {
    if (!Object.hasOwn(tireState, wheelId)) delete tireWear[wheelId];
  }
  for (const wheelId in tireState) {
    const tire = tireState[wheelId] || {};
    tireTemperature[wheelId] = Number(tire.temperatureF ?? 70);
    tireWear[wheelId] = Number(tire.wear || 0);
  }
  diagnostics.tireTemperature = tireTemperature;
  diagnostics.tireWear = tireWear;
  session.diagnostics = diagnostics;
  session.wheelAngularVelocityRadps = copyRecordInto(
    session.wheelAngularVelocityRadps || {},
    state.wheelAngularVelocityRadps
  );
  session.wheelContacts = copyRecordInto(
    session.wheelContacts || {},
    state.contactPatches
  );
  session.grounded = state.grounded !== false;
  session.airborne = !session.grounded;
  const vehicle3d = session.vehicle3d || {};
  vehicle3d.enabled = true;
  vehicle3d.authoritativeSource = 'VehicleDynamicsRunner';
  vehicle3d.position = copyVectorInto(vehicle3d.position || {}, state.position);
  vehicle3d.linearVelocity = copyVectorInto(
    vehicle3d.linearVelocity || {}, state.velocity
  );
  vehicle3d.orientation = copyVectorInto(
    vehicle3d.orientation || {}, state.orientation, true
  );
  vehicle3d.angularVelocity = copyVectorInto(
    vehicle3d.angularVelocity || {}, state.angularVelocityWorld
  );
  vehicle3d.yaw = session.carYaw;
  vehicle3d.pitch = session.pitchRad;
  vehicle3d.roll = session.rollRad;
  const wheels = vehicle3d.wheels || {};
  const contactPatches = state.contactPatches || {};
  for (const wheelId in wheels) {
    if (!Object.hasOwn(contactPatches, wheelId)) delete wheels[wheelId];
  }
  for (const wheelId in contactPatches) {
    const patch = contactPatches[wheelId] || {};
    const wheel = wheels[wheelId] || {};
    wheel.id = wheelId;
    wheel.inContact = Number(patch.normalLoadN || 0) > 1;
    wheel.normalLoadN = Number(patch.normalLoadN || 0);
    wheel.angularSpeedRadps = Number(state.wheelAngularVelocityRadps?.[wheelId] || 0);
    wheel.compressionRatio = Number(state.suspensionTravel?.[wheelId] || 0);
    const suspension = state.suspensionState?.[wheelId] || {};
    const hubPosition = patch.hubPositionWorld
      || suspension.hubPositionWorld
      || patch.wheelCenterWorld;
    if (hubPosition) {
      wheel.position = copyVectorInto(wheel.position || {}, hubPosition);
    } else {
      delete wheel.position;
    }
    const suspensionMount = patch.suspensionMountPositionWorld
      || suspension.suspensionMountPositionWorld;
    if (suspensionMount) {
      wheel.suspensionMount = copyVectorInto(
        wheel.suspensionMount || {}, suspensionMount
      );
    } else {
      delete wheel.suspensionMount;
    }
    const suspensionAxis = patch.suspensionAxisWorld || suspension.suspensionAxisWorld;
    if (suspensionAxis) {
      wheel.suspensionAxis = copyVectorInto(wheel.suspensionAxis || {}, suspensionAxis);
    } else {
      delete wheel.suspensionAxis;
    }
    wheel.contactPoint = copyVectorInto(
      wheel.contactPoint || {}, patch.contactPointWorld
    );
    wheel.normal = copyVectorInto(wheel.normal || {}, patch.surfaceNormalWorld);
    wheel.longitudinalSlipRatio = Number(patch.slipRatio || 0);
    wheel.slipLateral = Math.abs(Math.tan(Number(patch.slipAngleRad || 0)));
    wheel.tireLimitN = Number(patch.combinedSlipLimitN || 0);
    wheel.loadSensitivityMultiplier = Number(patch.gripCoefficient || 1);
    wheel.gripCoefficient = Number(patch.gripCoefficient || 1);
    wheel.frictionCircleScale = Math.max(
      0.5,
      Math.min(1, 1 - Number(patch.utilization || 0) * 0.42)
    );
    wheels[wheelId] = wheel;
  }
  vehicle3d.wheels = wheels;
  session.vehicle3d = vehicle3d;
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
