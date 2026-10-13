import {test,expect} from '@playwright/test';
import {seedRaceRuntimeFixtures} from './helpers/race-runtime-fixtures.js';

// Keep the launch preference private to each browser test, including reloads.
test.beforeEach(async({page})=>{const preferences=new Map();await page.route('**/__storage/file*',async route=>{const request=route.request(),url=new URL(request.url());if(request.method()==='POST'){const body=request.postDataJSON();if(body?.folder==='settings'&&['menu-launch','menu-settings'].includes(body.name)){preferences.set(body.name,body.data);return route.fulfill({json:{ok:true}});}}else if(url.searchParams.get('folder')==='settings'&&['menu-launch','menu-settings'].includes(url.searchParams.get('name')))return route.fulfill({json:{ok:true,file:{data:preferences.get(url.searchParams.get('name'))||{value:null}}}});return route.continue();});});

async function ready(page,mobile){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.title.setScreen('graphics');g.handleTitleMenuAction('menu-editor');},mobile);await page.waitForFunction(()=>window.__game.menuEditor.menuBounds?.w>0);}
async function canvasClick(page,x,y){const point=await page.evaluate(({x,y})=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return {x:r.x+x*r.width/g.viewport.width,y:r.y+y*r.height/g.viewport.height}},{x,y});await page.mouse.click(point.x,point.y);}

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} menu designer edits, saves and plays the start/car/event flow`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 const shell=await page.evaluate(()=>({state:window.__game.state,buttons:window.__game.menuEditor.buttons.map(b=>b.id)}));expect(shell.state).toBe('menu-editor');if(mobile)for(const id of ['menu','undo','redo','menu-preview'])expect(shell.buttons).toContain(id);
 const drag=await page.evaluate(()=>{const g=window.__game,e=g.menuEditor,b=e.menuBounds,title=e.screen.elements.find(e=>e.id==='title'),r=g.canvas.getBoundingClientRect();return {x:r.x+(b.x+(title.x+title.w/2)*b.w)*r.width/g.viewport.width,y:r.y+(b.y+(title.y+title.h/2)*b.h)*r.height/g.viewport.height,before:title.x}});await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.x+20,drag.y+10);await page.mouse.up();expect(await page.evaluate(()=>window.__game.menuEditor.element.x)).toBeGreaterThan(drag.before);await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.elements.find(e=>e.id==='title').x)).toBe(drag.before);
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
 await page.setViewportSize({width:1000,height:700});await ready(page,false);await page.evaluate(async()=>{const e=window.__game.menuEditor;e.currentMenuName='Persistent Menu';await e.runAction('starting-menu');await window.__game.menuPlayer.settings.set('settings.fxVolume',0.2);await window.__game.menuPlayer.settings.set('settings.musicVolume',0.7);await window.__game.menuPlayer.settings.set('settings.brightness',1.1);await window.__game.menuPlayer.settings.set('input.left','KeyQ')});await page.reload();await page.waitForFunction(()=>window.__gameReady&&window.__game.state!=='loading');await page.evaluate(()=>window.__game.playStartingMenu());await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow?.document.name)).toBe('Persistent Menu');
 const restored=await page.evaluate(()=>{const g=window.__game;return {fx:g.audio.effectsVolume,music:g.audio.midiBusVolume,brightness:g.canvas.style.filter,left:g.input.actionKeymap.left}});expect(restored).toEqual({fx:0.2,music:0.7,brightness:'brightness(1.1)',left:['KeyQ']});
 await page.evaluate(async()=>{const g=window.__game;g.menuPlayer.flow.stop();g.enterMenuEditor();await g.previewMenu(g.menuEditor.menu)});await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});


test('movie completion loads a real level with the selected configuration',async({page})=>{
 await ready(page,false);
 await page.evaluate(async()=>{
  const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js'),{createDefaultCutscene}=await import('/src/ui/CutsceneEditor.js');
  const movie=createDefaultCutscene();movie.durationMs=500;movie.clips=[];
  await saveProjectFileAndConfirm('cutscenes','Menu Short Intro',movie);
  const level=g.buildWorldData();level.name='Menu Destination';await saveProjectFileAndConfirm('levels','Menu Destination',level);
  const doc=g.menuEditor.menu;doc.parameters.weapons=['chainsaw'];doc.parameters['character.color']='#3388ff';
  await g.menuPlayer.open(doc);window.__menuMovieRun=g.menuPlayer.flow.run({type:'movie',target:'Menu Short Intro',then:{type:'level',target:'Menu Destination'}});
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('playing');expect(await page.evaluate(()=>window.__game.menuParameters.weapons)).toEqual(['chainsaw']);expect(await page.evaluate(()=>window.__game.menuParameters['character.color'])).toBe('#3388ff');
});

test('Grand Prix launches actual races, forwards configuration and advances after finish',async({page})=>{
 test.setTimeout(150000);await ready(page,false);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__game,doc=g.menuEditor.menu;doc.parameters.carRef='2022 Subaru WRX2';doc.parameters.difficulty='easy';doc.grandPrix=[{id:'cup',name:'Cup',races:[{raceRef:'Studio Sprint2'},{raceRef:'Studio Sprint2'}]}];
  await g.menuPlayer.open(doc);window.__menuGrandPrixRun=g.menuPlayer.flow.run({type:'grand-prix',target:'cup'});
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 expect(await page.evaluate(()=>window.__game.raceEditor.playtestSession.menuConfiguration.grandPrixRound)).toBe(1);
 await page.evaluate(()=>window.__game.completeRaceTravel());
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.menuConfiguration?.grandPrixRound),{timeout:60000}).toBe(2);
 await page.evaluate(()=>window.__game.completeRaceTravel());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');expect(await page.evaluate(()=>window.__game.menuPlayer.flow.grandPrix)).toBe(null);
});
