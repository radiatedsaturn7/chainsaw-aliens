import test from 'node:test';
import assert from 'node:assert/strict';
import World from '../../src/world/World.js';
const previousWindow=globalThis.window;globalThis.window={location:{search:''}};
const {default:GameCore}=await import('../../src/game/GameCore.js');
globalThis.window=previousWindow;
import {serializeTileProperties} from '../../src/content/tileDefinitions.js';
import {modelSprites,ModelSpriteRenderer} from '../../src/model3d/ModelSprites.js';

function makeWorld(){const world=new World();world.applyData({tileSize:32,width:2,height:1,spawn:{x:0,y:0},tiles:['##'],pixelArt:{tileProperties:{solid:serializeTileProperties({solid:true,model:{ref:'Tile Model',scale:[2,2,2]}})}},decals:[{id:'model-scenery',model:{ref:'Scenery'},x:0,y:0,w:64,h:32,rotation:15}]});return world;}
test('level model bindings survive serialization while tiles retain collision behavior',()=>{
  const world=makeWorld();assert.equal(world.isSolid(0,0,{}),true);
  const loaded=new World();loaded.applyData(JSON.parse(JSON.stringify(world.data)));
  assert.equal(loaded.getTilePropertiesByChar('#').model.ref,'Tile Model');assert.equal(loaded.decals[0].model.ref,'Scenery');
});
test('Level full and fast-editor requests draw model tiles and scenery through the same pipeline',()=>{
  const game=Object.create(GameCore.prototype);game.world=makeWorld();game.worldTime=1;game.camera={x:0,y:0,width:64,height:32};game.abilities={};game.getIgnitirTint=()=>0;game.decalImageCache=new Map();
  const previous=modelSprites.snapshot;const requested=[],drawn=[];modelSprites.snapshot=(binding)=>{requested.push(binding.ref);return {ref:binding.ref};};
  const ctx=new Proxy({drawImage:(image)=>drawn.push(image.ref)},{get:(o,k)=>k in o?o[k]:()=>{}});
  try{
    game.drawWorld(ctx);assert.deepEqual(drawn,['Tile Model','Tile Model','Scenery']);
    drawn.length=0;game.drawWorld(ctx,{cameraOverride:{...game.camera,fastEditorRender:true}});assert.deepEqual(drawn,['Tile Model','Tile Model','Scenery']);
  }finally{modelSprites.snapshot=previous;}
});
test('sprite snapshots reuse static tiles and isolate the shared render canvas',()=>{
  const previous=globalThis.document;let copies=0,renders=0;const model={};
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){copies++;}})})};
  try{
    const renderer=new ModelSpriteRenderer({library:{get:()=>model},renderer:{dispose(){}}});
    renderer.image=()=>{renders++;return {width:32,height:32};};
    const first=renderer.snapshot({ref:'Tile'},1,{width:32,height:32});
    assert.equal(renderer.snapshot({ref:'Tile'},2,{width:32,height:32}),first);assert.equal(renders,1);assert.equal(copies,1);
    assert.notEqual(renderer.snapshot({ref:'Other'},2,{width:32,height:32}),first);
  }finally{globalThis.document=previous;}
});
