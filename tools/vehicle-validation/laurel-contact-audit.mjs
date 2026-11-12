// Reconstruct a captured pose on the saved world; not an exact input replay.
import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
import {sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';
import {serialize,deserialize} from 'node:v8';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
const file=process.argv[2];if(!file)throw Error('Pass a performance capture path');
const capture=JSON.parse(fs.readFileSync(file)),frame=capture.frames.find(f=>f.handling?.state),h=frame.handling;
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const e=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
e.applyLoadedRaceDocument(read(`data/server-storage/files/races/${capture.metadata.race}/document.json`));
e.applyLoadedCarDocument(read('data/server-storage/files/cars/RTG-001/document.json'),{name:'RTG-001'});
e.hydrateProjectCarsFromSavedFiles=()=>{};e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
// A cache argument explicitly requests a previous bake for before/after comparison.
const cache=process.argv[3]||null;
const p=cache && fs.existsSync(cache)?deserialize(fs.readFileSync(cache)):await buildRaceTransferPackage(e.selectedRace,{sourceNormalized:true,includeArtAssets:false,options:e.getRacePlaytestWorldBakeOptions()});
if(cache && !fs.existsSync(cache))fs.writeFileSync(cache,serialize(p));
console.log('projection',e.getRaceRouteProjectionForWorldPoint(h.state.position));
for(let x=-2;x<=2;x+=.5){const point={x:h.state.position.x+Math.cos(frame.context.cameraYaw)*x,z:h.state.position.z-Math.sin(frame.context.cameraYaw)*x};console.log('cross-section',x,sampleRaceBakedSurface(p.packedSampler,point));}
const car=e.project.cars.find(c=>c.__playtestDocumentName==='RTG-001');
e.startPlaytest(e.getRaceCarProjectIdentity(car),{hydrateCars:false,preparedWorldBake:{...p.header,surfaceSampler:p.packedSampler,packedTerrain:p.packedTerrain}});
const session=e.playtestSession;Object.assign(session,{preparing:false,running:true,startupFramePending:false,countdownRemainingMs:0,launchLockMs:0,raceMusicPending:false});if(session.raceIntro)session.raceIntro.active=false;
e.updatePlaytest(0);e.updatePlaytest(1/60);
const original=session.vehicleDynamicsRunner;
const runner=new VehicleDynamicsRunner({config:{...original.config,...capture.metadata.handlingSetup.config,telemetryRetention:"latest"},initialState:original.state,environmentProvider:original.environmentProvider});
const state=runner.state,yaw=frame.context.cameraYaw;
Object.assign(state,{position:{...h.state.position},orientation:quaternionFromEuler({yaw,pitch:h.state.pitchRad,roll:h.state.rollRad}),yawRad:yaw,rollRad:h.state.rollRad,pitchRad:h.state.pitchRad,
 velocity:{x:Math.sin(yaw)*h.state.bodyLongitudinalSpeedMps+Math.cos(yaw)*h.state.bodyLateralSpeedMps,y:0,z:Math.cos(yaw)*h.state.bodyLongitudinalSpeedMps-Math.sin(yaw)*h.state.bodyLateralSpeedMps},angularVelocityWorld:{x:0,y:h.state.yawRateRadps,z:0}});
Object.assign(session,{worldX:state.position.x,worldZ:state.position.z,carYaw:yaw,distance:h.distanceM});
runner.updateDerivedMotionState(state);
const rows=[];
for(let i=0;i<600;i++){
 runner.advance(1/120,{input:{throttle:.5,brake:0,steering:0,requestedGear:1,assists:{autoShift:false,absEnabled:false,tractionControlEnabled:false,stabilityControlEnabled:false}}});
 if(i<4||i%20===0){const s=runner.state;rows.push({step:i,controls:structuredClone(runner.telemetry.at(-1)?.controls),powertrain:structuredClone(s.powertrainState),position:{...s.position},velocity:{...s.velocity},orientation:{...s.orientation},body:structuredClone(runner.telemetry.at(-1)?.forces?.bodyCollision || s.bodyCollision),contact:structuredClone(runner.contactStabilizationState),wheels:structuredClone(s.contactPatches)});}
}
console.log('telemetry keys',Object.keys(runner.telemetry.at(-1)||{}));
fs.writeFileSync(cache ? cache.replace('.bin','-audit.json') : 'artifacts/laurel-contact-audit.json',JSON.stringify({source:file,assumptions:'Reconstructed yaw from first-person camera, no exact suspension/thermal/history state in capture',rows},null,2));
console.log(JSON.stringify(rows.map(r=>({step:r.step,position:r.position,velocity:r.velocity,body:r.body})),null,2));
