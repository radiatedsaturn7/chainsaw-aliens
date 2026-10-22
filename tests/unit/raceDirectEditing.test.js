import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {networkPointer,handleNetworkAction,networkEditorActions,selectedNodeIds,drawNetworkEditor} from '../../src/ui/RaceNetworkEditor.js';
import {setNetworkNodeType} from '../../src/racing/RaceJunctionAuthoring.js';
function fixture(){const editor=new RaceEditor({});editor.activeViewportMode='portrait';editor.raceMapBounds={x:0,y:0,w:390,h:500};return editor;}
function point(e,id){const node=e.selectedRace.road.network.nodes.find(n=>n.id===id);const p=e.raceMapWorldToScreenPoint({x:node.x,y:node.z});return {x:p.screenX,y:p.screenY,id:1};}
function tap(e,p){networkPointer(e,p,'down');networkPointer(e,p,'up');}

test('tap selects without history; a drag moves once, preserves finger offset, and supports undo/redo',()=>{
 const e=fixture(),p=point(e,'end'),n=e.selectedRace.road.network.nodes[1],before={...n},scale=e.getRaceMapTransform(e.raceMapBounds).scale;
 const history=e.raceHistory.length;tap(e,p);assert.equal(e.networkNodeId,'end');assert.equal(e.raceHistory.length,history);
 const offset={...p,x:p.x+4};networkPointer(e,offset,'down');networkPointer(e,{...offset,x:offset.x+2},'move');assert.equal(e.raceHistory.length,history);
 networkPointer(e,{...offset,x:offset.x+30},'move');networkPointer(e,{...offset,x:offset.x+40},'move');networkPointer(e,offset,'up');
 assert.equal(e.raceHistory.length,history+1);assert.ok(Math.abs(e.selectedRace.road.network.nodes[1].x-before.x-40/scale)<1e-6);
 e.undoRaceHistory();assert.equal(e.selectedRace.road.network.nodes[1].x,before.x);e.redoRaceHistory();assert.ok(e.selectedRace.road.network.nodes[1].x>before.x);
});
test('empty-ground taps extend continuously at the existing road width; drags do not accidentally add',()=>{
 const e=fixture();tap(e,point(e,'end'));
 const p={x:330,y:200,id:1};tap(e,p);assert.equal(e.selectedRace.road.network.nodes.length,3);
 const first=e.networkNodeId;assert.equal(e.selectedRace.road.network.edges.at(-1).widthM,3.6);
 tap(e,{x:330,y:300,id:1});assert.equal(e.selectedRace.road.network.nodes.length,4);assert.equal(e.selectedRace.road.network.edges.at(-1).from,first);
 const count=e.selectedRace.road.network.nodes.length;
 networkPointer(e,{x:40,y:400,id:1},'down');networkPointer(e,{x:70,y:400,id:1},'move');networkPointer(e,{x:70,y:400,id:1},'up');assert.equal(e.selectedRace.road.network.nodes.length,count);
 e.undoRaceHistory();assert.equal(e.selectedRace.road.network.nodes.length,3);
});
test('touch multi-select highlights both nodes and Join reconnects their roads with undo',async()=>{
 const e=fixture();tap(e,point(e,'end'));tap(e,{x:320,y:210,id:1});const extra=e.networkNodeId;
 tap(e,point(e,'end'));await handleNetworkAction(e,'network-multi');tap(e,point(e,extra));
 assert.deepEqual(selectedNodeIds(e),['end',extra]);assert.equal(networkEditorActions(e,true)[2].label,'Edit');
 await handleNetworkAction(e,'network-join');assert.equal(e.selectedRace.road.network.nodes.length,2);assert.equal(e.networkMultiSelect,false);
 e.undoRaceHistory();assert.equal(e.selectedRace.road.network.nodes.length,3);assert.deepEqual(selectedNodeIds(e),['end',extra]);
});
test('node Type creates a real junction, preserves the original road and survives save/load',async()=>{
 const e=fixture();tap(e,point(e,'end'));
 await handleNetworkAction(e,'network-properties',async(title,fields)=>{assert.equal(fields[0].id,'kind');return {kind:'y',name:'Fork',x:0,z:100,heightM:0};});
 const net=e.selectedRace.road.network;assert.equal(net.edges.filter(a=>a.from==='end'||a.to==='end').length,3);assert.equal(net.edges.find(a=>a.id==='straight').to,'end');
 assert.equal(net.nodes.find(n=>n.id==='end').junctionKind,'y');assert.equal(net.nodes.find(n=>n.id==='end').name,'Fork');
 const saved=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());assert.deepEqual(saved.road.network,net);
 e.undoRaceHistory();assert.equal(e.selectedRace.road.network.nodes.length,2);e.redoRaceHistory();assert.equal(e.selectedRace.road.network.nodes.length,4);
 const cross=setNetworkNodeType(net,'end','cross');assert.equal(cross.edges.filter(a=>a.from==='end'||a.to==='end').length,4);
 const normal=setNetworkNodeType(cross,'end','normal');assert.equal(normal.edges.length,1);assert.equal(normal.nodes.length,2);
});
test('changing junction type preserves arms that have been extended',()=>{
 const e=fixture(),y=setNetworkNodeType(e.selectedRace.road.network,'end','y'),arm=y.edges.find(a=>a.junctionOwner==='end');
 y.nodes.push({id:'extra',x:200,z:200,heightM:0});y.edges.push({...y.edges[0],id:'extension',from:arm.to,to:'extra'});
 const normal=setNetworkNodeType(y,'end','normal');assert.ok(normal.nodes.some(n=>n.id===arm.to));assert.ok(normal.edges.some(a=>a.id==='extension'));
});
test('Connect selected nodes preserves both, does not duplicate roads, and rejects extra pointer movement',async()=>{
 const e=fixture();tap(e,point(e,'end'));networkPointer(e,{x:320,y:210,id:1},'down');
 assert.equal(networkPointer(e,{x:80,y:200,id:2},'move'),false);networkPointer(e,{x:320,y:210,id:1},'up');const extra=e.networkNodeId;
 tap(e,point(e,'start'));await handleNetworkAction(e,'network-multi');tap(e,point(e,extra));await handleNetworkAction(e,'network-connect');
 assert.equal(e.selectedRace.road.network.nodes.length,3);assert.equal(e.selectedRace.road.network.edges.length,3);
 await handleNetworkAction(e,'network-multi');tap(e,point(e,extra));await handleNetworkAction(e,'network-connect');assert.equal(e.selectedRace.road.network.edges.length,3);
});

