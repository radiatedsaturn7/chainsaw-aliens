import {getRaceAiPlannedSpeed} from './RaceAiRoadPlan.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const drivingGuideSettings = race => ({line: race?.drivingGuide?.line !== false,
  notes: race?.codriver?.enabled === true, voice: race?.codriver?.spoken === true,
  icons: race?.codriver?.icons ?? race?.codriver?.spoken !== true});

export function racePaceNoteModeLabel(race) {
  const settings = drivingGuideSettings(race);
  return !settings.notes ? 'Off' : settings.voice ? (settings.icons ? 'Both' : 'Voice') : 'Icons';
}

// A virtual recce records steering, speed and pedal demand plus apex hazards.
export {analyzeRaceRecce as analyzeRaceDrivingRoute} from './RaceRecce.js';

export function racePaceNotes(race, generated = []) {
  const manual = (race?.codriver?.calls || []).filter(c => !c.generated && Number.isFinite(c.at) && typeof c.text === 'string');
  return [...manual, ...generated.filter(c => !manual.some(m => Math.abs(m.at - c.at) < 35))].sort((a,b) => a.at-b.at);
}

export function nextRacePaceNote(calls, distance, speed, length, circuit = false, {preview = false} = {}) {
  const ahead = 100;
  let result = null;
  for (const call of calls || []) {
    let remaining = call.at - distance;
    if (circuit) remaining = ((remaining % length) + length) % length;
    if (remaining >= 0 && (preview || remaining <= ahead) && (!result || remaining < result.remaining)) result = {...call, remaining};
  }
  if(result)result.text=result.text.replace(/^Brake,\s*/i,'');
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
  state.notes = active && settings.notes && !state.wrongWay
    ? (session.codriverCalls||[]).map(call=>nextRacePaceNote([call],distance,session.speedMps,session.routeLength,session.routeRuntimeType==='circuit')).filter(Boolean).sort((a,b)=>a.remaining-b.remaining) : [];
  state.note=state.notes[0]||null;
  state.upcomingTurn = active && (settings.line || settings.notes) && !state.wrongWay
    ? nextRacePaceNote(session.codriverCalls,distance,session.speedMps,session.routeLength,session.routeRuntimeType==='circuit',{preview:true}) : null;
  // Capture the distance once on entering call range. Speed changes must not
  // turn a single corner into a countdown or cause another spoken call.
  const lap=Number(session.lap||1);
  state.noteAnnouncements ||= new Map();state.spokenNotes ||= new Set();
  if(state.noteLap!==lap){
    state.noteLap=lap;
    for(const key of state.noteAnnouncements.keys())if(Number(key.split(':')[0])<lap-1){state.noteAnnouncements.delete(key);state.spokenNotes.delete(key);}
  }
  const toSpeak=[];
  state.notes=state.notes.map(note=>{
    const callLap=lap+(session.routeRuntimeType==='circuit'&&note.at<distance?1:0);
    const key=`${callLap}:${note.id||''}:${note.at}`;
    if(!state.noteAnnouncements.has(key)){
      const metres=Math.round(note.remaining/10)*10;
      const text=(note.body||(Number.isFinite(note.linkedAt)?note.text.replace(/,\s*(?:into|and)\s+.*$/i,''):note.text)).replace(/^Brake,\s*/i,'').replace(/\b(?:meters|metres)\b/gi,'').replace(/\s+/g,' ').trim();
      state.noteAnnouncements.set(key,{distance:metres,text});
    }
    const announcement=state.noteAnnouncements.get(key);
    const visible={...note,announcedDistance:announcement.distance,displayText:announcement.distance>0?`${announcement.distance} m · ${announcement.text}`:announcement.text};
    if(!state.spokenNotes.has(key))toSpeak.push({key,text:announcement.distance>0?`${announcement.distance} ${announcement.text}`:announcement.text});
    return visible;
  });
  state.note=state.notes[0]||null;
  if(settings.voice&&active&&toSpeak.length&&globalThis.speechSynthesis&&globalThis.SpeechSynthesisUtterance&&!globalThis.speechSynthesis.speaking){
    const utterance=new SpeechSynthesisUtterance(toSpeak.map(call=>call.text).join(', '));utterance.rate=1.15;
    try{globalThis.speechSynthesis.speak(utterance);for(const call of toSpeak)state.spokenNotes.add(call.key);}catch{/* Retry while the call is still ahead. */}
  }
}
