import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {createTireDefinition} from '../../src/racing/raceTires.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
const editor=new RaceEditor({}),stock=createBuiltInRaceCars()[0];
const parts=(...ids)=>ids.map(id=>catalog.items.find(i=>i.id===id));
const config=car=>createVehicleDynamicsConfigFromTuning(editor.getRaceCarTuning(car));
test('rim, sidewall, width and outset reach authoritative wheel dynamics and preserve compound independence',()=>{
 const original=structuredClone(stock);
 const built=buildGarageCar(stock,{parts:parts('wheel-diameter-19','tire-profile-50','street-wheels','wheel-offset-20','race-tires'),tires:{Tarmac:savedTireForRef('Tarmac')}});
 assert.equal(built.setup.tireSize.wheelDiameterIn,19);assert.equal(built.setup.tireSize.aspectRatio,50);
 assert.equal(built.setup.tireSize.widthMm,(stock.setup?.tireSize?.widthMm||245)+10);
 const base=config(stock),changed=config(built);
 assert.ok(Math.abs(changed.wheelRadiusM-(19*.0254/2+built.setup.tireSize.widthMm*.5/1000))<1e-9);
 assert.ok(changed.wheelInertiaKgM2>base.wheelInertiaKgM2);
 assert.ok(changed.tireVerticalStiffnessNpm<base.tireVerticalStiffnessNpm);
 assert.ok(Math.abs(changed.frontTrackWidthM-base.frontTrackWidthM-.04)<1e-8);
 assert.ok(changed.massKg>base.massKg);assert.deepEqual(stock,original);
 assert.deepEqual(buildGarageCar(stock),stock);
});
test('aero hardware has distinct mass, drag and axle loads, and wing adjustment changes drag',()=>{
 const base=config(stock),race=buildGarageCar(stock,{parts:parts('race-aero')}),drag=buildGarageCar(stock,{parts:parts('drag-aero')});
 const r=config(race),d=config(drag);
 assert.equal(r.massKg-base.massKg,14);assert.equal(d.massKg-base.massKg,5);
 assert.ok(r.dragCoefficient>d.dragCoefficient);assert.ok(r.frontDownforceCoefficient>d.frontDownforceCoefficient);assert.ok(r.rearDownforceCoefficient>d.rearDownforceCoefficient);
 const low=config(buildGarageCar(stock,{parts:parts('race-aero'),tune:{aeroFront:.1,aeroRear:.1}}));
 assert.ok(low.dragCoefficient<r.dragCoefficient);assert.ok(low.frontDownforceCoefficient<r.frontDownforceCoefficient);
});
test('Wheels groups four dimensions and each dimension stays within eight buttons',()=>{
 const resources={stockCar:()=>stock,garageCatalog:()=>catalog.items.map(normalizeItemDocument).map(item=>({ref:item.id,item}))};
 const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Tires'}),wheels=rows.find(r=>r.label==='Wheels');
 assert.deepEqual(wheels.children.map(r=>r.label).sort(),['Diameter','Outset','Sidewall','Width']);
 for(const child of wheels.children){const choices=garageBrowserRows(resources,{carRef:'car'},{section:'Tires',slot:child.value});assert.ok(choices.length<=8);assert.match(choices[0].label,/^Stock \(.*\)$/);}
});

test('stock wheel dimensions identify factory sizes and hide equivalent purchasable sizes',()=>{
 for(const rim of [17,18,19]){
  const car=structuredClone(stock);car.setup.tireSize={widthMm:225,aspectRatio:45,wheelDiameterIn:rim};
  const resources={stockCar:()=>car,garageCatalog:()=>catalog.items.map(normalizeItemDocument).map(item=>({ref:item.id,item}))};
  const rows=slot=>garageBrowserRows(resources,{carRef:'car'},{section:'Tires',slot});
  assert.equal(rows('wheel-diameter')[0].label,`Stock (${rim} in)`);
  assert.ok(!rows('wheel-diameter').some(r=>r.value===`wheel-diameter-${rim}`));
  assert.equal(rows('tire-profile')[0].label,'Stock (45 %)');
  assert.ok(!rows('tire-profile').some(r=>r.value==='tire-profile-45'));
  assert.equal(rows('wheels')[0].label,'Stock (225 mm)');
  assert.equal(rows('wheel-offset')[0].label,'Stock (0 mm)');
  resources.garage={items:{progress:{bags:{items:{}},unlocks:{}},savedStats:{credits:10000}},availableCount:()=>0,configuration:()=>({installed:{'wheel-diameter':`wheel-diameter-${rim}`}})};
  assert.equal(rows('wheel-diameter')[0].installed,true);
 }
});
