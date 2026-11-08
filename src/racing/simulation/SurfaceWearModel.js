import {clamp} from './SimulationMath.js';

// Game calibration, not measured tire life. Grip and abrasion are independent:
// frozen surfaces can have terrible traction without grinding away the tread.
export function surfaceWearProfile(surface='asphalt',compound='tarmac'){
 const frozen=/snow|slush|ice/.test(surface),gravel=/gravel|rock/.test(surface),soft=/dirt|mud|sand|grass/.test(surface);
 const reinforced=/^(dirt|rally|offroad)$/.test(compound);
 const abrasion=frozen?.06:gravel?(reinforced?.8:1.8):soft?.35:1;
 const tread=(!frozen&&!gravel&&!soft&&/snow|offroad|dirt/.test(compound))?1.25:1;
 return {abrasion:abrasion*tread,stoneExposure:gravel?(reinforced?.25:1):0};
}
export function contactTireWear({patch={},thermal={},dt=0}={}){
 const tire=patch.tireParameters||{},material=patch.material||{},compound=tire.compound||{};
 const surface=Number(material.snowDepthMm)>=2?'snow':Number(material.iceDepthMm)>=.5?'ice':String(material.surfaceId||material.baseSurfaceId||'asphalt').toLowerCase();
 const profile=surfaceWearProfile(surface,compound.id||'tarmac');
 const load=Math.max(0,Number(patch.suspensionNormalLoadN??patch.normalLoadN)||0);
 if(load<=1||dt<=0||patch.wheelGrounded===false)return {wear:0,damage:0};
 const speed=Math.hypot(Number(patch.longitudinalVelocityMps)||0,Number(patch.lateralVelocityMps)||0);
 const pressure=Number(thermal.effectivePressurePsi??tire.pressurePsi)||32,target=Number(tire.targetPressurePsi)||32;
 const pressureStress=1+Math.max(0,Math.abs(pressure/target-1)-.15)*2;
 const temperature=Number(thermal.treadTemperatureC)||25;
 const heat=1+Math.max(0,temperature-100)/70;
 const work=Math.max(0,Number(thermal.frictionHeatingWorkJ)||0)/.78;
 const rolling=load*speed*dt*.002*(1+clamp(Number(material.roughness)||0,0,1)); // baseline tread abrasion from rolling contact
 const wear=(work+rolling)*1e-9*profile.abrasion*clamp(Number(compound.wearRate)||1,.5,3)*pressureStress*heat;
 // Stone cuts need both gravel and an overloaded casing. Snow alone cannot cut it.
 const casingCapacityN=6500*(profile.stoneExposure<1?1.5:1)*clamp(pressure/target,.35,1.2);
 const overload=Math.max(0,load/casingCapacityN-1);
 return {wear,damage:profile.stoneExposure*overload*overload*Math.min(speed/10,3)*dt*.4};
}

