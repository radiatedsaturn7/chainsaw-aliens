import {test,expect} from '@playwright/test';

for(const viewport of [{width:390,height:844},{width:1280,height:720}]) {
 test(`wheel calibration and mock feedback settings fit ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  // Minimal same-origin page: do not load or mutate the user's project menu.
  await page.route('**/wheel-settings-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('/wheel-settings-harness');
  await page.evaluate(async()=>{
   const {WheelService}=await import('/src/hardware/wheels/WheelService.js');
   const {openWheelSettings}=await import('/src/hardware/wheels/WheelSettings.js');
   const {normalizeWheelSettings}=await import('/src/hardware/wheels/WheelInput.js');
   window.testPad={id:'Fixture wheel',index:0,connected:true,axes:[-1,1],buttons:[{value:0}]};
   window.testWheel=new WheelService({navigator:{getGamepads:()=>[window.testPad]}});
   window.testWheel.configure=async value=>{await window.testWheel.stop();window.testWheel.settings=normalizeWheelSettings(value);};
   window.testWheelDialog=openWheelSettings(window.testWheel);
  });
  const dialog=page.getByRole('dialog',{name:'Steering wheel and pedals',exact:true});await expect(dialog).toBeVisible();
  const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.width).toBeLessThanOrEqual(viewport.width);
  await dialog.getByText('Steering',{exact:true}).click();
  const section=dialog.locator('details').filter({has:page.locator('summary',{hasText:/^Steering$/})});
  await section.getByLabel('Device and axis / button',{exact:true}).selectOption({index:1});
  await section.getByRole('button',{name:'Capture left position',exact:true}).click();await expect(section.getByLabel('left raw value',{exact:true})).toHaveValue('-1');
  await page.evaluate(()=>{window.testPad.axes[0]=.123456;});
  await section.getByRole('button',{name:'Capture center position',exact:true}).click();await expect(section.getByLabel('center raw value',{exact:true})).toHaveValue('0.123456');
  await page.evaluate(()=>{window.testPad.axes[0]=1;});
  await section.getByRole('button',{name:'Capture right position',exact:true}).click();await expect(section.getByLabel('right raw value',{exact:true})).toHaveValue('1');
  await dialog.getByText('Diagnostics',{exact:true}).click();
  await dialog.getByRole('button',{name:'Use mock feedback backend (no motor output)',exact:true}).click();
  await dialog.getByText('Force feedback',{exact:true}).click();
  await dialog.getByRole('button',{name:'Save calibration and enable force feedback',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.testWheel.enabled)).toBe(true);
  await dialog.getByRole('button',{name:'Disable force feedback now',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.testWheel.enabled)).toBe(false);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();
  await page.evaluate(()=>window.testWheel.dispose());
 });
}
