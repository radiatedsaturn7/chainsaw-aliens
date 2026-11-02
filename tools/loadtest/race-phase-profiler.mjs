// Diagnostic wrappers only; nested timers overlap and must not be summed.
export function createRacePhaseProfiler(editor, now=()=>performance.now(), {playerDetail=false}={}) {
 let current=null;
 const seenRunners=new WeakSet(),seenAuthorities=new WeakSet();
 const wrap=(object,key,name,work)=>{
  if(typeof object?.[key]!=='function')return;
  const original=object[key];
  object[key]=function(...args){
   if(!current)return original.apply(this,args);
   const row=current,at=now(),before=work?.before?.(this,args);
   try{return original.apply(this,args);}finally{
    row.ms[name]=(row.ms[name]||0)+now()-at;
    row.calls[name]=(row.calls[name]||0)+1;
    if(work)row.work[name]=(row.work[name]||0)+work.after(this,args,before);
   }
  };
 };
 wrap(editor,'updateRaceAiDrivers','ai');
 wrap(editor,'updateRaceTireTracks','tireTracks');
 const track=editor.playtestSession.trackState;
 wrap(track,'advance','trackAdvance');
 wrap(track,'step','trackTick',{before:t=>t.performanceCounters?.backgroundWeatherSteps||0,
  after:(t,args,before)=>(t.performanceCounters?.backgroundWeatherSteps||0)-before});
 wrap(track,'applyWeatherToCell','weatherCellSteps');
 wrap(track,'applyConservativeFlow','waterFlow');
 wrap(track,'serviceCheckpointSlice','checkpoint');
 wrap(track,'applyEvent','trackEvents');
 const runner=(object,name)=>{
  if(!object || seenRunners.has(object))return;
  seenRunners.add(object);
  wrap(object,'advance',name,{before:r=>r.stepIndex||0,after:(r,args,before)=>(r.stepIndex||0)-before});
  if(name==='playerPhysics' && playerDetail){
   const advance=object.advance;
   object.advance=function profilePlayerAdvance(...args){return advance.apply(this,args);};
   for(const key of ['runStep','integrateChassis','sampleSurfaceConsistency',
     'createSweptWheelCylinders','recordNonPenetratingState','recordTakeoffSubstep',
     'recoverFromPenetration','createStateSnapshot'])wrap(object,key,`player.${key}`);
   wrap(object.tireContactSubsystem,'step','player.tires');
   wrap(object.bodyCollision,'step','player.bodyCollision');
  }
 };
 return {
  begin(frame){
   runner(editor.playtestSession.vehicleDynamicsRunner,'playerPhysics');
   const authority=editor.vehicleDynamicsAuthority;
   if(playerDetail && authority?.raceEnvironmentProvider && !seenAuthorities.has(authority)){
    seenAuthorities.add(authority);
    wrap(authority,'raceEnvironmentProvider','player.environmentProvider');
   }
   for(const ai of editor.playtestSession.aiRuntime||[])runner(ai.vehicleDynamicsRunner,'aiPhysics');
   current={frame,ms:{},calls:{},work:{}};
  },
  end(){const row=current;current=null;return row;}
 };
}
