import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {RaceCarDepthSprites,carSpriteCornerDepth,clearCarSpriteScratch} from '../../src/racing/RaceCarDepthSprites.js';

test('pitched-camera car depth follows a vertical plane rather than one anchor depth',()=>{
 const camera=new THREE.PerspectiveCamera(62,1,.4,2600);
 camera.position.set(0,8,20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const world={x:0,y:1,z:0};
 const depths=[-.1,.1].map(y=>carSpriteCornerDepth(camera,world,0,y));
 assert.ok(Math.abs(depths[0]-depths[1])>1e-5);
 for(let i=0;i<2;i++){
   const p=new THREE.Vector3(0,[-.1,.1][i],depths[i]).unproject(camera);
   assert.ok(Math.abs(p.z)<1e-8,'every sprite pixel lies on its car plane');
 }
});
test('scratch clear touches previous car crop, not the full phone screen',()=>{
 const clears=[];const ctx={setTransform(){},clearRect(...args){clears.push(args);}};
 clearCarSpriteScratch(ctx,{width:1080,height:1920},{left:400,top:500,right:480,bottom:560});
 assert.deepEqual(clears,[[396,496,88,68]]);
 assert.ok(88*68<1080*1920/100);
 clearCarSpriteScratch(ctx,{width:1080,height:1920},null);assert.equal(clears.length,1);
});

test('AI paint reuse still moves depth quad; player refreshes and hidden resources expire',async()=>{
 const {RaceCarDepthSprites}=await import('../../src/racing/RaceCarDepthSprites.js');
 const prior=globalThis.document;
 globalThis.document={createElement(){const canvas={width:300,height:150};canvas.getContext=()=>({setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},drawImage(){},fillRect(){}});return canvas;}};
 try{
 const batch=new RaceCarDepthSprites(new THREE.Scene());
 const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 let paints=0;const paint=ctx=>{paints++;ctx.fillRect(40,40,20,20);};
 const bounds={x:0,y:0,w:100,h:100};const options={intervalMs:1000/30,appearanceKey:'front'};
 let firstX;
 for(let frame=0;frame<60;frame++){
 batch.begin(bounds,frame*1000/60);batch.draw('ai',{x:frame*.001,y:0,z:0},camera,paint,options);batch.end();
 const x=batch.entries.get('ai').mesh.geometry.attributes.position.getX(0);
 if(frame===0)firstX=x;
 if(frame===1){assert.ok(x>firstX,'cached sprite moves on a non-paint frame');assert.equal(batch.stats.uploadedPixels,0);}
 if(frame===0){assert.ok(batch.stats.uploadedPixels>0);assert.equal(batch.stats.repaintReasons.initial,1);}
 if(frame===1)assert.equal(Object.values(batch.stats.repaintReasons).reduce((a,b)=>a+b,0),0);
 }
 assert.ok(paints<=30,`only ${paints} artwork paints for 60 movement frames`);
 batch.begin(bounds,1001);batch.draw('ai',{x:0,y:0,z:0},camera,paint,{...options,appearanceKey:'rear'});assert.equal(batch.stats.paints,1);
 batch.begin(bounds,1002);batch.draw('ai',{x:0,y:0,z:0},camera,paint);assert.equal(batch.stats.paints,1,'player/default is full rate');assert.equal(batch.stats.repaintReasons.fullRate,1);
 batch.begin(bounds,1010);batch.end();assert.equal(batch.entries.get('ai').mesh.visible,false);
 batch.begin(bounds,4000);batch.end();assert.equal(batch.entries.size,1);
 batch.begin(bounds,32000);batch.end();assert.equal(batch.entries.size,0);
 batch.dispose();
 }finally{globalThis.document=prior;}
});

