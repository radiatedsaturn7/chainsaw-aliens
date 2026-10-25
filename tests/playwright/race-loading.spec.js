import {test,expect} from '@playwright/test';
for(const mode of ['portrait','landscape','controller'])test(`custom race loading stays in the display: ${mode}`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize(mode==='landscape'?{width:844,height:390}:{width:390,height:844});
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile:true}}));
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async mode=>{
  const g=window.__game;
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
  const {MenuFlow}=await import('/src/menus/MenuFlow.js');
  const menu=(await hydrateProjectFilePayload('menus','Game Menu')).data;
  const carDoc=(await hydrateProjectFilePayload('cars','RTG-001')).data;
  const car=g.carEditor.normalizeLoadedCarDocument(carDoc.car||carDoc);
  g.transitionTo('race-editor');g.menuPlayer.flow=new MenuFlow(menu);g.menuPlayer.flow.parameters.carRef='RTG-001';
  if(mode==='controller'){const pad={id:'Loading Test Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});g.input.gamepadAvailable=true;g.input.gamepadIndex=0;g.input.gamepadConnected=true;}
  const e=g.raceEditor;e.beginRaceTravelLoading('P1',car.id,{car});e.racePlaytestPreparation.progress=.42;
  e.racePlaytestPreparation.deadlineWatchdog=null;
  g.draw();
 },mode);
 await page.waitForTimeout(1500);
 const result=await page.evaluate(()=>{const g=window.__game,e=g.raceEditor;g.draw();return{bounds:e.raceLoadingBounds,layout:e.getRaceHandheldLayout(g.viewport.width,g.viewport.height).screen,buttons:e.buttons.map(b=>b.id),car:e.raceLoadingPresentation.carRef,art:e.raceLoadingPresentation.screen.backgroundArt,seed:e.raceLoadingPresentation.seed};});
 expect(result.car).toBe('RTG-001');expect(result.art).toBe('loadingscreen');
 if(mode!=='controller'){expect(result.bounds).toEqual(result.layout);expect(result.buttons).toContain('race-go');}else expect(result.buttons).not.toContain('race-go');
 await page.screenshot({path:`test-results/loading-${mode}.png`});
 const later=await page.evaluate(()=>{const e=window.__game.raceEditor;const seed=e.raceLoadingPresentation.seed;e.racePlaytestPreparation.progress=.9;window.__game.draw();return{seed:e.raceLoadingPresentation.seed,previous:seed};});expect(later.seed).toBe(later.previous);
 expect(result.buttons).not.toContain('cancel-race-preparation');
 const elements=await page.evaluate(()=>window.__game.raceEditor.raceLoadingPresentation.screen.elements);
 const car=elements.find(e=>e.id==='loading-car'),bar=elements.find(e=>e.id==='loading-progress');
 expect(car).toBeUndefined();expect(bar.x).toBe(.142);expect(bar.w).toBe(.828);expect(bar.y).toBe(.91125);expect(bar.h).toBe(.0525);
 await page.evaluate(()=>window.__game.raceEditor.cancelRacePlaytestPreparation());
});
