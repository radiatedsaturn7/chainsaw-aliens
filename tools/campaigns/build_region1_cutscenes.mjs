/**
 * Compile the Region 1 screenplay and approved rendered PNG stills into
 * existing Movie Maker documents. The input directory is not imported:
 * only specifically named, individually checked fictional art is copied.
 *
 *   node tools/campaigns/build_region1_cutscenes.mjs \
 *     --project /path/to/repo --stills /path/to/approved-stills
 *   node tools/campaigns/build_region1_cutscenes.mjs --inventory
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {normalizeCutsceneDocument} from '../../src/ui/CutsceneEditor.js';
import {authorCampaignPath,REGION1_FINALE} from '../../src/menus/CampaignPaths.js';
import {raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
import {PROVIDENCE_BOSS} from '../../src/menus/CampaignProgression.js';
import {authorCampaignTopology} from './author_campaign_road_topology.mjs';

import {beatsByStill,coverageByStill,scoreByScene,scoreRefs,additionalStills} from './region1_cinematic_direction.mjs';

export const SCREENPLAY='AI/last-on-the-grid/SCRIPTS/01-rhode-island-full-draft.md';
const saveRoot='data/server-storage/files/';
const id=(slug,phase)=>'r1-'+slug+'-'+phase;
const cue=(shot,from,to)=>({shot,from,to});
const race=(ref,slug,title,before,after)=>({ref,slug,title,before,after});
export const REGION1_RACES=[
 {ref:'Tower Hill Road',existing:true,start:'introtowerhill',finish:'lastongridintro'},
 race('Blue Hills — Reservation Parkways','blue-hills','Blue Hills',[
  cue('garage-map','### SCENE 2','**[OPTIONAL — GARAGE INSPECTION'),
  cue('blue-hills-arrival','### SCENE 3','**[PLAY — 1-2'),
 ],[
  cue('blue-hills-summit','**[SCENE — BLUE HILLS SUMMIT','### SCENE 4'),
 ]),
 race(PROVIDENCE_BOSS,'providence','Providence',[
  cue('providence-return',null,null),
 ],[
  cue('providence-return','**[PLAY — 1-3','**[SCENE — PROVIDENCE, THE RUINED LAB'),
  cue('providence-lab','**[SCENE — PROVIDENCE, THE RUINED LAB','### SCENE 5'),
 ]),
 race('RI 116 — North Smithfield Scituate','ri116','RI 116',[
  cue('ri116-road-map','### SCENE 5','**[PLAY — 1-4'),
 ],[
  cue('ri116-road-map','**[PLAY — 1-4','**[SCENE — THE HOUSE'),
  cue('ri116-house','**[SCENE — THE HOUSE','### SCENE 6'),
 ]),
 race('RI 44 — Putnam Pike Glocester','ri44','Putnam Pike',[
  cue('ri44-convoy','### SCENE 6','**[PLAY — 1-5'),
 ],[
  cue('ri44-convoy','**[PLAY — 1-5','**[SCENE — OFF THE ROAD'),
  cue('ri44-roadside','**[SCENE — OFF THE ROAD','### SCENE 7'),
 ]),
 race(REGION1_FINALE,'pachaug','Pachaug',[
  cue('pachaug-forest',null,null),
 ],[
  cue('pachaug-forest','**[PLAY — 1-6','**[SCENE — THE CAMPSITE'),
  cue('pachaug-camp','**[SCENE — THE CAMPSITE','**END CHAPTER ONE.**'),
 ]),
 race('Thompson Speedway — 1.7-mile road course','thompson','Thompson Speedway',[
  cue('thompson-grid','### SIDE STORY A','**[PLAY — OPTIONAL THOMPSON'),
 ],[
  cue('thompson-finish','**[SCENE — AFTER THE RESULT','### SIDE STORY B'),
 ]),
 race('Boston, MA — Landmark Run','boston','Boston Outskirts',[
  cue('boston-outskirts','### SIDE STORY B','**[PLAY — OPTIONAL BOSTON'),
 ],[
  cue('boston-music-shop','**[SCENE — THE MUSIC SHOP','## Campaign implementation handoff'),
 ]),
];
// A distinct editor document, never wired as a compulsory race scene. The
// screenplay's separate inspect action and restoration quest are not simulated.
export const OPTIONAL_STILLS=[...new Set(Object.values(coverageByStill)
 .flatMap(c=>[c.robStill,c.caitStill,c.insertStill]).concat(additionalStills).filter(Boolean))].sort();
export const OPTIONAL_SCENES=[
 {slug:'garage-m3',title:'Garage M3 inspection',shots:[cue('garage-map','**[OPTIONAL — GARAGE INSPECTION','### SCENE 3')]},
];
const W=256,H=144;
const stableSaveAt=Date.UTC(2026,10,25,16,37);
// Terminal bitmap glyphs do not cover typographic punctuation.
const glyphText=s=>s.normalize('NFC').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/[–—]/g,' - ');
const dialogueLine=/^\*\*(ROB|CAIT)(?: \([^*]*\))?:\*\*\s*“(.*)”(?:\s*\*.*\*)?\s*$/;

function findLandmark(lines,prefix,after){
 const i=lines.findIndex((line,index)=>index>=after&&line.startsWith(prefix));
 assert.ok(i>=0,'Screenplay marker is missing: '+prefix);
 return i;
}

export function screenplayDialogue(script,from,to){
 if(!from&&!to)return [];
 assert.ok(from&&to);
 const lines=script.split(/\r?\n/),start=findLandmark(lines,from,0),end=findLandmark(lines,to,start+1);
 return lines.slice(start+1,end).map(line=>[line,line.match(dialogueLine)]).flatMap(([line,m])=>{
  if(!m){assert.ok(!/^\*\*(?:ROB|CAIT)(?:[: (])/.test(line),'Unrecognized dialogue line: '+line);return [];}
  return [{speaker:m[1],text:glyphText(m[2])}];
 });
}

export function sceneRecipe(){
 const raceScenes=REGION1_RACES.filter(r=>!r.existing).flatMap(r=>['before','after'].map(phase=>({
  name:id(r.slug,phase==='before'?'intro':'exit'),title:r.title+(phase==='before'?' · Before the run':' · After the run'),
  raceRef:r.ref,phase,shots:r[phase],
 })));
 const standalone=OPTIONAL_SCENES.map(r=>({name:'r1-'+r.slug,title:r.title,shots:r.shots,phase:'optional'}));
 return [...raceScenes,...standalone];
}

export function sceneInventory(){
 return [...new Set(sceneRecipe().flatMap(scene=>scene.shots.map(s=>s.shot)))].sort();
}

function shotDurationMs(text){
 const words=text.trim().split(/\s+/).length;
 return Math.max(1350,Math.ceil((520+words*310)/50)*50);
}
function captionParts(text){
 const words=text.split(/\s+/),parts=[];
 let next='';
 for(const word of words){
  if(next.length+word.length+1>110&&next){parts.push(next);next='';}
  next+=(next?' ':'')+word;
 }
 if(next)parts.push(next);
 return parts;
}
function imageDimensions(buffer,label){
 const magic=Buffer.from([137,80,78,71,13,10,26,10]);
 assert.ok(buffer.length>32&&buffer.subarray(0,8).equals(magic)&&buffer.toString('ascii',12,16)==='IHDR',label+' must be an actual PNG.');
 const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
 assert.ok(width>=1280&&height>=720&&width/height>=1.48&&width/height<=2.02,label+' must be a wide still (3:2 to 2:1), at least 1280 × 720.');
 return {width,height};
}

export function compileScene(recipe,script,imageInfo){
 const assets=new Map(),clips=[],silences=[],tracks=[
  // Movie Maker paints its first track over the others.
  {id:'dialogue',name:'Rob / Cait dialogue'},
  {id:'caption-panel',name:'Subtitle Contrast'},
  {id:'stills',name:'Camera / Stills'},
  {id:'score',name:'Music / Silence',type:'audio'},
 ];
 let startMs=0,sequence=0,lastStill=null;
 const frameTypes=new Set(['wide','alternate','insert','rob','cait']);
 function addStill(still,how,startMs,durationMs,override){
  if(durationMs<=0)return;
  assert.ok(frameTypes.has(how),'Unrecognized Region 1 camera: '+how);
  const frame=how,cov=coverageByStill[still]||{};
  let shot=still, anchor=cov[frame];
  if((frame==='rob'||frame==='cait')&&!anchor)anchor=[.5,.5,1.09];
  if(frame==='alternate')anchor=[.51,.49,1.17];
  const special=override||cov[frame+'Still'];
  if(special&&imageInfo.has(special)){shot=special;anchor=[.50,.49,1.09];}
  const image=imageInfo.get(shot);
  assert.ok(image,'Missing approved still: '+shot);
  const assetId='shot-'+shot;
  if(!assets.has(assetId))assets.set(assetId,{id:assetId,type:'image',name:shot+'.png',dataUrl:{__chainsawAssetRef:'assets/'+shot+'.png',mime:'image/png'},width:image.width,height:image.height});
  // Wide preserves all art. Punch-ins fill the stage with no geometric
  // stretch; edge clamps prevent a black margin on a panned close-up.
  const ratio=image.width/image.height,w=anchor?Math.max(W,H*ratio):Math.min(W,H*ratio),h=w/ratio;
  const [u,v,zoom]=anchor||[.5,.5,1];
  const balance=(screen,drawn,focus)=>screen/2+Math.min(Math.max(0,(drawn-screen)/2),Math.max(-Math.max(0,(drawn-screen)/2),(.5-focus)*drawn));
  const pose=(t,scale)=>({timeMs:t,manual:true,x:balance(W,w*scale,u),y:balance(H,h*scale,v),w,h,scale});
  const move=duration=>duration>=900?(frame==='wide'||frame==='insert'? .035 : .022):0;
  const previous=lastStill;
  if(previous&&previous.assetId===assetId&&previous.id.startsWith(frame+'-shot-')&&previous.startMs+previous.durationMs===startMs){
   previous.durationMs+=durationMs;
   previous.keyframes[1]=pose(previous.durationMs,zoom+move(previous.durationMs));
   return;
  }
  lastStill={id:frame+'-shot-'+sequence++,type:'image',layerId:'background',trackId:'stills',assetId,startMs,durationMs,
   ...pose(0,zoom),keyframes:[pose(0,zoom),pose(durationMs,zoom+move(durationMs))]};
  clips.push(lastStill);
 }
 const silence=(from,to,full=false)=>{if(to>from)silences.push({from,to,full});};
 for(const [block,{shot,from,to}] of recipe.shots.entries()){
  const dialogue=screenplayDialogue(script,from,to),notes=beatsByStill[shot]||[];
  if(from)assert.ok(dialogue.length,'Empty scripted dialogue: '+from);
  const cov=coverageByStill[shot]||{};
  const rapid=/-thompson-|-ri44-intro/.test(recipe.name);
  const contemplative=/-ri116-exit|-pachaug-exit/.test(recipe.name);
  const prelude=block?540:rapid?720:contemplative?1420:1100;
  if(!dialogue.length){
   const open=rapid?1000:1300;
   addStill(shot,'wide',startMs,open);
   addStill(shot,'insert',startMs+open,1200);
   addStill(shot,'alternate',startMs+open+1200,1000);
   startMs+=open+2200;
   continue;
  }
  addStill(shot,'wide',startMs,prelude);
  let cursor=startMs+prelude,lastFrame='alternate';
  for(const [index,{speaker,text}] of dialogue.entries()){
   const note=notes.find(b=>text.startsWith(b.prefix))||{};
   const subject=speaker.toLowerCase(),listener=subject==='rob'?'cait':'rob';
   // Lead with a speaker close-up, then spend some exchanges off-camera so
   // there is rhythm rather than automatic left/right slideshow cutting.
   const autoFrame=!cov[subject]?(index%4===2?'alternate':'wide'):
    index%5===2?'wide':index%5===4?listener:subject;
   const frame=note.frame||autoFrame;
   if(note.before){
    addStill(shot,lastFrame,cursor,note.before);
    if(note.silence)silence(cursor,cursor+note.before,true);
    cursor+=note.before;
   }
   const captions=captionParts(text);
   const durationMs=captions.reduce((sum,c)=>sum+shotDurationMs(c),0);
   addStill(shot,frame,cursor,durationMs,note.alternate);
   if(note.silence)silence(cursor,cursor+durationMs,true);
   for(const part of captions){
    const durationMs=shotDurationMs(part);
    clips.push({id:'contrast-'+sequence++,type:'color-board',layerId:'sprites',trackId:'caption-panel',startMs:cursor,durationMs,x:128,y:126,w:256,h:36,color:'#0a111b',opacity:.73,fadeInMs:70,fadeOutMs:85});
    clips.push({id:'caption-'+sequence++,type:'text',layerId:'text',trackId:'dialogue',startMs:cursor,durationMs,text:speaker+': '+part,
     x:128,y:126,w:236,h:36,textAlign:'center',fontSize:8,color:speaker==='CAIT'?'#d2e9ff':'#fff1db',textBorderEnabled:true,textBorderColor:'#101820',textBorderSize:1,
     animation:'none',showCursor:false,fadeInMs:75,fadeOutMs:100});
    cursor+=durationMs;
   }
   // Reactions have no subtitle at all. Let a look carry the scripted beat.
   const gap=note.after??(rapid?135:contemplative?270:205);
   lastFrame=note.look||frame;
   if(gap){
    addStill(shot,lastFrame,cursor,gap);
    if(note.silence)silence(cursor,cursor+gap,true);
    else if(note.look&&gap>=700)silence(cursor,cursor+gap);
    cursor+=gap;
   }
  }
  const tail=block===recipe.shots.length-1?(rapid?670:contemplative?1450:950):270;
  addStill(shot,'wide',cursor,tail);
  startMs=cursor+tail;
 }
 const score=scoreByScene[recipe.name];
 // Every new document carries a real Movie Maker music asset/track; score
 // eases underneath dialogue and drops out completely at the pivotal beats.
 assert.ok(score,'Missing Region 1 score direction: '+recipe.name);
 const start=score.arrival,end=startMs-70,len=end-start;
 const key=new Map([[0,0],[Math.min(900,Math.floor(len/3)),score.normal],[Math.max(0,len-score.tail),score.normal],[len,0]]);
 for(const {from,to,full} of silences){
  const l=from-start,r=to-start,mix=full?score.silence:score.hush;
  if(l<0||r>len)continue;
  for(const t of key.keys())if(t>=l&&t<=r)key.delete(t);
  key.set(Math.max(0,l-210),score.normal);key.set(l,mix);key.set(r,mix);key.set(Math.min(len,r+380),score.normal);
 }
 // Adjacent full-silence intervals are generated per caption/reaction; clear
 // any return key accidentally added by one adjacent cut at their boundary.
 for(const {from,to,full} of silences)if(full)for(const t of key.keys())if(t>=from-start&&t<=to-start)key.set(t,0);
 key.set(0,0);key.set(len,0);
 assets.set('region1-score',{id:'region1-score',type:'music',name:score.ref,ref:score.ref});
 clips.push({id:'score-bed',type:'music',layerId:'audio',trackId:'score',assetId:'region1-score',startMs:start,durationMs:len,loop:true,volume:0,fadeMs:180,
  keyframes:[...key].sort(([a],[b])=>a-b).map(([timeMs,volume])=>({timeMs,volume,manual:true}))});
 return normalizeCutsceneDocument({name:recipe.name,description:recipe.title,width:W,height:H,durationMs:startMs,fps:30,sceneFadeInMs:rapidFade(recipe.name)?190:365,sceneFadeOutMs:rapidFade(recipe.name)?300:510,tracks,clips,assets:[...assets.values()]});
}

const rapidFade=name=>/-thompson-|-ri44/.test(name);

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const unpack=raw=>raw.__chainsawStorage==='compact-v1'?JSON.parse(gunzipSync(Buffer.from(raw.data,'base64'))):raw;
const repack=(raw,doc)=>raw.__chainsawStorage==='compact-v1'
 ?{...raw,data:gzipSync(JSON.stringify(doc),{level:9}).toString('base64')}:doc;
const json=data=>JSON.stringify(data,null,2)+'\n';

export function updateRegion1Menu(menu){
 const progression=menu.parameters?.campaignProgression;
 const index=progression?.regions.findIndex(r=>r.stage===1&&r.bossRef===PROVIDENCE_BOSS)??-1;
 assert.notEqual(index,-1,'Region 1 authoring data missing from Game Menu.');
 const region=progression.regions[index]=authorCampaignPath(progression.regions[index]);
 assert.equal(region.finaleRef,REGION1_FINALE,'Campaign catalog does not include all Chapter One races.');
 const map=menu.screens?.find(s=>s.id==='campaign-hub-1')?.elements.find(e=>e.id==='regional-path');
 assert.ok(map,'Region 1 map is missing.');
 const pinIDs=new Map(map.nodes.map(n=>[n.raceRef,n.id]));
 assert.ok(REGION1_RACES.every(r=>pinIDs.has(r.ref)),'Region 1 map is missing a story stop.');
 const orders={1:region.mainPath.map(ref=>pinIDs.get(ref))};
 const branchParents={1:Object.fromEntries(region.branches.map(b=>[pinIDs.get(b.raceRef),pinIDs.get(b.after)]))};
 authorCampaignTopology(menu,{orders,branchParents,stages:[1]});
 const eventScreen=menu.screens.find(s=>s.id==='campaign-hub-1-events');
 const row=eventScreen?.elements.find(e=>e.action?.parameter==='raceRef'&&(e.action.value===PROVIDENCE_BOSS||e.action.value===REGION1_FINALE));
 if(row)row.action.value=REGION1_FINALE;
 const world=menu.screens.find(s=>s.id==='world-map')?.elements.find(e=>e.type==='world-map');
 const pin=world?.nodes.findIndex(n=>n.raceRef===PROVIDENCE_BOSS)??-1;
 assert.ok(pin>=0&&world.nodes[pin+1],'World map is missing the Region 1 → Region 2 connection.');
 world.nodes[pin].completedParameter=raceCompletionKey(REGION1_FINALE);
 world.nodes[pin+1].unlockParameter=raceCompletionKey(REGION1_FINALE);
 return menu;
}

export function updateRegion1Race(doc,recipe){
 const raceData=doc.race||doc;
 if(recipe.existing){
  assert.equal(raceData.raceStart?.cutsceneRef,recipe.start,'Existing Tower Hill opening hook changed.');
  assert.equal(raceData.finishBehavior?.cutsceneRef,recipe.finish,'Existing Tower Hill garage hook changed.');
  return doc;
 }
 const before=id(recipe.slug,'intro'),after=id(recipe.slug,'exit');
 assert.ok(!raceData.raceStart?.cutsceneRef||raceData.raceStart.cutsceneRef===before,'Refusing to overwrite unrelated race intro for '+recipe.ref);
 assert.ok(!raceData.finishBehavior?.cutsceneRef||raceData.finishBehavior.cutsceneRef===after,'Refusing to overwrite unrelated race exit for '+recipe.ref);
 assert.equal(raceData.finishBehavior?.type,'menu','Race must return to a menu to play exit cutscene: '+recipe.ref);
 assert.ok(!(raceData.road?.network?.nodes||[]).some(n=>n.finish?.destination),'Unexpected alternate finish destination in '+recipe.ref);
 raceData.raceStart={...raceData.raceStart,cutsceneRef:before};
 raceData.finishBehavior={...raceData.finishBehavior,cutsceneRef:after,menuScreen:recipe.ref===REGION1_FINALE?'world-map':'campaign-hub-1'};
 return doc;
}

export function compileRegion1(project,stills,{dryRun=false,cinematicOnly=false}={}){
 const root=path.resolve(project,saveRoot),script=fs.readFileSync(path.resolve(project,SCREENPLAY),'utf8');
 const manifestFile=path.join(root,'manifest.json'),manifest=readJson(manifestFile);
 for(const name of scoreRefs)assert.ok(manifest.folders.music?.[name],'Missing project MIDI: '+name);
 const existingInputs=new Map();
 if(cinematicOnly)for(const {name} of sceneRecipe()){
  const docPath=manifest.folders.cutscenes?.[name];
  assert.ok(docPath,'Missing existing scene for camera-only rebuild: '+name);
  const dir=path.dirname(path.join(root,docPath));
  for(const file of fs.readdirSync(path.join(dir,'assets')).filter(file=>file.endsWith('.png'))){
   const key=file.slice(0,-4),source=path.join(dir,'assets',file);
   if(existingInputs.has(key))assert.ok(fs.readFileSync(source).equals(fs.readFileSync(existingInputs.get(key))), 'Conflicting approval art for '+key);
   else existingInputs.set(key,source);
  }
 }
 const source=shot=>cinematicOnly
  ?(additionalStills.includes(shot)&&stills&&fs.existsSync(path.resolve(stills,shot+'.png'))?path.resolve(stills,shot+'.png'):existingInputs.get(shot))
  :path.resolve(stills,shot+'.png');
 const supplied=[...sceneInventory(),...OPTIONAL_STILLS.filter(s=>source(s)&&fs.existsSync(source(s)))];
 const imageInfo=new Map(supplied.map(shot=>{
  assert.ok(source(shot),'Missing approved still: '+shot);
  const bytes=fs.readFileSync(source(shot));
  return [shot,{...imageDimensions(bytes,shot),bytes}];
 }));
 // Validate everything before mutating either a menu or race hookup.
 const writes=new Map(),scenes=sceneRecipe();
 for(const recipe of scenes){
  const scene=compileScene(recipe,script,imageInfo),dir=path.join(root,'cutscenes',scene.name);
  const relative='cutscenes/'+scene.name+'/document.json';
  assert.ok(!manifest.folders.cutscenes[scene.name]||manifest.folders.cutscenes[scene.name]===relative,'Cutscene name collision.');
  manifest.folders.cutscenes[scene.name]=relative;
  writes.set(path.join(dir,'document.json'),json(scene));
  if(cinematicOnly){
   for(const asset of scene.assets.filter(a=>a.type==='image')){
    const to=path.join(dir,asset.dataUrl.__chainsawAssetRef),bytes=imageInfo.get(asset.name.slice(0,-4)).bytes;
    if(!fs.existsSync(to))writes.set(to,bytes);
    else assert.ok(bytes.equals(fs.readFileSync(to)),'Unexpected local asset drift: '+to);
   }
   continue;
  }
  const meta=path.join(dir,'metadata.json');
  writes.set(meta,json(fs.existsSync(meta)?readJson(meta):{name:scene.name,folder:'cutscenes',savedAt:stableSaveAt,version:1}));
  for(const asset of scene.assets.filter(a=>a.type==='image')){const shot=asset.name.slice(0,-4);writes.set(path.join(dir,asset.dataUrl.__chainsawAssetRef),imageInfo.get(shot).bytes);}
 }
 if(!cinematicOnly){
 for(const recipe of REGION1_RACES){
  const relative=manifest.folders.races[recipe.ref];
  assert.ok(relative,'Race missing from manifest: '+recipe.ref);
  const file=path.join(root,relative),raw=readJson(file);
  const updated=updateRegion1Race(unpack(raw),recipe);
  if(!recipe.existing)writes.set(file,json(repack(raw,updated)));
 }
 const menuFile=path.join(root,manifest.folders.menus['Game Menu']),menuRaw=readJson(menuFile);
 writes.set(menuFile,json(repack(menuRaw,updateRegion1Menu(unpack(menuRaw)))));
 manifest.folders.cutscenes=Object.fromEntries(Object.entries(manifest.folders.cutscenes).sort(([a],[b])=>a<b?-1:a>b?1:0));
 writes.set(manifestFile,json(manifest));
 }
 if(!dryRun)for(const [file,data] of writes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
 return {stills:imageInfo.size,scenes:scenes.length,newRaceHooks:cinematicOnly?0:REGION1_RACES.length-1,files:[...writes.keys()].map(f=>path.relative(project,f))};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const args=process.argv.slice(2);
 const arg=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
 if(args.includes('--inventory'))console.log(JSON.stringify(sceneInventory(),null,2));
 else{
  const project=arg('--project')||process.cwd(),stills=arg('--stills');
  const cinematicOnly=args.includes('--cinematic-only');
  assert.ok(stills||cinematicOnly,'Provide --stills containing approved illustrated PNGs; use --inventory for filenames.');
  console.log(JSON.stringify(compileRegion1(project,stills,{dryRun:args.includes('--dry-run'),cinematicOnly}),null,2));
 }
}
