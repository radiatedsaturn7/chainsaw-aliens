import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainBlendGrid,terrainBlendWeights,createTerrainBlendMaterial} from '../../src/racing/RaceTerrainTextureBlend.js';
import * as THREE from '../../src/vendorBridge/three.js';
import {installRaceLighting} from '../../src/racing/RaceLighting.js';
test('terrain paint blends across negative cells and four-way corners without changing data',()=>{
 const map={cellSizeM:40,cells:{'-1,-1':{artRef:'a'},'0,-1':{artRef:'b'},'-1,0':{artRef:'c'},'0,0':{artRef:'d'}}},before=JSON.stringify(map);
 const grid=terrainBlendGrid(map,c=>c.artRef);assert.deepEqual(grid.refs,['a','b','c','d']);assert.deepEqual([grid.minX,grid.minZ,grid.width,grid.height],[-1,-1,2,2]);
 assert.deepEqual([0,4,8,12].map(i=>grid.data[i]),[0,1,2,3]);
 assert.deepEqual(terrainBlendWeights(0,0,40),[.25,.25,.25,.25]);
 assert.deepEqual(terrainBlendWeights(20,20,40),[1,0,0,0]);
 for(let x=-50;x<50;x+=.25){const w=terrainBlendWeights(x,2,40);assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-10);assert.ok(w.every(n=>n>=0&&n<=1));}
 const left=terrainBlendWeights(-.001,0,40),right=terrainBlendWeights(.001,0,40);assert.ok(left.every((v,i)=>Math.abs(v-right[i])<.001));assert.equal(JSON.stringify(map),before);
});
test('terrain blend shader keeps world lighting and releases both GPU textures',()=>{
 const original=globalThis.OffscreenCanvas;globalThis.OffscreenCanvas=class{getContext(){return {drawImage(){}};}};
 try{
  const grid=terrainBlendGrid({cellSizeM:40,cells:{'0,0':{artRef:'a'},'1,0':{artRef:'b'}}},c=>c.artRef);
  const material=createTerrainBlendMaterial({THREE,grid,getCanvas:()=>({width:32,height:32}),makeMaterial:map=>new THREE.MeshBasicMaterial({map})});
  assert.equal(material.depthFunc,THREE.EqualDepth);assert.equal(material.depthWrite,false);
  installRaceLighting(material,{});
  const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/terrainSample/);assert.match(shader.fragmentShader,/rtgFog\(outgoingLight/);
  assert.ok(shader.fragmentShader.indexOf('#include <map_pars_fragment>')<shader.fragmentShader.indexOf('vec4 terrainSample'));
  let disposed=0;material.map.addEventListener('dispose',()=>disposed++);shader.uniforms.terrainCells.value.addEventListener('dispose',()=>disposed++);material.dispose();assert.equal(disposed,2);
 }finally{globalThis.OffscreenCanvas=original;}
});
