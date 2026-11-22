import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN_LANDMARKS} from '../../src/menus/CampaignMapLandmarkLayout.js';
import {mapLandmarkPlacements,drawMapLandmarkLayer} from '../../src/menus/CampaignMapLandmarks.js';
import {worldMapNodePoint} from '../../src/menus/MenuWorldMap.js';

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
   assert(x.x>=b.x && x.y>=b.y && x.x+x.width<=b.x+b.w+.001 && x.y+x.height<=b.y+b.h-36+.001);
   depths.add(x.depth);
  }
  const painted=[],ctx={save(){},restore(){},drawImage(...a){painted.push(a[1]/192+4*a[2]/160);}};
  drawMapLandmarkLayer(ctx,p,false);
  assert.deepEqual(painted,p.filter(x=>x.depth==='ground').map(x=>x.index));
  drawMapLandmarkLayer(ctx,p,true);
  assert.deepEqual(painted,[...p.filter(x=>x.depth==='ground'),...p.filter(x=>x.depth!=='ground')].map(x=>x.index));
 }
 assert.deepEqual([...depths].sort(),['ground','raised','underpass']);
});

test('world overview, pending assets and remapped races never show unrelated miniatures',()=>{
 const el=widgets[0],n=el.nodes[0],box={x:0,y:0,w:400,h:400},points=new Map([[n.id,{x:94,y:157}]]);
 assert.deepEqual(mapLandmarkPlacements({...el,property:''},[n],points,box,{}),[]);
 assert.deepEqual(mapLandmarkPlacements(el,[n],points,box,null),[]);
 assert.deepEqual(mapLandmarkPlacements(el,[{...n,raceRef:'independent race'}],points,box,{}),[]);
});
