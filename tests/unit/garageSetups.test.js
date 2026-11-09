import {savedTireForRef} from '../helpers/savedGarageTires.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
import {runGarageAction} from '../../src/garage/GarageMenu.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import raw from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {GarageTuner} from '../../src/garage/GarageTuning.js';
import {GARAGE_SETUP_PROFILES} from '../../src/garage/GarageSetupProfiles.js';
import {loadGarageSetupCatalog,quoteGarageSetup,applyGarageSetup} from '../../src/garage/GarageSetups.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const stock=()=>createBuiltInRaceCars()[0];
async function fixture({credits=100000,save=async()=>({ok:true}),progress={}}={}){
 const parts=raw.items.map(normalizeItemDocument),game={player:{credits},abilities:{}};
 const items=new ItemSystem(game,{load:async key=>key==='rtg-item-progress'?progress:{},save,library:{load:async ref=>parts.find(i=>i.id===ref||i.name===ref)}});
 await items.load();const garage=items.garage,catalog=await loadGarageSetupCatalog(garage);
 return {parts,items,game,garage,catalog};
}
test('all eight packages buy matching parts atomically, reuse ownership, and produce distinct physical setups',async()=>{
 const configs={},editor=new RaceEditor({});
 for(const preset of GARAGE_SETUP_PROFILES){
  const {garage,catalog,game}=await fixture(),car=stock(),before=structuredClone(car);
  const quote=quoteGarageSetup(garage,'car',car,preset.id,catalog);assert.ok(quote.cost>0);
  const receipt=await applyGarageSetup(garage,'car',car,preset.id,{packageParts:true,expectedCost:quote.cost});
  assert.equal(game.player.credits,100000-quote.cost);assert.equal(receipt.bought,7);
  const built=await garage.build('car',car),tuning=editor.getRaceCarTuning(built);
  configs[preset.id]=createVehicleDynamicsConfigFromTuning(tuning);
  assert.equal(tuning.drivetrain,editor.getRaceCarTuning(car).drivetrain);
  assert.equal(tuning.gearRatios.length,editor.getRaceCarTuning(car).gearRatios.length);
  assert.equal(built.setup.defaultTireCompound,preset.tire);
  assert.equal(garage.configuration('car').setupId,preset.id);
  assert.equal(quoteGarageSetup(garage,'car',car,preset.id,catalog).cost,0);
  const again=await applyGarageSetup(garage,'car',car,preset.id,{packageParts:true,expectedCost:0});assert.equal(again.bought,0);
  assert.deepEqual(editor.getRaceCarTuning(await garage.build('car',car)),tuning,'reapplying does not stack modifiers');
  assert.deepEqual(car,before);
 }
 assert.ok(configs.offroad.frontRideHeightM>configs.rally.frontRideHeightM&&configs.rally.frontRideHeightM>configs.race.frontRideHeightM);
 assert.ok(configs.offroad.suspensionTravelFrontM>configs.rally.suspensionTravelFrontM&&configs.rally.suspensionTravelFrontM>configs.race.suspensionTravelFrontM);
 assert.ok(configs.offroad.suspensionRestLengthFrontM>configs.race.suspensionRestLengthFrontM,'ride height reaches the physical suspension rest length');
 assert.ok(configs.race.suspensionSpringRateFrontNpm>configs.offroad.suspensionSpringRateFrontNpm);
 assert.ok(configs.race.frontDownforceCoefficient>configs.drag.frontDownforceCoefficient);
});
test('insufficient funds, failed persistence, incompatibility and changed quotes leave packages untouched',async()=>{
 for(const kind of ['funds','save','compatibility','quote','tire']){
  const f=await fixture({credits:kind==='funds'?1:100000,save:kind==='save'?async()=>({ok:false,reason:'offline'}):undefined});
  const car=stock();if(kind==='compatibility')car.garagePartSlots=['tires'];
  if(kind==='tire')f.garage.loadTire=async()=>{throw Error('missing tires');};
  const before=structuredClone(f.items.progress),money=f.game.player.credits;
  await assert.rejects(applyGarageSetup(f.garage,'car',car,'rally',{packageParts:true,expectedCost:kind==='quote'?1:null}));
  assert.deepEqual(f.items.progress,before,kind);assert.equal(f.game.player.credits,money,kind);
 }
});
test('tune-only uses installed permissions, saves per car, and manual changes mark the setup custom',async()=>{
 let saved;const f=await fixture({save:async(_k,v)=>{saved=structuredClone(v);return {ok:true};}}),car=stock();
 const r=await applyGarageSetup(f.garage,'car',car,'rally');
 assert.equal(r.cost,0);assert.equal(r.applied,4);assert.ok(r.skipped>0);assert.equal(f.garage.installed('car').length,0);
 assert.equal(f.garage.configuration('car').tune['pressure.fl'],28);
 const loaded=await fixture({progress:saved});assert.equal(loaded.garage.configuration('car').setupId,'rally');
 await loaded.garage.setTune('car',{'pressure.fl':29});assert.equal(loaded.garage.configuration('car').setupId,undefined);
 assert.deepEqual(loaded.garage.configuration('other').tune,{});
});
test('owned matching parts in another car need a new copy, and locked purchases are not bypassed',async()=>{
 const f=await fixture(),car=stock();
 await applyGarageSetup(f.garage,'first',car,'race',{packageParts:true});
 assert.ok(quoteGarageSetup(f.garage,'second',car,'race',f.catalog).cost>0);
 f.parts.find(i=>i.id==='rally-suspension').carPart.unlockKey='win-rally';
 const before=structuredClone(f.items.progress);
 await assert.rejects(applyGarageSetup(f.garage,'second',car,'rally',{packageParts:true}),/locked/);
 assert.deepEqual(f.items.progress,before);
});
test('Upgrade Presets presents eight package buttons, navigates back, and fits the selected package',async()=>{
 const f=await fixture(),car=stock(),t=new GarageTuner({garage:f.garage,carRef:'car',resolveCar:async()=>car});await t.readyTask;
 assert.ok(!t.rows.some(r=>r.id==='setupPackage'));
 const p=new MenuPlayer({input:{}}),element={id:'parts',type:'garage-browser',binding:'partRef',action:{}};
 p.resources={garage:f.garage,stockCar:()=>car,setupCatalog:f.catalog,garageCatalog:()=>f.parts.map(item=>({ref:item.id,item}))};
 p.flow={parameters:{carRef:'car'},setParameter(k,v){this.parameters[k]=v;},run:async()=>runGarageAction(f.garage,'garage-fit',p.flow.parameters.partRef,p.flow.parameters,{resolveCar:async()=>car})};
 p.interactive=()=>[element];p.focus=0;
 const root=garageBrowserRows(p.resources,p.flow.parameters);
 assert.deepEqual(root.map(r=>r.label),['Presets','Breathing','Drivetrain','Handling','Engine','Tires','Aero','Chassis']);
 assert.deepEqual(garageBrowserRows(p.resources,p.flow.parameters,{section:'Handling'}).map(r=>r.value).sort(),['alignment','brakes','suspension']);
 await p.activateGarageWidget(element,1,true);
 const state=p.widgetStates.get(element.id);
 assert.deepEqual(garageBrowserRows(p.resources,p.flow.parameters,state).map(r=>r.label),['Setup','Auto Upgrade']);
 await p.activateGarageWidget(element,1,true);
 const rows=garageBrowserRows(p.resources,p.flow.parameters,state);
 assert.equal(rows.length,8);assert.ok(rows.every(r=>r.package&&!r.children));
 assert.deepEqual(rows.map(r=>r.label),['Stock','Street','Road','Rally','Drift','Off-road','Drag','Snow']);
 assert.equal(p.backGarageWidget(),true);assert.equal(f.game.player.credits,100000);
 await p.activateGarageWidget(element,1,true);
 state.index=rows.findIndex(r=>r.value==='package:rally');const cost=rows[state.index].cost;
 assert.ok(cost>0);await p.activateGarageWidget(element,1,true);
 assert.equal(f.game.player.credits,100000-cost);assert.equal(f.garage.configuration('car').setupId,'rally');
 assert.equal(garageBrowserRows(p.resources,p.flow.parameters,state)[state.index].cost,0);
});

