import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildAdaptiveRaceTerrain} from '../../src/racing/RaceAdaptiveTerrain.js';
import {buildRaceBakedSurfaceSampler,sampleRaceBakedSurface} from '../../src/racing/RaceBakedSurfaceSampler.js';

test('Laurel imported terrain keeps nearly coincident roadside vertices connected through smoothing', () => {
 const stored=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/races/Laurel Highlands Scenic Byway/document.json',import.meta.url)));
 const document=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const editor=new RaceEditor({});editor.applyLoadedRaceDocument(document);
 const x=-444.56068,z=1950;
 const tileMap=editor.ensureRaceTileMap();
 const surfaceBake=editor.withRaceGeometryReadCache(()=>editor.getRaceSurfaceBake({step:2.5}));
 // Exercise the recorded seam using the full road constraints but only a local
 // terrain window; campaign validation separately bakes the complete map.
 const {terrainCells}=editor.withRaceGeometryReadCache(()=>buildAdaptiveRaceTerrain({
  surfaceBake,bounds:{minX:x-80,maxX:x+80,minZ:z-80,maxZ:z+80},
  sourceCellSize:tileMap.cellSizeM,
  sampleGround:p=>editor.getRaceGroundElevationAtWorldPoint(p,0),
  tileAt:p=>editor.getRaceTileMapCellAtWorldPoint(p)
 }));
 const sampler=buildRaceBakedSurfaceSampler({terrainCells,surfaceBake});
 const heights=[];
 for(const dx of [-.001,0,.001])for(const dz of [-.001,0,.001]){
  const sample=sampleRaceBakedSurface(sampler,{x:x+dx,z:z+dz});
  assert.ok(sample,'continuous coverage around the recorded crack');
  heights.push(sample.elevation*12);
 }
 assert.ok(Math.max(...heights)-Math.min(...heights)<.02,'shared boundaries have continuous heights');
});
