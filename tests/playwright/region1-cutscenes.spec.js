import {test,expect} from '@playwright/test';

const races=[
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
  const game=Object.assign(Object.create(GameCore.prototype),{canvas,showSystemToast(){}});
  const flow={active:true,generation:0};
  const player=Object.assign(Object.create(MenuPlayer.prototype),{
   game,flow,cleanupScreen(){},enterScreen(){},cutscene:new CutscenePlayer(game),
  });
  game.menuPlayer=player;
  game.prepareCutsceneAudioResources=async()=>{};
  const {data}=await hydrateProjectFilePayload('races',name),race=data.race||data;
  const editor=new CutsceneEditor(game);
  const saved=await hydrateProjectFilePayload('cutscenes',race.raceStart.cutsceneRef);
  editor.applyDocument(saved.data,saved.name);
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
   start:intro,exit,reveals,blockedPrepare,prepared,destination,finished:!player.raceFinishCutscene&&!exitPlayer.active};
 },route);
 expect(result).toMatchObject({editor:`r1-${route.slug}-intro`,start:`r1-${route.slug}-intro`,exit:`r1-${route.slug}-exit`,reveals:1,
  blockedPrepare:true,prepared:true,destination:route.destination,finished:true,tracks:3});
 expect(result.width).toBeGreaterThanOrEqual(1280);
 expect(result.previewPixels).toBeGreaterThan(1000);
 expect(result.exitPixels).toBeGreaterThan(1000);
 expect(result.subtitlePixels).toBeGreaterThan(150);
 await page.locator('canvas').screenshot({path:info.outputPath(`region1-${route.slug}-exit-preview.png`)});
});
