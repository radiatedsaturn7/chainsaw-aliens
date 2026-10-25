import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCarFx,normalizeCarFxView,migrateCarFx,carFxActive,drawCarFx,getCarFxArtRefs,CAR_FX_VIEWS,carFxDrivingState} from '../../src/racing/CarFx.js';
import {addCarFx,removeCarFx,pickCarFxArt,editCarFx,drawCarFxPanel,carFxPointer,selectCarFx,removeCarFxPlacement,toggleCarFxTest,nudgeCarFxPlacement,carFxPreviewTransform,drawCarFxPlacementHandles,isCarFxPlacementEditor} from '../../src/ui/CarFxEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const editor=()=>new RaceEditor({},{mode:'car'});
const effect=(triggers=['braking'])=>normalizeCarFx([{id:'light',enabled:true,triggers,views:{rear:{artRef:'red',x:.25,y:.1,width:.1,height:.2,mirror:true}}}])[0];
test('FX triggers are conditional and use any matching condition',()=>{
 for(const [trigger,state] of [['braking',{braking:true}],['accelerating',{accelerating:true}],['night',{night:true}],['precipitation',{precipitation:true}],['cold',{temperatureC:0}]]){
  assert.equal(carFxActive(effect([trigger]),{}),false);assert.equal(carFxActive(effect([trigger]),state),true);
 }
 assert.equal(carFxActive(effect(['always']),{}),true);
 assert.equal(carFxActive(effect(['night','braking']),{braking:true}),true);
 assert.equal(carFxActive(effect(['cold']),{temperatureC:20}),false);
 assert.equal(carFxActive({...effect(['always']),enabled:false},{}),false);
});
test('FX render only the authored angle and mirror within that angle',()=>{
 const draws=[],translations=[],scales=[];const ctx={globalAlpha:1,save(){},restore(){},rotate(){},translate(...p){translations.push(p);},scale(...p){scales.push(p);},drawImage(...p){draws.push(p);}};
 const args={effects:[effect()],state:{braking:true},x:100,y:200,width:100,height:50,getArt:ref=>ref};
 drawCarFx(ctx,{...args,slot:'front'});assert.equal(draws.length,0);
 drawCarFx(ctx,{...args,slot:'rear'});assert.equal(draws.length,2);assert.deepEqual(translations,[[100,200],[25,5],[100,200],[-25,5]]);assert.deepEqual(scales,[[-1,1]]);
 assert.equal(draws[0][0],'red');assert.deepEqual(draws[0].slice(1),[-5,-5,10,10]);
 draws.length=0;drawCarFx(ctx,{...args,slot:'rear',state:{}});assert.equal(draws.length,0);
 drawCarFx(ctx,{...args,slot:'rear',state:{},previewId:'light'});assert.equal(draws.length,2);
});
test('legacy brake art migrates safely and explicit empty views remain empty',()=>{
 const fx=migrateCarFx({brakeLightArtRef:'brake',angleLayers:{rearLeft:{brakes:{artRef:null}},rear:{brakes:{artRef:'rear',frameIndex:2}}}});
 assert.equal(fx[0].views.front,undefined);assert.equal(fx[0].views.rearLeft,undefined);assert.equal(fx[0].views.rear.artRef,'rear');assert.equal(fx[0].views.rear.frameIndex,2);
 assert.deepEqual(migrateCarFx({fx:[],brakeLightArtRef:'old'}),[]);
});
test('adding, editing, deleting FX is undoable and survives car save/load with independent angles',async()=>{
 const e=editor();e.selectedCarShellFrameSlot='rear';addCarFx(e);
 assert.deepEqual(Object.keys(e.selectedCar.art.fx[0].views),['rear']);
 await pickCarFxArt(e,async()=>({action:'open',name:'red'}));
 await editCarFx(e,async(_,fields)=>({...Object.fromEntries(fields.map(f=>[f.id,f.value])),name:'Brake lights','trigger:always':false,'trigger:braking':true,x:25,y:10,width:10,height:8,rotation:12,opacity:75,mirror:true}));
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument().car)));
 assert.equal(saved.art.fx[0].views.rear.x,.25);assert.equal(saved.art.fx[0].views.rear.mirror,true);assert.deepEqual(saved.art.fx[0].triggers,['braking']);
 e.selectedCarShellFrameSlot='front';await pickCarFxArt(e,async()=>({action:'open',name:'white'}));
 assert.equal(e.selectedCar.art.fx[0].views.rear.artRef,'red');assert.equal(e.selectedCar.art.fx[0].views.front.artRef,'white');
 assert.deepEqual(getCarFxArtRefs(e.selectedCar).sort(),['red','white']);assert.ok(e.collectRaceCarArtRefs(e.selectedCar).includes('white'));
 removeCarFx(e);assert.equal(e.selectedCar.art.fx.length,0);e.undoRaceHistory();assert.equal(e.selectedCar.art.fx.length,1);e.redoRaceHistory();assert.equal(e.selectedCar.art.fx.length,0);
});
test('FX picker cancellation and switching cars cannot edit the wrong car',async()=>{
 const e=editor();addCarFx(e);const before=JSON.stringify(e.selectedCar.art.fx);
 await pickCarFxArt(e,async()=>null);assert.equal(JSON.stringify(e.selectedCar.art.fx),before);
 let done;const pending=pickCarFxArt(e,()=>new Promise(r=>done=r));removeCarFx(e);done({action:'open',name:'late'});await pending;assert.equal(e.selectedCar.art.fx.length,0);
});
test('eight-frame FX imports assign independent per-angle frames',()=>{
 const e=editor();e.assignImportedCarGraphic(e.selectedCar,'brakes','sheet',{name:'Lights',mapping:[7,6,5,4,3,2,1,0]});
 assert.deepEqual(CAR_FX_VIEWS.map(s=>e.selectedCar.art.fx[0].views[s].frameIndex),[7,6,5,4,3,2,1,0]);
 const saved=e.serializeSelectedCarDocument().car;assert.equal(saved.art.fx[0].views.front.artRef,'sheet');
});
test('FX panel exposes editing controls inside the existing portrait/desktop panel',()=>{
 for(const bounds of [{x:0,y:400,w:390,h:180},{x:0,y:40,w:310,h:540}]){
  const e=editor();e.buttons=[];e.registerDrawnButton=(_,b,a)=>e.buttons.push({bounds:b,...a});e.drawCarArtComponentTab=(_,b,id)=>e.buttons.push({bounds:b,id});
  drawCarFxPanel(e,{},bounds);assert.ok(e.buttons.some(b=>b.id==='car-fx-select'&&!b.disabled));
  for(const b of e.buttons){assert.ok(b.bounds.x>=bounds.x);assert.ok(b.bounds.x+b.bounds.w<=bounds.x+bounds.w);assert.ok(b.bounds.y+b.bounds.h<=bounds.y+bounds.h);}
 }
});

