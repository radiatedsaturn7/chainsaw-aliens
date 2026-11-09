import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
 test(`car smoke surface picker ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady && window.__game?.state !== 'loading');
  await page.evaluate(async()=>{
   const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
   const {editCarSmoke}=await import('/src/ui/CarSmokeEditor.js');
   const game=window.__game;
   window.__smokeEditor=new RaceEditor(game);
   window.__smokeDialog=editCarSmoke(window.__smokeEditor);
  });
  await page.getByRole('button',{name:'Snow & Ice',exact:true}).click();
  await page.getByRole('button',{name:'Snow',exact:true}).click();
  await expect(page.getByText('Artwork name',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose saved artwork',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.evaluate(()=>window.__smokeDialog);
 });
}
