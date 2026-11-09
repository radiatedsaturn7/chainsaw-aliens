import '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GARAGE_DIALOGUE,GarageDialogueState,garageDialogueText,garageDialogueContext} from '../../src/garage/GarageDialogue.js';
import {drawGarageDialogueText} from '../../src/menus/MenuRenderer.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';

test('all supplied categories and special/story lines are available verbatim',()=>{
 assert.equal(Object.keys(GARAGE_DIALOGUE.tuning).length,9);assert.equal(Object.keys(GARAGE_DIALOGUE.upgrades).length,5);assert.equal(Object.keys(GARAGE_DIALOGUE.events).length,17);
 for(const [category,line] of Object.entries(GARAGE_DIALOGUE.tuning))assert.equal(garageDialogueText({kind:'tuning',category}),line);
 for(const [category,line] of Object.entries(GARAGE_DIALOGUE.upgrades))assert.equal(garageDialogueText({kind:'upgrades',category}),line);
 assert.equal(garageDialogueText({insufficient:true,expensive:true}),GARAGE_DIALOGUE.events.insufficient);
 assert.equal(garageDialogueText({expensive:true}),GARAGE_DIALOGUE.events.expensive);
 assert.equal(garageDialogueText({maximum:true}),GARAGE_DIALOGUE.events.maximum);
});
test('purchase dialogue expires or yields when highlighting another category',()=>{
 const state=new GarageDialogueState(),context={kind:'upgrades',category:'Tires'};
 state.say('installed',context,100);assert.equal(state.text(context,200),GARAGE_DIALOGUE.events.installed);
 assert.equal(state.text(context,7000),GARAGE_DIALOGUE.upgrades.Tires);
 state.say('broke',context,100);assert.equal(state.text({...context,category:'Engine'},200),GARAGE_DIALOGUE.upgrades.Engine);
});
test('race dialogue waits for garage, repeats on another completion, and story lines are occasional',()=>{
 const state=new GarageDialogueState(),context={kind:'garage',category:''},p={lastCompletedRace:'p1',garageReturnCount:1,garageDialogueEvent:'won'};
 state.enter({id:'world-map'},p,context,0);assert.equal(state.text(context,1),'');
 state.enter({id:'garage'},p,context,0);assert.equal(state.text(context,1),GARAGE_DIALOGUE.events.won);
 state.enter({id:'world-map'},p,context,0);state.enter({id:'garage'},{...p,garageDialogueEvent:'',garageReturnCount:2},context,0);assert.equal(state.text(context,1),GARAGE_DIALOGUE.events.returned);
 const rare=new GarageDialogueState();for(let i=1;i<=5;i++){rare.enter({id:'world-map'},{},context,0);rare.enter({id:'garage'},{},context,0);assert.equal(rare.text(context,1),i===5?GARAGE_DIALOGUE.events.city:'');}
});
test('mouse hover updates tuning and upgrade highlights without activating them',async()=>{
 const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 await p.open(createMenuDocument(),{preview:true,screenId:'upgrades'});p.bounds={x:0,y:0,w:1000,h:500};
 p.resources.garageCatalog=()=>['Tires','Engine'].map(section=>({ref:section,item:{id:section,carPart:{section,slot:section,compatibleCars:[],forSale:true}}}));
 const e=p.flow.screen.elements.find(e=>e.type==='garage-browser');
 const {garageGridBounds}=await import('../../src/menus/MenuGarageWidgets.js');
 const b={x:e.x*1000,y:e.y*500,w:e.w*1000,h:e.h*500},card=garageGridBounds(b,1);
 p.hoverGarage({x:card.x+5,y:card.y+5});assert.equal(p.widgetStates.get(e.id).index,1);assert.equal(p.widgetStates.get(e.id).section,undefined);assert.equal(p.dialogueContext().category,'Engine');
 p.tuner={enabled:()=>true,busy:false,mode:'grid',index:0,hitAreas:[{x:1,y:1,w:20,h:20,kind:'category',index:4}],dispose(){}};
 p.hoverGarage({x:10,y:10});assert.equal(p.tuner.index,4);assert.equal(p.tuner.mode,'grid');p.cleanup();
});
test('dialogue widget survives saving and wraps complete long lines inside portrait/wide panels',()=>{
 const doc=createMenuDocument();doc.screens[0].elements.push({id:'dialogue',type:'garage-dialogue'});assert.equal(normalizeMenuDocument(doc).screens[0].elements.at(-1).type,'garage-dialogue');
 for(const b of [{x:0,y:0,w:320,h:30},{x:0,y:0,w:870,h:81}]){
  const drawn=[],ctx={font:'',measureText(text){return {width:text.length*parseFloat(this.font)*.5};},fillText(text,x,y){drawn.push({text,x,y});}};
  const line=GARAGE_DIALOGUE.tuning.engine;drawGarageDialogueText(ctx,b,line,'sans-serif',{color:'#fff'});
  assert.equal(drawn.map(l=>l.text).join(' '),line);assert.ok(drawn.every(l=>l.y+parseFloat(ctx.font)<=b.h));
 }
});

test('expanded dialogue panel fits every supplied line at a larger readable size',()=>{
 for(const width of [354,960])for(const value of [...Object.values(GARAGE_DIALOGUE.tuning),...Object.values(GARAGE_DIALOGUE.upgrades),...Object.values(GARAGE_DIALOGUE.events)]){
  const b={x:0,y:0,w:width*.95,h:width*9/16*.28},drawn=[];
  const ctx={font:'',measureText(text){return {width:text.length*parseFloat(this.font)*.5};},fillText(text,x,y){drawn.push({text,y});}};
  drawGarageDialogueText(ctx,b,value,'sans-serif',{fontSize:34,color:'#fff'});
  assert.equal(drawn.map(l=>l.text).join(' '),value);
  assert.ok(drawn.every(l=>l.y+parseFloat(ctx.font)<=b.h),value);
  assert.ok(parseFloat(ctx.font)>(width===354?9:22),`${width}: ${ctx.font}`);
 }
});