test('presets override older generic differential settings in either edit order',async()=>{
 const f=await fixture(),car=stock(),editor=new RaceEditor({});
 await f.garage.purchase('race-differential',{carRef:'car'});
 await f.garage.setTune('car',{frontDifferentialAccel:.1,differentialAccel:.8});
 await applyGarageSetup(f.garage,'car',car,'rally');
 const t=editor.getRaceCarTuning(await f.garage.build('car',car));
 assert.equal(t.frontDifferentialAccel,.3);assert.equal(t.rearDifferentialAccel,.45);
});

test('Stock upgrade preset resets all installed parts and tuning for one car, retaining ownership and condition',async()=>{
 const f=await fixture(),car=stock();
 await applyGarageSetup(f.garage,'car',car,'rally',{packageParts:true});
 await f.garage.purchase('engine-swap-v8',{carRef:'car'});
 await f.garage.purchase('drive-swap-rwd',{carRef:'car'});
 await applyGarageSetup(f.garage,'other',car,'street',{packageParts:true});
 await f.garage.saveCondition('car',{damage:{engine:12}});
 const before=structuredClone(f.items.progress),credits=f.game.player.credits;
 const expected=await f.garage.build('fresh',car);
 await runGarageAction(f.garage,'garage-fit','package:stock',{carRef:'car'},{resolveCar:async()=>car});
 const setup=f.garage.configuration('car');
 assert.deepEqual(setup.installed,{});assert.deepEqual(setup.tune,{});assert.equal(setup.setupId,undefined);
 assert.deepEqual(setup.condition,before.garage.cars.car.condition);
 assert.deepEqual(f.garage.configuration('other'),before.garage.cars.other);
 assert.deepEqual(f.items.progress.bags,before.bags);assert.equal(f.game.player.credits,credits);
 const built=await f.garage.build('car',car);
 assert.deepEqual(built.tuning,expected.tuning);assert.deepEqual(built.transmissions,expected.transmissions);assert.deepEqual(built.setup,expected.setup);
 for(const id of Object.values(before.garage.cars.car.installed))assert.ok(f.garage.availableCount(id)>0);
});
test('Stock reset is atomic when saving fails',async()=>{
 let fail=false;const f=await fixture({save:async()=>({ok:!fail,reason:'offline'})});
 await applyGarageSetup(f.garage,'car',stock(),'race',{packageParts:true});
 const before=structuredClone(f.items.progress);fail=true;
 await assert.rejects(f.garage.resetStock('car'),/offline/);assert.deepEqual(f.items.progress,before);
});
