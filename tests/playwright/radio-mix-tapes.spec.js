import {test,expect} from '@playwright/test';
import {seedRaceRuntimeFixtures} from './helpers/race-runtime-fixtures.js';

// Locally generated MPEG-1 Layer III silence: each frame has empty granules,
// no bit reservoir, and zero main data. No external music or network fixture.
const silentMp3=Buffer.alloc(417*1200);
for(let i=0;i<1200;i++)silentMp3.set([0xff,0xfb,0x90,0x00],i*417);
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
const apply=(page,name)=>dialog(page,name).getByRole('button',{name:'Apply',exact:true}).click();
async function ready(page){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');}
async function clickCanvas(page,bounds){const point=await page.evaluate(b=>{const g=window.__game,r=g.canvas.getBoundingClientRect(),layout=g.getMobileGameplayHandheldLayout();let x=b.x+b.w/2,y=b.y+b.h/2;if(layout){x=layout.screen.x+x*layout.screen.w/layout.renderViewport.w;y=layout.screen.y+y*layout.screen.h/layout.renderViewport.h;}return {x:r.x+x*r.width/g.viewport.width,y:r.y+y*r.height/g.viewport.height};},bounds);await page.mouse.click(point.x,point.y);}
async function clickPause(page,id){await expect.poll(()=>page.evaluate(id=>window.__game.pauseMenu.itemBounds.some(b=>b.id===id),id)).toBe(true);await clickCanvas(page,await page.evaluate(id=>window.__game.pauseMenu.itemBounds.find(b=>b.id===id),id));}

async function radioReady(page){await expect.poll(()=>page.evaluate(()=>window.__game.state==='radio-editor'&&!window.__game.radioEditor.opened)).toBe(true);}
async function clickRadio(page,id){
 await radioReady(page);
 // Canvas hit bounds are rebuilt on the next draw after menu/selection changes.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect.poll(()=>page.evaluate(id=>window.__game.radioEditor.buttons.some(b=>b.id===id&&!b.disabled),id)).toBe(true);
 const point=await page.evaluate(id=>{const g=window.__game,b=g.radioEditor.buttons.find(b=>b.id===id&&!b.disabled).bounds,r=g.canvas.getBoundingClientRect();return{x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height};},id);
 await page.mouse.click(point.x,point.y);
}
async function radioAction(page,id){await radioReady(page);await page.evaluate(id=>{void window.__game.radioEditor.handleMenuAction(id);},id);}

test.beforeEach(async({page})=>{
 const preferences=new Map();
 await page.route('**/__storage/file*',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;
  const name=body?.name||url.searchParams.get('name'),folder=body?.folder||url.searchParams.get('folder');
  if(folder==='settings'&&['rtg-radio-library','rtg-radio-progress','rtg-item-progress'].includes(name)){
   if(body){preferences.set(name,body.data);return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{ok:true,file:{data:preferences.get(name)||{value:{}}}}});
  }
  return route.continue();
 });
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} authors a radio MP3, station and mix tape, collects in a level, and retains unlock on reload`,async({page},info)=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 const name=`Radio ${info.workerIndex} ${mobile?'portrait':'desktop'}`;
 await page.evaluate(async name=>{const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('art',name,{width:4,height:4,frames:[{pixels:Array(16).fill('#ffcc22ff')}]});},name);
 await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.title.setScreen('audio');g.handleTitleMenuAction('radio-editor');},mobile);
 await radioReady(page);expect(await page.getByRole('dialog').count()).toBe(0);
 const chooser=page.waitForEvent('filechooser');await clickRadio(page,'radio-import');await(await chooser).setFiles({name:'Night Drive.mp3',mimeType:'audio/mpeg',buffer:silentMp3});
 await dialog(page,'Import Radio Track').getByLabel('Artist',{exact:true}).fill('Studio Artist');await dialog(page,'Import Radio Track').getByLabel('Album',{exact:true}).fill('Night Album');await apply(page,'Import Radio Track');
 await clickRadio(page,'station-new');await dialog(page,'New Radio Station').getByLabel('Station name',{exact:true}).fill('Night Radio');await apply(page,'New Radio Station');
 await clickRadio(page,'track-membership');await radioReady(page);
 await radioAction(page,'station-logo');await apply(page,'Image Source');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await radioAction(page,'track-art');await apply(page,'Image Source');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();await radioReady(page);
 if(mobile)await clickRadio(page,'undo');else await page.keyboard.press('Control+z');await radioReady(page);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.track.image.artRef)).toBe('');
 if(mobile)await clickRadio(page,'redo');else await page.keyboard.press('Control+y');await radioReady(page);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.track.image.artRef)).toBe(name);
 await clickRadio(page,'radio-play');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(true);expect(await page.evaluate(()=>Object.keys(window.__game.items.progress.bags.radio))).toEqual([]);

 // Match Pixel/MIDI: short press toggles, hold opens the shared transport.
 const transportPoint=await page.evaluate(()=>{const g=window.__game,b=g.radioEditor.buttons.filter(b=>b.id==='radio-play').at(-1).bounds,r=g.canvas.getBoundingClientRect();return{x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height};});
 await page.mouse.move(transportPoint.x,transportPoint.y);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.radioEditor.transportPopover))).toBe(true);
 await page.screenshot({path:`test-results/radio-transport-${mobile?'portrait':'desktop'}.png`});
 await clickRadio(page,'radio-loop');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.repeatMode)).toBe('all');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.transportPopover)).toBe(null);
 // Add a second song to exercise the real audio ended handler without waiting
 // for the full 30-second silence fixture.
 await page.evaluate(async()=>{
   const e=window.__game.radioEditor,next=structuredClone(e.library),original=e.track;
   next.tracks.push({...structuredClone(original),id:'transport-second',title:'Second song'});
   next.stations.find(s=>s.id===e.stationId).trackIds.push('transport-second');
   await e.commit(next);await e.togglePreview();e.preview.audio.dispatchEvent(new Event('ended'));
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.trackId)).toBe('transport-second');
 await radioAction(page,'radio-loop');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.repeatMode)).toBe('one');
 await page.evaluate(()=>{const a=window.__game.radioEditor.preview.audio;a.currentTime=8;a.dispatchEvent(new Event('ended'));});
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.audio.currentTime)).toBeLessThan(3);
 expect(await page.evaluate(()=>window.__game.radioEditor.trackId)).toBe('transport-second');
 await radioAction(page,'radio-loop');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.repeatMode)).toBe('off');
 await page.evaluate(()=>window.__game.radioEditor.preview.audio.dispatchEvent(new Event('ended')));
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(false);
 await clickRadio(page,'radio-play');
 await page.screenshot({path:`test-results/radio-editor-${mobile?'portrait':'desktop'}.png`});
 await clickRadio(page,'radio-play');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(false);
 await page.evaluate(()=>window.__game.radioEditor.exitToMainMenu());
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#ee3366';ctx.fillRect(0,0,8,8);return canvas.toDataURL().split(',')[1];});
 await page.evaluate(()=>{const g=window.__game;g.transitionTo('item-editor');void g.itemEditor.getDesktopActionHandlers()['item-image']();});await dialog(page,'Image Source').getByLabel('Image source',{exact:true}).selectOption('device');const imageChooser=page.waitForEvent('filechooser');await apply(page,'Image Source');await (await imageChooser).setFiles({name:'cassette.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await dialog(page,'Save Imported Image').getByLabel('Artwork name',{exact:true}).fill(name+' Cassette');await apply(page,'Save Imported Image');await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.artRef)).toBe(name+' Cassette');await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.busy)).toBe(false);
 await page.evaluate(()=>{void window.__game.itemEditor.getDesktopActionHandlers()['item-effect-add']();});
 await dialog(page,'Add Item Effect').getByLabel('Effect',{exact:true}).selectOption('inventory');await dialog(page,'Add Item Effect').getByLabel('Bag',{exact:true}).selectOption('radio');const trackId=await page.evaluate(()=>window.__game.radio.library.tracks[0].id);await dialog(page,'Add Item Effect').getByLabel('Track',{exact:true}).selectOption(trackId);await apply(page,'Add Item Effect');
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.effects.length)).toBe(1);
 await page.screenshot({path:`test-results/item-editor-${mobile?'portrait':'desktop'}.png`});
 await page.evaluate(async name=>{const g=window.__game,{serializeItemDocument}=await import('/src/items/ItemDocument.js'),{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');g.itemEditor.doodad.name=name;await saveProjectFileAndConfirm('items',name,serializeItemDocument(g.itemEditor.doodad));g.enterEditor();g.applyWorldData(g.editor.buildEmptyLevelData(38,24));void g.editor.addMixTape();},name);
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(name=>window.__game.world.decals.some(item=>item.itemType==='item'&&item.itemRef===name),name)).toBe(true);
 await page.evaluate(name=>{const g=window.__game;g.editor.flushPendingAutosave();g.playMostRecentLevel();const item=g.world.decals.find(item=>item.itemType==='item'&&item.itemRef===name);item.x=g.player.x-16;item.y=g.player.y-16;item.w=32;item.h=32;g.spawnPauseTimer=0;},name);
 await expect.poll(()=>page.evaluate(()=>Object.keys(window.__game.items.progress.bags.radio))).toEqual([trackId]);
 await expect.poll(()=>page.evaluate(()=>window.__game.playtestPauseLock)).toBe(0);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('pause');await clickPause(page,'radio');await clickPause(page,'radio-play');
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.playing)).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__game.radio.audio?.currentTime||0)).toBeGreaterThan(0.05);
 expect(await page.evaluate(()=>window.__game.audio.radioPlaying)).toBe(true);expect(await page.evaluate(()=>({logo:window.__game.radio.library.stations[0].logo.artRef,cover:window.__game.radio.currentTrack.image.artRef}))).toEqual({logo:name,cover:name});await expect.poll(()=>page.evaluate(()=>{
  const g=window.__game,data=g.ctx.getImageData(0,0,g.canvas.width,g.canvas.height).data;
  let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]>140&&data[i+1]>100&&data[i+3]>200)bright++;
  return {visible:bright>100,state:g.state,radioOpen:g.pauseMenu.radioOpen,cutscene:!!g.cutscenePlayer?.active,overlay:g.activeTriggerText?.type||null,transform:Array.from(g.ctx.getTransform().toFloat64Array()),alpha:g.ctx.globalAlpha,composite:g.ctx.globalCompositeOperation};
 })).toMatchObject({visible:true,state:'pause',radioOpen:true});
 await page.screenshot({path:`test-results/radio-level-${mobile?'portrait':'desktop'}.png`});
 await clickPause(page,'radio-play');expect(await page.evaluate(()=>window.__game.radio.playing)).toBe(false);
 await page.reload();await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');expect(await page.evaluate(async()=>{await window.__game.radio.load();return Object.keys(window.__game.items.progress.bags.radio);})).toEqual([trackId]);
 expect(await page.evaluate(()=>window.__game.radio.library.tracks[0].artist)).toBe('Studio Artist');expect(errors).toEqual([]);
});

test('real race mix tape unlocks its track and pause radio obeys the race switch',async({page})=>{
 test.setTimeout(150000);await ready(page);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{const g=window.__game;await g.radio.saveLibrary({tracks:[{id:'race-song',title:'Race Song',src:'/unused.mp3'}],stations:[{id:'race-station',name:'Race Station',trackIds:['race-song']},{id:'excluded-station',name:'Excluded Station',trackIds:['race-song']}]});void g.startRaceTravel({raceName:'Studio Sprint2',carSelection:'specific',carRef:'2022 Subaru WRX2'});});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=window.__game,e=g.raceEditor,s=e.playtestSession,car=e.getRaceSessionCar(s),points=e.getRaceVehicleCollisionContactPoints({session:s,car,tuning:e.getRaceCarTuning(car)}),point=points[0];e.ensureRaceScenery().push({id:'race-tape',presetId:'doodad',x:point.x,z:point.z,previewDoodad:{itemType:'mix-tape',unlockTrackId:'race-song',widthM:2,heightM:4}});});
 await expect.poll(()=>page.evaluate(()=>Object.keys(window.__game.items.progress.bags.radio))).toContain('race-song');await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.removedSceneryIds)).toContain('race-tape');
 await page.evaluate(()=>window.__game.raceEditor.toggleRacePause());expect(await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().some(row=>row.id==='race-radio'))).toBe(true);
 await page.evaluate(()=>{const e=window.__game.raceEditor;e.getRacePauseMenuRows().find(row=>row.id==='race-radio').onClick();});await page.screenshot({path:'test-results/radio-race.png'});
 await page.evaluate(()=>{window.__game.raceEditor.selectedRace.radioStationIds=['race-station'];});
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.stations.map(s=>s.id))).toEqual(['race-station']);
 await page.evaluate(()=>{const e=window.__game.raceEditor;e.radioMenu.page='stations';});
 expect(await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().map(r=>r.id))).toEqual(['radio-station:race-station','radio-back']);
 await page.evaluate(()=>{window.__game.raceEditor.selectedRace.radioStationIds=[];});
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.stations.length)).toBe(0);
 await page.evaluate(()=>{window.__game.raceEditor.selectedRace.radioEnabled=false;});await expect.poll(()=>page.evaluate(()=>window.__game.radio.available)).toBe(false);expect(await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().some(row=>row.id==='race-radio'))).toBe(false);
});

for(const mode of ['desktop','portrait','landscape-touch','gamepad'])test(`${mode} radio editor uses shared shell, navigation, history and station transport`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize(mode==='portrait'?{width:390,height:844}:mode==='landscape-touch'?{width:844,height:390}:{width:1280,height:800});await ready(page);
 await page.evaluate(async({mode,src})=>{
  const g=window.__game,mobile=mode!=='desktop';g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  if(mode==='gamepad'){
   window.__radioPad={id:'Radio Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__radioPad]});g.input.gamepadAvailable=true;g.input.gamepadIndex=0;
  }
  await g.radio.saveLibrary({tracks:Array.from({length:15},(_,i)=>({id:`song-${i}`,title:`Song ${i+1}`,artist:'Studio Artist',src})),stations:[{id:'night',name:'Night Radio',trackIds:['song-0','song-1']}]});
  await g.radioEditor.open();
 },{mode,src:'data:audio/mpeg;base64,'+silentMp3.toString('base64')});await radioReady(page);
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.activeViewportMode)).toBe(mode);
 if(mode==='portrait'||mode==='landscape-touch'){
  for(const id of ['menu','undo','redo','radio-play'])expect(await page.evaluate(id=>window.__game.radioEditor.buttons.some(b=>b.id===id),id)).toBe(true);
  const stick=await page.evaluate(()=>{const g=window.__game,j=g.radioEditor.portraitThumbstick,r=g.canvas.getBoundingClientRect();return{x:r.x+j.center.x*r.width/g.viewport.width,y:r.y+(j.center.y+j.radius*0.8)*r.height/g.viewport.height};});
  await page.evaluate(()=>{window.__game.radioEditor.focusList='tracks';});expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,stick)).toBe('game');await page.mouse.move(stick.x,stick.y);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();
  expect(await page.evaluate(()=>window.__game.radioEditor.trackId)).not.toBe('song-0');
 }
 if(mode==='gamepad'){
  const press=async index=>{await page.evaluate(i=>{window.__radioPad.buttons[i]={pressed:true,value:1};},index);await page.waitForTimeout(90);await page.evaluate(i=>{window.__radioPad.buttons[i]={pressed:false,value:0};},index);await page.waitForTimeout(90);};
  await press(9);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.mobileRootOpen)).toBe(true);
  await press(5);expect(await page.evaluate(()=>window.__game.radioEditor.activeRootId)).toBe('edit');await press(4);expect(await page.evaluate(()=>window.__game.radioEditor.activeRootId)).toBe('file');
  await press(0);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.gamepadSubmenuOpen)).toBe(true);
  await press(1);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.mobileRootOpen)).toBe(true);await press(1);
  await press(8);expect(await page.evaluate(()=>window.__game.radioEditor.focusList)).toBe('tracks');await press(15);await press(13);expect(await page.evaluate(()=>window.__game.radioEditor.trackId)).toBe('song-1');
 }else{
  // Open and close the actual shared menu without a wizard.
  if(mode==='desktop'){
   await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.buttons.some(b=>b.desktopRootId==='file'))).toBe(true);
   const root=await page.evaluate(()=>window.__game.radioEditor.buttons.find(b=>b.desktopRootId==='file')?.id);expect(root).toBeTruthy();await clickRadio(page,root);
   expect(await page.evaluate(()=>window.__game.radioEditor.desktopDropdown?.rootId)).toBe('file');await page.keyboard.press('Escape');
  }else {await clickRadio(page,'menu');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.mobileRootOpen)).toBe(true);await clickRadio(page,'menu');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.mobileRootOpen)).toBe(false);}
 }
 await page.evaluate(()=>{const e=window.__game.radioEditor;e.selectTrack('song-2');e.menuScrollState['radio:tracks']=0;});
 await clickRadio(page,'track-membership');await radioReady(page);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.station.trackIds)).toContain('song-2');
 await radioAction(page,'undo');await radioReady(page);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.station.trackIds)).not.toContain('song-2');await radioAction(page,'redo');await radioReady(page);
 await clickRadio(page,'radio-play');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.audio.currentTime)).toBeGreaterThan(0.05);
 expect(await page.evaluate(()=>Object.keys(window.__game.items.progress.bags.radio))).toEqual([]);
 await page.screenshot({path:`test-results/radio-shell-${mode}.png`});
 await clickRadio(page,'radio-play');await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(false);
 await page.evaluate(()=>window.__game.radioEditor.exitToMainMenu());expect(await page.evaluate(()=>window.__game.radioEditor.preview.audio)).toBeNull();expect(errors).toEqual([]);
});


for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} race radio dialog cancels, saves and reloads station choices`,async({page},info)=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 await page.evaluate(async mobile=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  await g.radio.saveLibrary({tracks:[],stations:[{id:'rock',name:'Rock',trackIds:[]},{id:'jazz',name:'Jazz',trackIds:[]}]});
  g.transitionTo('race-editor');delete g.raceEditor.selectedRace.radioEnabled;delete g.raceEditor.selectedRace.radioStationIds;
 },mobile);
 const open=async()=>{await page.evaluate(()=>{void window.__game.raceEditor.handleMenuAction('race-radio');});await expect(dialog(page,'Race Radio')).toBeVisible();};
 const form=dialog(page,'Race Radio');
 await open();await expect(form.getByLabel('Radio',{exact:true})).toHaveValue('on');
 await expect(form.getByLabel('Rock',{exact:true})).toBeChecked();await expect(form.getByLabel('Jazz',{exact:true})).toBeChecked();
 await form.getByLabel('Radio',{exact:true}).selectOption('off');await form.getByLabel('Jazz',{exact:true}).uncheck();
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.radioEnabled)).toBeUndefined();
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.radioStationIds)).toBeUndefined();
 await open();await expect(form.getByLabel('Jazz',{exact:true})).toBeChecked();
 await form.getByLabel('Radio',{exact:true}).selectOption('off');await form.getByLabel('Jazz',{exact:true}).uncheck();
 await page.screenshot({path:`test-results/radio-race-settings-${mobile?'portrait':'desktop'}.png`});
 await form.getByRole('button',{name:'OK',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.selectedRace.radioStationIds)).toEqual(['rock']);
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.radioEnabled)).toBe(false);
 await page.evaluate(async name=>{
  const e=window.__game.raceEditor,{saveProjectFileAndConfirm,loadProjectFile}=await import('/src/ui/projectFiles.js');
  await saveProjectFileAndConfirm('races',name,e.serializeSelectedRaceDocument());
  e.selectedRace.radioEnabled=true;e.selectedRace.radioStationIds=null;
  const saved=loadProjectFile('races',name);if(!e.applyLoadedRaceDocument(saved.data,{name}))throw Error('Race did not reload');
 },`Radio Settings ${info.workerIndex} ${mobile}`);
 await open();await expect(form.getByLabel('Radio',{exact:true})).toHaveValue('off');
 await expect(form.getByLabel('Rock',{exact:true})).toBeChecked();await expect(form.getByLabel('Jazz',{exact:true})).not.toBeChecked();
 await form.getByLabel('Radio',{exact:true}).selectOption('on');await form.getByLabel('Jazz',{exact:true}).check();
 await form.getByRole('button',{name:'OK',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.selectedRace.radioEnabled)).toBe(true);
 expect(await page.evaluate(()=>window.__game.raceEditor.selectedRace.radioStationIds)).toBeNull();
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} music drops save, preview and sync race GO/results`,async({page})=>{
 test.setTimeout(150000);
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 await page.mouse.click(5,5); // A real user gesture permits browser media playback.
 await page.evaluate(async({mobile,src})=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  await g.radio.saveLibrary({tracks:[{id:'drop-song',title:'Drop Song',src,initiallyUnlocked:true}],stations:[{id:'drops',name:'Drops',trackIds:['drop-song']}]});
  await g.radioEditor.open();
 },{mobile,src:'data:audio/mpeg;base64,'+silentMp3.toString('base64')});
 await radioAction(page,'track-drops');
 const form=dialog(page,'Music Drops');
 await form.getByLabel('Race start drop (seconds into song)',{exact:true}).fill('6');
 await form.getByLabel('Use race finish drop',{exact:true}).check();
 await form.getByLabel('Race finish / chorus (seconds into song)',{exact:true}).fill('20');
 await page.screenshot({path:`test-results/radio-music-drops-${mobile?'portrait':'desktop'}.png`});
 await apply(page,'Music Drops');await radioReady(page);
 expect(await page.evaluate(()=>window.__game.radio.library.tracks[0].raceCues)).toEqual({start:6,end:20});
 await radioAction(page,'radio-preview-start');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.playing)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.status)).toBe('GO — start drop');
 expect(await page.evaluate(()=>window.__game.radioEditor.preview.audio.currentTime)).toBeGreaterThanOrEqual(5.8);
 await radioAction(page,'radio-preview-end');
 await expect.poll(()=>page.evaluate(()=>window.__game.radioEditor.preview.audio?.currentTime||0)).toBeGreaterThanOrEqual(20);
 await page.evaluate(()=>window.__game.radioEditor.exitToMainMenu());
 await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{
  const {hydrateProjectFilePayload,saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  const document=structuredClone((await hydrateProjectFilePayload('races','Studio Sprint2')).data);
  document.race.raceStart.countdown=true;document.race.radioEnabled=true;document.race.radioStationIds=null;
  await saveProjectFileAndConfirm('races','Music Drop Race',document);
  const g=window.__game;window.__raceGoSample=null;
  const sample=()=>{
   const s=g.raceEditor.playtestSession,a=g.radio.audio;
   if(s?.running&&s.countdownRemainingMs>0&&s.countdownRemainingMs<=1000&&a&&g.radio.playing&&!window.__raceGoSample)
    window.__raceGoSample={time:a.currentTime,gain:g.radio.gain};
   if(!window.__raceGoSample)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
  void g.startRaceTravel({raceName:'Music Drop Race',carSelection:'specific',carRef:'2022 Subaru WRX2'});
 });
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__raceGoSample),{timeout:15000}).not.toBeNull();
 const go=await page.evaluate(()=>window.__raceGoSample);
 expect(go.time).toBeGreaterThan(5.65);expect(go.time).toBeLessThan(6.4);expect(go.gain).toBeGreaterThan(.9);
 await page.evaluate(()=>window.__game.raceEditor.showRaceResults());
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.audio?.currentTime||0)).toBeGreaterThanOrEqual(20);
 expect(await page.evaluate(()=>window.__game.radio.gain)).toBe(1);
 expect(await page.evaluate(()=>window.__game.raceEditor.raceInput.paused)).toBe(true);
 await page.screenshot({path:`test-results/radio-race-results-${mobile?'portrait':'desktop'}.png`});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.buttons.some(b=>b.id==='race-results-continue'))).toBe(true);
 await clickCanvas(page,await page.evaluate(()=>window.__game.raceEditor.buttons.find(b=>b.id==='race-results-continue').bounds));
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession)).toBeNull();
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.playing)).toBe(false);
});

for(const mobile of [false,true])test(`car backfire and turbo settings ${mobile?'portrait':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.title.setScreen('game');g.handleTitleMenuAction('car-editor');},mobile);
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('car-editor');
 await page.evaluate(()=>{const e=window.__game.carEditor;void e.handleMenuAction('car-sound-effects');});
 const form=dialog(page,'Backfire & Turbo');await expect(form).toBeVisible();
 await form.getByLabel('Backfire tone (Hz)',{exact:true}).fill('420');
 await form.getByLabel('Turbo sound enabled',{exact:true}).check();
 await form.getByLabel('Turbo whistle tone (Hz)',{exact:true}).fill('2800');
 await page.screenshot({path:`test-results/radio-car-sounds-${mobile?'portrait':'desktop'}.png`});
 await apply(page,'Backfire & Turbo');
 expect(await page.evaluate(()=>{const e=window.__game.carEditor,c=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());return [c.audio.backfireToneHz,c.audio.turboToneHz,c.audio.turboEnabled];})).toEqual([420,2800,true]);
 await page.evaluate(()=>window.__game.carEditor.undoRaceHistory());
 await page.evaluate(()=>window.__game.carEditor.redoRaceHistory());
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.audio.backfireToneHz)).toBe(420);
 // Render the actual noise burst graph to catch invalid Web Audio scheduling.
 const peak=await page.evaluate(async()=>{
   const {VehicleSound}=await import('/src/audio/VehicleSound.js');
   const ctx=new OfflineAudioContext(1,22050,44100),sound=new VehicleSound(ctx,ctx.destination);
   sound.burst(420,.15,.6);const buffer=await ctx.startRendering();
   return buffer.getChannelData(0).reduce((max,v)=>Math.max(max,Math.abs(v)),0);
 });expect(peak).toBeGreaterThan(.01);expect(peak).toBeLessThan(1);
});
