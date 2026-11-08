import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GarageTuner,TUNING_SECTIONS,tuningRows} from '../../src/garage/GarageTuning.js';
import {CAR_PART_FIELDS} from '../../src/garage/CarPart.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {drawGarageTuner} from '../../src/menus/MenuTuningRenderer.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const stock=()=>({name:'Car',setup:{defaultTireCompound:'tarmac',tirePressurePsi:{fl:32,fr:32,rl:30,rr:30}},tuning:{gearRatios:[3,2,1],gearFinalDrive:4,springFront:.5,springRear:.5,torqueLbFt:200}});
const springs=normalizeItemDocument({id:'springs',name:'Race Springs',carPart:{slot:'suspension',price:0,tuning:[{field:'springFront',min:.1,max:1,step:.01},{field:'springRear',min:.1,max:1,step:.01}]}});
const tire=normalizeItemDocument({id:'rally',name:'Rally Tires',carPart:{slot:'tires',tireRef:'builtin:dirt',price:0}});
async function fixture({progress={},save,car=stock()}={}){
 let saved,writes=0,exits=0;const game={player:{credits:500},abilities:{},input:{},menuProgress:{},transitionTo(){},setActiveMusicTrack(){},resolveRaceTravelCarAsync:async()=>({car})};
 const items=new ItemSystem(game,{load:async key=>key==='rtg-item-progress'?progress:{},save:async(k,v)=>{writes++;if(save)return save(k,v);saved=structuredClone(v);return {ok:true};},library:{load:async id=>[springs,tire].find(i=>i.id===id)}});game.items=items;await items.load();
 const tuner=new GarageTuner({garage:items.garage,carRef:'car',resolveCar:async()=>car,onExit:()=>exits++});await tuner.readyTask;
 return {tuner,items,game,car,saved:()=>saved,writes:()=>writes,exits:()=>exits};
}
async function editPressure(t){t.index=6;t.path=[];await t.confirm();await t.confirm();await t.confirm();assert.equal(t.mode,'edit');}
test('eight sections cover every numeric tuning field once and show locked stock categories',async()=>{
 assert.equal(TUNING_SECTIONS.length,8);
 for(const f of CAR_PART_FIELDS)assert.equal(TUNING_SECTIONS.filter(s=>s.matches(f.id)).length,1,f.id);
 const {tuner}=await fixture();assert.equal(tuner.ready,true);assert.deepEqual(TUNING_SECTIONS.map((s,i)=>tuner.enabled(i)),[true,true,true,true,true,true,true,true]);
 tuner.index=4;await tuner.confirm();assert.equal(tuner.mode,'list');tuner.cancel();
 tuner.index=7;tuner.move('right');tuner.move('down');assert.ok(tuner.index>=0&&tuner.index<8);tuner.cancel();
});
test('A edits/applies, B cancels only the draft, and saved pressure reaches reloaded car copies',async()=>{
 const f=await fixture();await editPressure(f.tuner);f.tuner.move('right');assert.equal(f.tuner.draft,32.5);assert.equal(f.items.garage.configuration('car').tune['pressure.fl'],undefined);assert.equal(f.writes(),0);
 f.tuner.cancel();assert.equal(f.tuner.mode,'list');assert.equal(f.tuner.row.value,32);
 await f.tuner.confirm();f.tuner.move('left');await f.tuner.confirm();assert.equal(f.tuner.mode,'list');assert.equal(f.items.garage.configuration('car').tune['pressure.fl'],31.5);
 const reload=await fixture({progress:f.saved()});assert.equal((await reload.items.garage.build('car',reload.car)).setup.tirePressurePsi.fl,31.5);
 assert.equal(f.car.setup.tirePressurePsi.fl,32);f.tuner.cancel();f.tuner.cancel();assert.equal(f.tuner.mode,'grid');f.tuner.cancel();assert.equal(f.exits(),1);
});
test('installed parts unlock only their fields and slider values stay within granted limits',async()=>{
 const f=await fixture();await f.items.garage.purchase('springs',{carRef:'car'});await f.tuner.refresh();assert.equal(f.tuner.enabled(4),true);
 f.tuner.index=4;await f.tuner.confirm();assert.equal(f.tuner.row.id,'group:Front');await f.tuner.confirm();assert.equal(f.tuner.row.id,'springFront');await f.tuner.confirm();
 for(let i=0;i<50;i++)f.tuner.move('right',10);assert.equal(f.tuner.draft,1);
 for(let i=0;i<50;i++)f.tuner.move('left',10);assert.equal(f.tuner.draft,.1);
 await f.tuner.confirm();assert.equal((await f.items.garage.build('car',f.car)).tuning.springFront,.1);
 f.tuner.rowIndex=f.tuner.sectionRows().findIndex(r=>r.id==='dampingFront');await f.tuner.confirm();assert.equal(f.tuner.mode,'list');assert.match(f.tuner.message,/Install/);
});
test('single taps fine-tune, holding accelerates, release and direction changes reset acceleration',async()=>{
 const f=await fixture();await editPressure(f.tuner);
 f.tuner.update({held:{right:true}},.016);assert.equal(f.tuner.draft,32.5);
 for(let i=0;i<10;i++)f.tuner.update({held:{right:true}},.016);assert.equal(f.tuner.draft,32.5);
 for(let i=0;i<55;i++)f.tuner.update({held:{right:true}},.016);assert.ok(f.tuner.draft>40,'long hold must accelerate beyond fine steps');
 f.tuner.update({},.016);const before=f.tuner.draft;f.tuner.update({held:{left:true}},.016);assert.equal(f.tuner.draft,before-.5);
});
test('failed saves leave the draft open and do not apply settings',async()=>{
 const f=await fixture({save:async()=>({ok:false,reason:'offline'})});await editPressure(f.tuner);f.tuner.move('right');await f.tuner.confirm();
 assert.equal(f.tuner.mode,'edit');assert.equal(f.tuner.draft,32.5);assert.match(f.tuner.message,/offline/);assert.equal(f.items.garage.configuration('car').tune['pressure.fl'],undefined);f.tuner.cancel();assert.equal(f.tuner.row.value,32);
});
test('a pending apply cannot be submitted twice or canceled halfway through saving',async()=>{
 let finish;const f=await fixture({save:()=>new Promise(r=>finish=r)});await editPressure(f.tuner);f.tuner.move('right');const save=f.tuner.confirm();await new Promise(r=>setImmediate(r));
 assert.equal(f.tuner.busy,true);f.tuner.cancel();await f.tuner.confirm();assert.equal(f.writes(),1);assert.equal(f.tuner.mode,'edit');finish({ok:true});await save;assert.equal(f.tuner.mode,'list');assert.equal(f.tuner.row.value,32.5);
});
test('tuning preserves upgrade tires and places Stats first in Setup with front/rear pressures separate',async()=>{
 const f=await fixture();await f.items.garage.purchase('rally',{carRef:'car'});await f.tuner.refresh();
 assert.ok(!f.tuner.rows.some(r=>r.id==='tireType'));
 assert.deepEqual(f.tuner.sectionRows(1).map(r=>r.id),['stats','drivingSetup','saveSetup','loadSetup','revEngine']);
 assert.deepEqual(f.tuner.sectionRows(6).map(r=>r.label),['Front','Rear']);
 f.tuner.index=1;await f.tuner.confirm();await f.tuner.confirm();assert.equal(f.tuner.mode,'stats');
 f.tuner.move('right');assert.equal(f.tuner.row.id,'stats');f.tuner.cancel();assert.equal(f.tuner.mode,'list');
 assert.equal(f.tuner.car.setup.defaultTireCompound,'dirt');assert.equal(f.items.garage.configuration('car').installed.tires,'rally');
});
test('renderer lays out two rows of four, grey locks, no exit button and bounded slider controls',async()=>{
 const f=await fixture();for(const b of [{x:0,y:0,w:900,h:460},{x:20,y:30,w:330,h:186}]){
  const labels=[],ctx=new Proxy({fillText(text){labels.push({text,color:this.fillStyle});}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  f.tuner.mode='grid';drawGarageTuner(ctx,b,f.tuner);const categories=f.tuner.hitAreas.filter(a=>a.kind==='category');assert.equal(categories.length,8);assert.equal(new Set(categories.map(a=>a.y)).size,2);assert.equal(new Set(categories.map(a=>a.x)).size,4);assert.ok(labels.some(l=>l.text==='Handling'&&l.color==='#ffffff'));
  assert.ok(!f.tuner.hitAreas.some(a=>a.kind==='exit'));assert.ok(!labels.some(l=>/ADJUST TUNING|D-pad|A:|A Open|B Exit/.test(l.text)));
  await editPressure(f.tuner);drawGarageTuner(ctx,b,f.tuner);
  assert.ok(f.tuner.hitAreas.every(a=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h));
  const track=f.tuner.hitAreas.find(a=>a.kind==='slider');f.tuner.pointerDown({id:1,x:track.x+track.w,y:track.y+track.h/2});assert.equal(f.tuner.draft,80);f.tuner.pointerUp();f.tuner.cancel();
 }
});
test('MenuPlayer uses the tuner for keyboard, physical controller and virtual gamepad without number forms',async()=>{
 for(const mode of ['keyboard','gamepad','touch']){
  const f=await fixture(),p=new MenuPlayer(f.game);p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};const doc=createMenuDocument();doc.parameters.carRef='car';await p.open(doc,{preview:true,screenId:'tuning'});await p.tuner.readyTask;assert.equal(p.tuner.ready,true);
  let touch={};p.surface.controls.getActions=()=>touch;
  const press=(key,pad,action)=>{const input=mode==='keyboard'?{wasPressedCode:c=>c===key}:mode==='gamepad'?{wasGamepadPressed:a=>a===pad}:{};if(mode==='touch')touch={[action]:true};p.update(input,.016);touch={};p.update({},.016);};
  press('ArrowDown','dpadDown','down');press('ArrowRight','dpadRight','right');press('ArrowRight','dpadRight','right');press('Enter','jump','jump');press('Enter','jump','jump');assert.equal(p.tuner.mode,'list');press('Enter','jump','jump');assert.equal(p.tuner.mode,'edit');press('ArrowRight','dpadRight','right');assert.equal(p.tuner.draft,32.5);press('Escape','gamepadB','attack');assert.equal(p.tuner.mode,'list');assert.equal(p.tuner.row.value,32);
  press('Enter','jump','jump');press('ArrowLeft','dpadLeft','left');press('Enter','jump','jump');await p.resources.garage.items.queue;await new Promise(r=>setImmediate(r));assert.equal(p.tuner.row.value,31.5);assert.equal(f.items.garage.configuration('car').tune['pressure.fl'],undefined,'preview must not change game setup');
 }
});

test('slider drafts start within newly installed part ranges even when stock is outside them',async()=>{
 const f=await fixture();const narrow=structuredClone(springs);narrow.carPart.tuning[0].min=.7;f.items.library.load=async()=>narrow;
 await f.items.garage.purchase('springs',{carRef:'car'});await f.tuner.refresh();f.tuner.index=4;await f.tuner.confirm();await f.tuner.confirm();await f.tuner.confirm();assert.equal(f.tuner.draft,.7);await f.tuner.confirm();assert.equal(f.items.garage.configuration('car').tune.springFront,.7);
});
test('owned tire copies and dependency rules are enforced atomically when switching tires',async()=>{
 const f=await fixture();await f.items.garage.purchase('rally',{carRef:'other'});
 await assert.rejects(f.items.garage.setTireType('car','rally',f.car),/Not enough copies/);assert.equal(f.items.garage.configuration('other').installed.tires,'rally');assert.deepEqual(f.items.garage.configuration('car').installed,{});
});
test('applied tuning reaches consecutive real race-travel launches and leaves the saved car unchanged',async()=>{
 globalThis.window||={location:{search:''},addEventListener(){},removeEventListener(){}};
 const {default:Game}=await import('../../src/game/GameCore.js');const f=await fixture();await editPressure(f.tuner);f.tuner.move('left');await f.tuner.confirm();
 const game=Object.assign(Object.create(Game.prototype),f.game),starts=[];
 Object.assign(game,{state:'title',ensureActiveWeaponAvailable(){},showSystemToast:message=>{throw Error(message);},setRevAudio(){},prepareRacePlaytestAudio:async()=>true,captureRaceTravelPlayerState:()=>({}),resolveRaceTravelCarAsync:async()=>({id:'car',name:'car',documentName:'car',car:f.car}),transitionTo(state){this.state=state;}});
 game.raceEditor={collectRaceCarArtRefs:()=>[],loadRaceTravelDocument:async()=>({id:'test',name:'Test Race'}),applyLoadedRaceDocument:()=>true,startPlaytest(id,options){starts.push(options.runtimeCarOverrides);this.playtestSession={running:true};}};
 assert.equal(await game.startRaceTravel({raceName:'First',carSelection:'specific',carRef:'car'}),true);
 assert.equal(await game.startRaceTravel({raceName:'Second',continuation:game.raceTravelSession}),true);
 assert.deepEqual(starts.map(c=>c.setup.tirePressurePsi.fl),[31.5,31.5]);assert.equal(f.car.setup.tirePressurePsi.fl,32);
});
test('legacy Adjust Tuning actions open the in-game tuner and return to their original screen',async()=>{
 const f=await fixture(),p=new MenuPlayer(f.game);p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};const doc=createMenuDocument();doc.parameters.carRef='car';await p.open(doc,{preview:true,screenId:'garage'});
 await p.flow.run({type:'garage-tune'});await p.tuner.readyTask;assert.equal(p.tunerModal,true);assert.equal(p.tuner.ready,true);p.tuner.cancel();assert.equal(p.tuner,null);assert.equal(p.flow.screenId,'garage');
});

