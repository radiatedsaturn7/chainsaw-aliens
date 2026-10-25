import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';
import { indexTrackStateCell, queryTrackStateCells } from '../../src/racing/trackState/TrackStateSpatialIndex.js';

test('bounded visual queries include negative coordinates and incrementally added/moved worker cells', () => {
  const cells = new Map([['a', {worldX:-16,worldZ:-1}], ['b',{x:100,z:100}]]);
  const bounds = {minX:-17,maxX:0,minZ:-2,maxZ:0};
  assert.deepEqual(queryTrackStateCells(cells,bounds), [cells.get('a')]);
  cells.set('c',{x:-1,z:-1}); indexTrackStateCell(cells,'c',cells.get('c'));
  cells.set('b',{x:-2,z:-1}); indexTrackStateCell(cells,'b',cells.get('b'));
  assert.equal(queryTrackStateCells(cells,bounds).length,3);
  cells.set('a',{x:100,z:100}); indexTrackStateCell(cells,'a',cells.get('a'));
  assert.equal(queryTrackStateCells(cells,bounds).length,2);
  assert.equal(queryTrackStateCells(new Map(),bounds).length,0);
});

test('warm visual query does not scan accumulated distant cells', () => {
  const cells = new Map(Array.from({length:30000}, (_,i)=>[String(i),{x:i*20,z:i*20}]));
  const bounds={minX:-1,maxX:1,minZ:-1,maxZ:1};
  queryTrackStateCells(cells,bounds);
  cells[Symbol.iterator] = cells.values = () => { throw Error('full scan'); };
  let reads=0; const get=cells.get.bind(cells); cells.get=key=>{reads++;return get(key);};
  assert.equal(queryTrackStateCells(cells,bounds).length,1);
  assert.equal(reads,1);
});

function editorFixture() {
  const editor=Object.create(RaceEditor.prototype);
  const visual={visualRevision:1,cells:new Map([['a',{x:0,z:0,rubber:0.4}]])};
  editor.playtestSession={vehicleDynamicsAuthorityThread:'worker',workerTrackStateVisual:visual};
  editor.game={deviceIsMobile:true};
  let now=0; let x=0;
  editor.getNowMs=()=>now;
  editor.getRaceSessionPlanarWorldPosition=()=>({x,z:0});
  return {editor,visual,time:value=>{now=value;},move:value=>{x=value;}};
}

test('surface appearance refresh is bounded but movement and reset are immediate', () => {
  const {editor,visual,time,move}=editorFixture();
  const first=editor.getRaceTrackStateVisualCells();
  visual.visualRevision++; time(50);
  assert.equal(editor.getRaceTrackStateVisualCells(),first);
  time(100); const second=editor.getRaceTrackStateVisualCells();
  assert.notEqual(second,first);
  visual.visualRevision++; move(8);
  assert.notEqual(editor.getRaceTrackStateVisualCells(),second);
  visual.cells=new Map();
  assert.deepEqual(editor.getRaceTrackStateVisualCells(),[]);
});

test('surface heights are reused and explicit invalidation resamples terrain', () => {
  const {editor,visual,time}=editorFixture();
  editor.getRaceRenderDebugSettings=()=>({overlaysEnabled:true});
  editor.getRaceThreeTireTrackMaterial=()=>new THREE.MeshBasicMaterial();
  let samples=0;
  editor.getRaceBakedSurfaceAtWorldPoint=()=>{samples++;return {elevation:0};};
  const renderer={scene:new THREE.Scene()};
  editor.syncRaceThreeTrackState(renderer);
  const initial=samples; assert.ok(initial>0);
  visual.visualRevision++;time(100); editor.syncRaceThreeTrackState(renderer);
  assert.equal(samples,initial);
  editor.invalidateRaceTrackStateVisualPresentation();editor.syncRaceThreeTrackState(renderer);
  assert.equal(samples,initial*2);
});

test('tire cap retires only expired entries and preserves spatial lookup membership', () => {
  const editor=Object.create(RaceEditor.prototype);
  editor.getRaceTireTrackStyle=()=>({}); editor.getRaceTireTrackQuad=()=>[];
  const session={};
  for(let i=0;i<24001;i++) editor.appendRaceTireTrackSegment({from:{x:i%200,z:i%43},to:{x:i%200+1,z:i%43}},session);
  assert.equal(session.tireTrackSegments.length,22977);
  assert.equal(session.tireTrackMinId,1025);
  const expected={};
  for(const entry of session.tireTrackSegments) {
    const key=editor.getRaceTireTrackCellKey((entry.from.x+entry.to.x)/2,entry.from.z);
    (expected[key] ||= []).push(entry.id);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(session.tireTrackGrid).map(([key,entries])=>[key,entries.map(e=>e.id)])),expected);
});
