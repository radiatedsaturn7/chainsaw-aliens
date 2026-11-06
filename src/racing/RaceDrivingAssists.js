import {getRaceAiPlannedSpeed} from './RaceAiRoadPlan.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const drivingGuideSettings = race => ({line: race?.drivingGuide?.line !== false,
  notes: race?.codriver?.enabled === true, voice: race?.codriver?.spoken === true});

// A virtual recce records steering, speed and pedal demand plus apex hazards.
export {analyzeRaceRecce as analyzeRaceDrivingRoute} from './RaceRecce.js';

export function racePaceNotes(race, generated = []) {
  const manual = (race?.codriver?.calls || []).filter(c => !c.generated && Number.isFinite(c.at) && typeof c.text === 'string');
  return [...manual, ...generated.filter(c => !manual.some(m => Math.abs(m.at - c.at) < 35))].sort((a,b) => a.at-b.at);
}

export function nextRacePaceNote(calls, distance, speed, length, circuit = false, {preview = false} = {}) {
  const ahead = clamp(Math.abs(speed) * 4, 65, 260);
  let result = null;
  for (const call of calls || []) {
    let remaining = call.at - distance;
    if (circuit) remaining = ((remaining % length) + length) % length;
    const brakingLead = Number.isFinite(call.recce?.apexSpeedMps) ? Math.max(0, (speed*speed-call.recce.apexSpeedMps**2)/(2*4)) + Math.abs(speed)*2 : 0;
    if (remaining >= 0 && (preview || remaining <= Math.min(500, Math.max(ahead, brakingLead))) && (!result || remaining < result.remaining)) result = {...call, remaining};
  }
  if(result?.recce?.braking && Math.abs(speed) <= result.recce.apexSpeedMps+2) result.text=result.text.replace(/^Brake, /,'');
  return result;
}

// Detect actual travel against the route, including reversing. Facing backwards
// while stopped is not a warning. Teleports/reset discontinuities clear the latch.
export function updateWrongWay(state, {x, z, yaw, dt, active}) {
  const previous = state.position;
  state.position = {x, z};
  if (!active || !previous || !(dt > 0) || dt > .5) {
    state.wrongSeconds = 0; state.wrongWay = false; return;
  }
  const dx = x - previous.x, dz = z - previous.z;
  const travel = Math.hypot(dx, dz);
  if (travel > Math.max(20, dt * 130)) {state.wrongSeconds = 0; state.wrongWay = false; return;}
  const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const backwards = travel / dt > 1.5 && forward < -travel * .45;
  state.wrongSeconds = backwards ? Math.min(2, (state.wrongSeconds || 0) + dt) : Math.max(0, (state.wrongSeconds || 0) - dt * 3);
  if (state.wrongSeconds >= .8) state.wrongWay = true;
  if (state.wrongSeconds <= .1) state.wrongWay = false;
}

export function drivingSpeedAdvice(plan, distance, speed, grip = 1, tuning = {}, brakeCondition = 1) {
  if (!plan) return {action: 'COAST', color: '#ffd34e', target: 0};
  const traction = clamp(grip, .08, 1.2) * clamp(Number(tuning.tireGrip) || 1, .35, 1.4);
  const lateral = 9.81 * traction * .78;
  const capability = Number.isFinite(tuning.brakeForceN) && Number.isFinite(tuning.weightKg)
    ? tuning.brakeForceN / Math.max(450, tuning.weightKg) : 9.81;
  const deceleration = Math.min(9.81 * traction * .8, capability) * clamp(brakeCondition, 0, 1);
  const target = getRaceAiPlannedSpeed(plan, distance, Math.abs(speed), lateral, deceleration);
  return speed > target + 1 ? {action:'BRAKE',color:'#ff5252',target}
    : speed > target - 3 ? {action:'COAST',color:'#ffd34e',target}
    : {action:'ACCELERATE',color:'#51ed91',target};
}

export function updateRaceDrivingAssists(editor, dt) {
  const session = editor.playtestSession;
  if (!session) return;
  const state = session.drivingAssists ||= {};
  const active = !editor.raceInput.paused && !session.raceResults && !session.carEditorPreview
    && !(session.countdownRemainingMs > 0) && !session.raceIntro?.active && !(session.edgeResetFadeMs > 0);
  const distance = session.projectedDistance ?? session.distance ?? 0;
  const pose = editor.getRaceWorldPoseAtDistance(distance, {runtimeType:session.routeRuntimeType});
  updateWrongWay(state, {x:session.worldX, z:session.worldZ, yaw:pose.yaw, dt, active});
  state.active = active;
  state.grip = Number(session.tireSlip?.gripFactor ?? 1);
  // gripFactor already includes tires, setup, damage and live weather.
  const car = editor.getRaceSessionCar(session) || editor.selectedCar;
  if (state.car !== car || !state.tuning) {
    state.car = car;
    state.tuning = {...editor.getRaceCarTuning(car), tireGrip:1};
  }
  const brakes = session.vehicleDynamicsRunner?.state?.mechanical?.effects?.brakes || {};
  state.brakeCondition = Math.min(1, ...Object.values(brakes).map(v => clamp(Number(v) || 0, 0, 1)));
  const settings = drivingGuideSettings(editor.selectedRace);
  state.note = active && settings.notes && !state.wrongWay
    ? nextRacePaceNote(session.codriverCalls, distance, session.speedMps, session.routeLength, session.routeRuntimeType === 'circuit') : null;
  state.upcomingTurn = active && (settings.line || settings.notes) && !state.wrongWay
    ? nextRacePaceNote(session.codriverCalls,distance,session.speedMps,session.routeLength,session.routeRuntimeType==='circuit',{preview:true}) : null;
  // Speech is opt-in and feature-detected; the readable note always remains.
  if (state.note && settings.voice && globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance) {
    const lap = Number(session.lap || 1);
    const key = `${lap}:${state.note.at}:${state.note.text}`;
    if (state.spokenKey !== key && !globalThis.speechSynthesis.speaking) {
      const utterance = new SpeechSynthesisUtterance(`${Math.round(state.note.remaining / 10) * 10} metres. ${state.note.text}`);
      utterance.rate = 1.15;
      try { globalThis.speechSynthesis.speak(utterance); } catch { /* Text remains available. */ }
      state.spokenKey = key;
    }
  }
}
