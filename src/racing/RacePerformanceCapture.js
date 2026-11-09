import {captureRaceHandling, captureRaceHandlingSetup} from './RaceHandlingCapture.js';
import {createTrackEventQueueProbe} from './TrackEventQueueProbe.js';
import {getRaceRecoveryHistoryDiagnostics} from './RaceRecoveryHistory.js';
import {attachDetailedPerformance} from './RaceDetailedPerformance.js';
import {RaceCaptureMemory} from './RaceCaptureMemory.js';
import {CompactFramePhases} from './CompactFramePhases.js';
import {cancelRacePerformanceWork} from './RacePerformanceUpload.js';
// Opt-in browser diagnostics. No physics decisions depend on these clocks.
const clock=()=>globalThis.performance?.now?.() ?? Date.now();
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]:0;
// These summaries contain counters/top subsystems and at most one frame, never
// the accounting histories or capture trace. Detach the pooled latestFrame now
// so continued driving cannot overwrite a stopped capture before its export.
const snapshotSummary=summary=>{
 if(!summary)return null;
 try{return structuredClone(summary);}catch{return null;}
};
export class RacePerformanceCapture {
 constructor(editor,{now=clock,durationMs=120000,maxFrames=8000,observe=true,onStop=null,detailed=false,maxSpans=100000,traceFrameStride=1,compactTrace=false}={}){
  cancelRacePerformanceWork(editor);
  this.session=editor.playtestSession||null;
  this.compactPhases=compactTrace?new CompactFramePhases():null;this.packedPhaseBytes=0;
  this.compactTrace=compactTrace;this.timingEntries=[];this.traceFrameStride=Math.max(1,Math.floor(traceFrameStride));this.detailed=detailed;this.maxSpans=maxSpans;this.spans=[];this.spanNames=[];this.spanIds=new Map();this.droppedSpans=0;this.onStop=onStop;this.epochStarted=Date.now();this.editor=editor;this.now=now;this.durationMs=durationMs;this.maxFrames=maxFrames;
  this.memoryCapture=new RaceCaptureMemory();this.phaseRecordCount=0;
  this.started=now();this.active=true;this.frames=[];this.stack=[];this.restores=[];this.seen=new WeakMap();this.longTasks=[];this.gpuPending=[];
  this.gpuStatus='unavailable';this.observer=null;this.eventQueueProbeReports=[];this.eventQueueProbes=new WeakMap();this.physicsAccounts=new WeakSet();this.physicsSequences=new WeakMap();
  this.deadline=setTimeout(()=>this.stop('duration'),durationMs);this.deadline.unref?.();
  if(observe && globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask'))try{
   this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(this.longTasks.length<200)this.longTasks.push({startMs:e.startTime-this.started,durationMs:e.duration});});
   this.observer.observe({type:'longtask',buffered:false});
  }catch{}
  this.metadata={mode:detailed?'detailed':'standard',race:editor.selectedRace?.name,device:{userAgent:globalThis.navigator?.userAgent||null,pixelRatio:globalThis.devicePixelRatio||1},startedAt:new Date(this.epochStarted).toISOString(),epochStartedMs:this.epochStarted};
  const capture=this;
  this.hook(editor,'update',fn=>function(...args){capture.begin();return capture.time('update',()=>fn.apply(this,args));});
  this.hook(editor,'draw',fn=>function(...args){capture.begin();capture.attach();try{return capture.time('draw',()=>fn.apply(this,args));}finally{capture.finish();}});
  for(const [method,phase] of Object.entries({updatePlaytestSafely:'simulation',updateRaceAiDrivers:'AI',updateRaceTireTracks:'tireTracks',updateRaceTireFxParticles:'tireFX',updateRaceWeatherFxState:'weatherUpdate',updateRaceSnowEnvironmentRenderField:'weatherField',syncRaceThreeCarSprites:'carSprites',syncRaceThreeAiModels:'carModels',syncRaceThreeEnvironmentSnow:'precipitationGPUSetup',drawRacePlaytestHud:'HUD',drawRaceWebGLTrackScene:'worldDraw',drawRaceThreeWorldScene:'threeScene',addRaceThreeDoodads:'scenery',syncRaceThreeDecals:'decals',syncRaceThreeTireTracks:'tireTrackGeometry',syncRaceThreeTrackState:'surfaceWeatherGeometry',drawRaceWeatherFx:'weatherOverlay',drawRaceParallaxBackground:'background',drawRaceSkyboxArt:'skybox',drawRaceWeatherVisibilityVeil:'visibilityVeil'}))this.wrap(editor,method,phase);
 }
 hook(object,key,make){
  if(!this.active)return;
  if(!object||typeof object[key]!=='function')return;
  let keys=this.seen.get(object);if(!keys)this.seen.set(object,keys=new Set());if(keys.has(key))return;keys.add(key);
  const own=Object.hasOwn(object,key),original=object[key],wrapped=make(original);object[key]=wrapped;
  this.restores.push(()=>{if(object[key]===wrapped){if(own)object[key]=original;else delete object[key];}});
 }
 wrap(object,key,phase,options=null){
  // attach runs repeatedly as runners/renderers appear. Reject existing hooks
  // before allocating a factory closure (and a default options object).
  if(!object||typeof object[key]!=='function'||this.seen.get(object)?.has(key))return;
  const self=this,trace=options?.trace??true;
  this.hook(object,key,fn=>function(...args){return self.time(phase,fn,trace,this,args);});
 }
 timeAiDriver(ai,index,fn){
  if(!this.active||!this.detailed||!this.current)return fn();
  const tier=ai.physicsBudgetDetail==='cheap'?'lightweight':'detailed';
  return this.time(`AI.${tier}Cars`,()=>this.time(`AIcar[${index}].${tier}`,fn,false));
 }
 begin(){
  if(!this.active)return;
  if(this.current)return;
  if(this.now()-this.started>=this.durationMs){this.stop('duration');return;}
  const e=this.editor,s=e.playtestSession;
  if(this.session && s!==this.session){this.stop('session-changed');return;}
  if(!s?.running||e.raceInput?.paused||globalThis.document?.hidden){this.previousFrameAt=null;return;}
  this.session ||= s;
  const at=this.now();
  this.compactPhases?.begin(this.frames.length);
  // Attribute the elapsed display interval to the work of the preceding frame.
  if(this.previousFrameAt!=null && this.frames.length)this.frames.at(-1).intervalMs=at-this.previousFrameAt;
  this.current={index:this.frames.length,atMs:at-this.started,wallClockMs:this.epochStarted+at-this.started,intervalMs:null,phases:{},gpuMs:null,gpuCalls:0,gpuSamples:0};this.previousFrameAt=at;
  this.attach();
 }
 time(name,fn,recordSpan=true,receiver=null,args=null){
  if(!this.current||!this.active)return args?fn.apply(receiver,args):fn();
  const row=this.current,depth=this.stack.length;
  const entry=this.timingEntries[depth] ||= {at:0,children:0,span:null};
  entry.at=this.now();entry.children=0;entry.span=null;if(this.detailed&&recordSpan&&row.index%this.traceFrameStride===0
    &&(!this.compactTrace||depth<=3||name.endsWith("resetAuthoritativeState"))){
   if(this.spans.length<this.maxSpans){
    if(!this.spanIds.has(name)){this.spanIds.set(name,this.spanNames.length);this.spanNames.push(name);}
    entry.span=[this.spanIds.get(name),Math.round((entry.at-this.started)*1000)/1000,0,0,row.index,this.stack.length];
    this.spans.push(entry.span);
   }else this.droppedSpans++;
  }
  this.stack.push(entry);
  try{return args?fn.apply(receiver,args):fn();}finally{
   const elapsed=Math.max(0,this.now()-entry.at);this.stack.pop();if(this.stack.length)this.stack.at(-1).children+=elapsed;
   let phase=this.compactPhases?this.compactPhases.get(name):row.phases[name];
   if(!phase){phase=row.phases[name]={inclusiveMs:0,selfMs:0,calls:0};this.phaseRecordCount++;}
   phase.inclusiveMs+=elapsed;phase.selfMs+=Math.max(0,elapsed-entry.children);phase.calls++;
   if(this.detailed&&elapsed>=8){
    const slow=row.slowCalls ||= [];
    if(slow.length<24)slow.push({name,startMs:entry.at-this.started,durationMs:elapsed,selfMs:Math.max(0,elapsed-entry.children),
     ...(name==='carSprites.draw'&&args?{spriteKey:String(args[0]).slice(0,100)}:{})});
   }
   if(entry.span){entry.span[2]=Math.round(elapsed*1000)/1000;entry.span[3]=Math.round(Math.max(0,elapsed-entry.children)*1000)/1000;}
  }
 }
 attach(){
  if(!this.active)return;
  const started=this.now();
  try{return this.attachHooks();}finally{
   if(this.current)this.current.recorderSetupMs=(this.current.recorderSetupMs||0)+Math.max(0,this.now()-started);
  }
 }
 attachHooks(){
  const e=this.editor,s=e.playtestSession;
  this.wrap(e.vehicleDynamicsAuthority,'raceEnvironmentProvider','physicsEnvironment');
  this.wrap(s?.vehicleDynamicsRunner,'advance','playerPhysics');
  this.wrap(s?.vehicleDynamicsRunner?.tireContactSubsystem,'step','playerTires');
  this.wrap(s?.vehicleDynamicsRunner?.bodyCollision,'step','playerBodyCollision');
  for(const ai of s?.aiRuntime||[])this.wrap(ai.vehicleDynamicsRunner,'advance','AIPhysics');
  for(const [key,phase] of Object.entries({advance:'trackState',step:'trackStateTick',serviceCheckpointSlice:'trackCheckpoint',freezeCheckpointTarget:'trackCheckpoint.freeze',commitCheckpointBuilder:'trackCheckpoint.commit',applyConservativeFlow:'waterFlow'}))this.wrap(s?.trackState,key,phase);
  if(this.detailed){
   const track=s?.trackState;
   if(track&&!this.eventQueueProbes.has(track)){
    const own=Object.hasOwn(track,'eventQueueProbe'),previous=track.eventQueueProbe;
    const probe=createTrackEventQueueProbe(this.now,this.started);
    this.eventQueueProbes.set(track,probe);this.eventQueueProbeReports.push(probe);track.eventQueueProbe=probe;
    this.restores.push(()=>{if(track.eventQueueProbe===probe){if(own)track.eventQueueProbe=previous;else delete track.eventQueueProbe;}});
   }
   const runners=[s?.vehicleDynamicsRunner,...(s?.aiRuntime||[]).map(ai=>ai.vehicleDynamicsRunner)];
   for(const runner of runners){
   const accounting=runner?.physicsCostAccounting;
   if(accounting&&!this.physicsAccounts.has(accounting)){
    this.physicsAccounts.add(accounting);
    const own=Object.hasOwn(accounting,'detailedCaptureActive'),previous=accounting.detailedCaptureActive;
    const enabled=accounting.enabled;
    const stepMode=accounting.stepHistoryMode,stepDetails=accounting.detailedStepRecords;
    const latestOwn=Object.hasOwn(accounting,'latestFrameOnly'),latest=accounting.latestFrameOnly;
    if(runner!==s?.vehicleDynamicsRunner){
     // Frame totals suffice; avoid allocating a second copy for every AI substep.
     accounting.stepHistoryMode='elapsed-ring';accounting.detailedStepRecords=false;
     accounting.latestFrameOnly=true;
    }
    accounting.detailedCaptureActive=true;
    accounting.enabled=true;
    this.restores.push(()=>{if(latestOwn)accounting.latestFrameOnly=latest;else delete accounting.latestFrameOnly;accounting.stepHistoryMode=stepMode;accounting.detailedStepRecords=stepDetails;accounting.enabled=enabled;if(own)accounting.detailedCaptureActive=previous;else delete accounting.detailedCaptureActive;});
   }
   }
   attachDetailedPerformance(this);
  }
  const renderer=e.raceThreeWorldRenderer?.threeRenderer;
  if(renderer){const self=this;this.hook(renderer,'render',fn=>function(...args){return self.time('webglSubmit',()=>{let query;try{query=self.gpuBegin(renderer);}catch{self.gpuStatus='query-error';}try{return fn.apply(this,args);}finally{try{self.gpuEnd(query);}catch{self.gpuStatus='query-error';}}});});}
 }
 gpuBegin(renderer){
  this.pollGPU();if(!this.current||this.gpuPending.length>=8)return null;
  const gl=renderer.getContext?.();if(!gl?.createQuery)return null;
  if(this.gpuGL!==gl){this.clearGPU();this.gpuGL=gl;this.gpuExt=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.gpuStatus=this.gpuExt?'available':'unsupported';}
  const ext=this.gpuExt;if(!ext||gl.isContextLost?.()||gl.getParameter(ext.GPU_DISJOINT_EXT)||gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return null;
  const query=gl.createQuery();if(!query)return null;
  gl.beginQuery(ext.TIME_ELAPSED_EXT,query);this.current.gpuCalls++;return {gl,ext,query,row:this.current};
 }
 gpuEnd(item){if(!item)return;item.gl.endQuery(item.ext.TIME_ELAPSED_EXT);this.gpuPending.push(item);}
 pollGPU(){try{this.pollGPUResults();}catch{this.gpuStatus='query-error';this.clearGPU();}}
 pollGPUResults(){
  if(!this.gpuPending.length)return;
  if(this.gpuGL?.isContextLost?.()||this.gpuGL?.getParameter(this.gpuExt.GPU_DISJOINT_EXT)){this.gpuStatus='disjoint-results-discarded';this.clearGPU();return;}
  this.gpuPending=this.gpuPending.filter(item=>{
   if(!item.gl.getQueryParameter(item.query,item.gl.QUERY_RESULT_AVAILABLE))return true;
   const ns=item.gl.getQueryParameter(item.query,item.gl.QUERY_RESULT);
   if(Number.isFinite(ns)&&!item.row.gpuInvalid){item.row.gpuMs=(item.row.gpuMs||0)+ns/1e6;item.row.gpuSamples++;}
   item.gl.deleteQuery(item.query);return false;
  });
 }
 clearGPU(){for(const item of this.gpuPending){item.row.gpuMs=null;item.row.gpuInvalid=true;try{item.gl.deleteQuery(item.query);}catch{}}this.gpuPending=[];}
 finish(){
  if(!this.current)return;
  if(this.session && this.editor.playtestSession!==this.session){this.stop('session-changed');return;}
  const finishStarted=this.now();
  const e=this.editor,s=e.playtestSession||{},stats=e.lastRaceRenderStats||{},row=this.current;
  row.context={elapsedMs:s.elapsedMs,countdownMs:s.countdownRemainingMs,intro:s.raceIntro?.active===true,aiCars:s.aiRuntime?.length||0,submittedCarSprites:stats.threeCarDepthSpriteCount||0,camera:e.raceInput?.cameraView||s.cameraView,viewport:e.lastRaceRenderCamera?.bounds?{...e.lastRaceRenderCamera.bounds}:null,cameraYaw:e.lastRaceRenderCamera?.cameraYaw,position:{x:s.worldX,z:s.worldZ},weather:s.debugEnvironment?.weather||e.selectedRace?.weather,intensity:s.debugEnvironment?.weatherIntensity??e.selectedRace?.weatherIntensity,workerPhysics:!!e.vehicleDynamicsAuthority?.workerBridge,paused:e.raceInput?.paused===true};
  if(this.detailed && (this.lastHandlingSampleMs == null || row.atMs-this.lastHandlingSampleMs >= 100)) {
   this.metadata.handlingSetup ||= captureRaceHandlingSetup(e);
   row.handling = captureRaceHandling(e);
   this.lastHandlingSampleMs = row.atMs;
  }
  row.context.frameBudget = s.frameBudget ? { ...s.frameBudget.stats,
    debtSeconds: s.frameSimulationClock?.debtSeconds || 0,
    discardedSeconds: s.frameSimulationClock?.discardedSeconds || 0,
    admittedSeconds: s.frameAdmittedSeconds || 0 } : null;
  row.context.raceClock = s.frameSimulationClock ? {
   mode:s.frameClockMode||'bounded',rawSeconds:s.frameRawSeconds||0,
   observedRawSeconds:s.frameObservedRawSeconds||0,admittedSeconds:s.frameAdmittedSeconds||0,
   excludedSeconds:s.frameExcludedSeconds||0,exclusionReason:s.frameTimeExclusionReason||null,
   totalRawSeconds:s.frameSimulationClock.rawSeconds||0,
   totalAdmittedSeconds:s.frameSimulationClock.admittedSeconds||0,
   debtSeconds:s.frameSimulationClock.debtSeconds||0,
   discardedSeconds:s.frameSimulationClock.discardedSeconds||0,
   totalExcludedSeconds:s.frameSimulationClock.excludedSeconds||0
  } : null;
  row.context.aiPhysics={full:s.aiDetailedPhysicsCount??null,cheap:s.aiCheapPhysicsCount??null,
   held:(s.aiRuntime||[]).filter(ai=>ai.physicsBudgetDetail==='cheap'&&ai.cheapPhysicsHeld===true).length,
   promotions:s.aiPhysicsPromotions||0,
   heldCars:(s.aiRuntime||[]).filter(ai=>ai.physicsBudgetDetail==='cheap'&&ai.cheapPhysicsHeld===true)
    .map(ai=>({id:ai.id,reason:ai.distantPhysicsReason,seconds:Math.round(ai.cheapHeldSeconds||0)})),
   cheapRecoveries:(s.aiRuntime||[]).reduce((n,ai)=>n+(ai.cheapRecoveryCount||0),0)};
  row.context.aiRecovery=(s.aiRuntime||[]).filter(ai=>ai.lastUpsideDownResetError || ai.recoveryWait || ai.upsideDownResetPending)
   .map(ai=>({id:ai.id,attempt:ai.upsideDownRecoveryAttempt||0,error:String(ai.lastUpsideDownResetError||'').slice(0,240),
    waitingSeconds:ai.recoveryWait?.seconds||0,reason:ai.recoveryWait?.reason||ai.lastVehicleResetReason||null,
    resetCount:ai.automaticVehicleResetCount||0}));
  row.context.aiPlanning=(s.aiRuntime||[]).reduce((counts,ai)=>{
   counts.surface+=ai.surfacePlanUpdates||0;counts.speed+=ai.speedPlanUpdates||0;counts.traffic+=ai.trafficPlanUpdates||0;return counts;
  },{surface:0,speed:0,traffic:0});
  row.context.sceneryTriggers=s.sceneryTriggerWork||null;
  row.context.surfaceWork={visual:s.trackState?.lastVisualQuery||null,
   lastContactBatch:s.trackState?.contactAccumulator?.lastFlushCount||0,
   maxContactBatch:s.trackState?.contactAccumulator?.maximumFlushCount||0};
  row.context.checkpointPhase=s.trackState?.checkpointBuilder?.phase||'idle';
  row.context.recovery={pending:!!s.pendingEdgeCenterReset,attempts:Number(s.pendingEdgeCenterReset?.attempts||0),
   verifiedPose:!!s.pendingEdgeCenterReset?.networkProjection?.verifiedRoadPose,
   history:getRaceRecoveryHistoryDiagnostics(s),
   incremental:!!s.incrementalRoadReset,
   supportFailure:s.lastResetSupportFailure||null,
   automaticBlocked:!!s.failedAutomaticRecoveryPosition,
   lastStatus:s.vehicleDynamicsRunner?.diagnostics?.latestResetIncident?.equilibrium?.status||null,
   error:/^(Reset unavailable|Unable to find a safe reset)/.test(e.status||'')?String(e.status).slice(0,240):null};
  row.work={surfaceVisualQueryPending:!!s.trackStateVisualJob,surfaceMeshBuildPending:!!e.raceThreeWorldRenderer?.trackStateBuild,staticGeometryRebuilds:stats.staticGeometryRebuilds||0,staticGeometryReasons:stats.staticGeometryReasons||[],doodadRebuilds:stats.dynamicDoodadRebuilds||0,doodadCacheHits:stats.dynamicDoodadCacheHits||0,trackStateCells:s.trackState?.cells?.size||0,weatherIntegrationSteps:s.trackState?.stepResultScratch?.weatherIntegrationSteps||0,weatherReplayCacheHits:s.trackState?.performanceCounters?.weatherReplayCacheHits||0,weatherReplayCacheMisses:s.trackState?.performanceCounters?.weatherReplayCacheMisses||0,weatherReplayReusedSteps:s.trackState?.performanceCounters?.weatherReplayReusedSteps||0,aheadWeatherPreparationSteps:s.trackState?.performanceCounters?.aheadWeatherPreparationSteps||0,aheadWeatherPreparationSlices:s.trackState?.performanceCounters?.aheadWeatherPreparationSlices||0,weatherHistoryEntries:s.trackState?.weatherTimeline?.size||0,weatherCatchUpRequestedSteps:s.trackState?.performanceCounters?.weatherCatchUpRequestedSteps||0,weatherCatchUpMaxSteps:s.trackState?.performanceCounters?.weatherCatchUpMaxSteps||0,physicsBacklog:s.physicsPerformance?.backlog?.current??null,workerBacklog:s.vehicleDynamicsWorkerMetrics?.backlog?.current??null,carRestFrameBuilds:stats.carRestFrameBuilds||0,carRestFrameHits:stats.carRestFrameHits||0,carRestFrameDeferred:stats.carRestFrameDeferred||0,carRestFramePixels:stats.carRestFramePixels||0,carPaints:stats.threeCarSpritePaints||0,carPaintReasons:{...e.raceThreeWorldRenderer?.carDepthSprites?.stats?.repaintReasons},carReuses:stats.threeCarSpriteReuses||0,uploadedPixels:stats.threeCarSpriteUploadedPixels||0,textureResizes:stats.threeCarSpriteTextureResizes||0,drawCalls:e.raceThreeWorldRenderer?.threeRenderer?.info?.render?.calls||0,triangles:e.raceThreeWorldRenderer?.threeRenderer?.info?.render?.triangles||0};
  if(this.detailed){
   // Copy the completed physics frame, not the 15-frame summary cache. These
   // are a drill-down of existing phases, not additional CPU to add to them.
   const accounting=s.vehicleDynamicsRunner?.physicsCostAccounting;
   const frame=accounting?.getLatestFrame?.();
   const sequence=frame?.metadata?.sequence;
   if(frame && accounting.enabled!==false && sequence!==this.physicsSequences.get(accounting)){
    this.physicsSequences.set(accounting,sequence);
    row.physicsDetail={sequence:frame.metadata?.sequence,
    counters:{...frame.counters},
    timings:Object.fromEntries(Object.entries(frame.timings||{})
     .filter(([name])=>/body|penetration|terrain|support|tire|wheel|staticCollider/i.test(name))
     .map(([name,timing])=>[name,{...timing}]))};
   }
  }
  if(this.detailed){
   for(let index=0;index<(s.aiRuntime||[]).length;index++){
    const ai=s.aiRuntime[index],accounting=ai.vehicleDynamicsRunner?.physicsCostAccounting;
    const frame=accounting?.getLatestFrame?.(),sequence=frame?.metadata?.sequence;
    if(!frame||accounting.enabled===false||sequence===this.physicsSequences.get(accounting))continue;
    this.physicsSequences.set(accounting,sequence);
    (row.aiPhysicsDetail||=[]).push({index,id:ai.id,sequence,
     counters:{...frame.counters},
     timings:Object.fromEntries(Object.entries(frame.timings||{})
      .filter(([name])=>/tire|body|penetration|terrain|support|environment|recovery|wheel|staticCollider/i.test(name))
      .map(([name,timing])=>[name,{...timing}]))});
   }
  }
  if(this.compactPhases){
   const packed=this.compactPhases.finish(row);row.instrumentedCpuMs=packed.cpu;
   this.packedPhaseBytes+=packed.bytes;this.phaseRecordCount+=packed.count;
  }else row.instrumentedCpuMs=Object.values(row.phases).reduce((n,p)=>n+p.selfMs,0);
  this.frames.push(row);this.current=null;this.pollGPU();
  const memoryAt=this.now()-this.started;
  if(this.memoryCapture.due(memoryAt)){
   const rendererMemory=e.raceThreeWorldRenderer?.threeRenderer?.info?.memory;
   this.memoryCapture.sample(memoryAt,{
    recorder:{frames:this.frames.length,spans:this.spans.length,phaseRecords:this.phaseRecordCount,packedPhaseBytes:this.packedPhaseBytes},
    renderer:{geometries:rendererMemory?.geometries??null,textures:rendererMemory?.textures??null},
    cachedCarArtRgbaBytesEstimate:(stats.carRestFramePixels||0)*4,
    trackCells:s.trackState?.cells?.size??null,
    trackEvents:s.trackState?.eventHistory?.length??null,
    checkpointCellCopies:s.trackState?.checkpointBuilder?.cellCopies?.size??null
   });
  }
  row.recorderFinalizeMs=Math.max(0,this.now()-finishStarted);
  if(this.detailed&&!this.compactTrace&&this.spans.length>=this.maxSpans)this.stop('span-limit');
  else if(this.frames.length>=this.maxFrames)this.stop('frame-limit');
 }
 stop(reason='manual'){
  if(!this.active)return;this.active=false;this.reason=reason;this.stopped=this.now();this.current=null;clearTimeout(this.deadline);
  this.latestWorkerSummary=snapshotSummary(this.session?.vehicleDynamicsWorkerMetrics);
  this.latestPhysicsSummary=snapshotSummary(this.session?.physicsPerformance);
  this.session=null;
  this.pollGPU();this.clearGPU();this.observer?.disconnect();for(const restore of this.restores.reverse())restore();this.restores=[];
  try{this.onStop?.(this);}catch(error){this.uploadState='failed';this.uploadError=error.message;}
 }
 report(){
  if(!this.active && this.completedReport)return this.completedReport;
  this.pollGPU();const phases={};for(const row of this.frames)for(const [name,p]of Object.entries(row.phases)){const a=phases[name]||={inclusive:[],self:[],calls:0};a.inclusive.push(p.inclusiveMs);a.self.push(p.selfMs);a.calls+=p.calls;}
  const summary=Object.fromEntries(Object.entries(phases).map(([name,p])=>[name,{calls:p.calls,totalSelfMs:p.self.reduce((a,b)=>a+b,0),p95InclusiveMs:percentile(p.inclusive,.95),p95SelfMs:percentile(p.self,.95)}]));
  const intervals=this.frames.map(r=>r.intervalMs).filter(Number.isFinite);
  const report={version:1,eventQueue:this.eventQueueProbeReports.map(probe=>probe.snapshot()),memory:this.memoryCapture.report(),trace:this.detailed?{format:'nested-spans-v1',frameStride:this.traceFrameStride,compact:this.compactTrace,maximumOrdinaryDepth:this.compactTrace?3:null,columns:['nameId','startMs','durationMs','selfMs','frame','depth'],names:this.spanNames,spans:this.spans,droppedSpans:this.droppedSpans}:null,metadata:this.metadata,active:this.active,stopReason:this.reason||null,durationMs:(this.stopped??this.now())-this.started,
   limitations:['recorderSetupMs and recorderFinalizeMs time hook setup and frame finalization separately from game scopes; they exclude per-call timing overhead and stop/upload/export work, so are not total instrumentation cost.','submittedCarSprites counts submitted car billboards, including the player when drawn; terrain occlusion is not measured.','CPU scopes are synchronous; self times exclude instrumented children. Do not add inclusive times.','Frame intervals include browser scheduling; they are not measured presentation FPS.','GPU queries cover instrumented WebGL render calls only, not Canvas 2D/compositing. Null means unmeasured.','Worker physics execution is not timed on the main thread. Long tasks do not prove garbage collection.'],
   latestWorkerSummary:this.active?this.session?.vehicleDynamicsWorkerMetrics||null:this.latestWorkerSummary,latestPhysicsSummary:this.active?this.session?.physicsPerformance||null:this.latestPhysicsSummary,gpuStatus:this.gpuStatus,frameCount:this.frames.length,frameIntervals:{medianMs:percentile(intervals,.5),p95Ms:percentile(intervals,.95),p99Ms:percentile(intervals,.99),over33ms:intervals.filter(v=>v>33.34).length,over50ms:intervals.filter(v=>v>50).length},phases:summary,
   worstFrames:[...this.frames].sort((a,b)=>(b.intervalMs||0)-(a.intervalMs||0)).slice(0,40),longTasks:this.longTasks,frames:this.frames};
  if(!this.active)this.completedReport=report;
  return report;
 }
}
