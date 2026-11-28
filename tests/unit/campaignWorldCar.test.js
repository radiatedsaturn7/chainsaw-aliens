import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {campaignRoadDirectionalNode,advanceMapCar,mapRoadPoint} from '../../src/menus/MenuMapRoads.js';
const doc=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const map=doc.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
test('world map keeps editable curved roads with distinct directional ports and car travel',()=>{
 assert.equal(map.mapStyle.cursor,'car');const used=new Map(map.nodes.map(n=>[n.id,new Set()]));
 const normalized=normalizeMenuDocument(doc).screens.find(s=>s.id==='world-map').elements.find(e=>e.id===map.id);
 for(const link of map.connections){
  assert.equal(link.curve,'bezier');
  const saved=normalized.connections.find(e=>e.id===link.id);assert.equal(saved.fromPort,link.fromPort);assert.equal(saved.toPort,link.toPort);
  for(const [id,port] of [[link.from,link.fromPort],[link.to,link.toPort]]){assert.ok(['up','down','left','right'].includes(port));assert.ok(!used.get(id).has(port));used.get(id).add(port);}
  const from=map.nodes.find(n=>n.id===link.from),to=map.nodes.find(n=>n.id===link.to);
  assert.equal(campaignRoadDirectionalNode(map.nodes,map.connections,from,link.fromPort,n=>n)?.id,to.id);
  let car={node:from.id,x:from.x,y:from.y,time:0};
  for(let i=0;i<=40;i++)car=advanceMapCar(car,map.nodes,map.connections,to.raceRef,i*.1);
  assert.equal(car.node,to.id);assert.equal(car.moving,false);
  const mid=mapRoadPoint(link,from,to,.5);assert.ok(Number.isFinite(mid.x)&&Number.isFinite(mid.y));
 }
});
test('world car uses connected directional navigation and cannot enter a region mid-trip',async()=>{
 const nodes=[{id:'a',raceRef:'A',x:.8,y:.5},{id:'b',raceRef:'B',x:.5,y:.3},{id:'c',raceRef:'C',x:.2,y:.5}];
 const element={id:'world',type:'world-map',binding:'raceRef',mapStyle:{cursor:'car'},nodes,connections:[{from:'a',to:'b',fromPort:'up',toPort:'right',curve:'bezier'},{from:'b',to:'c',fromPort:'left',toPort:'up',curve:'bezier'}]};
 let entered=false;const player=Object.assign(Object.create(MenuPlayer.prototype),{resources:{},widgetStates:new Map(),flow:{time:0,document:{parameters:{campaignHubs:{B:'region-b'}}},parameters:{raceRef:'A'},setParameter(k,v){this.parameters[k]=v;},goTo(){entered=true;}}});
 await player.activate(element,1,{mapDirection:'left'});assert.equal(player.flow.parameters.raceRef,'A','no shortcut to nearby region');
 await player.activate(element,1,{mapDirection:'up'});assert.equal(player.flow.parameters.raceRef,'B');
 player.widgetStates.set('map-car:world',{node:'a',moving:true});await player.activate(element,1,{choose:true});assert.equal(entered,false);
 player.widgetStates.set('map-car:world',{node:'b',moving:false});await player.activate(element,1,{choose:true});assert.equal(entered,true);
});
test('world journey uses left/right roads and keeps visible spacing, especially regions five and six',()=>{
 for(const link of map.connections){assert.equal(link.fromPort,'left');assert.equal(link.toPort,'right');}
 for(let i=1;i<map.nodes.length;i++)assert.ok(map.nodes[i-1].x-map.nodes[i].x>=.069,'each pair has horizontal room for a road');
 assert.ok(map.nodes[4].x-map.nodes[5].x>=.12);
 assert.ok(Math.abs(map.nodes[4].y-map.nodes[5].y)>=.25);
 assert.equal(map.nodes[10].y,map.nodes[8].y,'LA level with node nine');
 assert.ok(Math.abs(map.nodes[10].x-(.1797438200902281+.06)/2)<1e-12);
 assert.ok(map.nodes[9].x>.1797438200902281&&map.nodes[9].y<.8004103525072125,'ten moved northeast');
});
test('world overview paints the regional asphalt, shoulder and lane-mark layers',async()=>{
 const {drawWorldMap}=await import('../../src/menus/MenuWorldMapRenderer.js');const strokes=[];
 const ctx=new Proxy({globalAlpha:1,stroke(){strokes.push(this.strokeStyle);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawWorldMap(ctx,{x:0,y:0,w:800,h:400},map,{},doc,{raceRef:map.nodes[0].raceRef},map.nodes[0].raceRef,{campaignOverview:true,editing:true,drawText(){}});
 for(const color of ['#17202b','#b9c7bd','#3c434b','#e0c684'])assert.ok(strokes.includes(color),color);
});
test('whole world-map car fits at Providence and every other stop in portrait and landscape',async()=>{
 const {drawWorldMap}=await import('../../src/menus/MenuWorldMapRenderer.js');
 const {worldMapNodePoint}=await import('../../src/menus/MenuWorldMap.js');
 for(const bounds of [{x:20,y:60,w:318,h:200},{x:50,y:80,w:864,h:329}]){
  const unlocked={...map,nodes:map.nodes.map(n=>({...n,unlockParameter:'',locked:false}))};
  let previousX=Infinity;
  for(const node of unlocked.nodes){
   const point=worldMapNodePoint(node,bounds,unlocked);assert.ok(point.x<previousX,'original projection preserves distinct node positions');previousX=point.x;
   const ordinary=worldMapNodePoint(node,bounds,{...unlocked,mapStyle:{...unlocked.mapStyle,cursor:'ring'}});assert.deepEqual(point,ordinary,'car must not move destination positions');
   const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}});let car;
   drawWorldMap(ctx,bounds,unlocked,{}, {},{raceRef:node.raceRef},node.raceRef,{campaignOverview:true,editing:true,drawText(){},drawCar:b=>{car=b;}});
   assert.ok(car,node.raceRef);
   assert.ok(car.x>=bounds.x&&car.x+car.w<=bounds.x+bounds.w,node.raceRef+' horizontal clipping');
   assert.ok(car.y>=bounds.y-1e-9&&car.y+car.h<=bounds.y+bounds.h+1e-9,node.raceRef+' vertical clipping');
   assert.ok(Math.abs(car.x+car.w/2-point.x)<1e-9,'car stays horizontally on the road');
   assert.ok(Math.abs(car.y+car.w*.375-point.y)<1e-9,'car stays vertically on the road');
  }
 }
});
test('world car can use the screen margin without shifting the Providence road anchor',async()=>{
 const {drawWorldMap}=await import('../../src/menus/MenuWorldMapRenderer.js');
 const {worldMapNodePoint,worldMapCarSize}=await import('../../src/menus/MenuWorldMap.js');
 const viewport={x:0,y:0,w:960,h:540},bounds={x:48,y:81,w:864,h:329};
 const node=map.nodes[0],point=worldMapNodePoint(node,bounds,map);
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}});let car;
 drawWorldMap(ctx,bounds,map,{},doc,{raceRef:node.raceRef},node.raceRef,{campaignOverview:true,editing:true,carViewport:viewport,drawText(){},drawCar:b=>{car=b;}});
 assert.equal(car.w,worldMapCarSize(bounds));
 assert.ok(car.x+car.w>bounds.x+bounds.w,'sprite may extend beyond widget');
 assert.ok(car.x+car.w<=viewport.w,'whole sprite fits the game screen');
 assert.equal(car.x+car.w/2,point.x);assert.equal(car.y+car.w*.375,point.y);
});
