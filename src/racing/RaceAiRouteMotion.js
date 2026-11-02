import {clamp} from './simulation/SimulationMath.js';
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// A far car follows the authored road corridor instead of accumulating bicycle
// steering error. Entry is continuous: preserve its measured lateral position
// and blend toward the driver's chosen lane at a bounded lateral speed.
export function getRaceAiRouteMotion(editor,ai,{tuning,averageSpeed,seconds}) {
  const session=editor.playtestSession;
  if(session?.debugAiBicycleOnly || !editor.getRaceWorldPoseAtDistance
    || (ai.physicsBudgetDetail !== 'cheap' && Math.hypot(ai.worldX-session.worldX,ai.worldZ-session.worldZ)<120)) return null;
  const distance=Number(ai.projectedDistance??ai.distance);
  if(!Number.isFinite(distance) || !(seconds>0) || !(averageSpeed>0)) return null;
  const options={runtimeType:session.routeRuntimeType};
  const current=editor.getRaceWorldPoseAtDistance(distance,options);
  if(![current?.x,current?.z,current?.yaw].every(Number.isFinite))return null;
  const halfWidth=editor.getRaceRoadHalfWidthWorld(current.segment);
  const width=Math.max(.5,Number(tuning.widthM)||1.8);
  const usable=Math.max(0,halfWidth-width*.5-.25);
  const dx=ai.worldX-current.x,dz=ai.worldZ-current.z;
  // Match getRaceRightVector: route-positive lateral is (-cos(yaw), sin(yaw)).
  const offset=-dx*Math.cos(current.yaw)+dz*Math.sin(current.yaw);
  const ahead=dx*Math.sin(current.yaw)+dz*Math.cos(current.yaw);
  // Never snap a different branch, an off-road car, or a backwards-facing car
  // onto this path. Those states still need physical recovery before entry.
  if(Math.abs(offset)>usable+.1 || Math.abs(ahead)>Math.max(2,averageSpeed*.1)
    || Math.abs(angleDelta(ai.carYaw,current.yaw))>.35) return null;
  const travel=averageSpeed*seconds;
  let nextDistance=distance+travel;
  const length=Number(session.routeLength);
  if(length>0)nextDistance=session.routeRuntimeType==='circuit'
    ? ((nextDistance%length)+length)%length : Math.min(nextDistance,length);
  const next=editor.getRaceWorldPoseAtDistance(nextDistance,options);
  if(![next?.x,next?.z,next?.yaw].every(Number.isFinite))return null;
  const nextUsable=Math.max(0,editor.getRaceRoadHalfWidthWorld(next.segment)-width*.5-.25);
  const target=clamp(Number(ai.lineOffset)||0,-.78,.78)*Math.min(halfWidth,nextUsable);
  const lateralStep=clamp(target-offset,-Math.min(.8,averageSpeed*.1)*seconds,Math.min(.8,averageSpeed*.1)*seconds);
  const lateral=offset+lateralStep;
  if(Math.abs(lateral)>nextUsable+.1)return null;
  // Preserve the small along-road projection residual too. Dropping it
  // caused a crawl-speed car to jump backwards toward a stopped follower on
  // every attempted launch, producing a permanent mutual yield.
  const x=next.x-Math.cos(next.yaw)*lateral+Math.sin(next.yaw)*ahead;
  const z=next.z+Math.sin(next.yaw)*lateral+Math.cos(next.yaw)*ahead;
  // The path must remain local even on a loop seam, junction or bad geometry.
  if(Math.hypot(x-ai.worldX,z-ai.worldZ)>travel*1.5+.15)return null;
  const desiredYaw=next.yaw-Math.atan2(lateralStep,Math.max(.01,travel));
  // A stationary car cannot instantly rotate into its chosen lane. Besides
  // looking wrong, that rotation enlarged its swept box into a clear follower,
  // creating a mutual queue. Bound heading change by actual wheel travel.
  const maxYawChange=travel/Math.max(1,Number(tuning.wheelbaseM)||2.65)
    * Math.tan(Number(ai.vehicleDynamicsRunner?.config?.maxSteerAngleRad)||.52);
  const yaw=ai.carYaw+clamp(angleDelta(desiredYaw,ai.carYaw),-maxYawChange,maxYawChange);
  return {x,z,yaw,yawRate:angleDelta(yaw,ai.carYaw)/seconds,kind:'route'};
}
