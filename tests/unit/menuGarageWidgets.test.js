import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument,normalizeMenuDocument,normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {garageBrowserRows,showroomPage} from '../../src/menus/MenuGarageWidgets.js';
import {normalizeCarPart,partFits} from '../../src/garage/CarPart.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {runGarageAction} from '../../src/garage/GarageMenu.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {drawMenuScreen,drawCarDescription} from '../../src/menus/MenuRenderer.js';
const cars=Array.from({length:6},(_,i)=>({label:`Car ${i}`,value:`car-${i}`}));
async function player(){
 const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 p.resources.choices=()=>cars;
 await p.open(createMenuDocument(),{preview:true,screenId:'cars'});return p;
}
test('showroom pages at four, selects without navigating, confirms world map before garage with Play focused',async()=>{
 const p=await player(),e=p.interactive()[0];
 assert.equal(e.type,'car-showroom');assert.equal(p.flow.parameters.carRef,'car-0');
 e.onSelect={type:'set-param',parameter:'highlight',target:'',value:'$carRef'};
 for(let i=0;i<4;i++){await p.activate(e,1);await Promise.resolve();}
 assert.equal(p.flow.screenId,'cars');assert.equal(p.flow.parameters.carRef,'car-4');
 assert.equal(p.flow.parameters.highlight,'car-4');
 assert.deepEqual(showroomPage(cars,'car-4').entries,cars.slice(4));
 await p.activate(e,1,{choose:true});
 assert.equal(p.flow.screenId,'world-map');
 await p.activate(p.interactive()[0],1,{choose:true});
 assert.equal(p.flow.screenId,'garage');assert.equal(p.interactive()[p.focus].id,'garage-play');
 p.flow.back();
 p.flow.back();
 assert.equal(p.flow.screenId,'world-map');assert.equal(p.flow.parameters.carRef,'car-4');
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
 await e.runAction('screen-showroom');assert.equal(e.screen.elements.find(e=>e.type==='car-showroom').action.target,'world-map');
 for(const id of ['world-map','tuning','upgrades'])assert.ok(e.menu.screens.some(s=>s.id===id));
 assert.doesNotThrow(()=>normalizeMenuDocument(e.menu));e.history();assert.equal(e.menu.screens.length,1);
});

test('standalone garage template creates a valid Play destination',async()=>{
 const {default:MenuEditor}=await import('../../src/ui/MenuEditor.js');
 const e=new MenuEditor({});e.loadMenu({startScreen:'home',screens:[{id:'home',elements:[]}]});
 await e.runAction('screen-garage');
 assert.equal(e.screen.elements.find(e=>e.id==='garage-play').action.target,'$raceRef');
 for(const id of ['world-map','tuning','upgrades'])assert.ok(e.menu.screens.some(s=>s.id===id));
 assert.doesNotThrow(()=>normalizeMenuDocument(e.menu));
});

test('garage exposes only Play, Tune and Upgrade and keeps the selected car across destinations',async()=>{
 const p=await player();await p.activate(p.interactive()[0],1,{choose:true});await p.activate(p.interactive()[0],1,{choose:true});
 assert.deepEqual(p.interactive().map(e=>e.label),['Drive','Tune','Upgrade']);
 const car=p.flow.parameters.carRef;
 for(const [button,target] of [['garage-tune','tuning'],['garage-upgrade','upgrades']]){
  await p.activate(p.flow.screen.elements.find(e=>e.id===button));
  assert.equal(p.flow.screenId,target);assert.equal(p.flow.parameters.carRef,car);
  if(p.tuner)p.tuner.cancel();else p.update({wasGamepadPressed:a=>a==='gamepadB'},.016);
  assert.equal(p.flow.screenId,'garage');
 }
});

