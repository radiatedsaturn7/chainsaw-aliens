import {test,expect} from '@playwright/test';

async function open(page,mobile=false){
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
  await page.evaluate(mobile=>{
    const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;
    g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
    g.enterModelEditor();
  },mobile);
  await page.waitForFunction(()=>window.__game?.modelEditor?.modelBounds?.w>0);
}
async function clickButton(page,id){
  await expect.poll(()=>page.evaluate(id=>window.__game.modelEditor.buttons.some(b=>b.id===id),id)).toBe(true);
  const point=await page.evaluate(id=>{
    const g=window.__game,b=g.modelEditor.buttons.find(b=>b.id===id).bounds,r=g.canvas.getBoundingClientRect();
    return {x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height};
  },id);
  await page.mouse.click(point.x,point.y);
}

test('desktop modeling menus render a mesh and support undo and native roundtrip',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1280,height:800});await open(page);
  await clickButton(page,'mesh');await clickButton(page,'shape-box');
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.length)).toBe(8);
  await clickButton(page,'mesh');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.modelEditor.desktopDropdown))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('model-editor');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.modelEditor.modelRenderer.root?.children.length))).toBe(true);
  const pixels=await page.evaluate(()=>{
    const r=window.__game.modelEditor.modelRenderer.renderer,gl=r.getContext(),buffer=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
    let opaque=0;for(let i=3;i<buffer.length;i+=4)if(buffer[i]>0)opaque++;return opaque;
  });
  expect(pixels).toBeGreaterThan(100);
  await page.keyboard.press('Control+d');await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.length)).toBe(16);
  await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.length)).toBe(8);
  await page.evaluate(async()=>{
    const e=window.__game.modelEditor,{saveProjectFileAndConfirm,loadProjectFile}=await import('/src/ui/projectFiles.js');
    await saveProjectFileAndConfirm('models','Browser Model',structuredClone(e.model));
    e.loadModel(loadProjectFile('models','Browser Model').data,'Browser Model');
  });
  expect(await page.evaluate(()=>window.__game.modelEditor.model.faces.length)).toBe(12);
  expect(errors).toEqual([]);
});

test('portrait uses the four bottom controls, thumbstick, hotbar and zoom',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,true);
  const state=await page.evaluate(()=>{
    const e=window.__game.modelEditor;
    return {buttons:e.buttons.map(b=>b.id),thumbstick:e.portraitThumbstick.radius>0,bounds:e.modelBounds};
  });
  for(const id of ['menu','undo','redo','model-play','select-vertices','select-faces','race-map-zoom'])expect(state.buttons).toContain(id);
  expect(state.bounds.w).toBeGreaterThan(100);
  expect(state.thumbstick).toBe(true);
  await clickButton(page,'menu');
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.mobileRootOpen)).toBe(true);
  await page.screenshot({path:'test-results/model3d-portrait-menu.png'});
});
