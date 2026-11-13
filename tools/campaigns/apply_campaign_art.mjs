// Wire reviewed saved art; never alter imported geometry or mission physics.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
const root='data/server-storage/files';
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const read=p=>decode(JSON.parse(fs.readFileSync(p)));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const encode=d=>({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(d)),{level:9,mtime:0}).toString('base64')});
const manifest=read(`${root}/manifest.json`),imports=read('data/campaigns/america/art-imports.json');
const tree=read(`${root}/doodads/tree/document.json`).doodad;
const dimensions={ 'leafless-tree-01':12,'leafless-tree-02':11,'leafless-tree-03':10,'laurel-forest-cabin':6,'laurel-park-sign':3,'laurel-stone-retaining-wall':1.5 };
Object.assign(dimensions,{'frozen-bush-01':1.3,'frozen-bush-02':1.7,'frozen-bush-03':1.4,'gray-rock-01':.7,'gray-rock-02':.9,'gray-rock-03':.5});
Object.assign(dimensions,{'tower-hill-small-shed':3.5,'tower-hill-mailbox':1.5,'tower-hill-short-stone-wall':1.2,
 'mount-washington-summit-building-silhouette':9,'mount-washington-weather-instruments':3,
 'ohio-river-crossing-distant-bridge-silhouette':16,'ohio-river-crossing-flood-marker':2,
 'ohio-river-crossing-riverbank-vegetation':1.8,'ohio-river-crossing-riverside-building':7});
