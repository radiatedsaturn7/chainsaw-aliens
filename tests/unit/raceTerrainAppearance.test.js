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

test('canonical terrain triangles receive directional sun shading regardless of winding', () => {
  const editor = new RaceEditor({});
  editor.getRaceSunSettings = () => ({angleDeg: 90, intensity: 0.8});
  const slope = (height) => [{x:0,z:0,elevation:0},{x:10,z:0,elevation:height},{x:0,z:10,elevation:0}];
  const facing = slope(-10), away = slope(10);
  assert.ok(editor.getRaceTerrainSunShade(facing) > editor.getRaceTerrainSunShade(away));
  assert.equal(editor.getRaceTerrainSunShade(facing), editor.getRaceTerrainSunShade([...facing].reverse()));
  const packed = editor.packRaceThreeTerrainFromCanonicalMesh({triangles:[
    {terrainCell:{},vertices:facing}, {terrainCell:{},vertices:away}
  ]}, {useSunShading:true});
  assert.ok(packed.colors[0] > packed.colors[9]);
  assert.ok(packed.textureColors[0] > packed.textureColors[9]);
  editor.getRaceSunSettings = () => ({angleDeg: 90, intensity: 0});
  assert.equal(editor.getRaceTerrainSunShade(away), 1);
});

test('sun shading agrees for a quad and its triangles and ignores degenerate geometry', () => {
  const editor = new RaceEditor({});
  editor.getRaceSunSettings = () => ({angleDeg: 45, intensity: 0.8});
  const quad = [{x:0,z:0,elevation:0},{x:10,z:0,elevation:2},{x:10,z:10,elevation:4},{x:0,z:10,elevation:2}];
  assert.ok(Math.abs(editor.getRaceTerrainSunShade(quad) - editor.getRaceTerrainSunShade(quad.slice(0,3))) < 1e-10);
  assert.equal(editor.getRaceTerrainSunShade([quad[0],quad[0],quad[0]]), 1);
});

test('imported default-surface elevation cells retain the ground plane artwork through packing',()=>{
  const editor=new RaceEditor({});
  editor.selectedRace.groundPlaneArtRef='providenceGround';
  const tileMap={cellSizeM:40,defaultTileId:'grass',minElevation:-1000,maxElevation:1000,cells:{
    '0,0':{tileId:'grass',elevation:-50.263,tileWeights:{grass:1},artRef:'',source:'tile-editor'},
    '1,0':{tileId:'dirt',elevation:-50,artRef:''},
    '2,0':{tileId:'grass',elevation:2,artRef:'custom.png'},
    '3,0':{tileId:'grass',elevation:3,tileWeights:{grass:.5,dirt:.5}}
  }};
  const cells=[0,1,2,3,4].map(x=>editor.getRaceTileMapCell(x,0,tileMap));
  assert.deepEqual(cells.map(c=>c.artRef),['providenceGround','','custom.png','','providenceGround']);
  assert.equal(cells[0].elevation,-50.263,'height is preserved');
  const packed=editor.packRaceThreeTerrainFromCanonicalMesh({triangles:cells.map(triangle)},{tileMap,textured:true});
  assert.deepEqual(packed.artGroups,[{artRef:'providenceGround',start:0,count:3},{artRef:'custom.png',start:6,count:3},{artRef:'providenceGround',start:12,count:3}]);
  const renderer={scene:new THREE.Scene(),materialCache:new Map()};
  editor.getRaceThreeTexture=()=>new THREE.Texture();
  const geometry=editor.getRaceThreePackedTerrainGeometry(packed);
  assert.equal(editor.addRaceThreeTerrainArtwork(renderer,geometry,packed),2);
  assert.ok(renderer.scene.children.some(child=>child.name==='terrain-art:providenceGround'));
});

test('raw canonical default terrain also receives ground artwork but painted surfaces remain distinct',()=>{
 const editor=new RaceEditor({});editor.selectedRace.groundPlaneArtRef='providenceGround';
 const packed=editor.packRaceThreeTerrainFromCanonicalMesh({triangles:[triangle({tileId:'grass'}),triangle({tileId:'dirt'})]},{textured:true});
 assert.deepEqual(packed.artGroups,[{artRef:'providenceGround',start:0,count:3}]);
 assert.deepEqual(editor.packRaceThreeTerrainFromCanonicalMesh({triangles:[triangle({tileId:'grass'})]},{textured:false}).artGroups,[]);
});

test('packed terrain reuses material lookups while preserving per-triangle lighting and edits',()=>{
 const editor=new RaceEditor({});
 editor.getRaceSunSettings=()=>({angleDeg:90,intensity:.8});
 const tileCell={tileId:'dirt',artRef:'dirt-art'};
 const mesh={triangles:[-2,0,2].map(height=>({tileCell,terrainCell:{tileCell},vertices:[
  {x:0,z:0,elevation:0},{x:10,z:0,elevation:height},{x:0,z:10,elevation:0}
 ]}))};
 const palette=editor.getRaceWeightedGroundTilePalette(null,'dirt');
 const expected=mesh.triangles.map(t=>({
  color:editor.getRaceWebGLColorArray(editor.getRaceTerrainSunTint(t.vertices,palette.groundA)).slice(0,3),
  texture:editor.getRaceWebGLColorArray(editor.getRaceTextureSunTint(t.vertices)).slice(0,3)
 }));
 const original=editor.getRaceWeightedGroundTilePalette.bind(editor);let reads=0;
 editor.getRaceWeightedGroundTilePalette=(...args)=>{reads++;return original(...args);};
 const packed=editor.packRaceThreeTerrainFromCanonicalMesh(mesh,{useSunShading:true,textured:true});
 assert.equal(reads,1);
 for(let i=0;i<expected.length;i++)for(let vertex=0;vertex<3;vertex++){
  const offset=i*9+vertex*3;
  assert.deepEqual(packed.colors.slice(offset,offset+3),expected[i].color);
  assert.deepEqual(packed.textureColors.slice(offset,offset+3),expected[i].texture);
 }
 assert.deepEqual(packed.artGroups,[{artRef:'dirt-art',start:0,count:9}]);
 tileCell.artRef='edited-art';
 assert.equal(editor.packRaceThreeTerrainFromCanonicalMesh(mesh,{textured:true}).artGroups[0].artRef,'edited-art');
 assert.equal(reads,2);
});