test('editor pointer handlers route taps, drags and releases without moving the viewport',()=>{
 const e=fixture(),start=point(e,'end');
 e.handlePointerDown(start);e.handlePointerUp(start);assert.equal(e.networkNodeId,'end');
 const target={...start,x:start.x+35,y:start.y-20};
 e.handlePointerDown(start);e.handlePointerMove(target);e.handlePointerUp(target);
 const after=point(e,'end');assert.ok(Math.abs(after.x-target.x)<1e-6);assert.ok(Math.abs(after.y-target.y)<1e-6);
 const add={x:330,y:220,id:1};e.handlePointerDown(add);e.handlePointerUp(add);
 const added=point(e,e.networkNodeId);assert.ok(Math.abs(added.x-add.x)<1e-6);assert.ok(Math.abs(added.y-add.y)<1e-6);
 const beforePan=point(e,e.networkNodeId);e.panRaceMapBy(20,10);const panned=point(e,e.networkNodeId);assert.ok(Math.abs(panned.x-beforePan.x-20)<1e-6);
});

test('Shift adds a second selection and stale property dialogs do not edit another loaded race',async()=>{
 const e=fixture();tap(e,point(e,'start'));tap(e,{...point(e,'end'),shiftKey:true});assert.deepEqual(selectedNodeIds(e),['start','end']);
 const before=e.selectedRace.road.network;
 await handleNetworkAction(e,'network-properties',async()=>{e.createNewRaceProject();return {kind:'cross',x:5,z:5,heightM:0};});
 assert.notEqual(e.selectedRace.road.network,before);assert.equal(e.selectedRace.road.network.nodes.length,2);
});

test('both selected nodes receive visible highlight rings, including the Start marker',()=>{
 const e=fixture();e.networkSelectedNodeIds=['start','end'];const rings=[];
 const ctx=new Proxy({arc:(x,y,r)=>{if(r===12)rings.push({x,y});},measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawNetworkEditor(e,ctx,e.raceMapBounds);assert.equal(rings.length,2);
});
