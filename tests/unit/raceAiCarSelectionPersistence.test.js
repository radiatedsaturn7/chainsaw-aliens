import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {calculateCarPerformance} from '../../src/racing/CarPerformance.js';

const editor=()=>new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}});
test('category and AI pool filters survive native document round trips and drive the runtime grid',()=>{
 const e=editor();
 const saved=['WRX4','BUSE-019','PZ-24'].map((name,index)=>{
  const car=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name);
  car.category=index===1?'truck':'car';car.tuning.powerHp=200+100*index;
  car.art.body=`${name} body`;
  e.upsertRaceProjectCar(car);return car;
 });
 e.project.selectedCarId=e.getRaceCarProjectIdentity(saved[1]);
 const loaded=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));
 assert.equal(loaded.category,'truck');
 const selection={availableCarIds:saved.map(c=>e.getRaceCarProjectIdentity(c)),category:'car',performanceClass:calculateCarPerformance(saved[2]).class,defaultCarId:e.getRaceCarProjectIdentity(saved[1])};
 e.selectedRace.competition.carSelection=selection;e.setRaceAiCount(4);
 const loadedRace=e.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
 assert.deepEqual(loadedRace.competition.carSelection,selection);
 e.applyLoadedRaceDocument(loadedRace);
 e.startPlaytest(e.getRaceCarProjectIdentity(saved[0]),{hydrateCars:false});
 assert.deepEqual(e.playtestSession.aiRuntime.map(ai=>ai.carId),[saved[2].__playtestId,...Array(3).fill(saved[1].__playtestId)]);
 for(const ai of e.playtestSession.aiRuntime){
  const source=saved.find(c=>c.__playtestId===ai.carId);
  assert.equal(ai.runtimeCar.art.body,source.art.body);
  assert.equal(ai.runtimeCar.tuning.powerHp,source.tuning.powerHp);
  assert.notEqual(ai.runtimeCar,source);
 }
});

test('default candidate pool excludes legacy starter names and retains separately named saved cars',()=>{
 const e=editor();
 for(const name of ['2022 Subaru WRX','2022 Subaru WRX4','BUSE-019','PZ-24'])e.upsertRaceProjectCar(e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name));
 const ids=e.getRaceAiCarSelection().availableCarIds;
 const names=e.project.cars.filter(c=>ids.includes(e.getRaceCarProjectIdentity(c))).map(c=>c.__playtestDocumentName);
 assert.deepEqual(names.sort(),['2022 Subaru WRX4','BUSE-019','PZ-24'].sort());
 e.selectedRace.competition.carSelection={availableCarIds:[]};assert.deepEqual(e.getRaceAiCarSelection().availableCarIds,[]);
});

test('race snapshot tuning is reused per transmission without mixing saved variants',async()=>{
 const {getRaceAiRuntimeTuning}=await import('../../src/racing/RaceAiSimulation.js');
 let calls=0;
 const e={getRaceCarTuning:(car,{transmissionType})=>{calls++;return {powerHp:car.tuning.powerHp,transmissionType}}};
 const a={runtimeCar:{id:'same',tuning:{powerHp:200}},shiftMode:'automatic'};
 const b={runtimeCar:{id:'same',tuning:{powerHp:400}},shiftMode:'automatic'};
 for(let frame=0;frame<120;frame++){
  assert.equal(getRaceAiRuntimeTuning(e,a,a.runtimeCar).powerHp,200);
  assert.equal(getRaceAiRuntimeTuning(e,b,b.runtimeCar).powerHp,400);
 }
 assert.equal(calls,2);
 a.shiftMode='manual';assert.equal(getRaceAiRuntimeTuning(e,a,a.runtimeCar).transmissionType,'manual');assert.equal(calls,3);
 a.runtimeCar={id:'same',tuning:{powerHp:600}};assert.equal(getRaceAiRuntimeTuning(e,a,a.runtimeCar).powerHp,600);assert.equal(calls,4);
 const live={tuning:{powerHp:100}};assert.equal(getRaceAiRuntimeTuning(e,{},live).powerHp,100);
 live.tuning.powerHp=300;assert.equal(getRaceAiRuntimeTuning(e,{},live).powerHp,300);
});