test('live MenuPlayer applies to game progress and keeps settings after leaving and reopening tuning',async()=>{
 const f=await fixture(),p=new MenuPlayer(f.game);p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};const doc=createMenuDocument();doc.parameters.carRef='car';await p.open(doc);p.flow.goTo('garage');p.flow.goTo('tuning');await p.tuner.readyTask;
 await editPressure(p.tuner);p.tuner.move('right');await p.tuner.confirm();assert.equal(f.items.garage.configuration('car').tune['pressure.fl'],32.5);
 p.tuner.cancel();p.tuner.cancel();p.tuner.cancel();assert.equal(p.flow.screenId,'garage');assert.equal(p.tuner,null);
 p.flow.goTo('tuning');await p.tuner.readyTask;await editPressure(p.tuner);assert.equal(p.tuner.row.value,32.5);assert.equal(f.saved().garage.cars.car.tune['pressure.fl'],32.5);
});

test('tuning category panels match upgrade grid dimensions in portrait and wide layouts',async()=>{
 const {garageGridBounds,upgradeGridArea}=await import('../../src/menus/MenuGarageWidgets.js');const f=await fixture();
 const ctx=new Proxy({},{get:()=>()=>{}});
 for(const b of [{x:20,y:40,w:900,h:400},{x:5,y:15,w:330,h:150}]){
  drawGarageTuner(ctx,b,f.tuner);
  for(const area of f.tuner.hitAreas){const expected=garageGridBounds(b,area.index);for(const k of ['x','y','w','h'])assert.equal(area[k],expected[k]);}
 }
});

