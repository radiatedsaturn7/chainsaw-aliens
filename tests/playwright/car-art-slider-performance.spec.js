import {test,expect} from '@playwright/test';

test('dragging body scale keeps the live preview session and canvas',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady && window.__game?.state!=='loading');
  await page.evaluate(()=>window.__game.enterCarEditor());
  await page.waitForFunction(()=>window.__game.carEditor.carEditorPreviewPlaytest?.session);
  await page.evaluate(async()=>{
    const {upsertCachedProjectFile}=await import('/src/ui/serverStorage.js');
    upsertCachedProjectFile('art','Slider Performance Art',JSON.stringify({folder:'art',name:'Slider Performance Art',savedAt:1,
      data:{width:8,height:8,frames:[Array(64).fill('#ee5500')]}}));
    const editor=window.__game.carEditor;editor.activeRootId='art';editor.activeAction='car-art-exterior';editor.carArtActiveComponent='body';
    editor.closeEditorMenus();editor.setCarAngleArt('body','front','Slider Performance Art');
  });
  await page.waitForFunction(()=>{
    const e=window.__game.carEditor;
    return e.carEditorPreviewPlaytest?.tuningRevision===e.getCarEditorPreviewTuningRevision()
      && e.carEditorPreviewFrameCache?.canvas && e.carArtSliderRegions.some(region=>region.id==='body-x');
  });
  const track=await page.evaluate(()=>{
    const e=window.__game.carEditor;window.scaleSession=e.carEditorPreviewPlaytest.session;window.scaleCanvas=e.carEditorPreviewFrameCache.canvas;
    const region=e.carArtSliderRegions.find(region=>region.id==='body-x');return {x:region.track.x,y:region.track.y,w:region.track.w,h:region.track.h};
  });
  await page.mouse.move(track.x+track.w*0.2,track.y+track.h/2);await page.mouse.down();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.carEditor.carArtSliderDrag))).toBe(true);
  await page.mouse.move(track.x+track.w*0.8,track.y+track.h/2,{steps:40});
  await page.mouse.move(track.x+track.w*0.4,track.y+track.h/2,{steps:40});await page.mouse.up();
  // Wait beyond the old three-second physics-restart debounce.
  await page.waitForTimeout(3400);
  expect(await page.evaluate(()=>{
    const e=window.__game.carEditor;return {
      sessionReused:e.carEditorPreviewPlaytest.session===window.scaleSession,
      canvasReused:e.carEditorPreviewFrameCache.canvas===window.scaleCanvas,
      scale:e.carEditorPreviewPlaytest.session.runtimeCar.art.angleLayers.front.body.transforms.bodyScaleX,
      selected:e.selectedCar.art.angleLayers.front.body.transforms.bodyScaleX
    };
  })).toMatchObject({sessionReused:true,canvasReused:true});
  expect(await page.evaluate(()=>{
    const e=window.__game.carEditor;return e.carEditorPreviewPlaytest.session.runtimeCar.art.angleLayers.front.body.transforms.bodyScaleX
      ===e.selectedCar.art.angleLayers.front.body.transforms.bodyScaleX;
  })).toBe(true);
});
