import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN_LANDMARKS} from '../../src/menus/CampaignMapLandmarkLayout.js';
import {mapLandmarkPlacements,regionalLandmarkPlacements,drawMapLandmarkLayer} from '../../src/menus/CampaignMapLandmarks.js';
import {worldMapNodePoint,normalizeWorldMapStyle} from '../../src/menus/MenuWorldMap.js';

import {campaignMapEntrance} from '../../src/menus/CampaignMapEntrance.js';
import {measureRoadIntrusion,regionalRoadCorridors} from '../../src/menus/CampaignMapRoadClearance.js';

const menu=JSON.parse(readFileSync(new URL('../../data/server-storage/files/menus/Game%20Menu/document.json',import.meta.url),'utf8'));
const widgets=menu.screens.filter(s=>/^campaign-hub-\d+$/.test(s.id))
 .map(s=>s.elements.find(e=>e.property==='campaign-path'));
const file=ref=>new URL('../../assets/campaign-map-landmarks/'+ref+'.png',import.meta.url);

test('all authored regional race nodes have the right independent atlas cell',()=>{
 assert.equal(widgets.length,11);
 for(const el of widgets){
  const atlas=readFileSync(file(el.artRef));
  assert.equal(atlas.readUInt32BE(16),768);
  assert.equal(atlas.readUInt32BE(20),320);
  assert.equal(atlas[25],6); // RGBA
  const entries=CAMPAIGN_LANDMARKS[el.artRef];
  assert.deepEqual(Object.keys(entries).sort(),el.nodes.map(n=>n.id).sort());
  assert.deepEqual(Object.values(entries).map(x=>x[1]).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
  for(const n of el.nodes)assert.equal(entries[n.id][0],n.raceRef);
 }
});

test('road depth passes use exact node anchors and fit both layout shapes',()=>{
 const depths=new Set();
 for(const el of widgets)for(const b of [{x:15,y:70,w:350,h:390},{x:122,y:19,w:620,h:363}]){
  const positions=new Map(el.nodes.map(n=>[n.id,worldMapNodePoint(n,b,el)]));
  const p=mapLandmarkPlacements(el,el.nodes,positions,b,{});
  assert.equal(p.length,8);
  for(const x of p){
   const [l,t,r,bt]=x.ink,scale=x.width/192;
   assert(x.x+l*scale>=b.x-.001 && x.y+t*scale>=b.y-.001 &&
    x.x+r*scale<=b.x+b.w+.001 && x.y+bt*scale<=b.y+b.h-36+.001);
   const node=el.nodes.find(n=>CAMPAIGN_LANDMARKS[el.artRef][n.id][1]===x.index),pin=positions.get(node.id);
   const separation=Math.min(...[...positions.values()].filter(p=>p!==pin).map(p=>Math.hypot(p.x-pin.x,p.y-pin.y)));
   const previous=Math.min(b.w*.188,(b.h-36)*.255,144), weight=CAMPAIGN_LANDMARKS[el.artRef][node.id][3];
   const oldWidth=Math.min(previous*weight,Math.max(previous*.69,separation*1.45));
   assert(x.width>=oldWidth*2);
   depths.add(x.depth);
  }
  const painted=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(...a){painted.push(a[1]/192+4*a[2]/160);}};
  drawMapLandmarkLayer(ctx,p,false);
  assert.deepEqual(painted,p.map(x=>x.index));
  drawMapLandmarkLayer(ctx,p,true);
  assert.deepEqual(painted,[...p,...p.filter(x=>x.depth!=='ground')].map(x=>x.index));
 }
 assert.deepEqual([...depths].sort(),['ground','raised','underpass']);
});

test('world overview, pending assets and remapped races never show unrelated miniatures',()=>{
 const el=widgets[0],n=el.nodes[0],box={x:0,y:0,w:400,h:400},points=new Map([[n.id,{x:94,y:157}]]);
 assert.deepEqual(mapLandmarkPlacements({...el,property:''},[n],points,box,{}),[]);
 assert.deepEqual(mapLandmarkPlacements(el,[n],points,box,null),[]);
 assert.deepEqual(mapLandmarkPlacements(el,[{...n,raceRef:'independent race'}],points,box,{}),[]);
});


