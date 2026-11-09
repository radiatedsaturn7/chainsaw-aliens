// Detached, bounded snapshots for diagnosing handling from the existing recorder.
// Missing authoritative physics is explicit (for example on a worker-only client).
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object?.[key] ?? null]));
const scalarSettings = object => Object.fromEntries(Object.entries(object || {}).filter(([, value]) =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)));
export function captureRaceHandling(editor) {
  const session = editor.playtestSession || {};
  const runner = session.vehicleDynamicsRunner;
  const worker = !!editor.vehicleDynamicsAuthority?.workerBridge;
  const state = worker ? session.vehicleDynamicsPresentationState : runner?.state;
  return {
    source: state ? (worker ? 'worker-presentation' : 'local-authoritative') : 'unavailable',
    appliedControls: scalarSettings(worker ? null : editor.vehicleDynamicsAuthority?.latest?.telemetry?.controls),
    distanceM: session.distance ?? null,
    inputs: pick(editor.raceInput, ['steeringWheel', 'analogSteeringIntent', 'binarySteer', 'steeringTarget', 'handbrake', 'throttleAxis', 'brakeAxis', 'gear',
      'lastSteeringInputMode', 'tractionControlEnabled', 'stabilityControlEnabled', 'absEnabled']),
    state: state ? {
      ...pick(state, ['groundSpeedMps', 'bodyLongitudinalSpeedMps', 'bodyLateralSpeedMps', 'yawRateRadps', 'rollRad', 'pitchRad']),
      position: pick(state.position, ['x', 'y', 'z']),
      powertrain: scalarSettings(state.powertrainState),
      steering: scalarSettings(state.steeringTelemetry),
      stability: scalarSettings(state.powertrainState?.telemetry),
      wheels: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(id => [id, {
        loadN: state.wheelLoadsN?.[id] ?? null,
        ...pick(state.contactPatches?.[id], ['steeringAngleRad', 'rawSlipRatio', 'rawSlipAngleRad',
          'normalLoadN', 'longitudinalForceN', 'lateralForceN', 'brakeTorqueNm', 'driveTorqueNm',
          'chassisSupportLoadN', 'suspensionNormalLoadN', 'hardStopForceN', 'bumpStopForceN',
          'overtravelM', 'rawRequestedCompressionM', 'clampedCompressionM',
          'absModulation', 'gripCoefficient', 'validTreadContact', 'compressionM', 'terrainTriangleId', 'terrainSampleSource', 'supportFamilyId'])
      }]))
    } : null
  };
}
export function captureRaceHandlingSetup(editor) {
  const runner = editor.playtestSession?.vehicleDynamicsRunner;
  const car = editor.getRaceSessionCar?.() || editor.selectedCar;
  const tuning = car && editor.getRaceCarTuning
    ? editor.getRaceCarTuning(car, {transmissionType: editor.playtestSession?.transmissionType})
    : runner?.config?.tuning || car?.tuning;
  return {carId: car?.id ?? null, carName: car?.name ?? null,
    config: scalarSettings(runner?.config), tuning: scalarSettings(tuning)};
}
