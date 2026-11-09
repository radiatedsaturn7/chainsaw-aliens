import {test,expect} from '@playwright/test';

for(const mode of ['keyboard','gamepad','touch'])test(`in-game tuner: ${mode} locks, drafts, acceleration and apply/cancel`,async({page})=>{
 await page.setViewportSize(mode==='touch'?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async mode=>{
  const g=window.__game,{ItemSystem}=await import('/src/items/ItemSystem.js'),{createMenuDocument}=await import('/src/menus/MenuDocument.js');
  const car=structuredClone(g.carEditor.selectedCar);car.setup.tirePressurePsi={fl:32,fr:32,rl:30,rr:30};
  g.deviceIsMobile=mode==='touch';g.isMobile=g.deviceIsMobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:g.deviceIsMobile});
  g.items=new ItemSystem(g,{load:async()=>({}),save:async()=>({ok:true})});g.menuProgress={};g.resolveRaceTravelCarAsync=async()=>({car,name:'Tuner Car'});
  const doc=createMenuDocument();doc.parameters.carRef='Tuner Car';g.menuPlayer.settings.load=async()=>{};
  await g.menuPlayer.open(doc,{preview:true,screenId:'tuning'});await g.menuPlayer.tuner.readyTask;
 },mode);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner?.ready)).toBe(true);
 const press=async(key,pad)=>{
  if(mode==='gamepad')await page.evaluate(pad=>{const p=window.__game.menuPlayer;p.update({wasGamepadPressed:a=>a===pad},.016);p.update({},.016);},pad);
  else if(mode==='touch'&&['jump','gamepadB'].includes(pad)){
   const point=await page.evaluate(pad=>{const g=window.__game,b=g.menuPlayer.surface.controls.buttons.find(b=>b.id===(pad==='jump'?'jump':'attack')),r=g.canvas.getBoundingClientRect();return {x:r.x+b.x*r.width/g.viewport.width,y:r.y+b.y*r.height/g.viewport.height};},pad);
   await page.mouse.click(point.x,point.y,{delay:80});
  }else await page.keyboard.press(key);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 };
 await press('ArrowDown','dpadDown');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.index)).toBe(4);
 await press('Enter','jump');await press('Enter','jump');await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('list');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.message)).toMatch(/Locked.*Install/);
 await page.screenshot({path:`test-results/tuning-${mode}-locked.png`});
 await press('Escape','gamepadB');await press('Escape','gamepadB');
 await press('ArrowRight','dpadRight');await press('ArrowRight','dpadRight');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.index)).toBe(6);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('grid');
 await page.screenshot({path:`test-results/tuning-${mode}-grid.png`});
 await press('Enter','jump');await press('Enter','jump');await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('edit');
 await press('ArrowRight','dpadRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBe(32.5);
 await press('Escape','gamepadB');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.row.value)).toBe(32);
 await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('edit');
 await page.keyboard.down('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBeGreaterThan(40);await page.keyboard.up('ArrowRight');
 expect(await page.evaluate(()=>window.__game.menuPlayer.tuner.hitAreas.map(a=>a.kind))).toEqual(['slider']);
 const value=await page.evaluate(()=>window.__game.menuPlayer.tuner.draft);await page.screenshot({path:`test-results/tuning-${mode}-slider.png`});
 await press('Enter','jump');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('list');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.configuration('Tuner Car').tune['pressure.fl'])).toBe(value);
 expect(await page.evaluate(()=>window.__game.items.garage.configuration('Tuner Car').tune['pressure.fl'])).toBeUndefined();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await press('Escape','gamepadB');await press('Escape','gamepadB');
 const clickTuner=async(kind,index)=>{
  const point=await page.evaluate(({kind,index})=>{const g=window.__game,a=g.menuPlayer.tuner.hitAreas.find(a=>a.kind===kind&&a.index===index),r=g.canvas.getBoundingClientRect();return {x:r.x+(a.x+a.w/2)*r.width/g.viewport.width,y:r.y+(a.y+a.h/2)*r.height/g.viewport.height};},{kind,index});
  await page.mouse.click(point.x,point.y,{delay:80});
 };
 await clickTuner('category',1);
 await clickTuner('row',2); // Save
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.sectionRows().length)).toBe(8);
 await clickTuner('row',0);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.message)).toBe('Saved slot 1');
 expect(await page.evaluate(()=>window.__game.menuPlayer.tuner.sectionRows()[0].displayValue)).toMatch(/PI ·/);
 await page.screenshot({path:`test-results/tuning-${mode}-save-slots.png`});
 await press('Escape','gamepadB');await clickTuner('row',1); // Preset
 expect(await page.evaluate(()=>window.__game.menuPlayer.tuner.sectionRows().map(r=>r.label))).toEqual(['Stock','Street','Road','Rally','Drift','Off-road','Drag','Snow']);
 await clickTuner('row',0);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.message)).toBe('Stock tuning restored');
 await press('Escape','gamepadB');await clickTuner('row',3); // Load
 await clickTuner('row',0);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.message)).toBe('Loaded slot 1');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.configuration('Tuner Car').tune['pressure.fl'])).toBe(value);
});

