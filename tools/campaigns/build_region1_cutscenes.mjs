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
const OPTIONAL_CUTS={
 'blue-hills-summit':[{shot:'blue-hills-cait-close',from:'Jesus.',until:'Rob?'}],
 'providence-lab':[{shot:'providence-salvage-close',from:"The BMW's still here."}],
 'ri116-house':[
  {shot:'ri116-rob-close',from:'She always left that light on.',until:"You remembered where to park."},
  {shot:'ri116-cait-close',from:"Sounds like you had some good times.",until:'Used to think about her every day.'},
  {shot:'ri116-rob-close',from:'Used to think about her every day.',until:"Can't imagine that."}
 ],
 'pachaug-camp':[{shot:'pachaug-cups-close',from:"I didn't mean for any of this to happen.",until:'I was looking at the routes for tomorrow.'}],
 'boston-music-shop':[{shot:'boston-guitar-close',from:'Play something.',until:"It's nice."}],
};
export const OPTIONAL_STILLS=[...new Set(Object.values(OPTIONAL_CUTS).flatMap(cuts=>cuts.map(cut=>cut.shot)))].sort();
export const OPTIONAL_SCENES=[
 {slug:'garage-m3',title:'Garage M3 inspection',shots:[cue('garage-map','**[OPTIONAL — GARAGE INSPECTION','### SCENE 3')]},
];
const W=256,H=144;
const START_MARGIN=1150,END_MARGIN=950;
const stableSaveAt=Date.UTC(2026,10,25,16,37);
const silentDuration=3500;
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
 const assets=new Map(),clips=[],tracks=[
  // Movie Maker paints its first track in front and its last track in back.
  {id:'dialogue',name:'Rob / Cait dialogue'},
  {id:'caption-panel',name:'Subtitle Contrast'},
  {id:'stills',name:'Storyboards / Cinematic Stills'},
 ];
 let startMs=0,sequence=0;
 function addStill(shot,startMs,durationMs,crop){
  const image=imageInfo.get(shot);
  assert.ok(image,'Missing approved still: '+shot);
  const assetId='shot-'+shot;
  if(!assets.has(assetId))assets.set(assetId,{id:assetId,type:'image',name:shot+'.png',dataUrl:{__chainsawAssetRef:'assets/'+shot+'.png',mime:'image/png'},width:image.width,height:image.height});
  // Accept a generated wide still without stretching faces. A native 16:9
  // frame is full bleed; other ratios use quiet framing around the original.
  const ratio=image.width/image.height,w=Math.min(W,H*ratio),h=Math.min(H,W/ratio);
  if(durationMs>0)clips.push({id:'still-'+sequence++,type:'image',layerId:'background',trackId:'stills',assetId,startMs,durationMs,x:W/2,y:H/2,w,h,
   keyframes:[{timeMs:0,x:W/2,y:H/2,w,h,scale:1},{timeMs:durationMs,x:W/2,y:H/2,w,h,scale:crop}]});
 }
 for(const {shot,from,to} of recipe.shots){
  const dialogue=screenplayDialogue(script,from,to);
  if(from)assert.ok(dialogue.length,'Empty scripted dialogue: '+from);
  const marks=[0];
  for(const {text} of dialogue)marks.push(marks.at(-1)+captionParts(text).reduce((sum,part)=>sum+shotDurationMs(part),0));
  const captions=dialogue.flatMap(({speaker,text})=>captionParts(text).map(part=>({speaker,text:part})));
  const durationMs=captions.length?START_MARGIN+captions.reduce((sum,c)=>sum+shotDurationMs(c.text),0)+END_MARGIN:silentDuration;
  const cuts=[];
  for(const cut of OPTIONAL_CUTS[shot]||[]){
   if(!imageInfo.has(cut.shot)||!dialogue.length)continue;
   const first=dialogue.findIndex(d=>d.text.startsWith(cut.from));
   const last=cut.until?dialogue.findIndex((d,i)=>i>first&&d.text.startsWith(cut.until)):dialogue.length;
   if(first<0||last<=first)continue;
   cuts.push({shot:cut.shot,inMs:startMs+START_MARGIN+marks[first],outMs:startMs+START_MARGIN+marks[last]});
  }
  let stillStart=startMs;
  for(const cut of cuts.sort((a,b)=>a.inMs-b.inMs)){
   assert.ok(cut.inMs>=stillStart,'Optional cutaways overlap.');
   addStill(shot,stillStart,cut.inMs-stillStart,1.035);
   addStill(cut.shot,cut.inMs,cut.outMs-cut.inMs,1.015);
   stillStart=cut.outMs;
  }
  addStill(shot,stillStart,startMs+durationMs-stillStart,1.035);
  let cursor=startMs+START_MARGIN;
  if(captions.length)clips.push({id:'contrast-'+sequence++,type:'color-board',layerId:'sprites',trackId:'caption-panel',startMs:cursor,durationMs:durationMs-START_MARGIN-END_MARGIN,x:128,y:126,w:256,h:36,color:'#0a111b',opacity:.73});
  for(const {speaker,text} of captions){
   const durationMs=shotDurationMs(text);
   clips.push({id:'caption-'+sequence++,type:'text',layerId:'text',trackId:'dialogue',startMs:cursor,durationMs,text:speaker+': '+text,
    x:128,y:126,w:236,h:36,textAlign:'center',fontSize:8,color:speaker==='CAIT'?'#d2e9ff':'#fff1db',textBorderEnabled:true,textBorderColor:'#101820',textBorderSize:1,
    animation:'none',showCursor:false,fadeInMs:70,fadeOutMs:75});
   cursor+=durationMs;
  }
  startMs+=durationMs;
 }
 return normalizeCutsceneDocument({name:recipe.name,description:recipe.title,width:W,height:H,durationMs:startMs,fps:30,sceneFadeInMs:280,sceneFadeOutMs:380,tracks,clips,assets:[...assets.values()]});
}

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

export function compileRegion1(project,stills,{dryRun=false}={}){
 const root=path.resolve(project,saveRoot),script=fs.readFileSync(path.resolve(project,SCREENPLAY),'utf8');
 const manifestFile=path.join(root,'manifest.json'),manifest=readJson(manifestFile);
 const supplied=[...sceneInventory(),...OPTIONAL_STILLS.filter(s=>fs.existsSync(path.resolve(stills,s+'.png')))];
 const imageInfo=new Map(supplied.map(shot=>{
  const f=path.resolve(stills,shot+'.png'),bytes=fs.readFileSync(f);
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
  const meta=path.join(dir,'metadata.json');
  writes.set(meta,json(fs.existsSync(meta)?readJson(meta):{name:scene.name,folder:'cutscenes',savedAt:stableSaveAt,version:1}));
  for(const asset of scene.assets){const shot=asset.name.slice(0,-4);writes.set(path.join(dir,asset.dataUrl.__chainsawAssetRef),imageInfo.get(shot).bytes);}
 }
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
 if(!dryRun)for(const [file,data] of writes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
 return {stills:imageInfo.size,scenes:scenes.length,newRaceHooks:REGION1_RACES.length-1,files:[...writes.keys()].map(f=>path.relative(project,f))};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const args=process.argv.slice(2);
 const arg=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
 if(args.includes('--inventory'))console.log(JSON.stringify(sceneInventory(),null,2));
 else{
  const project=arg('--project')||process.cwd(),stills=arg('--stills');
  assert.ok(stills,'Provide --stills containing approved illustrated PNGs; use --inventory for filenames.');
  console.log(JSON.stringify(compileRegion1(project,stills,{dryRun:args.includes('--dry-run')}),null,2));
 }
}
