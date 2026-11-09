// A controlled reconstruction, not exact replay: captures contain 10 Hz input
// samples but omit the full initial suspension/contact state.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {calculateAuthoritativeSteeringEnvelope} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {getGamepadSpeedSteeringScale} from '../../src/racing/simulation/RaceSimulationConfig.js';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
import {installVehicleValidationInitialState} from './VehicleValidationHarness.mjs';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const capture=read(process.argv[2]||'data/server-storage/performance-captures/7d1f10e5ff30ae80399ea905f28b9538e14f45c697ed7f5c66ca98363a055f08.json');
const frames=capture.frames.filter(f=>f.handling?.state);
const startMs=Number(process.argv.find(a=>a.startsWith('--start-ms='))?.split('=')[1]||45300);
const recoveryDriver=process.argv.includes('--recovery-driver');
const routeDriver=process.argv.includes('--route-driver');
const start=frames.findIndex(f=>f.atMs>=startMs),first=frames[start];
const race=read('data/server-storage/files/races/North 02 - Mohawk Trail/document.json').race;
const saved=read('data/server-storage/files/cars/RTG-001/document.json').car;
const editor=new RaceEditor({isMobile:true,deviceIsMobile:true,exitRaceEditor(){}});
editor.applyLoadedRaceDocument(race);
const car=editor.normalizeLoadedCarDocument(saved);
Object.assign(car.tuning,capture.metadata.handlingSetup.tuning);
for(const transmission of Object.values(car.transmissions||{}))Object.assign(transmission,capture.metadata.handlingSetup.tuning);
editor.project.cars=[car];editor.project.selectedCarId=car.id;
const packed=await buildRaceTransferPackage(race,{includeArtAssets:false});
editor.startPlaytest(car.id,{hydrateCars:false,preparedWorldBake:{...packed.header,surfaceSampler:packed.packedSampler,packedTerrain:packed.packedTerrain}});
const session=editor.playtestSession;
Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,launchLockMs:0});
editor.updatePlaytestSafely(0);
editor.applyRaceCarRouteCenterReset({projection:{distance:first.handling.distanceM},preserveMotion:false});
const runner=session.vehicleDynamicsRunner;
const initial=installVehicleValidationInitialState({runner,tuning:editor.getRaceCarTuning(car),speedMps:first.handling.state.groundSpeedMps});
editor.raceInput.gear=initial.validation.gear;session.gear=initial.validation.gear;
let cursor=start;const trace=[];
for(let frame=0;frame<600;frame++){
 const at=first.atMs+frame/120*1000;
 while(cursor+1<frames.length&&frames[cursor+1].atMs<=at)cursor++;
 let input=frames[cursor].handling.inputs;
 if(routeDriver){
  const state=runner.state,lookahead=Math.max(15,state.groundSpeedMps*.8);
  const target=editor.getRaceWorldPoseAtDistance(session.distance+lookahead);
  const heading=Math.atan2(target.x-state.position.x,target.z-state.position.z);
  const error=Math.atan2(Math.sin(heading-state.yawRad),Math.cos(heading-state.yawRad));
  const rack=Math.atan(2*runner.config.wheelbaseM*Math.sin(error)/lookahead);
  const envelope=calculateAuthoritativeSteeringEnvelope(state,runner.config)*getGamepadSpeedSteeringScale(state.groundSpeedMps);
  input={...input,throttleAxis:0,brakeAxis:0,analogSteeringIntent:Math.max(-1,Math.min(1,-rack/Math.max(.001,envelope)))};
 }
 else if(recoveryDriver){
  const lateral=runner.state.bodyLateralSpeedMps;
  input={...input,throttleAxis:0,brakeAxis:0,analogSteeringIntent:frame<42?input.analogSteeringIntent:Math.abs(lateral)>1?-Math.sign(lateral)*.25:0};
 }
 Object.assign(editor.raceInput,{analogSteeringActive:true,analogSteeringIntent:input.analogSteeringIntent,analogThrottleActive:true,analogBrakeActive:true,rawThrottleAxis:input.throttleAxis,rawBrakeAxis:input.brakeAxis,autoShift:true});
 editor.updatePlaytestSafely(1/120);
 if(frame%12===0){const s=runner.state;trace.push({t:at/1000,distance:session.distance,speed:s.groundSpeedMps,roll:s.rollRad,slip:Math.atan2(s.bodyLateralSpeedMps,Math.abs(s.bodyLongitudinalSpeedMps)),wheels:Object.fromEntries(Object.entries(s.contactPatches).map(([id,p])=>[id,{load:p.normalLoadN,support:p.chassisSupportLoadN,hard:p.hardStopForceN,bump:p.bumpStopForceN,overtravel:p.overtravelM,source:p.terrainSampleSource}]))});}
}
console.log(JSON.stringify({approximate:true,startMs,recoveryDriver,routeDriver,trace}));editor.disposeRacePlaytestSession(session,'audit-complete');
