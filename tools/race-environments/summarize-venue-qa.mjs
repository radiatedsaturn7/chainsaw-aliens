import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const dir=process.argv[2];assert.ok(dir,'Pass the retained native capture directory');
const pack=process.argv[3]||'venue-pack4';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json')),rows=ledger.rows.filter(r=>r.environmentPack===pack);
assert.ok(rows.length,'Unknown or empty pack');
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('-state.json'))files.push(p);}}
const baseDirectories=process.env.RACE_QA_BASE_DIRS?JSON.parse(process.env.RACE_QA_BASE_DIRS):[dir];
assert.ok(Array.isArray(baseDirectories)&&baseDirectories.length&&baseDirectories.every(d=>typeof d==='string'),'Explicit native base directories required');
baseDirectories.forEach(walk);
assert.equal(files.length,rows.length*2,'Every layout requires two retained native device reports');
let reports=files.map(file=>({file,...JSON.parse(fs.readFileSync(file))}));
const superseded=[];
// Explicit later capture directories supersede only the same race/device pair.
// Current binding assertions below still reject a missing corrective capture.
for(const override of process.argv.slice(4)){
 const start=files.length;walk(override);const batch=files.slice(start).map(file=>({file,...JSON.parse(fs.readFileSync(file))}));
 assert.ok(batch.length,'Empty corrective capture directory');const seen=new Set();
 for(const report of batch){
  assert.ok(rows.some(r=>r.raceRef===report.race),'Correction outside selected pack');
  const device=report.file.includes('handheld')?'handheld':report.file.includes('desktop')?'desktop':null;assert.ok(device,'Unknown correction device');
  const key=report.race+'|'+device;assert.ok(!seen.has(key),'Duplicate corrective race/device');seen.add(key);
  const index=reports.findIndex(r=>r.race===report.race&&r.file.includes(device));assert.ok(index>=0,'Correction lacks original case');superseded.push(reports[index].file);reports[index]=report;
 }
}

for(const row of rows){
 const own=reports.filter(r=>r.race===row.raceRef);assert.equal(own.length,2,row.raceRef);
 assert.ok(own.some(r=>r.file.includes('desktop'))&&own.some(r=>r.file.includes('handheld')),'Missing device');
 for(const r of own){assert.equal(r.ref,row.binding.skyboxArtRef);assert.equal(r.effectiveLayers.ground,row.binding.groundPlaneArtRef);if(r.effectiveLayers.tileImageById){for(const [id,counts]of Object.entries(r.effectiveLayers.tileImageById)){const expected=row.binding.terrainTileArtById?.[id];if(expected)assert.deepEqual(Object.keys(counts),[expected],`Effective ${id} tile art differs from binding`);else assert.ok(Object.keys(counts).length,'Missing effective tile image');}for(const id of Object.keys(row.binding.terrainTileArtById||{}))assert.ok(r.effectiveLayers.tileImageById[id],`Bound tile ID ${id} absent from race`);}else assert.deepEqual(Object.keys(r.effectiveLayers.tileImageCounts),[row.binding.terrainTileArtById.snow],'Effective tile art differs from visual binding');assert.ok(r.diagnostic['sky100-raw-no-fog']&&r.diagnostic['sky100-authored-weather']);}
}
console.log(JSON.stringify({pack,baseDirectories,layouts:rows.length,deviceReports:reports.length,uniqueSkies:new Set(reports.map(r=>r.ref)).size,superseded,scope:'Automated native projection and effective layer evidence only. Manual visual review and actual gameplay remain separate.',reports},null,2));