test('textured wheels record one outer bound without changing any drawing commands',async()=>{
 const {boundedContext}=await import('../../src/racing/RaceCarDepthSprites.js');
 const {drawWheelCylinder,buildWheelCylinder}=await import('../../src/racing/CarWheelCylinder.js');
 for(const bearing of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.75]){
 const commands=()=>{const calls=[];let transforms=0;
 const ctx=new Proxy({imageSmoothingEnabled:true,getTransform(){transforms++;return {a:.8,b:.6,c:-.6,d:.8,e:40,f:30};}},
 {get(o,k){if(k in o)return o[k];if(String(k).startsWith('__race'))return undefined;return (...args)=>calls.push([k,...args]);}});
 return {ctx,calls,get transforms(){return transforms;}};};
 const raw=commands(),tracked=commands(),recorder=boundedContext(tracked.ctx);
 const options={tread:{width:256,height:256},wheel:{width:256,height:256},width:12,height:24,bearing,spin:.7};
 drawWheelCylinder(raw.ctx,options);drawWheelCylinder(recorder.context,options);
 assert.deepEqual(tracked.calls,raw.calls,'same texture triangles, clips, transforms and paint operations');
 assert.equal(tracked.transforms,1,'one bounds transform for the entire wheel');
 const box=recorder.bounds();
 for(const triangle of buildWheelCylinder(options))for(const p of triangle.points){
 const x=.8*p.x-.6*p.y+40,y=.6*p.x+.8*p.y+30;
 assert.ok(x>=box.left-1e-6&&x<=box.right+1e-6&&y>=box.top-1e-6&&y<=box.bottom+1e-6);
 }
 assert.ok((box.right-box.left)*(box.bottom-box.top)<1600,'UV-clipped source pixels cannot expand the wheel upload bounds');
 }
});

test('car occlusion covers its footprint on slopes but still respects nearer terrain',async()=>{
 const {carSpriteFootprintDepthAnchor}=await import('../../src/racing/RaceCarDepthSprites.js');
 for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI])for(const slope of [-.3,0,.3]){
  const camera=new THREE.PerspectiveCamera(62,1,.1,2600);camera.position.set(0,8,20);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  const anchor=carSpriteFootprintDepthAnchor(camera,{x:0,y:1,z:0},{x:0,z:0,yaw,lengthM:4.5,widthM:1.8});
  for(const localZ of [-2.25,2.25])for(const localX of [-.9,.9]){
   const x=Math.sin(yaw)*localZ+Math.cos(yaw)*localX,z=Math.cos(yaw)*localZ-Math.sin(yaw)*localX;
   const road=new THREE.Vector3(x,slope*z,z).project(camera);
   const depth=carSpriteCornerDepth(camera,anchor,road.x,road.y);
   assert.ok(depth<road.z,'road at tire footprint cannot slice through car image');
   const nearer=new THREE.Vector3(road.x,road.y,depth-.001);
   assert.ok(nearer.z<depth,'nearer terrain still wins the depth test');
  }
 }
});

test('adaptive opponents reuse artwork at 20 FPS while moving and changing lamps immediately',()=>{
 const prior=globalThis.document;
 globalThis.document={createElement(){const canvas={width:300,height:150};canvas.getContext=()=>({setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},drawImage(){},fillRect(){}});return canvas;}};
 try {
  const batch=new RaceCarDepthSprites(new THREE.Scene());
  const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const options={intervalMs:1000/30,adaptive:true,appearanceKey:'lights-off',footprint:{lengthM:4.5,widthM:1.8}};
  let paints=0,reuses=0,uploads=0;
  for(let frame=0;frame<60;frame++){
    batch.begin({x:0,y:0,w:100,h:100},frame*50);
    for(let car=0;car<30;car++)batch.draw(car,{x:frame*.01,y:0,z:0},camera,ctx=>ctx.fillRect(40,40,20,20),options);
    batch.end();if(frame){paints+=batch.stats.paints;reuses+=batch.stats.reuses;uploads+=batch.stats.uploadedPixels;}
  }
  assert.ok(reuses>paints*2,`${paints} repaints / ${reuses} reused images`);
  assert.ok(uploads<59*30*32*32/2);
  batch.begin({x:0,y:0,w:100,h:100},3001);
  batch.draw(0,{x:.6,y:0,z:0},camera,ctx=>ctx.fillRect(40,40,20,20),{...options,appearanceKey:'brake-on'});
  assert.equal(batch.stats.paints,1,'lights bypass artwork timer and budget');assert.equal(batch.stats.repaintReasons.appearance,1);
  batch.dispose();
 }finally{globalThis.document=prior;}
});

