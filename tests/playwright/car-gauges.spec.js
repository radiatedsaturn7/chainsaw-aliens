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
   return {previewAspect:b.w/b.h,renderAspect:e.carEditorPreviewFrameCache.w/e.carEditorPreviewFrameCache.h,expected:e.getCarEditorGaugePreviewLayout(b).renderBounds,renderSize:{w:e.carEditorPreviewFrameCache.w,h:e.carEditorPreviewFrameCache.h},before,after:e.selectedCar.art.gauges.interior.widgets[0].x,enabled:e.selectedCar.art.gauges.interior.enabled,exterior:e.selectedCar.art.gauges.exterior.widgets[0].x,buttons:e.buttons.map(b=>b.id),camera:e.carEditorPreviewPlaytest.session.cameraView};
  });
  expect(result.previewAspect).toBeCloseTo(result.renderAspect,6);expect(result.renderSize).toEqual({w:Math.round(result.expected.w),h:Math.round(result.expected.h)});
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
 await page.getByLabel('Drawing area left (% of background)',{exact:true}).evaluate(el=>{el.value='10';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByLabel('Drawing area width (% of background)',{exact:true}).evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByLabel('Roads and icons opacity (%)',{exact:true}).fill('60');
 await page.getByLabel('Other cars icon shape',{exact:true}).selectOption('triangle');
 await page.getByLabel('Route outline width (0 = none)',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 const result=await page.evaluate(()=>window.__game.carEditor.selectedCar.art.gauges.exterior.widgets[0]);
 expect(result.mapOrientation).toBe('heading');expect(result.mapProjection).toBe('perspective');expect(result.mapPitch).toBe(35);expect(result.mapScreenX).toBe(.1);expect(result.mapScreenWidth).toBe(.8);expect(result.mapOpacity).toBe(.6);
 expect(result.mapMode).toBe('local');expect(result.mapRangeM).toBe(420);expect(result.carMarkerShape).toBe('triangle');expect(result.mapLineBorderWidth).toBe(3);
});

test('tachometer properties preview and save car-based scale, ticks and number styling',async({page})=>{
 await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');const {enterCarGauges,editGauge}=await import('/src/ui/CarGaugeEditor.js');
  const e=new RaceEditor({},{mode:'car'});window.__tachEditor=e;enterCarGauges(e,'interior');e.carGaugeId=e.selectedCar.art.gauges.interior.widgets.find(g=>g.source==='rpm').id;void editGauge(e);
 });
 await expect(page.getByLabel('rpm.max — car rev limiter',{exact:true})).toBeVisible();
 await expect(page.getByLabel('rpm.redline — car engine redline',{exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'Tachometer preview'})).toBeVisible();
 await expect(page.getByLabel('Use car rev limiter for maximum RPM',{exact:true})).toBeChecked();
 await page.getByLabel('Use car engine redline for danger RPM',{exact:true}).uncheck();
 await page.getByLabel('Custom danger starts at RPM',{exact:true}).fill('6800');
 await page.locator('summary').filter({hasText:'Tachometer — ticks'}).click();
 await page.getByLabel('Major ticks every (RPM)',{exact:true}).fill('1000');
 await page.getByLabel('Minor ticks every (RPM, 0 = off)',{exact:true}).fill('100');
 await page.locator('summary').filter({hasText:'Tachometer — number labels'}).click();
 await page.getByLabel('Interval number font',{exact:true}).selectOption('system:serif');
 await page.getByLabel('Number font size value',{exact:true}).fill('14');
 await page.getByLabel('Number font weight value',{exact:true}).fill('700');
 await page.getByLabel('Italic numbers',{exact:true}).check();
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Gauge properties'})).toBeHidden();
 const t=await page.evaluate(()=>window.__tachEditor.selectedCar.art.gauges.interior.widgets.find(g=>g.source==='rpm').tachometer);
 expect(t.autoScale).toBe(true);expect(t.autoRedline).toBe(false);expect(t.redline).toBe(6800);expect(t.majorInterval).toBe(1000);expect(t.minorInterval).toBe(100);expect(t.font.fontFamily).toBe('serif');expect(t.font.fontSize).toBe(14);expect(t.font.fontWeight).toBe(700);expect(t.font.fontItalic).toBe(true);
});

test('transparent RPM ticks reveal the dashboard and filled arcs leave a dark remainder',async({page})=>{
 await page.goto('/index.html?hideFullscreenForTesting');
 const result=await page.evaluate(async()=>{
  const {normalizeGauge}=await import('/src/racing/CarGauges.js'),{drawTachometerFace}=await import('/src/racing/TachometerFace.js');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=220;const ctx=canvas.getContext('2d');
  const g=normalizeGauge({source:'rpm',format:'dial',startAngle:0,sweepAngle:180,tachometer:{displayMode:'fill',radius:.8,arcWidth:20,majorCutout:true,majorInterval:2000,majorLength:.3,majorWidth:6,minorInterval:0,showLabels:false,safeColor:'#ffffff',dangerColor:'#ff0000',darkColor:'#252525'}});
  const render=value=>{ctx.fillStyle='#123456';ctx.fillRect(0,0,220,220);drawTachometerFace(ctx,{x:10,y:10,w:200,h:200},g,{tuning:{redlineRpm:6000,revLimitRpm:8000}},{getArt:()=>null,font:()=>'',text:()=>{},value});};
  const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data),at=degrees=>pixel(Math.round(110+80*Math.cos(degrees*Math.PI/180)),Math.round(110+80*Math.sin(degrees*Math.PI/180)));
  render(8000);const full={cutout:at(90),safe:at(22.5),danger:at(157.5),background:pixel(20,20)};
  render(4000);return {full,partial:{safe:at(22.5),dark:at(157.5),cutout:at(90)}};
 });
 expect(result.full.cutout).toEqual([18,52,86,255]);expect(result.full.background).toEqual([18,52,86,255]);expect(result.full.safe).toEqual([255,255,255,255]);expect(result.full.danger).toEqual([255,0,0,255]);expect(result.partial.safe).toEqual([255,255,255,255]);expect(result.partial.dark).toEqual([37,37,37,255]);expect(result.partial.cutout).toEqual([18,52,86,255]);
});
