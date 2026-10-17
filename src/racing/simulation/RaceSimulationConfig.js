export const RACE_THREE_ELEVATION_M = 12;

export const RACE_CONTROLLER_STEERING = Object.freeze({
  responseProfiles: Object.freeze({
    keyboard: Object.freeze({ pressRatePerSecond: 3.6, releaseRatePerSecond: 7.8 }),
    gamepad: Object.freeze({ responseRatePerSecond: 14.0, releaseRatePerSecond: 18.0 }),
    simulationWheel: Object.freeze({ direct: true })
  }),
  gamepadSpeedAngleBonus: 0.1,
  gamepadAngleBonusStartMps: 7.5,
  gamepadAngleBonusFullMps: 15,
  speedReferenceMps: 62,
  digitalResponseBase: 84,
  digitalResponseLowSpeedBonus: 36,
  analogResponseBase: 16,
  analogResponseLowSpeedBonus: 5.5,
  analogTargetPressBase: 4,
  analogTargetPressLowSpeedBonus: 2,
  analogTargetReleaseBase: 7.5,
  analogTargetReleaseHighSpeedBonus: 3.8,
  analogActiveTurnResponseScale: 0.3,
  digitalActiveTurnResponseScale: 0.125,
  digitalTargetPressBase: 2.4,
  digitalTargetPressHoldBonus: 3.2,
  digitalTargetHoldRampMs: 350,
  returnRateBase: 20,
  returnRateHighSpeedBonus: 18,
  stoppedAuthority: 1,
  highwayAuthority: 0.2,
  parkingTireAngleRad: 0.56,
  highwayTireAngleRad: 0.045,
  highSpeedYawDampingFloor: 0.08,
  steeringRatio: 14.5,
  maxSteeringWheelRotationRad: Math.PI * 3
});

export const RACE_PEDAL_INPUT = Object.freeze({
  digitalThrottlePressRate: 5.2,
  digitalThrottleReleaseRate: 6.8,
  digitalBrakePressRate: 8.5,
  digitalBrakeReleaseRate: 10.5,
  activeThreshold: 0.05,
  reverseThreshold: 0.62
});

export function getGamepadSpeedSteeringScale(speedMps = 0, steering = RACE_CONTROLLER_STEERING) {
  const start = Number(steering.gamepadAngleBonusStartMps) || 7.5;
  const full = Number(steering.gamepadAngleBonusFullMps) || 15;
  const blend = Math.max(0, Math.min(1, (Math.abs(Number(speedMps) || 0) - start) / Math.max(1, full - start)));
  const bonus = Math.max(0, Math.min(0.25, Number(steering.gamepadSpeedAngleBonus) || 0));
  return 1 + bonus * blend * blend * (3 - 2 * blend);
}