test('a viewport-clipped car is repainted when it moves back into view',()=>{
 const prior=globalThis.document;
 globalThis.document={createElement(){const canvas={width:300,height:150};canvas.getContext=()=>({setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},drawImage(){},fillRect(){}});return canvas;}};
 try {
  const batch=new RaceCarDepthSprites(new THREE.Scene());
  const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const options={intervalMs:180,adaptive:true};
  for(const [x,y,w,h] of [[-10,40,30,20],[85,40,30,20],[40,-10,20,30],[40,85,20,30]]){
   batch.begin({x:0,y:0,w:100,h:100},0);
   batch.draw('ai',{x:0,y:0,z:0},camera,ctx=>ctx.fillRect(x,y,w,h),{...options,intervalMs:0});batch.end();
   assert.equal(batch.entries.get('ai').clipped,true);
   batch.begin({x:0,y:0,w:100,h:100},10);
   batch.draw('ai',{x:.1,y:0,z:0},camera,ctx=>ctx.fillRect(35,35,30,30),options);batch.end();
   assert.equal(batch.stats.paints,1,'do not reuse an image with missing edge pixels');assert.equal(batch.stats.repaintReasons.clipped,1);
   assert.equal(batch.stats.reuses,0);assert.equal(batch.entries.get('ai').clipped,false);
  }
  batch.dispose();
 }finally{globalThis.document=prior;}
});

test('authored wheel pixels beyond physics footprint stay above supporting road depth',async()=>{
 const {carSpritePaintDepthAnchor,carSpriteFootprintDepthAnchor}=await import('../../src/racing/RaceCarDepthSprites.js');
 for(const slope of [-.15,0,.15]){
  const camera=new THREE.PerspectiveCamera(62,1,.1,2600);camera.position.set(0,8,20);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  const footprint={x:0,z:0,yaw:0,lengthM:4.5,widthM:1.8};
  const physical=carSpriteFootprintDepthAnchor(camera,{x:0,y:1,z:0},footprint);
  const ground={x:0,y:.02,z:0,normal:{x:0,y:1,z:-slope}};
  // Existing art offsets put the bottom of a visible tire past the physical
  // near bumper. The original plane hides it behind even a smooth road.
  const tirePixel=new THREE.Vector3(0,slope*3.5,3.5).project(camera);
  assert.ok(carSpriteCornerDepth(camera,physical,tirePixel.x,tirePixel.y)>tirePixel.z);
  const fitted=carSpritePaintDepthAnchor(camera,physical,ground,{xs:[tirePixel.x],y:tirePixel.y},footprint);
  const depth=carSpriteCornerDepth(camera,fitted,tirePixel.x,tirePixel.y);
  assert.ok(depth<tirePixel.z,'the supporting road no longer cuts off the wheel');
  const occluder=new THREE.Vector3(0,slope*5,5).project(camera);
  assert.ok(occluder.z<depth,'genuinely nearer terrain still occludes the car');
 }
});

test('distant resting frames avoid periodic repaint and upload but refresh for lights or nearby detail',()=>{
 const prior=globalThis.document;
 globalThis.document={createElement(){const canvas={width:300,height:150};canvas.getContext=()=>({setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},drawImage(){},fillRect(){}});return canvas;}};
 try{
  const batch=new RaceCarDepthSprites(new THREE.Scene());
  const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const options={intervalMs:33,adaptive:true,resting:true,appearanceKey:'rest:rear:off'};
  let paints=0,uploads=0;
  for(let frame=0;frame<120;frame++){
   batch.begin({x:0,y:0,w:100,h:100},frame*50);
   for(let car=0;car<30;car++)batch.draw(car,{x:frame*.01,y:0,z:frame*.2},camera,ctx=>ctx.fillRect(40,40,20,20),options);
   batch.end();paints+=batch.stats.paints;uploads+=batch.stats.uploadedPixels;
  }
  assert.equal(paints,30,'one upload per car, not 3,600 repeated compositions');
  assert.equal(uploads,30*32*32);
  batch.begin({x:0,y:0,w:100,h:100},6000);
  batch.draw(0,{x:1,y:0,z:20},camera,ctx=>ctx.fillRect(40,40,20,20),{...options,appearanceKey:'rest:rear:on'});
  assert.equal(batch.stats.paints,1);
  batch.begin({x:0,y:0,w:100,h:100},6050);
  batch.draw(0,{x:1,y:0,z:20},camera,ctx=>ctx.fillRect(40,40,20,20),{...options,resting:false,appearanceKey:'live:rear:on'});
  assert.equal(batch.stats.paints,1);batch.dispose();
 }finally{globalThis.document=prior;}
});

