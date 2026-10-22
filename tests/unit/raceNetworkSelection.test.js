import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceRouteNetwork} from '../../src/racing/RaceRouteNetwork.js';
import {transformNetworkSelection,networkSelectionInBox} from '../../src/racing/RaceNetworkSelection.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {handleNetworkAction,networkPointer,selectedNodeIds,selectedEdgeIds,drawNetworkEditor} from '../../src/ui/RaceNetworkEditor.js';

function network(){return normalizeRaceRouteNetwork({nodes:[{id:'a',x:0,z:0},{id:'b',x:100,z:0},{id:'c',x:200,z:0},{id:'d',x:300,z:0}],edges:[{id:'ab',from:'a',to:'b',points:[{x:50,z:20}],widthM:10},{id:'bc',from:'b',to:'c',points:[{x:150,z:0}],widthM:10},{id:'cd',from:'c',to:'d',widthM:10}],startNodeId:'a'});}
function fixture(){const e=new RaceEditor({});e.selectedRace.road.network=network();e.networkNodeId='';e.networkEdgeId='';e.networkSelectedNodeIds=[];e.networkSelectedEdgeIds=[];e.raceMapBounds={x:0,y:0,w:900,h:500};e.activeViewportMode='portrait';return e;}
const point=(e,x,z)=>{const p=e.raceMapWorldToScreenPoint({x,y:z});return {x:p.screenX,y:p.screenY,id:1};};
function tap(e,p){networkPointer(e,p,'down');networkPointer(e,p,'up');}
test('mixed selection transforms shared vertices once, curves as a whole, and keeps boundary roads connected',()=>{
 const source=network(),before=structuredClone(source);
 const next=transformNetworkSelection(source,['b'],['ab'],{dx:10,dz:5});
 assert.deepEqual(source,before);
 assert.equal(next.nodes.find(n=>n.id==='b').x,110);
 assert.deepEqual(next.edges[0].points,[{x:60,z:25,heightM:0}]);
 assert.deepEqual(next.edges[1].points,[{x:155,z:2.5,heightM:0}]);
 assert.deepEqual(next.nodes[2],source.nodes[2]);assert.deepEqual(next.edges[2],source.edges[2]);
});
test('scale and rotation pivot around group bounds, keep heights, and apply width/surface only to affected roads',()=>{
 const source=network();source.nodes[0].heightM=5;
 const next=transformNetworkSelection(source,[],['ab'],{scale:2,rotation:90,widthScale:1.5,surface:'dirt'});
 const a=next.nodes[0],b=next.nodes[1];assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-200)<1e-8);
 assert.equal(a.heightM,5);assert.ok(b.z>a.z);assert.equal(next.edges[0].widthM,15);assert.equal(next.edges[0].surface,'dirt');
 assert.equal(next.edges[1].widthM,10);assert.equal(next.edges[1].surface,'asphalt');
 assert.equal(transformNetworkSelection(source,['b'],[],{widthScale:100}).edges[1].widthM,40);
 assert.throws(()=>transformNetworkSelection(source,['b'],[],{scale:0}),/positive/);
});
test('touch selection supports more than two nodes and mixed edges; Done preserves selection',async()=>{
 const e=fixture();await handleNetworkAction(e,'network-multi');
 for(const x of [0,100,200])tap(e,point(e,x,0));
 assert.deepEqual(selectedNodeIds(e),['a','b','c']);
 tap(e,point(e,250,0));assert.deepEqual(selectedEdgeIds(e),['cd']);
 tap(e,point(e,100,0));assert.deepEqual(selectedNodeIds(e),['a','c']);
 await handleNetworkAction(e,'network-multi');assert.deepEqual(selectedEdgeIds(e),['cd']);assert.deepEqual(selectedNodeIds(e),['a','c']);
 await handleNetworkAction(e,'network-clear');assert.deepEqual(selectedNodeIds(e),[]);assert.deepEqual(selectedEdgeIds(e),[]);
});
test('batch editing is one undo step, restores mixed selections, persists and rejects stale/cancelled forms',async()=>{
 const e=fixture();e.networkSelectedNodeIds=['b'];e.networkSelectedEdgeIds=['ab'];const initial=e.raceHistory.length;
 await handleNetworkAction(e,'network-properties',async()=>({dx:10,dz:5,scale:1,rotation:0,widthScale:2,surface:'dirt'}));
 assert.equal(e.raceHistory.length,initial+1);const result=structuredClone(e.selectedRace.road.network);
 assert.equal(result.edges[0].widthM,20);
 e.undoRaceHistory();assert.equal(e.selectedRace.road.network.nodes[1].x,100);assert.deepEqual(selectedEdgeIds(e),['ab']);
 e.redoRaceHistory();assert.deepEqual(e.selectedRace.road.network,result);
 assert.deepEqual(e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument()).road.network,result);
 await handleNetworkAction(e,'network-transform',async()=>null);assert.deepEqual(e.selectedRace.road.network,result);
 await handleNetworkAction(e,'network-transform',async()=>{e.createNewRaceProject();return {dx:50};});assert.notDeepEqual(e.selectedRace.road.network,result);
});
test('group dragging preserves spacing and records only one undo step',()=>{
 const e=fixture();e.networkSelectedEdgeIds=['ab','bc'];e.networkEdgeId='bc';
 const start=point(e,150,0),before=structuredClone(e.selectedRace.road.network),count=e.raceHistory.length;
 const scale=e.getRaceMapTransform(e.raceMapBounds).scale;
 networkPointer(e,start,'down');networkPointer(e,{...start,x:start.x+30},'move');networkPointer(e,{...start,x:start.x+60},'move');networkPointer(e,start,'up');
 assert.equal(e.raceHistory.length,count+1);
 for(const id of ['a','b','c'])assert.ok(Math.abs(e.selectedRace.road.network.nodes.find(n=>n.id===id).x-before.nodes.find(n=>n.id===id).x-60/scale)<1e-8);
 assert.equal(e.selectedRace.road.network.nodes[3].x,300);
 e.undoRaceHistory();assert.deepEqual(e.selectedRace.road.network,before);
});
test('all/clear and protected group deletion; all selected roads are highlighted',async()=>{
 const e=fixture();await handleNetworkAction(e,'network-all');assert.equal(selectedNodeIds(e).length,4);assert.equal(selectedEdgeIds(e).length,3);
 await assert.rejects(handleNetworkAction(e,'network-delete'),/start \/ finish/);
 const strokes=[],ctx=new Proxy({stroke(){strokes.push(this.strokeStyle)},measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawNetworkEditor(e,ctx,e.raceMapBounds);assert.equal(strokes.filter(c=>c==='#f2d45c').length,3);
 await handleNetworkAction(e,'network-clear');e.networkSelectedEdgeIds=['ab','bc'];await handleNetworkAction(e,'network-delete');
 assert.deepEqual(e.selectedRace.road.network.edges.map(e=>e.id),['cd']);e.undoRaceHistory();assert.equal(e.selectedRace.road.network.edges.length,3);
});

test('box selection includes crossing segments and bends, supports reverse dragging and excludes nearby misses',()=>{
 const net=network();
 const hit=networkSelectionInBox(net,{x:160,z:5},{x:140,z:-5});
 assert.deepEqual(hit.nodes,[]);assert.deepEqual(hit.edges,['bc']);
 assert.deepEqual(networkSelectionInBox(net,{x:45,z:15},{x:55,z:25}).edges,['ab']);
 assert.deepEqual(networkSelectionInBox(net,{x:45,z:30},{x:55,z:35}),{nodes:[],edges:[]});
});
test('Multi drag adds a live rectangle selection without moving geometry or adding history; shrinking removes provisional hits',async()=>{
 const e=fixture();await handleNetworkAction(e,'network-multi');
 e.networkSelectedNodeIds=['d'];e.networkNodeId='d';
 const before=structuredClone(e.selectedRace.road.network),history=e.raceHistory.length;
 const start=point(e,210,25),large=point(e,-10,-10),small=point(e,140,-10);
 networkPointer(e,start,'down');networkPointer(e,large,'move');
 assert.deepEqual(new Set(selectedNodeIds(e)),new Set(['a','b','c','d']));
 const boxes=[],ctx=new Proxy({strokeRect(...args){if(this.strokeStyle==='#f2d45c')boxes.push(args);},measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawNetworkEditor(e,ctx,e.raceMapBounds);assert.equal(boxes.length,1);
 networkPointer(e,small,'move');assert.deepEqual(new Set(selectedNodeIds(e)),new Set(['c','d']));
 assert.equal(networkPointer(e,{...large,id:2},'move'),false);
 networkPointer(e,small,'up');assert.equal(e.networkDrag,null);
 assert.deepEqual(e.selectedRace.road.network,before);assert.equal(e.raceHistory.length,history);
 assert.ok(selectedEdgeIds(e).includes('bc'));
});
test('a box can start on a selected node, while a stationary tap still toggles it',async()=>{
 const e=fixture();await handleNetworkAction(e,'network-multi');
 e.networkSelectedNodeIds=['b'];e.networkNodeId='b';const start=point(e,100,0),end=point(e,210,20);
 networkPointer(e,start,'down');assert.deepEqual(selectedNodeIds(e),['b']);
 networkPointer(e,end,'move');networkPointer(e,end,'up');
 assert.ok(selectedNodeIds(e).includes('b'));assert.ok(selectedNodeIds(e).includes('c'));
 tap(e,start);assert.ok(!selectedNodeIds(e).includes('b'));
});
