import {test,expect} from '@playwright/test';

for (const [mode,size] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}],['desktop',{width:1280,height:800}]]) {
  test(`${mode} driving-assist settings persist and warning blinks on canvas`,async({page})=>{
    await page.setViewportSize(size);
    await page.goto('/index.html');
    await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
    const result=await page.evaluate(async mode=>{
      const game=window.__game;
      game.deviceIsMobile=game.isMobile=mode!=='desktop';
      game.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mode!=='desktop'});
      game.enterRaceEditor();const editor=game.raceEditor;
      editor.selectedRace.codriver={enabled:false,calls:[]};
      editor.selectedRace.drivingGuide={line:true};
      const select=id=>{
        const item=editor.getMenuItems('settings').find(item=>item.id===id);
        if(!item||item.disabled)throw Error(`Missing setting: ${id}`);
        item.onSelect();
      };
      select('race-driving-guide'); select('race-pace-notes');
      const voice=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
      select('race-pace-notes');
      const icons=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
      select('race-pace-notes');
      const both=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
      select('race-pace-notes');
      const off=editor.selectedRace.codriver.enabled;
      const {drawRaceDrivingAssistHud}=await import('/src/racing/RaceDrivingGuideRenderer.js');
      const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;
      canvas.id='assist-preview';Object.assign(canvas.style,{position:'fixed',inset:0,pointerEvents:'none',zIndex:10000});document.body.append(canvas);
      const ctx=canvas.getContext('2d'),bounds={x:0,y:0,w:canvas.width,h:canvas.height};
      // Isolate presentation so the live game cannot advance the blink clock.
      const preview={selectedRace:editor.selectedRace,playtestSession:{elapsedMs:0,drivingAssists:{active:true,wrongWay:true}}};
      const pixels=()=>ctx.getImageData(0,0,canvas.width,canvas.height).data.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0);
      drawRaceDrivingAssistHud(preview,ctx,bounds);const visible=pixels();
      ctx.clearRect(0,0,canvas.width,canvas.height);preview.playtestSession.elapsedMs=500;
      drawRaceDrivingAssistHud(preview,ctx,bounds);const hidden=pixels();
      preview.playtestSession.elapsedMs=0;drawRaceDrivingAssistHud(preview,ctx,bounds);
      return {line:voice.drivingGuide.line,voice:voice.codriver,icons:icons.codriver,both:both.codriver,off,visible,hidden};
    },mode);
    expect(result).toMatchObject({line:false,voice:{enabled:true,spoken:true,icons:false},icons:{enabled:true,spoken:false,icons:true},both:{enabled:true,spoken:true,icons:true},off:false,hidden:0});
    expect(result.visible).toBeGreaterThan(1000);
    await page.screenshot({path:`test-results/driving-assists-${mode}.png`});
  });
}

test('3D guide uses the road camera and is occluded by world geometry',async({page})=>{
 await page.goto('/index.html');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {syncRaceThreeDrivingLine,disposeRaceThreeDrivingLine}=await import('/src/racing/RaceDrivingGuideRenderer.js');
  const {buildRaceAiRoadPlan}=await import('/src/racing/RaceAiRoadPlan.js');
  const game=window.__game;game.enterRaceEditor();const editor=game.raceEditor;
  const bounds={x:0,y:0,w:390,h:600},renderer=editor.getRaceThreeWorldRenderer(bounds.w,bounds.h);
  editor.clearRaceThreeScene(renderer);
  Object.assign(editor,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:0}),getRaceRoadHalfWidthWorld:()=>4,
    getRaceRightVector:()=>({x:1,z:0}),getRaceRoadSurfaceProfileAtDistance:()=>({elevation:0}),getRaceBakedSurfaceAtWorldPoint:()=>({elevation:0})});
  const plan=buildRaceAiRoadPlan(editor,{routeLength:100,runtimeType:'destination'});
  editor.selectedRace.drivingGuide={line:true};
  editor.playtestSession={routeLength:100,routeRuntimeType:'destination',speedMps:5,distance:0,drivingAssists:{active:true,plan}};
  const camera=renderer.camera;camera.position.set(0,3,-5);camera.lookAt(0,0,30);camera.fov=58;camera.near=.1;camera.far=300;
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  syncRaceThreeDrivingLine(editor,renderer);
  const canvas=document.createElement('canvas');canvas.width=bounds.w;canvas.height=bounds.h;const ctx=canvas.getContext('2d');
  const render=()=>{
    renderer.threeRenderer.clear(true,true,true);renderer.threeRenderer.render(renderer.scene,camera);
    ctx.clearRect(0,0,bounds.w,bounds.h);ctx.drawImage(renderer.canvas,0,0);
    const pixels=ctx.getImageData(0,0,bounds.w,bounds.h).data;let green=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>150&&pixels[i+1]>pixels[i]*1.3&&pixels[i+1]>pixels[i+2]*1.15)green++;
    return green;
  };
  const visible=render();
  const wall=new THREE.Mesh(new THREE.BoxGeometry(50,30,1),new THREE.MeshBasicMaterial({color:'#222222'}));
  wall.position.set(0,0,4);renderer.scene.add(wall);
  const occluded=render();renderer.scene.remove(wall);wall.geometry.dispose();wall.material.dispose();
  camera.rotateZ(.18);camera.setViewOffset(bounds.w,bounds.h,0,30,bounds.w,bounds.h);camera.updateMatrixWorld(true);
  const tilted=render();
  editor.lastRaceRenderStats={threeTerrainRenderer:1};
  const position=renderer.drivingGuideMesh.geometry.getAttribute('position');
  const world=new THREE.Vector3().fromBufferAttribute(position,0),ndc=world.clone().project(camera);
  const projected=editor.projectRaceWorldPointToActiveThreeCamera({x:world.x,z:world.z,elevation:world.y/12},bounds);
  const error=Math.hypot(projected.screenX-(ndc.x+1)*bounds.w/2,projected.screenY-(1-ndc.y)*bounds.h/2);
  disposeRaceThreeDrivingLine(renderer);editor.playtestSession=null;
  return {visible,occluded,tilted,error};
 });
 expect(result.visible).toBeGreaterThan(20);expect(result.occluded).toBe(0);
 expect(result.tilted).toBeGreaterThan(20);expect(result.error).toBeLessThan(.001);
});

