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
