import test from 'node:test';
import assert from 'node:assert/strict';
import ScriptedActor,{preloadActorDefinitionAssets} from '../../src/entities/ScriptedActor.js';
import {createDefaultActor,ensureActorDefinition} from '../../src/content/actorEditorData.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {addAnimation} from '../../src/model3d/ModelRig.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';
import {modelSprites} from '../../src/model3d/ModelSprites.js';

test('actor model bindings persist and drive animation timing and side-view rendering',async()=>{
  const model=createModelDocument();addPrimitive(model,'box');const clip=addAnimation(model,'Walk',2);
  const definition=createDefaultActor();definition.states[0].animation.model={ref:'Actor Model',clip,speed:2,scale:[1,2,1]};
  const saved=ensureActorDefinition(JSON.parse(JSON.stringify(definition)));
  assert.deepEqual(saved.states[0].animation.model.scale,[1,2,1]);
  modelAssets.adopt('Actor Model',{data:model});
  const actor=new ScriptedActor(10,20,saved);assert.equal(actor.getStateAnimationDurationSeconds(),1);
  const previous=modelSprites.image;const image={width:64,height:64};let requested=null,drawn=null;
  modelSprites.image=(binding,time)=>{requested={binding,time};return image;};
  try{
    actor.stateTimer=0.75;actor.draw(new Proxy({drawImage:(...args)=>{drawn=args;}},{get:(o,k)=>k in o?o[k]:()=>{}}));
    assert.equal(requested.binding.ref,'Actor Model');assert.equal(requested.time,0.75);assert.equal(drawn[0],image);
    assert.equal(actor._lastFrameImage,null,'shared model canvas is never cached as a stale 2D frame');
  }finally{modelSprites.image=previous;modelAssets.entries.delete('Actor Model');}
});
test('actor asset preload includes model resources',async()=>{
  const definition=createDefaultActor();definition.states[0].animation.model={ref:'Preloaded Model'};
  const previous=modelAssets.prepare;const refs=[];modelAssets.prepare=async ref=>{refs.push(ref);return {};};
  try{await preloadActorDefinitionAssets(definition);assert.deepEqual(refs,['Preloaded Model']);}finally{modelAssets.prepare=previous;}
});
