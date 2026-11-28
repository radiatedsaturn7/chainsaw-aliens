import {test,expect} from '@playwright/test';
import {seedRaceRuntimeFixtures} from './helpers/race-runtime-fixtures.js';
import {expectThumbnailOnCanvas,installThumbnailBrowseWitness} from '../helpers/carThumbnailBrowseWitness.js';

const ready=async page=>{
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
};

test('race runtime fixtures do not leak into a separate car picker',async({browser})=>{
 const seeded=await browser.newContext();
 try{
  const page=await seeded.newPage();
  await ready(page);
  await seedRaceRuntimeFixtures(page);
  const saved=await page.evaluate(async()=>{
   const file=await fetch('/__storage/file?folder=cars&name=2022%20Subaru%20WRX2').then(r=>r.json());
   const index=await fetch('/__storage/index?folder=cars').then(r=>r.json());
   return {body:file.file?.data?.car?.art?.body,listed:!!index.index.cars['2022 Subaru WRX2']};
  });
  expect(saved).toEqual({body:'rtg-001',listed:true});
 }finally{await seeded.close();}

 const clean=await browser.newContext({viewport:{width:1280,height:720}});
 try{
  const qa=await installThumbnailBrowseWitness(clean), page=await clean.newPage();
  await ready(page);
  await page.evaluate(async()=>{
   const g=window.__game,{createMenuDocument}=await import('/src/menus/MenuDocument.js');
   g.setDisplayMode('color');
   await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'cars'});
  });
  await page.waitForFunction(()=>{
   const p=window.__game.menuPlayer;
   return !p.screenTransition.active&&!p.pendingScreenEntry&&!p.flow?.busy&&p.resources.pending.size===0;
  });
  await expectThumbnailOnCanvas(page,qa,'2005 Flint Coupe');
  qa.assertBrowseCold();
  expect(await page.evaluate(()=>window.__game.menuPlayer.resources.choices('cars').some(c=>c.value==='2022 Subaru WRX2'))).toBe(false);
 }finally{await clean.close();}
});