test('tuning categories and lists use identical dimensions; sliders have no action buttons',async()=>{
 const {garageGridBounds,upgradeGridArea}=await import('../../src/menus/MenuGarageWidgets.js');
 const f=await fixture(),ctx=new Proxy({},{get:()=>()=>{}});
 for(const b of [{x:10,y:20,w:900,h:400},{x:4,y:8,w:330,h:150}]){
  f.tuner.mode='grid';f.tuner.index=6;f.tuner.path=['group:Front'];f.tuner.rowIndex=0;
  const expected=garageGridBounds(b,0);
  for(const mode of ['grid','list','edit']){
   f.tuner.mode=mode;f.tuner.draft=32;drawGarageTuner(ctx,b,f.tuner);
   const buttons=f.tuner.hitAreas.filter(a=>a.kind!=='slider');if(mode==='edit'){assert.equal(buttons.length,0);assert.equal(f.tuner.hitAreas.length,1);}else assert.ok(buttons.length);
   for(const a of buttons){assert.equal(a.w,expected.w);assert.equal(a.h,expected.h);}
  }
 }
});

test('locked settings can be highlighted with keyboard and touch but cannot be edited',async()=>{
 const f=await fixture(),t=f.tuner;t.move('down');assert.equal(t.index,4);await t.confirm();
 await t.confirm();assert.equal(t.mode,'list');
 const locked=t.sectionRows().findIndex(r=>!r.enabled);assert.ok(locked>=0);
 t.hitAreas=[{kind:'row',index:locked,x:0,y:0,w:40,h:40}];t.pointerDown({x:20,y:20});
 assert.equal(t.rowIndex,locked);assert.equal(t.mode,'list');assert.match(t.message,/Locked.*Install/);
 const before=f.writes();await t.confirm();assert.equal(t.mode,'list');assert.equal(f.writes(),before);
 const labels=[],ctx=new Proxy({fillText(text){labels.push({text,color:this.fillStyle});}},{get:(o,k)=>k in o?o[k]:(()=>{})});
 drawGarageTuner(ctx,{x:0,y:0,w:900,h:460},t);assert.ok(labels.some(l=>l.text==='(Locked)'&&l.color==='#ff5757'));
 t.move('right');assert.ok(t.row);assert.equal(t.mode,'list');
});

