import {test,expect} from '@playwright/test';
import {seedRaceRuntimeFixtures} from './helpers/race-runtime-fixtures.js';
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
const apply=(page,name)=>dialog(page,name).getByRole('button',{name:'Apply',exact:true}).click();
async function ready(page){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');}
async function action(page,id){await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);await page.evaluate(id=>{void window.__game.itemEditor.getDesktopActionHandlers()[id]();},id);}
async function clickItem(page,id){await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);await expect.poll(()=>page.evaluate(id=>window.__game.itemEditor.buttons.some(b=>b.id===id&&!b.disabled),id)).toBe(true);const p=await page.evaluate(id=>{const g=window.__game,b=g.itemEditor.buttons.find(b=>b.id===id).bounds,r=g.canvas.getBoundingClientRect();return{x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height};},id);await page.mouse.click(p.x,p.y);}
test.beforeEach(async({page})=>{
 let progress={};
 await page.route('**/__storage/file*',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;
  if((body?.folder||url.searchParams.get('folder'))==='settings'&&(body?.name||url.searchParams.get('name'))==='rtg-item-progress'){
   if(body){progress=body.data;return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{ok:true,file:{data:progress}}});
  }
  return route.continue();
 });
});
for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} item file authors grants, reloads artwork and persists collection`,async({page},info)=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 const name=`Item Bundle ${info.workerIndex} ${mobile}`;
 await page.evaluate(async({mobile,name})=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('art',name,{width:8,height:8,frames:[{pixels:Array(64).fill('#32dd88ff')}]});
  for(const [id,name,type,target] of [['red-key','Red Key','key','red'],['scanner','Scanner','device','scanner'],['garage','Garage','unlock','garage']])await saveProjectFileAndConfirm('items',name,{kind:'item',item:{id,name,effects:[{type,target,contentName:name}]}});
  g.title.setScreen('game');g.handleTitleMenuAction('item-editor');
 },{mobile,name});
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('item-editor');expect(await page.getByRole('dialog').count()).toBe(0);
 if(mobile)await clickItem(page,'item-properties');else await action(page,'item-properties');
 await dialog(page,'Item Properties').getByLabel('Name',{exact:true}).fill(name);
 await dialog(page,'Item Properties').getByLabel('Level width (pixels)',{exact:true}).fill('48');await apply(page,'Item Properties');
 await action(page,'item-art');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.widthPx)).toBe(8);
 await action(page,'item-properties');await dialog(page,'Item Properties').getByLabel('Level width (pixels)',{exact:true}).fill('48');await apply(page,'Item Properties');
 for(const [type,target,amount] of [['key','red',1],['max-health','',2],['armor','',3],['device','scanner',1],['unlock','garage',1]]){
  await clickItem(page,'item-effect-add');await dialog(page,'Add Item Effect').getByLabel('Effect',{exact:true}).selectOption(type);
  if(target)await dialog(page,'Add Item Effect').getByLabel({key:'Key',device:'Device',unlock:'Unlock'}[type],{exact:true}).selectOption(target);
  if(!['device','unlock'].includes(type))await dialog(page,'Add Item Effect').getByLabel('Amount',{exact:true}).fill(String(amount));await apply(page,'Add Item Effect');
 }
 await action(page,'save');await page.getByPlaceholder('Filename',{exact:true}).fill(name);await page.locator('.project-browser-btn.primary').filter({hasText:'Save'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.status)).toBe('Saved');
 await action(page,'new');await action(page,'open');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.effects.length)).toBe(5);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.itemEditor.getDoodadArtCanvas()))).toBe(true);
 expect(await page.evaluate(()=>window.__game.itemEditor.doodad.widthPx)).toBe(48);
 await page.screenshot({path:`test-results/item-bundle-${mobile?'portrait':'desktop'}.png`});
 await page.evaluate(name=>{const g=window.__game;g.enterEditor();g.applyWorldData(g.editor.buildEmptyLevelData(38,24));void g.editor.addMixTape();},name);
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.world.decals.some(p=>p.itemType==='item'))).toBe(true);
 await page.evaluate(()=>{const g=window.__game;g.editor.flushPendingAutosave();g.playMostRecentLevel();const p=g.world.decals.find(p=>p.itemType==='item');p.x=g.player.x-16;p.y=g.player.y-16;p.w=32;p.h=32;g.spawnPauseTimer=0;});
 await expect.poll(()=>page.evaluate(()=>window.__game.player.keys?.red)).toBe(1);
 expect(await page.evaluate(()=>({armor:window.__game.player.armor,scanner:window.__game.player.devices.scanner,garage:window.__game.player.unlocks.garage}))).toEqual({armor:3,scanner:true,garage:true});
 await ready(page);await expect.poll(()=>page.evaluate(()=>window.__game.player.keys?.red)).toBe(1);
 expect(await page.evaluate(()=>window.__game.player.devices.scanner)).toBe(true);expect(errors).toEqual([]);
});

test('saved race item renders as a doodad, collects, and keeps rewards on return to a level',async({page})=>{
 test.setTimeout(150000);await ready(page);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  await saveProjectFileAndConfirm('art','Race Item Art',{width:8,height:8,frames:[{pixels:Array(64).fill('#33ddaaff')}]});
  await saveProjectFileAndConfirm('items','Race Reward',{kind:'item',item:{id:'race-reward',name:'Race Reward',artRef:'Race Item Art',widthM:2,heightM:4,rotate:true,effects:[{type:'max-health',amount:2},{type:'key',target:'race-key'}]}});
  g.enterRaceEditor();g.raceEditor.handleMenuAction('race-item');
 });
 await page.locator('.project-browser-row[data-name="Race Reward"]').getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.selectedItemRef)).toBe('Race Reward');
 await page.evaluate(()=>{const g=window.__game;g.player.maxHealth=5;g.player.health=3;g.transitionTo('playing');void g.startRaceTravel({raceName:'Studio Sprint2',carSelection:'specific',carRef:'2022 Subaru WRX2'});});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 const mesh=await page.evaluate(()=>{
  const e=window.__game.raceEditor,s=e.playtestSession,car=e.getRaceSessionCar(s),point=e.getRaceVehicleCollisionContactPoints({session:s,car,tuning:e.getRaceCarTuning(car)})[0];
  const sprite=e.createRaceScenerySprite({x:point.x,z:point.z});sprite.id='saved-race-item';e.ensureRaceScenery().push(sprite);
  const mesh=e.getRaceDoodadWorldMeshes().find(mesh=>mesh.id===sprite.id);
  return {artRef:mesh?.artRef,textured:mesh?.textured,points:mesh?.points.length};
 });
 expect(mesh).toEqual({artRef:'Race Item Art',textured:true,points:4});
 await expect.poll(()=>page.evaluate(()=>window.__game.player.keys?.['race-key'])).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.removedSceneryIds)).toContain('saved-race-item');
 await page.evaluate(()=>window.__game.cancelRaceTravel());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('playing');
 expect(await page.evaluate(()=>({maxHealth:window.__game.player.maxHealth,key:window.__game.player.keys['race-key']}))).toEqual({maxHealth:7,key:1});
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} compact effect form authors a usable boost with named recipients`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.transitionTo('item-editor');},mobile);
 await clickItem(page,'item-effect-add');const form=dialog(page,'Add Item Effect');
 await expect(form.locator('p')).toHaveCount(0);await expect(form.locator('input:visible,select:visible')).toHaveCount(4);
 await expect(form.getByLabel('Recipient',{exact:true})).toHaveValue('player');
 await form.getByLabel('Effect',{exact:true}).selectOption('speed');await form.getByLabel('When',{exact:true}).selectOption('use');
 await form.getByLabel('Speed multiplier',{exact:true}).fill('1.5');await form.getByLabel('Seconds',{exact:true}).fill('2');
 await expect(form.locator('input:visible,select:visible')).toHaveCount(5);
 await page.screenshot({path:`test-results/item-effect-form-${mobile?'portrait':'desktop'}.png`});
 await apply(page,'Add Item Effect');await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.effects.length)).toBe(1);
 await page.evaluate(async()=>{const g=window.__game;g.itemEditor.doodad.name='Pocket Nitro';await g.items.collect(g.itemEditor.doodad,'form-nitro');g.transitionTo('playing');g.transitionTo('pause');g.pauseMenu.getItems().find(row=>row.id==='inventory').onClick();});
 await expect.poll(()=>page.evaluate(()=>window.__game.pauseMenu.getItems().some(row=>row.label==='Use Pocket Nitro ×1'))).toBe(true);
 await page.evaluate(()=>{const menu=window.__game.pauseMenu;menu.selection=0;menu.confirm();});
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('playing');
 await expect.poll(()=>page.evaluate(()=>window.__game.player.itemSpeedMultiplier)).toBe(1.5);
 await expect.poll(()=>page.evaluate(()=>window.__game.player.itemSpeedMultiplier),{timeout:5000}).toBe(1);
 expect(await page.evaluate(()=>window.__game.items.usableItems().length)).toBe(0);
});

