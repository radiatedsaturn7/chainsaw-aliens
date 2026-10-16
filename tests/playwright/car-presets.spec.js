import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`car presets load isolated drafts and save user files ${mobile?'portrait':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(mobile=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;
  g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  g.enterCarEditor();g.setDisplayMode('color');
 },mobile);
 const before=await page.evaluate(async()=>{const {listProjectFiles}=await import('/src/ui/projectFiles.js');return listProjectFiles('cars').map(e=>e.name);});
 for(const id of ['awd','rwd','fwd']){
  await page.evaluate(()=>{
   const e=window.__game.carEditor;
   if(!e.getMenuItems('file').some(item=>item.id==='car-load-preset'&&!item.disabled))throw Error('Load Preset is missing from File');
   e.handleMenuAction('car-load-preset');
  });
  const form=page.getByRole('dialog',{name:'Load Preset',exact:true});
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Car',{exact:true}).locator('option')).toHaveText(['AWD Sports Car','RWD Sports Car','FWD Sports Car']);
  await form.getByLabel('Car',{exact:true}).selectOption(id);
  if(id==='fwd')await page.screenshot({path:`test-results/car-presets-${mobile?'portrait':'desktop'}.png`});
  await form.getByRole('button',{name:'Load Preset',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__game.carEditor.selectedCar.tuning.drivetrain)).toBe(id);
  expect(await page.evaluate(()=>window.__game.carEditor.currentCarDocumentName)).toBe('');
 }
 expect(await page.evaluate(async()=>{const {listProjectFiles}=await import('/src/ui/projectFiles.js');return listProjectFiles('cars').map(e=>e.name);})).toEqual(before);
 await page.evaluate(()=>window.__game.carEditor.handleMenuAction('save'));
 await expect(page.locator('.project-browser-title')).toHaveText('Save Car As');
 const name=`Preset FWD ${mobile?'portrait':'desktop'}`;
 await page.getByPlaceholder('Filename',{exact:true}).fill(name);
 await page.locator('.project-browser-actions').getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.carEditor.status)).toBe('Saved');
 const saved=await page.evaluate(name=>{
  const e=window.__game.carEditor;e.hydrateProjectCarsFromSavedFiles();
  const entry=e.getSavedRaceCarEntriesForPlaytest().find(entry=>entry.name===name);
  return {name:entry?.name,drive:entry?.car.tuning.drivetrain,system:entry?.car.systemFile===true,draft:entry?.car.__editorDraft===true};
 },name);
 expect(saved).toEqual({name,drive:'fwd',system:false,draft:false});
});
