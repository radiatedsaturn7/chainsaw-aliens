// Supplemental A/B only. Not imported into release specs or workflows.
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const mode=process.env.THUMB_QA_VARIANT;
if(!['A','B'].includes(mode))throw Error('Set THUMB_QA_VARIANT=A (old) or B (thumbnail)');
const target='Tutsan 2003';
const root=new URL('../../',import.meta.url),store=new URL('data/server-storage/files/',root);
const storage=JSON.parse(fs.readFileSync(new URL('manifest.json',store)));
const thumbPath=new URL('assets/car-previews/manifest.json',root);
const thumbnails=mode==='B'?JSON.parse(fs.readFileSync(thumbPath)):null;
const sha=value=>createHash('sha256').update(value).digest('hex');
const expand=d=>d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;
const identity={},full=new Set();
function walk(node,list){if(!node||typeof node!=='object')return;if(typeof node.artRef==='string')list.add(node.artRef);for(const v of Object.values(node))walk(v,list);}
for(const [name,p] of Object.entries(storage.folders.cars)){
 const bytes=fs.readFileSync(new URL(p,store));
 const car=expand(JSON.parse(bytes)).car;
 const refs=new Set();
 for(const angle of Object.values(car.art?.angleLayers||{})){walk(angle.body,refs);walk(angle.tires,refs);}
 for(const x of ['shell','body','artRef','tires'])if(typeof car.art?.[x]==='string')refs.add(car.art[x]);
 walk(car.art?.tireSurfaces,refs);
 for(const ref of refs)if(storage.folders.art[ref])full.add(storage.folders.art[ref]);
 identity[name]={id:car.id,documentSHA:sha(bytes),refs:[...refs],path:p,dashboard:car.art?.interior?.dashboard?.artRef};
}
const posterPart=new Set(Object.values(thumbnails?.previews||{}).map(x=>x.poster?.url).filter(Boolean));
const atlasPart=new Set(Object.values(thumbnails?.previews||{}).map(x=>x.url));
const staticPrefix='/server-storage/files/';
function classify(url,base){
 const u=new URL(url);
 if(u.origin!==base)return null;
 const path=decodeURIComponent(u.pathname),resource=path.includes(staticPrefix)?path.split(staticPrefix).at(-1):
  path==='/__storage/file'||path==='/.netlify/functions/storage-file'?storage.folders[u.searchParams.get('folder')]?.[u.searchParams.get('name')]:null;
 if(full.has(resource))return {kind:'full-body-tire',path:resource};
 if(resource?.startsWith('art/'))return {kind:'other-full-art',path:resource};
 if(resource?.startsWith('cars/'))return {kind:'car-doc',path:resource};
 if(path.endsWith('/__storage/preview-stock')||path.endsWith('/stock-preview-release.json'))return {kind:'stock-proof',path};
 if(path.includes('/assets/car-previews/')){
  const key='assets/car-previews/'+path.split('/').at(-1);
  return {kind:posterPart.has(key)?'poster':atlasPart.has(key)?'atlas':key.endsWith('/manifest.json')?'preview-manifest':'unknown-preview',path};
 }
 return null;
}
async function newProbe(browser,baseURL,mobile){
 const base=new URL(baseURL).origin;
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile,serviceWorkers:'block'});
 const records=new Map(),jobs=[];
 let phase='boot';
 context.on('request',r=>{const key=classify(r.url(),base);if(key)records.set(r,{...key,phase,method:r.method(),status:null,sizes:null});});
 context.on('requestfinished',r=>{const e=records.get(r);if(e)jobs.push((async()=>{e.status=(await r.response())?.status()??null;try{e.sizes=await r.sizes();}catch{}})());});
 context.on('requestfailed',r=>{const e=records.get(r);if(e)e.failure=r.failure()?.errorText;});
 await context.addInitScript(mobile=>{
  if(mobile)Object.defineProperty(navigator,'userAgentData',{value:{mobile:true}});
  const draw=CanvasRenderingContext2D.prototype.drawImage,byCanvas=new WeakMap(),native=new WeakMap();
  Object.defineProperty(window,'__perfThumbnailDraws',{value:byCanvas});
  Object.defineProperty(window,'__perfNativeDraws',{value:native});
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   const result=draw.call(this,image,...args);
   if(image instanceof HTMLCanvasElement){
    const list=new Set(native.get(image)?.keys()||[]);
    if(image.__raceArtCacheKey)list.add(image.__raceArtCacheKey.split(':')[0]);
    if(list.size){
     let stamps=native.get(this.canvas);if(!stamps){stamps=new Map();native.set(this.canvas,stamps);}
     for(const ref of list)stamps.set(ref,performance.now());
    }
   }
   if(!(image instanceof HTMLImageElement)||args.length!==8)return result;
   const path=new URL(image.currentSrc||image.src).pathname;if(!path.includes('/assets/car-previews/'))return result;
   const [sx,sy,sw,sh,x,y,w,h]=args,m=this.getTransform(),p=m.transformPoint({x,y}),q=m.transformPoint({x:x+w,y:y+h});
   let draws=byCanvas.get(this.canvas);if(!draws){draws=new Map();byCanvas.set(this.canvas,draws);}
   draws.set(path,{image,sx,sy,sw,sh,box:[p.x,p.y,q.x,q.y],opacity:this.globalAlpha,ms:performance.now()});
   return result;
  };
 },mobile);
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 return {context,page,errors,phase(x){phase=x;},
  async snapshot(){
   await Promise.allSettled(jobs);
   const rows=[...records.values()],rollup={};
   for(const r of rows){const key=r.phase+'/'+r.kind,z=rollup[key]??={count:0,finished:0,failed:0,bodyBytes:0,headersBytes:0,unknownBytes:0};
    z.count++;if(r.status!==null)z.finished++;if(r.failure)z.failed++;
    if(r.sizes){z.bodyBytes+=r.sizes.responseBodySize;z.headersBytes+=r.sizes.responseHeadersSize;}else z.unknownBytes++;
   }
   return {rows,rollup};
  }
 };
}
const browserNow=page=>page.evaluate(()=>performance.now());
async function readyPreview(page,name,{selected=false,row=false}={}){
 const key=thumbnails.carsByName[name],entry=thumbnails.previews[key];expect(entry).toBeTruthy();
 expect(entry.carId??key).toBe(identity[name]?.id);
 expect(entry.stockSources.filter(row=>row.folder==='cars').map(row=>row.name)).toEqual([name]);
 expect(entry.carDocumentSha256).toBe(identity[name].documentSHA);
 const poster=selected?null:entry.poster;if(poster){expect(poster.frameIndex).toBe(3);expect(poster.angleDeg).toBe(135);}
 const chosen=poster||entry;
 const disk=fs.readFileSync(new URL(chosen.url,root));expect(disk.length).toBe(chosen.bytes);expect(sha(disk)).toBe(chosen.sha256);
 const request={name,row,selected,path:chosen.url,w:entry.frameWidth,h:entry.frameHeight,count:poster?1:8};
 const value=await page.waitForFunction(({name,row,selected,path,w,h,count})=>{
  const canvas=row?[...document.querySelectorAll('.project-browser-row')].find(e=>e.dataset.name===name)?.querySelector('canvas'):window.__game.canvas;
  if(!canvas||!canvas.isConnected)return null;
  const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1||rect.bottom<=0||rect.top>=innerHeight)return null;
  const key=new URL(path,document.baseURI).pathname,d=window.__perfThumbnailDraws.get(canvas)?.get(key);
  if(!d||d.image.naturalWidth!==w*count||d.image.naturalHeight!==h||d.sw!==w||d.sh!==h||d.sy!==0||d.sx%w!==0||d.sx/w>=count)return null;
  if(!selected&&d.sx!==(count===1?0:3*w))return null;
  const [x,y,x2,y2]=d.box;if(x<0||y<0||x2>canvas.width||y2>canvas.height||x2<=x||y2<=y)return null;
  const sw=Math.ceil(x2)-Math.floor(x),sh=Math.ceil(y2)-Math.floor(y);
  const source=document.createElement('canvas');source.width=w;source.height=h;
  const sc=source.getContext('2d');sc.drawImage(d.image,d.sx,0,w,h,0,0,w,h);
  const expected=sc.getImageData(0,0,w,h).data;
  const actual=canvas.getContext('2d').getImageData(Math.floor(x),Math.floor(y),sw,sh).data;
  let match=0,transparent=0;
  for(let j=3;j<expected.length;j+=4)transparent+=expected[j]<8;
  for(let yy=Math.floor(h*.16);yy<h*.84;yy+=Math.max(1,Math.floor(h/12)))for(let xx=Math.floor(w*.12);xx<w*.88;xx+=Math.max(1,Math.floor(w/14))){
   const j=(yy*w+xx)*4;
   if(expected[j+3]<245||Math.max(expected[j],expected[j+1],expected[j+2])*d.opacity<35)continue;
   const px=Math.floor(x+(xx+.5)*(x2-x)/w)-Math.floor(x),py=Math.floor(y+(yy+.5)*(y2-y)/h)-Math.floor(y),k=(py*sw+px)*4;
   if(actual[k+3]<80||Math.max(actual[k],actual[k+1],actual[k+2])<19)continue;
   if(Math.max(...[0,1,2].map(c=>Math.abs(actual[k+c]-expected[j+c]*d.opacity)))<=Math.max(20,42*d.opacity))match++;
  }
  return transparent>0&&match>=3?{at:performance.now(),drawAt:d.ms,box:d.box,path:key,kind:count===1?'poster':'atlas',frame:count===1?3:d.sx/w,match}:null;
 },request,{timeout:30000});
 return value.jsonValue();
}
const menuState=page=>page.evaluate(async()=>{
 const p=window.__game.menuPlayer,{showroomPage}=await import('/src/menus/MenuGarageWidgets.js');
 const e=p.flow.screen.elements.find(e=>e.type==='car-showroom');
 const choices=p.resources.choices('cars',p.flow.document,p.flow.parameters);
 const shown=showroomPage(choices,p.flow.parameters[e.binding],e.maxVisible);
 return {name:p.flow.parameters[e.binding],page:shown.start,index:shown.index,max:e.maxVisible,visible:shown.entries.map(e=>e.value),total:choices.length};
});
async function legacyCarsReady(page,name,{save=false}={}){
 // Passive inspection only: do not invoke car(), sprite resolver, or a loader from QA.
 await page.waitForFunction(({name,save,refs})=>{
  const g=window.__game,p=g.menuPlayer,c=g.carEditor,r=p.resources;
  const car=r.cars.get(name);
  const slot=save?p.flow.screen.elements.some(e=>e.type==='car-preview'&&e.assetRef===name):p.flow.parameters.carRef===name;
  const stamps=window.__perfNativeDraws.get(g.canvas);
  const frames=refs.some(ref=>performance.now()-(stamps?.get(ref)??-1e6)<1500);
  return !!slot&&!!car&&frames&&!r.pending.size&&!p.pendingScreenEntry&&!p.screenTransition.active;
 },{name,save,refs:identity[name].refs},{timeout:30000});
 return {at:await browserNow(page),kind:'passive-native-draw'};
}
async function next(page,mobile){
 if(!mobile){await page.keyboard.press('ArrowRight');return;}
 const point=await page.evaluate(async()=>{
  const g=window.__game,p=g.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='car-showroom');
  const {menuElementBounds}=await import('/src/menus/MenuRenderer.js'),{menuElementPose}=await import('/src/menus/MenuDocument.js');
  const b=menuElementBounds(e,p.bounds,menuElementPose(e,p.flow.time)),c=g.canvas,r=c.getBoundingClientRect();
  return {x:r.x+(b.x+b.w*.75)*r.width/c.width,y:r.y+(b.y+b.h-12)*r.height/c.height};
 });
 await page.touchscreen.tap(point.x,point.y);
}
async function exportProof(info,probe,metrics){
 const net=await probe.snapshot();
 if(mode==='B')expect(net.rows.filter(r=>r.kind==='full-body-tire'&&r.phase!=='confirmed-open')).toEqual([]);
 expect(probe.errors).toEqual([]);
 await info.attach('cold-thumbnail-telemetry',{body:Buffer.from(JSON.stringify({schema:1,variant:mode,metrics,network:net},null,2)),contentType:'application/json'});
}
for(const mobile of [false,true])test(`thumbnail cold Select Car and true page-turn ${mobile?'handheld':'desktop'}`,async({browser,baseURL},info)=>{
 const p=await newProbe(browser,baseURL,mobile),{page}=p;
 try{
  p.phase('showroom-first-open');const begin=await browserNow(page);
  await page.evaluate(async()=>{const g=window.__game,{createMenuDocument}=await import('/src/menus/MenuDocument.js');g.setDisplayMode('color');await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'cars'});});
  await page.waitForFunction(()=>!window.__game.menuPlayer.pendingScreenEntry&&!window.__game.menuPlayer.screenTransition.active);
  const initial=await menuState(page);expect(initial.page).toBe(0);expect(initial.index).toBe(0);
  const first=await (mode==='B'?readyPreview(page,initial.name,{selected:true}):legacyCarsReady(page,initial.name));
  await page.screenshot({path:info.outputPath('showroom-initial.png')});
  p.phase('showroom-page-turn');let state=initial,lastTurn;
  while(state.page===initial.page){
   const previous=state;lastTurn=await browserNow(page);await next(page,mobile);
   await expect.poll(async()=>(await menuState(page)).index).toBe(previous.index+1);
   state=await menuState(page);
  }
  expect(state.page).toBe(initial.visible.length);expect(state.visible).toContain(state.name);
  const later=await (mode==='B'?readyPreview(page,state.name,{selected:true}):legacyCarsReady(page,state.name));
  await page.screenshot({path:info.outputPath('showroom-page-turn.png')});
  await exportProof(info,p,{mobile,firstMs:first.at-begin,pageTurnMs:later.at-lastTurn,first,later,initial,state});
 }finally{await p.context.close();}
});