test('FX artwork and exact frames become visible in the prepared-only live car preview',async()=>{
 const {saveProjectFile}=await import('../../src/ui/projectFiles.js');
 const e=editor(),car=e.selectedCar,oldDocument=globalThis.document;
 const session={runtimeCar:structuredClone(car),raceTravelPreparedArtOnly:true,carEditorPreview:true};
 e.carEditorPreviewPlaytest={carId:car.id,session};e.playtestSession=session;
 const ref='fx-preview-regression';saveProjectFile('art',ref,{width:1,height:1,frames:CAR_FX_VIEWS.map((_,i)=>['#'+(i+1).toString(16).padStart(2,'0')+'0000'])});
 e.assignImportedCarGraphic(car,'brakes',ref,{name:'FX',mapping:[7,6,5,4,3,2,1,0]});
 try{
  globalThis.document={createElement(){const canvas={width:0,height:0};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{canvas.pixels=image.data;}});return canvas;}};
  e.syncCarAnglePreviewArt();
  for(const [i,slot] of CAR_FX_VIEWS.entries()){
   const view=session.runtimeCar.art.fx[0].views[slot],canvas=e.getRaceArtSpriteCanvas(view.artRef,{frameIndex:view.frameIndex});
   assert.ok(canvas);assert.equal(canvas.pixels[0],8-i);
  }
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('shared car renderer activates night and weather FX and respects view visibility',()=>{
 const e=editor();const car=structuredClone(e.selectedCar);car.art.fx=normalizeCarFx([
  {id:'headlights',triggers:['night'],views:{front:{artRef:'white'}}},
  {id:'cold',triggers:['cold'],views:{rear:{artRef:'exhaust'}}},
  {id:'rain',triggers:['precipitation'],views:{front:{artRef:'rain'}}}
 ]);
 const drawn=[];const ctx=new Proxy({globalAlpha:1,drawImage:canvas=>drawn.push(canvas.ref)}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 e.getRaceArtSpriteCanvas=ref=>ref?{ref,width:8,height:8}:null;e.getRaceCarBillboardLayerCanvas=c=>c;
 e.getRaceWeatherState=()=>({id:'snow',effectiveIntensity:1});e.selectedRace.timeOfDay='night';
 e.drawRaceCarBillboardLayers(ctx,{car,session:{},artChoice:{viewSlot:'front'},drawWheels:false,drawBodyLayer:false,drawShadowLayer:false});
 assert.ok(drawn.includes('white'));assert.ok(drawn.includes('rain'));assert.ok(!drawn.includes('exhaust'));
 drawn.length=0;e.drawRaceCarBillboardLayers(ctx,{car,session:{},artChoice:{viewSlot:'rear'},drawWheels:false,drawBodyLayer:false,drawShadowLayer:false});
 assert.ok(drawn.includes('exhaust'));assert.ok(!drawn.includes('white'));
});
test('brake lights use assigned artwork and ignore obsolete per-view visibility flags',()=>{
 const e=editor(),car=structuredClone(e.selectedCar);e.activeRootId='drivetrain';
 car.art.fx=normalizeCarFx([{id:'brake',triggers:['braking'],views:{rear:{artRef:'tailight',visible:false,x:.5,y:.1,width:.5,height:.5,opacity:.5,mirror:true}}}]);
 const drawn=[];const ctx=new Proxy({globalAlpha:1,drawImage:canvas=>drawn.push(canvas.ref)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 e.getRaceArtSpriteCanvas=ref=>ref?{ref,width:512,height:512}:null;e.getRaceCarBillboardLayerCanvas=c=>c;
 const draw=(braking,viewSlot='rear')=>{drawn.length=0;e.drawRaceCarBillboardLayers(ctx,{car,session:{},braking,artChoice:{viewSlot},drawWheels:false,drawBodyLayer:false,drawShadowLayer:false});return drawn.filter(ref=>ref==='tailight').length;};
 assert.equal(Object.hasOwn(car.art.fx[0].views.rear,'visible'),false);
 car.art.fx[0].views.rear.visible=false; // A stale in-memory document must work too.
 assert.equal(draw(false),0);assert.equal(draw(true),2,'mirrored brake lights appear');assert.equal(draw(false),0,'release clears them');assert.equal(draw(true,'front'),0,'rear art never leaks to front');
});
test('FX properties have no Show flag, offer Reverse and allow clearing angle artwork',async()=>{
 const e=editor();e.selectedCarShellFrameSlot='rear';addCarFx(e);e.selectedCar.art.fx[0].views.rear.visible=false;
 await editCarFx(e,async(_,fields)=>{assert.ok(!fields.some(f=>f.id==='visible'));assert.ok(fields.some(f=>f.id==='trigger:reverse'));assert.ok(fields.some(f=>f.id==='clearArt'));return null;});
 const controls=[];e.registerDrawnButton=(_,b,c)=>controls.push(c);e.drawCarArtComponentTab=()=>{};drawCarFxPanel(e,{}, {x:0,y:0,w:320,h:200});
 assert.deepEqual(controls.slice(0,3).map(c=>c.id),['car-fx-select','car-fx-properties','car-fx-test']);assert.ok(!controls.some(c=>['car-fx-next','car-fx-preview','car-fx-art','car-fx-view'].includes(c.id)));
});

test('reverse follows selected gear, braking follows analog/digital input, and AI remains independent',()=>{
 const fx=effect(['reverse']);
 assert.equal(carFxActive(fx,carFxDrivingState({speedMps:0},{gear:-1})),true);
 assert.equal(carFxActive(fx,carFxDrivingState({speedMps:-5},{gear:1})),false);
 assert.equal(carFxActive(fx,carFxDrivingState({gear:-1})),true);
 assert.equal(carFxDrivingState({}, {brakeAxis:.1}).braking,true);
 assert.equal(carFxDrivingState({}, {brake:true}).braking,true);
 assert.equal(carFxDrivingState({}, {brake:false,brakeAxis:0},{braking:true}).braking,false,'editor display braking must not override real pedals');
 assert.equal(carFxDrivingState({engineDrive:{brake:.4}}).braking,true);
 assert.equal(carFxDrivingState({tireSlip:{engineDrive:{throttle:.5}}}).accelerating,true);
});
test('live shared renderer switches brake and reverse artwork directly from player controls',()=>{
 const e=editor(),car=structuredClone(e.selectedCar);e.activeRootId='drivetrain';e.playtestSession={speedMps:0};
 car.art.fx=normalizeCarFx([{id:'brake',triggers:['braking'],views:{rear:{artRef:'red',visible:false}}},{id:'reverse',triggers:['reverse'],views:{rear:{artRef:'white'}}}]);
 const drawn=[];const ctx=new Proxy({globalAlpha:1,drawImage:c=>drawn.push(c.ref)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 e.getRaceArtSpriteCanvas=ref=>ref?{ref,width:8,height:8}:null;e.getRaceCarBillboardLayerCanvas=c=>c;
 const draw=(brakeAxis,gear)=>{drawn.length=0;e.raceInput.brakeAxis=brakeAxis;e.raceInput.gear=gear;e.drawRaceCarBillboardLayers(ctx,{car,session:e.playtestSession,artChoice:{viewSlot:'rear'},drawBodyLayer:false,drawShadowLayer:false,drawWheels:false});return [...drawn];};
 assert.deepEqual(draw(0,1),[]);assert.deepEqual(draw(.5,1),['red']);assert.deepEqual(draw(.5,-1),['red','white']);assert.deepEqual(draw(0,-1),['white']);assert.deepEqual(draw(0,0),[]);
});

function placementEditor(){const e=editor();e.enterCarBodyArtScreen();e.setCarArtActiveComponent('brakes');e.selectedCarShellFrameSlot='rear';addCarFx(e);e.selectedCar.art.fx[0].artRef='lamp';e.carGaugeViewport={x:100,y:200,w:400,h:300};e.carFxPreviewFrame={x:200,y:150,width:100,height:80,rotation:0,slot:'rear',bounds:{x:0,y:0,w:400,h:300},carId:e.getRaceCarProjectIdentity(e.selectedCar)};return e;}
test('tap places repeated artwork, drag moves a selected point, and undo/save preserve both',()=>{
 const e=placementEditor(),at=()=>e.selectedCar.art.fx[0].views.rear.placements;
 assert.equal(carFxPointer(e,{x:320,y:358},'down'),true);carFxPointer(e,{x:320,y:358},'up');assert.deepEqual(at(),[{x:.2,y:.1}]);
 carFxPointer(e,{x:280,y:358},'down');carFxPointer(e,{x:280,y:358},'up');assert.equal(at().length,2);
 const before=e.getCarEditorPreviewTuningRevision();carFxPointer(e,{x:320,y:358},'down');carFxPointer(e,{x:330,y:366},'move');carFxPointer(e,{x:330,y:366},'up');assert.deepEqual(at()[0],{x:.3,y:.2});assert.equal(at().length,2);assert.equal(e.getCarEditorPreviewTuningRevision(),before);
 e.undoRaceHistory();assert.deepEqual(at()[0],{x:.2,y:.1});e.redoRaceHistory();assert.deepEqual(at()[0],{x:.3,y:.2});
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument().car)));assert.deepEqual(saved.art.fx[0].views.rear.placements,at());assert.equal(saved.art.fx[0].artRef,'lamp');
});
test('placement coordinates account for a scaled preview and rotated car; other angles stay independent',()=>{
 const e=placementEditor();e.carGaugeViewport.w=800;e.carGaugeViewport.h=600;e.carFxPreviewFrame.rotation=Math.PI/2;
 // local (.2,.1) => rotated pixel (-8,20), screen (484,540).
 carFxPointer(e,{x:484,y:540},'down');carFxPointer(e,{x:484,y:540},'up');const p=e.selectedCar.art.fx[0].views.rear.placements[0];assert.ok(Math.abs(p.x-.2)<1e-8);assert.ok(Math.abs(p.y-.1)<1e-8);
 e.selectedCarShellFrameSlot='front';assert.equal(carFxPointer(e,{x:484,y:540},'down'),false,'stale rear frame cannot place front artwork');e.carFxPreviewFrame.slot='front';carFxPointer(e,{x:484,y:540},'down');carFxPointer(e,{x:484,y:540},'up');assert.equal(e.selectedCar.art.fx[0].views.front.placements.length,1);assert.equal(e.selectedCar.art.fx[0].views.rear.placements.length,1);
});
test('multiple placements render, empty angles remain empty, and legacy x/y is migrated',()=>{
 const effects=normalizeCarFx([{artRef:'shared',triggers:['always'],views:{rear:{placements:[{x:.2,y:.1},{x:-.2,y:.1}],mirror:false},front:{placements:[]}}}]);let draws=0;const c=new Proxy({globalAlpha:1,drawImage:()=>draws++},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 drawCarFx(c,{effects,slot:'rear',getArt:()=>({})});assert.equal(draws,2);drawCarFx(c,{effects,slot:'front',getArt:()=>({})});assert.equal(draws,2);assert.deepEqual(normalizeCarFxView({x:.3,y:.2}).placements,[{x:.3,y:.2}]);
});
test('Properties artwork selection is transactional and selected placements can be removed',async()=>{
 const e=placementEditor();carFxPointer(e,{x:320,y:358},'down');carFxPointer(e,{x:320,y:358},'up');
 const before=JSON.stringify(e.selectedCar.art.fx);await editCarFx(e,async(_,fields)=>{assert.equal(fields.find(f=>f.id==='chooseArt').type,'button');return null;});assert.equal(JSON.stringify(e.selectedCar.art.fx),before);
 await editCarFx(e,async(_,fields)=>({...Object.fromEntries(fields.map(f=>[f.id,f.value])),artRef:'new-lamp',removePlacement:true}));assert.equal(e.selectedCar.art.fx[0].views.rear.placements.length,0);assert.equal(e.selectedCar.art.fx[0].artRef,'new-lamp');
 const first=e.selectedCar.art.fx[0].id;addCarFx(e);await selectCarFx(e,async()=>({effect:first}));assert.equal(e.carFxId,first);
});
test('pointer events route to FX placement and mirrored handles move their source point',()=>{
 const e=placementEditor();e.buttons=[];e.handlePointerDown({x:320,y:358});e.handlePointerUp({x:320,y:358});
 const v=e.selectedCar.art.fx[0].views.rear;v.mirror=true;
 e.handlePointerDown({x:280,y:358});e.handlePointerMove({x:270,y:366});e.handlePointerUp({x:270,y:366});assert.deepEqual(v.placements,[{x:.3,y:.2}]);
});
test('rendered preview records the actual body anchor for placement, not the viewport center',()=>{
 const e=placementEditor();e.playtestSession={carEditorPreview:true};e.carFxRenderBounds={x:0,y:0,w:640,h:360};
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});e.getRaceArtSpriteCanvas=()=>null;
 e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,session:e.playtestSession,bodyAnchorX:310,bodyAnchorY:240,bodyBaseWidth:120,bodyBaseHeight:70,bodyRotationRad:.2,artChoice:{viewSlot:'rear'},drawBodyLayer:false,drawWheels:false,drawShadowLayer:false});
 assert.deepEqual(e.carFxPreviewFrame,{x:310,y:240,width:120,height:70,rotation:.2,slot:'rear',bounds:{x:0,y:0,w:640,h:360},carId:e.getRaceCarProjectIdentity(e.selectedCar)});
});

