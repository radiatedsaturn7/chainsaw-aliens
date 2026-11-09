import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
const root=new URL('../../',import.meta.url);
const saved=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/races/Mount Washington Auto Road %25E2%2580%2594 point-to-point/document.json',root)));
const race=(saved.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(saved.data,'base64'))):saved).race;
const car=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/cars/RTG-001/document.json',root))).car;
const packed=await buildRaceTransferPackage(race,{includeArtAssets:false});
const bake={...packed.header,surfaceSampler:packed.packedSampler,packedTerrain:packed.packedTerrain};
for(const tc of [true,false]){
 const axes={leftX:0,rightTrigger:.65,leftTrigger:0};
 const editor=new RaceEditor({isMobile:true,deviceIsMobile:true,input:{getGamepadAxes:()=>axes,isGamepadConnected:()=>true},exitRaceEditor(){}});
 editor.applyLoadedRaceDocument(race);const runtime=editor.normalizeLoadedCarDocument(structuredClone(car));editor.project.cars=[runtime];editor.project.selectedCarId=runtime.id;
 editor.startPlaytest(runtime.id,{hydrateCars:false,preparedWorldBake:bake});
 const session=editor.playtestSession;Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,launchLockMs:0,tractionControlEnabled:tc});
 editor.raceInput.tractionControlEnabled=tc;editor.raceInput.autoShift=true;
 editor.updatePlaytestSafely(0);
 let maxRoll=0,maxSlip=0,maxSpeed=0;const trace=[];
 for(let frame=0;frame<300;frame++){
  const s=session.vehicleDynamicsRunner.state;
  const ahead=editor.getRaceWorldPoseAtDistance(Number(session.distance||0)+15);
  const desired=Math.atan2(ahead.x-s.position.x,ahead.z-s.position.z);
  const delta=Math.atan2(Math.sin(desired-s.yawRad),Math.cos(desired-s.yawRad));
  axes.leftX=Math.max(-.65,Math.min(.65,-delta*1.5));editor.applyRaceAnalogInput();
  if(!editor.updatePlaytestSafely(1/60))throw Error(editor.status);
  const roll=Math.abs(s.rollRad)*180/Math.PI,slip=Math.abs(Math.atan2(s.bodyLateralSpeedMps,Math.max(.1,Math.abs(s.bodyLongitudinalSpeedMps))))*180/Math.PI;
  if(!Number.isFinite(roll+slip+s.groundSpeedMps))throw Error('Nonfinite state');
  maxRoll=Math.max(maxRoll,roll);maxSlip=Math.max(maxSlip,slip);maxSpeed=Math.max(maxSpeed,s.groundSpeedMps);
  if(frame%30===0)trace.push({t:frame/60,distance:session.distance,speed:s.groundSpeedMps,roll,slip,steering:axes.leftX});
 }
 console.log(JSON.stringify({tc,seconds:5,maxRoll,maxSlip,maxSpeed,distance:session.distance,trace}));
 editor.disposeRacePlaytestSession(session,'audit-complete');
}