const westernKits={
 'pikes-peak':{key:'pikes',parts:{'alpine-vegetation':1.2,'granite-outcrop':3,'snow-fence':1.7}},
 'moki-dugway':{key:'moki',parts:{'desert-scrub':1.5,'sandstone-outcrop':5}},
 'oak-creek':{key:'oak',parts:{'canyon-cabin':6,'creekside-tree':9,'red-rock-formation':7,'stone-wall':1.5}},
 'angeles-crest':{key:'angeles',parts:{chaparral:2,'dry-mountain-pine':10,'pale-rock-cut':4}},
 'data-center-city':{key:'city',parts:{'cooling-units':3,'loading-dock':5,'security-fencing':3,'server-building':9,'shipping-container':3,'transformer':3}},
 ozarks:{key:'ozark',parts:{barn:8,'creekside-brush':2,'exposed-limestone':2,'farm-gate':1.6,'timber-shed':4}},
 'route-66':{key:'route66',parts:{'abandoned-gas-station':5,billboard:7,diner:5,'motel-sign':5,'rusted-pickup':2,'water-tower':14}}
};
for(const [region,{parts}] of Object.entries(westernKits))for(const [name,height] of Object.entries(parts))dimensions[`${region}-${name}`]=height;
for(const [name,height] of Object.entries({'abandoned-car-01':1.5,'abandoned-car-02':1.5,'abandoned-car-03':1.8,'chevron-left':2.5,'chevron-right':2.5,'concrete-barrier-clean':1,'concrete-barrier-damaged':1,'drainage-culvert-entrance':2,'hairpin-warning-sign':2.5,'metal-guardrail-damaged':.8,'metal-guardrail-intact':.8,'reflector-post':1.2,'road-closed-barricade':1.3,'rockfall-warning-sign':2.5,'rubble-pile':.8,'snow-depth-marker-pole':2,'snowbank-mound':.6,'steep-grade-warning-sign':2.5,'streetlight':8,'traffic-cone':.7,'wooden-fence-broken':1.2,'wooden-fence-intact':1.2,'wooden-utility-pole':10}))dimensions[`roadside-${name}`]=height;
Object.assign(dimensions,{'pikes-peak-summit-sign':2,'moki-dugway-mesa-silhouette':25,'moki-dugway-warning-sign':2.5,'angeles-crest-mountain-silhouette':40,'angeles-crest-turnout-sign':2.5,'snow-covered-pine-01':12,'snow-covered-pine-02':10,'snow-covered-pine-03':10});
Object.assign(dimensions,{'alpine-rock-outcrop-01':4,'alpine-rock-outcrop-02':2,'gray-boulder-01':2,'gray-boulder-02':3,'gray-boulder-03':1.5,'red-sandstone-boulder-01':2,'red-sandstone-boulder-02':3,'red-sandstone-boulder-03':1.5,'dead-broken-tree-01':5,'dead-broken-tree-02':4,'dry-scrub-bush-01':1.3,'dry-scrub-bush-02':1.5,'dry-scrub-bush-03':1.3,'fallen-log-01':1,'mostly-bare-pine-01':10,'mostly-bare-pine-02':8,'stump-01':1});
const expanded=read('data/campaigns/america/expanded-art.json').assets;
for(const a of expanded)if(a.kind!=='skybox')dimensions[a.name]=a.heightM;
const definitions={};const savedAt=Date.now();
for(const [name,height] of Object.entries(dimensions)){
 if(!imports[name]||!manifest.folders.art[name])throw Error(`Import reviewed art first: ${name}`);
 const sprite=imports[name],isTree=/tree|leafless/.test(name)||name.includes('-pine');
 const file=`${root}/doodads/${name}/document.json`;
 // Preserve hand-edited definitions on repeat runs.
 if(fs.existsSync(file)){definitions[name]=read(file).doodad;continue;}
 const width=height*sprite.width/sprite.height;
 const base=/bush|brush|vegetation|chaparral|scrub/.test(name)?read(`${root}/doodads/frozenbush/document.json`).doodad:/rock|boulder|outcrop|sandstone/.test(name)?read(`${root}/doodads/frozenrock/document.json`).doodad:tree;
 const def={...structuredClone(base),id:`campaign-${name}`,name,artRef:name,widthM:width,heightM:height,groundOffsetM:0,
  hitboxWidthM:isTree?1:width*.85,hitboxHeightM:height*.9,weightKg:isTree?350:name.startsWith('frozen-bush')?12:name.startsWith('gray-rock')?150:name.includes('cabin')?10000:1000,
  rules:[],defaultRule:{...base.defaultRule}};
 const extra=expanded.find(a=>a.name===name);
 if(extra){
  const soft=extra.kind==='vegetation',background=extra.kind==='background';
  Object.assign(def,{groundOffsetM:Number(extra.groundOffsetM)||0,weightKg:soft?5:extra.kind==='tree'?350:100000,hitboxWidthM:background?0:extra.kind==='tree'?Math.min(.65,width*.18):width*.85,hitboxHeightM:background?0:height*.9,
   defaultRule:{behavior:soft?'flatten':background?'decoration':'collide',speedDrainPercent:soft?1:background?0:90,damage:{panels:soft||background?0:20,suspension:soft||background?0:8,engine:soft||background?0:4}}});
  if(extra.kind==='fence')Object.assign(def,{isFence:true,fenceThicknessM:.4});
 }
 definitions[name]=def;fs.mkdirSync(`${root}/doodads/${name}`,{recursive:true});
 write(file,{schemaVersion:1,kind:'race-doodad',savedAt,doodad:def});
 write(file.replace('document.json','metadata.json'),{name,folder:'doodads',savedAt,version:1});
 manifest.folders.doodads[name]=`doodads/${name}/document.json`;
}
write(`${root}/manifest.json`,manifest);
if(process.argv.includes('--definitions-only'))process.exit(0);
const catalog=read('data/campaigns/america/catalog.json'),stage=catalog.find(s=>s.sourceKey==='laurel');
if(!stage)throw Error('Middle Route Laurel stage missing');
const file=`${root}/${stage.documentPath}`,doc=read(file),race=doc.race;
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
editor.applyLoadedRaceDocument(race);
// Road ribbon uses image height along the road; baked paint must not duplicate it.
race.roadTextures={...race.roadTextures,builtInLines:false,road:{...race.roadTextures?.road,artRef:'road-asphalt-patched',repeatM:24,repeatWidthM:0,filterMode:'balanced',mipmaps:true}};
let cellIndex=0;
for(const cell of Object.values(race.road.tileMap.cells))cell.artRef=++cellIndex%4===0?'ground-snow-dead-grass':'ground-frozen-forest';
function applyDefinition(prop,name){
 const d=definitions[name];Object.assign(prop,{doodadRef:name,definitionId:d.id,artRef:d.artRef,label:name,
  widthM:d.widthM,heightM:d.heightM,groundOffsetM:d.groundOffsetM,weightKg:d.weightKg,behavior:d.defaultRule.behavior,previewDoodad:structuredClone(d)});
}
const variant=prop=>1+(Array.from(prop.id||'').reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0)%3);
let trees=0;
for(const prop of race.scenery){
 if(prop.doodadRef!=='tree')continue;
 const name=`leafless-tree-0${variant(prop)}`,def=definitions[name];
 const projection=editor.getRaceRouteProjectionForWorldPoint({x:prop.x,z:prop.z});
 if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
 applyDefinition(prop,name);trees++;
}
let bushes=0,rocks=0;
for(const prop of race.scenery){
 const family=prop.doodadRef==='frozenbush'?'frozen-bush':prop.doodadRef==='frozenrock'?'gray-rock':null;
 if(!family)continue;
 const name=`${family}-0${variant(prop)}`,def=definitions[name];
 const projection=editor.getRaceRouteProjectionForWorldPoint({x:prop.x,z:prop.z});
 if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
 applyDefinition(prop,name);if(family==='frozen-bush')bushes++;else rocks++;
}
// Short standalone props, safely outside the complete road corridor. These are
// scenery landmarks, not load-bearing retaining-wall geometry or road barriers.
const landmarks=[['laurel-park-sign',.035,18],['laurel-forest-cabin',.16,-32],['laurel-forest-cabin',.57,35],['laurel-park-sign',.94,-18],
 ...[.22,.225,.23,.66,.665,.67].map(f=>['laurel-stone-retaining-wall',f,18])];
