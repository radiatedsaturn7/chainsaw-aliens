import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} saved AI artwork uses the track camera and physical pose`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const {RACE_THREE_ELEVATION_M}=await import('/src/racing/simulation/RaceSimulationConfig.js');
  const e=new RaceEditor({},{mode:'race'}),width=innerWidth,height=innerHeight;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  const camera=new THREE.PerspectiveCamera(55,width/height,0.1,200);camera.position.set(0,9,18);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  e.raceThreeWorldRenderer={camera};e.lastRaceRenderStats={threeTerrainRenderer:true};
  e.lastRaceRenderCamera={camera:{},cameraYaw:Math.PI,bounds:{x:0,y:0,w:width,h:height}};
  const colors={'Red AI':'#ff0000','Green AI':'#00ff00','Player':'#0000ff'};
  const textures=Object.fromEntries(Object.entries(colors).map(([name,color])=>{const c=document.createElement('canvas');c.width=24;c.height=24;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,24,24);return [name,c]}));
  e.getRaceArtSpriteCanvas=ref=>textures[ref]||null;
  e.selectedCar.art={body:'Player'};
  const cars=['Red AI','Green AI'].map(name=>{const c=e.withSavedRaceCarRuntimeIdentity(structuredClone(e.selectedCar),name);c.art={body:name,layerVisibility:{body:true,tires:false,shadow:false,brakes:false}};e.upsertRaceProjectCar(c);return c});
  e.playtestSession={raceId:e.selectedRace.id,routeLength:1000,routeRuntimeType:'destination',aiDrivers:cars.map(c=>({carId:c.__playtestId})),aiRuntime:cars.map((car,i)=>({carId:car.__playtestId,runtimeCar:car,worldX:0,worldZ:100,carYaw:0,vehicleRenderState:{position:{x:i?3:-3,y:i?2:0.5,z:0},yawRad:Math.PI,pitchRad:0.1,rollRad:0.05}}))};
  const refs=e.collectSelectedRaceArtRefs();
  e.getRaceWorldPoseAtDistance=()=>({x:50,z:100,elevation:50,yaw:0,segment:{}});
  e.getRaceShadowGroundSurfacePoint=point=>({...point,elevation:0});
  e.projectRaceWorldPointToCamera=()=>{throw Error('AI used legacy projection with an active track camera')};
  const observations=[],original=e.drawRaceProjectedCarSprite.bind(e);
  e.drawRaceProjectedCarSprite=(ctx,bounds,options)=>{observations.push({ref:options.car.art.body,x:options.projected.screenX,y:options.projected.screenY,elevation:options.projected.elevation});return original(ctx,bounds,options)};
  e.drawRaceProjectedAiCars(ctx,{x:0,y:0,w:width,h:height},{camera:{},cameraYaw:Math.PI});
  const pixels=ctx.getImageData(0,0,width,height).data;let red=0,green=0,blue=0;
  for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3])continue;if(pixels[i]>200&&pixels[i+1]<30&&pixels[i+2]<30)red++;if(pixels[i+1]>200&&pixels[i]<30&&pixels[i+2]<30)green++;if(pixels[i+2]>200&&pixels[i]<30&&pixels[i+1]<30)blue++;}
  const expected=e.playtestSession.aiRuntime.map(ai=>{const p=ai.vehicleRenderState.position;const v=new THREE.Vector3(p.x,p.y,p.z).project(camera);return {ref:ai.runtimeCar.art.body,x:(v.x+1)*width/2,y:(1-v.y)*height/2,elevation:p.y/RACE_THREE_ELEVATION_M}});
  return {refs,observations,expected,red,green,blue};
 });
 expect(result.refs).toContain('Red AI');expect(result.refs).toContain('Green AI');
 expect(result.observations).toHaveLength(2);
 for(const actual of result.observations){const expected=result.expected.find(e=>e.ref===actual.ref);expect(actual.x).toBeCloseTo(expected.x,5);expect(actual.y).toBeCloseTo(expected.y,5);expect(actual.elevation).toBeCloseTo(expected.elevation,5)}
 expect(result.red).toBeGreaterThan(10);expect(result.green).toBeGreaterThan(10);expect(result.blue).toBe(0);
});

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} authored tires stay registered through distance and inversion`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1000,height:700});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const {getCarViewCameraYaw}=await import('/src/racing/CarDirectionalArt.js');
  const {RACE_THREE_ELEVATION_M}=await import('/src/racing/simulation/RaceSimulationConfig.js');
  const e=new RaceEditor({},{mode:'race'}),bounds={x:0,y:0,w:innerWidth,h:innerHeight};
  const canvas=document.createElement('canvas');canvas.width=bounds.w;canvas.height=bounds.h;const ctx=canvas.getContext('2d');
  const body=document.createElement('canvas');body.width=32;body.height=32;
  const tire=document.createElement('canvas');tire.width=8;tire.height=16;const tc=tire.getContext('2d');tc.fillStyle='#00ff00';tc.fillRect(0,0,8,16);
  const car=structuredClone(e.selectedCar);car.art={body:'body',tires:['tires'],layerVisibility:{body:true,tires:true,frontWheels:true,rearWheels:true,brakes:false,shadow:false},tireScaleX:1.2,tireScaleY:0.9,tireSpacingScale:1.1,frontTireOffsetX:0.4,frontTireOffsetY:-0.3,rearTireOffsetX:-0.2,rearTireOffsetY:0.2};
  e.getRaceArtSpriteCanvas=ref=>ref==='body'?body:tire;e.drawRaceGeometricDebugOverlay=()=>{};
  e.getRaceStitchedTerrainElevationAtWorldPoint=()=>0;e.getRaceShadowGroundSurfacePoint=p=>({...p,elevation:0});
  const camera=new THREE.PerspectiveCamera(48,bounds.w/bounds.h,0.1,300);
  e.raceThreeWorldRenderer={camera};e.lastRaceRenderStats={threeTerrainRenderer:true};
  const originalLayers=e.drawRaceCarBillboardLayers.bind(e),originalTire=e.drawScrolledCarTireArt.bind(e);
  let args,draws;e.drawRaceCarBillboardLayers=(c,o)=>{args=o;return originalLayers(c,o)};
  e.drawScrolledCarTireArt=(c,texture,x,y,w,h,options)=>{const m=c.getTransform();draws.push({x:m.e,y:m.f,w,h});return originalTire(c,texture,x,y,w,h,options)};
  const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
  let maxError=0,frames=0,greenFrames=0;
  for(const slot of slots){let baseline;
   const cameraYaw=getCarViewCameraYaw(slot,0);
   for(const distance of [10,25,60])for(const roll of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const player of [false,true]){
    camera.position.set(-Math.sin(cameraYaw)*distance,3.56,-Math.cos(cameraYaw)*distance);camera.up.set(0,1,0);camera.lookAt(0,0.56,0);camera.updateMatrixWorld(true);
    const orientation={x:0,y:0,z:Math.sin(roll/2),w:Math.cos(roll/2)};
    const session={runtimeCar:car,carYaw:0,worldX:0,worldZ:0,bodyY:0.56,rollRad:roll,tireSlip:{},vehicleRenderState:{position:{x:0,y:0.56,z:0},orientation,yawRad:0,pitchRad:0,rollRad:roll,
     wheelPoses:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{position:{x:(id.endsWith('r')?1:-1)*0.78,y:0.337,z:id.startsWith('f')?1.12:-1.55},spinAngleRad:0}]))}};
    e.playtestSession=session;e.lastRaceRenderCamera={camera:{},cameraYaw,bounds};
    draws=[];ctx.clearRect(0,0,bounds.w,bounds.h);
    if(player)e.drawRaceThirdPersonCar(ctx,bounds);
    else{
     const point={x:0,z:0,elevation:0.56/RACE_THREE_ELEVATION_M};
     e.drawRaceProjectedCarSprite(ctx,bounds,{car,session,renderState:session.vehicleRenderState,projected:{...point,...e.projectRaceWorldPointToActiveThreeCamera(point,bounds)},yaw:0,rollRad:roll,camera:{},cameraYaw});
    }
    if(draws.length!==2)throw Error(`Expected two visible wheels, got ${draws.length}`);
    const a=args.bodyRotationRad,C=Math.cos(a),S=Math.sin(a),width=args.bodyBaseWidth;
    const actual=draws.flatMap(p=>{const dx=p.x-args.bodyAnchorX,dy=p.y-args.bodyAnchorY;return [(dx*C+dy*S)/width,(-dx*S+dy*C)/width,p.w/width,p.h/width]});
    if(!baseline)baseline=actual;else actual.forEach((v,i)=>maxError=Math.max(maxError,Math.abs(v-baseline[i])*width));
    const pixels=ctx.getImageData(0,0,bounds.w,bounds.h).data;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>200&&pixels[i]<30&&pixels[i+2]<30){greenFrames++;break}
    frames++;
   }
  }
  return {maxError,frames,greenFrames};
 });
 expect(result.frames).toBe(192);expect(result.greenFrames).toBe(result.frames);// Canvas stores transforms at finite precision; require less than 0.01 screen pixel drift.
 expect(result.maxError).toBeLessThan(0.01);
});
