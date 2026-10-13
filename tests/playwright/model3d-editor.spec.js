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
  await page.evaluate(()=>window.__game.modelEditor.handleMenuAction('select-all'));
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
  for(const id of ['menu','undo','redo','model-play','model-selection','model-camera','model-transform','model-tools','race-map-zoom'])expect(state.buttons).toContain(id);
  expect(state.bounds.w).toBeGreaterThan(100);
  expect(state.thumbstick).toBe(true);
  await clickButton(page,'menu');
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.mobileRootOpen)).toBe(true);
  await page.screenshot({path:'test-results/model3d-portrait-menu.png'});
});

test('rig, animation and UV painting work together through editor commands and dialogs',async({page})=>{
  await page.setViewportSize({width:1280,height:800});await open(page);
  const command=async id=>{await page.evaluate(id=>{void window.__game.modelEditor.handleMenuAction(id);},id);};
  const apply=async title=>{await page.getByRole('dialog',{name:title,exact:true}).getByRole('button',{name:'Apply',exact:true}).click();};
  const clickAt=async point=>{
    const screen=await page.evaluate(point=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return {x:r.x+point.x*r.width/g.viewport.width,y:r.y+point.y*r.height/g.viewport.height};},point);
    await page.mouse.click(screen.x,screen.y);
  };
  await command('select-all');await command('joint-root');
  await clickAt(await page.evaluate(()=>{const b=window.__game.modelEditor.modelBounds;return {x:b.x+b.w/2,y:b.y+b.h/2};}));
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.joints.length)).toBe(1);
  await command('assign-joint');await apply('Vertex weight');
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.every(v=>v.weights.length===1&&v.weights[0].weight===1))).toBe(true);
  await command('animation-new');
  await page.getByRole('dialog',{name:'New animation',exact:true}).getByLabel('Name',{exact:true}).fill('Wave');await apply('New animation');
  await command('keyframe-set');await command('animation-time');
  await page.getByLabel('Time (seconds)',{exact:true}).fill('1');await apply('Timeline');
  await command('pose-joint');await page.getByLabel('Rotation Z (degrees)',{exact:true}).fill('60');await apply('Pose joint');
  await command('keyframe-set');
  await expect.poll(()=>page.evaluate(()=>{const e=window.__game.modelEditor;return e.model.animations[0].tracks[e.joint].length;})).toBe(2);
  await command('animation-time');await page.getByLabel('Time (seconds)',{exact:true}).fill('0.5');await apply('Timeline');
  await expect.poll(()=>page.evaluate(()=>{const e=window.__game.modelEditor;return e.pose[e.joint]?.rotation[2]||0;})).toBeCloseTo(Math.sin(Math.PI/12),4);
  await command('uv-generate');await command('uv-paint');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.modelEditor.uvBounds))).toBe(true);
  await clickAt(await page.evaluate(()=>{const b=window.__game.modelEditor.uvBounds;return {x:b.x+b.w/2,y:b.y+b.h/2};}));
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.activeMaterial().texture?.pixels.includes('#df533f')||false)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.modelEditor.modelRenderer.root?.userData.materials[0].map))).toBe(true);
  // Material selection exercises the shared select dialog, including its label.
  await command('texture-material');await page.getByLabel('Material',{exact:true}).selectOption('material-0');await apply('Texture material');
  await command('undo');
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.activeMaterial().texture)).toBe(null);
});

test('starter cube has a grid and four hotbar groups that select and transform an object',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,true);
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.length)).toBe(8);
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.modelRenderer.grid?.visible)).toBe(true);
  const choose=async(group,value)=>{
    await clickButton(page,`model-${group.toLowerCase()}`);
    const dialog=page.getByRole('dialog',{name:group,exact:true});
    await dialog.getByLabel(group,{exact:true}).selectOption(value);
    await dialog.getByRole('button',{name:'Apply',exact:true}).click();
  };
  await choose('Selection','select-object');
  const screen=async point=>page.evaluate(point=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return {x:r.x+point.x*r.width/g.viewport.width,y:r.y+point.y*r.height/g.viewport.height};},point);
  const center=await screen(await page.evaluate(()=>{const b=window.__game.modelEditor.modelBounds;return {x:b.x+b.w/2,y:b.y+b.h/2};}));
  await page.mouse.click(center.x,center.y);
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.selectedVertices().length)).toBe(8);
  const before=await page.evaluate(()=>window.__game.modelEditor.model.vertices.map(v=>v.position));
  for(const mode of ['move','rotate','scale']){
    await choose('Transform',`${mode}-selection`);
    const previous=await page.evaluate(()=>window.__game.modelEditor.model.vertices.map(v=>v.position));
    await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+30,center.y-12,{steps:5});await page.mouse.up();
    expect(await page.evaluate(()=>window.__game.modelEditor.model.vertices.map(v=>v.position))).not.toEqual(previous);
  }
  await choose('Camera','view-x');await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.view)).toBe('x');
  await choose('Tools','mirror-x');await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.model.vertices.length)).toBe(16);
  expect(before).toHaveLength(8);
  await page.screenshot({path:'test-results/model3d-hotbar-grid.png'});
});

