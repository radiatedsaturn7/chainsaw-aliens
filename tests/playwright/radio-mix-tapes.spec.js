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

test.beforeEach(async({page})=>{
 const preferences=new Map();
 await page.route('**/__storage/file*',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;
  const name=body?.name||url.searchParams.get('name'),folder=body?.folder||url.searchParams.get('folder');
  if(folder==='settings'&&['rtg-radio-library','rtg-radio-progress'].includes(name)){
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
 await dialog(page,'Radio Editor').getByLabel('Edit',{exact:true}).selectOption('import');const chooser=page.waitForEvent('filechooser');await apply(page,'Radio Editor');await (await chooser).setFiles({name:'Night Drive.mp3',mimeType:'audio/mpeg',buffer:silentMp3});
 await dialog(page,'Import Radio Track').getByLabel('Artist',{exact:true}).fill('Studio Artist');await dialog(page,'Import Radio Track').getByLabel('Album',{exact:true}).fill('Night Album');await apply(page,'Import Radio Track');
 await expect(dialog(page,'Radio Editor')).toBeVisible();await dialog(page,'Radio Editor').getByLabel('Edit',{exact:true}).selectOption('station');await apply(page,'Radio Editor');await apply(page,'Radio Stations');
 await dialog(page,'Station Details').getByLabel('Station name',{exact:true}).fill('Night Radio');await dialog(page,'Station Details').getByLabel('Night Drive — Studio Artist',{exact:true}).selectOption('yes');await dialog(page,'Station Details').getByLabel('Station logo',{exact:true}).selectOption('choose');await apply(page,'Station Details');
 await apply(page,'Image Source');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await dialog(page,'Radio Editor').getByLabel('Edit',{exact:true}).selectOption('track');await apply(page,'Radio Editor');await apply(page,'Choose Radio Track');await dialog(page,'Track Details').getByLabel('Album image',{exact:true}).selectOption('choose');await apply(page,'Track Details');await apply(page,'Image Source');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await dialog(page,'Radio Editor').getByRole('button',{name:'Cancel',exact:true}).click();
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#ee3366';ctx.fillRect(0,0,8,8);return canvas.toDataURL().split(',')[1];});
 await page.evaluate(()=>{const g=window.__game;g.enterDoodadEditor();void g.doodadEditor.importItemArtwork();});await dialog(page,'Image Source').getByLabel('Image source',{exact:true}).selectOption('device');const imageChooser=page.waitForEvent('filechooser');await apply(page,'Image Source');await (await imageChooser).setFiles({name:'cassette.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await dialog(page,'Save Imported Image').getByLabel('Artwork name',{exact:true}).fill(name+' Cassette');await apply(page,'Save Imported Image');await expect.poll(()=>page.evaluate(()=>window.__game.doodadEditor.doodad.artRef)).toBe(name+' Cassette');await page.evaluate(()=>{void window.__game.doodadEditor.configureMixTape();});
 await dialog(page,'Doodad Item').getByLabel('Item type',{exact:true}).selectOption('mix-tape');const trackId=await page.evaluate(()=>window.__game.radio.library.tracks[0].id);await dialog(page,'Doodad Item').getByLabel('Track to unlock',{exact:true}).selectOption(trackId);await apply(page,'Doodad Item');
 await page.evaluate(async name=>{const g=window.__game,{serializeRaceDoodadDocument}=await import('/src/racing/raceDoodads.js'),{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');g.doodadEditor.doodad.name=name;await saveProjectFileAndConfirm('doodads',name,serializeRaceDoodadDocument(g.doodadEditor.doodad));g.enterEditor();g.applyWorldData(g.editor.buildEmptyLevelData(38,24));void g.editor.addMixTape();},name);
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(name=>window.__game.world.decals.some(item=>item.itemType==='mix-tape'&&item.doodadRef===name),name)).toBe(true);
 await page.evaluate(name=>{const g=window.__game;g.editor.flushPendingAutosave();g.playMostRecentLevel();const item=g.world.decals.find(item=>item.itemType==='mix-tape'&&item.doodadRef===name);item.x=g.player.x-16;item.y=g.player.y-16;item.w=32;item.h=32;g.spawnPauseTimer=0;},name);
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.progress.unlocked)).toEqual([trackId]);
 await expect.poll(()=>page.evaluate(()=>window.__game.playtestPauseLock)).toBe(0);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('pause');await clickPause(page,'radio');await clickPause(page,'radio-play');
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.playing)).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__game.radio.audio?.currentTime||0)).toBeGreaterThan(0.05);
 expect(await page.evaluate(()=>window.__game.audio.radioPlaying)).toBe(true);expect(await page.evaluate(()=>({logo:window.__game.radio.library.stations[0].logo.artRef,cover:window.__game.radio.currentTrack.image.artRef}))).toEqual({logo:name,cover:name});await expect.poll(()=>page.evaluate(()=>{
  const g=window.__game,data=g.ctx.getImageData(0,0,g.canvas.width,g.canvas.height).data;
  let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]>140&&data[i+1]>100&&data[i+3]>200)bright++;
  return {visible:bright>100,state:g.state,radioOpen:g.pauseMenu.radioOpen,cutscene:!!g.cutscenePlayer?.active,overlay:g.activeTriggerText?.type||null,transform:Array.from(g.ctx.getTransform().toFloat64Array()),alpha:g.ctx.globalAlpha,composite:g.ctx.globalCompositeOperation};
 })).toMatchObject({visible:true,state:'pause',radioOpen:true});
 await page.screenshot({path:`test-results/radio-level-${mobile?'portrait':'desktop'}.png`});
 await clickPause(page,'radio-play');expect(await page.evaluate(()=>window.__game.radio.playing)).toBe(false);
 await page.reload();await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');expect(await page.evaluate(async()=>{await window.__game.radio.load();return window.__game.radio.progress.unlocked;})).toEqual([trackId]);
 expect(await page.evaluate(()=>window.__game.radio.library.tracks[0].artist)).toBe('Studio Artist');expect(errors).toEqual([]);
});

