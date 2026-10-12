import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelAssetLibrary,ModelAssetInstance,normalizeModelBinding} from '../../src/model3d/ModelAssets.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {addJoint,assignVerticesToJoint,addAnimation,setKeyframe} from '../../src/model3d/ModelRig.js';

test('model library shares in-flight loads and adopts updated saved documents',async()=>{
  let loads=0,local=null;const model=createModelDocument();addPrimitive(model,'box');
  const library=new ModelAssetLibrary({load:()=>local,hydrate:async()=>{loads++;return {data:model};}});
  const a=library.prepare('Box'),b=library.prepare('Box');assert.equal(a,b);
  const loaded=await a;assert.equal(loads,1);assert.equal(library.get('Box'),loaded);
  local={data:structuredClone(model)};local.data.vertices[0].position[0]+=3;
  const next=library.get('Box');assert.notEqual(next,loaded);assert.equal(library.get('Box'),next);
  assert.notDeepEqual(next.vertices[0].position,loaded.vertices[0].position);
});
test('model library reports missing files and explicit preparation retries',async()=>{
  let available=false;const library=new ModelAssetLibrary({load:()=>null,hydrate:async()=>available?{data:createModelDocument()}:null});
  await assert.rejects(library.prepare('Missing'),/not found/);assert.equal(library.get('Missing'),null);
  available=true;assert.ok(await library.prepare('Missing'));assert.equal(library.errors.size,0);
});
test('model instances animate independently and preserve placement transforms',()=>{
  const model=createModelDocument();addPrimitive(model,'box');const joint=addJoint(model,[0,0,0]);
  assignVerticesToJoint(model,model.vertices.map(v=>v.id),joint);
  const clip=addAnimation(model,'Move',2);setKeyframe(model,clip,joint,0,{position:[0,0,0]});setKeyframe(model,clip,joint,2,{position:[2,0,0]});
  const a=new ModelAssetInstance(),b=new ModelAssetInstance();
  a.setModel(model,{ref:'Box',clip,position:[2,3,4],scale:[2,2,2]});b.setModel(model,{ref:'Box',clip});
  a.update(1);
  const pa=a.root.children[0].geometry.getAttribute('position'),pb=b.root.children[0].geometry.getAttribute('position');
  assert.equal(pa.getX(0)-pb.getX(0),1);assert.deepEqual(a.root.position.toArray(),[2,3,4]);
  assert.deepEqual(a.root.scale.toArray(),[2,2,2]);assert.notEqual(a.root.children[0].material,b.root.children[0].material);
  a.dispose();b.dispose();assert.equal(a.object.children.length,0);
  assert.deepEqual(normalizeModelBinding('Box').scale,[1,1,1]);
});
