import {test,expect} from '@playwright/test';
test('catalog pilot loads and renders all body angles through the car editor',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');
  const e=g.carEditor;
  const doc=await (await fetch('/data/server-storage/files/cars/2018%20Kestrel%20660/document.json')).json();
  e.applyLoadedCarDocument(doc,{name:'2018 Kestrel 660'});
  const {loadProjectFile}=await import('/src/ui/projectFiles.js');
  const body=loadProjectFile('art',e.selectedCar.art.angleLayers.front.body.artRef);
  return {id:e.selectedCar.id,body:!!body?.data,frames:Object.values(e.selectedCar.art.angleLayers).map(x=>x.body.frameIndex),wheel:e.selectedCar.art.interior.steeringWheel.artRef};
 });
 expect(result.id).toBe('kestrel-660-2018');expect(result.body).toBe(true);expect(new Set(result.frames).size).toBe(8);expect(result.wheel).toBe('steeringwheel');
 await page.screenshot({path:'test-results/catalog-pilot-editor.png'});
});
