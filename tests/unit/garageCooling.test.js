import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {createMechanicalState,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
const stock=createBuiltInRaceCars()[0];
function run(tier,failed=false){
 const parts=tier?[normalizeItemDocument(catalog.items.find(i=>i.id===tier+'-cooling'))]:[];
 const car=buildGarageCar(stock,{parts});
 const state=createMechanicalState({coolantTemperatureC:105,oilTemperatureC:115}, {},car.mechanics);
 if(failed)state.components.waterPump.failed=true;
 for(let i=0;i<6000;i++)stepMechanicalState(state,.1,{rpm:6000,maxRpm:6500,throttle:1,speedMps:18,ambientTemperatureC:35});
 return state;
}
test('each cooling tier lowers real coolant and oil temperatures without disabling heat failures',()=>{
 let previous=run();
 for(const tier of ['street','sport','race']){
  const state=run(tier);
  assert.ok(state.coolantTemperatureC<previous.coolantTemperatureC);
  assert.ok(state.oilTemperatureC<previous.oilTemperatureC);
  previous=state;
 }
 const failed=run('race',true);
 assert.ok(failed.coolantTemperatureC>115);
 assert.ok(failed.components.pistons.damage>previous.components.pistons.damage);
});

test('mechanical editor exposes and persists cooling values used by the thermal model',async()=>{
 const {editCarMechanics}=await import('../../src/ui/MechanicalForms.js');
 const editor={selectedCar:structuredClone(stock),captureRaceHistory:()=>{}};
 await editCarMechanics(editor,async(title,fields)=>{
  assert.equal(fields.find(f=>f.id==='coolingEfficiency').max,3);
  assert.equal(fields.find(f=>f.id==='oilCoolingEfficiency').min,.5);
  return {coolingEfficiency:1.8,oilCoolingEfficiency:1.6};
 });
 const state=createMechanicalState({}, {},editor.selectedCar.mechanics);
 assert.equal(state.config.coolingEfficiency,1.8);assert.equal(state.config.oilCoolingEfficiency,1.6);
});
