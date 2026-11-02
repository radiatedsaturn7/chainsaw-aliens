import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAquaplaningState} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {RACE_TIRE_COMPOUNDS} from '../../src/racing/raceData.js';
import {createRaceTrackStateWeatherForcing} from '../../src/racing/trackState/TrackStateIntegration.js';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function lift(id,mph,depth=8,wear=0,pressurePsi=32){return calculateAquaplaningState({normalLoadN:3500,tire:{compound:RACE_TIRE_COMPOUNDS.find(c=>c.id===id),wear,pressurePsi},material:{standingWaterDepthMm:depth},kinematics:{longitudinalVelocityMps:mph*.44704,slipRatio:.08}}).liftFraction;}
test('street tires retain support at 30 MPH, with progressive puddle risk rather than universal ice',()=>{
 assert.ok(lift('street',30)<.01);
 assert.ok(lift('street',45)>lift('street',30));
 assert.ok(lift('street',45)<.4);
 assert.ok(lift('street',60)>lift('street',45));
 assert.ok(lift('street',45,1)<.01);
 assert.ok(lift('street',35,8,.8)>lift('street',35));
 assert.ok(lift('street',35,8,0,20)>lift('street',35));
 assert.ok(lift('tarmac',40)>lift('street',40));
 assert.ok(lift('rain',45)<lift('street',45));
 for(const c of RACE_TIRE_COMPOUNDS)assert.equal(lift(c.id,0),0);
});
test('full storm does not flood every asphalt cell during a short race',()=>{
 const forcing=createRaceTrackStateWeatherForcing({weatherState:{id:'storm',effectiveIntensity:1}});
 assert.ok(Math.abs(forcing.precipitationRateMmPerS*3600/25.4-2)<.001);
 const state=new TrackState({sampleBaseSurface:()=>({baseSurfaceId:'asphalt',surfaceTemperatureC:15})});
 for(let i=0;i<2400;i++)state.advance(.1,forcing);
 state.sample({x:0,z:0});const sample=state.getCell({x:0,z:0});
 assert.ok(sample.standingWaterDepthMm<4,`standing water ${sample.standingWaterDepthMm}`);
 assert.ok(sample.moistureDepthMm>0);
});
const context=()=>new Proxy({}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
test('lightning is drawn over authored skybox and only within the sky',()=>{
 const e=new RaceEditor({});e.playtestSession={weatherFxState:{lightningFlash:1}};e.getRaceWeatherState=()=>({id:'storm'});
 const order=[];e.drawRaceWeatherLightning=(c,b)=>order.push(['lightning',b.h]);e.drawRaceSkyboxArt=()=>{order.push(['skybox']);return true;};
 e.drawRaceParallaxBackground(context(),{x:0,y:0,w:512,h:288},{horizon:100});
 assert.deepEqual(order.slice(0,2),[['skybox'],['lightning',100]]);
 e.selectedRace.brightness=.05;assert.equal(e.getRaceLightingBrightness(),1);assert.equal(e.getRaceRenderBrightness(),.05);
 e.lastRaceRenderCamera={cameraSafety:{tunnelConstrained:true}};assert.ok(e.getRaceLightingBrightness()<=.05);
});
test('rain uses translucent neutral highlights and cannot draw foreground lightning',()=>{
 const e=new RaceEditor({});e.playtestSession={elapsedMs:1000,weatherFxState:{lightningFlash:1}};e.drawRaceWeatherVisibilityVeil=()=>false;
 e.drawRaceWeatherLightning=()=>{throw new Error('foreground bolt');};
 e.updateRaceSnowEnvironmentRenderField=()=>[{rain:true,worldX:0,worldZ:50,heightM:4,cameraDepthM:50,opacity:.8,sizePx:1,fallVelocityMps:9}];
 e.projectRaceWorldPointToCamera=()=>({visible:true,screenX:100,screenY:100,cameraZ:50});
 const c=context(),styles=[];c.stroke=()=>styles.push(c.strokeStyle);
 e.drawRaceWeatherFx(c,{x:0,y:0,w:512,h:288},{id:'storm',visualIntensity:1});
 assert.equal(styles.length,1);assert.ok(styles.every(s=>!s.includes('192,224,245')));
});


test('snow rate means snowfall depth and melting does not create equal-depth water',()=>{
 const forcing=createRaceTrackStateWeatherForcing({weatherState:{id:'snow',effectiveIntensity:1}});
 assert.ok(Math.abs(forcing.precipitationRateMmPerS*3600/25.4-1.5)<.001);
 const state=new TrackState({sampleBaseSurface:()=>({baseSurfaceId:'asphalt',surfaceTemperatureC:-4})});
 for(let i=0;i<600;i++)state.advance(.1,forcing);
 const snow=state.sample({x:0,z:0}).cell;
 assert.ok(Math.abs(snow.snowDepthMm-1.5*25.4/60)<.01);
 snow.snowDepthMm=10;snow.surfaceTemperatureC=10;snow.heatResponse=0;snow.drainageRateMmPerS=0;
 const before=snow.moistureDepthMm+snow.standingWaterDepthMm;
 state.applyWeatherToCell(snow,{type:'clear',precipitationRateMmPerS:0,ambientTemperatureC:10,sunIntensity:0,windIntensity:0,humidity:1},1,state.stepIndex);
 const melted=10-snow.snowDepthMm,water=snow.moistureDepthMm+snow.standingWaterDepthMm-before;
 assert.ok(melted>0);assert.ok(water>0&&water<=melted*.101);
});

import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
test('street tires hold a straight 30 MPH run through 8 mm standing water',()=>{
 const editor=new RaceEditor({}),tuning=editor.getRaceCarTuning(editor.selectedCar,{transmissionType:'automatic'});
 const ids=['fl','fr','rl','rr'],each=v=>Object.fromEntries(ids.map(id=>[id,structuredClone(v)]));
 const config={...createVehicleDynamicsConfigFromTuning(tuning),telemetryRetention:'none'};
 config.tireByWheel=each({compound:RACE_TIRE_COMPOUNDS.find(c=>c.id==='street'),pressurePsi:32,coldPressurePsi:32,targetPressurePsi:32,widthMm:245});
 const speed=30*.44704;
 const material={baseSurfaceId:'asphalt',surfaceId:'wet-asphalt',trackStateConditionApplied:true,grip:.82,moistureDepthMm:1,standingWaterDepthMm:8};
 const runner=new VehicleDynamicsRunner({config,initialState:{heightM:config.cgHeightM,gear:2,speedMps:speed,velocity:{x:0,y:0,z:speed},wheelAngularVelocityRadps:each(speed/config.wheelRadiusM)},inputTimeline:[{timeSeconds:0,input:{throttle:.15,requestedGear:2,assists:{autoShift:true,tractionControlEnabled:true}}}],environmentProvider:()=>({surfaceHeightByWheel:each(0),surfaceNormalByWheel:each({x:0,y:1,z:0}),materialByWheel:each(material),sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0},friction:.82})})});
 for(let i=0;i<480;i++)runner.advance(1/120);
 assert.ok(runner.state.position.z>40);
 assert.ok(Math.abs(runner.state.yawRad)<.1,`unexpected spin ${runner.state.yawRad}`);
 assert.ok(runner.state.speedMps>10);
});
