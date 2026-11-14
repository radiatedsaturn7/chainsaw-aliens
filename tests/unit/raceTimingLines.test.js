import test from 'node:test';
import assert from 'node:assert/strict';
import {timingLine,buildTimingLineDecals,timingLineArtRefs} from '../../src/racing/RaceTimingLines.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const pose=d=>({x:20,z:d,yaw:.3,segment:{roadWidthM:8}});
test('custom timing artwork fits the road and marks actual endpoints without changing geometry',()=>{
 const race={road:{width:7},timingLines:{start:{artRef:'Start',depthM:2,widthScale:1},finish:{artRef:'Finish',depthM:3,widthScale:.75}}};
 const before=structuredClone(race),decals=buildTimingLineDecals(race,1000,pose);
 assert.deepEqual(race,before);assert.deepEqual(decals.map(d=>[d.z,d.widthM,d.heightM]),[[0,8,2],[1000,6,3]]);
 assert.deepEqual(timingLineArtRefs(race),['Start','Finish']);
 assert.equal(buildTimingLineDecals(race,1000,pose,true).length,1);
});
test('default and hidden lines do not create custom decals',()=>{
 assert.deepEqual(buildTimingLineDecals({timingLines:{finish:{artRef:'__none'}}},100,pose),[]);
 assert.deepEqual(timingLineArtRefs({timingLines:{finish:{artRef:'__none'}}}),[]);
 assert.equal(timingLine({},'start').artRef,'');
});
test('timing artwork dialog supports cancel, history and saved values',async()=>{
 const e=Object.create(RaceEditor.prototype),race={};Object.defineProperty(e,'selectedRace',{value:race});e.getSelectedRaceRuntimeType=()=> 'destination';
 let history=0;e.captureRaceHistory=()=>history++;e.clearRaceRuntimeSurfaceCaches=()=>{};
 await e.openRaceTimingLines(async()=>null);assert.deepEqual(race,{});
 await e.openRaceTimingLines(async(_title,fields)=>{assert.equal(fields.length,6);return {start:'custom',startDepth:3,startWidth:80,finish:'__none'};});
 assert.equal(history,1);assert.equal(race.timingLines.start.artRef,'custom');assert.equal(race.timingLines.start.widthScale,.8);
 assert.equal(race.timingLines.finish.artRef,'__none');
});
