// Session-only controls: left/right self-cancel; hazards never self-cancel.
export function setTurnSignal(session,mode){
 if(!session)return;
 const next=['left','right','hazards'].includes(mode)?mode:'off';
 session.turnSignals={mode:session.turnSignals?.mode===next?'off':next,elapsed:0,armed:false,centered:0};
}
export function advanceTurnSignals(session,seconds,steering=0){
 const s=session?.turnSignals;if(!s||s.mode==='off')return;
 const dt=Number.isFinite(seconds)?Math.max(0,seconds):0;
 s.elapsed=(s.elapsed+dt)%.8;
 if(s.mode==='hazards'||!Number.isFinite(steering))return;
 const direction=s.mode==='left'?-1:1;
 if(steering*direction>=.3)s.armed=true;
 if(s.armed){
  s.centered=Math.abs(steering)<.08?s.centered+dt:0;
  if(s.centered>=.15)s.mode='off';
 }
}
export function turnSignalLit(session,side){
 const s=session?.turnSignals;
 return !!s&&(s.mode===side||s.mode==='hazards')&&(Number(s.elapsed)||0)<.4;
}
