import { expect, test } from '@playwright/test';

test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844},
 userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});

const tapTitle = async (page, action) => {
  await page.waitForFunction(action => {
    const title=window.__game?.title;
    return title?.screen==='main' ? title.menuBounds.has(action) : title?.folderBounds[title.screen]?.has(action);
  }, action);
  const {x,y}=await page.evaluate(action=>{
    const g=window.__game,t=g.title;
    const b=t.screen==='main'?t.menuBounds.get(action):t.folderBounds[t.screen].get(action);
    const r=g.canvas.getBoundingClientRect();
    return {x:r.left+(b.x+b.w/2)*r.width/(g.viewport.width||g.canvas.width),
      y:r.top+(b.y+b.h/2)*r.height/(g.viewport.height||g.canvas.height)};
  },action);
  await page.touchscreen.tap(x,y);
};

async function openDesign(page){
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady && window.__game.state!=='loading');
 await page.evaluate(()=>{
   const g=window.__game;
   for(const el of document.querySelectorAll('[role=dialog]'))el.__closeLatestChanges?.();
   g.transitionTo('title');g.title.setScreen('main');g.title.setMainMenuReady(true);
 });
 await tapTitle(page,'graphics');
 await tapTitle(page,'surface-studio');
 const frame=page.frameLocator('#surface-studio-frame');
 await expect(frame.locator('html')).toHaveAttribute('data-designer-ready','true');
 await expect(page.locator('#surface-studio-frame')).toHaveAttribute('data-studio-connected','true');
 await expect(frame.locator('html')).toHaveAttribute('data-valid','true');
 return frame;
}

test('mobile Graphics opens the whole car, edits and persists advanced surfaces',async({page})=>{
 const frame=await openDesign(page),probe=()=>frame.locator('body').evaluate(()=>vehicleDesigner.getState());
 const readGenome=()=>frame.locator('body').evaluate(()=>window.vehicleDesigner?.getGenome());
 await expect(frame.getByRole('button',{name:'Test Drive'})).toBeVisible();
 await frame.locator('#family').selectOption('coupe');
 await expect.poll(async()=>(await probe()).metadata?.widthM).toBe(1.70);
 await frame.locator('#family').selectOption('fastback');
 await expect.poll(async()=>(await probe()).metadata?.heightM).toBe(1.24);
 await frame.locator('#family').selectOption('sedan');
 const width=frame.locator('#num-width');await width.fill('1.80');await width.press('Tab');
 await expect.poll(async()=>(await probe()).metadata?.widthM).toBe(1.80);
 await frame.locator('#undo').tap();
 await expect.poll(async()=>(await readGenome()).dimensions.width).toBe(1.74);
 await frame.locator('#redo').tap();
 await expect.poll(async()=>(await readGenome()).dimensions.width).toBe(1.80);
 await frame.getByRole('button',{name:'Surface',exact:true}).tap();
 await frame.locator('#surface-panel').selectOption('hood');
 await frame.locator('#patch-0').fill('.03');
 await frame.locator('#patch-0').press('Tab');
 await expect.poll(async()=>(await readGenome()).surfaces.hood.points[0]).toBe(.03);
 await frame.locator('#surface-panel').selectOption('frontFenders');
 await frame.getByRole('button',{name:'Open Surface Studio'}).tap();
 const panel=frame.frameLocator('#panel-editor');
 await expect(panel.locator('html')).toHaveAttribute('data-designer-ready','true');
 await panel.locator('body').evaluate(()=>designer.setParameter('width',.012));
 await expect.poll(async()=>(await readGenome())?.surfaces.frontFenders.parameters.width).toBe(.012);
 const canvas=await frame.locator('#scene').boundingBox();expect(canvas?.height).toBeGreaterThan(120);
 await frame.locator('#advanced-done').tap();
 await frame.getByRole('button',{name:'View',exact:true}).tap();
 await frame.locator('#shading').selectOption('zebra');
 await expect.poll(async()=>(await probe()).view?.mode).toBe('zebra');
 await page.setViewportSize({width:844,height:390});
 await expect(frame.locator('#actions')).toBeVisible();
 await expect.poll(()=>frame.locator('html').evaluate(e=>e.scrollWidth)).toBeLessThanOrEqual(844);
 await frame.getByRole('button',{name:'Graphics'}).tap();
 await expect(page.locator('#surface-studio-frame')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>[window.__game.state,window.__game.title.screen])).toEqual(['title','graphics']);
 await tapTitle(page,'surface-studio');
 await expect(frame.locator('html')).toHaveAttribute('data-designer-ready','true');
 await expect(page.locator('#surface-studio-frame')).toHaveAttribute('data-studio-connected','true');
 await expect.poll(async()=>(await readGenome())?.surfaces.frontFenders.parameters.width).toBe(.012);
});

