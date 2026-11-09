import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {buildGarageCar,normalizeCarPart} from '../../src/garage/CarPart.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
import {runGarageAction} from '../../src/garage/GarageMenu.js';
import {tuningRows} from '../../src/garage/GarageTuning.js';
import {upgradeLabel,upgradeHeading} from '../../src/garage/GarageLabels.js';
import {applyRaceVehicleImpactEvents} from '../../src/racing/RaceSimulation.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const parts=catalog.items.map(normalizeItemDocument);
const part=id=>parts.find(p=>p.id===id);
function fixture(stock=createBuiltInRaceCars()[0]){
 const items=new ItemSystem({player:{credits:20000},abilities:{}},{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>part(id)}});
 const garage=items.garage;
 return {items,garage,stock,resources:{garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))}};
}
test('context labels remove repeated nouns without altering authored part names',async()=>{
 const {garage,stock,resources}=fixture();await garage.load();
 const rows=tuningRows(garage,'car',stock,stock);
 assert.equal(rows.find(r=>r.id==='brakePressure').label,'Pressure');
 assert.equal(rows.find(r=>r.id==='brakeBalance').label,'Balance');
 assert.equal(rows.find(r=>r.id==='frontDifferentialAccel').label,'Front accel');
 assert.equal(rows.find(r=>r.id==='suspensionTravelFront').label,'Front travel');
 const brakes=garageBrowserRows(resources,{carRef:'car'},{section:'Handling',slot:'brakes'});
 assert.match(brakes.find(r=>r.value==='race-brakes').label,/^Race$/);
 assert.equal(part('race-brakes').name,'Race Brakes');
 assert.equal(upgradeLabel('Race Skid Plates','skid-plates'),'Race');
 assert.equal(upgradeLabel('Turbo','turbo'),'Turbo');
 assert.equal(upgradeHeading({section:'Brakes',slot:'brakes'}),'Brakes');
 assert.equal(upgradeHeading({section:'Drivetrain',slot:'drive-swap'}),'Drivetrain / Conversions');
});
test('factory drivetrain is owned, unique, free to restore, and purchased current conversions remain owned',async()=>{
 for(const drive of ['fwd','rwd','awd']){
  const stock=createBuiltInRaceCars()[0];stock.tuning.drivetrain=drive;
  const {garage,items,resources}=fixture(stock);await garage.load();
  const rows=()=>garageBrowserRows(resources,{carRef:'car'},{section:'Drivetrain',slot:'drive-swap'});
  assert.equal(rows().length,3);assert.equal(rows()[0].label,`Stock ${drive.toUpperCase()}`);assert.equal(rows()[0].installed,true);
  const factory=buildGarageCar(stock,{parts:[part('drive-swap-'+drive)]});
  assert.deepEqual(factory,stock,'factory drivetrain must preserve authored efficiency and mass');
  const other=drive==='awd'?'rwd':'awd';
  await runGarageAction(garage,'garage-fit','drive-swap-'+other,{carRef:'car'},{resolveCar:async()=>stock});
  const current=rows().find(r=>r.value==='drive-swap-'+other);assert.equal(current.installed,true);assert.match(current.description,/Owned/);
  const credits=items.game.player.credits;
  await runGarageAction(garage,'garage-fit','drive-swap-'+drive,{carRef:'car'},{resolveCar:async()=>stock});
  assert.equal(items.game.player.credits,credits);assert.equal(garage.configuration('car').installed['drive-swap'],undefined);
  assert.equal((await garage.build('car',stock)).tuning.drivetrain,drive);
 }
});
function impactDamage(car,feature='central-underfloor-face-2',normal={x:0,y:1,z:0}){
 const editor=new RaceEditor({});Object.defineProperty(editor,'selectedCar',{value:createBuiltInRaceCars()[0]});
 editor.getRaceSessionCar=()=>car;
 let amount;
 editor.applyRaceDamage=(part,value)=>{amount=value;};
 const session={vehicleRenderState:{resetGeneration:0},vehicleDynamicsRunner:{config:{massKg:1500}}};
 const event={sequence:1,terrainImpact:true,normalImpulseNs:15000,preImpactNormalSpeedMps:10,impactNormalWorld:normal,impactFeatureId:feature};
 assert.equal(applyRaceVehicleImpactEvents(editor,session,[event]),1);
 assert.equal(applyRaceVehicleImpactEvents(editor,session,[event]),0);
 return amount;
}
test('each skid tier adds actual mass and reduces authoritative underside damage only',()=>{
 const editor=new RaceEditor({});
 for(const stock of createBuiltInRaceCars())for(const [tier,kg,reduction] of [['street',8,.3],['sport',14,.55],['race',20,.75]]){
  const built=buildGarageCar(stock,{parts:[part(tier+'-skid-plates')]});
  for(const transmissionType of Object.keys(stock.transmissions||{})){
   const tuning=editor.getRaceCarTuning(built,{transmissionType});
   assert.equal(tuning.weightKg,editor.getRaceCarTuning(stock,{transmissionType}).weightKg+kg);
   assert.equal(tuning.underbodyProtection,reduction);
  }
  for(const feature of ['central-underfloor-face-2','front-subframe-edge-1','lower-chassis-face-0','underbody-corner-1'])assert.ok(Math.abs(impactDamage(built,feature)/impactDamage(stock,feature)-(1-reduction))<1e-10);
  for(const feature of ['cabin-face-1','front-body-hood-face-0','wheel-fl'])assert.equal(impactDamage(built,feature),impactDamage(stock,feature));
  assert.equal(impactDamage(built,'lower-chassis-face-0',{x:1,y:0,z:0}),impactDamage(stock,'lower-chassis-face-0',{x:1,y:0,z:0}));
  assert.deepEqual(buildGarageCar(stock),stock);
 }
 assert.throws(()=>normalizeCarPart({slot:'brakes',underbodyProtection:.7}));
});
test('skid plate removal restores mass/protection and retains saved condition',async()=>{
 const {garage,stock}=fixture();await garage.load();
 await garage.purchase('race-skid-plates',{carRef:'car'});
 await garage.saveCondition('car',{damage:{panels:{front:34},engine:12}});
 const before=structuredClone(garage.configuration('car').condition);
 const built=await garage.build('car',stock);assert.equal(built.tuning.underbodyProtection,.75);
 await garage.remove('car','skid-plates');
 const restored=await garage.build('car',stock);
 assert.equal(restored.tuning.underbodyProtection,undefined);
 assert.equal(restored.tuning.weightKg,stock.tuning.weightKg);
 assert.deepEqual(restored.condition,before);
});
