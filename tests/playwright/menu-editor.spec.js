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
  const car=structuredClone(g.carEditor.selectedCar);car.name='Menu Test Car';await saveProjectFileAndConfirm('cars','Menu Test Car',car);e.menu.parameters.carRef='Menu Test Car';e.menu.parameters.raceRef='Test Track';const raceChoice=e.menu.screens.find(s=>s.id==='events').elements.find(e=>e.id==='event');raceChoice.source='';raceChoice.options=[{label:'Test Track',value:'Test Track'}];
  e.currentMenuName='Menu Browser Test';await e.saveMenu();await e.runAction('starting-menu');
  g.startRaceTravel=async params=>{g.__menuRaceLaunch={raceName:params.raceName,carRef:params.carRef,configuration:params.menuConfiguration};return true;};
  g.transitionTo('title');await g.playStartingMenu();
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('cars');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.resources.cars.has('Menu Test Car'))).toBe(true);
 const previewPixels=()=>page.evaluate(()=>{const g=window.__game,p=g.menuPlayer,e=p.flow.screen.elements.find(e=>e.id==='preview'),w=Math.round(e.w*g.canvas.width),h=Math.round(e.h*g.canvas.height),pixels=g.ctx.getImageData(Math.round(e.x*g.canvas.width),Math.round(e.y*g.canvas.height),w,h).data;let colored=0,hash=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+1]>100&&pixels[i+2]>100)colored++;hash=(Math.imul(hash,31)+pixels[i]+pixels[i+1]*3+pixels[i+2]*7)>>>0;}return {colored,hash}});
 await expect.poll(async()=>(await previewPixels()).colored).toBeGreaterThan(100);const before=(await previewPixels()).hash;await expect.poll(async()=>(await previewPixels()).hash).not.toBe(before);
 await page.screenshot({path:`test-results/menu-${mobile?'portrait':'desktop'}-cars.png`});
 const next=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.id==='next');return {x:(e.x+e.w/2)*p.bounds.w,y:(e.y+e.h/2)*p.bounds.h}});await canvasClick(page,next.x,next.y);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('events');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__game.__menuRaceLaunch?.raceName)).toBe('Test Track');const result=await page.evaluate(()=>window.__game.__menuRaceLaunch);expect(result.carRef).toBe('Menu Test Car');expect(result.configuration.raceRef).toBe('Test Track');expect(errors).toEqual([]);
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

test('menu launches one race and each race owns its next-race or return destination',async({page})=>{
 test.setTimeout(150000);await ready(page,false);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__game,{loadProjectFile,saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  const base=loadProjectFile('races','Studio Sprint2').data;
  for(const [name,finish] of [['Menu Chain First',{type:'race',targetRace:'Menu Chain Last'}],['Menu Chain Last',{type:'return-to-origin'}]]){
   const document=structuredClone(base),race=document.race||document;race.id=name;race.name=name;race.finishBehavior=finish;await saveProjectFileAndConfirm('races',name,document);
  }
  const doc=g.menuEditor.menu;doc.parameters.carRef='2022 Subaru WRX2';doc.parameters.difficulty='easy';doc.parameters.weapons=['chainsaw'];
  await g.menuPlayer.open(doc);g.menuPlayer.flow.goTo('events');window.__menuRaceRun=g.menuPlayer.flow.run({type:'race',target:'Menu Chain First'});
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.name)).toBe('Menu Chain First');
 await page.evaluate(()=>window.__game.raceEditor.finishPlaytest());
 await expect.poll(()=>page.evaluate(()=>{const e=window.__game.raceEditor;return e.playtestSession?.running&&e.selectedRace.name}),{timeout:60000}).toBe('Menu Chain Last');
 expect(await page.evaluate(()=>window.__game.raceEditor.playtestSession.menuConfiguration.weapons)).toEqual(['chainsaw']);
 expect(await page.evaluate(()=>window.__game.raceTravelSession.originState)).toBe('menu-player');
 await page.evaluate(()=>window.__game.raceEditor.finishPlaytest());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('events');
});

