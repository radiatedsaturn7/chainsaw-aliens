import test from 'node:test';
import * as THREE from '../../src/vendorBridge/three.js';
import assert from 'node:assert/strict';
import { roadTextureSettings, buildRoadTextureStrips, showBuiltInRoadMarkings, roadTextureMipBias } from '../../src/racing/RaceRoadTextures.js';
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
 await e.openRaceRoadTextures(async(title,f)=>{fields=f;return {roadMipmapDistance:4,roadFilter:'crisp',roadMipmaps:false,roadAnisotropy:16,roadArt:'center line',roadRepeat:7,roadRepeatWidth:4,marginRepeatWidth:.1,marginArt:'curb',marginRepeat:2,builtInLines:false};});
 assert.equal(fields.length,15);assert.equal(e.selectedRace.roadTextures.road.repeatM,7);
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


test('custom road art suppresses generated lane paint, including existing enabled settings',()=>{
 const {bake,network}=fixture(),e=new RaceEditor({});e.selectedRace.road.network=network;
 e.selectedRace.roadTextures={...structuredClone(settings),builtInLines:true};
 assert.equal(showBuiltInRoadMarkings(e.selectedRace),false);
 assert.equal(e.getRaceStaticTrackSurfaceMeshes(bake).roadPaintMeshes.length,0);
 e.selectedRace.roadTextures.road.artRef='';
 assert.equal(showBuiltInRoadMarkings(e.selectedRace),true);
 e.selectedRace.roadTextures.builtInLines=false;
 assert.equal(showBuiltInRoadMarkings(e.selectedRace),false);
 assert.equal(showBuiltInRoadMarkings({}),true);
});


test('road sampling survives geometry caching and creates independently filtered textures', () => {
 const {bake,network}=fixture(), e=new RaceEditor({});
 e.selectedRace.road.network=network;
 e.selectedRace.roadTextures=structuredClone(settings);
 const before=e.getRaceStaticTrackSurfaceMeshes(bake);
 Object.assign(e.selectedRace.roadTextures.road,{filterMode:'crisp',mipmaps:false,anisotropy:16});
 const after=e.getRaceStaticTrackSurfaceMeshes(bake);
 assert.notEqual(after,before);
 const options=after.roadMeshes.find(m=>m.artRef==='center line').textureOptions;
 assert.deepEqual(options,{filterMode:'crisp',mipmapDistance:1,mipmaps:false,anisotropy:16});
 e.getRaceArtSpriteCanvas=()=>({width:64,height:64});
 const renderer={textureCache:new Map(),threeRenderer:{capabilities:{getMaxAnisotropy:()=>8}}};
 const crisp=e.getRaceThreeTexture(renderer,'center line',options);
 assert.equal(crisp.minFilter,THREE.NearestFilter);
 assert.equal(crisp.magFilter,THREE.NearestFilter);
 assert.equal(crisp.generateMipmaps,false);
 assert.equal(crisp.anisotropy,1);
 const smooth=e.getRaceThreeTexture(renderer,'center line',{filterMode:'smooth',mipmaps:true,anisotropy:16});
 assert.notEqual(smooth,crisp);
 assert.equal(smooth.minFilter,THREE.LinearMipmapLinearFilter);
 assert.equal(smooth.generateMipmaps,true);
 assert.equal(smooth.anisotropy,8);
 assert.equal(e.getRaceThreeTexture(renderer,'center line',options),crisp);
});


test('mipmap distance delays detail reduction without changing UVs and separates materials', () => {
 assert.equal(roadTextureMipBias({mipmapDistance:4}),-2);
 assert.equal(roadTextureMipBias({mipmapDistance:.5}),1);
 assert.equal(roadTextureMipBias({mipmapDistance:4,mipmaps:false}),0);
 const {bake}=fixture();
 const a=buildRoadTextureStrips(bake,settings);
 const b=buildRoadTextureStrips(bake,{...settings,road:{...settings.road,mipmapDistance:4}});
 assert.deepEqual(a.roadMeshes.map(m=>m.points),b.roadMeshes.map(m=>m.points));
 const e=new RaceEditor({}),renderer={},texture=new THREE.Texture();
 const normal=e.getRaceThreeMaterial(renderer,{texture});
 const delayed=e.getRaceThreeMaterial(renderer,{texture,textureOptions:{mipmapDistance:4}});
 assert.notEqual(normal,delayed);
 const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};
 delayed.onBeforeCompile(shader);
 assert.equal(shader.uniforms.roadMipmapBias.value,-2);
 assert.ok(shader.fragmentShader.includes('texture2D( map, vMapUv, roadMipmapBias )'));
});

test('three- and four-way junctions retain textured coverage and match every road mouth UV',()=>{
 for(const arms of [3,4]){
  const nodes=[{id:'j',x:0,z:0,heightM:5},{id:'s',x:0,z:-60,heightM:0},{id:'e',x:60,z:0,heightM:8},{id:'n',x:0,z:60,heightM:5},{id:'w',x:-60,z:0,heightM:2}].slice(0,arms+1);
  const network=normalizeRaceRouteNetwork({nodes,edges:nodes.slice(1).map((n,i)=>({id:n.id,from:i===0?n.id:'j',to:i===0?'j':n.id,widthM:8+i*2})),startNodeId:'s'});
  const g=buildRaceNetworkGeometry(network),bake={key:'junction-'+arms,terrainTopology:'route-network',runtimeType:'destination',routeLength:180,mesh:g.mesh,surfaceBake:{paths:g.paths,sections:g.paths.flatMap(p=>p.sections)}};
  const config=roadTextureSettings({roadTextures:{road:{artRef:'asphalt',repeatM:3,repeatWidthM:3,mipmapDistance:4},margin:{artRef:''}}});
  const result=buildRoadTextureStrips(bake,config,{networkDefinition:network});
  const triangles=g.mesh.triangles.filter(t=>t.source==='junction:j');assert.ok(triangles.length>0);assert.equal(result.junctionMeshes.length,triangles.length);
  for(const [i,mesh] of result.junctionMeshes.entries()){
   assert.equal(mesh.artRef,'asphalt');assert.equal(mesh.textured,true);assert.equal(mesh.textureOptions.mipmapDistance,4);
   assert.deepEqual(mesh.points.map(({x,z,elevation})=>({x,z,elevation})),triangles[i].vertices.map(({x,z,elevation})=>({x,z,elevation})));
   assert.ok(mesh.points.every(p=>Number.isFinite(p.u)&&Number.isFinite(p.v)));
  }
  for(const path of g.paths){
   const edge=network.edges.find(e=>e.id===path.edgeId),end=edge.from==='j'?path.sections[0]:path.sections.at(-1);
   for(const corner of [end.left,end.right]){
    const match=p=>Math.hypot(p.x-corner.x,p.z-corner.z)<1e-6;
    const apron=result.junctionMeshes.flatMap(m=>m.points).find(match),ribbon=result.roadMeshes.flatMap(m=>m.points).find(match);
    assert.ok(apron&&ribbon);assert.equal(apron.u,ribbon.u);assert.equal(apron.v,ribbon.v);
   }
  }
  const editor=new RaceEditor({});editor.selectedRace.road.network=network;editor.selectedRace.roadTextures={road:config.road};
  const rendered=editor.getRaceStaticTrackSurfaceMeshes(bake).roadMeshes;
  assert.equal(rendered.filter(m=>m.source==='road-texture-junction').length,triangles.length);
  assert.ok(rendered.every(m=>m.textured&&m.artRef==='asphalt'));
 }
});
