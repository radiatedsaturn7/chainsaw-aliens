import test from 'node:test';
import assert from 'node:assert/strict';
import { roadTextureSettings, buildRoadTextureStrips } from '../../src/racing/RaceRoadTextures.js';
import { buildRaceNetworkGeometry } from '../../src/racing/RaceNetworkGeometry.js';
import { normalizeRaceRouteNetwork } from '../../src/racing/RaceRouteNetwork.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const settings={road:{artRef:'center line',repeatM:5},margin:{artRef:'curb',repeatM:2}};
const fixture=()=>{
 const network=normalizeRaceRouteNetwork({nodes:[{id:'a',x:0,z:0,heightM:0},{id:'b',x:0,z:60,heightM:0},{id:'c',x:60,z:110,heightM:8}],edges:[{id:'ab',from:'a',to:'b',widthM:8},{id:'bc',from:'b',to:'c',widthM:8,structure:'bridge',points:[{x:15,z:90,heightM:4}]}],startNodeId:'a'});
 const g=buildRaceNetworkGeometry(network);
 return {network,bake:{key:'textures',terrainTopology:'route-network',runtimeType:'destination',routeLength:150,mesh:g.mesh,structureMeshes:g.structureMeshes,surfaceBake:{sections:g.paths.flatMap(p=>p.sections),paths:g.paths}}};
};
test('road and margin tiles follow curved cross sections at separate repeat lengths',()=>{
 const {bake}=fixture(),meshes=buildRoadTextureStrips(bake,settings);
 let i=0;
 for(const path of bake.surfaceBake.paths)for(let k=1;k<path.sections.length;k++){
  const m=meshes.roadMeshes[i++],a=path.sections[k-1],b=path.sections[k];
  assert.deepEqual(m.points.map(p=>p.u),[0,1,1,0]);
  assert.equal(m.points[0].v,-b.center.distance/5);assert.equal(m.points[2].v,-a.center.distance/5);
  assert.equal(m.points[0].elevation,b.left.elevation);
  assert.ok(Math.abs((m.points[0].x+m.points[1].x)/2-b.center.x)<1e-8);
  assert.ok(Math.abs((m.points[0].z+m.points[1].z)/2-b.center.z)<1e-8);
 }
 assert.equal(meshes.boundaryMeshes.length,i*2);
 for(let k=0;k<i;k++)assert.ok(Math.abs(meshes.boundaryMeshes[k*2].points[0].v-meshes.roadMeshes[k].points[0].v*2.5)<1e-8);
});
test('two-way joins continue the centered ribbon and margins',()=>{
 const {bake,network}=fixture();const a=buildRoadTextureStrips(bake,settings),b=buildRoadTextureStrips(bake,settings,{networkDefinition:network});
 assert.equal(b.roadMeshes.length,a.roadMeshes.length+1);assert.equal(b.boundaryMeshes.length,a.boundaryMeshes.length+2);
 assert.deepEqual(b.roadMeshes.at(-1).points.map(p=>p.u),[0,1,1,0]);
});
test('static renderer uses textures, preserves road elevation/UVs and invalidates on repeat changes',()=>{
 const {bake,network}=fixture(),e=new RaceEditor({});e.selectedRace.road.network=network;e.selectedRace.roadTextures={...structuredClone(settings),builtInLines:false};
 const first=e.getRaceStaticTrackSurfaceMeshes(bake);
 assert.ok(first.roadMeshes.some(m=>m.artRef==='center line'));assert.ok(first.boundaryMeshes.every(m=>m.artRef==='curb'));
 assert.equal(first.roadPaintMeshes.length,0);assert.ok(first.trackFurnitureMeshes.length);
 const mesh=first.roadMeshes.find(m=>m.source==='road-texture'&&m.points[0].elevation>.1);
 const geometry=e.getRaceThreeMeshGeometry([mesh]);
 assert.equal(geometry.attributes.uv.array[0],0);
 assert.ok(Math.abs(geometry.attributes.uv.array[1]-mesh.points[0].v)<1e-5);
 assert.ok(Math.abs(geometry.attributes.position.array[1]-(mesh.points[0].elevation*12+mesh.threeLiftM))<1e-5);
 assert.equal(e.getRaceStaticTrackSurfaceMeshes(bake),first);
 e.selectedRace.roadTextures.road.repeatM=10;
 const second=e.getRaceStaticTrackSurfaceMeshes(bake);assert.notEqual(second,first);
 assert.equal(second.roadMeshes[0].points[0].v,first.roadMeshes[0].points[0].v/2);
 e.selectedRace.margin.marginMode='off';assert.equal(e.getRaceStaticTrackSurfaceMeshes(bake).boundaryMeshes.length,0);
});
test('editor settings save/load, collect artwork, cancel cleanly and restore default mapping',async()=>{
 const e=new RaceEditor({});let fields;
 await e.openRaceRoadTextures(async(title,f)=>{fields=f;return {roadArt:'center line',roadRepeat:7,roadRepeatWidth:4,marginRepeatWidth:.1,marginArt:'curb',marginRepeat:2,builtInLines:false};});
 assert.equal(fields.length,7);assert.equal(e.selectedRace.roadTextures.road.repeatM,7);
 assert.ok(e.collectSelectedRaceTextureArtRefs().includes('center line'));
 const loaded=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());
 assert.deepEqual(loaded.roadTextures,e.selectedRace.roadTextures);
 const before=JSON.stringify(e.selectedRace);await e.openRaceRoadTextures(async()=>null);assert.equal(JSON.stringify(e.selectedRace),before);
 await e.openRaceRoadTextures(async()=>({roadArt:'',roadRepeat:5,marginArt:'',marginRepeat:2,builtInLines:true}));
 assert.equal(roadTextureSettings(e.selectedRace).road.artRef,'');
});

test('repeat width tiles across the road, stays centered, and invalidates cached geometry',()=>{
 const {bake,network}=fixture(),e=new RaceEditor({});e.selectedRace.road.network=network;e.selectedRace.roadTextures=structuredClone(settings);
 const initial=e.getRaceStaticTrackSurfaceMeshes(bake);e.selectedRace.roadTextures.road.repeatWidthM=2;
 const changed=e.getRaceStaticTrackSurfaceMeshes(bake);assert.notEqual(initial,changed);
 const strip=changed.roadMeshes.find(m=>m.source==='road-texture'),[left,right]=strip.points;
 assert.ok(Math.abs((right.u-left.u)-Math.hypot(right.x-left.x,right.z-left.z)/2)<1e-8);
 assert.equal((left.u+right.u)/2,.5);assert.equal(roadTextureSettings({}).road.repeatWidthM,0);
});
