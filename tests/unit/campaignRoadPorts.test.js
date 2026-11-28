import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeWorldMapConnections} from '../../src/menus/MenuWorldMap.js';
import {campaignRoadDirectionalNode,mapRoadPoint,drawMapRoad,mapRoadHit} from '../../src/menus/MenuMapRoads.js';

const a={id:'a',raceRef:'A',x:.40,y:.40},b={id:'b',raceRef:'B',x:.67,y:.52},c={id:'c',raceRef:'C',x:.71,y:.55};
test('authored ports survive menu normalizer and invalid partial metadata is dropped',()=>{
 const [both,bad]=normalizeWorldMapConnections([
  {from:'a',to:'b',curve:'bezier',fromPort:'right',toPort:'up',portBend:.72},
  {from:'b',to:'c',curve:'bezier',fromPort:'up',toPort:'ne'}
 ]);
 assert.deepEqual([both.fromPort,both.toPort,both.portBend],['right','up',.72]);
 assert.equal(bad.fromPort,undefined);
});
test('roads leave and enter along authored straight compass legs, and hit testing follows the curve',()=>{
 const road={from:'a',to:'b',curve:'bezier',fromPort:'right',toPort:'up'};
 for(const t of [.01,.06,.12]){
  const p=mapRoadPoint(road,a,b,t);assert.equal(p.y,a.y);assert.ok(p.x>a.x);
  const q=mapRoadPoint(road,a,b,1-t);assert.equal(q.x,b.x);assert.ok(q.y<b.y);
 }
 const commands=[],calls={beginPath(){},moveTo:(...x)=>commands.push(['move',...x]),lineTo:(...x)=>commands.push(['line',...x]),bezierCurveTo:(...x)=>commands.push(['bezier',...x])};
 const bounds={x:0,y:0,w:1000,h:1036};
 drawMapRoad(calls,road,a,b,bounds);
 assert.deepEqual(commands.map(c=>c[0]),['move','line','bezier','line']);
 assert.equal(commands[1][2],400);assert.equal(commands[3][1],670);
 const midpoint=mapRoadPoint(road,a,b,.5);
 assert.ok(mapRoadHit(road,a,b,{x:midpoint.x*1000,y:midpoint.y*1000},bounds,2));
});
test('near-equal endpoint directions use distinct ports, never substitute a locked route',()=>{
 const nodes=[a,b,c],links=[{from:'a',to:'b',fromPort:'right',toPort:'left'},{from:'a',to:'c',fromPort:'down',toPort:'up'}];
 assert.equal(campaignRoadDirectionalNode(nodes,links,a,'right',n=>n).id,'b');
 assert.equal(campaignRoadDirectionalNode(nodes,links,a,'down',n=>n).id,'c');
 assert.equal(campaignRoadDirectionalNode(nodes,links,c,'up',n=>n).id,'a');
 assert.equal(campaignRoadDirectionalNode([a,{...b,locked:true},c],links,a,'right',n=>n).id,'a');
 assert.equal(campaignRoadDirectionalNode(nodes,links,a,'left',n=>n).id,'a');
});
