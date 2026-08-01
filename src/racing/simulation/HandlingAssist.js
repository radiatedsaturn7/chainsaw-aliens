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
    if (policy === HANDLING_ASSIST_PRESETS.simulation) return [];
    const physicalSupport = clamp(Number(supportScale), 0, 1);
    const supportedValue = (value) => physicalSupport <= 0 ? 0 : value * physicalSupport;
    const yawRate = Number(state.angularVelocityWorld?.y || state.yawRateRadps || 0);
    const rollRate = Number(state.angularVelocityWorld?.z || 0);
    const steer = Number(controls.steering || 0);
    const inertia = Math.max(1, Number(config.yawInertiaKgM2 || 1));
    const interventions = [];
    const yawMoment = -yawRate * inertia * policy.yawDamping
      + -Math.sign(yawRate) * Math.max(0, Math.abs(yawRate) - Math.abs(steer) * 0.8)
        * inertia * policy.countersteerMoment;
    if (Math.abs(yawMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'yaw-stability', requestedValue: yawMoment,
      appliedValue: supportedValue(yawMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-y', momentWorldNm: { x: 0, y: supportedValue(yawMoment), z: 0 }
    });
    const speed = Math.abs(Number(state.speedMps || 0));
    const steerAngle = steer * Number(config.maxSteerAngleRad || 0.52);
    const desiredYawRate = speed * Math.tan(steerAngle) / Math.max(0.5, Number(config.wheelbaseM || 2.65));
    const peakWheelSlip = Math.max(0, ...Object.values(state.contactPatches || {}).map((patch) => (
      Math.abs(Number(patch?.slipRatio || 0))
    )));
    const slipAuthority = clamp((peakWheelSlip - 0.12) / 0.5, 0, 1);
    const highPowerAuthority = clamp((Number(config.powerHp || 0) - 400) / 400, 0, 1);
    const steeringMoment = (desiredYawRate - yawRate) * inertia * policy.steeringResponse
      * slipAuthority * highPowerAuthority;
    if (speed > 1 && Math.abs(steer) > 0.01 && Math.abs(steeringMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'steering-response', requestedValue: steeringMoment,
      appliedValue: supportedValue(steeringMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-y', momentWorldNm: { x: 0, y: supportedValue(steeringMoment), z: 0 }
    });
    const velocityYaw = Math.atan2(Number(state.velocity?.x || 0), Number(state.velocity?.z || 0));
    const slipYaw = Math.atan2(Math.sin(velocityYaw - Number(state.yawRad || 0)), Math.cos(velocityYaw - Number(state.yawRad || 0)));
    const alignmentAuthority = 1 - highPowerAuthority;
    const alignmentMoment = clamp(
      slipYaw * inertia * policy.slipAlignment * alignmentAuthority,
      -15000,
      15000
    );
    if (speed > 1 && Math.abs(slipYaw) > 0.01 && Math.abs(alignmentMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'slip-angle-stability', requestedValue: alignmentMoment,
      appliedValue: supportedValue(alignmentMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-y', momentWorldNm: { x: 0, y: supportedValue(alignmentMoment), z: 0 }
    });
    const handbrakeMoment = steer * clamp(Number(controls.handbrake || 0), 0, 1)
      * clamp(speed / 20, 0, 2.5) * inertia * policy.handbrakeRotation;
    if (speed > 3 && Math.abs(handbrakeMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'handbrake-rotation', requestedValue: handbrakeMoment,
      appliedValue: supportedValue(handbrakeMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-y', momentWorldNm: { x: 0, y: supportedValue(handbrakeMoment), z: 0 }
    });
    const rollMoment = -rollRate * inertia * 0.45 * policy.rollDamping;
    if (Math.abs(rollMoment) > 0.001) interventions.push({
      source: 'handling-assist', trigger: 'roll-stability', requestedValue: rollMoment,
      appliedValue: supportedValue(rollMoment), supportScale: physicalSupport,
      suppressionReason: physicalSupport <= 0.001 ? 'airborne-contact' : null,
      physicalEffect: 'body-moment-z', momentWorldNm: { x: 0, y: 0, z: supportedValue(rollMoment) }
    });
    return interventions;
  }

  getSetupPhysicsModifiers(tuning = {}) {
    const camberGrip = clamp(
      1 + (Math.abs(tuning.camberFront + 1.2) + Math.abs(tuning.camberRear + 1)) * -0.018,
      0.9,
      1.04
    );
    const toePenalty = clamp(1 - (Math.abs(tuning.toeFront) + Math.abs(tuning.toeRear)) * 0.035, 0.9, 1);
    const casterStability = clamp(1 + (tuning.casterFront - 5.5) * 0.025, 0.92, 1.08);
    const ridePenalty = clamp(
      1 - Math.abs(tuning.rideHeightFront - tuning.rideHeightRear) * 0.08,
      0.94,
      1.02
    );
    const springBalance = clamp(1 + (tuning.springRear - tuning.springFront) * 0.08, 0.92, 1.08);
    const antiRollBalance = clamp(
      1 + (tuning.antiRollRear - tuning.antiRollFront) * 0.06,
      0.94,
      1.06
    );
    const dampingGrip = clamp(
      1 - (
        Math.abs(tuning.bumpFront - tuning.reboundFront)
        + Math.abs(tuning.bumpRear - tuning.reboundRear)
      ) * 0.035,
      0.92,
      1.03
    );
    const travelCompliance = clamp(
      0.92 + (tuning.suspensionTravelFront + tuning.suspensionTravelRear) * 0.08,
      0.9,
      1.08
    );
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
      grip: camberGrip * toePenalty * ridePenalty * dampingGrip * travelCompliance,
      frontGrip: awdFrontBias * clamp(
        1 - (springBalance - 1) * 0.24 - (antiRollBalance - 1) * 0.18,
        0.88,
        1.12
      ),
      rearGrip: awdRearBias * clamp(
        1 + (springBalance - 1) * 0.24 + (antiRollBalance - 1) * 0.18,
        0.88,
        1.12
      ),
      yawStability: casterStability * clamp(
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
    frontSlipAngle = 0,
    steeringAngle = 0,
    speedMps = 0,
    looseSurfaceFactor = 0,
    tireContactScale = 1,
    seconds = 0,
    activeTurnInput = false,
    launchAligning = false
  } = {}) {
    if (activeTurnInput || launchAligning || seconds <= 0 || tireContactScale <= 0.001) return 0;
    const speed = Math.abs(Number(speedMps) || 0);
    if (speed < 4) return 0;
    const slip = Number(frontSlipAngle) || 0;
    const tireAngle = Number(steeringAngle) || 0;
    const aligningSlip = clamp(Math.abs(slip) / 0.18, 0, 1);
    const steeringLoad = clamp(Math.abs(tireAngle) / 0.22, 0.25, 1);
    const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
    const casterTrailRate = (2.8 + clamp(speed / 32, 0, 1) * 3.4)
      * (1 - loose * 0.38)
      * clamp(Number(tireContactScale) || 0, 0, 1);
    const normalizedMaxAngle = Math.max(
      0.08,
      this.getTireSteerAngleForSpeed(speed) * this.getMaxSteerForSpeed(speed)
    );
    const correction = -(slip / normalizedMaxAngle)
      * aligningSlip * steeringLoad * casterTrailRate * seconds;
    return clamp(correction, -0.16, 0.16);
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
