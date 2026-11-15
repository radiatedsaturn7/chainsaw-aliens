import assert from 'node:assert/strict';
// Only these exact art-reference paths may vary. Never delete arbitrary keys named artRef.
export function nonvisualRace(race){
 const r=structuredClone(race);delete r.skyboxArtRef;
 if(r.skyboxSettings){delete r.skyboxSettings.artRef;if(!Object.keys(r.skyboxSettings).length)delete r.skyboxSettings;}
 delete r.groundPlaneArtRef;
 for(const c of Object.values(r.road?.tileMap?.cells||{})){delete c.artRef;delete c.roughArtRef;delete c.tileArtRef;}
 for(const t of Object.values(r.road?.groundTiles||{})){if(t&&typeof t==='object'){delete t.artRef;delete t.roughArtRef;}}
 for(const t of [r.roadTextures?.road,r.roadTextures?.shoulder,...Object.values(r.roadTextures?.surfaceRoads||{}),...Object.values(r.roadTextures?.surfaceShoulders||{})])if(t){delete t.artRef;delete t.roughArtRef;}
 if(r.margin)delete r.margin.artRef;
 return r;
}
export function assertVisualOnly(before,after){
 const comparable=structuredClone(after),strip=t=>{const x={...(t||{})};delete x.artRef;delete x.roughArtRef;return x;};
 // New per-surface art may only repeat the existing default's exact non-art fields.
 // No repeat/filter/enable/geometry change can be hidden by adding a mapping.
 const active=new Set([...(before.road?.segments||[]),...(before.road?.network?.edges||[])].map(s=>s.surface));
 for(const [surface,entry] of Object.entries(after.roadTextures?.surfaceRoads||{}))if(!Object.hasOwn(before.roadTextures?.surfaceRoads||{},surface)){
  assert.ok(active.has(surface),'New visual mapping must target an active physical surface');
  assert.ok(typeof entry.artRef==='string'&&entry.artRef.length,'New visual mapping needs actual artwork');
  assert.deepEqual(strip(entry),strip(before.roadTextures?.road),'New visual mapping changes default sampling/behavior');
  delete comparable.roadTextures.surfaceRoads[surface];
 }
 if(comparable.roadTextures?.surfaceRoads&&!Object.keys(comparable.roadTextures.surfaceRoads).length&&!before.roadTextures?.surfaceRoads)delete comparable.roadTextures.surfaceRoads;
 assert.deepEqual(nonvisualRace(comparable),nonvisualRace(before),'Nonvisual race data changed');
}
export function assertLedger(ledger,names){assert.equal(ledger.rows.length,names.length);assert.deepEqual(ledger.rows.map(r=>r.raceRef).sort(),[...names].sort());assert.equal(new Set(ledger.rows.map(r=>r.raceRef)).size,names.length);const groups=Map.groupBy(ledger.rows,r=>r.siteGroup);for(const rows of groups.values())if(rows.length>1){const signature=r=>{const e=r.authoredEnvironment||{},f=e.visualFx||{};return [e.timeOfDay,e.weather,e.brightness,e.weatherIntensity,e.weatherTemperatureC,f.preset,f.skyBrightness,f.sunX,f.sunY,f.tintColor,f.tintAmount];};for(const r of rows){assert.ok(r.sharingEvidence?.length,'Shared site requires explicit evidence');assert.deepEqual(signature(r),signature(rows[0]),'Shared site has incompatible authored environment');}}}
