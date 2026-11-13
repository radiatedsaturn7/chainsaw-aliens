import fs from 'node:fs';
import {test,expect}from'@playwright/test';
for(const [name,id]of [['Cubby 1.8 2014','cubby-2014'],['Sunmallow 2006','sunmallow-2006'],['Copperwing 2004','copperwing-2004'],['Podmoss 2005','podmoss-2005'],['Glasswing 1990','glasswing-1990'],['Quince 2014','quince-2014'],['Mossling 2019','mossling-2019']])for(const viewport of [{width:1280,height:720},{width:390,height:844}])test(`${id} preserved cockpit ${viewport.width}`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async({name,viewport})=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');const {cockpitGaugeBounds,cockpitDashboardRect,cockpitWheelLayout}=await import('/src/racing/CarCockpitLayout.js');const {drawCarGauges}=await import('/src/racing/CarGauges.js');
  const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');const e=g.carEditor,p=await hydrateProjectFilePayload('cars',name,{forceRefresh:true});e.applyLoadedCarDocument(p.data,{name});const car=e.selectedCar;
  const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)refs.add(v.artRef);Object.values(v).forEach(walk);};walk(car.art);for(const ref of refs)await e.hydrateRaceArt(ref);
  const c=document.createElement('canvas');c.width=viewport.width;c.height=viewport.height;const ctx=c.getContext('2d'),b={x:0,y:0,w:c.width,h:c.height};ctx.fillStyle='#354a56';ctx.fillRect(0,0,c.width,c.height);e.drawCarInteriorLayers(ctx,b,car,{layer:'dashboard'});
  const dash=e.getRaceArtSpriteCanvas(car.art.interior.dashboard.artRef),state={car,session:{speedMps:25,engineRpm:3200,gear:3},gear:3};const regions=drawCarGauges(ctx,cockpitGaugeBounds(b,car,dash),car.art.gauges?.interior||{},state,{getArt:ref=>e.getRaceArtSpriteCanvas(ref)});
  e.drawCarInteriorLayers(ctx,b,car,{layer:'wheel',rotation:0});const rect=cockpitDashboardRect(b,car.art.interior.dashboard,dash),wheel=cockpitWheelLayout(b,car.art.interior.steeringWheel,rect);return{id:car.id,regions,wheel,png:c.toDataURL('image/png').split(',')[1]};
 },{name,viewport});expect(result.wheel.width).toBeCloseTo(Math.max(34,Math.min(viewport.width,viewport.height)*.13)*2*1.6875,5);const path=info.outputPath('preserved-cockpit.png');fs.writeFileSync(path,Buffer.from(result.png,'base64'));await info.attach('preserved-cockpit',{path,contentType:'image/png'});
});
