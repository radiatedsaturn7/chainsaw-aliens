import test from 'node:test';
import {prepareRaceSurfaceBakeForTransfer} from '../../src/ui/raceWorldBakeWorker.js';
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
 await e.openRaceRoadTextures(async(title,f)=>{fields=f;return {roadLaneWidth:3.6576,roadMipmapDistance:4,roadFilter:'crisp',roadMipmaps:false,roadAnisotropy:16,roadArt:'center line',roadRepeat:7,roadRepeatWidth:4,marginRepeatWidth:.1,marginArt:'curb',marginRepeat:2,builtInLines:false};});
 assert.ok(fields.some(field=>field.id==='roadLaneWidth'));assert.equal(e.selectedRace.roadTextures.road.laneWidthM,3.6576);assert.ok(fields.some(field=>field.id==='debugRoad_asphalt'));assert.equal(e.selectedRace.roadTextures.road.repeatM,7);
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

test('physical surface ribbons and mirrored shoulder UVs survive editing and preload', async()=>{
 const e=new RaceEditor({});
 e.selectedRace.roadTextures={road:{artRef:'asphalt'},shoulder:{artRef:'transition'},surfaceRoads:{gravel:{artRef:'gravel',roughArtRef:'ruts'}}};
 const settings=roadTextureSettings(e.selectedRace);
 const section=(distance,surface,bumpiness)=>({center:{distance,segment:{surface,bumpiness}},left:{x:-4,z:distance},right:{x:4,z:distance},marginLeft:{x:-4.2,z:distance},marginRight:{x:4.2,z:distance},shoulderLeft:{x:-6,z:distance},shoulderRight:{x:6,z:distance}});
 const meshes=buildRoadTextureStrips({surfaceBake:{sections:[section(0,'asphalt',0),section(10,'gravel',.1),section(20,'gravel',.6),section(30,'asphalt',0)]}},settings);
 assert.deepEqual(meshes.roadMeshes.filter(m=>!m.vertexAlpha).map(m=>m.artRef),['asphalt','gravel','ruts']);
 const transferred=prepareRaceSurfaceBakeForTransfer({sections:[section(0,'gravel',.6),section(10,'gravel',.6)]});
 assert.equal(buildRoadTextureStrips({surfaceBake:transferred},settings).roadMeshes[0].artRef,'ruts');
 assert.equal(buildRoadTextureStrips({surfaceBake:transferred},settings,{shoulderVisible:false}).shoulderMeshes.length,0);
 for(const shoulder of meshes.shoulderMeshes){assert.equal(shoulder.artRef,'transition');assert.deepEqual(shoulder.points.map(p=>p.u),[0,1,1,0]);assert.ok(Math.abs(shoulder.points[0].x)<Math.abs(shoulder.points[1].x));}
 for(const ref of ['gravel','ruts','transition'])assert.ok(e.collectSelectedRaceTextureArtRefs().includes(ref));
 await e.openRaceRoadTextures(async()=>({roadArt:'asphalt',roadRepeat:5}));
 assert.equal(e.selectedRace.roadTextures.surfaceRoads.gravel.roughArtRef,'ruts');
 assert.equal(e.selectedRace.roadTextures.shoulder.artRef,'transition');
});

test('static scene rebuilds when mixed road and shoulder artwork arrives',()=>{
 const e=new RaceEditor({});e.getRaceSurfaceGeometryRevisionKey=()=> 'same';e.getRaceTileMapStats=()=>({artRefs:[]});
 e.ensureRaceSurfaceArt=()=>({});e.ensureRaceTileMap=()=>({revision:1});e.getRaceGroundTextureFilterMode=()=> 'balanced';
 const loaded=new Set(['main']);e.getRaceArtSpriteCanvas=ref=>loaded.has(ref)?{}:null;
 const options={staticRevisionKey:'unchanged',roadMeshes:[{artRef:'main'},{artRef:'rough'}],shoulderMeshes:[{artRef:'edge'}]};
 const first=e.getRaceThreeStaticWorldKey([],options);loaded.add('rough');
 const second=e.getRaceThreeStaticWorldKey([],options);assert.notEqual(first,second);
 loaded.add('edge');assert.notEqual(second,e.getRaceThreeStaticWorldKey([],options));
});

