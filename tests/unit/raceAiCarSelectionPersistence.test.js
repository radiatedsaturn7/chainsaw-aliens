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

test('default candidate pool includes saved files even with stock names and omits system templates',()=>{
 const e=editor();
 for(const name of ['2022 Subaru WRX','2022 Subaru WRX4','BUSE-019','PZ-24'])e.upsertRaceProjectCar(e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name));
 const ids=e.getRaceAiCarSelection().availableCarIds;
 const names=e.project.cars.filter(c=>ids.includes(e.getRaceCarProjectIdentity(c))).map(c=>c.__playtestDocumentName);
 assert.deepEqual(names.sort(),['2022 Subaru WRX','2022 Subaru WRX4','BUSE-019','PZ-24'].sort());
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
