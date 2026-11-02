// Simulation-time watchdog for failures that do not involve being upside down.
// No wall-clock timers or per-frame randomness. A queue or broken engine is
// not a reason to teleport a car back onto the road.
const watches=new WeakMap();
export function observeRaceAiRecovery(ai,session,state,seconds,{roadHeightM=null,onRoadCorridor=false,canAttempt=true}={}) {
  if(!Number.isFinite(seconds)||!(seconds>0)||!state?.position)return null;
  const p=state.position;
  let watch=watches.get(ai);
  if(!watch||watch.session!==session){
    watch={session,x:p.x,z:p.z,stuckSeconds:0,belowSeconds:0,cooldown:0,status:{}};watches.set(ai,watch);
    ai.recoveryWatchdog=watch.status;
  }
  watch.cooldown=Math.max(0,watch.cooldown-seconds);
  const below=Number.isFinite(roadHeightM)&&onRoadCorridor
    && Number.isFinite(p.y)&&p.y<roadHeightM-6;
  watch.belowSeconds=below?watch.belowSeconds+seconds:0;
  const moved=Math.hypot(p.x-watch.x,p.z-watch.z)>.75;
  const far=Math.hypot(p.x-Number(session?.worldX),p.z-Number(session?.worldZ))>120;
  const healthy=state.mechanical?.engineRunning!==false
    && !Object.values(state.mechanical?.components||{}).some(c=>c.failed||c.damage>=70);
  const attempting=far&&healthy&&Number(ai.drivingPlan?.targetSpeedMps)>1
    && Number(ai.engineDrive?.throttle)>.1&&Number(ai.engineDrive?.brake||0)<.2
    && ai.distantPhysicsReason!=='route-yield';
  if(moved||!attempting){watch.x=p.x;watch.z=p.z;watch.stuckSeconds=0;}
  else watch.stuckSeconds+=seconds;
  Object.assign(watch.status,{stuckSeconds:watch.stuckSeconds,belowSeconds:watch.belowSeconds,
    cooldownSeconds:watch.cooldown,attempting,healthy,far});
  if(watch.cooldown>0)return null;
  const reason=watch.belowSeconds>=1?'ai-below-road':watch.stuckSeconds>=8?'ai-stuck':null;
  if(reason&&!canAttempt)return null;
  if(reason){
    watch.cooldown=4;watch.belowSeconds=0;watch.stuckSeconds=0;
    watch.x=p.x;watch.z=p.z;
  }
  return reason;
}
