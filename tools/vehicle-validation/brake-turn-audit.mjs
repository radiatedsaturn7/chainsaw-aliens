import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {applyTireDefinition} from '../../src/racing/raceTires.js';
import {installVehicleValidationInitialState} from './VehicleValidationHarness.mjs';
const root=new URL('../../',import.meta.url);
const saved=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/cars/RTG-001/document.json',root))).car;
const tire=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/tires/Stock/document.json',root)));
let bake;
export function runBrakeTurnCase({mode='single-touch',stability=true,bias=null,steering=.3,fps=60,speedMps=18,brakeDuration=.1,duration=2.5,driver=null,tuningOverrides=null}={}){
 const axes={leftX:0,rightTrigger:.15,leftTrigger:0};
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,input:{getGamepadAxes:()=>axes,isGamepadConnected:()=>true},exitRaceEditor(){}});
 const car=editor.normalizeLoadedCarDocument(structuredClone(saved));applyTireDefinition(car,tire,'Stock');
 if(tuningOverrides){Object.assign(car.tuning,tuningOverrides);for(const transmission of Object.values(car.transmissions||{}))Object.assign(transmission,tuningOverrides);}
 if(Number.isFinite(bias)&&bias>0){car.tuning.brakeBalance=bias;for(const transmission of Object.values(car.transmissions||{}))transmission.brakeBalance=bias;}
 editor.project.cars=[car];editor.project.selectedCarId=car.id;
 editor.selectedRace.road.network=null;editor.selectedRace.road.width=100;
 editor.selectedRace.road.nodes=[{x:0,y:0,elevation:0,role:'start'},{x:0,y:800,elevation:0,role:'finish'}];
 editor.selectedRace.road.segments=[{length:800,curve:0,elevation:0,surface:'asphalt',turn:'smooth',banking:0,bumpiness:0,hazardIds:[]}];
 editor.selectedRace.margin={...editor.selectedRace.margin,collisionEdge:'none',collisionMode:'none'};editor.selectedRace.hazards=[];editor.selectedRace.weather='clear';
 editor.startPlaytest(car.id,{hydrateCars:false,...(bake?{preparedWorldBake:bake}:{})});
 const session=editor.playtestSession;bake=session.worldBake;
 Object.assign(session,{countdownRemainingMs:0,startupFramePending:false,launchLockMs:0});editor.raceInput.stabilityControlEnabled=stability;session.stabilityControlEnabled=stability;editor.updatePlaytestSafely(0);
 const runner=session.vehicleDynamicsRunner;
 const initial=installVehicleValidationInitialState({runner,tuning:editor.getRaceCarTuning(car,{transmissionType:session.transmissionType}),speedMps});
 editor.raceInput.gear=initial.validation.gear;session.gear=initial.validation.gear;
 const trace=[];let maxSlip=0,maxYaw=0,handbrakeFrames=0,previousBrake=false;
 for(let frame=0;frame<fps*duration;frame++){
  const t=frame/fps,command=driver?.(t,runner.state),brake=command?Number(command.brake||0)>0:mode!=='coast'&&((t>=1&&t<1+brakeDuration)||(mode.startsWith('double')&&t>=1.2&&t<1.3));
  axes.leftX=command?command.steering:(t<.3?0:steering);axes.rightTrigger=command?command.throttle:(t<1?.15:0);editor.raceInput.inputClockMs=t*1000;
  if(mode.endsWith('touch')){
   if(brake&&!previousBrake)editor.handleRacePlaytestPointerDown({playtestControl:'brake'},{id:'brake'});
   if(!brake&&previousBrake)editor.raceInput.activeBrakePointerId=null;
  }else axes.leftTrigger=brake?1:0;
  previousBrake=brake;editor.applyRaceAnalogInput();editor.updatePlaytestSafely(1/fps);
  const s=runner.state,slip=Math.abs(Math.atan2(s.bodyLateralSpeedMps,Math.max(.1,Math.abs(s.bodyLongitudinalSpeedMps))))*180/Math.PI;
  maxSlip=Math.max(maxSlip,slip);maxYaw=Math.max(maxYaw,Math.abs(s.yawRateRadps));if(s.handbrakeCommandState?.active)handbrakeFrames++;
  if(frame%Math.max(1,Math.round(fps/10))===0)trace.push({t,slip,speed:s.groundSpeedMps,yawRate:s.yawRateRadps,brake:editor.raceInput.brakeAxis,handbrake:s.handbrakeCommandState?.active,roll:s.rollRad,position:{...s.position},steeringAngles:Object.fromEntries(Object.entries(s.contactPatches).map(([id,p])=>[id,p.steeringAngleRad])),loads:{...s.wheelLoadsN},support:Object.fromEntries(Object.entries(s.contactPatches).map(([id,p])=>[id,{lateral:p.lateralForceN,longitudinal:p.longitudinalForceN,point:{...p.contactPointWorld},normal:{...p.surfaceSampleNormalWorld},support:p.chassisSupportLoadN,load:p.normalLoadN,bump:p.bumpStopForceN,hard:p.hardStopForceN,overtravel:p.overtravelM}])),slipRatio:Object.fromEntries(Object.entries(s.contactPatches).map(([id,p])=>[id,p.rawSlipRatio]))});
 }
 const result={mode,stability,bias,steering,fps,speedMps,brakeDuration,duration,maxSlip,maxYaw,handbrakeFrames,trace};
 editor.disposeRacePlaytestSession(session,'audit-complete');return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const stability=!process.argv.includes('--no-stability');
 const bias=Number(process.argv.find(a=>a.startsWith('--bias='))?.slice(7))||null;
 for(const mode of ['coast','single-touch','double-touch','double-trigger'])console.log(JSON.stringify(runBrakeTurnCase({mode,stability,bias})));
}