test('apex guide renders an upcoming turn when optional pace notes are off',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/index.html');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const {racingLineTrack}=await import('/tests/fixtures/racingLineTrack.js');
  const {buildRaceAiRoadPlan}=await import('/src/racing/RaceAiRoadPlan.js');
  const {sampleRaceRacingLine}=await import('/src/racing/RaceRacingLine.js');
  const {analyzeRaceRecce}=await import('/src/racing/RaceRecce.js');
  const {updateRaceDrivingAssists}=await import('/src/racing/RaceDrivingAssists.js');
  const {syncRaceThreeDrivingLine,drawRaceDrivingAssistHud}=await import('/src/racing/RaceDrivingGuideRenderer.js');
  const game=window.__game;game.enterRaceEditor();const editor=game.raceEditor;
  const track=racingLineTrack(),e=track.editor,plan=buildRaceAiRoadPlan(e,{routeLength:track.length,runtimeType:'destination'});
  e.selectedRace.codriver={enabled:false};e.raceInput={paused:false};e.getRaceSessionCar=()=>null;e.getRaceCarTuning=()=>({});
  Object.assign(e.playtestSession,{distance:65,speedMps:12,worldX:0,worldZ:65,codriverCalls:analyzeRaceRecce(e)});
  updateRaceDrivingAssists(e,.016);e.playtestSession.drivingAssists.plan=plan;
  const renderer=editor.getRaceThreeWorldRenderer(390,600);editor.clearRaceThreeScene(renderer);
  renderer.camera.position.set(0,6,55);renderer.camera.lookAt(10,0,115);renderer.camera.updateMatrixWorld(true);
  syncRaceThreeDrivingLine(e,renderer);renderer.threeRenderer.render(renderer.scene,renderer.camera);
  const canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;
  Object.assign(canvas.style,{position:'fixed',inset:0,zIndex:10000});document.body.append(canvas);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#18212c';ctx.fillRect(0,0,390,844);ctx.drawImage(renderer.canvas,0,0);
  const text=[],fill=ctx.fillText.bind(ctx);ctx.fillText=(t,...args)=>{text.push(t);fill(t,...args);};
  drawRaceDrivingAssistHud(e,ctx,{x:0,y:0,w:390,h:844});
  const offsets=[track.entry-25,(track.entry+track.end)/2,track.end+25].map(d=>sampleRaceRacingLine(plan,d).offset);
  const pixels=ctx.getImageData(0,100,390,500).data;let green=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>150&&pixels[i+1]>pixels[i]*1.3&&pixels[i+1]>pixels[i+2]*1.15)green++;
  return {text,offsets,green,vertices:renderer.drivingGuideMesh.geometry.drawRange.count};
 });
 expect(result.text).toEqual([]); // Optional pace-note HUD stays hidden; the 3D line remains visible.
 expect(result.text.some(t=>/^(BRAKE|COAST|ACCELERATE)$/.test(t))).toBe(false);
 expect(result.offsets[0]).toBeLessThan(-2);expect(result.offsets[1]).toBeGreaterThan(2);expect(result.offsets[2]).toBeLessThan(-2);
 expect(result.green).toBeGreaterThan(20);expect(result.vertices).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/driving-assists-apex.png'});
});