test('an exported car can be driven twice with different geometry, without mutating the authoring project',async({page})=>{
 const frame=await openDesign(page);
 const project=await page.evaluate(()=>{
  const g=window.__game;window.__beforeStudioRaceEditor=g.raceEditor;
  return [g.raceEditor.project.cars.length,g.raceEditor.project.selectedCarId,g.raceEditor.project.selectedRaceId,JSON.stringify(g.menuProgress)];
 });
 const saved=await frame.locator('body').evaluate(()=>vehicleDesigner.save());
 await frame.locator('#design-file').setInputFiles({name:'design.json',mimeType:'application/json',buffer:Buffer.from(saved)});
 const bundle=await frame.locator('body').evaluate(()=>{const b=vehicleDesigner.export({quality:'preview'});return{
  car:b.car.kind, models:Object.keys(b.models).length,native:Object.values(b.models).every(m=>m.kind==='rtg-model'),
  joints:Object.keys(b.attachments).length};});
 expect(bundle).toEqual({car:'race-car',models:2,native:true,joints:8});
 const input=await page.context().newCDPSession(page);
 let firstRef=null;
 for(const width of [1.74,1.92]){
  await frame.locator('#num-width').fill(String(width));
  await frame.locator('#num-width').press('Tab');
  await expect.poll(()=>frame.locator('body').evaluate(()=>vehicleDesigner.getState().metadata?.widthM)).toBe(width);
  await frame.getByRole('button',{name:'Test Drive'}).tap();
  await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:15000}).toBe(true);
  const point=await page.waitForFunction(()=>{
   const g=window.__game,b=g.raceEditor.buttons.find(x=>x.id==='race-go')?.bounds,p=g.canvas.getBoundingClientRect();
   if(!b)return null;
   return {x:p.left+(b.x+b.w/2)*p.width/g.viewport.width,y:p.top+(b.y+b.h/2)*p.height/g.viewport.height};
  });
  const xy=await point.jsonValue();
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...xy,id:1}]});
  try{
   await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.speedMps),{timeout:16000}).toBeGreaterThan(2);
  }finally{await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  const traveled=await page.evaluate(()=>{
   const ed=window.__game.raceEditor,s=ed.playtestSession,p=ed.raceThreeWorldRenderer?.dynamicCarGroup?.userData?.parts;
   return {width:s.runtimeCar.dimensions.widthM,ref:s.runtimeCar.art.bodyModel.ref,body:p?.body?.userData?.modelInstance?.model?.name,
    wheels:Object.values(p?.wheels??{}).filter(x=>x.userData.modelInstance?.model).length};});
  expect(traveled).toMatchObject({width,body:'Rally sedan · WRX body',wheels:4});
  if(firstRef)expect(traveled.ref).not.toBe(firstRef);firstRef=traveled.ref;
  await page.getByRole('button',{name:'Car Design'}).tap();
  await expect(frame.locator('html')).toHaveAttribute('data-designer-ready','true');
 await expect(page.locator('#surface-studio-frame')).toHaveAttribute('data-studio-connected','true');
  await expect.poll(()=>frame.locator('body').evaluate(()=>window.vehicleDesigner?.getGenome().dimensions.width)).toBe(width);
  expect(await page.evaluate(()=>window.__game.raceEditor===window.__beforeStudioRaceEditor)).toBe(true);
 }
 const after=await page.evaluate(()=>{
  const g=window.__game;
  return [g.raceEditor.project.cars.length,g.raceEditor.project.selectedCarId,g.raceEditor.project.selectedRaceId,JSON.stringify(g.menuProgress)];
 });
 expect(after).toEqual(project);
});

