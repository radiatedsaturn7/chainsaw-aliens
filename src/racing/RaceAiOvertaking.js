import {clamp} from './simulation/SimulationMath.js';
const plans=new WeakMap();
export const clearRaceAiOvertakePlan=ai=>plans.delete(ai);
// Pick a real passing corridor, keep the chosen side until clear, and return
// gradually to the racing line. This changes a steering target, never a pose.
export function raceAiPassingOffset(ai,traffic,{desired,ownOffset,right,pose,laneLimit,width,speed,seconds,risk=0,enabled=true}){
 let plan=plans.get(ai);
 if(!plan){plan={offset:desired,leader:null,side:0};plans.set(ai,plan);}
 const yaw=Number(ai.carYaw)||0,sin=Math.sin(yaw),cos=Math.cos(yaw);
 const y=ai.vehicleDynamicsRunner?.state?.position?.y;
 const entries=traffic.filter(t=>t.car!==ai&&Number.isFinite(t.worldX)&&Number.isFinite(t.worldZ)).map(t=>{
  const dx=t.worldX-ai.worldX,dz=t.worldZ-ai.worldZ;
  return {...t,along:dx*sin+dz*cos,offset:(t.worldX-pose.x)*right.x+(t.worldZ-(pose.z??pose.y))*right.z,
   width:Number(t.car?.vehicleDynamicsRunner?.config?.bodyWidthM)||1.8,
   length:Number(t.car?.vehicleDynamicsRunner?.config?.bodyLengthM)||4.5,
   height:t.car?.vehicleDynamicsRunner?.state?.position?.y};
 }).filter(t=>!(Number.isFinite(y)&&Number.isFinite(t.height)&&Math.abs(y-t.height)>2.5));
 let leader=entries.find(t=>t.car===plan.leader);
 if(!enabled||risk>.3||!leader||leader.along < -leader.length-2 || leader.along>Math.max(50,speed*2.5)){
  plan.leader=null;plan.side=0;leader=null;
 }
 if(enabled&&risk<=.3&&!leader){
  const horizon=Math.max(16,speed*(ai.difficulty==='easy'?.9:1.6));
  leader=entries.filter(t=>t.along>4&&t.along<horizon&&Math.cos((t.carYaw||0)-yaw)>.7
   &&Math.abs(t.offset-ownOffset)<(width+t.width)/2+.6&&speed>=Number(t.speedMps||0)-1)
   .sort((a,b)=>a.along-b.along)[0];
 }
 let goal=desired;
 if(leader){
  const separation=(width+leader.width)/2+.45;
  const sides=plan.side?[plan.side]:[-1,1].sort((a,b)=>Math.abs(leader.offset+a*separation-ownOffset)-Math.abs(leader.offset+b*separation-ownOffset));
  for(const side of sides){
   const lane=leader.offset+side*separation;
   if(Math.abs(lane)>laneLimit)continue;
   const blocked=entries.some(t=>t.car!==leader.car&&t.along>-8-Math.max(0,Number(t.speedMps||0)-speed)*1.5&&t.along<Math.max(12,leader.along+6)
    &&Math.abs(t.offset-lane)<(width+t.width)/2+.5);
   if(blocked)continue;
   plan.leader=leader.car;plan.side=side;goal=lane;break;
  }
  if(goal===desired){plan.leader=null;plan.side=0;}
 }
 const step=Math.max(0,Number(seconds)||0)*1.2;
 plan.offset+=clamp(goal-plan.offset,-step,step);
 ai.overtakePlan={active:!!plan.leader,targetId:plan.leader?.id??'player',side:plan.side,offsetM:plan.offset};
 return clamp(plan.offset,-laneLimit,laneLimit);
}
