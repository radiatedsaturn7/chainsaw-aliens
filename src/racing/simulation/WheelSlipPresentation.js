import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

// Presentation uses the latest physical wheel velocities, including worker
// snapshots. Engine RPM and chassis travel alone cannot identify a burnout.
export function getWheelSlipPresentation(state = {}, radiusM = .33) {
  const tireSlipByWheel={},wheelSpinByWheel={},wheelContactScaleByWheel={},lockByWheel={};
  let slipSpeedMps=0,audibleSlip=0;
  for(const id of RACE_WHEEL_IDS){
    const wheel=state.contactPatches?.[id]||state.wheelPoses?.[id]||state.wheels?.[id]||{};
    const load=Number(wheel.normalLoadN??state.wheelLoadsN?.[id]??0);
    const contact=load>1&&wheel.validTreadContact!==false;
    wheelContactScaleByWheel[id]=contact?1:0;
    tireSlipByWheel[id]=0;wheelSpinByWheel[id]=0;lockByWheel[id]=0;
    if(!contact)continue;
    const normal=wheel.surfaceNormalWorld||{x:0,y:1,z:0},yaw=Number(state.yawRad||0)+Number(wheel.steeringAngleRad||0);
    const nx=Number(normal.x||0),ny=Number(normal.y??1),nz=Number(normal.z||0);
    const dot=Math.sin(yaw)*nx+Math.cos(yaw)*nz;
    let fx=Math.sin(yaw)-dot*nx,fy=-dot*ny,fz=Math.cos(yaw)-dot*nz;
    const length=Math.hypot(fx,fy,fz)||1;fx/=length;fy/=length;fz/=length;
    const p=wheel.contactPointWorld||state.position||{},origin=state.position||{};
    const rx=Number(p.x||0)-Number(origin.x||0),ry=Number(p.y||0)-Number(origin.y||0),rz=Number(p.z||0)-Number(origin.z||0);
    const angular=state.angularVelocityWorld||state.angularVelocity||{},v=state.velocity||{};
    const vx=Number(v.x||0)+Number(angular.y||0)*rz-Number(angular.z||0)*ry;
    const vy=Number(v.y||0)+Number(angular.z||0)*rx-Number(angular.x||0)*rz;
    const vz=Number(v.z||0)+Number(angular.x||0)*ry-Number(angular.y||0)*rx;
    const longitudinal=Number(wheel.longitudinalVelocityMps??(vx*fx+vy*fy+vz*fz));
    const lateral=Number(wheel.lateralVelocityMps??(vx*(ny*fz-nz*fy)+vy*(nz*fx-nx*fz)+vz*(nx*fy-ny*fx)));
    const omega=Number(wheel.wheelAngularVelocityRadps??state.wheelAngularVelocityRadps?.[id]??state.wheelAngularVelocity?.[id]??0);
    const rolling=Number.isFinite(wheel.longitudinalSlipSpeedMps)
      ? longitudinal+wheel.longitudinalSlipSpeedMps
      : omega*Math.max(.05,Number(wheel.effectiveRollingRadiusM||radiusM));
    const slipSpeed=Math.hypot(rolling-longitudinal,lateral);
    const denominator=Math.max(1,Math.abs(longitudinal));
    const spin=clamp((Math.abs(rolling)-Math.abs(longitudinal))/denominator,0,1.8);
    const lock=clamp((Math.abs(longitudinal)-Math.abs(rolling))/denominator,0,1);
    const lateralSlip=clamp((Math.atan2(Math.abs(lateral),denominator)-.045)/.34,0,1);
    // Ignore tiny tire compliance/solver motion, but retain stationary wheelspin.
    const motion=clamp((slipSpeed-.15)/2,0,1);
    wheelSpinByWheel[id]=spin*motion;lockByWheel[id]=lock*motion;
    tireSlipByWheel[id]=Math.max(spin,lock,lateralSlip)*motion;
    slipSpeedMps=Math.max(slipSpeedMps,slipSpeed);
    audibleSlip=Math.max(audibleSlip,clamp(tireSlipByWheel[id],0,1));
  }
  return {tireSlipByWheel,wheelSpinByWheel,wheelContactScaleByWheel,brakeState:{lockByWheel},slipSpeedMps,audibleSlip};
}
