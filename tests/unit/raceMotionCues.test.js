import test from 'node:test';
import assert from 'node:assert/strict';
import {roadCameraCue,roadsidePassMix} from '../../src/racing/RaceMotionCues.js';
import {prepareManagedRaceScenery,getManagedRaceScenery} from '../../src/racing/RaceVisibleScenery.js';
import {RoadMotionSound} from '../../src/audio/RoadMotionSound.js';

test('camera cue responds to real chassis motion, remains bounded, resets and stays still on smooth road',()=>{
 const s={running:true,speedMps:40,elapsedMs:0,verticalVelocityMps:0};
 assert.equal(roadCameraCue(s),0);
 for(let i=1;i<100;i++){s.elapsedMs=i*16;assert.equal(roadCameraCue(s),0);}
 s.pitchRate=.4;s.elapsedMs+=16;assert.ok(roadCameraCue(s)>0);
 for(let i=0;i<100;i++){s.elapsedMs+=16;s.verticalVelocityMps=i%2?20:-20;assert.ok(Math.abs(roadCameraCue(s))<=.005);}
 const before=roadCameraCue(s);assert.equal(roadCameraCue(s),before,'rendering twice does not integrate twice');
 s.running=false;assert.equal(roadCameraCue(s),0);
 s.running=true;s.elapsedMs+=10000;assert.equal(roadCameraCue(s),0,'teleport or resume does not kick camera');
 s.airborne=true;s.elapsedMs+=16;assert.equal(roadCameraCue(s),0);
});

test('passing cues use nearby standing objects, correct side, speed and destruction',()=>{
 const s={running:true,groundSpeedMps:40,worldX:0,worldZ:0,carYaw:0,elapsedMs:0};
 const items=[{id:'tree',doodadRef:'oak-tree',x:-4,z:0,widthM:2},{id:'grass',doodadRef:'expanded-grass-clump',x:2,z:0},{id:'far',doodadRef:'sign',x:50,z:0}];
 let managed=prepareManagedRaceScenery(items,s),mix=roadsidePassMix(managed,s);
 assert.ok(mix.left>0);assert.equal(mix.right,0);
 s.worldZ=20;s.elapsedMs+=50;assert.equal(roadsidePassMix(managed,s).left,0);
 s.worldZ=0;s.groundSpeedMps=0;s.elapsedMs+=50;assert.equal(roadsidePassMix(managed,s).left,0);
 s.groundSpeedMps=40;s.removedSceneryIds=['tree'];managed=getManagedRaceScenery(items,s);s.elapsedMs+=50;
 assert.equal(roadsidePassMix(managed,s).left,0);
 s.running=false;assert.equal(roadsidePassMix(managed,s).right,0);
 assert.equal(managed.statistics.preparations,1,'audio reuses the race index');
});

test('passing audio reuses stereo nodes, clamps gain and cleans up',()=>{
 const nodes=[],param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
 const node=()=>{const n={gain:param(),pan:param(),frequency:param(),Q:param(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){}};nodes.push(n);return n;};
 const ctx={sampleRate:8000,currentTime:0,createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:node,createBiquadFilter:node,createGain:node,createStereoPanner:node};
 const sound=new RoadMotionSound(ctx,{}),count=nodes.length;
 sound.update({speedMps:30,passing:{left:100,right:0}});
 assert.equal(sound.passing[0].gain.gain.value,.025);assert.equal(sound.passing[1].gain.gain.value,0);
 assert.ok(sound.passing[0].pan.pan.value<0);assert.ok(sound.passing[1].pan.pan.value>0);
 for(let i=0;i<200;i++)sound.update({speedMps:30});assert.equal(nodes.length,count);
 assert.equal(sound.passing[0].gain.gain.value,0);sound.stop();assert.ok(nodes.every(n=>n.disconnected));
});
