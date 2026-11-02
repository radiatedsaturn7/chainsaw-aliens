import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
const ids=['fl','fr','rl','rr'];
test('visible authoritative wheels do not rebuild tuning or sample terrain',()=>{
 const editor=new RaceEditor({});
 editor.getRaceCarTuning=()=>{throw Error('unnecessary tuning rebuild');};
 editor.getRaceCompositedSurfaceAtWorldPoint=()=>{throw Error('unnecessary terrain query');};
 const session={vehicleRenderState:{wheelPoses:Object.fromEntries(ids.map((id,i)=>[id,{position:{x:i,y:12,z:2},loadBearing:true}]))}};
 for(let frame=0;frame<60;frame++)for(let car=0;car<29;car++){
 const centers=editor.getRaceWheelVisualCenterPositions({session,car:editor.selectedCar});
 assert.equal(centers.fl.elevation,1);assert.equal(centers.rr.x,3);
 }
});
test('visible shadow uses prepared road support at car height, with legacy fallback for unavailable data',()=>{
 const editor=new RaceEditor({});editor.playtestSession={worldBake:{surfaceSampler:{}},routeLength:100,routeRuntimeType:'destination'};
 let full=0;let query;
 editor.getRaceCompositedSurfaceAtWorldPoint=()=>{full++;return {elevation:3};};
 editor.getRaceSurfaceModel=()=>({samplePhysicsGeometry:p=>{query=p;return {valid:true,elevation:2};}});
 assert.equal(editor.getRaceVehicleGroundSurfacePoint({x:1,z:2,fallbackElevation:2}).elevation,2);
 assert.equal(query.heightM,24);assert.equal(full,0);
 editor.getRaceSurfaceModel=()=>({samplePhysicsGeometry:()=>({valid:false})});
 assert.equal(editor.getRaceVehicleGroundSurfacePoint({x:1,z:2}).elevation,3);assert.equal(full,1);
});
