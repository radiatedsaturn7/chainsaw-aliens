import { test, expect } from '@playwright/test';
for (const mobile of [false, true]) test(`${mobile ? 'portrait' : 'desktop'} fence authoring and default ground`, async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize(mobile ? {width:390,height:844} : {width:1280,height:800});
  await page.addInitScript(mobile => Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile}}),mobile);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/index.html'); await page.waitForFunction(()=>window.__gameReady);
  await page.evaluate(async()=>{
    const g=window.__game; g.enterDoodadEditor();
    const e=g.doodadEditor;
    const { hydrateProjectFilePayload }=await import('/src/ui/projectFiles.js');
    e.loadDoodadDocument(await hydrateProjectFilePayload('doodads','tree'),'tree');
    e.doodad.widthM=4; e.doodad.heightM=5;
    e.doodad.isFence=false;
    e.mobileRootId='artwork'; e.landscapeRootId='artwork';
    g.draw();
    const toggle=e.buttons.find(b=>b.id==='fence-toggle');
    if(!toggle) throw new Error('Fence toggle is missing from artwork panel');
    toggle.onClick();
    if(!e.doodad.artRef) throw new Error('Saved tree art missing');
    await e.hydrateDoodadArt(e.doodad.artRef);
    g.draw();
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path:`test-results/fence-preview-${mobile}.png`});
  expect(await page.evaluate(()=>window.__game.doodadEditor.doodad.isFence)).toBe(true);
  const result=await page.evaluate(async()=>{
    const g=window.__game; g.enterRaceEditor(); const e=g.raceEditor;
    e.selectedRace.scenery=[];
    const definition=structuredClone(g.doodadEditor.doodad);
    e.getSelectedRaceDoodad=()=>definition;
    e.handleMenuAction('draw-fence');
    await e.openRaceGroundTexture(async()=>({artRef:'providenceGround',repeatM:3}));
    g.draw();
    const b=e.raceMapBounds;
    if(!b) throw new Error('No map bounds');
    e.beginRaceFenceDrag({x:b.x+b.w*.3,y:b.y+b.h*.35});
    e.updateRaceFenceDrag({x:b.x+b.w*.5,y:b.y+b.h*.5});
    e.finishRaceFenceDrag({x:b.x+b.w*.65,y:b.y+b.h*.65});
    const count=e.selectedRace.scenery.length;
    const payload=JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument()));
    e.applyLoadedRaceDocument(payload); g.draw();
    const {createRaceStaticColliderWorld}=await import('/src/racing/RaceSimulation.js');
    const authority={}; createRaceStaticColliderWorld(e,{authority,worldBake:{},runtimeType:e.getSelectedRaceRuntimeType(),routeLength:e.getRaceRouteLength()});
    return {count,restored:e.selectedRace.scenery.length,ground:e.getRaceTileMapCell(-999,-999).artRef,
      boxes:authority.staticColliderDefinitions.filter(p=>p.source?.startsWith('scenery:')).length,
      buttons:e.buttons.map(b=>b.id),bounds:b};
  });
  console.log('FENCE',JSON.stringify(result));
  expect(result.count).toBeGreaterThan(1); expect(result.restored).toBe(result.count);
  expect(result.boxes).toBe(result.count); expect(result.ground).toBe('providenceGround');
  await page.screenshot({path:`test-results/fence-map-${mobile}.png`});
  expect(errors).toEqual([]);
});