test('road, shoulder and decal images are critical startup artwork',async()=>{
 const {buildRaceTransferPackage}=await import('../../src/ui/raceWorldBakeWorker.js');
 const e=new RaceEditor({}),{network}=fixture();
 e.selectedRace.road.network=network;e.selectedRace.road.mode='network';
 e.selectedRace.roadTextures={road:{artRef:'main'},shoulder:{artRef:'edge'},surfaceRoads:{gravel:{artRef:'gravel',roughArtRef:'ruts'}}};
 e.selectedRace.road.segments=[{surface:'asphalt',length:20,shoulderTexture:{artRef:'section shoulder',repeatM:6}}];
 e.selectedRace.decals=[{id:'mark',kind:'decal',artRef:'skids',x:0,z:10,widthM:2,heightM:3}];
 const p=await buildRaceTransferPackage(e.selectedRace,{includeArtAssets:false});
 for(const ref of ['main','edge','gravel','ruts','skids','section shoulder'])assert.ok(p.artPlan.criticalRefs.includes(ref),ref);
});

 test('surface crossfades stay on the road deck with a continuous half blend at the join',()=>{
 const section=(d,surface)=>({center:{distance:d,segment:{surface}},left:{x:-4,z:d,elevation:10+d*.1},right:{x:4,z:d,elevation:10+d*.1}});
 const bake={surfaceBake:{sections:[section(0,'asphalt'),section(20,'gravel'),section(40,'gravel')]}};
 const settings=roadTextureSettings({roadTextures:{road:{artRef:'asphalt'},surfaceRoads:{gravel:{artRef:'gravel'}}}});
 const before=JSON.stringify(bake),meshes=buildRoadTextureStrips(bake,settings).roadMeshes,blends=meshes.filter(m=>m.vertexAlpha);
 assert.ok(blends.length);assert.equal(JSON.stringify(bake),before);
 const editor=new RaceEditor({});
 for(const m of blends){
  const geometry=editor.getRaceThreeMeshGeometry([m]);assert.equal(geometry.getAttribute('color').itemSize,4);
  for(const p of m.points){assert.ok(p.z>=12&&p.z<=28);assert.ok(p.alpha>=0&&p.alpha<=.5);assert.ok(Math.abs(p.elevation-(10+p.z*.1))<1e-8);if(p.z===20)assert.equal(p.alpha,.5);}
 }
 assert.ok(blends.some(m=>m.artRef==='asphalt'));assert.ok(blends.some(m=>m.artRef==='gravel'));
});

test('section shoulders override surface mappings and survive worker transfer',()=>{
 const e=new RaceEditor({});
 e.selectedRace.roadTextures={shoulder:{artRef:'default',repeatM:8},surfaceShoulders:{gravel:{artRef:'gravel edge',repeatM:8},dirt:{enabled:false}}};
 const settings=roadTextureSettings(e.selectedRace);
 const section=(distance,segment)=>({center:{distance,segment},left:{x:-4,z:distance},right:{x:4,z:distance},marginLeft:{x:-4.2,z:distance},marginRight:{x:4.2,z:distance},shoulderLeft:{x:-6,z:distance},shoulderRight:{x:6,z:distance}});
 const sections=[section(0,{surface:'asphalt'}),section(20,{surface:'gravel'}),section(40,{surface:'dirt'}),section(60,{surface:'dirt',shoulderTexture:{artRef:'section edge',repeatM:8}}),section(80,{surface:'gravel',shoulderTexture:{enabled:false}}),section(100,{surface:'asphalt'})];
 const transferred=prepareRaceSurfaceBakeForTransfer({sections});
 const meshes=buildRoadTextureStrips({surfaceBake:transferred},settings).shoulderMeshes;
 assert.deepEqual(meshes.filter(m=>!m.vertexAlpha).map(m=>m.artRef),['default','default','gravel edge','gravel edge','section edge','section edge']);
 assert.ok(meshes.some(m=>m.vertexAlpha));
 for(const mesh of meshes){
  assert.ok(mesh.depthOffset < -.09,'art sits above the base shoulder in fallback WebGL');
  if(mesh.vertexAlpha) for(const p of mesh.points){assert.ok(p.z>=12&&p.z<=28);assert.ok(p.alpha>=0&&p.alpha<=.5);}
 }
 assert.equal(buildRoadTextureStrips({surfaceBake:transferred},settings,{shoulderVisible:false}).shoulderMeshes.length,0);
});

