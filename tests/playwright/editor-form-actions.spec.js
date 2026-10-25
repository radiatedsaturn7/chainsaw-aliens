import {test,expect} from '@playwright/test';
test('artwork action temporarily releases the form modal and preserves unapplied properties',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(async()=>{
  const {openEditorForm}=await import('/src/ui/shared/editorForm.js');
  window.formResult='pending';
  openEditorForm('FX properties test',[
   {id:'name',label:'Effect name',type:'text',value:'Brake lights'},
   {id:'artRef',label:'Artwork',type:'text',readOnly:true,value:'original'},
   {id:'pick',label:'Choose artwork',type:'button',onClick:()=>new Promise(resolve=>{window.finishArtPicker=()=>resolve({artRef:'new-art'});})}
  ]).then(result=>{window.formResult=result;});
 });
 await page.getByLabel('Effect name',{exact:true}).fill('Edited name');await page.getByRole('button',{name:'Choose artwork',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeHidden();await page.evaluate(()=>window.finishArtPicker());
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Effect name',{exact:true})).toHaveValue('Edited name');await expect(page.getByLabel('Artwork',{exact:true})).toHaveValue('new-art');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>window.formResult)).toBeNull();
});

test('Effects picker selects newly added effects and Cancel discards removals',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const {selectCarFx}=await import('/src/ui/CarFxEditor.js');
  window.__game.transitionTo('car-editor');const e=window.__game.carEditor;e.selectedCar.art.fx=[];
  void selectCarFx(e);
 });
 await page.getByRole('button',{name:'Add effect',exact:true}).click();
 await expect(page.getByLabel('Effect to edit',{exact:true})).not.toHaveValue('');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.length)).toBe(1);
 await page.evaluate(async()=>{const {selectCarFx}=await import('/src/ui/CarFxEditor.js');void selectCarFx(window.__game.carEditor);});
 await page.getByRole('button',{name:'Remove selected effect',exact:true}).click();
 await expect(page.getByLabel('Effect to edit',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.length)).toBe(1);
});

test('FX Properties accepts fractional placement coordinates without native step validation errors',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const {addCarFx,editCarFx}=await import('/src/ui/CarFxEditor.js');
  const g=window.__game;g.transitionTo('car-editor');const e=g.carEditor;
  e.selectedCarShellFrameSlot='rear';addCarFx(e);const fx=e.selectedCar.art.fx.find(f=>f.id===e.carFxId);
  fx.views.rear.placements=[{x:.21234567,y:.12345678}];e.carFxPlacementIndex=0;
  window.fxPropertiesApplied=false;void editCarFx(e).then(()=>{window.fxPropertiesApplied=true;});
 });
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.getByRole('dialog').locator('form').evaluate(form=>form.checkValidity())).toBe(true);
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await page.waitForFunction(()=>window.fxPropertiesApplied);
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.find(f=>f.id===window.__game.carEditor.carFxId).views.rear.placements[0].x)).toBeCloseTo(.21234567,8);
});
