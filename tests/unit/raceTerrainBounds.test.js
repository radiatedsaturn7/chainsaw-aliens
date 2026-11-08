import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceTerrainBounds} from '../../src/racing/RaceTerrainBounds.js';
test('terrain bounds include full cell footprints and ignore malformed coordinates',()=>{
 assert.deepEqual(getRaceTerrainBounds([['-3,5',{}],['2,-4',{}],['bad',{}]],20),{minX:-60,maxX:60,minZ:-80,maxZ:120});
 assert.equal(getRaceTerrainBounds([]),null);
});
test('large terrain surveys do not depend on the JavaScript argument limit',()=>{
 function* entries(){for(let z=-200;z<200;z++)for(let x=-200;x<200;x++)yield [`${x},${z}`,null];}
 assert.deepEqual(getRaceTerrainBounds(entries(),10),{minX:-2000,maxX:2000,minZ:-2000,maxZ:2000});
});
