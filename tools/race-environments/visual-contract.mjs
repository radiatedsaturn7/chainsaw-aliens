import assert from 'node:assert/strict';
// Only these exact art-reference paths may vary. Never delete arbitrary keys named artRef.
export function nonvisualRace(race){
 const r=structuredClone(race);delete r.skyboxArtRef;
 if(r.skyboxSettings){delete r.skyboxSettings.artRef;if(!Object.keys(r.skyboxSettings).length)delete r.skyboxSettings;}
 delete r.groundPlaneArtRef;
 for(const c of Object.values(r.road?.tileMap?.cells||{})){delete c.artRef;delete c.roughArtRef;}
 for(const t of Object.values(r.road?.groundTiles||{})){if(t&&typeof t==='object'){delete t.artRef;delete t.roughArtRef;}}
 for(const t of [r.roadTextures?.road,r.roadTextures?.shoulder,...Object.values(r.roadTextures?.surfaceRoads||{}),...Object.values(r.roadTextures?.surfaceShoulders||{})])if(t){delete t.artRef;delete t.roughArtRef;}
 if(r.margin)delete r.margin.artRef;
 return r;
}
export function assertVisualOnly(before,after){assert.deepEqual(nonvisualRace(after),nonvisualRace(before),'Nonvisual race data changed');}
export function assertLedger(ledger,names){assert.equal(ledger.rows.length,names.length);assert.deepEqual(ledger.rows.map(r=>r.raceRef).sort(),[...names].sort());assert.equal(new Set(ledger.rows.map(r=>r.raceRef)).size,names.length);const groups=Map.groupBy(ledger.rows,r=>r.siteGroup);for(const rows of groups.values())if(rows.length>1)for(const r of rows)assert.ok(r.sharingEvidence?.length,'Shared site requires explicit evidence');}
