import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {cockpitAnchors} from '../../scripts/car-catalog-cockpit.mjs';
const cases=Object.keys(cockpitAnchors).map(id=>[id,JSON.parse(fs.readFileSync(`assets/car-catalog/${id}/import.json`)).car.name]);
for(const viewport of [{width:1280,height:720},{width:390,height:844}])test(`authored cockpit renderer ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
 test.setTimeout(300000);await page.setViewportSize(viewport);await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 for(const [id,name] of cases){
  const result=await page.evaluate(async({id,name,viewport})=>{
   const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');const {cockpitDashboardRect,cockpitWheelLayout,cockpitGaugeBounds}=await import('/src/racing/CarCockpitLayout.js');const {drawCarGauges,gaugeFont,gaugeText,gaugeValue}=await import('/src/racing/CarGauges.js');
   const game=window.__game;game.enterCarEditor();game.setDisplayMode('color');const e=game.carEditor,payload=await hydrateProjectFilePayload('cars',name,{forceRefresh:true});if(!payload?.data)throw Error('Missing '+name);e.applyLoadedCarDocument(payload.data,{name});
   const car=e.selectedCar;for(const ref of [car.art.interior.dashboard.artRef,'steeringwheel'])await e.hydrateRaceArt(ref);
   const c=document.createElement('canvas');c.width=viewport.width;c.height=viewport.height;const ctx=c.getContext('2d'),b={x:0,y:0,w:c.width,h:c.height};ctx.fillStyle='#354a56';ctx.fillRect(0,0,c.width,c.height);
   const dashboard=e.getRaceArtSpriteCanvas(car.art.interior.dashboard.artRef),rect=cockpitDashboardRect(b,car.art.interior.dashboard,dashboard),wheel=cockpitWheelLayout(b,car.art.interior.steeringWheel,rect);
   e.drawCarInteriorLayers(ctx,b,car,{layer:'dashboard'});
   const gaugeBounds=cockpitGaugeBounds(b,car,dashboard),state={car,session:{speedMps:100,engineRpm:10000,gear:2,tractionBattery:{stateOfCharge:.42,batteryPowerW:-120000}},gear:2};
   const regions=drawCarGauges(ctx,gaugeBounds,car.art.gauges.interior,state,{getArt:ref=>e.getRaceArtSpriteCanvas(ref)});
   const textMetrics=car.art.gauges.interior.widgets.filter(g=>g.showValue!==false).map(g=>{ctx.font=gaugeFont(g,gaugeBounds.h/300);const value=gaugeValue(g,state),text=gaugeText(g,value,state);return {source:g.source,value,text,width:ctx.measureText(text).width,available:g.width*gaugeBounds.w};});
   e.drawCarInteriorLayers(ctx,b,car,{layer:'wheel',rotation:0});
   return {id:car.id,coordinateSpace:car.art.gauges.interior.coordinateSpace,rect,wheel,regions,textMetrics,png:c.toDataURL('image/png').split(',')[1]};
  },{id,name,viewport});
  expect(result.id).toBe(id);expect(result.coordinateSpace).toBe(cockpitAnchors[id].wheelOpening?'wheel-opening':'dashboard');expect(result.regions).toHaveLength(4);for(const t of result.textMetrics)expect(t.width).toBeLessThanOrEqual(t.available);
  if(id==='volt-hound-gt-2023'){expect(result.textMetrics.find(t=>t.source==='tractionBattery.powerKw').value).toBe(-120);}
  const a=cockpitAnchors[id],r=result.rect;expect(result.wheel.x).toBeCloseTo(r.x+r.w*a.wheel[0]/a.size[0],6);expect(result.wheel.y).toBeCloseTo(r.y+r.h*a.wheel[1]/a.size[1],6);
  for(const g of result.regions){if(a.wheelOpening)continue;expect(g.y).toBeGreaterThanOrEqual(r.y+r.h*a.cluster[1]/a.size[1]-1e-6);expect(g.y+g.h).toBeLessThanOrEqual(r.y+r.h*(a.cluster[1]+a.cluster[3])/a.size[1]+1e-6);expect(g.x).toBeGreaterThanOrEqual(r.x+r.w*a.cluster[0]/a.size[0]-1e-6);expect(g.x+g.w).toBeLessThanOrEqual(r.x+r.w*(a.cluster[0]+a.cluster[2])/a.size[0]+1e-6);}
  fs.mkdirSync(testInfo.outputPath(),{recursive:true});const screenshotPath=testInfo.outputPath(`${id}-${viewport.width}-production-cockpit.png`);fs.writeFileSync(screenshotPath,Buffer.from(result.png,'base64'));await testInfo.attach(`${id}-${viewport.width}-production-cockpit`,{path:screenshotPath,contentType:'image/png'});
  // This is the actual compositor with live numeric widget code, against a plain
  // QA backdrop. It does not substitute for the separate driving-preview test.
 }
});
