import fs from 'node:fs';import zlib from 'node:zlib';
import {buildCampaignRoutePreview} from '../../src/menus/CampaignRoutePreview.js';
const root='data/server-storage/files',manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`));
const menu=JSON.parse(fs.readFileSync(`${root}/menus/Game Menu/document.json`));
const campaign=new Set(menu.screens.filter(s=>s.id.startsWith('campaign-hub-')).flatMap(s=>s.elements.filter(e=>e.action?.parameter==='raceRef').map(e=>e.action.value)));
const tracks=[];
for(const [ref,path] of Object.entries(manifest.folders.races)){
 let d=JSON.parse(fs.readFileSync(`${root}/${path}`));if(d.__chainsawStorage)d=JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64')));
 const r=d.race||d,p=buildCampaignRoutePreview(ref,r),surfaces=p.surfaces;
 const snowy=(surfaces.snow||0)>=50||r.weather==='snow'||r.weather==='blizzard'||p.snowDepthIn>0;
 const loose=(surfaces.dirt||0)+(surfaces.gravel||0),circuit=r.type==='circuit';
 // Exclusive driving categories. Snowy or loose-surface circuits belong to their
 // surface category, while the independent circuit flag keeps layout information.
 const category=snowy?'Snow':loose>=50?'Dirt / gravel':circuit?'Race tracks':'Road races';
 tracks.push({ref,category,circuit,campaign:campaign.has(ref),mixed:loose>0&&loose<100,surfaces,weather:r.weather||'clear',snowDepthIn:p.snowDepthIn,distanceM:p.distanceM});
}
const count=rows=>Object.fromEntries(['Road races','Race tracks','Dirt / gravel','Snow'].map(c=>[c,rows.filter(r=>r.category===c).length]));
const report={method:'Snow includes snow/blizzard weather or snow cover. Otherwise majority dirt/gravel is offroad; paved circuits are race tracks; remainder road. Mixed tracks remain noted independently. All saved layouts count separately.',total:tracks.length,counts:count(tracks),campaignTotal:tracks.filter(r=>r.campaign).length,campaignCounts:count(tracks.filter(r=>r.campaign)),mixed:tracks.filter(r=>r.mixed).length,tracks};
fs.writeFileSync('data/campaigns/america/race-type-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,tracks:undefined},null,2));
