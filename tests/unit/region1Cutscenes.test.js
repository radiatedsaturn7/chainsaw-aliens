import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {CutscenePlayer,normalizeCutsceneDocument,sampleCutsceneClip,sampleCutsceneAudioVolume} from '../../src/ui/CutsceneEditor.js';
import {campaignRaceAccess,campaignRegionState,migrateCampaignProgress,PROVIDENCE_BOSS} from '../../src/menus/CampaignProgression.js';
import {REGION1_FINALE} from '../../src/menus/CampaignPaths.js';
import {captureCampaignWorldReturn} from '../../src/menus/CampaignWorldReveal.js';
import {raceCompletionKey,worldMapNodes} from '../../src/menus/MenuWorldMap.js';
import {compileScene,sceneRecipe,sceneInventory,OPTIONAL_STILLS,SCREENPLAY,updateRegion1Menu,updateRegion1Race,REGION1_RACES} from '../../tools/campaigns/build_region1_cutscenes.mjs';
import {mapRoadRoute} from '../../src/menus/MenuMapRoads.js';
import {resolveRaceNodeFinish} from '../../src/racing/RaceFinishNodes.js';

const source=fs.readFileSync(new URL('../../'+SCREENPLAY,import.meta.url),'utf8');
const primary=new Map(sceneInventory().map(shot=>[shot,{width:1280,height:720}]));
const all=new Map([...sceneInventory(),...OPTIONAL_STILLS].map(shot=>[shot,{width:1280,height:720}]));
const recipes=sceneRecipe();
const sceneMap=new Map(recipes.map(r=>[r.name,compileScene(r,source,all)]));
const textOf=doc=>doc.clips.filter(c=>c.type==='text').map(c=>c.text).join('\n');

test('each Region 1 race has two distinct editable Movie Maker documents, except the preserved opening',()=>{
 assert.equal(REGION1_RACES.length,8);
 assert.equal(sceneMap.size,15);
 assert.equal(sceneInventory().length,15);
 const opening={race:{raceStart:{cutsceneRef:'introtowerhill'},finishBehavior:{cutsceneRef:'lastongridintro',timeLimitSeconds:210,skipResults:true}}};
 const unchanged=structuredClone(opening);
 assert.deepEqual(updateRegion1Race(opening,REGION1_RACES[0]),unchanged);
 assert.ok(!sceneMap.has('lastongridintro')&&!sceneMap.has('introtowerhill'));
 for(const recipe of REGION1_RACES.slice(1)){
  const base={race:{id:recipe.ref,raceStart:{musicTrackId:'untouched'},finishBehavior:{type:'menu',menuScreen:'world-map',variables:{a:true}},road:{network:{nodes:[{id:'exit'}],finishNodeId:'exit'}}}};
  const race=updateRegion1Race(base,recipe).race;
  assert.ok(sceneMap.has(race.raceStart.cutsceneRef));
  assert.ok(sceneMap.has(race.finishBehavior.cutsceneRef));
  assert.equal(race.raceStart.musicTrackId,'untouched');
  assert.equal(resolveRaceNodeFinish(race,'exit').cutsceneRef,race.finishBehavior.cutsceneRef);
  assert.equal(race.finishBehavior.menuScreen,recipe.ref===REGION1_FINALE?'world-map':'campaign-hub-1');
  assert.equal(race.finishBehavior.variables.a,true);
 }
 assert.throws(()=>updateRegion1Race({raceStart:{cutsceneRef:'someone-elses-intro'}},REGION1_RACES[1]),/Refusing to overwrite/);
});

