import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemDocument,serializeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar,normalizeCarPart} from '../../src/garage/CarPart.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const stock=()=>({id:'custom',name:'Test car',setup:{tirePressurePsi:{fl:32,fr:32,rl:30,rr:30}},tuning:{weightKg:1400,gearFinalDrive:4,gearRatios:[3,2,1],springFront:0.5,engineCurve:{rpmMin:1000,rpmMax:6000,torquePoints:[{rpm:1000,torqueLbFt:100},{rpm:4000,torqueLbFt:200},{rpm:6000,torqueLbFt:150}]}},transmissions:{automatic:{weightKg:1500,gearFinalDrive:4.5,gearRatios:[3.5,2,1]}}});
const part=(id,definition={})=>normalizeItemDocument({id,name:id,carPart:{slot:id,price:100,...definition}});
function fixture({save=async()=>({ok:true}),load=async()=>({}),catalog=[]}={}){
 const game={player:{credits:1000},abilities:{}};
 const items=new ItemSystem(game,{save,load,library:{load:async ref=>catalog.find(item=>item.id===ref)}});return {items,garage:items.garage,game};
}
test('authored parts survive serialization; invalid setting paths and ranges are rejected',()=>{
 const item=part('ecu',{tuning:[{field:'torqueScale',min:0.8,max:1.2,step:0.01}]});
 assert.deepEqual(normalizeItemDocument(JSON.parse(JSON.stringify(serializeItemDocument(item)))),item);
 assert.throws(()=>normalizeCarPart({slot:'ecu',modifiers:[{field:'__proto__.bad',operation:'set',value:1}]}));
 assert.throws(()=>normalizeCarPart({slot:'ecu',tuning:[{field:'weightKg',min:0,max:100}]}));
});
test('parts change real race torque, gearing, mass and pressure without mutating stock',()=>{
 const car=stock(),before=structuredClone(car);
 const parts=[part('turbo',{torqueCurve:[{rpm:1000,multiplier:1},{rpm:4000,multiplier:1.5},{rpm:6000,multiplier:1.2}]}),part('weight',{modifiers:[{field:'weightKg',operation:'add',value:-100}]}),part('gearbox',{tuning:[{field:'gearFinalDrive',min:2,max:6,step:0.1},{field:'gearRatios.0',min:1,max:5,step:0.1},{field:'pressure.fl',min:20,max:40,step:1}]})];
 const modified=buildGarageCar(car,{parts,tune:{gearFinalDrive:3.2,'gearRatios.0':2.8,'pressure.fl':26}});
 assert.deepEqual(car,before);assert.equal(modified.tuning.engineCurve.torquePoints[1].torqueLbFt,300);
 assert.equal(modified.setup.tirePressurePsi.fl,26);
 const editor=new RaceEditor({});const actual=editor.getRaceCarTuning(modified,{transmissionType:'automatic'});
 assert.equal(actual.weightKg,1400);assert.equal(actual.finalDrive,3.2);assert.equal(actual.gearRatios[0],2.8);assert.equal(actual.torqueLbFt,300);
 assert.deepEqual(buildGarageCar(car),before);
});
test('purchase, equip, tune, remove and reload preserve ownership and stock independence',async()=>{
 const ecu=part('ecu',{compatibleCars:['WRX'],tuning:[{field:'torqueScale',min:0.8,max:1.5,step:0.01}]});let saved;
 const {garage,items,game}=fixture({catalog:[ecu],save:async(_key,value)=>{saved=structuredClone(value);return {ok:true};}});
 await garage.purchase('ecu');assert.equal(game.player.credits,900);
 await garage.equip('WRX','ecu');await garage.tune('WRX','torqueScale',1.2);
 assert.equal((await garage.build('WRX',stock())).tuning.engineCurve.torquePoints[1].torqueLbFt,240);
 const reload=fixture({load:async key=>key==='rtg-item-progress'?saved:{}});await reload.garage.load();
 assert.equal(reload.garage.configuration('WRX').tune.torqueScale,1.2);
 await garage.remove('WRX','ecu');assert.equal(items.progress.bags.items.ecu,1);
 assert.deepEqual(await garage.build('WRX',stock()),stock());
 await assert.rejects(garage.tune('WRX','torqueScale',1.1),/Install/);
});
test('locked parts, compatibility, dependencies, quantities and failed saves cannot corrupt ownership',async()=>{
 const ecu=part('ecu'),turbo=part('turbo',{requires:['ecu'],unlockKey:'race-win'});
 const {garage,items,game}=fixture({catalog:[ecu,turbo]});await garage.load();
 await assert.rejects(garage.purchase('turbo'),/unlocked/);
 await garage.purchase('ecu');await garage.equip('A','ecu');await assert.rejects(garage.equip('B','ecu'),/another car/);
 items.progress.unlocks['race-win']=true;await garage.purchase('turbo');await garage.equip('A','turbo');
 await assert.rejects(garage.remove('A','ecu'),/requires/);
 const before=structuredClone(items.progress),credits=game.player.credits;
 items.savePreference=async()=>({ok:false,reason:'offline'});
 await assert.rejects(garage.remove('A','turbo'),/offline/);assert.deepEqual(items.progress,before);assert.equal(game.player.credits,credits);
});
test('finding a part and granting a referenced inventory item both populate the garage',async()=>{
 const ecu=part('ecu');const {items,garage}=fixture({catalog:[ecu]});
 assert.equal(await items.collect(ecu,'pickup-ecu'),true);assert.equal(garage.owned()[0].id,'ecu');
 assert.equal(await items.collect({id:'reward',effects:[{type:'inventory',target:'ecu',itemRef:'ecu',bag:'items'}]},'reward'),true);
 assert.equal(items.progress.bags.items.ecu,2);assert.equal(garage.availableCount('ecu'),2);
});

