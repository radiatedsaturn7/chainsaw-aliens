import fs from 'node:fs';
import zlib from 'node:zlib';
import {softenRaceRoadside, softenRoadsideDefinition} from './soft_roadside.mjs';
const root = 'data/server-storage/files/', apply = process.argv.includes('--apply');
const read = file => {
 const stored = JSON.parse(fs.readFileSync(file));
 return stored.__chainsawStorage ? JSON.parse(zlib.gunzipSync(Buffer.from(stored.data, 'base64'))) : stored;
};
const write = (file, doc) => {
 const stored = JSON.parse(fs.readFileSync(file));
 doc.savedAt = Date.now();
 if (stored.__chainsawStorage) stored.data = zlib.gzipSync(JSON.stringify(doc), {level: 9}).toString('base64');
 fs.writeFileSync(file, JSON.stringify(stored.__chainsawStorage ? stored : doc, null, 2) + '\n');
 const metadata = file.replace(/document.json$/, 'metadata.json');
 if (fs.existsSync(metadata)) {
  const meta = JSON.parse(fs.readFileSync(metadata));
  meta.savedAt = doc.savedAt;
  fs.writeFileSync(metadata, JSON.stringify(meta, null, 2) + '\n');
 }
};
const manifest = read(root + 'manifest.json'), defs = new Map(), changedDefinitions = [], races = [];
for (const [ref, path] of Object.entries(manifest.folders.doodads)) {
 const doc = read(root + path), def = doc.doodad;
 if (!def) continue;
 if (softenRoadsideDefinition(def, ref)) {
  changedDefinitions.push(ref);
  if (apply) write(root + path, doc);
 }
 defs.set(ref, def);
}
for (const [name, path] of Object.entries(manifest.folders.races)) {
 const doc = read(root + path);
 if (!doc.race) continue;
 const before = JSON.stringify([doc.race.scenery, doc.race.sceneryDefinitions]);
 const result = softenRaceRoadside(doc.race, ref => defs.get(ref));
 const changed = before !== JSON.stringify([doc.race.scenery, doc.race.sceneryDefinitions]);
 if (changed && apply) write(root + path, doc);
 races.push({name, changed, ...result});
}
const report = {changedDefinitions, races};
if (apply) fs.writeFileSync(process.argv.find(a => a.startsWith('--report='))?.slice(9) || 'data/campaigns/america/soft-roadside-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({apply, definitions: changedDefinitions.length, races: races.length, changedRaces: races.filter(r => r.changed).length,
 ...Object.fromEntries(['grassReplacements', 'overridesUpdated', 'embeddedDefinitionsUpdated', 'markers', 'softPlants'].map(k => [k, races.reduce((n, r) => n + r[k], 0)]))}, null, 2));