for(const mobile of [false,true])test(`${mobile?'touch portrait':'desktop'} selection exposes draggable XYZ transform handles`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await open(page,mobile);
 const screen=point=>page.evaluate(p=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return {x:r.x+p.x*r.width/g.viewport.width,y:r.y+p.y*r.height/g.viewport.height}},point);
 const touch=mobile?await page.context().newCDPSession(page):null;
 const drag=async(a,b)=>{
  if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=5;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/5,y:a.y+(b.y-a.y)*i/5}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();}
 };
 for(const kind of ['vertices','faces','object']){
  await page.evaluate(async kind=>{const e=window.__game.modelEditor;await e.handleMenuAction('new');await e.handleMenuAction(`select-${kind}`);return null},kind);
  await page.waitForFunction(()=>window.__game.modelEditor.modelRenderer.camera);
  const pick=await page.evaluate(kind=>{const e=window.__game.modelEditor;if(kind==='vertices')return e.model.vertices.map(v=>e.modelRenderer.project(v.position)).sort((a,b)=>Math.hypot(a.x-(e.modelBounds.x+e.modelBounds.w/2),a.y-(e.modelBounds.y+e.modelBounds.h/2))-Math.hypot(b.x-(e.modelBounds.x+e.modelBounds.w/2),b.y-(e.modelBounds.y+e.modelBounds.h/2)))[0];return e.modelRenderer.project([0,0,0]);},kind);
  const p=await screen(pick);if(mobile){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await page.mouse.click(p.x,p.y);
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.selectedVertices().length)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.modelGizmo?.handles.length||0)).toBe(3);
  const colors=await page.evaluate(()=>{const game=window.__game,e=game.modelEditor,g=e.modelGizmo,ctx=game.canvas.getContext('2d'),ratio=game.canvas.width/game.viewport.width;
   return g.handles.map(h=>{const end=h.points[1],x=Math.round((g.origin.x+(end.x-g.origin.x)*0.7)*ratio),y=Math.round((g.origin.y+(end.y-g.origin.y)*0.7)*ratio),pixels=ctx.getImageData(x-4,y-4,9,9).data,target=[[255,89,89],[101,223,120],[85,157,255]][h.axis];
    for(let i=0;i<pixels.length;i+=4)if(target.every((v,k)=>Math.abs(pixels[i+k]-v)<15))return true;return false;
   });
  });expect(colors).toEqual([true,true,true]);
  const info=await page.evaluate(()=>{const e=window.__game.modelEditor,g=e.getModelGizmo(),end=g.handles.find(h=>h.axis===0).points[1];return {before:structuredClone(e.model.vertices),ids:e.selectedVertices(),a:{x:g.origin.x+(end.x-g.origin.x)*0.8,y:g.origin.y+(end.y-g.origin.y)*0.8},b:{x:g.origin.x+(end.x-g.origin.x)*1.1,y:g.origin.y+(end.y-g.origin.y)*1.1}}});
  await drag(await screen(info.a),await screen(info.b));
  const after=await page.evaluate(()=>({vertices:window.__game.modelEditor.model.vertices,undo:window.__game.modelEditor.history.undoStack.length}));
  expect(after.undo).toBe(1);
  for(let i=0;i<after.vertices.length;i++){expect(after.vertices[i].position.slice(1)).toEqual(info.before[i].position.slice(1));if(info.ids.includes(after.vertices[i].id))expect(after.vertices[i].position[0]).toBeGreaterThan(info.before[i].position[0]);else expect(after.vertices[i]).toEqual(info.before[i]);}
  await page.evaluate(()=>window.__game.modelEditor.handleMenuAction('undo'));expect(await page.evaluate(()=>window.__game.modelEditor.model.vertices)).toEqual(info.before);
 }
 await page.evaluate(async()=>{const e=window.__game.modelEditor;await e.handleMenuAction('select-all');await e.handleMenuAction('rotate-selection')});
 await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.modelGizmo?.mode)).toBe('rotate');
 await page.screenshot({path:`test-results/model-gizmo-${mobile?'portrait':'desktop'}.png`});
 if(touch)await touch.detach();
});
