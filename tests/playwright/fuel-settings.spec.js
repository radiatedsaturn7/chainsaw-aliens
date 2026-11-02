import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:1280,height:720}])test(`fuel settings at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await page.route('**/fuel-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('/fuel-harness');
 await page.evaluate(async()=>{const {editRaceStartingFuel}=await import('/src/ui/MechanicalForms.js');window.fuelEditor={selectedRace:{},captureRaceHistory(){}};window.fuelDialog=editRaceStartingFuel(window.fuelEditor);});
 const dialog=page.getByRole('dialog',{name:'Starting fuel',exact:true});await expect(dialog).toBeVisible();const bounds=await dialog.boundingBox();expect(bounds.width).toBeLessThanOrEqual(viewport.width);
 await dialog.getByLabel('Starting fuel',{exact:true}).selectOption('gallons');await dialog.getByLabel('Starting US gallons',{exact:true}).fill('5.5');await dialog.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.fuelEditor.selectedRace.mechanicalMission.startingFuel)).toEqual({mode:'gallons',value:5.5});
 await page.evaluate(async()=>{const {editCarMechanics}=await import('/src/ui/MechanicalForms.js');window.fuelEditor.selectedCar={};window.carFuelDialog=editCarMechanics(window.fuelEditor);});
 const car=page.getByRole('dialog',{name:'Mechanical systems',exact:true});await car.getByLabel('Fuel tank capacity (US gallons) value',{exact:true}).fill('16');await car.getByLabel('Reference cruise economy (US MPG) value',{exact:true}).fill('22');await car.getByLabel('Fuel filler door side',{exact:true}).selectOption('left');await car.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.fuelEditor.selectedCar.mechanics.fuelTankGallons)).toBe(16);expect(await page.evaluate(()=>window.fuelEditor.selectedCar.mechanics.fuelDoorSide)).toBe('left');
});
