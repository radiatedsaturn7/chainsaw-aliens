import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(grade){
 const e=new RaceEditor({});e.getRaceSessionCar=()=>({camera:{trackingMode:'fixed-rear'}});e.isCarExteriorArtPreview=()=>false;
 e.getRaceWorldPoseAtDistance=d=>({yaw:0,elevation:d*grade/12});e.getRaceRoadSurfaceProfileAtDistance=d=>({elevation:d*grade/12});
 const session={carYaw:0,cameraYaw:0,cameraView:'third-person',elapsedMs:0,speedMps:20};
 return {e,session};
}
test('fixed rear raises horizon for descents and lowers it for climbs without rotating yaw',()=>{
 const ratios=[];
 for(const grade of [-.25,-.12,0,.12,.25]){
  const {e,session}=fixture(grade),p=e.getRaceCameraPitchProfile({session,speedMps:20});
  ratios.push(p.horizonRatio);assert.equal(session.cameraYaw,0);assert.ok(p.horizonRatio>=.08&&p.horizonRatio<=.58);
 }
 for(let i=1;i<ratios.length;i++)assert.ok(ratios[i]>ratios[i-1]);
});
test('downhill road samples stay in the actual Three viewport with fixed rear framing',()=>{
 for(const grade of [-.12,-.25]){
  const {e,session}=fixture(grade),p=e.getRaceCameraPitchProfile({session,speedMps:20});
  const view={x:0,z:-10,elevation:0,eyeHeight:4/12,horizonRatio:p.horizonRatio};
  const c=new THREE.PerspectiveCamera(48,16/9,.06,2000);c.position.set(0,4,-10);c.lookAt(0,4-4*.82,70);c.updateProjectionMatrix();
  e.alignRaceThreeCameraHorizon(c,view,0,{w:960,h:540});c.updateMatrixWorld(true);
  for(const d of [25,50,90]){
   const point=new THREE.Vector3(0,d*grade,d).project(c);
   assert.ok(point.y>-1&&point.y<1,`${grade} grade / ${d}m road is visible: ${point.y}`);
  }
 }
});
test('fixed rear grade is sampled in viewing direction and smoothing does not overshoot',()=>{
 const {e,session}=fixture(-.2);session.cameraYaw=Math.PI;
 const reverse=e.getRaceCameraPitchProfile({session,speedMps:0});assert.ok(reverse.horizonRatio>.31);
 session.cameraYaw=0;let last=.5;session.cameraSmoothing={terrainHorizonRatio:.5,terrainHillPitch:0,verticalCue:0,roadElevation:0,elapsedMs:0,visualTravel:0};
 const profile=e.getRaceCameraPitchProfile({session,speedMps:0});
 for(let i=1;i<30;i++){session.elapsedMs=i*16;const p=e.getRaceSmoothedCameraProfile({session,pitchProfile:profile,visualTravel:0});assert.ok(p.horizonRatio<=last&&p.horizonRatio>=profile.horizonRatio);last=p.horizonRatio;}
});

test('Bear Notch descent uses the smoothed driving deck to bring the road into view',async()=>{
 const fs=await import('node:fs'),zlib=await import('node:zlib');
 const catalog=JSON.parse(fs.readFileSync(new URL('../../data/campaigns/america/side-races/catalog.json',import.meta.url)));
 const row=catalog.find(r=>r.id==='H02-S02');let doc=JSON.parse(fs.readFileSync(new URL('../../',import.meta.url).pathname+'data/server-storage/files/'+row.documentPath));
 if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
 const e=new RaceEditor({});e.applyLoadedRaceDocument(doc);e.getRaceSessionCar=()=>({camera:{trackingMode:'fixed-rear'}});e.isCarExteriorArtPreview=()=>false;
 let best={grade:0,d:0};const length=e.getRaceRouteLength();
 for(let d=0;d<length-60;d+=100){const grade=(e.getRaceRoadSurfaceProfileAtDistance(d+60).elevation-e.getRaceRoadSurfaceProfileAtDistance(d+10).elevation)*12/50;if(grade<best.grade)best={grade,d};}
 assert.ok(best.grade<-.06);
 const yaw=e.getRaceWorldPoseAtDistance(best.d).yaw,session={cameraView:'third-person',carYaw:yaw,cameraYaw:yaw};
 const profile=e.getRaceCameraPitchProfile({visualTravel:best.d,session,speedMps:20});assert.ok(profile.horizonRatio<.24,JSON.stringify({best,profile}));
});

test('junction branch and ground-height changes do not disable camera smoothing',()=>{
 const {e,session}=fixture(0);Object.assign(session,{worldX:10,worldZ:20,elapsedMs:1000});
 const flat={terrainHorizonRatio:.31,horizonRatio:.31};
 e.getRaceSmoothedCameraProfile({session,pitchProfile:flat,visualTravel:4100,roadElevation:0});
 session.elapsedMs+=16;session.worldZ+=.3;
 const spike=e.getRaceSmoothedCameraProfile({session,pitchProfile:{terrainHorizonRatio:.58,horizonRatio:.58},visualTravel:4900,roadElevation:1});
 assert.ok(spike.horizonRatio<.35,'a branch jump must not snap the horizon');
 assert.ok(spike.roadElevation<.1,'a height-query spike remains damped');
 session.elapsedMs+=16;
 const back=e.getRaceSmoothedCameraProfile({session,pitchProfile:flat,visualTravel:4101,roadElevation:0});
 assert.ok(Math.abs(back.horizonRatio-spike.horizonRatio)<.01);
 session.worldX+=100;session.elapsedMs+=16;
 const teleported=e.getRaceSmoothedCameraProfile({session,pitchProfile:{horizonRatio:.5},roadElevation:2});
 assert.equal(teleported.horizonRatio,.5);assert.equal(teleported.roadElevation,2);
});

