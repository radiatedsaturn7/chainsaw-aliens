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

test('a Studio fallback remains visible during a throttled retry and is replaced on success',async()=>{
 const {studioRoster}=await import('../../src/model3d/studio-roster/index.js');
 const {bodyRef,label}=studioRoster[0];
 let now=0,requests=0;
 const stock=createModelDocument();stock.name='Stock body';
 const upgraded=structuredClone(stock);upgraded.name=label+' · Studio body';
 const library=new ModelAssetLibrary({load:()=>stock,hydrate:async()=>null,
  bundled:async()=>++requests===1?null:upgraded,studioRetryMs:30000,now:()=>now});
 assert.equal((await library.prepare(bodyRef)).name,'Stock body');
 now=29999;
 for(let i=0;i<100;i++)assert.equal(library.get(bodyRef).name,'Stock body');
 assert.equal(requests,1);
 now=30000;
 assert.equal(library.get(bodyRef).name,'Stock body');
 const loaded=await library.prepare(bodyRef);
 assert.equal(requests,2);
 assert.equal(loaded.name,upgraded.name);
 assert.equal(library.get(bodyRef),loaded);
});

test('Studio pairs are capped without evicting normal editor models or reloading live scenes',async()=>{
 const {studioRoster}=await import('../../src/model3d/studio-roster/index.js');
 const {STUDIO_ROSTER_CACHE_PAIRS}=await import('../../src/model3d/StudioRosterModels.js');
 let requests=0;
 const make=ref=>Object.assign(createModelDocument(),{name:ref});
 const library=new ModelAssetLibrary({load:()=>null,hydrate:async()=>null,bundled:async ref=>{requests++;return make(ref);}});
 const normal=library.adopt('An unrelated prop',make('prop'));
 const studies=studioRoster.slice(0,STUDIO_ROSTER_CACHE_PAIRS+3);
 const original=await library.prepare(studies[0].bodyRef);
 const originalRevision=library.entries.get(studies[0].bodyRef).revision;
 for(const {bodyRef,wheelRef} of studies)await Promise.all([library.prepare(bodyRef),library.prepare(wheelRef)]);
 assert.equal(library.entries.size,STUDIO_ROSTER_CACHE_PAIRS*2+1);
 assert.equal(library.entries.has(studies[0].bodyRef),false);
 const before=requests;
 assert.equal(library.get(studies[0].bodyRef),original);
 assert.equal(library.entries.get(studies[0].bodyRef).revision,originalRevision);
 assert.equal(requests,before);
 assert.equal(library.get('An unrelated prop'),normal);
});
