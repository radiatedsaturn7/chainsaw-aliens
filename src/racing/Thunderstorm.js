// Cosmetic seeded storm clock, independent of the physics RNG and render rate.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const STEP=1/120;
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return (s.seed+.5)/4294967296;}
export function createThunderstorm(seed=0x71b36e){if(typeof seed==='string'){let hash=2166136261;for(const ch of seed)hash=Math.imul(hash^ch.charCodeAt(0),16777619);seed=hash;}return {seed:seed>>>0,time:0,accumulator:0,hazard:null,burstUntil:0,strikes:[],pending:[],sequence:0};}
export function thunderProfile(distanceM=1500,energy=1){
 const distance=clamp(Number(distanceM)||0,60,12000),near=Math.exp(-distance/1100);
 return {distanceM:distance,delaySeconds:distance/343,near,
  gain:clamp(energy,0,1.5)*(.12+.6/(1+distance/900)),
  cutoffHz:350+6500*near,durationSeconds:2.2+Math.min(5,distance/1000)};
}
export function strikeFlash(strike,time){
 let light=0;
 for(const p of strike.pulses){const age=time-strike.time-p.at;if(age>=0&&age<p.duration)light=Math.max(light,p.energy*Math.exp(-age/(p.duration*.32)));}
 return light;
}
function spawn(s,intensity,camera,yaw,onPrepareThunder){
 const near=random(s)<.08*intensity;
 const distance=near?80+random(s)*420:700+Math.pow(random(s),.7)*5300;
 const angle=yaw+(random(s)-.5)*1.6,energy=.65+random(s)*.35;
 const pulses=[{at:0,duration:.07,energy:energy*.22}];
 let at=.07+random(s)*.08;
 const count=1+Math.floor(random(s)*4);
 for(let i=0;i<count;i++){pulses.push({at,duration:.07+random(s)*.07,energy:energy*(i===0?1:.45+random(s)*.55)});at+=.06+random(s)*.13;}
 const strike={id:++s.sequence,seed:s.seed,time:s.time,distanceM:distance,energy,pulses,
  worldX:Number(camera.x||0)+Math.sin(angle)*distance,worldZ:Number(camera.z||0)+Math.cos(angle)*distance};
 s.strikes.push(strike);if(s.strikes.length>4)s.strikes.shift();
 const profile=thunderProfile(distance,energy);
 const event={...profile,at:s.time+pulses[1].at+profile.delaySeconds,seed:strike.seed,pulseDelays:pulses.slice(1).map(p=>p.at-pulses[1].at),pan:Math.sin(angle-yaw),intensity};
 s.pending.push(event);onPrepareThunder(event);
 if(s.pending.length>16)s.pending.shift();
 if(random(s)<.3)s.burstUntil=s.time+2+random(s)*4;
}
export function advanceThunderstorm(s,seconds,{intensity=1,camera={},cameraYaw=0,onThunder=()=>{},onPrepareThunder=()=>{}}={}){
 if(!s)return 0;
 const dt=Number.isFinite(seconds)?clamp(seconds,0,.25):0;
 s.accumulator+=dt;intensity=clamp(Number(intensity)||0,0,1);
 while(s.accumulator+1e-10>=STEP){
  s.accumulator=Math.max(0,s.accumulator-STEP);s.time+=STEP;
  if(s.hazard==null)s.hazard=-Math.log(random(s));
  // Exponential arrivals with short high-rate clusters; not a claim of a
  // universal meteorological Poisson process. Intensity controls event rate.
  s.hazard-=STEP*(intensity>.02?.015+.15*intensity*intensity:0)*(s.time<s.burstUntil?2.5:1);
  if(s.hazard<=0){spawn(s,intensity,camera,cameraYaw,onPrepareThunder);s.hazard+=-Math.log(random(s));}
  s.strikes=s.strikes.filter(strike=>s.time-strike.time<1.2);
  const due=s.pending.filter(event=>event.at<=s.time);s.pending=s.pending.filter(event=>event.at>s.time);
  for(const event of due)onThunder(event);
 }
 if(s.accumulator<1e-10)s.accumulator=0;
 return s.strikes.reduce((light,strike)=>Math.max(light,strikeFlash(strike,s.time)),0);
}
