import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:1280,height:720}])test(`mechanical settings and salvage requirements fit ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);
 await page.route('**/mechanical-settings-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('/mechanical-settings-harness');
 await page.evaluate(async()=>{
  const {editCarMechanics}=await import('/src/ui/MechanicalForms.js');
  window.mechanicalEditor={selectedCar:{},captureRaceHistory(){}};
  window.mechanicalDialog=editCarMechanics(window.mechanicalEditor);
 });
 const dialog=page.getByRole('dialog',{name:'Mechanical systems',exact:true});await expect(dialog).toBeVisible();
 const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.width).toBeLessThanOrEqual(viewport.width);
 await dialog.getByLabel('Battery capacity (Ah) value',{exact:true}).fill('35');
 await dialog.getByLabel('Component to configure',{exact:true}).selectOption('alternator');
 await dialog.getByRole('button',{name:'Component durability, repair cost & replacement part',exact:true}).click();
 const component=page.getByRole('dialog',{name:'Alternator',exact:true});await expect(component).toBeVisible();
 await component.getByLabel('Required inventory item ID (blank = scrap only)',{exact:true}).fill('wrx-alternator');
 await component.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.mechanicalEditor.selectedCar.mechanics.batteryAh)).toBe(35);
 expect(await page.evaluate(()=>window.mechanicalEditor.selectedCar.mechanics.components.alternator.requiredPart)).toBe('wrx-alternator');
 await page.evaluate(async()=>{
  const {editMechanicalMission}=await import('/src/ui/MechanicalForms.js');window.mechanicalEditor.selectedRace={};window.missionDialog=editMechanicalMission(window.mechanicalEditor);
 });
 const mission=page.getByRole('dialog',{name:'Mechanical mission',exact:true});await expect(mission).toBeVisible();
 await mission.getByRole('button',{name:'Configure starting fault',exact:true}).click();
 const fault=page.getByRole('dialog',{name:'Starting Alternator',exact:true});await fault.getByLabel('Apply starting condition',{exact:true}).check();await fault.getByLabel('Failed at start',{exact:true}).check();await fault.getByRole('button',{name:'Apply',exact:true}).click();
 await mission.getByLabel('Inventory ID required at finish (blank = none)',{exact:true}).fill('wrx-alternator');
 await mission.getByRole('button',{name:'Apply',exact:true}).click();
 const saved=await page.evaluate(()=>window.mechanicalEditor.selectedRace.mechanicalMission);expect(saved.components.alternator.failed).toBe(true);expect(saved.requiredInventory).toBe('wrx-alternator');
});