test('showroom statistics follow highlighted cars, including the authoring fallback',async()=>{
 const p=await player(),doc=p.flow.document,screen=p.flow.screen;
 screen.elements=screen.elements.filter(e=>e.type!=='car-description');screen.elements.push(normalizeMenuElement({id:'stats',type:'car-stats',binding:'carRef',x:0,y:.65,w:.5,h:.3}));
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
 const doc=createMenuDocument(),screen=doc.screens.find(s=>s.id==='cars');screen.elements=[normalizeMenuElement({id:'power',type:'power-curve',binding:'carRef',x:.5,y:.65,w:.45,h:.25})];
 const e=screen.elements[0],bounds={x:0,y:0,w:330,h:186},ys=[];
 const ctx=new Proxy({globalAlpha:1,moveTo:(_x,y)=>ys.push(y),lineTo:(_x,y)=>ys.push(y)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const car={name:'Car',tuning:{idleRpm:800,redlineRpm:7000}},resources={art:()=>null,car:()=>car,tuning:()=>car.tuning,game:{carEditor:{getRaceTorqueNmAtRpm:rpm=>100+rpm/100}}};
 drawMenuScreen(ctx,bounds,doc,screen,{carRef:'car'},{resources});
 const top=e.y*bounds.h,bottom=top+e.h*bounds.h;
 assert.ok(Math.min(...ys)>=top);assert.ok(Math.max(...ys)<=bottom);assert.ok(Math.max(...ys)-Math.min(...ys)>15,'curves must use the panel height instead of collapsing into fixed margins');
});


test('car description edits survive serialization and cancellation preserves text',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 await editor.openCarDescription(async()=>({description:'Lightweight coupe.\nBuilt for winding roads.'}));
 const saved=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.selectedCar)));
 assert.equal(saved.description,'Lightweight coupe.\nBuilt for winding roads.');
 await editor.openCarDescription(async()=>null);
 assert.equal(editor.selectedCar.description,saved.description);
 await editor.openCarDescription(async()=>({description:''}));
 assert.equal(editor.selectedCar.description,'');
});

test('showroom replaces specifications with descriptions that follow keyboard and gamepad highlights',async()=>{
 const p=await player(),screen=p.flow.screen;
 assert.ok(screen.elements.some(e=>e.type==='car-description'));
 assert.ok(!screen.elements.some(e=>['car-stats','power-curve'].includes(e.type)));
 p.resources.car=ref=>({description:`Description ${ref}`,art:{}});
 p.resources.game.carEditor={getRaceCarProjectedArtRef:()=>({artRef:'test'})};p.resources.art=()=>null;p.resources.tuning=()=>({});p.resources.carPreview.drawSprite=()=>{};
 const labels=[],ctx=new Proxy({globalAlpha:1,fillText:t=>labels.push(t),measureText:t=>({width:t.length*6})},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const render=parameters=>{labels.length=0;drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},p.flow.document,screen,parameters,{resources:p.resources});return [...labels]};
 assert.ok(render({carRef:''}).includes('Description car-0'));
 p.update({wasPressedCode:code=>code==='ArrowRight'},.016);
 assert.ok(render(p.flow.parameters).includes('Description car-1'));
 p.update({wasGamepadPressed:button=>button==='dpadLeft'},.016);
 assert.ok(render(p.flow.parameters).includes('Description car-0'));
});

test('description wraps long words and paragraphs and truncates to the panel height',()=>{
 const lines=[],ctx={measureText:t=>({width:t.length*6}),fillText:(text,x,y)=>lines.push({text,x,y})};
 drawCarDescription(ctx,{x:0,y:0,w:100,h:50},'First line\nVerylongwordwithoutspaces followed by more words.');
 assert.equal(lines[0].text,'First line');assert.equal(lines.length,3);
 assert.ok(lines.at(-1).text.endsWith('…'));
 assert.ok(lines.every(l=>l.text.length*6<=84&&l.y+14<=50));
});

test('splash and showroom use solid black backgrounds with a borderless showroom',()=>{
 const doc=createMenuDocument();
 for(const id of ['splash','cars','garage','tuning']){
  const screen=doc.screens.find(s=>s.id===id);
  assert.equal(screen.background,'#000000');assert.equal(screen.effect,'none');assert.equal(screen.useDefaultBackground,false);
 }
 const car=doc.screens.find(s=>s.id==='cars').elements.find(e=>e.type==='car-showroom');
 assert.equal(car.background,'#000000');assert.equal(car.selectionBorder,false);
 assert.equal(car.duration,4);assert.equal(car.selectedScale,1.25);
});

