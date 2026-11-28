import {test,expect} from '@playwright/test';

const races=[
 {name:'Blue Hills — Reservation Parkways',slug:'blue-hills',line:'Why build something just to tear it down?',destination:'campaign-hub-1'},
 {name:'RI 116 — North Smithfield Scituate',slug:'ri116',line:'She went to Heaven',destination:'campaign-hub-1'},
 {name:'Pachaug State Forest — public gravel access roads',slug:'pachaug',line:'I was looking at the routes for tomorrow',destination:'world-map'},
 {name:'Boston, MA — Landmark Run',slug:'boston',line:'Play something',destination:'campaign-hub-1'},
];
for(const route of races)test(`Region 1 Movie Maker and race cutscene playback: ${route.name}`,async({page},info)=>{

 test.setTimeout(90000);
 await page.route('**/region1-cinematic-test',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#000"><canvas width="768" height="432"></canvas></body></html>'}));
 // Cover playback from the built site's manifest, not an already hydrated editor cache.
 await page.route(/\/__storage\/(?:index|file)(?:\?|$)/,r=>r.fulfill({status:404,json:{error:'No storage API'}}));
 await page.goto('/region1-cinematic-test');
 const result=await page.evaluate(async({name,line})=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
  const {default:CutsceneEditor,CutscenePlayer,drawCutsceneDocument}=await import('/src/ui/CutsceneEditor.js');
  const {default:MenuPlayer}=await import('/src/menus/MenuPlayer.js');
  const {default:GameCore}=await import('/src/game/GameCore.js');
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  const game=Object.assign(Object.create(GameCore.prototype),{canvas,showSystemToast(){},
   audio:{preloadSongResources:async()=>{}},cutsceneMidiLayers:new Map(),cutsceneMidiLayerToken:0,musicPlayers:[],
  });
  const flow={active:true,generation:0};
  const player=Object.assign(Object.create(MenuPlayer.prototype),{
   game,flow,cleanupScreen(){},enterScreen(){},cutscene:new CutscenePlayer(game),
  });
  game.menuPlayer=player;
  const {data}=await hydrateProjectFilePayload('races',name),race=data.race||data;
  const editor=new CutsceneEditor(game);
  const saved=await hydrateProjectFilePayload('cutscenes',race.raceStart.cutsceneRef);
  editor.applyDocument(saved.data,saved.name);
  const json=JSON.stringify(editor.document);
  editor.applyDocument(JSON.parse(json),saved.name);
  const editorRoundTrip=JSON.stringify(editor.document)===json;
  const image=editor.getImageForAsset(editor.document.assets[0]);await image.decode();
  const paint=(doc,runtime,timeMs)=>{
   ctx.clearRect(0,0,canvas.width,canvas.height);
   drawCutsceneDocument(ctx,doc,timeMs,{x:0,y:0,w:canvas.width,h:canvas.height},runtime,{fit:'contain',drawBorder:false});
   const sample=ctx.getImageData(10,10,canvas.width-20,canvas.height/2-10).data;
   let nonBlack=0;
   for(let i=0;i<sample.length;i+=4)if(sample[i]+sample[i+1]+sample[i+2]>20&&sample[i+3]>250)nonBlack++;
   return nonBlack;
  };
  const previewPixels=paint(editor.document,editor.previewRuntime,750);
  const activeWithin=async predicate=>{
   const begin=performance.now();
   while(!predicate()){if(performance.now()-begin>20000)throw Error('Timed out waiting for cutscene player');await new Promise(r=>setTimeout(r,20));}
  };
  let prepared=false;
  game.resolveRaceTravelCarAsync=async()=>{prepared=true;return null;};
  game.chooseRaceTravelCar=async()=>null;
  const prep=game.startRaceTravel({raceName:name,carSelection:'specific',carRef:'unused',menuFlow:flow});
  await activeWithin(()=>player.cutscene.active);
  const blockedPrepare=!prepared;
  const intro=player.cutscene.doc.name;
  player.cutscene.stop();await prep;
  let destination=null;
  game.openMenuDestination=async d=>{destination=d.menuScreen;};
  const finish=game.playRaceFinishCutscene(race.finishBehavior);
  await activeWithin(()=>player.cutscene.active);
  const exit=player.cutscene.doc.name,exitPlayer=player.cutscene;
  const score=exitPlayer.doc.clips.find(c=>c.type==='music');
  const scoredAsset=exitPlayer.doc.assets.find(a=>a.id===score.assetId);
  exitPlayer.update((score.startMs+1100)/1000);
  const runtimeMidi=game.cutsceneMidiLayers.get(score.id)?.player;
  const midiPlayed=runtimeMidi?.trackId===scoredAsset.ref
   &&runtimeMidi.events.length>0&&runtimeMidi.targetVolume>.025;
  const captions=exitPlayer.doc.clips.filter(c=>c.type==='text'&&c.text.includes(line));
  if(captions.length!==1)throw Error('Unexpected final caption count for '+name);
  const t=captions[0].startMs+350;
  const shot=exitPlayer.doc.clips.find(c=>c.type==='image'&&c.startMs<=t&&t<c.startMs+c.durationMs);
  const asset=exitPlayer.doc.assets.find(a=>a.id===shot.assetId);
  const exitImage=exitPlayer.getImageForAsset(asset);await exitImage.decode();
  const exitPixels=paint(exitPlayer.doc,exitPlayer,t);
  const readCaptionBand=()=>ctx.getImageData(0,Math.floor(canvas.height*.75),canvas.width,Math.ceil(canvas.height*.25)).data;
  const withText=readCaptionBand();
  paint({...exitPlayer.doc,clips:exitPlayer.doc.clips.filter(c=>c.type!=='text')},exitPlayer,t);
  const withoutText=readCaptionBand();
  let subtitlePixels=0;
  for(let i=0;i<withText.length;i+=4)if(Math.abs(withText[i]-withoutText[i])+Math.abs(withText[i+1]-withoutText[i+1])+Math.abs(withText[i+2]-withoutText[i+2])>40)subtitlePixels++;
  paint(exitPlayer.doc,exitPlayer,t);
  const reveals=captions.length;
  exitPlayer.stop();await finish;
  return {width:image.naturalWidth,previewPixels,exitPixels,subtitlePixels,editor:editor.document.name,tracks:editor.document.tracks.length,
   start:intro,exit,reveals,blockedPrepare,prepared,destination,editorRoundTrip,midiPlayed,finished:!player.raceFinishCutscene&&!exitPlayer.active};
 },route);
 expect(result).toMatchObject({editor:`r1-${route.slug}-intro`,start:`r1-${route.slug}-intro`,exit:`r1-${route.slug}-exit`,reveals:1,
  blockedPrepare:true,prepared:true,destination:route.destination,finished:true,tracks:4,editorRoundTrip:true,midiPlayed:true});
 expect(result.width).toBeGreaterThanOrEqual(1280);
 expect(result.previewPixels).toBeGreaterThan(1000);
 expect(result.exitPixels).toBeGreaterThan(1000);
 expect(result.subtitlePixels).toBeGreaterThan(150);
 await page.locator('canvas').screenshot({path:info.outputPath(`region1-${route.slug}-exit-preview.png`)});
});