const length=editor.getRaceRouteLength();let added=0;
for(const [i,[name,fraction,lateral]] of landmarks.entries()){
 const id=`campaign-art-laurel-${i}`;if(race.scenery.some(p=>p.id===id))continue;
 const pose=editor.getRaceWorldPoseAtDistance(length*fraction),def=definitions[name];
 const x=pose.x+Math.cos(pose.yaw)*lateral,z=pose.z-Math.sin(pose.yaw)*lateral;
 const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
 if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
 const prop={id,presetId:'doodad',x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,state:'standing'};
 applyDefinition(prop,name);race.scenery.push(prop);added++;
}
editor.applyLoadedRaceDocument(race);
race.codriver.calls=racePaceNotes(race,analyzeRaceDrivingRoute(editor));
race.source.campaignArt={batch:'laurel-highlands',road:'road-asphalt-patched',ground:['ground-frozen-forest','ground-snow-dead-grass'],note:'Source PNGs preserved; runtime art max edge 512. Generated texture seams are not certified seamless; visual road review remains necessary.'};
doc.savedAt=savedAt;write(file,encode(doc));
write(file.replace('document.json','metadata.json'),{...read(file.replace('document.json','metadata.json')),savedAt});
write(`${root}/manifest.json`,manifest);
console.log(`Laurel: ${trees} trees, ${bushes} bushes, ${rocks} rocks replaced; ${added} landmarks added, road and ${cellIndex} ground cells textured.`);

// Apply whole-road ribbons only to uniform surfaces. Mixed gravel/snow roads
// must retain visible traction cues until per-surface ribbon overrides exist.
for(const [key,art,surface] of [['ohio','road-asphalt-wet','wet-asphalt'],['route66','road-asphalt-faded66','asphalt'],['angeles','road-asphalt-worn','asphalt']]){
 if(!manifest.folders.art[art])continue;
 const entry=catalog.find(s=>s.sourceKey===key),path=`${root}/${entry.documentPath}`,data=read(path);
 if(!data.race.road.segments.every(s=>s.surface===surface))throw Error(`Do not cover mixed surfaces in ${key}`);
 data.race.roadTextures={...data.race.roadTextures,builtInLines:false,road:{...data.race.roadTextures?.road,artRef:art,repeatM:24,repeatWidthM:0,filterMode:'balanced',mipmaps:true}};
 data.savedAt=savedAt;write(path,encode(data));
 write(path.replace('document.json','metadata.json'),{...read(path.replace('document.json','metadata.json')),savedAt});
 console.log(`Road texture: ${entry.name} -> ${art}`);
}