test('selection borders can be hidden on arbitrary widgets without hiding authoring handles',()=>{
 for(const type of ['button','image','slider','car-description'])for(const selectionBorder of [true,false]){
  const e=normalizeMenuElement({id:'test',type,selectionBorder});
  assert.equal(normalizeMenuElement(JSON.parse(JSON.stringify(e))).selectionBorder,selectionBorder);
  const doc=createMenuDocument(),screen={...doc.screens[0],elements:[e]},strokes=[];
  const ctx=new Proxy({strokeRect:(...b)=>strokes.push(b),measureText:t=>({width:t.length*6})},{get:(o,k)=>k in o?o[k]:(()=>{})});
  const resources={art:()=>null,car:()=>({description:'Car'})};
  for(const selection of [{focus:e.id},{selected:e.id}]){
   strokes.length=0;drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {...selection,resources});assert.equal(strokes.length,selectionBorder?1:0);
  }
  strokes.length=0;drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {selected:e.id,editing:true,resources});assert.equal(strokes.length,1);
 }
 assert.equal(normalizeMenuElement({type:'button'}).selectionBorder,true);
 assert.equal(normalizeMenuElement({type:'car-showroom'}).selectionBorder,false);
});

test('highlighted car zooms to nearly 125 percent within 180ms and rotates once per four seconds',()=>{
 const doc=createMenuDocument(),screen=doc.screens.find(s=>s.id==='cars');screen.elements=screen.elements.filter(e=>e.type==='car-showroom');
 const sprites=[],ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={choices:()=>cars.slice(0,2),art:()=>null,car:ref=>({name:ref}),tuning:()=>({}),game:{carEditor:{getRaceCarProjectedArtRef:(_car,_yaw,angle)=>({artRef:'test',angle})}},carPreview:{drawSprite:(_ctx,b,car,choice)=>sprites.push({b,angle:choice.angle})}};
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{carRef:'car-0'},{time:.18,resources,widgetStates:new Map([['car',{selectedAt:0}]])});
 const ratio=sprites[0].b.w/sprites[1].b.w;
 assert.ok(ratio>1.23&&ratio<=1.25);
 assert.ok(Math.abs((sprites[0].angle-sprites[1].angle)-(.18/4*Math.PI*2))<1e-8);
});

test('cursor, border and disabled indicators survive saving and preserve editor selection handles',()=>{
 for(const mode of ['cursor','border','disabled']){
  const e=normalizeMenuElement({id:'item',type:'button',selectionIndicator:mode,x:0,y:0,w:1,h:.1});
  assert.equal(normalizeMenuElement(JSON.parse(JSON.stringify(e))).selectionIndicator,mode);
  const doc=createMenuDocument(),screen={...doc.screens[0],elements:[e]};
  const strokes=[],fills=[],points=[],handles=[];
  const ctx=new Proxy({strokeRect:(...b)=>strokes.push(b),fillText:t=>{if(t==='>')fills.push(true);},moveTo:(x,y)=>points.push({x,y}),lineTo:(x,y)=>points.push({x,y}),fillRect:(...b)=>handles.push(b)},{get:(o,k)=>k in o?o[k]:(()=>{})});
  for(const selection of [{focus:e.id},{selected:e.id},{}]){
   strokes.length=fills.length=points.length=0;
   drawMenuScreen(ctx,{x:0,y:0,w:390,h:220},doc,screen,{},selection);
   const active=Object.keys(selection).length>0;
   assert.equal(strokes.length,active&&mode==='border'?1:0);
   assert.equal(fills.length,active&&mode==='cursor'?1:0);
   assert.ok(points.every(p=>p.x>=0&&p.x<=390&&p.y>=0&&p.y<=22));
  }
  strokes.length=0;handles.length=0;
  drawMenuScreen(ctx,{x:0,y:0,w:390,h:220},doc,screen,{}, {selected:e.id,editing:true});
  assert.equal(strokes.length,1);assert.ok(handles.some(b=>b[2]===10&&b[3]===10));
 }
 assert.equal(normalizeMenuElement({selectionBorder:false}).selectionIndicator,'disabled');
 assert.equal(normalizeMenuElement({selectionBorder:true}).selectionIndicator,'border');
 assert.equal(normalizeMenuElement({selectionIndicator:'invalid'}).selectionIndicator,'border');
 assert.equal(normalizeMenuElement({selectionIndicator:'cursor',selectionBorder:false}).selectionIndicator,'cursor');
});

