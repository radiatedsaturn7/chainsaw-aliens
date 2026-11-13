import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
const catalogCases=[['Moonpetal GT 2000','moonpetal-2000'],['Foxmint 1.7 2000','foxmint-2000'],['Hazel S 2011','hazel-2011'],['Primrose ST 2005','primrose-st-2005'],['Bluebell GT 2006','bluebell-gt-2006'],['Chicory GT 2008','chicory-gt-2008'],['Mallow S 2006','mallow-s-2006'],['Firethorn Turbo 2005','firethorn-turbo-2005'],['Copperhead SC 2006','copperhead-sc-2006'],['Snowdrop T5 2008','snowdrop-t5-2008'],['Aster 170 2003','aster-170-2003'],['Foxglove Z 2003','foxglove-z-2003'],['Ironbloom GT 2005','ironbloom-gt-2005'],['Starwort 2005','starwort-2005'],['Bellflower 2006','bellflower-2006'],['Redbud V6 2007','redbud-v6-2007'],['Boxelder 2005','boxelder-2005'],['Stonepod 2006','stonepod-2006'],['Clover Sport 2007','clover-2007'],['Sorrel 133 2008','sorrel-2008'],['Buttoncap Turbo 2003','buttoncap-2003'],['Cubby 1.8 2014','cubby-2014'],['Sunmallow 2006','sunmallow-2006'],['Copperwing 2004','copperwing-2004'],['Dewskipper 2004','dewskipper-2004'],['Podmoss 2005','podmoss-2005'],['Glasswing 1990','glasswing-1990'],['Quince 2014','quince-2014'],['Mossling 2019','mossling-2019'],['Cicada Turbo 2015','cicada-turbo-2015'],['Nettle Turbo 2017','nettle-turbo-2017'],['Marigold 1991','marigold-1991'],['Glimmer 1986','glimmer-1986'],['Rosefinch 1991','rosefinch-1991'],['Larch Turbo 1995','larch-turbo-1995'],['Vesper V6 2003','vesper-v6-2003'],['Bramble 2021','bramble-2021'],['Sundew 660 1991','sundew-660-1991'],['Pipit 100 2007','pipit-100-2007'],['Cairn 1974','cairn-1974'],['Ashbaron 1987','ashbaron-1987'],['Gossamer 2005','gossamer-2005'],['Stormline 2002','stormline-2002'],['Rotorveil 1993','rotorveil-1993'],['STI Airslayer','sti-airslayer'],['RTG-S','rtg-s'],['Cinder Si 1991','cinder-si-1991'],['Lark 1600 1990','lark-1600-1990'],['Sunstriker GT 1994','sunstriker-gt-1994'],['Briar XT 2004','briar-xt-2004'],['Nightcoil GT 1995','nightcoil-gt-1995'],['Ember Pod Prototype','ember-pod'],['2024 Sentinel Sedan','sentinel-sedan-2024'],['Trailglass 2024','trailglass-2024'],['2018 Kestrel 660','kestrel-660-2018'],['2005 Flint Coupe','flint-coupe-2005'],['2024 Caravan-9','caravan-9-2024'],['2023 Volt-Hound GT','volt-hound-gt-2023'],['Dustjack V8','dustjack-v8']].filter(([name])=>existsSync(`data/server-storage/files/cars/${name}/document.json`));
for(const [carName,carId] of catalogCases){

test(`${carName} actual editor preview composites exterior/cockpit and advances production physics`,async({page},testInfo)=>{
 test.setTimeout(180_000);
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async(carName)=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
  const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');
  const e=g.carEditor,payload=await hydrateProjectFilePayload('cars',carName,{forceRefresh:true});
  if(!payload?.data)throw Error('Missing published catalog car');
  e.applyLoadedCarDocument(payload.data,{name:carName});
  e.activeRootId='art';e.activeAction='car-art-exterior';e.carArtActiveComponent='body';e.closeEditorMenus();
  // Hydrate every vehicle reference, including actual tire textures, not just body art.
  const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)refs.add(v.artRef);Object.values(v).forEach(walk);};walk(e.selectedCar.art);
  for(const ref of refs)await e.hydrateRaceArt(ref);
  e.syncCarAnglePreviewArt();e.invalidateCarEditorPreviewFrame();g.draw();
 },carName);
 await page.waitForFunction(carId=>{
  const e=window.__game.carEditor,p=e.carEditorPreviewPlaytest;
  return p?.session?.runtimeCar?.id===carId&&e.carEditorPreviewFrameCache?.canvas&&!p.session.startupFramePending;
 },carId,{timeout:120_000});
 const initial=await page.evaluate(()=>{
  const s=window.__game.carEditor.carEditorPreviewPlaytest.session;
  return {x:s.worldX,z:s.worldZ,elapsed:Number(s.elapsedMs||0)};
 });
 // The real editor autoplays its production RaceSimulation/VehicleDynamicsRunner
 // preview. Never substitute a synthetic physics fixture or mutate race documents.
 await expect.poll(()=>page.evaluate(()=>{
  const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest?.session;
  if(e.carEditorPreviewRuntimeFailureMessage)throw Error(e.carEditorPreviewRuntimeFailureMessage);
  return Math.abs(Number(s?.speedMps||0));
 }),{timeout:30_000}).toBeGreaterThan(.25);
 await page.waitForTimeout(2000);
 const physics=await page.evaluate(()=>{
  const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest.session;
  return {id:s.runtimeCar.id,x:s.worldX,z:s.worldZ,speed:s.speedMps,rpm:s.engineRpm,elapsed:s.elapsedMs,failure:e.carEditorPreviewRuntimeFailureMessage||'',running:s.running};
 });
 expect(physics.id).toBe(carId);expect(physics.failure).toBe('');expect(physics.running).not.toBe(false);
 for(const v of [physics.x,physics.z,physics.speed,physics.rpm])expect(Number.isFinite(v)).toBe(true);
 expect(Math.hypot(physics.x-initial.x,physics.z-initial.z)).toBeGreaterThan(.05);
 await testInfo.attach('production-preview-physics',{body:Buffer.from(JSON.stringify({initial,physics},null,2)),contentType:'application/json'});
 // Freeze only after the real motion smoke has passed. Keep the production
 // drawing/compositing path, but prevent time/position changes between angles.
 const frozenPose=await page.evaluate(()=>{
  const e=window.__game.carEditor;
  e.updateCarEditorPreviewPlaytest=()=>{};
  const s=e.carEditorPreviewPlaytest.session;
  return {x:s.worldX,z:s.worldZ,yaw:s.carYaw,elapsed:s.elapsedMs,distance:s.distance,speed:s.speedMps};
 });
 await testInfo.attach('frozen-preview-pose',{body:Buffer.from(JSON.stringify(frozenPose,null,2)),contentType:'application/json'});
 for(const slot of ['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft']){
  await page.evaluate(slot=>{const g=window.__game,e=g.carEditor;e.selectedCarShellFrameSlot=slot;e.activeAction='car-art-exterior';e.syncCarAnglePreviewArt();e.invalidateCarEditorPreviewFrame();g.draw();},slot);
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>{const s=window.__game.carEditor.carEditorPreviewPlaytest.session;return {x:s.worldX,z:s.worldZ,yaw:s.carYaw,elapsed:s.elapsedMs,distance:s.distance,speed:s.speedMps};})).toEqual(frozenPose);
  const screenshot=await page.screenshot({path:testInfo.outputPath(`actual-preview-${slot}.png`)});
  await testInfo.attach(`actual-preview-${slot}`,{body:screenshot,contentType:'image/png'});
 }
 // Prove the production cockpit compositor draws both authored layers, not its
 // fallback rectangles/wheel. Draw through that compositor and inspect output.
 const cockpit=await page.evaluate(()=>{
  const e=window.__game.carEditor,c=document.createElement('canvas');c.width=960;c.height=540;
  const ctx=c.getContext('2d'),original=ctx.drawImage.bind(ctx),calls=[];
  ctx.drawImage=(image,...args)=>{calls.push({width:image.width,height:image.height,args});return original(image,...args);};
  e.drawCarInteriorLayers(ctx,{x:0,y:0,w:960,h:540},e.selectedCar,{rotation:.25});
  const p=ctx.getImageData(0,0,960,540).data;let visible=0,clear=0;for(let i=3;i<p.length;i+=4){if(p[i])visible++;else clear++;}
  return {calls,visible,clear,png:c.toDataURL('image/png').split(',')[1]};
 });
 await testInfo.attach('production-cockpit-composite',{body:Buffer.from(cockpit.png,'base64'),contentType:'image/png'});delete cockpit.png;
 expect(cockpit.calls).toHaveLength(2);expect(cockpit.visible).toBeGreaterThan(1000);expect(cockpit.clear).toBeGreaterThan(1000);
 await page.evaluate(()=>{const g=window.__game,e=g.carEditor;e.activeAction='car-art-interior';e.carEditorPreviewPlaytest.input.cameraView='first-person';e.carEditorPreviewPlaytest.session.cameraView='first-person';e.invalidateCarEditorPreviewFrame();g.draw();});
 await page.waitForTimeout(200);
 await testInfo.attach('actual-preview-cockpit',{body:await page.screenshot({path:testInfo.outputPath('actual-preview-cockpit.png')}),contentType:'image/png'});
 await testInfo.attach('cockpit-compositing-calls',{body:Buffer.from(JSON.stringify(cockpit,null,2)),contentType:'application/json'});
 // Screenshots require human placement review. This asserts loading/compositing
 // and basic motion only, not calibrated acceleration or subjective alignment.
});

}
