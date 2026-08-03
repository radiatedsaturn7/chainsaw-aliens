import { clamp } from './SimulationMath.js';

export const HANDLING_ASSIST_PRESETS = Object.freeze({
  simulation: Object.freeze({ yawDamping: 0, rollDamping: 0, countersteerMoment: 0, steeringResponse: 0, slipAlignment: 0, handbrakeRotation: 0 }),
  sport: Object.freeze({ yawDamping: 0.16, rollDamping: 0.12, countersteerMoment: 0.1, steeringResponse: 2.5, slipAlignment: 10, handbrakeRotation: 1.5 }),
  accessible: Object.freeze({ yawDamping: 0.38, rollDamping: 0.32, countersteerMoment: 0.28, steeringResponse: 0.38, slipAlignment: 1.4, handbrakeRotation: 0.7 })
});

export class HandlingAssist {
  constructor(steeringConfig = {}) {
    this.steering = steeringConfig;
  }

  getPreset(id = 'sport') {
    return HANDLING_ASSIST_PRESETS[String(id || 'sport').toLowerCase()]
      || HANDLING_ASSIST_PRESETS.sport;
  }

  calculatePhysicalInterventions({
    preset = 'sport',
    state = {},
    controls = {},
    config = {},
    supportScale = 1
  } = {}) {
    const policy = this.getPreset(preset);
    if (policy === HANDLING_ASSIST_PRESETS.simulation
      || controls.assists?.stabilityControlEnabled === false) return [];
    const physicalSupport = clamp(Number(supportScale), 0, 1);
    const supportedValue = (value) => physicalSupport <= 0 ? 0 : value * physicalSupport;
    const rollRate = Number(state.angularVelocityWorld?.z || 0);
    const rollInertia = Math.max(1, Number(config.rollInertiaKgM2 || config.yawInertiaKgM2 || 1));
    const interventions = [];
    // Yaw stabilization is owned by the coordinated per-wheel ESC brake
    // controller in PowertrainModel. Do not add a second body-yaw controller.
    const rollMoment = -rollRate * rollInertia * 0.45 * policy.rollDamping;
    if (Math.abs(rollMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'roll-stability', requestedValue: rollMoment,
      appliedValue: supportedValue(rollMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-z', momentWorldNm: { x: 0, y: 0, z: supportedValue(rollMoment) }
    });
    return interventions;
  }

  getSetupPhysicsModifiers(tuning = {}) {
    const centerBias = tuning.drivetrain === 'awd'
      ? clamp(Number(tuning.centerDifferentialBalance) || 0.5, 0.1, 0.9)
      : 0.5;
    const awdFrontBias = tuning.drivetrain === 'awd'
      ? clamp(1 + (0.5 - centerBias) * 0.18, 0.92, 1.08)
      : 1;
    const awdRearBias = tuning.drivetrain === 'awd'
      ? clamp(1 + (centerBias - 0.5) * 0.18, 0.92, 1.08)
      : 1;
    return {
      grip: 1,
      frontGrip: awdFrontBias,
      rearGrip: awdRearBias,
      yawStability: clamp(
        1 + (tuning.rearDifferentialDecel - tuning.frontDifferentialDecel) * 0.04,
        0.94,
        1.06
      ),
      driveTraction: 1,
      aeroDrag: 1 + (tuning.aeroFront + tuning.aeroRear) * 0.06
    };
  }

  getMaxSteerForSpeed(speedMps = 0) {
    const config = this.steering;
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / config.speedReferenceMps, 0, 1);
    const authority = config.highwayAuthority
      + (1 - Math.pow(speedFactor, 0.82)) * (config.stoppedAuthority - config.highwayAuthority);
    return clamp(authority, config.highwayAuthority, config.stoppedAuthority);
  }

