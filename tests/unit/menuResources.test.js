import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuResources} from '../../src/menus/MenuResources.js';
import {saveProjectFile} from '../../src/ui/projectFiles.js';

test('car selection refreshes a re-saved car without re-normalizing it every frame',()=>{
 let installs=0;const resources=new MenuResources({carEditor:{normalizeLoadedCarDocument(data){installs++;return structuredClone(data)},collectRaceCarArtRefs:()=>[],getRaceCarTuning:car=>({powerHp:car.powerHp})}});
 saveProjectFile('cars','Menu refresh fixture',{name:'Before',powerHp:100});const first=resources.car('Menu refresh fixture');assert.equal(first.name,'Before');assert.equal(resources.car('Menu refresh fixture'),first);assert.equal(installs,1);
 saveProjectFile('cars','Menu refresh fixture',{name:'After',powerHp:200});const second=resources.car('Menu refresh fixture');assert.equal(second.name,'After');assert.notEqual(second,first);assert.equal(resources.tuning(second).powerHp,200);assert.equal(installs,2);
});

test('preview camera contains the whole car through every angle on narrow and wide panels',async()=>{
 const {MenuCarPreview}=await import('../../src/menus/MenuCarPreview.js');const THREE=await import('../../src/vendorBridge/three.js');const prior=globalThis.document;globalThis.document={};
 try{
  let camera;const preview=new MenuCarPreview({getRaceCarDimensions:()=>({lengthM:4.67,widthM:1.83}),addRaceThreeProceduralCar(){}});preview.holder={scene:new THREE.Scene()};preview.renderer={setSize(){},render(_scene,value){camera=value;camera.updateMatrixWorld()},domElement:{}};
  for(const [w,h] of [[170,203],[563,192]])for(let angle=0;angle<8;angle++){
   preview.draw({drawImage(){}},{x:0,y:0,w,h},{tuning:{cgHeightM:0.56}},angle*Math.PI/4,0);
   for(const x of [-1.83/2,1.83/2])for(const y of [0.56-0.75,0.56+0.75])for(const z of [-4.67/2,4.67/2]){
    const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Number.isFinite(p.x+p.y));assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${w}x${h}, angle ${angle}: full car stays in frame`);
   }
  }
 }finally{globalThis.document=prior}
});


test('3D turntable targets the geometric center even when model geometry is offset',async()=>{
 const {MenuCarPreview}=await import('../../src/menus/MenuCarPreview.js'),THREE=await import('../../src/vendorBridge/three.js');
 const prior=globalThis.document;globalThis.document={};
 const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,4));mesh.position.set(3,1,5);group.add(mesh);const hidden=new THREE.Mesh(mesh.geometry,mesh.material);hidden.position.set(-100,1,-100);hidden.visible=false;group.add(hidden);
 try{
  let camera;const preview=new MenuCarPreview({getRaceCarDimensions:()=>({lengthM:4,widthM:2}),addRaceThreeProceduralCar(){}});
  preview.holder={scene:new THREE.Scene(),dynamicCarGroup:group};preview.renderer={setSize(){},render(_scene,c){camera=c;c.updateMatrixWorld()},domElement:{}};
  for(let i=0;i<8;i++){
   preview.draw({drawImage(){}},{x:0,y:0,w:320,h:240},{tuning:{}},i*Math.PI/4,0);
   const footprint=new THREE.Box3();for(const x of [2,4])for(const y of [0.5,1.5])for(const z of [3,7])footprint.expandByPoint(new THREE.Vector3(x,y,z).project(camera));
   const center=footprint.getCenter(new THREE.Vector3());assert.ok(Math.abs(center.x)<1e-10&&Math.abs(center.y)<1e-10);
   assert.ok(footprint.min.x>-1&&footprint.max.x<1&&footprint.min.y>-1&&footprint.max.y<1);
  }
 }finally{mesh.geometry.dispose();mesh.material.dispose();globalThis.document=prior;}
});

test('animated car choices do not parse unrelated art and music or unchanged car payloads', async () => {
 const {resetProjectFilesForTests,listProjectFiles}=await import('../../src/ui/projectFiles.js');
 const {upsertCachedProjectFile}=await import('../../src/ui/serverStorage.js');
 resetProjectFilesForTests();
 const carRaw=JSON.stringify({savedAt:1,data:{name:'Fast Car'}});
 const artRaw=JSON.stringify({savedAt:2,data:{pixels:'x'.repeat(1024*1024)}});
 upsertCachedProjectFile('cars','Fast Car',carRaw);
 upsertCachedProjectFile('art','Large Art',artRaw);
 upsertCachedProjectFile('music','Music',JSON.stringify({savedAt:3,data:{notes:[1,2,3]}}));
 const parse=JSON.parse,seen=[];JSON.parse=(raw,...args)=>{seen.push(raw);return parse(raw,...args)};
 try{
  assert.equal(listProjectFiles('cars')[0].name,'Fast Car');
  assert.ok(!seen.includes(artRaw));
  seen.length=0;
  for(let i=0;i<60;i++)listProjectFiles('cars');
  assert.equal(seen.length,0,'warm frames must not parse file payloads');
  upsertCachedProjectFile('cars','Fast Car',JSON.stringify({savedAt:9,data:{name:'Updated'}}));
  listProjectFiles('cars');
  assert.ok(seen.some(raw=>raw.includes('Updated')), 'replacement payload metadata is refreshed');
 }finally{JSON.parse=parse;resetProjectFilesForTests();}
});

test('showroom dependencies exclude smoke, interior and gauge art but retain exterior FX',()=>{
 let received;
 const resources=new MenuResources({carEditor:{collectRaceCarArtRefs(car){received=car;return [car.art.body,car.art.fx];}}});
 const car={art:{body:'body',fx:'lights',smoke:{snow:'snowsmoke'},gauges:{exterior:{widgets:[{artRef:'huge-dial'}]}},interior:{dashboard:{artRef:'dash'}}}};
 assert.deepEqual(resources.exteriorArtRefs(car),['body','lights']);
 assert.deepEqual(received.art.smoke,{});assert.equal(car.art.smoke.snow,'snowsmoke');
 assert.deepEqual(received.art.gauges,{});assert.deepEqual(received.art.interior,{});
 assert.equal(car.art.interior.dashboard.artRef,'dash','saved car remains intact');
});

test('screen preparation builds background and button pixels before resolving',async()=>{
 const {upsertCachedProjectFile,clearCachedProjectFilesForTests}=await import('../../src/ui/serverStorage.js');
 const {normalizeMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const previous=globalThis.document;
 const context=()=>new Proxy({measureText:()=>({width:20}),createImageData:()=>({data:new Uint8ClampedArray(4)})},
  {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>({getContext:context})};
 clearCachedProjectFilesForTests();
 try{
  for(const ref of ['bg-ready','button-ready'])upsertCachedProjectFile('art',ref,JSON.stringify({savedAt:1,data:{width:1,height:1,frames:[['#ff0000'],['#00ff00']]}}));
  const resources=new MenuResources({carEditor:{}});
  const doc=normalizeMenuDocument({screens:[{id:'splash',backgroundArt:'bg-ready',elements:[{id:'start',type:'button',label:'Start',artRef:'button-ready'}]}]});
  await resources.prepareScreen(doc,doc.screens[0],{});
  assert.equal(resources.pending.size,0);
  assert.ok(resources.art('bg-ready'));assert.ok(resources.art('button-ready'));
  assert.equal(resources.artCache.size,4,'all animation frames are decoded before revealing the menu');
 }finally{globalThis.document=previous;clearCachedProjectFilesForTests();}
});


test('an early menu art cache miss cannot hide a later untimestamped download',async()=>{
 const {upsertCachedProjectFile,clearCachedProjectFilesForTests}=await import('../../src/ui/serverStorage.js');
 const {getRaceArtSpriteCanvasShared}=await import('../../src/ui/shared/raceArtSpriteCanvas.js');
 const cache=new Map(),documentRef={createElement:()=>({getContext:()=>({fillRect(){}})})};
 clearCachedProjectFilesForTests();
 try{
  assert.equal(getRaceArtSpriteCanvasShared('late',{cache,documentRef,allowSyncFetch:false}),null);
  upsertCachedProjectFile('art','late',JSON.stringify({savedAt:0,data:{width:1,height:1,pixels:['#ffffff']}}));
  assert.ok(getRaceArtSpriteCanvasShared('late',{cache,documentRef,allowSyncFetch:false}));
 }finally{clearCachedProjectFilesForTests();}
});


test('missing optional world map descriptions are fetched once instead of keeping preparation pending',async()=>{
 const {clearCachedProjectFilesForTests}=await import('../../src/ui/serverStorage.js');
 clearCachedProjectFilesForTests();const original=globalThis.fetch;let reads=0;
 globalThis.fetch=async()=>{reads++;return {ok:true,json:async()=>({file:null})};};
 try{
  const resources=new MenuResources({carEditor:{}});
  for(let i=0;i<4;i++){assert.equal(resources.race('Missing description'),null);await Promise.all(resources.pending.values());}
  assert.equal(reads,1);assert.equal(resources.pending.size,0);
 }finally{globalThis.fetch=original;clearCachedProjectFilesForTests();}
});

test('stock save-slot icons prepare without garage builds or tuning calculations',async()=>{
 const {normalizeMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const previous=globalThis.document;
 const ctx=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const resources=new MenuResources({carEditor:{getRaceCarProjectedArtRef:()=>({artRef:'body'})}});
  resources.car=()=>{throw Error('No garage build for a stock icon');};
  resources.tuning=()=>{throw Error('No tuning required for an icon');};
  resources.stockCar=()=>({art:{body:'body'}});resources.exteriorArtRefs=()=>[];resources.carPreview.drawSprite=()=>true;
  const doc=normalizeMenuDocument({screens:[{id:'saves-start',elements:[{id:'car-a',type:'car-preview',property:'stock',assetRef:'RTG-001',animation:'none'}]}]});
  await resources.prepareScreen(doc,doc.screens[0],{});
 }finally{globalThis.document=previous;}
});

test('modified-car fallback prepares only the visible page instead of the entire catalog',async()=>{
 const {normalizeMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const previous=globalThis.document;
 const ctx=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const {invalidateProjectCarThumbnail}=await import('../../src/ui/shared/carPreviewThumbnails.js');
  for(let i=8;i<12;i++)invalidateProjectCarThumbnail(`Car ${i}`);
  const requested=new Set();
  const resources=new MenuResources({carEditor:{getRaceCarProjectedArtRef:()=>({artRef:''})}});
  resources.choices=()=>Array.from({length:60},(_,i)=>({value:`Car ${i}`,label:`Car ${i}`}));
  resources.car=ref=>{requested.add(ref);return {art:{}};};
  resources.exteriorArtRefs=()=>[];resources.carPreview.drawSprite=()=>true;resources.carPreview.draw=()=>true;
  const doc=normalizeMenuDocument({screens:[{id:'cars',elements:[{id:'showroom',type:'car-showroom',binding:'carRef',maxVisible:4}]}]});
  await resources.prepareScreen(doc,doc.screens[0],{carRef:'Car 9'});
  assert.deepEqual([...requested],['Car 8','Car 9','Car 10','Car 11'],'native fallback is limited to the visible page');
  assert.equal(resources.cars.size,0);
 }finally{globalThis.document=previous;}
});

test('car sheets decode sequentially into one renderer cache, including shared sheets',async()=>{
 const {resetProjectFilesForTests}=await import('../../src/ui/projectFiles.js');
 const previous=globalThis.document,decoded=[];
 globalThis.document={createElement:()=>({getContext:()=>({createImageData(w,h){decoded.push(w);return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}})})};
 resetProjectFilesForTests();
 try{
  for(const [ref,width] of [['sheet-a',1],['sheet-b',2]])saveProjectFile('art',ref,{width,height:1,frames:Array.from({length:3},()=>Array(width).fill('#ffffff'))});
  const editor={},resources=new MenuResources({carEditor:editor});
  const tasks=['sheet-a','sheet-b','sheet-a'].map(ref=>resources.request(`car-art:${ref}`,()=>resources.prepareCarArt(ref)));
  await Promise.all(tasks);
  assert.deepEqual(decoded,[1,1,1,2,2,2],'large pixel sheets must not decode concurrently');
  assert.equal(editor.raceArtSpriteCache.size,6);
  assert.equal(resources.artCache.size,0,'car frames must not be duplicated in the menu cache');
  await resources.prepareCarArt('sheet-a');
  assert.equal(decoded.length,6,'reopening must reuse decoded frames');
 }finally{globalThis.document=previous;resetProjectFilesForTests();}
});

test('missing-thumbnail fallback fetches only four cars, without cockpit or smoke dependencies',async()=>{
 const {resetProjectFilesForTests}=await import('../../src/ui/projectFiles.js');
 const {hydrateServerStorage}=await import('../../src/ui/serverStorage.js');
 const {normalizeMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch,downloads=[];
 const names=Array.from({length:60},(_,i)=>`Car ${String(i).padStart(2,'0')}`);
 const ctx=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 resetProjectFilesForTests();
 globalThis.fetch=async url=>{
  const path=decodeURIComponent(String(url));
  if(path.startsWith('/__storage/'))return {ok:false,status:404,json:async()=>({error:'HTTP 404'})};
  if(path.endsWith('/manifest.json'))return {ok:true,json:async()=>({folders:{cars:Object.fromEntries(names.map(name=>[name,`cars/${name}/document.json`])),art:{'huge-smoke':'art/huge-smoke/document.json'}}})};
  if(path.endsWith('/metadata.json'))return {ok:true,json:async()=>({savedAt:123})};
  if(path.includes('/cars/')&&path.endsWith('/document.json')){
   const name=path.split('/').at(-2);downloads.push(name);
   return {ok:true,json:async()=>({name,art:{smoke:{snow:'huge-smoke'}}})};
  }
  throw Error(`Unexpected asset download: ${path}`);
 };
 try{
  await hydrateServerStorage({folder:'cars'});
  const resources=new MenuResources({carEditor:{normalizeLoadedCarDocument:x=>x,collectRaceCarArtRefs:()=>[],getRaceCarProjectedArtRef:()=>({artRef:''})}});
  resources.carPreview.draw=()=>true;
  const doc=normalizeMenuDocument({screens:[{id:'cars',elements:[{id:'showroom',type:'car-showroom',binding:'carRef',maxVisible:4}]}]});
  const before=resources.choices('cars').map(c=>c.value);
  await resources.prepareScreen(doc,doc.screens[0],{carRef:'Car 09'});
  assert.deepEqual([...downloads].sort(),['Car 08','Car 09','Car 10','Car 11'],'missing thumbnails load only the visible cars');
  assert.equal(resources.cars.size,4);
  assert.equal(resources.errors.size,0);
  assert.deepEqual(resources.choices('cars').map(c=>c.value),before,'downloads must not reshuffle the carousel');
 }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;resetProjectFilesForTests();}
});

test('a lightweight car card defers garage tire artwork without satisfying a later full-art request',async()=>{
 const stock={id:'lightweight-fixture'},calls=[];
 const garage={items:{ready:true,revision:1},revision:2,
  async build(ref,car,options){calls.push({ref,car,options});return {...car};}};
 const resources=new MenuResources({carEditor:{},items:{garage}});
 resources.stockCar=()=>stock;
 assert.equal(resources.car('Lightweight',{prepareExterior:false}),null);
 await Promise.all(resources.pending.values());
 assert.equal(resources.car('Lightweight',{prepareExterior:false})?.id,stock.id);
 assert.equal(resources.car('Lightweight'),null);
 await Promise.all(resources.pending.values());
 assert.equal(resources.car('Lightweight')?.id,stock.id);
 assert.deepEqual(calls.map(c=>c.options),[{hydrateArtwork:false},{hydrateArtwork:true}]);
});

test('picker resolves missing-preview cars before requesting legacy artwork',async()=>{
 const {normalizeMenuDocument}=await import('../../src/menus/MenuDocument.js');
 const {drawMenuScreen}=await import('../../src/menus/MenuRenderer.js');
 const {invalidateProjectCarThumbnail,resetCarPreviewThumbnailsForTests}=await import('../../src/ui/shared/carPreviewThumbnails.js');
 const {modelAssets}=await import('../../src/model3d/ModelAssets.js');
 const ctx=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const names=['Direct native','Alternate loading','Sprite fallback'];
 const cars=[{art:{bodyModel:{ref:'bound model'}}},{art:{}},{art:{}}];
 const requested=[];
 const resources=new MenuResources({carEditor:{getRaceCarProjectedArtRef:()=>({artRef:''})}});
 resources.choices=()=>names.map(value=>({label:value,value}));
 resources.car=(ref,{prepareExterior=true}={})=>{requested.push([ref,prepareExterior]);return cars[names.indexOf(ref)];};
 resources.activeCarVersionPending=ref=>ref==='Alternate loading';
 resources.exteriorArtRefs=()=>[];
 resources.carPreview.drawSprite=()=>true;
 const get=modelAssets.get;modelAssets.get=()=>null;
 try{
  for(const name of names)invalidateProjectCarThumbnail(name);
  const doc=normalizeMenuDocument({screens:[{id:'cars',elements:[{id:'showroom',type:'car-showroom',binding:'carRef',maxVisible:4}]}]});
  drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,doc.screens[0],{carRef:names[0]},{resources});
  assert.deepEqual(requested,[[names[0],false],[names[1],false],[names[2],false],[names[2],true]]);
 }finally{modelAssets.get=get;resetCarPreviewThumbnailsForTests();}
});

test('sprite fallback hydrates only visible exterior refs, not the garage tire sheets',async()=>{
 const stock={id:'sprite-fixture',art:{body:'authored-body'}},builds=[],requested=[];
 const garage={items:{ready:true,revision:1},revision:2,
  async build(ref,car,opts){builds.push(opts);return {...car,art:{...car.art,tires:'actual-fit'}};}};
 const resources=new MenuResources({carEditor:{},items:{garage}});
 resources.stockCar=()=>stock;
 resources.exteriorArtRefs=car=>[car.art.body,car.art.tires].filter(Boolean);
 resources.requestExteriorArt=(_ref,asset)=>requested.push(asset);
 resources.cars.set('Sprite',stock);
 resources.retainShowroomPage([{value:'Sprite'}]);
 assert.equal(resources.car('Sprite'),null);
 await Promise.all(resources.pending.values());
 assert.equal(resources.car('Sprite')?.art.tires,'actual-fit');
 assert.deepEqual(builds,[{hydrateArtwork:false}]);
 assert.deepEqual(requested,['authored-body','actual-fit']);
 resources.retainShowroomPage([{value:'Sprite'}]);
 assert.ok(resources.showroomWanted.has('actual-fit'));
 resources.retainShowroomPage([]);
 assert.equal(resources.car('Sprite'),null);
 await Promise.all(resources.pending.values());
 assert.deepEqual(builds,[{hydrateArtwork:false},{hydrateArtwork:true}]);
});