test('native timeline covers its duration; dialogue stays intact with or without optional closeups',()=>{
 const used=new Set();
 for(const recipe of recipes){
  const doc=sceneMap.get(recipe.name),base=compileScene(recipe,source,primary);
  assert.equal(doc.schemaVersion,2);
  assert.deepEqual(doc.tracks.map(t=>t.id),['dialogue','caption-panel','stills','score']);
  assert.equal(doc.width/doc.height,16/9);
  assert.equal(textOf(doc),textOf(base),recipe.name);
  assert.deepEqual(normalizeCutsceneDocument(doc),doc);
  assert.ok(doc.durationMs>=3500);
  const frames=doc.clips.filter(c=>c.type==='image');
  const ids=new Set(doc.assets.map(a=>a.id));
  let t=0;
  for(const frame of frames){
   assert.equal(frame.startMs,t,'there is no momentary cut to black in one visual track');
   assert.ok(frame.durationMs>0&&ids.has(frame.assetId));
   assert.ok(sampleCutsceneClip(frame,t+frame.durationMs/2).scale>=1);
   used.add(frame.assetId);
   t+=frame.durationMs;
  }
  assert.equal(doc.durationMs,t);
  for(const asset of doc.assets.filter(a=>a.type!=='music')){
   assert.equal(asset.type,'image');
   assert.match(asset.dataUrl.__chainsawAssetRef,/^assets\/[a-z0-9-]+\.png$/);
   assert.equal(asset.dataUrl.mime,'image/png');
  }
 }
 for(const shot of OPTIONAL_STILLS)assert.ok(used.has('shot-'+shot),shot);
 const player=new CutscenePlayer({});
 let finished=false;
 const scene=sceneMap.get('r1-ri116-exit');
 player.play(scene,{onDone:()=>{finished=true;}});
 assert.equal(player.active,true);assert.equal(player.doc.name,scene.name);assert.equal(finished,false);
 player.update(scene.durationMs/1000+1);
 assert.equal(finished,true);assert.equal(player.active,false);
});

test('director edit uses continuous camera coverage, clean pauses, and resolvable music in all 15 scenes',()=>{
 const md=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json','utf8'));
 for(const doc of sceneMap.values()){
  const captions=doc.clips.filter(c=>c.type==='text').sort((a,b)=>a.startMs-b.startMs);
  const shots=doc.clips.filter(c=>c.type==='image');
  const score=doc.clips.filter(c=>c.type==='music');
  assert.equal(score.length,1,doc.name);
  assert.ok(md.folders.music[doc.assets.find(a=>a.id===score[0].assetId).ref],doc.name);
  assert.ok(score[0].keyframes.some(k=>k.volume>.04),doc.name);
  assert.ok(score[0].keyframes[0].volume===0&&score[0].keyframes.at(-1).volume===0,doc.name);
  assert.ok(shots.length>=3&&new Set(shots.map(c=>[c.keyframes[0].x,c.keyframes[0].y,c.keyframes[0].scale].join(','))).size>=2,doc.name);
  if(captions.length>=2){
   assert.ok(captions.some((c,i)=>i>0&&c.startMs-(captions[i-1].startMs+captions[i-1].durationMs)>=400),doc.name);
   const boards=doc.clips.filter(c=>c.trackId==='caption-panel');
   assert.deepEqual(boards.map(c=>[c.startMs,c.durationMs]),captions.map(c=>[c.startMs,c.durationMs]),doc.name);
  }
 }
 const house=sceneMap.get('r1-ri116-exit'),reveal=house.clips.find(c=>c.text.includes('She went to Heaven.'));
 const score=house.clips.find(c=>c.type==='music');
 const before=house.clips.find(c=>c.text.includes('What happened?'));
 assert.ok(reveal.startMs-before.startMs-before.durationMs>=1200);
 assert.equal(sampleCutsceneAudioVolume(score,reveal.startMs+400),0);
 assert.equal(sampleCutsceneAudioVolume(score,reveal.startMs+reveal.durationMs+1000),0);
 assert.ok(house.clips.some(c=>c.assetId==='shot-ri116-cait-close'&&c.startMs===reveal.startMs+reveal.durationMs));
});