test('upgrade cards use four columns and two rows with vertical navigation and sparse last pages',async()=>{
 const {garageGridBounds,garageGridVerticalIndex}=await import('../../src/menus/MenuGarageWidgets.js');
 const b={x:0,y:0,w:800,h:400};const cards=Array.from({length:8},(_,i)=>garageGridBounds(b,i));
 assert.equal(new Set(cards.map(c=>c.x)).size,4);assert.equal(new Set(cards.map(c=>c.y)).size,2);
 assert.equal(garageGridVerticalIndex(1,8,1),5);assert.equal(garageGridVerticalIndex(5,8,-1),1);
 assert.equal(garageGridVerticalIndex(7,8,1),null);assert.equal(garageGridVerticalIndex(3,6,1),5);
 assert.equal(garageGridVerticalIndex(8,9,-1),8);assert.equal(garageGridVerticalIndex(8,9,1),null);
 const {createUpgradeMenuScreen}=await import('../../src/garage/GarageMenu.js');const screen=createUpgradeMenuScreen();
 assert.deepEqual(screen.elements.filter(e=>e.type==='button').map(e=>e.label),[]);
 assert.equal(screen.elements.find(e=>e.type==='garage-browser').w,.9);
});

test('upgrade controller rows, horizontal paging, and touch use the same selected cards',async()=>{
 const p=await player();p.flow.goTo('upgrades');
 p.resources.garageCatalog=()=>Array.from({length:10},(_,i)=>({ref:'part'+i,item:{id:'part'+i,name:'Part '+i,carPart:normalizeCarPart({section:'Section '+i,slot:'engine'})}}));
 const e=p.flow.screen.elements.find(e=>e.type==='garage-browser');p.focus=p.interactive().indexOf(e);
 p.widgetStates.set(e.id,{index:1});
 p.update({wasGamepadPressed:action=>action==='dpadDown'},.016);assert.equal(p.widgetStates.get(e.id).index,5);
 p.update({},.016);p.update({wasGamepadPressed:action=>action==='dpadUp'},.016);assert.equal(p.widgetStates.get(e.id).index,1);
 p.update({},.016);p.update({wasGamepadPressed:action=>action==='dpadUp'},.016);assert.equal(p.widgetStates.get(e.id).index,1);
 await p.activate(e,7);assert.equal(p.widgetStates.get(e.id).index,8);
 p.bounds={x:0,y:0,w:1000,h:500};
 const {menuElementBounds}=await import('../../src/menus/MenuRenderer.js');
 const {menuElementPose}=await import('../../src/menus/MenuDocument.js');
 const {garageGridBounds}=await import('../../src/menus/MenuGarageWidgets.js');
 const b=menuElementBounds(e,p.bounds,menuElementPose(e,p.flow.time)),card=garageGridBounds(b,1);
 p.pointerGarageWidget(e,{x:card.x+card.w/2,y:card.y+card.h/2});
 assert.equal(p.widgetStates.get(e.id).section,'Section 9');
});

