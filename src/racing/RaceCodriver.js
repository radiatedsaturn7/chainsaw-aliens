// Calls are scheduled against travel time, not a fixed distance. This is our
// calibration, not a reproduction of any commercial game's private algorithm.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const codriverBody=note=>String(note.body||(Number.isFinite(note.linkedAt)?note.text.replace(/,\s*(?:into|and)\s+.*$/i,''):note.text)||'')
  .replace(/^Brake,\s*/i,'').replace(/\b(?:meters|metres)\b/gi,'').replace(/\s+/g,' ').trim();
export const callSeconds=text=>.4+String(text).split(/\s+/).length/3.2;
export function paceNoteLookahead(note,speed,grip=1,brakeCondition=1){
  const v=Math.max(0,Number(speed)||0),target=Number(note.recce?.minimumSpeedMps??note.recce?.apexSpeedMps);
  const braking=Number.isFinite(target)?Math.max(0,(v*v-target*target)/(2*clamp(6*grip*brakeCondition,1.5,7))):0;
  return clamp(Math.max(v*(2+callSeconds(codriverBody(note))),braking+v*1.5),30,450);
}
export function codriverChain(notes,speed){
  const chain=[];let duration=0;
  for(const note of notes){
    const previous=chain.at(-1);
    const gap=previous?note.remaining-previous.remaining-(previous.spanM||0):0;
    const seconds=callSeconds(codriverBody(note));
    if(previous&&(gap>50||note.remaining>Math.max(80,speed*9)||duration+seconds>7.5||chain.length>=3))break;
    chain.push({...note,connector:previous?(gap<20?'into':'and'):null});duration+=seconds;
  }
  return chain;
}
export function codriverPhrase(chain){
  return chain.map((note,i)=>`${i?note.connector+' ':note.announcedDistance>=30?note.announcedDistance+' ':''}${codriverBody(note)}`).join(', ');
}
export function stopCodriver(state){
  if(state?.utterance){globalThis.speechSynthesis?.cancel?.();state.utterance=null;
    for(const key of state.speechKeys||[])state.spokenNotes?.delete(key);state.speechKeys=[];}
}
export function speakCodriver(state,text,kind='road'){
  const speech=globalThis.speechSynthesis;
  if(!speech||!globalThis.SpeechSynthesisUtterance)return false;
  if(state.utterance&&(kind==='countdown'||(kind==='road'&&state.speechKind==='chatter')))stopCodriver(state);
  if(speech.speaking||speech.pending)return false;
  const utterance=new globalThis.SpeechSynthesisUtterance(text);utterance.rate=kind==='countdown'?1.3:1.15;
  utterance.onend=()=>{if(state.utterance===utterance){state.utterance=null;state.speechKeys=[];}};
  utterance.onerror=()=>{if(state.utterance===utterance){
    state.utterance=null;for(const key of state.speechKeys||[])state.spokenNotes?.delete(key);state.speechKeys=[];
  }};
  try{speech.speak(utterance);state.utterance=utterance;state.speechKind=kind;return true;}catch{return false;}
}
const chatter={
 suspension:'Careful with the suspension.',brakes:'The brakes are damaged. Give yourself more room.',
 tires:'Tire damage. Watch the grip.',engine:'Engine damage. Take care of it.',transmission:'Transmission damage. Take it easy.'
};
export function updateCodriverEvents(state,session,dt,{enabled,paused,intro,active,roadDue=false,nextRemaining=Infinity}){
  state.chatterClock=(state.chatterClock||0)+(paused?0:Math.max(0,dt));
  const now=state.chatterClock;
  const impact=session.vehicleDynamicsRunner?.impactHistory?.at(-1);
  const sequence=impact?.sequence;
  if(sequence!=null&&sequence!==state.impactSequence){
    state.impactSequence=sequence;
    if(Number(impact.bodyNormalImpulseNs)>2500&&now-(state.lastCrash??-30)>15){
      const phrases=["That was a hard hit. Are you okay?","We're still here. Let's get back on the road.","Take a breath. Find your line again."];
      state.pendingChatter={text:phrases[(state.crashCount||0)%phrases.length],expires:now+8};
      state.crashCount=(state.crashCount||0)+1;state.lastCrash=now;
    }
  }
  state.damageBands ||= {};
  for(const [part,text] of Object.entries(chatter)){
    const raw=session.damage?.[part];
    const amount=typeof raw==='number'?raw:Math.max(0,...Object.values(raw||{}).map(Number));
    const band=amount>=70?2:amount>=35?1:0;
    if(band>(state.damageBands[part]||0))state.pendingChatter={text,expires:now+12};
    state.damageBands[part]=band;
  }
  if(!enabled||paused||intro){stopCodriver(state);state.pendingChatter=null;return;}
  const remaining=Number(session.countdownRemainingMs)||0;
  if(remaining>0){
    const beat=remaining>1000?Math.ceil((remaining-1000)/1000):0;
    if(beat<=5&&beat!==state.countdownBeat&&speakCodriver(state,beat?String(beat):'Go!','countdown'))state.countdownBeat=beat;
    return;
  }
  if(!active){stopCodriver(state);state.pendingChatter=null;return;}
  if(state.pendingChatter?.expires<now)state.pendingChatter=null;
  // No chatter while a call is due or within ten seconds of the next feature.
  if(!roadDue&&nextRemaining>Math.max(80,Math.abs(session.speedMps||0)*10)&&state.pendingChatter&&now-(state.lastChatter??-30)>20){
    if(speakCodriver(state,state.pendingChatter.text,'chatter')){state.lastChatter=now;state.pendingChatter=null;}
  }
}