for(const kind of ['load','save-as'])test(`thumbnail cold editor Cars ${kind}`,async({browser,baseURL},info)=>{
 const p=await newProbe(browser,baseURL,false),{page}=p;
 try{
  p.phase('editor-list');const start=await browserNow(page);
  await page.evaluate(async kind=>{
   const {openProjectBrowser}=await import('/src/ui/ProjectBrowserModal.js');
   window.__perfModalResult=null;
   void openProjectBrowser({fixedFolder:'cars',mode:kind==='save-as'?'saveAs':'open'}).then(x=>{window.__perfModalResult=x;});
  },kind);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByPlaceholder('Search in folder...').fill(target);
  const row=page.locator('.project-browser-row').filter({hasText:target});
  await expect(row).toHaveCount(1);await expect(row).toBeVisible();
  const ready=mode==='B'?await readyPreview(page,target,{row:true}):null;
  const listedAt=await browserNow(page);
  await page.screenshot({path:info.outputPath('editor-list.png')});
  if(kind==='load'){
   p.phase('confirmed-open');
   await row.getByRole('button',{name:'Open',exact:true}).click();
   const payload=await (await page.waitForFunction(()=>window.__perfModalResult,{},{timeout:30000})).jsonValue();
   expect(payload.folder).toBe('cars');expect(payload.name).toBe(target);
   expect(payload.payload.data.car.id).toBe(identity[target].id);
   expect(payload.payload.data.car.art.angleLayers.front.body.artRef).toBe('catalog-tutsan-2003-body');
   const net=await p.snapshot();
   expect(net.rows.filter(r=>r.phase==='confirmed-open'&&r.status===200).map(r=>r.path)).toEqual(expect.arrayContaining([
    storage.folders.art['catalog-tutsan-2003-body'],storage.folders.art['catalog-tutsan-2003-wheels']
   ]));
  }else{
   // This only exercises the real browse/Save As chooser; do not persist a file.
   await expect(row.getByRole('button',{name:'Overwrite',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Close',exact:true}).click();
  }
  await exportProof(info,p,{kind,listedMs:listedAt-start,thumbnailMs:ready?ready.at-start:null,ready});
 }finally{await p.context.close();}
});

for(const version of ['recent','legacy'])test(`thumbnail cold campaign ${version} fixture save row`,async({browser,baseURL},info)=>{
 const p=await newProbe(browser,baseURL,false),{page}=p;
 try{
  p.phase('campaign-save-list');const at=await browserNow(page);
  const fixture=await page.evaluate(async ({version,target})=>{
   const g=window.__game,{CampaignSaves,CAMPAIGN_SAVE_KEY}=await import('/src/menus/CampaignSaves.js'),{createMenuDocument}=await import('/src/menus/MenuDocument.js');
   const fakeProgress={selectedGameCar:target};let mockWrites=0;
   const saves=new CampaignSaves({menuProgress:{}},{
    now:()=>1900000000000,
    load:async key=>key===CAMPAIGN_SAVE_KEY?(version==='recent'?{version:1,slots:[{savedAt:1900000000000,progress:fakeProgress,items:{},summary:{car:target,condition:90}},null,null]}:null)
       :key==='menu-progress'?fakeProgress:{},
    save:async()=>{mockWrites++;return {ok:true};}
   });
   await saves.load();g.campaignSaves=saves;
   g.setDisplayMode('color');await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'splash'});
   g.menuPlayer.showSaveSlots('start'); // actual slot renderer; no persisted data or Continue
   return {summary:saves.describeSlot(0),mockWrites};
  },{version,target});
  expect(fixture.summary.car).toBe(target);expect(fixture.mockWrites).toBe(version==='legacy'?1:0);
  const ready=await (mode==='B'?readyPreview(page,target):legacyCarsReady(page,target,{save:true}));
  await page.screenshot({path:info.outputPath('campaign-row.png')});
  await exportProof(info,p,{version,readyMs:ready.at-at,ready,fixture});
 }finally{await p.context.close();}
});
