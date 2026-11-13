import fs from 'node:fs';
import zlib from 'node:zlib';
import {prepareAmericaRace} from './prepare_america.mjs';
const catalog = JSON.parse(fs.readFileSync('data/campaigns/america/catalog.json'));
const savedAt = Date.now();
for (const stage of catalog.filter(s=>!s.preserveExisting)) {
  const path = `data/server-storage/files/races/${stage.name}/document.json`;
  const stored = JSON.parse(fs.readFileSync(path));
  const doc = stored.__chainsawStorage ? JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))) : stored;
  prepareAmericaRace(doc.race, stage);
  doc.savedAt = savedAt;
  const compact = {__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',
    data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9,mtime:0}).toString('base64')};
  fs.writeFileSync(path, JSON.stringify(compact,null,2)+'\n');
  const metadataPath = `data/server-storage/files/races/${stage.name}/metadata.json`;
  const metadata = JSON.parse(fs.readFileSync(metadataPath));
  fs.writeFileSync(metadataPath, JSON.stringify({...metadata,savedAt},null,2)+'\n');
  console.log(`${stage.name}: ${doc.race.codriver.calls.length} pace notes`);
}
