import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {garageBrowserRows,showroomPage} from '../../src/menus/MenuGarageWidgets.js';
import {normalizeCarPart,partFits} from '../../src/garage/CarPart.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {runGarageAction} from '../../src/garage/GarageMenu.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
const cars=Array.from({length:6},(_,i)=>({label:`Car ${i}`,value:`car-${i}`}));
async function player(){
 const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 p.resources.choices=()=>cars;
 await p.open(createMenuDocument(),{preview:true,screenId:'cars'});return p;
}
test('showroom pages at four, selects without navigating, confirms garage with Play focused',async()=>{
 const p=await player(),e=p.interactive()[0];
 assert.equal(e.type,'car-showroom');assert.equal(p.flow.parameters.carRef,'car-0');
 e.onSelect={type:'set-param',parameter:'highlight',target:'',value:'$carRef'};
 for(let i=0;i<4;i++){await p.activate(e,1);await Promise.resolve();}
 assert.equal(p.flow.screenId,'cars');assert.equal(p.flow.parameters.carRef,'car-4');
 assert.equal(p.flow.parameters.highlight,'car-4');
 assert.deepEqual(showroomPage(cars,'car-4').entries,cars.slice(4));
 await p.activate(e,1,{choose:true});
 assert.equal(p.flow.screenId,'garage');assert.equal(p.interactive()[p.focus].id,'garage-play');
 p.flow.back();
 assert.equal(p.flow.screenId,'cars');assert.equal(p.flow.parameters.carRef,'car-4');
 assert.deepEqual(normalizeMenuDocument(JSON.parse(JSON.stringify(p.flow.document))),p.flow.document);
});
test('parts drill down and back one level, use compatibility, and expose stock restoration',async()=>{
 const p=await player();p.flow.goTo('upgrades');
 p.resources.garageCatalog=()=>[
  {ref:'race',item:{id:'race',name:'Race Turbo',carPart:normalizeCarPart({slot:'turbo',tier:'race'})}},
  {ref:'street',item:{id:'street',name:'Street Turbo',carPart:normalizeCarPart({slot:'turbo',tier:'street'})}},
  {ref:'other',item:{id:'other',name:'Other',carPart:normalizeCarPart({slot:'ecu',compatibleCars:['other']})}}
 ];
 p.resources.stockCar=()=>({garagePartSlots:['turbo']});
 const e=p.flow.screen.elements.find(e=>e.type==='garage-browser');p.focus=p.interactive().indexOf(e);
 await p.activate(e,1,{choose:true});await p.activate(e,1,{choose:true});
 const state=p.widgetStates.get(e.id);
 assert.equal(state.section,'Engine');assert.equal(state.slot,'turbo');
 assert.deepEqual(garageBrowserRows(p.resources,p.flow.parameters,state).map(r=>r.value),['','street','race']);
 await p.activate(e,1);assert.equal(p.flow.parameters.partRef,'street');
 assert.equal(p.backGarageWidget(),true);assert.equal(state.slot,undefined);
 assert.equal(p.backGarageWidget(),true);assert.equal(state.section,undefined);
 assert.equal(p.backGarageWidget(),false);
 assert.equal(partFits(normalizeCarPart({slot:'turbo'}),'any'),true);
 assert.equal(partFits(normalizeCarPart({slot:'turbo'}),'any',{garagePartSlots:[]}),false);
});
test('buy and install is atomic on dependency or save failure and stock restores without selling',async()=>{
 const part=normalizeItemDocument({id:'turbo',name:'Street Turbo',carPart:{slot:'turbo',price:100}});
 const game={player:{credits:500},abilities:{}};let fail=false;
 const items=new ItemSystem(game,{library:{load:async()=>part},load:async()=>({}),save:async()=>({ok:!fail,reason:'offline'})});
 await items.load();
 const run=ref=>runGarageAction(items.garage,'garage-fit',ref,{carRef:'car',partSlot:'turbo'},{resolveCar:async()=>({})});
 part.carPart.requires=['ecu'];await assert.rejects(run('turbo'),/requires/);assert.equal(game.player.credits,500);
 assert.equal(items.progress.bags.items.turbo,undefined);
 part.carPart.requires=[];fail=true;await assert.rejects(run('turbo'),/offline/);assert.equal(game.player.credits,500);
 fail=false;await run('turbo');assert.equal(game.player.credits,400);assert.equal(items.garage.configuration('car').installed.turbo,'turbo');
 await run('turbo');assert.equal(game.player.credits,400);
 await run('');assert.equal(items.garage.configuration('car').installed.turbo,undefined);assert.equal(items.progress.bags.items.turbo,1);
 await run('turbo');assert.equal(game.player.credits,400);
});
test('showroom renderer draws at most four cars with parked front-left angles and selected animation',()=>{
 const doc=createMenuDocument(),screen=doc.screens.find(s=>s.id==='cars');screen.elements=screen.elements.filter(e=>e.type==='car-showroom');
 const sprites=[],ctx=new Proxy({globalAlpha:1,stack:[],save(){this.stack??=[];this.stack.push(this.globalAlpha)},restore(){this.globalAlpha=this.stack.pop()}},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={choices:()=>cars,art:()=>null,car:ref=>({name:ref,art:{}}),tuning:()=>({}),game:{carEditor:{getRaceCarProjectedArtRef:(_car,_yaw,angle)=>({artRef:'test',angle})}},carPreview:{drawSprite:(_ctx,b,car,choice)=>sprites.push({car,b,angle:choice.angle,opacity:ctx.globalAlpha})}};
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{carRef:'car-1'},{time:1,resources,widgetStates:new Map([['car',{selectedAt:0}]])});
 assert.equal(sprites.length,4);assert.ok(sprites[1].b.w>sprites[0].b.w);
 assert.ok(sprites[1].opacity>sprites[0].opacity);assert.equal(sprites[0].angle,135*Math.PI/180);
 assert.ok(sprites[1].angle>sprites[0].angle);
});

