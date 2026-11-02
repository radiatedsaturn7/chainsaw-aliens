import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {buildTrackStateGroundGeometry,iterateTrackStateGroundGeometry} from '../../src/racing/trackState/TrackStateGroundMesh.js';
import {prepareRaceAiWheelKinematics} from '../../src/racing/RaceAiSimulation.js';
import {calculateWheelContactKinematics} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
const options={maximumCells:320,centerX:0,centerZ:0,minimumIntensity:.025};
function track(){
 const s=new TrackState({sampleBaseSurface:()=>({baseSurfaceId:'asphalt',friction:1})});
 for(let x=-20;x<=20;x++)for(let z=-20;z<=20;z++)s.mutateCell({x,z},{rubber:(x+z)%3 ? .7:0});
 return s;
}
function close(a,b,path=''){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11,`${path}: ${a} != ${b}`);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
  for(const k of Object.keys(a))close(a[k],b[k],`${path}.${k}`);return;
 }
 assert.deepEqual(a,b,path);
}
test('incremental visual query matches synchronous selection without altering physics cells',()=>{
 const s=track(),before=s.getChecksum();
 const expected=s.getVisualCells(bounds,options),job=s.iterateVisualCells(bounds,options);
 let result=job.next(),slices=0;
 assert.equal(result.done,false);
 while(!result.done){
  // Independent atlas/debug work must not corrupt the suspended iterator.
  s.getVisualCells(bounds,{maximumCells:3,centerX:20,centerZ:20});
  result=job.next();slices++;
 }
 assert.ok(slices>=10);assert.deepEqual(result.value,expected);assert.equal(s.getChecksum(),before);
});
test('incremental geometry bounds height work to 32 cells per slice and matches complete mesh',()=>{
 const cells=track().getVisualCells(bounds,options);let sampled=0;
 const height=(x,z)=>Math.sin(x)*.3+z*.1;
 const job=iterateTrackStateGroundGeometry(cells,(x,z)=>{sampled++;return height(x,z);});
 let result;do{const previous=sampled;result=job.next();assert.ok(sampled-previous<=160);}while(!result.done);
 const expected=buildTrackStateGroundGeometry(cells,height),actual=result.value;
 for(const key of ['position','color'])assert.deepEqual(actual.getAttribute(key).array,expected.getAttribute(key).array);
 assert.deepEqual(actual.drawRange,expected.drawRange);assert.deepEqual(actual.boundingSphere,expected.boundingSphere);
});
test('renderer keeps the old weather mesh intact until the replacement completes',()=>{
 const editor=Object.create(RaceEditor.prototype);let cells=track().getVisualCells(bounds,options);
 editor.playtestSession={};editor.getRaceTrackStateVisualCells=()=>cells;
 editor.getRaceRenderDebugSettings=()=>({overlaysEnabled:true});editor.getNowMs=()=>0;
 editor.getRaceBakedSurfaceAtWorldPoint=()=>({elevation:0});
 editor.getRaceThreeTireTrackMaterial=()=>new THREE.MeshBasicMaterial();
 const renderer={scene:new THREE.Scene()};
 for(let i=0;i<10&&!renderer.trackStateMesh;i++)editor.syncRaceThreeTrackState(renderer);
 const previous=renderer.trackStateMesh.geometry;
 const colors=previous.getAttribute('color').array.slice();
 cells=cells.map(c=>({...c,rubber:0,snow:1}));
 editor.syncRaceThreeTrackState(renderer);
 assert.equal(renderer.trackStateMesh.geometry,previous);
 assert.deepEqual(previous.getAttribute('color').array,colors);
 for(let i=0;i<10&&renderer.trackStateBuild;i++)editor.syncRaceThreeTrackState(renderer);
 assert.notEqual(renderer.trackStateMesh.geometry,previous);
 assert.equal(renderer.trackStateSpareGeometry,previous);
 assert.equal(renderer.trackStateCells,cells);
});
test('AI wheel scratch matches legacy kinematics across changing roll, steering and suspension',()=>{
 const runner=new VehicleDynamicsRunner({config:{telemetryRetention:'none'}}),ai={};
 let storage;
 for(let i=0;i<20;i++){
  const state=runner.state;state.orientation=quaternionFromEuler(i*.14,i*.1,-i*.08);
  state.position.x=i;state.velocity.z=i*2;
  const controls={steering:Math.sin(i),throttle:.4};
  const result=prepareRaceAiWheelKinematics(ai,state,controls,runner.config);
  if(storage)assert.equal(result,storage);storage=result;
  for(const wheelId of ['fl','fr','rl','rr']){
   const expected=calculateWheelContactKinematics({state,controls,config:runner.config,environment:{},wheelId});
   close(result.patches[wheelId],expected,wheelId);
  }
 }
 const other=prepareRaceAiWheelKinematics({},runner.state,{},runner.config);
 assert.notEqual(other.wheels.fl.target,storage.wheels.fl.target);
});

test('editor advances pending visual work despite revisions and clears it on invalidation',()=>{
 const editor=Object.create(RaceEditor.prototype),s=track();
 editor.playtestSession={trackState:s};editor.game={deviceIsMobile:true};
 let now=0;editor.getNowMs=()=>now;
 editor.getRaceSessionPlanarWorldPosition=()=>({x:0,z:0});
 assert.deepEqual(editor.getRaceTrackStateVisualCells(),[]);
 assert.ok(editor.playtestSession.trackStateVisualJob);
 let cells=[];
 for(let i=0;i<20&&!cells.length;i++){
  now+=16;s.visualRevision++;
  cells=editor.getRaceTrackStateVisualCells();
 }
 assert.equal(cells.length,320);
 assert.equal(editor.playtestSession.trackStateVisualJob,null);
 now+=101;s.visualRevision++;
 assert.equal(editor.getRaceTrackStateVisualCells(),cells);
 assert.ok(editor.playtestSession.trackStateVisualJob);
 editor.invalidateRaceTrackStateVisualPresentation();
 assert.equal(editor.playtestSession.trackStateVisualJob,null);
 assert.equal(editor.playtestSession.trackStateVisualCache,null);
 editor.getRaceTrackStateVisualCells();s.cells.clear();
 assert.deepEqual(editor.getRaceTrackStateVisualCells(),[]);
 assert.equal(editor.playtestSession.trackStateVisualJob,null);
});

test('new cell insertion keeps numeric coordinate order across negatives and digit boundaries',()=>{
 const s=new TrackState();
 for(const [x,z] of [[10,1],[-2,12],[2,-10],[-10,2],[2,-2],[0,0],[-2,-10]])s.getOrCreateCell({x,z},{coordinates:true});
 assert.deepEqual(s.orderedCellKeys,['-10,2','-2,-10','-2,12','0,0','2,-10','2,-2','10,1']);
});
