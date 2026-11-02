import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseRoadRoute} from '../../src/ui/RaceRouteImport.js';
const network={networkId:'net',roads:[{id:1,name:'Mountain Road',points:[{x:0,y:0},{x:1000,y:0}]}]};
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas={width:320,height:300,getContext:()=>ctx};
test('route workspace automatically places start, end, then ordered intermediate points',async()=>{
 const requests=[];
 const result=await chooseRoadRoute({placeId:'place',busy:async(label,body)=>{requests.push(body);return body.action==='network'?network:{layouts:[]};},form:async(title,fields,options)=>{
   const preview=fields.find(f=>f.type==='preview');
   preview.render(canvas,{road:'all',zoom:1});
   preview.onPointer({phase:'pointerdown',x:20,y:150});
   preview.onPointer({phase:'pointerdown',x:300,y:150});
   assert.equal(options.validate(),null,'intermediate points are optional');
   preview.onPointer({phase:'pointerdown',x:160,y:150});
   preview.onPointer({phase:'pointerdown',x:230,y:150});
   return {routing:'direct'};
 }});
 assert.deepEqual(result,{layouts:[]});
 assert.equal(requests[1].routing,'direct');assert.equal(requests[1].waypoints.length,4);
 assert.ok(requests[1].waypoints[0].x<requests[1].waypoints[1].x);
 assert.ok(requests[1].waypoints[1].x<requests[1].waypoints[2].x);
 assert.ok(requests[1].waypoints[2].x<requests[1].waypoints[3].x);
});
test('cancelling route workspace sends no routing request',async()=>{
 let calls=0;assert.equal(await chooseRoadRoute({placeId:'p',busy:async()=>{calls++;return network;},form:async()=>null}),null);assert.equal(calls,1);
});

test('imprecise taps snap to road in world units and do not recenter the zoomed map',async()=>{
 const roads={networkId:'mountain',roads:[{id:1,name:'Mountain Road',points:[{x:0,y:0},{x:10000,y:0}]}]};
 let request;
 await chooseRoadRoute({placeId:'mountain',busy:async(label,body)=>{if(body.action==='network')return roads;request=body;return {layouts:[]};},form:async(title,fields)=>{
  const preview=fields.find(f=>f.type==='preview');
  // At this scale an 8-pixel near miss is 278 metres, beyond the old 150m limit.
  preview.render(canvas,{road:'all',zoom:1});
  preview.onPointer({phase:'pointerdown',x:30,y:158});
  preview.render(canvas,{road:'all',zoom:2});
  preview.onPointer({phase:'pointerdown',x:200,y:160});
  preview.render(canvas,{road:'all',zoom:2});
  // Repeating the tap must retain the same position, rather than move the map.
  preview.onPointer({phase:'pointerdown',x:200,y:160});
  return {routing:'direct'};
 }});
 assert.equal(request.waypoints.length,3);
 assert.equal(request.waypoints[0].y,0);assert.equal(request.waypoints[1].y,0);
 assert.deepEqual(request.waypoints[1],request.waypoints[2]);
 assert.ok(Math.abs(request.waypoints[1].x-(5000+40/(288/10000*2)))<1e-8);
});

test('distant blank-space taps stay in the planner with inline validation',async()=>{
 let calls=0;
 await chooseRoadRoute({placeId:'p',busy:async()=>{calls++;return network;},form:async(title,fields,options)=>{
  const preview=fields.find(f=>f.type==='preview');preview.render(canvas,{road:'all',zoom:1});
  preview.onPointer({phase:'pointerdown',x:160,y:240});
  assert.match(options.validate(),/Place Start/);
  return null;
 }});
 assert.equal(calls,1);
});
