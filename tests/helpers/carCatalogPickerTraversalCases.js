import {test,expect} from '@playwright/test';
import {catalogCar,expectThumbnailOnCanvas,installThumbnailBrowseWitness} from './carThumbnailBrowseWitness.js';
import {pickerState,settlePicker,stepPicker} from './carCatalogBoundedPickerSetup.js';
for(const mobile of [false,true])test(`catalog complete first-to-last picker traversal and wrap ${mobile?'handheld touch':'desktop keyboard'}`,async({browser},info)=>{
 test.setTimeout(600000);
 const started=Date.now(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 try{
  if(mobile)await context.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true}}));
  const qa=await installThumbnailBrowseWitness(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  const menuReady=()=>page.waitForFunction(()=>{const p=window.__game.menuPlayer;return !p.screenTransition.active&&!p.pendingScreenEntry&&!p.flow?.busy&&p.resources.pending.size===0;},{},{timeout:90000});
  await page.evaluate(async()=>{const g=window.__game;g.setDisplayMode('color');const {createMenuDocument}=await import('/src/menus/MenuDocument.js');await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'cars'});});
  await settlePicker(page,menuReady);
  const first=await pickerState(page);expect(first.index).toBe(0);expect(first.start).toBe(0);expect(first.visible).toContain(first.selected);expect(catalogCar(first.selected)?.id).toBeTruthy();first.thumbnail=await expectThumbnailOnCanvas(page,qa,first.selected);
  const size=Math.max(1,Math.min(4,Math.round(first.maximum))),total=first.choices.length;expect(total).toBeGreaterThan(size);expect(total).toBeGreaterThanOrEqual(635);expect(new Set(first.choices).size).toBe(total);
  const checkpoints=[first];let events=0;
  await page.screenshot({path:info.outputPath('traversal-first.png')});
  for(let i=1;i<total;i++){
   await stepPicker(page,mobile,menuReady,1);events++;
   const s=await pickerState(page);expect(s.selected).toBe(first.choices[i]);expect(s.index).toBe(i);expect(s.errors).toEqual([]);
   if(i===size||i===total-1){
    const p=await pickerState(page);expect(p.start).toBe(Math.floor(i/size)*size);expect(p.visible).toContain(p.selected);
    p.thumbnail=await expectThumbnailOnCanvas(page,qa,p.selected);checkpoints.push(p);
    await page.screenshot({path:info.outputPath(i===size?'traversal-later.png':'traversal-last.png')});
   }
  }
  const last=await pickerState(page);expect(last.visible.length).toBe(total-last.start);
  await stepPicker(page,mobile,menuReady,1);events++;
  expect((await pickerState(page)).selected).toBe(first.choices[0]);
  await expectThumbnailOnCanvas(page,qa,first.choices[0]);
  await stepPicker(page,mobile,menuReady,-1);events++;
  expect((await pickerState(page)).selected).toBe(first.choices.at(-1));
  await expectThumbnailOnCanvas(page,qa,first.choices.at(-1));
  expect(events).toBe(total+1);
  qa.assertBrowseCold();
  expect(errors).toEqual([]);
  await info.attach('full-picker-traversal',{body:Buffer.from(JSON.stringify({mobile,total,events,elapsedMs:Date.now()-started,checkpoints,errors})),contentType:'application/json'});
 }finally{await context.close();}
});
