import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('AI render pose fallbacks match the former copied-session call without copying AI state',()=>{
 const editor=Object.create(RaceEditor.prototype);
 editor.raceInput={steeringWheel:.25};
 editor.getRacePhysicalTireAngleForSteering=()=>.17;
 const car={id:'test'},fallback={x:12,z:34,yaw:.7};
 for(const canonical of [undefined,{position:{x:3,y:4,z:5},yawRad:.2,wheels:{fl:{steeringAngleRad:.4}}}])
 for(const tireSlip of [undefined,null,{},{frontTireAngle:.3},{frontTireAngle:NaN}])
 for(const carYaw of [undefined,null,.5]){
  const ai={vehicleRenderState:canonical,tireSlip,carYaw,bodyY:1.4,speedMps:15,worldX:NaN,worldZ:NaN,pitchRad:.1,rollRad:.2};
  const saved=structuredClone(ai);
  const previous=editor.getRacePlayerRenderPose({...ai,worldX:12,worldZ:34,carYaw:carYaw??.7,tireSlip:tireSlip||{frontTireAngle:0}},car,{fallbackElevation:2});
  const current=editor.getRacePlayerRenderPose(ai,car,{fallbackElevation:2,fallbackPose:fallback});
  for(const key of ['x','z','elevation','yaw','pitchRad','rollRad','frontTireAngle','car'])assert.equal(current[key],previous[key],key);
  assert.equal(current.session,ai,'renderer retains the actual session rather than a shallow copy');
  assert.deepEqual(ai,saved);
 }
});
