import fs from 'node:fs';import zlib from 'node:zlib';
import {US_STATES,normalizeRaceLocation} from '../../src/racing/RaceLocation.js';
// State boundaries: PublicaMundi/MappingAPI, data/geojson/us-states.json (US Census-derived).
// https://github.com/PublicaMundi/MappingAPI/blob/master/data/geojson/us-states.json
const states=JSON.parse(fs.readFileSync(new URL('./us-state-boundaries.geojson',import.meta.url))).features;
function ringContains(ring,x,y){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
}return inside;}
const contains=(g,x,y)=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(rings=>ringContains(rings[0],x,y)&&!rings.slice(1).some(r=>ringContains(r,x,y)));
const root='data/server-storage/files',manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`));let changed=0;const unknown=[];
for(const [ref,path] of Object.entries(manifest.folders.races)){
 const file=`${root}/${path}`,raw=JSON.parse(fs.readFileSync(file)),compressed=!!raw.__chainsawStorage;
 const doc=compressed?JSON.parse(zlib.gunzipSync(Buffer.from(raw.data,'base64'))):raw,race=doc.race||doc,location=normalizeRaceLocation(race);
 if(!location.stateCode&&(!location.country||location.country==='US')&&Number.isFinite(location.lat)&&Number.isFinite(location.lon)){
  const state=states.find(s=>contains(s.geometry,location.lon,location.lat));
  if(state){location.stateCode=Object.keys(US_STATES).find(k=>US_STATES[k]===state.properties.name)||'';location.country='US';}
 }
 if(!location.stateCode)unknown.push({ref,location});
 if(JSON.stringify(race.location)!==JSON.stringify(location)){
  race.location=location;
  if(compressed){raw.data=zlib.gzipSync(JSON.stringify(doc)).toString('base64');fs.writeFileSync(file,JSON.stringify(raw));}
  else fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n');changed++;
 }
}
console.log(JSON.stringify({changed,unknown},null,2));