  getBinarySteerAssist(speedMps = 0) {
    const config = this.steering;
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / config.speedReferenceMps, 0, 1);
    return {
      maxSteer: 1,
      steeringAuthority: this.getMaxSteerForSpeed(speed),
      response: config.digitalResponseBase
        + (1 - Math.pow(speedFactor, 0.7)) * config.digitalResponseLowSpeedBonus
    };
  }

  getAnalogSteerResponse(speedMps = 0) {
    const config = this.steering;
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / config.speedReferenceMps, 0, 1);
    return config.analogResponseBase
      + (1 - Math.pow(speedFactor, 0.82)) * config.analogResponseLowSpeedBonus;
  }

  getAnalogSteeringTargetRate(speedMps = 0, intent = 0) {
    const config = this.steering;
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / config.speedReferenceMps, 0, 1);
    const intentScale = 0.72 + Math.abs(Number(intent) || 0) * 0.28;
    return (
      config.analogTargetPressBase
      + (1 - Math.pow(speedFactor, 0.68)) * config.analogTargetPressLowSpeedBonus
    ) * intentScale;
  }

  getAnalogSteeringReleaseRate(speedMps = 0) {
    const config = this.steering;
    const speed = Math.max(0, Number(speedMps) || 0);
    const speedFactor = clamp(speed / config.speedReferenceMps, 0, 1);
    return config.analogTargetReleaseBase
      + Math.pow(speedFactor, 0.72) * config.analogTargetReleaseHighSpeedBonus;
  }

  getTireSteerAngleForSpeed(speedMps = 0) {
    const config = this.steering;
    const speedFactor = clamp(Math.max(0, Number(speedMps) || 0) / 64, 0, 1);
    return config.highwayTireAngleRad
      + (1 - Math.pow(speedFactor, 0.72)) * (config.parkingTireAngleRad - config.highwayTireAngleRad);
  }

  getRawTireAngleForSteering(steering = 0, speedMps = 0) {
    return clamp(Number(steering) || 0, -1, 1)
      * this.getTireSteerAngleForSpeed(speedMps)
      * this.getMaxSteerForSpeed(speedMps);
  }

  getGripLimitedTireAngle(tireAngle = 0, speedMps = 0, {
    wheelbaseM = 2.67,
    availableLateralG = 0.95
  } = {}) {
    const angle = Number(tireAngle) || 0;
    const speed = Math.abs(Number(speedMps) || 0);
    if (speed < 7.5) return angle;
    const wheelbase = Math.max(2.1, Number(wheelbaseM) || 2.67);
    const lateralG = clamp(Number(availableLateralG) || 0.95, 0.12, 1.12);
    const maxAngle = Math.atan((lateralG * 9.81 * wheelbase) / Math.max(1, speed * speed));
    return clamp(angle, -maxAngle, maxAngle);
  }

  getUsableFullLockTireAngle(speedMps = 0, options = {}) {
    const rawFullLockAngle = Math.abs(this.getRawTireAngleForSteering(1, speedMps));
    return Math.abs(this.getGripLimitedTireAngle(rawFullLockAngle, speedMps, options));
  }

  getUsableTireAngleForSteering(steering = 0, speedMps = 0, options = {}) {
    return clamp(Number(steering) || 0, -1, 1) * this.getUsableFullLockTireAngle(speedMps, options);
  }

  resolvePhysicalCenterSteeringAngle({
    driverInput = 0,
    speedMps = 0,
    wheelbaseM = 2.67,
    availableLateralG = 0.95,
    handlingPreset = 'sport',
    maxPhysicalAngleRad = 0.52
  } = {}) {
    const normalizedInput = clamp(Number(driverInput) || 0, -1, 1);
    if (String(handlingPreset || 'sport').toLowerCase() === 'simulation') {
      return normalizedInput * clamp(Number(maxPhysicalAngleRad) || 0.52, 0.05, 1.2);
    }
    return this.getUsableTireAngleForSteering(normalizedInput, speedMps, {
      wheelbaseM,
      availableLateralG
    });
  }

  getSteeringWheelRotationForTireAngle(tireAngle = 0, steeringRatio = this.steering.steeringRatio) {
    return clamp(
      Number(tireAngle || 0) * clamp(Number(steeringRatio) || this.steering.steeringRatio, 8, 24),
      -this.steering.maxSteeringWheelRotationRad,
      this.steering.maxSteeringWheelRotationRad
    );
  }

  getSteeringReturnRate(speedMps = 0) {
    const config = this.steering;
    return config.returnRateBase
      + clamp(Math.max(0, Number(speedMps) || 0) / 38, 0, 1) * config.returnRateHighSpeedBonus;
  }

  getSelfAligningSteeringCorrection({
    contactPatches = {},
    rackAngleRad = 0,
    casterRad = 0,
    wheelRadiusM = 0.337,
    steeringInputMode = 'gamepad',
    seconds = 0,
    activeTurnInput = false,
    launchAligning = false
  } = {}) {
    if (steeringInputMode === 'simulation-wheel' || activeTurnInput || launchAligning || seconds <= 0) return 0;
    let frontLoadN = 0;
    let rackMomentNm = 0;
    ['fl', 'fr'].forEach((wheelId) => {
      const patch = contactPatches?.[wheelId] || {};
      const loadN = Math.max(0, Number(patch.normalLoadN || 0));
      const lateralForceN = Number(patch.lateralForceN || 0);
      const pneumaticMomentNm = Number(patch.selfAligningMomentNm || 0);
      const mechanicalTrailM = Math.max(0, Number(wheelRadiusM || 0.337) * Math.sin(Math.abs(Number(casterRad || 0))));
      frontLoadN += loadN;
      rackMomentNm += pneumaticMomentNm - lateralForceN * mechanicalTrailM;
    });
    if (frontLoadN <= 1 || Math.abs(rackMomentNm) <= 0.001) return 0;
    const normalizedMoment = rackMomentNm / Math.max(1, frontLoadN * Math.max(0.05, Number(wheelRadiusM || 0.337)));
    const rackSign = Math.sign(Number(rackAngleRad || 0));
    const returnDirection = rackSign && Math.sign(normalizedMoment) === rackSign
      ? -normalizedMoment
      : normalizedMoment;
    return clamp(returnDirection * seconds * 2.8, -0.16, 0.16);
  }

  getTractionControlCutTarget(measuredSlipRatio = 0, targetSlip = 0.1, active = false) {
    if (!active) return 1;
    const measuredSlip = Math.max(0, Number(measuredSlipRatio) || 0);
    if (measuredSlip <= targetSlip) return 1;
    return clamp(targetSlip / Math.max(targetSlip, measuredSlip), 0.18, 1);
  }

  stepTractionControlCut({
    targetCut = 1,
    previousCut = 1,
    looseSurfaceFactor = 0,
    seconds = 0,
    active = false
  } = {}) {
    if (!active) return { appliedCut: 1, nextCut: 1 };
    const target = clamp(Number(targetCut) || 1, 0.08, 1);
    const previous = clamp(Number(previousCut ?? 1), 0.08, 1);
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const rate = target < previous ? 11 - loose * 2.4 : 7.2 - loose * 1.4;
    const alpha = clamp(1 - Math.exp(-Math.max(0, rate) * Math.max(0, Number(seconds) || 0)), 0, 1);
    const appliedCut = previous + (target - previous) * alpha;
    return { appliedCut, nextCut: appliedCut };
  }
}