test('oscillating crop sizes retain texture capacity and repaint only the actual artwork',()=>{
 const prior=globalThis.document,copies=[];
 globalThis.document={createElement(){
  const canvas={width:300,height:150};
  const ctx={setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},fillRect(){},drawImage(...args){copies.push(args);}};
  canvas.getContext=()=>ctx;return canvas;
 }};
 try{
  const batch=new RaceCarDepthSprites(new THREE.Scene()),tracker=batch.boundsRecorder;
  const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  let resizes=0;const bounds={x:0,y:0,w:200,h:200};
  for(let i=0;i<20;i++){
   const size=i%2?30:28;batch.begin(bounds,i*17);
   batch.draw('ai',{x:0,y:0,z:0},camera,ctx=>ctx.fillRect(40,40,size,20));
   resizes+=batch.stats.textureResizes;
   assert.equal(batch.boundsRecorder,tracker);
   assert.equal(batch.entries.get('ai').paintWidth,size+4);
   assert.equal(copies.at(-1)[3],size+4);
   assert.equal(copies.at(-1)[7],size+4,'texture capacity never stretches the painted image');
  }
  assert.equal(resizes,2,'initial size plus one growth; no shrink/grow oscillation');
  assert.equal(batch.entries.get('ai').canvas.width,64);
  batch.begin(bounds,3000);batch.end();assert.equal(batch.entries.size,1);
  batch.begin(bounds,31000);batch.end();assert.equal(batch.entries.size,0);
 }finally{globalThis.document=prior;}
});

test('reused depth scratch matches independent corner projections through camera rotations',()=>{
 const scratch={anchor:new THREE.Vector3(),normal:new THREE.Vector3(),origin:new THREE.Vector3(),ray:new THREE.Vector3(),delta:new THREE.Vector3()};
 const world={x:4,y:2,z:7};
 for(let i=0;i<20;i++){
  const camera=new THREE.PerspectiveCamera(40+i,1.6,.1,2600);
  camera.position.set(Math.sin(i)*20,4+i,Math.cos(i)*20);camera.lookAt(4,2,7);camera.updateMatrixWorld(true);
  for(const [x,y] of [[-.5,-.4],[.3,.7],[0,0]])assert.equal(carSpriteCornerDepth(camera,world,x,y,scratch),carSpriteCornerDepth(camera,world,x,y));
 }
});

test('inactive car cache retains recent resources within its memory budget and disposes on shutdown',()=>{
 const batch=Object.create(RaceCarDepthSprites.prototype);
 batch.scene={remove(){}};batch.entries=new Map();batch.active=new Set();batch.now=10000;
 let disposed=0;
 for(let i=0;i<8;i++)batch.entries.set(String(i),{
  lastSeen:1000+i,canvas:{width:512,height:512},
  mesh:{visible:true,geometry:{dispose(){}},material:{dispose(){}}},texture:{dispose(){disposed++;}}
 });
 batch.end();
 assert.equal(batch.entries.size,4,'8 MiB cap includes CPU canvas and GPU texture');
 assert.deepEqual([...batch.entries.keys()],['4','5','6','7']);
 assert.equal(disposed,4);
 batch.end(true);assert.equal(batch.entries.size,0);assert.equal(disposed,8);
});
