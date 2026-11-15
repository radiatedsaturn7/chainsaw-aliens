// Advice requires sustained measured evidence. No input/physics modifications.
const rules=[
 {id:'heat',seconds:2,text:'Engine running hot. Ease off and check coolant when we stop.'},
 {id:'brakes',seconds:2,text:'Hot brakes are losing stopping power. Brake earlier and give them time to cool.'},
 {id:'suspension',seconds:.6,text:'The suspension is bottoming out. Slow down over these bumps; check ride height and suspension setup.'},
 {id:'wheelspin',seconds:2,text:'The driven tires are spinning. Ease onto the throttle; consider traction control or tires for this surface.'},
 {id:'clutch',seconds:3,text:'The clutch is still slipping at low speed. Ease off, then try again. Check the clutch under Repair if it persists.'}
];
export function updateVehicleFeedback(session,physics,controls,dt,{active=true}={}){
 const state=session.vehicleFeedback ||= {clock:0,timers:{},lastSaid:{},current:null,pending:null};
 if(!active){for(const rule of rules)state.timers[rule.id]=0;state.pending=null;state.sampleElapsed=0;return state;}
 const elapsed=Math.min(.25,Math.max(0,Number(dt)||0));state.clock+=elapsed;
 state.sampleElapsed=(state.sampleElapsed||0)+elapsed;
 if(state.sampleElapsed<.2)return state;
 const seconds=state.sampleElapsed;state.sampleElapsed=0;
 if(state.current&&state.current.expires<state.clock)state.current=null;
 if(state.pending&&state.pending.expires<state.clock)state.pending=null;
 const mechanical=physics?.mechanical||session.mechanical;
 const wheels=physics?.contactPatches||{};
 const power=physics?.powertrainState;
 const speed=Math.abs(physics?.bodyLongitudinalSpeedMps??physics?.groundSpeedMps??Infinity);
 const throttle=controls?.throttle;
 const straight=Math.abs(physics?.bodyLateralSpeedMps??Infinity)<1.5;
 const powered=throttle>.3&&controls?.brake<.05&&controls?.handbrake<.05;
 let spinning=false,bottoming=false,supported=0;
 for(const id of ['fl','fr','rl','rr']){
  const w=wheels[id];if(!w||w.validTreadContact!==true||!(w.normalLoadN>200))continue;
  supported++;
  if(Math.abs(w.driveTorqueNm)>20&&Math.abs(w.rawSlipRatio)>.3)spinning=true;
  if(w.hardStopForceN>w.normalLoadN*.25&&w.overtravelM>.005)bottoming=true;
 }
 const conditions={
  heat:mechanical?.config?.enabled===true&&mechanical.engineRunning===true&&mechanical.coolantTemperatureC>110,
  brakes:mechanical?.config?.enabled===true&&['fl','fr','rl','rr'].some(id=>mechanical.tires?.[id]?.brakeTemperatureC>500&&mechanical.effects?.brakes?.[id]<.8),
  suspension:bottoming&&speed>2,
  wheelspin:powered&&straight&&spinning&&supported>=2,
  clutch:powered&&straight&&supported>=2&&!spinning&&speed<4&&Math.abs(power?.gear)===1&&power?.clutchCoupling>.01&&power.clutchCoupling<.75&&power.engineRpm>1200&&power.shiftTimeRemainingSeconds<=0
 };
 for(const rule of rules){
  state.timers[rule.id]=conditions[rule.id]?(state.timers[rule.id]||0)+seconds:0;
 }
 // Expire advice as soon as the evidence clears; never speak a stale diagnosis.
 if(state.pending&&!conditions[state.pending.id])state.pending=null;
 if(state.current&&!conditions[state.current.id])state.current=null;
 for(const rule of rules){
  if(state.timers[rule.id]<rule.seconds)continue;
  if(!state.current||state.current.id!==rule.id)state.current={id:rule.id,text:rule.text,expires:state.clock+10};
  if(!state.pending&&state.clock-(state.lastSaid[rule.id]??-60)>=45){
   state.pending={id:rule.id,text:rule.text,expires:state.clock+8};
   state.lastSaid[rule.id]=state.clock;
  }
  break;
 }
 return state;
}
export function vehicleFeedbackRows(session){
 const text=session?.vehicleFeedback?.current?.text||'No sustained problem detected. Telemetry may be unavailable; this is not a full inspection.';
 const lines=[];let line='';
 for(const word of text.split(' ')){
  if(line.length+word.length+1>40){lines.push(line);line='';}
  line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 return lines.slice(0,7).map((label,i)=>({id:`vehicle-feedback-${i}`,label,value:'',disabled:true}));
}