test('AI prepared terrain queries cover swept bounds, follow new bakes, and preserve missing geometry',async()=>{
 const {prepareRaceAiTerrainFrame}=await import('../../src/racing/RaceAiSimulation.js');
 const {buildRaceBakedSurfaceSampler}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
 const sampler=elevation=>buildRaceBakedSurfaceSampler({elevationScaleM:1,bucketSizeM:4,mesh:{triangles:[
  {region:'road',vertices:[{x:-20,z:-20,elevation},{x:20,z:-20,elevation},{x:20,z:20,elevation}]},
  {region:'road',vertices:[{x:-20,z:-20,elevation},{x:20,z:20,elevation},{x:-20,z:20,elevation}]}
 ]}});
 const e={playtestSession:{worldBake:{surfaceSampler:sampler(0),surfaceRevision:1}}};
 const ai={},runner={config:{bodyWidthM:2,bodyLengthM:5,bodyHeightM:2,wheelRadiusM:0.4}};
 const state={position:{x:0,z:0},velocity:{x:100,z:-100}},previous={position:{x:-5,z:5}};
 const frame=prepareRaceAiTerrainFrame(e,ai,runner,state,previous,0.1);
 assert.equal(frame.samplePoint({x:0,z:0}).heightM,0);
 assert.ok(frame.bounds.minX<-5&&frame.bounds.maxX>10&&frame.bounds.minZ<-10&&frame.bounds.maxZ>5);
 assert.equal(frame.samplePoint({x:200,z:200}).valid,false);
 const cache=ai.terrainQueryFrameCache;
 e.playtestSession.worldBake={surfaceSampler:sampler(1),surfaceRevision:2};
 const next=prepareRaceAiTerrainFrame(e,ai,runner,state,previous,0.1);
 assert.equal(ai.terrainQueryFrameCache,cache);assert.ok(next.samplePoint({x:0,z:0}).heightM>0);
 assert.equal(prepareRaceAiTerrainFrame({}, {}, runner,state,previous),null);
});

test('shared desktop and portrait menus expose correctly named car and race settings',()=>{
 const e=editor();
 for(const mode of ['desktop','portrait']){
  e.activeViewportMode=mode;e.mode='car';
  const category=e.getMenuItems('drivetrain').find(item=>item.id==='car-category');
  assert.equal(category.label,'Category & Performance');assert.equal(category.disabled,false);
  e.mode='race';const pool=e.getMenuItems('settings').find(item=>item.id==='race-ai-cars');
  assert.equal(pool.label,'AI Cars & Classes');assert.equal(pool.disabled,false);
 }
});

test('thirty-car grids survive save/load and runtime construction without the old twelve-car cap',()=>{
 const e=editor();
 const car=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),'Stress car');e.upsertRaceProjectCar(car);
 e.upsertRaceProjectCar(e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),'Opponent car'));
 e.setRaceAiCount(29);
 assert.equal(e.selectedRace.competition.aiDrivers.length,29);
 e.applyLoadedRaceDocument(e.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument()))));
 e.startPlaytest(e.getRaceCarProjectIdentity(car),{hydrateCars:false});
 assert.equal(e.playtestSession.aiRuntime.length,29);
 assert.equal(new Set(e.playtestSession.aiRuntime.map(a=>a.id)).size,29);
 e.setRaceAiCount(1000);assert.equal(e.getRaceAiCount(),29);
});

