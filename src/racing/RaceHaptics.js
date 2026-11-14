import {PhoneHaptics} from './PhoneHaptics.js';
import {getAuthoritativeChassisState} from './simulation/VehicleState.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../ui/serverPreferences.js';
import {openEditorForm} from '../ui/shared/editorForm.js';
const clamp=(v,max=1)=>Math.max(0,Math.min(max,Number(v)||0));
export const HAPTIC_DEFAULTS=Object.freeze({enabled:true,strength:.65,road:.7,slip:.85,braking:.6,impacts:.9,phonePulse:16,output:'auto'});
export function normalizeHaptics(value={}){return {...HAPTIC_DEFAULTS,...Object.fromEntries(['strength','road','slip','braking','impacts'].map(k=>[k,clamp(value[k]??HAPTIC_DEFAULTS[k])])),phonePulse:Math.max(8,Math.min(30,Number(value.phonePulse)||16)),enabled:value.enabled!==false,output:['auto','phone','controller'].includes(value.output)?value.output:'auto'};}
export function raceHapticSample(session,previous={},dt=.016,input={}){
 const state=getAuthoritativeChassisState(session)||{},patches=state.contactPatches||{},wheels=session.wheelContacts3d||{};
 const speed=Math.abs(Number(session.speedMps)||0),motion=clamp((speed-.5)/18);
 let road=0,slip=0,bump=0,contacts=0,frontSlip=0,rearSlip=0,loadTexture=0;
 for(const id of ['fl','fr','rl','rr']){
  const p=patches[id]||{},w=wheels[id]||{};
  if(session.airborne||p.validTreadContact===false||(Number(p.normalLoadN??w.normalLoadN)||0)<20)continue;
  contacts++;
  const material=p.material||{},surface=String(material.surfaceId||w.surfaceId||'asphalt').toLowerCase();
  const texture=/gravel|rock/.test(surface)?.75:/dirt|grass|mud|sand/.test(surface)?.55:/snow/.test(surface)?.3:.08;
  road+=Math.max(texture,clamp(material.roughness))*.25;
  slip+=clamp((Math.max(Math.abs(Number(p.slipRatio??w.longitudinalSlipRatio)||0),Math.abs(Math.tan(Number(p.slipAngleRad)||0)),Number(w.slipLateral)||0)-.1)/.6)*.25;
  const lateral=clamp((Math.abs(Number(p.slipAngleRad)||0)-.06)/.22)*.5;
  if(id[0]==='f')frontSlip+=lateral;else rearSlip+=lateral;
  const load=Number(p.normalLoadN??w.normalLoadN)||0;
  const lastLoad=previous.loads?.[id];
  if(Number.isFinite(lastLoad)&&lastLoad>20){
   // Rate of tire loading gives road detail even on the same surface material.
   loadTexture+=clamp(Math.abs(load-lastLoad)/Math.max(load,lastLoad,500)/Math.max(.008,dt)/12)*.25;
  }
  const compression=Number(w.compressionRatio??p.compressionRatio)||0;
  if(previous.compression?.[id]!=null)bump=Math.max(bump,clamp(Math.abs(compression-previous.compression[id])/Math.max(.008,dt)/9));
 }
 const now=Number(session.elapsedMs)||0;
 const landing=session.lastLandingImpactAtMs!==previous.landing&&now-Number(session.lastLandingImpactAtMs)<150?clamp((Number(session.lastLandingImpactMps)-1)/8):0;
 const collisions=session.vehicleDynamicsRunner?.impactHistory;
 const impactEvent=collisions?.at(-1),collisionSequence=impactEvent?.sequence??0;
 const collision=previous.collision!=null&&collisionSequence!==previous.collision?.value&&collisionSequence>0?clamp(Number(impactEvent?.bodyNormalImpulseNs)/7000):0;
 const abs=Number(input.brakeAxis||input.brake||0)>0&&Object.values(state.powertrainState?.absModulationByWheel||{}).some(v=>Number(v)<.95);
 const phase=(Number(session.projectedDistance)||now/1000)*2.7;
 const texturePulse=.55+.25*Math.sin(phase)+.2*Math.sin(phase*2.39);
 return {frontSlip:frontSlip*clamp(speed/4),rearSlip:rearSlip*clamp(speed/4),road:clamp(road*motion*texturePulse+loadTexture*motion*.6),bump:bump*motion,slip:slip*clamp(speed/4),braking:contacts&&abs&&speed>2?(.4+.6*(Math.sin(now*.065)>0)):0,impact:Math.max(landing,collision),
  previous:{loads:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,Number(patches[id]?.normalLoadN??wheels[id]?.normalLoadN)||0])),landing:session.lastLandingImpactAtMs,collision:{value:collisionSequence},compression:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,Number(wheels[id]?.compressionRatio??patches[id]?.compressionRatio)||0]))}};
}
// Names are hints only: Gamepad has no standardized wheel device class.
export function drivingDeviceStatus(navigator, gamepadIndex=null, failed=new WeakSet()) {
 let pads=[];
 try { pads=Array.from(navigator?.getGamepads?.()||[]); } catch {}
 const pad=pads.find(p=>p?.connected&&p.index===gamepadIndex)||pads.find(p=>p?.connected);
 const name=String(pad?.id||'Unnamed controller');
 const wheel=Boolean(pad&&/steering|racing wheel|driving force|fanatec|moza|\b(?:g25|g27|g29|g920|g923|t150|t248|t300|t500|t818|ts-pc|ts-xw)\b/i.test(name));
 const actuator=rumbleActuator(pad,failed);
 return {name:pad?name:null,kind:!pad?'phone':wheel?'wheel':/backbone/i.test(name)?'backbone':'controller',
  rumble:Boolean(actuator),phone:typeof navigator?.vibrate==='function',forceFeedback:false};
}
function rumbleActuator(pad,failed) {
 if(!pad?.connected)return null;
 return [pad.vibrationActuator,...Array.from(pad.hapticActuators||[])].find(a=>a&&!failed.has(a)&&
  (typeof a.pulse==='function'||(typeof a.playEffect==='function'&&(!a.effects||Array.from(a.effects).includes('dual-rumble')))))||null;
}
export function drivingDeviceDescription(status) {
 const device=status.name?`Detected ${status.kind==='wheel'?'likely steering wheel':status.kind}: ${status.name}.`:'No controller detected. Press a controller button and reopen to detect it.';
 const feedback=status.rumble?'Controller rumble is exposed by this browser.':status.phone?'No controller rumble; Auto uses phone vibration if the device permits it.':'Neither controller rumble nor phone vibration is exposed by this browser.';
 return `${device}\n${feedback}\nWheel steering resistance is unavailable in this browser integration. Wheel detection does not configure pedal mappings.`;
}
export class RaceHaptics {
 constructor({navigator=globalThis.navigator,document=globalThis.document,window=globalThis.window,load=loadServerPreferenceAsync,save=saveServerPreference,now}={}){
  Object.assign(this,{navigator,document,loadPreference:load,savePreference:save});this.phoneOutput=new PhoneHaptics(navigator,now);this.settings={...HAPTIC_DEFAULTS};this.failed=new WeakSet();this.previous={};this.elapsed=0;this.revision=0;
  this.onBlur=()=>{this.suspended=true;this.stop();};this.onFocus=()=>{this.suspended=false;};
  window?.addEventListener?.('blur',this.onBlur);window?.addEventListener?.('focus',this.onFocus);window?.addEventListener?.('pagehide',this.onBlur);
  document?.addEventListener?.('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
 async load(){const revision=this.revision;try{const value=await this.loadPreference('race-haptics',{});if(this.revision===revision)this.settings=normalizeHaptics(value);}catch{}}
 setSettings(value){this.revision++;this.settings=normalizeHaptics(value);this.stop();}
 stop(){
  this.phoneOutput.stop();this.pendingCues={};
  if(this.actuator){try{const result=this.actuator.reset?.()??this.actuator.pulse?.(0,0);Promise.resolve(result).catch(()=>{});}catch{}this.actuator=null;}
  this.previous={};this.session=null;this.elapsed=0;this.strong=0;this.weak=0;this.kick=0;
 }
 update(session,input,dt,{active=false,gamepadIndex=null}={}){
  if(this.testing)return;
  if(!active||!this.settings.enabled||!this.settings.strength||this.document?.hidden||this.suspended){this.stop();return;}
  const generation=getAuthoritativeChassisState(session)?.vehicleResetGeneration||0;
  if(this.session!==session||this.resetGeneration!==generation){this.stop();this.session=session;this.resetGeneration=generation;}
  this.gamepadIndex=gamepadIndex;
  const seconds=clamp(dt,.1),sample=raceHapticSample(session,this.previous,seconds,input);this.previous=sample.previous;
  this.kick=Math.max(sample.impact,this.kick*Math.exp(-seconds/0.13));
  const s=this.settings,alpha=1-Math.exp(-seconds/0.045);
  const strong=clamp(sample.rearSlip*s.slip*.5+sample.road*s.road*.65+sample.bump*s.road*.65+this.kick*s.impacts);
  const weak=clamp(Math.max(sample.slip,sample.frontSlip)*s.slip*.8+sample.braking*s.braking*.7+sample.road*s.road*.35);
  this.strong+=(strong-this.strong)*alpha;this.weak+=(weak-this.weak)*alpha;
  const cues={frontSlip:sample.frontSlip*s.slip*s.strength,rearSlip:sample.rearSlip*s.slip*s.strength,road:sample.road*s.road*s.strength,bump:sample.bump*s.road*s.strength,slip:sample.slip*s.slip*s.strength,braking:sample.braking*s.braking*s.strength,impact:sample.impact*s.impacts*s.strength};
  // Preserve brief bumps/ABS events between output ticks. Impacts bypass the
  // ordinary rumble tick so a collision isn't delayed or smoothed away.
  for(const key of Object.keys(cues))this.pendingCues[key]=Math.max(this.pendingCues[key]||0,cues[key]);
  this.elapsed+=seconds;if(this.elapsed<.09&&cues.impact<.06)return;this.elapsed=0;
  this.send(Math.max(this.strong*s.strength,cues.impact),this.weak*s.strength,gamepadIndex,this.pendingCues);
  this.pendingCues={};
 }
 send(strong,weak,gamepadIndex=this.gamepadIndex??null,cues=null){
  let pad;try{const pads=this.navigator?.getGamepads?.()||[];pad=gamepadIndex!=null?pads[gamepadIndex]:Array.from(pads).find(p=>p?.connected);}catch{}
  const candidate=rumbleActuator(pad,this.failed);
  const actuator=this.settings.output!=='phone'&&candidate&&!this.failed.has(candidate)?candidate:null;
  if(this.actuator&&this.actuator!==actuator){try{Promise.resolve(this.actuator.reset?.()).catch(()=>{});}catch{}this.actuator=null;}
  if(Math.max(strong,weak)<.015&&!cues){if(this.actuator){try{Promise.resolve(this.actuator.reset?.()).catch(()=>{});}catch{}this.actuator=null;}return;}
  if(actuator&&(actuator.playEffect||actuator.pulse)){
   this.phoneOutput.stop();
   this.actuator=actuator;
   try{const result=actuator.playEffect?actuator.playEffect('dual-rumble',{duration:115,startDelay:0,strongMagnitude:clamp(strong),weakMagnitude:clamp(weak)}):actuator.pulse(clamp(Math.max(strong,weak)),115);
    Promise.resolve(result).then(result=>{if(result===false)this.failed.add(actuator);}).catch(error=>{if(error?.name!=='InvalidStateError')this.failed.add(actuator);});}catch{this.failed.add(actuator);}return;
  }
  if(this.settings.output==='controller'||!this.navigator?.vibrate)return;
  this.phoneOutput.play(cues||{road:weak>strong?0:strong,slip:weak>strong?weak:0},this.settings.phonePulse);
 }
 async test(values=this.settings){
    const saved=this.settings;this.settings=normalizeHaptics(values);this.testing=true;
    try{if(!this.settings.enabled)return;for(const cue of [{road:.3},{frontSlip:.85},{rearSlip:.85},{braking:.6},{impact:.9}]){if(this.suspended||this.document?.hidden)break;this.send(Math.max(cue.road||0,cue.impact||0)*this.settings.strength,Math.max(cue.slip||0,cue.frontSlip||0,cue.rearSlip||0,cue.braking||0)*this.settings.strength,undefined,Object.fromEntries(Object.entries(cue).map(([key,value])=>[key,value*this.settings.strength])));await new Promise(r=>setTimeout(r,900));}}
    finally{this.stop();this.testing=false;this.settings=saved;}
 }
 async options(){
  this.stop();
  const value=await openEditorForm('Driving vibration',[
   ...(this.wheelSettings?[{type:'button',label:'Steering wheel / pedals / force feedback',onClick:()=>this.wheelSettings()}]:[]),
   {id:'enabled',type:'checkbox',label:'Enable driving vibration',value:this.settings.enabled},
   {id:'output',label:'Vibrate',value:this.settings.output,options:[{value:'auto',label:'Controller if supported, otherwise phone'},{value:'phone',label:'Phone'},{value:'controller',label:'Controller only'}]},
   ...[['strength','Overall strength'],['road','Road texture / off-road bumps'],['slip','Skids / wheelspin'],['braking','ABS chatter'],['impacts','Collisions / landings']].map(([id,label])=>({id,label,type:'range',min:0,max:1,step:.05,value:this.settings[id],format:v=>`${Math.round(v*100)}%`})),
   {id:'phonePulse',type:'range',label:'Phone minimum pulse (ms) — raise if taps are too faint',min:8,max:30,step:1,value:this.settings.phonePulse},
   {type:'button',label:'Test: road → front → rear → ABS → hit',onClick:async values=>{
    await this.test(values);
   }}
  ],{});
  this.stop();if(value){this.setSettings(value);const saved=await this.savePreference('race-haptics',this.settings);if(saved?.ok===false)throw Error('Could not save vibration settings');}
 }
}