test('FX placement works from the Art root and component tabs without the body-art action',()=>{
 for(const action of [null,'car-art-exterior','tire-treads','body-art']){
  const e=placementEditor();e.activeAction=action;e.setCarArtActiveComponent('body');e.setCarArtActiveComponent('brakes');e.buttons=[];
  assert.equal(isCarFxPlacementEditor(e),true);
  e.handlePointerDown({x:320,y:358});e.handlePointerUp({x:320,y:358});
  assert.deepEqual(e.selectedCar.art.fx[0].views.rear.placements,[{x:.2,y:.1}]);
 }
 const e=placementEditor();
 for(const action of ['car-art-interior','car-camera-settings','car-gauges-exterior','car-gauges-interior']){e.activeAction=action;assert.equal(isCarFxPlacementEditor(e),false);}
 e.activeAction=null;e.playtestSession={};assert.equal(isCarFxPlacementEditor(e),false);
});
test('empty FX angles show a placement guide; missing art and unprepared preview explain the next step',()=>{
 const e=placementEditor(),labels=[],lines=[];e.registerDrawnButton=()=>{};
 const ctx=new Proxy({fillText:t=>labels.push(t),lineTo:(...p)=>lines.push(p)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 e.activeAction=null;drawCarFxPlacementHandles(e,ctx,e.carGaugeViewport);
 assert.match(labels.pop(),/Tap car to place/);assert.equal(lines.length,4);
 e.selectedCar.art.fx[0].artRef='';drawCarFxPlacementHandles(e,ctx,e.carGaugeViewport);assert.match(labels.pop(),/Choose artwork/);
 e.carFxPreviewFrame=null;drawCarFxPlacementHandles(e,ctx,e.carGaugeViewport);assert.match(labels.pop(),/Preparing FX placement/);
});

test('Effects picker adds, selects and removes transactionally, including an empty list',async()=>{
 const e=editor();e.selectedCar.art.fx=[];
 await selectCarFx(e,async(title,fields)=>{
  assert.equal(title,'Effects');const selector=fields.find(f=>f.id==='effect');
  const added=fields.find(f=>f.id==='add').onClick();assert.equal(selector.options().length,1);
  assert.equal(e.selectedCar.art.fx.length,0);return added;
 });
 assert.equal(e.selectedCar.art.fx.length,1);assert.equal(e.carFxId,e.selectedCar.art.fx[0].id);
 const original=e.carFxId;
 await selectCarFx(e,async(_,fields)=>{fields.find(f=>f.id==='remove').onClick({effect:original});return null;});assert.equal(e.selectedCar.art.fx.length,1);
 await selectCarFx(e,async(_,fields)=>fields.find(f=>f.id==='remove').onClick({effect:original}));assert.equal(e.selectedCar.art.fx.length,0);
 e.undoRaceHistory();assert.equal(e.selectedCar.art.fx[0].id,original);
});
test('Test Effect bypasses cold thresholds only for the selected preview effect without changing the document',()=>{
 const e=placementEditor();const fx=e.selectedCar.art.fx[0];fx.triggers=['cold'];fx.coldBelowC=-20;fx.views.rear.placements=[{x:0,y:0}];
 const saved=JSON.stringify(e.serializeSelectedCarDocument().car);let draws=0;
 const ctx=new Proxy({globalAlpha:1,drawImage:()=>draws++},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const render=()=>drawCarFx(ctx,{effects:[fx],slot:'rear',state:{temperatureC:30},previewId:e.carFxTestEnabled?fx.id:null,getArt:()=>({})});
 render();assert.equal(draws,0);toggleCarFxTest(e);render();assert.equal(draws,1);toggleCarFxTest(e);render();assert.equal(draws,1);
 assert.equal(JSON.stringify(e.serializeSelectedCarDocument().car),saved);
});

test('fractional tap positions remain precise and FX Properties accepts arbitrary decimals',async()=>{
 const e=placementEditor();carFxPointer(e,{x:321.234567,y:359.876543},'down');carFxPointer(e,{x:321.234567,y:359.876543},'up');
 const before={...e.selectedCar.art.fx[0].views.rear.placements[0]};
 await editCarFx(e,async(_,fields)=>{
  for(const id of ['x','y','width','height','rotation','opacity'])assert.equal(fields.find(f=>f.id===id).step,'any');
  return Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value]));
 });
 const after=e.selectedCar.art.fx[0].views.rear.placements[0];assert.ok(Math.abs(after.x-before.x)<1e-12);assert.ok(Math.abs(after.y-before.y)<1e-12);
});
test('unconfigured diagonal angles show a test sample only; placing saves an independent copy with inherited size',()=>{
 const e=placementEditor(),fx=e.selectedCar.art.fx[0];fx.triggers=['cold'];fx.coldBelowC=-50;fx.views.rear.width=.33;fx.views.rear.height=.22;
 e.playtestSession={carEditorPreview:true};e.getRaceArtSpriteCanvas=()=>({width:8,height:8});e.getRaceCarBillboardLayerCanvas=c=>c;
 e.getRaceWeatherState=()=>({id:'clear',effectiveIntensity:0});e.carFxTestEnabled=true;
 let draws=0;const ctx=new Proxy({globalAlpha:1,drawImage:()=>draws++},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 for(const slot of ['frontRight','rearRight','rearLeft','frontLeft']){
  e.selectedCarShellFrameSlot=slot;draws=0;
  e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,session:e.playtestSession,artChoice:{viewSlot:slot},drawWheels:false,drawBodyLayer:false,drawShadowLayer:false});
  assert.equal(draws,1,slot+' test sample');assert.equal(fx.views[slot],undefined,'testing must not save a placement');
  e.carFxPreviewFrame.slot=slot;carFxPointer(e,{x:320,y:358},'down');carFxPointer(e,{x:320,y:358},'up');
  assert.equal(fx.views[slot].placements.length,1);assert.equal(fx.views[slot].width,.33);assert.equal(fx.views[slot].height,.22);
 }
});
test('Remove Copy deletes only the selected placement and undo restores it; cleared views stay empty during testing',()=>{
 const e=placementEditor();for(const x of [280,320]){carFxPointer(e,{x,y:358},'down');carFxPointer(e,{x,y:358},'up');}
 e.selectedCar.art.fx[0].views.front=normalizeCarFxView({artRef:'front-lamp'});
 removeCarFxPlacement(e);let fx=e.selectedCar.art.fx[0];assert.equal(fx.views.rear.placements.length,1);assert.equal(fx.views.front.placements.length,1);assert.equal(e.carFxPlacementIndex,-1);
 e.undoRaceHistory();assert.equal(e.selectedCar.art.fx[0].views.rear.placements.length,2);e.redoRaceHistory();
 e.carFxPlacementIndex=0;removeCarFxPlacement(e);fx=e.selectedCar.art.fx[0];let draws=0;
 drawCarFx(new Proxy({drawImage:()=>draws++},{get:(o,k)=>k in o?o[k]:()=>{}}),{effects:[fx],slot:'rear',previewId:fx.id,getArt:()=>({})});assert.equal(draws,0);assert.equal(e.selectedCar.art.fx.length,1);
});