test('repair confirmation moves between Repair and Cancel without changing the component',async()=>{
 const f=await fixture(),t=f.tuner;t.index=0;await t.confirm();
 t.rowIndex=t.sectionRows().findIndex(r=>r.label==='Service');await t.confirm();
 t.rowIndex=t.sectionRows().findIndex(r=>r.id==='service');await t.confirm();
 assert.equal(t.mode,'repair');const id=t.row.id,before=f.writes();
 t.update({held:{right:true}},.016);assert.equal(t.repairAction,'exit');assert.equal(t.row.id,id);
 t.update({held:{down:true}},.016);assert.equal(t.row.id,id);
 await t.confirm();assert.equal(t.mode,'list');assert.equal(f.writes(),before);
 await t.confirm();t.move('right');t.move('left');assert.equal(t.repairAction,'apply');
 const texts=[],ctx=new Proxy({fillText(text){texts.push(text);}},{get:(o,k)=>k in o?o[k]:(()=>{})});
 drawGarageTuner(ctx,{x:0,y:0,w:900,h:460},t);
 assert.ok(!texts.includes(t.row.reason));assert.ok(texts.includes('Cancel'));
 assert.ok(texts.includes(String(t.row.cost)));assert.ok(!texts.some(text=>/scrap|No replacement part required/.test(text)));
 // A pointer click on Repair must override a Cancel keyboard/hover selection.
 t.move('right');const apply=t.hitAreas.find(a=>a.kind==='apply');
 t.pointerDown({x:apply.x+apply.w/2,y:apply.y+apply.h/2});
 await f.items.queue;await new Promise(r=>setImmediate(r));assert.equal(t.mode,'list');assert.equal(f.writes(),before+1);
 await t.confirm();drawGarageTuner(ctx,{x:0,y:0,w:350,h:210},t);
 const cancel=t.hitAreas.find(a=>a.kind==='exit');t.pointerDown({x:cancel.x+cancel.w/2,y:cancel.y+cancel.h/2});
 assert.equal(t.mode,'list');assert.equal(f.writes(),before+1);
});

