import {getAuthoritativeChassisState} from '../../racing/simulation/VehicleState.js';
import {clamp} from './WheelInput.js';

// No parallel physics model: take tire torque after grip, slip, load and damage
// have been resolved by the existing tire/contact solver.
export function readWheelTelemetry(session) {
 const state=getAuthoritativeChassisState(session);
 if(!state)return null;
 const runner=session.vehicleDynamicsRunner;
 const direct=runner?.dormant!==true&&runner?.state===state;
 const wheels=direct?state.contactPatches:state.wheels;
 const front=['fl','fr'].map(id=>wheels?.[id]);
 const speed=Number(session.speedMps);
 if(!Number.isFinite(speed)||front.some(p=>!p||!Number.isFinite(p.selfAligningMomentNm)||!Number.isFinite(p.normalLoadN)))return null;
 const step=direct?runner.stepIndex:state.stepIndex;
 if(!Number.isFinite(step))return null;
 const impact=direct?runner.impactHistory?.at(-1):state.impactEvents?.at(-1);
 const normal=impact?.impactNormalWorld??impact?.normalWorld;
 const yaw=Number(impact?.impactYawRad??impact?.vehicleYawRad??state.yawRad);
 const impulse=Number(impact?.bodyNormalImpulseNs??impact?.normalImpulseNs);
 const collision=normal&&[normal.x,normal.z,yaw,impulse].every(Number.isFinite)?clamp((normal.x*Math.cos(yaw)-normal.z*Math.sin(yaw))*impulse/10000,-.15,.15):0;
 return {step,collision,impactSequence:impact?.sequence??impact?.stepIndex??0,reset:state.vehicleResetGeneration??state.resetGeneration??0,speed,
  aligning:front.reduce((sum,p)=>sum+(p.validTreadContact===false||p.normalLoadN<20?0:p.selfAligningMomentNm),0),
  compression:front.map((p,i)=>Number(p.suspensionCompressionM??state.suspensionState?.[['fl','fr'][i]]?.compressionM)),
  load:front.reduce((sum,p)=>sum+(p.validTreadContact===false?0:Math.max(0,p.normalLoadN)),0)};
}
export class WheelForceModel {
 reset(){this.previous=null;this.filtered=0;}
 constructor(){this.reset();}
 calculate(telemetry,settings,dt) {
  if(!telemetry||!Number.isFinite(telemetry.aligning)||!Number.isFinite(dt)||dt<=0){this.reset();return {torque:0,clipped:false};}
  const speedGate=clamp(Math.abs(telemetry.speed)/3,0,1);
  // Normalize rack moment to an arcade feedback scale (150 Nm at the rack),
  // not a claim about physical motor Nm. Device-driver torque limits still apply.
  const alignment=-telemetry.aligning/150;
  let bumps=0;
  if(this.previous&&telemetry.reset===this.previous.reset&&telemetry.compression.every(Number.isFinite)&&this.previous.compression.every(Number.isFinite)){
   const left=(telemetry.compression[0]-this.previous.compression[0])/dt;
   const right=(telemetry.compression[1]-this.previous.compression[1])/dt;
   bumps=clamp((left-right)*.03,-.08,.08);
  }
  if(this.previous&&telemetry.reset!==this.previous.reset)this.filtered=0;
  // A directional impulse is used only when physics reports its world normal.
  // Many body collisions currently lack that normal; do not invent a direction.
  const collision=this.previous&&telemetry.reset===this.previous.reset&&telemetry.impactSequence!==this.previous.impactSequence?telemetry.collision||0:0;
  this.previous=telemetry;
  const raw=((telemetry.load>20?alignment+bumps:0)+collision)*speedGate*settings.strength*(settings.invertForce?-1:1);
  const limit=clamp(settings.limit,0,.35),target=clamp(raw,-limit,limit);
  this.filtered+=(target-this.filtered)*(1-Math.exp(-Math.min(dt,.05)/settings.smoothing));
  this.filtered=clamp(this.filtered,-limit,limit);
  return {torque:this.filtered,raw,alignment,bumps,collision,clipped:Math.abs(raw)>limit};
 }
}
