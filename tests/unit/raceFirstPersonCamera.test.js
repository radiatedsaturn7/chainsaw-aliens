import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {firstPersonCameraFrame,applyFirstPersonCameraFrame,firstPersonCameraSpace} from '../../src/racing/RaceFirstPersonCamera.js';
import {quaternionFromEuler,rotateVectorByQuaternion} from '../../src/racing/simulation/RigidBodyMath.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const vector=(a,b)=>{for(const k of ['x','y','z'])near(a[k],b[k]);};
for(const [name,angles] of Object.entries({upright:{},bank:{roll:.3},pitch:{pitch:.5},sideways:{roll:Math.PI/2},inverted:{roll:Math.PI},vertical:{pitch:Math.PI/2},tumble:{yaw:1.2,pitch:2.4,roll:-2.8}}))test(`first-person follows ${name} body pose without horizon stabilization`,()=>{
 const orientation=quaternionFromEuler(angles),frame=firstPersonCameraFrame({x:2,y:3,z:4},{orientation});
 vector(frame.up,rotateVectorByQuaternion({x:0,y:1,z:0},orientation));
 const offset=rotateVectorByQuaternion({x:0,y:.8,z:.2},orientation);vector(frame.position,{x:2+offset.x,y:3+offset.y,z:4+offset.z});
 const camera=new THREE.PerspectiveCamera(58,16/9,.06,1000);applyFirstPersonCameraFrame(camera,frame);camera.updateMatrixWorld(true);
 const direction=new THREE.Vector3();camera.getWorldDirection(direction);vector(direction,frame.forward);
 const ahead=new THREE.Vector3(frame.position.x+frame.forward.x*10,frame.position.y+frame.forward.y*10,frame.position.z+frame.forward.z*10).project(camera);near(ahead.x,0);near(ahead.y,0);
 const editor=new RaceEditor({}),before=Array.from(camera.projectionMatrix.elements);editor.alignRaceThreeCameraHorizon(camera,{firstPersonFrame:frame},0,{w:960,h:540});assert.deepEqual(Array.from(camera.projectionMatrix.elements),before);
});
test('head look rotates inside the inverted cabin and leaves the eye attached to the car',()=>{
 const orientation=quaternionFromEuler({yaw:.6,roll:Math.PI});
 const a=firstPersonCameraFrame({x:0,y:2,z:0},{orientation}),b=firstPersonCameraFrame({x:0,y:2,z:0},{orientation,lookAngle:Math.PI/2});
 vector(a.position,b.position);vector(a.up,b.up);vector(b.forward,rotateVectorByQuaternion({x:1,y:0,z:0},orientation));assert.ok(b.up.y<-.99);
});
test('render quaternion and position take precedence over stale session angles',()=>{
 const editor=new RaceEditor({});editor.hasPhysicalRaceGamepad=()=>false;
 const orientation=quaternionFromEuler({roll:Math.PI}),session={carYaw:2,pitchRad:1,rollRad:0,bodyY:0,vehicleRenderState:{position:{x:10,y:5,z:20},orientation,yawRad:0,pitchRad:0,rollRad:Math.PI}};
 const camera=editor.attachRaceFirstPersonCamera({},session);
 near(camera.firstPersonFrame.up.y,-1);near(camera.firstPersonFrame.position.y,4.2);near(camera.elevation*12,4.2);near(camera.x,10);assert.equal(camera.horizonRatio,.5);
});
test('CPU projection matches Three at arbitrary pitch and roll in wide and portrait views',()=>{
 const editor=new RaceEditor({}),frame=firstPersonCameraFrame({x:4,y:3,z:7},{orientation:quaternionFromEuler({yaw:.5,pitch:.8,roll:2.5}),lookAngle:.4});
 const point={x:frame.position.x+frame.forward.x*20+frame.right.x*3+frame.up.x*2,y:frame.position.y+frame.forward.y*20+frame.right.y*3+frame.up.y*2,z:frame.position.z+frame.forward.z*20+frame.right.z*3+frame.up.z*2};
 vector(firstPersonCameraSpace(point,frame),{x:3,y:2,z:20});
 for(const b of [{x:10,y:20,w:960,h:540},{x:5,y:30,w:354,h:199}]){
  const camera={firstPersonFrame:frame,x:frame.position.x,z:frame.position.z,elevation:frame.position.y/12,roadWidthScale:1,nearPlane:.1,nearPlaneMin:.06};
  const result=editor.projectRaceWorldPointToCamera({x:point.x,z:point.z,elevation:point.y/12},camera,0,b);
  const three=new THREE.PerspectiveCamera(58,b.w/b.h,.06,1000);applyFirstPersonCameraFrame(three,frame);three.updateMatrixWorld(true);const projected=new THREE.Vector3(point.x,point.y,point.z).project(three);
  near(result.screenX,b.x+(projected.x+1)*b.w/2);near(result.screenY,b.y+(1-projected.y)*b.h/2);
 }
});
test('roll remains continuous across the upside-down angle boundary',()=>{
 const a=firstPersonCameraFrame({}, {orientation:quaternionFromEuler({roll:Math.PI-.001})}),b=firstPersonCameraFrame({}, {orientation:quaternionFromEuler({roll:-Math.PI+.001})});
 assert.ok(Math.hypot(a.up.x-b.up.x,a.up.y-b.up.y,a.up.z-b.up.z)<.003);
});

