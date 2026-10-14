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
 const previewPixels=()=>page.evaluate(()=>{const g=window.__game,p=g.menuPlayer,e=p.flow.screen.elements.find(e=>e.id==='preview'),w=Math.round(e.w*p.bounds.w),h=Math.round(e.h*p.bounds.h),pixels=g.ctx.getImageData(Math.round(p.bounds.x+e.x*p.bounds.w),Math.round(p.bounds.y+e.y*p.bounds.h),w,h).data;let colored=0,hash=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+1]>100&&pixels[i+2]>100)colored++;hash=(Math.imul(hash,31)+pixels[i]+pixels[i+1]*3+pixels[i+2]*7)>>>0;}return {colored,hash}});
 await expect.poll(async()=>(await previewPixels()).colored).toBeGreaterThan(100);const before=(await previewPixels()).hash;await expect.poll(async()=>(await previewPixels()).hash).not.toBe(before);
 await page.screenshot({path:`test-results/menu-${mobile?'portrait':'desktop'}-cars.png`});
 const next=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.id==='next');return {x:p.bounds.x+(e.x+e.w/2)*p.bounds.w,y:p.bounds.y+(e.y+e.h/2)*p.bounds.h}});await canvasClick(page,next.x,next.y);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('events');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__game.__menuRaceLaunch?.raceName)).toBe('Test Track');const result=await page.evaluate(()=>window.__game.__menuRaceLaunch);expect(result.carRef).toBe('Menu Test Car');expect(result.configuration.raceRef).toBe('Test Track');expect(errors).toEqual([]);
});

test('saved start menu survives a fresh page and preview returns to authoring',async({page})=>{
 await page.setViewportSize({width:1000,height:700});await ready(page,false);await page.evaluate(async()=>{const e=window.__game.menuEditor;e.currentMenuName='Persistent Menu';await e.runAction('starting-menu');await window.__game.menuPlayer.settings.set('settings.fxVolume',0.2);await window.__game.menuPlayer.settings.set('settings.musicVolume',0.7);await window.__game.menuPlayer.settings.set('settings.brightness',1.1);await window.__game.menuPlayer.settings.set('input.left','KeyQ')});await page.reload();await page.waitForFunction(()=>window.__gameReady&&window.__game.state!=='loading');await page.evaluate(()=>window.__game.playStartingMenu());await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow?.document.name)).toBe('Persistent Menu');
 const restored=await page.evaluate(()=>{const g=window.__game;return {fx:g.audio.effectsVolume,music:g.audio.midiBusVolume,brightness:g.canvas.style.filter,left:g.input.actionKeymap.left}});expect(restored).toEqual({fx:0.2,music:0.7,brightness:'brightness(1.1)',left:['KeyQ']});
 await page.evaluate(async()=>{const g=window.__game;g.menuPlayer.flow.stop();g.enterMenuEditor();await g.previewMenu(g.menuEditor.menu)});await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});


