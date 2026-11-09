import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {buildGarageCar,FIXED_PART_FIELDS,garageTuningRanges,isGarageUpgrade} from '../../src/garage/CarPart.js';
import {GarageTuner,TUNING_SECTIONS,tuningRows} from '../../src/garage/GarageTuning.js';
import {cappedMenu,menuAtPath} from '../../src/garage/GarageMenuTree.js';
import {upgradeLabel} from '../../src/garage/GarageLabels.js';
import {garageBrowserRows,garageGridBounds} from '../../src/menus/MenuGarageWidgets.js';
import {drawUpgradeGrid} from '../../src/menus/MenuUpgradeRenderer.js';
import {drawGarageTuner} from '../../src/menus/MenuTuningRenderer.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
const parts=catalog.items.map(normalizeItemDocument).filter(isGarageUpgrade),stock=createBuiltInRaceCars()[0];
async function fixture(){const items=new ItemSystem({player:{credits:1000000},abilities:{}},{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>parts.find(p=>p.id===id)}});await items.load();return items.garage;}
function audit(rows){assert.ok(rows.length<=8,rows.map(r=>r.label).join(','));assert.equal(new Set(rows.map(r=>r.id||r.value)).size,rows.length);return rows.flatMap(r=>r.children?audit(r.children):[r]);}
test('fixed installed properties cannot be tuned through UI, API or legacy saved values',async()=>{
 const garage=await fixture();
 for(const id of ['race-clutch','race-flywheel','race-driveline','race-rigidity','race-cooling','race-wheels'])await garage.purchase(id,{carRef:'car'});
 const installed=garage.installed('car'),car=await garage.build('car',stock),rows=tuningRows(garage,'car',stock,car),ranges=garageTuningRanges(installed);
 for(const id of FIXED_PART_FIELDS){assert.ok(!rows.some(r=>r.id===id),id);assert.equal(ranges[id],undefined);await assert.rejects(garage.setTune('car',{[id]:1}),/Install/);}
 assert.ok(car.tuning.shiftTimeMs<420);assert.ok(car.tuning.engineInertiaKgM2<.3);
 const stale=Object.fromEntries([...FIXED_PART_FIELDS].map(id=>[id,1]));
 assert.deepEqual(buildGarageCar(stock,{parts:installed,tune:stale}),buildGarageCar(stock,{parts:installed}));
});
test('all built-in upgrade menus and custom libraries recursively cap at eight reachable choices',async()=>{
 const garage=await fixture(),resources={garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 const sections=garageBrowserRows(resources,{carRef:'car'},{});audit(sections);assert.equal(sections.length,8);
 for(const section of sections.filter(s=>s.value!=='Presets'))for(const slot of audit(garageBrowserRows(resources,{carRef:'car'},{section:section.value}))){
  const state={section:section.value,slot:slot.value},rows=garageBrowserRows(resources,{carRef:'car'},state);const leaves=audit(rows);
  assert.ok(leaves.some(r=>r.value===''));assert.ok(leaves.every(r=>!r.label.includes('scrap')));
  for(const row of leaves)assert.ok(row.description);
 }
 for(const item of parts)assert.ok(upgradeLabel(item.name,item.carPart.slot).length<=14,item.name);
 assert.equal(upgradeLabel('Race Weight and Ballast','weight'),'Race');assert.equal(upgradeLabel('Welded Cage','rigidity'),'Cage 2');
 const many=Array.from({length:601},(_,i)=>({id:'custom:'+i,label:'Custom '+i})),tree=cappedMenu(many);
 assert.deepEqual(audit(tree).map(r=>r.id).sort(),many.map(r=>r.id).sort());
 function walk(rows,path=[]){for(const row of rows)if(row.children){const next=[...path,row.id];assert.deepEqual(menuAtPath(tree,next),row.children);walk(row.children,next);}}walk(tree);
});
test('suspension, ten-speed gearing and repairs use real nested navigation with back support',async()=>{
 const garage=await fixture();await garage.purchase('race-suspension',{carRef:'car'});await garage.purchase('race-transmission',{carRef:'car'});
 const car=structuredClone(stock);car.tuning.gearRatios=Array.from({length:10},(_,i)=>4-i*.3);
 const tuner=new GarageTuner({garage,carRef:'car',resolveCar:async()=>car});await tuner.readyTask;
 for(let i=0;i<TUNING_SECTIONS.length;i++)audit(tuner.sectionTree(i));
 tuner.index=4;await tuner.confirm();assert.deepEqual(tuner.sectionRows().map(r=>r.label),['Front','Rear','Brakes','Ballast']);
 await tuner.confirm();assert.equal(tuner.path.length,1);assert.ok(tuner.sectionRows().every(r=>/Front$/.test(r.id)));assert.ok(tuner.sectionRows().length<=8);
 await tuner.confirm();assert.equal(tuner.mode,'edit');tuner.cancel();assert.equal(tuner.mode,'list');tuner.cancel();assert.equal(tuner.path.length,0);tuner.cancel();assert.equal(tuner.mode,'grid');
 tuner.index=3;await tuner.confirm();assert.deepEqual(tuner.sectionRows().map(r=>r.label),['Final','Low','High']);tuner.cancel();
 tuner.index=0;await tuner.confirm();assert.ok(tuner.sectionRows().some(r=>r.label==='Engine'));assert.ok(audit(tuner.sectionTree()).length>40);
});
test('upgrade buttons match the Tune grid with header prices and no description footer',async()=>{
 const garage=await fixture();garage.items.game.player.credits=0;
 const resources={garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 const state={section:'Chassis',slot:'rigidity',index:3};
 for(const b of [{x:5,y:10,w:350,h:210},{x:0,y:0,w:900,h:460}]){
  const calls=[],rects=[],ctx=new Proxy({fillRect(x,y,w,h){rects.push({x,y,w,h});},measureText:s=>({width:s.length*6}),fillText(text,x,y){calls.push({text,x,y});}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  drawUpgradeGrid(ctx,b,{color:'#fff'},resources,{carRef:'car'},state);
  const expected=garageGridBounds(b,0);
  assert.ok(rects.length>0);assert.ok(rects.every(r=>r.w===expected.w&&r.h===expected.h));
  assert.ok(calls.some(c=>c.text==='Cage 2'));
  assert.ok(calls.some(c=>/scrap/.test(c.text)&&c.y===b.y+12));
  assert.ok(!calls.some(c=>/torsion|suspension|Not enough/i.test(c.text)));
  assert.ok(calls.every(c=>c.y<b.y+b.h-10));
 }
});

test('tires have exactly eight ordered choices despite saved aliases and owned duplicates',async()=>{
 const garage=await fixture();
 const saved=parts.filter(i=>i.carPart.slot==='tires').map(item=>({...structuredClone(item),id:'saved-'+item.id,name:'Saved '+item.name,carPart:{...item.carPart,tireRef:item.carPart.tireRef}}));
 const entries=[...parts,...saved].map(item=>({ref:item.id,item}));
 const resources={garage,stockCar:()=>stock,garageCatalog:()=>entries};
 const rows=()=>garageBrowserRows(resources,{carRef:'car'},{section:'Tires',slot:'tires'});
 assert.deepEqual(rows().map(r=>r.label),['Stock','Street','Drift','Rally','Offroad','Rain','Snow','Tarmac']);
 assert.ok(rows().every(r=>!r.children));
 await garage.purchase('race-tires',{carRef:'car'});
 assert.equal(rows().find(r=>r.label==='Tarmac').value,'race-tires');assert.equal(rows().find(r=>r.label==='Tarmac').installed,true);
 assert.equal(rows().length,8);
});
test('width and ballast buttons describe dimensions and adjustable capacity instead of tiers',async()=>{
 const garage=await fixture(),resources={garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Tires',slot:'wheels'});
 assert.deepEqual(rows.map(r=>r.label),['Stock (245 mm)','255 mm','265 mm','280 mm']);
 assert.deepEqual(rows.slice(1).map(r=>parts.find(i=>i.id===r.value).carPart.modifiers.find(m=>m.field==='tireWidthMm').value),[10,20,35]);
 const ballast=garageBrowserRows(resources,{carRef:'car'},{section:'Chassis',slot:'ballast'});
 assert.deepEqual(ballast.map(r=>r.label),['Stock','0–50 kg','0–100 kg','0–200 kg']);
 for(const row of ballast.slice(1))assert.match(parts.find(i=>i.id===row.value).description,/starts at 20 kg.*front or rear/);
 const weight=garageBrowserRows(resources,{carRef:'car'},{section:'Chassis',slot:'weight'});
 assert.deepEqual(weight.map(r=>r.label),['Stock','Trim Removal','Light Panels','Stripped Cabin']);
 for(const row of weight.slice(1)){const item=parts.find(i=>i.id===row.value),reduction=Math.round((1-item.carPart.modifiers.find(m=>m.field==='weightKg').value)*100);assert.ok(item.description.includes(reduction+'%'));}
});

test('brake and alignment discipline settings are presets, with four hardware choices and legacy parts retained',async()=>{
 const garage=await fixture(),resources={garage,stockCar:()=>stock,garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 for(const slot of ['brakes','alignment']){
  const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Handling',slot});
  assert.deepEqual(rows.map(r=>r.value),['','street-'+slot,'sport-'+slot,'race-'+slot]);
  const legacy=parts.find(p=>p.id==='rally-'+slot);assert.ok(legacy);assert.equal(legacy.carPart.forSale,false);
 }
 const {garageSetupPartIds,GARAGE_SETUP_PROFILES}=await import('../../src/garage/GarageSetupProfiles.js');
 for(const p of GARAGE_SETUP_PROFILES.filter(p=>p.id!=='street')){
  assert.ok(garageSetupPartIds(p).includes('race-alignment'));assert.ok(garageSetupPartIds(p).includes('race-brakes'));
 }
});
