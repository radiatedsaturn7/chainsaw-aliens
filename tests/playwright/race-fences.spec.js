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
    e.handleMenuAction('race-ground-mode-doodad');
    g.draw();
    const click=(id)=>{g.draw();const button=e.buttons.find(b=>b.id===id);if(!button)throw new Error(`${id} not visible`);button.onClick();g.draw();};
    click('paint-category'); click('paint-kind-fence');
    click('paint-tools'); click('draw-fence');
    await e.openRaceGroundTexture(async()=>({artRef:'providenceGround',repeatM:3}));
    g.draw();
    const b=e.raceMapBounds;
    if(!b) throw new Error('No map bounds');
    for(const p of [{x:b.x+b.w*.3,y:b.y+b.h*.35},{x:b.x+b.w*.5,y:b.y+b.h*.5},{x:b.x+b.w*.65,y:b.y+b.h*.65},{x:b.x+b.w*.35,y:b.y+b.h*.8}]) {
      e.beginRaceFenceDrag(p);
      for(let i=0;i<50;i++)e.updateRaceFenceDrag({x:p.x+i*.01,y:p.y});
      e.finishRaceFenceDrag(p);
    }
    click('paint-tools');click('fence-select');
    const fence=e.getEditableRaceFence();
    const node=fence.fencePath.points[1];
    const screen=e.raceMapWorldToScreenPoint({x:node.x,y:node.z},b);
    if(!e.beginRaceFenceNodeDrag({x:screen.screenX,y:screen.screenY})) throw new Error('Cannot grab fence node');
    e.updateRaceFenceNodeDrag({x:screen.screenX+18,y:screen.screenY-12}); e.raceFenceNodeDrag=null;
    const pathPoints=e.getEditableRaceFence().fencePath.points.length;
    const count=e.selectedRace.scenery.length;
    const payload=JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument()));
    const fenceId=e.activeRaceFenceId;
    e.applyLoadedRaceDocument(payload); e.selectRacePaintCategory('fence'); e.activeRaceFenceId=fenceId; e.activeAction='fence-select'; g.draw();
    const renderer=e.getRaceThreeWorldRenderer(390,400);
    if(!e.addRaceThreeDoodads(renderer)) throw new Error('Fence mesh missing');
    const drawCalls=renderer.dynamicDoodadDrawCalls;
    const {createRaceStaticColliderWorld}=await import('/src/racing/RaceSimulation.js');
    const authority={}; createRaceStaticColliderWorld(e,{authority,worldBake:{},runtimeType:e.getSelectedRaceRuntimeType(),routeLength:e.getRaceRouteLength()});
    return {count,pathPoints,drawCalls,restored:e.selectedRace.scenery.length,ground:e.getRaceTileMapCell(-999,-999).artRef,
      boxes:authority.staticColliderDefinitions.filter(p=>p.source?.startsWith('scenery:')).length,
      buttons:e.buttons.map(b=>b.id),bounds:b};
  });
  console.log('FENCE',JSON.stringify(result));
  expect(result.pathPoints).toBe(4); expect(result.drawCalls).toBe(1);
  expect(result.count).toBeGreaterThan(1); expect(result.restored).toBe(result.count);
  expect(result.boxes).toBe(result.count); expect(result.ground).toBe('providenceGround');
  await page.screenshot({path:`test-results/fence-map-${mobile}.png`});
  await page.evaluate(()=>{const g=window.__game;g.raceEditor.racePortraitHotMenu='paint-category';g.draw();});
  await page.screenshot({path:`test-results/paint-categories-${mobile}.png`});
  expect(errors).toEqual([]);
});

test('terrain decals use sloped world geometry and real GPU depth occlusion', async({page})=>{
  await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
  const result=await page.evaluate(async()=>{
    const g=window.__game,e=g.raceEditor;
    const THREE=await import('/src/vendorBridge/three.js');
    const renderer=e.getRaceThreeWorldRenderer(128,128);
    e.clearRaceThreeScene(renderer);
    e.getRaceSurfaceModel=()=>({sampleWorld:({x})=>({elevation:x*.02})});
    e.selectedRace.decals=[{id:'depth-test',kind:'decal',artRef:'test',x:0,z:0,widthM:8,heightM:8}];
    const texture=new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1);texture.needsUpdate=true;
    e.getRaceThreeTexture=()=>texture;e.getRaceArtSpriteCanvas=()=>({width:1,height:1});
    e.syncRaceThreeDecals(renderer);
    const decal=renderer.decalGroup.children[0];
    const ys=Array.from(decal.geometry.attributes.position.array).filter((_,i)=>i%3===1);
    renderer.camera.position.set(0,15,0);renderer.camera.up.set(0,0,-1);renderer.camera.lookAt(0,0,0);renderer.camera.updateProjectionMatrix();
    const target=new THREE.WebGLRenderTarget(128,128);
    const center=()=>{renderer.threeRenderer.setRenderTarget(target);renderer.threeRenderer.render(renderer.scene,renderer.camera);const pixel=new Uint8Array(4);renderer.threeRenderer.readRenderTargetPixels(target,64,64,1,1,pixel);return [...pixel];};
    const before=center();
    const blocker=new THREE.Mesh(new THREE.BoxGeometry(4,1,4),new THREE.MeshBasicMaterial({color:0x00ff00}));
    blocker.position.y=3;renderer.scene.add(blocker);
    const after=center();renderer.threeRenderer.setRenderTarget(null);target.dispose();
    return {before,after,range:Math.max(...ys)-Math.min(...ys),depthTest:decal.material.depthTest};
  });
  expect(result.depthTest).toBe(true);expect(result.range).toBeGreaterThan(1);
  expect(result.before[0]).toBeGreaterThan(200);expect(result.before[1]).toBeLessThan(20);
  expect(result.after[1]).toBeGreaterThan(200);expect(result.after[0]).toBeLessThan(20);
});
