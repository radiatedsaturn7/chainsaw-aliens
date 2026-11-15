// QA-only input controller. Reads route telemetry; never changes simulation state.
import assert from 'node:assert/strict';
export function steeringIntent({yaw,targetYaw,speed,lateral,width}){
 for(const v of [yaw,targetYaw,speed,lateral,width])assert.ok(Number.isFinite(v),'Invalid steering telemetry');
 assert.ok(width>2,'Road narrower than test car envelope');
 assert.ok(Math.abs(lateral)<=width/2-1,'Test car left road corridor');
 // Production RaceEditor demo controller documents physical steering opposite world yaw.
 const error=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));
 const limit=Math.abs(error)>.2?3.5:6;
 return {error,steer:error>.025?-1:error<-.025?1:0,throttle:speed<limit,brake:speed>limit+1.5};
}

// Unwrap only a real circuit seam. World/time checks reject projection jumps and
// resets; reverse travel remains negative and stationary samples earn no metres.
export function routeProgressDelta(previous,current){
 for(const sample of [previous,current])for(const key of ['distance','x','z','elapsed','speed','routeLength'])assert.ok(Number.isFinite(sample[key]),'Invalid progress telemetry');
 assert.ok(current.routeLength>0&&previous.routeLength===current.routeLength,'Route length changed');
 assert.ok(['circuit','destination'].includes(current.runtimeType)&&previous.runtimeType===current.runtimeType,'Route runtime changed');
 assert.ok(current.elapsed>=previous.elapsed,'Simulation clock reset');
 let delta=current.distance-previous.distance;
 if(current.runtimeType==='circuit'){
  if(delta < -current.routeLength/2)delta+=current.routeLength;
  else if(delta > current.routeLength/2)delta-=current.routeLength;
 }
 const movement=Math.hypot(current.x-previous.x,current.z-previous.z);
 assert.ok(Math.abs(delta)<=movement*1.5+1,'Route projection jumped');
 const seconds=(current.elapsed-previous.elapsed)/1000;
 assert.ok(movement<=Math.max(Math.abs(previous.speed),Math.abs(current.speed))*seconds+2,'World reset or teleport');
 return delta;
}
