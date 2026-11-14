import {test,expect,devices} from '@playwright/test';
for(const viewport of [{width:1280,height:720},{width:390,height:844}])test.describe(`Saffron viewport ${viewport.width}`,()=>{
 test.use({...(viewport.width<500?{userAgent:devices['iPhone 13'].userAgent}:{}),viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
 test(`Saffron driving cockpit ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async()=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');const e=g.carEditor,p=await hydrateProjectFilePayload('cars','Saffron 135 2010',{forceRefresh:true});e.applyLoadedCarDocument(p.data,{name:'Saffron 135 2010'});
  const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)refs.add(v.artRef);Object.values(v).forEach(walk);};walk(e.selectedCar.art);for(const r of refs)await e.hydrateRaceArt(r);
  e.activeRootId='art';e.activeAction='car-art-interior';e.closeEditorMenus();e.invalidateCarEditorPreviewFrame();g.draw();
 });
 await page.waitForFunction(()=>{const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest?.session;return s?.runtimeCar?.id==='saffron-135-2010'&&!s.startupFramePending&&s.speedMps>.25;},null,{timeout:90000});
 await page.evaluate(()=>{const g=window.__game,e=g.carEditor;e.carEditorPreviewPlaytest.input.cameraView='first-person';e.carEditorPreviewPlaytest.session.cameraView='first-person';e.invalidateCarEditorPreviewFrame();g.draw();});
 await page.waitForTimeout(500);const state=await page.evaluate(()=>{const e=window.__game.carEditor,s=e.carEditorPreviewPlaytest.session;return {mobile:Boolean(window.__game.deviceIsMobile||window.__game.isMobile),id:s.runtimeCar.id,view:s.cameraView,speed:s.speedMps,rpm:s.engineRpm,failure:e.carEditorPreviewRuntimeFailureMessage||'',dashboard:e.selectedCar.art.interior.dashboard.artRef,wheel:e.selectedCar.art.interior.steeringWheel.artRef};});
 expect(state.mobile).toBe(viewport.width<500);expect(state.id).toBe('saffron-135-2010');expect(state.view).toBe('first-person');expect(state.failure).toBe('');expect(state.dashboard).toBe('catalog-saffron-135-2010-dashboard');expect(state.wheel).toBe('steeringwheel');expect(Number.isFinite(state.rpm)).toBe(true);
 await testInfo.attach('driving-state',{body:Buffer.from(JSON.stringify(state)),contentType:'application/json'});await page.screenshot({path:testInfo.outputPath(`saffron-driving-${viewport.width}.png`)});
});

});
