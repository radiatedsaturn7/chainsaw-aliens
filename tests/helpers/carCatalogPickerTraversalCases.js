import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {pickerState,settlePicker,stepPicker} from './carCatalogBoundedPickerSetup.js';
const root=new URL('../../data/server-storage/files/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
const expectedIds=new Map(Object.entries(manifest.folders.cars).map(([name,path])=>{
 let d=JSON.parse(fs.readFileSync(new URL(path,root)));if(d.__chainsawStorage)d=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));
 return [name,d.car.id];
}));
for(const mobile of [false,true])test(`catalog complete first-to-last picker traversal and wrap ${mobile?'handheld touch':'desktop keyboard'}`,async({browser},info)=>{
 test.setTimeout(600000);
 const started=Date.now(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
 try{
  if(mobile)await context.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  const menuReady=()=>page.waitForFunction(()=>{const p=window.__game.menuPlayer;return !p.screenTransition.active&&!p.pendingScreenEntry&&!p.flow?.busy&&p.resources.pending.size===0;},{},{timeout:90000});
  await page.evaluate(async()=>{const g=window.__game;g.setDisplayMode('color');const {createMenuDocument}=await import('/src/menus/MenuDocument.js');await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'cars'});});
  await settlePicker(page,menuReady);
  const first=await pickerState(page);expect(first.index).toBe(0);expect(first.start).toBe(0);expect(first.visible).toContain(first.selected);expect(first.ready).toBe(true);expect(first.carId).toBe(expectedIds.get(first.selected));
  const size=Math.max(1,Math.min(4,Math.round(first.maximum))),total=first.choices.length;expect(total).toBeGreaterThan(size);
  const checkpoints=[first];let events=0;
  await page.screenshot({path:info.outputPath('traversal-first.png')});
  for(let i=1;i<total;i++){
   await stepPicker(page,mobile,menuReady,1);events++;
   const s=await pickerState(page);expect(s.selected).toBe(first.choices[i]);expect(s.index).toBe(i);expect(s.errors).toEqual([]);
   if(i===size||i===total-1){
    await expect.poll(async()=>{const p=await pickerState(page);return {id:p.carId,ready:p.ready};},{timeout:90000}).toEqual({id:expectedIds.get(first.choices[i]),ready:true});
    const p=await pickerState(page);expect(p.start).toBe(Math.floor(i/size)*size);expect(p.visible).toContain(p.selected);checkpoints.push(p);
    await page.screenshot({path:info.outputPath(i===size?'traversal-later.png':'traversal-last.png')});
   }
  }
  const last=await pickerState(page);expect(last.visible.length).toBe(total-last.start);
  await stepPicker(page,mobile,menuReady,1);events++;
  await expect.poll(async()=>{const s=await pickerState(page);return {name:s.selected,id:s.carId,ready:s.ready};},{timeout:90000}).toEqual({name:first.choices[0],id:expectedIds.get(first.choices[0]),ready:true});
  await stepPicker(page,mobile,menuReady,-1);events++;
  await expect.poll(async()=>{const s=await pickerState(page);return {name:s.selected,id:s.carId,ready:s.ready};},{timeout:90000}).toEqual({name:first.choices.at(-1),id:expectedIds.get(first.choices.at(-1)),ready:true});
  expect(errors).toEqual([]);
  await info.attach('full-picker-traversal',{body:Buffer.from(JSON.stringify({mobile,total,events,elapsedMs:Date.now()-started,checkpoints,errors})),contentType:'application/json'});
 }finally{await context.close();}
});