test('car restrictions persist through editor normalization and prevent garage purchase',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 await editor.openCarInstallableParts(async fields=>({all:false,slot0:true}));
 const car=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.selectedCar)));
 assert.deepEqual(car.garagePartSlots,['engine']);
 const part=normalizeItemDocument({id:'turbo',name:'Turbo',carPart:{slot:'turbo',price:100}});
 const game={player:{credits:500},abilities:{}};
 const items=new ItemSystem(game,{library:{load:async()=>part},load:async()=>({}),save:async()=>({ok:true})});await items.load();
 await assert.rejects(runGarageAction(items.garage,'garage-fit','turbo',{carRef:'car'},{resolveCar:async()=>car}),/disabled/);
 assert.equal(game.player.credits,500);
 await editor.openCarInstallableParts(async()=>({all:true}));assert.equal(editor.selectedCar.garagePartSlots,null);
});

test('showroom screen template can be added to an existing minimal menu and edited with undo',async()=>{
 const {default:MenuEditor}=await import('../../src/ui/MenuEditor.js');
 const e=new MenuEditor({});e.loadMenu({startScreen:'home',screens:[{id:'home',elements:[]}]});
 await e.runAction('screen-showroom');assert.equal(e.screen.elements.find(e=>e.type==='car-showroom').action.target,'garage');
 for(const id of ['world-map','tuning','upgrades'])assert.ok(e.menu.screens.some(s=>s.id===id));
 assert.doesNotThrow(()=>normalizeMenuDocument(e.menu));e.history();assert.equal(e.menu.screens.length,1);
});

test('standalone garage template creates a valid Play destination',async()=>{
 const {default:MenuEditor}=await import('../../src/ui/MenuEditor.js');
 const e=new MenuEditor({});e.loadMenu({startScreen:'home',screens:[{id:'home',elements:[]}]});
 await e.runAction('screen-garage');
 assert.equal(e.screen.elements.find(e=>e.id==='garage-play').action.target,'world-map');
 for(const id of ['world-map','tuning','upgrades'])assert.ok(e.menu.screens.some(s=>s.id===id));
 assert.doesNotThrow(()=>normalizeMenuDocument(e.menu));
});