test('menu preview plays a movie then loads a real level and returns to authoring',async({page})=>{
 await ready(page,false);
 await page.evaluate(async()=>{
  const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js'),{createDefaultCutscene}=await import('/src/ui/CutsceneEditor.js');
  const movie=createDefaultCutscene();movie.durationMs=500;movie.clips=[];
  await saveProjectFileAndConfirm('cutscenes','Menu Short Intro',movie);
  const level=g.buildWorldData();level.name='Menu Destination';await saveProjectFileAndConfirm('levels','Menu Destination',level);
  const doc=g.menuEditor.menu;doc.parameters.weapons=['chainsaw'];doc.parameters['character.color']='#3388ff';
  window.__menuAuthoringSnapshot=JSON.stringify(g.menuEditor.snapshot());window.__menuOriginalSpawn=JSON.stringify(g.world.spawn);await g.previewMenu(doc);window.__menuMovieRun=g.menuPlayer.flow.run({type:'movie',target:'Menu Short Intro',then:{type:'level',target:'Menu Destination'}});
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('playing');expect(await page.evaluate(()=>window.__game.menuParameters.weapons)).toEqual(['chainsaw']);expect(await page.evaluate(()=>window.__game.menuParameters['character.color'])).toBe('#3388ff');expect(await page.evaluate(()=>window.__game.playtestActive)).toBe(true);
 await page.evaluate(()=>window.__game.returnToEditorFromPlaytest());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');expect(await page.evaluate(()=>JSON.stringify(window.__game.menuEditor.snapshot())===window.__menuAuthoringSnapshot)).toBe(true);expect(await page.evaluate(()=>JSON.stringify(window.__game.world.spawn)===window.__menuOriginalSpawn)).toBe(true);
});

for(const destination of ['menu','level'])test(`menu preview launches real chained races and returns from ${destination}`,async({page})=>{
 test.setTimeout(150000);await ready(page,false);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async destination=>{
  const g=window.__game,{loadProjectFile,saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  if(destination==='level')await saveProjectFileAndConfirm('levels','Menu Race Destination',g.buildWorldData());
  const base=loadProjectFile('races','Studio Sprint2').data;
  for(const [name,finish] of [['Menu Chain First',{type:'race',targetRace:'Menu Chain Last'}],['Menu Chain Last',destination==='level'?{type:'level',targetLevel:'Menu Race Destination',spawnX:2,spawnY:2}:{type:'return-to-origin'}]]){
   const document=structuredClone(base),race=document.race||document;race.id=name;race.name=name;race.finishBehavior=finish;await saveProjectFileAndConfirm('races',name,document);
  }
  const doc=g.menuEditor.menu;doc.parameters.carRef='2022 Subaru WRX2';doc.parameters.difficulty='easy';doc.parameters.weapons=['chainsaw'];
  await g.previewMenu(doc);g.menuPlayer.flow.goTo('events');window.__menuRaceRun=g.menuPlayer.flow.run({type:'race',target:'Menu Chain First'});
 },destination);
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.name)).toBe('Menu Chain First');
 await page.evaluate(()=>window.__game.raceEditor.finishPlaytest());
 await expect.poll(()=>page.evaluate(()=>{const e=window.__game.raceEditor;return e.playtestSession?.running&&e.selectedRace.name}),{timeout:60000}).toBe('Menu Chain Last');
 expect(await page.evaluate(()=>window.__game.raceEditor.playtestSession.menuConfiguration.weapons)).toEqual(['chainsaw']);
 expect(await page.evaluate(()=>window.__game.raceTravelSession.originState)).toBe('menu-player');
 await page.evaluate(()=>window.__game.raceEditor.finishPlaytest());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe(destination==='level'?'playing':'menu-player');
 if(destination==='menu'){expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('events');await page.evaluate(()=>window.__game.menuPlayer.flow.stop());}else{expect(await page.evaluate(()=>window.__game.playtestActive)).toBe(true);await page.evaluate(()=>window.__game.returnToEditorFromPlaytest());}
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});