// Deformation starts above the installed assembly's load capacity. Travel and
// wheel rate provide absorption reserve; bottoming is not automatically damage.
export function suspensionOverloadDamage({loadN=0,staticLoadN=3500,suspension={},strength=1,dt=0}={}){
 const travel=Math.max(.02,Number(suspension.suspensionTravelM)||.15);
 const spring=Math.max(1000,Number(suspension.springRateNpm)||30000);
 const capacityN=(Math.max(1,staticLoadN)*3.5+spring*travel*.5)*clamp(strength,.5,4);
 const overload=Math.max(0,Math.max(0,loadN)/capacityN-1);
 return {capacityN,damage:Math.min(100,overload*overload*Math.max(0,dt)*8)};
}
// Sub-mesh roughness represents repeated small road inputs. Compare their
// energy with spring/damper absorption, rather than damaging on a surface label.
export function roughRoadSuspensionDamage({roughness=0,speed=0,staticLoadN=3500,suspension={},strength=1,dt=0}={}){
 const bumpTravel=Math.max(.015,Number(suspension.bumpTravelM)||Number(suspension.suspensionTravelM)*.5||.075);
 const spring=Math.max(1000,Number(suspension.springRateNpm)||30000);
 const damper=Math.max(0,Number(suspension.damperRateNsM)||2500);
 const verticalSpeed=Math.abs(speed)*clamp(roughness,0,1)*.18;
 const inputEnergyJ=.5*(staticLoadN/9.81)*verticalSpeed*verticalSpeed;
 const capacityJ=(.5*spring*bumpTravel*bumpTravel+damper*verticalSpeed*bumpTravel)*clamp(strength,.5,4);
 const excess=Math.max(0,inputEnergyJ/Math.max(1,capacityJ)-1);
 return excess*excess*(Math.abs(speed)/3)*Math.max(0,dt)*.02;
}
export function applySuspensionContactDamage(state,config,dt){
 const mechanical=state.mechanical;if(!mechanical?.config?.enabled)return;
 for(const wheel of ['fl','fr','rl','rr']){
  const patch=state.contactPatches?.[wheel]||{};
  if(patch.wheelGrounded===false)continue;
  const front=wheel[0]==='f',bias=Number(config.frontWeightDistribution)||.54;
  const staticLoadN=(Number(config.massKg)||1450)*9.81*(front?bias:1-bias)/2;
  const result=suspensionOverloadDamage({loadN:Number(patch.suspensionNormalLoadN??patch.normalLoadN)||0,staticLoadN,suspension:state.suspensionState?.[wheel],strength:config.powertrainTuning?.suspensionImpactStrength??1,dt});
  const roughDamage=roughRoadSuspensionDamage({roughness:Number(patch.material?.roughness)||0,speed:Number(state.speedMps)||0,staticLoadN,suspension:state.suspensionState?.[wheel],strength:config.powertrainTuning?.suspensionImpactStrength??1,dt});
  for(const [part,scale] of [['damper_',1],['spring_',.65],['alignment_',.45]]){
   const id=part+wheel,c=mechanical.components[id];
   c.damage=clamp(c.damage+(result.damage+roughDamage)*scale/mechanical.config.components[id].durability,0,100);
  }
 }
}

// Impact events retain the pre-solver closing velocity; force caps in the
// contact solver must not make a severe landing immune to damage.
export function applySuspensionLandingDamage(state,config,velocity){
 const m=state.mechanical;if(!m?.config?.enabled)return;
 for(const w of ['fl','fr','rl','rr']){
  const patch=state.contactPatches?.[w];if(!patch||patch.wheelGrounded===false||!(patch.normalLoadN>1))continue;
  const n=patch.surfaceNormalWorld||{x:0,y:1,z:0};
  const closing=Math.max(0,-(velocity.x*n.x+velocity.y*n.y+velocity.z*n.z));
  const suspension=state.suspensionState?.[w]||{},travel=Math.max(.02,Number(suspension.suspensionTravelM)||.15);
  const spring=Math.max(1000,Number(suspension.springRateNpm)||30000),damper=Math.max(0,Number(suspension.damperRateNsM)||2500);
  const mass=(Number(config.massKg)||1450)*(w[0]==='f'?config.frontWeightDistribution:1-config.frontWeightDistribution)/2;
  const energy=.5*mass*closing*closing;
  const capacity=(.5*spring*travel*travel+damper*closing*travel*.5)*clamp(Number(config.powertrainTuning?.suspensionImpactStrength)||1,.5,4);
  const excess=Math.max(0,energy/Math.max(1,capacity)-1),damage=Math.min(100,excess*excess*8);
  for(const [prefix,scale] of [['damper_',1],['spring_',.65],['alignment_',.45]]){
   const id=prefix+w;m.components[id].damage=clamp(m.components[id].damage+damage*scale/m.config.components[id].durability,0,100);
  }
 }
}
