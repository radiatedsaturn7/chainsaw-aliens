import RaceEditor from '../../src/ui/RaceEditor.js';
import {packRaceTileMapForRuntime} from '../../src/racing/RacePackedTileMap.js';
import fs from 'node:fs';
import zlib from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainBlendGrid,terrainBlendWeights,createTerrainBlendMaterial} from '../../src/racing/RaceTerrainTextureBlend.js';
import * as THREE from '../../src/vendorBridge/three.js';
import {installRaceLighting} from '../../src/racing/RaceLighting.js';
test('terrain paint blends across negative cells and four-way corners without changing data',()=>{
 const map={cellSizeM:40,cells:{'-1,-1':{artRef:'a'},'0,-1':{artRef:'b'},'-1,0':{artRef:'c'},'0,0':{artRef:'d'}}},before=JSON.stringify(map);
 const grid=terrainBlendGrid(map,c=>c.artRef);assert.deepEqual(grid.refs,['a','b','c','d']);assert.deepEqual([grid.minX,grid.minZ,grid.width,grid.height],[-1,-1,2,2]);
 assert.deepEqual([0,4,8,12].map(i=>grid.data[i]),[0,1,2,3]);
 assert.deepEqual(terrainBlendWeights(0,0,40),[.25,.25,0,.25,.25,0,0,0,0]);
 assert.equal(terrainBlendWeights(20,20,40)[4],.5625);
 for(let x=-50;x<50;x+=.25){const w=terrainBlendWeights(x,2,40);assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-10);assert.ok(w.every(n=>n>=0&&n<=1));}
 assert.equal(JSON.stringify(map),before);
});
test('terrain blend shader keeps world lighting and releases both GPU textures',()=>{
 const original=globalThis.OffscreenCanvas;globalThis.OffscreenCanvas=class{getContext(){return {drawImage(){}};}};
 try{
  const grid=terrainBlendGrid({cellSizeM:40,cells:{'0,0':{artRef:'a'},'1,0':{artRef:'b'}}},c=>c.artRef);
  const material=createTerrainBlendMaterial({THREE,grid,getCanvas:()=>({width:32,height:32}),makeMaterial:map=>new THREE.MeshBasicMaterial({map})});
  assert.equal(material.depthFunc,THREE.EqualDepth);assert.equal(material.depthWrite,false);
  installRaceLighting(material,{});
  const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/terrainSample/);assert.match(shader.fragmentShader,/for\(int z=0;z<3;z\+\+\)/);assert.doesNotMatch(shader.fragmentShader,/8\.\/terrainScale/);assert.match(shader.fragmentShader,/rtgFog\(outgoingLight/);
  assert.ok(shader.fragmentShader.indexOf('#include <map_pars_fragment>')<shader.fragmentShader.indexOf('vec4 terrainSample'));
  let disposed=0;material.map.addEventListener('dispose',()=>disposed++);shader.uniforms.terrainCells.value.addEventListener('dispose',()=>disposed++);material.dispose();assert.equal(disposed,2);
 }finally{globalThis.OffscreenCanvas=original;}
});

// Sample the same nine cell centres used by the GPU, including negative space.
function coverage(x,z,size,paint){
 const bx=Math.floor(x/size),bz=Math.floor(z/size),weights=terrainBlendWeights(x,z,size);
 let sum=0;
 for(let j=0;j<3;j++)for(let i=0;i<3;i++)sum+=weights[j*3+i]*paint(bx+i-1,bz+j-1);
 return sum;
}
test('coverage is continuous across grid edges, preserves uniform paint and rounds isolated corners',()=>{
 for(const x of [-150,-75,0,75,150]){
  const paint=(i,j)=>((i*7+j*3)%5===0?1:0);
  assert.ok(Math.abs(coverage(x-.001,23,75,paint)-coverage(x+.001,23,75,paint))<.0001);
 }
 assert.equal(coverage(23,-90,75,()=>1),1);
 assert.equal(coverage(23,-90,75,()=>0),0);
 const isolated=(i,j)=>i===0&&j===0?1:0;
 assert.ok(coverage(70,70,75,isolated)<coverage(70,37.5,75,isolated));
 // Both sides of an old square edge now participate far outside the old 8m band.
 assert.ok(coverage(-20,37.5,75,isolated)>0);
 assert.ok(coverage(20,37.5,75,isolated)<1);
});
test('diagonal staircase paint blends along the diagonal rather than following each tile edge',()=>{
 const paint=(i,j)=>i+j>=0?1:0;
 const values=[];
 for(let x=-150;x<=150;x+=1)values.push(coverage(x,37.5-x,75,paint));
 // The old 8m feather swings almost fully between materials along this
 // straight diagonal. The reconstructed field stays within 3.5% of 50/50.
 assert.ok(Math.max(...values)-Math.min(...values)<.07);
 assert.ok(values.every(v=>v>.465&&v<.535));
});

