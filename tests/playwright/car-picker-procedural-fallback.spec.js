import {test,expect} from '@playwright/test';
import {expectThumbnailOnCanvas,installThumbnailBrowseWitness} from '../helpers/carThumbnailBrowseWitness.js';

test('procedural picker neighbor does not fetch legacy tire art before selection',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 try{
  const qa=await installThumbnailBrowseWitness(context),ref='2005 Grid QA';
  // A saved procedural neighbor has neither a stock poster nor body artwork.
  // Keep it isolated to this browser, rather than writing to shared test storage.
  const original=await context.request.get('/__storage/file?folder=cars&name=2022%20Subaru%20BRZ');
  expect(original.ok()).toBe(true);
  const {file}=await original.json();
  Object.assign(file.data.car,{id:'2005-grid-qa',name:ref});
  file.name=ref;
  await context.route(u=>u.pathname==='/__storage/index'&&(!u.searchParams.get('folder')||u.searchParams.get('folder')==='cars'),async route=>{
   const response=await route.fetch(),payload=await response.json();
   payload.index.cars[ref]={updatedAt:file.savedAt,size:JSON.stringify(file).length};
   await route.fulfill({response,json:payload});
  });
  await context.route(u=>u.pathname==='/__storage/file'&&u.searchParams.get('folder')==='cars'&&u.searchParams.get('name')===ref,
   route=>route.fulfill({json:{ok:true,file}}));
  const page=await context.newPage();
  await page.goto('/index.html?hideFullscreenForTesting');
  await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  await page.evaluate(async()=>{
   const g=window.__game;
   const {createMenuDocument}=await import('/src/menus/MenuDocument.js');
   g.setDisplayMode('color');
   await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'cars'});
  });
  await page.waitForFunction(ref=>{
   const p=window.__game.menuPlayer,r=p.resources;
   return r.showroomNames?.has(ref)&&r.cars.has(ref)&&!p.screenTransition.active&&!p.pendingScreenEntry&&!p.flow?.busy&&r.pending.size===0;
  },ref);
  await expectThumbnailOnCanvas(page,qa,'2005 Flint Coupe');
  await page.waitForFunction(ref=>Boolean(window.__game.menuPlayer.resources.car(ref,{prepareExterior:false})),ref);
  const fallback=await page.evaluate(ref=>{
   const p=window.__game.menuPlayer,r=p.resources,car=r.car(ref,{prepareExterior:false});
   return {native:!!car.art?.bodyModel?.ref,sprite:!!p.game.carEditor.getRaceCarProjectedArtRef(car,0,Math.PI*.75).artRef,refs:r.exteriorArtRefs(car)};
  },ref);
  expect(fallback).toMatchObject({native:false,sprite:false});
  expect(fallback.refs).toContain('8582 tires 3');
  qa.assertBrowseCold();
 }finally{await context.close();}
});