test('race inventory boosts the player and fires a slowing projectile at an opponent',async({page})=>{
 test.setTimeout(150000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__game,{hydrateProjectFile}=await import('/src/ui/serverStorage.js'),{loadProjectFile,saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  // Opponents are saved user cars; system presets must not fill race slots.
  await hydrateProjectFile('cars','2022 Subaru WRX2');
  const opponent=structuredClone(loadProjectFile('cars','2022 Subaru WRX2').data);
  await saveProjectFileAndConfirm('cars','Inventory Opponent',opponent);
  g.raceEditor.hydrateProjectCarsFromSavedFiles();
  await hydrateProjectFile('races','Studio Sprint2');const data=loadProjectFile('races','Studio Sprint2').data;
  data.race.competition={...data.race.competition,mode:'ai-race',aiDrivers:g.raceEditor.createRaceAiGrid(1)};
  await saveProjectFileAndConfirm('races','Studio Sprint2',data);
 });
 await page.evaluate(async()=>{const g=window.__game;await g.items.collect({id:'nitro-ci',name:'Nitro',effects:[{type:'speed',when:'use',amount:1.5,duration:3}]},'nitro-ci');void g.startRaceTravel({raceName:'Studio Sprint2',carSelection:'specific',carRef:'2022 Subaru WRX2'});});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.startupFramePending)).toBe(false);
 await page.evaluate(()=>{const e=window.__game.raceEditor;e.toggleRacePause();e.getRacePauseMenuRows().find(row=>row.id==='race-inventory').onClick();});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().some(row=>row.label==='Use Nitro ×1'))).toBe(true);
 await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().find(row=>row.id==='inventory:nitro-ci').onClick());
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.raceInput.paused)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.itemSpeedMultiplier)).toBe(1.5);
 await expect.poll(()=>page.evaluate(()=>Math.abs(window.__game.raceEditor.playtestSession.speedMps)),{timeout:5000}).toBeGreaterThan(0.3);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.itemSpeedMultiplier),{timeout:8000}).toBe(1);
 expect(await page.evaluate(()=>window.__game.items.progress.bags.items['nitro-ci'])).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.aiRuntime.length)).toBe(1);
 await page.evaluate(()=>{
  const e=window.__game.raceEditor,s=e.playtestSession,a=s.aiRuntime[0];
  // Physics/boost behavior was checked above. Freeze the targets for this
  // collision check while input and ItemRuntime keep advancing normally.
  e.updatePlaytest=()=>{};
  a.worldX=s.worldX+Math.sin(s.carYaw)*8;
  a.worldZ=s.worldZ+Math.cos(s.carYaw)*8;
 });
 await expect.poll(()=>page.evaluate(()=>{
  const s=window.__game.raceEditor.playtestSession,a=s.aiRuntime[0];
  const dx=a.worldX-s.worldX,dz=a.worldZ-s.worldZ,forward=dx*Math.sin(s.carYaw)+dz*Math.cos(s.carYaw),side=dx*Math.cos(s.carYaw)-dz*Math.sin(s.carYaw);
  return {inFront:forward>2&&forward<30,aligned:Math.abs(side)<1.8};
 }),{timeout:5000}).toEqual({inFront:true,aligned:true});
 await page.evaluate(async()=>{const g=window.__game;await g.items.collect({id:'slow-ci',name:'Slow shot',effects:[{type:'speed',when:'hit',recipient:'opponents',amount:0.5,duration:4}]},'slow-ci');});
 await page.keyboard.press('KeyU');
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.aiRuntime[0].itemSpeedMultiplier),{timeout:8000}).toBe(0.5);
 expect(await page.evaluate(()=>window.__game.raceEditor.playtestSession.itemSpeedMultiplier)).toBe(1);
 expect(await page.evaluate(()=>window.__game.items.progress.bags.items['slow-ci'])).toBe(0);
 await page.screenshot({path:'test-results/item-race-hit.png'});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.aiRuntime[0].itemSpeedMultiplier),{timeout:8000}).toBe(1);
 expect(errors).toEqual([]);
});
