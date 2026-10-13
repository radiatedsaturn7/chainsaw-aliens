import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} car category and AI pool dialogs persist their selections`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(mobile=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;
  g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.enterCarEditor();
  const item=g.carEditor.getMenuItems('drivetrain').find(i=>i.id==='car-category');
  if(!item||item.disabled)throw Error('Category menu unavailable');item.onSelect();
 },mobile);
 const category=page.getByRole('dialog');await expect(category).toBeVisible();
 await expect(category).toContainText('Suspension:');await expect(category).toContainText('A: 800–1000 PP');
 await category.getByLabel('Vehicle category',{exact:true}).selectOption('suv');
 await category.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>{const e=window.__game.carEditor;return e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).category})).toBe('suv');
 await page.evaluate(()=>{
  const g=window.__game;g.enterRaceEditor();const e=g.raceEditor;
  for(const name of ['Pool One','Pool Two'])e.upsertRaceProjectCar(e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name));
  const item=e.getMenuItems('settings').find(i=>i.id==='race-ai-cars');
  if(!item||item.disabled)throw Error('AI pool menu unavailable');item.onSelect();
 });
 const pool=page.getByRole('dialog',{name:'AI Cars & Classes'});await expect(pool).toBeVisible();
 await pool.getByLabel('Vehicle category',{exact:true}).selectOption('suv');
 await pool.getByLabel('Performance class',{exact:true}).selectOption('C');
 const fallback=await page.evaluate(()=>window.__game.raceEditor.project.cars.find(c=>c.__playtestDocumentName==='Pool Two').__playtestId);
 await pool.getByLabel('Default racer after unique cars').selectOption(fallback);
 await pool.getByLabel(/^Pool One ·/).selectOption('yes');await pool.getByLabel(/^Pool Two ·/).selectOption('no');
 await pool.getByRole('button',{name:'Apply',exact:true}).click();
 const saved=await page.evaluate(()=>{const e=window.__game.raceEditor;return {rules:e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument()).competition.carSelection,id:e.project.cars.find(c=>c.__playtestDocumentName==='Pool One').__playtestId}});
 expect(saved.rules.category).toBe('suv');expect(saved.rules.performanceClass).toBe('C');expect(saved.rules.defaultCarId).toBe(fallback);
 expect(saved.rules.availableCarIds).toContain(saved.id);expect(saved.rules.availableCarIds).not.toContain(fallback);
});