test('garage torque curves and suspension rates reach the production powertrain and chassis config',async()=>{
 const {createVehicleDynamicsConfigFromTuning}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const car=stock();car.tuning.physicalVehicleProfile={suspensionSpringRateFrontNpm:40000};
 const parts=[part('springs',{modifiers:[{field:'springFront',operation:'set',value:0.9}]}),part('turbo',{torqueCurve:[{rpm:1000,multiplier:1},{rpm:4000,multiplier:1.5}]})];
 const upgraded=buildGarageCar(car,{parts}),editor=new RaceEditor({});
 const tuning=editor.getRaceCarTuning(upgraded),config=createVehicleDynamicsConfigFromTuning(tuning);
 assert.equal(editor.getRaceTorqueNmAtRpm(4000,tuning),300*1.35582);
 assert.equal(editor.getRaceTorqueNmAtRpm(1000,tuning),100*1.35582);
 assert.ok(config.suspensionSpringRateFrontNpm>40000);
 assert.equal(car.tuning.physicalVehicleProfile.suspensionSpringRateFrontNpm,40000);
});
test('tire upgrades replace tire physics and graphics on the clone and remove cleanly',async()=>{
 const {createTireDefinition}=await import('../../src/racing/raceTires.js');
 const car=stock(),tire=createTireDefinition('dirt');
 const changed=buildGarageCar(car,{parts:[part('tires',{tireRef:'Rally'})],tires:{Rally:tire}});
 assert.equal(changed.setup.defaultTireCompound,'dirt');assert.equal(changed.setup.tireDefinition.ref,'Rally');
 assert.equal(car.setup.tireDefinition,undefined);assert.deepEqual(buildGarageCar(car),car);
});
test('concurrent purchases serialize credits and an unaffordable purchase grants nothing',async()=>{
 const expensive=part('expensive',{price:600}),{garage,items,game}=fixture({catalog:[expensive]});
 const results=await Promise.allSettled([garage.purchase('expensive'),garage.purchase('expensive')]);
 assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected']);assert.equal(game.player.credits,400);assert.equal(items.progress.bags.items.expensive,1);
});
test('menu garage actions use authored targets and selection configuration',async()=>{
 const {MenuFlow}=await import('../../src/menus/MenuFlow.js');
 const {createMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const calls=[],flow=new MenuFlow(createMenuDocument(),{garageAction:async(...args)=>calls.push(args)});
 flow.setParameter('carRef','WRX');flow.setParameter('partRef','Custom ECU');
 assert.equal(await flow.run({type:'garage-buy',target:'$partRef',then:{type:'garage-install',target:'$partRef'}}),true);
 assert.equal(calls[0][1],'Custom ECU');assert.equal(calls[1][2].carRef,'WRX');
 assert.ok(flow.document.screens.find(s=>s.id==='garage').elements.some(e=>e.type==='car-stats'));
});
test('an authored boost peak between stock curve points survives into the runtime curve',()=>{
 const car=stock();const modified=buildGarageCar(car,{parts:[part('turbo',{torqueCurve:[{rpm:1000,multiplier:1},{rpm:2500,multiplier:2},{rpm:4000,multiplier:1}]})]});
 const editor=new RaceEditor({}),tuning=editor.getRaceCarTuning(modified);
 assert.equal(editor.getRaceTorqueNmAtRpm(2500,tuning),300*1.35582);
 assert.equal(editor.getRaceTorqueNmAtRpm(4000,tuning),200*1.35582);
});

test('race travel uses garage copies and reapplies from stock on a chained race',async()=>{
 globalThis.window ||= {location:{search:''}};
 const {default:Game}=await import('../../src/game/GameCore.js');
 const game=Object.create(Game.prototype),car=stock(),starts=[];
 Object.assign(game,{player:{credits:1000},abilities:{},state:'title',ensureActiveWeaponAvailable(){},showSystemToast:message=>{throw Error(message);},setRevAudio(){},prepareRacePlaytestAudio:async()=>true,captureRaceTravelPlayerState:()=>({}),transitionTo(state){this.state=state;},resolveRaceTravelCarAsync:async()=>({id:car.id,name:'Test car',car})});
 const turbo=part('turbo',{modifiers:[{field:'torqueScale',operation:'multiply',value:1.2}]});
 game.items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true}),library:{load:async()=>turbo}});
 await game.items.garage.purchase('turbo');await game.items.garage.equip('Test car','turbo');
 game.raceEditor={collectRaceCarArtRefs:()=>[],loadRaceTravelDocument:async()=>({id:'test',name:'Test Race'}),applyLoadedRaceDocument:()=>true,startPlaytest(id,options){starts.push(options.runtimeCarOverrides);this.playtestSession={running:true};}};
 assert.equal(await game.startRaceTravel({raceName:'First',carSelection:'specific',carRef:'Test car'}),true);
 assert.equal(await game.startRaceTravel({raceName:'Second',continuation:game.raceTravelSession}),true);
 assert.equal(starts[0].tuning.engineCurve.torquePoints[1].torqueLbFt,240);
 assert.equal(starts[1].tuning.engineCurve.torquePoints[1].torqueLbFt,240);
 assert.equal(car.tuning.engineCurve.torquePoints[1].torqueLbFt,200);assert.notEqual(starts[0],car);
});
test('generic damping, differential and brake settings reach authored overriding fields',()=>{
 const car=stock();Object.assign(car.tuning,{dampingFront:0.5,bumpFront:0.4,reboundFront:0.6,differentialAccel:0.3,frontDifferentialAccel:0.4,rearDifferentialAccel:0.5,frontBrakeBias:0.6});
 const modified=buildGarageCar(car,{parts:[part('setup',{modifiers:[{field:'dampingFront',operation:'set',value:0.7},{field:'differentialAccel',operation:'set',value:0.8},{field:'brakeBalance',operation:'set',value:0.55}]})]});
 const tuning=new RaceEditor({}).getRaceCarTuning(modified);
 assert.equal(tuning.bumpFront,0.7);assert.equal(tuning.reboundFront,0.7);assert.equal(tuning.frontDifferentialAccel,0.8);assert.equal(tuning.rearDifferentialAccel,0.8);assert.equal(tuning.frontBrakeBias,0.55);
});
