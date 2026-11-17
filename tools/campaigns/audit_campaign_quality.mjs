// Read-only inventory and course/reward validation. Full world bake is a
// separate, isolated-process check (validate_loading.mjs).
import fs from 'node:fs';import zlib from 'node:zlib';
import {campaignCourse} from '../../src/garage/CampaignChallenges.js';
import {raceRewardQuote} from '../../src/garage/CampaignEconomy.js';
import {campaignEventCategory} from '../../src/menus/CampaignHubMenus.js';
import {collectSceneryArtRefs} from '../../src/racing/RaceSceneryAssets.js';
import {roadsideKind} from './soft_roadside.mjs';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files/',manifest=read(root+'manifest.json'),menu=read(root+'menus/Game Menu/document.json');
const catalogs=['catalog.json','side-races/catalog.json','raceways/catalog.json'].flatMap(p=>read('data/campaigns/america/'+p));
const entries=[...new Map(catalogs.filter(e=>e.status!=='planned').map(e=>[e.raceRef||e.name,e])).entries()];
const parts=new Set(read('src/content/garage-parts.json').items.map(p=>p.id));
const definitions=new Map();const definition=ref=>{if(!definitions.has(ref)){const path=manifest.folders.doodads[ref];definitions.set(ref,path&&fs.existsSync(root+path)?read(root+path).doodad:null);}return definitions.get(ref);};
const rows=[];
for(const [name,entry] of entries){
 const errors=[],warnings=[];const path=manifest.folders.races[name];
 if(!path||!fs.existsSync(root+path)){rows.push({name,errors:['Missing saved race'],warnings});continue;}
 const race=read(root+path).race,nodes=race?.road?.nodes||[],segments=race?.road?.segments||[];
 if(nodes.length<2)errors.push('Fewer than two route nodes');
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];if(![n.x,n.y,n.elevation??0].every(Number.isFinite))errors.push(`Non-finite node ${i}`);
  if(i&&Math.hypot(n.x-nodes[i-1].x,n.y-nodes[i-1].y)<.001)errors.push(`Duplicate consecutive node ${i}`);
 }
 const surfaces=[...new Set(segments.map(s=>s.surface||race.road.surface||race.surface||'asphalt'))];
 for(const s of segments)if(s.roadWidthM!=null&&(!Number.isFinite(s.roadWidthM)||s.roadWidthM<1))errors.push('Invalid road width');
 for(const surface of surfaces){const texture=race.roadTextures?.surfaceRoads?.[surface]?.artRef||race.roadTextures?.road?.artRef;if(!texture||texture==='__none')warnings.push(`No road artwork: ${surface}`);else if(!manifest.folders.art[texture])errors.push(`Missing road art: ${texture}`);}
 for(const p of race.scenery||[]){
  const d=p.previewDoodad||race.sceneryDefinitions?.find(d=>(d.ref||d.name)===p.doodadRef)||definition(p.doodadRef);
  if(p.doodadRef&&!d)errors.push(`Missing doodad: ${p.doodadRef}`);
  if(roadsideKind(p.doodadRef)&&d&&!d.isFence&&d.defaultRule?.behavior==='solid')warnings.push(`Solid small roadside plant: ${p.doodadRef}`);
 }
 const art=[race.skyboxArtRef,race.groundPlaneArtRef,...collectSceneryArtRefs(race,definition)].filter(r=>r&&r!=='__none');
 for(const ref of new Set(art))if(!manifest.folders.art[ref]||!fs.existsSync(root+manifest.folders.art[ref]))errors.push(`Missing art: ${ref}`);
 const course=campaignCourse(race),quote=raceRewardQuote(name,race);
 if(!Number.isFinite(course.seconds)||course.seconds<=0)errors.push('Invalid target duration');
 if(!quote.part||!parts.has(quote.part))errors.push(`Unavailable reward part: ${quote.part}`);
 if(!quote.objective)errors.push('No objective');
 const category=campaignEventCategory({...entry,installedSurfaces:surfaces}),hub=entry.hubStage||entry.stage;
 const pages=menu.screens.filter(s=>s.id.startsWith(`campaign-hub-${hub}-`));
 if(entry.hubStage&&!pages.some(s=>s.elements.some(e=>e.action?.value===name)))errors.push('No region menu link');
 if(pages.some(s=>s.elements.filter(e=>e.type==='button').length>8))errors.push('Menu exceeds eight buttons');
 rows.push({id:entry.id,name,errors:[...new Set(errors)],warnings:[...new Set(warnings)],lengthM:course.lengthM,surfaces,estimatedSeconds:Math.round(course.seconds),sceneryCount:race.scenery?.length||0,firstScrap:quote.total,repeatScrap:quote.scrap,part:quote.part,featured:quote.featured});
}
const report={checkedAt:new Date().toISOString(),scope:'Every installed campaign event: saved data, finite route geometry, road textures, scenery dependencies/collision flags, menu reachability, objectives and rewards. Planning times are estimates, not simulated laps.',count:rows.length,errors:rows.filter(r=>r.errors.length).length,warnings:rows.filter(r=>r.warnings.length).length,races:rows};
const output=process.argv.find(a=>a.startsWith('--report='))?.slice(9)||'artifacts/campaign-quality/inventory.json';fs.mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({count:report.count,errors:report.errors,warnings:report.warnings}));if(report.errors)process.exitCode=1;
