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
