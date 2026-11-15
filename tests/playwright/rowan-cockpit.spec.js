import {test,expect,devices} from '@playwright/test';
import {decodePng} from '../../scripts/car-catalog-import.mjs';
for(const viewport of [{width:1280,height:720},{width:390,height:844}])test.describe(`Rowan viewport ${viewport.width}`,()=>{
 test.use({...(viewport.width<500?{userAgent:devices['iPhone 13'].userAgent}:{}),viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
 test(`Rowan driving cockpit ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async()=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');const e=g.carEditor,p=await hydrateProjectFilePayload('cars','Rowan 53 2004',{forceRefresh:true});e.applyLoadedCarDocument(p.data,{name:'Rowan 53 2004'});
  const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)refs.add(v.artRef);Object.values(v).forEach(walk);};walk(e.selectedCar.art);for(const r of refs)await e.hydrateRaceArt(r);
  e.activeRootId='art';e.activeAction='car-art-interior';e.closeEditorMenus();e.invalidateCarEditorPreviewFrame();g.draw();
 });
 await page.waitForFunction(()=>{const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest?.session;return s?.runtimeCar?.id==='rowan-53-2004'&&!s.startupFramePending&&s.speedMps>.25;},null,{timeout:90000});
 await page.evaluate(()=>{const g=window.__game,e=g.carEditor;e.carEditorPreviewPlaytest.input.cameraView='first-person';e.carEditorPreviewPlaytest.session.cameraView='first-person';e.invalidateCarEditorPreviewFrame();g.draw();});
 await page.waitForTimeout(500);const state=await page.evaluate(()=>{const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest.session;return {mobile:Boolean(window.__game.deviceIsMobile||window.__game.isMobile),id:s.runtimeCar.id,view:s.cameraView,speed:s.speedMps,rpm:s.engineRpm,failure:e.carEditorPreviewRuntimeFailureMessage||'',gaugeSources:e.selectedCar.art.gauges.interior.widgets.map(g=>g.source),dashboard:e.selectedCar.art.interior.dashboard.artRef,wheel:e.selectedCar.art.interior.steeringWheel.artRef};});
 expect(state.mobile).toBe(viewport.width<500);expect(state.id).toBe('rowan-53-2004');expect(state.view).toBe('first-person');expect(state.failure).toBe('');expect(state.dashboard).toBe('catalog-rowan-53-2004-dashboard');expect(state.wheel).toBe('steeringwheel');expect(Number.isFinite(state.rpm)).toBe(true);expect(state.gaugeSources).toEqual(['speed','rpm','gear','fuel']);
 await testInfo.attach('driving-state',{body:Buffer.from(JSON.stringify(state)),contentType:'application/json'});await expect(async()=>{
 await page.evaluate(()=>window.__game.draw());
 const path=testInfo.outputPath(`rowan-driving-${viewport.width}.png`);await page.screenshot({path});const im=decodePng(path);let lit=0;
 for(let y=Math.floor(im.height*.2);y<im.height*.4;y++)for(let x=Math.floor(im.width*.2);x<im.width*.8;x++){const i=(y*im.width+x)*4;if(im.data[i]+im.data[i+1]+im.data[i+2]>100)lit++;}
 expect(lit,'driving viewport must contain rendered scene pixels, not a blank canvas').toBeGreaterThan(im.width*im.height*.01);
 }).toPass({timeout:20000,intervals:[1000]});
});

});
