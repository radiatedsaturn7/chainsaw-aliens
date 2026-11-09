import {savedTireForRef} from '../helpers/savedGarageTires.js';
import {runGarageAction} from '../../src/garage/GarageMenu.js';
import {MenuResources} from '../../src/menus/MenuResources.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import raw from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {AUTO_UPGRADE_CLASSES,planAutoUpgrade,applyAutoUpgrade,garageCarPerformance} from '../../src/garage/GarageAutoUpgrade.js';
import {applyGarageSetup} from '../../src/garage/GarageSetups.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
const editor=new RaceEditor({}),evaluate=car=>garageCarPerformance(car,editor.getRaceCarTuning(car));
async function fixture(save=async()=>({ok:true})){
 const parts=raw.items.map(normalizeItemDocument),catalog=new Map(parts.map(p=>[p.id,p]));
 const game={player:{credits:1000000},abilities:{}};
 const items=new ItemSystem(game,{load:async()=>({}),save,library:{load:async ref=>catalog.get(ref)}});await items.load();
 return {garage:items.garage,items,catalog,stock:createBuiltInRaceCars()[0]};
}
test('class quotes stay below their PI ceilings and match installed runtime stats',async()=>{
 const f=await fixture();
 for(const stock of createBuiltInRaceCars()){
  const current=evaluate(await f.garage.build('car',stock));
  for(const target of AUTO_UPGRADE_CLASSES){
   if(current.points>target.limit){await assert.rejects(planAutoUpgrade(f.garage,'car',stock,target.label,f.catalog,evaluate),/cannot fit/);continue;}
   const plan=await planAutoUpgrade(f.garage,'car',stock,target.label,f.catalog,evaluate);
   assert.ok(plan.rating.points<=target.limit);assert.ok(plan.rating.points>=current.points);
   const before=f.items.game.player.credits;
   await applyAutoUpgrade(f.garage,'car',stock,target.label,f.catalog,evaluate,plan.token);
   assert.equal(evaluate(await f.garage.build('car',stock)).points,plan.rating.points);
   assert.equal(f.items.game.player.credits,before-plan.cost);
   await f.garage.resetStock('car');
  }
 }
});
test('auto upgrade selects dry-tarmac hardware without slider optimization and preserves condition',async()=>{
 const f=await fixture();await applyGarageSetup(f.garage,'car',f.stock,'rally',{packageParts:true});
 await f.garage.saveCondition('car',{damage:{engine:12}});
 const before=structuredClone(f.garage.configuration('car'));
 const plan=await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate);assert.ok(plan.refs.length);
 await applyAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate,plan.token);
 const after=f.garage.configuration('car');
 assert.ok(!Object.values(after.installed).some(id=>id.startsWith('rally-')));
 for(const [field,value] of Object.entries(after.tune))assert.equal(value,before.tune[field]);assert.equal(after.setupId,undefined);assert.deepEqual(after.condition,before.condition);
 const repeat=await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate);assert.equal(repeat.cost,0);assert.equal(repeat.changes,0);
});
test('quotes reuse spare parts, reject changed quotes and roll back unaffordable or failed saves',async()=>{
 let fail=false;const f=await fixture(async()=>({ok:!fail,reason:'offline'}));
 const plan=await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate);
 await f.garage.purchase(plan.refs[0]);
 const owned=await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate);assert.ok(owned.cost<plan.cost);
 const before=structuredClone(f.items.progress);
 await assert.rejects(applyAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate,plan.token),/quote changed/);
 fail=true;await assert.rejects(applyAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate,owned.token),/offline/);
 assert.deepEqual(f.items.progress,before);
 fail=false;f.items.game.player.credits=0;f.items.savedStats.credits=0;
 await assert.rejects(applyAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate,owned.token),/Not enough scrap/);
 assert.deepEqual(f.items.progress,before);
});
test('locked and incompatible parts are excluded; class buttons show actual PI and insufficient funds',async()=>{
 const f=await fixture();
 for(const item of f.catalog.values())item.carPart.unlockKey='missing-unlock';
 const plan=await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate);assert.deepEqual(plan.refs,[]);
 for(const item of f.catalog.values()){delete item.carPart.unlockKey;item.carPart.compatibleCars=['other'];}
 assert.deepEqual((await planAutoUpgrade(f.garage,'car',f.stock,'A',f.catalog,evaluate)).refs,[]);
 f.items.game.player.credits=0;
 const rows=garageBrowserRows({garage:f.garage,stockCar:()=>f.stock,autoUpgradeQuote:(ref,label)=>({...plan,rating:{...plan.rating,class:label},refs:['part'],cost:100})},{carRef:'car'},{section:'Presets',slot:'auto'});
 const leaves=rows.flatMap(r=>r.children||[r]);
 assert.deepEqual(leaves.map(r=>r.label),['Stock',...AUTO_UPGRADE_CLASSES.slice(-7).reverse().map(c=>'Max '+c.label)]);
 assert.ok(rows.length<=8&&rows.every(r=>!r.children||r.children.length<=8));
 assert.ok(leaves.filter(r=>r.value!=='package:stock').every(r=>r.disabled&&r.reason==='Not enough scrap'&&r.description.includes('PI')));
});

