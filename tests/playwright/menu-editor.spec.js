import {test,expect} from '@playwright/test';

async function ready(page,mobile){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.title.setScreen('graphics');g.handleTitleMenuAction('menu-editor');},mobile);await page.waitForFunction(()=>window.__game.menuEditor.menuBounds?.w>0);}
async function canvasClick(page,x,y){const point=await page.evaluate(({x,y})=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return {x:r.x+x*r.width/g.viewport.width,y:r.y+y*r.height/g.viewport.height}},{x,y});await page.mouse.click(point.x,point.y);}

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} menu designer edits, saves and plays the start/car/event flow`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 const shell=await page.evaluate(()=>({state:window.__game.state,buttons:window.__game.menuEditor.buttons.map(b=>b.id)}));expect(shell.state).toBe('menu-editor');if(mobile)for(const id of ['menu','undo','redo','menu-preview'])expect(shell.buttons).toContain(id);
 await page.evaluate(()=>{void window.__game.menuEditor.handleMenuAction('screen-properties')});const dialog=page.getByRole('dialog',{name:'Screen Properties',exact:true});await dialog.getByLabel('Screen name').fill('Welcome');await dialog.getByLabel('Tap / Space / Start action').selectOption('none');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.name)).toBe('Welcome');
 await page.evaluate(()=>window.__game.menuEditor.handleMenuAction('undo'));await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.name)).toBe('Splash');
 await page.evaluate(async()=>{
  const g=window.__game,e=g.menuEditor,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  const car=structuredClone(g.carEditor.selectedCar);car.name='Menu Test Car';await saveProjectFileAndConfirm('cars','Menu Test Car',car);e.menu.parameters.carRef='Menu Test Car';e.menu.grandPrix=[{id:'cup',name:'Test Cup',races:[{raceRef:'Test Track'}]}];
  e.currentMenuName='Menu Browser Test';await e.saveMenu();await e.runAction('starting-menu');
  g.startRaceTravel=async params=>{g.__menuRaceLaunch={raceName:params.raceName,carRef:params.carRef,configuration:params.menuConfiguration};return true;};
  g.transitionTo('title');await g.playStartingMenu();
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('cars');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.resources.cars.has('Menu Test Car'))).toBe(true);
 const before=await page.evaluate(()=>window.__game.menuPlayer.flow.time);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__game.menuPlayer.flow.time)).toBeGreaterThan(before);
 await page.screenshot({path:`test-results/menu-${mobile?'portrait':'desktop'}-cars.png`});
 const next=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.id==='next');return {x:(e.x+e.w/2)*p.bounds.w,y:(e.y+e.h/2)*p.bounds.h}});await canvasClick(page,next.x,next.y);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('events');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__game.__menuRaceLaunch?.raceName)).toBe('Test Track');const result=await page.evaluate(()=>window.__game.__menuRaceLaunch);expect(result.carRef).toBe('Menu Test Car');expect(result.configuration.grandPrixRound).toBe(1);expect(errors).toEqual([]);
});

test('saved start menu survives a fresh page and preview returns to authoring',async({page})=>{
 await page.setViewportSize({width:1000,height:700});await ready(page,false);await page.evaluate(async()=>{const e=window.__game.menuEditor;e.currentMenuName='Persistent Menu';await e.runAction('starting-menu')});await page.reload();await page.waitForFunction(()=>window.__gameReady&&window.__game.state!=='loading');await page.evaluate(()=>window.__game.playStartingMenu());await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow?.document.name)).toBe('Persistent Menu');
 await page.evaluate(async()=>{const g=window.__game;g.menuPlayer.flow.stop();g.enterMenuEditor();await g.previewMenu(g.menuEditor.menu)});await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});
