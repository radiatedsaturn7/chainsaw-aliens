export const RACE_THREE_ELEVATION_M = 12;

export const RACE_CONTROLLER_STEERING = Object.freeze({
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
  analogFollowRate: 30,
  activeThreshold: 0.05,
  reverseThreshold: 0.62
});
