import {test,expect} from '@playwright/test';
for(const [mode,size] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}],['desktop',{width:1280,height:800}]]){
 test(`car gauge workspace and placement: ${mode}`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize(size);
  if(mode!=='desktop')await page.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile:true}}));
  await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
  await page.evaluate(()=>{const g=window.__game;g.transitionTo('car-editor');g.carEditor.handleMenuAction('car-gauges-interior');g.draw();});
  await page.waitForFunction(()=>window.__game.carEditor.carEditorPreviewPlaytest?.session?.cameraView==='first-person',{},{timeout:90000});
  const result=await page.evaluate(()=>{
   const g=window.__game,e=g.carEditor;g.draw();const b=e.carGaugeViewport,w=e.selectedCar.art.gauges.interior.widgets[0];
   const point={x:b.x+(w.x+w.width/2)*b.w,y:b.y+(w.y+w.height/2)*b.h};
   const before=w.x;e.handlePointerDown(point);e.handlePointerMove({x:point.x+b.w*.06,y:point.y});e.handlePointerUp({x:point.x+b.w*.06,y:point.y});g.draw();
   return {before,after:e.selectedCar.art.gauges.interior.widgets[0].x,enabled:e.selectedCar.art.gauges.interior.enabled,exterior:e.selectedCar.art.gauges.exterior.widgets[0].x,buttons:e.buttons.map(b=>b.id),camera:e.carEditorPreviewPlaytest.session.cameraView};
  });
  expect(result.after).toBeCloseTo(result.before+.06);expect(result.exterior).toBe(result.before);expect(result.enabled).toBe(true);expect(result.camera).toBe('first-person');expect(result.buttons).toContain('gauge-properties');expect(result.buttons).toContain('gauge-font');
  await page.screenshot({path:`test-results/car-gauges-${mode}.png`});
 });
}

test('map gauge properties expose local range and marker styles',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const g=window.__game;g.transitionTo('car-editor');g.carEditor.handleMenuAction('car-gauges-exterior');
  const {editGauge}=await import('/src/ui/CarGaugeEditor.js');void editGauge(g.carEditor);
 });
 await expect(page.getByRole('img',{name:'Background and map drawing area preview'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Choose your car icon artwork',exact:true})).toBeHidden();
 for(const title of ['Background / bezel','Map view / GPS','Road appearance','Your car icon','Other cars icons','Start icon','Finish icon'])await page.locator('summary').filter({hasText:new RegExp('^'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
 for(const name of ['Choose map background artwork','Choose your car icon artwork','Choose other cars icon artwork','Choose start icon artwork','Choose finish icon artwork'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await expect(page.getByLabel('Viewable distance (meters across)',{exact:true})).toBeHidden();
 await page.getByLabel('Map view',{exact:true}).selectOption('local');
 await page.getByLabel('Viewable distance (meters across)',{exact:true}).fill('420');
 await page.getByLabel('Map orientation',{exact:true}).selectOption('heading');
 await page.getByLabel('Local projection',{exact:true}).selectOption('perspective');
 await page.getByLabel('GPS downward viewing angle (degrees)',{exact:true}).fill('35');
 await page.getByLabel('Drawing area left (% of background)',{exact:true}).fill('10');
 await page.getByLabel('Drawing area width (% of background)',{exact:true}).fill('80');
 await page.getByLabel('Roads and icons opacity (%)',{exact:true}).fill('60');
 await page.getByLabel('Other cars icon shape',{exact:true}).selectOption('triangle');
 await page.getByLabel('Route outline width (0 = none)',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 const result=await page.evaluate(()=>window.__game.carEditor.selectedCar.art.gauges.exterior.widgets[0]);
 expect(result.mapOrientation).toBe('heading');expect(result.mapProjection).toBe('perspective');expect(result.mapPitch).toBe(35);expect(result.mapScreenX).toBe(.1);expect(result.mapScreenWidth).toBe(.8);expect(result.mapOpacity).toBe(.6);
 expect(result.mapMode).toBe('local');expect(result.mapRangeM).toBe(420);expect(result.carMarkerShape).toBe('triangle');expect(result.mapLineBorderWidth).toBe(3);
});