async function designerButton(page,id){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect.poll(()=>page.evaluate(id=>window.__game.menuEditor.buttons.some(b=>b.id===id),id)).toBe(true);
 const p=await page.evaluate(id=>{const g=window.__game,b=[...g.menuEditor.buttons].reverse().find(b=>b.id===id).bounds,r=g.canvas.getBoundingClientRect();return {x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height}},id);
 await page.mouse.click(p.x,p.y);
}
async function designerCommand(page,mobile,root,id){if(mobile)await designerButton(page,'menu');await designerButton(page,root);await designerButton(page,id);}
async function addDesignerWidget(page,type){await designerButton(page,'widget-add');await expect(page.getByRole('dialog')).toHaveCount(0);await designerButton(page,`pick-widget:${type}`);await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.element?.type)).toBe(type);await expect(page.getByRole('dialog')).toHaveCount(0);await designerButton(page,'element-setup');}
async function designerDrawerCommand(page,drawer,id){await designerButton(page,`${drawer}-drawer`);await designerButton(page,id);}
async function applyDialog(page,name){await page.getByRole('dialog',{name,exact:true}).getByRole('button',{name:'Apply',exact:true}).click();}

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} designer authors connected widgets and imports an image through visible controls`,async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 await page.evaluate(async()=>{const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('cars','Widget Preview Car',structuredClone(g.carEditor.selectedCar))});
 if(mobile){await designerButton(page,'menu');expect(await page.evaluate(()=>window.__game.menuEditor.buttons.map(b=>b.id))).not.toContain('ground');await designerButton(page,'menu');}
 await designerCommand(page,mobile,'screens','screen-new');
 // Connect a car rotator to a slider using only the exposed setup dialogs.
 await addDesignerWidget(page,'car-preview');let d=page.getByRole('dialog',{name:'Car rotator Properties',exact:true});await d.getByLabel('Car',{exact:true}).selectOption('Widget Preview Car');await d.getByLabel('Rotation',{exact:true}).selectOption('parameter');await d.getByLabel('Rotation parameter (degrees)').fill('carAngle');await applyDialog(page,'Car rotator Properties');
 await designerCommand(page,mobile,'properties','element-properties');d=page.getByRole('dialog',{name:'Layout & Style',exact:true});await d.getByLabel('Y (% of screen)',{exact:true}).fill('35');await d.getByLabel('Height (% of screen)',{exact:true}).fill('18');await applyDialog(page,'Layout & Style');
 await addDesignerWidget(page,'slider');d=page.getByRole('dialog',{name:'Slider Properties',exact:true});await d.getByLabel('Slider controls').selectOption('carAngle');await applyDialog(page,'Slider Properties');
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
 const designedScreen=await page.evaluate(()=>window.__game.menuEditor.screenId);
 // Save, open the exact file again, and exercise the authored button in preview.
 await designerCommand(page,mobile,'file','save-as');const name=`Widget Designer ${mobile?'Portrait':'Desktop'}`;await page.getByPlaceholder('Filename').fill(name);await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.currentMenuName)).toBe(name);
 await designerCommand(page,mobile,'file','open');await page.locator('.project-browser-row').filter({hasText:name}).getByRole('button',{name:'Open',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screenId)).toBe('splash');await designerCommand(page,mobile,'screens','screen-select');await designerButton(page,`pick-screen:${designedScreen}`);await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.elements.length)).toBe(5);
 await page.screenshot({path:`test-results/menu-designer-${mobile?'portrait':'desktop'}.png`});
 if(mobile)await designerButton(page,'menu-preview');else await designerCommand(page,false,'view','menu-preview');
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');await page.waitForFunction(()=>window.__game.menuPlayer.bounds?.w>0);expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe(designedScreen);expect(await page.evaluate(()=>window.__game.menuEditor.menu.startScreen)).toBe('splash');
 const slider=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='slider');return {x:p.bounds.x+(e.x+e.w*0.75)*p.bounds.w,y:p.bounds.y+(e.y+e.h/2)*p.bounds.h}});await canvasClick(page,slider.x,slider.y);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.parameters.carAngle)).toBe(270);
 const button=await page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='button');return {x:p.bounds.x+(e.x+e.w/2)*p.bounds.w,y:p.bounds.y+(e.y+e.h/2)*p.bounds.h}});await page.evaluate(()=>{const g=window.__game,original=g.ctx.fillText.bind(g.ctx);g.__widgetLabels=[];g.ctx.fillText=(text,...args)=>{if(String(text).startsWith('Damage:'))g.__widgetLabels.push(text);return original(text,...args)}});await canvasClick(page,button.x,button.y);
 await expect.poll(()=>page.evaluate(()=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='property-display');return p.resources.property(e,p.flow.parameters)})).toBe(35);await expect.poll(()=>page.evaluate(()=>window.__game.__widgetLabels.includes('Damage: 35'))).toBe(true);expect(errors).toEqual([]);
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} bottom widget dropdown and current-screen preview work without changing the start screen`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 const layout=await page.evaluate(()=>{const e=window.__game.menuEditor;return {hotbar:e.menuHotbarBounds,canvas:e.menuBounds}});expect(layout.hotbar.y).toBeGreaterThanOrEqual(layout.canvas.y+layout.canvas.h);
 await designerButton(page,'widget-add');await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__game.menuEditor.pickerLayout.buttons.map(b=>b.id))).toContain('pick-widget:button');
 await page.screenshot({path:`test-results/menu-widget-dropdown-${mobile?'portrait':'desktop'}.png`});
 await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.menuPicker)).toBe(null);expect(await page.evaluate(()=>window.__game.state)).toBe('menu-editor');
 await designerCommand(page,mobile,'screens','screen-select');await designerButton(page,'pick-screen:events');await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screenId)).toBe('events');
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:text');await designerButton(page,'element-setup');await page.getByRole('dialog',{name:'Text Properties',exact:true}).getByLabel('Label',{exact:true}).fill('Unsaved current screen');await applyDialog(page,'Text Properties');
 const before=await page.evaluate(()=>({screenId:window.__game.menuEditor.screenId,elementId:window.__game.menuEditor.elementId,menu:JSON.stringify(window.__game.menuEditor.menu)}));
 if(mobile)await designerButton(page,'menu-preview');else await designerCommand(page,false,'view','menu-preview');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow?.screenId)).toBe('events');expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screen.elements.some(e=>e.label==='Unsaved current screen'))).toBe(true);
 await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');expect(await page.evaluate(()=>({screenId:window.__game.menuEditor.screenId,elementId:window.__game.menuEditor.elementId,menu:JSON.stringify(window.__game.menuEditor.menu)}))).toEqual(before);
 await designerCommand(page,mobile,mobile?'preview':'view','menu-preview-start');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('splash');
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} bottom Properties and clipboard controls edit the selected widget`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:text');
 const original=await page.evaluate(()=>window.__game.menuEditor.elementId);
 expect(await page.evaluate(async()=>{const e=window.__game.menuEditor,labels=[],draw=e.drawButton;e.drawButton=function(ctx,b,label,...args){labels.push(label);return draw.call(this,ctx,b,label,...args)};await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));e.drawButton=draw;return labels;})).toContain('Properties');
 await designerButton(page,'element-setup');await page.getByRole('dialog',{name:'Text Properties',exact:true}).getByLabel('Label',{exact:true}).fill('Clipboard content');await applyDialog(page,'Text Properties');
 await designerDrawerCommand(page,'clip','copy');await designerDrawerCommand(page,'clip','paste');
 let copied=await page.evaluate(()=>({id:window.__game.menuEditor.elementId,label:window.__game.menuEditor.element.label,count:window.__game.menuEditor.screen.elements.length}));expect(copied.id).not.toBe(original);expect(copied.label).toBe('Clipboard content');
 await designerDrawerCommand(page,'clip','cut');expect(await page.evaluate(()=>window.__game.menuEditor.screen.elements.length)).toBe(copied.count-1);
 await designerDrawerCommand(page,'clip','paste');expect(await page.evaluate(()=>window.__game.menuEditor.element.label)).toBe('Clipboard content');
 await designerDrawerCommand(page,'clip','delete');expect(await page.evaluate(()=>window.__game.menuEditor.screen.elements.length)).toBe(copied.count-1);
 await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.screen.elements.length)).toBe(copied.count);
 await designerButton(page,'clip-drawer');
 await page.screenshot({path:`test-results/menu-clipboard-${mobile?'portrait':'desktop'}.png`});
});

test('car turntable centers padded directional art and off-origin 3D geometry at all eight angles',async({page})=>{
 await ready(page,false);
 const result=await page.evaluate(async()=>{
  const {MenuCarPreview}=await import('/src/menus/MenuCarPreview.js'),THREE=await import('/src/vendorBridge/three.js');
  const editor=window.__game.carEditor,preview=new MenuCarPreview(editor),car=structuredClone(editor.selectedCar);
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');
  const original=editor.getRaceArtSpriteCanvas;const frames=Array.from({length:8},(_,i)=>{const c=document.createElement('canvas');c.width=100;c.height=80;const x=c.getContext('2d');x.fillStyle='#ff00ff';x.fillRect(5+i*3,8+i*2,40,30);return c;});
  editor.getRaceArtSpriteCanvas=(_ref,{frameIndex=0}={})=>frames[frameIndex];
  const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
  car.art={body:'padded',layerVisibility:{body:true,tires:false,brakes:false,shadow:false},angleLayers:Object.fromEntries(slots.map((slot,i)=>[slot,{body:{artRef:'padded',frameIndex:i,transforms:{bodyScaleX:2,bodyScaleY:1.5,bodyOffsetX:i-4,bodyOffsetY:4-i,bodyRotationDeg:i*8-28}}}]))};
  const measure=()=>{const data=ctx.getImageData(0,0,320,240).data;let l=320,r=-1,t=240,b=-1;for(let y=0;y<240;y++)for(let x=0;x<320;x++)if(data[(y*320+x)*4+3]>20){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {x:(l+r+1)/2,y:(t+b+1)/2,w:r-l+1,h:b-t+1};};
  const sprite=[];try{for(let i=0;i<8;i++){ctx.clearRect(0,0,320,240);preview.drawSprite(ctx,{x:0,y:0,w:320,h:240},car,{artRef:'padded',frameIndex:i,viewSlot:slots[i],mirrored:i%2===1});sprite.push(measure());}}finally{editor.getRaceArtSpriteCanvas=original;}
  const model=new MenuCarPreview({getRaceCarDimensions:()=>({lengthM:4,widthM:2}),addRaceThreeProceduralCar(holder){if(holder.dynamicCarGroup)return;const group=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,4),new THREE.MeshBasicMaterial({color:'#00ffff'}));mesh.position.set(3,1,5);group.add(mesh);holder.scene.add(group);holder.dynamicCarGroup=group;},clearRaceThreeDynamicCar(holder){holder.dynamicCarGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}});
  const solid=[];for(let i=0;i<8;i++){ctx.clearRect(0,0,320,240);model.draw(ctx,{x:0,y:0,w:320,h:240},{tuning:{}},i*Math.PI/4,0);solid.push(measure());}model.dispose();return {sprite,solid};
 });
 for(const b of result.sprite){expect(b.w).toBeGreaterThan(10);expect(Math.abs(b.x-160)).toBeLessThanOrEqual(2);expect(Math.abs(b.y-120)).toBeLessThanOrEqual(2);}
 for(const b of result.solid){expect(b.w).toBeGreaterThan(20);expect(Math.abs(b.x-160)).toBeLessThanOrEqual(2);expect(Math.abs(b.y-120)).toBeLessThanOrEqual(2);}
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} shapes and containers move and reorder together from the hotbar`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:container');const group=await page.evaluate(()=>window.__game.menuEditor.elementId);
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:shape');const child=await page.evaluate(()=>window.__game.menuEditor.elementId);
 await designerButton(page,'element-setup');const props=page.getByRole('dialog',{name:'Shape Properties',exact:true});await props.getByLabel('Shape',{exact:true}).selectOption('ellipse');await props.getByLabel('Fill color').fill('#e347d7');await props.getByLabel('Outline width (pixels)').fill('3');await applyDialog(page,'Shape Properties');
 const before=await page.evaluate(()=>structuredClone(window.__game.menuEditor.element));expect(before.parentId).toBe(group);
 await designerCommand(page,mobile,'properties','element-select');await designerButton(page,`pick-layer:${group}`);
 const point=await page.evaluate(()=>{const g=window.__game,e=g.menuEditor,b=e.menuBounds,c=g.canvas.getBoundingClientRect();return {x:c.x+(b.x+e.element.x*b.w+2)*c.width/g.viewport.width,y:c.y+(b.y+e.element.y*b.h+2)*c.height/g.viewport.height,dx:20*c.width/g.viewport.width,dy:20*c.height/g.viewport.height};});
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+point.dx,point.y+point.dy);await page.mouse.up();
 const moved=await page.evaluate(child=>{const e=window.__game.menuEditor;return {shape:e.screen.elements.find(x=>x.id===child),bounds:e.menuBounds};},child);expect(moved.shape.x-before.x).toBeCloseTo(20/moved.bounds.w);expect(moved.shape.y-before.y).toBeCloseTo(20/moved.bounds.h);
 for(const [action,index] of [['layer-back',0],['layer-up',1],['layer-front',2],['layer-down',1]]){await designerDrawerCommand(page,'send',action);expect(await page.evaluate(group=>window.__game.menuEditor.screen.elements.filter(e=>!e.parentId).findIndex(e=>e.id===group),group)).toBe(index);}
 await designerButton(page,'element-setup');await expect(page.getByRole('dialog',{name:'Container Properties',exact:true}).getByLabel('Shape',{exact:true})).toHaveValue('in');await applyDialog(page,'Container Properties');
 await designerButton(page,'send-drawer');
 await page.screenshot({path:`test-results/menu-shapes-container-${mobile?'portrait':'desktop'}.png`});
 await page.keyboard.press('Escape');
 if(mobile)await designerButton(page,'menu-preview');else await designerCommand(page,false,'view','menu-preview');
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');
 expect(await page.evaluate(child=>window.__game.menuPlayer.flow.screen.elements.find(e=>e.id===child).shape,child)).toBe('ellipse');
 const pixels=await page.evaluate(()=>{const g=window.__game,d=g.ctx.getImageData(0,0,g.canvas.width,g.canvas.height).data;let count=0;for(let i=0;i<d.length;i+=4)if(d[i]>210&&d[i+1]<100&&d[i+2]>190)count++;return count;});expect(pixels).toBeGreaterThan(50);
});

