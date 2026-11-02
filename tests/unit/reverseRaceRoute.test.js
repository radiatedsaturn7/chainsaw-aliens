import test from 'node:test';import assert from 'node:assert/strict';
import {reverseRaceRoute} from '../../src/racing/reverseRaceRoute.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('reverse swaps endpoints, elevation targets, banking and segment artwork without moving scenery',()=>{
 const race={type:'destination',source:{reversed:false},scenery:[{x:25,z:5}],road:{nodes:[{x:0,y:0,elevation:1,role:'start',locked:true},{x:100,y:0,elevation:2},{x:100,y:100,elevation:3,role:'finish'}],segments:[{artRef:'a',surface:'asphalt',banking:4},{artRef:'b',surface:'dirt',banking:-6}]}};
 reverseRaceRoute(race);
 assert.equal(race.road.nodes[0].elevation,3);assert.equal(race.road.nodes[0].role,'start');assert.equal(race.road.nodes.at(-1).role,'finish');assert.equal(race.road.nodes.at(-1).locked,undefined);
 assert.deepEqual(race.road.segments.map(s=>[s.artRef,s.elevation,s.banking]),[['b',2,6],['a',1,-4]]);
 assert.deepEqual(race.scenery,[{x:25,z:5}]);assert.equal(race.source.reversed,true);
 reverseRaceRoute(race);assert.equal(race.road.nodes[0].x,0);assert.equal(race.source.reversed,false);
});
test('reverse is available under settings and supports undo',()=>{
 const e=new RaceEditor({});
 e.selectedRace.type='destination';
 delete e.selectedRace.road.network;
 e.selectedRace.road.nodes=[{x:0,y:0,elevation:0,role:'start',locked:true},{x:100,y:200,elevation:5,role:'finish'}];
 e.selectedRace.road.segments=[{length:Math.hypot(100,200),curve:0,elevation:5,banking:2}];
 const original=structuredClone(e.selectedRace.road.nodes);
 assert.ok(e.getMenuItems('settings').some(i=>i.id==='race-reverse'&&!i.disabled));
 e.handleMenuAction('race-reverse');assert.equal(e.selectedRace.road.nodes[0].x,original.at(-1).x);
 e.handleMenuAction('undo');assert.deepEqual(e.selectedRace.road.nodes,original);
});

test('reverse is disabled for junction networks',()=>{
 const e=new RaceEditor({});
 assert.ok(e.selectedRace.road.network);
 assert.ok(e.getMenuItems('settings').some(i=>i.id==='race-reverse'&&i.disabled));
});
