import {test,expect} from '@playwright/test';

test('bone-animated actor models render side-view pixels through the Level actor draw path',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  const result=await page.evaluate(async()=>{
    const {createModelDocument,addPrimitive}=await import('/src/model3d/ModelDocument.js');
    const {addJoint,assignVerticesToJoint,addAnimation,setKeyframe}=await import('/src/model3d/ModelRig.js');
    const {modelAssets}=await import('/src/model3d/ModelAssets.js');
    const {createDefaultActor}=await import('/src/content/actorEditorData.js');
    const {default:ScriptedActor}=await import('/src/entities/ScriptedActor.js');
    const model=createModelDocument('Browser animated actor');
    const geometry=addPrimitive(model,'box');
    const joint=addJoint(model,[0,0,0]);assignVerticesToJoint(model,geometry.vertices,joint);
    const clip=addAnimation(model,'Rise',1);
    setKeyframe(model,clip,joint,0,{position:[0,0,0]});
    setKeyframe(model,clip,joint,1,{position:[0,0.6,0]});
    modelAssets.adopt('Browser animated actor',model);
    const definition=createDefaultActor();
    definition.states[0].animation.model={ref:'Browser animated actor',clip};
    const actor=new ScriptedActor(128,128,definition);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    const capture=time=>{
      ctx.clearRect(0,0,256,256);actor.stateTimer=time;actor.draw(ctx);
      return ctx.getImageData(0,0,256,256).data;
    };
    const first=capture(0),next=capture(0.5);
    let opaque=0,changed=0;
    for(let i=0;i<first.length;i+=4){if(first[i+3])opaque++;if(first[i]!==next[i]||first[i+3]!==next[i+3])changed++;}
    modelAssets.entries.delete('Browser animated actor');
    return {opaque,changed};
  });
  expect(result.opaque).toBeGreaterThan(20);
  expect(result.changed).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('AI car bodies and wheels render model geometry at continuous angles in WebGL',async({page})=>{
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/src/vendorBridge/three.js');
    const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
    const {createModelDocument,addPrimitive}=await import('/src/model3d/ModelDocument.js');
    const {modelAssets}=await import('/src/model3d/ModelAssets.js');
    const model=createModelDocument();addPrimitive(model,'box');modelAssets.adopt('Browser AI model',model);
    const e=new RaceEditor({},{mode:'race'}),car=e.selectedCar;
    car.art.bodyModel={ref:'Browser AI model',scale:[1.8,0.8,4]};
    car.art.wheelModel={ref:'Browser AI model',scale:[0.3,0.6,0.6]};
    car.art.layerVisibility={shadow:false,brakes:false};
    const ai={carId:car.id,worldX:0,worldZ:0,carYaw:0.31};
    e.playtestSession={aiRuntime:[ai],elapsedMs:0};
    e.getRaceWorldPoseAtDistance=()=>({x:0,z:0,elevation:0,yaw:0});
    e.getRaceCompositedSurfaceAtWorldPoint=()=>({elevation:0});
    const renderer={scene:new THREE.Scene()};
    const webgl=new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true});webgl.setSize(256,256);
    const camera=new THREE.PerspectiveCamera(40,1,0.01,100);camera.position.set(6,4,7);camera.lookAt(0,0,0);
    const capture=()=>{
      e.syncRaceThreeAiModels(renderer,0);webgl.render(renderer.scene,camera);
      const gl=webgl.getContext(),pixels=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
    };
    try{
      const first=capture();ai.carYaw=0.57;const next=capture();
      const parts=renderer.aiModelCars.get(ai).dynamicCarGroup.userData.parts;
      let opaque=0,changed=0;for(let i=0;i<first.length;i+=4){if(first[i+3])opaque++;if(first[i]!==next[i]||first[i+3]!==next[i+3])changed++;}
      return {opaque,changed,yaw:parts.body.rotation.y,wheels:Object.values(parts.wheels).filter(w=>w.userData.modelInstance).length};
    }finally{e.clearRaceThreeScene(renderer);webgl.dispose();modelAssets.entries.delete('Browser AI model');}
  });
  expect(result.opaque).toBeGreaterThan(100);expect(result.changed).toBeGreaterThan(100);
  expect(result.yaw).toBeCloseTo(0.57);expect(result.wheels).toBe(4);
});
