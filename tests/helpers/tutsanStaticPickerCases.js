import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {confirmPicker,pickerState,selectCatalogTarget} from './carCatalogBoundedPickerSetup.js';
import {catalogArtPath,catalogCar,expectThumbnailOnCanvas,installThumbnailBrowseWitness,isCatalogArtRequest} from './carThumbnailBrowseWitness.js';
const chaseCar='Tutsan 2003',raceName='Demo Track';

for(const mobile of [false,true])test(`Tutsan ${mobile?'handheld touch':'desktop keyboard'} static picker initial page, later page, cockpit and real input drive`,async({browser},info)=>{
 test.setTimeout(360000);
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});if(mobile)await context.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true}}));const qa=await installThumbnailBrowseWitness(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const menuReady=()=>page.waitForFunction(()=>{const p=window.__game.menuPlayer;return !p.screenTransition.active&&!p.pendingScreenEntry&&!p.flow?.busy&&p.resources.pending.size===0;},{},{timeout:90000});
 await page.evaluate(async raceName=>{
  const g=window.__game;g.setDisplayMode('color');
  const {createMenuDocument}=await import('/src/menus/MenuDocument.js');
  const menu=createMenuDocument();
  // This test menu chooses an existing solo fixture on confirmation.
  // Real menu action -> race travel, not direct car/editor hydration or physics injection.
  menu.screens.find(s=>s.id==='cars').elements.find(e=>e.type==='car-showroom').action={type:'race',target:raceName};
  await g.menuPlayer.open(menu,{preview:true,screenId:'cars'});
 },raceName);
 await menuReady();
 const first=await pickerState(page);expect(first.start).toBe(0);expect(first.visible).toContain(first.selected);
 first.thumbnail=await expectThumbnailOnCanvas(page,qa,first.selected);
 const targetIndex=first.choices.indexOf(chaseCar);expect(targetIndex).toBeGreaterThan(3);
 await page.screenshot({path:info.outputPath('picker-initial.png')});
 await selectCatalogTarget(page,{targetName:chaseCar,mobile,menuReady,info,thumbnailQA:qa});
 const later=await pickerState(page);expect(later.selected).toBe(chaseCar);expect(later.start).toBeGreaterThan(0);expect(later.visible).toContain(chaseCar);expect(later.errors).toEqual([]);
 later.thumbnail=await expectThumbnailOnCanvas(page,qa,chaseCar);
 const loadedCars=await page.evaluate(()=>window.__game.menuPlayer.resources.cars.size);
 expect(loadedCars).toBeLessThan(first.choices.length);
 qa.assertBrowseCold();
 await page.screenshot({path:info.outputPath('picker-later.png')});fs.writeFileSync(info.outputPath('picker.json'),JSON.stringify({first,later,loadedCars},null,2));
 const catalog=catalogCar(chaseCar);
 expect(catalog.id).toBe('tutsan-2003');
 const body='catalog-tutsan-2003-body', wheels='catalog-tutsan-2003-wheels',dash='catalog-tutsan-2003-dashboard';
 expect(catalog.exterior).toEqual(expect.arrayContaining([body,wheels]));expect(catalog.all).toContain(dash);
 let release;const waitForRelease=new Promise(resolve=>release=resolve);
 let matchingRequest=false;
 await context.route(url=>isCatalogArtRequest(url.href,body),async route=>{matchingRequest=true;await waitForRelease;await route.continue();});
 try {
  qa.choose();
  await confirmPicker(page,mobile,chaseCar);
  await expect.poll(()=>matchingRequest,{timeout:90000}).toBe(true);
  await page.waitForFunction(()=>{const g=window.__game,e=g.raceEditor;return !e.playtestSession?.running&&e.playtestSession?.preparing===true&&e.racePlaytestPreparation?.raceName==='Demo Track';},{},{timeout:90000});
  await page.screenshot({path:info.outputPath('confirm-loading.png')});
 }finally{release();}
 await page.waitForFunction(()=>{const s=window.__game.raceEditor.playtestSession;return s?.running&&!s.startupFramePending&&s.countdownRemainingMs<=0;},{},{timeout:90000});
 qa.assertBrowseCold();
 expect(qa.requested.filter(x=>x.choosing).map(x=>x.path)).toEqual(expect.arrayContaining([catalogArtPath(body),catalogArtPath(wheels)]));
 expect(qa.loaded).toEqual(expect.arrayContaining([catalogArtPath(body),catalogArtPath(wheels),catalogArtPath(dash)]));
 await expect.poll(()=>page.evaluate(async ({body,wheels,dash})=>{
  const e=window.__game.raceEditor;
  const refs=e.collectRaceCarArtRefs(e.playtestSession.runtimeCar);
  return [body,wheels,dash].every(ref=>{
   const canvas=e.racePreparedArtFrames.get(`${ref}:frame:0`);
   if(!refs.includes(ref)||!canvas||canvas.width<=0||canvas.height<=0)return false;
   const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return rgba.some((value,index)=>index%4===3&&value>32);
  });
 },{body,wheels,dash}),{timeout:90000}).toBe(true);
 const sample=()=>page.evaluate(()=>{const e=window.__game.raceEditor,s=e.playtestSession;return {id:s.runtimeCar.id,x:s.worldX,z:s.worldZ,speed:s.speedMps,rpm:s.engineRpm,gear:s.gear,elapsed:s.elapsedMs,throttle:e.raceInput.throttleAxis,camera:s.cameraView};});await page.evaluate(()=>{const e=window.__game.raceEditor;e.raceInput.cameraView='third-person';e.playtestSession.cameraView='third-person';});const initial=await sample();expect(initial.id).toBe('tutsan-2003');expect(initial.camera).toBe('third-person');
 let cdp;if(mobile){await page.screenshot({path:info.outputPath('before-touch.png')});const pt=await page.evaluate(()=>{const e=window.__game.raceEditor,b=e.buttons.find(b=>b.playtestControl==='go').bounds;const c=window.__game.canvas,r=c.getBoundingClientRect();return {x:r.x+(b.x+b.w/2)*r.width/c.width,y:r.y+(b.y+b.h/2)*r.height/c.height};});cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pt,id:1}]});}else await page.keyboard.down('KeyG');
 await expect.poll(async()=>Math.abs((await sample()).speed),{timeout:30000}).toBeGreaterThan(2);await page.waitForTimeout(1800);const moving=await sample();expect(Math.hypot(moving.x-initial.x,moving.z-initial.z)).toBeGreaterThan(2);expect(moving.rpm).toBeGreaterThan(800);await page.screenshot({path:info.outputPath('moving-exterior.png')});
 await page.evaluate(()=>{const e=window.__game.raceEditor;e.raceInput.cameraView='first-person';e.playtestSession.cameraView='first-person';});await page.waitForTimeout(1500);const cockpit=await sample();await page.screenshot({path:info.outputPath('moving-cockpit.png')});expect(cockpit.camera).toBe('first-person');expect(cockpit.elapsed).toBeGreaterThan(moving.elapsed);expect(cockpit.rpm).not.toBe(initial.rpm);
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('KeyG');
 fs.writeFileSync(info.outputPath('motion.json'),JSON.stringify({mobile,initial,moving,cockpit,errors},null,2));await info.attach('motion',{body:Buffer.from(JSON.stringify({mobile,initial,moving,cockpit,errors},null,2)),contentType:'application/json'});expect(errors).toEqual([]);await context.close();
});
