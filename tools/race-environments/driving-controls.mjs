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