test('Chapter 1 dialogue keeps the ambiguous Heaven line, non-hostile convoy, and optional stories apart',()=>{
 const lab=textOf(sceneMap.get('r1-providence-exit'));
 const house=textOf(sceneMap.get('r1-ri116-exit'));
 const road=textOf(sceneMap.get('r1-ri44-exit'));
 const forest=textOf(sceneMap.get('r1-pachaug-exit'));
 assert.match(lab,/They did it again\./);
 assert.match(lab,/But we get the road car ready first\./);
 assert.match(house,/ROB: She went to Heaven\./);
 assert.match(house,/Used to think about her every day\./);
 assert.doesNotMatch(house,/she still thinks about me|upload|alive|data center|can call her/i);
 assert.match(road,/We're in their way!/);
 assert.match(road,/I don't think it noticed\./);
 assert.match(forest,/There are a few roads up in New Hampshire I've always wanted to see\./);
 assert.match(textOf(sceneMap.get('r1-thompson-intro')),/Bring it\./);
 assert.match(textOf(sceneMap.get('r1-boston-exit')),/Play it again\./);
 assert.doesNotMatch([...sceneMap.values()].map(textOf).join('\n'),/Jim's|uploaded-human/i);
});

test('actual saved Region 1 route opens Providence third and New Hampshire only after Pachaug',()=>{
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json','utf8'));
 const otherScreens=menu.screens.filter(s=>!['world-map','campaign-hub-1','campaign-hub-1-events'].includes(s.id));
 const oldArtworkPins=menu.screens.find(s=>s.id==='campaign-hub-1').elements.find(e=>e.id==='regional-path').nodes.map(({raceRef,id,x,y})=>({raceRef,id,x,y}));
 updateRegion1Menu(menu);
 assert.deepEqual(menu.screens.filter(s=>!['world-map','campaign-hub-1','campaign-hub-1-events'].includes(s.id)),otherScreens);
 const map=menu.screens.find(s=>s.id==='campaign-hub-1').elements.find(e=>e.id==='regional-path');
 assert.deepEqual(map.nodes.map(({raceRef,id,x,y})=>({raceRef,id,x,y})),oldArtworkPins);
 const region=menu.parameters.campaignProgression.regions[0],config=menu.parameters.campaignProgression;
 assert.equal(region.bossRef,PROVIDENCE_BOSS);assert.equal(region.finaleRef,REGION1_FINALE);
 const route=REGION1_RACES.slice(0,6).map(r=>r.ref);
 assert.deepEqual(region.mainPath,route.slice(0,-1));
 const pin=ref=>map.nodes.find(n=>n.raceRef===ref).id;
 const byPin=ref=>map.nodes.find(n=>n.id===ref).raceRef;
 assert.deepEqual(mapRoadRoute(map.nodes,map.connections,pin(route[0]),pin(REGION1_FINALE)).map(edge=>byPin(edge.previous)),region.mainPath);
 const current=migrateCampaignProgress({}),can=ref=>campaignRaceAccess(config,ref,current,{},{},menu).allowed;
 const newHampshire=config.regions[1].mainPath[0];
 assert.equal(can(PROVIDENCE_BOSS),false);
 assert.equal(can(newHampshire),false);
 route.forEach((ref,index)=>{
  assert.equal(can(ref),true,`story stop ${index+1}: ${ref}`);
  if(index+1<route.length)assert.equal(can(route[index+1]),false,'cannot skip the next race');
  current[raceCompletionKey(ref)]=true;
  assert.equal(can(newHampshire),index===route.length-1);
 });
 const world=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 assert.equal(worldMapNodes(world,{},menu,current)[0].completed,true);
 assert.equal(worldMapNodes(world,{},menu,current)[1].locked,false);
 assert.equal(captureCampaignWorldReturn(menu,PROVIDENCE_BOSS,{},{}),null);
 const finale=captureCampaignWorldReturn(menu,REGION1_FINALE,{},{});
 assert.equal(finale.bossRef,PROVIDENCE_BOSS);
 assert.equal(finale.finaleRef,REGION1_FINALE);
 assert.equal(finale.reveal.toRef,config.regions[1].bossRef);
 const legacy=migrateCampaignProgress({campaignProgressionVersion:1,[raceCompletionKey(PROVIDENCE_BOSS)]:true});
 assert.equal(campaignRegionState(config,region.bossRef,legacy,{},menu).won,false);
 assert.equal(campaignRegionState(config,config.regions[1].bossRef,legacy,{},menu).open,true);
 assert.equal(legacy[raceCompletionKey(REGION1_FINALE)],undefined);
});

test('3:2 generated imports preserve aspect ratio inside the 16:9 Movie Maker stage',()=>{
 const recipe=recipes.find(r=>r.name==='r1-providence-intro');
 const info=new Map([['providence-return',{width:1536,height:1024}]]);
 const doc=compileScene(recipe,source,info),[frame]=doc.clips;
 assert.equal(frame.w/frame.h,1.5);assert.equal(doc.width/doc.height,16/9);
 assert.ok(frame.w<doc.width);assert.equal(frame.h,doc.height);
});