test('first-person sky retains third-person artwork scale and yaw scroll during rollovers',()=>{
 const bounds={x:12,y:20,w:960,h:540};
 const render=(yaw,orientation=null)=>{
  const editor=new RaceEditor({}),images=[],rotations=[];
  editor.getRaceSkyboxSettings=()=>({artRef:'sky',offsetYRatio:0,offsetXTurns:0});
  editor.getRaceSkyboxRenderCanvas=()=>({width:1024,height:512});
  const ctx={save(){},restore(){},translate(){},rotate(v){rotations.push(v);},fillRect(){},beginPath(){},rect(){},clip(){},drawImage(...args){images.push(args);}};
  editor.drawRaceParallaxBackground(ctx,bounds,{horizon:bounds.y+bounds.h*.36,cameraYaw:yaw,
   firstPersonFrame:orientation?firstPersonCameraFrame({},{orientation}):null});
  return {images,rotations};
 };
 const baseline=render(0),turn=render(.2);
 const width=baseline.images[0][3],height=baseline.images[0][4];
 const phase=(result)=>((result.images[0][1]%width)+width)%width;
 const delta=phase(turn)-phase(baseline);
 for(const orientation of [quaternionFromEuler({}),quaternionFromEuler({roll:.7}),quaternionFromEuler({roll:Math.PI}),quaternionFromEuler({pitch:.4,roll:1})]){
  const a=render(0,orientation),b=render(.2,orientation);
  for(const draw of [...a.images,...b.images]){near(draw[3],width);near(draw[4],height);}
  near(phase(b)-phase(a),delta);
  assert.equal(a.rotations.length,1);
 }
});


test('sky artwork does not wobble with slip or resize with the horizon and retains subpixel motion', () => {
 const editor=new RaceEditor({}),bounds={x:0,y:0,w:960,h:540};
 editor.getRaceSkyboxSettings=()=>({artRef:'sky',offsetYRatio:0,offsetXTurns:0});
 editor.getRaceSkyboxRenderCanvas=()=>({width:1024,height:512});
 const render=(options={})=>{
  const images=[];
  const ctx={imageSmoothingEnabled:false,save(){},restore(){},fillRect(){},beginPath(){},rect(){},clip(){},drawImage(...args){images.push({args,smoothing:this.imageSmoothingEnabled});}};
  editor.drawRaceParallaxBackground(ctx,bounds,{horizon:250.1,cameraYaw:.2,...options});
  assert.equal(ctx.imageSmoothingEnabled,false);
  return images;
 };
 const a=render(),slip=render({heading:2,velocityYaw:-2,speedMps:50}),b=render({horizon:250.2});
 assert.deepEqual(slip,a);
 near(b[0].args[2]-a[0].args[2],.1);
 for(const image of [...a,...b,...render({horizon:270})]){
  near(image.args[3],a[0].args[3]);near(image.args[4],a[0].args[4]);assert.equal(image.smoothing,true);
 }
 const first=render({cameraYaw:Math.PI*2-.0001}),second=render({cameraYaw:.0001});
 const width=first[0].args[3];
 const phase=images=>((images[0].args[1]%width)+width)%width;
 near(phase(second)-phase(first),.0002*width/(Math.PI*2));
});


test('sky scale axes are independent and persist with race settings', () => {
 const editor=new RaceEditor({}),bounds={x:0,y:0,w:960,h:540};
 assert.equal(editor.getMenuItems('settings').find(item=>item.id==='skybox-next').label,'Skybox');
 editor.getRaceSkyboxRenderCanvas=()=>({width:1024,height:512});
 const draw=settings=>{
  editor.setRaceSkyboxSettings({artRef:'sky',...settings});
  const images=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(...args){images.push(args);}};
  editor.drawRaceSkyboxArt(ctx,bounds,{horizon:200});return images[0];
 };
 const normal=draw({}),wide=draw({scaleX:2}),tall=draw({scaleY:1.5});
 near(wide[3],normal[3]*2);near(wide[4],normal[4]);
 near(tall[3],normal[3]);near(tall[4],normal[4]*1.5);
 near(tall[2]+tall[4]*.56,200);
 const loaded=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
 near(editor.getRaceSkyboxSettings(loaded).scaleY,1.5);
});