test('shoulder editor saves surface and section overrides, removes inheritance overrides and cancels cleanly',async()=>{
 const e=new RaceEditor({}),segment={length:100,surface:'gravel'};
 e.selectedRace.road.segments=[segment];
 e.selectedRace.road.nodes=[{x:0,y:0,elevation:0},{x:0,y:100,elevation:0}];
 e.selectedRace.margin.shoulderMode='on';
 await e.openRaceShoulderTextures(async()=>({default:'base',defaultRepeat:12,gravel:'edge',gravelRepeat:6}));
 assert.equal(e.selectedRace.roadTextures.surfaceShoulders.gravel.artRef,'edge');
 const before=JSON.stringify(e.selectedRace);
 await e.openRaceShoulderTextures(async()=>null,segment);assert.equal(JSON.stringify(e.selectedRace),before);
 const key=e.getRaceSurfaceGeometryRevisionKey();
 await e.openRaceShoulderTextures(async()=>({section:'__none'}),segment);
 assert.equal(e.getRaceShoulderWidthWorld(segment),0);
 assert.equal(e.getRaceCollisionShoulderWidthWorld(segment,'shoulder'),0);
 assert.equal(e.isRaceShoulderVisible(segment),false);
 assert.notEqual(e.getRaceSurfaceGeometryRevisionKey(),key);
 const loaded=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());
 assert.equal(loaded.road.segments[0].shoulderTexture.enabled,false);
 await e.openRaceShoulderTextures(async()=>({section:'custom edge',sectionRepeat:7}),segment);
 assert.ok(e.getRaceShoulderWidthWorld(segment)>0);
 assert.ok(e.collectSelectedRaceTextureArtRefs().includes('custom edge'));
 assert.equal(e.getRaceShoulderArtRef(segment),'custom edge');
 await e.openRaceShoulderTextures(async()=>({section:''}),segment);
 assert.equal(segment.shoulderTexture,undefined);
 assert.equal(e.getRaceShoulderArtRef(segment),'edge');
 await e.openRaceShoulderTextures(async()=>({default:'__none',gravel:'edge',gravelRepeat:6}));
 assert.ok(e.getRaceShoulderWidthWorld(segment)>0,'surface can override a disabled default');
 assert.equal(e.getRaceShoulderWidthWorld({surface:'asphalt'}),0);
 await e.openRaceShoulderTextures(async()=>({section:'__none'}),segment);
 const section=e.getRaceRoadCrossSectionAtDistance(50);
 assert.ok(Math.hypot(section.shoulderLeft.x-section.marginLeft.x,section.shoulderLeft.z-section.marginLeft.z)<1e-6,'disabled shoulder has no strip width in the baked cross section');
});

test('surface-only shoulder textures render without a default road or shoulder texture',()=>{
 const e=new RaceEditor({});e.selectedRace.margin.shoulderMode='on';e.selectedRace.roadTextures={surfaceShoulders:{gravel:{artRef:'gravel edge',repeatM:8}}};
 const section=distance=>({center:{distance,segment:{surface:'gravel'}},left:{x:-4,z:distance},right:{x:4,z:distance},marginLeft:{x:-4.2,z:distance},marginRight:{x:4.2,z:distance},shoulderLeft:{x:-6,z:distance},shoulderRight:{x:6,z:distance}});
 const bake={key:'shoulders-only',runtimeType:'destination',routeLength:20,surfaceBake:{sections:[section(0),section(20)]}};
 assert.equal(e.getRaceStaticTrackSurfaceMeshes(bake).shoulderMeshes.filter(m=>m.artRef==='gravel edge').length,2);
});


test('live debug road swaps snow artwork in static renderer and restores it without mutating bake',()=>{
 const {bake,network}=fixture(),editor=new RaceEditor({});
 editor.selectedRace.road.network=network;
 editor.selectedRace.roadTextures={road:{artRef:'snowroad',repeatM:5},surfaceRoads:{asphalt:{artRef:'road-snow-packed'}}};
 const before=JSON.stringify(bake);
 const authored=editor.getRaceStaticTrackSurfaceMeshes(bake);
 editor.playtestSession={debugRoad:{surface:'asphalt'}};
 const dry=editor.getRaceStaticTrackSurfaceMeshes(bake);
 assert.notEqual(dry,authored);
 assert.ok(dry.roadMeshes.length);
 assert.ok(dry.roadMeshes.every(mesh=>mesh.artRef==='road-asphalt-worn'));
 assert.equal(dry.roadPaintMeshes.length,0);
 editor.playtestSession.debugRoad={};
 const restored=editor.getRaceStaticTrackSurfaceMeshes(bake);
 assert.deepEqual(restored.roadMeshes,authored.roadMeshes);
 assert.equal(JSON.stringify(bake),before);
});

test('highway stripes use physical lane spacing for three and four lane carriageways',async()=>{
 const {roadTextureCrossSection}=await import('../../src/racing/RaceRoadTextures.js');
 for(const lanes of [3,4]){
  const width=lanes*3.6576,options=roadTextureSettings({roadTextures:{road:{laneWidthM:3.6576}}}).road;
  const {span,center}=roadTextureCrossSection({x:-width/2,z:0},{x:width/2,z:0},options);
  const left=center-span/2,right=center+span/2;
  const stripes=[];
  for(let u=-5.5;u<6;u+=1)if(u>left+1e-8&&u<right-1e-8)stripes.push((u-left)/span*width);
  assert.equal(stripes.length,lanes-1);
  stripes.forEach((x,i)=>assert.ok(Math.abs(x-(i+1)*3.6576)<1e-8));
 }
});
