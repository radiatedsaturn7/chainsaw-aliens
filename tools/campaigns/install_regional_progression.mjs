import {attachCampaignRoutePreviews} from './route_previews.mjs';
// Keep race assets/geometry intact while promoting Providence and rebuilding
// the existing campaign menus/map with regional event batches.
import fs from 'node:fs';import zlib from 'node:zlib';
import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
import {createAmericaWorldMap} from '../../src/menus/AmericaWorldMap.js';
import {PROVIDENCE_BOSS} from '../../src/menus/CampaignProgression.js';
import {configureCampaignRegionMap} from '../../src/menus/CampaignRegionDialogue.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const root='data/server-storage/files/',base='data/campaigns/america/';
const catalog=read(base+'catalog.json'),sides=read(base+'side-races/catalog.json'),extra=read(base+'raceways/catalog.json');
const city=extra.find(e=>e.raceRef===PROVIDENCE_BOSS);if(!city)throw Error('Providence race missing');
const old=catalog[0];catalog[0]={...old,id:'city-ri',name:PROVIDENCE_BOSS,label:'Providence, Rhode Island',documentPath:city.documentPath,
 location:{lat:41.824,lon:-71.4128,place:'Providence, Rhode Island'},lengthM:city.lengthM,estimatedDrivingSeconds:city.estimatedDrivingSeconds,
 durationMethod:city.durationMethod||'Mapped city route; actual pace depends on car and conditions.'};
if(!sides.some(e=>e.raceRef==='Tower Hill Road'))sides.unshift({id:'detour-tower-hill',status:'installed',raceRef:'Tower Hill Road',name:'Tower Hill Road',displayName:'Tower Hill Road',hubStage:1,hubRaceRef:PROVIDENCE_BOSS,
 campaignCategory:'detours',installedSurfaces:['snow'],documentPath:'races/Tower Hill Road/document.json',lengthM:3920.470716387638,estimatedDrivingSeconds:210,event_type:'Snow detour'});
for(const e of [...sides,...extra])if(e.hubStage===1)e.hubRaceRef=PROVIDENCE_BOSS;
for(const [ref,path,boss] of [[PROVIDENCE_BOSS,city.documentPath,true],['Tower Hill Road','races/Tower Hill Road/document.json',false]]){
 const doc=read(root+path),r=doc.race;r.campaign={...r.campaign,hubStage:1,hubBoss:PROVIDENCE_BOSS,optional:!boss};
 if(boss){delete r.campaign.sideEventId;r.campaign.stage=1;}else{r.campaign.sideEventId='detour-tower-hill';delete r.campaign.stage;}
 doc.savedAt=Date.now();write(root+path,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')});
 const meta=(root+path).replace(/document.json$/,'metadata.json');write(meta,{...read(meta),savedAt:doc.savedAt});
}
const menuPath=root+'menus/Game Menu/document.json',menu=read(menuPath),research=read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json');
const events=[...sides,...extra],{screens,hubs,sideGates,progression}=createCampaignHubMenus(catalog,research,events);
menu.screens=menu.screens.filter(s=>!s.id.startsWith('campaign-hub-')).concat(screens);
Object.assign(menu.parameters,{campaignOpeningRace:'Tower Hill Road',campaignHubs:hubs,campaignSideGates:sideGates,campaignProgression:progression,
 campaignEventHubs:Object.fromEntries(events.filter(e=>e.status==='installed'&&e.raceRef!==PROVIDENCE_BOSS).map(e=>[e.raceRef,e.hubRaceRef]))});
if(menu.parameters.raceRef==='Tower Hill Road')menu.parameters.raceRef=PROVIDENCE_BOSS;
const map=createAmericaWorldMap(catalog);for(const screen of menu.screens)for(const e of screen.elements)if(e.type==='world-map')Object.assign(e,map);
configureCampaignRegionMap(menu);attachCampaignRoutePreviews(menu);write(menuPath,menu);write(menuPath.replace(/document.json$/,'metadata.json'),{...read(menuPath.replace(/document.json$/,'metadata.json')),savedAt:Date.now()});
write(base+'catalog.json',catalog);write(base+'side-races/catalog.json',sides);write(base+'raceways/catalog.json',extra);
console.log(progression.regions.map(r=>({boss:r.bossRef,events:r.events.length,first:r.events.slice(0,4),required:r.bossClears})));
