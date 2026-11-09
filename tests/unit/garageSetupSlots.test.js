import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import raw from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {garageCarPerformance} from '../../src/garage/GarageAutoUpgrade.js';
import {saveGarageSetupSlot,loadGarageSetupSlot} from '../../src/garage/GarageSetupSlots.js';
import {GarageTuner} from '../../src/garage/GarageTuning.js';
import {drawGarageTuner} from '../../src/menus/MenuTuningRenderer.js';
const editor=new RaceEditor({}),stock=createBuiltInRaceCars()[0];
const evaluate=car=>garageCarPerformance(car,editor.getRaceCarTuning(car));
async function fixture(progress={},save=async()=>({ok:true})){
 const parts=raw.items.map(normalizeItemDocument);
 const items=new ItemSystem({player:{credits:100000},abilities:{}},{load:async key=>key==='rtg-item-progress'?progress:{},save,library:{load:async id=>parts.find(p=>p.id===id)}});
 await items.load();const garage=items.garage;
 const tuner=new GarageTuner({garage,carRef:'car',resolveCar:async()=>stock,evaluate});await tuner.readyTask;
 return {items,garage,tuner};
}
async function open(t,id){t.mode='grid';t.path=[];t.index=1;await t.confirm();t.rowIndex=t.sectionRows().findIndex(r=>r.id===id);await t.confirm();}
test('Setup presents button presets and eight Save/Load slots with Empty or PI and tires',async()=>{
 const {garage,tuner:t}=await fixture();
 await open(t,'drivingSetup');assert.deepEqual(t.sectionRows().map(r=>r.label),['Stock','Street','Road','Rally','Drift','Off-road','Drag','Snow']);
 t.rowIndex=3;await t.confirm();assert.equal(t.mode,'list');assert.equal(garage.configuration('car').setupId,'rally');
 await garage.purchase('rally-tires',{carRef:'car'});await t.refresh();
 await open(t,'drivingSetup');t.rowIndex=0;await t.confirm();assert.deepEqual(garage.configuration('car').tune,{});assert.equal(garage.configuration('car').installed.tires,'rally-tires');
 await open(t,'saveSetup');assert.equal(t.sectionRows().length,8);assert.ok(t.sectionRows().every(r=>r.displayValue==='Empty'&&r.enabled));
 t.rowIndex=7;await t.confirm();assert.match(t.message,/Saved slot 8/);assert.match(t.row.displayValue,/\d+ PI · Rally/);
 await open(t,'loadSetup');assert.equal(t.sectionRows().length,8);assert.equal(t.sectionRows()[0].enabled,false);assert.equal(t.sectionRows()[7].enabled,true);
 const labels=[],ctx=new Proxy({fillText(s){labels.push(s);}},{get:(o,k)=>k in o?o[k]:(()=>{})});drawGarageTuner(ctx,{x:0,y:0,w:900,h:460},t);
 assert.ok(labels.includes('Empty'));assert.ok(labels.some(s=>/PI · Rally/.test(s)));assert.equal(t.hitAreas.filter(a=>a.kind==='row').length,8);assert.ok(!t.hitAreas.some(a=>a.kind==='slider'));
});
test('slots persist upgrades and tuning per car, overwrite independently, and leave damage and ownership unchanged on load',async()=>{
 const f=await fixture();await f.garage.purchase('race-ecu',{carRef:'car'});await f.garage.purchase('rally-tires',{carRef:'car'});
 await f.garage.setTune('car',{'pressure.fl':29});
 const built=await f.garage.build('car',stock),pi=evaluate(built).points;
 for(let i=0;i<8;i++)await saveGarageSetupSlot(f.garage,'car',stock,i,evaluate);
 const saved=structuredClone(f.items.progress),loaded=await fixture(saved);
 assert.equal(loaded.garage.configuration('car').savedSetups.length,8);assert.equal(loaded.garage.configuration('car').savedSetups[0].pi,pi);
 await loaded.garage.resetStock('car');await saveGarageSetupSlot(loaded.garage,'car',stock,1,evaluate);
 await loaded.garage.saveCondition('car',{damage:{engine:21}});
 const before=structuredClone(loaded.items.progress),credits=loaded.items.game.player.credits;
 await loadGarageSetupSlot(loaded.garage,'car',stock,0);
 const setup=loaded.garage.configuration('car');assert.deepEqual(setup.installed,saved.garage.cars.car.installed);assert.deepEqual(setup.tune,saved.garage.cars.car.tune);
 assert.deepEqual(setup.condition,before.garage.cars.car.condition);assert.deepEqual(loaded.items.progress.bags,before.bags);assert.equal(loaded.items.game.player.credits,credits);
 assert.deepEqual(setup.savedSetups[1].installed,{});assert.equal(loaded.garage.configuration('other').savedSetups,undefined);
});
test('empty slots, unavailable owned copies and failed saves leave the current configuration intact',async()=>{
 let fail=false;const f=await fixture({},async()=>({ok:!fail,reason:'offline'}));
 await assert.rejects(loadGarageSetupSlot(f.garage,'car',stock,0),/empty/);
 await f.garage.purchase('rally-tires',{carRef:'car'});await saveGarageSetupSlot(f.garage,'car',stock,0,evaluate);
 await f.garage.resetStock('car');await f.garage.equip('other','rally-tires');
 const before=structuredClone(f.items.progress);
 await assert.rejects(loadGarageSetupSlot(f.garage,'car',stock,0),/copies/);assert.deepEqual(f.items.progress,before);
 await f.garage.remove('other','tires');const released=structuredClone(f.items.progress);fail=true;
 await assert.rejects(loadGarageSetupSlot(f.garage,'car',stock,0),/offline/);assert.deepEqual(f.items.progress,released);
 await assert.rejects(saveGarageSetupSlot(f.garage,'car',stock,0,evaluate),/offline/);assert.deepEqual(f.items.progress,released);
 assert.throws(()=>saveGarageSetupSlot(f.garage,'car',stock,8,evaluate),/eight/);
});