test('garage exposes only Play, Tune and Upgrade and keeps the selected car across destinations',async()=>{
 const p=await player();await p.activate(p.interactive()[0],1,{choose:true});
 assert.deepEqual(p.interactive().map(e=>e.label),['Play','Tune','Upgrade']);
 const car=p.flow.parameters.carRef;
 for(const [button,target] of [['garage-play','world-map'],['garage-tune','tuning'],['garage-upgrade','upgrades']]){
  await p.activate(p.flow.screen.elements.find(e=>e.id===button));
  assert.equal(p.flow.screenId,target);assert.equal(p.flow.parameters.carRef,car);
  await p.activate(p.flow.screen.elements.find(e=>e.id==='back'));
  assert.equal(p.flow.screenId,'garage');
 }
});

test('showroom statistics follow highlighted cars, including the authoring fallback',async()=>{
 const p=await player(),doc=p.flow.document,screen=p.flow.screen;
 const specs=[{powerHp:100,torqueLbFt:100,weightKg:1800,topSpeedMph:90,tireGrip:.7},{powerHp:800,torqueLbFt:600,weightKg:1000,topSpeedMph:220,tireGrip:1.5}];
 const vehicles=specs.map((tuning,i)=>({name:`Vehicle ${i}`,art:{},tuning}));
 const labels=[];const ctx=new Proxy({globalAlpha:1,fillText:text=>labels.push(text)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 p.resources.choices=()=>cars.slice(0,2);p.resources.car=ref=>vehicles[Number(ref?.split('-')[1])]||null;
 p.resources.tuning=car=>car.tuning;p.resources.art=()=>null;
 p.resources.game.carEditor={getRaceCarProjectedArtRef:()=>({artRef:'test'}),getRaceTorqueNmAtRpm:(_rpm,t)=>t.torqueLbFt*1.355817948};
 p.resources.carPreview.drawSprite=()=>{};
 const render=parameters=>{labels.length=0;drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,parameters,{resources:p.resources,editing:true});return [...labels]};
 const initial={carRef:''},first=render(initial);
 assert.ok(first.includes('100 HP · 136 Nm'));assert.ok(first.includes('1800 kg · '));assert.equal(initial.carRef,'','drawing must not mutate authored configuration');
 p.update({wasPressedCode:code=>code==='ArrowRight'},.016);
 const second=render(p.flow.parameters);
 assert.ok(second.includes('800 HP · 813 Nm'));assert.ok(second.includes('1000 kg · '));
 assert.notEqual(first.find(s=>s.startsWith('Class ')),second.find(s=>s.startsWith('Class ')));
 assert.ok(!second.includes('100 HP · 136 Nm'));
 p.update({wasGamepadPressed:button=>button==='dpadLeft'},.016);
 assert.ok(render(p.flow.parameters).includes('100 HP · 136 Nm'));
});

test('portrait torque graph uses a positive plotting area within its small panel',()=>{
 const doc=createMenuDocument(),screen=doc.screens.find(s=>s.id==='cars');screen.elements=screen.elements.filter(e=>e.type==='power-curve');
 const e=screen.elements[0],bounds={x:0,y:0,w:330,h:186},ys=[];
 const ctx=new Proxy({globalAlpha:1,moveTo:(_x,y)=>ys.push(y),lineTo:(_x,y)=>ys.push(y)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const car={name:'Car',tuning:{idleRpm:800,redlineRpm:7000}},resources={art:()=>null,car:()=>car,tuning:()=>car.tuning,game:{carEditor:{getRaceTorqueNmAtRpm:rpm=>100+rpm/100}}};
 drawMenuScreen(ctx,bounds,doc,screen,{carRef:'car'},{resources});
 const top=e.y*bounds.h,bottom=top+e.h*bounds.h;
 assert.ok(Math.min(...ys)>=top);assert.ok(Math.max(...ys)<=bottom);assert.ok(Math.max(...ys)-Math.min(...ys)>15,'curves must use the panel height instead of collapsing into fixed margins');
});
