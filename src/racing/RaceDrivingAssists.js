import {paceNoteLookahead, callSeconds, codriverBody, codriverChain, codriverPhrase, speakCodriver, updateCodriverEvents} from './RaceCodriver.js';
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

  let result = null;
  for (const call of calls || []) {
    let remaining = call.at - distance;
    if (circuit) remaining = ((remaining % length) + length) % length;
    if (remaining >= 0 && (preview || remaining <= paceNoteLookahead(call, speed)) && (!result || remaining < result.remaining)) result = {...call, remaining};
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
  const circuit=session.routeRuntimeType==='circuit',lap=Number(session.lap||1);
  state.noteAnnouncements ||= new Map();state.spokenNotes ||= new Set();
  if(state.noteLap!==lap){
    state.noteLap=lap;
    for(const key of state.noteAnnouncements.keys())if(Number(key.split(':')[0])<lap-1){state.noteAnnouncements.delete(key);state.spokenNotes.delete(key);}
  }
  const calls=[...(session.codriverCalls||[])];
  if(session.routeLength>0&&(!circuit||lap>=Number(editor.selectedRace.laps||1)))
    calls.push({id:'stage-finish',at:session.routeLength,text:'Over finish',kind:'finish'});
  const ahead=calls.map((call,index)=>{
    const note=nextRacePaceNote([call],distance,session.speedMps,session.routeLength,circuit&&call.kind!=='finish',{preview:true});
    if(!note)return null;
    const callLap=lap+(circuit&&note.at<distance?1:0);
    if(circuit&&callLap>Number(editor.selectedRace.laps||1))return null;
    return {...note,key:`${callLap}:${call.id||index}:${call.at}`};
  }).filter(Boolean).sort((a,b)=>a.remaining-b.remaining);
  state.upcomingTurn=active&&(settings.line||settings.notes)&&!state.wrongWay?ahead[0]||null:null;
  const available=active&&settings.notes&&!state.wrongWay;
  const pending=available?ahead.filter(n=>!state.spokenNotes.has(n.key)):[];
  const first=pending[0];
  const candidates=codriverChain(pending,Math.max(0,session.speedMps||0));
  const readingLead=Math.min(450,Math.max(0,session.speedMps||0)*(1.5+candidates.reduce((sum,n)=>sum+callSeconds(codriverBody(n)),0)));
  const due=first&&first.remaining<=Math.max(readingLead,paceNoteLookahead(first,session.speedMps,state.grip,state.brakeCondition));
  const chain=due?candidates:[];
  for(const note of chain){
    if(!state.noteAnnouncements.has(note.key))state.noteAnnouncements.set(note.key,{distance:Math.round(note.remaining/10)*10,text:codriverBody(note)});
    note.announcedDistance=state.noteAnnouncements.get(note.key).distance;
  }
  // Once announced, an icon remains until passing its marker, even after slowing.
  state.notes=available?ahead.filter(n=>state.noteAnnouncements.has(n.key)).map(note=>{
    const announcement=state.noteAnnouncements.get(note.key);
    return {...note,announcedDistance:announcement.distance,displayText:announcement.distance>0?`${announcement.distance} m · ${announcement.text}`:announcement.text};
  }):[];
  state.note=state.notes[0]||null;
  updateCodriverEvents(state,session,dt,{enabled:settings.notes&&settings.voice,
    paused:editor.raceInput.paused||session.carEditorPreview,intro:session.raceIntro?.active,
    active:active&&!state.wrongWay,roadDue:!!due,nextRemaining:ahead[0]?.remaining??Infinity});
  if(available&&settings.voice&&chain.length&&speakCodriver(state,codriverPhrase(chain.map(n=>({...n,announcedDistance:Math.round(n.remaining/10)*10})))))
    {for(const note of chain)state.spokenNotes.add(note.key);state.speechKeys=chain.map(n=>n.key);}
}