// Additive regional landmarks; stable IDs make repeated artwork checks safe.
const regionalPlans=[
 [catalog[0],[['tower-hill-small-shed',.12,-27],['tower-hill-small-shed',.32,29],
 ['tower-hill-mailbox',.1,-14],['tower-hill-mailbox',.3,14],['tower-hill-mailbox',.43,-14],
 ...[.16,.18,.36,.38].map(f=>['tower-hill-short-stone-wall',f,18])]],
 [catalog[1],[['mount-washington-summit-building-silhouette',.97,35],['mount-washington-weather-instruments',.94,22]]],
 [catalog.find(s=>s.sourceKey==='ohio'),[['ohio-river-crossing-flood-marker',.3,18],['ohio-river-crossing-flood-marker',.7,18],
 ['ohio-river-crossing-riverside-building',.25,35],['ohio-river-crossing-riverside-building',.6,-35],
 ...[.2,.24,.28,.32,.36,.6,.64,.68,.72].map(f=>['ohio-river-crossing-riverbank-vegetation',f,24])]]
];
for(const [region,{key,parts}] of Object.entries(westernKits)){
 const names=Object.keys(parts);
 regionalPlans.push([catalog.find(s=>s.sourceKey===key),names.flatMap((n,i)=>[
  [`${region}-${n}`, .08+i*.13, i%2?-40:40],
  [`${region}-${n}`, .13+i*.13, i%2?32:-32]
 ])]);
}
for(const [key,names] of [['city',['abandoned-car-01','abandoned-car-02','streetlight','rubble-pile']],['ozark',['wooden-utility-pole','wooden-fence-broken','wooden-fence-intact']],['route66',['abandoned-car-03','wooden-utility-pole']]]){
 const plan=regionalPlans.find(([entry])=>entry.sourceKey===key);
 for(const [i,n] of names.entries())plan[1].push([`roadside-${n}`,.09+i*.19,25]);
}
for(const [key,names] of [['pikes',['alpine-rock-outcrop-01','alpine-rock-outcrop-02','snow-covered-pine-01']],['moki',['red-sandstone-boulder-01','red-sandstone-boulder-02','dry-scrub-bush-01']],['oak',['red-sandstone-boulder-03','dead-broken-tree-01','fallen-log-01']],['angeles',['mostly-bare-pine-01','mostly-bare-pine-02','dry-scrub-bush-02']],['ozark',['gray-boulder-01','gray-boulder-03','stump-01']]]){
 const plan=regionalPlans.find(([entry])=>entry.sourceKey===key);
 for(const [i,n] of names.entries())plan[1].push([n,.18+i*.21,-26]);
}
for(const [entry,placements] of regionalPlans){
 const path=`${root}/${entry.documentPath}`,data=read(path),r=data.race;
 editor.applyLoadedRaceDocument(r);const length=editor.getRaceRouteLength();let count=0;
 for(const [i,[name,f,lateral]] of placements.entries()){
  const id=`campaign-regional-${entry.id||entry.name}-${i}`;if(r.scenery.some(p=>p.id===id))continue;
  const pose=editor.getRaceWorldPoseAtDistance(length*f),def=definitions[name];
  const x=pose.x+Math.cos(pose.yaw)*lateral,z=pose.z-Math.sin(pose.yaw)*lateral;
  const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
  if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
  if(r.scenery.some(p=>Math.hypot(p.x-x,p.z-z)<(Number(p.widthM)||1)/2+def.widthM/2+2))continue;
  const prop={id,presetId:'doodad',x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,state:'standing'};
  applyDefinition(prop,name);r.scenery.push(prop);count++;
 }
 if(entry===catalog[1])r.roadTextures={...r.roadTextures,builtInLines:false,road:{...r.roadTextures?.road,artRef:'road-snow-packed',repeatM:12,repeatWidthM:0}};
 if(count){editor.applyLoadedRaceDocument(r);if(r.codriver)r.codriver.calls=racePaceNotes(r,analyzeRaceDrivingRoute(editor));}
 data.savedAt=savedAt;write(path,encode(data));write(path.replace('document.json','metadata.json'),{...read(path.replace('document.json','metadata.json')),savedAt});
 console.log(`${entry.name}: ${count} regional props added`);
}

for(const [key,art] of [['ohio','ground-dirty-snow-v2'],['city','ground-dirty-snow-v2'],['pikes','ground-clean-snow-v2']]){
 const entry=catalog.find(s=>s.sourceKey===key),path=`${root}/${entry.documentPath}`,data=read(path);
 for(const cell of Object.values(data.race.road.tileMap.cells))if(cell.tileId==='snow')cell.artRef=art;
 data.savedAt=savedAt;write(path,encode(data));write(path.replace('document.json','metadata.json'),{...read(path.replace('document.json','metadata.json')),savedAt});
 console.log(`${entry.name}: ${art} ground art`);
}

// Finish mixed-surface ribbons, native fences, decals and regional terrain.
await import('./complete_campaign_art.mjs');
