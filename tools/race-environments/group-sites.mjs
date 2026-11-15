// Exact source layouts only: never infer a physical site from a chapter/state key.
import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p));const ledger=read('data/race-environments/ledger.json');const sources=read('tools/campaigns/raceway_sources.json');const catalog=read('data/campaigns/america/raceways/catalog.json');const evidence=[];
for(const site of sources){
 const rows=[];
 for(const layout of site.layouts){
  const id=layout.existingSideId||`raceway-${site.key}-${layout.key}`;
  const row=ledger.rows.find(r=>r.catalog.some(c=>c.id===id));if(!row)continue;
  if(!layout.existingSideId)assert.ok(catalog.some(c=>c.id===id&&c.raceRef===row.raceRef&&c.venueKey===site.key),'Source/catalog identity mismatch');
  row.physicalSiteGroup=`facility-${site.key}`;
  row.physicalSiteLabel=site.name;
  row.siteEvidenceStatus='exact-authored-layout-and-source-coordinate';
  row.physicalSiteEvidence={source:'tools/campaigns/raceway_sources.json',sourceKey:site.key,layoutKey:layout.key,catalogId:id,latitude:site.lat,longitude:site.lon,reference:site.reference};
  // Separate exposure variants, even when the real facility is identical.
  const signature=JSON.stringify(row.authoredEnvironment);
  row.siteGroup=`facility-${site.key}-${createHash('sha256').update(signature).digest('hex').slice(0,10)}`;
  row.sharingEvidence=[`Exact ${site.key}/${layout.key} source layout at ${site.lat},${site.lon}; ${id}; same facility composition only with identical saved authoredEnvironment.`];rows.push(row);
 }
 if(rows.length)evidence.push({site:site.key,coordinates:[site.lat,site.lon],races:rows.map(r=>r.raceRef),environmentVariants:new Set(rows.map(r=>r.siteGroup)).size});
}
// Gateway's four explicitly named facility routes share a source coordinate;
// do not extend this to other St Louis chapter races at nearby coordinates.
const side=read('tools/campaigns/side_race_sources.json'),gateway=[];
for(const id of ['H06-S01','H06-S02','H06-S03','H06-S08']){
 assert.deepEqual(side[id].slice(0,2),[38.65,-90.135]);
 const row=ledger.rows.find(r=>r.catalog.some(c=>c.id===id));assert.ok(row);
 row.physicalSiteGroup='facility-gateway';row.physicalSiteLabel='World Wide Technology Raceway / Gateway complex';
 row.physicalSiteEvidence={source:'tools/campaigns/side_race_sources.json',catalogId:id,latitude:38.65,longitude:-90.135,scope:'Explicit WWT road, oval, drag and Kartplex routes only'};
 row.siteEvidenceStatus='exact-authored-facility-route-and-source-coordinate';
 row.siteGroup='facility-gateway-'+createHash('sha256').update(JSON.stringify(row.authoredEnvironment)).digest('hex').slice(0,10);
 row.sharingEvidence=[`Explicit WWT/Gateway facility route ${id} at 38.65,-90.135; authored environment variants kept separate.`];gateway.push(row);
}
evidence.push({site:'gateway',coordinates:[38.65,-90.135],races:gateway.map(r=>r.raceRef),environmentVariants:new Set(gateway.map(r=>r.siteGroup)).size});
const report={method:'Exact raceway source layout + installed catalog identity or explicit existingSideId. Full authored environment splits variants. Other races retain independent groups; no proximity/state inference.',sites:evidence};
if(process.argv.includes('--apply'))fs.writeFileSync('data/race-environments/ledger.json',JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
