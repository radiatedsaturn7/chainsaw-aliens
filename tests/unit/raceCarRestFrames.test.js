import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceCarRestFrames,useRestCarFrame} from '../../src/racing/RaceCarRestFrames.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

function fakeDocument(){return {createElement(){const canvas={width:300,height:150};canvas.getContext=()=>({globalAlpha:1,setTransform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},save(){},restore(){},translate(){},clearRect(){},drawImage(){},fillRect(){}});return canvas;}};}
test('rest frames share artwork, stagger misses and bound memory',()=>{
 const prior=globalThis.document;globalThis.document=fakeDocument();
 try{
  const cache=new RaceCarRestFrames();let paints=0;
  const paint=(ctx,center,width)=>{paints++;ctx.fillRect(center-width/2,center-width/2,width,width);};
  cache.begin();const frame=cache.get('car/front/off',paint);
  for(let i=0;i<30;i++)assert.equal(cache.get('car/front/off',paint),frame);
  assert.equal(paints,1);cache.get('car/front/on',paint);
  assert.equal(cache.get('car/side/off',paint),null);assert.equal(cache.deferred,1);
  cache.begin();assert.ok(cache.get('car/side/off',paint));
  for(let i=0;i<150;i++){cache.begin();cache.get(`variant-${i}`,paint);}
  assert.ok(cache.frames.size<=96);assert.ok(cache.pixels<=4*1024*1024);
  assert.equal(cache.frames.has('car/front/off'),false);
  cache.clear();assert.equal(cache.frames.size,0);assert.equal(cache.pixels,0);
 }finally{globalThis.document=prior;}
});
test('clipped canonical artwork is not cached and detail switches have hysteresis',()=>{
 const prior=globalThis.document;globalThis.document=fakeDocument();
 try{const cache=new RaceCarRestFrames();cache.begin();assert.equal(cache.get('oversized',ctx=>ctx.fillRect(-5,0,100,100)),null);assert.equal(cache.frames.size,0);}finally{globalThis.document=prior;}
 assert.equal(useRestCarFrame(false,39),false);assert.equal(useRestCarFrame(false,41),true);
 assert.equal(useRestCarFrame(true,35),true);assert.equal(useRestCarFrame(true,29),false);
 assert.equal(useRestCarFrame(true,100,Math.PI),false);assert.equal(useRestCarFrame(true,100,0,.6),false);
});
test('AI resting bake clears live wheel pose, changes lamps and bypasses unsupported FX',()=>{
 const editor=new RaceEditor({});let key,options;
 editor.raceThreeWorldRenderer={carRestFrames:{identity:()=> 'same-car',get:(k,paint)=>{key=k;paint({},256,128);return {canvas:{}};}}};
 editor.getRaceCarProjectedArtRef=()=>({artRef:'body',viewSlot:'rear'});
 editor.getRaceArtSpriteCanvas=()=>({width:32,height:32});editor.getCarTireArtEntry=()=>null;
 editor.drawRaceCarBillboardLayers=(ctx,o)=>{options=o;};
 const ai={vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:5}}},mechanical:{headlights:false}},car={art:{fx:[]}},pose={yaw:0,pitchRad:0,rollRad:0};
 assert.ok(editor.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0));const off=key;
 assert.equal(options.frontTireAngle,0);assert.equal(options.tireScroll,0);assert.equal(options.session.vehicleRenderState,null);
 ai.mechanical.headlights=true;editor.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0);assert.notEqual(key,off);
 car.art.fx=[{enabled:true,triggers:['engine-damage']}];assert.equal(editor.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0),null);
});

test('matching car configurations share identities and cached emissive lamps survive baking',()=>{
 const prior=globalThis.document;globalThis.document=fakeDocument();
 try{
  const cache=new RaceCarRestFrames(),car={art:{body:'body'},setup:{defaultTireCompound:'street'}};
  assert.equal(cache.identity(car),cache.identity(JSON.parse(JSON.stringify(car))));
  const before=cache.identity(car);car.setup.defaultTireCompound='rally';assert.notEqual(cache.identity(car),before);
  cache.begin();const frame=cache.get('rally-lights',(ctx,center)=>{
   ctx.__raceEmissive=true;ctx.drawImage({width:16,height:16},center,center,16,16);ctx.__raceEmissive=false;
  });
  assert.ok(frame.emission);assert.equal(frame.pixels,frame.canvas.width*frame.canvas.height*2);
 }finally{globalThis.document=prior;}
});

test('three artwork tiers sharpen at 50m and use live detail inside 30m with retreat hysteresis',async()=>{
 const {raceCarArtworkTier:tier}=await import('../../src/racing/RaceCarRestFrames.js');
 assert.equal(tier('far',51),'far');assert.equal(tier('far',50),'medium');
 assert.equal(tier('medium',54),'medium');assert.equal(tier('medium',56),'far');
 assert.equal(tier('medium',30),'live');assert.equal(tier('live',31),'live');
 assert.equal(tier('live',33),'medium');assert.equal(tier('far',100,2),'live');
});
test('medium cache has twice the raster resolution while retaining world size and memory limits',()=>{
 const prior=globalThis.document;globalThis.document=fakeDocument();
 try{
  const cache=new RaceCarRestFrames();cache.begin();
  const paint=(ctx,c,w)=>ctx.fillRect(c-w/2,c-w/2,w,w);
  const far=cache.get('far',paint),medium=cache.get('medium',paint,{bodyWidth:256});
  assert.ok(medium.canvas.width>far.canvas.width*1.9);
  assert.ok(Math.abs(far.width-medium.width)<.02);
  assert.equal(cache.scratchSizes.size,2);
  for(let i=0;i<150;i++){cache.begin();cache.get(`medium-${i}`,paint,{bodyWidth:256});}
  assert.ok(cache.pixels<=4*1024*1024);cache.clear();assert.equal(cache.scratchSizes.size,0);
 }finally{globalThis.document=prior;}
});
test('approaching changes the texture key and measures distance from player rather than camera depth',()=>{
 const e=new RaceEditor({});let key,width;
 e.playtestSession={worldX:0,worldZ:0};
 e.raceThreeWorldRenderer={carRestFrames:{identity:()=>1,get:(k,paint,options)=>{key=k;width=options?.bodyWidth;paint({},256,128);return {canvas:{}};}}};
 e.getRaceCarProjectedArtRef=()=>({artRef:'body',viewSlot:'rear'});
 e.getRaceArtSpriteCanvas=()=>({});e.getCarTireArtEntry=()=>null;e.drawRaceCarBillboardLayers=()=>{};
 const ai={worldX:60,worldZ:0,mechanical:{headlights:false}},car={art:{fx:[]}},pose={yaw:0};
 assert.ok(e.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0));const farKey=key;assert.equal(width,128);
 ai.worldX=45;assert.ok(e.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0));
 assert.equal(width,256);assert.notEqual(key,farKey);
 ai.worldX=29;assert.equal(e.getRaceAiRestArtwork(ai,car,pose,{cameraZ:80},0),null);
});
