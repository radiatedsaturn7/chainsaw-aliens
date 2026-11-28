import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from '../../src/vendorBridge/three.js';
import {buildModelObject,ModelCanvasRenderer} from '../../src/model3d/ModelRender.js';

const body = () => JSON.parse(gunzipSync(readFileSync(new URL('../../src/model3d/wrx/fit10-body.pack',import.meta.url))));
const paintOf = root => root.children.find(mesh=>mesh.material.name==='Coachwork paint');
function drawFixture(options) {
  const renderer=new ModelCanvasRenderer(options);
  renderer.scene=new THREE.Scene();
  renderer.renderer={capabilities:{isWebGL2:true},extensions:{has:()=>true},setSize(){},render(){}};
  return {renderer,draw: (model,mode={})=>renderer.draw({drawImage(){}},{x:0,y:0,w:400,h:260},model,mode)};
}
test('Object Editor opens the exact Fit 10 authored paint, optical surfaces and bind normals',()=>{
  const model=body();
  const {renderer,draw}=drawFixture({authoredVehiclePreview:true});
  draw(model,{pose:{},grid:true});
  const actual=paintOf(renderer.root);
  const expected=paintOf(buildModelObject(model,{automotive:true}));
  assert.equal(actual.material.type,'MeshPhysicalMaterial');
  assert.equal(actual.material.roughness,expected.material.roughness);
  assert.equal(actual.material.clearcoat,expected.material.clearcoat);
  assert.equal(actual.material.clearcoatRoughness,expected.material.clearcoatRoughness);
  assert.equal(actual.material.envMap.name,'automotive studio');
  assert.deepEqual(actual.geometry.attributes.normal.array,expected.geometry.attributes.normal.array);
  const lens=renderer.root.children.find(mesh=>mesh.material.name==='Clear optical cover').material;
  assert.equal(lens.transparent,true);
  assert.equal(lens.depthWrite,false);
  assert.ok(renderer.grid.visible);
  draw(model,{wireframe:true,pose:{[model.joints[0].id]:{position:[1,0,0]}}});
  assert.equal(actual.material.wireframe,true);
  draw(model,{pose:{}});
  assert.equal(actual.material.wireframe,false);
  assert.deepEqual(actual.geometry.attributes.normal.array,expected.geometry.attributes.normal.array);
});
test('generic model preview callers and untagged Object Editor documents keep legacy shading',()=>{
  const model=body();
  const generic=drawFixture();
  generic.draw(model);
  assert.equal(paintOf(generic.renderer.root).material.roughness,.8);
  assert.equal(paintOf(generic.renderer.root).material.envMap,null);
  const untagged=body();
  for(const material of untagged.materials)delete material.automotive;
  const editor=drawFixture({authoredVehiclePreview:true});
  editor.draw(untagged);
  assert.equal(paintOf(editor.renderer.root).material.type,'MeshStandardMaterial');
  assert.equal(paintOf(editor.renderer.root).material.envMap,null);
});
