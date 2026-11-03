import {test,expect} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createDefaultRace,createDefaultCar} from '../../src/racing/raceData.js';

// A real static HTTP host: no storage API, no decoded-document middleware.
// Unlike the normal test server, this exercises exactly what Pages serves.
let server,origin;
const root=path.resolve('.');
const folders=['levels','art','music','actors','sfx','cutscenes','races','cars','tires','models','menus','doodads','items','fonts'];
const manifest={folders:{}};
const published=new Map();
function add(folder,name,data){
 const pathname=`${folder}/${name}/document.json`;
 (manifest.folders[folder] ||= {})[name]=pathname;
 published.set('/data/server-storage/files/'+pathname,JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(data)).toString('base64')}));
 published.set('/data/server-storage/files/'+pathname.replace('document.json','metadata.json'),JSON.stringify({savedAt:123,version:1}));
}
for(const folder of folders)add(folder,'Published',{kind:folder,marker:42});
add('art','Sheet 50% #',{kind:'pixel-art',width:2,height:2,frames:[['#ff0000','#00ff00','#0000ff','#ffffff']]});
for(const name of ['providence','apron'])add('art',name,{kind:'pixel-art',width:2,height:2,frames:[['#336633','#336633','#336633','#336633']]});
const generatedCarArt=['buse-steeringwheel','ct-steeringwheel','hoodicon','indicator-low-fuel','indicator-turn-left','indicator-turn-right','lefticon','pz-steeringwheel','rearicon','righticon','turnsignal-amber'];
for(const name of generatedCarArt)manifest.folders.art[name]=`art/${name}/document.json`;
for(const name of ['Player','Opponent']){
 const car=createDefaultCar();car.name=name;car.art.body='Sheet 50% #';
 add('cars',name,{schemaVersion:1,kind:'race-car',car});
}
for(const name of ['Menu background','Menu button','Loading background'])add('art',name,{width:1,height:1,frames:[['#ff0000'],['#00ff00']]});
add('actors','Hero',{actor:{artRef:'Sheet 50% #'}});
add('fonts','Tiny font',{fontData:{__chainsawAssetRef:'assets/font.ttf',mime:'font/ttf'}});
published.set('/data/server-storage/files/fonts/Tiny font/assets/font.ttf',Buffer.from([1,2,3]));
const race=createDefaultRace();race.name='Published loop';
add('races','Published loop',{schemaVersion:1,kind:'race-track',race});
add('settings','static-browser-preference',{value:{menuRef:'Published'}});
published.set('/data/server-storage/files/manifest.json',JSON.stringify(manifest));
test.beforeAll(async()=>{
 server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(!url.pathname.startsWith('/published/')){res.writeHead(404);res.end('outside project');return;}
   const file=decodeURIComponent(url.pathname.slice('/published'.length));
   if(file.startsWith('/__storage/')){res.writeHead(404,{'Content-Type':'text/html'});res.end('<html>No API</html>');return;}
   if(file==='/test.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body></body></html>');return;}
   const full=path.resolve(root,'.'+file);
   if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   const body=published.has(file)?published.get(file):await fs.readFile(full);
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('missing');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}/published`;
});
test.afterAll(async()=>{server?.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

test('all editor folders, assets and preferences load below a Pages-style subdirectory',async({page})=>{
 await page.goto(origin+'/test.html');
 const result=await page.evaluate(async()=>{
  const storage=await import('./src/ui/serverStorage.js');
  const project=await import('./src/ui/projectFiles.js');
  const preferences=await import('./src/ui/serverPreferences.js');
  const boot=await storage.bootstrapServerStorage();
  const loaded=[];
  for(const folder of project.PROJECT_FOLDERS){
   const entry=project.listProjectFiles(folder).find(e=>e.name==='Published');
   if(!entry)throw Error('Missing folder '+folder);
   loaded.push((await project.hydrateProjectFilePayload(folder,entry.name)).data.marker);
  }
  await project.hydrateProjectFilePayload('actors','Hero');
  const art=project.loadProjectFile('art','Sheet 50% #').data;
  const font=await project.hydrateProjectFilePayload('fonts','Tiny font');
  const preference=await preferences.loadServerPreferenceAsync('static-browser-preference');
  const save=await storage.saveServerFile('art','Published',{changed:true});
  return {boot,loaded,art,font:font.data.fontData,preference,persisted:save.persisted};
 });
 expect(result.boot.readOnly).toBe(true);expect(result.loaded).toEqual(folders.map(()=>42));
 expect(result.art.frames[0][0]).toBe('#ff0000');expect(result.font).toBe('data:font/ttf;base64,AQID');
 expect(result.preference.menuRef).toBe('Published');expect(result.persisted).toBe(false);
});

test('project browser exposes read-only mode and can open referenced artwork',async({page})=>{
 await page.goto(origin+'/test.html');
 await page.evaluate(async()=>{
  const {openProjectBrowser}=await import('./src/ui/ProjectBrowserModal.js');
  window.picked=null;void openProjectBrowser({fixedFolder:'actors',onPick:result=>{window.picked=result;}});
 });
 await expect(page.locator('.project-browser-title')).toContainText('Read-only');
 await expect(page.getByRole('button',{name:'Rename',exact:true}).first()).toBeDisabled();
 await expect(page.getByRole('button',{name:'Delete',exact:true}).first()).toBeDisabled();
 await page.locator('.project-browser-row[data-name="Hero"]').getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.picked?.name)).toBe('Hero');
 expect(await page.evaluate(async()=>{
  const {loadProjectFile}=await import('./src/ui/projectFiles.js');
  return Boolean(loadProjectFile('art','Sheet 50% #'));
 })).toBe(true);
});

test('race worker loads a compressed published race and packs artwork without Python',async({page})=>{
 await page.goto(origin+'/test.html');
 const result=await page.evaluate(async()=>{
  const {packRaceArtRefsForRuntime}=await import('./src/ui/raceWorldBakeWorker.js');
  const art=await packRaceArtRefsForRuntime(['Sheet 50% #']);
  const messages=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./src/ui/raceWorldBakeWorker.js',location.href),{type:'module'});
   const types=[];const timer=setTimeout(()=>{worker.terminate();reject(Error('Static race worker timed out'));},30000);
   worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(Error(event.message));};
   worker.onmessage=({data})=>{
    types.push(data.type);
    if(data.type==='error'){clearTimeout(timer);worker.terminate();reject(Error(data.error||data.message));}
    if(data.type==='prepared-race'){clearTimeout(timer);worker.terminate();resolve(types);}
   };
   worker.postMessage({id:'static-race',command:'load-race',raceName:'Published loop',includeArtAssets:false});
  });
  return {artCount:art.assets.length,missing:art.missingArtRefs,messages};
 });
 expect(result.artCount).toBe(1);expect(result.missing).toEqual([]);
 expect(result.messages).toContain('prepared-physics');expect(result.messages).toContain('race-document');
});

test('the application can start a published race playtest on a static project host',async({page})=>{
 test.setTimeout(120000);
 await page.goto(origin+'/index.html');
 await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
 await page.evaluate(async()=>{
  const game=window.__game;
  const {hydrateProjectFilePayload}=await import('./src/ui/projectFiles.js');
  const payload=await hydrateProjectFilePayload('races','Published loop');
  game.enterRaceEditor();
  const editor=game.raceEditor;
  if(!editor.applyLoadedRaceDocument(payload.data,{name:'Published loop'}))throw Error('Static race did not open');
  editor.selectedRace.competition.aiDrivers=[];
  editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 });
 await expect.poll(()=>page.evaluate(()=>({running:window.__game.raceEditor.playtestSession?.running,error:window.__game.raceEditor.racePlaytestPreparation?.error,status:window.__game.raceEditor.status,lastFailure:window.__game.raceEditor.lastRaceFailure})),{timeout:60000}).toMatchObject({running:true});
 expect(await page.evaluate(()=>window.__game.raceEditor.currentRaceDocumentName)).toBe('Published loop');
});


test('Race Editor car picker downloads opponents before starting a static-host AI grid',async({page})=>{
 test.setTimeout(120000);
 await page.goto(origin+'/index.html');
 await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/cars/Opponent/document.json',async route=>{await gate;await route.continue();});
 await page.evaluate(async()=>{
  const {hydrateProjectFilePayload}=await import('./src/ui/projectFiles.js');
  const payload=await hydrateProjectFilePayload('races','Published loop');
  const game=window.__game;game.enterRaceEditor();const editor=game.raceEditor;
  editor.applyLoadedRaceDocument(payload.data,{name:'Published loop'});
  editor.selectedRace.competition.carSelection={availableCarIds:['saved-car:Opponent'],category:'any',performanceClass:'any',defaultCarId:'saved-car:Opponent'};
  editor.selectedRace.competition.aiDrivers=Array.from({length:3},(_,index)=>({id:'ai-'+index,name:'Opponent '+index,carId:'saved-car:Opponent',enabled:true,skill:0.6}));
  void editor.openPlaytestCarBrowser();
 });
 await page.locator('.project-browser-row[data-name="Player"]').getByRole('button',{name:'Open',exact:true}).click();
 try{
  await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.status)).toContain('Loading race cars');
  expect(await page.evaluate(()=>Boolean(window.__game.raceEditor.playtestSession?.running))).toBe(false);
 }finally{release();}
 await expect.poll(()=>page.evaluate(()=>({running:window.__game.raceEditor.playtestSession?.running,failure:window.__game.raceEditor.lastRaceFailure})),{timeout:60000}).toMatchObject({running:true});
 const cars=await page.evaluate(()=>window.__game.raceEditor.playtestSession.aiRuntime.map(ai=>({id:ai.carId,art:ai.runtimeCar.art.body})));
 expect(cars).toEqual(Array.from({length:3},()=>({id:'saved-car:Opponent',art:'Sheet 50% #'})));
});

test('project browser shows loading until the static index arrives',async({page})=>{
 await page.goto(origin+'/test.html');
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/server-storage/files/manifest.json',async route=>{await gate;await route.continue();});
 await page.evaluate(async()=>{const {openProjectBrowser}=await import('./src/ui/ProjectBrowserModal.js');void openProjectBrowser({fixedFolder:'levels'});});
 await expect(page.locator('.project-browser-info')).toContainText('Loading');
 release();
 await expect(page.locator('.project-browser-row[data-name="Published"]')).toBeVisible();
 await expect(page.locator('.project-browser-info')).toContainText('1 file');
});

test('project browser can retry a failed static index without reopening',async({page})=>{
 await page.goto(origin+'/test.html');
 let fail=true;
 await page.route('**/data/server-storage/files/manifest.json',async route=>{if(fail)await route.fulfill({status:503,body:'Unavailable'});else await route.continue();});
 await page.evaluate(async()=>{const {openProjectBrowser}=await import('./src/ui/ProjectBrowserModal.js');void openProjectBrowser({fixedFolder:'levels'});});
 await expect(page.locator('.project-browser-info')).toContainText('Could not load project files');
 fail=false;
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.project-browser-row[data-name="Published"]')).toBeVisible();
});

test('live Pages application opens the project browser with published levels',async({page})=>{
 test.skip(!process.env.LIVE_PAGES_URL,'Opt-in deployed-site diagnostic');
 test.setTimeout(180000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.url().includes('__storage')||response.url().endsWith('manifest.json'))console.log('LIVE_STORAGE',response.status(),response.url());});
 await page.goto(process.env.LIVE_PAGES_URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__gameReady,null,{timeout:120000});
 await page.evaluate(()=>window.__game.openProjectBrowserFromTitle());
 await page.getByRole('button',{name:'Levels',exact:true}).click();
 await expect(page.locator('.project-browser-row')).not.toHaveCount(0,{timeout:30000});
 console.log('LIVE_LEVELS',await page.locator('.project-browser-row').count(),'ERRORS',JSON.stringify(errors));
 await expect(page.locator('.project-browser-row')).toHaveCount(13);
 await page.getByRole('button',{name:'Close',exact:true}).first().click();
 await page.evaluate(()=>window.__game.openProjectBrowserFromTitle());
 await page.getByRole('button',{name:'Doodads',exact:true}).click();
 await expect(page.locator('.project-browser-row')).toHaveCount(7,{timeout:30000});
 console.log('LIVE_DOODADS',await page.locator('.project-browser-row').allTextContents());

 await expect(page.locator('.project-browser-title')).toContainText('Read-only');
});


test('generated car dashboard and light artwork packs from the static snapshot',async({page})=>{
 await page.goto(origin+'/test.html');
 const result=await page.evaluate(async refs=>{
  const {packRaceArtRefsForRuntime}=await import('./src/ui/raceWorldBakeWorker.js');
  const packed=await packRaceArtRefsForRuntime(refs);
  return {count:packed.assets.length,missing:packed.missingArtRefs};
 },generatedCarArt);
 expect(result.missing).toEqual([]);
 expect(result.count).toBe(generatedCarArt.length);
});


test('menu playback waits for delayed button artwork and decodes every frame before entry',async({page})=>{
 test.setTimeout(120000);
 await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/art/Menu%20button/document.json',async route=>{await gate;await route.continue();});
 await page.evaluate(()=>{
  window.menuOpenDone=false;window.menuOpenError=null;
  void window.__game.previewMenu({screens:[{id:'splash',backgroundArt:'Menu background',elements:[{id:'start',type:'button',label:'Start',artRef:'Menu button'}]}]},{screenId:'splash'}).then(()=>window.menuOpenDone=true,error=>window.menuOpenError=error.message);
 });
 try{
  await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.pendingScreenEntry)).toBe(true);
  expect(await page.evaluate(()=>window.menuOpenDone)).toBe(false);
 }finally{release();}
 await expect.poll(()=>page.evaluate(()=>({done:window.menuOpenDone,error:window.menuOpenError})),{timeout:60000}).toEqual({done:true,error:null});
 expect(await page.evaluate(()=>[...window.__game.menuPlayer.resources.artCache.keys()].filter(k=>k.startsWith('Menu button:')).length)).toBe(2);
});

test('authored race loading screen stays black while its background downloads',async({page})=>{
 test.setTimeout(120000);
 await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/art/Loading%20background/document.json',async route=>{await gate;await route.continue();});
 await page.evaluate(async()=>{
  const {normalizeMenuDocument}=await import('./src/menus/MenuDocument.js');
  const g=window.__game,e=g.raceEditor;
  g.menuPlayer.flow={document:normalizeMenuDocument({loadingScreen:'loading',screens:[{id:'loading',backgroundArt:'Loading background',elements:[]}]}),parameters:{}};
  window.loadingProbe=document.createElement('canvas');window.loadingProbe.width=640;window.loadingProbe.height=360;
  window.loadingProbeTime=0;e.getNowMs=()=>window.loadingProbeTime;
  e.drawRacePreparationScreen(window.loadingProbe.getContext('2d'),640,360);
  window.loadingProbeTime=500;e.drawRacePreparationScreen(window.loadingProbe.getContext('2d'),640,360);
  window.loadingProbeTime=600;e.drawRacePreparationScreen(window.loadingProbe.getContext('2d'),640,360);
 });
 try{
  expect(await page.evaluate(()=>({ready:window.__game.raceEditor.raceLoadingPresentation.ready,hold:window.__game.raceEditor.raceLoadingEntry.fade.hold,pixel:[...window.loadingProbe.getContext('2d').getImageData(320,180,1,1).data]}))).toEqual({ready:false,hold:true,pixel:[0,0,0,255]});
 }finally{release();}
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.raceLoadingPresentation?.ready),{timeout:60000}).toBe(true);
 expect(await page.evaluate(()=>window.__game.raceEditor.raceLoadingEntry.fade.hold)).toBe(false);
});


test('Studio shows startup status and mobile fullscreen prompt before game modules arrive',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true},configurable:true}));
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/src/game/Game.js',async route=>{await gate;await route.continue();});
 await page.goto(origin+'/index.html',{waitUntil:'commit'});
 try{
  await expect(page.locator('#studio-boot-status')).toHaveText('Loading RTG Studio…');
  await expect(page.getByRole('dialog',{name:'Full screen'})).toBeVisible();
  await expect(page.getByRole('button',{name:'OK',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>Boolean(window.__gameReady))).toBe(false);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
 }finally{release();}
 await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
 await expect(page.locator('#studio-boot')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__game.state),{timeout:60000}).toBe('title');
 await expect(page.getByRole('dialog',{name:'Full screen'})).toHaveCount(0);
});

test('Studio explains startup download failures instead of leaving a blank canvas',async({page})=>{
 await page.route('**/src/game/Game.js',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.goto(origin+'/index.html?hideFullscreenForTesting=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#studio-boot-status')).toContainText('could not load');
 await expect(page.getByRole('button',{name:'Reload',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Boolean(window.__gameReady))).toBe(false);
});


test('Studio paints loading feedback while stylesheets are still downloading',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/*.css',async route=>{await gate;await route.continue();});
 await page.goto(origin+'/index.html?hideFullscreenForTesting=1',{waitUntil:'commit'});
 try{
  await expect(page.locator('#studio-boot-status')).toHaveText('Loading RTG Studio…');
  await expect(page.locator('#studio-boot-status')).toBeVisible();
  // A render-blocking stylesheet prevents these frames from happening.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#studio-boot')).toBeVisible();
 }finally{release();}
 await expect(page.locator('#studio-boot')).toHaveCount(0,{timeout:60000});
});

test('Studio retains loading feedback until game initialization completes',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/src/content/endless.json',async route=>{await gate;await route.continue();});
 await page.goto(origin+'/index.html?hideFullscreenForTesting=1',{waitUntil:'domcontentloaded'});
 try{
  await page.waitForFunction(()=>window.__gameReady,null,{timeout:60000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>window.__game.loading)).toBe(true);
  await expect(page.locator('#studio-boot')).toBeVisible();
 }finally{release();}
 await expect(page.locator('#studio-boot')).toHaveCount(0,{timeout:60000});
});


test('mobile fullscreen dialog remains tappable across portrait and landscape rotation',async({browser})=>{
 const context=await browser.newContext({isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true},configurable:true}));
 try{
  await page.goto(origin+'/index.html',{waitUntil:'commit'});
  const cancel=page.getByRole('button',{name:'Cancel',exact:true});
  await expect(cancel).toBeInViewport();
  await page.setViewportSize({width:844,height:390});
  await expect(cancel).toBeInViewport();
  await cancel.tap();
  await expect(page.getByRole('dialog',{name:'Full screen'})).toHaveCount(0);
  await expect(page.locator('#studio-boot')).toHaveCount(0,{timeout:60000});
  await page.evaluate(()=>{window.touchProbe=0;const game=window.__game;const original=game.handlePointerDown.bind(game);game.handlePointerDown=(...args)=>{window.touchProbe++;return original(...args);};});
  await page.locator('#game').tap({position:{x:20,y:20}});
  await expect.poll(()=>page.evaluate(()=>window.touchProbe)).toBe(1);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>window.__game.viewport.width)).toBe(390);
  await page.locator('#game').tap({position:{x:20,y:20}});
  await expect.poll(()=>page.evaluate(()=>window.touchProbe)).toBe(2);
 }finally{await context.close();}
});
