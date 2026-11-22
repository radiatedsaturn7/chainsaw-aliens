import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRoadPoint,mapRoadHit,mapRoadRoute,advanceMapCar} from '../../src/menus/MenuMapRoads.js';
const nodes=[{id:'a',raceRef:'A',x:.1,y:.2},{id:'j',kind:'junction',x:.5,y:.2},{id:'b',raceRef:'B',x:.9,y:.2},{id:'c',raceRef:'C',x:.9,y:.8}];
const links=[{from:'a',to:'j',curve:'bezier',control1:{x:.1,y:.8},control2:{x:.5,y:.8}},{from:'j',to:'b'}];
test('curved road hit testing follows the bend rather than its chord',()=>{
 const p=mapRoadPoint(links[0],nodes[0],nodes[1],.5),bounds={x:0,y:0,w:1000,h:1036};
 assert.ok(p.y>.6);assert.ok(mapRoadHit(links[0],nodes[0],nodes[1],{x:p.x*1000,y:p.y*1000},bounds));
 assert.equal(mapRoadHit(links[0],nodes[0],nodes[1],{x:300,y:200},bounds),false);
});
test('routing follows junctions both ways and cannot cross locked or disconnected nodes',()=>{
 assert.equal(mapRoadRoute(nodes,links,'a','b').length,2);
 assert.ok(mapRoadRoute(nodes,links,'b','a').every(s=>s.reverse));
 assert.equal(mapRoadRoute(nodes,links,'a','c'),null);
 assert.equal(mapRoadRoute(nodes.map(n=>({...n,locked:n.id==='j'})),links,'a','b'),null);
});
test('car drives the curve, completes travel and returns without teleporting when retargeted',()=>{
 let s=advanceMapCar(null,nodes,links,'A',0),maxY=0,previous={...s};
 for(let i=1;i<=80;i++){s=advanceMapCar(s,nodes,links,'B',i*.1);assert.ok(Math.hypot(s.x-previous.x,s.y-previous.y)<.051);maxY=Math.max(maxY,s.y);previous={...s};}
 assert.ok(maxY>.6);assert.equal(s.node,'b');assert.equal(s.moving,false);
 for(let i=81;i<=160;i++)s=advanceMapCar(s,nodes,links,i<85?'A':'B',i*.1);
 assert.equal(s.node,'b');assert.equal(s.moving,false);
});
