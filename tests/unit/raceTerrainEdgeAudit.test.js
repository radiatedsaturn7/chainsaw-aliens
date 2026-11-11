import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTerrainEdges} from '../../tools/vehicle-validation/audit-terrain-edges.mjs';
const sampler=(triangles)=>({positions:Float64Array.from(triangles.flat(2)),elevationScaleM:12,regionTable:['terrain'],regions:triangles.map(()=>0)});
test('edge audit detects vertical cracks even when both triangles cover the ground from above',()=>{
 const data=sampler([[[0,0,0],[1,0,0],[0,0,1]],[[1,.1,0],[0,.1,0],[0,.1,-1]]]);
 const result=auditTerrainEdges(data);
 assert.ok(result.cracks.some(c=>Math.abs(c.error-1.2)<1e-10));
});
test('edge audit accepts joined triangles and catches tall submillimetre fins',()=>{
 const joined=sampler([[[0,0,0],[1,0,0],[0,0,1]],[[1,0,0],[0,0,0],[0,0,-1]]]);
 assert.equal(auditTerrainEdges(joined).cracks.length,0);
 const fin=sampler([[[0,0,0],[.0005,1,0],[0,0,1]]]);
 assert.equal(auditTerrainEdges(fin).steepMicroEdges.length,1);
});
