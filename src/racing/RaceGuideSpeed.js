import {getRaceServiceBrakeForceN} from './simulation/RaceSimulationConfig.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Read the same supported tire contacts used by physics. Their coefficients
// already contain compound, surface, wear, pressure and load sensitivity.
// Do not multiply tire grip a second time or infer grip from wheelspin.
export function raceGuideCapabilities(physics,tuning={},fallbackGrip=1,mechanical=physics?.mechanical,damage=physics?.damage){
 const mass=Math.max(100,Number(tuning.weightKg)||1450),weight=mass*9.81;
 const brakeForce=getRaceServiceBrakeForceN(tuning)*clamp(Number(tuning.brakePressure??1),.2,1.5);
 const frontBias=clamp(Number(tuning.frontBrakeBias??tuning.brakeBalance??.62),.4,.85),effects=mechanical?.effects?.brakes||{};
 let load=0,traction=0,braking=0,known=0;
 for(const id of ['fl','fr','rl','rr']){
  const p=physics?.contactPatches?.[id];
  if(!p||!Number.isFinite(p.normalLoadN)||!Number.isFinite(p.gripCoefficient))continue;
  known++;
  if(p.validTreadContact===false||p.normalLoadN<=0)continue;
  const n=p.normalLoadN,mu=Math.max(0,p.gripCoefficient);
  load+=n;traction+=mu*n;
  const brakeDamage=Number(damage?.brakes?.[id]??(typeof damage?.brakes==='number'?damage.brakes:0))||0;
  braking+=Math.min(mu*n,brakeForce*(id[0]==='f'?frontBias:1-frontBias)*.5*clamp(Number(effects[id]??1),0,1)*clamp(1-brakeDamage/125,.15,1));
 }
 if(known===4){
  // A landing load spike must not promise braking that persists down the road.
  const supportScale=Math.min(1,weight/Math.max(1,load));
  return {lateral:traction*supportScale/mass*.78,braking:braking*supportScale/mass*.8,
   grip:load>0?traction/load:0,live:true};
 }
 const mu=clamp(fallbackGrip,0,1.4);
 const condition=Math.min(1,...Object.values(effects).map(v=>clamp(Number(v)||0,0,1)));
 return {lateral:9.81*mu*.78,braking:Math.min(9.81*mu*.8,brakeForce/mass*condition),grip:mu,live:false};
}

// Player guidance has its own envelope: changing it never retunes AI or tires.
// Integrate gravity at every road station, not just the car's current slope.
export function raceGuidePlannedSpeed(plan,distance,speed,lateral,braking,{responseSeconds=.425}={}){
 if(!(lateral>0)||!(braking>0))return 0;
 const quantize=v=>Math.min(v,Math.max(.01,Math.floor(v*4)/4));
 const lat=quantize(lateral),decel=quantize(braking),key=`${lat}:${decel}`;
 const cache=plan.guideProfiles ||= new Map();
 let values=cache.get(key);
 if(!values){
  values=new Float64Array(plan.count);
  for(let i=0;i<values.length;i++){
   const grade=Number(plan.grade?.[i])||0,cos=1/Math.hypot(1,grade);
   values[i]=lat*cos*(1-(plan.risk?.[i]||0)*.35)/Math.max(.00001,plan.curvature[i]);
  }
  const end=plan.circuit?plan.count-1:plan.count;
  for(let pass=0;pass<(plan.circuit?2:1);pass++)for(let i=end-1;i>=0;i--){
   const next=plan.circuit?(i+1)%end:Math.min(end-1,i+1);
   if(next===i)continue;
   const grade=Number(plan.grade?.[i])||0,cos=1/Math.hypot(1,grade);
   // Turning consumes part of the same tire-force budget used for braking.
   const cornerUse=clamp(values[next]*Math.max(plan.curvature[i],plan.curvature[next])/(lat/.78*cos),0,1);
   const net=decel*cos*Math.sqrt(1-cornerUse*cornerUse)+9.81*grade*cos;
   const ds=plan.segmentLength?.[i]??plan.step;
   values[i]=Math.max(0,Math.min(values[i],values[next]+2*net*ds));
  }
  if(plan.circuit)values[plan.count-1]=values[0];
  if(cache.size>=16)cache.delete(cache.keys().next().value);
  cache.set(key,values);
 }
 const sample=d=>{
  d=plan.circuit?(d%plan.length+plan.length)%plan.length:clamp(d,0,plan.length);
  const i=Math.min(plan.count-2,Math.floor(d/plan.step)),t=clamp((d-i*plan.step)/plan.step,0,1);
  return values[i]+(values[i+1]-values[i])*t;
 };
 return Math.sqrt(Math.max(0,Math.min(sample(distance),sample(distance+Math.abs(speed)*responseSeconds+1))));
}
