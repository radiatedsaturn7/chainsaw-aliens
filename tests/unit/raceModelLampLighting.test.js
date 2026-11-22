import test from 'node:test';
import assert from 'node:assert/strict';
import {rallyLightPose, rearLightPose, updateRaceLighting} from '../../src/racing/RaceLighting.js';

test('race world lighting uses native mount positions and directions, then restores sprite defaults', () => {
  const renderer={scene:{traverse(){}}},pose={x:3,y:.4,z:-7,yaw:.9},dimensions={width:1.83,length:4.67};
  const front={left:{x:1,y:2,z:3},right:{x:4,y:5,z:6},forward:{x:1,y:0,z:0},up:{x:0,y:1,z:0}};
  const rear={left:{x:7,y:8,z:9},right:{x:10,y:11,z:12}};
  const settings={pose,dimensions,headlightIntensity:1,braking:true,night:true,brightness:.05};
  const uniforms=updateRaceLighting(renderer,{...settings,mountedLamps:{front,rear}});
  assert.deepEqual(uniforms.rtgLampLeft.value,front.left);
  assert.deepEqual(uniforms.rtgLampRight.value,front.right);
  assert.deepEqual(uniforms.rtgLampForward.value,front.forward);
  assert.deepEqual(uniforms.rtgLampUp.value,front.up);
  assert.deepEqual(uniforms.rtgRearLeft.value,rear.left);
  assert.deepEqual(uniforms.rtgRearRight.value,rear.right);
  updateRaceLighting(renderer,{...settings,mountedLamps:{rear}});
  assert.deepEqual(uniforms.rtgLampLeft.value,rallyLightPose(pose,dimensions).left);
  assert.deepEqual(uniforms.rtgRearLeft.value,rear.left);
  updateRaceLighting(renderer,settings);
  assert.deepEqual(uniforms.rtgRearLeft.value,rearLightPose(pose,dimensions).left);
});