test('cached menu quotes and the garage action use the same price and PI, and refresh after installation',async()=>{
 const f=await fixture(),resources=new MenuResources({...f.items.game,carEditor:editor,items:f.items});
 resources.stockCar=()=>f.stock;resources.partCatalog=[...f.catalog].map(([ref,item])=>({ref,item}));
 assert.equal(resources.autoUpgradeQuote('car','A'),null);
 await Promise.all(resources.pending.values());
 const quote=resources.autoUpgradeQuote('car','A');assert.ok(quote.refs.length);
 await runGarageAction(f.garage,'garage-fit','auto:A',{carRef:'car',packageQuote:quote.token},{resolveCar:async()=>f.stock,autoCatalog:()=>resources.garageCatalog(),evaluate:car=>resources.performance(car)});
 assert.equal(resources.performance(await f.garage.build('car',f.stock)).points,quote.rating.points);
 assert.equal(resources.autoUpgradeQuote('car','A'),null);await Promise.all(resources.pending.values());
 assert.equal(resources.autoUpgradeQuote('car','A').cost,0);
});

test('unsupported classes are hidden while current and unaffordable configurations remain visible',()=>{
 const resources={stockCar:()=>({}),garage:{items:{game:{player:{credits:0}}}},autoUpgradeQuote:(ref,label)=>{
  if(label==='E1')return {error:'Current car exceeds this limit'};
  if(label==='S')return {refs:['part'],cost:100,rating:{class:'A',points:850}};
  if(label==='C')return {refs:[],cost:0,changes:0,rating:{class:'C',points:650},initial:{class:'C',points:650}};
  if(label!=='B')return {error:'Unsupported'};
  return {refs:['part'],cost:100,rating:{class:'B',points:780},initial:{class:'C',points:650}};
 }};
 const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Presets',slot:'auto'});
 assert.deepEqual(rows.map(r=>r.label),['Stock','Max B','Max C']);assert.equal(rows[1].disabled,true);assert.equal(rows[2].installed,true);
 resources.autoUpgradeQuote=()=>({error:'Unavailable'});assert.deepEqual(garageBrowserRows(resources,{carRef:'car'},{section:'Presets',slot:'auto'}).map(r=>r.label),['Stock']);
});

test('a high-class car can downgrade, keep removed parts, upgrade again using those parts, and reset via Auto Upgrade Stock',async()=>{
 const f=await fixture();
 const base=evaluate(await f.garage.build('car',f.stock));
 const high=await planAutoUpgrade(f.garage,'car',f.stock,'S',f.catalog,evaluate);
 await applyAutoUpgrade(f.garage,'car',f.stock,'S',f.catalog,evaluate,high.token);
 const before=structuredClone(f.items.progress),credits=f.items.game.player.credits;
 const lower=await planAutoUpgrade(f.garage,'car',f.stock,base.class,f.catalog,evaluate);
 assert.equal(lower.rating.class,base.class);assert.ok(lower.rating.points<high.rating.points);assert.ok(lower.removed.length);
 await applyAutoUpgrade(f.garage,'car',f.stock,base.class,f.catalog,evaluate,lower.token);
 assert.equal(evaluate(await f.garage.build('car',f.stock)).points,lower.rating.points);
 for(const id of lower.removed){assert.ok(f.garage.availableCount(id)>0);assert.equal(f.items.progress.bags.items[id],before.bags.items[id]);}
 assert.equal(f.items.game.player.credits,credits-lower.cost);
 const again=await planAutoUpgrade(f.garage,'car',f.stock,'S',f.catalog,evaluate);assert.equal(again.cost,0);
 await applyAutoUpgrade(f.garage,'car',f.stock,'S',f.catalog,evaluate,again.token);
 assert.equal(evaluate(await f.garage.build('car',f.stock)).points,high.rating.points);
 const resources={garage:f.garage,stockCar:()=>f.stock,autoUpgradeQuote:()=>null};
 const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Presets',slot:'auto'});assert.equal(rows[0].label,'Stock');
 await runGarageAction(f.garage,'garage-fit',rows[0].value,{carRef:'car'},{resolveCar:async()=>f.stock});
 assert.deepEqual(f.garage.configuration('car').installed,{});assert.deepEqual(f.garage.configuration('car').tune,{});
 assert.equal(evaluate(await f.garage.build('car',f.stock)).points,base.points);
});
