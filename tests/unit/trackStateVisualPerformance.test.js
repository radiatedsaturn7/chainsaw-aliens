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

test('limited nearest visual selection matches full-query filtering without sampling the discarded wet cells',async()=>{
 const {TrackState}=await import('../../src/racing/trackState/TrackState.js');
 const track=new TrackState({sampleBaseSurface:()=>({baseSurfaceId:'asphalt',friction:1})});
 for(let x=-30;x<30;x++)for(let z=-30;z<30;z++)track.mutateCell({x,z},{rubber:.4});
 const bounds={minX:-95,maxX:95,minZ:-95,maxZ:95},cx=1.2,cz=-2.4;
 const before=track.getChecksum();
 const expected=track.getVisualCells(bounds).filter(c=>c.rubber>=.025)
  .sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz)).slice(0,320);
 let reads=0;
 for(const cell of track.cells.values()){
  const value=cell.baseGrip;
  Object.defineProperty(cell,'baseGrip',{configurable:true,enumerable:true,get(){reads++;return value;}});
 }
 const actual=track.getVisualCells(bounds,{maximumCells:320,centerX:cx,centerZ:cz,minimumIntensity:.025});
 assert.deepEqual(actual,expected);assert.equal(reads,320);
 assert.equal(track.getChecksum(),before);
});

test('dry cells do not consume visible limit and returned samples own their values',async()=>{
 const {TrackState}=await import('../../src/racing/trackState/TrackState.js');
 const t=new TrackState({sampleBaseSurface:()=>({baseSurfaceId:'asphalt',friction:1})});
 for(let x=0;x<20;x++)t.mutateCell({x,z:0},{rubber:x<10?0:.5});
 const cells=t.getVisualCells(null,{maximumCells:3,minimumIntensity:.025});
 assert.equal(cells.length,3);assert.ok(cells.every(c=>c.x>=10));
 cells[0].rubber=.9;assert.equal(cells[1].rubber,.5);assert.equal(t.cells.get(cells[0].key).rubber,.5);
});

test('weather mesh reuses buffers and updates draw count and bounds when moving or shrinking',async()=>{
 const {buildTrackStateGroundGeometry:build}=await import('../../src/racing/trackState/TrackStateGroundMesh.js');
 const cells=[{x:100,z:200,rubber:.4},{x:101,z:201,standingWater:.8}];
 const geometry=build(cells,()=>2),position=geometry.getAttribute('position'),color=geometry.getAttribute('color');
 const copy=Array.from(position.array);let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 assert.equal(build(cells,()=>2,geometry),geometry);assert.equal(geometry.getAttribute('position'),position);
 assert.equal(geometry.getAttribute('color'),color);assert.deepEqual(Array.from(position.array),copy);assert.equal(disposed,0);
 build([{x:300,z:400,snow:.5}],()=>3,geometry);
 assert.equal(geometry.drawRange.count,12);assert.equal(geometry.boundingSphere.center.x,300);
 assert.equal(geometry.boundingSphere.center.z,400);assert.ok(geometry.boundingSphere.radius<1);
 build([],()=>0,geometry);assert.equal(geometry.drawRange.count,0);
 const larger=[...cells,{x:102,z:202,rubber:.2}];
 assert.equal(build(larger,()=>2,geometry),geometry);
 assert.equal(disposed,1);assert.notEqual(geometry.getAttribute('position'),position);
 assert.equal(geometry.drawRange.count,36);
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),Array.from(build(larger,()=>2).getAttribute('position').array));
 build(larger,()=>2,geometry);assert.equal(disposed,1);
});

test('visual scratch reuses capacity without aliasing returned queries or other tracks',async()=>{
 const {TrackState}=await import('../../src/racing/trackState/TrackState.js');
 const track=new TrackState();
 for(let x=0;x<30;x++)track.mutateCell({x,z:0},{rubber:.5});
 const options={maximumCells:8,minimumIntensity:.025};
 const first=track.getVisualCells(null,options),saved=structuredClone(first);
 const scratch=track.visualQueryScratch,distances=scratch.distances,candidates=scratch.candidates;
 const second=track.getVisualCells({minX:20,maxX:29,minZ:0,maxZ:1},{...options,centerX:25});
 assert.equal(track.visualQueryScratch,scratch);
 assert.equal(scratch.distances,distances);assert.equal(scratch.candidates,candidates);
 assert.deepEqual(first,saved);assert.notDeepEqual(second,first);
 assert.deepEqual(track.getVisualCells({minX:100,maxX:110,minZ:0,maxZ:1},options),[]);
 const other=new TrackState();other.getVisualCells(null,options);
 assert.notEqual(other.visualQueryScratch,scratch);
});
