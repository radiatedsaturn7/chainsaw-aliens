import {test,expect} from '@playwright/test';
for(const [mode,size] of [['portrait',{width:390,height:844}],['desktop',{width:1280,height:800}]]){
 test(`FX can be placed on the live car preview from the Art root: ${mode}`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize(size);
  if(mode==='portrait')await page.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile:true}}));
  await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
  await page.evaluate(async()=>{
   const {addCarFx}=await import('/src/ui/CarFxEditor.js');
   const {saveProjectFile}=await import('/src/ui/projectFiles.js');
   saveProjectFile('art','fx-placement-test',{width:1,height:1,frames:[['#ff0000']]});
   const g=window.__game;g.transitionTo('car-editor');const e=g.carEditor;
   e.activeRootId='art';e.activeAction=null;e.setCarArtActiveComponent('brakes');addCarFx(e);
   e.selectedCar.art.fx.at(-1).artRef='fx-placement-test';e.syncCarAnglePreviewArt();e.invalidateCarEditorPreviewFrame();g.draw();
  });
  await page.waitForFunction(()=>{
   const e=window.__game.carEditor,f=e.carFxPreviewFrame;
   return f&&f.slot===e.selectedCarShellFrameSlot&&e.buttons.some(b=>b.id==='car-fx-properties');
  },{},{timeout:90000});
  const result=await page.evaluate(()=>{
   const g=window.__game,e=g.carEditor,f=e.carFxPreviewFrame,b=e.carGaugeViewport;
   const p={x:b.x+(f.x-f.bounds.x)*b.w/f.bounds.w,y:b.y+(f.y-f.bounds.y)*b.h/f.bounds.h};
   e.handlePointerDown(p);e.handlePointerUp(p);g.draw();
   return {placements:e.selectedCar.art.fx.find(fx=>fx.id===e.carFxId).views[f.slot].placements,inside:p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h};
  });
  expect(result.inside).toBe(true);expect(result.placements).toHaveLength(1);
  expect(result.placements[0].x).toBeCloseTo(0);expect(result.placements[0].y).toBeCloseTo(0);
  const fine=await page.evaluate(()=>{
   const g=window.__game,e=g.carEditor;g.draw();
   const before=e.selectedCar.art.fx.find(f=>f.id===e.carFxId).views[e.selectedCarShellFrameSlot].placements[0].x;
   e.buttons.find(b=>b.id==='car-fx-zoom').onClick();g.draw();
   e.buttons.find(b=>b.id==='car-fx-guides').onClick();g.draw();
   e.buttons.find(b=>b.id==='car-fx-nudge-right').onClick();g.draw();
   return {zoom:e.carFxZoom,hidden:e.carFxGuidesHidden,before,after:e.selectedCar.art.fx.find(f=>f.id===e.carFxId).views[e.selectedCarShellFrameSlot].placements[0].x};
  });
  expect(fine.zoom).toBe(2);expect(fine.hidden).toBe(true);expect(fine.after).toBeGreaterThan(fine.before);
  await page.screenshot({path:`test-results/car-fx-placement-${mode}.png`});
 });
}
