import { RACE_THREE_ELEVATION_M } from './simulation/RaceSimulationConfig.js';
import { clamp } from './simulation/SimulationMath.js';

// Transient, vehicle-independent load-time data. Never stored in race saves.
// Road-center geometry is the safe reference line; drivers can choose offsets
// within its usable corridor. Live terrain/collision checks remain authoritative.
export function buildRaceAiRoadPlan(editor, {routeLength, runtimeType}) {
  const length=Math.max(1,Number(routeLength)||1);
  const count=Math.ceil(length/8)+1;
  // Fail back to online planning rather than coarsening away hairpins on an
  // exceptionally large user track or allocating unbounded memory.
  if(count>131072)return null;
  const circuit=runtimeType==='circuit';
  const step=length/(count-1);
  const poses=Array.from({length:count},(_,i)=>editor.getRaceWorldPoseAtDistance(
    i*step,{runtimeType}));
  const plan={length,step,count,circuit,profiles:new Map(),profileBuilds:0,
    curvature:new Float64Array(count),grade:new Float64Array(count),
    halfWidth:new Float64Array(count),risk:new Float64Array(count)};
  const poseAt=i=>poses[circuit?((i%(count-1))+(count-1))%(count-1):clamp(i,0,count-1)];
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  for(let i=0;i<count;i++) {
    const a=poseAt(i),b=poseAt(i+1);
    const grade=(Number(b.elevation||0)-Number(a.elevation||0))*RACE_THREE_ELEVATION_M/step;
    const authoredGrade=editor.getRaceRoadSurfaceProfileAtDistance?.(i*step,{runtimeType})?.grade;
    plan.grade[i]=Number.isFinite(authoredGrade)?authoredGrade:grade;
    let curvature=0,halfWidth=Infinity,risk=0;
    for(let j=-1;j<=2;j++) {
      const p=poseAt(i+j),q=poseAt(i+j+1);
      curvature=Math.max(curvature,Math.abs(delta(Number(q.yaw)||0,Number(p.yaw)||0))/step);
      const width=Number(editor.getRaceRoadHalfWidthWorld(p.segment));
      halfWidth=Math.min(halfWidth,Number.isFinite(width)?Math.max(.5,width):1);
      const slope=Math.abs(Number(q.elevation||0)-Number(p.elevation||0))*RACE_THREE_ELEVATION_M/step;
      risk=Math.max(risk,clamp((slope-.025)/.10,0,1));
    }
    plan.curvature[i]=curvature;
    plan.halfWidth[i]=halfWidth;
    plan.risk[i]=Math.max(risk,clamp((3-halfWidth)/1.5,0,1));
  }
  return plan;
}

export function raceAiRoadPlanIndex(plan,distance) {
  const d=plan.circuit?((distance%plan.length)+plan.length)%plan.length:clamp(distance,0,plan.length);
  return Math.min(plan.count-1,Math.floor(d/plan.step));
}

// Store v² / lateralAcceleration. Weather/tires scale this at lookup time,
// without rebuilding a track-sized profile whenever grip changes. Braking to
// cornering ratio is rounded DOWN, so shared hints never assume better brakes.
export function getRaceAiSpeedEnvelope(plan,ratio) {
  const bucket=Math.max(1,Math.min(64,Math.floor(ratio*16)));
  if(plan.profiles.has(bucket))return plan.profiles.get(bucket);
  const brakingRatio=bucket/16;
  const values=new Float64Array(plan.count);
  for(let i=0;i<values.length;i++)values[i]=(1-plan.risk[i]*.35)/Math.max(.00001,plan.curvature[i]);
  // A race finish is crossed at speed; it is not a stop sign.
  // Two backward laps propagate braking across the finish seam of a circuit.
  const end=plan.circuit?plan.count-1:plan.count;
  for(let pass=0;pass<(plan.circuit?2:1);pass++) {
    for(let i=end-1;i>=0;i--) {
      const next=plan.circuit?(i+1)%end:Math.min(end-1,i+1);
      values[i]=Math.min(values[i],values[next]+2*brakingRatio*plan.step);
    }
  }
  if(plan.circuit)values[plan.count-1]=values[0];
  if(plan.profiles.size>=16)plan.profiles.delete(plan.profiles.keys().next().value);
  plan.profiles.set(bucket,values);plan.profileBuilds++;
  return values;
}

export function getRaceAiPlannedSpeed(plan,distance,speed,lateralAcceleration,deceleration) {
  if(!(lateralAcceleration>0)||!(deceleration>0))return 0;
  const ratio=deceleration/lateralAcceleration;
  // A severely failed brake system should not be rounded up to a healthy hint.
  if(ratio<1/16)return 0;
  const values=getRaceAiSpeedEnvelope(plan,ratio);
  const here=raceAiRoadPlanIndex(plan,distance);
  const reaction=raceAiRoadPlanIndex(plan,distance+Math.max(0,speed)*.45+3);
  return Math.sqrt(lateralAcceleration*Math.min(values[here],values[reaction]));
}
