import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:1280,height:720}])test(`cut indicator sheet and place gauge at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);
 await page.route('**/indicator-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('/indicator-harness');
 await page.evaluate(async()=>{
  const {editCarIndicator}=await import('/src/ui/CarIndicatorEditor.js');const {openEditorForm}=await import('/src/ui/shared/editorForm.js');
  const image=document.createElement('canvas');image.width=128;image.height=64;const ctx=image.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,64,64);ctx.fillStyle='blue';ctx.fillRect(64,0,64,64);
  window.indicatorEditor={selectedCar:{art:{}},activeAction:'car-gauges-exterior',captureRaceHistory(){},invalidateCarEditorPreviewFrame(){},syncCarAnglePreviewArt(){}};
  window.cutPromise=editCarIndicator(window.indicatorEditor,null,openEditorForm,async()=>({action:'open',name:'Test sheet'}),async()=>image);
 });
 const dialog=page.getByRole('dialog',{name:'Cut indicator',exact:true});await expect(dialog).toBeVisible();
 const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.width).toBeLessThanOrEqual(viewport.width);
 await dialog.getByRole('button',{name:'Choose indicator artwork sheet',exact:true}).click();
 const canvas=dialog.getByRole('img',{name:'Drag a rectangle around one indicator',exact:true});const b=await canvas.boundingBox();
 await page.mouse.move(b.x+b.width*.55,b.y+b.height*.25);await page.mouse.down();await page.mouse.move(b.x+b.width*.85,b.y+b.height*.7,{steps:4});await page.mouse.up();
 expect(Number(await dialog.getByLabel('x (sheet pixels)',{exact:true}).inputValue())).toBeGreaterThan(64);
 await dialog.getByLabel('Indicator name',{exact:true}).fill('Engine warning');
 await dialog.getByRole('button',{name:'Apply',exact:true}).click();
 const cut=await page.evaluate(()=>window.indicatorEditor.selectedCar.art.indicators[0]);expect(cut.source).toBe('enginelight');expect(cut.crop.width).toBeGreaterThan(1);
 await page.evaluate(async()=>{const {addGaugeIndicator}=await import('/src/ui/CarGaugeEditor.js');window.addPromise=addGaugeIndicator(window.indicatorEditor);});
 await page.getByRole('dialog',{name:'Add indicator',exact:true}).getByRole('button',{name:'Apply',exact:true}).click();
 const gauge=await page.evaluate(()=>window.indicatorEditor.selectedCar.art.gauges.exterior.widgets.at(-1));expect(gauge.artCrop).toEqual(cut.crop);expect(gauge.artRef).toBe('Test sheet');expect(gauge.source).toBe('enginelight');
});