for(const mode of ['desktop','portrait','landscape-touch','gamepad'])test(`${mode} widescreen canvas and shape color pickers preserve rendered colors`,async({page})=>{
 const mobile=mode!=='desktop';
 await page.setViewportSize(mode==='portrait'?{width:390,height:844}:mode==='landscape-touch'?{width:844,height:390}:{width:1280,height:800});await ready(page,mobile);
 if(mode==='gamepad')await page.evaluate(()=>{window.__game.input.isGamepadConnected=()=>true;});
 await expect.poll(()=>page.evaluate(()=>window.__game.menuEditor.activeViewportMode)).toBe(mode);
 const stage=await page.evaluate(()=>window.__game.menuEditor.menuBounds);expect(stage.w/stage.h).toBeCloseTo(16/9);
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:shape');await designerButton(page,'element-setup');
 const properties=page.getByRole('dialog',{name:'Shape Properties',exact:true});await expect(properties.getByLabel('Fill color')).toHaveAttribute('type','color');await properties.getByLabel('Fill color').fill('#11cc55');await applyDialog(page,'Shape Properties');
 const pixel=()=>page.evaluate(()=>{const g=window.__game,e=g.menuEditor,b=e.menuBounds,shape=e.screen.elements.find(x=>x.type==='shape');return Array.from(g.ctx.getImageData(Math.floor(b.x+(shape.x+shape.w/2)*b.w),Math.floor(b.y+(shape.y+shape.h/2)*b.h),1,1).data).slice(0,3)});
 await expect.poll(pixel).toEqual([17,204,85]);
 await page.evaluate(()=>{void window.__game.menuEditor.runAction('element-properties');});const layout=page.getByRole('dialog',{name:'Layout & Style',exact:true});await expect(layout.getByLabel('Fill color')).toHaveValue('#11cc55');await expect(layout.getByLabel('Control background color')).toHaveCount(0);await layout.getByLabel('Fill color').fill('#cc22aa');await layout.getByLabel('Outline color').fill('#112233');await layout.getByLabel('Outline width (pixels)').fill('4');await applyDialog(page,'Layout & Style');await expect.poll(pixel).toEqual([204,34,170]);
 await page.evaluate(()=>{const e=window.__game.menuEditor;e.loadMenu(JSON.parse(JSON.stringify(e.menu)));});await expect.poll(pixel).toEqual([204,34,170]);
 await page.screenshot({path:`test-results/menu-widescreen-${mode}.png`});
 await page.evaluate(()=>window.__game.previewMenu(window.__game.menuEditor.menu));await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');
 await expect.poll(()=>page.evaluate(()=>{const g=window.__game,p=g.menuPlayer,b=p.bounds,s=p.flow.screen.elements.find(e=>e.type==='shape');if(!b)return [];return Array.from(g.ctx.getImageData(Math.floor(b.x+(s.x+s.w/2)*b.w),Math.floor(b.y+(s.y+s.h/2)*b.h),1,1).data).slice(0,3)})).toEqual([204,34,170]);
 expect(await page.evaluate(()=>{const b=window.__game.menuPlayer.bounds;return b.w/b.h})).toBeCloseTo(16/9);
});

