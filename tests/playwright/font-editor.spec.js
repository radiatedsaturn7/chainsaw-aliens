import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:1280,height:800}])test(`font library preview and gauge selection ${viewport.width}`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(()=>{const game=window.__game;game.title.setScreen('graphics');game.handleTitleMenuAction('font-editor');});
 await expect(page.getByRole('dialog',{name:'Font Editor',exact:true})).toBeVisible({timeout:60000});
 await expect(page.getByRole('img',{name:'Font preview'})).toBeVisible();
 await page.getByLabel('Preview text',{exact:true}).fill('Lap 2 / 3 01:42.567');
 await page.getByLabel('Preview size',{exact:true}).fill('36');
 await expect(page.getByRole('button',{name:'Upload font (TTF / OTF / WOFF / WOFF2)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.evaluate(async()=>{
  const e=window.__game.carEditor;window.__game.transitionTo('car-editor');
  const {enterCarGauges,chooseGaugeFont}=await import('/src/ui/CarGaugeEditor.js');enterCarGauges(e,'exterior');
  e.carGaugeId=e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').id;
  void chooseGaugeFont(e);
 });
 await expect(page.getByRole('dialog',{name:'Choose font',exact:true})).toBeVisible({timeout:60000});
 await page.getByLabel('Saved font',{exact:true}).selectOption('');
 await page.getByRole('button',{name:'Use font',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.gauges.exterior.enabled)).toBe(true);
});