test('mobile nose controls visibly reshape the same draft and persist',async({page})=>{
 const frame=await openDesign(page);
 const body=frame.locator('body');
 const shape=frame.getByLabel('Nose shape',{exact:true});
 const image=()=>body.evaluate(()=>vehicleDesigner.renderView({angle:'top',mode:'clay',lighting:'studio',projection:'ortho'}));
 await shape.selectOption('square');
 const square=await image();
 await shape.selectOption('v');
 const pointed=await image();
 expect(pointed).not.toBe(square);
 await shape.selectOption('round');
 expect(await image()).not.toBe(pointed);
 await frame.getByLabel('Corner sweep value',{exact:true}).fill('0.85');
 await frame.getByLabel('Corner sweep value',{exact:true}).press('Tab');
 await frame.getByLabel('End drop value',{exact:true}).fill('0.72');
 await frame.getByLabel('End drop value',{exact:true}).press('Tab');
 await expect.poll(()=>body.evaluate(()=>vehicleDesigner.getGenome().components.frontBumper)).toMatchObject({profile:'round',sweep:.85,drop:.72});
 await frame.getByRole('button',{name:'Parts',exact:true}).tap();
 await frame.locator('#component').selectOption('frontBumper');
 await expect(frame.getByLabel('End drop value',{exact:true})).toHaveValue('0.72');
 const file=await body.evaluate(()=>vehicleDesigner.save());
 await frame.locator('#design-file').setInputFiles({name:'rounded.json',mimeType:'application/json',buffer:Buffer.from(file)});
 expect(await body.evaluate(()=>vehicleDesigner.export({quality:'preview'}).genome.fascia.front)).toMatchObject({profile:'round',sweep:.85,drop:.72});
});

test('front and rear fascia studies, direct guides, and independent optics work on mobile',async({page})=>{
 const frame=await openDesign(page),body=frame.locator('body'),g=()=>body.evaluate(()=>vehicleDesigner.getGenome());
 await frame.locator('[data-tab=front]').tap();
 await frame.locator('summary').filter({hasText:'Starting-point studies'}).tap();
 await frame.locator('#fascia-demo').selectOption('hyper');
 expect((await g()).fascia.front.profile).toBe('v');
 await frame.locator('#fascia-advanced').tap();
 await expect(frame.locator('#fascia-overlay')).toBeVisible();
 await expect.poll(()=>body.evaluate(()=>vehicleDesigner.getState().view.projection)).toBe('ortho');
 await frame.locator('#fascia-advanced').tap();
 await frame.locator('[data-tab=rear]').tap();
 await frame.getByRole('button',{name:'Optics',exact:true}).tap();
 await frame.locator('#optic-housing').selectOption('trapezoid');
 await frame.locator('#optic-layout').selectOption('mixed');
 const res=await g();
 expect(res.optics.rear).toMatchObject({housing:'trapezoid',layout:'mixed'});
 expect(res.optics.front.housing).toBe('angular');
 expect(res.fascia.front.profile).toBe('v');
});

test('mobile viewport seam pick discovers real controls and wizard preview does not change the saved design',async({page})=>{
 const frame=await openDesign(page),body=frame.locator('body'),id='frontFenderSeam-R';
 await frame.locator('#feature-tab').tap();
 await frame.getByRole('button',{name:'Side',exact:true}).tap();
 const stations=await body.evaluate((_,id)=>{
  const a=vehicleDesigner,n=a.getState().features.find(f=>f.id===id).points.length;
  return [.54,.43,.64,.34,.75].map(t=>a.projectFeature(id,Math.floor((n-1)*t))).filter(p=>p?.visible);
 },id);
 expect(stations.length).toBeGreaterThan(0);
 const iframe=await page.locator('#surface-studio-frame').boundingBox();
 for(const p of stations){
  await page.touchscreen.tap(p.x+iframe.x,p.y+iframe.y);
  if(await body.evaluate(()=>vehicleDesigner.getState().featureId)===id)break;
 }
 await expect.poll(()=>body.evaluate(()=>vehicleDesigner.getState().featureId)).toBe(id);
 await expect(frame.getByText(/Gap width/i).first()).toBeVisible();
 const before=await body.evaluate(()=>vehicleDesigner.save());
 await frame.locator('#wizard-tab').tap();
 await frame.locator('#wizard-command').selectOption('gap');
 await frame.locator('#wizard-preview').tap();
 await expect(frame.locator('#wizard-accept')).toBeEnabled();
 expect(await body.evaluate(()=>vehicleDesigner.save())).toBe(before);
 await frame.locator('#wizard-accept').tap();
 expect(await body.evaluate(()=>vehicleDesigner.save())).not.toBe(before);
 await frame.locator('#undo').tap();
 expect(await body.evaluate(()=>vehicleDesigner.save())).toBe(before);
});
