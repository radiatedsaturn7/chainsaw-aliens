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
