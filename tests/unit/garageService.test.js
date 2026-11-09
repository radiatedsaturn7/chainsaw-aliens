import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {tuningMenu} from '../../src/garage/GarageMenuTree.js';
async function fixture(){
 let fail=false;
 const game={player:{credits:1000},abilities:{}},items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:!fail,reason:'offline'})});await items.load();
 const mechanical=createMechanicalState({fuel:0,oil:.5,coolant:.4,charge:.2,components:{radiator:{failed:true},battery:{damage:50}}});
 mechanical.coolantTemperatureC=110;mechanical.oilTemperatureC=120;mechanical.tires.fl.brakeTemperatureC=200;
 await items.garage.saveCondition('car',{mechanical});
 return {game,garage:items.garage,items,fail:()=>{fail=true;}};
}
test('service menu has independent costs and no more than eight buttons',async()=>{
 const {garage}=await fixture(),rows=garage.repairRows('car',{}),group=tuningMenu(rows,'repair').find(r=>r.label==='Service');
 assert.deepEqual(group.children.map(r=>r.label),['All','Fuel','Oil','Coolant','Battery','Cool Down']);
 const jobs=rows.filter(r=>r.id.startsWith('service_'));
 assert.deepEqual(jobs.map(r=>r.cost),[15,5,6,4,0]);
 assert.equal(rows.find(r=>r.id==='service').cost,30);
 assert.equal(rows.find(r=>r.id==='all').cost,rows.filter(r=>!['service','all'].includes(r.id)).reduce((sum,r)=>sum+r.cost,0));
});
test('individual service only changes the selected system, preserving wear and other fluids',async()=>{
 const {garage,game}=await fixture();
 const before=structuredClone(garage.configuration('car').condition.mechanical);
 await garage.repair('car','service_oil',{});
 const after=garage.configuration('car').condition.mechanical;
 assert.equal(after.oil,1);assert.equal(after.oilTemperatureC,90);assert.equal(game.player.credits,995);
 for(const key of ['fuel','coolant','charge','coolantTemperatureC','components','tires'])assert.deepEqual(after[key],before[key]);
 await garage.repair('car','service_battery',{});assert.equal(garage.configuration('car').condition.mechanical.charge,1);
 assert.equal(garage.configuration('car').condition.mechanical.components.battery.damage,50);
 await garage.repair('car','service_oil',{});assert.equal(game.player.credits,991);
});
test('All service charges once, preserves failures, and is atomic on insufficient funds or failed save',async()=>{
 const f=await fixture(),before=structuredClone(f.items.progress);
 f.game.player.credits=1;await assert.rejects(f.garage.repair('car','service',{}),/scrap/);assert.deepEqual(f.items.progress,before);
 f.game.player.credits=1000;await f.garage.repair('car','service',{});assert.equal(f.game.player.credits,970);
 const state=f.garage.configuration('car').condition.mechanical;
 for(const key of ['fuel','oil','coolant','charge'])assert.equal(state[key],1);
 assert.equal(state.coolantTemperatureC,85);assert.equal(state.oilTemperatureC,90);assert.equal(state.tires.fl.brakeTemperatureC,25);
 assert.equal(state.components.radiator.failed,true);assert.equal(state.components.battery.damage,50);
 assert.equal(f.garage.repairRows('car',{}).find(r=>r.id==='service').cost,0);
 await f.garage.repair('car','service',{});assert.equal(f.game.player.credits,970);
 const failed=await fixture(),snapshot=structuredClone(failed.items.progress);failed.fail();
 await assert.rejects(failed.garage.repair('car','service',{}),/offline/);assert.deepEqual(failed.items.progress,snapshot);assert.equal(failed.game.player.credits,1000);
});

test('repair root starts with Repair All, combines engine/drivetrain and repairs everything once',async()=>{
 const {garage,game}=await fixture(),rows=garage.repairRows('car',{}),tree=tuningMenu(rows,'repair');
 assert.equal(tree[0].label,'Repair All');assert.equal(tree.at(-1).label,'Service');assert.equal(tree.length,8);
 assert.ok(!tree.some(row=>row.label==='Drivetrain'));
 const leaves=rs=>rs.flatMap(row=>row.children?leaves(row.children):[row]);
 const engine=leaves(tree.find(row=>row.label==='Engine').children);
 for(const id of ['clutch','gearbox','differential','axles','radiator'])assert.ok(engine.some(row=>row.id===id));
 assert.equal(leaves(tree).filter(row=>row.id==='all').length,1);
 const all=tree.find(row=>row.id==='all');assert.ok(all&&!all.children);
 const credits=game.player.credits;await garage.repair('car',all.id,{});
 assert.equal(game.player.credits,credits-all.cost);
 const state=garage.configuration('car').condition.mechanical;
 for(const key of ['fuel','oil','coolant','charge'])assert.equal(state[key],1);
 assert.equal(state.components.radiator.failed,false);assert.equal(state.components.battery.damage,0);
 assert.equal(state.tires.fl.brakeTemperatureC,25);
 assert.equal(garage.repairRows('car',{}).find(row=>row.id==='all').cost,0);
});
