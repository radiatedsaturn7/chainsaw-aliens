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
 };
 await press('ArrowRight','dpadRight');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.index)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('grid');
 await page.screenshot({path:`test-results/tuning-${mode}-grid.png`});
 await press('ArrowLeft','dpadLeft');await press('Enter','jump');await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('edit');
 await press('ArrowRight','dpadRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBe(32.5);
 await press('Escape','gamepadB');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.row.value)).toBe(32);
 await press('Enter','jump');
 await page.keyboard.down('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBeGreaterThan(40);await page.keyboard.up('ArrowRight');
 const value=await page.evaluate(()=>window.__game.menuPlayer.tuner.draft);await page.screenshot({path:`test-results/tuning-${mode}-slider.png`});
 await press('Enter','jump');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('list');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.configuration('Tuner Car').tune['pressure.fl'])).toBe(value);
 expect(await page.evaluate(()=>window.__game.items.garage.configuration('Tuner Car').tune['pressure.fl'])).toBeUndefined();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

for(const mode of ['keyboard','touch'])test(`setup packages: ${mode} previews cost, cancels and fits a Rally package`,async({page})=>{
 await page.setViewportSize(mode==='touch'?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async mode=>{
  const g=window.__game,{ItemSystem}=await import('/src/items/ItemSystem.js'),{createMenuDocument}=await import('/src/menus/MenuDocument.js');
  const car=structuredClone(g.carEditor.selectedCar);delete car.garagePartSlots;
  g.player.credits=50000;g.deviceIsMobile=g.isMobile=mode==='touch';
  g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:g.isMobile});
  g.items=new ItemSystem(g,{load:async()=>({}),save:async()=>({ok:true})});g.menuProgress={};g.resolveRaceTravelCarAsync=async()=>({car,name:'Setup Car'});
  const doc=createMenuDocument();doc.parameters.carRef='Setup Car';g.menuPlayer.settings.load=async()=>{};
  await g.menuPlayer.open(doc,{preview:true,screenId:'tuning'});await g.menuPlayer.tuner.readyTask;
 },mode);
 const clickArea=async(kind,index)=>{
  await expect.poll(()=>page.evaluate(({kind,index})=>window.__game.menuPlayer.tuner.hitAreas?.some(a=>a.kind===kind&&(index===undefined||a.index===index||a.direction===index)),{kind,index})).toBe(true);
  const point=await page.evaluate(({kind,index})=>{const g=window.__game,a=g.menuPlayer.tuner.hitAreas.find(a=>a.kind===kind&&(index===undefined||a.index===index||a.direction===index)),r=g.canvas.getBoundingClientRect();return {x:r.x+(a.x+a.w/2)*r.width/g.viewport.width,y:r.y+(a.y+a.h/2)*r.height/g.viewport.height};},{kind,index});
  await page.mouse.click(point.x,point.y,{delay:80});
 };
 await clickArea('category',0);
 const row=await page.evaluate(()=>window.__game.menuPlayer.tuner.sectionRows().findIndex(r=>r.id==='setupPackage'));
 await clickArea('row',row);
 for(let i=0;i<3;i++)await clickArea('step','right');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBe(3);
 const cost=await page.evaluate(()=>window.__game.menuPlayer.tuner.row.options[3].cost);expect(cost).toBeGreaterThan(0);
 await page.screenshot({path:`test-results/tuning-${mode}-rally-package.png`});
 await clickArea('exit');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.items.game.player.credits)).toBe(50000);
 await clickArea('row',row);for(let i=0;i<3;i++)await clickArea('step','right');await clickArea('apply');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('list');
 const saved=await page.evaluate(()=>{const p=window.__game.menuPlayer,g=p.resources.garage;return {setup:g.configuration('Setup Car').setupId,installed:g.installed('Setup Car').length,credits:g.items.game.player.credits,real:window.__game.items.garage.installed('Setup Car').length};});
 expect(saved).toEqual({setup:'rally',installed:7,credits:50000-cost,real:0});
});

for(const viewport of [{width:1280,height:800},{width:390,height:844}])test(`upgrade cards ${viewport.width}: installed outline and eight-card pages`,async({page})=>{
 await page.setViewportSize(viewport);
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const result=await page.evaluate(async()=>{
  const {drawUpgradeGrid}=await import('/src/menus/MenuUpgradeRenderer.js');
  const {garageGridBounds,garageBrowserRows}=await import('/src/menus/MenuGarageWidgets.js');
  const {normalizeItemDocument}=await import('/src/items/ItemDocument.js');
  const catalog=await fetch('/src/content/garage-parts.json').then(r=>r.json());
  const parts=catalog.items.map(normalizeItemDocument),installed={brakes:'race-brakes'};
  const resources={garageCatalog:()=>parts.map(item=>({item,ref:item.id})),garage:{configuration:()=>({installed}),availableCount:()=>0,items:{progress:{bags:{items:{}},unlocks:{}},game:{player:{credits:100000}}}};
  const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;
  Object.assign(canvas.style,{position:'fixed',inset:0,zIndex:999999,width:'100vw',height:'100vh'});document.body.append(canvas);
  const ctx=canvas.getContext('2d'),bounds={x:8,y:8,w:innerWidth-16,h:Math.min(400,innerHeight-16)},element={color:'#ffffff'};
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  const rows=garageBrowserRows(resources,{},{section:'Brakes',slot:'brakes'}),raceIndex=rows.findIndex(r=>r.value==='race-brakes');
  drawUpgradeGrid(ctx,bounds,element,resources,{}, {section:'Brakes',slot:'brakes',index:0});
  const card=garageGridBounds(bounds,raceIndex),pixel=Array.from(ctx.getImageData(Math.round(card.x+2),Math.round(card.y+8),1,1).data);
  return {pixel,installed:rows.filter(r=>r.installed).map(r=>r.value),labels:rows.map(r=>r.label),categories:garageBrowserRows(resources,{}).length};
 });
 expect(result.categories).toBe(8);expect(result.installed).toEqual(['race-brakes']);
 expect(result.labels.some(label=>label.includes('Installed'))).toBe(false);
 expect(result.pixel.slice(0,3)).toEqual([84,223,134]);
 await page.screenshot({path:`test-results/tuning-upgrade-outline-${viewport.width}.png`});
});
