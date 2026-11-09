import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {rotateVectorByQuaternion} from '../../src/racing/simulation/RigidBodyMath.js';
import {installVehicleValidationInitialState} from './VehicleValidationHarness.mjs';
const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
const catalog=read('src/content/garage-parts.json').items.map(normalizeItemDocument);
catalog.push(normalizeItemDocument(read('data/server-storage/files/items/Tarmac Race Tires/document.json')));
const savedStock=read('data/server-storage/files/cars/RTG-001/document.json');
const stock=savedStock.car||savedStock;
const tires={};
for(const name of ['Stock','Street','Tarmac','Drift','Rally','Offroad','Rain','Snow']){
 const data=read(`data/server-storage/files/tires/${name}/document.json`);tires[name]=data;
 upsertCachedProjectFile('tires',name,JSON.stringify({folder:'tires',name,savedAt:1,version:1,data}));
}
const raceParts=['race-ecu','race-intake','race-exhaust','race-ignition','race-camshaft','race-turbo','race-weight','race-clutch','race-driveline','street-wheels','adjustable-gearbox','race-differential','sport-brakes','race-suspension','tarmac-tires'];
const built=buildGarageCar(stock,{parts:raceParts.map(id=>{const part=catalog.find(p=>p.id===id);if(!part)throw Error(id);return part;}),tires});
const setups={stock,'saved-race-package':built};
const throttle=Number(process.argv.find(a=>a.startsWith('--throttle='))?.slice(11)??.2);
const steerMagnitude=Number(process.argv.find(a=>a.startsWith('--steer='))?.slice(8)??.35);
const selected=process.argv.find(a=>a.startsWith('--setup='))?.slice(8);
// Authored elevation requests pass through the legacy road smoother: they
// are not constant-grade planes. Use trace pitch and the actual mountain audit
// for slope evidence, rather than treating requestedGrade as a measured grade.
const report={description:'Production RaceEditor and saved RTG-001/tire definitions; authored straight ramps isolate handling from campaign terrain.',cases:[]};
for(const [setup,car] of Object.entries(setups)){
 if(selected&&selected!==setup)continue;
 for(const grade of [0,-.2,.2])for(const tc of [true,false])for(const maneuver of ['straight','steer-release','countersteer']){
  const axes={leftX:0,rightX:0,rightTrigger:throttle,leftTrigger:0};
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,input:{getGamepadAxes:()=>axes,isGamepadConnected:()=>true},exitRaceEditor(){}});
  const runtime=editor.normalizeLoadedCarDocument(structuredClone(car));editor.project.cars=[runtime];editor.project.selectedCarId=runtime.id;
  editor.selectedRace.type='destination';editor.selectedRace.weather='clear';editor.selectedRace.hazards=[];editor.selectedRace.margin={...editor.selectedRace.margin,collisionEdge:'none',collisionMode:'none'};
  editor.selectedRace.road.tileMap={cellSizeM:40,preserveCellSize:true,minElevation:-1000,maxElevation:1000,cells:{}};editor.selectedRace.road.network=null;editor.selectedRace.road.autoExtend=true;editor.selectedRace.road.continuations=null;editor.selectedRace.road.width=100;
  editor.selectedRace.road.nodes=[{x:0,y:0,elevation:0,role:'start'},{x:0,y:800,elevation:800*grade/12,role:'finish'}];
  editor.selectedRace.road.segments=[{length:800,curve:0,elevation:800*grade/12,surface:'asphalt',banking:0,bumpiness:0,hazardIds:[]}];
  editor.preloadSelectedRaceArtRefs=()=>{};
  editor.startPlaytest(runtime.id,{hydrateCars:false});const session=editor.playtestSession;
  session.countdownRemainingMs=0;session.startupFramePending=false;session.launchLockMs=0;
  editor.updatePlaytestSafely(0);const runner=session.vehicleDynamicsRunner;
  const tuning=editor.getRaceCarTuning(runtime,{transmissionType:session.transmissionType});
  const initial=installVehicleValidationInitialState({runner,tuning,speedMps:18});
  session.tractionControlEnabled=tc;editor.raceInput.tractionControlEnabled=tc;
  const q=runner.state.orientation;
  const state=runner.createStateSnapshot();state.velocity=rotateVectorByQuaternion({x:0,y:0,z:18},q);runner.replaceAuthoritativeState(state);
  editor.raceInput.gear=initial.validation.gear;session.gear=initial.validation.gear;
  let maxRoll=0,maxSlip=0,maxYawRate=0,minSupport=4;const trace=[];
  for(let frame=0;frame<150;frame++){
   const t=frame/60;
   const steer=maneuver==='straight'?0:t<.5?0:t<1.2?steerMagnitude:maneuver==='countersteer'&&t<1.8?-steerMagnitude:0;
   axes.leftX=steer;editor.applyRaceAnalogInput();
   editor.raceInput.rawThrottleAxis=throttle;editor.raceInput.analogThrottleActive=true;
   editor.raceInput.keyboardThrottle=false;editor.raceInput.autoShift=true;
   editor.updatePlaytestSafely(1/60);
   const s=runner.state,roll=Math.abs(s.rollRad||0)*180/Math.PI,slip=Math.abs(Math.atan2(s.bodyLateralSpeedMps,Math.max(.01,Math.abs(s.bodyLongitudinalSpeedMps))))*180/Math.PI;
   maxRoll=Math.max(maxRoll,roll);maxSlip=Math.max(maxSlip,slip);maxYawRate=Math.max(maxYawRate,Math.abs(s.yawRateRadps||0));
   const supported=Object.values(s.contactPatches).filter(p=>p.validTreadContact&&p.normalLoadN>20).length;minSupport=Math.min(minSupport,supported);
   if(frame%15===0)trace.push({t,steer,rack:editor.raceInput.steeringWheel,speed:s.groundSpeedMps,roll,pitch:s.pitchRad*180/Math.PI,slip,yaw:s.yawRad,supported});
  }
  const config=runner.config;
  const result={setup,requestedGrade:grade,tc,throttle,steerMagnitude,maneuver,config:{massKg:config.massKg,cgHeightM:config.cgHeightM,track:config.frontTrackWidthM,powerHp:tuning.powerHp,tire:runtime.setup?.defaultTireCompound},initialOrientation:q,maxRoll,maxSlip,maxYawRate,minSupport,finalSpeed:runner.state.groundSpeedMps,trace};
  report.cases.push(result);console.log(JSON.stringify({...result,trace:undefined}));
  editor.disposeRacePlaytestSession(session,'audit-complete');
 }
}
mkdirSync('artifacts/handling-audit',{recursive:true});writeFileSync(`artifacts/handling-audit/${selected||'all'}-${throttle}-${steerMagnitude}.json`,JSON.stringify(report,null,2)+'\n');
