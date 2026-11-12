import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRaceDecalTriangles} from '../../src/racing/RaceDecals.js';

test('rotated decals conform across a sloped and rolling surface with continuous UVs',()=>{
  const elevation=({x,z})=>({elevation:x*.1+Math.sin(z)});
  const triangles=buildRaceDecalTriangles({x:20,z:40,widthM:10,heightM:6,rotation:.7},elevation);
  assert.ok(triangles.length>100);
  const coords=new Map();
  for(const triangle of triangles) for(const p of triangle){
    assert.equal(p.elevation,elevation(p).elevation);
    assert.ok(p.u>=0 && p.u<=1 && p.v>=0 && p.v<=1);
    const key=`${p.x}:${p.z}`;
    if(coords.has(key)) assert.deepEqual(coords.get(key),p); else coords.set(key,p);
  }
  const heights=[...coords.values()].map(p=>p.elevation);
  assert.ok(Math.max(...heights)-Math.min(...heights)>1);
});

test('oval decal footprints stay inside their authored ellipse',()=>{
  const triangles=buildRaceDecalTriangles({widthM:8,heightM:4,shape:'oval'},()=>({elevation:2}));
  for(const t of triangles) for(const p of t) assert.ok((p.x/4)**2+(p.z/2)**2<=1+1e-8);
});

test('decal renderer uses cached depth-tested terrain geometry and clears removed decals', async()=>{
  const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
  const THREE=await import('../../src/vendorBridge/three.js');
  const e=new RaceEditor({}),surface={sampleWorld:({x,z})=>({elevation:x*.2+z*.1})};
  e.getRaceSurfaceModel=()=>surface;
  e.getRaceArtSpriteCanvas=()=>({width:32,height:32});
  e.getRaceThreeTexture=()=>new THREE.Texture();
  e.selectedRace.decals=[{id:'test',kind:'decal',artRef:'Art',x:0,z:0,widthM:4,heightM:4}];
  const renderer={scene:new THREE.Scene()};
  assert.equal(e.syncRaceThreeDecals(renderer),true);
  const group=renderer.decalGroup,mesh=group.children[0];
  assert.equal(mesh.material.depthTest,true); assert.equal(mesh.material.depthWrite,false);
  const p=mesh.geometry.attributes.position.array;
  for(let i=0;i<p.length;i+=3) assert.ok(Math.abs(p[i+1]-((p[i]*.2+p[i+2]*.1)*12+.02))<1e-5);
  e.syncRaceThreeDecals(renderer); assert.equal(renderer.decalGroup,group);
  e.selectedRace.decals=[];e.syncRaceThreeDecals(renderer);
  assert.equal(renderer.decalGroup.children.length,0);assert.equal(group.parent,null);
});

test('fallback WebGL has terrain-conforming textured decals with cached UVs',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const e=new RaceEditor({}),surface={sampleWorld:({x,z})=>({elevation:x*.2+z*.1})};
 e.getRaceSurfaceModel=()=>surface;
 e.selectedRace.decals=[{id:'test',kind:'decal',artRef:'Art',x:0,z:0,widthM:4,heightM:4}];
 const meshes=e.getRaceWebGLDecalMeshes();assert.ok(meshes.length);
 assert.equal(e.getRaceWebGLDecalMeshes(),meshes);
 for(const m of meshes){assert.equal(m.artRef,'Art');assert.equal(m.textured,true);assert.ok(m.depthOffset<-.08);
  for(const p of m.points){assert.equal(p.elevation,p.x*.2+p.z*.1);assert.ok(Number.isFinite(p.u)&&Number.isFinite(p.v));}}
 e.selectedRace.decals=[];assert.deepEqual(e.getRaceWebGLDecalMeshes(),[]);
 e.selectedRace.renderDebug={overlaysEnabled:false};assert.deepEqual(e.getRaceWebGLDecalMeshes(),[]);
});

test('decal textures clamp filtered edges without changing repeating road textures', async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const THREE=await import('../../src/vendorBridge/three.js');
 const e=new RaceEditor({});e.getRaceArtSpriteCanvas=()=>({width:32,height:32});e.getRaceGroundTextureFilterMode=()=> 'smooth';
 const renderer={textureCache:new Map()};
 const road=e.getRaceThreeTexture(renderer,'same-art');
 const decal=e.getRaceThreeTexture(renderer,'same-art',{clampEdges:true,premultiplyAlpha:true,filterMode:'smooth'});
 assert.notEqual(road,decal);assert.equal(road.wrapS,THREE.RepeatWrapping);assert.equal(road.wrapT,THREE.RepeatWrapping);
 assert.equal(decal.wrapS,THREE.ClampToEdgeWrapping);assert.equal(decal.wrapT,THREE.ClampToEdgeWrapping);
 assert.equal(decal.minFilter,THREE.LinearMipmapLinearFilter);
 assert.equal(decal.premultiplyAlpha,true);assert.equal(road.premultiplyAlpha,false);
 assert.equal(e.getRaceThreeTexture(renderer,'same-art',{clampEdges:true,premultiplyAlpha:true,filterMode:'smooth'}),decal);
});