for(const mode of ['desktop','portrait','landscape-touch','gamepad'])test(`${mode} menu playtest uses shared controls and saved navigation order`,async({page})=>{
 await page.setViewportSize(mode==='portrait'?{width:390,height:844}:mode==='landscape-touch'?{width:844,height:390}:{width:1280,height:800});await ready(page,mode!=='desktop');
 if(mode==='gamepad')await page.evaluate(()=>{window.__menuPad={id:'Menu Test Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__menuPad]});window.__game.input.gamepadAvailable=true;window.__game.input.gamepadIndex=0;});
 await page.evaluate(async()=>{const e=window.__game.menuEditor;await e.runAction('screen-new');await e.runAction('insert-button');e.element.label='Second';e.element.tabOrder=2;e.element.action={type:'set-param',parameter:'clicked',value:'second'};await e.runAction('insert-button');e.element.label='First';e.element.tabOrder=1;e.element.action={type:'set-param',parameter:'clicked',value:'first'};e.element.y=0.5;});
 await page.evaluate(()=>{void window.__game.menuEditor.runAction('element-properties');});const position=page.getByRole('dialog',{name:'Layout & Style',exact:true});await position.getByLabel('Navigation order (0 = automatic)').fill('1');await applyDialog(page,'Layout & Style');
 await page.evaluate(()=>{void window.__game.menuEditor.runAction('menu-default-background');});await page.getByRole('dialog',{name:'Default Background',exact:true}).getByLabel('Background color').fill('#2468ac');await applyDialog(page,'Default Background');
 await page.evaluate(()=>{const e=window.__game.menuEditor;const screenId=e.screenId;e.loadMenu(JSON.parse(JSON.stringify(e.menu)));e.screenId=screenId;return window.__game.previewMenu(e.menu);});await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');
 const touch=mode==='portrait'||mode==='landscape-touch';
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.menuPlayer.surface.handheld))).toBe(touch);
 expect(await page.evaluate(()=>window.__game.menuPlayer.interactive().map(e=>e.label))).toEqual(['First','Second']);
 await expect.poll(()=>page.evaluate(()=>{const g=window.__game,b=g.menuPlayer.bounds;if(!b)return [];return Array.from(g.ctx.getImageData(Math.floor(b.x+b.w*0.98),Math.floor(b.y+b.h*0.5),1,1).data).slice(0,3)})).toEqual([36,104,172]);
 const pad=async action=>{const index={dpadDown:13,jump:0,gamepadB:1,gamepadSelect:8}[action];await page.evaluate(index=>{window.__menuPad.buttons[index]={pressed:true,value:1};},index);await page.waitForTimeout(100);await page.evaluate(index=>{window.__menuPad.buttons[index]={pressed:false,value:0};},index);await page.waitForTimeout(100);};
 if(touch){
  const down=await page.evaluate(()=>{const j=window.__game.menuPlayer.surface.controls.joystick;return {x:j.center.x,y:j.center.y+j.radius*0.7}});const r=await page.locator('canvas').first().boundingBox();await page.mouse.move(r.x+down.x,r.y+down.y);await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.focus)).toBe(1);
  const a=await page.evaluate(()=>window.__game.menuPlayer.surface.controls.bButton);await canvasClick(page,a.x,a.y);
 }else if(mode==='gamepad'){await pad('dpadDown');await pad('jump');}
 else{await page.keyboard.press('Tab');await page.keyboard.press('Enter');}
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.parameters.clicked)).toBe('second');
 if(mode==='desktop'){await page.keyboard.press('Shift+Tab');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.focus)).toBe(0);}
 if(mode==='gamepad'){const screenId=await page.evaluate(()=>{const p=window.__game.menuPlayer,id=p.flow.screenId;p.flow.goTo('cars');return id;});await pad('gamepadB');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe(screenId);}
 await page.screenshot({path:`test-results/menu-playtest-${mode}.png`});
 if(touch){const s=await page.evaluate(()=>window.__game.menuPlayer.surface.controls.selectButton);await canvasClick(page,s.x+s.w/2,s.y+s.h/2);}
 else if(mode==='gamepad')await pad('gamepadSelect');else await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} menu forms wait for intentional field focus`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page,mobile);
 await designerButton(page,'widget-add');await designerButton(page,'pick-widget:shape');
 await page.evaluate(()=>{window.__menuFocusEvents=[];document.addEventListener('focusin',e=>window.__menuFocusEvents.push(e.target.tagName));});
 await designerButton(page,'element-setup');
 const dialog=page.getByRole('dialog',{name:'Shape Properties',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('heading')).toBeFocused();
 expect(await page.evaluate(()=>window.__menuFocusEvents.filter(tag=>['INPUT','TEXTAREA','SELECT'].includes(tag)))).toEqual([]);
 const label=dialog.getByLabel('Label',{exact:true});await label.click();await expect(label).toBeFocused();await label.fill('Chosen field');await applyDialog(page,'Shape Properties');
 expect(await page.evaluate(()=>window.__game.menuEditor.element.label)).toBe('Chosen field');
 await designerButton(page,'element-setup');await expect(dialog.getByRole('heading')).toBeFocused();await page.keyboard.press('Tab');await expect(label).toBeFocused();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{window.__menuFocusEvents=[];void window.__game.menuEditor.saveMenu(true);});
 const filename=page.getByPlaceholder('Filename',{exact:true});await expect(filename).toBeVisible();await expect(filename).not.toBeFocused();
 expect(await page.evaluate(()=>window.__menuFocusEvents.filter(tag=>['INPUT','TEXTAREA','SELECT'].includes(tag)))).toEqual([]);
 await filename.click();await expect(filename).toBeFocused();
});

for(const mode of ['desktop','portrait','landscape-touch','gamepad'])test(`${mode} menu top play control pauses and resumes playback`,async({page})=>{
 await page.setViewportSize(mode==='portrait'?{width:390,height:844}:mode==='landscape-touch'?{width:844,height:390}:{width:1280,height:800});await ready(page,mode!=='desktop');if(mode==='gamepad')await page.evaluate(()=>{window.__game.input.isGamepadConnected=()=>true;});
 await designerButton(page,'menu-play');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');await page.waitForFunction(()=>window.__game.menuPlayer.playPauseBounds);
 const b=await page.evaluate(()=>window.__game.menuPlayer.playPauseBounds);await canvasClick(page,b.x+b.w/2,b.y+b.h/2);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.paused)).toBe(true);
 const t=await page.evaluate(()=>window.__game.menuPlayer.flow.time);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__game.menuPlayer.flow.time)).toBe(t);await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('splash');
 await page.screenshot({path:`test-results/menu-paused-${mode}.png`});await canvasClick(page,b.x+b.w/2,b.y+b.h/2);await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.time)).toBeGreaterThan(t);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-editor');
});