async function designerButton(page,id){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect.poll(()=>page.evaluate(id=>window.__game.menuEditor.buttons.some(b=>b.id===id),id)).toBe(true);
 const p=await page.evaluate(id=>{const g=window.__game,b=[...g.menuEditor.buttons].reverse().find(b=>b.id===id).bounds,r=g.canvas.getBoundingClientRect();return {x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height}},id);
 await page.mouse.click(p.x,p.y);
}
async function designerCommand(page,mobile,root,id){if(mobile)await designerButton(page,'menu');await designerButton(page,root);await designerButton(page,id);}
async function addDesignerWidget(page,type){await designerButton(page,'widget-add');const d=page.getByRole('dialog',{name:'Add Widget',exact:true});await d.getByLabel('Widget',{exact:true}).selectOption(type);await d.getByRole('button',{name:'Apply',exact:true}).click();}
async function applyDialog(page,name){await page.getByRole('dialog',{name,exact:true}).getByRole('button',{name:'Apply',exact:true}).click();}

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} designer authors connected widgets and imports an image through visible controls`,async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 await page.evaluate(async()=>{const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('cars','Widget Preview Car',structuredClone(g.carEditor.selectedCar))});
 if(mobile){await designerButton(page,'menu');expect(await page.evaluate(()=>window.__game.menuEditor.buttons.map(b=>b.id))).not.toContain('ground');await designerButton(page,'menu');}
 await designerCommand(page,mobile,'screens','screen-new');
 // Connect a car rotator to a slider using only the exposed setup dialogs.
 await addDesignerWidget(page,'car-preview');let d=page.getByRole('dialog',{name:'Car rotator Setup',exact:true});await d.getByLabel('Car',{exact:true}).selectOption('Widget Preview Car');await d.getByLabel('Rotation',{exact:true}).selectOption('parameter');await d.getByLabel('Rotation parameter (degrees)').fill('carAngle');await applyDialog(page,'Car rotator Setup');
 await designerCommand(page,mobile,'properties','element-properties');d=page.getByRole('dialog',{name:'Layout & Style',exact:true});await d.getByLabel('Y (% of screen)',{exact:true}).fill('35');await d.getByLabel('Height (% of screen)',{exact:true}).fill('18');await applyDialog(page,'Layout & Style');
 await addDesignerWidget(page,'slider');d=page.getByRole('dialog',{name:'Slider Setup',exact:true});await d.getByLabel('Slider controls').selectOption('carAngle');await applyDialog(page,'Slider Setup');
 expect(await page.evaluate(()=>{const e=window.__game.menuEditor;return e.screen.elements.find(e=>e.type==='car-preview').angleBinding===e.element.binding})).toBe(true);
 // A property display reads the custom item object; a button changes that object.
 await designerCommand(page,mobile,'flow','menu-parameters');d=page.getByRole('dialog',{name:'Configuration Parameters',exact:true});await d.getByRole('textbox').fill('item = {"name":"Sword","damage":12}\ncarAngle = 180');await applyDialog(page,'Configuration Parameters');
 await addDesignerWidget(page,'property-display');d=page.getByRole('dialog',{name:'Property display Source',exact:true});await d.getByLabel('Data source').selectOption('parameters');await d.getByLabel('Selected object parameter').fill('item');await applyDialog(page,'Property display Source');await page.getByRole('dialog',{name:'Choose Object',exact:true}).getByLabel('Label',{exact:true}).fill('Damage');await applyDialog(page,'Choose Object');await page.getByRole('dialog',{name:'Displayed Property',exact:true}).getByLabel('Property path').fill('damage');await applyDialog(page,'Displayed Property');
 // Move the property display with the real layout form.
 await designerCommand(page,mobile,'properties','element-properties');d=page.getByRole('dialog',{name:'Layout & Style',exact:true});await d.getByLabel('Y (% of screen)',{exact:true}).fill('55');await applyDialog(page,'Layout & Style');
 await addDesignerWidget(page,'button');await page.getByRole('dialog',{name:'Button',exact:true}).getByLabel('Button text').fill('Choose Axe');await applyDialog(page,'Button');await page.getByRole('dialog',{name:'Widget Action',exact:true}).getByLabel('When activated').selectOption('set-param');await applyDialog(page,'Widget Action');d=page.getByRole('dialog',{name:'Set a parameter',exact:true});await d.getByLabel('Parameter',{exact:true}).fill('item');await d.getByLabel('Value (text, number, true/false, or JSON)').fill('{"name":"Axe","damage":35}');await applyDialog(page,'Set a parameter');
 await designerCommand(page,mobile,'properties','element-properties');await page.getByRole('dialog',{name:'Layout & Style',exact:true}).getByLabel('Y (% of screen)',{exact:true}).fill('75');await applyDialog(page,'Layout & Style');
 // Import a PNG, then verify its decoded pixels are available to the renderer.
 await addDesignerWidget(page,'image');await page.getByRole('dialog',{name:'Image Source',exact:true}).getByLabel('Image source').selectOption('device');const chooserPromise=page.waitForEvent('filechooser');await applyDialog(page,'Image Source');const chooser=await chooserPromise;
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=4;const x=c.getContext('2d');x.fillStyle='#ff00ff';x.fillRect(0,0,8,4);return c.toDataURL().split(',')[1]});await chooser.setFiles({name:'designer.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});const imageName=`Designer Image ${mobile?'Portrait':'Desktop'}`;await page.getByRole('dialog',{name:'Save Imported Image',exact:true}).getByLabel('Artwork name').fill(imageName);await applyDialog(page,'Save Imported Image');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.element.artRef)).toBe(imageName);
 await expect.poll(()=>page.evaluate(()=>{const e=window.__game.menuEditor;return e.resources.art(e.element.artRef)?.width})).toBe(8);
 await designerCommand(page,mobile,'properties','element-properties');d=page.getByRole('dialog',{name:'Layout & Style',exact:true});await d.getByLabel('X (% of screen)',{exact:true}).fill('55');await d.getByLabel('Y (% of screen)',{exact:true}).fill('35');await d.getByLabel('Width (% of screen)',{exact:true}).fill('35');await d.getByLabel('Height (% of screen)',{exact:true}).fill('18');await applyDialog(page,'Layout & Style');
 await designerCommand(page,mobile,'screens','screen-start');
 // Save, open the exact file again, and exercise the authored button in preview.
 await designerCommand(page,mobile,'file','save-as');const name=`Widget Designer ${mobile?'Portrait':'Desktop'}`;await page.getByPlaceholder('Filename').fill(name);await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.currentMenuName)).toBe(name);
 await designerCommand(page,mobile,'file','open');await page.locator('.project-browser-row').filter({hasText:name}).getByRole('button',{name:'Open',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.elements.length)).toBe(5);
 await page.screenshot({path:`test-results/menu-designer-${mobile?'portrait':'desktop'}.png`});
 if(mobile)await designerButton(page,'menu-preview');else await designerCommand(page,false,'view','menu-preview');
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');await page.waitForFunction(()=>window.__game.menuPlayer.bounds?.w>0);
 const slider=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='slider');return {x:(e.x+e.w*0.75)*p.bounds.w,y:(e.y+e.h/2)*p.bounds.h}});await canvasClick(page,slider.x,slider.y);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.parameters.carAngle)).toBe(270);
 const button=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='button');return {x:(e.x+e.w/2)*p.bounds.w,y:(e.y+e.h/2)*p.bounds.h}});await page.evaluate(()=>{const g=window.__game,original=g.ctx.fillText.bind(g.ctx);g.__widgetLabels=[];g.ctx.fillText=(text,...args)=>{if(String(text).startsWith('Damage:'))g.__widgetLabels.push(text);return original(text,...args)}});await canvasClick(page,button.x,button.y);
 await expect.poll(()=>page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='property-display');return p.resources.property(e,p.flow.parameters)})).toBe(35);await expect.poll(()=>page.evaluate(()=>window.__game.__widgetLabels.includes('Damage: 35'))).toBe(true);expect(errors).toEqual([]);
});
