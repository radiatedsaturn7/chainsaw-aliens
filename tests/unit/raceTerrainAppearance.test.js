import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';
import { buildRaceNetworkWorld } from '../../src/racing/RaceNetworkWorld.js';
import { normalizeRaceRouteNetwork } from '../../src/racing/RaceRouteNetwork.js';

function triangle(tileCell) {
  return {terrainCell:{tileCell},tileCell,vertices:[{x:20,z:20},{x:25,z:20},{x:25,z:25}]};
}

test('enabled textures keep grass and dirt colors when artwork is absent', () => {
  const editor=new RaceEditor({});
  for (const tileId of ['grass','dirt']) {
    const packed=editor.packRaceThreeTerrainFromCanonicalMesh({triangles:[triangle({tileId})]},{textured:true});
    const expected=editor.getRaceWebGLColorArray(editor.getRaceWeightedGroundTilePalette(null,tileId).groundA);
    assert.deepEqual(Array.from(packed.colors.slice(0,3)),Array.from(new Float32Array(expected.slice(0,3))));
    assert.notDeepEqual(Array.from(packed.colors.slice(0,3)),[1,1,1]);
    assert.deepEqual(packed.artGroups,[]);
  }
});

test('tile art overlays only its painted triangles with untinted colors and transparent backing', () => {
  const editor=new RaceEditor({});
  const mesh={triangles:[triangle({tileId:'grass'}),triangle({tileId:'dirt',artRef:'tile.png'})]};
  const packed=editor.packRaceThreeTerrainFromCanonicalMesh(mesh,{textured:true});
  assert.deepEqual(packed.artGroups,[{artRef:'tile.png',start:3,count:3}]);
  const geometry=editor.getRaceThreePackedTerrainGeometry(packed);
  const renderer={scene:new THREE.Scene(),materialCache:new Map()};
  editor.getRaceThreeTexture=()=>null;
  assert.equal(editor.addRaceThreeTerrainArtwork(renderer,geometry,packed),0);
  const texture=new THREE.Texture();
  editor.getRaceThreeTexture=()=>texture;
  assert.equal(editor.addRaceThreeTerrainArtwork(renderer,geometry,packed),1);
  const overlay=renderer.scene.children[0];
  assert.equal(overlay.geometry.getAttribute('position').count,3);
  assert.deepEqual(Array.from(overlay.geometry.getAttribute('color').array),Array(9).fill(1));
  assert.equal(overlay.material.transparent,true);
  assert.equal(overlay.material.depthWrite,false);
  assert.equal(overlay.material.map,texture);
  assert.deepEqual(editor.packRaceThreeTerrainFromCanonicalMesh(mesh,{textured:false}).artGroups,[]);
});

test('large network terrain preserves the exact five-meter painted cell', () => {
  const network=normalizeRaceRouteNetwork({nodes:[{id:'a',x:0,z:0},{id:'b',x:0,z:1500}],edges:[{id:'road',from:'a',to:'b'}],startNodeId:'a'});
  const world=buildRaceNetworkWorld(network,{buildSurfaceSampler:false,paintedCells:[{x:22.5,z:22.5}],tileAt:({x,z})=>({tileId:x>=20&&x<25&&z>=20&&z<25?'dirt':'grass'})});
  const dirt=world.terrainCells.filter(c=>c.tileCell.tileId==='dirt');
  assert.equal(dirt.length,1);
  assert.deepEqual(dirt[0].points.map(({x,z})=>[x,z]),[[20,20],[25,20],[25,25],[20,25]]);
});
