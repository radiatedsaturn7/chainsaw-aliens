const WHEEL_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr']);
const HARD_EXIT_REASON = /(airborne|separation|wrong-suspension-side|invalid-terrain|terrain-unavailable|body-occlusion|sidewall|curb|step|discontinuity|gap|takeoff)/i;

export function createWheelContactPresentationState() {
  return {
    stepIndex: 0,
    wheels: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, {
      supported: false,
      coherentSteps: 0,
      chatterHoldSteps: 0,
      rawPhysicalContact: false,
      geometricProximity: false,
      loadBearing: false,
      terrainAvailable: true,
      transitionCount: 0,
      reason: 'uninitialized'
    }]))
  };
}

export function updateWheelContactPresentationState(current, {
  stepIndex = 0,
  wheelContactTelemetryByWheel = {},
  renderState = {}
} = {}) {
  const state = current?.wheels ? current : createWheelContactPresentationState();
  state.stepIndex = Math.max(state.stepIndex, Number(stepIndex || 0));
  for (const wheelId of WHEEL_IDS) {
    const previous = state.wheels[wheelId];
    const diagnostic = wheelContactTelemetryByWheel?.[wheelId] || {};
    const wheel = renderState.wheels?.[wheelId] || {};
    const finalValid = diagnostic.finalValidContact ?? wheel.validTreadContact === true;
    const validCount = Number(diagnostic.validContactSubstepCount
      ?? (finalValid ? 1 : 0));
    const proximityCount = Number(diagnostic.geometricProximitySubstepCount
      ?? (wheel.geometricContact ? 1 : 0));
    const maximumLoadN = Number(diagnostic.normalLoadN?.maximum
      ?? wheel.normalLoadN ?? 0);
    const terrainAvailable = wheel.terrainDataAvailable !== false
      && diagnostic.terrainAvailable !== false;
    const reason = String(diagnostic.finalInvalidReason
      ?? wheel.invalidContactReason ?? 'none');
    const hardExit = !terrainAvailable || HARD_EXIT_REASON.test(reason)
      || diagnostic.realDiscontinuity === true;
    const coherentEvidence = validCount > 0 && maximumLoadN > 1;
    const geometricProximity = proximityCount > 0 || wheel.geometricContact === true;
    let supported = previous.supported;
    if (hardExit) supported = false;
    else if (coherentEvidence) supported = true;
    else if (!(supported && geometricProximity && previous.chatterHoldSteps < 2)) supported = false;
    const changed = supported !== previous.supported;
    previous.supported = supported;
    previous.coherentSteps = coherentEvidence ? previous.coherentSteps + 1 : 0;
    previous.chatterHoldSteps = supported && !coherentEvidence
      ? previous.chatterHoldSteps + 1 : 0;
    previous.rawPhysicalContact = finalValid === true;
    previous.geometricProximity = geometricProximity;
    previous.loadBearing = maximumLoadN > 1;
    previous.terrainAvailable = terrainAvailable;
    previous.transitionCount += changed ? 1 : 0;
    previous.reason = hardExit ? reason : coherentEvidence
      ? 'coherent-load-bearing' : supported ? 'geometric-chatter-hold' : reason;
  }
  return state;
}