test('Stats renders current upgraded car on the left and its power curve on the right, with B returning to Setup',async()=>{
 const {createBuiltInRaceCars}=await import('../../src/racing/raceData.js');
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const f=await fixture({car:createBuiltInRaceCars()[0]}),t=f.tuner;
 await f.items.garage.purchase('rally',{carRef:'car'});await t.refresh();
 t.index=1;await t.confirm();await t.confirm();
 const editor=new RaceEditor({}),resources={game:{carEditor:editor},tuning:car=>{assert.equal(car,t.car);return editor.getRaceCarTuning(car);}};
 for(const b of [{x:0,y:0,w:900,h:460},{x:20,y:30,w:330,h:186}]){
  const texts=[],points=[],ctx=new Proxy({fillText(text,x,y){texts.push({text,x,y});},moveTo(x,y){points.push({x,y});},lineTo(x,y){points.push({x,y});}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  drawGarageTuner(ctx,b,t,'system-ui',{},resources);
  assert.ok(texts.some(r=>r.text.includes(' HP')&&r.x<b.x+b.w/2));
  assert.ok(texts.some(r=>r.text.includes('RPM')&&r.x>b.x+b.w/2));
  assert.equal(points.length,82);assert.ok(points.every(p=>Number.isFinite(p.y)&&p.x>=b.x+b.w/2&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h));
 }
 assert.equal(t.hitAreas.length,0);t.update({cancel:true},.016);assert.equal(t.mode,'list');assert.equal(t.row.id,'stats');
});

test('Rev Engine supports held confirm and pointer release, and stops on Back or disposal',async()=>{
 const f=await fixture(),t=f.tuner,calls=[];
 t.enginePreview={active:false,update(car,throttle){this.active=true;calls.push(throttle);return 3000;},stop(){this.active=false;}};
 t.index=1;await t.confirm();t.rowIndex=t.sectionRows().findIndex(r=>r.rev);
 const before=f.writes();await t.confirm();assert.equal(t.mode,'list');
 for(let i=0;i<10;i++)t.update({confirmHeld:true},.05);assert.equal(calls.at(-1),1);
 t.update({},.05);assert.equal(calls.at(-1),0);
 t.hitAreas=[{kind:'row',index:t.rowIndex,x:0,y:0,w:40,h:40}];t.pointerDown({x:20,y:20});
 for(let i=0;i<10;i++)t.update({},.05);assert.equal(calls.at(-1),1);
 t.pointerUp();t.update({},.05);assert.equal(calls.at(-1),0);
 t.cancel();assert.equal(t.enginePreview.active,false);assert.equal(t.mode,'grid');assert.equal(f.writes(),before);
 await t.confirm();t.rowIndex=t.sectionRows().findIndex(r=>r.rev);await t.confirm();t.update({confirmHeld:true},.05);t.dispose();assert.equal(t.enginePreview.active,false);
});