test('packed campaign terrain creates the same blend lookup as editor terrain',()=>{
 const stored=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/races/Ozark Backroads/document.json',import.meta.url)));
 const doc=JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64')));
 const map=doc.race.road.tileMap;
 const runtime={...map,cells:{},runtimePackedCells:packRaceTileMapForRuntime(map)};
 const editorGrid=terrainBlendGrid(map,c=>c.artRef);
 const runtimeGrid=terrainBlendGrid(runtime,c=>c.artRef);
 assert.ok(runtimeGrid,'campaign runtime must not fall back to unblended tiles');
 assert.deepEqual(runtimeGrid,editorGrid);
 assert.ok(runtimeGrid.refs.includes('ground-gray-gravel-v2'));
 assert.ok(runtimeGrid.refs.includes('ground-brown-dirt-v2'));
});
test('runtime blend lookup respects sparse editor overrides of packed cells',()=>{
 const map={cellSizeM:75,cells:{'-1,0':{artRef:'dirt'},'0,0':{artRef:'gravel'}}};
 const runtime={...map,cells:{'0,0':{artRef:'snow'}},runtimePackedCells:packRaceTileMapForRuntime(map)};
 const grid=terrainBlendGrid(runtime,c=>c.artRef);
 assert.deepEqual(grid.refs,['dirt','snow']);
 assert.equal(grid.data[4],1);
 assert.equal(terrainBlendGrid({cells:{bad:{artRef:'dirt'}}},c=>c.artRef),null);
});

test('race renderer chooses blended overlay with a packed-only terrain map',()=>{
 const original=globalThis.OffscreenCanvas;
 globalThis.OffscreenCanvas=class{getContext(){return {drawImage(){}};}};
 const map={cellSizeM:75,cells:{'0,0':{artRef:'dirt'},'1,0':{artRef:'gravel'}}};
 const runtime={...map,cells:{},runtimePackedCells:packRaceTileMapForRuntime(map)};
 const renderer={materialCache:new Map(),scene:new THREE.Scene()};
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,75,0,0,0,0,75],3));
 try{
  const editor={getRaceRenderDebugSettings:()=>({}),ensureRaceTileMap:()=>runtime,getRaceArtSpriteCanvas:()=>({width:32,height:32})};
  const count=RaceEditor.prototype.addRaceThreeTerrainArtwork.call(editor,renderer,geometry,{
   artGroups:[{artRef:'dirt',start:0,count:3}],textureColors:new Float32Array(9).fill(1),textureWorldM:2.5
  });
  assert.equal(count,1);
  assert.equal(renderer.scene.children[0].name,'terrain-art:blended');
  assert.ok(renderer.materialCache.has('terrain-world-blend'));
 }finally{
  renderer.scene.children.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});
  geometry.dispose();globalThis.OffscreenCanvas=original;
 }
});

test('terrain atlas builds isolated 256-to-1 mip levels and samples LOD before wrapping',()=>{
 const original=globalThis.OffscreenCanvas,canvases=[];
 globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;this.draws=[];canvases.push(this);}getContext(){return {drawImage:(...args)=>this.draws.push(args)};}};
 try{
  const grid=terrainBlendGrid({cellSizeM:75,cells:{'0,0':{artRef:'dirt'},'1,0':{artRef:'gravel'}}},c=>c.artRef);
  const material=createTerrainBlendMaterial({THREE,grid,getCanvas:()=>({width:256,height:256}),makeMaterial:map=>new THREE.MeshBasicMaterial({map})});
  assert.equal(canvases[0].width,1024);
  for(let materialIndex=0;materialIndex<2;materialIndex++)assert.deepEqual(canvases.slice(1+materialIndex*9,10+materialIndex*9).map(c=>c.width),[256,128,64,32,16,8,4,2,1]);
  assert.equal(material.extensions.derivatives,true);
  const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/dFdx\(uv\)/);assert.match(shader.fragmentShader,/terrainMip\(slot,repeatUV,high\)/);
  assert.equal(shader.uniforms.terrainCells.value.generateMipmaps,false,'material IDs must never interpolate');
  material.dispose();
 }finally{globalThis.OffscreenCanvas=original;}
});
