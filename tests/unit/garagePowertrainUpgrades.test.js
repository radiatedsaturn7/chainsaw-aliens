import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const model=new PowertrainModel(),editor=new RaceEditor({});
const part=id=>normalizeItemDocument(catalog.items.find(item=>item.id===id));
const sample=(tuning,throttle,rpm,extra={})=>model.stepAuthoritativeWheelTorques({tuning,controls:{requestedGear:0,throttle},previous:{gear:0,targetGear:0,engineRpm:rpm},dt:1/120,...extra});
test('flywheels change actual rev rise and fall without changing the torque curve or stock document',()=>{
 for(const stock of createBuiltInRaceCars()){
  const original=structuredClone(stock),base=editor.getRaceCarTuning(stock);
  let rising=sample(base,1,1500).state.engineRpm,falling=sample(base,0,5000).state.engineRpm;
  for(const tier of ['street','sport','race']){
   const tuning=editor.getRaceCarTuning(buildGarageCar(stock,{parts:[part(tier+'-flywheel')]}));
   const up=sample(tuning,1,1500),down=sample(tuning,0,5000);
   assert.ok(up.state.engineRpm>rising);assert.ok(down.state.engineRpm<falling);
   assert.equal(model.getTorqueNmAtRpm(4000,tuning),model.getTorqueNmAtRpm(4000,base));
   assert.ok(up.state.engineRpm<=tuning.revLimitRpm);
   rising=up.state.engineRpm;falling=down.state.engineRpm;
   const stopped=sample(tuning,1,1500,{state:{mechanical:{config:{enabled:true},engineRunning:false,effects:{}}}});
   assert.equal(stopped.state.engineRpm,0);
  }
  assert.deepEqual(stock,original);
 }
});
test('clutch upgrades shorten actual shift interruption and preserve transmission damage delay',()=>{
 const stock=createBuiltInRaceCars()[0];
 const shift=(tuning,damage={})=>model.stepAuthoritativeWheelTorques({tuning,controls:{requestedGear:2,throttle:.5},previous:{gear:1,targetGear:1,engineRpm:3000},dt:1/120,damage}).state.shiftTimeRemainingSeconds;
 const base=editor.getRaceCarTuning(stock);let previous=shift(base);
 for(const tier of ['street','sport','race']){
  const tuning=editor.getRaceCarTuning(buildGarageCar(stock,{parts:[part(tier+'-clutch')]}));
  const duration=shift(tuning);assert.ok(duration<previous);previous=duration;
  assert.ok(shift(tuning,{transmission:50})>duration);
 }
});
