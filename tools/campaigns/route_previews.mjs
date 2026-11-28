import {motorsportRaceMetadata} from '../../src/menus/MotorsportEvents.js';
import {installMotorsportNavigation} from '../../src/menus/MotorsportMenu.js';
import fs from 'node:fs';
import {raceIndexEntries,raceIndexScreen} from '../../src/menus/RaceIndex.js';
import zlib from 'node:zlib';
import {buildCampaignRoutePreview} from '../../src/menus/CampaignRoutePreview.js';
import {normalizeRaceLocation} from '../../src/racing/RaceLocation.js';
// Shared by campaign installers; regenerate whenever saved roads are changed.
export function attachCampaignRoutePreviews(menu,root='data/server-storage/files'){
 const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`));
 const refs=Object.keys(manifest.folders.races);
 const entries=[];
 const previews={};
 for(const ref of refs){
  const path=manifest.folders.races[ref]||`races/${encodeURIComponent(ref).replace(/%20/g,' ').replace(/[!'*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}/document.json`;if(!fs.existsSync(`${root}/${path}`))continue;
  let d=JSON.parse(fs.readFileSync(`${root}/${path}`));
  if(d.__chainsawStorage)d=JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64')));
  const race=d.race||d;previews[ref]=buildCampaignRoutePreview(ref,race);
  const rally= race.source?.rallyCollection;
  entries.push({...motorsportRaceMetadata(race),ref,name:race.name||ref,location:normalizeRaceLocation(race),venue:rally?.name||race.source?.origin?.name||race.name||ref,layout:race.source?.layoutName||'',...(rally?{rally}: {})});
 }
 // Keep category navigation in generated saved menus, including after reimports.
 installMotorsportNavigation(menu);
 const indexScreen=raceIndexScreen(raceIndexEntries(entries)).screen;
 menu.screens=menu.screens.filter(s=>s.id!=='race-index').concat(indexScreen);
 menu.parameters.raceIndex=entries;menu.parameters.campaignRoutePreviews=previews;return previews;
}