test('FX zoom projection preserves placement hit targets and nudge precision with guides hidden',()=>{
 const e=placementEditor();e.carFxZoom=2;e.carFxGuidesHidden=true;
 const t=carFxPreviewTransform(e,e.carGaugeViewport);assert.deepEqual(t,{scale:2,x:-300,y:-350});
 // Original (.2,.1) at (320,358) becomes (340,366) under 2x zoom.
 carFxPointer(e,{x:340,y:366},'down');carFxPointer(e,{x:340,y:366},'up');
 let p=e.selectedCar.art.fx[0].views.rear.placements[0];assert.deepEqual(p,{x:.2,y:.1});
 nudgeCarFxPlacement(e,1,0);p=e.selectedCar.art.fx[0].views.rear.placements[0];assert.ok(Math.abs(p.x-.205)<1e-10);assert.equal(p.y,.1);
 e.undoRaceHistory();assert.deepEqual(e.selectedCar.art.fx[0].views.rear.placements[0],{x:.2,y:.1});
});
test('FX preview tools fit portrait and desktop, and hiding guides keeps the tools available',()=>{
 for(const b of [{x:0,y:0,w:390,h:240},{x:310,y:40,w:800,h:500}]){
  const e=placementEditor(),buttons=[];e.carGaugeViewport=b;e.carFxGuidesHidden=true;e.registerDrawnButton=(_,bounds,button)=>buttons.push({...button,bounds});
  let guides=0;const ctx=new Proxy({stroke:()=>guides++},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  drawCarFxPlacementHandles(e,ctx,b);assert.equal(guides,0);assert.equal(buttons.length,6);
  for(const {bounds:r} of buttons){assert.ok(r.x>=b.x&&r.y>=b.y&&r.x+r.w<=b.x+b.w&&r.y+r.h<=b.y+b.h);}
  buttons.find(x=>x.id==='car-fx-guides').onClick();assert.equal(e.carFxGuidesHidden,false);
  buttons.find(x=>x.id==='car-fx-zoom').onClick();assert.equal(e.carFxZoom,2);
 }
});
