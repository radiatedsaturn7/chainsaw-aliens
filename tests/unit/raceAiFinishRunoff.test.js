import test from 'node:test';
import assert from 'node:assert/strict';
import {raceAiFinishStopDistance,raceAiOpenRoadDistance} from '../../src/racing/RaceAiFinishRunoff.js';
test('runoff ends before authored road ends and never invents finite road',()=>{
 assert.equal(raceAiFinishStopDistance({autoExtend:false,continuations:{finish:[{offset:137}]}},1000),1129);
 assert.equal(raceAiFinishStopDistance({autoExtend:false},1000),1000);
 assert.equal(raceAiFinishStopDistance({},1000),1212);
});
test('physical runoff progress remains beyond timing line for authored and legacy roads',()=>{
 const e={selectedRace:{road:{autoExtend:false}},getRaceWorldPoseAtDistance:()=>({x:0,z:1000,yaw:0})};
 assert.equal(raceAiOpenRoadDistance(e,{distance:1050},{},1000),1050);
 e.selectedRace.road.autoExtend=true;
 assert.equal(raceAiOpenRoadDistance(e,{distance:1000},{worldX:2,worldZ:1050},1000),1050);
});
