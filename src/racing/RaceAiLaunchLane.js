import {clamp} from './simulation/SimulationMath.js';
const lanes=new WeakMap();

// Hold the actual grid lane until there is room to merge. Immediately aiming
// every car at one racing line creates an artificial single-file launch queue.
export function raceAiLaunchLaneOffset(ai,session,pose,distance,desiredOffset) {
 let record=lanes.get(ai);
 if(record?.session!==session){
  record={session,offset:null};lanes.set(ai,record);
  if(ai.awaitingStartLine && Math.abs(Number(ai.speedMps)||0)<2
    && [pose?.x,pose?.z,pose?.yaw,ai.worldX,ai.worldZ].every(Number.isFinite)){
   record.offset=-(ai.worldX-pose.x)*Math.cos(pose.yaw)+(ai.worldZ-pose.z)*Math.sin(pose.yaw);
  }
 }
 if(record.offset===null || Number(ai.lap)>1)return desiredOffset;
 const progress=ai.awaitingStartLine ? 0 : Math.max(0,Number(distance)||0);
 const blend=clamp(progress/60,0,1);
 return record.offset+(desiredOffset-record.offset)*blend;
}
