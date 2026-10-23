import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceRouteNetwork, projectNetworkPoint, findNetworkRoute} from '../../src/racing/RaceRouteNetwork.js';
import {createRaceNetworkQueryIndex} from '../../src/racing/RaceNetworkQueryIndex.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const makeNetwork=()=>normalizeRaceRouteNetwork({startNodeId:'0',finishNodeId:'80',
 nodes:Array.from({length:81},(_,i)=>({id:String(i),x:Math.sin(i*.2)*200,z:i*9,heightM:Math.sin(i*.13)*15})),
 edges:Array.from({length:80},(_,i)=>({id:`e${i}`,from:String(i),to:String(i+1),bidirectional:i%3===0,points:[]}))});
test('indexed nearest projection matches full scan including heights and previous-edge bias',()=>{
 const network=makeNetwork(),index=createRaceNetworkQueryIndex(network);
 for(let i=0;i<1000;i++){
  const point={x:Math.sin(i*1.7)*240,z:(i*37)%800-40,...(i%2?{heightM:Math.sin(i)*20}:{})};
  const opts={previousEdgeId:`e${i%80}`};
  assert.deepEqual(index.project(point,opts),projectNetworkPoint(network,point,opts));
 }
});
test('reverse finish costs match route search for every junction',()=>{
 const network=makeNetwork(),index=createRaceNetworkQueryIndex(network);
 for(const node of network.nodes)assert.ok(Math.abs(index.costs.get(node.id)-findNetworkRoute(network,node.id).lengthM)<1e-8);
 assert.ok(Math.abs(index.routeLength-findNetworkRoute(network).lengthM)<1e-8);
});
test('projection handles empty networks and stacked crossings',()=>{
 assert.equal(createRaceNetworkQueryIndex(normalizeRaceRouteNetwork({})).project({x:0,z:0}),null);
 const network=normalizeRaceRouteNetwork({nodes:[{id:'a',x:-10,z:0,heightM:0},{id:'b',x:10,z:0,heightM:0},{id:'c',x:0,z:-10,heightM:12},{id:'d',x:0,z:10,heightM:12}],edges:[{id:'low',from:'a',to:'b'},{id:'high',from:'c',to:'d'}]});
 const index=createRaceNetworkQueryIndex(network);
 assert.equal(index.project({x:0,z:0,heightM:12}).edgeId,'high');
 assert.equal(index.project({x:0,z:0,heightM:0}).edgeId,'low');
 assert.equal(index.project({x:0,z:0}).edgeId,'low');
});
test('editor invalidates indexed geometry after an in-place edit',()=>{
 const editor=Object.create(RaceEditor.prototype);editor.project={races:[makeNetwork()]};
 Object.defineProperty(editor,'selectedRace',{value:{road:{network:makeNetwork()}}});
 const first=editor.getRaceNetworkQueryIndex();
 editor.selectedRace.road.network.nodes[1].x+=10;
 editor.clearRaceRuntimeSurfaceCaches();
 const second=editor.getRaceNetworkQueryIndex();assert.notEqual(first,second);
 assert.equal(second.lengths.get('e0'),Math.hypot(editor.selectedRace.road.network.nodes[1].x,9,editor.selectedRace.road.network.nodes[1].heightM));
});