test('upgrade tire list has one free Stock choice and recognizes existing stock installations',()=>{
 const stock=normalizeItemDocument({id:'stock-tires',name:'Stock Tires',carPart:{slot:'tires',section:'Tires',tireRef:'Stock',price:0}});
 const race=normalizeItemDocument({id:'race-tires',name:'Race Tires',carPart:{slot:'tires',section:'Tires',tireRef:'Tarmac',price:100}});
 const setup={installed:{}};
 const resources={garageCatalog:()=>[stock,race].map(item=>({ref:item.name,item})),garage:{configuration:()=>setup,items:{progress:{bags:{items:{}},unlocks:{}}},availableCount:()=>0}};
 for(const id of [undefined,'stock-tires','race-tires']){
  setup.installed.tires=id;
  const rows=garageBrowserRows(resources,{carRef:'car'},{section:'Tires',slot:'tires'});
  assert.equal(rows.length,2);assert.equal(rows[0].value,'');assert.equal(rows[0].label,id==='race-tires'?'Stock · Install':'Stock · Installed');assert.equal(rows[1].value,'Race Tires');
 }
});

test('retired tire pressure kits are absent from the shop even when previously installed',()=>{
 const kit=normalizeItemDocument({id:'kit',name:'Tire Pressure Kit',carPart:{section:'Handling',slot:'tire-pressure',forSale:true}});
 const resources={garageCatalog:()=>[{ref:'kit',item:kit}],garage:{configuration:()=>({installed:{'tire-pressure':'kit'}}),items:{progress:{bags:{items:{kit:1}}}}}};
 assert.deepEqual(garageBrowserRows(resources,{carRef:'car'}),[]);
});

test('upgrade selection skips unavailable rows in either direction and on hover/touch',async()=>{
 const p=await player();p.flow.goTo('upgrades');p.preview=false;p.bounds={x:0,y:0,w:960,h:540};
 const e=p.interactive().find(e=>e.type==='garage-browser');
 p.resources.garageCatalog=()=>[0,1,2].map(i=>({ref:'p'+i,item:{id:'p'+i,name:'Part '+i,carPart:normalizeCarPart({section:'Engine',slot:'engine',tier:'street',price:i===1?5000:10})}}));
 p.resources.garageOverride={configuration:()=>({installed:{}}),availableCount:()=>0,items:{progress:{unlocks:{},bags:{items:{}}},game:{player:{credits:100}}}};
 p.widgetStates.set(e.id,{section:'Engine',slot:'engine',index:1});
 await p.activate(e,1);assert.equal(p.widgetStates.get(e.id).index,2); // affordable parts sorted before expensive
 await p.activate(e,1);assert.equal(p.widgetStates.get(e.id).index,0); // skip the expensive final row
 await p.activate(e,-1);assert.equal(p.widgetStates.get(e.id).index,2);
 const {menuElementBounds}=await import('../../src/menus/MenuRenderer.js'),{garageGridBounds}=await import('../../src/menus/MenuGarageWidgets.js');
 const b=garageGridBounds(menuElementBounds(e,p.bounds),3),point={x:b.x+b.w/2,y:b.y+b.h/2};
 p.hoverGarage(point);assert.equal(p.widgetStates.get(e.id).index,2);
 p.pointerGarageWidget(e,point);assert.equal(p.widgetStates.get(e.id).index,2);
});

test('owned spare upgrades remain installable without purchase unlocks or scrap',()=>{
 const item=normalizeItemDocument({id:'gift-turbo',name:'Gift Turbo',carPart:{section:'Engine',slot:'turbo',tier:'race',price:5000,unlockKey:'chapter2'}});
 let owned=1;const resources={garageCatalog:()=>[{ref:'gift',item}],garage:{configuration:()=>({installed:{}}),availableCount:()=>owned,items:{progress:{bags:{items:{'gift-turbo':1}},unlocks:{}},game:{player:{credits:0}}}}};
 const rows=()=>garageBrowserRows(resources,{carRef:'car'},{section:'Engine',slot:'turbo'});
 assert.equal(rows()[1].disabled,false);assert.match(rows()[1].label,/Install$/);
 owned=0;assert.equal(rows()[1].disabled,true);assert.match(rows()[1].label,/Locked$/);
});