test('AI footprint geometry uses prepared contact heights and preserves missing support',async()=>{
 const {sampleRaceAiFootprintGeometry}=await import('../../src/racing/RaceAiSimulation.js');
 let calls=0;const frame={samplePoint:p=>{calls++;return p.x===0?{valid:true,heightM:42,normal:{x:0,y:1,z:0}}:{valid:false,heightM:null,normal:null};}};
 const result=sampleRaceAiFootprintGeometry(frame,{fl:{x:0},fr:{x:1},rl:{x:0},rr:{x:1}});
 assert.equal(calls,4);assert.equal(result.heights.fl,42);assert.equal(result.heights.fr,null);assert.equal(result.contacts.fr.normal,null);
});

test('editor forwards an already sampled AI contact state without sampling it again',()=>{
 const e=editor(),car=e.selectedCar,tuning=e.getRaceCarTuning(car);
 e.startPlaytest(car.id,{hydrateCars:false});
 const ai={id:'contact-reuse',runtimeCar:car,worldX:0,worldZ:30,carYaw:0,
  speedMps:0,distance:30,projectedDistance:30,gear:1,rpm:800,
  engineDrive:{throttle:0,brake:0},drivingPlan:{steeringAngleRad:0,targetSpeedMps:0}};
 const contactState=e.getRaceAiContactState(ai,car,tuning);
 e.getRaceAiContactState=()=>{throw Error('duplicate AI contact query');};
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:0,contactState});
 assert.ok(ai.vehicleDynamicsRunner);
 assert.ok(Number.isFinite(ai.worldX));
});


test('editor playtest waits for saved opponents before building its grid',async()=>{
 const e=editor();let release;let starts=0;
 e.hydrateSavedRaceCarsForTravel=()=>new Promise(resolve=>{release=resolve;});
 e.startPlaytest=(id,options)=>{starts++;assert.equal(id,'saved-car:Player');assert.equal(options.hydrateCars,false);};
 const pending=e.startSavedRacePlaytest('saved-car:Player');
 assert.equal(starts,0);
 assert.equal(await e.startSavedRacePlaytest('saved-car:Player'),false);
 release();assert.equal(await pending,true);assert.equal(starts,1);
 assert.equal(e.savedRacePlaytestLoading,false);
});

test('failed or abandoned car downloads cannot start an empty AI grid',async()=>{
 const e=editor();let starts=0;
 e.startPlaytest=()=>{starts++;};
 e.hydrateSavedRaceCarsForTravel=async()=>{throw Error('Opponent download failed');};
 assert.equal(await e.startSavedRacePlaytest('player'),false);
 assert.match(e.lastRaceFailure.message,/Opponent download failed/);
 assert.equal(e.savedRacePlaytestLoading,false);
 let release;
 e.hydrateSavedRaceCarsForTravel=()=>new Promise(resolve=>{release=resolve;});
 const pending=e.startSavedRacePlaytest('player');
 e.game.state='title';release();
 assert.equal(await pending,false);assert.equal(starts,0);
});

test('travel starts the exact preselected grid whose artwork was prepared',()=>{
 const e=editor();
 const saved=['Grid A','Grid B','Grid C'].map(name=>{
  const car=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name);
  e.upsertRaceProjectCar(car);return car;
 });
 e.selectedRace.competition.carSelection={availableCarIds:saved.map(c=>e.getRaceCarProjectIdentity(c))};
 e.setRaceAiCount(2);
 const playerId=e.getRaceCarProjectIdentity(saved[0]);
 const grid=e.selectRaceTravelGridCars(e.selectedRace,playerId);
 assert.equal(grid.length,2);assert.ok(!grid.includes(playerId));
 const oldRandom=Math.random;Math.random=()=>{throw Error('Grid must not be randomized again');};
 try{
  e.startPlaytest(playerId,{hydrateCars:false,preparedAiCarIds:grid});
  assert.deepEqual(e.playtestSession.aiRuntime.map(ai=>ai.carId),grid);
 }finally{Math.random=oldRandom;}
});
