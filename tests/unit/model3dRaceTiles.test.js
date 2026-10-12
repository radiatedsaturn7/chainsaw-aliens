import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {ModelAssetLibrary} from '../../src/model3d/ModelAssets.js';
import {syncRaceModelTiles,clearRaceModelTiles} from '../../src/model3d/RaceModelTiles.js';

test('Race model tile instances share geometry, cache placement and release resources',()=>{
  const doc=createModelDocument();addPrimitive(doc,'box');
  const library=new ModelAssetLibrary({load:()=>null,hydrate:async()=>null});library.adopt('Tile',{data:doc});
  const renderer={scene:new THREE.Scene()},binding={ref:'Tile'};
  const placements=[{key:'0,0',position:[2.5,0,2.5],size:5,binding},{key:'1,0',position:[7.5,1,2.5],size:5,binding}];
  assert.equal(syncRaceModelTiles(renderer,placements,0,{library}),true);
  const group=renderer.modelTileGroup,mesh=group.children[0];assert.ok(mesh.isInstancedMesh);assert.equal(mesh.count,2);
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(1,matrix);assert.equal(matrix.elements[12],7.5);
  syncRaceModelTiles(renderer,placements,1,{library});assert.equal(renderer.modelTileGroup,group);
  const source=group.userData.sources[0];clearRaceModelTiles(renderer);assert.equal(source.root,null);assert.equal(renderer.modelTileGroup,null);
});
test('Race saves inherited tile models independently from the active Level and retains explicit opt-outs',()=>{
  const e=new RaceEditor({world:{tileDefinitions:{all:[{id:'solid',label:'Solid',model:{ref:'Tile'}}]}}});
  e.setRaceTileMapCell(0,0,{tileId:'solid',tileWeights:{solid:1}});
  const saved=e.serializeSelectedRaceDocument();assert.equal(saved.race.road.tileMap.models.solid.ref,'Tile');
  e.game.world.tileDefinitions.all=[];
  const loaded=e.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(saved)));e.ensureRaceTileMap(loaded.road);
  assert.equal(loaded.road.tileMap.models.solid.ref,'Tile');
  e.ensureRaceTileMap().models.solid=null;assert.equal(e.serializeSelectedRaceDocument().race.road.tileMap.models.solid,null);
});

test('races without model tiles do not scan terrain or sample surfaces for model rendering',()=>{
  const e=new RaceEditor({}),renderer={scene:new THREE.Scene()};
  e.getRaceTileMapEntries=()=>{throw Error('ordinary races must not scan model placements');};
  assert.equal(e.syncRaceTileModels(renderer,{x:0,z:0}),false);
});