test('all 15 director timelines round-trip in Movie Maker and render their native angles',async({page},info)=>{
 test.setTimeout(90000);
 await page.route('**/region1-directors-edit',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="background:#111a24;color:#dfe7ef;padding:18px;font:15px system-ui"><h1>Region 1 camera edit</h1><main style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:1190px"></main></body>'}));
 await page.route(/\/__storage\/(?:index|file)(?:\?|$)/,r=>r.fulfill({status:404,json:{error:'No storage API'}}));
 await page.setViewportSize({width:1240,height:1430});
 await page.goto('/region1-directors-edit');
 const loaded=await page.evaluate(async()=>{
  const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
  const {default:CutsceneEditor,drawCutsceneDocument,collectCutsceneMidiRenderEvents}=await import('/src/ui/CutsceneEditor.js');
  const index=(await (await fetch('/data/server-storage/files/manifest.json')).json()).folders.cutscenes;
  const names=Object.keys(index).filter(n=>n.startsWith('r1-')).sort();
  const gallery=document.querySelector('main');
  const out=[];
  const approvedExtra={'r1-blue-hills-exit':'blue-hills-boston-pov','r1-ri116-exit':'ri116-house-light','r1-garage-m3':'garage-m3-reveal','r1-pachaug-exit':'pachaug-map-close'};
  for(const name of names){
   const {data}=await hydrateProjectFilePayload('cutscenes',name);
   const section=document.createElement('section'),canvas=document.createElement('canvas'),label=document.createElement('div');
   const editor=new CutsceneEditor({canvas});
   editor.applyDocument(data,name);
   const saved=JSON.stringify(editor.document);
   editor.applyDocument(JSON.parse(saved),name);
   if(JSON.stringify(editor.document)!==saved)throw Error('Movie Maker save round-trip changed '+name);
   for(const asset of editor.document.assets.filter(a=>a.type==='image'))await editor.getImageForAsset(asset).decode();
   const score=editor.document.assets.find(c=>c.type==='music');
   const {data:song}=await hydrateProjectFilePayload('music',score.ref);
   const notes=collectCutsceneMidiRenderEvents(editor.document,()=>song);
   if(!notes.some(note=>note.volume>.015))throw Error('No audible MIDI notes in '+name);
   const group=editor.document.clips.filter(c=>c.type==='image');
   const insert=group.find(c=>c.assetId==='shot-'+approvedExtra[name]);
   const example=insert||group.find(c=>c.id.startsWith('insert-'))||group.find(c=>c.id.startsWith('rob-'))||group[1];
   const w=388,h=218;Object.assign(canvas,{width:w,height:h});
   const ctx=canvas.getContext('2d');
   const at=example.startMs+Math.min(example.durationMs/2,380);
   drawCutsceneDocument(ctx,editor.document,at,{x:0,y:0,w,h},editor.previewRuntime,{fit:'contain',drawBorder:false});
   const pixels=ctx.getImageData(0,0,w,h).data;
   let lit=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>35)lit++;
   if(lit<3000)throw Error('Dark or unloaded angle '+name);
   label.textContent=name.replace(/^r1-/,'')+' / '+example.assetId.replace(/^shot-/,'');
   section.append(canvas,label);gallery.append(section);
   out.push({name,shotCount:group.length,newInsert:!!insert});
  }
  return out;
 });
 expect(loaded).toHaveLength(15);
 expect(loaded.every(scene=>scene.shotCount>=3)).toBeTruthy();
 await page.locator('body').screenshot({path:info.outputPath('region1-cinematic-angle-contact.png')});
});
