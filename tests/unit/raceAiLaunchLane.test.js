import test from 'node:test';
import assert from 'node:assert/strict';
import {raceAiLaunchLaneOffset} from '../../src/racing/RaceAiLaunchLane.js';

test('grid lanes stay separate, merge progressively and do not persist into later laps',()=>{
 const session={},pose={x:0,z:0,yaw:0};
 const a={worldX:2,worldZ:0,speedMps:0,awaitingStartLine:true,lap:1};
 assert.equal(raceAiLaunchLaneOffset(a,session,pose,999,0),-2);
 a.worldX=1;a.speedMps=6;
 assert.equal(raceAiLaunchLaneOffset(a,session,pose,999,0),-2,'remember grid, not current drift');
 a.awaitingStartLine=false;
 assert.equal(raceAiLaunchLaneOffset(a,session,pose,30,0),-1);
 assert.equal(raceAiLaunchLaneOffset(a,session,pose,60,1),1);
 a.lap=2;
 assert.equal(raceAiLaunchLaneOffset(a,session,pose,0,1),1);
});
test('joining midrace does not invent a grid lane; a new session clears remembered lane',()=>{
 const pose={x:0,z:0,yaw:0},a={worldX:2,worldZ:0,speedMps:20};
 assert.equal(raceAiLaunchLaneOffset(a,{},pose,0,1),1);
 a.speedMps=0;a.awaitingStartLine=true;
 assert.equal(raceAiLaunchLaneOffset(a,{},pose,0,1),-2);
 a.worldX=-2;
 assert.equal(raceAiLaunchLaneOffset(a,{},pose,0,1),2);
});