test('real race mix tape unlocks its track and pause radio obeys the race switch',async({page})=>{
 test.setTimeout(150000);await ready(page);await seedRaceRuntimeFixtures(page);
 await page.evaluate(async()=>{const g=window.__game;await g.radio.saveLibrary({tracks:[{id:'race-song',title:'Race Song',src:'/unused.mp3'}],stations:[{id:'race-station',name:'Race Station',trackIds:['race-song']}]});void g.startRaceTravel({raceName:'Studio Sprint2',carSelection:'specific',carRef:'2022 Subaru WRX2'});});
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=window.__game,e=g.raceEditor,s=e.playtestSession,car=e.getRaceSessionCar(s),points=e.getRaceVehicleCollisionContactPoints({session:s,car,tuning:e.getRaceCarTuning(car)}),point=points[0];e.ensureRaceScenery().push({id:'race-tape',presetId:'doodad',x:point.x,z:point.z,previewDoodad:{itemType:'mix-tape',unlockTrackId:'race-song',widthM:2,heightM:4}});});
 await expect.poll(()=>page.evaluate(()=>window.__game.radio.progress.unlocked)).toContain('race-song');await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession.removedSceneryIds)).toContain('race-tape');
 await page.evaluate(()=>window.__game.raceEditor.toggleRacePause());expect(await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().some(row=>row.id==='race-radio'))).toBe(true);
 await page.evaluate(()=>{const e=window.__game.raceEditor;e.getRacePauseMenuRows().find(row=>row.id==='race-radio').onClick();});await page.screenshot({path:'test-results/radio-race.png'});
 await page.evaluate(()=>{window.__game.raceEditor.selectedRace.radioEnabled=false;});await expect.poll(()=>page.evaluate(()=>window.__game.radio.available)).toBe(false);expect(await page.evaluate(()=>window.__game.raceEditor.getRacePauseMenuRows().some(row=>row.id==='race-radio'))).toBe(false);
});
