import { Worker } from 'node:worker_threads';
import { createRaceVehicleDynamicsWorkerInitialization } from '../../src/racing/simulation/RaceVehicleDynamicsWorkerBridge.js';
import { createWorkerEnvironmentStateSnapshot } from '../../src/racing/RaceSimulation.js';
import { createRaceTrackStateWeatherForcing } from '../../src/racing/trackState/TrackStateIntegration.js';
import { VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION, createVehicleControlInputBuffer,
 readVehicleRenderSnapshot } from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
const percentiles = values => {
 const sorted=[...values].sort((a,b)=>a-b);
 return Object.fromEntries([['p50',.5],['p95',.95],['p99',.99],['max',1]].map(([key,p])=>[key,sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]||0]));
};
// Actual packed mountain/configuration; deliberately simple straight throttle.
// Measures worker throughput and main event-loop availability, NOT browser FPS
// or race-driving quality. No production migration gate is bypassed/enabled.
export async function runMountainWorkerProbe(editor, sampler, {seconds=8}={}) {
 if(!Number.isFinite(seconds)||seconds<1||seconds>60)throw Error('Probe duration must be 1–60 seconds');
 const session=editor.playtestSession;
 editor.updatePlaytest(1/60);
 const authority=editor.vehicleDynamicsAuthority;
 const ai=session.aiRuntime.map((car,index)=>{
  const runner=car.vehicleDynamicsRunner;
  if(!runner)throw Error('Probe requires initialized detailed AI runners');
  const environment=runner.environmentProvider({state:runner.state,previousState:runner.state,
   controls:{},timeSeconds:runner.simulationTimeSeconds,tireSubstepDt:1/runner.config.tireHz,
   chassisStepDt:1/runner.config.chassisHz,substepIndex:0,reuseContactGeometry:false});
  return {id:`ai-${index}`,runner,active:true,environmentState:createWorkerEnvironmentStateSnapshot(environment)};
 });
 const init=createRaceVehicleDynamicsWorkerInitialization({runner:authority.runner,surfaceSampler:sampler,
  staticColliderDefinitions:authority.staticColliderDefinitions||[],
  environmentState:createWorkerEnvironmentStateSnapshot(authority.chassisGeometryEnvironment||{}),
  trackState:session.trackState,
  weatherForcing:createRaceTrackStateWeatherForcing({weatherState:editor.getRaceWeatherState(),race:editor.selectedRace}),
  activeAiVehicles:ai});
 const worker=new Worker(new URL('../../tests/fixtures/vehicleDynamicsNodeWorker.mjs',import.meta.url),{type:'module'});
 const heartbeats=[],workerTimes=[],backlogs=[],vehicles={};
 let started=0,previous=0,timer,timeout,finish;
 try {
  await new Promise((resolve,reject)=>{
   timeout=setTimeout(()=>reject(Error('Worker probe initialization timed out')),60000);
   worker.on('error',reject);
   worker.on('exit',code=>{if(code)reject(Error(`Worker exited ${code}`));});
   worker.on('message',message=>{
    if(message.type==='error'){reject(Error(message.message));return;}
    if(message.type==='ready'){
     clearTimeout(timeout);started=previous=performance.now();console.log('worker-ready', init.payload.vehicles.length);
     for(const definition of init.payload.vehicles){
      const buffer=createVehicleControlInputBuffer({throttle:.35,gear:1,autoShift:true});
      worker.postMessage({type:'input',vehicleId:definition.id,inputSequence:1,inputBuffer:buffer},[buffer]);
     }
     timer=setInterval(()=>{const at=performance.now();heartbeats.push(at-previous);previous=at;},1000/60);
     finish=setTimeout(resolve,seconds*1000);
    }
    if(message.type==='snapshot'){
     const sample=readVehicleRenderSnapshot(message.buffer);
     if(![sample.position.x,sample.position.y,sample.position.z].every(Number.isFinite)){reject(Error('Nonfinite worker pose'));return;}
     const at=performance.now();
     const entry=vehicles[message.vehicleId] ||= {firstStep:sample.stepIndex,firstAt:at,count:0};
     Object.assign(entry,{lastStep:sample.stepIndex,lastAt:at,backlog:message.backlogSteps,position:sample.position});entry.count++;
     if(message.vehicleId==='player'){workerTimes.push(message.workerStepMs||0);backlogs.push(message.backlogSteps||0);}
     worker.postMessage({type:'recycleSnapshotBuffer',buffer:message.buffer},[message.buffer]);
    }
   });
   worker.postMessage({type:'initialize',protocolVersion:VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
    payload:init.payload},init.transferables);
  });
  for(const entry of Object.values(vehicles))entry.stepsPerSecond=(entry.lastStep-entry.firstStep)/Math.max(.001,(entry.lastAt-entry.firstAt)/1000);
  return {authority:'Node worker CPU/event-loop probe, no rendering; straight throttle, not an ascent',
   seconds,wallSeconds:(performance.now()-started)/1000,vehicleCount:init.payload.vehicles.length,
   mainHeartbeatMs:percentiles(heartbeats),workerTickMs:percentiles(workerTimes),
   backlogSteps:percentiles(backlogs),lastBacklogs:backlogs.slice(-20),vehicles};
 } catch (error) {
  error.probeContext = { stage: started ? 'running' : 'initializing', vehicles,
   heartbeat: percentiles(heartbeats), lastBacklogs: backlogs.slice(-20) };
  throw error;
 } finally {clearInterval(timer);clearTimeout(timeout);clearTimeout(finish);await worker.terminate();}
}
