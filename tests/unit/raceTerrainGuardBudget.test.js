import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRaceTerrainFromCorridor} from '../../src/racing/RaceTerrainFromCorridor.js';
const section=z=>({center:{x:0,z,elevation:0,distance:z,yaw:0},left:{x:-6,z,elevation:0},right:{x:6,z,elevation:0},metrics:{roadEnd:6,marginEnd:6,shoulderEnd:6,transitionEnd:20}});
test('mountain guard terrain retains road seams and full extent with bounded distant bands',()=>{
 const bake=buildRaceTerrainFromCorridor({surfaceBake:{sections:[section(0),section(10)]},guardDistanceM:12000});
 assert.ok(bake.terrainCells.length<60);
 assert.equal(bake.stats.roadsideBoundaryMismatchCount,0);
 assert.ok(bake.leftRows[0].rails.at(-1).lateralAbs>=12000);
 assert.equal(bake.leftRows[0].rails[0].point.x,-6);
});
