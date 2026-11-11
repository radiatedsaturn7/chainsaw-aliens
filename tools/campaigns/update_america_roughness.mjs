import {applyMissionConditions} from './mission_conditions.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {applyAmericaRoughness} from './america_roughness.mjs';
const catalog=JSON.parse(fs.readFileSync('data/campaigns/america/catalog.json'));
for(const stage of catalog.filter(s=>!s.preserveExisting)){
 const file=`data/server-storage/files/races/${stage.name}/document.json`;
 const stored=JSON.parse(fs.readFileSync(file));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 applyAmericaRoughness(doc.race,stage);
 applyMissionConditions(doc.race);
 doc.savedAt=Date.now();
 const metadataFile=file.replace('document.json','metadata.json');
 if(fs.existsSync(metadataFile)){const metadata=JSON.parse(fs.readFileSync(metadataFile));metadata.savedAt=doc.savedAt;fs.writeFileSync(metadataFile,JSON.stringify(metadata,null,2)+'\n');}
 const output=stored.__chainsawStorage?{...stored,data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9,mtime:0}).toString('base64')}:doc;
 fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
 const artifact=`artifacts/campaign-import/america/${stage.id}.json`;
 if(fs.existsSync(artifact)){const race=JSON.parse(fs.readFileSync(artifact));applyAmericaRoughness(race,stage);fs.writeFileSync(artifact,JSON.stringify(race,null,2)+'\n');}
 const values=doc.race.road.segments.map(s=>s.bumpiness);
 console.log(`${stage.id}: ${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)}`);
}
