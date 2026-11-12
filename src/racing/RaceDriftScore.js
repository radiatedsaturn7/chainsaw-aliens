// Optional event scoring observes authoritative motion; it never changes grip,
// steering, throttle or vehicle forces. Only forward course progress scores.
export function advanceRaceDriftScore(previous, {distanceM=0, longitudinalSpeed=0,
 lateralSpeed=0, contactCount=0, onCourse=false, active=false}={}) {
 const points=Math.max(0,Number(previous?.points)||0);
 const speed=Math.hypot(longitudinalSpeed,lateralSpeed);
 const angle=Math.abs(Math.atan2(lateralSpeed,longitudinalSpeed))*180/Math.PI;
 const sliding=active&&onCourse&&contactCount>=2&&longitudinalSpeed>5&&speed>=8
  &&angle>=8&&angle<=55&&distanceM>0&&Number.isFinite(distanceM);
 return {points:points+(sliding?distanceM*10*Math.min(1,angle/35):0),sliding};
}
export function raceDriftScoreVariables(race,score,progress={}) {
 const id=race?.campaign?.sideEventId;
 if(race?.campaign?.scoring!=='drift'||!/^H\d{2}-S\d{2}$/.test(id||''))return {};
 const key=`raceScore.${id}`;
 return {[key]:Math.max(0,Number(progress[key])||0,Math.floor(Number(score?.points)||0))};
}
