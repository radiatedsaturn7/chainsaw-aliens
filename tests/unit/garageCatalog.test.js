import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {CAR_PART_FIELDS,FIXED_PART_FIELDS,garageTuningRanges,buildGarageCar,isGarageUpgrade} from '../../src/garage/CarPart.js';
import {bestCheatParts} from '../../src/garage/GarageCheats.js';
import {tuningRows,TUNING_SECTIONS} from '../../src/garage/GarageTuning.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {createTireDefinition} from '../../src/racing/raceTires.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const parts=catalog.items.map(normalizeItemDocument).filter(isGarageUpgrade);
const families=[...new Set(parts.filter(i=>!i.carPart.engineSwap&&!i.carPart.drivetrainSwap).map(i=>i.carPart.slot))];
const raceParts=parts.filter(i=>i.carPart.tier==='race');
const tires=Object.fromEntries(parts.filter(i=>i.carPart.tireRef).map(i=>[i.carPart.tireRef,savedTireForRef(i.carPart.tireRef)]));
function fixture(){
 const game={player:{credits:100000},abilities:{}};
 const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>parts.find(i=>i.id===id)}});
 return {items,garage:items.garage};
}

test('every catalog family offers all three tiers and every tuning field has an attainable unlock',()=>{
 assert.equal(families.length,26);
 assert.equal(new Set(catalog.items.map(i=>i.id)).size,catalog.items.length);
 assert.equal(new Set(catalog.items.map(i=>i.name)).size,catalog.items.length);
 for(const slot of families.filter(s=>!['wheel-diameter','tire-profile','wheel-offset'].includes(s)))for(const tier of ['street','sport','race'])
  assert.ok(parts.some(i=>i.carPart.slot===slot&&i.carPart.tier===tier),`${slot}: ${tier}`);
 const ranges=garageTuningRanges(raceParts);
 for(const field of CAR_PART_FIELDS)assert.equal(!!ranges[field.id],!FIXED_PART_FIELDS.has(field.id),field.id);
 assert.deepEqual(bestCheatParts(parts,'test',{}).map(i=>i.id).sort(),raceParts.map(i=>i.id).sort());
});

test('complete race build unlocks tuning on production cars and passes settings through to race physics',()=>{
 const editor=new RaceEditor({});
 for(const stock of createBuiltInRaceCars()){
  const before=structuredClone(stock),built=buildGarageCar(stock,{parts:raceParts,tires});
  const garage={installed:()=>raceParts,configuration:()=>({tune:{}}),owned:()=>raceParts,availableCount:()=>1};
  const rows=tuningRows(garage,'car',stock,built);
  for(const row of rows){
   const drive=built.tuning.drivetrain;
   const unused=(drive==='rwd'&&row.id.startsWith('frontDifferential'))||(drive==='fwd'&&row.id.startsWith('rearDifferential'))||(drive!=='awd'&&row.id.startsWith('centerDifferential'));
   assert.equal(row.enabled,!unused,`${stock.id}: ${row.id}`);
  }
  for(const section of TUNING_SECTIONS.filter(s=>!['repair','setup'].includes(s.id)))assert.ok(rows.some(r=>r.enabled&&section.matches(r.id)),section.id);
  const changed=buildGarageCar(stock,{parts:raceParts,tires,tune:{camberFront:-2,toeRear:.2,aeroFront:.7,differentialAccel:.65,brakeBalance:.6,brakePressure:1.2,fuelConsumptionScale:.9}});
  const tuning=editor.getRaceCarTuning(changed);
  assert.equal(tuning.camberFront,-2);assert.equal(tuning.toeRear,.2);assert.equal(tuning.aeroFront,.7);
  assert.equal(tuning.frontDifferentialAccel,.65);assert.equal(tuning.rearDifferentialAccel,.65);
  assert.equal(tuning.frontBrakeBias,.6);assert.equal(tuning.brakePressure,1.2);
  assert.equal(changed.mechanics.fuelConsumptionScale,built.mechanics.fuelConsumptionScale);
  assert.ok(tuning.weightKg<editor.getRaceCarTuning(stock).weightKg);
  assert.ok(editor.getRaceTorqueNmAtRpm(5000,tuning)>editor.getRaceTorqueNmAtRpm(5000,editor.getRaceCarTuning(stock)));
  assert.deepEqual(stock,before);
 }
});

test('purchase, tier replacement, downgrade and free stock restoration work for every family',async()=>{
 const {garage}=fixture();await garage.load();const stock=createBuiltInRaceCars()[0];
 const resources={garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 for(const slot of families.filter(s=>!['wheel-diameter','tire-profile','wheel-offset'].includes(s))){
  const choices=parts.filter(i=>i.carPart.slot===slot);
  for(const tier of ['street','sport','race']){
   const item=choices.find(i=>i.carPart.tier===tier);
   if(!item.carPart.forSale)continue;
   await garage.purchase(item.id,{carRef:'car'});
   assert.equal(garage.installed('car').filter(i=>i.carPart.slot===slot).length,1);
   const rows=garageBrowserRows(resources,{carRef:'car'},{section:item.carPart.section,slot});
   assert.equal(rows[0].value,'');assert.match(rows[0].label,/Stock/);
   const leaves=rs=>rs.flatMap(r=>r.children?leaves(r.children):[r]);
   assert.ok(leaves(rows).some(r=>r.value===item.id&&r.installed===true));
  }
  const race=choices.find(i=>i.carPart.tier==='race');
  if(Object.keys(garageTuningRanges([race])).length){const r=race.carPart.tuning.find(r=>!FIXED_PART_FIELDS.has(r.field));if(r)await garage.setTune('car',{[r.field]:r.min});}
  await garage.equip('car',choices.find(i=>i.carPart.tier==='street').id);
  await garage.remove('car',slot);
  assert.equal(garage.installed('car').length,0);
  assert.deepEqual(garage.configuration('car').tune,{});
 }
 const restored=await garage.build('car',stock),runtime=new RaceEditor({});
 assert.equal(runtime.getRaceCarTuning(restored).weightKg,runtime.getRaceCarTuning(stock).weightKg);
 assert.equal(runtime.getRaceCarTuning(restored).brakePressure,runtime.getRaceCarTuning(stock).brakePressure);
});

test('dry tire tiers have distinct grip and weather specialists retain their purpose',()=>{
 const [stock,street,sport,race]=['stock','street','sport','tarmac'].map(id=>createTireDefinition(id).compound);
 assert.ok(stock.surfaceGrip.asphalt<street.surfaceGrip.asphalt&&street.surfaceGrip.asphalt<sport.surfaceGrip.asphalt&&sport.surfaceGrip.asphalt<race.surfaceGrip.asphalt);
 assert.ok(street.surfaceGrip['wet-asphalt']>race.surfaceGrip['wet-asphalt']);
 assert.ok(street.wearRate<race.wearRate);
 for(const [compound,surface] of [['rain','wet-asphalt'],['snow','snow'],['dirt','gravel']])assert.ok(createTireDefinition(compound).compound.surfaceGrip[surface]>race.surfaceGrip[surface]);
});