test('swapping terrain keeps the canonical regional miniatures even when stage order is swapped',()=>{
 const progression=menu.parameters.campaignProgression, box={x:0,y:0,w:380,h:420};
 for(const el of widgets){
  const p=new Map(el.nodes.map(n=>[n.id,worldMapNodePoint(n,box,el)]));
  for(const artRef of ['custom-terrain','']){
   const swapped={...el,artRef};
   const m=mapLandmarkPlacements(swapped,el.nodes,p,box,{},progression);
   assert.equal(m.length,8,el.assetRef);
   const wrong=el.nodes.map(n=>({...n,raceRef:n.raceRef+' test'}));
   assert.deepEqual(mapLandmarkPlacements(swapped,wrong,p,box,{},progression),[]);
  }
 }
});

test('authored landmarks keep their size and move their footprint away from swept roads',()=>{
 for(const b of [{x:0,y:0,w:250,h:350},{x:15,y:70,w:350,h:390},{x:122,y:19,w:620,h:363}]){
  let before=0,after=0;
  for(const el of widgets){
   const style=normalizeWorldMapStyle(el.mapStyle);
   const positions=new Map(el.nodes.map(n=>[n.id,worldMapNodePoint(n,b,el)]));
   const roadNodes=el.nodes.map(n=>({ ...n,x:(positions.get(n.id).x-b.x)/b.w,y:(positions.get(n.id).y-b.y)/(b.h-36)}));
   const entrance=campaignMapEntrance(el,roadNodes,el.connections);
   const nodes=entrance?[...roadNodes,entrance.end]:roadNodes,links=entrance?[...el.connections,entrance.link]:el.connections;
   const corridors=regionalRoadCorridors(b,nodes,links,style);
   const old=mapLandmarkPlacements(el,el.nodes,positions,b,{}),m=regionalLandmarkPlacements(el,el.nodes,positions,b,menu.parameters.campaignProgression,nodes,links,style,{});
   assert.equal(m.length,8);
   for(const p of m){
    assert.equal(p.width,old.find(n=>n.nodeId===p.nodeId).width);
    const [l,t,r,bt]=p.ink,s=p.width/192;
    assert(p.x+l*s>=b.x-.001&&p.y+t*s>=b.y-.001&&p.x+r*s<=b.x+b.w+.001&&p.y+bt*s<=b.y+b.h-36+.001);
   }
   before+=measureRoadIntrusion(old,corridors).reduce((n,p)=>n+p.intrusion**2,0);
   after+=measureRoadIntrusion(m,corridors).reduce((n,p)=>n+p.intrusion**2,0);
  }
  assert(before>0&&after<before*.1,'swept road clearance should improve at '+b.w);
 }
});

test('a moving car paints in front of a nearer road-side silhouette only when its road anchor is in front',()=>{
 const calls=[],ctx={globalAlpha:.9,save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(...args){calls.push('art-'+args[1]/192);}};
 const sprite=(index,groundY,depth)=>({image:{},index,depth,x:0,y:0,width:40,height:33,groundY,locked:true});
 const p=[sprite(0,20,'raised'),sprite(1,40,'underpass'),sprite(2,50,'ground')];
 const draw=y=>drawMapLandmarkLayer(ctx,p,true,{y,draw(){assert.equal(ctx.globalAlpha,.9);calls.push('car');}});
 draw(10);assert.deepEqual(calls.splice(0),['car','art-0','art-1']);
 draw(30);assert.deepEqual(calls.splice(0),['art-0','car','art-1']);
 draw(60);assert.deepEqual(calls.splice(0),['art-0','art-1','car']);
 drawMapLandmarkLayer(ctx,[],true,{y:0,draw(){calls.push('car-fallback');}});
 assert.deepEqual(calls,['car-fallback']);
});