for(const mode of ['keyboard','touch'])test(`setup packages: ${mode} shows package buttons, backs out and fits Rally`,async({page})=>{
 await page.setViewportSize(mode==='touch'?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async mode=>{
  const g=window.__game,{ItemSystem}=await import('/src/items/ItemSystem.js'),{createMenuDocument}=await import('/src/menus/MenuDocument.js');
  const car=structuredClone(g.carEditor.selectedCar);delete car.garagePartSlots;
  g.player.credits=50000;g.deviceIsMobile=g.isMobile=mode==='touch';
  g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:g.isMobile});
  g.items=new ItemSystem(g,{load:async()=>({}),save:async()=>({ok:true})});g.menuProgress={};g.resolveRaceTravelCarAsync=async()=>({car,name:'Setup Car'});
  const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('cars','Setup Car',car);
  const doc=createMenuDocument();doc.parameters.carRef='Setup Car';g.menuPlayer.settings.load=async()=>{};
  await g.menuPlayer.open(doc,{preview:true,screenId:'upgrades'});g.menuPlayer.resources.stockCar=()=>car;
 },mode);
 const clickButton=async(value)=>{
  const point=await page.evaluate(async value=>{
   const p=window.__game.menuPlayer,g=window.__game;
   const {garageBrowserRows,garageGridBounds}=await import('/src/menus/MenuGarageWidgets.js');
   const {menuElementBounds}=await import('/src/menus/MenuRenderer.js');
   const {menuElementPose}=await import('/src/menus/MenuDocument.js');
   const e=p.flow.screen.elements.find(e=>e.type==='garage-browser'),state=p.widgetStates.get(e.id)||{};
   const rows=garageBrowserRows(p.resources,p.flow.parameters,state),index=rows.findIndex(r=>r.value===value);
   if(index<0)throw Error('Missing button '+value);
   const a=garageGridBounds(menuElementBounds(e,p.bounds,menuElementPose(e,p.flow.time)),index),r=g.canvas.getBoundingClientRect();
   return {x:r.x+(a.x+a.w/2)*r.width/g.viewport.width,y:r.y+(a.y+a.h/2)*r.height/g.viewport.height};
  },value);
  await page.mouse.click(point.x,point.y,{delay:80});
 };
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.screenTransition.active)).toBe(false);
 await clickButton('Presets');await clickButton('setup');
 const cost=await page.evaluate(async()=>{
  const p=window.__game.menuPlayer,{garageBrowserRows}=await import('/src/menus/MenuGarageWidgets.js');
  const e=p.flow.screen.elements.find(e=>e.type==='garage-browser');
  const rows=garageBrowserRows(p.resources,p.flow.parameters,p.widgetStates.get(e.id));
  if(rows.length!==8||!rows.every(r=>r.package))throw Error('Expected eight package buttons');
  return rows.find(r=>r.value==='package:rally').cost;
 });expect(cost).toBeGreaterThan(0);
 await page.screenshot({path:`test-results/upgrades-${mode}-packages.png`});
 await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.items.game.player.credits)).toBe(50000);
 await clickButton('setup');await clickButton('package:rally');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.resources.garage.configuration('Setup Car').setupId)).toBe('rally');
 const saved=await page.evaluate(()=>{const p=window.__game.menuPlayer,g=p.resources.garage;return {setup:g.configuration('Setup Car').setupId,installed:g.installed('Setup Car').length,credits:g.items.game.player.credits,real:window.__game.items.garage.installed('Setup Car').length};});
 expect(saved).toEqual({setup:'rally',installed:7,credits:50000-cost,real:0});
});

for(const viewport of [{width:1280,height:800},{width:390,height:844}])test(`upgrade cards ${viewport.width}: installed outline and separate part description`,async({page})=>{
 await page.setViewportSize(viewport);
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const result=await page.evaluate(async()=>{
  const {drawUpgradeGrid}=await import('/src/menus/MenuUpgradeRenderer.js');
  const {garageGridBounds,garageBrowserRows,upgradeGridArea}=await import('/src/menus/MenuGarageWidgets.js');
  const {normalizeItemDocument}=await import('/src/items/ItemDocument.js');
  const catalog=await fetch('/src/content/garage-parts.json').then(r=>r.json());
  const parts=catalog.items.map(normalizeItemDocument),installed={brakes:'race-brakes'};
  const resources={garageCatalog:()=>parts.map(item=>({item,ref:item.id})),garage:{configuration:()=>({installed}),availableCount:()=>0,items:{progress:{bags:{items:{}},unlocks:{}},game:{player:{credits:100000}}}}};
  const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;
  Object.assign(canvas.style,{position:'fixed',inset:0,zIndex:999999,width:'100vw',height:'100vh'});document.body.append(canvas);
  const ctx=canvas.getContext('2d'),bounds={x:8,y:8,w:innerWidth-16,h:Math.min(400,innerHeight-16)},element={color:'#ffffff'};
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  const rows=garageBrowserRows(resources,{},{section:'Handling',slot:'brakes'}),raceIndex=rows.findIndex(r=>r.value==='race-brakes');
  drawUpgradeGrid(ctx,bounds,element,resources,{}, {section:'Handling',slot:'brakes',index:rows.findIndex(r=>r.value==='street-brakes')});
  const card=garageGridBounds(upgradeGridArea(bounds),raceIndex),pixel=Array.from(ctx.getImageData(Math.round(card.x+2),Math.round(card.y+8),1,1).data);
  return {pixel,installed:rows.filter(r=>r.installed).map(r=>r.value),labels:rows.map(r=>r.label),categories:garageBrowserRows(resources,{}).length};
 });
 expect(result.categories).toBe(8);expect(result.installed).toEqual(['race-brakes']);
 expect(result.labels.some(label=>/Installed|scrap/.test(label))).toBe(false);
 expect(result.pixel.slice(0,3)).toEqual([84,223,134]);
 await page.screenshot({path:`test-results/tuning-upgrade-outline-${viewport.width}.png`});
});
