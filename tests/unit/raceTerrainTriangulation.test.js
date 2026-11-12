import test from 'node:test';import assert from 'node:assert/strict';
import {triangulateSplitTerrainTriangle} from '../../src/racing/RaceTerrainTriangulation.js';
import {captureRaceHandling} from '../../src/racing/RaceHandlingCapture.js';
test('narrow road seams retain their complete boundary and terrain footprint',()=>{
 const a={x:0,z:0,elevation:0,exactRoadSeam:true},b={x:50,z:0,elevation:1,exactRoadSeam:true},c={x:25,z:.01,elevation:.6,trackSeam:true};
 const boundary=[a,{x:10,z:0,elevation:.04,exactRoadSeam:true},{x:30,z:0,elevation:.36,exactRoadSeam:true},b,c];
 const triangles=triangulateSplitTerrainTriangle(boundary,[a,b,c]);
 assert.equal(triangles.length,boundary.length);
 let area=0;
 for(let i=0;i<boundary.length;i++){
  const [center,p,q]=triangles[i];
  assert.equal(p,boundary[i],'retain boundary vertex and elevation');
  assert.equal(q,boundary[(i+1)%boundary.length],'retain shared boundary edge');
  area+=Math.abs((p.x-center.x)*(q.z-center.z)-(p.z-center.z)*(q.x-center.x))/2;
 }
 assert.ok(Math.abs(area-.25)<1e-10,'no terrain footprint is discarded');
 assert.deepEqual(triangulateSplitTerrainTriangle([a,b,c]),[[a,b,c]]);
});
test('handling capture detaches exact pose and collision recovery diagnostics',()=>{
 const latest={reason:'test',normal:{x:1,y:0,z:0}},state={orientation:{x:0,y:0,z:0,w:1},velocity:{x:1,y:2,z:3},yawRad:.4,contactStabilization:{localCcdRollbackCount:5,latest}};
 const editor={playtestSession:{vehicleDynamicsRunner:{state,collisionEscapeState:{escapeCount:2,latest}}},raceInput:{}};
 const result=captureRaceHandling(editor);latest.normal.x=99;state.velocity.x=99;
 assert.equal(result.state.velocity.x,1);assert.equal(result.state.orientation.w,1);assert.equal(result.state.yawRad,.4);
 assert.equal(result.state.contactStabilization.latest.normal.x,1);assert.equal(result.state.collisionEscape.latest.normal.x,1);
});
