import {test,expect} from '@playwright/test';

for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} hills and cars occlude authored car graphics by depth`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1000,height:700});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const e=new RaceEditor({},{mode:'race'}),bounds={x:0,y:0,w:innerWidth,h:innerHeight};
  const renderer=e.getRaceThreeWorldRenderer(bounds.w,bounds.h);
  const camera=renderer.camera;camera.position.set(0,1.5,12);camera.lookAt(0,1.5,0);camera.near=0.1;camera.far=200;camera.fov=48;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const canvas=document.createElement('canvas');canvas.width=bounds.w;canvas.height=bounds.h;const ctx=canvas.getContext('2d');
  const textures=Object.fromEntries(['red','blue','empty'].map(color=>{
   const c=document.createElement('canvas');c.width=32;c.height=32;
   if(color!=='empty'){const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,32,32);g.clearRect(12,12,8,8)}
   return [color,c];
  }));
  e.getRaceArtSpriteCanvas=ref=>textures[ref]||null;e.drawRaceGeometricDebugOverlay=()=>{};
  e.getRaceStitchedTerrainElevationAtWorldPoint=()=>0;e.getRaceShadowGroundSurfacePoint=p=>({...p,elevation:0});
  e.lastRaceRenderCamera={camera:{},cameraYaw:Math.PI,cameraView:'third-person',bounds};
  const makeCar=color=>{const c=structuredClone(e.selectedCar);c.art={body:color,bodyFitToCar:true,tires:['empty'],layerVisibility:{body:true,tires:false,brakes:false,shadow:false}};return c};
  const player={runtimeCar:makeCar('blue'),worldX:0,worldZ:0,carYaw:0,bodyY:0.56,tireSlip:{},routeRuntimeType:'destination',routeLength:1000};
  const ai={runtimeCar:makeCar('red'),worldX:0,worldZ:-4,carYaw:0,bodyY:0.56,tireSlip:{},distance:0};
  e.playtestSession=player;
  const render=(showPlayer=true,showAi=true)=>{
   player.aiRuntime=showAi?[ai]:[];
   e.syncRaceThreeCarSprites(renderer,bounds,{camera:{},cameraYaw:Math.PI,cameraView:showPlayer?'third-person':'first-person',stats:{}});
   renderer.threeRenderer.clear(true,true,true);renderer.threeRenderer.render(renderer.scene,camera);
   ctx.clearRect(0,0,bounds.w,bounds.h);ctx.drawImage(renderer.canvas,0,0);
   return ctx.getImageData(0,0,bounds.w,bounds.h).data;
  };
  const colorAt=(data,i,color)=>data[i+3]>200 && (color==='red'?data[i]>220&&data[i+1]<20&&data[i+2]<20:data[i+2]>220&&data[i]<20&&data[i+1]<20);
  const count=(data,color)=>{let n=0;for(let i=0;i<data.length;i+=4)if(colorAt(data,i,color))n++;return n};
  const ordering=[];
  for(const aiNear of [false,true]){
   player.worldZ=aiNear?-4:0;ai.worldZ=aiNear?0:-4;
   const p=render(true,false),a=render(false,true),both=render();
   let overlap=0,correct=0,transparentReveals=0;
   for(let i=0;i<both.length;i+=4){
    const blue=colorAt(p,i,'blue'),red=colorAt(a,i,'red');
    if(blue&&red){overlap++;if(colorAt(both,i,aiNear?'red':'blue'))correct++}
    if(aiNear?blue&&!red:red&&!blue)if(colorAt(both,i,aiNear?'blue':'red'))transparentReveals++;
   }
   ordering.push({overlap,correct,transparentReveals});
  }
  player.worldZ=0;ai.worldZ=-4;
  const visible=render(false,true),visiblePixels=count(visible,'red');
  // A solid ridge in front of the car: low crest masks only its lower pixels.
  const hill=new THREE.Mesh(new THREE.BoxGeometry(30,1.25,1),new THREE.MeshBasicMaterial({color:'#00ff00'}));hill.position.set(0,0.625,5);renderer.scene.add(hill);
  const partial=count(render(false,true),'red');
  hill.scale.y=4;hill.position.y=2.5;
  const hidden=count(render(false,true),'red');
  // Moving the car in front of the very same ridge must restore it.
  ai.worldZ=8;
  const inFront=count(render(false,true),'red');
  renderer.scene.remove(hill);hill.geometry.dispose();hill.material.dispose();
  // No stale overlay may repaint occluded AI pixels after the depth pass.
  let overlayCalls=0;const original=e.drawRaceProjectedCarSprite;e.drawRaceProjectedCarSprite=()=>overlayCalls++;
  e.drawRaceProjectedAiCars(ctx,bounds,{camera:{},cameraYaw:Math.PI,threeRendered:true});e.drawRaceProjectedCarSprite=original;
  player.aiRuntime=[];e.syncRaceThreeCarSprites(renderer,bounds,{camera:{},cameraYaw:Math.PI,cameraView:'first-person',stats:{}});
  const retained=renderer.carDepthSprites.entries.size;
  return {ordering,visiblePixels,partial,hidden,inFront,overlayCalls,retained};
 });
 for(const order of result.ordering){expect(order.overlap).toBeGreaterThan(10);expect(order.correct).toBe(order.overlap);expect(order.transparentReveals).toBeGreaterThan(10)}
 expect(result.visiblePixels).toBeGreaterThan(20);expect(result.partial).toBeGreaterThan(0);expect(result.partial).toBeLessThan(result.visiblePixels);
 expect(result.hidden).toBe(0);expect(result.inFront).toBeGreaterThan(20);expect(result.overlayCalls).toBe(0);expect(result.retained).toBe(0);
});