test('third-person height damps suspension jolts without changing the car or accumulating per render pass',()=>{
 const {e,session}=fixture(0);Object.assign(session,{elapsedMs:1000,bodyY:.5,worldX:0,worldZ:0});
 const initial=e.getRaceThirdPersonCameraEyeHeight(session,0);
 session.elapsedMs+=16;session.bodyY=1.1;
 const raised=e.getRaceThirdPersonCameraEyeHeight(session,.03)+.03;
 assert.ok((raised-initial)*12>0);assert.ok((raised-initial)*12<.15);
 assert.equal(session.bodyY,1.1);
 assert.equal(e.getRaceThirdPersonCameraEyeHeight(session,.03)+.03,raised,'same-frame read cannot advance damping');
 session.elapsedMs+=16;session.bodyY=.5;
 const recovered=e.getRaceThirdPersonCameraEyeHeight(session,0);
 assert.ok(recovered<raised);assert.ok(recovered>initial);
 session.vehicleDynamicsRunner={state:{vehicleResetGeneration:1}};
 session.bodyY=3;
 assert.equal(e.getRaceThirdPersonCameraEyeHeight(session,0),.5,'reset follows new body immediately');
 e.clearRaceThirdPersonCameraState(session);assert.equal(session.cameraBodyHeight,undefined);
});

test('Bayard paved-section camera profiles stay finite and gradual along the saved route',async()=>{
 const fs=await import('node:fs'),zlib=await import('node:zlib');
 const root=new URL('../../data/server-storage/files/races/',import.meta.url);
 const name=fs.readdirSync(root).find(n=>n.startsWith('Bayard'));
 let doc=JSON.parse(fs.readFileSync(root.pathname+name+'/document.json'));
 if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
 const e=new RaceEditor({});e.applyLoadedRaceDocument(doc);
 e.getRaceSessionCar=()=>({camera:{trackingMode:'fixed-rear'}});e.isCarExteriorArtPreview=()=>false;
 e.withRaceGeometryReadCache(()=>{
  let last;
  for(let d=4075;d<e.getRaceRouteLength();d+=10){
   const pose=e.getRaceWorldPoseAtDistance(d);
   const profile=e.getRaceCameraPitchProfile({visualTravel:d,speedMps:20,session:{cameraView:'third-person',cameraYaw:pose.yaw,carYaw:pose.yaw}});
   assert.ok(Number.isFinite(profile.horizonRatio));
   if(last!=null)assert.ok(Math.abs(profile.horizonRatio-last)<.04,`Bayard ${d}m`);
   last=profile.horizonRatio;
  }
 });
});


test('native 3D cars use a lower chase eye without moving the car or changing sprite framing',()=>{
 const {e,session}=fixture(0);
 e.isCarExteriorArtPreview=()=>true;
 const pose={x:0,z:0,elevation:.05};e.getRacePlayerRenderPose=()=>pose;
 const sprite=e.getRaceThirdPersonCameraEyeHeight(session,0);
 e.getRaceSessionCar=()=>({art:{bodyModel:{ref:'Chassis'}}});
 const model=e.getRaceThirdPersonCameraEyeHeight(session,0);
 assert.ok(Math.abs((model-.05)*12-1.6)<1e-9);
 assert.ok(Math.abs((sprite-model)*12-1.4)<1e-9);
 assert.deepEqual(pose,{x:0,z:0,elevation:.05});
 // A raised road anchor cancels out in absolute eye height.
 assert.ok(Math.abs(e.getRaceThirdPersonCameraEyeHeight(session,.04)+.04-model)<1e-9);
});


test('low model chase camera places the body in the lower screen without moving the camera',()=>{
 for(const aspect of [16/9,9/16]){
  const {e,session}=fixture(0);e.playtestSession=session;
  e.getRaceSessionCar=()=>({art:{bodyModel:{ref:'Chassis'}}});
  e.getRacePlayerRenderPose=()=>({x:0,z:0,elevation:.05});
  const camera=new THREE.PerspectiveCamera(48,aspect,.06,2000);
  camera.position.set(0,2.2,-10);camera.lookAt(0,1,70);camera.updateProjectionMatrix();
  const position=camera.position.clone();
  e.alignRaceThreeCameraHorizon(camera,{x:0,z:-10,horizonRatio:.31},0,{});
  const body=new THREE.Vector3(0,.6,0).project(camera);
  assert.ok(Math.abs((1-body.y)/2-.72)<1e-9);
  assert.ok(camera.position.equals(position));
  const identity=camera.projectionMatrix.clone().multiply(camera.projectionMatrixInverse);
  assert.ok(identity.elements.every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-9));
 }
});