test('garage button highlights speak the requested lines and mouse hover does not activate',async()=>{
 const p=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 await p.open(createMenuDocument(),{preview:true,screenId:'garage'});p.bounds={x:0,y:0,w:1000,h:500};
 const lines=['Ready to head out?','Maybe we can make it run faster?','If we got enough scrap, I can fabricate something new.'];
 for(const [i,id] of ['garage-play','garage-tune','garage-upgrade'].entries()){
  const e=p.flow.screen.elements.find(e=>e.id===id);
  p.hoverGarage({x:(e.x+e.w/2)*1000,y:(e.y+e.h/2)*500});
  assert.equal(garageDialogueText(p.dialogueContext()),lines[i]);assert.equal(p.flow.screenId,'garage');
 }
 assert.equal(p.flow.screen.elements.find(e=>e.id==='garage-play').label,'Drive');p.cleanup();
});

test('highlighted upgrade parts speak specific descriptions, including Stock and nested tires',async()=>{
 const {default:catalog}=await import('../../src/content/garage-parts.json',{with:{type:'json'}});
 const {normalizeItemDocument}=await import('../../src/items/ItemDocument.js');
 const {garageBrowserRows}=await import('../../src/menus/MenuGarageWidgets.js');
 const parts=catalog.items.map(normalizeItemDocument),screen={id:'upgrades',elements:[{id:'parts',type:'garage-browser'}]};
 const resources={stockPart:slot=>catalog.stockItems.find(i=>i.carPart.slot===slot),garageCatalog:()=>parts.map(item=>({ref:item.id,item})),garage:{configuration:()=>({installed:{}}),availableCount:()=>0,items:{progress:{bags:{items:{}},unlocks:{}},game:{player:{credits:0}}}}};
 function contextFor(slot,id){
  const section=parts.find(p=>p.carPart.slot===slot).carPart.section;
  const root={section,slot};
  function find(state){const rows=garageBrowserRows(resources,{},state);for(let index=0;index<rows.length;index++){const row=rows[index];if(row.children){const result=find({...state,path:[...(state.path||[]),row.id]});if(result)return result;}else if(row.value===id)return garageDialogueContext(screen,resources,{},new Map([['parts',{...state,index}]]));}}
  return find(root);
 }
 const stock=contextFor('tires',''),street=contextFor('tires','street-tires'),race=contextFor('tires','race-tires');
 assert.match(garageDialogueText(stock),/^Stock Tires\..*replace/);
 assert.match(garageDialogueText(street),/^Street Tires\./);
 assert.match(garageDialogueText(race),/^Race Tires\..*dry asphalt/);
 assert.match(garageDialogueText(race),/rain/);assert.equal(race.insufficient,true);
 assert.notEqual(garageDialogueText(race),GARAGE_DIALOGUE.events.insufficient);
 const state=new GarageDialogueState();state.say('installed',stock,100);
 assert.equal(state.text(race,101),garageDialogueText(race));
 assert.notEqual(contextFor('brakes','').selection,stock.selection);
 const custom=parts.find(p=>p.id==='snow-tires'),original=custom.description;custom.description='Snow Tires. This is my edited commentary.';assert.equal(garageDialogueText(contextFor('tires',custom.id)),custom.description);custom.description=original;
 for(const item of parts.filter(p=>p.carPart.slot!=='tire-pressure')){
  const context=contextFor(item.carPart.slot,item.id);if(!context)continue;
  const line=garageDialogueText(context);assert.equal(line,item.description,item.id);
  for(const width of [354,960]){
   const b={x:0,y:0,w:width*.95,h:width*9/16*.28},drawn=[];
   const ctx={font:'',measureText(t){return {width:t.length*parseFloat(this.font)*.5};},fillText(text,x,y){drawn.push({text,y});}};
   drawGarageDialogueText(ctx,b,line,'sans-serif',{fontSize:34,color:'#fff'});
   assert.equal(drawn.map(l=>l.text).join(' '),line,item.id);assert.ok(drawn.every(l=>l.y+parseFloat(ctx.font)<=b.h),item.id);
  }
 }
});

test('part commentary is saved item data and stock descriptions are editable non-purchasable items',async()=>{
 const {ItemLibrary}=await import('../../src/items/ItemLibrary.js');
 const {normalizeItemDocument,serializeItemDocument}=await import('../../src/items/ItemDocument.js');
 const {isGarageUpgrade}=await import('../../src/garage/CarPart.js');
 const {MenuResources}=await import('../../src/menus/MenuResources.js');
 const library=new ItemLibrary(),defaults=await library.loadDefaults();
 const stock=normalizeItemDocument(defaults.find(i=>i.id==='stock-description-tires'));
 stock.description='Stock Tires. My saved commentary.';
 const serialized=serializeItemDocument(stock),restored=normalizeItemDocument(serialized);
 assert.equal(restored.description,stock.description);assert.equal(restored.carPart.stock,true);assert.equal(isGarageUpgrade(restored),false);
 const resources=new MenuResources({});resources.partCatalog=[{ref:restored.name,item:restored}];
 assert.equal(resources.stockPart('tires').description,stock.description);assert.deepEqual(resources.garageCatalog(),[]);
 const race=normalizeItemDocument(defaults.find(i=>i.id==='race-tires'));race.description='Race Tires. Edited in Item Properties.';
 assert.equal(normalizeItemDocument(serializeItemDocument(race)).description,race.description);
});
